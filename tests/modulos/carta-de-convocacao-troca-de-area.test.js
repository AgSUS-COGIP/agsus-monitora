import { describe, expect, it } from "vitest";
import { criarEstadoDaCarta } from "../../src/modulos/aprovados/carta-de-convocacao/estado.js";

/*
  Trocar de área enquanto os modelos da carta carregavam descartava a
  resposta, mas deixava `carregando: true` publicado: a tela de modelos e o
  modal da carta ficavam no esqueleto para sempre.
*/
function supabaseControlado() {
  const pendentes = [];
  return {
    pendentes,
    rpc: (nome, argumentos) =>
      new Promise((resolver) => pendentes.push({ nome, argumentos, resolver })),
  };
}

const RESPOSTA = { data: { modelos: [], pode_editar: true }, error: null };

describe("Carta de convocação: troca de área durante a carga", () => {
  it("descarta a resposta da área anterior sem ficar carregando", async () => {
    const supabase = supabaseControlado();
    let area = "saude-indigena";
    const estado = criarEstadoDaCarta({ supabase, areaAtual: () => area });
    const carga = estado.carregarModelos();
    expect(estado.obter().carregando).toBe(true);

    area = "projetos";
    supabase.pendentes[0].resolver(RESPOSTA);

    expect(await carga).toBe(false);
    expect(estado.obter().carregando).toBe(false);
    expect(estado.obter().carregado).toBe(false);
  });

  it("a carga antiga que termina depois não desliga a carga nova", async () => {
    const supabase = supabaseControlado();
    let area = "saude-indigena";
    const estado = criarEstadoDaCarta({ supabase, areaAtual: () => area });
    const antiga = estado.carregarModelos();
    area = "projetos";
    const nova = estado.carregarModelos();

    supabase.pendentes[0].resolver(RESPOSTA);
    await antiga;
    expect(estado.obter().carregando).toBe(true);

    supabase.pendentes[1].resolver(RESPOSTA);
    expect(await nova).toBe(true);
    expect(estado.obter()).toMatchObject({
      area: "projetos",
      carregando: false,
      carregado: true,
    });
  });
});
