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
  O assistente da regra na aba Regra (src/modulos/avaliacao-documental/
  assistente/): nova regra a partir de um modelo, cardápio que marca e
  desmarca, perguntas da Empregare ligadas pelo enunciado com a cor de cada
  uma, nota mínima e desempate gravados na regra de classificação, resumo
  para o SEI e a dupla conferência. Fixtures sem dado pessoal.
*/

const ler = (arquivo) =>
  JSON.parse(
    readFileSync(`tests/fixtures/avaliacao-documental/${arquivo}`, "utf8"),
  );
const PROJ = ler("casos-de-pontuacao.json").regras["PROJ26-CURRICULAR"];
const VAGAS = ler("colunas-da-empregare-93-2026.json");

const CLASSIFICACAO = {
  schema: 1,
  documental: { nota_minima: 15, nota_minima_por_nivel: {} },
  desempate: [
    { criterio: "IDOSO_60", direcao: "SIM_PRIMEIRO" },
    { criterio: "MAIOR_IDADE", direcao: "MAIOR_PRIMEIRO" },
  ],
};

const regraSalva = (versao, configuracao = PROJ, extra = {}) => ({
  versao,
  situacao: "CONFERIR",
  modelo_origem: "PROJ26-CURRICULAR",
  configuracao,
  atualizado_em: "2026-10-06T12:00:00Z",
  por: "Gestora",
  conferir_pede_outra_pessoa: false,
  versoes: [
    {
      versao,
      em: "2026-10-06T12:00:00Z",
      por: "Gestora",
      motivo: "Copiada",
      configuracao,
    },
  ],
  ...extra,
});

function supabaseFalso({
  regra: inicial = null,
  pode = true,
  apoio = {},
} = {}) {
  let regra = inicial;
  const respostas = {
    listar_editais_avaliacao: () => ({
      area: "projetos",
      editais: [
        { id: "e93", edital: "93/2026", unidade: "Boa Vista", ativo: true },
      ],
    }),
    obter_regra_analise: () => ({
      schema_version: 1,
      edital: {
        id: "e93",
        edital: "93/2026",
        unidade: "Boa Vista",
        area: "projetos",
        numero: "93/2026",
        id_unidade: null,
      },
      papel: pode ? "COORDENADOR" : null,
      pode_coordenar: pode,
      origem: "PLANILHA",
      regra,
      modelos: [
        {
          codigo: "PROJ26-CURRICULAR",
          nome: "Projetos — 93/2026",
          configuracao: PROJ,
        },
      ],
      nota_minima: { nota_minima: 15, nota_minima_por_nivel: {} },
      aldeias: { quantidade: 0 },
      pode_carregar_aldeias: false,
      perguntas: [],
      fichas_concluidas: 0,
    }),
    obter_equipe_edital: () => ({
      papel: "COORDENADOR",
      pode_coordenar: pode,
      gestores: [],
      equipe: [],
      pessoas: [],
      vagas: [],
    }),
    obter_apoio_regra_analise: () => ({
      perguntas_por_vaga: VAGAS,
      regras_da_area: [],
      classificacao: {
        pode_ler: true,
        pode_editar: true,
        regra: { versao: 3, configuracao: CLASSIFICACAO },
      },
      ...apoio,
    }),
    salvar_regra_analise: ({ p_configuracao, p_versao_atual }) => {
      regra = regraSalva(p_versao_atual + 1, p_configuracao);
      return { regra, fichas_afetadas: [] };
    },
    salvar_regra_classificacao: ({ p_configuracao }) => ({
      versao: 4,
      configuracao: p_configuracao,
      versoes: [],
    }),
  };
  return {
    rpc: vi.fn(async (nome, args) => ({
      data: respostas[nome]?.(args) ?? null,
      error: null,
    })),
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "u" } } } }),
    },
  };
}

let secao;
let painel;

async function montar(supabase) {
  secao = document.createElement("section");
  secao.id = "page-avaliacao-documental";
  document.body.append(secao);
  await act(async () => {
    painel = montarAvaliacaoDocumental({ supabase, toast: vi.fn() });
  });
  await act(async () => void painel.render());
  await esperar();
  await escolher(secao.querySelector(".avd-edital select"), "e93");
  await esperar();
  await esperar();
}
const botao = (texto, raiz = secao) =>
  [...raiz.querySelectorAll("button")].find((b) =>
    b.textContent.trim().startsWith(texto),
  );
const passo = (id) => secao.querySelector(`[data-passo='${id}']`);
const cartao = (id) => secao.querySelector(`[data-cartao='${id}']`);

beforeEach(() => {
  redefinirDadosDoMonitoramento();
  definirAreaAtual("projetos");
  localStorage.removeItem("avd-regra-modo");
});
afterEach(async () => {
  await act(async () => painel?.raiz?.unmount());
  secao?.remove();
  document.body.innerHTML = "";
});

describe("assistente da regra", () => {
  it("nova regra: modelo + cardápio → versão 1 com o motivo do ponto de partida", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    expect(secao.querySelector("#avdAstTitulo").textContent).toContain(
      "Nova regra",
    );
    expect(passo("cardapio").disabled).toBe(true);
    await clicar(secao.querySelector("[data-acao='usar-partida']"));
    expect(passo("cardapio").getAttribute("aria-current")).toBe("step");
    // Desmarcar some com o bloco.
    expect(cartao("bloco:CURSOS").dataset.marcado).toBe("sim");
    await clicar(
      cartao("bloco:CURSOS").querySelector("input[type='checkbox']"),
    );
    expect(cartao("bloco:CURSOS").dataset.marcado).toBe("nao");
    expect(
      cartao("bloco:CURSOS").querySelector(".avd-ast-cartao-corpo"),
    ).toBeNull();
    // O critério étnico não aparece em Projetos.
    expect(cartao("bloco:ETNICO")).toBeNull();
    await clicar(passo("conferir"));
    await clicar(secao.querySelector("[data-acao='salvar-assistente']"));
    await esperar();
    const chamada = supabase.rpc.mock.calls.find(
      ([nome]) => nome === "salvar_regra_analise",
    );
    expect(chamada[1]).toMatchObject({
      p_edital: "e93",
      p_versao_atual: 0,
      p_motivo: "Criada no assistente a partir do modelo PROJ26-CURRICULAR",
    });
    expect(
      chamada[1].p_configuracao.blocos.some((b) => b.tipo === "CURSOS"),
    ).toBe(false);
    expect(chamada[1].p_configuracao.edital_rotulo).toBe("Edital 93/2026");
    expect(secao.textContent).toContain("Versão 1");
  }, 20000);

  it("perguntas da Empregare: liga pelo enunciado e mostra a cor de cada uma", async () => {
    await montar(supabaseFalso({ regra: regraSalva(1) }));
    await clicar(passo("perguntas"));
    await esperar();
    expect(secao.textContent).toContain("pergunta(s) ligada(s) pelo enunciado");
    const formacao = secao.querySelector("[data-bloco='FORMACAO']");
    const linhas = formacao.querySelectorAll("[data-ligacao]");
    expect(linhas.length).toBeGreaterThan(0);
    expect(linhas[0].querySelector("input").value).toBe(
      "Qual seu Nível de Titulação Acadêmica",
    );
    expect(linhas[0].dataset.situacao).toBe("achou");
    // Um começo que casa com duas colunas da mesma vaga: amarelo.
    const cota = () => secao.querySelector("[data-bloco='COTA_PP']");
    expect(cota().querySelectorAll("li[data-situacao='achou']").length).toBe(3);
    await digitar(
      cota().querySelector("[data-ligacao] input"),
      "Candidatos concorrendo",
    );
    expect(cota().querySelector("[data-situacao='ambigua']")).not.toBeNull();
    // Escolher da lista troca pela pergunta inteira: verde de novo.
    const lista = cota().querySelector("[data-ligacao] select");
    await escolher(lista, [...lista.options][1].value);
    expect(cota().querySelector("[data-situacao='ambigua']")).toBeNull();
  }, 20000);

  it("nota mínima e desempate gravam na regra de classificação (sem versão nova da regra)", async () => {
    const supabase = supabaseFalso({ regra: regraSalva(2) });
    await montar(supabase);
    await clicar(passo("nota"));
    const minima = secao.querySelector(
      "[data-tour='avd-assistente-nota-minima'] input",
    );
    await digitar(minima, "16");
    await clicar(secao.querySelector("[aria-label='Subir o 2º']"));
    await clicar(passo("conferir"));
    expect(secao.querySelector("[data-salva-classificacao]")).not.toBeNull();
    await digitar(
      secao.querySelector(".avd-ast-salvar input"),
      "Nota mínima do edital retificado",
    );
    await clicar(secao.querySelector("[data-acao='salvar-assistente']"));
    await esperar();
    const chamada = supabase.rpc.mock.calls.find(
      ([nome]) => nome === "salvar_regra_classificacao",
    );
    expect(chamada[1]).toMatchObject({
      p_edital: "e93",
      p_versao_atual: 3,
      p_motivo: "Nota mínima do edital retificado",
    });
    expect(chamada[1].p_configuracao.documental.nota_minima).toBe(16);
    expect(chamada[1].p_configuracao.desempate.map((d) => d.criterio)).toEqual([
      "MAIOR_IDADE",
      "IDOSO_60",
    ]);
    expect(
      supabase.rpc.mock.calls.some(([nome]) => nome === "salvar_regra_analise"),
    ).toBe(false);
  }, 20000);

  it("resumo de uma página e Copiar para o SEI", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    await montar(supabaseFalso({ regra: regraSalva(1) }));
    await clicar(passo("conferir"));
    const resumo = secao.querySelector(".avd-ast-resumo");
    expect(resumo.textContent).toContain("O que elimina");
    expect(resumo.textContent).toContain("Nota mínima: 15 pontos");
    expect(resumo.textContent).toContain("Classificação: 1º 60 anos ou mais");
    await clicar(secao.querySelector("[data-acao='copiar-resumo']"));
    await esperar();
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("O QUE ELIMINA"),
    );
    delete navigator.clipboard;
  }, 20000);

  it("dupla conferência: quem salvou a versão não marca como conferida", async () => {
    await montar(
      supabaseFalso({
        regra: regraSalva(2, PROJ, { conferir_pede_outra_pessoa: true }),
      }),
    );
    const conferir = secao.querySelector("[data-acao='conferir-regra']");
    expect(conferir.disabled).toBe(true);
    expect(
      secao.querySelector("[data-dupla-conferencia]").textContent,
    ).toContain("outra pessoa da coordenação");
  });

  it("modo avançado continua disponível e lembra a escolha", async () => {
    await montar(supabaseFalso({ regra: regraSalva(1) }));
    await clicar(botao("Modo avançado"));
    expect(secao.querySelector("[data-acao='salvar-regra']")).not.toBeNull();
    expect(secao.querySelector(".avd-ast")).toBeNull();
    expect(localStorage.getItem("avd-regra-modo")).toBe("avancado");
  });

  it("quem só lê vê o resumo, sem o assistente", async () => {
    await montar(supabaseFalso({ regra: regraSalva(1), pode: false }));
    expect(secao.querySelector(".avd-ast")).toBeNull();
    expect(secao.querySelector(".avd-ast-resumo")).not.toBeNull();
  });
});
