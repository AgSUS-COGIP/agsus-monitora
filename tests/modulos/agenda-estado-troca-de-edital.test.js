import { describe, expect, it } from "vitest";
import { criarEstadoDaAgenda } from "../../src/modulos/classificacao/estado-da-agenda.js";

/*
  O estado da agenda das entrevistas (src/modulos/classificacao/estado-da-agenda.js):
  gravar e trocar de edital antes da resposta não pode pôr a regra ou a agenda
  do edital A nos dados do edital B; e falha no "Atualizar" do mesmo edital
  mantém a agenda que já estava na tela.
*/

function bancoFalso() {
  const pendentes = [];
  let falharObter = false;
  const supabase = {
    rpc(nome, argumentos) {
      if (nome === "obter_agenda_entrevista") {
        if (falharObter)
          return Promise.resolve({
            data: null,
            error: { message: "Tempo esgotado" },
          });
        const id = argumentos.p_edital;
        return Promise.resolve({
          data: {
            edital: { id },
            regra: { versao: id === "A" ? 7 : 2 },
            itens: [{ analise_id: `${id}1` }],
          },
          error: null,
        });
      }
      return new Promise((resolve) => pendentes.push({ nome, resolve }));
    },
  };
  return {
    supabase,
    pendentes,
    falhar: () => {
      falharObter = true;
    },
  };
}

const esperar = () => new Promise((r) => setTimeout(r, 0));

describe("agenda: resposta de gravação depois de trocar de edital", () => {
  it("a agenda salva no edital A não entra nos dados do edital B", async () => {
    const { supabase, pendentes } = bancoFalso();
    const agenda = criarEstadoDaAgenda({ supabase, toast: () => {} });
    await agenda.carregar("A");
    const salvando = agenda.salvarAgenda({ acao: "GERAR", itens: [] });
    await esperar();
    await agenda.carregar("B");

    pendentes[0].resolve({
      data: { edital: { id: "A" }, regra: { versao: 7 }, itens: [] },
      error: null,
    });
    await salvando;
    expect(agenda.obter().editalId).toBe("B");
    expect(agenda.obter().dados.edital.id).toBe("B");
    expect(agenda.obter().dados.itens).toEqual([{ analise_id: "B1" }]);
    expect(agenda.obter().salvando).toBe(false);
  });

  it("a regra salva no edital A não entra nos dados do edital B", async () => {
    const { supabase, pendentes } = bancoFalso();
    const agenda = criarEstadoDaAgenda({ supabase, toast: () => {} });
    await agenda.carregar("A");
    const salvando = agenda.salvarRegra({});
    await esperar();
    await agenda.carregar("B");

    pendentes[0].resolve({ data: { versao: 8 }, error: null });
    await salvando;
    expect(agenda.obter().dados.regra.versao).toBe(2);
  });

  it("sem troca, a agenda e a regra salvas atualizam os dados", async () => {
    const { supabase, pendentes } = bancoFalso();
    const agenda = criarEstadoDaAgenda({ supabase, toast: () => {} });
    await agenda.carregar("A");
    const regra = agenda.salvarRegra({});
    await esperar();
    pendentes[0].resolve({ data: { versao: 8 }, error: null });
    await regra;
    expect(agenda.obter().dados.regra.versao).toBe(8);

    const salvando = agenda.salvarAgenda({ acao: "GERAR", itens: [] });
    await esperar();
    pendentes[1].resolve({
      data: { edital: { id: "A" }, regra: { versao: 8 }, itens: [] },
      error: null,
    });
    await salvando;
    expect(agenda.obter().dados.itens).toEqual([]);
  });
});

describe("agenda: falha ao atualizar", () => {
  it("no mesmo edital, mantém a agenda na tela e mostra o erro", async () => {
    const { supabase, falhar } = bancoFalso();
    const agenda = criarEstadoDaAgenda({ supabase, toast: () => {} });
    await agenda.carregar("A");
    falhar();
    await agenda.carregar("A");
    expect(agenda.obter().erro).toBe("Tempo esgotado");
    expect(agenda.obter().dados.itens).toEqual([{ analise_id: "A1" }]);
  });

  it("em outro edital, não sobra a agenda do anterior", async () => {
    const { supabase, falhar } = bancoFalso();
    const agenda = criarEstadoDaAgenda({ supabase, toast: () => {} });
    await agenda.carregar("A");
    falhar();
    await agenda.carregar("B");
    expect(agenda.obter().erro).toBe("Tempo esgotado");
    expect(agenda.obter().dados).toBeNull();
  });
});
