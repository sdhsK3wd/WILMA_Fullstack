import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5178,   // 🟢 Fester Port
        strictPort: true,  // 🟢 Verhindert, dass Vite einen anderen Port benutzt
        host: "localhost"
    }
});

