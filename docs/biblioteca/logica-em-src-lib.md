---
tipo: referencia
area: front
atualizado: 2026-11-10
---

# Lógica em `src/lib/`

`src/lib/` é a lógica pura e testável: **sem DOM e sem estado global**, entrada → saída, com teste
em `tests/<nome>.test.ts` (ou `tests/lib/`). Arquivo novo: nome em português, kebab-case, com teste
junto. A UI pertence a `src/modulos/` (e, no legado, a `src/modules/`).

## Arquivos que exigem cuidado

**Fronteiras (não afrouxar)**

- `rpc-contrato.ts` — contrato das RPCs; mudou no banco, muda aqui ([[rpc-e-contrato]]).
- `sessao.ts`, `session-lifecycle.ts`, `supabaseClient.ts`, `auth-flow.ts` — único caminho de auth;
  `novas-tentativas.ts` — regra única de nova tentativa ([[sessao-e-auth]]).
- `sanitize.ts`, `html-security.ts`, `csv-security.ts` — fronteira de segurança ([[seguranca]]).
- `copia-da-sessao.ts` — quando a cópia guardada pode abrir a tela; afrouxar expõe dado a quem
  perdeu acesso ([[carga-da-entrada]]).
- `env.ts` — leitura de variáveis; nunca chave escrita no código.

**Permissões e Configurações**

- `access-roles.ts`, `permissoes-recursos.ts` — matriz de permissão e páginas/seções liberadas;
  `matriz-de-acessos.ts`, `teto-de-acessos.ts`, `grupos-e-coordenacoes.ts`, `ver-como.ts`,
  `solicitacao-de-acesso.ts` — Acessos ([[permissoes-e-perfis]]).
- `apresentacao-das-configuracoes.ts` (tom da faixa de aviso global, endereço de imagem aceito nas
  prévias), `marca-da-barra-lateral.ts` (logo e cor publicadas e em rascunho),
  `publicacao-de-configuracoes.ts` (chaves de cada seção, comparação com o retrato do banco,
  validação de URL e domínio), `contraste.ts` (contraste do aviso de branding; reutilize) —
  [[modulo-configuracoes]].
- `menu-lateral.ts` (catálogo dos grupos do menu, blocos da área, árvore por permissão e área,
  página ativa, estado do flutuante; área ou página nova entra aqui) e
  `eventos-da-barra-lateral.ts` — [[modulo-barra-lateral]].

**Editais, cronograma e aprovados**

- `editais-do-nucleo.ts`, `cronograma-do-edital.ts`, `retificacao-do-cronograma.ts` —
  [[modulo-editais]]; `calendario-editais.ts` — [[modulo-cronograma]].
- `anexos-do-candidato.ts` (PDF no banco em bytea; 2 MB, 5 por candidato; o banco repete os
  limites) e `configuracao-de-convocacao.ts` (precedência do quadro: manual > total da vaga >
  padrão) — [[modulo-aprovados]].
- `status-da-analise.ts` — status sem decisão (Pendente, Em análise), comum ao KPI "Pendentes" e aos
  marcos; `encerramento-do-edital.ts` — [[modulo-encerramento-do-edital]].
- `avaliacao-documental/datas-do-vinculo.ts` — nada antes de 1960 nem fim depois de hoje; o banco e
  o robô repetem a regra ([[modulo-avaliacao-documental]]).

**Mapas e geografia**

- `fabrica-do-leaflet.ts` (único lugar que cria mapa Leaflet), `filtros-do-mapa.ts`,
  `reconciliacao-unidades.ts`, `uf-ibge.ts`, `brasil-bounds.ts` — [[mapas-e-leaflet]],
  [[coordenadas]].

**Planilhas, robôs e versão**

- `planilhas.ts` — catálogo de todas as planilhas, com `usadaEm` ([[planilhas]]).
- `agenda-do-cron.ts` (leitura única da agenda do pg_cron) e `catalogo-dos-robos.ts` (nomes de
  robô e de tarefa vêm do banco) — [[robos-e-agenda]].
- `novidades.ts` e `versao-do-sistema.ts` — aviso de versão nova ([[deploy-e-vercel]]).

## Relacionadas

- [[testes]] — como testar a lógica pura
- [[regras-do-codigo]] — as regras gerais
- [[mapa-do-repositorio]] — as outras pastas
