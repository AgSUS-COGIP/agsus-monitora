import { describe, expect, it } from "vitest";
import {
  alcanceDaSelecao,
  conviteParaTodos,
  marcarPagina,
  rotuloDaPagina,
  textoDaConfirmacao,
  textoDoAlcance,
} from "../../src/lib/base/alcance-da-selecao.ts";

/*
  Revisão de 17/11/2026: a Lista de aprovados oferecia "Selecionar os 13.184
  da tabela" numa caixa só. Agora "esta página" (as linhas desenhadas) e
  "todos os N resultados" são escolhas separadas, e a confirmação diz quantos
  serão afetados.
*/
const ids = (de: number, ate: number) =>
  Array.from({ length: ate - de }, (_, i) => `c${de + i}`);
const RECORTE = ids(0, 13184);
const PAGINA = RECORTE.slice(0, 50);
const CANDIDATOS = { singular: "candidato", plural: "candidatos" };
const FICHAS = { singular: "ficha", plural: "fichas", feminino: true };

describe("alcance da seleção", () => {
  it("nada marcado: a caixa da página e nenhum convite", () => {
    const a = alcanceDaSelecao(new Set(), PAGINA, RECORTE);
    expect(a).toEqual({
      tipo: "nenhum",
      quantos: 0,
      naPagina: 50,
      marcadosNaPagina: 0,
      total: 13184,
    });
    expect(rotuloDaPagina(a)).toBe("Selecionar esta página (50)");
    expect(conviteParaTodos(a)).toBe("");
  });

  it("esta página: só as 50 desenhadas, com o convite para os 13.184", () => {
    const a = alcanceDaSelecao(
      marcarPagina(new Set(), PAGINA, true),
      PAGINA,
      RECORTE,
    );
    expect(a.tipo).toBe("pagina");
    expect(a.quantos).toBe(50);
    expect(textoDoAlcance(a, CANDIDATOS)).toBe(
      "50 candidatos desta página selecionados (de 13.184 no resultado)",
    );
    expect(conviteParaTodos(a)).toBe("Selecionar todos os 13.184 resultados");
    expect(textoDaConfirmacao(a, 50, CANDIDATOS)).toBe(
      "50 candidatos serão afetados · só esta página",
    );
  });

  it("todos os resultados: diz que vai além da página", () => {
    const a = alcanceDaSelecao(new Set(RECORTE), PAGINA, RECORTE);
    expect(a.tipo).toBe("todos");
    expect(textoDoAlcance(a, CANDIDATOS)).toBe(
      "Todos os 13.184 candidatos do resultado selecionados",
    );
    expect(conviteParaTodos(a)).toBe("");
    expect(textoDaConfirmacao(a, 13000, CANDIDATOS)).toBe(
      "13.000 candidatos serão afetados · todos os resultados do filtro, não só os 50 desta página · 184 dos marcados não se aplicam",
    );
  });

  it("marcados à mão: a parte, com o total do resultado", () => {
    const a = alcanceDaSelecao(new Set(["c1", "c70"]), PAGINA, RECORTE);
    expect(a).toMatchObject({ tipo: "parte", quantos: 2, marcadosNaPagina: 1 });
    expect(textoDoAlcance(a, CANDIDATOS)).toBe(
      "2 candidatos selecionados (de 13.184 no resultado)",
    );
    expect(textoDaConfirmacao(a, 1, CANDIDATOS)).toBe(
      "1 candidato será afetado · 1 dos marcados não se aplicam",
    );
  });

  it("marcado que saiu do recorte não conta", () => {
    const a = alcanceDaSelecao(new Set(["fora"]), PAGINA, RECORTE);
    expect(a.tipo).toBe("nenhum");
  });

  it("recorte que cabe na página: marcar a página é marcar todos", () => {
    const pequeno = ids(0, 12);
    const a = alcanceDaSelecao(new Set(pequeno), pequeno, pequeno);
    expect(a.tipo).toBe("todos");
    expect(textoDaConfirmacao(a, 12, CANDIDATOS)).toBe(
      "12 candidatos serão afetados",
    );
  });

  it("concorda no feminino (fichas)", () => {
    const a = alcanceDaSelecao(new Set(["c1"]), PAGINA, RECORTE);
    expect(textoDoAlcance(a, FICHAS)).toBe(
      "1 ficha selecionada (de 13.184 no resultado)",
    );
    expect(textoDaConfirmacao(a, 1, FICHAS)).toBe("1 ficha será afetada");
    const todas = alcanceDaSelecao(new Set(RECORTE), PAGINA, RECORTE);
    expect(textoDoAlcance(todas, FICHAS)).toBe(
      "Todas as 13.184 fichas do resultado selecionadas",
    );
  });

  it("desmarcar a página tira só as dela", () => {
    const marcados = marcarPagina(new Set(["c70"]), PAGINA, true);
    expect(marcarPagina(marcados, PAGINA, false)).toEqual(new Set(["c70"]));
  });
});
