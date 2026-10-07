import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clicar, digitar, esperar } from "./interacoes.js";

/*
  Status das atualizações › "Opções" dos robôs (React): a gaveta "Rodar com
  opções" (editais vigentes, códigos colados com validação e cargo, modo com
  explicação, limite e prévia), o pedido ao /api/rodar-carga com as opções,
  o acompanhamento depois do pedido e as últimas execuções em "Detalhes".
  Supabase e /api/rodar-carga falsos; nada roda de verdade.
*/

const { montarSaudeDasCargas } =
  await import("../../src/componentes/saude-das-cargas/saude-das-cargas.jsx");

const AGORA = new Date("2026-10-07T12:00:00Z");
const ha = (min) => new Date(AGORA.getTime() - min * 60000).toISOString();
const ID_93 = "11111111-1111-4111-a111-111111111193";
const ID_80 = "11111111-1111-4111-a111-111111111180";

const SAUDE = {
  schema_version: 1,
  gerado_em: AGORA.toISOString(),
  analises: [],
  entrevistas: [],
  selecao: [],
  empregare: [
    {
      inicio: ha(60),
      fim: ha(30),
      situacao: "CONCLUIDA",
      linhas: 812,
      vagas_pedidas: 5,
      vagas_baixadas: 5,
      disparo: "MONITORA",
    },
  ],
  conferencias: [],
  pre_classificacao: [],
  tarefas: null,
};

const execucaoNova = {
  id: "gh-3",
  inicio: new Date(AGORA.getTime() + 60000).toISOString(),
  situacao: "EM_ANDAMENTO",
  disparo: "MONITORA",
  quem: "Pessoa Admin",
  filtro: { editais: [], vagas: ["179698", "180231"], limite: null },
  vagas_pedidas: 2,
  vagas_baixadas: 1,
  linhas: 210,
  execucao: "https://github.com/AgSUS-COGIP/agsus-monitora/actions/runs/3",
  por_vaga: [
    {
      vaga: "179698",
      situacao: "GRAVADA",
      arquivo: 210,
      ativos: 208,
      com_link: 200,
    },
  ],
};

const PAINEL = {
  schema_version: 1,
  gerado_em: AGORA.toISOString(),
  areas: [
    { area: "projetos", nome: "Projetos" },
    { area: "saude-indigena", nome: "Saúde Indígena" },
  ],
  editais: [
    {
      id: ID_93,
      numero: "93/2026",
      area: "projetos",
      unidade: "SESMT",
      ativo: true,
      status: "Em andamento",
    },
    {
      id: ID_80,
      numero: "80/2026",
      area: "saude-indigena",
      unidade: "DSEI Yanomami",
      ativo: true,
      status: "Concluído",
    },
  ],
  empregare: [
    {
      id: "gh-1",
      inicio: ha(60),
      fim: ha(30),
      situacao: "CONCLUIDA",
      disparo: "MONITORA",
      quem: "Pessoa Admin",
      filtro: { editais: ["93/2026"], vagas: [], limite: 10 },
      vagas_pedidas: 5,
      vagas_baixadas: 5,
      linhas: 812,
      execucao: "https://github.com/AgSUS-COGIP/agsus-monitora/actions/runs/1",
      por_vaga: [
        {
          vaga: "180232",
          situacao: "RECUSADA",
          arquivo: 40,
          ativos: 120,
          com_link: 120,
        },
      ],
    },
  ],
  pre_classificacao: [],
};

const VAGAS = [
  {
    vaga: "179698",
    edital_id: ID_93,
    cargo: "Técnico de Segurança do Trabalho",
  },
  {
    vaga: "180231",
    edital_id: ID_93,
    cargo: "Engenheiro de Segurança do Trabalho",
  },
  { vaga: "180232", edital_id: ID_93, cargo: "Médico do Trabalho" },
];

const respostaHttp = (status, corpo = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => corpo,
});

let raiz;
let controlador;
let depoisDoPedido;

function supabaseFalso() {
  return {
    rpc: vi.fn(async (nome, args) => {
      if (nome === "get_saude_das_cargas") return { data: SAUDE, error: null };
      if (nome === "get_painel_dos_robos")
        return {
          data: depoisDoPedido
            ? { ...PAINEL, empregare: [execucaoNova, ...PAINEL.empregare] }
            : PAINEL,
          error: null,
        };
      if (nome === "listar_vagas_dos_robos") {
        const editais = new Set(args.p_editais || []);
        const codigos = new Set(args.p_vagas || []);
        return {
          data: VAGAS.filter(
            (v) => editais.has(v.edital_id) || codigos.has(v.vaga),
          ),
          error: null,
        };
      }
      return { data: [], error: null };
    }),
  };
}

async function montar() {
  depoisDoPedido = false;
  raiz = document.createElement("div");
  document.body.append(raiz);
  const supabase = supabaseFalso();
  const buscar = vi.fn(async (_url, opcoes) => {
    if (opcoes?.method === "POST") {
      depoisDoPedido = true;
      return respostaHttp(202, { ok: true, robo: "empregare" });
    }
    return respostaHttp(200, {
      configurado: true,
      robos: { empregare: { rodando: false, ultima: null } },
    });
  });
  const agendar = vi.fn();
  await act(async () => {
    controlador = montarSaudeDasCargas({
      raizDaTela: raiz,
      supabase,
      getProfile: () => ({ id: "u", ativo: true, admin_global: true }),
      agora: () => AGORA,
      buscar,
      obterToken: async () => "token-do-usuario",
      agendar,
    });
  });
  await act(async () => {
    await controlador.render();
  });
  await esperar();
  return { supabase, buscar, agendar };
}

const gaveta = () => document.querySelector(".robos-opcoes");
const botaoRodar = () => gaveta().querySelector('button[type="submit"]');
const textoDaPrevia = () =>
  gaveta().querySelector(".robos-opcoes__frase").textContent;
const esperarBusca = () =>
  esperar(() => new Promise((r) => setTimeout(r, 420)));

async function abrirOpcoes(id = "empregare") {
  await clicar(document.querySelector(`[data-carga="${id}"] .saude-opcoes`));
}

async function escolherEdital(rotulo) {
  await clicar(gaveta().querySelector(".multi-select-trigger"));
  const opcao = [...gaveta().querySelectorAll(".multi-select-option")].find(
    (o) => o.textContent.includes(rotulo),
  );
  await clicar(opcao.querySelector('input[type="checkbox"]'));
}

afterEach(async () => {
  await act(async () => controlador?.raiz?.unmount());
  raiz?.remove();
  document.body.innerHTML = "";
});

describe("Rodar com opções", () => {
  it("só o robô da Empregare, a pré-classificação e as conferências têm Opções", async () => {
    await montar();
    const comOpcoes = [...document.querySelectorAll(".saude-opcoes")].map(
      (b) => b.closest("[data-carga]").dataset.carga,
    );
    expect(comOpcoes.sort()).toEqual([
      "conferencias",
      "empregare",
      "pre_classificacao",
    ]);
    expect(
      document.querySelector('[data-carga="selecao"] .saude-opcoes'),
    ).toBeNull();
  });

  it("editais: só os vigentes por padrão; mostrar todos traz os outros", async () => {
    await montar();
    await abrirOpcoes();
    expect(gaveta().textContent).toContain("Robô da Empregare");
    await clicar(gaveta().querySelector(".multi-select-trigger"));
    const rotulos = () =>
      [...gaveta().querySelectorAll(".multi-select-option")].map((o) =>
        o.textContent.trim(),
      );
    expect(rotulos()).toEqual(["93/2026 · SESMT (Projetos)"]);
    expect(gaveta().textContent).toContain("Mostrar todos (1 não vigentes)");
    await clicar(gaveta().querySelector(".robos-opcoes__todos input"));
    expect(rotulos()).toHaveLength(2);
  });

  it("edital escolhido: sugere as vagas conhecidas com o cargo e a prévia lista os códigos", async () => {
    const { supabase } = await montar();
    await abrirOpcoes();
    await escolherEdital("93/2026");
    await esperarBusca();
    expect(supabase.rpc).toHaveBeenCalledWith("listar_vagas_dos_robos", {
      p_editais: [ID_93],
      p_vagas: null,
    });
    const sugestoes = gaveta().querySelector(".robos-opcoes__sugestoes");
    expect(sugestoes.textContent).toContain("180231");
    expect(sugestoes.textContent).toContain(
      "Engenheiro de Segurança do Trabalho",
    );
    expect(textoDaPrevia()).toBe("3 vagas do 93/2026: 179698, 180231, 180232");
    // Clicar numa sugestão põe o código no campo.
    await clicar(sugestoes.querySelector(".robos-opcoes__sugestao"));
    expect(gaveta().querySelector("textarea").value).toBe("179698");
  });

  it("códigos colados: recusa o que não é só dígito, mostra o cargo e bloqueia o Rodar", async () => {
    await montar();
    await abrirOpcoes();
    await digitar(gaveta().querySelector("textarea"), "179698, 17797x\n999999");
    await esperarBusca();
    expect(gaveta().querySelector(".ui-campo-erro").textContent).toContain(
      "Código inválido: 17797x (só dígitos).",
    );
    expect(botaoRodar().disabled).toBe(true);
    const escolhidos = gaveta().querySelector(".robos-opcoes__codigos");
    expect(
      escolhidos.querySelector('[data-vaga="179698"]').textContent,
    ).toContain("Técnico de Segurança do Trabalho");
    expect(
      escolhidos.querySelector('[data-vaga="999999"]').textContent,
    ).toContain("não conhecida");
    await digitar(gaveta().querySelector("textarea"), "179698 999999");
    expect(botaoRodar().disabled).toBe(false);
    // Tirar um código pelo ×.
    await clicar(gaveta().querySelector('[aria-label="Tirar a vaga 999999"]'));
    expect(gaveta().querySelector("textarea").value).toBe("179698");
  });

  it("modo com explicação curta; limite fora de 1 a 500 bloqueia", async () => {
    await montar();
    await abrirOpcoes();
    expect(gaveta().textContent).toContain(
      "Exporta, baixa e grava os candidatos de cada vaga.",
    );
    await clicar(gaveta().querySelector('[data-valor="fumaca"]'));
    expect(gaveta().textContent).toContain("Só testa o login na Empregare");
    expect(textoDaPrevia()).toBe("Só o teste de login na Empregare.");
    await clicar(gaveta().querySelector('[data-valor="seco"]'));
    expect(gaveta().textContent).toContain("Só lista as vagas que exportaria");
    await digitar(gaveta().querySelector('input[type="number"]'), "900");
    expect(gaveta().textContent).toContain("Limite de 1 a 500 vagas.");
    expect(botaoRodar().disabled).toBe(true);
    await digitar(gaveta().querySelector('input[type="number"]'), "20");
    expect(botaoRodar().disabled).toBe(false);
    expect(textoDaPrevia()).toBe(
      "As vagas dos editais em curso, até 20 (as nunca carregadas primeiro).",
    );
  });

  it("confirma: pede ao /api/rodar-carga com as opções, fecha e acompanha a execução", async () => {
    const { buscar, agendar } = await montar();
    await abrirOpcoes();
    await escolherEdital("93/2026");
    await digitar(gaveta().querySelector("textarea"), "179698, 180231");
    await clicar(gaveta().querySelector('[data-valor="forcar"]'));
    await digitar(gaveta().querySelector('input[type="number"]'), "2");
    await esperarBusca();
    await clicar(botaoRodar());
    await esperar();
    const post = buscar.mock.calls.find(([, o]) => o?.method === "POST");
    expect(JSON.parse(post[1].body)).toEqual({
      robo: "empregare",
      opcoes: {
        modo: "forcar",
        editais: ["93/2026"],
        vagas: ["179698", "180231"],
        limite: 2,
      },
    });
    expect(post[1].headers.Authorization).toBe("Bearer token-do-usuario");
    expect(gaveta()).toBeNull();
    const acompanhamento = () =>
      document.querySelector('[data-carga="empregare"] .robos-acompanhamento');
    expect(acompanhamento().textContent).toContain(
      "Pedido enviado. Aguardando o GitHub.",
    );
    expect(acompanhamento().textContent).toContain(
      "2 vagas do 93/2026: 179698, 180231",
    );
    expect(agendar).toHaveBeenCalledTimes(1);

    // A releitura agendada traz a execução do banco: rodando, por vaga e o link do GitHub.
    await act(async () => {
      await agendar.mock.calls[0][0]();
    });
    await esperar();
    expect(acompanhamento().textContent).toContain("Rodando.");
    expect(acompanhamento().textContent).toContain(
      "1 de 2 vagas baixadas · 210 candidatos",
    );
    expect(
      acompanhamento().querySelector('[data-vaga="179698"]').textContent,
    ).toContain("Gravada");
    expect(
      acompanhamento().querySelector("a.robos-github").getAttribute("href"),
    ).toBe("https://github.com/AgSUS-COGIP/agsus-monitora/actions/runs/3");
    // Enquanto roda, relê de novo.
    expect(agendar).toHaveBeenCalledTimes(2);
    await clicar(
      acompanhamento().querySelector(".robos-acompanhamento__fechar"),
    );
    expect(acompanhamento()).toBeNull();
  });

  it("Detalhes: as últimas execuções com quem pediu, parâmetros, resultado e por vaga", async () => {
    await montar();
    await clicar(
      document.querySelector('[data-carga="empregare"] [aria-expanded]'),
    );
    const tabela = document.querySelector(
      '[data-carga="empregare"] .robos-execucoes',
    );
    expect(tabela.textContent).toContain("Pessoa Admin");
    expect(tabela.textContent).toContain("Edital 93/2026 · limite 10");
    expect(tabela.textContent).toContain(
      "5 de 5 vagas baixadas · 812 candidatos",
    );
    expect(tabela.querySelector('[data-vaga="180232"]').textContent).toContain(
      "Recusada pela trava",
    );
    expect(
      tabela.querySelector("a.robos-github").getAttribute("href"),
    ).toContain("/runs/1");
  });

  it("pré-classificação: editais pelo id, sem vagas nem limite", async () => {
    const { buscar } = await montar();
    await abrirOpcoes("pre_classificacao");
    expect(gaveta().querySelector("textarea")).toBeNull();
    expect(gaveta().querySelector('input[type="number"]')).toBeNull();
    await escolherEdital("93/2026");
    await clicar(gaveta().querySelector('[data-valor="refazer_lote"]'));
    expect(textoDaPrevia()).toBe("Refaz o lote de 1 edital: 93/2026.");
    await clicar(botaoRodar());
    await esperar();
    const post = buscar.mock.calls.find(([, o]) => o?.method === "POST");
    expect(JSON.parse(post[1].body)).toEqual({
      robo: "pre_classificacao",
      opcoes: {
        modo: "refazer_lote",
        editais: [ID_93],
        vagas: [],
        limite: null,
      },
    });
  });

  it("sem a função do painel no banco: avisa a migration e o resto continua", async () => {
    raiz = document.createElement("div");
    document.body.append(raiz);
    const supabase = {
      rpc: vi.fn(async (nome) =>
        nome === "get_saude_das_cargas"
          ? { data: SAUDE, error: null }
          : { data: null, error: { code: "PGRST202", message: "não existe" } },
      ),
    };
    await act(async () => {
      controlador = montarSaudeDasCargas({
        raizDaTela: raiz,
        supabase,
        getProfile: () => ({ id: "u", ativo: true, admin_global: true }),
        agora: () => AGORA,
        buscar: vi.fn(async () =>
          respostaHttp(200, { configurado: true, robos: {} }),
        ),
        obterToken: async () => "t",
        agendar: vi.fn(),
      });
    });
    await act(async () => {
      await controlador.render();
    });
    await abrirOpcoes();
    expect(gaveta().textContent).toContain(
      "20261007180000_painel_dos_robos.sql",
    );
    expect(gaveta().querySelector("textarea")).not.toBeNull();
  });
});
