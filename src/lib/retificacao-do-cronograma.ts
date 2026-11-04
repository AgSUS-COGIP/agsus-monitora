/*
  Retificação do cronograma em PDF → o cronograma novo do edital, sem DOM.

  Quem lê o PDF é a função Python `/api/anexos-do-edital?tipo=retificacao`
  (pdfplumber): número da retificação, edital, SEI, data da assinatura e a
  tabela do "Leia-se". Aqui fica o que a tela faz com a resposta:

  - casar cada etapa do "Leia-se" com a etapa gravada (o nome no MONITORA nem
    sempre é o do PDF: "Convocação para Entrevista" × "Convocação para a
    Entrevista"), etapa a etapa: igual, data muda, etapa nova, etapa que sumiu;
  - aplicar os ajustes de quem confere (datas, pares, etapas mantidas ou
    deixadas de fora) e montar o cronograma que vai para
    `salvar_monitoramento_com_cronograma_v2`, com o nome da retificação como
    número da errata e o SEI no motivo.

  A etapa casada guarda o nome gravado (só as datas mudam); a etapa nova entra
  com o nome do PDF. A tela é `src/modulos/editais/lancar-retificacao.tsx`.
*/

import { novaEtapa } from "./cronograma-do-edital.ts";
import type { EtapaDoCronograma } from "./cronograma-do-edital.ts";
import { problemaDoArquivo } from "./anexos-do-edital.ts";
import { numeroDoEdital } from "./numero-do-edital.ts";

const txt = (valor: unknown) => String(valor ?? "").trim();

/** Uma linha do "Leia-se" (ou do "Onde se lê") como a função Python devolve. */
export interface EtapaDaRetificacao {
  atividade?: string;
  data_inicio?: string;
  data_fim?: string;
  texto_datas?: string;
  negrito?: boolean;
  avisos?: string[];
}

/** A resposta de `/api/anexos-do-edital?tipo=retificacao` (com `arquivo` acrescentado aqui). */
export interface RetificacaoLida {
  tipo?: string;
  numero?: number | null;
  rotulo?: string;
  edital?: string;
  editais_citados?: string[];
  unidade?: string;
  sei?: string;
  processo?: string;
  assinada_em?: string;
  paginas?: number;
  onde_se_le?: EtapaDaRetificacao[];
  leia_se?: EtapaDaRetificacao[];
  avisos?: string[];
  erro?: string;
  arquivo?: string;
}

export type SituacaoDaEtapa = "igual" | "muda" | "nova" | "sumiu";

/** Uma linha da comparação etapa a etapa (atual × retificação). */
export interface LinhaDaComparacao {
  /** Estável entre renders: "pdf:3" ou "atual:5". */
  chave: string;
  situacao: SituacaoDaEtapa;
  indicePdf: number | null;
  indiceAtual: number | null;
  atual: EtapaDoCronograma | null;
  pdf: EtapaDaRetificacao | null;
  /** As datas que valem depois dos ajustes. */
  inicio: string;
  fim: string;
  avisos: string[];
  /** Entra no cronograma novo? (etapa que sumiu: só se marcada para manter). */
  incluir: boolean;
}

/** O que quem confere mudou antes de aplicar. */
export interface AjustesDaRetificacao {
  /** Linha do PDF → etapa atual (índice) ou null = etapa nova. Sem chave, vale o casamento automático. */
  pares?: Record<number, number | null>;
  /** Datas corrigidas à mão, por linha do PDF. */
  datas?: Record<number, { inicio?: string; fim?: string }>;
  /** Linhas do PDF deixadas de fora. */
  ignorar?: readonly number[];
  /** Etapas atuais que não estão no PDF e ficam. */
  manter?: readonly number[];
}

export interface ResumoDaComparacao {
  iguais: number;
  mudam: number;
  novas: number;
  somem: number;
}

export const ENDERECO_RETIFICACAO = "/api/anexos-do-edital?tipo=retificacao";

// ── Leitura ──────────────────────────────────────────────────────────────

/**
 * Manda o PDF à função Python. Devolve a resposta com `arquivo`, ou lança
 * Error com a mensagem para a tela.
 */
export async function lerRetificacaoNoServidor(
  arquivo: File,
  { token, buscar = fetch }: { token?: string; buscar?: typeof fetch } = {},
): Promise<RetificacaoLida> {
  const problema = problemaDoArquivo(arquivo);
  if (problema) throw new Error(problema);
  let resposta;
  try {
    resposta = await buscar(ENDERECO_RETIFICACAO, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/pdf",
      },
      body: arquivo,
    });
  } catch {
    throw new Error("Não consegui falar com o leitor de PDF.");
  }
  if (resposta.status === 404)
    throw new Error(
      "O leitor de PDF só existe na versão publicada (Vercel), não neste ambiente.",
    );
  const corpo = (await resposta.json().catch(() => ({}))) as RetificacaoLida;
  if (!resposta.ok)
    throw new Error(corpo?.erro || `Falha ao ler ${arquivo.name}.`);
  return { ...corpo, arquivo: arquivo.name };
}

/**
 * Por que a retificação não pode ser aplicada a este edital ("" se pode): PDF
 * de outro edital, sem número de edital ou sem a tabela do "Leia-se".
 */
export function bloqueioDaRetificacao(
  numeroDoFormulario: unknown,
  lida: RetificacaoLida | null | undefined,
) {
  if (!lida) return "";
  const doPdf = numeroDoEdital(lida.edital);
  const doEdital = numeroDoEdital(numeroDoFormulario);
  if (!doPdf)
    return "Não achei o número do edital no PDF; não dá para conferir se a retificação é deste edital.";
  if (!doEdital)
    return "Este edital está sem número; preencha e salve antes de lançar a retificação.";
  if (doPdf !== doEdital)
    return `O PDF é do edital ${doPdf}, e este é o ${doEdital}. Escolha a retificação deste edital.`;
  if (!lida.leia_se?.length) return 'Não achei a tabela do "Leia-se" no PDF.';
  return "";
}

// ── Casamento das etapas ────────────────────────────────────────────────

const PALAVRAS_VAZIAS = new Set([
  "a",
  "o",
  "as",
  "os",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "para",
  "ao",
  "aos",
  "referente",
  "referentes",
  "contra",
  "relativo",
  "relativos",
]);

/** As palavras que contam no nome da etapa (sem acento, sem plural simples). */
export function palavrasDaAtividade(nome: unknown): string[] {
  return txt(nome)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((p) => p && !PALAVRAS_VAZIAS.has(p))
    .map((p) => (p.length > 3 && p.endsWith("s") ? p.slice(0, -1) : p));
}

/** De 0 a 1: quanto dois nomes de etapa são a mesma etapa. */
export function semelhancaDeAtividade(a: unknown, b: unknown) {
  const pa = new Set(palavrasDaAtividade(a));
  const pb = new Set(palavrasDaAtividade(b));
  if (!pa.size || !pb.size) return 0;
  const comuns = [...pa].filter((p) => pb.has(p)).length;
  return comuns / (pa.size + pb.size - comuns);
}

/** Abaixo disso, dois nomes não são a mesma etapa. */
export const SEMELHANCA_MINIMA = 0.5;

/**
 * Para cada linha do PDF, o índice da etapa atual que é a mesma (ou null):
 * os pares mais parecidos primeiro, cada etapa usada uma vez só; a posição
 * no cronograma desempata nomes repetidos.
 */
export function casarEtapas(
  atuais: readonly Pick<EtapaDoCronograma, "atividade">[],
  pdf: readonly EtapaDaRetificacao[],
): (number | null)[] {
  const candidatos: { p: number; a: number; nota: number }[] = [];
  pdf.forEach((linha, p) => {
    atuais.forEach((etapa, a) => {
      const nota = semelhancaDeAtividade(linha.atividade, etapa.atividade);
      if (nota < SEMELHANCA_MINIMA) return;
      const distancia = Math.abs(
        p / Math.max(1, pdf.length) - a / Math.max(1, atuais.length),
      );
      candidatos.push({ p, a, nota: nota - distancia * 0.05 });
    });
  });
  candidatos.sort((x, y) => y.nota - x.nota || x.p - y.p || x.a - y.a);
  const pares: (number | null)[] = pdf.map(() => null);
  const usadas = new Set<number>();
  for (const { p, a } of candidatos) {
    if (pares[p] !== null || usadas.has(a)) continue;
    pares[p] = a;
    usadas.add(a);
  }
  return pares;
}

// ── Comparação ──────────────────────────────────────────────────────────

/**
 * A comparação etapa a etapa, na ordem do "Leia-se"; a etapa que sumiu
 * aparece logo depois da etapa atual que vinha antes dela.
 */
export function compararRetificacao(
  atuais: readonly EtapaDoCronograma[],
  pdf: readonly EtapaDaRetificacao[],
  ajustes: AjustesDaRetificacao = {},
): LinhaDaComparacao[] {
  const automaticos = casarEtapas(atuais, pdf);
  const pares = pdf.map((_, p) => {
    if (ajustes.pares && p in ajustes.pares) return ajustes.pares[p] ?? null;
    return automaticos[p] ?? null;
  });
  // Par escolhido à mão tira a etapa de quem a tinha pelo automático.
  const vistas = new Set<number>();
  for (let p = 0; p < pares.length; p += 1) {
    const a = pares[p];
    if (a === null || a === undefined) continue;
    if (vistas.has(a) || a < 0 || a >= atuais.length) pares[p] = null;
    else vistas.add(a);
  }
  const ignorar = new Set(ajustes.ignorar || []);
  const manter = new Set(ajustes.manter || []);

  const linhas: LinhaDaComparacao[] = [];
  const emitidas = new Set<number>();
  const sumiu = (a: number): LinhaDaComparacao => {
    const atual = atuais[a]!;
    return {
      chave: `atual:${a}`,
      situacao: "sumiu",
      indicePdf: null,
      indiceAtual: a,
      atual,
      pdf: null,
      inicio: atual.data_inicio,
      fim: atual.data_fim,
      avisos: [],
      incluir: manter.has(a),
    };
  };
  const emitirSumidasAte = (limite: number) => {
    for (let a = 0; a < limite; a += 1) {
      if (vistas.has(a) || emitidas.has(a)) continue;
      emitidas.add(a);
      linhas.push(sumiu(a));
    }
  };

  pdf.forEach((linha, p) => {
    const a = pares[p] ?? null;
    if (a !== null) emitirSumidasAte(a);
    const atual = a === null ? null : atuais[a]!;
    const ajuste = ajustes.datas?.[p] || {};
    const inicio = txt(ajuste.inicio ?? linha.data_inicio);
    const fim = txt(ajuste.fim ?? (linha.data_fim || linha.data_inicio));
    const situacao: SituacaoDaEtapa = !atual
      ? "nova"
      : atual.data_inicio === inicio && atual.data_fim === fim
        ? "igual"
        : "muda";
    linhas.push({
      chave: `pdf:${p}`,
      situacao,
      indicePdf: p,
      indiceAtual: a,
      atual,
      pdf: linha,
      inicio,
      fim,
      avisos: [...(linha.avisos || [])],
      incluir: !ignorar.has(p),
    });
  });
  emitirSumidasAte(atuais.length);
  return linhas;
}

export function resumoDaComparacao(
  linhas: readonly LinhaDaComparacao[],
): ResumoDaComparacao {
  const conta = (s: SituacaoDaEtapa) =>
    linhas.filter(
      (l) => l.situacao === s && (s === "sumiu" ? !l.incluir : l.incluir),
    ).length;
  return {
    iguais: conta("igual"),
    mudam: conta("muda"),
    novas: conta("nova"),
    somem: conta("sumiu"),
  };
}

/** O que ainda impede aplicar (etapa sem data, fim antes do início). */
export function problemasDaComparacao(linhas: readonly LinhaDaComparacao[]) {
  const problemas: string[] = [];
  for (const linha of linhas) {
    if (!linha.incluir) continue;
    const nome = linha.atual?.atividade || txt(linha.pdf?.atividade);
    if (!linha.inicio || !linha.fim)
      problemas.push(`${nome}: preencha início e fim.`);
    else if (linha.fim < linha.inicio)
      problemas.push(`${nome}: o fim é anterior ao início.`);
  }
  if (!linhas.some((l) => l.incluir))
    problemas.push("A retificação deixaria o cronograma vazio.");
  return problemas;
}

/**
 * O cronograma novo: na ordem da comparação, só as linhas incluídas. A etapa
 * casada guarda nome e origem gravados (a origem vira ERRATA se a data muda);
 * a nova entra com o nome do PDF e origem ERRATA.
 */
export function etapasRetificadas(
  linhas: readonly LinhaDaComparacao[],
): EtapaDoCronograma[] {
  return linhas
    .filter((linha) => linha.incluir)
    .map((linha, indice) => {
      const ordem = indice + 1;
      if (linha.atual) {
        const mudou = linha.situacao === "muda";
        return {
          ...linha.atual,
          ordem,
          data_inicio: linha.inicio,
          data_fim: linha.fim,
          origem: mudou ? "ERRATA" : linha.atual.origem,
        };
      }
      return novaEtapa(
        {
          atividade: linha.pdf?.atividade,
          data_inicio: linha.inicio,
          data_fim: linha.fim,
          origem: "ERRATA",
        },
        ordem,
      );
    });
}

// ── Registro ────────────────────────────────────────────────────────────

const dataCurta = (iso: unknown) => {
  const m = txt(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};

/** O número da errata no histórico: "2ª Retificação do Cronograma". */
export function numeroDaErrata(lida: RetificacaoLida | null | undefined) {
  const rotulo = txt(lida?.rotulo);
  if (rotulo) return rotulo;
  return lida?.numero
    ? `${lida.numero}ª Retificação do Cronograma`
    : "Retificação do Cronograma";
}

/** O motivo do histórico, citando o SEI e a data da assinatura. */
export function motivoDaRetificacao(
  lida: RetificacaoLida | null | undefined,
  resumo: ResumoDaComparacao,
) {
  const documento = [
    lida?.sei ? `SEI ${txt(lida.sei)}` : "",
    lida?.assinada_em ? `assinada em ${dataCurta(lida.assinada_em)}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  const partes = [
    resumo.mudam ? `${resumo.mudam} etapa(s) com data nova` : "",
    resumo.novas ? `${resumo.novas} incluída(s)` : "",
    resumo.somem ? `${resumo.somem} retirada(s)` : "",
  ].filter(Boolean);
  return `Lançada pela ${numeroDaErrata(lida)}${documento ? ` (${documento})` : ""}: ${
    partes.length ? partes.join(", ") : "sem mudança de datas"
  }.`.slice(0, 500);
}
