import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.js";
import {
  abrirPaginaDeAnalises,
  quadroDasAnalises,
  recarregarPaginaDeAnalises,
} from "../../src/modules/pagina-de-analises.js";

/*
  A página Análises curriculares é dona do quadro: endereço fixo do app, com a
  área atual, criado na primeira abertura e refeito quando a área muda.
*/
const ORIGEM = "https://previa.vercel.app";
let pagina;

const quadros = () => pagina.querySelectorAll(".quadro-das-analises");
const endereco = () => new URL(quadroDasAnalises(pagina).src);

beforeEach(() => {
  sessionStorage.clear();
  redefinirDadosDoMonitoramento();
  document.body.innerHTML =
    '<section id="page-analises" class="page pagina-das-analises"></section>';
  pagina = document.getElementById("page-analises");
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

    abrirPaginaDeAnalises(pagina, { origem: ORIGEM });

    expect(quadros()).toHaveLength(1);
    expect(endereco().origin).toBe(ORIGEM);
    expect(endereco().pathname).toBe("/analises.html");
    expect(endereco().searchParams.get("area")).toBe("sede");
    expect(quadroDasAnalises(pagina).title).toBe("Análises curriculares");
  });

  it("cobre o quadro com o skeleton do painel até ele avisar que carregou", () => {
    pagina.classList.add("active");
    const quadro = abrirPaginaDeAnalises(pagina, { origem: ORIGEM });
    expect(quadro.classList.contains("external-panel")).toBe(true);
    expect(quadro.querySelector(".esqueleto-do-painel")).not.toBeNull();
  });

  it("aberta de novo na mesma área, não recarrega", () => {
    pagina.classList.add("active");
    const primeiro = abrirPaginaDeAnalises(pagina, { origem: ORIGEM });
    const segundo = abrirPaginaDeAnalises(pagina, { origem: ORIGEM });
    expect(segundo).toBe(primeiro);
    expect(quadros()).toHaveLength(1);
  });

  it("trocar de área com a página aberta refaz o quadro com a área nova", () => {
    pagina.classList.add("active");
    definirAreaAtual("saude-indigena");
    const antigo = abrirPaginaDeAnalises(pagina, { origem: ORIGEM });

    definirAreaAtual("projetos");

    expect(antigo.isConnected).toBe(false);
    expect(quadros()).toHaveLength(1);
    expect(endereco().searchParams.get("area")).toBe("projetos");
  });

  it("com a página fechada, a área nova só vale na próxima abertura", () => {
    pagina.classList.add("active");
    definirAreaAtual("saude-indigena");
    const antigo = abrirPaginaDeAnalises(pagina, { origem: ORIGEM });
    pagina.classList.remove("active");

    definirAreaAtual("sede");
    expect(antigo.isConnected).toBe(true);

    pagina.classList.add("active");
    abrirPaginaDeAnalises(pagina, { origem: ORIGEM });
    expect(antigo.isConnected).toBe(false);
    expect(endereco().searchParams.get("area")).toBe("sede");
  });

  it("recarregar (Tentar novamente) recomeça o quadro", () => {
    pagina.classList.add("active");
    const antigo = abrirPaginaDeAnalises(pagina, { origem: ORIGEM });
    const novo = recarregarPaginaDeAnalises(pagina, { origem: ORIGEM });
    expect(novo).not.toBe(antigo);
    expect(quadros()).toHaveLength(1);
  });
});
