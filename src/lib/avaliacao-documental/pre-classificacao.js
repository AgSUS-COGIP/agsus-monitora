/*
  Pré-classificação de uma vaga: a Lista Geral de Classificação Provisória
  por ART (item 8.3.1) e o lote de convocação (item 8.4). Sem DOM e sem estado.

  A conta OFICIAL, em lote, é do job Python (scripts/pre_classificacao/, com
  python/monitora/avaliacao_documental/pre_classificacao.py), que grava o
  resultado pronto em TB_PRE_CLASSIFICACAO. Esta cópia em JavaScript serve à
  prévia da tela (tamanho sugerido do lote, retrato das listas) e é conferida
  com o Python pelos MESMOS casos dourados:
  tests/fixtures/avaliacao-documental/casos-de-pre-classificacao.json
  (tests/lib/avaliacao-documental-pre-classificacao.test.js e
  tests/python/test_pre_classificacao.py). Mudou aqui, muda lá.

  Regras (docs/aya/regras-da-avaliacao-documental.md):
  - eliminação automática pela regra do edital (provisoria.eliminacao_automatica),
    na ordem; quem saiu do arquivo da Empregare e já estava na lista vira
    eliminado ("Saiu do arquivo da Empregare");
  - ordem: ART decrescente (coluna "NOTA - …" da Empregare, "24,0/30,0");
    sem ART, a nota declarada recalculada pela regra, com aviso; depois o
    desempate da regra (provisoria.desempate) e o código do candidato;
  - a nota declarada só confere a ART: divergência além da tolerância é aviso;
  - lote: o tamanho da vaga (lote.por_vaga), o número fixo ou o múltiplo das
    vagas imediatas do quadro (+1 com cadastro reserva, se inclui_cr), geral
    ou por modalidade (ampla primeiro, depois cada cota entre os da cota), com
    os empatados na linha de corte (mesma nota), se a regra mandar;
  - "a linha anda": quem está no lote só sai eliminado; com linha_anda, o
    lugar aberto vai para o próximo da Provisória, num lote novo (reposição),
    com o motivo; ANALISADO (já tem ficha) nunca muda;
  - refazer (só antes das fichas): o lote é recortado do zero.
*/
import { codigosDaModalidade } from "../classificacao/catalogo.js";
import { DESEMPATE_PADRAO_DA_PROVISORIA } from "./catalogo.js";
import {
  calcularNotaDeclarada,
  colunaDaPergunta,
  divergeDaArt,
  lerArt,
  normalizarTexto,
} from "./nota-declarada.js";

export const PREFIXO_DA_ART = "NOTA - ";
export const SAIU_DA_EMPREGARE = Object.freeze({
  codigo: "SAIU_DA_EMPREGARE",
  motivo: "Saiu do arquivo da Empregare",
});

const ehObjeto = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const lista = (v) => (Array.isArray(v) ? v : []);

/** "24" ou "24,5": o número como a lista publica. */
export function numeroNoTexto(n) {
  if (n === null || n === undefined) return "";
  return Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
}

/** A ART das colunas da Empregare: a primeira coluna "NOTA - …" com número. */
export function artDasColunas(colunas) {
  const prefixo = normalizarTexto(PREFIXO_DA_ART);
  for (const coluna of Object.keys(colunas ?? {})) {
    if (!normalizarTexto(coluna).startsWith(prefixo)) continue;
    const art = lerArt(colunas[coluna]);
    if (art !== null) return art;
  }
  return null;
}

function valoresDaFonte(regraDeEliminacao, colunas) {
  const nomes = Object.keys(colunas ?? {});
  if (regraDeEliminacao.coluna) {
    const alvo = normalizarTexto(regraDeEliminacao.coluna);
    return nomes.filter((n) => normalizarTexto(n) === alvo);
  }
  if (regraDeEliminacao.coluna_prefixo) {
    const alvo = normalizarTexto(regraDeEliminacao.coluna_prefixo);
    return nomes.filter((n) => normalizarTexto(n).startsWith(alvo));
  }
  const coluna = colunaDaPergunta(colunas, regraDeEliminacao.pergunta);
  return coluna ? [coluna] : [];
}

/**
 * A eliminação automática de um candidato pela regra: a primeira que vale.
 * Devolve { eliminacao: { codigo, motivo } | null, ausentes: [códigos das
 * regras sem a coluna no arquivo] }.
 */
export function eliminacaoDoCandidato(regra, colunas) {
  const ausentes = [];
  for (const e of lista(regra?.provisoria?.eliminacao_automatica)) {
    const nomes = valoresDaFonte(e, colunas);
    if (!nomes.length) {
      ausentes.push(e.codigo);
      continue;
    }
    const quando = lista(e.quando).map(normalizarTexto);
    const exceto = lista(e.exceto).map(normalizarTexto);
    const elimina = nomes.some((nome) => {
      const valor = normalizarTexto(colunas[nome]);
      if (quando.length && quando.includes(valor)) return true;
      return exceto.length > 0 && !exceto.includes(valor);
    });
    if (elimina)
      return { eliminacao: { codigo: e.codigo, motivo: e.motivo }, ausentes };
  }
  return { eliminacao: null, ausentes };
}

/** A modalidade declarada (bloco MODALIDADE da regra): "PP", "PCD"… ou "AC". */
export function modalidadeDoCandidato(regra, colunas) {
  const bloco = lista(regra?.blocos).find((b) => b?.codigo === "MODALIDADE");
  const pergunta = lista(bloco?.perguntas)[0];
  const coluna = pergunta ? colunaDaPergunta(colunas, pergunta) : null;
  if (!coluna) return "AC";
  const codigos = codigosDaModalidade(colunas[coluna]);
  return codigos.find((c) => c !== "AC") ?? "AC";
}

function numeroDoQuadro(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  const texto = String(valor ?? "")
    .trim()
    .replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(texto)) return null;
  return Number(texto);
}

/** As vagas imediatas por modalidade do quadro ({ "Ampla Concorrência": 2, "PcD": 1 } → { AC: 2, PCD: 1 }); null = sem divisão. */
export function vagasPorModalidade(modalidades) {
  if (!ehObjeto(modalidades)) return null;
  const saida = {};
  let explicitas = false;
  for (const [nome, valor] of Object.entries(modalidades)) {
    const codigo = codigosDaModalidade(nome)[0];
    if (!codigo) continue;
    const n = numeroDoQuadro(valor);
    if (n !== null) explicitas = true;
    saida[codigo] = (saida[codigo] ?? 0) + (n ?? 0);
  }
  return explicitas ? saida : null;
}

const vezes = (multiplo, n) => Math.ceil(multiplo * n - 1e-9);

/**
 * O tamanho do lote de uma vaga.
 *   lote  regra.lote (normalizada)
 *   vaga  { codigo, vagas_imediatas (null sem quadro), cadastro_reserva, modalidades }
 * Devolve { tamanho (null = sem como calcular), descricao, por_modalidade
 * ({ AC: n, PP: m } ou null), aviso (código ou null) }.
 */
export function tamanhoDoLote(lote, vaga) {
  const definido = ehObjeto(lote?.por_vaga)
    ? lote.por_vaga[String(vaga?.codigo ?? "")]
    : undefined;
  if (Number.isInteger(definido) && definido >= 1)
    return {
      tamanho: definido,
      descricao: `${definido} (definido para a vaga)`,
      por_modalidade: null,
      aviso: null,
    };
  if (lote?.base === "FIXO")
    return {
      tamanho: lote.fixo,
      descricao: `${lote.fixo} (número fixo)`,
      por_modalidade: null,
      aviso: null,
    };
  const imediatas = vaga?.vagas_imediatas;
  if (imediatas === null || imediatas === undefined)
    return {
      tamanho: null,
      descricao: "",
      por_modalidade: null,
      aviso: "SEM_QUADRO",
    };
  const cr = lote?.inclui_cr && vaga?.cadastro_reserva ? 1 : 0;
  const base = imediatas + cr;
  if (base <= 0)
    return {
      tamanho: null,
      descricao: "",
      por_modalidade: null,
      aviso: "SEM_VAGAS",
    };
  const multiplo = lote?.multiplo ?? 1;
  const tamanho = vezes(multiplo, base);
  const descricao = cr
    ? `${numeroNoTexto(multiplo)} × (${imediatas} + CR) = ${tamanho}`
    : `${numeroNoTexto(multiplo)} × ${imediatas} = ${tamanho}`;
  if (!lote?.por_modalidade)
    return { tamanho, descricao, por_modalidade: null, aviso: null };
  const porModalidade = vagasPorModalidade(vaga?.modalidades);
  if (!porModalidade)
    return {
      tamanho,
      descricao,
      por_modalidade: null,
      aviso: "QUADRO_SEM_MODALIDADES",
    };
  const tamanhos = { AC: vezes(multiplo, (porModalidade.AC ?? 0) + cr) };
  for (const [codigo, n] of Object.entries(porModalidade))
    if (codigo !== "AC" && n > 0) tamanhos[codigo] = vezes(multiplo, n);
  const total = Object.values(tamanhos).reduce((a, b) => a + b, 0);
  return {
    tamanho: total,
    descricao: `${descricao.replace(/ = \d+$/, "")} por modalidade = ${total}`,
    por_modalidade: tamanhos,
    aviso: null,
  };
}

/** Anos completos entre o nascimento e hoje ("AAAA-MM-DD"); null sem data. */
export function idadeEm(nascimento, hoje) {
  const n = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(nascimento ?? ""));
  const h = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(hoje ?? ""));
  if (!n || !h) return null;
  const [ny, nm, nd] = n.slice(1).map(Number);
  const [hy, hm, hd] = h.slice(1).map(Number);
  return hy - ny - (hm < nm || (hm === nm && hd < nd) ? 1 : 0);
}

const comparaTexto = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
function comparaNulosPorUltimo(a, b, comparar) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return comparar(a, b);
}

function comparador(desempate, hoje) {
  const idoso = (l) => {
    const idade = idadeEm(l.nascimento, hoje);
    return idade !== null && idade >= 60;
  };
  return (a, b) => {
    let r = comparaNulosPorUltimo(a.nota, b.nota, (x, y) => y - x);
    if (r) return r;
    for (const d of desempate) {
      if (d === "IDOSO") {
        const ia = idoso(a);
        const ib = idoso(b);
        if (ia !== ib) return ia ? -1 : 1;
        if (ia) r = comparaTexto(a.nascimento, b.nascimento);
      } else if (d === "MAIS_VELHO")
        r = comparaNulosPorUltimo(a.nascimento, b.nascimento, comparaTexto);
      else if (d === "CANDIDATURA")
        r = comparaNulosPorUltimo(a.candidatura, b.candidatura, comparaTexto);
      if (r) return r;
    }
    return comparaTexto(a.codigo, b.codigo) || comparaTexto(a.id, b.id);
  };
}

const NO_LOTE = new Set(["NO_LOTE", "ANALISADO"]);

/**
 * Pré-classifica os inscritos de uma vaga.
 *   regra        a regra do edital, já normalizada (normalizarRegraAnalise)
 *   vaga         { codigo, vagas_imediatas, cadastro_reserva, modalidades }
 *   candidatos   [{ id, codigo, ativo, colunas, nascimento, candidatura }]
 *   anterior     { [id]: { situacao, lote, lista_lote, entrada, motivo_entrada, posicao } }
 *   ultimo_lote  o maior número de lote já usado na vaga
 *   refazer      recorta o lote do zero (só antes das fichas)
 *   hoje         "AAAA-MM-DD" (idade do desempate)
 * Devolve { linhas, resumo }.
 */
export function preClassificarVaga({
  regra,
  vaga,
  candidatos,
  anterior = {},
  ultimo_lote: ultimoLote = 0,
  refazer = false,
  hoje,
}) {
  const provisoria = regra?.provisoria ?? {};
  const loteDaRegra = regra?.lote ?? {};
  const temDeclarada = lista(provisoria.nota_declarada).length > 0;
  const tolerancia = provisoria.divergencia_tolerancia ?? 0;
  const desempate = Array.isArray(provisoria.desempate)
    ? provisoria.desempate
    : DESEMPATE_PADRAO_DA_PROVISORIA;
  const avisos = new Set();

  const linhas = [];
  for (const c of lista(candidatos)) {
    const ant = anterior?.[c.id] ?? null;
    const colunas = ehObjeto(c.colunas) ? c.colunas : {};
    let eliminacao = null;
    if (ant?.situacao !== "ANALISADO") {
      if (c.ativo === false) {
        if (!ant) continue;
        eliminacao = { ...SAIU_DA_EMPREGARE };
      } else {
        const r = eliminacaoDoCandidato(regra, colunas);
        eliminacao = r.eliminacao;
        for (const codigo of r.ausentes) avisos.add(`COLUNA_AUSENTE:${codigo}`);
      }
    }
    const art = artDasColunas(colunas);
    const declarada = temDeclarada
      ? calcularNotaDeclarada(regra, colunas)
      : null;
    const nota = art ?? declarada?.total ?? null;
    linhas.push({
      id: c.id,
      codigo: String(c.codigo ?? ""),
      nascimento: c.nascimento ?? null,
      candidatura: c.candidatura ?? null,
      situacao: eliminacao ? "ELIMINADO" : "RANQUEADO",
      motivo_codigo: eliminacao?.codigo ?? null,
      motivo: eliminacao?.motivo ?? null,
      art,
      nota,
      origem_nota: art !== null ? "ART" : declarada ? "DECLARADA" : null,
      declarada: declarada ? declarada.total : null,
      declarada_parciais: declarada ? declarada.parciais : null,
      sem_mapa: declarada ? declarada.sem_mapa : 0,
      divergente: declarada
        ? divergeDaArt(art, declarada.total, tolerancia)
        : false,
      modalidade: modalidadeDoCandidato(regra, colunas),
      posicao: null,
      posicao_modalidade: null,
      lote: null,
      lista_lote: null,
      entrada: null,
      motivo_entrada: null,
      _anterior: ant,
    });
  }

  // Provisória: ART decrescente e o desempate da regra.
  const ranqueados = linhas
    .filter((l) => l.situacao !== "ELIMINADO")
    .sort(comparador(desempate, hoje));
  const porModalidade = {};
  ranqueados.forEach((l, i) => {
    l.posicao = i + 1;
    porModalidade[l.modalidade] = (porModalidade[l.modalidade] ?? 0) + 1;
    l.posicao_modalidade = porModalidade[l.modalidade];
  });

  // Lote.
  const t = tamanhoDoLote(loteDaRegra, vaga);
  if (t.aviso) avisos.add(t.aviso);
  const ordemDasListas = t.por_modalidade
    ? ["AC", ...Object.keys(t.por_modalidade).filter((c) => c !== "AC")]
    : ["GERAL"];
  const tamanhoDaLista = (b) =>
    t.por_modalidade ? t.por_modalidade[b] : t.tamanho;
  const cabeNaLista = (l, b) =>
    b === "GERAL" || b === "AC" || l.modalidade === b;
  const listaDoMembro = (l) =>
    ordemDasListas.includes(l.lista_lote) ? l.lista_lote : ordemDasListas[0];

  // Quem já estava no lote e continua (ANALISADO nunca sai).
  const membros = [];
  const saidas = [];
  for (const l of linhas) {
    const ant = l._anterior;
    if (!ant || !NO_LOTE.has(ant.situacao)) continue;
    if (ant.situacao === "ANALISADO") {
      Object.assign(l, {
        situacao: "ANALISADO",
        lote: ant.lote ?? 1,
        lista_lote: ant.lista_lote ?? null,
        entrada: ant.entrada ?? null,
        motivo_entrada: ant.motivo_entrada ?? null,
      });
      membros.push(l);
    } else if (l.situacao === "ELIMINADO") {
      saidas.push(l);
    } else if (!refazer) {
      Object.assign(l, {
        situacao: "NO_LOTE",
        lote: ant.lote ?? 1,
        lista_lote: ant.lista_lote ?? null,
        entrada: ant.entrada ?? null,
        motivo_entrada: ant.motivo_entrada ?? null,
      });
      membros.push(l);
    }
  }
  const herdados = [...membros];
  const inicial =
    refazer ||
    !linhas.some((l) => l._anterior && NO_LOTE.has(l._anterior.situacao));
  saidas.sort(
    (a, b) =>
      (a._anterior.posicao ?? Infinity) - (b._anterior.posicao ?? Infinity) ||
      comparaTexto(a.codigo, b.codigo),
  );

  const maiorLote = Math.max(
    Number(ultimoLote) || 0,
    ...linhas.map((l) => Number(l._anterior?.lote) || 0),
  );
  const numeroNovo = inicial ? 1 : maiorLote + 1;
  let entraram = 0;

  if (t.tamanho !== null && (inicial || loteDaRegra.linha_anda !== false)) {
    for (const b of ordemDasListas) {
      const tamanho = tamanhoDaLista(b);
      const naLista = membros.filter((m) => listaDoMembro(m) === b).length;
      const filaDeSaidas = saidas.filter(
        (s) =>
          (ordemDasListas.includes(s._anterior.lista_lote)
            ? s._anterior.lista_lote
            : ordemDasListas[0]) === b,
      );
      let ocupados = naLista;
      let ultimo = null;
      const entrar = (l, empate) => {
        let entrada;
        let motivo;
        if (inicial) {
          entrada = "INICIAL";
          motivo = empate
            ? `Empatado na linha de corte (nota ${numeroNoTexto(l.nota)})`
            : `Lote inicial: ${t.descricao}`;
        } else if (empate) {
          entrada = ultimo?.entrada ?? "AMPLIACAO";
          motivo = `Empatado na linha de corte (nota ${numeroNoTexto(l.nota)})`;
        } else if (filaDeSaidas.length) {
          const saiu = filaDeSaidas.shift();
          entrada = "REPOSICAO";
          motivo = `Entrou no lugar de ${saiu.codigo} (${saiu.motivo})`;
        } else {
          entrada = "AMPLIACAO";
          motivo = `Entrou para completar o lote (${t.descricao})`;
        }
        Object.assign(l, {
          situacao: "NO_LOTE",
          lote: numeroNovo,
          lista_lote: b,
          entrada,
          motivo_entrada: motivo,
        });
        membros.push(l);
        entraram += 1;
        ultimo = l;
      };
      for (const l of ranqueados) {
        if (ocupados >= tamanho) break;
        if (l.situacao !== "RANQUEADO" || !cabeNaLista(l, b)) continue;
        entrar(l, false);
        ocupados += 1;
      }
      if (loteDaRegra.inclui_empatados && ultimo && ultimo.nota !== null) {
        const nota = ultimo.nota;
        for (const l of ranqueados)
          if (
            l.situacao === "RANQUEADO" &&
            cabeNaLista(l, b) &&
            l.nota === nota
          )
            entrar(l, true);
      }
    }
  }

  if (!inicial && saidas.length && loteDaRegra.linha_anda === false)
    avisos.add("LINHA_PARADA");
  // A regra diminuiu o lote: quem já estava fica (só sai eliminado).
  if (t.tamanho !== null)
    for (const b of ordemDasListas)
      if (
        herdados.filter((m) => listaDoMembro(m) === b).length >
        tamanhoDaLista(b)
      )
        avisos.add("LOTE_ACIMA_DO_TAMANHO");

  const notasDoLote = membros.map((m) => m.nota).filter((n) => n !== null);
  const artCorte = notasDoLote.length ? Math.min(...notasDoLote) : null;
  // Fora do lote com nota acima da linha de corte da lista em que caberia.
  const acima = new Set();
  for (const b of ordemDasListas) {
    const notas = membros
      .filter((m) => listaDoMembro(m) === b && m.nota !== null)
      .map((m) => m.nota);
    if (!notas.length) continue;
    const corte = Math.min(...notas);
    for (const l of ranqueados)
      if (
        l.situacao === "RANQUEADO" &&
        cabeNaLista(l, b) &&
        l.nota !== null &&
        l.nota > corte
      )
        acima.add(l.id);
  }
  const acimaDoCorte = acima.size;
  if (acimaDoCorte) avisos.add("FORA_DO_LOTE_ACIMA_DO_CORTE");
  const semArt = linhas.filter(
    (l) => l.situacao !== "ELIMINADO" && l.art === null,
  ).length;
  if (semArt) avisos.add("ART_AUSENTE");

  for (const l of linhas) delete l._anterior;
  const conta = (f) => linhas.filter(f).length;
  return {
    linhas: linhas.map(({ nascimento, candidatura, ...resto }) => resto),
    resumo: {
      inscritos: linhas.length,
      eliminados: conta((l) => l.situacao === "ELIMINADO"),
      ranqueados: ranqueados.length,
      no_lote: membros.length,
      tamanho: t.tamanho,
      descricao: t.descricao,
      por_modalidade: t.por_modalidade,
      art_corte: artCorte,
      divergencias: conta((l) => l.divergente),
      sem_art: semArt,
      acima_do_corte: acimaDoCorte,
      entraram,
      lote_novo: entraram ? numeroNovo : null,
      saidas: saidas.map((s) => ({
        id: s.id,
        codigo: s.codigo,
        motivo: s.motivo,
      })),
      avisos: [...avisos].sort(),
    },
  };
}
