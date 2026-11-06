import { describe, expect, it } from "vitest";
import { montarListaDeConvocacao } from "../../src/lib/lista-convocacao-rules.ts";
import { modeloEmBranco } from "../../src/lib/modelo-de-convocacao.ts";
import type { CandidatoDaConvocacao } from "../../src/lib/tipos-da-lista-de-convocacao.ts";
import { definido } from "../definido.ts";
const calcular = (candidatos: CandidatoDaConvocacao[]) =>
  montarListaDeConvocacao(candidatos, () => ({
    modelo: modeloEmBranco(),
    quadro: { ampla: 1 },
  }));
const candidato = (
  id: string,
  edital: string,
  codigo: string,
  nota = 90,
): CandidatoDaConvocacao => ({
  candidato_id: id,
  edital_id: edital,
  edital,
  cargo: "Enfermeiro",
  codigo_vaga: codigo,
  nome: id,
  nota,
  modalidade: "ampla",
  lista_ativa: true,
});
describe("vaga do sub judice no próprio edital", () => {
  it("as vagas de outro edital não tornam ambígua a vaga do cargo", () => {
    const grupos = calcular([
      candidato("a", "e1", "v1"),
      candidato("b", "e2", "v2"),
      candidato("sj", "e1", "", 100),
    ]);
    expect(grupos).toHaveLength(2);
    const e1 = definido(grupos.find((g) => g.editalId === "e1"));
    expect(e1.codigoVaga).toBe("v1");
    expect(e1.linhas.map((l) => l.candidato.candidato_id)).toEqual(["sj", "a"]);
    expect(definido(e1.linhas[0]).imediata).toBe(true);
    expect(
      definido(grupos.find((g) => g.editalId === "e2")).candidatos.map(
        (c) => c.candidato_id,
      ),
    ).toEqual(["b"]);
  });
  it("uma vaga existente só em outro edital não é atribuída ao sub judice", () => {
    const grupos = calcular([
      candidato("a", "e2", "v2"),
      candidato("sj", "e1", ""),
    ]);
    expect(definido(grupos.find((g) => g.editalId === "e1")).codigoVaga).toBe(
      "",
    );
    expect(definido(grupos.find((g) => g.editalId === "e2")).codigoVaga).toBe(
      "v2",
    );
  });
  it("duas vagas do próprio cargo no edital continuam sem escolha automática", () => {
    const grupos = calcular([
      candidato("a", "e1", "v1"),
      candidato("b", "e1", "v2"),
      candidato("sj", "e1", ""),
    ]);
    expect(grupos).toHaveLength(3);
    expect(
      definido(grupos.find((g) => g.codigoVaga === "")).candidatos.map(
        (c) => c.candidato_id,
      ),
    ).toEqual(["sj"]);
  });
});
