import { describe, expect, it } from "vitest";
import { definicoes, resolver, valorDe } from "./apoio/tokens-de-camada.ts";

describe("tokens usados pelo acabamento", () => {
  const nomes = [
    "--z-dropdown",
    "--z-modal",
    "--z-tooltip",
    ...["sm", "md", "lg", "xl", "full"].map((t) => `--radius-${t}`),
    ...["sm", "md", "lg"].map((t) => `--shadow-${t}`),
    ...["fast", "base", "slow"].map((t) => `--duration-${t}`),
    ...["standard", "exit"].map((t) => `--ease-${t}`),
  ];

  it.each(nomes)("%s está definido uma vez só no :root", (nome) => {
    const vezes = definicoes.filter(([n]) => n === nome).length;
    expect(vezes).toBe(1);
  });
});

describe("ordem das camadas", () => {
  it("cresce estritamente de sticky até tooltip", () => {
    const ordem = [
      "--z-sticky",
      "--z-header",
      "--z-sidebar",
      "--z-popover",
      "--z-overlay",
      "--z-loader",
      "--z-toast",
      "--z-tooltip",
    ];
    const numeros = ordem.map((n) => resolver(valorDe(n)));
    for (let i = 1; i < numeros.length; i += 1) {
      expect(
        numeros[i],
        `${ordem[i]} acima de ${ordem[i - 1]}`,
      ).toBeGreaterThan(numeros[i - 1] as number);
    }
  });

  it("dropdown vale o popover e modal vale o overlay", () => {
    expect(resolver(valorDe("--z-dropdown"))).toBe(
      resolver(valorDe("--z-popover")),
    );
    expect(resolver(valorDe("--z-modal"))).toBe(
      resolver(valorDe("--z-overlay")),
    );
  });
});
