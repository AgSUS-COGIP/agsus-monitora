// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import {
  AREAS,
  AREA_PADRAO,
  areaDoPainel,
  grupoAberto,
  grupoDaView,
  montarGruposDaNavegacao,
} from "../src/lib/areas-da-navegacao.js";
import {
  CHAVE_DOS_GRUPOS,
  abrirGrupoDaView,
  htmlDaNavegacaoPorAreas,
  instalarNavegacaoPorAreas,
  lerEstadoDosGrupos,
} from "../src/modules/navegacao-por-areas.js";

const migration = readFileSync(
  "supabase/migrations/20260924150000_area_do_painel_externo.sql",
  "utf8",
);

const painel = (codigo, area, ordem = 0) => ({
  codigo,
  titulo: codigo.toUpperCase(),
  area,
  ordem,
});

describe("área do painel", () => {
  it("o check do banco aceita exatamente as áreas do frontend", () => {
    const noBanco = migration
      .match(/check \(area in \(([^)]+)\)\)/)[1]
      .split(",")
      .map((s) => s.trim().replaceAll("'", ""));
    expect(noBanco).toEqual(AREAS.map((a) => a.id));
  });

  it("painel sem área, ou com área desconhecida, cai na Saúde Indígena", () => {
    expect(areaDoPainel({})).toBe(AREA_PADRAO);
    expect(areaDoPainel({ area: "financeiro" })).toBe(AREA_PADRAO);
    expect(areaDoPainel({ area: " SEDE " })).toBe("sede");
  });
});

describe("grupos da barra lateral", () => {
  const dashboard = { view: "dashboard", rotulo: "Saúde Indígena" };
  const editais = { view: "nucleo", rotulo: "Editais" };
  const config = { view: "config", rotulo: "Configurações" };

  it("ficam na ordem das áreas, depois Processos Seletivos e Administração", () => {
    const grupos = montarGruposDaNavegacao({
      itensDaArea: { saude_indigena: [dashboard] },
      paineis: [painel("proj", "projetos"), painel("sede", "sede")],
      selecao: [editais],
      administracao: [config],
    });
    expect(grupos.map((g) => g.id)).toEqual([
      "saude_indigena",
      "sede",
      "projetos",
      "selecao",
      "administracao",
    ]);
  });

  it("grupo sem item não aparece", () => {
    const grupos = montarGruposDaNavegacao({ selecao: [editais] });
    expect(grupos.map((g) => g.id)).toEqual(["selecao"]);
  });

  it("painéis entram depois dos itens internos, ordenados por `ordem`", () => {
    const [saude] = montarGruposDaNavegacao({
      itensDaArea: { saude_indigena: [dashboard] },
      paineis: [painel("b", null, 2), painel("a", undefined, 1)],
    });
    expect(saude.itens.map((i) => i.view)).toEqual([
      "dashboard",
      "panel:a",
      "panel:b",
    ]);
  });

  it("o grupo da tela atual fica aberto mesmo que a pessoa o tenha fechado", () => {
    const grupo = { id: "selecao", itens: [editais] };
    const estadoSalvo = { selecao: false };
    expect(grupoAberto(grupo, { estadoSalvo })).toBe(false);
    expect(grupoAberto(grupo, { estadoSalvo, viewAtiva: "nucleo" })).toBe(true);
    expect(grupoAberto(grupo)).toBe(true);
  });

  it("acha o grupo de uma tela", () => {
    const grupos = montarGruposDaNavegacao({
      selecao: [editais],
      administracao: [config],
    });
    expect(grupoDaView(grupos, "config")?.id).toBe("administracao");
    expect(grupoDaView(grupos, "inexistente")).toBeNull();
  });
});

describe("grupos recolhíveis no DOM", () => {
  const botao = (view, rotulo) =>
    `<button data-view="${view}"><span class="nav-text">${rotulo}</span></button>`;

  beforeEach(() => {
    localStorage.clear();
    const grupos = montarGruposDaNavegacao({
      selecao: [{ view: "nucleo", rotulo: "Editais" }],
      administracao: [{ view: "config", rotulo: "Configurações" }],
    });
    document.body.innerHTML = `<nav id="nav">${htmlDaNavegacaoPorAreas(grupos, {
      botao,
      estadoSalvo: { administracao: false },
    })}</nav>`;
    instalarNavegacaoPorAreas(document, localStorage);
  });

  const secao = (id) => document.querySelector(`[data-nav-grupo="${id}"]`);

  it("cabeçalho é um botão com aria-expanded e aria-controls", () => {
    const alternar = secao("selecao").querySelector(".nav-grupo__alternar");
    expect(alternar.getAttribute("aria-expanded")).toBe("true");
    expect(
      document.getElementById(alternar.getAttribute("aria-controls")),
    ).not.toBeNull();
    expect(secao("administracao").dataset.aberto).toBe("false");
  });

  it("clicar alterna e lembra a escolha", () => {
    secao("selecao").querySelector(".nav-grupo__alternar").click();
    expect(secao("selecao").dataset.aberto).toBe("false");
    expect(JSON.parse(localStorage.getItem(CHAVE_DOS_GRUPOS))).toEqual({
      selecao: false,
    });
    expect(lerEstadoDosGrupos(localStorage)).toEqual({ selecao: false });
  });

  it("navegar para uma tela abre o grupo dela sem gravar", () => {
    abrirGrupoDaView(document, "config");
    expect(secao("administracao").dataset.aberto).toBe("true");
    expect(localStorage.getItem(CHAVE_DOS_GRUPOS)).toBeNull();
  });

  it("título do grupo é escapado", () => {
    const html = htmlDaNavegacaoPorAreas(
      [{ id: "x", titulo: "<img src=x>", itens: [] }],
      { botao },
    );
    expect(html).not.toContain("<img");
  });

  it("estado salvo corrompido vira objeto vazio", () => {
    localStorage.setItem(CHAVE_DOS_GRUPOS, "{quebrado");
    expect(lerEstadoDosGrupos(localStorage)).toEqual({});
  });
});
