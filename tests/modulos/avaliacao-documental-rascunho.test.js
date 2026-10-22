import { readFileSync } from "node:fs";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarGuardaDeAlteracoes } from "../../src/app/guarda-de-alteracoes.ts";
import { criarRascunhoDaRegra } from "../../src/app/rascunho-da-regra.ts";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";
import { montarAvaliacaoDocumental } from "../../src/modulos/avaliacao-documental/avaliacao-documental.jsx";
import {
  clicar,
  digitar,
  escolher,
  esperar,
} from "../componentes/interacoes.js";

/*
  Incidente de 13/10/2026 (114/2026): a regra editada no assistente se perdeu
  ao recarregar. Agora o rascunho da aba Regra é guardado a cada mudança
  (salvar_rascunho_regra) e volta ao abrir: "Continuar de onde parei" ou
  "Descartar"; a versão de onde ele partiu aparece se outra pessoa salvou no
  meio; salvar a versão nova apaga o rascunho; o F5 e o "Atualizar" avisam.
*/

const PROJ = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
    "utf8",
  ),
).regras["PROJ26-CURRICULAR"];
const DO_RASCUNHO = { ...PROJ, titulo_etapa: "Rascunho do incidente" };

const regraSalva = (versao, configuracao = PROJ) => ({
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
});

function supabaseFalso({ versao = 2, guardado = null } = {}) {
  let regra = regraSalva(versao);
  let rascunho = guardado;
  const respostas = {
    listar_editais_avaliacao: () => ({
      area: "projetos",
      editais: [
        { id: "e114", edital: "114/2026", unidade: "SEDE", ativo: true },
      ],
    }),
    obter_regra_analise: () => ({
      schema_version: 1,
      edital: {
        id: "e114",
        edital: "114/2026",
        unidade: "SEDE",
        area: "projetos",
        numero: "114/2026",
        id_unidade: null,
      },
      papel: "COORDENADOR",
      pode_coordenar: true,
      origem: "PLANILHA",
      regra,
      modelos: [],
      nota_minima: { nota_minima: 15, nota_minima_por_nivel: {} },
      aldeias: { quantidade: 0 },
      pode_carregar_aldeias: false,
      fichas_concluidas: 0,
    }),
    obter_equipe_edital: () => ({
      papel: "COORDENADOR",
      pode_coordenar: true,
      gestores: [],
      equipe: [],
      pessoas: [],
      vagas: [],
    }),
    obter_apoio_regra_analise: () => ({
      perguntas_por_vaga: [],
      regras_da_area: [],
      classificacao: { pode_ler: false, pode_editar: false, regra: null },
    }),
    salvar_regra_analise: ({ p_configuracao, p_versao_atual }) => {
      regra = regraSalva(p_versao_atual + 1, p_configuracao);
      return { regra, fichas_afetadas: [] };
    },
    obter_rascunho_regra: () => rascunho,
    salvar_rascunho_regra: ({ p_conteudo, p_versao_base }) => {
      rascunho = {
        conteudo: p_conteudo,
        versao_base: p_versao_base,
        atualizado_em: new Date(2026, 9, 13, 15, 30).toISOString(),
      };
      return { atualizado_em: rascunho.atualizado_em };
    },
    descartar_rascunho_regra: () => {
      const havia = Boolean(rascunho);
      rascunho = null;
      return { descartado: havia };
    },
  };
  return {
    rpc: vi.fn(async (nome, args) => ({
      data: respostas[nome]?.(args) ?? null,
      error: null,
    })),
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "u" } } } }),
    },
    rascunho: () => rascunho,
  };
}

let secao;
let painel;
let guarda;
let confirmar;

async function montar(supabase) {
  secao = document.createElement("section");
  secao.id = "page-avaliacao-documental";
  document.body.append(secao);
  guarda = criarGuardaDeAlteracoes({ janela: window });
  confirmar = vi.fn(() => true);
  await act(async () => {
    painel = montarAvaliacaoDocumental({
      supabase,
      toast: vi.fn(),
      confirmar,
      rascunho: criarRascunhoDaRegra({
        tipo: "ANALISE",
        supabase,
        atrasoMs: 0,
        guarda,
        janela: null,
      }),
    });
  });
  await act(async () => void painel.render());
  await esperar();
  await escolher(secao.querySelector(".avd-edital select"), "e114");
  await esperar();
  await esperar();
}
const botao = (texto) =>
  [...secao.querySelectorAll("button")].find((b) =>
    b.textContent.trim().startsWith(texto),
  );
const chamadas = (supabase, nome) =>
  supabase.rpc.mock.calls.filter(([n]) => n === nome);
const aviso = () => secao.querySelector(".ui-aviso-de-rascunho");

beforeEach(() => {
  redefinirDadosDoMonitoramento();
  definirAreaAtual("projetos");
  localStorage.clear();
});
afterEach(async () => {
  await act(async () => painel?.raiz?.unmount());
  secao?.remove();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("rascunho guardado da regra", () => {
  it("rascunho no banco: pergunta antes de mostrar o editor; continuar retoma no passo 2", async () => {
    const supabase = supabaseFalso({
      guardado: {
        conteudo: { regra: DO_RASCUNHO },
        versao_base: 2,
        // Hora local (a tela mostra a hora local): o teste vale em qualquer fuso.
        atualizado_em: new Date(2026, 9, 13, 14, 5).toISOString(),
      },
    });
    await montar(supabase);
    expect(aviso().textContent).toContain(
      "Você tem um rascunho não salvo de 13/10 14:05",
    );
    expect(aviso().querySelector("[data-rascunho-versao-mudou]")).toBeNull();
    expect(secao.querySelector("#avdAstTitulo")).toBeNull();
    await clicar(botao("Continuar de onde parei"));
    await esperar();
    expect(aviso()).toBeNull();
    expect(secao.querySelector(".avd-ast-chip").textContent).toContain(
      "Alterações não salvas",
    );
    expect(
      secao
        .querySelector("[data-passo='cardapio']")
        .getAttribute("aria-current"),
    ).toBe("step");
    // Regravado na versão vigente, com o mesmo conteúdo.
    expect(supabase.rascunho()).toMatchObject({
      versao_base: 2,
      conteudo: { regra: { titulo_etapa: "Rascunho do incidente" } },
    });
    expect(secao.querySelector("[data-rascunho]").textContent).toBe(
      "Rascunho guardado às 15:30",
    );
  });

  it("outra pessoa salvou no meio: mostra que o rascunho partiu da versão 1", async () => {
    const supabase = supabaseFalso({
      versao: 2,
      guardado: {
        conteudo: { regra: DO_RASCUNHO },
        versao_base: 1,
        // Hora local (a tela mostra a hora local): o teste vale em qualquer fuso.
        atualizado_em: new Date(2026, 9, 13, 14, 5).toISOString(),
      },
    });
    await montar(supabase);
    const texto = aviso()
      .querySelector("[data-rascunho-versao-mudou]")
      .textContent.replace(/\s+/g, " ");
    expect(texto).toContain("partiu da versão 1");
    expect(texto).toContain("a vigente agora é a versão 2");
  });

  it("descartar (confirmado) apaga o rascunho e abre a versão vigente", async () => {
    const supabase = supabaseFalso({
      guardado: {
        conteudo: { regra: DO_RASCUNHO },
        versao_base: 2,
        // Hora local (a tela mostra a hora local): o teste vale em qualquer fuso.
        atualizado_em: new Date(2026, 9, 13, 14, 5).toISOString(),
      },
    });
    await montar(supabase);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await clicar(botao("Descartar"));
    expect(aviso()).not.toBeNull();
    window.confirm.mockReturnValue(true);
    await clicar(botao("Descartar"));
    await esperar();
    expect(aviso()).toBeNull();
    expect(chamadas(supabase, "descartar_rascunho_regra")).toHaveLength(1);
    expect(supabase.rascunho()).toBeNull();
    expect(secao.querySelector("#avdAstTitulo").textContent).toContain(
      "Editar regra",
    );
    expect(secao.querySelector(".avd-ast-chip")).toBeNull();
  });

  it("rascunho igual à versão vigente some sem perguntar", async () => {
    const supabase = supabaseFalso({
      guardado: {
        conteudo: { regra: PROJ },
        versao_base: 2,
        // Hora local (a tela mostra a hora local): o teste vale em qualquer fuso.
        atualizado_em: new Date(2026, 9, 13, 14, 5).toISOString(),
      },
    });
    await montar(supabase);
    expect(aviso()).toBeNull();
    expect(chamadas(supabase, "descartar_rascunho_regra")).toHaveLength(1);
  });

  it("cada mudança é guardada; F5 pede confirmação; salvar a versão apaga o rascunho", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    const sair = () => {
      const evento = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(evento);
      return evento.defaultPrevented;
    };
    expect(sair()).toBe(false);
    await clicar(secao.querySelector("[data-passo='cardapio']"));
    await clicar(
      secao
        .querySelector("[data-cartao='bloco:CURSOS']")
        .querySelector("input[type='checkbox']"),
    );
    await esperar();
    await esperar();
    const [, args] = chamadas(supabase, "salvar_rascunho_regra").at(-1);
    expect(args).toMatchObject({
      p_tipo: "ANALISE",
      p_edital: "e114",
      p_versao_base: 2,
    });
    expect(sair()).toBe(true);
    // "Atualizar" da tela avisa antes; recusado, nada é relido.
    confirmar.mockReturnValue(false);
    const antes = chamadas(supabase, "listar_editais_avaliacao").length;
    await clicar(secao.querySelector("[data-acao='atualizar']"));
    expect(confirmar).toHaveBeenCalled();
    expect(chamadas(supabase, "listar_editais_avaliacao")).toHaveLength(antes);
    // Salvar a versão nova apaga o rascunho antes de a aba remontar.
    await clicar(secao.querySelector("[data-passo='conferir']"));
    await digitar(
      secao.querySelector("[data-campo='motivo'] input"),
      "Tirei os cursos do edital 114",
    );
    await clicar(secao.querySelector("[data-acao='salvar-assistente']"));
    await esperar();
    await esperar();
    expect(chamadas(supabase, "salvar_regra_analise")).toHaveLength(1);
    expect(supabase.rascunho()).toBeNull();
    expect(aviso()).toBeNull();
    expect(sair()).toBe(false);
  });
});
