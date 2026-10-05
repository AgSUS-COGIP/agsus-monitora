import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.js";
import { EVENTO_TEMA_ALTERADO } from "../../src/lib/eventos-da-barra-lateral.js";
import {
  clicar,
  digitar,
  escolher,
  esperar,
  teclar,
} from "../componentes/interacoes.js";

/*
  A tela de Entrevistas como módulo do app (src/modulos/entrevistas/): monta
  na própria `#page-entrevistas`, carrega a área atual do app quando o legado
  abre a tela (`render()`), segue o tema do app, usa o aviso global e os
  componentes de src/ui/ (classes .ui-*). "Resultados": KPIs, filtro, gaveta
  com o caminho do candidato (sem HTML vindo dos dados), lista dos aprovados
  sem entrevista, estado vazio e sem acesso. Depois, "Conduzir entrevistas" e
  "Roteiros".
*/

// O Chart.js não desenha no jsdom (sem canvas): um falso guarda o que recebeu.
const graficos = vi.hoisted(() => []);
vi.mock("../../src/lib/chartjs-global.js", () => ({
  Chart: class {
    constructor(canvas, configuracao) {
      this.canvas = canvas;
      this.config = configuracao;
      this.data = configuracao.data;
      this.options = configuracao.options;
      this.atualizacoes = 0;
      graficos.push(this);
    }
    update() {
      this.atualizacoes += 1;
    }
    destroy() {
      graficos.splice(graficos.indexOf(this), 1);
    }
  },
}));

const { montarEntrevistas } =
  await import("../../src/modulos/entrevistas/entrevistas.jsx");

const PAYLOAD = {
  schema_version: 1,
  area: "saude-indigena",
  gerado_em: "2026-09-29T12:00:00Z",
  ultima_carga: { em: "2026-09-29T10:30:00", linhas: 2 },
  criterios: ["HABILIDADE TÉCNICA (Conhecimentos gerais)", "POSTURA"],
  entrevistas: [
    {
      id: "e1",
      edital_id: "m1",
      edital: "Edital 01/2026",
      edital_planilha: "01/2026",
      unidade: "DSEI Xingu",
      vaga: "V1",
      cargo: "Enfermeiro",
      candidato: "<img src=x onerror=alert(1)>",
      codigo: "C1",
      modalidade: "Ampla",
      nota: 9,
      parecer: "APTO",
      compareceu: "S",
      link: "https://docs.google.com/spreadsheets/d/1",
      notas: [
        [0, 5],
        [1, 4],
      ],
      analise: {
        id: "a1",
        ligacao: "codigo",
        nota: 70,
        resultado: "Aprovado",
        etapa: "Final",
        responsavel: "Carla",
        ativo: true,
      },
    },
    {
      id: "e2",
      edital_id: null,
      edital: "Edital 02/2026",
      edital_planilha: "02/2026",
      unidade: "DSEI Xingu",
      vaga: "V2",
      cargo: "Médico",
      candidato: "Bruno",
      codigo: null,
      modalidade: null,
      nota: 3,
      parecer: "INAPTO",
      compareceu: "S",
      link: "javascript:alert(1)",
      notas: [],
      analise: null,
    },
  ],
  aprovados_sem_entrevista: [
    {
      analise_id: "a9",
      candidato: "Eva",
      codigo: "C9",
      vaga: "V1",
      cargo: "Enfermeiro",
      edital: "Edital 01/2026",
      unidade: "DSEI Xingu",
      nota: 80,
      modalidade: "Ampla",
    },
  ],
};

const supabaseFalso = (resposta, auth) => ({
  rpc: vi.fn(async () => resposta),
  auth: auth || {
    getSession: async () => ({ data: { session: { user: { id: "u" } } } }),
  },
});

/* Sem IndexedDB nos testes: a cópia guardada fica na memória de cada teste. */
function memoria() {
  const mapa = new Map();
  return {
    mapa,
    ler: async (chave) => mapa.get(chave) ?? null,
    guardar: async (chave, valor) => void mapa.set(chave, valor),
    apagarTudo: async () => mapa.clear(),
  };
}

let secao;
let painel;
const toast = vi.fn();
const baixar = vi.fn();

/*
  Como o app monta: o módulo nasce na `<section id="page-entrevistas">`
  (vazia, sem pedir nada ao banco) e o legado chama `render()` ao navegar
  para a tela. A área é a área atual do app (dados-do-monitoramento.js).
*/
async function montar(supabase, { abrir = true, ...opcoes } = {}) {
  secao = document.createElement("section");
  secao.id = "page-entrevistas";
  secao.className = "page active";
  document.body.append(secao);
  await act(async () => {
    painel = montarEntrevistas({
      supabase,
      toast,
      baixar,
      armazenamento: memoria(),
      ...opcoes,
    });
  });
  if (abrir) await abrirATela();
  return painel;
}

async function abrirATela() {
  await act(async () => void painel.render());
  await esperar();
}

const kpi = (chave) =>
  document.querySelector(
    `.entrevistas-kpis [data-kpi="${chave}"] .ui-kpi-valor`,
  )?.textContent;
const linhasDaTabela = () =>
  document.querySelectorAll(".ui-tabela tbody tr.entrevistas-linha");
const status = () => document.querySelector(".ui-topo .status-discreto");
const naTela = (texto) => document.body.textContent.includes(texto);
const botao = (texto) =>
  [...document.querySelectorAll("button")].find((b) =>
    b.textContent.trim().startsWith(texto),
  );

beforeEach(() => {
  redefinirDadosDoMonitoramento();
  definirAreaAtual("saude-indigena");
});

afterEach(async () => {
  await act(async () => painel?.raiz?.unmount());
  secao?.remove();
  document.body.innerHTML = "";
  document.body.className = "";
  document.documentElement.removeAttribute("data-theme");
  redefinirDadosDoMonitoramento();
  localStorage.clear();
  toast.mockClear();
  baixar.mockClear();
});

describe("Resultados", () => {
  it("carrega a área, mostra KPIs, a última carga e a tabela", async () => {
    const supabase = supabaseFalso({ data: PAYLOAD, error: null });
    await montar(supabase);
    expect(supabase.rpc).toHaveBeenCalledWith("get_entrevistas_da_area", {
      p_area: "saude-indigena",
    });
    expect(kpi("vagas")).toBe("2");
    expect(kpi("aptos")).toBe("1");
    expect(kpi("inaptos")).toBe("1");
    expect(kpi("media")).toBe("6,00");
    expect(kpi("sem-entrevista")).toBe("1");
    // A última carga aparece uma vez só, discreta, no topo.
    expect(status().textContent).toBe("Conferido em 29/09, 10:30");
    expect(document.querySelectorAll(".status-discreto")).toHaveLength(1);
    expect(linhasDaTabela()).toHaveLength(2);
    expect(document.querySelector(".ui-tabela tbody img")).toBeNull();
    expect(document.querySelector(".entrevistas-contagem").textContent).toBe(
      "2 entrevistas",
    );
  });

  it("filtra por parecer e abre a gaveta com o caminho e os critérios", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    await escolher(document.getElementById("filtro-parecer"), "APTO");
    const linhas = linhasDaTabela();
    expect(linhas).toHaveLength(1);
    expect(document.querySelector("[data-recorte]").textContent).toBe(
      "Recorte ativo: Parecer: Apto",
    );
    await clicar(linhas[0]);
    const gaveta = document.getElementById("entrevistasGaveta");
    expect(gaveta).not.toBeNull();
    expect(gaveta.querySelector("img")).toBeNull();
    expect(gaveta.textContent).toContain("Análise curricular");
    expect(gaveta.textContent).toContain("HABILIDADE TÉCNICA");
    const criterio = gaveta.querySelector(".entrevistas-criterios li");
    expect(criterio.title).toBe("HABILIDADE TÉCNICA (Conhecimentos gerais)");
    const link = [...gaveta.querySelectorAll("a")].find((a) =>
      a.textContent.includes("Abrir planilha da entrevista"),
    );
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
  });

  it("link que não é http(s) não vira âncora", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    await escolher(document.getElementById("filtro-parecer"), "INAPTO");
    await clicar(linhasDaTabela()[0]);
    const gaveta = document.getElementById("entrevistasGaveta");
    expect(gaveta.querySelector("a")).toBeNull();
    expect(gaveta.textContent).toContain("Nenhuma análise curricular ligada");
  });

  it("o KPI abre a lista dos aprovados sem entrevista", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    await clicar(
      document.querySelector(
        '.entrevistas-kpis [data-kpi="sem-entrevista"] button',
      ),
    );
    const lista = document.getElementById("entrevistasSemEntrevista");
    expect(lista.textContent).toContain("Eva");
  });

  it("área sem entrevistas mostra o estado vazio", async () => {
    await montar(
      supabaseFalso({
        data: { ...PAYLOAD, entrevistas: [], aprovados_sem_entrevista: [] },
        error: null,
      }),
    );
    expect(naTela("Nenhuma entrevista carregada para esta área ainda.")).toBe(
      true,
    );
  });

  it("sem permissão (42501) mostra 'Sem acesso às Entrevistas'", async () => {
    await montar(
      supabaseFalso({ data: null, error: { code: "42501", message: "x" } }),
    );
    expect(
      secao.querySelector(".entrevistas-sem-acesso[role=alert]").textContent,
    ).toContain("Sem acesso às Entrevistas");
    expect(secao.querySelector(".entrevistas-kpis")).toBeNull();
    // Sem acesso, sem as visões no topo.
    expect(secao.querySelector(".entrevistas-visoes")).toBeNull();
  });
});

describe("cópia guardada (stale-while-revalidate)", async () => {
  const { criarEstadoDasEntrevistas } =
    await import("../../src/modulos/entrevistas/estado.js");

  it("guarda na primeira carga e abre da cópia na seguinte, revalidando", async () => {
    const armazenamento = memoria();
    const primeiro = criarEstadoDasEntrevistas({
      supabase: supabaseFalso({ data: PAYLOAD, error: null }),
      armazenamento,
    });
    expect(await primeiro.carregar("saude-indigena")).toBe(true);
    await vi.waitFor(() =>
      expect(armazenamento.mapa.has("entrevistas:saude-indigena")).toBe(true),
    );

    let responder;
    const lento = {
      ...supabaseFalso(),
      rpc: vi.fn(
        () =>
          new Promise((ok) => {
            responder = ok;
          }),
      ),
    };
    const segundo = criarEstadoDasEntrevistas({
      supabase: lento,
      armazenamento,
    });
    const carga = segundo.carregar("saude-indigena");
    await vi.waitFor(() => expect(segundo.obter().daCopia).toBe(true));
    expect(segundo.obter().dados.entrevistas).toHaveLength(2);
    responder({ data: { ...PAYLOAD, entrevistas: [] }, error: null });
    expect(await carga).toBe(true);
    expect(segundo.obter().daCopia).toBe(false);
    expect(segundo.obter().dados.entrevistas).toHaveLength(0);
  });

  it("acesso revogado apaga a cópia e mostra sem acesso", async () => {
    const armazenamento = memoria();
    await criarEstadoDasEntrevistas({
      supabase: supabaseFalso({ data: PAYLOAD, error: null }),
      armazenamento,
    }).carregar("saude-indigena");
    await vi.waitFor(() => expect(armazenamento.mapa.size).toBe(2));
    const estado = criarEstadoDasEntrevistas({
      supabase: supabaseFalso({ data: null, error: { code: "42501" } }),
      armazenamento,
    });
    await estado.carregar("saude-indigena");
    expect(estado.obter().semAcesso).toBe(true);
    expect(estado.obter().carregado).toBe(false);
    expect(armazenamento.mapa.size).toBe(0);
  });
  it("avisa os marcos (vaga pronta) com o usuário, a área, os dados e o liga/desliga do app", async () => {
    const avaliarMarcos = vi.fn();
    const estado = criarEstadoDasEntrevistas({
      supabase: supabaseFalso({ data: PAYLOAD, error: null }),
      armazenamento: memoria(),
      avaliarMarcos,
    });
    await estado.carregar("saude-indigena");
    expect(avaliarMarcos).toHaveBeenLastCalledWith(
      expect.objectContaining({
        usuarioId: "u",
        area: "saude-indigena",
        dados: estado.obter().dados,
        ligadas: false,
      }),
    );
    estado.definirComemoracoes(true);
    await estado.carregar("saude-indigena");
    expect(avaliarMarcos).toHaveBeenLastCalledWith(
      expect.objectContaining({ ligadas: true }),
    );
  });
});

/*
  Visões "Conduzir entrevistas" e "Roteiros" (fase 2): troca de visão no
  cabeçalho, lista e edição de roteiro (versão nova), configuração,
  convocação sugerida pela regra, ficha de notas (prévia do parecer, modo
  AVALIADOR, erros do banco) e a releitura de "Resultados" depois de gravar.
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
  admin_global: false,
  meu_perfil: PERFIL_DA_ANA,
  configuracao: {
    roteiro: ROTEIRO,
    convocacao: {
      multiplo_imediatas: 1,
      posicao_cadastro_reserva: 1,
      excecoes: [],
    },
    banca: [{ origem: "AgSUS", quantidade: 1 }],
    lancamento: "SECRETARIA",
    atualizado_em: "2026-09-30T12:00:00Z",
  },
  vagas: [
    {
      vaga: "V1",
      cargo: "Enfermeiro",
      aprovados: 3,
      vagas_imediatas: 2,
      vagas_imediatas_salvas: true,
    },
  ],
  candidatos: [1, 2, 3].map((posicao) => ({
    analise_id: `an${posicao}`,
    candidato: `Candidato ${posicao}`,
    codigo: `K${posicao}`,
    vaga: "V1",
    cargo: "Enfermeiro",
    nota_analise: 90 - posicao,
    modalidade: "Ampla",
    pcd: false,
    posicao,
  })),
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
    get_entrevistas_da_area: () => ({ data: PAYLOAD, error: null }),
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

async function abrirEdital() {
  await clicar(visao("conduzir"));
  await esperar();
  await escolher(document.getElementById("entrevistasEdital"), "m1");
  await esperar();
}

describe("visões de condução e roteiros", () => {
  it("o cabeçalho troca de visão; Resultados é a primeira", async () => {
    await montar(supabaseDaConducao());
    expect(visao("resultados").getAttribute("aria-checked")).toBe("true");
    expect(secao.querySelector(".entrevistas-kpis")).not.toBeNull();
    expect(secao.querySelector('[data-acao="exportar"]')).not.toBeNull();
    await clicar(visao("roteiros"));
    await esperar();
    expect(secao.querySelector(".entrevistas-kpis")).toBeNull();
    expect(secao.querySelector('[data-acao="exportar"]')).toBeNull();
    // Atualizar continua no topo em todas as visões.
    expect(secao.querySelector('[data-acao="atualizar"]')).not.toBeNull();
    expect(naTela("Roteiros de entrevista")).toBe(true);
    expect(document.querySelector('[data-roteiro="r1"]').textContent).toContain(
      "Usado em 1 edital",
    );
  });

  it("editar um roteiro grava a versão seguinte, com a prévia e o +50%", async () => {
    const supabase = supabaseDaConducao();
    await montar(supabase);
    await clicar(visao("roteiros"));
    await esperar();
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
    await clicar(visao("roteiros"));
    await esperar();
    await clicar(document.getElementById("entrevistasNovoRoteiro"));
    const editor = document.getElementById("entrevistasEditorDeRoteiro");
    await clicar(editor.querySelector('button[type="submit"]'));
    expect(editor.textContent).toContain("Nome do roteiro: de 3 a 150");
    expect(chamadas(supabase, "salvar_roteiro_entrevista")).toHaveLength(0);
  });

  it("convoca os sugeridos pela regra e relê os resultados", async () => {
    const supabase = supabaseDaConducao();
    await montar(supabase);
    await abrirEdital();
    expect(chamadas(supabase, "obter_entrevistas_do_edital")[0][1]).toEqual({
      p_edital: "m1",
    });
    const passo = document.querySelector('[data-passo="convocacao"]');
    const caixas = passo.querySelectorAll('input[type="checkbox"]');
    // 1× 2 vagas imediatas: até a 2ª posição; a 1ª já foi convocada.
    expect([...caixas].map((c) => [c.checked, c.disabled])).toEqual([
      [true, true],
      [true, false],
      [false, false],
    ]);
    expect(passo.textContent).toContain("convocar até a 2ª posição");
    const antes = chamadas(supabase, "get_entrevistas_da_area").length;
    await clicar(document.getElementById("entrevistasConvocar"));
    await esperar();
    expect(chamadas(supabase, "convocar_para_entrevista")[0][1]).toEqual({
      p_edital: "m1",
      p_analises: ["an2"],
    });
    expect(chamadas(supabase, "get_entrevistas_da_area").length).toBe(
      antes + 1,
    );
  });

  it("salva a configuração com o modo de lançamento e a banca", async () => {
    const supabase = supabaseDaConducao();
    await montar(supabase);
    await abrirEdital();
    const passo = document.querySelector('[data-passo="configuracao"]');
    expect(passo.textContent).toContain("Saúde Indígena 2026");
    await clicar(
      [...passo.querySelectorAll("button")].find((b) =>
        b.textContent.includes("Editar configuração"),
      ),
    );
    await clicar(passo.querySelector('button[data-valor="AVALIADOR"]'));
    await clicar(passo.querySelector('button[type="submit"]'));
    await esperar();
    const [[, argumentos]] = chamadas(supabase, "configurar_entrevista_edital");
    expect(argumentos.p_edital).toBe("m1");
    expect(argumentos.p_dados).toMatchObject({
      roteiro: "r1",
      lancamento: "AVALIADOR",
      vagas: [{ vaga: "V1", vagas_imediatas: 2 }],
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
    await clicar(
      document.querySelector("#entrevistasFicha tr.entrevistas-linha"),
    );
    const ficha = document.getElementById("entrevistasFichaDoCandidato");
    const celulas = ficha.querySelectorAll("select.entrevistas-nota");
    expect(celulas).toHaveLength(4);
    expect(celulas[0].querySelector('option[value="3"]').textContent).toBe(
      "3 — Nível 3",
    );
    await clicar(ficha.querySelector('.ui-segmentado button[data-valor="S"]'));
    for (const celula of celulas) await escolher(celula, "3");
    expect(
      document.getElementById("entrevistasFichaTotal").textContent,
    ).toContain("6");
    expect(document.getElementById("entrevistasFichaParecer").textContent).toBe(
      "Apto",
    );
    await escolher(celulas[0], "1");
    await escolher(celulas[1], "1");
    expect(document.getElementById("entrevistasFichaParecer").textContent).toBe(
      "Inapto",
    );
    expect(ficha.textContent).toContain("é eliminatória");

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

    falhar = false;
    const antes = chamadas(supabase, "get_entrevistas_da_area").length;
    await clicar(ficha.querySelector('button[type="submit"]'));
    await esperar();
    expect(chamadas(supabase, "get_entrevistas_da_area").length).toBe(
      antes + 1,
    );
  });

  it("ficha pelo teclado: Enter avança para a próxima nota, Ctrl+Enter salva", async () => {
    const supabase = supabaseDaConducao();
    await montar(supabase);
    await abrirEdital();
    await clicar(
      document.querySelector("#entrevistasFicha tr.entrevistas-linha"),
    );
    const ficha = document.getElementById("entrevistasFichaDoCandidato");
    const celulas = ficha.querySelectorAll("select.entrevistas-nota");
    celulas[0].focus();
    await escolher(celulas[0], "4");
    await teclar(celulas[0], "Enter");
    expect(document.activeElement).toBe(celulas[1]);
    await teclar(celulas[1], "Enter", { ctrlKey: true });
    await esperar();
    const [[, argumentos]] = chamadas(supabase, "lancar_notas_entrevista");
    expect(argumentos.p_dados.notas).toEqual([
      { competencia: "c1", avaliador: "a1", nota: 4 },
    ]);
  });

  it("modo AVALIADOR: só a coluna do avaliador ligado ao perfil fica aberta", async () => {
    const edital = {
      ...EDITAL,
      configuracao: { ...EDITAL.configuracao, lancamento: "AVALIADOR" },
    };
    await montar(supabaseDaConducao({ edital }));
    await abrirEdital();
    await clicar(
      document.querySelector("#entrevistasFicha tr.entrevistas-linha"),
    );
    const ficha = document.getElementById("entrevistasFichaDoCandidato");
    const celulas = [...ficha.querySelectorAll("select.entrevistas-nota")];
    expect(celulas).toHaveLength(2);
    expect(
      celulas.every((c) => c.getAttribute("aria-label").includes("Ana")),
    ).toBe(true);
    expect(ficha.textContent).toContain("Você só edita a sua coluna.");
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
    await clicar(visao("conduzir"));
    await esperar();
    const seletor = document.getElementById("entrevistasEdital");
    expect(seletor.querySelectorAll("option")).toHaveLength(2);
    await clicar(document.querySelector(".entrevistas-todos input"));
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
    expect(document.getElementById("entrevistasConvocar")).toBeNull();
    // Sem selo "Somente consulta": quem só lê não vê os controles de edição.
    expect(naTela("Somente consulta")).toBe(false);
    await clicar(
      document.querySelector("#entrevistasFicha tr.entrevistas-linha"),
    );
    const ficha = document.getElementById("entrevistasFichaDoCandidato");
    expect(ficha.querySelectorAll("select.entrevistas-nota")).toHaveLength(0);
    expect(ficha.querySelector('button[type="submit"]')).toBeNull();
    await clicar(ficha.querySelector(".ui-gaveta-fechar"));
    await clicar(visao("roteiros"));
    await esperar();
    expect(document.getElementById("entrevistasNovoRoteiro")).toBeNull();
    expect(document.querySelector('[data-roteiro="r1"]').textContent).toContain(
      "Ver",
    );
  });
});

/*
  A tela dentro do app (Etapa 2): monta na seção sem pedir nada, abre pelo
  render() do legado, não repete o cabeçalho do app, usa só src/ui/ (.ui-*),
  segue o tema e a área do app e o aviso global.
*/

describe("a tela dentro do app", () => {
  it("monta na seção sem pedir nada; a primeira abertura (render) carrega a área atual", async () => {
    const supabase = supabaseFalso({ data: PAYLOAD, error: null });
    await montar(supabase, { abrir: false });
    expect(secao.querySelector(".ui-tela.entrevistas-tela")).not.toBeNull();
    expect(supabase.rpc).not.toHaveBeenCalled();
    // Antes da área, sem visões (nada a conduzir ainda).
    expect(secao.querySelector(".entrevistas-visoes")).toBeNull();

    await abrirATela();
    expect(supabase.rpc).toHaveBeenCalledWith("get_entrevistas_da_area", {
      p_area: "saude-indigena",
    });
    expect(kpi("candidatos")).toBe("2");
  });

  it("não repete o cabeçalho do app: topo com as visões, o status e as ações, sem tema nem tela cheia", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    const topo = secao.querySelector("header.ui-topo");
    expect(topo.querySelector("h1, h2")).toBeNull();
    expect(
      [...topo.querySelectorAll(".entrevistas-visoes [role=radio]")].map((b) =>
        b.textContent.trim(),
      ),
    ).toEqual(["Resultados", "Conduzir entrevistas", "Roteiros"]);
    expect(
      [...topo.querySelectorAll(".ui-topo-acoes button")].map((b) =>
        b.textContent.trim(),
      ),
    ).toEqual(["Atualizar", "Exportar"]);
    expect(topo.querySelector('[aria-label*="tema"]')).toBeNull();
    expect(topo.querySelector('[aria-label*="tela cheia"]')).toBeNull();
    expect(document.querySelectorAll(".status-discreto")).toHaveLength(1);
    expect(naTela("Somente consulta")).toBe(false);
    expect(naTela("Painel de entrevistas")).toBe(false);
  });

  it("as visões trocam pelo teclado (setas), como um radiogroup", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    visao("resultados").focus();
    await teclar(visao("resultados"), "ArrowRight");
    await esperar();
    expect(visao("conduzir").getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(visao("conduzir"));
    expect(document.getElementById("entrevistasEdital")).not.toBeNull();
  });

  it("usa src/ui/ com as classes .ui-*, sem o CSS nem os ids do painel de análises", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    expect(
      secao.querySelector("section.ui-card.ui-filtros h2").textContent,
    ).toBe("Refinar resultados");
    expect(secao.querySelector(".entrevistas-kpis").children).toHaveLength(7);
    expect(
      secao.querySelector('.entrevistas-kpis [data-kpi="inaptos"]').dataset.tom,
    ).toBe("perigo");
    expect(
      [...secao.querySelectorAll(".ui-card .ui-titulo")].map((e) =>
        e.textContent.trim(),
      ),
    ).toEqual(
      expect.arrayContaining([
        "Aptos x Inaptos",
        "Comparecimento",
        "Pendências",
        "Top unidades por entrevistados",
        "Entrevistas",
      ]),
    );
    expect(secao.querySelectorAll(".ui-pendencia").length).toBeGreaterThan(0);
    for (const id of [
      "topbar",
      "themeBtn",
      "fullBtn",
      "refreshBtn",
      "exportBtn",
      "kpiGrid",
      "tableBody",
      "tableSearch",
      "contextLine",
      "attentionList",
      "authWarning",
      "toastHost",
      "entrevistasPainel",
      "analisesDrawerBody",
    ])
      expect(document.getElementById(id), id).toBeNull();
    expect(
      document.querySelector(
        ".topbar, .kpi, .panel, .filter-panel, .table-card, .chart-wrap, .attention-list, .badge, .field, .analises-drawer, .eyebrow",
      ),
    ).toBeNull();
    expect(document.body.classList.contains("analises-is-loading")).toBe(false);
  });

  it("as gavetas são as de src/ui/ (.ui-gaveta), com contexto e seções", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    await escolher(document.getElementById("filtro-parecer"), "APTO");
    await clicar(linhasDaTabela()[0]);
    const gaveta = document.getElementById("entrevistasGaveta");
    expect(gaveta.classList.contains("ui-gaveta-fundo")).toBe(true);
    expect(gaveta.querySelector(".ui-gaveta-contexto").textContent).toContain(
      "DSEI Xingu",
    );
    expect(gaveta.querySelectorAll(".ui-secao")).toHaveLength(2);
    await teclar(document, "Escape");
    expect(document.getElementById("entrevistasGaveta")).toBeNull();
  });

  it("Exportar baixa o CSV do recorte, com a área no nome", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    await escolher(document.getElementById("filtro-parecer"), "INAPTO");
    await clicar(secao.querySelector('[data-acao="exportar"]'));
    expect(baixar).toHaveBeenCalledTimes(1);
    const [conteudo, nome] = baixar.mock.calls[0];
    expect(nome).toMatch(/^entrevistas-saude-indigena-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(conteudo).toContain("Bruno");
    expect(conteudo).not.toContain("onerror");
  });

  it("os gráficos são Chart.js; clicar na fatia filtra a tela", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    expect(
      graficos
        .filter((g) => g.canvas.isConnected)
        .map((g) => g.canvas.id)
        .sort(),
    ).toEqual([
      "chartComparecimento",
      "chartCriterios",
      "chartFaixas",
      "chartParecer",
      "chartUnidades",
    ]);
    const parecer = graficos.find(
      (g) => g.canvas.id === "chartParecer" && g.canvas.isConnected,
    );
    expect(parecer.config.type).toBe("doughnut");
    const indice = parecer.data.labels.indexOf("Inapto");
    await act(async () => parecer.options.onClick(null, [{ index: indice }]));
    expect(linhasDaTabela()).toHaveLength(1);
    expect(
      secao
        .querySelector('.entrevistas-kpis [data-kpi="inaptos"]')
        .classList.contains("is-ativo"),
    ).toBe(true);
  });
});

describe("tema do app", () => {
  it("segue o tema do app: o escuro (data-theme + agsus:tema-alterado) redesenha os gráficos", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    const grafico = graficos.find(
      (g) => g.canvas.id === "chartFaixas" && g.canvas.isConnected,
    );
    const antes = grafico.atualizacoes;
    expect(grafico.options.scales.y.ticks.color).toBe("#526780");

    await act(async () => {
      document.documentElement.setAttribute("data-theme", "dark");
      document.dispatchEvent(new CustomEvent(EVENTO_TEMA_ALTERADO));
    });
    expect(grafico.atualizacoes).toBeGreaterThan(antes);
    expect(grafico.options.scales.y.ticks.color).toBe("#dbe8f5");
    // Não guarda tema próprio: quem guarda é o app.
    expect(localStorage.getItem("agsus_analises_theme_v3")).toBeNull();
  });

  it("as cores dos gráficos vêm dos tokens do app quando eles existem", async () => {
    document.documentElement.style.setProperty("--text-secondary", "#123456");
    try {
      await montar(supabaseFalso({ data: PAYLOAD, error: null }));
      const grafico = graficos.find(
        (g) => g.canvas.id === "chartUnidades" && g.canvas.isConnected,
      );
      expect(grafico.options.scales.x.ticks.color).toBe("#123456");
    } finally {
      document.documentElement.style.removeProperty("--text-secondary");
    }
  });
});

describe("área atual do app", () => {
  it("trocar a área com a tela aberta recarrega com a nova e zera os filtros", async () => {
    const supabase = supabaseDaConducao();
    await montar(supabase);
    await clicar(
      secao.querySelector('.entrevistas-kpis [data-kpi="aptos"] button'),
    );
    expect(linhasDaTabela()).toHaveLength(1);

    await act(async () => definirAreaAtual("sede"));
    await esperar();
    expect(chamadas(supabase, "get_entrevistas_da_area").at(-1)[1]).toEqual({
      p_area: "sede",
    });
    expect(painel.estado.obter().area).toBe("sede");
    expect(linhasDaTabela()).toHaveLength(2);
    expect(
      secao
        .querySelector('.entrevistas-kpis [data-kpi="aptos"]')
        .classList.contains("is-ativo"),
    ).toBe(false);
  });

  it("na troca de área, o edital aberto sai e a condução relê os editais da nova área (a visão fica)", async () => {
    const supabase = supabaseDaConducao();
    await montar(supabase);
    await abrirEdital();
    expect(document.querySelector('[data-passo="convocacao"]')).not.toBeNull();

    await act(async () => definirAreaAtual("projetos"));
    await esperar();
    expect(visao("conduzir").getAttribute("aria-checked")).toBe("true");
    expect(document.querySelector('[data-passo="convocacao"]')).toBeNull();
    expect(document.getElementById("entrevistasEdital").value).toBe("");
    expect(chamadas(supabase, "listar_editais_entrevista").at(-1)[1]).toEqual({
      p_area: "projetos",
      p_todos: false,
    });
    expect(chamadas(supabase, "listar_roteiros_entrevista").at(-1)[1]).toEqual({
      p_area: "projetos",
    });
  });

  it("cada abertura pega a área de agora; na mesma área, relê por trás", async () => {
    const supabase = supabaseFalso({ data: PAYLOAD, error: null });
    await montar(supabase);
    await abrirATela();
    expect(chamadas(supabase, "get_entrevistas_da_area")).toHaveLength(2);
    definirAreaAtual("projetos");
    await abrirATela();
    expect(supabase.rpc).toHaveBeenLastCalledWith("get_entrevistas_da_area", {
      p_area: "projetos",
    });
  });

  it("render relê as comemorações do app", async () => {
    let ligadas = false;
    await montar(supabaseFalso({ data: PAYLOAD, error: null }), {
      comemoracoesLigadas: () => ligadas,
    });
    expect(painel.estado.obter().comemoracoes).toBe(false);
    ligadas = true;
    await abrirATela();
    expect(painel.estado.obter().comemoracoes).toBe(true);
  });

  it("outro usuário na mesma aba: o que era do anterior sai da tela", async () => {
    const avisar = [];
    const supabase = supabaseDaConducao();
    supabase.auth.onAuthStateChange = (ouvinte) => {
      avisar.push(ouvinte);
      return { data: { subscription: { unsubscribe() {} } } };
    };
    await montar(supabase);
    const todos = (usuario) =>
      act(async () => avisar.forEach((f) => f("SIGNED_IN", usuario)));
    await todos({ user: { id: "a" } });
    expect(linhasDaTabela()).toHaveLength(2);
    await abrirEdital();

    await todos({ user: { id: "b" } });
    expect(painel.estado.obter().carregado).toBe(false);
    expect(painel.estado.obter().area).toBe("");
    expect(painel.conducao.obter().edital).toBeNull();
    expect(naTela("Bruno")).toBe(false);
  });
});

describe("carga", () => {
  it("antes do dado, o skeleton dos KPIs, gráficos, pendências e tabela; depois, os números", async () => {
    let responder;
    const supabase = {
      ...supabaseFalso(),
      rpc: vi.fn(
        () =>
          new Promise((ok) => {
            responder = ok;
          }),
      ),
    };
    await montar(supabase);
    const total = secao.querySelector('.entrevistas-kpis [data-kpi="vagas"]');
    expect(total.getAttribute("aria-busy")).toBe("true");
    expect(total.querySelector(".ui-esqueleto")).not.toBeNull();
    expect(secao.querySelectorAll(".ui-grafico.is-carregando")).toHaveLength(5);
    expect(secao.querySelectorAll(".ui-pendencias .ui-esqueleto")).toHaveLength(
      4,
    );
    expect(
      secao.querySelectorAll('.ui-tabela tbody tr[aria-hidden="true"]'),
    ).toHaveLength(8);
    expect(status().textContent).toBe("Carregando dados...");

    await esperar(() => responder({ data: PAYLOAD, error: null }));
    expect(kpi("vagas")).toBe("2");
    expect(secao.querySelector(".ui-grafico.is-carregando")).toBeNull();
  });

  it("falha na primeira carga: aviso com Tentar novamente", async () => {
    let falhar = true;
    const supabase = {
      ...supabaseFalso(),
      rpc: vi.fn(async () =>
        falhar
          ? { data: null, error: { code: "PGRST202", message: "x" } }
          : { data: PAYLOAD, error: null },
      ),
    };
    await montar(supabase);
    const aviso = secao.querySelector(".ui-aviso[role=alert]");
    expect(aviso.textContent).toContain(
      "A aba Entrevistas ainda não foi publicada no banco.",
    );
    expect(status().textContent).toBe("Sem dados");
    falhar = false;
    await clicar(botao("Tentar novamente"));
    await esperar();
    expect(kpi("vagas")).toBe("2");
    expect(secao.querySelector(".ui-aviso[role=alert]")).toBeNull();
  });

  it("falha ao atualizar com a tela carregada: o aviso global do app (toast)", async () => {
    let falhar = false;
    const supabase = {
      ...supabaseFalso(),
      rpc: vi.fn(async () =>
        falhar
          ? { data: null, error: { message: "rede" } }
          : { data: PAYLOAD, error: null },
      ),
    };
    await montar(supabase);
    falhar = true;
    await clicar(secao.querySelector('[data-acao="atualizar"]'));
    await esperar();
    expect(toast).toHaveBeenCalledWith(
      expect.stringContaining("Não foi possível atualizar as entrevistas"),
      "error",
    );
    expect(kpi("vagas")).toBe("2");
  });

  it("sem sessão no cliente do app, avisa e não pede as entrevistas", async () => {
    const supabase = supabaseFalso(
      { data: PAYLOAD, error: null },
      { getSession: async () => ({ data: { session: null } }) },
    );
    await montar(supabase);
    expect(secao.querySelector(".ui-aviso[role=alert]").textContent).toBe(
      "Sessão não localizada. Entre de novo no MONITORA.",
    );
    expect(status().textContent).toBe("Sessão não localizada");
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(secao.querySelector(".entrevistas-visoes")).toBeNull();
  });

  it("Atualizar na visão Conduzir relê os resultados, os editais e o edital aberto", async () => {
    const supabase = supabaseDaConducao();
    await montar(supabase);
    await abrirEdital();
    const antes = {
      resultados: chamadas(supabase, "get_entrevistas_da_area").length,
      editais: chamadas(supabase, "listar_editais_entrevista").length,
      edital: chamadas(supabase, "obter_entrevistas_do_edital").length,
    };
    await clicar(secao.querySelector('[data-acao="atualizar"]'));
    await esperar();
    expect(chamadas(supabase, "get_entrevistas_da_area").length).toBe(
      antes.resultados + 1,
    );
    expect(chamadas(supabase, "listar_editais_entrevista").length).toBe(
      antes.editais + 1,
    );
    expect(chamadas(supabase, "obter_entrevistas_do_edital").length).toBe(
      antes.edital + 1,
    );
  });
});
