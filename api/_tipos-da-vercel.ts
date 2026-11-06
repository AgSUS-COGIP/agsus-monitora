/*
  Os tipos do pedido e da resposta que a Vercel entrega às funções de `api/`
  (o `IncomingMessage` e o `ServerResponse` do Node, com os acréscimos dela).
  Só tipos: nenhuma função importa daqui em tempo de execução. O "_" no começo
  do nome faz a Vercel NÃO publicar este arquivo como rota.
*/
import type { IncomingMessage, ServerResponse } from "node:http";

/** A query string já lida pela Vercel; parâmetro repetido vem em lista. */
export type QueryDaVercel = Partial<Record<string, string | string[]>>;

export type PedidoDaVercel = IncomingMessage & { query?: QueryDaVercel };

export type RespostaDaVercel = ServerResponse & {
  status(codigo: number): RespostaDaVercel;
};
