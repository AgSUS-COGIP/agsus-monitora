---
tipo: guia
area: operacao
atualizado: 2026-11-10
---

# Robôs e agenda

Os robôs rodam no GitHub Actions (Python e Node) e gravam no banco por RPC. **O banco é o único
agendador**: o `schedule` do GitHub Actions, no plano gratuito, atrasa e pula execuções, então o
pg_cron chama `private."FC_DISPARAR_ROBO"`, que pede a execução ao GitHub (`workflow_dispatch`,
ramo `main`, `disparado_por = AGENDA`) pelo pg_net. Os workflows não têm `schedule`. Guia
completo, com os horários de cada tarefa: [docs/agenda-dos-robos.md](../agenda-dos-robos.md).

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
  `obter_catalogo_dos_robos` (`src/lib/catalogo-dos-robos.ts`). Não há RPC de escrita: o catálogo
  muda só por migration.
- **Nome de robô ou de tarefa não se escreve à mão na tela:** vem do catálogo. **Horário também
  não:** `src/lib/agenda-do-cron.ts` é a leitura única da agenda do pg_cron (próxima execução,
  maior intervalo, texto em horário de Brasília), usada pelo Status das atualizações e pela
  Automação.
- Workflow novo: `insert` em `TB_ROBO_WORKFLOW` (e em `TB_TAREFA_AGENDADA` se uma tarefa o pedir);
  se tiver "Rodar agora", entra em `disparar_robo` e em `ROBOS_DE_CARGA`
  (`src/lib/robos-de-carga.ts`). `tests/catalogo-dos-robos-migration.test.ts` reprova robô fora do
  catálogo.

## Ligar e desligar

Pela tela **Configurações › Automação** (só administrador global), com motivo e histórico: uma
chave por aba ([[modulo-automacao]]). Desde 20261109180000 **a chave manda**: a tarefa
`agsus_alinhar_chaves_da_automacao` põe toda tarefa com chave no estado da chave a cada 5 min.
Desligada, a agenda não pede nada ao GitHub; o Rodar agora continua, com confirmação.

## Os robôs

| Robô                                   | Onde                                             | Guia                                                       |
| -------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| Robô da Empregare (inscritos)          | `scripts/robo-empregare/`, `robo-empregare.yml`  | [docs/robo-empregare.md](../robo-empregare.md)             |
| Leitura dos arquivos dos candidatos    | `leitura-de-arquivos.yml` (só Run workflow)      | [docs/leitura-dos-arquivos.md](../leitura-dos-arquivos.md) |
| Triagem (pré-classificação)            | `pre-classificacao.yml`, no fim do robô          | [[modulo-triagem]]                                         |
| Conferências de consistência           | `conferencias.yml`, 6h                           | [[modulo-conferencias]]                                    |
| Pacotes dos painéis                    | `pacotes-dos-paineis.yml`, pedido pela rodada    | [[python-e-jobs]]                                          |
| Classificação em Python                | `classificacao.yml`                              | [[classificacao-em-python]]                                |
| Contratação e casamento da lista       | `contratacao-dos-aprovados.yml`, `casamento-da-lista.yml` | [[modulo-aprovados]]                              |
| Sincronização das planilhas            | `sincronizar-entrevistas.yml`, `sincronizar-selecao.yml` (agenda desligada desde 16/10/2026) | [[cargas-de-planilha]] |

Editais com **inscrições congeladas** ficam fora da carga e da triagem. A Empregare não tem API: o
robô usa Selenium com Chrome headless, em lotes de 10 vagas.

## Como saber se está funcionando

Configurações › Status das atualizações › **Agenda dos robôs** (último pedido aceito, falhas e
pedidos sem chave em 24 h) e o selo de atraso de cada carga ([[modulo-status-das-atualizacoes]]).
`agsus_robo_conferir_disparos` lê as respostas do GitHub a cada 15 min.

## Relacionadas

- [[python-e-jobs]] — como escrever um job
- [[seguranca]] — o token no Vault e os logs públicos
- [[dados-pessoais]] — o que não sai no log
