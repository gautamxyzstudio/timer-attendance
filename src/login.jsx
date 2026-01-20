import { useState } from "react";
import { login } from "./auth";
import logo from "./assets/xyzLogo.webp";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    const user = await login(email, password);
    onLogin(user);
  };

  return (
    <div className="w-screen h-screen bg-[#f3f3f3] flex items-center justify-center">
      <div className="bg-white w-xl px-14 py-10 rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.12)]">

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src={logo} alt="X Studio" className="h-11" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-medium text-center text-[#797571]">
          Welcome
        </h1>
        <p className="text-sm text-[#797571] text-center mb-8">
          Log in to your account
        </p>

        {/* Email */}
        <div className="mb-5">
          <label className="block text-md text-black mb-1">
            Email
          </label>
          <input
            type="email"
            placeholder="Enter your email"
            className="w-full h-11 px-4 border border-[#D6D4D2] rounded-xl bg-[#F7F7F6] text-md outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {/* Password */}
        <div className="mb-8">
          <label className="block text-md text-black mb-1">
            Password
          </label>
          <input
            type="password"
            placeholder="Password"
            className="w-full h-11 px-4 border border-[#D6D4D2] rounded-xl bg-[#F7F7F6] text-md outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {/* Button */}
        <div className="flex justify-center">
   <button
  onClick={handleLogin}
  className=" w-32 h-10 bg-[#E47A0E] text-white text-md font-medium rounded-xl hover:bg-[#d96f0c] transition">
  Login
</button>

        </div>

      </div>
    </div>
  );
}
