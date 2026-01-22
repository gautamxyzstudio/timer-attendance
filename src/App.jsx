import { useEffect, useRef, useState } from "react";
import { getUser, logout } from "./auth";
import Login from "./login";
import AttendanceApp from "./AttendanceApp";
import Nav from "./navbar";
import HrTimeline from "./HrTimeline";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const logoutRef = useRef(null);

  useEffect(() => {
    setUser(getUser());
    setLoading(false);
  }, []);

  if (loading) return <div>Loading...</div>;

  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="h-screen">
      <Nav
        username={user.username}
        onLogout={() => {
          if (logoutRef.current) {
            logoutRef.current(); // SAFE logout
          }
        }}
      />

      <div className="pt-14 px-6">
        {user.user_type === "Hr" ? (
          <HrTimeline />
        ) : (
          <AttendanceApp
            onLogout={() => {
              logout();
              setUser(null);
            }}
            registerLogoutHandler={(fn) => {
              logoutRef.current = fn;
            }}
          />
        )}
      </div>
    </div>
  );
}
