import api from "./api";

export const login = async (email, password) => {
  try {
    const res = await api.post("/auth/local", {
      identifier: email,
      password,
    });

    localStorage.setItem("jwt", res.data.jwt);
    localStorage.setItem("user", JSON.stringify(res.data.user));
    return res.data.user;
  } catch (err) {
  const message =
    err?.response?.data?.error?.message ||
    "Invalid email or password";

  throw new Error(message);
}

};

export const getUser = () =>
  JSON.parse(localStorage.getItem("user"));

export const logout = () => localStorage.clear();
