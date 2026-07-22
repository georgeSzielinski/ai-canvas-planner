import type {
  AppSettings,
  Assignment,
  Course,
  Notification,
  RoutineBlock,
  StudySession,
  WeeklyWorkload,
} from "@/types/domain";
import { apiClient } from "./api-client";
import { assignmentFromWire, type AssignmentWire } from "./assignments-service";
import { settingsFromWire } from "./settings-service";

interface StudySessionWire {
  id: string;
  assignment_id: string;
  title: string;
  start_at: string;
  duration_minutes: number;
  status: StudySession["status"];
  source: StudySession["source"];
}

export interface NotificationWire {
  id: string;
  title: string;
  body: string;
  time_label: string;
  kind: Notification["kind"];
  read: boolean;
}

interface BootstrapWire {
  courses: Array<{ id: string; name: string; short_name: string; color: string }>;
  assignments: AssignmentWire[];
  sessions: StudySessionWire[];
  routine: Array<{
    id: string;
    day: string;
    activity: RoutineBlock["activity"];
    start_time: string;
    end_time: string;
    color: string;
  }>;
  notifications: NotificationWire[];
  workload: Array<{
    date: string;
    day: string;
    planned_minutes: number;
    capacity_minutes: number;
    deadline_pressure: number;
    tests: number;
    writing_heavy: boolean;
  }>;
  settings: unknown;
}

export interface BootstrapData {
  courses: Course[];
  assignments: Assignment[];
  sessions: StudySession[];
  routine: RoutineBlock[];
  notifications: Notification[];
  workload: WeeklyWorkload[];
  settings: AppSettings;
}

export function sessionFromWire(item: StudySessionWire): StudySession {
  return {
    id: item.id,
    assignmentId: item.assignment_id,
    title: item.title,
    startAt: item.start_at,
    durationMinutes: item.duration_minutes,
    status: item.status,
    source: item.source,
  };
}

export function notificationFromWire(item: NotificationWire): Notification {
  return {
    id: item.id,
    title: item.title,
    body: item.body,
    timeLabel: item.time_label,
    kind: item.kind,
    read: item.read,
  };
}

export const bootstrapService = {
  async get(): Promise<BootstrapData> {
    const payload = await apiClient.request<BootstrapWire>("/demo/bootstrap");
    return {
      courses: payload.courses.map((course) => ({
        id: course.id,
        name: course.name,
        shortName: course.short_name,
        color: course.color,
      })),
      assignments: payload.assignments.map(assignmentFromWire),
      sessions: payload.sessions.map(sessionFromWire),
      routine: payload.routine.map((item) => ({
        id: item.id,
        day: item.day,
        activity: item.activity,
        startTime: item.start_time,
        endTime: item.end_time,
        color: item.color,
      })),
      notifications: payload.notifications.map(notificationFromWire),
      workload: payload.workload.map((item) => ({
        date: item.date,
        day: item.day,
        plannedMinutes: item.planned_minutes,
        capacityMinutes: item.capacity_minutes,
        deadlinePressure: item.deadline_pressure,
        tests: item.tests,
        writingHeavy: item.writing_heavy,
      })),
      settings: settingsFromWire<AppSettings>(payload.settings),
    };
  },
};
