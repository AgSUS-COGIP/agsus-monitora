import { describe, expect, it } from "vitest";
import { criarEstadoDaClassificacao } from "../../src/modulos/classificacao/estado.js";

/*
  Gravar e trocar de edital antes da resposta: a regra (com a versão) do
  edital A não pode cair nos dados do edital B — o próximo "Salvar regra" em B
  mandaria a versão de A.
*/

function bancoFalso() {
  const pendentes = [];
  const supabase = {
    rpc(nome, argumentos) {
      if (nome === "obter_classificacao_do_edital") {
        const id = argumentos.p_edital;
        return Promise.resolve({
          data: { edital: { id }, regra: { versao: id === "A" ? 7 : 2 } },
          error: null,
        });
      }
      if (nome.startsWith("listar_")) {
        return Promise.resolve({ data: [], error: null });
      }
      return new Promise((resolve) => pendentes.push({ nome, resolve }));
    },
  };
  return { supabase, pendentes };
}

const esperar = () => new Promise((r) => setTimeout(r, 0));

describe("classificação: resposta de gravação depois de trocar de edital", () => {
  it("a regra salva no edital A não entra nos dados do edital B", async () => {
    const { supabase, pendentes } = bancoFalso();
    const estado = criarEstadoDaClassificacao({
      supabase,
      toast: () => {},
    });
    await estado.escolherEdital("A");
    const salvando = estado.salvarRegra({});
    await esperar();
    await estado.escolherEdital("B");
    expect(estado.obter().dados.regra.versao).toBe(2);

    pendentes[0].resolve({ data: { versao: 8 }, error: null });
    await salvando;
    expect(estado.obter().editalId).toBe("B");
    expect(estado.obter().dados.regra.versao).toBe(2);
  });

  it("sem troca, a regra salva atualiza os dados", async () => {
    const { supabase, pendentes } = bancoFalso();
    const estado = criarEstadoDaClassificacao({
      supabase,
      toast: () => {},
    });
    await estado.escolherEdital("A");
    const salvando = estado.salvarRegra({});
    await esperar();
    pendentes[0].resolve({ data: { versao: 8 }, error: null });
    await salvando;
    expect(estado.obter().dados.regra.versao).toBe(8);
  });
});
