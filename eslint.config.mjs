import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
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
