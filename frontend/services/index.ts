import { backendAssignmentsService } from "./assignments-service";
import { backendSettingsService } from "./settings-service";

export const dataMode = "backend" as const;

export const services = {
  assignments: backendAssignmentsService,
  settings: backendSettingsService,
};
