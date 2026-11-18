// @vitest-environment node
import { bloco } from "./apoio/bloco.ts";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import {
  anoDaSelecao,
  anoDoEdital,
  anosDosEditais,
  editaisDoAno,
} from "../src/lib/visao-geral/atalhos-de-filtro.ts";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import {
  CATALOGO_DE_TERRAS,
  CATALOGO_DE_TERRAS_EM_ESTUDO,
  caixaDaFeature,
  caixaDoMapa,
  caixasSeIntersectam,
  carregarCatalogo,
  terrasNoEnquadramento,
  FASES_DAS_TERRAS,
  ZOOM_DO_PAIS,
  estiloDaFase,
  estiloDoSimbolo,
  faseDaLegenda,
  faseDaTerra,
  lerFasesOcultas,
  raioDoSimbolo,
  terrasDasFasesVisiveis,
  AVISO_DO_SIMBOLO,
  FUNAI_PROXY_GEOJSON,
  FUNAI_PROXY_WMS,
  FUNAI_TERRITORIES_LAYER,
  dseiFeatureMatches,
  dseiFeatureName,
  funaiFeatureName,
  funaiViewportUrl,
  isHealthMapElementId,
  povosDaTerraIndigena,
  rotuloDaTerraIndigena,
  tamanhoNaTelaEmPixels,
  terraPrecisaDeSimbolo,
  tooltipDaTerraIndigena,
  tooltipDoDsei,
  povosDaFeature,
  resumoDasTerras,
  CATALOGO_DE_TERRAS_LARGO,
  ZOOM_DO_CATALOGO_FINO,
  catalogoParaOZoom,
  DISTANCIA_MINIMA_ENTRE_ROTULOS_PX,
  RAIO_DE_ATENDIMENTO_KM,
  caixaDeCoordenadas,
  poligonosDaFeature,
  pontoEmPoligonos,
  rotulosSemColisao,
  terraPertenceAoDsei,
  AVISO_DE_ESTUDO,
  funaiEstudoUrl,
  tooltipDaTerraEmEstudo,
} from "../src/modules/indigenous-territories-layer.ts";
import {
  aplicarCoordenada,
  filaDeCoordenadasDosProjetos,
  gravidadeDoLugar,
  pontosEditaveisDosProjetos,
  sugestoesDoLugar,
} from "../src/lib/mapas/coordenadas-dos-projetos.ts";
import {
  filaDoEditor,
  listaDeSugestoes,
  nivelDaGravidade,
  correcaoDesfazivel,
} from "../src/lib/mapas/editor-de-coordenadas.ts";
import {
  municipiosDaResposta,
  pontosDosMunicipios,
  MAPA_DOS_DSEIS,
  MAPA_DOS_MUNICIPIOS,
  TEXTOS_DO_MAPA,
  PROJETOS_DO_MAPA,
  cabecalhoDaVisaoGeral,
  gruposPorProjeto,
  mapaDaVisaoGeral,
  projetoDoMapa,
  projetosDosMunicipios,
  lugaresDoRecorte,
  resultadoDoMunicipio,
  resumoDoLugar,
  rotuloDoLugar,
  textoDasVagas,
} from "../src/lib/visao-geral/visao-geral-da-area.ts";
import { join } from "node:path";
import {
  classificarRegistros,
  dicaDoRegistro,
  popupDaSede,
  popupDoRegistro,
  registroDaSede,
  registrosDoDsei,
  linhaDaTerra,
  limitesDoDsei,
  pontosDoDistrito,
  registrosExternos,
  registrosLocais,
  resumoDaRede,
  textoDosVinculosExternos,
  tiposDoTerritorio,
  visiveis,
  textoDosVinculosExternos as textoDoChip,
} from "../src/lib/mapas/mapa-saude-indigena/mapa-do-dsei.ts";
import {
  bolhasDosDsei,
  casaisNacionais,
  dicaDaBolha,
  dicaDaCasaiNacional,
  popupDaCasaiNacional,
  contarPorDsei,
  enquadramentoNacional,
  territoriosPorVagas,
} from "../src/lib/mapas/mapa-saude-indigena/mapa-nacional.ts";
import {
  diaDoCalendario,
  gravidade,
  LIMITES_DO_CRITICO,
  motivosDeAtencao,
  temEtapaEmCurso,
  ultimaMudancaDeEtapa,
} from "../src/lib/visao-geral/criticos-da-visao-geral.ts";
import {
  casaisNacionaisDoMapa,
  configuracaoDoMapa,
  terrasDoMapa,
} from "../src/lib/mapas/mapa-saude-indigena/dados-do-mapa.ts";
import { leafletDoMapa } from "../src/modulos/mapa-saude-indigena/tipos-do-leaflet.ts";
import { criarLeafletFalso } from "./modulos/leaflet-falso.js";
import {
  BRASIL_BOUNDS,
  boundsDoGeoJson,
} from "../src/lib/mapas/brasil-bounds.ts";
import {
  FOLGA_ALEM_DO_RAIO,
  FOLGA_DO_BRASIL,
  RAIO_MAXIMO_NO_MAPA,
  ZOOM_MINIMO_PARA_CABER,
  ZOOM_NACIONAL,
  projetar,
  sobraNaMoldura,
  zoomQueCabe,
  OPCOES_DA_CAIXA,
  ZOOM_DO_PONTO,
  enquadramentoDoRecorte,
} from "../src/lib/mapas/enquadramento-do-brasil.ts";
import {
  RAIO_MAXIMO as RAIO_DA_BOLHA,
  RAIO_MAXIMO,
  RAIO_MINIMO,
  agruparCoincidentes,
  agruparPorCelula,
  criarRegistroDeDescarte,
  posicoesSpiderfy,
  raioDaBolha,
  SOBREPOSICAO_EM_PIXELS,
  agruparPorProximidadeNaTela,
} from "../src/lib/mapas/mapa-render.ts";
import {
  FORMAS,
  TIPOS_DA_LEGENDA,
  formaDoTipo,
  CORES_DO_MAPA,
  tipoDaUnidade,
  DESENHO_DAS_FORMAS,
  ESTILO_DA_LINHA_DE_VINCULO as ESTILO_DA_LINHA,
  TEXTO_DA_LINHA_DE_VINCULO as TOOLTIP_DA_LINHA,
} from "../src/lib/mapas/mapa-saude-indigena/formas.ts";
import {
  faseDaAtividade,
  faseDoEdital,
  FASES,
  ORDEM_DAS_FASES,
  tomDaFase,
} from "../src/lib/visao-geral/fases-do-processo.ts";
import {
  chaveDeFiltro,
  linhaAtende,
  opcoesDoCampo,
  podarSelecoes,
} from "../src/lib/mapas/filtros-do-mapa.ts";
import {
  acompanhamentoDaResposta,
  enriquecerLinhas,
  indicadoresDaVisaoGeral,
  linhasDaResposta,
  normalizarFiltros,
  alternarColuna,
  andamentoPorFase,
  compararValoresDoFiltro,
  csvDaVisaoGeral,
  dataCurta,
  diasAte,
  fasesDosProcessos,
  filtrosVazios,
  INDICADORES,
  linkSeguro,
  nomeDoCsv,
  normalizarColunas,
  opcoesDosFiltros,
  podarFiltros,
  posResultado,
  prazoDoEdital,
  processosPorProjeto,
  proximaOrdenacao,
  recortar,
  resumoDoRelatorio,
  rotuloDoAtalho,
  seloDoCronograma,
  statusCanonico,
  taxaDeOciosidade,
  temProcessosPorProjeto,
  textosDaVisaoGeral,
  urgenciaDoCronograma,
  VALOR_DO_INDICADOR,
} from "../src/lib/visao-geral/visao-geral.ts";
import {
  buscarAcompanhamentoNoSupabase,
  criarEstadoDaVisaoGeral,
} from "../src/modulos/visao-geral/estado.ts";
import { lerMarcosDaArea } from "../src/modulos/visao-geral/marcos.ts";
import {
  contratacoesDoCadastroReserva,
  contratadasImediatas,
  ehCancelado,
  ehConcluido,
  ehEditalEncerrado,
  indicadoresDoMonitoramento,
  somarCampo,
  temResultado,
  vagasSemContratacao,
} from "../src/lib/visao-geral/indicadores-do-monitoramento.ts";
import {
  ARQUIVO_DOS_CONTORNOS_DOS_DSEIS,
  contornosValidos,
} from "../src/lib/mapas/mapa-saude-indigena/contornos-dos-dseis.ts";
import {
  RAIO_DO_LEQUE,
  agruparNaTela,
  anguloNoLeque,
  calcularLeque,
} from "../src/lib/mapas/leque-de-marcadores.ts";
import { fonteDoApp } from "./fonte-do-app.ts";
import {
  chaveDoDsei,
  temCoordenada,
} from "../src/lib/mapas/mapa-saude-indigena/chaves.ts";
import {
  BR_OUTLINE,
  UF_GEO,
} from "../src/lib/mapas/mapa-saude-indigena/contornos.js";
import {
  DSEIS_OFICIAIS,
  nomeOficialDoDsei,
  numeroDoDsei,
} from "../src/lib/mapas/mapa-saude-indigena/dseis-oficiais.ts";
import {
  NOTA_DA_COR_DO_DSEI,
  TOKEN_SEM_DADO,
  colorirValido,
  dicaDoDseiSimples,
  faixaDoValor,
  faixasDeOciosas,
  faixasDePreenchidas,
  indicadoresDosDseis,
  pintarDseis,
  tokenDaClasse,
} from "../src/lib/mapas/mapa-saude-indigena/mapa-simples.ts";
import {
  correcaoDoEditor,
  historicoDoEditor,
  pendenciasDoEditor,
} from "../src/lib/mapas/respostas-do-editor-de-coordenadas.ts";
import {
  UF_POR_CODIGO_IBGE,
  VINCULO_EXTERNO,
  VINCULO_INDETERMINADO,
  VINCULO_NORMAL,
  classificarVinculoTerritorial,
  siglaDaUf,
} from "../src/lib/mapas/uf-ibge.ts";
import {
  chaveDoMunicipio,
  coordenadasDaUf,
  coordenadasDoMunicipio,
} from "../src/lib/mapas/coordenadas-dos-municipios.ts";

bloco("atalhos-de-filtro", () => {
  const editais = ["11/2025", "81/2026", "105/2026", "FGV", "05/2026"];

  describe("atalho de ano", () => {
    it("lê o ano do número do edital", () => {
      expect(anoDoEdital("81/2026")).toBe(2026);
      expect(anoDoEdital("Edital 3/2025 - DSEI X")).toBe(2025);
      expect(anoDoEdital("FGV")).toBeNull();
    });

    it("lista os anos dos próprios dados, do mais recente ao mais antigo", () => {
      expect(anosDosEditais(editais)).toEqual([2026, 2025]);
    });

    it("seleciona os editais do ano e reconhece a seleção", () => {
      const de2026 = editaisDoAno(editais, 2026);
      expect(de2026).toEqual(["81/2026", "105/2026", "05/2026"]);
      expect(anoDaSelecao(de2026, editais)).toBe("2026");
      expect(anoDaSelecao([], editais)).toBe("");
      expect(anoDaSelecao(["81/2026"], editais)).toBe("personalizado");
    });
  });
});

bloco("catalogo-de-terras-indigenas", () => {
  /*
  O MAPA ESPERAVA A FUNAI A CADA ARRASTO

  O enquadramento virava um bbox de floats crus, dois arrastos seguidos nunca
  partilhavam URL, e nenhuma cache acertava. Medido contra o GeoServer da Funai:
  677 ms e 1,22 MB para desenhar 23 terras; o mesmo enquadramento um pixel ao
  lado, outro pedido inteiro.

  `scripts/compilar-terras-indigenas.mjs` traz as 665 de uma vez, simplificadas
  a 111 metros: 2,2 MB, 0,61 MB comprimido — menos de metade do que custava um
  enquadramento. Daí para a frente enquadrar, filtrar por distrito e limpar o
  filtro não tocam na rede.
*/
  const terra = (nome, oeste, sul, leste, norte) => ({
    type: "Feature",
    properties: { terrai_nome: nome },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [oeste, sul],
          [leste, sul],
          [leste, norte],
          [oeste, norte],
          [oeste, sul],
        ],
      ],
    },
  });

  describe("a caixa de uma terra", () => {
    it("mede o que a geometria ocupa", () => {
      expect(caixaDaFeature(terra("X", -40, -12, -38, -10))).toEqual({
        oeste: -40,
        sul: -12,
        leste: -38,
        norte: -10,
      });
    });

    /*
    Calcular a caixa percorre todos os vértices. Com 665 terras a cada
    movimento do mapa, isso seria o gargalo seguinte depois de se ter tirado a
    rede do caminho.
  */
    it("guarda o resultado na própria feature", () => {
      const f = terra("X", -40, -12, -38, -10);
      expect(caixaDaFeature(f)).toBe(caixaDaFeature(f));
    });

    it("não quebra com feature congelada nem com lixo", () => {
      const congelada = Object.freeze(terra("X", -40, -12, -38, -10));
      expect(caixaDaFeature(congelada)).toEqual({
        oeste: -40,
        sul: -12,
        leste: -38,
        norte: -10,
      });
      expect(caixaDaFeature(null)).toBeNull();
      expect(caixaDaFeature({ geometry: { type: "Point" } })).toBeNull();
    });
  });

  describe("o que cabe no enquadramento", () => {
    const bahia = terra("Bahia", -41, -13, -39, -11);
    const roraima = terra("Roraima", -63, 1, -61, 3);
    const features = [bahia, roraima];

    it("deixa entrar quem toca a janela", () => {
      const vistas = terrasNoEnquadramento(features, {
        oeste: -42,
        sul: -14,
        leste: -38,
        norte: -10,
      });
      expect(vistas).toEqual([bahia]);
    });

    /*
    Uma terra maior do que o ecrã não tem nenhum canto dentro da janela e
    continua a ter de ser desenhada — é justamente o caso do Yanomami num mapa
    de Roraima.
  */
    it("deixa entrar a terra que engole a janela", () => {
      expect(
        terrasNoEnquadramento([terra("Grande", -70, -10, -50, 5)], {
          oeste: -61,
          sul: -2,
          leste: -60,
          norte: -1,
        }),
      ).toHaveLength(1);
    });

    it("toque pela borda conta", () => {
      expect(
        caixasSeIntersectam(
          { oeste: -41, sul: -13, leste: -39, norte: -11 },
          { oeste: -39, sul: -13, leste: -37, norte: -11 },
        ),
      ).toBe(true);
    });

    it("sem enquadramento, nada é recortado", () => {
      expect(terrasNoEnquadramento(features, null)).toBe(features);
      expect(terrasNoEnquadramento(null, null)).toEqual([]);
    });

    it("lê a caixa dos limites do Leaflet", () => {
      expect(
        caixaDoMapa({
          getWest: () => -42,
          getSouth: () => -14,
          getEast: () => -38,
          getNorth: () => -10,
        }),
      ).toEqual({ oeste: -42, sul: -14, leste: -38, norte: -10 });
      expect(caixaDoMapa(null)).toBeNull();
      expect(caixaDoMapa({ getWest: () => NaN })).toBeNull();
    });
  });

  describe("carregar o catálogo", () => {
    it("devolve a coleção quando o pedido corre bem", async () => {
      const buscar = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          type: "FeatureCollection",
          features: [terra("X", -1, -1, 1, 1)],
        }),
      });
      const catalogo = await carregarCatalogo(CATALOGO_DE_TERRAS, buscar);
      expect(catalogo.features).toHaveLength(1);
      expect(buscar).toHaveBeenCalledWith(
        CATALOGO_DE_TERRAS,
        expect.anything(),
      );
    });

    /*
    Falhar aqui não pode partir o mapa: há o recurso à Funai e, atrás dele, o
    raster. `null` é a forma de dizer "não tenho", e quem chama trata disso.
  */
    it("devolve null quando o ficheiro não está lá", async () => {
      const buscar = vi.fn().mockResolvedValue({ ok: false, status: 404 });
      expect(await carregarCatalogo(CATALOGO_DE_TERRAS, buscar)).toBeNull();
    });

    it("devolve null quando a rede falha", async () => {
      const buscar = vi.fn().mockRejectedValue(new Error("offline"));
      expect(await carregarCatalogo(CATALOGO_DE_TERRAS, buscar)).toBeNull();
    });

    it("devolve null quando o corpo não é uma coleção", async () => {
      const buscar = vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ erro: "x" }) });
      expect(await carregarCatalogo(CATALOGO_DE_TERRAS, buscar)).toBeNull();
    });

    /*
    Este caso nasceu de uma falha real. O `fetch` bloqueado da suíte ATIRA em
    vez de rejeitar, e um `fetch` que atira escapava ao `catch` — a função
    lançava para fora em vez de devolver `null`, e o mapa partia-se em vez de
    cair no recurso. Num navegador isso acontece com um URL inválido.
  */
    it("devolve null mesmo quando o fetch atira em vez de rejeitar", async () => {
      const buscar = () => {
        throw new Error("atirou já");
      };
      expect(await carregarCatalogo(CATALOGO_DE_TERRAS, buscar)).toBeNull();
    });
  });

  /*
  O ficheiro é dado, mas é dado que decide o que o mapa desenha. Estes casos
  travam uma recompilação que saia deformada.
*/
  describe("o ficheiro compilado", () => {
    const catalogo = JSON.parse(
      readFileSync("public/data/terras-indigenas.json", "utf8"),
    );

    it("traz todas as terras com limite publicado", () => {
      expect(catalogo.features.length).toBeGreaterThanOrEqual(660);
    });

    it("cabe no que se prometeu", () => {
      const mb = Buffer.byteLength(JSON.stringify(catalogo)) / 1048576;
      expect(mb, `catálogo com ${mb.toFixed(1)} MB`).toBeLessThan(3);
    });

    it("cada terra traz nome e geometria de área", () => {
      for (const f of catalogo.features) {
        expect(f.properties.terrai_nome, "terra sem nome").toBeTruthy();
        expect(["Polygon", "MultiPolygon"]).toContain(f.geometry.type);
      }
    });

    it("nenhuma terra cai fora do Brasil", () => {
      for (const f of catalogo.features) {
        const c = caixaDaFeature(f);
        expect(c.sul, f.properties.terrai_nome).toBeGreaterThan(-34);
        expect(c.norte, f.properties.terrai_nome).toBeLessThan(6);
        expect(c.oeste, f.properties.terrai_nome).toBeGreaterThan(-74);
        expect(c.leste, f.properties.terrai_nome).toBeLessThan(-34);
      }
    });

    it("declara a tolerância com que foi simplificado", () => {
      expect(catalogo.tolerancia_graus).toBe(0.001);
      expect(catalogo.fonte).toContain("Funai");
    });

    it("as terras em estudo continuam a ser pontos", () => {
      const estudo = JSON.parse(
        readFileSync("public/data/terras-indigenas-em-estudo.json", "utf8"),
      );
      expect(estudo.features.length).toBeGreaterThanOrEqual(160);
      for (const f of estudo.features) expect(f.geometry.type).toBe("Point");
      expect(CATALOGO_DE_TERRAS_EM_ESTUDO).toBe(
        "/data/terras-indigenas-em-estudo.json",
      );
    });
  });
});

bloco("coordenadas-dos-projetos", () => {
  /*
  As regras do editor de coordenadas no mapa de Projetos
  (src/lib/mapas/coordenadas-dos-projetos.ts) e as partes comuns aos dois mapas
  que elas usam (src/lib/mapas/editor-de-coordenadas.js).
*/

  // Linhas como a RPC listar_municipios_das_vagas_da_area devolve depois da
  // migration 20261002190000 (lugar + coordenada do banco).
  const RESPOSTA = [
    {
      lugar: "seropedica/RJ",
      municipio_uf: "Seropédica/RJ",
      uf: "RJ",
      codigo_ibge: 3305554,
      latitude: -22.7526,
      longitude: -43.7155,
      coordenada_origem: "SEDE_IBGE",
      projetos: ["Projeto Agora Tem Especialistas Caminhoneiros"],
      editais: [
        {
          edital: "30/2026",
          projeto: "Projeto Agora Tem Especialistas Caminhoneiros",
          lotacoes: ["UBS móvel Seropédica/RJ"],
        },
      ],
    },
    {
      lugar: "boa vista/RR",
      municipio_uf: "Boa Vista/RR",
      uf: "RR",
      codigo_ibge: 1400100,
      // 5,5 km ao norte da sede do IBGE (2.8238, -60.6753).
      latitude: 2.8733,
      longitude: -60.6753,
      coordenada_origem: "MANUAL",
      projetos: ["Escritório Distrital e Regional"],
      editais: [
        {
          edital: "62/2025",
          projeto: "Escritório Distrital e Regional",
          lotacoes: ["Escritório Distrital Yanomami"],
        },
      ],
    },
    {
      lugar: "uf:PA",
      municipio_uf: null,
      uf: "PA",
      nivel: "uf",
      latitude: -2.9668,
      longitude: -49.7614,
      coordenada_origem: "CENTRO_UF",
      projetos: ["CCE", "Escritório Distrital e Regional"],
      editais: [{ edital: "97/2025", projeto: "CCE" }],
    },
    {
      lugar: "lugar novo/AM",
      municipio_uf: "Lugar Novo/AM",
      uf: "AM",
      latitude: null,
      longitude: null,
      projetos: ["MFC"],
      editais: [{ edital: "05/2026", projeto: "MFC" }],
    },
  ];
  const LUGARES = municipiosDaResposta(RESPOSTA);
  const PONTOS = pontosEditaveisDosProjetos(LUGARES);
  const ponto = (lugar) => PONTOS.find((p) => p.id === lugar);
  const pendencia = (lugar, motivo_tipo, candidatos = [], extra = {}) => ({
    lugar,
    nome: lugar,
    motivo_tipo,
    motivo: `motivo ${motivo_tipo}`,
    conferido: false,
    candidatos,
    ...extra,
  });

  describe("lugares do mapa de Projetos no editor", () => {
    it("a coordenada vem do banco; sem o campo (banco antigo), da tabela do front", () => {
      expect(LUGARES[0]).toMatchObject({
        lugar: "seropedica/RJ",
        coordenada: {
          latitude: -22.7526,
          longitude: -43.7155,
          origem: "SEDE_IBGE",
        },
      });
      expect(LUGARES[3].coordenada).toBeNull();
      const desenhados = pontosDosMunicipios(LUGARES);
      expect(
        desenhados.find((p) => p.lugar === "boa vista/RR").coordenadas,
      ).toEqual([2.8733, -60.6753]);
      expect(
        desenhados.find((p) => p.lugar === "lugar novo/AM").coordenadas,
      ).toBeNull();
      const [antigo] = municipiosDaResposta([
        { municipio_uf: "Seropédica/RJ", uf: "RJ" },
      ]);
      expect(antigo.coordenada).toBeUndefined();
      expect(antigo.lugar).toBe("");
      expect(pontosDosMunicipios([antigo])[0].coordenadas).toEqual([
        -22.7526, -43.7155,
      ]);
    });

    it("pontos editáveis: só com a chave do lugar, com UF, projetos, editais e lotações", () => {
      expect(PONTOS.map((p) => p.id)).toEqual([
        "seropedica/RJ",
        "boa vista/RR",
        "uf:PA",
        "lugar novo/AM",
      ]);
      expect(ponto("uf:PA")).toMatchObject({
        alvo: { lugar: "uf:PA" },
        nome: "Pará (estado)",
        nivel: "uf",
        localidade: "Escritório Distrital e Regional, CCE",
        latitude: -2.9668,
      });
      expect(ponto("seropedica/RJ").lotacoes).toEqual([
        "UBS móvel Seropédica/RJ",
      ]);
      expect(ponto("lugar novo/AM")).toMatchObject({
        latitude: null,
        longitude: null,
      });
      expect(
        pontosEditaveisDosProjetos(
          municipiosDaResposta([{ municipio_uf: "Irati/PR", uf: "PR" }]),
        ),
      ).toEqual([]);
    });

    it("sugestões: as da pendência e a sede do IBGE (ou o centro da UF), sem repetir", () => {
      const sugestoes = sugestoesDoLugar(
        pendencia("boa vista/RR", "SEDE_MUNICIPAL", [
          { f: "MUNICIPIO", n: "Boa Vista/RR", lat: 2.8238, lon: -60.6753 },
          { f: "DSEI", n: "Sede do DSEI Yanomami", lat: 2.83, lon: -60.69 },
        ]),
        ponto("boa vista/RR"),
      );
      expect(sugestoes.map((s) => [s.fonte, s.nome])).toEqual([
        ["MUNICIPIO", "Boa Vista/RR"],
        ["DSEI", "Sede do DSEI Yanomami"],
      ]);
      expect(sugestoes[0].rotulo).toBe("Sede do município (IBGE)");
      expect(sugestoes[0].distanciaKm).toBeCloseTo(5.5, 0);
      expect(
        sugestoesDoLugar(null, ponto("uf:PA")).map((s) => [s.fonte, s.nome]),
      ).toEqual([["UF", "Pará"]]);
      expect(sugestoesDoLugar(null, ponto("lugar novo/AM"))).toEqual([]);
    });
  });

  describe("gravidade de um lugar", () => {
    it("só confirmar: na sede do município ou no centro da UF", () => {
      expect(
        gravidadeDoLugar(
          pendencia("seropedica/RJ", "SEDE_MUNICIPAL"),
          ponto("seropedica/RJ"),
        ),
      ).toMatchObject({
        nivel: "confirmar",
        resumo: "Na sede do município · Sede do município (IBGE) a 0 m",
        melhor: { fonte: "MUNICIPIO" },
      });
      expect(
        gravidadeDoLugar(pendencia("uf:PA", "SO_UF"), ponto("uf:PA")),
      ).toMatchObject({
        nivel: "confirmar",
        resumo: "O edital só diz a UF · Centro da UF a 0 m",
      });
    });

    it("revisar: régua entre 2 e 10 km, ou escritório num edital que só diz a UF", () => {
      expect(
        gravidadeDoLugar(
          pendencia("boa vista/RR", "SEDE_MUNICIPAL"),
          ponto("boa vista/RR"),
        ),
      ).toMatchObject({ nivel: "revisar" });
      expect(
        gravidadeDoLugar(
          pendencia("uf:PA", "ESCRITORIO_SO_UF"),
          ponto("uf:PA"),
        ),
      ).toMatchObject({
        nivel: "revisar",
        resumo: "Escritório num edital que só diz a UF · Centro da UF a 0 m",
      });
    });

    it("provável erro: sem coordenada, motivo de erro ou régua a mais de 10 km; sem sugestão", () => {
      const longe = { ...ponto("seropedica/RJ"), latitude: -22.5 };
      expect(
        gravidadeDoLugar(pendencia("seropedica/RJ", "SEDE_MUNICIPAL"), longe)
          .nivel,
      ).toBe("erro");
      expect(
        gravidadeDoLugar(
          pendencia("seropedica/RJ", "LUGAR_DIVERGE"),
          ponto("seropedica/RJ"),
        ),
      ).toMatchObject({
        nivel: "erro",
        resumo: expect.stringMatching(/^Mesmo município com coordenadas/),
      });
      const semCoordenada = {
        ...ponto("seropedica/RJ"),
        latitude: null,
        longitude: null,
      };
      expect(gravidadeDoLugar(null, semCoordenada)).toMatchObject({
        nivel: "erro",
        resumo: "Sem coordenada · Sede do município (IBGE): Seropédica/RJ",
      });
      expect(gravidadeDoLugar(null, ponto("lugar novo/AM"))).toMatchObject({
        nivel: "sem",
        resumo: "Sem coordenada · nenhuma posição candidata",
        melhor: null,
      });
    });
  });

  describe("fila do editor de Projetos", () => {
    const PENDENCIAS = [
      pendencia("seropedica/RJ", "SEDE_MUNICIPAL"),
      pendencia("boa vista/RR", "SEDE_MUNICIPAL"),
      pendencia("uf:PA", "SO_UF", [], { conferido: true }),
    ];

    it("lugar sem coordenada é pendente mesmo sem pendência; provável erro primeiro", () => {
      const fila = filaDeCoordenadasDosProjetos(PONTOS, PENDENCIAS);
      expect(fila.pendentes).toBe(3);
      expect(fila.porGravidade).toEqual({
        erro: 0,
        revisar: 1,
        sem: 1,
        confirmar: 1,
      });
      expect(fila.itens.map((i) => i.id)).toEqual([
        "boa vista/RR",
        "lugar novo/AM",
        "seropedica/RJ",
      ]);
      const todos = filaDeCoordenadasDosProjetos(PONTOS, PENDENCIAS, {
        soPendentes: false,
      });
      expect(todos.itens.map((i) => i.id)).toEqual([
        "lugar novo/AM",
        "uf:PA",
        "seropedica/RJ",
        "boa vista/RR",
      ]);
      expect(todos.itens.find((i) => i.id === "uf:PA")).toMatchObject({
        pendente: false,
        gravidade: null,
      });
    });

    it("busca por lugar, UF, projeto, edital e lotação, sem acento nem caixa", () => {
      const busca = (texto) =>
        filaDeCoordenadasDosProjetos(PONTOS, PENDENCIAS, {
          busca: texto,
          soPendentes: false,
        }).itens.map((i) => i.id);
      expect(busca("seropedica")).toEqual(["seropedica/RJ"]);
      expect(busca("62/2025")).toEqual(["boa vista/RR"]);
      expect(busca("yanomami")).toEqual(["boa vista/RR"]);
      expect(busca("cce")).toEqual(["uf:PA"]);
      expect(busca("PARÁ")).toEqual(["uf:PA"]);
      expect(busca("mfc am")).toEqual(["lugar novo/AM"]);
    });

    it("filtra pelo nível da gravidade", () => {
      expect(
        filaDeCoordenadasDosProjetos(PONTOS, PENDENCIAS, {
          gravidade: "revisar",
        }).itens.map((i) => i.id),
      ).toEqual(["boa vista/RR"]);
    });

    it("aplicarCoordenada troca só o lugar gravado", () => {
      const novos = aplicarCoordenada(LUGARES, "lugar novo/AM", -3.1, -60);
      expect(novos[3].coordenada).toEqual({
        latitude: -3.1,
        longitude: -60,
        origem: "MANUAL",
      });
      expect(novos[0]).toBe(LUGARES[0]);
      expect(aplicarCoordenada(LUGARES, "x", Number.NaN, 1)).toBe(LUGARES);
      expect(aplicarCoordenada(undefined, "x", 1, 1)).toBeUndefined();
    });
  });

  describe("partes comuns do editor", () => {
    it("nivelDaGravidade: revisar nunca vira confirmar", () => {
      expect(nivelDaGravidade({ temSugestao: true, km: 1 })).toBe("confirmar");
      expect(
        nivelDaGravidade({ temSugestao: true, km: 1, revisar: true }),
      ).toBe("revisar");
      expect(
        nivelDaGravidade({ temSugestao: true, km: 11, revisar: true }),
      ).toBe("erro");
      expect(nivelDaGravidade({ temSugestao: false, motivoDeErro: "x" })).toBe(
        "sem",
      );
    });

    it("listaDeSugestoes: ordem do grupo, repetidas e posições inválidas fora", () => {
      const grupos = {
        A: { ordem: 1, rotulo: "A" },
        B: { ordem: 0, rotulo: "B" },
      };
      const lista = listaDeSugestoes(
        [
          { fonte: "A", nome: "x", latitude: -10, longitude: -50 },
          { fonte: "A", nome: "y", latitude: -10.0001, longitude: -50 },
          { fonte: "B", nome: "z", latitude: -11, longitude: -50 },
          { fonte: "C", nome: "w", latitude: "nada", longitude: -50 },
          { fonte: "C", nome: "v", latitude: -12, longitude: -50 },
        ],
        { latitude: -10, longitude: -50 },
        grupos,
      );
      expect(lista.map((s) => [s.fonte, s.nome, s.rotulo])).toEqual([
        ["B", "z", "B"],
        ["A", "x", "A"],
        ["OUTRA", "v", "Outra fonte"],
      ]);
    });

    it("filaDoEditor usa as regras de quem chama", () => {
      const fila = filaDoEditor(
        [
          { id: "1", nome: "Um" },
          { id: "2", nome: "Dois" },
        ],
        [{ chave: "1", conferido: false }],
        {},
        {
          chaveDoPonto: (p) => p.id,
          chaveDaPendencia: (p) => p.chave,
          gravidade: () => ({ nivel: "revisar", resumo: "", melhor: null }),
          pendenteSemPendencia: (p) => p.id === "2",
          textoDeBusca: (i) => i.nome,
          comparar: (a, b) => a.nome.localeCompare(b.nome),
        },
      );
      expect(fila.itens.map((i) => i.id)).toEqual(["2", "1"]);
      expect(fila.porGravidade.revisar).toBe(2);
    });
  });

  it("não trata nomes herdados do protótipo como motivo de erro", () => {
    const ponto = {
      id: "desconhecido/XX",
      nome: "Desconhecido/XX",
      alvo: { lugar: "desconhecido/XX" },
      nivel: "municipio",
      uf: "XX",
      localidade: "",
      latitude: -12,
      longitude: -50,
    };
    expect(
      gravidadeDoLugar(
        {
          motivo_tipo: "constructor",
          candidatos: [null, { f: "IBGE", lat: [], lon: {} }],
        },
        ponto,
      ),
    ).toMatchObject({ nivel: "sem", resumo: "nenhuma posição candidata" });
  });
});

bloco("coordenadas-so-do-sigepsi", () => {
  /*
  O SIGEPSI É A ÚNICA FONTE DE COORDENADA DO MAPA DA SAÚDE INDÍGENA

  Desde 17/11/2026 a sede e os pontos de cada DSEI (polos, CASAIs, unidades
  de lotação) e as CASAIs nacionais vêm da API do SIGEPSI
  (`aplicarLocalizacoes`, `casaisNacionaisDoSigepsi`). Antes, o banco; antes
  ainda, os vereditos da validação de 22/09 e a planilha de Lotações, que
  trocavam a posição e acrescentavam pontos — saíram em 02/10/2026.

  Os dados abaixo carregam de propósito os campos que aqueles caminhos
  gravavam (`coord_lmap`, `coord_lotacoes`, `veredicto_localizacao`): se
  alguém voltar a lê-los, o teste cai.
*/

  const VEREDITO_ANTIGO = {
    estado: "validada",
    motivo: "duas_fontes_concordam",
    lat: -1,
    lon: -1,
    km: 120,
  };

  const dsei = {
    k: "TESTE",
    n: "Teste",
    lat: -9.6,
    lon: -35.7,
    sedeuf: "AL",
    ufs: ["AL"],
    sede_municipio: "Maceió",
    sede_coord_lotacoes: { lat: -5, lon: -5 },
    coord_fonte: "Lotações, Meios de Acesso/Polo Base",
    polos: [
      {
        n: "XITEI",
        lat: -9.91,
        lon: -36.01,
        uf: "AL",
        coord_lmap: { lat: -2, lon: -2 },
        coord_lotacoes: { lat: -3, lon: -3 },
        veredicto_localizacao: VEREDITO_ANTIGO,
        coord_validacao: "validada",
      },
      {
        n: "SOLTO",
        lat: -9.3,
        lon: -36.3,
        uf: "AL",
        coord_lmap: { lat: -4, lon: -4 },
        veredicto_localizacao: VEREDITO_ANTIGO,
      },
      {
        n: "UBSI ALDEIA",
        lat: -10.1,
        lon: -36.4,
        uf: "AL",
        tipo: "unidade",
        municipio: "PORTO REAL",
        coord_lotacoes: { lat: -6, lon: -6 },
      },
      {
        n: "CASAI AL/SE",
        lat: -9.62,
        lon: -35.73,
        uf: "AL",
        tipo: "casai",
        municipio: "MACEIO",
      },
    ],
  };

  /* As CASAIs nacionais do SIGEPSI (localização 131). */
  const casaisDoSigepsi = [
    ["CASAI DF", "131", -15.75, -47.71, "BRASILIA", "DF"],
  ];

  const TEXTO_DE_VALIDACAO =
    /valida|apurad|confirmad|discorda|em valida|fonte|verific/i;

  const textos = (conteudo) =>
    [conteudo?.titulo, ...(conteudo?.linhas || []), conteudo?.nota]
      .filter(Boolean)
      .join("\n");

  describe("a coordenada desenhada é exatamente a do SIGEPSI", () => {
    const registros = registrosDoDsei(dsei);
    const porNome = (trecho) => registros.find((r) => r.name.includes(trecho));

    it("polo: a posição do SIGEPSI, sem veredito nem coord_lmap", () => {
      const xitei = porNome("XITEI");
      expect([xitei.lat, xitei.lon]).toEqual([-9.91, -36.01]);
    });

    it("outro polo: a posição do SIGEPSI", () => {
      const solto = porNome("SOLTO");
      expect([solto.lat, solto.lon]).toEqual([-9.3, -36.3]);
    });

    it("UBSI e CASAI do DSEI: a coordenada do SIGEPSI, não a da planilha", () => {
      const ubsi = porNome("ALDEIA");
      expect([ubsi.lat, ubsi.lon]).toEqual([-10.1, -36.4]);
      const casai = porNome("CASAI");
      expect([casai.lat, casai.lon]).toEqual([-9.62, -35.73]);
    });

    it("só desenha o que veio do SIGEPSI", () => {
      expect(registros.map((r) => r.name).sort()).toEqual(
        ["CASAI AL/SE", "SOLTO", "UBSI ALDEIA", "XITEI"].sort(),
      );
      expect(registros.some((r) => "veredicto" in r)).toBe(false);
    });

    it("sede e bolha do DSEI usam a lat/lon da sede (do SIGEPSI)", () => {
      const sede = registroDaSede(dsei);
      expect([sede.lat, sede.lon]).toEqual([-9.6, -35.7]);
      const [bolha] = bolhasDosDsei({ dseis: [dsei] });
      expect([bolha.lat, bolha.lon]).toEqual([-9.6, -35.7]);
    });

    it("CASAI nacional: a coordenada do SIGEPSI", () => {
      const [casai] = casaisNacionais({ nac: casaisDoSigepsi });
      expect([casai.lat, casai.lon]).toEqual([-15.75, -47.71]);
    });
  });

  describe("popups e dicas sem texto de validação", () => {
    it("unidade: nome, tipo e município/UF — e nada mais", () => {
      const classificados = classificarRegistros(registrosDoDsei(dsei), dsei);
      for (const registro of classificados) {
        const popup = popupDoRegistro(registro);
        expect(popup.nota).toBeUndefined();
        expect(textos(popup)).not.toMatch(TEXTO_DE_VALIDACAO);
        expect(textos(dicaDoRegistro(registro, dsei))).not.toMatch(
          TEXTO_DE_VALIDACAO,
        );
      }
      const ubsi = classificados.find((r) => r.name === "UBSI ALDEIA");
      expect(popupDoRegistro(ubsi)).toEqual({
        titulo: "UBSI",
        linhas: ["UBSI ALDEIA", "PORTO REAL – AL"],
      });
    });

    it("sede, bolha e CASAI nacional também", () => {
      expect(textos(popupDaSede(dsei))).not.toMatch(TEXTO_DE_VALIDACAO);
      const [bolha] = bolhasDosDsei({ dseis: [dsei] });
      expect(textos(dicaDaBolha(bolha))).not.toMatch(TEXTO_DE_VALIDACAO);
      const [casai] = casaisNacionais({ nac: casaisDoSigepsi });
      expect(textos(popupDaCasaiNacional(casai))).not.toMatch(
        TEXTO_DE_VALIDACAO,
      );
      expect(textos(dicaDaCasaiNacional(casai))).not.toMatch(
        TEXTO_DE_VALIDACAO,
      );
    });
  });

  describe("a planilha de Lotações e os vereditos não voltam", () => {
    const arquivosDe = (pasta) =>
      readdirSync(pasta, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? arquivosDe(join(pasta, e.name))
          : /\.(js|jsx|mjs)$/.test(e.name)
            ? [join(pasta, e.name)]
            : [],
      );

    it("nenhum código do app importa o transporte ou os vereditos", () => {
      const proibidos =
        /lotacoes-geograficas|localizacoes-validadas|forca-do-veredito/;
      const culpados = arquivosDe("src").filter((f) =>
        proibidos.test(readFileSync(f, "utf8")),
      );
      expect(culpados).toEqual([]);
    });

    it("os dados da planilha e dos vereditos saíram de public/data", () => {
      expect(
        readdirSync("public/data").filter((f) =>
          /^lotacoes-geograficas|^localizacoes-validadas/.test(f),
        ),
      ).toEqual([]);
      expect(existsSync("src/modules/lotacoes-geograficas-transport.js")).toBe(
        false,
      );
    });
  });
});

bloco("cor-da-terra-indigena", () => {
  /*
  O VERDE DA FUNAI DESAPARECIA DENTRO DA FLORESTA

  A camada tinha sido alinhada pelo verde que a própria Funai publica. Medido
  no raster dela, esse verde é #4daf4a — hsl(118, 41%, 49%), verde de folha.
  Sobre imagem de satélite ele some na vegetação, que é onde quase toda a terra
  indígena está: a cor certa da fonte era a cor errada do mapa.

  Duas coisas desenham a mesma camada. Abaixo do zoom 7 é o raster WMS da
  Funai, que vem pronto e só muda com um filtro CSS; a partir dali é o vetorial,
  que muda numa constante. Se as duas não derem exatamente a mesma cor, a
  camada troca de cor ao cruzar o zoom 7.

  Estes casos guardam essa igualdade — e ela não se verifica por leitura, porque
  `hue-rotate` do CSS não roda a matiz de HSL. É uma aproximação linear em RGB,
  definida na especificação de filtros, e o resultado tem de ser calculado.
*/
  const modulo = [
    "src/modules/indigenous-territories-layer.ts",
    ...readdirSync("src/lib/mapas/terras-indigenas").map(
      (nome) => `src/lib/mapas/terras-indigenas/${nome}`,
    ),
  ]
    .map((caminho) => readFileSync(caminho, "utf8"))
    .join("\n");
  const css = readFileSync(
    "src/styles/indigenous-territories-layer.css",
    "utf8",
  );
  // Os tokens --terra-* (tokens.css) e a legenda do mapa da Saúde Indígena.
  const cssLegenda = [
    "src/styles/tokens.css",
    "src/modulos/mapa-saude-indigena/mapa-saude-indigena.css",
  ]
    .map((caminho) => readFileSync(caminho, "utf8"))
    .join(" ");

  const VERDE_DA_FUNAI = [0x4d, 0xaf, 0x4a];
  const VEGETACAO = "#add19e";

  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const aplicar = (m, [r, g, b]) =>
    m.map((l) => clamp(l[0] * r + l[1] * g + l[2] * b));

  function hueRotate(cor, graus) {
    const a = (graus * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return aplicar(
      [
        [
          0.213 + c * 0.787 - s * 0.213,
          0.715 - c * 0.715 - s * 0.715,
          0.072 - c * 0.072 + s * 0.928,
        ],
        [
          0.213 - c * 0.213 + s * 0.143,
          0.715 + c * 0.285 + s * 0.14,
          0.072 - c * 0.072 - s * 0.283,
        ],
        [
          0.213 - c * 0.213 - s * 0.787,
          0.715 - c * 0.715 + s * 0.715,
          0.072 + c * 0.928 + s * 0.072,
        ],
      ],
      cor,
    );
  }

  const saturate = (cor, k) =>
    aplicar(
      [
        [0.213 + 0.787 * k, 0.715 - 0.715 * k, 0.072 - 0.072 * k],
        [0.213 - 0.213 * k, 0.715 + 0.285 * k, 0.072 - 0.072 * k],
        [0.213 - 0.213 * k, 0.715 - 0.715 * k, 0.072 + 0.928 * k],
      ],
      cor,
    );

  const brightness = (cor, k) => cor.map((v) => clamp(v * k));
  const hex = (cor) =>
    "#" + cor.map((v) => v.toString(16).padStart(2, "0")).join("");

  const canal = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

  /*
  DIFERENÇA PERCEPTUAL, E NÃO SÓ MATIZ

  O critério antigo media a distância apenas pelo matiz, e exigia 90° do verde
  e 60° do azul. Feita a conta, as únicas cores que passavam eram rosa, magenta
  e vermelho — o teste escolhia a cor antes de alguém a escolher, e o Brasil
  ficou rosa. Matiz sozinho não diz se duas cores se confundem: o marrom tem
  matiz de laranja e ninguém o toma por verde-claro.

  ΔE (CIE76, em CIELAB) conta matiz, claridade e saturação juntos. ΔE 2,3 é o
  limiar em que a diferença começa a ser percebida; acima de 20 são cores com
  nomes diferentes.
*/
  function lab(h) {
    const [r, g, b] = canal(h).map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
    const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  }
  const deltaE = (a, b) => {
    const [l1, a1, b1] = lab(a);
    const [l2, a2, b2] = lab(b);
    return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
  };

  // Razão de contraste da WCAG, para o traço contra o fundo do mapa.
  const luminancia = (h) => {
    const [r, g, b] = canal(h).map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contraste = (a, b) => {
    const [claro, escuro] = [luminancia(a), luminancia(b)].sort(
      (p, q) => q - p,
    );
    return (claro + 0.05) / (escuro + 0.05);
  };

  const FUNDO_DO_MAPA = "#f2efe9";
  const ROSA_QUE_SAIU = "#e030a6";
  const AZUL_DO_DSEI = "#2563eb";
  const MARCADORES = {
    "polo base": "#e49a1b",
    CASAI: "#d92d3a",
    UBSI: "#6d28d9",
    "unidade de saúde": "#0d8192",
  };

  const corDeclarada = (nome) =>
    modulo.match(new RegExp(`const ${nome} = "(#[0-9a-f]{6})"`))?.[1] || "";
  const filtroDeclarado = () =>
    modulo.match(/const FILTRO_DO_RASTER = "([^"]+)"/)?.[1] || "";

  describe("o raster e o vetorial desenham a mesma cor", () => {
    it("o filtro leva o verde da Funai exatamente à cor do vetorial", () => {
      const filtro = filtroDeclarado();
      const graus = Number(filtro.match(/hue-rotate\(([-\d.]+)deg\)/)?.[1]);
      const sat = Number(filtro.match(/saturate\(([\d.]+)\)/)?.[1]);
      const bri = Number(filtro.match(/brightness\(([\d.]+)\)/)?.[1]);

      expect(Number.isFinite(graus), `filtro ilegível: ${filtro}`).toBe(true);
      expect(Number.isFinite(sat)).toBe(true);
      expect(Number.isFinite(bri)).toBe(true);

      const resultado = brightness(
        saturate(hueRotate(VERDE_DA_FUNAI, graus), sat),
        bri,
      );
      expect(hex(resultado)).toBe(corDeclarada("COR_DA_TERRA"));
    });

    it("o filtro é aplicado ao painel do raster", () => {
      expect(modulo).toContain("rasterPane.style.filter = FILTRO_DO_RASTER");
    });
  });

  describe("a cor sai de cima da vegetação", () => {
    it("o traço não se confunde com o verde do mapa", () => {
      expect(
        deltaE(corDeclarada("COR_DA_TERRA"), VEGETACAO),
        "o traço voltou para perto do verde",
      ).toBeGreaterThan(40);
    });

    it("nem o traço da terra em processo", () => {
      expect(
        deltaE(corDeclarada("COR_EM_PROCESSO"), VEGETACAO),
      ).toBeGreaterThan(40);
    });

    // O fundo é desenhado com pouca opacidade; basta ser outra cor.
    it("o preenchimento também é outra cor", () => {
      expect(
        deltaE(corDeclarada("PREENCHIMENTO_DA_TERRA"), VEGETACAO),
      ).toBeGreaterThan(20);
    });

    /*
    O azul é da camada de DSEI, que se desenha por baixo desta. Duas camadas
    com cor vizinha no mesmo mapa leem-se como uma só.
  */
    it("e não colide com o azul do DSEI", () => {
      expect(
        deltaE(corDeclarada("COR_DA_TERRA"), AZUL_DO_DSEI),
      ).toBeGreaterThan(40);
      expect(
        deltaE(corDeclarada("COR_EM_PROCESSO"), AZUL_DO_DSEI),
      ).toBeGreaterThan(40);
    });

    it("o verde da Funai não volta como cor do vetorial", () => {
      expect(modulo).not.toContain('"#4daf4a"');
      expect(modulo).not.toContain('"#0b6b5f"');
      expect(modulo).not.toContain('"#14b8a6"');
    });
  });

  /*
  "ESTÁ TUDO ROSA"

  Com 665 terras cheias de magenta, o Brasil inteiro ficava rosa. O pedido foi
  mudar a cor; estes casos impedem que ela volte por outro caminho.
*/
  describe("o rosa saiu", () => {
    it("nenhuma das cores da terra é rosa", () => {
      for (const nome of [
        "COR_DA_TERRA",
        "PREENCHIMENTO_DA_TERRA",
        "COR_EM_PROCESSO",
      ]) {
        expect(
          deltaE(corDeclarada(nome), ROSA_QUE_SAIU),
          `${nome} voltou para perto do rosa`,
        ).toBeGreaterThan(40);
      }
    });

    it("nem sobra rosa no CSS da camada e das legendas", () => {
      for (const texto of [css, cssLegenda]) {
        expect(texto).not.toContain("224, 48, 166");
        expect(texto).not.toContain("244, 114, 208");
        expect(texto).not.toContain("#a3116f");
      }
    });
  });

  /*
  A terra é contexto; os marcadores são o dado. A cor da terra não pode ser
  confundida com a de nenhum tipo de unidade — senão um polo base dentro de
  uma terra some dentro dela.
*/
  describe("a terra não disputa com os marcadores", () => {
    for (const [nome, cor] of Object.entries(MARCADORES)) {
      it(`fica longe da cor de ${nome}`, () => {
        expect(deltaE(corDeclarada("COR_DA_TERRA"), cor)).toBeGreaterThan(25);
        expect(deltaE(corDeclarada("COR_EM_PROCESSO"), cor)).toBeGreaterThan(
          25,
        );
      });
    }
  });

  // WCAG 1.4.11: componente gráfico que carrega informação pede 3:1.
  describe("o traço lê-se contra o mapa", () => {
    it("as duas fases passam de 3:1 contra o fundo do mapa", () => {
      expect(
        contraste(corDeclarada("COR_DA_TERRA"), FUNDO_DO_MAPA),
      ).toBeGreaterThanOrEqual(3);
      expect(
        contraste(corDeclarada("COR_EM_PROCESSO"), FUNDO_DO_MAPA),
      ).toBeGreaterThanOrEqual(3);
    });
  });

  /*
  Legenda que não descreve o desenho é pior do que legenda nenhuma: ensina a
  procurar a coisa errada. Foi assim que o quadrado ficou vermelho enquanto o
  mapa desenhava verde, e depois magenta enquanto o mapa mudava.

  As amostras leem de três tokens; os tokens têm de ser as constantes da camada.
*/
  describe("os quadrados da legenda acompanham", () => {
    const token = (nome) =>
      cssLegenda.match(new RegExp(`--${nome}:\\s*(#[0-9a-f]{6})`))?.[1] || "";

    it("os tokens são as constantes da camada", () => {
      expect(token("terra-definitiva")).toBe(corDeclarada("COR_DA_TERRA"));
      expect(token("terra-fundo")).toBe(corDeclarada("PREENCHIMENTO_DA_TERRA"));
      expect(token("terra-em-processo")).toBe(corDeclarada("COR_EM_PROCESSO"));
    });

    it("o botão da camada usa os tokens", () => {
      expect(css).toContain("border: 2px solid var(--terra-definitiva)");
      expect(css).not.toContain("rgba(13, 148, 136, 0.92)");
    });

    it("cada fase tem a sua amostra, com o traço da sua fase", () => {
      expect(cssLegenda).toContain("border: 2px solid var(--terra-definitiva)");
      expect(cssLegenda).toContain(
        "border: 2px dashed var(--terra-em-processo)",
      );
      expect(cssLegenda).toContain(".mapa-si-terra-fase__amostra--em_estudo");
    });
  });
});

bloco("criticos-da-visao-geral", () => {
  /*
  O crítico calculado da Visão geral: cada motivo isolado, com os casos da
  leitura de 02/10/2026 (analise.md): 97/2026 Maranhão com etapa perto,
  108/2026 em andamento sem inscritos, 81/2026 concluído com 1 de 83,
  79/2026 concluído com 0 de 50, risco manual "Baixo" em tudo.
*/

  const HOJE = "2026-10-02";
  const aberto = (extra = {}) => ({
    status: "Em andamento",
    risco: "Baixo",
    cronograma_automatico: true,
    etapa: "Entrevistas",
    inscritos: 100,
    vagas_total: 10,
    contratados: 0,
    data_fim: "2026-12-01",
    ...extra,
  });
  const codigos = (linha, opcoes = {}) =>
    motivosDeAtencao(linha, { hoje: HOJE, ...opcoes }).map((m) => m.codigo);

  describe("cada motivo", () => {
    it("etapa chegando (hoje, amanhã, em até 3 dias) é agenda, não crítico", () => {
      for (const dias of [0, 1, 3, 5, null])
        expect(codigos(aberto({ cronograma_dias_para_proxima: dias }))).toEqual(
          [],
        );
    });

    it("atrasada: o fim do cronograma passou e o edital não concluiu", () => {
      expect(
        motivosDeAtencao(aberto({ data_fim: "2026-09-27" }), { hoje: HOJE }),
      ).toEqual([
        {
          codigo: "atrasada",
          rotulo: "Etapa atrasada há 5 dias",
          tom: "perigo",
        },
      ]);
      expect(codigos(aberto({ data_fim: "2026-10-01" }))).toEqual(["atrasada"]);
      expect(
        motivosDeAtencao(aberto({ data_fim: "2026-10-01" }), { hoje: HOJE })[0]
          .rotulo,
      ).toBe("Etapa atrasada há 1 dia");
      expect(codigos(aberto({ data_fim: HOJE }))).toEqual([]);
    });

    it("parado: sem etapa em curso e sem mudança de etapa há 15 dias ou mais", () => {
      const etapas = [
        {
          atividade: "Inscrições",
          data_inicio: "2026-08-01",
          data_fim: "2026-08-20",
        },
        {
          atividade: "Análise",
          data_inicio: "2026-08-21",
          data_fim: "2026-09-16",
        },
        {
          atividade: "Entrevistas",
          data_inicio: "2026-10-20",
          data_fim: "2026-10-30",
        },
      ];
      // Última mudança: 17/09 (dia seguinte ao fim da análise) → 15 dias.
      expect(ultimaMudancaDeEtapa(etapas, HOJE)).toBe(
        diaDoCalendario("2026-09-17"),
      );
      expect(temEtapaEmCurso(etapas, HOJE)).toBe(false);
      expect(
        motivosDeAtencao(aberto({ etapa: "Aguardando: Entrevistas" }), {
          hoje: HOJE,
          etapas,
        }),
      ).toEqual([
        { codigo: "parado", rotulo: "Parado há 15 dias", tom: "alerta" },
      ]);
      // 14 dias ainda não.
      expect(
        codigos(aberto({ etapa: "Aguardando: Entrevistas" }), {
          hoje: "2026-10-01",
          etapas,
        }),
      ).toEqual([]);
      // Etapa em curso não é parado, por mais longa que seja.
      const longa = [
        {
          atividade: "Análise",
          data_inicio: "2026-08-01",
          data_fim: "2026-11-30",
        },
      ];
      expect(codigos(aberto(), { etapas: longa })).toEqual([]);
      // Sem as etapas (banco sem a função), não é avaliado.
      expect(codigos(aberto({ etapa: "Aguardando: Entrevistas" }))).toEqual([]);
    });

    it("sem inscritos: em andamento, depois das inscrições, 0 inscritos", () => {
      // 108/2026: em andamento sem Seleção.
      expect(
        motivosDeAtencao(
          aberto({ etapa: "Análise Curricular", inscritos: 0 }),
          {
            hoje: HOJE,
          },
        ),
      ).toEqual([
        { codigo: "sem_inscritos", rotulo: "Sem inscritos", tom: "alerta" },
      ]);
      // Inscritos nulo = a fonte do funil não tem o número (só as análises): não é zero.
      expect(
        codigos(aberto({ etapa: "Análise Curricular", inscritos: null })),
      ).toEqual([]);
      // Ainda nas inscrições (ou antes), não.
      expect(
        codigos(aberto({ etapa: "Período de inscrição", inscritos: 0 })),
      ).toEqual([]);
      expect(
        codigos(
          aberto({
            status: "Planejado",
            etapa: "Aguardando: Edital",
            inscritos: 0,
          }),
        ),
      ).toEqual([]);
    });

    it("contratação baixa: concluído com menos de 50% das vagas imediatas contratadas", () => {
      // 81/2026: 1 de 83.
      expect(
        motivosDeAtencao(
          { status: "Concluído", vagas_total: 83, contratados: 1 },
          { hoje: HOJE },
        ),
      ).toEqual([
        {
          codigo: "contratacao_baixa",
          rotulo: "Contratação abaixo de 50%",
          tom: "alerta",
        },
      ]);
      // 79/2026: 0 de 50.
      expect(
        codigos({ status: "Concluído", vagas_total: 50, contratados: 0 }),
      ).toEqual(["contratacao_baixa"]);
      // Metade ou mais, não; vagas 0 (só cadastro reserva), não.
      expect(
        codigos({ status: "Concluído", vagas_total: 10, contratados: 5 }),
      ).toEqual([]);
      expect(
        codigos({ status: "Concluído", vagas_total: 0, contratados: 22 }),
      ).toEqual([]);
      // CR não ajuda as imediatas: 130 vagas, 567 contratados é 100%.
      expect(
        codigos({ status: "Concluído", vagas_total: 130, contratados: 567 }),
      ).toEqual([]);
    });
  });

  describe("regras gerais", () => {
    it("o risco manual não entra; cancelado nunca é crítico", () => {
      expect(codigos(aberto({ risco: "Alto" }))).toEqual([]);
      expect(
        codigos({
          status: "Cancelado",
          data_fim: "2026-01-01",
          cronograma_dias_para_proxima: 1,
          inscritos: 0,
        }),
      ).toEqual([]);
    });

    it("vários motivos, do mais grave ao menos grave; a gravidade ordena a tabela", () => {
      const motivos = motivosDeAtencao(
        aberto({
          etapa: "Análise Curricular",
          inscritos: 0,
          data_fim: "2026-09-30",
          cronograma_dias_para_proxima: 2,
        }),
        { hoje: HOJE },
      );
      expect(motivos.map((m) => m.codigo)).toEqual([
        "atrasada",
        "sem_inscritos",
      ]);
      expect(gravidade(motivos)).toBe(1);
      expect(gravidade([])).toBe(99);
    });

    it("os limites são configuráveis", () => {
      expect(LIMITES_DO_CRITICO).toEqual({
        diasDoPrazo: 3,
        diasParado: 15,
        contratacaoMinima: 0.5,
      });
      const limites = { ...LIMITES_DO_CRITICO, contratacaoMinima: 0.8 };
      expect(
        motivosDeAtencao(
          { status: "Concluído", vagas_total: 10, contratados: 7 },
          { hoje: HOJE, limites },
        )[0].rotulo,
      ).toBe("Contratação abaixo de 80%");
    });
  });

  describe("sem `hoje` válido", () => {
    afterEach(() => vi.useRealTimers());
    const etapas = [
      {
        atividade: "Análise",
        data_inicio: "2026-08-21",
        data_fim: "2026-09-16",
      },
      {
        atividade: "Entrevistas",
        data_inicio: "2026-10-20",
        data_fim: "2026-10-30",
      },
    ];
    const linha = aberto({ etapa: "Aguardando: Entrevistas" });

    it("o crítico usa o dia de Brasília de agora: parado e atrasada ainda acendem", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-02T15:00:00Z"));
      for (const hoje of [undefined, "", "02/10/2026"]) {
        expect(
          motivosDeAtencao(linha, { hoje, etapas }).map((m) => m.codigo),
        ).toEqual(["parado"]);
        expect(
          motivosDeAtencao(aberto({ data_fim: "2026-09-30" }), { hoje }).map(
            (m) => m.codigo,
          ),
        ).toEqual(["atrasada"]);
      }
    });

    it("as contas das etapas não comparam com null", () => {
      expect(temEtapaEmCurso(etapas, null)).toBe(false);
      expect(ultimaMudancaDeEtapa(etapas, "sem data")).toBeNull();
      // Etapa que começa no dia 0 do calendário (1970-01-01): antes "em curso" sem hoje.
      expect(
        temEtapaEmCurso(
          [{ data_inicio: "1970-01-01", data_fim: "2999-12-31" }],
          undefined,
        ),
      ).toBe(false);
    });
  });
});

bloco("dados-do-mapa-saude-indigena", () => {
  describe("entrada geográfica da Saúde Indígena", () => {
    it("preserva códigos CNES e UF numéricos como texto utilizável", () => {
      const distrito = configuracaoDoMapa({
        dsei: [
          {
            k: "A",
            n: "Distrito A",
            sede_cnes: 123,
            sedeuf: 27,
            polos: [{ n: "Polo A", cnes: 456, uf: 27, lat: -12, lon: -50 }],
          },
        ],
      }).dsei[0];
      expect(distrito).toMatchObject({
        sede_cnes: "123",
        sedeuf: "27",
        polos: [{ cnes: "456", uf: "27" }],
      });
      expect(
        casaisNacionaisDoMapa([["CASAI A", 131, -12, -50, 12, 53]]),
      ).toEqual([["CASAI A", 131, -12, -50, "12", 53]]);
    });
    it("trata contêineres inválidos como listas vazias", () => {
      for (const valor of [
        null,
        [],
        true,
        12,
        "texto",
        { dsei: {}, rede: [], nac: false },
      ]) {
        expect(configuracaoDoMapa(valor).dsei).toEqual([]);
        expect(casaisNacionaisDoMapa(valor)).toEqual([]);
        expect(terrasDoMapa(valor)).toEqual([]);
      }
    });
    it("preserva campos e posições válidos sem modificar a fonte", () => {
      const distrito = {
        k: "A",
        n: "Distrito A",
        pop: "1200",
        lat: "-12",
        lon: -50,
        ufs: ["MT"],
        polos: [{ n: "Polo A", cod: 1, lat: -13, lon: -51 }],
        sede_endereco: "Rua A",
        extra: { oficial: true },
      };
      const origem = { dsei: [distrito] };
      expect(configuracaoDoMapa(origem)).toEqual(origem);
      expect(configuracaoDoMapa(origem).dsei[0]).not.toBe(distrito);
      expect(origem.dsei[0].polos).toHaveLength(1);
    });
    it("ignora registros inválidos e não desenha polos com posição ausente como zero", () => {
      const configuracao = configuracaoDoMapa({
        dsei: [
          null,
          {
            k: "A",
            n: "Distrito A",
            polos: [
              null,
              { n: "Sem posição", lat: [], lon: {} },
              { n: "Com posição", lat: -12, lon: -50 },
            ],
            ufs: {},
          },
        ],
      });
      const casais = casaisNacionaisDoMapa([
        null,
        ["CASAI A", "001", [], false],
      ]);
      expect(configuracao.dsei[0].polos[0]).toMatchObject({
        lat: null,
        lon: null,
      });
      expect(casais).toEqual([["CASAI A", "001", null, null, "", ""]]);
      expect(registrosDoDsei(configuracao.dsei[0]).map((r) => r.name)).toEqual([
        "Com posição",
      ]);
    });
    it("só permite enquadrar terras com caixa numérica finita", () => {
      expect(
        terrasDoMapa([
          null,
          {
            nome: "Terra A",
            povos: ["Povo A", {}],
            ufs: {},
            fase: {},
            caixa: { oeste: -50, leste: {}, sul: -12, norte: -10 },
          },
        ]),
      ).toEqual([
        { nome: "Terra A", povos: ["Povo A"], ufs: [], fase: "", caixa: null },
      ]);
    });
    it("mantém o namespace original e recusa uma API Leaflet incompleta", () => {
      const { L } = criarLeafletFalso();
      expect(leafletDoMapa(L)).toBe(L);
      expect(leafletDoMapa({ map() {} })).toBeNull();
      expect(leafletDoMapa(null)).toBeNull();
    });
  });
});

bloco("enquadramento-do-brasil", () => {
  /*
  O enquadramento do Brasil nos mapas da Visão geral (Saúde Indígena e
  Projetos). O print do usuário: num mapa de 640 px de altura o norte
  (Roraima, Amapá) saía cortado, com as bolhas da borda pela metade — o zoom
  estava preso em 4.5 e a folga era de 10 px.
*/

  const NORTE_DE_RORAIMA = BRASIL_BOUNDS[1][0];

  describe("a folga cobre o maior ponto do mapa", () => {
    it("raio da bolha + traço + 12 px; o ponto de Projetos usa a mesma bolha", () => {
      expect(RAIO_MAXIMO_NO_MAPA).toBeGreaterThanOrEqual(RAIO_DA_BOLHA);
      expect(FOLGA_DO_BRASIL).toBe(RAIO_MAXIMO_NO_MAPA + FOLGA_ALEM_DO_RAIO);
      expect(FOLGA_ALEM_DO_RAIO).toBe(12);
    });

    it("o ponto mais ao norte é Roraima (lat. 5.27)", () => {
      expect(NORTE_DE_RORAIMA).toBeCloseTo(5.27, 2);
    });

    it("projeta em Web Mercator como o Leaflet (azulejo de 256 px)", () => {
      expect(projetar([0, 0])).toEqual({ x: 128, y: 128 });
      const norte = projetar([NORTE_DE_RORAIMA, -60]);
      const sul = projetar([-33.75, -60]);
      expect(norte.y).toBeLessThan(128);
      expect(sul.y - norte.y).toBeCloseTo(29.27, 1);
    });
  });

  describe("o Brasil inteiro cabe na moldura", () => {
    it("o bug: a 4.5, num mapa de 640 px de altura, o norte sai cortado", () => {
      const sobra = sobraNaMoldura({ largura: 1100, altura: 640, zoom: 4.5 });
      expect(sobra.cima).toBeLessThan(0);
    });

    it("numa moldura baixa o zoom desce em quartos e Roraima fica a mais de um raio da borda", () => {
      for (const altura of [460, 520, 640, 700]) {
        const zoom = zoomQueCabe({ largura: 1100, altura });
        expect(zoom, `altura ${altura}`).toBeLessThan(ZOOM_NACIONAL);
        expect((zoom * 4) % 1, `altura ${altura}`).toBe(0);
        const sobra = sobraNaMoldura({ largura: 1100, altura, zoom });
        // O ponto mais ao norte fica com folga do raio da maior bolha.
        expect(sobra.cima, `altura ${altura}`).toBeGreaterThanOrEqual(
          RAIO_MAXIMO_NO_MAPA,
        );
        expect(sobra.baixo).toBeGreaterThanOrEqual(RAIO_MAXIMO_NO_MAPA);
        expect(sobra.esquerda).toBeGreaterThanOrEqual(RAIO_MAXIMO_NO_MAPA);
      }
    });

    it("a 640 px o zoom é 4.25, com a folga inteira em cima e embaixo", () => {
      const zoom = zoomQueCabe({ largura: 1100, altura: 640 });
      expect(zoom).toBe(4.25);
      expect(
        sobraNaMoldura({ largura: 1100, altura: 640, zoom }).cima,
      ).toBeGreaterThanOrEqual(FOLGA_DO_BRASIL);
    });

    it("moldura grande fica na escala nacional (4.5), sem passar dela", () => {
      expect(zoomQueCabe({ largura: 1600, altura: 900 })).toBe(ZOOM_NACIONAL);
      expect(
        sobraNaMoldura({ largura: 1600, altura: 900, zoom: ZOOM_NACIONAL })
          .cima,
      ).toBeGreaterThan(FOLGA_DO_BRASIL);
    });

    it("celular estreito: quem manda é a largura", () => {
      const zoom = zoomQueCabe({ largura: 360, altura: 400 });
      expect(zoom).toBeLessThan(3.5);
      expect(
        sobraNaMoldura({ largura: 360, altura: 400, zoom }).esquerda,
      ).toBeGreaterThanOrEqual(RAIO_MAXIMO_NO_MAPA);
    });

    it("moldura escondida (sem medida) devolve a escala nacional; nunca abaixo do mínimo", () => {
      expect(zoomQueCabe({ largura: 0, altura: 0 })).toBe(ZOOM_NACIONAL);
      expect(zoomQueCabe({ largura: 80, altura: 80 })).toBe(
        ZOOM_MINIMO_PARA_CABER,
      );
    });
  });

  describe("a guarda do mapa usa a regra", () => {
    const guarda = readFileSync(
      "src/modulos/mapa-saude-indigena/guarda-do-mapa.ts",
      "utf8",
    );

    it("folga do Brasil e zoom mínimo que cabe em todo enquadramento do país", () => {
      expect(guarda).toContain("zoomQueCabe(");
      expect(guarda).toContain("FOLGA_DO_BRASIL");
      expect(guarda).not.toContain("padding: [10, 10]");
      const fit = guarda.slice(
        guarda.indexOf("const fitBrazilOverview"),
        guarda.indexOf('map.on("resize"'),
      );
      expect(fit).toContain("liberarZoomParaCaber(viewBounds, folgaDoBrasil)");
    });
  });

  describe("altura do mapa da Saúde Indígena", () => {
    /* Regressão de 02/10: a altura caiu para clamp(440px, 65vh, 640px) e a régua
     voltou de 500 km para 1000 km. Até a altura máxima, o Brasil cabe inteiro
     no zoom nacional. */
    it("a altura máxima deixa o Brasil inteiro no zoom nacional (≈ 500 km)", () => {
      const css = readFileSync(
        "src/modulos/mapa-saude-indigena/mapa-saude-indigena.css",
        "utf8",
      );
      const [, minimo, maximo] =
        css.match(/--mapa-si-altura:\s*clamp\((\d+)px,[^,]+,\s*(\d+)px\)/) ||
        [];
      expect(Number(minimo)).toBeGreaterThanOrEqual(560);
      expect(Number(maximo)).toBeGreaterThanOrEqual(780);
      expect(zoomQueCabe({ largura: 1000, altura: Number(maximo) })).toBe(
        ZOOM_NACIONAL,
      );
    });
  });

  /*
  A regra comum de enquadramento dos dois mapas nacionais (Saúde Indígena e
  Projetos): sem filtro, o Brasil; com filtro, o ponto (zoom 7) ou a caixa.
*/
  describe("o enquadramento do recorte", () => {
    it("sem filtro (ou sem ponto) é o Brasil; um ponto, zoom 7; vários, a caixa", () => {
      const pontos = [
        [2.82, -60.67],
        [-15.78, -47.93],
      ];
      expect(enquadramentoDoRecorte({ pontos }).modo).toBe("brasil");
      expect(
        enquadramentoDoRecorte({ pontos: [], filtroAtivo: true }).modo,
      ).toBe("brasil");
      expect(
        enquadramentoDoRecorte({
          pontos: pontos.slice(0, 1),
          filtroAtivo: true,
        }),
      ).toMatchObject({ modo: "ponto", pontos: [pontos[0]] });
      const caixa = enquadramentoDoRecorte({ pontos, filtroAtivo: true });
      expect(caixa.modo).toBe("caixa");
      // A chave só muda quando muda o que enquadrar.
      expect(caixa.chave).toBe(
        enquadramentoDoRecorte({ pontos: [...pontos], filtroAtivo: true })
          .chave,
      );
      expect(caixa.chave).not.toBe(enquadramentoDoRecorte({ pontos }).chave);
      // Ponto sem coordenada não entra.
      expect(
        enquadramentoDoRecorte({
          pontos: [pontos[0], null, [Number.NaN, 1]],
          filtroAtivo: true,
        }).modo,
      ).toBe("ponto");
      expect(ZOOM_DO_PONTO).toBe(7);
      expect(OPCOES_DA_CAIXA).toEqual({ padding: [60, 60], maxZoom: 7 });
    });
  });
});

bloco("enquadramento-do-mapa", () => {
  const guard = readFileSync(
    "src/modulos/mapa-saude-indigena/guarda-do-mapa.ts",
    "utf8",
  );
  const nacional = readFileSync(
    "src/modulos/mapa-saude-indigena/mapa-nacional.tsx",
    "utf8",
  );
  const doDsei = readFileSync(
    "src/modulos/mapa-saude-indigena/mapa-do-dsei.tsx",
    "utf8",
  );
  const cssDoModulo = readFileSync(
    "src/modulos/mapa-saude-indigena/mapa-saude-indigena.css",
    "utf8",
  );
  const css = readFileSync(
    "src/modulos/mapa-de-projetos/mapa-de-projetos.css",
    "utf8",
  );
  const projetosJsx = readFileSync(
    "src/modulos/mapa-de-projetos/mapa-de-projetos.tsx",
    "utf8",
  );
  // A moldura, o topo e a lista comuns aos dois mapas nacionais.
  const painelComum = readFileSync(
    "src/modulos/mapa-saude-indigena/painel-do-mapa.tsx",
    "utf8",
  );

  const semComentarios = (fonte) =>
    fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  /*
  A bandeira de visão geral estava sempre falsa.

  O `fitBounds` do Leaflet termina chamando `this.setView(...)`, que aqui é o
  `setGuardedView` — e ele zera `__agsusOverviewMode` para detectar quando a
  pessoa move o mapa. Gravando a bandeira **antes** do fit, todo enquadramento a
  ligava e o próprio enquadramento a desligava em seguida.

  Consequência: `emOverview()` nunca era verdadeiro, o `ResizeObserver` se
  desconectava na primeira observação e o mapa jamais voltava a enquadrar depois
  de o card mudar de largura. Medido no navegador antes da correção: as três
  medições saíam com `overview=false` e bounds idênticos entre elas.
*/
  describe("a bandeira de visão geral sobrevive ao próprio enquadramento", () => {
    const posicaoDaEscrita = (nomeDaFuncao, fim) => {
      const corpo = guard.slice(
        guard.indexOf(nomeDaFuncao),
        guard.indexOf(fim),
      );
      return {
        escrita: corpo.indexOf("__agsusOverviewMode = "),
        fit: corpo.search(/original(Fit|FlyTo)Bounds\(/),
        corpo,
      };
    };

    it("fitBounds grava a bandeira depois de enquadrar", () => {
      const { escrita, fit } = posicaoDaEscrita(
        "function fitGuardedBounds",
        "if (originalFlyToBounds)",
      );
      expect(fit).toBeGreaterThan(-1);
      expect(escrita).toBeGreaterThan(fit);
    });

    it("fitBrazilOverview grava a bandeira depois de enquadrar", () => {
      const { escrita, fit } = posicaoDaEscrita(
        "const fitBrazilOverview",
        "map.whenReady",
      );
      expect(fit).toBeGreaterThan(-1);
      expect(escrita).toBeGreaterThan(fit);
    });

    /*
    `flyToBounds` anima: o `setView` interno acontece depois do retorno, então
    a gravação é adiada em vez de simplesmente reordenada.
  */
    it("flyToBounds adia a gravação para depois da animação", () => {
      const corpo = guard.slice(
        guard.indexOf("function flyToGuardedBounds"),
        guard.indexOf("if (originalFlyTo)"),
      );
      expect(corpo).toMatch(
        /setTimeout\(\s*\(\)\s*=>\s*\{\s*map\.__agsusOverviewMode = overview;/,
      );
    });

    it("setView continua desligando a bandeira, que é o seu papel", () => {
      const corpo = guard.slice(
        guard.indexOf("function setGuardedView"),
        guard.indexOf("if (originalPanTo)"),
      );
      expect(corpo).toContain("map.__agsusOverviewMode = false;");
    });
  });

  /*
  O `max-width: altura * 1.25` que vivia aqui encolhia o `#detailMap` dentro de
  um card que continuava largo. Em produção, a 1920, sobravam cerca de 310px de
  card branco à esquerda do mapa — a faixa que motivou esta branch.

  Ele existia para esconder outro problema, que não era de CSS: o antigo `map-guard`
  recortava os azulejos a NAVEGACAO_BOUNDS (57.5° de longitude), e um card de
  1642x480 precisa de 171.6° para enquadrar os 39° de latitude do Brasil.
  Medido em `bench/prototipo-workspace.html`, contando os `<img>` no DOM:

    com o recorte, card a toda a largura ....... 33% da área com azulejo
    com o recorte, mapa a 696px + painel ....... 79%
    sem o recorte (só `noWrap`) ................ 100%

  Com o recorte fora, o container pode preencher o card: o enquadramento volta
  a ser trabalho do `fitBounds`, com padding e `maxZoom`, que é onde pertence.
*/
  describe("o container do mapa preenche o card", () => {
    it("nenhum dos mapas é limitado por max-width nem centrado", () => {
      /* Sem comentários: os cabeçalhos citam as regras que removeram. */
      for (const fonte of [css, cssDoModulo]) {
        const regras = semComentarios(fonte);
        expect(regras).not.toMatch(
          /#(detailMap|map|mapaDosProjetos)[^{]*\{[^}]*max-width:\s*calc/,
        );
        expect(regras).not.toContain("margin-inline: auto");
      }
    });

    it("o mapa de Projetos e os da Saúde Indígena ocupam a largura toda", () => {
      // O de Projetos usa a mesma moldura e o mesmo contêiner do nacional da Saúde Indígena.
      expect(projetosJsx).toContain("<MolduraDoMapa");
      expect(nacional).toContain("<MolduraDoMapa");
      expect(painelComum).toContain('className="mapa-si-mapa"');
      expect(painelComum).toContain('className="mapa-si-moldura"');
      expect(css).not.toMatch(/.mapa-si-mapa|#mapaDosProjetos/);
      const modulo = cssDoModulo.slice(
        cssDoModulo.indexOf(".mapa-si-mapa {"),
        cssDoModulo.indexOf("}", cssDoModulo.indexOf(".mapa-si-mapa {")),
      );
      expect(modulo).toContain("width: 100%");
      expect(modulo).toContain("height: 100%");
    });

    it("não usa zoom nem transform para caber", () => {
      for (const fonte of [css, cssDoModulo]) {
        expect(fonte).not.toMatch(/\bzoom\s*:/);
        expect(fonte).not.toMatch(/transform:\s*scale\(/);
      }
    });
  });

  describe("as cores dos marcadores se separam do mapa", () => {
    const canal = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const linear = (v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    const luminancia = (h) => {
      const [r, g, b] = canal(h);
      return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
    };
    const contraste = (a, b) => {
      const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const matiz = (h) => {
      const [r, g, b] = canal(h).map((v) => v / 255);
      const mx = Math.max(r, g, b);
      const d = mx - Math.min(r, g, b);
      if (!d) return 0;
      const t =
        mx === r
          ? ((g - b) / d) % 6
          : mx === g
            ? (b - r) / d + 2
            : (r - g) / d + 4;
      return (t * 60 + 360) % 360;
    };
    const distanciaDeMatiz = (a, b) => {
      const d = Math.abs(matiz(a) - matiz(b));
      return Math.min(d, 360 - d);
    };

    const VEGETACAO = "#add19e";
    // A sede não tem matiz para comparar. Ver os dois casos no fim deste bloco.
    const CINZA_DA_SEDE = "#1f2937";
    const cores = TIPOS_DA_LEGENDA.map((tipo) => FORMAS[tipo].cor);

    it("o verde que se dissolvia na vegetação saiu", () => {
      expect(cores).not.toContain("#189b63");
      expect(cores).toContain("#6d28d9");
    });

    it("o UBSI passa do mínimo de 3:1 contra a vegetação", () => {
      expect(contraste("#6d28d9", VEGETACAO)).toBeGreaterThan(3);
      // O verde antigo não passava, e é por isso que ele saiu.
      expect(contraste("#189b63", VEGETACAO)).toBeLessThan(3);
    });

    it("nenhum marcador fica perto do matiz da vegetação", () => {
      for (const cor of cores) {
        expect(
          distanciaDeMatiz(cor, VEGETACAO),
          `${cor} está perto do verde do mapa`,
        ).toBeGreaterThan(60);
      }
    });

    /*
    O grafite da sede fica de fora desta conta, e não por conveniência: ele
    quase não tem croma, e distância de matiz entre um cinzento e uma cor não
    mede nada. O que o distingue é outra coisa — ser o único marcador sem cor —,
    e isso é medido no caso seguinte.
  */
    it("as quatro cores se distinguem entre si", () => {
      const coloridas = cores.filter((c) => c !== CINZA_DA_SEDE);
      expect(coloridas).toHaveLength(4);
      for (let i = 0; i < coloridas.length; i += 1) {
        for (let j = i + 1; j < coloridas.length; j += 1) {
          expect(
            distanciaDeMatiz(coloridas[i], coloridas[j]),
            `${coloridas[i]} e ${coloridas[j]} têm matizes próximos`,
          ).toBeGreaterThan(40);
        }
      }
    });

    /*
    Os quatro matizes existentes estão em 38°, 355°, 263° e 188°, com o par mais
    próximo a 43°. Encaixar um quinto sem colidir obrigaria a ir ao verde, que é
    onde a vegetação do mapa já está. A sede resolve isso não tendo cor.
  */
    it("a sede é o único marcador sem cor, e é assim que se distingue", () => {
      const croma = (hex) => {
        const [r, g, b] = [1, 3, 5].map((i) =>
          parseInt(hex.slice(i, i + 2), 16),
        );
        return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
      };
      expect(croma(CINZA_DA_SEDE)).toBeLessThan(0.1);
      for (const cor of cores.filter((c) => c !== CINZA_DA_SEDE)) {
        expect(croma(cor), `${cor} devia ser uma cor`).toBeGreaterThan(0.4);
      }
    });

    it("a cor da legenda e a do marcador continuam a mesma", () => {
      for (const tipo of TIPOS_DA_LEGENDA)
        expect(formaDoTipo(tipo).cor, tipo).toBe(FORMAS[tipo].cor);
    });
  });

  /*
  NENHUM DESENHO INVENTA COORDENADA.

  O selo dos DSEIs que partilham sede era posto com
  `layerPointToLatLng(centro.add(L.point(18, -18)))`. Converter 18px em graus dá
  1.88° na visão nacional — 209 km — e o selo dos dois distritos de Boa Vista
  (2.8563, -60.6527, Roraima) aparecia em 4.4209, -59.0849, dentro da Guiana.
  Medido na aplicação a 15/09/2026.

  O leque é a única exceção, e é uma exceção declarada: ele afasta em pixels
  mas desenha uma linha até à coordenada verdadeira, dizendo que aquilo é um
  chamamento e não um sítio.
*/
  describe("o mapa não inventa coordenadas", () => {
    // O leque dos mapas nacionais (Saúde Indígena e Projetos) mora no leaflet.js comum.
    const comum = readFileSync(
      "src/modulos/mapa-saude-indigena/leaflet.ts",
      "utf8",
    );
    const codigo =
      semComentarios(nacional) + semComentarios(doDsei) + semComentarios(comum);

    it("não cria selo numérico para DSEIs que compartilham sede", () => {
      expect(codigo).not.toContain("mapa-cluster--sede");
      expect(codigo).not.toContain("DSEIs com a mesma sede");
      expect(codigo).not.toContain("mapa-cluster");
    });

    it("todo deslocamento visual preserva uma linha até a coordenada real", () => {
      expect(codigo.match(/layerPointToLatLng/g) || []).toHaveLength(2);
      // Unidades do DSEI que caem a poucos pixels: leque com traço até o ponto.
      expect(semComentarios(doDsei)).toContain(
        "L.polyline([[grupo.lat, grupo.lon], destino]",
      );
      // Sedes no mesmo pixel (Boa Vista): leque com traço e o ponto real desenhado.
      const leque = semComentarios(comum);
      expect(semComentarios(nacional)).toContain("criarLeque(L, novo, dsei)");
      expect(leque).toContain("L.polyline([[lat, lon], destino]");
      expect(leque).toContain("L.circleMarker([lat, lon]");
    });
  });
});

bloco("fases-da-terra-indigena", () => {
  /*
  DOIS ACHADOS DA BANCADA (bench/, com o catálogo real)

  1. Depois de afinar os polígonos, o país continuava coberto: 410 das 665
     terras são pequenas demais para a escala nacional e viravam um círculo de
     8 px cada, com fundo a 45%. O recuo tem de valer também para eles.

  2. Oito terras têm polígono e fase "Em Estudo", e desenhavam-se com o traço
     cheio da regularizada.
*/
  describe("o que a bancada mostrou", () => {
    const mapaNoZoom = (zoom) => ({ getZoom: () => zoom });

    it("no país, o símbolo é um ponto pequeno", () => {
      expect(raioDoSimbolo(ZOOM_DO_PAIS - 1)).toBeLessThanOrEqual(3);
      expect(raioDoSimbolo(ZOOM_DO_PAIS + 1)).toBeGreaterThan(
        raioDoSimbolo(ZOOM_DO_PAIS - 1),
      );
      expect(raioDoSimbolo(undefined)).toBe(raioDoSimbolo(ZOOM_DO_PAIS + 1));
    });

    it("o ponto da definitiva é cheio e o da provisória é vazado", () => {
      const pais = mapaNoZoom(ZOOM_DO_PAIS - 1);
      expect(estiloDoSimbolo(pais, "definitiva").fillOpacity).toBeGreaterThan(
        0.5,
      );
      expect(estiloDoSimbolo(pais, "em_processo").fillOpacity).toBe(0);
      expect(estiloDoSimbolo(pais, "em_estudo").fillOpacity).toBe(0);
    });

    it("de perto, o símbolo da provisória continua tracejado", () => {
      const perto = mapaNoZoom(ZOOM_DO_PAIS + 3);
      expect(estiloDoSimbolo(perto, "em_processo").dashArray).toBeTruthy();
      expect(estiloDoSimbolo(perto, "definitiva").dashArray).toBeNull();
    });

    it("a terra em estudo com polígono desenha-se como provisória", () => {
      const estudo = estiloDaFase("em_estudo", false);
      expect(estudo.dashArray).toBeTruthy();
      expect(estudo.color).toBe(estiloDaFase("em_processo", false).color);
      expect(estudo.color).not.toBe(estiloDaFase("definitiva", false).color);
    });

    it("há mesmo terras em estudo com polígono no catálogo", () => {
      const catalogo = JSON.parse(
        readFileSync("public/data/terras-indigenas.json", "utf8"),
      );
      const emEstudo = catalogo.features.filter(
        (f) => faseDaTerra(f.properties) === "em_estudo",
      );
      expect(emEstudo.length).toBeGreaterThan(0);
    });
  });

  /*
  UMA TERRA HOMOLOGADA E UMA EM PROCESSO NÃO SÃO A MESMA COISA

  O mapa pintava as 665 com a mesma cor. Mas a fase é o estado jurídico da
  terra, e no catálogo da Funai elas repartem-se assim:

      494  Regularizada      limite definitivo, registrada em cartório
       17  Homologada        limite definitivo, homologado por decreto
       73  Declarada         limite definido; o processo continua
       45  Delimitada        idem
       28  Encaminhada RI    idem
        8  Em Estudo         sem limite definido

  Para quem planeia atendimento isso muda tudo: um limite que ainda pode mudar
  não é o mesmo que um limite que não muda mais.
*/
  describe("a que família pertence cada fase", () => {
    it("regularizada e homologada têm limite definitivo", () => {
      expect(faseDaTerra({ fase_ti: "Regularizada" })).toBe("definitiva");
      expect(faseDaTerra({ fase_ti: "Homologada" })).toBe("definitiva");
    });

    it("declarada, delimitada e encaminhada continuam em processo", () => {
      expect(faseDaTerra({ fase_ti: "Declarada" })).toBe("em_processo");
      expect(faseDaTerra({ fase_ti: "Delimitada" })).toBe("em_processo");
      expect(faseDaTerra({ fase_ti: "Encaminhada RI" })).toBe("em_processo");
    });

    it("em estudo é a terceira família, e tem desenho próprio", () => {
      expect(faseDaTerra({ fase_ti: "Em Estudo" })).toBe("em_estudo");
    });

    it("não se perde por acento nem por caixa", () => {
      expect(faseDaTerra({ fase_ti: "regularizada" })).toBe("definitiva");
      expect(faseDaTerra({ fase_ti: "ENCAMINHADA RI" })).toBe("em_processo");
    });

    /*
    Sem fase declarada desenha-se como definitiva. Dizer "ainda em processo"
    sobre uma terra que talvez esteja regularizada é afirmar mais do que se
    sabe, e na direção que pesa contra quem lá vive.
  */
    it("sem fase não se presume processo", () => {
      expect(faseDaTerra({})).toBe("desconhecida");
      expect(faseDaTerra(null)).toBe("desconhecida");
      expect(estiloDaFase("desconhecida", false).dashArray).toBeNull();
    });

    /*
    O contrário do caso de cima, e igualmente deliberado: só `Regularizada` e
    `Homologada` são definitivas por nome. Uma fase que a Funai venha a publicar
    — `Interditada`, por exemplo, que existe para povos isolados — entra como
    em processo. Errar para o lado de "ainda não é definitiva" é errar para o
    lado que não promete a ninguém um limite que não existe.
  */
    it("fase desconhecida entra como em processo, nunca como definitiva", () => {
      expect(faseDaTerra({ fase_ti: "Interditada" })).toBe("em_processo");
    });
  });

  describe("o desenho de cada família", () => {
    it("a definitiva é traço cheio", () => {
      expect(estiloDaFase("definitiva", false).dashArray).toBeNull();
    });

    /*
    Tracejado porque uma linha interrompida é como um limite provisório se
    desenha em cartografia desde sempre — e porque a diferença tem de ser
    visível também para quem não distingue as duas tonalidades de magenta.
  */
    it("a que está em processo é tracejada e mais clara", () => {
      const processo = estiloDaFase("em_processo", false);
      const definitiva = estiloDaFase("definitiva", false);
      expect(processo.dashArray).toBeTruthy();
      expect(processo.fillOpacity).toBeLessThan(definitiva.fillOpacity);
      expect(processo.color).not.toBe(definitiva.color);
    });

    it("sobre satélite as duas engrossam o traço e aliviam o preenchimento", () => {
      for (const fase of ["definitiva", "em_processo"]) {
        const comum = estiloDaFase(fase, false);
        const satelite = estiloDaFase(fase, true);
        expect(satelite.weight).toBeGreaterThanOrEqual(comum.weight);
        expect(satelite.fillOpacity).toBeLessThan(comum.fillOpacity);
      }
    });

    /*
    ERAM DUAS TONALIDADES DA MESMA COR, E TÊM DE SER DUAS CORES

    Este caso exigia o contrário — que as duas ficassem no mesmo matiz, a
    menos de 25° —, e as duas eram magenta, uma escura e outra clara. Quem
    olhava perguntava qual era qual. O pedido foi explícito: a terra em
    processo de homologação com OUTRA cor.

    ΔE acima de 25 é "cores com nomes diferentes" — marrom e terracota. O
    traço tracejado continua, para quem não distingue as duas.
  */
    it("são duas cores, e não duas tonalidades", () => {
      const lab = (hex) => {
        const [r, g, b] = [1, 3, 5].map((i) => {
          const c = parseInt(hex.slice(i, i + 2), 16) / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
        const x = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047);
        const y = f(r * 0.2126 + g * 0.7152 + b * 0.0722);
        const z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
        return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
      };
      const [a, b] = [
        estiloDaFase("definitiva", false).color,
        estiloDaFase("em_processo", false).color,
      ].map(lab);
      expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeGreaterThan(
        25,
      );
    });
  });

  /*
  O BRASIL INTEIRO NÃO É UM MAPA DE TERRAS

  Na visão nacional as 665 terras, cheias, cobriam o país. Abaixo do zoom do
  país elas recuam: traço fino, fundo quase transparente.
*/
  describe("na visão do país as terras recuam", () => {
    for (const fase of ["definitiva", "em_processo"]) {
      it(`a ${fase} afina o traço e quase apaga o fundo`, () => {
        const perto = estiloDaFase(fase, false, ZOOM_DO_PAIS + 2);
        const pais = estiloDaFase(fase, false, ZOOM_DO_PAIS - 1);
        expect(pais.weight).toBeLessThan(perto.weight);
        expect(pais.fillOpacity).toBeLessThan(perto.fillOpacity);
        expect(pais.fillOpacity).toBeLessThanOrEqual(0.12);
      });
    }

    it("sem zoom, vale o desenho de perto", () => {
      expect(estiloDaFase("definitiva", false)).toEqual(
        estiloDaFase("definitiva", false, ZOOM_DO_PAIS + 3),
      );
    });

    it("recuar não apaga a diferença entre as fases", () => {
      const pais = (fase) => estiloDaFase(fase, false, ZOOM_DO_PAIS - 1);
      expect(pais("definitiva").dashArray).toBeNull();
      expect(pais("em_processo").dashArray).toBeTruthy();
      expect(pais("em_processo").color).not.toBe(pais("definitiva").color);
    });

    it("a camada passa o zoom do mapa para o estilo", () => {
      const camada = [
        "src/modules/indigenous-territories-layer.ts",
        ...readdirSync("src/lib/mapas/terras-indigenas").map(
          (nome) => `src/lib/mapas/terras-indigenas/${nome}`,
        ),
      ]
        .map((caminho) => readFileSync(caminho, "utf8"))
        .join("\n");
      expect(camada).toContain("Number(map?.getZoom?.())");
    });
  });

  /*
  UM INTERRUPTOR POR FASE

  O pedido: esconder as terras já regularizadas e continuar a ver as que estão
  em delimitação. A legenda liga e desliga cada fase; esta função é o recorte.
*/
  describe("esconder uma fase", () => {
    const terra = (fase) => ({ properties: { fase_ti: fase } });
    const catalogo = [
      terra("Regularizada"),
      terra("Homologada"),
      terra("Delimitada"),
      terra("Declarada"),
      terra(""),
    ];

    it("sem nada escondido, fica tudo", () => {
      expect(terrasDasFasesVisiveis(catalogo, new Set())).toHaveLength(5);
    });

    it("esconder as definitivas deixa só as em processo", () => {
      const sobra = terrasDasFasesVisiveis(catalogo, new Set(["definitiva"]));
      expect(sobra.map((f) => f.properties.fase_ti)).toEqual([
        "Delimitada",
        "Declarada",
      ]);
    });

    /*
    A terra sem fase desenha-se como definitiva; esconder as definitivas tem de
    a levar junto, senão fica no mapa uma mancha que nenhum interruptor apaga.
  */
    it("a sem fase vai com as definitivas", () => {
      expect(faseDaLegenda("desconhecida")).toBe("definitiva");
      const sobra = terrasDasFasesVisiveis(catalogo, new Set(["definitiva"]));
      expect(sobra.some((f) => f.properties.fase_ti === "")).toBe(false);
    });

    it("esconder as em processo deixa só as definitivas", () => {
      expect(
        terrasDasFasesVisiveis(catalogo, new Set(["em_processo"])),
      ).toHaveLength(3);
    });

    it("aceita o que não é lista sem partir", () => {
      expect(terrasDasFasesVisiveis(null, new Set(["definitiva"]))).toEqual([]);
      expect(terrasDasFasesVisiveis(catalogo, null)).toHaveLength(5);
    });

    /*
    O que vem do armazenamento local não é confiável: pode ser de uma versão
    antiga, ou escrito à mão. Só se esconde o que a legenda oferece.
  */
    it("do armazenamento só se aceita fase que a legenda conhece", () => {
      expect([...lerFasesOcultas('["definitiva","inventada"]')]).toEqual([
        "definitiva",
      ]);
      expect(lerFasesOcultas("não é json").size).toBe(0);
      expect(lerFasesOcultas(null).size).toBe(0);
      expect(lerFasesOcultas('{"definitiva":true}').size).toBe(0);
    });

    it("a legenda oferece as três fases, com nome", () => {
      expect(FASES_DAS_TERRAS.map((f) => f.fase)).toEqual([
        "definitiva",
        "em_processo",
        "em_estudo",
      ]);
      for (const f of FASES_DAS_TERRAS) expect(f.rotulo).toBeTruthy();
    });
  });

  describe("contra o catálogo real", () => {
    const catalogo = JSON.parse(
      readFileSync("public/data/terras-indigenas.json", "utf8"),
    );

    it("as três famílias cobrem todas as terras publicadas", () => {
      const por = new Map();
      for (const f of catalogo.features) {
        const k = faseDaTerra(f.properties);
        por.set(k, (por.get(k) || 0) + 1);
      }
      expect(por.get("desconhecida") ?? 0).toBe(0);
      expect(por.get("definitiva")).toBeGreaterThan(400);
      expect(por.get("em_processo")).toBeGreaterThan(100);
    });
  });

  /*
  Legenda que descreve menos do que o mapa mostra ensina a procurar a coisa
  errada. Foi assim que o quadrado ficou vermelho enquanto o mapa desenhava
  verde, e depois verde enquanto o mapa desenhava magenta.
*/
  describe("a legenda descreve as três", () => {
    const legenda = readFileSync(
      "src/modulos/mapa-saude-indigena/legenda.tsx",
      "utf8",
    );

    it("nomeia a homologada, a em processo e a em estudo", () => {
      const rotulos = FASES_DAS_TERRAS.map((f) => f.rotulo).join(" | ");
      expect(rotulos).toContain("Homologada ou regularizada");
      expect(rotulos).toContain("Em processo");
      expect(rotulos).toContain("Em estudo");
    });

    /*
    As amostras escritas à mão, em `style` inline, foram o que deixou a
    legenda magenta depois de o mapa mudar. Não voltam.
  */
    it("a legenda não escreve amostra de terra à mão: sai das fases da camada", () => {
      expect(legenda).not.toContain("#f9a8d4");
      expect(legenda).not.toContain("#e030a6");
      expect(legenda).toContain("FASES_DAS_TERRAS.map(");
    });
  });
});

bloco("fases-do-processo", () => {
  /*
  As fases fixas da Visão geral, lidas do texto livre do cronograma. Os textos
  são variantes reais (analise.md e prazo-do-recurso.ts): SI com 15 valores,
  Projetos com 12 para 12 editais, SEDE com duplicados por espaço final e um
  "zzzzz".
*/

  describe("o texto da atividade vira uma fase fixa", () => {
    it.each([
      ["Elaboração do Edital", "Edital"],
      ["Impugnação do Edital", "Edital"],
      ["Publicação do edital", "Edital"],
      ["Período de inscrição", "Inscrições"],
      ["Inscrições", "Inscrições"],
      ["Homologação das inscrições", "Inscrições"],
      ["Análise Curricular", "Análise curricular"],
      ["Análise documental e de títulos", "Análise curricular"],
      ["Resultado Preliminar", "Análise curricular"],
      ["Avaliação de Conhecimentos", "Análise curricular"],
      [
        "Resultado preliminar da análise curricular e abertura do prazo de recurso",
        "Recursos",
      ],
      ["Abertura do Prazo de Recurso", "Recursos"],
      ["Prazo para recursos das entrevistas", "Recursos"],
      ["Análise e resposta ao recurso", "Recursos"],
      ["Prazo de recurso do resultado final", "Recursos"],
      ["Entrevistas", "Entrevistas"],
      ["Convocação para entrevista", "Entrevistas"],
      ["Resultado preliminar das entrevistas", "Entrevistas"],
      ["Resposta aos Recursos e Resultado Final das Entrevistas", "Resultado"],
      ["Resultado final do Processo Seletivo", "Resultado"],
      ["Resultado final do processo seletivo ", "Resultado"],
      ["RESULTADO FINAL DO PROCESSO SELETIVO", "Resultado"],
      ["Homologação do resultado", "Resultado"],
      ["Convocação para admissão", "Contratação"],
      ["Contratação", "Contratação"],
      ["Exames admissionais e posse", "Contratação"],
      ["Aguardando: Entrevistas", "Entrevistas"],
      ["Aguardando: Período de inscrição", "Inscrições"],
      ["Cronograma pendente", "Sem cronograma"],
      ["zzzzz", "Outra"],
      ["Cronograma em andamento", "Outra"],
    ])("%s → %s", (texto, fase) => {
      expect(faseDaAtividade(texto)).toBe(fase);
    });

    it("vazio não tem fase", () => {
      expect(faseDaAtividade("  ")).toBeNull();
      expect(faseDaAtividade(null)).toBeNull();
    });
  });

  describe("a fase do edital", () => {
    it("o status manda: cancelado, concluído e planejado", () => {
      expect(
        faseDoEdital({
          status: "Cancelado",
          etapa: "Resultado final do Processo Seletivo",
        }),
      ).toBe("Cancelado");
      expect(faseDoEdital({ status: "Concluído", etapa: "Entrevistas" })).toBe(
        "Concluído",
      );
      expect(
        faseDoEdital({
          status: "Planejado",
          etapa: "Aguardando: Período de inscrição",
        }),
      ).toBe("Edital");
    });

    it("em andamento: a atividade de hoje, senão a etapa", () => {
      expect(
        faseDoEdital({
          status: "Em andamento",
          cronograma_atividade_atual: "Entrevistas",
          etapa: "Entrevistas",
        }),
      ).toBe("Entrevistas");
      expect(
        faseDoEdital({
          status: "Em andamento",
          etapa: "Aguardando: Entrevistas",
        }),
      ).toBe("Entrevistas");
      expect(faseDoEdital({ status: "Em andamento", etapa: "zzzzz" })).toBe(
        "Outra",
      );
      expect(faseDoEdital({ status: "Cronograma pendente", etapa: "" })).toBe(
        "Sem cronograma",
      );
    });

    it("ordem e tons fixos", () => {
      expect(FASES).toEqual([
        "Edital",
        "Inscrições",
        "Análise curricular",
        "Recursos",
        "Entrevistas",
        "Resultado",
        "Contratação",
        "Concluído",
      ]);
      expect(ORDEM_DAS_FASES.slice(-3)).toEqual([
        "Cancelado",
        "Sem cronograma",
        "Outra",
      ]);
      expect(tomDaFase("Concluído")).toBe("sucesso");
      expect(tomDaFase("Cancelado")).toBe("perigo");
      expect(tomDaFase("Outra")).toBe("neutro");
    });
  });
});

bloco("filtros-do-mapa", () => {
  const CAMPOS = ["unidade", "edital", "status", "risco"];
  const vazio = () => Object.fromEntries(CAMPOS.map((c) => [c, new Set()]));
  const chaveDsei = (linha) =>
    String(linha.unidade || "")
      .replace(/^DSEI\s+/i, "")
      .toUpperCase();

  const LINHAS = [
    {
      unidade: "DSEI Yanomami",
      edital: "01/2026",
      status: "Em Andamento",
      risco: "Alto",
      vagas_total: 10,
      vagas_ociosas: 4,
    },
    {
      unidade: "DSEI Yanomami",
      edital: "02/2026",
      status: "Concluído",
      risco: "Medio",
      vagas_total: 5,
      vagas_ociosas: 0,
    },
    {
      unidade: "DSEI Xingu",
      edital: "01/2026",
      status: "Em andamento",
      risco: "Médio",
      vagas_total: 3,
      vagas_ociosas: 1,
    },
    {
      unidade: "DSEI Xingu",
      edital: "03/2025",
      status: "Concluido",
      risco: "Baixo",
      vagas_total: 2,
      vagas_ociosas: 0,
    },
    {
      unidade: "DSEI Potiguara",
      edital: "03/2025",
      status: "Concluído",
      risco: "Médio",
      vagas_total: 1,
      vagas_ociosas: 1,
    },
  ];

  describe("chaveDeFiltro", () => {
    it("ignora acento, caixa e espaços", () => {
      expect(chaveDeFiltro("  MÉDIO   Rio ")).toBe("medio rio");
      expect(chaveDeFiltro(null)).toBe("");
    });
  });

  describe("opcoesDoCampo", () => {
    it("não duplica grafias com e sem acento e usa a mais frequente", () => {
      expect(opcoesDoCampo(LINHAS, vazio(), "risco")).toEqual([
        "Alto",
        "Baixo",
        "Médio",
      ]);
      expect(opcoesDoCampo(LINHAS, vazio(), "status")).toEqual([
        "Concluído",
        "Em Andamento",
      ]);
    });

    it("oferece só o que casa com os outros filtros", () => {
      const estado = vazio();
      estado.edital = new Set(["03/2025"]);
      expect(opcoesDoCampo(LINHAS, estado, "unidade")).toEqual([
        "DSEI Potiguara",
        "DSEI Xingu",
      ]);
      // o próprio campo não se restringe
      expect(opcoesDoCampo(LINHAS, estado, "edital")).toHaveLength(3);
    });
  });

  describe("linhaAtende", () => {
    it("casa seleção com grafia diferente da linha", () => {
      const estado = vazio();
      estado.risco = new Set(["Médio"]);
      expect(LINHAS.filter((l) => linhaAtende(l, estado))).toHaveLength(3);
    });

    it("filtra pelo DSEI selecionado com a chave do mapa, não por texto", () => {
      const estado = vazio();
      const noXingu = LINHAS.filter((l) =>
        linhaAtende(l, estado, { dsei: "XINGU", chaveDsei }),
      );
      expect(noXingu.map((l) => l.edital)).toEqual(["01/2026", "03/2025"]);
    });

    it("aplica a regra extra de exclusão", () => {
      const encerrado = (l) => chaveDeFiltro(l.status).startsWith("conclu");
      expect(
        LINHAS.filter((l) => linhaAtende(l, vazio(), { excluir: encerrado })),
      ).toHaveLength(2);
    });
  });

  describe("podarSelecoes", () => {
    it("encadeia: poda repetida até não sobrar seleção órfã", () => {
      const estado = vazio();
      // Unidade=Potiguara só existe no edital 03/2025, com risco Médio.
      estado.unidade = new Set(["DSEI Potiguara"]);
      estado.risco = new Set(["Médio"]);
      estado.edital = new Set(["01/2026"]); // incompatível com Potiguara
      podarSelecoes(LINHAS, estado, { campos: CAMPOS });
      const recorte = LINHAS.filter((l) =>
        linhaAtende(l, estado, { campos: CAMPOS }),
      );
      // toda seleção que sobrou tem de ser oferecida pelas opções atuais
      CAMPOS.forEach((campo) => {
        const oferecidas = new Set(
          opcoesDoCampo(LINHAS, estado, campo, { campos: CAMPOS }),
        );
        estado[campo].forEach((v) => expect(oferecidas.has(v)).toBe(true));
      });
      expect(recorte.length).toBeGreaterThan(0);
    });

    it("devolve false quando nada muda e reescreve a grafia para a canônica", () => {
      const estado = vazio();
      estado.risco = new Set(["medio"]);
      expect(podarSelecoes(LINHAS, estado, { campos: CAMPOS })).toBe(true);
      expect([...estado.risco]).toEqual(["Médio"]);
      expect(podarSelecoes(LINHAS, estado, { campos: CAMPOS })).toBe(false);
    });

    it("respeita a exclusão (ocultar encerrados) ao podar", () => {
      const estado = vazio();
      estado.status = new Set(["Concluído"]);
      const encerrado = (l) => chaveDeFiltro(l.status).startsWith("conclu");
      podarSelecoes(LINHAS, estado, { campos: CAMPOS, excluir: encerrado });
      expect(estado.status.size).toBe(0);
    });
  });
});

bloco("fronteiras-da-visao-geral", () => {
  const campoInvalido = { toString: null, valueOf: null };
  const linha = {
    id: 1,
    CO_AREA: "sede",
    unidade: "Sede",
    edital: "1/2026",
    status: "Em andamento",
    vagas_total: "10",
    contratados: 2,
    inscritos: 8,
  };

  describe("fronteiras externas da Visão geral", () => {
    it("ignora filtros desconhecidos e valores que não podem ser texto", () => {
      expect(
        normalizarFiltros({
          unidade: ["Sede", null, "Sede", campoInvalido],
          uf: false,
          invasor: ["x"],
        }),
      ).toEqual({
        unidade: ["Sede"],
        edital: [],
        status: [],
        fase: [],
        uf: [],
        ciclo: [],
      });
      expect(normalizarFiltros(null).unidade).toEqual([]);
    });

    it("preserva campos dos mapas e evita que campos malformados quebrem os indicadores", () => {
      const geografico = { latitude: -15, longitude: -47 };
      const bruto = {
        ...linha,
        observacoes: campoInvalido,
        inscritos: campoInvalido,
        localizacao: geografico,
        atencao: campoInvalido,
      };
      const normalizadas = linhasDaResposta([null, false, [], bruto]);
      expect(normalizadas).toHaveLength(1);
      expect(normalizadas[0].localizacao).toBe(geografico);
      expect(normalizadas[0].observacoes).toBeUndefined();
      expect(normalizadas[0].atencao).toBeUndefined();
      expect(bruto.atencao).toBe(campoInvalido);
      expect(
        linhasDaResposta([{ ...linha, cronograma_percentual: "Infinity" }])[0]
          .cronograma_percentual,
      ).toBeUndefined();
      const enriquecidas = enriquecerLinhas(normalizadas, {
        hoje: "2026-10-07",
      });
      expect(indicadoresDaVisaoGeral(enriquecidas)).toMatchObject({
        vagas: 10,
        contratadas: 2,
        emSelecao: 8,
        inscritos: 0,
      });
    });

    it("aceita IDs numéricos e UUIDs e ignora objetos no acompanhamento", () => {
      const resultado = acompanhamentoDaResposta({
        etapas: [
          null,
          { monitoramento_id: campoInvalido },
          {
            monitoramento_id: 1,
            data_inicio: "2026-10-07",
            atividade: campoInvalido,
          },
        ],
        listas: [
          [],
          { monitoramento_id: false },
          {
            monitoramento_id: "uuid",
            aprovados: "2",
            desistentes: campoInvalido,
          },
        ],
      });
      expect([...resultado.etapasPorEdital.keys()]).toEqual(["1"]);
      expect(resultado.etapasPorEdital.get("1")[0].atividade).toBeUndefined();
      expect([...resultado.listasPorEdital.keys()]).toEqual(["uuid"]);
      expect(resultado.listasPorEdital.get("uuid").aprovados).toBe("2");
      expect(resultado.listasPorEdital.get("uuid").desistentes).toBeUndefined();
      expect(acompanhamentoDaResposta([])).toBeNull();
    });

    it("descarta o acompanhamento da área anterior sem repetir pedidos da mesma carga", async () => {
      let snapshot = { linhas: [linha], areaAtual: "sede", carregado: true };
      let avisar;
      const resolver = new Map();
      const buscar = vi.fn(
        (area) => new Promise((resolve) => resolver.set(area, resolve)),
      );
      const estado = criarEstadoDaVisaoGeral({
        dados: {
          obter: () => snapshot,
          assinar: (fn) => {
            avisar = fn;
            return () => {};
          },
        },
        armazenamento: null,
      });
      estado.definirBuscaDoAcompanhamento(buscar);
      await vi.waitFor(() => expect(buscar).toHaveBeenCalledTimes(1));
      avisar();
      expect(buscar).toHaveBeenCalledTimes(1);
      snapshot = { ...snapshot, areaAtual: "projetos" };
      avisar();
      await vi.waitFor(() => expect(resolver.has("projetos")).toBe(true));
      resolver.get("sede")({
        etapas: [{ monitoramento_id: "antigo" }],
        listas: [],
      });
      resolver.get("projetos")({
        etapas: [{ monitoramento_id: "novo" }],
        listas: [],
      });
      await vi.waitFor(() =>
        expect(estado.obter().etapasPorEdital?.has("novo")).toBe(true),
      );
      expect(estado.obter().etapasPorEdital.has("antigo")).toBe(false);
      expect(estado.obter().area).toBe("projetos");
      avisar();
      expect(buscar).toHaveBeenCalledTimes(2);
    });

    it("com os cargos na resposta, o estado carrega a conta e desconta a vaga reaberta", async () => {
      const velho = {
        ...linha,
        id: "e1",
        edital: "1/2025",
        status: "Concluído",
        data_inicio: "2025-06-09",
        data_fim: "2025-08-20",
        vagas_total: 10,
        contratados: 4,
      };
      const novo = {
        ...linha,
        id: "e2",
        edital: "2/2026",
        data_inicio: "2026-06-16",
        vagas_total: 5,
        contratados: 0,
      };
      const snapshot = {
        linhas: [velho, novo],
        areaAtual: "sede",
        carregado: true,
      };
      const buscar = vi.fn(async () => ({
        etapas: [],
        listas: [],
        vagas_por_cargo: {
          vagas: [
            { monitoramento_id: "e1", cargo: "Analista" },
            { monitoramento_id: "e2", cargo: "Analista" },
          ],
        },
      }));
      const estado = criarEstadoDaVisaoGeral({
        dados: { obter: () => snapshot, assinar: () => () => {} },
        armazenamento: null,
      });
      estado.definirBuscaDoAcompanhamento(buscar);
      await vi.waitFor(() =>
        expect(estado.obter().indicadores.reabertas).toBe(5),
      );
      // Os editais da área vão junto, para a leitura dos cargos.
      expect(buscar).toHaveBeenCalledWith("sede", ["e1", "e2"]);
      expect(estado.obter().indicadores).toMatchObject({
        vagas: 10,
        contratadas: 4,
        emSelecao: 5,
        ociosas: 1,
      });
      expect(
        estado.obter().linhasDaArea.find((l) => l.id === "e1")
          .textos_da_reabertura,
      ).toEqual(["5 vagas reabertas no edital 2/2026"]);
    });

    it("o acompanhamento pergunta pela versão que já tem; inalterado, volta o mesmo", async () => {
      const primeiro = {
        etapas: [],
        listas: [{ edital_id: "e1" }],
        versao: "v1",
      };
      const respostas = [
        { data: primeiro, error: null },
        { data: { inalterado: true, versao: "v1" }, error: null },
      ];
      // A marcação manual de crítico vem de outra RPC, lida junto (20261110150000).
      const rpc = vi.fn(async (nome) =>
        nome === "listar_editais_criticos_manuais"
          ? { data: [], error: null }
          : respostas.shift(),
      );
      const buscar = buscarAcompanhamentoNoSupabase({ rpc });
      const entregue = await buscar("area-da-versao");
      expect(entregue).toEqual({ ...primeiro, criticos_manuais: [] });
      // Nada mudou (acompanhamento inalterado, mesma marcação): o MESMO objeto.
      expect(await buscar("area-da-versao")).toBe(entregue);
      expect(
        rpc.mock.calls
          .filter(
            ([nome]) =>
              nome === "listar_acompanhamento_da_visao_geral_se_mudou",
          )
          .map(([, argumentos]) => argumentos.p_versao),
      ).toEqual([null, "v1"]);
    });

    it("lê os cargos dos editais da área para as vagas reabertas; se falhar, segue sem eles", async () => {
      const cargos = {
        vagas: [{ monitoramento_id: "e1", cargo: "Enfermeiro" }],
      };
      let falhar = false;
      const rpc = vi.fn(async (nome) => {
        if (nome === "listar_editais_criticos_manuais")
          return { data: [], error: null };
        if (nome === "listar_vagas_por_cargo_da_visao_geral")
          return falhar
            ? { data: null, error: { message: "fora do ar" } }
            : { data: cargos, error: null };
        return { data: { etapas: [], listas: [], versao: "v1" }, error: null };
      });
      const buscar = buscarAcompanhamentoNoSupabase({ rpc });
      expect(await buscar("area-dos-cargos", ["e1", "e2"])).toMatchObject({
        vagas_por_cargo: cargos,
      });
      expect(rpc).toHaveBeenCalledWith(
        "listar_vagas_por_cargo_da_visao_geral",
        {
          p_area: "area-dos-cargos",
          p_editais: ["e1", "e2"],
        },
      );
      falhar = true;
      expect(await buscar("area-dos-cargos", ["e1"])).not.toHaveProperty(
        "vagas_por_cargo",
      );
      // Sem editais, não pergunta.
      rpc.mockClear();
      await buscar("area-sem-editais");
      expect(rpc.mock.calls.map(([nome]) => nome)).not.toContain(
        "listar_vagas_por_cargo_da_visao_geral",
      );
    });

    it("repassa o erro da RPC e não aceita números de marcos malformados", async () => {
      const erro = { code: "42501", message: "Sem acesso" };
      const rpc = vi.fn(async () => ({ data: null, error: erro }));
      await expect(
        buscarAcompanhamentoNoSupabase({ rpc })("sede"),
      ).rejects.toBe(erro);
      expect(rpc).toHaveBeenCalledWith(
        "listar_acompanhamento_da_visao_geral_se_mudou",
        {
          p_area: "sede",
          p_versao: null,
        },
      );
      for (const data of [
        null,
        [],
        { ano: "2026", concluidas_no_ano: 100 },
        { ano: 2026, concluidas_no_ano: -1 },
        { ano: 2026, concluidas_no_ano: campoInvalido },
      ]) {
        const resposta = await lerMarcosDaArea(
          { rpc: async () => ({ data, error: null }) },
          "sede",
        );
        expect(resposta.data).toBeNull();
        expect(resposta.error).toBeInstanceOf(Error);
      }
      const resultado = await lerMarcosDaArea(
        {
          rpc: async () => ({
            data: { ano: 2026, concluidas_no_ano: 7600 },
            error: null,
          }),
        },
        "sede",
      );
      expect(resultado).toEqual({
        data: { ano: 2026, concluidas_no_ano: 7600 },
        error: null,
      });
    });
  });
});

bloco("indicadores-do-monitoramento", () => {
  /*
  Os KPIs da Visão geral fecham: Vagas imediatas = Contratadas + Em seleção +
  Ociosas. Os casos são os da leitura de 02/10/2026 (analise.md): FGV da SEDE
  com 567 contratados para 130 vagas (cadastro reserva), 81/2026 concluído
  com 1 contratado de 83, editais só de cadastro reserva (vagas 0) e
  cancelados com inscritos antigos.
*/

  const SEDE = [
    // FGV: concluído, mais contratados que vagas → 130 contratadas + 437 CR.
    {
      id: "fgv",
      edital: "FGV",
      status: "Concluído",
      vagas_total: 130,
      contratados: 567,
      inscritos: 0,
    },
    // 35/2025: concluído, 7 contratados para 4 vagas.
    {
      id: "35",
      edital: "35/2025",
      status: "Concluido",
      vagas_total: 4,
      contratados: 7,
      inscritos: 300,
    },
    // 81/2026: concluído com 1 de 83 → 82 ociosas.
    {
      id: "81",
      edital: "81/2026",
      status: "Concluído",
      vagas_total: 83,
      contratados: 1,
      inscritos: 3055,
    },
    // 91/2026: em andamento, nenhum contratado → 27 em seleção.
    {
      id: "91",
      edital: "91/2026",
      status: "Em andamento",
      vagas_total: 27,
      contratados: 0,
      inscritos: 3961,
    },
    // 70/2025: só cadastro reserva (vagas 0) → 22 de CR, nada nas vagas.
    {
      id: "70",
      edital: "70/2025",
      status: "Concluído",
      vagas_total: 0,
      contratados: 22,
      inscritos: 500,
    },
    // 81/2025: cancelado com inscritos antigos → fora de tudo.
    {
      id: "c",
      edital: "81/2025",
      status: "Cancelado",
      vagas_total: 10,
      contratados: 0,
      inscritos: 1389,
    },
  ];

  describe("as contas da faixa de indicadores fecham", () => {
    it("Vagas imediatas = Contratadas + Em seleção + Ociosas; CR à parte; cancelado fora", () => {
      const k = indicadoresDoMonitoramento(SEDE);
      expect(k).toEqual({
        processos: 6,
        vagas: 130 + 4 + 83 + 27 + 0,
        reabertas: 0,
        contratadas: 130 + 4 + 1 + 0 + 0,
        emSelecao: 27,
        ociosas: 82,
        cadastroReserva: 437 + 3 + 22,
        criticos: 0,
        inscritos: 0 + 300 + 3055 + 3961 + 500,
      });
      expect(k.contratadas + k.emSelecao + k.ociosas).toBe(k.vagas);
    });

    it("o caso da leitura: a soma simples de antes não fechava, a de agora fecha", () => {
      const validas = SEDE.slice(0, 5);
      // Antes: Σ contratados (com CR) e Σ max(vagas − contratados, 0).
      const contratadosAntes = somarCampo(validas, "contratados");
      const ociosasAntes = validas.reduce(
        (soma, l) => soma + Math.max(0, l.vagas_total - l.contratados),
        0,
      );
      const vagas = somarCampo(validas, "vagas_total");
      expect(vagas - contratadosAntes).not.toBe(ociosasAntes);
      const k = indicadoresDoMonitoramento(validas);
      expect(k.vagas - k.contratadas).toBe(k.emSelecao + k.ociosas);
    });

    it("fase Contratação conta como resultado (ociosa); em andamento sem ela, em seleção", () => {
      const contratacao = {
        status: "Em andamento",
        etapa: "Convocação para admissão",
        vagas_total: 10,
        contratados: 4,
      };
      const analise = { ...contratacao, etapa: "Análise Curricular" };
      expect(temResultado(contratacao)).toBe(true);
      expect(temResultado(analise)).toBe(false);
      expect(indicadoresDoMonitoramento([contratacao, analise])).toMatchObject({
        vagas: 20,
        contratadas: 8,
        ociosas: 6,
        emSelecao: 6,
      });
    });

    it("Críticos conta as linhas com motivo de atenção (o recorte preenche `atencao`)", () => {
      const linhas = [
        { status: "Em andamento", atencao: [{ codigo: "prazo" }] },
        { status: "Em andamento", atencao: [] },
        { status: "Concluído" },
      ];
      expect(indicadoresDoMonitoramento(linhas).criticos).toBe(1);
    });

    it("sem linhas, tudo zero", () => {
      expect(indicadoresDoMonitoramento(undefined)).toEqual({
        processos: 0,
        vagas: 0,
        reabertas: 0,
        contratadas: 0,
        emSelecao: 0,
        ociosas: 0,
        cadastroReserva: 0,
        criticos: 0,
        inscritos: 0,
      });
    });
  });

  describe("por edital", () => {
    it("contratadas, cadastro reserva e vagas sem contratação", () => {
      const fgv = SEDE[0];
      expect(contratadasImediatas(fgv)).toBe(130);
      expect(contratacoesDoCadastroReserva(fgv)).toBe(437);
      expect(vagasSemContratacao(fgv)).toBe(0);
      expect(vagasSemContratacao(SEDE[2])).toBe(82);
      expect(
        contratadasImediatas({ vagas_total: "x", contratados: null }),
      ).toBe(0);
    });

    it("status em qualquer grafia", () => {
      expect(ehConcluido({ status: "Concluido" })).toBe(true);
      expect(ehConcluido({ status: "ConcluÃ­do" })).toBe(true);
      expect(ehCancelado({ status: "Cancelada" })).toBe(true);
      expect(ehEditalEncerrado({ status: "Em elaboração" })).toBe(false);
      expect(ehEditalEncerrado(null)).toBe(false);
    });

    it("soma ignora vazio e texto", () => {
      expect(somarCampo([{ v: 2 }, { v: "x" }, {}, { v: "3" }], "v")).toBe(5);
    });
  });
});

bloco("indigenous-territories-layer", () => {
  /*
  Bordas reais das terras do DSEI Alagoas e Sergipe, medidas na camada
  publicada pela Funai. São a razão de o símbolo existir: no zoom em que cabe
  o distrito inteiro, 1 pixel vale 600 m.
*/
  const limitesDe = (oesteLat, oesteLon, lesteLat, lesteLon) => ({
    isValid: () => true,
    getNorthEast: () => ({ lat: lesteLat, lng: lesteLon }),
    getSouthWest: () => ({ lat: oesteLat, lng: oesteLon }),
  });

  // Projeção do Leaflet no zoom 8: 1 px = 0,60 km à latitude de Alagoas.
  const projetarNoZoom8 = (ponto) => ({
    x: (ponto.lng * 111 * Math.cos((-9.8 * Math.PI) / 180)) / 0.6,
    y: (-ponto.lat * 111) / 0.6,
  });

  describe("camada de Terras Indígenas", () => {
    it("usa a camada oficial de polígonos da Funai", () => {
      expect(FUNAI_TERRITORIES_LAYER).toBe("Funai:tis_poligonais");
    });

    it("usa proxy same-origin no navegador", () => {
      expect(FUNAI_PROXY_WMS).toBe("/api/funai-wms");
      expect(FUNAI_PROXY_GEOJSON).toBe("/api/funai-geodata");

      const url = funaiViewportUrl({
        getWest: () => -40,
        getSouth: () => -12,
        getEast: () => -35,
        getNorth: () => -8,
      });
      expect(url).toContain("/api/funai-geodata?");
      expect(url).toContain("dataset=territories");
      expect(url).toContain("bbox=-40%2C-12%2C-35%2C-8");
    });

    it("a abrangência dos DSEIs vem do arquivo local, não da Funai", () => {
      const camada = readFileSync(
        "src/modules/indigenous-territories-layer.ts",
        "utf8",
      );
      const carga = camada.slice(
        camada.indexOf("async function loadDseiFeatures()"),
        camada.indexOf("export function installIndigenousTerritoriesLayer"),
      );
      expect(carga).toContain("fetch(ARQUIVO_DOS_CONTORNOS_DOS_DSEIS");
      expect(camada).not.toContain("dataset=dsei");
      expect(ARQUIVO_DOS_CONTORNOS_DOS_DSEIS).toBe(
        "/data/contornos-dos-dseis.json",
      );
    });

    it("o arquivo local tem os 34 DSEIs com nome que a camada reconhece", () => {
      const contornos = JSON.parse(
        readFileSync("public/data/contornos-dos-dseis.json", "utf8"),
      );
      expect(contornos.type).toBe("FeatureCollection");
      expect(contornos.features).toHaveLength(34);
      const yanomami = contornos.features.find((f) =>
        dseiFeatureMatches(f, "DSEI Yanomami"),
      );
      expect(dseiFeatureName(yanomami?.properties)).toMatch(/Yanomami/);
    });

    it("reconhece o nome do DSEI sem depender de um único atributo", () => {
      expect(dseiFeatureName({ nome_dsei: "Alagoas e Sergipe" })).toBe(
        "Alagoas e Sergipe",
      );
      expect(dseiFeatureName({ dsei: "Yanomami" })).toBe("Yanomami");
      expect(
        dseiFeatureMatches(
          { properties: { nome_dsei: "DSEI Alagoas e Sergipe" } },
          "Alagoas e Sergipe",
        ),
      ).toBe(true);
    });

    it("lê o nome no atributo que a Funai publica hoje", () => {
      // `terrai_nome` é o que o DescribeFeatureType de Funai:tis_poligonais lista.
      expect(funaiFeatureName({ terrai_nome: "Potiguara" })).toBe("Potiguara");
    });

    it("mantém os nomes antigos como reserva", () => {
      expect(funaiFeatureName({ terrai_nom: "Kariri-Xocó" })).toBe(
        "Kariri-Xocó",
      );
      expect(funaiFeatureName({ nome: "Munduruku" })).toBe("Munduruku");
    });

    it("não inventa nome quando a camada não traz nenhum", () => {
      expect(funaiFeatureName({ gid: 12 })).toBe("");
    });
  });

  describe("povos declarados na Terra Indígena", () => {
    it("lê um povo único", () => {
      expect(povosDaTerraIndigena({ etnia_nome: "Kokama" })).toEqual([
        "Kokama",
      ]);
    });

    it("separa por vírgula, como em Aldeia Katurama", () => {
      expect(
        povosDaTerraIndigena({ etnia_nome: "Pataxó, Pataxo Há-Há-Há" }),
      ).toEqual(["Pataxó", "Pataxo Há-Há-Há"]);
    });

    it("separa por ' e ', como em São Jeronimo", () => {
      expect(
        povosDaTerraIndigena({ etnia_nome: "Guaraní e Kaingang e Xetá" }),
      ).toEqual(["Guaraní", "Kaingang", "Xetá"]);
    });

    it("não parte nomes que contêm a letra e sem espaços em volta", () => {
      expect(povosDaTerraIndigena({ etnia_nome: "Tenetehara" })).toEqual([
        "Tenetehara",
      ]);
      expect(povosDaTerraIndigena({ etnia_nome: "Guarani Kaiowá" })).toEqual([
        "Guarani Kaiowá",
      ]);
    });

    it("descarta repetição e sobras de separador", () => {
      expect(
        povosDaTerraIndigena({ etnia_nome: "Kaingang, kaingang, , Xokleng" }),
      ).toEqual(["Kaingang", "Xokleng"]);
    });

    it("devolve lista vazia quando a Funai não declara etnia", () => {
      expect(povosDaTerraIndigena({ terrai_nome: "Sem etnia" })).toEqual([]);
      expect(povosDaTerraIndigena()).toEqual([]);
    });
  });

  describe("marcação da Terra Indígena no mapa", () => {
    it("põe o povo em primeiro lugar, e a terra abaixo", () => {
      const texto = tooltipDaTerraIndigena({
        etnia_nome: "Potiguara",
        terrai_nome: "Potiguara de Monte-Mór",
        uf_sigla: "PB",
      });
      expect(texto).toBe(
        "<b>Povo: Potiguara</b><br>Terra Indígena Potiguara de Monte-Mór<br>PB",
      );
    });

    it("diz 'Povos' no plural quando há mais de um", () => {
      expect(
        tooltipDaTerraIndigena({
          etnia_nome: "Guaraní e Kaingang",
          terrai_nome: "São Jeronimo",
        }),
      ).toContain("<b>Povos: Guaraní, Kaingang</b>");
    });

    /*
    Não afirma povo nenhum — e diz que a Funai não o declarou, como a lista do
    painel já dizia. Antes o balão simplesmente calava, e a ausência lia-se
    como esquecimento do painel.
  */
    it("sem etnia declarada, identifica pela terra e não afirma povo", () => {
      const texto = tooltipDaTerraIndigena({
        terrai_nome: "Acapuri de Cima",
        uf_sigla: "AM",
      });
      expect(texto).toBe(
        "<b>Terra Indígena Acapuri de Cima</b><br><i>Povo não declarado pela Funai</i><br>AM",
      );
      expect(texto).not.toContain("Povo:");
    });

    /*
    Em 32 das 163 terras em estudo o campo vem "Não especificada", e o balão
    dizia "Povo: Não especificada" — a ausência do dado a passar por nome.
  */
    it("o preenchimento da Funai não vira nome de povo", () => {
      for (const valor of [
        "Não especificada",
        "não especificado",
        "Nao informado",
        "Sem informação",
      ]) {
        expect(povosDaTerraIndigena({ etnia_nome: valor }), valor).toEqual([]);
      }
      expect(
        povosDaTerraIndigena({ etnia_nome: "Kaingang, Não especificada" }),
      ).toEqual(["Kaingang"]);
      // E não apaga um povo cujo nome só começa parecido.
      expect(povosDaTerraIndigena({ etnia_nome: "Nambikwara" })).toEqual([
        "Nambikwara",
      ]);
    });

    it("não devolve marcação quando não há nada a dizer", () => {
      expect(tooltipDaTerraIndigena({ gid: 9 })).toBe("");
    });

    it("escapa o que vem da Funai antes de virar HTML", () => {
      expect(
        tooltipDaTerraIndigena({ etnia_nome: "<img src=x onerror=alert(1)>" }),
      ).not.toContain("<img");
    });

    it("a dica do contorno do DSEI também escapa o nome da Funai", () => {
      expect(tooltipDoDsei("Alagoas e Sergipe")).toBe("DSEI Alagoas e Sergipe");
      expect(tooltipDoDsei("<img src=x onerror=alert(1)>")).not.toContain(
        "<img",
      );
    });
  });

  describe("rótulo desenhado sobre a Terra Indígena", () => {
    it("escreve o povo, não o nome da terra", () => {
      expect(
        rotuloDaTerraIndigena({
          etnia_nome: "Potiguara",
          terrai_nome: "Potiguara de Monte-Mór",
        }),
      ).toBe("Potiguara");
    });

    it("escreve dois povos por extenso", () => {
      expect(rotuloDaTerraIndigena({ etnia_nome: "Guaraní e Kaingang" })).toBe(
        "Guaraní, Kaingang",
      );
    });

    it("a partir do terceiro povo, conta em vez de escrever", () => {
      expect(
        rotuloDaTerraIndigena({ etnia_nome: "Guaraní e Kaingang e Xetá" }),
      ).toBe("Guaraní, Kaingang +1");
    });

    it("sem etnia declarada, cai para o nome da terra", () => {
      expect(rotuloDaTerraIndigena({ terrai_nome: "Acapuri de Cima" })).toBe(
        "Acapuri de Cima",
      );
    });

    it("não devolve rótulo quando não há nome nenhum", () => {
      expect(rotuloDaTerraIndigena({ gid: 3 })).toBe("");
    });
  });

  /*
  A opacidade do preenchimento resolvia terras grandes e não resolvia nada em
  Alagoas e Sergipe: das 21 terras daquele enquadramento, 14 ficam abaixo de
  20 px. O que decide se uma área se lê não é a área em km², é o tamanho dela
  no monitor — e isso muda a cada zoom.
*/
  describe("terras pequenas demais para se verem", () => {
    it("mede a maior dimensão em pixels, não em graus", () => {
      // 1 grau de latitude = 111 km = 185 px nesta projeção.
      const tamanho = tamanhoNaTelaEmPixels(
        limitesDe(-10, -37, -9, -37),
        projetarNoZoom8,
      );
      expect(tamanho).toBeCloseTo(185, 0);
    });

    it("Pankararé, a maior do DSEI, dispensa símbolo", () => {
      // 25,6 km na maior dimensão — cerca de 43 px.
      const tamanho = tamanhoNaTelaEmPixels(
        limitesDe(-9.6, -38.3, -9.37, -38.3),
        projetarNoZoom8,
      );
      expect(tamanho).toBeGreaterThan(40);
      expect(terraPrecisaDeSimbolo(tamanho)).toBe(false);
    });

    it("a menor Xucuru-Kariri, de 800 m, precisa de símbolo", () => {
      // 0,8 km — cerca de 1,4 px, invisível a qualquer opacidade.
      const tamanho = tamanhoNaTelaEmPixels(
        limitesDe(-9.4, -36.6, -9.3928, -36.6),
        projetarNoZoom8,
      );
      expect(tamanho).toBeLessThan(2);
      expect(terraPrecisaDeSimbolo(tamanho)).toBe(true);
    });

    it("o limiar é 20 px, e é fechado em cima", () => {
      expect(terraPrecisaDeSimbolo(19.9)).toBe(true);
      expect(terraPrecisaDeSimbolo(20)).toBe(false);
    });

    it("não devolve tamanho quando a projeção falha", () => {
      expect(
        tamanhoNaTelaEmPixels(limitesDe(-10, -37, -9, -36), () => ({})),
      ).toBe(0);
      expect(terraPrecisaDeSimbolo(0)).toBe(true);
    });

    /*
    Um círculo de oito pixels sobre uma terra de 800 m é um marcador de
    posição, não o limite dela. Se alguém o ler como limite, o mapa passou a
    afirmar uma extensão que não tem.
  */
    it("o símbolo diz que não é o limite da terra", () => {
      expect(AVISO_DO_SIMBOLO).toContain("não o limite");
    });
  });

  describe("instalação da camada", () => {
    it("só se instala nos dois mapas de Saúde Indígena", () => {
      expect(isHealthMapElementId("map")).toBe(true);
      expect(isHealthMapElementId("detailMap")).toBe(true);
      expect(isHealthMapElementId("otherMap")).toBe(false);
      expect(isHealthMapElementId({ id: "detailMap" })).toBe(true);
    });
  });
});

bloco("leque-de-marcadores", () => {
  const destino = (p, o) => ({ x: p.x + o.dx, y: p.y + o.dy });

  describe("leque de marcadores", () => {
    it("um marcador sozinho não é deslocado", () => {
      expect(calcularLeque([{ x: 50, y: 80 }])).toEqual([
        { dx: 0, dy: 0, emLeque: false },
      ]);
    });

    it("dois no mesmo ponto: no raio, opostos, o primeiro em cima", () => {
      const p = { x: 100, y: 100 };
      const leque = calcularLeque([p, { ...p }]);
      expect(leque.every((o) => o.emLeque)).toBe(true);
      leque.forEach((o) =>
        expect(Math.hypot(o.dx, o.dy)).toBeCloseTo(RAIO_DO_LEQUE, 6),
      );
      expect(leque[0].dx).toBeCloseTo(0, 6);
      expect(leque[0].dy).toBeCloseTo(-RAIO_DO_LEQUE, 6);
      expect(leque[1].dy).toBeCloseTo(RAIO_DO_LEQUE, 6);
    });

    it("três no mesmo ponto: ângulos distintos a 120°, o primeiro em cima", () => {
      const p = { x: 10, y: 10 };
      const leque = calcularLeque([p, p, p], { raio: 18 });
      const angulos = leque.map((o) => Math.atan2(o.dy, o.dx));
      leque.forEach((o) => expect(Math.hypot(o.dx, o.dy)).toBeCloseTo(18, 6));
      expect(angulos[0]).toBeCloseTo(-Math.PI / 2, 6);
      expect(new Set(angulos.map((a) => a.toFixed(4))).size).toBe(3);
      const [a, b, c] = leque.map((o) => destino(p, o));
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(
        18 * Math.sqrt(3),
        6,
      );
      expect(Math.hypot(b.x - c.x, b.y - c.y)).toBeCloseTo(
        18 * Math.sqrt(3),
        6,
      );
    });

    it("pontos quase coincidentes giram em volta da média do grupo", () => {
      const pts = [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ];
      const [a, b] = calcularLeque(pts).map((o, i) => destino(pts[i], o));
      expect(a.x).toBeCloseTo(1, 6);
      expect(a.y).toBeCloseTo(-RAIO_DO_LEQUE, 6);
      expect(b.y).toBeCloseTo(RAIO_DO_LEQUE, 6);
    });

    it("marcadores já afastados mais do que o diâmetro não são deslocados", () => {
      const leque = calcularLeque([
        { x: 0, y: 0 },
        { x: 2 * RAIO_DO_LEQUE + 1, y: 0 },
        { x: 0, y: 200 },
      ]);
      expect(leque.every((o) => !o.emLeque && o.dx === 0 && o.dy === 0)).toBe(
        true,
      );
    });

    it("agrupa por transitividade e mantém a ordem da entrada", () => {
      const grupos = agruparNaTela(
        [
          { x: 0, y: 0 },
          { x: 500, y: 500 },
          { x: 20, y: 0 },
          { x: 40, y: 0 },
        ],
        25,
      );
      expect(grupos).toEqual([[0, 2, 3], [1]]);
    });

    it("a mesma entrada dá sempre o mesmo resultado", () => {
      const entrada = [
        { x: 3, y: 4 },
        { x: 3, y: 4 },
        { x: 90, y: 4 },
        { x: 5, y: 6 },
      ];
      expect(calcularLeque(entrada)).toEqual(calcularLeque(entrada));
      expect(calcularLeque(entrada.map((p) => ({ ...p })))).toEqual(
        calcularLeque(entrada),
      );
    });

    it("ignora pontos sem coordenada de tela", () => {
      const leque = calcularLeque([{ x: 1, y: 1 }, { x: NaN, y: 1 }, null]);
      expect(leque.every((o) => !o.emLeque)).toBe(true);
      expect(anguloNoLeque(0, 4)).toBeCloseTo(-Math.PI / 2, 9);
    });
  });
});

bloco("lista-de-terras-e-povos", () => {
  /*
  O MAPA MOSTRAVA AS TERRAS E NÃO AS NOMEAVA EM LADO NENHUM

  Para saber que terras um DSEI atende e que povos vivem nelas, era preciso
  passar o ponteiro por cima de cada polígono, um a um. Num distrito com trinta
  terras isso não é consulta, é garimpo.

  Duas coisas atrapalham quem quiser montar essa lista a partir da Funai: os
  povos vêm num campo só, separados por vírgula, e a mesma terra repete-se
  quando o limite dela é feito de vários polígonos.
*/
  const terra = (nome, etnias, uf = "AM", fase = "Regularizada") => ({
    type: "Feature",
    properties: {
      terrai_nome: nome,
      etnia_nome: etnias,
      uf_sigla: uf,
      fase_ti: fase,
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    },
  });

  describe("os povos de uma terra", () => {
    it("separa o campo único da Funai", () => {
      expect(povosDaFeature({ etnia_nome: "Kaingang, Guarani" })).toEqual([
        "Kaingang",
        "Guarani",
      ]);
    });

    it("aguenta os outros separadores e o espaço a mais", () => {
      expect(
        povosDaFeature({ etnia_nome: "Tikuna;  Kokama / Kambeba" }),
      ).toEqual(["Tikuna", "Kokama", "Kambeba"]);
    });

    it("campo vazio não vira povo vazio", () => {
      expect(povosDaFeature({ etnia_nome: "" })).toEqual([]);
      expect(povosDaFeature({ etnia_nome: " , ; " })).toEqual([]);
      expect(povosDaFeature(null)).toEqual([]);
    });
  });

  describe("a lista que o painel mostra", () => {
    it("junta os polígonos da mesma terra numa linha só", () => {
      const lista = resumoDasTerras([
        terra("Yanomami", "Yanomami"),
        terra("Yanomami", "Ye'kuana"),
      ]);
      expect(lista).toHaveLength(1);
      expect(lista[0].povos).toEqual(["Yanomami", "Ye'kuana"]);
    });

    it("não repete o povo que aparece em dois polígonos", () => {
      const lista = resumoDasTerras([
        terra("Raposa Serra do Sol", "Macuxi, Wapixana"),
        terra("Raposa Serra do Sol", "Macuxi"),
      ]);
      expect(lista[0].povos).toEqual(["Macuxi", "Wapixana"]);
    });

    it("junta as UFs de uma terra que atravessa estados", () => {
      const lista = resumoDasTerras([
        terra("Yanomami", "Yanomami", "RR"),
        terra("Yanomami", "Yanomami", "AM"),
      ]);
      expect(lista[0].ufs).toEqual(["AM", "RR"]);
    });

    it("ordena por nome, como quem procura na lista", () => {
      const lista = resumoDasTerras([
        terra("Zo'é", "Zo'é"),
        terra("Araribóia", "Guajajara"),
        terra("Évare I", "Tikuna"),
      ]);
      expect(lista.map((t) => t.nome)).toEqual([
        "Araribóia",
        "Évare I",
        "Zo'é",
      ]);
    });

    /*
    Terra sem nome não é linha: é registo que a Funai publicou incompleto, e uma
    linha em branco na lista não ajuda ninguém.
  */
    it("descarta a terra sem nome", () => {
      expect(
        resumoDasTerras([terra("", "Guarani"), terra("  ", "Guarani")]),
      ).toEqual([]);
    });

    it("guarda a fase, que é o estado do processo", () => {
      expect(
        resumoDasTerras([terra("X", "Y", "AM", "Declarada")])[0].fase,
      ).toBe("Declarada");
    });

    it("aguenta entrada vazia ou inválida", () => {
      expect(resumoDasTerras([])).toEqual([]);
      expect(resumoDasTerras()).toEqual([]);
      expect(resumoDasTerras(null)).toEqual([]);
      expect(resumoDasTerras([null, {}, { properties: {} }])).toEqual([]);
    });
  });

  /*
  Contra o catálogo real: se a compilação mudar de campo, o número cai aqui
  antes de a lista aparecer vazia no ecrã.
*/
  describe("contra o catálogo compilado", () => {
    const catalogo = JSON.parse(
      readFileSync("public/data/terras-indigenas.json", "utf8"),
    );
    const lista = resumoDasTerras(catalogo.features);

    it("nomeia todas as terras publicadas", () => {
      expect(lista.length).toBeGreaterThanOrEqual(600);
    });

    it("a maioria esmagadora declara povo", () => {
      const comPovo = lista.filter((t) => t.povos.length).length;
      expect(comPovo / lista.length).toBeGreaterThan(0.9);
    });

    it("nenhuma linha sai sem nome", () => {
      for (const t of lista) expect(t.nome.trim()).toBeTruthy();
    });
  });

  /*
  O painel e o gancho que o alimenta. A lista é desenhada pela camada, não pelo
  código do painel — é a camada que sabe que terras sobreviveram ao filtro.
*/
  describe("o painel está ligado", () => {
    // O mapa do DSEI em React (src/modulos/mapa-saude-indigena/).
    const doDsei = readFileSync(
      "src/modulos/mapa-saude-indigena/mapa-do-dsei.tsx",
      "utf8",
    );
    const camada = readFileSync(
      "src/modules/indigenous-territories-layer.ts",
      "utf8",
    );

    it("o painel existe no mapa do DSEI", () => {
      expect(doDsei).toContain("<span>Terras Indígenas e povos</span>");
    });

    it("a camada avisa quem desenha", () => {
      expect(camada).toContain(
        "__agsusAoMudarTerras?.(resumoDasTerras(doDistritoInteiro))",
      );
      expect(doDsei).toContain("novo.__agsusAoMudarTerras =");
    });

    /*
    A LISTA É DO DISTRITO, O DESENHO É DO ENQUADRAMENTO

    A lista saía do recorte do ecrã. Quem aproximasse o mapa num posto de saúde
    via "Terras Indígenas e povos: 0" num distrito que tem dezenas — o painel
    respondia a "o que cabe no ecrã" e a pergunta é "o que este DSEI atende".

    O recorte continua a existir para o desenho, e tem de continuar: são 665
    terras, e o Leaflet paga por cada traçado.
  */
    it("a lista não é recortada pelo enquadramento", () => {
      expect(camada).toContain(
        "const doDistritoInteiro = unidadesDoDsei.length",
      );
      expect(camada).toContain("catalogo.features.filter((f) =>");
      expect(camada).not.toMatch(
        /__agsusAoMudarTerras\?\.\(resumoDasTerras\(doDistrito\)\)/,
      );
    });

    it("voltar ao Brasil desliga a lista com o mapa do DSEI", () => {
      expect(doDsei).toContain("novo.__agsusAoMudarTerras = null;");
    });

    /*
    O nome da terra e o do povo vêm da Funai: HTML de terceiro sem escapar é
    injeção. No React eles são texto.
  */
    it("o que vem da Funai entra como texto, nunca como HTML", () => {
      expect(doDsei).not.toContain("innerHTML");
      expect(doDsei).not.toContain("dangerouslySetInnerHTML");
    });
  });
});

bloco("mapa-nacional-mostra-a-fase", () => {
  /*
  O MAPA NACIONAL NÃO MOSTRAVA A FASE

  A camada passou a separar terra com limite definitivo de terra em processo, e
  a legenda passou a nomear as três famílias. Mas abaixo do zoom 7 quem desenhava
  era o raster da Funai — uma imagem só, recolorida por inteiro —, e uma imagem
  não sabe distinguir fase. A legenda prometia três coisas e o mapa do Brasil
  mostrava uma.

  O piso de zoom existia porque, antes do catálogo local, pedir a geometria
  nessa escala traria o país inteiro da Funai. Essa razão morreu quando o
  catálogo chegou: ele JÁ é o país inteiro, e está em memória.

  O que restava era o custo de desenhar 113.864 vértices numa escala em que o
  pixel vale 9,8 km. Daí o segundo catálogo.
*/
  describe("qual catálogo cada escala usa", () => {
    it("a visão do país usa o largo", () => {
      expect(catalogoParaOZoom(4)).toBe(CATALOGO_DE_TERRAS_LARGO);
      expect(catalogoParaOZoom(6.9)).toBe(CATALOGO_DE_TERRAS_LARGO);
    });

    it("a visão de um distrito usa o fino", () => {
      expect(catalogoParaOZoom(ZOOM_DO_CATALOGO_FINO)).toBe(CATALOGO_DE_TERRAS);
      expect(catalogoParaOZoom(12)).toBe(CATALOGO_DE_TERRAS);
    });

    /*
    A 1113 metros de tolerância o desvio passa a valer um pixel por volta do
    zoom 7 — que é também onde se deixa de ver o país e se passa a ver um
    distrito. As duas coisas coincidirem não é sorte: a tolerância foi escolhida
    para isso.
  */
    it("a troca é no zoom 7", () => {
      expect(ZOOM_DO_CATALOGO_FINO).toBe(7);
    });

    it("zoom inválido não escolhe o fino por acidente", () => {
      expect(catalogoParaOZoom(NaN)).toBe(CATALOGO_DE_TERRAS_LARGO);
      expect(catalogoParaOZoom(undefined)).toBe(CATALOGO_DE_TERRAS_LARGO);
    });
  });

  describe("o catálogo largo", () => {
    const largo = JSON.parse(
      readFileSync("public/data/terras-indigenas-largo.json", "utf8"),
    );
    const fino = JSON.parse(
      readFileSync("public/data/terras-indigenas.json", "utf8"),
    );

    /*
    Uma terra que desaparecesse no catálogo largo sumiria do mapa nacional
    enquanto a lista do distrito continuaria a nomeá-la. O compilador guarda a
    versão fina quando a simplificação larga apaga a geometria.
  */
    it("traz as mesmas terras que o fino", () => {
      expect(largo.features).toHaveLength(fino.features.length);
      const nomes = (c) =>
        new Set(c.features.map((f) => f.properties.terrai_nome)).size;
      expect(nomes(largo)).toBe(nomes(fino));
    });

    it("é bem menor do que o fino", () => {
      const kb = (c) => Buffer.byteLength(JSON.stringify(c)) / 1024;
      expect(kb(largo)).toBeLessThan(kb(fino) / 2);
    });

    it("leva a fase, que é a razão de ele existir", () => {
      for (const f of largo.features) {
        expect(faseDaTerra(f.properties)).not.toBe("desconhecida");
      }
    });

    it("declara a tolerância com que foi simplificado", () => {
      expect(largo.tolerancia_graus).toBe(0.01);
      expect(largo.tolerancia_graus).toBeGreaterThan(fino.tolerancia_graus);
    });

    /*
    Simplificar não pode mover uma terra de sítio. A caixa de cada uma tem de
    continuar onde estava, dentro da própria tolerância.

    A comparação é por ÍNDICE, e não por nome. Onze nomes de terra repetem-se no
    catálogo — há duas Bacurizinho, duas Buriti, duas Kariri-Xocó —, e a
    primeira versão deste caso indexava por nome: comparava a caixa de uma
    Bacurizinho com a da outra e acusava um deslocamento de 12,4 km que não
    existia. Os dois ficheiros saem do mesmo laço, na mesma ordem.
  */
    it("nenhuma terra se desloca ao ser simplificada", () => {
      expect(largo.features).toHaveLength(fino.features.length);
      for (let i = 0; i < largo.features.length; i += 1) {
        const daqui = caixaDaFeature(largo.features[i]);
        const dela = caixaDaFeature(fino.features[i]);
        const nome = largo.features[i].properties.terrai_nome;
        expect(fino.features[i].properties.terrai_nome).toBe(nome);
        if (!dela || !daqui) continue;
        // 0,02° são o dobro da tolerância larga: folga para o arredondamento.
        for (const lado of ["sul", "norte", "oeste", "leste"]) {
          expect(
            Math.abs(daqui[lado] - dela[lado]),
            `${nome} (${lado})`,
          ).toBeLessThan(0.02);
        }
      }
    });

    /*
    O DEFEITO QUE ESTE BLOCO ENCONTROU

    `simplificarAnel` devolvia `pontos.slice(0, 4)` quando a simplificação
    deixava menos de quatro pontos. Isso não é uma versão simplificada do anel:
    são os quatro primeiros vértices do contorno, uma lasca arbitrária dele — e
    a terra passava a ser desenhada como um triângulo em sítio nenhum.

    Com o anel original no lugar da lasca, o catálogo largo passou de 17.598
    para 43.450 vértices. Vinte e seis mil vértices de diferença é a medida de
    quantos anéis estavam a ser desenhados errados.
  */
    it("o compilador não volta a cortar o anel nos quatro primeiros", () => {
      const compilador = readFileSync(
        "scripts/compilar-terras-indigenas.mjs",
        "utf8",
      );
      expect(compilador).not.toContain("pontos.slice(0, 4)");
      expect(compilador).toContain("if (saida.length < 4) return pontos;");
    });

    it("toda terra continua a ser área, e não ponto", () => {
      for (const f of largo.features) {
        expect(["Polygon", "MultiPolygon"]).toContain(f.geometry.type);
      }
    });
  });

  /*
  O raster continua a existir, e tem de continuar: é o que resta quando o
  catálogo não carrega. O que mudou é deixar de ser o normal.
*/
  describe("o raster passa a ser só o recurso", () => {
    // CRLF vira LF: no Windows o checkout pode trazer \r\n.
    const camada = readFileSync(
      "src/modules/indigenous-territories-layer.ts",
      "utf8",
    ).replace(/\r\n/g, "\n");

    it("não há mais piso de zoom para o vetorial", () => {
      expect(camada).not.toContain("VECTOR_MIN_ZOOM");
      expect(camada).not.toContain("zoom < piso");
    });

    it("o recurso ao raster continua, para quando o catálogo falha", () => {
      expect(camada).toContain("recorrerAoRaster()");
    });

    /*
    Cruzar o zoom 7 troca de ficheiro. Sem o catálogo na chave, o mapa ficaria
    com o traçado largo depois de aproximar.
  */
    it("o catálogo entra na chave que evita redesenhar", () => {
      expect(camada).toContain("const key = [\n      urlDoCatalogo,");
    });
  });
});

bloco("mapa-no-painel-logado", () => {
  /*
  O QUE O PAINEL LOGADO MOSTROU

  Depois de publicada a camada nova, o mapa foi exercitado no painel em
  produção, com sessão aberta. Estes casos travam o que apareceu lá e que os
  testes anteriores não viam, porque só se vê com dados reais e navegador.
*/
  const camada = readFileSync(
    "src/modules/indigenous-territories-layer.ts",
    "utf8",
  );
  const css = readFileSync(
    "src/styles/indigenous-territories-layer.css",
    "utf8",
  );

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
        camada.indexOf("const recorrerAoRaster = () =>"),
        camada.indexOf("const clearVector = () =>"),
      );
      expect(fallback).toContain("rasterLayer.addTo(map)");
    });

    it("religar as terras não traz o raster de volta", () => {
      const fn = camada.slice(
        camada.indexOf("const definirVisibilidade = ("),
        camada.indexOf("const alternarFase = ("),
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
    it("o separador vai entre as partes", () => {
      expect(linhaDaTerra({ ufs: ["AL"], fase: "Regularizada" }).detalhe).toBe(
        "AL · Regularizada",
      );
      expect(linhaDaTerra({ fase: "Regularizada" }).detalhe).toBe(
        "Regularizada",
      );
    });
  });
});

bloco("mapa-render", () => {
  describe("raio da bolha do DSEI", () => {
    it("respeita o mínimo e o máximo declarados", () => {
      expect(raioDaBolha(0, 30000)).toBe(RAIO_MINIMO);
      expect(raioDaBolha(30000, 30000)).toBe(RAIO_MAXIMO);
      expect(raioDaBolha(60000, 30000)).toBe(RAIO_MAXIMO); // não estoura o teto
    });

    /*
    A área do círculo cresce com o quadrado do raio. Um raio proporcional à
    raiz da população faz a ÁREA ser proporcional à população — que é o que a
    pessoa lê no mapa. Quadruplicar a população tem de dobrar o raio útil.
  */
    it("mantém a área proporcional à população", () => {
      const opcoes = { minimo: 0, maximo: 20 };
      const r1 = raioDaBolha(2500, 10000, opcoes);
      const r4 = raioDaBolha(10000, 10000, opcoes);
      expect(r4 / r1).toBeCloseTo(2, 5);
    });

    it("não quebra com entrada ausente ou inválida", () => {
      expect(raioDaBolha(null, null)).toBe(RAIO_MINIMO);
      expect(raioDaBolha("x", 100)).toBe(RAIO_MINIMO);
    });

    /*
    O teto antigo era 25 px — 50 px de diâmetro, com 34 bolhas na visão
    nacional a cobrir o território que deviam situar.
  */
    it("o teto novo é bem menor que os 25 px antigos", () => {
      expect(RAIO_MAXIMO).toBeLessThan(25);
    });
  });

  describe("spiderfy dos pontos coincidentes", () => {
    it("devolve um deslocamento por registo", () => {
      expect(posicoesSpiderfy(0)).toEqual([]);
      expect(posicoesSpiderfy(57)).toHaveLength(57);
    });

    /*
    O deslocamento é em PIXELS e só existe no desenho. O código antigo somava
    0,55° à coordenada — cerca de 61 km — e quem lia o mapa via o DSEI longe de
    onde ele está.
  */
    it("nenhum deslocamento é uma coordenada", () => {
      posicoesSpiderfy(20).forEach((p) => {
        expect(Number.isInteger(p.x)).toBe(true);
        expect(Number.isInteger(p.y)).toBe(true);
        expect(Math.abs(p.x)).toBeLessThan(400);
        expect(Math.abs(p.y)).toBeLessThan(400);
      });
    });

    it("espalha em anéis para caber grupos grandes", () => {
      const p = posicoesSpiderfy(57);
      const raio = (q) => Math.hypot(q.x, q.y);
      expect(raio(p[56])).toBeGreaterThan(raio(p[0]));
    });

    it("não sobrepõe dois pontos do mesmo grupo", () => {
      const chaves = posicoesSpiderfy(24).map((p) => `${p.x},${p.y}`);
      expect(new Set(chaves).size).toBe(24);
    });
  });

  describe("agrupamento de coincidentes", () => {
    const ponto = (nome, lat, lon) => ({ name: nome, lat, lon });

    it("junta o mesmo ponto e preserva todos os registos", () => {
      const grupos = agruparCoincidentes([
        ponto("A", 4.596, -60.168),
        ponto("B", 4.596, -60.168),
        ponto("C", -2.5, -60.9),
      ]);
      expect(grupos).toHaveLength(2);
      expect(grupos.reduce((s, g) => s + g.registros.length, 0)).toBe(3);
    });

    it("ignora registo sem coordenada em vez de inventar ponto", () => {
      expect(agruparCoincidentes([ponto("X", null, null)])).toHaveLength(0);
    });
  });

  describe("registo de descarte", () => {
    it("desfaz um ouvinte de DOM", () => {
      const alvo = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
      const registo = criarRegistroDeDescarte();
      const h = () => {};
      registo.ouvir(alvo, "click", h);
      expect(alvo.addEventListener).toHaveBeenCalledWith("click", h, undefined);
      expect(registo.pendentes).toBe(1);
      registo.descartarTudo();
      expect(alvo.removeEventListener).toHaveBeenCalledWith(
        "click",
        h,
        undefined,
      );
      expect(registo.pendentes).toBe(0);
    });

    /*
    No `legacy-app.js` há um ResizeObserver por mapa e nenhum `disconnect()`.
    São dois ao todo, não um vazamento sem teto — as duas inicializações são
    guardadas. Ainda assim, quem cria tem de saber desfazer.
  */
    it("desconecta o observador de tamanho", () => {
      const disconnect = vi.fn();
      const observe = vi.fn();
      const original = globalThis.ResizeObserver;
      globalThis.ResizeObserver = class {
        constructor(cb) {
          this.cb = cb;
        }
        observe(...a) {
          observe(...a);
        }
        disconnect() {
          disconnect();
        }
      };
      try {
        const registo = criarRegistroDeDescarte();
        registo.observarTamanho({}, () => {});
        registo.descartarTudo();
        expect(observe).toHaveBeenCalled();
        expect(disconnect).toHaveBeenCalledTimes(1);
      } finally {
        globalThis.ResizeObserver = original;
      }
    });

    it("desfaz ouvinte do Leaflet com off", () => {
      const mapa = { on: vi.fn(), off: vi.fn() };
      const registo = criarRegistroDeDescarte();
      const h = () => {};
      registo.ouvirMapa(mapa, "moveend", h);
      registo.descartarTudo();
      expect(mapa.off).toHaveBeenCalledWith("moveend", h);
    });

    /*
    Uma limpeza que rebenta não pode impedir as seguintes — senão um erro só
    deixa observadores presos e o vazamento volta pela porta dos fundos.
  */
    it("uma limpeza que falha não trava as outras", () => {
      const registo = criarRegistroDeDescarte();
      const boa = vi.fn();
      registo.aoDescartar(boa);
      registo.aoDescartar(() => {
        throw new Error("falhou");
      });
      registo.aoDescartar(boa);
      expect(registo.descartarTudo()).toBe(2);
      expect(boa).toHaveBeenCalledTimes(2);
      expect(registo.pendentes).toBe(0);
    });
  });

  describe("agrupamento por célula de pixel", () => {
    // Projeção grosseira só para o teste: graus para pixels, linear.
    const paraPonto = (r) => ({
      x: (r.lon + 180) * 100,
      y: (90 - r.lat) * 100,
    });
    const p = (lat, lon, nome) => ({ lat, lon, name: nome });

    it("junta o que cai na mesma célula e separa o resto", () => {
      const g = agruparPorCelula(
        [p(1, 1, "A"), p(1.001, 1.001, "B"), p(-20, -50, "C")],
        paraPonto,
      );
      expect(g).toHaveLength(2);
      expect(g.reduce((s, x) => s + x.quantidade, 0)).toBe(3);
    });

    /*
    A âncora é a média das coordenadas REAIS dos membros. Um grupo de um só tem
    de ficar exactamente onde o registo está — senão o agrupamento vira mais uma
    forma de mover o ponto, que é o que esta rodada veio eliminar.
  */
    it("um grupo de um só não desloca o registo", () => {
      const [g] = agruparPorCelula([p(-9.4451, -70.4877, "X")], paraPonto);
      expect(g.lat).toBe(-9.4451);
      expect(g.lon).toBe(-70.4877);
      expect(g.unico.name).toBe("X");
    });

    it("expõe o registo original quando o grupo tem um só", () => {
      const g = agruparPorCelula(
        [p(1, 1, "A"), p(1.001, 1.001, "B")],
        paraPonto,
      );
      expect(g[0].unico).toBeNull();
      expect(g[0].registros).toHaveLength(2);
    });

    it("ignora registo sem coordenada ou sem projeção", () => {
      expect(agruparPorCelula([p(null, null, "N")], paraPonto)).toHaveLength(0);
      expect(agruparPorCelula([p(1, 1, "N")], () => null)).toHaveLength(0);
    });

    /*
    A célula é em pixels do ecrã, de propósito. Agrupar por graus juntaria
    demais perto do equador e de menos no sul, porque um grau de longitude
    encolhe com a latitude.
  */
    it("célula maior agrupa mais", () => {
      const pontos = [p(1, 1, "A"), p(1, 1.4, "B")];
      expect(agruparPorCelula(pontos, paraPonto, 20)).toHaveLength(2);
      expect(agruparPorCelula(pontos, paraPonto, 200)).toHaveLength(1);
    });
  });
});

bloco("mapa-saude-indigena", () => {
  /*
  O mapa da Saúde Indígena sem Leaflet (src/lib/mapas/mapa-saude-indigena/): as
  regras do `legacy-app.js` (bolhas, CASAIs nacionais, "Territórios por
  vagas", pontos do DSEI, vínculos, resumo da dica) como entrada → saída.
*/

  const edital = (unidade, vagas_total, contratados, status = "Concluído") => ({
    unidade,
    vagas_total,
    contratados,
    status,
  });

  describe("chaves", () => {
    it("casa o nome da unidade do edital com a chave do lmap", () => {
      expect(chaveDoDsei("DSEI Kaiapó de Mato Grosso")).toBe(
        chaveDoDsei("KAIAPO DO MATO GROSSO"),
      );
      expect(chaveDoDsei("DSEI Guamá-Tocantins")).toBe("GUAMA TOCANTINS");
      expect(chaveDoDsei("CASAI Nacional Brasília")).toBe("BRASILIA");
      expect(chaveDoDsei("")).toBe("");
    });

    it("coordenada exige as duas partes numéricas", () => {
      expect(temCoordenada(-3.7, -38.5)).toBe(true);
      expect(temCoordenada("-3.7", "-38.5")).toBe(true);
      expect(temCoordenada(null, -38.5)).toBe(false);
      expect(temCoordenada("", "")).toBe(false);
    });
  });

  describe("contagens e bolhas do mapa nacional", () => {
    const dseis = [
      { k: "CEARA", n: "Ceará", lat: -3.7, lon: -38.5, pop: 400, ufs: ["CE"] },
      { k: "YANOMAMI", n: "Yanomami", lat: 2.8, lon: -60.7, pop: 3600 },
      { k: "SEM COORDENADA", n: "Sem", lat: null, lon: null, pop: 10 },
    ];
    const linhas = [
      edital("DSEI Ceará", 10, 8),
      edital("DSEI CEARÁ", 5, 0),
      edital("DSEI Yanomami", 0, 0),
    ];

    it("conta editais, vagas e ociosas por DSEI", () => {
      const contagens = contarPorDsei(linhas);
      expect(contagens.get("CEARA")).toEqual({
        editais: 2,
        vagas: 15,
        contratadas: 8,
        ociosas: 7,
      });
      expect(contagens.get("YANOMAMI").editais).toBe(1);
    });

    it("a vaga reaberta em edital mais novo do DSEI conta uma vez só, como no KPI", () => {
      // O 78/2025 terminou com 6 vagas sem contratação, reabertas no 79/2026.
      const contagens = contarPorDsei([
        { ...edital("DSEI Altamira", 10, 4, "Concluído"), vagas_reabertas: 6 },
        edital("DSEI Altamira", 50, 0, "Em andamento"),
      ]);
      expect(contagens.get("ALTAMIRA")).toEqual({
        editais: 2,
        vagas: 54,
        contratadas: 4,
        ociosas: 0,
      });
    });

    it("conta como os KPIs: cancelado sem vagas, em seleção sem ociosas", () => {
      // DSEI Xavante, 10/11/2026: o 88/2026 cancelado (43 vagas) somava 43
      // ociosas na bolha, e as vagas dos editais em seleção também viravam
      // ociosas — o mapa dizia 1.118 ociosas na área e o KPI, 771.
      const contagens = contarPorDsei([
        edital("DSEI Xavante", 43, 0, "Cancelado"),
        edital("DSEI Xavante", 20, 5, "Em andamento"),
        edital("DSEI Xavante", 10, 12, "Concluído"),
        edital("DSEI Xavante", 8, 3, "Concluído"),
      ]);
      expect(contagens.get("XAVANTE")).toEqual({
        editais: 4,
        vagas: 38,
        contratadas: 18,
        ociosas: 5,
      });
      const [xavante] = territoriosPorVagas(
        bolhasDosDsei({
          dseis: [{ k: "XAVANTE", n: "Xavante", lat: -13, lon: -52, pop: 1 }],
          contagens,
        }),
      );
      // 18 de 38 vagas contratadas; as 15 em seleção não são ociosas.
      expect(xavante.preenchidas).toBe(47);
      expect(xavante.detalhe).toBe("5 ociosas · 4 processos · 1 hab.");
    });

    it("desenha os DSEIs com coordenada, do maior para o menor", () => {
      const bolhas = bolhasDosDsei({ dseis, contagens: contarPorDsei(linhas) });
      expect(bolhas.map((b) => b.chave)).toEqual(["YANOMAMI", "CEARA"]);
      expect(bolhas[0].raio).toBeGreaterThan(bolhas[1].raio);
      const ceara = bolhas[1];
      expect(ceara.estilo.fillColor).toBe(
        CORES_DO_MAPA.comEdital.preenchimento,
      );
      expect(ceara.estilo.weight).toBe(3);
      expect(ceara.ociosas).toBe(7);
    });

    it("com filtro ativo, só os DSEIs com edital no recorte", () => {
      const bolhas = bolhasDosDsei({
        dseis,
        contagens: contarPorDsei([edital("DSEI Ceará", 1, 0)]),
        filtroAtivo: true,
      });
      expect(bolhas.map((b) => b.chave)).toEqual(["CEARA"]);
    });

    it("territórios por vagas: ordem, preenchimento e situação", () => {
      const bolhas = bolhasDosDsei({ dseis, contagens: contarPorDsei(linhas) });
      const [primeiro, segundo] = territoriosPorVagas(bolhas);
      expect(primeiro.chave).toBe("CEARA");
      expect(primeiro.posicao).toBe(1);
      expect(primeiro.preenchidas).toBe(53);
      expect(primeiro.situacao).toBe("atencao");
      expect(primeiro.detalhe).toBe("7 ociosas · 2 processos · 400 hab.");
      // Sem vagas, desempata pela população.
      expect(segundo.chave).toBe("YANOMAMI");
      expect(segundo.preenchidas).toBe(0);
    });

    it("a dica da bolha diz população, rede, UFs, processos e ociosas", () => {
      const [ceara] = bolhasDosDsei({
        dseis: [dseis[0]],
        contagens: contarPorDsei(linhas),
      });
      const dica = dicaDaBolha(ceara, ["Polos base: 12"]);
      expect(dica.titulo).toBe("DSEI Ceará");
      expect(dica.linhas).toEqual([
        "População do DSEI: 400 indígenas",
        "Polos base: 12",
        "Estados administrativos: CE",
        "Processos seletivos: 2",
        "Vagas ociosas: 7 de 15",
      ]);
    });

    it("enquadra o Brasil sem filtro, um ponto ou a caixa com filtro", () => {
      const bolhas = bolhasDosDsei({ dseis, contagens: contarPorDsei(linhas) });
      expect(enquadramentoNacional({ bolhas }).modo).toBe("brasil");
      expect(
        enquadramentoNacional({ bolhas: bolhas.slice(0, 1), filtroAtivo: true })
          .modo,
      ).toBe("ponto");
      const caixa = enquadramentoNacional({ bolhas, filtroAtivo: true });
      expect(caixa.modo).toBe("caixa");
      expect(caixa.chave).not.toBe(enquadramentoNacional({ bolhas }).chave);
    });
  });

  describe("CASAIs nacionais", () => {
    const nac = [
      ["CASAI DF", "", -15.8, -47.9, "BRASILIA", 53, 0, 0, 0, null],
      [
        "CASAI SÃO PAULO",
        "123",
        -23.5,
        -46.6,
        "SAO PAULO",
        "SP",
        0,
        0,
        0,
        { coordenada_compartilhada_qtd: 3 },
      ],
    ];

    it("vêm do rede_cnes.nac, com UF por sigla e busca por cidade", () => {
      const casais = casaisNacionais({ nac });
      expect(casais.map((c) => [c.uf, c.termoDeBusca])).toEqual([
        ["DF", "CASAI BRASILIA"],
        ["SP", "CASAI SAO PAULO"],
      ]);
      expect(popupDaCasaiNacional(casais[1])).toEqual({
        titulo: "CASAI SÃO PAULO",
        linhas: [
          "Casa de Saúde Indígena (referência nacional)",
          "SAO PAULO – SP",
          "CNES: 123",
          "Processos seletivos: 0",
        ],
      });
    });

    it("com filtro, só a que tem edital no recorte", () => {
      const casais = casaisNacionais({
        nac,
        contagens: contarPorDsei([edital("CASAI DF", 1, 0)]),
        filtroAtivo: true,
      });
      expect(casais.map((c) => c.nome)).toEqual(["CASAI DF"]);
    });

    it("conta pela cidade o edital cadastrado como CASAI Brasília (o SIGEPSI diz CASAI DF)", () => {
      const casais = casaisNacionais({
        nac,
        contagens: contarPorDsei([
          edital("CASAI Brasília", 1, 0),
          edital("CASAI Brasília", 1, 0),
          edital("CASAI São Paulo", 1, 0),
        ]),
      });
      expect(casais.map((c) => [c.nome, c.editais])).toEqual([
        ["CASAI DF", 2],
        ["CASAI SÃO PAULO", 1],
      ]);
    });
  });

  describe("pontos de um DSEI", () => {
    const dsei = {
      k: "TESTE",
      n: "Teste",
      lat: -9.6,
      lon: -35.7,
      sedeuf: "AL",
      ufs: ["AL", "SE"],
      sede_municipio: "Maceió",
      sede_endereco: "Rua A, 1",
      sede_cnes: "999",
      // Os pontos do SIGEPSI (aplicarLocalizacoes); a UBSI vem repetida.
      polos: [
        { n: "XITEI", lat: -9.9, lon: -36.0, uf: "AL", tipo: "polo" },
        { n: "LONGE", lat: -8.0, lon: -35.0, uf: "PE", tipo: "polo" },
        ...[1, 2].map(() => ({
          n: "UBSI ALDEIA <b>",
          lat: -10.1,
          lon: -36.4,
          uf: "AL",
          tipo: "unidade",
          municipio: "PORTO REAL",
        })),
        {
          n: "CASAI AL/SE",
          lat: -9.62,
          lon: -35.73,
          uf: "AL",
          tipo: "casai",
          municipio: "MACEIO",
        },
      ],
    };

    it("só os pontos do SIGEPSI, com o tipo deles, sem repetir", () => {
      const registros = registrosDoDsei(dsei);
      const nomes = registros.map((r) => `${r.type.key}:${r.name}`);
      expect(nomes.filter((n) => n.includes("XITEI"))).toHaveLength(1);
      expect(nomes.filter((n) => n.includes("ALDEIA"))).toHaveLength(1);
      expect(nomes).toContain("casai:CASAI AL/SE");
      expect(nomes).toContain("polo:LONGE");
      expect(new Set(registros.map((r) => r.id)).size).toBe(registros.length);
    });

    it("vínculo: fora das UFs do DSEI é externo; o enquadramento do território o deixa de fora", () => {
      const classificados = classificarRegistros(registrosDoDsei(dsei), dsei);
      const externos = registrosExternos(classificados);
      expect(externos.map((r) => r.name)).toEqual(["LONGE"]);
      expect(registrosLocais(classificados)).toHaveLength(
        classificados.length - 1,
      );
      const limites = limitesDoDsei(dsei, classificados);
      expect(limites.completo).toHaveLength(limites.territorio.length + 1);
      expect(limites.territorio[0]).toEqual([-9.6, -35.7]);
      expect(textoDosVinculosExternos(1)).toBe("1 vínculo fora da área");
      expect(textoDosVinculosExternos(3)).toBe("3 vínculos fora da área");
      expect(textoDosVinculosExternos(0)).toBe("");
    });

    it("tipos do território, do mais frequente ao menos, e filtro por ocultos", () => {
      const registros = registrosDoDsei(dsei);
      const tipos = tiposDoTerritorio(registros);
      expect(tipos[0].tipo.key).toBe("polo");
      expect(
        visiveis(registros, new Set(["polo"])).every(
          (r) => r.type.key !== "polo",
        ),
      ).toBe(true);
    });

    it("resumo da dica: polos que o distrito tem e pontos que o mapa mostra", () => {
      const registros = registrosDoDsei(dsei);
      expect(resumoDaRede(dsei, registros)).toEqual([
        "Polos base: 2",
        "No mapa: 4 pontos (2 polos, 1 unidades, 1 CASAIs)",
      ]);
      expect(resumoDaRede({ k: "X" }, [])).toEqual([
        "Sem unidades cadastradas",
      ]);
    });

    it("popups e dicas são texto (sem HTML) e não falam de validação", () => {
      const [registro] = classificarRegistros(
        registrosDoDsei(dsei).filter((r) => r.name.includes("ALDEIA")),
        dsei,
      );
      const popup = popupDoRegistro(registro);
      expect(popup.titulo).toBe("UBSI");
      expect(popup.linhas).toEqual(["UBSI ALDEIA <b>", "PORTO REAL – AL"]);
      expect(popup.nota).toBeUndefined();
      expect(dicaDoRegistro(registro, dsei).linhas).toEqual([
        "Vinculado ao DSEI Teste",
        "Localização: AL",
      ]);
    });

    it("a sede: estrela fora dos totais, popup com endereço e origem", () => {
      expect(registroDaSede(dsei).type.key).toBe("sede");
      expect(registroDaSede({ k: "X" })).toBeNull();
      expect(popupDaSede(dsei)).toEqual({
        titulo: "Sede do DSEI Teste",
        linhas: ["Rua A, 1", "Maceió – AL"],
        nota: "Endereço do CNES 999",
      });
      expect(pontosDoDistrito(dsei, [])).toEqual([{ lat: -9.6, lon: -35.7 }]);
    });

    it("a linha da terra: povo não declarado é dito, não inventado", () => {
      expect(
        linhaDaTerra({
          nome: "Xucuru",
          povos: [],
          ufs: ["PE"],
          fase: "Regularizada",
          caixa: { oeste: 1, sul: 2, leste: 3, norte: 4 },
        }),
      ).toEqual({
        nome: "Xucuru",
        povos: "povo não declarado pela Funai",
        povoDeclarado: false,
        detalhe: "PE · Regularizada",
        caixa: { oeste: 1, sul: 2, leste: 3, norte: 4 },
      });
    });
  });

  describe("formas, cores e contornos (a cópia única, desde que o legado saiu)", () => {
    it("tipos desconhecidos ou herdados do protótipo usam a forma de unidade", () => {
      for (const tipo of [
        null,
        {},
        "desconhecido",
        "__proto__",
        "constructor",
        "toString",
      ]) {
        expect(formaDoTipo(tipo)).toBe(FORMAS.unit);
      }
      expect(formaDoTipo("sede")).toBe(FORMAS.sede);
    });
    it("cada tipo tem a sua forma e a sua cor, na ordem da legenda", () => {
      expect([...TIPOS_DA_LEGENDA]).toEqual([
        "sede",
        "polo",
        "casai",
        "ubsi",
        "unit",
      ]);
      expect(
        Object.fromEntries(
          TIPOS_DA_LEGENDA.map((tipo) => [
            tipo,
            [FORMAS[tipo].forma, FORMAS[tipo].cor],
          ]),
        ),
      ).toEqual({
        sede: ["estrela", "#1f2937"],
        polo: ["circulo", "#e49a1b"],
        casai: ["casa", "#d92d3a"],
        ubsi: ["cruz", "#6d28d9"],
        unit: ["losango", "#0d8192"],
      });
    });

    it("o tipo vem do nome da unidade", () => {
      expect(tipoDaUnidade("CASA DE SAÚDE INDÍGENA").key).toBe("casai");
      expect(tipoDaUnidade("POLO BASE X").key).toBe("polo");
      expect(tipoDaUnidade("UNIDADE BÁSICA Y").key).toBe("ubsi");
      expect(tipoDaUnidade("POSTO").key).toBe("unit");
    });

    it("os contornos moram só em contornos.js (o legado não tem mais cópia)", () => {
      const app = fonteDoApp();
      expect(app).not.toContain("const UF_GEO");
      expect(app).not.toContain("const BR_OUTLINE");
      expect(UF_GEO.features).toHaveLength(27);
      expect(BR_OUTLINE.type).toBe("MultiPolygon");
    });

    it("BRASIL_BOUNDS bate com os vértices do contorno", () => {
      const medido = boundsDoGeoJson(BR_OUTLINE);
      const arredondar = (v) => Number(v.toFixed(2));
      expect(medido.bounds.map((par) => par.map(arredondar))).toEqual([
        [...BRASIL_BOUNDS[0]],
        [...BRASIL_BOUNDS[1]],
      ]);
    });
  });
});

bloco("mapa-simples", () => {
  /*
  O "Mapa DSEIs" sem Leaflet (src/lib/mapas/mapa-saude-indigena/): a numeração
  oficial dos 34 DSEIs, as faixas da cor, o "sem dado", a dica e os contornos
  aceitos do arquivo local.
*/

  const territorio = (k, n, vagas, ociosas) => ({
    dsei: { k, n },
    chave: k,
    vagas,
    ociosas,
    preenchidas: vagas ? Math.round(((vagas - ociosas) / vagas) * 100) : 0,
  });

  describe("numeração dos 34 DSEIs", () => {
    it("são 34 nomes distintos, em ordem alfabética, de Alagoas e Sergipe a Yanomami", () => {
      expect(DSEIS_OFICIAIS).toHaveLength(34);
      expect(new Set(DSEIS_OFICIAIS).size).toBe(34);
      const ordenados = [...DSEIS_OFICIAIS].sort((a, b) =>
        a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
      );
      expect(DSEIS_OFICIAIS).toEqual(ordenados);
      expect(nomeOficialDoDsei(1)).toBe("Alagoas e Sergipe");
      expect(nomeOficialDoDsei(34)).toBe("Yanomami");
      expect(nomeOficialDoDsei(0)).toBeNull();
      expect(nomeOficialDoDsei(35)).toBeNull();
    });

    it("cada nome oficial dá o próprio número", () => {
      DSEIS_OFICIAIS.forEach((nome, i) =>
        expect(numeroDoDsei(nome)).toBe(i + 1),
      );
    });

    it("casa as grafias do lmap, do edital e de outras fontes", () => {
      expect(numeroDoDsei("KAIAPO DO MATO GROSSO")).toBe(14);
      expect(numeroDoDsei("DSEI Kaiapó de Mato Grosso")).toBe(14);
      expect(numeroDoDsei("DSEI Guamá-Tocantins")).toBe(12);
      expect(numeroDoDsei("GUAMA TOCANTINS")).toBe(12);
      expect(numeroDoDsei("Yanomami e Ye'kuana")).toBe(34);
      expect(numeroDoDsei("MEDIO RIO SOLIMOES E AFLUENTES")).toBe(22);
      expect(numeroDoDsei("Potiguara")).toBe(27);
      expect(numeroDoDsei("Porto Velho")).toBe(26);
    });

    it("o que não é um dos 34 fica sem número", () => {
      expect(numeroDoDsei("CASAI Nacional Brasília")).toBeNull();
      expect(numeroDoDsei("")).toBeNull();
      expect(numeroDoDsei(null)).toBeNull();
    });
  });

  describe("faixas da cor", () => {
    it("% preenchidas: cinco faixas fixas de 20 pontos", () => {
      const faixas = faixasDePreenchidas();
      expect(faixas.map((f) => f.rotulo)).toEqual([
        "0–19%",
        "20–39%",
        "40–59%",
        "60–79%",
        "80–100%",
      ]);
      expect(faixaDoValor(0, faixas)?.classe).toBe(1);
      expect(faixaDoValor(19, faixas)?.classe).toBe(1);
      expect(faixaDoValor(20, faixas)?.classe).toBe(2);
      expect(faixaDoValor(79, faixas)?.classe).toBe(4);
      expect(faixaDoValor(100, faixas)?.classe).toBe(5);
      expect(faixaDoValor(null, faixas)).toBeNull();
    });

    it("vagas ociosas: cinco faixas por quantis, sem buraco nem repetição", () => {
      const valores = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 20, 40, 60, 80, 100];
      const faixas = faixasDeOciosas(valores);
      expect(faixas).toHaveLength(5);
      expect(faixas[0].minimo).toBe(0);
      expect(faixas.at(-1).maximo).toBe(100);
      for (let i = 1; i < faixas.length; i += 1)
        expect(faixas[i].minimo).toBe(faixas[i - 1].maximo + 1);
      for (const v of valores) expect(faixaDoValor(v, faixas)).not.toBeNull();
    });

    it("poucos valores distintos dão menos faixas; nenhum valor, nenhuma", () => {
      expect(faixasDeOciosas([3, 3, 7]).map((f) => f.rotulo)).toEqual([
        "3",
        "4–7",
      ]);
      expect(faixasDeOciosas([])).toEqual([]);
    });

    it("menos de cinco faixas se espalham pela escala inteira", () => {
      expect(tokenDaClasse(1, 5)).toBe("--mapa-simples-seq-1");
      expect(tokenDaClasse(5, 5)).toBe("--mapa-simples-seq-5");
      expect(tokenDaClasse(1, 2)).toBe("--mapa-simples-seq-1");
      expect(tokenDaClasse(2, 2)).toBe("--mapa-simples-seq-5");
      expect(tokenDaClasse(1, 1)).toBe("--mapa-simples-seq-5");
    });

    it("'Colorir por' desconhecido volta ao padrão (Cor do DSEI, desde 11/11/2026)", () => {
      expect(colorirValido("ociosas")).toBe("ociosas");
      expect(colorirValido("preenchidas")).toBe("preenchidas");
      expect(colorirValido("calor")).toBe("dsei");
      expect(colorirValido(null)).toBe("dsei");
    });
  });

  describe("indicadores e sem dado", () => {
    const territorios = [
      territorio("YANOMAMI", "Yanomami", 40, 30),
      territorio("ALAGOAS E SERGIPE", "Alagoas e Sergipe", 10, 1),
      territorio("LESTE DE RORAIMA", "Leste de Roraima", 0, 0),
    ];

    it("os 34, na ordem, com os números da lista; quem não está ou não tem vaga fica sem dado", () => {
      const ind = indicadoresDosDseis(territorios);
      expect(ind).toHaveLength(34);
      expect(ind[33]).toMatchObject({
        numero: 34,
        nome: "Yanomami",
        vagas: 40,
        ociosas: 30,
        preenchidas: 25,
        temDado: true,
      });
      expect(ind[0].preenchidas).toBe(90);
      expect(ind[15]).toMatchObject({ numero: 16, temDado: false });
      expect(ind[15].preenchidas).toBeNull();
      expect(ind[1]).toMatchObject({
        numero: 2,
        territorio: null,
        temDado: false,
      });
    });

    it("pinta pela faixa e põe 'sem dado' na legenda", () => {
      const pintura = pintarDseis(
        indicadoresDosDseis(territorios),
        "preenchidas",
      );
      expect(pintura.tokens.get(34)).toBe("--mapa-simples-seq-2");
      expect(pintura.tokens.get(1)).toBe("--mapa-simples-seq-5");
      expect(pintura.tokens.get(16)).toBe(TOKEN_SEM_DADO);
      expect(pintura.legenda.at(-1)).toEqual({
        token: TOKEN_SEM_DADO,
        rotulo: "sem dado",
        semDado: true,
      });
      expect(pintura.legenda).toHaveLength(6);
    });

    it("vagas ociosas: faixas só com quem tem dado", () => {
      const pintura = pintarDseis(indicadoresDosDseis(territorios), "ociosas");
      expect(pintura.legenda.map((i) => i.rotulo)).toEqual([
        "1",
        "2–30",
        "sem dado",
      ]);
      expect(pintura.tokens.get(1)).toBe("--mapa-simples-seq-1");
      expect(pintura.tokens.get(34)).toBe("--mapa-simples-seq-5");
    });

    it("cor do DSEI: uma cor estável por número, sem 'sem dado'", () => {
      const pintura = pintarDseis(indicadoresDosDseis(territorios), "dsei");
      expect(pintura.tokens.get(16)).toBe("--mapa-simples-dsei-16");
      expect(pintura.tokens.size).toBe(34);
      expect(pintura.legenda).toEqual([]);
      // As cores só distinguem os distritos: a legenda diz que não é situação.
      expect(pintura.nota).toBe(NOTA_DA_COR_DO_DSEI);
    });

    it("nas faixas, a cor é a situação: sem a nota", () => {
      const ind = indicadoresDosDseis(territorios);
      expect(pintarDseis(ind, "preenchidas").nota).toBeUndefined();
      expect(pintarDseis(ind, "ociosas").nota).toBeUndefined();
    });

    it("a dica: número, nome, vagas, ociosas e % preenchidas", () => {
      const ind = indicadoresDosDseis(territorios);
      expect(dicaDoDseiSimples(ind[33])).toBe(
        "34 · Yanomami — 40 vagas, 30 ociosas, 25% preenchidas",
      );
      expect(dicaDoDseiSimples(ind[0])).toBe(
        "1 · Alagoas e Sergipe — 10 vagas, 1 ociosa, 90% preenchidas",
      );
      expect(dicaDoDseiSimples(ind[15])).toBe(
        "16 · Leste de Roraima — sem dado",
      );
    });
  });

  describe("contornos locais", () => {
    const quadrado = [
      [-40, -10],
      [-39, -10],
      [-39, -9],
      [-40, -9],
      [-40, -10],
    ];
    const feicao = (numero, extra = {}) => ({
      type: "Feature",
      properties: { numero, nome: "qualquer", rotulo: [-9.5, -39.5] },
      geometry: { type: "Polygon", coordinates: [quadrado] },
      ...extra,
    });

    it("aceita só número de 1 a 34, polígono válido e rótulo; o nome é o oficial", () => {
      const validos = contornosValidos({
        type: "FeatureCollection",
        features: [
          feicao(34),
          feicao(1),
          feicao(1),
          feicao(99),
          feicao(2, { geometry: { type: "Point", coordinates: [0, 0] } }),
          feicao(3, { properties: { numero: 3 } }),
        ],
      });
      expect(validos.map((f) => f.properties.numero)).toEqual([1, 34]);
      expect(validos[1].properties.nome).toBe("Yanomami");
    });

    it("arquivo estranho vira lista vazia", () => {
      expect(contornosValidos(null)).toEqual([]);
      expect(contornosValidos({ features: "x" })).toEqual([]);
    });
  });
});

bloco("municipios-da-resposta", () => {
  describe("fronteira dos municípios do mapa de Projetos", () => {
    it("ignora formatos sem lugar e não transforma objetos em nomes", () => {
      expect(municipiosDaResposta({ municipio_uf: "Irati/PR" })).toEqual([]);
      expect(
        municipiosDaResposta([
          null,
          [],
          "Irati/PR",
          { municipio_uf: {} },
          { uf: [] },
        ]),
      ).toEqual([]);
    });

    it("normaliza números válidos e descarta valores numéricos malformados", () => {
      const [lugar] = municipiosDaResposta([
        {
          municipio_uf: "Irati/PR",
          vagas: "5",
          vagas_edital: {},
          candidatos: Infinity,
          aprovados: [3],
          reprovados: "2",
          codigo_ibge: true,
          latitude: [],
          longitude: -50,
          editais: [
            { projeto: "CCE", vagas: true, lotacoes: [null, {}, " Irati/PR "] },
          ],
        },
      ]);
      expect(lugar).toMatchObject({
        vagas: 5,
        vagasEdital: null,
        candidatos: 0,
        aprovados: 0,
        reprovados: 2,
        codigoIbge: null,
        coordenada: null,
      });
      expect(lugar.editais[0]).toMatchObject({
        vagas: null,
        lotacoes: ["Irati/PR"],
      });
      expect(pontosDosMunicipios([lugar])[0].coordenadas).toBeNull();
    });

    it("distingue coordenada ausente no banco antigo de posição ainda não cadastrada", () => {
      const lugares = municipiosDaResposta([
        { municipio_uf: "Irati/PR" },
        { municipio_uf: "Irati/PR", latitude: null, longitude: null },
        {
          municipio_uf: "Irati/PR",
          latitude: "-25.4",
          longitude: "-50.6",
          coordenada_origem: "MANUAL",
        },
      ]);
      expect(lugares[0].coordenada).toBeUndefined();
      expect(lugares[1].coordenada).toBeNull();
      expect(lugares[2].coordenada).toEqual({
        latitude: -25.4,
        longitude: -50.6,
        origem: "MANUAL",
      });
      const pontos = pontosDosMunicipios(lugares);
      expect(
        pontos.find((ponto) => ponto.coordenada === undefined).coordenadas,
      ).not.toBeNull();
      expect(
        pontos.find((ponto) => ponto.coordenada === null).coordenadas,
      ).toBeNull();
    });
  });
});

bloco("nucleo-e-mapas-visuais", () => {
  /*
  Testes de invariante visual, no mesmo espírito de `shell-invariants.test.js`:
  leem o código-fonte em vez de montar a aplicação. Isso evita mocks de Supabase
  para verificar coisas que não dependem de dado nenhum — uma cor, um tamanho,
  um atributo de acessibilidade.
*/

  const semComentarios = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

  // Os mapas da Visão geral (React): o CSS da Saúde Indígena e o de Projetos.
  const mapaCss = semComentarios(
    readFileSync(
      "src/modulos/mapa-saude-indigena/mapa-saude-indigena.css",
      "utf8",
    ) +
      readFileSync("src/modulos/mapa-de-projetos/mapa-de-projetos.css", "utf8"),
  );
  const seletorCss = semComentarios(
    readFileSync("src/styles/map-base-layer-switcher.css", "utf8"),
  );

  /*
  Corpos de TODOS os blocos cujo grupo de seletores contém exatamente
  `seletor`. Um mesmo seletor costuma aparecer mais de uma vez — a legenda do
  mapa, por exemplo, recebe a borda num grupo e a cor noutro — e quem lê o
  ficheiro precisa de os ver todos.
*/
  function blocos(css, seletor) {
    const achados = css.split("}").filter((parte) => {
      const chave = parte.indexOf("{");
      if (chave === -1) return false;
      return parte
        .slice(0, chave)
        .split(",")
        .map((item) => item.trim())
        .includes(seletor);
    });
    if (!achados.length) throw new Error(`seletor não encontrado: ${seletor}`);
    return achados.map((parte) => parte.slice(parte.indexOf("{") + 1));
  }

  /** Último valor declarado para a propriedade — que é o que a cascata aplica. */
  function valor(css, seletor, propriedade, resolver = resolverToken) {
    const padrao = new RegExp(`(?:^|;)\\s*${propriedade}\\s*:\\s*([^;]+)`);
    const declarados = blocos(css, seletor)
      .map((corpo) => corpo.match(padrao)?.[1]?.trim())
      .filter(Boolean);
    if (!declarados.length)
      throw new Error(`${propriedade} não declarada em ${seletor}`);
    return resolver(declarados[declarados.length - 1]);
  }

  /*
  Cor em token (`var(--text-secondary)`) vira o hex do tema claro em tokens.css,
  para o contraste continuar sendo calculado, não suposto.
*/
  const tokensCss = semComentarios(
    readFileSync("src/styles/tokens.css", "utf8"),
  );
  const raizClara = tokensCss.slice(
    0,
    tokensCss.indexOf('[data-theme="dark"]'),
  );
  function resolverToken(valorCss) {
    const nome = valorCss.match(/^var\(\s*(--[\w-]+)/)?.[1];
    if (!nome) return valorCss;
    const achado = raizClara.match(new RegExp(`${nome}\\s*:\\s*([^;]+);`));
    if (!achado) throw new Error(`token ${nome} não existe em tokens.css`);
    // Os nomes do MONITORA apontam para os oficiais (--text-secondary → --color-text-secondary → hex).
    return resolverToken(achado[1].trim());
  }

  const canal = (valor) => {
    const c = valor / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };

  const luminancia = (hex) => {
    const limpo = hex.replace("#", "");
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(limpo.slice(i, i + 2), 16));
    return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
  };

  /** Razão de contraste da WCAG 2.1. Texto normal pede 4.5:1 para o nível AA. */
  const contraste = (frente, fundo) => {
    const [claro, escuro] = [luminancia(frente), luminancia(fundo)].sort(
      (a, b) => b - a,
    );
    return (claro + 0.05) / (escuro + 0.05);
  };

  const AA = 4.5;

  describe("convenção do tema escuro", () => {
    /*
    O tema é um atributo — `data-theme="dark"` no `<html>` — e existe o espelho
    vivo `body.dark-mode`. A classe `dark`, que nada neste repositório adiciona,
    já custou 38 seletores que nunca chegaram a valer.
  */
    it("nenhuma folha volta a depender da classe `dark`, que ninguém aplica", () => {
      const culpadas = readdirSync("src/styles")
        .filter((nome) => nome.endsWith(".css"))
        .filter((nome) =>
          /(?:^|[\s,>])(?:html|body)\.dark(?![-\w])/.test(
            readFileSync(`src/styles/${nome}`, "utf8"),
          ),
        );
      expect(culpadas).toEqual([]);
    });
  });

  describe("legibilidade e contraste dos mapas", () => {
    it("nenhum texto do workspace fica abaixo de 10px", () => {
      const miudos = [...mapaCss.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)]
        .map((achado) => Number(achado[1]))
        .filter((tamanho) => tamanho < 10);
      expect(miudos).toEqual([]);
    });

    /*
    Cores e contraste dos painéis vêm dos tokens (src/styles/tokens.css), que
    o tema escuro redefine: os mapas não declaram cor de texto em hex. Os
    testes de contraste do workspace antigo (health-map-workspace.css e
    health-reference-kpis.css) saíram com ele.
  */
    it("os mapas não fixam cor de texto em hex", () => {
      expect(mapaCss).not.toMatch(/(^|[^-])color:s*#[0-9a-f]{3,6}/i);
    });
  });

  describe("seletor de camada Mapa/Satélite", () => {
    /*
    O botão selecionado é o que mais precisa de se ler, e o anel de foco é o
    que diz a quem navega por teclado onde está. Os dois falhavam no escuro:
    3.78:1 no texto e 2.47:1 no anel.
  */
    /*
    Desde o controle segmentado do Design System (10.5) o seletor não tem
    cores próprias no escuro: usa `--surface-*` e `--text-*`, que tokens.css
    redefine em `html[data-theme="dark"]`. O contraste do escuro passa a ser
    calculado resolvendo o mesmo token no bloco escuro.
  */
    const ATIVO = '.agsus-basemap-switcher__button[aria-pressed="true"]';
    const bloco = tokensCss.slice(tokensCss.indexOf('html[data-theme="dark"]'));
    const raizEscura = bloco.slice(0, bloco.indexOf("}"));
    const resolverTokenEscuro = (valorCss) => {
      const nome = valorCss.match(/^var\(\s*(--[\w-]+)/)?.[1];
      if (!nome) return valorCss;
      const achado = raizEscura.match(new RegExp(`${nome}\\s*:\\s*([^;]+);`));
      return achado
        ? resolverTokenEscuro(achado[1].trim())
        : resolverToken(valorCss);
    };
    const bruto = (seletor, propriedade) =>
      blocos(seletorCss, seletor)
        .map(
          (corpo) =>
            corpo.match(
              new RegExp(`(?:^|;)\\s*${propriedade}\\s*:\\s*([^;]+)`),
            )?.[1],
        )
        .filter(Boolean)
        .pop()
        .trim();

    it("o botão ativo passa o AA no tema escuro", () => {
      const fundo = resolverTokenEscuro(bruto(ATIVO, "background"));
      const cor = resolverTokenEscuro(bruto(ATIVO, "color"));
      expect(fundo).toMatch(/^#/);
      expect(contraste(cor, fundo)).toBeGreaterThanOrEqual(AA);
    });

    it("o segmento inativo passa o AA sobre o trilho nos dois temas", () => {
      const trilho = bruto(".agsus-basemap-switcher", "background");
      const texto = bruto(".agsus-basemap-switcher__button", "color");
      expect(
        contraste(resolverToken(texto), resolverToken(trilho)),
      ).toBeGreaterThanOrEqual(AA);
      expect(
        contraste(resolverTokenEscuro(texto), resolverTokenEscuro(trilho)),
      ).toBeGreaterThanOrEqual(AA);
    });

    it("o botão ativo passa o AA no tema claro", () => {
      const fundo = valor(
        seletorCss,
        '.agsus-basemap-switcher__button[aria-pressed="true"]',
        "background",
      );
      const cor = valor(
        seletorCss,
        '.agsus-basemap-switcher__button[aria-pressed="true"]',
        "color",
      );
      expect(contraste(cor, fundo)).toBeGreaterThanOrEqual(AA);
    });

    /*
    O anel de foco não é verificável por uma cor fixa: quem o governa é o
    `!important` de `app.css`, e a cor que este ficheiro escrevesse ficaria
    inerte. As três propriedades abaixo são o que de facto o torna visível.

    `currentColor` amarra o anel à cor do texto do botão, que os dois testes
    acima já obrigam a passar o AA contra o fundo desse botão — não há como o
    anel ficar invisível sem que o rótulo fique primeiro.

    O deslocamento negativo mantém o anel dentro do botão. Com deslocamento
    positivo ele é recortado pelo `overflow: hidden` do container e o que
    sobra cai sobre os ladrilhos do mapa, cuja cor ninguém controla.
  */
    it("o anel de foco herda a cor do texto e fica dentro do botão", () => {
      const regra = blocos(
        seletorCss,
        ".agsus-basemap-switcher__button:focus-visible",
      ).join(" ");
      expect(regra).toMatch(/outline:[^;]*currentColor/);
      expect(regra).toMatch(/outline-offset:\s*-\d/);
    });

    it("o anel de foco vence o !important global de app.css", () => {
      const regra = blocos(
        seletorCss,
        ".agsus-basemap-switcher__button:focus-visible",
      ).join(" ");
      expect(regra).toMatch(/outline:[^;]*!important/);
      expect(regra).toMatch(/outline-offset:[^;]*!important/);
    });
  });
});

bloco("regras-geograficas-fronteiras", () => {
  describe("fronteiras das regras geográficas", () => {
    it("ordena territórios sem modificar a lista congelada de bolhas", () => {
      const dseis = Object.freeze([
        { k: "MAIOR", n: "Maior", lat: 1, lon: 2, pop: 1000 },
        { k: "MENOR", n: "Menor", lat: 3, lon: 4, pop: 100 },
      ]);
      const contagens = new Map([
        ["MAIOR", { editais: 1, vagas: 2, contratadas: 2, ociosas: 0 }],
        ["MENOR", { editais: 1, vagas: 10, contratadas: 0, ociosas: 10 }],
      ]);
      const bolhas = Object.freeze(bolhasDosDsei({ dseis, contagens }));
      expect(territoriosPorVagas(bolhas).map((b) => b.chave)).toEqual([
        "MENOR",
        "MAIOR",
      ]);
      expect(bolhas.map((b) => b.chave)).toEqual(["MAIOR", "MENOR"]);
      expect(bolhas.every((b) => !("posicao" in b))).toBe(true);
    });
  });
});

bloco("respostas-do-editor-de-coordenadas", () => {
  describe("respostas externas do editor de coordenadas", () => {
    it("aceita somente listas e registros nas pendências e mantém a identidade do mapa", () => {
      expect(pendenciasDoEditor({ candidatos: [] })).toEqual([]);
      const pendencias = pendenciasDoEditor([
        null,
        [],
        "erro",
        {
          lugar: "irati/PR",
          fonte: "lmap",
          motivo: { texto: "erro" },
          conferido: "false",
          candidatos: {},
        },
      ]);
      expect(pendencias).toEqual([
        {
          lugar: "irati/PR",
          fonte: "lmap",
          motivo: undefined,
          conferido: false,
          candidatos: [],
        },
      ]);
    });
    it("mantém sugestões utilizáveis com textos ausentes e descarta candidatos sem posição escalar", () => {
      const [pendencia] = pendenciasDoEditor([
        {
          conferido: true,
          candidatos: [
            null,
            { f: "CNES", lat: "-12", lon: -50, n: null, ti: { texto: "TI" } },
            { f: "IBGE", lat: [], lon: -51 },
          ],
        },
      ]);
      expect(pendencia.candidatos).toEqual([
        { f: "CNES", lat: "-12", lon: -50, n: undefined, ti: undefined },
      ]);
      expect(pendencia.conferido).toBe(true);
    });
    it("preserva o histórico válido e não permite desfazer uma posição anterior inválida", () => {
      const item = {
        id: 1,
        acao: "CORRECAO",
        latitude_anterior: -12,
        longitude_anterior: -50,
        latitude: -13,
        longitude: -51,
        por: "Ana",
        motivo: "Conferência no CNES",
        em: "2026-10-08T12:00:00Z",
      };
      const historico = historicoDoEditor([item]);
      expect(historico[0]).toMatchObject(item);
      expect(correcaoDesfazivel(historico)?.id).toBe(1);
      expect(
        correcaoDesfazivel(
          historicoDoEditor([{ ...item, latitude_anterior: "-12" }]),
        ),
      ).toBeNull();
      expect(
        correcaoDesfazivel(historicoDoEditor([{ ...item, desfeito: true }])),
      ).toBeNull();
      expect(historicoDoEditor([{ ...item, desfeito: "sim" }])).toEqual([]);
    });
    it("não promove uma alteração antiga quando a mais recente é malformada", () => {
      expect(
        historicoDoEditor([
          null,
          {
            id: 1,
            acao: "CORRECAO",
            latitude_anterior: -12,
            longitude_anterior: -50,
          },
        ]),
      ).toEqual([]);
      expect(historicoDoEditor({ id: 1 })).toEqual([]);
    });
    it("rejeita respostas de gravação com campos escalares malformados", () => {
      for (const resposta of [
        null,
        [],
        { latitude: [] },
        { longitude: Infinity },
        { conferido: "sim" },
        { lugar: {} },
      ])
        expect(correcaoDoEditor(resposta)).toBeNull();
    });
    it("preserva o payload dos dois mapas e conferido falso sem coerção", () => {
      const projetos = {
        lugar: "irati/PR",
        latitude: -12,
        longitude: "-50",
        conferido: false,
      };
      expect(correcaoDoEditor(projetos)).toEqual(projetos);
      expect(correcaoDoEditor({ ...projetos, conferido: null })).toEqual({
        ...projetos,
        conferido: null,
      });
      const indigena = {
        lmap: { dsei: [] },
        rede_cnes: { rede: {} },
        conferido: true,
      };
      expect(correcaoDoEditor(indigena)).toEqual(indigena);
    });
  });
});

bloco("sede-do-dsei-e-casai", () => {
  /*
  A SEDE DO DSEI NÃO TINHA FORMA NENHUMA

  Ela era desenhada — um `circleMarker` azul escrito à mão —, mas fora da tabela
  de formas: sem entrar na legenda, sem forma própria, indistinguível de um polo
  base para quem só via dois círculos. É o ponto administrativo do distrito
  inteiro, e era o único que o mapa não sabia nomear.
*/
  describe("a sede tem forma própria", () => {
    it("é estrela, que é como sede se desenha num mapa", () => {
      expect(formaDoTipo("sede").forma).toBe("estrela");
      expect(formaDoTipo("sede").rotulo).toBe("Sede do DSEI");
    });

    it("a estrela tem desenho, e não cai no losango de reserva", () => {
      expect(DESENHO_DAS_FORMAS.estrela).toBeTruthy();
      expect(DESENHO_DAS_FORMAS.estrela).not.toBe(DESENHO_DAS_FORMAS.losango);
    });

    /*
    Os quatro matizes existentes estão em 38°, 355°, 263° e 188°, com o par mais
    próximo a 43°. Encaixar um quinto sem colidir obrigaria a ir ao verde, que é
    onde a vegetação do mapa está. A sede resolve isso não tendo cor — e ser a
    única sem cor é o que a distingue.
  */
    it("é o único marcador sem cor", () => {
      const croma = (hex) => {
        const [r, g, b] = [1, 3, 5].map((i) =>
          parseInt(hex.slice(i, i + 2), 16),
        );
        return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
      };
      expect(croma(formaDoTipo("sede").cor)).toBeLessThan(0.1);
      for (const chave of ["polo", "casai", "ubsi", "unit"]) {
        expect(croma(formaDoTipo(chave).cor)).toBeGreaterThan(0.4);
      }
    });

    /*
    O marcador dela sai do mesmo caminho dos outros (o tipo, com a cor da
    tabela de formas — uma fonte só, nada a manter em sincronia).
  */
    const dsei = { k: "ALTAMIRA", n: "Altamira", lat: -3.2, lon: -52.2 };

    it("o marcador dela sai do mesmo caminho dos outros", () => {
      const sede = registroDaSede(dsei);
      expect(sede.type.key).toBe("sede");
      expect(sede.type.color).toBe(formaDoTipo("sede").cor);
      expect([sede.lat, sede.lon]).toEqual([-3.2, -52.2]);
    });

    /*
    A sede não é unidade de saúde. Contá-la nos registros do DSEI mudaria os
    totais da dica e criaria um filtro por tipo para uma coisa só.
  */
    it("não entra na contagem das unidades", () => {
      const registros = registrosDoDsei(
        { ...dsei, polos: [{ n: "POLO X", lat: -3.5, lon: -52.5 }] },
        { rede: {}, nac: [] },
      );
      expect(registros.length).toBeGreaterThan(0);
      expect(registros.some((r) => r.type?.key === "sede")).toBe(false);
    });
  });
});

bloco("sobreposicao-na-tela", () => {
  /*
  DOIS REGISTOS A DEZ METROS SÃO UM PIXEL SÓ

  `agruparCoincidentes` junta o que partilha a coordenada até à quinta casa —
  cerca de um metro. No DSEI Ceará há dois pares a dez metros, que passavam por
  esse crivo e ficavam um em cima do outro, sem leque e sem forma de clicar no
  de baixo:

    440205  UBSI Guiomar Alves Julião, Rua Santa Rosa
    9566201 UBSI Reserva Taba Anacé, CE-085 km 13

    9565302 Polo Base Potyró, BR-222 Jandaiguaba
    9566171 UBSI Victor Tapeba, BR-222 Capuan

  Os endereços no CNES são diferentes; as coordenadas, não. O cadastro é que
  dá quase o mesmo ponto a lugares distintos — o mapa não conserta isso, mas
  para de esconder um atrás do outro.
*/
  const caucaia = [
    { nome: "UBSI Guiomar Alves Julião", lat: -3.732944, lon: -38.656018 },
    { nome: "UBSI Reserva Taba Anacé", lat: -3.73303, lon: -38.655975 },
  ];

  // Projeção de brincar: 1 grau = 100 000 px. A 10 m dão ~9 px de distância.
  const projetarDeDistrito = (r) => ({ x: r.lon * 100000, y: -r.lat * 100000 });
  // Aproximado vinte vezes mais: os mesmos 10 m passam a ~180 px.
  const projetarDeRua = (r) => ({ x: r.lon * 2000000, y: -r.lat * 2000000 });

  describe("o agrupamento antigo não via estes dois", () => {
    it("dez metros passam pelo crivo da quinta casa decimal", () => {
      expect(agruparCoincidentes(caucaia)).toHaveLength(2);
    });
  });

  describe("agrupamento por proximidade na tela", () => {
    it("junta os que caem no mesmo punhado de pixels", () => {
      const grupos = agruparPorProximidadeNaTela(caucaia, projetarDeDistrito);
      expect(grupos).toHaveLength(1);
      expect(grupos[0].registros).toHaveLength(2);
    });

    /*
    Ampliado, os dez metros viram um quarteirão. Aí são dois pontos mesmo, e
    juntá-los seria mentir sobre a distância entre eles.
  */
    it("separa os mesmos dois quando o zoom os distingue", () => {
      expect(agruparPorProximidadeNaTela(caucaia, projetarDeRua)).toHaveLength(
        2,
      );
    });

    it("a coordenada do grupo é a de um registo real, não uma média", () => {
      const [grupo] = agruparPorProximidadeNaTela(caucaia, projetarDeDistrito);
      const original = caucaia.some(
        (r) => r.lat === grupo.lat && r.lon === grupo.lon,
      );
      expect(original).toBe(true);
    });

    it("quem está longe fica sozinho", () => {
      const registos = [
        ...caucaia,
        { nome: "Itarema", lat: -2.9845, lon: -39.8236 },
      ];
      const grupos = agruparPorProximidadeNaTela(registos, projetarDeDistrito);
      expect(grupos).toHaveLength(2);
      expect(grupos.map((g) => g.registros.length).sort()).toEqual([1, 2]);
    });

    it("descarta registo sem coordenada utilizável", () => {
      const grupos = agruparPorProximidadeNaTela(
        [{ nome: "sem coord", lat: null, lon: null }, ...caucaia],
        projetarDeDistrito,
      );
      expect(grupos).toHaveLength(1);
      expect(grupos[0].registros).toHaveLength(2);
    });

    it("descarta o que a projeção não sabe posicionar", () => {
      const grupos = agruparPorProximidadeNaTela(caucaia, () => ({
        x: Number.NaN,
        y: 0,
      }));
      expect(grupos).toEqual([]);
    });

    /*
    Sem projeção não se inventa uma: volta-se ao comportamento antigo, que é
    conservador e nunca junta o que não partilha a coordenada.
  */
    it("sem projeção, cai no agrupamento por coordenada", () => {
      expect(agruparPorProximidadeNaTela(caucaia)).toHaveLength(2);
      expect(agruparPorProximidadeNaTela(caucaia, "não é função")).toHaveLength(
        2,
      );
    });

    it("aguenta lista vazia", () => {
      expect(agruparPorProximidadeNaTela([], projetarDeDistrito)).toEqual([]);
      expect(
        agruparPorProximidadeNaTela(undefined, projetarDeDistrito),
      ).toEqual([]);
    });

    it("a tolerância é do tamanho de um marcador", () => {
      expect(SOBREPOSICAO_EM_PIXELS).toBe(14);
    });
  });
});

bloco("terra-destaque-no-mapa", () => {
  /*
  Clicar numa terra indígena mostrava um retângulo em volta dela: o anel de
  foco que o Chrome desenha num <path> SVG é a caixa da forma, não o limite.
  O destaque passa a ser o traço da própria terra, ao passar o mouse.
*/
  const css = readFileSync(
    "src/styles/indigenous-territories-layer.css",
    "utf8",
  );
  const js = readFileSync(
    "src/modules/indigenous-territories-layer.ts",
    "utf8",
  );

  describe("destaque da terra indígena no mapa", () => {
    it("as formas do Leaflet não ganham o anel de foco retangular", () => {
      expect(css).toMatch(
        /\.leaflet-container path\.leaflet-interactive:focus\s*\{\s*outline:\s*none;/,
      );
    });

    it("cada terra engrossa o próprio traço ao passar o mouse e volta ao sair", () => {
      const aoCriar = js.slice(
        js.indexOf("onEachFeature: (feature, layer) =>"),
      );
      expect(aoCriar.slice(0, 200)).toContain(
        "destacarAoPassar(feature, layer)",
      );
      const funcao = js.slice(js.indexOf("function destacarAoPassar"));
      expect(funcao).toContain('layer.on("mouseover"');
      expect(funcao).toContain("weight: base.weight + 2");
      expect(funcao).toContain(
        'layer.on("mouseout", () => layer.setStyle(estiloComDestaque(feature)))',
      );
    });
  });
});

bloco("terras-do-dsei", () => {
  /*
  Um quadrado de um grau em volta de um ponto, para não escrever polígonos à
  mão em cada caso.
*/
  const terraEm = (lat, lon, lado = 0.2) => ({
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [lon - lado, lat - lado],
          [lon + lado, lat - lado],
          [lon + lado, lat + lado],
          [lon - lado, lat + lado],
          [lon - lado, lat - lado],
        ],
      ],
    },
  });

  /*
  O botão "Terras Indígenas" mostrava um quadrado vermelho sobre satélite e o
  mapa desenhava verde. A cor vermelha só existia no desenho vetorial, e na
  visão nacional quem desenha é o raster da Funai, com a simbologia dela.

  O WMS da Funai publica dois estilos para `tis_poligonais` — `terras_indigenas`
  e `polygon` — e nenhum é vermelho. Não há como alinhar pelo vermelho, só pelo
  verde. Estes casos impedem a segunda cor de voltar.
*/
  describe("uma cor só para a Terra Indígena", () => {
    const modulo = [
      "src/modules/indigenous-territories-layer.ts",
      ...readdirSync("src/lib/mapas/terras-indigenas").map(
        (nome) => `src/lib/mapas/terras-indigenas/${nome}`,
      ),
    ]
      .map((caminho) => readFileSync(caminho, "utf8"))
      .join("\n");
    const css = readFileSync(
      "src/styles/indigenous-territories-layer.css",
      "utf8",
    );
    const cssLegenda = readFileSync(
      "src/modulos/mapa-saude-indigena/mapa-saude-indigena.css",
      "utf8",
    );

    it("o vermelho não volta ao estilo da camada", () => {
      expect(modulo).not.toContain("#ff4d3d");
      expect(modulo).not.toContain("#ef4444");
    });

    it("o quadrado do botão não muda com o mapa base", () => {
      expect(css).not.toContain(
        ".map-satellite-mode .agsus-indigenous-territories-control__swatch {",
      );
    });

    it("o quadrado da legenda não muda com o mapa base", () => {
      expect(cssLegenda).not.toContain(
        ".map-satellite-mode .health-map-legenda-terra {",
      );
    });
  });

  describe("geometria de apoio", () => {
    it("lê Polygon e MultiPolygon", () => {
      expect(poligonosDaFeature(terraEm(-12, -38))).toHaveLength(1);
      expect(
        poligonosDaFeature({
          geometry: { type: "MultiPolygon", coordinates: [[], []] },
        }),
      ).toHaveLength(2);
      expect(poligonosDaFeature({ geometry: { type: "Point" } })).toEqual([]);
      expect(poligonosDaFeature(null)).toEqual([]);
    });

    it("mede a caixa do polígono", () => {
      const caixa = caixaDeCoordenadas(poligonosDaFeature(terraEm(-12, -38)));
      expect(caixa.sul).toBeCloseTo(-12.2, 5);
      expect(caixa.norte).toBeCloseTo(-11.8, 5);
    });

    it("sabe o que está dentro do polígono", () => {
      const polys = poligonosDaFeature(terraEm(-12, -38));
      expect(pontoEmPoligonos([-38, -12], polys)).toBe(true);
      expect(pontoEmPoligonos([-30, -12], polys)).toBe(false);
    });
  });

  /*
  A Funai deixou de publicar a abrangência dos DSEIs — `Funai:areas_dsei`
  responde "Feature type unknown". A relação passa a sair das unidades do
  próprio distrito, e estes casos fixam o que essa regra promete.
*/
  describe("que terras são deste DSEI", () => {
    const terra = terraEm(-12, -38);

    it("entra quando o DSEI tem unidade dentro dela", () => {
      expect(terraPertenceAoDsei(terra, [{ lat: -12, lon: -38 }])).toBe(true);
    });

    it("entra quando o DSEI tem unidade perto, ainda que fora", () => {
      // ~33 km a norte do centro, fora do polígono, dentro do raio.
      expect(terraPertenceAoDsei(terra, [{ lat: -11.7, lon: -38 }])).toBe(true);
    });

    /*
    Xerente está a mais de 500 km de qualquer unidade do DSEI Bahia, e era uma
    das que apareciam no mapa da Bahia.
  */
    it("fica de fora quando a unidade mais próxima está longe demais", () => {
      expect(terraPertenceAoDsei(terra, [{ lat: -10, lon: -48 }])).toBe(false);
    });

    it("o raio é 50 km, e é ele que decide", () => {
      expect(RAIO_DE_ATENDIMENTO_KM).toBe(50);
      // 1 grau de latitude ≈ 111 km: 0,6 grau são ~67 km, fora; 0,4 são ~44, dentro.
      expect(terraPertenceAoDsei(terra, [{ lat: -12.6, lon: -38 }])).toBe(
        false,
      );
      expect(terraPertenceAoDsei(terra, [{ lat: -12.4, lon: -38 }])).toBe(true);
    });

    it("sem unidades não filtra nada — é a visão nacional", () => {
      expect(terraPertenceAoDsei(terra, [])).toBe(true);
      expect(terraPertenceAoDsei(terra)).toBe(true);
    });

    it("ignora unidade sem coordenada utilizável", () => {
      expect(
        terraPertenceAoDsei(terra, [
          { lat: null, lon: null },
          { lat: -10, lon: -48 },
        ]),
      ).toBe(false);
    });

    it("uma terra sem geometria não entra", () => {
      expect(terraPertenceAoDsei({}, [{ lat: -12, lon: -38 }])).toBe(false);
    });
  });

  /*
  O CRIVO DA UF

  O raio não conhece fronteira. No DSEI Bahia entravam 8 terras de outros
  estados, puxadas por unidades do São Francisco que estão mesmo a menos de
  50 km de terras de Pernambuco. Medido sobre os dados reais: 25 terras de UF
  alheia, em 7 distritos. Com o crivo, zero.
*/
  describe("a UF declarada como segundo crivo", () => {
    const perto = [{ lat: -12, lon: -38 }];
    const terraEmBahia = {
      ...terraEm(-12, -38),
      properties: { uf_sigla: "BA" },
    };
    const terraEmPernambuco = {
      ...terraEm(-12, -38),
      properties: { uf_sigla: "PE" },
    };

    it("a terra do estado que o distrito atende entra", () => {
      expect(terraPertenceAoDsei(terraEmBahia, perto, ["BA"])).toBe(true);
    });

    it("a terra de outro estado fica de fora, mesmo estando perto", () => {
      expect(terraPertenceAoDsei(terraEmPernambuco, perto, ["BA"])).toBe(false);
    });

    /*
    Catorze combinações de duas UFs aparecem na camada da Funai — "AM,PA",
    "PR,SC", "MT,RO". Uma terra que atravessa estados é atendida pelos dois
    lados, e basta uma sigla bater.
  */
    it("a terra que atravessa estados entra por qualquer um deles", () => {
      const atravessa = {
        ...terraEm(-12, -38),
        properties: { uf_sigla: "AM,PA" },
      };
      expect(terraPertenceAoDsei(atravessa, perto, ["PA"])).toBe(true);
      expect(terraPertenceAoDsei(atravessa, perto, ["AM"])).toBe(true);
      expect(terraPertenceAoDsei(atravessa, perto, ["BA"])).toBe(false);
    });

    it("sem UF de um dos lados, o crivo não se aplica", () => {
      expect(terraPertenceAoDsei(terraEmBahia, perto, [])).toBe(true);
      expect(terraPertenceAoDsei(terraEm(-12, -38), perto, ["BA"])).toBe(true);
    });

    it("não se deixa enganar por caixa ou espaço", () => {
      expect(terraPertenceAoDsei(terraEmBahia, perto, [" ba "])).toBe(true);
    });

    it("o crivo da UF não salva quem está longe", () => {
      expect(
        terraPertenceAoDsei(terraEmBahia, [{ lat: -5, lon: -38 }], ["BA"]),
      ).toBe(false);
    });
  });

  /*
  No DSEI Bahia os nomes saíam uns por cima dos outros — "Tuxá", "Pankarú" e
  "Kiriri" no mesmo punhado de pixels, ilegíveis os três.
*/
  describe("rótulos que não se pisam", () => {
    it("descarta o rótulo que cai em cima de outro", () => {
      const aceites = rotulosSemColisao([
        { x: 100, y: 100, texto: "Kiriri", peso: 40 },
        { x: 110, y: 105, texto: "Tuxá", peso: 10 },
      ]);
      expect(aceites).toHaveLength(1);
      expect(aceites[0].texto).toBe("Kiriri");
    });

    it("a terra maior fica com o rótulo", () => {
      const aceites = rotulosSemColisao([
        { x: 100, y: 100, texto: "pequena", peso: 5 },
        { x: 108, y: 100, texto: "grande", peso: 90 },
      ]);
      expect(aceites[0].texto).toBe("grande");
    });

    it("mantém os que estão suficientemente afastados", () => {
      const aceites = rotulosSemColisao([
        { x: 0, y: 0, texto: "a", peso: 1 },
        { x: 400, y: 400, texto: "b", peso: 1 },
        { x: 800, y: 0, texto: "c", peso: 1 },
      ]);
      expect(aceites).toHaveLength(3);
    });

    it("descarta candidato sem posição projetável", () => {
      const aceites = rotulosSemColisao([
        { x: Number.NaN, y: 10, texto: "a", peso: 1 },
        { x: undefined, y: undefined, texto: "b", peso: 1 },
      ]);
      expect(aceites).toEqual([]);
    });

    it("aguenta lista vazia", () => {
      expect(rotulosSemColisao([])).toEqual([]);
      expect(rotulosSemColisao()).toEqual([]);
    });

    it("a distância mínima é a de um rótulo legível", () => {
      expect(DISTANCIA_MINIMA_ENTRE_ROTULOS_PX).toBe(64);
    });
  });
});

bloco("terras-em-estudo", () => {
  /*
  AS TERRAS QUE AINDA NÃO TÊM LIMITE

  `tis_poligonais` traz seis fases — Regularizada, Declarada, Delimitada,
  Encaminhada RI, Homologada e Em Estudo —, mas só quem já tem limite
  desenhado. As 163 terras em estudo sem limite definido existem apenas como
  ponto, na camada `tis_pontos`.

  Sem elas o mapa mostrava polos base aparentemente fora de qualquer terra
  indígena. Medido sobre os dados reais: dos 146 polos fora de polígono, nove
  estão a menos de 5 km de uma terra em estudo. O polo de João Câmara está a
  60 metros da TI Mendonça do Amarelão.
*/
  describe("a camada das terras em estudo", () => {
    it("pede o conjunto pelo proxy same-origin", () => {
      expect(funaiEstudoUrl()).toBe("/api/funai-geodata?dataset=estudo");
    });
  });

  describe("o que o ponto diz de si", () => {
    const terra = {
      terrai_nome: "Mendonça do Amarelão",
      etnia_nome: "Potiguara",
      uf_sigla: "RN",
    };

    it("nomeia o povo e a terra, como a camada de polígonos", () => {
      const texto = tooltipDaTerraEmEstudo(terra);
      expect(texto).toContain("<b>Povo: Potiguara</b>");
      expect(texto).toContain("Terra Indígena Mendonça do Amarelão");
      expect(texto).toContain("RN");
    });

    /*
    Um ponto no mapa é lido como lugar. Sem esta frase, quem olha supõe que a
    terra tem aquele tamanho e aquela posição fechada — e nenhum documento
    sustenta isso enquanto o estudo corre.
  */
    it("diz sempre que não há limite publicado", () => {
      expect(tooltipDaTerraEmEstudo(terra)).toContain("sem limite publicado");
      expect(tooltipDaTerraEmEstudo({})).toContain("sem limite publicado");
      expect(AVISO_DE_ESTUDO).toContain("em estudo");
    });

    it("não inventa povo quando a Funai não declara", () => {
      const texto = tooltipDaTerraEmEstudo({ terrai_nome: "Katokinn" });
      expect(texto).not.toContain("Povo:");
      expect(texto).toContain("Povo não declarado pela Funai");
      expect(texto).toContain("Terra Indígena Katokinn");
    });

    // O caso real do print: Karuazu, em Alagoas, com "Não especificada".
    it("'Não especificada' diz-se como ausência, não como povo", () => {
      const texto = tooltipDaTerraEmEstudo({
        terrai_nome: "Karuazu",
        etnia_nome: "Não especificada",
        uf_sigla: "AL",
      });
      expect(texto).not.toContain("Povo: Não especificada");
      expect(texto).toContain("Povo não declarado pela Funai");
    });

    it("escapa o que vem da Funai antes de virar HTML", () => {
      expect(
        tooltipDaTerraEmEstudo({ terrai_nome: "<img src=x onerror=alert(1)>" }),
      ).not.toContain("<img");
    });
  });
});

bloco("vinculo-territorial", () => {
  /*
  As regras do vínculo territorial no mapa do DSEI (src/modulos/mapa-saude-indigena/,
  regras em src/lib/mapas/mapa-saude-indigena/). A dica é `{ titulo, linhas }`, em
  nós de texto; aqui, lida como uma linha só.
*/
  const tooltipDoRegistro = (registro, dsei) => {
    const { titulo, linhas } = dicaDoRegistro(registro, dsei);
    return [titulo, ...linhas].join(" · ");
  };

  describe("conversão de código IBGE para sigla", () => {
    it("cobre as 27 unidades da federação", () => {
      expect(Object.keys(UF_POR_CODIGO_IBGE)).toHaveLength(27);
    });

    it("converte os extremos da tabela", () => {
      expect(siglaDaUf(11)).toBe("RO");
      expect(siglaDaUf(12)).toBe("AC");
      expect(siglaDaUf(53)).toBe("DF");
    });

    it("aceita o código como string, porque o payload varia", () => {
      expect(siglaDaUf("29")).toBe("BA");
    });

    it("aceita sigla e normaliza caixa", () => {
      expect(siglaDaUf("ba")).toBe("BA");
    });

    /*
    Devolver `null` — e não uma sigla qualquer — é o que faz a classificação
    parar em `indeterminado` em vez de afirmar que a unidade está fora.
  */
    it("recusa o que não é UF", () => {
      for (const entrada of [
        null,
        undefined,
        "",
        "  ",
        0,
        99,
        1.5,
        "XX",
        "BRA",
      ]) {
        expect(siglaDaUf(entrada)).toBeNull();
      }
    });
  });

  describe("classificação do vínculo", () => {
    it("dentro da abrangência é vínculo normal", () => {
      const r = classificarVinculoTerritorial(29, ["BA"]);
      expect(r.vinculo).toBe(VINCULO_NORMAL);
      expect(r.uf).toBe("BA");
    });

    it("um DSEI multi-UF não transforma a segunda UF em anomalia", () => {
      // Interior Sul cobre RS e SC; uma unidade em SC é normal.
      expect(classificarVinculoTerritorial(42, ["RS", "SC"]).vinculo).toBe(
        VINCULO_NORMAL,
      );
    });

    it("fora da abrangência é vínculo externo", () => {
      const r = classificarVinculoTerritorial(22, ["CE"]);
      expect(r.vinculo).toBe(VINCULO_EXTERNO);
      expect(r.uf).toBe("PI");
    });

    it("CNES sem UF válida não classifica", () => {
      expect(classificarVinculoTerritorial(null, ["CE"]).vinculo).toBe(
        VINCULO_INDETERMINADO,
      );
      expect(classificarVinculoTerritorial(99, ["CE"]).vinculo).toBe(
        VINCULO_INDETERMINADO,
      );
    });

    it("DSEI sem ufs não classifica", () => {
      expect(classificarVinculoTerritorial(22, []).vinculo).toBe(
        VINCULO_INDETERMINADO,
      );
      expect(classificarVinculoTerritorial(22, null).vinculo).toBe(
        VINCULO_INDETERMINADO,
      );
    });

    /*
    Comparar o código numérico direto com as siglas do DSEI marcaria as 1462
    unidades como externas. A conversão é o que impede isso.
  */
    it("o código numérico nunca é comparado cru com as siglas", () => {
      const codigo = 29;
      expect(["BA"].includes(codigo)).toBe(false);
      expect(classificarVinculoTerritorial(codigo, ["BA"]).vinculo).toBe(
        VINCULO_NORMAL,
      );
    });
  });

  /*
  Casos reais, colhidos de `mapa_saude_indigena_config` em 09/09/2026.

  Os três primeiros são as únicas relações interestaduais genuínas entre as 1462
  unidades. Os demais são falsos positivos do ray casting em `UF_GEO`: o
  polígono simplificado os coloca na UF vizinha, mas o CNES — a autoridade —
  os coloca dentro do próprio DSEI. Feijó é no Acre, Juazeiro é na Bahia,
  Paragominas é no Pará, Itacuruba é em Pernambuco, Jacareacanga é no Pará.
*/
  describe("regressão sobre os dados reais", () => {
    const genuinos = [
      ["Uruçuí (DSEI Ceará)", 22, ["CE"], "PI"],
      ["Lagoa de São Francisco (DSEI Ceará)", 22, ["CE"], "PI"],
      ["Mangueirinha (DSEI Interior Sul)", 41, ["RS", "SC"], "PR"],
    ];

    it.each(genuinos)("%s recebe vínculo externo", (_nome, uf, ufs, sigla) => {
      const r = classificarVinculoTerritorial(uf, ufs);
      expect(r.vinculo).toBe(VINCULO_EXTERNO);
      expect(r.uf).toBe(sigla);
    });

    const falsosPositivosDoPoligono = [
      ["Polo Base de Feijó", 12, ["AC"], "AM"],
      ["Polo Base de Juazeiro", 29, ["BA"], "PE"],
      ["Paragominas", 15, ["PA"], "MA"],
      ["UBSI Serrote dos Campos (Itacuruba)", 26, ["PE"], "BA"],
      ["Polo Base Kato (Jacareacanga)", 15, ["PA"], "AM"],
      ["UBSI Serra Grande (Itacajá)", 17, ["TO"], "MA"],
    ];

    it.each(falsosPositivosDoPoligono)(
      "%s NÃO recebe linha pontilhada",
      (_nome, ufCnes, ufsDoDsei) => {
        const r = classificarVinculoTerritorial(ufCnes, ufsDoDsei);
        expect(r.vinculo).toBe(VINCULO_NORMAL);
      },
    );
  });

  describe("separação para o enquadramento", () => {
    const dsei = { n: "Ceará", ufs: ["CE"] };
    const registros = [
      { name: "Polo local", uf: 23, type: { key: "polo", label: "Polo base" } },
      { name: "Uruçuí", uf: 22, type: { key: "ubsi", label: "UBSI" } },
      { name: "Sem UF", uf: null, type: { key: "unit", label: "Unidade" } },
    ];
    const classificados = classificarRegistros(registros, dsei);

    it("anota cada registro sem perder nenhum", () => {
      expect(classificados).toHaveLength(3);
      expect(classificados.map((r) => r.vinculo)).toEqual([
        VINCULO_NORMAL,
        VINCULO_EXTERNO,
        VINCULO_INDETERMINADO,
      ]);
    });

    it("só o externo fica de fora do enquadramento inicial", () => {
      expect(registrosExternos(classificados).map((r) => r.name)).toEqual([
        "Uruçuí",
      ]);
      expect(registrosLocais(classificados).map((r) => r.name)).toEqual([
        "Polo local",
        "Sem UF",
      ]);
    });

    it("cai para a sede quando o DSEI não declara ufs", () => {
      const semUfs = classificarRegistros(registros, { n: "X", sedeuf: "CE" });
      expect(semUfs[0].vinculo).toBe(VINCULO_NORMAL);
      expect(semUfs[1].vinculo).toBe(VINCULO_EXTERNO);
    });
  });

  describe("apresentação", () => {
    const dsei = { n: "Ceará", ufs: ["CE"] };

    it("o tooltip diz tipo, DSEI, localização e a relação", () => {
      const [registro] = classificarRegistros(
        [{ name: "Uruçuí", uf: 22, type: { key: "ubsi", label: "UBSI" } }],
        dsei,
      );
      const texto = tooltipDoRegistro(registro, dsei);
      expect(texto).toContain("UBSI Uruçuí");
      expect(texto).toContain("Vinculado ao DSEI Ceará");
      expect(texto).toContain("Localização: PI");
      expect(texto).toContain("Fora das UFs de abrangência do DSEI");
    });

    it("o tooltip não acusa nada quando o vínculo é normal", () => {
      const [registro] = classificarRegistros(
        [
          {
            name: "Polo local",
            uf: 23,
            type: { key: "polo", label: "Polo base" },
          },
        ],
        dsei,
      );
      expect(tooltipDoRegistro(registro, dsei)).not.toContain("Fora das UFs");
    });

    it("um vínculo indeterminado é dito como tal, não como externo", () => {
      const [registro] = classificarRegistros(
        [{ name: "Sem UF", uf: null, type: { key: "unit", label: "Unidade" } }],
        dsei,
      );
      const texto = tooltipDoRegistro(registro, dsei);
      expect(texto).toContain("não classificado");
      expect(texto).not.toContain("Fora das UFs");
    });

    /*
    POLO BASE JOAO CAMARA, DSEI Potiguara: o tooltip contava a reconciliação e
    o popup repetia-a com as coordenadas. Como o autopan do popup reabre o
    tooltip, os dois ficavam visíveis dizendo o mesmo. A repartição é esta.
  */
    it("o tooltip não repete o que o popup vai explicar", () => {
      const [registro] = classificarRegistros(
        [
          {
            name: "POLO BASE JOAO CAMARA",
            uf: 24,
            type: { key: "polo", label: "Polo base" },
            origens: ["lmap", "rede_cnes"],
            divergencia: "divergente",
            distancia_entre_fontes_km: 10.4,
            coordenadas: {
              lmap: { lat: -5.514, lon: -35.9042 },
              rede_cnes: { lat: -5.53222, lon: -35.81213 },
            },
          },
        ],
        { n: "Potiguara", ufs: ["PB", "RN"] },
      );

      const texto = tooltipDoRegistro(registro, { n: "Potiguara" });
      expect(texto).toContain("Polo base POLO BASE JOAO CAMARA");
      expect(texto).toContain("Localização: RN");
      expect(texto).not.toContain("Fontes divergem");
      expect(texto).not.toContain("Registro unificado");
    });

    it("a linha avisa que não é trajeto", () => {
      expect(TOOLTIP_DA_LINHA).toBe(
        "Vínculo territorial — não representa trajeto",
      );
    });

    it("a linha é visualmente secundária, como especificado", () => {
      expect(ESTILO_DA_LINHA.dashArray).toBe("6 7");
      expect(ESTILO_DA_LINHA.opacity).toBeCloseTo(0.55, 2);
      expect(ESTILO_DA_LINHA.weight).toBeGreaterThanOrEqual(1.5);
      expect(ESTILO_DA_LINHA.weight).toBeLessThanOrEqual(2);
    });

    it("o chip concorda em número", () => {
      expect(textoDoChip(0)).toBe("");
      expect(textoDoChip(1)).toBe("1 vínculo fora da área");
      expect(textoDoChip(2)).toBe("2 vínculos fora da área");
    });

    /*
    Acessibilidade: se a única diferença fosse a cor, quem não a distingue
    perderia a informação. Cada tipo tem forma própria.
  */
    it("cada tipo tem forma própria, não só cor", () => {
      const formas = ["polo", "casai", "ubsi", "unit"].map(
        (k) => formaDoTipo(k).forma,
      );
      expect(new Set(formas).size).toBe(4);
    });

    it("o marcador externo mantém o ícone do seu tipo", () => {
      const [externo] = classificarRegistros(
        [{ name: "Uruçuí", uf: 22, type: { key: "casai", color: "#d92d3a" } }],
        dsei,
      );
      expect(externo.vinculo).toBe(VINCULO_EXTERNO);
      // A casa (CASAI) continua sendo desenhada, não substituída por outro símbolo.
      expect(DESENHO_DAS_FORMAS[formaDoTipo(externo.type.key).forma]).toContain(
        "M9 2.6 15.2 8v8.2H2.8V8Z",
      );
    });
  });

  describe("enquadramento do mapa do DSEI", () => {
    /*
    Incluir os remotos no enquadramento inicial encolheria o território: no
    Ceará a caixa passaria de 3.01 x 2.75 para 4.31 x 6.28 graus.
  */
    it("o inicial usa só sede e unidades locais; o completo inclui as externas", () => {
      const dsei = { n: "Ceará", ufs: ["CE"], lat: -3.7, lon: -38.5 };
      const classificados = classificarRegistros(
        [
          { name: "Local", uf: 23, lat: -4, lon: -39 },
          { name: "Uruçuí", uf: 22, lat: -7.2, lon: -44.5 },
        ],
        dsei,
      );
      const limites = limitesDoDsei(dsei, classificados);
      expect(limites.territorio).toEqual([
        [-3.7, -38.5],
        [-4, -39],
      ]);
      expect(limites.completo).toEqual([
        [-3.7, -38.5],
        [-4, -39],
        [-7.2, -44.5],
      ]);
    });

    it("a coordenada real nunca é ajustada para a UF declarada", () => {
      const [externo] = classificarRegistros(
        [{ name: "Uruçuí", uf: 22, lat: -7.2, lon: -44.5 }],
        { n: "Ceará", ufs: ["CE"] },
      );
      expect([externo.lat, externo.lon]).toEqual([-7.2, -44.5]);
    });
  });
});

bloco("visao-geral-da-area", () => {
  const html = readFileSync("index.html", "utf8").replace(/\s+/g, " ");

  describe("uma Visão geral para as três áreas", () => {
    it("DSEIs na Saúde Indígena, municípios em Projetos, nenhum mapa na SEDE", () => {
      expect(mapaDaVisaoGeral("saude-indigena")).toBe(MAPA_DOS_DSEIS);
      expect(mapaDaVisaoGeral("projetos")).toBe(MAPA_DOS_MUNICIPIOS);
      expect(mapaDaVisaoGeral("sede")).toBe("");
      expect(mapaDaVisaoGeral(undefined)).toBe("");
    });

    it("a Saúde Indígena segue a configuração; as outras dizem o nome delas", () => {
      const configuracao = {
        titulo: "Saúde Indígena",
        subtitulo: "Monitoramento DSEI/CASAI",
      };
      expect(cabecalhoDaVisaoGeral("saude-indigena", configuracao)).toEqual(
        configuracao,
      );
      expect(cabecalhoDaVisaoGeral("sede", configuracao)).toEqual({
        titulo: "SEDE",
        subtitulo: "Monitoramento dos processos seletivos",
      });
      expect(cabecalhoDaVisaoGeral("projetos", configuracao).titulo).toBe(
        "Projetos",
      );
    });

    it("os textos do mapa de Projetos são do componente React, não do index.html", () => {
      const textos = TEXTOS_DO_MAPA[MAPA_DOS_MUNICIPIOS];
      expect(Object.keys(textos)).toEqual(["area", "titulo", "mapa", "lista"]);
      for (const valor of Object.values(textos))
        expect(html).not.toContain(valor);
      const componente = readFileSync(
        "src/modulos/mapa-de-projetos/mapa-de-projetos.tsx",
        "utf8",
      );
      expect(componente).toContain("TEXTOS_DO_MAPA[MAPA_DOS_MUNICIPIOS]");
    });
  });

  describe("municípios do mapa", () => {
    it("acha a coordenada sem ligar para acento, caixa ou espaço", () => {
      expect(chaveDoMunicipio(" Seropédica / rj ")).toBe("seropedica/rj");
      expect(coordenadasDoMunicipio("SEROPEDICA/RJ")).toMatchObject({
        municipio: "Seropédica",
        uf: "RJ",
        ibge: 3305554,
      });
      // Mesmo nome, outra UF: não é o mesmo lugar.
      expect(coordenadasDoMunicipio("Irati/SC")).toBeNull();
      expect(coordenadasDoMunicipio("Seropédica")).toBeNull();
      expect(chaveDoMunicipio(undefined)).toBe("");
    });

    it("todos os municípios de hoje têm coordenada dentro do Brasil", () => {
      for (const nome of [
        "Seropédica/RJ",
        "Talismã/TO",
        "Cubatão/SP",
        "Palhoça/SC",
        "Irati/PR",
      ]) {
        const lugar = coordenadasDoMunicipio(nome);
        expect(lugar, nome).not.toBeNull();
        expect(lugar.latitude).toBeGreaterThan(-33.75);
        expect(lugar.latitude).toBeLessThan(5.27);
        expect(lugar.longitude).toBeGreaterThan(-73.99);
        expect(lugar.longitude).toBeLessThan(-32.42);
      }
    });

    it("lê a resposta da RPC, com números e sem linha vazia", () => {
      expect(
        municipiosDaResposta([
          {
            municipio_uf: "Irati/PR",
            municipio: "Irati",
            uf: "PR",
            vagas: 5,
            candidatos: "70",
            aprovados: 43,
            reprovados: 27,
          },
          { municipio_uf: "  " },
        ]),
      ).toMatchObject([
        {
          chave: "Irati/PR",
          municipioUf: "Irati/PR",
          nivel: "municipio",
          vagas: 5,
          vagasEdital: null,
          candidatos: 70,
          aprovados: 43,
          reprovados: 27,
          projetos: [],
          editais: [],
        },
      ]);
      expect(municipiosDaResposta(null)).toEqual([]);
    });

    it("o raio é o da bolha do DSEI (raiz do valor, 5 a 15 px) e não muda com o filtro", () => {
      const lugares = municipiosDaResposta([
        { municipio_uf: "Seropédica/RJ", vagas: 100 },
        { municipio_uf: "Irati/PR", vagas: 25 },
        { municipio_uf: "Cubatão/SP", vagas: 0 },
      ]);
      const pontos = pontosDosMunicipios(lugares);
      expect(pontos.map((ponto) => ponto.raio)).toEqual([
        RAIO_MAXIMO,
        raioDaBolha(25, 100),
        RAIO_MINIMO,
      ]);
      expect(raioDaBolha(25, 100)).toBe(10);
      // Sem o maior (recortado), Irati continua do mesmo tamanho.
      const recortados = pontosDosMunicipios(lugares.slice(1), {
        todos: lugares,
      });
      expect(recortados[0].raio).toBe(raioDaBolha(25, 100));
    });

    it("ordena por vagas (candidatos desempatam) e marca quem não tem coordenada", () => {
      const pontos = pontosDosMunicipios(
        municipiosDaResposta([
          { municipio_uf: "Irati/PR", vagas: 5, candidatos: 70 },
          { municipio_uf: "Seropédica/RJ", vagas: 12, candidatos: 647 },
          { municipio_uf: "Cubatão/SP", vagas: 5, candidatos: 90 },
          { municipio_uf: "Lugar Novo/AM", vagas: 1, candidatos: 10 },
        ]),
      );
      expect(pontos.map((ponto) => ponto.municipioUf)).toEqual([
        "Seropédica/RJ",
        "Cubatão/SP",
        "Irati/PR",
        "Lugar Novo/AM",
      ]);
      expect(pontos[0].coordenadas).toEqual([-22.7526, -43.7155]);
      expect(pontos[0].raio).toBe(RAIO_MAXIMO);
      expect(pontos[3].coordenadas).toBeNull();
    });

    it("o resultado é a parte aprovada entre as decididas", () => {
      expect(resultadoDoMunicipio({ aprovados: 43, reprovados: 27 })).toEqual({
        pct: 61,
        decididos: 70,
      });
      expect(resultadoDoMunicipio({ aprovados: 0, reprovados: 0 })).toBeNull();
      expect(resultadoDoMunicipio()).toBeNull();
    });
  });

  /*
  Todos os projetos no mapa de Projetos: os lugares vêm de TB_LOCAL_VAGA_EDITAL
  (lidos dos PDFs) e do "UBS móvel" do nome da vaga; cada lugar diz os
  projetos e editais dele.
*/
  const SQL_DOS_LOCAIS = readFileSync(
    "tests/fixtures/sql-de-dados/20261001-locais-das-vagas-dos-projetos.sql",
    "utf8",
  );

  const RESPOSTA_COM_PROJETOS = [
    {
      municipio_uf: "Boa Vista/RR",
      municipio: "Boa Vista",
      uf: "RR",
      codigo_ibge: 1400100,
      nivel: "municipio",
      vagas: 0,
      candidatos: 0,
      vagas_edital: 52,
      cadastro_reserva: true,
      projetos: ["Saúde nas Fronteiras", "Escritório Distrital e Regional"],
      editais: [
        {
          id: "e62",
          edital: "62/2025",
          projeto: "Escritório Distrital e Regional",
          vagas: 16,
          cadastro_reserva: false,
          origens: ["PDF"],
          lotacoes: ["Escritório Distrital Yanomami"],
        },
        {
          id: "e23",
          edital: "23/2025",
          projeto: "Saúde nas Fronteiras",
          vagas: 22,
          cadastro_reserva: false,
          origens: ["PDF"],
          lotacoes: ["Boa Vista/RR"],
        },
      ],
    },
    {
      municipio_uf: null,
      uf: "PA",
      nivel: "uf",
      vagas_edital: 1,
      cadastro_reserva: true,
      projetos: ["CCE"],
      editais: [{ edital: "97/2025", projeto: "CCE", vagas: 1 }],
    },
    {
      municipio_uf: "Seropédica/RJ",
      uf: "RJ",
      vagas: 12,
      candidatos: 647,
      vagas_edital: null,
      cadastro_reserva: true,
      projetos: ["Projeto Agora Tem Especialistas Caminhoneiros"],
      editais: [
        {
          edital: "30/2026",
          projeto: "Projeto Agora Tem Especialistas Caminhoneiros",
          vagas: null,
          cadastro_reserva: true,
          origens: ["NOME_VAGA", "PDF"],
        },
      ],
    },
  ];

  describe("projetos no mapa de Projetos", () => {
    it("cada projeto tem uma série fixa, reconhecida pela unidade do edital", () => {
      expect(PROJETOS_DO_MAPA.map((projeto) => projeto.serie)).toEqual([
        1, 2, 3, 4, 5, 6,
      ]);
      expect(
        projetoDoMapa("Projeto Agora Tem Especialistas Caminhoneiros"),
      ).toEqual({ nome: "Caminhoneiros", serie: 1 });
      expect(projetoDoMapa("ESCRITÓRIO DISTRITAL E REGIONAL").serie).toBe(3);
      expect(projetoDoMapa("MFC")).toEqual({ nome: "MFC", serie: 5 });
      expect(projetoDoMapa("Projeto Novo")).toEqual({
        nome: "Projeto Novo",
        serie: 0,
      });
      expect(projetoDoMapa("")).toEqual({ nome: "Sem projeto", serie: 0 });
    });

    it("lê lugar de UF, projetos e editais da resposta", () => {
      const [boaVista, para, seropedica] = municipiosDaResposta(
        RESPOSTA_COM_PROJETOS,
      );
      expect(boaVista).toMatchObject({
        chave: "Boa Vista/RR",
        codigoIbge: 1400100,
        vagasEdital: 52,
        cadastroReserva: true,
      });
      // Na ordem das séries, não na da resposta.
      expect(boaVista.projetos.map((projeto) => projeto.nome)).toEqual([
        "Saúde nas Fronteiras",
        "Escritório Distrital e Regional",
      ]);
      expect(boaVista.editais.map((edital) => edital.edital)).toEqual([
        "23/2025",
        "62/2025",
      ]);
      expect(para).toMatchObject({ chave: "uf:PA", nivel: "uf", uf: "PA" });
      expect(rotuloDoLugar(para)).toBe("Pará (estado)");
      expect(seropedica.projetos).toEqual([
        { nome: "Caminhoneiros", serie: 1 },
      ]);
      expect(seropedica.editais[0].origens).toEqual(["NOME_VAGA", "PDF"]);
    });

    it("as vagas publicadas por extenso", () => {
      expect(textoDasVagas({ vagas: 4, cadastroReserva: true })).toBe(
        "4 vagas + cadastro reserva",
      );
      expect(textoDasVagas({ vagas: 1 })).toBe("1 vaga");
      expect(textoDasVagas({ vagas: null, cadastroReserva: true })).toBe(
        "Cadastro reserva",
      );
      expect(textoDasVagas()).toBe("");
    });

    it("ponto na cor do primeiro projeto; com filtro, só os do projeto e na cor dele", () => {
      const lugares = municipiosDaResposta(RESPOSTA_COM_PROJETOS);
      const todos = pontosDosMunicipios(lugares);
      // Ordem pelo tamanho: vagas publicadas ou, se maiores, as das análises.
      expect(todos.map((ponto) => ponto.rotulo)).toEqual([
        "Boa Vista/RR",
        "Seropédica/RJ",
        "Pará (estado)",
      ]);
      expect(todos[0]).toMatchObject({
        serie: 2,
        variosProjetos: true,
        tamanho: 52,
        coordenadas: [2.8238, -60.6753],
      });
      // UF: o ponto é o meio do estado.
      const centroDoPara = coordenadasDaUf("PA");
      expect(todos[2].coordenadas).toEqual([
        centroDoPara.latitude,
        centroDoPara.longitude,
      ]);

      const escritorio = pontosDosMunicipios(lugares, {
        projeto: "Escritório Distrital e Regional",
      });
      expect(escritorio).toHaveLength(1);
      expect(escritorio[0]).toMatchObject({ serie: 3, variosProjetos: false });
    });

    it("os projetos presentes e a lista agrupada por projeto", () => {
      const lugares = municipiosDaResposta(RESPOSTA_COM_PROJETOS);
      expect(projetosDosMunicipios(lugares)).toEqual([
        { nome: "Caminhoneiros", serie: 1, lugares: 1 },
        { nome: "Saúde nas Fronteiras", serie: 2, lugares: 1 },
        { nome: "Escritório Distrital e Regional", serie: 3, lugares: 1 },
        { nome: "CCE", serie: 6, lugares: 1 },
      ]);
      const grupos = gruposPorProjeto(pontosDosMunicipios(lugares));
      expect(grupos.map((grupo) => grupo.nome)).toEqual([
        "Caminhoneiros",
        "Saúde nas Fronteiras",
        "Escritório Distrital e Regional",
        "CCE",
      ]);
      // Boa Vista é de dois projetos: aparece nos dois grupos.
      expect(grupos[1].pontos[0].rotulo).toBe("Boa Vista/RR");
      expect(grupos[2].pontos[0].rotulo).toBe("Boa Vista/RR");
    });

    it("o popup diz projeto, edital, vagas, lotação e candidatos", () => {
      const [boaVista, para] = pontosDosMunicipios(
        municipiosDaResposta(RESPOSTA_COM_PROJETOS),
      ).filter((ponto) => ponto.rotulo !== "Seropédica/RJ");
      const resumo = resumoDoLugar(boaVista);
      expect(resumo.titulo).toBe("Boa Vista/RR");
      expect(resumo.editais).toEqual([
        {
          projeto: "Saúde nas Fronteiras",
          serie: 2,
          texto: "Edital 23/2025 · 22 vagas · Boa Vista/RR",
        },
        {
          projeto: "Escritório Distrital e Regional",
          serie: 3,
          texto: "Edital 62/2025 · 16 vagas · Escritório Distrital Yanomami",
        },
      ]);
      // Boa Vista não casou com vaga nenhuma das análises: sem "Candidatos: 0" falso.
      expect(resumo.linhas.join(" ")).not.toMatch(
        /Candidatos|Vagas nas análises/,
      );
      expect(
        resumoDoLugar({ ...boaVista, vagas: 2, candidatos: 9 }).linhas,
      ).toContain("Candidatos: 9");
      expect(resumoDoLugar(para).linhas).toContain("O edital diz só o estado");
    });

    it("todo município do levantamento dos PDFs tem coordenada no Brasil", () => {
      const codigos = [
        ...SQL_DOS_LOCAIS.matchAll(
          /^\s*\('[^']+', '[^']+', (\d{7}), '([^']+)', '([A-Z]{2})'/gm,
        ),
      ];
      expect(codigos.length).toBeGreaterThan(50);
      for (const [, codigo, municipio, uf] of codigos) {
        const lugar = coordenadasDoMunicipio(`${municipio}/${uf}`, codigo);
        expect(lugar, `${municipio}/${uf}`).not.toBeNull();
        expect(lugar.ibge).toBe(Number(codigo));
        expect(lugar.uf).toBe(uf);
        expect(lugar.latitude).toBeGreaterThan(-33.75);
        expect(lugar.latitude).toBeLessThan(5.27);
      }
    });

    it("toda UF tem ponto", () => {
      for (const uf of "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(
        " ",
      )) {
        expect(coordenadasDaUf(uf), uf).not.toBeNull();
      }
      expect(coordenadasDaUf("XX")).toBeNull();
    });
  });

  /*
  Os filtros da Visão geral valem para o mapa de Projetos como para o da
  Saúde Indígena: com recorte, só os lugares com edital do recorte, cada um só
  com esses editais.
*/
  describe("o recorte da Visão geral no mapa de Projetos", () => {
    const lugares = municipiosDaResposta(RESPOSTA_COM_PROJETOS);

    it("fica o lugar com edital do recorte, pelo id da linha ou pelo número", () => {
      const porId = lugaresDoRecorte(lugares, [{ id: "e23", edital: "x" }]);
      expect(porId.map((lugar) => lugar.chave)).toEqual(["Boa Vista/RR"]);
      // Boa Vista só com o edital do recorte: projetos e vagas recontados.
      expect(porId[0].editais.map((edital) => edital.edital)).toEqual([
        "23/2025",
      ]);
      expect(porId[0].projetos).toEqual([
        { nome: "Saúde nas Fronteiras", serie: 2 },
      ]);
      expect(porId[0].vagasEdital).toBe(22);
      expect(porId[0].cadastroReserva).toBe(false);

      const porNumero = lugaresDoRecorte(lugares, [
        { id: 9, edital: "Edital nº 097/2025" },
        { id: 10, edital: "30/2026" },
      ]);
      expect(porNumero.map((lugar) => lugar.chave)).toEqual([
        "uf:PA",
        "Seropédica/RJ",
      ]);
      // Com todos os editais no recorte, o lugar fica como veio.
      expect(porNumero[0]).toBe(lugares[1]);
      expect(lugaresDoRecorte(lugares, [])).toEqual([]);
    });

    it("o tamanho do ponto continua o do lugar inteiro", () => {
      const recortados = lugaresDoRecorte(lugares, [{ id: "e23" }]);
      const [antes] = pontosDosMunicipios(lugares);
      const [depois] = pontosDosMunicipios(recortados, { todos: lugares });
      expect(depois.chave).toBe(antes.chave);
      expect(depois.tamanho).toBe(22);
      expect(depois.raio).toBe(antes.raio);
    });
  });
});

bloco("visao-geral-fechada-nao-calcula", () => {
  /*
  22/10: a Visão geral fica montada escondida e recalculava tudo (linhas da
  área, recorte, indicadores) a cada carga, filtro ou troca de área, mesmo
  fechada. Fechada, só marca; calcula quando alguém lê ou quando abre.
*/

  function dadosFalsos() {
    let atual = { linhas: [], areaAtual: "saude-indigena", carregado: false };
    const ouvintes = new Set();
    return {
      assinar: (f) => (ouvintes.add(f), () => ouvintes.delete(f)),
      obter: () => atual,
      mudar(novo) {
        atual = { ...atual, ...novo };
        for (const f of ouvintes) f();
      },
    };
  }

  describe("Visão geral fechada", () => {
    it("não avisa a tela nem recalcula; ao abrir, calcula uma vez com o dado novo", () => {
      const dados = dadosFalsos();
      const estado = criarEstadoDaVisaoGeral({
        dados,
        armazenamento: null,
        aberta: false,
      });
      const tela = vi.fn();
      estado.assinar(tela);
      dados.mudar({ carregado: true, linhas: [] });
      dados.mudar({ areaAtual: "sede" });
      estado.definirBusca("x");
      expect(tela).not.toHaveBeenCalled();

      estado.definirAberta(true);
      expect(tela).toHaveBeenCalledTimes(1);
      const visto = estado.obter();
      expect(visto.carregado).toBe(true);
      expect(visto.area).toBe("sede");
      // Sem mudança, a mesma foto (o React não redesenha à toa).
      expect(estado.obter()).toBe(visto);
    });

    it("quem lê com a página fechada (PDF, busca) recebe o dado em dia", () => {
      const dados = dadosFalsos();
      const estado = criarEstadoDaVisaoGeral({
        dados,
        armazenamento: null,
        aberta: false,
      });
      dados.mudar({ carregado: true, areaAtual: "sede" });
      expect(estado.obter().area).toBe("sede");
      expect(estado.obter().carregado).toBe(true);
    });
  });
});

bloco("visao-geral", () => {
  /*
  As regras da Visão geral (src/lib/visao-geral/visao-geral.ts): filtros, recorte com
  atalho, linhas enriquecidas (fase, crítico, pós-resultado), blocos
  (Fases, Pós-resultado, Processos por projeto),
  tabela e exportação.
*/

  const HOJE = "2026-10-01";

  const BRUTAS = [
    {
      id: 1,
      unidade: "DSEI Xingu",
      edital: "03/2026",
      etapa: "Entrevistas",
      cronograma_atividade_atual: "Entrevistas",
      status: "Em Andamento",
      risco: "Alto",
      uf: "MT",
      vagas_total: 10,
      contratados: 4,
      vagas_ociosas: 6,
      inscritos: 80,
      // Crítico por atraso (etapa chegando não faz crítico).
      data_fim: "2026-09-28",
      cronograma_automatico: true,
      cronograma_dias_para_proxima: 2,
      cronograma_proxima_data: "2026-10-03",
      cronograma_proxima_atividade: "Resultado preliminar das entrevistas",
      observacoes: "Falta médico",
    },
    {
      id: 2,
      unidade: "DSEI Xingu",
      edital: "11/2025",
      etapa: "Análise Curricular",
      status: "em andamento",
      risco: "Médio",
      uf: "MT",
      vagas_total: 5,
      contratados: 5,
      vagas_ociosas: 0,
      inscritos: 20,
      data_fim: "2026-12-30",
    },
    {
      id: 3,
      unidade: "DSEI Yanomami",
      edital: "01/2026",
      etapa: "Resultado final do Processo Seletivo",
      status: "Concluído",
      risco: "Alto",
      uf: "RR",
      vagas_total: 8,
      contratados: 2,
      vagas_ociosas: 6,
      inscritos: 40,
    },
    {
      id: 4,
      unidade: "CASAI Brasília",
      edital: "Edital sem número",
      etapa: "",
      status: "",
      risco: "Baixo",
      uf: "DF",
      vagas_total: 2,
      contratados: 0,
      vagas_ociosas: 2,
      inscritos: 3,
    },
    {
      id: 5,
      unidade: "DSEI Xingu",
      edital: "81/2025",
      etapa: "Resultado final do Processo Seletivo",
      status: "Cancelado",
      risco: "Baixo",
      uf: "MT",
      vagas_total: 6,
      contratados: 0,
      vagas_ociosas: 6,
      inscritos: 1389,
    },
  ];

  const ACOMPANHAMENTO = acompanhamentoDaResposta({
    etapas: [
      {
        monitoramento_id: 1,
        atividade: "Resultado preliminar das entrevistas",
        data_inicio: "2026-10-03",
        data_fim: "2026-10-03",
      },
      {
        monitoramento_id: 1,
        atividade: "Prazo para recursos das entrevistas",
        data_inicio: "2026-10-04",
        data_fim: "2026-10-06",
      },
      {
        monitoramento_id: 2,
        atividade: "Entrevistas",
        data_inicio: "2026-10-20",
        data_fim: "2026-10-25",
      },
    ],
    listas: [
      {
        monitoramento_id: 3,
        aprovados: 43,
        com_status: 0,
        contratados: 2,
        desistentes: 3,
      },
    ],
  });

  const LINHAS = enriquecerLinhas(BRUTAS, { hoje: HOJE });
  const COM_ACOMPANHAMENTO = enriquecerLinhas(BRUTAS, {
    hoje: HOJE,
    acompanhamento: ACOMPANHAMENTO,
  });
  const comFiltros = (parcial) => ({ ...filtrosVazios(), ...parcial });
  const ids = (lista) => lista.map((l) => l.id);

  describe("filtros", () => {
    it("seis campos; Fase, UF e Ciclo em 'Mais opções'; o Risco manual saiu", () => {
      expect(Object.keys(filtrosVazios())).toEqual([
        "unidade",
        "edital",
        "status",
        "fase",
        "uf",
        "ciclo",
      ]);
    });

    it("ordena as opções pelo fluxo: edital por ano e número, status e fase", () => {
      expect(
        ["03/2026", "Edital sem número", "11/2025", "01/2026"].sort((a, b) =>
          compararValoresDoFiltro("edital", a, b),
        ),
      ).toEqual(["11/2025", "01/2026", "03/2026", "Edital sem número"]);
      expect(
        ["Concluído", "Entrevistas", "Edital", "Outra"].sort((a, b) =>
          compararValoresDoFiltro("fase", a, b),
        ),
      ).toEqual(["Edital", "Entrevistas", "Concluído", "Outra"]);
    });

    it("as opções seguem os outros filtros; a fase é uma opção", () => {
      const opcoes = opcoesDosFiltros(LINHAS, comFiltros({ uf: ["RR"] }));
      expect(opcoes.unidade).toEqual(["DSEI Yanomami"]);
      expect(opcoes.uf).toEqual(["DF", "MT", "RR"]);
      expect(opcoesDosFiltros(LINHAS, filtrosVazios()).fase).toEqual([
        "Análise curricular",
        "Entrevistas",
        "Concluído",
        "Cancelado",
        "Sem cronograma",
      ]);
    });

    it("poda a seleção que deixou de existir e normaliza o que vem do navegador", () => {
      const filtros = comFiltros({ unidade: ["DSEI Fechado"], uf: ["mt"] });
      expect(podarFiltros(LINHAS, filtros)).toEqual(comFiltros({ uf: ["MT"] }));
      const validos = comFiltros({ uf: ["MT"] });
      expect(podarFiltros(LINHAS, validos)).toBe(validos);
      expect(
        normalizarFiltros({
          unidade: [" A ", "A", ""],
          risco: ["Alto"],
          uf: "MT",
        }),
      ).toEqual(comFiltros({ unidade: ["A"] }));
    });
  });

  describe("linhas enriquecidas", () => {
    it("fase, motivos de atenção e pendências pós-resultado", () => {
      const [xingu, analise, yanomami, casai, cancelado] = LINHAS;
      expect(xingu.fase).toBe("Entrevistas");
      expect(xingu.atencao.map((m) => m.rotulo)).toEqual([
        "Etapa atrasada há 3 dias",
      ]);
      expect(analise.fase).toBe("Análise curricular");
      expect(analise.atencao).toEqual([]);
      expect(yanomami.fase).toBe("Concluído");
      expect(yanomami.atencao.map((m) => m.codigo)).toEqual([
        "contratacao_baixa",
      ]);
      // Sem o resumo das listas, nenhuma pendência (a contratação baixa fica só
      // como motivo de atenção do crítico, acima).
      expect(yanomami.pos_resultado).toEqual([]);
      expect(casai.fase).toBe("Sem cronograma");
      expect(cancelado.atencao).toEqual([]);
      expect(cancelado.pos_resultado).toEqual([]);
      // O original não muda.
      expect(BRUTAS[0].fase).toBeUndefined();
    });

    it("com o acompanhamento: lista sem status (desistências e contratação baixa não são pendência)", () => {
      const yanomami = COM_ACOMPANHAMENTO.find((l) => l.id === 3);
      expect(yanomami.pos_resultado).toEqual(["sem_status"]);
      expect(yanomami.desistentes).toBe(3);
      const semLista = enriquecerLinhas([{ ...BRUTAS[2], id: 9 }], {
        hoje: HOJE,
        acompanhamento: ACOMPANHAMENTO,
      })[0];
      expect(semLista.pos_resultado).toEqual(["sem_lista"]);
    });
  });

  describe("recorte", () => {
    it("filtra por campo, pela busca (sem acento), pelo DSEI e pelo atalho", () => {
      expect(
        ids(recortar(LINHAS, { filtros: comFiltros({ uf: ["mt"] }) })).sort(),
      ).toEqual([1, 2, 5]);
      expect(
        ids(recortar(LINHAS, { filtros: filtrosVazios(), busca: "MEDICO" })),
      ).toEqual([1]);
      expect(
        ids(
          recortar(LINHAS, {
            filtros: filtrosVazios(),
            dsei: "yanomami",
            chaveDsei: (l) => l.unidade.replace("DSEI ", "").toLowerCase(),
          }),
        ),
      ).toEqual([3]);
      expect(
        ids(recortar(LINHAS, { filtros: filtrosVazios(), atalho: "criticos" })),
      ).toEqual([1, 3]);
      expect(
        ids(
          recortar(COM_ACOMPANHAMENTO, {
            filtros: filtrosVazios(),
            atalho: "pos:sem_status",
          }),
        ),
      ).toEqual([3]);
      expect(
        ids(
          recortar(LINHAS, { filtros: comFiltros({ fase: ["Entrevistas"] }) }),
        ),
      ).toEqual([1]);
      expect(rotuloDoAtalho("criticos")).toBe("Críticos");
      expect(rotuloDoAtalho("pos:sem_lista")).toBe("Sem lista de aprovados");
    });

    it("sem ordenação, os críticos primeiro, depois mais vagas sem contratação", () => {
      const fila = recortar(LINHAS, { filtros: filtrosVazios() });
      // 1 (prazo, peso 2), 3 (contratação baixa, peso 5), depois 5 (6 sem
      // contratação), 4 (2) e 2 (0).
      expect(ids(fila)).toEqual([1, 3, 5, 4, 2]);
      const porVagas = recortar(LINHAS, {
        filtros: filtrosVazios(),
        ordenacao: { campo: "vagas_total", direcao: "desc" },
      });
      expect(ids(porVagas)).toEqual([1, 3, 5, 2, 4]);
      const porAtencao = recortar(LINHAS, {
        filtros: filtrosVazios(),
        ordenacao: { campo: "atencao", direcao: "asc" },
      });
      expect(ids(porAtencao).slice(0, 2)).toEqual([1, 3]);
    });

    it("o cabeçalho alterna crescente, decrescente e sem ordem", () => {
      let o = proximaOrdenacao({ campo: "", direcao: "" }, "edital");
      expect(o).toEqual({ campo: "edital", direcao: "asc" });
      o = proximaOrdenacao(o, "edital");
      expect(o).toEqual({ campo: "edital", direcao: "desc" });
      expect(proximaOrdenacao(o, "edital")).toEqual({ campo: "", direcao: "" });
    });
  });

  describe("indicadores", () => {
    it("sete, com as chaves de Configurações e o valor de cada um", () => {
      expect(INDICADORES.map(([chave, rotulo]) => [chave, rotulo])).toEqual([
        ["kpi_vagas_label", "Vagas imediatas"],
        ["kpi_contratadas_label", "Contratadas"],
        ["kpi_em_selecao_label", "Em seleção"],
        ["kpi_ociosas_label", "Ociosas"],
        ["kpi_cadastro_reserva_label", "Cadastro reserva"],
        ["kpi_criticos_label", "Críticos"],
        ["kpi_inscritos_label", "Inscritos"],
      ]);
      expect(Object.keys(VALOR_DO_INDICADOR)).toEqual(
        INDICADORES.map(([chave]) => chave),
      );
    });

    it("contam o recorte e fecham", () => {
      const k = indicadoresDaVisaoGeral(LINHAS);
      expect(k).toEqual({
        processos: 5,
        vagas: 25,
        reabertas: 0,
        contratadas: 11,
        emSelecao: 8,
        ociosas: 6,
        cadastroReserva: 0,
        criticos: 2,
        inscritos: 143,
      });
      expect(k.contratadas + k.emSelecao + k.ociosas).toBe(k.vagas);
    });
  });

  describe("blocos", () => {
    it("Fases: as do fluxo sempre, as de fora só com edital", () => {
      const fases = fasesDosProcessos(LINHAS);
      expect(fases.map((f) => f.fase)).toEqual([
        "Edital",
        "Inscrições",
        "Análise curricular",
        "Recursos",
        "Entrevistas",
        "Resultado",
        "Contratação",
        "Concluído",
        "Cancelado",
        "Sem cronograma",
      ]);
      expect(fases.find((f) => f.fase === "Entrevistas")).toEqual({
        fase: "Entrevistas",
        quantos: 1,
        pct: 20,
        tom: "info",
      });
      expect(fases.reduce((s, f) => s + f.quantos, 0)).toBe(LINHAS.length);
    });

    it("Em andamento: só as fases com edital aberto; concluídos e cancelados à parte", () => {
      const a = andamentoPorFase(LINHAS);
      const fases = fasesDosProcessos(LINHAS);
      const quantos = (fase) => fases.find((f) => f.fase === fase).quantos;
      expect(a.emAndamento.every((f) => f.quantos > 0)).toBe(true);
      expect(a.emAndamento.map((f) => f.fase)).not.toContain("Concluído");
      expect(a.emAndamento.map((f) => f.fase)).not.toContain("Cancelado");
      expect(a.concluidos).toBe(quantos("Concluído"));
      expect(a.cancelados).toBe(quantos("Cancelado"));
      expect(
        a.emAndamento.reduce((s, f) => s + f.quantos, 0) +
          a.concluidos +
          a.cancelados,
      ).toBe(LINHAS.length);
    });

    it("Pós-resultado: com e sem o resumo das listas", () => {
      expect(posResultado(LINHAS)).toEqual([]);
      expect(
        posResultado(COM_ACOMPANHAMENTO, { comListas: true }).map((p) => [
          p.codigo,
          p.quantos,
        ]),
      ).toEqual([
        ["sem_lista", 0],
        ["sem_status", 1],
      ]);
    });

    it("Processos por projeto (só Projetos)", () => {
      expect(temProcessosPorProjeto("projetos")).toBe(true);
      expect(temProcessosPorProjeto("sede")).toBe(false);
      expect(processosPorProjeto(LINHAS)[0]).toEqual({
        projeto: "DSEI Xingu",
        processos: 3,
        abertos: 2,
        vagas: 15,
        contratadas: 9,
      });
    });
  });

  describe("tabela", () => {
    const hoje = new Date(2026, 9, 1);

    it("'hoje' como dia de Brasília (AAAA-MM-DD), o mesmo dos críticos", () => {
      expect(diasAte("2026-10-04", "2026-10-01")).toBe(3);
      expect(
        urgenciaDoCronograma({ data_fim: "2026-09-30" }, "2026-10-01"),
      ).toMatchObject({ tom: "danger", rotulo: "Etapa atrasada há 1 dia(s)" });
    });

    it("prazo do edital: encerrado, perto do fim, concluído e cancelado", () => {
      expect(diasAte("2026-10-04", hoje)).toBe(3);
      expect(prazoDoEdital({ data_fim: "2026-10-04" }, hoje)).toMatchObject({
        tom: "perigo",
        rotulo: "Edital encerra em 3 dias",
      });
      expect(prazoDoEdital({ data_fim: "2026-10-20" }, hoje).tom).toBe(
        "alerta",
      );
      expect(prazoDoEdital({ data_fim: "2026-12-20" }, hoje)).toBeNull();
      // Vencido sem concluir: o selo do cronograma diz "Etapa atrasada".
      expect(prazoDoEdital({ data_fim: "2026-09-20" }, hoje)).toBeNull();
      expect(prazoDoEdital({ status: "Cancelada" }, hoje).rotulo).toBe(
        "Processo cancelado",
      );
    });

    it("cronograma: atrasado pelo fim do cronograma, perto, sem cronograma; o selo some em concluído", () => {
      const base = {
        status: "Em andamento",
        cronograma_automatico: true,
        data_fim: "2026-12-01",
      };
      expect(
        urgenciaDoCronograma({ ...base, data_fim: "2026-09-29" }, hoje),
      ).toEqual({ tom: "danger", rotulo: "Etapa atrasada há 2 dia(s)" });
      // Sem cronograma estruturado também atrasa pela data do edital.
      expect(
        urgenciaDoCronograma(
          { status: "Em andamento", data_fim: "2026-09-30" },
          hoje,
        ).rotulo,
      ).toBe("Etapa atrasada há 1 dia(s)");
      expect(
        urgenciaDoCronograma({ ...base, cronograma_dias_para_proxima: 3 }, hoje)
          .tom,
      ).toBe("danger");
      expect(
        urgenciaDoCronograma({ ...base, cronograma_dias_para_proxima: 6 }, hoje)
          .tom,
      ).toBe("warning");
      expect(
        urgenciaDoCronograma(
          {
            ...base,
            cronograma_dias_para_proxima: null,
            cronograma_proxima_atividade: "Entrevistas",
          },
          hoje,
        ),
      ).toEqual({ tom: "info", rotulo: "Próxima: Entrevistas" });
      expect(seloDoCronograma({ status: "Em andamento" }, hoje)).toMatchObject({
        rotulo: "Sem cronograma",
      });
      expect(seloDoCronograma({ status: "Concluído" }, hoje)).toBeNull();
      expect(statusCanonico("")).toBe("Cronograma pendente");
      expect(statusCanonico("Cancelada")).toBe("Cancelado");
    });

    it("taxa sem contratação e datas", () => {
      expect(taxaDeOciosidade({ vagas_total: 10, contratados: 4 })).toEqual({
        pct: 60,
        nivel: "critical",
      });
      expect(taxaDeOciosidade({ vagas_total: 0, contratados: 3 }).pct).toBe(0);
      expect(dataCurta("2026-10-01T10:00:00")).toBe("01/10/2026");
    });

    it("colunas: só as conhecidas, na ordem da tabela, nunca nenhuma", () => {
      expect(normalizarColunas(["atencao", "edital", "risco"])).toEqual([
        "edital",
        "atencao",
      ]);
      // Quem nunca escolheu: todas menos Observações (que fica na gaveta).
      expect(normalizarColunas(null)).toHaveLength(17);
      expect(normalizarColunas(null)).not.toContain("observacoes");
      // Quem escolheu Observações continua com ela.
      expect(normalizarColunas(["observacoes", "edital"])).toEqual([
        "edital",
        "observacoes",
      ]);
      expect(alternarColuna(["edital"], "edital", false)).toEqual(["edital"]);
      expect(alternarColuna(["atencao"], "unidade", true)).toEqual([
        "unidade",
        "atencao",
      ]);
    });

    it("link do edital só se for http(s)", () => {
      expect(linkSeguro("https://agsus.org.br/e.pdf")).toBe(
        "https://agsus.org.br/e.pdf",
      );
      expect(linkSeguro("javascript:alert(1)")).toBe("");
    });
  });

  describe("exportação", () => {
    it("CSV com ; e aspas, sem fórmula de planilha, com fase e atenção", () => {
      const csv = csvDaVisaoGeral([
        {
          unidade: '=HYPERLINK("x")',
          edital: 'A "B"',
          observacoes: "1\n2",
          fase: "Entrevistas",
          atencao: [{ rotulo: "Etapa hoje" }, { rotulo: "Sem inscritos" }],
        },
      ]);
      expect(csv.charCodeAt(0)).toBe(0xfeff);
      const [cabecalho, linha] = csv.slice(1).split("\n");
      expect(cabecalho.split(";")[0]).toBe('"Unidade"');
      expect(cabecalho).toContain('"Fase";"Etapa";"Atenção"');
      expect(linha).toContain(`"'=HYPERLINK(""x"")"`);
      expect(linha).toContain('"A ""B"""');
      expect(linha).toContain('"1 2"');
      expect(linha).toContain('"Etapa hoje; Sem inscritos"');
    });

    it("nome do arquivo pela área e pelo dia", () => {
      expect(
        nomeDoCsv("saude-indigena", new Date("2026-10-01T22:30:00-03:00")),
      ).toBe("AgSUS_Monitora_SaudeIndigena_20261001.csv");
    });

    it("o cabeçalho do PDF diz os filtros e os números do recorte (contas novas)", () => {
      expect(
        resumoDoRelatorio({
          filtros: comFiltros({ uf: ["MT"] }),
          busca: "médico",
          atalho: "criticos",
          linhas: LINHAS.slice(0, 3),
        }),
      ).toEqual({
        filtros: "UF: MT · Busca: médico · Críticos",
        processos: 3,
        vagas: 23,
        contratados: 11,
        ociosas: 6,
        pctOciosas: 26,
      });
      expect(resumoDoRelatorio({ filtros: filtrosVazios() }).filtros).toBe(
        "Nenhum filtro aplicado (todos os processos)",
      );
    });
  });

  describe("textos de Configurações", () => {
    it("vale o publicado; vazio cai no padrão; o rótulo antigo de Contratações não vale para Contratadas", () => {
      const valores = new Map([
        ["kpi_vagas_label", "Vagas Imediatas Previstas"],
        ["kpi_contratados_label", "Contratações de Vagas Imediatas + CR"],
        ["filter_title", "  "],
        ["filter_subtitle", "Escolha o recorte"],
      ]);
      const textos = textosDaVisaoGeral((chave) => valores.get(chave));
      expect(textos.rotulos.kpi_vagas_label).toBe("Vagas Imediatas Previstas");
      expect(textos.rotulos.kpi_contratadas_label).toBe("Contratadas");
      expect(textos.rotulos.kpi_em_selecao_label).toBe("Em seleção");
      expect(textos.rotulos).not.toHaveProperty("kpi_contratados_label");
      expect(textos.filtros).toBe("Refinar resultados");
      expect(textos.filtrosSubtitulo).toBe("Escolha o recorte");
    });
  });
});

bloco("zoom-minimo-acompanha-a-moldura", () => {
  /*
  O ZOOM MÍNIMO ACOMPANHA A MOLDURA

  O bug (Visão geral da Saúde Indígena, depois do "Mapa DSEIs"): o mínimo
  só era recalculado dentro de um enquadramento do Brasil. Os mapas da Visão
  geral enquadram sozinhos (`enquadramentoProprio`) e, depois de a pessoa
  mexer no mapa, não reenquadram ao mudar de tamanho. Com o card mais baixo,
  o mínimo continuava o da medida antiga: medido no navegador, 724×778 → 724×558
  ficava em 4.25 com o "−" desabilitado e o Brasil de borda a borda
  (lat. 5.27 a −33.8), sem folga e sem como afastar.

  Agora todo `resize` do Leaflet recalcula o mínimo: o zoom em que o país
  inteiro cabe com a folga, nunca acima da escala nacional (4.5).
*/

  function caixa(entrada, segundo) {
    if (entrada?.getSouth) return entrada;
    const [a, b] = segundo ? [entrada, segundo] : entrada;
    return {
      getSouth: () => Math.min(a[0], b[0]),
      getNorth: () => Math.max(a[0], b[0]),
      getWest: () => Math.min(a[1], b[1]),
      getEast: () => Math.max(a[1], b[1]),
    };
  }

  function mapaFalso({ enquadramentoProprio }) {
    const ouvintes = {};
    const mapa = {
      options: { enquadramentoProprio },
      tamanho: { x: 724, y: 778 },
      on(eventos, fn) {
        for (const nome of eventos.split(" ")) (ouvintes[nome] ||= []).push(fn);
        return mapa;
      },
      disparar(nome) {
        for (const fn of ouvintes[nome] || []) fn();
      },
      whenReady: () => {},
      getContainer: () => null,
      getSize: () => mapa.tamanho,
      getZoom: () => 4.25,
      setMaxBounds: vi.fn(),
      setMinZoom: vi.fn(),
      fitBounds: vi.fn(),
      setView: vi.fn(),
      invalidateSize: vi.fn(),
      panInsideBounds: vi.fn(),
    };
    return mapa;
  }

  describe("o zoom mínimo acompanha a moldura", () => {
    let mapa;
    let minimoOriginal;

    const montar = async ({ enquadramentoProprio = true } = {}) => {
      mapa = mapaFalso({ enquadramentoProprio });
      minimoOriginal = mapa.setMinZoom;
      globalThis.window = {
        L: {
          map: vi.fn(() => mapa),
          tileLayer: vi.fn(),
          latLngBounds: vi.fn(caixa),
          latLng: vi.fn((lat, lng) => ({ lat, lng })),
        },
        setTimeout: globalThis.setTimeout,
        clearTimeout: globalThis.clearTimeout,
        requestAnimationFrame: (fn) => globalThis.setTimeout(fn, 0),
      };
      const { protegerMapa } =
        await import("../src/modulos/mapa-saude-indigena/guarda-do-mapa.ts");
      protegerMapa(window.L, mapa);
      minimoOriginal.mockClear();
    };

    beforeEach(() => {
      vi.resetModules();
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
      delete globalThis.window;
    });

    it("o card que encolhe baixa o mínimo até o Brasil caber (mapa com enquadramento próprio)", async () => {
      await montar();
      mapa.tamanho = { x: 724, y: 558 };
      mapa.disparar("resize");

      const esperado = zoomQueCabe({ largura: 724, altura: 558 });
      expect(esperado).toBeLessThan(4.25);
      expect(minimoOriginal).toHaveBeenLastCalledWith(esperado);
    });

    it("o card que cresce volta à escala nacional, sem passar dela", async () => {
      await montar();
      mapa.tamanho = { x: 724, y: 400 };
      mapa.disparar("resize");
      mapa.tamanho = { x: 1400, y: 1000 };
      mapa.disparar("resize");
      expect(minimoOriginal).toHaveBeenLastCalledWith(ZOOM_NACIONAL);
    });

    it("vale também para o mapa que o guarda enquadra", async () => {
      await montar({ enquadramentoProprio: false });
      mapa.tamanho = { x: 600, y: 480 };
      mapa.disparar("resize");
      expect(minimoOriginal).toHaveBeenLastCalledWith(
        zoomQueCabe({ largura: 600, altura: 480 }),
      );
    });

    it("mapa removido não mexe no mínimo", async () => {
      await montar();
      mapa.disparar("unload");
      mapa.tamanho = { x: 724, y: 400 };
      mapa.disparar("resize");
      expect(minimoOriginal).not.toHaveBeenCalled();
    });
  });
});
