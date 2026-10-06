/*
  A conta da avaliação documental a partir de UMA regra (regra.js) e do que
  foi conferido de um candidato. Sem DOM e sem estado: a prévia "Testar com um
  candidato fictício" usa hoje, e a ficha (fase F4) usa a mesma função. Nenhum
  peso fica aqui: pontos, tetos, faixas e efeitos vêm da regra.

  Candidato (o formato da ficha):
  {
    nivel: "superior" | "tecnico" | "medio" | "fundamental",
    modalidade: "AC" | "PP" | …,
    indigena, mora_aldeia, aldeia_na_lista: boolean,
    blocos: { <CODIGO>: { situacao, motivos: [<código>], motivo_livre } },
    titulos: [{ titulo: "ESPECIALIZACAO", aceito }],
    cursos: [{ horas, aceito }],
    vinculos: [{ categoria, inicio: "AAAA-MM-DD", fim, aceito }],
    estagio_horas,
    observacoes, observacoes_prontas: [<código>]
  }

  Regras da conta (as do simulador do 28/2026, agora configuráveis):
  - bloco sem situação conta como Conforme (situacaoPadrao); condição falsa
    (não indígena, outra modalidade) vira Não se aplica;
  - o efeito do bloco é o da situação; se um motivo escolhido tem efeito,
    vale o mais forte dos motivos (FORCA_DO_EFEITO); ELIMINA dá Inapto
    (requisito) e nota 0;
  - vínculos: une as sobreposições (emenda o dia seguinte), conta os dias
    com o primeiro e o último, meses = dias ÷ dias_por_mes (só os inteiros),
    pontos = meses × pontos_por_mes (ou blocos de N meses × pontos por
    período, sem o mínimo exigido se desconta_minimo) até o teto, com os
    valores do nível da vaga (por_nivel) quando houver; estágio de indígena sem
    experiência = horas ÷ horas_por_dia ÷ dias_por_mes (só os inteiros);
  - desempate em anos (365 dias), meses (30) e dias;
  - nota abaixo da mínima (a da regra de classificação, por nível se houver)
    dá Inapto (nota mínima).
*/
import {
  FORCA_DO_EFEITO,
  PARCIAIS,
  PARCIAL_DO_TIPO,
  rotuloDe,
  SITUACOES_DO_BLOCO,
  TITULO_PADRAO_DA_ETAPA,
} from "./catalogo.js";
import { normalizarRegraAnalise } from "./regra.js";

const DIA_MS = 24 * 60 * 60 * 1000;
const arredondar = (n, casas = 4) => {
  const fator = 10 ** casas;
  return Math.round((Number(n) + Number.EPSILON) * fator) / fator;
};
const lista = (v) => (Array.isArray(v) ? v : []);
const numero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const comTeto = (valor, teto) =>
  teto === null || teto === undefined ? valor : Math.min(valor, teto);

function diaUtc(texto) {
  if (typeof texto !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(texto))
    return null;
  const t = Date.parse(`${texto}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10) === texto ? t / DIA_MS : null;
}

/**
 * Dias de um conjunto de intervalos [inicio, fim] (datas AAAA-MM-DD,
 * inclusivos). Com `unir`, as sobreposições contam uma vez e o intervalo que
 * começa no dia seguinte ao fim do anterior emenda. `limite` corta o fim.
 */
export function diasDosIntervalos(
  intervalos,
  { unir = true, limite = null } = {},
) {
  const corte = limite ? diaUtc(limite) : null;
  const dias = lista(intervalos)
    .map(({ inicio, fim }) => [diaUtc(inicio), diaUtc(fim)])
    .filter(([a, b]) => a !== null && b !== null && b >= a)
    .map(([a, b]) => [a, corte !== null ? Math.min(b, corte) : b])
    .filter(([a, b]) => b >= a)
    .sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  if (!unir) return dias.reduce((soma, [a, b]) => soma + (b - a + 1), 0);
  let total = 0;
  let atual = null;
  for (const [a, b] of dias) {
    if (atual && a <= atual[1] + 1) atual[1] = Math.max(atual[1], b);
    else {
      if (atual) total += atual[1] - atual[0] + 1;
      atual = [a, b];
    }
  }
  if (atual) total += atual[1] - atual[0] + 1;
  return total;
}

/** Dias em anos (365), meses (30) e dias, como a planilha e o simulador. */
export function anosMesesDias(dias) {
  const total = Math.max(0, Math.floor(numero(dias)));
  const anos = Math.floor(total / 365);
  const resto = total % 365;
  return { anos, meses: Math.floor(resto / 30), dias: resto % 30 };
}

const forca = (efeito) => {
  const i = FORCA_DO_EFEITO.indexOf(efeito);
  return i === -1 ? FORCA_DO_EFEITO.length : i;
};
const maisForte = (efeitos) =>
  efeitos.filter(Boolean).sort((a, b) => forca(a) - forca(b))[0] ?? null;

function condicaoVale(condicao, candidato) {
  if (!condicao) return true;
  if (condicao === "INDIGENA") return Boolean(candidato.indigena);
  const [, modalidade] = String(condicao).split("=");
  return (
    String(candidato.modalidade ?? "").toUpperCase() ===
    String(modalidade ?? "").toUpperCase()
  );
}

const comItem = (item, textoDoMotivo) =>
  item ? `Item ${item}: ${textoDoMotivo}` : textoDoMotivo;

/** Situação, efeito e motivos de cada bloco. */
function avaliarBlocos(regra, candidato, situacaoPadrao) {
  return regra.blocos.map((bloco) => {
    const lancado = candidato.blocos?.[bloco.codigo] ?? {};
    // O critério étnico só vale para quem se declarou indígena.
    const condicao =
      bloco.condicao ?? (bloco.tipo === "PONTUACAO" ? "INDIGENA" : null);
    const aplica = condicaoVale(condicao, candidato);
    const situacao = aplica
      ? lancado.situacao || situacaoPadrao
      : "NAO_SE_APLICA";
    const escolhidos =
      situacao === "NAO_CONFORME" || situacao === "NAO_ENVIADO"
        ? lista(lancado.motivos)
            .map((codigo) =>
              lista(bloco.motivos).find((m) => m.codigo === codigo),
            )
            .filter(Boolean)
        : [];
    const efeitoDaSituacao =
      situacao === "NAO_SE_APLICA"
        ? null
        : (bloco.efeitos?.[situacao] ??
          (situacao === "CONFORME" ? null : "SO_REGISTRO"));
    // O motivo é mais específico que a situação: se algum motivo escolhido
    // tem efeito, vale o mais forte deles (ex.: "Aldeia fora do DSEI" só tira
    // os pontos de aldeia, mesmo com o bloco Não conforme).
    const efeitosDosMotivos = escolhidos.map((m) => m.efeito).filter(Boolean);
    const efeito = efeitosDosMotivos.length
      ? maisForte(efeitosDosMotivos)
      : efeitoDaSituacao;
    const livre = String(lancado.motivo_livre ?? "").trim();
    const motivos = escolhidos.map((m) => ({
      codigo: m.codigo,
      texto: m.texto,
      item_edital: m.item_edital || bloco.item_edital || "",
    }));
    if (livre)
      motivos.push({
        codigo: null,
        texto: livre,
        item_edital: bloco.item_edital || "",
      });
    return { bloco, situacao, efeito, motivos };
  });
}

function pontosEtnicos(bloco, avaliado, candidato) {
  if (avaliado.situacao === "NAO_SE_APLICA" || !candidato.indigena) return 0;
  if (["ELIMINA", "ZERA_PONTOS"].includes(avaliado.efeito)) return 0;
  let pontos = numero(bloco.indigena);
  const aldeiaVale =
    candidato.mora_aldeia &&
    (bloco.lista_aldeias ? candidato.aldeia_na_lista : true) &&
    avaliado.efeito !== "SEM_PONTOS_ALDEIA";
  if (aldeiaVale) pontos += numero(bloco.aldeia);
  return comTeto(pontos, bloco.teto);
}

function pontosDosTitulos(bloco, candidato) {
  const tabela = lista(bloco.pontos_por_nivel?.[candidato.nivel]);
  const valores = lista(candidato.titulos)
    .filter((t) => t && t.aceito !== false)
    .map((t) => numero(tabela.find((x) => x.titulo === t.titulo)?.pontos));
  if (!valores.length) return 0;
  const total = bloco.cumulativa
    ? valores.reduce((a, b) => a + b, 0)
    : Math.max(...valores);
  return comTeto(total, bloco.teto);
}

export function faixaDoCurso(faixas, horas) {
  const h = numero(horas);
  return (
    lista(faixas).find(
      (f) =>
        h >= numero(f.min_horas) &&
        (f.max_horas === null || f.max_horas === undefined || h <= f.max_horas),
    ) ?? null
  );
}

/* O que vale para o nível da vaga: a parte de por_nivel, por cima do bloco. */
export function doNivel(bloco, nivel) {
  const doNivelDaVaga = bloco.por_nivel?.[nivel];
  return doNivelDaVaga ? { ...bloco, ...doNivelDaVaga } : bloco;
}

function pontosDosCursos(blocoGeral, candidato) {
  const bloco = doNivel(blocoGeral, candidato.nivel);
  const total = lista(candidato.cursos)
    .filter((c) => c && c.aceito !== false)
    .reduce(
      (soma, c) => soma + numero(faixaDoCurso(bloco.faixas, c.horas)?.pontos),
      0,
    );
  return comTeto(arredondar(total), bloco.teto);
}

/** Experiência: dias por categoria, total unido, meses, estágio e pontos. */
export function apurarExperiencia(bloco, candidato) {
  const opcoes = {
    unir: bloco.unir_sobreposicao !== false,
    limite: bloco.data_limite || null,
  };
  const categorias = lista(bloco.categorias);
  const aceitos = lista(candidato.vinculos)
    .filter((v) => v && v.aceito !== false)
    .slice(0, bloco.max_vinculos ?? 20);
  const porCategoria = {};
  for (const c of categorias) {
    const dias = diasDosIntervalos(
      aceitos.filter((v) => v.categoria === c.codigo),
      opcoes,
    );
    porCategoria[c.codigo] = {
      dias_total: dias,
      ...anosMesesDias(dias),
      desempate: c.desempate ?? null,
    };
  }
  const queContam = new Set(
    categorias.filter((c) => c.pontua !== false).map((c) => c.codigo),
  );
  const diasTotal = diasDosIntervalos(
    aceitos.filter((v) => queContam.has(v.categoria)),
    opcoes,
  );
  const diasPorMes = bloco.dias_por_mes ?? 30;
  const meses = Math.floor(diasTotal / diasPorMes);
  const estagio = bloco.estagio_indigena ?? {};
  let mesesEstagio = 0;
  if (
    estagio.ativo &&
    candidato.indigena &&
    numero(candidato.estagio_horas) > 0
  ) {
    const semExperiencia = meses === 0;
    if (!estagio.so_sem_experiencia || semExperiencia)
      mesesEstagio = Math.floor(
        numero(candidato.estagio_horas) /
          (estagio.horas_por_dia ?? 8) /
          (estagio.dias_por_mes ?? 22),
      );
  }
  const mesesConsiderados =
    estagio.so_sem_experiencia === false
      ? meses + mesesEstagio
      : meses > 0
        ? meses
        : mesesEstagio;
  const pontosDoNivel = doNivel(bloco, candidato.nivel);
  const mesesQuePontuam = Math.max(
    0,
    mesesConsiderados -
      (bloco.desconta_minimo ? numero(bloco.minimo_meses) : 0),
  );
  const bruto =
    (bloco.pontuacao ?? "POR_MES") === "POR_PERIODO"
      ? Math.floor(mesesQuePontuam / numero(bloco.periodo_meses || 1)) *
        numero(pontosDoNivel.pontos_por_periodo)
      : mesesQuePontuam * numero(pontosDoNivel.pontos_por_mes);
  const pontos = comTeto(arredondar(bruto), pontosDoNivel.teto);
  const mesesDoMinimo = bloco.minimo_conta_estagio ? mesesConsiderados : meses;
  const abaixoDoMinimo =
    numero(bloco.minimo_meses) > 0 &&
    mesesDoMinimo < numero(bloco.minimo_meses);
  return {
    dias_total: diasTotal,
    meses,
    meses_estagio: mesesEstagio,
    meses_considerados: mesesConsiderados,
    por_categoria: porCategoria,
    pontos,
    abaixo_do_minimo: abaixoDoMinimo,
  };
}

/** Número no parecer: vírgula decimal, com as casas da regra. */
export function numeroDoParecer(valor, casas = 1) {
  return numero(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

/** Troca os {campos} do modelo; campo desconhecido fica como está. */
export function preencherModelo(modelo, campos) {
  return String(modelo ?? "").replace(/\{([a-z_]+)\}/g, (inteiro, chave) =>
    Object.hasOwn(campos, chave) ? String(campos[chave] ?? "") : inteiro,
  );
}

/**
 * Calcula a avaliação de um candidato pela regra.
 *
 * @param {object} regraEntrada a regra do edital (normalizada aqui)
 * @param {object} candidato o que foi conferido (formato no topo do arquivo)
 * @param {object} [opcoes]
 * @param {number|null} [opcoes.notaMinima] a nota mínima geral da regra de classificação
 * @param {Record<string, number>} [opcoes.notaMinimaPorNivel] a mínima por nível (vale primeiro)
 * @param {string} [opcoes.situacaoPadrao] situação do bloco não lançado ("CONFORME")
 */
export function calcularAvaliacao(regraEntrada, candidato = {}, opcoes = {}) {
  const regra = normalizarRegraAnalise(regraEntrada);
  const situacaoPadrao = opcoes.situacaoPadrao ?? "CONFORME";
  const avaliados = avaliarBlocos(regra, candidato, situacaoPadrao);

  const parciais = {};
  let experiencia = null;
  const eliminatorios = [];
  const encaminhamentos = [];
  const observacoes = [];

  for (const avaliado of avaliados) {
    const { bloco, efeito, motivos } = avaliado;
    const parcial = PARCIAL_DO_TIPO[bloco.tipo];
    if (parcial) {
      let pontos = 0;
      if (bloco.tipo === "PONTUACAO")
        pontos = pontosEtnicos(bloco, avaliado, candidato);
      else if (bloco.tipo === "TITULOS")
        pontos = pontosDosTitulos(bloco, candidato);
      else if (bloco.tipo === "CURSOS")
        pontos = pontosDosCursos(bloco, candidato);
      else if (bloco.tipo === "VINCULOS") {
        experiencia = apurarExperiencia(bloco, candidato);
        pontos = experiencia.pontos;
        if (experiencia.abaixo_do_minimo) {
          const textoMinimo = `não comprovou a experiência profissional mínima de ${bloco.minimo_meses} ${Number(bloco.minimo_meses) === 1 ? "mês" : "meses"}.`;
          if ((bloco.efeito_minimo ?? "ELIMINA") === "ELIMINA")
            eliminatorios.push(
              comItem(bloco.item_minimo || bloco.item_edital, textoMinimo),
            );
          else
            observacoes.push(
              comItem(bloco.item_minimo || bloco.item_edital, textoMinimo),
            );
        }
      }
      if (["ELIMINA", "ZERA_PONTOS"].includes(efeito)) pontos = 0;
      parciais[parcial] = arredondar(pontos);
    }
    if (efeito === "ELIMINA") {
      if (motivos.length)
        for (const m of motivos)
          eliminatorios.push(comItem(m.item_edital, m.texto));
      else
        eliminatorios.push(
          comItem(
            bloco.item_edital,
            `${bloco.titulo} — ${rotuloDe(SITUACOES_DO_BLOCO, avaliado.situacao).toLowerCase()}.`,
          ),
        );
    } else {
      if (
        efeito &&
        efeito.startsWith("ENCAMINHA_") &&
        !encaminhamentos.includes(efeito)
      )
        encaminhamentos.push(efeito);
      if (efeito === "SEGUE_AMPLA" && !encaminhamentos.includes(efeito))
        encaminhamentos.push(efeito);
      for (const m of motivos)
        observacoes.push(comItem(m.item_edital, m.texto));
    }
  }

  for (const codigo of lista(candidato.observacoes_prontas)) {
    const pronta = regra.observacoes_prontas.find((o) => o.codigo === codigo);
    if (pronta) observacoes.push(pronta.texto);
  }
  const livre = String(candidato.observacoes ?? "").trim();
  if (livre) observacoes.push(livre);

  const notaApurada = arredondar(
    Object.values(parciais).reduce((a, b) => a + b, 0),
  );
  const porNivel = opcoes.notaMinimaPorNivel?.[candidato.nivel];
  const notaMinima =
    porNivel !== undefined && porNivel !== null
      ? numero(porNivel)
      : opcoes.notaMinima === null || opcoes.notaMinima === undefined
        ? null
        : numero(opcoes.notaMinima);

  const resultado = eliminatorios.length
    ? "INAPTO_REQUISITO"
    : notaMinima !== null && notaApurada < notaMinima
      ? "INAPTO_NOTA"
      : "APTO";
  const notaFinal = resultado === "INAPTO_REQUISITO" ? 0 : notaApurada;

  const casas = regra.casas_parecer;
  const ordemDosBlocos = regra.blocos
    .map((b) => PARCIAL_DO_TIPO[b.tipo])
    .filter((p) => p && Object.hasOwn(parciais, p));
  const distribuicao = ordemDosBlocos
    .map(
      (p) =>
        `- ${rotuloDe(PARCIAIS, p)}: ${numeroDoParecer(parciais[p], casas)} pontos.`,
    )
    .join("\n");
  const campos = {
    edital: regra.edital_rotulo,
    titulo_etapa: regra.titulo_etapa || TITULO_PADRAO_DA_ETAPA,
    nota: numeroDoParecer(notaFinal, casas),
    corte: notaMinima === null ? "" : numeroDoParecer(notaMinima, 2),
    item_corte: regra.corte.item_edital,
    distribuicao,
    motivos: eliminatorios.map((t) => `- ${t}`).join("\n"),
    observacoes: observacoes.map((t) => `- ${t}`).join("\n"),
  };
  let parecer = preencherModelo(regra.parecer[resultado], campos);
  if (observacoes.length)
    parecer += preencherModelo(regra.parecer.observacoes, campos);

  return {
    resultado,
    nota_apurada: notaApurada,
    nota_final: notaFinal,
    nota_minima: notaMinima,
    parciais,
    blocos: avaliados.map(({ bloco, situacao, efeito, motivos }) => ({
      codigo: bloco.codigo,
      situacao,
      efeito,
      motivos,
    })),
    eliminatorios,
    encaminhamentos,
    observacoes,
    experiencia,
    parecer: parecer.replace(/^\n+/, ""),
  };
}
