# Histórias de usuário — Lista de aprovados

Pedidos de 05/10/2026: "Em lista de aprovados: acrescentar status de convocado e tirar o status de
fim de fila" e "Adicionar módulo de carta de convocação". Cada história traz os critérios de
aceite (Dado/Quando/Então) e onde está o teste que a confere.

Papéis: **editor** = Editor em Aprovados (o grupo Gestor, o Contratador); **admin** = Administrador
em Aprovados; **leitor** = quem só consulta a lista.

Banco: `supabase/migrations/20261005180000_convocado_e_carta_de_convocacao.sql` (ensaio e rollback
com o mesmo nome). Tela: `src/modulos/aprovados/` (submódulo `carta-de-convocacao/`).

---

## Entrega 1 — Status Convocado (e o fim do Fim de Fila)

### H1. Marcar um candidato como Convocado

Como **editor**, quero marcar um candidato como **Convocado**, com a data da convocação, para que
a equipe saiba quem já foi chamado para a contratação e aguarda apresentação e documentos.

- **Dado** um candidato sem status numa lista ativa, **quando** escolho "Convocado" no modal de
  status, **então** aparece o campo "Data da convocação", preenchido com hoje e sem aceitar data
  futura.
- **Dado** que salvo com uma data, **então** o banco grava o status, a data
  (`TB_CANDIDATO_APROVADO."DT_CONVOCACAO"`) e o histórico (`TH_CANDIDATO_APROVADO`), e a linha mostra
  "Convocado · em DD/MM/AAAA".
- **Dado** uma data futura, ou uma data com outro status, **então** o banco recusa (22023).
- **Dado** o status "Fim de Fila", **então** ele não aparece em nenhuma opção, filtro ou indicador
  e o banco o recusa (a migration para se ainda houver alguém nele).

Testes: `tests/componentes/convocado-e-carta.test.js` (H1/H2), ensaio E3/E4,
`tests/convocado-e-carta-de-convocacao-migration.test.js`.

### H2. Seguir o fluxo a partir do Convocado

Como **editor**, quero passar um Convocado para Contratado, Desistente ou Documentação Rejeitada
sem depender do admin, para registrar o resultado da convocação no mesmo dia.

- **Dado** um candidato Convocado, **quando** abro o status como editor, **então** não há cadeado e
  posso escolher o próximo status (Contratado e Migração continuam exigindo matrícula).
- **Dado** um candidato Convocado, **então** "Sem status" fica indisponível para o editor; só o admin
  desfaz a convocação, e aí a data some.
- **Dado** que o Convocado vira Contratado ou Desistente, **então** a data da convocação continua
  registrada.
- **Dado** um candidato Contratado (ou com outro status definido), **então** o editor continua vendo
  o cadeado.

Testes: `tests/componentes/convocado-e-carta.test.js`, ensaio E3 ("editor tirou o status de um
convocado").

### H3. Ver os convocados nos indicadores, filtros, ordem de chamada e CSV

Como **gestor da contratação**, quero ver quantos estão convocados e quem ainda falta chamar, para
não chamar a mesma pessoa duas vezes.

- **Dado** a aba Aprovados, **então** o indicador "Convocados" ocupa o lugar de "Fim de fila" e
  "Contratados" não soma os convocados.
- **Dado** os filtros de status (Aprovados e Convocação), **então** "Convocado" é uma opção.
- **Dado** a aba Convocação, **então** os indicadores mostram "A convocar" (vagas imediatas ainda sem
  chamada) e "Convocados"; Convocado, Contratado e Migração ficam na sua posição e não contam como a
  convocar; Desistente e Documentação Rejeitada saem da fila e o próximo passa a ser a convocar.
- **Dado** "Exportar CSV", **então** o arquivo traz a ordem, a situação na chamada (A convocar, Já
  chamado, Cadastro de reserva, Fora da fila), o status e a data da convocação, com `;`, BOM e células
  protegidas contra fórmula.
- **Dado** a Seleção (`get_selecao_da_area`) e os KPIs de contratados, **então** continuam contando só
  Contratado e Migração.

Testes: `tests/lista-convocacao-rules.test.js` ("status Convocado", "CSV da ordem de convocação",
"csvDaConvocacao"), `tests/lista-aprovados-filtros-multiplos.test.js`,
`tests/componentes/convocado-e-carta.test.js` (H3), teste da migration ("contratados continuam só
Contratado e Migração").

### H3a. A lista publicada leva a convocação

Como **gestor da Classificação**, quero que, ao publicar uma nova lista de aprovados, quem já estava
convocado continue convocado com a mesma data, para não perder o andamento da contratação.

- **Dado** um candidato Convocado na lista vigente, **quando** a lista da Classificação é publicada e
  ele casa com alguém da lista nova, **então** a pessoa entra Convocada com a mesma data (gatilho
  `TG_CANDAPROVADO_CONVOCACAO`).
- **Dado** as cartas emitidas na lista anterior, **então** continuam no histórico da pessoa na lista
  nova.

Testes: ensaio E2/E3/E4 ("o gatilho não herdou a data", "a carta da lista antiga não aparece").

---

## Entrega 2 — Carta de convocação

### H4. Manter o modelo da carta

Como **editor**, quero manter modelos da carta de convocação da minha área (e, se preciso, de um
edital), com campos que se preenchem sozinhos, para emitir cartas padronizadas sem redigir cada uma.

- **Dado** "Modelos da carta" na aba Convocação, **quando** crio um modelo, **então** começo do texto
  padrão, escolho se vale para a área ou para um edital, e informo título, texto (um parágrafo por
  linha, **negrito**) e os valores padrão de local, documentos (um por linha), contato e prazo em dias.
- **Dado** os campos {NOME}, {CPF}, {CARGO}, {VAGA}, {LOTAÇÃO/UNIDADE}, {EDITAL}, {POSIÇÃO},
  {MODALIDADE}, {DATA_LIMITE}, {LOCAL}, {DOCUMENTOS}, {CONTATO} e {DATA}, **então** posso inseri-los
  pelo botão de cada um, com ou sem acento.
- **Dado** um campo desconhecido ou uma chave sem par, **então** o modelo não salva e a tela diz qual.
- **Dado** que edito um modelo, **então** salvar cria a versão seguinte e pede o motivo; se outra
  pessoa salvou antes, recebo o aviso de conflito (40001) e nada é sobrescrito.
- **Dado** um modelo que não serve mais, **então** eu o inativo com motivo; ele some da emissão, não
  pode ser editado e continua no histórico das cartas. Nada é apagado.
- **Dado** um leitor, **então** ele vê os modelos e as versões, sem os botões de alterar.

Testes: `tests/lib/carta-de-convocacao.test.js` ("validar o modelo"),
`tests/componentes/convocado-e-carta.test.js` (H4), ensaio E3.

### H5. Emitir a carta para um ou vários candidatos

Como **editor**, quero gerar a carta de convocação para os candidatos escolhidos, no formato do SEI,
para formalizar a convocação sem copiar dados à mão.

- **Dado** a aba Convocação, **quando** marco candidatos (ou uso "Escolher os a convocar") e clico em
  "Carta de convocação", **então** abre a emissão com eles; pela linha ou pela gaveta, abre com um só.
- **Dado** a emissão, **então** escolho o modelo (os do edital de todos os candidatos primeiro), e os
  campos da emissão que o modelo usa vêm da versão vigente — a data limite pelo prazo padrão.
- **Dado** a data limite já passada, ou local/documentos/contato vazios quando o modelo os usa,
  **então** as saídas ficam bloqueadas e a tela diz o que falta; candidato sem algum dado (o CPF, que
  a lista não guarda) gera aviso e sai com o espaço em branco.
- **Dado** "Um documento com todas", **então** a prévia mostra todas as cartas, uma por página; com
  "Uma carta por candidato", navego uma a uma.
- **Dado** as saídas, **então** "Copiar para o SEI" leva HTML com as classes do SEI (uma carta por vez
  na opção por candidato), "DOCX" baixa o Word com papel timbrado (um .zip com um .docx por candidato
  na opção por candidato) e "PDF" abre a impressão — o mesmo gerador do documento oficial da
  Classificação.
- **Dado** a primeira saída, **então** a emissão é registrada (quem, quando, modelo e versão,
  candidatos na ordem, agrupamento, saída e valores); outra saída da mesma carta não registra de novo.
- **Dado** um leitor, **então** ele não vê a escolha de candidatos nem o botão da carta.

Testes: `tests/lib/carta-de-convocacao.test.js` ("preencher a carta", "validar a emissão",
"o documento"), `tests/componentes/convocado-e-carta.test.js` (H5/H6), ensaio E3/E4.

### H6. Marcar como Convocado depois de emitir

Como **editor**, quero, logo depois de emitir a carta, marcar os candidatos dela como Convocado na data
escolhida, para não ter de abrir o status de um por um.

- **Dado** uma carta registrada, **então** a tela oferece "Marcar como Convocado em [data]" para os
  candidatos da carta sem status ou já convocados.
- **Dado** que confirmo, **então** eles ficam Convocado com a data, o histórico do status aponta a
  carta e quem já tinha outro status fica de fora, com o motivo.

Testes: `tests/componentes/convocado-e-carta.test.js`, ensaio E3 ("marcar convocados") e E4.

### H7. Ver as cartas emitidas na gaveta do candidato

Como **qualquer pessoa que lê a lista**, quero abrir o candidato e ver as cartas de convocação que ele
recebeu, para responder a dúvidas sem procurar no SEI.

- **Dado** o nome do candidato (nas duas abas), **quando** clico, **então** abre a gaveta com os dados
  da lista, o status com a data da convocação e as cartas emitidas, da mais recente: quando, quem,
  modelo e versão, como saiu, prazo, com quantos outros candidatos e se a convocação foi marcada por
  ela.
- **Dado** que a lista foi republicada, **então** as cartas da lista anterior continuam aparecendo.
- **Dado** um editor, **então** a gaveta oferece "Alterar status" e "Carta de convocação".

Testes: `tests/componentes/convocado-e-carta.test.js` (H7), ensaio E3.
