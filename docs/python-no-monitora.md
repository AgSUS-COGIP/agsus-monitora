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

|              | Funções da Vercel (`api/*.py`)                                                                                     | Jobs no GitHub Actions (`scripts/<job>/`)                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Para quê     | pedido curto de quem está na tela (ler um PDF, gerar um arquivo pequeno)                                           | trabalho pesado ou em lote: robô, conferências, recálculos, documentos grandes                  |
| Quem dispara | o navegador, com o Bearer do Supabase de quem está logado                                                          | agenda (`schedule`), o **Rodar agora** (`api/rodar-carga.js`) ou o "Run workflow"               |
| Credencial   | a do usuário (o banco decide pela RLS/RPC); nunca a `service_role`                                                 | `SUPABASE_SERVICE_ROLE_KEY` dos secrets do repositório, só em RPCs concedidas ao `service_role` |
| Limites      | plano **Hobby**: tempo curto (hoje `maxDuration: 30` no `vercel.json`), corpo do pedido de ~4,5 MB, pacote pequeno | até o `timeout-minutes` do workflow (robô: 120 min; conferências: 20 min)                       |
| Dependências | só `requirements.txt` da raiz (hoje: `pdfplumber`) — tudo ali entra em toda função Python                          | `requirements.txt` próprio do job (ex.: `scripts/robo-empregare/requirements.txt`) ou nenhum    |
| Log          | o da Vercel (privado)                                                                                              | **público** (o repositório é público): só contagens, códigos e números de edital                |

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

Quem usa hoje: o robô da Empregare (`scripts/robo-empregare/`) e as conferências
(`scripts/conferencias/`).

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
  exemplos).
- **Log de execução no banco** (`TL_…`): início, fim, situação (`EM_ANDAMENTO`, `CONCLUIDA`,
  `PARCIAL`, `FALHOU`), quem disparou e o endereço da execução; a execução esquecida não segura a
  próxima. Entra no **Status das atualizações** (`get_saude_das_cargas` + `src/lib/saude-das-cargas.js`).
- **Rodar agora:** o workflow aceita `workflow_dispatch` com `modo` e `disparado_por`; o robô entra
  na lista fixa `ROBOS_DE_CARGA` de `src/lib/robos-de-carga.js` (id = id da linha do Status).
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
3. `.github/workflows/<job>.yml`: `schedule` (se tiver agenda) + `workflow_dispatch` (`modo`,
   `disparado_por`), `concurrency`, `timeout-minutes`, secrets por `env`. Cabeçalho dizendo que o log é
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

## Roteiro das próximas entregas Python

Prioridade de cima para baixo. Estimativas em dias de trabalho de uma pessoa, contando testes,
ensaio e conferência no navegador.

### 1. Pré-classificação e lote de convocação depois do robô da Empregare

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
  `src/lib/avisos-de-conferencia.js`) com teste nos dois lados.
- Toda entrega Python segue os padrões acima: RPC, log sem dado pessoal, testes, ruff, Status das
  atualizações.
