---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Módulo: Avaliação documental

A tela de trabalho da etapa "Avaliação Documental e de Títulos" (view `avaliacao-documental`,
recurso `avaliacao_documental`), em `src/modulos/avaliacao-documental/`, montada por
`montarAvaliacaoDocumental()` na `#page-avaliacao-documental`. O Painel das análises
([[modulo-analises]], view `analises`) continua sendo a leitura.

Desenho e fases: [README do desenho](../analises-no-monitora/README.md),
[modelo de dados](../analises-no-monitora/modelo-de-dados.md),
[plano de construção](../analises-no-monitora/plano-de-construcao.md),
[regras dos editais recentes](../analises-no-monitora/regras-dos-editais-recentes.md); histórias
AM-n em [historias-de-usuario/analises-no-monitora.md](../historias-de-usuario/analises-no-monitora.md).

## Notas desta tela

- [[avaliacao-documental-regra]] — aba Regra: assistente de 5 passos, conferência dupla, diferenças por cargo
- [[avaliacao-documental-fila-e-ficha]] — Fila, reserva, ficha (modo foco), Conclusão e espelho de nota
- [[avaliacao-documental-arquivos]] — mapa dos arquivos, contratos TypeScript e testes
- [[modulo-triagem]] — a Triagem (fase F2), que mora na mesma pasta (`pre-classificacao.tsx`)

## Abas por papel e entrada

Regra, Equipe e Triagem são só de quem coordena o edital (`pode_coordenar`, ou o `papel` =
`COORDENADOR` da lista de editais antes de o edital carregar); os demais veem só a Fila, sem o
seletor de abas, e a equipe nem é lida (`abas-e-entrada.ts`). Sem edital escolhido não há abas: a
tela abre sozinha a ficha que estava aberta, o último edital aberto (localStorage, por pessoa e
área) ou o único vigente; senão, mostra os cartões dos editais vigentes (`entrada-da-avaliacao.tsx`).

## Fase F1

- escolha do edital da área atual;
- **Regra**: criar de um modelo, editar os blocos (eliminatórios com item do edital, critério étnico
  com aldeias, títulos por nível, cursos por faixa, vínculos), a distribuição e a revisão, os
  modelos de parecer e as observações prontas; ligar as perguntas da última carga da Empregare aos
  blocos; salvar em versões com motivo; marcar como conferida; ver as versões (a Provisória e o lote
  são da regra da Triagem desde 29/10/2026);
- **Testar com um candidato fictício**: a conta pura sobre o rascunho, sem gravar;
- **Equipe**: analistas, revisores e coordenação (o gestor do edital já coordena).

A fase F2 é a [[modulo-triagem]]; F3 e F4, em [[avaliacao-documental-fila-e-ficha]]. A próxima
fase traz a revisão (F5).

## Inclusão no lote por decisão da coordenação

- Na Triagem (cada vaga) e na Fila, a coordenação inclui no lote, por decisão e com motivo
  (sugestão "Critério CORES"), candidatos que a regra deixa fora (eliminados ou abaixo do corte);
  selo "Decisão: …" nas listas e no topo da ficha; "Revogar decisão" com motivo (o banco recusa com
  a ficha concluída); contadores "N pela regra + M por decisão"; nos documentos oficiais, o nome com
  "*" e a nota "Incluído por decisão da coordenação: …".
- Os recálculos mantêm a decisão (job Python e prévia JS, casos dourados); banco em
  `20261007200000_inclusao_no_lote_por_decisao.sql` (`TB_DECISAO_LOTE`, `TH_DECISAO_LOTE`).

## Dono da avaliação: planilha ou MONITORA

Ao lado de "Avaliação:" (`origem-da-analise.tsx`), a coordenação da avaliação (e o admin global)
troca o dono com confirmação e motivo (RPC `definir_origem_analise`, migration
`20261009200000_fichas_no_painel_das_analises.sql`). Com MONITORA, um gatilho em `TB_FICHA_ANALISE`
publica cada ficha em `TB_ANALISE_CURRICULAR` (`TP_ORIGEM_REGISTRO` MONITORA): Pendente, Em análise,
Revisar, Aprovado/Triados ou Reprovado, com responsável, data, parciais, nota e parecer. O Painel das
análises e a Classificação leem essas linhas sem código especial; a sincronização da planilha ignora
as linhas e os editais MONITORA. Edital que a planilha já decidiu não vira MONITORA por aqui (a
virada com adoção é da F8).

## Menos egress (plano gratuito do Supabase)

As leituras grandes vão por versão (`20261014230000_avaliacao_leitura_por_versao.sql`,
`20261014231000_fila_e_ficha_so_o_que_mudou.sql`; lógica pura em
`src/lib/avaliacao-documental/leitura-por-versao.ts` e `fila-por-mudancas.ts`; cópia no navegador em
`src/app/copias-por-versao.ts`): triagem, regra e Classificação mandam a versão que a tela tem e
recebem só `{ inalterado }` quando nada mudou (triagem e Classificação, quando mudou, com os
inscritos em colunas); a fila, depois da primeira leitura, só as linhas que mudaram, e não é relida
ao passar de uma ficha a outra (só ao voltar à lista); a ficha não traz a configuração da regra que
a tela já guardou. O rascunho automático sai 10 s depois da última mudança (no máximo 60 s depois da
primeira pendente; conteúdo igual ao último salvo não vai ao banco) e na hora ao fechar, trocar de
ficha ou esconder a aba. Sem as migrations, a tela usa as RPCs de sempre.

## Regras

- A regra é **dado** do edital. Nenhum peso no código: formato, padrões e validação em
  `src/lib/avaliacao-documental/regra.ts`; o banco repete a validação em
  `private."FC_VALIDAR_REGRA_ANALISE"` (`20261006100000_regra_da_analise.sql`).
- A conta da prévia é `src/lib/avaliacao-documental/pontuacao.ts`, só para a tela. A conta oficial,
  em lote (Provisória, lote, nota declarada de todos), é da base Python (`python/monitora/`), que
  reproduz os casos de `tests/fixtures/avaliacao-documental/casos-de-pontuacao.json`. Nada de conta
  pesada em SQL.
- Quem coordena cada edital, o banco decide (`FC_PAPEL_AVALIACAO`); a tela só esconde os controles
  de quem não pode (`pode_coordenar`).
- Distribuição: a mesma conta em `src/lib/avaliacao-documental/distribuicao.ts` (prévia) e em
  `python/monitora/avaliacao_documental/distribuicao.py` (o job, para as fichas que entram depois),
  conferida por `casos-de-distribuicao.json`; o banco valida e grava
  (`20261006120000_fichas_fila_e_reserva.sql`).
- Ficha: a tela calcula com `pontuacao.ts` e `ficha.ts` (declarado, pendências, resumo); o banco
  revalida e grava (`20261007130000_conteudo_da_ficha.sql`); o Python (`pontuacao.py`) reconfere em
  lote pelos casos dourados. A ficha não concluída segue a versão da regra do último recálculo
  (`FC_ABRIR_FICHAS`); a concluída mantém a versão com que foi analisada
  (`20261007110000_ficha_segue_versao_da_pre_classificacao.sql`).
- Explicações vão para `docs/aya/regras-da-avaliacao-documental.md`, não para a tela.

## Relacionadas

- [[modulo-analises]] — a leitura das fichas publicadas
- [[modulo-classificacao]] — usa as notas e publica as listas oficiais
- [[modulo-regras-do-edital]] — a regra se edita lá (etapa 2)
- [[python-e-jobs]] — contas oficiais em lote
- [[dados-pessoais]] — LGPD da ficha e dos anexos
- [[textos-da-interface]] — explicação é com a Aya
