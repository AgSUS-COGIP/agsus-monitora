import { describe, expect, it } from "vitest";
import { criarEstadoDaAvaliacao } from "../../src/modulos/avaliacao-documental/estado.ts";
import type { ClienteDaAvaliacao } from "../../src/modulos/avaliacao-documental/tipos-do-estado.ts";

/*
  Voltar aos cartões (a opção vazia do seletor, ou o Voltar do navegador para
  o endereço sem edital) com um edital ainda abrindo: a leitura dele é
  descartada, e o "carregando" não pode ficar preso — o "Atualizar" do topo
  ficava desativado até abrir outro edital.
*/

type Resposta = { data: unknown; error: unknown };

function bancoControlado() {
  const pendentes: { nome: string; responder: (r: Resposta) => void }[] = [];
  const cliente: ClienteDaAvaliacao = {
    rpc: (nome) =>
      new Promise<Resposta>((responder) => pendentes.push({ nome, responder })),
  };
  return { cliente, pendentes };
}

const esperar = () => new Promise((r) => setTimeout(r, 0));

describe("Avaliação documental: voltar aos cartões com o edital abrindo", () => {
  it("solta o carregando e não deixa dados do edital que saiu", async () => {
    const { cliente, pendentes } = bancoControlado();
    const estado = criarEstadoDaAvaliacao({
      supabase: cliente,
      toast: () => {},
      copias: null,
    });

    const abrindo = estado.escolherEdital("edital-a");
    await esperar();
    expect(estado.obter().carregandoEdital).toBe(true);

    await estado.escolherEdital("");
    expect(estado.obter().editalId).toBe("");
    expect(estado.obter().carregandoEdital).toBe(false);

    // A leitura do edital que saiu chega depois: não muda nada.
    for (const p of pendentes.splice(0))
      p.responder({ data: { regra: null, versao: "1" }, error: null });
    await abrindo;
    await esperar();
    expect(estado.obter()).toMatchObject({
      editalId: "",
      carregandoEdital: false,
      dados: null,
      erroDoEdital: "",
    });
  });
});
