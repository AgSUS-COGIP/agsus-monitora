# `server/` — servidor web (TypeScript)

Um arquivo: `servidor.ts`. Entrega o `dist/` do Vite (6 rotas de página, `/up` e estáticos de
`assets/`, `icons/`, `data/` e arquivos PWA). Sem regra de negócio e sem Supabase. Contrato
completo em `docs/servidor.md`.

- Roda direto no Node 24: `node server/servidor.ts` (`npm start`). Não há build nem pasta de saída.
- **Só sintaxe apagável** (`erasableSyntaxOnly`): nada de `enum`, `namespace`, parâmetro de
  construtor com `private`/`readonly`. Import de tipo com `import type`.
- **Só módulos nativos do Node.** Não adicionar dependência: a imagem Docker não tem `node_modules`.
- Cabeçalhos de segurança vêm do `vercel.json`. Para mudar a política, mude lá.
- Novo estático público: acrescente a pasta em `PASTAS_ESTATICAS` ou o arquivo em
  `ARQUIVOS_ESTATICOS_DA_RAIZ`. O que não está na lista é 404, de propósito.

Após editar: `npm run typecheck` e `npx vitest run tests/servidor.test.js`.
