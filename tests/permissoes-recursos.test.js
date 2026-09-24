import { describe, it, expect } from "vitest";
import { hasResource, matrixChanges } from "../src/lib/permissoes-recursos.js";
import {
  canManageEditais,
  canChangeCandidateStatus,
  canManageAccess,
  canImportApprovedList,
} from "../src/lib/access-roles.js";

describe("permissões por recurso", () => {
  it("nega módulo omitido, desconhecido e usuário desativado, inclusive admin", () => {
    const p = {
      perfil: "admin",
      permissoes: { nucleo: "leitor", calendario: "invalido" },
    };
    expect(hasResource(p, "dashboard")).toBe(false);
    expect(hasResource(p, "calendario")).toBe(false);
    expect(hasResource({ ...p, ativo: false }, "nucleo")).toBe(false);
    expect(canManageEditais(p)).toBe(false);
  });
  it("concede edição apenas no módulo escolhido sem elevar o perfil global", () => {
    const p = {
      perfil: "usuario",
      permissoes: {
        calendario: "editor",
        aprovados: "leitor",
        importacao: "editor",
      },
    };
    expect(canManageEditais(p)).toBe(true);
    expect(canChangeCandidateStatus(p)).toBe(false);
    expect(canImportApprovedList(p)).toBe(true);
    expect(canManageAccess(p)).toBe(false);
  });
  it("envia somente diferenças com revisão original, incluindo revogação", () => {
    const users = [
      {
        id: "u1",
        permissoes: {
          nucleo: { nivel: "leitor", revisao: 4 },
          calendario: { nivel: "editor", revisao: 2 },
        },
      },
    ];
    expect(
      matrixChanges(
        users,
        new Map([
          ["u1/nucleo", "leitor"],
          ["u1/calendario", "sem_acesso"],
        ]),
      ),
    ).toEqual([
      {
        usuario_id: "u1",
        recurso: "calendario",
        nivel: "sem_acesso",
        revisao: 2,
      },
    ]);
  });
});
