# Leitura automática dos arquivos (Avaliação documental)

Um robô em Python lê os anexos do questionário dos candidatos na Empregare e a ficha mostra o que
foi lido para o avaliador **aceitar ou recusar** item a item. O robô só sugere e alerta; a decisão e
a pontuação continuam do avaliador (as linhas aceitas entram na conta da ficha e do banco).

| Peça                                                                                      | O que faz                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `python/monitora/avaliacao_documental/leitura_de_arquivos/`                               | lê o arquivo (texto do PDF, OCR do escaneado/imagem, DOCX, TXT) e tira cursos, títulos, vínculos, identidade e registro; confere nome e CPF; gera alertas e resumo            |
| `scripts/robo-empregare/arquivo_empregare.py`                                             | abre o visualizador da Empregare (`/Company/Viewer?arquivo=…&nome=Case`) com a sessão do robô e baixa o arquivo **só para a memória**                                         |
| `scripts/robo-empregare/leitura_de_arquivos.py`                                           | pede os anexos a ler, lê, grava em lotes, para no orçamento de tempo                                                                                                          |
| `.github/workflows/leitura-de-arquivos.yml`                                               | o job (120 min, Tesseract `por` com cache), só por "Run workflow"                                                                                                             |
| `supabase/migrations/20261009220000_leitura_dos_arquivos.sql`                             | `TB_LEITURA_ARQUIVO`, `listar_anexos_para_leitura`, `gravar_leituras_de_arquivos` (service_role), `leituras` na ficha, decisões no lançamento (`recusas_lidas`, `do_arquivo`) |
| `src/lib/avaliacao-documental/leitura-dos-arquivos.ts` + `ficha/leitura-dos-arquivos.tsx` | "Lido do arquivo" e a conferência (Aceitar / Recusar, A e R, "Aceitar todos sem alerta")                                                                                      |

## Como rodar (piloto no 93/2026)

Pré-requisito: a migration `20261009220000` aplicada (o ensaio está em `supabase/ensaios/`).

1. GitHub → Actions → **Leitura dos arquivos da Avaliação documental** → Run workflow.
2. Primeiro `modo = sondar`, `editais = 93/2026`, `limite = 3`: o log mostra só a estrutura do
   visualizador (se o arquivo veio direto, quantos botões "Baixar", hosts e caminhos genéricos) —
   confirma que o download funciona sem ler nada.
3. Depois `modo = normal`, `editais = 93/2026`, `limite = 30`. O resumo da execução traz quantos
   foram lidos, ilegíveis, com erro (por código) e de formato não lido.
4. Para medir o acerto: abra na fila as fichas de quem tem ficha (o robô começa por elas) e compare
   o "Lido do arquivo" com o documento. Anote por tipo (curso, título, vínculo) o que veio certo,
   errado e faltando.
5. Satisfeito, aumente o `limite` (até 2000) ou rode sem `editais` (os ativos com regra). Cada
   execução continua de onde a anterior parou; `forcar` relê o que já foi lido nesta versão.

## Como lê (extrator 2026.10.8) — tudo local e gratuito

Nenhum documento sai do runner: sem API de IA paga, sem consulta de CNPJ na internet.

- **Posição das palavras** (`layout.py`): no PDF com texto, `extract_words` do pdfplumber; no OCR, o
  `image_to_data` do Tesseract. A página vira linhas e células, e o valor de cada rótulo é achado na
  própria célula, à direita ou embaixo (rótulo pequeno em cima, valor embaixo).
- **CTPS** (`ctps.py`), digital ou física: um contrato por bloco (razão social, CNPJ, admissão,
  desligamento/"Data de fim"/"Situação", ocupação/CBO, jornada). As datas das seções de alterações
  salariais/contratuais, férias e afastamentos são ignoradas. O nome do empregador em destaque sem
  rótulo, logo acima do CNPJ, é a razão social. Duas páginas lado a lado (foto da carteira aberta)
  são lidas como duas colunas. O mesmo empregador com dois vínculos sobrepostos, um em aberto, vira
  um contrato só (`alteracoes`: alteração contratual lida como admissão).
- **CNPJ** com dígito verificador conferido (também o alfanumérico); sem a razão social, o
  empregador fica "CNPJ 00.000.000/0000-00". CPF/CEI de empregador pessoa física nunca é guardado.
- **Cargo** sem "de " na frente, sem código, sem CBO e sem a jornada ("MEDICO DO TRABALHO 4 HORAS"
  → "Médico do trabalho", carga semanal 20; "MÉDICO - 10HS" → "Médico", 10).
- **Vínculo atual**: os dias vão até a emissão do documento ("Gerado/Emitido em", carimbo de data e
  hora, assinatura digital), senão até a criação do PDF (metadados), senão até a data da leitura —
  `dias_ate` e `dias_ate_fonte` (EMISSAO, ARQUIVO, LEITURA), sem alerta.
- **Declarações, contratos, certidões, contracheques** (`declaracoes.py`): o empregador é QUEM
  DECLARA — "A X, inscrita no CNPJ…", o timbre (linha de fonte maior ou centralizada no primeiro quinto
  da página, pela posição), "contratada pela X"/"trabalha no Hospital X", o cabeçalho sem posição, o
  rodapé com razão social/CNPJ ou só o CNPJ validado. Uma seção por declaração (página com emissor
  próprio ou título abre seção; sem nada, continua a anterior); os vínculos herdam o emissor dela.
  Fim: "até a presente data", "atualmente", "encontra-se em exercício", "permanece" ou verbo no
  presente ("exerce", "trabalha") → atual, com os dias até a emissão da própria declaração ("Cidade,
  dd de mês de aaaa"); sem fim nem nada disso → `fim_nao_informado` (dias 0; a tela diz "fim não
  informado", nunca "?"). Carga só ligada a "horas semanais"/"h/semana"/"carga horária (semanal) de
  NN horas"/"jornada de NN horas" e procurada no trecho do vínculo (nunca no documento inteiro);
  "plantões de 12 horas" → `plantonista`/`plantao_horas`; sem carga → `carga_nao_encontrada`; a
  mesma captura em emissores diferentes vira None. Datas por extenso ("1º de setembro de 2026") e com
  o mês estragado pelo OCR ("seternbro"); vínculo que começa depois da emissão é descartado
  (`DATA_APOS_EMISSAO`, leve). O nome do empregador sai limpo: sem lixo de OCR (símbolo de moldura,
  palavra sem vogal, palavrinha que não é partícula, nenhuma palavra conhecida → "Empregador não lido"),
  sem artigo, sem o pedaço de frase antes ("…, nesta empresa, X" → "X"), sem CNPJ e sem qualificador no
  fim ("— Empresa Privada"), com até 80 caracteres; a seção só com CNPJ fica com a razão social de outra
  seção do arquivo com a mesma raiz de CNPJ; o mesmo vínculo lido em outra página sem empregador legível
  (mesmo início, cargo compatível) não vira outro item; "26 (vinte) horas" vale o extenso. Ficha de
  registro/eSocial: as linhas e tabelas de férias (período aquisitivo, concessivo, gozo, abono, 1/3),
  afastamentos, licenças e alterações salariais são ignoradas, e "Estabelecimento definido para…" (lotação)
  não é empregador; um vínculo precisa de cargo ou de verbo de vínculo. O mesmo empregador (CNPJ da mesma
  raiz ou razão social no começo da outra) com o mesmo início e cargo compatível é um item só (fica o que
  diz o fim), e o vínculo sem empregador com período dentro de outro compatível sai.
- **Sobreposição**: alerta `PERIODO_SOBREPOSTO` só para o MESMO empregador (CNPJ com a mesma raiz ou
  razão social igual): provável duplicidade. Empregadores diferentes ao mesmo tempo são legítimos:
  o item ganha `concomitante` e a informação "os dias em comum contam uma vez", sem alerta. O total
  do resumo é a UNIÃO dos períodos (`pontuacao.dias_dos_intervalos`, a mesma regra da pontuação) e
  diz "N dias em comum não somam".
- **Fotos e escaneados** (`imagem.py`, OpenCV): lado maior entre 2000 e 3300 px, perspectiva da folha
  endireitada, sombra tirada, inclinação desfeita, versão binarizada; depois o Tesseract em
  `--psm 3` e, com confiança baixa, a orientação pela OSD e os modos 4, 6 e 11, ficando a leitura
  com mais texto confiável.
- **Certificados e diplomas**: "Carga horária" e "Curso" também pela posição (rótulo e valor
  embaixo ou ao lado).

Medição nos documentos sintéticos (`tests/python/sinteticos_leitura.py`, nada real):
`python tests/python/avaliar_leitura_sintetica.py --ocr` (com `--codigo DIR` mede outro checkout).
EasyOCR foi medido e não compensou (pior nas fotos de lado, ~25 s por imagem, 2,9 GB de memória e
1,2 GB de dependências); fica o Tesseract com a imagem arrumada.

Mudou a interpretação? Suba `VERSAO_DO_EXTRATOR` (`leitura_de_arquivos/__init__.py`): o robô relê o
que foi lido com versão anterior.

## Dados pessoais

- O arquivo nunca vai para disco, artifact ou log; o texto do documento não é guardado.
- O CPF do candidato não chega ao robô: o banco manda `sha256(sal + CPF)` com um sal sorteado a cada
  execução; fica gravado só "confere / não confere". `gravar_leituras_de_arquivos` recusa qualquer
  coisa com cara de CPF.
- O log é público: só contagens, códigos de erro e números de edital.
