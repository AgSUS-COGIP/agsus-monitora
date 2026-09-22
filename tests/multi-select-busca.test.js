import { beforeEach, describe, expect, it, vi } from "vitest";
import { ativarMultiSelectBusca } from "../src/modules/multi-select-busca.js";

function montar(html) {
  document.body.innerHTML = `<div class="form-row"><label>Edital</label>${html}</div>`;
  return document.querySelector("select");
}

const opcoesVisiveis = () =>
  [...document.querySelectorAll(".multi-select-option span")].map(
    (item) => item.textContent,
  );

const marcar = (rotulo) => {
  const opcao = [...document.querySelectorAll(".multi-select-option")].find(
    (item) => item.querySelector("span").textContent === rotulo,
  );
  const caixa = opcao.querySelector("input");
  caixa.checked = !caixa.checked;
  caixa.dispatchEvent(new Event("change", { bubbles: true }));
};

const digitar = (termo) => {
  const busca = document.querySelector(".multi-select-search");
  busca.value = termo;
  busca.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("ativarMultiSelectBusca", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("usa a opção de valor vazio como rótulo de 'sem filtro'", () => {
    montar(
      `<select id="f"><option value="">Todos os editais</option><option value="10">03/2025</option></select>`,
    );
    ativarMultiSelectBusca("f");
    expect(document.querySelector(".multi-select-label").textContent).toBe(
      "Todos os editais",
    );
    expect(opcoesVisiveis()).toEqual(["03/2025"]);
  });

  it("devolve os valores marcados e espelha-os no select nativo", () => {
    const select = montar(
      `<select id="f"><option value="">Todos</option><option value="10">03/2025</option><option value="20">04/2025</option></select>`,
    );
    const controlador = ativarMultiSelectBusca("f");

    marcar("03/2025");
    marcar("04/2025");

    expect(controlador.obterSelecionados()).toEqual(["10", "20"]);
    expect([...select.selectedOptions].map((o) => o.value)).toEqual([
      "10",
      "20",
    ]);
  });

  it("busca ignorando acento e caixa", () => {
    montar(
      `<select id="f"><option value="">Todos</option><option value="a">Migração</option><option value="b">Contratado</option></select>`,
    );
    ativarMultiSelectBusca("f");

    digitar("MIGRACAO");

    expect(opcoesVisiveis()).toEqual(["Migração"]);
  });

  it("'Selecionar visíveis' pega só o que a busca deixou na lista", () => {
    montar(
      `<select id="f"><option value="">Todos</option><option value="a">Enfermeiro</option><option value="b">Enfermeiro Indígena</option><option value="c">Médico</option></select>`,
    );
    const controlador = ativarMultiSelectBusca("f");

    digitar("enfermeiro");
    document.querySelector('[data-acao="visiveis"]').click();

    expect(controlador.obterSelecionados()).toEqual(["a", "b"]);
  });

  it("avisa a tela a cada mudança de seleção", () => {
    const onChange = vi.fn();
    montar(
      `<select id="f"><option value="">Todos</option><option value="10">03/2025</option></select>`,
    );
    ativarMultiSelectBusca("f", { onChange });

    marcar("03/2025");
    expect(onChange).toHaveBeenLastCalledWith(["10"]);

    document.querySelector('[data-acao="limpar"]').click();
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  /*
    O caso que mais dói na Lista de Aprovados: escolher um edital encolhe a
    lista de cargos. Um cargo que deixou de existir não pode continuar a
    filtrar — estaria a esconder linhas sem aparecer em lado nenhum.
  */
  it("descarta escolhas que saíram da lista ao repovoar as opções", () => {
    montar(`<select id="f"><option value="">Todos</option></select>`);
    const controlador = ativarMultiSelectBusca("f");

    controlador.definirOpcoes(["Enfermeiro", "Médico"]);
    controlador.definirSelecionados(["Enfermeiro", "Médico"]);
    expect(controlador.obterSelecionados()).toEqual(["Enfermeiro", "Médico"]);

    controlador.definirOpcoes(["Enfermeiro"]);
    expect(controlador.obterSelecionados()).toEqual(["Enfermeiro"]);
  });

  it("repovoar não avisa a tela, para não realimentar quem já está a desenhar", () => {
    const onChange = vi.fn();
    montar(`<select id="f"><option value="">Todos</option></select>`);
    const controlador = ativarMultiSelectBusca("f", { onChange });

    controlador.definirOpcoes(["Enfermeiro"]);
    controlador.definirSelecionados(["Enfermeiro"]);
    controlador.definirOpcoes(["Médico"]);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("resume a contagem quando há muitas escolhas", () => {
    montar(
      `<select id="f"><option value="">Todos</option><option value="a">A</option><option value="b">B</option><option value="c">C</option></select>`,
    );
    ativarMultiSelectBusca("f");

    marcar("A");
    marcar("B");
    expect(document.querySelector(".multi-select-label").textContent).toBe(
      "A, B",
    );

    marcar("C");
    expect(document.querySelector(".multi-select-label").textContent).toBe(
      "3 selecionados",
    );
    expect(document.querySelector(".multi-select-count").textContent).toBe("3");
  });

  it("não ativa duas vezes o mesmo select", () => {
    montar(`<select id="f"><option value="">Todos</option></select>`);
    expect(ativarMultiSelectBusca("f")).not.toBeNull();
    expect(ativarMultiSelectBusca("f")).toBeNull();
    expect(document.querySelectorAll(".multi-select")).toHaveLength(1);
  });

  it("escapa HTML vindo do rótulo da opção", () => {
    montar(`<select id="f"><option value="">Todos</option></select>`);
    const controlador = ativarMultiSelectBusca("f");

    controlador.definirOpcoes([{ value: "x", label: "<img src=x onerror=1>" }]);

    expect(document.querySelector(".multi-select-options img")).toBeNull();
    expect(opcoesVisiveis()).toEqual(["<img src=x onerror=1>"]);
  });
});
