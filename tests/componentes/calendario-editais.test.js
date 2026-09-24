import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { montarCalendarioEditais } from "../../src/componentes/calendario-editais/calendario-editais.jsx";
import { clicar, digitar, escolher, esperar, teclar } from "./interacoes.js";

/*
  O Calendário de Editais em React: a costura entre o carregamento (1 + N
  RPCs), a lógica de `src/lib/calendario-editais.js` e o desenho. "Hoje" é fixo
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
const pontos = (chave) =>
  [...celula(chave).querySelectorAll(".cal-ponto")].map((ponto) =>
    Number(ponto.textContent),
  );
const contador = () => $("calContador").textContent;
const etapasDaLinhaDoTempo = () =>
  [...document.querySelectorAll("#calTimeline .cal-passo strong")].map(
    (item) => item.textContent,
  );

describe("carregamento", () => {
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

  it("mostra o erro no lugar da grade", async () => {
    await montar({
      supabase: supabaseFalso({ erroNoResumo: "RPC fora do ar" }),
    });
    expect($("calGrade").querySelector(".alert.warn").textContent).toBe(
      "RPC fora do ar",
    );
  });

  it("avisa quando um edital não pôde ser lido, e mostra os outros", async () => {
    const toast = vi.fn();
    await montar({ supabase: supabaseFalso({ falhaNoEdital: 2 }), toast });
    expect(toast).toHaveBeenCalledWith(
      "1 edital(is) não puderam ser lidos. O calendário está incompleto.",
      "warn",
    );
    expect(pontos("2026-09-14")).toEqual([1]);
    expect(pontos("2026-09-22")).toEqual([1]);
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
    Um recurso de nove dias contado nos nove empurrava para cima a contagem de
    todos eles e escondia o que era pontual.
  */
  it("conta a etapa longa no dia em que começa e no dia em que termina, e não no meio", () => {
    expect(pontos("2026-09-14")).toEqual([1]);
    expect(celula("2026-09-18").classList.contains("vazio")).toBe(true);
    // O fim do recurso e as inscrições, de tipos diferentes.
    expect(pontos("2026-09-22")).toEqual([1, 1]);
    // A data que veio como timestamp cai no dia certo.
    expect(pontos("2026-09-29")).toEqual([1]);
  });

  it("navega entre meses e volta a hoje", async () => {
    await clicar($("calMesSeguinte"));
    expect($("calMesTitulo").textContent).toBe("Outubro 2026");
    expect(contador()).toBe("1 etapa no mês");
    await clicar($("calHoje"));
    expect($("calMesTitulo").textContent).toBe("Setembro 2026");
  });
});

describe("filtros", () => {
  beforeEach(async () => {
    await montar();
  });

  it("busca cada palavra, em qualquer ordem, sem acento", async () => {
    await digitar($("calBusca"), "final homologacao");
    expect(contador()).toBe("1 etapa no mês");
    expect(pontos("2026-09-29")).toEqual([1]);
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
    await clicar($("calLimparFiltros"));
    expect($("calBusca").value).toBe("");
    expect($("calOcultarConcluidas").checked).toBe(false);
    expect(pontos("2026-09-10")).toEqual([1]);
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

  it("abre com as etapas que começam ou terminam no dia, marcando a célula", async () => {
    await clicar(celula("2026-09-22"));
    expect($("calDiaTitulo").textContent).toBe(
      "Terça-feira, 22 de setembro — 2 etapas",
    );
    const marcos = [
      ...document.querySelectorAll("#calDiaLista .cal-marco"),
    ].map((marco) => marco.textContent);
    expect(marcos).toEqual(["fim"]);
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
