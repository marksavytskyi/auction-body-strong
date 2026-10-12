import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // `next lint` (removed in Next 16 — this flat config is now run directly
  // via `eslint .`) used to apply these ignores implicitly; without them
  // every build artifact under .next gets linted as if it were source.
  { ignores: [".next/**", "node_modules/**", "public/**"] },
  ...compat.extends("next/core-web-vitals"),
].map((config) => {
  if (config.languageOptions && config.languageOptions.parser) {
    // If it's a parser object with a parse function, it causes issues during serialization.
    // Try deleting it and letting it use the default or just skip it if it's broken.
    delete config.languageOptions.parser;
  }
  return config;
});

eslintConfig.push({
  files: ["**/*.ts", "**/*.tsx"],
  languageOptions: {
    parser: (await import("@typescript-eslint/parser")).default,
  },
});

export default eslintConfig;
