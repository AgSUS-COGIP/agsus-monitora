/*
  Pendências do edital, sem React e sem banco: o que chega de
  `listar_pendencias_do_edital` (migration 20261026190000) vira a lista da aba
  Pendências da Lista de aprovados — título e tom de cada tipo, o detalhe em
  uma linha, a contagem por tipo e por edital, os filtros — e a decisão do
  gestor vira a chamada da RPC certa, já validada (motivo obrigatório, linha
  escolhida, matrícula, data).

  A detecção é do job Python (python/monitora/aprovados/pendencias.py); quem
  pode decidir vem do banco em cada pendência (`pode_decidir`: o administrador
  global sempre; os outros, pela permissão "Pendências dos aprovados" da matriz
  de Acessos, no recorte de área e edital).
*/

export type TipoDePendencia =
  | "CONTRATADO_DUAS_MATRICULAS"
  | "CONTRATADO_EM_DUAS_LISTAS"
  | "PESSOA_REPETIDA"
  | "POSICAO_REPETIDA"
  | "CONVOCADO_SEM_DESFECHO";

export type SituacaoDaPendencia = "ABERTA" | "RESOLVIDA";

export interface LinhaDaPendencia {
  id: string;
  nome: string;
  cargo: string;
  vaga: string;
  modalidade: string;
  posicao: number | null;
  nota: number | null;
  status: string;
  matricula: string;
  convocadoEm: string;
  listaAtiva: boolean;
  removida: boolean;
}

export interface EventoDaPendencia {
  evento: string;
  decisao: string;
  motivo: string;
  por: string;
  em: string;
  alteracoes: readonly {
    candidato: string;
    campo: string;
    antes: unknown;
    depois: unknown;
  }[];
}

export interface PendenciaDoEdital {
  id: string;
  tipo: TipoDePendencia;
  situacao: SituacaoDaPendencia;
  editalId: string;
  edital: string;
  unidade: string;
  detalhe: Readonly<Record<string, unknown>>;
  detectadaEm: string;
  decisao: string;
  motivo: string;
  decididaEm: string;
  decididaPor: string;
  podeDecidir: boolean;
  linhas: readonly LinhaDaPendencia[];
  historico: readonly EventoDaPendencia[];
}

export const TIPOS_DE_PENDENCIA: Readonly<
  Record<
    TipoDePendencia,
    Readonly<{ titulo: string; curto: string; icone: string; tom: string }>
  >
> = Object.freeze({
  CONTRATADO_DUAS_MATRICULAS: Object.freeze({
    titulo: "Contratado com duas matrículas",
    curto: "Duas matrículas",
    icone: "fa-id-card",
    tom: "perigo",
  }),
  CONTRATADO_EM_DUAS_LISTAS: Object.freeze({
    titulo: "Contratado em duas listas",
    curto: "Duas listas",
    icone: "fa-copy",
    tom: "alerta",
  }),
  PESSOA_REPETIDA: Object.freeze({
    titulo: "Pessoa repetida na lista",
    curto: "Pessoa repetida",
    icone: "fa-user-group",
    tom: "alerta",
  }),
  POSICAO_REPETIDA: Object.freeze({
    titulo: "Posição repetida",
    curto: "Posição repetida",
    icone: "fa-arrow-down-1-9",
    tom: "info",
  }),
  CONVOCADO_SEM_DESFECHO: Object.freeze({
    titulo: "Convocado sem desfecho",
    curto: "Convocado sem desfecho",
    icone: "fa-envelope-open-text",
    tom: "alerta",
  }),
});

export const ORDEM_DOS_TIPOS = Object.freeze(
  Object.keys(TIPOS_DE_PENDENCIA),
) as readonly TipoDePendencia[];

export const DECISOES: Readonly<Record<string, string>> = Object.freeze({
  VINCULO_ESCOLHIDO: "Vínculo escolhido",
  LISTA_ESCOLHIDA: "Lista da contratação escolhida",
  LINHA_MANTIDA: "Linha mantida, a outra saiu",
  PESSOAS_DIFERENTES: "São pessoas diferentes",
  EMPATE_PREVISTO: "Empate previsto no edital",
  POSICAO_CORRIGIDA: "Posição corrigida",
  DESFECHO_REGISTRADO: "Desfecho registrado",
  NOVA_DATA: "Nova data da convocação",
  SANEADA: "Resolvida na própria lista",
});

/* As RPCs da decisão (src/lib/rpc-contrato.js): uma por tipo de decisão. */
const RPC_ESCOLHER_VINCULO = "escolher_vinculo_do_contratado";
const RPC_ESCOLHER_LISTA = "escolher_lista_da_contratacao";
const RPC_MANTER_LINHA = "manter_linha_da_pessoa_repetida";
const RPC_CONFIRMAR_EMPATE = "confirmar_empate_da_posicao";
const RPC_CORRIGIR_POSICAO = "corrigir_posicao_da_pendencia";
const RPC_REGISTRAR_DESFECHO = "registrar_desfecho_da_pendencia";

export const MOTIVO_MINIMO = 3;
export const MOTIVO_MAXIMO = 500;

const MOTIVOS_DA_REGRA: Readonly<Record<string, string>> = Object.freeze({
  NENHUMA_ALCANCADA: "nenhuma linha está dentro do que a convocação já chamou",
  MAIS_DE_UMA_AMPLA: "a convocação alcançou a pessoa em mais de uma ampla",
  NENHUMA_AMPLA: "a convocação alcançou a pessoa em mais de uma cota",
});

const texto = (valor: unknown) =>
  valor === null || valor === undefined ? "" : String(valor).trim();
const numeroOuNulo = (valor: unknown) => {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
};
const registro = (valor: unknown): Record<string, unknown> =>
  valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
const lista = (valor: unknown): unknown[] =>
  Array.isArray(valor) ? valor : [];

function normalizarLinha(entrada: unknown): LinhaDaPendencia {
  const l = registro(entrada);
  return {
    id: texto(l.id),
    nome: texto(l.nome),
    cargo: texto(l.cargo),
    vaga: texto(l.vaga),
    modalidade: texto(l.modalidade).replace(/^["“”']+|["“”']+$/g, ""),
    posicao: numeroOuNulo(l.posicao),
    nota: numeroOuNulo(l.nota),
    status: texto(l.status),
    matricula: texto(l.matricula),
    convocadoEm: texto(l.convocado_em),
    listaAtiva: l.lista_ativa === true,
    removida: l.removida === true,
  };
}

function normalizarEvento(entrada: unknown): EventoDaPendencia {
  const e = registro(entrada);
  return {
    evento: texto(e.evento),
    decisao: texto(e.decisao),
    motivo: texto(e.motivo),
    por: texto(e.por),
    em: texto(e.em),
    alteracoes: lista(e.alteracoes).map((a) => {
      const r = registro(a);
      return {
        candidato: texto(r.candidato),
        campo: texto(r.campo),
        antes: r.antes ?? null,
        depois: r.depois ?? null,
      };
    }),
  };
}

/** Uma pendência de `listar_pendencias_do_edital`; tipo desconhecido vira `null`. */
export function normalizarPendencia(
  entrada: unknown,
): PendenciaDoEdital | null {
  const p = registro(entrada);
  const tipo = texto(p.tipo) as TipoDePendencia;
  if (!TIPOS_DE_PENDENCIA[tipo] || !texto(p.id)) return null;
  return {
    id: texto(p.id),
    tipo,
    situacao: p.situacao === "RESOLVIDA" ? "RESOLVIDA" : "ABERTA",
    editalId: texto(p.edital_id),
    edital: texto(p.edital),
    unidade: texto(p.unidade),
    detalhe: Object.freeze({ ...registro(p.detalhe) }),
    detectadaEm: texto(p.detectada_em),
    decisao: texto(p.decisao),
    motivo: texto(p.motivo),
    decididaEm: texto(p.decidida_em),
    decididaPor: texto(p.decidida_por),
    podeDecidir: p.pode_decidir === true,
    linhas: lista(p.linhas).map(normalizarLinha),
    historico: lista(p.historico).map(normalizarEvento),
  };
}

/** A resposta inteira: `{ pendencias }`; formato desconhecido é erro. */
export function normalizarResposta(entrada: unknown): {
  pendencias: readonly PendenciaDoEdital[];
} {
  const r = registro(entrada);
  if (r.schema_version !== 1 || !Array.isArray(r.pendencias))
    throw new Error("Resposta das pendências em formato desconhecido.");
  return {
    pendencias: r.pendencias
      .map(normalizarPendencia)
      .filter((p): p is PendenciaDoEdital => p !== null),
  };
}

/** "26/10/2026" de uma data ISO (sem fuso: a data da convocação é um dia). */
export function diaBr(valor: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** O detalhe da pendência em uma linha (contagens, posição, datas). */
export function textoDoDetalhe(p: PendenciaDoEdital) {
  const d = p.detalhe;
  const linhas = numeroOuNulo(d.linhas) ?? p.linhas.length;
  switch (p.tipo) {
    case "CONTRATADO_DUAS_MATRICULAS":
      return `${numeroOuNulo(d.vinculos) ?? 2} matrículas em ${linhas} linhas deste edital`;
    case "CONTRATADO_EM_DUAS_LISTAS": {
      const porque = MOTIVOS_DA_REGRA[texto(d.motivo)];
      return `Mesma matrícula em ${linhas} listas${porque ? `: ${porque}` : ""}`;
    }
    case "PESSOA_REPETIDA":
      return `${linhas} linhas da mesma pessoa na mesma vaga e modalidade`;
    case "POSICAO_REPETIDA":
      return `Posição ${texto(d.posicao)} em ${linhas} linhas da mesma vaga e modalidade`;
    case "CONVOCADO_SEM_DESFECHO": {
      const dia = diaBr(texto(d.convocado_em));
      const dias = numeroOuNulo(d.dias);
      return dia
        ? `Convocado em ${dia}${dias !== null ? `, há ${dias} dias` : ""}, sem desfecho`
        : "Convocado sem desfecho";
    }
  }
}

/** Abertas por tipo (o selo da aba e os indicadores). */
export function contarAbertas(
  pendencias: readonly PendenciaDoEdital[],
  editalId = "",
) {
  const contagem = Object.fromEntries(
    ORDEM_DOS_TIPOS.map((t) => [t, 0]),
  ) as Record<TipoDePendencia, number>;
  let total = 0;
  for (const p of pendencias) {
    if (p.situacao !== "ABERTA" || (editalId && p.editalId !== editalId))
      continue;
    contagem[p.tipo] += 1;
    total += 1;
  }
  return { total, porTipo: contagem };
}

/** Os editais com pendência, para o filtro: `[{ valor, rotulo, abertas }]`. */
export function editaisDasPendencias(pendencias: readonly PendenciaDoEdital[]) {
  const por = new Map<
    string,
    { valor: string; rotulo: string; abertas: number }
  >();
  for (const p of pendencias) {
    const item = por.get(p.editalId) || {
      valor: p.editalId,
      rotulo: [p.edital, p.unidade].filter(Boolean).join(" · ") || "Edital",
      abertas: 0,
    };
    if (p.situacao === "ABERTA") item.abertas += 1;
    por.set(p.editalId, item);
  }
  return [...por.values()].sort((a, b) =>
    a.rotulo.localeCompare(b.rotulo, "pt-BR", { numeric: true }),
  );
}

export interface FiltroDasPendencias {
  editalId?: string;
  situacao?: SituacaoDaPendencia;
  tipo?: TipoDePendencia | "";
}

export function filtrarPendencias(
  pendencias: readonly PendenciaDoEdital[],
  { editalId = "", situacao = "ABERTA", tipo = "" }: FiltroDasPendencias = {},
) {
  return pendencias.filter(
    (p) =>
      p.situacao === situacao &&
      (!editalId || p.editalId === editalId) &&
      (!tipo || p.tipo === tipo),
  );
}

// ── A decisão ──────────────────────────────────────────────────────────────

export const DESFECHOS_DAS_OUTRAS = Object.freeze([
  "Contratado em outra lista",
  "Desistente",
  "Sem status",
]);
export const DESFECHOS_DO_CONVOCADO = Object.freeze([
  "Contratado",
  "Migração",
  "Desistente",
  "Documentação Rejeitada",
  "Convocado",
]);

export interface RascunhoDaDecisao {
  /** A linha escolhida (que fica, que vale, a corrigir). */
  linha?: string;
  /** PESSOA_REPETIDA: são pessoas diferentes (ficam todas). */
  pessoasDiferentes?: boolean;
  /** CONTRATADO_DUAS_MATRICULAS: o desfecho das outras matrículas. */
  outras?: string;
  /** POSICAO_REPETIDA: "empate" ou "corrigir". */
  acao?: "empate" | "corrigir" | "";
  posicao?: string;
  /** CONVOCADO_SEM_DESFECHO: o desfecho ("Convocado" = nova data). */
  status?: string;
  matricula?: string;
  data?: string;
  motivo?: string;
}

export interface ChamadaDaDecisao {
  rpc: string;
  argumentos: Record<string, unknown>;
}

/** As linhas que se escolhem na decisão (Contratado, nos dois tipos de contratação). */
export function linhasEscolhiveis(p: PendenciaDoEdital) {
  if (
    p.tipo === "CONTRATADO_DUAS_MATRICULAS" ||
    p.tipo === "CONTRATADO_EM_DUAS_LISTAS"
  )
    return p.linhas.filter((l) => l.status === "Contratado" && !l.removida);
  if (p.tipo === "CONVOCADO_SEM_DESFECHO") return [];
  return p.linhas.filter((l) => !l.removida);
}

/**
 * A decisão vira a chamada: `{ chamada }` ou `{ erro }` (a mensagem para a
 * tela). `hoje` é AAAA-MM-DD (Brasília).
 */
export function chamadaDaDecisao(
  p: PendenciaDoEdital,
  rascunho: RascunhoDaDecisao,
  hoje: string,
):
  | { chamada: ChamadaDaDecisao; erro?: undefined }
  | { erro: string; chamada?: undefined } {
  const motivo = texto(rascunho.motivo);
  const linha = texto(rascunho.linha);
  const escolhivel = linhasEscolhiveis(p).some((l) => l.id === linha);
  if (motivo.length < MOTIVO_MINIMO || motivo.length > MOTIVO_MAXIMO)
    return {
      erro: `Informe o motivo (${MOTIVO_MINIMO} a ${MOTIVO_MAXIMO} caracteres).`,
    };
  const base = { p_pendencia: p.id, p_motivo: motivo };
  switch (p.tipo) {
    case "CONTRATADO_DUAS_MATRICULAS": {
      if (!escolhivel) return { erro: "Escolha a linha que vale." };
      const outras = texto(rascunho.outras) || DESFECHOS_DAS_OUTRAS[0]!;
      if (!DESFECHOS_DAS_OUTRAS.includes(outras))
        return { erro: "Escolha o desfecho das outras linhas." };
      return {
        chamada: {
          rpc: RPC_ESCOLHER_VINCULO,
          argumentos: {
            ...base,
            p_candidato: linha,
            p_status_das_outras: outras,
          },
        },
      };
    }
    case "CONTRATADO_EM_DUAS_LISTAS":
      if (!escolhivel)
        return { erro: "Escolha a lista pela qual a pessoa foi contratada." };
      return {
        chamada: {
          rpc: RPC_ESCOLHER_LISTA,
          argumentos: { ...base, p_candidato: linha },
        },
      };
    case "PESSOA_REPETIDA":
      if (!rascunho.pessoasDiferentes && !escolhivel)
        return { erro: "Escolha a linha que fica." };
      return {
        chamada: {
          rpc: RPC_MANTER_LINHA,
          argumentos: {
            ...base,
            p_candidato: rascunho.pessoasDiferentes ? null : linha,
          },
        },
      };
    case "POSICAO_REPETIDA": {
      if (rascunho.acao === "empate")
        return {
          chamada: { rpc: RPC_CONFIRMAR_EMPATE, argumentos: base },
        };
      if (rascunho.acao !== "corrigir")
        return { erro: "Confirme o empate ou corrija a posição." };
      if (!escolhivel) return { erro: "Escolha a linha a corrigir." };
      const posicao = Number(texto(rascunho.posicao));
      if (!Number.isInteger(posicao) || posicao < 1 || posicao > 100000)
        return {
          erro: "Informe a posição nova (número inteiro de 1 a 100000).",
        };
      if (p.linhas.find((l) => l.id === linha)?.posicao === posicao)
        return { erro: "A posição nova é igual à atual." };
      return {
        chamada: {
          rpc: RPC_CORRIGIR_POSICAO,
          argumentos: { ...base, p_candidato: linha, p_posicao: posicao },
        },
      };
    }
    case "CONVOCADO_SEM_DESFECHO": {
      const status = texto(rascunho.status);
      if (!DESFECHOS_DO_CONVOCADO.includes(status))
        return { erro: "Escolha o desfecho." };
      const matricula = texto(rascunho.matricula);
      if ((status === "Contratado" || status === "Migração") && !matricula)
        return { erro: "Informe a matrícula para Contratado ou Migração." };
      const data = texto(rascunho.data);
      if (status === "Convocado") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data))
          return { erro: "Informe a nova data da convocação." };
        if (data > hoje)
          return { erro: "A data da convocação não pode ser futura." };
        if (data === p.linhas[0]?.convocadoEm)
          return { erro: "A nova data é igual à atual." };
      }
      return {
        chamada: {
          rpc: RPC_REGISTRAR_DESFECHO,
          argumentos: {
            ...base,
            p_status: status,
            p_matricula:
              status === "Contratado" || status === "Migração"
                ? matricula
                : null,
            p_data_convocacao: status === "Convocado" ? data : null,
          },
        },
      };
    }
  }
}

/** "Contratado → Contratado em outra lista", "posição 7 → 8", "saiu da lista". */
export function textoDaAlteracao(a: EventoDaPendencia["alteracoes"][number]) {
  const valor = (v: unknown) =>
    v === null || v === undefined || v === "" ? "sem status" : String(v);
  if (a.campo === "removido") return "saiu da lista";
  if (a.campo === "posicao")
    return `posição ${valor(a.antes)} → ${valor(a.depois)}`;
  return `${valor(a.antes)} → ${valor(a.depois)}`;
}
