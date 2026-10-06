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
