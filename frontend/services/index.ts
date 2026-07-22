import { backendAssignmentsService, demoAssignmentsService } from "./assignments-service";
import { backendCanvaiService, demoCanvaiService } from "./canvai-service";
import { backendInsightsService, demoInsightsService } from "./insights-service";
import { backendSettingsService, demoSettingsService } from "./settings-service";

export const dataMode = process.env.NEXT_PUBLIC_DATA_MODE === "backend" ? "backend" : "demo";

export const services =
  dataMode === "backend"
    ? {
        assignments: backendAssignmentsService,
        canvai: backendCanvaiService,
        insights: backendInsightsService,
        settings: backendSettingsService,
      }
    : {
        assignments: demoAssignmentsService,
        canvai: demoCanvaiService,
        insights: demoInsightsService,
        settings: demoSettingsService,
      };
