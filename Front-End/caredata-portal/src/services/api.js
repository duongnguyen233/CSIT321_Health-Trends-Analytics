import axios from "axios";
import { fetchAuthSession } from "aws-amplify/auth";
import { isCognitoEnabled } from "../config/amplify";

// In dev, if API is external (AWS etc.), use /api so Vite proxy avoids CORS (no env flag needed)
const envBase = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
const isDevExternal =
  import.meta.env.DEV &&
  envBase &&
  (envBase.includes("amazonaws.com") || envBase.startsWith("https://"));
const API_BASE_FOR_REQUESTS = isDevExternal ? "/api" : envBase;

function clearAuthAndRedirect() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login";
}

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

// On 401 (e.g. expired token): try to refresh Cognito session and retry once; else redirect to login
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status !== 401) return Promise.reject(error);

    if (!originalRequest.__tokenRefreshRetried && isCognitoEnabled()) {
      originalRequest.__tokenRefreshRetried = true;
      try {
        const session = await fetchAuthSession({ forceRefresh: true });
        const newToken = session.tokens?.idToken?.toString();
        if (newToken) {
          localStorage.setItem("token", newToken);
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api.request(originalRequest);
        }
      } catch (_) {
        // Refresh failed (e.g. refresh token expired)
      }
    }
    clearAuthAndRedirect();
    return Promise.reject(error);
  }
);

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

// --- Health Scan: upload image, get structured health data from ChatGPT ---
export const analyzeHealthScanImage = async (file) => {
  const formData = new FormData();
  formData.append("image", file);
  const response = await api.post("/health-scan/analyze", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

/** Get stored My Data for current user (DynamoDB). */
export const getMyData = async () => {
  const response = await api.get("/mydata");
  return response.data;
};

/** Save My Data for current user (DynamoDB). */
export const saveMyData = async (data) => {
  const response = await api.put("/mydata", data);
  return response.data;
};
