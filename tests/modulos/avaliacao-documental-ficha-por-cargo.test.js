import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarEstadoDaFicha } from "../../src/modulos/avaliacao-documental/ficha/estado-da-ficha.ts";
import { ItemDaFicha } from "../../src/modulos/avaliacao-documental/ficha/item-da-ficha.tsx";
import { clicar } from "../componentes/interacoes.js";

/*
  A ficha com as diferenças por cargo (regra do 114/2026 dos casos dourados):
  a regra da vaga no estado da ficha, a lista de requisitos DAQUELE cargo com
  Confere / Não confere e o motivo pronto, a linha extra do UMCQA nos Cursos
  do Motorista D (somando até o teto 15), o aviso do 8.2.7 e a área exigida
  da experiência. Dados fictícios.
*/
const CASOS = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
    "utf8",
  ),
);
const REGRA = CASOS.regras["E114-POR-CARGO"];

function fichaDoBanco(vaga = "182528") {
  return {
    schema_version: 1,
    edital: { id: "e114", rotulo: "114/2026" },
    papel: "ANALISTA",
    eu: "u-ana",
    pode_editar: true,
    ficha: {
      id: "f1",
      versao: 3,
      vaga,
      cargo: null,
      codigo: "8001",
      nome: "Pessoa Fictícia",
      modalidade: "AC",
      situacao: "EM_ANALISE",
      lancamento: { nivel: "medio" },
      rascunho_em: null,
    },
    regra: {
      versao: 8,
      vigente: 8,
      situacao: "CONFERIDA",
      configuracao: REGRA,
    },
    documental: { nota_minima: 10, nota_minima_por_nivel: {} },
    respostas: {},
    historico: [],
  };
}

async function abrir(vaga) {
  const salvos = [];
  const loja = criarEstadoDaFicha({
    rpc: async (nome, args) => {
      // A leve (20261014231000) sem regra.chave: o mesmo payload.
      if (nome === "obter_ficha_analise" || nome === "obter_ficha_analise_leve")
        return fichaDoBanco(vaga);
      if (nome === "salvar_rascunho_ficha") {
        salvos.push(args);
        return {
          versao: args.p_versao + 1,
          salvo_em: new Date().toISOString(),
        };
      }
      throw new Error(`rpc inesperada ${nome}`);
    },
    agendar: () => 0,
    cancelar: () => {},
    toast: () => {},
  });
  await loja.carregar("f1");
  return { loja, salvos };
}

let alvo;
let raiz;
beforeEach(() => {
  alvo = document.createElement("div");
  document.body.append(alvo);
  raiz = createRoot(alvo);
});
afterEach(() => {
  act(() => raiz.unmount());
  alvo.remove();
});

const EMPREGARE = {
  enderecos: { candidato: null, vaga: null, vagaDireta: false },
  codigoDoCandidato: "8001",
  codigoDaVaga: "182528",
  loja: { registrarAcesso: async () => {} },
  aoAvisar: () => {},
};

async function mostrar(loja, codigo) {
  const st = loja.obter();
  const bloco = st.regra.blocos.find((b) => b.codigo === codigo);
  await act(async () => {
    raiz.render(
      createElement(ItemDaFicha, {
        st,
        bloco,
        modo: "foco",
        ativo: true,
        desabilitado: false,
        mostrarFaltaDeSituacao: false,
        empregare: EMPREGARE,
        mudar: loja.mudar,
      }),
    );
  });
}
const botao = (seletor, rotulo) =>
  [...alvo.querySelectorAll(`${seletor} button`)].find(
    (b) => b.textContent.trim() === rotulo,
  );

describe("ficha do Motorista D (vaga 182528)", () => {
  it("o estado usa a regra da vaga e o lançamento leva a vaga", async () => {
    const { loja } = await abrir();
    const st = loja.obter();
    expect(st.regra.cargo.codigo).toBe("MOTORISTA_D");
    expect(st.lancamento.vaga).toBe("182528");
    const cursos = st.regra.blocos.find((b) => b.codigo === "CURSOS");
    expect(cursos.teto).toBe(15);
  });

  it("Requisito do cargo: só os do Motorista D; Não confere elimina com o motivo pronto", async () => {
    const { loja } = await abrir();
    await mostrar(loja, "REQUISITO_DO_CARGO");
    const linhas = [...alvo.querySelectorAll("[data-requisito]")].map(
      (l) => l.dataset.requisito,
    );
    expect(linhas).toEqual(["CNH_D", "DIRECAO_DEFENSIVA"]);
    expect(alvo.textContent).not.toContain("Cromatografia");
    await clicar(botao('[data-requisito="CNH_D"]', "Não confere"));
    await mostrar(loja, "REQUISITO_DO_CARGO");
    expect(
      alvo.querySelector('[data-requisito="CNH_D"]').textContent,
    ).toContain(
      "Item 2 e Anexo I: Não apresentou CNH categoria D vigente (Anexo I).",
    );
    const st = loja.obter();
    expect(st.lancamento.blocos.REQUISITO_DO_CARGO).toMatchObject({
      situacao: "NAO_CONFORME",
      motivos: ["CNH_D"],
      requisitos: { CNH_D: false },
    });
    expect(st.avaliacao.resultado).toBe("INAPTO_REQUISITO");
  });

  it("Cursos: a linha UMCQA soma 5 até o teto 15; o aviso do 8.2.7", async () => {
    const { loja } = await abrir();
    loja.mudar((l) => ({
      ...l,
      blocos: {
        ...l.blocos,
        CURSOS: { situacao: "CONFORME", edita_nota: true },
        REQUISITO_DO_CARGO: {
          situacao: "CONFORME",
          requisitos: { CNH_D: true, DIRECAO_DEFENSIVA: true },
        },
      },
      cursos: [
        { nome: "Curso de direção defensiva", horas: 40, aceito: true },
        { nome: "Primeiros socorros", horas: 61, aceito: true },
      ],
    }));
    expect(loja.obter().avaliacao.parciais.CURSOS).toBe(6);
    expect(
      loja
        .obter()
        .pendencias.some((p) => p.bloco === "CURSOS" && p.tipo === "extra"),
    ).toBe(true);
    await mostrar(loja, "CURSOS");
    expect(alvo.querySelector('[data-extra="UMCQA"]').textContent).toContain(
      "+5",
    );
    expect(alvo.querySelector('[data-aviso="8.2.7"]').textContent).toContain(
      '"Curso de direção defensiva" parece ser o requisito',
    );
    await clicar(botao('[data-extra="UMCQA"]', "Confere"));
    const st = loja.obter();
    expect(st.lancamento.blocos.CURSOS.extras).toEqual({ UMCQA: true });
    expect(st.avaliacao.parciais.CURSOS).toBe(11);
    expect(st.pendencias.some((p) => p.tipo === "extra")).toBe(false);
  });

  it("Experiência mostra a área exigida do cargo", async () => {
    const { loja } = await abrir();
    await mostrar(loja, "EXPERIENCIA");
    expect(alvo.querySelector(".avd-ficha-cargo-area").textContent).toContain(
      "Condução de veículos de maior porte",
    );
  });
});

describe("outro cargo", () => {
  it("cargo 11 (vaga 182444): sem lista de requisitos nem UMCQA; cursos no teto do nível", async () => {
    const { loja } = await abrir("182444");
    const st = loja.obter();
    expect(st.regra.cargo.codigo).toBe("AUXILIAR_LOGISTICA");
    await mostrar(loja, "REQUISITO_DO_CARGO");
    expect(alvo.querySelector("[data-requisito]")).toBeNull();
    await mostrar(loja, "CURSOS");
    expect(alvo.querySelector("[data-extra]")).toBeNull();
  });
});
