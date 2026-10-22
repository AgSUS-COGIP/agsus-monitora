import { describe, expect, it, vi } from "vitest";
import { criarEstadoDaVisaoGeral } from "../src/modulos/visao-geral/estado.ts";

/*
  22/10: a Visão geral fica montada escondida e recalculava tudo (linhas da
  área, recorte, indicadores) a cada carga, filtro ou troca de área, mesmo
  fechada. Fechada, só marca; calcula quando alguém lê ou quando abre.
*/

function dadosFalsos() {
  let atual = { linhas: [], areaAtual: "saude-indigena", carregado: false };
  const ouvintes = new Set();
  return {
    assinar: (f) => (ouvintes.add(f), () => ouvintes.delete(f)),
    obter: () => atual,
    mudar(novo) {
      atual = { ...atual, ...novo };
      for (const f of ouvintes) f();
    },
  };
}

describe("Visão geral fechada", () => {
  it("não avisa a tela nem recalcula; ao abrir, calcula uma vez com o dado novo", () => {
    const dados = dadosFalsos();
    const estado = criarEstadoDaVisaoGeral({
      dados,
      armazenamento: null,
      aberta: false,
    });
    const tela = vi.fn();
    estado.assinar(tela);
    dados.mudar({ carregado: true, linhas: [] });
    dados.mudar({ areaAtual: "sede" });
    estado.definirBusca("x");
    expect(tela).not.toHaveBeenCalled();

    estado.definirAberta(true);
    expect(tela).toHaveBeenCalledTimes(1);
    const visto = estado.obter();
    expect(visto.carregado).toBe(true);
    expect(visto.area).toBe("sede");
    // Sem mudança, a mesma foto (o React não redesenha à toa).
    expect(estado.obter()).toBe(visto);
  });

  it("quem lê com a página fechada (PDF, busca) recebe o dado em dia", () => {
    const dados = dadosFalsos();
    const estado = criarEstadoDaVisaoGeral({
      dados,
      armazenamento: null,
      aberta: false,
    });
    dados.mudar({ carregado: true, areaAtual: "sede" });
    expect(estado.obter().area).toBe("sede");
    expect(estado.obter().carregado).toBe(true);
  });
});
