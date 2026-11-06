/* Motor da classificação: o classificar principal (API pública em ../motor.ts). */

import type {
  AlocacaoDoMotor,
  BlocoDeEmpate,
  CandidatoDoMotor,
  ContextoDoMotor,
  EntradaDoMotor,
  LinhaDoMotor,
} from "../tipos-do-motor.ts";
import type {
  AvisoDaClassificacao,
  ExplicacaoDoCandidato,
  LinhaDaLista,
  PendenciaDeEmpate,
  ResultadoDoMotor,
  SituacaoDaLinha,
  VagaDoResultado,
} from "../tipos-do-resultado.ts";
import type { VagaMontada } from "../tipos-das-vagas.ts";
import { convocacaoDoMotor, ordemDoMotor } from "../dados-do-motor.ts";
import { CRITERIO_POR_CODIGO, MOTIVOS_DE_ELIMINACAO } from "../catalogo.ts";
import {
  arredondar,
  dataBR,
  escalar,
  formatarNota,
  horaBR,
  HORA_SEM_CERTIDAO,
} from "../numeros.ts";
import { normalizarRegra } from "../regra.ts";
import { divergenciasDasCotas } from "../convocacao-do-edital.ts";
import { montarVagas } from "../vagas.ts";
import { comparaNome, exigir, texto } from "./comum.ts";
import {
  aplicarAgrupamentos,
  aplicarAjustes,
  fraseDosAjustes,
  ligarEntrevistas,
  prepararCandidatos,
  recursosDoAjuste,
} from "./entrada.ts";
import {
  aguardandoAnalise,
  eliminacaoDocumental,
  eliminacaoEntrevista,
  notaComposta,
} from "./etapas.ts";
import { explicar, parciaisDe } from "./explicacao.ts";
import {
  numerar,
  ordenarVaga,
  paresNaMesmaData,
  valorDoCriterio,
} from "./ordenacao.ts";
import {
  alocarVagas,
  convocar,
  limiteDaConvocacao,
  modalidadesNaLista,
  naGeral,
} from "./vagas-e-convocacao.ts";

/* ── Principal ──────────────────────────────────────────────────────── */

const ordemDosMotivos = Object.keys(MOTIVOS_DE_ELIMINACAO);
const motivos: Readonly<Record<string, string | undefined>> =
  MOTIVOS_DE_ELIMINACAO;
const motivoDaEliminacao = (codigo: string) => motivos[codigo];

/**
 * Classifica o edital numa lista (`PRELIMINAR`, `CONVOCACAO`, `ENTREVISTA`
 * ou `FINAL`).
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
  convocacao = null,
  ajustes = [],
}: EntradaDoMotor = {}): ResultadoDoMotor {
  const regra = normalizarRegra(regraBruta);
  const avisos: AvisoDaClassificacao[] = [];
  const candidatos = aplicarAjustes(
    ligarEntrevistas(
      aplicarAgrupamentos(prepararCandidatos(candidatosBrutos, avisos), regra),
      entrevistas,
      avisos,
    ),
    ajustes,
    avisos,
  );
  const corte = regra.data_corte || dataCorte || null;
  const criterios = regra.desempate.filter(
    (d) => CRITERIO_POR_CODIGO[d.criterio],
  );
  const ctx: ContextoDoMotor = {
    regra,
    criterios,
    casas: regra.composicao.casas,
    dataCorte: corte,
    desempates: (desempates || []).map((d) => ({
      ...d,
      chave: texto(d.chave),
      vaga: d.vaga == null ? undefined : texto(d.vaga),
      ordem: ordemDoMotor(d.ordem),
      metodo: String(d.metodo || "").toUpperCase(),
    })),
    desempatesUsados: new Set(),
    avisos,
    nivelDesconhecido: new Set(),
    horaDecide: new Set(),
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

  const conv = convocacaoDoMotor(convocacao);
  const vagas = montarVagas({
    candidatos,
    quadro,
    regra,
    unidade,
    convocacao: conv,
  });
  for (const frase of divergenciasDasCotas(regra, conv))
    avisos.push({
      codigo: "COTAS_DIFERENTES_DA_CONVOCACAO",
      tom: "warning",
      texto: `Cotas da regra × configuração de convocação do edital — ${frase}`,
    });
  for (const v of vagas)
    if (v.totalNaConvocacao !== null && v.totalNaConvocacao !== undefined)
      avisos.push({
        codigo: "VAGAS_DIFERENTES_DA_CONVOCACAO",
        tom: "warning",
        vaga: v.chave,
        texto: `Vaga ${v.codigo || v.cargo}: ${v.total} vaga(s) imediata(s) no quadro do edital × ${v.totalNaConvocacao} na configuração de convocação; valeu o quadro do edital.`,
      });
  const porVaga = new Map<
    string,
    { vaga: VagaMontada; candidatos: CandidatoDoMotor[] }
  >(vagas.map((v) => [v.chave, { vaga: v, candidatos: [] }]));
  for (const c of candidatos) {
    if (!porVaga.has(c.vaga)) {
      const v: VagaMontada = {
        lotacao: "",
        cadastroReserva: false,
        origemDasVagas: null,
        cabecalho: `VAGA ${c.vaga || "sem código"} - ${c.cargo}`,
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
    exigir(porVaga.get(c.vaga)).candidatos.push(c);
  }

  // Itens do ajuste com ao menos 2 casas (as da planilha), não só as da nota final.
  const casasDoAjuste = Math.max(2, ctx.casas);
  const saidaVagas: VagaDoResultado[] = [];
  const explicacoes: Record<string, ExplicacaoDoCandidato> = {};
  const pendencias: PendenciaDeEmpate[] = [];
  let elegiveisTotal = 0;
  let eliminadosTotal = 0;
  let aguardandoTotal = 0;

  for (const v of vagas) {
    const { candidatos: daVaga } = exigir(porVaga.get(v.chave));
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

    const eliminados: {
      c: CandidatoDoMotor;
      motivo: string;
      detalhe: string;
    }[] = [];
    const aptosDoc: CandidatoDoMotor[] = [];
    const aguardando: CandidatoDoMotor[] = [];
    for (const c of daVaga) {
      if (aguardandoAnalise(c, regra)) {
        aguardando.push(c);
        continue;
      }
      const e = eliminacaoDocumental(c, regra, ctx);
      if (e) {
        eliminados.push({ c, ...e });
        if (c.entrevista && tipo === "FINAL")
          avisos.push({
            codigo: "ENTREVISTADO_NAO_HABILITADO",
            tom: "warning",
            vaga: v.chave,
            analiseId: c.analiseId,
            texto: `${c.nome}: tem entrevista lançada, mas não passou na avaliação documental (${motivoDaEliminacao(e.motivo)}).`,
          });
      } else aptosDoc.push(c);
    }

    /*
      A avaliação documental publica a nota e as parciais da regra lado a
      lado: se as parciais da planilha não somam a nota (93/2026: a nota
      final ajustada segue o barema, as colunas de pontuação não), a lista
      sairia incoerente. Não muda a ordem (vale a nota); avisa por vaga.
    */
    if (tipo === "PRELIMINAR" && regra.documental.parciais.length) {
      const diferentes = aptosDoc.filter((c) => {
        const valores = regra.documental.parciais.map((p) => parciaisDe(c)[p]);
        if (valores.every((x) => x === null || x === undefined)) return false;
        const soma = valores.reduce<number>((s, x) => s + (x ?? 0), 0);
        return (escalar(soma, 2) ?? 0) !== (escalar(c.notaDocumental, 2) ?? 0);
      });
      if (diferentes.length)
        avisos.push({
          codigo: "PARCIAIS_DIFERENTES_DA_NOTA",
          tom: "warning",
          vaga: v.chave,
          texto: `Vaga ${v.codigo || v.cargo}: em ${diferentes.length} de ${aptosDoc.length} candidato(s) a soma das parciais publicadas não é a nota documental (ex.: inscrição ${exigir(diferentes[0]).codigo || "—"}: nota ${formatarNota(exigir(diferentes[0]).notaDocumental, 2)}, parciais ${regra.documental.parciais.map((p) => formatarNota(parciaisDe(exigir(diferentes[0]))[p] ?? 0, 2)).join(" + ")}). Confira a planilha antes de publicar.`,
        });
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
        (c) => (c.modalidadesNaLista ?? []).includes(m.codigo),
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
    let tipoDaOrdem: "PRELIMINAR" | "ENTREVISTA" | "FINAL" = "PRELIMINAR";
    if (tipo === "ENTREVISTA") {
      // Só os convocados: quem não passou na documental ou ficou fora do
      // limite não é desta etapa (está nas listas anteriores).
      eliminados.length = 0;
      elegiveis = [];
      for (const c of aptosDoc) {
        if (!convocados.has(c.analiseId)) continue;
        const e = eliminacaoEntrevista(c, regra, ctx);
        if (e) {
          eliminados.push({ c, ...e });
          if (e.motivo === "SEM_ENTREVISTA" && regra.etapas.entrevista)
            avisos.push({
              codigo: "CONVOCADO_SEM_ENTREVISTA",
              tom: "warning",
              vaga: v.chave,
              analiseId: c.analiseId,
              texto: `${c.nome}: dentro do limite de convocação, mas sem entrevista lançada.`,
            });
          continue;
        }
        // Entrevista só com parecer: a lista dos aptos segue a nota documental.
        c.nota = arredondar(
          (regra.entrevista.so_parecer ? c.notaDocumental : c.notaEntrevista) ??
            0,
          ctx.casas,
          regra.composicao.arredondamento,
        );
        elegiveis.push(c);
      }
      tipoDaOrdem = "ENTREVISTA";
      blocos = ordenarVaga(elegiveis, {
        usarCriterios: regra.listas.ENTREVISTA.empate === "CRITERIOS",
        tipo: "ENTREVISTA",
        vaga: v.chave,
        ctx,
        residualNaMesmaPosicao: true,
      });
      geral = numerar(
        blocos,
        (c) => naGeral(c, regra),
        regra.empate_final.numeracao,
      );
    } else if (tipo === "CONVOCACAO") {
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
        if (!convocados.has(c.analiseId) && regra.etapas.entrevista)
          avisos.push({
            codigo: "ENTREVISTADO_NAO_CONVOCADO",
            tom: "warning",
            vaga: v.chave,
            analiseId: c.analiseId,
            texto: `${c.nome}: tem entrevista, mas está fora do limite de convocação da regra (${origem}); confira a convocação publicada.`,
          });
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
        posicaoEm: (c: CandidatoDoMotor, codigo: string) => {
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
    const usarCriterios = regra.listas[tipoDaOrdem].empate === "CRITERIOS";
    if (usarCriterios)
      for (const c of elegiveis) {
        if ((c.grupoDaNota || []).length < 2) continue;
        for (const { criterio } of criterios) {
          if (valorDoCriterio(c, criterio, ctx) !== null) continue;
          const cat = CRITERIO_POR_CODIGO[criterio];
          if (!cat) continue;
          avisos.push({
            codigo: "DADO_FALTANDO",
            tom: "warning",
            vaga: v.chave,
            analiseId: c.analiseId,
            texto: `${c.nome}: sem ${cat.falta(c, ctx)} para o critério "${cat.rotuloCurto}" — no desempate, fica atrás de quem tem.`,
          });
        }
      }

    /*
      Empate que chega à "maior idade" entre quem nasceu no mesmo dia: vale a
      hora da certidão (sem certidão, 23h59min59s). A gaveta desses candidatos
      mostra o campo da hora (`horaDecide`); o aviso pede a conferência.
    */
    if (usarCriterios) {
      const grupos = new Set(
        elegiveis
          .map((c) => c.grupoDaNota)
          .filter((g): g is CandidatoDoMotor[] => Boolean(g && g.length > 1)),
      );
      for (const grupo of grupos)
        for (const [a, b] of paresNaMesmaData(grupo, criterios, ctx)) {
          ctx.horaDecide.add(a.analiseId);
          ctx.horaDecide.add(b.analiseId);
          const semHora = [a, b].filter((x) => !x.horaNascimento).length;
          avisos.push({
            codigo: "HORA_DE_NASCIMENTO",
            tom: semHora ? "warning" : "info",
            vaga: v.chave,
            analiseId: a.analiseId,
            texto: `${a.nome} e ${b.nome}: empatados até a maior idade e nascidos no mesmo dia (${dataBR(a.dataNascimento)}); decide a hora da certidão de nascimento${semHora ? ` — sem certidão vale ${horaBR(HORA_SEM_CERTIDAO)}; informe a hora na explicação do candidato` : ""}.`,
          });
        }
    }

    const porModalidade: Record<string, LinhaDoMotor[]> = {};
    for (const m of regra.modalidades) {
      if (!m.lista_propria) continue;
      const pertence = (c: CandidatoDoMotor) =>
        (c.modalidadesNaLista ?? []).includes(m.codigo) &&
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
        nota: exigir(bloco.membros[0]).nota ?? null,
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
        texto: `Vaga ${v.codigo || v.cargo}: ${bloco.membros.length} candidatos empatados em ${formatarNota(exigir(bloco.membros[0]).nota ?? null, ctx.casas)} depois de todos os critérios — ${bloco.metodo === "SORTEIO" ? "registre o sorteio" : "registre a decisão"}.`,
      });
    }

    const alocacao =
      tipo === "FINAL"
        ? alocarVagas(v, geral, porModalidade, regra, ctx)
        : new Map<string, AlocacaoDoMotor>();
    const situacaoDe = (c: CandidatoDoMotor): SituacaoDaLinha | null =>
      tipo === "CONVOCACAO"
        ? "CONVOCADO"
        : tipo === "ENTREVISTA"
          ? "APTO"
          : tipo === "FINAL"
            ? alocacao.get(c.analiseId)?.situacao || null
            : null;
    const comParciais = tipo === "PRELIMINAR";
    const linhaPublica = (l: LinhaDoMotor): LinhaDaLista => ({
      analiseId: l.c.analiseId,
      nome: l.c.nome,
      nota: l.c.nota ?? null,
      posicao: l.posicao,
      empatados: l.empatados,
      modalidades: l.c.modalidadesNaLista ?? l.c.modalidades,
      situacao: situacaoDe(l.c),
      vagaPor: alocacao.get(l.c.analiseId)?.modalidade || null,
      ...(comParciais ? { parciais: parciaisDe(l.c) } : {}),
      ...(l.c.ajustes ? { recursos: recursosDoAjuste(l.c) } : {}),
    });

    const linhaGeralDe = new Map(geral.map((l) => [l.c.analiseId, l]));
    const blocoDe = new Map<string, BlocoDeEmpate>();
    for (const b of blocos)
      for (const c of b.membros) blocoDe.set(c.analiseId, b);
    for (const c of elegiveis) {
      const posicoes: Record<string, number> = {};
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
        ...(c.ajustes ? { recursos: recursosDoAjuste(c) } : {}),
        // A hora da certidão: a gaveta mostra o campo só quando ela decide.
        horaNascimento: c.horaNascimento || null,
        horaDecide: ctx.horaDecide.has(c.analiseId),
        explicacao: [
          ...explicar(c, linhaGeral, ctx, tipo),
          ...fraseDosAjustes(c, casasDoAjuste),
        ],
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
        ...(e.c.ajustes ? { recursos: recursosDoAjuste(e.c) } : {}),
        explicacao: [
          `${motivoDaEliminacao(e.motivo)}.`,
          e.detalhe,
          ...fraseDosAjustes(e.c, casasDoAjuste),
        ].filter(Boolean),
      };

    aguardando.sort(comparaNome);
    for (const c of aguardando)
      explicacoes[c.analiseId] = {
        analiseId: c.analiseId,
        nome: c.nome,
        vaga: v.chave,
        elegivel: false,
        aguardando: true,
        explicacao: [
          `Aguardando a análise documental (situação: ${c.status || c.etapa}).`,
          "Fica fora das listas e dos eliminados até a análise ser concluída.",
        ],
      };

    elegiveisTotal += elegiveis.length;
    eliminadosTotal += eliminados.length;
    aguardandoTotal += aguardando.length;
    saidaVagas.push({
      chave: v.chave,
      codigo: v.codigo,
      cargo: v.cargo,
      lotacao: v.lotacao || "",
      cabecalho: v.cabecalho,
      total: v.total ?? null,
      vagasPorModalidade: v.porModalidade || null,
      cadastroReserva: Boolean(v.cadastroReserva),
      origemDasVagas: v.origemDasVagas || null,
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
        ...(e.c.ajustes ? { recursos: recursosDoAjuste(e.c) } : {}),
        ...(comParciais
          ? { nota: e.c.notaDocumental, parciais: parciaisDe(e.c) }
          : tipo === "ENTREVISTA"
            ? { nota: e.c.notaEntrevista }
            : {}),
      })),
      aguardando: aguardando.map((c) => ({
        analiseId: c.analiseId,
        nome: c.nome,
        situacao: c.status || c.etapa || "",
      })),
    });
  }

  if (aguardandoTotal)
    avisos.push({
      codigo: "AGUARDANDO_ANALISE",
      tom: "warning",
      texto: `${aguardandoTotal.toLocaleString("pt-BR")} candidato(s) aguardando a análise documental (ficha não concluída): ficam fora das listas e dos eliminados até a análise ser concluída.`,
    });

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
      aguardando: aguardandoTotal,
      vagas: saidaVagas.length,
      avisos: avisosUnicos.length,
      pendencias: pendencias.length,
    },
  };
}
