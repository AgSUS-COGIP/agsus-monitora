import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CACHE_TTL_MS,
  RPC_DOS_MUNICIPIOS,
  aplicarAreaNaVisaoGeral,
  criarCarregadorDeMunicipios,
  desenharMunicipiosDaArea,
} from "../../src/modules/municipios-da-visao-geral.js";

/*
  Saúde Indígena, SEDE e Projetos abrem a mesma Visão geral (#page-dashboard).
  A Saúde Indígena fica exatamente como era; a SEDE não tem o bloco do mapa;
  Projetos troca DSEIs por municípios das vagas.

  A página é React (src/modulos/visao-geral/); o bloco do mapa continua no
  index.html (#mapaDaVisaoGeral, na reserva) e a tela o muda para dentro da
  página ao montar. Aqui ele entra direto na <section>, como fica no app.
*/

const indexHtml = readFileSync("index.html", "utf8");
const blocoDoMapa = indexHtml.match(
  /<div id="reservaDoMapaDaVisaoGeral" hidden>([\s\S]*)<\/div>\s*<!-- \/reservaDoMapaDaVisaoGeral -->/,
)[1];
const css = readFileSync("src/styles/health-map-workspace.css", "utf8");
const legado = readFileSync("src/modules/legacy-app.js", "utf8");

const normalizar = (texto) => texto.replace(/\s+/g, " ").trim();

function montarPagina() {
  document.head.innerHTML = `<style>${css}</style>`;
  document.body.innerHTML = `<div class="content"><section id="page-dashboard" class="page active">${blocoDoMapa}</section></div>`;
  return document.getElementById("page-dashboard");
}

const visivel = (elemento) => getComputedStyle(elemento).display !== "none";

describe("a mesma página nas três áreas", () => {
  let pagina;
  beforeEach(() => {
    pagina = montarPagina();
  });

  it("na Saúde Indígena nada muda no bloco do mapa", () => {
    const antes = pagina.querySelector(".health-map-workspace").outerHTML;
    expect(aplicarAreaNaVisaoGeral(pagina, "saude-indigena")).toBe("dsei");
    expect(pagina.dataset.mapaDaArea).toBe("dsei");
    expect(pagina.querySelector(".health-map-workspace").outerHTML).toBe(antes);
    expect(visivel(pagina.querySelector(".health-map-workspace"))).toBe(true);
  });

  it("na SEDE o bloco do mapa some (o resto da página é React, fora dele)", () => {
    aplicarAreaNaVisaoGeral(pagina, "sede");
    expect(pagina.dataset.mapaDaArea).toBe("nenhum");
    expect(visivel(pagina.querySelector(".health-map-workspace"))).toBe(false);
  });

  it("em Projetos o mapa fala de municípios e esconde o que é da Saúde Indígena", () => {
    aplicarAreaNaVisaoGeral(pagina, "projetos");
    const bloco = pagina.querySelector(".health-map-workspace");
    expect(visivel(bloco)).toBe(true);
    expect(normalizar(bloco.textContent)).toContain("Municípios por vagas");
    expect(normalizar(bloco.textContent)).toContain("Municípios das vagas");
    expect(normalizar(bloco.textContent)).not.toContain(
      "Territórios por vagas",
    );
    expect(pagina.querySelector("#map").getAttribute("aria-label")).toContain(
      "municípios",
    );
    // O ícone da lista continua lá.
    expect(
      pagina.querySelector(".health-map-units__header .fa-ranking-star"),
    ).not.toBeNull();
    expect(visivel(pagina.querySelector(".health-map-pane--detail"))).toBe(
      false,
    );
    for (const classe of [
      "health-map-botao--calor",
      "agsus-indigenous-territories-control",
    ]) {
      const botao = document.createElement("div");
      botao.className = classe;
      pagina.querySelector("#map").append(botao);
      expect(visivel(botao), classe).toBe(false);
    }
  });

  it("voltar à Saúde Indígena devolve os textos do index.html", () => {
    const original = normalizar(
      pagina.querySelector(".health-map-workspace").textContent,
    );
    aplicarAreaNaVisaoGeral(pagina, "projetos");
    aplicarAreaNaVisaoGeral(pagina, "saude-indigena");
    expect(
      normalizar(pagina.querySelector(".health-map-workspace").textContent),
    ).toBe(original);
    expect(pagina.querySelector("#map").getAttribute("aria-label")).toBe(
      "Mapa do Brasil com processos seletivos por DSEI, polos base e CASAI",
    );
  });
});

describe("o legado usa a área atual", () => {
  it("filtros, KPIs, mapa e tabela partem dos editais da área atual", () => {
    // O recorte é do estado da Visão geral (React); o mapa lê dele.
    const estado = readFileSync("src/modulos/visao-geral/estado.js", "utf8");
    expect(estado).toContain("linhasDaArea(linhas, areaAtual)");
    expect(legado).toContain("estadoDaVisaoGeral.obter()");
    expect(legado).not.toMatch(/rows\.filter\(ehEditalDaSaudeIndigena\)/);
  });

  it("SEDE não inicia o mapa; Projetos desenha os municípios", () => {
    const renderMap = legado.match(/function renderMap\(\) \{[\s\S]*?\n\}/)[0];
    expect(renderMap).toMatch(/if \(!mapa\) return;[\s\S]*initLeaflet\(\)/);
    expect(renderMap).toContain("desenharMunicipiosNoMapa()");
    expect(renderMap).toContain("__agsusSuspenderCamadasIndigenas");
  });

  it("trocar de área refaz os filtros e redesenha", () => {
    expect(legado).toContain(
      "assinarDadosDoMonitoramento(aoMudarDadosDoMonitoramento)",
    );
    const troca = legado.match(
      /function aoMudarDadosDoMonitoramento\(\) \{[\s\S]*?\n\}/,
    )[0];
    // Os filtros são podados pelo estado da Visão geral, que ouve os mesmos dados.
    expect(troca).toContain("applyFilters();");
    expect(troca).toContain("prepararVisaoGeralDaArea();");
  });

  it("em Projetos as terras saem sem apagar a preferência da pessoa", () => {
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
    expect(camada).toContain(
      "!suspensas && map.__agsusIndigenousTerritoriesVisible",
    );
  });

  it("a view separada da SEDE e de Projetos saiu", () => {
    expect(legado).not.toContain("visao-area");
    expect(indexHtml).not.toContain("page-visao-area");
  });
});

function supabaseFalso(resposta) {
  return {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "teste" } },
        error: null,
      }),
    },
    rpc: vi.fn(async () => resposta),
  };
}

const RESPOSTA = {
  data: [
    {
      municipio_uf: "Irati/PR",
      vagas: 5,
      candidatos: 70,
      aprovados: 43,
      reprovados: 27,
    },
    {
      municipio_uf: "Seropédica/RJ",
      vagas: 12,
      candidatos: 647,
      aprovados: 0,
      reprovados: 0,
    },
    { municipio_uf: "Lugar Novo/AM", vagas: 1, candidatos: 3 },
  ],
  error: null,
};

describe("carga dos municípios", () => {
  it("um pedido por área, guardado pelo tempo do cache", async () => {
    let agora = 0;
    const supabase = supabaseFalso(RESPOSTA);
    const carregador = criarCarregadorDeMunicipios({
      obterSupabase: () => supabase,
      relogio: () => agora,
    });
    const [a, b] = await Promise.all([
      carregador.carregar("projetos"),
      carregador.carregar("projetos"),
    ]);
    expect(a).toBe(b);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith(RPC_DOS_MUNICIPIOS, {
      p_area: "projetos",
    });
    expect(a.municipios).toHaveLength(3);
    await carregador.carregar("projetos");
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    agora = CACHE_TTL_MS + 1;
    await carregador.carregar("projetos");
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });

  it("banco sem a função não é erro; erro não fica guardado", async () => {
    const semFuncao = criarCarregadorDeMunicipios({
      obterSupabase: () =>
        supabaseFalso({ data: null, error: { code: "PGRST202" } }),
    });
    expect(await semFuncao.carregar("projetos")).toMatchObject({
      indisponivel: true,
      erro: "",
    });
    const supabase = supabaseFalso({
      data: null,
      error: { message: "falhou" },
    });
    const comErro = criarCarregadorDeMunicipios({
      obterSupabase: () => supabase,
    });
    expect((await comErro.carregar("projetos")).erro).toBe("falhou");
    expect(comErro.emCache("projetos")).toBeNull();
  });
});

describe("municípios no mapa e na lista", () => {
  function leafletFalso() {
    const marcadores = [];
    const L = {
      circleMarker: (coordenadas, opcoes) => {
        const marcador = {
          coordenadas,
          opcoes,
          bindTooltip: vi.fn(() => marcador),
          bindPopup: vi.fn(() => marcador),
          openPopup: vi.fn(),
        };
        marcadores.push(marcador);
        return marcador;
      },
      latLngBounds: (pontos) => ({ pontos }),
    };
    const camada = {
      camadas: [],
      clearLayers() {
        this.camadas = [];
      },
      addLayer(camadaNova) {
        this.camadas.push(camadaNova);
      },
    };
    const mapa = {
      fitBounds: vi.fn(),
      setView: vi.fn(),
      getZoom: () => 5,
    };
    return { L, camada, mapa, marcadores };
  }

  beforeEach(() => {
    document.body.innerHTML = `
      <b id="conta">…</b><span id="contador"></span>
      <div id="lista"></div>`;
  });

  const opcoes = (falso, extra = {}) => ({
    ...falso,
    area: "projetos",
    carregador: criarCarregadorDeMunicipios({
      obterSupabase: () => supabaseFalso(RESPOSTA),
    }),
    lista: document.getElementById("lista"),
    conta: document.getElementById("conta"),
    contador: document.getElementById("contador"),
    ...extra,
  });

  it("um ponto por município com coordenada e a lista por vagas", async () => {
    const falso = leafletFalso();
    await desenharMunicipiosDaArea(opcoes(falso));
    expect(falso.camada.camadas).toHaveLength(2);
    expect(falso.mapa.fitBounds).toHaveBeenCalledTimes(1);
    expect(document.getElementById("conta").textContent).toBe("3");
    expect(document.getElementById("contador").textContent).toBe(
      "3 municípios",
    );
    const linhas = [...document.querySelectorAll("#lista [data-municipio]")];
    expect(
      linhas.map((linha) => linha.querySelector("strong").textContent),
    ).toEqual(["Seropédica/RJ", "Irati/PR", "Lugar Novo/AM"]);
    // Mesmo formato de "Territórios por vagas": posição, nome, vagas, barra.
    expect(linhas[1].classList).toContain("health-map-unit--ranking");
    expect(linhas[1].querySelector(".health-map-unit__rank").textContent).toBe(
      "2",
    );
    expect(normalizar(linhas[1].textContent)).toContain("5 vagas");
    expect(normalizar(linhas[1].textContent)).toContain("70 candidatos");
    expect(
      linhas[1].querySelector(".health-map-unit__preench.is-resultado i").style
        .width,
    ).toBe("61%");
    expect(normalizar(linhas[1].textContent)).toContain("61% aprovados");
    // Sem nenhuma análise decidida, sem barra; sem coordenada, sem clique.
    expect(linhas[0].querySelector(".health-map-unit__preench")).toBeNull();
    expect(linhas[2].disabled).toBe(true);
    expect(normalizar(linhas[2].textContent)).toContain(
      "sem coordenada no mapa",
    );

    linhas[1].click();
    expect(falso.mapa.setView).toHaveBeenCalledWith([-25.4697, -50.6493], 7, {
      animate: true,
    });
    expect(falso.marcadores[1].openPopup).toHaveBeenCalled();
  });

  it("não desenha quando a página já mudou de área", async () => {
    const falso = leafletFalso();
    await desenharMunicipiosDaArea(opcoes(falso, { aindaVale: () => false }));
    expect(falso.camada.camadas).toHaveLength(0);
    expect(document.getElementById("contador").textContent).toBe("");
  });

  it("escapa o nome do município", async () => {
    const falso = leafletFalso();
    await desenharMunicipiosDaArea(
      opcoes(falso, {
        carregador: criarCarregadorDeMunicipios({
          obterSupabase: () =>
            supabaseFalso({
              data: [{ municipio_uf: '<img src=x onerror="alert(1)">/XX' }],
              error: null,
            }),
        }),
      }),
    );
    expect(document.querySelector("#lista img")).toBeNull();
  });
});
