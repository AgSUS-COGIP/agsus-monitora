---
tipo: guia
area: operacao
atualizado: 2026-11-10
---

# Cargas de planilha

Duas abas do MONITORA vêm de planilhas do Google Drive, lidas pelo GitHub Actions e gravadas no
banco; e as planilhas antigas de análises enviam ao banco pelo Apps Script. Para operar não é
preciso credencial no computador: basta acesso ao repositório no GitHub.

## Entrevistas e Seleção (GitHub Actions)

| Aba do MONITORA | Planilha (aba)                           | Workflow / script                                              | Tabelas                                             |
| --------------- | ---------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------- |
| Entrevistas     | "[dash] entrevistados" (`Entrevistados`) | `sincronizar-entrevistas.yml` / `sincronizar-entrevistas.mjs`  | `TB_ENTREVISTA`, `TB_ENTREVISTA_NOTA`, `TL_SYNC_ENTREVISTA` |
| Seleção         | "Auditoria" (`Resultado`)                | `sincronizar-selecao.yml` / `sincronizar-selecao.mjs`          | `TB_SELECAO_VAGA`, `TL_SYNC_SELECAO`                |

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

## Análises curriculares (Apps Script, legado)

- Os editais novos são analisados no próprio sistema ([[modulo-avaliacao-documental]]). As planilhas
  do Google com Apps Script seguem só para editais antigos e áreas que ainda as usam.
- `apps-script/` guarda o código das planilhas (Saúde Indígena, Projetos e SEDE), colado no Google.
  Cada planilha tem a etiqueta `CO_PLANILHA` e o banco (o "porteiro") garante que o envio de uma
  nunca altera, desativa ou mistura os dados de outra; uma linha com grupo errado recusa o envio
  inteiro. Passo a passo, ordem segura e diagnósticos: [apps-script/LEIA-ME.md](../../apps-script/LEIA-ME.md);
  desenho em [docs/banco-de-dados.md](../banco-de-dados.md), seção 6.
- Painel externo feito no Apps Script que avisa quando carregou:
  [docs/painel-externo-avisa-que-carregou.md](../painel-externo-avisa-que-carregou.md).

## Regras

- Endereço de planilha só em `src/lib/planilhas.ts` ([[planilhas]]).
- Carga nova: script em `scripts/` com o comentário de topo, workflow sem `schedule` (o banco
  agenda), entrada no catálogo dos robôs e no Status das atualizações.

## Relacionadas

- [[modulo-selecao]] e [[modulo-entrevistas]] — as telas que leem as cargas
- [[modulo-status-das-atualizacoes]] — onde se vê o atraso
- [[seguranca]] — onde ficam os segredos
