import { describe, expect, it, vi } from "vitest";

import { criarEstadoDasEntrevistas } from "../../src/modulos/entrevistas/estado.ts";
import { criarEstadoDosRecursos } from "../../src/modulos/recursos/estado.ts";
import { criarEstadoDaSelecao } from "../../src/modulos/selecao/estado.ts";

/*
  O nome da planilha exportada leva o dia de Brasília. Com toISOString o dia era o de UTC:
  quem exportava depois das 21h recebia o arquivo com a data de amanhã.
*/
const NOITE_EM_BRASILIA = () => Date.parse("2026-10-01T22:30:00-03:00");

const casos = [
  [
    "entrevistas",
    criarEstadoDasEntrevistas,
    /^entrevistas-(.*-)?2026-10-01\.xlsx$/,
  ],
  ["recursos", criarEstadoDosRecursos, /^recursos-(.*-)?2026-10-01\.xlsx$/],
  ["seleção", criarEstadoDaSelecao, /^selecao-(.*-)?2026-10-01\.xlsx$/],
];

describe("data no nome da planilha exportada", () => {
  it.each(casos)(
    "%s: o dia é o de Brasília, não o de UTC",
    async (_, criar, nome) => {
      const baixar = vi.fn();
      const estado = criar({ baixar, agora: NOITE_EM_BRASILIA });
      await estado.exportar("excel", [], []);
      expect(baixar).toHaveBeenCalledTimes(1);
      expect(baixar.mock.calls[0][1]).toMatch(nome);
    },
  );
});
