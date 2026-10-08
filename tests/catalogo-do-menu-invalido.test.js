import { describe, expect, it } from "vitest";
import {
  abasDoCatalogo,
  montarArvoreDoMenu,
  paginasDaArea,
} from "../src/lib/menu-lateral.ts";

const aba = {
  co_aba: "editais",
  no_aba: "Editais",
  co_view: "nucleo",
  co_recurso: "nucleo",
  ds_icone: "file-text",
  nu_ordem: 2,
  areas: [{ co_area: "sede" }],
};

describe("catálogo do menu recebido do banco", () => {
  it.each([null, {}, "catálogo", [null, [], 12, false, {}]])(
    "usa a alternativa do código quando não há abas válidas: %j",
    (dados) => {
      expect(abasDoCatalogo(dados)).toBeNull();
      const arvore = montarArvoreDoMenu({
        permitidas: { nucleo: true },
        areas: ["sede"],
        abas: abasDoCatalogo(dados),
      });
      expect(arvore[0].itens[0].view).toBe("nucleo");
    },
  );

  it("ignora linhas e áreas malformadas sem transformar objetos em identificações", () => {
    const catalogo = abasDoCatalogo([
      null,
      { ...aba, co_aba: {} },
      { ...aba, no_aba: [] },
      { ...aba, co_view: 123 },
      {
        ...aba,
        areas: [null, { co_area: {} }, { co_area: "sede", nu_ordem: false }],
      },
    ]);
    expect(catalogo).toHaveLength(1);
    expect(catalogo[0].areas).toHaveLength(1);
    expect(catalogo[0].areas[0].ordem).toBeNull();
    expect(paginasDaArea(catalogo, "sede")[0].view).toBe("nucleo");
  });

  it("preserva manutenção, beta e substituições de view e ícone por área", () => {
    const catalogo = abasDoCatalogo([
      {
        ...aba,
        st_beta: true,
        tp_situacao: "MANUTENCAO",
        ds_mensagem: "Ajustes",
        dt_previsao: "2026-10-10",
        areas: [
          {
            co_area: "sede",
            co_view: "calendario",
            ds_icone: "calendar-days",
            nu_ordem: 1,
          },
        ],
      },
    ]);
    expect(paginasDaArea(catalogo, "sede")).toEqual([
      {
        view: "calendario",
        rotulo: "Editais",
        icone: "calendar-days",
        beta: true,
        manutencao: { mensagem: "Ajustes", previsao: "2026-10-10" },
      },
    ]);
  });
});
