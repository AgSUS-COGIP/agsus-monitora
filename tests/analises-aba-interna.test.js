import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { semOPainelAntigoDeAnalises } from "../src/lib/pagina-do-painel.js";
import { RESOURCES } from "../src/lib/permissoes-recursos.js";
import { paginasPermitidas, permissaoLegada } from "../src/lib/access-roles.js";
import {
  linhasDosPaineis,
  normalizarPaineis,
} from "../src/lib/paineis-externos-das-configuracoes.js";

/*
  Análises curriculares deixou de ser o painel externo `analises` e virou a
  view `analises`, com permissão só do recurso `analises`; desde a Etapa 4, é
  o módulo React src/modulos/analises/, sem quadro.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const legado = ler("src/modules/legacy-app.js");
const trecho = (inicio, fim) =>
  legado.slice(
    legado.indexOf(inicio),
    legado.indexOf(fim, legado.indexOf(inicio)),
  );

const PAINEIS = [
  { id: "1", codigo: "recrutamento", titulo: "Seleção", url: "https://a" },
  { id: "2", codigo: "analises", titulo: "Analises", url: "/analises.html" },
  { id: "3", codigo: "recursos", titulo: "Recursos", url: "https://b" },
];

describe("a lista de painéis", () => {
  it("o painel antigo sai da lista (banco antes da migration, cópia da sessão)", () => {
    expect(
      semOPainelAntigoDeAnalises(PAINEIS).map((painel) => painel.codigo),
    ).toEqual(["recrutamento", "recursos"]);
    expect(semOPainelAntigoDeAnalises(undefined)).toEqual([]);
  });

  it("Painéis externos da Administração não mostram Análises, e o salvar lê as linhas certas", () => {
    const lista = normalizarPaineis(semOPainelAntigoDeAnalises(PAINEIS));
    expect(lista.map((painel) => painel.titulo)).not.toContain("Analises");
    expect(linhasDosPaineis(lista).map((linha) => linha.id)).toEqual([
      "1",
      "3",
    ]);
  });

  it("o recurso analises se chama Análises curriculares na matriz", () => {
    expect(Object.fromEntries(RESOURCES).analises).toBe(
      "Análises curriculares",
    );
  });
});

describe("o legado trata Análises como página", () => {
  it("a permissão é só o recurso analises", () => {
    // can(), isViewAllowed e buildNav delegam a access-roles.js.
    const perfil = (analises) => ({
      role: "usuario",
      permissoes: { dashboard: "leitor", analises },
    });
    expect(permissaoLegada(perfil("leitor"), "analises")).toBe(true);
    expect(permissaoLegada(perfil("sem_acesso"), "analises")).toBe(false);
    expect(paginasPermitidas(perfil("leitor")).analises).toBe(true);
    expect(paginasPermitidas(perfil("sem_acesso")).analises).toBe(false);
    expect(trecho("function can(perm)", "function isMasterProfile")).toContain(
      "permissaoLegada(profile, perm)",
    );
    expect(
      trecho("function isViewAllowed(view)", "function rememberView"),
    ).toContain("paginasPermitidas(profile)");
    expect(trecho("function buildNav()", "function setActiveNav")).toContain(
      "paginasPermitidas(profile)",
    );
    expect(
      trecho("function navigate(view)", "function subtituloDaArea"),
    ).toMatch(/requestedView === "analises" && !can\("analises"\)/);
  });

  it("navegar abre a tela React (TELAS_REACT → analisesController.render())", () => {
    const telas = trecho("const TELAS_REACT", "function navigate(view)");
    expect(telas).toContain(
      'analises: () => ["Análises curriculares", "", window.analisesController],',
    );
    const navegar = trecho(
      "function navigate(view)",
      "function subtituloDaArea",
    );
    expect(navegar).not.toContain('abrirPaginaDoPainel($("page-analises"))');
    expect(ler("src/main.js")).toContain(
      "window.analisesController = montarAnalises({",
    );
  });

  it("os painéis carregados perdem o antigo de análises", () => {
    expect(
      trecho("async function loadPanels", "function panelAllowed"),
    ).toContain("semOPainelAntigoDeAnalises(data)");
  });

  it("o caminho do painel externo não tem mais caso de área", () => {
    const painel = trecho(
      "function openPanel(code)",
      "function syncDisplayModeButtons",
    );
    expect(painel).not.toMatch(/area/i);
    expect(legado).not.toContain("recarregarPainelNaAreaAtual");
  });

  it("o index.html tem a seção da página, sem quadro", () => {
    expect(ler("index.html")).toContain(
      '<section id="page-analises" class="page"></section>',
    );
  });
});

describe("a migration preserva quem via", () => {
  const migration = ler(
    "supabase/migrations/20260929100000_analises_aba_interna.sql",
  );
  const rollback = ler(
    "supabase/rollback/20260929100000_analises_aba_interna.sql",
  );

  it("arquiva o painel com marca, sem apagar", () => {
    expect(migration).toContain(
      "set ativo = false, tipo_abertura = 'aba_interna'",
    );
    expect(migration).not.toMatch(/\bdelete\b/i);
    expect(migration).toContain(
      "c_manter_quem_nao_via constant boolean := true;",
    );
    expect(migration).toContain("'Análises curriculares viram aba interna'");
  });

  it("o rollback só desfaz o que a migration fez", () => {
    expect(rollback).toContain("h.motivo = c_motivo");
    expect(rollback).toContain("r.revisao = 1");
    expect(rollback).toContain("paineis_antes");
  });
});
