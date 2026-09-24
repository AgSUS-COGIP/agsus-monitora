// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DURACAO_MS,
  mostrarNotificacao,
  normalizarTipo,
} from "../src/modules/notificacao.js";

describe("notificação", () => {
  let caixa;
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="toastBox" aria-live="polite"></div>';
    caixa = document.getElementById("toastBox");
  });
  afterEach(() => vi.useRealTimers());

  it("mostra ícone do tipo, texto escapado e botão de fechar com rótulo", () => {
    const el = mostrarNotificacao(caixa, "<b>oi</b>", "warn");
    expect(el.className).toBe("toast warn");
    expect(el.querySelector(".fa-triangle-exclamation")).not.toBeNull();
    expect(el.querySelector(".toast-texto").innerHTML).toBe(
      "&lt;b&gt;oi&lt;/b&gt;",
    );
    expect(el.querySelector(".toast-fechar").getAttribute("aria-label")).toBe(
      "Fechar notificação",
    );
  });

  it("só o erro interrompe o leitor de tela", () => {
    expect(mostrarNotificacao(caixa, "x", "error").getAttribute("role")).toBe(
      "alert",
    );
    expect(mostrarNotificacao(caixa, "x", "ok").hasAttribute("role")).toBe(
      false,
    );
  });

  it("tipo desconhecido vira sucesso", () => {
    expect(normalizarTipo("qualquer")).toBe("ok");
  });

  it("some sozinha depois do tempo, e fecha pelo botão", () => {
    mostrarNotificacao(caixa, "a");
    vi.advanceTimersByTime(DURACAO_MS + 300);
    expect(caixa.children).toHaveLength(0);

    const el = mostrarNotificacao(caixa, "b");
    el.querySelector(".toast-fechar").click();
    vi.advanceTimersByTime(300);
    expect(caixa.children).toHaveLength(0);
  });

  it("parada sob o mouse não some", () => {
    const el = mostrarNotificacao(caixa, "c");
    el.dispatchEvent(new Event("mouseenter"));
    vi.advanceTimersByTime(DURACAO_MS * 2);
    expect(el.isConnected).toBe(true);
    el.dispatchEvent(new Event("mouseleave"));
    vi.advanceTimersByTime(DURACAO_MS + 300); // + animação de saída
    expect(el.isConnected).toBe(false);
  });
});
