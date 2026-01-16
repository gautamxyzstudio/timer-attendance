import { useEffect, useRef, useState } from "react";
import Attendance from "./Attendance.jsx";
import api from "./api.js";

/* ================= HELPERS ================= */

const formatHMS = (seconds = 0) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const getNowMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

// 🟡 Lunch time: 1:00 – 2:00 PM
const isLunchTime = () => {
  const mins = getNowMinutes();
  return mins >= 13 * 60 && mins < 14 * 60;
};

// 🔒 Display-only helper
const getLiveTaskSeconds = (task) => {
  if (!task || !task.is_running || !task.last_started_at) {
    return task?.time_spent || 0;
  }

  if (isLunchTime()) {
    return task.time_spent || 0;
  }

  const startedAt = new Date(task.last_started_at).getTime();
  const now = Date.now();

  if (now < startedAt) return task.time_spent || 0;

  return (
    (task.time_spent || 0) +
    Math.floor((now - startedAt) / 1000)
  );
};

// 🔒 Stop helper
const stopTaskSafely = (task) => {
  if (!task.is_running || !task.last_started_at) {
    return task.time_spent || 0;
  }

  const startedAt = new Date(task.last_started_at).getTime();
  const now = Date.now();

  if (now < startedAt) return task.time_spent || 0;

  return (
    (task.time_spent || 0) +
    Math.floor((now - startedAt) / 1000)
  );
};

/* ================= COMPONENT ================= */

export default function AttendanceApp({ onLogout }) {

  useEffect(() => {
  let lastActivity = Date.now();
  let idleTimer;

  const resetTimer = () => {
    lastActivity = Date.now();
  };

  ["mousemove", "keydown", "mousedown", "touchstart"].forEach(evt =>
    window.addEventListener(evt, resetTimer)
  );

  idleTimer = setInterval(() => {
    const diff = Date.now() - lastActivity;

    // ⏱ 2 minutes inactivity + task running
    if (diff >= 2 * 60 * 1000) {
      window.electronAPI?.showIdlePopup();
      lastActivity = Date.now(); // prevent repeated popups
    }
  }, 10000);

  return () => {
    clearInterval(idleTimer);
    ["mousemove", "keydown", "mousedown", "touchstart"].forEach(evt =>
      window.removeEventListener(evt, resetTimer)
    );
  };
}, []);


  const [workLog, setWorkLog] = useState(null);
  const [tick, setTick] = useState(0);

  const popupTimeoutRef = useRef(null);

  /* ================= GLOBAL TICK ================= */
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  /* ================= LOAD WORK LOG ================= */

  const loadLatestWorkLog = async () => {
    const res = await api.get("/work-logs/user");
    const logs = res.data?.work_logs || [];
    logs.sort((a, b) => new Date(b.work_date) - new Date(a.work_date));
    setWorkLog(logs[0] || null);
  };

  useEffect(() => {
    loadLatestWorkLog();
  }, []);

  /* ================= TASK ACTIONS ================= */

  const startTask = async (task_id) => {
    const now = new Date().toISOString();

    setWorkLog((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => {
        if (t.is_running && t.task_id !== task_id) {
          return {
            ...t,
            is_running: false,
            last_started_at: null,
            time_spent: stopTaskSafely(t),
          };
        }
        if (t.task_id === task_id) {
          return {
            ...t,
            is_running: true,
            last_started_at: now,
          };
        }
        return t;
      }),
    }));

    try {
      await api.post("/work-logs/start-timer", {
        workLogId: workLog.id,
        task_id,
      });

      // 🔥 Tell Electron a task is running
      window.electronAPI.setTaskRunning(true);
    } catch {
      loadLatestWorkLog();
    }
  };

  const stopAllTasks = async () => {
    setWorkLog((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.is_running
          ? {
              ...t,
              is_running: false,
              last_started_at: null,
              time_spent: stopTaskSafely(t),
            }
          : t
      ),
    }));

    try {
      await api.post("/work-logs/stop-timer", {
        workLogId: workLog.id,
      });
    } finally {
      window.electronAPI.setTaskRunning(false);
    }
  };

  /* ================= ELECTRON FORCE STOP ================= */

  useEffect(() => {
    window.electronAPI.onForceStopTasks(async () => {
      await stopAllTasks();
      alert("Tasks stopped due to inactivity");
    });
  }, []);

  /* ================= UI ================= */

  const tasks = workLog?.tasks || [];

  const totalTaskSeconds = tasks.reduce(
    (sum, t) => sum + getLiveTaskSeconds(t),
    0
  );

  if (!workLog) {
    return <h3>Loading work log...</h3>;
  }

  return (
    <div style={{ padding: 30, fontFamily: "Arial" }}>
      <h2>Daily Attendance & Work Log</h2>

      {/* Attendance */}
      <Attendance />

      {/* Tasks */}
      <h3 style={{ marginTop: 30 }}>Tasks</h3>

      <table border="1" cellPadding="10">
        <tbody>
          {tasks.map((task) => (
            <tr key={task.task_id}>
              <td>{task.task_title}</td>
              <td>{task.is_running ? "Running" : "Stopped"}</td>
              <td>{formatHMS(getLiveTaskSeconds(task))}</td>
              <td>
                {task.is_running ? (
                  <button onClick={stopAllTasks}>Stop</button>
                ) : (
                  <button onClick={() => startTask(task.task_id)}>
                    Start
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>⏱ Total Task Time: {formatHMS(totalTaskSeconds)}</h4>

      <br />
      <button onClick={onLogout}>Logout</button>
    </div>
  );
}
