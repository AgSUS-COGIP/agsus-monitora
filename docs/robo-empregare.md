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
3. enquanto a Empregare gera o arquivo, abre as **candidaturas da vaga** e guarda os links para
   a ficha da avaliação documental (abaixo);
4. espera o arquivo na **Central de Exportações** (até 12 voltas de 30 s) e baixa;
5. lê o Excel e grava no Supabase (`TB_EMPREGARE_CANDIDATO`, um candidato por vaga, com todas as
   colunas originais; log em `TL_SYNC_EMPREGARE`).

É a mesma sequência do robô antigo (repositório privado `COGIP_extracao-empregare`), sem planilha
local, sem caminho pessoal e sem senha no código.

### Quais vagas

A lista vem do MONITORA (RPC `listar_vagas_empregare`), de duas fontes (desde a migration
`20261006080000_robo_empregare_vagas_do_quadro.sql`):

1. **Quadro de vagas do edital** (fonte principal daqui para frente): todo edital com quadro de
   vagas salvo (`TB_QUADRO_VAGA_EDITAL` vigente). O quadro não guarda o código da vaga da
   Empregare; o código (ex.: 177979) vem das **análises ativas do edital**
   (`TB_ANALISE_CURRICULAR.codigo_vaga`, mesma área e mesmo número de edital), que o MONITORA já
   liga à linha do quadro na tela do quadro e na Classificação (`FC_QUADRO_DA_VAGA`). Edital e área
   são os do edital do quadro.
2. **Seleção** (segunda fonte, editais antigos): `TB_SELECAO_VAGA.CO_VAGA`, da planilha Auditoria.

3. **Vagas já ligadas ao edital** (desde `20261009140000_acompanhamento_das_inscricoes.sql`):
   `TB_EMPREGARE_VAGA.CO_MONITORAMENTO` preenchido por uma carga anterior ou por correção de dados.
   É o caminho do edital **em inscrição**, que ainda não tem análise (de onde o quadro tira o
   código) nem Seleção — ex.: `supabase/correcoes/20261009-edital-114-vagas-da-empregare.sql`.

O mesmo código em mais de uma fonte entra **uma vez** (quadro, depois Seleção, depois ligada). Cada
vaga da lista diz a origem (`quadro`, `selecao`, `ligada` ou `pedida`), e o log da execução mostra
a contagem por origem. Edital sem quadro, fora da Seleção e sem vaga ligada não entra sozinho: salve
o quadro de vagas do edital (no formulário do edital, pelo PDF de anexos), ligue os códigos ao
edital ou rode pelo **Opções** (ou pelo GitHub) com os códigos. Uma vaga pedida que já está ligada
a um edital mantém a ligação (a gravação nunca apaga o edital da vaga).

| Pedido                              | Vagas                                                                                                                                                 |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| sem filtro (**Rodar agora**)        | vagas com código, das duas fontes, cujo edital está **ativo** e **em curso**: sem cronograma, ou com alguma etapa terminando há no máximo **30 dias** |
| `editais` (ex.: `80/2026, 81/2026`) | as vagas desses editais, ativos ou não                                                                                                                |
| `vagas` (ex.: `177979`)             | só esses códigos, mesmo fora do quadro e da Seleção (origem `pedida`, sem edital)                                                                     |

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
- **Edital da vaga** (`TB_EMPREGARE_VAGA.CO_MONITORAMENTO`): pelo quadro do edital; sem ele, pela
  Seleção; vaga pedida fora das duas fica sem edital (só o administrador global vê).
- **Mudanças**: cada linha guarda o hash das colunas; a data de atualização só muda quando alguma
  coluna muda.
- Quem lê (RPC `obter_candidatos_empregare`): Seleção ≥ editor, com a área e o recorte do edital;
  vaga sem edital, só o administrador global.

### Links para a ficha (migration `20261007160000_link_do_candidato_na_empregare.sql`)

O endereço da vaga com o código numérico dá "Sem permissão" na Empregare. Por isso o robô guarda:

- o **identificador interno da vaga** (o trecho de `/empresa/vagas/candidaturas/<id>|`, lido do
  link "Processo Seletivo" da busca), em `TB_EMPREGARE_VAGA.CO_VAGA_INTERNO`;
- o **link de detalhes de cada candidato** (`/empresa/curriculo/detalhes?tokenCandidato=…`), em
  `TB_EMPREGARE_CANDIDATO.DS_LINK_DETALHE`. Ele abre as candidaturas da vaga direto na aba Todos (`…/candidaturas/<id>|?m=0`; sem o `m`, a página abre numa etapa padrão e quem foi movido de etapa some), carrega
  a lista inteira (espera até 20 s o AJAX da 1ª página, de 15; rola até o fim enquanto vierem
  mais, parando após 2 rolagens sem novidade; até 120 s por vaga e 25 min por
  execução) e casa o `data-pessoa-id` de cada candidato com o código do Excel.

Os tokens podem mudar: cada execução recaptura; sem link novo, fica o anterior. Se a lista falhar,
o log diz `não consegui ler a lista de candidatos` e a vaga é exportada e gravada do mesmo jeito.
Os links levam tokens da área logada: só a ficha (`obter_ficha_analise`, para quem pode ver a
ficha) os devolve; nunca vão para lista, CSV ou log (o log mostra só `N link(s) de candidato` e
`N com link da Empregare`). Banco sem a migration: o robô grava como antes e avisa. Se o log
disser `(N com link fora do formato)`, o link traz caractere que a CK `CK_EMPREGCAND_DSLINKDETALHE`
não aceita: ajuste a CK (migration) e `_LINK_DETALHE` em `navegador_empregare.py` juntos.

Cada vaga ganha uma linha `diagnóstico da lista` (sem token, nome ou CPF): o caminho da página
com o identificador mascarado (ex.: `/empresa/vagas/candidaturas/<id>` ou uma página de "Sem
permissão"), o título, se a espera pela lista estourou, quantas janelas o Chrome tem, a
etapa da URL (`m=0` é Todos), as contagens de `.curriculo-list-item`, `a.link-curriculo`, `li[data-pessoa-id]`,
links de detalhe, `#curriculo-pagina-1` e iframes, e as abas de etapa (só nomes conhecidos, com
a ativa). Sem nenhum link lido, mostra ainda o tamanho do `page_source` e se ele contém
`curriculo-list-item` e `link-curriculo`.

### Anexos do questionário (migration `20261008160000_anexos_do_questionario_na_empregare.sql`)

A exportação não traz o link dos anexos (só "Sim"/"--") e o link de detalhes abre o currículo, não
o documento. O caminho real (investigado em 08/10/2026, só leitura, e conferido no front da
Empregare, chunk 8152 — `questionarioResposta.detalhes`): na lista de candidaturas, cada candidato tem
um `a.progress-link[data-resposta]` por questionário (com `data-token` e `data-vagaTitulo`;
`data-modo-resposta` 3 é a entrevista virtual por IA: fica de fora) e o item tem `data-id` (a pessoa)
e `data-tokenCandidato`. O clique faz o GET XHR
`/Company/VacancyTests/GetRespostaDetails/<respostaID>?token=<token>`, que devolve **JSON**:
`{sucesso, questionario: {id, totalPerguntas, respostas: [{PerguntaID, Ordem, Pergunta, TipoResposta,
Resposta, RespostaID…}]}}`. No anexo (`TipoResposta` 4) `Resposta` é o nome do arquivo (0 = "Não se
aplica", 1 = "Não possuo este documento"), e o front monta:

- **Visualizar Arquivo**: `/Company/VacancyTests/GetViewerLogArquivo?arquivo=<Resposta>&nome=Case&token=<token>&questionarioRespostaID=<RespostaID>&perguntaID=<PerguntaID>`
  (estável, abre o visualizador com o login da Empregare e **registra a visualização**);
- **impressão**: `/Company/VacancyTests/PrintResult?respostaID=<questionario.id>&pessoa=<data-id>&vaga=<título da vaga>`.

A `Ordem` bate com o "Pergunta N" da exportação. O arquivo em si fica num storage com assinatura
que expira: esse link nunca é guardado. No painel da Empregare há ações perigosas (Zerar
Tentativas, Excluir Respostas, compartilhar): o robô nunca clica nelas.

Há dois passos (`scripts/robo-empregare/anexos_empregare.py`):

1. **Sondar** (modo `sondar`, só leitura, sem Supabase): com `vagas` = **um** código e `limite` =
   **1 a 3** candidatos (acima de 3 vira 3), o robô busca a vaga (só lê o link "Processo
   Seletivo"; não exporta), lê a lista e, para cada candidato sondado: as abas da página de detalhes
   (só href `#…` com `data-toggle=tab`; nunca o menu do site), os clicáveis de `#tabInscricoes`,
   `#tabAnexos` e `#tabCurriculo` (sem clicar no que for perigoso) e, **pela vaga**, o GET de
   `GetRespostaDetails` de cada resposta com a sessão do Chrome: status, se é JSON, `sucesso`,
   `totalPerguntas`, respostas por `TipoResposta`, anexos (tipo 4 com arquivo) e em quantas
   perguntas, a **Ordem** de cada anexo («Pergunta N») com o enunciado, links fora do formato, se há
   impressão e o padrão mascarado do link do anexo e da impressão. **Nenhum arquivo é aberto.** Nunca nome,
   CPF, e-mail, nome de arquivo, token nem URL completa no log.
2. **Capturar** (`anexos` marcado no Run workflow, modo `normal`/`forcar`; opcional até
   validarmos): a lista de candidaturas que o robô já lê dá, por candidato, o token e as respostas
   (`ler_respostas_do_html` em `navegador_empregare.py`). Para cada resposta, o mesmo GET com a
   sessão (6 por vez, `fetch` na página; até 10 min por vaga e 30 por execução); o JSON é lido
   (`ler_detalhes_da_resposta`), os links são montados como o front e cada anexo ganha a coluna do
   Excel: a "Pergunta <Ordem>" se o enunciado confirma, senão a única de enunciado que casa
   (`coluna_da_pergunta`). Para casar, o enunciado vira uma chave só com letras e dígitos (sem
   "Pergunta N - ", tags, entidades, acentos, caixa, espaços e pontuação: "Nível Superior: (frente"
   e "Nivel Superior:(frente" dão a mesma) e as chaves casam como prefixo no tamanho da menor,
   com 20+ caracteres — a coluna do Excel vem truncada. A ficha usa a mesma regra
   (`chaveDoEnunciado` em `anexo-na-empregare.ts`) quando a coluna não foi gravada. O JSON é
   decodificado pelo charset da resposta (sem ele, UTF-8; se não for UTF-8 válido, windows-1252)
   e trechos de UTF-8 lidos como Latin-1 ("NÃ­vel") são consertados antes de gravar. O nome do
   arquivo só vai no link, nunca no log. Depois de fechar a vaga, grava por `gravar_anexos_empregare`:
   `TB_EMPREGARE_RESPOSTA` (resposta, link de impressão, contagens) e `TB_EMPREGARE_ANEXO`
   (pergunta × arquivo: link Visualizar Arquivo, tipo `ARQUIVO_EMPREGARE`, Ordem, enunciado, coluna). A
   resposta relida fica só com os anexos lidos agora. No log, só contagens (`respostas de
questionário lidas N de M · K anexo(s)`, `N de M anexo(s) casados com a coluna do Excel`).
   Banco sem a migration: avisa e segue.

**Na ficha**: `obter_ficha_analise` devolve em `empregare` as `respostas` (`resposta`,
`link_impressao`, contagens) e os `anexos` (`resposta`, `pergunta`, `arquivo`, `ordem`, `enunciado`,
`coluna`, `tipo`, `link`) — dado restrito, só para quem pode ver a ficha. A regra do botão está em
`src/lib/avaliacao-documental/anexo-na-empregare.ts`: anexo da coluna (pela coluna casada; sem ela,
pelo enunciado) → **Ver documento** (abre o visualizador da Empregare logada; com dois ou mais
arquivos, a dica diz quantos); sem ele, a impressão → **Ver respostas na Empregare** e a dica da
pergunta; sem nada, **Abrir na Empregare** e a dica de antes (o candidato; sem ele, a vaga). A ficha
(`ficha.jsx` e `ficha/empregare.tsx`) só chama `anexosDaEmpregare`, `impressaoDasRespostas`,
`enderecoDoAnexo` e `apresentacaoDoAnexo`.

## Segredos a cadastrar (uma vez)

**GitHub** — repositório → Settings → Secrets and variables → **Actions** → New repository secret:

| Secret                      | O que é                                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `EMPREGARE_EMAIL`           | e-mail do usuário do robô no portal da Empregare (de preferência um usuário só do robô, não pessoal) |
| `EMPREGARE_SENHA`           | senha desse usuário                                                                                  |
| `SUPABASE_URL`              | já existe (o mesmo das planilhas)                                                                    |
| `SUPABASE_SERVICE_ROLE_KEY` | já existe (o mesmo das planilhas)                                                                    |

**Supabase Vault** — o **Rodar agora** e a agenda pedem a execução pelo banco (RPC
`disparar_robo`), com uma chave só: o token fine-grained do GitHub cadastrado no Vault com o nome
`github_disparo_robos` (como criar e trocar: [agenda-dos-robos.md](agenda-dos-robos.md)). A
variável `GITHUB_DISPATCH_TOKEN` da Vercel não é mais usada e pode ser apagada. A chave nunca vai
ao navegador.

## Como rodar

**Pelo MONITORA (administrador global):** Configurações → **Status das atualizações** → linha
**Robô da Empregare** (ou Seleção, ou Entrevistas) → **Rodar agora**. A função confere a sessão e se
a pessoa é administrador global no banco (`pode_disparar_carga`), aceita só as três cargas da lista
e não dispara o que já está rodando. O botão volta a ficar livre quando a execução termina.

**Rodar com opções (administrador global):** na mesma linha, **Opções** abre uma gaveta com os
mesmos campos do Run workflow, sem ir ao GitHub: **editais** (seleção com busca, por área; só os
vigentes, salvo "Mostrar todos"), **códigos de vaga** (lista colada, separada por vírgula, espaço ou
linha; só dígitos; com sugestões das vagas conhecidas do edital e o cargo de cada uma —
`listar_vagas_dos_robos`), **modo** (com a explicação de cada um; `sondar` pede um único código de vaga, sem editais, e limite de 1 a 3), **limite**, a caixa **Guardar links dos anexos do questionário** (só nos modos Normal e Forçar; vai ao workflow como `anexos`) e a **prévia** do
que vai rodar ("5 vagas do 93/2026: 179698, 180231…"). A função valida tudo de novo pela lista
branca do robô (`validarOpcoes` em `src/lib/robos-de-carga.js`) e recusa com 400 o que não couber.
Depois do pedido, a linha acompanha a execução (aguardando o GitHub → rodando → resultado por vaga:
gravada, candidatos no arquivo, ativos e com link), com o link da execução no GitHub. A
pré-classificação e as conferências têm a mesma gaveta, com os campos que aceitam.

**Pelo GitHub:** aba **Actions** → **Robô da Empregare** → **Run workflow**:

| Campo     | Para quê                                                                                                                                                                                                                                                                                                                                     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modo`    | `normal` (exporta e grava) · `seco` (só lista as vagas que exportaria; não entra na Empregare) · `fumaca` (só testa login e Central; não exporta nem grava) · `forcar` (aceita arquivo com menos da metade dos candidatos) · `sondar` (só lê a estrutura da aba Questionários de 1 a 3 candidatos de uma vaga; ver "Anexos do questionário") |
| `editais` | opcional: números separados por vírgula                                                                                                                                                                                                                                                                                                      |
| `vagas`   | opcional: códigos separados por vírgula                                                                                                                                                                                                                                                                                                      |
| `limite`  | máximo de vagas (padrão 60); no `sondar`, candidatos (1 a 3)                                                                                                                                                                                                                                                                                 |
| `anexos`  | também guarda o link Visualizar Arquivo de cada anexo do questionário e o da impressão das respostas (modo `normal`/`forcar`; opcional até validarmos)                                                                                                                                                                                       |

**Sem agenda automática** (decisão de 05/10/2026): o robô só roda quando um administrador clica em
"Rodar agora" ou alguém dispara pelo GitHub. Exceção: a **agenda das inscrições** de um edital
(ex.: 114/2026, 7h e 13h até 15/10/2026), que desliga sozinha (docs/agenda-dos-robos.md). Uma execução por vez (as outras esperam na fila); tempo limite de 2 h.

### Teste de fumaça (depois de cadastrar os segredos)

1. Actions → Robô da Empregare → Run workflow → modo **`fumaca`**: verde = o login funciona e a
   Central abre.
2. Modo **`seco`**: confere quantas vagas e quais códigos entrariam.
3. Modo **`normal`** com `vagas` = um código só: confira em Configurações › Status das
   atualizações e, no banco, `TB_EMPREGARE_CANDIDATO`.

## Ver se rodou

- Configurações › Status das atualizações, linha **Robô da Empregare**: selo, "atualizado há…" e,
  em Detalhes, as 8 últimas execuções (`get_painel_dos_robos`) com quem pediu, os parâmetros
  (editais, vagas, limite, forçar), vagas baixadas/falhas/recusadas e, por vaga, situação,
  candidatos e quantos com link da Empregare. O modo seco e o fumaça não gravam no banco: o
  resultado fica no resumo da execução no GitHub.
- No banco (SQL Editor):
  ```sql
  select "CO_SYNC", "DT_INICIO", "TP_SITUACAO", "TP_DISPARO", "QT_VAGA_PEDIDA", "QT_VAGA_BAIXADA",
         "QT_VAGA_FALHA", "QT_VAGA_RECUSADA", "QT_LINHA", "DS_MENSAGEM"
    from public."TL_SYNC_EMPREGARE" order by "DT_INICIO" desc limit 10;

  select "CO_VAGA", "TP_SITUACAO", "QT_CANDIDATO_ATIVO", "DT_ULTIMA_CARGA", "DS_MENSAGEM"
    from public."TB_EMPREGARE_VAGA" order by "DT_ATUALIZACAO" desc limit 20;
  ```

**O log do Actions é público** (o repositório é público): o robô imprime só contagens, códigos de
vaga e números de edital, e toda mensagem passa pelo mascaramento (`python/monitora/mascaramento.py`). Nunca cole
dado de candidato em issue, PR ou log.

## Quando falha

| O que aparece                                              | O que fazer                                                                                                                                                                                                                       |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Falta EMPREGARE_EMAIL` / `EMPREGARE_SENHA`                | Cadastre os secrets (acima).                                                                                                                                                                                                      |
| `A Empregare não aceitou o login`                          | A senha mudou ou o usuário foi bloqueado. Entre no portal com o usuário do robô, acerte e atualize o secret `EMPREGARE_SENHA`. Rode `fumaca`.                                                                                     |
| `não consegui pedir a exportação` em todas as vagas        | A Empregare mudou a tela (botões, textos ou ids). Rode `fumaca`; se o login passa, os seletores em `scripts/robo-empregare/navegador_empregare.py` (`exportar_vaga`) precisam de ajuste.                                          |
| `0 link(s) de candidato` ou `não consegui ler a lista`     | A tela de candidaturas mudou (o `data-pessoa-id` ou o link de detalhes). A exportação não é afetada; ajuste `ler_candidatos_do_html` e os `JS_…` da lista em `navegador_empregare.py`. A ficha cai em "Abrir vagas na Empregare". |
| `exportação ainda não disponível` até acabar as tentativas | A Empregare demorou a gerar os arquivos. Rode de novo mais tarde (as vagas que faltaram vão primeiro).                                                                                                                            |
| `RECUSADA pela trava`                                      | O arquivo veio com menos da metade dos candidatos. Confira a vaga na Empregare; se a redução for real, rode `forcar` com `vagas` = o código.                                                                                      |
| `Já há uma execução do robô da Empregare em andamento`     | Outra execução está aberta. Espere; uma execução que morreu sem fechar é liberada sozinha depois de 3 h.                                                                                                                          |
| `… respondeu 404` com `listar_vagas_empregare`             | A migration `20261005170000_robo_empregare.sql` ainda não foi aplicada.                                                                                                                                                           |
| `… respondeu 401`                                          | A `service_role` do Supabase mudou: atualize `SUPABASE_SERVICE_ROLE_KEY`.                                                                                                                                                         |
| "A chave de disparo dos robôs expirou ou foi recusada"     | O token do Vault (`github_disparo_robos`) venceu ou não tem "Actions: read and write" no repositório. Gere outro e troque o valor no Vault, com o mesmo nome (docs/agenda-dos-robos.md).                                          |

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
  `anexos_empregare.py` (aba Questionários: `sondar` e captura dos anexos),
  `planilha_empregare.py` (leitura do Excel e chave), `requirements.txt` (separado do da raiz,
  para não pesar as funções da Vercel). RPC e mascaramento vêm da base comum `python/monitora/`
  (`supabase_rpc.py`, `mascaramento.py`; guia em `docs/python-no-monitora.md`).
- `src/lib/robos-de-carga.js` e a RPC `disparar_robo` (`20261008140000_agenda_dos_robos_pelo_banco.sql`):
  o **Rodar agora** (lista fixa robô → workflow, opções, quem pode, regras do botão).
- `src/componentes/saude-das-cargas/` e `src/lib/saude-das-cargas.ts`: a tela de status.
- `supabase/migrations/20261005170000_robo_empregare.sql`, `20261006080000_robo_empregare_vagas_do_quadro.sql`
  (vagas também do quadro do edital), `20261007160000_link_do_candidato_na_empregare.sql` e
  `20261008160000_anexos_do_questionario_na_empregare.sql` (anexos do questionário), cada uma com `ensaios/` e `rollback/`; o disparo pelo banco aceita o modo `sondar` e a opção `anexos` desde `20261008190000_sondar_e_anexos_no_disparo_dos_robos.sql`.
- `src/lib/avaliacao-documental/anexo-na-empregare.ts`: o link de cada anexo na ficha.
- Testes: `tests/python/test_robo_empregare.py`, `tests/python/test_anexos_empregare.py`,
  `tests/anexos-do-questionario-migration.test.js`, `tests/lib/avaliacao-documental-anexo-na-empregare.test.js`,
  `tests/agenda-dos-robos-migration.test.js`,
  `tests/robo-empregare-migration.test.js`, `tests/robo-empregare-vagas-do-quadro.test.js`,
  `tests/saude-das-cargas.test.js`,
  `tests/componentes/saude-das-cargas.test.js`.
