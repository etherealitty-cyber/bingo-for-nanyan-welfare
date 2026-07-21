import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const runtimeProcess = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
}).process;

export default defineConfig({
  plugins: [react()],
  base: runtimeProcess?.env?.VITE_BASE_PATH ?? "/",
  build: {
    target: "es2022",
  },
});
