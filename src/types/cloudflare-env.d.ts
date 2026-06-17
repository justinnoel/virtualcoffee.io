declare module 'cloudflare:workers' {
	export interface Env {
		SITE_URL: string;
		ENVIRONMENT: 'production' | 'preview' | 'development' | string;
		GITHUB_TOKEN?: string;
		PUBLIC_AIRTABLE_API_KEY?: string;
		REVALIDATE_SECRET?: string;
		SLACK_JOIN_LINK?: string;
		ZOOM_TUESDAYS?: string;
		ZOOM_THURSDAYS?: string;
		// D1 binding for the 4 public forms + events. Schema in /migrations.
		DB: D1Database;
		// Cloudflare send_email binding. Undefined in local wrangler dev
		// (miniflare); the action falls back to console.log there.
		EMAIL?: {
			send: (message: unknown) => Promise<void>;
		};
		// Comma-separated lists of verified recipient addresses, one per form.
		// Set via `wrangler secret put` in prod, .dev.vars locally.
		LUNCH_AND_LEARN_NOTIFY_LIST?: string;
		COC_NOTIFY_LIST?: string;
		COFFEE_TABLE_NOTIFY_LIST?: string;
		VOLUNTEER_NOTIFY_LIST?: string;
	}

	export const env: Env;
}

// Minimal D1Database surface used by the forms action. The full type ships
// with @cloudflare/workers-types, but pulling that in for one call site adds
// a non-trivial dep tree — this matches what env.DB.prepare(...).bind(...).run()
// returns.
interface D1Database {
	prepare(query: string): D1PreparedStatement;
}

interface D1PreparedStatement {
	bind(...values: (string | number | null)[]): D1PreparedStatement;
	run(): Promise<{
		meta: { last_row_id?: number | bigint; changes?: number };
	}>;
	all<T = Record<string, unknown>>(): Promise<{
		results?: T[];
		success?: boolean;
	}>;
}

// `cloudflare:email` is a Workers runtime module. Declare the minimal shape
// we use so the dynamic import in src/util/forms/action.ts typechecks.
declare module 'cloudflare:email' {
	export class EmailMessage {
		constructor(from: string, to: string, raw: string);
	}
}
