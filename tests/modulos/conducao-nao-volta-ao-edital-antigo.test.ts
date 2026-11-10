import { describe, expect, it } from "vitest";
import { CONFLITO_DE_VERSAO } from "../../src/lib/conflito-de-versao.ts";
import { criarEstadoDaConducao } from "../../src/modulos/entrevistas/estado-da-conducao.ts";
import type { ClienteDaConducao } from "../../src/modulos/entrevistas/tipos-do-estado-da-conducao.ts";

/*
  Gravar no edital A e trocar para o B enquanto a gravação corre (o seletor
  não trava durante a ação): quando a resposta de A chega, a tela fica no B.
  Antes, "Classificar etapa" e o conflito de versão do "Convocar" chamavam
  abrirEdital(A) e a tela pulava de volta para o edital anterior.
*/

type Resposta = { data: unknown; error: unknown };
type Pendente = {
  nome: string;
  argumentos: Record<string, unknown> | undefined;
  responder: (r: Resposta) => void;
};

function bancoControlado() {
  const pendentes: Pendente[] = [];
  const cliente: ClienteDaConducao = {
    rpc: (nome, argumentos) =>
      new Promise<Resposta>((responder) =>
        pendentes.push({ nome, argumentos, responder }),
      ),
  };
  return { cliente, pendentes };
}

const esperar = () => new Promise((r) => setTimeout(r, 0));

const edital = (id: string) => ({
  edital: { id },
  pode_editar: true,
  lista_convocacao: { lista: { id: `lista-${id}` } },
  convocados: [],
});
const previsao = {
  situacao: "NAO_INFORMADA",
  motivo: null,
  pode_alterar: true,
};

/* Responde as leituras de abrir um edital (as escritas ficam na fila). */
async function responderLeituras(pendentes: Pendente[]) {
  for (let volta = 0; volta < 5; volta += 1) {
    await esperar();
    for (const p of [...pendentes]) {
      const id = String(p.argumentos?.p_edital ?? "");
      const resposta =
        p.nome === "obter_entrevistas_do_edital"
          ? edital(id)
          : p.nome === "obter_previsao_entrevista_edital"
            ? previsao
            : p.nome === "obter_agenda_entrevista"
              ? null
              : undefined;
      if (resposta === undefined) continue;
      pendentes.splice(pendentes.indexOf(p), 1);
      p.responder({ data: resposta, error: null });
    }
  }
}

async function abrirNoEditalA() {
  const { cliente, pendentes } = bancoControlado();
  const conducao = criarEstadoDaConducao({
    supabase: cliente,
    toast: () => {},
    tempoLimiteMs: 10_000,
  });
  const abrindo = conducao.abrirEdital("A");
  await responderLeituras(pendentes);
  await abrindo;
  expect(conducao.obter().editalId).toBe("A");
  return { conducao, pendentes };
}

async function trocarParaB(
  conducao: ReturnType<typeof criarEstadoDaConducao>,
  pendentes: Pendente[],
) {
  const abrindo = conducao.abrirEdital("B");
  await responderLeituras(pendentes);
  await abrindo;
  expect(conducao.obter().editalId).toBe("B");
}

function gravacao(pendentes: Pendente[], nome: string) {
  const p = pendentes.find((x) => x.nome === nome);
  if (!p) throw new Error(`sem a chamada ${nome}`);
  pendentes.splice(pendentes.indexOf(p), 1);
  return p;
}

describe("Condução: gravar no edital A e trocar para o B no meio", () => {
  it("Classificar etapa: a resposta de A não reabre A", async () => {
    const { conducao, pendentes } = await abrirNoEditalA();
    const salvando = conducao.definirPrevisao("PREVISTA", "conferido");
    await esperar();
    const escrita = gravacao(pendentes, "definir_previsao_entrevista_edital");
    expect(escrita.argumentos?.p_edital).toBe("A");

    await trocarParaB(conducao, pendentes);
    escrita.responder({ data: null, error: null });
    await responderLeituras(pendentes);
    await salvando;

    expect(conducao.obter().editalId).toBe("B");
    expect(conducao.obter().edital?.edital?.id).toBe("B");
    expect(
      pendentes.filter((p) => p.argumentos?.p_edital === "A"),
    ).toHaveLength(0);
  });

  it("Convocar com conflito de versão: relê só se A ainda está na tela", async () => {
    const { conducao, pendentes } = await abrirNoEditalA();
    const convocando = conducao.convocar(["analise-1"]);
    await esperar();
    const escrita = gravacao(pendentes, "convocar_para_entrevista");

    await trocarParaB(conducao, pendentes);
    escrita.responder({
      data: null,
      error: { code: CONFLITO_DE_VERSAO, message: "lista mudou" },
    });
    await responderLeituras(pendentes);
    await convocando;

    expect(conducao.obter().editalId).toBe("B");
    expect(conducao.obter().edital?.edital?.id).toBe("B");
  });

  it("Classificar etapa sem trocar de edital continua relendo A", async () => {
    const { conducao, pendentes } = await abrirNoEditalA();
    const salvando = conducao.definirPrevisao("PREVISTA", "conferido");
    await esperar();
    gravacao(pendentes, "definir_previsao_entrevista_edital").responder({
      data: null,
      error: null,
    });
    await responderLeituras(pendentes);
    expect(await salvando).toEqual({ ok: true });
    expect(conducao.obter().editalId).toBe("A");
  });
});
