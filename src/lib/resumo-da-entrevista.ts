/*
  As regras da entrevista de um edital em LINGUAGEM SIMPLES, para o resumo de
  Conduzir entrevistas › Preparar (src/modulos/entrevistas/resumo-das-regras.tsx),
  no espírito do resumo da regra da Avaliação documental: quem é chamado, como
  a nota é calculada, quem avalia e o desempate. Sem DOM e sem estado; as
  frases saem só dos dados (a regra de convocação e o desempate da
  Classificação, as vagas da lista de convocação, o roteiro e a banca do
  edital) — nunca texto fixo de um edital.

  Cada bloco diz para onde ir mudar (`acoes`): a Classificação (convocação e
  desempate), o roteiro (como a nota é calculada), a configuração (banca e
  roteiro do edital) e a convocação (quem já está na ficha).
*/
import {
  avaliaTodas,
  competenciasDoAvaliador,
  competenciasSemAvaliador,
} from "./conducao-de-entrevista.ts";
import { textoDaEscala } from "./digitacao-de-notas.ts";
import {
  minimoEmPontos,
  opcoesDaEscala,
  pontuacaoMaxima,
} from "./roteiro-de-entrevista.ts";

export type DestinoDoResumo =
  "classificacao" | "configuracao" | "roteiro" | "convocacao";

export type AcaoDoResumo = { destino: DestinoDoResumo; rotulo: string };

export type LinhaDasVagas = {
  vaga: string;
  cargo: string;
  /** "1", "2", "cadastro reserva", "—". */
  imediatas: string;
  /** "até a 6ª", "—". */
  chamaAte: string;
};

export type BlocoDoResumo = {
  id: "convocacao" | "nota" | "banca" | "desempate";
  titulo: string;
  frases: string[];
  /** O que pede ação (ex.: competência sem avaliador). */
  avisos: string[];
  acoes: AcaoDoResumo[];
  vagas?: LinhaDasVagas[];
};

export type CompetenciaDoResumo = {
  id: string;
  ordem?: number | null;
  nome?: string | null;
  nota_maxima?: number | string | null;
  peso?: number | string | null;
  minimo?: number | string | null;
  tipo_minimo?: string | null;
};

export type RoteiroDoResumo = {
  nome?: string | null;
  versao?: number | null;
  escala?: string | null;
  passo?: number | string | null;
  notas_permitidas?: unknown[] | null;
  niveis?: { nota?: number | string | null; nome?: string | null }[] | null;
  nota_minima_total?: number | string | null;
  notas_eliminatorias?: unknown[] | null;
  ausencia_elimina?: boolean | null;
  competencias?: CompetenciaDoResumo[] | null;
  aspectos?:
    { id: string; ordem?: number | null; nome?: string | null }[] | null;
};

export type AvaliadorDoResumo = {
  id: string;
  nome?: string | null;
  origem?: string | null;
  banca?: number | string | null;
  ativo?: boolean | null;
  competencias?: string[] | null;
};

export type ConvocacaoDaRegra = {
  multiplo_vagas?: number | string | null;
  posicao_max_cr?: number | string | null;
  incluir_empatados?: boolean | null;
  excecoes?:
    | {
        termos?: string[] | null;
        multiplo_vagas?: number | string | null;
        posicao_max_cr?: number | string | null;
      }[]
    | null;
};

/** Uma vaga da lista de convocação (`vagasDaLista` de convocacao-da-entrevista.js). */
export type VagaDoResumo = {
  vaga: string;
  cargo?: string | null;
  total?: number | null;
  cadastroReserva?: boolean;
  limite?: number | null;
  semVagasNaLista?: boolean;
};

export type EntradaDoResumo = {
  /** A regra de classificação vigente existe? */
  temRegra: boolean;
  convocacao?: ConvocacaoDaRegra | null;
  vagas?: VagaDoResumo[];
  roteiro?: RoteiroDoResumo | null;
  avaliadores?: AvaliadorDoResumo[];
  lancamento?: string | null;
  /** Os critérios de desempate da Classificação, já com o nome, na ordem. */
  desempate?: { nome: string }[] | null;
  /** "Sorteio registrado" (o método do empate que sobra), ou "". */
  empateFinal?: string;
  /** Na ficha / na lista (o passo de convocação). */
  convocados?: { naFicha: number; naLista: number } | null;
};

const texto = (valor: unknown) => String(valor ?? "").trim();
const numero = (valor: unknown): number | null => {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(String(valor).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
export const numeroBr = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const pessoas = (n: number) =>
  `${numeroBr(n)} ${n === 1 ? "pessoa" : "pessoas"}`;
const ordinal = (n: number) => `${Math.trunc(n)}ª`;

/** "A", "A e B", "A, B e C". */
export function listaBr(itens: string[]): string {
  const limpos = itens.filter(Boolean);
  if (limpos.length <= 1) return limpos[0] ?? "";
  return `${limpos.slice(0, -1).join(", ")} e ${limpos[limpos.length - 1]}`;
}

const maiuscula = (frase: string) =>
  frase ? frase.charAt(0).toUpperCase() + frase.slice(1) : frase;
const comPonto = (frase: string) =>
  /[.!?]$/.test(frase) ? frase : `${frase}.`;

/* ── Quem é chamado ────────────────────────────────────────────────── */

/**
 * "até 3 pessoas por vaga imediata (Enfermeiro: 6 pessoas); nas vagas só de
 * cadastro reserva, até a 5ª posição; quem empatar com o último chamado
 * também entra" — a regra de convocação da Classificação (o mesmo que
 * `limiteDaConvocacao` do motor faz: com vagas imediatas, o múltiplo; só
 * cadastro reserva, a posição).
 */
export function fraseDaConvocacao(
  convocacao: ConvocacaoDaRegra | null | undefined,
): string {
  if (!convocacao || typeof convocacao !== "object") return "";
  const multiplo = numero(convocacao.multiplo_vagas);
  const posicao = numero(convocacao.posicao_max_cr);
  const excecoes = (convocacao.excecoes || [])
    .map((e) => {
      const termos = listaBr((e?.termos || []).map(texto));
      if (!termos) return "";
      const m = numero(e.multiplo_vagas);
      const p = numero(e.posicao_max_cr);
      const partes = [
        m !== null ? pessoas(m) : "",
        p !== null ? `cadastro reserva até a ${ordinal(p)}` : "",
      ].filter(Boolean);
      return partes.length ? `${termos}: ${partes.join(", ")}` : "";
    })
    .filter(Boolean);
  const partes: string[] = [];
  if (multiplo !== null)
    partes.push(
      `até ${pessoas(multiplo)} por vaga imediata${excecoes.length ? ` (${excecoes.join("; ")})` : ""}`,
    );
  if (posicao !== null)
    partes.push(
      multiplo !== null
        ? `nas vagas só de cadastro reserva, até a ${ordinal(posicao)} posição`
        : `até a ${ordinal(posicao)} posição de cada vaga${excecoes.length ? ` (${excecoes.join("; ")})` : ""}`,
    );
  if (!partes.length) return "todos os classificados (a regra não tem limite)";
  partes.push(
    convocacao.incluir_empatados === false
      ? "quem empatar com o último chamado só entra se couber no limite"
      : "quem empatar com o último chamado também entra",
  );
  return partes.join("; ");
}

/** A tabelinha "Vaga · vagas imediatas · chama até". */
export function linhasDasVagas(
  vagas: VagaDoResumo[] | undefined,
): LinhaDasVagas[] {
  return (vagas || [])
    .filter((v) => texto(v.vaga))
    .map((v) => {
      const total = v.semVagasNaLista ? null : numero(v.total);
      const limite = numero(v.limite);
      return {
        vaga: texto(v.vaga),
        cargo: texto(v.cargo),
        imediatas:
          total === null
            ? "—"
            : total === 0
              ? "cadastro reserva"
              : numeroBr(total),
        chamaAte: limite === null ? "—" : `até a ${ordinal(limite)}`,
      };
    });
}

/* ── Como a nota é calculada ───────────────────────────────────────── */

function competenciasEmOrdem<T extends { ordem?: number | null }>(
  roteiro: { competencias?: T[] | null } | null | undefined,
) {
  return [...(roteiro?.competencias || [])].sort(
    (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0),
  );
}

/** "de 0 a 5", "(0; 2,5 ou 5)" ou "na escala de cada competência". */
function escalaDoRoteiro(
  roteiro: RoteiroDoResumo,
  competencias: CompetenciaDoResumo[],
) {
  const maximas = [...new Set(competencias.map((c) => numero(c.nota_maxima)))];
  if (maximas.length !== 1) return "na escala de cada competência";
  const maxima = maximas[0] ?? null;
  const opcoes = opcoesDaEscala(roteiro, maxima).map((o) => o.valor);
  const escala = textoDaEscala(opcoes);
  if (!escala) return maxima === null ? "" : `de 0 a ${numeroBr(maxima)}`;
  if (/^\S+ a \S+$/.test(escala)) return `de ${escala}`;
  // "0; 2,5; 5" → "(0; 2,5 ou 5)": ponto e vírgula, porque a vírgula é a dos decimais.
  const partes = escala.split("; ");
  return `(${partes.slice(0, -1).join("; ")} ou ${partes[partes.length - 1]})`;
}

/* O que deixa inapto e a ausência, em frases sem ponto (frasesDaNota e frasesDaEliminacao). */
export type RoteiroParaEliminacao = Pick<
  RoteiroDoResumo,
  "nota_minima_total" | "notas_eliminatorias" | "ausencia_elimina"
> & {
  competencias?: Omit<CompetenciaDoResumo, "id">[] | null;
  aspectos?: readonly unknown[] | null;
};

function eliminacao(
  roteiro: RoteiroParaEliminacao,
  competencias: Omit<CompetenciaDoResumo, "id">[],
  comAspectos: boolean,
): string[] {
  const saida: string[] = [];
  const inapto: string[] = [];
  const minimos = competencias.map((c) => minimoEmPontos(c) as number | null);
  const comMinimo = minimos.filter((m): m is number => m !== null);
  if (comMinimo.length) {
    const iguais = new Set(comMinimo).size === 1;
    if (iguais && comMinimo.length === competencias.length)
      inapto.push(
        `abaixo de ${numeroBr(comMinimo[0] ?? 0)} em qualquer competência`,
      );
    else
      inapto.push(
        `abaixo do mínimo da competência (${competencias
          .map((c, i) => {
            const m = minimos[i];
            return m === null || m === undefined
              ? ""
              : `${texto(c.nome)}: ${numeroBr(m)}`;
          })
          .filter(Boolean)
          .join("; ")})`,
      );
  }
  const eliminatorias = comAspectos
    ? []
    : (roteiro.notas_eliminatorias || [])
        .map(numero)
        .filter((n): n is number => n !== null);
  if (eliminatorias.length)
    inapto.push(
      `com média ${listaBr(eliminatorias.map(numeroBr)).replace(/ e ([^ ]+)$/, " ou $1")} em alguma competência`,
    );
  const total = numero(roteiro.nota_minima_total);
  if (total !== null) inapto.push(`abaixo de ${numeroBr(total)} no total`);
  if (inapto.length)
    saida.push(`${inapto.join(" ou ")}, o candidato fica inapto`);
  saida.push(
    roteiro.ausencia_elimina === false
      ? "quem falta fica com nota 0, sem ser eliminado"
      : "quem falta é eliminado",
  );
  return saida;
}

/**
 * Só o que elimina, em frases simples para o editor do roteiro: "Abaixo de 2
 * em qualquer competência ou abaixo de 8 no total, o candidato fica inapto."
 * e "Quem falta é eliminado.".
 */
export function frasesDaEliminacao(
  roteiro: RoteiroParaEliminacao | null | undefined,
): string[] {
  const competencias = competenciasEmOrdem(roteiro);
  if (!roteiro) return [];
  return eliminacao(
    roteiro,
    competencias,
    Boolean(roteiro.aspectos?.length),
  ).map((f) => comPonto(maiuscula(f)));
}

/**
 * As frases de "Como a nota é calculada": o que cada avaliador dá, a média,
 * o que deixa inapto e a ausência. `porCompetencia`: há avaliador que não
 * avalia todas (a média é "dos avaliadores que a avaliam").
 */
export function frasesDaNota(
  roteiro: RoteiroDoResumo | null | undefined,
  porCompetencia = false,
): string[] {
  const competencias = competenciasEmOrdem(roteiro);
  if (!roteiro || !competencias.length) return [];
  const aspectos = [...(roteiro.aspectos || [])].sort(
    (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0),
  );
  const escala = escalaDoRoteiro(roteiro, competencias);
  const qtd = competencias.length;
  const cada =
    qtd === 1 ? "na competência" : `em cada uma das ${qtd} competências`;
  const frases: string[] = [];
  if (aspectos.length)
    frases.push(
      `cada avaliador dá ${aspectos.length} ${aspectos.length === 1 ? "nota" : "notas"} (${listaBr(aspectos.map((a) => texto(a.nome)))})${escala ? ` ${escala}` : ""} ${cada}; a nota dele na competência é a média dessas notas`,
    );
  else
    frases.push(
      `cada avaliador dá uma nota${escala ? ` ${escala}` : ""} ${cada}`,
    );

  const pesos = competencias
    .map((c) => ({ nome: texto(c.nome), peso: numero(c.peso) ?? 1 }))
    .filter((c) => c.peso !== 1);
  frases.push(
    `a nota da competência é a média dos avaliadores${porCompetencia ? " que a avaliam" : ""}${
      pesos.length
        ? ` vezes o peso (${pesos.map((p) => `${p.nome}: peso ${numeroBr(p.peso)}`).join("; ")})`
        : ""
    }; a nota final é a soma das competências, até ${numeroBr(pontuacaoMaxima(competencias))} pontos`,
  );

  frases.push(...eliminacao(roteiro, competencias, aspectos.length > 0));
  return frases.map((f) => comPonto(maiuscula(f)));
}

/* ── Quem avalia ───────────────────────────────────────────────────── */

const nomeDoMembro = (a: AvaliadorDoResumo) =>
  `${texto(a.nome) || "Sem nome"}${texto(a.origem) ? ` (${texto(a.origem)})` : ""}`;

/**
 * "Banca 1 — Avaliador Teste 1 (AgSUS) avalia todas as competências;
 * Avaliador Teste 2 (DSEI) avalia só Trabalho em equipe." Uma frase por
 * banca, mais o modo de lançamento; `avisos`: competência sem avaliador.
 */
export function frasesDaBanca(
  avaliadores: AvaliadorDoResumo[] | undefined,
  roteiro: RoteiroDoResumo | null | undefined,
  lancamento?: string | null,
): { frases: string[]; avisos: string[] } {
  const competencias = competenciasEmOrdem(roteiro);
  const ativos = (avaliadores || []).filter((a) => a.ativo !== false);
  if (!ativos.length)
    return { frases: ["Ainda sem membros na banca."], avisos: [] };
  const nomeDa = (id: string) =>
    texto(competencias.find((c) => c.id === id)?.nome);
  const porBanca = new Map<number, AvaliadorDoResumo[]>();
  for (const a of ativos) {
    const banca = numero(a.banca) ?? 1;
    porBanca.set(banca, [...(porBanca.get(banca) || []), a]);
  }
  const frases: string[] = [];
  for (const [banca, membros] of [...porBanca].sort((x, y) => x[0] - y[0])) {
    const partes = membros.map((a) => {
      if (!competencias.length || avaliaTodas(a, competencias))
        return `${nomeDoMembro(a)} avalia todas as competências`;
      const delas = (competenciasDoAvaliador(a, competencias) as string[]).map(
        nomeDa,
      );
      return `${nomeDoMembro(a)} avalia só ${listaBr(delas)}`;
    });
    frases.push(`Banca ${numeroBr(banca)} — ${partes.join("; ")}.`);
    const restrita = membros.some(
      (a) => competencias.length && !avaliaTodas(a, competencias),
    );
    if (restrita) {
      // Quantos avaliam cada competência, agrupado ("Trabalho em equipe: 2 avaliadores; as outras: 1").
      const contagem = competencias.map((c) => ({
        nome: texto(c.nome),
        quantos: membros.filter((a) =>
          (competenciasDoAvaliador(a, competencias) as string[]).includes(c.id),
        ).length,
      }));
      const porQuantos = new Map<number, string[]>();
      for (const c of contagem)
        porQuantos.set(c.quantos, [
          ...(porQuantos.get(c.quantos) || []),
          c.nome,
        ]);
      const grupos = [...porQuantos].map(([quantos, nomes]) => ({
        quantos,
        nomes,
      }));
      if (grupos.length > 1) {
        const avaliadoresEm = (n: number) =>
          `${n} ${n === 1 ? "avaliador" : "avaliadores"}`;
        const maior = grupos.reduce((m, g) =>
          g.nomes.length > m.nomes.length ? g : m,
        );
        const outros = grupos
          .filter((g) => g !== maior)
          .sort((x, y) => y.quantos - x.quantos);
        const frase = [
          ...outros.map(
            (g) => `${listaBr(g.nomes)}: ${avaliadoresEm(g.quantos)}`,
          ),
          `as outras: ${avaliadoresEm(maior.quantos)}`,
        ].join("; ");
        frases.push(`Na banca ${numeroBr(banca)}, ${frase}.`);
      }
    }
  }
  frases.push(
    lancamento === "AVALIADOR"
      ? "Cada avaliador lança as próprias notas no sistema."
      : "A secretaria passa a limpo as notas de cada avaliador.",
  );
  const avisos = (
    competenciasSemAvaliador(ativos, competencias) as {
      banca: number;
      competencia: CompetenciaDoResumo;
    }[]
  ).map(
    (f) =>
      `Na banca ${numeroBr(f.banca)}, ninguém avalia “${texto(f.competencia.nome)}”.`,
  );
  return { frases, avisos };
}

/* ── Desempate ─────────────────────────────────────────────────────── */

export function fraseDoDesempate(
  criterios: { nome: string }[] | null | undefined,
  empateFinal = "",
): string {
  const nomes = (criterios || []).map((c) => texto(c.nome)).filter(Boolean);
  if (!nomes.length) return "";
  const ordem = nomes
    .map((n, i) => `${i + 1}º ${n.charAt(0).toLowerCase()}${n.slice(1)}`)
    .join("; ");
  const fim = texto(empateFinal);
  return `Se a nota final empatar, vale, nesta ordem: ${ordem}.${
    fim
      ? ` Se ainda empatar: ${fim.charAt(0).toLowerCase()}${fim.slice(1)}.`
      : ""
  }`;
}

/* ── O resumo ──────────────────────────────────────────────────────── */

export function resumoDasRegrasDaEntrevista(
  entrada: EntradaDoResumo,
): BlocoDoResumo[] {
  const blocos: BlocoDoResumo[] = [];
  const convocacao = fraseDaConvocacao(entrada.convocacao);
  const naFicha = entrada.convocados;
  blocos.push({
    id: "convocacao",
    titulo: "Quem é chamado para a entrevista",
    frases: [
      entrada.temRegra
        ? comPonto(
            maiuscula(
              convocacao ||
                "a regra da Classificação ainda não define quem é chamado",
            ),
          )
        : "O edital ainda não tem regra de classificação: quem é chamado é definido lá.",
      ...(naFicha && naFicha.naLista
        ? [
            `Na ficha de notas: ${naFicha.naFicha} de ${naFicha.naLista} da lista de convocação.`,
          ]
        : []),
    ],
    avisos: [],
    acoes: [
      { destino: "classificacao", rotulo: "Editar" },
      { destino: "convocacao", rotulo: "Ver convocação" },
    ],
    vagas: linhasDasVagas(entrada.vagas),
  });

  const roteiro = entrada.roteiro || null;
  const competencias = competenciasEmOrdem(roteiro);
  const porCompetencia = (entrada.avaliadores || []).some(
    (a) =>
      a.ativo !== false &&
      competencias.length > 0 &&
      !avaliaTodas(a, competencias),
  );
  blocos.push({
    id: "nota",
    titulo: "Como a nota é calculada",
    frases: roteiro
      ? frasesDaNota(roteiro, porCompetencia)
      : ["Ainda sem roteiro: escolha o roteiro na configuração da entrevista."],
    avisos: [],
    acoes: [
      roteiro
        ? { destino: "roteiro", rotulo: "Editar" }
        : { destino: "configuracao", rotulo: "Escolher roteiro" },
    ],
  });

  const banca = frasesDaBanca(entrada.avaliadores, roteiro, entrada.lancamento);
  blocos.push({
    id: "banca",
    titulo: "Quem avalia",
    frases: banca.frases,
    avisos: banca.avisos,
    acoes: [{ destino: "configuracao", rotulo: "Editar" }],
  });

  const desempate = fraseDoDesempate(entrada.desempate, entrada.empateFinal);
  blocos.push({
    id: "desempate",
    titulo: "Desempate",
    frases: [
      desempate ||
        (entrada.temRegra
          ? "A regra da Classificação ainda não tem critérios de desempate."
          : "O desempate é o da regra de classificação do edital, que ainda não existe."),
    ],
    avisos: [],
    acoes: [{ destino: "classificacao", rotulo: "Editar" }],
  });
  return blocos;
}
