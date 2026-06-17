// Custom Worker entry. vinext's built-in entry exports only `fetch`, but
// Cloudflare Cron Triggers require a `scheduled()` handler — so this file
// delegates HTTP requests to vinext and adds the cron path for the daily
// recurring-events materialization (see src/data/events/materialize.ts).
//
// wrangler.jsonc `main` points here instead of `vinext/server/app-router-entry`.

import vinext from 'vinext/server/app-router-entry';
import type { Env } from 'cloudflare:workers';
import { materializeRecurringEvents } from '@/data/events/materialize';

type ScheduledController = {
	scheduledTime: number;
	cron: string;
	noRetry?: () => void;
};

type WorkerExecutionContext = {
	waitUntil(promise: Promise<unknown>): void;
	passThroughOnException?(): void;
};

export default {
	fetch: vinext.fetch,
	async scheduled(
		_event: ScheduledController,
		env: Env,
		ctx: WorkerExecutionContext,
	): Promise<void> {
		ctx.waitUntil(
			(async () => {
				try {
					const result = await materializeRecurringEvents(env);
					console.log('[cron] materializeRecurringEvents', result);
				} catch (err) {
					console.error('[cron] materializeRecurringEvents failed', err);
				}
			})(),
		);
	},
};
