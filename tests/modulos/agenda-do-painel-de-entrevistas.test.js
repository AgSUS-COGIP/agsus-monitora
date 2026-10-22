import { describe, expect, it, vi } from "vitest";
import { criarEstadoDasEntrevistas } from "../../src/modulos/entrevistas/estado.ts";

const armazenamento = () => ({
  ler: () => null,
  guardar: () => {},
  apagarTudo: () => {},
});
const item = (nome) => ({
  analise_id: "a1",
  nome,
  vaga: "V1",
  data: "2026-10-09",
  inicio: "09:00",
});

describe("respostas antigas da agenda do painel", () => {
  it.each(["troca de área", "reinício da sessão"])(
    "descarta a agenda após %s, inclusive com o mesmo edital",
    async (motivo) => {
      const respostas = [];
      const supabase = {
        rpc: vi.fn((nome) =>
          nome === "obter_agenda_entrevista"
            ? new Promise((resolver) => respostas.push(resolver))
            : Promise.resolve({ data: { entrevistas: [] }, error: null }),
        ),
      };
      const estado = criarEstadoDasEntrevistas({
        supabase,
        armazenamento: armazenamento(),
        avaliarMarcos: null,
      });
      await estado.carregar("saude-indigena");
      const antiga = estado.carregarAgenda("edital-1");
      if (motivo === "troca de área") await estado.carregar("sede");
      else estado.reiniciar();
      const atual = estado.carregarAgenda("edital-1");
      respostas[0]({
        data: { itens: [item("Usuário anterior")] },
        error: null,
      });
      expect(await antiga).toBeNull();
      expect(estado.obter().agenda.itens).toBeNull();
      respostas[1]({ data: { itens: [item("Agenda atual")] }, error: null });
      const itens = await atual;
      expect(itens[0].nome).toBe("Agenda atual");
      expect(await estado.carregarAgenda("edital-1")).toBe(itens);
      expect(
        supabase.rpc.mock.calls.filter(
          ([nome]) => nome === "obter_agenda_entrevista",
        ),
      ).toHaveLength(2);
    },
  );

  it("ignora também o erro de um pedido da sessão anterior", async () => {
    let responder;
    const supabase = {
      rpc: vi.fn(
        () =>
          new Promise((resolver) => {
            responder = resolver;
          }),
      ),
    };
    const estado = criarEstadoDasEntrevistas({
      supabase,
      armazenamento: armazenamento(),
      avaliarMarcos: null,
    });
    const antiga = estado.carregarAgenda("edital-1");
    estado.reiniciar();
    responder({ data: null, error: { code: "42501" } });
    expect(await antiga).toBeNull();
    expect(estado.obter().agenda).toEqual({
      editalId: "",
      itens: null,
      erro: "",
    });
  });
});
