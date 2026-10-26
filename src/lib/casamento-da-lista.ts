/*
  O casamento da lista de aprovados (migration 20261026150000): quando uma
  lista nova substitui a vigente — pela planilha (XLSX) ou pelo resultado final
  da Classificação —, quem da lista vigente é a mesma pessoa de quem entra.

  A conta é do job Python (python/monitora/aprovados/casamento.py, pedido pelo
  banco em pedir_casamento_da_lista); a tela só mostra o plano
  (obter_casamento_da_lista) e, ao confirmar, o banco confere e aplica
  (aplicar_casamento_da_lista). Aqui, sem DOM e sem rede:
  - `pedidoLido` / `casamentoLido`: as respostas do banco, conferidas;
  - `acompanharCasamento`: espera o job (a cada `intervaloMs`, até `prazoMs`);
  - `numerosDoCasamento`: os números da prévia, na ordem da tela.
*/

export const INTERVALO_DO_CASAMENTO_MS = 3000;
export const PRAZO_DO_CASAMENTO_MS = 3 * 60 * 1000;

export type SituacaoDoCasamento =
  "PENDENTE" | "CALCULADO" | "ERRO" | "APLICADO" | "DESCARTADO";

export interface ResumoDoCasamento {
  casados: number;
  entram: number;
  sem_par: number;
  sem_dono: number;
  preservados: number;
  mudam: number;
  sub_judice_mantidos: number;
  ambiguos: number;
}
export interface PessoaDaListaVigente {
  candidato_id: string;
  nome: string;
  cargo: string;
  codigo_vaga: string;
  classificacao: number | null;
  status: string;
  matricula: string;
}
export interface QuemEntra {
  chave: string;
  nome: string;
  cargo: string;
  codigo_vaga: string;
  posicao: number | null;
  nota: number | null;
}
export interface VinculoDoPlano {
  candidato_id: string;
  chave: string;
  forma: "ANALISE" | "NOME" | "NOME_VAGA" | "MANUAL";
}
export interface PlanoDoCasamento {
  vinculos: VinculoDoPlano[];
  resumo: ResumoDoCasamento;
  pendencias: PessoaDaListaVigente[];
  mudam: {
    candidato_id: string;
    chave: string;
    de: number | null;
    para: number | null;
  }[];
}
export interface CasamentoDaLista {
  pedido_id: string;
  origem: "XLSX" | "CLASSIFICACAO";
  situacao: SituacaoDoCasamento;
  erro: string;
  disparo: string;
  exige_motivo: boolean;
  pode_substituir: boolean;
  anteriores: number;
  novos_total: number;
  manuais: Record<string, string>;
  plano: PlanoDoCasamento | null;
  /** Na Classificação: quem entra, para a revisão. */
  novos: QuemEntra[];
  /** Quem da lista vigente revisar (sem par com status, ou homônimo). */
  revisar: PessoaDaListaVigente[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SITUACOES: readonly SituacaoDoCasamento[] = [
  "PENDENTE",
  "CALCULADO",
  "ERRO",
  "APLICADO",
  "DESCARTADO",
];
const FORMAS = ["ANALISE", "NOME", "NOME_VAGA", "MANUAL"] as const;
const RESUMO = [
  "casados",
  "entram",
  "sem_par",
  "sem_dono",
  "preservados",
  "mudam",
  "sub_judice_mantidos",
  "ambiguos",
] as const;

type Registro = Record<string, unknown>;
const falha = () =>
  new Error("O banco respondeu a prévia da lista fora do formato.");
const registro = (v: unknown): Registro => {
  if (v === null || typeof v !== "object" || Array.isArray(v)) throw falha();
  return v as Registro;
};
const lista = (v: unknown, opcional = true): unknown[] => {
  if (v == null && opcional) return [];
  if (!Array.isArray(v)) throw falha();
  return v;
};
const texto = (v: unknown) => (v == null ? "" : String(v).trim());
const numero = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw falha();
  return n;
};
const inteiro = (v: unknown) => {
  const n = numero(v);
  if (n === null || n < 0 || !Number.isSafeInteger(n)) throw falha();
  return n;
};
const id = (v: unknown) => {
  const t = texto(v);
  if (!UUID.test(t)) throw falha();
  return t;
};

const pessoa = (v: unknown): PessoaDaListaVigente => {
  const r = registro(v);
  return {
    candidato_id: id(r.candidato_id),
    nome: texto(r.nome),
    cargo: texto(r.cargo),
    codigo_vaga: texto(r.codigo_vaga),
    classificacao: numero(r.classificacao),
    status: texto(r.status),
    matricula: texto(r.matricula),
  };
};

function planoLido(v: unknown): PlanoDoCasamento | null {
  if (v == null) return null;
  const r = registro(v);
  const resumo = registro(r.resumo);
  const vinculos = lista(r.vinculos, false).map((x) => {
    const y = registro(x);
    const forma = texto(y.forma) as VinculoDoPlano["forma"];
    if (!FORMAS.includes(forma) || !texto(y.chave)) throw falha();
    return { candidato_id: id(y.candidato_id), chave: texto(y.chave), forma };
  });
  return {
    vinculos,
    resumo: Object.fromEntries(
      RESUMO.map((chave) => [chave, inteiro(resumo[chave] ?? 0)]),
    ) as unknown as ResumoDoCasamento,
    pendencias: lista(r.pendencias).map(pessoa),
    mudam: lista(r.mudam).map((x) => {
      const y = registro(x);
      return {
        candidato_id: id(y.candidato_id),
        chave: texto(y.chave),
        de: numero(y.de),
        para: numero(y.para),
      };
    }),
  };
}

/** A resposta de pedir_casamento_da_lista: { pedido_id, situacao }. */
export function pedidoLido(bruto: unknown) {
  const r = registro(bruto);
  const situacao = texto(r.situacao) as SituacaoDoCasamento;
  if (!SITUACOES.includes(situacao)) throw falha();
  return { pedido_id: id(r.pedido_id), situacao };
}

/** A resposta de obter_casamento_da_lista, conferida. */
export function casamentoLido(bruto: unknown): CasamentoDaLista {
  const r = registro(bruto);
  const situacao = texto(r.situacao) as SituacaoDoCasamento;
  const origem = texto(r.origem);
  if (!SITUACOES.includes(situacao)) throw falha();
  if (origem !== "XLSX" && origem !== "CLASSIFICACAO") throw falha();
  const manuais = r.manuais == null ? {} : registro(r.manuais);
  const plano = planoLido(r.plano);
  if ((situacao === "CALCULADO" || situacao === "APLICADO") && !plano)
    throw falha();
  return {
    pedido_id: id(r.pedido_id),
    origem,
    situacao,
    erro: texto(r.erro),
    disparo: texto(r.disparo),
    exige_motivo: r.exige_motivo === true,
    pode_substituir: r.pode_substituir !== false,
    anteriores: inteiro(r.anteriores ?? 0),
    novos_total: inteiro(r.novos_total ?? 0),
    manuais: Object.fromEntries(
      Object.entries(manuais).map(([k, v]) => [k, texto(v)]),
    ),
    plano,
    novos: lista(r.novos).map((x) => {
      const y = registro(x);
      return {
        chave: texto(y.chave),
        nome: texto(y.nome),
        cargo: texto(y.cargo),
        codigo_vaga: texto(y.codigo_vaga),
        posicao: numero(y.posicao),
        nota: numero(y.nota),
      };
    }),
    revisar: lista(r.revisar).map(pessoa),
  };
}

/** O job ainda não respondeu este pedido. */
export const esperaOCasamento = (c: Pick<CasamentoDaLista, "situacao">) =>
  c.situacao === "PENDENTE";

const PEDIDO_NAO_CHEGOU = new Set(["SEM_TOKEN", "FALHOU"]);

/** Por que a prévia parou sem plano (a mensagem do banco vem antes). */
export function textoDoCasamentoParado(
  c: Pick<CasamentoDaLista, "situacao" | "erro" | "disparo">,
) {
  if (c.erro) return c.erro;
  if (c.situacao === "DESCARTADO") return "Outra prévia começou depois desta.";
  if (PEDIDO_NAO_CHEGOU.has(c.disparo))
    return "O pedido do cálculo do casamento não chegou ao GitHub.";
  return "O cálculo do casamento parou.";
}

/**
 * Espera o job gravar o plano. Devolve o casamento calculado, ou
 * `{ erro }` (o job falhou, o pedido não chegou ao GitHub, o prazo passou ou a
 * tela mudou — `vigente()` falso: erro vazio).
 */
export async function acompanharCasamento({
  pedidoId,
  obter,
  esperar,
  agora = () => Date.now(),
  intervaloMs = INTERVALO_DO_CASAMENTO_MS,
  prazoMs = PRAZO_DO_CASAMENTO_MS,
  vigente = () => true,
}: {
  pedidoId: string;
  obter: (pedidoId: string) => Promise<unknown>;
  esperar: (ms: number) => Promise<void>;
  agora?: () => number;
  intervaloMs?: number;
  prazoMs?: number;
  vigente?: () => boolean;
}): Promise<{ casamento: CasamentoDaLista } | { erro: string }> {
  const inicio = agora();
  let casamento = casamentoLido(await obter(pedidoId));
  while (esperaOCasamento(casamento)) {
    if (!vigente()) return { erro: "" };
    if (PEDIDO_NAO_CHEGOU.has(casamento.disparo))
      return { erro: textoDoCasamentoParado(casamento) };
    if (agora() - inicio >= prazoMs)
      return {
        erro: `O cálculo do casamento não chegou em ${Math.round(prazoMs / 60000)} min. Tente de novo.`,
      };
    await esperar(intervaloMs);
    casamento = casamentoLido(await obter(pedidoId));
  }
  if (!vigente()) return { erro: "" };
  if (casamento.situacao !== "CALCULADO")
    return { erro: textoDoCasamentoParado(casamento) };
  return { casamento };
}

/** Os números da prévia, na ordem em que a tela os mostra. */
export function numerosDoCasamento(c: CasamentoDaLista) {
  const r = c.plano?.resumo;
  return {
    casados: r?.casados ?? 0,
    entram: r?.entram ?? 0,
    semPar: r?.sem_par ?? 0,
    semDono: r?.sem_dono ?? 0,
    preservados: r?.preservados ?? 0,
    mudam: r?.mudam ?? 0,
    subJudiceMantidos: r?.sub_judice_mantidos ?? 0,
  };
}
