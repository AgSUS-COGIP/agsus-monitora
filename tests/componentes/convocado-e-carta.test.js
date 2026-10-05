import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { montarListaAprovados } from "../../src/modulos/aprovados/lista-aprovados.jsx";
import { clicar, digitar, escolher, esperar } from "./interacoes.js";
import { compactarPorArea } from "./candidatos-compactos-falsos.js";
import {
  publicarLinhasDoMonitoramento,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.js";

/*
  O status Convocado e a carta de convocação na Lista de aprovados, pelas
  histórias de docs/historias-de-usuario/lista-de-aprovados.md:
    H1 Marcar um candidato como Convocado (com a data)
    H2 Seguir o fluxo a partir do Convocado
    H3 Ver convocados nos indicadores, filtros, ordem de chamada e CSV
    H4 Manter o modelo da carta (versões)
    H5 Emitir a carta para um ou vários candidatos
    H6 Marcar como Convocado depois de emitir
    H7 Ver as cartas emitidas na gaveta do candidato
*/

beforeEach(() =>
  publicarLinhasDoMonitoramento([{ id: "10", CO_AREA: "saude-indigena" }]),
);
afterEach(() => redefinirDadosDoMonitoramento());

const HOJE = "2026-10-05";
const LISTA = {
  lista_id: "L10",
  edital_id: "10",
  edital: "03/2025",
  unidade: "DSEI Manaus",
  ativo: true,
  arquivo_nome: "aprovados.xlsx",
};
const base = {
  cargo: "Enfermeiro",
  modalidade: "Ampla concorrência",
  nota: 90,
  edital_id: "10",
  edital: "03/2025",
  unidade: "DSEI Manaus",
  codigo_vaga: "VG-1",
  lista_ativa: true,
  lista_id: "L10",
  status: "",
};
const CANDIDATOS = () => [
  { ...base, candidato_id: "ana", nome: "Ana Ribeiro", classificacao: 1, nota: 99, status: "Convocado" },
  { ...base, candidato_id: "bruno", nome: "Bruno Lima", classificacao: 2, nota: 98 },
  { ...base, candidato_id: "carla", nome: "Carla Souza", classificacao: 3, nota: 97 },
  { ...base, candidato_id: "diego", nome: "Diego Alves", classificacao: 4, nota: 96, status: "Contratado", matricula: "M-4" },
];
const MODELOS = {
  pode_editar: true,
  modelos: [
    {
      modelo_id: "m1",
      area: "saude-indigena",
      nome: "Carta padrão",
      ativo: true,
      versao: 2,
      cartas: 1,
      vigente: {
        titulo: "CARTA DE CONVOCAÇÃO",
        texto: "Prezado(a) **{NOME}**,\nApresente-se até {DATA_LIMITE} em {LOCAL}.",
        local: "Sede",
        documentos: "RG",
        contato: "",
        prazo_dias: 5,
      },
      versoes: [
        { versao: 2, motivo: "Prazo novo", usuario: "Fulana", salvo_em: "2026-10-04T12:00:00Z" },
        { versao: 1, motivo: null, usuario: "Fulana", salvo_em: "2026-10-01T12:00:00Z" },
      ],
    },
  ],
};

function supabaseFalso({ modelos = MODELOS, candidatos = CANDIDATOS() } = {}) {
  let versao = 1;
  const rpc = vi.fn((nome, argumentos) => {
    let resposta = { data: { ok: true }, error: null };
    if (nome === "listar_candidatos_aprovados_compacto")
      resposta = {
        data: compactarPorArea(candidatos, {
          area: argumentos?.p_area,
          versao: `v${versao}`,
        }),
        error: null,
      };
    else if (nome === "listar_listas_aprovados") resposta = { data: [LISTA], error: null };
    else if (nome === "listar_modelos_convocacao" || nome === "listar_configuracao_convocacao")
      resposta = { data: [], error: null };
    else if (nome === "listar_anexos_candidatos_aprovados") resposta = { data: [], error: null };
    else if (nome === "listar_convocacoes_aprovados")
      resposta = { data: [{ candidato_id: "ana", data_convocacao: "2026-10-01", cartas: 1 }], error: null };
    else if (nome === "listar_modelos_carta_convocacao") resposta = { data: modelos, error: null };
    else if (nome === "registrar_carta_convocacao")
      resposta = { data: { carta_id: "carta-1", emitida_em: "2026-10-05T13:00:00Z", candidatos: argumentos.p_candidatos.length }, error: null };
    else if (nome === "marcar_candidatos_convocados")
      resposta = { data: { marcados: argumentos.p_candidatos.length, ignorados: [], data_convocacao: argumentos.p_data_convocacao }, error: null };
    else if (nome === "salvar_modelo_carta_convocacao")
      resposta = { data: { modelo_id: argumentos.p_modelo || "novo", versao: (argumentos.p_versao_atual || 0) + 1 }, error: null };
    else if (nome === "listar_cartas_do_candidato")
      resposta = {
        data: {
          data_convocacao: "2026-10-01",
          cartas: [
            { carta_id: "c1", emitida_em: "2026-10-01T12:00:00Z", usuario: "Fulana", modelo: "Carta padrão", versao: 1, saida: "PDF", data_limite: "2026-10-06", candidatos: 3, convocacao_marcada: "2026-10-01" },
          ],
        },
        error: null,
      };
    if (/^(alterar|marcar|salvar|registrar)_/.test(nome)) versao += 1;
    return Promise.resolve(resposta);
  });
  return { rpc, storage: { from: vi.fn() } };
}

let controlador = null;
let perfilAtual = null;

async function montar({ perfil = { perfil: "contratador" }, supabase = supabaseFalso(), toast = vi.fn() } = {}) {
  document.body.innerHTML = `<section id="page-approved" class="page active"></section>`;
  perfilAtual = perfil;
  const copiar = vi.fn(async () => "html");
  const imprimir = vi.fn();
  const baixar = vi.fn();
  await act(async () => {
    controlador = montarListaAprovados({
      secao: document.getElementById("page-approved"),
      supabase,
      toast,
      getProfile: () => perfilAtual,
      confirmar: () => true,
      novaAba: () => ({ mostrar: vi.fn(), fechar: vi.fn() }),
      copiar,
      imprimir,
      baixar,
      carregarLogo: async () => null,
      cabecalho: () => "AGÊNCIA DO ENSAIO",
      hoje: () => HOJE,
    });
  });
  await esperar(() => controlador.render());
  return { supabase, toast, copiar, imprimir, baixar };
}

afterEach(async () => {
  await act(async () => controlador?.raiz?.unmount());
  controlador = null;
  document.body.innerHTML = "";
});

const $ = (id) => document.getElementById(id);
const linhaDe = (painel, nome) =>
  [...document.querySelectorAll(`#${painel} tr`)].find(
    (linha) => linha.querySelector(".approved-name strong")?.textContent === nome,
  );
const chamadas = (supabase, nome) =>
  supabase.rpc.mock.calls.filter(([n]) => n === nome).map(([, a]) => a);
const irParaConvocacao = () => clicar($("approvedTabConvocacao"));

describe("H1/H2: status Convocado com a data", () => {
  it("Fim de Fila saiu das opções; Convocado pede a data, que não pode ser futura", async () => {
    const { supabase } = await montar();
    await clicar(linhaDe("approvedPanelAprovados", "Bruno Lima").querySelector('[data-approved-action="status"]'));
    const opcoes = [...$("approvedStatusSelect").options].map((o) => o.value);
    expect(opcoes).not.toContain("Fim de Fila");
    expect(opcoes).toContain("Convocado");
    await escolher($("approvedStatusSelect"), "Convocado");
    expect($("approvedStatusDataConvocacao").value).toBe(HOJE);
    expect($("approvedStatusDataConvocacao").max).toBe(HOJE);
    await digitar($("approvedStatusDataConvocacao"), "2026-10-03");
    supabase.rpc.mockClear();
    await clicar($("approvedStatusSave"));
    expect(supabase.rpc).toHaveBeenCalledWith("alterar_status_candidato_aprovado", {
      p_candidato_id: "bruno",
      p_status: "Convocado",
      p_processo_sei: null,
      p_matricula: null,
      p_data_convocacao: "2026-10-03",
    });
  });

  it("do Convocado, quem edita segue o fluxo (sem cadeado), mas não deixa sem status", async () => {
    await montar();
    const ana = linhaDe("approvedPanelAprovados", "Ana Ribeiro");
    expect(ana.querySelector(".approved-status-data").textContent).toBe("em 01/10/2026");
    await clicar(ana.querySelector('[data-approved-action="status"]'));
    expect($("approvedStatusSelect").querySelector('option[value=""]').disabled).toBe(true);
    expect($("approvedStatusDataConvocacao").value).toBe("2026-10-01");
  });

  it("contratado continua com cadeado para quem não é admin", async () => {
    await montar();
    const diego = linhaDe("approvedPanelAprovados", "Diego Alves");
    expect(diego.querySelector('[data-approved-action="status"]')).toBeNull();
    expect(diego.querySelector(".fa-lock")).not.toBeNull();
  });
});

describe("H3: convocados nos indicadores, na ordem de chamada e no CSV", () => {
  it("aprovados: KPI Convocados no lugar de Fim de fila; contratados não somam convocados", async () => {
    await montar();
    expect($("approvedKpiConvocado").textContent).toBe("1");
    expect($("approvedKpiContratado").textContent).toBe("1");
    expect($("approvedKpiFimDeFila")).toBeNull();
  });

  it("convocação: A convocar não conta quem já foi chamado; CSV com a data", async () => {
    const { baixar } = await montar();
    await irParaConvocacao();
    expect($("convocacaoKpiConvocados").textContent).toBe("1");
    // Sem quadro de vagas, ninguém é vaga imediata: nada a convocar.
    expect($("convocacaoKpiAConvocar").textContent).toBe("0");
    await clicar($("convocacaoCsvBtn"));
    const [arquivo, nome] = baixar.mock.calls[0];
    expect(nome).toBe("ordem-de-convocacao.csv");
    const texto = await arquivo.text();
    expect(texto).toContain("Data da convocação");
    expect(texto).toContain("Ana Ribeiro");
    expect(texto).toContain("01/10/2026");
  });

  it("quem só consulta não escolhe nem emite, mas exporta o CSV", async () => {
    await montar({ perfil: { perfil: "usuario" } });
    await irParaConvocacao();
    expect(document.querySelector('[data-convocacao-action="escolher"]')).toBeNull();
    expect($("convocacaoCartaBtn")).toBeNull();
    expect($("convocacaoModelosBtn")).toBeNull();
    expect($("convocacaoCsvBtn")).not.toBeNull();
    expect(document.querySelector('[data-convocacao-action="carta"]')).toBeNull();
  });
});

describe("H5/H6: emitir a carta e marcar como Convocado", () => {
  it("escolhe dois na convocação, vê a prévia, copia para o SEI (registra) e marca os dois", async () => {
    const { supabase, copiar } = await montar();
    await irParaConvocacao();
    for (const nome of ["Bruno Lima", "Carla Souza"])
      await clicar(linhaDe("approvedPanelConvocacao", nome).querySelector('[data-convocacao-action="escolher"]'));
    expect($("convocacaoAcoes").textContent).toContain("2 escolhidos");
    await clicar($("convocacaoCartaBtn"));
    await esperar(() => Promise.resolve());
    expect($("cartaSubtitulo").textContent).toBe("2 candidatos");
    expect($("cartaModelo").value).toBe("m1");
    // A data limite começa pelo prazo padrão do modelo (5 dias).
    expect($("carta-dataLimite").value).toBe("2026-10-10");
    expect($("cartaPrevia").getAttribute("srcdoc")).toContain("Prezado(a) <strong>Bruno Lima</strong>");
    expect($("cartaPrevia").getAttribute("srcdoc")).toContain("Carla Souza");

    supabase.rpc.mockClear();
    await clicar($("cartaCopiarSei"));
    expect(chamadas(supabase, "registrar_carta_convocacao")).toEqual([
      {
        p_modelo: "m1",
        p_versao: 2,
        p_candidatos: ["bruno", "carla"],
        p_agrupamento: "UNICO",
        p_saida: "SEI",
        p_campos: { data_limite: "2026-10-10", local: "Sede", documentos: "RG", contato: "" },
      },
    ]);
    expect(copiar.mock.calls[0][0].html).toContain("Texto_Justificado_Recuo_Primeira_Linha");

    // A mesma carta não registra de novo.
    await clicar($("cartaPdf"));
    expect(chamadas(supabase, "registrar_carta_convocacao")).toHaveLength(1);

    await clicar($("cartaMarcarConvocados"));
    expect(chamadas(supabase, "marcar_candidatos_convocados")).toEqual([
      { p_candidatos: ["bruno", "carla"], p_data_convocacao: HOJE, p_carta: "carta-1" },
    ]);
    expect(document.querySelector(".carta-emitida").textContent).toContain("2 marcado(s) como Convocado");
  });

  it("uma carta por candidato: DOCX sai num .zip e o SEI copia uma por vez", async () => {
    const { supabase, baixar } = await montar();
    await irParaConvocacao();
    for (const nome of ["Bruno Lima", "Carla Souza"])
      await clicar(linhaDe("approvedPanelConvocacao", nome).querySelector('[data-convocacao-action="escolher"]'));
    await clicar($("convocacaoCartaBtn"));
    await esperar(() => Promise.resolve());
    await clicar(document.querySelector('.carta-agrupamento [data-valor="POR_CANDIDATO"]'));
    expect($("cartaNavegacao").textContent).toContain("Carta 1 de 2");
    await clicar($("cartaDocx"));
    expect(baixar.mock.calls.at(-1)[1]).toMatch(/\.zip$/);
    await clicar(document.querySelector('[aria-label="Próxima carta"]'));
    await clicar($("cartaCopiarSei"));
    const registros = chamadas(supabase, "registrar_carta_convocacao");
    expect(registros.at(-1)).toMatchObject({
      p_candidatos: ["carla"],
      p_agrupamento: "POR_CANDIDATO",
      p_saida: "SEI",
    });
  });

  it("data limite que já passou bloqueia as saídas", async () => {
    await montar();
    await clicar(linhaDe("approvedPanelAprovados", "Bruno Lima").querySelector('[data-approved-action="carta"]'));
    await esperar(() => Promise.resolve());
    await digitar($("carta-dataLimite"), "2026-10-01");
    expect(document.querySelector(".carta-pendencias").textContent).toContain("A data limite já passou.");
    expect($("cartaCopiarSei").disabled).toBe(true);
  });

  it("sem modelo ativo, oferece criar um", async () => {
    await montar({ supabase: supabaseFalso({ modelos: { pode_editar: true, modelos: [] } }) });
    await clicar(linhaDe("approvedPanelAprovados", "Bruno Lima").querySelector('[data-approved-action="carta"]'));
    await esperar(() => Promise.resolve());
    expect($("cartaSemModelo").textContent).toContain("Nenhum modelo ativo");
    await clicar($("cartaCriarModelo"));
    expect($("cartaModelosModal")).not.toBeNull();
  });
});

describe("H4: modelos da carta, versionados", () => {
  it("cria um modelo da área com o texto padrão", async () => {
    const { supabase } = await montar();
    await irParaConvocacao();
    await clicar($("convocacaoModelosBtn"));
    await esperar(() => Promise.resolve());
    expect($("cartaListaDeModelos").textContent).toContain("Carta padrão");
    await clicar($("cartaNovoModelo"));
    await digitar($("cartaModeloNome"), "Carta do DSEI");
    supabase.rpc.mockClear();
    await clicar($("cartaModeloSalvar"));
    const [salvo] = chamadas(supabase, "salvar_modelo_carta_convocacao");
    expect(salvo).toMatchObject({
      p_modelo: null,
      p_area: "saude-indigena",
      p_edital: null,
      p_versao_atual: null,
      p_motivo: null,
    });
    expect(salvo.p_conteudo).toMatchObject({ nome: "Carta do DSEI", prazo_dias: 5 });
    expect(salvo.p_conteudo.texto).toContain("{DOCUMENTOS}");
  });

  it("editar pede o motivo e manda a versão aberta", async () => {
    const { supabase } = await montar();
    await irParaConvocacao();
    await clicar($("convocacaoModelosBtn"));
    await esperar(() => Promise.resolve());
    await clicar(document.querySelector('[data-modelo-action="editar"]'));
    expect($("cartaModeloSalvar").disabled).toBe(true);
    expect(document.querySelector(".carta-pendencias").textContent).toContain("Informe o motivo");
    await digitar($("cartaModeloMotivo"), "Novo local");
    supabase.rpc.mockClear();
    await clicar($("cartaModeloSalvar"));
    expect(chamadas(supabase, "salvar_modelo_carta_convocacao")[0]).toMatchObject({
      p_modelo: "m1",
      p_versao_atual: 2,
      p_motivo: "Novo local",
    });
  });

  it("campo desconhecido no texto não salva", async () => {
    await montar();
    await irParaConvocacao();
    await clicar($("convocacaoModelosBtn"));
    await esperar(() => Promise.resolve());
    await clicar($("cartaNovoModelo"));
    await digitar($("cartaModeloTexto"), "Olá {MATRICULA}");
    expect(document.querySelector(".carta-pendencias").textContent).toContain("Campo desconhecido: {MATRICULA}.");
    expect($("cartaModeloSalvar").disabled).toBe(true);
  });
});

describe("H7: cartas emitidas na gaveta do candidato", () => {
  it("o nome abre a gaveta com os dados e o histórico das cartas", async () => {
    const { supabase } = await montar();
    await clicar(linhaDe("approvedPanelAprovados", "Ana Ribeiro").querySelector('[data-approved-action="candidato"]'));
    await esperar(() => Promise.resolve());
    expect(chamadas(supabase, "listar_cartas_do_candidato")).toEqual([{ p_candidato: "ana" }]);
    expect($("approvedCandidatoTitulo").textContent).toBe("Ana Ribeiro");
    const cartas = $("approvedCandidatoCartas").textContent;
    expect(cartas).toContain("Carta padrão");
    expect(cartas).toContain("com mais 2 candidatos");
    expect(cartas).toContain("marcado Convocado em 01/10/2026");
  });
});
