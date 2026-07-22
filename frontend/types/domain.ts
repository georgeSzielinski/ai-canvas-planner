export type ThemePreference = "light" | "dark" | "system";
export type Priority = "urgent" | "high" | "medium" | "low";
export type AssignmentType = "essay" | "homework" | "test" | "presentation" | "reading" | "project";
export type CompletionState = "open" | "completed";
export type SubmissionStatus = "not_started" | "in_progress" | "submitted" | "graded";

export interface Course {
  id: string;
  name: string;
  shortName: string;
  color: string;
}

export interface AssignmentAnalysis {
  difficulty: number;
  urgency: number;
  priorityScore: number;
  explanation: string;
  suggestedSteps: string[];
}

export interface StudySession {
  id: string;
  assignmentId: string;
  title: string;
  startAt: string;
  durationMinutes: number;
  status: "planned" | "completed" | "missed" | "rescheduled";
  source: "canvai" | "manual";
}

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  description: string;
  type: AssignmentType;
  dueAt: string;
  points: number;
  gradeWeight?: number;
  estimatedMinutes: number;
  actualMinutes?: number;
  priority: Priority;
  submissionStatus: SubmissionStatus;
  missing: boolean;
  completionState: CompletionState;
  scheduledSessionIds: string[];
  analysis: AssignmentAnalysis;
  canvasUrl: string;
}

export interface RoutineBlock {
  id: string;
  day: string;
  activity:
    | "School"
    | "Commute"
    | "Rowing"
    | "Lifting"
    | "Dinner"
    | "Sleep"
    | "Family"
    | "Appointment"
    | "Free time"
    | "Custom";
  startTime: string;
  endTime: string;
  color: string;
}

export interface ConnectionStatus {
  status: "demo" | "connected" | "not_connected" | "error";
  lastSync?: string;
  permissions: string[];
}

export interface CalendarConnection extends ConnectionStatus {
  provider: "google-calendar";
}

export interface CanvasConnection extends ConnectionStatus {
  provider: "canvas";
}

export interface CanvaiInsight {
  id: string;
  title: string;
  body: string;
  impact: string;
  tone: "accent" | "warning" | "success";
}

export interface ScheduleChange {
  id: string;
  kind: "move" | "add" | "remove" | "protect";
  label: string;
  before?: string;
  after?: string;
}

export interface ScheduleProposal {
  id: string;
  command: string;
  summary: string;
  reasoning: string;
  changes: ScheduleChange[];
  status: "preview" | "applied" | "dismissed";
}

export interface CanvaiRecommendation extends CanvaiInsight {
  command: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  timeLabel: string;
  kind: "new" | "changed" | "moved" | "missing" | "resolved" | "connection";
  read: boolean;
}

export interface StudyPreferences {
  earliestTime: string;
  latestTime: string;
  preferredSessionMinutes: number;
  maxSessionMinutes: number;
  breakMinutes: number;
  weekdayWorkloadMinutes: number;
  weekendWorkloadMinutes: number;
  minimumFreeMinutes: number;
  emergencyBufferMinutes: number;
  studyBeforeSchool: boolean;
  studyAtLunch: boolean;
  studyAfterRowing: boolean;
  fridayNight: "avoid" | "light" | "normal";
  saturdayNight: "avoid" | "light" | "normal";
  sundayNight: "avoid" | "light" | "normal";
}

export interface SleepPreferences {
  currentBedtime: string;
  targetBedtime: string;
  wakeTime: string;
  gradualAdjustment: boolean;
  protectSleep: boolean;
  preventLateStudy: boolean;
  athleteRecoveryMode: boolean;
  avoidIntenseAfterTraining: boolean;
}

export interface SubjectPreference {
  courseId: string;
  difficulty: number;
  confidence: number;
  importance: number;
  typicalMinutes: number;
  testDifficulty: number;
  extraTimeMultiplier: number;
}

export interface CalendarPreferences {
  studyCalendar: string;
  busyCalendars: string[];
  automaticPublishing: boolean;
  previewBeforePublishing: boolean;
  notifications: boolean;
  canvaiMayMoveOwnEvents: boolean;
  preserveManualEdits: boolean;
}

export interface AISettings {
  enabled: boolean;
  provider: string;
  analysisDepth: "concise" | "balanced" | "detailed";
  showReasoning: boolean;
  automaticDuration: boolean;
  automaticClassification: boolean;
  useCompletionHistory: boolean;
  askBeforeMajorChanges: boolean;
  estimateFeedback: boolean;
}

export interface UserProfile {
  id: string;
  displayName: string;
  timeZone: string;
  schoolYear: string;
  weekStart: "monday" | "sunday";
  theme: ThemePreference;
}

export interface AssignmentRules {
  testsExtraPriority: boolean;
  startEssaysEarly: boolean;
  splitLongAssignments: boolean;
  createProjectMilestones: boolean;
  missingOverrides: boolean;
  delayLowValueWhenOverloaded: boolean;
  allowSameCourseSessions: boolean;
  includePrepInstructions: boolean;
  rebuildMissedSchedules: boolean;
  keepSundayLight: boolean;
  protectDailyFreeTime: boolean;
}

export interface AppSettings {
  profile: UserProfile;
  study: StudyPreferences;
  sleep: SleepPreferences;
  subjects: SubjectPreference[];
  calendar: CalendarPreferences;
  ai: AISettings;
  rules: AssignmentRules;
}

export interface WeeklyWorkload {
  date: string;
  day: string;
  plannedMinutes: number;
  capacityMinutes: number;
  deadlinePressure: number;
  tests: number;
  writingHeavy: boolean;
}

export interface InsightMetric {
  id: string;
  label: string;
  value: string;
  change: string;
  explanation: string;
  adjustment: string;
}

export interface DemoBootstrap {
  referenceDate: string;
  courses: Course[];
  assignments: Assignment[];
  sessions: StudySession[];
  routine: RoutineBlock[];
  notifications: Notification[];
  workload: WeeklyWorkload[];
  settings: AppSettings;
  canvasConnection: CanvasConnection;
  calendarConnection: CalendarConnection;
}
