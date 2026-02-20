import axios from "axios";

// In dev, if API is external (AWS etc.), use /api so Vite proxy avoids CORS (no env flag needed)
const envBase = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
const isDevExternal =
  import.meta.env.DEV &&
  envBase &&
  (envBase.includes("amazonaws.com") || envBase.startsWith("https://"));
const API_BASE_FOR_REQUESTS = isDevExternal ? "/api" : envBase;

export const API_BASE_URL = API_BASE_FOR_REQUESTS;
export const api = axios.create({
  baseURL: API_BASE_FOR_REQUESTS,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach auth token to every request when user is logged in
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// --- Register ---
export const registerUser = async (userData) => {
  const response = await api.post("/auth/register", userData);
  return response.data;
};

// --- Login ---
export const loginUser = async (credentials) => {
  const response = await api.post("/auth/login", credentials);
  return response.data;
};

// --- Get User Infor ---
export const getCurrentUser = async (token) => {
  const response = await axios.get(`${API_BASE_FOR_REQUESTS}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};
