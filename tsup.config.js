import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.js"],
    format: ["cjs", "esm"],
    outDir: "dist",
    clean: true,
    outExtension({ format }) {
        return {
        js: format === "cjs" ? ".cjs" : ".mjs"
    };
    }
});
