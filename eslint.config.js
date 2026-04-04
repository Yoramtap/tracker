import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "tasks/**",
      "vendor/**",
      ".cache/**",
      ".codex-artifacts/**"
    ]
  },
  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        Plotly: "readonly"
      }
    },
    rules: {
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ]
    }
  }
];
