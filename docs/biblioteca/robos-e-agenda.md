---
tipo: guia
area: operacao
atualizado: 2026-11-17
---

# Robôs e agenda

Os robôs rodam no GitHub Actions (Python e Node) e gravam no banco por RPC. **O banco é o único
agendador**: o `schedule` do GitHub Actions, no plano gratuito, atrasa e pula execuções, então o
pg_cron chama `private."FC_DISPARAR_ROBO"`, que pede a execução ao GitHub (`workflow_dispatch`,
ramo `main`, `disparado_por = AGENDA`) pelo pg_net. Os workflows não têm `schedule`. Guia
completo, com os horários de cada tarefa: [docs/agenda-dos-robos.md](../agenda-dos-robos.md).

Duas telas de Configurações cuidam disso, ambas só para administrador global: **Automação** liga
e desliga; **Status das atualizações** mostra a saúde e roda na hora.

## Como um robô é disparado

- **Agenda:** tarefa do pg_cron → `FC_DISPARAR_ROBO` (origem `AGENDA`).
- **Rodar agora**, **Opções** e **Recalcular** (da triagem): RPC `disparar_robo`, que confere quem
  pede e as opções e chama o mesmo `FC_DISPARAR_ROBO` com `disparado_por` = id de quem clicou. Uma
  chave só, a do Vault; funciona também no computador.
- **Run workflow** no GitHub.
- A chave é um token fine-grained do GitHub (só "Actions: Read and write" neste repositório) no
  **Vault** do Supabase, segredo `github_disparo_robos`. O registro dos pedidos
  (`TL_DISPARO_ROBO`) guarda workflow, hora, situação e código HTTP, nunca a chave. Expirou: o
  Status das atualizações mostra "HTTP 401" (ou "SEM_TOKEN" sem segredo); troque o valor no Vault,
  mesmo nome. Passo a passo no guia.

## Catálogo dos robôs (20261109180000)

- `TB_ROBO_WORKFLOW` (um por workflow: se o banco pode pedir, inputs aceitos, chave) e
  `TB_TAREFA_AGENDADA` (uma por tarefa do pg_cron: chave, workflow, rótulo da tela). A tela lê por
  `obter_catalogo_dos_robos` (`src/lib/automacao/catalogo-dos-robos.ts`, lido uma vez por tela). Não há RPC
  de escrita: o catálogo muda só por migration. O banco também confere robôs, modos e opções.
- **Nome de robô ou de tarefa não se escreve à mão na tela:** vem do catálogo. **Horário também
  não:** `src/lib/automacao/agenda-do-cron.ts` é a leitura única da agenda do pg_cron (próxima execução,
  maior intervalo, prazo de cada carga, texto em horário de Brasília), usada pelas duas telas.
- Workflow novo: `insert` em `TB_ROBO_WORKFLOW` (e em `TB_TAREFA_AGENDADA` se uma tarefa o pedir);
  se tiver "Rodar agora", entra em `disparar_robo` e em `ROBOS_DE_CARGA`
  (`src/lib/automacao/robos-de-carga.ts`). `tests/catalogo-dos-robos-migration.test.ts` reprova robô fora do
  catálogo.

## Os robôs

| Robô                                | Onde                                                                                         | Guia                                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Robô da Empregare (inscritos)       | `scripts/robo-empregare/`, `robo-empregare.yml`                                              | [docs/robo-empregare.md](../robo-empregare.md)                                          |
| Leitura dos arquivos dos candidatos | `leitura-de-arquivos.yml` (só Run workflow)                                                  | [docs/leitura-dos-arquivos.md](../leitura-dos-arquivos.md)                              |
| Triagem (pré-classificação)         | `pre-classificacao.yml`, no fim do robô                                                      | [[modulo-triagem]]                                                                      |
| Conferências de consistência        | `conferencias.yml`, 6h                                                                       | [[modulo-conferencias]]                                                                 |
| Pacotes dos painéis                 | `pacotes-dos-paineis.yml`, pedido pela rodada                                                | [[python-e-jobs]]                                                                       |
| Classificação em Python             | `classificacao.yml`                                                                          | [[classificacao-por-dentro]]                                                            |
| Contratação e casamento da lista    | `contratacao-dos-aprovados.yml`, `casamento-da-lista.yml`                                    | [[modulo-aprovados]]                                                                    |
| Sincronização das planilhas         | `sincronizar-entrevistas.yml`, `sincronizar-selecao.yml` (agenda desligada desde 16/10/2026) | [docs/sincronizacao-das-planilhas.md](../sincronizacao-das-planilhas.md), [[planilhas]] |

Editais com **inscrições congeladas** ficam fora da carga e da triagem. A Empregare não tem API: o
robô usa Selenium com Chrome headless, em lotes de 10 vagas.

## Tela: Configurações › Automação

Chaves para ligar e desligar o que roda sozinho em cada aba, com motivo e histórico. Pasta
`src/modulos/automacao/`. Explicações para a Aya:
[regras-da-automacao](../aya/regras-da-automacao.md) (a explicação mora lá, não na interface).

- Uma chave por aba liga ou desliga as tarefas do pg_cron da chave e a agenda dos robôs. Desde
  20261109180000 **a chave manda**: a tarefa `agsus_alinhar_chaves_da_automacao` põe toda tarefa
  com chave no estado da chave a cada 5 min. Desligada, a agenda não pede nada ao GitHub; o Rodar
  agora continua, com confirmação.
- Cada linha mostra o estado, a última e a próxima execução e quem mudou, quando e por quê.
- Ligar ou desligar é uma chave por vez e pede motivo (`alterar_chave_da_automacao`); o banco grava
  o histórico e devolve a lista nova. Leitura: `obter_chaves_da_automacao`.
- O "Rodar agora" não fica aqui: fica no Status das atualizações.
- Arquivos: `automacao.tsx` (a tela), `estado.ts` (chaves lidas, mudança em curso e aviso da última
  recusa, sem React), `automacao.css`; regras puras em `src/lib/automacao/chaves-da-automacao.ts`. Banco:
  `supabase/migrations/20261022190000_chaves_da_automacao.sql` (aplicada; no histórico do Git).
  Agenda e chaves explicadas em [docs/agenda-dos-robos.md](../agenda-dos-robos.md) (seção "Chaves
  da automação").

## Tela: Status das atualizações (antes "Saúde das cargas")

Última execução e atraso de cada carga e robô, detalhes, histórico, acompanhamento dos pedidos,
execução imediata ("Rodar agora") e formulário de opções dos robôs. Pasta
`src/componentes/saude-das-cargas/`, toda em React e TypeScript. Banco:
`supabase/migrations/20261001120000_saude_das_cargas.sql` (aplicada; no histórico do Git).
Explicações para a Aya:
[regras-do-status-das-atualizacoes](../aya/regras-do-status-das-atualizacoes.md).

- **Como saber se está funcionando:** a seção **Agenda dos robôs** (último pedido aceito, falhas e
  pedidos sem chave em 24 h) e o selo de atraso de cada carga. `agsus_robo_conferir_disparos` lê as
  respostas do GitHub a cada 15 min.
- **Disparo e acompanhamento:** `disparar_robo` cria o pedido e `situacao_do_disparo_robo`
  acompanha. Primeira conferência após 3 s; os pedidos esperam 60 s antes da releitura, que só sai
  com a seção aberta e a aba visível; o botão fica bloqueado enquanto houver execução ou pedido
  recente. O cartão de avisos das [[modulo-conferencias]] relê só quando muda a última conferência
  (`marcaDasConferencias`).
- Arquivos: `estado.ts` (estado lido com `useSyncExternalStore`), `tipos.ts` (dados, dependências e
  ações); em `src/lib/`, `saude-das-cargas.ts` (normaliza as cargas, calcula selos e resumo),
  `painel-dos-robos.ts` (normaliza editais, vagas, histórico; monta filtros, prévia e
  acompanhamento) e `robos-de-carga.ts` (compartilhado com a Avaliação documental).
- **Fronteiras:** recebem `unknown`, conferem objetos e listas, descartam o que não é registro e
  tratam datas e números inválidos. Texto não exibe objeto serializado; rótulos de dicionário não
  vêm de propriedade herdada. Links de execução só HTTP ou HTTPS. Isso não substitui a autorização
  do banco. Consumidores que continuam em JavaScript não são todos verificados pelo compilador.
- Testes: saúde, painel, treinamento, formulário e API;
  `tests/saude-das-cargas-fronteiras.test.js` (respostas malformadas e disparo simulado);
  `tests/tipos/saude-das-cargas.tsx` (contratos e rejeições). Rede bloqueada.

## Relacionadas

- [[python-e-jobs]] — como escrever um job
- [[planilhas]] — as cargas de planilha acompanhadas no Status
- [[modulo-configuracoes]] — a moldura das seções de Configurações
- [[seguranca]] — o token no Vault e os logs públicos
- [[dados-pessoais]] — o que não sai no log
