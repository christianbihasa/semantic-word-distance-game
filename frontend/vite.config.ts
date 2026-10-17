import { defineConfig } from "vite";

// GitHub Pages serves the site from /<repo>/; `npm run build` and `npm run preview` use that base so
// the preview matches production. The dev server stays at /. Override with BASE_PATH (e.g. "/" for a
// custom domain).
const PAGES_BASE = "/semantic-word-distance-game/";

export default defineConfig(({ command, isPreview }) => ({
  base: process.env.BASE_PATH ?? (command === "build" || isPreview ? PAGES_BASE : "/"),
}));
