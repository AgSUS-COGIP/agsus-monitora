import { describe, expect, it } from "vitest";
import {
  faltaNasDatasDoVinculo,
  fimDoVinculoAtual,
  hojeEmBrasilia,
} from "../../src/lib/avaliacao-documental/datas-do-vinculo.ts";
import {
  colunasDaEtapa,
  textoDaColuna,
} from "../../src/lib/avaliacao-documental/fila.ts";
import { linhaDoItemLido } from "../../src/lib/avaliacao-documental/leitura-dos-arquivos.ts";

/*
  As datas dos vínculos da ficha (20261023090000): nada antes de 1960 nem fim
  depois de hoje (o banco recusa o mesmo ao salvar e ao concluir) e o vínculo
  "atual" que vai até a data limite do bloco (o fim das inscrições), não até
  hoje. E a coluna "Motivo da revisão" da fila. Dados fictícios.
*/
const HOJE = "2026-10-22";

describe("datas do vínculo", () => {
  it("aceita o vínculo comum", () => {
    expect(
      faltaNasDatasDoVinculo({ inicio: "2020-01-01", fim: "2026-10-14" }, HOJE),
    ).toBeNull();
    expect(
      faltaNasDatasDoVinculo({ inicio: "2026-10-22", fim: "2026-10-22" }, HOJE),
    ).toBeNull();
  });

  it("recusa a data inválida, o fim antes do início, antes de 1960 e o fim depois de hoje", () => {
    expect(
      faltaNasDatasDoVinculo({ inicio: "2026-02-30", fim: "2026-03-01" }, HOJE),
    ).toBe("Confira o início e o fim do vínculo.");
    expect(
      faltaNasDatasDoVinculo({ inicio: "2026-03-01", fim: "2026-02-01" }, HOJE),
    ).toBe("Confira o início e o fim do vínculo.");
    expect(
      faltaNasDatasDoVinculo({ inicio: "1959-12-31", fim: "1961-01-01" }, HOJE),
    ).toMatch(/antes de 1960/);
    expect(
      faltaNasDatasDoVinculo({ inicio: "2026-01-01", fim: "2026-10-23" }, HOJE),
    ).toMatch(/fim depois de hoje/);
  });

  it("hoje é o dia de Brasília", () => {
    // 02:00 UTC de 23/10 ainda é 22/10 em Brasília.
    expect(hojeEmBrasilia(new Date("2026-10-23T02:00:00Z"))).toBe("2026-10-22");
  });

  it("o vínculo atual vai até a data limite, não até hoje; a emissão antes dela vale", () => {
    expect(fimDoVinculoAtual({ dataLimite: "2026-10-14", hoje: HOJE })).toBe(
      "2026-10-14",
    );
    expect(
      fimDoVinculoAtual({
        emissao: "2026-09-01",
        dataLimite: "2026-10-14",
        hoje: HOJE,
      }),
    ).toBe("2026-09-01");
    expect(fimDoVinculoAtual({ dataLimite: "2026-12-31", hoje: HOJE })).toBe(
      HOJE,
    );
    expect(fimDoVinculoAtual({ emissao: "2026-09-01", hoje: HOJE })).toBe(
      "2026-09-01",
    );
    expect(fimDoVinculoAtual({ hoje: HOJE })).toBe("");
  });

  it("Aceitar o vínculo atual lido do arquivo preenche o fim com a data limite do bloco", () => {
    const bloco = {
      codigo: "EXPERIENCIA",
      tipo: "VINCULOS",
      categorias: [{ codigo: "AREA" }],
      data_limite: "2026-10-14",
    };
    const lido = (extra) => ({
      tipo: "VINCULO",
      empregador: "Clínica fictícia",
      inicio: "2025-01-01",
      fim: null,
      atual: true,
      ...extra,
    });
    // A data da leitura não é fim: vale a data limite.
    expect(
      linhaDoItemLido(
        bloco,
        lido({ dias_ate: "2026-10-20", dias_ate_fonte: "LEITURA" }),
        "k",
      ).fim,
    ).toBe("2026-10-14");
    // A emissão do documento antes da data limite: o documento comprova até ali.
    expect(
      linhaDoItemLido(
        bloco,
        lido({ dias_ate: "2026-08-31", dias_ate_fonte: "EMISSAO" }),
        "k",
      ).fim,
    ).toBe("2026-08-31");
    // Sem data limite no bloco: como antes, até onde o robô contou.
    expect(
      linhaDoItemLido(
        { ...bloco, data_limite: null },
        lido({ dias_ate: "2026-08-31", dias_ate_fonte: "EMISSAO" }),
        "k",
      ).fim,
    ).toBe("2026-08-31");
  });
});

describe("motivo da revisão na fila", () => {
  it("a etapa Em revisão mostra o motivo (da coordenação ou da conferência automática)", () => {
    expect(colunasDaEtapa("revisao")).toContain("motivo_revisao");
    const linha = {
      ficha: {
        situacao: "REVISAR",
        motivo_revisao:
          "Conferência automática: a ficha concluída tem pendência pela regra vigente — Experiência: …",
      },
    };
    expect(textoDaColuna(linha, "motivo_revisao")).toMatch(
      /^Conferência automática:/,
    );
    expect(textoDaColuna({ ficha: {} }, "motivo_revisao")).toBe("");
  });
});
