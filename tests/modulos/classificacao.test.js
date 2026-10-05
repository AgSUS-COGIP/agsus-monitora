import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.js";
import { montarClassificacao } from "../../src/modulos/classificacao/classificacao.jsx";
import { ordemDoSorteio } from "../../src/lib/classificacao/sorteio.js";
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
      "83/2026 - DSEI Xingu (4) · regra v2",
      "100/2026 - CASAI",
    ]);
    expect(secao.querySelector(".classificacao-vaga")).toBeNull();
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
      "regra v2",
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
    expect(texto).toMatch(/^Brasília, na data da assinatura digital\./);
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
    expect(previa().getAttribute("sandbox")).toBe("");
    expect(previa().getAttribute("srcdoc")).toContain(
      "RESULTADO FINAL - PROCESSO SELETIVO",
    );
    expect(previa().getAttribute("srcdoc")).toContain("AGÊNCIA DE TESTE");
    await digitar(
      modal.querySelector("[data-campo-documento='processo']"),
      "AGSUS.016954/2026-81",
    );
    expect(previa().getAttribute("srcdoc")).toContain(
      "SEI AGSUS.016954/2026-81",
    );
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
    expect(conteudo).toContain("SEI AGSUS.016954/2026-81");
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
    expect(toast).toHaveBeenCalledWith("Regra salva (versão 3).", "success");
  });

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
