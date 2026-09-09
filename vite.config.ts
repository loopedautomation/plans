import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

/**
 * A second entry: the reader.
 *
 * `vite build --mode share` builds `src/share` — the read-only half of the
 * app, the same markdown pipeline the editor renders from — into
 * `server/public`, which the server serves at `/` and `/{id}`. It is a mode
 * rather than a second input because the two builds go to different places:
 * the app's to `dist` for Tauri, the reader's into the server. See
 * plans/public-plan-pages.md.
 */
const share = (mode: string) =>
  mode === "share"
    ? {
        root: "src/share",
        // Nothing in `public/` belongs to a public page; the reader carries
        // what it needs in its bundle.
        publicDir: false as const,
        build: { outDir: "../../server/public", emptyOutDir: true },
      }
    : {};

/**
 * A third entry: the design gallery.
 *
 * `vite build --mode design` builds `src/design` — every element of the
 * design system drawn by the app's own components, in all three papers —
 * into `site/design`, which the site workflow deploys with the rest of the
 * site at `/design/`. Built, never committed, for the same reason as the
 * reader: the gallery and the app must be the same code. See
 * plans/distill-this-design.md.
 */
const design = (mode: string) =>
  mode === "design"
    ? {
        root: "src/design",
        base: "/design/",
        publicDir: false as const,
        build: { outDir: "../../site/design", emptyOutDir: true },
      }
    : {};

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  // Native release builds carry one shell. Development keeps both so the
  // browser fake can exercise phone and desktop flows from the same server.
  const appTarget =
    mode === "mobile"
      ? "mobile"
      : mode === "production"
        ? "desktop"
        : "runtime";
  return {
    plugins: [react()],
    ...share(mode),
    ...design(mode),
    define: { __PLANS_BUILD_TARGET__: JSON.stringify(appTarget) },

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent Vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
            protocol: "ws",
            host,
            port: 1421,
          }
        : undefined,
      watch: {
        // 3. tell Vite to ignore watching `src-tauri`
        ignored: ["**/src-tauri/**"],
      },
    },
  };
});
