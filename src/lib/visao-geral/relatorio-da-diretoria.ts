import { formatarNota } from "../aprovados/lista-aprovados-rules.ts";
import { dataCurta } from "./visao-geral.ts";

/*
  AS ABAS 2 E 3 DO RELATÓRIO DA DIRETORIA (pedido de 13/11/2026)

  Aba 2, "vagas por cargo": uma linha por vaga de cada edital, com as vagas
  imediatas, os inscritos e os aprovados. Vem de
  listar_vagas_por_cargo_da_visao_geral (migration 20261116120000), que
  devolve as três fontes cruas — as vagas da Seleção, o quadro de vagas do
  edital e as contagens da lista vigente — porque os nomes não batem entre
  elas e a ligação é feita aqui:
    - lista → vaga: pelo código da vaga; nos editais de Projetos e da SEDE a
      lista guarda o texto da vaga (ou "128074 CARGO") no lugar do código, e
      aí vale o número do começo, o texto ou o começo do texto (a lista
      acrescenta a modalidade);
    - quadro → vaga: pelo cargo (sem acento, maiúscula nem carga horária) e
      pela lotação, quando o quadro tem; um item do quadro que serve a mais de
      uma vaga não é repartido, e a vaga cai no texto;
    - sem quadro, as vagas imediatas saem do texto da vaga ("2 vagas (…)";
      "Cadastro Reserva" = 0); sem nada, "—".
  Aprovado de vaga que não está na Seleção vira linha própria, sem inscritos.

  Aba 3, "aprovados": os candidatos das listas vigentes com nome, status,
  matrícula e a data de admissão conciliada com o RH. Vem de
  exportar_aprovados_da_diretoria, que registra cada download no banco.
*/

export interface VagaDaSelecao {
  monitoramentoId: string;
  codigo: string;
  vaga: string;
  cargo: string;
  unidade: string;
  inscritos: number | null;
}
export interface ItemDoQuadro {
  monitoramentoId: string;
  cargo: string;
  lotacao: string;
  vagas: number;
  reserva: boolean;
}
export interface GrupoDaLista {
  monitoramentoId: string;
  codigoVaga: string;
  cargo: string;
  aprovados: number;
}
export interface VagasPorCargo {
  vagas: VagaDaSelecao[];
  quadro: ItemDoQuadro[];
  lista: GrupoDaLista[];
}

export interface EditalDoRelatorio {
  id?: string | number;
  edital?: string;
  unidade?: string;
}

export interface LinhaPorCargo {
  edital: string;
  unidade: string;
  vaga: string;
  vagasImediatas: number | null;
  inscritos: number | null;
  aprovados: number;
}

const txt = (valor: unknown) => String(valor ?? "").trim();
const lista = (valor: unknown): Record<string, unknown>[] =>
  Array.isArray(valor)
    ? valor.filter(
        (x): x is Record<string, unknown> =>
          !!x && typeof x === "object" && !Array.isArray(x),
      )
    : [];
const inteiroOuNulo = (valor: unknown) => {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

/** A resposta de listar_vagas_por_cargo_da_visao_geral, conferida. */
export function normalizarVagasPorCargo(bruto: unknown): VagasPorCargo {
  const origem =
    bruto && typeof bruto === "object" && !Array.isArray(bruto)
      ? (bruto as Record<string, unknown>)
      : {};
  return {
    vagas: lista(origem.vagas)
      .map((v) => ({
        monitoramentoId: txt(v.monitoramento_id),
        codigo: txt(v.codigo),
        vaga: txt(v.vaga),
        cargo: txt(v.cargo),
        unidade: txt(v.unidade),
        inscritos: inteiroOuNulo(v.inscritos),
      }))
      .filter((v) => v.monitoramentoId && (v.vaga || v.cargo)),
    quadro: lista(origem.quadro)
      .map((q) => ({
        monitoramentoId: txt(q.monitoramento_id),
        cargo: txt(q.cargo),
        lotacao: txt(q.lotacao),
        vagas: inteiroOuNulo(q.vagas) ?? 0,
        reserva: q.reserva === true,
      }))
      .filter((q) => q.monitoramentoId && q.cargo),
    lista: lista(origem.lista)
      .map((g) => ({
        monitoramentoId: txt(g.monitoramento_id),
        codigoVaga: txt(g.codigo_vaga),
        cargo: txt(g.cargo),
        aprovados: inteiroOuNulo(g.aprovados) ?? 0,
      }))
      .filter((g) => g.monitoramentoId),
  };
}

/** Sem acento, sem maiúscula, só letras e números separados por um espaço. */
export function chaveDoTexto(valor: unknown): string {
  return txt(valor)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/* O cargo para comparar com o quadro: sem "Cargo 1:", "(a)" nem a carga horária ("30h"). */
const chaveDoCargo = (valor: unknown) =>
  chaveDoTexto(
    txt(valor)
      .replace(/^\s*cargo\s*\d+\s*:\s*/i, "")
      .replace(/\((a|as|o|os)\)/gi, " "),
  )
    .replace(/\b\d+\s*h(oras)?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/* "Cargo - Lotação - DSEI - 2 vagas (…)" → as partes, pelos traços com espaço. */
const partesDaVaga = (vaga: string) => vaga.split(/\s+[-–‐]\s+/);

/*
  O nome da vaga: o cargo da Seleção ("Enfermeiro - CASAI Brasília - 2 vagas
  (…)"); quase sempre o texto da planilha é só o código.
*/
const rotuloDaVaga = (v: VagaDaSelecao) => v.cargo || v.vaga;

/** Vagas imediatas pelo texto da vaga: "2 vagas (…)" → 2; "Cadastro Reserva" → 0; nada → null. */
export function vagasPeloTexto(vaga: unknown): number | null {
  const texto = txt(vaga);
  const achado = texto.match(/\b(\d{1,4})\s+vagas?\b/i);
  if (achado) return Number(achado[1]);
  if (/cadastro\s+(de\s+)?reserva/i.test(texto)) return 0;
  return null;
}

/* A vaga da Seleção que recebe um grupo da lista, ou -1. */
function vagaDoGrupo(grupo: GrupoDaLista, vagas: readonly VagaDaSelecao[]) {
  const codigo = grupo.codigoVaga;
  const pelo = (teste: (v: VagaDaSelecao) => boolean) => vagas.findIndex(teste);
  if (codigo) {
    let i = pelo((v) => !!v.codigo && v.codigo === codigo);
    if (i >= 0) return i;
    const numero = codigo.match(/^(\d{3,})\b/)?.[1];
    if (numero) {
      i = pelo((v) => v.codigo === numero);
      if (i >= 0) return i;
    }
  }
  for (const texto of [codigo, grupo.cargo]) {
    const chave = chaveDoTexto(texto);
    if (!chave) continue;
    const i = pelo(
      (v) => chaveDoTexto(v.vaga) === chave || chaveDoTexto(v.cargo) === chave,
    );
    if (i >= 0) return i;
  }
  /*
    Em Projetos a lista acrescenta a modalidade ("… - PIAUÍ - AMPLA
    CONCORRÊNCIA"): vale a vaga cujo nome é o começo do texto (a mais longa).
  */
  let melhor = -1;
  let tamanho = 0;
  for (const texto of [grupo.cargo, codigo]) {
    const chave = chaveDoTexto(texto);
    if (!chave) continue;
    vagas.forEach((v, i) => {
      for (const nome of [chaveDoTexto(v.cargo), chaveDoTexto(v.vaga)])
        if (nome.length > tamanho && chave.startsWith(`${nome} `)) {
          melhor = i;
          tamanho = nome.length;
        }
    });
  }
  return melhor;
}

/*
  Os itens do quadro de uma vaga: mesmo cargo e, quando o quadro tem lotação, a
  mesma (a do texto da vaga ou a unidade da Seleção).
*/
function itensDoQuadro(vaga: VagaDaSelecao, quadro: readonly ItemDoQuadro[]) {
  const partes = partesDaVaga(rotuloDaVaga(vaga));
  const cargo = chaveDoCargo(partes[0]);
  const lotacoes = [chaveDoTexto(partes[1]), chaveDoTexto(vaga.unidade)].filter(
    Boolean,
  );
  /* A planilha corta textos longos ("Polo Base Barra do Cord..."): vale o começo. */
  const cortada = /(\.\.\.|…)\s*$/.test(partes[1] ?? "");
  const mesmaLotacao = (lotacao: string) =>
    lotacoes.includes(lotacao) ||
    (cortada && !!lotacoes[0] && lotacao.startsWith(lotacoes[0]));
  if (!cargo) return [];
  return quadro
    .map((item, i) => ({ item, i }))
    .filter(
      ({ item }) =>
        chaveDoCargo(item.cargo) === cargo &&
        (!item.lotacao || mesmaLotacao(chaveDoTexto(item.lotacao))),
    );
}

/**
 * As linhas da aba 2, na ordem dos editais do recorte (e, dentro do edital,
 * pela vaga). Só os editais do recorte entram.
 */
export function linhasPorCargo(
  dados: VagasPorCargo,
  editais: readonly EditalDoRelatorio[],
): LinhaPorCargo[] {
  const linhas: LinhaPorCargo[] = [];
  const ordenar = (a: LinhaPorCargo, b: LinhaPorCargo) =>
    a.vaga.localeCompare(b.vaga, "pt-BR", { sensitivity: "base" });
  const vistos = new Set<string>();
  for (const edital of editais) {
    const id = txt(edital.id);
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    const vagas = dados.vagas.filter((v) => v.monitoramentoId === id);
    const quadro = dados.quadro.filter((q) => q.monitoramentoId === id);
    const grupos = dados.lista.filter((g) => g.monitoramentoId === id);
    const rotulo = txt(edital.edital) || "—";

    // A lista em cada vaga.
    const aprovados = vagas.map(() => 0);
    const soltos = new Map<string, LinhaPorCargo>();
    for (const grupo of grupos) {
      const i = vagaDoGrupo(grupo, vagas);
      if (i >= 0) {
        aprovados[i] = (aprovados[i] ?? 0) + grupo.aprovados;
        continue;
      }
      const vaga = grupo.cargo || grupo.codigoVaga || "Sem vaga informada";
      const chave = chaveDoTexto(vaga);
      const linha = soltos.get(chave);
      if (linha) linha.aprovados += grupo.aprovados;
      else
        soltos.set(chave, {
          edital: rotulo,
          unidade: txt(edital.unidade) || "—",
          vaga,
          vagasImediatas: vagasPeloTexto(vaga),
          inscritos: null,
          aprovados: grupo.aprovados,
        });
    }

    // O quadro em cada vaga (um item do quadro não se reparte entre vagas).
    const itens = vagas.map((v) => itensDoQuadro(v, quadro));
    const usos = new Map<number, number>();
    for (const achados of itens)
      for (const { i } of achados) usos.set(i, (usos.get(i) ?? 0) + 1);

    const doEdital = vagas.map((v, n) => {
      const achados = itens[n] ?? [];
      const peloQuadro =
        achados.length && achados.every(({ i }) => usos.get(i) === 1)
          ? achados.reduce((soma, { item }) => soma + item.vagas, 0)
          : null;
      return {
        edital: rotulo,
        unidade: v.unidade || txt(edital.unidade) || "—",
        vaga: rotuloDaVaga(v),
        vagasImediatas: peloQuadro ?? vagasPeloTexto(rotuloDaVaga(v)),
        inscritos: v.inscritos,
        aprovados: aprovados[n] ?? 0,
      };
    });
    linhas.push(...[...doEdital, ...soltos.values()].sort(ordenar));
  }
  return linhas;
}

// ── Aba 3 ───────────────────────────────────────────────────────────────

export interface AprovadoDaDiretoria {
  monitoramentoId: string;
  cargo: string;
  nota: number | null;
  classificacao: number | null;
  nome: string;
  status: string;
  matricula: string;
  admissao: string;
}
export interface ExportacaoDaDiretoria {
  id: string;
  emitidaEm: string;
  aprovados: AprovadoDaDiretoria[];
}

/** A resposta de exportar_aprovados_da_diretoria, conferida (sem o id do registro, recusa). */
export function normalizarAprovadosDaDiretoria(
  bruto: unknown,
): ExportacaoDaDiretoria {
  const origem =
    bruto && typeof bruto === "object" && !Array.isArray(bruto)
      ? (bruto as Record<string, unknown>)
      : {};
  const id = txt(origem.exportacao_id);
  if (!id) throw new Error("O banco não registrou o download dos aprovados.");
  return {
    id,
    emitidaEm: txt(origem.emitida_em),
    aprovados: lista(origem.aprovados).map((a) => {
      const nota = Number(a.nota);
      return {
        monitoramentoId: txt(a.monitoramento_id),
        cargo: txt(a.cargo),
        nota:
          a.nota === null || a.nota === undefined || !Number.isFinite(nota)
            ? null
            : nota,
        classificacao: inteiroOuNulo(a.classificacao),
        nome: txt(a.nome),
        status: txt(a.status),
        matricula: txt(a.matricula),
        admissao: txt(a.admissao),
      };
    }),
  };
}

/** As linhas da aba 3 (textos prontos), na ordem dos editais do recorte. */
export function linhasDeAprovados(
  aprovados: readonly AprovadoDaDiretoria[],
  editais: readonly EditalDoRelatorio[],
): string[][] {
  const linhas: string[][] = [];
  const vistos = new Set<string>();
  for (const edital of editais) {
    const id = txt(edital.id);
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    const rotulo = txt(edital.edital) || "—";
    for (const a of aprovados) {
      if (a.monitoramentoId !== id) continue;
      linhas.push([
        rotulo,
        a.cargo || "—",
        a.nota === null ? "—" : formatarNota(a.nota),
        a.classificacao === null ? "—" : String(a.classificacao),
        a.nome || "—",
        a.status || "Sem status",
        a.matricula || "—",
        dataCurta(a.admissao) || "—",
      ]);
    }
  }
  return linhas;
}

/** Aprovados demais para o PDF: acima disto, o relatório pede o Excel. */
export const LIMITE_DE_APROVADOS_NO_PDF = 3000;

/** Quantos aprovados o recorte tem (pela contagem da lista de cada edital). */
export function aprovadosNoRecorte(
  editais: readonly { aprovados?: number | null }[],
): number {
  return editais.reduce((soma, e) => soma + (Number(e.aprovados) || 0), 0);
}
