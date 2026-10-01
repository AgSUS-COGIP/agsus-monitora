import { describe, expect, it, vi } from "vitest";

import { criarEstadoDasEntrevistas } from "../../src/modulos/entrevistas/estado.js";
import { criarEstadoDosRecursos } from "../../src/modulos/recursos/estado.js";
import { criarEstadoDaSelecao } from "../../src/modulos/selecao/estado.js";

/*
  O nome do CSV leva o dia de Brasília. Com toISOString o dia era o de UTC:
  quem exportava depois das 21h recebia o arquivo com a data de amanhã.
*/
const NOITE_EM_BRASILIA = () => Date.parse("2026-10-01T22:30:00-03:00");

const casos = [
  ["entrevistas", criarEstadoDasEntrevistas, /^entrevistas-.*-2026-10-01\.csv$/],
  ["recursos", criarEstadoDosRecursos, /^recursos-.*-2026-10-01\.csv$/],
  ["seleção", criarEstadoDaSelecao, /^selecao-.*-2026-10-01\.csv$/],
];

describe("data no nome do CSV", () => {
  it.each(casos)("%s: o dia é o de Brasília, não o de UTC", (_, criar, nome) => {
    const baixar = vi.fn();
    const estado = criar({ baixar, agora: NOITE_EM_BRASILIA });
    estado.exportarCsv([], []);
    expect(baixar).toHaveBeenCalledTimes(1);
    expect(baixar.mock.calls[0][1]).toMatch(nome);
  });
});
