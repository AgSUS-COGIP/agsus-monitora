import { describe, expect, it } from "vitest";
import {
  capacidadesDoPerfil,
  contextoDepoisDeSalvar,
  menuDoContexto,
  resumoDoEscopo,
} from "../src/lib/ver-como.js";
import {
  paginasPermitidas,
  paineisPermitidos,
  secaoDeConfiguracaoPermitida,
} from "../src/lib/access-roles.js";
import { areasDoUsuario, montarArvoreDoMenu } from "../src/lib/menu-lateral.js";
import { registrarNoRascunho } from "../src/lib/matriz-de-acessos.js";

const SECOES = [
  { id: "marca", rotulo: "Marca" },
  { id: "acessos", rotulo: "Acessos" },
];
const paineis = [
  { id: "p1", codigo: "painel-a", titulo: "Painel A", ordem: 1 },
];

const contexto = {
  profile: {
    id: "u1",
    perfil: "coordenador",
    admin_global: false,
    areas: ["saude-indigena"],
    coordenacao: { codigo: "norte", nome: "Norte", area: "saude-indigena" },
    permissoes: {
      dashboard: "leitor",
      nucleo: "editor",
      calendario: "leitor",
      paineis: "leitor",
      acessos: "editor",
    },
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
      secoesDeConfiguracao: SECOES.filter((s) =>
        secaoDeConfiguracaoPermitida(perfil, s.id),
      ),
      areas: areasDoUsuario(perfil.areas),
    });
    const menu = menuDoContexto(contexto, {
      paineis,
      secoesDeConfiguracao: SECOES,
    });
    expect(menu).toEqual(esperado);
    const secoes = menu
      .flatMap((g) => g.itens)
      .filter((i) => i.view === "config")
      .map((i) => i.secao);
    expect(secoes).toEqual(["acessos"]);
  });

  it("escopo e capacidades em frases", () => {
    expect(resumoDoEscopo(contexto)).toBe(
      "Coordenação Norte — vê 12 de 40 editais da área.",
    );
    expect(capacidadesDoPerfil(contexto.profile)).toContain("Gerencia acessos");
    expect(
      resumoDoEscopo({ profile: { id: "a", admin_global: true } }),
    ).toMatch(/todas as áreas/);
  });
});

/*
  "Como a pessoa vê" na gaveta reflete o RASCUNHO ("Depois de salvar"): em
  30/09 a gaveta dizia "Administrador global" com o grupo já trocado para
  Usuário no rascunho.
*/
describe("como a pessoa vê depois de salvar", () => {
  const GRUPOS = [
    {
      codigo: "usuario",
      nome: "Usuário",
      niveis: { dashboard: "leitor", nucleo: "leitor", acessos: "sem_acesso" },
    },
    {
      codigo: "admin",
      nome: "Administrador global",
      admin_global: true,
      niveis: {},
    },
  ];
  const AREAS = [
    { id: "saude-indigena", titulo: "Saúde Indígena" },
    { id: "sede", titulo: "SEDE" },
  ];
  const ADMIN = {
    id: "u9",
    nome: "Bia",
    email: "bia@agenciasus.org.br",
    grupo: "admin",
    admin_global: true,
    coordenacao: null,
    revisao_conta: "t9",
    permissoes: {},
  };
  const salvo = {
    profile: {
      id: "u9",
      perfil: "admin",
      admin_global: true,
      areas: ["saude-indigena", "sede"],
      permissoes: { dashboard: "admin", nucleo: "admin", acessos: "editor" },
    },
    panel_ids: [],
    escopo: { editais_da_area: 10, editais_visiveis: 10 },
  };
  const matriz = {
    grupos: GRUPOS,
    areas: AREAS,
    coordenacoes: [],
    paineis: [],
  };

  it("sem pendência, é o contexto salvo", () => {
    expect(contextoDepoisDeSalvar(salvo, ADMIN, new Map(), matriz)).toBe(salvo);
  });

  it("admin que vai para Usuário com uma área: deixa de ser admin e perde a gestão", () => {
    let rascunho = registrarNoRascunho(new Map(), ADMIN, "#grupo", "usuario");
    rascunho = registrarNoRascunho(rascunho, ADMIN, "area:sede", "leitor");
    const depois = contextoDepoisDeSalvar(salvo, ADMIN, rascunho, matriz);
    expect(depois.profile).toMatchObject({
      perfil: "usuario",
      admin_global: false,
      areas: ["sede"],
      coordenacao: null,
      grupo: { codigo: "usuario", nome: "Usuário" },
    });
    expect(depois.profile.permissoes).toMatchObject({
      dashboard: "leitor",
      nucleo: "leitor",
      acessos: "sem_acesso",
    });
    expect(
      resumoDoEscopo(depois, new Map(AREAS.map((a) => [a.id, a.titulo]))),
    ).toBe("Áreas: SEDE.");
    expect(capacidadesDoPerfil(depois.profile)).not.toContain(
      "Gerencia acessos",
    );
    // O salvo não muda.
    expect(salvo.profile.admin_global).toBe(true);
  });
});
