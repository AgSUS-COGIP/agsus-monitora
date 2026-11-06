/* Motor da classificação: entrada (candidatos, entrevistas, ajustes e agrupamentos) (API pública em ../motor.ts). */

import type {
  CandidatoDoMotor,
  EntrevistaDoMotor,
  RegistroDoMotor,
  RegraDoMotor,
} from "../tipos-do-motor.ts";
import type { AvisoDaClassificacao } from "../tipos-do-resultado.ts";
import { registroDoMotor } from "../dados-do-motor.ts";
import {
  ITEM_DO_AJUSTE_POR_CODIGO,
  codigosDaModalidade,
  ordemDaCompetencia,
  simOuNao,
} from "../catalogo.ts";
import { formatarNota, lerHora, numeroBR } from "../numeros.ts";
import { compararEntrevistas } from "../../entrevista-vigente.ts";
import { exigir, texto } from "./comum.ts";

/* ── Entrada ────────────────────────────────────────────────────────── */

function lerNumero(
  bruto: unknown,
  campo: string,
  c: Pick<CandidatoDoMotor, "vaga" | "analiseId" | "nome">,
  avisos: AvisoDaClassificacao[],
) {
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
export function prepararCandidatos(
  brutos: readonly RegistroDoMotor[] = [],
  avisos: AvisoDaClassificacao[] = [],
): CandidatoDoMotor[] {
  const vistos = new Set();
  const candidatos = [];
  for (const b of brutos || []) {
    const analiseId = texto(b?.analise_id ?? b?.analiseId);
    if (!analiseId || vistos.has(analiseId)) continue;
    vistos.add(analiseId);
    const c: CandidatoDoMotor = {
      notaDocumental: null,
      notaArt: null,
      pontuacaoFormacao: null,
      pontuacaoCursos: null,
      pontuacaoExperiencia: null,
      pontuacaoEtnica: null,
      expSaudeIndigena: null,
      expAtencaoBasica: null,
      expProfissional: null,
      expAltaComplexidade: null,
      expSaudeDigital: null,
      nivelEscolaridade: null,
      notaConhecimentosEspecificos: null,
      modalidades: [],
      modalidadeIdentificada: false,
      analiseId,
      codigo: texto(b.codigo),
      nome: texto(b.nome ?? b.candidato) || "(sem nome)",
      vaga: texto(b.vaga),
      cargo: texto(b.cargo),
      categoria: texto(b.categoria),
      modalidadeTexto: texto(b.modalidade),
      pcd: simOuNao(b.pcd),
      dataNascimento: texto(b.data_nascimento ?? b.dataNascimento),
      // Da certidão, informada na Classificação (TB_HORA_NASCIMENTO_CANDIDATO).
      horaNascimento: lerHora(b.hora_nascimento ?? b.horaNascimento) || "",
      status: texto(b.status),
      etapa: texto(b.etapa),
      quadroId: texto(b.quadro ?? b.quadroId),
    };
    const ler = (campo: string, rotulo: string) =>
      lerNumero(b[campo], rotulo, c, avisos);
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
    c.expAltaComplexidade = ler(
      "exp_alta_complexidade",
      "experiência em alta complexidade",
    );
    c.expSaudeDigital = ler(
      "exp_saude_digital",
      "experiência em saúde digital",
    );
    c.nivelEscolaridade = ler("nivel_escolaridade", "nível de escolaridade");
    c.notaConhecimentosEspecificos = ler(
      "nota_conhecimentos_especificos",
      "nota de conhecimentos específicos",
    );
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
export function ligarEntrevistas(
  candidatos: CandidatoDoMotor[],
  brutas: readonly RegistroDoMotor[] = [],
  avisos: AvisoDaClassificacao[] = [],
): CandidatoDoMotor[] {
  const porAnalise = new Map(candidatos.map((c) => [c.analiseId, c]));
  const escolhidas = new Map<string, EntrevistaDoMotor>();
  for (const b of brutas || []) {
    const analiseId = texto(b?.analise_id ?? b?.analiseId);
    const e: EntrevistaDoMotor = {
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
        .map((valor: unknown) => {
          const n = registroDoMotor(valor);
          return Array.isArray(valor)
            ? {
                ordem: Number(valor[0]),
                criterio: texto(valor[2]),
                nota: numeroBR(valor[1]),
              }
            : {
                ordem: Number(n?.ordem),
                criterio: texto(n?.criterio),
                nota: numeroBR(n?.nota),
              };
        })
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
    const c = exigir(porAnalise.get(analiseId));
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
        texto: `${c.nome}: mais de uma entrevista lançada; vale a de parecer definido (depois a com nota, depois a do sistema).`,
      });
      // A regra única de qual entrevista vale (a mesma do banco e do Painel de entrevistas).
      if (compararEntrevistas(e, atual) < 0) escolhidas.set(analiseId, e);
    } else escolhidas.set(analiseId, e);
  }
  for (const c of candidatos) {
    c.entrevista = escolhidas.get(c.analiseId) || null;
    c.notaEntrevista = c.entrevista?.nota ?? null;
  }
  return candidatos;
}

/*
  Os ajustes da pontuação APROVADOS em recurso (TB_AJUSTE_PONTUACAO_RECURSO,
  migration 20261005130000), por cima da nota da análise e da entrevista: o
  valor novo de cada item substitui o do candidato (a planilha nunca é
  sobrescrita). Mais de um recurso do mesmo candidato: na ordem da aprovação
  (o mais recente vale no item repetido). O candidato guarda `ajustes` (o
  número do recurso e os itens) para a marca na tabela e a explicação. Se o
  valor da análise mudou depois do ajuste (o "antes" gravado é outro), avisa
  — vale o ajuste.
*/
const quase = (a: number, b: number) => Math.abs(a - b) < 1e-9;

export function aplicarAjustes(
  candidatos: CandidatoDoMotor[],
  ajustes: readonly RegistroDoMotor[] = [],
  avisos: AvisoDaClassificacao[] = [],
): CandidatoDoMotor[] {
  if (!Array.isArray(ajustes) || !ajustes.length) return candidatos;
  const porAnalise = new Map(candidatos.map((c) => [c.analiseId, c]));
  const ordenados = [...ajustes].sort((a, b) =>
    String(a?.aprovado_em ?? "").localeCompare(String(b?.aprovado_em ?? "")),
  );
  for (const ajuste of ordenados) {
    const c = porAnalise.get(texto(ajuste?.analise_id ?? ajuste?.analiseId));
    if (!c) continue;
    const numero = numeroBR(ajuste.numero);
    const aplicados = [];
    for (const bruto of Array.isArray(ajuste.itens) ? ajuste.itens : []) {
      const item = registroDoMotor(bruto);
      const novo = numeroBR(item?.novo);
      if (novo === null) continue;
      const codigo = texto(item.codigo).toUpperCase();
      const competencia = ordemDaCompetencia(codigo);
      const def = ITEM_DO_AJUSTE_POR_CODIGO[codigo];
      if (!def && competencia === null) continue;
      const precisaEntrevista = competencia !== null || codigo === "ENTREVISTA";
      if (precisaEntrevista && !c.entrevista) {
        avisos.push({
          codigo: "AJUSTE_SEM_ENTREVISTA",
          tom: "warning",
          vaga: c.vaga,
          analiseId: c.analiseId,
          texto: `${c.nome}: o recurso nº ${numero ?? "—"} ajustou a entrevista, mas não há entrevista lançada; o ajuste desse item não entrou.`,
        });
        continue;
      }
      let atual;
      if (competencia !== null && c.entrevista) {
        const notas = c.entrevista.notas.map((n) => ({ ...n }));
        let alvo = notas.find((n) => n.ordem === competencia);
        if (!alvo) {
          alvo = { ordem: competencia, criterio: "", nota: null };
          notas.push(alvo);
          notas.sort((a, b) => a.ordem - b.ordem);
        }
        atual = alvo.nota;
        alvo.nota = novo;
        c.entrevista = { ...c.entrevista, notas };
      } else if (codigo === "ENTREVISTA" && c.entrevista) {
        atual = c.notaEntrevista ?? null;
        c.entrevista = { ...c.entrevista, nota: novo };
        c.notaEntrevista = novo;
      } else if (def) {
        atual = c[def.campo] ?? null;
        c[def.campo] = novo;
      } else continue;
      const anterior = numeroBR(item.anterior);
      if (anterior !== null && atual !== null && !quase(anterior, atual))
        avisos.push({
          codigo: "AJUSTE_DIVERGENTE",
          tom: "info",
          vaga: c.vaga,
          analiseId: c.analiseId,
          texto: `${c.nome}: ${rotuloDoItem(codigo).toLowerCase()} era ${formatarNota(anterior, 2)} no recurso nº ${numero ?? "—"} e hoje é ${formatarNota(atual, 2)}; vale o ajuste (${formatarNota(novo, 2)}).`,
        });
      aplicados.push({ codigo, anterior: atual, novo });
    }
    if (aplicados.length)
      c.ajustes = [
        ...(c.ajustes || []),
        { numero, recursoId: ajuste.recurso_id ?? null, itens: aplicados },
      ];
  }
  return candidatos;
}

/** O rótulo de um item do ajuste ("Formação acadêmica", "Competência 2"). */
export function rotuloDoItem(codigo: string) {
  const competencia = ordemDaCompetencia(codigo);
  if (competencia !== null) return `Competência ${competencia}`;
  return ITEM_DO_AJUSTE_POR_CODIGO[codigo]?.rotulo || codigo;
}

/* A frase da explicação: "Nota alterada pelo recurso nº 12: formação 2,00 → 3,00." */
export function fraseDosAjustes(c: CandidatoDoMotor, casas: number) {
  return (c.ajustes || []).map(
    (a) =>
      `Nota alterada pelo recurso nº ${a.numero ?? "—"}: ${a.itens
        .map(
          (i) =>
            `${rotuloDoItem(i.codigo).toLowerCase()} ${formatarNota(i.anterior, casas)} → ${formatarNota(i.novo, casas)}`,
        )
        .join("; ")}.`,
  );
}

export const recursosDoAjuste = (c: CandidatoDoMotor) =>
  (c.ajustes || []).map((a) => a.numero).filter((n) => n !== null);

/*
  Reservas conjuntas da regra (`agrupa`): quem declarou PP, PI ou PQ entra na
  PPIQ quando a regra tem uma reserva única para os três (e não as separadas).
*/
export function aplicarAgrupamentos(
  candidatos: CandidatoDoMotor[],
  regra: RegraDoMotor,
) {
  const proprias = new Set(regra.modalidades.map((m) => m.codigo));
  const destino = new Map<string, string>();
  for (const m of regra.modalidades)
    for (const codigo of m.agrupa)
      if (!proprias.has(codigo) && !destino.has(codigo))
        destino.set(codigo, m.codigo);
  if (!destino.size) return candidatos;
  for (const c of candidatos) {
    const novos = c.modalidades.map((m) => destino.get(m) || m);
    c.modalidades = novos.filter((m, i) => novos.indexOf(m) === i);
  }
  return candidatos;
}
