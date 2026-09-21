import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative assets work at /, /repository-name/, and custom domains.
  // Navigation stays in-page; there are no server-side routes.
  base: "./",
  test: { include: ["src/**/*.test.ts"] },
});
