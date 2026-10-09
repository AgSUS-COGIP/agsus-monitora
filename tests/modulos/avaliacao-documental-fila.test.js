import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";
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

  it("resumo do andamento por vaga e do edital; clicar na vaga filtra", async () => {
    await montar(supabaseFalso(duasVagas()));
    const resumo = secao.querySelector("[data-tour='avd-fila-andamento']");
    expect(resumo.querySelector(".avd-andamento-total").textContent).toContain(
      "concluídas 1 de 6 · em análise 1 · pendentes 4",
    );
    const vagas = [...resumo.querySelectorAll("[data-vaga]")];
    expect(vagas.map((b) => b.textContent)).toEqual([
      "179698 Técnicoconcluídas 0 de 4 · em análise 1 · pendentes 3",
      "180001 Enfermeiroconcluídas 1 de 2 · em análise 0 · pendentes 1",
    ]);
    await clicar(vagas[1]);
    expect(linhas()).toEqual(["8001", "8002"]);
    expect(
      resumo.querySelector("[data-vaga='180001']").getAttribute("aria-pressed"),
    ).toBe("true");
    // Filtrada por vaga, a tabela não agrupa.
    expect(secao.querySelector("tr.ui-tabela-grupo")).toBeNull();
    await clicar(secao.querySelector("[data-vaga='180001']"));
    expect(linhas()).toHaveLength(6);
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
      "Abrir fichas do lote (1)",
    ]);
    expect(menu.querySelector("[data-acao='liberar-reservas']").disabled).toBe(
      true,
    );
  });
});

describe("fila: reiniciar as fichas do edital (admin global)", () => {
  it("só o admin global vê; pede motivo e chama a RPC", async () => {
    await montar(supabaseFalso());
    await abrirMenu();
    expect(secao.querySelector("[data-acao='reiniciar-fichas']")).toBeNull();
    document.body.innerHTML = "";

    const supabase = supabaseFalso(fila(), {
      reiniciar_fichas_do_edital: () => ({ reiniciadas: 5 }),
    });
    await montar(supabase, {
      getProfile: () => ({ ativo: true, admin_global: true }),
    });
    await abrirMenu();
    await clicar(secao.querySelector("[data-acao='reiniciar-fichas']"));
    const gaveta = document.querySelector("[data-tour='avd-fila-confirmar']");
    expect(gaveta.textContent).toContain("voltam a Pendente");
    const confirmar = gaveta.querySelector("[data-acao='confirmar-reiniciar']");
    expect(confirmar.disabled).toBe(true);
    await digitar(
      gaveta.querySelector("textarea"),
      "A análise documental foi feita pela planilha",
    );
    await clicar(confirmar);
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("reiniciar_fichas_do_edital", {
      p_edital: "e93",
      p_motivo: "A análise documental foi feita pela planilha",
    });
  });
});
