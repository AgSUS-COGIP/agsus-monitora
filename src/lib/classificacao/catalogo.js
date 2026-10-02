/*
  Catálogo da classificação: os critérios de desempate que o gestor do edital
  pode escolher (e ordenar), os motivos padronizados de eliminação, os métodos
  do empate final e as modalidades de concorrência conhecidas.

  NADA AQUI É REGRA FIXA. A regra de cada edital (src/lib/classificacao/regra.js,
  gravada em TH_REGRA_CLASSIFICACAO) escolhe do catálogo e decide a ordem. O
  catálogo é o mesmo do banco (TB_CRITERIO_CLASSIFICACAO, seed da migration
  20261002120000_classificacao.sql); o teste `classificacao-migration.test.js`
  confere que os dois são iguais.

  Cada critério sabe ler o próprio valor do candidato (`ler`), já com a data de
  corte da idade, e diz qual dado falta quando não consegue (`falta`).
*/
import { diasDeVida, idadeNaData, numeroBR } from "./numeros.js";

export const DIRECOES = Object.freeze([
  ["SIM_PRIMEIRO", "Sim antes de não"],
  ["NAO_PRIMEIRO", "Não antes de sim"],
  ["MAIOR_PRIMEIRO", "Maior primeiro"],
  ["MENOR_PRIMEIRO", "Menor primeiro"],
]);

const sim = (valor) => (valor === null ? null : Boolean(valor));
const positivo = (valor) => (valor === null ? null : valor > 0);

/*
  `tipo`: booleano (sim/não) ou numero. `direcao`: a padrão (a do edital
  83/2026 e 100/2026, item 10.4). `rotuloCurto` aparece na explicação.
*/
export const CATALOGO_DE_CRITERIOS = Object.freeze(
  [
    {
      codigo: "IDOSO_60",
      nome: "60 anos ou mais na data de corte",
      rotuloCurto: "60+",
      tipo: "booleano",
      direcao: "SIM_PRIMEIRO",
      origem: "data_nascimento + data de corte (fim das inscrições)",
      ler: (c, ctx) => {
        const idade = idadeNaData(c.dataNascimento, ctx.dataCorte);
        return idade === null ? null : idade >= 60;
      },
      falta: (c, ctx) =>
        !ctx.dataCorte
          ? "data de corte (fim das inscrições)"
          : "data de nascimento",
    },
    {
      codigo: "INDIGENA_COMPROVADO",
      nome: "Ser comprovadamente indígena",
      rotuloCurto: "indígena comprovado",
      tipo: "booleano",
      direcao: "SIM_PRIMEIRO",
      origem: "pontuacao_criterio_etnico > 0 (validada na análise)",
      ler: (c) => positivo(c.pontuacaoEtnica),
      falta: () => "pontuação étnica",
    },
    {
      codigo: "EXP_SAUDE_INDIGENA",
      nome: "Maior tempo de experiência na saúde indígena",
      rotuloCurto: "exp. saúde indígena",
      tipo: "numero",
      direcao: "MAIOR_PRIMEIRO",
      origem: "experiencia_saude_indigena_total",
      ler: (c) => c.expSaudeIndigena,
      falta: () => "tempo de experiência na saúde indígena",
    },
    {
      codigo: "EXP_ATENCAO_BASICA",
      nome: "Maior tempo de experiência na atenção básica",
      rotuloCurto: "exp. atenção básica",
      tipo: "numero",
      direcao: "MAIOR_PRIMEIRO",
      origem: "experiencia_atencao_basica_total",
      ler: (c) => c.expAtencaoBasica,
      falta: () => "tempo de experiência na atenção básica",
    },
    {
      codigo: "NOTA_DOCUMENTAL",
      nome: "Maior pontuação na avaliação documental (curricular)",
      rotuloCurto: "nota documental",
      tipo: "numero",
      direcao: "MAIOR_PRIMEIRO",
      origem: "nota_final_ajustada",
      ler: (c) => c.notaDocumental,
      falta: () => "nota documental",
    },
    {
      codigo: "NOTA_ENTREVISTA",
      nome: "Maior pontuação na entrevista",
      rotuloCurto: "nota da entrevista",
      tipo: "numero",
      direcao: "MAIOR_PRIMEIRO",
      origem: "TB_ENTREVISTA.VL_NOTA_TOTAL",
      ler: (c) => c.notaEntrevista,
      falta: () => "nota da entrevista",
    },
    {
      codigo: "MAIOR_IDADE",
      nome: "Maior idade",
      rotuloCurto: "idade",
      tipo: "numero",
      direcao: "MAIOR_PRIMEIRO",
      origem: "data_nascimento (dias de vida na data de corte)",
      ler: (c, ctx) => diasDeVida(c.dataNascimento, ctx.dataCorte),
      falta: (c, ctx) =>
        !ctx.dataCorte
          ? "data de corte (fim das inscrições)"
          : "data de nascimento",
    },
    {
      codigo: "PONTUACAO_ETNICA",
      nome: "Maior pontuação no critério étnico",
      rotuloCurto: "pontuação étnica",
      tipo: "numero",
      direcao: "MAIOR_PRIMEIRO",
      origem: "pontuacao_criterio_etnico",
      ler: (c) => c.pontuacaoEtnica,
      falta: () => "pontuação étnica",
    },
    {
      codigo: "PONTUACAO_EXPERIENCIA",
      nome: "Maior pontuação de experiência profissional",
      rotuloCurto: "pontuação de experiência",
      tipo: "numero",
      direcao: "MAIOR_PRIMEIRO",
      origem: "pontuacao_experiencia_profissional",
      ler: (c) => c.pontuacaoExperiencia,
      falta: () => "pontuação de experiência",
    },
    {
      codigo: "PONTUACAO_FORMACAO",
      nome: "Maior pontuação de formação acadêmica",
      rotuloCurto: "pontuação de formação",
      tipo: "numero",
      direcao: "MAIOR_PRIMEIRO",
      origem: "pontuacao_escolaridade",
      ler: (c) => c.pontuacaoFormacao,
      falta: () => "pontuação de formação",
    },
    {
      codigo: "PONTUACAO_CURSOS",
      nome: "Maior pontuação em cursos de aperfeiçoamento",
      rotuloCurto: "pontuação de cursos",
      tipo: "numero",
      direcao: "MAIOR_PRIMEIRO",
      origem: "pontuacao_cursos_aperfeicoamento",
      ler: (c) => c.pontuacaoCursos,
      falta: () => "pontuação de cursos",
    },
    {
      codigo: "EXP_PROFISSIONAL_TEMPO",
      nome: "Maior tempo de experiência profissional",
      rotuloCurto: "tempo de experiência",
      tipo: "numero",
      direcao: "MAIOR_PRIMEIRO",
      origem: "experiencia_profissional_total",
      ler: (c) => c.expProfissional,
      falta: () => "tempo de experiência profissional",
    },
    {
      codigo: "PCD",
      nome: "Ser pessoa com deficiência",
      rotuloCurto: "PcD",
      tipo: "booleano",
      direcao: "SIM_PRIMEIRO",
      origem: "pcd",
      ler: (c) => sim(c.pcd),
      falta: () => "PcD",
    },
  ].map((criterio) => Object.freeze(criterio)),
);

export const CRITERIO_POR_CODIGO = Object.freeze(
  Object.fromEntries(CATALOGO_DE_CRITERIOS.map((c) => [c.codigo, c])),
);

/* O empate que sobra depois de todos os critérios: o gestor escolhe. */
export const METODOS_DE_EMPATE_FINAL = Object.freeze([
  ["SORTEIO", "Sorteio registrado"],
  ["ORDEM_INSCRICAO", "Ordem de inscrição"],
  ["MESMA_POSICAO", "Mesma posição"],
  ["DECISAO_MANUAL", "Decisão manual com justificativa"],
]);

/* Numeração de quem fica na mesma posição: 1º, 2º, 2º, 3º ou 1º, 2º, 2º, 4º. */
export const NUMERACOES = Object.freeze([
  ["DENSA", "1º, 2º, 2º, 3º"],
  ["SALTANDO", "1º, 2º, 2º, 4º"],
]);

/* O que fazer com o empate em cada lista: critérios da regra ou mesma posição. */
export const EMPATE_NAS_LISTAS = Object.freeze([
  ["CRITERIOS", "Critérios da regra"],
  ["MESMA_POSICAO", "Mesma posição"],
]);

export const TIPOS_DE_LISTA = Object.freeze([
  ["PRELIMINAR", "Preliminar (documental)"],
  ["CONVOCACAO", "Convocação para entrevista"],
  ["FINAL", "Resultado final"],
]);

export const COMPONENTES_DA_NOTA = Object.freeze([
  ["DOCUMENTAL", "Nota documental (curricular)"],
  ["ENTREVISTA", "Nota da entrevista"],
  ["ART", "Nota da autodeclaração (ART)"],
]);

export const NIVEIS = Object.freeze([
  ["superior", "Superior"],
  ["tecnico", "Técnico"],
  ["medio", "Médio"],
  ["fundamental", "Fundamental"],
]);

/* Motivos padronizados de eliminação (a tela e a exportação mostram o rótulo). */
export const MOTIVOS_DE_ELIMINACAO = Object.freeze({
  NAO_HABILITADO: "Não habilitado na avaliação documental",
  SEM_NOTA_DOCUMENTAL: "Sem nota da avaliação documental",
  ABAIXO_NOTA_MINIMA_DOCUMENTAL:
    "Abaixo da nota mínima da avaliação documental",
  NAO_CONVOCADO: "Fora do limite de convocação para entrevista",
  SEM_ENTREVISTA: "Sem entrevista lançada",
  AUSENTE: "Ausente na entrevista",
  INAPTO_ENTREVISTA: "Inapto na entrevista",
  SEM_NOTA_ENTREVISTA: "Sem nota da entrevista",
  ABAIXO_NOTA_MINIMA_ENTREVISTA: "Abaixo da nota mínima da entrevista",
  COMPETENCIA_ABAIXO_MINIMO: "Competência da entrevista abaixo do mínimo",
  COMPETENCIA_ELIMINATORIA: "Nota eliminatória em competência da entrevista",
});

/* As modalidades conhecidas. A regra de cada edital diz quais valem e como. */
export const MODALIDADES_CONHECIDAS = Object.freeze([
  ["AC", "Ampla concorrência"],
  ["PCD", "Pessoas com deficiência"],
  ["PP", "Pretos e pardos"],
  ["PI", "Indígenas"],
  ["PQ", "Quilombolas"],
]);

const semAcento = (valor) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/*
  Os códigos de modalidade de um texto ("Ampla concorrência / Pretos e
  pardos", "PcD", "PPIQ - Indígenas", "Quilombola"). Sem nenhum → [].
*/
export function codigosDaModalidade(texto) {
  const t = semAcento(texto);
  if (!t.trim()) return [];
  const codigos = [];
  if (/ampla|\bac\b/.test(t)) codigos.push("AC");
  if (/defici|\bpcd\b|\bpne\b/.test(t)) codigos.push("PCD");
  if (/pret|pard|\bpp\b|negr/.test(t)) codigos.push("PP");
  if (/indigen|\bpi\b/.test(t)) codigos.push("PI");
  if (/quilomb|\bpq\b/.test(t)) codigos.push("PQ");
  return codigos;
}

/* "Sim", "S", "true", "1", "PcD" → true; "Não", "N", "" → false. */
export function simOuNao(valor) {
  if (typeof valor === "boolean") return valor;
  const t = semAcento(valor).trim();
  if (!t) return false;
  return /^(s|sim|true|1|x|pcd|yes)\b/.test(t);
}

export { numeroBR, semAcento };
