export const formatDate = (value: string | null, includeTime = true): string =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
      }).format(new Date(value))
    : "No due date";

export const currentLongDate = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
}).format(new Date());
