import { describe, expect, it } from "vitest";
import { criarEstadoDaClassificacao } from "../../src/modulos/classificacao/estado.ts";

/*
  Gravar e trocar de edital antes da resposta: a regra (com a versão) do
  edital A não pode cair nos dados do edital B — o próximo "Salvar regra" em B
  mandaria a versão de A.
*/

function bancoFalso() {
  const pendentes = [];
  const supabase = {
    rpc(nome, argumentos) {
      // A leitura por versão (_se_mudou, 20261014230000) responde o mesmo payload.
      if (nome.startsWith("obter_classificacao_do_edital")) {
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

describe("classificação: releituras", () => {
  function bancoContado() {
    const chamadas = [];
    const supabase = {
      rpc(nome, argumentos) {
        chamadas.push(nome);
        if (nome === "listar_editais_classificacao")
          return Promise.resolve({
            data: { editais: [{ id: "A" }, { id: "B" }], pode_editar: true },
            error: null,
          });
        if (nome.startsWith("obter_classificacao_do_edital"))
          return Promise.resolve({
            data: { edital: { id: argumentos.p_edital }, regra: { versao: 1 } },
            error: null,
          });
        return Promise.resolve({ data: [], error: null });
      },
    };
    const contar = (prefixo) =>
      chamadas.filter((n) => n.startsWith(prefixo)).length;
    return { supabase, contar };
  }

  it("a configuração de convocação é lida uma vez por sessão; o Atualizar relê", async () => {
    const { supabase, contar } = bancoContado();
    const estado = criarEstadoDaClassificacao({ supabase, toast: () => {} });
    await estado.carregar("projetos");
    await estado.escolherEdital("A");
    await estado.escolherEdital("B");
    expect(contar("listar_configuracao_convocacao")).toBe(1);
    expect(contar("listar_modelos_convocacao")).toBe(1);
    await estado.carregar("projetos", { releitura: true });
    await esperar();
    expect(contar("listar_configuracao_convocacao")).toBe(2);
  });

  it("Atualizar lê o edital escolhido uma vez só", async () => {
    const { supabase, contar } = bancoContado();
    const estado = criarEstadoDaClassificacao({ supabase, toast: () => {} });
    await estado.carregar("projetos");
    await estado.escolherEdital("A");
    const antes = contar("obter_classificacao_do_edital");
    await estado.carregar("projetos", { releitura: true });
    await esperar();
    await esperar();
    expect(contar("obter_classificacao_do_edital") - antes).toBe(1);
    expect(estado.obter().editalId).toBe("A");
  });
});
