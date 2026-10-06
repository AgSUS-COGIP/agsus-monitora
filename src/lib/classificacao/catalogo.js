/*
  Catálogo da classificação: os critérios de desempate que o gestor do edital
  pode escolher (e ordenar), os motivos padronizados de eliminação, os métodos
  do empate final e as modalidades de concorrência conhecidas.

  NADA AQUI É REGRA FIXA. A regra de cada edital (src/lib/classificacao/regra.js,
  gravada em TH_REGRA_CLASSIFICACAO) escolhe do catálogo e decide a ordem. O
  catálogo é o mesmo do banco (TB_CRITERIO_CLASSIFICACAO, seed da migration
  20261002150000_classificacao.sql); o teste `classificacao-migration.test.js`
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
    /*
      Critérios que apareceram nos editais lidos em 02/10/2026 e não estavam no
      catálogo. O valor vem de campos que a análise ainda não grava: até lá, o
      critério fica "sem dado" (atrás de quem tem) e a tela avisa.
    */
    {
      codigo: "EXP_ALTA_COMPLEXIDADE",
      nome: "Maior tempo de experiência em média e alta complexidade",
      rotuloCurto: "exp. alta complexidade",
      tipo: "numero",
      direcao: "MAIOR_PRIMEIRO",
      origem: "experiencia_alta_complexidade_total (53/2025, 9.4.3)",
      ler: (c) => c.expAltaComplexidade,
      falta: () => "tempo de experiência em média e alta complexidade",
    },
    {
      codigo: "EXP_SAUDE_DIGITAL",
      nome: "Maior tempo de experiência profissional em saúde digital",
      rotuloCurto: "exp. saúde digital",
      tipo: "numero",
      direcao: "MAIOR_PRIMEIRO",
      origem: "experiencia_saude_digital_total (05/2026)",
      ler: (c) => c.expSaudeDigital,
      falta: () => "tempo de experiência em saúde digital",
    },
    {
      codigo: "MAIOR_ESCOLARIDADE",
      nome: "Maior nível de escolaridade relacionado ao cargo",
      rotuloCurto: "escolaridade",
      tipo: "numero",
      direcao: "MAIOR_PRIMEIRO",
      origem: "nivel_escolaridade (1 fundamental … 6 doutorado; 23/2025)",
      ler: (c) => c.nivelEscolaridade,
      falta: () => "nível de escolaridade",
    },
    {
      codigo: "NOTA_CONHECIMENTOS_ESPECIFICOS",
      nome: "Maior nota em conhecimentos específicos (prova)",
      rotuloCurto: "conhecimentos específicos",
      tipo: "numero",
      direcao: "MAIOR_PRIMEIRO",
      origem:
        "nota_conhecimentos_especificos (prova objetiva; 96/2025, 97/2025, 04/2026)",
      ler: (c) => c.notaConhecimentosEspecificos,
      falta: () => "nota de conhecimentos específicos",
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

/*
  As listas, na ordem das publicações da AgSUS: resultado da avaliação
  documental e de títulos (classificados por vaga e por modalidade, e os
  eliminados com o motivo), convocação para entrevista (até o limite da regra,
  com os empatados no limite), resultado da etapa de entrevista (os aptos com a
  nota da entrevista) e resultado final (documental + entrevista, desempate,
  vagas imediatas e cadastro reserva). Preliminar × final de cada etapa é a
  mesma lista gerada antes e depois dos recursos (a exportação escolhe o título).
*/
export const TIPOS_DE_LISTA = Object.freeze([
  ["PRELIMINAR", "Avaliação documental"],
  ["CONVOCACAO", "Convocação para entrevista"],
  ["ENTREVISTA", "Resultado da entrevista"],
  ["FINAL", "Resultado final"],
]);

/*
  As listas que vêm da pré-classificação da Avaliação documental (fase F2;
  registradas por registrar_lista_pre_classificacao, não pelo motor). Ficam
  fora de TIPOS_DE_LISTA para a tela da Classificação não oferecê-las.
*/
export const TIPOS_DE_LISTA_DA_PRE_CLASSIFICACAO = Object.freeze([
  ["PROVISORIA", "Lista provisória por ART"],
  ["LOTE", "Lote de convocação"],
]);

/* Fase da publicação de uma lista (título do documento). */
export const FASES_DA_PUBLICACAO = Object.freeze([
  ["PRELIMINAR", "Preliminar"],
  ["FINAL", "Final"],
]);

/*
  As parciais da avaliação documental que a lista publica (colunas), na ordem
  das publicações. Cada edital escolhe as suas na regra (o 100/2026 não tem
  cursos de aperfeiçoamento).
*/
export const PARCIAIS_DA_DOCUMENTAL = Object.freeze([
  ["FORMACAO", "Formação Acadêmica"],
  ["CURSOS", "Cursos de Aperfeiçoamento"],
  ["EXPERIENCIA", "Experiência Profissional"],
  ["ETNICO", "Pontuação Étnica"],
]);

export const COMPONENTES_DA_NOTA = Object.freeze([
  ["DOCUMENTAL", "Nota documental (curricular)"],
  ["ENTREVISTA", "Nota da entrevista"],
  ["ART", "Nota da autodeclaração (ART)"],
]);

/*
  Os componentes da nota que um recurso deferido pode ajustar
  (TB_ITEM_AJUSTE_PONTUACAO."CO_ITEM", migration 20261005130000): as parciais
  da documental, a nota documental, a da entrevista (e cada competência,
  `COMPETENCIA_n`) e a ART. `campo` é o do candidato no motor; o valor novo do
  ajuste aprovado SUBSTITUI o da análise na classificação (a planilha não muda).
*/
export const ITENS_DO_AJUSTE = Object.freeze(
  [
    {
      codigo: "FORMACAO",
      parcial: "FORMACAO",
      rotulo: "Formação acadêmica",
      campo: "pontuacaoFormacao",
    },
    {
      codigo: "CURSOS",
      parcial: "CURSOS",
      rotulo: "Cursos de aperfeiçoamento",
      campo: "pontuacaoCursos",
    },
    {
      codigo: "EXPERIENCIA",
      parcial: "EXPERIENCIA",
      rotulo: "Experiência profissional",
      campo: "pontuacaoExperiencia",
    },
    {
      codigo: "ETNICO",
      parcial: "ETNICO",
      rotulo: "Pertencimento étnico",
      campo: "pontuacaoEtnica",
    },
    {
      codigo: "DOCUMENTAL",
      rotulo: "Nota documental",
      campo: "notaDocumental",
    },
    {
      codigo: "ENTREVISTA",
      rotulo: "Nota da entrevista",
      campo: "notaEntrevista",
    },
    { codigo: "ART", rotulo: "Nota da ART", campo: "notaArt" },
  ].map((item) => Object.freeze(item)),
);

export const ITEM_DO_AJUSTE_POR_CODIGO = Object.freeze(
  Object.fromEntries(ITENS_DO_AJUSTE.map((i) => [i.codigo, i])),
);

/** "COMPETENCIA_3" → 3; outro código → null. */
export function ordemDaCompetencia(codigo) {
  const m = /^COMPETENCIA_(\d{1,2})$/.exec(String(codigo || ""));
  return m ? Number(m[1]) : null;
}

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
  SEM_PARECER_ENTREVISTA: "Entrevista sem parecer de apto",
});

/* As modalidades conhecidas. A regra de cada edital diz quais valem e como. */
export const MODALIDADES_CONHECIDAS = Object.freeze([
  ["AC", "Ampla concorrência"],
  ["PCD", "Pessoas com deficiência"],
  ["PP", "Pretos e pardos"],
  ["PI", "Indígenas"],
  ["PQ", "Quilombolas"],
  ["TRANS", "Pessoas trans"],
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
  if (/\btrans\b|transgener|travesti/.test(t)) codigos.push("TRANS");
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
