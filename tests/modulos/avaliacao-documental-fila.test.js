import { renders } from "../componentes/contar-renders.js";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";
import { montarAvaliacaoDocumental } from "../../src/modulos/avaliacao-documental/avaliacao-documental.tsx";
import { criarEstadoDaFila } from "../../src/modulos/avaliacao-documental/estado-da-fila.ts";
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

async function montar(supabase, { abrirFila = true, getProfile } = {}) {
  secao = document.createElement("section");
  secao.id = "page-avaliacao-documental";
  secao.className = "page active";
  document.body.append(secao);
  await act(async () => {
    painel = montarAvaliacaoDocumental({ supabase, toast, getProfile });
  });
  await act(async () => void painel.render());
  await esperar();
  await escolher(secao.querySelector(".avd-edital select"), "e93");
  await esperar();
  // Quem não coordena já abre na Fila, sem o seletor de abas.
  const aba = secao.querySelector(
    "[data-tour='avd-visoes'] [data-valor='fila']",
  );
  if (abrirFila && aba) {
    await clicar(aba);
    await esperar();
  }
}
const botao = (texto, raiz = document.body) =>
  [...raiz.querySelectorAll("button")].find((b) =>
    b.textContent.trim().startsWith(texto),
  );
/* O menu "Ações da coordenação" (as ações só aparecem com ele aberto). */
const abrirMenu = () =>
  clicar(
    secao.querySelector(
      "[data-tour='avd-fila-acoes-coordenacao'] [data-acao='abrir-menu']",
    ),
  );
const linhas = () =>
  [
    ...secao.querySelectorAll(
      "[data-tour='avd-fila-tabela'] tbody tr[data-candidato]",
    ),
  ].map((tr) => tr.dataset.candidato);

beforeEach(() => {
  redefinirDadosDoMonitoramento();
  definirAreaAtual("projetos");
  try {
    globalThis.sessionStorage?.clear();
  } catch {
    /* sem sessão */
  }
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
    expect(gaveta.textContent).toContain("Código 7001");
    expect(gaveta.textContent).toContain(
      "Só leitura: Em uso por outra pessoa.",
    );
    // O conteúdo da ficha (F4) é lido à parte: tests/modulos/avaliacao-documental-ficha.test.js.
    expect(supabase.rpc).toHaveBeenCalledWith("obter_ficha_analise", {
      p_ficha: "f1",
    });
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
    await abrirMenu();
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
    await abrirMenu();
    await clicar(botao("Distribuir as selecionadas (1)", secao));
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
    expect(
      secao.querySelector("[data-tour='avd-fila-acoes-coordenacao']"),
    ).toBeNull();
    expect(secao.querySelector("[data-tour='avd-fila-pegar']")).not.toBeNull();
    expect(secao.querySelector("[data-tour='avd-fila-minhas']")).not.toBeNull();
  });
});

describe("listas da fila: colunas por aba, ordem, N de M e CSV", () => {
  const cabecalhos = () =>
    [...secao.querySelectorAll("[data-tour='avd-fila-tabela'] thead th")].map(
      (th) => th.textContent.trim(),
    );

  it("Eliminados mostra o motivo e a ART, sem posição, responsável nem reserva", async () => {
    await montar(supabaseFalso());
    await clicar(
      secao.querySelector(
        "[data-tour='avd-fila-etapas'] [data-valor='eliminados']",
      ),
    );
    expect(cabecalhos()).toEqual([
      "Código",
      "Nome",
      "Vaga",
      "Motivo da eliminação",
      "Nota declarada",
    ]);
    const art = secao.querySelector(
      "[data-tour='avd-fila-tabela'] thead th:last-child",
    );
    expect(art.title).toMatch(/^ART: Autodeclaração de Requisitos e Títulos/);
    const linha = secao.querySelector("[data-candidato='7009']");
    expect(linha.textContent).toContain("Cancelou");
    expect(linha.textContent).toContain("20");
  });

  it("a tabela não fica dentro de um card com padding (cabeçalho fixo no topo da rolagem)", async () => {
    await montar(supabaseFalso());
    const rolagem = secao.querySelector(
      "[data-tour='avd-fila-tabela'] .ui-tabela-rolagem",
    );
    expect(rolagem.classList.contains("ui-card")).toBe(false);
    expect(
      rolagem.querySelector("thead input[type='checkbox']"),
    ).not.toBeNull();
  });

  it("ordena pela coluna, mostra N de M e exporta o CSV da aba na ordem da tela", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    const ordenar = (nome) =>
      [
        ...secao.querySelectorAll("[data-tour='avd-fila-tabela'] th button"),
      ].find((b) => b.textContent.trim() === nome);
    await clicar(ordenar("Código"));
    await clicar(ordenar("Código"));
    expect(linhas()).toEqual(["7004", "7003", "7002", "7001"]);
    expect(
      secao.querySelector(
        "[data-tour='avd-fila-tabela'] th[aria-sort='descending']",
      ).textContent,
    ).toContain("Código");
    await digitar(secao.querySelector("[data-tour='avd-fila-busca']"), "7002");
    expect(
      secao.querySelector(
        "[data-tour='avd-fila-tabela'] [data-tabela-contagem]",
      ).textContent,
    ).toBe("1 de 4");
    await digitar(secao.querySelector("[data-tour='avd-fila-busca']"), "");
    const blobs = [];
    const original = {
      criar: URL.createObjectURL,
      soltar: URL.revokeObjectURL,
    };
    URL.createObjectURL = (blob) => {
      blobs.push(blob);
      return "blob:falso";
    };
    URL.revokeObjectURL = () => {};
    const clique = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    try {
      await clicar(secao.querySelector("[data-acao='exportar-csv']"));
      expect(blobs).toHaveLength(1);
      const texto = await blobs[0].text();
      const [cabeca, primeira] = texto.replace(/^\uFEFF/, "").split("\r\n");
      expect(cabeca).toBe(
        "Vaga;Posição;Código;Nome;Nota declarada (ART);Situação;Responsável;Reserva",
      );
      expect(primeira.split(";")[2]).toBe("7004");
    } finally {
      clique.mockRestore();
      URL.createObjectURL = original.criar;
      URL.revokeObjectURL = original.soltar;
    }
  });
});

describe("modo de análise: a ficha ocupa a tela", () => {
  /* Cada ficha reservada para mim, com o cabeçalho do inscrito. */
  const reservarMinha = ({ p_ficha }) => {
    const c = fila().candidatos.find((x) => x.ficha?.id === p_ficha);
    return {
      ficha: {
        ...c.ficha,
        id: p_ficha,
        vaga: c.vaga,
        codigo: c.codigo,
        nome: c.nome,
        posicao: c.posicao,
        art: c.art,
        modalidade: c.modalidade,
        reserva: {
          usuario: EU,
          nome: "Ana",
          desde: new Date().toISOString(),
          expira: AGORA_MAIS,
        },
      },
      reservada: true,
      somente_leitura: false,
    };
  };
  const abrirPelaLista = async (codigo) => {
    await clicar(
      botao("Abrir", secao.querySelector(`[data-candidato='${codigo}']`)),
    );
    await esperar();
  };

  it("abrir esconde a lista, o topo da tela e o edital; Voltar à fila (ou Esc) volta e solta a reserva", async () => {
    const supabase = supabaseFalso(fila(), { reservar_ficha: reservarMinha });
    await montar(supabase);
    await abrirPelaLista("7002");
    const analise = secao.querySelector("[data-tour='avd-ficha']");
    expect(analise.tagName).toBe("SECTION");
    // O nome grande com o código; os chips só com o essencial (a ART com a dica).
    expect(analise.querySelector("h2").textContent).toBe(
      "Pessoa 7002Código 7002",
    );
    expect(analise.querySelector(".avd-analise-dados").textContent).toContain(
      "Declarada 20",
    );
    expect(
      analise.querySelector(
        ".avd-analise-dados .avd-chip[title^='ART: Autodeclaração']",
      ),
    ).not.toBeNull();
    expect(secao.querySelector("[data-tour='avd-fila-tabela']")).toBeNull();
    expect(secao.querySelector("[data-tour='avd-visoes']")).toBeNull();
    expect(secao.querySelector(".avd-edital")).toBeNull();
    expect(secao.querySelector(".avd-tela").dataset.modo).toBe("analise");
    expect(document.querySelector(".modal.show")).toBeNull();
    expect(
      JSON.parse(
        sessionStorage.getItem("monitora.avaliacao-documental.ficha-aberta"),
      ),
    ).toEqual({
      edital: "e93",
      ficha: "f2",
    });

    await clicar(secao.querySelector("[data-acao='voltar-a-fila']"));
    await esperar();
    expect(secao.querySelector("[data-tour='avd-ficha']")).toBeNull();
    expect(secao.querySelector("[data-tour='avd-fila-tabela']")).not.toBeNull();
    expect(supabase.rpc).toHaveBeenCalledWith("liberar_reserva", {
      p_edital: "e93",
      p_fichas: ["f2"],
      p_motivo: null,
    });
    expect(
      sessionStorage.getItem("monitora.avaliacao-documental.ficha-aberta"),
    ).toBeNull();

    await abrirPelaLista("7003");
    await teclar(document.body, "Escape");
    await esperar();
    expect(secao.querySelector("[data-tour='avd-ficha']")).toBeNull();
  });

  it("Anterior / Próxima andam pela lista filtrada, na ordem da tabela", async () => {
    const supabase = supabaseFalso(fila(), { reservar_ficha: reservarMinha });
    await montar(supabase);
    const ordenar = [
      ...secao.querySelectorAll("[data-tour='avd-fila-tabela'] th button"),
    ].find((b) => b.textContent.trim() === "Código");
    await clicar(ordenar);
    await clicar(ordenar);
    await abrirPelaLista("7003");
    const navegacao = () => secao.querySelector(".avd-analise-navegacao");
    expect(navegacao().textContent).toContain("1 de 3");
    expect(secao.querySelector("[data-acao='ficha-anterior']").disabled).toBe(
      true,
    );
    await clicar(secao.querySelector("[data-acao='ficha-proxima']"));
    await esperar();
    expect(
      secao.querySelector("[data-tour='avd-ficha'] h2").textContent,
    ).toContain("Código 7002");
    expect(navegacao().textContent).toContain("2 de 3");
    await clicar(secao.querySelector("[data-acao='ficha-proxima']"));
    await esperar();
    expect(
      secao.querySelector("[data-tour='avd-ficha'] h2").textContent,
    ).toContain("Código 7001");
    expect(secao.querySelector("[data-acao='ficha-proxima']").disabled).toBe(
      true,
    );
    await clicar(secao.querySelector("[data-acao='ficha-anterior']"));
    await esperar();
    expect(
      secao.querySelector("[data-tour='avd-ficha'] h2").textContent,
    ).toContain("Código 7002");
    const reservas = supabase.rpc.mock.calls
      .filter(([n]) => n === "reservar_ficha")
      .map(([, a]) => a.p_ficha);
    expect(reservas).toEqual(["f3", "f2", "f1", "f2"]);
  });

  it("recarregar a página volta ao edital, à Fila e à ficha que estava aberta", async () => {
    sessionStorage.setItem(
      "monitora.avaliacao-documental.ficha-aberta",
      JSON.stringify({ edital: "e93", ficha: "f3" }),
    );
    const supabase = supabaseFalso(fila(), { reservar_ficha: reservarMinha });
    secao = document.createElement("section");
    secao.id = "page-avaliacao-documental";
    secao.className = "page active";
    document.body.append(secao);
    await act(async () => {
      painel = montarAvaliacaoDocumental({ supabase, toast });
    });
    await act(async () => void painel.render());
    await esperar();
    await esperar();
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("reservar_ficha", {
      p_ficha: "f3",
    });
    expect(
      secao.querySelector("[data-tour='avd-ficha'] h2").textContent,
    ).toContain("Código 7003");
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

describe("fila: inclusão no lote por decisão da coordenação", () => {
  const comDecisao = (coordena = true) => {
    const d = fila({ coordena });
    d.candidatos = d.candidatos.map((c) =>
      c.codigo === "7003"
        ? { ...c, entrada: "DECISAO", decisao: "Critério CORES" }
        : c.codigo === "7009"
          ? { ...c, motivo_codigo: "QUESTIONARIO" }
          : c,
    );
    return d;
  };
  const reservar = ({ p_ficha }) => {
    const c = comDecisao().candidatos.find((x) => x.ficha?.id === p_ficha);
    return {
      ficha: {
        ...c.ficha,
        vaga: c.vaga,
        codigo: c.codigo,
        nome: c.nome,
        posicao: c.posicao,
        art: c.art,
        modalidade: c.modalidade,
        reserva: {
          usuario: EU,
          nome: "Ana",
          desde: new Date().toISOString(),
          expira: AGORA_MAIS,
        },
      },
      reservada: true,
      somente_leitura: false,
    };
  };

  it('selo "Decisão: Critério CORES" na lista e no topo da ficha; "N pela regra + M por decisão"; revogar com motivo', async () => {
    const revogar = vi.fn(() => ({ revogadas: 1, fichas_fora_do_lote: 1 }));
    const supabase = supabaseFalso(comDecisao(), {
      reservar_ficha: reservar,
      revogar_decisao_lote: revogar,
    });
    await montar(supabase);
    expect(secao.querySelector("[data-lote-da-fila]").textContent).toBe(
      "Lote: 3 pela regra + 1 por decisão",
    );
    const linha = secao.querySelector("[data-candidato='7003']");
    expect(linha.querySelector(".avd-selo-decisao").textContent).toBe(
      "Decisão: Critério CORES",
    );
    expect(
      secao.querySelector("[data-candidato='7002'] .avd-selo-decisao"),
    ).toBeNull();

    await clicar(botao("Abrir", linha));
    await esperar();
    const topo = secao.querySelector(".avd-analise-topo");
    expect(topo.querySelector(".avd-selo-decisao").textContent).toBe(
      "Decisão: Critério CORES",
    );
    await clicar(topo.querySelector("[data-acao='abrir-revogar-decisao']"));
    await digitar(
      topo.querySelector("[data-revogar='7003'] input"),
      "Decisão registrada por engano",
    );
    await clicar(topo.querySelector("[data-acao='revogar-decisao']"));
    await esperar();
    expect(revogar).toHaveBeenCalledWith({
      p_edital: "e93",
      p_codigos: ["7003"],
      p_motivo: "Decisão registrada por engano",
      p_vaga: "179698",
    });
  });

  it("incluir por decisão: só os de fora do lote; o analista não vê a ação", async () => {
    const incluir = vi.fn(() => ({ incluidos: 1, fichas_criadas: 1 }));
    await montar(
      supabaseFalso(comDecisao(), { incluir_no_lote_por_decisao: incluir }),
    );
    await abrirMenu();
    await clicar(secao.querySelector("[data-acao='incluir-por-decisao']"));
    const opcoes = [
      ...document.querySelectorAll(
        "table[aria-label='Candidatos fora do lote pela regra'] tbody tr",
      ),
    ].map((tr) => tr.dataset.candidato);
    expect(opcoes).toEqual(["7009"]);
    await clicar(document.querySelector("input[aria-label='Incluir 7009']"));
    await clicar(
      document.querySelector("[data-acao='confirmar-incluir-por-decisao']"),
    );
    await esperar();
    expect(incluir).toHaveBeenCalledWith({
      p_edital: "e93",
      p_codigos: ["7009"],
      p_motivo: "Critério CORES",
      p_vaga: "179698",
    });

    await act(async () => painel?.raiz?.unmount());
    secao.remove();
    await montar(supabaseFalso(comDecisao(false)));
    expect(secao.querySelector("[data-acao='incluir-por-decisao']")).toBeNull();
    expect(
      secao.querySelector("[data-tour='avd-fila-acoes-coordenacao']"),
    ).toBeNull();
    expect(
      secao.querySelector("[data-candidato='7003'] .avd-selo-decisao"),
    ).not.toBeNull();
  });
});

describe("fila: andamento, menu da coordenação e tabela agrupada por vaga", () => {
  const duasVagas = () => {
    const d = fila();
    d.vagas = [
      { codigo: "179698", cargo: "Técnico" },
      { codigo: "180001", cargo: "Enfermeiro" },
    ];
    d.candidatos = [
      ...d.candidatos.map((c) => ({
        ...c,
        nota: 30 - (Number(c.codigo) % 10),
      })),
      inscrito("8001", {
        vaga: "180001",
        nota: 22,
        ficha: ficha("f9", "CONCLUIDA", { resultado: "APTO", nota_final: 20 }),
      }),
      inscrito("8002", {
        vaga: "180001",
        posicao: 2,
        nota: 18,
        entrada: "DECISAO",
        decisao: "Critério CORES",
        ficha: ficha("f10", "PENDENTE"),
      }),
    ];
    return d;
  };

  it("resumo do andamento: o edital e o bloco Por vaga recolhido; clicar na vaga filtra", async () => {
    await montar(supabaseFalso(duasVagas()));
    const resumo = secao.querySelector("[data-tour='avd-fila-andamento']");
    expect(resumo.querySelector(".avd-andamento-total").textContent).toContain(
      "concluídas 1 de 6 · em análise 1 · pendentes 4",
    );
    const porVaga = resumo.querySelector("details[data-por-vaga]");
    // Fechado por padrão: a grade de cartões por vaga não polui o topo.
    expect(porVaga.open).toBe(false);
    expect(porVaga.querySelector("summary").textContent).toBe(
      "Por vaga (2)2 vagas · 2 com pendências",
    );
    const linhasDaVaga = () =>
      [...resumo.querySelectorAll("tr[data-linha-vaga]")].map((tr) =>
        [...tr.cells].map((td) => td.textContent),
      );
    expect(linhasDaVaga()).toEqual([
      ["179698Técnico", "0 de 4", "1", "3"],
      ["180001Enfermeiro", "1 de 2", "0", "1"],
    ]);
    // O título da coluna ordena; de novo, volta à ordem do edital.
    const ordenar = () => resumo.querySelector("[data-ordenar='pendentes']");
    await clicar(ordenar());
    expect(ordenar().getAttribute("aria-pressed")).toBe("true");
    expect(linhasDaVaga().map((l) => l[3])).toEqual(["3", "1"]);
    await clicar(ordenar());
    expect(ordenar().getAttribute("aria-pressed")).toBe("false");
    await clicar(resumo.querySelector("[data-vaga='180001']"));
    expect(linhas()).toEqual(["8001", "8002"]);
    expect(
      resumo.querySelector("[data-vaga='180001']").getAttribute("aria-pressed"),
    ).toBe("true");
    // O filtro ativo aparece na linha do edital, com o botão para tirar.
    const tirar = resumo.querySelector("[data-acao='todas-as-vagas']");
    expect(tirar.textContent).toContain("Vaga 180001 · Enfermeiro");
    // Filtrada por vaga, a tabela não agrupa.
    expect(secao.querySelector("tr.ui-tabela-grupo")).toBeNull();
    await clicar(tirar);
    expect(linhas()).toHaveLength(6);
    expect(resumo.querySelector("[data-acao='todas-as-vagas']")).toBeNull();
  });

  it("Por vaga: aberto ou fechado fica lembrado por usuário", async () => {
    await montar(supabaseFalso(duasVagas()));
    let porVaga = secao.querySelector("details[data-por-vaga]");
    porVaga.open = true;
    porVaga.dispatchEvent(new Event("toggle"));
    await esperar();
    expect(
      globalThis.localStorage.getItem(
        `monitora.avaliacao-documental.por-vaga-aberto:${EU}`,
      ),
    ).toBe("1");
    await act(async () => painel?.raiz?.unmount());
    secao.remove();
    await montar(supabaseFalso(duasVagas()));
    porVaga = secao.querySelector("details[data-por-vaga]");
    expect(porVaga.open).toBe(true);
  });

  it("todas as vagas: grupo por vaga com o lote e a linha de corte, recolhível", async () => {
    await montar(supabaseFalso(duasVagas()));
    const grupos = () => [
      ...secao.querySelectorAll(
        "[data-tour='avd-fila-tabela'] tr.ui-tabela-grupo",
      ),
    ];
    expect(grupos().map((g) => g.textContent)).toEqual([
      "179698Técnico · lote 4 · linha de corte 26 · 4 nesta lista",
      "180001Enfermeiro · lote 2 (1 pela regra + 1 por decisão) · linha de corte 22 · 2 nesta lista",
    ]);
    await clicar(grupos()[0].querySelector("button"));
    expect(linhas()).toEqual(["8001", "8002"]);
    expect(grupos()).toHaveLength(2);
    await clicar(grupos()[0].querySelector("button"));
    expect(linhas()).toHaveLength(6);
  });

  it("as ações da coordenação ficam num menu; com seleção, o menu mostra a contagem", async () => {
    await montar(supabaseFalso());
    const menu = secao.querySelector(
      "[data-tour='avd-fila-acoes-coordenacao']",
    );
    expect(menu.textContent).toContain("Ações da coordenação");
    expect(secao.querySelector("[data-acao='incluir-por-decisao']")).toBeNull();
    await clicar(secao.querySelector("[aria-label='Selecionar 7002']"));
    expect(menu.querySelector(".ui-contagem").textContent).toBe("1");
    expect(
      secao.querySelector("[data-tour='avd-fila-acoes-lote']").textContent,
    ).toContain("1 selecionada(s)");
    await abrirMenu();
    expect(
      [...menu.querySelectorAll("[role='menuitem']")].map((b) => b.textContent),
    ).toEqual([
      "Incluir por decisão da coordenação",
      "Distribuir as livres (2)",
      "Distribuir as selecionadas (1)",
      "Liberar reservas (0)",
      "Mandar para revisão (1)",
      "Espelhos de nota em massa",
      "Modelo do espelho de nota",
      "Relatório de motivos",
      "Abrir fichas do lote (1)",
    ]);
    expect(menu.querySelector("[data-acao='liberar-reservas']").disabled).toBe(
      true,
    );
  });
});

describe("fila: relatório de motivos", () => {
  it("a coordenação abre o Relatório de motivos pelo menu, com os atalhos", async () => {
    await montar(supabaseFalso());
    await abrirMenu();
    await clicar(secao.querySelector("[data-acao='relatorio-de-motivos']"));
    const gaveta = document.querySelector(
      "[data-tour='avd-relatorio-motivos']",
    );
    expect(gaveta).not.toBeNull();
    expect(gaveta.querySelectorAll("[data-atalho]")).toHaveLength(3);
  });

  it("abrir o relatório, trocar filtros e fechar não redesenham a Fila por trás (nem chamam o banco)", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await abrirMenu();
    renders.zerar();
    await clicar(secao.querySelector("[data-acao='relatorio-de-motivos']"));
    expect(
      document.querySelector("[data-tour='avd-relatorio-motivos']"),
    ).not.toBeNull();
    expect(renders.de("Fila")).toBe(0);
    expect(renders.de("TabelaDaFila")).toBe(0);
    const chamadas = supabase.rpc.mock.calls.length;
    renders.zerar();
    await escolher(document.querySelector("[data-filtro='resultado']"), "APTO");
    await clicar(document.querySelector("[data-filtro='ajustada']"));
    expect(renders.de("Fila")).toBe(0);
    expect(renders.de("RelatorioDeMotivos")).toBe(0);
    expect(supabase.rpc.mock.calls.length).toBe(chamadas);
    renders.zerar();
    await clicar(
      document.querySelector(
        "[data-tour='avd-relatorio-motivos'] .ui-gaveta-fechar",
      ),
    );
    expect(
      document.querySelector("[data-tour='avd-relatorio-motivos']"),
    ).toBeNull();
    expect(renders.de("Fila")).toBe(0);
    expect(renders.de("TabelaDaFila")).toBe(0);
  });
});

describe("fila: reiniciar as fichas do edital (dois administradores)", () => {
  const ADMIN = { getProfile: () => ({ ativo: true, admin_global: true }) };
  const MOTIVO = "A análise foi feita com a regra errada do edital";
  const leitura = (extra = {}) => ({
    schema_version: 1,
    edital: "e93",
    numero: "93/2026",
    validade_horas: 24,
    impacto: {
      concluidas: 1509,
      em_analise: 12,
      com_lancamento: 10,
      iniciadas: 1530,
      exige_aprovacao: true,
    },
    bloqueio: null,
    pedido: null,
    historico: [],
    ...extra,
  });
  const pedido = (extra = {}) => ({
    id: 7,
    situacao: "PENDENTE",
    vencido: false,
    motivo: MOTIVO,
    por: "Beto",
    meu: false,
    em: "2026-10-22T12:00:00Z",
    validade: "2026-10-23T12:00:00Z",
    impacto: { concluidas: 1509, em_analise: 12, iniciadas: 1530 },
    ...extra,
  });
  const erroDoBanco = (message, code) =>
    Object.assign(new Error(message), { code });
  const gaveta = () =>
    document.querySelector("[data-tour='avd-fila-reinicio']");
  const abrirReinicio = async () => {
    await abrirMenu();
    await clicar(secao.querySelector("[data-acao='reiniciar-fichas']"));
    await esperar();
  };

  it("quem não é admin global não vê o menu nem lê o reinício", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await abrirMenu();
    expect(secao.querySelector("[data-acao='reiniciar-fichas']")).toBeNull();
    expect(
      supabase.rpc.mock.calls.some(
        ([nome]) => nome === "obter_reinicio_fichas_do_edital",
      ),
    ).toBe(false);
  });

  it("com fichas concluídas, pede o reinício com motivo e o número do edital", async () => {
    const supabase = supabaseFalso(fila(), {
      obter_reinicio_fichas_do_edital: () => leitura(),
      pedir_reinicio_fichas_do_edital: () =>
        leitura({ pedido: pedido({ meu: true, por: "Ana" }) }),
    });
    await montar(supabase, ADMIN);
    await abrirReinicio();
    const g = gaveta();
    expect(g.textContent).toContain("1.509 concluídas e 12 em análise");
    expect(g.textContent).toContain("Outro administrador global");
    const pedir = g.querySelector("[data-acao='pedir-reinicio']");
    expect(pedir.disabled).toBe(true);
    await digitar(g.querySelector("[data-campo='motivo-do-reinicio']"), MOTIVO);
    await digitar(
      g.querySelector("[data-campo='numero-do-edital']"),
      "93/2025",
    );
    expect(pedir.disabled).toBe(true);
    expect(g.textContent).toContain("Não confere.");
    await digitar(
      g.querySelector("[data-campo='numero-do-edital']"),
      "93/2026",
    );
    expect(pedir.disabled).toBe(false);
    await clicar(pedir);
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith(
      "pedir_reinicio_fichas_do_edital",
      { p_edital: "e93", p_motivo: MOTIVO, p_confirmacao: "93/2026" },
    );
    // Nada de reiniciar direto.
    expect(
      supabase.rpc.mock.calls.some(
        ([nome]) => nome === "reiniciar_fichas_do_edital",
      ),
    ).toBe(false);
    expect(
      gaveta().querySelector("[data-acao='cancelar-pedido-de-reinicio']"),
    ).not.toBeNull();
    expect(secao.querySelector("[data-reinicio='meu-pedido']")).not.toBeNull();
  });

  it("motivo que não parece texto não habilita o pedido", async () => {
    await montar(
      supabaseFalso(fila(), {
        obter_reinicio_fichas_do_edital: () => leitura(),
      }),
      ADMIN,
    );
    await abrirReinicio();
    const g = gaveta();
    await digitar(
      g.querySelector("[data-campo='motivo-do-reinicio']"),
      "dsdfsdfsfsa fdfdf",
    );
    await digitar(
      g.querySelector("[data-campo='numero-do-edital']"),
      "93/2026",
    );
    expect(g.querySelector("[data-acao='pedir-reinicio']").disabled).toBe(true);
    expect(g.textContent).toContain("pelo menos 3 palavras");
  });

  it("outro admin vê o aviso e aprova digitando o número; a fila relê", async () => {
    const supabase = supabaseFalso(fila(), {
      obter_reinicio_fichas_do_edital: () => leitura({ pedido: pedido() }),
      aprovar_reinicio_fichas_do_edital: () => ({
        resultado: { reiniciadas: 1521 },
        reinicio: leitura({ pedido: null }),
      }),
    });
    await montar(supabase, ADMIN);
    const aviso = secao.querySelector("[data-reinicio='aguardando-aprovacao']");
    expect(aviso.textContent).toContain(
      "Reinício pedido por Beto aguardando sua aprovação",
    );
    await clicar(secao.querySelector("[data-acao='ver-pedido-de-reinicio']"));
    await esperar();
    const g = gaveta();
    expect(g.querySelector("[data-motivo-do-pedido]").textContent).toBe(MOTIVO);
    const aprovar = g.querySelector("[data-acao='aprovar-reinicio']");
    expect(aprovar.disabled).toBe(true);
    expect(g.querySelector("[data-acao='recusar-reinicio']").disabled).toBe(
      true,
    );
    await digitar(
      g.querySelector("[data-campo='numero-do-edital']"),
      "093/2026",
    );
    expect(aprovar.disabled).toBe(false);
    const leiturasDaFila = () =>
      supabase.rpc.mock.calls.filter(
        ([nome]) => nome === "obter_fila_avaliacao",
      ).length;
    const antes = leiturasDaFila();
    await clicar(aprovar);
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith(
      "aprovar_reinicio_fichas_do_edital",
      { p_pedido: 7, p_confirmacao: "093/2026" },
    );
    expect(toast).toHaveBeenCalledWith(
      "1521 ficha(s) de volta ao início.",
      "success",
    );
    expect(leiturasDaFila()).toBeGreaterThan(antes);
    expect(gaveta()).toBeNull();
    expect(
      secao.querySelector("[data-reinicio='aguardando-aprovacao']"),
    ).toBeNull();
  });

  it("outro admin recusa com motivo opcional", async () => {
    const supabase = supabaseFalso(fila(), {
      obter_reinicio_fichas_do_edital: () => leitura({ pedido: pedido() }),
      recusar_reinicio_fichas_do_edital: () => leitura(),
    });
    await montar(supabase, ADMIN);
    await clicar(secao.querySelector("[data-acao='ver-pedido-de-reinicio']"));
    await esperar();
    const g = gaveta();
    await digitar(
      g.querySelector("[data-campo='numero-do-edital']"),
      "93/2026",
    );
    await digitar(g.querySelector("[data-campo='motivo-da-recusa']"), "curto");
    expect(g.querySelector("[data-acao='recusar-reinicio']").disabled).toBe(
      true,
    );
    await digitar(g.querySelector("[data-campo='motivo-da-recusa']"), "");
    await clicar(g.querySelector("[data-acao='recusar-reinicio']"));
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith(
      "recusar_reinicio_fichas_do_edital",
      { p_pedido: 7, p_confirmacao: "93/2026", p_motivo: null },
    );
    expect(
      secao.querySelector("[data-reinicio='aguardando-aprovacao']"),
    ).toBeNull();
  });

  it("quem pediu não aprova: só cancela; a recusa do banco aparece", async () => {
    const supabase = supabaseFalso(fila(), {
      obter_reinicio_fichas_do_edital: () =>
        leitura({ pedido: pedido({ meu: true, por: "Ana" }) }),
      cancelar_reinicio_fichas_do_edital: () =>
        erroDoBanco(
          "Este pedido de reinício não está mais pendente (executado).",
          "55000",
        ),
    });
    await montar(supabase, ADMIN);
    expect(
      secao.querySelector("[data-reinicio='aguardando-aprovacao']"),
    ).toBeNull();
    await clicar(secao.querySelector("[data-acao='ver-pedido-de-reinicio']"));
    await esperar();
    const g = gaveta();
    expect(g.querySelector("[data-acao='aprovar-reinicio']")).toBeNull();
    await clicar(g.querySelector("[data-acao='cancelar-pedido-de-reinicio']"));
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith(
      "cancelar_reinicio_fichas_do_edital",
      { p_pedido: 7 },
    );
    expect(g.querySelector("[role='alert']").textContent).toContain(
      "não está mais pendente",
    );
  });

  it("pedido vencido: o aviso some e a gaveta volta a pedir", async () => {
    await montar(
      supabaseFalso(fila(), {
        obter_reinicio_fichas_do_edital: () =>
          leitura({ pedido: pedido({ vencido: true }) }),
      }),
      ADMIN,
    );
    expect(secao.querySelector("[data-reinicio]")).toBeNull();
    await abrirReinicio();
    expect(
      gaveta().querySelector("[data-acao='pedir-reinicio']"),
    ).not.toBeNull();
  });

  it("edital congelado: só a frase do bloqueio, sem botão", async () => {
    await montar(
      supabaseFalso(fila(), {
        obter_reinicio_fichas_do_edital: () =>
          leitura({
            bloqueio:
              "As inscrições deste edital estão congeladas. Libere o congelamento na Pré-classificação antes de reiniciar as fichas.",
          }),
      }),
      ADMIN,
    );
    await abrirReinicio();
    const g = gaveta();
    expect(g.querySelector("[role='alert']").textContent).toContain(
      "congeladas",
    );
    expect(g.querySelector("[data-acao='pedir-reinicio']")).toBeNull();
    expect(g.querySelector("[data-acao='aprovar-reinicio']")).toBeNull();
  });

  it("sem ficha trabalhada: reinicia direto, com um administrador", async () => {
    const supabase = supabaseFalso(fila(), {
      obter_reinicio_fichas_do_edital: () =>
        leitura({
          impacto: {
            concluidas: 0,
            em_analise: 1,
            com_lancamento: 0,
            iniciadas: 1,
            exige_aprovacao: false,
          },
        }),
      reiniciar_fichas_do_edital: () => ({ reiniciadas: 1 }),
    });
    await montar(supabase, ADMIN);
    await abrirReinicio();
    const g = gaveta();
    expect(g.querySelector("[data-acao='pedir-reinicio']")).toBeNull();
    await digitar(g.querySelector("[data-campo='motivo-do-reinicio']"), MOTIVO);
    await digitar(
      g.querySelector("[data-campo='numero-do-edital']"),
      "93/2026",
    );
    await clicar(g.querySelector("[data-acao='reiniciar-direto']"));
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("reiniciar_fichas_do_edital", {
      p_edital: "e93",
      p_motivo: MOTIVO,
    });
    expect(gaveta()).toBeNull();
  });
});

describe("fila leve: o lote em toda leitura, os de fora do lote sob demanda", () => {
  /* schema_version 2 (20261014180000_fila_leve.sql): os eliminados não vêm em "candidatos". */
  function filaLeve(versao = "v1") {
    const base = fila();
    return {
      ...base,
      schema_version: 2,
      candidatos: base.candidatos.filter((c) => c.situacao_pre !== "ELIMINADO"),
      fora_do_lote: {
        total: 1,
        eliminados: 1,
        ranqueados: 0,
        modalidades: ["AC"],
        versao,
      },
    };
  }
  const eliminado = () =>
    fila().candidatos.find((c) => c.situacao_pre === "ELIMINADO");
  const chamadasDeFora = (supabase) =>
    supabase.rpc.mock.calls.filter(
      ([nome]) => nome === "obter_fila_fora_do_lote",
    );

  it("No lote não pede os de fora; Eliminados pede uma vez (em páginas) e guarda", async () => {
    const supabase = supabaseFalso(filaLeve(), {
      obter_fila_fora_do_lote: () => ({
        candidatos: [eliminado()],
        proximo: null,
      }),
    });
    await montar(supabase);
    const etapas = secao.querySelector("[data-tour='avd-fila-etapas']");
    expect(etapas.textContent).toContain("Inscritos5");
    expect(etapas.textContent).toContain("Eliminados1");
    expect(chamadasDeFora(supabase)).toHaveLength(0);

    await clicar(etapas.querySelector("[data-valor='eliminados']"));
    await esperar();
    expect(chamadasDeFora(supabase)).toEqual([
      [
        "obter_fila_fora_do_lote",
        { p_edital: "e93", p_apos: null, p_limite: 2000 },
      ],
    ]);
    expect(linhas()).toEqual(["7009"]);

    await clicar(etapas.querySelector("[data-valor='inscritos']"));
    await esperar();
    expect(linhas()).toEqual(["7001", "7002", "7003", "7004", "7009"]);
    expect(chamadasDeFora(supabase)).toHaveLength(1);
  });

  it("Incluir por decisão lê os de fora do lote antes de abrir", async () => {
    const supabase = supabaseFalso(filaLeve(), {
      obter_fila_fora_do_lote: () => ({
        candidatos: [eliminado()],
        proximo: null,
      }),
    });
    await montar(supabase);
    await abrirMenu();
    await clicar(secao.querySelector("[data-acao='incluir-por-decisao']"));
    await esperar();
    expect(chamadasDeFora(supabase)).toHaveLength(1);
    const opcoes = [
      ...document.querySelectorAll(
        "table[aria-label='Candidatos fora do lote pela regra'] tbody tr",
      ),
    ].map((tr) => tr.dataset.candidato);
    expect(opcoes).toEqual(["7009"]);
  });

  it("estado: lê todas as páginas; só relê quando a versão de fora muda", async () => {
    let versao = "v1";
    const paginas = {
      null: { candidatos: [eliminado()], proximo: "c-7009" },
      "c-7009": {
        candidatos: [{ ...eliminado(), id: "c-7010", codigo: "7010" }],
        proximo: null,
      },
    };
    const supabase = supabaseFalso(undefined, {
      obter_fila_avaliacao: () => filaLeve(versao),
      obter_fila_fora_do_lote: ({ p_apos }) => paginas[String(p_apos)],
    });
    const estado = criarEstadoDaFila({ supabase, toast, armazenamento: null });
    await estado.carregar("e93");
    expect(estado.obter().fora.linhas).toBeNull();
    expect(await estado.carregarForaDoLote()).toBe(true);
    expect(estado.obter().fora.linhas.map((c) => c.codigo)).toEqual([
      "7009",
      "7010",
    ]);
    expect(chamadasDeFora(supabase)).toHaveLength(2);

    await estado.carregar();
    await estado.carregarForaDoLote();
    expect(chamadasDeFora(supabase)).toHaveLength(2);

    versao = "v2";
    await estado.carregar();
    await esperar();
    expect(chamadasDeFora(supabase)).toHaveLength(4);
    expect(estado.obter().fora.versao).toBe("v2");
  });

  it("estado: banco sem a fila leve (sem fora_do_lote) não pede a lista de fora", async () => {
    const supabase = supabaseFalso();
    const estado = criarEstadoDaFila({ supabase, toast, armazenamento: null });
    await estado.carregar("e93");
    expect(await estado.carregarForaDoLote()).toBe(true);
    expect(estado.obter().fora.linhas).toEqual([]);
    expect(chamadasDeFora(supabase)).toHaveLength(0);
  });
});

describe("fila só com o que mudou (20261014231000)", () => {
  /* obter_fila_avaliacao_desde: inteira sem p_desde; depois, parcial. */
  function comDesde(mudou = () => []) {
    const base = fila();
    const leituras = [];
    const supabase = supabaseFalso(base, {
      obter_fila_avaliacao_desde: (args) => {
        leituras.push(args);
        if (!args.p_desde)
          return { ...base, gerado_em: "t0", marca: "m1", parcial: false };
        const { vagas: _vagas, candidatos, ...resto } = base;
        return {
          ...resto,
          gerado_em: `t${leituras.length}`,
          marca: "m1",
          parcial: true,
          candidatos: mudou(candidatos),
          saiu: [],
          total_nucleo: candidatos.length,
        };
      },
      reservar_ficha: ({ p_ficha }) => ({
        ficha: { id: p_ficha, versao: 4, situacao: "EM_ANALISE" },
        reservada: true,
      }),
      pegar_proxima_ficha: () => ({
        ficha: { id: "f3", versao: 3, situacao: "EM_ANALISE" },
        reservada: true,
      }),
    });
    return { supabase, leituras };
  }
  const nomes = (supabase) => supabase.rpc.mock.calls.map(([nome]) => nome);
  const criar = (supabase) =>
    criarEstadoDaFila({
      supabase,
      toast,
      armazenamento: null,
      agendar: () => 0,
      cancelar: () => {},
    });

  it("a primeira leitura é inteira; a seguinte manda o gerado_em e a marca e junta as linhas", async () => {
    const { supabase, leituras } = comDesde((candidatos) => [
      { ...candidatos[0], nome: "Nome novo" },
    ]);
    const estado = criar(supabase);
    await estado.carregar("e93");
    const antes = estado.obter().dados.candidatos;
    await estado.carregar("e93");
    expect(leituras).toEqual([
      { p_edital: "e93", p_desde: null, p_marca: null },
      { p_edital: "e93", p_desde: "t0", p_marca: "m1" },
    ]);
    const depois = estado.obter().dados;
    expect(depois.candidatos).toHaveLength(antes.length);
    expect(depois.candidatos[0].nome).toBe("Nome novo");
    expect(depois.candidatos[1]).toBe(antes[1]);
    expect(depois.vagas).toEqual(fila().vagas);
    expect(depois.gerado_em).toBe("t2");
    expect(nomes(supabase)).not.toContain("obter_fila_avaliacao");
  });

  it("passar de uma ficha a outra não relê a fila; voltar à lista relê só o que mudou", async () => {
    const { supabase, leituras } = comDesde();
    const estado = criar(supabase);
    await estado.carregar("e93");
    await estado.abrir("f2");
    await estado.pegarProxima();
    await estado.abrir("f4");
    expect(leituras).toHaveLength(1);
    expect(estado.estaDesatualizada()).toBe(true);
    // Sair da página (ou desmontar a aba) também não relê.
    await estado.fechar({ reler: false });
    expect(leituras).toHaveLength(1);
    await estado.abrir("f2");
    // "Voltar à fila": a lista aparece e é relida (parcial).
    await estado.fechar({ esquecer: true });
    await esperar();
    expect(leituras).toHaveLength(2);
    expect(leituras[1].p_desde).toBe("t0");
    expect(estado.estaDesatualizada()).toBe(false);
  });

  it("parcial que não bate (linha nova): lê a fila inteira", async () => {
    const { supabase, leituras } = comDesde(() => [
      { id: "c-novo", vaga: "179698", codigo: "7999" },
    ]);
    const estado = criar(supabase);
    await estado.carregar("e93");
    await estado.carregar("e93");
    expect(leituras.map((l) => l.p_desde)).toEqual([null, "t0", null]);
    expect(estado.obter().dados.parcial).toBe(false);
  });

  it("banco sem a RPC nova: a fila de sempre", async () => {
    const ausente = Object.assign(new Error("Could not find"), {
      code: "PGRST202",
    });
    const supabase = supabaseFalso(fila(), {
      obter_fila_avaliacao_desde: () => ausente,
    });
    const estado = criar(supabase);
    await estado.carregar("e93");
    await estado.carregar("e93");
    expect(nomes(supabase)).toEqual([
      "obter_fila_avaliacao_desde",
      "obter_fila_avaliacao",
      "obter_fila_avaliacao",
    ]);
  });
});
