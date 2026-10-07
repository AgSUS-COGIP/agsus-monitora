# Python no MONITORA

Decisão do usuário (05/10/2026): _"pode usar mais o Python, incluir em análises, entrevistas, lista
de classificação, etc."_ — para deixar o sistema mais robusto. Este documento diz **onde** o Python
roda, **o que** ele faz (e o que não faz), **como** criar um job ou uma função nova e o **roteiro**
das próximas entregas.

## O papel do Python

O Python faz o trabalho **pesado, em lote e de conferência**. Ele **não** substitui:

- a lógica que precisa ser instantânea na tela (filtros, prévias, validação do formulário) — essa
  fica em JavaScript, em `src/lib/`;
- a validação do banco — quem decide permissão e integridade são as RPCs `SECURITY DEFINER` do
  Supabase. O Python chama RPC como qualquer outro cliente.

## Onde roda

|              | Funções da Vercel (`api/*.py`)                                                                                     | Jobs no GitHub Actions (`scripts/<job>/`)                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Para quê     | pedido curto de quem está na tela (ler um PDF, gerar um arquivo pequeno)                                           | trabalho pesado ou em lote: robô, conferências, recálculos, documentos grandes                                                     |
| Quem dispara | o navegador, com o Bearer do Supabase de quem está logado                                                          | agenda do banco (pg_cron → `workflow_dispatch`, [agenda-dos-robos.md](agenda-dos-robos.md)), o **Rodar agora** ou o "Run workflow" |
| Credencial   | a do usuário (o banco decide pela RLS/RPC); nunca a `service_role`                                                 | `SUPABASE_SERVICE_ROLE_KEY` dos secrets do repositório, só em RPCs concedidas ao `service_role`                                    |
| Limites      | plano **Hobby**: tempo curto (hoje `maxDuration: 30` no `vercel.json`), corpo do pedido de ~4,5 MB, pacote pequeno | até o `timeout-minutes` do workflow (robô: 120 min; conferências: 20 min)                                                          |
| Dependências | só `requirements.txt` da raiz (hoje: `pdfplumber`) — tudo ali entra em toda função Python                          | `requirements.txt` próprio do job (ex.: `scripts/robo-empregare/requirements.txt`) ou nenhum                                       |
| Log          | o da Vercel (privado)                                                                                              | **público** (o repositório é público): só contagens, códigos e números de edital                                                   |

Regra prática: se pode passar de alguns segundos, mexer em muitas linhas ou precisar de biblioteca
grande, é **job**. Função da Vercel é para o que a pessoa espera com a tela aberta.

## A base comum: `python/monitora/`

Só biblioteca padrão — não pesa na Vercel nem nos jobs.

| Módulo                  | O que faz                                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `monitora.config`       | `ler("NOME", obrigatoria=…, aceitar=…, dica=…)` e `inteiro(…)`: variável de ambiente com erro claro (`ErroDeConfiguracao`), que cita o nome e nunca o valor |
| `monitora.mascaramento` | `mascarar(texto)`: tira e-mail, CPF, telefone, token JWT, sequências longas de dígitos e o valor das variáveis secretas; `resumo_do_erro(erro)`             |
| `monitora.registro`     | `registro("nome")`: logger que passa toda mensagem (e exceção) pelo mascaramento                                                                            |
| `monitora.supabase_rpc` | `configuracao(guia)` e `chamar(config, "rpc", corpo)`: RPC com a `service_role`, repetindo só erro de rede/5xx, erro mascarado                              |
| `monitora.execucao`     | `disparo(...)` (AGENDA/MONITORA/GITHUB), `identificador(prefixo=…)`, `url_da_execucao()` e `resumir(titulo, linhas)` (GITHUB_STEP_SUMMARY)                  |

Quem usa hoje: o robô da Empregare (`scripts/robo-empregare/`), as conferências
(`scripts/conferencias/`), a pré-classificação da Avaliação documental (`scripts/pre_classificacao/`,
com a conta em `monitora.avaliacao_documental`) e o expurgo diário dos anexos do chat
(`scripts/expurgo_anexos_chat/`, com `monitora.chat.expurgo`).

| Módulo de domínio                                 | O que faz                                                                                                                                |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `monitora.avaliacao_documental.nota_declarada`    | a ART lida da Empregare e a nota declarada pela regra (cópia fiel de `nota-declarada.js`)                                                |
| `monitora.avaliacao_documental.pre_classificacao` | eliminação automática, Provisória por ART, tamanho do lote e "a linha anda" (cópia fiel de `pre-classificacao.js`)                       |
| `monitora.avaliacao_documental.distribuicao`      | distribuição das fichas (menor carga, limites) e as fichas novas da distribuição inicial (cópia fiel de `distribuicao.js`)               |
| `monitora.entrevistas.calculo`                    | nota por competência, total e parecer da entrevista, com ou sem aspectos (a regra de `FC_CALCULAR_ENTREVISTA` e de `calcularEntrevista`) |
| `monitora.chat.expurgo`                           | tira do Storage, em lotes, os arquivos da fila de expurgo dos anexos do chat (API do Storage com a `service_role`)                       |

### Importar a base

- **Job:** o script de entrada põe a pasta no caminho antes dos imports:

  ```python
  sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "python"))
  from monitora import supabase_rpc  # noqa: E402
  ```

- **Função da Vercel:** o mesmo, a partir de `api/` (`parents[1] / "python"`), **e** a pasta no
  pacote da função pelo `vercel.json` (o teste `tests/python/test_monitora.py` cobra):

  ```json
  "functions": { "api/minha-funcao.py": { "maxDuration": 30, "includeFiles": "python/monitora/**" } }
  ```

  Não crie `pyproject.toml` na raiz: a Vercel o leria como projeto Python. As ferramentas ficam em
  `ruff.toml` e `pytest.ini`.

- **Testes:** `pytest.ini` já põe `python/` no caminho (`pythonpath = python`).

## Padrões

- **Banco só por RPC.** O job não lê tabela direto, nem com a `service_role`: cria RPC
  `SECURITY DEFINER`, `search_path ''`, `revoke … from public, anon, authenticated` e
  `grant execute … to service_role` (ver `20261005170000_robo_empregare.sql` e
  `20261005210000_conferencias_de_consistencia.sql`). RPC de job **não** entra em
  `src/lib/rpc-contrato.js` (o contrato é do front); a que a tela chama, entra.
- **Nada de dado pessoal no log nem no resultado.** Leitura para o job devolve id, código, número
  de edital, contagem; quando precisa achar a mesma pessoa em duas listas, vai um hash. O que o job
  grava para a tela também (os avisos de conferência recusam espaço, `@` e 11 dígitos nos
  exemplos e nos casos); cada caso diz o que a referência é (`tipo`: aprovado, entrevista, lista,
  ajuste, vaga) e nome, vaga, situação e responsável a RPC da tela busca na hora, com a permissão
  de quem lê naquele módulo (`listar_casos_aviso_conferencia`, 20261007120000 e 20261007240000).
- **Log de execução no banco** (`TL_…`): início, fim, situação (`EM_ANDAMENTO`, `CONCLUIDA`,
  `PARCIAL`, `FALHOU`), quem disparou e o endereço da execução; a execução esquecida não segura a
  próxima. Entra no **Status das atualizações** (`get_saude_das_cargas` + `src/lib/saude-das-cargas.js`).
- **Rodar agora:** o workflow aceita `workflow_dispatch` com `modo` e `disparado_por`; o robô entra
  na lista fixa `ROBOS_DE_CARGA` de `src/lib/robos-de-carga.js` (id = id da linha do Status) e
  nas listas fixas de `disparar_robo` e `FC_DISPARAR_ROBO` (o banco pede ao GitHub com a chave do
  Vault; `docs/agenda-dos-robos.md`).
  Inputs vão por variável de ambiente, nunca interpolados no shell.
- **Saída do processo:** 0 concluída, 2 parcial, 1 erro.
- **Testes** em `tests/python/test_<job>.py`, com banco falso (função `chamar` injetada) e dados
  fictícios; nada fala com o Supabase.
- **Lint e formatação:** `ruff check .` e `ruff format --check .` (configuração em `ruff.toml`).
  O job "Python (ruff e pytest)" do Quality Gate roda os dois e o pytest em todo PR.

### Regra duplicada JS × Python = caso dourado compartilhado

Quando a mesma regra existe nos dois lados (o catálogo das conferências hoje; amanhã as listas
oficiais), os casos ficam num arquivo só em `tests/fixtures/<assunto>/` e **os dois** testes o
leem: o vitest (`tests/*.test.js`) e o pytest (`tests/python/test_*.py`). Exemplo:
`tests/fixtures/conferencias/catalogo.json`, conferido por `tests/avisos-de-conferencia.test.js` e
`tests/python/test_conferencias.py`. Mudou a regra num lado sem mudar no outro, um dos testes cai.

## Como criar um job novo

1. `scripts/<job>/<job>.py` (entrada, com docstring de uso), regras puras num módulo à parte
   (`regras.py`) e, se precisar de biblioteca, `scripts/<job>/requirements.txt`.
2. Migration com as RPCs (leitura e gravação só `service_role`), o `TL_` da execução, ensaio e
   rollback; a linha nova em `get_saude_das_cargas`.
3. `.github/workflows/<job>.yml`: só `workflow_dispatch` (`modo`, `disparado_por`) — sem `schedule`;
   se tiver agenda, o workflow entra na lista fixa de `FC_DISPARAR_ROBO` e ganha uma tarefa
   `agsus_robo_*` no pg_cron ([agenda-dos-robos.md](agenda-dos-robos.md)) — `concurrency`, `timeout-minutes`, secrets por `env`. Cabeçalho dizendo que o log é
   público.
4. Robô em `ROBOS_DE_CARGA` (`src/lib/robos-de-carga.js`) e a linha em `src/lib/saude-das-cargas.js`.
5. `tests/python/test_<job>.py`; verbete da Aya em `docs/aya/`; guia de operação em `docs/`.

## Como criar uma função `api/*.py` nova

1. `api/<nome>.py` com `class handler(BaseHTTPRequestHandler)` (ver `api/anexos-do-edital.py`):
   confere o Bearer em `/auth/v1/user`, limita o tamanho do corpo, responde JSON.
2. `vercel.json`: `maxDuration` curto e, se importar a base, `includeFiles: "python/monitora/**"`.
3. Biblioteca nova só se indispensável, no `requirements.txt` da raiz (entra em todas as funções).
4. Testes das funções puras em `tests/python/` (importando o arquivo por `importlib`).

## Primeira entrega: conferências de consistência

Job diário (6h de Brasília) e pelo **Rodar agora**: `scripts/conferencias/`, workflow
`conferencias.yml`, migration `20261005210000_conferencias_de_consistencia.sql`. Lê o banco pelas
RPCs `conferencia_ler_*` e grava avisos (`TB_AVISO_CONFERENCIA`), que aparecem no selo de cada tela e
no cartão "Avisos de conferência" do Status das atualizações. Histórias e critérios:
[historias-de-usuario/conferencias.md](historias-de-usuario/conferencias.md).

Limites conhecidos (a acertar com os dados reais, depois do ensaio):

- "Aprovado/Triados": nas análises só existe `Aprovado` (`status_consolidado`); "Triados" é uma
  contagem da Seleção. A conferência usa `Aprovado`.
- Teto de experiência: a regra de classificação ainda não tem esse campo. A conferência lê
  `documental.teto_experiencia` da versão vigente da regra e só confere os editais que o tiverem.
- Nota final × soma: confere `nota_final_ajustada` contra formação + cursos + experiência +
  critério étnico (tolerância 0,01), só quando as quatro parciais existem. Se algum edital somar de
  outro jeito, o aviso pode ser ignorado com motivo — e a regra, ajustada.
- Mesmo candidato em duas vagas da lista de aprovados: as listas não têm CPF; a pessoa é achada
  pelo código do candidato da análise ou, nas listas por planilha, pelo nome normalizado (em hash).

## Segunda entrega: pré-classificação da Avaliação documental

Job `scripts/pre_classificacao/pre_classificacao.py`, workflow `pre-classificacao.yml`, migration
`20261006110000_pre_classificacao_e_lote.sql`. Para cada edital (os pedidos, os da última carga do
robô ou os ativos com vagas da Empregare), lê a regra da avaliação e os inscritos de cada vaga **sem
o cadastro** (nome, e-mail, CPF, telefone e endereço não saem do banco), calcula a Provisória por
ART e o lote e grava o resultado pronto por vaga; o banco confere a forma e as travas e conta de
novo o resumo. No fim de cada edital gravado, lê a distribuição
(`pre_classificacao_ler_distribuicao`, sem nomes) e abre as fichas do lote
(`abrir_fichas_pre_classificacao`, migration `20261006120000_fichas_fila_e_reserva.sql`): na
distribuição inicial, depois que a coordenação distribuiu, as fichas novas já vão para quem tem
menos pendentes (`distribuicao.atribuicoes_dos_novos`); o banco valida cada atribuição, marca
"Fora do lote" quem saiu eliminado e o resumo mostra quantas fichas abriu, atribuiu e tirou do lote.

- **Quando roda:** no fim de cada carga normal ou forçada do robô da Empregare (passo
  "Pré-classificar" em `robo-empregare.yml`, `DISPARADO_POR=robo`, `--apos-robo`; uma falha ali não
  muda o resultado do robô), pelo "Recalcular" da aba Pré-classificação (só a coordenação do edital;
  a RPC `disparar_robo` confere `pode_recalcular_pre_classificacao` de quem clicou e
  manda `editais` = o id do edital), pelo "Rodar agora" do Status das atualizações (todos) e pelo
  "Run workflow".
- **Modos:** `normal`, `seco` (calcula e mostra o resumo; um edital com a regra ainda "Conferir"
  sai como prévia; sem regra, o resumo diz "edital sem regra conferida" e quantos inscritos
  aguardam) e `refazer_lote` (recorta o lote do zero; recusado por edital que já tem ficha, e o
  banco recusa tirar do lote quem tem ficha aberta).
- **Edital sem regra conferida:** não é gravado e não quebra a execução; aparece no resumo do
  Actions e na aba (`ultima_execucao.edital.situacao` = `SEM_REGRA` ou `REGRA_NAO_CONFERIDA`).
- **Casos dourados:** `tests/fixtures/avaliacao-documental/casos-de-pre-classificacao.json` (19
  casos, com o lote pela nota mínima e o desempate do 93/2026), a nota declarada de
  `casos-de-pontuacao.json` e a distribuição de `casos-de-distribuicao.json`, conferidos por
  `tests/lib/avaliacao-documental-pre-classificacao.test.js`, `…-distribuicao.test.js`,
  `tests/python/test_pre_classificacao.py` e `tests/python/test_distribuicao.py`.
- **Log público:** contagens, códigos de vaga e de aviso e números de edital. O resultado por edital
  que vai ao banco é recusado se tiver `@` ou 11 dígitos seguidos.

## Terceira entrega: expurgo diário dos anexos do chat

Job `scripts/expurgo_anexos_chat/expurgo_anexos_chat.py`, workflow `expurgo-anexos-chat.yml`,
migration `20261007250000_expurgo_diario_dos_anexos_do_chat.sql`. A retenção e o "Zerar mensagens"
apagam as linhas dos anexos e põem o arquivo na fila `TB_EXPURGO_ANEXO_CHAT`; o Storage não aceita
DELETE pelo SQL. Antes, só a seção Configurações › Mensagens (chat) tirava os arquivos, quando um
administrador global a abria. Agora o job faz o mesmo todo dia, com a `service_role`:

1. `preparar_expurgo_anexos_chat()` devolve até 100 caminhos da fila (e põe nela os arquivos
   enviados e nunca anexados há mais de 1 dia);
2. `DELETE /storage/v1/object/chat-anexos` remove pela API do Storage, em pedaços de 100 — só
   caminho no formato do bucket (`<uuid>/<uuid>.<extensão>`), porque a `service_role` passa por cima
   das políticas do bucket;
3. `confirmar_expurgo_anexos_chat(caminhos)` marca como expurgado só o que de fato saiu de
   `storage.objects`. O que falhou (pedido recusado, rede, arquivo que continua lá) fica na fila
   para o dia seguinte (ou para a tela).

Até 50 lotes (5.000 arquivos) por execução. Um caminho que falhou não é tentado de novo na mesma
execução; se a fila só devolver caminhos já tentados (os 100 mais antigos falhando), a execução
para e sai **PARCIAL** — confira no Status das atualizações.

- **Permissão:** as duas RPCs aceitam também a `service_role` (`FC_CHAT_EXIGIR_ADMIN_OU_SERVICO`);
  para quem usa o app continua só o administrador global.
- **Quando roda:** todo dia às 6h30 de Brasília (9h30 UTC), pelo "Rodar agora" do Status das
  atualizações e pelo "Run workflow".
- **Modos:** `normal` e `seco` (só lê a fila e diz quantos sairiam no primeiro lote; não remove,
  não confirma e não registra — a leitura da fila ainda põe nela os órfãos de mais de 1 dia).
- **Registro:** `registrar_expurgo_anexos_chat` grava em `TL_EXPURGO_ANEXO_CHAT` quem disparou e
  as contagens (lotes, removidos, confirmados, falhas, pendentes); `get_saude_das_cargas` devolve
  as 10 últimas em `expurgo_chat`. Saída 0 concluída, 2 parcial, 1 erro.
- **Log público:** só contagens — nunca caminho, nome de arquivo nem conteúdo. Mensagem de erro
  passa por `sem_caminhos` (tira os uuids) além do mascaramento; o banco omite a que ainda trouxer
  uuid, `@` ou 11 dígitos.
- **Testes:** `tests/python/test_expurgo_anexos_chat.py` (lotes, falha parcial, seco, log sem
  caminho) e `tests/expurgo-anexos-chat-migration.test.js`.

## Carga do banco: o que saiu do Postgres e o que vai para o Python (07/10/2026)

Pedido do usuário: _"temos que parar de sobrecarregar o banco; os cálculos da entrevista, de
análises etc. têm que ser em Python"_. Medição real em `pg_stat_statements` (banco no ar desde
02/10/2026 01:22, ~5,5 dias):

| O quê                                                | Chamadas | Média    | Total   |
| ---------------------------------------------------- | -------- | -------- | ------- |
| tarefa `agsus_aprovados_cache_por_area` (2 em 2 min) | 3.951    | 1.042 ms | 4.118 s |
| `realtime.list_changes` (Realtime lendo o WAL)       | 327.849  | 9 ms     | 3.107 s |
| tarefa `agsus_entrevistas_cache_do_painel`           | 3.953    | 686 ms   | 2.711 s |
| tarefa `agsus_analises_cache_do_painel`              | 3.952    | 613 ms   | 2.422 s |
| `finalizar_sync_analises_incremental`                | 1.153    | 1.457 ms | 1.680 s |
| `comparar_analises_incremental_v2`                   | 12.283   | 107 ms   | 1.319 s |
| `obter_marcos_da_area` (Visão geral)                 | 426      | 2.957 ms | 1.260 s |
| `get_monitoramento_dashboard_payload` (sem uso)      | 426      | 711 ms   | 303 s   |

WAL gerado no período: 4,5 GB — 1,8 GB do manifesto da comparação das análises, ~2 GB dos três
caches (JSON grande reescrito a cada remontagem). O banco está numa instância pequena: com o
banco ocioso, ler 3.400 linhas já em memória levou 300 ms (CPU estrangulada); a carga contínua das
tarefas deixava todo o resto lento.

### Feito nesta entrega (o banco só guarda e serve)

- **Caches só quando muda** (`20261007220000_caches_so_quando_muda.sql`, ver
  `docs/banco-de-dados.md` 6.5): gatilhos por comando marcam a área em `TL_ALTERACAO_CACHE`; as
  três tarefas só remontam a área marcada. Ensaio: sem mudança, **1.042/686/613 ms → 8/0,5/0,6
  ms** por execução; cada pacote igual ao cálculo completo antes e depois de mudanças. Estimativa:
  ~1.700 s/dia de tarefas → ~200–300 s/dia (remontagens só com mudança de verdade; a das
  Entrevistas continua de hora em hora, porque a carga horária regrava todas as linhas).
- **Marcos da Visão geral** lidos do pacote do painel de análises: **3,7 s → 1 ms**.
- **Lista de aprovados**: a versão vem da marca, não de uma soma sobre todos os candidatos:
  **105–1.936 ms → 23–47 ms** por área; com a versão que ainda vale, **20 ms → 1–2 ms**.
- **Sem WAL** para os três caches e as tabelas de passagem do sync das análises (`UNLOGGED`):
  ~3,5 dos 4,5 GB. É isso que pesa no `realtime.list_changes` — ele decodifica todo o WAL, mesmo
  o das tabelas fora da publicação. O sync deixa de regravar os editais iguais.
- **Seis índices sem nenhuma leitura** em 5,5 dias saem (`20261007220200_indices_sem_uso.sql`):
  cada linha que o sync grava em `TB_ANALISE_CURRICULAR` mexia em 19 índices.
- **`get_monitoramento_dashboard_payload` sai** (`20261007220100`): ninguém no código chama desde
  #305; as chamadas eram de abas com o bundle antigo, que já tratava o erro.
- **Realtime**: fora do chat (outro módulo), a tela assina só `TB_MONITORAMENTO_INDIGENA` (a
  releitura quando um edital muda, que o usuário vê) — nada a cortar ali. O custo do Realtime é a
  leitura do WAL a cada ~1,5 s, que caiu com o item acima.
- **Cálculo da entrevista em Python** (`monitora.entrevistas.calculo`, Decimal): os 15 casos
  dourados de `tests/fixtures/entrevistas/casos-de-calculo.json` passam no vitest
  (`calcularEntrevista`, a prévia da tela), no pytest e na própria `FC_CALCULAR_ENTREVISTA`
  (ensaio begin…rollback, um roteiro, uma entrevista e as avaliações fictícias por caso). Com
  aspectos (08/10/2026): os casos novos (`caso.aspectos`) rodam também no ensaio
  `supabase/ensaios/20261008100000_aspectos_da_entrevista.sql`, que leva o mesmo json (o vitest
  confere).

### Próximas entregas (plano, em ordem de ganho)

1. **Instantâneo dos painéis montado em Python** (aprovados, entrevistas, análises). Com as
   marcas, o banco só remonta o que mudou; o passo seguinte é o job ler as linhas por RPC (sem
   cadastro além do que o painel mostra), montar o JSON e gravar o instantâneo pronto por RPC de
   gravação (`service_role`), com o banco conferindo forma e tamanho. **Por que não agora:** a
   leitura que pesa (a `VW_ANALISES_DASHBOARD_BASE_TODOS`, 25 mil linhas) continua no banco e o
   instantâneo de 4–8 MB iria e voltaria pela rede; o ganho só aparece com a montagem
   **incremental por edital** (o job lê só as linhas dos editais marcados e troca só a parte
   deles no instantâneo). Pré-requisitos: a marca guardar o edital (hoje é por área), o
   instantâneo dividido por edital e o disparo ao fim de cada sync das análises (que vem do Apps
   Script, não do Actions — usar a RPC `disparar_robo` / `FC_DISPARAR_ROBO` ou um job
   agendado que só roda com marca). Estimativa: 5–7 dias; risco médio (latência entre o sync e o
   painel, hoje ≤ 2 min).
2. **Sincronizações das Entrevistas e da Seleção em Python** (hoje `scripts/sincronizar-*.mjs`).
   Mesmas RPCs de gravação; leitura da planilha pela conta de serviço do Google (JWT RS256 —
   precisa de `google-auth` ou `cryptography` no `requirements.txt` do job, a base `monitora` é só
   biblioteca padrão); as regras de `src/lib/entrevistas-da-planilha.js` e
   `src/lib/selecao-da-planilha.js` portadas com casos dourados compartilhados. Não alivia o banco
   (o custo é das RPCs), mas junta as cargas no mesmo lugar dos outros jobs. Junto: a carga das
   Entrevistas passar a gravar só a linha que mudou (hoje regrava as ~3.400 linhas e o `CO_SYNC` a
   cada hora, o que remonta o pacote e gera WAL). Estimativa: 3–4 dias; risco baixo.
3. **Recálculo em lote das entrevistas** com `monitora.entrevistas.calculo`: um job que, quando um
   roteiro muda (ou pelo Rodar agora), recalcula as entrevistas do edital e grava pela RPC que já
   valida (`lancar_notas_entrevista` ou uma de lote, `service_role`), e uma conferência diária
   (nota/parecer gravados × recalculados) no catálogo das conferências. O banco fica só com a
   validação e a gravação. Estimativa: 2–3 dias; risco baixo (a regra já tem os casos dourados).
4. **`finalizar_sync_analises_incremental`** (1,5 s por sync): medir de novo depois do
   `UNLOGGED` e dos índices; se continuar alto, a detecção de duplicados e de ausentes pode ir
   para o Apps Script/Python, que já tem a planilha inteira na mão.

## Roteiro das próximas entregas Python

Prioridade de cima para baixo. Estimativas em dias de trabalho de uma pessoa, contando testes,
ensaio e conferência no navegador.

### 1. Pré-classificação e lote de convocação depois do robô da Empregare (feita: ver acima)

Insumo da futura **Avaliação documental** (`docs/analises-no-monitora/` no branch
`docs/analises-no-monitora`, fases F2/F7/F8): depois que o robô grava os candidatos, um job lê as
respostas do questionário (nota declarada), calcula a pré-classificação e o lote de convocação de
cada vaga e grava por RPC; compara com a planilha enquanto ela existir.

- **Como:** job `scripts/pre-classificacao/`, disparado ao fim do robô (passo novo no workflow) e
  pelo Rodar agora; a conta fica no banco/`src/lib` e o Python orquestra, carrega e confere, com o
  arquivo de casos compartilhado (inclusive os do simulador da ficha).
- **Estimativa:** 4–6 dias. **Risco:** médio — depende das perguntas do questionário serem estáveis
  por edital e do piloto 93/2026 (vagas na Seleção; F0 do plano).

### 2. Listas oficiais grandes geradas no servidor

Hoje a Classificação Provisória por ART, os Resultados Preliminar/Final (Aptos e Inaptos) e a
Convocação para entrevista saem no navegador (`src/lib/classificacao/documento-sei.js`,
`documento-docx.js`, a partir do retrato da lista em `exportacao.js`). Com editais grandes isso pesa
na máquina de quem gera.

- **Como:** job (ou função curta, se couber nos 30 s) que lê o retrato registrado
  (`TB_LISTA_CLASSIFICACAO.DS_RESULTADO`) e gera HTML do SEI, texto e DOCX (`python-docx`, só no
  job). **Antes de trocar**, "testes dourados": um conjunto de retratos fictícios em
  `tests/fixtures/classificacao/` e a saída atual do JS gravada; o pytest compara a saída Python
  com ela (HTML normalizado e texto do DOCX). Só quando bater em todos os modelos (PRELIMINAR,
  CONVOCACAO, ENTREVISTA, FINAL, eliminados) o botão passa a pedir ao servidor; o código JS sai
  depois da confirmação do usuário.
- **Estimativa:** 6–8 dias. **Risco:** médio-alto — muitos textos-padrão e detalhes do SEI
  (numeração por classe, tabelas); a comparação dourada é o que segura.

### 3. Exportações XLSX pesadas

Exportações grandes (análises de uma área inteira, candidatos da Empregare com todas as colunas do
questionário, aprovados com histórico) geradas fora do navegador.

- **Como:** job sob demanda (Rodar agora com parâmetros) que gera o XLSX com `openpyxl` e guarda no
  Storage do Supabase com link temporário; ou função da Vercel para recortes pequenos. Dados pessoais
  só no arquivo, nunca no log; link com validade curta e só para quem pode ver o recorte.
- **Estimativa:** 3–4 dias. **Risco:** médio — permissão do arquivo gerado (o recorte tem de ser o
  da pessoa que pediu) e tamanho no Storage.

### 4. Leitura de PDFs (anexos), quando houver

Já existe a leitura do PDF de anexos do edital (`api/anexos-do-edital.py`, `pdfplumber`). Próximos:
anexos do candidato (documentos da avaliação documental) e conferência de PDFs publicados contra a
lista registrada.

- **Como:** PDF pequeno e com a tela aberta, função da Vercel (limite de ~4,5 MB por pedido); lote,
  job. OCR só em job (biblioteca pesada).
- **Estimativa:** 3–5 dias por tipo de documento. **Risco:** alto — PDFs escaneados e modelos que
  mudam; dados pessoais nos documentos (nada em log, nada fora do banco).

### Sempre

- Novas conferências entram no catálogo (`scripts/conferencias/catalogo.py`, o caso dourado e
  `src/lib/avisos-de-conferencia.ts`) com teste nos dois lados.
- Toda entrega Python segue os padrões acima: RPC, log sem dado pessoal, testes, ruff, Status das
  atualizações.
