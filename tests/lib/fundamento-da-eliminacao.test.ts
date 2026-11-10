import { describe, expect, it } from "vitest";
import {
  categoriaNaTriagem,
  conferirEntrada,
  ehEliminacaoAdministrativa,
  fundamentoDoBanco,
  fundamentoDoComunicado,
  linhaDoFundamento,
  quadroDosFundamentos,
} from "../../src/lib/avaliacao-documental/fundamento-da-eliminacao.ts";
import { espelhoDaEliminacaoPreAnalise } from "../../src/lib/avaliacao-documental/espelho-da-pre-classificacao.ts";
import { comunicadosDosEliminados } from "../../src/lib/avaliacao-documental/documentos-em-lote.ts";

/*
  Issue #593: o fundamento normativo das eliminações da Triagem só entra no
  comunicado quando conferido por quem tem a autoridade (banco), nunca presumido.
  Dados fictícios.
*/

const CONFERIDO = {
  situacao: "CONFERIDO",
  item_edital: "6.4",
  versao_regra: 2,
  fonte: "Edital de exemplo nº 1/2099, texto publicado",
  conferido_em: "2099-01-02T10:00:00Z",
};

describe("motivos administrativos × fora do lote pela nota", () => {
  it("QUESTIONARIO, CANCELADO e REPROVADO_EMPREGARE são administrativos; os demais não", () => {
    for (const m of ["QUESTIONARIO", "CANCELADO", "REPROVADO_EMPREGARE"])
      expect(ehEliminacaoAdministrativa(m)).toBe(true);
    for (const m of ["TERMO", "SAIU_DA_EMPREGARE", "", null])
      expect(ehEliminacaoAdministrativa(m)).toBe(false);
  });

  it("separa eliminado administrativo, outro eliminado, fora do lote pela nota e no lote", () => {
    expect(
      categoriaNaTriagem({ situacao: "ELIMINADO", motivo_codigo: "CANCELADO" }),
    ).toBe("ELIMINADO_ADMINISTRATIVO");
    expect(
      categoriaNaTriagem({ situacao: "ELIMINADO", motivo_codigo: "TERMO" }),
    ).toBe("ELIMINADO");
    expect(
      categoriaNaTriagem({ situacao: "RANQUEADO", motivo_codigo: null }),
    ).toBe("FORA_DO_LOTE_POR_NOTA");
    expect(categoriaNaTriagem({ situacao: "NO_LOTE" })).toBe("NO_LOTE");
  });
});

describe("fundamento do banco", () => {
  it("lê o conferido e recusa o malformado", () => {
    expect(fundamentoDoBanco(CONFERIDO)).toEqual(CONFERIDO);
    expect(fundamentoDoBanco(null)).toBeNull();
    expect(
      fundamentoDoBanco({ ...CONFERIDO, item_edital: "item 6" }),
    ).toBeNull();
    expect(
      fundamentoDoBanco({ ...CONFERIDO, situacao: "PRESUMIDO" }),
    ).toBeNull();
    expect(fundamentoDoBanco({ ...CONFERIDO, versao_regra: "2" })).toBeNull();
  });

  it("só o CONFERIDO vira linha do comunicado", () => {
    expect(
      fundamentoDoComunicado({ ...CONFERIDO, situacao: "RECONFERIR" }),
    ).toBeNull();
    expect(linhaDoFundamento(CONFERIDO)).toBe(
      "Fundamento normativo: item 6.4 do edital (conferido pela gestão do edital na regra da triagem, versão 2).",
    );
    expect(linhaDoFundamento(undefined)).toBeNull();
  });
});

describe("até o PDF do comunicado", () => {
  const eliminado = {
    vaga: "101",
    codigo: "9001",
    nome: "Candidato Fictício",
    situacao: "ELIMINADO",
    motivo: "Não finalizou o questionário",
    motivo_codigo: "QUESTIONARIO",
    art: 0,
    declarada: 0,
  };
  const pessoa = {
    chave: "101|9001",
    codigo: "9001",
    nome: "Candidato Fictício",
    vaga: "101",
    detalhe: "",
  };

  it("o lote leva o fundamento conferido ao comunicado e não mostra notas administrativas", () => {
    const { documentos } = comunicadosDosEliminados(
      [{ ...eliminado, fundamento: CONFERIDO }],
      [{ codigo: "101", cargo: "Enfermeiro(a)" }],
      [pessoa],
      { edital: "Edital 1/2099" },
    );
    expect(documentos[0]?.justificativas).toEqual([
      "Não finalizou o questionário",
      "Fundamento normativo: item 6.4 do edital (conferido pela gestão do edital na regra da triagem, versão 2).",
    ]);
    expect(documentos[0]?.notas.map((n) => n.rotulo)).toEqual([
      "Nota da análise documental",
    ]);
  });

  it("sem fundamento conferido, o comunicado sai só com o motivo (nada presumido)", () => {
    for (const fundamento of [null, { ...CONFERIDO, situacao: "RECONFERIR" }]) {
      const e = espelhoDaEliminacaoPreAnalise({
        ...eliminado,
        edital: "Edital 1/2099",
        fundamento,
      });
      expect(e.justificativas).toEqual(["Não finalizou o questionário"]);
      expect(e.justificativas.join(" ")).not.toMatch(/8\.2\.6/);
    }
  });
});

describe("quadro dos fundamentos", () => {
  it("normaliza o que o banco devolve", () => {
    const q = quadroDosFundamentos({
      pode_conferir: true,
      regra: { versao: 2, situacao: "CONFERIDA", item_da_nota: "8.2.6" },
      motivos: [
        {
          codigo: "QUESTIONARIO",
          motivo: "Não finalizou",
          item_na_regra: null,
          eliminados: 3,
          fundamento: CONFERIDO,
        },
        {
          codigo: "TERMO",
          motivo: "Recusou",
          item_na_regra: "5.7.5",
          eliminados: 0,
          fundamento: null,
        },
        { codigo: "" },
      ],
      fora_da_regra: [
        { codigo: "SAIU_DA_EMPREGARE", motivo: "Saiu", eliminados: 1 },
      ],
      fora_do_lote_por_nota: 7,
      historico: [
        {
          id: 1,
          motivo_codigo: "QUESTIONARIO",
          item_edital: "6.4",
          versao_regra: 2,
          fonte: "x",
          papel: "COORDENADOR",
          por: "Pessoa",
          em: "2099-01-02T10:00:00Z",
        },
      ],
    });
    expect(q.podeConferir).toBe(true);
    expect(q.regra).toEqual({
      versao: 2,
      situacao: "CONFERIDA",
      itemDaNota: "8.2.6",
    });
    expect(
      q.motivos.map((m) => [
        m.codigo,
        m.administrativo,
        m.fundamento?.item_edital ?? null,
      ]),
    ).toEqual([
      ["QUESTIONARIO", true, "6.4"],
      ["TERMO", false, null],
    ]);
    expect(q.foraDaRegra).toHaveLength(1);
    expect(q.foraDoLotePorNota).toBe(7);
    expect(q.historico[0]?.papel).toBe("COORDENADOR");
  });

  it("resposta vazia ou estranha não inventa permissão nem fundamento", () => {
    const q = quadroDosFundamentos(null);
    expect(q).toEqual({
      podeConferir: false,
      regra: null,
      motivos: [],
      foraDaRegra: [],
      foraDoLotePorNota: 0,
      historico: [],
    });
  });
});

describe("conferência do formulário (igual à do banco)", () => {
  const base = {
    item: "6.4",
    fonte: "Edital nº 1/2099 publicado",
    justificativa: "",
  };

  it("aceita item e fonte válidos sem conferência anterior", () => {
    expect(
      conferirEntrada(base, { anterior: null, itemDaNota: "8.2.6" }),
    ).toEqual({
      erros: {},
      exigeJustificativa: [],
    });
  });

  it("recusa item fora do formato e fonte curta", () => {
    const { erros } = conferirEntrada(
      { item: "item 6", fonte: "edital", justificativa: "" },
      { anterior: null, itemDaNota: null },
    );
    expect(Object.keys(erros).sort()).toEqual(["fonte", "item"]);
  });

  it("o item da nota mínima do lote pede justificativa", () => {
    const r = conferirEntrada(
      { ...base, item: "8.2.6" },
      { anterior: null, itemDaNota: "8.2.6" },
    );
    expect(r.exigeJustificativa).toEqual(["ITEM_DA_NOTA"]);
    expect(r.erros.justificativa).toMatch(/nota mínima do lote/);
  });

  it("retificar (item ou fonte diferentes) pede justificativa; repetir, não", () => {
    const anterior = { item_edital: "6.4", fonte: base.fonte };
    expect(
      conferirEntrada(base, { anterior, itemDaNota: null }).exigeJustificativa,
    ).toEqual([]);
    const r = conferirEntrada(
      { ...base, item: "6.5" },
      { anterior, itemDaNota: null },
    );
    expect(r.exigeJustificativa).toEqual(["RETIFICACAO"]);
    expect(r.erros.justificativa).toMatch(/retificação/);
    expect(
      conferirEntrada(
        {
          ...base,
          item: "6.5",
          justificativa: "Conferido de novo no texto publicado",
        },
        { anterior, itemDaNota: null },
      ).erros,
    ).toEqual({});
  });
});
