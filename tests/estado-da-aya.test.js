import { describe, expect, it, vi } from "vitest";
import {
  CHAVE_COMEMORACOES_PESSOAIS,
  CHAVE_DO_ACENO,
  comemoracoesPessoaisDesligadas,
  definirEstadoDaAya,
  deveAcenar,
  direcaoDoOlhar,
  DURACAO_PADRAO_MS,
  ESTADOS_DA_MASCOTE,
  estadoVisivel,
  EVENTO_ESTADO_DA_AYA,
  intervaloDaPiscada,
  intervaloDoArrepio,
  lerPedido,
  piscadaDupla,
  resolverEstado,
} from "../src/lib/estado-da-aya.ts";

/* A regra da mascote da Aya, sem DOM (src/lib/estado-da-aya.ts). */

const sequencia = (...valores) => {
  let i = 0;
  return () => valores[i++ % valores.length];
};

function armazenamento(inicial = {}) {
  const dados = new Map(Object.entries(inicial));
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
  };
}

describe("estados e pedidos", () => {
  it("os sete estados", () => {
    expect(ESTADOS_DA_MASCOTE).toEqual([
      "parada",
      "atenta",
      "falando",
      "pensando",
      "comemorando",
      "dormindo",
      "acenando",
    ]);
  });

  it("lê o pedido: estado válido, duração informada ou a padrão", () => {
    expect(lerPedido("voando")).toBeNull();
    expect(lerPedido("pensando")).toEqual({
      estado: "pensando",
      duracaoMs: null,
    });
    expect(lerPedido("comemorando")).toEqual({
      estado: "comemorando",
      duracaoMs: DURACAO_PADRAO_MS.comemorando,
    });
    expect(lerPedido("comemorando", 1500).duracaoMs).toBe(1500);
    expect(lerPedido("acenando", -3).duracaoMs).toBe(
      DURACAO_PADRAO_MS.acenando,
    );
    // Teto de 1 minuto: ninguém prende a arara num estado.
    expect(lerPedido("falando", 999999).duracaoMs).toBe(60000);
  });

  it("definirEstadoDaAya dispara o evento global aya:estado", () => {
    const ouvinte = vi.fn();
    window.addEventListener(EVENTO_ESTADO_DA_AYA, ouvinte);
    expect(definirEstadoDaAya("comemorando", 2000)).toBe(true);
    expect(definirEstadoDaAya("inexistente")).toBe(false);
    window.removeEventListener(EVENTO_ESTADO_DA_AYA, ouvinte);
    expect(ouvinte).toHaveBeenCalledTimes(1);
    expect(ouvinte.mock.calls[0][0].detail).toEqual({
      estado: "comemorando",
      duracaoMs: 2000,
    });
  });
});

describe("qual estado aparece", () => {
  it("fixo > global > próprio > momento > atenta > dormindo > parada", () => {
    expect(resolverEstado({})).toBe("parada");
    expect(resolverEstado({ dormindo: true })).toBe("dormindo");
    expect(resolverEstado({ dormindo: true, perto: true })).toBe("atenta");
    expect(resolverEstado({ perto: true, momento: "acenando" })).toBe(
      "acenando",
    );
    expect(resolverEstado({ momento: "acenando", proprio: "falando" })).toBe(
      "falando",
    );
    expect(resolverEstado({ proprio: "falando", global: "comemorando" })).toBe(
      "comemorando",
    );
    expect(resolverEstado({ global: "comemorando", fixo: "dormindo" })).toBe(
      "dormindo",
    );
  });

  it("com as comemorações desligadas, não comemora", () => {
    expect(
      resolverEstado({
        global: "comemorando",
        proprio: "pensando",
        comemoracoesDesligadas: true,
      }),
    ).toBe("pensando");
    expect(
      resolverEstado({ fixo: "comemorando", comemoracoesDesligadas: true }),
    ).toBe("parada");
  });

  it("movimento reduzido: só parada (ou dormindo, de olhos fechados)", () => {
    for (const estado of ESTADOS_DA_MASCOTE)
      expect(estadoVisivel(estado, { reduzido: true })).toBe(
        estado === "dormindo" ? "dormindo" : "parada",
      );
    expect(estadoVisivel("comemorando")).toBe("comemorando");
  });
});

describe("tempos sorteados", () => {
  it("pisca de 3 a 7 s; o sorteio fixo dá sempre o mesmo intervalo", () => {
    expect(intervaloDaPiscada(() => 0)).toBe(3000);
    expect(intervaloDaPiscada(() => 1)).toBe(7000);
    expect(intervaloDaPiscada(() => 0.5)).toBe(5000);
    const a = sequencia(0.1, 0.9, 0.42);
    const b = sequencia(0.1, 0.9, 0.42);
    const primeira = [1, 2, 3].map(() => intervaloDaPiscada(a));
    expect(primeira).toEqual([1, 2, 3].map(() => intervaloDaPiscada(b)));
    expect(primeira).toEqual([3400, 6600, 4680]);
    // Valor fora do intervalo não quebra.
    expect(intervaloDaPiscada(() => Number.NaN)).toBe(5000);
    expect(intervaloDaPiscada(() => 5)).toBe(7000);
  });

  it("arrepio de 9 a 16 s; piscada dupla 1 em 5", () => {
    expect(intervaloDoArrepio(() => 0)).toBe(9000);
    expect(intervaloDoArrepio(() => 1)).toBe(16000);
    expect(piscadaDupla(() => 0.1)).toBe(true);
    expect(piscadaDupla(() => 0.5)).toBe(false);
  });
});

describe("preferências", () => {
  it("acena uma vez por sessão", () => {
    const sessao = armazenamento();
    expect(deveAcenar(sessao)).toBe(true);
    expect(sessao.getItem(CHAVE_DO_ACENO)).toBe("1");
    expect(deveAcenar(sessao)).toBe(false);
    expect(deveAcenar(null)).toBe(false);
    const quebrado = {
      getItem: () => {
        throw new Error("bloqueado");
      },
    };
    expect(deveAcenar(quebrado)).toBe(false);
  });

  it("comemorações pessoais desligadas com '1'", () => {
    expect(comemoracoesPessoaisDesligadas(armazenamento())).toBe(false);
    expect(
      comemoracoesPessoaisDesligadas(
        armazenamento({ [CHAVE_COMEMORACOES_PESSOAIS]: "1" }),
      ),
    ).toBe(true);
  });
});

describe("olhar", () => {
  it("aponta para o ponteiro, até 1 em cada eixo", () => {
    expect(direcaoDoOlhar({ x: 0, y: 0 }, { x: 0, y: 0 })).toEqual({
      x: 0,
      y: 0,
      distancia: 0,
    });
    const longe = direcaoDoOlhar({ x: 0, y: 0 }, { x: 1000, y: 0 });
    expect(longe.x).toBe(1);
    expect(longe.y).toBe(0);
    const perto = direcaoDoOlhar({ x: 0, y: 0 }, { x: 0, y: -80 }, 160);
    expect(perto.y).toBe(-0.5);
  });
});
