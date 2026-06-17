// Seeds the local D1 `events` table with recurring-event occurrences for local
// development. Reuses the exact same materializer the production daily cron
// runs (src/data/events/materialize.ts), so local data matches prod behavior,
// stays date-correct (occurrences expand from "now"), and is idempotent —
// re-running never duplicates rows.
//
// Requires the local `events` table to exist first:
//   pnpm wrangler d1 migrations apply virtualcoffee-forms --local
//
// Usage:
//   pnpm seed:events
import { getPlatformProxy } from 'wrangler';
import { materializeRecurringEvents } from '../src/data/events/materialize';

async function main() {
	const proxy = await getPlatformProxy();
	try {
		if (!proxy.env?.DB) {
			throw new Error(
				'No local D1 `DB` binding found. Apply migrations first:\n' +
					'  pnpm wrangler d1 migrations apply virtualcoffee-forms --local',
			);
		}
		const result = await materializeRecurringEvents(
			proxy.env as unknown as Parameters<typeof materializeRecurringEvents>[0],
		);
		console.log(
			`Seeded local events — inserted ${result.inserted}, pruned ${result.pruned}.`,
		);
	} finally {
		await proxy.dispose();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
