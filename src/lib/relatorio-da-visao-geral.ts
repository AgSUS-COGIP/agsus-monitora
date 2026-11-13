import type {
  Atalho,
  ColunaDaTabela,
  FiltrosDaVisaoGeral,
  Indicadores,
  LinhaDaVisaoGeral,
  TextosDaVisaoGeral,
} from "../modulos/visao-geral/tipos.ts";
import type {
  CelulaDaPlanilha,
  PlanilhaDaClassificacao,
} from "./classificacao/tipos-dos-documentos.ts";
import type { ZiparComCompressao } from "./exportacao-da-lista-de-aprovados.ts";
import { arquivosDoXlsx } from "./classificacao/exportacao.ts";
import { hojeEmBrasilia } from "./cronograma-do-edital.ts";
import {
  contratacoesDoCadastroReserva,
  contratadasImediatas,
  ehCritica,
} from "./indicadores-do-monitoramento.ts";
import {
  COLUNAS_DA_TABELA,
  COLUNAS_INICIAIS,
  dataCurta,
  duracaoEmDias,
  INDICADORES,
  resumoDoRelatorio,
  taxaDeOciosidade,
} from "./visao-geral.ts";

/*
  O MONTADOR DE RELATÓRIO DA VISÃO GERAL (pedido de 13/11/2026: "no SIGEPSI
  você consegue montar o relatório do jeito que quiser")

  Quem gera escolhe as seções, as colunas da tabela dos editais e o formato
  (PDF ou Excel), ou parte de um modelo pronto. Tudo sai do recorte da tela
  (área, filtros, busca e atalho). Aqui, sem DOM: a escolha normalizada, o
  conteúdo (textos prontos) e as planilhas do Excel. O PDF é desenhado em
  relatorio-da-visao-geral-em-pdf.ts; a janela, em
  src/modulos/visao-geral/montador-de-relatorio.tsx.
*/

export type SecaoDoRelatorio = "numeros" | "editais" | "atencao";
export type FormatoDoRelatorio = "PDF" | "XLSX" | "CSV";

export const SECOES_DO_RELATORIO: readonly {
  id: SecaoDoRelatorio;
  rotulo: string;
}[] = Object.freeze([
  { id: "numeros", rotulo: "Resumo em números" },
  { id: "editais", rotulo: "Tabela dos editais" },
  { id: "atencao", rotulo: "Editais que pedem atenção" },
]);

export const FORMATOS_DO_RELATORIO: readonly {
  valor: FormatoDoRelatorio;
  rotulo: string;
  icone: string;
}[] = Object.freeze([
  { valor: "PDF", rotulo: "PDF", icone: "fa-file-pdf" },
  { valor: "XLSX", rotulo: "Planilha (XLSX)", icone: "fa-file-excel" },
  /* O CSV de antes: todas as colunas da tabela, sem as seções. */
  { valor: "CSV", rotulo: "CSV", icone: "fa-file-csv" },
]);

export interface EscolhaDoRelatorio {
  secoes: readonly SecaoDoRelatorio[];
  colunas: readonly ColunaDaTabela[];
  formato: FormatoDoRelatorio;
}

/* As colunas que cabem no relatório: as da tabela da tela, menos Observações (texto longo). */
export const COLUNAS_DO_RELATORIO = Object.freeze(
  COLUNAS_DA_TABELA.filter((c) => c.campo !== "observacoes"),
);

export const MODELOS_DO_RELATORIO: readonly {
  id: string;
  rotulo: string;
  escolha: EscolhaDoRelatorio;
}[] = Object.freeze([
  {
    id: "resumo",
    rotulo: "Resumo rápido",
    escolha: {
      secoes: ["numeros", "editais"],
      colunas: [
        "unidade",
        "edital",
        "ciclo",
        "vagas_total",
        "inscritos",
        "contratados",
        "vagas_ociosas",
        "status",
      ],
      formato: "PDF",
    },
  },
  {
    id: "completo",
    rotulo: "Completo",
    escolha: {
      secoes: ["numeros", "editais", "atencao"],
      colunas: COLUNAS_INICIAIS.filter((c) => c !== "atencao"),
      formato: "PDF",
    },
  },
  {
    /* A 1ª aba do relatório da diretoria (13/11/2026); as outras duas vêm depois. */
    id: "diretoria",
    rotulo: "Diretoria: resumo dos editais",
    escolha: {
      secoes: ["editais"],
      colunas: [
        "edital",
        "unidade",
        "vagas_total",
        "data_inicio",
        "data_fim",
        "ciclo",
      ],
      formato: "XLSX",
    },
  },
]);

const SECOES = new Set(SECOES_DO_RELATORIO.map((s) => s.id));
const COLUNAS = new Set(COLUNAS_DO_RELATORIO.map((c) => c.campo));

/** Do armazenamento (ou de qualquer origem): só o que existe, na ordem da tela. */
export function normalizarEscolha(bruto: unknown): EscolhaDoRelatorio {
  const padrao = MODELOS_DO_RELATORIO[0]!.escolha;
  const origem =
    bruto && typeof bruto === "object" && !Array.isArray(bruto)
      ? (bruto as Record<string, unknown>)
      : {};
  const lista = (valor: unknown) =>
    Array.isArray(valor) ? valor.map(String) : [];
  const secoes = SECOES_DO_RELATORIO.map((s) => s.id).filter((s) =>
    lista(origem.secoes).includes(s),
  );
  const colunas = COLUNAS_DO_RELATORIO.map((c) => c.campo).filter((c) =>
    lista(origem.colunas).includes(c),
  );
  return {
    secoes: secoes.length ? secoes : padrao.secoes,
    colunas: colunas.length ? colunas : padrao.colunas,
    formato:
      origem.formato === "XLSX" || origem.formato === "CSV"
        ? origem.formato
        : "PDF",
  };
}

/** Marca ou desmarca um item, mantendo a ordem da lista completa e ao menos um. */
export function alternarNaEscolha<T extends string>(
  todos: readonly T[],
  atuais: readonly T[],
  item: T,
): T[] {
  const proximos = atuais.includes(item)
    ? atuais.filter((x) => x !== item)
    : todos.filter((x) => x === item || atuais.includes(x));
  return proximos.length ? proximos : [...atuais];
}

/** O modelo pronto igual à escolha (para a lista marcar), ou "" (personalizado). */
export function modeloDaEscolha(escolha: EscolhaDoRelatorio): string {
  const igual = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((x, i) => x === b[i]);
  return (
    MODELOS_DO_RELATORIO.find(
      (m) =>
        igual(m.escolha.secoes, escolha.secoes) &&
        igual(m.escolha.colunas, escolha.colunas) &&
        m.escolha.formato === escolha.formato,
    )?.id || ""
  );
}

// ── Conteúdo ────────────────────────────────────────────────────────────

const numero = (valor: unknown) =>
  Number(valor || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const txt = (valor: unknown) => String(valor ?? "").trim();
const temNumero = (valor: unknown) =>
  valor !== null && valor !== undefined && valor !== "";

/** O texto de uma coluna da tabela dos editais, como a tela mostra. */
export function textoDaColuna(
  campo: ColunaDaTabela,
  linha: LinhaDaVisaoGeral,
): string {
  switch (campo) {
    case "data_inicio":
    case "data_fim":
    case "primeira_admissao":
    case "ultima_admissao":
      return dataCurta(linha[campo]) || "—";
    case "duracao": {
      const dias = duracaoEmDias(linha);
      return dias === null ? "—" : numero(dias);
    }
    case "vagas_total":
      return numero(linha.vagas_total);
    case "inscritos":
    case "aprovados":
    case "cadastro_reserva":
      return temNumero(linha[campo]) ? numero(linha[campo]) : "—";
    case "contratados": {
      const reserva = contratacoesDoCadastroReserva(linha);
      return `${numero(contratadasImediatas(linha))}${reserva > 0 ? ` +${numero(reserva)} CR` : ""}`;
    }
    case "vagas_ociosas":
      return `${numero(linha.vagas_ociosas)} (${taxaDeOciosidade(linha).pct}%)`;
    case "atencao":
      return (linha.atencao || []).map((m) => m.rotulo).join("; ");
    case "ciclo":
      return txt(linha.ciclo) || "—";
    default:
      return txt(linha[campo]) || "—";
  }
}

const NUMERICAS = new Set<ColunaDaTabela>([
  "duracao",
  "vagas_total",
  "inscritos",
  "aprovados",
  "contratados",
  "cadastro_reserva",
  "vagas_ociosas",
]);

export interface TabelaDoRelatorio {
  titulo: string;
  colunas: readonly { rotulo: string; direita: boolean; peso: number }[];
  linhas: readonly (readonly string[])[];
  vazio: string;
}

export interface ConteudoDoRelatorio {
  titulo: string;
  area: string;
  geradoEm: string;
  identificacao: readonly (readonly [string, string])[];
  numeros: readonly (readonly [string, string])[] | null;
  tabelas: readonly TabelaDoRelatorio[];
}

/*
  O peso de cada coluna na largura da tabela do PDF: a data inteira
  ("20/02/2025") e os títulos ("Encerramento", "Aprovados") numa linha só.
*/
const PESO: Partial<Record<ColunaDaTabela, number>> = {
  unidade: 34,
  edital: 15,
  ciclo: 13,
  data_inicio: 17,
  data_fim: 19,
  duracao: 13,
  vagas_total: 11,
  inscritos: 14,
  aprovados: 15,
  contratados: 17,
  primeira_admissao: 17,
  ultima_admissao: 17,
  cadastro_reserva: 17,
  vagas_ociosas: 18,
  status: 17,
  fase: 18,
  atencao: 38,
};

export function conteudoDoRelatorio({
  escolha,
  linhas,
  filtros,
  busca = "",
  atalho = "",
  area,
  rotuloDaArea,
  indicadores,
  textos,
  quem = "",
  agora = new Date(),
}: {
  escolha: EscolhaDoRelatorio;
  linhas: readonly LinhaDaVisaoGeral[];
  filtros: FiltrosDaVisaoGeral;
  busca?: string;
  atalho?: Atalho;
  area: string;
  rotuloDaArea: string;
  indicadores: Indicadores;
  textos?: Pick<TextosDaVisaoGeral, "rotulos">;
  quem?: string;
  agora?: Date;
}): ConteudoDoRelatorio {
  const resumo = resumoDoRelatorio({ filtros, busca, atalho, linhas });
  const geradoEm = agora.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const identificacao: [string, string][] = [
    ["Área", rotuloDaArea || area],
    ["Recorte", resumo.filtros],
    ["Processos", numero(linhas.length)],
    ["Gerado em", geradoEm],
  ];
  if (txt(quem)) identificacao.push(["Gerado por", txt(quem)]);

  const VALOR: Record<string, number> = {
    kpi_vagas_label: indicadores.vagas,
    kpi_contratadas_label: indicadores.contratadas,
    kpi_em_selecao_label: indicadores.emSelecao,
    kpi_ociosas_label: indicadores.ociosas,
    kpi_cadastro_reserva_label: indicadores.cadastroReserva,
    kpi_criticos_label: indicadores.criticos,
    kpi_inscritos_label: indicadores.inscritos,
  };
  const numeros = escolha.secoes.includes("numeros")
    ? INDICADORES.map(
        ([chave, padrao]) =>
          [
            txt(textos?.rotulos?.[chave]) || padrao,
            numero(VALOR[chave]),
          ] as const,
      )
    : null;

  const tabelas: TabelaDoRelatorio[] = [];
  if (escolha.secoes.includes("editais")) {
    const colunas = COLUNAS_DO_RELATORIO.filter((c) =>
      escolha.colunas.includes(c.campo),
    );
    tabelas.push({
      titulo: "Editais",
      colunas: colunas.map((c) => ({
        rotulo: c.rotulo,
        direita: NUMERICAS.has(c.campo),
        peso: PESO[c.campo] ?? 13,
      })),
      linhas: linhas.map((linha) =>
        colunas.map((c) => textoDaColuna(c.campo, linha)),
      ),
      vazio: "Nenhum edital no recorte.",
    });
  }
  if (escolha.secoes.includes("atencao")) {
    const criticas = linhas.filter(
      (l) => ehCritica(l) || (l.atencao || []).length > 0,
    );
    tabelas.push({
      titulo: "Editais que pedem atenção",
      colunas: [
        { rotulo: "Edital", direita: false, peso: 14 },
        { rotulo: "Unidade", direita: false, peso: 32 },
        { rotulo: "Status", direita: false, peso: 14 },
        { rotulo: "Motivo", direita: false, peso: 60 },
      ],
      linhas: criticas.map((l) => [
        txt(l.edital) || "—",
        txt(l.unidade) || "—",
        txt(l.status) || "—",
        textoDaColuna("atencao", l) || "—",
      ]),
      vazio: "Nenhum edital pede atenção no recorte.",
    });
  }
  return {
    titulo: "Relatório de processos seletivos",
    area: rotuloDaArea || area,
    geradoEm,
    identificacao,
    numeros,
    tabelas,
  };
}

// ── Excel ───────────────────────────────────────────────────────────────

/** As planilhas do Excel: "Resumo" (identificação e números) e uma por tabela. */
export function planilhasDoRelatorio(
  conteudo: ConteudoDoRelatorio,
): PlanilhaDaClassificacao[] {
  const resumo: CelulaDaPlanilha[][] = [
    [conteudo.titulo, ""],
    ...conteudo.identificacao.map(([r, v]) => [r, v]),
  ];
  if (conteudo.numeros) {
    resumo.push(["", ""], ["Indicador", "Valor"]);
    for (const [r, v] of conteudo.numeros)
      resumo.push([r, Number(v.replace(/\./g, "")) || 0]);
  }
  const comoCelula = (texto: string, direita: boolean): CelulaDaPlanilha => {
    if (!direita) return texto === "—" ? "" : texto;
    const n = Number(texto.replace(/\./g, ""));
    return Number.isFinite(n) && /^[\d.]+$/.test(texto) ? n : texto;
  };
  return [
    { nome: "Resumo", linhas: resumo, larguras: [28, 80] },
    ...conteudo.tabelas.map((t) => ({
      nome: t.titulo.slice(0, 31),
      linhas: [
        t.colunas.map((c) => c.rotulo),
        ...t.linhas.map((l) =>
          l.map((v, i) => comoCelula(v, t.colunas[i]?.direita === true)),
        ),
      ],
      larguras: t.colunas.map((c) => Math.max(10, Math.round(c.peso * 0.9))),
      filtro: true,
    })),
  ];
}

/** O .xlsx do relatório: as planilhas zipadas com compressão (`zipar`: o zipSync do fflate). */
export function xlsxDoRelatorio(
  conteudo: ConteudoDoRelatorio,
  zipar: ZiparComCompressao,
  agora = new Date(),
): Uint8Array {
  const codificador = new TextEncoder();
  const arquivos: Record<string, Uint8Array> = {};
  for (const { nome, conteudo: parte } of arquivosDoXlsx(
    planilhasDoRelatorio(conteudo),
  ))
    arquivos[nome] =
      typeof parte === "string" ? codificador.encode(parte) : parte;
  return zipar(arquivos, { level: 6, mtime: agora });
}

/* "saude-indigena" → "SaudeIndigena". */
const nomeDaArea = (area: string) =>
  txt(area)
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("") || "Monitoramento";

export function nomeDoArquivoDoRelatorio(
  area: string,
  formato: FormatoDoRelatorio,
  agora = new Date(),
) {
  const dia = hojeEmBrasilia(agora).replaceAll("-", "");
  const extensao = { PDF: "pdf", XLSX: "xlsx", CSV: "csv" }[formato];
  return `Yeende_Relatorio_${nomeDaArea(area)}_${dia}.${extensao}`;
}
