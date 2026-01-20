import { useEffect, useState } from "react";
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

// 🟡 Lunch break: 1:00 – 2:00 PM
const isLunchTime = () => {
  const mins = getNowMinutes();
  return mins >= 13 * 60 && mins < 14 * 60;
};

// 👀 Show Join button from 1:45 PM
const canShowResumeButton = () => {
  const mins = getNowMinutes();
  return mins >= (13 * 60 + 45); // 1:45 PM
};

// ✅ Enable Join only after 2:00 PM
const canEnableResume = () => {
  const mins = getNowMinutes();
  return mins >= 14 * 60; // 2:00 PM
};

const getUserIdFromToken = () => {
  try {
    const token = localStorage.getItem("jwt");
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload?.id || null;
  } catch {
    return null;
  }
};

/* ================= COMPONENT ================= */

export default function Attendance() {
  const [attendance, setAttendance] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [tick, setTick] = useState(0);

  /* ⏱ global tick */
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  /* 📥 Load today attendance */
  const loadTodayAttendance = async () => {
    const userId = getUserIdFromToken();
    if (!userId) return;

    const res = await api.get(`/daily-attendance/today/${userId}`);
    setAttendance(Array.isArray(res.data) ? res.data[0] : null);
  };

  useEffect(() => {
    loadTodayAttendance();
  }, []);

  /* ⏱ Attendance timer */
 const isSameDay = (dateStr) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
};

useEffect(() => {
  if (!attendance) return;

  // ❌ Not checked in OR bad timestamp → show stored time only
  if (
    !attendance.is_checked_in ||
    !attendance.checkin_started_at ||
    !isSameDay(attendance.checkin_started_at)
  ) {
    setSeconds(attendance.attendance_seconds || 0);
    return;
  }

  // ⛔ Lunch pause
  if (isLunchTime()) {
    setSeconds(attendance.attendance_seconds || 0);
    return;
  }

  const startedAt = new Date(attendance.checkin_started_at).getTime();
  const now = Date.now();

  if (isNaN(startedAt) || now < startedAt) {
    setSeconds(attendance.attendance_seconds || 0);
    return;
  }

  const liveSeconds = Math.floor((now - startedAt) / 1000);

  setSeconds(
    (attendance.attendance_seconds || 0) + liveSeconds
  );
}, [
  tick,
  attendance?.attendance_seconds,
  attendance?.checkin_started_at,
  attendance?.is_checked_in
]);

  /* ================= ACTIONS ================= */

  const nowHHMM = new Date().toTimeString().slice(0, 5);

  // 🌅 Morning Check-in
  const handleCheckIn = async () => {
    setAttendance({
      ...attendance,
      in: nowHHMM,
      is_checked_in: true,
      checkin_started_at: new Date().toISOString()
    });

    await api.post("/daily-attendance/check-in", {
      data: { in: nowHHMM }
    });
  };

  // 🌤 Resume after lunch (NO new entry)
  const handleResumeAfterLunch = async () => {
    setAttendance((prev) => ({
      ...prev,
      is_checked_in: true,
      checkin_started_at: new Date().toISOString()
    }));

    await api.post("/daily-attendance/resume-after-lunch");
  };

  // 🌙 Check out
  const handleCheckOut = async () => {
    setAttendance((prev) => ({
      ...prev,
      is_checked_in: false,
      out: nowHHMM,
      attendance_seconds: seconds
    }));

    await api.post("/daily-attendance/check-out", {
      data: { out: nowHHMM }
    });
  };

  /* ================= UI ================= */

  return (
    <div style={{ border: "1px solid #ccc", padding: 16, width: 320 }}>
      <h3>Attendance</h3>

      <div style={{ fontSize: 26, fontWeight: "bold" }}>
        {formatHMS(seconds)}
      </div>

      {/* 🟢 Morning Check-in */}
      {!attendance?.in && !attendance?.is_checked_in && (
        <button onClick={handleCheckIn}>
          Check In
        </button>
      )}

      {/* 🟡 Join / Resume after lunch */}
      {attendance?.in &&
        !attendance?.out &&
        !attendance?.is_checked_in &&
        canShowResumeButton() && (
          <button
            onClick={handleResumeAfterLunch}
            disabled={!canEnableResume()}
            style={{
              opacity: !canEnableResume() ? 0.5 : 1,
              cursor: !canEnableResume()
                ? "not-allowed"
                : "pointer"
            }}
          >
            {canEnableResume()
              ? "Resume Work"
              : "Join available at 2:00 PM"}
          </button>
        )}

      {/* 🔴 Check out */}
      {attendance?.is_checked_in && (
        <button onClick={handleCheckOut}>
          Check Out
        </button>
      )}
    </div>
  );
}
