import { describe, expect, it } from "vitest";
import {
  capacidadesDoPerfil,
  menuDoContexto,
  resumoDoEscopo,
} from "../src/lib/ver-como.js";
import {
  paginasPermitidas,
  paineisPermitidos,
  secaoDeConfiguracaoPermitida,
} from "../src/lib/access-roles.js";
import { areasDoUsuario, montarArvoreDoMenu } from "../src/lib/menu-lateral.js";
import {
  mensagemDoStatus,
  argumentosDaSolicitacao,
  formularioTravado,
} from "../src/lib/solicitacao-de-acesso.js";

const SECOES = [
  { id: "marca", rotulo: "Marca" },
  { id: "acessos", rotulo: "Acessos" },
];
const paineis = [{ id: "p1", codigo: "painel-a", titulo: "Painel A", ordem: 1 }];

const contexto = {
  profile: {
    id: "u1",
    perfil: "coordenador",
    admin_global: false,
    areas: ["saude-indigena"],
    coordenacao: { codigo: "norte", nome: "Norte", area: "saude-indigena" },
    permissoes: { dashboard: "leitor", nucleo: "editor", calendario: "leitor", paineis: "leitor", acessos: "editor" },
  },
  panel_ids: ["p1"],
  escopo: { editais_da_area: 40, editais_visiveis: 12, recortado: true },
};

describe("ver como usuário", () => {
  it("o menu é o mesmo que a barra lateral montaria para a pessoa", () => {
    const perfil = { ...contexto.profile, ativo: true };
    const esperado = montarArvoreDoMenu({
      permitidas: paginasPermitidas(perfil),
      paineis: paineisPermitidos(perfil, paineis, ["p1"]),
      secoesDeConfiguracao: SECOES.filter((s) => secaoDeConfiguracaoPermitida(perfil, s.id)),
      areas: areasDoUsuario(perfil.areas),
    });
    const menu = menuDoContexto(contexto, { paineis, secoesDeConfiguracao: SECOES });
    expect(menu).toEqual(esperado);
    const secoes = menu.flatMap((g) => g.itens).filter((i) => i.view === "config").map((i) => i.secao);
    expect(secoes).toEqual(["acessos"]);
  });

  it("escopo e capacidades em frases", () => {
    expect(resumoDoEscopo(contexto)).toBe("Coordenação Norte — vê 12 de 40 editais da área.");
    expect(capacidadesDoPerfil(contexto.profile)).toContain("Gerencia acessos");
    expect(resumoDoEscopo({ profile: { id: "a", admin_global: true } })).toMatch(/todas as áreas/);
  });
});

describe("solicitação de acesso", () => {
  it("status cita a coordenação e trava com pendente ou aprovada", () => {
    expect(mensagemDoStatus({ status: "pendente", coordenacao_nome: "Norte" }).text).toMatch(/Norte/);
    expect(formularioTravado({ status: "pendente" })).toBe(true);
    expect(formularioTravado({ status: "recusado" })).toBe(false);
    expect(mensagemDoStatus(null)).toBeNull();
  });

  it("argumentos vazios viram null", () => {
    expect(argumentosDaSolicitacao({ nome: " Ana ", setor: "", justificativa: "x", coordenacao: "" })).toEqual({
      p_nome: "Ana",
      p_setor: null,
      p_justificativa: "x",
      p_coordenacao: null,
    });
  });
});
