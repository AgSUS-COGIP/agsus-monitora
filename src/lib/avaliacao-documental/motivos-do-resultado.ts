/*
  POR QUE a ficha deu Inapto, item a item, para a lateral e a Conclusão (nunca
  "Inapto (requisito)" sem motivo). Só leitura da conta de pontuacao.js:
  - bloco conferido com efeito ELIMINA: os motivos escolhidos (com o item do
    edital) ou "Não conforme"/"Não enviado";
  - experiência mínima (bloco de vínculos com minimo_meses e efeito_minimo
    ELIMINA): "Experiência mínima de 6 meses não comprovada (comprovado 0
    meses) — item 1.1.1 c", com o tempo dos vínculos ACEITOS lançados;
  - nota abaixo da mínima.
  Cada motivo leva o código do bloco (o link volta ao item); o que não vem de
  um bloco (a nota mínima) fica com bloco null. Se a conta eliminou por algo
  que nenhum bloco explica, os textos de `eliminatorios` entram como estão.
*/
import { SITUACOES_DO_BLOCO, rotuloDe } from "./catalogo.js";
import { blocoConferido, nomeCurtoDoBloco, textoDaNota } from "./ficha.js";
import { mesesDoMinimo } from "./comprovado-da-ficha.ts";

export type MotivoDoResultado = { bloco: string | null; texto: string };

type BlocoDaRegra = {
  codigo: string;
  tipo: string;
  titulo?: string;
  item_edital?: string;
  minimo_meses?: number | null;
  efeito_minimo?: string;
  item_minimo?: string;
  minimo_conta_estagio?: boolean;
};
type Avaliacao = {
  resultado?: string;
  nota_apurada?: number;
  nota_minima?: number | null;
  eliminatorios?: string[];
  blocos?: {
    codigo: string;
    situacao: string;
    efeito: string | null;
    motivos: { texto: string; item_edital?: string }[];
  }[];
  experiencia?: {
    dias_total: number;
    meses: number;
    meses_estagio: number;
    meses_considerados: number;
    pontos: number;
    abaixo_do_minimo: boolean;
  } | null;
};

const plural = (n: number, um: string, varios: string) =>
  `${n} ${n === 1 ? um : varios}`;
const comItem = (texto: string, item?: string) =>
  item ? `${texto} — item ${item}` : texto;
const semPonto = (t: string) => t.trim().replace(/\.$/, "");

/** Os motivos do resultado (vazio quando Apto ou em análise). */
export function motivosDoResultado(
  blocos: BlocoDaRegra[],
  lancamento: { blocos?: Record<string, unknown> },
  avaliacao: Avaliacao,
  resultado: string | null | undefined,
): MotivoDoResultado[] {
  if (resultado === "INAPTO_NOTA")
    return [
      {
        bloco: null,
        texto: `Nota ${textoDaNota(avaliacao.nota_apurada)} abaixo da mínima ${textoDaNota(avaliacao.nota_minima)}`,
      },
    ];
  if (resultado !== "INAPTO_REQUISITO") return [];
  const motivos: MotivoDoResultado[] = [];
  const efeitos = new Map((avaliacao.blocos ?? []).map((b) => [b.codigo, b]));
  for (const bloco of blocos) {
    if (!blocoConferido(lancamento, bloco)) continue;
    const nome = nomeCurtoDoBloco(bloco) as string;
    const avaliado = efeitos.get(bloco.codigo);
    if (avaliado?.efeito === "ELIMINA") {
      if (avaliado.motivos.length)
        for (const m of avaliado.motivos)
          motivos.push({
            bloco: bloco.codigo,
            texto: comItem(
              `${nome}: ${semPonto(m.texto)}`,
              m.item_edital || bloco.item_edital,
            ),
          });
      else
        motivos.push({
          bloco: bloco.codigo,
          texto: comItem(
            `${nome}: ${(rotuloDe(SITUACOES_DO_BLOCO, avaliado.situacao) as string).toLowerCase()}`,
            bloco.item_edital,
          ),
        });
    }
    const exp = avaliacao.experiencia;
    if (
      bloco.tipo === "VINCULOS" &&
      exp?.abaixo_do_minimo &&
      (bloco.efeito_minimo ?? "ELIMINA") === "ELIMINA"
    )
      motivos.push({
        bloco: bloco.codigo,
        texto: comItem(
          `Experiência mínima de ${plural(Number(bloco.minimo_meses), "mês", "meses")} não comprovada (comprovado ${plural(mesesDoMinimo(bloco, exp), "mês", "meses")})`,
          bloco.item_minimo || bloco.item_edital,
        ),
      });
  }
  if (!motivos.length)
    for (const t of avaliacao.eliminatorios ?? [])
      motivos.push({ bloco: null, texto: semPonto(t) });
  return motivos;
}
