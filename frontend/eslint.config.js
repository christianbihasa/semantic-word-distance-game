import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["src/worker-*.ts"],
    languageOptions: { globals: globals.worker },
  },
  {
    files: ["tests/**/*.ts", "*.config.{js,ts}"],
    languageOptions: { globals: globals.node },
  },
  {
    rules: {
      "no-restricted-properties": [
        "error",
        { property: "innerHTML", message: "Build DOM with textContent instead (see ui.ts el())." },
      ],
    },
  },
  prettier,
);
