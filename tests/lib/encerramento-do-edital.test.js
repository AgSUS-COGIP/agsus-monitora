import { describe, expect, it } from "vitest";
import {
  editaisDoEvento,
  encerramentoAMostrar,
  fogosDoEncerramento,
  formatarDia,
  formatarPercentual,
  lerEncerramentos,
  numeroCurto,
  numeroDoEdital,
  selosDoPerfil,
  tituloDeQuemFechou,
} from "../../src/lib/encerramento-do-edital.ts";

/*
  Encerramento do edital: a leitura da RPC, a tela a mostrar (uma por vez, a
  mais antiga não vista), os selos e que fogos soltar.
*/

const bruto = (parte = {}) => ({
  id: "e114",
  edital: "114/2026",
  numero: "114/2026",
  area: "projetos",
  concluido_em: "2026-10-22T18:00:00Z",
  inscritos: 7726,
  fichas: 1512,
  dias: 9,
  visto: false,
  minha: {
    fichas: 50,
    percentual: 3.3,
    melhor_dia: { dia: "2026-10-21", qt: 20 },
    fechou: false,
  },
  ...parte,
});

describe("leitura da RPC", () => {
  it("normaliza números, datas e a contribuição", () => {
    const [e] = lerEncerramentos({ editais: [bruto()] });
    expect(e).toEqual({
      id: "e114",
      edital: "114/2026",
      numero: "114/2026",
      area: "projetos",
      concluidoEm: "2026-10-22T18:00:00Z",
      inscritos: 7726,
      fichas: 1512,
      dias: 9,
      visto: false,
      minha: {
        fichas: 50,
        percentual: 3.3,
        melhorDia: { dia: "2026-10-21", qt: 20 },
        fechou: false,
      },
    });
  });

  it("resposta ruim vira lista vazia; descarta edital sem id, número ou ficha da pessoa", () => {
    expect(lerEncerramentos(null)).toEqual([]);
    expect(lerEncerramentos({ editais: "x" })).toEqual([]);
    expect(
      lerEncerramentos({
        editais: [
          bruto({ id: "" }),
          bruto({ numero: "", edital: "sem número" }),
          bruto({ minha: { fichas: 0 } }),
          null,
        ],
      }),
    ).toEqual([]);
  });

  it("sem percentual, calcula; nunca passa de 100% nem do total", () => {
    const [e] = lerEncerramentos({
      editais: [bruto({ fichas: 3, minha: { fichas: 9, percentual: null } })],
    });
    expect(e.minha.fichas).toBe(3);
    expect(e.minha.percentual).toBe(100);
    expect(e.minha.melhorDia).toBeNull();
  });

  it("ordena pelo encerramento; mostra o mais antigo não visto", () => {
    const lista = lerEncerramentos({
      editais: [
        bruto({ id: "b", numero: "120/2026", concluido_em: "2026-11-02" }),
        bruto({ id: "a", visto: true, concluido_em: "2026-10-22" }),
        bruto({ id: "c", numero: "93/2026", concluido_em: "2026-10-30" }),
      ],
    });
    expect(lista.map((e) => e.id)).toEqual(["a", "c", "b"]);
    expect(encerramentoAMostrar(lista).id).toBe("c");
    expect(
      encerramentoAMostrar(lista.map((e) => ({ ...e, visto: true }))),
    ).toBeNull();
  });
});

describe("selos e quem fechou", () => {
  it("um selo por edital, genérico pelo número; quem fechou leva o título", () => {
    const lista = lerEncerramentos({
      editais: [
        bruto(),
        bruto({
          id: "e93",
          numero: "093/2026",
          concluido_em: "2026-10-23",
          minha: { fichas: 1, fechou: true },
        }),
      ],
    });
    expect(selosDoPerfil(lista)).toEqual([
      {
        id: "e114",
        numero: "114/2026",
        fechou: false,
        titulo: "Edital 114/2026: você analisou 50 fichas",
      },
      {
        id: "e93",
        numero: "93/2026",
        fechou: true,
        titulo: "Edital 93/2026: você fechou o 93",
      },
    ]);
    expect(numeroCurto("114/2026")).toBe("114");
    expect(tituloDeQuemFechou("114/2026")).toBe("fechou o 114");
    expect(numeroDoEdital("Edital nº 091/2026 - Projetos")).toBe("91/2026");
  });
});

describe("fogos da tela", () => {
  const [comum] = lerEncerramentos({ editais: [bruto()] });
  const [fechou] = lerEncerramentos({
    editais: [bruto({ minha: { fichas: 2, fechou: true } })],
  });

  it("quem entra depois ganha os fogos do marco edital-concluido", () => {
    expect(fogosDoEncerramento(comum, new Set())).toEqual({
      marco: "edital-concluido",
      forma: "coracao",
      texto: "Edital 114/2026 concluído! Obrigado, equipe.",
    });
  });

  it("quem viu o edital zerar na tela não ganha os fogos de novo", () => {
    expect(fogosDoEncerramento(comum, new Set(["114/2026"]))).toBeNull();
    expect(
      editaisDoEvento({ editais: ["114/2026", "Edital 114/2026", ""] }),
    ).toEqual(["114/2026"]);
    expect(editaisDoEvento(null)).toEqual([]);
  });

  it("quem fechou ganha a animação própria, mesmo depois dos fogos do marco", () => {
    expect(fogosDoEncerramento(fechou, new Set(["114/2026"]))).toEqual({
      marco: "edital-fechado",
      forma: "estrela",
      texto: "Você fechou o 114! A última ficha do edital foi sua.",
    });
  });

  it("formatos", () => {
    expect(formatarDia("2026-10-21")).toBe("21/10");
    expect(formatarDia("")).toBe("");
    expect(formatarPercentual(3.3)).toBe("3,3%");
    expect(formatarPercentual(100)).toBe("100%");
  });
});
