// Flat ESLint config. Next 16 removed the `next lint` subcommand, so we run the
// ESLint CLI directly (see the "lint" script in package.json). This reuses
// eslint-config-next's flat config (Core Web Vitals + TypeScript rules).
//
// eslint-config-next 16 turns on several brand-new eslint-plugin-react-hooks
// (React Compiler) rules as hard errors. This codebase predates them and trips
// them in ~35 places across many unrelated files. We adopt them incrementally
// as warnings (still visible, don't fail CI) rather than refactor the whole app
// in one pass. `react/no-unescaped-entities` is purely cosmetic (apostrophes).
import next from "eslint-config-next";

const config = [
  ...next,
  {
    ignores: [".next/**", "out/**", "build/**", "node_modules/**", "next-env.d.ts"],
  },
  {
    rules: {
      "react/no-unescaped-entities": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/error-boundaries": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
    },
  },
];

export default config;
