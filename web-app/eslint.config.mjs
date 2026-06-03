import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...nextCoreWebVitals,
  {
    // Scope to TS files so the @typescript-eslint plugin (registered by Next's
    // config only for TS files) is in scope where these rules are referenced.
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      // Stylistic only — literal quotes/apostrophes in JSX text are fine and
      // escaping them (&apos; etc.) hurts readability in content-heavy pages.
      "react/no-unescaped-entities": "off",
      // Experimental React Compiler rules (new error defaults in Next 16) that
      // flag working, established patterns — refs read inside event handlers
      // referenced while building JSX, and prop->local-state sync via a guarded
      // effect. Kept as warnings so they stay visible for deliberate, low-risk
      // cleanup rather than forcing risky refactors of working audio code.
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default eslintConfig;
