import { describe, expect, it } from "vitest";
import {
  ACCESS_ROLES,
  podeEditarCoordenadas,
  roleLabel,
} from "../src/lib/access-roles.js";

/*
  O perfil edital_gestor aparece como "Gestor" (o código não muda) e corrige
  coordenadas nos dois mapas, como o administrador global
  (private."FC_PODE_EDITAR_COORDENADA", 20261002200000).
*/
describe('perfil "Gestor"', () => {
  it("o rótulo é Gestor e o valor interno continua edital_gestor", () => {
    expect(ACCESS_ROLES.find((r) => r.value === "edital_gestor").label).toBe(
      "Gestor",
    );
    expect(ACCESS_ROLES.map((r) => r.label)).not.toContain("Edital gestor");
    expect(roleLabel({ perfil: "edital_gestor" })).toBe("Gestor");
    // O nome do grupo vindo do banco continua mandando.
    expect(
      roleLabel({ perfil: "edital_gestor", grupo: { nome: "Gestor" } }),
    ).toBe("Gestor");
  });
});

describe("podeEditarCoordenadas", () => {
  it("administrador global e Gestor ativo podem", () => {
    expect(
      podeEditarCoordenadas({
        ativo: true,
        perfil: "admin",
        admin_global: true,
      }),
    ).toBe(true);
    expect(podeEditarCoordenadas({ ativo: true, perfil: "admin" })).toBe(true);
    expect(
      podeEditarCoordenadas({ ativo: true, perfil: "edital_gestor" }),
    ).toBe(true);
    expect(
      podeEditarCoordenadas({
        ativo: true,
        perfil: "edital_gestor",
        admin_global: false,
        permissoes: { nucleo: "editor" },
      }),
    ).toBe(true);
  });

  it("usuário, leitor, contratador, coordenador, inativo e sem perfil não podem", () => {
    for (const perfil of ["usuario", "leitor", "contratador", "coordenador"])
      expect(podeEditarCoordenadas({ ativo: true, perfil }), perfil).toBe(
        false,
      );
    expect(
      podeEditarCoordenadas({ ativo: false, perfil: "edital_gestor" }),
    ).toBe(false);
    expect(
      podeEditarCoordenadas({ perfil: "admin", admin_global: false }),
    ).toBe(false);
    expect(podeEditarCoordenadas(null)).toBe(false);
    expect(podeEditarCoordenadas({})).toBe(false);
  });
});
