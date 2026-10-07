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
  - a nota do corte e da ordem (provisoria.base_da_nota, item 8.2.6 do
    93/2026: a pontuação AUTODECLARADA na inscrição):
      DECLARADA (padrão quando a regra tem nota declarada): a nota declarada
        recalculada pela regra, quando a do candidato está COMPLETA; sem ela,
        cai para a ART (aviso SEM_DECLARADA_COMPLETA). A ART (que muda quando
        a equipe ajusta pontos na Empregare) fica só para comparar;
      ART: a coluna "NOTA - …" da Empregare ("24,0/30,0"); sem ART, a nota
        declarada recalculada pela regra, com aviso (ART_AUSENTE);
    depois o desempate da regra (provisoria.desempate: IDOSO,
    EXPERIENCIA_DECLARADA — a faixa respondida em
    provisoria.pergunta_experiencia, em meses —, MAIOR_IDADE ou MAIS_VELHO,
    CANDIDATURA) e o código do candidato;
  - declarada congelada: com `congelar` (a primeira pré-classificação depois
    do fim das inscrições do cronograma, ou sem data de fim: congelaADeclarada)
    a declarada COMPLETA de cada candidato é guardada com as respostas usadas
    (linha.declarada_congelada; o banco grava em TB_PRE_CLASSIFICACAO) e não se
    recalcula mais: com anterior[id].declarada_congelada, vale o valor
    guardado, mesmo que as respostas mudem. A incompleta continua recalculada.
    A coordenação descongela (com motivo) e recalcula;
  - divergência ART × declarada além da tolerância é aviso, e só conta
    quando a declarada do candidato está completa (todo item
    resolvido; ver nota-declarada.js). O item com pontos por nível usa o nível
    da vaga (vaga.nivel, que o job tira do nome do cargo e da regra de
    classificação: nivelDaVaga); sem nível, não soma e vira o aviso
    SEM_NIVEL:NOTA_<parcial>;
  - as perguntas da regra são achadas pelo começo do enunciado (ou do nome da
    coluna; ver nota-declarada.js): a que casa com mais de uma coluna não vale
    e vira o aviso PERGUNTA_AMBIGUA:<de onde>;
  - lote: o tamanho da vaga (lote.por_vaga), o número fixo, a nota mínima
    (NOTA_MINIMA: entram todos os não eliminados com a nota ≥
    lote.nota_minima, como o item 8.2.6 do 93/2026) ou o múltiplo das
    vagas imediatas do quadro (+1 com cadastro reserva, se inclui_cr), geral
    ou por modalidade (ampla primeiro, depois cada cota entre os da cota), com
    os empatados na linha de corte (mesma nota), se a regra mandar;
  - "a linha anda": quem está no lote só sai eliminado; com linha_anda, o
    lugar aberto vai para o próximo da Provisória, num lote novo (reposição),
    com o motivo; ANALISADO (já tem ficha) nunca muda;
  - refazer (só antes das fichas): o lote é recortado do zero;
  - decisão da coordenação (decisoes[id] = { motivo }, de TB_DECISAO_LOTE):
    quem a regra elimina (menos quem saiu da Empregare) ou deixa fora do lote
    fica no lote com a entrada DECISAO e o motivo da decisão, no lote em que
    já estava (ou no último da vaga), sem contar para o tamanho do lote pela
    regra, sem ocupar lugar nem abrir reposição e fora da linha de corte; o
    eliminado ganha posição depois do último da Provisória. Revogada a
    decisão, o candidato volta ao que a regra diz.
*/
import { codigosDaModalidade } from "../classificacao/catalogo.js";
import { dataDeCorteDoCronograma } from "../classificacao/dados.js";
import { DESEMPATE_PADRAO_DA_PROVISORIA } from "./catalogo.js";
import {
  calcularNotaDeclarada,
  chaveDaOpcao,
  colunaDaPergunta,
  divergeDaArt,
  lerArt,
  normalizarTexto,
  perguntaAmbigua,
  textoDaResposta,
} from "./nota-declarada.js";

export const PREFIXO_DA_ART = "NOTA - ";
export const PREFIXO_DO_AVISO_DE_PERGUNTA_AMBIGUA = "PERGUNTA_AMBIGUA:";
export const PREFIXO_DO_AVISO_DE_SEM_NIVEL = "SEM_NIVEL:";
const NIVEIS_DA_VAGA = new Set(["superior", "tecnico", "medio", "fundamental"]);
export const ENTRADA_POR_DECISAO = "DECISAO";
export const SAIU_DA_EMPREGARE = Object.freeze({
  codigo: "SAIU_DA_EMPREGARE",
  motivo: "Saiu do arquivo da Empregare",
});

const ehObjeto = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const lista = (v) => (Array.isArray(v) ? v : []);
const ehNumero = (v) => typeof v === "number" && Number.isFinite(v);

/** "AAAA-MM-DD" do fim das inscrições no cronograma do edital (a etapa de inscrição; com prorrogação, o fim mais tarde), ou null. */
export const fimDasInscricoes = (cronograma) =>
  dataDeCorteDoCronograma(lista(cronograma));

/**
 * Esta pré-classificação congela a nota declarada? Sim depois do fim das
 * inscrições (hoje > fim) ou, sem data de fim no cronograma, já na primeira.
 */
export function congelaADeclarada(hoje, fim) {
  if (!fim) return true;
  const dia = /^\d{4}-\d{2}-\d{2}/.exec(String(hoje ?? ""))?.[0];
  return Boolean(dia) && dia > fim;
}

/** A declarada congelada lida do anterior ({ total, parciais, sem_mapa, respostas }), ou null. */
export function declaradaCongelada(valor) {
  if (!ehObjeto(valor) || !ehNumero(valor.total)) return null;
  return {
    total: valor.total,
    parciais: ehObjeto(valor.parciais) ? valor.parciais : {},
    sem_mapa: Number.isInteger(valor.sem_mapa) ? valor.sem_mapa : 0,
    respostas: lista(valor.respostas),
  };
}

/** O que se guarda ao congelar a declarada: o total, as parciais e as respostas usadas. */
function retratoDaDeclarada(declarada) {
  return {
    total: declarada.total,
    parciais: declarada.parciais,
    sem_mapa: declarada.sem_mapa,
    respostas: declarada.itens
      .filter((i) => i.coluna)
      .map((i) => ({
        parcial: i.parcial,
        coluna: i.coluna,
        resposta: i.resposta,
        pontos: i.pontos,
      })),
  };
}

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
  // Pergunta ambígua: null (nem ausente nem lida; o aviso é PERGUNTA_AMBIGUA).
  if (perguntaAmbigua(colunas, regraDeEliminacao.pergunta)) return null;
  const coluna = colunaDaPergunta(colunas, regraDeEliminacao.pergunta);
  return coluna ? [coluna] : [];
}

/**
 * As perguntas da regra que casam com mais de uma coluna do candidato, como
 * os códigos dos avisos da vaga: PERGUNTA_AMBIGUA:<código da eliminação>,
 * PERGUNTA_AMBIGUA:NOTA_<parcial>, PERGUNTA_AMBIGUA:MODALIDADE e
 * PERGUNTA_AMBIGUA:EXPERIENCIA_DECLARADA (só quando o desempate a usa).
 */
export function perguntasAmbiguas(regra, colunas, perguntaDaExperiencia) {
  const provisoria = regra?.provisoria ?? {};
  const bloco = lista(regra?.blocos).find((b) => b?.codigo === "MODALIDADE");
  const fontes = [
    ...lista(provisoria.eliminacao_automatica)
      .filter((e) => !e?.coluna && !e?.coluna_prefixo)
      .map((e) => [e.codigo, e.pergunta]),
    ...lista(provisoria.nota_declarada).map((i) => [
      `NOTA_${i?.parcial ?? ""}`,
      i?.pergunta,
    ]),
    ["MODALIDADE", lista(bloco?.perguntas)[0]],
    ["EXPERIENCIA_DECLARADA", perguntaDaExperiencia],
  ];
  return fontes
    .filter(([, pergunta]) => pergunta && perguntaAmbigua(colunas, pergunta))
    .map(([codigo]) => `${PREFIXO_DO_AVISO_DE_PERGUNTA_AMBIGUA}${codigo}`);
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
    if (nomes === null) continue;
    if (!nomes.length) {
      ausentes.push(e.codigo);
      continue;
    }
    const quando = lista(e.quando).map(chaveDaOpcao);
    const exceto = lista(e.exceto).map(chaveDaOpcao);
    const elimina = nomes.some((nome) => {
      const valor = chaveDaOpcao(colunas[nome]);
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
 * Os meses de experiência de uma resposta da Empregare ("De 1 a 2 anos" → 12,
 * "Mais de 5 anos" → 60, "6 meses obrigatórios" → 6, "\"1 ano e 6 meses\"" →
 * 18, "4 anos e 2 meses" → 50, "Não possuo" → 0): o limite de baixo da
 * faixa; null quando não dá para ler ("--").
 */
export function mesesDeclarados(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  const texto = normalizarTexto(textoDaResposta(valor));
  if (!texto) return null;
  const anosEMeses = /(\d+) anos? e (\d+) mes(es)?\b/.exec(texto);
  if (anosEMeses) return Number(anosEMeses[1]) * 12 + Number(anosEMeses[2]);
  const numero = /(\d+(?:[.,]\d+)?)/.exec(texto);
  if (!numero)
    return /\b(sem|nenhum|nenhuma|nao possuo|nao tenho)\b/.test(texto)
      ? 0
      : null;
  const n = Number(numero[1].replace(",", "."));
  const unidade = /(ano|mes)/.exec(
    texto.slice(numero.index + numero[0].length),
  );
  return unidade?.[1] === "ano" ? n * 12 : n;
}

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
  if (lote?.base === "NOTA_MINIMA") {
    const minimo =
      typeof lote.nota_minima === "number" && Number.isFinite(lote.nota_minima)
        ? lote.nota_minima
        : null;
    if (minimo === null)
      return {
        tamanho: null,
        descricao: "",
        por_modalidade: null,
        aviso: "SEM_NOTA_MINIMA",
      };
    // O tamanho depende das notas: preClassificarVaga conta quem tem a nota mínima.
    return {
      tamanho: null,
      descricao: `nota ≥ ${numeroNoTexto(minimo)}${lote.item_edital ? ` (item ${lote.item_edital})` : ""}`,
      por_modalidade: null,
      aviso: null,
      nota_minima: minimo,
    };
  }
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
      } else if (d === "EXPERIENCIA_DECLARADA")
        r = comparaNulosPorUltimo(
          a.experiencia,
          b.experiencia,
          (x, y) => y - x,
        );
      else if (d === "MAIS_VELHO" || d === "MAIOR_IDADE")
        r = comparaNulosPorUltimo(a.nascimento, b.nascimento, comparaTexto);
      else if (d === "CANDIDATURA")
        r = comparaNulosPorUltimo(a.candidatura, b.candidatura, comparaTexto);
      if (r) return r;
    }
    return comparaTexto(a.codigo, b.codigo) || comparaTexto(a.id, b.id);
  };
}

const NO_LOTE = new Set(["NO_LOTE", "ANALISADO"]);

/** O motivo da decisão vigente da coordenação para o candidato ({ [id]: { motivo } }), ou null. */
export function motivoDaDecisao(decisoes, id) {
  const motivo = ehObjeto(decisoes) ? decisoes[id]?.motivo : null;
  return typeof motivo === "string" && motivo.trim() ? motivo.trim() : null;
}

/** Entrou no lote pela regra (a anterior), e não por decisão da coordenação. */
const peloLoteDaRegra = (ant) =>
  Boolean(ant) &&
  NO_LOTE.has(ant.situacao) &&
  (ant.situacao === "ANALISADO" || ant.entrada !== ENTRADA_POR_DECISAO);

/**
 * Pré-classifica os inscritos de uma vaga.
 *   regra        a regra do edital, já normalizada (normalizarRegraAnalise)
 *   vaga         { codigo, vagas_imediatas, cadastro_reserva, modalidades, nivel }
 *                (nivel: o da vaga, para a nota declarada por nível; null = desconhecido)
 *   candidatos   [{ id, codigo, ativo, colunas, nascimento, candidatura }]
 *   anterior     { [id]: { situacao, lote, lista_lote, entrada, motivo_entrada, posicao,
 *                  declarada_congelada } } (declarada_congelada: o valor guardado, que não se recalcula)
 *   ultimo_lote  o maior número de lote já usado na vaga
 *   refazer      recorta o lote do zero (só antes das fichas)
 *   hoje         "AAAA-MM-DD" (idade do desempate)
 *   congelar     guarda a declarada completa de quem ainda não a tem congelada (congelaADeclarada)
 *   decisoes     { [id]: { motivo } }: as decisões vigentes da coordenação (ficam no lote, entrada DECISAO)
 * Devolve { linhas, resumo } (resumo.no_lote: pela regra; resumo.por_decisao: por decisão).
 */
export function preClassificarVaga({
  regra,
  vaga,
  candidatos,
  anterior = {},
  ultimo_lote: ultimoLote = 0,
  refazer = false,
  hoje,
  congelar = false,
  decisoes = {},
}) {
  const provisoria = regra?.provisoria ?? {};
  const loteDaRegra = regra?.lote ?? {};
  const temDeclarada = lista(provisoria.nota_declarada).length > 0;
  // Corte e ordem pela declarada (padrão com nota declarada) ou pela ART.
  const pelaDeclarada =
    temDeclarada && (provisoria.base_da_nota ?? "DECLARADA") === "DECLARADA";
  const tolerancia = provisoria.divergencia_tolerancia ?? 0;
  const desempate = Array.isArray(provisoria.desempate)
    ? provisoria.desempate
    : DESEMPATE_PADRAO_DA_PROVISORIA;
  const avisos = new Set();
  const perguntaDaExperiencia = desempate.includes("EXPERIENCIA_DECLARADA")
    ? provisoria.pergunta_experiencia
    : null;
  const nivel = NIVEIS_DA_VAGA.has(vaga?.nivel) ? vaga.nivel : null;

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
    for (const aviso of perguntasAmbiguas(
      regra,
      colunas,
      perguntaDaExperiencia,
    ))
      avisos.add(aviso);
    const art = artDasColunas(colunas);
    // A declarada congelada vale como está; senão, recalculada pelas respostas.
    const guardada = temDeclarada
      ? declaradaCongelada(ant?.declarada_congelada)
      : null;
    const declarada = guardada
      ? { ...guardada, completa: true, itens: [] }
      : temDeclarada
        ? calcularNotaDeclarada(regra, colunas, nivel)
        : null;
    const congelada =
      guardada ??
      (congelar && declarada?.completa ? retratoDaDeclarada(declarada) : null);
    for (const item of declarada?.itens ?? [])
      if (item.nivel_desconhecido)
        avisos.add(
          `${PREFIXO_DO_AVISO_DE_SEM_NIVEL}NOTA_${item.parcial ?? ""}`,
        );
    const pelaBase = pelaDeclarada && declarada?.completa === true;
    const nota = pelaBase ? declarada.total : (art ?? declarada?.total ?? null);
    const colunaDaExperiencia = perguntaDaExperiencia
      ? colunaDaPergunta(colunas, perguntaDaExperiencia)
      : null;
    linhas.push({
      id: c.id,
      codigo: String(c.codigo ?? ""),
      nascimento: c.nascimento ?? null,
      candidatura: c.candidatura ?? null,
      experiencia: colunaDaExperiencia
        ? mesesDeclarados(colunas[colunaDaExperiencia])
        : null,
      situacao: eliminacao ? "ELIMINADO" : "RANQUEADO",
      motivo_codigo: eliminacao?.codigo ?? null,
      motivo: eliminacao?.motivo ?? null,
      art,
      nota,
      origem_nota: pelaBase
        ? "DECLARADA"
        : art !== null
          ? "ART"
          : declarada
            ? "DECLARADA"
            : null,
      declarada: declarada ? declarada.total : null,
      declarada_parciais: declarada ? declarada.parciais : null,
      declarada_completa: declarada ? declarada.completa : null,
      declarada_congelada: congelada,
      sem_mapa: declarada ? declarada.sem_mapa : 0,
      _fora_da_base: pelaDeclarada && !pelaBase,
      // Só a declarada completa confere a ART (a incompleta não diverge).
      divergente: declarada?.completa
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

  // Provisória: ART decrescente e o desempate da regra; depois do último, os
  // eliminados pela regra que ficam no lote por decisão da coordenação.
  const ordem = comparador(desempate, hoje);
  const ranqueados = linhas
    .filter((l) => l.situacao !== "ELIMINADO")
    .sort(ordem);
  const eliminadosPorDecisao = linhas
    .filter(
      (l) =>
        l.situacao === "ELIMINADO" &&
        l.motivo_codigo !== SAIU_DA_EMPREGARE.codigo &&
        motivoDaDecisao(decisoes, l.id),
    )
    .sort(ordem);
  const porModalidade = {};
  [...ranqueados, ...eliminadosPorDecisao].forEach((l, i) => {
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

  // Quem já estava no lote e continua (ANALISADO nunca sai). Quem entrou por
  // decisão da coordenação não é do lote da regra (ver as decisões, abaixo).
  const membros = [];
  const porDecisao = [];
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
      (ant.entrada === ENTRADA_POR_DECISAO ? porDecisao : membros).push(l);
    } else if (!peloLoteDaRegra(ant)) {
      continue;
    } else if (l.situacao === "ELIMINADO" && motivoDaDecisao(decisoes, l.id)) {
      // Eliminado pela regra, mas fica no lote por decisão (sem abrir reposição).
      if (l.motivo_codigo === SAIU_DA_EMPREGARE.codigo) saidas.push(l);
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
  // Quem já está no lote por decisão (vigente, ou já analisado) fica por
  // decisão: não entra pela regra nem conta para o tamanho dela.
  const fixoPorDecisao = (l) =>
    l._anterior?.entrada === ENTRADA_POR_DECISAO &&
    (l._anterior.situacao === "ANALISADO" ||
      (l._anterior.situacao === "NO_LOTE" &&
        motivoDaDecisao(decisoes, l.id) !== null));
  // Lote pela nota mínima: entram todos com a nota mínima (quem já estava fica).
  const notaMinima = t.nota_minima ?? null;
  const temNotaMinima = (l) => l.nota !== null && l.nota >= notaMinima;
  if (notaMinima !== null) {
    t.tamanho =
      ranqueados.filter((l) => temNotaMinima(l) && !fixoPorDecisao(l)).length +
      membros.filter((m) => !temNotaMinima(m)).length;
    t.descricao = `${t.descricao} = ${t.tamanho}`;
  }
  const inicial = refazer || !linhas.some((l) => peloLoteDaRegra(l._anterior));
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
        if (fixoPorDecisao(l)) continue;
        if (notaMinima !== null && !temNotaMinima(l)) continue;
        entrar(l, false);
        ocupados += 1;
      }
      if (loteDaRegra.inclui_empatados && ultimo && ultimo.nota !== null) {
        const nota = ultimo.nota;
        for (const l of ranqueados)
          if (
            l.situacao === "RANQUEADO" &&
            cabeNaLista(l, b) &&
            l.nota === nota &&
            !fixoPorDecisao(l)
          )
            entrar(l, true);
      }
    }
  }

  // Decisões da coordenação: no lote mesmo que a regra elimine ou deixe fora.
  const ultimoLoteDaVaga = Math.max(1, maiorLote, entraram ? numeroNovo : 0);
  for (const l of linhas) {
    const motivo = motivoDaDecisao(decisoes, l.id);
    if (!motivo || l.situacao === "NO_LOTE" || l.situacao === "ANALISADO")
      continue;
    if (l.motivo_codigo === SAIU_DA_EMPREGARE.codigo) {
      avisos.add("DECISAO_SAIU_DA_EMPREGARE");
      continue;
    }
    const ant = l._anterior;
    const estava = ant?.situacao === "NO_LOTE" && Number(ant.lote) >= 1;
    const listaDaModalidade = ordemDasListas.includes(l.modalidade)
      ? l.modalidade
      : ordemDasListas[0];
    Object.assign(l, {
      situacao: "NO_LOTE",
      motivo_codigo: null,
      motivo: null,
      lote: estava ? Number(ant.lote) : ultimoLoteDaVaga,
      lista_lote:
        estava && ordemDasListas.includes(ant.lista_lote)
          ? ant.lista_lote
          : listaDaModalidade,
      entrada: ENTRADA_POR_DECISAO,
      motivo_entrada: motivo,
    });
    porDecisao.push(l);
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
  // Sem ART só pesa para quem a nota não veio da declarada completa.
  if (
    linhas.some(
      (l) =>
        l.situacao !== "ELIMINADO" &&
        l.art === null &&
        !(pelaDeclarada && l.declarada_completa),
    )
  )
    avisos.add("ART_AUSENTE");
  const pelaArt = linhas.filter(
    (l) => l.situacao !== "ELIMINADO" && l._fora_da_base,
  ).length;
  if (pelaArt) avisos.add("SEM_DECLARADA_COMPLETA");

  for (const l of linhas) {
    delete l._anterior;
    delete l._fora_da_base;
  }
  const conta = (f) => linhas.filter(f).length;
  return {
    linhas: linhas.map(
      ({ nascimento, candidatura, experiencia, ...resto }) => resto,
    ),
    resumo: {
      inscritos: linhas.length,
      eliminados: conta((l) => l.situacao === "ELIMINADO"),
      ranqueados: ranqueados.length,
      no_lote: membros.length,
      por_decisao: porDecisao.length,
      tamanho: t.tamanho,
      descricao: t.descricao,
      por_modalidade: t.por_modalidade,
      art_corte: artCorte,
      base_da_nota: pelaDeclarada ? "DECLARADA" : "ART",
      pela_art: pelaArt,
      congeladas: conta((l) => l.declarada_congelada !== null),
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
