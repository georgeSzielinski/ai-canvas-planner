import type {
  Assignment,
  AssignmentAnalysis,
  ScheduleChange,
  ScheduleProposal,
} from "@/types/domain";
import { apiClient } from "./api-client";

export interface CanvaiExplanation {
  title: string;
  body: string;
  factors: string[];
}
export interface CanvaiService {
  analyzeAssignment(assignment: Assignment): Promise<AssignmentAnalysis>;
  proposeScheduleChange(command: string): Promise<ScheduleProposal>;
  explainPriority(assignment: Assignment): Promise<CanvaiExplanation>;
}

const proposalChanges: Record<string, ScheduleChange[]> = {
  "Make tonight lighter": [
    {
      id: "move-physics",
      kind: "move",
      label: "Move Physics review",
      before: "Tonight · 9:25 PM",
      after: "Thursday · 7:10 AM",
    },
    {
      id: "protect-winddown",
      kind: "protect",
      label: "Restore wind-down time",
      before: "10:30 PM",
      after: "9:45 PM",
    },
  ],
  "Protect sleep": [
    {
      id: "protect-cutoff",
      kind: "protect",
      label: "Lock the study cutoff",
      before: "Flexible",
      after: "10:15 PM",
    },
    {
      id: "move-seminar",
      kind: "move",
      label: "Shorten AP Seminar tonight",
      before: "45 minutes",
      after: "30 minutes + 15 tomorrow",
    },
  ],
  "Keep Sunday light": [
    {
      id: "move-essay",
      kind: "move",
      label: "Start the English essay earlier",
      before: "Sunday · 90 minutes",
      after: "Thursday · 40 minutes / Saturday · 50 minutes",
    },
  ],
  "Add more English time": [
    {
      id: "add-english",
      kind: "add",
      label: "Add an English outline session",
      after: "Thursday · 8:15 PM · 40 minutes",
    },
  ],
  "Prepare for the Physics test": [
    {
      id: "add-physics",
      kind: "add",
      label: "Add a recall review",
      after: "Thursday · 7:10 AM · 20 minutes",
    },
    {
      id: "move-physics-long",
      kind: "move",
      label: "Split tonight’s Physics prep",
      before: "45 minutes",
      after: "30 tonight + 15 Thursday",
    },
  ],
  "Find time for lifting": [
    {
      id: "add-lifting",
      kind: "add",
      label: "Reserve a lifting block",
      after: "Saturday · 10:00 AM · 60 minutes",
    },
  ],
  "Start the essay earlier": [
    {
      id: "start-essay",
      kind: "add",
      label: "Create a thesis and outline block",
      after: "Thursday · 8:15 PM · 40 minutes",
    },
  ],
  "Rebuild the week": [
    {
      id: "rebalance-sun",
      kind: "move",
      label: "Move Business slide work",
      before: "Sunday · 2:00 PM",
      after: "Saturday · 11:15 AM",
    },
    {
      id: "add-buffer",
      kind: "protect",
      label: "Add recovery buffer after rowing",
      after: "20 minutes on weekdays",
    },
  ],
};

export const supportedCanvaiCommands = [
  "Make tonight lighter",
  "Protect sleep",
  "Keep Sunday light",
  "Add more English time",
  "Prepare for the Physics test",
  "Find time for lifting",
  "Start the essay earlier",
  "Explain this priority",
  "Rebuild the week",
];

export const demoCanvaiService: CanvaiService = {
  async analyzeAssignment(assignment) {
    return structuredClone(assignment.analysis);
  },
  async explainPriority(assignment) {
    return {
      title: `${assignment.title} is priority ${assignment.analysis.priorityScore}`,
      body: assignment.analysis.explanation,
      factors: [
        `Urgency ${assignment.analysis.urgency}/5`,
        `Difficulty ${assignment.analysis.difficulty}/5`,
        `${assignment.points} points`,
      ],
    };
  },
  async proposeScheduleChange(command) {
    await new Promise((resolve) => setTimeout(resolve, 450));
    const changes =
      proposalChanges[command] ??
      (command === "Explain this priority"
        ? [
            {
              id: "explain",
              kind: "protect",
              label: "No schedule change — explanation prepared",
              after: "Physics is high weight, difficult, and less than 48 hours away.",
            },
          ]
        : [
            {
              id: "custom",
              kind: "move",
              label: command,
              before: "Current demo plan",
              after: "Balanced demo plan",
            },
          ]);
    return {
      id: `proposal-${command.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`,
      command,
      summary:
        command === "Explain this priority"
          ? "Here is why Physics leads the plan."
          : `${changes.length} focused change${changes.length > 1 ? "s" : ""} to rebalance your week.`,
      reasoning:
        command === "Explain this priority"
          ? "The Physics test has the highest grade weight, maximum difficulty, and an approaching deadline."
          : "This keeps important work moving without placing study over school, training, meals, or protected sleep.",
      changes,
      status: "preview",
    };
  },
};

export const backendCanvaiService: Pick<CanvaiService, "proposeScheduleChange"> = {
  proposeScheduleChange: (command) =>
    apiClient.request<ScheduleProposal>("/canvai/proposals", {
      method: "POST",
      body: JSON.stringify({ command }),
    }),
};
