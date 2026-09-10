import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const app = readFileSync("src/analises/analises-app.js", "utf8");

/*
  "Mais opções" só aparecia depois de Ocultar → Mostrar.

  O estado do painel tinha dois donos. `analises-app.js` ligava o próprio
  `advancedBtn.onclick` e o próprio `bindFiltersVisibilityToggle()`, que abria os
  filtros; `analises-filter-layout.js` intercepta os mesmos botões em captura com
  `stopImmediatePropagation` e arrancava recolhido. Como o layout corre primeiro
  e o app depois, sobrava um estado que nenhum dos dois descreve:

    filtersBody.hidden = false   (ganhou o app: o corpo abriu)
    advancedBtn.hidden = true    (ganhou o layout: o botão ficou escondido)
    .filter-panel.is-collapsed   (posto pelo layout, nunca retirado pelo app)

  Medido no preview em 10/09/2026, antes da correção. Ocultar → Mostrar
  devolvia a coerência porque aí só o layout escrevia — e era por isso que o
  botão aparecia.

  Agora o dono é um só, e ele arranca aberto.
*/

const MARCACAO = `
  <section class="panel filter-panel">
    <div class="filter-head">
      <div>
        <span class="eyebrow">Filtros base</span>
        <h2 class="title">Refinar visualização</h2>
        <p class="hint">Texto original.</p>
      </div>
      <div class="filter-actions">
        <button class="btn secondary" id="advancedBtn">
          <i class="fa-solid fa-sliders"></i> Mais filtros
        </button>
        <button class="btn secondary" id="toggleFiltersBtn" aria-expanded="true">
          <i class="fa-solid fa-eye-slash"></i>
          <span class="toggle-label">Ocultar filtros</span>
        </button>
        <button class="btn secondary" id="clearBtn">Limpar</button>
      </div>
    </div>
    <div id="filtersBody" class="filters-body">
      <div class="filter-grid">
        <div class="field">
          <label for="fSituacaoEdital">Situação</label>
          <select id="fSituacaoEdital"><option value="ativo" selected>Ativos</option></select>
        </div>
      </div>
      <div id="advancedFilters" class="advanced filter-grid">
        <div class="field">
          <label for="fCategoria">Categoria</label>
          <select id="fCategoria"><option value="">Todas</option></select>
        </div>
      </div>
    </div>
  </section>`;

const q = (id) => document.getElementById(id);
const painel = () => document.querySelector(".filter-panel");
const esperar = () => new Promise((resolve) => setTimeout(resolve, 0));

async function montar() {
  document.head.innerHTML = "";
  document.body.innerHTML = MARCACAO;
  vi.resetModules();
  await import("../../src/analises/analises-filter-layout.js");
  await esperar();
}

async function clicar(id) {
  q(id).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await esperar();
}

describe("o painel de filtros tem um dono só", () => {
  it("analises-app.js não escreve mais nesse estado", () => {
    expect(app).not.toContain("bindFiltersVisibilityToggle");
    expect(app).not.toMatch(/\$\("advancedBtn"\)\.onclick/);
    expect(app).not.toMatch(/\$\("filtersBody"\)\.hidden\s*=/);
  });

  /*
    Por que um segundo dono é risco silencioso, e não apenas redundância: o
    layout intercepta em captura no documento e chama `stopImmediatePropagation`,
    então o `onclick` que `analises-app.js` punha no próprio botão nunca corria.
    Ninguém via erro — via um painel incoerente. Este teste põe um segundo dono
    de propósito e mostra que ele morre calado.
  */
  it("um segundo dono no botão morre sem dar sinal", async () => {
    await montar();
    let segundoDono = 0;
    q("advancedBtn").onclick = () => {
      segundoDono += 1;
    };

    await clicar("advancedBtn");

    expect(segundoDono).toBe(0);
    expect(q("advancedFilters").classList.contains("show")).toBe(true);
  });
});

describe("o estado de carregamento", () => {
  beforeEach(montar);

  it("abre com os filtros principais à vista", () => {
    expect(q("filtersBody").hidden).toBe(false);
    expect(painel().classList.contains("is-collapsed")).toBe(false);
    expect(q("toggleFiltersBtn").textContent).toContain("Ocultar filtros");
  });

  it("abre com Mais opções à vista", () => {
    expect(q("advancedBtn").hidden).toBe(false);
    expect(q("advancedBtn").textContent).toContain("Mais opções");
    expect(q("advancedBtn").getAttribute("aria-expanded")).toBe("false");
  });

  it("abre com os filtros avançados fechados", () => {
    expect(q("advancedFilters").classList.contains("show")).toBe(false);
  });

  /*
    O defeito em uma linha: as três propriedades do mesmo estado tinham de
    concordar entre si, e não concordavam.
  */
  it("as três propriedades do estado concordam", () => {
    const recolhido = q("filtersBody").hidden;
    expect(q("advancedBtn").hidden).toBe(recolhido);
    expect(painel().classList.contains("is-collapsed")).toBe(recolhido);
  });
});

describe("os controles depois do carregamento", () => {
  beforeEach(montar);

  it("Mais opções funciona no primeiro clique, sem Ocultar → Mostrar", async () => {
    await clicar("advancedBtn");
    expect(q("advancedFilters").classList.contains("show")).toBe(true);
    expect(q("advancedBtn").textContent).toContain("Menos opções");

    await clicar("advancedBtn");
    expect(q("advancedFilters").classList.contains("show")).toBe(false);
    expect(q("advancedBtn").textContent).toContain("Mais opções");
  });

  it("Ocultar esconde o corpo e o botão juntos", async () => {
    await clicar("toggleFiltersBtn");
    expect(q("filtersBody").hidden).toBe(true);
    expect(q("advancedBtn").hidden).toBe(true);
    expect(painel().classList.contains("is-collapsed")).toBe(true);
  });

  it("Mostrar devolve o mesmo estado do carregamento", async () => {
    await clicar("toggleFiltersBtn");
    await clicar("toggleFiltersBtn");
    expect(q("filtersBody").hidden).toBe(false);
    expect(q("advancedBtn").hidden).toBe(false);
    expect(q("advancedFilters").classList.contains("show")).toBe(false);
    expect(painel().classList.contains("is-collapsed")).toBe(false);
  });

  /*
    Recolher com os avançados abertos não pode deixá-los abertos por baixo: ao
    mostrar de novo, o rótulo diria "Mais opções" com o bloco já aberto.
  */
  it("recolher fecha os avançados que estavam abertos", async () => {
    await clicar("advancedBtn");
    await clicar("toggleFiltersBtn");
    await clicar("toggleFiltersBtn");
    expect(q("advancedFilters").classList.contains("show")).toBe(false);
    expect(q("advancedBtn").textContent).toContain("Mais opções");
  });
});
