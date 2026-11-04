import { useEffect, useRef, useState } from "react";
import api from "./api";
import Sidebar from "./Sidebar";
import { logout } from "./auth";

/* ================= HELPERS ================= */

const formatHMS = (seconds = 0) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const getLiveSeconds = (task) => {
  const baseSeconds =
    task.total_time_taken ??
    task.total_seconds ??
    task.time_spent ??
    task.task?.total_seconds ??
    0;

  if (!task.is_running) return baseSeconds;
  if (!task.last_started_at) return baseSeconds;

  const elapsed = Math.floor(
    (Date.now() - new Date(task.last_started_at).getTime()) / 1000
  );
  return baseSeconds + (elapsed > 0 ? elapsed : 0);
};

const todayDate = () => new Date().toISOString().slice(0, 10);

/* ================= SESSION & WORKED TODAY HELPERS ================= */

const getTodayDateStringIST = (d = new Date()) => {
  const dt = typeof d === "string" ? new Date(d) : d;
  if (!dt || isNaN(dt.getTime())) return "";
  const istDate = new Date(
    dt.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  // Office hours 10 AM to 7 PM: new day starts at 9:00 AM IST
  istDate.setHours(istDate.getHours() - 9);
  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, "0");
  const day = String(istDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getSessionDateIST = (isoString) => {
  if (!isoString) return "";
  return getTodayDateStringIST(isoString);
};

const isSessionFromToday = (session, todayDateStr) => {
  const startStr =
    session.started_at ||
    session.start ||
    session.start_time ||
    session.startTime;
  const stopStr =
    session.stopped_at ||
    session.end ||
    session.ended_at ||
    session.end_time ||
    session.endTime;

  if (!startStr && !stopStr) return false;

  const startDateIST = getSessionDateIST(startStr);
  const stopDateIST = getSessionDateIST(stopStr);

  return startDateIST === todayDateStr || stopDateIST === todayDateStr;
};

const getSessionDurationSeconds = (session) => {
  if (!session) return 0;

  const explicitSec =
    session.duration_seconds ??
    session.duration ??
    session.seconds ??
    session.total_seconds;
  if (typeof explicitSec === "number" && explicitSec > 0) {
    return explicitSec;
  }

  const startStr =
    session.started_at ||
    session.start ||
    session.start_time ||
    session.startTime;
  const stopStr =
    session.stopped_at ||
    session.end ||
    session.ended_at ||
    session.end_time ||
    session.endTime;

  if (startStr && stopStr) {
    const diff = Math.floor(
      (new Date(stopStr).getTime() - new Date(startStr).getTime()) / 1000
    );
    return Math.max(0, diff);
  }

  return 0;
};

const getTaskTodaySeconds = (task) => {
  if (!task) return 0;

  const todayDateStr = getTodayDateStringIST();

  const sessions = Array.isArray(task.work_sessions)
    ? task.work_sessions
    : Array.isArray(task.task?.work_sessions)
    ? task.task.work_sessions
    : [];

  const todaySessions = sessions.filter((s) =>
    isSessionFromToday(s, todayDateStr)
  );
  const completedTodaySec = todaySessions.reduce(
    (sum, s) => sum + getSessionDurationSeconds(s),
    0
  );

  let liveSec = 0;
  if (task.is_running && task.last_started_at) {
    const elapsed = Math.floor(
      (Date.now() - new Date(task.last_started_at).getTime()) / 1000
    );
    liveSec = Math.max(0, elapsed);
  }

  return completedTodaySec + liveSec;
};

const calculateTodayWorkedSeconds = (logsByTab, runningTask) => {
  const todayDateStr = getTodayDateStringIST();

  // Deduplicate all tasks across all tabs
  const taskMap = new Map();
  Object.values(logsByTab || {}).forEach((tabList) => {
    (tabList || []).forEach((t) => {
      const key = t.id || t.task_id || t.title;
      if (key && !taskMap.has(key)) {
        taskMap.set(key, t);
      }
    });
  });

  let completedTodaySeconds = 0;

  taskMap.forEach((task) => {
    const sessions = Array.isArray(task.work_sessions)
      ? task.work_sessions
      : Array.isArray(task.task?.work_sessions)
      ? task.task.work_sessions
      : [];

    if (sessions.length > 0) {
      // Strictly sum ONLY today's sessions!
      const todaySessions = sessions.filter((s) =>
        isSessionFromToday(s, todayDateStr)
      );
      const taskTodaySum = todaySessions.reduce(
        (sum, s) => sum + getSessionDurationSeconds(s),
        0
      );
      completedTodaySeconds += taskTodaySum;
    }
  });

  // Calculate live running time (if a task is currently active)
  let liveRunningSeconds = 0;
  if (runningTask && runningTask.is_running && runningTask.last_started_at) {
    const elapsed = Math.floor(
      (Date.now() - new Date(runningTask.last_started_at).getTime()) / 1000
    );
    liveRunningSeconds = Math.max(0, elapsed);
  }

  return completedTodaySeconds + liveRunningSeconds;
};

const isLunchBreak = () => {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const hour = now.getHours();
  // lunch break: 2 PM – 3 PM (14:00 - 15:00 IST)
  return hour >= 14 && hour < 15;
};

const normalizeWorkLogItem = (item) => {
  const taskObj = item.task || {};
  const taskItem = item.task_item || {};
  const isRunning = Boolean(taskObj.is_running ?? item.is_running);
  const totalSeconds = Number(
    item.total_time_taken ?? taskObj.total_seconds ?? taskObj.time_spent ?? 0
  );
  const workSessions = Array.isArray(taskObj.work_sessions)
    ? taskObj.work_sessions
    : Array.isArray(item.work_sessions)
    ? item.work_sessions
    : Array.isArray(taskItem.work_sessions)
    ? taskItem.work_sessions
    : [];

  const rawStatus = (
    taskItem.status ||
    item.status ||
    taskObj.status ||
    ""
  ).toLowerCase();

  let status = rawStatus;
  if (!status) {
    if (isRunning || totalSeconds > 0 || workSessions.length > 0) {
      status = "in-progress";
    } else {
      status = "planned";
    }
  }

  return {
    ...item,
    id: item.id,
    work_log_id: item.id,
    task_id: taskItem.id || taskObj.id || taskObj.task_id || item.id,
    task_item: taskItem,
    title:
      taskObj.title ||
      taskObj.task_title ||
      item.task_title ||
      "Untitled Task",
    description: taskObj.description || "",
    is_running: isRunning,
    total_time_taken: totalSeconds,
    total_seconds: totalSeconds,
    time_spent: totalSeconds,
    work_sessions: workSessions,
    last_started_at: isRunning
      ? taskObj.last_started_at || item.last_started_at
      : null,
    status,
    user: item.user,
    has_attendance: item.has_attendance,
    out: item.out,
    is_checked_in: item.is_checked_in,
    task: {
      ...taskObj,
      title:
        taskObj.title ||
        taskObj.task_title ||
        item.task_title ||
        "Untitled Task",
      is_running: isRunning,
      total_time_taken: totalSeconds,
      total_seconds: totalSeconds,
      work_sessions: workSessions,
      last_started_at: isRunning
        ? taskObj.last_started_at || item.last_started_at
        : null,
      status,
    },
  };
};

/* ===== USER CACHE ===== */
const USER_CACHE_KEY = "attendance_user";

const saveUserToCache = (user) => {
  if (!user) return;

  localStorage.setItem(
    USER_CACHE_KEY,
    JSON.stringify({
      name: user.name || user.user_detial?.name || user.username || "",
      username: user.username || user.name || "",
      photo: user.photo || user.user_detial?.Photo?.[0]?.url || "",
    })
  );
};

const getUserFromCache = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_CACHE_KEY));
  } catch {
    return null;
  }
};

/* ================= COMPONENT ================= */

export default function AttendanceApp({ onLogout }) {
  const [logsByTab, setLogsByTab] = useState({});
  const [activeTab, setActiveTab] = useState("in-progress");
  const [runningTaskState, setRunningTaskState] = useState(null);
  const [, forceTick] = useState(0);
  const [cachedUser, setCachedUser] = useState(() => getUserFromCache());
  const [attendanceState, setAttendanceState] = useState(() => ({
    hasCheckedIn: true,
    hasAttendance: true,
    isCheckedIn: true,
    isCheckedOut: false,
    isAttendancePaused: false,
    inTime: null,
    outTime: null,
  }));
  const lastRunningTaskRef = useRef(null);
  const pendingRunningTaskRef = useRef(null);
  const runningTaskRef = useRef(null);
  const workLogsRef = useRef([]);
  const isResumingRef = useRef(false);
  const isForceStoppingRef = useRef(false);

  const workLogs = logsByTab[activeTab] || [];
  const loadingTasks = !logsByTab[activeTab];

  const setWorkLogs = (updater) => {
    setLogsByTab((prev) => {
      const currentList = prev[activeTab] || [];
      const updatedList =
        typeof updater === "function" ? updater(currentList) : updater;
      return {
        ...prev,
        [activeTab]: updatedList,
      };
    });
  };

  /* ===== LIVE TIMER TICK ===== */
  useEffect(() => {
    const i = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  const syncMetaFromLogs = (normalizedLogs) => {
    if (!normalizedLogs || normalizedLogs.length === 0) return;

    const firstUser = normalizedLogs.find((l) => l.user)?.user;
    if (firstUser) {
      saveUserToCache(firstUser);
      setCachedUser(getUserFromCache());
    }

    const logWithAtt =
      normalizedLogs.find(
        (l) =>
          l.has_attendance !== undefined ||
          l.is_checked_in !== undefined ||
          l.out !== undefined
      ) || normalizedLogs[0];

    if (logWithAtt) {
      setAttendanceState({
        hasCheckedIn: Boolean(logWithAtt.has_attendance ?? true),
        hasAttendance: Boolean(logWithAtt.has_attendance ?? true),
        isCheckedIn: Boolean(logWithAtt.is_checked_in ?? true),
        isCheckedOut: Boolean(logWithAtt.out),
        isAttendancePaused: Boolean(
          (logWithAtt.has_attendance ?? true) &&
            !logWithAtt.out &&
            logWithAtt.is_checked_in === false
        ),
        inTime: logWithAtt.createdAt,
        outTime: logWithAtt.out,
      });
    }
  };

  /* ===== LOAD TASKS FOR CURRENT TAB ===== */
  useEffect(() => {
    let isCancelled = false;

    const loadTabLogs = async () => {
      try {
        const res = await api.get("/work-logs/today", {
          params: { status: activeTab },
        });

        if (isCancelled) return;

        const raw = Array.isArray(res.data?.work_log)
          ? res.data.work_log
          : res.data?.work_log
          ? [res.data.work_log]
          : [];

        const normalizedLogs = raw.map(normalizeWorkLogItem);

        syncMetaFromLogs(normalizedLogs);

        // If a task start/stop action is pending, guard optimistic running state
        if (pendingRunningTaskRef.current) {
          if (pendingRunningTaskRef.current === "STOPPED") {
            setLogsByTab((prev) => ({
              ...prev,
              [activeTab]: normalizedLogs.map((t) => ({
                ...t,
                is_running: false,
              })),
            }));
          } else {
            const targetId = pendingRunningTaskRef.current;
            setLogsByTab((prev) => ({
              ...prev,
              [activeTab]: normalizedLogs.map((t) => ({
                ...t,
                is_running: t.id === targetId || t.task_id === targetId,
              })),
            }));
          }
          return;
        }

        setLogsByTab((prev) => ({
          ...prev,
          [activeTab]: normalizedLogs,
        }));

        if (activeTab === "in-progress") {
          const running = normalizedLogs.find((t) => t.is_running);
          if (running && !isLunchBreak()) {
            setRunningTaskState(running);
            window.electronAPI?.setTaskRunning(true);
          } else {
            setRunningTaskState(null);
            window.electronAPI?.setTaskRunning(false);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error(`Failed to load ${activeTab} worklog`, err);
          setLogsByTab((prev) => ({
            ...prev,
            [activeTab]: prev[activeTab] || [],
          }));
        }
      }
    };

    loadTabLogs();

    return () => {
      isCancelled = true;
    };
  }, [activeTab]);

  /* ===== PREFETCH OTHER TABS ON MOUNT ===== */
  useEffect(() => {
    const prefetchOtherTabs = async () => {
      const otherTabs = ["planned", "completed", "blocked"];
      for (const tab of otherTabs) {
        try {
          const res = await api.get("/work-logs/today", {
            params: { status: tab },
          });
          const raw = Array.isArray(res.data?.work_log)
            ? res.data.work_log
            : res.data?.work_log
            ? [res.data.work_log]
            : [];
          const normalized = raw.map(normalizeWorkLogItem);
          setLogsByTab((prev) => {
            if (prev[tab]) return prev;
            return {
              ...prev,
              [tab]: normalized,
            };
          });
        } catch (e) {
          // prefetch is best-effort
        }
      }
    };

    prefetchOtherTabs();
  }, []);

  /* ===== SYNC FROM BACKEND (10s) ===== */
  useEffect(() => {
    const interval = setInterval(async () => {
      // Don't run background sync while user is actively switching/stopping a task
      if (pendingRunningTaskRef.current) return;

      try {
        const res = await api.get("/work-logs/today", {
          params: { status: activeTab },
        });

        // Re-check after async fetch
        if (pendingRunningTaskRef.current) return;

        const raw = Array.isArray(res.data?.work_log)
          ? res.data.work_log
          : res.data?.work_log
          ? [res.data.work_log]
          : [];

        const normalized = raw.map(normalizeWorkLogItem);
        syncMetaFromLogs(normalized);

        if (activeTab === "in-progress") {
          const running = normalized.find((t) => t.is_running);
          if (running && !isLunchBreak()) {
            setRunningTaskState(running);
            window.electronAPI?.setTaskRunning(true);
          } else {
            setRunningTaskState(null);
            window.electronAPI?.setTaskRunning(false);
          }
        } else if (isLunchBreak()) {
          setRunningTaskState(null);
          window.electronAPI?.setTaskRunning(false);
        }

        setLogsByTab((prev) => {
          const currentLogs = prev[activeTab];
          if (!currentLogs) return { ...prev, [activeTab]: normalized };

          const prevSummary = JSON.stringify(
            currentLogs.map((t) => ({
              id: t.id,
              running: t.is_running,
              time: t.total_seconds,
              last_started_at: t.last_started_at,
              is_checked_in: t.is_checked_in,
              out: t.out,
            }))
          );
          const nextSummary = JSON.stringify(
            normalized.map((t) => ({
              id: t.id,
              running: t.is_running,
              time: t.total_seconds,
              last_started_at: t.last_started_at,
              is_checked_in: t.is_checked_in,
              out: t.out,
            }))
          );

          if (prevSummary === nextSummary) return prev;
          return { ...prev, [activeTab]: normalized };
        });
      } catch (err) {
        console.error("🔴 Worklog sync failed", err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [activeTab]);

  const firstLog = workLogs?.[0];
  const isCheckedIn = attendanceState.hasCheckedIn;
  const isCheckedOut = attendanceState.isCheckedOut;
  const isAttendancePaused = attendanceState.isAttendancePaused;

  /* ===== RUNNING TASK & VISIBLE TASKS ===== */
  const runningTask = runningTaskState;
  const runningSeconds = runningTask ? getTaskTodaySeconds(runningTask) : 0;
  runningTaskRef.current = runningTask;
  workLogsRef.current = workLogs;

  const visibleTasks = (workLogs || [])
    .filter((t) => {
      const s = (
        t.task_item?.status ||
        t.status ||
        t.task?.status ||
        ""
      ).toLowerCase();

      if (!s) return true;

      if (activeTab === "in-progress") {
        if (s === "in-progress") return true;
        if (s === "planned" || s === "completed" || s === "blocked") return false;
        return t.is_running || t.total_seconds > 0;
      }
      if (activeTab === "planned") {
        if (s === "planned") return true;
        if (s === "in-progress" || s === "completed" || s === "blocked") return false;
        return true;
      }
      if (activeTab === "completed") return s === "completed";
      if (activeTab === "blocked") return s === "blocked";
      return s === activeTab;
    })
    .map((t) => {
      const isThisRunning = Boolean(
        runningTask &&
        (t.id === runningTask.id || t.task_id === runningTask.id)
      );

      if (isThisRunning) {
        return {
          ...t,
          is_running: true,
          last_started_at: runningTask.last_started_at,
          task: {
            ...t.task,
            is_running: true,
            last_started_at: runningTask.last_started_at,
          },
        };
      }

      if (t.is_running) {
        return {
          ...t,
          is_running: false,
          last_started_at: null,
          task: {
            ...t.task,
            is_running: false,
            last_started_at: null,
          },
        };
      }

      return t;
    });

  /* ===== WORKED TODAY (LIVE TIME + COMPLETED SESSIONS OF TODAY) ===== */
  const calculatedTodaySeconds = calculateTodayWorkedSeconds(
    logsByTab,
    runningTask
  );

  const todayKey = `worked_today_${getTodayDateStringIST()}`;

  // Store clean calculation in localStorage
  useEffect(() => {
    if (calculatedTodaySeconds > 0) {
      localStorage.setItem(todayKey, String(calculatedTodaySeconds));
    } else {
      localStorage.removeItem(todayKey);
    }
  }, [calculatedTodaySeconds, todayKey]);

  const totalTodaySeconds = calculatedTodaySeconds;

  /* ===== SEND WORKLOG ID TO ELECTRON ===== */
  useEffect(() => {
    const activeId = runningTask?.id || firstLog?.id;
    if (activeId) {
      console.log("📤 Sending workLogId to Electron:", activeId);
      window.electronAPI?.setWorkLogId(activeId);
    }
  }, [runningTask?.id, firstLog?.id]);

  /* ===== SYNC RUNNING TASK WITH ELECTRON ===== */
  useEffect(() => {
    if (!window.electronAPI?.setTaskRunning) return;
    const isRunning = Boolean(runningTask);
    console.log("📤 Sending TASK_RUNNING to Electron:", isRunning);
    window.electronAPI.setTaskRunning(isRunning);
  }, [runningTask]);

  /* ===== FORCE STOP TASKS FROM ELECTRON ===== */
  useEffect(() => {
    if (!window.electronAPI?.onForceStopTasks) return;

    const handleForceStop = async () => {
      if (isForceStoppingRef.current) {
        console.log("⚠️ Force stop already in progress, skipping duplicate call");
        return;
      }
      isForceStoppingRef.current = true;
      console.log("🛑 Electron requested FORCE STOP");
      const currentRunning = runningTaskRef.current;

      pendingRunningTaskRef.current = "STOPPED";
      setRunningTaskState(null);
      setWorkLogs((prev) =>
        (prev || []).map((t) =>
          t.is_running
            ? {
                ...t,
                is_running: false,
                total_seconds: getLiveSeconds(t),
                time_spent: getLiveSeconds(t),
                last_started_at: null,
                task: {
                  ...t.task,
                  is_running: false,
                  total_seconds: getLiveSeconds(t),
                  last_started_at: null,
                },
              }
            : t
        )
      );

      try {
        if (currentRunning?.id) {
          await api.post("/work-logs/stop-timer", {
            workLogId: currentRunning.id,
          });
        }
      } catch (err) {
        console.error("❌ Backend stop failed (force-stop)", err);
      } finally {
        pendingRunningTaskRef.current = null;
        isForceStoppingRef.current = false;
      }

      window.electronAPI?.setTaskRunning(false);
    };

    window.electronAPI.onForceStopTasks(handleForceStop);

    return () => {
      window.electronAPI.removeForceStopTasks?.();
    };
  }, []);

  /* ===== RESUME TASKS FROM ELECTRON ===== */
  useEffect(() => {
    if (!window.electronAPI?.onResumeTasks) return;

    const handleResume = async () => {
      if (isResumingRef.current) {
        console.log("⚠️ Resume already in progress, skipping duplicate call");
        return;
      }
      isResumingRef.current = true;
      console.log("▶️ Electron requested RESUME TASK");

      const targetId = lastRunningTaskRef.current;
      const currentLogs = workLogsRef.current || [];
      if (!targetId || currentLogs.length === 0) {
        isResumingRef.current = false;
        return;
      }

      const task = currentLogs.find(
        (t) => t.id === targetId || t.task_id === targetId
      );

      const now = new Date().toISOString();

      if (task) {
        pendingRunningTaskRef.current = task.id;
        const runningObj = {
          ...task,
          is_running: true,
          status: "in-progress",
          last_started_at: now,
          task: {
            ...task.task,
            is_running: true,
            last_started_at: now,
          },
        };
        setRunningTaskState(runningObj);
        setWorkLogs((prev) =>
          (prev || []).map((t) => (t.id === task.id ? runningObj : t))
        );
      }

      try {
        await api.post("/work-logs/start-timer", {
          workLogId: targetId,
        });

        const res = await api.get("/work-logs/today", {
          params: { status: "in-progress" },
        });
        const raw = Array.isArray(res.data?.work_log)
          ? res.data.work_log
          : res.data?.work_log
          ? [res.data.work_log]
          : [];
        const normalized = raw.map(normalizeWorkLogItem);

        if (pendingRunningTaskRef.current === targetId) {
          const fresh = normalized.find(
            (t) => t.id === targetId || t.task_id === targetId
          );
          if (fresh) {
            setRunningTaskState({
              ...fresh,
              is_running: true,
              last_started_at: fresh.last_started_at || now,
            });
          }
          setLogsByTab((prev) => ({
            ...prev,
            "in-progress": normalized.map((t) => ({
              ...t,
              is_running: t.id === targetId || t.task_id === targetId,
            })),
          }));
          syncMetaFromLogs(normalized);
        }
      } catch (err) {
        console.error("❌ Resume failed", err);
      } finally {
        if (pendingRunningTaskRef.current === targetId) {
          pendingRunningTaskRef.current = null;
        }
        isResumingRef.current = false;
      }

      window.electronAPI?.setTaskRunning(true);
    };

    window.electronAPI.onResumeTasks(handleResume);

    return () => {
      window.electronAPI.removeResumeTasks?.();
    };
  }, []);

  useEffect(() => {
    if (runningTask) {
      lastRunningTaskRef.current = runningTask.id;
      console.log("💾 Saved last running task:", runningTask.id);
    }
  }, [runningTask]);

  /* ===== LUNCH BREAK TASK STOP (FRONTEND ONLY - BACKEND HANDLED BY CRON) ===== */
  useEffect(() => {
    const handleLunchBreak = async () => {
      if (!isLunchBreak()) return;

      if (runningTask) {
        console.log(
          "🥪 Lunch break active: stopping timer in frontend (backend stopped via cron)"
        );
        pendingRunningTaskRef.current = "STOPPED";
        setRunningTaskState(null);
        window.electronAPI?.setTaskRunning(false);

        // Mark running tasks as stopped across all cached tabs
        setLogsByTab((prev) => {
          const updated = {};
          Object.keys(prev).forEach((tab) => {
            updated[tab] = (prev[tab] || []).map((t) =>
              t.is_running
                ? {
                    ...t,
                    is_running: false,
                    last_started_at: null,
                    total_seconds: getLiveSeconds(t),
                    task: {
                      ...t.task,
                      is_running: false,
                      last_started_at: null,
                      total_seconds: getLiveSeconds(t),
                    },
                  }
                : t
            );
          });
          return updated;
        });

        // Silently sync fresh work logs from backend (already stopped by cron)
        try {
          const res = await api.get("/work-logs/today", {
            params: { status: activeTab },
          });
          const raw = Array.isArray(res.data?.work_log)
            ? res.data.work_log
            : res.data?.work_log
            ? [res.data.work_log]
            : [];
          const normalized = raw.map(normalizeWorkLogItem);
          setLogsByTab((prev) => ({
            ...prev,
            [activeTab]: normalized,
          }));
          syncMetaFromLogs(normalized);
        } catch (err) {
          console.error("Lunch break backend sync failed", err);
        } finally {
          pendingRunningTaskRef.current = null;
        }
      }
    };

    handleLunchBreak();
    const interval = setInterval(handleLunchBreak, 2000);
    return () => clearInterval(interval);
  }, [runningTask, activeTab]);

  /* ===== ACTIONS ===== */

  const startTask = async (task) => {
    if (isLunchBreak()) {
      alert("Lunch break from 2–3 PM. Tasks cannot be started.");
      return;
    }

    if (isAttendancePaused) {
      alert("Attendance paused. Please check in again to resume tasks.");
      return;
    }

    const previousLogs = workLogs;
    const previousRunning = runningTaskState;
    const now = new Date().toISOString();

    const runningObj = {
      ...task,
      is_running: true,
      status: "in-progress",
      last_started_at: now,
      task: {
        ...task.task,
        is_running: true,
        last_started_at: now,
      },
    };

    // 🔒 Lock: prevents any background sync or in-flight GET from overriding running state
    pendingRunningTaskRef.current = task.id;

    // 1️⃣ Immediately set running state on frontend
    setRunningTaskState(runningObj);
    window.electronAPI?.setTaskRunning(true);

    // 2️⃣ Optimistically update work logs: stop previous task with session saved, start new task
    setWorkLogs((prev) =>
      (prev || []).map((t) => {
        if (t.id === task.id || t.task_id === task.id) {
          return runningObj;
        }

        if (t.is_running) {
          const liveSec = getLiveSeconds(t);
          const newSession = t.last_started_at
            ? {
                started_at: t.last_started_at,
                stopped_at: now,
                duration_seconds: Math.max(
                  0,
                  Math.floor(
                    (new Date(now).getTime() -
                      new Date(t.last_started_at).getTime()) /
                      1000
                  )
                ),
              }
            : null;
          const prevSessions = Array.isArray(t.work_sessions)
            ? t.work_sessions
            : [];
          const updatedSessions = newSession
            ? [...prevSessions, newSession]
            : prevSessions;

          return {
            ...t,
            is_running: false,
            total_seconds: liveSec,
            time_spent: liveSec,
            last_started_at: null,
            work_sessions: updatedSessions,
            task: {
              ...t.task,
              is_running: false,
              total_seconds: liveSec,
              last_started_at: null,
              work_sessions: updatedSessions,
            },
          };
        }

        return t;
      })
    );

    try {
      // 3️⃣ Hit start timer API in background
      await api.post("/work-logs/start-timer", {
        workLogId: task.id,
      });

      // 4️⃣ Fetch fresh data from backend now that timer started
      const res = await api.get("/work-logs/today", {
        params: { status: "in-progress" },
      });

      const raw = Array.isArray(res.data?.work_log)
        ? res.data.work_log
        : res.data?.work_log
        ? [res.data.work_log]
        : [];
      const normalized = raw.map(normalizeWorkLogItem);

      // Verify user hasn't switched to another task in the meantime
      if (pendingRunningTaskRef.current === task.id) {
        const freshRunning = normalized.find(
          (t) => t.id === task.id || t.task_id === task.id || t.is_running
        );
        if (freshRunning) {
          const finalRunning = {
            ...freshRunning,
            is_running: true,
            last_started_at: freshRunning.last_started_at || now,
          };
          setRunningTaskState(finalRunning);
        }

        setLogsByTab((prev) => ({
          ...prev,
          "in-progress": normalized.map((t) => ({
            ...t,
            is_running: t.id === task.id || t.task_id === task.id,
          })),
        }));
        syncMetaFromLogs(normalized);
      }
    } catch (err) {
      console.error("❌ Start failed → rollback", err);
      if (pendingRunningTaskRef.current === task.id) {
        setRunningTaskState(previousRunning);
        setWorkLogs(previousLogs);
        window.electronAPI?.setTaskRunning(Boolean(previousRunning));
        alert("Failed to start task. Please try again.");
      }
    } finally {
      if (pendingRunningTaskRef.current === task.id) {
        pendingRunningTaskRef.current = null;
      }
    }
  };

  const stopTask = async () => {
    const taskToStop = runningTaskState;
    if (!taskToStop) return;
    const runningId = taskToStop.id;
    const previousLogs = workLogs;
    const previousRunning = runningTaskState;
    const now = new Date().toISOString();

    // 🔒 Lock: background sync will NOT resurrect this stopped task
    pendingRunningTaskRef.current = "STOPPED";

    setRunningTaskState(null);
    window.electronAPI?.setTaskRunning(false);

    setWorkLogs((prev) =>
      (prev || []).map((t) => {
        if (t.is_running || t.id === runningId || t.task_id === runningId) {
          const liveSec = getLiveSeconds(t);
          const newSession = t.last_started_at
            ? {
                started_at: t.last_started_at,
                stopped_at: now,
                duration_seconds: Math.max(
                  0,
                  Math.floor(
                    (new Date(now).getTime() -
                      new Date(t.last_started_at).getTime()) /
                      1000
                  )
                ),
              }
            : null;
          const prevSessions = Array.isArray(t.work_sessions)
            ? t.work_sessions
            : [];
          const updatedSessions = newSession
            ? [...prevSessions, newSession]
            : prevSessions;

          return {
            ...t,
            is_running: false,
            total_seconds: liveSec,
            time_spent: liveSec,
            last_started_at: null,
            work_sessions: updatedSessions,
            task: {
              ...t.task,
              is_running: false,
              total_seconds: liveSec,
              last_started_at: null,
              work_sessions: updatedSessions,
            },
          };
        }
        return t;
      })
    );

    try {
      await api.post("/work-logs/stop-timer", {
        workLogId: runningId,
      });

      const res = await api.get("/work-logs/today", {
        params: { status: "in-progress" },
      });
      const raw = Array.isArray(res.data?.work_log)
        ? res.data.work_log
        : res.data?.work_log
        ? [res.data.work_log]
        : [];
      const normalized = raw.map(normalizeWorkLogItem);

      if (pendingRunningTaskRef.current === "STOPPED") {
        setLogsByTab((prev) => ({
          ...prev,
          "in-progress": normalized.map((t) => ({ ...t, is_running: false })),
        }));
        syncMetaFromLogs(normalized);
      }
    } catch (err) {
      console.error("❌ Stop failed → rollback", err);
      if (pendingRunningTaskRef.current === "STOPPED") {
        setRunningTaskState(previousRunning);
        setWorkLogs(previousLogs);
        window.electronAPI?.setTaskRunning(Boolean(previousRunning));
      }
    } finally {
      if (pendingRunningTaskRef.current === "STOPPED") {
        pendingRunningTaskRef.current = null;
      }
    }
  };

  const handleLogout = async () => {
    try {
      if (runningTask?.id) {
        await api.post("/work-logs/stop-timer", {
          workLogId: runningTask.id,
        });
        window.electronAPI?.setTaskRunning(false);
      }
    } catch (err) {
      console.error("❌ Failed to stop running task on logout", err);
    } finally {
      localStorage.removeItem(USER_CACHE_KEY);
      logout();
      onLogout();
    }
  };

  const firstUser = (workLogs || []).find((l) => l.user)?.user;
  const displayUser = firstUser
    ? {
        name:
          firstUser.name ||
          firstUser.user_detial?.name ||
          firstUser.username,
        photo: firstUser.photo || firstUser.user_detial?.Photo?.[0]?.url,
      }
    : cachedUser;

  return (
    <div className="min-h-screen flex items-start justify-center bg-[#f3f3f3]">
      <div style={{ width: "100%", height: 490 }}>
        <div className=" h-full p-4 flex flex-col space-y-3">
          {/* ===== BLACK BAR ===== */}
          <div
            className="bg-[#3E3A36] rounded-2xl px-6 flex items-center justify-between text-white"
            style={{width:"100%", height: 60 }}
          >
            <div>
              <div className="text-xs text-gray-300">Task</div>
              <div className="text-sm">
                {runningTask?.title ||
                  runningTask?.task_title ||
                  "No task running"}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="font-mono text-lg">
                {formatHMS(runningSeconds)}
              </div>

              {runningTask && (
                <button
                  onClick={stopTask}
                  className="w-8 h-8 rounded-full bg-[#FF7300] flex items-center justify-center cursor-pointer"
                  title="Pause task"
                >
                  ❚❚
                </button>
              )}
            </div>
          </div>

          {/* ===== USER STRIP ===== */}
          <div className="bg-white rounded-xl px-4 py-3 flex justify-between items-center shadow-sm">
            <div className="flex items-center gap-3">
              {/* PROFILE PHOTO */}
              <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-300 flex items-center justify-center">
                {displayUser?.photo ? (
                  <img
                    src={displayUser?.photo}
                    alt="profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-semibold text-gray-600">
                    {(
                      displayUser?.name ||
                      displayUser?.username ||
                      "US"
                    )
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                )}
              </div>

              {/* NAME + LOGOUT */}
              <div>
                <div className="text-sm font-medium">
                  {displayUser?.name ||
                    displayUser?.username ||
                    "Employee"}
                </div>
                <div
                  onClick={handleLogout}
                  className="text-xs text-gray-400 cursor-pointer hover:underline"
                >
                  Logout
                </div>
              </div>
            </div>

            <div className="text-[13px]">
              Worked Today:{" "}
              <span className="font-semibold">
                {formatHMS(totalTodaySeconds)}
              </span>
            </div>
          </div>

          {/* ===== SIDEBAR + CONTENT ===== */}
          <div className="flex gap-4 flex-1 overflow-hidden">
            <Sidebar
              activeFilter={activeTab}
              setActiveFilter={setActiveTab}
            />

            {/* RIGHT SIDE */}
            <div
              style={{ width: 515 }}
              className="flex-1 overflow-hidden p-3 bg-white rounded-xl shadow-sm flex flex-col"
            >
              {/* TABLE CONTAINER */}
              <div className="overflow-auto py-1 no-scrollbar flex-1">
                {!isCheckedIn ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-10">
                    <div className="text-lg font-semibold text-[#FF7300]">
                      You have not checked in today
                    </div>
                    <div className="text-sm text-gray-500 mt-2">
                      Please check in to start tracking your tasks and time
                    </div>
                  </div>
                ) : isCheckedOut ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-6">
                    <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xl mb-2 font-bold">
                      ✓
                    </div>
                    <div className="text-lg font-semibold text-[#3E3A36]">
                      All done for today!
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 mb-3">
                      See you tomorrow 👋
                    </div>

                    <div className="bg-[#F7F7F7] rounded-xl px-6 py-3 border border-gray-200 text-center min-w-[240px]">
                      <div className="text-xs text-gray-400">Total Worked Today</div>
                      <div className="text-xl font-semibold font-mono text-[#FF7300] mt-0.5">
                        {formatHMS(totalTodaySeconds)}
                      </div>
                      {(attendanceState.inTime || firstLog?.createdAt) && (
                        <div className="text-[11px] text-gray-400 mt-2 flex gap-3 justify-center">
                          <span>
                            In:{" "}
                            {new Date(
                              attendanceState.inTime || firstLog.createdAt
                            ).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {(attendanceState.outTime || firstLog?.out) && (
                            <span>
                              • Out:{" "}
                              {new Date(
                                attendanceState.outTime || firstLog.out
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : loadingTasks ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-16">
                    <div className="w-7 h-7 border-2 border-[#FF7300] border-t-transparent rounded-full animate-spin mb-3" />
                    <div className="text-xs text-gray-400 font-medium">
                      Loading tasks...
                    </div>
                  </div>
                ) : visibleTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="text-sm font-medium text-gray-500 mb-1">
                      {activeTab === "in-progress"
                        ? "No tasks currently in progress"
                        : activeTab === "planned"
                        ? "No planned tasks found"
                        : activeTab === "completed"
                        ? "No completed tasks found"
                        : "No blocked tasks found"}
                    </div>

                    <p className="text-xs text-gray-400 mb-3">
                      {activeTab === "in-progress"
                        ? "Start a task from your Planned list to begin tracking time"
                        : activeTab === "planned"
                        ? "Check your in-progress list to view active tasks"
                        : activeTab === "completed"
                        ? "Completed tasks will appear here"
                        : "Blocked tasks will appear here"}
                    </p>

                    {activeTab === "in-progress" ? (
                      <button
                        onClick={() => setActiveTab("planned")}
                        className="px-3 py-1.5 bg-[#FF7300] text-white rounded-lg text-xs font-medium hover:bg-[#e06600] transition cursor-pointer"
                      >
                        View Planned Tasks
                      </button>
                    ) : (
                      <button
                        onClick={() => setActiveTab("in-progress")}
                        className="px-3 py-1.5 bg-[#FF7300] text-white rounded-lg text-xs font-medium hover:bg-[#e06600] transition cursor-pointer"
                      >
                        View In-Progress Tasks
                      </button>
                    )}
                  </div>
                ) : (
                  <table className="w-full bg-white rounded-xl text-sm">
                    <thead className="bg-gray-50">
                      <tr className="rounded-xl bg-[#F7F7F7]">
                        {/* Task */}
                        <th className="p-2 text-left text-md font-normal">
                          Task
                        </th>

                        {/* Time / Total Time Taken */}
                        <th
                          className={`p-2 text-md font-normal ${
                            activeTab === "in-progress"
                              ? "text-left w-28"
                              : "text-right pr-6 whitespace-nowrap"
                          }`}
                        >
                          {activeTab === "in-progress"
                            ? "Time"
                            : "Total Time Taken"}
                        </th>

                        {/* Action - only in In-Progress */}
                        {activeTab === "in-progress" && (
                          <th className="p-2 text-md font-normal text-center w-20">
                            Action
                          </th>
                        )}
                      </tr>
                    </thead>

                    <tbody className="text-sm">
                      {visibleTasks.map((task) => (
                        <tr
                          key={`${task.id}-${task.title}`}
                          className="border-b"
                        >
                          <td
                          title={task.title}
                            className={`p-2 text-sm ${
                              task.is_running
                                ? "text-green-500 font-medium"
                                : "text-gray-800"
                            }`}
                          >
                           
                           <span className="line-clamp-1">{task.title}</span> 
                          </td>

                          <td
                            className={`p-2 font-mono ${
                              activeTab === "in-progress"
                                ? "w-28 text-left"
                                : "text-right pr-6"
                            }`}
                          >
                            <span
                              className={`inline-block px-2 py-1 rounded-md text-sm ${
                                task.is_running
                                ? "bg-green-100 text-green-500"
                                : "bg-transparent text-gray-800"
                              }`}
                            >
                              {formatHMS(
                                activeTab === "in-progress"
                                  ? getTaskTodaySeconds(task)
                                  : getLiveSeconds(task)
                              )}
                            </span>
                          </td>

                          {activeTab === "in-progress" && (
                            <td className="p-2 text-center w-20">
                              {task.is_running ? (
                                <button
                                  onClick={stopTask}
                                  className="w-6 h-6 rounded-full bg-[#FF7300] text-white flex items-center justify-center mx-auto cursor-pointer"
                                  title="Pause task"
                                >
                                  ❚❚
                                </button>
                              ) : (
                                <button
                                  onClick={() => startTask(task)}
                                  disabled={
                                    isLunchBreak() || isAttendancePaused
                                  }
                                  className={`w-6 h-6 text-gray-50 bg-[#797571] rounded-full flex items-center justify-center mx-auto ${
                                    isLunchBreak() || isAttendancePaused
                                      ? "opacity-40 cursor-not-allowed"
                                      : "hover:bg-[#FF7300] transition cursor-pointer"
                                  }`}
                                  title="Start task"
                                >
                                  ▶
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
