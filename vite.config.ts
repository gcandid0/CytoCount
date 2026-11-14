import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuração enxuta pro Tauri: porta fixa (bate com devUrl no tauri.conf.json),
// e evita o Vite tentar usar o mesmo host/porta que outro processo já ocupa.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // No Windows, o Cargo trava o .exe em target/ enquanto compila — se o
      // Vite tentar observar essa pasta, o watcher quebra com EBUSY.
      ignored: ["**/src-tauri/**"],
    },
  },
});
