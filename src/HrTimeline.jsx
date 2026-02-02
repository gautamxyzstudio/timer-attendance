import { useEffect, useState } from "react";
import api from "./api.js";

/* ================= OFFICE HOURS ================= */
const START_HOUR = 9;
const END_HOUR = 22;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;

/* ================= IST DATE ================= */
const getTodayISTDate = () =>
  new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

/* ================= TIME HELPERS ================= */

// ✅ NEW: Convert ISO (UTC) → IST Date
const toISTDate = (iso) =>
  new Date(
    new Date(iso).toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
    })
  );

// Build TODAY 9:00 AM IST anchor
const getDayStartIST = () => {
  const d = getTodayISTDate();
  d.setHours(START_HOUR, 0, 0, 0);
  return d;
};

// ✅ FIXED: Minutes since 9:00 AM IST (NO TIMEZONE MIX)
const minutesSinceStart = (iso) => {
  const startOfDay = getDayStartIST();
  const eventTime = toISTDate(iso); // 👈 FIX IS HERE

  return Math.max(
    0,
    Math.floor((eventTime - startOfDay) / 60000)
  );
};

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

const leftPercent = (start) =>
  (clamp(minutesSinceStart(start), 0, TOTAL_MINUTES) /
    TOTAL_MINUTES) *
  100;

const widthPercent = (start, end) => {
  const s = minutesSinceStart(start);
  const e = minutesSinceStart(end);
  return Math.max(0, ((e - s) / TOTAL_MINUTES) * 100);
};

const secondsBetween = (a, b) =>
  Math.max(0, Math.floor((new Date(b) - new Date(a)) / 1000));

const formatHMS = (sec = 0) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

/* ================= COMPONENT ================= */

export default function HrTimeline() {
  const [logs, setLogs] = useState([]);
  const [, tick] = useState(0);

  const load = async () => {
    const d = getTodayISTDate();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");

    const today = `${yyyy}-${mm}-${dd}`;

    const res = await api.get(
      `/work-logs/userWorkLogs?startDate=${today}&endDate=${today}`
    );
    setLogs(res.data.work_logs || []);
  };

  useEffect(() => {
    load();
    const poll = setInterval(load, 5000);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  /* ===== GROUP BY USER ===== */
  const users = {};

  logs.forEach((log) => {
    if (!log.user) return;
    if (!users[log.user.id]) {
      users[log.user.id] = { user: log.user, tasks: [] };
    }

    (log.tasks || []).forEach((task) => {
      users[log.user.id].tasks.push({
        title: task.task_title,
        time_spent: task.time_spent || 0,
        sessions: (task.work_sessions || []).filter((s) => s.start),
      });
    });
  });

  return (
    <div className="p-6 bg-slate-100 mx-0 min-h-screen">
      <div className="bg-white rounded-xl p-6 space-y-6">
        <h2 className="text-2xl font-semibold">
          HR – Employee Task Timeline
        </h2>

        {/* TIME HEADER */}
        <div className="ml-[360px] flex justify-between text-xs text-gray-500">
          {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => (
            <div key={i}>{START_HOUR + i}:00</div>
          ))}
        </div>

        {Object.values(users).map(({ user, tasks }) => (
          <div key={user.id} className="border rounded-lg">
            <div className="px-5 py-3 bg-slate-50 border-b">
              <div className="font-semibold">{user.username}</div>
              <div className="text-xs text-gray-400">Employee</div>
            </div>

            <table className="w-full table-fixed border-collapse">
              <thead className="bg-slate-100 text-sm">
                <tr>
                  <th className="px-5 py-2 w-[360px] text-left">Task</th>
                  <th className="px-5 py-2 w-full text-left">Timeline</th>
                  <th className="px-5 py-2 w-[120px] text-right">Total</th>
                </tr>
              </thead>

              <tbody>
                {tasks.map((task, i) => {
                  const now = new Date().toISOString();
                  let totalSeconds = task.time_spent;

                  const running = task.sessions.find((s) => !s.end);
                  if (running) {
                    totalSeconds += secondsBetween(running.start, now);
                  }

                  return (
                    <tr key={i} className="border-t">
                      <td className="px-5 py-4 text-sm truncate">
                        {task.title}
                      </td>

                      <td className="px-5 py-4">
                        <div className="relative h-6 rounded w-full">
                          {task.sessions.map((s, si) => {
                            const end = s.end || now;
                            return (
                              <div
                                key={si}
                                className={`absolute top-1 h-4 rounded ${
                                  s.end ? "bg-blue-500" : "bg-emerald-500"
                                }`}
                                style={{
                                  left: `${leftPercent(s.start)}%`,
                                  width: `${Math.max(
                                    widthPercent(s.start, end),
                                    1
                                  )}%`,
                                }}
                              />
                            );
                          })}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-right font-mono text-sm">
                        {formatHMS(totalSeconds)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
