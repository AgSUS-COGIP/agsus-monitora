---
tipo: guia
area: front
atualizado: 2026-11-10
---

# Arquitetura do front

O front está migrando, tela por tela, para **um único app React** (Vite + React 19 + TypeScript,
PWA, hospedado na Vercel), com rotas por área e um visual só (`src/ui/`). O alvo, as regras e a
ordem completos estão em [docs/arquitetura-react.md](../arquitetura-react.md) (aprovado em
01/10/2026) e a raiz única e as rotas em [docs/arquitetura/raiz-react.md](../arquitetura/raiz-react.md):
leia antes de criar ou migrar tela.

## O sistema inteiro

```text
Navegador (Vite + React 19 + TypeScript, PWA)            ── hospedado na Vercel
   │  login Google (Supabase Auth) · dados só por RPC, sob RLS
   ▼
Supabase: PostgreSQL + RLS + RPCs SECURITY DEFINER + pg_cron/pg_net + Vault
   │  agenda e "Rodar agora" → workflow_dispatch
   ▼
GitHub Actions: cálculo pesado em Python (e robôs em Node) ── gravam por RPC ──► Supabase

Vercel: front estático (dist/) + funções serverless em api/ (FUNAI, PDF de anexos do edital)
Planilhas (legado): Apps Script → Supabase
```

## Para onde o front vai

```
src/
  app/        entrada única, rotas, layout (menu + topo + Aya), login, ErrorBoundary
  ui/         componentes visuais padrão (o design system)
  modulos/    um por tela: componentes + estado + consultas (RPC)
  lib/        regras puras, testadas
  modules/    LEGADO: o que ainda não migrou (encolhe até sumir)
```

## Regras (de `docs/arquitetura-react.md`)

1. **Um visual só.** Toda tela monta com `src/ui/` e os tokens de `src/styles/tokens.css`. KPI é
   card compacto (`Kpi` em `GradeDeKpis`, ~78px). Ver [[componentes-padrao]].
2. **Um padrão de dados só:** `estado` por módulo (store fora do React, com `obter()` e
   `assinar(ouvinte)`, lido com `useSyncExternalStore`), RPC pelo cliente Supabase único
   (`getSupabaseClient()`, contrato em `src/lib/rpc-contrato.ts`), regras em `src/lib/`. Sem
   biblioteca nova de estado ou de dados.
3. **Isolamento.** Cada tela, seção e parte da casca fica num `ErrorBoundary` (a rota em
   `src/app/telas.tsx`, as peças em `src/app/casca/pecas.tsx`). Há um `createRoot` só
   (`src/app/raiz.tsx`).
4. **Texto.** Sem texto genérico na interface ([[textos-da-interface]]).
5. **Nada novo no legado** ([[codigo-legado]]).

## Raiz única e telas

- `montarRaiz()` (começo de `src/main.ts`) monta em `#raiz` e desenha, por portal, os avisos
  (`#avisosApp`), a tela de acesso (`#telaDeEntrada`) e a casca (`#appScreen`: barra lateral,
  cabeçalho e as telas). `src/app/contexto-do-app.ts` entrega a navegação e o aviso curto.
- As telas são rotas (`src/lib/rotas.ts`, `src/app/endereco.ts`, `src/app/telas.tsx`), carregadas
  sob demanda; a navegação (`src/app/navegacao.ts`) é um estado lido pelo React. A área e a tela
  ficam no endereço (`/saude-indigena/cronograma`, `/sede/classificacao/<edital>`,
  `/administracao/configuracoes/<seção>`), com voltar, avançar e F5.
- A Visão geral, Editais e a casca ficam no pacote principal; as demais telas baixam na primeira
  abertura (`carregar: () => import(…)`, `importarComRecarga`); o item do menu pré-carrega no
  mouse/foco (`src/lib/carga-de-telas.ts`).
- Nenhuma tela do app abre mais em iframe; só os painéis externos (`TB_PAINEL_EXTERNO`)
  continuam no quadro ([[modulo-paineis-externos]]).
- A ligação do app fica em `src/app/` (`sistema.ts`, `navegacao.ts`, `carga.ts`, `presenca.ts`,
  `moldura.ts`, `configuracao.ts`).

## Ordem das etapas

1 Fundação (feita) · 2 Entrevistas, Recursos e Seleção fora do iframe (feita) · 3 Configurações
(feita; falta Status) · 4 Análises (feita) · 5 Visão geral (primeiro o que não é mapa) · 6 Login
e entrada (fases 1 e 2 feitas) · 7 Aya. A mudança de pasta é **módulo a módulo**: mover tudo de uma
vez gera conflito com quem trabalha em paralelo.

## Relacionadas

- [[nova-tela-react]] — o passo a passo de uma tela nova
- [[legado-fala-com-react]] — o contrato entre o legado e os componentes
- [[typescript-no-front]] — o estado da migração para TypeScript
- [[carga-da-entrada]] — o que acontece ao abrir o app
- [[areas-do-sistema]] — por que a área é dado e não estrutura
- [[mapa-do-repositorio]] — as pastas
