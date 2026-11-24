// Exclusive cutoff: midnight in Asia/Karachi after the final sale day.
export const LIFETIME_ENDS_AT = '2026-12-16T19:00:00.000Z'
export const lifetimeLastDay = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'long',
  timeZone: 'Asia/Karachi',
}).format(Date.parse(LIFETIME_ENDS_AT) - 1)
