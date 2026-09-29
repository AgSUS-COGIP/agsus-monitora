import { describe, expect, it } from "vitest";
import {
  canManageAccess,
  canMoveEditalBetweenAreas,
  isAdminGlobal,
  paginasPermitidas,
  podeAbrirConfiguracoes,
  secaoDeConfiguracaoPermitida,
} from "../src/lib/access-roles.js";
import {
  abasDeAcessos,
  celulaSoLeitura,
  gruposAtribuiveis,
  nivelMaximo,
  opcoesDoModulo,
  podeEditarUsuario,
  valorDoSelect,
} from "../src/lib/teto-de-acessos.js";

const coordenador = {
  perfil: "coordenador",
  admin_global: false,
  coordenacao: { codigo: "norte", nome: "Norte", area: "saude-indigena" },
  permissoes: {
    dashboard: "leitor",
    nucleo: "editor",
    aprovados: "editor",
    configuracoes: "sem_acesso",
    acessos: "editor",
  },
};
const admin = { perfil: "admin", admin_global: true, permissoes: { configuracoes: "sem_acesso" } };

const tetoDoCoordenador = {
  admin_global: false,
  usuario_id: "eu",
  coordenacao: "norte",
  niveis: { dashboard: "leitor", nucleo: "editor", aprovados: "editor", configuracoes: "sem_acesso", acessos: "sem_acesso" },
  paineis: ["p1"],
};

describe("quem gerencia acessos", () => {
  it("admin global vem do banco; sem o campo, do papel antigo", () => {
    expect(isAdminGlobal(admin)).toBe(true);
    expect(isAdminGlobal({ perfil: "admin" })).toBe(true);
    expect(isAdminGlobal({ perfil: "admin", admin_global: false })).toBe(false);
    expect(isAdminGlobal({ ...admin, ativo: false })).toBe(false);
  });

  it("coordenador gerencia acessos, mas não move edital de área", () => {
    expect(canManageAccess(coordenador)).toBe(true);
    expect(canMoveEditalBetweenAreas(coordenador)).toBe(false);
    expect(canManageAccess({ permissoes: { configuracoes: "admin" } })).toBe(false);
  });

  it("admin sem Configurações ainda abre a página e só a seção Acessos", () => {
    expect(podeAbrirConfiguracoes(admin)).toBe(true);
    expect(secaoDeConfiguracaoPermitida(admin, "acessos")).toBe(true);
    expect(secaoDeConfiguracaoPermitida(admin, "marca")).toBe(false);
  });

  it("editor de Configurações sem Acessos não recebe a seção Acessos vazia", () => {
    const editor = { permissoes: { configuracoes: "editor" } };
    expect(secaoDeConfiguracaoPermitida(editor, "acessos")).toBe(false);
    expect(secaoDeConfiguracaoPermitida(editor, "marca")).toBe(true);
  });

  it("coordenador abre Configurações pela gestão de acessos", () => {
    expect(paginasPermitidas(coordenador)).toMatchObject({ config: true, nucleo: true, dashboard: true });
  });
});

describe("abas de Acessos", () => {
  it("admin vê Usuários, Grupos e Coordenações; coordenador, só Usuários; os demais, nenhuma", () => {
    expect(abasDeAcessos(admin).map((a) => a.id)).toEqual(["usuarios", "grupos", "coordenacoes"]);
    expect(abasDeAcessos(coordenador).map((a) => a.id)).toEqual(["usuarios"]);
    expect(abasDeAcessos({ permissoes: { nucleo: "editor" } })).toEqual([]);
  });
});

describe("teto do coordenador", () => {
  it("não altera a si mesmo, quem é de fora, nem admin global", () => {
    expect(podeEditarUsuario(tetoDoCoordenador, { id: "eu", coordenacao: "norte" }).pode).toBe(false);
    expect(podeEditarUsuario(tetoDoCoordenador, { id: "u2", coordenacao: "sul" }).pode).toBe(false);
    expect(podeEditarUsuario(tetoDoCoordenador, { id: "u3", coordenacao: "norte", admin_global: true }).pode).toBe(false);
    expect(podeEditarUsuario(tetoDoCoordenador, { id: "u4", coordenacao: "norte" }).pode).toBe(true);
  });

  it("o select do módulo começa por 'Do grupo'; nível acima do próprio fica desabilitado", () => {
    const celula = { nivel: "leitor", individual: false, nivelGrupo: "leitor" };
    const opcoes = opcoesDoModulo(tetoDoCoordenador, "dashboard", celula);
    expect(opcoes[0]).toMatchObject({ valor: "", rotulo: "Leitor", desabilitada: false });
    expect(opcoes.filter((o) => o.desabilitada).map((o) => o.valor)).toEqual(["editor", "admin"]);
    expect(valorDoSelect(celula)).toBe("");
  });

  it("o valor individual atual aparece mesmo acima do teto; voltar ao grupo exige que o grupo caiba", () => {
    const celula = { nivel: "admin", individual: true, nivelGrupo: "admin" };
    const opcoes = opcoesDoModulo(tetoDoCoordenador, "nucleo", celula);
    expect(opcoes.find((o) => o.valor === "admin").desabilitada).toBe(false);
    expect(opcoes[0].desabilitada).toBe(true);
    expect(valorDoSelect(celula)).toBe("admin");
  });

  it("Acessos e áreas são só leitura; painel só se ele tem o painel", () => {
    expect(celulaSoLeitura(tetoDoCoordenador, "acessos")).toBe(true);
    expect(celulaSoLeitura(tetoDoCoordenador, "area:sede")).toBe(true);
    expect(nivelMaximo(tetoDoCoordenador, "painel:p1")).toBe("leitor");
    expect(nivelMaximo(tetoDoCoordenador, "painel:p2")).toBe("sem_acesso");
  });

  it("atribui só grupos que cabem no teto e não dão Acessos", () => {
    const grupos = [
      { codigo: "usuario", niveis: { dashboard: "leitor", nucleo: "leitor", acessos: "sem_acesso" } },
      { codigo: "coordenador", niveis: { nucleo: "editor", acessos: "editor" } },
      { codigo: "gestor", niveis: { nucleo: "admin", acessos: "sem_acesso" } },
      { codigo: "admin", admin_global: true, niveis: {} },
    ];
    expect(gruposAtribuiveis(tetoDoCoordenador, grupos).map((g) => g.codigo)).toEqual(["usuario"]);
    expect(gruposAtribuiveis({ admin_global: true }, grupos)).toHaveLength(4);
  });
});
