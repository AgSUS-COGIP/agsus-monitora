import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CACHE_TTL_MS,
  RPC_DOS_MUNICIPIOS,
  aplicarAreaNaVisaoGeral,
  criarCarregadorDeMunicipios,
  desenharLegendaDosMunicipios,
  desenharMunicipiosDaArea,
} from "../../src/modules/municipios-da-visao-geral.js";

/*
  Saúde Indígena, SEDE e Projetos abrem a mesma Visão geral (#page-dashboard).
  A Saúde Indígena fica exatamente como era; a SEDE não tem o bloco do mapa;
  Projetos troca DSEIs por municípios das vagas.
*/

const indexHtml = readFileSync("index.html", "utf8");
const secao = indexHtml.match(
  /<section id="page-dashboard"[\s\S]*?<\/section>\s*<!-- React: src\/componentes\/nucleo/,
)[0];
const css = readFileSync("src/styles/health-map-workspace.css", "utf8");
const legado = readFileSync("src/modules/legacy-app.js", "utf8");

const normalizar = (texto) => texto.replace(/\s+/g, " ").trim();

function montarPagina() {
  document.head.innerHTML = `<style>${css}</style>`;
  document.body.innerHTML = `<div class="content">${secao.replace(/<!-- React:[\s\S]*$/, "")}</div>`;
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

  it("na SEDE o bloco do mapa some e o resto da página fica", () => {
    aplicarAreaNaVisaoGeral(pagina, "sede");
    expect(pagina.dataset.mapaDaArea).toBe("nenhum");
    expect(visivel(pagina.querySelector(".health-map-workspace"))).toBe(false);
    expect(visivel(pagina.querySelector(".kpis-main"))).toBe(true);
    expect(visivel(pagina.querySelector("#multiUnitsCard"))).toBe(true);
    expect(visivel(pagina.querySelector(".table-card"))).toBe(true);
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
    expect(legado).toContain("return linhasDaArea(rows, areaAtual());");
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
    expect(troca).toContain("populateFilters();");
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

describe("todos os projetos no mapa", () => {
  const PROJETOS = {
    data: [
      {
        municipio_uf: "Boa Vista/RR",
        uf: "RR",
        codigo_ibge: 1400100,
        vagas_edital: 38,
        projetos: ["Saúde nas Fronteiras", "Escritório Distrital e Regional"],
        editais: [
          {
            edital: "23/2025",
            projeto: "Saúde nas Fronteiras",
            vagas: 22,
            lotacoes: ["Boa Vista/RR"],
          },
          {
            edital: "62/2025",
            projeto: "Escritório Distrital e Regional",
            vagas: 16,
          },
        ],
      },
      {
        municipio_uf: "Brasília/DF",
        uf: "DF",
        codigo_ibge: 5300108,
        vagas_edital: 5,
        cadastro_reserva: true,
        projetos: ["MFC", "Rio Doce"],
        editais: [
          { edital: "05/2026", projeto: "MFC", vagas: 5 },
          {
            edital: "04/2026",
            projeto: "Rio Doce",
            vagas: null,
            cadastro_reserva: true,
          },
        ],
      },
      {
        municipio_uf: null,
        uf: "PA",
        nivel: "uf",
        vagas_edital: 1,
        projetos: ["CCE"],
        editais: [{ edital: "97/2025", projeto: "CCE", vagas: 1 }],
      },
      {
        municipio_uf: "Irati/PR",
        uf: "PR",
        vagas: 5,
        candidatos: 70,
        aprovados: 43,
        reprovados: 27,
        projetos: ["Projeto Agora Tem Especialistas Caminhoneiros"],
        editais: [
          {
            edital: "30/2026",
            projeto: "Projeto Agora Tem Especialistas Caminhoneiros",
            cadastro_reserva: true,
          },
        ],
      },
    ],
    error: null,
  };

  function leaflet() {
    const marcadores = [];
    return {
      marcadores,
      L: {
        circleMarker: (coordenadas, opcoes) => {
          const marcador = {
            coordenadas,
            opcoes,
            bindTooltip: vi.fn(() => marcador),
            bindPopup: vi.fn((conteudo) => {
              marcador.popup = conteudo;
              return marcador;
            }),
            openPopup: vi.fn(),
          };
          marcadores.push(marcador);
          return marcador;
        },
        latLngBounds: (pontos) => ({ pontos }),
      },
      camada: {
        camadas: [],
        clearLayers() {
          this.camadas = [];
        },
        addLayer(nova) {
          this.camadas.push(nova);
        },
      },
      mapa: { fitBounds: vi.fn(), setView: vi.fn(), getZoom: () => 5 },
    };
  }

  async function desenhar(falso, extra = {}) {
    document.body.innerHTML = `<b id="conta"></b><span id="contador"></span><div id="lista"></div><div id="legenda"></div>`;
    await desenharMunicipiosDaArea({
      ...falso,
      area: "projetos",
      carregador: criarCarregadorDeMunicipios({
        obterSupabase: () => supabaseFalso(PROJETOS),
      }),
      lista: document.getElementById("lista"),
      conta: document.getElementById("conta"),
      contador: document.getElementById("contador"),
      ...extra,
    });
  }

  const nomes = () =>
    [...document.querySelectorAll("#lista [data-municipio] strong")].map(
      (nome) => nome.textContent,
    );

  it("um ponto por lugar, na cor do projeto, e UF no meio do estado", async () => {
    const falso = leaflet();
    const aoDesenhar = vi.fn();
    await desenhar(falso, { aoDesenhar });
    expect(aoDesenhar).toHaveBeenCalledTimes(1);
    expect(falso.camada.camadas).toHaveLength(4);
    // Irati e Brasília empatam em 5 vagas: os candidatos desempatam.
    expect(nomes()).toEqual([
      "Boa Vista/RR",
      "Irati/PR",
      "Brasília/DF",
      "Pará (estado)",
    ]);
    const classe = (indice) => falso.marcadores[indice].opcoes.className;
    // Boa Vista: Fronteiras (série 2) e mais um projeto (contorno tracejado).
    expect(classe(0)).toBe(
      "marcador-de-projeto marcador-de-projeto--2 is-varios-projetos",
    );
    expect(classe(1)).toBe("marcador-de-projeto marcador-de-projeto--1");
    // Brasília: Rio Doce (série 4) vem antes de MFC (série 5).
    expect(classe(2)).toBe(
      "marcador-de-projeto marcador-de-projeto--4 is-varios-projetos",
    );
    expect(classe(3)).toBe("marcador-de-projeto marcador-de-projeto--6");
    // Popup montado no DOM: projeto, edital, vagas, lotação.
    const popup = falso.marcadores[0].popup;
    expect(popup).toBeInstanceOf(HTMLElement);
    expect(normalizar(popup.textContent)).toContain(
      "Saúde nas Fronteiras · Edital 23/2025 · 22 vagas · Boa Vista/RR",
    );
    expect(popup.querySelector(".mapa-projeto__cor--3")).not.toBeNull();
    // A linha da lista diz os projetos e as vagas publicadas.
    const primeira = document.querySelector("#lista [data-municipio]");
    expect(normalizar(primeira.textContent)).toContain("38 vagas");
    expect(
      [...primeira.querySelectorAll(".mapa-projeto__nome")].map((projeto) =>
        normalizar(projeto.textContent),
      ),
    ).toEqual(["Saúde nas Fronteiras", "Escritório Distrital e Regional"]);
  });

  it("filtrar por projeto redesenha sem novo pedido e mantém a cor do projeto", async () => {
    const falso = leaflet();
    await desenhar(falso);
    const seletor = document.querySelector(".mapa-projetos__seletor");
    expect([...seletor.options].map((opcao) => opcao.textContent)).toEqual([
      "Todos os projetos",
      "Caminhoneiros (1)",
      "Saúde nas Fronteiras (1)",
      "Escritório Distrital e Regional (1)",
      "Rio Doce (1)",
      "MFC (1)",
      "CCE (1)",
    ]);
    seletor.value = "Escritório Distrital e Regional";
    seletor.dispatchEvent(new Event("change"));
    expect(nomes()).toEqual(["Boa Vista/RR"]);
    expect(falso.camada.camadas).toHaveLength(1);
    expect(falso.marcadores.at(-1).opcoes.className).toBe(
      "marcador-de-projeto marcador-de-projeto--3",
    );
    expect(document.getElementById("contador").textContent).toBe("1 município");
    // O foco fica no seletor novo.
    expect(document.activeElement).toBe(
      document.querySelector(".mapa-projetos__seletor"),
    );
    // Volta a todos para não vazar a escolha para os outros testes.
    const novo = document.querySelector(".mapa-projetos__seletor");
    novo.value = "";
    novo.dispatchEvent(new Event("change"));
    expect(nomes()).toHaveLength(4);
  });

  it("agrupar por projeto: um bloco por projeto, lugar de dois projetos nos dois", async () => {
    const falso = leaflet();
    await desenhar(falso);
    const agrupar = document.querySelector(".mapa-projetos__agrupar input");
    agrupar.checked = true;
    agrupar.dispatchEvent(new Event("change"));
    const grupos = [
      ...document.querySelectorAll("#lista .mapa-projetos__grupo strong"),
    ].map((grupo) => grupo.textContent);
    expect(grupos).toEqual([
      "Caminhoneiros",
      "Saúde nas Fronteiras",
      "Escritório Distrital e Regional",
      "Rio Doce",
      "MFC",
      "CCE",
    ]);
    expect(nomes().filter((nome) => nome === "Boa Vista/RR")).toHaveLength(2);
    // Clicar na linha do grupo abre o ponto certo.
    const linhas = [...document.querySelectorAll("#lista [data-municipio]")];
    linhas.find((linha) => linha.textContent.includes("Irati/PR")).click();
    expect(falso.mapa.setView).toHaveBeenCalledWith([-25.4697, -50.6493], 7, {
      animate: true,
    });
    const desligar = document.querySelector(".mapa-projetos__agrupar input");
    desligar.checked = false;
    desligar.dispatchEvent(new Event("change"));
  });

  it("a legenda mostra a cor e o nome de cada projeto, sem HTML em texto", async () => {
    await desenhar(leaflet());
    const corpo = document.getElementById("legenda");
    desenharLegendaDosMunicipios(corpo);
    const itens = [...corpo.querySelectorAll(".mapa-projetos__legenda-item")];
    expect(itens.map((item) => normalizar(item.textContent))).toEqual([
      "Caminhoneiros",
      "Saúde nas Fronteiras",
      "Escritório Distrital e Regional",
      "Rio Doce",
      "MFC",
      "CCE",
      "tamanho = nº de vagas",
      "mais de um projeto",
    ]);
    expect(itens[0].querySelector(".mapa-projeto__cor--1")).not.toBeNull();
  });

  it("as cores são as séries do design system", () => {
    const semQuebra = css.replace(/\r\n/g, "\n");
    for (let serie = 1; serie <= 6; serie += 1) {
      expect(semQuebra).toContain(
        `.marcador-de-projeto--${serie} {\n  fill: var(--series-${serie});`,
      );
      expect(semQuebra).toContain(
        `.mapa-projeto__cor--${serie} {\n  background: var(--series-${serie});`,
      );
    }
  });

  it("o módulo não monta HTML em string", () => {
    const modulo = readFileSync(
      "src/modules/municipios-da-visao-geral.js",
      "utf8",
    );
    expect(modulo).not.toMatch(/innerHTML/);
    expect(legado).not.toContain("legendaDosMunicipios()");
  });
});
