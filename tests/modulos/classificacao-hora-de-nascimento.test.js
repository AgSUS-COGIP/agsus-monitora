import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clicar, digitar, esperar } from "../componentes/interacoes.js";
import { criarEstadoDaClassificacao } from "../../src/modulos/classificacao/estado.js";

/*
  A hora de nascimento da certidão na explicação do candidato (Classificação):
  o campo só aparece quando decide (empate na idade com a mesma data) ou já
  foi informado; quem só lê vê a hora; salvar chama
  salvar_hora_nascimento_candidato e o candidato nos dados recebe a hora.
*/

const { HoraDeNascimento } =
  await import("../../src/modulos/classificacao/hora-de-nascimento.tsx");

let raiz;
let montagem;
async function montar(props) {
  raiz = document.createElement("div");
  document.body.append(raiz);
  montagem = createRoot(raiz);
  await act(async () =>
    montagem.render(createElement(HoraDeNascimento, props)),
  );
  await esperar();
}
afterEach(async () => {
  await act(async () => montagem?.unmount());
  raiz?.remove();
});

describe("HoraDeNascimento", () => {
  it("não aparece quando a hora não decide e não foi informada", async () => {
    await montar({
      horaNascimento: null,
      horaDecide: false,
      podeEditar: true,
      aoSalvar: vi.fn(),
    });
    expect(raiz.textContent).toBe("");
  });

  it("no empate: campo com a dica de 23h59min59s; salvar manda HH:MM:SS", async () => {
    const aoSalvar = vi.fn(async () => true);
    await montar({
      horaNascimento: null,
      horaDecide: true,
      podeEditar: true,
      aoSalvar,
    });
    expect(raiz.textContent).toContain("Hora de nascimento (certidão)");
    expect(raiz.textContent).toContain("Sem certidão: 23h59min59s.");
    const salvar = raiz.querySelector("[data-acao='salvar-hora']");
    expect(salvar.disabled).toBe(true);
    await digitar(
      raiz.querySelector("[data-campo='hora-de-nascimento']"),
      "07:30",
    );
    expect(salvar.disabled).toBe(false);
    await clicar(salvar);
    expect(aoSalvar).toHaveBeenCalledWith("07:30:00");
  });

  it("hora já informada: tirar volta a 23h59min59s; leitor só vê", async () => {
    const aoSalvar = vi.fn(async () => true);
    await montar({
      horaNascimento: "07:30:00",
      horaDecide: false,
      podeEditar: true,
      aoSalvar,
    });
    await clicar(raiz.querySelector("[data-acao='tirar-hora']"));
    expect(aoSalvar).toHaveBeenCalledWith("");
    await act(async () => montagem.unmount());
    raiz.remove();
    await montar({
      horaNascimento: "07:30:00",
      horaDecide: true,
      podeEditar: false,
      aoSalvar,
    });
    expect(raiz.querySelector("input")).toBeNull();
    expect(raiz.textContent).toContain("07h30min00s");
  });
});

describe("estado.salvarHoraDeNascimento", () => {
  it("chama a RPC e põe a hora no candidato dos dados", async () => {
    const rpc = vi.fn(async (nome, args) => {
      if (nome === "listar_editais_classificacao")
        return {
          data: {
            editais: [{ id: "e93", edital: "93/2026" }],
            pode_editar: true,
          },
          error: null,
        };
      if (nome === "obter_classificacao_do_edital")
        return {
          data: {
            edital: { id: "e93" },
            pode_editar: true,
            candidatos: [{ analise_id: "a1" }, { analise_id: "a2" }],
          },
          error: null,
        };
      if (nome === "salvar_hora_nascimento_candidato")
        return {
          data: {
            analise_id: args.p_analise,
            hora_nascimento: args.p_hora ? "07:30:00" : null,
            mudou: true,
          },
          error: null,
        };
      return { data: [], error: null };
    });
    const toast = vi.fn();
    const estado = criarEstadoDaClassificacao({ supabase: { rpc }, toast });
    await estado.carregar("projetos");
    await estado.escolherEdital("e93");
    expect(await estado.salvarHoraDeNascimento("a2", "07:30")).toBe(true);
    expect(rpc).toHaveBeenCalledWith("salvar_hora_nascimento_candidato", {
      p_edital: "e93",
      p_analise: "a2",
      p_hora: "07:30",
    });
    expect(estado.obter().dados.candidatos).toEqual([
      { analise_id: "a1" },
      { analise_id: "a2", hora_nascimento: "07:30:00" },
    ]);
    await estado.salvarHoraDeNascimento("a2", "");
    expect(estado.obter().dados.candidatos[1].hora_nascimento).toBeNull();
    expect(toast).toHaveBeenLastCalledWith(
      "Hora de nascimento retirada: vale 23h59min59s.",
      "success",
    );
  });
});
