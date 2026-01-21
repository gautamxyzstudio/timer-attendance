import { useEffect, useRef, useState } from "react";
import { getUser, logout } from "./auth.js";
import Login from "./login.jsx";
import AttendanceApp from "./AttendanceApp.jsx";
import Nav from "./navbar.jsx";
import HrTimeline from "./HrTimeline.jsx";


export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // reference to AttendanceApp safe logout
  const logoutRef = useRef(null);

  useEffect(() => {
    const u = getUser();
    setUser(u);
    setLoading(false);
  }, []);

  if (loading) {
    return <h2 className="p-4">Loading...</h2>;
  }

  // 🔐 NOT LOGGED IN
  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div className="h-screen">
      {/* NAVBAR */}
      <Nav
        user={user}
        onHome={() => {}}
        onAddTask={() => console.log("Add Task")}
        onLogout={() => {
          // 🔥 THIS IS THE KEY LINE
          if (logoutRef.current) {
            logoutRef.current(); // calls AttendanceApp.safeLogout()
          }
        }}
      />

      {/* CONTENT */}
     <div className="pt-14 px-6">
  {user.user_type === "Hr" ? (
    <HrTimeline />
  ) : (
    <AttendanceApp
      user={user}
      registerLogoutHandler={(fn) => {
        logoutRef.current = fn;
      }}
      onLogout={() => {
        logout();
        setUser(null);
      }}
    />
  )}
</div>

    </div>
  );
}
