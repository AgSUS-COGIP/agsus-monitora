/*
  RELATÓRIO DE MOTIVOS (Avaliação documental › Fila › Ações da coordenação):
  as regras puras dos filtros, dos atalhos, das linhas da tabela, do
  agrupamento pelo texto do "Outro motivo" e da exportação (CSV e XLSX). Sem
  DOM e sem banco: as fichas vêm de listar_relatorio_de_motivos (migration
  20261020120000), em páginas, com os blocos reduzidos a códigos; os textos
  (título do bloco, motivo, justificativa) saem da regra vigente do edital.
*/
import { sanitizeCsvCell } from "../csv-security";
import { gerarXlsx } from "../classificacao/exportacao.ts";
import { RESULTADOS, rotuloDe, SITUACOES_DO_BLOCO } from "./catalogo.ts";
import { nomeCurtoDoBloco } from "./ficha.ts";
import { OUTRO_MOTIVO } from "./pontuacao.ts";

export const RPC_RELATORIO_DE_MOTIVOS = "listar_relatorio_de_motivos";
/** O banco devolve até 500 fichas por página. */
export const FICHAS_POR_PAGINA = 500;
export const TEXTO_DO_OUTRO_MOTIVO = "Outro motivo";

export type SituacaoDoBloco =
  "CONFORME" | "NAO_CONFORME" | "NAO_ENVIADO" | "NAO_SE_APLICA";

export const SITUACOES_DO_FILTRO: readonly {
  valor: SituacaoDoBloco;
  rotulo: string;
}[] = [
  // No banco, "Não confere" leva junto o "Não enviado" (argumentosDoRelatorio).
  { valor: "NAO_CONFORME", rotulo: "Não confere ou não enviado" },
  { valor: "NAO_ENVIADO", rotulo: "Só não enviado" },
  { valor: "CONFORME", rotulo: "Confere" },
  { valor: "NAO_SE_APLICA", rotulo: "Não se aplica" },
];

export type SituacaoDaFicha = "" | "CONCLUIDA" | "EM_ANALISE" | "PENDENTE";

/** A situação da ficha na tela e as do banco (Em análise inclui "a revisar"). */
export const SITUACOES_DA_FICHA: readonly {
  valor: SituacaoDaFicha;
  rotulo: string;
  banco: string[] | null;
}[] = [
  { valor: "CONCLUIDA", rotulo: "Concluída", banco: ["CONCLUIDA"] },
  {
    valor: "EM_ANALISE",
    rotulo: "Em análise",
    banco: ["EM_ANALISE", "REVISAR"],
  },
  { valor: "PENDENTE", rotulo: "Pendente", banco: ["PENDENTE"] },
  { valor: "", rotulo: "Todas", banco: null },
];

export type FiltrosDoRelatorio = {
  /** Códigos dos blocos da regra (vazio = todos). */
  blocos: string[];
  /** Situação do bloco ("" = qualquer). */
  situacao: SituacaoDoBloco | "";
  /** Código do motivo ("" = qualquer; OUTRO = "Outro motivo"). */
  motivo: string;
  /** Só blocos com justificativa de nota (pontuação diferente da declarada). */
  ajustada: boolean;
  /** APTO, INAPTO_REQUISITO, INAPTO_NOTA ("" = qualquer). */
  resultado: string;
  situacaoDaFicha: SituacaoDaFicha;
  vaga: string;
  avaliador: string;
  /** "AAAA-MM-DD" (período de conclusão). */
  de: string;
  ate: string;
};

export const FILTROS_INICIAIS: FiltrosDoRelatorio = Object.freeze({
  blocos: [],
  situacao: "",
  motivo: "",
  ajustada: false,
  resultado: "",
  situacaoDaFicha: "CONCLUIDA",
  vaga: "",
  avaliador: "",
  de: "",
  ate: "",
}) as FiltrosDoRelatorio;

type MotivoDaRegra = { codigo?: unknown; texto?: unknown; motivo?: unknown };
type BlocoDaRegraBruto = {
  codigo?: unknown;
  titulo?: unknown;
  tipo?: unknown;
  motivos?: unknown;
};
type RegraBruta = {
  blocos?: unknown;
  por_cargo?: unknown;
  observacoes_prontas?: unknown;
} | null;

export type MotivoDoCatalogo = { codigo: string; texto: string };
export type BlocoDoCatalogo = {
  codigo: string;
  titulo: string;
  nome: string;
  tipo: string;
  motivos: MotivoDoCatalogo[];
};
export type CatalogoDoRelatorio = {
  blocos: BlocoDoCatalogo[];
  /** Textos das justificativas que não são motivo do bloco (observações prontas). */
  observacoes: Record<string, string>;
};

const lista = <T = unknown>(v: unknown): T[] =>
  Array.isArray(v) ? (v as T[]) : [];
const texto = (v: unknown) => (v == null ? "" : String(v)).trim();
const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * Os blocos da regra vigente com os motivos de cada um: os do bloco, os
 * requisitos das diferenças por cargo (que viram motivos do bloco na regra da
 * vaga) e o "Outro motivo" por último.
 */
export function catalogoDoRelatorio(regra: RegraBruta): CatalogoDoRelatorio {
  const r = ehObjeto(regra) ? regra : {};
  const requisitos = new Map<string, MotivoDoCatalogo[]>();
  for (const dif of lista<{ blocos?: unknown }>(r.por_cargo)) {
    if (!ehObjeto(dif) || !ehObjeto(dif.blocos)) continue;
    for (const [codigo, s] of Object.entries(dif.blocos)) {
      if (!ehObjeto(s)) continue;
      const doBloco = requisitos.get(codigo) ?? [];
      for (const q of lista<MotivoDaRegra>(s.requisitos))
        if (ehObjeto(q) && texto(q.codigo))
          doBloco.push({ codigo: texto(q.codigo), texto: texto(q.motivo) });
      requisitos.set(codigo, doBloco);
    }
  }
  const blocos = lista<BlocoDaRegraBruto>(r.blocos)
    .filter((b) => ehObjeto(b) && texto(b.codigo))
    .map((b) => {
      const codigo = texto(b.codigo);
      const vistos = new Set<string>();
      const motivos: MotivoDoCatalogo[] = [];
      for (const m of [
        ...lista<MotivoDaRegra>(b.motivos).map((m) => ({
          codigo: texto(m?.codigo),
          texto: texto(m?.texto),
        })),
        ...(requisitos.get(codigo) ?? []),
      ]) {
        if (!m.codigo || m.codigo === OUTRO_MOTIVO || vistos.has(m.codigo))
          continue;
        vistos.add(m.codigo);
        motivos.push({ codigo: m.codigo, texto: m.texto || m.codigo });
      }
      motivos.push({ codigo: OUTRO_MOTIVO, texto: TEXTO_DO_OUTRO_MOTIVO });
      return {
        codigo,
        titulo: texto(b.titulo) || codigo,
        nome: String(nomeCurtoDoBloco(b) || codigo),
        tipo: texto(b.tipo),
        motivos,
      };
    });
  const observacoes: Record<string, string> = {};
  for (const o of lista<{
    codigo?: unknown;
    rotulo?: unknown;
    texto?: unknown;
  }>(r.observacoes_prontas))
    if (ehObjeto(o) && texto(o.codigo))
      observacoes[texto(o.codigo)] = texto(o.rotulo) || texto(o.texto);
  return { blocos, observacoes };
}

/** Os motivos que o filtro oferece: os dos blocos escolhidos (todos, sem bloco), sem repetir. */
export function motivosDoFiltro(
  catalogo: CatalogoDoRelatorio,
  blocos: string[],
): MotivoDoCatalogo[] {
  const escolhidos = blocos.length
    ? catalogo.blocos.filter((b) => blocos.includes(b.codigo))
    : catalogo.blocos;
  const vistos = new Map<string, MotivoDoCatalogo>();
  for (const b of escolhidos)
    for (const m of b.motivos)
      if (m.codigo !== OUTRO_MOTIVO && !vistos.has(m.codigo))
        vistos.set(m.codigo, m);
  return [
    ...vistos.values(),
    { codigo: OUTRO_MOTIVO, texto: TEXTO_DO_OUTRO_MOTIVO },
  ];
}

/** O texto de um código (motivo do bloco, justificativa ou observação pronta). */
export function textoDoCodigo(
  catalogo: CatalogoDoRelatorio,
  bloco: string,
  codigo: string,
): string {
  if (codigo === OUTRO_MOTIVO) return TEXTO_DO_OUTRO_MOTIVO;
  const doBloco = catalogo.blocos
    .find((b) => b.codigo === bloco)
    ?.motivos.find((m) => m.codigo === codigo);
  if (doBloco) return doBloco.texto;
  if (catalogo.observacoes[codigo]) return catalogo.observacoes[codigo];
  for (const b of catalogo.blocos) {
    const m = b.motivos.find((x) => x.codigo === codigo);
    if (m) return m.texto;
  }
  return codigo;
}

/* ── Atalhos ─────────────────────────────────────────────────────────── */

export type Atalho = {
  id: "outro-por-criterio" | "eliminados-por-criterio" | "pontuacao-ajustada";
  rotulo: string;
  icone: string;
  /** Abre com o agrupamento pelo texto do "Outro motivo". */
  agrupar: boolean;
};

export const ATALHOS: readonly Atalho[] = [
  {
    id: "outro-por-criterio",
    rotulo: "Outro motivo por critério",
    icone: "fa-pen-to-square",
    agrupar: true,
  },
  {
    id: "eliminados-por-criterio",
    rotulo: "Eliminados por critério",
    icone: "fa-user-xmark",
    agrupar: false,
  },
  {
    id: "pontuacao-ajustada",
    rotulo: "Pontuação ajustada (cursos/experiência)",
    icone: "fa-scale-balanced",
    agrupar: false,
  },
];

/** O critério de um atalho "por critério": o escolhido (um só), senão Identidade, senão o primeiro documento. */
function criterioDoAtalho(
  catalogo: CatalogoDoRelatorio,
  atual: FiltrosDoRelatorio,
): string[] {
  if (atual.blocos.length === 1) return [...atual.blocos];
  const bloco =
    catalogo.blocos.find((b) => b.codigo === "IDENTIDADE") ??
    catalogo.blocos.find((b) => b.tipo === "DOCUMENTO") ??
    catalogo.blocos[0];
  return bloco ? [bloco.codigo] : [];
}

/** Os filtros do atalho (o período, a vaga e o avaliador escolhidos ficam). */
export function filtrosDoAtalho(
  id: Atalho["id"],
  catalogo: CatalogoDoRelatorio,
  atual: FiltrosDoRelatorio = FILTROS_INICIAIS,
): FiltrosDoRelatorio {
  const base: FiltrosDoRelatorio = {
    ...FILTROS_INICIAIS,
    vaga: atual.vaga,
    avaliador: atual.avaliador,
    de: atual.de,
    ate: atual.ate,
  };
  if (id === "outro-por-criterio")
    return {
      ...base,
      blocos: criterioDoAtalho(catalogo, atual),
      motivo: OUTRO_MOTIVO,
    };
  if (id === "eliminados-por-criterio")
    return {
      ...base,
      blocos: criterioDoAtalho(catalogo, atual),
      situacao: "NAO_CONFORME",
      resultado: "INAPTO_REQUISITO",
    };
  return {
    ...base,
    blocos: catalogo.blocos
      .filter((b) => b.tipo === "CURSOS" || b.tipo === "VINCULOS")
      .map((b) => b.codigo),
    ajustada: true,
  };
}

/* ── Banco ───────────────────────────────────────────────────────────── */

/** Os argumentos de uma página de listar_relatorio_de_motivos (só os filtros escolhidos). */
export function argumentosDoRelatorio(
  editalId: string,
  f: FiltrosDoRelatorio,
  apos: string | null = null,
) {
  const p: Record<string, unknown> = { limite: FICHAS_POR_PAGINA };
  if (f.blocos.length) p.blocos = [...f.blocos];
  // "Não confere" também pega o "Não enviado" (os dois eliminam e têm motivo).
  if (f.situacao)
    p.situacoes =
      f.situacao === "NAO_CONFORME"
        ? ["NAO_CONFORME", "NAO_ENVIADO"]
        : [f.situacao];
  if (f.motivo) p.motivo = f.motivo;
  if (f.ajustada) p.ajustada = true;
  if (f.resultado) p.resultados = [f.resultado];
  const situacao = SITUACOES_DA_FICHA.find(
    (s) => s.valor === f.situacaoDaFicha,
  );
  if (situacao?.banco) p.situacoes_ficha = [...situacao.banco];
  if (f.vaga) p.vagas = [f.vaga];
  if (f.avaliador) p.avaliador = f.avaliador;
  if (f.de) p.de = f.de;
  if (f.ate) p.ate = f.ate;
  if (apos) p.apos = apos;
  return { p_edital: editalId, p_filtros: p };
}

export type BlocoDaFicha = {
  situacao?: string;
  motivos?: string[];
  motivo_livre?: string;
  justificativas?: string[];
  nota_ajustada?: number | null;
};

/** Uma ficha como listar_relatorio_de_motivos devolve (sem CPF, e-mail ou telefone). */
export type FichaDoRelatorio = {
  id: string;
  codigo: string | number | null;
  nome: string | null;
  vaga: string | null;
  cargo: string | null;
  lotacao?: string | null;
  situacao: string | null;
  resultado: string | null;
  nota_final: number | null;
  avaliador: string | null;
  concluida_em: string | null;
  blocos: Record<string, BlocoDaFicha>;
};

export type PaginaDoRelatorio = {
  fichas?: FichaDoRelatorio[];
  total?: number | null;
  avaliadores?: { usuario: string; nome: string }[] | null;
  proximo?: string | null;
};

/* ── Linhas da tabela e da exportação ────────────────────────────────── */

export type LinhaDoRelatorio = {
  id: string;
  codigo: string;
  candidato: string;
  vaga: string;
  cargo: string;
  situacaoDaFicha: string;
  resultado: string;
  notaFinal: number | null;
  criterio: string;
  situacaoDoBloco: string;
  /** O texto escrito no "Outro motivo" (do Não confere ou da justificativa). */
  outroMotivo: string;
  demaisMotivos: string;
  justificativas: string;
  notaAjustada: string;
  concluidaPor: string;
  concluidaEm: string;
};

const SITUACOES_DA_FICHA_NO_BANCO: Record<string, string> = {
  PENDENTE: "Pendente",
  EM_ANALISE: "Em análise",
  REVISAR: "A revisar",
  CONCLUIDA: "Concluída",
};
const ROTULO_DA_SITUACAO_DO_BLOCO: Record<string, string> = {
  CONFORME: "Confere",
  NAO_CONFORME: "Não confere",
};

const semPonto = (t: string) =>
  t.replace(/\s+/g, " ").trim().replace(/\.$/, "");

/** "16/10/2026 16:30" no fuso de Brasília. */
export function dataHoraDoRelatorio(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(d)
    .replace(",", "");
}

/**
 * Uma linha por ficha. Com mais de um bloco na linha (sem filtro de critério,
 * ou cursos + experiência), cada parte leva o nome do bloco ("Cursos: …").
 */
export function linhasDoRelatorio(
  fichas: readonly FichaDoRelatorio[],
  catalogo: CatalogoDoRelatorio,
): LinhaDoRelatorio[] {
  const ordem = new Map(catalogo.blocos.map((b, i) => [b.codigo, i]));
  const nome = (codigo: string) =>
    catalogo.blocos.find((b) => b.codigo === codigo)?.nome ?? codigo;
  return fichas.map((f) => {
    const codigos = Object.keys(f.blocos ?? {}).sort(
      (a, b) =>
        (ordem.get(a) ?? 999) - (ordem.get(b) ?? 999) || a.localeCompare(b),
    );
    const varios = codigos.length > 1;
    const parte = (codigo: string, valor: string) =>
      valor ? (varios ? `${nome(codigo)}: ${valor}` : valor) : "";
    const juntar = (fn: (codigo: string, b: BlocoDaFicha) => string) =>
      codigos
        .map((c) => parte(c, fn(c, f.blocos[c] ?? {})))
        .filter(Boolean)
        .join(" | ");
    return {
      id: f.id,
      codigo: texto(f.codigo),
      candidato: texto(f.nome),
      vaga: texto(f.vaga),
      cargo: texto(f.cargo),
      situacaoDaFicha:
        SITUACOES_DA_FICHA_NO_BANCO[texto(f.situacao)] ?? texto(f.situacao),
      resultado: f.resultado ? String(rotuloDe(RESULTADOS, f.resultado)) : "",
      notaFinal: typeof f.nota_final === "number" ? f.nota_final : null,
      criterio: codigos.map(nome).join(", "),
      situacaoDoBloco: juntar((_, b) =>
        b.situacao
          ? (ROTULO_DA_SITUACAO_DO_BLOCO[b.situacao] ??
            String(rotuloDe(SITUACOES_DO_BLOCO, b.situacao)))
          : "",
      ),
      outroMotivo: juntar((_, b) =>
        lista(b.motivos).includes(OUTRO_MOTIVO) ||
        lista(b.justificativas).includes(OUTRO_MOTIVO)
          ? semPonto(texto(b.motivo_livre))
          : "",
      ),
      demaisMotivos: juntar((c, b) =>
        lista<string>(b.motivos)
          .filter((m) => m !== OUTRO_MOTIVO)
          .map((m) => semPonto(textoDoCodigo(catalogo, c, m)))
          .join("; "),
      ),
      justificativas: juntar((c, b) =>
        lista<string>(b.justificativas)
          .filter((m) => m !== OUTRO_MOTIVO)
          .map((m) => semPonto(textoDoCodigo(catalogo, c, m)))
          .join("; "),
      ),
      notaAjustada: juntar((_, b) =>
        lista(b.justificativas).length && typeof b.nota_ajustada === "number"
          ? String(b.nota_ajustada).replace(".", ",")
          : "",
      ),
      concluidaPor: texto(f.avaliador),
      concluidaEm: dataHoraDoRelatorio(f.concluida_em),
    };
  });
}

/* ── Agrupamento pelo texto do "Outro motivo" ────────────────────────── */

export type GrupoDoOutroMotivo = {
  texto: string;
  quantidade: number;
  codigos: string[];
};

/** A chave que junta textos iguais (sem acento, caixa, espaços e ponto final). */
export function chaveDoTexto(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036F]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.;:,]+$/, "");
}

/** Os textos do "Outro motivo", do que mais repete para o que menos. */
export function agruparPorOutroMotivo(
  linhas: readonly LinhaDoRelatorio[],
): GrupoDoOutroMotivo[] {
  const grupos = new Map<string, GrupoDoOutroMotivo>();
  for (const l of linhas) {
    for (const t of l.outroMotivo.split(" | ")) {
      const valor = t.trim();
      if (!valor) continue;
      const chave = chaveDoTexto(valor);
      const g = grupos.get(chave) ?? {
        texto: valor,
        quantidade: 0,
        codigos: [],
      };
      g.quantidade += 1;
      g.codigos.push(l.codigo);
      grupos.set(chave, g);
    }
  }
  return [...grupos.values()].sort(
    (a, b) =>
      b.quantidade - a.quantidade || a.texto.localeCompare(b.texto, "pt-BR"),
  );
}

/* ── Exportação ──────────────────────────────────────────────────────── */

export const COLUNAS_DO_RELATORIO: readonly {
  chave: keyof LinhaDoRelatorio;
  rotulo: string;
  largura: number;
}[] = [
  { chave: "codigo", rotulo: "Código", largura: 10 },
  { chave: "candidato", rotulo: "Candidato", largura: 34 },
  { chave: "vaga", rotulo: "Vaga", largura: 10 },
  { chave: "cargo", rotulo: "Cargo", largura: 40 },
  { chave: "situacaoDaFicha", rotulo: "Situação da ficha", largura: 14 },
  { chave: "resultado", rotulo: "Resultado", largura: 20 },
  { chave: "notaFinal", rotulo: "Nota final", largura: 10 },
  { chave: "criterio", rotulo: "Critério", largura: 22 },
  { chave: "situacaoDoBloco", rotulo: "Situação do critério", largura: 18 },
  { chave: "outroMotivo", rotulo: "Texto do outro motivo", largura: 60 },
  { chave: "demaisMotivos", rotulo: "Demais motivos", largura: 60 },
  { chave: "justificativas", rotulo: "Justificativas da nota", largura: 40 },
  { chave: "notaAjustada", rotulo: "Nota ajustada", largura: 12 },
  { chave: "concluidaPor", rotulo: "Concluída por", largura: 26 },
  { chave: "concluidaEm", rotulo: "Concluída em", largura: 17 },
];

const valorDaCelula = (l: LinhaDoRelatorio, chave: keyof LinhaDoRelatorio) => {
  const v = l[chave];
  if (v === null || v === undefined) return "";
  return typeof v === "number" ? String(v).replace(".", ",") : String(v);
};

function celulaCsv(valor: string) {
  const seguro = sanitizeCsvCell(valor);
  return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** CSV para o Excel: BOM UTF-8, ";", CRLF e cada célula protegida contra fórmula. */
export function csvDoRelatorio(linhas: readonly LinhaDoRelatorio[]): string {
  const conteudo = [
    COLUNAS_DO_RELATORIO.map((c) => celulaCsv(c.rotulo)).join(";"),
    ...linhas.map((l) =>
      COLUNAS_DO_RELATORIO.map((c) =>
        celulaCsv(valorDaCelula(l, c.chave)),
      ).join(";"),
    ),
  ];
  return `\uFEFF${conteudo.join("\r\n")}\r\n`;
}

/** XLSX (texto em inlineStr: nada vira fórmula) com a planilha "Fichas" e, havendo texto, "Outro motivo" (textos e quantas vezes). */
export function xlsxDoRelatorio(
  linhas: readonly LinhaDoRelatorio[],
  quando = new Date(),
): Uint8Array<ArrayBuffer> {
  const grupos = agruparPorOutroMotivo(linhas);
  return gerarXlsx(
    [
      {
        nome: "Fichas",
        larguras: COLUNAS_DO_RELATORIO.map((c) => c.largura),
        linhas: [
          COLUNAS_DO_RELATORIO.map((c) => c.rotulo),
          ...linhas.map((l) =>
            COLUNAS_DO_RELATORIO.map((c) =>
              c.chave === "notaFinal" && l.notaFinal !== null
                ? l.notaFinal
                : valorDaCelula(l, c.chave),
            ),
          ),
        ],
      },
      ...(grupos.length
        ? [
            {
              nome: "Outro motivo",
              larguras: [80, 12, 60],
              linhas: [
                ["Texto do outro motivo", "Fichas", "Códigos"],
                ...grupos.map((g) => [
                  g.texto,
                  g.quantidade,
                  g.codigos.join(", "),
                ]),
              ],
            },
          ]
        : []),
    ],
    quando,
  ) as Uint8Array<ArrayBuffer>;
}

/** "relatorio-de-motivos-114-2026-identidade-2026-10-20" (sem extensão). */
export function nomeDoRelatorio(
  edital: string | null | undefined,
  blocos: string[],
  agora = new Date(),
): string {
  const limpar = (t: string) =>
    t
      .normalize("NFD")
      .replace(/[\u0300-\u036F]/g, "")
      .replace(/[^0-9A-Za-z]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
  const dois = (n: number) => String(n).padStart(2, "0");
  const partes = [
    "relatorio-de-motivos",
    limpar(String(edital ?? "")) || "edital",
    blocos.length === 1 ? limpar(blocos[0] ?? "") : "",
    `${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}`,
  ];
  return partes.filter(Boolean).join("-");
}
