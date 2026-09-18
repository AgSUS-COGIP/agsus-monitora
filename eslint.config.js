import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "src/modules/legacy-app.js",
      "src/analises/analises-app.js",
    ],
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
      "scripts/**/*.mjs",
      "tests/**/*.js",
      "vite.config.js",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
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
];
