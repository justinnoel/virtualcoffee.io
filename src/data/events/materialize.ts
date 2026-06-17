import { DateTime } from 'luxon';
import type { Env } from 'cloudflare:workers';
import { recurringEvents, type RecurringEventDef } from './recurring';

const HORIZON_DAYS = 60;
const PRUNE_BEFORE_DAYS = 30;

type Occurrence = {
	slug: string;
	title: string;
	description: string;
	startUtc: string;
	endUtc: string;
	timezone: string;
};

function expand(def: RecurringEventDef, horizonDays: number): Occurrence[] {
	const [hourStr, minuteStr] = def.time.split(':');
	const hour = Number(hourStr);
	const minute = Number(minuteStr);
	const startsOn = def.startsOn
		? DateTime.fromISO(def.startsOn, { zone: def.timezone }).startOf('day')
		: null;
	const endsOn = def.endsOn
		? DateTime.fromISO(def.endsOn, { zone: def.timezone }).endOf('day')
		: null;

	const now = DateTime.now().setZone(def.timezone);
	const horizonEnd = now.plus({ days: horizonDays });

	// Walk forward from today in the def's zone, pick days matching weekday.
	const occurrences: Occurrence[] = [];
	let cursor = now.startOf('day');
	while (cursor <= horizonEnd) {
		if (cursor.weekday === def.weekday) {
			const start = cursor.set({ hour, minute, second: 0, millisecond: 0 });
			if (start.isValid && start >= now.startOf('day')) {
				const withinStarts = !startsOn || start >= startsOn;
				const withinEnds = !endsOn || start <= endsOn;
				if (withinStarts && withinEnds) {
					const end = start.plus({ minutes: def.durationMinutes });
					occurrences.push({
						slug: def.slug,
						title: def.title,
						description: def.description,
						startUtc: start.toUTC().toISO()!,
						endUtc: end.toUTC().toISO()!,
						timezone: def.timezone,
					});
				}
			}
		}
		cursor = cursor.plus({ days: 1 });
	}
	return occurrences;
}

export async function materializeRecurringEvents(env: Env): Promise<{
	inserted: number;
	pruned: number;
}> {
	if (!env.DB) {
		console.warn('[events.materialize] DB binding missing; skipping');
		return { inserted: 0, pruned: 0 };
	}

	let inserted = 0;
	for (const def of recurringEvents) {
		const occurrences = expand(def, HORIZON_DAYS);
		for (const o of occurrences) {
			const res = await env.DB.prepare(
				`INSERT INTO events (title, description, start_utc, end_utc, timezone, source, source_id)
				 VALUES (?1, ?2, ?3, ?4, ?5, 'recurring', ?6)
				 ON CONFLICT (source_id, start_utc) DO NOTHING`,
			)
				.bind(o.title, o.description, o.startUtc, o.endUtc, o.timezone, o.slug)
				.run();
			if (res.meta?.changes && res.meta.changes > 0) inserted += 1;
		}
	}

	const pruneBefore = DateTime.now()
		.toUTC()
		.minus({ days: PRUNE_BEFORE_DAYS })
		.toISO()!;
	const pruneRes = await env.DB.prepare(
		`DELETE FROM events WHERE start_utc < ?1`,
	)
		.bind(pruneBefore)
		.run();
	const pruned = Number(pruneRes.meta?.changes ?? 0);

	return { inserted, pruned };
}
