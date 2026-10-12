import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    // The existing codebase writes JSX into plain .js files throughout
    // (Next's own SWC transform tolerates that). Vite's React plugin only
    // babel-transforms .jsx/.tsx by default, and Vitest's own SSR/esbuild
    // pre-transform for plain .js also assumes no JSX — both need to be
    // told explicitly to treat .js as JSX-capable for this to work at all.
    plugins: [react({ include: ["**/*.jsx", "**/*.js"] })],
    esbuild: {
        loader: "jsx",
        include: /src\/.*\.jsx?$/,
        exclude: [],
    },
    optimizeDeps: {
        esbuildOptions: {
            loader: { ".js": "jsx", ".jsx": "jsx" },
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
        },
    },
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./vitest.setup.js"],
        css: false,
    },
});
