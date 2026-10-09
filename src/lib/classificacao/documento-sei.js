/*
  O documento oficial de uma lista da Classificação, no modelo das publicações
  da AgSUS no SEI (Comunicado Externo dos editais 83/2026 e 100/2026):

    [timbrado: logo + nome e endereço da agência]        ← o SEI põe
    Brasília, na data da assinatura digital.            (à direita)
    TÍTULO EM CAIXA ALTA                                 (centralizado)
    1. DISPOSIÇÕES PRELIMINARES   1.1. … 1.2. … (1.3.1. …)
    VAGA <código> - <cargo> - <lotação> - <unidade> - <N vagas (…)>
    [tabela da vaga]  — todas as vagas, inclusive as vazias:
                        "Não houve candidatos aptos."
    [*nota de desempate] — só na vaga com empate de nota resolvido (critério
                        ou empate final); texto em regra.documento.desempate
    2. DISPOSIÇÕES FINAIS        2.1. …
    [assinatura eletrônica e rodapé "<título> (<nº>) SEI <processo> / pg. N"]
                                                         ← o SEI põe

  `documentoOficial` monta o modelo (sem HTML) a partir do retrato da lista
  registrada (exportacao.js) e dos textos do edital (regra.documento, com os
  padrões abaixo). Dele saem:
    - `htmlParaSei`: o HTML para colar no editor do SEI (CKEditor), com as
      classes de estilo do SEI (Item_Nivel1/2/3/4 numeram sozinhas, por
      contador de CSS — por isso o número NÃO vai no texto), tabelas com borda
      e largura em %; sem timbrado, assinatura nem rodapé;
    - `textoParaSei`: o mesmo em texto puro (numerado; tabelas por tabulação),
      para a área de transferência e para quem cola fora do SEI;
    - `paginaDaPrevia`: a página "Como fica no SEI" (timbrado simulado, as
      classes do SEI imitadas em CSS) — a prévia na tela e a impressão (PDF);
    - o DOCX com papel timbrado (documento-docx.js).

  Textos: cada linha das disposições é um item (1.1., 1.2.…); ">" no começo
  desce um nível (1.3.1.), ">>" dois (1.3.3.1.). **negrito** vira negrito.
  Campos entre chaves são trocados pelo do edital: {edital}, {unidade},
  {unidade_sigla}, {ao}, {do}, {autoridade} (", <autoridade>"),
  {autoridade_entre_virgulas} (", <autoridade>,"), {fase}, {fase_min}, {FASE},
  {publico}, {notas_minimas}, {processo}.

  Os textos-padrão saíram das publicações do edital 83/2026 (DSEI Xingu) e do
  100/2026 (CASAI Brasília): resultado preliminar e final da análise
  curricular (geral, por modalidade e reprovados/eliminados), convocação para
  entrevista, resultado preliminar e final da entrevista e resultado final do
  processo seletivo. As listas sem publicação de referência (eliminados da
  entrevista e do resultado final, resultado final preliminar) seguem o mesmo
  modelo.

  Colunas das tabelas: as do padrão de cada publicação ou as que o gestor
  escolheu e ordenou (regra.documento.colunas; colunas-do-documento.js).

  SÓ NOME COMPLETO — o retrato já não traz CPF, inscrição nem nascimento.
*/
import { MOTIVOS_DE_ELIMINACAO } from "./catalogo.js";
import {
  COLUNA_DA_ART,
  colunasDisponiveis,
  colunasEscolhidas,
  parcialDaColuna,
} from "./colunas-do-documento.js";
import { escalar, formatarNota, lerData, ordinal } from "./numeros.js";
import { documentoDaRegra, normalizarRegra } from "./regra.js";
import { CABECALHO_PADRAO } from "../cabecalho-dos-documentos.js";
import {
  MARCA_SEM_VALOR_OFICIAL,
  ehEditalDeTreinamento,
} from "../edital-de-treinamento.js";

export { CABECALHO_PADRAO };
export const LOCAL_PADRAO = "Brasília";

const VAZIA = "Não houve candidatos aptos.";
const VAZIA_ELIMINADOS = "Não houve candidatos eliminados.";
const VAZIA_CONVOCACAO = "Não houve candidatos convocados.";
const VAZIA_PROVISORIA = "Não houve candidatos classificados.";

/* ── Textos-padrão (das publicações) ─────────────────────────────────── */

const AGSUS = "**Agência Brasileira de Apoio à Gestão do SUS (AgSUS)**";
const COMPROMISSO =
  "no exercício de seu compromisso institucional com a transparência, responsabilidade e adequada condução de seus certames";
const DESCLASSIFICADOS =
  "Ressalta-se, ainda, que foram considerados desclassificados os candidatos que deixaram de apresentar documentação obrigatória ou que apresentaram documentos em desconformidade com os itens dispostos no item 8 do edital.";
const QUESTIONARIOS =
  "Igualmente, foram desclassificados os candidatos que não concluíram ou não preencheram integralmente os questionários obrigatórios vinculados à vaga para a qual se inscreveram. Destaca-se que a plataforma de inscrições encaminha comunicação eletrônica ao candidato imediatamente após a inscrição, informando a necessidade de preenchimento do respectivo questionário. Caso a pendência permaneça, novo aviso é enviado na véspera do encerramento das inscrições.";
const NOTA_MINIMA_DOCUMENTAL =
  "Nos termos do item 8.20 do Edital, a pontuação mínima exigida para aptidão na **Avaliação Documental e de Títulos** é de {notas_minimas}.";
/* O 83/2026 cita "do Edital" na documental e "do Edital nº 83/2026" na entrevista. */
const recurso = (etapa, { comNumero = true } = {}) =>
  `Os candidatos poderão interpor recurso contra o resultado preliminar ${etapa}, nos termos do item 11 do Edital${comNumero ? " nº {edital}" : ""}, exclusivamente por meio do e-mail recursos.nerssi@agenciasus.org.br, mediante requerimento específico, conforme modelo constante no Anexo VII, no período estabelecido no cronograma.`;
const ELIMINADOS_FINAL = (etapa) => [
  `O presente Resultado Final divulga a relação dos candidatos eliminados ${etapa}, os quais, nos termos deste Edital, não atenderam aos requisitos para classificação nesta etapa.`,
  "Em razão da eliminação, os candidatos relacionados nesta publicação não serão convocados para as etapas subsequentes do Processo Seletivo Simplificado.",
  "As publicações referentes às demais etapas do Processo Seletivo Simplificado serão divulgadas no site oficial da AgSUS.",
];
const linhas = (...itens) => itens.join("\n");

const DOCUMENTAL_PRELIMINARES = linhas(
  `A ${AGSUS}{autoridade}, em conformidade com o **Edital nº {edital}**, referente ao Processo Seletivo Simplificado destinado {ao} **{unidade}**, ${COMPROMISSO}, torna público o **Resultado {fase} da Etapa de Avaliação Documental e de Títulos {publico}**, conforme previsto no item 8 do referido Edital.`,
  "A presente listagem contempla os candidatos classificados por cargo, em ordem decrescente de pontuação, contendo o nome completo e a respectiva nota obtida após a avaliação da documentação apresentada.",
  NOTA_MINIMA_DOCUMENTAL,
  DESCLASSIFICADOS,
  "Apresenta-se, a seguir, a relação {fase_min} dos(as) candidatos(as) aprovados(as) na etapa de Avaliação Documental e de Títulos.",
);
const DOCUMENTAL_ELIMINADOS_PRELIMINARES = linhas(
  `A ${AGSUS}{autoridade}, em conformidade com o **Edital nº {edital}**, referente ao Processo Seletivo Simplificado destinado {ao} **{unidade}**, torna público o **Resultado {fase} da Etapa de Avaliação Documental e de Títulos dos Candidatos Eliminados**, conforme disposto no item 8 do referido edital.`,
  "Conforme disposto no item 8.20 do Edital, a pontuação mínima exigida para aptidão na Avaliação Documental e de Títulos é de {notas_minimas}. Segundo o item 8.21 do Edital, os candidatos que não atingirem a pontuação mínima exigida serão eliminados do processo seletivo.",
  "A relação apresentada neste documento contempla os candidatos que tiveram sua documentação analisada e foram considerados eliminados na etapa de Avaliação Documental e de Títulos em razão do não atendimento a requisitos previstos no edital. Para cada candidato, são informados o nome completo, a pontuação obtida e o respectivo motivo da eliminação, conforme avaliação da documentação apresentada.",
  DESCLASSIFICADOS,
  QUESTIONARIOS,
  "Apresenta-se, a seguir, a relação {fase_min} dos(as) candidatos(as) eliminados(as) na etapa de Avaliação Documental e de Títulos.",
);
const ENTREVISTA_PRELIMINARES = linhas(
  `A ${AGSUS}{autoridade}, em conformidade com o Edital nº {edital}, referente ao Processo Seletivo Simplificado destinado {ao} **{unidade}**, ${COMPROMISSO}, torna público o **Resultado {fase} da Etapa de Entrevistas {publico}**, conforme previsto no item 9 do referido Edital.`,
  "Foram considerados(as) aprovados(as) na etapa de Entrevistas os(as) candidatos(as) relacionados(as) a seguir, por ordem de classificação, com indicação do nome completo e da respectiva nota obtida:",
);
const ENTREVISTA_ELIMINADOS_PRELIMINARES = linhas(
  `A ${AGSUS}{autoridade}, em conformidade com o Edital nº {edital}, referente ao Processo Seletivo Simplificado destinado {ao} **{unidade}**, torna público o **Resultado {fase} da Etapa de Entrevistas dos Candidatos Eliminados**, conforme previsto no item 9 do referido Edital.`,
  "A relação apresentada neste documento contempla os candidatos eliminados na etapa de Entrevistas, com o nome completo, a nota obtida e o respectivo motivo da eliminação.",
);
/*
  As listas da pré-classificação (Avaliação documental, fase F2): a Lista
  Geral de Classificação Provisória por ART (item 8.3.1, caráter provisório,
  não valida documentos) e o Lote de Convocação (item 8.4). Os itens do
  edital ficam no texto e podem ser trocados por edital (regra.documento).
*/
const PROVISORIA_PRELIMINARES = linhas(
  `A ${AGSUS}{autoridade}, em conformidade com o **Edital nº {edital}**, referente ao Processo Seletivo Simplificado destinado {ao} **{unidade}**, ${COMPROMISSO}, torna pública a **Lista Geral de Classificação Provisória – Ranqueamento Eletrônico**, conforme previsto no item 8.3.1 do referido Edital.`,
  "A classificação segue a Nota da Autodeclaração de Requisitos e Títulos (ART), obtida das respostas do candidato ao questionário da plataforma de inscrições, em ordem decrescente.",
  "Esta lista tem caráter provisório e classificatório e não valida os documentos apresentados, que serão conferidos na etapa de Avaliação Documental e de Títulos, nos termos do item 8.4 do Edital.",
  "Apresenta-se, a seguir, a relação dos(as) candidatos(as) por vaga, com a classificação, o nome completo e a nota da ART.",
);
const PROVISORIA_ELIMINADOS_PRELIMINARES = linhas(
  `A ${AGSUS}{autoridade}, em conformidade com o **Edital nº {edital}**, referente ao Processo Seletivo Simplificado destinado {ao} **{unidade}**, torna pública a relação dos **Candidatos Eliminados na Lista Geral de Classificação Provisória**, conforme previsto no item 8.3.1 do referido Edital.`,
  QUESTIONARIOS,
  "A relação apresentada neste documento contempla, por vaga, o nome completo e o motivo da eliminação.",
);
const LOTE_PRELIMINARES = linhas(
  `A ${AGSUS}{autoridade}, em conformidade com o **Edital nº {edital}**, referente ao Processo Seletivo Simplificado destinado {ao} **{unidade}**, ${COMPROMISSO}, torna pública a relação dos(as) candidatos(as) convocados(as) para a **Etapa de Avaliação Documental e de Títulos**, conforme previsto no item 8.4 do referido Edital.`,
  "A avaliação documental é restrita aos candidatos classificados na Lista Geral de Classificação Provisória dentro do limite do lote de convocação. Havendo eliminação ou desistência, novos candidatos poderão ser convocados, respeitada a ordem de classificação.",
  "Apresenta-se, a seguir, a relação dos(as) candidatos(as) convocados(as), por vaga, com a classificação na Lista Provisória, o nome completo e a nota da ART.",
);

const FINAL_PRELIMINARES = linhas(
  `A Agência Brasileira de Apoio à Gestão do SUS (AgSUS){autoridade}, em conformidade com o **Edital nº {edital}**, referente {ao} **{unidade}**, ${COMPROMISSO}, torna público o **Resultado {fase} do Processo Seletivo {publico}**, conforme previsto no item 10 do referido Edital.`,
  "A nota final do processo seletivo corresponde à soma das pontuações obtidas na Avaliação Documental e de Títulos (até 30 pontos) e na Entrevista Individual (até 20 pontos).",
  "Foram considerados(as) aprovados(as) na etapa final do Processo Seletivo os(as) candidatos(as) relacionados(as) a seguir, por ordem de classificação, com indicação do nome completo e da respectiva nota obtida:",
);
const FINAL_ELIMINADOS_PRELIMINARES = linhas(
  `A Agência Brasileira de Apoio à Gestão do SUS (AgSUS){autoridade}, em conformidade com o **Edital nº {edital}**, referente {ao} **{unidade}**, torna público o **Resultado {fase} do Processo Seletivo dos Candidatos Eliminados**, conforme previsto no item 10 do referido Edital.`,
  "A relação apresentada neste documento contempla os candidatos eliminados no Processo Seletivo, com o nome completo e o respectivo motivo da eliminação.",
);

/*
  Os modelos por chave (`TIPO_FASE[_ELIMINADOS]`; a convocação não tem fase).
  `publico_geral`: o que {publico} diz na lista geral (o 83 publicou a geral
  da documental como "das Vagas de Ampla Concorrência").
*/
export const MODELOS_PADRAO = Object.freeze({
  PROVISORIA: {
    rotulo: "Lista Geral de Classificação Provisória (ART)",
    titulo: "LISTA GERAL DE CLASSIFICAÇÃO PROVISÓRIA - RANQUEAMENTO ELETRÔNICO",
    preliminares: PROVISORIA_PRELIMINARES,
    finais: linhas(
      "A convocação para a etapa de Avaliação Documental e de Títulos observará a ordem desta lista e o limite do lote de convocação previsto no item 8.4 do Edital.",
      "As publicações referentes às próximas etapas do Processo Seletivo Simplificado serão divulgadas na página oficial da AgSUS.",
    ),
  },
  PROVISORIA_ELIMINADOS: {
    rotulo: "Lista Provisória — eliminados",
    titulo: "LISTA GERAL DE CLASSIFICAÇÃO PROVISÓRIA - CANDIDATOS ELIMINADOS",
    preliminares: PROVISORIA_ELIMINADOS_PRELIMINARES,
    finais:
      "Os candidatos relacionados nesta publicação não serão convocados para a etapa de Avaliação Documental e de Títulos.",
  },
  LOTE: {
    rotulo: "Lote de convocação (avaliação documental)",
    titulo: "LOTE DE CONVOCAÇÃO - ETAPA DE AVALIAÇÃO DOCUMENTAL E DE TÍTULOS",
    preliminares: LOTE_PRELIMINARES,
    finais:
      "O resultado da etapa de Avaliação Documental e de Títulos será publicado conforme o cronograma estabelecido no Edital.",
  },
  PRELIMINAR_PRELIMINAR: {
    rotulo: "Avaliação documental — resultado preliminar",
    publico_geral: "das Vagas de Ampla Concorrência",
    titulo: "RESULTADO {FASE} - ETAPA DE ANÁLISE CURRICULAR",
    preliminares: DOCUMENTAL_PRELIMINARES,
    finais: recurso("da etapa Avaliação Documental e de Títulos", {
      comNumero: false,
    }),
  },
  PRELIMINAR_FINAL: {
    rotulo: "Avaliação documental — resultado final",
    publico_geral: "das Vagas de Ampla Concorrência",
    titulo: "RESULTADO {FASE} - ETAPA DE ANÁLISE CURRICULAR",
    preliminares: DOCUMENTAL_PRELIMINARES,
    finais: linhas(
      "Serão convocados para a etapa de Entrevista os candidatos classificados na etapa de Avaliação Documental e de Títulos, observados os critérios, os limites de convocação e a ordem de classificação, nos termos do item 8.24 deste Edital.",
      "A convocação para a etapa de Entrevista será realizada de acordo com a demanda e a organização administrativa {do} {unidade_sigla}. A data, o horário e o local ou o meio de realização da Entrevista serão definidos no respectivo ato de convocação.",
      "As publicações referentes às próximas etapas e às convocações do Processo Seletivo Simplificado serão divulgadas na página oficial da AgSUS.",
    ),
  },
  PRELIMINAR_PRELIMINAR_ELIMINADOS: {
    rotulo: "Avaliação documental — eliminados (preliminar)",
    titulo: "RESULTADO {FASE} - ETAPA DE ANÁLISE CURRICULAR",
    preliminares: DOCUMENTAL_ELIMINADOS_PRELIMINARES,
    finais: linhas(
      "O presente Resultado divulga a relação dos candidatos eliminados na etapa de Avaliação Documental e de Títulos, os quais, nos termos deste Edital, não atenderam aos requisitos para classificação nesta etapa.",
      recurso("da etapa Avaliação Documental e de Títulos", {
        comNumero: false,
      }),
    ),
  },
  PRELIMINAR_FINAL_ELIMINADOS: {
    rotulo: "Avaliação documental — eliminados (final)",
    titulo: "RESULTADO {FASE} - ETAPA DE ANÁLISE CURRICULAR",
    preliminares: DOCUMENTAL_ELIMINADOS_PRELIMINARES,
    finais: linhas(
      ...ELIMINADOS_FINAL("na etapa de Avaliação Documental e de Títulos"),
    ),
  },
  CONVOCACAO: {
    rotulo: "Convocação para entrevista",
    titulo: linhas(
      "COMUNICADO EXTERNO",
      "**EDITAL DE CONVOCAÇÃO PARA ENTREVISTA**",
      "**PROCESSO SELETIVO SIMPLIFICADO – {unidade_sigla} – EDITAL Nº {edital}**",
    ),
    preliminares: linhas(
      "A Agência Brasileira de Apoio à Gestão do SUS (AgSUS){autoridade_entre_virgulas} torna pública a convocação para entrevistas referente ao Processo Seletivo Público Simplificado para o preenchimento de vagas e formação de cadastro de reserva, destinados ao Quadro de Empregados de Projetos da AgSUS, para atuação nas áreas de abrangência {do} {unidade}, regido pelo Edital nº {edital}.",
      "Os candidatos convocados para a entrevista estão dispostos por ordem de convocação, nome, vaga, data e horário da entrevista. Este horário será no horário local de Brasília, DF.",
      "As entrevistas ocorrerão na modalidade virtual, de acordo com o item 9.2 do Edital nº {edital}.",
      ">**Os candidatos convocados receberão o link de acesso às entrevistas em seus respectivos endereços eletrônicos constantes na plataforma de cadastro neste certame.**",
      ">**Os candidatos deverão entrar na chamada com 05 minutos de antecedência do horário agendado e apresentar seu documento original válido com foto e, para candidatos indígenas, a declaração de pertencimento étnico, de acordo com o item 9.3 do referido edital.**",
      ">**Ressaltam-se as seguintes orientações gerais:**",
      ">>**Os candidatos não poderão utilizar aparelhos eletrônicos durante as entrevistas;**",
      ">>**Não está permitida a consulta para as respostas durante a entrevista, seja por meio de material impresso, eletrônico ou por intermédio de outras pessoas;**",
      ">>**O candidato deverá estar em local sem ruído.**",
      "Apresenta-se, a seguir, a lista dos(as) candidatos(as) habilitados(as) para a etapa de entrevistas.",
    ),
    finais:
      "Conforme disposto nos itens 8.25 e 8.25.1, caso as vagas não sejam preenchidas, a Banca Examinadora poderá realizar novas convocações, respeitando rigorosamente a ordem de classificação. A solicitação de novos candidatos para entrevistas deve ser feita formalmente pela Coordenação {do} {unidade_sigla} à AgSUS antes da publicação do resultado preliminar desta etapa.",
  },
  ENTREVISTA_PRELIMINAR: {
    rotulo: "Entrevista — resultado preliminar",
    titulo: "RESULTADO {FASE} - ETAPA DE ENTREVISTA",
    preliminares: ENTREVISTA_PRELIMINARES,
    finais: recurso("da etapa de entrevistas"),
  },
  ENTREVISTA_FINAL: {
    rotulo: "Entrevista — resultado final",
    titulo: "RESULTADO {FASE} - ETAPA DE ENTREVISTA",
    preliminares: ENTREVISTA_PRELIMINARES,
    finais:
      "Esta nota corresponde somente à nota atribuída na etapa de Entrevista. Ressalta-se que será publicada a nota final do processo seletivo, que condiz à soma das pontuações obtidas na Avaliação Documental e de Títulos (até 30 pontos) e na Entrevista Individual (até 20 pontos). O resultado será divulgado conforme o cronograma estabelecido na última retificação publicada, e a classificação final ocorrerá em ordem decrescente da pontuação total, observados os critérios de desempate previstos no item 10.4.",
  },
  ENTREVISTA_PRELIMINAR_ELIMINADOS: {
    rotulo: "Entrevista — eliminados (preliminar)",
    titulo: "RESULTADO {FASE} - ETAPA DE ENTREVISTA",
    preliminares: ENTREVISTA_ELIMINADOS_PRELIMINARES,
    finais: linhas(
      "O presente Resultado divulga a relação dos candidatos eliminados na etapa de Entrevistas, os quais, nos termos deste Edital, não atenderam aos requisitos para classificação nesta etapa.",
      recurso("da etapa de entrevistas"),
    ),
  },
  ENTREVISTA_FINAL_ELIMINADOS: {
    rotulo: "Entrevista — eliminados (final)",
    titulo: "RESULTADO {FASE} - ETAPA DE ENTREVISTA",
    preliminares: ENTREVISTA_ELIMINADOS_PRELIMINARES,
    finais: linhas(...ELIMINADOS_FINAL("na etapa de Entrevistas")),
  },
  FINAL_FINAL: {
    rotulo: "Resultado final do processo seletivo",
    titulo: "RESULTADO {FASE} - PROCESSO SELETIVO",
    preliminares: FINAL_PRELIMINARES,
    finais: linhas(
      "Os(as) candidatos(as) aprovados(as) dentro do quantitativo de vagas ofertadas para início imediato serão convocados(as) para a realização dos exames médicos admissionais, seguindo rigorosamente a ordem de classificação.",
      "Os(as) candidatos(as) integrantes do cadastro de reserva poderão ser convocados(as) à medida que surgirem novas vagas, observados o prazo de validade do processo seletivo e as necessidades operacionais {do} {unidade_sigla}.",
    ),
  },
  FINAL_PRELIMINAR: {
    rotulo: "Resultado final — versão preliminar",
    titulo: "RESULTADO {FASE} - PROCESSO SELETIVO",
    preliminares: FINAL_PRELIMINARES,
    finais: recurso("do Processo Seletivo"),
  },
  FINAL_FINAL_ELIMINADOS: {
    rotulo: "Resultado final — eliminados",
    titulo: "RESULTADO {FASE} - PROCESSO SELETIVO",
    preliminares: FINAL_ELIMINADOS_PRELIMINARES,
    finais: linhas(...ELIMINADOS_FINAL("no Processo Seletivo")),
  },
  FINAL_PRELIMINAR_ELIMINADOS: {
    rotulo: "Resultado final — eliminados (preliminar)",
    titulo: "RESULTADO {FASE} - PROCESSO SELETIVO",
    preliminares: FINAL_ELIMINADOS_PRELIMINARES,
    finais: recurso("do Processo Seletivo"),
  },
});

const FASE_PADRAO = Object.freeze({ FINAL: "FINAL" });
/* Listas sem fase no título (a convocação e as da pré-classificação). */
const SEM_FASE = new Set(["CONVOCACAO", "PROVISORIA", "LOTE"]);

/** A fase da publicação: a escolhida, ou a padrão da etapa (FINAL no resultado final). */
export function faseDaPublicacao(tipo, fase) {
  if (SEM_FASE.has(tipo)) return null;
  return fase === "FINAL" || fase === "PRELIMINAR"
    ? fase
    : FASE_PADRAO[tipo] || "PRELIMINAR";
}

/** A chave do modelo de texto: "PRELIMINAR_FINAL_ELIMINADOS", "CONVOCACAO"… */
export function chaveDoModelo(tipo, fase, lista = "todas") {
  if (tipo === "CONVOCACAO" || tipo === "LOTE") return tipo;
  if (tipo === "PROVISORIA")
    return lista === "eliminados" ? "PROVISORIA_ELIMINADOS" : "PROVISORIA";
  const f = faseDaPublicacao(tipo, fase);
  const chave = `${tipo}_${f}${lista === "eliminados" ? "_ELIMINADOS" : ""}`;
  return MODELOS_PADRAO[chave] ? chave : `${tipo}_${f}`;
}

/** Os textos de um modelo: os do edital (regra.documento.modelos) ou os padrões. */
export function textosDoModelo(documento, chave) {
  const padrao = MODELOS_PADRAO[chave] || MODELOS_PADRAO.PRELIMINAR_PRELIMINAR;
  const proprio = documento?.modelos?.[chave] || {};
  return {
    titulo: proprio.titulo || padrao.titulo,
    preliminares: proprio.preliminares || padrao.preliminares,
    finais: proprio.finais || padrao.finais,
  };
}

/* ── Campos do edital ───────────────────────────────────────────────── */

/** "Edital 83/2026 - DSEI Xingu" → "83/2026". */
export function numeroDoEdital(texto) {
  const m = String(texto ?? "").match(/(\d{1,4})\s*\/\s*(\d{4})/);
  return m ? `${Number(m[1])}/${m[2]}` : String(texto ?? "").trim();
}

/*
  A unidade por extenso e os artigos ("destinado ao Distrito…", "à Casa…").
  `propria` = o que o gestor escreveu (vence a dedução pela sigla).
*/
export function unidadeDoEdital(sigla, propria = "") {
  const s = String(sigla ?? "").trim();
  const feminino = (nome) => /^(casa|coordena|diretoria|unidade)/i.test(nome);
  if (String(propria ?? "").trim()) {
    const nome = String(propria).trim();
    return feminino(nome)
      ? { nome, sigla: s || nome, ao: "à", do: "da" }
      : { nome, sigla: s || nome, ao: "ao", do: "do" };
  }
  let m = s.match(/^DSEI\s*[-/]?\s*(.+)$/i);
  if (m)
    return {
      nome: `Distrito Sanitário Especial Indígena ${m[1]} (DSEI ${m[1]})`,
      sigla: s,
      ao: "ao",
      do: "do",
    };
  m = s.match(/^CASAI\s*[-/]?\s*(.+)$/i);
  if (m)
    return {
      nome: `Casa de Apoio à Saúde Indígena ${m[1]} (CASAI ${m[1]})`,
      sigla: s,
      ao: "à",
      do: "da",
    };
  return { nome: s, sigla: s, ao: "ao", do: "do" };
}

const UNIDADES = [
  "zero",
  "um",
  "dois",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
  "dez",
  "onze",
  "doze",
  "treze",
  "quatorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
  "vinte",
];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta"];

/** 7 → "7 (sete)"; 7,5 → "7,5". Até 59 por extenso. */
export function numeroComExtenso(valor) {
  if (!Number.isFinite(valor)) return "";
  const n = Number(valor);
  const digitos = n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  if (!Number.isInteger(n) || n < 0 || n >= 60) return digitos;
  const extenso =
    n <= 20
      ? UNIDADES[n]
      : `${DEZENAS[Math.floor(n / 10)]}${n % 10 ? ` e ${UNIDADES[n % 10]}` : ""}`;
  return `${digitos} (${extenso})`;
}

const NIVEIS_DO_TEXTO = [
  ["superior", "superior"],
  ["tecnico", "técnico"],
  ["medio", "médio"],
  ["fundamental", "fundamental"],
];

/*
  "7 (sete) pontos para nível superior, 6 (seis) pontos para nível técnico e
  médio, e 5 (cinco) pontos para nível fundamental" — das notas mínimas da
  regra (por nível, ou a única). Sem nota mínima: lacuna para o gestor.
*/
export function textoDasNotasMinimas(regraBruta) {
  const r = normalizarRegra(regraBruta);
  const pontos = (v) =>
    `${numeroComExtenso(v)} ${v === 1 ? "ponto" : "pontos"}`;
  const porNivel = r.documental.nota_minima_por_nivel;
  const grupos = [];
  for (const [nivel, rotulo] of NIVEIS_DO_TEXTO) {
    const v = porNivel[nivel];
    if (v === undefined || v === null) continue;
    const ultimo = grupos.at(-1);
    if (ultimo && ultimo.valor === v) ultimo.rotulos.push(rotulo);
    else grupos.push({ valor: v, rotulos: [rotulo] });
  }
  if (grupos.length) {
    const partes = grupos.map(
      (g) =>
        `${pontos(g.valor)} para nível ${g.rotulos.length > 1 ? `${g.rotulos.slice(0, -1).join(", ")} e ${g.rotulos.at(-1)}` : g.rotulos[0]}`,
    );
    return partes.length > 1
      ? `${partes.slice(0, -1).join(", ")}, e ${partes.at(-1)}`
      : partes[0];
  }
  if (r.documental.nota_minima !== null)
    return pontos(r.documental.nota_minima);
  return "____ (____) pontos";
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "2026-10-02" (ou Date) → "2 de outubro de 2026"; dia 1 → "1º de …". */
export function dataPorExtenso(valor) {
  let d = null;
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    const partes = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
        .formatToParts(valor)
        .map((p) => [p.type, p.value]),
    );
    d = lerData(`${partes.year}-${partes.month}-${partes.day}`);
  } else d = lerData(valor);
  if (!d) return "";
  return `${d.dia === 1 ? "1º" : d.dia} de ${MESES[d.mes - 1]} de ${d.ano}`;
}

/* ── O modelo do documento ───────────────────────────────────────────── */

const texto = (valor) => String(valor ?? "").trim();

/** Troca {campo} pelo valor (campo desconhecido fica como está). */
export function preencher(modelo, campos) {
  return String(modelo ?? "").replace(/\{(\w+)\}/g, (inteiro, nome) =>
    Object.prototype.hasOwnProperty.call(campos, nome)
      ? String(campos[nome])
      : inteiro,
  );
}

/** As linhas do texto em itens: { nivel: 2|3|4, texto }. */
export function itensDoTexto(bruto) {
  return String(bruto ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean)
    .map((linha) => {
      const m = linha.match(/^(>{1,2})\s*/);
      return {
        nivel: 2 + (m ? m[1].length : 0),
        texto: m ? linha.slice(m[0].length) : linha,
      };
    })
    .filter((item) => item.texto);
}

/** "texto **negrito** texto" → [{ texto, negrito }]. */
export function trechos(textoComMarcas) {
  const saida = [];
  const partes = String(textoComMarcas ?? "").split(/(\*\*[^*]+?\*\*)/g);
  for (const parte of partes) {
    if (!parte) continue;
    const negrito = /^\*\*[^*]+?\*\*$/.test(parte);
    saida.push({ texto: negrito ? parte.slice(2, -2) : parte, negrito });
  }
  return saida;
}

const semMarcas = (valor) =>
  trechos(valor)
    .map((t) => t.texto)
    .join("");

/* Larguras-base (%) por coluna; o Nome (ou a Vaga) fica com o resto. */
const LARGURAS = Object.freeze({
  Classificação: 14,
  CLASSIFICAÇÃO: 18,
  Nº: 6,
  NOTA: 20,
  "NOTA FINAL": 20,
  "Nota Final": 9,
  Nota: 9,
  "Modalidade de Concorrência": 13,
  MODALIDADE: 14,
  SITUAÇÃO: 16,
  Situação: 14,
  DATA: 12,
  HORA: 9,
  Justificativa: 34,
  [COLUNA_DA_ART]: 30,
});
const ELASTICAS = new Set(["Nome", "NOME", "Vaga"]);

function colunasComLargura(rotulos, alinhamento) {
  const fixas = rotulos.filter((r) => !ELASTICAS.has(r));
  const base = Object.fromEntries(fixas.map((r) => [r, LARGURAS[r] ?? 11]));
  let soma = fixas.reduce((s, r) => s + base[r], 0);
  const elasticas = rotulos.length - fixas.length || 1;
  const minimoElastico = 22 * elasticas;
  if (soma > 100 - minimoElastico) {
    const fator = (100 - minimoElastico) / soma;
    for (const r of fixas) base[r] = Math.floor(base[r] * fator);
    soma = fixas.reduce((s, r) => s + base[r], 0);
  }
  const resto = 100 - soma;
  const vaga = rotulos.includes("Vaga") && rotulos.includes("NOME");
  return rotulos.map((rotulo) => {
    let largura = base[rotulo];
    if (ELASTICAS.has(rotulo)) {
      largura = vaga
        ? Math.round(resto * (rotulo === "Vaga" ? 0.6 : 0.4))
        : Math.floor(resto / elasticas);
    }
    const esquerda =
      alinhamento === "esquerda" ||
      rotulo === "Justificativa" ||
      (alinhamento === "nome-esquerda" && ELASTICAS.has(rotulo));
    return {
      rotulo,
      largura,
      alinhamento: esquerda ? "esquerda" : "centro",
    };
  });
}

/*
  Quem entrou no lote por decisão da coordenação (Lista Provisória e Lote:
  l.decisao = o motivo, ex.: "Critério CORES") sai com uma marca no nome
  ("*", "**"… uma por motivo) e a nota de rodapé da tabela.
*/
export const PREFIXO_DA_NOTA_DE_DECISAO =
  "Incluído por decisão da coordenação: ";

export function marcasDasDecisoes(linhas) {
  const motivos = [];
  for (const l of linhas || []) {
    const motivo = String(l?.decisao ?? "").trim();
    if (motivo && !motivos.includes(motivo)) motivos.push(motivo);
  }
  const marca = new Map(motivos.map((m, i) => [m, "*".repeat(i + 1)]));
  return {
    nome: (l) => {
      const m = marca.get(String(l?.decisao ?? "").trim());
      return m ? `${l.nome} ${m}` : l.nome;
    },
    notas: motivos.map(
      (m) =>
        `${marca.get(m)} ${PREFIXO_DA_NOTA_DE_DECISAO}${m.replace(/\.$/, "")}.`,
    ),
  };
}

/*
  A nota de desempate: logo abaixo da tabela da vaga em que dois candidatos
  com a mesma nota (na escala das casas publicadas, como o motor agrupa)
  ficaram em posições diferentes — o empate foi resolvido pelos critérios da
  regra ou pelo empate final (sorteio, decisão, inscrição). Empate que fica na
  mesma posição não leva a nota. O texto: o do edital
  (regra.documento.desempate) ou o padrão — o rodapé da regra, quando ele já
  é a frase do desempate, ou o item 10.
*/
export const NOTA_DE_DESEMPATE_PADRAO =
  "*Os critérios de desempate foram considerados conforme item 10 do referido edital.";
const TIPOS_COM_NOTA_DE_DESEMPATE = new Set([
  "PRELIMINAR",
  "ENTREVISTA",
  "FINAL",
  "PROVISORIA",
  "LOTE",
]);
const FALA_DO_DESEMPATE = /crit[ée]rios? de desempate/i;

/** A lista leva a nota de desempate? (não a convocação nem os eliminados) */
export function listaComNotaDeDesempate(tipo, lista) {
  return TIPOS_COM_NOTA_DE_DESEMPATE.has(tipo) && lista !== "eliminados";
}

/** O padrão da nota: o rodapé da regra, se é a frase do desempate; senão, o item 10. */
export function notaDeDesempatePadrao(rodape) {
  const r = texto(rodape);
  if (!FALA_DO_DESEMPATE.test(r) || r.length > 300 || r.includes("\n"))
    return NOTA_DE_DESEMPATE_PADRAO;
  return r.startsWith("*") ? r : `*${r}`;
}

/** A nota de desempate do edital (a escrita pelo gestor ou o padrão). */
export function notaDeDesempate(documento, rodape) {
  return texto(documento?.desempate) || notaDeDesempatePadrao(rodape);
}

/** Na lista, dois com a mesma nota em posições diferentes (empate resolvido)? */
export function houveDesempate(linhas, casas = 2) {
  const posicoes = new Map();
  for (const l of linhas || []) {
    const k = escalar(l?.nota, casas);
    if (k === null) continue;
    if (!posicoes.has(k)) posicoes.set(k, new Set());
    posicoes.get(k).add(l.posicao);
    if (posicoes.get(k).size > 1) return true;
  }
  return false;
}

function justificativa(e) {
  return [MOTIVOS_DE_ELIMINACAO[e.motivo] || e.motivo, e.detalhe]
    .filter(Boolean)
    .join(". ")
    .replace(/\.\./g, ".");
}

const nomeDaModalidade = (codigo, modalidades) =>
  codigo === "AC"
    ? "AC"
    : modalidades.find((m) => m.codigo === codigo)?.nome || codigo;

const siglaDasModalidades = (l, modalidades) =>
  (l.modalidades || [])
    .filter((m) => m !== "AC")
    .map((m) =>
      m === "PCD"
        ? "PcD"
        : modalidades.some((x) => x.codigo === m)
          ? m
          : nomeDaModalidade(m, modalidades),
    )
    .join(" / ") || "AC";

/*
  As tabelas de uma lista, no padrão de cada publicação (colunas padrão; o
  gestor escolhe e ordena em "Como fica no SEI" — colunas-do-documento.js):
    PRELIMINAR  Classificação | Nome | [Modalidade] | Nota Final
                (83/2026; o 100/2026 junta as modalidades no mesmo arquivo;
                as parciais da regra ficam disponíveis, desmarcadas)
    ENTREVISTA  Classificação | NOME | NOTA
    FINAL       CLASSIFICAÇÃO | NOME | [MODALIDADE] | NOTA FINAL
    eliminados  Nome | [Nota (Final)] | Justificativa
    CONVOCACAO  Nº | NOME | Vaga | [Modalidade] | DATA | HORA (fixas: uma
                tabela, agrupada por vaga; data e hora vêm da agenda das
                entrevistas salva — `agenda`, Map analise_id → { data,
                inicio } — e, sem horário, ficam em branco para preencher no
                SEI)
  `guardadas`: regra.documento.colunas[chave] (undefined = o padrão).
*/
const SITUACAO_NO_DOCUMENTO = Object.freeze({
  VAGA: "Dentro das vagas",
  CR: "Cadastro reserva",
});

function tabelasDaLista(retrato, lista, agenda = null, guardadas, chave) {
  const casas = retrato.casas ?? 2;
  const tipo = retrato.tipo;
  const modalidades = retrato.modalidades || [];
  const todas = lista === "todas";
  const nota = (v) =>
    v === null || v === undefined ? "-" : formatarNota(v, casas);
  const nomeDaLista = (codigo) =>
    codigo === "geral"
      ? "Classificação Geral"
      : modalidades.find((m) => m.codigo === codigo)?.nome || codigo;
  const disponiveis = colunasDisponiveis(retrato, lista) || [];
  const rotuloDe = Object.fromEntries(disponiveis.map((c) => [c.id, c.rotulo]));
  const escolhidas = colunasEscolhidas(disponiveis, guardadas, chave);

  const tabela = (codigo, linhasDaLista, comModalidade) => {
    const alinhamento =
      tipo === "ENTREVISTA" || tipo === "FINAL"
        ? "centro"
        : tipo === "PROVISORIA" || tipo === "LOTE"
          ? "nome-esquerda"
          : "esquerda";
    // A Modalidade só cabe na tabela da classificação geral (com as modalidades).
    const ids = escolhidas.filter((id) => id !== "MODALIDADE" || comModalidade);
    const decisoes =
      tipo === "PROVISORIA" || tipo === "LOTE"
        ? marcasDasDecisoes(linhasDaLista)
        : { nome: (l) => l.nome, notas: [] };
    const celula = (id, l) => {
      const parcial = parcialDaColuna(id);
      if (parcial) return nota(l.parciais?.[parcial]);
      if (id === "CLASSIFICACAO") return ordinal(l.posicao);
      if (id === "NOME") return decisoes.nome(l);
      if (id === "MODALIDADE") return siglaDasModalidades(l, modalidades);
      if (id === "NOTA") return formatarNota(l.nota, casas);
      if (id === "SITUACAO") return SITUACAO_NO_DOCUMENTO[l.situacao] || "-";
      return "";
    };
    return {
      titulo: todas ? nomeDaLista(codigo) : "",
      colunas: colunasComLargura(
        ids.map((id) => rotuloDe[id]),
        alinhamento,
      ),
      notas: decisoes.notas,
      linhas: linhasDaLista.map((l) => ids.map((id) => celula(id, l))),
      vazia:
        tipo === "LOTE"
          ? VAZIA_CONVOCACAO
          : tipo === "PROVISORIA"
            ? VAZIA_PROVISORIA
            : VAZIA,
    };
  };

  const tabelaDeEliminados = (v) => {
    const comNota = (v.eliminados || []).some((e) => e.nota !== undefined);
    // Vaga sem nota nos eliminados: sem a nota e as parciais.
    const ids = escolhidas.filter(
      (id) => comNota || (id !== "NOTA" && !parcialDaColuna(id)),
    );
    const celula = (id, e) => {
      const parcial = parcialDaColuna(id);
      if (parcial) return nota(e.parciais?.[parcial]);
      if (id === "NOME") return e.nome;
      if (id === "NOTA") return nota(e.nota);
      if (id === "JUSTIFICATIVA") return justificativa(e);
      return "";
    };
    return {
      titulo: "",
      colunas: colunasComLargura(
        ids.map((id) => rotuloDe[id]),
        "esquerda",
      ),
      linhas: (v.eliminados || []).map((e) => ids.map((id) => celula(id, e))),
      vazia: VAZIA_ELIMINADOS,
    };
  };

  if (tipo === "CONVOCACAO") {
    const rotulos = [
      "Nº",
      "NOME",
      "Vaga",
      ...(todas && modalidades.length ? ["Modalidade de Concorrência"] : []),
      "DATA",
      "HORA",
    ];
    const linhasDaTabela = [];
    for (const v of retrato.vagas) {
      const fonte =
        lista === "todas" || lista === "geral"
          ? v.geral
          : v.listas?.[lista] || [];
      const vaga = [v.codigo, v.cargo, v.lotacao].filter(Boolean).join(" - ");
      for (const l of fonte)
        linhasDaTabela.push([
          String(linhasDaTabela.length + 1),
          l.nome,
          vaga,
          ...(rotulos.length === 6
            ? [siglaDasModalidades(l, modalidades)]
            : []),
          ...dataEHoraDaAgenda(agenda, l.analise_id),
        ]);
    }
    return [
      {
        cabecalho: "",
        tabelas: [
          {
            titulo: "",
            colunas: colunasComLargura(rotulos, "nome-esquerda"),
            linhas: linhasDaTabela,
            vazia: VAZIA_CONVOCACAO,
          },
        ],
      },
    ];
  }

  return retrato.vagas.map((v) => {
    const tabelas = [];
    let desempate = false;
    const comLinhas = (codigo, linhasDaLista, comModalidade) => {
      if (houveDesempate(linhasDaLista, casas)) desempate = true;
      tabelas.push(tabela(codigo, linhasDaLista, comModalidade));
    };
    if (lista === "eliminados") tabelas.push(tabelaDeEliminados(v));
    else {
      if (todas || lista === "geral")
        comLinhas("geral", v.geral || [], todas && modalidades.length > 0);
      for (const m of modalidades)
        if (todas || lista === m.codigo)
          comLinhas(m.codigo, v.listas?.[m.codigo] || [], false);
    }
    return { cabecalho: v.cabecalho || "", tabelas, desempate };
  });
}

function nomeDaListaNoDocumento(retrato, lista) {
  if (lista === "eliminados") return "Eliminados";
  if (lista === "todas" || lista === "geral") return "Classificação Geral";
  return (
    (retrato.modalidades || []).find((m) => m.codigo === lista)?.nome || lista
  );
}

function publicoDaLista(retrato, lista, modeloPadrao) {
  if (lista === "eliminados") return "";
  if (lista === "todas" || lista === "geral")
    return modeloPadrao?.publico_geral || "";
  const m = (retrato.modalidades || []).find((x) => x.codigo === lista);
  if (!m) return "";
  const sigla = m.codigo === "PCD" ? "PcD" : m.codigo;
  // A regra pode chamar a modalidade pela sigla ("PcD"): o texto usa o nome.
  const nome =
    m.nome.toUpperCase() === m.codigo && m.codigo === "PCD"
      ? "Pessoas com Deficiência"
      : m.nome;
  return `das Vagas Reservadas para ${nome} (${sigla})`;
}

/* "RESULTADO PRELIMINAR - ETAPA DE ANÁLISE CURRICULAR" → "Resultado Preliminar - Etapa de Análise Curricular". */
function emTitulo(valor) {
  const menores = new Set([
    "de",
    "da",
    "do",
    "das",
    "dos",
    "e",
    "a",
    "o",
    "para",
  ]);
  return String(valor)
    .toLowerCase()
    .split(/(\s+)/)
    .map((p, i) =>
      i && menores.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1),
    )
    .join("");
}

/* DATA e HORA da convocação: "06/10/2026" e "08:30" da agenda; sem horário, em branco. */
function dataEHoraDaAgenda(agenda, analiseId) {
  const h = analiseId && agenda?.get ? agenda.get(analiseId) : null;
  if (!h?.data || !h?.inicio) return ["", ""];
  const [a, m, d] = String(h.data).split("-");
  return [`${d}/${m}/${a}`, String(h.inicio).slice(0, 5)];
}

/**
 * O modelo do documento oficial de uma lista registrada.
 *   retrato   o retrato da lista (instantaneoDaLista)
 *   lista     "todas" | "geral" | código da modalidade | "eliminados"
 *   fase      PRELIMINAR | FINAL | null (o padrão da etapa)
 *   regra     a configuração da regra do edital (textos em regra.documento,
 *             notas mínimas)
 *   hoje      a data do "Brasília, <data>." do Word quando o gestor não fixa
 *   agenda    na convocação, Map analise_id → { data, inicio } da agenda das
 *             entrevistas salva (agendaPorCandidato); preenche DATA e HORA
 *   treinamento  edital de treinamento (padrão: o do retrato): o título abre
 *             com "TREINAMENTO — SEM VALOR OFICIAL" e o nome do arquivo também
 */
export function documentoOficial(
  retrato,
  {
    lista = "todas",
    fase = null,
    regra = null,
    hoje = new Date(),
    agenda = null,
    treinamento = ehEditalDeTreinamento(retrato?.edital),
  } = {},
) {
  const r = normalizarRegra(regra);
  const doc = documentoDaRegra(r);
  const f = faseDaPublicacao(retrato.tipo, fase);
  const listaEfetiva =
    retrato.tipo === "CONVOCACAO" && lista === "eliminados" ? "todas" : lista;
  const chave = chaveDoModelo(retrato.tipo, f, listaEfetiva);
  const textos = textosDoModelo(doc, chave);
  const unidade = unidadeDoEdital(retrato.edital?.unidade, doc.unidade);
  const edital = doc.edital || numeroDoEdital(retrato.edital?.edital);
  const faseTexto =
    f === "FINAL" ? "Final" : f === "PRELIMINAR" ? "Preliminar" : "";
  const campos = {
    edital,
    unidade: unidade.nome,
    unidade_sigla: unidade.sigla,
    ao: unidade.ao,
    do: unidade.do,
    autoridade: doc.autoridade ? `, ${doc.autoridade}` : "",
    autoridade_entre_virgulas: doc.autoridade ? `, ${doc.autoridade},` : "",
    fase: faseTexto,
    fase_min: faseTexto.toLowerCase(),
    FASE: faseTexto.toUpperCase(),
    publico: publicoDaLista(retrato, listaEfetiva, MODELOS_PADRAO[chave]),
    notas_minimas: textoDasNotasMinimas(r),
    processo: doc.processo,
  };
  const limpar = (t) =>
    preencher(
      // Campo vazio leva junto o espaço antes dele ("Títulos {publico}**").
      String(t).replace(/ \{(\w+)\}/g, (inteiro, nome) =>
        campos[nome] === "" ? "" : inteiro,
      ),
      campos,
    ).replace(/ {2,}/g, " ");
  const titulo = itensDoTexto(textos.titulo).map((i) => limpar(i.texto));
  const preliminares = itensDoTexto(textos.preliminares).map((i) => ({
    ...i,
    texto: limpar(i.texto),
  }));
  const finais = itensDoTexto(textos.finais).map((i) => ({
    ...i,
    texto: limpar(i.texto),
  }));
  // A nota de desempate vai abaixo da tabela de cada vaga com empate resolvido.
  const nota = listaComNotaDeDesempate(retrato.tipo, listaEfetiva)
    ? limpar(notaDeDesempate(doc, r.rodape || retrato.rodape))
    : "";
  const blocos = tabelasDaLista(
    retrato,
    listaEfetiva,
    agenda,
    doc.colunas[chave],
    chave,
  ).map(({ desempate, ...bloco }) => ({
    ...bloco,
    notaDeDesempate: desempate && nota ? nota : "",
  }));
  const desempatePorVaga = blocos.some((b) => b.notaDeDesempate);
  // O rodapé da regra (ex.: os critérios de desempate) vale para o resultado
  // final — menos a frase do desempate quando ela já está abaixo das vagas.
  if (
    retrato.rodape &&
    !(desempatePorVaga && FALA_DO_DESEMPATE.test(retrato.rodape)) &&
    retrato.tipo === "FINAL" &&
    listaEfetiva !== "eliminados" &&
    !finais.some((i) => semMarcas(i.texto) === retrato.rodape)
  )
    finais.push({ nivel: 2, texto: retrato.rodape });
  const local = doc.local || LOCAL_PADRAO;
  const tituloPrincipal = semMarcas(
    titulo.find((t) => !/^comunicado externo$/i.test(semMarcas(t))) ||
      titulo[0] ||
      "",
  );
  const nomeDoArquivo = `${emTitulo(tituloPrincipal)} - ${nomeDaListaNoDocumento(retrato, listaEfetiva)}`;
  return {
    chave,
    tipo: retrato.tipo,
    lista: listaEfetiva,
    fase: f,
    titulo: treinamento
      ? [`**${MARCA_SEM_VALOR_OFICIAL}**`, ...titulo]
      : titulo,
    localData: doc.data
      ? `${local}, ${dataPorExtenso(doc.data)}.`
      : `${local}, na data da assinatura digital.`,
    localDataPorExtenso: `${local}, ${dataPorExtenso(doc.data || hoje)}.`,
    preliminares,
    blocos,
    finais,
    nome: treinamento ? `TREINAMENTO - ${nomeDoArquivo}` : nomeDoArquivo,
    treinamento: Boolean(treinamento),
    edital,
    processo: doc.processo,
  };
}

/* ── HTML para o SEI ─────────────────────────────────────────────────── */

const escapar = (valor) =>
  String(valor ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

/** "a **b**" → "a <strong>b</strong>" (o texto escapado antes). */
export function htmlDoTrecho(valor) {
  return trechos(valor)
    .map((t) =>
      t.negrito ? `<strong>${escapar(t.texto)}</strong>` : escapar(t.texto),
    )
    .join("");
}

const BORDA = "border:1px solid #000000";
const CLASSE_DO_ALINHAMENTO = {
  esquerda: "Tabela_Texto_Alinhado_Esquerda",
  centro: "Tabela_Texto_Centralizado",
};

function tabelaHtml(t) {
  const abre = `<table border="1" cellpadding="3" cellspacing="0" style="border-collapse:collapse;width:100%;${BORDA}"><tbody>`;
  if (!t.linhas.length)
    return `${abre}<tr><td style="${BORDA}"><p class="Tabela_Texto_Centralizado">${escapar(t.vazia)}</p></td></tr></tbody></table>`;
  const cabeca = `<tr>${t.colunas
    .map(
      (c) =>
        `<td style="width:${c.largura}%;${BORDA};background-color:#d9d9d9"><p class="Tabela_Texto_Centralizado"><strong>${escapar(c.rotulo)}</strong></p></td>`,
    )
    .join("")}</tr>`;
  const corpo = t.linhas
    .map(
      (linha) =>
        `<tr>${linha
          .map(
            (valor, i) =>
              `<td style="width:${t.colunas[i].largura}%;${BORDA}"><p class="${CLASSE_DO_ALINHAMENTO[t.colunas[i].alinhamento]}">${escapar(valor) || "&nbsp;"}</p></td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  return `${abre}${cabeca}${corpo}</tbody></table>`;
}

/**
 * O HTML para colar no editor do SEI: classes de estilo do SEI, tabelas com
 * borda; sem timbrado, assinatura e rodapé (o SEI põe).
 */
export function htmlParaSei(doc) {
  const partes = [
    `<p class="Texto_Alinhado_Direita">${escapar(doc.localData)}</p>`,
  ];
  for (const linha of doc.titulo)
    partes.push(
      `<p class="Texto_Centralizado_Maiusculas">${htmlDoTrecho(linha)}</p>`,
    );
  partes.push('<p class="Item_Nivel1">Disposições Preliminares</p>');
  for (const item of doc.preliminares)
    partes.push(
      `<p class="Item_Nivel${item.nivel}">${htmlDoTrecho(item.texto)}</p>`,
    );
  for (const bloco of doc.blocos) {
    partes.push('<p class="Texto_Justificado">&nbsp;</p>');
    if (bloco.cabecalho)
      partes.push(
        `<p class="Texto_Centralizado"><strong>${escapar(bloco.cabecalho)}</strong></p>`,
      );
    for (const t of bloco.tabelas) {
      if (t.titulo)
        partes.push(
          `<p class="Texto_Centralizado"><strong>${escapar(t.titulo)}</strong></p>`,
        );
      partes.push(tabelaHtml(t));
      for (const n of t.notas || [])
        partes.push(`<p class="Texto_Alinhado_Esquerda">${escapar(n)}</p>`);
    }
    if (bloco.notaDeDesempate)
      partes.push(
        `<p class="Texto_Alinhado_Esquerda"><span style="font-size:10pt"><em>${htmlDoTrecho(bloco.notaDeDesempate)}</em></span></p>`,
      );
  }
  partes.push('<p class="Texto_Justificado">&nbsp;</p>');
  partes.push('<p class="Item_Nivel1">Disposições Finais</p>');
  for (const item of doc.finais)
    partes.push(
      `<p class="Item_Nivel${item.nivel}">${htmlDoTrecho(item.texto)}</p>`,
    );
  return partes.join("\n");
}

/** Os números dos itens (1., 1.1., 1.3.1.…) na ordem do documento. */
export function numeracao(itens, secao) {
  const contadores = [secao, 0, 0, 0];
  return itens.map((item) => {
    const nivel = Math.min(4, Math.max(2, item.nivel));
    contadores[nivel - 1] += 1;
    for (let i = nivel; i < 4; i += 1) contadores[i] = 0;
    return `${contadores.slice(0, nivel).join(".")}.`;
  });
}

/** O documento em texto puro (numerado; tabelas separadas por tabulação). */
export function textoParaSei(doc) {
  const saida = [doc.localData, "", ...doc.titulo.map(semMarcas), ""];
  const secao = (n, rotulo, itens) => {
    saida.push(`${n}. ${rotulo}`);
    const numeros = numeracao(itens, n);
    itens.forEach((item, i) =>
      saida.push(`${numeros[i]} ${semMarcas(item.texto)}`),
    );
    saida.push("");
  };
  secao(1, "DISPOSIÇÕES PRELIMINARES", doc.preliminares);
  for (const bloco of doc.blocos) {
    if (bloco.cabecalho) saida.push(bloco.cabecalho);
    for (const t of bloco.tabelas) {
      if (t.titulo) saida.push(t.titulo);
      if (!t.linhas.length) saida.push(t.vazia);
      else {
        saida.push(t.colunas.map((c) => c.rotulo).join("\t"));
        for (const l of t.linhas) saida.push(l.join("\t"));
      }
      for (const n of t.notas || []) saida.push(n);
    }
    if (bloco.notaDeDesempate) saida.push(semMarcas(bloco.notaDeDesempate));
    saida.push("");
  }
  secao(2, "DISPOSIÇÕES FINAIS", doc.finais);
  return saida.join("\n").trim();
}

/* ── A prévia ("Como fica no SEI") e a impressão ─────────────────────── */

/*
  As classes do SEI imitadas: Item_Nivel1 numera, põe em caixa alta, negrito e
  fundo cinza; os níveis seguintes numeram "1.1.", "1.3.1."… com o mesmo recuo.
*/
const ESTILO_DO_SEI = `
  @page { size: A4; margin: 15mm 18mm 18mm 25mm; }
  body { margin: 0; background: #fff; color: #000; font-family: Calibri, Carlito, "Segoe UI", Arial, sans-serif; font-size: 12pt; }
  .folha { max-width: 170mm; margin: 0 auto; padding: 8mm 4mm; counter-reset: item-n1; }
  .timbrado { text-align: center; font-size: 8pt; line-height: 1.35; margin-bottom: 8pt; }
  .timbrado img { width: 22mm; height: auto; display: block; margin: 0 auto 6pt; }
  .timbrado p { margin: 0; }
  p { margin: 6pt 0; }
  p.Texto_Alinhado_Direita { text-align: right; }
  p.Texto_Centralizado, p.Texto_Centralizado_Maiusculas { text-align: center; }
  p.Texto_Centralizado_Maiusculas { text-transform: uppercase; font-size: 13pt; }
  p.Texto_Justificado { text-align: justify; }
  p.Item_Nivel1 { counter-increment: item-n1; counter-reset: item-n2; text-transform: uppercase; font-weight: bold; background: #e6e6e6; text-align: justify; margin-top: 12pt; }
  p.Item_Nivel1::before { content: counter(item-n1) "."; display: inline-block; width: 25mm; font-weight: normal; }
  p.Item_Nivel2 { counter-increment: item-n2; counter-reset: item-n3; text-align: justify; }
  p.Item_Nivel2::before { content: counter(item-n1) "." counter(item-n2) "."; display: inline-block; width: 25mm; }
  p.Item_Nivel3 { counter-increment: item-n3; counter-reset: item-n4; text-align: justify; }
  p.Item_Nivel3::before { content: counter(item-n1) "." counter(item-n2) "." counter(item-n3) "."; display: inline-block; width: 25mm; }
  p.Item_Nivel4 { counter-increment: item-n4; text-align: justify; }
  p.Item_Nivel4::before { content: counter(item-n1) "." counter(item-n2) "." counter(item-n3) "." counter(item-n4) "."; display: inline-block; width: 25mm; }
  table { page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  table p { margin: 0; font-size: 10pt; }
  p.Tabela_Texto_Centralizado { text-align: center; }
  p.Tabela_Texto_Alinhado_Esquerda { text-align: left; }
  p.Texto_Justificado_Recuo_Primeira_Linha { text-align: justify; text-indent: 25mm; }
  p.Texto_Alinhado_Esquerda { text-align: left; }
  .quebra-de-pagina { break-before: page; page-break-before: always; border-top: 1px dashed #999; margin-top: 18pt; padding-top: 12pt; }
  @media print { .quebra-de-pagina { border-top: 0; margin-top: 0; padding-top: 0; } }
  .posto-pelo-sei { margin-top: 18pt; padding-top: 6pt; border-top: 1px dashed #999; color: #666; font-size: 8pt; text-align: center; }
`;

/**
 * Uma página no modelo do SEI, para qualquer documento: o timbrado (logo e
 * cabeçalho da agência), o HTML do SEI (`corpoHtml`) e, se vier, o aviso do
 * que o SEI acrescenta. Vai num iframe sem script (a prévia) ou na impressão
 * (PDF). A carta de convocação também a usa (carta-de-convocacao-documento.js).
 */
export function paginaNoModeloDoSei(
  { nome, corpoHtml, aviso = "" },
  { cabecalho = CABECALHO_PADRAO, logo = "" } = {},
) {
  const linhasDoCabecalho = String(cabecalho || CABECALHO_PADRAO)
    .split(/\r?\n/)
    .map(texto)
    .filter(Boolean);
  const imagem = /^(https?:\/\/|\/)[^"'<>\s]*$/.test(logo)
    ? `<img src="${escapar(logo)}" alt="AgSUS">`
    : "";
  return (
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapar(nome)}</title><style>${ESTILO_DO_SEI}</style></head>` +
    `<body><div class="folha"><div class="timbrado">${imagem}${linhasDoCabecalho.map((l) => `<p>${escapar(l)}</p>`).join("")}</div>` +
    `${corpoHtml}` +
    (aviso ? `<p class="posto-pelo-sei">${escapar(aviso)}</p>` : "") +
    "</div></body></html>"
  );
}

/**
 * A página "Como fica no SEI" da lista: o HTML do SEI e o aviso do que o SEI
 * acrescenta (assinatura e rodapé).
 */
export function paginaDaPrevia(doc, marca = {}) {
  return paginaNoModeloDoSei(
    {
      nome: doc.nome,
      corpoHtml: htmlParaSei(doc),
      aviso: `Assinatura eletrônica e rodapé "${doc.nome} (nº SEI) SEI ${doc.processo || "<processo>"} / pg. N": postos pelo SEI.`,
    },
    marca,
  );
}
