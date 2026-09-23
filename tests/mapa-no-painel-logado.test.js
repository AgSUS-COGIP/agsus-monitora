import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  O QUE O PAINEL LOGADO MOSTROU

  Depois de publicada a camada nova, o mapa foi exercitado no painel em
  produção, com sessão aberta. Estes casos travam o que apareceu lá e que os
  testes anteriores não viam, porque só se vê com dados reais e navegador.
*/
const camada = readFileSync(
  "src/modules/indigenous-territories-layer.js",
  "utf8",
);
const css = readFileSync("src/styles/indigenous-territories-layer.css", "utf8");
const app = readFileSync("src/modules/legacy-app.js", "utf8");

/*
  "QUANDO COLOCO O CURSOR DÁ UMA BUGADA"

  O balão da terra media 60 px de largura por 302 de altura: uma palavra por
  linha, mais alto que o espaço acima do ponto, cortado pelo topo do mapa. Com
  `white-space: normal` e sem largura, o navegador encolhia-o até à palavra
  mais comprida, porque o Leaflet põe os tooltips numa camada de largura zero.
*/
describe("o balão da terra tem largura", () => {
  const regra = css.slice(
    css.indexOf(".agsus-ti-tooltip {"),
    css.indexOf("}", css.indexOf(".agsus-ti-tooltip {")),
  );

  it("ocupa a linha até ao limite, e só então quebra", () => {
    expect(regra).toContain("white-space: normal");
    expect(regra).toContain("width: max-content");
    expect(regra).toContain("max-width: 260px");
  });
});

/*
  91 PEDIDOS PARA UMA IMAGEM QUE NUNCA APARECIA

  O raster da Funai entrava no mapa ao iniciar e ao religar as terras, "até o
  vetorial carregar". O vetorial vem do catálogo local em 40 a 200 ms, mas
  nesse intervalo o Leaflet já pedia o país inteiro em tiles: 91 pedidos a
  `/api/funai-wms`, 40 s de rede somados, cada um uma chamada à Vercel.
*/
describe("o raster é só o recurso", () => {
  it("só entra no mapa por um caminho, e é o de quando o catálogo falha", () => {
    const entradas = camada.match(/rasterLayer\.addTo\(map\)/g) ?? [];
    expect(entradas).toHaveLength(1);
    const fallback = camada.slice(
      camada.indexOf("const useRasterFallback = () =>"),
      camada.indexOf("const clearVector = () =>"),
    );
    expect(fallback).toContain("rasterLayer.addTo(map)");
  });

  it("religar as terras não traz o raster de volta", () => {
    const fn = camada.slice(
      camada.indexOf("const definirVisibilidade = (proxima) =>"),
      camada.indexOf("const alternarFase = (fase) =>"),
    );
    expect(fn).not.toContain("rasterLayer.addTo(");
  });
});

/*
  UM 502 A CADA CLIQUE

  A Funai deixou de publicar `areas_dsei`. Em caso de falha a promessa voltava
  a `null`, e cada DSEI aberto pedia outra vez.
*/
describe("a abrangência que falhou não se pede de novo", () => {
  const fn = camada.slice(
    camada.indexOf("async function loadDseiFeatures()"),
    camada.indexOf("export function installIndigenousTerritoriesLayer"),
  );

  it("a falha fica guardada para a página inteira", () => {
    expect(fn).not.toContain("dseiFeaturesPromise = null");
    expect(fn).toContain("return null;");
  });
});

// A lista mostrava "· AL · Regularizada", com o separador à frente.
describe("a linha da terra na lista", () => {
  const fn = app.slice(
    app.indexOf("function renderDetailTerraList"),
    app.indexOf("function renderDetailUnitList"),
  );

  it("o separador vai entre as partes", () => {
    expect(fn).toContain('.join(" · ")');
    expect(fn).not.toContain("` · ${esc(t.ufs");
  });
});
