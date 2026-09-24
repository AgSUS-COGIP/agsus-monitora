import { describe, expect, it } from "vitest";
import { buscarTodasAsPaginas } from "../src/lib/paginas-em-paralelo.js";

function fonte(total, { contar = true, falharEm = -1 } = {}) {
  const linhas = Array.from({ length: total }, (_, i) => i);
  let emVoo = 0;
  const estado = { pedidos: 0, maximoEmParalelo: 0 };
  const buscarPagina = async (inicio, fim, opcoes) => {
    estado.pedidos += 1;
    emVoo += 1;
    estado.maximoEmParalelo = Math.max(estado.maximoEmParalelo, emVoo);
    await new Promise((r) => setTimeout(r, 5));
    emVoo -= 1;
    if (inicio === falharEm)
      return { data: null, error: { message: "falhou" } };
    return {
      data: linhas.slice(inicio, fim + 1),
      error: null,
      count: contar && opcoes.contar ? total : null,
    };
  };
  return { buscarPagina, estado, linhas };
}

describe("busca paginada em paralelo", () => {
  it("devolve tudo, na ordem, com as páginas em paralelo", async () => {
    const { buscarPagina, estado, linhas } = fonte(15895);
    const { data, error } = await buscarTodasAsPaginas(buscarPagina, {
      tamanho: 1000,
      concorrencia: 6,
    });
    expect(error).toBeNull();
    expect(data).toEqual(linhas);
    expect(estado.pedidos).toBe(16);
    expect(estado.maximoEmParalelo).toBe(6);
  });

  it("uma página só não faz pedido extra", async () => {
    const { buscarPagina, estado } = fonte(30);
    const { data } = await buscarTodasAsPaginas(buscarPagina, {
      tamanho: 1000,
    });
    expect(data).toHaveLength(30);
    expect(estado.pedidos).toBe(1);
  });

  it("sem total, busca em sequência como antes", async () => {
    const { buscarPagina, estado, linhas } = fonte(2500, { contar: false });
    const { data } = await buscarTodasAsPaginas(buscarPagina, {
      tamanho: 1000,
    });
    expect(data).toEqual(linhas);
    expect(estado.maximoEmParalelo).toBe(1);
  });

  it("erro numa página é devolvido", async () => {
    const { buscarPagina } = fonte(5000, { falharEm: 3000 });
    const { error } = await buscarTodasAsPaginas(buscarPagina, {
      tamanho: 1000,
    });
    expect(error).toEqual({ message: "falhou" });
  });
});
