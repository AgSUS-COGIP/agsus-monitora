import { describe, expect, it, vi } from "vitest";
import { criarEstadoDaConducao } from "../../src/modulos/entrevistas/estado-da-conducao.ts";
import type {
  ClienteDaConducao,
  CopiasDaConducao,
} from "../../src/modulos/entrevistas/tipos-do-estado-da-conducao.ts";

/*
  Fila do dia e ficha sem rede: a cada leitura com rede, a lista de editais e o
  edital aberto (convocados, agenda, previsão) ficam no aparelho; sem rede, a
  condução abre dessa cópia, só para consulta, com a data dela (`copiaDe`).
  Outro erro (banco, permissão) continua erro: a cópia é só para a rede caída.
*/

const SEM_REDE = { message: "TypeError: Failed to fetch", code: "" };
const GUARDADO_EM = Date.UTC(2026, 10, 17, 13, 14);

const EDITAIS = {
  admin_global: false,
  editais: [{ id: "E1", edital: "101/2026", unidade: "DSEI Xingu" }],
};
const EDITAL = {
  edital: { id: "E1", edital: "101/2026" },
  pode_editar: true,
  lista_convocacao: { lista: { id: "lista-E1" } },
  convocados: [{ id: "c1", candidato: "Ana Teste", banca: 1 }],
};
const PREVISAO = { situacao: "PREVISTA", motivo: null, pode_alterar: false };
const AGENDA = { itens: [] };

function banco(respostas: Record<string, unknown> | null, erro = SEM_REDE) {
  const cliente: ClienteDaConducao = {
    rpc: vi.fn(async (nome: string) =>
      respostas && nome in respostas
        ? { data: respostas[nome], error: null }
        : { data: null, error: respostas ? { code: "PGRST202" } : erro },
    ),
  };
  return cliente;
}

function copiasEmMemoria() {
  const dados = new Map<string, unknown>();
  const copias: CopiasDaConducao = {
    ler: async (chave) =>
      dados.has(chave)
        ? {
            payload: structuredClone(dados.get(chave)),
            guardadoEm: GUARDADO_EM,
          }
        : null,
    guardar: async (chave, payload) => {
      dados.set(chave, structuredClone(payload));
    },
  };
  return { dados, copias };
}

const COM_REDE = {
  listar_editais_entrevista: EDITAIS,
  obter_entrevistas_do_edital: EDITAL,
  obter_previsao_entrevista_edital: PREVISAO,
  obter_agenda_entrevista: AGENDA,
};

async function guardarComRede(copias: CopiasDaConducao) {
  const conducao = criarEstadoDaConducao({
    supabase: banco(COM_REDE),
    copias,
    toast: () => {},
  });
  await conducao.carregarEditais("saude-indigena");
  expect(await conducao.abrirEdital("E1")).toBe(true);
  expect(conducao.obter().copiaDe).toBeNull();
  await new Promise((r) => setTimeout(r, 0));
}

describe("condução de entrevistas sem rede", () => {
  it("com rede guarda a lista e o edital; sem rede abre deles, com a data", async () => {
    const { dados, copias } = copiasEmMemoria();
    await guardarComRede(copias);
    expect([...dados.keys()].sort()).toEqual([
      "editais:saude-indigena:janela",
      "edital:E1",
    ]);

    const toast = vi.fn();
    const semRede = criarEstadoDaConducao({
      supabase: banco(null),
      copias,
      toast,
    });
    const lista = await semRede.carregarEditais("saude-indigena");
    expect(lista.map((e) => e.id)).toEqual(["E1"]);
    expect(semRede.obter().editais.erro).toBe("");
    expect(semRede.obter().copiaDe).toBe(GUARDADO_EM);

    expect(await semRede.abrirEdital("E1")).toBe(true);
    const e = semRede.obter();
    expect(e.erroDoEdital).toBe("");
    expect(e.carregandoEdital).toBe(false);
    expect(e.copiaDe).toBe(GUARDADO_EM);
    expect(e.edital?.convocados?.[0]?.candidato).toBe("Ana Teste");
    expect(e.previsao?.situacao).toBe("PREVISTA");
    // A ficha abre do edital guardado.
    semRede.abrirFicha("c1");
    expect(semRede.obter().fichaAberta).toBe("c1");
    expect(toast).not.toHaveBeenCalled();
  });

  it("sem rede e sem cópia, o erro de sempre", async () => {
    const semRede = criarEstadoDaConducao({
      supabase: banco(null),
      copias: copiasEmMemoria().copias,
      toast: () => {},
    });
    expect(await semRede.carregarEditais("saude-indigena")).toEqual([]);
    expect(semRede.obter().editais.erro).toMatch(
      /^Não foi possível carregar os editais/,
    );
    expect(await semRede.abrirEdital("E1")).toBe(false);
    expect(semRede.obter().erroDoEdital).not.toBe("");
    expect(semRede.obter().copiaDe).toBeNull();
  });

  it("erro do banco (não de rede) não abre a cópia", async () => {
    const { copias } = copiasEmMemoria();
    await guardarComRede(copias);
    const comErro = criarEstadoDaConducao({
      supabase: banco(null, { message: "falhou", code: "P0001" }),
      copias,
      toast: () => {},
    });
    expect(await comErro.abrirEdital("E1")).toBe(false);
    expect(comErro.obter().edital).toBeNull();
    expect(comErro.obter().copiaDe).toBeNull();
  });

  it("Levar para o campo: relê com rede, guarda só a banca de quem avalia e confirma", async () => {
    const { dados, copias } = copiasEmMemoria();
    const EDITAL_COM_BANCAS = {
      ...EDITAL,
      meu_perfil: "perfil-ana",
      avaliadores: [
        { id: "a1", perfil: "perfil-ana", banca: 2, ativo: true },
        { id: "a2", perfil: "outro", banca: 1, ativo: true },
      ],
      convocados: [
        { id: "c1", candidato: "Pessoa da banca 1", banca: 1 },
        { id: "c2", candidato: "Pessoa da banca 2", banca: 2 },
      ],
    };
    const toast = vi.fn();
    const conducao = criarEstadoDaConducao({
      supabase: banco({
        ...COM_REDE,
        obter_entrevistas_do_edital: EDITAL_COM_BANCAS,
        obter_agenda_entrevista: {
          itens: [
            { analise_id: "x1", banca: 1 },
            { analise_id: "x2", banca: 2 },
          ],
        },
      }),
      copias,
      toast,
    });
    await conducao.abrirEdital("E1");
    // Na tela, o edital inteiro; no aparelho, só a banca 2.
    expect(conducao.obter().edital?.convocados).toHaveLength(2);
    expect(await conducao.levarParaOCampo()).toEqual({ ok: true });
    const guardado = dados.get("edital:E1") as {
      resposta: { convocados: { id: string }[] };
      agenda: { itens: { analise_id: string }[] };
      calculo: unknown;
    };
    expect(guardado.resposta.convocados.map((c) => c.id)).toEqual(["c2"]);
    expect(guardado.agenda.itens.map((i) => i.analise_id)).toEqual(["x2"]);
    expect(guardado.calculo).toBeNull();
    expect(toast).toHaveBeenLastCalledWith(
      expect.stringMatching(
        /^Pronto para o campo: a fila e as fichas da sua banca ficam neste aparelho até \d{2}\/\d{2}, \d{2}:\d{2}\.$/,
      ),
      "ok",
    );
  });

  it("Levar para o campo sem rede avisa que precisa de internet", async () => {
    const { copias } = copiasEmMemoria();
    await guardarComRede(copias);
    const toast = vi.fn();
    const semRede = criarEstadoDaConducao({
      supabase: banco(null),
      copias,
      toast,
    });
    await semRede.abrirEdital("E1");
    expect(semRede.obter().copiaDe).toBe(GUARDADO_EM);
    expect(await semRede.levarParaOCampo()).toEqual({
      erro: "Sem conexão: abra o edital com internet para levar ao campo.",
    });
    expect(toast).toHaveBeenCalledWith(
      "Sem conexão: abra o edital com internet para levar ao campo.",
      "warn",
    );
  });
});
