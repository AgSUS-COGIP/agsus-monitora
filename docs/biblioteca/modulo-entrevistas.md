---
tipo: modulo
area: modulo
atualizado: 2026-11-17
---

# Módulo: Entrevistas

Duas entradas do menu em `src/modulos/entrevistas/`, com o mesmo recurso de permissão
(`entrevistas`), como o Painel das análises ao lado da Avaliação documental (acompanhar × fazer).

## Painel de entrevistas

View `entrevistas`, `#page-entrevistas`, rota `/<área>/painel-de-entrevistas`,
`criarEntrevistas()`: só leitura, para gestão e coordenação — filtros, KPIs, agenda dos próximos
dias (com um edital), gráficos, pendências (inclusive sem comparecimento, sem nota e sem parecer),
empatados na nota da entrevista com o aviso "o desempate é feito na Classificação", tabela,
exportação e a gaveta do candidato (caminho do candidato, critérios, aprovados sem entrevista). O
edital de treinamento fica fora (o cache do painel, `private."FC_MONTAR_ENTREVISTAS_AREA"`, não o
lê). O cliente declara só `get_entrevistas_da_area` e `obter_agenda_entrevista`.

## Conduzir entrevistas

View `conduzir-entrevistas`, `#page-conduzir-entrevistas`, rota `/<área>/entrevistas[/<edital>]`,
`criarConducaoDeEntrevistas()`: o fazer, para secretaria e avaliadores, no layout das telas da
seleção (cabeçalho com o edital e as seções).

- **Fila** (`fila-do-dia.tsx`): abre em Hoje pela agenda salva na Classificação › Agenda (sem
  entrevista hoje, Próximos; sem agenda, Todos); faixa de situação (período, aguardando, em
  andamento, concluídas, faltaram e sem nota) com o contador "X de Y hoje" e a próxima entrevista;
  barra com período, busca, vaga e banca; tabela em ordem de horário, 50 e mais 50 ao rolar, com a
  linha "Agora"; a ação da linha abre a ficha em tela cheia, com "Salvar e abrir o próximo";
  concluir o dia mostra um aviso ("Entrevistas de hoje concluídas: 4 de 4."), sem efeito, uma
  vez (marco "vaga pronta" em `marcos.ts`).
- **Preparar** (`preparar.tsx`, `src/lib/entrevistas/passos-do-preparar.ts`): o topo com "N de 4 passos
  prontos", o período e as regras; a trilha dos passos Roteiro, Banca, Convocação e Agenda e o passo
  escolhido, com o que falta; os **roteiros** da área ficam no passo 1 (a configuração do gestor,
  como Regra e Equipe na Avaliação documental), com versões e o que falta
  (`src/lib/entrevistas/pendencias-do-roteiro.ts`).
- O edital fica no cabeçalho (`seletor-do-edital.tsx`, com "mostrar também os concluídos" para o
  administrador global); o último aberto na área fica no navegador (só conveniência); com um só na
  lista, abre sozinho. Na URL: a seção, o período, a situação, a vaga, a banca e o passo.
- Links antigos (`entrevistas:conduzir`, `entrevistas:roteiros`) vão para Conduzir entrevistas
  (`destinoDaTela`, `src/lib/navegacao/navegacao.ts`; o controlador tem `abrirVisao` e `abrirEdital`).

### Ficha de notas

`ficha.tsx`, em modo de análise (tela inteira), no molde da ficha da Avaliação documental: por
avaliador (padrão) ou por competência (lembrado no navegador). A matriz competências × aspectos
(`matriz-de-notas.tsx`) tem o fluxo de planilha: dígito avança, setas/Enter, Backspace volta, fora
da escala recusa (`src/lib/entrevistas/digitacao-de-notas.ts`). A lateral mostra o total com o mínimo, as
barras, o parecer e "X de Y notas"; o parecer em texto pronto sai de
`src/lib/entrevistas/parecer-da-entrevista.ts` ("Copiar parecer").

## Regras

- **Desempate**: uma fonte só, a regra de classificação do edital. `obter_entrevistas_do_edital` traz
  `regra_classificacao.desempate` e `empate_final` (migration `20261008130000`); Preparar e o editor
  do roteiro mostram os critérios só para ler, com "Editar na Classificação". O texto livre antigo
  (`TB_ROTEIRO_ENTREVISTA."DS_DESEMPATE"`) fica no banco: a tela não o mostra nem edita e o repassa
  sem mudança a cada versão nova.
- **Convocação** é uma só: a lista CONVOCACAO da Classificação (a última gerada, em
  `obter_entrevistas_do_edital.lista_convocacao`). Preparar › Convocação mostra essa lista e
  `convocar_para_entrevista(p_edital, p_lista, p_analises)` registra para a ficha só quem está nela
  (`20261005150000_convocacao_unica_da_entrevista.sql`). Sem lista gerada, o cálculo atual do motor
  (`obter_classificacao_do_edital`, só para ver) e o atalho para gerar na Classificação.
  `ListaDeConvocacao` (`conducao.tsx`) sem `aoConvocar` é só leitura: é como a Central de convocações
  (Lista de aprovados › Convocação › Para entrevistas) a mostra, por `convocacaoParaLeitura` do
  controlador (`convocacao-para-leitura.tsx`), com a mesma loja e o mesmo edital aberto.
- Vagas imediatas e regra de convocação não se configuram aqui: o resumo "Regras da entrevista"
  (`resumo-das-regras.tsx`, topo de Preparar) mostra as da Classificação em linguagem simples, com a
  tabelinha por vaga e, em "Ver detalhes", de onde vêm as vagas e o botão para onde se mudam
  (Editais, Lista de aprovados, Classificação).
- **Avaliador por competência** (`20261008170000`): cada membro da banca avalia todas as
  competências (padrão; sem vínculo) ou só as marcadas (`TB_ENTREVISTA_AVALIADOR_COMPETENCIA`,
  `avaliadores[].competencias`). A configuração valida (cada competência com alguém em cada banca),
  o lançamento recusa nota fora da competência do avaliador e o cálculo (banco,
  `calcularEntrevista`, Python) faz a média só de quem avalia; a ficha esmaece o que não é do
  avaliador e os contadores contam só as células atribuídas.
- A justificativa da banca é obrigatória para Inapto e Faltou (o banco recusa sem ela,
  `20261008220000`).
- Roteiro e banca também se editam nas Regras do edital, etapa Entrevista
  (`editor-da-configuracao.tsx`, que grava pelo configurar da loja de condução).
- Explicações para quem usa: [regras-das-entrevistas](../aya/regras-das-entrevistas.md) (a
  explicação mora lá, não na interface).

## Arredondamento da nota

Por edital (`TB_ENTREVISTA_EDITAL."TP_ARREDONDAMENTO"`, migration
`20261117020000_entrevista_arredonda_a_media_como_a_banca.sql`): **NOTA** (o padrão) arredonda cada
competência (média × peso) em 2 casas e soma; **MEDIA** arredonda a média dos avaliadores em 2
casas antes do peso, soma as competências sem arredondar (o mínimo da competência também) e
arredonda o total — a conta da planilha da banca. As três contas seguem o mesmo:
`private."FC_CALCULAR_ENTREVISTA"`, `calcularEntrevista` (prévia da ficha, pela
`configuracao.arredondamento` de `obter_entrevistas_do_edital`) e `monitora.entrevistas.calculo`;
os casos dourados `tests/fixtures/entrevistas/casos-de-calculo.json` cobrem os dois. O 93/2026 está
em MEDIA. Nota quebrada (1,29; 0,88): a escala FAIXA aceita o passo que o roteiro tiver ("Passo
das notas" em Preparar › Roteiro); com 0,01, qualquer nota com até duas casas. O roteiro do 93/2026
(também do 96/2025, concluído) passou a 0,01 (`20261117040000`).

## Concluir e reabrir a ficha

Como a ficha da Avaliação documental (`20261117050000`): `TB_ENTREVISTA."DT_CONCLUSAO"` e
`"CO_USUARIO_CONCLUSAO"`. `concluir_entrevista` (entrevistas ≥ editor; exige comparecimento, com
presença o parecer calculado e, em Inapto ou falta, a justificativa) fecha a ficha;
`lancar_notas_entrevista` recusa a concluída (55000). `reabrir_entrevista` é só da coordenação do
edital (`FC_PAPEL_AVALIACAO` = COORDENADOR), com motivo de `private."FC_MOTIVO_REABERTURA_ENTREVISTA"`
(a mesma lista em `src/lib/entrevistas/reabertura-da-entrevista.ts`, comparada no teste); o componente de
reabrir é o da Avaliação documental (`ReabrirAFicha`, com `motivos`). Conclusão e reabertura vão
para `TH_ENTREVISTA_AVALIACAO`. `obter_entrevistas_do_edital` traz `pode_reabrir` e, por convocado,
`concluida_em` e `concluida_por`. Na fila, `a_concluir` (`fila-de-conducao.ts`) é o resultado
definido sem conclusão; `concluida` é só a concluída. A lista gerada que ficou para trás já é
avisada pela Classificação (`geracaoDesatualizada`).

## Entrevistas feitas na planilha da banca

Edital que entrevistou fora do sistema, nas planilhas "Avaliação Estruturada por Competência" (uma
por vaga: dois avaliadores dão nota em cada competência, comparecimento, nota final e parecer; aba
Avaliadores com os nomes), entra pela função `private."FC_IMPORTAR_ENTREVISTAS_DA_PLANILHA"`
(migration `20261117010000_importar_entrevistas_da_planilha.sql`; sem grant, roda por script de
banco com autorização). Ela cria a banca (origem "Planilha da banca"), a ficha de notas de cada
entrevistado (TB_ENTREVISTA sistema, sem exigir a lista de convocação) com banca, comparecimento,
endereço da planilha e as notas de cada avaliador (sem a escala do roteiro: a planilha guarda
médias), calcula nota e parecer pelo sistema, compara com a planilha e põe a justificativa da banca
no inapto e no ausente; histórico em TH_ENTREVISTA_AVALIACAO. Os nomes dos candidatos não passam
pela função: quem monta os dados liga cada nome à análise do candidato antes. Usada no 93/2026
(16/11/2026): 49 entrevistas, sem divergência de nota ou parecer com a planilha; entraram concluídas
(conferidas em 17/11/2026).

## Código e testes

- Estado fora do React: `estado.ts` (painel: carga da área com cópia guardada, gaveta, CSV, agenda
  do recorte, comemorações) e `estado-da-conducao.ts` (editais, edital aberto, escritas uma por vez).
- Regras puras em `src/lib/`: `entrevistas-do-painel.ts`, `painel-de-entrevistas.ts`,
  `fila-de-conducao.ts`, `conducao-de-entrevista.ts` e `roteiro-de-entrevista.ts` (escalas, pesos,
  mínimos, aspectos, atribuições, permissões, cálculo do parecer), `convocacao-da-entrevista.ts`,
  `resumo-da-entrevista.ts`, `comemoracao.ts`.
- Contratos (`tipos*.ts` na pasta e em `src/lib/`). O que vem do banco entra como `unknown` e é
  verificado só nos campos usados (`entrevistas-do-painel.ts`, `src/lib/entrevistas/dados-da-conducao.ts`, que
  preserva os dados opacos da Classificação); nada valida o JSON inteiro. A ficha distingue notas
  diretas de notas por aspectos (números; `null` apaga). O editor de roteiros separa texto do
  rascunho de números enviados e preserva campos antigos de convocação e desempate.
- **Troca de área ou sessão**: respostas de agenda e de gravações anteriores à troca são
  descartadas (inclusive para o mesmo edital); a gravação já enviada ao banco não é cancelada.
- CSS só com tokens em `entrevistas.css`.
- Testes: `tests/modulos/entrevistas.test.js`, `conduzir-entrevistas.test.js`,
  `agenda-do-painel-de-entrevistas.test.js`, os de `tests/*entrevista*.test.js`,
  `tests/digitacao-de-notas.test.js` e `tests/preparar-e-fila-de-entrevistas.test.js`; contratos de
  compilação em `tests/tipos/` (`painel-de-entrevistas.tsx`, `ficha-de-entrevistas.tsx`,
  `estado-da-conducao.tsx`, `editor-de-roteiros.tsx`, `convocacao-de-entrevistas.tsx`,
  `regras-das-entrevistas.tsx`).

## Relacionadas

- [[modulo-classificacao]] — convocação, desempate e agenda vêm de lá
- [[modulo-editais]] — etapa Entrevista nas Regras do edital
- [[modulo-aprovados]] — a Central de convocações mostra a lista só para ler
- [[planilhas]] — a carga diária da aba Entrevistados
- [[modulo-recursos]] — o mesmo padrão acompanhar × fazer
- [[modulo-avaliacao-documental]] — a ficha em modo de análise, no mesmo molde
- [[modulo-comemoracao]] — o dia concluído e a vaga pronta
