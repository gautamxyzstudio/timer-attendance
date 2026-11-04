import api from "./api";

export const USER_CACHE_KEY = "attendance_user";

const formatPhotoUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  const prefix = "https://xyzportal.thexyzstudio.com";
  return trimmed.startsWith("/") ? `${prefix}${trimmed}` : `${prefix}/${trimmed}`;
};

export const extractUserPhoto = (u) => {
  if (!u) return "";

  // 1. Direct photo / Photo property if string
  if (typeof u.photo === "string" && u.photo.trim()) {
    return formatPhotoUrl(u.photo);
  }
  if (typeof u.Photo === "string" && u.Photo.trim()) {
    return formatPhotoUrl(u.Photo);
  }

  // 2. Photo array or object at root
  const rootPhoto = Array.isArray(u.Photo)
    ? u.Photo[0]
    : Array.isArray(u.photo)
    ? u.photo[0]
    : (u.Photo || u.photo);

  if (rootPhoto) {
    if (typeof rootPhoto === "string") return formatPhotoUrl(rootPhoto);
    if (typeof rootPhoto?.url === "string") return formatPhotoUrl(rootPhoto.url);
    if (typeof rootPhoto?.formats?.thumbnail?.url === "string") {
      return formatPhotoUrl(rootPhoto.formats.thumbnail.url);
    }
    if (typeof rootPhoto?.formats?.small?.url === "string") {
      return formatPhotoUrl(rootPhoto.formats.small.url);
    }
  }

  // 3. user_detial or user_detail
  const detail =
    u.user_detial ||
    u.user_detail ||
    u.attributes?.user_detial ||
    u.attributes?.user_detail;

  if (detail) {
    if (typeof detail.photo === "string" && detail.photo.trim()) {
      return formatPhotoUrl(detail.photo);
    }
    if (typeof detail.Photo === "string" && detail.Photo.trim()) {
      return formatPhotoUrl(detail.Photo);
    }

    const detailPhoto = Array.isArray(detail.Photo)
      ? detail.Photo[0]
      : Array.isArray(detail.photo)
      ? detail.photo[0]
      : (detail.Photo || detail.photo);

    if (detailPhoto) {
      if (typeof detailPhoto === "string") return formatPhotoUrl(detailPhoto);
      if (typeof detailPhoto?.url === "string") return formatPhotoUrl(detailPhoto.url);
      if (typeof detailPhoto?.formats?.thumbnail?.url === "string") {
        return formatPhotoUrl(detailPhoto.formats.thumbnail.url);
      }
      if (typeof detailPhoto?.formats?.small?.url === "string") {
        return formatPhotoUrl(detailPhoto.formats.small.url);
      }
    }
  }

  // 4. Strapi v4 data / attributes structure
  const v4Url =
    u.attributes?.Photo?.data?.attributes?.url ||
    u.Photo?.data?.attributes?.url ||
    detail?.Photo?.data?.attributes?.url;
  if (typeof v4Url === "string") {
    return formatPhotoUrl(v4Url);
  }

  return "";
};

export const extractUserName = (u) => {
  if (!u) return { name: "", username: "" };
  const detail =
    u.user_detial ||
    u.user_detail ||
    u.attributes?.user_detial ||
    u.attributes?.user_detail ||
    {};

  const name =
    u.name ||
    detail.name ||
    u.fullName ||
    detail.fullName ||
    u.username ||
    detail.username ||
    "";

  const username =
    u.username ||
    detail.username ||
    u.name ||
    detail.name ||
    "";

  return { name, username };
};

export const saveUserToCache = (user) => {
  if (!user) return null;
  const { name, username } = extractUserName(user);
  const photo =
    extractUserPhoto(user) ||
    (typeof user.photo === "string" ? formatPhotoUrl(user.photo) : "");

  const cached = {
    id: user.id,
    name: name || user.name || "",
    username: username || user.username || "",
    photo: photo,
  };
  localStorage.setItem(USER_CACHE_KEY, JSON.stringify(cached));
  return cached;
};

export const getUserFromCache = () => {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed) return parsed;
    }
    const authUser = getUser();
    if (authUser) {
      const { name, username } = extractUserName(authUser);
      const photo = extractUserPhoto(authUser);
      return {
        id: authUser.id,
        name: name || authUser.username || "",
        username: username || authUser.username || "",
        photo: photo || "",
      };
    }
    return null;
  } catch {
    return null;
  }
};

export const fetchUserProfile = async (userId) => {
  if (!userId) return null;
  try {
    const res = await api.get(`/user/${userId}`);
    const rawData = res.data?.data || res.data?.user || res.data;
    if (!rawData) return null;

    const { name, username } = extractUserName(rawData);
    const photo = extractUserPhoto(rawData);

    const profile = {
      id: rawData.id || userId,
      name: name || username || "",
      username: username || name || "",
      photo: photo || "",
    };

    saveUserToCache(profile);
    return profile;
  } catch (err) {
    console.error("Failed to fetch user profile for ID", userId, err);
    return null;
  }
};

export const login = async (email, password) => {
  try {
    const res = await api.post("/auth/local", {
      identifier: email,
      password,
    });

    const jwt = res.data.jwt;
    const authUser = res.data.user;

    localStorage.setItem("jwt", jwt);
    localStorage.setItem("user", JSON.stringify(authUser));

    // Fetch full user profile by ID from /user/:id (e.g. /user/79)
    if (authUser?.id) {
      try {
        const profile = await fetchUserProfile(authUser.id);
        if (profile) {
          const merged = { ...authUser, ...profile };
          localStorage.setItem("user", JSON.stringify(merged));
          return merged;
        }
      } catch (profileErr) {
        console.warn("Could not fetch user profile details on login:", profileErr);
      }
    }

    return res.data.user;
  } catch (err) {
    const message =
      err?.response?.data?.error?.message ||
      "Invalid email or password";

    throw new Error(message);
  }
};

export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
};

export const logout = () => {
  localStorage.removeItem(USER_CACHE_KEY);
  localStorage.clear();
};
