import { describe, expect, it } from "vitest";
import {
  configuracaoDoMapa,
  redeCnesDoMapa,
  terrasDoMapa,
} from "../src/lib/mapa-saude-indigena/dados-do-mapa.ts";
import { registrosDoDsei } from "../src/lib/mapa-saude-indigena/mapa-do-dsei.js";
import { leafletDoMapa } from "../src/modulos/mapa-saude-indigena/tipos-do-leaflet.ts";
import { criarLeafletFalso } from "./modulos/leaflet-falso.js";

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
    const rede = redeCnesDoMapa({
      rede: { A: { u: [["UBSI A", 789, -12, -50, 12, 27]] } },
    });
    expect(rede.rede.A.u[0]).toEqual(["UBSI A", 789, -12, -50, "12", 27]);
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
      expect(redeCnesDoMapa(valor)).toEqual({ rede: {}, nac: [] });
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
    const rede = redeCnesDoMapa({
      rede: { A: { u: [null, ["UBSI A", "001", [], false]], c: {} } },
      nac: {},
    });
    expect(configuracao.dsei[0].polos[0]).toMatchObject({
      lat: null,
      lon: null,
    });
    expect(rede.rede.A.u[0]).toEqual(["UBSI A", "001", null, null, "", ""]);
    expect(
      registrosDoDsei(configuracao.dsei[0], rede).map((r) => r.name),
    ).toEqual(["Com posição"]);
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
