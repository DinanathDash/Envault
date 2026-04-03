import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["agent-interceptor.ts"],
  tsconfig: "tsconfig.sdk.json",
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  target: "node18",
});
