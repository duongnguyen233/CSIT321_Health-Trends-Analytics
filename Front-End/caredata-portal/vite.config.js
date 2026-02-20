import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = (env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
  const isExternalApi = apiUrl && (apiUrl.includes("amazonaws.com") || apiUrl.startsWith("https://"));

  return {
    plugins: [react()],
    esbuild: {
      loader: "jsx",
      include: /src\/.*\.[jt]sx?$/,
    },
    server: {
      port: 5173,
      strictPort: false, // if 5173 busy, try next port (set true to always use 5173 and fail if busy)
      proxy:
        isExternalApi || env.VITE_USE_PROXY === "true" || env.VITE_USE_PROXY === "1"
          ? {
              "/api": {
                target: apiUrl || "https://5f2fuubsod.execute-api.ap-southeast-2.amazonaws.com/dev",
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, ""),
              },
            }
          : undefined,
    },
  };
});