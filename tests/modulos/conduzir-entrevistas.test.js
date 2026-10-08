import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";
import {
  clicar,
  digitar,
  escolher,
  esperar,
  teclar,
} from "../componentes/interacoes.js";

/*
  "Conduzir entrevistas" (view `conduzir-entrevistas`), o fazer, separado do
  Painel de entrevistas: monta na própria `#page-conduzir-entrevistas`, abre
  pelo render() (a área atual do app; o último edital da área ou o único da
  lista abre sozinho), Fila (Hoje / Próximos / Todos pela agenda salva,
  situações, contador "X de Y hoje", ficha em tela cheia, comemoração ao
  concluir o dia) e Preparar (configuração, convocação, roteiros e o
  desempate só leitura da Classificação).
*/

const { montarConducaoDeEntrevistas } =
  await import("../../src/modulos/entrevistas/conduzir.tsx");
// Preparar baixa sob demanda (lazy): já carregado aqui, o import da tela resolve na hora.
await import("../../src/modulos/entrevistas/preparar.tsx");

let secao;
let tela;
const toast = vi.fn();
const aoMudarResultados = vi.fn();
const aoComemorar = vi.fn();
const HOJE = "2026-10-07";

function memoria() {
  const mapa = new Map();
  return {
    mapa,
    getItem: (chave) => mapa.get(chave) ?? null,
    setItem: (chave, valor) => void mapa.set(chave, String(valor)),
  };
}
let guardado = memoria();

async function montar(
  supabase,
  { abrir = true, comemoracoesLigadas = () => true, ...opcoes } = {},
) {
  secao = document.createElement("section");
  secao.id = "page-conduzir-entrevistas";
  secao.className = "page active";
  document.body.append(secao);
  await act(async () => {
    tela = montarConducaoDeEntrevistas({
      secao,
      supabase,
      toast,
      aoMudarResultados,
      aoComemorar,
      comemoracoesLigadas,
      hojeDe: () => HOJE,
      armazenamento: () => guardado,
      ...opcoes,
    });
  });
  if (abrir) {
    await act(async () => void tela.render());
    await esperar();
  }
  return tela;
}

const naTela = (texto) => document.body.textContent.includes(texto);

beforeEach(() => {
  redefinirDadosDoMonitoramento();
  definirAreaAtual("saude-indigena");
  guardado = memoria();
  localStorage.clear();
});

afterEach(async () => {
  await act(async () => tela?.raiz?.unmount());
  secao?.remove();
  document.body.innerHTML = "";
  redefinirDadosDoMonitoramento();
  toast.mockClear();
  aoMudarResultados.mockClear();
  aoComemorar.mockClear();
});

/*
  Preparar (configuração e convocação), roteiros (versão nova), ficha de
  notas (prévia do parecer, modo AVALIADOR, erros do banco) e o aviso ao
  painel depois de gravar.
*/

const PERFIL_DA_ANA = "11111111-1111-4111-8111-111111111111";

const ROTEIRO = {
  id: "r1",
  origem: "r1",
  versao: 1,
  area: "saude-indigena",
  nome: "Saúde Indígena 2026",
  descricao: null,
  etapa: "Entrevista Individual",
  escala: "NIVEIS",
  passo: 1,
  notas_permitidas: [],
  nota_minima_total: 4,
  notas_eliminatorias: [0, 1],
  ausencia_elimina: true,
  desempate: ["Idade igual ou superior a 60 anos"],
  soma_analise: true,
  convocacao_padrao: {
    multiplo_imediatas: 5,
    posicao_cadastro_reserva: 10,
    excecoes: [],
  },
  banca_padrao: [{ origem: "AgSUS", quantidade: 1 }],
  ativo: true,
  competencias: [
    {
      id: "c1",
      ordem: 1,
      nome: "Políticas públicas",
      descricao: "SUS e SasiSUS",
      nota_maxima: 5,
      peso: 1,
      minimo: 2,
      tipo_minimo: "VALOR",
      avaliacao: "INDIVIDUAL",
    },
    {
      id: "c2",
      ordem: 2,
      nome: "Habilidade interpessoal",
      descricao: null,
      nota_maxima: 5,
      peso: 1,
      minimo: 2,
      tipo_minimo: "VALOR",
      avaliacao: "INDIVIDUAL",
    },
  ],
  niveis: [0, 1, 2, 3, 4, 5].map((nota) => ({
    nota,
    nome: `Nível ${nota}`,
    descricao: `Parâmetro ${nota}`,
  })),
  editais_em_uso: 1,
};

const EDITAL = {
  edital: {
    id: "m1",
    edital: "100/2026",
    unidade: "CASAI Brasília",
    area: "saude-indigena",
  },
  pode_editar: true,
  pode_gerar_lista: true,
  admin_global: false,
  meu_perfil: PERFIL_DA_ANA,
  configuracao: {
    roteiro: ROTEIRO,
    banca: [{ origem: "AgSUS", quantidade: 1 }],
    lancamento: "SECRETARIA",
    atualizado_em: "2026-09-30T12:00:00Z",
  },
  regra_classificacao: {
    versao: 2,
    convocacao: {
      multiplo_vagas: 1,
      posicao_max_cr: 1,
      incluir_empatados: true,
      excecoes: [],
    },
  },
  // A convocação é a lista CONVOCACAO da Classificação (1× 2 vagas: os dois primeiros).
  lista_convocacao: {
    lista: {
      id: "lista1",
      tipo: "CONVOCACAO",
      versao_regra: 2,
      gerada_em: "2026-10-05T13:30:00Z",
      por: "Gestora",
      publicada: false,
    },
    retrato: {
      schema: 1,
      tipo: "CONVOCACAO",
      vagas: [
        {
          chave: "V1",
          codigo: "V1",
          cargo: "Enfermeiro",
          lotacao: "Polo Base",
          cabecalho: "VAGA V1 - Enfermeiro",
          total: 2,
          cadastro_reserva: false,
          origem_das_vagas: "QUADRO",
          limite_convocacao: { limite: 2, origem: "1 × 2 vaga(s)" },
          geral: [1, 2].map((posicao) => ({
            posicao,
            analise_id: `an${posicao}`,
            nome: `Candidato ${posicao}`,
            nota: 90 - posicao,
            modalidades: ["AC"],
          })),
          listas: {},
          eliminados: [
            {
              analise_id: "an3",
              nome: "Candidato 3",
              motivo: "FORA_DO_LIMITE",
            },
          ],
        },
      ],
    },
  },
  avaliadores: [
    {
      id: "a1",
      nome: "Ana",
      origem: "AgSUS",
      banca: 1,
      perfil: PERFIL_DA_ANA,
      ativo: true,
    },
    {
      id: "a2",
      nome: "Beto",
      origem: "CONDISI",
      banca: 1,
      perfil: null,
      ativo: true,
    },
  ],
  convocados: [
    {
      id: "e1",
      analise_id: "an1",
      candidato: "Candidato 1",
      codigo: "K1",
      vaga: "V1",
      cargo: "Enfermeiro",
      modalidade: "Ampla",
      banca: 1,
      compareceu: null,
      nota: null,
      parecer: "SEM_PARECER",
      nota_analise: 89,
      avaliacoes: [],
      notas: [],
    },
  ],
};

function supabaseDaConducao({ edital = EDITAL, respostas = {} } = {}) {
  const padrao = {
    listar_roteiros_entrevista: () => ({ data: [ROTEIRO], error: null }),
    listar_editais_entrevista: () => ({
      data: {
        admin_global: false,
        editais: [
          {
            id: "m1",
            edital: "100/2026",
            unidade: "CASAI Brasília",
            na_janela: true,
            visivel_por: "janela",
          },
        ],
      },
      error: null,
    }),
    obter_entrevistas_do_edital: () => ({ data: edital, error: null }),
    salvar_roteiro_entrevista: (args) => ({
      data: { ...ROTEIRO, id: "r1b", versao: 2, nome: args.p_dados.nome },
      error: null,
    }),
    configurar_entrevista_edital: () => ({ data: edital, error: null }),
    convocar_para_entrevista: () => ({
      data: { convocados: 1, dados: edital },
      error: null,
    }),
    lancar_notas_entrevista: () => ({ data: edital, error: null }),
  };
  return {
    rpc: vi.fn(async (nome, args) => (respostas[nome] || padrao[nome])(args)),
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "u" } } } }),
    },
  };
}

const visao = (valor) =>
  document.querySelector(
    `.ui-topo .entrevistas-visoes button[data-valor="${valor}"]`,
  );
const chamadas = (supabase, nome) =>
  supabase.rpc.mock.calls.filter(([n]) => n === nome);

/* O edital (único na lista) abre sozinho no render(); Preparar mostra os passos. */
async function abrirEdital() {
  await clicar(visao("preparar"));
  await esperar();
  await preparado();
}

/* Preparar baixa sob demanda (lazy): espera os passos aparecerem. */
async function preparado() {
  for (
    let i = 0;
    i < 100 && !document.querySelector(".entrevistas-passos");
    i++
  )
    await esperar(() => new Promise((resolver) => setTimeout(resolver, 10)));
}

/* Preparar: os passos (Roteiro, Banca, Convocação, Agenda) e o corpo do atual. */
const botaoDoPasso = (id) =>
  document.querySelector(`.entrevistas-passos button[data-passo="${id}"]`);
const corpoDoPasso = () =>
  document.querySelector(".entrevistas-preparar-corpo");
async function abrirPasso(id) {
  await preparado();
  await clicar(botaoDoPasso(id));
  await esperar();
  return corpoDoPasso();
}
const convocacao = () => document.querySelector(".entrevistas-convocacao");
const salvarConfiguracao = () =>
  document.querySelector('[data-acao="salvar-configuracao"]');
const editarConfiguracao = () =>
  document.querySelector('[data-acao="editar-configuracao"]');

/* A ficha do primeiro cartão da fila (sem agenda, a fila abre em Todos). */
async function abrirAFicha(id = "e1") {
  await clicar(visao("fila"));
  await esperar();
  await clicar(document.querySelector(`[data-convocado="${id}"]`));
  return document.getElementById("entrevistasFichaDoCandidato");
}

/* A ficha: as células editáveis, as colunas da matriz, a aba escolhida. */
const notas = (ficha) => [...ficha.querySelectorAll("input.entrevistas-nota")];
const colunas = (ficha) =>
  [...ficha.querySelectorAll(".entrevistas-matriz-coluna")].map(
    (c) => c.textContent,
  );
const abaAtiva = () =>
  document.querySelector('[role="tab"][aria-selected="true"]')?.textContent ||
  "";
/* A troca automática de avaliador espera o check aparecer (380 ms). */
const esperarAvanco = () =>
  esperar(() => new Promise((resolver) => setTimeout(resolver, 450)));

/* ── A tela: visões, edital, fila do dia ───────────────────────────── */

const convocado = (n, extra = {}) => ({
  ...EDITAL.convocados[0],
  id: `e${n}`,
  analise_id: `an${n}`,
  candidato: `Candidato ${n}`,
  codigo: `K${n}`,
  ...extra,
});
const todasAsNotas = ["c1", "c2"].flatMap((c) =>
  ["a1", "a2"].map((a) => ({ competencia: c, avaliador: a, nota: 4 })),
);
const EDITAL_DO_DIA = {
  ...EDITAL,
  convocados: [
    convocado(1),
    convocado(2, { compareceu: "S", avaliacoes: [todasAsNotas[0]] }),
    convocado(3, { compareceu: "N", parecer: "INAPTO" }),
    convocado(4, {
      compareceu: "S",
      parecer: "APTO",
      avaliacoes: todasAsNotas,
    }),
    convocado(5),
  ],
};
const AGENDA_DO_DIA = {
  edital: { id: "m1", edital: "100/2026" },
  regra: { versao: 1, configuracao: { bancas: 1 } },
  itens: [
    { analise_id: "an2", data: HOJE, inicio: "09:00", fim: "09:30", banca: 1 },
    { analise_id: "an1", data: HOJE, inicio: "08:00", fim: "08:30", banca: 1 },
    { analise_id: "an3", data: HOJE, inicio: "10:00", fim: "10:30", banca: 1 },
    { analise_id: "an4", data: HOJE, inicio: "11:00", fim: "11:30", banca: 1 },
    {
      analise_id: "an5",
      data: "2026-10-08",
      inicio: "08:00",
      fim: "08:30",
      banca: 1,
    },
  ],
};
const cartoes = () =>
  [...document.querySelectorAll(".entrevistas-fila-cartao")].map((c) => [
    c.dataset.convocado,
    c.dataset.situacao,
  ]);
const contador = () =>
  document.querySelector(".entrevistas-contador-do-dia")?.textContent;

describe("a tela de Conduzir entrevistas", () => {
  it("monta sem pedir nada; o render abre o único edital da lista na Fila", async () => {
    const supabase = supabaseDaConducao();
    await montar(supabase, { abrir: false });
    expect(supabase.rpc).not.toHaveBeenCalled();
    await act(async () => void tela.render());
    await esperar();
    expect(chamadas(supabase, "listar_editais_entrevista")[0][1]).toEqual({
      p_area: "saude-indigena",
      p_todos: false,
    });
    expect(chamadas(supabase, "obter_entrevistas_do_edital")[0][1]).toEqual({
      p_edital: "m1",
    });
    expect(visao("fila").getAttribute("aria-checked")).toBe("true");
    expect(
      [...secao.querySelectorAll(".entrevistas-visoes [role=radio]")].map((b) =>
        b.textContent.trim(),
      ),
    ).toEqual(["Fila", "Preparar"]);
    // Sem agenda salva: a fila abre em Todos, com o convocado.
    expect(cartoes()).toEqual([["e1", "aguardando"]]);
    expect(
      secao.querySelector(".entrevistas-fila-recortes [aria-checked=true]")
        .textContent,
    ).toBe("Todos (1)");
    // As iniciais ignoram números: "Candidato 1" → "CA".
    expect(secao.querySelector(".entrevistas-avatar").textContent).toBe("CA");
    expect(
      guardado.mapa.get("agsus:conduzir-entrevistas:edital:saude-indigena"),
    ).toBe("m1");
  });

  it("com vários editais, abre o último aberto na área (guardado no navegador)", async () => {
    const supabase = supabaseDaConducao({
      respostas: {
        listar_editais_entrevista: () => ({
          data: {
            admin_global: false,
            editais: [
              { id: "m1", edital: "100/2026", unidade: "A", na_janela: true },
              { id: "m2", edital: "101/2026", unidade: "B", na_janela: true },
            ],
          },
          error: null,
        }),
      },
    });
    await montar(supabase);
    expect(chamadas(supabase, "obter_entrevistas_do_edital")).toHaveLength(0);
    expect(naTela("Escolha o edital para ver a fila.")).toBe(true);
    await act(async () => tela.raiz.unmount());
    secao.remove();
    guardado.setItem("agsus:conduzir-entrevistas:edital:saude-indigena", "m2");
    await montar(supabase);
    expect(chamadas(supabase, "obter_entrevistas_do_edital").at(-1)[1]).toEqual(
      {
        p_edital: "m2",
      },
    );
  });

  it("Fila: abre em Hoje pela agenda, com situações, contador e recortes", async () => {
    const supabase = supabaseDaConducao({
      edital: EDITAL_DO_DIA,
      respostas: {
        obter_agenda_entrevista: () => ({ data: AGENDA_DO_DIA, error: null }),
      },
    });
    await montar(supabase);
    expect(cartoes()).toEqual([
      ["e1", "aguardando"],
      ["e2", "em_andamento"],
      ["e3", "faltou"],
      ["e4", "concluida"],
    ]);
    expect(contador()).toBe("2 de 4 hoje");
    expect(
      [
        ...secao.querySelectorAll(".entrevistas-fila-recortes [role=radio]"),
      ].map((b) => b.textContent),
    ).toEqual(["Hoje (4)", "Próximos (1)", "Todos (5)"]);
    await clicar(
      secao.querySelector(".entrevistas-fila-resumo [data-situacao='faltou']"),
    );
    expect(cartoes()).toEqual([["e3", "faltou"]]);
    await clicar(
      secao.querySelector(".entrevistas-fila-resumo [data-situacao='faltou']"),
    );
    await clicar(
      secao.querySelector(".entrevistas-fila-recortes [data-valor='proximos']"),
    );
    expect(cartoes()).toEqual([["e5", "aguardando"]]);
    // Fora de Hoje, o dia fica no cartão; o cabeçalho é o da vaga.
    expect(secao.querySelector(".entrevistas-fila-hora").textContent).toContain(
      "Amanhã",
    );
    expect(secao.querySelector(".entrevistas-fila-vaga").textContent).toBe(
      "V1 · Enfermeiro1",
    );
  });

  it("a ficha abre do cartão; Salvar e abrir o próximo segue a fila; concluir o dia comemora uma vez", async () => {
    let dados = {
      ...EDITAL_DO_DIA,
      convocados: EDITAL_DO_DIA.convocados.map((c) =>
        c.id === "e1" || c.id === "e2" ? { ...c, compareceu: "N" } : c,
      ),
    };
    // Hoje: e1 e e3 faltaram, e4 concluída, e2 aguardando (3 de 4).
    dados = {
      ...dados,
      convocados: dados.convocados.map((c) =>
        c.id === "e2"
          ? { ...c, compareceu: null, parecer: "SEM_PARECER", avaliacoes: [] }
          : c,
      ),
    };
    const supabase = supabaseDaConducao({
      edital: dados,
      respostas: {
        obter_agenda_entrevista: () => ({ data: AGENDA_DO_DIA, error: null }),
        lancar_notas_entrevista: () => ({
          data: {
            ...dados,
            convocados: dados.convocados.map((c) =>
              c.id === "e2" ? { ...c, compareceu: "N", parecer: "INAPTO" } : c,
            ),
          },
          error: null,
        }),
      },
    });
    await montar(supabase);
    expect(contador()).toBe("3 de 4 hoje");
    expect(aoComemorar).not.toHaveBeenCalled();
    await clicar(document.querySelector('[data-convocado="e2"]'));
    const ficha = document.getElementById("entrevistasFichaDoCandidato");
    expect(ficha).not.toBeNull();
    expect(document.querySelector(".ui-topo")).toBeNull();
    await clicar(
      ficha.querySelector('.entrevistas-comparecimento button[data-valor="N"]'),
    );
    const proximo = [...ficha.querySelectorAll("button")].find((b) =>
      b.textContent.includes("Salvar e abrir o próximo"),
    );
    await clicar(proximo);
    await esperar();
    expect(chamadas(supabase, "lancar_notas_entrevista")[0][1]).toMatchObject({
      p_entrevista: "e2",
      p_dados: { compareceu: "N" },
    });
    // O próximo da fila de hoje (por horário) é e3.
    expect(
      document.getElementById("entrevistasFichaTitulo").textContent,
    ).toContain("Candidato 3");
    expect(aoComemorar).toHaveBeenCalledTimes(1);
    expect(aoComemorar.mock.calls[0][0]).toMatchObject({
      texto: "Entrevistas de hoje concluídas: 4 de 4!",
      forma: "check",
    });
    await clicar(document.querySelector('[data-acao="voltar-a-lista"]'));
    expect(contador()).toBe("4 de 4 hoje");
    expect(
      document.querySelector(".entrevistas-contador-do-dia").dataset.completo,
    ).toBe("sim");
  });

  it("comemorações desligadas: concluir o dia não solta os fogos", async () => {
    const dados = {
      ...EDITAL_DO_DIA,
      convocados: EDITAL_DO_DIA.convocados.map((c) =>
        c.id === "e1" ? { ...c, compareceu: "N" } : c.id === "e2" ? c : c,
      ),
    };
    const supabase = supabaseDaConducao({
      edital: dados,
      respostas: {
        obter_agenda_entrevista: () => ({ data: AGENDA_DO_DIA, error: null }),
        lancar_notas_entrevista: () => ({
          data: {
            ...dados,
            convocados: dados.convocados.map((c) =>
              c.id === "e2" ? { ...c, compareceu: "N", parecer: "INAPTO" } : c,
            ),
          },
          error: null,
        }),
      },
    });
    await montar(supabase, { comemoracoesLigadas: () => false });
    await clicar(document.querySelector('[data-convocado="e2"]'));
    await clicar(
      document
        .getElementById("entrevistasFichaDoCandidato")
        .querySelector('.entrevistas-comparecimento button[data-valor="N"]'),
    );
    await clicar(
      document
        .getElementById("entrevistasFichaDoCandidato")
        .querySelector('button[type="submit"]'),
    );
    await esperar();
    expect(chamadas(supabase, "lancar_notas_entrevista")).toHaveLength(1);
    expect(aoComemorar).not.toHaveBeenCalled();
  });

  it("as visões trocam pelo teclado (setas), como um radiogroup", async () => {
    await montar(supabaseDaConducao());
    visao("fila").focus();
    await teclar(visao("fila"), "ArrowRight");
    await esperar();
    expect(visao("preparar").getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(visao("preparar"));
    await preparado();
    expect(
      [...document.querySelectorAll(".entrevistas-passos button")].map(
        (b) => b.dataset.passo,
      ),
    ).toEqual(["roteiro", "banca", "convocacao", "agenda"]);
    await abrirPasso("roteiro");
    expect(naTela("Roteiros da área")).toBe(true);
  });

  it("links antigos: a visão Roteiros vira Preparar; link com edital abre o edital na Fila", async () => {
    const supabase = supabaseDaConducao();
    await montar(supabase);
    await act(async () => tela.abrirVisao("roteiros"));
    expect(visao("preparar").getAttribute("aria-checked")).toBe("true");
    await abrirPasso("roteiro");
    expect(document.querySelector('[data-roteiro="r1"]')).not.toBeNull();
    await act(async () => tela.abrirVisao("conduzir"));
    expect(visao("fila").getAttribute("aria-checked")).toBe("true");
    await act(async () => tela.abrirEdital("m1"));
    expect(chamadas(supabase, "obter_entrevistas_do_edital")).toHaveLength(1);
  });

  it("Preparar mostra o desempate da regra de classificação, só leitura, com Editar na Classificação", async () => {
    const edital = {
      ...EDITAL,
      regra_classificacao: {
        ...EDITAL.regra_classificacao,
        desempate: [
          { criterio: "IDOSO_60", direcao: "SIM_PRIMEIRO" },
          { criterio: "NOTA_ENTREVISTA", direcao: "MAIOR_PRIMEIRO" },
        ],
        empate_final: { metodo: "SORTEIO" },
      },
    };
    await montar(supabaseDaConducao({ edital }));
    await abrirEdital();
    // Em linguagem simples no resumo; os critérios técnicos em "Ver detalhes".
    expect(
      document.querySelector('.entrevistas-regras [data-bloco="desempate"]')
        .textContent,
    ).toContain(
      "Se a nota final empatar, vale, nesta ordem: 1º 60 anos ou mais na data de corte; 2º maior pontuação na entrevista. Se ainda empatar: sorteio registrado.",
    );
    const bloco = document.querySelector(
      '.entrevistas-regras-detalhes [data-bloco="desempate-da-classificacao"]',
    );
    expect(
      [...bloco.querySelectorAll("li")].map((li) => li.textContent),
    ).toEqual([
      "60 anos ou mais na data de corte",
      "Maior pontuação na entrevista",
      "Sorteio registrado",
    ]);
    // No editor do roteiro: os mesmos critérios, sem campo de texto, com o atalho.
    await abrirPasso("roteiro");
    const editar = [
      ...document.querySelectorAll('[data-roteiro="r1"] button'),
    ].find((b) => b.textContent.includes("Editar"));
    await clicar(editar);
    const editor = document.getElementById("entrevistasEditorDeRoteiro");
    const doEditor = editor.querySelector(
      '[data-bloco="desempate-da-classificacao"]',
    );
    expect(doEditor.textContent).toContain("60 anos ou mais na data de corte");
    expect(doEditor.querySelector("input")).toBeNull();
    expect(
      doEditor.querySelector('[data-ir-para="classificacao"]').textContent,
    ).toBe("Editar na Classificação");
    expect(
      editor.querySelector('[aria-label="Critérios de desempate"]'),
    ).toBeNull();
  });

  it("salvar o roteiro repassa o desempate antigo sem mudar (a coluna fica no banco)", async () => {
    const supabase = supabaseDaConducao();
    await montar(supabase);
    await abrirEdital();
    await abrirPasso("roteiro");
    await clicar(
      [...document.querySelectorAll('[data-roteiro="r1"] button')].find((b) =>
        b.textContent.includes("Editar"),
      ),
    );
    const editor = document.getElementById("entrevistasEditorDeRoteiro");
    await clicar(editor.querySelector('button[type="submit"]'));
    await esperar();
    const [[, { p_dados }]] = chamadas(supabase, "salvar_roteiro_entrevista");
    expect(p_dados.desempate).toEqual(["Idade igual ou superior a 60 anos"]);
  });

  it("trocar a área: o edital sai e os editais da nova área são lidos", async () => {
    const supabase = supabaseDaConducao();
    await montar(supabase);
    expect(document.querySelector('[data-convocado="e1"]')).not.toBeNull();
    await act(async () => definirAreaAtual("projetos"));
    await esperar();
    expect(document.querySelector('[data-convocado="e1"]')).toBeNull();
    expect(chamadas(supabase, "listar_editais_entrevista").at(-1)[1]).toEqual({
      p_area: "projetos",
      p_todos: false,
    });
  });

  it("Atualizar relê os editais e o edital aberto", async () => {
    const supabase = supabaseDaConducao();
    await montar(supabase);
    const antes = {
      editais: chamadas(supabase, "listar_editais_entrevista").length,
      edital: chamadas(supabase, "obter_entrevistas_do_edital").length,
    };
    await clicar(secao.querySelector('[data-acao="atualizar"]'));
    await esperar();
    expect(chamadas(supabase, "listar_editais_entrevista").length).toBe(
      antes.editais + 1,
    );
    expect(chamadas(supabase, "obter_entrevistas_do_edital").length).toBe(
      antes.edital + 1,
    );
  });

  it("edital sem configuração: a Fila avisa e leva ao Preparar", async () => {
    await montar(
      supabaseDaConducao({ edital: { ...EDITAL, configuracao: null } }),
    );
    expect(
      naTela(
        "A entrevista deste edital ainda não foi preparada (roteiro e banca).",
      ),
    ).toBe(true);
    await clicar(
      [...document.querySelectorAll(".ui-aviso button")].find(
        (b) => b.textContent === "Preparar",
      ),
    );
    expect(visao("preparar").getAttribute("aria-checked")).toBe("true");
    // Sem configuração, Preparar abre no passo 1, já com o roteiro para escolher.
    expect(corpoDoPasso().dataset.passoAtual).toBe("roteiro");
    expect(
      document.querySelector('[data-campo="roteiro-do-edital"]'),
    ).not.toBeNull();
    expect(corpoDoPasso().textContent).toContain(
      "Escolha o roteiro da entrevista.",
    );
  });
});

describe("Preparar, roteiros e ficha", () => {
  it("editar um roteiro grava a versão seguinte, com a prévia e o +50%", async () => {
    const supabase = supabaseDaConducao();
    await montar(supabase);
    await clicar(visao("preparar"));
    await esperar();
    await abrirPasso("roteiro");
    const editar = [
      ...document.querySelectorAll('[data-roteiro="r1"] button'),
    ].find((b) => b.textContent.includes("Editar (cria versão 2)"));
    await clicar(editar);
    const editor = document.getElementById("entrevistasEditorDeRoteiro");
    expect(editor).not.toBeNull();
    expect(
      document.getElementById("entrevistasPreviaDoRoteiro").textContent,
    ).toBe("Pontuação máxima 10 · mínimo 4");
    const peso = editor.querySelectorAll(
      'li[data-competencia="1"] input[type="number"]',
    )[1];
    await digitar(peso, "1.5");
    expect(editor.textContent).toContain("+50% sobre a média da banca");
    expect(
      document.getElementById("entrevistasPreviaDoRoteiro").textContent,
    ).toBe("Pontuação máxima 12,5 · mínimo 4");
    await clicar(editor.querySelector('button[type="submit"]'));
    await esperar();
    const [[, { p_dados }]] = chamadas(supabase, "salvar_roteiro_entrevista");
    expect(p_dados.origem).toBe("r1");
    expect(p_dados.competencias[0].peso).toBe(1.5);
    expect(p_dados.niveis).toHaveLength(6);
    expect(document.getElementById("entrevistasEditorDeRoteiro")).toBeNull();
    expect(chamadas(supabase, "listar_roteiros_entrevista").length).toBe(2);
  });

  it("formulário inválido não chama o banco", async () => {
    const supabase = supabaseDaConducao();
    await montar(supabase);
    await clicar(visao("preparar"));
    await esperar();
    await abrirPasso("roteiro");
    await clicar(document.getElementById("entrevistasNovoRoteiro"));
    const editor = document.getElementById("entrevistasEditorDeRoteiro");
    await clicar(editor.querySelector('button[type="submit"]'));
    expect(editor.textContent).toContain("Nome do roteiro: de 3 a 150");
    // A lista do que falta, perto do Salvar, abre a seção do erro.
    const pendencias = editor.querySelector(
      ".entrevistas-pendencias-do-roteiro",
    );
    expect(pendencias.getAttribute("role")).toBe("alert");
    expect(pendencias.textContent).toContain("Faltam");
    expect(editor.querySelector('[data-secao="identificacao"]').open).toBe(
      true,
    );
    expect(chamadas(supabase, "salvar_roteiro_entrevista")).toHaveLength(0);
  });

  it("convoca os da lista de convocação da Classificação (com o id da lista) e relê os resultados", async () => {
    const supabase = supabaseDaConducao();
    await montar(supabase);
    await abrirEdital();
    expect(chamadas(supabase, "obter_entrevistas_do_edital")[0][1]).toEqual({
      p_edital: "m1",
    });
    // Com a lista registrada, o cálculo da Classificação nem é pedido.
    expect(chamadas(supabase, "obter_classificacao_do_edital")).toHaveLength(0);
    await abrirPasso("convocacao");
    const passo = convocacao();
    expect(passo.dataset.fonte).toBe("LISTA");
    expect(passo.textContent).toContain(
      "Lista de convocação da Classificação · gerada em 05/10/2026, 10:30 por Gestora · regra v2",
    );
    const caixas = passo.querySelectorAll('input[type="checkbox"]');
    // Só os dois da lista (o 3º está entre os eliminados); o 1º já está na ficha.
    expect([...caixas].map((c) => [c.checked, c.disabled])).toEqual([
      [true, true],
      [true, false],
    ]);
    expect(passo.textContent).toContain(
      "2 vagas imediatas · até a 2ª (1 × 2 vaga(s))",
    );
    // O passo diz o que falta: 1 da lista ainda não convocado.
    expect(corpoDoPasso().textContent).toContain(
      "1 candidato da lista ainda não foi convocado.",
    );
    expect(passo.textContent).not.toContain("Candidato 3");
    expect(passo.textContent).not.toContain("Além da regra");
    await clicar(document.getElementById("entrevistasConvocar"));
    await esperar();
    expect(chamadas(supabase, "convocar_para_entrevista")[0][1]).toEqual({
      p_edital: "m1",
      p_lista: "lista1",
      p_analises: ["an2"],
    });
    expect(aoMudarResultados).toHaveBeenCalledTimes(1);
  });

  it("a lista mudou na Classificação (40001): avisa e relê o edital", async () => {
    const supabase = supabaseDaConducao({
      respostas: {
        convocar_para_entrevista: () => ({
          data: null,
          error: {
            code: "40001",
            message: "A lista de convocação mudou na Classificação; recarregue",
          },
        }),
      },
    });
    await montar(supabase);
    await abrirEdital();
    await abrirPasso("convocacao");
    await clicar(document.getElementById("entrevistasConvocar"));
    await esperar();
    expect(toast).toHaveBeenCalledWith(
      "A lista de convocação mudou na Classificação; recarregue",
      "error",
    );
    expect(chamadas(supabase, "obter_entrevistas_do_edital")).toHaveLength(2);
  });

  it("regras da entrevista: resumo simples com Editar; regra e vagas técnicas em Ver detalhes; sem digitar vagas", async () => {
    await montar(supabaseDaConducao());
    await abrirEdital();
    const regras = document.querySelector(".entrevistas-regras");
    const bloco = (id) => regras.querySelector(`[data-bloco="${id}"]`);
    expect(bloco("convocacao").textContent).toContain(
      "Até 1 pessoa por vaga imediata; nas vagas só de cadastro reserva, até a 1ª posição; quem empatar com o último chamado também entra.",
    );
    expect(
      [...bloco("convocacao").querySelectorAll("tbody td")].map(
        (td) => td.textContent,
      ),
    ).toEqual(["EnfermeiroV1", "2", "até a 2ª"]);
    expect(bloco("nota").textContent).toContain(
      "Cada avaliador dá uma nota de 0 a 5 em cada uma das 2 competências.",
    );
    expect(bloco("nota").textContent).toContain(
      "Abaixo de 2 em qualquer competência ou com média 0 ou 1 em alguma competência ou abaixo de 4 no total, o candidato fica inapto.",
    );
    expect(bloco("banca").textContent).toContain(
      "Banca 1 — Ana (AgSUS) avalia todas as competências; Beto (CONDISI) avalia todas as competências.",
    );
    // "Editar" de quem avalia abre a configuração; o da nota abre o roteiro do edital.
    await clicar(bloco("banca").querySelector('[data-ir-para="configuracao"]'));
    expect(corpoDoPasso().dataset.passoAtual).toBe("banca");
    expect(
      corpoDoPasso().querySelectorAll(".entrevistas-linha-membro"),
    ).toHaveLength(2);
    await clicar(bloco("nota").querySelector('[data-ir-para="roteiro"]'));
    expect(
      document.getElementById("entrevistasEditorDeRoteiro"),
    ).not.toBeNull();
    const passo = regras.querySelector(".entrevistas-regras-detalhes");
    expect(passo.textContent).toContain(
      "Classificação, regra v2: 1× as vagas imediatas · até a 1ª no cadastro reserva",
    );
    const linha = document.querySelector(
      '#entrevistasVagas tr[data-vaga="V1"]',
    );
    expect(
      [...linha.querySelectorAll("td")].map((td) => td.textContent),
    ).toEqual([
      "V1",
      "EnfermeiroPolo Base",
      "2 vagas imediatas",
      "até a 2ª (1 × 2 vaga(s))",
      "quadro de vagas do editalEditais",
    ]);
    expect(linha.querySelector('[data-ir-para="nucleo"]')).not.toBeNull();
    expect(
      passo.querySelector('[data-ir-para="classificacao"]').textContent,
    ).toBe("Regra na Classificação");
    const configuracao = corpoDoPasso();
    expect(
      configuracao.querySelector('input[aria-label^="Vagas imediatas"]'),
    ).toBeNull();
    expect(configuracao.textContent).not.toContain(
      "Múltiplo das vagas imediatas",
    );
  });

  it("avaliador por competência: a configuração grava só estas, valida a cobertura e a ficha mostra só o atribuído", async () => {
    const supabase = supabaseDaConducao();
    await montar(supabase);
    await abrirEdital();
    const passo = await abrirPasso("banca");
    await clicar(editarConfiguracao());
    const membros = passo.querySelectorAll(".entrevistas-linha-membro");
    // Beto: só "Habilidade interpessoal".
    await clicar(membros[1].querySelector('button[data-valor="algumas"]'));
    await clicar(
      [...membros[1].querySelectorAll("label")]
        .find((l) => l.textContent.includes("Habilidade interpessoal"))
        .querySelector("input"),
    );
    // Ana só em "Políticas públicas" cobre tudo (Beto avalia a outra); desmarcar deixa sem ninguém.
    await clicar(membros[0].querySelector('button[data-valor="algumas"]'));
    await clicar(
      [...membros[0].querySelectorAll("label")]
        .find((l) => l.textContent.includes("Políticas públicas"))
        .querySelector("input"),
    );
    expect(passo.textContent).not.toContain("ninguém avalia");
    await clicar(
      [...membros[0].querySelectorAll("label")]
        .find((l) => l.textContent.includes("Políticas públicas"))
        .querySelector("input"),
    );
    expect(passo.textContent).toContain(
      "Banca 1: ninguém avalia “Políticas públicas”.",
    );
    await clicar(salvarConfiguracao());
    expect(chamadas(supabase, "configurar_entrevista_edital")).toHaveLength(0);
    // O que falta fica na lista perto do Salvar.
    expect(
      passo.querySelector(".entrevistas-pendencias").textContent,
    ).toContain("Banca 1: ninguém avalia “Políticas públicas”.");
    await clicar(membros[0].querySelector('button[data-valor="todas"]'));
    await clicar(salvarConfiguracao());
    await esperar();
    const [[, argumentos]] = chamadas(supabase, "configurar_entrevista_edital");
    expect(argumentos.p_dados.avaliadores.map((a) => a.competencias)).toEqual([
      null,
      ["c2"],
    ]);
  });

  it("ficha com avaliador por competência: esmaece o que não é dele, conta só o atribuído e calcula só com quem avalia", async () => {
    const edital = {
      ...EDITAL,
      avaliadores: [
        EDITAL.avaliadores[0],
        { ...EDITAL.avaliadores[1], competencias: ["c2"] },
      ],
    };
    await montar(supabaseDaConducao({ edital }));
    const ficha = await abrirAFicha();
    expect(
      [...ficha.querySelectorAll('[role="tab"]')].map((t) => t.textContent),
    ).toEqual(["AnaAgSUS0/2", "BetoCONDISI0/1"]);
    await clicar(ficha.querySelector('[role="tab"][data-aba="a2"]'));
    const linhas = ficha.querySelectorAll(".entrevistas-matriz-linha");
    expect(linhas[0].dataset.atribuida).toBe("nao");
    expect(linhas[0].textContent).toContain("avaliada por Ana");
    expect(notas(ficha)).toHaveLength(1);
    expect(ficha.textContent).toContain("0 de 3 notas");
    // Por competência: em "Políticas públicas", só a Ana.
    await clicar(ficha.querySelector('button[data-valor="competencia"]'));
    await clicar(ficha.querySelector('[role="tab"][data-aba="c1"]'));
    expect(
      [...ficha.querySelectorAll(".entrevistas-matriz-titulo span")].map(
        (s) => s.textContent,
      ),
    ).toEqual(["Ana"]);
  });

  it("sem lista gerada: o cálculo atual com aviso e atalho para gerar; não convoca", async () => {
    const UUID = "11111111-2222-4333-8444-555555555555";
    const edital = {
      ...EDITAL,
      edital: { ...EDITAL.edital, id: UUID },
      lista_convocacao: null,
    };
    const supabase = supabaseDaConducao({
      edital,
      respostas: {
        obter_classificacao_do_edital: () => ({
          data: {
            edital: { id: UUID, edital: "100/2026", unidade: "CASAI Brasília" },
            regra: {
              versao: 2,
              configuracao: {
                convocacao: { multiplo_vagas: 1, posicao_max_cr: 1 },
              },
            },
            quadro: [
              {
                id: "q1",
                ordem: 1,
                cargo: "Enfermeiro",
                vagas_imediatas: 1,
                cadastro_reserva: false,
                modalidades: {},
              },
            ],
            candidatos: [1, 2, 3].map((n) => ({
              analise_id: `an${n}`,
              nome: `Candidato ${n}`,
              vaga: "V1",
              cargo: "Enfermeiro",
              status: "Aprovado",
              nota_documental: 90 - n,
              quadro: "q1",
            })),
            entrevistas: [],
            cronograma: [],
            desempates: [],
            ajustes: [],
          },
          error: null,
        }),
        listar_configuracao_convocacao: () => ({ data: [], error: null }),
        listar_modelos_convocacao: () => ({ data: [], error: null }),
      },
    });
    await montar(supabase);
    window.navigate = vi.fn();
    window.classificacaoController = {
      estado: { escolherEdital: vi.fn(async () => true) },
    };
    try {
      await abrirEdital();
      expect(chamadas(supabase, "obter_classificacao_do_edital")[0][1]).toEqual(
        { p_edital: "m1" },
      );
      await abrirPasso("convocacao");
      const passo = convocacao();
      expect(passo.dataset.fonte).toBe("CALCULO");
      expect(passo.textContent).toContain(
        "Lista ainda não gerada na Classificação",
      );
      // 1× 1 vaga: só o primeiro.
      expect(passo.textContent).toContain("Candidato 1");
      expect(passo.textContent).not.toContain("Candidato 2");
      expect(document.getElementById("entrevistasConvocar")).toBeNull();
      await clicar(
        [...passo.querySelectorAll("button")].find(
          (b) => b.textContent === "Gerar na Classificação",
        ),
      );
      expect(window.navigate).toHaveBeenCalledWith("classificacao");
      expect(
        window.classificacaoController.estado.escolherEdital,
      ).toHaveBeenCalledWith(UUID);
    } finally {
      delete window.navigate;
      delete window.classificacaoController;
    }
  });

  it("sem lista e sem acesso à Classificação: avisa, sem cálculo nem convocação", async () => {
    const supabase = supabaseDaConducao({
      edital: { ...EDITAL, lista_convocacao: null, pode_gerar_lista: false },
      respostas: {
        obter_classificacao_do_edital: () => ({
          data: null,
          error: { code: "42501", message: "Sem permissão" },
        }),
      },
    });
    await montar(supabase);
    await abrirEdital();
    await abrirPasso("convocacao");
    const passo = convocacao();
    expect(passo.dataset.fonte).toBe("NENHUMA");
    expect(passo.textContent).toContain(
      "Lista ainda não gerada na Classificação.",
    );
    expect(passo.textContent).toContain(
      "Seu acesso não inclui a Classificação deste edital.",
    );
    expect(passo.textContent).not.toContain("Gerar na Classificação");
    expect(document.getElementById("entrevistasConvocar")).toBeNull();
    // O convocado de antes continua (fora da lista vigente), e na fila também.
    expect(passo.textContent).toContain("Fora da lista vigente");
    await clicar(visao("fila"));
    expect(document.querySelector('[data-convocado="e1"]')).not.toBeNull();
  });

  it("salva a configuração com o modo de lançamento e a banca", async () => {
    const supabase = supabaseDaConducao();
    await montar(supabase);
    await abrirEdital();
    expect((await abrirPasso("roteiro")).textContent).toContain(
      "Saúde Indígena 2026",
    );
    const passo = await abrirPasso("banca");
    await clicar(editarConfiguracao());
    await clicar(passo.querySelector('button[data-valor="AVALIADOR"]'));
    await clicar(salvarConfiguracao());
    await esperar();
    const [[, argumentos]] = chamadas(supabase, "configurar_entrevista_edital");
    expect(argumentos.p_edital).toBe("m1");
    expect(argumentos.p_dados).not.toHaveProperty("vagas");
    expect(argumentos.p_dados).not.toHaveProperty("convocacao");
    expect(argumentos.p_dados).toMatchObject({
      roteiro: "r1",
      lancamento: "AVALIADOR",
      avaliadores: [
        {
          id: "a1",
          nome: "Ana",
          origem: "AgSUS",
          banca: 1,
          perfil: PERFIL_DA_ANA,
        },
        { id: "a2", nome: "Beto", origem: "CONDISI", banca: 1, perfil: null },
      ],
    });
  });

  it("ficha de notas: prévia do parecer, gravação e erro do banco", async () => {
    let falhar = true;
    const supabase = supabaseDaConducao({
      respostas: {
        lancar_notas_entrevista: () =>
          falhar
            ? {
                data: null,
                error: { code: "22023", message: "Nota 7 fora da faixa" },
              }
            : { data: EDITAL, error: null },
      },
    });
    await montar(supabase);
    await abrirEdital();
    const ficha = await abrirAFicha();
    // Por avaliador (padrão): a aba da Ana, uma coluna "Nota", uma linha por competência.
    expect(abaAtiva()).toContain("Ana");
    expect(colunas(ficha)).toEqual(["Nota"]);
    let celulas = notas(ficha);
    expect(celulas).toHaveLength(2);
    // Legenda da escala numa linha.
    expect(ficha.querySelector(".entrevistas-legenda").textContent).toContain(
      "3 Nível 3",
    );
    await clicar(
      ficha.querySelector('.entrevistas-comparecimento button[data-valor="S"]'),
    );
    for (const celula of celulas) await digitar(celula, "3");
    // Ana completa: a aba ganha o check e a ficha passa sozinha ao Beto.
    await esperarAvanco();
    expect(abaAtiva()).toContain("Beto");
    expect(
      ficha.querySelector('[data-aba="a1"] .entrevistas-aba-da-ficha-check'),
    ).not.toBeNull();
    // Faltam as notas do Beto: a lateral é só uma prévia, em tom neutro.
    const cartao = () => ficha.querySelector(".entrevistas-parecer");
    expect(cartao().dataset.tom).toBe("neutro");
    expect(cartao().dataset.previa).toBe("sim");
    expect(cartao().textContent).toBe("PréviaApto · faltam 2 notas");
    celulas = notas(ficha);
    for (const celula of celulas) await digitar(celula, "3");
    // Tudo lançado: o parecer fica definitivo, na cor dele.
    expect(cartao().dataset.tom).toBe("ok");
    expect(cartao().dataset.previa).toBeUndefined();
    expect(cartao().textContent).toBe("ParecerApto");
    expect(
      document.getElementById("entrevistasFichaTotal").textContent,
    ).toContain("6");
    expect(document.getElementById("entrevistasFichaParecer").textContent).toBe(
      "Apto",
    );
    expect(ficha.querySelector(".entrevistas-progresso").textContent).toContain(
      "4 de 4 notas",
    );
    // Por competência: a aba de "Políticas públicas", os dois avaliadores nas linhas.
    await clicar(
      ficha.querySelector(
        '.entrevistas-modo-da-ficha [data-valor="competencia"]',
      ),
    );
    expect(abaAtiva()).toContain("Políticas públicas");
    celulas = notas(ficha);
    expect(celulas.map((c) => c.getAttribute("aria-label"))).toEqual([
      "Nota de Ana em Políticas públicas",
      "Nota de Beto em Políticas públicas",
    ]);
    await digitar(celulas[0], "1");
    await digitar(celulas[1], "1");
    expect(document.getElementById("entrevistasFichaParecer").textContent).toBe(
      "Inapto",
    );
    expect(ficha.textContent).toContain("é eliminatória");
    expect(
      ficha.querySelector(
        '.entrevistas-notas-da-banca li[data-situacao="abaixo"]',
      ),
    ).not.toBeNull();

    await clicar(ficha.querySelector('button[type="submit"]'));
    await esperar();
    expect(ficha.textContent).toContain("Dado inválido: Nota 7 fora da faixa.");
    const [[, argumentos]] = chamadas(supabase, "lancar_notas_entrevista");
    expect(argumentos.p_entrevista).toBe("e1");
    expect(argumentos.p_dados.compareceu).toBe("S");
    expect(argumentos.p_dados.notas).toHaveLength(4);
    expect(argumentos.p_dados.notas).toContainEqual({
      competencia: "c1",
      avaliador: "a1",
      nota: 1,
    });

    expect(aoMudarResultados).not.toHaveBeenCalled();
    falhar = false;
    await clicar(ficha.querySelector('button[type="submit"]'));
    await esperar();
    expect(aoMudarResultados).toHaveBeenCalledTimes(1);
  });

  it("ficha pelo teclado: o dígito lança e avança, Enter anda, Ctrl+Enter salva", async () => {
    const supabase = supabaseDaConducao();
    await montar(supabase);
    await abrirEdital();
    const ficha = await abrirAFicha();
    const celulas = notas(ficha);
    // Ao abrir, o foco já está na primeira célula vazia.
    expect(document.activeElement).toBe(celulas[0]);
    await digitar(celulas[0], "4");
    expect(document.activeElement).toBe(celulas[1]);
    // Digitar a primeira nota marca "Compareceu".
    expect(
      ficha
        .querySelector('.entrevistas-comparecimento button[data-valor="S"]')
        .getAttribute("aria-checked"),
    ).toBe("true");
    await teclar(celulas[1], "ArrowUp");
    expect(document.activeElement).toBe(celulas[0]);
    await teclar(celulas[0], "Enter");
    expect(document.activeElement).toBe(celulas[1]);
    await teclar(celulas[1], "Enter", { ctrlKey: true });
    await esperar();
    const [[, argumentos]] = chamadas(supabase, "lancar_notas_entrevista");
    expect(argumentos.p_dados).toEqual({
      notas: [{ competencia: "c1", avaliador: "a1", nota: 4 }],
      compareceu: "S",
      banca: 1,
    });
  });

  it("Faltou: a matriz some e fica a confirmação com o efeito no parecer", async () => {
    const supabase = supabaseDaConducao();
    await montar(supabase);
    await abrirEdital();
    const ficha = await abrirAFicha();
    await clicar(
      ficha.querySelector('.entrevistas-comparecimento button[data-valor="N"]'),
    );
    expect(notas(ficha)).toHaveLength(0);
    expect(ficha.querySelector(".entrevistas-matriz")).toBeNull();
    expect(ficha.querySelector(".entrevistas-falta").textContent).toContain(
      "A ausência elimina neste roteiro: parecer Inapto, total 0.",
    );
    expect(document.getElementById("entrevistasFichaParecer").textContent).toBe(
      "Inapto",
    );
    expect(document.getElementById("entrevistasFichaTotal").textContent).toBe(
      "0",
    );
    // Só o motivo da falta (não as competências sem nota).
    expect(
      [...ficha.querySelectorAll(".entrevistas-resultado-motivos li")].map(
        (li) => li.textContent,
      ),
    ).toEqual(["Faltou: a ausência elimina neste roteiro."]);
    await clicar(ficha.querySelector('button[type="submit"]'));
    await esperar();
    expect(chamadas(supabase, "lancar_notas_entrevista")[0][1].p_dados).toEqual(
      {
        notas: [],
        compareceu: "N",
        banca: 1,
      },
    );
  });

  it("enquanto as notas são gravadas, a ficha (em tela cheia, sem o resto da condução) não aceita digitação", async () => {
    let liberar;
    const supabase = supabaseDaConducao({
      respostas: {
        lancar_notas_entrevista: () =>
          new Promise((resolver) => {
            liberar = () => resolver({ data: EDITAL, error: null });
          }),
      },
    });
    await montar(supabase);
    await abrirEdital();
    const ficha = await abrirAFicha();
    const celulas = ficha.querySelectorAll("input.entrevistas-nota");
    await digitar(celulas[0], "4");
    // Modo de análise: a ficha ocupa a tela; o topo e a fila somem.
    expect(document.querySelector(".ui-topo")).toBeNull();
    expect(document.getElementById("entrevistasConvocar")).toBeNull();
    await clicar(ficha.querySelector('button[type="submit"]'));
    expect([...celulas].every((c) => c.disabled)).toBe(true);
    expect(
      [...ficha.querySelectorAll(".entrevistas-comparecimento button")].every(
        (b) => b.disabled,
      ),
    ).toBe(true);
    await act(async () => liberar());
    await esperar();
    expect([...celulas].some((c) => c.disabled)).toBe(false);
  });

  it("roteiros indisponíveis: avisa e não relê a cada volta à visão", async () => {
    const supabase = supabaseDaConducao({
      respostas: {
        listar_roteiros_entrevista: () => ({
          data: null,
          error: { code: "XX000", message: "falhou" },
        }),
      },
    });
    await montar(supabase);
    await clicar(visao("preparar"));
    await esperar();
    await abrirPasso("roteiro");
    expect(naTela("Não foi possível carregar os roteiros")).toBe(true);
    expect(chamadas(supabase, "listar_roteiros_entrevista")).toHaveLength(1);
    await clicar(visao("fila"));
    await esperar();
    await clicar(visao("preparar"));
    await esperar();
    await abrirPasso("roteiro");
    expect(chamadas(supabase, "listar_roteiros_entrevista")).toHaveLength(1);
    expect(naTela("Não foi possível carregar os roteiros")).toBe(true);
  });

  it("modo AVALIADOR: só as notas do avaliador ligado ao perfil ficam abertas", async () => {
    const edital = {
      ...EDITAL,
      configuracao: { ...EDITAL.configuracao, lancamento: "AVALIADOR" },
    };
    await montar(supabaseDaConducao({ edital }));
    await abrirEdital();
    const ficha = await abrirAFicha();
    expect(abaAtiva()).toContain("Ana");
    const celulas = notas(ficha);
    expect(celulas).toHaveLength(2);
    expect(
      celulas.every((c) => c.getAttribute("aria-label").includes("Ana")),
    ).toBe(true);
    expect(ficha.textContent).toContain("Você lança só as suas notas.");
    await clicar(ficha.querySelector('[role="tab"][data-aba="a2"]'));
    expect(notas(ficha)).toHaveLength(0);
    expect(ficha.querySelectorAll(".entrevistas-celula-fixa")).toHaveLength(2);
  });

  it("administrador global: mostra todos e libera edital fora da janela", async () => {
    const editais = (todos) => ({
      data: {
        admin_global: true,
        editais: [
          {
            id: "m1",
            edital: "100/2026",
            unidade: "CASAI Brasília",
            na_janela: true,
            visivel_por: "janela",
          },
          ...(todos
            ? [
                {
                  id: "m9",
                  edital: "120/2026",
                  unidade: "DSEI X",
                  na_janela: false,
                  visivel_por: "admin",
                },
              ]
            : []),
        ],
      },
      error: null,
    });
    const supabase = supabaseDaConducao({
      respostas: {
        listar_editais_entrevista: (args) => editais(args.p_todos),
        liberar_entrevista_edital: () => ({ data: {}, error: null }),
      },
    });
    await montar(supabase);
    const seletor = document.getElementById("entrevistasEdital");
    // O edital e, dentro do seletor, "mostrar também os concluídos".
    expect(seletor.querySelectorAll("option")).toHaveLength(3);
    await escolher(seletor, "__mostrar-todos__");
    await esperar();
    expect(chamadas(supabase, "listar_editais_entrevista").at(-1)[1]).toEqual({
      p_area: expect.any(String),
      p_todos: true,
    });
    expect(seletor.textContent).toContain("120/2026 · DSEI X · fora da janela");
    await escolher(seletor, "m9");
    await esperar();
    const caixa = document.getElementById("entrevistasLiberacao");
    expect(caixa.textContent).toContain(
      "sem etapa de entrevista no cronograma",
    );
    await digitar(caixa.querySelector('input[type="date"]'), "2026-11-15");
    await digitar(
      caixa.querySelector('input[type="text"]'),
      "Cronograma em revisão",
    );
    await clicar(caixa.querySelector("button"));
    await esperar();
    expect(chamadas(supabase, "liberar_entrevista_edital")[0][1]).toEqual({
      p_edital: "m9",
      p_ate: "2026-11-15",
      p_motivo: "Cronograma em revisão",
    });
  });

  it("sem nível de editor, tudo aparece só para consulta", async () => {
    const edital = { ...EDITAL, pode_editar: false };
    await montar(supabaseDaConducao({ edital }));
    await abrirEdital();
    await abrirPasso("convocacao");
    expect(document.getElementById("entrevistasConvocar")).toBeNull();
    // Sem selo "Somente consulta": quem só lê não vê os controles de edição.
    expect(naTela("Somente consulta")).toBe(false);
    const ficha = await abrirAFicha();
    expect(ficha.querySelectorAll("input.entrevistas-nota")).toHaveLength(0);
    expect(ficha.querySelector('button[type="submit"]')).toBeNull();
    await clicar(ficha.querySelector('[data-acao="voltar-a-lista"]'));
    await clicar(visao("preparar"));
    await esperar();
    expect(editarConfiguracao()).toBeNull();
    await abrirPasso("roteiro");
    expect(document.getElementById("entrevistasNovoRoteiro")).toBeNull();
    expect(document.querySelector('[data-roteiro="r1"]').textContent).toContain(
      "Ver",
    );
  });
});

describe("aspectos da entrevista (roteiro com Conceitua · Propriedade · Profundidade)", () => {
  const ASPECTOS = [
    { id: "s1", ordem: 1, nome: "Conceitua" },
    { id: "s2", ordem: 2, nome: "Propriedade" },
    { id: "s3", ordem: 3, nome: "Profundidade" },
  ];
  const editalComAspectos = () => ({
    ...EDITAL,
    configuracao: {
      ...EDITAL.configuracao,
      roteiro: { ...ROTEIRO, notas_eliminatorias: [], aspectos: ASPECTOS },
    },
    convocados: [
      {
        ...EDITAL.convocados[0],
        avaliacoes: [
          {
            competencia: "c1",
            avaliador: "a1",
            nota: 1.33,
            aspectos: [
              { aspecto: "s1", nota: 2 },
              { aspecto: "s2", nota: 1 },
              { aspecto: "s3", nota: 1 },
            ],
          },
        ],
      },
    ],
  });

  async function abrirFicha(supabase) {
    await montar(supabase);
    return abrirAFicha();
  }

  it("matriz competências × aspectos por avaliador, média da linha no chip, e grava todos os aspectos", async () => {
    const supabase = supabaseDaConducao({ edital: editalComAspectos() });
    const ficha = await abrirFicha(supabase);
    expect(colunas(ficha)).toEqual([
      "Conceitua",
      "Propriedade",
      "Profundidade",
      "Média",
    ]);
    let campos = notas(ficha);
    // Ana: 2 competências × 3 aspectos.
    expect(campos).toHaveLength(6);
    expect(campos.slice(0, 3).map((c) => c.value)).toEqual(["2", "1", "1"]);
    const chip = () => ficha.querySelector(".entrevistas-matriz-media");
    expect(chip().textContent).toBe("1,33");
    expect(chip().dataset.situacao).toBe("abaixo");
    // Beto em c1: 3 aspectos (2, 2, 3) → 2,33; a média da banca 1,83 fica abaixo do mínimo.
    await clicar(ficha.querySelector('[role="tab"][data-aba="a2"]'));
    campos = notas(ficha);
    await digitar(campos[0], "2");
    await digitar(campos[1], "2");
    await digitar(campos[2], "3");
    expect(chip().textContent).toBe("2,33");
    expect(chip().dataset.situacao).toBe("ok");
    expect(
      ficha.querySelector(".entrevistas-notas-da-banca li").dataset.situacao,
    ).toBe("abaixo");
    await clicar(
      ficha.querySelector('.entrevistas-comparecimento button[data-valor="S"]'),
    );
    await clicar(ficha.querySelector('button[type="submit"]'));
    await esperar();
    const [[, argumentos]] = chamadas(supabase, "lancar_notas_entrevista");
    expect(argumentos.p_dados.notas).toEqual([
      {
        competencia: "c1",
        avaliador: "a2",
        aspectos: [
          { aspecto: "s1", nota: 2 },
          { aspecto: "s2", nota: 2 },
          { aspecto: "s3", nota: 3 },
        ],
      },
    ]);
  });

  it("aspecto faltando não salva, avisa e abre a aba; apagar todos manda aspectos nulo", async () => {
    const supabase = supabaseDaConducao({ edital: editalComAspectos() });
    const ficha = await abrirFicha(supabase);
    await clicar(ficha.querySelector('[role="tab"][data-aba="a2"]'));
    await digitar(notas(ficha)[0], "4");
    await clicar(ficha.querySelector('[role="tab"][data-aba="a1"]'));
    await clicar(ficha.querySelector('button[type="submit"]'));
    expect(ficha.textContent).toContain(
      "Complete os 3 aspectos de Beto em “Políticas públicas”",
    );
    expect(abaAtiva()).toContain("Beto");
    expect(chamadas(supabase, "lancar_notas_entrevista")).toHaveLength(0);
    await digitar(notas(ficha)[0], "");
    await clicar(ficha.querySelector('[role="tab"][data-aba="a1"]'));
    for (const campo of notas(ficha).slice(0, 3)) await digitar(campo, "");
    await clicar(ficha.querySelector('button[type="submit"]'));
    await esperar();
    const [[, argumentos]] = chamadas(supabase, "lancar_notas_entrevista");
    expect(argumentos.p_dados.notas).toEqual([
      { competencia: "c1", avaliador: "a1", aspectos: null },
    ]);
  });

  it("fluxo de digitação: avança, recusa fora da escala, Backspace volta e passa ao próximo avaliador", async () => {
    const ficha = await abrirFicha(
      supabaseDaConducao({ edital: editalComAspectos() }),
    );
    let campos = notas(ficha);
    await act(async () => campos[3].focus());
    await digitar(campos[3], "5");
    expect(campos[3].value).toBe("5");
    expect(document.activeElement).toBe(campos[4]);
    // Fora da escala: a célula não muda, o foco fica e o aviso aparece.
    await digitar(campos[4], "7");
    expect(campos[4].value).toBe("");
    expect(document.activeElement).toBe(campos[4]);
    expect(ficha.querySelector(".entrevistas-matriz-aviso").textContent).toBe(
      "“7” não está na escala (0 a 5).",
    );
    // Backspace na célula vazia volta à anterior.
    await teclar(campos[4], "Backspace");
    expect(document.activeElement).toBe(campos[3]);
    await teclar(campos[3], "ArrowRight");
    await digitar(campos[4], "4");
    await digitar(campos[5], "3");
    // Ana completa: check na aba e a ficha passa sozinha ao Beto, na primeira célula vazia.
    await esperarAvanco();
    expect(
      ficha.querySelector('[data-aba="a1"] .entrevistas-aba-da-ficha-check'),
    ).not.toBeNull();
    expect(abaAtiva()).toContain("Beto");
    campos = notas(ficha);
    expect(document.activeElement).toBe(campos[0]);
    expect(campos[0].getAttribute("aria-label")).toBe(
      "Nota de Beto em Políticas públicas · Conceitua",
    );
    // Seta para baixo: a mesma coluna da competência seguinte.
    await teclar(campos[0], "ArrowDown");
    expect(document.activeElement).toBe(campos[3]);
  });

  it("Por competência fica lembrado no navegador", async () => {
    const ficha = await abrirFicha(
      supabaseDaConducao({ edital: editalComAspectos() }),
    );
    await clicar(
      ficha.querySelector(
        '.entrevistas-modo-da-ficha [data-valor="competencia"]',
      ),
    );
    expect(abaAtiva()).toContain("Políticas públicas");
    // Linhas = avaliadores (Ana e Beto) × 3 aspectos.
    expect(notas(ficha)).toHaveLength(6);
    await clicar(ficha.querySelector('[data-acao="voltar-a-lista"]'));
    const outra = await abrirAFicha();
    expect(abaAtiva()).toContain("Políticas públicas");
    expect(
      outra
        .querySelector('.entrevistas-modo-da-ficha [data-valor="competencia"]')
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("Voltar à fila sai do modo de análise e o topo volta", async () => {
    const ficha = await abrirFicha(
      supabaseDaConducao({ edital: editalComAspectos() }),
    );
    expect(document.querySelector(".ui-topo")).toBeNull();
    await clicar(ficha.querySelector('[data-acao="voltar-a-lista"]'));
    expect(document.getElementById("entrevistasFichaDoCandidato")).toBeNull();
    expect(document.querySelector(".ui-topo")).not.toBeNull();
    expect(document.querySelector(".entrevistas-fila")).not.toBeNull();
  });

  it("o editor do roteiro preenche o modelo e grava os aspectos", async () => {
    const supabase = supabaseDaConducao();
    await montar(supabase);
    await clicar(visao("preparar"));
    await esperar();
    await abrirPasso("roteiro");
    const editar = [
      ...document.querySelectorAll('[data-roteiro="r1"] button'),
    ].find((b) => b.textContent.includes("Editar (cria versão 2)"));
    await clicar(editar);
    const editor = document.getElementById("entrevistasEditorDeRoteiro");
    await clicar(editor.querySelector('[data-acao="modelo-de-aspectos"]'));
    // Com aspectos, as médias eliminatórias saem (vale o mínimo da competência).
    await clicar(editor.querySelector('[data-secao="aprovacao"] summary'));
    expect(editor.textContent).toContain(
      "O mínimo de cada competência fica em Competências e aspectos.",
    );
    await clicar(editor.querySelector('button[type="submit"]'));
    await esperar();
    const [[, { p_dados }]] = chamadas(supabase, "salvar_roteiro_entrevista");
    expect(p_dados.aspectos).toEqual([
      { nome: "Conceitua" },
      { nome: "Propriedade" },
      { nome: "Profundidade" },
    ]);
    expect(p_dados.notas_eliminatorias).toEqual([]);
  });
});

describe("entrevistas mais claras: fila, Preparar em passos e parecer pronto", () => {
  it("fila: cartões por vaga, busca por nome ou código e estado vazio da busca", async () => {
    const edital = {
      ...EDITAL_DO_DIA,
      convocados: [
        ...EDITAL_DO_DIA.convocados,
        convocado(6, {
          candidato: "Maria das Dores",
          codigo: "43015",
          vaga: "V2",
          cargo: "Técnico de enfermagem",
        }),
      ],
    };
    await montar(
      supabaseDaConducao({
        edital,
        respostas: {
          obter_agenda_entrevista: () => ({
            data: {
              ...AGENDA_DO_DIA,
              itens: [
                ...AGENDA_DO_DIA.itens,
                { analise_id: "an6", data: HOJE, inicio: "07:30", banca: 2 },
              ],
            },
            error: null,
          }),
        },
      }),
    );
    expect(
      [...secao.querySelectorAll(".entrevistas-fila-vaga")].map(
        (h) => h.textContent,
      ),
    ).toEqual(["V1 · Enfermeiro4", "V2 · Técnico de enfermagem1"]);
    // O cartão: iniciais do nome, código, horário e banca; sem "—" nem "0/2" sem nota.
    const cartao = secao.querySelector('[data-convocado="e6"]');
    expect(cartao.querySelector(".entrevistas-avatar").textContent).toBe("MD");
    expect(cartao.textContent).toContain("Cód. 43015");
    expect(cartao.querySelector(".entrevistas-fila-hora").textContent).toBe(
      "07:30Banca 2",
    );
    expect(cartao.textContent).not.toContain("—");
    expect(cartao.querySelector(".entrevistas-fila-notas")).toBeNull();
    const busca = secao.querySelector('[data-campo="fila-busca"]');
    await digitar(busca, "dores");
    expect(cartoes()).toEqual([["e6", "aguardando"]]);
    await digitar(busca, "43015");
    expect(cartoes()).toEqual([["e6", "aguardando"]]);
    await digitar(busca, "ninguém assim");
    expect(cartoes()).toEqual([]);
    expect(naTela("Ninguém encontrado para “ninguém assim”.")).toBe(true);
    await clicar(
      [...secao.querySelectorAll("button")].find(
        (b) => b.textContent === "Limpar busca",
      ),
    );
    expect(cartoes()).toHaveLength(5);
  });

  it("Preparar: quatro passos com o estado e o que falta; abre no primeiro pendente", async () => {
    await montar(supabaseDaConducao());
    await abrirEdital();
    const estados = () =>
      [...document.querySelectorAll(".entrevistas-passos li")].map((li) => [
        li.dataset.passo,
        li.dataset.estado,
      ]);
    // Roteiro e banca prontos; falta convocar o 2º da lista e montar a agenda.
    expect(estados()).toEqual([
      ["roteiro", "feito"],
      ["banca", "feito"],
      ["convocacao", "atual"],
      ["agenda", "pendente"],
    ]);
    expect(
      document.querySelector(".entrevistas-preparar-andamento").textContent,
    ).toBe("2 de 4 prontos");
    expect(
      corpoDoPasso().querySelector(".entrevistas-o-que-falta").textContent,
    ).toContain("1 candidato da lista ainda não foi convocado.");
    // Passo 3: a frase simples de quem é chamado e a tabela das vagas.
    expect(corpoDoPasso().textContent).toContain(
      "Até 1 pessoa por vaga imediata",
    );
    const agenda = await abrirPasso("agenda");
    expect(agenda.textContent).toContain(
      "Monte a agenda na Classificação (dia, horário e banca de cada candidato).",
    );
    expect(agenda.textContent).toContain(
      "Nenhum horário salvo para este edital.",
    );
    const banca = await abrirPasso("banca");
    expect(banca.textContent).toContain("Banca 1");
    expect(banca.textContent).toContain("Avalia todas as competências");
    // Editar a banca: a lista do que falta fica perto do Salvar.
    await clicar(editarConfiguracao());
    const nome = banca.querySelector(".entrevistas-linha-membro input");
    await digitar(nome, "A");
    expect(
      banca.querySelector(".entrevistas-pendencias").textContent,
    ).toContain("Membro 1 (A): Nome do avaliador: de 2 a 150 caracteres.");
  });

  it("ficha: com tudo lançado, o parecer em texto pronto com Copiar parecer", async () => {
    const writeText = vi.fn(async () => {});
    const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    try {
      const dados = {
        ...EDITAL,
        convocados: [
          {
            ...EDITAL.convocados[0],
            compareceu: "S",
            parecer: "APTO",
            nota: 8,
            avaliacoes: todasAsNotas,
          },
        ],
      };
      await montar(supabaseDaConducao({ edital: dados }));
      const ficha = await abrirAFicha();
      const parecer = ficha.querySelector(".entrevistas-parecer-pronto");
      expect(parecer).not.toBeNull();
      const texto = parecer.querySelector("pre").textContent;
      expect(texto).toContain("Parecer da entrevista — Candidato 1 (cód. K1)");
      expect(texto).toContain("Edital 100/2026 · Vaga V1 · Enfermeiro");
      expect(texto).toContain("1. Políticas públicas: 4 de 5 (mínimo 2)");
      expect(texto).toContain("Total: 8 de 10 (mínimo 4)");
      expect(texto).toContain("Parecer: APTO");
      await clicar(parecer.querySelector('[data-acao="copiar-parecer"]'));
      await esperar();
      expect(writeText).toHaveBeenCalledWith(texto);
      expect(parecer.textContent).toContain("Parecer copiado.");
      // Apagar uma nota tira o parecer pronto (volta a faltar nota).
      await digitar(notas(ficha)[0], "");
      expect(ficha.querySelector(".entrevistas-parecer-pronto")).toBeNull();
    } finally {
      if (original) Object.defineProperty(navigator, "clipboard", original);
      else delete navigator.clipboard;
    }
  });
});
