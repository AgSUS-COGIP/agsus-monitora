import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { montarRegrasDoEdital } from "../componentes/montar-regras-do-edital.js";
import { clicar, esperar } from "../componentes/interacoes.ts";
import { aberturaPelasChamadasDeAntes } from "../componentes/abertura-dos-aprovados.ts";
import { compactarCandidatos } from "../componentes/candidatos-compactos-falsos.ts";
import { criarEstadoDaListaDeAprovados } from "../../src/modulos/aprovados/estado.ts";
import {
  definirAreaAtual,
  publicarLinhasDoMonitoramento,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";

/*
  Regras do edital (Editais › Regras do edital), etapas 3 e 5: a Entrevista
  edita o roteiro e a banca (loja de condução, configurar_entrevista_edital)
  e a Chamada para contratação, a configuração de convocação (loja da Lista
  de aprovados, salvar_configuracao_convocacao). Mesmas RPCs e permissões
  das telas de antes; abrir só lê.
*/

const EDITAL = "e93";
const ROTEIRO = {
  id: "r1",
  nome: "Roteiro da Saúde Indígena",
  versao: 1,
  ativo: true,
  escala_min: 0,
  escala_max: 5,
  competencias: [
    { id: "c1", nome: "Políticas públicas", ordem: 1 },
    { id: "c2", nome: "Habilidade interpessoal", ordem: 2 },
  ],
  aspectos: [],
};

const ENTREVISTAS = (mudancas = {}) => ({
  edital: { id: EDITAL, edital: "93/2026" },
  pode_editar: true,
  configuracao: { roteiro: ROTEIRO, lancamento: "SECRETARIA", banca: [] },
  regra_classificacao: {
    versao: 1,
    convocacao: { multiplo_vagas: 3, incluir_empatados: true },
    desempate: [{ criterio: "IDOSO_60" }],
    empate_final: { metodo: "SORTEIO" },
  },
  lista_convocacao: { lista: { id: "l1" } },
  avaliadores: [
    { id: "a1", nome: "Ana Fictícia", origem: "AgSUS", banca: 1, ativo: true },
  ],
  convocados: [],
  ...mudancas,
});

function supabaseDaEntrevista(mudancas) {
  const respostas = {
    obter_entrevistas_do_edital: ENTREVISTAS(mudancas),
    obter_previsao_entrevista_edital: {
      situacao: "PREVISTA",
      motivo: null,
      pode_alterar: true,
    },
    obter_agenda_entrevista: { itens: [] },
    listar_roteiros_entrevista: [ROTEIRO],
    configurar_entrevista_edital: ENTREVISTAS(mudancas),
  };
  return {
    rpc: vi.fn(async (nome) => ({
      data: respostas[nome] ?? null,
      error: null,
    })),
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe() {} } },
      }),
    },
  };
}

const MODELO = {
  modelo_id: "m1",
  nome: "Modelo de teste",
  distribuicao: "serie_mgi",
  cota_multipla: "maior_percentual",
  editais: 1,
  categorias: [
    { id: "ac", sigla: "AC", rotulo: "Ampla", ampla: true, ordem: 0 },
    {
      id: "pp",
      sigla: "PP",
      rotulo: "Pretos e pardos",
      percentual: 25,
      ordem: 1,
    },
  ],
};

/* O banco da Lista de aprovados: a abertura numa chamada e as gravações. */
function supabaseDosAprovados() {
  const responder = (nome) => {
    const respostas = {
      listar_listas_aprovados: [
        { lista_id: "L1", edital_id: EDITAL, edital: "93/2026", ativo: true },
      ],
      listar_candidatos_aprovados_compacto: compactarCandidatos([
        {
          candidato_id: "c1",
          nome: "Pessoa Fictícia",
          modalidade: "Ampla",
          nota: 90,
          classificacao: 1,
          cargo: "Analista",
          codigo_vaga: "177001",
          edital_id: EDITAL,
          edital: "93/2026",
          lista_ativa: true,
          status: "",
        },
      ]),
      listar_modelos_convocacao: [MODELO],
      listar_configuracao_convocacao: [
        {
          edital_id: EDITAL,
          modelo_id: "m1",
          proporcionalidade: true,
          padrao_imediata: 0,
          vagas: [{ codigo_vaga: "177001", cargo: "Analista", imediatas: 2 }],
        },
      ],
      salvar_configuracao_convocacao: { ok: true },
    };
    const resposta = Promise.resolve({
      data: respostas[nome] ?? null,
      error: null,
    });
    resposta.range = () => resposta;
    return resposta;
  };
  return {
    rpc: vi.fn((nome, argumentos) =>
      nome === "abrir_lista_aprovados"
        ? aberturaPelasChamadasDeAntes(responder, argumentos)
        : responder(nome, argumentos),
    ),
  };
}

function lojaDosAprovados(perfil) {
  const supabase = supabaseDosAprovados();
  const estado = criarEstadoDaListaDeAprovados({
    supabase,
    getProfile: () => perfil,
    areaAtual: () => "saude-indigena",
    toast: () => {},
    confirmar: () => true,
  });
  return { supabase, estado };
}

let montado;
beforeEach(() => {
  definirAreaAtual("saude-indigena");
  publicarLinhasDoMonitoramento([{ id: EDITAL, CO_AREA: "saude-indigena" }]);
});
afterEach(async () => {
  await act(async () => montado?.raiz.unmount());
  montado = null;
  document.body.innerHTML = "";
  redefinirDadosDoMonitoramento();
});

const nomes = (supabase) => supabase.rpc.mock.calls.map(([n]) => n);

async function esperarPor(seletor) {
  for (let i = 0; i < 30; i += 1) {
    const achado = montado.secao.querySelector(seletor);
    if (achado) return achado;
    await esperar();
  }
  return null;
}

describe("Regras do edital: Entrevista", () => {
  it("o resumo e o roteiro e a banca gravados; abrir só lê", async () => {
    const supabase = supabaseDaEntrevista();
    montado = await montarRegrasDoEdital({
      supabase,
      editalId: EDITAL,
      etapa: "entrevista",
    });
    const editor = await esperarPor(
      "[data-tour='regras-do-edital-entrevista']",
    );
    const texto = montado.secao.textContent;
    expect(texto).toContain("Quem é chamado para a entrevista");
    expect(editor.textContent).toContain("Roteiro da Saúde Indígena");
    expect(editor.textContent).toContain("Ana Fictícia");
    expect(
      editor.querySelector("[data-acao='editar-configuracao']").textContent,
    ).toContain("Editar roteiro e banca");
    expect(nomes(supabase)).not.toContain("configurar_entrevista_edital");
    expect(nomes(supabase)).toContain("listar_roteiros_entrevista");
  });

  it("editar e salvar grava pela configurar_entrevista_edital", async () => {
    const supabase = supabaseDaEntrevista();
    montado = await montarRegrasDoEdital({
      supabase,
      editalId: EDITAL,
      etapa: "entrevista",
    });
    const editor = await esperarPor(
      "[data-tour='regras-do-edital-entrevista']",
    );
    await clicar(editor.querySelector("[data-acao='editar-configuracao']"));
    expect(editor.querySelector("[data-campo='roteiro-do-edital']").value).toBe(
      "r1",
    );
    await clicar(editor.querySelector('button[data-valor="AVALIADOR"]'));
    await clicar(editor.querySelector("[data-acao='salvar-configuracao']"));
    await esperar();
    const gravacoes = supabase.rpc.mock.calls.filter(
      ([n]) => n === "configurar_entrevista_edital",
    );
    expect(gravacoes).toHaveLength(1);
    expect(gravacoes[0][1]).toMatchObject({
      p_edital: EDITAL,
      p_dados: {
        roteiro: "r1",
        lancamento: "AVALIADOR",
        avaliadores: [{ id: "a1", nome: "Ana Fictícia", banca: 1 }],
      },
    });
    // Salvo: volta à leitura.
    expect(
      editor.querySelector("[data-acao='salvar-configuracao']"),
    ).toBeNull();
  });

  it("quem o banco não deixa editar vê sem botões", async () => {
    montado = await montarRegrasDoEdital({
      supabase: supabaseDaEntrevista({ pode_editar: false }),
      editalId: EDITAL,
      etapa: "entrevista",
    });
    const editor = await esperarPor(
      "[data-tour='regras-do-edital-entrevista']",
    );
    expect(
      editor.querySelector("[data-acao='editar-configuracao']"),
    ).toBeNull();
    expect(editor.textContent).toContain("Roteiro da Saúde Indígena");
  });
});

describe("Regras do edital: Chamada para contratação", () => {
  it("o formulário sobre a loja da Lista de aprovados; salvar usa a RPC de sempre", async () => {
    const { supabase, estado } = lojaDosAprovados({
      ativo: true,
      admin_global: true,
      perfil: "admin",
    });
    montado = await montarRegrasDoEdital({
      supabase: supabaseDaEntrevista(),
      editalId: EDITAL,
      etapa: "chamada",
      aprovados: async () => estado,
    });
    const salvar = await esperarPor("#convocacaoSalvar");
    expect(salvar).not.toBeNull();
    expect(montado.secao.querySelector("#convocacaoModelo").value).toBe("m1");
    expect(
      [...montado.secao.querySelectorAll("[data-convocacao-vaga]")].map(
        (l) => l.dataset.convocacaoVaga,
      ),
    ).toEqual(["177001"]);
    expect(nomes(supabase)).not.toContain("salvar_configuracao_convocacao");
    await clicar(montado.secao.querySelector('input[value="sem"]'));
    await clicar(salvar);
    await esperar();
    const [[, argumentos]] = supabase.rpc.mock.calls.filter(
      ([n]) => n === "salvar_configuracao_convocacao",
    );
    expect(argumentos).toMatchObject({
      p_edital_id: EDITAL,
      p_proporcionalidade: false,
    });
  });

  it("sem permissão, o formulário fica travado; trocar de etapa", async () => {
    const { estado } = lojaDosAprovados({ ativo: true, perfil: "usuario" });
    montado = await montarRegrasDoEdital({
      supabase: supabaseDaEntrevista(),
      editalId: EDITAL,
      etapa: "chamada",
      aprovados: async () => estado,
    });
    expect(await esperarPor("#convocacaoPermissionNote")).not.toBeNull();
    expect(montado.secao.querySelector("#convocacaoSalvar")).toBeNull();
    expect(montado.secao.querySelector("#convocacaoModelo").disabled).toBe(
      true,
    );
    await clicar(
      [...montado.secao.querySelectorAll(".ui-segmentado button")].find((b) =>
        b.textContent.includes("Entrevista"),
      ),
    );
    await esperar();
    expect(
      montado.secao.querySelector("[data-tour='regras-do-edital']").dataset
        .etapa,
    ).toBe("entrevista");
  });

  it("a Lista de aprovados indisponível vira erro com Tentar de novo", async () => {
    let vezes = 0;
    montado = await montarRegrasDoEdital({
      supabase: supabaseDaEntrevista(),
      editalId: EDITAL,
      etapa: "chamada",
      aprovados: async () => {
        vezes += 1;
        return null;
      },
    });
    await esperar();
    const chamada = montado.secao.querySelector(
      "[data-tour='regras-do-edital-chamada']",
    );
    expect(chamada.textContent).toContain(
      "A Lista de aprovados não está disponível.",
    );
    await clicar(chamada.querySelector("button"));
    await esperar();
    expect(vezes).toBe(2);
  });
});
