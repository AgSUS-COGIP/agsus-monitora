import { describe, expect, it, vi } from "vitest";
import { criarFontesDaAya } from "../../src/modulos/aya/fontes.js";
import { responderComDados } from "../../src/lib/dados-da-aya.js";

/*
  De onde a Aya conta as análises (src/modulos/aya/fontes.js): os editais em
  situação Ativo, como no banco — o pacote "ativo" do painel e o
  "desativadas" (análises de edital ativo que saíram da planilha). Caso do
  teste real de 05/10: 110/2026 com 841 análises, 8 pendentes, todas
  desativadas; contar só o pacote "ativo" dava "0 de 833".
*/

const COLUNAS = ["id", "unidade", "edital", "candidato", "status_consolidado"];

function pacote(prefixo, quantas, status) {
  return {
    columns: COLUNAS,
    rows: Array.from({ length: quantas }, (_, i) => [
      `${prefixo}-${i}`,
      "DSEI X",
      "110/2026",
      `Pessoa ${prefixo} ${i}`,
      status(i),
    ]),
  };
}

const PACOTES = {
  ativo: pacote("a", 833, (i) => (i % 2 ? "Aprovado" : "Reprovado")),
  desativadas: pacote("d", 8, () => "Pendente"),
};

const supabaseFalso = () => ({
  rpc: vi.fn(async (nome, argumentos) => {
    if (nome !== "get_analises_dashboard_payload_v2")
      return { data: null, error: { message: "inesperada" } };
    return { data: [PACOTES[argumentos.p_scope]], error: null };
  }),
});

const ADMIN = {
  ativo: true,
  perfil: "admin",
  admin_global: true,
  permissoes: { analises: "admin" },
};

describe("fonte das análises", () => {
  it("junta os pacotes ativo e desativadas, marcando as desativadas", async () => {
    const supabase = supabaseFalso();
    const fontes = criarFontesDaAya({ supabase, janela: {} });
    const { linhas } = await fontes.buscar("analises", {
      area: "saude-indigena",
    });
    expect(linhas).toHaveLength(841);
    expect(linhas.filter((l) => l.__desativada)).toHaveLength(8);
    expect(supabase.rpc.mock.calls.map((c) => c[1].p_scope).sort()).toEqual([
      "ativo",
      "desativadas",
    ]);
  });

  it("110/2026: 8 pendentes de 841, dizendo que estão desativadas", async () => {
    const fontes = criarFontesDaAya({ supabase: supabaseFalso(), janela: {} });
    const r = await responderComDados({
      pergunta: "quantas análises pendentes tem o 110/2026?",
      contexto: { view: "dashboard", area: "saude-indigena" },
      perfil: ADMIN,
      buscar: fontes.buscar,
    });
    expect(r.answer).toBe(
      "Há 8 análises pendentes no edital 110/2026 na Saúde Indígena, de 841 no total. 8 delas saíram da planilha (desativadas) e só aparecem na tela com a situação Todos.",
    );
    expect(r.answer).not.toContain("Pessoa");
  });
});
