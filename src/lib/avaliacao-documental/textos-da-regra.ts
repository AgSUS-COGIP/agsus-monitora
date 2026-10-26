/*
  Os textos que a regra da avaliação documental põe no parecer, sem espaço nas
  pontas ao salvar a versão (salvar_regra_analise, do assistente e do modo
  avançado): o motivo e o item do edital dos motivos dos blocos, o texto e o
  item das observações prontas e o motivo e o item dos requisitos por cargo.
  Só as pontas: o meio do texto fica como foi digitado, e nenhum outro campo
  muda (o prefixo de coluna da eliminação automática, por exemplo, termina em
  espaço de propósito).

  As versões já salvas são imutáveis (TG_THREGRAANALISE_IMUTAVEL) e ficam como
  estão: o parecer já sai sem espaço nas pontas das linhas
  (linhasSemEspacosNasPontas de pontuacao.ts), e a conferência da conta
  ignora só essa diferença (conferir_ficha do Python).
*/
import type { RegraAnalise } from "./tipos-da-regra.ts";

type Objeto = Record<string, unknown>;

const ehObjeto = (v: unknown): v is Objeto =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/* Os campos de texto de cada item da lista sem espaço (nem tabulação) nas pontas. */
function semPontas(lista: unknown, campos: readonly string[]): unknown {
  if (!Array.isArray(lista)) return lista;
  return lista.map((item: unknown) => {
    if (!ehObjeto(item)) return item;
    const limpo: Objeto = { ...item };
    for (const campo of campos) {
      const valor = limpo[campo];
      if (typeof valor === "string")
        limpo[campo] = valor.replace(/^[ \t]+|[ \t]+$/g, "");
    }
    return limpo;
  });
}

const DO_MOTIVO = ["texto", "item_edital"] as const;
const DO_REQUISITO = ["motivo", "item_edital"] as const;

/** A regra com os textos do parecer sem espaço nas pontas (cópia; a entrada não muda). */
export function regraComTextosSemEspacosNasPontas(
  regra: RegraAnalise,
): RegraAnalise {
  const entrada = regra as unknown as Objeto;
  const saida: Objeto = { ...entrada };
  if (Array.isArray(entrada.blocos))
    saida.blocos = entrada.blocos.map((bloco: unknown) =>
      ehObjeto(bloco) && Array.isArray(bloco.motivos)
        ? { ...bloco, motivos: semPontas(bloco.motivos, DO_MOTIVO) }
        : bloco,
    );
  if (Array.isArray(entrada.observacoes_prontas))
    saida.observacoes_prontas = semPontas(
      entrada.observacoes_prontas,
      DO_MOTIVO,
    );
  if (Array.isArray(entrada.por_cargo))
    saida.por_cargo = entrada.por_cargo.map((cargo: unknown) => {
      if (!ehObjeto(cargo) || !ehObjeto(cargo.blocos)) return cargo;
      const blocos: Objeto = {};
      for (const [codigo, bloco] of Object.entries(cargo.blocos))
        blocos[codigo] =
          ehObjeto(bloco) && Array.isArray(bloco.requisitos)
            ? {
                ...bloco,
                requisitos: semPontas(bloco.requisitos, DO_REQUISITO),
              }
            : bloco;
      return { ...cargo, blocos };
    });
  return saida as unknown as RegraAnalise;
}
