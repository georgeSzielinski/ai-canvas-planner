export const DEMO_REFERENCE_DATE = "2026-09-16T12:00:00-07:00";

export function demoDate(dayOffset: number, time = "23:59"): string {
  const date = new Date(DEMO_REFERENCE_DATE);
  date.setDate(date.getDate() + dayOffset);
  const [hours, minutes] = time.split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

export const formatDemoDate = (value: string, includeTime = true): string =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
    timeZone: "America/Los_Angeles",
  }).format(new Date(value));

export const demoLongDate = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "America/Los_Angeles",
}).format(new Date(DEMO_REFERENCE_DATE));
