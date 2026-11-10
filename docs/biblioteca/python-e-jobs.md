---
tipo: guia
area: operacao
atualizado: 2026-11-10
---

# Python e jobs

O Python faz o trabalho **pesado, em lote e de conferência** (decisão de 05/10/2026: usar mais o
Python para deixar o sistema mais robusto). O guia completo, com cada entrega (conferências,
triagem, classificação, pacotes dos painéis, contratação, casamento da lista), está em
[docs/python-no-monitora.md](../python-no-monitora.md).

## O que o Python não substitui

- A lógica que precisa ser instantânea na tela (filtros, prévias, validação do formulário): fica em
  TypeScript, em `src/lib/`.
- A validação do banco: permissão e integridade são das RPCs `SECURITY DEFINER`. O Python chama RPC
  como qualquer outro cliente.

## Onde roda

|              | Funções da Vercel (`api/*.py`)                           | Jobs no GitHub Actions (`scripts/<job>/`)                         |
| ------------ | -------------------------------------------------------- | ----------------------------------------------------------------- |
| Para quê     | pedido curto de quem está na tela (ler um PDF)           | trabalho pesado ou em lote: robô, conferências, recálculos        |
| Quem dispara | o navegador, com o Bearer de quem está logado            | agenda do banco (pg_cron → `workflow_dispatch`), Rodar agora, Run workflow |
| Credencial   | a do usuário; nunca a `service_role`                     | `SUPABASE_SERVICE_ROLE_KEY` dos secrets, só em RPCs do `service_role` |
| Limites      | plano Hobby: `maxDuration: 30`, corpo ~4,5 MB, pacote pequeno | o `timeout-minutes` do workflow (robô 120 min, conferências 20 min) |
| Log          | o da Vercel (privado)                                    | **público**: só contagens, códigos e números de edital            |

Regra prática: se pode passar de alguns segundos, mexer em muitas linhas ou precisar de biblioteca
grande, é **job**. Função da Vercel é para o que a pessoa espera com a tela aberta
([[funcoes-da-vercel]]).

## A base comum: `python/monitora/`

Só biblioteca padrão: `config` (variável de ambiente com erro claro, sem mostrar o valor),
`mascaramento` (tira e-mail, CPF, telefone, JWT, dígitos longos e segredos), `registro` (logger que
mascara tudo), `supabase_rpc` (RPC com a `service_role`, repete só erro de rede/5xx), `execucao`
(disparo AGENDA/MONITORA/GITHUB, resumo no `GITHUB_STEP_SUMMARY`), `fuso` (`hoje_em_brasilia()`:
o runner é UTC, nunca `date.today()`). Domínio: `avaliacao_documental`, `entrevistas.calculo`,
`classificacao` (cópia fiel do `motor.ts`), `cargos`.

## Padrões

- **Banco só por RPC**, mesmo com a `service_role`: RPC `SECURITY DEFINER`, `search_path ''`,
  `revoke … from public, anon, authenticated`, `grant execute … to service_role`. RPC de job não
  entra no contrato do front ([[rpc-e-contrato]]).
- **Nada de dado pessoal no log nem no resultado** ([[dados-pessoais]]).
- Log de execução no banco (`TL_…`: início, fim, situação `EM_ANDAMENTO`/`CONCLUIDA`/`PARCIAL`/
  `FALHOU`, quem disparou, endereço da execução), que entra no Status das atualizações.
- Saída do processo: 0 concluída, 2 parcial, 1 erro. Inputs do workflow vão por variável de
  ambiente, nunca interpolados no shell.
- **Regra duplicada JS × Python = caso dourado compartilhado** em `tests/fixtures/<assunto>/`, lido
  pelo Vitest e pelo pytest.
- Testes em `tests/python/test_<job>.py`, com banco falso e dados fictícios. Lint e formatação:
  `ruff check .` e `ruff format --check .` (`ruff.toml`); `pytest.ini` põe `python/` no caminho.
  O `pyproject.toml` da raiz é só das dependências das funções `api/*.py`; o job tem o próprio
  `requirements.txt` (ex.: `scripts/robo-empregare/requirements.txt`).

## Relacionadas

- [[robos-e-agenda]] — quem dispara os jobs
- [[modulo-classificacao]] e [[modulo-triagem]] — as contas em Python
- [[ci-e-qualidade]] — o job "Python (ruff e pytest)"
