import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { regraComTextosSemEspacosNasPontas } from "../../src/lib/avaliacao-documental/textos-da-regra.ts";

/*
  O salvar da regra (assistente e modo avançado) tira os espaços das pontas
  dos textos que vão para o parecer: o motivo da regra do 114/2026 terminava
  com espaço (item 8.2.10.7).
*/
const CASOS = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
    "utf8",
  ),
);

describe("textos da regra sem espaço nas pontas ao salvar", () => {
  const regra = {
    schema: 1,
    titulo_etapa: " Avaliação ",
    provisoria: {
      eliminacao_automatica: [{ coluna_prefixo: "SITUAÇÃO - " }],
    },
    blocos: [
      {
        codigo: "IDENTIDADE",
        titulo: "Identidade ",
        motivos: [
          {
            codigo: "NOME",
            texto: " Sem a certidão  que justifique a alteração de nome. ",
            item_edital: "8.2.10.7 ",
          },
        ],
      },
      { codigo: "CURSOS", titulo: "Cursos" },
    ],
    observacoes_prontas: [
      {
        codigo: "OBS",
        rotulo: " Rótulo ",
        texto: "\tAceito. ",
        item_edital: "",
      },
    ],
    por_cargo: [
      {
        codigo: "C15",
        rotulo: "Cargo 15",
        blocos: {
          REQUISITO_DO_CARGO: {
            requisitos: [
              {
                codigo: "CNH",
                rotulo: "CNH",
                motivo: "Sem CNH D. ",
                item_edital: " 2",
              },
            ],
          },
          CURSOS: { teto: 15 },
        },
      },
    ],
  };

  it("tira só as pontas dos motivos, observações prontas e requisitos por cargo", () => {
    const limpa = regraComTextosSemEspacosNasPontas(regra);
    expect(limpa.blocos[0].motivos[0]).toEqual({
      codigo: "NOME",
      texto: "Sem a certidão  que justifique a alteração de nome.",
      item_edital: "8.2.10.7",
    });
    expect(limpa.observacoes_prontas[0]).toEqual({
      codigo: "OBS",
      rotulo: " Rótulo ",
      texto: "Aceito.",
      item_edital: "",
    });
    expect(
      limpa.por_cargo[0].blocos.REQUISITO_DO_CARGO.requisitos[0],
    ).toMatchObject({ motivo: "Sem CNH D.", item_edital: "2" });
    expect(limpa.por_cargo[0].blocos.CURSOS).toEqual({ teto: 15 });
    // O resto da regra fica como está (o prefixo da coluna termina em espaço de propósito).
    expect(limpa.provisoria).toBe(regra.provisoria);
    expect(limpa.titulo_etapa).toBe(" Avaliação ");
    expect(limpa.blocos[0].titulo).toBe("Identidade ");
    expect(limpa.blocos[1]).toBe(regra.blocos[1]);
  });

  it("não muda a regra de entrada", () => {
    const antes = JSON.stringify(regra);
    regraComTextosSemEspacosNasPontas(regra);
    expect(JSON.stringify(regra)).toBe(antes);
  });

  it("regras dos casos dourados: só os motivos do 8.2.10.7 do 114 mudam", () => {
    for (const [codigo, r] of Object.entries(CASOS.regras)) {
      const esperada =
        codigo === "E114-POR-CARGO"
          ? JSON.parse(
              JSON.stringify(r).replaceAll(
                'do(a) candidato(a). "',
                'do(a) candidato(a)."',
              ),
            )
          : r;
      expect(regraComTextosSemEspacosNasPontas(r)).toEqual(esperada);
    }
    expect(JSON.stringify(CASOS.regras["E114-POR-CARGO"])).toContain(
      'do(a) candidato(a). "',
    );
  });
});
