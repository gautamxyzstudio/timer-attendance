// import { useEffect, useRef, useState } from "react";
// import api from "./api";
// import AddTask from "./addTask";
// import Sidebar from "./Sidebar";

// /* ================= HELPERS ================= */

// const todayDate = () => new Date().toISOString().slice(0, 10);

// const formatHMS = (seconds = 0) => {
//   const h = Math.floor(seconds / 3600);
//   const m = Math.floor((seconds % 3600) / 60);
//   const s = seconds % 60;
//   return `${h.toString().padStart(2, "0")}:${m
//     .toString()
//     .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
// };

// const getLiveSeconds = (task) => {
//   if (!task.is_running || !task.last_started_at) {
//     return task.time_spent || 0;
//   }

//   return (
//     (task.time_spent || 0) +
//     Math.floor((Date.now() - new Date(task.last_started_at)) / 1000)
//   );
// };

// /* ================= ELECTRON SYNC ================= */

// const syncTaskRunningToElectron = (isRunning) => {
//   if (window.electronAPI?.setTaskRunning) {
//     window.electronAPI.setTaskRunning(isRunning);
//   }
// };

// /* ================= COMPONENT ================= */

// export default function AttendanceApp() {
//   const [todayLog, setTodayLog] = useState(null);
//   const [historyTasks, setHistoryTasks] = useState([]);
//   const [activeTab, setActiveTab] = useState("today");
//   const [pending, setPending] = useState(false);

//   const [, forceTick] = useState(0);
//   const initRef = useRef(false);

//   /* ================= GLOBAL TICK ================= */
//   useEffect(() => {
//     const i = setInterval(() => forceTick((t) => t + 1), 1000);
//     return () => clearInterval(i);
//   }, []);

//   /* ================= LOAD DATA ================= */
//   useEffect(() => {
//     if (initRef.current) return;
//     initRef.current = true;

//     api.post("/work-logs/today").then((res) => {
//       const log = res.data.work_log;
//       setTodayLog(log);

//       const isAnyRunning = log?.tasks?.some((t) => t.is_running);
//       syncTaskRunningToElectron(isAnyRunning);
//     });

//     api.get("/work-logs/completed").then((res) => {
//       const list = Array.isArray(res.data)
//         ? res.data
//         : res.data?.data || [];
//       setHistoryTasks(list);
//     });
//   }, []);

//   /* ================= ELECTRON FORCE STOP ================= */
// useEffect(() => {
//   if (!window.electronAPI?.onForceStopTasks) return;
//   if (!todayLog?.id) return;

//   const handler = async () => {
//     console.log("🛑 Force stop received → updating UI");

//     try {
//       const res = await api.post("/work-logs/stop-timer", {
//         workLogId: todayLog.id,
//       });

//       if (res?.data) {
//         setTodayLog(res.data); // 🔥 THIS stops timer visually
//       }
//     } catch (err) {
//       console.error("❌ Force stop sync failed", err);
//     }
//   };

//   window.electronAPI.onForceStopTasks(handler);
// }, [todayLog?.id]);


//   /* ================= ATTENDANCE FLAG ================= */
//   const hasAttendance = todayLog?.has_attendance !== false;

//   /* ================= FILTERS ================= */

//   const today = todayDate();

//   const todayTasks = hasAttendance
//     ? (todayLog?.tasks || []).filter(
//         (t) => t.createdAt?.slice(0, 10) === today
//       )
//     : [];

//   const inProgressTasks = historyTasks.filter(
//     (t) => t.status === "in-progress" && t.task_key !== "DAILY_MEETING"
//   );

//   const completedTasks = historyTasks.filter(
//     (t) => t.status === "completed" && t.task_key !== "DAILY_MEETING"
//   );

//   const visibleTasks =
//     activeTab === "today"
//       ? todayTasks
//       : activeTab === "in-progress"
//       ? inProgressTasks
//       : completedTasks;

//   /* ================= BACKEND ACTIONS ================= */

//   const startTask = async (task) => {
//     if (!hasAttendance || pending) return;
//     setPending(true);

//     try {
//       const res = await api.post("/work-logs/start-timer", {
//         workLogId: todayLog.id,
//         task_id: task.task_id,
//       });
//       setTodayLog(res.data);
//       syncTaskRunningToElectron(true);
//     } finally {
//       setPending(false);
//     }
//   };

//   const stopTask = async () => {
//     if (!hasAttendance || pending) return;
//     setPending(true);

//     try {
//       const res = await api.post("/work-logs/stop-timer", {
//         workLogId: todayLog.id,
//       });
//       setTodayLog(res.data);

//       const isAnyRunning =
//         res?.data?.tasks?.some((t) => t.is_running) ?? false;
//       syncTaskRunningToElectron(isAnyRunning);
//     } finally {
//       setPending(false);
//     }
//   };

//   const completeTask = async (task_id) => {
//     if (!hasAttendance || pending) return;
//     setPending(true);

//     try {
//       const res = await api.put(
//         `/work-logs/${todayLog.id}/update-task`,
//         { data: { task_id, status: "completed" } }
//       );
//       setTodayLog(res.data);
//     } finally {
//       setPending(false);
//     }
//   };

//   /* ================= TOTAL TIME ================= */

//   const totalTodaySeconds = todayTasks.reduce(
//     (sum, t) => sum + getLiveSeconds(t),
//     0
//   );

//   const showLiveControls = activeTab === "today" && hasAttendance;

//   /* ================= UI ================= */

//   return (
//     <div className="flex min-h-screen bg-gray-50">
//       <Sidebar
//         activeFilter={activeTab}
//         setActiveFilter={setActiveTab}
//         todayCount={todayTasks.length}
//         inProgressCount={inProgressTasks.length}
//         completedCount={completedTasks.length}
//       />

//       <main className="flex-1 p-6">
//         {!todayLog ? (
//           <div>Loading...</div>
//         ) : (
//           <>
//             <h2 className="text-3xl font-semibold text-blue-600 mb-6">
//               Employee Work Log
//             </h2>

//             {activeTab === "today" && hasAttendance && (
//               <AddTask
//                 workLogId={todayLog.id}
//                 onTaskAdded={(task) =>
//                   setTodayLog((prev) => ({
//                     ...prev,
//                     tasks: [...(prev.tasks || []), task],
//                   }))
//                 }
//               />
//             )}

//             <table className="w-full mt-6 bg-white shadow text-sm">
//               <thead className="bg-gray-100">
//                 <tr>
//                   {showLiveControls && (
//                     <th className="p-3 text-center">Done</th>
//                   )}
//                   <th className="p-3">Task</th>
//                   <th className="p-3">Project</th>
//                   <th className="p-3">Status</th>
//                   <th className="p-3">Date</th>
//                   <th className="p-3">Time</th>
//                   {showLiveControls && (
//                     <th className="p-3">Action</th>
//                   )}
//                 </tr>
//               </thead>

//               <tbody>
//                 {visibleTasks.map((task) => {
//                   const isCompleted = task.status === "completed";

//                   return (
//                     <tr
//                       key={`${task.task_id}-${task.createdAt}`}
//                       className="border-t"
//                     >
//                       {showLiveControls && (
//                         <td className="text-center">
//                           {isCompleted ? (
//                             <input type="checkbox" checked disabled />
//                           ) : (
//                             <input
//                               type="checkbox"
//                               onChange={() =>
//                                 completeTask(task.task_id)
//                               }
//                               disabled={pending}
//                             />
//                           )}
//                         </td>
//                       )}

//                       <td className="p-3">{task.task_title}</td>
//                       <td className="p-3">
//                         {task.project?.title || "—"}
//                       </td>
//                       <td className="p-3">{task.status}</td>
//                       <td className="p-3">
//                         {task.work_date ||
//                           task.createdAt?.slice(0, 10)}
//                       </td>
//                       <td className="p-3 font-mono">
//                         {formatHMS(
//                           isCompleted
//                             ? task.time_spent || 0
//                             : getLiveSeconds(task)
//                         )}
//                       </td>

//                       {showLiveControls && (
//                         <td className="p-3">
//                           {!isCompleted &&
//                             (task.is_running ? (
//                               <button
//                                 onClick={stopTask}
//                                 disabled={pending}
//                                 className="text-red-600"
//                               >
//                                 Stop
//                               </button>
//                             ) : (
//                               <button
//                                 onClick={() => startTask(task)}
//                                 disabled={pending}
//                                 className="text-blue-600"
//                               >
//                                 Start
//                               </button>
//                             ))}
//                         </td>
//                       )}
//                     </tr>
//                   );
//                 })}
//               </tbody>
//             </table>

//             {activeTab === "today" && hasAttendance && (
//               <div className="mt-4 font-semibold">
//                 ⏱ Today’s Total Time: {formatHMS(totalTodaySeconds)}
//               </div>
//             )}
//           </>
//         )}
//       </main>
//     </div>
//   );
// }

import { useEffect, useRef, useState } from "react";
import api from "./api";
import AddTask from "./addTask";
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
  if (!task.is_running || !task.last_started_at) {
    return task.time_spent || 0;
  }
  return (
    (task.time_spent || 0) +
    Math.floor((Date.now() - new Date(task.last_started_at)) / 1000)
  );
};

const todayDate = () => new Date().toISOString().slice(0, 10);

const isLunchBreak = () => {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const hour = now.getHours();
  return hour >= 13 && hour < 14; // 1 PM – 2 PM
};


/* ===== USER CACHE ===== */
const USER_CACHE_KEY = "attendance_user";

const saveUserToCache = (user) => {
  if (!user) return;

  localStorage.setItem(
    USER_CACHE_KEY,
    JSON.stringify({
      name: user.user_detial?.name || "",
      username: user.username || "",
      photo: user.user_detial?.Photo?.[0]?.url || "",
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

export default function AttendanceApp() {
  const [todayLog, setTodayLog] = useState(null);
  const [historyTasks, setHistoryTasks] = useState([]);
  const [activeTab, setActiveTab] = useState("today");
  const [, forceTick] = useState(0);
  const [cachedUser, setCachedUser] = useState(() => getUserFromCache());


  const initRef = useRef(false);

  /* ===== LIVE TIMER TICK ===== */
  useEffect(() => {
    const i = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  // in lunch task stop
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!isLunchBreak()) return;

      const hasRunning = todayLog?.tasks?.some(t => t.is_running);
      if (!hasRunning) return;

      try {
        const res = await api.get("/work-logs/today");
        setTodayLog(res.data.work_log);
      } catch (err) {
        console.error("Lunch break sync failed", err);
      }
    }, 30_000); // every 30 sec

    return () => clearInterval(interval);
  }, [todayLog?.id]);


  /* ===== LOAD DATA ===== */
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    api.get("/work-logs/today").then((res) => {
      const log = res.data.work_log;
      setTodayLog(log);

      if (log?.user) {
        saveUserToCache(log.user);
        setCachedUser(getUserFromCache());
      }
    });


    api.get("/work-logs/completed").then((res) =>
      setHistoryTasks(Array.isArray(res.data) ? res.data : [])
    );
  }, []);

  if (!todayLog) return null;

  /* ===== FILTERS (FIXED) ===== */

  const today = todayDate();

  // 🟠 TODAY TAB → only today's IN-PROGRESS
  const todayTasks = (todayLog.tasks || []).filter(
    (t) =>
      t.status === "in-progress" &&
      t.createdAt?.slice(0, 10) === today
  );

  // 🟢 COMPLETED TAB → only today's COMPLETED
  const completedTasks = (todayLog.tasks || []).filter(
    (t) =>
      t.status === "completed" &&
      t.createdAt?.slice(0, 10) === today
  );

  const visibleTasks =
    activeTab === "today" ? todayTasks : completedTasks;

  /* ===== RUNNING TASK ===== */
  const runningTask = todayTasks.find((t) => t.is_running);
  const runningSeconds = runningTask ? getLiveSeconds(runningTask) : 0;

  const totalTodaySeconds = (todayLog.tasks || [])
    .filter((t) => t.createdAt?.slice(0, 10) === today)
    .reduce((sum, t) => sum + getLiveSeconds(t), 0);


  /* ===== ACTIONS (FIXED UI UPDATE) ===== */

  const startTask = async (task) => {

    if (isLunchBreak()) {
      alert("Lunch break from 1–2 PM. Tasks cannot be started.");
      return;
    }
    const previousLog = todayLog;
    const now = new Date().toISOString();

    // 🚀 Optimistic UI update (CORRECT)
    setTodayLog((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => {
        // 🔴 Previously running task → SAVE ITS TIME
        if (t.is_running && t.task_id !== task.task_id) {
          return {
            ...t,
            is_running: false,
            time_spent: getLiveSeconds(t),
            last_started_at: null,
          };
        }

        // 🟢 New task → START
        if (t.task_id === task.task_id) {
          return {
            ...t,
            is_running: true,
            status: "in-progress",
            last_started_at: now,
          };
        }

        return t;
      }),
    }));

    try {
      await api.post("/work-logs/start-timer", {
        workLogId: todayLog.id,
        task_id: task.task_id,
      });
    } catch (err) {
      console.error("❌ Start failed → rollback", err);
      setTodayLog(previousLog);
      alert("Failed to start task. Please try again.");
    }
  };

  const stopTask = async () => {
    const previousLog = todayLog;

    // 🚀 Optimistic UI update
    setTodayLog((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.is_running
          ? {
            ...t,
            is_running: false,
            time_spent: getLiveSeconds(t),
            last_started_at: null,
          }
          : t
      ),
    }));

    try {
      await api.post("/work-logs/stop-timer", {
        workLogId: todayLog.id,
      });
    } catch (err) {
      console.error("❌ Stop failed → rollback", err);

      // 🔁 ROLLBACK UI
      setTodayLog(previousLog);

      alert("Failed to stop task. Please try again.");
    }
  };

  const completeTask = async (task) => {
    // 🔒 Optimistic UI update (instant)
    setTodayLog((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.task_id === task.task_id
          ? { ...t, status: "completed", is_running: false }
          : t
      ),
    }));

    // ⏸ Stop timer if running
    if (task.is_running) {
      await api.post("/work-logs/stop-timer", {
        workLogId: todayLog.id,
      });
    }

    // ✅ Persist to backend
    const res = await api.put(
      `/work-logs/${todayLog.id}/update-task`,
      {
        data: {
          task_id: task.task_id,
          status: "completed",
        },
      }
    );

    // 🔁 Final sync (authoritative state)
    if (res?.data) {
      setTodayLog(res.data);

      api.get("/work-logs/completed").then((r) =>
        setHistoryTasks(Array.isArray(r.data) ? r.data : [])
      );
    }
  };

  const handleLogout = async () => {
    try {
      // 🔴 If any task is running, stop it first
      const hasRunningTask = todayLog?.tasks?.some(t => t.is_running);

      if (hasRunningTask) {
        await api.post("/work-logs/stop-timer", {
          workLogId: todayLog.id,
        });
      }
    } catch (err) {
      console.error("❌ Failed to stop running task on logout", err);
    } finally {
      // 🧹 Clear local cache
      localStorage.removeItem("attendance_user");

      // 🔐 Logout (token/session clear)
      logout();

      // 🚪 Hard redirect to reset app state
      window.location.href = "/";
    }
  };

  const displayUser = todayLog?.user ? {
    name: todayLog.user.user_detial?.name,
    username: todayLog.user.username,
    photo: todayLog.user.user_detial?.Photo?.[0]?.url,
  }
    : cachedUser;


  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f3f3f3]">
      <div style={{ width: 680, height: 480 }}>
        <div className="bg-white rounded-2xl shadow h-full p-4 flex flex-col">

          {/* ===== BLACK BAR ===== */}
          <div
            className="bg-[#3E3A36] rounded-2xl px-6 flex items-center justify-between text-white mb-3"
            style={{ width: 648, height: 60 }}
          >
            <div>
              <div className="text-xs text-gray-300">Task</div>
              <div className="text-lg font-semibold">
                {runningTask?.task_title || "No task running"}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="font-mono text-lg">
                {formatHMS(runningSeconds)}
              </div>

              {runningTask && (
                <button
                  onClick={stopTask}
                  className="w-8 h-8 rounded-full bg-[#FF7300] flex items-center justify-center"
                >
                  ❚❚
                </button>
              )}
            </div>
          </div>

          {/* ===== USER STRIP ===== */}
          <div className="bg-white rounded-xl px-4 py-3 flex justify-between items-center mb-3 shadow-sm">
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
                    {(displayUser?.name ||
                      displayUser?.username ||
                      "US")
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                )}
              </div>


              {/* NAME + LOGOUT */}
              <div>
                <div className="text-sm font-semibold">
                  {displayUser?.name || displayUser?.username ||
                    "Employee"}
                </div>
                <div onClick={handleLogout} className="text-[13px] text-gray-400 cursor-pointer hover:underline">
                  Logout
                </div>
              </div>
            </div>

            <div className="text-sm">
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
            <div className="flex-1 overflow-hidden">

              {/* ADD TASK */}
              {activeTab === "today" && (
                <div className="mb-3" style={{ width: 491, height: 36 }}>
                  <AddTask
                    workLogId={todayLog.id}
                    onTaskAdded={(task, tempId) =>
                      setTodayLog((prev) => {
                        // ❌ rollback temp task
                        if (!task && tempId) {
                          return {
                            ...prev,
                            tasks: prev.tasks.filter(t => t.task_id !== tempId),
                          };
                        }

                        // 🔁 replace temp with real task
                        if (tempId) {
                          const tasks = prev.tasks.map(t =>
                            t.task_id === tempId ? task : t
                          );
                          return { ...prev, tasks };
                        }

                        // ➕ normal add
                        return {
                          ...prev,
                          tasks: [...prev.tasks, task],
                        };
                      })
                    }
                  />

                </div>
              )}

              {/* ORANGE DIVIDER */}
              <div className="w-[490] h-px bg-[#FF7300] mb-2" />

              {/* TABLE */}
              <div className="overflow-auto py-2  no-scrollbar" style={{ height: 260 }}>
                <table className="w-full bg-white rounded-xl text-sm">
                  <thead className="bg-gray-50">
                    <tr className="rounded-xl bg-[#F7F7F7]">
                      <th className="p-2"></th>
                      <th className="p-2 text-left text-md font-normal">Task</th>
                      <th className="p-2 text-md font-normal">Project</th>
                      <th className="p-2 text-md font-normal">Status</th>
                      <th className="p-2 text-md font-normal">Time</th>
                      <th className="p-2 text-md font-normal">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleTasks.map((task) => (
                      <tr
                        key={`${task.task_id}-${task.createdAt}`}
                        className="border-b"
                      >
                        <td className="p-2">
                          <div className="flex items-center justify-center h-full">
                            {task.status === "completed" ? (
                              // ✅ Completed (green)
                              <div className="w-4 h-4 bg-green-500 rounded flex items-center justify-center">
                                <span className="text-white text-[10px] font-bold leading-none">
                                  ✓
                                </span>
                              </div>
                            ) : (
                              // ⬜ In-progress (custom empty box)
                              <button
                                onClick={() => completeTask(task)}
                                className="w-4 h-4 border-2 border-gray-500 rounded-sm
                   flex items-center justify-center cursor-pointer"
                                aria-label="Complete task"
                              />
                            )}
                          </div>
                        </td>



                        <td className="p-2 text-sm">{task.task_title}</td>
                        <td className="p-2 text-sm">{task.project?.title || "—"}</td>

                        <td className="p-2">
                          <span
                            className={`inline-flex items-center justify-center
      px-2 py-1 rounded-full text-[12px]
      whitespace-nowrap leading-none
      ${task.status === "completed"
                                ? "bg-green-100 text-green-600"
                                : "bg-orange-100 text-orange-600"
                              }`}
                          >
                            {task.status}
                          </span>
                        </td>


                        <td className="p-2 font-mono">
                          {formatHMS(getLiveSeconds(task))}
                        </td>

                        <td className="p-2 text-center">
                          {task.status === "completed" ? (
                            <button
                              disabled
                              className="w-7 h-7 rounded-full text-gray-400 cursor-not-allowed"
                            >
                              ▶
                            </button>
                          ) : task.is_running ? (
                            <button
                              onClick={stopTask}
                              className="w-6 h-6 rounded-full bg-[#FF7300] text-white"
                            >
                              ❚❚
                            </button>
                          ) : (
                            <button
                              onClick={() => startTask(task)}
                              disabled={isLunchBreak()}
                              className={`w-7 h-7 rounded-full ${isLunchBreak() ? "opacity-40 cursor-not-allowed" : ""
                                }`}
                            >
                              ▶
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
