import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ACOES_DA_RESPOSTA,
  acoesDaResposta,
  avaliarAcao,
  erroDoComentario,
  ESTADOS_DA_RESPOSTA,
  podeEditarTexto,
  proximoEstado,
} from "../src/lib/resposta-do-recurso.js";

/*
  A máquina de estados da resposta ao recurso e quem pode fazer cada
  transição — o espelho das regras de transicionar_resposta_recurso (o ensaio
  em produção, begin…rollback, conferiu o banco caso a caso).
*/
const MIGRATION = readFileSync(
  "supabase/migrations/20260929230000_recursos_modelos_anexos_respostas.sql",
  "utf8",
).replace(/\r\n/g, "\n");

const AUTORA = "u-autora";
const REVISOR = "u-revisor";
const resposta = (extra = {}) => ({
  id: "resp1",
  estado: "rascunho",
  revisao: 1,
  passou_revisao: false,
  autor_id: AUTORA,
  envio_revisao_por_id: null,
  modelo_situacao: "DEFERIDO",
  ...extra,
});
const contexto = (extra = {}) => ({
  resposta: resposta(),
  eu: AUTORA,
  podeEditar: true,
  podeDecidir: true,
  situacao: "DEFERIDO",
  ...extra,
});

describe("estados e transições", () => {
  it("os estados e as ações são os do banco", () => {
    const estados = MIGRATION.match(
      /"CK_RESPOSTARECURSO_TPESTADO" check \("TP_ESTADO" in \(([^)]*)\)\)/,
    )[1];
    expect(
      [...estados.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort(),
    ).toEqual(ESTADOS_DA_RESPOSTA.map((e) => e.id).sort());
    const acoes = MIGRATION.match(/p_acao not in \(([^)]*)\)/)[1];
    expect([...acoes.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()).toEqual(
      Object.keys(ACOES_DA_RESPOSTA).sort(),
    );
  });

  it.each([
    ["rascunho", "enviar_revisao", "em_revisao"],
    ["devolvida", "enviar_revisao", "em_revisao"],
    ["rascunho", "aprovar", "aprovada"],
    ["em_revisao", "aprovar", "aprovada"],
    ["em_revisao", "devolver", "devolvida"],
    ["aprovada", "reabrir", "rascunho"],
    ["aprovada", "marcar_enviada", "enviada"],
    ["enviada", "reabrir", null],
    ["enviada", "aprovar", null],
    ["devolvida", "aprovar", null],
    ["rascunho", "devolver", null],
    ["em_revisao", "marcar_enviada", null],
    ["rascunho", "inventada", null],
  ])("%s --%s--> %s", (de, acao, para) => {
    expect(proximoEstado(de, acao)).toBe(para);
  });

  it("o texto só muda em rascunho, devolvida ou sem resposta", () => {
    expect(podeEditarTexto(null)).toBe(true);
    expect(podeEditarTexto({ estado: "rascunho" })).toBe(true);
    expect(podeEditarTexto({ estado: "devolvida" })).toBe(true);
    for (const estado of ["em_revisao", "aprovada", "enviada"])
      expect(podeEditarTexto({ estado })).toBe(false);
  });
});

describe("permissões", () => {
  it("quem só lê não faz nada", () => {
    for (const acao of Object.keys(ACOES_DA_RESPOSTA))
      expect(avaliarAcao(acao, contexto({ podeEditar: false }))).toEqual({
        permitida: false,
        motivo: "Sem permissão para responder.",
      });
  });

  it("sem resposta salva, nenhuma transição", () => {
    expect(avaliarAcao("aprovar", contexto({ resposta: null })).motivo).toBe(
      "Salve o rascunho primeiro.",
    );
  });

  it("revisão opcional: a autora aprova o próprio rascunho que nunca foi à revisão", () => {
    expect(avaliarAcao("aprovar", contexto()).permitida).toBe(true);
  });

  it("em revisão, nem a autora nem quem enviou aprova; outra pessoa, sim", () => {
    const emRevisao = resposta({
      estado: "em_revisao",
      passou_revisao: true,
      envio_revisao_por_id: "u-envio",
    });
    expect(
      avaliarAcao("aprovar", contexto({ resposta: emRevisao })).permitida,
    ).toBe(false);
    expect(
      avaliarAcao("aprovar", contexto({ resposta: emRevisao, eu: "u-envio" }))
        .permitida,
    ).toBe(false);
    expect(
      avaliarAcao("aprovar", contexto({ resposta: emRevisao, eu: REVISOR })),
    ).toEqual({ permitida: true, motivo: "" });
  });

  it("depois de passar pela revisão, a autora não aprova direto do rascunho", () => {
    const corrigida = resposta({ estado: "rascunho", passou_revisao: true });
    expect(
      avaliarAcao("aprovar", contexto({ resposta: corrigida })).motivo,
    ).toMatch(/não pode aprová-la/);
    expect(
      avaliarAcao("aprovar", contexto({ resposta: corrigida, eu: REVISOR }))
        .permitida,
    ).toBe(true);
  });

  it("a autora não devolve a própria resposta", () => {
    const emRevisao = resposta({ estado: "em_revisao", passou_revisao: true });
    expect(
      avaliarAcao("devolver", contexto({ resposta: emRevisao })).permitida,
    ).toBe(false);
    expect(
      avaliarAcao("devolver", contexto({ resposta: emRevisao, eu: REVISOR }))
        .permitida,
    ).toBe(true);
  });

  it("aprovar exige o recurso decidido e com a situação do modelo", () => {
    expect(
      avaliarAcao("aprovar", contexto({ situacao: "EM_ANALISE_JURIDICA" }))
        .motivo,
    ).toMatch(/decisão do recurso/);
    expect(
      avaliarAcao("aprovar", contexto({ situacao: "REGISTRADO" })).motivo,
    ).toMatch(/decisão do recurso/);
    expect(
      avaliarAcao("aprovar", contexto({ situacao: "INDEFERIDO" })).motivo,
    ).toMatch(/situação do recurso não é a do modelo/);
  });

  it("com alteração não salva, não envia nem aprova", () => {
    expect(
      avaliarAcao("enviar_revisao", contexto({ alterada: true })).motivo,
    ).toBe("Salve as alterações antes.");
  });

  it("as ações oferecidas são as do estado atual", () => {
    expect(acoesDaResposta(contexto()).map((a) => a.acao)).toEqual([
      "enviar_revisao",
      "aprovar",
    ]);
    expect(
      acoesDaResposta(
        contexto({ resposta: resposta({ estado: "aprovada" }), eu: REVISOR }),
      ).map((a) => a.acao),
    ).toEqual(["reabrir", "marcar_enviada"]);
    expect(
      acoesDaResposta(contexto({ resposta: resposta({ estado: "enviada" }) })),
    ).toEqual([]);
  });

  it("aprovar, devolver e marcar enviada são do parecer jurídico: sem ele, nem aparecem", () => {
    const semParecer = (extra) => contexto({ podeDecidir: false, ...extra });
    for (const acao of ["aprovar", "devolver", "marcar_enviada"]) {
      expect(ACOES_DA_RESPOSTA[acao].juridico).toBe(true);
      expect(avaliarAcao(acao, semParecer()).motivo).toBe(
        "É do parecer jurídico.",
      );
    }
    expect(acoesDaResposta(semParecer()).map((a) => a.acao)).toEqual([
      "enviar_revisao",
    ]);
    expect(
      acoesDaResposta(
        semParecer({ resposta: resposta({ estado: "aprovada" }) }),
      ).map((a) => a.acao),
    ).toEqual(["reabrir"]);
    expect(
      acoesDaResposta(
        semParecer({ resposta: resposta({ estado: "em_revisao" }) }),
      ),
    ).toEqual([]);
  });

  it("devolver e reabrir pedem comentário; aprovar, não", () => {
    expect(erroDoComentario("devolver", "  ")).toBe(
      "Diga o que precisa ser ajustado.",
    );
    expect(erroDoComentario("reabrir", "ok")).toBe("Informe o motivo.");
    expect(erroDoComentario("aprovar", "")).toBe("");
    expect(erroDoComentario("aprovar", "x".repeat(2001))).toMatch(/2.000/);
  });
});
