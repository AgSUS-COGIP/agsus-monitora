/* Item da ficha: a escolha do avaliador e o que ela grava (API pública em ../item-da-ficha.tsx). */

import { PARCIAL_DO_TIPO as PARCIAIS_DOS_TIPOS } from "../../../../lib/avaliacao-documental/catalogo.ts";
import {
  BLOCOS_COM_ITENS as ITENS_DOS_TIPOS,
  blocoSeAplica,
  decidePelaNota,
  ESCOLHAS_DA_FICHA,
  respostasDoBloco,
  sugereNaoEnviado,
} from "../../../../lib/avaliacao-documental/ficha.ts";
import {
  blocoComEscolha,
  blocoEditaNota,
  escolhaPelosItens,
  lancamentoComEscolha,
  lancamentoConfirmadoPelosItens,
} from "../../../../lib/avaliacao-documental/apurado-da-ficha.ts";
import type { Escolha } from "../../../../lib/avaliacao-documental/apurado-da-ficha.ts";
import { arquivosDaPergunta } from "../../../../lib/avaliacao-documental/respostas-do-candidato.ts";
import {
  itensParaConferir,
  leiturasDaFicha,
} from "../../../../lib/avaliacao-documental/leitura-dos-arquivos.ts";
import type { ItemParaConferir } from "../../../../lib/avaliacao-documental/leitura-dos-arquivos.ts";
import type { EnderecosDaEmpregare } from "../../../../lib/avaliacao-documental/anexo-na-empregare.ts";
import type {
  Bloco,
  EstadoDaFicha,
  Lancado,
  LinhaDeResposta,
  Mudar,
  Situacao,
} from "../tipos.ts";

export type ChaveDosItens = "titulos" | "cursos" | "vinculos";
export const BLOCOS_COM_ITENS = ITENS_DOS_TIPOS as Readonly<
  Record<string, ChaveDosItens | undefined>
>;
export const PARCIAL_DO_TIPO = PARCIAIS_DOS_TIPOS as Readonly<
  Record<string, string | undefined>
>;
export const ESCOLHAS = ESCOLHAS_DA_FICHA as unknown as ReadonlyArray<
  readonly [Escolha, string, string]
>;
export const ICONE_DA_ESCOLHA: Record<Escolha, string> = {
  CONFERE: "fa-check",
  NAO_CONFERE: "fa-xmark",
  EDITAR: "fa-pen",
};

/* O selo do item conferido: [tom, rótulo, ícone]. */
export const SELO_DA_SITUACAO: Record<Situacao, [string, string, string]> = {
  CONFORME: ["aprovado", "Conforme", "fa-check"],
  NAO_CONFORME: ["reprovado", "Não conforme", "fa-xmark"],
  NAO_ENVIADO: ["neutro", "Não enviado", "fa-ban"],
};

export function textoDoEfeito(efeito: string) {
  if (efeito === "ELIMINA") return "Elimina";
  if (efeito.startsWith("ENCAMINHA")) return "Encaminha";
  if (efeito === "SEGUE_AMPLA") return "Segue na ampla";
  return "Sem pontos";
}

/* Muda os campos do bloco no lançamento. */
export const alterarBloco = (mudar: Mudar, codigo: string, campos: Lancado) =>
  mudar((l) => {
    l.blocos = {
      ...l.blocos,
      [codigo]: { ...(l.blocos?.[codigo] || {}), ...campos },
    };
    return l;
  });

/** O que a escolha precisa saber do candidato: o declarado e as respostas. */
export type ContextoDaEscolha = {
  declarada: EstadoDaFicha["declarada"];
  /** As respostas do candidato no bloco (o título declarado vem pré-escolhido). */
  respostas: string[];
  /** No Não confere: o candidato não enviou o documento (NAO_ENVIADO). */
  naoEnviou?: boolean;
  /** As linhas que o job Python tirou das respostas (obter_ficha_analise → sugestoes). */
  sugestoes?: EstadoDaFicha["dados"]["sugestoes"];
  /** Pelos itens lidos do arquivo: a pontuação dos aceitos (o Confere vira "Confirmar"). */
  pelosItens?: { calculado: number } | null;
};

/** Os itens que o robô leu dos arquivos do bloco, para conferir (sem leitura, nenhum). */
export function lidosDoBloco(
  st: EstadoDaFicha,
  bloco: Bloco,
  enderecos: EnderecosDaEmpregare | null | undefined,
): ItemParaConferir[] {
  const leituras = leiturasDaFicha(st.dados.leituras);
  if (!enderecos || !leituras.length || !BLOCOS_COM_ITENS[bloco.tipo])
    return [];
  if (!blocoSeAplica(bloco, st.lancamento)) return [];
  // Cursos pela faixa/nota do bloco: sem a conferência item a item.
  if (decidePelaNota(bloco, st.lancamento)) return [];
  const linhas = respostasDoBloco(
    bloco,
    st.dados.respostas,
  ) as LinhaDeResposta[];
  // Os arquivos capturados de cada pergunta, mesmo com "--" na exportação.
  return itensParaConferir(
    bloco,
    leituras,
    linhas.flatMap((l) => arquivosDaPergunta(enderecos, l.coluna)),
  );
}

/** O bloco decide pelos itens lidos? (pontua e o robô leu itens.) */
export const decidePelosItens = (bloco: Bloco, lidos: ItemParaConferir[]) =>
  lidos.length > 0 && blocoEditaNota(bloco);

/** O contexto da escolha de um bloco, a partir do estado da ficha. */
export function contextoDaEscolha(
  st: EstadoDaFicha,
  bloco: Bloco,
  enderecos?: EnderecosDaEmpregare | null,
): ContextoDaEscolha {
  const linhas = respostasDoBloco(
    bloco,
    st.dados.respostas,
  ) as LinhaDeResposta[];
  const parcial = PARCIAL_DO_TIPO[bloco.tipo] ?? "";
  return {
    declarada: st.declarada,
    respostas: linhas.map((l) => l.texto),
    naoEnviou: sugereNaoEnviado(linhas),
    sugestoes: st.dados.sugestoes,
    pelosItens: decidePelosItens(bloco, lidosDoBloco(st, bloco, enderecos))
      ? { calculado: st.avaliacao.calculados?.[parcial] ?? 0 }
      : null,
  };
}

/**
 * Grava uma escolha (botões ou teclas 1, 2 e 3): a situação, os motivos, a
 * pontuação e, no Confere/Editar sem nada registrado, a primeira linha.
 * Pelos itens, o Confere é o "Confirmar" (Confere ou Editar nota, conforme
 * a pontuação dos aceitos). Devolve a escolha gravada.
 */
export function decidirNoLancamento(
  bloco: Bloco,
  mudar: Mudar,
  escolha: Escolha | null,
  contexto: ContextoDaEscolha,
): Escolha | null {
  if (escolha === "CONFERE" && contexto.pelosItens) {
    const { calculado } = contexto.pelosItens;
    mudar((l) =>
      lancamentoConfirmadoPelosItens({
        bloco,
        lancamento: l,
        declarada: contexto.declarada,
        calculado,
      }),
    );
    return escolhaPelosItens(bloco, contexto.declarada, calculado);
  }
  if (escolha === "EDITAR" && contexto.pelosItens) {
    // Pelos itens, "Editar nota" é o ajuste fino: parte da pontuação dos
    // aceitos (o passador aparece) e não abre linha nova.
    const { calculado } = contexto.pelosItens;
    mudar((l) => {
      const editado = blocoComEscolha({
        bloco,
        lancamento: l,
        escolha: "EDITAR",
        declarada: contexto.declarada,
      }) as Lancado;
      l.blocos = {
        ...l.blocos,
        [bloco.codigo]: {
          ...editado,
          nota_ajustada:
            typeof editado.nota_ajustada === "number"
              ? editado.nota_ajustada
              : calculado,
        },
      };
      return l;
    });
    return "EDITAR";
  }
  mudar((l) =>
    lancamentoComEscolha({
      bloco,
      lancamento: l,
      escolha,
      declarada: contexto.declarada,
      respostas: contexto.respostas,
      naoEnviou: contexto.naoEnviou,
      sugestoes: contexto.sugestoes,
    }),
  );
  return escolha;
}
