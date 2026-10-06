/*
  A regra da avaliação documental de um edital: formato, valores padrão e
  validação. Sem DOM e sem estado.

  A regra é dado (TH_REGRA_ANALISE."DS_CONFIGURACAO", jsonb): os pontos de
  indígena e de aldeia, a escolaridade por nível, as faixas dos cursos, a
  experiência, o lote, a distribuição, a revisão e os textos do parecer vêm
  de cada edital. O banco repete esta validação em
  private."FC_VALIDAR_REGRA_ANALISE" (20261006100000_regra_da_analise.sql);
  mudou aqui, muda lá (e os casos de tests/fixtures/avaliacao-documental/).

  Formato (schema 1):
  {
    schema, modelo, titulo_etapa, edital_rotulo, casas_parecer,
    provisoria: { eliminacao_automatica[], nota_declarada[], divergencia_tolerancia,
                  desempate[], pergunta_experiencia },
    (pergunta_experiencia e nota_declarada[].pergunta: o começo do enunciado
    — ou uma lista de alternativas, quando o enunciado muda de questionário
    para questionário; casa com qualquer uma, ver nota-declarada.js)
    lote: { base, multiplo, fixo, inclui_cr, por_modalidade, inclui_empatados,
            linha_anda, publica_reposicao, por_vaga{ codigo: tamanho } },
    distribuicao: { modo, criterio, limite_por_analista, novos, dias_parada },
    revisao: { amostra_percentual, minimo_por_analista, todas, inaptos_requisito,
               inaptos_nota, divergencia_pontos, sinais[], entrou_pela_linha, duplo_cego },
    blocos: [ { codigo, titulo, item_edital, tipo, perguntas[], condicao,
                efeitos{}, motivos[], …campos do tipo } ],
    corte: { fonte: "REGRA_CLASSIFICACAO", item_edital },
    parecer: { APTO, INAPTO_REQUISITO, INAPTO_NOTA, observacoes },
    observacoes_prontas: [ { codigo, rotulo, texto, item_edital } ]
  }
  A nota mínima não fica aqui: é a da regra de classificação do edital.
*/
import {
  BASES_DO_LOTE,
  CRITERIOS_DA_DISTRIBUICAO,
  DESEMPATE_PADRAO_DA_PROVISORIA,
  DESEMPATES_DA_PROVISORIA,
  DESTINO_DOS_NOVOS,
  EFEITOS,
  EFEITOS_DE_ENCAMINHAMENTO,
  EFEITOS_DE_PONTUACAO,
  MODOS_DE_DISTRIBUICAO,
  NIVEIS,
  PARCIAL_DO_TIPO,
  SCHEMA_DA_REGRA,
  SINAIS_DA_REVISAO,
  SITUACOES_COM_EFEITO,
  TIPOS_DA_NOTA_DECLARADA,
  TIPOS_DE_BLOCO,
  TITULO_PADRAO_DA_ETAPA,
  TITULOS_ACADEMICOS,
} from "./catalogo.js";

const valores = (lista) => new Set(lista.map(([v]) => v));
const TIPOS = valores(TIPOS_DE_BLOCO);
const EFEITO = valores(EFEITOS);
const NIVEL = valores(NIVEIS);
const TITULO = valores(TITULOS_ACADEMICOS);
const TIPO_DECLARADA = valores(TIPOS_DA_NOTA_DECLARADA);
const PARCIAIS_VALIDAS = new Set(Object.values(PARCIAL_DO_TIPO));

export const CODIGO = /^[A-Z][A-Z0-9_]{1,29}$/;
const CONDICAO = /^(INDIGENA|MODALIDADE=[A-Z]{2,12})$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export const LIMITES = Object.freeze({
  blocos: 40,
  perguntas: 10,
  motivos: 30,
  eliminacao: 20,
  declarada: 20,
  categorias: 10,
  faixas: 10,
  observacoes: 40,
  titulosPorNivel: 10,
  texto: 200,
  textoLongo: 1000,
  modeloDeParecer: 4000,
  tamanhoJson: 200000,
});

export const PARECER_PADRAO = Object.freeze({
  APTO: "{edital}\nCandidato(a) HABILITADO(A) na {titulo_etapa} com a pontuação total de {nota} pontos, distribuídos da seguinte forma:\n\n{distribuicao}",
  INAPTO_REQUISITO:
    "{edital}\nCandidato(a) INABILITADO(A) na {titulo_etapa}, pelo(s) seguinte(s) motivo(s):\n\n{motivos}",
  INAPTO_NOTA:
    "{edital}\nCandidato(a) NÃO HABILITADO(A) por não atingir a nota mínima de {corte} pontos (item {item_corte}). Nota obtida: {nota} pontos, distribuídos da seguinte forma:\n\n{distribuicao}",
  observacoes: "\n\nObservações da análise:\n{observacoes}",
});

export const LOTE_PADRAO = Object.freeze({
  base: "MULTIPLO_VAGAS",
  multiplo: 3,
  fixo: null,
  inclui_cr: true,
  por_modalidade: false,
  inclui_empatados: true,
  linha_anda: true,
  publica_reposicao: false,
});

export const DISTRIBUICAO_PADRAO = Object.freeze({
  modo: "PEGAR_PROXIMO",
  criterio: "PARTES_IGUAIS",
  limite_por_analista: null,
  novos: "MENOS_PENDENTES",
  dias_parada: 3,
});

export const REVISAO_PADRAO = Object.freeze({
  amostra_percentual: 10,
  minimo_por_analista: 0,
  todas: false,
  inaptos_requisito: true,
  inaptos_nota: false,
  divergencia_pontos: null,
  sinais: [],
  entrou_pela_linha: false,
  duplo_cego: false,
});

const ehObjeto = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const ehNumero = (v) => typeof v === "number" && Number.isFinite(v);
const entre = (v, min, max) => ehNumero(v) && v >= min && v <= max;
const nuloOuEntre = (v, min, max) =>
  v === null || v === undefined || entre(v, min, max);
const texto = (v) => (typeof v === "string" ? v : "");
const lista = (v) => (Array.isArray(v) ? v : []);
const bool = (v, padrao) => (typeof v === "boolean" ? v : padrao);
const copia = (v) => (v === undefined ? undefined : structuredClone(v));

/**
 * A pergunta da regra: o começo do enunciado (texto) ou alternativas (lista;
 * casa com qualquer uma). Sem texto, null.
 */
export function normalizarPergunta(valor) {
  if (Array.isArray(valor)) {
    const textos = valor
      .filter((t) => typeof t === "string")
      .map((t) => t.trim())
      .filter(Boolean);
    return textos.length ? textos : null;
  }
  return texto(valor).trim() || null;
}

/** A pergunta como a tela mostra: as alternativas separadas por "; ". */
export function textoDaPergunta(valor) {
  return Array.isArray(valor) ? valor.join("; ") : texto(valor);
}

/** O que a tela digitou: um texto, ou a lista quando há mais de um (";"). */
export function perguntaDoTexto(digitado) {
  const partes = String(digitado ?? "")
    .split(/[;\n]/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (partes.length > 1) return partes;
  return partes[0] ?? "";
}

/** A regra com os valores padrão onde faltam (não muda a entrada). */
export function normalizarRegraAnalise(entrada) {
  const r = ehObjeto(entrada) ? structuredClone(entrada) : {};
  const provisoria = ehObjeto(r.provisoria) ? r.provisoria : {};
  return {
    schema: SCHEMA_DA_REGRA,
    modelo: texto(r.modelo) || null,
    titulo_etapa: texto(r.titulo_etapa).trim() || TITULO_PADRAO_DA_ETAPA,
    edital_rotulo: texto(r.edital_rotulo),
    casas_parecer: entre(r.casas_parecer, 0, 4) ? r.casas_parecer : 1,
    provisoria: {
      eliminacao_automatica: lista(provisoria.eliminacao_automatica),
      nota_declarada: lista(provisoria.nota_declarada),
      divergencia_tolerancia: entre(provisoria.divergencia_tolerancia, 0, 30)
        ? provisoria.divergencia_tolerancia
        : 0,
      desempate: Array.isArray(provisoria.desempate)
        ? provisoria.desempate
        : [...DESEMPATE_PADRAO_DA_PROVISORIA],
      pergunta_experiencia: normalizarPergunta(provisoria.pergunta_experiencia),
    },
    lote: { ...LOTE_PADRAO, ...(ehObjeto(r.lote) ? r.lote : {}) },
    distribuicao: {
      ...DISTRIBUICAO_PADRAO,
      ...(ehObjeto(r.distribuicao) ? r.distribuicao : {}),
    },
    revisao: {
      ...REVISAO_PADRAO,
      ...(ehObjeto(r.revisao) ? r.revisao : {}),
      sinais: lista(r.revisao?.sinais),
    },
    blocos: lista(r.blocos),
    corte: {
      fonte: "REGRA_CLASSIFICACAO",
      item_edital: texto(r.corte?.item_edital),
    },
    parecer: {
      ...PARECER_PADRAO,
      ...(ehObjeto(r.parecer) ? r.parecer : {}),
    },
    observacoes_prontas: lista(r.observacoes_prontas),
  };
}

function conferirTexto(erros, valor, rotulo, { obrigatorio, max }) {
  if (valor === undefined || valor === null || valor === "") {
    if (obrigatorio) erros.push(`${rotulo}: obrigatório.`);
    return;
  }
  if (typeof valor !== "string") erros.push(`${rotulo}: deve ser texto.`);
  else if (valor.length > max) erros.push(`${rotulo}: até ${max} caracteres.`);
}

/** Pergunta da regra: um texto ou uma lista de 1 a 10 alternativas. */
function conferirPergunta(erros, valor, rotulo, obrigatorio) {
  if (!Array.isArray(valor)) {
    conferirTexto(erros, valor, rotulo, { obrigatorio, max: LIMITES.texto });
    return;
  }
  if (
    !valor.length ||
    valor.length > LIMITES.perguntas ||
    valor.some(
      (t) => typeof t !== "string" || !t.trim() || t.length > LIMITES.texto,
    )
  )
    erros.push(
      `${rotulo}: texto ou lista de 1 a ${LIMITES.perguntas} textos de até ${LIMITES.texto} caracteres.`,
    );
}

const temPergunta = (valor) =>
  Array.isArray(valor)
    ? valor.some((t) => typeof t === "string" && t.trim())
    : typeof valor === "string" && Boolean(valor.trim());

function conferirListaDeTextos(erros, valor, rotulo, max) {
  if (valor === undefined || valor === null) return;
  if (!Array.isArray(valor) || valor.length > max)
    erros.push(`${rotulo}: lista de até ${max} textos.`);
  else if (
    valor.some(
      (t) => typeof t !== "string" || !t.trim() || t.length > LIMITES.texto,
    )
  )
    erros.push(`${rotulo}: textos de 1 a ${LIMITES.texto} caracteres.`);
}

function conferirMotivos(erros, motivos, rotulo, tipo) {
  if (motivos === undefined || motivos === null) return;
  if (!Array.isArray(motivos) || motivos.length > LIMITES.motivos) {
    erros.push(`${rotulo}: até ${LIMITES.motivos} motivos.`);
    return;
  }
  const codigos = new Set();
  motivos.forEach((m, i) => {
    const onde = `${rotulo}, motivo ${i + 1}`;
    if (!ehObjeto(m)) {
      erros.push(`${onde}: inválido.`);
      return;
    }
    if (!CODIGO.test(texto(m.codigo)))
      erros.push(`${onde}: código em maiúsculas (2 a 30, letras, dígitos, _).`);
    else if (codigos.has(m.codigo)) erros.push(`${onde}: código repetido.`);
    codigos.add(m.codigo);
    conferirTexto(erros, m.texto, `${onde} (texto)`, {
      obrigatorio: true,
      max: LIMITES.textoLongo,
    });
    conferirTexto(erros, m.item_edital, `${onde} (item do edital)`, {
      max: 40,
    });
    if (m.efeito !== undefined && m.efeito !== null)
      conferirEfeito(erros, m.efeito, `${onde} (efeito)`, tipo);
  });
}

function conferirEfeito(erros, efeito, rotulo, tipo) {
  if (!EFEITO.has(efeito)) {
    erros.push(`${rotulo}: efeito desconhecido.`);
    return;
  }
  if (EFEITOS_DE_PONTUACAO.includes(efeito) && !PARCIAL_DO_TIPO[tipo])
    erros.push(`${rotulo}: só bloco que pontua zera ou ajusta pontos.`);
  if (efeito === "SEM_PONTOS_ALDEIA" && tipo !== "PONTUACAO")
    erros.push(`${rotulo}: só o critério étnico tira os pontos de aldeia.`);
  if (EFEITOS_DE_ENCAMINHAMENTO.includes(efeito) && tipo !== "COTA")
    erros.push(`${rotulo}: só bloco de cota encaminha.`);
}

function conferirBloco(erros, b, i) {
  const rotulo = `Bloco ${i + 1}${b?.codigo ? ` (${b.codigo})` : ""}`;
  if (!ehObjeto(b)) {
    erros.push(`${rotulo}: inválido.`);
    return;
  }
  if (!CODIGO.test(texto(b.codigo)))
    erros.push(`${rotulo}: código em maiúsculas (2 a 30, letras, dígitos, _).`);
  conferirTexto(erros, b.titulo, `${rotulo} (título)`, {
    obrigatorio: true,
    max: LIMITES.texto,
  });
  conferirTexto(erros, b.item_edital, `${rotulo} (item do edital)`, {
    max: 40,
  });
  if (!TIPOS.has(b.tipo)) {
    erros.push(`${rotulo}: tipo desconhecido.`);
    return;
  }
  conferirListaDeTextos(
    erros,
    b.perguntas,
    `${rotulo} (perguntas)`,
    LIMITES.perguntas,
  );
  if (
    b.condicao !== undefined &&
    b.condicao !== null &&
    !CONDICAO.test(texto(b.condicao))
  )
    erros.push(`${rotulo}: condição INDIGENA ou MODALIDADE=<código>.`);

  if (b.efeitos !== undefined && b.efeitos !== null) {
    if (!ehObjeto(b.efeitos)) erros.push(`${rotulo}: efeitos inválidos.`);
    else
      for (const [situacao, efeito] of Object.entries(b.efeitos)) {
        if (!SITUACOES_COM_EFEITO.includes(situacao)) {
          erros.push(`${rotulo}: situação ${situacao} não tem efeito.`);
          continue;
        }
        if (
          situacao === "CONFORME" &&
          ["ELIMINA", "ZERA_PONTOS", "SEM_PONTOS_ALDEIA"].includes(efeito)
        ) {
          erros.push(`${rotulo}: Conforme não pode eliminar nem tirar pontos.`);
          continue;
        }
        conferirEfeito(erros, efeito, `${rotulo}, ${situacao}`, b.tipo);
      }
  }
  conferirMotivos(erros, b.motivos, rotulo, b.tipo);

  const parcial = PARCIAL_DO_TIPO[b.tipo];
  if (parcial && b.parcial !== undefined && b.parcial !== parcial)
    erros.push(`${rotulo}: a parcial deste tipo é ${parcial}.`);
  if (!parcial && b.parcial !== undefined && b.parcial !== null)
    erros.push(`${rotulo}: este tipo não pontua.`);

  if (b.tipo === "PONTUACAO") {
    if (!entre(b.indigena, 0, 100) || !entre(b.aldeia, 0, 100))
      erros.push(`${rotulo}: pontos de indígena e de aldeia entre 0 e 100.`);
    if (!nuloOuEntre(b.teto, 0, 100))
      erros.push(`${rotulo}: teto entre 0 e 100.`);
    if (
      b.lista_aldeias !== undefined &&
      b.lista_aldeias !== null &&
      b.lista_aldeias !== "DSEI_DO_EDITAL"
    )
      erros.push(`${rotulo}: lista de aldeias DSEI_DO_EDITAL ou nenhuma.`);
  }
  if (b.tipo === "TITULOS") {
    if (typeof b.cumulativa !== "boolean")
      erros.push(`${rotulo}: diga se os títulos somam (cumulativa).`);
    if (!nuloOuEntre(b.teto, 0, 100))
      erros.push(`${rotulo}: teto entre 0 e 100.`);
    if (
      !ehObjeto(b.pontos_por_nivel) ||
      !Object.keys(b.pontos_por_nivel).length
    )
      erros.push(
        `${rotulo}: informe os títulos e pontos de ao menos um nível.`,
      );
    else
      for (const [nivel, titulos] of Object.entries(b.pontos_por_nivel)) {
        if (!NIVEL.has(nivel)) {
          erros.push(`${rotulo}: nível ${nivel} desconhecido.`);
          continue;
        }
        if (
          !Array.isArray(titulos) ||
          titulos.length > LIMITES.titulosPorNivel
        ) {
          erros.push(
            `${rotulo}, ${nivel}: até ${LIMITES.titulosPorNivel} títulos.`,
          );
          continue;
        }
        const vistos = new Set();
        for (const t of titulos) {
          if (!ehObjeto(t) || !TITULO.has(t.titulo) || !entre(t.pontos, 0, 100))
            erros.push(
              `${rotulo}, ${nivel}: título conhecido e pontos entre 0 e 100.`,
            );
          else if (vistos.has(t.titulo))
            erros.push(`${rotulo}, ${nivel}: ${t.titulo} repetido.`);
          else vistos.add(t.titulo);
        }
      }
  }
  if (b.tipo === "CURSOS") {
    conferirFaixas(erros, b, rotulo);
    conferirPorNivel(erros, b.por_nivel, rotulo, (valor, onde) =>
      conferirFaixas(erros, valor, onde),
    );
  }
  if (b.tipo === "VINCULOS") {
    const categorias = b.categorias;
    if (
      !Array.isArray(categorias) ||
      !categorias.length ||
      categorias.length > LIMITES.categorias
    )
      erros.push(`${rotulo}: de 1 a ${LIMITES.categorias} categorias.`);
    else {
      const codigos = new Set();
      const desempates = new Set();
      categorias.forEach((c, j) => {
        const onde = `${rotulo}, categoria ${j + 1}`;
        if (!ehObjeto(c) || !CODIGO.test(texto(c.codigo))) {
          erros.push(`${onde}: código em maiúsculas.`);
          return;
        }
        if (codigos.has(c.codigo)) erros.push(`${onde}: código repetido.`);
        codigos.add(c.codigo);
        conferirTexto(erros, c.rotulo, `${onde} (rótulo)`, {
          obrigatorio: true,
          max: 100,
        });
        if (!nuloOuEntre(c.desempate, 1, 5))
          erros.push(`${onde}: desempate de 1 a 5 ou nenhum.`);
        else if (ehNumero(c.desempate)) {
          if (desempates.has(c.desempate))
            erros.push(`${onde}: desempate ${c.desempate} repetido.`);
          desempates.add(c.desempate);
        }
        if (c.pontua !== undefined && typeof c.pontua !== "boolean")
          erros.push(`${onde}: diga se pontua.`);
      });
    }
    if (!entre(b.minimo_meses ?? 0, 0, 600))
      erros.push(`${rotulo}: mínimo de meses entre 0 e 600.`);
    if (
      b.efeito_minimo !== undefined &&
      b.efeito_minimo !== null &&
      !["ELIMINA", "SO_REGISTRO"].includes(b.efeito_minimo)
    )
      erros.push(`${rotulo}: abaixo do mínimo elimina ou só registra.`);
    const pontuacao = b.pontuacao ?? "POR_MES";
    if (!["POR_MES", "POR_PERIODO"].includes(pontuacao))
      erros.push(`${rotulo}: pontuação por mês ou por período.`);
    if (pontuacao === "POR_PERIODO" && !entre(b.periodo_meses, 1, 120))
      erros.push(`${rotulo}: período de 1 a 120 meses.`);
    if (
      b.desconta_minimo !== undefined &&
      typeof b.desconta_minimo !== "boolean"
    )
      erros.push(`${rotulo}: diga se o mínimo exigido fica fora da pontuação.`);
    conferirPontosDaExperiencia(erros, b, rotulo, pontuacao);
    conferirPorNivel(erros, b.por_nivel, rotulo, (valor, onde) =>
      conferirPontosDaExperiencia(erros, valor, onde, pontuacao),
    );
    if (!entre(b.dias_por_mes ?? 30, 1, 31))
      erros.push(`${rotulo}: dias por mês entre 1 e 31.`);
    if (!entre(b.max_vinculos ?? 20, 1, 50))
      erros.push(`${rotulo}: de 1 a 50 vínculos.`);
    if (
      b.data_limite !== undefined &&
      b.data_limite !== null &&
      !dataValida(b.data_limite)
    )
      erros.push(`${rotulo}: data limite AAAA-MM-DD.`);
    const estagio = b.estagio_indigena;
    if (estagio !== undefined && estagio !== null) {
      if (
        !ehObjeto(estagio) ||
        typeof estagio.ativo !== "boolean" ||
        !entre(estagio.horas_por_dia ?? 8, 1, 24) ||
        !entre(estagio.dias_por_mes ?? 22, 1, 31)
      )
        erros.push(
          `${rotulo}: estágio de indígena com horas por dia (1 a 24) e dias por mês (1 a 31).`,
        );
    }
  }
}

function conferirFaixas(erros, alvo, rotulo) {
  if (!ehObjeto(alvo)) {
    erros.push(`${rotulo}: faixas inválidas.`);
    return;
  }
  if (!nuloOuEntre(alvo.teto, 0, 100))
    erros.push(`${rotulo}: teto entre 0 e 100.`);
  const faixas = alvo.faixas;
  if (
    !Array.isArray(faixas) ||
    !faixas.length ||
    faixas.length > LIMITES.faixas
  )
    erros.push(`${rotulo}: de 1 a ${LIMITES.faixas} faixas de carga horária.`);
  else
    faixas.forEach((f, j) => {
      if (
        !ehObjeto(f) ||
        !entre(f.min_horas, 0, 20000) ||
        !nuloOuEntre(f.max_horas, 0, 20000) ||
        (ehNumero(f.max_horas) && f.max_horas < f.min_horas) ||
        !entre(f.pontos, 0, 100)
      )
        erros.push(
          `${rotulo}, faixa ${j + 1}: horas de 0 a 20.000 (mínimo ≤ máximo) e pontos de 0 a 100.`,
        );
    });
}

function conferirPontosDaExperiencia(erros, alvo, rotulo, pontuacao) {
  if (!ehObjeto(alvo)) {
    erros.push(`${rotulo}: pontos inválidos.`);
    return;
  }
  if (pontuacao === "POR_PERIODO") {
    if (!entre(alvo.pontos_por_periodo, 0, 100))
      erros.push(`${rotulo}: pontos por período entre 0 e 100.`);
  } else if (!entre(alvo.pontos_por_mes, 0, 100))
    erros.push(`${rotulo}: pontos por mês entre 0 e 100.`);
  if (!nuloOuEntre(alvo.teto, 0, 1000))
    erros.push(`${rotulo}: teto entre 0 e 1000.`);
}

/* Pontos que mudam com o nível da vaga: { superior: {…}, tecnico: {…} }. */
function conferirPorNivel(erros, porNivel, rotulo, conferir) {
  if (porNivel === undefined || porNivel === null) return;
  if (!ehObjeto(porNivel)) {
    erros.push(`${rotulo}: pontos por nível inválidos.`);
    return;
  }
  for (const [nivel, valor] of Object.entries(porNivel)) {
    if (!NIVEL.has(nivel))
      erros.push(`${rotulo}: nível ${nivel} desconhecido.`);
    else conferir(valor, `${rotulo}, ${nivel}`);
  }
}

export function dataValida(valor) {
  if (typeof valor !== "string" || !DATA.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

/**
 * Confere a regra. Devolve a lista de erros (vazia = válida), com mensagens
 * para a tela. O banco recusa o mesmo (22023).
 */
export function validarRegraAnalise(regra) {
  const erros = [];
  if (!ehObjeto(regra)) return ["Regra inválida: envie um objeto."];
  if (JSON.stringify(regra).length > LIMITES.tamanhoJson)
    return ["Regra grande demais."];
  if (regra.schema !== SCHEMA_DA_REGRA)
    erros.push("Versão do formato (schema) deve ser 1.");
  conferirTexto(erros, regra.modelo, "Modelo", { max: 30 });
  conferirTexto(erros, regra.titulo_etapa, "Título da etapa", {
    obrigatorio: true,
    max: LIMITES.texto,
  });
  conferirTexto(erros, regra.edital_rotulo, "Rótulo do edital", { max: 120 });
  if (!nuloOuEntre(regra.casas_parecer, 0, 4))
    erros.push("Casas decimais do parecer entre 0 e 4.");

  // Provisória: eliminação automática e nota declarada.
  const provisoria = regra.provisoria ?? {};
  if (!ehObjeto(provisoria)) erros.push("Provisória inválida.");
  const eliminacao = provisoria.eliminacao_automatica ?? [];
  if (!Array.isArray(eliminacao) || eliminacao.length > LIMITES.eliminacao)
    erros.push(`Eliminação automática: até ${LIMITES.eliminacao} regras.`);
  else {
    const codigos = new Set();
    eliminacao.forEach((e, i) => {
      const onde = `Eliminação automática ${i + 1}`;
      if (!ehObjeto(e) || !CODIGO.test(texto(e.codigo))) {
        erros.push(`${onde}: código em maiúsculas.`);
        return;
      }
      if (codigos.has(e.codigo)) erros.push(`${onde}: código repetido.`);
      codigos.add(e.codigo);
      const fontes = ["coluna", "coluna_prefixo", "pergunta"].filter(
        (k) => typeof e[k] === "string" && e[k].trim(),
      );
      if (fontes.length !== 1)
        erros.push(
          `${onde}: diga uma coluna, um prefixo de coluna ou uma pergunta.`,
        );
      conferirListaDeTextos(erros, e.quando, `${onde} (quando)`, 20);
      conferirListaDeTextos(erros, e.exceto, `${onde} (exceto)`, 20);
      if (!lista(e.quando).length && !lista(e.exceto).length)
        erros.push(
          `${onde}: diga os valores que eliminam (quando) ou os que passam (exceto).`,
        );
      conferirTexto(erros, e.motivo, `${onde} (motivo)`, {
        obrigatorio: true,
        max: LIMITES.texto,
      });
    });
  }
  const declarada = provisoria.nota_declarada ?? [];
  if (!Array.isArray(declarada) || declarada.length > LIMITES.declarada)
    erros.push(`Nota declarada: até ${LIMITES.declarada} perguntas.`);
  else
    declarada.forEach((d, i) => {
      const onde = `Nota declarada ${i + 1}`;
      if (!ehObjeto(d)) {
        erros.push(`${onde}: inválida.`);
        return;
      }
      if (!PARCIAIS_VALIDAS.has(d.parcial))
        erros.push(`${onde}: parcial ETNICO, FORMACAO, CURSOS ou EXPERIENCIA.`);
      conferirPergunta(erros, d.pergunta, `${onde} (pergunta)`, true);
      if (!TIPO_DECLARADA.has(d.tipo)) {
        erros.push(`${onde}: tipo OPCAO, OPCOES_SOMADAS ou FAIXA_EM_MESES.`);
        return;
      }
      const mapa = d.tipo === "FAIXA_EM_MESES" ? d.meses : d.pontos;
      if (
        !ehObjeto(mapa) ||
        Object.keys(mapa).length > 50 ||
        Object.entries(mapa).some(
          ([resposta, valor]) =>
            !resposta.trim() ||
            resposta.length > LIMITES.texto ||
            !entre(valor, 0, d.tipo === "FAIXA_EM_MESES" ? 1200 : 100),
        )
      )
        erros.push(
          d.tipo === "FAIXA_EM_MESES"
            ? `${onde}: meses de cada resposta (0 a 1200, até 50 respostas).`
            : `${onde}: pontos de cada resposta (0 a 100, até 50 respostas).`,
        );
      if (d.tipo === "FAIXA_EM_MESES" && !entre(d.pontos_por_mes, 0, 100))
        erros.push(`${onde}: pontos por mês entre 0 e 100.`);
      if (!nuloOuEntre(d.teto, 0, 100))
        erros.push(`${onde}: teto entre 0 e 100.`);
    });
  if (!nuloOuEntre(provisoria.divergencia_tolerancia, 0, 30))
    erros.push("Tolerância da divergência entre 0 e 30 pontos.");
  const desempate = provisoria.desempate;
  if (
    desempate !== undefined &&
    (!Array.isArray(desempate) ||
      desempate.length > DESEMPATES_DA_PROVISORIA.length ||
      new Set(desempate).size !== desempate.length ||
      desempate.some((d) => !valores(DESEMPATES_DA_PROVISORIA).has(d)))
  )
    erros.push(
      "Desempate da Provisória: IDOSO, EXPERIENCIA_DECLARADA, MAIOR_IDADE, MAIS_VELHO ou CANDIDATURA, sem repetir.",
    );
  conferirPergunta(
    erros,
    provisoria.pergunta_experiencia,
    "Pergunta da experiência declarada",
    false,
  );
  if (
    Array.isArray(desempate) &&
    desempate.includes("EXPERIENCIA_DECLARADA") &&
    !temPergunta(provisoria.pergunta_experiencia)
  )
    erros.push(
      "Desempate pela experiência declarada: informe a pergunta da experiência.",
    );

  // Lote.
  const lote = regra.lote ?? {};
  if (!ehObjeto(lote)) erros.push("Lote inválido.");
  else {
    if (!valores(BASES_DO_LOTE).has(lote.base))
      erros.push("Lote: múltiplo das vagas, número fixo ou nota mínima.");
    if (lote.base === "MULTIPLO_VAGAS" && !entre(lote.multiplo, 1, 100))
      erros.push("Lote: múltiplo de 1 a 100.");
    if (lote.base === "FIXO" && !entre(lote.fixo, 1, 100000))
      erros.push("Lote: número fixo de 1 a 100.000.");
    if (lote.base === "NOTA_MINIMA" && !entre(lote.nota_minima, 0, 1000))
      erros.push("Lote: nota mínima de 0 a 1.000.");
    if (
      lote.item_edital !== undefined &&
      lote.item_edital !== null &&
      (typeof lote.item_edital !== "string" || lote.item_edital.length > 40)
    )
      erros.push("Lote: item do edital com até 40 caracteres.");
    for (const chave of [
      "inclui_cr",
      "por_modalidade",
      "inclui_empatados",
      "linha_anda",
      "publica_reposicao",
    ])
      if (lote[chave] !== undefined && typeof lote[chave] !== "boolean")
        erros.push(`Lote: ${chave} deve ser sim ou não.`);
    if (lote.por_vaga !== undefined && lote.por_vaga !== null) {
      const porVaga = ehObjeto(lote.por_vaga)
        ? Object.entries(lote.por_vaga)
        : null;
      if (
        !porVaga ||
        porVaga.length > 500 ||
        porVaga.some(
          ([vaga, n]) =>
            !/^[0-9]{1,20}$/.test(vaga) ||
            !Number.isInteger(n) ||
            n < 1 ||
            n > 100000,
        )
      )
        erros.push(
          "Lote por vaga: código da vaga (só dígitos) e tamanho inteiro de 1 a 100.000.",
        );
    }
  }

  // Distribuição e revisão.
  const distribuicao = regra.distribuicao ?? {};
  if (!ehObjeto(distribuicao)) erros.push("Distribuição inválida.");
  else {
    if (!valores(MODOS_DE_DISTRIBUICAO).has(distribuicao.modo))
      erros.push("Distribuição: Pegar próximo ou Distribuição inicial.");
    if (
      distribuicao.criterio != null &&
      !valores(CRITERIOS_DA_DISTRIBUICAO).has(distribuicao.criterio)
    )
      erros.push("Distribuição: partes iguais ou até um limite.");
    if (!nuloOuEntre(distribuicao.limite_por_analista, 1, 5000))
      erros.push("Distribuição: limite por analista de 1 a 5.000.");
    if (
      distribuicao.novos != null &&
      !valores(DESTINO_DOS_NOVOS).has(distribuicao.novos)
    )
      erros.push("Distribuição: destino dos que entram depois inválido.");
    if (!nuloOuEntre(distribuicao.dias_parada, 1, 60))
      erros.push("Distribuição: ficha parada de 1 a 60 dias úteis.");
  }
  const revisao = regra.revisao ?? {};
  if (!ehObjeto(revisao)) erros.push("Revisão inválida.");
  else {
    if (!nuloOuEntre(revisao.amostra_percentual, 0, 100))
      erros.push("Revisão: amostra de 0 a 100%.");
    if (!nuloOuEntre(revisao.minimo_por_analista, 0, 1000))
      erros.push("Revisão: mínimo por analista de 0 a 1.000.");
    if (!nuloOuEntre(revisao.divergencia_pontos, 0, 1000))
      erros.push("Revisão: divergência de 0 a 1.000 pontos.");
    const sinais = revisao.sinais ?? [];
    if (
      !Array.isArray(sinais) ||
      sinais.some((s) => !valores(SINAIS_DA_REVISAO).has(s))
    )
      erros.push("Revisão: sinais desconhecidos.");
    for (const chave of [
      "todas",
      "inaptos_requisito",
      "inaptos_nota",
      "entrou_pela_linha",
      "duplo_cego",
    ])
      if (revisao[chave] !== undefined && typeof revisao[chave] !== "boolean")
        erros.push(`Revisão: ${chave} deve ser sim ou não.`);
  }

  // Blocos.
  const blocos = regra.blocos;
  if (
    !Array.isArray(blocos) ||
    !blocos.length ||
    blocos.length > LIMITES.blocos
  )
    erros.push(`De 1 a ${LIMITES.blocos} blocos.`);
  else {
    blocos.forEach((b, i) => conferirBloco(erros, b, i));
    const codigos = blocos.map((b) => b?.codigo).filter(Boolean);
    if (new Set(codigos).size !== codigos.length)
      erros.push("Código de bloco repetido.");
    for (const tipo of Object.keys(PARCIAL_DO_TIPO))
      if (blocos.filter((b) => b?.tipo === tipo).length > 1)
        erros.push(`Só um bloco do tipo ${tipo} (uma parcial por regra).`);
  }

  // Corte, parecer e observações prontas.
  if (regra.corte !== undefined && regra.corte !== null) {
    if (!ehObjeto(regra.corte) || regra.corte.fonte !== "REGRA_CLASSIFICACAO")
      erros.push(
        "A nota mínima vem da regra de classificação (REGRA_CLASSIFICACAO).",
      );
    else
      conferirTexto(erros, regra.corte.item_edital, "Item da nota mínima", {
        max: 40,
      });
  }
  const parecer = regra.parecer ?? {};
  if (!ehObjeto(parecer)) erros.push("Modelos de parecer inválidos.");
  else
    for (const chave of [
      "APTO",
      "INAPTO_REQUISITO",
      "INAPTO_NOTA",
      "observacoes",
    ])
      conferirTexto(erros, parecer[chave], `Parecer (${chave})`, {
        obrigatorio: true,
        max: LIMITES.modeloDeParecer,
      });
  const prontas = regra.observacoes_prontas ?? [];
  if (!Array.isArray(prontas) || prontas.length > LIMITES.observacoes)
    erros.push(`Até ${LIMITES.observacoes} observações prontas.`);
  else {
    const codigos = new Set();
    prontas.forEach((o, i) => {
      const onde = `Observação pronta ${i + 1}`;
      if (!ehObjeto(o) || !CODIGO.test(texto(o.codigo))) {
        erros.push(`${onde}: código em maiúsculas.`);
        return;
      }
      if (codigos.has(o.codigo)) erros.push(`${onde}: código repetido.`);
      codigos.add(o.codigo);
      conferirTexto(erros, o.rotulo, `${onde} (rótulo)`, {
        obrigatorio: true,
        max: 100,
      });
      conferirTexto(erros, o.texto, `${onde} (texto)`, {
        obrigatorio: true,
        max: LIMITES.textoLongo,
      });
      conferirTexto(erros, o.item_edital, `${onde} (item do edital)`, {
        max: 40,
      });
    });
  }
  return erros;
}

/** Um bloco novo do tipo, com os campos que o tipo pede (sem pesos inventados: tudo zero). */
export function blocoNovo(tipo, codigo) {
  const base = {
    codigo,
    titulo: "",
    item_edital: "",
    tipo,
    perguntas: [],
    efeitos: {},
    motivos: [],
  };
  if (tipo === "DOCUMENTO")
    return {
      ...base,
      efeitos: { NAO_CONFORME: "ELIMINA", NAO_ENVIADO: "ELIMINA" },
    };
  if (tipo === "PONTUACAO")
    return {
      ...base,
      parcial: "ETNICO",
      condicao: "INDIGENA",
      indigena: 0,
      aldeia: 0,
      teto: null,
      lista_aldeias: "DSEI_DO_EDITAL",
      efeitos: { NAO_CONFORME: "ZERA_PONTOS", NAO_ENVIADO: "ZERA_PONTOS" },
    };
  if (tipo === "TITULOS")
    return {
      ...base,
      parcial: "FORMACAO",
      cumulativa: false,
      teto: null,
      pontos_por_nivel: { superior: [] },
    };
  if (tipo === "CURSOS")
    return {
      ...base,
      parcial: "CURSOS",
      teto: null,
      faixas: [{ min_horas: 0, max_horas: null, pontos: 0 }],
    };
  if (tipo === "VINCULOS")
    return {
      ...base,
      parcial: "EXPERIENCIA",
      categorias: [
        { codigo: "AREA", rotulo: "Na área", desempate: null, pontua: true },
      ],
      minimo_meses: 0,
      efeito_minimo: "ELIMINA",
      item_minimo: "",
      pontuacao: "POR_MES",
      pontos_por_mes: 0,
      periodo_meses: 6,
      pontos_por_periodo: 0,
      desconta_minimo: false,
      teto: null,
      dias_por_mes: 30,
      unir_sobreposicao: true,
      data_limite: null,
      max_vinculos: 20,
      minimo_conta_estagio: false,
      estagio_indigena: {
        ativo: false,
        horas_por_dia: 8,
        dias_por_mes: 22,
        so_sem_experiencia: true,
      },
    };
  if (tipo === "COTA")
    return {
      ...base,
      condicao: "MODALIDADE=PP",
      efeitos: { NAO_CONFORME: "SEGUE_AMPLA", NAO_ENVIADO: "SEGUE_AMPLA" },
    };
  return { ...base };
}

/** Um código de bloco livre a partir de um prefixo (BLOCO_2, BLOCO_3…). */
export function codigoLivre(blocos, prefixo = "BLOCO") {
  const usados = new Set(lista(blocos).map((b) => b?.codigo));
  for (let n = lista(blocos).length + 1; n < 1000; n += 1) {
    const codigo = `${prefixo}_${n}`;
    if (!usados.has(codigo)) return codigo;
  }
  return `${prefixo}_${Date.now() % 100000}`;
}

/** Duas regras iguais (ignora a ordem das chaves). */
export function regrasIguais(a, b) {
  const ordenar = (v) =>
    Array.isArray(v)
      ? v.map(ordenar)
      : ehObjeto(v)
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((k) => [k, ordenar(v[k])]),
          )
        : v;
  return JSON.stringify(ordenar(a)) === JSON.stringify(ordenar(b));
}

export { copia as copiarRegra };
