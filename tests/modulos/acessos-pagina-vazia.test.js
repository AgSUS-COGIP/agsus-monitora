import { describe, expect, it } from "vitest";
import { criarEstadoDosAcessos } from "../../src/modulos/acessos/estado.js";

/*
  Desativar (ou mover para Coordenações) a única pessoa da última página
  recarregava a mesma página, agora vazia: a tabela dizia "Nenhuma pessoa com
  acesso ativo." e a paginação sumia. Mover e adicionar com reativação também
  não recarregavam a aba Desativadas.
*/
function supabaseFalso({ total }) {
  const chamadas = [];
  return {
    chamadas,
    rpc: async (nome, argumentos) => {
      chamadas.push({ nome, argumentos });
      if (nome === "obter_matriz_acessos") {
        const restantes = Math.max(
          0,
          Math.min(30, total() - argumentos.p_offset),
        );
        return {
          data: {
            usuarios: Array.from({ length: restantes }, (_, i) => ({
              id: `u${argumentos.p_offset + i}`,
            })),
            total: total(),
          },
          error: null,
        };
      }
      if (nome === "listar_contas_desativadas")
        return { data: { contas: [] }, error: null };
      if (nome === "adicionar_pessoa_acesso")
        return { data: { reativada: true }, error: null };
      return { data: { nome: "Coordenação" }, error: null };
    },
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "x" } },
        error: null,
      }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
  };
}

const ofsetsDaMatriz = (supabase) =>
  supabase.chamadas
    .filter((c) => c.nome === "obter_matriz_acessos")
    .map((c) => c.argumentos.p_offset);

describe("Acessos: página que fica vazia", () => {
  it("desativar a única pessoa da última página volta para a página anterior", async () => {
    let total = 31;
    const supabase = supabaseFalso({ total: () => total });
    const estado = criarEstadoDosAcessos({ supabase, toast: () => {} });
    await estado.carregarMatriz({ offset: 30 });
    expect(estado.obter().matriz.usuarios).toHaveLength(1);

    total = 30;
    await estado.desativarUsuario({ id: "u30", nome: "Ana" }, "saiu da equipe");

    expect(estado.obter().offset).toBe(0);
    expect(estado.obter().matriz.usuarios).toHaveLength(30);
    expect(ofsetsDaMatriz(supabase)).toEqual([30, 30, 0]);
  });

  it("mover para Coordenações também volta para a última página com gente", async () => {
    let total = 61;
    const supabase = supabaseFalso({ total: () => total });
    const estado = criarEstadoDosAcessos({ supabase, toast: () => {} });
    await estado.carregarMatriz({ offset: 60 });

    total = 60;
    await estado.moverParaCoordenacoes(
      { id: "u60", nome: "Polo" },
      "SI",
      "virou coordenação",
    );

    expect(estado.obter().offset).toBe(30);
    expect(estado.obter().matriz.usuarios).toHaveLength(30);
  });

  it("mover para Coordenações recarrega a aba Desativadas já aberta", async () => {
    const supabase = supabaseFalso({ total: () => 1 });
    const estado = criarEstadoDosAcessos({ supabase, toast: () => {} });
    await estado.carregarDesativadas();
    supabase.chamadas.length = 0;

    await estado.moverParaCoordenacoes(
      { id: "u0", nome: "Polo" },
      "SI",
      "virou coordenação",
    );

    expect(supabase.chamadas.map((c) => c.nome)).toContain(
      "listar_contas_desativadas",
    );
  });

  it("adicionar quem estava desativado recarrega a aba Desativadas já aberta", async () => {
    const supabase = supabaseFalso({ total: () => 1 });
    const estado = criarEstadoDosAcessos({ supabase, toast: () => {} });
    await estado.carregarDesativadas();
    supabase.chamadas.length = 0;

    await estado.adicionarPessoa(
      { email: "ana@x", nome: "Ana", grupo: "leitura", areas: ["si"] },
      "voltou para a equipe",
    );

    expect(supabase.chamadas.map((c) => c.nome)).toContain(
      "listar_contas_desativadas",
    );
  });
});
