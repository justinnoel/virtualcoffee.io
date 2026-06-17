'use server';

import { env } from 'cloudflare:workers';
import { redirect } from 'next/navigation';
import type { FormState } from './types';
import { HONEYPOT_FIELD } from './Honeypot';

// Per-form configuration drives a single shared makeAction. Each entry maps a
// FormData key -> the snake_case D1 column. `required` fields are validated
// server-side (present + trimmed non-empty); optional fields are inserted as
// NULL when blank.
type FieldConfig = {
	formKey: string;
	column: string;
	required: boolean;
	isEmail?: boolean;
};

type ActionConfig = {
	table: string;
	fields: FieldConfig[];
	redirectPath: string;
	notifyListSecret: keyof FormNotifySecrets;
	subject: string;
};

type FormNotifySecrets = {
	LUNCH_AND_LEARN_NOTIFY_LIST?: string;
	COC_NOTIFY_LIST?: string;
	COFFEE_TABLE_NOTIFY_LIST?: string;
	VOLUNTEER_NOTIFY_LIST?: string;
};

const EMAIL_FROM = 'forms@virtualcoffee.io';

// Crude RFC-5322-ish format check. The DB column is the backstop for
// well-formedness; this only catches the obvious "not an email" submissions
// so we can surface a useful FormState error instead of a DB constraint error.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getTrimmed(formData: FormData, key: string): string {
	const v = formData.get(key);
	return typeof v === 'string' ? v.trim() : '';
}

function validate(
	formData: FormData,
	fields: FieldConfig[],
): { ok: true; values: (string | null)[] } | { ok: false; message: string } {
	const values: (string | null)[] = [];
	for (const f of fields) {
		const v = getTrimmed(formData, f.formKey);
		if (f.required && v === '') {
			return { ok: false, message: `Please fill in the ${f.formKey} field.` };
		}
		if (f.isEmail && v !== '' && !EMAIL_RE.test(v)) {
			return { ok: false, message: 'Please provide a valid email address.' };
		}
		values.push(v === '' ? null : v);
	}
	return { ok: true, values };
}

async function insertRow(
	table: string,
	fields: FieldConfig[],
	values: (string | null)[],
): Promise<number> {
	const columns = fields.map((f) => f.column).join(', ');
	const placeholders = fields.map(() => '?').join(', ');
	const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
	const result = await env.DB.prepare(sql)
		.bind(...values)
		.run();
	return Number(result.meta.last_row_id ?? 0);
}

// Tiny RFC 2822 message builder. The `send_email` binding needs a raw MIME
// envelope; we send plain text, so a hand-built message is enough and avoids
// adding a runtime dep.
function buildRawMessage(opts: {
	from: string;
	to: string;
	subject: string;
	text: string;
}): string {
	const date = new Date().toUTCString();
	const messageId = `<${crypto.randomUUID()}@virtualcoffee.io>`;
	const headers = [
		`From: ${opts.from}`,
		`To: ${opts.to}`,
		`Subject: ${opts.subject}`,
		`Date: ${date}`,
		`Message-ID: ${messageId}`,
		'MIME-Version: 1.0',
		'Content-Type: text/plain; charset=utf-8',
		'Content-Transfer-Encoding: 7bit',
	];
	return `${headers.join('\r\n')}\r\n\r\n${opts.text}`;
}

function buildBody(
	table: string,
	rowId: number,
	fields: FieldConfig[],
	values: (string | null)[],
	isCoC: boolean,
): string {
	const lines: string[] = [
		`New submission in ${table} (id ${rowId}):`,
		'',
	];
	for (let i = 0; i < fields.length; i++) {
		const f = fields[i];
		let v = values[i];
		if (isCoC && (f.column === 'name' || f.column === 'email') && !v) {
			v = '(anonymous)';
		}
		lines.push(`${f.column}: ${v ?? ''}`);
	}
	return lines.join('\n');
}

async function sendNotification(opts: {
	subject: string;
	text: string;
	recipients: string;
}): Promise<void> {
	// send_email is not available in local `wrangler dev` / miniflare. Log
	// instead so the best-effort contract holds in dev.
	if (!env.EMAIL) {
		console.log(
			`[forms] EMAIL binding missing — would notify ${opts.recipients}:\n${opts.text}`,
		);
		return;
	}
	const recipientList = opts.recipients
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	if (recipientList.length === 0) return;

	// Lazy import — `cloudflare:email` is a Workers runtime module and isn't
	// resolvable in the client/SSR dep scan.
	const { EmailMessage } = await import('cloudflare:email');

	for (const to of recipientList) {
		try {
			const raw = buildRawMessage({
				from: EMAIL_FROM,
				to,
				subject: opts.subject,
				text: opts.text,
			});
			const message = new EmailMessage(EMAIL_FROM, to, raw);
			await env.EMAIL.send(message);
		} catch (err) {
			console.error(`[forms] email send to ${to} failed`, err);
		}
	}
}

function makeAction(config: ActionConfig) {
	return async function create(
		_: FormState,
		formData: FormData,
	): Promise<FormState> {
		// Honeypot: silently succeed (no DB write, no email).
		if (getTrimmed(formData, HONEYPOT_FIELD) !== '') {
			redirect(config.redirectPath);
		}

		const validation = validate(formData, config.fields);
		if (!validation.ok) {
			return { is_error: true, message: validation.message };
		}

		let rowId: number;
		try {
			rowId = await insertRow(config.table, config.fields, validation.values);
		} catch (err) {
			console.error(`[forms] D1 insert into ${config.table} failed`, err);
			return {
				is_error: true,
				message: 'Form submission failed. Please try again.',
			};
		}

		// Best-effort notification. Failure here must not block the user or
		// lose the submission.
		try {
			const recipients = (env as unknown as FormNotifySecrets)[
				config.notifyListSecret
			];
			if (recipients) {
				const body = buildBody(
					config.table,
					rowId,
					config.fields,
					validation.values,
					config.table === 'coc_violation_reports',
				);
				await sendNotification({
					subject: config.subject,
					text: body,
					recipients,
				});
			} else {
				console.warn(
					`[forms] ${config.notifyListSecret} not set; skipping notification`,
				);
			}
		} catch (err) {
			console.error('[forms] notification failed (continuing)', err);
		}

		redirect(config.redirectPath);
	};
}

// Lunch & Learn — form uses capitalized field names; map them to snake_case
// columns in the table.
export const createLunchAndLearnSubmission = makeAction({
	table: 'lunch_and_learn_ideas',
	redirectPath: '/lunch-and-learn-idea/thanks',
	notifyListSecret: 'LUNCH_AND_LEARN_NOTIFY_LIST',
	subject: 'New Lunch & Learn idea',
	fields: [
		{ formKey: 'Name', column: 'name', required: true },
		{ formKey: 'Email', column: 'email', required: true, isEmail: true },
		{ formKey: 'Topic', column: 'topic', required: true },
		{ formKey: 'Description', column: 'description', required: true },
		{ formKey: 'Format', column: 'format', required: false },
		{ formKey: 'Timing', column: 'timing', required: true },
	],
});

// CoC violation — name + email optional to preserve anonymity.
export const createCoCViolation = makeAction({
	table: 'coc_violation_reports',
	redirectPath: '/report-coc-violation/thanks',
	notifyListSecret: 'COC_NOTIFY_LIST',
	subject: 'New Code of Conduct report',
	fields: [
		{ formKey: 'name', column: 'name', required: false },
		{ formKey: 'email', column: 'email', required: false, isEmail: true },
		{ formKey: 'reportee_name', column: 'reportee_name', required: true },
		{ formKey: 'time_location', column: 'time_location', required: true },
		{ formKey: 'description', column: 'description', required: true },
		{
			formKey: 'anyone_else_involved',
			column: 'anyone_else_involved',
			required: false,
		},
	],
});

export const createCoffeeTableGroup = makeAction({
	table: 'coffee_table_groups',
	redirectPath: '/start-coffee-table-group/thanks',
	notifyListSecret: 'COFFEE_TABLE_NOTIFY_LIST',
	subject: 'New Coffee Table Group request',
	fields: [
		{ formKey: 'name', column: 'name', required: true },
		{ formKey: 'email', column: 'email', required: true, isEmail: true },
		{ formKey: 'group_name', column: 'group_name', required: true },
		{ formKey: 'description', column: 'description', required: true },
	],
});

export const createVolunteer = makeAction({
	table: 'volunteer_submissions',
	redirectPath: '/volunteer-at-virtual-coffee/thanks',
	notifyListSecret: 'VOLUNTEER_NOTIFY_LIST',
	subject: 'New volunteer submission',
	fields: [
		{ formKey: 'name', column: 'name', required: true },
		{ formKey: 'email', column: 'email', required: true, isEmail: true },
		{
			formKey: 'github_username',
			column: 'github_username',
			required: true,
		},
		{ formKey: 'position', column: 'position', required: true },
		{ formKey: 'description', column: 'description', required: true },
	],
});
