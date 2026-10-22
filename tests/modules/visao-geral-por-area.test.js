import { readFileSync } from "node:fs";
import { fonteDoApp } from "../fonte-do-app.js";
import { describe, expect, it } from "vitest";

/*
  Saúde Indígena, SEDE e Projetos abrem a mesma Visão geral (#page-dashboard,
  React em src/modulos/visao-geral/). O mapa é da área e é React: o da Saúde
  Indígena em src/modulos/mapa-saude-indigena/, o de Projetos em
  src/modulos/mapa-de-projetos/ (o componente é testado em
  tests/modulos/mapa-de-projetos.test.js), e a SEDE não tem. Aqui, o que o
  legado ainda faz por área e o que saiu dele.
*/

const indexHtml = readFileSync("index.html", "utf8");
const legado = fonteDoApp();

describe("a Visão geral não tem mapa legado", () => {
  it("o index.html não tem o bloco do mapa nem a reserva", () => {
    for (const id of [
      "mapaDaVisaoGeral",
      "reservaDoMapaDaVisaoGeral",
      "mapaDosProjetos",
      "mapaDosProjetosBrasil",
      "brasilDseiList",
      "brasilDseiCount",
      "masterMapCount",
    ])
      expect(indexHtml, id).not.toContain(`id="${id}"`);
    expect(indexHtml).not.toContain("health-map-");
    expect(indexHtml).toMatch(
      /<section id="page-dashboard" class="page active"><\/section>/,
    );
  });

  /*
    As camadas de Terras Indígenas e Mapa/Satélite enfeitam os mapas com id
    `map`/`detailMap`: esses ids são do mapa da Saúde Indígena (React). Dois
    na página quebrariam as camadas.
  */
  it("não usa os ids do mapa da Saúde Indígena", () => {
    expect(indexHtml).not.toContain('id="map"');
    expect(indexHtml).not.toContain('id="detailMap"');
  });

  it("o módulo e o CSS do mapa legado saíram", () => {
    const main = readFileSync("src/main.js", "utf8");
    expect(main).not.toContain("health-map-workspace.css");
    expect(main).not.toContain("health-reference-kpis.css");
    expect(main).toContain("./modulos/mapa-de-projetos/mapa-de-projetos.css");
    for (const css of ["src/styles/app.css", "src/styles/mobile-app.css"])
      expect(readFileSync(css, "utf8"), css).not.toContain("#mapaDosProjetos");
  });
});

describe("o legado usa a área atual", () => {
  it("filtros, KPIs, mapa e tabela partem dos editais da área atual", () => {
    // O recorte é do estado da Visão geral (React); os mapas leem dele.
    const estado = readFileSync("src/modulos/visao-geral/estado.ts", "utf8");
    expect(estado).toContain(
      "linhasDaArea(linhasDaResposta(linhas), areaAtual)",
    );
    expect(legado).not.toMatch(/rows\.filter\(ehEditalDaSaudeIndigena\)/);
  });

  it("o legado não tem mais mapa: os dois são React", () => {
    for (const removido of [
      "renderMap",
      "desenharMunicipiosNoMapa",
      "scheduleMapResize",
      "criarCarregadorDeMunicipios",
      "municipios-da-visao-geral",
      "mapaDosProjetos",
      "MAPA_DOS_MUNICIPIOS",
      "initLeaflet",
      "drawDSEIBubbles",
      "drawCasai",
      "renderDetailMap",
      "detailRecordsForDsei",
      "drawPolos",
      "drawRedeAssistencial",
      "__agsusSuspenderCamadasIndigenas",
      "ligarMapa",
    ])
      expect(legado, removido).not.toContain(removido);
  });

  it("trocar de área refaz o cabeçalho (o mapa é do estado da Visão geral)", () => {
    // A navegação (src/app/navegacao.js; comportamento em tests/app/navegacao.test.js).
    const navegacao = readFileSync("src/app/navegacao.js", "utf8");
    const troca = navegacao.slice(navegacao.indexOf("function acompanharArea"));
    expect(troca).toContain("assinarDadosDoMonitoramento(");
    // O DSEI aberto e os filtros são do estado da Visão geral, que ouve os mesmos dados.
    expect(troca).toContain("tituloDaVisaoGeral();");
    expect(troca).not.toContain("renderMap");
  });

  it("os dados do mapa da Saúde Indígena vão para o estado da Visão geral", () => {
    const fonte = readFileSync("src/app/carga.js", "utf8");
    const carga = fonte.slice(
      fonte.indexOf("async function carregarMapa"),
      fonte.indexOf("async function carregarLinhas"),
    );
    expect(carga).toContain("visaoGeral.definirDadosDoMapa(");
    expect(fonte).toContain("visaoGeral = estadoDaVisaoGeral");
  });

  it("as terras saem sem apagar a preferência da pessoa", () => {
    const camada = readFileSync(
      "src/modules/indigenous-territories-layer.js",
      "utf8",
    );
    const inicio = camada.indexOf("map.__agsusSuspenderCamadasIndigenas =");
    const suspender = camada.slice(
      inicio,
      camada.indexOf("map.__agsusDefinirTerrasVisiveis", inicio),
    );
    expect(suspender).toContain("clearVector()");
    expect(suspender).toContain("renderDseiCoverage()");
    expect(suspender).not.toContain("storeVisibility");
    expect(camada).toMatch(
      /!suspensas &&\s+map\.__agsusIndigenousTerritoriesVisible/,
    );
    // Mapa removido (React desmonta) também não desenha nada que chegue depois.
    expect(camada).toMatch(/!removido &&\s+!suspensas/);
  });

  it("a view separada da SEDE e de Projetos saiu", () => {
    expect(legado).not.toContain("visao-area");
    expect(indexHtml).not.toContain("page-visao-area");
  });
});
