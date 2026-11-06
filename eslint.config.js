import js from "@eslint/js";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";

/*
  Os hooks próprios do projeto se chamam `usarAlgo`, não `useAlgo`, e o plugin
  só reconhece o prefixo `use`. Sem este ajuste, todo `useState` dentro de um
  `usarAlgo` vira erro de "função que não é componente nem hook". Aqui só essa
  mensagem é descartada, e só quando a função começa com `usar`; nos
  componentes o resto da regra (hook dentro de `if`, laço, classe ou fora de
  função) segue igual. Limite conhecido: dentro de um `usarAlgo` o plugin não
  acusa hook condicional, e chamar `usarAlgo()` dentro de `if` também passa.
*/
const HOOK_EM_PORTUGUES =
  /is called in function "usar(?:[A-Z0-9][^"]*)?" that is neither/;
const regraDosHooks = reactHooks.rules["rules-of-hooks"];
const regraDosHooksComUsar = {
  meta: regraDosHooks.meta,
  create(context) {
    const contexto = Object.create(context, {
      report: {
        value(descritor) {
          if (HOOK_EM_PORTUGUES.test(descritor.message ?? "")) return;
          context.report(descritor);
        },
      },
    });
    return regraDosHooks.create(contexto);
  },
};
// Mesmo nome de plugin, para `eslint-disable react-hooks/...` seguir valendo.
const hooksDoProjeto = {
  ...reactHooks,
  rules: { ...reactHooks.rules, "rules-of-hooks": regraDosHooksComUsar },
};

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
  {
    /*
      Regras dos hooks do React. `rules-of-hooks` é erro: hook chamado dentro de
      `if`, laço ou depois de `return` troca o estado de um componente pelo de
      outro sem aviso. `exhaustive-deps` fica como aviso enquanto as telas
      antigas são revisadas aos poucos. O JavaScript antigo de `src/modules/`
      não usa React e tem funções comuns chamadas `useAlgo`, por isso fica de
      fora.
    */
    files: ["src/**/*.{jsx,ts,tsx}"],
    plugins: { "react-hooks": hooksDoProjeto },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    /*
      HTML montado a partir de texto é a porta de XSS: um nome, uma
      observação ou uma resposta da API com `<img onerror=...>` vira código.
      No front, texto entra como filho no JSX ou por `textContent`, e
      elementos por `createElement`. Exceção só com
      `// eslint-disable-next-line no-restricted-syntax -- <por que é seguro>`
      na linha anterior. Exceção hoje: o `srcdoc` da impressão em
      `src/modulos/classificacao/documento-no-navegador.ts` (iframe sem
      `allow-scripts`).
    */
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "AssignmentExpression[left.type='MemberExpression'][left.property.name=/^(innerHTML|outerHTML|srcdoc)$/]",
          message:
            "Sem innerHTML/outerHTML/srcdoc: use JSX, textContent ou createElement.",
        },
        {
          selector:
            "CallExpression[callee.property.name=/^(insertAdjacentHTML|createContextualFragment|setHTMLUnsafe)$/]",
          message:
            "Sem inserir HTML a partir de texto: use JSX, textContent ou createElement.",
        },
        {
          selector:
            "CallExpression[callee.object.name='document'][callee.property.name=/^(write|writeln)$/]",
          message: "Sem document.write: monte os elementos pelo DOM.",
        },
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message:
            "Sem dangerouslySetInnerHTML: o texto vai como filho no JSX.",
        },
        {
          selector: "Property[key.name='dangerouslySetInnerHTML']",
          message:
            "Sem dangerouslySetInnerHTML: o texto vai como filho no JSX.",
        },
      ],
    },
  },
  {
    /*
      Regras com informação de tipos, só no front em TypeScript. Promessa
      esquecida (sem `await`, `.catch` ou `void`) engole o erro em silêncio;
      `void tarefa()` continua aceito como "disparar de propósito". Handlers
      de JSX (`onClick={async () => ...}`) ficam liberados.
    */
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.frontend.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      "@typescript-eslint/no-floating-promises": ["warn", { ignoreVoid: true }],
      "@typescript-eslint/no-misused-promises": [
        "warn",
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },
];
