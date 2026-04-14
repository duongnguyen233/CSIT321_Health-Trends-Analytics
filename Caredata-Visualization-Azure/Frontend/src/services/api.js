import axios from "axios";

const envBase = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
export const API_BASE_URL = envBase;

function clearAuthAndRedirect() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login";
}

export const api = axios.create({
  baseURL: envBase,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || "";
    const isAuthEndpoint = url.startsWith("/auth/login") || url.startsWith("/auth/register") || url.startsWith("/auth/google") || url.startsWith("/auth/verify-email") || url.startsWith("/auth/resend");
    if (error.response?.status === 401 && !isAuthEndpoint) {
      clearAuthAndRedirect();
    }
    return Promise.reject(error);
  }
);

export const registerUser = async (userData) => {
  const response = await api.post("/auth/register", userData);
  return response.data;
};

export const loginUser = async (credentials) => {
  const response = await api.post("/auth/login", credentials);
  return response.data;
};

export const verifyEmail = async (token) => {
  const response = await api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
  return response.data;
};

export const resendVerification = async (email) => {
  const response = await api.post("/auth/resend-verification", { email });
  return response.data;
};

export const getCurrentUser = async (token) => {
  const response = await axios.get(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const analyzeHealthScanImages = async (files) => {
  const fileList = Array.isArray(files) ? files : [files];
  const formData = new FormData();
  fileList.forEach((file) => formData.append("images", file));
  const response = await api.post("/health-scan/analyze", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const getMyData = async () => {
  const response = await api.get("/mydata");
  return response.data;
};

export const saveMyData = async (data) => {
  const response = await api.put("/mydata", data);
  return response.data;
};

export const getRecommendations = async () => {
  const response = await api.get("/mydata/recommendations");
  return response.data;
};

export const getSettings = async () => {
  const response = await api.get("/mydata/settings");
  return response.data;
};

export const saveSettings = async (settings) => {
  const response = await api.put("/mydata/settings", settings);
  return response.data;
};

const UPLOAD_CSV_LOG = "[upload-csv]";

export const uploadAndAnalyzeCSV = async (file) => {
  console.log(`${UPLOAD_CSV_LOG} Step: Sending CSV to backend`, {
    endpoint: "/upload-csv/analyze",
    fileName: file?.name,
    fileSize: file?.size,
    fileSizeKB: file?.size ? (file.size / 1024).toFixed(1) : null,
  });
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/upload-csv/analyze", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  const data = response.data;
  console.log(`${UPLOAD_CSV_LOG} Step: Received from backend`, {
    uploadId: data?.uploadId,
    filename: data?.filename,
    saved: data?.saved,
    analysisKeys: data?.analysis ? Object.keys(data.analysis) : null,
    analysisLength: typeof data?.analysis === "string" ? data.analysis?.length : JSON.stringify(data?.analysis)?.length,
  });
  return data;
};

export const getUploadHistory = async () => {
  console.log(`${UPLOAD_CSV_LOG} Step: Fetching upload history`, { endpoint: "GET /upload-csv/history" });
  const response = await api.get("/upload-csv/history");
  const data = response.data;
  console.log(`${UPLOAD_CSV_LOG} Step: Received upload history`, { count: Array.isArray(data) ? data.length : 0, items: data });
  return data;
};

export const getUploadById = async (uploadId) => {
  console.log(`${UPLOAD_CSV_LOG} Step: Fetching upload by id`, { endpoint: `GET /upload-csv/history/${uploadId}`, uploadId });
  const response = await api.get(`/upload-csv/history/${uploadId}`);
  const data = response.data;
  console.log(`${UPLOAD_CSV_LOG} Step: Received upload`, {
    uploadId: data?.uploadId,
    filename: data?.filename,
    keys: data ? Object.keys(data) : [],
    hasAnalysis: !!data?.analysis,
    analysisLength: typeof data?.analysis === "string" ? data?.analysis?.length : (data?.analysis ? JSON.stringify(data.analysis).length : 0),
  });
  return data;
};

/** Download CSV file for an upload. Triggers browser download. */
export const downloadUploadCSV = async (uploadId, filename = "data.csv") => {
  console.log(`${UPLOAD_CSV_LOG} Step: Downloading CSV`, { endpoint: `GET /upload-csv/history/${uploadId}/download`, uploadId, filename });
  const response = await api.get(`/upload-csv/history/${uploadId}/download`, {
    responseType: "blob",
  });
  const disposition = response.headers["content-disposition"];
  let name = filename;
  if (disposition && disposition.includes("filename=")) {
    const match = disposition.match(/filename="?([^";\n]+)"?/);
    if (match) name = match[1].trim();
  }
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", name);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
  console.log(`${UPLOAD_CSV_LOG} Step: Download started`, { uploadId, savedAs: name });
};

export const deleteUpload = async (uploadId) => {
  console.log(`${UPLOAD_CSV_LOG} Step: Deleting upload`, { endpoint: `DELETE /upload-csv/history/${uploadId}`, uploadId });
  const response = await api.delete(`/upload-csv/history/${uploadId}`);
  console.log(`${UPLOAD_CSV_LOG} Step: Delete response`, { uploadId, response: response.data });
  return response.data;
};

export const clearUploadHistory = async () => {
  const response = await api.delete("/upload-csv/history");
  return response.data;
};


export const getHealthScanHistory = async () => {
  const response = await api.get("/health-scan/history");
  return response.data;
};

export const deleteHealthScan = async (scanId) => {
  const response = await api.delete(`/health-scan/history/${scanId}`);
  return response.data;
};

export const clearHealthScanHistory = async () => {
  const response = await api.delete("/health-scan/history");
  return response.data;
};

// ─── QI Data API ────────────────────────────────────────────────────────────

/** Fetch all QI aggregates (all dates) for trend charts. */
export const getQIAggregates = async () => {
  const response = await api.get("/api/qi/aggregates");
  return response.data;
};

/** Fetch QI aggregate for a single assessment date. */
export const getQIAggregateByDate = async (date) => {
  const response = await api.get(`/api/qi/aggregates/${date}`);
  return response.data;
};

/** Fetch resident-level assessment data for a specific date. */
export const getQIResidents = async (date) => {
  const response = await api.get(`/api/qi/residents`, { params: { date } });
  return response.data;
};

/** Fetch a single resident's assessment history across all dates. */
export const getResidentHistory = async (residentId) => {
  const response = await api.get(`/api/qi/residents/${residentId}`);
  return response.data;
};

// ─── GPMS API ───────────────────────────────────────────────────────────────

/** List all GPMS submission dates (light — no form data). */
export const getGPMSList = async () => {
  const response = await api.get("/api/gpms");
  return response.data;
};

/** Get full GPMS form data for a specific date. */
export const getGPMSByDate = async (date) => {
  const response = await api.get(`/api/gpms/${date}`);
  return response.data;
};

/** Save GPMS form data for a specific date. */
export const saveGPMS = async (date, formData, submitted = false) => {
  const response = await api.put(`/api/gpms/${date}`, { formData, submitted });
  return response.data;
};

/** Delete GPMS submission for a specific date. */
export const deleteGPMS = async (date) => {
  const response = await api.delete(`/api/gpms/${date}`);
  return response.data;
};

