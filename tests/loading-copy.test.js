import { describe, expect, it } from "vitest";

import {
  getLoadingStage,
  isGenericLoadingCopy,
  normalizeLoadingProgress,
} from "../src/lib/loading-copy.js";

describe("loading copy", () => {
  it("normaliza o progresso dentro dos limites", () => {
    expect(normalizeLoadingProgress("42%")).toBe(42);
    expect(normalizeLoadingProgress(-10)).toBe(0);
    expect(normalizeLoadingProgress(140)).toBe(100);
    expect(normalizeLoadingProgress("inválido")).toBe(0);
  });

  it("reconhece mensagens genéricas sem substituir conteúdo específico", () => {
    expect(isGenericLoadingCopy("Carregando...")).toBe(true);
    expect(isGenericLoadingCopy("Preparando dados…")).toBe(true);
    expect(isGenericLoadingCopy("Validando permissões do seu perfil")).toBe(
      false,
    );
  });

  it("avança as mensagens conforme o progresso", () => {
    const initial = getLoadingStage({ progress: 5 });
    const data = getLoadingStage({ progress: 55 });
    const finish = getLoadingStage({ progress: 95 });

    expect(initial.title).toBe("Preparando o AgSUS Monitora");
    expect(data.title).toBe("Buscando dados atualizados");
    expect(finish.title).toBe("Finalizando o painel");
  });

  it("orienta sobre demora e oferece nova tentativa", () => {
    const delayed = getLoadingStage({ progress: 45, elapsedMs: 12_000 });
    const retry = getLoadingStage({ progress: 45, elapsedMs: 25_000 });

    expect(delayed.delayed).toBe(true);
    expect(delayed.canRetry).toBe(false);
    expect(retry.canRetry).toBe(true);
    expect(retry.delayMessage).toContain("tentar novamente");
  });
});
