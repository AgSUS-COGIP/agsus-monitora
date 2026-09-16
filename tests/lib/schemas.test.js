import { describe, expect, it } from "vitest";
import { parseAccessRequest, parsePanelList } from "../../src/lib/schemas.js";

describe("schemas", () => {
  it("valida solicitacao de acesso", () => {
    const parsed = parseAccessRequest({
      nome: "Usuario Teste",
      email: "usuario@agenciasus.org.br",
    });
    expect(parsed.status).toBe("pendente");
    expect(parsed.perfil_solicitado).toBe("usuario");
  });

  it("normaliza lista de paineis", () => {
    const parsed = parsePanelList([{ id: "painel-1", titulo: "Painel" }]);
    expect(parsed[0].ativo).toBe(true);
  });
});
