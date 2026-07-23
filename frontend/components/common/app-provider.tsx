"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useOptionalAuth } from "@/components/auth/auth-provider";
import {
  assignments as initialAssignments,
  courses as initialCourses,
  defaultSettings,
  insightMetrics as initialInsights,
  notifications as initialNotifications,
  routineBlocks as initialRoutine,
  studySessions as initialSessions,
  weeklyWorkload as initialWorkload,
} from "@/lib/demo-data";
import type {
  AppSettings,
  Assignment,
  Course,
  InsightMetric,
  Notification,
  RoutineBlock,
  ScheduleProposal,
  StudySession,
  ThemePreference,
  WeeklyWorkload,
} from "@/types/domain";
import type { CalendarConnection } from "@/types/calendar";
import type { CanvasConnectionStatus, CanvasSyncReport } from "@/types/canvas";
import { bootstrapService } from "@/services/bootstrap-service";
import { calendarService } from "@/services/calendar-service";
import { canvasService } from "@/services/canvas-service";
import { notificationsService } from "@/services/notifications-service";
import { dataMode, services } from "@/services";

const SETTINGS_KEY = "canvas-sweeper:settings";
const THEME_KEY = "canvas-sweeper:theme";

interface ToastState {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}
interface AppContextValue {
  backendMode: boolean;
  loading: boolean;
  calendarConnection: CalendarConnection | null;
  refreshCalendarConnection(): Promise<CalendarConnection>;
  canvasConnection: CanvasConnectionStatus | null;
  canvasSyncReport: CanvasSyncReport | null;
  canvasLoading: boolean;
  canvasError: string | null;
  refreshCanvasWorkspace(): Promise<boolean>;
  courses: Course[];
  assignments: Assignment[];
  sessions: StudySession[];
  routine: RoutineBlock[];
  workload: WeeklyWorkload[];
  insights: InsightMetric[];
  settings: AppSettings;
  notifications: Notification[];
  proposal: ScheduleProposal | null;
  appliedCommands: string[];
  toast: ToastState | null;
  theme: ThemePreference;
  setTheme(theme: ThemePreference): void;
  updateAssignment(id: string, patch: Partial<Assignment>): void;
  addAssignment(assignment: Assignment): void;
  addSession(assignmentId: string): void;
  removeSession(assignmentId: string, sessionId: string): void;
  updateSettings(settings: AppSettings): void;
  resetDemo(): void;
  dismissNotification(id: string): void;
  markAllNotificationsRead(): void;
  setProposal(proposal: ScheduleProposal | null): void;
  applyProposal(): void;
  showToast(message: string, actionLabel?: string, onAction?: () => void): void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const auth = useOptionalAuth();
  const scope =
    dataMode === "backend" ? `${auth?.status ?? "missing"}:${auth?.user?.id ?? ""}` : "local";
  return (
    <ScopedAppProvider key={scope} auth={auth}>
      {children}
    </ScopedAppProvider>
  );
}

function ScopedAppProvider({
  children,
  auth,
}: {
  children: ReactNode;
  auth: ReturnType<typeof useOptionalAuth>;
}) {
  const backendMode = dataMode === "backend";
  const [courses, setCourses] = useState(() =>
    backendMode ? [] : structuredClone(initialCourses),
  );
  const [assignments, setAssignments] = useState(() =>
    backendMode ? [] : structuredClone(initialAssignments),
  );
  const [sessions, setSessions] = useState(() =>
    backendMode ? [] : structuredClone(initialSessions),
  );
  const [routine, setRoutine] = useState(() =>
    backendMode ? [] : structuredClone(initialRoutine),
  );
  const [workload, setWorkload] = useState(() =>
    backendMode ? [] : structuredClone(initialWorkload),
  );
  const [insights, setInsights] = useState(() =>
    backendMode ? [] : structuredClone(initialInsights),
  );
  const [settings, setSettings] = useState(() => structuredClone(defaultSettings));
  const [notifications, setNotifications] = useState(() =>
    backendMode ? [] : structuredClone(initialNotifications),
  );
  const [calendarConnection, setCalendarConnection] = useState<CalendarConnection | null>(null);
  const [canvasConnection, setCanvasConnection] = useState<CanvasConnectionStatus | null>(null);
  const [canvasSyncReport, setCanvasSyncReport] = useState<CanvasSyncReport | null>(null);
  const [canvasLoading, setCanvasLoading] = useState(false);
  const [canvasError, setCanvasError] = useState<string | null>(null);
  const [loading, setLoading] = useState(backendMode);
  const [proposal, setProposal] = useState<ScheduleProposal | null>(null);
  const [appliedCommands, setAppliedCommands] = useState<string[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [theme, setThemeState] = useState<ThemePreference>("light");
  const canvasRequestGeneration = useRef(0);

  useEffect(() => {
    if (backendMode) return;
    let cancelled = false;
    try {
      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      const savedTheme = localStorage.getItem(THEME_KEY) as ThemePreference | null;
      queueMicrotask(() => {
        if (cancelled) return;
        if (savedSettings) setSettings(JSON.parse(savedSettings) as AppSettings);
        if (savedTheme) setThemeState(savedTheme);
      });
    } catch {
      /* defaults remain safe when storage is unavailable */
    }
    return () => {
      cancelled = true;
    };
  }, [backendMode]);

  useEffect(() => {
    const resolved =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const showToast = useCallback((message: string, actionLabel?: string, onAction?: () => void) => {
    const id = Date.now();
    setToast({ id, message, actionLabel, onAction });
    window.setTimeout(() => setToast((current) => (current?.id === id ? null : current)), 4200);
  }, []);
  const refreshCalendarConnection = useCallback(async () => {
    const connection = await calendarService.getStatus();
    setCalendarConnection(connection);
    return connection;
  }, []);
  const refreshCanvasWorkspace = useCallback(async () => {
    if (!backendMode) return false;
    const generation = canvasRequestGeneration.current + 1;
    canvasRequestGeneration.current = generation;
    setCanvasLoading(true);
    setCanvasError(null);
    try {
      const connection = await canvasService.getStatus();
      const includeConcluded = connection.include_concluded_courses;
      const [canvasCourses, firstAssignmentPage, latest] = await Promise.all([
        canvasService.getCourses(includeConcluded),
        canvasService.getAssignments({
          include_concluded: includeConcluded,
          page: 1,
          page_size: 100,
        }),
        canvasService.getLatestSync().catch(() => null),
      ]);
      const canvasAssignments = [...firstAssignmentPage.assignments];
      const pageCount = Math.ceil(firstAssignmentPage.total / firstAssignmentPage.pageSize);
      for (let page = 2; page <= pageCount; page += 1) {
        const nextPage = await canvasService.getAssignments({
          include_concluded: includeConcluded,
          page,
          page_size: firstAssignmentPage.pageSize,
        });
        canvasAssignments.push(...nextPage.assignments);
      }
      if (canvasRequestGeneration.current !== generation) return false;
      setCanvasConnection(connection);
      setCanvasSyncReport(latest);
      setCourses(canvasCourses);
      setAssignments(canvasAssignments);
      setSessions([]);
      return true;
    } catch (cause) {
      if (canvasRequestGeneration.current !== generation) return false;
      setCanvasError(
        "Canvas data could not be refreshed. Previously loaded data was preserved; retry shortly.",
      );
      throw cause;
    } finally {
      if (canvasRequestGeneration.current === generation) setCanvasLoading(false);
    }
  }, [backendMode]);

  useEffect(() => {
    if (!backendMode || auth?.status === "loading") return;
    if (auth?.status !== "authenticated") {
      const timer = window.setTimeout(() => {
        setCourses([]);
        setAssignments([]);
        setSessions([]);
        setRoutine([]);
        setWorkload([]);
        setInsights([]);
        setNotifications([]);
        setCalendarConnection(null);
        setCanvasConnection(null);
        setCanvasSyncReport(null);
        setCanvasError(null);
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });
    void (async () => {
      try {
        const bootstrap = await bootstrapService.get();
        if (cancelled) return;
        setCourses(bootstrap.courses);
        setAssignments(bootstrap.assignments);
        setSessions(bootstrap.sessions);
        setRoutine(bootstrap.routine);
        setWorkload(bootstrap.workload);
        setSettings(bootstrap.settings);
        setNotifications(bootstrap.notifications);
        setThemeState(bootstrap.settings.profile.theme);
        try {
          await refreshCanvasWorkspace();
        } catch {
          if (!cancelled) {
            showToast("Canvas could not be refreshed. Previously loaded data was preserved.");
          }
        }
      } catch {
        if (!cancelled) showToast("Could not load your workspace. Please retry.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    void calendarService
      .getStatus()
      .then((connection) => {
        if (!cancelled) setCalendarConnection(connection);
      })
      .catch(() => {
        if (!cancelled) setCalendarConnection(null);
      });

    void services.insights
      .get()
      .then((loadedInsights) => {
        if (!cancelled) setInsights(loadedInsights);
      })
      .catch(() => {
        if (!cancelled) setInsights([]);
      });
    return () => {
      cancelled = true;
      canvasRequestGeneration.current += 1;
    };
  }, [auth?.status, auth?.user?.id, backendMode, refreshCanvasWorkspace, showToast]);

  const setTheme = (value: ThemePreference) => {
    setThemeState(value);
    setSettings((current) => {
      const next = { ...current, profile: { ...current.profile, theme: value } };
      if (backendMode) {
        void services.settings
          .update(next)
          .then(setSettings)
          .catch(() => showToast("Could not save the theme preference."));
      }
      return next;
    });
  };
  const updateAssignment = (id: string, patch: Partial<Assignment>) => {
    if (!backendMode) {
      setAssignments((items) =>
        items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
      return;
    }
    void services.assignments
      .update(id, patch)
      .then((updated) =>
        setAssignments((items) => items.map((item) => (item.id === id ? updated : item))),
      )
      .catch(() => showToast("Could not save the assignment change."));
  };
  const addAssignment = (assignment: Assignment) => {
    if (backendMode) {
      showToast("Manual assignments are available in demo mode only.");
      return;
    }
    setAssignments((items) => [assignment, ...items]);
    showToast("Manual assignment added");
  };
  const addSession = (assignmentId: string) => {
    if (backendMode) {
      showToast("Scheduling changes are not part of Phase 2.");
      return;
    }
    const assignment = assignments.find((item) => item.id === assignmentId);
    if (!assignment) return;
    const id = `session-manual-${assignmentId}-${assignment.scheduledSessionIds.length + 1}`;
    const session: StudySession = {
      id,
      assignmentId,
      title: `${assignment.title} — study block`,
      startAt: new Date("2026-09-17T20:00:00-07:00").toISOString(),
      durationMinutes: Math.min(assignment.estimatedMinutes, 45),
      status: "planned",
      source: "manual",
    };
    setSessions((items) => [...items, session]);
    setAssignments((items) =>
      items.map((item) =>
        item.id === assignmentId
          ? { ...item, scheduledSessionIds: [...item.scheduledSessionIds, id] }
          : item,
      ),
    );
    showToast("Study block added to the demo plan");
  };
  const removeSession = (assignmentId: string, sessionId: string) => {
    if (backendMode) {
      showToast("Scheduling changes are not part of Phase 2.");
      return;
    }
    setSessions((items) => items.filter((item) => item.id !== sessionId));
    setAssignments((items) =>
      items.map((item) =>
        item.id === assignmentId
          ? {
              ...item,
              scheduledSessionIds: item.scheduledSessionIds.filter((id) => id !== sessionId),
            }
          : item,
      ),
    );
    showToast("Planned session removed");
  };
  const updateSettings = (value: AppSettings) => {
    setSettings(value);
    if (!backendMode) localStorage.setItem(SETTINGS_KEY, JSON.stringify(value));
    setThemeState(value.profile.theme);
    if (!backendMode) {
      showToast("Settings saved locally");
      return;
    }
    void services.settings
      .update(value)
      .then((saved) => {
        setSettings(saved);
        showToast("Settings saved");
      })
      .catch(() => showToast("Could not save settings."));
  };
  const resetDemo = () => {
    if (backendMode) {
      showToast("Demo reset is unavailable for authenticated data.");
      return;
    }
    setAssignments(structuredClone(initialAssignments));
    setSessions(structuredClone(initialSessions));
    setRoutine(structuredClone(initialRoutine));
    setWorkload(structuredClone(initialWorkload));
    setInsights(structuredClone(initialInsights));
    setSettings(structuredClone(defaultSettings));
    setNotifications(structuredClone(initialNotifications));
    setProposal(null);
    setAppliedCommands([]);
    setThemeState(defaultSettings.profile.theme);
    localStorage.removeItem(SETTINGS_KEY);
    showToast("Demo defaults restored");
  };
  const dismissNotification = (id: string) => {
    setNotifications((items) => items.filter((item) => item.id !== id));
    if (backendMode) {
      void notificationsService
        .dismiss(id)
        .catch(() => showToast("Could not dismiss the notification."));
    }
  };
  const markAllNotificationsRead = () => {
    setNotifications((items) => items.map((item) => ({ ...item, read: true })));
    if (backendMode) {
      void notificationsService
        .markAllRead()
        .then(() => showToast("All notifications marked read"))
        .catch(() => showToast("Could not update notifications."));
    } else {
      showToast("All notifications marked read");
    }
  };
  const applyProposal = () => {
    if (!proposal) return;
    const command = proposal.command;
    setAppliedCommands((items) => [...items, command]);
    setProposal({ ...proposal, status: "applied" });
    showToast("Canvai plan applied", "Undo", () => {
      setAppliedCommands((items) => items.filter((item) => item !== command));
      setProposal({ ...proposal, status: "preview" });
      showToast("Plan restored");
    });
  };

  const value: AppContextValue = {
    backendMode,
    loading,
    calendarConnection,
    refreshCalendarConnection,
    canvasConnection,
    canvasSyncReport,
    canvasLoading,
    canvasError,
    refreshCanvasWorkspace,
    courses,
    assignments,
    sessions,
    routine,
    workload,
    insights,
    settings,
    notifications,
    proposal,
    appliedCommands,
    toast,
    theme,
    setTheme,
    updateAssignment,
    addAssignment,
    addSession,
    removeSession,
    updateSettings,
    resetDemo,
    dismissNotification,
    markAllNotificationsRead,
    setProposal,
    applyProposal,
    showToast,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}
