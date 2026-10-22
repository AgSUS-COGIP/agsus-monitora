/*
  Fontes oficiais citadas junto das respostas da Aya e a resposta composta do
  DSEI Alagoas e Sergipe. As demais respostas vêm da busca na base
  (src/lib/busca-da-aya.js).
*/

export const AYA_SOURCE_CATALOG = Object.freeze({
  sesai: Object.freeze({
    id: "sesai",
    label: "Ministério da Saúde / SESAI",
    url: "https://www.gov.br/saude/pt-br/composicao/sesai/competencias",
  }),
  dsei: Object.freeze({
    id: "dsei",
    label: "Ministério da Saúde — DSEIs",
    url: "https://www.gov.br/saude/pt-br/composicao/secretaria-de-saude-indigena/distritos-sanitarios-especiais-indigenas",
  }),
  casai: Object.freeze({
    id: "casai",
    label: "Ministério da Saúde — CASAI",
    url: "https://bvsms.saude.gov.br/bvs/saudelegis/sas/2017/prt1317_08_08_2017.html",
  }),
  funai: Object.freeze({
    id: "funai",
    label: "Funai — Terras Indígenas e aldeias",
    url: "https://www.gov.br/funai/pt-br/atuacao/terras-indigenas/geoprocessamento-e-mapas",
  }),
  funaiInstitucional: Object.freeze({
    id: "funai-institucional",
    label: "Funai — Institucional",
    url: "https://www.gov.br/funai/pt-br/acesso-a-informacao/institucional/Institucional",
  }),
  ibge: Object.freeze({
    id: "ibge",
    label: "IBGE — Censo 2022",
    url: "https://educa.ibge.gov.br/criancas/brasil/2848-nosso-povo/22324-os-indigenas-no-censo-2022.html",
  }),
  pdsiAlSe: Object.freeze({
    id: "pdsi-al-se",
    label: "Ministério da Saúde — PDSI Alagoas e Sergipe 2024–2027",
    url: "https://www.gov.br/saude/pt-br/composicao/sesai/planos-distritais-2024-2027/plano-distrital-alagoas-e-sergipe",
  }),
  funaiKaririXoco: Object.freeze({
    id: "funai-kariri-xoco",
    label: "Funai — Kariri-Xocó",
    url: "https://www.gov.br/funai/pt-br/assuntos/noticias/2017/kariri-xoco-desenvolvem-projeto-educacional-para-preservar-historia-e-cultura",
  }),
});

const SOURCE_RULES = Object.freeze([
  [
    /\b(?:dsei\s+(?:de\s+)?alagoas|alagoas\s+e\s+sergipe|dsei\s+al\/?se|al\/?se|kariri[-\s]?xoc[oó])\b/i,
    ["pdsiAlSe", "funaiKaririXoco"],
  ],
  [
    /\b(casai|casa de sa[uú]de ind[ií]gena|casa de apoio [àa] sa[uú]de ind[ií]gena)\b/i,
    ["casai", "sesai"],
  ],
  [
    /\b(dsei|dseis|distrito sanit[aá]rio especial ind[ií]gena|polo base|sesai|sasisus|sa[uú]de ind[ií]gena)\b/i,
    ["dsei", "sesai"],
  ],
  [/\bfunai\b/i, ["funaiInstitucional"]],
  [
    /\b(aldeia|aldeias|terra ind[ií]gena|terras ind[ií]genas|demarca[cç][aã]o)\b/i,
    ["funai"],
  ],
  [
    /\b(censo|ibge|popula[cç][aã]o ind[ií]gena|quantos ind[ií]genas|quantas pessoas ind[ií]genas)\b/i,
    ["ibge"],
  ],
]);

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/*
  "Quantas aldeias tem no DSEI Alagoas e quem são os Kariri-Xocó?" são duas
  perguntas num enunciado só, e um verbete responde uma coisa. Esta resposta
  composta vem antes da busca; sem nenhuma das duas, devolve vazio e a busca
  segue para os verbetes ("DSEI Alagoas e Sergipe", "Povo Kariri-Xocó").
*/
export function curatedAnswerForQuestion(question) {
  const normalized = normalizeText(question);
  if (!normalized) return "";

  const isAlSe =
    /\b(?:dsei\s+(?:de\s+)?alagoas|alagoas\s+e\s+sergipe|dsei\s+al\/?se|al\/?se)\b/i.test(
      normalized,
    );
  const asksVillageCount =
    /\bquant(?:a|as|o|os)\b[\s\S]*\baldeia|\baldeia[\s\S]*\bquant(?:a|as|o|os)\b/i.test(
      normalized,
    );
  const asksKariri = /\bkariri[\s-]?xoco\b/i.test(normalized);

  const parts = [];
  if (isAlSe && asksVillageCount) {
    parts.push(
      "O DSEI Alagoas e Sergipe (AL/SE) registra 30 aldeias atendidas na caracterização oficial com base de 2023 do PDSI 2024–2027.",
    );
  }
  if (asksKariri && (asksVillageCount || parts.length)) {
    parts.push(
      "Sobre o povo Kariri-Xocó: no DSEI AL/SE, a comunidade está em Porto Real do Colégio (AL) e aparece com 1 aldeia e 2.509 pessoas no Painel SIASI de 2023, correspondendo a 18,61% da população do distrito naquele ano. O PDSI descreve a denominação Kariri-Xocó como resultado da fusão histórica entre os Kariri de Porto Real do Colégio e parte dos Xocó da ilha de São Pedro, em Sergipe, e cita o ritual Ouricuri entre suas práticas culturais. A comunidade vive na região ribeirinha do rio São Francisco, onde pesca e agricultura têm importância local.",
    );
  }
  return parts.join("\n\n");
}

export function officialSourcesForQuestion(question) {
  const sourceIds = new Set();
  for (const [pattern, ids] of SOURCE_RULES) {
    if (!pattern.test(String(question || ""))) continue;
    ids.forEach((id) => sourceIds.add(id));
  }
  return Array.from(sourceIds)
    .map((id) => AYA_SOURCE_CATALOG[id])
    .filter(Boolean);
}
