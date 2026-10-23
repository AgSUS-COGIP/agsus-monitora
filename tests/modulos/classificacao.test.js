import { readFileSync } from "node:fs";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";
import {
  calcularClassificacao,
  montarClassificacao,
} from "../../src/modulos/classificacao/classificacao.tsx";
import { ordemDoSorteio } from "../../src/lib/classificacao/sorteio.ts";
import { retratoDaClassificacao } from "../../src/lib/classificacao/dados-do-estado.ts";
import { instantaneoDaLista } from "../../src/lib/classificacao/exportacao.ts";
import {
  clicar,
  digitar,
  escolher,
  esperar,
} from "../componentes/interacoes.js";

/*
  A tela de Classificação como módulo do app (src/modulos/classificacao/):
  monta na `#page-classificacao`, carrega os editais da área atual ao abrir,
  troca de edital, mostra as listas calculadas pelo motor com a regra do
  edital, gera (registro com versão da regra), explica a posição, registra o
  sorteio do empate, exporta e salva a regra como versão nova.
*/

const A = (n) => `00000000-0000-4000-8000-00000000000${n}`;
const REGRA = {
  schema: 1,
  documental: { situacoes_aptas: ["Aprovado"] },
  composicao: {
    componentes: [
      { codigo: "DOCUMENTAL", peso: 1 },
      { codigo: "ENTREVISTA", peso: 1 },
    ],
    casas: 2,
  },
  desempate: [{ criterio: "INDIGENA_COMPROVADO", direcao: "SIM_PRIMEIRO" }],
  listas: {
    PRELIMINAR: { empate: "CRITERIOS" },
    FINAL: { empate: "CRITERIOS" },
  },
  empate_final: { metodo: "SORTEIO", numeracao: "DENSA" },
  modalidades: [
    { codigo: "AC" },
    {
      codigo: "PP",
      nome: "Pretos e Pardos",
      percentual: 25,
      lista_propria: true,
      remanejar_para: ["AC"],
    },
  ],
  rodape: "Conforme item 10.4 do edital.",
};
const candidato = (n, nome, nota, campos = {}) => ({
  analise_id: A(n),
  codigo: `10${n}`,
  nome,
  vaga: "169681",
  cargo: "Cirurgião Dentista",
  modalidade: "Ampla concorrência",
  status: "Aprovado",
  nota_documental: nota,
  quadro: "q1",
  ...campos,
});
const EDITAL = {
  schema_version: 1,
  edital: {
    id: "e83",
    edital: "83/2026",
    unidade: "DSEI Xingu",
    area: "saude-indigena",
  },
  pode_editar: true,
  regra: {
    versao: 2,
    configuracao: REGRA,
    versoes: [
      {
        versao: 2,
        em: "2026-10-01T12:00:00Z",
        por: "Gestora",
        motivo: "Ajuste",
        configuracao: REGRA,
      },
      {
        versao: 1,
        em: "2026-09-30T12:00:00Z",
        por: "Gestora",
        motivo: null,
        configuracao: REGRA,
      },
    ],
  },
  cronograma: [
    {
      ordem: 1,
      atividade: "Período de inscrição",
      inicio: "2026-07-01",
      fim: "2026-07-20",
    },
  ],
  quadro: [
    {
      id: "q1",
      ordem: 1,
      cargo: "Cirurgião Dentista",
      lotacao: "Polo Leonardo",
      modalidades: { "Ampla Concorrência": 1 },
      vagas_imediatas: 1,
      cadastro_reserva: true,
    },
  ],
  candidatos: [
    candidato(1, "Ana Empatada", "10,0"),
    candidato(2, "Bia Empatada", "10,0"),
    candidato(3, "Caio Parda", "9,0", { modalidade: "Pretos e pardos" }),
    candidato(4, "Davi <b>Reprovado</b>", "8,0", { status: "Reprovado" }),
  ],
  entrevistas: [1, 2, 3].map((n) => ({
    id: `ent${n}`,
    analise_id: A(n),
    nome: "x",
    vaga: "169681",
    nota: 10,
    parecer: "APTO",
    compareceu: "S",
    ligacao: "codigo",
    origem: "sistema",
    notas: [],
  })),
  listas: [],
  desempates: [],
};
const EDITAIS = {
  area: "saude-indigena",
  pode_editar: true,
  editais: [
    {
      id: "e83",
      edital: "83/2026",
      unidade: "DSEI Xingu",
      ativo: true,
      candidatos: 4,
      versao_regra: 2,
    },
    {
      id: "e100",
      edital: "100/2026",
      unidade: "CASAI",
      ativo: true,
      candidatos: 0,
      versao_regra: null,
    },
  ],
};

function supabaseFalso(sobrescrever = {}) {
  const respostas = {
    listar_editais_classificacao: () => EDITAIS,
    obter_classificacao_do_edital: ({ p_edital }) =>
      p_edital === "e83"
        ? structuredClone(EDITAL)
        : {
            ...structuredClone(EDITAL),
            edital: { id: "e100" },
            regra: null,
            candidatos: [],
            entrevistas: [],
          },
    registrar_lista_classificacao: ({ p_tipo, p_versao }) => ({
      id: "l1",
      tipo: p_tipo,
      versao_regra: p_versao,
      hash: "f".repeat(64),
      gerada_em: "2026-10-02T13:00:00Z",
      por: "Gestora",
      pendencias: 0,
      publicada: false,
    }),
    registrar_desempate_classificacao: ({ p_dados }) => ({
      id: "d1",
      ...p_dados,
      semente: "s".repeat(64),
      origem_semente: "SERVIDOR",
      ordem: ordemDoSorteio("s".repeat(64), p_dados.candidatos),
    }),
    salvar_regra_classificacao: ({ p_configuracao }) => ({
      ...EDITAL.regra,
      versao: 3,
      configuracao: p_configuracao,
    }),
    ...sobrescrever,
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
const toast = vi.fn();
const baixar = vi.fn();
const imprimir = vi.fn();
const copiar = vi.fn(async () => "html");
const carregarLogo = vi.fn(async () => ({
  bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  largura: 320,
  altura: 320,
}));

async function montar(supabase) {
  secao = document.createElement("section");
  secao.id = "page-classificacao";
  secao.className = "page active";
  document.body.append(secao);
  await act(async () => {
    painel = montarClassificacao({
      supabase,
      toast,
      baixar,
      imprimir,
      copiar,
      carregarLogo,
      cabecalho: () => "AGÊNCIA DE TESTE\nRua A, 1",
    });
  });
  await act(async () => void painel.render());
  await esperar();
}
const botao = (texto, raiz = document) =>
  [...raiz.querySelectorAll("button")].find((b) =>
    b.textContent.trim().startsWith(texto),
  );
const seletorDoEdital = () =>
  secao.querySelector(".classificacao-edital select");
async function abrirEdital(id = "e83") {
  await escolher(seletorDoEdital(), id);
  await esperar();
}

beforeEach(() => {
  redefinirDadosDoMonitoramento();
  definirAreaAtual("saude-indigena");
});
afterEach(async () => {
  await act(async () => painel?.raiz?.unmount());
  secao?.remove();
  document.body.innerHTML = "";
  redefinirDadosDoMonitoramento();
  toast.mockClear();
  baixar.mockClear();
  imprimir.mockClear();
});

describe("tela de Classificação", () => {
  it("monta na seção, carrega os editais da área ao abrir e nenhum edital vem escolhido", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    expect(secao.querySelector(".ui-tela.classificacao-tela")).not.toBeNull();
    expect(supabase.rpc).toHaveBeenCalledWith("listar_editais_classificacao", {
      p_area: "saude-indigena",
    });
    const opcoes = [...seletorDoEdital().options].map((o) => o.textContent);
    expect(opcoes).toEqual([
      "Escolha o edital",
      "83/2026 - DSEI Xingu (4) · Versão 2",
      "100/2026 - CASAI",
    ]);
    expect(secao.querySelector(".classificacao-vaga")).toBeNull();
  });

  it("área sem edital analisado: o seletor diz isso (o banco só manda os editais com análises)", async () => {
    const supabase = supabaseFalso({
      listar_editais_classificacao: () => ({
        area: "sede",
        pode_editar: true,
        editais: [],
      }),
    });
    await montar(supabase);
    expect([...seletorDoEdital().options].map((o) => o.textContent)).toEqual([
      "Nenhum edital com análises nesta área",
    ]);
  });

  it("edital que não abriu: erro com Tentar novamente, sem esqueleto carregando para sempre", async () => {
    let falhar = true;
    const supabase = supabaseFalso();
    const original = supabase.rpc.getMockImplementation();
    supabase.rpc.mockImplementation(async (nome, args, opcoes) =>
      falhar && nome.startsWith("obter_classificacao_do_edital")
        ? { data: null, error: { message: "Falha no banco", code: "XX000" } }
        : original(nome, args, opcoes),
    );
    await montar(supabase);
    await abrirEdital();
    expect(secao.textContent).toContain("Não foi possível abrir o edital");
    expect(secao.querySelector('[aria-busy="true"]')).toBeNull();
    for (const visao of ["agenda", "regra"]) {
      await clicar(secao.querySelector(`[data-valor="${visao}"]`));
      expect(secao.querySelector('[aria-busy="true"]')).toBeNull();
    }
    falhar = false;
    await clicar(botao("Tentar novamente", secao));
    await esperar();
    expect(secao.textContent).not.toContain("Não foi possível abrir o edital");
  });

  it("ao escolher o edital, calcula as listas pela regra dele (KPIs, vaga, eliminados)", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await abrirEdital();
    expect(supabase.rpc).toHaveBeenCalledWith("obter_classificacao_do_edital", {
      p_edital: "e83",
    });
    const kpi = (c) =>
      secao.querySelector(`[data-kpi="${c}"] .ui-kpi-valor`)?.textContent;
    expect([kpi("candidatos"), kpi("elegiveis"), kpi("eliminados")]).toEqual([
      "4",
      "3",
      "1",
    ]);
    const vaga = secao.querySelector(".classificacao-vaga");
    expect(vaga.querySelector("h3").textContent).toBe(
      "VAGA 169681 - Cirurgião Dentista - Polo Leonardo - DSEI Xingu - 1 vaga (1 AC + CR)",
    );
    const linhas = [...vaga.querySelectorAll("tbody tr[data-candidato]")].map(
      (tr) => tr.textContent,
    );
    expect(linhas[0]).toContain("Ana Empatada");
    expect(linhas[0]).toContain("20,00");
    expect(linhas[2]).toContain("Caio Parda");
    // Nome vindo do banco é texto, nunca HTML.
    expect(vaga.querySelector("b")).toBeNull();
    expect(
      vaga.querySelector(".classificacao-eliminados").textContent,
    ).toContain("Davi <b>Reprovado</b>");
  });

  it("não confirma sorteio com ordem incompleta recebida do banco", async () => {
    const supabase = supabaseFalso({
      registrar_desempate_classificacao: ({ p_dados }) => ({
        ...p_dados,
        semente: "abcd",
        ordem: [A(1), null],
      }),
    });
    await montar(supabase);
    await abrirEdital();
    await clicar(botao("Registrar sorteio", secao));
    await clicar(botao("Sortear e registrar"));
    await esperar();
    expect(document.body.textContent).not.toContain("Conferido: a ordem");
    expect(secao.querySelector(".classificacao-pendencias")).not.toBeNull();
    expect(toast).toHaveBeenCalledWith(
      expect.stringContaining("Ordem do desempate inválida"),
      "error",
    );
  });

  it("o empate que espera sorteio aparece no topo e o sorteio é registrado e conferido", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await abrirEdital();
    expect(
      secao.querySelector(".classificacao-pendencias").textContent,
    ).toContain("Ana Empatada, Bia Empatada");
    await clicar(botao("Registrar sorteio", secao));
    await clicar(botao("Sortear e registrar"));
    await esperar();
    const chamada = supabase.rpc.mock.calls.find(
      ([nome]) => nome === "registrar_desempate_classificacao",
    );
    expect(chamada[1]).toMatchObject({
      p_edital: "e83",
      p_dados: {
        tipo_lista: "FINAL",
        vaga: "169681",
        metodo: "SORTEIO",
        candidatos: [A(1), A(2)],
        chave: `FINAL|169681|${A(1)},${A(2)}`,
      },
    });
    expect(chamada[1].p_dados).not.toHaveProperty("semente");
    expect(document.body.textContent).toContain(
      "Conferido: a ordem é a que a semente produz.",
    );
    await clicar(botao("Fechar"));
    // Com o sorteio registrado, a pendência some e as posições se separam.
    expect(secao.querySelector(".classificacao-pendencias")).toBeNull();
    const posicoes = [
      ...secao.querySelectorAll(
        ".classificacao-vaga tbody tr[data-candidato] td:first-child",
      ),
    ].map((td) => td.textContent);
    expect(posicoes).toEqual(["1º", "2º", "3º"]);
  });

  it("abre a explicação da posição do candidato", async () => {
    await montar(supabaseFalso());
    await abrirEdital();
    await clicar(botao("Caio Parda", secao));
    const gaveta =
      document.getElementById("classificacaoCandidato") ||
      document.querySelector(".ui-gaveta");
    expect(gaveta.textContent).toContain(
      "Nota 19,00 (documental 9,00 + entrevista 10,00).",
    );
    expect(gaveta.textContent).toContain("Pretos e Pardos: 1º");
  });

  it("Gerar registra a lista com a versão da regra; o retrato não leva CPF nem nascimento; exporta DOCX e XLSX", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await abrirEdital();
    await clicar(secao.querySelector("[data-acao='gerar']"));
    await esperar();
    const chamada = supabase.rpc.mock.calls.find(
      ([nome]) => nome === "registrar_lista_classificacao",
    );
    expect(chamada[1]).toMatchObject({
      p_edital: "e83",
      p_tipo: "FINAL",
      p_versao: 2,
    });
    expect(chamada[1].p_resultado.vagas[0].geral.map((l) => l.nome)).toEqual([
      "Ana Empatada",
      "Bia Empatada",
      "Caio Parda",
    ]);
    expect(JSON.stringify(chamada[1].p_resultado)).not.toMatch(
      /codigo"\s*:\s*"10|nascimento|cpf/i,
    );
    expect(secao.querySelector("[data-geracao='l1']").textContent).toContain(
      "regra: Versão 2",
    );

    await clicar(secao.querySelector("[data-exportar='docx']"));
    expect(baixar).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      "classificacao-final-83-2026.docx",
      expect.stringContaining("wordprocessingml"),
    );
    await clicar(secao.querySelector("[data-exportar='xlsx']"));
    expect(baixar).toHaveBeenLastCalledWith(
      expect.any(Uint8Array),
      "classificacao-final-83-2026.xlsx",
      expect.stringContaining("spreadsheetml"),
    );
    await clicar(secao.querySelector("[data-exportar='pdf']"));
    const pagina = imprimir.mock.calls[0][0];
    expect(pagina).toContain("RESULTADO FINAL - PROCESSO SELETIVO");
    expect(pagina).toContain("Conforme item 10.4 do edital.");
    expect(pagina).toContain("AGÊNCIA DE TESTE");
  });

  it("Relatório de desempate: só aparece quando a lista gerada tem um; exporta XLSX e PDF", async () => {
    const dourado = JSON.parse(
      readFileSync(
        "tests/fixtures/classificacao/relatorio-de-desempate.json",
        "utf8",
      ),
    );
    await montar(supabaseFalso());
    await abrirEdital();
    await clicar(secao.querySelector("[data-acao='gerar']"));
    await esperar();
    expect(secao.querySelector("[data-desempate]")).toBeNull();
    await act(async () => painel.raiz.unmount());
    secao.remove();

    const supabase = supabaseFalso({
      obter_desempate_da_lista: ({ p_lista }) =>
        p_lista === "l1" ? { ...dourado, lista_id: "l1" } : null,
    });
    await montar(supabase);
    await abrirEdital();
    await clicar(secao.querySelector("[data-acao='gerar']"));
    await esperar();
    expect(
      supabase.rpc.mock.calls.some(
        ([nome, args]) =>
          nome === "obter_desempate_da_lista" && args.p_lista === "l1",
      ),
    ).toBe(true);
    baixar.mockClear();
    await clicar(secao.querySelector("[data-desempate='xlsx']"));
    expect(baixar).toHaveBeenLastCalledWith(
      expect.any(Uint8Array),
      "classificacao-final-83-2026-desempate.xlsx",
      expect.stringContaining("spreadsheetml"),
    );
    imprimir.mockClear();
    await clicar(secao.querySelector("[data-desempate='pdf']"));
    expect(imprimir.mock.calls[0][0]).toContain("RELATÓRIO DE DESEMPATE");
  });

  it("Relatório de desempate: depois de gerar, 'sendo preparado…' até o Python gravar; então os botões", async () => {
    const dourado = JSON.parse(
      readFileSync(
        "tests/fixtures/classificacao/relatorio-de-desempate.json",
        "utf8",
      ),
    );
    let pronto = false;
    const supabase = supabaseFalso({
      obter_desempate_da_lista: ({ p_lista }) =>
        p_lista !== "l1"
          ? null
          : pronto
            ? {
                ...dourado,
                lista_id: "l1",
                preparo: {
                  situacao: "PRONTO",
                  pedido_em: new Date().toISOString(),
                },
              }
            : {
                lista_id: "l1",
                preparo: {
                  situacao: "PEDIDO",
                  pedido_em: new Date().toISOString(),
                },
              },
    });
    await montar(supabase);
    await abrirEdital();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      await clicar(secao.querySelector("[data-acao='gerar']"));
      await esperar();
      expect(
        secao.querySelector("[data-desempate-preparo='preparando']")
          ?.textContent,
      ).toBe("Relatório de desempate sendo preparado…");
      expect(secao.querySelector("[data-desempate]")).toBeNull();
      pronto = true;
      await act(async () => void vi.advanceTimersByTime(10000));
      await esperar();
      expect(secao.querySelector("[data-desempate-preparo]")).toBeNull();
      expect(secao.querySelector("[data-desempate='xlsx']")).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("Relatório de desempate: não confere ou não saiu → aviso; automação desligada → nada", async () => {
    for (const [situacao, seletor, trecho] of [
      [
        "NAO_CONFERE",
        ".classificacao-desempate-nao-confere",
        "não confere com esta lista",
      ],
      ["FALHOU", ".classificacao-desempate-falhou", "não pôde ser preparado"],
      [
        "SEM_DISPARO",
        ".classificacao-desempate-falhou",
        "não pôde ser preparado",
      ],
      ["DESLIGADA", null, null],
    ]) {
      const supabase = supabaseFalso({
        obter_desempate_da_lista: () => ({
          lista_id: "l1",
          preparo: { situacao, pedido_em: new Date().toISOString() },
        }),
      });
      await montar(supabase);
      await abrirEdital();
      await clicar(secao.querySelector("[data-acao='gerar']"));
      await esperar();
      if (seletor)
        expect(secao.querySelector(seletor)?.textContent, situacao).toContain(
          trecho,
        );
      else
        expect(
          secao.querySelector(
            "[data-desempate-preparo], .classificacao-desempate-nao-confere, .classificacao-desempate-falhou",
          ),
          situacao,
        ).toBeNull();
      expect(secao.querySelector("[data-desempate]")).toBeNull();
      await act(async () => painel.raiz.unmount());
      secao.remove();
    }
  });

  it("Exportar: o recorte é de cada lista; o XLSX (planilha inteira) não leva o recorte no nome", async () => {
    await montar(supabaseFalso());
    await abrirEdital();
    await clicar(secao.querySelector("[data-acao='gerar']"));
    await esperar();
    const recorte = () =>
      secao.querySelector("[data-tour='classificacao-exportar-lista']");
    await escolher(recorte(), "geral");
    baixar.mockClear();
    await clicar(secao.querySelector("[data-exportar='docx']"));
    await esperar();
    expect(baixar.mock.calls[0][1]).toBe(
      "classificacao-final-83-2026-geral.docx",
    );
    await clicar(secao.querySelector("[data-exportar='xlsx']"));
    expect(baixar.mock.calls[1][1]).toBe("classificacao-final-83-2026.xlsx");

    await clicar(
      secao.querySelector(".classificacao-tipos [data-valor='PRELIMINAR']"),
    );
    expect(recorte().value).toBe("todas");
  });

  it("Copiar para o SEI: HTML com as classes do SEI e texto numerado, da lista registrada", async () => {
    await montar(supabaseFalso());
    await abrirEdital();
    expect(secao.querySelector("[data-acao='copiar-sei']").disabled).toBe(true);
    await clicar(secao.querySelector("[data-acao='gerar']"));
    await esperar();
    copiar.mockClear();
    await clicar(secao.querySelector("[data-acao='copiar-sei']"));
    await esperar();
    const [{ html, texto }] = copiar.mock.calls[0];
    expect(html).toContain(
      '<p class="Item_Nivel1">Disposições Preliminares</p>',
    );
    expect(html).toContain("VAGA 169681 - Cirurgião Dentista");
    expect(html).toContain("<strong>CLASSIFICAÇÃO</strong>");
    expect(html).not.toMatch(/<script|onerror/i);
    expect(texto).not.toContain("na data da assinatura digital");
    expect(texto).toContain("1. DISPOSIÇÕES PRELIMINARES");
    expect(texto).toContain("2.1. Os(as) candidatos(as) aprovados(as)");
    expect(toast).toHaveBeenCalledWith(
      "Copiado. No SEI, cole no editor do documento (Ctrl+V).",
      "success",
    );
  });

  it("Como fica no SEI: prévia, textos editáveis, Baixar DOCX e Salvar no edital", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await abrirEdital();
    await clicar(secao.querySelector("[data-acao='gerar']"));
    await esperar();
    await clicar(secao.querySelector("[data-acao='ver-documento']"));
    await esperar();
    const modal = document.getElementById("classificacaoDocumento");
    const previa = () =>
      modal.querySelector("iframe.classificacao-documento-previa");
    // Sem script na prévia: só o mesmo origem, para medir a altura da folha.
    expect(previa().getAttribute("sandbox")).toBe("allow-same-origin");
    expect(previa().getAttribute("srcdoc")).toContain(
      "RESULTADO FINAL - PROCESSO SELETIVO",
    );
    expect(previa().getAttribute("srcdoc")).toContain("AGÊNCIA DE TESTE");
    // Painel recolhível com as abas "Dados" | "Textos".
    const textosDoModelo = () =>
      modal
        .querySelector("[data-campo-documento='finais']")
        .closest("[role='tabpanel']");
    expect(textosDoModelo().hidden).toBe(true);
    await digitar(
      modal.querySelector("[data-campo-documento='processo']"),
      "AGSUS.016954/2026-81",
    );
    expect(previa().getAttribute("srcdoc")).toContain(
      "SEI AGSUS.016954/2026-81",
    );
    await clicar(modal.querySelector(".ui-abas [data-aba='textos']"));
    expect(textosDoModelo().hidden).toBe(false);
    expect(
      modal
        .querySelector("[data-campo-documento='processo']")
        .closest("[role='tabpanel']").hidden,
    ).toBe(true);
    const finais = modal.querySelector("[data-campo-documento='finais']");
    await digitar(finais, "Texto final do edital.");
    expect(previa().getAttribute("srcdoc")).toContain(
      '<p class="Item_Nivel2">Texto final do edital.</p>',
    );

    baixar.mockClear();
    await clicar(modal.querySelector("[data-acao='baixar-docx']"));
    await esperar();
    const [bytes, nome] = baixar.mock.calls[0];
    expect(nome).toBe("classificacao-final-83-2026.docx");
    const conteudo = new TextDecoder().decode(bytes);
    expect(conteudo).toContain("word/header1.xml");
    expect(conteudo).toContain("word/media/logo.png");
    // Sem rodapé de página (o SEI põe "título / pg. N").
    expect(conteudo).not.toContain("word/footer1.xml");
    expect(conteudo).not.toContain(" / pg. ");
    expect(conteudo).toContain("Texto final do edital.");

    copiar.mockClear();
    await clicar(modal.querySelector("[data-acao='copiar-sei']"));
    await esperar();
    expect(copiar.mock.calls[0][0].html).toContain("Texto final do edital.");

    await clicar(modal.querySelector("[data-acao='salvar-textos']"));
    await esperar();
    const chamada = supabase.rpc.mock.calls.find(
      ([n]) => n === "salvar_regra_classificacao",
    );
    expect(chamada[1].p_motivo).toBe("Textos do documento oficial (SEI)");
    expect(chamada[1].p_configuracao.documento).toMatchObject({
      processo: "AGSUS.016954/2026-81",
      modelos: { FINAL_FINAL: { finais: "Texto final do edital." } },
    });
    expect(
      chamada[1].p_configuracao.documento.modelos.FINAL_FINAL,
    ).not.toHaveProperty("preliminares");
  });

  it("Como fica no SEI: folha A4 com zoom, painel recolhível, tela cheia e rodapé fixo; Esc fecha", async () => {
    await montar(supabaseFalso());
    await abrirEdital();
    await clicar(secao.querySelector("[data-acao='gerar']"));
    await esperar();
    await clicar(secao.querySelector("[data-acao='ver-documento']"));
    await esperar();
    const modal = document.getElementById("classificacaoDocumento");
    const cartao = modal.querySelector(".classificacao-documento");
    const escala = () =>
      modal.querySelector(".classificacao-documento-escala").textContent;
    const folha = () =>
      modal.querySelector("iframe.classificacao-documento-previa");
    // A folha tem a largura de uma A4 e começa ajustada (sem largura medida, 100%).
    expect(folha().style.width).toBe("794px");
    expect(escala()).toBe("100%");
    expect(
      modal
        .querySelector("[data-acao='zoom-ajustar']")
        .getAttribute("aria-pressed"),
    ).toBe("true");
    await clicar(modal.querySelector("[data-acao='zoom-mais']"));
    expect(escala()).toBe("110%");
    expect(folha().style.transform).toBe("scale(1.1)");
    await clicar(modal.querySelector("[data-acao='zoom-menos']"));
    await clicar(modal.querySelector("[data-acao='zoom-menos']"));
    expect(escala()).toBe("90%");
    expect(
      modal
        .querySelector("[data-acao='zoom-ajustar']")
        .getAttribute("aria-pressed"),
    ).toBe("false");
    await clicar(modal.querySelector("[data-acao='zoom-ajustar']"));
    expect(escala()).toBe("100%");

    // O painel dos textos recolhe; a prévia fica com a largura toda.
    const painel = modal.querySelector(".classificacao-documento-painel");
    await clicar(modal.querySelector("[data-acao='alternar-painel']"));
    expect(painel.hidden).toBe(true);
    expect(
      modal
        .querySelector(".classificacao-documento-corpo")
        .classList.contains("is-sem-painel"),
    ).toBe(true);
    await clicar(modal.querySelector("[data-acao='alternar-painel']"));
    expect(painel.hidden).toBe(false);

    await clicar(modal.querySelector("[data-acao='tela-cheia']"));
    expect(cartao.classList.contains("is-tela-cheia")).toBe(true);
    await clicar(modal.querySelector("[data-acao='tela-cheia']"));
    expect(cartao.classList.contains("is-tela-cheia")).toBe(false);

    // Restaurar e Salvar ficam no rodapé, fora da área que rola.
    const rodape = modal.querySelector(".classificacao-documento-rodape");
    expect(rodape.querySelector("[data-acao='restaurar-textos']")).toBeTruthy();
    expect(rodape.querySelector("[data-acao='salvar-textos']")).toBeTruthy();
    expect(rodape.querySelector("[data-acao='copiar-sei']")).toBeTruthy();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await esperar();
    expect(document.getElementById("classificacaoDocumento")).toBeNull();
  });

  it("Como fica no SEI: aba Colunas marca, ordena, restaura e salva no edital", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await abrirEdital();
    await clicar(secao.querySelector("[data-acao='gerar']"));
    await esperar();
    await clicar(secao.querySelector("[data-acao='ver-documento']"));
    await esperar();
    const modal = document.getElementById("classificacaoDocumento");
    const previa = () =>
      modal
        .querySelector("iframe.classificacao-documento-previa")
        .getAttribute("srcdoc");
    const noDocumento = () =>
      [
        ...modal.querySelectorAll(
          "[aria-label='Colunas no documento'] [data-coluna]",
        ),
      ].map((li) => li.dataset.coluna);
    await clicar(modal.querySelector(".ui-abas [data-aba='colunas']"));
    // Padrão enxuto; Classificação e Nome não se desmarcam.
    expect(noDocumento()).not.toContain("SITUACAO");
    expect(
      modal.querySelector("[data-marcar-coluna='CLASSIFICACAO']").disabled,
    ).toBe(true);
    expect(modal.querySelector("[data-marcar-coluna='NOME']").disabled).toBe(
      true,
    );
    expect(previa()).not.toContain("SITUAÇÃO");

    await clicar(modal.querySelector("[data-marcar-coluna='SITUACAO']"));
    expect(noDocumento().at(-1)).toBe("SITUACAO");
    expect(previa()).toContain("SITUAÇÃO");
    await clicar(
      modal.querySelector(
        "[data-coluna='SITUACAO'] [data-acao='subir-coluna']",
      ),
    );
    expect(noDocumento().at(-2)).toBe("SITUACAO");

    // "Restaurar o padrão", na aba Colunas, volta às colunas padrão.
    await clicar(modal.querySelector("[data-acao='restaurar-textos']"));
    expect(noDocumento()).not.toContain("SITUACAO");
    await clicar(modal.querySelector("[data-marcar-coluna='SITUACAO']"));

    await clicar(modal.querySelector("[data-acao='salvar-textos']"));
    await esperar();
    const chamada = supabase.rpc.mock.calls.find(
      ([n]) => n === "salvar_regra_classificacao",
    );
    expect(chamada[1].p_configuracao.documento.colunas.FINAL_FINAL).toEqual(
      expect.arrayContaining(["CLASSIFICACAO", "NOME", "NOTA", "SITUACAO"]),
    );
  });

  it("sem geração, exportar fica desligado; leitor não vê Gerar", async () => {
    await montar(
      supabaseFalso({
        obter_classificacao_do_edital: () => ({
          ...structuredClone(EDITAL),
          pode_editar: false,
        }),
      }),
    );
    await abrirEdital();
    expect(secao.querySelector("[data-exportar='docx']").disabled).toBe(true);
    expect(secao.querySelector("[data-acao='gerar']")).toBeNull();
    expect(secao.querySelector("[data-acao='resolver-empate']")).toBeNull();
  });

  it("troca de edital: o sem regra avisa e não inventa lista", async () => {
    await montar(supabaseFalso());
    await abrirEdital();
    await abrirEdital("e100");
    expect(secao.textContent).toContain(
      "Este edital ainda não tem regra de classificação.",
    );
    expect(secao.querySelector(".classificacao-vaga")).toBeNull();
  });

  it("a lista preliminar e a de convocação vêm do mesmo edital", async () => {
    await montar(supabaseFalso());
    await abrirEdital();
    await clicar(
      secao.querySelector(".classificacao-tipos [data-valor='PRELIMINAR']"),
    );
    const notas = [
      ...secao.querySelectorAll(
        ".classificacao-vaga tbody tr[data-candidato] td:nth-child(3)",
      ),
    ].map((td) => td.textContent);
    expect(notas).toEqual(["10,00", "10,00", "9,00"]);
    await clicar(
      secao.querySelector(".classificacao-tipos [data-valor='CONVOCACAO']"),
    );
    expect(secao.querySelector(".classificacao-vaga").textContent).toContain(
      "Limite da convocação: sem limite na regra",
    );
  });

  it("Regra: critérios reordenáveis, motivo obrigatório e salvar cria a versão 3", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await abrirEdital();
    await clicar(secao.querySelector(".ui-topo [data-valor='regra']"));
    expect(
      secao.querySelectorAll(".classificacao-lista-ordenavel li"),
    ).toHaveLength(1);
    await escolher(
      secao.querySelector("[data-acao='adicionar-criterio']"),
      "IDOSO_60",
    );
    await clicar(
      botao("Subir 60 anos", secao) ||
        secao.querySelector("[aria-label^='Subir 60']"),
    );
    expect(
      [...secao.querySelectorAll(".classificacao-lista-ordenavel li")].map(
        (li) => li.dataset.criterio,
      ),
    ).toEqual(["IDOSO_60", "INDIGENA_COMPROVADO"]);
    expect(secao.textContent).toContain("Versões da regra");

    await clicar(secao.querySelector("[data-acao='salvar-regra']"));
    expect(
      supabase.rpc.mock.calls.some(
        ([nome]) => nome === "salvar_regra_classificacao",
      ),
    ).toBe(false);
    expect(secao.textContent).toContain("Informe o motivo.");

    const motivo = [
      ...secao.querySelectorAll(".classificacao-salvar input"),
    ][0];
    await digitar(motivo, "60+ é o primeiro critério (item 10.4 a)");
    await clicar(secao.querySelector("[data-acao='salvar-regra']"));
    await esperar();
    const chamada = supabase.rpc.mock.calls.find(
      ([nome]) => nome === "salvar_regra_classificacao",
    );
    expect(chamada[1]).toMatchObject({
      p_edital: "e83",
      p_versao_atual: 2,
      p_motivo: "60+ é o primeiro critério (item 10.4 a)",
    });
    expect(chamada[1].p_configuracao.desempate.map((d) => d.criterio)).toEqual([
      "IDOSO_60",
      "INDIGENA_COMPROVADO",
    ]);
    // "Nome desta versão": a sugestão (edital + começo do motivo) vai junto.
    expect(chamada[1].p_nome).toMatch(/ – 60\+ é o primeiro critério/);
    expect(toast).toHaveBeenCalledWith(
      expect.stringMatching(/^Regra salva \((.+ · v3|Versão 3)\)\.$/),
      "success",
    );
  });

  it("Regra: o rascunho guardado volta ao abrir (Continuar) e salvar a versão o apaga", async () => {
    const configuracao = structuredClone(EDITAL.regra.configuracao);
    configuracao.desempate = [
      { criterio: "IDOSO_60", direcao: "SIM_PRIMEIRO" },
      ...configuracao.desempate,
    ];
    let rascunho = {
      conteudo: { regra: configuracao },
      versao_base: 2,
      atualizado_em: new Date(2026, 9, 13, 14, 5).toISOString(),
    };
    const supabase = supabaseFalso({
      obter_rascunho_regra: ({ p_tipo }) =>
        p_tipo === "CLASSIFICACAO" ? rascunho : null,
      salvar_rascunho_regra: ({ p_conteudo, p_versao_base }) => {
        rascunho = {
          conteudo: p_conteudo,
          versao_base: p_versao_base,
          atualizado_em: "2026-10-13T15:00:00Z",
        };
        return { atualizado_em: rascunho.atualizado_em };
      },
      descartar_rascunho_regra: () => {
        rascunho = null;
        return { descartado: true };
      },
    });
    await montar(supabase);
    await abrirEdital();
    await clicar(secao.querySelector(".ui-topo [data-valor='regra']"));
    await esperar();
    expect(secao.querySelector(".ui-aviso-de-rascunho").textContent).toContain(
      "Você tem um rascunho não salvo de 13/10 14:05",
    );
    await clicar(botao("Continuar de onde parei", secao));
    await esperar();
    expect(
      [...secao.querySelectorAll(".classificacao-lista-ordenavel li")].map(
        (li) => li.dataset.criterio,
      ),
    ).toEqual(["IDOSO_60", "INDIGENA_COMPROVADO"]);
    await digitar(
      secao.querySelector(".classificacao-salvar input"),
      "60+ primeiro, retomado do rascunho",
    );
    await clicar(secao.querySelector("[data-acao='salvar-regra']"));
    await esperar();
    await esperar();
    expect(
      supabase.rpc.mock.calls.some(
        ([nome, args]) =>
          nome === "descartar_rascunho_regra" &&
          args.p_tipo === "CLASSIFICACAO",
      ),
    ).toBe(true);
    expect(rascunho).toBeNull();
  });

  it("Regra: digitar tecla a tecla não come a vírgula nem o espaço (números e listas)", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await abrirEdital();
    await clicar(secao.querySelector(".ui-topo [data-valor='regra']"));
    const campo = (rotulo) => {
      const label = [...secao.querySelectorAll("label")].find(
        (l) => l.textContent.trim() === rotulo,
      );
      return document.getElementById(label.htmlFor);
    };
    // Cada pedaço continua o que o campo mostra, como teclas seguidas.
    const digitarAosPoucos = async (entrada, pedacos) => {
      await digitar(entrada, "");
      for (const p of pedacos) await digitar(entrada, entrada.value + p);
    };
    const pp = secao.querySelector("[data-modalidade='PP']");

    const minimo = campo("Mínimo documental");
    await digitarAosPoucos(minimo, ["7,", "5"]);
    expect(minimo.value).toBe("7,5");
    const percentual = pp.querySelector("[aria-label='Percentual']");
    await digitarAosPoucos(percentual, ["12,", "5"]);
    expect(percentual.value).toBe("12,5");
    const niveis = campo("Nível pelo início do cargo");
    await digitarAosPoucos(niveis, [
      "Técnico",
      "=tecnico;",
      " Agente ",
      "de saúde=fundamental",
    ]);
    expect(niveis.value).toBe("Técnico=tecnico; Agente de saúde=fundamental");
    const agrupa = pp.querySelector("[aria-label='Reúne as modalidades']");
    await digitarAosPoucos(agrupa, ["PI,", " PQ"]);
    expect(agrupa.value).toBe("PI, PQ");
    const situacoes = campo("Situações aptas na análise");
    await digitarAosPoucos(situacoes, ["Aprovado,", " Apto ", "com ressalva"]);
    expect(situacoes.value).toBe("Aprovado, Apto com ressalva");

    await digitar(
      [...secao.querySelectorAll(".classificacao-salvar input")][0],
      "Mínimos do item 9",
    );
    await clicar(secao.querySelector("[data-acao='salvar-regra']"));
    await esperar();
    const { p_configuracao } = supabase.rpc.mock.calls.find(
      ([nome]) => nome === "salvar_regra_classificacao",
    )[1];
    expect(p_configuracao.documental).toMatchObject({
      nota_minima: 7.5,
      situacoes_aptas: ["Aprovado", "Apto com ressalva"],
      niveis_por_cargo: [
        { termo: "Técnico", nivel: "tecnico" },
        { termo: "Agente de saúde", nivel: "fundamental" },
      ],
    });
    expect(
      p_configuracao.modalidades.find((m) => m.codigo === "PP"),
    ).toMatchObject({ percentual: 12.5, agrupa: ["PI", "PQ"] });
  }, 30000);

  it("sem permissão no banco, mostra o aviso de acesso", async () => {
    const supabase = {
      rpc: vi.fn(async () => ({
        data: null,
        error: { code: "42501", message: "Sem permissão" },
      })),
      auth: {
        getSession: async () => ({ data: { session: { user: { id: "u" } } } }),
      },
    };
    await montar(supabase);
    expect(secao.textContent).toContain("Sem acesso à Classificação");
    expect(seletorDoEdital()).toBeNull();
  });
});

describe("Classificação com ajuste da pontuação aprovado em recurso", () => {
  const comAjuste = (extra = {}) =>
    supabaseFalso({
      obter_classificacao_do_edital: () => ({
        ...structuredClone(EDITAL),
        ajustes: [
          {
            id: "aj1",
            recurso_id: "r7",
            numero: 7,
            analise_id: A(3),
            aprovado_em: "2026-10-05T12:00:00Z",
            itens: [{ codigo: "DOCUMENTAL", anterior: 9, novo: 12 }],
          },
        ],
        ajustes_mudaram_em: "2026-10-05T12:00:00Z",
        ...extra,
      }),
    });

  it('o candidato aparece marcado "Recurso nº 7" na tabela e a explicação diz o que mudou', async () => {
    await montar(comAjuste());
    await abrirEdital();
    const linha = secao.querySelector(
      `.classificacao-vaga tr[data-candidato="${A(3)}"]`,
    );
    const marca = linha.querySelector(".classificacao-marca-recurso");
    expect(marca.textContent).toBe("Recurso nº 7");
    expect(marca.getAttribute("title")).toBe("Nota alterada pelo recurso nº 7");
    expect(
      secao.querySelectorAll(
        ".classificacao-vaga .classificacao-marca-recurso",
      ),
    ).toHaveLength(1);
    await clicar(botao("Caio Parda", secao));
    const gaveta = document.getElementById("classificacaoCandidato");
    expect(gaveta.textContent).toContain(
      "Nota 22,00 (documental 12,00 + entrevista 10,00).",
    );
    expect(gaveta.textContent).toContain(
      "Nota alterada pelo recurso nº 7: nota documental 9,00 → 12,00.",
    );
  });

  it("lista gerada antes do ajuste aprovado: avisa para gerar de novo; gerada depois, não", async () => {
    const lista = (gerada_em) => ({
      id: "l0",
      tipo: "FINAL",
      versao_regra: 2,
      hash: "a".repeat(64),
      gerada_em,
      por: "Gestora",
      pendencias: 0,
      publicada: false,
    });
    await montar(comAjuste({ listas: [lista("2026-10-04T12:00:00Z")] }));
    await abrirEdital();
    expect(
      secao.querySelector(".classificacao-desatualizada").textContent,
    ).toBe("Há recursos aprovados depois desta lista — gere de novo.");
    await act(async () => painel?.raiz?.unmount());
    secao.remove();
    await montar(comAjuste({ listas: [lista("2026-10-06T12:00:00Z")] }));
    await abrirEdital();
    expect(secao.querySelector(".classificacao-desatualizada")).toBeNull();
  });
});

describe("Classificação: publicar o resultado final como lista de aprovados", () => {
  const VIGENTE = {
    edital_id: "e83",
    pode_publicar: true,
    tem_analises: true,
    vigente: {
      lista_id: "lv1",
      origem: "XLSX",
      importado_em: "2026-09-20T12:00:00Z",
      candidatos: [
        {
          candidato_id: "c1",
          nome: "ANA EMPATADA",
          codigo_vaga: "169681",
          classificacao: 1,
          nota: 20,
          status: "Contratado",
          matricula: "M1",
        },
        {
          candidato_id: "c2",
          nome: "Pessoa Que Saiu",
          codigo_vaga: "169681",
          classificacao: 2,
          nota: 15,
          status: "Desistente",
        },
      ],
    },
    publicacoes: [],
  };

  it("bloqueia a publicação quando a lista vigente não traz todos os dados para revisão", async () => {
    const supabase = supabaseFalso({
      obter_publicacao_lista_aprovados: () => ({
        ...VIGENTE,
        vigente: {
          ...VIGENTE.vigente,
          candidatos: [VIGENTE.vigente.candidatos[0], null],
        },
      }),
    });
    await montar(supabase);
    await abrirEdital();
    await clicar(secao.querySelector("[data-acao='gerar']"));
    await esperar();
    await clicar(secao.querySelector("[data-acao='publicar-aprovados']"));
    await esperar();
    const modal = document.getElementById("classificacaoPublicarAprovados");
    expect(modal.querySelector("[role='alert']").textContent).toContain(
      "Recarregue a lista",
    );
    expect(
      modal.querySelector("[data-acao='confirmar-publicacao-aprovados']"),
    ).toBeNull();
    expect(
      supabase.rpc.mock.calls.some(
        ([nome]) => nome === "publicar_lista_aprovados_da_classificacao",
      ),
    ).toBe(false);
  });

  it("mostra o que muda, pede revisão de quem saiu com status e publica com os vínculos", async () => {
    const supabase = supabaseFalso({
      obter_publicacao_lista_aprovados: () => structuredClone(VIGENTE),
      publicar_lista_aprovados_da_classificacao: () => ({
        ok: true,
        lista_id: "nova",
        candidatos: 3,
        pendencias: [],
      }),
    });
    await montar(supabase);
    await abrirEdital();
    expect(secao.querySelector("[data-acao='publicar-aprovados']")).toBeNull();
    await clicar(secao.querySelector("[data-acao='gerar']"));
    await esperar();
    await clicar(secao.querySelector("[data-acao='publicar-aprovados']"));
    await esperar();

    const modal = document.getElementById("classificacaoPublicarAprovados");
    expect(modal.textContent).toContain("Lista manual (planilha)");
    const valor = (chave) =>
      modal.querySelector(`[data-kpi='${chave}'] .ui-kpi-valor`).textContent;
    expect(valor("entram")).toBe("2");
    expect(valor("saem")).toBe("1");
    expect(valor("preservados")).toBe("1");
    // Quem saiu com status vai para a revisão; aqui a pessoa diz que é a Bia.
    expect(modal.querySelector(".classificacao-revisao").textContent).toContain(
      "Pessoa Que Saiu",
    );
    await escolher(modal.querySelector("#revisao-c2"), A(2));
    await clicar(
      modal.querySelector("[data-acao='confirmar-publicacao-aprovados']"),
    );
    await esperar();

    const chamada = supabase.rpc.mock.calls.find(
      ([nome]) => nome === "publicar_lista_aprovados_da_classificacao",
    );
    expect(chamada[1]).toEqual({
      p_lista_classificacao: "l1",
      p_lista_vigente: "lv1",
      p_vinculos: [
        { candidato_id: "c2", analise_id: A(2), forma: "MANUAL" },
        { candidato_id: "c1", analise_id: A(1), forma: "NOME" },
      ],
    });
    expect(modal.textContent).toContain(
      "Lista de aprovados publicada com 3 candidato(s).",
    );
  });

  it("leitor não vê o botão de publicar", async () => {
    const supabase = supabaseFalso({
      obter_classificacao_do_edital: () => ({
        ...structuredClone(EDITAL),
        pode_editar: false,
        listas: [
          {
            id: "l9",
            tipo: "FINAL",
            versao_regra: 2,
            hash: "b".repeat(64),
            gerada_em: "2026-10-02T13:00:00Z",
            pendencias: 0,
            publicada: false,
          },
        ],
      }),
    });
    await montar(supabase);
    await abrirEdital();
    expect(secao.querySelector("[data-acao='publicar-aprovados']")).toBeNull();
  });
});

describe("Classificação: aguardando análise e geração guardada desatualizada", () => {
  const comPendente = (extra = {}) =>
    supabaseFalso({
      obter_classificacao_do_edital: () => ({
        ...structuredClone(EDITAL),
        candidatos: [
          ...structuredClone(EDITAL.candidatos),
          candidato(5, "Eva Pendente", null, { status: "Pendente" }),
        ],
        ...extra,
      }),
    });
  const kpi = (c) =>
    secao.querySelector(`[data-kpi="${c}"] .ui-kpi-valor`)?.textContent;

  it("quem não foi analisado não é eliminado: KPI e lista à parte", async () => {
    await montar(comPendente());
    await abrirEdital();
    expect([kpi("eliminados"), kpi("aguardando")]).toEqual(["1", "1"]);
    const aguardando = secao.querySelector(".classificacao-aguardando");
    expect(aguardando.querySelector("summary").textContent).toBe(
      "Aguardando análise (1)",
    );
    expect(aguardando.textContent).toContain("Eva Pendente");
    expect(
      secao.querySelector(".classificacao-eliminados summary").textContent,
    ).toBe("Eliminados (1)");
  });

  it("geração de 13/10 com outros números: avisa e bloqueia 'Marcar como publicada'", async () => {
    const supabase = comPendente({
      listas: [
        {
          id: "l0",
          tipo: "FINAL",
          versao_regra: 2,
          hash: "a".repeat(64),
          gerada_em: "2026-10-13T19:10:10Z",
          por: "Ana",
          elegiveis: 1,
          eliminados: 1576,
          pendencias: 0,
          publicada: false,
        },
      ],
    });
    await montar(supabase);
    await abrirEdital();
    expect(secao.querySelector(".classificacao-defasada").textContent).toBe(
      "Esta geração é de 13/10/2026, 16:10; os dados mudaram desde então — gere de novo.",
    );
    expect(secao.querySelector("[data-acao='publicar']").disabled).toBe(true);
  });
});

describe("Classificação: convocação e publicação conferidas", () => {
  const LISTA_GUARDADA = {
    id: "l0",
    tipo: "FINAL",
    versao_regra: 2,
    hash: "a".repeat(64),
    gerada_em: "2026-10-21T19:10:10Z",
    por: "Ana",
    pendencias: 0,
    publicada: false,
  };

  /* O retrato que o "Gerar" grava com os dados de EDITAL. */
  async function retratoGerado() {
    const supabase = supabaseFalso();
    await montar(supabase);
    await abrirEdital();
    await clicar(secao.querySelector("[data-acao='gerar']"));
    await esperar();
    const chamada = supabase.rpc.mock.calls.find(
      ([nome]) => nome === "registrar_lista_classificacao",
    );
    await act(async () => painel.raiz.unmount());
    secao.remove();
    toast.mockClear();
    return chamada[1].p_resultado;
  }

  /* O edital com a lista l0 já registrada; `notaDoCaio` muda os dados depois da geração. */
  function comListaGuardada(retrato, { notaDoCaio = "9,0", extra = {} } = {}) {
    return supabaseFalso({
      obter_classificacao_do_edital: () => {
        const edital = structuredClone(EDITAL);
        edital.candidatos[2].nota_documental = notaDoCaio;
        return { ...edital, listas: [structuredClone(LISTA_GUARDADA)] };
      },
      obter_lista_classificacao: () => ({
        lista: structuredClone(LISTA_GUARDADA),
        resultado: structuredClone(retrato),
      }),
      ...extra,
    });
  }
  const chamou = (supabase, nome) =>
    supabase.rpc.mock.calls.some(([n]) => n === nome);

  it("falha de rede na convocação: avisa, bloqueia o Gerar e libera ao ler de novo", async () => {
    let falhar = true;
    const supabase = supabaseFalso({
      listar_configuracao_convocacao: () => {
        if (falhar) throw new Error("Failed to fetch");
        return [];
      },
    });
    await montar(supabase);
    await abrirEdital();
    const aviso = secao.querySelector(".classificacao-erro-convocacao");
    expect(aviso.textContent).toContain(
      "Não foi possível carregar a convocação do edital",
    );
    expect(secao.querySelector("[data-acao='gerar']").disabled).toBe(true);

    falhar = false;
    await clicar(aviso.querySelector("[data-acao='tentar-novamente']"));
    await esperar();
    expect(secao.querySelector(".classificacao-erro-convocacao")).toBeNull();
    expect(secao.querySelector("[data-acao='gerar']").disabled).toBe(false);
  });

  it("sem acesso à convocação (42501): segue com a regra, sem aviso", async () => {
    const supabase = supabaseFalso({
      listar_configuracao_convocacao: () => {
        throw Object.assign(new Error("sem acesso"), { code: "42501" });
      },
    });
    await montar(supabase);
    await abrirEdital();
    expect(secao.querySelector(".classificacao-erro-convocacao")).toBeNull();
    expect(secao.querySelector("[data-acao='gerar']").disabled).toBe(false);
  });

  it("'Marcar como publicada' confere o retrato: nota mudou, não publica e pede para gerar de novo", async () => {
    const retrato = await retratoGerado();
    const supabase = comListaGuardada(retrato, { notaDoCaio: "9,5" });
    await montar(supabase);
    await abrirEdital();
    await clicar(secao.querySelector("[data-acao='publicar']"));
    await esperar();
    expect(toast).toHaveBeenCalledWith(
      expect.stringContaining("Gere de novo antes de publicar"),
      "error",
    );
    expect(chamou(supabase, "publicar_lista_classificacao")).toBe(false);
  });

  it("'Marcar como publicada' com o retrato em dia publica e mostra 'Publicando…' enquanto espera", async () => {
    const retrato = await retratoGerado();
    const supabase = comListaGuardada(retrato);
    const responder = supabase.rpc;
    let soltar;
    supabase.rpc = vi.fn((nome, args) =>
      nome === "publicar_lista_classificacao"
        ? new Promise((resolver) => {
            soltar = () =>
              resolver({
                data: { ...LISTA_GUARDADA, publicada: true },
                error: null,
              });
          })
        : responder(nome, args),
    );
    await montar(supabase);
    await abrirEdital();
    await clicar(secao.querySelector("[data-acao='publicar']"));
    await esperar();
    const enviando = secao.querySelector("[data-acao='publicar']");
    expect(enviando.textContent).toBe("Publicando…");
    expect(enviando.disabled).toBe(true);
    await act(async () => soltar());
    await esperar();
    expect(toast).toHaveBeenCalledWith(
      "Lista marcada como publicada.",
      "success",
    );
  });

  it("'Publicar como lista de aprovados' também confere: nota mudou, a prévia pede para gerar de novo", async () => {
    const retrato = await retratoGerado();
    const supabase = comListaGuardada(retrato, {
      notaDoCaio: "9,5",
      extra: { obter_publicacao_lista_aprovados: () => ({ vigente: null }) },
    });
    await montar(supabase);
    await abrirEdital();
    await clicar(secao.querySelector("[data-acao='publicar-aprovados']"));
    await esperar();
    const modal = document.getElementById("classificacaoPublicarAprovados");
    expect(modal.querySelector("[role='alert']").textContent).toContain(
      "Gere de novo antes de publicar",
    );
    expect(
      modal.querySelector("[data-acao='confirmar-publicacao-aprovados']"),
    ).toBeNull();
    expect(chamou(supabase, "publicar_lista_aprovados_da_classificacao")).toBe(
      false,
    );
  });
});

/*
  Etapa 2b (20261023200000): com a chave "Gerar listas pelo Python" ligada, o
  "Gerar" pede o cálculo ao Python, espera o job ("Calculando a lista…"),
  recebe o retrato, calcula o mesmo com o motor.ts e só registra quando são
  iguais (registrar_lista_calculada). Desligada, tudo como antes.
*/
describe("Gerar com a lista calculada pelo Python", () => {
  const PEDIDO = "aaaaaaaa-1111-4111-8111-111111111111";
  const nomes = (supabase) => supabase.rpc.mock.calls.map(([nome]) => nome);
  /* O retrato que o Python calcularia com os mesmos dados, como o jsonb devolve (chaves em outra ordem). */
  function retratoDoPython(mexer = (r) => r) {
    const dados = painel.estado.obter().dados;
    const retrato = retratoDaClassificacao(
      instantaneoDaLista(calcularClassificacao(dados, "FINAL"), {
        edital: dados.edital,
        regra: dados.regra.configuracao,
        versao: dados.regra.versao,
      }),
    );
    const invertido = (v) =>
      Array.isArray(v)
        ? v.map(invertido)
        : v && typeof v === "object"
          ? Object.fromEntries(
              Object.entries(v)
                .reverse()
                .map(([k, x]) => [k, invertido(x)]),
            )
          : v;
    return invertido(mexer(JSON.parse(JSON.stringify(retrato))));
  }
  function ligada({
    situacoes = ["CALCULANDO", "PRONTO"],
    mexer,
    extra = {},
  } = {}) {
    const fila = [...situacoes];
    return supabaseFalso({
      pedir_calculo_classificacao: ({ p_tipo }) => ({
        ligada: true,
        pedido: PEDIDO,
        tipo: p_tipo,
        situacao: "PEDIDO",
        mensagem: null,
      }),
      obter_calculo_classificacao: ({ p_com_retrato }) => {
        const situacao = p_com_retrato ? "PRONTO" : fila.shift() || "PRONTO";
        return {
          pedido: PEDIDO,
          tipo: "FINAL",
          situacao,
          mensagem:
            situacao === "FALHOU"
              ? "A regra do edital mudou desde o pedido; gere a lista de novo."
              : null,
          retrato: p_com_retrato ? retratoDoPython(mexer) : null,
        };
      },
      registrar_lista_calculada: () => ({
        id: "l1",
        tipo: "FINAL",
        versao_regra: 2,
        hash: "e".repeat(64),
        gerada_em: "2026-10-23T13:00:00Z",
        por: "Gestora",
        pendencias: 0,
        publicada: false,
      }),
      registrar_divergencia_do_calculo: ({ p_pedido }) => ({
        pedido: p_pedido,
        situacao: "NAO_CONFERE",
      }),
      ...extra,
    });
  }
  async function gerarEsperando(supabase, passos = 2) {
    await montar(supabase);
    await abrirEdital();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await clicar(secao.querySelector("[data-acao='gerar']"));
    await esperar();
    const enquanto = {
      texto: secao.querySelector("[data-calculo='calculando']")?.textContent,
      gerarDesabilitado: secao.querySelector("[data-acao='gerar']").disabled,
    };
    for (let i = 0; i < passos; i += 1) {
      await act(async () => void vi.advanceTimersByTime(3000));
      await esperar();
    }
    return enquanto;
  }
  afterEach(() => vi.useRealTimers());

  it("desligada: registra pelo cálculo da tela, como antes, sem esperar o Python", async () => {
    const supabase = supabaseFalso({
      pedir_calculo_classificacao: () => ({ ligada: false }),
    });
    await montar(supabase);
    await abrirEdital();
    await clicar(secao.querySelector("[data-acao='gerar']"));
    await esperar();
    expect(nomes(supabase)).toContain("registrar_lista_classificacao");
    expect(nomes(supabase)).not.toContain("obter_calculo_classificacao");
    expect(nomes(supabase)).not.toContain("registrar_lista_calculada");
    expect(secao.querySelector("[data-calculo]")).toBeNull();
    expect(secao.querySelector("[data-geracao='l1']")).not.toBeNull();
  });

  it("ligada e igual: espera o job, confere e registra o retrato do Python", async () => {
    const supabase = ligada();
    const enquanto = await gerarEsperando(supabase);
    expect(enquanto.texto).toBe("Calculando a lista… (até 5 min)");
    expect(enquanto.gerarDesabilitado).toBe(true);
    expect(nomes(supabase)).not.toContain("registrar_lista_classificacao");
    const chamada = supabase.rpc.mock.calls.find(
      ([nome]) => nome === "registrar_lista_calculada",
    );
    expect(chamada[1].p_pedido).toBe(PEDIDO);
    expect(chamada[1].p_resultado.vagas[0].geral.map((l) => l.nome)).toEqual([
      "Ana Empatada",
      "Bia Empatada",
      "Caio Parda",
    ]);
    expect(nomes(supabase)).not.toContain("registrar_divergencia_do_calculo");
    expect(secao.querySelector("[data-calculo]")).toBeNull();
    expect(secao.querySelector("[data-geracao='l1']")).not.toBeNull();
    expect(toast).toHaveBeenCalledWith("Lista gerada e registrada.", "success");
  });

  it("ligada e diferente: avisa, não registra e grava só os caminhos da diferença", async () => {
    const supabase = ligada({
      mexer: (r) => {
        r.vagas[0].geral[0].posicao = 9;
        return r;
      },
    });
    await gerarEsperando(supabase);
    expect(nomes(supabase)).not.toContain("registrar_lista_calculada");
    expect(nomes(supabase)).not.toContain("registrar_lista_classificacao");
    const divergencia = supabase.rpc.mock.calls.find(
      ([nome]) => nome === "registrar_divergencia_do_calculo",
    )[1];
    expect(divergencia).toEqual({
      p_pedido: PEDIDO,
      p_total: 1,
      p_caminhos: ["vagas[0].geral[0].posicao"],
    });
    const aviso = secao.querySelector("[data-calculo='diferente']");
    expect(aviso.textContent).toContain(
      "O cálculo em Python não confere com o da tela (1 diferença(s)); a lista não foi registrada.",
    );
    expect(secao.querySelector("[data-geracao]")).toBeNull();
    // Tentar de novo: um pedido novo.
    await clicar(secao.querySelector("[data-acao='tentar-calculo']"));
    expect(
      nomes(supabase).filter((n) => n === "pedir_calculo_classificacao"),
    ).toHaveLength(2);
  });

  it("ligada e o banco não confirma a igualdade: não registra e avisa", async () => {
    const supabase = ligada({
      extra: {
        registrar_lista_calculada: () => ({
          nao_confere: true,
          pedido: PEDIDO,
        }),
      },
    });
    await gerarEsperando(supabase);
    expect(
      secao.querySelector("[data-calculo='diferente']").textContent,
    ).toContain("O banco não confirmou");
    expect(secao.querySelector("[data-geracao]")).toBeNull();
  });

  it("ligada e o job falhou, ou o pedido não saiu: o motivo e Tentar de novo", async () => {
    const supabase = ligada({ situacoes: ["FALHOU"] });
    await gerarEsperando(supabase, 1);
    expect(
      secao.querySelector("[data-calculo='falhou']").textContent,
    ).toContain("A regra do edital mudou desde o pedido");
    expect(secao.querySelector("[data-acao='tentar-calculo']")).not.toBeNull();
    expect(nomes(supabase)).not.toContain("registrar_lista_calculada");
    await act(async () => painel.raiz.unmount());
    secao.remove();
    vi.useRealTimers();

    const semDisparo = supabaseFalso({
      pedir_calculo_classificacao: () => ({
        ligada: true,
        pedido: PEDIDO,
        situacao: "SEM_DISPARO",
        mensagem: "O pedido ao GitHub não saiu (SEM_TOKEN).",
      }),
    });
    await montar(semDisparo);
    await abrirEdital();
    await clicar(secao.querySelector("[data-acao='gerar']"));
    await esperar();
    expect(
      secao.querySelector("[data-calculo='falhou']").textContent,
    ).toContain("O pedido ao GitHub não saiu (SEM_TOKEN).");
    expect(nomes(semDisparo)).not.toContain("obter_calculo_classificacao");
    expect(secao.querySelector("[data-acao='gerar']").disabled).toBe(false);
  });
});
