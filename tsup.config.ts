import { defineConfig } from "tsup";

export default defineConfig({
  // bin.ts is the `enconvert-sdk` CLI. Its leading shebang is preserved by
  // esbuild on the bin entry only, so dist/index.js stays a clean library entry.
  entry: ["src/index.ts", "src/bin.ts"],
  format: ["esm", "cjs"],
  // Types are a library concern: the CLI has no public type surface.
  dts: { entry: "src/index.ts" },
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  target: "es2022",
  platform: "node",
  outExtension({ format }) {
    return { js: format === "esm" ? ".js" : ".cjs" };
  },
});
