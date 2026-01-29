import { useState } from "react";
import { login } from "./auth";
import logo from "./assets/xyzLogo.webp";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // NEW
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    const user = await login(email, password);

    // you can use rememberMe later if needed
    onLogin(user);
  };

  return (
    <div className="w-screen h-screen bg-gray-300 flex items-center justify-center">
      <div style={{ width: "680px", height: "480px" }}
    className="flex items-center justify-center bg-[#F3F4F6] ">
      <div
        className="bg-white rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.12)] box-border"
        style={{ width: "372px", height: "352px", padding: "24px 28px" }}
      >

        {/* Logo */}
        <div className="flex justify-center mb-3">
          <img src={logo} alt="X Studio" className="h-6" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-medium text-center text-[#797571]">
          Welcome
        </h1>
        <p className="text-xs text-[#797571] text-center mb-5">
          Log in to your account
        </p>

        {/* Email */}
        <div className="mb-5">
          <input
            type="email"
            placeholder="Enter your email"
            className="w-full h-10 px-4 border border-[#D6D4D2] rounded-xl bg-[#F7F7F6] text-sm outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {/* Password */}
        <div className="mb-4">

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="w-full h-10 px-4 pr-10 border border-[#D6D4D2] rounded-xl bg-[#F7F7F6] text-sm outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {/* Eye icon */}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#797571] hover:text-black"
            >
              {showPassword ? (
                /* Eye Off */
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 0-1.014.151-1.99.432-2.91M6.225 6.225A9.956 9.956 0 0112 5c5.523 0 10 4.477 10 10 0 1.61-.381 3.13-1.056 4.475M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <line
                    x1="3"
                    y1="3"
                    x2="21"
                    y2="21"
                    stroke="currentColor"
                    strokeWidth={2}
                  />
                </svg>
              ) : (
                /* Eye */
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Remember me */}
        <div className="flex items-center mb-4">
          <input
            type="checkbox"
            id="rememberMe"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="mr-2"
          />
          <label htmlFor="rememberMe" className="text-sm text-[#797571]">
            Keep me logged in
          </label>
        </div>

        {/* Login Button */}
        <div className="flex justify-center">
          <button
            onClick={handleLogin}
            className="w-80 h-10 bg-[#E47A0E] text-white text-sm font-medium rounded-xl hover:bg-[#d96f0c] transition"
          >
            Login
          </button>
        </div>

      </div>
      </div>
    </div>
  );
}
