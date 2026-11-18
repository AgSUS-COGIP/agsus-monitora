import { describe, expect, it } from "vitest";
import { acoesDaLinhaDoAprovado } from "../../src/lib/aprovados/acoes-da-linha-dos-aprovados.ts";
import {
  cargoDaVaga,
  localidadeDoCargo,
} from "../../src/lib/aprovados/localidade-da-vaga.ts";
import { ordenarAprovados } from "../../src/lib/aprovados/ordem-dos-aprovados.ts";

/*
  Lista de aprovados, revisão de 17/11/2026: código da vaga, cargo, lotação e
  edital em colunas próprias (ordenáveis) e as ações da linha como uma
  principal com nome + "Mais ações". Dados fictícios.
*/
const EDITOR = { permissoes: { aprovados: "editor" } };
const LEITOR = { permissoes: { aprovados: "leitor" } };
const ADMIN = { perfil: "admin" };

const linha = (extra: Record<string, unknown> = {}) => ({
  candidato_id: "c1",
  nome: "Pessoa Fictícia",
  edital_id: "00000000-0000-4000-8000-000000000093",
  edital: "93/2026",
  unidade: "DSEI Exemplo",
  cargo: "Enfermeiro - Pacaraima/RR - 2 vagas",
  codigo_vaga: "179698",
  lista_ativa: true,
  status: "",
  ...extra,
});

describe("cargo e lotação em colunas separadas", () => {
  it("o cargo é o primeiro trecho; a lotação, o lugar", () => {
    const cargo =
      "Técnico de Enfermagem - Polo Base Exemplo - Cadastro Reserva";
    expect(cargoDaVaga(cargo)).toBe("Técnico de Enfermagem");
    expect(localidadeDoCargo(cargo)).toBe("Polo Base Exemplo");
    expect(cargoDaVaga("Analista")).toBe("Analista");
    expect(localidadeDoCargo("Analista")).toBe("");
  });

  it("vaga, lotação e edital ordenam", () => {
    const linhas = [
      linha({
        candidato_id: "a",
        codigo_vaga: "300",
        cargo: "X - Sede/DF",
        edital: "95/2026",
      }),
      linha({
        candidato_id: "b",
        codigo_vaga: "100",
        cargo: "X - Aldeia Alfa",
        edital: "93/2026",
      }),
      linha({
        candidato_id: "c",
        codigo_vaga: "200",
        cargo: "X",
        edital: "94/2026",
      }),
    ];
    const ids = (chave: "vaga" | "lotacao" | "edital") =>
      ordenarAprovados(linhas, { chave, sentido: "asc" }).map(
        (l) => l.candidato_id,
      );
    expect(ids("vaga")).toEqual(["b", "c", "a"]);
    // Sem lotação vai para o fim.
    expect(ids("lotacao")).toEqual(["b", "a", "c"]);
    expect(ids("edital")).toEqual(["b", "c", "a"]);
  });
});

describe("ações da linha: principal com nome e Mais ações", () => {
  it("quem edita: Mudar status à vista; o resto no menu", () => {
    const { principal, outras } = acoesDaLinhaDoAprovado(EDITOR, linha(), 2);
    expect(principal).toEqual({ id: "status", rotulo: "Mudar status" });
    expect(outras.map((a) => a.rotulo)).toEqual([
      "Ver detalhes",
      "Ver anexos (2)",
      "Carta de convocação",
      "Ver na Classificação",
    ]);
  });

  it("quem só lê: Abrir, e Ver na Classificação no menu", () => {
    const { principal, outras } = acoesDaLinhaDoAprovado(LEITOR, linha());
    expect(principal.rotulo).toBe("Abrir");
    expect(outras.map((a) => a.id)).toEqual(["classificacao"]);
  });

  it("status travado: aparece apagado, com o motivo", () => {
    const { principal, outras } = acoesDaLinhaDoAprovado(
      EDITOR,
      linha({ status: "Contratado" }),
    );
    expect(principal.id).toBe("candidato");
    expect(outras[0]).toEqual({
      id: "status",
      rotulo: "Mudar status (status já definido: só o admin altera)",
      desabilitado: true,
    });
  });

  it("o admin tem a decisão judicial e, no sub judice, remover", () => {
    const { outras } = acoesDaLinhaDoAprovado(
      ADMIN,
      linha({ sub_judice: true }),
    );
    expect(outras.map((a) => a.id)).toEqual(
      expect.arrayContaining(["alteracao-judicial", "remove-subjudice"]),
    );
  });
});
