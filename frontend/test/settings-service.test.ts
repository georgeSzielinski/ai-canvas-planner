import { expect, it } from "vitest";
import { settingsFromWire, settingsToWire } from "@/services/settings-service";

it("maps nested settings between API snake_case and UI camelCase", () => {
  const frontend = settingsFromWire({
    study: { preferred_session_minutes: 45, study_before_school: false },
    calendar: { busy_calendars: ["primary"] },
  });

  expect(frontend).toEqual({
    study: { preferredSessionMinutes: 45, studyBeforeSchool: false },
    calendar: { busyCalendars: ["primary"] },
  });
  expect(settingsToWire(frontend)).toEqual({
    study: { preferred_session_minutes: 45, study_before_school: false },
    calendar: { busy_calendars: ["primary"] },
  });
});
