/*
  O motor da classificação: lógica pura, sem DOM e sem banco.

  Entrada: os candidatos do edital (análise curricular), as entrevistas (ligadas
  à análise SÓ por CO_ANALISE_CURRICULAR — nunca pelo nome), o quadro de vagas,
  a regra do edital, a data de corte da idade e os desempates já registrados
  (sorteio ou decisão manual).

  Saída, por vaga: elegíveis × eliminados (com motivo padronizado), nota final,
  posição na lista geral e em cada modalidade, a situação (dentro das vagas ou
  cadastro reserva) e, para cada candidato, a EXPLICAÇÃO da posição; e, no topo,
  os avisos (entrevista sem análise, candidato convocado sem entrevista, dado
  que falta para um critério, empate que espera sorteio…).

  Três listas (`tipo`):
    PRELIMINAR  avaliação documental: quem passou na documental, pela nota
                documental.
    CONVOCACAO  os primeiros da preliminar até o limite da regra (N × vagas
                imediatas, ou até a k-ésima posição no cadastro reserva).
    FINAL       quem passou na documental e na entrevista, pela nota composta
                (pesos e arredondamento da regra).

  O empate: primeiro a nota (na escala das casas publicadas); depois, se a regra
  manda usar critérios naquela lista, os critérios na ordem da regra; o que
  sobrar, pelo método do empate final que o gestor escolheu (sorteio
  registrado, ordem de inscrição, mesma posição ou decisão manual).
*/
import {
  CRITERIO_POR_CODIGO,
  MOTIVOS_DE_ELIMINACAO,
  codigosDaModalidade,
  semAcento,
  simOuNao,
} from "./catalogo.js";
import { arredondar, escalar, formatarNota, numeroBR } from "./numeros.js";
import { normalizarRegra } from "./regra.js";
import { chaveDoGrupo } from "./sorteio.js";
import { montarVagas, nivelDaVaga } from "./vagas.js";

const texto = (valor) => String(valor ?? "").trim();
const comparaNome = (a, b) =>
  a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }) ||
  (a.analiseId < b.analiseId ? -1 : a.analiseId > b.analiseId ? 1 : 0);

/* ── Entrada ────────────────────────────────────────────────────────── */

function lerNumero(bruto, campo, c, avisos) {
  const n = numeroBR(bruto);
  if (n === null && texto(bruto))
    avisos.push({
      codigo: "NUMERO_INVALIDO",
      tom: "danger",
      vaga: c.vaga,
      analiseId: c.analiseId,
      texto: `${c.nome}: "${texto(bruto)}" em ${campo} não é número.`,
    });
  return n;
}

/** Os candidatos do RPC no formato do motor (números pt-BR, modalidades em código). */
export function prepararCandidatos(brutos = [], avisos = []) {
  const vistos = new Set();
  const candidatos = [];
  for (const b of brutos || []) {
    const analiseId = texto(b?.analise_id ?? b?.analiseId);
    if (!analiseId || vistos.has(analiseId)) continue;
    vistos.add(analiseId);
    const c = {
      analiseId,
      codigo: texto(b.codigo),
      nome: texto(b.nome ?? b.candidato) || "(sem nome)",
      vaga: texto(b.vaga),
      cargo: texto(b.cargo),
      categoria: texto(b.categoria),
      modalidadeTexto: texto(b.modalidade),
      pcd: simOuNao(b.pcd),
      dataNascimento: texto(b.data_nascimento ?? b.dataNascimento),
      status: texto(b.status),
      etapa: texto(b.etapa),
      quadroId: texto(b.quadro ?? b.quadroId),
    };
    const ler = (campo, rotulo) => lerNumero(b[campo], rotulo, c, avisos);
    c.notaDocumental = ler("nota_documental", "nota documental");
    c.notaArt = ler("nota_art", "nota ART");
    c.pontuacaoFormacao = ler("pontuacao_formacao", "pontuação de formação");
    c.pontuacaoCursos = ler("pontuacao_cursos", "pontuação de cursos");
    c.pontuacaoExperiencia = ler(
      "pontuacao_experiencia",
      "pontuação de experiência",
    );
    c.pontuacaoEtnica = ler("pontuacao_etnica", "pontuação étnica");
    c.expSaudeIndigena = ler(
      "exp_saude_indigena",
      "experiência na saúde indígena",
    );
    c.expAtencaoBasica = ler(
      "exp_atencao_basica",
      "experiência na atenção básica",
    );
    c.expProfissional = ler("exp_profissional", "experiência profissional");
    const codigos = codigosDaModalidade(c.modalidadeTexto);
    if (c.pcd && !codigos.includes("PCD")) codigos.push("PCD");
    c.modalidadeIdentificada = codigos.length > 0;
    if (!codigos.includes("AC") && !codigos.some((m) => m !== "AC"))
      codigos.unshift("AC");
    c.modalidades = codigos;
    candidatos.push(c);
  }
  return candidatos;
}

/*
  As entrevistas ligadas à análise pelo id. Entrevista sem análise vira aviso
  (o Apps Script antigo juntava pelo nome e o candidato sumia sem aviso).
*/
export function ligarEntrevistas(candidatos, brutas = [], avisos = []) {
  const porAnalise = new Map(candidatos.map((c) => [c.analiseId, c]));
  const escolhidas = new Map();
  for (const b of brutas || []) {
    const analiseId = texto(b?.analise_id ?? b?.analiseId);
    const e = {
      id: texto(b.id),
      analiseId,
      nome: texto(b.nome ?? b.candidato),
      vaga: texto(b.vaga),
      nota: numeroBR(b.nota),
      notaBruta: b.nota,
      parecer: texto(b.parecer).toUpperCase() || "SEM_PARECER",
      compareceu: texto(b.compareceu).toUpperCase() || null,
      ligacao: texto(b.ligacao),
      origem: texto(b.origem) || "planilha",
      notas: (Array.isArray(b.notas) ? b.notas : [])
        .map((n) =>
          Array.isArray(n)
            ? {
                ordem: Number(n[0]),
                criterio: texto(n[2]),
                nota: numeroBR(n[1]),
              }
            : {
                ordem: Number(n?.ordem),
                criterio: texto(n?.criterio),
                nota: numeroBR(n?.nota),
              },
        )
        .filter((n) => Number.isFinite(n.ordem)),
    };
    if (!analiseId || !porAnalise.has(analiseId)) {
      avisos.push({
        codigo: "ENTREVISTA_SEM_ANALISE",
        tom: "warning",
        vaga: e.vaga,
        texto: `Entrevista de ${e.nome || "(sem nome)"} (vaga ${e.vaga || "—"}) sem análise curricular ligada: fica fora da classificação.`,
      });
      continue;
    }
    const c = porAnalise.get(analiseId);
    if (e.nota === null && texto(b.nota))
      avisos.push({
        codigo: "NUMERO_INVALIDO",
        tom: "danger",
        vaga: c.vaga,
        analiseId,
        texto: `${c.nome}: nota da entrevista "${texto(b.nota)}" não é número.`,
      });
    if (e.ligacao === "nome")
      avisos.push({
        codigo: "ENTREVISTA_PELO_NOME",
        tom: "info",
        vaga: c.vaga,
        analiseId,
        texto: `${c.nome}: a entrevista foi ligada à análise pelo nome na carga da planilha; confira.`,
      });
    const atual = escolhidas.get(analiseId);
    if (atual) {
      avisos.push({
        codigo: "ENTREVISTA_REPETIDA",
        tom: "warning",
        vaga: c.vaga,
        analiseId,
        texto: `${c.nome}: mais de uma entrevista lançada; vale a do sistema (ou a de parecer definido).`,
      });
      const peso = (x) =>
        (x.origem === "sistema" ? 2 : 0) +
        (x.parecer !== "SEM_PARECER" ? 1 : 0);
      if (peso(e) > peso(atual) || (peso(e) === peso(atual) && e.id > atual.id))
        escolhidas.set(analiseId, e);
    } else escolhidas.set(analiseId, e);
  }
  for (const c of candidatos) {
    c.entrevista = escolhidas.get(c.analiseId) || null;
    c.notaEntrevista = c.entrevista?.nota ?? null;
  }
  return candidatos;
}

/* ── Etapas ─────────────────────────────────────────────────────────── */

function situacaoApta(c, regra) {
  const aptas = regra.documental.situacoes_aptas.map(semAcento);
  if (!aptas.length) return true;
  return [c.status, c.etapa].some((s) => s && aptas.includes(semAcento(s)));
}

/** A eliminação na documental, ou null. Avisos de nível desconhecido vão por vaga. */
function eliminacaoDocumental(c, regra, ctx) {
  if (!regra.etapas.documental) return null;
  if (!situacaoApta(c, regra))
    return {
      motivo: "NAO_HABILITADO",
      detalhe: `Situação na análise: ${c.status || c.etapa || "não informada"}.`,
    };
  if (c.notaDocumental === null)
    return { motivo: "SEM_NOTA_DOCUMENTAL", detalhe: "" };
  const porNivel = regra.documental.nota_minima_por_nivel;
  let minimo = regra.documental.nota_minima;
  let nivel = null;
  if (Object.keys(porNivel).length) {
    nivel = nivelDaVaga(c, regra);
    if (nivel && porNivel[nivel] !== undefined) minimo = porNivel[nivel];
    else if (!nivel) ctx.nivelDesconhecido.add(c.vaga);
  }
  if (minimo !== null && escalar(c.notaDocumental, 4) < escalar(minimo, 4))
    return {
      motivo: "ABAIXO_NOTA_MINIMA_DOCUMENTAL",
      detalhe: `Nota ${formatarNota(c.notaDocumental, ctx.casas)}; mínimo ${formatarNota(minimo, ctx.casas)}${nivel ? ` (${nivel})` : ""}.`,
    };
  return null;
}

function eliminacaoEntrevista(c, regra, ctx) {
  if (!regra.etapas.entrevista) return null;
  const e = c.entrevista;
  const ent = regra.entrevista;
  if (!e) return { motivo: "SEM_ENTREVISTA", detalhe: "" };
  if (ent.exige_comparecimento && e.compareceu === "N")
    return { motivo: "AUSENTE", detalhe: "" };
  if (ent.inapto_elimina && e.parecer === "INAPTO")
    return { motivo: "INAPTO_ENTREVISTA", detalhe: "" };
  if (e.nota === null) return { motivo: "SEM_NOTA_ENTREVISTA", detalhe: "" };
  if (
    ent.nota_minima !== null &&
    escalar(e.nota, 4) < escalar(ent.nota_minima, 4)
  )
    return {
      motivo: "ABAIXO_NOTA_MINIMA_ENTREVISTA",
      detalhe: `Nota ${formatarNota(e.nota, ctx.casas)}; mínimo ${formatarNota(ent.nota_minima, ctx.casas)}.`,
    };
  const exigeCompetencia =
    ent.nota_minima_competencia !== null ||
    ent.nota_eliminatoria_ate !== null ||
    ent.competencias.some((x) => x.minimo !== null);
  if (exigeCompetencia && !e.notas.some((n) => n.nota !== null))
    ctx.avisos.push({
      codigo: "SEM_NOTAS_COMPETENCIA",
      tom: "warning",
      vaga: c.vaga,
      analiseId: c.analiseId,
      texto: `${c.nome}: a entrevista não tem as notas por competência; o mínimo por competência não foi conferido.`,
    });
  for (const n of e.notas) {
    if (n.nota === null) continue;
    const comp = ent.competencias.find((x) => x.ordem === n.ordem);
    const nome = comp?.nome || n.criterio || `Competência ${n.ordem}`;
    if (
      ent.nota_eliminatoria_ate !== null &&
      escalar(n.nota, 4) <= escalar(ent.nota_eliminatoria_ate, 4)
    )
      return {
        motivo: "COMPETENCIA_ELIMINATORIA",
        detalhe: `${nome}: ${formatarNota(n.nota, ctx.casas)} (elimina até ${formatarNota(ent.nota_eliminatoria_ate, ctx.casas)}).`,
      };
    const minimo = comp?.minimo ?? ent.nota_minima_competencia;
    if (minimo !== null && escalar(n.nota, 4) < escalar(minimo, 4))
      return {
        motivo: "COMPETENCIA_ABAIXO_MINIMO",
        detalhe: `${nome}: ${formatarNota(n.nota, ctx.casas)} (mínimo ${formatarNota(minimo, ctx.casas)}).`,
      };
  }
  return null;
}

/** A nota final pela composição da regra (pesos e arredondamento). */
export function notaComposta(c, regra) {
  const { componentes, casas, arredondamento } = regra.composicao;
  const valores = {
    DOCUMENTAL: c.notaDocumental,
    ENTREVISTA: c.notaEntrevista,
    ART: c.notaArt,
  };
  let soma = 0;
  const partes = [];
  const faltando = [];
  for (const { codigo, peso } of componentes) {
    const v = valores[codigo];
    if (v === null || v === undefined) {
      faltando.push(codigo);
      continue;
    }
    soma += v * peso;
    partes.push({ codigo, valor: v, peso });
  }
  return { nota: arredondar(soma, casas, arredondamento), partes, faltando };
}

/* ── Ordenação e empate ─────────────────────────────────────────────── */

function valorDoCriterio(c, criterio, ctx) {
  const v = CRITERIO_POR_CODIGO[criterio]?.ler(c, ctx);
  return v === undefined ? null : v;
}

/* Nulo perde sempre (vai depois), qualquer que seja a direção. */
export function compararValores(a, b, direcao) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const x = typeof a === "boolean" ? Number(a) : a;
  const y = typeof b === "boolean" ? Number(b) : b;
  if (Math.abs(x - y) < 1e-9) return 0;
  const maiorPrimeiro =
    direcao === "SIM_PRIMEIRO" || direcao === "MAIOR_PRIMEIRO";
  return maiorPrimeiro ? (y > x ? 1 : -1) : x > y ? 1 : -1;
}

function descreverValor(valor, criterio) {
  if (valor === null) return "sem dado";
  if (typeof valor === "boolean") return valor ? "sim" : "não";
  if (criterio === "MAIOR_IDADE") return `${Math.floor(valor / 365.25)} anos`;
  return formatarNota(valor, Number.isInteger(valor) ? 0 : 2);
}

/** O primeiro critério que separa a e b: `{ criterio, direcao, va, vb, sinal }` ou null. */
function primeiroQueSepara(a, b, criterios, ctx) {
  for (const { criterio, direcao } of criterios) {
    const va = valorDoCriterio(a, criterio, ctx);
    const vb = valorDoCriterio(b, criterio, ctx);
    const sinal = compararValores(va, vb, direcao);
    if (sinal !== 0) return { criterio, direcao, va, vb, sinal };
  }
  return null;
}

function codigoDeInscricao(c) {
  const n = numeroBR(c.codigo);
  return n === null ? null : n;
}

/*
  A ordem de UMA vaga: blocos de quem fica na mesma posição. Cada bloco diz
  como foi resolvido (único, critérios, sorteio, manual, inscrição, mesma
  posição ou pendente).
*/
function ordenarVaga(elegiveis, { usarCriterios, tipo, vaga, ctx }) {
  const { criterios, regra, desempates } = ctx;
  const porNota = new Map();
  for (const c of elegiveis) {
    const k = escalar(c.nota, ctx.casas);
    if (!porNota.has(k)) porNota.set(k, []);
    porNota.get(k).push(c);
  }
  const blocos = [];
  for (const k of [...porNota.keys()].sort((a, b) => b - a)) {
    const grupo = porNota.get(k).sort(comparaNome);
    for (const c of grupo) c.grupoDaNota = grupo;
    if (grupo.length === 1) {
      blocos.push({ membros: grupo, resolucao: "UNICO" });
      continue;
    }
    if (!usarCriterios) {
      blocos.push({ membros: grupo, resolucao: "MESMA_POSICAO_LISTA" });
      continue;
    }
    const ordenado = [...grupo].sort((a, b) => {
      const s = primeiroQueSepara(a, b, criterios, ctx);
      return s ? s.sinal : comparaNome(a, b);
    });
    // Blocos de quem empata em todos os critérios.
    const subs = [];
    for (const c of ordenado) {
      const ultimo = subs.at(-1);
      if (ultimo && !primeiroQueSepara(ultimo[0], c, criterios, ctx))
        ultimo.push(c);
      else subs.push([c]);
    }
    for (const sub of subs) {
      if (sub.length === 1) {
        blocos.push({ membros: sub, resolucao: "CRITERIOS" });
        continue;
      }
      blocos.push(
        ...resolverEmpateFinal(sub, { tipo, vaga, regra, desempates, ctx }),
      );
    }
  }
  return blocos;
}

function resolverEmpateFinal(sub, { tipo, vaga, regra, desempates, ctx }) {
  const metodo = regra.empate_final.metodo;
  const ids = sub.map((c) => c.analiseId);
  const chave = chaveDoGrupo(tipo, vaga, ids);
  if (metodo === "MESMA_POSICAO")
    return [{ membros: sub, resolucao: "MESMA_POSICAO", chave }];
  if (metodo === "ORDEM_INSCRICAO") {
    const com = sub.filter((c) => codigoDeInscricao(c) !== null);
    const sem = sub.filter((c) => codigoDeInscricao(c) === null);
    for (const c of sem)
      ctx.avisos.push({
        codigo: "INSCRICAO_SEM_CODIGO",
        tom: "warning",
        vaga,
        analiseId: c.analiseId,
        texto: `${c.nome}: sem código de inscrição numérico; fica empatado depois dos que têm.`,
      });
    const blocos = [];
    for (const c of com.sort(
      (a, b) =>
        codigoDeInscricao(a) - codigoDeInscricao(b) || comparaNome(a, b),
    )) {
      const ultimo = blocos.at(-1);
      if (
        ultimo &&
        codigoDeInscricao(ultimo.membros[0]) === codigoDeInscricao(c)
      ) {
        ultimo.membros.push(c);
        ultimo.resolucao = "MESMA_POSICAO";
      } else blocos.push({ membros: [c], resolucao: "INSCRICAO", chave });
    }
    if (sem.length)
      blocos.push({
        membros: sem,
        resolucao: sem.length > 1 ? "MESMA_POSICAO" : "INSCRICAO",
        chave,
      });
    return blocos;
  }
  // Sorteio ou decisão manual: vale o registro do mesmo grupo (mesma chave).
  const metodoDoRegistro = metodo === "SORTEIO" ? "SORTEIO" : "MANUAL";
  const registro = desempates.find(
    (d) => d.chave === chave && d.metodo === metodoDoRegistro,
  );
  if (registro) {
    ctx.desempatesUsados.add(registro.id || chave);
    const ordem = registro.ordem.map(String);
    const membros = [...sub].sort(
      (a, b) => ordem.indexOf(a.analiseId) - ordem.indexOf(b.analiseId),
    );
    return membros.map((c) => ({
      membros: [c],
      resolucao: metodoDoRegistro,
      chave,
      registro,
    }));
  }
  return [
    { membros: sub, resolucao: "PENDENTE", chave, metodo: metodoDoRegistro },
  ];
}

/** Posições de uma lista (membros filtrados dos blocos), na numeração da regra. */
function numerar(blocos, pertence, numeracao) {
  const linhas = [];
  let contador = 0;
  let antes = 0;
  for (const bloco of blocos) {
    const membros = bloco.membros.filter(pertence);
    if (!membros.length) continue;
    contador += 1;
    const posicao = numeracao === "SALTANDO" ? antes + 1 : contador;
    for (const c of membros)
      linhas.push({ c, posicao, bloco, empatados: membros.length });
    antes += membros.length;
  }
  return linhas;
}

/* ── Modalidades, acúmulo e vagas ───────────────────────────────────── */

function modalidadesNaLista(c, tipo, regra, ordemDoUniverso) {
  const conhecidas = new Set(regra.modalidades.map((m) => m.codigo));
  let cods = c.modalidades.filter((m) => conhecidas.has(m) || m === "AC");
  if (tipo !== "FINAL" || regra.cotas.acumulo === "TODAS") return cods;
  const cotas = cods.filter((m) => m !== "AC");
  if (cotas.length < 2) return cods;
  const pct = (m) =>
    regra.modalidades.find((x) => x.codigo === m)?.percentual ?? 0;
  const melhor = (lista) =>
    [...lista].sort(
      (a, b) =>
        pct(b) - pct(a) ||
        ordemDoUniverso.posicaoEm(c, a) - ordemDoUniverso.posicaoEm(c, b),
    )[0];
  let ficam;
  if (regra.cotas.acumulo === "PCD_MAIS_UMA") {
    const outras = cotas.filter((m) => m !== "PCD");
    ficam = [
      ...(cotas.includes("PCD") ? ["PCD"] : []),
      ...(outras.length ? [melhor(outras)] : []),
    ];
  } else ficam = [melhor(cotas)];
  return cods.filter((m) => m === "AC" || ficam.includes(m));
}

function naGeral(c, regra) {
  if (c.modalidadesNaLista.includes("AC")) return true;
  return c.modalidadesNaLista.some(
    (m) =>
      regra.modalidades.find((x) => x.codigo === m)?.aparece_na_geral !== false,
  );
}

/*
  Quem fica dentro das vagas na lista final: a ampla com os primeiros da geral;
  cada reserva com os primeiros da modalidade que ainda não entraram; reserva
  que sobra vai para o destino da regra (remanejar_para) e, por fim, para a
  ampla. Devolve analiseId → { situacao, modalidade }.
*/
function alocarVagas(vaga, geral, porModalidade, regra, ctx) {
  const resultado = new Map();
  if (!vaga.porModalidade) return resultado;
  const lugares = { ...vaga.porModalidade };
  const ocupados = new Set();
  const ocupar = (linhas, codigo, quantos) => {
    let usados = 0;
    let i = 0;
    while (i < linhas.length && usados < quantos) {
      const { c, bloco } = linhas[i];
      if (ocupados.has(c.analiseId)) {
        i += 1;
        continue;
      }
      const empatados = linhas.filter(
        (l) => l.bloco === bloco && !ocupados.has(l.c.analiseId),
      );
      if (empatados.length > quantos - usados && empatados.length > 1)
        ctx.avisos.push({
          codigo: "EMPATE_NO_LIMITE",
          tom: "warning",
          vaga: vaga.chave,
          texto: `Vaga ${vaga.codigo || vaga.cargo}: empate sem desempate no limite das vagas (${codigo}); resolva o empate antes de publicar.`,
        });
      ocupados.add(c.analiseId);
      resultado.set(c.analiseId, { situacao: "VAGA", modalidade: codigo });
      usados += 1;
      i += 1;
    }
    return quantos - usados;
  };
  const sobra = {};
  sobra.AC = ocupar(geral, "AC", lugares.AC || 0);
  for (const m of regra.modalidades) {
    if (m.codigo === "AC") continue;
    sobra[m.codigo] = ocupar(
      porModalidade[m.codigo] || [],
      m.codigo,
      lugares[m.codigo] || 0,
    );
  }
  // Remanejamento: o que sobrou de uma reserva vai para o próximo destino com candidato.
  for (let passo = 0; passo < regra.modalidades.length + 1; passo += 1) {
    let mexeu = false;
    for (const m of regra.modalidades) {
      if (m.codigo === "AC" || !(sobra[m.codigo] > 0)) continue;
      const destinos = [...m.remanejar_para, "AC"];
      for (const destino of destinos) {
        if (!(sobra[m.codigo] > 0)) break;
        const linhas = destino === "AC" ? geral : porModalidade[destino] || [];
        const restante = ocupar(linhas, destino, sobra[m.codigo]);
        if (restante !== sobra[m.codigo]) mexeu = true;
        sobra[m.codigo] = restante;
      }
    }
    if (!mexeu) break;
  }
  for (const linhas of [geral, ...Object.values(porModalidade)])
    for (const { c } of linhas)
      if (!resultado.has(c.analiseId))
        resultado.set(c.analiseId, { situacao: "CR", modalidade: null });
  return resultado;
}

/* ── Convocação ─────────────────────────────────────────────────────── */

export function limiteDaConvocacao(vaga, regra) {
  const conv = regra.convocacao;
  const cargo = semAcento(vaga.cargo);
  const excecao = conv.excecoes.find((e) =>
    e.termos.some((t) => cargo.includes(semAcento(t))),
  );
  const multiplo = excecao?.multiplo_vagas ?? conv.multiplo_vagas;
  const posicaoCr = excecao?.posicao_max_cr ?? conv.posicao_max_cr;
  const total = vaga.total;
  if (total > 0 && multiplo !== null)
    return {
      limite: Math.ceil(multiplo * total),
      origem: `${formatarNota(multiplo, 0)} × ${total} vaga(s)${excecao ? " (exceção do cargo)" : ""}`,
    };
  if (posicaoCr !== null)
    return {
      limite: Math.trunc(posicaoCr),
      origem: `até a ${Math.trunc(posicaoCr)}ª posição${excecao ? " (exceção do cargo)" : ""}`,
    };
  return { limite: null, origem: "sem limite na regra" };
}

function convocar(linhas, limite, incluirEmpatados, ctx, vaga, avisar = true) {
  if (limite === null) return new Set(linhas.map((l) => l.c.analiseId));
  const convocados = new Set();
  const blocos = [];
  for (const l of linhas) {
    if (blocos.at(-1)?.bloco !== l.bloco)
      blocos.push({ bloco: l.bloco, linhas: [] });
    blocos.at(-1).linhas.push(l);
  }
  let contados = 0;
  for (const { linhas: membros } of blocos) {
    if (contados >= limite) break;
    if (contados + membros.length <= limite || incluirEmpatados) {
      for (const l of membros) convocados.add(l.c.analiseId);
    } else {
      if (avisar)
        ctx.avisos.push({
          codigo: "EMPATE_NO_LIMITE",
          tom: "warning",
          vaga: vaga.chave,
          texto: `Vaga ${vaga.codigo || vaga.cargo}: empate no limite da convocação; a regra não inclui os empatados — só entra quem cabe (ordem alfabética).`,
        });
      for (const l of membros.slice(0, limite - contados))
        convocados.add(l.c.analiseId);
    }
    contados += membros.length;
  }
  return convocados;
}

/* ── Explicação ─────────────────────────────────────────────────────── */

function explicar(c, linhaGeral, ctx, tipo) {
  const partes = [];
  const casas = ctx.casas;
  if (tipo === "FINAL" && c.composicao) {
    const detalhe = c.composicao.partes
      .map(
        (p) =>
          `${p.codigo === "DOCUMENTAL" ? "documental" : p.codigo === "ENTREVISTA" ? "entrevista" : "ART"} ${formatarNota(p.valor, casas)}${p.peso !== 1 ? ` × ${formatarNota(p.peso, 2)}` : ""}`,
      )
      .join(" + ");
    partes.push(
      `Nota ${formatarNota(c.nota, casas)}${detalhe ? ` (${detalhe})` : ""}.`,
    );
    if (c.composicao.faltando.length)
      partes.push(
        `Sem ${c.composicao.faltando.join(", ")}: não somou na nota.`,
      );
  } else partes.push(`Nota ${formatarNota(c.nota, casas)}.`);

  const grupo = (c.grupoDaNota || []).filter((x) => x !== c);
  if (grupo.length) {
    partes.push(
      `Empatado em ${formatarNota(c.nota, casas)} com ${grupo.length}.`,
    );
    const bloco = linhaGeral?.bloco;
    if (bloco?.resolucao === "MESMA_POSICAO_LISTA") {
      partes.push("Nesta lista o empate fica na mesma posição.");
    } else {
      const frases = [];
      for (const outro of grupo) {
        const s = primeiroQueSepara(c, outro, ctx.criterios, ctx);
        if (s) {
          const rotulo =
            CRITERIO_POR_CODIGO[s.criterio]?.rotuloCurto || s.criterio;
          frases.push(
            `${s.sinal < 0 ? "à frente de" : "atrás de"} ${outro.nome} por ${rotulo} (${descreverValor(s.va, s.criterio)} × ${descreverValor(s.vb, s.criterio)})`,
          );
        } else frases.push(`com ${outro.nome}: empate em todos os critérios`);
      }
      if (frases.length) partes.push(`Desempate: ${frases.join("; ")}.`);
      if (bloco?.resolucao === "SORTEIO")
        partes.push(
          `Empate final resolvido por sorteio (semente ${String(bloco.registro?.semente || "").slice(0, 12)}…).`,
        );
      else if (bloco?.resolucao === "MANUAL")
        partes.push(
          `Empate final por decisão manual: ${bloco.registro?.justificativa || ""}`,
        );
      else if (bloco?.resolucao === "INSCRICAO")
        partes.push(
          `Empate final pela ordem de inscrição (código ${c.codigo || "—"}).`,
        );
      else if (bloco?.resolucao === "MESMA_POSICAO")
        partes.push("Empate final: mesma posição.");
      else if (bloco?.resolucao === "PENDENTE")
        partes.push(
          bloco.metodo === "SORTEIO"
            ? "Empate final aguardando sorteio."
            : "Empate final aguardando decisão manual.",
        );
    }
  }
  return partes;
}

/* ── Principal ──────────────────────────────────────────────────────── */

const ordemDosMotivos = Object.keys(MOTIVOS_DE_ELIMINACAO);

/**
 * Classifica o edital numa lista (`PRELIMINAR`, `CONVOCACAO` ou `FINAL`).
 * Ver o comentário do topo para a entrada e a saída.
 */
export function classificar({
  tipo = "FINAL",
  regra: regraBruta,
  candidatos: candidatosBrutos = [],
  entrevistas = [],
  quadro = [],
  unidade = "",
  dataCorte = null,
  desempates = [],
} = {}) {
  const regra = normalizarRegra(regraBruta);
  const avisos = [];
  const candidatos = ligarEntrevistas(
    prepararCandidatos(candidatosBrutos, avisos),
    entrevistas,
    avisos,
  );
  const corte = regra.data_corte || dataCorte || null;
  const criterios = regra.desempate.filter(
    (d) => CRITERIO_POR_CODIGO[d.criterio],
  );
  const ctx = {
    regra,
    criterios,
    casas: regra.composicao.casas,
    dataCorte: corte,
    desempates: (desempates || []).map((d) => ({
      ...d,
      ordem: (d.ordem || []).map(String),
      metodo: String(d.metodo || "").toUpperCase(),
    })),
    desempatesUsados: new Set(),
    avisos,
    nivelDesconhecido: new Set(),
  };
  if (
    !corte &&
    criterios.some((d) => ["IDOSO_60", "MAIOR_IDADE"].includes(d.criterio))
  )
    avisos.push({
      codigo: "SEM_DATA_CORTE",
      tom: "danger",
      texto:
        "A regra usa a idade, mas não há data de corte (fim das inscrições): defina na regra ou no cronograma do edital.",
    });

  const vagas = montarVagas({ candidatos, quadro, regra, unidade });
  const porVaga = new Map(
    vagas.map((v) => [v.chave, { vaga: v, candidatos: [] }]),
  );
  for (const c of candidatos) {
    if (!porVaga.has(c.vaga)) {
      const v = {
        chave: c.vaga,
        codigo: c.vaga,
        cargo: c.cargo,
        total: null,
        porModalidade: null,
        semQuadro: true,
      };
      v.cabecalho = `VAGA ${c.vaga || "sem código"} - ${c.cargo}`;
      porVaga.set(c.vaga, { vaga: v, candidatos: [] });
      vagas.push(v);
    }
    porVaga.get(c.vaga).candidatos.push(c);
  }

  const saidaVagas = [];
  const explicacoes = {};
  const pendencias = [];
  let elegiveisTotal = 0;
  let eliminadosTotal = 0;

  for (const v of vagas) {
    const { candidatos: daVaga } = porVaga.get(v.chave);
    if (v.semQuadro && daVaga.length)
      avisos.push({
        codigo: "VAGA_SEM_QUADRO",
        tom: "warning",
        vaga: v.chave,
        texto: `Vaga ${v.codigo || v.cargo}: sem linha correspondente no quadro de vagas do edital; o número de vagas não aparece e a situação (vaga ou cadastro reserva) não é calculada.`,
      });
    const semModalidade = daVaga.filter(
      (c) => !c.modalidadeIdentificada,
    ).length;
    if (semModalidade)
      avisos.push({
        codigo: "MODALIDADE_DESCONHECIDA",
        tom: "info",
        vaga: v.chave,
        texto: `Vaga ${v.codigo || v.cargo}: ${semModalidade} candidato(s) sem modalidade informada, considerados na ampla concorrência.`,
      });

    const eliminados = [];
    const aptosDoc = [];
    for (const c of daVaga) {
      const e = eliminacaoDocumental(c, regra, ctx);
      if (e) {
        eliminados.push({ c, ...e });
        if (c.entrevista && tipo === "FINAL")
          avisos.push({
            codigo: "ENTREVISTADO_NAO_HABILITADO",
            tom: "warning",
            vaga: v.chave,
            analiseId: c.analiseId,
            texto: `${c.nome}: tem entrevista lançada, mas não passou na avaliação documental (${MOTIVOS_DE_ELIMINACAO[e.motivo]}).`,
          });
      } else aptosDoc.push(c);
    }

    // A preliminar (base da convocação e da final).
    for (const c of aptosDoc)
      c.nota = arredondar(
        c.notaDocumental ?? 0,
        ctx.casas,
        regra.composicao.arredondamento,
      );
    const usarCriteriosPrelim = regra.listas.PRELIMINAR.empate === "CRITERIOS";
    let blocos = ordenarVaga(aptosDoc, {
      usarCriterios: usarCriteriosPrelim,
      tipo: "PRELIMINAR",
      vaga: v.chave,
      ctx,
    });
    for (const c of aptosDoc)
      c.modalidadesNaLista = modalidadesNaLista(c, "PRELIMINAR", regra, null);
    let geral = numerar(
      blocos,
      (c) => naGeral(c, regra),
      regra.empate_final.numeracao,
    );
    const { limite, origem } = limiteDaConvocacao(v, regra);
    const avisarConvocacao = tipo === "CONVOCACAO";
    const convocados = convocar(
      geral,
      limite,
      regra.convocacao.incluir_empatados,
      ctx,
      v,
      avisarConvocacao,
    );
    for (const m of regra.modalidades) {
      if (m.codigo === "AC" || m.aparece_na_geral !== false) continue;
      const lista = numerar(
        blocos,
        (c) => c.modalidadesNaLista.includes(m.codigo),
        regra.empate_final.numeracao,
      );
      for (const id of convocar(
        lista,
        limite,
        regra.convocacao.incluir_empatados,
        ctx,
        v,
        avisarConvocacao,
      ))
        convocados.add(id);
    }

    let elegiveis = aptosDoc;
    let tipoDaOrdem = "PRELIMINAR";
    if (tipo === "CONVOCACAO") {
      elegiveis = aptosDoc.filter((c) => convocados.has(c.analiseId));
      for (const c of aptosDoc)
        if (!convocados.has(c.analiseId))
          eliminados.push({
            c,
            motivo: "NAO_CONVOCADO",
            detalhe: `Limite: ${origem}.`,
          });
      geral = numerar(
        blocos,
        (c) => convocados.has(c.analiseId) && naGeral(c, regra),
        regra.empate_final.numeracao,
      );
    } else if (tipo === "FINAL") {
      elegiveis = [];
      for (const c of aptosDoc) {
        const e = eliminacaoEntrevista(c, regra, ctx);
        if (e) {
          eliminados.push({ c, ...e });
          if (
            e.motivo === "SEM_ENTREVISTA" &&
            convocados.has(c.analiseId) &&
            regra.etapas.entrevista
          )
            avisos.push({
              codigo: "CONVOCADO_SEM_ENTREVISTA",
              tom: "warning",
              vaga: v.chave,
              analiseId: c.analiseId,
              texto: `${c.nome}: dentro do limite de convocação, mas sem entrevista lançada.`,
            });
          if (e.motivo === "SEM_NOTA_ENTREVISTA")
            avisos.push({
              codigo: "SEM_NOTA_ENTREVISTA",
              tom: "warning",
              vaga: v.chave,
              analiseId: c.analiseId,
              texto: `${c.nome}: entrevista sem nota lançada.`,
            });
          continue;
        }
        c.composicao = notaComposta(c, regra);
        c.nota = c.composicao.nota ?? 0;
        if (c.composicao.faltando.length)
          avisos.push({
            codigo: "COMPONENTE_FALTANDO",
            tom: "warning",
            vaga: v.chave,
            analiseId: c.analiseId,
            texto: `${c.nome}: sem ${c.composicao.faltando.join(", ")} — a nota final não soma esse componente.`,
          });
        elegiveis.push(c);
      }
      tipoDaOrdem = "FINAL";
      blocos = ordenarVaga(elegiveis, {
        usarCriterios: regra.listas.FINAL.empate === "CRITERIOS",
        tipo: "FINAL",
        vaga: v.chave,
        ctx,
      });
      const ordem = {
        posicaoEm: (c, codigo) => {
          const membros = blocos
            .flatMap((b) => b.membros)
            .filter((x) => x.modalidades.includes(codigo));
          return membros.indexOf(c);
        },
      };
      for (const c of elegiveis)
        c.modalidadesNaLista = modalidadesNaLista(c, "FINAL", regra, ordem);
      geral = numerar(
        blocos,
        (c) => naGeral(c, regra),
        regra.empate_final.numeracao,
      );
    }

    // Dados faltando nos critérios que chegaram a ser usados (grupos de empate).
    const usarCriterios =
      regra.listas[tipoDaOrdem === "FINAL" ? "FINAL" : "PRELIMINAR"].empate ===
      "CRITERIOS";
    if (usarCriterios)
      for (const c of elegiveis) {
        if ((c.grupoDaNota || []).length < 2) continue;
        for (const { criterio } of criterios) {
          if (valorDoCriterio(c, criterio, ctx) !== null) continue;
          const cat = CRITERIO_POR_CODIGO[criterio];
          avisos.push({
            codigo: "DADO_FALTANDO",
            tom: "warning",
            vaga: v.chave,
            analiseId: c.analiseId,
            texto: `${c.nome}: sem ${cat.falta(c, ctx)} para o critério "${cat.rotuloCurto}" — no desempate, fica atrás de quem tem.`,
          });
        }
      }

    const porModalidade = {};
    for (const m of regra.modalidades) {
      if (!m.lista_propria) continue;
      const pertence = (c) =>
        c.modalidadesNaLista.includes(m.codigo) &&
        (tipo !== "CONVOCACAO" || convocados.has(c.analiseId));
      let linhas = numerar(blocos, pertence, regra.empate_final.numeracao);
      if (!m.recomeca_posicao) {
        const posGeral = new Map(geral.map((l) => [l.c.analiseId, l.posicao]));
        linhas = linhas.map((l) => ({
          ...l,
          posicao: posGeral.get(l.c.analiseId) ?? l.posicao,
        }));
      }
      porModalidade[m.codigo] = linhas;
    }

    // Pendências: empate sem resolução que aparece junto em alguma lista.
    for (const bloco of blocos) {
      if (bloco.resolucao !== "PENDENTE") continue;
      const ids = new Set(bloco.membros.map((c) => c.analiseId));
      const juntos = [geral, ...Object.values(porModalidade)].some(
        (linhas) => linhas.filter((l) => ids.has(l.c.analiseId)).length > 1,
      );
      if (!juntos) continue;
      pendencias.push({
        chave: bloco.chave,
        tipoLista: tipoDaOrdem,
        vaga: v.chave,
        vagaTexto: v.codigo || v.cargo,
        metodo: bloco.metodo,
        nota: bloco.membros[0].nota,
        candidatos: bloco.membros.map((c) => ({
          analiseId: c.analiseId,
          nome: c.nome,
          codigo: c.codigo,
        })),
      });
      avisos.push({
        codigo: "EMPATE_PENDENTE",
        tom: "danger",
        vaga: v.chave,
        texto: `Vaga ${v.codigo || v.cargo}: ${bloco.membros.length} candidatos empatados em ${formatarNota(bloco.membros[0].nota, ctx.casas)} depois de todos os critérios — ${bloco.metodo === "SORTEIO" ? "registre o sorteio" : "registre a decisão"}.`,
      });
    }

    const alocacao =
      tipo === "FINAL"
        ? alocarVagas(v, geral, porModalidade, regra, ctx)
        : new Map();
    const situacaoDe = (c) =>
      tipo === "CONVOCACAO"
        ? "CONVOCADO"
        : tipo === "FINAL"
          ? alocacao.get(c.analiseId)?.situacao || null
          : null;
    const linhaPublica = (l) => ({
      analiseId: l.c.analiseId,
      nome: l.c.nome,
      nota: l.c.nota,
      posicao: l.posicao,
      empatados: l.empatados,
      modalidades: l.c.modalidadesNaLista,
      situacao: situacaoDe(l.c),
      vagaPor: alocacao.get(l.c.analiseId)?.modalidade || null,
    });

    const linhaGeralDe = new Map(geral.map((l) => [l.c.analiseId, l]));
    const blocoDe = new Map();
    for (const b of blocos)
      for (const c of b.membros) blocoDe.set(c.analiseId, b);
    for (const c of elegiveis) {
      const posicoes = {};
      for (const [codigo, linhas] of Object.entries(porModalidade)) {
        const l = linhas.find((x) => x.c === c);
        if (l) posicoes[codigo] = l.posicao;
      }
      const linhaGeral = linhaGeralDe.get(c.analiseId) || {
        bloco: blocoDe.get(c.analiseId),
      };
      explicacoes[c.analiseId] = {
        analiseId: c.analiseId,
        nome: c.nome,
        vaga: v.chave,
        elegivel: true,
        nota: c.nota,
        posicaoGeral: linhaGeralDe.get(c.analiseId)?.posicao ?? null,
        posicoes,
        modalidades: c.modalidadesNaLista,
        situacao: situacaoDe(c),
        explicacao: explicar(c, linhaGeral, ctx, tipo),
      };
    }
    eliminados.sort(
      (a, b) =>
        ordemDosMotivos.indexOf(a.motivo) - ordemDosMotivos.indexOf(b.motivo) ||
        comparaNome(a.c, b.c),
    );
    for (const e of eliminados)
      explicacoes[e.c.analiseId] = {
        analiseId: e.c.analiseId,
        nome: e.c.nome,
        vaga: v.chave,
        elegivel: false,
        motivo: e.motivo,
        explicacao: [`${MOTIVOS_DE_ELIMINACAO[e.motivo]}.`, e.detalhe].filter(
          Boolean,
        ),
      };

    elegiveisTotal += elegiveis.length;
    eliminadosTotal += eliminados.length;
    saidaVagas.push({
      chave: v.chave,
      codigo: v.codigo,
      cargo: v.cargo,
      lotacao: v.lotacao || "",
      cabecalho: v.cabecalho,
      total: v.total ?? null,
      vagasPorModalidade: v.porModalidade || null,
      cadastroReserva: Boolean(v.cadastroReserva),
      limiteConvocacao: tipo === "CONVOCACAO" ? { limite, origem } : null,
      geral: geral.map(linhaPublica),
      porModalidade: Object.fromEntries(
        Object.entries(porModalidade).map(([codigo, linhas]) => [
          codigo,
          linhas.map(linhaPublica),
        ]),
      ),
      eliminados: eliminados.map((e) => ({
        analiseId: e.c.analiseId,
        nome: e.c.nome,
        motivo: e.motivo,
        detalhe: e.detalhe,
      })),
    });
  }

  for (const vaga of ctx.nivelDesconhecido)
    avisos.push({
      codigo: "NIVEL_DESCONHECIDO",
      tom: "warning",
      vaga,
      texto: `Vaga ${vaga}: nível (superior, técnico…) não identificado; a nota mínima por nível não foi aplicada.`,
    });
  for (const d of ctx.desempates)
    if (
      d.tipo_lista === tipo ||
      (tipo === "CONVOCACAO" && d.tipo_lista === "PRELIMINAR")
    )
      if (!ctx.desempatesUsados.has(d.id || d.chave))
        avisos.push({
          codigo: "DESEMPATE_OBSOLETO",
          tom: "info",
          vaga: d.vaga,
          texto: `Há ${d.metodo === "SORTEIO" ? "sorteio" : "decisão"} registrado para um empate que mudou (vaga ${d.vaga || "—"}); ele não vale mais.`,
        });

  const vistos = new Set();
  const avisosUnicos = avisos.filter((a) => {
    const k = `${a.codigo}|${a.analiseId || ""}|${a.texto}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });

  return {
    tipo,
    dataCorte: corte,
    casas: ctx.casas,
    vagas: saidaVagas,
    explicacoes,
    pendencias,
    avisos: avisosUnicos,
    totais: {
      candidatos: candidatos.length,
      elegiveis: elegiveisTotal,
      eliminados: eliminadosTotal,
      vagas: saidaVagas.length,
      avisos: avisosUnicos.length,
      pendencias: pendencias.length,
    },
  };
}
