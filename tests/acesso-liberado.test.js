import { describe, expect, it } from "vitest";
import {
  chaveDaDesativacao,
  chaveDoUsuario,
  mensagemDaComemoracao,
  oQuePodeUsar,
  primeiraEntradaDeConvidado,
  tipoDeComemoracao,
} from "../src/lib/acesso-liberado.js";

const AGORA = Date.parse("2026-09-30T15:00:00Z");
const HORA = 60 * 60 * 1000;

describe("que comemoração mostrar", () => {
  it("perfil criado há até 3 dias (pedido aprovado): liberado; mais antigo, não", () => {
    const base = { usuarioId: "u1", agora: AGORA };
    expect(
      tipoDeComemoracao({
        ...base,
        contaCriadaEm: new Date(AGORA - 200 * HORA),
        perfilCriadoEm: new Date(AGORA - 5 * HORA),
      }),
    ).toBe("liberado");
    expect(
      tipoDeComemoracao({
        ...base,
        contaCriadaEm: new Date(AGORA - 200 * HORA),
        perfilCriadoEm: new Date(AGORA - 80 * HORA),
      }),
    ).toBeNull();
  });

  it("depois de 'Entrar agora': liberado, uma vez por pessoa", () => {
    expect(tipoDeComemoracao({ usuarioId: "u1", pedidoLiberado: true })).toBe(
      "liberado",
    );
    expect(
      tipoDeComemoracao({
        usuarioId: "u1",
        pedidoLiberado: true,
        jaComemorou: true,
      }),
    ).toBeNull();
    expect(
      tipoDeComemoracao({ usuarioId: "", pedidoLiberado: true }),
    ).toBeNull();
  });

  it("primeira entrada de convidado: conta Google nova e perfil anterior a ela", () => {
    const convidado = {
      usuarioId: "u1",
      contaCriadaEm: new Date(AGORA - HORA).toISOString(),
      perfilCriadoEm: new Date(AGORA - 30 * HORA).toISOString(),
      agora: AGORA,
    };
    expect(tipoDeComemoracao(convidado)).toBe("liberado");
    expect(tipoDeComemoracao({ ...convidado, jaComemorou: true })).toBeNull();
  });

  it("não comemora conta antiga, perfil criado depois da conta, nem sem datas", () => {
    expect(
      primeiraEntradaDeConvidado({
        contaCriadaEm: new Date(AGORA - 48 * HORA),
        perfilCriadoEm: new Date(AGORA - 72 * HORA),
        agora: AGORA,
      }),
    ).toBe(false);
    // Perfil criado depois da conta (pedido aprovado, acesso básico): não é convite.
    expect(
      primeiraEntradaDeConvidado({
        contaCriadaEm: new Date(AGORA - 2 * HORA),
        perfilCriadoEm: new Date(AGORA - HORA),
        agora: AGORA,
      }),
    ).toBe(false);
    expect(tipoDeComemoracao({ usuarioId: "u1" })).toBeNull();
  });

  it("quem viu a tela de desativado e voltou: reativado (mesmo já tendo comemorado antes)", () => {
    expect(
      tipoDeComemoracao({
        usuarioId: "u1",
        estavaDesativada: true,
        jaComemorou: true,
      }),
    ).toBe("reativado");
    expect(chaveDaDesativacao("u1")).not.toBe(chaveDoUsuario("u1"));
  });

  it("frases com o primeiro nome", () => {
    expect(mensagemDaComemoracao("liberado", "ANA LUÍSA costa")).toBe(
      "Parabéns, Ana! Seu acesso ao MONITORA foi liberado.",
    );
    expect(
      mensagemDaComemoracao("reativado", "", "joao.silva@agenciasus.org.br"),
    ).toBe("Bem-vindo(a) de volta, Joao! Seu acesso foi reativado.");
    expect(mensagemDaComemoracao("liberado", "", "")).toBe(
      "Parabéns! Seu acesso ao MONITORA foi liberado.",
    );
  });
});

describe("o que a pessoa pode usar agora", () => {
  it("áreas da pessoa com os módulos que têm nível, com os nomes do menu", () => {
    expect(
      oQuePodeUsar({
        areas: ["saude-indigena"],
        permissoes: {
          dashboard: "leitor",
          analises: "leitor",
          nucleo: "editor",
          calendario: "sem_acesso",
          acessos: "sem_acesso",
        },
      }),
    ).toEqual(["Saúde Indígena: Visão geral, Análises curriculares, Editais"]);
  });

  it("administrador global: todas as áreas; sem nenhum módulo, lista vazia", () => {
    const linhas = oQuePodeUsar({ admin_global: true });
    expect(linhas.length).toBeGreaterThan(1);
    expect(linhas[0]).toMatch(/^Saúde Indígena: Visão geral, /);
    expect(linhas[0]).toContain("Gestão de acessos");
    expect(
      oQuePodeUsar({ areas: ["sede"], permissoes: { nucleo: "sem_acesso" } }),
    ).toEqual([]);
    expect(oQuePodeUsar(null)).toEqual([]);
  });
});
