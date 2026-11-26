/*
  Um pedaço do pacote baixado sob demanda (`import()`) uma vez só: a promessa
  fica guardada e todos os pedidos seguintes a reaproveitam. Se o download
  falhar (rede, versão nova publicada), a promessa rejeitada é esquecida e o
  próximo pedido baixa de novo, em vez de a parte ficar quebrada até
  recarregar a página.
*/
export function pedidoSobDemanda<T>(
  importar: () => Promise<T>,
): () => Promise<T> {
  let pedido: Promise<T> | null = null;
  return () => {
    pedido ??= importar().catch((erro: unknown) => {
      pedido = null;
      throw erro;
    });
    return pedido;
  };
}
