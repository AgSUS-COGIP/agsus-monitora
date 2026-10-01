import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.js";
import {
  abrirPaginaDoPainel,
  quadroDoPainel,
  recarregarPaginaDoPainel,
} from "../../src/modules/pagina-do-painel.js";

/*
  As páginas com painel do app (Análises curriculares e Recursos) são donas do
  quadro: endereço fixo do app, com a área atual, criado na primeira abertura e
  refeito quando a área muda. Um módulo só, com o painel dito pela seção.
*/
const ORIGEM = "https://previa.vercel.app";
let pagina;

const quadros = () => pagina.querySelectorAll(".quadro-do-painel");
const endereco = () => new URL(quadroDoPainel(pagina).src);

function criarPagina(painel) {
  document.body.innerHTML = `<section id="page-${painel}" class="page pagina-do-painel" data-painel="${painel}"></section>`;
  return document.getElementById(`page-${painel}`);
}

beforeEach(() => {
  sessionStorage.clear();
  redefinirDadosDoMonitoramento();
  pagina = criarPagina("analises");
});

afterEach(() => {
  // Página fora do ar: o ouvinte da área dela não recria mais nada.
  pagina.classList.remove("active");
  document.body.innerHTML = "";
});

describe("a página Análises curriculares", () => {
  it("nasce vazia e cria o quadro só na primeira abertura", () => {
    expect(quadros()).toHaveLength(0);
    pagina.classList.add("active");
    definirAreaAtual("sede");

    abrirPaginaDoPainel(pagina, { origem: ORIGEM });

    expect(quadros()).toHaveLength(1);
    expect(endereco().origin).toBe(ORIGEM);
    expect(endereco().pathname).toBe("/analises.html");
    expect(endereco().searchParams.get("area")).toBe("sede");
    expect(quadroDoPainel(pagina).title).toBe("Análises curriculares");
  });

  it("cobre o quadro com o skeleton do painel até ele avisar que carregou", () => {
    pagina.classList.add("active");
    const quadro = abrirPaginaDoPainel(pagina, { origem: ORIGEM });
    expect(quadro.classList.contains("external-panel")).toBe(true);
    expect(quadro.querySelector(".esqueleto-do-painel")).not.toBeNull();
  });

  it("aberta de novo na mesma área, não recarrega", () => {
    pagina.classList.add("active");
    const primeiro = abrirPaginaDoPainel(pagina, { origem: ORIGEM });
    const segundo = abrirPaginaDoPainel(pagina, { origem: ORIGEM });
    expect(segundo).toBe(primeiro);
    expect(quadros()).toHaveLength(1);
  });

  it("trocar de área com a página aberta refaz o quadro com a área nova", () => {
    pagina.classList.add("active");
    definirAreaAtual("saude-indigena");
    const antigo = abrirPaginaDoPainel(pagina, { origem: ORIGEM });

    definirAreaAtual("projetos");

    expect(antigo.isConnected).toBe(false);
    expect(quadros()).toHaveLength(1);
    expect(endereco().searchParams.get("area")).toBe("projetos");
  });

  it("com a página fechada, a área nova só vale na próxima abertura", () => {
    pagina.classList.add("active");
    definirAreaAtual("saude-indigena");
    const antigo = abrirPaginaDoPainel(pagina, { origem: ORIGEM });
    pagina.classList.remove("active");

    definirAreaAtual("sede");
    expect(antigo.isConnected).toBe(true);

    pagina.classList.add("active");
    abrirPaginaDoPainel(pagina, { origem: ORIGEM });
    expect(antigo.isConnected).toBe(false);
    expect(endereco().searchParams.get("area")).toBe("sede");
  });

  it("recarregar (Tentar novamente) recomeça o quadro", () => {
    pagina.classList.add("active");
    const antigo = abrirPaginaDoPainel(pagina, { origem: ORIGEM });
    const novo = recarregarPaginaDoPainel(pagina, { origem: ORIGEM });
    expect(novo).not.toBe(antigo);
    expect(quadros()).toHaveLength(1);
  });
});

describe("a página Seleção", () => {
  beforeEach(() => {
    pagina = criarPagina("selecao");
  });

  it("abre o painel de seleção com a área, pelo mesmo módulo", () => {
    pagina.classList.add("active");
    definirAreaAtual("projetos");

    const quadro = abrirPaginaDoPainel(pagina, { origem: ORIGEM });

    expect(quadro.classList.contains("external-panel")).toBe(true);
    expect(endereco().pathname).toBe("/selecao.html");
    expect(endereco().searchParams.get("area")).toBe("projetos");
    expect(quadroDoPainel(pagina).title).toBe("Seleção");
  });
});

it.each(["recursos", "entrevistas"])(
  "%s não é mais quadro: é um módulo de src/modulos/",
  (view) => {
    pagina = criarPagina(view);
    pagina.classList.add("active");
    expect(abrirPaginaDoPainel(pagina, { origem: ORIGEM })).toBeNull();
    expect(quadros()).toHaveLength(0);
  },
);

it("seção sem painel conhecido não ganha quadro", () => {
  pagina = criarPagina("desconhecido");
  pagina.classList.add("active");
  expect(abrirPaginaDoPainel(pagina, { origem: ORIGEM })).toBeNull();
  expect(quadros()).toHaveLength(0);
});
