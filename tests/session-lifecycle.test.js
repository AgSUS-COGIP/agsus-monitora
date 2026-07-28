import { describe, expect, it } from "vitest";

import {
  SESSION_IDLE_LIMIT_MS,
  formatSessionRemaining,
  getRemainingSessionMs,
  parseSessionActivityRecord,
} from "../src/lib/session-lifecycle.js";

describe("session lifecycle", () => {
  it("formata o contador de uma hora", () => {
    expect(formatSessionRemaining(SESSION_IDLE_LIMIT_MS)).toBe("01:00:00");
    expect(formatSessionRemaining(10 * 60 * 1000 + 1000)).toBe("00:10:01");
    expect(formatSessionRemaining(0)).toBe("00:00:00");
  });

  it("calcula o tempo restante a partir da última atividade", () => {
    const activityAt = 1_000_000;

    expect(getRemainingSessionMs(activityAt, activityAt)).toBe(
      SESSION_IDLE_LIMIT_MS,
    );
    expect(getRemainingSessionMs(activityAt, activityAt + 30 * 60 * 1000)).toBe(
      30 * 60 * 1000,
    );
    expect(
      getRemainingSessionMs(activityAt, activityAt + SESSION_IDLE_LIMIT_MS),
    ).toBe(0);
  });

  it("não retorna tempo negativo após a expiração", () => {
    expect(getRemainingSessionMs(1000, 1000 + SESSION_IDLE_LIMIT_MS + 1)).toBe(
      0,
    );
  });

  it("interpreta apenas registros compartilhados válidos", () => {
    expect(
      parseSessionActivityRecord(
        JSON.stringify({ userId: "usuario-1", at: 123456 }),
      ),
    ).toEqual({ userId: "usuario-1", at: 123456 });
    expect(parseSessionActivityRecord("conteúdo inválido")).toBeNull();
    expect(
      parseSessionActivityRecord(JSON.stringify({ userId: "", at: 123456 })),
    ).toBeNull();
  });
});
