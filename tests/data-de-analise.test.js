import { describe, expect, it } from "vitest";
import { dataDeAnaliseNoFuturo } from "../src/lib/data-de-analise.js";

describe("data de análise no futuro", () => {
  const agora = new Date(2026, 8, 28, 23, 50); // 28/09/2026, 23:50

  it("amanhã é futuro; hoje e ontem não", () => {
    expect(dataDeAnaliseNoFuturo(new Date(2026, 8, 29), agora)).toBe(true);
    expect(dataDeAnaliseNoFuturo(new Date(2026, 8, 28), agora)).toBe(false);
    expect(dataDeAnaliseNoFuturo(new Date(2026, 8, 27), agora)).toBe(false);
  });

  it("a hora não conta: hoje às 23:59 continua sendo hoje", () => {
    expect(
      dataDeAnaliseNoFuturo(
        new Date(2026, 8, 28, 23, 59),
        new Date(2026, 8, 28, 0, 1),
      ),
    ).toBe(false);
  });

  it("sem data válida não é futuro", () => {
    expect(dataDeAnaliseNoFuturo(null, agora)).toBe(false);
    expect(dataDeAnaliseNoFuturo(new Date("x"), agora)).toBe(false);
  });
});
