---
tipo: referencia
area: operacao
atualizado: 2026-11-10
---

# Servidor web (`server/servidor.ts`)

Um arquivo, `server/servidor.ts`, entrega o build do Vite em container. Substituiu o servidor
Laravel/PHP em 22/09/2026, com o mesmo contrato e sem regra de negócio: os dados continuam indo do
navegador ao Supabase, sob RLS. Não há chave do Supabase no servidor. A Vercel continua sendo o
caminho estático e não usa este servidor ([[deploy-e-vercel]]).

## O que ele faz

| Pedido                                                                                                             | Resposta                                                                          |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `/`, `/index.html`, `/auth/callback`, `/auth/callback.html` e as rotas das telas                                   | a página do `dist/`, idêntica byte a byte ao build, com `Cache-Control: no-store` |
| `/up`                                                                                                              | `200 ok` — saúde para Docker e CI                                                 |
| `/assets/*`, `/icons/*`, `/data/*`, `manifest.webmanifest`, `offline.html`, `sw.js`, `sw-policy.js`, `versao.json` | o arquivo estático, com ETag e gzip para texto e JSON                             |
| qualquer outra coisa (`/.env`, pastas, arquivos com ponto, `..`, `/CLAUDE.md`)                                     | `404`                                                                             |
| método diferente de GET/HEAD numa rota conhecida                                                                   | `405`                                                                             |

- **Cabeçalhos de segurança** lidos do `vercel.json`: uma fonte só; para mudar a política, mude lá.
  O HSTS só sai por HTTPS (TLS ou `X-Forwarded-Proto: https`).
- **Cache:** arquivo com hash do Vite no nome vai com `immutable` por um ano; o resto é `no-cache`,
  revalidado por ETag.
- **Páginas lidas do disco a cada requisição**, o que permite o `npm run dev` sem reiniciar.
- Novo estático público: acrescente a pasta em `PASTAS_ESTATICAS` ou o arquivo em
  `ARQUIVOS_ESTATICOS_DA_RAIZ`. O que não está na lista é 404, de propósito.

## Rodar

```sh
npm run dev          # vite build --watch + servidor, em http://127.0.0.1:8000
npm start            # serve o dist/ existente (node server/servidor.ts)
docker compose up --build -d
```

Variáveis: `HOST` (padrão `127.0.0.1`; o container usa `0.0.0.0`), `PORT` (padrão `8000`) e `DIST`
(padrão `dist`).

## TypeScript sem compilação

- O Node 24 remove os tipos ao executar: não há build nem pasta de saída. A checagem é o
  `npm run typecheck` (roda dentro do `npm run build`).
- **Só sintaxe apagável** (`erasableSyntaxOnly`): nada de `enum`, `namespace`, parâmetro de
  construtor com `private`/`readonly`. Import de tipo com `import type`.
- **Só módulos nativos do Node.** Não adicionar dependência: a imagem Docker não tem `node_modules`.

## Testes e implantação

- `tests/servidor.test.js` sobe o servidor numa porta aleatória, sobre um `dist` de teste, e fixa o
  contrato acima (herdou os casos do antigo `MonitoraRoutesTest.php`). `npm run test:smoke:servidor`
  roda o smoke do Playwright contra ele; o CI roda o smoke também contra a imagem Docker
  ([[testes-de-navegador]]). Após editar: `npm run typecheck` e
  `npx vitest run tests/servidor.test.js`.
- Imagem autossuficiente: `docker build --build-arg VITE_SUPABASE_URL --build-arg
  VITE_SUPABASE_PUBLISHABLE_KEY -t monitora .` e `docker run -p 8000:8000 monitora`. Em produção,
  ponha um proxy HTTPS na frente e preserve o domínio atual, para manter os endereços de retorno do
  OAuth já autorizados.

## Relacionadas

- [[comandos-e-ambiente]] — rodar na máquina
- [[seguranca]] — cabeçalhos e o que não se serve
