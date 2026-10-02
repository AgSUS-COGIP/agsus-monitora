/*
  A ponte entre a Classificação e a configuração de convocação do edital
  (Lista de aprovados › Convocação: TB_CONVOCACAO_EDITAL, TB_VAGA_IMEDIATA e o
  modelo de regras de cotas TB_MODELO_CONVOCACAO / TB_CATEGORIA_CONVOCACAO).

  UMA CONTA SÓ PARA AS VAGAS POR MODALIDADE

  As duas telas precisam da mesma coisa: quantas vagas imediatas de cada
  modalidade uma vaga tem. A convocação já calcula isso a partir do modelo do
  edital (percentual, arredondamento "0,5 sobe" ou "sempre para cima", teto,
  mínimo de vagas por reserva), em `derivarQuadro`
  (src/lib/lista-convocacao-rules.js). A Classificação passa a usar a MESMA
  função — nunca uma segunda conta parecida:

    1. quadro de vagas do edital com as vagas por modalidade explícitas
       (TB_QUADRO_VAGA_EDITAL) — é o que o edital publicou;
    2. senão, a configuração de convocação do edital, quando existir: o quadro
       manual da vaga ou o derivado do total de vagas imediatas pelo modelo
       (`configuracaoDaVaga`, a mesma precedência da Lista de aprovados);
    3. senão, `derivarQuadro` com um modelo montado a partir das modalidades da
       regra de classificação (`modeloDaRegra`).

  O que fica de cada lado: a regra de classificação continua dona do que é da
  classificação (quem fica na lista de cada modalidade, o remanejamento da vaga
  reservada sem candidato e o acúmulo de cotas no resultado final); a ordem de
  CHAMADA para contratação (intercalar AC/PP, série do MGI, posições fixas)
  continua da Lista de aprovados. Quando os percentuais da regra e os do
  modelo de convocação divergem, a Classificação avisa (a decisão é do gestor;
  nada é corrigido em silêncio).
*/
import {
  configuracaoDaVaga,
  lerConfiguracoesDoBanco,
  lerModelosDoBanco,
} from "../configuracao-de-convocacao.js";
import { derivarQuadro } from "../lista-convocacao-rules.js";
import { normalizarModelo } from "../modelo-de-convocacao.js";
import { codigosDaModalidade } from "./catalogo.js";
import { normalizarRegra } from "./regra.js";

const ARREDONDAMENTO_DA_REGRA = Object.freeze({
  PARA_CIMA: "sempre_acima",
  MEIO_PARA_CIMA: "meio_acima",
});
const ACUMULO_DA_REGRA = Object.freeze({
  MAIOR_PERCENTUAL: "maior_percentual",
  PCD_MAIS_UMA: "acumula_com_acumulavel",
  TODAS: "todas",
});

/* O código de modalidade da classificação (AC, PCD, PP, PI, PQ…) de uma categoria do modelo. */
export function codigoDaCategoria(categoria) {
  if (categoria?.ampla) return "AC";
  const id = String(categoria?.id || "").replace(/_/g, " ");
  const achados = codigosDaModalidade(
    `${categoria?.rotulo || ""} ${categoria?.sigla || ""} ${id}`,
  ).filter((c) => c !== "AC");
  if (achados.length) return achados[0];
  const sigla = String(categoria?.sigla || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return /^[A-Z]{2,8}$/.test(sigla) ? sigla : null;
}

/*
  O modelo de convocação equivalente às modalidades da regra (para
  `derivarQuadro`). "Fração para baixo" não existe no modelo de convocação:
  devolve null e quem chama usa a conta própria (só esse caso).
*/
export function modeloDaRegra(regraBruta) {
  const regra = normalizarRegra(regraBruta);
  const reservas = regra.modalidades.filter(
    (m) => m.codigo !== "AC" && m.percentual,
  );
  if (reservas.some((m) => !ARREDONDAMENTO_DA_REGRA[m.arredondamento]))
    return null;
  return normalizarModelo({
    nome: "Regra de classificação",
    distribuicao: "proporcional",
    cotaMultipla: ACUMULO_DA_REGRA[regra.cotas.acumulo] || "maior_percentual",
    categorias: [
      { id: "ac", rotulo: "Ampla concorrência", sigla: "AC", ampla: true },
      ...reservas.map((m) => ({
        id: m.codigo.toLowerCase(),
        rotulo: m.nome,
        sigla: m.codigo,
        percentual: m.percentual,
        arredondamento: ARREDONDAMENTO_DA_REGRA[m.arredondamento],
        acumulavel: m.codigo === "PCD",
        minimo: regra.cotas.minimo_vagas_reserva,
        cascata: m.remanejar_para
          .filter((c) => c !== "AC")
          .map((c) => c.toLowerCase()),
      })),
    ],
  });
}

/* `{ AC: 2, PP: 1 }` a partir do quadro por categoria do modelo. */
export function vagasPorCodigo(quadro, modelo, codigoDe = codigoDaCategoria) {
  const saida = {};
  for (const categoria of modelo?.categorias || []) {
    const codigo = codigoDe(categoria);
    if (!codigo) continue;
    const n = Math.max(0, Math.trunc(Number(quadro?.[categoria.id]) || 0));
    saida[codigo] = (saida[codigo] || 0) + n;
  }
  if (saida.AC === undefined) saida.AC = 0;
  return saida;
}

/* As vagas por modalidade de `total` vagas imediatas pela conta da convocação. */
export function vagasPelaConta(total, modelo) {
  // O modelo montado da regra guarda o código da modalidade na sigla (PPIQ, TRANS…).
  return vagasPorCodigo(derivarQuadro(total, modelo), modelo, (c) =>
    c.ampla ? "AC" : c.sigla,
  );
}

/*
  A configuração de convocação de UM edital, a partir das linhas cruas de
  `listar_configuracao_convocacao` e `listar_modelos_convocacao`. Sem
  configuração para o edital → null (a Classificação segue com a regra).
*/
export function convocacaoDoEdital({ configuracoes, modelos } = {}, editalId) {
  if (!editalId) return null;
  const configs = lerConfiguracoesDoBanco(configuracoes);
  const config = configs.get(String(editalId));
  if (!config) return null;
  const porId = lerModelosDoBanco(modelos);
  const modelo = porId.get(config.modeloId) || null;
  return {
    editalId: String(editalId),
    modeloId: config.modeloId,
    modeloNome: modelo?.nome || "",
    modelo,
    configs,
    modelos: porId,
  };
}

/*
  As vagas por modalidade de uma vaga pela configuração de convocação
  (`configuracaoDaVaga`: quadro manual > total da vaga > padrão do edital), ou
  null quando a configuração não fala desta vaga e não tem padrão.
*/
export function vagasDaConvocacao(convocacao, codigoVaga) {
  if (!convocacao) return null;
  const config = convocacao.configs.get(convocacao.editalId);
  const codigo = String(codigoVaga ?? "").trim();
  if (!config || (!config.vagas.has(codigo) && !config.padraoImediata))
    return null;
  const { quadro, modelo } = configuracaoDaVaga(
    convocacao.configs,
    convocacao.modelos,
    convocacao.editalId,
    codigo,
  );
  const vagas = vagasPorCodigo(quadro, modelo);
  const total = Object.values(vagas).reduce((s, n) => s + n, 0);
  return { total, porModalidade: vagas };
}

/*
  Onde a regra de classificação e o modelo de convocação do edital dizem
  coisas diferentes sobre as cotas (percentual, arredondamento, mínimo,
  remanejamento). Lista de frases; vazia = coerentes.
*/
export function divergenciasDasCotas(regraBruta, convocacao) {
  const modelo = convocacao?.modelo;
  if (!modelo) return [];
  const regra = normalizarRegra(regraBruta);
  const frases = [];
  const daRegra = new Map(
    regra.modalidades
      .filter((m) => m.codigo !== "AC")
      .map((m) => [m.codigo, m]),
  );
  const doModelo = new Map();
  for (const c of modelo.categorias) {
    const codigo = codigoDaCategoria(c);
    if (codigo && codigo !== "AC") doModelo.set(codigo, c);
  }
  const nome = convocacao.modeloNome || "modelo de convocação";
  for (const [codigo, c] of doModelo) {
    const m = daRegra.get(codigo);
    if (!m) {
      if (c.percentual)
        frases.push(
          `${codigo}: ${c.percentual}% no ${nome}, ausente na regra de classificação.`,
        );
      continue;
    }
    if ((m.percentual ?? 0) !== c.percentual)
      frases.push(
        `${codigo}: ${m.percentual ?? 0}% na regra × ${c.percentual}% no ${nome}.`,
      );
    if (ARREDONDAMENTO_DA_REGRA[m.arredondamento] !== c.arredondamento)
      frases.push(`${codigo}: arredondamento diferente da convocação.`);
    const minimo = regra.cotas.minimo_vagas_reserva;
    if (c.minimo !== minimo)
      frases.push(
        `${codigo}: mínimo de ${minimo} vaga(s) na regra × ${c.minimo} no ${nome}.`,
      );
  }
  for (const [codigo, m] of daRegra)
    if (!doModelo.has(codigo) && m.percentual)
      frases.push(`${codigo}: ${m.percentual}% na regra, ausente no ${nome}.`);
  return frases;
}
