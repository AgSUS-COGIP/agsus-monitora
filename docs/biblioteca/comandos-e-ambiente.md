---
tipo: guia
area: operacao
atualizado: 2026-11-10
---

# Comandos e ambiente

Como rodar o MONITORA na máquina e qual comando responde cada pergunta. Rode o mais barato.

## Requisitos e instalação

Git e Node.js **24** (com npm). Python 3.12 só para os robôs e os testes Python; Docker só para o
container.

```bash
git clone https://github.com/AgSUS-COGIP/agsus-monitora.git
cd agsus-monitora
npm ci
cp .env.example .env.local   # PowerShell: Copy-Item .env.example .env.local
```

## Variáveis do `.env.local`

Os valores vêm de quem administra o ambiente e nunca vão para o repositório.

| Variável                         | Uso                                                                       |
| -------------------------------- | ------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`              | endereço do projeto Supabase                                              |
| `VITE_SUPABASE_PUBLISHABLE_KEY`  | chave **publicável** do Supabase (vai para o navegador)                   |
| `GOOGLE_APPLICATION_CREDENTIALS` | opcional: JSON da conta de serviço, só para cargas de planilha            |
| `SUPABASE_DB_URL`                | opcional: só para os scripts de banco (`db:estado`, `db:esquema`)         |
| `PORT`, `HOST`, `DIST`           | opcionais: porta, interface e pasta servidas pelo `server/servidor.ts`    |

Tudo que começa com `VITE_` vai para o navegador: **nunca** coloque ali a chave `service_role`.

## Rodar

| Comando                        | Endereço              | Para quê                                              |
| ------------------------------ | --------------------- | ----------------------------------------------------- |
| `npm run dev:frontend`         | http://localhost:5173 | editar telas, com recarga instantânea                 |
| `npm run dev`                  | http://127.0.0.1:8000 | build em watch + servidor TypeScript (F5 após editar) |
| `npm run build` e `npm start`  | http://127.0.0.1:8000 | conferir o build de produção, com todas as checagens  |
| `docker compose up --build -d` | http://127.0.0.1:8000 | container (lê o `.env` da raiz, não o `.env.local`)   |

O login volta para `<endereço>/auth/callback.html`, que precisa estar nas **Redirect URLs** do
Supabase. As rotas das telas entregam o `index.html` tanto na Vercel (`rewrites`) quanto no
servidor. As rotas `/api/*` só existem na Vercel; localmente respondem 404.

## Rode o mínimo

```bash
npx vitest run tests/<arquivo>.test.ts   # 1 teste — padrão ao editar
npm run lint                             # só arquivos alterados
npm run check:architecture               # auth + rpc + MutationObserver + remendos + legado + docs
npm run check:docs                       # links da biblioteca de documentação
npm test                                 # Vitest completo (lento)
npm run typecheck                        # tipos do front, do servidor e dos testes
npm run build                            # checagens + vite build (lento, só antes de entregar)
npm run test:e2e                         # Playwright (muito lento, só se pedido)
```

## Relacionadas

- [[testes]] — os comandos de teste
- [[scripts-e-checagens]] — os outros `npm run`
- [[servidor-web]] — o servidor de `npm run dev`
- [[seguranca]] — onde os segredos ficam
