import { describe, expect, it, vi } from "vitest";
import {
  candidatosDoPacote,
  candidatosDoEstado,
  listasDoEstado,
  anexosDoEstado,
  resultadoDaMarcacao,
} from "../../src/lib/dados-do-estado-de-aprovados.ts";
import { criarEstadoDaListaDeAprovados } from "../../src/modulos/aprovados/estado.ts";
import { compactarPorArea } from "../componentes/candidatos-compactos-falsos.js";
import { aberturaPelasChamadasDeAntes } from "../componentes/abertura-dos-aprovados.js";

const candidato = (id) => ({
  candidato_id: id,
  nome: id,
  edital_id: "10",
  cargo: "Enfermeiro",
  edital: "03/2025",
  unidade: "Manaus",
  lista_ativa: true,
  status: null,
});
function preparar(confirmacao) {
  let pacote = compactarPorArea([candidato("ana"), candidato("bia")]);
  const toast = vi.fn();
  const responder = async (nome) => {
    if (nome === "listar_candidatos_aprovados_compacto")
      return { data: pacote, error: null };
    if (nome === "listar_listas_aprovados")
      return {
        data: [{ lista_id: "l1", edital_id: "10", ativo: true }],
        error: null,
      };
    if (nome === "marcar_candidatos_convocados")
      return { data: confirmacao, error: null };
    return { data: [], error: null };
  };
  // A abertura da página numa chamada, montada com as respostas acima.
  const rpc = vi.fn((nome, argumentos) =>
    nome === "abrir_lista_aprovados"
      ? aberturaPelasChamadasDeAntes(responder, argumentos)
      : responder(nome, argumentos),
  );
  const estado = criarEstadoDaListaDeAprovados({
    supabase: { rpc },
    getProfile: () => ({ perfil: "admin" }),
    areaAtual: () => "saude-indigena",
    hoje: () => "2026-10-15",
    toast,
  });
  return {
    estado,
    rpc,
    toast,
    trocarPacote: (novo) => {
      pacote = novo;
    },
  };
}

describe("Dados do estado de Aprovados", () => {
  it("preserva ordem, campos adicionais e posições nulas do pacote", () => {
    const pacote = compactarPorArea([candidato("bia"), candidato("ana")]);
    expect(candidatosDoPacote(pacote)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          candidato_id: "bia",
          sub_judice: null,
          codigo_vaga: null,
        }),
      ]),
    );
    expect(candidatosDoPacote(pacote).map((c) => c.candidato_id)).toEqual([
      "bia",
      "ana",
    ]);
    const pessoa = { ...candidato("ana"), campo_adicional: { valor: 42 } };
    expect(candidatosDoEstado([pessoa])[0]).toBe(pessoa);
  });
  it.each([
    null,
    {},
    { linhas: [] },
    { colunas: [], colunas_da_lista: [], linhas: [null], listas: [] },
  ])("recusa pacote incompleto: %j", (pacote) => {
    expect(() => candidatosDoPacote(pacote)).toThrow(/inválido/);
  });
  it("não transforma uma coleção parcialmente inválida em menos candidatos", () => {
    expect(() =>
      candidatosDoEstado([candidato("ana"), { candidato_id: "bia" }]),
    ).toThrow(/candidatos/);
    expect(() =>
      listasDoEstado([{ edital_id: "10" }, { edital_id: {} }]),
    ).toThrow(/listas/);
    expect(() =>
      anexosDoEstado([{ anexo_id: "a", candidato_id: "ana" }, {}]),
    ).toThrow(/anexos/);
  });
  it("preserva os candidatos anteriores se uma recarga vier malformada", async () => {
    const { estado, trocarPacote, toast } = preparar(null);
    expect(await estado.carregar()).toBe(true);
    const anteriores = estado.obter().candidatos;
    trocarPacote({ linhas: [] });
    expect(await estado.carregar()).toBe(false);
    expect(estado.obter().candidatos).toBe(anteriores);
    expect(toast).toHaveBeenLastCalledWith(
      expect.stringContaining("inválido"),
      "error",
    );
  });
  it.each([
    null,
    { marcados: 2 },
    { marcados: 0, ignorados: [] },
    { marcados: "2", ignorados: [] },
    {
      marcados: 1,
      ignorados: [{ candidato_id: "fora", motivo: "Não existe" }],
    },
    {
      marcados: 0,
      ignorados: [
        { candidato_id: "ana", motivo: "X" },
        { candidato_id: "ana", motivo: "X" },
      ],
    },
  ])(
    "não muda status nem anuncia sucesso com confirmação inválida: %j",
    async (confirmacao) => {
      const { estado, rpc, toast } = preparar(confirmacao);
      await estado.carregar();
      const anteriores = estado.obter().candidatos;
      expect(
        await estado.marcarConvocados(["ana", "bia"], "2026-10-15"),
      ).toBeNull();
      expect(estado.obter().candidatos).toBe(anteriores);
      expect(estado.obter().convocacoes.size).toBe(0);
      expect(estado.obter().acao).toBeNull();
      expect(toast).toHaveBeenLastCalledWith(
        expect.stringContaining("Não foi possível confirmar"),
        "error",
      );
      expect(
        rpc.mock.calls.filter(([nome]) => nome === "abrir_lista_aprovados"),
      ).toHaveLength(1);
    },
  );
  it("confirma um resultado parcial e atualiza somente quem o banco marcou", async () => {
    const confirmacao = {
      marcados: 1,
      ignorados: [
        { candidato_id: "bia", nome: "Bia", motivo: "Já está como Contratado" },
      ],
    };
    const { estado, toast } = preparar(confirmacao);
    await estado.carregar();
    // Observa a atualização confirmada antes da releitura em segundo plano.
    const observar = vi.fn();
    const cancelar = estado.assinar(() => {
      if (estado.obter().candidatos[0]?.status === "Convocado")
        observar(estado.obter());
    });
    expect(await estado.marcarConvocados(["ana", "bia"], "2026-10-15")).toEqual(
      confirmacao,
    );
    expect(observar).toHaveBeenCalledWith(
      expect.objectContaining({
        candidatos: [
          expect.objectContaining({ candidato_id: "ana", status: "Convocado" }),
          expect.objectContaining({ candidato_id: "bia", status: null }),
        ],
      }),
    );
    expect(toast).toHaveBeenLastCalledWith(
      expect.stringContaining("Bia (Já está como Contratado)"),
      "warn",
    );
    cancelar();
  });
  it("confere IDs distintos, como a RPC faz, sem rejeitar pedidos repetidos", () => {
    expect(
      resultadoDaMarcacao({ marcados: 1, ignorados: [] }, ["ana", "ana"]),
    ).toEqual({ marcados: 1, ignorados: [] });
  });
});
