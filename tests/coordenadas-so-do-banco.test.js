import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classificarRegistros,
  dicaDoRegistro,
  popupDaSede,
  popupDoRegistro,
  registroDaSede,
  registrosDoDsei,
} from "../src/lib/mapa-saude-indigena/mapa-do-dsei.js";
import {
  bolhasDosDsei,
  casaisNacionais,
  dicaDaBolha,
  dicaDaCasaiNacional,
  popupDaCasaiNacional,
} from "../src/lib/mapa-saude-indigena/mapa-nacional.js";

/*
  O BANCO É A ÚNICA FONTE DE COORDENADA DO MAPA DA SAÚDE INDÍGENA

  Em 01–02/10/2026 a auditoria contra fontes oficiais corrigiu 162 polos e 2
  CASAIs direto no banco (`lmap` e `rede_cnes` de TB_CONFIG_MAPA_SAUDE_INDIG).
  O front desfazia parte disso: os vereditos da validação de 22/09 trocavam a
  posição do polo, e a planilha de Lotações (com erros, sem versão corrigida)
  preenchia coordenada e acrescentava pontos. Os dois saíram.

  Os dados abaixo carregam de propósito os campos que aquele caminho gravava
  (`coord_lmap`, `coord_lotacoes`, `veredicto_localizacao`, a meta na posição
  9 do `rede_cnes`): se alguém voltar a lê-los, o teste cai.
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
  ],
};

const metaAntiga = {
  veredicto_localizacao: { estado: "conflito", km: 101 },
  validacao_coordenada: "validada",
  confirmacao_independente: true,
  coordenadas: { lotacoes: { lat: -6, lon: -6 } },
};

const redeCnes = {
  rede: {
    TESTE: {
      u: [
        [
          "POLO BASE XITEI",
          "111",
          -9.9,
          -36.0,
          "TRAIPU",
          27,
          "",
          "",
          "",
          metaAntiga,
        ],
        [
          "UBSI ALDEIA",
          "222",
          -10.1,
          -36.4,
          "PORTO REAL",
          27,
          "",
          "",
          "",
          metaAntiga,
        ],
      ],
      c: [["CASAI AL/SE", "333", -9.62, -35.73, "MACEIO", 27]],
    },
  },
  nac: [
    [
      "CASAI BRASÍLIA",
      "7898215",
      -15.75,
      -47.71,
      "BRASÍLIA",
      53,
      "",
      "",
      "",
      metaAntiga,
    ],
  ],
};

const TEXTO_DE_VALIDACAO =
  /valida|apurad|confirmad|discorda|em valida|fonte|verific/i;

const textos = (conteudo) =>
  [conteudo?.titulo, ...(conteudo?.linhas || []), conteudo?.nota]
    .filter(Boolean)
    .join("\n");

describe("a coordenada desenhada é exatamente a do banco", () => {
  const registros = registrosDoDsei(dsei, redeCnes);
  const porNome = (trecho) => registros.find((r) => r.name.includes(trecho));

  it("polo reconciliado com o CNES: posição do lmap (lat/lon do polo), sem veredito nem coord_lmap", () => {
    const xitei = porNome("XITEI");
    expect([xitei.lat, xitei.lon]).toEqual([-9.91, -36.01]);
  });

  it("polo sem par no CNES: posição do lmap", () => {
    const solto = porNome("SOLTO");
    expect([solto.lat, solto.lon]).toEqual([-9.3, -36.3]);
  });

  it("estabelecimento do rede_cnes: a coordenada da linha, não a da planilha", () => {
    const ubsi = porNome("ALDEIA");
    expect([ubsi.lat, ubsi.lon]).toEqual([-10.1, -36.4]);
    const casai = porNome("CASAI");
    expect([casai.lat, casai.lon]).toEqual([-9.62, -35.73]);
  });

  it("só desenha o que está no lmap ou no rede_cnes", () => {
    expect(registros.map((r) => r.name).sort()).toEqual(
      ["CASAI AL/SE", "POLO BASE XITEI", "SOLTO", "UBSI ALDEIA"].sort(),
    );
    expect(registros.some((r) => "veredicto" in r)).toBe(false);
  });

  it("sede e bolha do DSEI usam a lat/lon do lmap", () => {
    const sede = registroDaSede(dsei);
    expect([sede.lat, sede.lon]).toEqual([-9.6, -35.7]);
    const [bolha] = bolhasDosDsei({ dseis: [dsei] });
    expect([bolha.lat, bolha.lon]).toEqual([-9.6, -35.7]);
  });

  it("CASAI nacional: a coordenada do rede_cnes.nac", () => {
    const [casai] = casaisNacionais({ nac: redeCnes.nac });
    expect([casai.lat, casai.lon]).toEqual([-15.75, -47.71]);
  });
});

describe("popups e dicas sem texto de validação", () => {
  it("unidade: nome, tipo, município/UF e CNES — e nada mais", () => {
    const classificados = classificarRegistros(
      registrosDoDsei(dsei, redeCnes),
      dsei,
    );
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
      linhas: ["UBSI ALDEIA", "PORTO REAL – AL", "CNES: 222"],
    });
  });

  it("sede, bolha e CASAI nacional também", () => {
    expect(textos(popupDaSede(dsei))).not.toMatch(TEXTO_DE_VALIDACAO);
    const [bolha] = bolhasDosDsei({ dseis: [dsei] });
    expect(textos(dicaDaBolha(bolha))).not.toMatch(TEXTO_DE_VALIDACAO);
    const [casai] = casaisNacionais({ nac: redeCnes.nac });
    expect(textos(popupDaCasaiNacional(casai))).not.toMatch(TEXTO_DE_VALIDACAO);
    expect(textos(dicaDaCasaiNacional(casai))).not.toMatch(TEXTO_DE_VALIDACAO);
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
