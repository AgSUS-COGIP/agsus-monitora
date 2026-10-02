/*
  A regra de classificação de UM edital, decidida pelo gestor do edital.

  Não há regra fixa no código: tudo o que muda de edital para edital (etapas
  consideradas, composição e arredondamento da nota, notas mínimas, critérios
  de desempate e a ordem deles, o empate final, as modalidades, a convocação
  para entrevista e o rodapé) está aqui, numa configuração versionada no banco
  (TH_REGRA_CLASSIFICACAO: cada alteração cria uma versão; a lista gerada
  guarda a versão usada).

  `normalizarRegra` completa o que faltar com valores neutros (nada elimina,
  nada desempata) — não com os do edital 83 ou 100: a regra "padrão" de um
  edital novo é vazia até o gestor decidir. `validarRegra` devolve os erros
  com as MESMAS regras que o banco confere em
  private."FC_VALIDAR_REGRA_CLASSIFICACAO" (migration 20261002150000).
*/
import {
  COMPONENTES_DA_NOTA,
  CRITERIO_POR_CODIGO,
  DIRECOES,
  EMPATE_NAS_LISTAS,
  METODOS_DE_EMPATE_FINAL,
  NIVEIS,
  NUMERACOES,
  PARCIAIS_DA_DOCUMENTAL,
} from "./catalogo.js";
import { ARREDONDAMENTOS, lerData, numeroBR } from "./numeros.js";

export const VERSAO_DO_ESQUEMA = 1;

export const ACUMULOS = Object.freeze([
  ["MAIOR_PERCENTUAL", "Só na modalidade de maior percentual"],
  ["PCD_MAIS_UMA", "PcD e mais uma"],
  ["TODAS", "Em todas as modalidades"],
]);

export const ARREDONDAMENTOS_DE_COTA = Object.freeze([
  ["PARA_CIMA", "Fração para cima"],
  ["MEIO_PARA_CIMA", "0,5 para cima"],
  ["PARA_BAIXO", "Fração para baixo"],
]);

const MODALIDADE_AMPLA = Object.freeze({
  codigo: "AC",
  nome: "Ampla concorrência",
  percentual: null,
  arredondamento: "MEIO_PARA_CIMA",
  lista_propria: false,
  recomeca_posicao: true,
  aparece_na_geral: true,
  remanejar_para: [],
});

export const REGRA_VAZIA = Object.freeze({
  schema: VERSAO_DO_ESQUEMA,
  data_corte: null,
  etapas: Object.freeze({ documental: true, entrevista: true }),
  documental: Object.freeze({
    situacoes_aptas: Object.freeze(["Aprovado"]),
    nota_minima: null,
    nota_minima_por_nivel: Object.freeze({}),
    niveis_por_cargo: Object.freeze([]),
    nivel_padrao: null,
    parciais: Object.freeze([]),
  }),
  entrevista: Object.freeze({
    nota_minima: null,
    nota_minima_competencia: null,
    nota_eliminatoria_ate: null,
    competencias: Object.freeze([]),
    exige_comparecimento: true,
    inapto_elimina: true,
  }),
  composicao: Object.freeze({
    componentes: Object.freeze([
      Object.freeze({ codigo: "DOCUMENTAL", peso: 1 }),
      Object.freeze({ codigo: "ENTREVISTA", peso: 1 }),
    ]),
    casas: 2,
    arredondamento: "MEIO_PARA_CIMA",
  }),
  desempate: Object.freeze([]),
  listas: Object.freeze({
    PRELIMINAR: Object.freeze({ empate: "MESMA_POSICAO" }),
    ENTREVISTA: Object.freeze({ empate: "MESMA_POSICAO" }),
    FINAL: Object.freeze({ empate: "CRITERIOS" }),
  }),
  empate_final: Object.freeze({ metodo: "MESMA_POSICAO", numeracao: "DENSA" }),
  modalidades: Object.freeze([MODALIDADE_AMPLA]),
  cotas: Object.freeze({ minimo_vagas_reserva: 0, acumulo: "TODAS" }),
  convocacao: Object.freeze({
    multiplo_vagas: null,
    posicao_max_cr: null,
    incluir_empatados: true,
    excecoes: Object.freeze([]),
  }),
  rodape: "",
  importacao: null,
});

const objeto = (valor) =>
  valor && typeof valor === "object" && !Array.isArray(valor) ? valor : {};
const lista = (valor) => (Array.isArray(valor) ? valor : []);
const texto = (valor) => String(valor ?? "").trim();
const numeroOuNulo = (valor) =>
  valor === null || valor === undefined || valor === ""
    ? null
    : numeroBR(valor);
const booleano = (valor, padrao) =>
  typeof valor === "boolean" ? valor : padrao;
const umDe = (valor, opcoes, padrao) =>
  opcoes.some(([v]) => v === valor) ? valor : padrao;
const termos = (valor) =>
  (Array.isArray(valor) ? valor : String(valor ?? "").split(/[,;\n]/))
    .map(texto)
    .filter(Boolean);
const codigos = (valor) =>
  termos(valor)
    .map((c) => c.toUpperCase())
    .filter((c, i, todos) => todos.indexOf(c) === i);

function normalizarModalidade(m) {
  const o = objeto(m);
  const codigo = texto(o.codigo).toUpperCase();
  return {
    codigo,
    nome: texto(o.nome) || codigo,
    percentual: numeroOuNulo(o.percentual),
    arredondamento: umDe(
      o.arredondamento,
      ARREDONDAMENTOS_DE_COTA,
      "MEIO_PARA_CIMA",
    ),
    lista_propria: booleano(o.lista_propria, codigo !== "AC"),
    recomeca_posicao: booleano(o.recomeca_posicao, true),
    aparece_na_geral: booleano(o.aparece_na_geral, true),
    remanejar_para: codigos(o.remanejar_para).filter((c) => c !== codigo),
  };
}

/** A regra completa, com os campos que faltarem neutros (nunca os de outro edital). */
export function normalizarRegra(bruta) {
  const r = objeto(bruta);
  const doc = objeto(r.documental);
  const ent = objeto(r.entrevista);
  const comp = objeto(r.composicao);
  const listas = objeto(r.listas);
  const empate = objeto(r.empate_final);
  const cotas = objeto(r.cotas);
  const conv = objeto(r.convocacao);
  const etapas = objeto(r.etapas);
  const porNivel = objeto(doc.nota_minima_por_nivel);

  const modalidades = lista(r.modalidades)
    .map(normalizarModalidade)
    .filter((m) => m.codigo);
  if (!modalidades.some((m) => m.codigo === "AC"))
    modalidades.unshift({ ...MODALIDADE_AMPLA });

  return {
    schema: VERSAO_DO_ESQUEMA,
    data_corte: lerData(r.data_corte) ? texto(r.data_corte).slice(0, 10) : null,
    etapas: {
      documental: booleano(etapas.documental, true),
      entrevista: booleano(etapas.entrevista, true),
    },
    documental: {
      situacoes_aptas: termos(
        doc.situacoes_aptas ?? REGRA_VAZIA.documental.situacoes_aptas,
      ),
      nota_minima: numeroOuNulo(doc.nota_minima),
      nota_minima_por_nivel: Object.fromEntries(
        NIVEIS.map(([nivel]) => [nivel, numeroOuNulo(porNivel[nivel])]).filter(
          ([, v]) => v !== null,
        ),
      ),
      niveis_por_cargo: lista(doc.niveis_por_cargo)
        .map((n) => ({
          termo: texto(objeto(n).termo),
          nivel: umDe(objeto(n).nivel, NIVEIS, ""),
        }))
        .filter((n) => n.termo && n.nivel),
      nivel_padrao: umDe(doc.nivel_padrao, NIVEIS, null),
      parciais: codigos(doc.parciais).filter((c) =>
        PARCIAIS_DA_DOCUMENTAL.some(([v]) => v === c),
      ),
    },
    entrevista: {
      nota_minima: numeroOuNulo(ent.nota_minima),
      nota_minima_competencia: numeroOuNulo(ent.nota_minima_competencia),
      nota_eliminatoria_ate: numeroOuNulo(ent.nota_eliminatoria_ate),
      competencias: lista(ent.competencias)
        .map((c, i) => ({
          ordem: Math.trunc(numeroOuNulo(objeto(c).ordem) ?? i + 1),
          nome: texto(objeto(c).nome),
          minimo: numeroOuNulo(objeto(c).minimo),
        }))
        .filter((c) => c.ordem > 0),
      exige_comparecimento: booleano(ent.exige_comparecimento, true),
      inapto_elimina: booleano(ent.inapto_elimina, true),
    },
    composicao: {
      componentes: (lista(comp.componentes).length
        ? lista(comp.componentes)
        : REGRA_VAZIA.composicao.componentes
      )
        .map((c) => ({
          codigo: umDe(objeto(c).codigo, COMPONENTES_DA_NOTA, ""),
          peso: numeroOuNulo(objeto(c).peso) ?? 1,
        }))
        .filter((c) => c.codigo),
      casas: Math.trunc(numeroOuNulo(comp.casas) ?? 2),
      arredondamento: umDe(
        comp.arredondamento,
        ARREDONDAMENTOS,
        "MEIO_PARA_CIMA",
      ),
    },
    desempate: lista(r.desempate)
      .map((d) => {
        const criterio = texto(objeto(d).criterio).toUpperCase();
        const catalogo = CRITERIO_POR_CODIGO[criterio];
        return {
          criterio,
          direcao: umDe(
            objeto(d).direcao,
            DIRECOES,
            catalogo?.direcao || "MAIOR_PRIMEIRO",
          ),
        };
      })
      .filter((d) => d.criterio),
    listas: {
      PRELIMINAR: {
        empate: umDe(
          objeto(listas.PRELIMINAR).empate,
          EMPATE_NAS_LISTAS,
          "MESMA_POSICAO",
        ),
      },
      ENTREVISTA: {
        empate: umDe(
          objeto(listas.ENTREVISTA).empate,
          EMPATE_NAS_LISTAS,
          "MESMA_POSICAO",
        ),
      },
      FINAL: {
        empate: umDe(
          objeto(listas.FINAL).empate,
          EMPATE_NAS_LISTAS,
          "CRITERIOS",
        ),
      },
    },
    empate_final: {
      metodo: umDe(empate.metodo, METODOS_DE_EMPATE_FINAL, "MESMA_POSICAO"),
      numeracao: umDe(empate.numeracao, NUMERACOES, "DENSA"),
    },
    modalidades,
    cotas: {
      minimo_vagas_reserva: Math.trunc(
        numeroOuNulo(cotas.minimo_vagas_reserva) ?? 0,
      ),
      acumulo: umDe(cotas.acumulo, ACUMULOS, "TODAS"),
    },
    convocacao: {
      multiplo_vagas: numeroOuNulo(conv.multiplo_vagas),
      posicao_max_cr: numeroOuNulo(conv.posicao_max_cr),
      incluir_empatados: booleano(conv.incluir_empatados, true),
      excecoes: lista(conv.excecoes)
        .map((e) => ({
          termos: termos(objeto(e).termos),
          multiplo_vagas: numeroOuNulo(objeto(e).multiplo_vagas),
          posicao_max_cr: numeroOuNulo(objeto(e).posicao_max_cr),
        }))
        .filter((e) => e.termos.length),
    },
    rodape: texto(r.rodape),
    importacao:
      r.importacao && typeof r.importacao === "object" ? r.importacao : null,
  };
}

const entre = (valor, min, max) =>
  valor === null || (Number.isFinite(valor) && valor >= min && valor <= max);

/**
 * Os erros da regra (já normalizada ou não): `[{ campo, mensagem }]`. Vazio =
 * pode salvar. As mesmas conferências do banco.
 */
export function validarRegra(bruta) {
  const r = normalizarRegra(bruta);
  const erros = [];
  const erro = (campo, mensagem) => erros.push({ campo, mensagem });

  if (bruta?.data_corte && !r.data_corte)
    erro("data_corte", "Data de corte inválida.");
  if (!r.etapas.documental && !r.etapas.entrevista)
    erro("etapas", "Escolha ao menos uma etapa.");

  if (!entre(r.documental.nota_minima, 0, 1000))
    erro("documental.nota_minima", "Nota mínima documental entre 0 e 1000.");
  for (const [nivel, valor] of Object.entries(
    r.documental.nota_minima_por_nivel,
  ))
    if (!entre(valor, 0, 1000))
      erro(
        `documental.nota_minima_por_nivel.${nivel}`,
        "Nota mínima inválida.",
      );
  if (r.documental.situacoes_aptas.length > 10)
    erro("documental.situacoes_aptas", "Até 10 situações.");

  for (const campo of [
    "nota_minima",
    "nota_minima_competencia",
    "nota_eliminatoria_ate",
  ])
    if (!entre(r.entrevista[campo], 0, 1000))
      erro(`entrevista.${campo}`, "Valor entre 0 e 1000.");
  if (r.entrevista.competencias.length > 20)
    erro("entrevista.competencias", "Até 20 competências.");
  const ordens = r.entrevista.competencias.map((c) => c.ordem);
  if (new Set(ordens).size !== ordens.length)
    erro("entrevista.competencias", "Competência repetida.");
  for (const c of r.entrevista.competencias)
    if (!entre(c.minimo, 0, 1000) || c.ordem > 20)
      erro(
        "entrevista.competencias",
        "Competência com mínimo ou ordem inválidos.",
      );

  const { componentes } = r.composicao;
  if (!componentes.length || componentes.length > 3)
    erro("composicao.componentes", "De 1 a 3 componentes na nota.");
  if (new Set(componentes.map((c) => c.codigo)).size !== componentes.length)
    erro("composicao.componentes", "Componente repetido.");
  if (componentes.some((c) => !entre(c.peso, 0, 100)))
    erro("composicao.componentes", "Peso entre 0 e 100.");
  if (
    componentes.some((c) => c.codigo === "ENTREVISTA") &&
    !r.etapas.entrevista
  )
    erro(
      "composicao.componentes",
      "A entrevista entra na nota, mas a etapa não.",
    );
  if (!entre(r.composicao.casas, 0, 4))
    erro("composicao.casas", "De 0 a 4 casas decimais.");

  if (r.desempate.length > 20) erro("desempate", "Até 20 critérios.");
  const vistos = new Set();
  for (const d of r.desempate) {
    if (!CRITERIO_POR_CODIGO[d.criterio])
      erro("desempate", `Critério fora do catálogo: ${d.criterio}.`);
    if (vistos.has(d.criterio))
      erro("desempate", `Critério repetido: ${d.criterio}.`);
    vistos.add(d.criterio);
  }

  const cods = r.modalidades.map((m) => m.codigo);
  if (r.modalidades.length > 12) erro("modalidades", "Até 12 modalidades.");
  if (new Set(cods).size !== cods.length)
    erro("modalidades", "Modalidade repetida.");
  for (const m of r.modalidades) {
    if (!/^[A-Z]{2,8}$/.test(m.codigo))
      erro("modalidades", `Código de modalidade inválido: ${m.codigo}.`);
    if (!entre(m.percentual, 0, 100))
      erro("modalidades", `Percentual inválido em ${m.codigo}.`);
    for (const destino of m.remanejar_para)
      if (!cods.includes(destino))
        erro(
          "modalidades",
          `${m.codigo} remaneja para ${destino}, que não está na regra.`,
        );
  }
  if (!entre(r.cotas.minimo_vagas_reserva, 0, 1000))
    erro("cotas.minimo_vagas_reserva", "Mínimo de vagas inválido.");

  const conv = r.convocacao;
  if (!entre(conv.multiplo_vagas, 0, 100))
    erro("convocacao.multiplo_vagas", "Múltiplo entre 0 e 100.");
  if (!entre(conv.posicao_max_cr, 0, 10000))
    erro("convocacao.posicao_max_cr", "Posição entre 0 e 10000.");
  if (conv.excecoes.length > 10)
    erro("convocacao.excecoes", "Até 10 exceções.");
  for (const e of conv.excecoes)
    if (!entre(e.multiplo_vagas, 0, 100) || !entre(e.posicao_max_cr, 0, 10000))
      erro("convocacao.excecoes", "Exceção com valores inválidos.");

  if (r.rodape.length > 1000) erro("rodape", "Rodapé com até 1000 caracteres.");
  return erros;
}

/** O critério do catálogo com a direção da regra (para a tela e a explicação). */
export function criteriosDaRegra(regra) {
  return normalizarRegra(regra)
    .desempate.map((d) => ({ ...d, catalogo: CRITERIO_POR_CODIGO[d.criterio] }))
    .filter((d) => d.catalogo);
}
