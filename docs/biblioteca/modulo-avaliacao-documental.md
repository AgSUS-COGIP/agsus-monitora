---
tipo: modulo
area: modulo
atualizado: 2026-11-17
---

# Módulo: Avaliação documental

A tela de trabalho da etapa "Avaliação Documental e de Títulos" (view `avaliacao-documental`,
recurso `avaliacao_documental`), em `src/modulos/avaliacao-documental/`, montada por
`montarAvaliacaoDocumental()` na `#page-avaliacao-documental`. O Painel das análises
([[modulo-analises]], view `analises`) continua sendo a leitura. A aba Regra (assistente de 5
passos, conferência dupla, diferenças por cargo) tem nota própria: [[avaliacao-documental-regra]].
A Triagem (fase F2) mora na mesma pasta (`pre-classificacao.tsx`): [[modulo-triagem]].

Critérios de aceite nas histórias AM-n
([historias-de-usuario/analises-no-monitora.md](../historias-de-usuario/analises-no-monitora.md));
[regras dos editais recentes](../analises-no-monitora/regras-dos-editais-recentes.md).

## Abas por papel e entrada

Regra, Equipe e Triagem são só de quem coordena o edital (`pode_coordenar`, ou o `papel` =
`COORDENADOR` da lista de editais antes de o edital carregar); os demais veem só a Fila, sem o
seletor de abas, e a equipe nem é lida (`abas-e-entrada.ts`). Sem edital escolhido não há abas: a
tela abre sozinha a ficha que estava aberta, o último edital aberto (localStorage, por pessoa e
área) ou o único vigente; senão, mostra os cartões dos editais vigentes (`entrada-da-avaliacao.tsx`).
O seletor mostra só os editais vigentes (`src/lib/avaliacao-documental/editais.ts`), com "Mostrar
todos os editais da área".

- **Regra** (F1): criar de um modelo, editar os blocos (eliminatórios com item do edital, critério
  étnico com aldeias, títulos por nível, cursos por faixa, vínculos), a distribuição e a revisão, os
  modelos de parecer e as observações prontas; ligar as perguntas da última carga da Empregare aos
  blocos; salvar em versões com motivo; marcar como conferida. A Provisória e o lote são da regra da
  Triagem desde 29/10/2026. Edita-se nas Regras do edital, etapa 2 ([[modulo-editais]]).
- **Testar com um candidato fictício** (`previa.tsx`): a conta pura sobre o rascunho, sem gravar.
- **Equipe**: analistas, revisores e coordenação (o gestor do edital já coordena).

## Fila (F3)

- Faixa de situação (No lote, Pendentes, Em análise, Em revisão e Concluídas, cada número um filtro
  da etapa; "N fora do lote" embaixo); filtros (vaga, responsável, modalidade, código ou nome —
  Enter com o código abre a ficha) e **filtros salvos** por pessoa (`TB_FILTRO_FILA_ANALISE`; o
  último filtro também fica no navegador, só por conveniência). "Por vaga (N)" recolhível embaixo.
- **Pegar próxima ficha** e o responsável "Minhas fichas" para o analista; o analista vê só as vagas
  que analisa. As concluídas mostram nota e resultado.
- **Ações em lote** da coordenação, com prévia, confirmação e motivo: distribuir (entre a equipe,
  para uma pessoa ou de volta à fila), liberar reservas, mandar para revisão; "Distribuir as livres"
  e "Abrir fichas do lote".
- **Reserva** de 15 minutos, renovada a cada 5 e liberada ao fechar; vencida, a renovação reserva de
  novo para o responsável sem subir a versão (`20261022130000`) e o cabeçalho mostra "Reserva
  vencida: reabra a ficha"; "Em uso por … desde HH:MM" só para leitura; a coordenação libera reserva
  presa com motivo.
- As listas são a TabelaInfinita (`src/ui/`): colunas por etapa, ordem por coluna, busca, "N de M",
  carregamento contínuo e Exportar CSV (`csvDaFila`, csv-security).

## Ficha (F4, `ficha/`)

- **Aberta** no modo de análise (ocupa a área de conteúdo; a lista some): topo fixo com "Voltar à
  fila", candidato, vaga com o nível, chips da nota declarada (ART), posição e modalidade; situação,
  responsável, reserva e regra no "i"; aviso só com menos de 5 minutos de reserva; Anterior /
  Próxima pela lista filtrada; Esc volta; a ficha aberta fica na sessão da aba.
- **Stepper**: um passo por item que se aplica + Conclusão, com marca de estado e barra de
  progresso. No notebook o bloco preso ao alto encolhe pela altura (`data-tamanho`): "enxuto" até
  860 px de altura CSS e "compacto" ao rolar ou até 680 px (125% de zoom).
- **Modo foco** (padrão): um item por vez — o enunciado curto e a resposta da Empregare em
  destaque, com os arquivos capturados da pergunta e o link de cada um (também quando a exportação
  traz "--"); resposta sem arquivo, "Sem arquivo enviado" e "Conferir na Empregare"; arquivo só num
  envio anterior, "Ver documento do envio anterior"; sem resposta capturada, "Abrir na Empregare" e
  onde achar. Tudo sai de `src/lib/avaliacao-documental/anexo-na-empregare.ts`. "Ver todos" troca
  para a lista compacta.
- "O documento confere com o declarado?": Confere (pontuação = declarado), Não confere (só o motivo,
  pontuação 0; "não enviou" vira NAO_ENVIADO) e, nos itens que pontuam, Editar nota — teclas 1, 2,
  3; J/K; Ctrl+S; Ctrl+Enter. No máximo uma mensagem por item (`mensagemDoBloco`); mapeamento para o
  banco em `apurado-da-ficha.ts`. Confere sem pendência avança sozinho (`proximoPassoPendente`).
  Pontuação diferente da declarada pede justificativa; o stepper conta "X de 6 conferidos" pela
  regra do "!" (`itemConferido`).
- **Lateral** só com a nota (parcial enquanto falta conferir; Inapto só quando um item conferido
  elimina), o mínimo e a composição por bloco (`composicaoDaNota`); ações secundárias no "⋯".
- **Conclusão**: resumo dos itens, nota final, observações prontas e observação, prévia do parecer
  (sem resultado enquanto falta conferir) e histórico. "Concluir e próxima" trava até não faltar
  nada.
- **Rodapé e salvamento**: "Salvo às HH:MM". O rascunho automático sai 10 s depois da última mudança
  (no máximo 60 s depois da primeira pendente; conteúdo igual ao último salvo não vai ao banco) e na
  hora ao fechar, trocar de ficha ou esconder a aba. "← Voltar à fila" salva antes de soltar a
  reserva; trocar de área pergunta se há alteração não guardada (`confirmarTrocaDeArea`), e a ficha
  que sai salva o pendente antes de a fila liberar a reserva (`registrarSalvamento`).
- **Concluída**: abre na Conclusão, só leitura; a coordenação reabre com motivo de lista fixa
  (`reabrir-a-ficha.tsx`, `20261021110000`). "Espelho de nota" imprime o espelho para o candidato
  (eliminado sem pontos; apto/inapto com a pontuação por critério) e "Baixar PDF" baixa o mesmo,
  gerado no navegador, sem gravar nada.

### Espelho de nota e documentos

- O espelho é montado em `src/lib/avaliacao-documental/espelho-de-nota.ts` a partir de
  `espelho-da-ficha-gravada.ts` (a mesma entrada dos espelhos em massa e da gaveta do Painel das
  análises); o PDF é `espelho-em-pdf.ts` (jsPDF + autotable, sob demanda), com impressão digital em
  `tests/lib/avaliacao-documental-espelho-visual.test.ts`; o ZIP usa fflate.
- **Modelo do espelho**: os textos da folha (título, saudação com `{candidato}`, nomes dos quadros,
  rótulos, rodapé…) são do edital; a coordenação edita em Documentos › "Modelo e pré-visualização",
  com prévia e "Restaurar padrão". Todos os espelhos leem o modelo na hora (`textosParaOEspelho`;
  sem modelo ou sem a RPC, o padrão). O conteúdo não se edita. Banco: `TB_MODELO_ESPELHO_NOTA` /
  `TH_MODELO_ESPELHO_NOTA`, `obter_modelo_espelho_nota` e `salvar_modelo_espelho_nota` (PT409),
  `20261019120000`. A folha (`ESTILO`) segue o manual da AgSUS (General Sans, `#0055a1`).
- Aba Documentos (só coordenação): espelhos em massa por vaga e filtro ou códigos colados
  (`obter_espelhos_de_nota` em páginas de 200, `20261015180000`), ZIP com um PDF por candidato ou um
  documento para imprimir; `AcoesEmLote` (`documentos-em-lote.tsx`) também serve os comunicados da
  Triagem. Ações › "Relatório de motivos": `listar_relatorio_de_motivos` em páginas de 500
  (`20261020120000`), CSV/XLSX no navegador.

## Inclusão no lote por decisão da coordenação

- Na Triagem (cada vaga) e na Fila, a coordenação inclui no lote, por decisão e com motivo
  (sugestão "Critério CORES"), candidatos que a regra deixa fora (eliminados ou abaixo do corte);
  selo "Decisão: …" nas listas e no topo da ficha; "Revogar decisão" com motivo (o banco recusa com
  a ficha concluída); contadores "N pela regra + M por decisão"; nos documentos oficiais, o nome com
  "*" e a nota "Incluído por decisão da coordenação: …".
- Os recálculos mantêm a decisão (job Python e prévia JS, casos dourados); banco em `20261007200000`
  (`TB_DECISAO_LOTE`, `TH_DECISAO_LOTE`; `incluir_no_lote_por_decisao` / `revogar_decisao_lote`,
  uma chamada por vaga).

## Dono da avaliação: planilha ou MONITORA

Ao lado de "Avaliação:" (`origem-da-analise.tsx`), a coordenação da avaliação (e o admin global)
troca o dono com confirmação e motivo (RPC `definir_origem_analise`, migration `20261009200000`). Com
MONITORA, um gatilho em `TB_FICHA_ANALISE` publica cada ficha em `TB_ANALISE_CURRICULAR`
(`TP_ORIGEM_REGISTRO` MONITORA): Pendente, Em análise, Revisar, Aprovado/Triados ou Reprovado, com
responsável, data, parciais, nota e parecer. O Painel das análises e a Classificação leem essas
linhas sem código especial; a sincronização da planilha ignora as linhas e os editais MONITORA.

**Edital que a planilha já decidiu** (16/11/2026, F8): a mesma janela mostra a prévia
(`previa_importacao_da_planilha`: aprovados e reprovados que viram fichas, fichas que saem do lote,
o que impede) e troca o dono importando (`importar_avaliacao_da_planilha`, migration
`20261116233000`; lógica em `src/lib/avaliacao-documental/importacao-da-planilha.ts`). Cada linha
Aprovado ou Reprovado vira a ficha concluída do inscrito com o resultado, a nota, o parecer e a data
da planilha (analista: o cadastro de mesmo nome, ou quem importa), a marca
`DS_LANCAMENTO.importada_da_planilha` e o histórico IMPORTAR com o retrato do que a ficha tinha; a
linha do painel fica a mesma. Em aberto sem linha sai do lote. A ficha importada abre só para ler
(`ficha/ficha-importada.tsx`, "Espelho da planilha"); reaberta, refaz-se no sistema e a marca sai.
Impedem: linha sem inscrito ou sem ficha, vaga diferente, em Revisar na planilha (termina-se lá),
sem nota ou sem parecer. **Antes de importar**, inative o edital na `DIM_EDITAIS` da planilha de
Projetos, senão a carga inteira de Projetos é recusada. A conferência automática
(`revisar_ficha_concluida_com_pendencia`) não manda para revisão a ficha importada e não reaberta
(`20261117030000`; em 16/11/2026 tinha mandado as 94 do 93/2026, desfeito por `20261117031000`).

## Regras

- A regra é **dado** do edital. Nenhum peso no código: formato, padrões e validação em
  `src/lib/avaliacao-documental/regra.ts`; o banco repete a validação em
  `private."FC_VALIDAR_REGRA_ANALISE"` (`20261006100000`).
- A conta da prévia é `src/lib/avaliacao-documental/pontuacao.ts`, só para a tela. A conta oficial,
  em lote (Provisória, lote, nota declarada de todos), é da base Python (`python/monitora/`), que
  reproduz os casos de `tests/fixtures/avaliacao-documental/casos-de-pontuacao.json`. Nada de conta
  pesada em SQL.
- Quem coordena cada edital, o banco decide (`FC_PAPEL_AVALIACAO`); a tela só esconde os controles.
- Distribuição: a mesma conta em `distribuicao.ts` (prévia) e em
  `python/monitora/avaliacao_documental/distribuicao.py` (o job, para as fichas que entram depois),
  conferida por `casos-de-distribuicao.json`; o banco valida e grava (`20261006120000`).
- Ficha: a tela calcula com `pontuacao.ts` e `ficha.ts`; o banco revalida e grava
  (`20261007130000`); o Python (`pontuacao.py`) reconfere em lote. A ficha não concluída segue a
  versão da regra do último recálculo (`FC_ABRIR_FICHAS`); a concluída mantém a versão com que foi
  analisada (`20261007110000`).
- **Menos egress** (plano gratuito do Supabase): as leituras grandes vão por versão
  (`20261014230000`, `20261014231000`; `leitura-por-versao.ts`, `fila-por-mudancas.ts`, cópia no
  navegador em `src/app/copias-por-versao.ts`). Triagem, regra e Classificação mandam a versão que
  têm e recebem `{ inalterado }` quando nada mudou; a fila, depois da primeira leitura, só as linhas
  que mudaram, e não é relida ao passar de uma ficha a outra; a ficha não traz a configuração da
  regra que a tela já guardou. Sem as migrations, a tela usa as RPCs de sempre.
- Explicações vão para [regras-da-avaliacao-documental](../aya/regras-da-avaliacao-documental.md),
  não para a tela.

## Código e testes

- Estado fora do React: `estado.ts` (editais, regra, equipe, gravações), `estado-da-fila.ts`
  (`obter_fila_avaliacao`, fora do lote em páginas por `obter_fila_fora_do_lote`, reserva,
  distribuição, filtros salvos), `ficha/estado-da-ficha.ts` (`obter_ficha_analise`, rascunho,
  `concluir_ficha`, `reabrir_ficha`, `registrar_acesso_ficha`). Lógica pura em
  `src/lib/avaliacao-documental/`. Números da faixa e meta do dia em `numeros-da-fila.ts`
  (`obter_ritmo_da_analise`, a mesma conta do Painel das análises).
- Tudo em TypeScript/TSX. Contratos: `tipos-do-estado.ts`, `tipos-da-pre-classificacao.ts`,
  `ficha/tipos.ts`, `assistente/tipos.ts` e, na lib, `tipos-da-regra.ts` e `tipos-da-ficha.ts`. O
  que vem do banco entra como `unknown` ou é afirmado na fronteira; a anotação não valida JSON —
  quem valida são `normalizarRegraAnalise`, `validarRegraAnalise`, `normalizarFiltro` e o banco.
- CSS só com tokens (`avaliacao-documental.css`, `ficha/ficha.css`, `espelho-editor.css`).
- Testes: `tests/modulos/avaliacao-documental*.test.js`, `tests/lib/avaliacao-documental-*.test.*`
  e, na conta oficial, `tests/python/test_pontuacao.py`, `test_distribuicao.py`,
  `test_pre_classificacao.py` e `test_pre_classificacao_job.py`.

## O que falta e decisões

Do desenho de 05/10/2026 (F1 a F4 estão no código; F8 feita em 16/11/2026). Conferido no código em
11/11/2026.

| Fase                        | Entrega                                                                                                                                                                                    | Situação                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| F5 — Revisão personalizável | amostra (X%, todas, só inaptos, divergentes, sinais, os que entraram pela linha, duplo-cego), sorteio com semente, validar ou devolver com motivo (quem analisou não valida), aba "Para revisar" (AM-13) | não feita: só a configuração "Revisão" da regra; não há `FC_SORTEAR_REVISAO`, `validar_ficha` nem `devolver_ficha`                              |
| F6 — Listas com o parecer   | título "…ETAPA DE AVALIAÇÃO DOCUMENTAL E DE TÍTULOS", coluna "Classificação na Modalidade", parecer como justificativa dos inaptos, "Ver ficha da avaliação" na gaveta do recurso (AM-17, AM-20.1) | parcial: o título já sai em `src/lib/classificacao/documento-sei.ts`; falta o "Ver ficha" no recurso                                             |
| F7 — Endereços da Empregare | o robô grava a cada execução `DS_URL_CANDIDATURAS` (vaga) e `DS_URL_CURRICULO` (candidato), sobrescrevendo (os tokens mudam); "Abrir na Empregare" abre direto o currículo (AM-7.2, AM-18b) | não feita (o robô já baixa os anexos, modo "Só anexos"). Links são dado restrito: só a RPC da ficha os devolve; nenhum token no log do Actions |

Depois da F8, editais novos nascem `MONITORA` (regra copiada de um modelo); os em andamento viram
edital a edital, entre etapas, nunca durante prazo de recurso. No fim saem o simulador e o web app
do Apps Script, as planilhas de vaga (arquivadas, só leitura), os scripts de sync de `apps-script/`
e, no banco, `TL_SYNC_ANALISE`, `TM_ANALISE_CURRICULAR`, `TA_ORIGEM_ANALISE` e as RPCs de sync.

**Decisões**

- **Uma tabela só:** a ficha publica na mesma `TB_ANALISE_CURRICULAR` (origens `monitora-*`);
  `id_origem` = código Empregare, então a `chave_natural` é a da planilha. Tabela nova com view
  unificada foi descartada: os vínculos apontam para `TB_ANALISE_CURRICULAR.id`, e a view criaria
  dois `id` para o mesmo candidato.
- **Dono único por edital** (`TB_ORIGEM_ANALISE_EDITAL`: `PLANILHA`, `COMPARACAO` ou `MONITORA`).
- **ART** é a nota da Empregare. **Lote** recortado da Provisória por ART, tamanho personalizável
  por edital e vaga; "a linha anda" repõe o lote. Revisão e distribuição personalizáveis. Piloto:
  93/2026 (SESMT, Projetos).
- **Recurso:** o ajuste aprovado vale por cima da nota, sem alterar a ficha. Sem ninguém no grupo
  Jurídico, só os administradores dão o parecer jurídico: atribua o grupo antes do primeiro prazo.

**Riscos**

| Risco                                                                         | Cuidado                                                                                  |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| A Empregare muda os enunciados e o bloco perde a pergunta                     | ligação pelo enunciado, conferida a cada carga; a ficha mostra "pergunta não encontrada" |
| A Empregare muda o HTML ou os tokens                                          | teste de fumaça do robô; recaptura a cada execução                                       |
| Planilha e MONITORA no mesmo edital                                           | dono único por edital; virada em passos                                                  |
| Conta diferente do simulador (dias ÷ 30, união com o dia seguinte, ano = 365) | casos dourados em JS, Python e banco                                                     |

**Perguntas em aberto**

- Documentação de cota incompleta faz o candidato seguir na ampla? Heteroidentificação e perícia
  serão registradas no MONITORA?
- Vínculo ativo ou parentesco: só alerta, ou impedimento em algum edital?
- Bloquear "Concluir" fora da janela da análise, ou só avisar?
- Quem tem as listas de aldeias dos outros DSEI? O recurso pode mudar os desempates?

## Relacionadas

- [[avaliacao-documental-regra]] — a aba Regra: assistente, conferência dupla, diferenças por cargo
- [[modulo-triagem]] — a Provisória e o lote (F2), na mesma pasta
- [[modulo-analises]] — a leitura das fichas publicadas; a gaveta mostra o mesmo espelho
- [[modulo-classificacao]] — usa as notas e publica as listas oficiais
- [[modulo-recursos]] — o ajuste da nota por cima da ficha
- [[modulo-editais]] — a regra se edita nas Regras do edital (etapa 2)
- [[python-e-jobs]] — contas oficiais em lote
- [[robos-e-agenda]] — o robô da Empregare (F7)
- [[componentes-padrao]] — TabelaInfinita e demais peças de `src/ui/`
- [[dados-pessoais]] — quem vê CPF, nascimento e documentos
- [[textos-da-interface]] — explicação é com a Aya
