// import { useEffect, useState } from "react";
// import { getUser, logout } from "./auth.js";
// import Login from "./login.jsx";
// import AttendanceApp from "./AttendanceApp.jsx";

// export default function App() {
//   const [user, setUser] = useState(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     // On app load, check if user already logged in
//     const u = getUser();
//     setUser(u);
//     setLoading(false);
//   }, []);

//   if (loading) {
//     return <h2>Loading...</h2>;
//   }

//   // 🔐 NOT LOGGED IN → SHOW LOGIN
//   if (!user) {
//     return <Login onLogin={setUser} />;
//   }

//   // ✅ LOGGED IN → SHOW TIMER SCREEN
//   return (

//     <>
    
//     <AttendanceApp
//       user={user}
//       onLogout={() => {
//         logout();
//         setUser(null);
//       }}
//     />

//     </>
//   );
// }

import { useEffect, useState } from "react";
import { getUser, logout } from "./auth.js";
import Login from "./login.jsx";
import AttendanceApp from "./AttendanceApp.jsx";
import Nav from "./navbar.jsx";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🔁 controls what screen is shown
  const [view, setView] = useState("home"); // "home" | others later

  useEffect(() => {
    const u = getUser();
    setUser(u);
    setLoading(false);
  }, []);

  if (loading) return <h2 className="p-4">Loading...</h2>;

  if (!user) return <Login onLogin={setUser} />;

  return (
   <div className="h-screen">
    <Nav
      user={user}
      onHome={() => setView("home")}
      onAddTask={() => console.log("Add Task")}
      onLogout={() => {
        logout();
        setUser(null);
      }}
    />

    {/* CONTENT */}
    <div className="pt-14 px-6">
      {view === "home" && <AttendanceApp user={user} />}
    </div>
  </div>  
  );
}
