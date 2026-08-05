import { describe, expect, it } from "vitest";

import { getConnectivityState } from "../src/modules/connectivity-status.js";

describe("connectivity status", () => {
  it("retorna online quando o navegador está conectado", () => {
    expect(getConnectivityState(true)).toBe("online");
  });

  it("retorna offline quando o navegador está desconectado", () => {
    expect(getConnectivityState(false)).toBe("offline");
  });
});
