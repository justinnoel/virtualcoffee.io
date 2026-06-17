// Recurring event definitions. The daily Cron Trigger
// (src/data/events/materialize.ts) expands each def into discrete
// occurrence rows in D1, idempotent on (slug, start_utc).
//
// All Virtual Coffee events run in America/New_York; storing wall-time +
// IANA zone keeps EDT/EST correct without a hand-edit each March/November.
// Luxon weekday: 1=Mon … 7=Sun.

export type RecurringEventDef = {
	slug: string;
	title: string;
	description: string;
	weekday: number;
	time: string; // 'HH:mm' wall-clock in `timezone`
	durationMinutes: number;
	timezone: string;
	startsOn?: string; // ISO date (inclusive lower bound)
	endsOn?: string; // ISO date (inclusive upper bound)
};

export const recurringEvents: RecurringEventDef[] = [
	{
		slug: 'coffee-morning',
		title: 'Virtual Coffee - Morning Crowd',
		description:
			'<p>An hour-long chat with devs at all stages of the journey. You can come to hang out with great people, ask questions or bring up a topic, or just sit back and listen to others talk about tech. Currently open to slack members only. Check announcements for the Join Event button. Every Tuesday at 9AM ET!</p>',
		weekday: 2,
		time: '09:00',
		durationMinutes: 60,
		timezone: 'America/New_York',
	},
	{
		slug: 'coffee-afternoon',
		title: 'Virtual Coffee - Afternoon Crowd',
		description:
			'<p>An hour-long chat with devs at all stages of the journey. You can come to hang out with great people, ask questions or bring up a topic, or just sit back and listen to others talk about tech. Currently open to slack members only. Check announcements for the Join Event button. Every Thursday at 12pm ET!</p>',
		weekday: 4,
		time: '12:00',
		durationMinutes: 60,
		timezone: 'America/New_York',
	},
	{
		slug: 'feelings-friday',
		title: 'Feelings Friday',
		description:
			"<p>Feelings Friday was started at the Flatiron School coding boot camp by its founders, Avi Flombaum & Adam Enbar, after they noticed burnout among their first cohorts. Join a supportive group where everyone has the opportunity to share what's on their mind in a safe environment. It's a great way to unwind at the end of the week!</p>",
		weekday: 5,
		time: '18:00',
		durationMinutes: 60,
		timezone: 'America/New_York',
	},
	{
		slug: 'the-pack-hunt',
		title: 'The Pack Hunt',
		description:
			"<p>Job hunting as a collective: An accountability session exclusively for job hunting. Support each other by being present and sharing your goals, target roles, and resources. Let's collaborate as we apply for jobs, reach out to recruiters, and scroll LinkedIn for leads. 'Hunt with the pack! Arwoooo...!!!'</p>",
		weekday: 1,
		time: '11:00',
		durationMinutes: 110,
		timezone: 'America/New_York',
	},
	{
		slug: 'accountabilibuddies',
		title: 'Accountabilibuddies',
		description:
			"<p>You want to learn that new tool/finish up that blog post/send that job application, but you're so busy that the day is over before you know it. Join us and add some fun and friendly accountability to your schedule! Drop into our sessions whenever and for however long your schedule allows. No matter the goal, you'll find encouragement and support alongside your Accountabilibuddies!</p>",
		weekday: 2,
		time: '13:00',
		durationMinutes: 180,
		timezone: 'America/New_York',
	},
];
