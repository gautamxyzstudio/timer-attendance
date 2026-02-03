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
  // 🚫 HARD STOP: frontend must NEVER invent time
  if (!task.is_running) return task.time_spent || 0;

  if (!task.last_started_at) return task.time_spent || 0;

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

export default function AttendanceApp({ onLogout }) {
  const [todayLog, setTodayLog] = useState(null);
  const [historyTasks, setHistoryTasks] = useState([]);
  const [activeTab, setActiveTab] = useState("today");
  const [, forceTick] = useState(0);
  const [cachedUser, setCachedUser] = useState(() => getUserFromCache());
  const lastRunningTaskRef = useRef(null);

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

      // if UI already shows no running task → do nothing
      const hasRunning = todayLog?.tasks?.some(t => t.is_running);
      if (!hasRunning) return;

      try {
        const res = await api.get("/work-logs/today");
        const backendLog = res.data.work_log;

        if (!backendLog) return;

        // 🔥 FORCE frontend to TRUST backend
        setTodayLog({
          ...backendLog,
          tasks: (backendLog.tasks || []).map(t => ({
            ...t,
            // ❗ if backend stopped it, frontend must stop it
            last_started_at: t.is_running ? t.last_started_at : null,
          })),
        });

        // 🔴 also stop Electron timer
        window.electronAPI?.setTaskRunning(false);
      } catch (err) {
        console.error("Lunch break sync failed", err);
      }
    }, 10_000); // ⬅ faster sync (10s is ideal)

    return () => clearInterval(interval);
  }, [todayLog?.id]);


  /* ===== LOAD DATA ===== */
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const loadToday = async () => {
      try {
        const res = await api.get("/work-logs/today");
        const log = res.data.work_log;

        if (log) {
          // 🔥 NORMALIZE TASK STATE (IMPORTANT)
          const normalizedLog = {
            ...log,
            tasks: (log.tasks || []).map(t => ({
              ...t,
              // 👇 if backend says stopped, frontend MUST stop
              last_started_at: t.is_running ? t.last_started_at : null,
            })),
          };

          setTodayLog(normalizedLog);

          if (log?.user) {
            saveUserToCache(log.user);
            setCachedUser(getUserFromCache());
          }

          // 🔴 Sync Electron immediately
          const hasRunning = normalizedLog.tasks?.some(t => t.is_running);
          window.electronAPI?.setTaskRunning(Boolean(hasRunning));
        }
      } catch (err) {
        console.error("Failed to load today worklog", err);
      }
    };

    const loadCompleted = async () => {
      try {
        const res = await api.get("/work-logs/completed");
        setHistoryTasks(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to load completed tasks", err);
      }
    };

    loadToday();
    loadCompleted();
  }, []);


  const isCheckedIn = Boolean(todayLog?.id);
  const isCheckedOut = Boolean(todayLog?.out);


  /* ===== SEND WORKLOG ID TO ELECTRON ===== */
  useEffect(() => {
    if (todayLog?.id) {
      console.log("📤 Sending workLogId to Electron:", todayLog.id);
      window.electronAPI?.setWorkLogId(todayLog.id);
    }
  }, [todayLog?.id]);


  /* ===== FILTERS (FIXED) ===== */

  const today = todayDate();

  // 🟠 TODAY TAB → only today's IN-PROGRESS
  const todayTasks = (todayLog?.tasks || []).filter(
    (t) =>
      t.status === "in-progress" &&
      t.createdAt?.slice(0, 10) === today
  );


  // 🟢 COMPLETED TAB → only today's COMPLETED
  const completedTasks = (todayLog?.tasks || []).filter(
    (t) =>
      t.status === "completed" &&
      t.createdAt?.slice(0, 10) === today
  );


  const visibleTasks =
    activeTab === "today" ? todayTasks : completedTasks;


  /* ===== RUNNING TASK ===== */
  const runningTask = todayTasks.find((t) => t.is_running);

  const runningSeconds = runningTask ? getLiveSeconds(runningTask) : 0;

  const totalTodaySeconds = (todayLog?.tasks || [])
    .filter((t) => t.createdAt?.slice(0, 10) === today)
    .reduce((sum, t) => sum + getLiveSeconds(t), 0);

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
      console.log("🛑 Electron requested FORCE STOP");

      // 1️⃣ Optimistically stop in UI
      setTodayLog((prev) => {
        if (!prev) return prev;

        return {
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
        };
      });

      // 2️⃣ Stop backend timer (authoritative)
      try {
        await api.post("/work-logs/stop-timer", {
          workLogId: todayLog?.id,
        });
      } catch (err) {
        console.error("❌ Backend stop failed (force-stop)", err);
      }

      // 3️⃣ Sync Electron state
      window.electronAPI?.setTaskRunning(false);
    };

    window.electronAPI.onForceStopTasks(handleForceStop);

    return () => {
      window.electronAPI.removeForceStopTasks?.(handleForceStop);
    };
  }, [todayLog]);

  /* ===== RESUME TASKS FROM ELECTRON ===== */
  useEffect(() => {
    if (!window.electronAPI?.onResumeTasks) return;

    const handleResume = async () => {
      console.log("▶️ Electron requested RESUME TASK");

      const taskId = lastRunningTaskRef.current;
      if (!taskId || !todayLog) return;

      const task = todayLog.tasks.find(t => t.task_id === taskId);
      if (!task) return;

      const now = new Date().toISOString();

      // 1️⃣ Optimistic UI resume
      setTodayLog((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.task_id === taskId
            ? {
              ...t,
              is_running: true,
              status: "in-progress",
              last_started_at: now,
            }
            : t
        ),
      }));

      // 2️⃣ Backend resume
      try {
        await api.post("/work-logs/start-timer", {
          workLogId: todayLog.id,
          task_id: taskId,
        });
      } catch (err) {
        console.error("❌ Resume failed", err);
      }

      // 3️⃣ Sync Electron state
      window.electronAPI?.setTaskRunning(true);
    };

    window.electronAPI.onResumeTasks(handleResume);

    return () => {
      window.electronAPI.removeResumeTasks?.(handleResume);
    };
  }, [todayLog]);

  useEffect(() => {
    if (runningTask) {
      lastRunningTaskRef.current = runningTask.task_id;
      console.log("💾 Saved last running task:", runningTask.task_id);
    }
  }, [runningTask]);


  /* ===== SYNC CHECKOUT FROM BACKEND ===== */
  useEffect(() => {
    if (!todayLog?.id) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.get("/work-logs/today");
        const backendLog = res.data.work_log;

        if (!backendLog) return;

        // 🔥 ALWAYS trust backend
        setTodayLog(prev => {
          // prevent useless re-render
          if (JSON.stringify(prev?.tasks) === JSON.stringify(backendLog.tasks)) {
            return prev;
          }

          return {
            ...backendLog,
            tasks: (backendLog.tasks || []).map(t => ({
              ...t,
              last_started_at: t.is_running ? t.last_started_at : null,
            })),
          };
        });

        // 🔴 Electron must follow backend
        const hasRunning = backendLog.tasks?.some(t => t.is_running);
        window.electronAPI?.setTaskRunning(Boolean(hasRunning));
      } catch (err) {
        console.error("🔴 Worklog sync failed", err);
      }
    }, 3000); // ⬅ 3 seconds (ideal)

    return () => clearInterval(interval);
  }, [todayLog?.id]);


  if (!todayLog) return null;


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

    // 🔴 TELL ELECTRON IMMEDIATELY
    window.electronAPI?.setTaskRunning(false);

    try {
      await api.post("/work-logs/stop-timer", {
        workLogId: todayLog.id,
      });
    } catch (err) {
      console.error("❌ Stop failed → rollback", err);
      setTodayLog(previousLog);
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
        window.electronAPI?.setTaskRunning(false);
      }
    } catch (err) {
      console.error("❌ Failed to stop running task on logout", err);
    } finally {
      // 🧹 Clear local cache
      localStorage.removeItem("attendance_user");

      // 🔐 Logout (token/session clear)
      logout();

      onLogout();
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
        <div className="bg-[#F7F7F7] rounded-2xl shadow h-full p-4 flex flex-col">

          {/* ===== BLACK BAR ===== */}
          <div
            className="bg-[#3E3A36] rounded-2xl px-6 flex items-center justify-between text-white mb-3"
            style={{ width: 648, height: 60 }}
          >
            <div>
              <div className="text-xs text-gray-300">Task</div>
              <div className="text-sm">
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
                <div className="text-sm font-medium">
                  {displayUser?.name || displayUser?.username ||
                    "Employee"}
                </div>
                <div onClick={handleLogout} className="text-xs text-gray-400 cursor-pointer hover:underline">
                  Logout
                </div>
              </div>
            </div>

            <div className="text-[13px]">
              Worked Today:{" "}
              <span className=" font-semibold">
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
            <div style={{ width: 515 }} className="flex-1 overflow-hidden pt-2 bg-white rounded-xl shadow-sm">

              {/* ADD TASK */}
              {activeTab === "today" && isCheckedIn && !isCheckedOut && (
                <div className="mb-3 px-3" style={{ width: 491, height: 36 }}>
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
              {activeTab === "today" && isCheckedIn && !isCheckedOut && (
                <div className="w-[490] h-px bg-[#FF7300] mb-2" />
              )}

              {/* TABLE */}
              <div className="overflow-auto py-2 mx-3 no-scrollbar" style={{ height: 260 }}>

                {!isCheckedIn ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="text-lg font-semibold text-[#FF7300]">
                      You have not checked in today
                    </div>
                    <div className="text-sm text-gray-500 mt-2">
                      Please check in to start tracking your tasks and time
                    </div>
                  </div>
                ) : isCheckedOut ? (
                  /* ✅ CHECKED OUT */
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="text-lg font-semibold text-[#FF7300]">
                      ✅ All done for today
                    </div>
                    <div className="text-sm text-gray-500 mt-2">
                      See you tomorrow 👋
                    </div>
                  </div>
                ) : (

                  <table className="w-full bg-white rounded-xl text-sm">
                    <thead className="bg-gray-50">
                      <tr className="rounded-xl bg-[#F7F7F7]">
                        {/* Done */}
                        <th className="p-2 w-10"></th>

                        {/* Task (ALWAYS visible) */}
                        <th className="p-2 text-left text-md font-normal">Task</th>

                        {/* Completed-only columns */}
                        {activeTab === "completed" && (
                          <th className="p-2 text-md font-normal">Project</th>
                        )}

                        {activeTab === "completed" && (
                          <th className="p-2 text-md font-normal">Status</th>
                        )}

                        {/* Time (ALWAYS visible) */}
                        <th className="p-2 text-md text-left font-normal">Time</th>

                        {/* Action (TODAY only) */}
                        {activeTab !== "completed" && (
                          <th className="p-2 text-md font-normal">Action</th>
                        )}
                      </tr>

                    </thead>

                    <tbody className="text-sm">
                      {visibleTasks.map((task) => (
                        <tr
                          key={`${task.task_id}-${task.createdAt}`}
                          className="border-b h-12"
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
                                  disabled={task.task_key === "DAILY_MEETING"}
                                  onClick={() => completeTask(task)}
                                  className={`w-4 h-4 border-2 rounded-sm flex items-center justify-center
    ${task.task_key === "DAILY_MEETING"
                                      ? "border-gray-300 cursor-not-allowed opacity-40"
                                      : "border-gray-500 cursor-pointer"
                                    }`}
                                  aria-label="Complete task"
                                />

                              )}
                            </div>
                          </td>



                          <td
                            className={`p-2 text-sm ${task.is_running ? "text-green-500" : "text-gray-800"
                              }`}
                          >
                            {task.task_title}
                          </td>
                          {activeTab === "completed" && (
                            <td className="p-2 text-13px[]">
                              {task.project?.title || "—"}
                            </td>
                          )}

                          {activeTab === "completed" && (
                            <td className="p-2">
                              <span
                                className={`inline-flex items-center justify-center
        px-2 py-1 pb-2 rounded-lg text-[12px]
        whitespace-nowrap leading-none
        ${task.status === "completed"
                                    ? "bg-green-100 text-green-600"
                                    : "bg-orange-100 text-orange-600"
                                  }`}
                              >
                                {task.status}
                              </span>
                            </td>
                          )}


                          <td className="p-2 font-mono">
                            <span
                              className={`inline-block px-2 py-1 rounded-md text-sm ${task.is_running
                                ? "bg-green-100 text-green-500"
                                : "bg-transparent text-gray-800"
                                }`}
                            >
                              {formatHMS(getLiveSeconds(task))}
                            </span>
                          </td>


                          {activeTab !== "completed" && (
                            <td className="p-2 text-center">
                              {task.is_running ? (
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
                                  className={`w-6 h-6 text-gray-50 bg-[#797571] rounded-full ${isLunchBreak() ? "opacity-40 cursor-not-allowed" : ""
                                    }`}
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
