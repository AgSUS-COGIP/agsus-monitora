/*
  ABA "ENTREVISTADOS" -> LINHAS DA CARGA DE ENTREVISTAS

  Transforma os valores da aba Entrevistados da planilha "[dash] entrevistados"
  (como a API do Google Sheets os devolve: matriz de textos formatados, com a
  primeira linha de cabeçalho) nas linhas que `public.sincronizar_entrevistas`
  espera. É a mesma leitura que o Apps Script da planilha fazia até 30/09/2026;
  quem chama é `scripts/sincronizar-entrevistas.mjs`.

  As colunas são achadas pelo nome do cabeçalho, sem acento e sem caixa: nome
  exato primeiro, depois cabeçalho que começa pelo nome ("NOTA TOTAL (0 a 20)").
  Os critérios são os pares "Critério N" / "Nota N", na ordem, até o primeiro
  par que falta. Linha sem candidato, vaga ou edital fica de fora.

  O banco faz o resto (parecer, comparecimento, nota com vírgula, chave da
  linha); aqui só se lê e se limpa espaço.
*/

export const MAX_CRITERIOS = 20;

const COLUNAS = Object.freeze({
  unidade: ["DSEI"],
  edital: ["EDITAL"],
  link: ["LINK PLANILHA ENTREVISTA"],
  vaga: ["VAGA"],
  candidato: ["NOME"],
  modalidade: ["MODALIDADE DE CONCORRENCIA", "MODALIDADE"],
  cargo: ["CARGO"],
  codigo: ["CODIGO"],
  nota: ["NOTA TOTAL"],
  parecer: ["PARECER"],
  compareceu: ["COMPARECIMENTO"],
});

type CampoDaAba = keyof typeof COLUNAS;

const OBRIGATORIAS: readonly CampoDaAba[] = Object.freeze([
  "unidade",
  "edital",
  "vaga",
  "candidato",
]);

/** Nota de um critério da entrevista ("Critério N" / "Nota N"). */
export interface NotaDoCriterio {
  criterio: string;
  nota: string;
}

/** Uma linha de `public.sincronizar_entrevistas`. */
export interface LinhaDaEntrevista {
  unidade: string;
  edital: string;
  vaga: string;
  candidato: string;
  codigo: string;
  modalidade: string;
  cargo: string;
  nota: string;
  parecer: string;
  compareceu: string;
  link: string;
  notas: NotaDoCriterio[];
}

export function normalizarCabecalho(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function texto(valor: unknown): string {
  return String(valor ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function acharColuna(
  cabecalho: readonly string[],
  nomes: readonly string[],
): number {
  const alvos = nomes.map(normalizarCabecalho);
  const exato = cabecalho.findIndex((c) => alvos.includes(c));
  if (exato >= 0) return exato;
  return cabecalho.findIndex((c) => alvos.some((a) => c.startsWith(a)));
}

/** Linhas para `sincronizar_entrevistas` a partir da matriz da aba. */
export function linhasDaAbaEntrevistados(
  valores: unknown,
): LinhaDaEntrevista[] {
  if (!Array.isArray(valores) || valores.length < 2) return [];

  const cabecalho = ((valores[0] || []) as readonly unknown[]).map(
    normalizarCabecalho,
  );
  const idx = Object.fromEntries(
    Object.entries(COLUNAS).map(([campo, nomes]) => [
      campo,
      acharColuna(cabecalho, nomes),
    ]),
  ) as Record<CampoDaAba, number>;
  const faltando = OBRIGATORIAS.filter((campo) => idx[campo] < 0);
  if (faltando.length) {
    throw new Error(
      `Coluna obrigatória não encontrada na aba Entrevistados: ${faltando.join(", ")}`,
    );
  }

  const criterios: { c: number; v: number }[] = [];
  for (let n = 1; n <= MAX_CRITERIOS; n++) {
    const c = cabecalho.indexOf(`CRITERIO ${n}`);
    const v = cabecalho.indexOf(`NOTA ${n}`);
    if (c < 0 || v < 0) break;
    criterios.push({ c, v });
  }

  // A API corta as células vazias do fim de cada linha: índice ausente é "".
  const celula = (linha: readonly unknown[], i: number) =>
    i < 0 ? "" : texto(linha[i]);

  const saida: LinhaDaEntrevista[] = [];
  for (const linha of valores.slice(1) as unknown[]) {
    if (!Array.isArray(linha)) continue;
    const candidato = celula(linha, idx.candidato);
    const vaga = celula(linha, idx.vaga).replace(/\D/g, "");
    const edital = celula(linha, idx.edital);
    if (!candidato || !vaga || !edital) continue;

    saida.push({
      unidade: celula(linha, idx.unidade),
      edital,
      vaga,
      candidato,
      codigo: celula(linha, idx.codigo).replace(/\D/g, ""),
      modalidade: celula(linha, idx.modalidade),
      cargo: celula(linha, idx.cargo),
      nota: celula(linha, idx.nota),
      parecer: celula(linha, idx.parecer),
      compareceu: celula(linha, idx.compareceu),
      link: celula(linha, idx.link),
      notas: criterios
        .map((p) => ({
          criterio: celula(linha, p.c),
          nota: celula(linha, p.v),
        }))
        .filter((x) => x.criterio),
    });
  }
  return saida;
}

/** Divide as linhas em lotes (a RPC aceita de 1 a 1000 por chamada). */
export function emLotes<T>(linhas: readonly T[], tamanho = 500): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < linhas.length; i += tamanho)
    lotes.push(linhas.slice(i, i + tamanho));
  return lotes;
}

/** Identificador da carga no formato que o banco aceita (^[A-Za-z0-9_-]{8,80}$). */
export function identificadorDaCarga(agora = new Date(), sufixo = "") {
  const d = new Date(agora.getTime() - 3 * 60 * 60 * 1000); // horário de Brasília
  const p = (n: number) => String(n).padStart(2, "0");
  const data = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`;
  const hora = `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
  const limpo = String(sufixo)
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 8);
  return `gh-${data}-${hora}${limpo ? `-${limpo}` : ""}`;
}
