import { act, createElement as h, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BarraDaLista,
  CabecalhoDaTela,
  CardDaLista,
  FaixaDeSituacao,
  porcentagemDe,
  Selo,
  TabelaDaLista,
  textoDaDistribuicao,
} from "../../src/ui/index.ts";
import { clicar, digitar } from "../componentes/interacoes.ts";

/*
  O layout das telas da seleção (Triagem, Avaliação documental e
  Classificação): o cabeçalho da tela, a faixa de situação com os
  números-filtro e a barra da distribuição, a barra da lista com "Filtros" e
  a tabela com 50 e mais 50 ao chegar no fim da rolagem ("Mostrando N de M").
*/

let raiz = null;
async function montar(elemento) {
  document.body.innerHTML = `<div id="raiz"></div>`;
  await act(async () => {
    raiz = createRoot(document.getElementById("raiz"));
    raiz.render(elemento);
  });
}
afterEach(async () => {
  await act(async () => raiz?.unmount());
  raiz = null;
  document.body.innerHTML = "";
});
const $ = (seletor) => document.querySelector(seletor);
const $$ = (seletor) => [...document.querySelectorAll(seletor)];

describe("CabecalhoDaTela", () => {
  it("trilha, título, edital, seções e o Atualizar só com o ícone", async () => {
    const aoAtualizar = vi.fn();
    await montar(
      h(CabecalhoDaTela, {
        trilha: "Projetos / Seleção",
        titulo: "Avaliação documental",
        edital: h("select", { "aria-label": "Edital" }),
        secoes: h("nav", { "data-secoes": "" }),
        aoAtualizar,
      }),
    );
    expect($(".ui-cabecalho-trilha").textContent).toBe("Projetos / Seleção");
    expect($(".ui-cabecalho-titulo").textContent).toBe("Avaliação documental");
    expect($(".ui-cabecalho-edital select")).not.toBeNull();
    const atualizar = $("[data-acao='atualizar']");
    expect(atualizar.getAttribute("aria-label")).toBe("Atualizar");
    expect(atualizar.textContent).toBe("");
    await clicar(atualizar);
    expect(aoAtualizar).toHaveBeenCalledTimes(1);
  });
});

describe("FaixaDeSituacao", () => {
  function Faixa() {
    const [ativo, setAtivo] = useState("lote");
    const itens = [
      ["lote", "No lote", 1512, "neutro"],
      ["pendentes", "Pendentes", 214, "alerta"],
      ["concluidas", "Concluídas", 1248, "sucesso"],
    ].map(([chave, rotulo, valor, tom]) => ({
      chave,
      rotulo,
      valor,
      tom,
      contexto: chave === "lote" ? "" : porcentagemDe(valor, 1512),
      ativo: ativo === chave,
      aoClicar: () => setAtivo(chave),
    }));
    return h(
      FaixaDeSituacao,
      {
        rotulo: "Situação do lote",
        itens,
        rotuloDaDistribuicao: "Distribuição do lote",
        totalDaDistribuicao: 1512,
        distribuicao: [
          { chave: "c", rotulo: "Concluídas", valor: 1248, tom: "sucesso" },
          { chave: "p", rotulo: "Pendentes", valor: 214, tom: "alerta" },
        ],
      },
      h("a", { href: "#" }, "fora do lote"),
    );
  }

  it("cada número é um filtro (aria-pressed), com o contexto embaixo; a barra diz a proporção", async () => {
    await montar(h(Faixa));
    const item = (chave) => $(`.ui-faixa-item[data-valor='${chave}']`);
    expect(item("lote").getAttribute("aria-pressed")).toBe("true");
    expect(item("lote").querySelector(".ui-faixa-numero").textContent).toBe(
      "1.512",
    );
    expect(
      item("pendentes").querySelector(".ui-faixa-contexto").textContent,
    ).toBe("14,1%");
    await clicar(item("pendentes"));
    expect(item("pendentes").getAttribute("aria-pressed")).toBe("true");
    expect(item("lote").getAttribute("aria-pressed")).toBe("false");
    const barra = $(".ui-faixa-barra");
    expect(barra.getAttribute("role")).toBe("img");
    expect(barra.getAttribute("aria-label")).toBe(
      "Distribuição do lote: 82,5% concluídas, 14,1% pendentes",
    );
    // O que as partes não cobrem (3,3% do lote) fica vazio na barra.
    expect(
      $$(".ui-faixa-barra > span").map((s) => s.style.width.slice(0, 5)),
    ).toEqual(["82.53", "14.15"]);
    expect($(".ui-faixa-linha a").textContent).toBe("fora do lote");
  });

  it("número carregando vira skeleton; distribuição sem dados", async () => {
    await montar(
      h(FaixaDeSituacao, {
        rotulo: "Situação",
        itens: [{ chave: "x", rotulo: "Inscritos", valor: null, tom: "info" }],
      }),
    );
    expect($(".ui-faixa-numero.ui-esqueleto")).not.toBeNull();
    // Sem aoClicar, o número não é botão.
    expect($("button.ui-faixa-item")).toBeNull();
    expect($(".ui-faixa-linha")).toBeNull();
    expect(textoDaDistribuicao([], "Distribuição")).toBe(
      "Distribuição: sem dados",
    );
  });
});

describe("Selo com ponto", () => {
  it("a bolinha na cor do texto antes do rótulo", async () => {
    await montar(h(Selo, { tom: "pendente", ponto: true }, "Pendente"));
    expect($(".ui-selo .ui-ponto")).not.toBeNull();
    expect($(".ui-selo").textContent).toBe("Pendente");
  });
});

describe("BarraDaLista", () => {
  function Barra() {
    const [busca, setBusca] = useState("");
    const [vaga, setVaga] = useState("");
    const [modalidade, setModalidade] = useState("");
    return h(
      BarraDaLista,
      {
        rotulo: "Encontrar a pessoa",
        busca: {
          valor: busca,
          aoMudar: setBusca,
          placeholder: "Buscar por código ou nome",
          rotulo: "Buscar pessoa",
        },
        quantos: [busca, vaga, modalidade].filter(Boolean).length,
        aoLimpar: () => {
          setBusca("");
          setVaga("");
          setModalidade("");
        },
        quantosSecundarios: modalidade ? 1 : 0,
        secundarios: h(
          "select",
          {
            "aria-label": "Modalidade",
            value: modalidade,
            onChange: (ev) => setModalidade(ev.target.value),
          },
          h("option", { value: "" }, "Todas as modalidades"),
          h("option", { value: "PCD" }, "PcD"),
        ),
        acoes: h("button", { type: "button", "data-principal": "" }, "Pegar"),
      },
      h(
        "select",
        {
          "aria-label": "Vaga",
          value: vaga,
          onChange: (ev) => setVaga(ev.target.value),
        },
        h("option", { value: "" }, "Todas as vagas"),
        h("option", { value: "10" }, "10"),
      ),
    );
  }

  it("busca, filtros em linha, Filtros com os secundários e Limpar só com filtro", async () => {
    await montar(h(Barra));
    expect($(".ui-barra-da-lista").getAttribute("role")).toBe("search");
    expect($("[data-acao='limpar-filtros']")).toBeNull();
    expect($("select[aria-label='Modalidade']")).toBeNull();
    await clicar($("[data-acao='mais-filtros']"));
    const modalidade = $("select[aria-label='Modalidade']");
    expect(modalidade).not.toBeNull();
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      ).set;
      set.call(modalidade, "PCD");
      modalidade.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect($("[data-acao='mais-filtros'] .ui-contagem").textContent).toBe("1");
    await digitar($(".ui-barra-busca input"), "Maria");
    await clicar($("[data-acao='limpar-filtros']"));
    expect($(".ui-barra-busca input").value).toBe("");
    expect($("[data-acao='limpar-filtros']")).toBeNull();
    expect($(".ui-barra-da-lista-acoes [data-principal]")).not.toBeNull();
  });
});

describe("TabelaDaLista (rolagem de 50 em 50)", () => {
  const pessoas = (n) =>
    Array.from({ length: n }, (_, i) => ({ id: String(i + 1) }));
  const colunas = [{ rotulo: "Código", chave: "codigo" }];
  const linha = (p) =>
    h("tr", { key: p.id, "data-id": p.id }, h("td", null, p.id));
  function Lista({ itens, recorte = "a", ...resto }) {
    return h(
      CardDaLista,
      { rotulo: "Pessoas" },
      h(TabelaDaLista, {
        rotulo: "Pessoas",
        colunas,
        itens,
        linha,
        carregado: true,
        vazio: "Nenhuma pessoa com esses filtros.",
        chaveDoRecorte: recorte,
        ...resto,
      }),
    );
  }
  const ids = () => $$("tbody tr[data-id]").map((tr) => tr.dataset.id);

  /*
    IntersectionObserver falso: guarda os observadores vivos; `chegarAoFim`
    avisa que o fim da caixa entrou à vista (o que a rolagem faria).
  */
  let observadores = [];
  const original = globalThis.IntersectionObserver;
  beforeEach(() => {
    observadores = [];
    globalThis.IntersectionObserver = class {
      constructor(aviso, opcoes) {
        this.aviso = aviso;
        this.opcoes = opcoes;
        this.alvos = [];
        observadores.push(this);
      }
      observe(alvo) {
        this.alvos.push(alvo);
      }
      disconnect() {
        observadores = observadores.filter((o) => o !== this);
      }
    };
  });
  afterEach(() => {
    globalThis.IntersectionObserver = original;
  });
  const chegarAoFim = () =>
    act(async () => {
      for (const o of [...observadores])
        o.aviso(o.alvos.map((target) => ({ target, isIntersecting: true })));
    });

  it("mostra 50 e mais 50 ao chegar no fim da rolagem; o recorte novo volta ao começo", async () => {
    const itens = pessoas(120);
    await montar(h(Lista, { itens }));
    expect($(".ui-lista-contagem").textContent).toBe("Mostrando 50 de 120");
    expect(ids()).toHaveLength(50);
    // Sem botões de página: só a rolagem.
    expect($("[data-acao='pagina-proxima']")).toBeNull();
    // O sentinela fica no fim da caixa que rola, que é a raiz do observador.
    const [observador] = observadores;
    expect(observador.alvos[0].className).toBe("ui-lista-fim");
    expect(observador.opcoes.root).toBe($(".ui-lista-rolagem"));
    await chegarAoFim();
    expect($(".ui-lista-contagem").textContent).toBe("Mostrando 100 de 120");
    expect(ids()).toHaveLength(100);
    expect(ids()[0]).toBe("1");
    await chegarAoFim();
    expect($(".ui-lista-contagem").textContent).toBe("Mostrando 120 de 120");
    // Tudo à vista: ninguém mais observa o fim.
    expect(observadores).toHaveLength(0);
    // Releitura (a mesma lista, o mesmo recorte): continua com o que estava à vista.
    await act(async () => raiz.render(h(Lista, { itens: [...itens] })));
    expect($(".ui-lista-contagem").textContent).toBe("Mostrando 120 de 120");
    // Filtro novo: volta às primeiras 50.
    await act(async () =>
      raiz.render(h(Lista, { itens: pessoas(60), recorte: "b" })),
    );
    expect($(".ui-lista-contagem").textContent).toBe("Mostrando 50 de 60");
    // A tabela rola de lado no celular (não vira cartões).
    expect($("table").dataset.mobileTable).toBe("scroll");
  });

  it("vazia: Ninguém por aqui e a linha da tela; Exportar desligado", async () => {
    const aoExportar = vi.fn();
    await montar(h(Lista, { itens: [], aoExportar }));
    expect($(".ui-lista-vazia").textContent).toBe(
      "Ninguém por aquiNenhuma pessoa com esses filtros.",
    );
    expect($(".ui-lista-contagem").textContent).toBe("Mostrando 0 de 0");
    expect($("[data-acao='exportar-csv']").disabled).toBe(true);
  });

  it("no banco: chegar ao fim pede a página seguinte, uma vez enquanto ela vem", async () => {
    const carregarMais = vi.fn();
    const servidor = {
      total: 75,
      temMais: true,
      carregando: false,
      carregarMais,
    };
    await montar(h(Lista, { itens: pessoas(50), servidor }));
    expect($(".ui-lista-contagem").textContent).toBe("Mostrando 50 de 75");
    await chegarAoFim();
    expect(carregarMais).toHaveBeenCalledTimes(1);
    // Carregando: o rodapé diz e o fim não pede de novo.
    await act(async () =>
      raiz.render(
        h(Lista, {
          itens: pessoas(50),
          servidor: { ...servidor, carregando: true },
        }),
      ),
    );
    expect($(".ui-lista-contagem").textContent).toBe(
      "Carregando mais… 50 de 75",
    );
    await chegarAoFim();
    expect(carregarMais).toHaveBeenCalledTimes(1);
    await act(async () =>
      raiz.render(
        h(Lista, {
          itens: pessoas(75),
          servidor: { ...servidor, temMais: false },
        }),
      ),
    );
    expect($(".ui-lista-contagem").textContent).toBe("Mostrando 75 de 75");
    expect(ids()).toHaveLength(75);
  });

  it("agrupada: o cabeçalho de cada grupo; o recolhido só pelo cabeçalho", async () => {
    const itens = [
      ...pessoas(3).map((p) => ({ ...p, grupo: "A" })),
      ...pessoas(2).map((p) => ({ id: `b${p.id}`, grupo: "B" })),
    ];
    const grupo = {
      chave: (p) => p.grupo,
      cabecalho: (chave, quantos) => `${chave} (${quantos})`,
      recolhidos: new Set(["A"]),
      aoAlternar: vi.fn(),
    };
    await montar(h(Lista, { itens, grupo }));
    expect($$("tr.ui-tabela-grupo").map((tr) => tr.textContent)).toEqual([
      "A (3)",
      "B (2)",
    ]);
    expect(ids()).toEqual(["b1", "b2"]);
    expect($(".ui-lista-contagem").textContent).toBe("Mostrando 2 de 2");
    await clicar($("tr.ui-tabela-grupo button"));
    expect(grupo.aoAlternar).toHaveBeenCalledWith("A");
  });
});
