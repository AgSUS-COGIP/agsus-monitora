import { describe, expect, it } from "vitest";
import {
  LIMITE_DO_LOTE,
  SEM_STATUS_EM_LOTE,
  editaisDoLote,
  motivosDeFora,
  planejarStatusEmLote,
  resumoDoStatusAtual,
  statusDoLotePara,
  textoDaConfirmacaoDoLote,
} from "../src/lib/status-em-lote-dos-aprovados.ts";

/*
  Status em lote na aba Aprovados (11/11/2026): quem muda e quem fica de fora
  segue as regras da mudança de um candidato (e o banco as repete).
*/

const editor = { perfil: "usuario", permissoes: { aprovados: "editor" } };
const admin = { perfil: "usuario", permissoes: { aprovados: "admin" } };
const leitor = { perfil: "usuario", permissoes: { aprovados: "leitor" } };

const c = (id: string, status: string | null, extra = {}) => ({
  candidato_id: id,
  nome: `Pessoa ${id}`,
  edital: "93/2026",
  status,
  lista_ativa: true,
  ...extra,
});

describe("status que cada perfil escolhe no lote", () => {
  it("editor: Convocado, Desistente e Documentação Rejeitada; admin também sem status", () => {
    expect(statusDoLotePara(editor)).toEqual([
      "Convocado",
      "Desistente",
      "Documentação Rejeitada",
    ]);
    expect(statusDoLotePara(admin)).toContain(SEM_STATUS_EM_LOTE);
    expect(statusDoLotePara(leitor)).toEqual([]);
  });

  it("Contratado e Migração nunca entram (pedem a matrícula de cada um)", () => {
    expect(statusDoLotePara(admin)).not.toContain("Contratado");
    expect(statusDoLotePara(admin)).not.toContain("Migração");
  });
});

describe("planejarStatusEmLote", () => {
  const selecao = [
    c("1", null),
    c("2", "Convocado"),
    c("3", "Desistente"),
    c("4", "Contratado"),
    c("5", null, { lista_ativa: false }),
  ];

  it("editor: muda quem está sem status ou Convocado; o resto fica de fora com o motivo", () => {
    const plano = planejarStatusEmLote(editor, selecao, "Desistente");
    expect(plano.alterar.map((x) => x.candidato_id)).toEqual(["1", "2"]);
    expect(plano.fora).toEqual([
      {
        candidato_id: "3",
        nome: "Pessoa 3",
        motivo: "Já está como Desistente",
      },
      {
        candidato_id: "4",
        nome: "Pessoa 4",
        motivo: "Status já definido (Contratado): só o admin muda",
      },
      {
        candidato_id: "5",
        nome: "Pessoa 5",
        motivo: "Lista inativa ou substituída",
      },
    ]);
  });

  it("admin muda status já definido; só não muda quem já está no status ou em lista inativa", () => {
    const plano = planejarStatusEmLote(admin, selecao, "Desistente");
    expect(plano.alterar.map((x) => x.candidato_id)).toEqual(["1", "2", "4"]);
    expect(plano.fora.map((f) => f.candidato_id)).toEqual(["3", "5"]);
  });

  it("sem status: só o admin, e quem já está sem status fica de fora", () => {
    expect(
      planejarStatusEmLote(editor, selecao, SEM_STATUS_EM_LOTE).alterar,
    ).toEqual([]);
    const plano = planejarStatusEmLote(admin, selecao, SEM_STATUS_EM_LOTE);
    expect(plano.alterar.map((x) => x.candidato_id)).toEqual(["2", "3", "4"]);
    expect(plano.fora[0]?.motivo).toBe("Já está sem status");
  });

  it("leitor: ninguém muda", () => {
    const plano = planejarStatusEmLote(leitor, selecao, "Convocado");
    expect(plano.alterar).toEqual([]);
    expect(plano.fora.every((f) => f.motivo.startsWith("Sem permissão"))).toBe(
      true,
    );
  });
});

describe("textos da confirmação", () => {
  it("resume o status de hoje e os motivos de fora", () => {
    expect(
      resumoDoStatusAtual([c("1", null), c("2", null), c("3", "Convocado")]),
    ).toBe("2 sem status · 1 Convocado");
    expect(
      motivosDeFora([
        { candidato_id: "1", nome: "", motivo: "Já está como Desistente" },
        { candidato_id: "2", nome: "", motivo: "Já está como Desistente" },
      ]),
    ).toEqual(["Já está como Desistente (2)"]);
  });

  it("o botão diz quantos e para onde; os editais da seleção", () => {
    expect(textoDaConfirmacaoDoLote(37, "Desistente")).toBe(
      "Mudar 37 candidatos para Desistente",
    );
    expect(textoDaConfirmacaoDoLote(1, "Convocado")).toBe(
      "Mudar 1 candidato para Convocado",
    );
    expect(textoDaConfirmacaoDoLote(1200, "")).toBe(
      "Deixar 1.200 candidatos sem status",
    );
    expect(editaisDoLote([c("1", null)])).toBe("Edital 93/2026");
    expect(
      editaisDoLote([c("1", null), c("2", null, { edital: "94/2026" })]),
    ).toBe("2 editais");
  });

  it("o teto é o do banco", () => {
    expect(LIMITE_DO_LOTE).toBe(500);
  });
});
