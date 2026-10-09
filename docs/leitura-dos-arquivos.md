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

Mudou a interpretação? Suba `VERSAO_DO_EXTRATOR` (`leitura_de_arquivos/__init__.py`): o robô relê o
que foi lido com versão anterior.

## Dados pessoais

- O arquivo nunca vai para disco, artifact ou log; o texto do documento não é guardado.
- O CPF do candidato não chega ao robô: o banco manda `sha256(sal + CPF)` com um sal sorteado a cada
  execução; fica gravado só "confere / não confere". `gravar_leituras_de_arquivos` recusa qualquer
  coisa com cara de CPF.
- O log é público: só contagens, códigos de erro e números de edital.
