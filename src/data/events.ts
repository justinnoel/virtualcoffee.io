'use server';

import { env } from 'cloudflare:workers';
import { unstable_cache } from 'next/cache';
import { DateTime } from 'luxon';
import { sanitizeHtml } from '@/util/sanitizeCmsData';
import { ics, google, outlook } from 'calendar-link';

interface EventRow {
	id: number;
	title: string;
	description: string | null;
	start_utc: string;
	end_utc: string;
}

export interface EventItem {
	id: number;
	title: string;
	startDateLocalized: string;
	endDateLocalized: string;
	eventCalendarDescription: string;
	eventCalendarLinks: {
		google: string;
		outlook: string;
		ics: string;
	};
}
export type EventsResponse = Array<EventItem>;

export const getEvents = unstable_cache(
	async ({ limit }: { limit: number }): Promise<EventsResponse> => {
		const rangeStart = DateTime.now().toUTC().set({ hour: 0 }).toISO();
		const rangeEnd = DateTime.now()
			.toUTC()
			.set({ hour: 0 })
			.plus({ days: 30 })
			.toISO();

		try {
			const { results } = await env.DB.prepare(
				`SELECT id, title, description, start_utc, end_utc
				 FROM events
				 WHERE start_utc >= ?1 AND start_utc <= ?2 AND cancelled = 0
				 ORDER BY start_utc ASC
				 LIMIT ?3`,
			)
				.bind(rangeStart, rangeEnd, limit)
				.all<EventRow>();

			return await Promise.all(
				(results ?? []).map(async (row) => {
					const sanitizedDescription = await sanitizeHtml(
						row.description ?? '',
					);
					const calendarLinkGoogle = google({
						title: row.title,
						start: row.start_utc,
						end: row.end_utc,
						description: sanitizedDescription,
					});
					const calendarLinkOutlook = outlook({
						title: row.title,
						start: row.start_utc,
						end: row.end_utc,
						description: sanitizedDescription,
					});
					const calendarLinkIcs = ics({
						title: row.title,
						start: row.start_utc,
						end: row.end_utc,
						description: sanitizedDescription,
					});
					return {
						id: row.id,
						title: row.title,
						startDateLocalized: row.start_utc,
						endDateLocalized: row.end_utc,
						eventCalendarDescription: sanitizedDescription,
						eventCalendarLinks: {
							google: calendarLinkGoogle,
							outlook: calendarLinkOutlook,
							ics: calendarLinkIcs,
						},
					};
				}),
			);
		} catch (e) {
			console.error(e);
			return [];
		}
	},
	['events'],
	{ revalidate: 43200, tags: ['events'] },
);
