import api from "./api";

export const login = async (email, password) => {
  const res = await api.post("/auth/local", {
    identifier: email,
    password
  });

  localStorage.setItem("jwt", res.data.jwt);
  localStorage.setItem("user", JSON.stringify(res.data.user));
  return res.data.user;
};

export const getUser = () =>
  JSON.parse(localStorage.getItem("user"));

export const logout = () => localStorage.clear();
