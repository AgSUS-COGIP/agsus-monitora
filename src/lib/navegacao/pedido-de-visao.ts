/*
  A visão pedida pela navegação (`?visao=agenda`, o `abrirVisao` do
  controlador, src/app/telas.tsx) para uma tela que guarda a aba no próprio
  componente (na URL, por `usarFiltrosNaUrl`). O controlador recebe o pedido
  antes de a tela montar, ou com ela já montada; o componente assina, aplica
  e consome. Vale uma vez, como a visão do endereço. Sem React.

  Usado pela Classificação ("Editar na Classificação › Agenda", da Central de
  convocações e do Preparar de Conduzir entrevistas).
*/

export interface PedidoDeVisao {
  /** Pede a visão; recusada (não é uma das da tela), devolve false. */
  pedir(visao: string): boolean;
  /** A visão pedida e ainda não aplicada ("" = nenhuma). */
  obter(): string;
  /** Esquece o pedido (o componente o aplicou). */
  consumir(): void;
  assinar(ouvinte: () => void): () => void;
}

export function criarPedidoDeVisao(
  aceita: (visao: string) => boolean,
): PedidoDeVisao {
  let pedido = "";
  const ouvintes = new Set<() => void>();
  const mudar = (novo: string) => {
    if (novo === pedido) return;
    pedido = novo;
    ouvintes.forEach((ouvinte) => ouvinte());
  };
  return {
    pedir(visao) {
      const valor = typeof visao === "string" ? visao.trim() : "";
      if (!valor || !aceita(valor)) return false;
      mudar(valor);
      return true;
    },
    obter: () => pedido,
    consumir: () => mudar(""),
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
  };
}
