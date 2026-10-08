import { describe, expect, it } from "vitest";
import { correcaoDesfazivel } from "../src/lib/editor-de-coordenadas.ts";
import {
  correcaoDoEditor,
  historicoDoEditor,
  pendenciasDoEditor,
} from "../src/lib/respostas-do-editor-de-coordenadas.ts";

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
