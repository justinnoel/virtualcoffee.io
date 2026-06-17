// Hidden honeypot field. Bots that auto-fill every input set this; the action
// silently redirects to /thanks without writing to D1 or sending email.
// a11y-neutral: aria-hidden, removed from tab order, autocomplete off.
export const HONEYPOT_FIELD = 'website_url';

export function Honeypot() {
	return (
		<div
			aria-hidden="true"
			style={{
				position: 'absolute',
				left: '-9999px',
				width: '1px',
				height: '1px',
				overflow: 'hidden',
			}}
		>
			<label htmlFor={HONEYPOT_FIELD}>
				Leave this field blank if you are human:
			</label>
			<input
				type="text"
				id={HONEYPOT_FIELD}
				name={HONEYPOT_FIELD}
				tabIndex={-1}
				autoComplete="off"
			/>
		</div>
	);
}
