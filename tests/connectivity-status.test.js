import { describe, expect, it } from "vitest";

import {
  getConnectivityState,
  shouldAutoHideConnectivityNotice,
} from "../src/modules/connectivity-status.js";

describe("connectivity status", () => {
  it("retorna online quando o navegador está conectado", () => {
    expect(getConnectivityState(true)).toBe("online");
  });

  it("retorna offline quando o navegador está desconectado", () => {
    expect(getConnectivityState(false)).toBe("offline");
  });

  it("não oculta um aviso offline por causa de um timer antigo de reconexão", () => {
    expect(shouldAutoHideConnectivityNotice("online", "offline")).toBe(false);
  });

  it("oculta o aviso de reconexão enquanto o estado continua online", () => {
    expect(shouldAutoHideConnectivityNotice("online", "online")).toBe(true);
  });
});
