/*
  Encerramento do edital, sem DOM: a leitura de obter_encerramentos_do_edital
  (migration 20261021180000), qual tela mostrar, os selos do perfil e que
  comemoração soltar. A tela e os selos são de src/modulos/encerramento-do-edital/.

  O banco decide quando um edital está encerrado (todas as fichas do lote
  concluídas) e devolve só os editais em que a pessoa concluiu ao menos uma
  ficha, com os totais e a contribuição dela. Nada de outras pessoas.

  "Já viu" fica no banco (marcar_encerramento_visto): a tela aparece uma vez
  por pessoa e edital, em qualquer navegador, também para quem entra depois.

  Fogos: quem estava na tela de Análises na hora em que o edital zerou já viu
  os fogos do marco "edital-concluido" (src/modulos/analises/marcos.ts avisa
  pelo EVENTO_EDITAL_CONCLUIDO). A tela não repete; quem fechou o edital
  ganha os do marco "edital-fechado" de qualquer jeito.
*/

export const RPC_DOS_ENCERRAMENTOS = "obter_encerramentos_do_edital";
export const RPC_DO_VISTO = "marcar_encerramento_visto";
/* Disparado na janela pelos marcos de Análises: `detail.editais` = textos dos editais concluídos. */
export const EVENTO_EDITAL_CONCLUIDO = "agsus:edital-concluido";

export interface MelhorDia {
  dia: string;
  qt: number;
}

export interface MinhaContribuicao {
  fichas: number;
  percentual: number;
  melhorDia: MelhorDia | null;
  fechou: boolean;
}

export interface EncerramentoDoEdital {
  id: string;
  edital: string;
  numero: string;
  area: string;
  concluidoEm: string;
  inscritos: number;
  fichas: number;
  dias: number;
  visto: boolean;
  minha: MinhaContribuicao;
}

export interface SeloDoEdital {
  id: string;
  numero: string;
  fechou: boolean;
  titulo: string;
}

export interface FogosDoEncerramento {
  marco: "edital-concluido" | "edital-fechado";
  forma: "coracao" | "estrela";
  texto: string;
}

type Registro = Record<string, unknown>;

const ehRegistro = (v: unknown): v is Registro =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const texto = (v: unknown) => String(v ?? "").trim();
const inteiro = (v: unknown) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** "091/2026", "Edital nº 114/2026" → "91/2026", "114/2026" ("" sem número). */
export function numeroDoEdital(valor: unknown): string {
  const m = texto(valor).match(/(\d{1,4})\s*\/\s*(\d{4})/);
  return m ? `${Number(m[1])}/${m[2]}` : "";
}

/** "114/2026" → "114". */
export const numeroCurto = (numero: string) =>
  numeroDoEdital(numero).split("/")[0] || texto(numero);

export const tituloDeQuemFechou = (numero: string) =>
  `fechou o ${numeroCurto(numero)}`;

function lerMelhorDia(valor: unknown): MelhorDia | null {
  if (!ehRegistro(valor)) return null;
  const dia = texto(valor.dia).slice(0, 10);
  const qt = inteiro(valor.qt);
  return /^\d{4}-\d{2}-\d{2}$/.test(dia) && qt ? { dia, qt } : null;
}

/** A resposta da RPC → lista (nunca null); descarta o que não tem id, número ou ficha da pessoa. */
export function lerEncerramentos(dados: unknown): EncerramentoDoEdital[] {
  const lista =
    ehRegistro(dados) && Array.isArray(dados.editais) ? dados.editais : [];
  const saida: EncerramentoDoEdital[] = [];
  for (const bruto of lista) {
    if (!ehRegistro(bruto)) continue;
    const minha = ehRegistro(bruto.minha) ? bruto.minha : {};
    const numero = numeroDoEdital(bruto.numero) || numeroDoEdital(bruto.edital);
    const fichas = inteiro(bruto.fichas);
    const minhas = Math.min(inteiro(minha.fichas), fichas);
    if (!texto(bruto.id) || !numero || !minhas) continue;
    const percentual = Number(minha.percentual);
    saida.push({
      id: texto(bruto.id),
      edital: texto(bruto.edital) || numero,
      numero,
      area: texto(bruto.area),
      concluidoEm: texto(bruto.concluido_em),
      inscritos: inteiro(bruto.inscritos),
      fichas,
      dias: inteiro(bruto.dias),
      visto: bruto.visto === true,
      minha: {
        fichas: minhas,
        percentual:
          Number.isFinite(percentual) && percentual > 0
            ? Math.min(percentual, 100)
            : Math.round((1000 * minhas) / fichas) / 10,
        melhorDia: lerMelhorDia(minha.melhor_dia),
        fechou: minha.fechou === true,
      },
    });
  }
  return saida.sort((a, b) => a.concluidoEm.localeCompare(b.concluidoEm));
}

/** A tela a mostrar agora: o encerramento mais antigo ainda não visto. */
export const encerramentoAMostrar = (lista: readonly EncerramentoDoEdital[]) =>
  lista.find((e) => !e.visto) ?? null;

/** Os selos do perfil: um por edital encerrado em que a pessoa concluiu ficha. */
export function selosDoPerfil(
  lista: readonly EncerramentoDoEdital[],
): SeloDoEdital[] {
  return lista.map((e) => ({
    id: e.id,
    numero: e.numero,
    fechou: e.minha.fechou,
    titulo: e.minha.fechou
      ? `Edital ${e.numero}: você ${tituloDeQuemFechou(e.numero)}`
      : `Edital ${e.numero}: você analisou ${formatarInteiro(e.minha.fichas)} ${e.minha.fichas === 1 ? "ficha" : "fichas"}`,
  }));
}

/**
 * Os fogos ao abrir a tela. Quem fechou: sempre os de "edital-fechado". Os
 * demais: os de "edital-concluido", a menos que esta página já os tenha
 * soltado (a pessoa viu o edital zerar na tela de Análises).
 */
export function fogosDoEncerramento(
  e: EncerramentoDoEdital,
  jaSoltos: ReadonlySet<string>,
): FogosDoEncerramento | null {
  if (e.minha.fechou)
    return {
      marco: "edital-fechado",
      forma: "estrela",
      texto: `Você ${tituloDeQuemFechou(e.numero)}! A última ficha do edital foi sua.`,
    };
  if (jaSoltos.has(e.numero)) return null;
  return {
    marco: "edital-concluido",
    forma: "coracao",
    texto: `Edital ${e.numero} concluído! Obrigado, equipe.`,
  };
}

/** Os números dos editais do EVENTO_EDITAL_CONCLUIDO. */
export function editaisDoEvento(detalhe: unknown): string[] {
  const lista =
    ehRegistro(detalhe) && Array.isArray(detalhe.editais)
      ? detalhe.editais
      : [];
  return [...new Set(lista.map(numeroDoEdital).filter(Boolean))];
}

export const formatarInteiro = (n: number) =>
  Math.floor(Number(n) || 0).toLocaleString("pt-BR");

export const formatarPercentual = (n: number) =>
  `${(Math.round((Number(n) || 0) * 10) / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** "2026-10-21" → "21/10". */
export function formatarDia(dia: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto(dia));
  return m ? `${m[3]}/${m[2]}` : "";
}
