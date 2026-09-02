import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [react()],
    worker: { format: "es" },
    optimizeDeps: { exclude: ["@jsquash/avif"] },
    server: {
        host: true,
        proxy: {
            "/api": "http://127.0.0.1:3001",
        },
    },
});
