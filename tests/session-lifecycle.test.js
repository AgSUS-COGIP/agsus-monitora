import { describe, expect, it, vi } from "vitest";

import {
  SESSION_IDLE_LIMIT_MS,
  dismissSessionNotice,
  formatSessionRemaining,
  getRemainingSessionMs,
  parseSessionActivityRecord,
} from "../src/lib/session-lifecycle";

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

  it("oculta aviso de sessão obsoleto após nova atividade", () => {
    const notice = document.createElement("div");
    notice.id = "agsusSessionNotice";
    notice.hidden = false;
    notice.dataset.level = "critical";
    document.body.appendChild(notice);

    expect(dismissSessionNotice()).toBe(true);
    expect(notice.hidden).toBe(true);

    notice.remove();
  });

  it("monta o contador pelo DOM, sem innerHTML", async () => {
    vi.resetModules();
    vi.doMock("../src/lib/supabaseClient", () => ({
      getSupabaseClient: () => null,
    }));
    const definir = vi.spyOn(Element.prototype, "innerHTML", "set");
    try {
      const { installSessionLifecycle } =
        await import("../src/lib/session-lifecycle");
      installSessionLifecycle();

      const timer = document.getElementById("agsusSessionTimer");
      expect(timer).not.toBeNull();
      expect(timer.getAttribute("role")).toBe("timer");
      const [icone, texto] = timer.children;
      expect(timer.children).toHaveLength(2);
      expect(icone.getAttribute("aria-hidden")).toBe("true");
      expect(icone.textContent).toBe("⏱");
      expect(texto.id).toBe("agsusSessionTimerText");
      expect(texto.textContent).toBe("");
      expect(definir).not.toHaveBeenCalled();
    } finally {
      definir.mockRestore();
      vi.doUnmock("../src/lib/supabaseClient");
    }
  });
});
