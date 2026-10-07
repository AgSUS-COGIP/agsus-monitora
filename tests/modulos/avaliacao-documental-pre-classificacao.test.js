import { readFileSync } from "node:fs";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.js";
import { montarAvaliacaoDocumental } from "../../src/modulos/avaliacao-documental/avaliacao-documental.jsx";
import {
  clicar,
  digitar,
  escolher,
  esperar,
} from "../componentes/interacoes.js";

/*
  A aba Pré-classificação da Avaliação documental (fase F2): lê o que o job
  Python gravou (obter_pre_classificacao), mostra os contadores, a linha de
  corte, a divergência ART × declarada e os eliminados; a coordenação pede o
  recálculo (POST /api/rodar-carga com o edital), muda o tamanho do lote por
  vaga (versão nova da regra) e registra/exporta as listas PROVISORIA e LOTE.
  Códigos AM-4.x, AM-5.x e AM-16.x de docs/historias-de-usuario/analises-no-monitora.md.
*/

const { regras } = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
    "utf8",
  ),
);
const PROJ = regras["PROJ26-CURRICULAR"];
const CONFIG = {
  ...PROJ,
  lote: { ...PROJ.lote, base: "MULTIPLO_VAGAS", publica_reposicao: true },
};

const regraSalva = (versao, configuracao = CONFIG, situacao = "CONFERIDA") => ({
  versao,
  situacao,
  modelo_origem: "PROJ26-CURRICULAR",
  configuracao,
  atualizado_em: "2026-10-06T12:00:00Z",
  por: "Gestora",
  versoes: [
    {
      versao,
      em: "2026-10-06T12:00:00Z",
      por: "Gestora",
      motivo: "",
      configuracao,
    },
  ],
});

const inscrito = (codigo, extra) => ({
  id: `id-${codigo}`,
  vaga: "179698",
  codigo,
  nome: `Pessoa ${codigo}`,
  situacao: "RANQUEADO",
  motivo: null,
  art: 20,
  nota: 20,
  origem_nota: "ART",
  declarada: null,
  divergente: false,
  modalidade: "AC",
  posicao: null,
  lote: null,
  motivo_entrada: null,
  ...extra,
});

const PRE = (regra, pode = true, extra = {}) => ({
  schema_version: 1,
  edital: {
    id: "e93",
    edital: "93/2026",
    unidade: "Boa Vista",
    area: "projetos",
    rotulo: "93/2026",
  },
  papel: pode ? "COORDENADOR" : null,
  pode_coordenar: pode,
  pode_registrar_lista: pode,
  pode_publicar_lista: pode,
  regra: regra
    ? {
        versao: regra.versao,
        situacao: regra.situacao,
        configuracao: regra.configuracao,
      }
    : null,
  regra_classificacao: { versao: 1, configuracao: {} },
  em_andamento: false,
  ultima_execucao: {
    id: "precl-1",
    inicio: "2026-10-06T12:00:00Z",
    fim: "2026-10-06T12:01:00Z",
    situacao: "CONCLUIDA",
    disparo: "ROBO",
    edital: { edital: "e93", situacao: "PROCESSADO" },
  },
  vagas: [
    {
      codigo: "179698",
      candidatos_empregare: 5,
      cargo: "Técnico de Segurança do Trabalho",
      lotacao: "Boa Vista",
      vagas_imediatas: 1,
      cadastro_reserva: true,
      inscritos: 5,
      eliminados: 1,
      ranqueados: 4,
      no_lote: 2,
      tamanho: 2,
      descricao: "1 × (1 + CR) = 2",
      art_corte: 24,
      divergencias: 1,
      avisos: ["FORA_DO_LOTE_ACIMA_DO_CORTE"],
    },
    {
      codigo: "180231",
      candidatos_empregare: 7,
      inscritos: null,
      tamanho: null,
      avisos: [],
    },
  ],
  candidatos: [
    inscrito("7000001", {
      situacao: "NO_LOTE",
      posicao: 1,
      art: 26,
      nota: 26,
      lote: 1,
      motivo_entrada: "Lote inicial",
    }),
    inscrito("7000003", {
      situacao: "NO_LOTE",
      posicao: 2,
      art: 24,
      nota: 24,
      lote: 2,
      declarada: 10,
      divergente: true,
      motivo_entrada: "Entrou no lugar de 7000009 (Cancelou a inscrição)",
    }),
    inscrito("7000004", { posicao: 3, art: 22, nota: 22 }),
    inscrito("7000005", { posicao: 4, art: 18, nota: 18 }),
    inscrito("7000009", {
      situacao: "ELIMINADO",
      motivo: "Cancelou a inscrição",
      art: 29,
      nota: 29,
    }),
  ],
  listas: [],
  ...extra,
});

function supabaseFalso({ pode = true, situacao = "CONFERIDA", pre } = {}) {
  let regra = regraSalva(2, CONFIG, situacao);
  const respostas = {
    listar_editais_avaliacao: () => ({
      area: "projetos",
      editais: [
        {
          id: "e93",
          edital: "93/2026",
          unidade: "Boa Vista",
          ativo: true,
          versao_regra: regra.versao,
        },
      ],
    }),
    obter_regra_analise: () => ({
      edital: { id: "e93", edital: "93/2026", area: "projetos" },
      papel: pode ? "COORDENADOR" : null,
      pode_coordenar: pode,
      origem: "PLANILHA",
      regra,
      modelos: [],
      nota_minima: { nota_minima: 15 },
      aldeias: { quantidade: 0 },
      perguntas: [],
      fichas_concluidas: 0,
    }),
    obter_equipe_edital: () => ({
      papel: null,
      pode_coordenar: pode,
      gestores: [],
      equipe: [],
      pessoas: [],
      vagas: [],
    }),
    obter_pre_classificacao: () => pre ?? PRE(regra, pode),
    salvar_regra_analise: ({ p_configuracao, p_versao_atual }) => {
      regra = regraSalva(p_versao_atual + 1, p_configuracao, "CONFERIR");
      return { regra, fichas_afetadas: [] };
    },
    registrar_lista_pre_classificacao: ({ p_tipo, p_lote }) => ({
      lista: { id: `lista-${p_tipo}`, tipo: p_tipo },
      resultado: {
        schema: 1,
        tipo: p_tipo,
        lote: p_lote,
        edital: { id: "e93", edital: "Edital 93/2026", unidade: "Boa Vista" },
        casas: 1,
        modalidades: [],
        vagas: [
          {
            chave: "179698",
            codigo: "179698",
            cabecalho:
              "VAGA 179698 - Técnico de Segurança do Trabalho - 1 vaga + CR",
            geral: [
              {
                posicao: 1,
                nome: "Pessoa 7000001",
                nota: 26,
                modalidades: ["AC"],
              },
              {
                posicao: 2,
                nome: "Pessoa 7000003",
                nota: 24,
                modalidades: ["AC"],
              },
            ],
            listas: {},
            eliminados:
              p_tipo === "PROVISORIA"
                ? [
                    {
                      nome: "Pessoa 7000009",
                      motivo: "Cancelou a inscrição",
                      detalhe: "",
                    },
                  ]
                : [],
          },
        ],
        totais: { elegiveis: 2, eliminados: 1 },
      },
    }),
  };
  return {
    rpc: vi.fn(async (nome, args) => ({
      data: respostas[nome]?.(args) ?? null,
      error: null,
    })),
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: "u" }, access_token: "t" } },
      }),
    },
  };
}

let secao;
let painel;
const toast = vi.fn();
const buscar = vi.fn(async () => ({
  status: 202,
  json: async () => ({ ok: true }),
}));
/* As releituras do acompanhamento do Recalcular: o teste as roda à mão. */
let agendados = [];
const agendar = (fn) => agendados.push(fn);
const rodarAgendado = () =>
  act(async () => {
    await agendados.shift()();
  });

async function montar(supabase) {
  secao = document.createElement("section");
  secao.id = "page-avaliacao-documental";
  secao.className = "page active";
  document.body.append(secao);
  await act(async () => {
    painel = montarAvaliacaoDocumental({
      supabase,
      toast,
      buscar,
      obterToken: async () => "token",
      agendar,
    });
  });
  await act(async () => void painel.render());
  await esperar();
  await escolher(secao.querySelector(".avd-edital select"), "e93");
  await esperar();
  const aba = [...secao.querySelectorAll("button")].find((b) =>
    b.textContent.includes("Pré-classificação"),
  );
  await clicar(aba);
  await esperar();
}
const botao = (texto) =>
  [...secao.querySelectorAll("button")].find((b) =>
    b.textContent.trim().startsWith(texto),
  );

beforeEach(() => {
  redefinirDadosDoMonitoramento();
  definirAreaAtual("projetos");
});
afterEach(async () => {
  await act(async () => painel?.raiz?.unmount());
  secao?.remove();
  document.body.innerHTML = "";
  redefinirDadosDoMonitoramento();
  toast.mockClear();
  buscar.mockClear();
  agendados = [];
});

describe("Pré-classificação (AM-4)", () => {
  it("AM-4.4: contadores, linha de corte, divergência e eliminados à parte", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    expect(supabase.rpc).toHaveBeenCalledWith("obter_pre_classificacao", {
      p_edital: "e93",
    });
    const kpis = secao.querySelector(".ui-kpis").textContent;
    expect(kpis).toContain("Inscritos5");
    expect(kpis).toContain("Eliminados1");
    expect(kpis).toContain("2 de 2");
    const vaga = secao.querySelector("[data-vaga='179698']");
    expect(vaga.textContent).toContain(
      "VAGA 179698 - Técnico de Segurança do Trabalho - Boa Vista - 1 vaga + CR",
    );
    expect(vaga.textContent).toContain("linha de corte 24");
    const linhas = [...vaga.querySelectorAll("tbody tr")].map(
      (tr) => tr.dataset.candidato || tr.textContent,
    );
    expect(linhas.slice(0, 5)).toEqual([
      "7000001",
      "7000003",
      "Linha de corte",
      "7000004",
      "7000005",
    ]);
    expect(
      vaga.querySelector("[data-candidato='7000003']").textContent,
    ).toContain("diverge");
    expect(vaga.querySelector(".avd-eliminados").textContent).toContain(
      "Cancelou a inscrição",
    );
    expect(vaga.textContent).toContain(
      "Fora do lote com nota acima da linha de corte",
    );
    expect(secao.querySelector("[data-vaga='180231']").textContent).toContain(
      "ainda sem pré-classificação",
    );
  });

  it("Recalcular pede o job só do edital; leitor não vê o botão", async () => {
    await montar(supabaseFalso());
    await clicar(secao.querySelector("[data-acao='recalcular']"));
    await esperar();
    expect(buscar).toHaveBeenCalledWith(
      "/api/rodar-carga",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ robo: "pre_classificacao", edital: "e93" }),
      }),
    );
    expect(secao.querySelector("[data-acao='recalcular']").textContent).toBe(
      "Pedido enviado",
    );
    await act(async () => painel.raiz.unmount());
    secao.remove();
    await montar(supabaseFalso({ pode: false }));
    expect(secao.querySelector("[data-acao='recalcular']")).toBeNull();
    expect(secao.querySelector(".avd-vaga input")).toBeNull();
  });

  it("Atualizar e a reabertura da tela relêem a pré-classificação da aba aberta", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    const kpis = () => secao.querySelector(".ui-kpis").textContent;
    expect(kpis()).toContain("Inscritos5");
    const normal = supabase.rpc.getMockImplementation();
    const comInscritos = (n) => {
      const pre = PRE(regraSalva(2));
      pre.vagas[0] = { ...pre.vagas[0], inscritos: n };
      supabase.rpc.mockImplementation(async (nome, args) =>
        nome === "obter_pre_classificacao"
          ? { data: pre, error: null }
          : normal(nome, args),
      );
    };
    comInscritos(9);
    await clicar(secao.querySelector("[data-acao='atualizar']"));
    await esperar();
    expect(kpis()).toContain("Inscritos9");
    // Voltar à tela pelo menu ou "Atualizar dados" do app chamam render().
    comInscritos(11);
    await act(async () => void painel.render());
    await esperar();
    expect(kpis()).toContain("Inscritos11");
  });

  it("Recalcular que falha diz por quê e o botão volta", async () => {
    await montar(supabaseFalso());
    const recalcular = () => secao.querySelector("[data-acao='recalcular']");
    buscar.mockResolvedValueOnce({
      status: 404,
      json: async () => {
        throw new SyntaxError("não é json");
      },
    });
    await clicar(recalcular());
    await esperar();
    expect(secao.querySelector("[role='alert']").textContent).toBe(
      "Recálculo não pedido: Só na versão publicada.",
    );
    expect(recalcular().textContent).toBe("Recalcular");
    expect(recalcular().disabled).toBe(false);
    expect(toast).toHaveBeenLastCalledWith(
      "Recálculo não pedido: Só na versão publicada.",
      "error",
    );

    buscar.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await clicar(recalcular());
    await esperar();
    expect(secao.querySelector("[role='alert']").textContent).toMatch(
      /^Recálculo não pedido: /,
    );
    expect(recalcular().disabled).toBe(false);

    buscar.mockResolvedValueOnce({
      status: 403,
      json: async () => ({
        erro: "Só a coordenação da avaliação do edital recalcula a pré-classificação.",
      }),
    });
    await clicar(recalcular());
    await esperar();
    expect(secao.querySelector("[role='alert']").textContent).toBe(
      "Recálculo não pedido: Só a coordenação da avaliação do edital recalcula a pré-classificação.",
    );
    expect(agendados).toHaveLength(0);
  });

  it("Recalcular pedido avisa e relê sozinho até a execução terminar", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await clicar(secao.querySelector("[data-acao='recalcular']"));
    await esperar();
    expect(secao.querySelector("[role='status']").textContent).toMatch(
      /^Recálculo pedido às \d\d:\d\d\. A lista atualiza sozinha quando terminar\.$/,
    );
    expect(agendados).toHaveLength(1);

    const normal = supabase.rpc.getMockImplementation();
    const responder = (pre) =>
      supabase.rpc.mockImplementation(async (nome, args) =>
        nome === "obter_pre_classificacao"
          ? { data: pre, error: null }
          : normal(nome, args),
      );
    // 1ª releitura: o job está rodando.
    responder(PRE(regraSalva(2), true, { em_andamento: true }));
    await rodarAgendado();
    expect(secao.querySelector("[data-acao='recalcular']").textContent).toBe(
      "Rodando…",
    );
    expect(agendados).toHaveLength(1);
    // 2ª releitura: terminou, com a execução nova e os números novos.
    const nova = PRE(regraSalva(2), true, {
      ultima_execucao: {
        id: "precl-2",
        inicio: "2026-10-06T13:00:00Z",
        fim: "2026-10-06T13:01:00Z",
        situacao: "CONCLUIDA",
        disparo: "TELA",
        edital: { edital: "e93", situacao: "PROCESSADO" },
      },
    });
    nova.vagas[0] = { ...nova.vagas[0], inscritos: 9 };
    responder(nova);
    await rodarAgendado();
    expect(agendados).toHaveLength(0);
    expect(secao.querySelector(".ui-kpis").textContent).toContain("Inscritos9");
    expect(secao.querySelector("[role='status']").textContent).toMatch(
      /^Pré-classificação recalculada às \d\d:\d\d\.$/,
    );
    expect(secao.querySelector("[data-acao='recalcular']").textContent).toBe(
      "Recalcular",
    );
    expect(toast).toHaveBeenLastCalledWith(
      expect.stringMatching(/^Pré-classificação recalculada/),
      "success",
    );
  });

  it("regra não conferida trava o Recalcular e diz o que fazer", async () => {
    await montar(supabaseFalso({ situacao: "CONFERIR" }));
    expect(secao.querySelector("[data-acao='recalcular']").disabled).toBe(true);
    expect(secao.textContent).toContain(
      "Marque a regra como conferida na aba Regra para recalcular.",
    );
  });

  it("edital sem regra conferida na última execução vira aviso", async () => {
    const supabase = supabaseFalso();
    const regra = regraSalva(2);
    const pre = PRE(regra, true, {
      ultima_execucao: {
        id: "x",
        inicio: "2026-10-06T12:00:00Z",
        situacao: "CONCLUIDA",
        edital: { situacao: "SEM_REGRA" },
      },
    });
    await montar({
      ...supabase,
      rpc: vi.fn(async (nome, args) =>
        nome === "obter_pre_classificacao"
          ? { data: pre, error: null }
          : supabase.rpc(nome, args),
      ),
    });
    expect(secao.textContent).toContain("Edital sem regra conferida");
  });
});

describe("lote por vaga (AM-5.0)", () => {
  it("o tamanho editado vira versão nova da regra com motivo", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    const campo = secao.querySelector(
      "[data-vaga='179698'] input[type='number']",
    );
    expect(campo.placeholder).toBe("6");
    await digitar(campo, "4");
    expect(secao.querySelector("[data-acao='salvar-tamanhos']").disabled).toBe(
      true,
    );
    await digitar(
      secao.querySelector("[aria-label='Salvar os tamanhos do lote'] input"),
      "Lote do 93 definido pela coordenação",
    );
    await clicar(secao.querySelector("[data-acao='salvar-tamanhos']"));
    await esperar();
    const chamada = supabase.rpc.mock.calls.find(
      ([nome]) => nome === "salvar_regra_analise",
    );
    expect(chamada[1].p_configuracao.lote.por_vaga).toEqual({ 179698: 4 });
    expect(chamada[1].p_motivo).toBe("Lote do 93 definido pela coordenação");
    expect(chamada[1].p_versao_atual).toBe(2);
  });
});

describe("listas PROVISORIA e LOTE (AM-16)", () => {
  it("registra a Provisória e o lote de cada reposição e exporta pelo gerador da Classificação", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await clicar(botao("Registrar"));
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith(
      "registrar_lista_pre_classificacao",
      {
        p_edital: "e93",
        p_tipo: "PROVISORIA",
        p_lote: null,
      },
    );
    // publica_reposicao: o lote inicial e a reposição 2 aparecem para registrar.
    expect(botao("Registrar o lote inicial (1)")).toBeTruthy();
    await clicar(botao("Registrar a reposição 2 (1)"));
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith(
      "registrar_lista_pre_classificacao",
      {
        p_edital: "e93",
        p_tipo: "LOTE",
        p_lote: 2,
      },
    );
    expect(botao("Copiar para o SEI")).toBeTruthy();
    expect(botao("Eliminados: DOCX")).toBeTruthy();
  });
});

describe("inclusão no lote por decisão da coordenação", () => {
  const COM_DECISAO = (pode = true) => {
    const base = PRE(regraSalva(2), pode);
    return {
      ...base,
      vagas: [
        { ...base.vagas[0], no_lote: 3, no_lote_regra: 2, no_lote_decisao: 1 },
        base.vagas[1],
      ],
      candidatos: base.candidatos.map((c) =>
        c.codigo === "7000005"
          ? {
              ...c,
              situacao: "NO_LOTE",
              lote: 2,
              entrada: "DECISAO",
              motivo_entrada: "Critério CORES",
              decisao: {
                motivo: "Critério CORES",
                por: "Gestora",
                em: "2026-10-07T12:00:00Z",
                situacao_regra: "RANQUEADO",
              },
            }
          : c.codigo === "7000009"
            ? { ...c, motivo_codigo: "CANCELADO" }
            : c,
      ),
    };
  };
  const comRespostas = (pre, extras) => {
    const supabase = supabaseFalso({ pre });
    const original = supabase.rpc.getMockImplementation();
    supabase.rpc.mockImplementation(async (nome, args) =>
      extras[nome] ? extras[nome](args) : original(nome, args),
    );
    return supabase;
  };

  it('mostra o selo "Decisão: Critério CORES" e "N pela regra + M por decisão"; inclui com a sugestão do motivo', async () => {
    const incluir = vi.fn(() => ({
      data: { incluidos: 1, fichas_criadas: 1 },
      error: null,
    }));
    const supabase = comRespostas(COM_DECISAO(), {
      incluir_no_lote_por_decisao: incluir,
    });
    await montar(supabase);
    expect(secao.querySelector(".ui-kpis").textContent).toContain(
      "2 de 2 pela regra + 1 por decisão",
    );
    const vaga = secao.querySelector("[data-vaga='179698']");
    expect(vaga.querySelector("[data-lote-da-vaga]").textContent).toContain(
      "Lote: 2 de 2 pela regra + 1 por decisão",
    );
    const linha = vaga.querySelector("[data-candidato='7000005']");
    expect(linha.querySelector(".avd-selo-decisao").textContent).toBe(
      "Decisão: Critério CORES",
    );
    expect(linha.querySelector(".avd-selo-decisao").title).toContain(
      "Por Gestora",
    );

    await clicar(vaga.querySelector("[data-acao='incluir-por-decisao']"));
    const opcoes = [
      ...document.querySelectorAll(
        "table[aria-label='Candidatos fora do lote pela regra'] tbody tr",
      ),
    ].map((tr) => tr.dataset.candidato);
    expect(opcoes).toEqual(["7000004", "7000009"]);
    const motivo = document.querySelector("input[list='avdMotivosDaDecisao']");
    expect(motivo.value).toBe("Critério CORES");
    const confirmar = document.querySelector(
      "[data-acao='confirmar-incluir-por-decisao']",
    );
    expect(confirmar.disabled).toBe(true);
    await clicar(document.querySelector("input[aria-label='Incluir 7000009']"));
    await clicar(confirmar);
    await esperar();
    expect(incluir).toHaveBeenCalledWith({
      p_edital: "e93",
      p_codigos: ["7000009"],
      p_motivo: "Critério CORES",
      p_vaga: "179698",
    });
    expect(toast).toHaveBeenCalledWith(
      "1 candidato incluído no lote por decisão da coordenação.",
      "success",
    );
  });

  it("revoga com motivo; a ficha concluída o banco recusa e a tela diz por quê", async () => {
    const revogar = vi.fn(() => ({
      data: null,
      error: {
        code: "22023",
        message:
          "O candidato 7000005 já tem a ficha concluída: a decisão não se revoga.",
      },
    }));
    await montar(
      comRespostas(COM_DECISAO(), { revogar_decisao_lote: revogar }),
    );
    const linha = () => secao.querySelector("[data-candidato='7000005']");
    await clicar(linha().querySelector("[data-acao='abrir-revogar-decisao']"));
    const campo = linha().querySelector("[data-revogar='7000005'] input");
    await digitar(campo, "curto");
    expect(
      linha().querySelector("[data-acao='revogar-decisao']").disabled,
    ).toBe(true);
    await digitar(campo, "Decisão registrada por engano");
    await clicar(linha().querySelector("[data-acao='revogar-decisao']"));
    await esperar();
    expect(revogar).toHaveBeenCalledWith({
      p_edital: "e93",
      p_codigos: ["7000005"],
      p_motivo: "Decisão registrada por engano",
      p_vaga: "179698",
    });
    expect(linha().textContent).toContain("ficha concluída");
  });

  it("quem só lê vê o selo, mas não inclui nem revoga", async () => {
    await montar(supabaseFalso({ pode: false, pre: COM_DECISAO(false) }));
    const vaga = secao.querySelector("[data-vaga='179698']");
    expect(vaga.querySelector(".avd-selo-decisao")).not.toBeNull();
    expect(vaga.querySelector("[data-acao='incluir-por-decisao']")).toBeNull();
    expect(
      vaga.querySelector("[data-acao='abrir-revogar-decisao']"),
    ).toBeNull();
  });
});
