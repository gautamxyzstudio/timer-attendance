// import { useEffect, useRef, useState } from "react";
// import api from "./api.js";
// import AddTask from "./addTask.jsx";

// /* ================= HELPERS ================= */

// const getTodayDate = () => {
//   const d = new Date();
//   const yyyy = d.getFullYear();
//   const mm = String(d.getMonth() + 1).padStart(2, "0");
//   const dd = String(d.getDate()).padStart(2, "0");
//   return `${yyyy}-${mm}-${dd}`;
// };


// const formatHMS = (seconds = 0) => {
//   const h = Math.floor(seconds / 3600);
//   const m = Math.floor((seconds % 3600) / 60);
//   const s = seconds % 60;
//   return `${h.toString().padStart(2, "0")}:${m
//     .toString()
//     .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
// };

// const getNowMinutes = () => {
//   const d = new Date();
//   return d.getHours() * 60 + d.getMinutes();
// };

// // 🟡 Lunch time: 1:00 – 2:00 PM
// const isLunchTime = () => {
//   const mins = getNowMinutes();
//   return mins >= 13 * 60 && mins < 14 * 60;
// };


// // 🔒 Display-only helper
// const getLiveTaskSeconds = (task) => {
//   if (!task) return 0;

//   if (!task.is_running || !task.last_started_at) {
//     return task.time_spent || 0;
//   }

//   const startedAt = new Date(task.last_started_at).getTime();
//   const now = Date.now();

//   if (isLunchTime()) {
//     return task.time_spent || 0;
//   }

//   return (
//     (task.time_spent || 0) +
//     Math.floor((now - startedAt) / 1000)
//   );
// };


// // 🔒 Stop helper
// const stopTaskSafely = (task) => {
//   if (!task.is_running || !task.last_started_at) {
//     return task.time_spent || 0;
//   }

//   const startedAt = new Date(task.last_started_at).getTime();
//   const now = Date.now();

//   if (now < startedAt) return task.time_spent || 0;

//   return (
//     (task.time_spent || 0) +
//     Math.floor((now - startedAt) / 1000)
//   );
// };

// /* ================= COMPONENT ================= */

// export default function AttendanceApp({ onLogout, registerLogoutHandler }) {

//   const [workLog, setWorkLog] = useState(null);
//   const [tick, setTick] = useState(0);

//   const isMountedRef = useRef(true);
//   const userStatusChangeRef = useRef(false);
//   const didInitRef = useRef(false); 


//   /* ================= GLOBAL TICK ================= */
//   useEffect(() => {
//     const i = setInterval(() => setTick((t) => t + 1), 1000);
//     return () => clearInterval(i);
//   }, []);


//   /* ================= LOAD TODAY WORK LOG ================= */

//   const loadTodayWorkLog = async () => {
//     try {
//       const res = await api.post("/work-logs/today");

//       // ✅ BACKEND RETURNS { work_log, daily_task }
//       setWorkLog(res.data.work_log);
//     } catch (err) {
//       console.error("❌ Failed to create/load today work log", err);
//     }
//   };


// useEffect(() => {
//   if (didInitRef.current) return; // 🛑 block second call
//   didInitRef.current = true;

//   loadTodayWorkLog();
// }, []);


//   useEffect(() => {
//     if (!workLog?.tasks) return;

//     const isAnyRunning = workLog.tasks.some(t => t.is_running);

//     if (window.electronAPI?.setTaskRunning) {
//       console.log(
//         "🔁 Syncing TASK_RUNNING with Electron:",
//         isAnyRunning
//       );
//       window.electronAPI.setTaskRunning(isAnyRunning);
//     }
//   }, [workLog]);

//   /* ================= TASK ACTIONS ================= */

//   const startTask = async (task_id) => {

//     const task = workLog.tasks.find(t => t.task_id === task_id);
//     if (task?.status === "completed") {
//       return; // 🚫 BLOCK START
//     }

//     const now = new Date().toISOString();

//     // 1️⃣ Update UI immediately
//     setWorkLog((prev) => ({
//       ...prev,
//       tasks: prev.tasks.map((t) => {
//         if (t.is_running && t.task_id !== task_id) {
//           return {
//             ...t,
//             is_running: false,
//             last_started_at: null,
//             time_spent: stopTaskSafely(t),
//           };
//         }
//         if (t.task_id === task_id) {
//           return {
//             ...t,
//             is_running: true,
//             last_started_at: now,
//           };
//         }
//         return t;
//       }),
//     }));

//     try {
//       // 2️⃣ Call backend
//       await api.post("/work-logs/start-timer", {
//         workLogId: workLog.id,
//         task_id,
//       });

//       // 3️⃣ Tell Electron (THIS IS THE KEY)
//       if (window.electronAPI?.setTaskRunning) {
//         console.log("📤 Sending TASK_RUNNING = true to Electron");
//         window.electronAPI.setTaskRunning(true);
//       } else {
//         console.warn("⚠️ electronAPI.setTaskRunning not available");
//       }
//     } catch (err) {
//       console.error("❌ startTask failed", err);
//       loadTodayWorkLog();
//     }
//   };


//   const stopAllTasks = async () => {
//     console.log("🛑 stopAllTasks called");

//     // 1️⃣ Update UI immediately
//     setWorkLog((prev) => ({
//       ...prev,
//       tasks: prev.tasks.map((t) =>
//         t.is_running
//           ? {
//             ...t,
//             is_running: false,
//             last_started_at: null,
//             time_spent: stopTaskSafely(t),
//           }
//           : t
//       ),
//     }));

//     try {
//       // 2️⃣ Backend stop
//       await api.post("/work-logs/stop-timer", {
//         workLogId: workLog.id,
//       });
//     } catch (err) {
//       console.error("❌ stopAllTasks API failed", err);
//     } finally {
//       // 3️⃣ Notify Electron (THIS MUST ALWAYS RUN)
//       if (window.electronAPI?.setTaskRunning) {
//         console.log("📤 Sending TASK_RUNNING = false to Electron");
//         window.electronAPI.setTaskRunning(false);
//       } else {
//         console.warn("⚠️ electronAPI.setTaskRunning not available");
//       }
//     }
//   };

//   const safeLogout = async () => {
//     console.log("🚪 Navbar logout → stopping all tasks");

//     await stopAllTasks(); // 🔥 critical

//     // Silence Electron inactivity
//     window.electronAPI?.setTaskRunning(false);

//     // Continue app logout
//     onLogout();
//   };

//   useEffect(() => {
//     if (registerLogoutHandler) {
//       registerLogoutHandler(safeLogout);
//     }
//   }, [registerLogoutHandler, safeLogout]);


//   const updateTaskStatus = async (task_id, completed) => {
//     // 🚫 Ignore calls not triggered by checkbox click
//     if (!userStatusChangeRef.current) return;

//     // reset immediately to avoid re-entry
//     userStatusChangeRef.current = false;

//     const newStatus = completed ? "completed" : "in-progress";

//     const task = workLog.tasks.find(t => t.task_id === task_id);
//     if (!task) return;

//     // 🛑 STOP ONLY THIS TASK (SYNC UI)
//     const updatedTasks = workLog.tasks.map(t => {
//       if (t.task_id === task_id && t.is_running) {
//         return {
//           ...t,
//           is_running: false,
//           last_started_at: null,
//           time_spent: stopTaskSafely(t),
//           status: newStatus,
//         };
//       }

//       if (t.task_id === task_id) {
//         return { ...t, status: newStatus };
//       }

//       return t;
//     });

//     // ✅ SINGLE STATE UPDATE
//     setWorkLog(prev => ({
//       ...prev,
//       tasks: updatedTasks,
//     }));

//     try {
//       // 🛑 Stop timer ONLY if task was running
//       if (task.is_running) {
//         await api.post("/work-logs/stop-timer", {
//           workLogId: workLog.id,
//         });
//       }

//       // ✅ Update status in backend
//       await api.put(`/work-logs/${workLog.id}/update-task`, {
//         data: {
//           task_id,
//           status: newStatus,
//         },
//       });
//     } catch (err) {
//       console.error("❌ Failed to update task status", err);
//       loadTodayWorkLog(); // rollback
//     }
//   };



//   /* ================= ELECTRON FORCE STOP ================= */

//   useEffect(() => {
//     window.electronAPI.onForceStopTasks(async () => {
//       console.log("🛑 Force stop received from Electron");
//       await stopAllTasks();
//     });
//   }, []);

//   useEffect(() => {
//     return () => {
//       console.log("🧹 AttendanceApp unmount");
//       isMountedRef.current = false;
//     };
//   }, []);


//   /* ================= UI ================= */

//   const today = getTodayDate();

//   const tasks = (workLog?.tasks || [])
//     // ✅ only today’s tasks
//     .filter(t => t.createdAt?.slice(0, 10) === today)
//     // ✅ completed tasks go to bottom
//     .sort((a, b) => {
//       if (a.status === "completed" && b.status !== "completed") return 1;
//       if (a.status !== "completed" && b.status === "completed") return -1;
//       return 0;
//     });


//   const totalTaskSeconds = tasks.reduce(
//     (sum, t) => sum + getLiveTaskSeconds(t),
//     0
//   );

//   if (!workLog) {
//     return <h3>Loading work log...</h3>;
//   }

//   return (
//     <div style={{ padding: 30, fontFamily: "Arial" }}>
//       <h2 className="text-blue-300 font-medium text-3xl">Employee Work Log</h2>

//       <br/>
//       <br/>
//       <br/>

//       {/* add Task  */}
//       <AddTask
//         workLogId={workLog?.id}
//         onTaskAdded={(newTask) =>
//           setWorkLog((prev) =>
//             prev
//               ? { ...prev, tasks: [...(prev.tasks || []), newTask] }
//               : prev
//           )
//         }

//       />

//       <br />

//       {/* Tasks */}
//       <h3 style={{ marginTop: 30 }}>Tasks</h3>

//       <table className="border border-gray-400 border-collapse mt-2">
//         <thead>
//           <tr className="bg-gray-100">
//             <th className="border border-gray-400 px-3 py-2 text-left">
//               Done
//             </th>
//             <th className="border border-gray-400 px-3 py-2 text-left">
//               Task
//             </th>
//             <th className="border border-gray-400 px-3 py-2 text-left">
//               Project
//             </th>
//             <th className="border border-gray-400 px-3 py-2 text-left">
//               Status
//             </th>
//             <th className="border border-gray-400 px-3 py-2 text-left">
//               Running Status
//             </th>
//             <th className="border border-gray-400 px-3 py-2 text-left">
//               Time
//             </th>
//             <th className="border border-gray-400 px-3 py-2 text-left">
//               Action
//             </th>
//           </tr>
//         </thead>

//         <tbody>
//           {tasks.map((task) => (
//             <tr key={task.task_id}>

//               {/* ✅ COMPLETED CHECKBOX */}
//               <td className="border border-gray-400 px-3 py-2 text-center">
//                 <input
//                   type="checkbox"
//                   checked={task.status === "completed"}
//                   disabled={task.status === "completed"}
//                   onChange={(e) => {
//                     userStatusChangeRef.current = true;
//                     updateTaskStatus(task.task_id, e.target.checked);
//                   }}
//                   className={`h-5 w-5 
//     ${task.status === "completed"
//                       ? "accent-green-600 opacity-100 cursor-not-allowed"
//                       : "accent-blue-600 cursor-pointer"
//                     }`}
//                 />

//               </td>

//               <td className="border border-gray-400 px-3 py-2">
//                 {task.task_title}
//               </td>

//               {/* PROJECT */}
//               <td className="border border-gray-400 px-3 py-2">
//                 {task.project?.title || "—"}
//               </td>

//               <td className="border border-gray-400 px-3 py-2">
//                 <span
//                   className={`px-2 py-1 rounded text-xs font-medium
//       ${task.status === "completed"
//                       ? "bg-green-100 text-green-700"
//                       : task.status === "hold"
//                         ? "bg-yellow-100 text-yellow-700"
//                         : "bg-blue-100 text-blue-700"
//                     }`}
//                 >
//                   {task.status}
//                 </span>
//               </td>

//               <td className="border border-gray-400 px-3 py-2">
//                 {task.is_running ? "Running" : "Stopped"}
//               </td>

//               <td className="border border-gray-400 px-3 py-2 font-mono">
//                 {formatHMS(getLiveTaskSeconds(task))}
//               </td>

//               <td className="border border-gray-400 px-3 py-2">
//                 {task.is_running ? (
//                   <button onClick={stopAllTasks}>Stop</button>
//                 ) : task.status === "completed" ? (
//                   <span className="text-gray-400 text-sm">
//                     Completed
//                   </span>
//                 ) : (
//                   <button onClick={() => startTask(task.task_id)}>
//                     Start
//                   </button>
//                 )}
//               </td>

//             </tr>
//           ))}
//         </tbody>
//       </table>

//       <br />

//       <h4>⏱ Total Task Time: {formatHMS(totalTaskSeconds)}</h4>


//     </div>
//   );
// }

import { useEffect, useRef, useState } from "react";
import api from "./api";
import AddTask from "./addTask";
import Sidebar from "./Sidebar";

/* ================= HELPERS ================= */

const todayDate = () => new Date().toISOString().slice(0, 10);

const formatHMS = (seconds = 0) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const getLiveSeconds = (task) => {
  if (!task.is_running || !task.last_started_at) {
    return task.time_spent || 0;
  }

  return (
    (task.time_spent || 0) +
    Math.floor((Date.now() - new Date(task.last_started_at)) / 1000)
  );
};

/* ================= COMPONENT ================= */

export default function AttendanceApp() {
  const [todayLog, setTodayLog] = useState(null);
  const [historyTasks, setHistoryTasks] = useState([]);
  const [activeTab, setActiveTab] = useState("today");
  const [pending, setPending] = useState(false);

  const [, forceTick] = useState(0);
  const initRef = useRef(false);

  /* ================= GLOBAL TICK ================= */
  useEffect(() => {
    const i = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  /* ================= LOAD DATA ================= */
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    api.post("/work-logs/today").then((res) => {
      setTodayLog(res.data.work_log);
    });

    api.get("/work-logs/completed").then((res) => {
      const list = Array.isArray(res.data)
        ? res.data
        : res.data?.data || [];
      setHistoryTasks(list);
    });
  }, []);

  if (!todayLog) return <div>Loading...</div>;

  /* ================= ATTENDANCE FLAG ================= */
  const hasAttendance = todayLog?.has_attendance !== false;

  /* ================= FILTERS ================= */

  const today = todayDate();

  // ✅ Today → show ALL tasks (including Daily Meeting)
  const todayTasks = hasAttendance
    ? (todayLog.tasks || []).filter(
        (t) => t.createdAt?.slice(0, 10) === today
      )
    : [];

  // ❌ EXCLUDE DAILY MEETING FROM NON-TODAY VIEWS
  const inProgressTasks = historyTasks.filter(
    (t) =>
      t.status === "in-progress" &&
      t.task_key !== "DAILY_MEETING"
  );

  const completedTasks = historyTasks.filter(
    (t) =>
      t.status === "completed" &&
      t.task_key !== "DAILY_MEETING"
  );

  const visibleTasks =
    activeTab === "today"
      ? todayTasks
      : activeTab === "in-progress"
      ? inProgressTasks
      : activeTab === "completed"
      ? completedTasks
      : [];

  /* ================= BACKEND ACTIONS ================= */

  const startTask = async (task) => {
    if (!hasAttendance) {
      alert("Please check in to start tasks");
      return;
    }
    if (pending) return;
    setPending(true);

    try {
      const res = await api.post("/work-logs/start-timer", {
        workLogId: todayLog.id,
        task_id: task.task_id,
      });
      setTodayLog(res.data);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to start task");
    } finally {
      setPending(false);
    }
  };

  const stopTask = async () => {
    if (!hasAttendance) return;
    if (pending) return;
    setPending(true);

    try {
      const res = await api.post("/work-logs/stop-timer", {
        workLogId: todayLog.id,
      });
      setTodayLog(res.data);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to stop task");
    } finally {
      setPending(false);
    }
  };

  const completeTask = async (task_id) => {
    if (!hasAttendance) return;
    if (pending) return;
    setPending(true);

    try {
      const res = await api.put(
        `/work-logs/${todayLog.id}/update-task`,
        { data: { task_id, status: "completed" } }
      );
      setTodayLog(res.data);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to complete task");
    } finally {
      setPending(false);
    }
  };

  /* ================= TOTAL TIME ================= */

  const totalTodaySeconds = todayTasks.reduce(
    (sum, t) => sum + getLiveSeconds(t),
    0
  );

  const showLiveControls = activeTab === "today" && hasAttendance;

  /* ================= UI ================= */

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        activeFilter={activeTab}
        setActiveFilter={setActiveTab}
        todayCount={todayTasks.length}
        inProgressCount={inProgressTasks.length}
        completedCount={completedTasks.length}
      />

      <main className="flex-1 p-6">
        <h2 className="text-3xl font-semibold text-blue-600 mb-6">
          Employee Work Log
        </h2>

        {activeTab === "today" && hasAttendance && (
          <AddTask
            workLogId={todayLog.id}
            onTaskAdded={(task) =>
              setTodayLog((prev) => ({
                ...prev,
                tasks: [...(prev.tasks || []), task],
              }))
            }
          />
        )}

        {activeTab === "today" && !hasAttendance && (
          <div className="text-gray-500 mt-6">
            You have not checked in today.
          </div>
        )}

        <table className="w-full mt-6 bg-white shadow text-sm">
          <thead className="bg-gray-100">
            <tr>
              {showLiveControls && (
                <th className="p-3 text-center">Done</th>
              )}
              <th className="p-3">Task</th>
              <th className="p-3">Project</th>
              <th className="p-3">Status</th>
              <th className="p-3">Date</th>
              <th className="p-3">Time</th>
              {showLiveControls && (
                <th className="p-3">Action</th>
              )}
            </tr>
          </thead>

          <tbody>
            {visibleTasks.map((task) => {
              const isCompleted = task.status === "completed";

              return (
                <tr
                  key={`${task.task_id}-${task.createdAt}`}
                  className="border-t"
                >
                  {showLiveControls && (
                    <td className="text-center">
                      {isCompleted ? (
                        <input type="checkbox" checked disabled />
                      ) : (
                        <input
                          type="checkbox"
                          onChange={() =>
                            completeTask(task.task_id)
                          }
                          disabled={pending}
                        />
                      )}
                    </td>
                  )}

                  <td className="p-3">{task.task_title}</td>
                  <td className="p-3">
                    {task.project?.title || "—"}
                  </td>
                  <td className="p-3">{task.status}</td>
                  <td className="p-3">
                    {task.work_date ||
                      task.createdAt?.slice(0, 10)}
                  </td>
                  <td className="p-3 font-mono">
                    {formatHMS(
                      isCompleted
                        ? task.time_spent || 0
                        : getLiveSeconds(task)
                    )}
                  </td>

                  {showLiveControls && (
                    <td className="p-3">
                      {!isCompleted &&
                        (task.is_running ? (
                          <button
                            onClick={stopTask}
                            disabled={pending}
                            className="text-red-600"
                          >
                            Stop
                          </button>
                        ) : (
                          <button
                            onClick={() => startTask(task)}
                            disabled={pending}
                            className="text-blue-600"
                          >
                            Start
                          </button>
                        ))}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {activeTab === "today" && hasAttendance && (
          <div className="mt-4 font-semibold">
            ⏱ Today’s Total Time: {formatHMS(totalTodaySeconds)}
          </div>
        )}
      </main>
    </div>
  );
}
