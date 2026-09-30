import { describe, expect, it } from "vitest";
import { gerenciariaAcessosSemCoordenacao } from "../src/lib/matriz-de-acessos.js";
import { canManageAccess, roleLabel } from "../src/lib/access-roles.js";

/*
  30/09: uma conta ficou em Coordenador sem coordenação; o menu mostrava
  Acessos e o banco recusava (42501). A tela e o banco passam a exigir a
  coordenação de quem gerencia acessos sem ser administrador global.
*/
describe("coordenador exige coordenação", () => {
  it("gerenciar acessos sem coordenação e sem ser admin global é bloqueado", () => {
    expect(
      gerenciariaAcessosSemCoordenacao({
        adminGlobal: false,
        coordenacao: null,
        nivelAcessos: "editor",
      }),
    ).toBe(true);
    expect(
      gerenciariaAcessosSemCoordenacao({
        adminGlobal: false,
        coordenacao: "norte",
        nivelAcessos: "editor",
      }),
    ).toBe(false);
    expect(
      gerenciariaAcessosSemCoordenacao({
        adminGlobal: true,
        coordenacao: null,
        nivelAcessos: "admin",
      }),
    ).toBe(false);
    expect(
      gerenciariaAcessosSemCoordenacao({
        adminGlobal: false,
        coordenacao: null,
        nivelAcessos: "sem_acesso",
      }),
    ).toBe(false);
  });

  it("o menu só oferece Acessos ao coordenador que tem coordenação", () => {
    const base = { perfil: "coordenador", permissoes: { acessos: "editor" } };
    expect(canManageAccess({ ...base, coordenacao: null })).toBe(false);
    expect(canManageAccess({ ...base, coordenacao: { codigo: "norte" } })).toBe(
      true,
    );
  });

  it("o rótulo do perfil mostra o grupo de verdade", () => {
    expect(
      roleLabel({
        perfil: "coordenador",
        grupo: { codigo: "coordenador", nome: "Coordenador" },
      }),
    ).toBe("Coordenador");
  });
});
