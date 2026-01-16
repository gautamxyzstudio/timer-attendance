import { login } from "./auth";

export default function Login({ onLogin }) {
  return (
    <div>
      <h2>Login</h2>
      <input id="email" />
      <input id="pass" type="password" />
      <button onClick={async () => {
        const user = await login(
          document.getElementById("email").value,
          document.getElementById("pass").value
        );
        onLogin(user);
      }}>
        Login
      </button>
    </div>
  );
}
