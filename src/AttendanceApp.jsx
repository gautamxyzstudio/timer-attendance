import { useEffect,useRef ,useState } from "react";
import api from "./api.js";
import Attendance from "./Attendence.jsx";
import AddTask from "./addTask.jsx";

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

  const [workLog, setWorkLog] = useState(null);
  const [tick, setTick] = useState(0);

  const isMountedRef = useRef(true);


  /* ================= GLOBAL TICK ================= */
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);


  /* ================= CREATE TODAY WORK LOG ================= */

const createTodayWorkLog = async () => {
  const res = await api.post("/work-logs/today");
  return res.data;
};



 /* ================= LOAD TODAY WORK LOG ================= */

const loadTodayWorkLog = async () => {
  try {
    const res = await api.post("/work-logs/today");

    // ✅ BACKEND RETURNS { work_log, daily_task }
    setWorkLog(res.data.work_log);
  } catch (err) {
    console.error("❌ Failed to create/load today work log", err);
  }
};


useEffect(() => {
  loadTodayWorkLog();
}, []);

   useEffect(() => {
    if (!workLog?.tasks) return;

    const isAnyRunning = workLog.tasks.some(t => t.is_running);

    if (window.electronAPI?.setTaskRunning) {
      console.log(
        "🔁 Syncing TASK_RUNNING with Electron:",
        isAnyRunning
      );
      window.electronAPI.setTaskRunning(isAnyRunning);
    }
  }, [workLog]);

  /* ================= TASK ACTIONS ================= */

 const startTask = async (task_id) => {
  const now = new Date().toISOString();

  // 1️⃣ Update UI immediately
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
    // 2️⃣ Call backend
    await api.post("/work-logs/start-timer", {
      workLogId: workLog.id,
      task_id,
    });

    // 3️⃣ Tell Electron (THIS IS THE KEY)
    if (window.electronAPI?.setTaskRunning) {
      console.log("📤 Sending TASK_RUNNING = true to Electron");
      window.electronAPI.setTaskRunning(true);
    } else {
      console.warn("⚠️ electronAPI.setTaskRunning not available");
    }
  } catch (err) {
    console.error("❌ startTask failed", err);
 loadTodayWorkLog();  }
};


const stopAllTasks = async () => {
  console.log("🛑 stopAllTasks called");

  // 1️⃣ Update UI immediately
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
    // 2️⃣ Backend stop
    await api.post("/work-logs/stop-timer", {
      workLogId: workLog.id,
    });
  } catch (err) {
    console.error("❌ stopAllTasks API failed", err);
  } finally {
    // 3️⃣ Notify Electron (THIS MUST ALWAYS RUN)
    if (window.electronAPI?.setTaskRunning) {
      console.log("📤 Sending TASK_RUNNING = false to Electron");
      window.electronAPI.setTaskRunning(false);
    } else {
      console.warn("⚠️ electronAPI.setTaskRunning not available");
    }
  }
};

  /* ================= ELECTRON FORCE STOP ================= */

 useEffect(() => {
  window.electronAPI.onForceStopTasks(async () => {
    console.log("🛑 Force stop received from Electron");
    await stopAllTasks();
  });
}, []);

useEffect(() => {
  return () => {
    console.log("🧹 AttendanceApp unmount");
    isMountedRef.current = false;
  };
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

      <br/>

      {/* Attendance */}
      <Attendance />

      <br/>
      <br/>
      <br/>

      {/* add Task  */}
<AddTask
  workLogId={workLog?.id}
onTaskAdded={(newTask) =>
  setWorkLog((prev) =>
    prev
      ? { ...prev, tasks: [...(prev.tasks || []), newTask] }
      : prev
  )
}

/>

     <br/>

      {/* Tasks */}
      <h3 style={{ marginTop: 30 }}>Tasks</h3>

      <table className="border border-gray-400 border-collapse mt-2">
  <thead>
    <tr className="bg-gray-100">
      <th className="border border-gray-400 px-3 py-2 text-left">
        Task
      </th>
      <th className="border border-gray-400 px-3 py-2 text-left">
        Status
      </th>
      <th className="border border-gray-400 px-3 py-2 text-left">
        Time
      </th>
      <th className="border border-gray-400 px-3 py-2 text-left">
        Action
      </th>
    </tr>
  </thead>

  <tbody>
    {tasks.map((task) => (
      <tr key={task.task_id}>
        <td className="border border-gray-400 px-3 py-2">
          {task.task_title}
        </td>

        <td className="border border-gray-400 px-3 py-2">
          {task.is_running ? "Running" : "Stopped"}
        </td>

        <td className="border border-gray-400 px-3 py-2 font-mono">
          {formatHMS(getLiveTaskSeconds(task))}
        </td>

        <td className="border border-gray-400 px-3 py-2">
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

<br/>

      <h4>⏱ Total Task Time: {formatHMS(totalTaskSeconds)}</h4>


    </div>
  );
}
