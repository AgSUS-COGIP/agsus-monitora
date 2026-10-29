import { renders } from "../componentes/contar-renders.js";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarEstadoDaFila } from "../../src/modulos/avaliacao-documental/estado-da-fila.ts";
import { Fila } from "../../src/modulos/avaliacao-documental/fila.tsx";
import * as telaDaPre from "../../src/lib/avaliacao-documental/tela-da-pre-classificacao.ts";
import * as libDaFila from "../../src/lib/avaliacao-documental/fila.ts";
import { clicar, escolher, esperar } from "../componentes/interacoes.js";

/*
  Quanto a Fila redesenha e reconta numa lista do tamanho do 114/2026 (7.726
  inscritos): selecionar uma linha, trocar um filtro, abrir e fechar o menu
  da coordenação, uma mensagem do estado e a releitura parcial. As linhas da
  tabela contam por `Celula` (uma por coluna de cada linha desenhada) e as
  recontagens da lista inteira pelas funções que elas chamam por inscrito:
  `podeIncluirPorDecisao` (os de fora do lote, para "Incluir por decisão"),
  `loteDaFila` (o lote do resumo) e `acoesDaSelecao` (o menu).
*/

vi.mock(
  "../../src/lib/avaliacao-documental/tela-da-pre-classificacao.ts",
  async (original) => {
    const m = await original();
    return { ...m, podeIncluirPorDecisao: vi.fn(m.podeIncluirPorDecisao) };
  },
);
vi.mock("../../src/lib/avaliacao-documental/fila.ts", async (original) => {
  const m = await original();
  return {
    ...m,
    loteDaFila: vi.fn(m.loteDaFila),
    acoesDaSelecao: vi.fn(m.acoesDaSelecao),
    resumoDaVagaNaFila: vi.fn(m.resumoDaVagaNaFila),
  };
});

const EU = "u-ana";
const TOTAL = 7726;
const VAGAS = Array.from({ length: 12 }, (_, i) => ({
  codigo: String(180000 + i),
  cargo: `Cargo ${i + 1}`,
}));
const SITUACOES = ["PENDENTE", "EM_ANALISE", "CONCLUIDA"];

function candidato(i) {
  const vaga = VAGAS[i % VAGAS.length].codigo;
  const noLote = i < 1800;
  return {
    id: `c-${i}`,
    vaga,
    codigo: String(100000 + i),
    nome: `Pessoa ${i}`,
    situacao_pre: noLote ? "NO_LOTE" : i % 3 ? "ELIMINADO" : "FORA_LOTE",
    motivo_eliminacao: noLote || !(i % 3) ? null : "Documento ausente",
    posicao: noLote ? i + 1 : null,
    lote: noLote ? 1 : null,
    art: 10 + (i % 40),
    modalidade: i % 5 ? "AC" : "PCD",
    ficha: noLote
      ? {
          id: `f-${i}`,
          versao: 1,
          situacao: SITUACOES[i % SITUACOES.length],
          responsavel: i % 4 ? null : EU,
          responsavel_nome: i % 4 ? null : "Ana",
          reserva: null,
          resultado: i % 3 === 2 ? "APTO" : null,
        }
      : null,
  };
}

function dadosDaFila() {
  return {
    schema_version: 1,
    edital: { id: "e114", rotulo: "114/2026" },
    papel: "COORDENADOR",
    pode_coordenar: true,
    pode_pegar: true,
    eu: EU,
    prazo_reserva_min: 15,
    distribuicao: { modo: "PEGAR_PROXIMO", criterio: "PARTES_IGUAIS" },
    sem_ficha: 0,
    vagas: VAGAS,
    analistas: [{ usuario: EU, nome: "Ana", vagas: null, limite: null }],
    filtros: [],
    candidatos: Array.from({ length: TOTAL }, (_, i) => candidato(i)),
  };
}

/* O banco falso: a primeira leitura é inteira; as seguintes, só o que mudou. */
function supabaseFalso() {
  const base = dadosDaFila();
  let mudou = [];
  let leituras = 0;
  const supabase = {
    rpc: vi.fn(async (nome, args) => {
      if (nome !== "obter_fila_avaliacao_desde")
        return { data: null, error: null };
      leituras += 1;
      if (!args.p_desde)
        return {
          data: { ...base, gerado_em: "t0", marca: "m1", parcial: false },
          error: null,
        };
      const { vagas: _v, candidatos: _c, ...resto } = base;
      return {
        data: {
          ...resto,
          gerado_em: `t${leituras}`,
          marca: "m1",
          parcial: true,
          candidatos: mudou,
          saiu: [],
          total_nucleo: base.candidatos.length,
        },
        error: null,
      };
    }),
    auth: { getSession: async () => ({ data: { session: null } }) },
  };
  return {
    supabase,
    base,
    mudar: (linhas) => {
      mudou = linhas;
    },
  };
}

let raiz;
let caixa;
let estado;
let banco;

async function montar() {
  banco = supabaseFalso();
  estado = criarEstadoDaFila({
    supabase: banco.supabase,
    toast: () => {},
    armazenamento: null,
    sessao: null,
    agendar: () => 0,
    cancelar: () => {},
  });
  caixa = document.createElement("div");
  document.body.append(caixa);
  raiz = createRoot(caixa);
  await act(async () => {
    raiz.render(
      createElement(Fila, {
        e: { editalId: "e114", dados: { regra: null } },
        fila: estado,
      }),
    );
  });
  await esperar();
}

const contas = () => ({
  fila: renders.de("Fila"),
  tabela: renders.de("TabelaDaFila"),
  celulas: renders.de("Celula"),
  podeIncluir: telaDaPre.podeIncluirPorDecisao.mock.calls.length,
  lote: libDaFila.loteDaFila.mock.calls.length,
  acoes: libDaFila.acoesDaSelecao.mock.calls.length,
  resumoDaVaga: libDaFila.resumoDaVagaNaFila.mock.calls.length,
});
function zerar() {
  renders.zerar();
  vi.clearAllMocks();
}
/* Mede uma interação: as contagens e o tempo (só informativo, no console). */
async function medir(nome, interacao) {
  zerar();
  const inicio = performance.now();
  await interacao();
  const ms = Math.round(performance.now() - inicio);
  const r = contas();
  console.info(`[fila-renders] ${nome}: ${JSON.stringify({ ...r, ms })}`);
  return r;
}
const linhasNaTela = () =>
  caixa.querySelectorAll(
    "[data-tour='avd-fila-tabela'] tbody tr[data-candidato]",
  );
const caixaDaLinha = (i) =>
  linhasNaTela()[i].querySelector("input[type='checkbox']");
const colunasPorLinha = () =>
  linhasNaTela()[0].querySelectorAll("td[data-coluna]").length;

beforeEach(async () => {
  await montar();
});
afterEach(async () => {
  await act(async () => raiz.unmount());
  caixa.remove();
});

describe("Fila com 7.726 inscritos: redesenhos e recontagens", () => {
  it("monta com a lista inteira e 50 linhas na tabela", () => {
    expect(linhasNaTela()).toHaveLength(50);
    expect(estado.obter().dados.candidatos).toHaveLength(TOTAL);
  });

  it("selecionar 1 linha redesenha só essa linha e não reconta a lista", async () => {
    const r = await medir("selecionar 1 linha", () => clicar(caixaDaLinha(0)));
    expect(caixaDaLinha(0).checked).toBe(true);
    expect(r.fila).toBe(1);
    expect(r.tabela).toBe(1);
    // Só as células da linha marcada (antes: as 50 linhas inteiras).
    expect(r.celulas).toBe(colunasPorLinha());
    expect(r.podeIncluir).toBe(0);
    expect(r.lote).toBe(0);
    // O cabeçalho do grupo usa o resumo da vaga já calculado.
    expect(r.resumoDaVaga).toBe(0);
    expect(r.acoes).toBe(1);
    expect(banco.supabase.rpc).not.toHaveBeenCalled();
  });

  it("trocar um filtro (responsável) não reconta o lote nem os de fora do lote", async () => {
    const r = await medir("trocar filtro (responsável)", () =>
      escolher(
        [...caixa.querySelectorAll(".avd-fila-filtros select")][1],
        "eu",
      ),
    );
    expect(estado.obter().filtro.responsavel).toBe("eu");
    expect(r.podeIncluir).toBe(0);
    expect(r.lote).toBe(0);
    expect(r.acoes).toBe(0);
    expect(r.resumoDaVaga).toBe(0);
    // As linhas que continuam na tela (aqui, o primeiro grupo inteiro) não redesenham.
    expect(r.celulas).toBe(0);
    expect(banco.supabase.rpc).not.toHaveBeenCalled();
  });

  it("abrir e fechar o menu da coordenação não redesenha a tabela", async () => {
    const menu = () =>
      caixa.querySelector(
        "[data-tour='avd-fila-acoes-coordenacao'] [data-acao='abrir-menu']",
      );
    const r = await medir("abrir e fechar o menu", async () => {
      await clicar(menu());
      await clicar(menu());
    });
    expect(r.tabela).toBe(0);
    expect(r.celulas).toBe(0);
    expect(r.podeIncluir).toBe(0);
    expect(banco.supabase.rpc).not.toHaveBeenCalled();
  });

  it("uma ação da coordenação sem mudar a lista não redesenha as linhas", async () => {
    // "Abrir fichas do lote": publica st.acao, chama o banco e relê só o que mudou (nada).
    const r = await medir("ação + releitura sem mudança", async () => {
      await act(async () => {
        await estado.abrirFichasDoLote();
      });
      await esperar();
    });
    expect(r.celulas).toBe(0);
    // Uma recontagem só (a da lista relida), não uma por mensagem do estado.
    expect(r.tabela).toBe(1);
    // A inclusão por decisão saiu da Fila (fica na Pré-classificação): nada a recontar.
    expect(r.podeIncluir).toBe(0);
    expect(r.lote).toBe(1);
  });

  it("releitura parcial com 1 inscrito mudado redesenha só a linha dele", async () => {
    const primeiro = estado.obter().dados.candidatos[0];
    banco.mudar([{ ...primeiro, nome: "Nome novo" }]);
    const r = await medir("releitura parcial (1 mudou)", async () => {
      await act(async () => {
        await estado.carregar("e114");
      });
      await esperar();
    });
    expect(caixa.textContent).toContain("Nome novo");
    expect(r.tabela).toBe(1);
    // A lista mudou: recontar o lote é devido, mas as linhas iguais ficam.
    expect(r.celulas).toBe(colunasPorLinha());
    // A inclusão por decisão saiu da Fila (fica na Pré-classificação): nada a recontar.
    expect(r.podeIncluir).toBe(0);
  });
});
