// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  chaveDoDia,
  editaisComEtapaNaSemana,
  primeiroNome,
  resumoDoDia,
  saudacao,
} from "../src/lib/boas-vindas.js";
import { initBoasVindas } from "../src/modules/boas-vindas.js";
import {
  definirAreaAtual,
  publicarLinhasDoMonitoramento,
  redefinirDadosDoMonitoramento,
} from "../src/componentes/dados-do-monitoramento.js";

describe("textos das boas-vindas", () => {
  it("saúda pela hora", () => {
    expect(saudacao(8)).toBe("Bom dia");
    expect(saudacao(12)).toBe("Boa tarde");
    expect(saudacao(19)).toBe("Boa noite");
  });

  it("usa o primeiro nome, sem caixa alta", () => {
    expect(primeiroNome("YASSURY SOUSA")).toBe("Yassury");
    expect(primeiroNome("  maria de fátima ")).toBe("Maria");
    expect(primeiroNome("ÂNGELA")).toBe("Ângela");
    expect(primeiroNome("")).toBe("");
  });

  it("conta editais com etapa de hoje até daqui a 7 dias", () => {
    const hoje = new Date(2026, 8, 28);
    const linhas = [
      { cronograma_proxima_data: "2026-09-28" },
      { cronograma_proxima_data: "2026-10-05" },
      { cronograma_proxima_data: "2026-10-06" },
      { cronograma_proxima_data: "2026-09-27" },
      { cronograma_proxima_data: null },
    ];
    expect(editaisComEtapaNaSemana(linhas, hoje)).toBe(2);
    expect(chaveDoDia(hoje)).toBe("2026-09-28");
  });

  it("resume o dia com informação real", () => {
    expect(resumoDoDia(0)).toBe("Nenhum edital com etapa nos próximos 7 dias.");
    expect(resumoDoDia(1)).toBe("1 edital tem etapa nos próximos 7 dias.");
    expect(resumoDoDia(1234)).toBe(
      "1.234 editais têm etapa nos próximos 7 dias.",
    );
  });
});

describe("componente de boas-vindas", () => {
  const agora = () => new Date(2026, 8, 28, 9, 0);
  let raiz;
  let parar;

  beforeEach(() => {
    localStorage.clear();
    redefinirDadosDoMonitoramento();
    document.body.innerHTML = '<div id="boasVindas" hidden></div>';
    raiz = document.getElementById("boasVindas");
  });
  afterEach(() => parar?.());

  const iniciar = (perfil = { nome: "YASSURY SOUSA" }) => {
    parar = initBoasVindas({ raiz, obterPerfil: () => perfil, agora });
  };

  it("fica escondido até os editais chegarem", () => {
    iniciar();
    expect(raiz.hidden).toBe(true);
  });

  it("saúda e conta só os editais da Saúde Indígena na semana", () => {
    iniciar();
    publicarLinhasDoMonitoramento([
      { CO_AREA: "saude-indigena", cronograma_proxima_data: "2026-09-30" },
      { CO_AREA: "sede", cronograma_proxima_data: "2026-09-30" },
    ]);
    expect(raiz.hidden).toBe(false);
    expect(raiz.textContent).toContain("Bom dia, Yassury");
    expect(raiz.textContent).toContain("1 edital tem etapa");
    expect(
      raiz.querySelector('[data-boas-vindas="cronograma"]'),
    ).not.toBeNull();
  });

  it("na SEDE conta os editais da SEDE e abre o Cronograma dela", () => {
    document.body.insertAdjacentHTML(
      "beforeend",
      '<button class="menu-item" data-view="calendario" data-area="sede"></button>',
    );
    let abriu = false;
    document
      .querySelector('.menu-item[data-area="sede"]')
      .addEventListener("click", () => (abriu = true));
    iniciar();
    publicarLinhasDoMonitoramento([
      { CO_AREA: "saude-indigena", cronograma_proxima_data: "2026-09-30" },
      { CO_AREA: "sede", cronograma_proxima_data: "2026-09-29" },
      { CO_AREA: "sede", cronograma_proxima_data: "2026-10-01" },
    ]);
    definirAreaAtual("sede");
    expect(raiz.textContent).toContain("2 editais");
    raiz.querySelector('[data-boas-vindas="cronograma"]').click();
    expect(abriu).toBe(true);
  });

  it("fechar esconde e continua fechado no mesmo dia", () => {
    iniciar();
    publicarLinhasDoMonitoramento([]);
    expect(raiz.querySelector('[data-boas-vindas="cronograma"]')).toBeNull();
    raiz.querySelector('[data-boas-vindas="fechar"]').click();
    expect(raiz.hidden).toBe(true);
    parar();
    iniciar();
    publicarLinhasDoMonitoramento([]);
    expect(raiz.hidden).toBe(true);
  });

  it("escapa o nome", () => {
    iniciar({ nome: '<img src=x onerror="alert(1)">' });
    publicarLinhasDoMonitoramento([]);
    expect(raiz.querySelector("img")).toBeNull();
  });
});
