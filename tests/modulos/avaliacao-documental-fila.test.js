import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.js";
import { montarAvaliacaoDocumental } from "../../src/modulos/avaliacao-documental/avaliacao-documental.jsx";
import { criarEstadoDaFila } from "../../src/modulos/avaliacao-documental/estado-da-fila.js";
import {
  clicar,
  digitar,
  escolher,
  esperar,
  teclar,
} from "../componentes/interacoes.js";

/*
  A aba Fila da Avaliação documental (fase F3): etapas com contadores,
  filtros (e salvos), Pegar próximo, Minhas fichas, ações em lote da
  coordenação com prévia e motivo, a ficha aberta com a reserva e o seletor
  de editais só com os vigentes. Códigos AM-6.x, AM-12.2 e AM-3.3 de
  docs/historias-de-usuario/analises-no-monitora.md.
*/

const EU = "u-ana";
const AGORA_MAIS = new Date(Date.now() + 10 * 60 * 1000).toISOString();
const ficha = (id, situacao, extra = {}) => ({
  id,
  versao: 3,
  situacao,
  responsavel: null,
  responsavel_nome: null,
  reserva: null,
  ...extra,
});
const inscrito = (codigo, extra) => ({
  id: `c-${codigo}`,
  vaga: "179698",
  codigo,
  nome: `Pessoa ${codigo}`,
  situacao_pre: "NO_LOTE",
  posicao: 1,
  lote: 1,
  art: 20,
  modalidade: "AC",
  ficha: null,
  ...extra,
});

function fila({ coordena = true, pegar = true } = {}) {
  return {
    schema_version: 1,
    edital: { id: "e93", rotulo: "93/2026" },
    papel: coordena ? "COORDENADOR" : "ANALISTA",
    pode_coordenar: coordena,
    pode_pegar: pegar,
    eu: EU,
    prazo_reserva_min: 15,
    distribuicao: {
      modo: "PEGAR_PROXIMO",
      criterio: "PARTES_IGUAIS",
      novos: "MENOS_PENDENTES",
    },
    sem_ficha: 1,
    vagas: [{ codigo: "179698", cargo: "Técnico" }],
    analistas: [
      { usuario: EU, nome: "Ana", vagas: null, limite: null, pendentes: 1 },
      {
        usuario: "u-beto",
        nome: "Beto",
        vagas: null,
        limite: null,
        pendentes: 0,
      },
    ],
    filtros: [
      {
        id: "fs1",
        nome: "Minhas em análise",
        filtro: { etapa: "em_analise", responsavel: "eu" },
      },
    ],
    candidatos: [
      inscrito("7001", {
        posicao: 1,
        ficha: ficha("f1", "EM_ANALISE", {
          responsavel: EU,
          responsavel_nome: "Ana",
          reserva: {
            usuario: "u-beto",
            nome: "Beto",
            desde: new Date().toISOString(),
            expira: AGORA_MAIS,
          },
        }),
      }),
      inscrito("7002", { posicao: 2, ficha: ficha("f2", "PENDENTE") }),
      inscrito("7003", { posicao: 3, ficha: ficha("f3", "PENDENTE") }),
      inscrito("7004", { posicao: 4 }),
      inscrito("7009", {
        situacao_pre: "ELIMINADO",
        posicao: null,
        lote: null,
        motivo_eliminacao: "Cancelou",
      }),
    ],
  };
}

function supabaseFalso(dados = fila(), extra = {}) {
  const respostas = {
    listar_editais_avaliacao: () => ({
      area: "projetos",
      editais: [
        {
          id: "e93",
          edital: "93/2026",
          unidade: "Boa Vista",
          ativo: true,
          status: "Em andamento",
        },
        {
          id: "e23",
          edital: "23/2025",
          unidade: "Boa Vista",
          ativo: true,
          status: "Concluído",
        },
        {
          id: "fcc",
          edital: "FCC",
          unidade: "",
          ativo: true,
          status: "Concluído",
        },
      ],
    }),
    obter_regra_analise: () => ({
      edital: { id: "e93", edital: "93/2026", area: "projetos" },
      papel: dados.papel,
      pode_coordenar: dados.pode_coordenar,
      origem: "PLANILHA",
      regra: null,
      modelos: [],
      nota_minima: null,
      aldeias: { quantidade: 0 },
      perguntas: [],
    }),
    obter_equipe_edital: () => ({
      gestores: [],
      equipe: [],
      pessoas: [],
      vagas: [],
    }),
    obter_fila_avaliacao: () => dados,
    reservar_ficha: ({ p_ficha }) => ({
      ficha: {
        id: p_ficha,
        versao: 4,
        vaga: "179698",
        cargo: "Técnico",
        codigo: "7001",
        nome: "Pessoa 7001",
        posicao: 1,
        lote: 1,
        art: 20,
        modalidade: "AC",
        situacao: "EM_ANALISE",
        responsavel_nome: "Ana",
        reserva: {
          usuario: "u-beto",
          nome: "Beto",
          desde: new Date().toISOString(),
          expira: AGORA_MAIS,
        },
      },
      reservada: false,
      somente_leitura: true,
      motivo: "Em uso por outra pessoa.",
    }),
    pegar_proxima_ficha: () => ({
      ficha: null,
      reservada: false,
      motivo: "Nenhuma ficha livre na fila.",
    }),
    distribuir_fichas: ({ p_atribuicoes }) => ({
      alteradas: p_atribuicoes.length,
    }),
    liberar_reserva: ({ p_fichas }) => ({ liberadas: p_fichas.length }),
    mandar_fichas_revisao: ({ p_fichas }) => ({ alteradas: p_fichas.length }),
    abrir_fichas_do_edital: () => ({ criadas: 1 }),
    salvar_filtro_fila: ({ p_nome, p_filtro }) => [
      { id: "fs2", nome: p_nome, filtro: p_filtro },
    ],
    excluir_filtro_fila: () => [],
    ...extra,
  };
  return {
    rpc: vi.fn(async (nome, args) => {
      const r = respostas[nome]?.(args);
      if (r instanceof Error) return { data: null, error: r };
      return { data: r ?? null, error: null };
    }),
    auth: {
      getSession: async () => ({ data: { session: { user: { id: EU } } } }),
    },
  };
}

let secao;
let painel;
const toast = vi.fn();

async function montar(supabase, { abrirFila = true } = {}) {
  secao = document.createElement("section");
  secao.id = "page-avaliacao-documental";
  secao.className = "page active";
  document.body.append(secao);
  await act(async () => {
    painel = montarAvaliacaoDocumental({ supabase, toast });
  });
  await act(async () => void painel.render());
  await esperar();
  await escolher(secao.querySelector(".avd-edital select"), "e93");
  await esperar();
  if (abrirFila) {
    await clicar(
      secao.querySelector("[data-tour='avd-visoes'] [data-valor='fila']"),
    );
    await esperar();
  }
}
const botao = (texto, raiz = document.body) =>
  [...raiz.querySelectorAll("button")].find((b) =>
    b.textContent.trim().startsWith(texto),
  );
const linhas = () =>
  [...secao.querySelectorAll("[data-tour='avd-fila-tabela'] tbody tr")].map(
    (tr) => tr.dataset.candidato,
  );

beforeEach(() => {
  redefinirDadosDoMonitoramento();
  definirAreaAtual("projetos");
  try {
    globalThis.localStorage?.clear();
  } catch {
    /* sem armazenamento */
  }
});
afterEach(async () => {
  await act(async () => painel?.raiz?.unmount());
  secao?.remove();
  document.body.innerHTML = "";
  redefinirDadosDoMonitoramento();
  toast.mockClear();
});

describe("seletor de editais: só os vigentes", () => {
  it("esconde os concluídos e mostra todos com a caixa; o escolhido fica", async () => {
    await montar(supabaseFalso(), { abrirFila: false });
    const opcoes = () =>
      [...secao.querySelectorAll(".avd-edital select option")]
        .map((o) => o.value)
        .filter(Boolean);
    expect(opcoes()).toEqual(["e93"]);
    const caixa = secao.querySelector("[data-tour='avd-todos-editais'] input");
    await clicar(caixa);
    expect(opcoes()).toEqual(["e93", "e23", "fcc"]);
    await escolher(secao.querySelector(".avd-edital select"), "e23");
    await esperar();
    await clicar(caixa);
    expect(opcoes()).toEqual(["e93", "e23"]);
  });
});

describe("Fila (AM-6)", () => {
  it("etapas com contadores filtram a lista; No lote é a inicial", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    expect(supabase.rpc).toHaveBeenCalledWith("obter_fila_avaliacao", {
      p_edital: "e93",
    });
    const etapas = secao.querySelector("[data-tour='avd-fila-etapas']");
    expect(etapas.textContent).toContain("Inscritos5");
    expect(etapas.textContent).toContain("No lote4");
    expect(etapas.textContent).toContain("Pendentes2");
    expect(etapas.textContent).toContain("Em análise1");
    expect(etapas.textContent).toContain("Eliminados1");
    expect(linhas()).toEqual(["7001", "7002", "7003", "7004"]);
    await clicar(etapas.querySelector("[data-valor='eliminados']"));
    expect(linhas()).toEqual(["7009"]);
    await clicar(etapas.querySelector("[data-valor='pendentes']"));
    expect(linhas()).toEqual(["7002", "7003"]);
  });

  it("Minhas fichas, filtro salvo e salvar um filtro novo", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await clicar(secao.querySelector("[data-tour='avd-fila-minhas']"));
    expect(linhas()).toEqual(["7001"]);
    await clicar(botao("Salvar filtro", secao));
    await digitar(
      secao.querySelector("[data-tour='avd-fila-filtros-salvos'] form input"),
      "Só as minhas",
    );
    await clicar(
      botao(
        "Salvar",
        secao.querySelector("[data-tour='avd-fila-filtros-salvos'] form"),
      ),
    );
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("salvar_filtro_fila", {
      p_nome: "Só as minhas",
      p_filtro: {
        etapa: "lote",
        vaga: "",
        responsavel: "eu",
        modalidade: "",
        busca: "",
      },
    });
  });

  it("AM-6.4 e AM-12.2: o código abre direto; ficha em uso por outra pessoa só para leitura", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    expect(secao.querySelector("[data-candidato='7001']").textContent).toMatch(
      /Em uso por Beto desde \d{2}:\d{2}/,
    );
    const busca = secao.querySelector("[data-tour='avd-fila-busca']");
    await digitar(busca, "7001");
    await teclar(busca, "Enter");
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("reservar_ficha", {
      p_ficha: "f1",
    });
    const gaveta = document.querySelector("[data-tour='avd-ficha']");
    expect(gaveta.textContent).toContain("Candidato 7001");
    expect(gaveta.textContent).toContain(
      "Só leitura: Em uso por outra pessoa.",
    );
    expect(gaveta.textContent).toContain(
      "O conteúdo da análise chega na fase F4.",
    );
    expect(gaveta.textContent).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
    // A coordenação libera a reserva presa, com motivo.
    await clicar(botao("Liberar a reserva"));
    await digitar(gaveta.querySelector("input"), "Reserva presa desde ontem");
    await clicar(botao("Liberar", gaveta));
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("liberar_reserva", {
      p_edital: "e93",
      p_fichas: ["f1"],
      p_motivo: "Reserva presa desde ontem",
    });
  });

  it("AM-6.1: Pegar próximo sem ficha livre avisa", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await clicar(secao.querySelector("[data-tour='avd-fila-pegar']"));
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("pegar_proxima_ficha", {
      p_edital: "e93",
      p_vaga: null,
    });
    expect(toast).toHaveBeenCalledWith("Nenhuma ficha livre na fila.", "info");
  });

  it("AM-6.2: distribuir as livres mostra a prévia e só grava ao confirmar", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await clicar(
      secao.querySelector("[data-tour='avd-fila-distribuir-livres']"),
    );
    const gaveta = document.querySelector("[data-tour='avd-fila-confirmar']");
    const previa = [...gaveta.querySelectorAll("tbody tr")].map(
      (tr) => tr.textContent,
    );
    expect(previa).toEqual(["Ana12", "Beto11"]);
    expect(supabase.rpc).not.toHaveBeenCalledWith(
      "distribuir_fichas",
      expect.anything(),
    );
    await clicar(gaveta.querySelector("[data-acao='confirmar-distribuir']"));
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("distribuir_fichas", {
      p_edital: "e93",
      p_atribuicoes: [
        { ficha: "f2", versao: 3, usuario: "u-beto" },
        { ficha: "f3", versao: 3, usuario: EU },
      ],
      p_motivo: null,
    });
  });

  it("AM-6.3: redistribuir pede motivo; versão velha volta com a mensagem do banco", async () => {
    const erro = Object.assign(
      new Error(
        "1 ficha(s) mudaram desde que você abriu a fila; atualize e confira.",
      ),
      { code: "40001" },
    );
    const supabase = supabaseFalso(fila(), { distribuir_fichas: () => erro });
    await montar(supabase);
    await clicar(secao.querySelector("[aria-label='Selecionar 7001']"));
    await clicar(botao("Distribuir (1)", secao));
    const gaveta = document.querySelector("[data-tour='avd-fila-confirmar']");
    await escolher(gaveta.querySelector("select"), "u-beto");
    const confirmar = gaveta.querySelector(
      "[data-acao='confirmar-distribuir']",
    );
    expect(confirmar.disabled).toBe(true);
    await digitar(gaveta.querySelector("textarea"), "Ana de férias na semana");
    expect(confirmar.disabled).toBe(false);
    await clicar(confirmar);
    await esperar();
    expect(gaveta.textContent).toContain("mudaram desde que você abriu a fila");
  });

  it("analista não vê as ações da coordenação", async () => {
    await montar(supabaseFalso(fila({ coordena: false })));
    expect(secao.querySelector("[aria-label='Selecionar 7001']")).toBeNull();
    expect(
      secao.querySelector("[data-tour='avd-fila-distribuir-livres']"),
    ).toBeNull();
    expect(secao.querySelector("[data-tour='avd-fila-pegar']")).not.toBeNull();
  });
});

describe("estado da fila: reserva", () => {
  it("renova enquanto a ficha está aberta e libera ao fechar", async () => {
    const agendados = [];
    const supabase = supabaseFalso(fila(), {
      reservar_ficha: ({ p_ficha }) => ({
        ficha: { id: p_ficha, versao: 2 },
        reservada: true,
        somente_leitura: false,
      }),
      renovar_reserva: ({ p_ficha }) => ({
        ficha: { id: p_ficha, versao: 2, reserva: { expira: AGORA_MAIS } },
      }),
    });
    const estado = criarEstadoDaFila({
      supabase,
      toast,
      armazenamento: null,
      agendar: (fn) => agendados.push(fn) && agendados.length,
      cancelar: () => {},
    });
    await estado.carregar("e93");
    await estado.abrir("f2");
    expect(agendados).toHaveLength(1);
    await agendados[0]();
    expect(supabase.rpc).toHaveBeenCalledWith("renovar_reserva", {
      p_ficha: "f2",
    });
    await estado.fechar();
    expect(supabase.rpc).toHaveBeenCalledWith("liberar_reserva", {
      p_edital: "e93",
      p_fichas: ["f2"],
      p_motivo: null,
    });
    expect(estado.obter().aberta).toBeNull();
  });

  it("renovação recusada vira só leitura com o motivo", async () => {
    const agendados = [];
    const erro = Object.assign(new Error("A ficha não está mais com você"), {
      code: "40001",
    });
    const supabase = supabaseFalso(fila(), {
      reservar_ficha: ({ p_ficha }) => ({
        ficha: { id: p_ficha, versao: 2 },
        reservada: true,
      }),
      renovar_reserva: () => erro,
    });
    const estado = criarEstadoDaFila({
      supabase,
      armazenamento: null,
      agendar: (fn) => agendados.push(fn),
      cancelar: () => {},
    });
    await estado.carregar("e93");
    await estado.abrir("f2");
    await agendados[0]();
    expect(estado.obter().aberta.somente_leitura).toBe(true);
    expect(estado.obter().aberta.motivo).toContain("não está mais com você");
  });
});
