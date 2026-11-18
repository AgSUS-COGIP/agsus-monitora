---
tipo: regra
area: operacao
atualizado: 2026-11-17
---

# Planilhas: catálogo e cargas

**`src/lib/base/planilhas.ts` é o único lugar do código com link, caminho ou bucket de planilha.** Quem
consome uma planilha importa de lá; ninguém escreve o endereço de novo em outro arquivo.
`tests/planilhas.test.js` falha se um link de planilha aparecer fora dele. Além disso, duas abas
vêm de planilhas do Google Drive por cargas no GitHub Actions, e as planilhas antigas de análises
enviam ao banco pelo Apps Script.

## O catálogo (`src/lib/base/planilhas.ts`)

- Cada entrada diz o que a planilha é, onde mora e quem a usa (`usadaEm`): trocar um endereço é
  editar uma linha ali e nada mais. Planilha nova entra ali, com `usadaEm`.
- O que o catálogo tem hoje: o modelo de importação da lista de aprovados (arquivo estático
  `public/assets/modelo-importacao-lista-aprovados.xlsx`), o bucket `listas-aprovados` da lista
  importada (Supabase Storage), a regra do link da planilha de origem de cada análise e a planilha de
  Lotações.
- Duas planilhas não têm endereço fixo, e isso é do domínio: a lista de aprovados importada existe
  uma por edital, no Storage ([[modulo-aprovados]]); a planilha de origem de cada análise vem do
  banco, linha a linha (`origem_arquivo_id`), e no catálogo fica só a regra que transforma o id em
  link ([[modulo-analises]]).

## Cargas de Entrevistas e Seleção (GitHub Actions)

Para operar não é preciso credencial no computador: basta acesso ao repositório no GitHub.

| Aba         | Planilha (aba)                           | Workflow / script                                             | Tabelas                                                     |
| ----------- | ---------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| Entrevistas | "[dash] entrevistados" (`Entrevistados`) | `sincronizar-entrevistas.yml` / `sincronizar-entrevistas.mjs` | `TB_ENTREVISTA`, `TB_ENTREVISTA_NOTA`, `TL_SYNC_ENTREVISTA` |
| Seleção     | "Auditoria" (`Resultado`)                | `sincronizar-selecao.yml` / `sincronizar-selecao.mjs`         | `TB_SELECAO_VAGA`, `TL_SYNC_SELECAO`                        |

- Parte comum em `scripts/carga-de-planilha.mjs`; `npm run sync:entrevistas`, `npm run sync:selecao`
  (`--seco` só lê). Conta de serviço do Google + `service_role` do Supabase.
- A agenda dessas duas tarefas no banco está **desligada desde 16/10/2026**: rodam pelo **Rodar
  agora** (Status das atualizações) ou pelo Run workflow ([[robos-e-agenda]]).
- A carga recusa uma aba que veio com menos da metade das linhas ativas (rode `forcar` se a redução
  for real).
- Credenciais só nos secrets do repositório (`GOOGLE_SERVICE_ACCOUNT_JSON`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`); a planilha precisa estar compartilhada como Leitor com a conta de
  serviço. Para rodar na máquina, `GOOGLE_APPLICATION_CREDENTIALS` no `.env.local`.
- Rodar agora, ver se rodou, cada mensagem de erro e o que fazer, trocar a chave do Google e quem
  precisa ter acesso: [docs/sincronizacao-das-planilhas.md](../sincronizacao-das-planilhas.md).
- Carga nova: script em `scripts/` com o comentário de topo, workflow sem `schedule` (o banco
  agenda), entrada no catálogo dos robôs e no Status das atualizações.

## Análises curriculares (Apps Script, legado)

- Os editais novos são analisados no próprio sistema ([[modulo-avaliacao-documental]]). As planilhas
  do Google com Apps Script seguem só para editais antigos e áreas que ainda as usam.
- `apps-script/` guarda o código das planilhas (Saúde Indígena, Projetos e SEDE), colado no Google.
  Cada planilha tem a etiqueta `CO_PLANILHA` e o banco (o "porteiro") garante que o envio de uma
  nunca altera, desativa ou mistura os dados de outra; uma linha com grupo errado recusa o envio
  inteiro. Passo a passo, ordem segura e diagnósticos:
  [apps-script/LEIA-ME.md](../../apps-script/LEIA-ME.md); desenho em
  [docs/banco-de-dados.md](../banco-de-dados.md), seção 6.
- Painel externo feito no Apps Script que avisa quando carregou: [[modulo-paineis-externos]].

## Relacionadas

- [[modulo-selecao]] e [[modulo-entrevistas]] — as telas que leem as cargas
- [[robos-e-agenda]] — o disparo e o atraso das cargas no Status das atualizações
- [[regras-do-codigo]] — a regra geral do código
- [[seguranca]] — onde ficam os segredos
