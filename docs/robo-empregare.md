# Robô da Empregare

Guia para quem opera a carga dos candidatos da Empregare, inclusive na ausência de quem a montou.
Para rodar não é preciso credencial nenhuma no computador: basta ser administrador global do
MONITORA (botão **Rodar agora**) ou ter acesso ao repositório no GitHub.

## O que é

A Empregare não tem API. O robô (`scripts/robo-empregare/`, Python + Selenium com Chrome headless)
roda no GitHub Actions e, para cada vaga:

1. entra no portal da empresa (`corporate.empregare.com`) com o usuário do robô;
2. busca a vaga em **Vagas Anunciadas** → Processo Seletivo → **Relatório e Indicadores** →
   **Exportar Candidatos**, com as respostas do questionário e de competência;
3. espera o arquivo na **Central de Exportações** (até 12 voltas de 30 s) e baixa;
4. lê o Excel e grava no Supabase (`TB_EMPREGARE_CANDIDATO`, um candidato por vaga, com todas as
   colunas originais; log em `TL_SYNC_EMPREGARE`).

É a mesma sequência do robô antigo (repositório privado `COGIP_extracao-empregare`), sem planilha
local, sem caminho pessoal e sem senha no código.

### Quais vagas

A lista vem do MONITORA (RPC `listar_vagas_empregare`), não de planilha. O código da vaga é o da
aba **Seleção** (`TB_SELECAO_VAGA.CO_VAGA`, ex.: 177979, vindo da planilha Auditoria).

| Pedido                              | Vagas                                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| sem filtro (**Rodar agora**)        | vagas ativas com código cujo edital está **ativo** e **em curso**: sem cronograma, ou com alguma etapa terminando há no máximo **30 dias** |
| `editais` (ex.: `80/2026, 81/2026`) | as vagas desses editais, ativos ou não                                                                                                     |
| `vagas` (ex.: `177979`)             | só esses códigos, mesmo fora da Seleção                                                                                                    |

As nunca carregadas e as carregadas há mais tempo vão primeiro, até o **limite** (60 por execução;
cada vaga leva perto de meio minuto). Edital em curso com mais vagas que o limite completa nas
execuções seguintes.

### Regras da gravação

- **Chave do candidato** na vaga: o código do candidato/candidatura da Empregare; sem ele, o
  SHA-256 do CPF; sem CPF, o do e-mail. O CPF nunca vai em claro na chave. Linha sem nenhum dos
  três fica de fora (contada no log da execução).
- **Trava**: arquivo com menos da metade dos candidatos ativos que a vaga já tinha é **recusado**,
  só naquela vaga — nada é gravado nem desativado nela. Se a redução for real, rode com `forcar`.
- **Sem apagar**: quem sai do arquivo fica inativo (`ST_REGISTRO_ATIVO = N`, data de saída).
- **Mudanças**: cada linha guarda o hash das colunas; a data de atualização só muda quando alguma
  coluna muda.
- Quem lê (RPC `obter_candidatos_empregare`): Seleção ≥ editor, com a área e o recorte do edital;
  vaga sem edital, só o administrador global.

## Segredos a cadastrar (uma vez)

**GitHub** — repositório → Settings → Secrets and variables → **Actions** → New repository secret:

| Secret                      | O que é                                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `EMPREGARE_EMAIL`           | e-mail do usuário do robô no portal da Empregare (de preferência um usuário só do robô, não pessoal) |
| `EMPREGARE_SENHA`           | senha desse usuário                                                                                  |
| `SUPABASE_URL`              | já existe (o mesmo das planilhas)                                                                    |
| `SUPABASE_SERVICE_ROLE_KEY` | já existe (o mesmo das planilhas)                                                                    |

**Vercel** — projeto do MONITORA → Settings → **Environment Variables** (Production):

| Variável                | O que é                                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_DISPATCH_TOKEN` | fine-grained token do GitHub **só** com o repositório `AgSUS-COGIP/agsus-monitora` e a permissão **Actions: read and write** (nada mais) |

Para criar o token: GitHub → foto → Settings → Developer settings → Personal access tokens →
**Fine-grained tokens** → Generate new token → Resource owner **AgSUS-COGIP** → Only select
repositories: `agsus-monitora` → Repository permissions: **Actions → Read and write** → Generate.
Cole na Vercel e faça um novo deploy (as variáveis valem a partir do próximo). Anote a validade: ao
vencer, o botão passa a dizer que o GitHub recusou o pedido. Se a organização exigir aprovação de
tokens, um dono da organização precisa aprovar.

Sem o token, a tela mostra o estado normalmente e o botão diz "Falta configurar
GITHUB_DISPATCH_TOKEN na Vercel". O token nunca vai ao navegador: só a função `api/rodar-carga.js`
o usa.

## Como rodar

**Pelo MONITORA (administrador global):** Configurações → **Status das atualizações** → linha
**Robô da Empregare** (ou Seleção, ou Entrevistas) → **Rodar agora**. A função confere a sessão e se
a pessoa é administrador global no banco (`pode_disparar_carga`), aceita só as três cargas da lista
e não dispara o que já está rodando. O botão volta a ficar livre quando a execução termina.

**Pelo GitHub:** aba **Actions** → **Robô da Empregare** → **Run workflow**:

| Campo     | Para quê                                                                                                                                                                                                                   |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modo`    | `normal` (exporta e grava) · `seco` (só lista as vagas que exportaria; não entra na Empregare) · `fumaca` (só testa login e Central; não exporta nem grava) · `forcar` (aceita arquivo com menos da metade dos candidatos) |
| `editais` | opcional: números separados por vírgula                                                                                                                                                                                    |
| `vagas`   | opcional: códigos separados por vírgula                                                                                                                                                                                    |
| `limite`  | máximo de vagas (padrão 60)                                                                                                                                                                                                |

**Sem agenda automática** (decisão de 05/10/2026): o robô só roda quando um administrador clica em
"Rodar agora" ou alguém dispara pelo GitHub. Uma execução por vez (as outras esperam na fila); tempo limite de 2 h.

### Teste de fumaça (depois de cadastrar os segredos)

1. Actions → Robô da Empregare → Run workflow → modo **`fumaca`**: verde = o login funciona e a
   Central abre.
2. Modo **`seco`**: confere quantas vagas e quais códigos entrariam.
3. Modo **`normal`** com `vagas` = um código só: confira em Configurações › Status das
   atualizações e, no banco, `TB_EMPREGARE_CANDIDATO`.

## Ver se rodou

- Configurações › Status das atualizações, linha **Robô da Empregare**: selo, "atualizado há…" e,
  em Detalhes, as 10 últimas execuções com vagas pedidas, baixadas, com falha, recusadas e quem
  disparou (Rodar agora ou GitHub).
- No banco (SQL Editor):
  ```sql
  select "CO_SYNC", "DT_INICIO", "TP_SITUACAO", "TP_DISPARO", "QT_VAGA_PEDIDA", "QT_VAGA_BAIXADA",
         "QT_VAGA_FALHA", "QT_VAGA_RECUSADA", "QT_LINHA", "DS_MENSAGEM"
    from public."TL_SYNC_EMPREGARE" order by "DT_INICIO" desc limit 10;

  select "CO_VAGA", "TP_SITUACAO", "QT_CANDIDATO_ATIVO", "DT_ULTIMA_CARGA", "DS_MENSAGEM"
    from public."TB_EMPREGARE_VAGA" order by "DT_ATUALIZACAO" desc limit 20;
  ```

**O log do Actions é público** (o repositório é público): o robô imprime só contagens, códigos de
vaga e números de edital, e toda mensagem passa pelo mascaramento (`mascaramento.py`). Nunca cole
dado de candidato em issue, PR ou log.

## Quando falha

| O que aparece                                              | O que fazer                                                                                                                                                                              |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Falta EMPREGARE_EMAIL` / `EMPREGARE_SENHA`                | Cadastre os secrets (acima).                                                                                                                                                             |
| `A Empregare não aceitou o login`                          | A senha mudou ou o usuário foi bloqueado. Entre no portal com o usuário do robô, acerte e atualize o secret `EMPREGARE_SENHA`. Rode `fumaca`.                                            |
| `não consegui pedir a exportação` em todas as vagas        | A Empregare mudou a tela (botões, textos ou ids). Rode `fumaca`; se o login passa, os seletores em `scripts/robo-empregare/navegador_empregare.py` (`exportar_vaga`) precisam de ajuste. |
| `exportação ainda não disponível` até acabar as tentativas | A Empregare demorou a gerar os arquivos. Rode de novo mais tarde (as vagas que faltaram vão primeiro).                                                                                   |
| `RECUSADA pela trava`                                      | O arquivo veio com menos da metade dos candidatos. Confira a vaga na Empregare; se a redução for real, rode `forcar` com `vagas` = o código.                                             |
| `Já há uma execução do robô da Empregare em andamento`     | Outra execução está aberta. Espere; uma execução que morreu sem fechar é liberada sozinha depois de 3 h.                                                                                 |
| `… respondeu 404` com `listar_vagas_empregare`             | A migration `20261005170000_robo_empregare.sql` ainda não foi aplicada.                                                                                                                  |
| `… respondeu 401`                                          | A `service_role` do Supabase mudou: atualize `SUPABASE_SERVICE_ROLE_KEY`.                                                                                                                |
| Botão: "O GitHub recusou o pedido"                         | O `GITHUB_DISPATCH_TOKEN` venceu ou não tem "Actions: read and write" no repositório. Gere outro e atualize na Vercel.                                                                   |

Situações da execução: **CONCLUIDA** (todas as vagas gravadas), **PARCIAL** (alguma vaga falhou,
foi recusada ou ficou no meio — o workflow fica vermelho para avisar), **FALHOU** (erro geral ou
nenhuma vaga baixada). Nada que já estava gravado se perde em nenhum dos casos.

## Rodar no computador (opcional)

Só para conferir; para gravar, use o botão do MONITORA ou do GitHub.

```sh
python -m pip install -r scripts/robo-empregare/requirements.txt
python -m pytest tests/python
```

O modo `--fumaca` precisa só de `EMPREGARE_EMAIL` e `EMPREGARE_SENHA` no ambiente (nunca em
arquivo do repositório). Os outros modos leem o MONITORA com a `service_role`, que não deve ficar no
computador: rode-os pelo GitHub.

## Arquivos

- `.github/workflows/robo-empregare.yml`: disparo manual, botão e segredos.
- `scripts/robo-empregare/robo_empregare.py` (entrada), `navegador_empregare.py` (Selenium),
  `planilha_empregare.py` (leitura do Excel e chave), `supabase_rpc.py`, `mascaramento.py`,
  `requirements.txt` (separado do da raiz, para não pesar as funções da Vercel).
- `api/rodar-carga.js` e `src/lib/robos-de-carga.js`: o **Rodar agora** (lista fixa robô →
  workflow, regras do botão).
- `src/componentes/saude-das-cargas/` e `src/lib/saude-das-cargas.js`: a tela de status.
- `supabase/migrations/20261005170000_robo_empregare.sql` (+ `ensaios/` e `rollback/`).
- Testes: `tests/python/test_robo_empregare.py`, `tests/rodar-carga-api.test.js`,
  `tests/robo-empregare-migration.test.js`, `tests/saude-das-cargas.test.js`,
  `tests/componentes/saude-das-cargas.test.js`.
