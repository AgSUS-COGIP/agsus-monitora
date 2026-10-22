import js from "@eslint/js";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**"],
  },
  {
    /*
      `api/**` e `src/modules/**` ficaram de fora desta lista por muito tempo, e
      `npx eslint api/aya.js` passava sem rodar regra nenhuma — nenhuma
      configuração casava com o arquivo. Foi assim que uma substituição em massa
      renomeou o parâmetro de uma função sem renomear o uso dentro dela: o
      `no-undef` teria apontado na hora, mas não estava ligado ali.
    */
    files: [
      "api/**/*.js",
      "src/lib/**/*.js",
      "src/modules/**/*.js",
      "src/app/**/*.{js,jsx}",
      "src/ui/**/*.{js,jsx}",
      "src/componentes/**/*.{js,jsx}",
      "src/modulos/**/*.{js,jsx}",
      "scripts/**/*.mjs",
      "tests/**/*.js",
      "vite.config.js",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      // JSX dos componentes React (src/componentes/).
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": "off",
      "no-undef": "error",
      "no-redeclare": "error",
      "no-unreachable": "error",
      "no-constant-condition": ["error", { checkLoops: false }],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}", "server/**/*.ts", "tests/tipos/**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      ...js.configs.recommended.rules,
      // O compilador verifica nomes e redeclarações com o escopo de tipos.
      "no-undef": "off",
      "no-redeclare": "off",
      "no-unused-vars": "off",
      "no-constant-condition": ["error", { checkLoops: false }],
    },
  },
];
