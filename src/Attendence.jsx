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

// show join button from 1:45 PM
const canShowJoinButton = () => {
  const mins = getNowMinutes();
  return mins >= (13 * 60 + 45); // 1:45 PM
};

// enable join button only after 2:00 PM
const canEnableJoinButton = () => {
  const mins = getNowMinutes();
  return mins >= (14 * 60); // 2:00 PM
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
  useEffect(() => {
    if (!attendance) return;

    if (!attendance.is_checked_in || !attendance.checkin_started_at) {
      setSeconds(attendance.attendance_seconds || 0);
      return;
    }

    // Freeze during lunch
    if (isLunchTime()) {
      setSeconds(attendance.attendance_seconds || 0);
      return;
    }

    const startedAt = new Date(attendance.checkin_started_at).getTime();
    if (isNaN(startedAt)) return;

    const baseSeconds = attendance.attendance_seconds || 0;
    const liveSeconds = Math.floor((Date.now() - startedAt) / 1000);

    setSeconds(baseSeconds + Math.max(0, liveSeconds));
  }, [
    tick,
    attendance?.attendance_seconds,
    attendance?.checkin_started_at,
    attendance?.is_checked_in
  ]);

  /* ================= ACTIONS ================= */

  const nowHHMM = new Date().toTimeString().slice(0, 5);
  const hasCheckedInToday = Boolean(attendance?.in);

  const handleCheckIn = async () => {
    setAttendance({
      in: nowHHMM,
      is_checked_in: true,
      checkin_started_at: new Date().toISOString(),
      attendance_seconds: attendance?.attendance_seconds || 0
    });

    await api.post("/daily-attendance/check-in", {
      data: { in: nowHHMM }
    });
  };

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

    {!attendance?.is_checked_in && canShowJoinButton() && (
  <button
    onClick={handleCheckIn}
    disabled={!canEnableJoinButton()}
    style={{
      opacity: canEnableJoinButton() ? 1 : 0.5,
      cursor: canEnableJoinButton() ? "pointer" : "not-allowed"
    }}
  >
    {canEnableJoinButton()
      ? "Join"
      : "Join available at 2:00 PM"}
  </button>
)}

      {attendance?.is_checked_in && (
        <button onClick={handleCheckOut}>Check Out</button>
      )}
    </div>
  );
}