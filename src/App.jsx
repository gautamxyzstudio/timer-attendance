import { useEffect, useState } from "react";
import { getUser, logout } from "./auth.js";
import Login from "./login.jsx";
import AttendanceApp from "./AttendanceApp.jsx";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On app load, check if user already logged in
    const u = getUser();
    setUser(u);
    setLoading(false);
  }, []);

  if (loading) {
    return <h2>Loading...</h2>;
  }

  // 🔐 NOT LOGGED IN → SHOW LOGIN
  if (!user) {
    return <Login onLogin={setUser} />;
  }

  // ✅ LOGGED IN → SHOW TIMER SCREEN
  return (
    <AttendanceApp
      user={user}
      onLogout={() => {
        logout();
        setUser(null);
      }}
    />
  );
}
