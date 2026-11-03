import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { montarCalendarioEditais } from "../../src/modulos/cronograma/calendario-editais.tsx";
import { clicar, digitar, escolher, esperar, teclar } from "./interacoes.js";
import {
  definirAreaAtual,
  publicarLinhasDoMonitoramento,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";

/*
  A tela só mostra os editais da área atual (a padrão é a Saúde Indígena); os
  editais das fixtures precisam estar nas linhas do monitoramento. Registrado
  antes dos outros ganchos, o afterEach roda depois de desmontar.
*/
beforeEach(() =>
  publicarLinhasDoMonitoramento(
    [1, 2, 3].map((id) => ({ id, CO_AREA: "saude-indigena" })),
  ),
);
afterEach(() => redefinirDadosDoMonitoramento());

/*
  O Calendário de Editais em React: a costura entre o carregamento (1 + N
  RPCs), a lógica de `src/lib/calendario-editais.ts` e o desenho. "Hoje" é fixo
  em 15/09/2026, uma terça-feira.
*/

const HOJE = new Date(2026, 8, 15, 10);

const RESUMO = [
  { id: 1, unidade: "DSEI Manaus", edital: "10/2026", cronograma_total: 3 },
  { id: 2, unidade: "CASAI São Paulo", edital: "11/2026", cronograma_total: 2 },
  // Sem cronograma: não custa chamada nenhuma.
  { id: 3, unidade: "DSEI Xingu", edital: "12/2026", cronograma_total: 0 },
];

const CRONOGRAMAS = {
  1: [
    // Já passou: escondida enquanto "Ocultar concluídas" está ligada.
    {
      atividade: "Entrevista com candidatos",
      data_inicio: "2026-09-10",
      data_fim: "2026-09-10",
      ordem: 1,
    },
    {
      atividade: "Prazo de recurso do resultado preliminar",
      data_inicio: "2026-09-14",
      data_fim: "2026-09-22",
      ordem: 2,
    },
    {
      atividade: "Homologação do resultado final",
      data_inicio: "2026-09-29T00:00:00",
      data_fim: "2026-09-29",
      ordem: 3,
    },
  ],
  2: [
    {
      atividade: "Inscrições",
      data_inicio: "2026-09-22",
      data_fim: "2026-09-22",
      ordem: 1,
    },
    {
      atividade: "Entrevista",
      data_inicio: "2026-10-05",
      data_fim: "2026-10-05",
      ordem: 2,
    },
  ],
};

function supabaseFalso({ erroNoResumo = null, falhaNoEdital = null } = {}) {
  return {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "token" } },
        error: null,
      }),
    },
    rpc: vi.fn(async (nome, argumentos) => {
      if (nome === "get_nucleo_cronograma_resumo")
        return erroNoResumo
          ? { data: null, error: { message: erroNoResumo } }
          : { data: RESUMO, error: null };
      /*
        Banco sem `listar_etapas_do_cronograma` (versão anterior): o teste
        simula PGRST202, e o componente cai no caminho antigo, por edital.
      */
      if (nome === "listar_etapas_do_cronograma")
        return { data: null, error: { code: "PGRST202" } };
      const id = argumentos.p_monitoramento_id;
      if (id === falhaNoEdital)
        return { data: null, error: { message: "sem permissão" } };
      return { data: { etapas: CRONOGRAMAS[id] || [] }, error: null };
    }),
  };
}

let controlador = null;

async function montar(opcoes = {}) {
  document.body.innerHTML = `<section id="page-calendario" class="page active"></section>`;
  const supabase = opcoes.supabase || supabaseFalso();
  const toast = opcoes.toast || vi.fn();
  await act(async () => {
    controlador = montarCalendarioEditais({
      secao: document.getElementById("page-calendario"),
      supabase,
      toast,
      agora: () => new Date(HOJE),
    });
  });
  await esperar(() => controlador.render());
  return { supabase, toast };
}

afterEach(async () => {
  await act(async () => controlador?.raiz?.unmount());
  controlador = null;
  document.body.innerHTML = "";
});

const $ = (id) => document.getElementById(id);
const celula = (chave) => document.querySelector(`[data-dia="${chave}"]`);
/* As faixas do mês que passam pelo dia: "Manaus – Prazo de recurso…". */
const faixas = (chave) =>
  [...document.querySelectorAll(".cal-faixa")]
    .filter(
      (faixa) => faixa.dataset.inicio <= chave && chave <= faixa.dataset.fim,
    )
    .map((faixa) => faixa.textContent);
const RECURSO = "Manaus – Prazo de recurso do resultado preliminar";
const contador = () => $("calContador").textContent;
const etapasDaLinhaDoTempo = () =>
  [...document.querySelectorAll("#calTimeline .cal-passo strong")].map(
    (item) => item.textContent,
  );

describe("carregamento", () => {
  it("Atualizar ignora o cache do minuto e mantém o mês aberto", async () => {
    const { supabase } = await montar();
    await clicar($("calMesSeguinte"));
    const mes = $("calMesTitulo").textContent;
    const chamadas = supabase.rpc.mock.calls.length;
    await clicar(document.querySelector('[data-acao="atualizar"]'));
    expect(supabase.rpc.mock.calls.length).toBeGreaterThan(chamadas);
    expect($("calMesTitulo").textContent).toBe(mes);
  });
  it("custa 2 + N chamadas quando o banco ainda não tem a RPC em lote", async () => {
    const { supabase } = await montar();
    const nomes = supabase.rpc.mock.calls.map(([nome, args]) =>
      args ? `${nome}:${args.p_monitoramento_id}` : nome,
    );
    expect(nomes).toEqual([
      "get_nucleo_cronograma_resumo",
      "listar_etapas_do_cronograma",
      "get_monitoramento_cronograma:1",
      "get_monitoramento_cronograma:2",
    ]);
  });

  it("com a RPC em lote, custa 2 chamadas — nenhuma por edital", async () => {
    const supabase = supabaseFalso();
    supabase.rpc.mockImplementation(async (nome) => {
      if (nome === "get_nucleo_cronograma_resumo")
        return { data: RESUMO, error: null };
      if (nome === "listar_etapas_do_cronograma")
        return {
          data: Object.entries(CRONOGRAMAS).flatMap(([id, etapas]) =>
            etapas.map((etapa) => ({ ...etapa, monitoramento_id: Number(id) })),
          ),
          error: null,
        };
      throw new Error(`RPC inesperada: ${nome}`);
    });
    await montar({ supabase });
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });

  it("reabrir dentro do minuto não repete as chamadas; salvar cronograma invalida", async () => {
    const { supabase } = await montar();
    await esperar(() => controlador.render());
    expect(supabase.rpc).toHaveBeenCalledTimes(4);

    await act(async () =>
      document.dispatchEvent(new CustomEvent("agsus:nucleo-cronograma-saved")),
    );
    await esperar(() => controlador.render());
    expect(supabase.rpc).toHaveBeenCalledTimes(8);
  });

  it("antes da primeira carga, a grade, as listas e o contador são skeleton", async () => {
    let entregar;
    const supabase = supabaseFalso();
    const rpc = supabase.rpc.getMockImplementation();
    supabase.rpc.mockImplementation(async (nome, argumentos) => {
      if (nome === "get_nucleo_cronograma_resumo")
        await new Promise((resolver) => (entregar = resolver));
      return rpc(nome, argumentos);
    });
    document.body.innerHTML = `<section id="page-calendario" class="page active"></section>`;
    await act(async () => {
      controlador = montarCalendarioEditais({
        secao: document.getElementById("page-calendario"),
        supabase,
        toast: vi.fn(),
        agora: () => new Date(HOJE),
      });
    });
    const pendente = controlador.render();
    await esperar();
    expect($("calGrade").getAttribute("aria-busy")).toBe("true");
    expect(
      $("calGrade").querySelectorAll(".cal-celula-esqueleto"),
    ).toHaveLength(35);
    expect($("calGrade").querySelector("[data-dia]")).toBeNull();
    expect($("calProximas").querySelectorAll(".ui-esqueleto").length).toBe(4);
    expect($("calTimeline").querySelectorAll(".ui-esqueleto").length).toBe(4);
    expect(contador()).toBe("");
    expect(
      document.querySelector("#page-calendario [data-status-da-carga]")
        .textContent,
    ).toBe("Carregando dados...");

    await esperar(async () => {
      entregar();
      await pendente;
    });
    expect($("calGrade").querySelector(".cal-celula-esqueleto")).toBeNull();
    expect(contador()).toBe("3 etapas no mês");
    expect(
      document.querySelector("#page-calendario [data-status-da-carga]")
        .textContent,
    ).toMatch(/^Atualizado em /);
  });

  it("os filtros nascem recolhidos em Refinar resultados, com os ids de sempre", async () => {
    await montar();
    const filtros = document.querySelector("#page-calendario .cal-filtros");
    expect(filtros.classList.contains("ui-filtros")).toBe(true);
    expect(filtros.querySelector(".ui-filtros-corpo").hidden).toBe(true);
    expect(filtros.querySelector("#calBusca")).not.toBeNull();
    await clicar(filtros.querySelector('[data-acao="recolher-filtros"]'));
    expect(filtros.querySelector(".ui-filtros-corpo").hidden).toBe(false);
    expect(
      document.querySelector("#page-calendario .cal-barra #calHoje"),
    ).not.toBeNull();
  });

  it("mostra o erro no lugar da grade, com Tentar novamente", async () => {
    const supabase = supabaseFalso({ erroNoResumo: "RPC fora do ar" });
    await montar({ supabase });
    const aviso = $("calGrade").querySelector('[role="alert"]');
    expect(aviso.textContent).toContain(
      "Não foi possível carregar os cronogramas: RPC fora do ar",
    );
    supabase.rpc.mockClear();
    await clicar(aviso.querySelector('[data-acao="tentar-novamente"]'));
    expect(supabase.rpc).toHaveBeenCalledWith("get_nucleo_cronograma_resumo");
  });

  it("avisa quando um edital não pôde ser lido, e mostra os outros", async () => {
    const toast = vi.fn();
    await montar({ supabase: supabaseFalso({ falhaNoEdital: 2 }), toast });
    expect(toast).toHaveBeenCalledWith(
      "1 edital(is) não puderam ser lidos. O calendário está incompleto.",
      "warn",
    );
    expect(faixas("2026-09-14")).toEqual([RECURSO]);
    expect(faixas("2026-09-22")).toEqual([RECURSO]);
  });
});

describe("grade do mês", () => {
  beforeEach(async () => {
    await montar();
  });

  it("abre no mês de hoje, com a contagem do que está desenhado", async () => {
    expect($("calMesTitulo").textContent).toBe("Setembro 2026");
    // A entrevista de 10/09 já passou e está escondida.
    expect(contador()).toBe("3 etapas no mês");
    expect(celula("2026-09-15").classList.contains("hoje")).toBe(true);
    // Seis semanas sempre: a altura não salta de um mês para o outro.
    expect(document.querySelectorAll(".cal-celula")).toHaveLength(42);
  });

  /*
    Como numa agenda: a etapa longa é uma faixa legível ("unidade – etapa")
    que atravessa os dias, um pedaço por semana — não um número em cada dia.
  */
  it("mostra a etapa longa como faixa, do dia em que começa ao dia em que termina", () => {
    expect(faixas("2026-09-14")).toEqual([RECURSO]);
    expect(faixas("2026-09-18")).toEqual([RECURSO]);
    expect(celula("2026-09-18").getAttribute("aria-label")).toBe(
      "18 de setembro: 1 etapa",
    );
    // Um pedaço por semana: o primeiro segue para a semana seguinte.
    const pedacos = [...document.querySelectorAll(".cal-faixa")].filter(
      (faixa) => faixa.textContent === RECURSO,
    );
    expect(pedacos.map((faixa) => faixa.dataset.inicio)).toEqual([
      "2026-09-14",
      "2026-09-20",
    ]);
    expect(pedacos[0].hasAttribute("data-continua-depois")).toBe(true);
    expect(pedacos[1].hasAttribute("data-continua-antes")).toBe(true);
    // O fim do recurso e as inscrições; a unidade sem o "DSEI " da frente.
    expect(faixas("2026-09-22")).toEqual([
      RECURSO,
      "CASAI São Paulo – Inscrições",
    ]);
    expect(faixas("2026-09-23")).toEqual([]);
    expect(celula("2026-09-23").classList.contains("vazio")).toBe(true);
    // A data que veio como timestamp cai no dia certo.
    expect(faixas("2026-09-29")).toEqual([
      "Manaus – Homologação do resultado final",
    ]);
    // O nome inteiro e o tipo ficam no title.
    expect(
      document.querySelector('.cal-faixa[data-inicio="2026-09-29"]').title,
    ).toContain("DSEI Manaus · Ed. 10/2026");
  });

  it("navega entre meses e volta a hoje", async () => {
    await clicar($("calMesSeguinte"));
    expect($("calMesTitulo").textContent).toBe("Outubro 2026");
    expect(contador()).toBe("1 etapa no mês");
    await clicar($("calHoje"));
    expect($("calMesTitulo").textContent).toBe("Setembro 2026");
  });
});

describe("dia cheio no mês", () => {
  it("mostra três faixas e '+N mais'; o dia abre com todas", async () => {
    const supabase = supabaseFalso();
    const nomes = [
      "Entrevista A",
      "Entrevista B",
      "Entrevista C",
      "Entrevista D",
      "Entrevista E",
    ];
    supabase.rpc.mockImplementation(async (nome, argumentos) => {
      if (nome === "get_nucleo_cronograma_resumo")
        return { data: RESUMO, error: null };
      if (nome === "listar_etapas_do_cronograma")
        return { data: null, error: { code: "PGRST202" } };
      if (argumentos.p_monitoramento_id !== 1)
        return { data: { etapas: [] }, error: null };
      return {
        data: {
          etapas: nomes.map((atividade, indice) => ({
            atividade,
            data_inicio: "2026-09-24",
            data_fim: "2026-09-24",
            ordem: indice + 1,
          })),
        },
        error: null,
      };
    });
    await montar({ supabase });
    expect(faixas("2026-09-24")).toHaveLength(3);
    const mais = document.querySelector(".cal-mais");
    expect(mais.textContent).toBe("+2 mais");
    // O "+N mais" deixa o clique passar para o dia, que é o botão.
    await clicar(celula("2026-09-24"));
    expect($("calDiaTitulo").textContent).toBe(
      "Quinta-feira, 24 de setembro — 5 etapas",
    );
    expect(document.querySelectorAll("#calDiaLista .cal-item")).toHaveLength(5);
  });
});

describe("filtros", () => {
  beforeEach(async () => {
    await montar();
  });

  it("busca cada palavra, em qualquer ordem, sem acento", async () => {
    await digitar($("calBusca"), "final homologacao");
    expect(contador()).toBe("1 etapa no mês");
    expect(faixas("2026-09-29")).toHaveLength(1);
    expect(celula("2026-09-14").classList.contains("vazio")).toBe(true);
  });

  it("filtra por tipo de etapa", async () => {
    await escolher($("calTipo"), "recursos");
    expect(contador()).toBe("1 etapa no mês");
  });

  it("'Ocultar concluídas' começa ligada; 'Limpar' mostra tudo", async () => {
    expect($("calOcultarConcluidas").checked).toBe(true);
    expect(celula("2026-09-10").classList.contains("vazio")).toBe(true);

    await digitar($("calBusca"), "entrevista");
    await clicar(
      document.querySelector('.cal-filtros [data-acao="limpar-filtros"]'),
    );
    expect($("calBusca").value).toBe("");
    expect($("calOcultarConcluidas").checked).toBe(false);
    expect(faixas("2026-09-10")).toEqual([
      "Manaus – Entrevista com candidatos",
    ]);
    expect(contador()).toBe("4 etapas no mês");
  });

  it("a linha do tempo só oferece os editais que restaram no filtro", async () => {
    const opcoes = () =>
      [...$("calTimelineEdital").options].map((opcao) => opcao.value);
    expect(opcoes()).toEqual(["", "1", "2"]);
    expect($("calTimelineEdital").value).toBe("1");

    await escolher($("calUnidade"), "CASAI São Paulo");
    expect(opcoes()).toEqual(["", "2"]);
    // O escolhido saiu do filtro: passa ao primeiro que restou.
    expect($("calTimelineEdital").value).toBe("2");
    expect(etapasDaLinhaDoTempo()).toEqual(["Inscrições", "Entrevista"]);
  });
});

describe("popup do dia", () => {
  beforeEach(async () => {
    await montar();
  });

  it("abre com as etapas ativas no dia, marcando a célula", async () => {
    await clicar(celula("2026-09-22"));
    expect($("calDiaTitulo").textContent).toBe(
      "Terça-feira, 22 de setembro — 2 etapas",
    );
    const marcas = [
      ...document.querySelectorAll("#calDiaLista .cal-item-marca"),
    ].map((marca) => marca.textContent);
    expect(marcas).toEqual(["último dia"]);
    // O tipo vai escrito, não só na cor; a unidade é texto, sem bolinha própria.
    const linhas = [
      ...document.querySelectorAll("#calDiaLista .cal-item small"),
    ];
    expect(linhas.map((linha) => linha.textContent)).toEqual([
      "Recursos · DSEI Manaus · Ed. 10/2026 · 14/09 a 22/09 (9 dias)",
      "Inscrições · CASAI São Paulo · Ed. 11/2026 · 22/09",
    ]);
    expect(document.querySelector("#calDiaLista .cal-unidade")).toBeNull();
    expect(celula("2026-09-22").getAttribute("aria-current")).toBe("true");
    expect(document.activeElement).toBe($("calDiaFechar"));
  });

  it("Esc fecha, desmarca a célula e devolve o foco a ela", async () => {
    const dia = celula("2026-09-22");
    dia.focus();
    await clicar(dia);
    await teclar(document, "Escape");
    expect($("calDiaModal")).toBeNull();
    expect(celula("2026-09-22").hasAttribute("aria-current")).toBe(false);
    expect(document.activeElement).toBe(celula("2026-09-22"));
  });

  it("clique no fundo escuro fecha; dentro do cartão, não", async () => {
    await clicar(celula("2026-09-22"));
    await clicar($("calDiaTitulo"));
    expect($("calDiaModal")).not.toBeNull();
    await clicar($("calDiaModal"));
    expect($("calDiaModal")).toBeNull();
  });

  it("escolher uma etapa foca o edital dela na linha do tempo e fecha o popup", async () => {
    await clicar(celula("2026-09-22"));
    const inscricoes = [
      ...document.querySelectorAll("#calDiaLista .cal-item"),
    ].find((item) => item.textContent.includes("Inscrições"));
    await clicar(inscricoes);
    expect($("calDiaModal")).toBeNull();
    expect($("calTimelineEdital").value).toBe("2");
    expect(etapasDaLinhaDoTempo()).toEqual(["Inscrições", "Entrevista"]);
  });

  it("trocar de mês fecha o dia aberto", async () => {
    await clicar(celula("2026-09-22"));
    await teclar(document, "Escape");
    await clicar(celula("2026-09-29"));
    // O popup cobre a página; o botão do mês só é alcançável com ele fechado.
    await clicar($("calDiaFechar"));
    await clicar($("calMesSeguinte"));
    expect(document.querySelector(".cal-celula.selecionado")).toBeNull();
  });
});

describe("próximas etapas", () => {
  /*
    Pela próxima data que importa, não pelo início bruto: o Prazo de recurso
    começou em 14/09 e ainda está em andamento (hoje é 15/09) — o que importa
    é 22/09, quando ele termina, por isso vem depois de Inscrições (que só
    começa em 22/09, mesma data, mas ainda não começou).
  */
  it("lista o que ainda não terminou, pela data que importa, e foca o edital ao clicar", async () => {
    await montar();
    const itens = [...document.querySelectorAll("#calProximas .cal-item")];
    expect(
      itens.map((item) => item.querySelector("strong").textContent),
    ).toEqual([
      "Inscrições",
      "Prazo de recurso do resultado preliminar",
      "Homologação do resultado final",
      "Entrevista",
    ]);
    const prazoDeRecurso = itens[1];
    expect(prazoDeRecurso.querySelector(".cal-item-data").textContent).toBe(
      "22/09",
    );
    expect(prazoDeRecurso.querySelector("small").textContent).toContain(
      "14/09 a 22/09 (9 dias)",
    );

    await clicar(itens[0]);
    expect($("calTimelineEdital").value).toBe("2");
  });
});

describe("datas impossíveis (ano digitado errado)", () => {
  it("avisa quais editais têm etapa a revisar, e a etapa some da lista", async () => {
    const supabase = supabaseFalso();
    supabase.rpc.mockImplementation(async (nome, argumentos) => {
      if (nome === "get_nucleo_cronograma_resumo")
        return { data: RESUMO, error: null };
      if (nome === "listar_etapas_do_cronograma")
        return { data: null, error: { code: "PGRST202" } };
      const id = argumentos.p_monitoramento_id;
      if (id === 1)
        return {
          data: {
            etapas: [
              // Ano 0202 em vez de 2026: gravado assim antes desta correção.
              {
                atividade: "Etapa com ano errado",
                data_inicio: "0202-10-09",
                data_fim: "0202-10-10",
                ordem: 1,
              },
              ...CRONOGRAMAS[1],
            ],
          },
          error: null,
        };
      return { data: { etapas: CRONOGRAMAS[id] || [] }, error: null };
    });
    await montar({ supabase });

    expect($("calProximas").textContent).toContain(
      "1 edital com data impossível no cronograma",
    );
    expect($("calProximas").textContent).toContain("10/2026");
    expect(
      [...document.querySelectorAll("#calProximas .cal-item strong")].map(
        (item) => item.textContent,
      ),
    ).not.toContain("Etapa com ano errado");
  });
});

/*
  A tela mostra só as etapas dos editais da área escolhida no menu: o recorte é
  pelo conjunto de ids das linhas do monitoramento daquela área.
*/
describe("área atual", () => {
  beforeEach(async () => {
    publicarLinhasDoMonitoramento([
      { id: 1, CO_AREA: "saude-indigena" },
      { id: 2, CO_AREA: "sede" },
      { id: 3, CO_AREA: "sede" },
    ]);
    await montar();
  });

  it("troca de área sem recarregar, e só mostra os editais dela", async () => {
    expect(contador()).toBe("2 etapas no mês");

    await act(async () => definirAreaAtual("sede"));
    expect(contador()).toBe("1 etapa no mês");
    expect(faixas("2026-09-14")).toEqual([]);

    await act(async () => definirAreaAtual("projetos"));
    expect(contador()).toBe("0 etapas no mês");
  });
});

/*
  Vistas Mês · Semana · Lista. As mesmas etapas filtradas da grade; a Lista
  agrupa por dia o que começa ou termina e põe o que atravessa o período num
  bloco "Em andamento", uma vez só.
*/
describe("vistas Mês, Semana e Lista", () => {
  const visao = (valor) =>
    document.querySelector(`.cal-visoes [data-valor="${valor}"]`);
  const titulosDaLista = () =>
    [...document.querySelectorAll(".cal-lista-dia-titulo")].map((titulo) =>
      titulo.textContent.trim(),
    );
  const itensDoDia = (chave) =>
    [
      ...document.querySelectorAll(
        `.cal-lista-dia[data-dia="${chave}"] .cal-item`,
      ),
    ].map((item) => item.querySelector("strong").textContent);
  const marcasDoDia = (chave) =>
    [
      ...document.querySelectorAll(
        `.cal-lista-dia[data-dia="${chave}"] .cal-item-marca`,
      ),
    ].map((marca) => marca.textContent);

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("o seletor é um radiogroup e abre em Mês no computador", async () => {
    await montar();
    const grupo = document.querySelector(".cal-visoes");
    expect(grupo.getAttribute("role")).toBe("radiogroup");
    expect(
      [...grupo.querySelectorAll('[role="radio"]')].map((botao) =>
        botao.textContent.trim(),
      ),
    ).toEqual(["Mês", "Semana", "Lista"]);
    expect(visao("mes").getAttribute("aria-checked")).toBe("true");
    expect(document.querySelectorAll(".cal-celula")).toHaveLength(42);
  });

  it("Lista começa hoje, com 'Acontecendo agora' no topo e os dias anteriores recolhidos", async () => {
    await montar();
    await clicar(visao("lista"));
    expect($("calGrade").dataset.visao).toBe("lista");
    expect(document.querySelector(".cal-celula")).toBeNull();
    // Na Lista o tipo vai escrito em cada linha: a legenda sai.
    expect($("calLegenda")).toBeNull();
    expect(titulosDaLista()).toEqual([
      "Ter, 22 de setembro",
      "Ter, 29 de setembro",
    ]);
    // O recurso de 14 a 22/09 está acontecendo: uma vez só, até quando.
    const andamento = document.querySelector(".cal-andamento");
    const cabeca = andamento.querySelector(".cal-andamento-cabeca");
    expect(cabeca.textContent).toBe("Acontecendo agora · 1 etapa");
    expect(cabeca.getAttribute("aria-expanded")).toBe("true");
    expect(andamento.querySelector("strong").textContent).toBe(
      "Prazo de recurso do resultado preliminar",
    );
    expect(andamento.querySelector(".cal-item-marca").textContent).toBe(
      "até 22/09",
    );
    await clicar(cabeca);
    expect(andamento.querySelector(".cal-lista-itens").hidden).toBe(true);

    // 14/09 já passou: fica atrás do botão, sem rolagem dentro do card.
    const anteriores = document.querySelector(".cal-anteriores");
    expect(anteriores.textContent).toBe("Ver 1 dia anterior deste mês");
    await clicar(anteriores);
    expect(titulosDaLista()[0]).toBe("Seg, 14 de setembro");
    expect(itensDoDia("2026-09-14")).toEqual([
      "Prazo de recurso do resultado preliminar",
    ]);
    expect(marcasDoDia("2026-09-14")).toEqual(["início"]);
    // Dentro do dia, pela ordem da legenda: Recursos antes de Inscrições.
    expect(itensDoDia("2026-09-22")).toEqual([
      "Prazo de recurso do resultado preliminar",
      "Inscrições",
    ]);
    expect(marcasDoDia("2026-09-22")).toEqual(["último dia"]);
    expect(
      document.querySelector('.cal-lista-dia[data-dia="2026-09-22"] .cal-tipo')
        .textContent,
    ).toBe("Recursos");
    expect(document.querySelector(".cal-unidade")).toBeNull();
    // As próximas etapas só aparecem no Mês: aqui seriam a mesma lista.
    expect($("calProximas")).toBeNull();
    expect(localStorage.getItem("agsus:cronograma:visao")).toBe("lista");
  });

  it("'Acontecendo agora' nasce recolhido com mais de três etapas", async () => {
    const supabase = supabaseFalso();
    supabase.rpc.mockImplementation(async (nome, argumentos) => {
      if (nome === "get_nucleo_cronograma_resumo")
        return { data: RESUMO, error: null };
      if (nome === "listar_etapas_do_cronograma")
        return { data: null, error: { code: "PGRST202" } };
      if (argumentos.p_monitoramento_id !== 1)
        return { data: { etapas: [] }, error: null };
      return {
        data: {
          etapas: [1, 2, 3, 4].map((ordem) => ({
            atividade: `Análise curricular ${ordem}`,
            data_inicio: "2026-09-10",
            data_fim: `2026-09-2${ordem}`,
            ordem,
          })),
        },
        error: null,
      };
    });
    localStorage.setItem("agsus:cronograma:visao", "lista");
    await montar({ supabase });
    const cabeca = document.querySelector(".cal-andamento-cabeca");
    expect(cabeca.textContent).toBe("Acontecendo agora · 4 etapas");
    expect(cabeca.getAttribute("aria-expanded")).toBe("false");
    expect(
      document.querySelector(".cal-andamento .cal-lista-itens").hidden,
    ).toBe(true);
  });

  it("'Ver todas na Lista' sai do Mês para a Lista no dia de hoje", async () => {
    await montar();
    expect($("calProximas").querySelectorAll(".cal-item")).toHaveLength(4);
    await clicar($("calMesSeguinte"));
    await clicar($("calVerNaLista"));
    expect(visao("lista").getAttribute("aria-checked")).toBe("true");
    expect($("calMesTitulo").textContent).toBe("Setembro 2026");
    expect(titulosDaLista()[0]).toBe("Ter, 22 de setembro");
  });

  it("clicar numa linha abre o mesmo popup do dia", async () => {
    await montar();
    await clicar(visao("lista"));
    const inscricoes = [
      ...document.querySelectorAll(
        '.cal-lista-dia[data-dia="2026-09-22"] .cal-item',
      ),
    ].find((item) => item.textContent.includes("Inscrições"));
    await clicar(inscricoes);
    expect($("calDiaTitulo").textContent).toBe(
      "Terça-feira, 22 de setembro — 2 etapas",
    );
    await clicar($("calDiaFechar"));
    // O bloco "Em andamento" abre o dia em que a etapa termina.
    await clicar(document.querySelector(".cal-andamento .cal-item"));
    expect($("calDiaTitulo").textContent).toMatch(
      /^Terça-feira, 22 de setembro/,
    );
  });

  it("os filtros valem na Lista; mês sem etapa mostra o vazio; Hoje volta", async () => {
    await montar();
    await clicar(visao("lista"));
    await escolher($("calUnidade"), "CASAI São Paulo");
    expect(titulosDaLista()).toEqual(["Ter, 22 de setembro"]);

    await clicar($("calMesSeguinte"));
    await clicar($("calMesSeguinte"));
    expect($("calMesTitulo").textContent).toBe("Novembro 2026");
    expect($("calGrade").textContent).toContain(
      "Nenhuma etapa neste período com os filtros atuais",
    );
    await clicar($("calHoje"));
    expect($("calMesTitulo").textContent).toBe("Setembro 2026");
    expect(
      document
        .querySelector('.cal-lista-dia[data-dia="2026-09-22"]')
        .getAttribute("aria-current"),
    ).toBeNull();
  });

  it("lembra a última vista escolhida", async () => {
    localStorage.setItem("agsus:cronograma:visao", "lista");
    await montar();
    expect(visao("lista").getAttribute("aria-checked")).toBe("true");
    expect(document.querySelector(".cal-lista")).not.toBeNull();
  });

  it("Semana mostra 7 dias com as etapas ativas e anda de semana em semana", async () => {
    await montar();
    // Pelo teclado: → de Mês vai para Semana, com o foco junto.
    visao("mes").focus();
    await teclar(visao("mes"), "ArrowRight");
    expect(document.activeElement).toBe(visao("semana"));
    expect(visao("semana").getAttribute("aria-checked")).toBe("true");
    expect($("calMesTitulo").textContent).toBe("13 a 19 de setembro de 2026");
    expect(contador()).toBe("1 etapa na semana");
    const dias = document.querySelectorAll(".cal-semana-dia");
    expect(dias).toHaveLength(7);
    const hoje = document.querySelector(
      '.cal-semana-dia[data-dia="2026-09-15"]',
    );
    expect(hoje.getAttribute("aria-current")).toBe("date");
    // O recurso atravessa a semana inteira: está em cada dia dela.
    expect(hoje.querySelector(".cal-mini").dataset.marca).toBe("em andamento");
    expect(
      document.querySelector('.cal-semana-dia[data-dia="2026-09-14"] .cal-mini')
        .dataset.marca,
    ).toBe("começa");
    expect($("calMesSeguinte").getAttribute("aria-label")).toBe(
      "Próxima semana",
    );

    await clicar($("calMesSeguinte"));
    expect($("calMesTitulo").textContent).toBe("20 a 26 de setembro de 2026");
    expect(contador()).toBe("2 etapas na semana");

    // Clicar numa etapa que só atravessa o dia abre o dia em que ela termina.
    await clicar(
      document.querySelector(
        '.cal-semana-dia[data-dia="2026-09-21"] .cal-mini',
      ),
    );
    expect($("calDiaTitulo").textContent).toMatch(
      /^Terça-feira, 22 de setembro/,
    );
  });
});
