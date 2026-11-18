---
tipo: guia
area: front
atualizado: 2026-11-17
---

# Arquitetura do front

O front está migrando, tela por tela, para **um único app React** (Vite + React 19 + TypeScript,
PWA, hospedado na Vercel), com rotas por área e um visual só (`src/ui/`). O alvo, as regras e a
ordem completos estão em [docs/arquitetura-react.md](../arquitetura-react.md) (aprovado em
01/10/2026), com a raiz única e as rotas na seção "Rotas e navegação": leia antes de criar ou migrar tela.

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
5. **Nada novo no legado** ([[nova-tela-e-legado]]).

## Área é dado, não estrutura

Cada edital pertence a uma **área**: Saúde Indígena, SEDE ou Projetos. Um sistema só serve as três;
muda só o que é próprio de cada uma (o mapa, as colunas de nota das análises). Decisões da proposta
de arquitetura de 25/09/2026:

1. **Continua no Supabase** até estabilizar; depois migra para PostgreSQL próprio, como o SIGAV
   (`db_dataware`). As decisões foram pensadas para essa migração ser troca de camada, não
   reescrita.
2. **React** no front, migrando tela por tela.
3. **A área é dimensão das tabelas e das permissões.** Tabelas do núcleo (usuários, perfis,
   permissões, configuração, auditoria) são compartilhadas; as comuns às áreas (processo seletivo,
   cronograma, análise, aprovado, convocação) são uma tabela só com a coluna de área; o que é de uma
   área só (DSEI, polos, aldeias) tem tabela própria ligada à área.

A proposta completa, com o que ainda era plano na época, está em
[docs/_arquivo/arquitetura.md](../_arquivo/arquitetura.md); a parte do banco, em
[docs/banco-de-dados.md](../banco-de-dados.md) ("Edital sempre na área certa", "CCE e Escritório
Distrital e Regional são Projetos", "Lista de aprovados por área"). O que a Aya responde sobre as
áreas: [regras-das-areas](../aya/regras-das-areas.md) (a explicação mora lá, não na interface).

No app:

- O menu é o mesmo em todas as áreas: **Acompanhar** (Visão geral, painéis e Cronograma),
  **Processo seletivo** na ordem do fluxo (Editais, Triagem, Avaliação documental, Recursos,
  Entrevistas, Classificação, Lista de aprovados) e **Administração** (Aparência, Pessoas e
  acessos, Sistema). Catálogo em `src/lib/navegacao/menu-lateral.ts` (`BLOCOS_DA_AREA`/`blocoDaAba`).
- A área atual é definida pelo menu e lida por `usarAreaAtual()` /
  `src/componentes/dados-do-monitoramento.ts` (`linhasDaArea`, `soDosEditais`); Editais,
  Cronograma e Lista de aprovados recortam pelos ids dos editais da área.
- A API para outro sistema traz `area` e aceita `?area=` ([[deploy-e-vercel]]).
- O mapa da Saúde Indígena só existe nela; Projetos tem o seu ([[mapas-e-leaflet]]).

## Raiz única e telas

- `montarRaiz()` (começo de `src/main.ts`) monta em `#raiz` e desenha, por portal, os avisos
  (`#avisosApp`), a tela de acesso (`#telaDeEntrada`) e a casca (`#appScreen`: barra lateral,
  cabeçalho e as telas). `src/app/contexto-do-app.ts` entrega a navegação e o aviso curto.
- As telas são rotas (`src/lib/navegacao/rotas.ts`, `src/app/endereco.ts`, `src/app/telas.tsx`), carregadas
  sob demanda; a navegação (`src/app/navegacao.ts`) é um estado lido pelo React. A área e a tela
  ficam no endereço (`/saude-indigena/cronograma`, `/sede/classificacao/<edital>`,
  `/administracao/configuracoes/<seção>`), com voltar, avançar e F5.
- A Visão geral, Editais e a casca ficam no pacote principal; as demais telas baixam na primeira
  abertura (`carregar: () => import(…)`, `importarComRecarga`); o item do menu pré-carrega no
  mouse/foco (`src/lib/carga/carga-de-telas.ts`).
- Nenhuma tela do app abre mais em iframe; só os painéis externos (`TB_PAINEL_EXTERNO`)
  continuam no quadro ([[modulo-paineis-externos]]).
- A ligação do app fica em `src/app/` (`sistema.ts`, `navegacao.ts`, `carga.ts`, `presenca.ts`,
  `moldura.ts`, `configuracao.ts`).

## Carga da entrada

O que acontece entre o login ([[seguranca]]) e a primeira tela:

- `src/app/carga.ts` — `loadInitialData` (consultas em paralelo) e `atualizarCopiaDaSessao`.
- `src/app/inicio-da-sessao.ts` — configuração, painéis, abas, situação e unidades numa chamada só
  (RPC `obter_inicio_da_sessao`).
- **Linhas do monitoramento sob demanda:** só as páginas de `src/lib/navegacao/telas-com-linhas.ts` (via
  `src/app/pagina-aberta.ts`) ou `usarLinhasDoMonitoramento` fazem a carga lê-las; o legado as
  publica em `src/componentes/dados-do-monitoramento.ts` ([[nova-tela-e-legado]]).
- **Cópia da sessão no navegador:** `src/lib/sessao/copia-da-sessao.ts` decide quando a cópia guardada
  pode abrir a tela (mesmo usuário, mesmo acesso, mesma versão publicada, dentro da validade) e o
  que mudou desde ela; `src/modules/copia-da-sessao-indexeddb.ts` guarda no IndexedDB. **Afrouxar
  uma regra daqui expõe dado a quem perdeu acesso.**
- **Sem tela de carregamento:** `src/app/carregamento.ts` desenha o skeleton da entrada e a barra
  do "Atualizar dados" (a antiga `#loader` ficou só para salvamentos); o formato está em
  `src/lib/entrada/esqueleto-da-entrada.ts`, o CSS em `src/styles/carregamento.css` (pulsa só com
  `opacity`, e só enquanto está ligado), e o `index.html` traz a marcação `.esqueleto-da-entrada`
  e o script `marcarSessaoGuardada`. Carregando não é zero: enquanto não chega, skeleton.
- Painel externo que avisa quando carregou: [[modulo-paineis-externos]] (seção Protocolo).
- **Versão nova com a página aberta:** a tela sob demanda usa `importarComRecarga` e recarrega uma
  vez; quem está com o sistema aberto vê a faixa "Há uma versão nova" ([[deploy-e-vercel]]).

## Ordem das etapas

1 Fundação (feita) · 2 Entrevistas, Recursos e Seleção fora do iframe (feita) · 3 Configurações
(feita; falta Status) · 4 Análises (feita) · 5 Visão geral (primeiro o que não é mapa) · 6 Login
e entrada (fases 1 e 2 feitas) · 7 Aya. A mudança de pasta é **módulo a módulo**: mover tudo de uma
vez gera conflito com quem trabalha em paralelo.

## Relacionadas

- [[nova-tela-e-legado]] — o passo a passo de uma tela nova e o contrato com o legado
- [[regras-do-codigo]] — as regras gerais, `src/lib/` e TypeScript
- [[seguranca]] — o login antes da carga e a sessão
- [[modulo-acessos]] — quem vê qual área
- [[modulo-barra-lateral]] — o menu por área
- [[modulo-visao-geral]] — a primeira tela de cada área
- [[modulo-paineis-externos]] — o único conteúdo que ainda abre em quadro
- [[mapa-do-repositorio]] — as pastas
