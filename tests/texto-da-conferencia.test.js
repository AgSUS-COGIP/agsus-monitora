import { describe, expect, it } from "vitest";
import {
  quandoFoi,
  textoDaConferencia,
} from "../src/lib/texto-da-conferencia.js";

/* A hora no topo das telas de carga: conferência (a carga rodou) e mudança (o dado mudou). */
const agora = new Date("2026-10-05T12:55:00Z"); // 09:55 em Brasília

describe("texto da conferência", () => {
  it("hoje mostra só a hora; outro dia, dia e hora (Brasília)", () => {
    expect(quandoFoi("2026-10-05T12:32:00Z", agora)).toBe("às 09:32");
    expect(quandoFoi("2026-10-04T16:05:00Z", agora)).toBe("em 04/10, 13:05");
    expect(quandoFoi(null, agora)).toBe("");
    expect(quandoFoi("lixo", agora)).toBe("");
  });

  it("conferido hoje e mudança antes: os dois, a carga não parou", () => {
    expect(
      textoDaConferencia({
        conferidoEm: "2026-10-05T12:32:00Z",
        mudancaEm: "2026-10-04T16:05:00Z",
        agora,
      }),
    ).toBe("Conferido às 09:32 · última mudança em 04/10, 13:05");
  });

  it("só um dos dois, ou nenhum", () => {
    expect(
      textoDaConferencia({ conferidoEm: "2026-10-04T16:43:00Z", agora }),
    ).toBe("Conferido em 04/10, 13:43");
    expect(
      textoDaConferencia({ mudancaEm: "2026-10-05T12:00:00Z", agora }),
    ).toBe("Atualizado às 09:00");
    expect(textoDaConferencia({ agora })).toBeNull();
  });

  it("mudança depois da conferência (dado novo ainda não conferido): só a conferência", () => {
    expect(
      textoDaConferencia({
        conferidoEm: "2026-10-05T12:00:00Z",
        mudancaEm: "2026-10-05T12:30:00Z",
        agora,
      }),
    ).toBe("Conferido às 09:00");
  });
});
