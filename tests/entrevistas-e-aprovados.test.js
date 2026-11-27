// @vitest-environment node
import { bloco } from "./apoio/bloco.ts";
import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import {
  LIMITE_DO_ANEXO,
  anexosPorCandidato,
  arquivoEmBase64,
  formatarTamanho,
  pdfDoBase64,
  problemaDosAnexos,
} from "../src/lib/aprovados/anexos-do-candidato.ts";
import { readFileSync } from "node:fs";
import rotaDosAprovados from "../api/aprovados.ts";
import rotaDoCronograma from "../api/cronograma.ts";
import {
  aprovadoDaApi,
  etapaDaApi,
  respostaDoCronograma,
  respostaDosAprovados,
} from "../src/lib/aprovados/aprovados-e-cronograma-da-api.ts";
import { RPC_DOS_EDITAIS } from "../src/lib/editais/editais-da-api.ts";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.ts";
import {
  LISTA_DE_APROVADOS,
  expandirCandidatosCompactos,
  pacoteInalterado,
} from "../src/lib/aprovados/candidatos-aprovados-compactos.ts";
import { criarCacheDePayload } from "../src/lib/carga/cache-de-payload";
import {
  compactarCandidatos,
  compactarPorArea,
} from "./componentes/candidatos-compactos-falsos.ts";
import {
  aplicarRoteiroNaConfiguracao,
  atribuicoesDaBanca,
  avaliaACompetencia,
  avaliadoresDaCompetencia,
  avaliadoresDaFicha,
  avaliaTodas,
  competenciasDoAvaliador,
  competenciasSemAvaliador,
  calcularEntrevista,
  completarMembrosPelaComposicao,
  dadosDaConfiguracaoParaSalvar,
  editaisParaConduzir,
  errosDaConfiguracao,
  filtrarConvocados,
  mapaDasAvaliacoes,
  mensagemDoErroDaEntrevista,
  motivosDoParecer,
  notasAlteradas,
  podeLancarPor,
  progressoDasNotas,
  rascunhoDaConfiguracao,
} from "../src/lib/entrevistas/conducao-de-entrevista.ts";
import {
  aConvocar,
  avisosDaConvocacao,
  fonteDaConvocacao,
  gruposDaConvocacao,
  origemDasVagas,
  resumoDaConvocacao,
  textoDaRegraDaClassificacao,
  textoDasVagas,
  textoDoLimite,
  vagasDaLista,
  criteriosDeDesempate,
  textoDoEmpateFinal,
} from "../src/lib/entrevistas/convocacao-da-entrevista.ts";
import { instantaneoDaLista } from "../src/lib/classificacao/exportacao.ts";
import { linkInterno } from "../src/lib/navegacao/link-interno.ts";
import {
  modeloDeReferencia,
  normalizarModelo,
  lerModalidade,
  lerTermos,
  modeloEmBranco,
  normalizarTexto,
} from "../src/lib/aprovados/carta-de-convocacao/modelo-de-convocacao.ts";
import {
  derivarQuadro,
  montarConvocacaoDaVaga,
  sequenciaDeConvocacao,
  arredondarVaga,
  reservasEfetivas,
  csvDaConvocacao,
  estaAConvocar,
  jaFoiChamado,
  linhasDoCsvDaConvocacao,
  montarListaDeConvocacao,
  ordenarPorClassificacao,
  resumirConvocacao,
  situacaoNaChamada,
} from "../src/lib/aprovados/lista-convocacao-rules.ts";
import {
  comDistribuicao,
  previaDaConvocacao,
  resumoDasRegrasDaCategoria,
} from "../src/lib/aprovados/carta-de-convocacao/configuracao-de-convocacao.ts";
import {
  LEI_15142_ESPALHADA,
  FGV_MINIMOS_POR_CARGO,
} from "./modelos-de-convocacao-antigos.ts";
import {
  agendaDaConducao,
  codigoDaFalhaDaConducao,
  dadosDoEditalDaConducao,
  roteirosDaConducao,
} from "../src/lib/entrevistas/dados-da-conducao.ts";
import {
  lerDigitacao,
  movimentoDaTecla,
  moverNaGrade,
  textoDaEscala,
} from "../src/lib/entrevistas/digitacao-de-notas.ts";
import {
  emLotes,
  identificadorDaCarga,
  linhasDaAbaEntrevistados,
  normalizarCabecalho,
} from "../src/lib/entrevistas/entrevistas-da-planilha.ts";
import { PLANILHAS } from "../src/lib/base/planilhas.ts";
import {
  agruparAprovadosSemEntrevista,
  calcularIndicadores,
  contagemPorComparecimento,
  contagemPorParecer,
  tabelaDasEntrevistas,
  dataHoraBR,
  faixasDeNota,
  FILTROS_VAZIOS,
  filtrarAprovadosSemEntrevista,
  filtrarEntrevistas,
  formatarNota,
  mediaPorCriterio,
  normalizarPayload,
  normalizarAgendaDoPainel,
  notaDivergente,
  opcoesDosFiltros,
  pendenciasDasEntrevistas,
  rotuloCurtoDoCriterio,
  textoDasFontesDoPainel,
  topUnidades,
  andamentoDaEntrevista,
} from "../src/lib/entrevistas/entrevistas-do-painel.ts";
import {
  OPCOES_DO_FILTRO_DE_STATUS,
  STATUS_DO_CANDIDATO,
  candidateCargosForEdital,
  candidateModalidadesForEdital,
  filterApprovedCandidates,
  summarizeApprovedCandidates,
  paginateApprovedCandidates,
} from "../src/lib/aprovados/lista-aprovados-rules.ts";
import { criarEstadoDasEntrevistas } from "../src/modulos/entrevistas/estado.ts";
import { criarEstadoDaCarta } from "../src/modulos/aprovados/carta-de-convocacao/estado.ts";
import { lerModelosDoBanco } from "../src/lib/aprovados/carta-de-convocacao/carta-de-convocacao.ts";
import {
  criarEstadoDaConducao,
  opcionalDaConducao,
} from "../src/modulos/entrevistas/estado-da-conducao.ts";
import { criarEstadoDosRecursos } from "../src/modulos/recursos/estado.ts";
import { criarEstadoDaSelecao } from "../src/modulos/selecao/estado.ts";
import {
  SEM_ORDEM,
  ordenarAprovados,
  proximaOrdemDosAprovados,
} from "../src/lib/aprovados/ordem-dos-aprovados.ts";
import {
  contadorDoDia,
  contagemDosRecortes,
  horaEmBrasilia,
  proximaDoDia,
  situacaoNaTela,
  montarFila,
  progressoDoConvocado,
  recortarFila,
  recorteInicial,
  resumoDasSituacoes,
  rotuloDoDia,
  situacaoDoConvocado,
  vagasDaFila,
  buscarNaFila,
} from "../src/lib/entrevistas/fila-de-conducao.ts";
import {
  editalDoRecorte,
  gruposEmpatados,
  mapaDeEmpates,
  proximosDiasDaAgenda,
} from "../src/lib/entrevistas/painel-de-entrevistas.ts";
import { destinoDaTela, bloqueioDaTela } from "../src/lib/navegacao/navegacao";
import { paginasPermitidas } from "../src/lib/acessos/access-roles.ts";
import {
  parecerPronto,
  textoDoParecerDaEntrevista,
} from "../src/lib/entrevistas/parecer-da-entrevista.ts";
import {
  agendaPorDia,
  passoInicial,
  passosDoPreparar,
  pendenciasDaConfiguracao,
  textoDoAndamento,
} from "../src/lib/entrevistas/passos-do-preparar.ts";
import {
  errosPorSecao,
  pendenciasDoRoteiro,
  secaoDoErro,
} from "../src/lib/entrevistas/pendencias-do-roteiro.ts";
import {
  frasesDaEliminacao,
  fraseDaConvocacao,
  fraseDoDesempate,
  frasesDaBanca,
  frasesDaNota,
  linhasDasVagas,
  listaBr,
  resumoDasRegrasDaEntrevista,
} from "../src/lib/entrevistas/resumo-da-entrevista.ts";
import {
  errosDoRoteiro,
  arredondar,
  dadosDoRoteiroParaSalvar,
  lerListaDeNotas,
  lerNumero,
  minimoEmPontos,
  moverItem,
  notaNaEscala,
  notaAceita,
  opcoesDaEscala,
  pontuacaoMaxima,
  rascunhoDoRoteiro,
  resumoDoRoteiro,
  rotuloDoPeso,
  textoDaPontuacao,
} from "../src/lib/entrevistas/roteiro-de-entrevista.ts";

bloco("anexos-do-candidato", () => {
  // Sem DOM: o btoa/atob do jsdom é JS puro e leva segundos num PDF de 2 MB.

  const pdf = (name = "doc.pdf", size = 1000, type = "application/pdf") => ({
    name,
    size,
    type,
  });

  describe("problemaDosAnexos", () => {
    it("aceita nada e aceita PDFs dentro dos limites", () => {
      expect(problemaDosAnexos([])).toBe("");
      expect(problemaDosAnexos([pdf(), pdf("b.pdf")], 3)).toBe("");
      // Sem tipo (alguns navegadores), vale a extensão.
      expect(problemaDosAnexos([pdf("c.PDF", 10, "")])).toBe("");
    });

    it("recusa o que não é PDF", () => {
      expect(problemaDosAnexos([pdf("foto.png", 10, "image/png")])).toContain(
        "não é PDF",
      );
      expect(problemaDosAnexos([pdf("x.docx", 10, "")])).toContain("não é PDF");
    });

    it("recusa arquivo acima de 2 MB e arquivo vazio", () => {
      expect(problemaDosAnexos([pdf("g.pdf", LIMITE_DO_ANEXO)])).toBe("");
      expect(problemaDosAnexos([pdf("g.pdf", LIMITE_DO_ANEXO + 1)])).toContain(
        "2 MB",
      );
      expect(problemaDosAnexos([pdf("v.pdf", 0)])).toContain("vazio");
    });

    it("conta os que o candidato já tem contra o limite de 5", () => {
      const tres = [pdf("a.pdf"), pdf("b.pdf"), pdf("c.pdf")];
      expect(problemaDosAnexos(tres, 2)).toBe("");
      expect(problemaDosAnexos(tres, 3)).toContain("Cabem só mais 2");
      expect(problemaDosAnexos([pdf()], 5)).toContain("já tem 5");
      expect(
        problemaDosAnexos(Array.from({ length: 6 }, () => pdf())),
      ).toContain("Cabem só mais 5");
    });
  });

  describe("anexosPorCandidato", () => {
    it("agrupa por candidato, na ordem que veio", () => {
      const mapa = anexosPorCandidato([
        { anexo_id: 1, candidato_id: "a" },
        { anexo_id: 2, candidato_id: "b" },
        { anexo_id: 3, candidato_id: "a" },
        { anexo_id: 4 },
      ]);
      expect(mapa.get("a").map((x) => x.anexo_id)).toEqual([1, 3]);
      expect(mapa.get("b")).toHaveLength(1);
      expect(mapa.size).toBe(2);
      expect(anexosPorCandidato({ ok: true }).size).toBe(0);
    });
  });

  describe("formatarTamanho", () => {
    it("KB abaixo de 1 MB, MB com vírgula acima", () => {
      expect(formatarTamanho(100)).toBe("1 KB");
      expect(formatarTamanho(850 * 1024)).toBe("850 KB");
      expect(formatarTamanho(1.5 * 1024 * 1024)).toBe("1,5 MB");
    });
  });

  describe("base64 do PDF", () => {
    it("vai e volta sem perder byte, inclusive num PDF de 2 MB", async () => {
      const bytes = new Uint8Array(LIMITE_DO_ANEXO).map((_, i) => i % 256);
      const arquivo = new File([bytes], "grande.pdf", {
        type: "application/pdf",
      });
      const base64 = await arquivoEmBase64(arquivo);
      expect(base64).not.toContain("data:");
      const volta = pdfDoBase64(base64);
      expect(volta.type).toBe("application/pdf");
      const recebidos = new Uint8Array(await volta.arrayBuffer());
      expect(Buffer.compare(recebidos, bytes)).toBe(0);
    });
  });
});

bloco("aprovados-e-cronograma-api", () => {
  /*
  GET /api/aprovados e GET /api/cronograma (para outro sistema, sem login, pela
  chave fixa de /api/editais) e a migration 20261105150000 das duas leituras.
*/

  const APROVADOS = [
    {
      edital_id: "e1",
      edital: "001/2026",
      unidade: "DSEI Yanomami",
      area: "Saúde Indígena",
      cargo: "Enfermeiro",
      classificacao: 1,
      nota: "87,5",
      nome: "Maria da Silva",
      modalidade: "Ampla concorrência",
      status: "Contratado",
      matricula: 12345,
      processo_sei: "25000.000000/2026-00",
      codigo_vaga: "ENF-01",
      sub_judice: false,
    },
    {
      edital_id: "e2",
      edital: "002/2026",
      unidade: "DSEI Alto Rio Negro",
      area: "SEDE",
      cargo: "Médico",
      classificacao: null,
      nota: null,
      nome: "João Souza",
      modalidade: "Pessoa com deficiência",
      status: null,
      matricula: null,
      processo_sei: null,
      codigo_vaga: null,
      sub_judice: true,
    },
  ];

  const ETAPAS = [
    {
      edital_id: "e1",
      edital: "001/2026",
      unidade: "DSEI Yanomami",
      area: "Saúde Indígena",
      ordem: 1,
      atividade: "Publicação do edital",
      data_inicio: "2026-03-02",
      data_fim: "2026-03-02T00:00:00",
    },
    {
      edital_id: "e2",
      edital: "002/2026",
      unidade: "DSEI Alto Rio Negro",
      area: "SEDE",
      ordem: 2,
      atividade: "Análise curricular",
      data_inicio: null,
      data_fim: "",
    },
  ];

  describe("formato dos aprovados", () => {
    it("todos os campos combinados, com números, nulos e booleano", () => {
      expect(aprovadoDaApi(APROVADOS[0])).toEqual({
        edital_id: "e1",
        edital: "001/2026",
        unidade: "DSEI Yanomami",
        area: "Saúde Indígena",
        cargo: "Enfermeiro",
        classificacao: 1,
        nota: 87.5,
        nome: "Maria da Silva",
        modalidade: "Ampla concorrência",
        status: "Contratado",
        matricula: "12345",
        processo_sei: "25000.000000/2026-00",
        codigo_vaga: "ENF-01",
        sub_judice: false,
      });
      const vazio = aprovadoDaApi(APROVADOS[1]);
      expect(vazio.classificacao).toBeNull();
      expect(vazio.nota).toBeNull();
      expect(vazio.status).toBe("");
      expect(vazio.sub_judice).toBe(true);
    });

    it("filtra por igual (sem caixa nem acento) e por trecho", () => {
      const ids = (query) =>
        respostaDosAprovados({ linhas: APROVADOS }, query).aprovados.map(
          (a) => a.edital_id,
        );
      expect(ids({})).toEqual(["e1", "e2"]);
      expect(ids({ status: "contratado" })).toEqual(["e1"]);
      expect(ids({ modalidade: "pessoa com deficiencia" })).toEqual(["e2"]);
      expect(ids({ edital_id: "E2" })).toEqual(["e2"]);
      expect(ids({ nome: "silva" })).toEqual(["e1"]);
      expect(ids({ cargo: "medico", unidade: "rio negro" })).toEqual(["e2"]);
      expect(ids({ status: "contrat" })).toEqual([]);
      expect(respostaDosAprovados(null, {})).toEqual({
        aprovados: [],
        totais: { linhas: 0 },
      });
    });
  });

  describe("formato do cronograma", () => {
    it("datas em AAAA-MM-DD ou null, ordem numérica", () => {
      expect(etapaDaApi(ETAPAS[0])).toEqual({
        edital_id: "e1",
        edital: "001/2026",
        unidade: "DSEI Yanomami",
        area: "Saúde Indígena",
        ordem: 1,
        atividade: "Publicação do edital",
        data_inicio: "2026-03-02",
        data_fim: "2026-03-02",
      });
      expect(etapaDaApi(ETAPAS[1]).data_inicio).toBeNull();
      expect(etapaDaApi(ETAPAS[1]).data_fim).toBeNull();
    });

    it("filtra por edital_id, unidade e atividade", () => {
      const ids = (query) =>
        respostaDoCronograma({ linhas: ETAPAS }, query).etapas.map(
          (e) => e.edital_id,
        );
      expect(ids({ edital_id: "e1" })).toEqual(["e1"]);
      expect(ids({ atividade: "analise" })).toEqual(["e2"]);
      expect(respostaDoCronograma({ linhas: ETAPAS }, {}).totais).toEqual({
        linhas: 2,
      });
    });
  });

  function respostaFalsa() {
    const res = { statusCode: 0, headers: {}, corpo: "" };
    res.status = (s) => ((res.statusCode = s), res);
    res.setHeader = (k, v) => ((res.headers[k.toLowerCase()] = v), res);
    res.end = (c = "") => ((res.corpo = c), res);
    return res;
  }
  const CHAVE = "chave-da-api-combinada";
  const pedido = (chave = CHAVE, query = {}) => ({
    method: "GET",
    headers: { authorization: `Bearer ${chave}` },
    query,
  });

  describe.each([
    ["aprovados", rotaDosAprovados, "listar_aprovados_da_api", APROVADOS],
    ["cronograma", rotaDoCronograma, "listar_cronograma_da_api", ETAPAS],
  ])("GET /api/%s", (nome, rota, rpc, linhas) => {
    beforeEach(() => {
      vi.stubEnv("VITE_SUPABASE_URL", "https://exemplo.supabase.co");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_servidor");
      vi.stubEnv("EDITAIS_API_CHAVE", CHAVE);
    });
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });

    it("chave errada: 401 sem chamar o banco", async () => {
      const fetchFalso = vi.fn();
      vi.stubGlobal("fetch", fetchFalso);
      const res = respostaFalsa();
      await rota(pedido("outra"), res);
      expect(res.statusCode).toBe(401);
      expect(fetchFalso).not.toHaveBeenCalled();
    });

    it("chave certa: lê a RPC própria com a chave de servidor", async () => {
      const fetchFalso = vi.fn(async () => ({
        ok: true,
        json: async () => ({ linhas }),
      }));
      vi.stubGlobal("fetch", fetchFalso);
      const res = respostaFalsa();
      await rota(pedido(), res);
      expect(res.statusCode).toBe(200);
      const [url, opcoes] = fetchFalso.mock.calls[0];
      expect(url).toBe(`https://exemplo.supabase.co/rest/v1/rpc/${rpc}`);
      expect(opcoes.headers.apikey).toBe("sb_secret_servidor");
      expect(JSON.stringify(opcoes)).not.toContain(CHAVE);
      const corpo = JSON.parse(res.corpo);
      expect(corpo.totais).toEqual({ linhas: 2 });
      expect(corpo[nome === "aprovados" ? "aprovados" : "etapas"]).toHaveLength(
        2,
      );
    });

    it("falha do banco: 502", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: false, json: async () => ({}) })),
      );
      const res = respostaFalsa();
      await rota(pedido(), res);
      expect(res.statusCode).toBe(502);
    });
  });
});

bloco("candidatos-aprovados-compactos", () => {
  /* Candidatos no formato de sempre, com repetição e nulos nos campos de dicionário. */
  const CANDIDATOS = [
    {
      candidato_id: "a",
      lista_id: "L1",
      cargo: "Enfermeiro",
      classificacao: 1,
      nota: 90.5,
      nome: "Ana",
      modalidade: "Ampla concorrência",
      status: "Contratado",
      processo_sei: "25000.1/2026",
      matricula: "M-1",
      sub_judice: false,
      codigo_vaga: "VG-1",
      edital_id: "7",
      edital: "53/2025",
      unidade: "CASAI São Paulo",
      lista_ativa: true,
      arquivo_nome: "lista.xlsx",
      importado_em: "2026-09-01T10:00:00+00:00",
    },
    {
      candidato_id: "b",
      lista_id: "L2",
      cargo: "Médico",
      classificacao: null,
      nota: 70,
      nome: "Bruno",
      modalidade: null,
      status: null,
      processo_sei: null,
      matricula: null,
      sub_judice: true,
      codigo_vaga: null,
      edital_id: "8",
      edital: "54/2025",
      unidade: "DSEI Manaus",
      lista_ativa: false,
      arquivo_nome: null,
      importado_em: null,
    },
    {
      candidato_id: "c",
      lista_id: "L1",
      cargo: "Enfermeiro",
      classificacao: 2,
      nota: 88,
      nome: "Carla",
      modalidade: "Ampla concorrência",
      status: null,
      processo_sei: null,
      matricula: null,
      sub_judice: false,
      codigo_vaga: "VG-1",
      edital_id: "7",
      edital: "53/2025",
      unidade: "CASAI São Paulo",
      lista_ativa: true,
      arquivo_nome: "lista.xlsx",
      importado_em: "2026-09-01T10:00:00+00:00",
    },
  ];

  describe("lista de aprovados numa chamada só", () => {
    it("volta ao formato de sempre, com os dados da lista em cada candidato", () => {
      const pacote = {
        colunas_da_lista: ["edital_id", "edital", "unidade", "lista_ativa"],
        listas: { L1: ["7", "53/2025", "CASAI São Paulo", true] },
        colunas: ["candidato_id", "lista_id", "nome", "sub_judice"],
        linhas: [
          ["a", "L1", "Ana", false],
          ["b", "L1", "Bruno", true],
        ],
      };
      expect(expandirCandidatosCompactos(pacote)).toEqual([
        {
          candidato_id: "a",
          lista_id: "L1",
          nome: "Ana",
          sub_judice: false,
          edital_id: "7",
          edital: "53/2025",
          unidade: "CASAI São Paulo",
          lista_ativa: true,
        },
        {
          candidato_id: "b",
          lista_id: "L1",
          nome: "Bruno",
          sub_judice: true,
          edital_id: "7",
          edital: "53/2025",
          unidade: "CASAI São Paulo",
          lista_ativa: true,
        },
      ]);
    });

    it("pacote vazio ou quebrado vira lista vazia", () => {
      expect(expandirCandidatosCompactos(null)).toEqual([]);
      expect(expandirCandidatosCompactos({ linhas: "x" })).toEqual([]);
    });

    it("lista ausente deixa os campos da lista nulos", () => {
      const [c] = expandirCandidatosCompactos({
        colunas_da_lista: ["edital"],
        listas: {},
        colunas: ["candidato_id", "lista_id"],
        linhas: [["a", "L9"]],
      });
      expect(c.edital).toBeNull();
    });
  });

  /* Quem não foi alterado por decisão judicial: as 4 colunas da alteração em nulo. */
  const SEM_ALTERACAO = {
    alterado_judicialmente: null,
    nota_original: null,
    modalidade_original: null,
    classificacao_original: null,
  };

  describe("formato 2: por área, com dicionário", () => {
    it("remonta objetos idênticos aos do formato 1, com as chaves na mesma ordem", () => {
      const antes = expandirCandidatosCompactos(
        compactarCandidatos(CANDIDATOS),
      );
      const depois = expandirCandidatosCompactos(compactarPorArea(CANDIDATOS));
      expect(depois).toEqual(antes);
      expect(depois).toEqual(
        CANDIDATOS.map((c) => ({ ...c, ...SEM_ALTERACAO })),
      );
      depois.forEach((candidato, i) =>
        expect(Object.keys(candidato)).toEqual(Object.keys(antes[i])),
      );
    });

    it("só a linha alterada por decisão judicial leva as 4 posições a mais", () => {
      const alterado = {
        ...CANDIDATOS[0],
        nota: 40,
        sub_judice: true,
        alterado_judicialmente: true,
        nota_original: 33,
        modalidade_original: "Ampla concorrência",
        classificacao_original: 7,
      };
      const pacote = compactarPorArea([alterado, CANDIDATOS[1]]);
      expect(pacote.colunas).toHaveLength(16);
      expect(pacote.linhas[0]).toHaveLength(16);
      expect(pacote.linhas[1]).toHaveLength(12);
      const [de, sem] = expandirCandidatosCompactos(pacote);
      expect(de).toMatchObject({
        nota: 40,
        alterado_judicialmente: true,
        nota_original: 33,
        modalidade_original: "Ampla concorrência",
        classificacao_original: 7,
      });
      expect(sem).toMatchObject(SEM_ALTERACAO);
    });

    it("cargo e código da vaga repetidos vão uma vez só", () => {
      const pacote = compactarPorArea(CANDIDATOS);
      expect(pacote.dicionarios.cargo).toEqual(["Enfermeiro", "Médico"]);
      expect(pacote.dicionarios.codigo_vaga).toEqual(["VG-1"]);
      expect(pacote.linhas[1][11]).toBeNull();
      expect(pacote.listas).toHaveLength(2);
    });

    it("índice fora do dicionário vira nulo, sem quebrar", () => {
      const pacote = compactarPorArea(CANDIDATOS);
      pacote.linhas[0][2] = 99;
      expect(expandirCandidatosCompactos(pacote)[0].cargo).toBeNull();
    });

    it("reconhece a resposta de versão que continua valendo", () => {
      expect(
        pacoteInalterado({ formato: 2, versao: "v1", inalterado: true }),
      ).toBe(true);
      expect(pacoteInalterado(compactarPorArea(CANDIDATOS))).toBe(false);
      expect(pacoteInalterado(null)).toBe(false);
    });
  });

  describe("cópia da lista de aprovados no navegador", () => {
    function armazenamentoEmMemoria() {
      const dados = new Map();
      return {
        dados,
        ler: async (chave) => structuredClone(dados.get(chave) ?? null),
        guardar: async (chave, valor) => {
          dados.set(chave, structuredClone(valor));
        },
        apagarTudo: async () => dados.clear(),
      };
    }

    it("guarda uma cópia por usuário e área, só do formato 2", async () => {
      const armazenamento = armazenamentoEmMemoria();
      const cache = criarCacheDePayload({
        armazenamento,
        versao: "pub-1",
        tipo: LISTA_DE_APROVADOS,
      });
      const sede = compactarPorArea(CANDIDATOS, { area: "sede", versao: "x" });
      expect(await cache.guardar({ usuarioId: "u1", area: "sede" }, sede)).toBe(
        true,
      );
      expect(await cache.ler({ usuarioId: "u1", area: "sede" })).toEqual(sede);
      expect(await cache.ler({ usuarioId: "u1", area: "projetos" })).toBeNull();
      expect(armazenamento.dados.has("aprovados:sede")).toBe(true);
      // O formato 1 (todas as áreas, sem versão) não é guardado.
      expect(
        await cache.guardar(
          { usuarioId: "u1", area: "sede" },
          compactarCandidatos(CANDIDATOS),
        ),
      ).toBe(false);
    });

    it("outro usuário apaga as cópias de quem veio antes", async () => {
      const armazenamento = armazenamentoEmMemoria();
      const cache = criarCacheDePayload({
        armazenamento,
        versao: "pub-1",
        tipo: LISTA_DE_APROVADOS,
      });
      await cache.guardar(
        { usuarioId: "u1", area: "sede" },
        compactarPorArea(CANDIDATOS),
      );
      expect(await cache.ler({ usuarioId: "u2", area: "sede" })).toBeNull();
      expect(await cache.ler({ usuarioId: "u1", area: "sede" })).toBeNull();
    });
  });
});

bloco("conducao-de-entrevista", () => {
  const CONVOCACAO = {
    multiplo_imediatas: 5,
    posicao_cadastro_reserva: 10,
    excecoes: [
      {
        termo_cargo: "Enfermagem",
        multiplo_imediatas: 10,
        posicao_cadastro_reserva: 20,
      },
    ],
  };

  const NIVEIS = {
    id: "r1",
    versao: 1,
    escala: "NIVEIS",
    nota_minima_total: 8,
    notas_eliminatorias: [0, 1],
    ausencia_elimina: true,
    competencias: [1, 2, 3, 4].map((ordem) => ({
      id: `c${ordem}`,
      ordem,
      nome: `C${ordem}`,
      nota_maxima: 5,
      peso: 1,
      minimo: 2,
      tipo_minimo: "VALOR",
    })),
    niveis: [0, 1, 2, 3, 4, 5].map((nota) => ({ nota, nome: `N${nota}` })),
    convocacao_padrao: CONVOCACAO,
    banca_padrao: [
      { origem: "AgSUS", quantidade: 1 },
      { origem: "CONDISI", quantidade: 2 },
    ],
  };

  const FAIXA = {
    id: "r2",
    escala: "FAIXA",
    passo: 0.5,
    nota_minima_total: 5,
    notas_eliminatorias: [],
    ausencia_elimina: false,
    competencias: [
      {
        id: "p1",
        ordem: 1,
        nome: "Técnica",
        nota_maxima: 2,
        peso: 1,
        minimo: 50,
        tipo_minimo: "PERCENTUAL",
      },
      {
        id: "p2",
        ordem: 2,
        nome: "Intercultural",
        nota_maxima: 2,
        peso: 1.5,
        minimo: 50,
        tipo_minimo: "PERCENTUAL",
      },
    ],
  };

  /* Notas de dois avaliadores: `{ competencia: [nota do a1, nota do a2] }`. */
  const notas = (porCompetencia) =>
    Object.entries(porCompetencia).flatMap(([competencia, valores]) =>
      valores.map((nota, i) => ({ competencia, avaliador: `a${i + 1}`, nota })),
    );

  describe("cálculo do resultado (espelho de FC_CALCULAR_ENTREVISTA)", () => {
    it("APTO: média × peso por competência, total e mínimos cumpridos", () => {
      const r = calcularEntrevista({
        roteiro: NIVEIS,
        compareceu: "S",
        avaliacoes: notas({ c1: [3, 4], c2: [2, 3], c3: [5, 5], c4: [2, 2] }),
      });
      expect(r.competencias.map((c) => c.nota)).toEqual([3.5, 2.5, 5, 2]);
      expect(r.total).toBe(13);
      expect(r.parecer).toBe("APTO");
    });

    it("INAPTO por média eliminatória, por mínimo da competência e pelo total", () => {
      const eliminatoria = calcularEntrevista({
        roteiro: NIVEIS,
        compareceu: "S",
        avaliacoes: notas({ c1: [1, 1], c2: [5, 5], c3: [5, 5], c4: [5, 5] }),
      });
      expect(eliminatoria.competencias[0]).toMatchObject({
        media: 1,
        eliminatoria: true,
        abaixoDoMinimo: true,
      });
      expect(eliminatoria.parecer).toBe("INAPTO");

      // média 1,5 não é eliminatória, mas fica abaixo do mínimo 2.
      const minimo = calcularEntrevista({
        roteiro: NIVEIS,
        compareceu: "S",
        avaliacoes: notas({ c1: [1, 2], c2: [5, 5], c3: [5, 5], c4: [5, 5] }),
      });
      expect(minimo.competencias[0]).toMatchObject({
        media: 1.5,
        eliminatoria: false,
        abaixoDoMinimo: true,
      });
      expect(minimo.parecer).toBe("INAPTO");

      const total = calcularEntrevista({
        roteiro: { ...NIVEIS, nota_minima_total: 12 },
        compareceu: "S",
        avaliacoes: notas({ c1: [2, 2], c2: [2, 2], c3: [3, 3], c4: [2, 2] }),
      });
      expect(total.total).toBe(9);
      expect(total.parecer).toBe("INAPTO");
      expect(total.abaixoDoMinimoTotal).toBe(true);
    });

    it("peso e mínimo percentual (1,5 = +50%)", () => {
      const r = calcularEntrevista({
        roteiro: FAIXA,
        compareceu: "S",
        avaliacoes: notas({ p1: [2, 1.5], p2: [1.5, 2] }),
      });
      expect(r.competencias.map((c) => c.nota)).toEqual([1.75, 2.63]);
      expect(r.competencias[1].minimo).toBe(1.5);
      expect(r.total).toBe(4.38);
      expect(r.parecer).toBe("INAPTO"); // total < 5
    });

    it("média de quem lançou; competência sem nota = SEM_PARECER", () => {
      const r = calcularEntrevista({
        roteiro: NIVEIS,
        compareceu: "S",
        avaliacoes: [
          { competencia: "c1", avaliador: "a1", nota: 4 },
          { competencia: "c2", avaliador: "a1", nota: 4 },
          { competencia: "c3", avaliador: "a1", nota: 4 },
        ],
      });
      expect(r.falta).toBe(true);
      expect(r.total).toBe(12);
      expect(r.parecer).toBe("SEM_PARECER");
      expect(motivosDoParecer(r, "S", NIVEIS)).toEqual(["Sem nota em “C4”."]);
      expect(
        calcularEntrevista({ roteiro: NIVEIS, compareceu: "S", avaliacoes: [] })
          .total,
      ).toBeNull();
    });

    it("comparecimento: falta elimina (ou não), não informado fica sem parecer", () => {
      const todas = notas({ c1: [5], c2: [5], c3: [5], c4: [5] });
      const faltou = calcularEntrevista({
        roteiro: NIVEIS,
        compareceu: "N",
        avaliacoes: todas,
      });
      expect(faltou).toMatchObject({ total: 0, parecer: "INAPTO" });
      expect(motivosDoParecer(faltou, "N", NIVEIS)[0]).toMatch(
        /ausência elimina/,
      );
      expect(
        calcularEntrevista({
          roteiro: { ...NIVEIS, ausencia_elimina: false },
          compareceu: "N",
          avaliacoes: todas,
        }).parecer,
      ).toBe("SEM_PARECER");
      expect(
        calcularEntrevista({
          roteiro: NIVEIS,
          compareceu: null,
          avaliacoes: todas,
        }).parecer,
      ).toBe("SEM_PARECER");
    });

    it("total no mínimo exato é APTO (3,3 + 4,85 + 3,85 = 12, sem o 11,999… do ponto flutuante)", () => {
      const competencia = (id, ordem) => ({
        id,
        ordem,
        nome: id,
        nota_maxima: 5,
        peso: 1,
      });
      const r = calcularEntrevista({
        roteiro: {
          escala: "FAIXA",
          nota_minima_total: 12,
          notas_eliminatorias: [],
          competencias: [
            competencia("t1", 1),
            competencia("t2", 2),
            competencia("t3", 3),
          ],
        },
        compareceu: "S",
        avaliacoes: notas({ t1: [3.3], t2: [4.85], t3: [3.85] }),
      });
      expect(r.total).toBe(12);
      expect(r.abaixoDoMinimoTotal).toBe(false);
      expect(r.parecer).toBe("APTO");
    });

    it("mínimo percentual sem arredondar, como o banco: 10,84% de 10 = 1,084 e a nota 1,08 fica abaixo", () => {
      const r = calcularEntrevista({
        roteiro: {
          escala: "FAIXA",
          notas_eliminatorias: [],
          competencias: [
            {
              id: "m1",
              ordem: 1,
              nome: "Técnica",
              nota_maxima: 10,
              peso: 1,
              minimo: 10.84,
              tipo_minimo: "PERCENTUAL",
            },
          ],
        },
        compareceu: "S",
        avaliacoes: notas({ m1: [1.08] }),
      });
      expect(r.competencias[0].minimo).toBe(1.084);
      expect(r.competencias[0].abaixoDoMinimo).toBe(true);
      expect(r.parecer).toBe("INAPTO");
    });
  });

  describe("ficha de notas", () => {
    const AVALIADORES = [
      { id: "a1", nome: "Ana", banca: 1, perfil: "p-ana", ativo: true },
      { id: "a2", nome: "Beto", banca: 1, perfil: null, ativo: true },
      { id: "a3", nome: "Caio", banca: 2, perfil: null, ativo: true },
      { id: "a4", nome: "Dora", banca: 1, perfil: null, ativo: false },
    ];

    it("só envia o que mudou (null apaga a nota)", () => {
      const original = mapaDasAvaliacoes([
        { competencia: "c1", avaliador: "a1", nota: 3 },
        { competencia: "c2", avaliador: "a1", nota: 4 },
      ]);
      expect(original).toEqual({ "c1|a1": "3", "c2|a1": "4" });
      const atual = { ...original, "c1|a1": "3.0", "c2|a1": "", "c3|a2": "5" };
      expect(notasAlteradas(original, atual)).toEqual([
        { competencia: "c2", avaliador: "a1", nota: null },
        { competencia: "c3", avaliador: "a2", nota: 5 },
      ]);
    });

    it("avaliadores da banca, mais quem já deu nota", () => {
      const convocado = {
        avaliacoes: [{ competencia: "c1", avaliador: "a4", nota: 3 }],
      };
      expect(
        avaliadoresDaFicha(AVALIADORES, convocado, 1).map((a) => a.id),
      ).toEqual(["a1", "a2", "a4"]);
      expect(
        avaliadoresDaFicha(AVALIADORES, { avaliacoes: [] }, null).map(
          (a) => a.id,
        ),
      ).toEqual(["a1", "a2", "a3"]);
      expect(
        progressoDasNotas(
          convocado,
          AVALIADORES.slice(0, 2),
          NIVEIS.competencias,
        ),
      ).toEqual({
        lancadas: 0,
        esperadas: 8,
      });
    });

    it("modo AVALIADOR: só a própria coluna (o admin global lança por todos)", () => {
      const base = {
        pode_editar: true,
        meu_perfil: "p-ana",
        admin_global: false,
        configuracao: { lancamento: "AVALIADOR" },
      };
      expect(podeLancarPor(base, AVALIADORES[0])).toBe(true);
      expect(podeLancarPor(base, AVALIADORES[1])).toBe(false);
      expect(
        podeLancarPor({ ...base, admin_global: true }, AVALIADORES[1]),
      ).toBe(true);
      expect(
        podeLancarPor(
          { ...base, configuracao: { lancamento: "SECRETARIA" } },
          AVALIADORES[1],
        ),
      ).toBe(true);
      expect(
        podeLancarPor({ ...base, pode_editar: false }, AVALIADORES[0]),
      ).toBe(false);
      expect(
        podeLancarPor({ ...base, admin_global: true }, AVALIADORES[3]),
      ).toBe(false);
    });

    it("filtra os convocados por vaga, banca e busca", () => {
      const lista = [
        { id: "1", candidato: "João", codigo: "C1", vaga: "V1", banca: 1 },
        { id: "2", candidato: "Maria", codigo: "C2", vaga: "V2", banca: null },
      ];
      expect(
        filtrarConvocados(lista, { vaga: "V1", banca: "", busca: "" }).map(
          (c) => c.id,
        ),
      ).toEqual(["1"]);
      expect(
        filtrarConvocados(lista, { vaga: "", banca: "sem", busca: "" }).map(
          (c) => c.id,
        ),
      ).toEqual(["2"]);
      expect(
        filtrarConvocados(lista, { vaga: "", banca: "", busca: "joao" }).map(
          (c) => c.id,
        ),
      ).toEqual(["1"]);
    });
  });

  describe("configuração do edital", () => {
    const DADOS = {
      meu_perfil: "p1",
      configuracao: null,
      avaliadores: [
        {
          id: "a1",
          nome: "Ana",
          origem: "AgSUS",
          banca: 1,
          perfil: null,
          ativo: true,
        },
        {
          id: "a2",
          nome: "Saiu",
          origem: "DSEI",
          banca: 1,
          perfil: null,
          ativo: false,
        },
      ],
      convocados: [],
    };

    it("escolher o roteiro pré-preenche a banca; convocação e vagas não são da entrevista", () => {
      const r = aplicarRoteiroNaConfiguracao(
        rascunhoDaConfiguracao(DADOS),
        NIVEIS,
      );
      expect(r.roteiro).toBe("r1");
      expect(r.banca.map((b) => b.origem)).toEqual(["AgSUS", "CONDISI"]);
      expect(r.avaliadores.map((a) => a.id)).toEqual(["a1"]);
      expect(r).not.toHaveProperty("convocacao");
      expect(r).not.toHaveProperty("vagas");
    });

    it("completa os membros pela composição e valida", () => {
      const r = aplicarRoteiroNaConfiguracao(
        rascunhoDaConfiguracao(DADOS),
        NIVEIS,
      );
      const membros = completarMembrosPelaComposicao(r.avaliadores, r.banca);
      expect(membros.map((a) => a.origem)).toEqual([
        "AgSUS",
        "CONDISI",
        "CONDISI",
      ]);
      const erros = errosDaConfiguracao({ ...r, avaliadores: membros });
      expect(
        Object.keys(erros).filter((k) => k.endsWith(".nome")),
      ).toHaveLength(2);
      expect(errosDaConfiguracao({ ...r, roteiro: "" }).roteiro).toBeTruthy();
    });

    it("monta o p_dados de configurar_entrevista_edital", () => {
      const r = aplicarRoteiroNaConfiguracao(
        rascunhoDaConfiguracao(DADOS),
        NIVEIS,
      );
      const dados = dadosDaConfiguracaoParaSalvar({
        ...r,
        lancamento: "AVALIADOR",
        avaliadores: [
          ...r.avaliadores,
          {
            chave: "x",
            id: null,
            nome: " Bia ",
            origem: "CONDISI",
            banca: "2",
            perfil: "",
          },
        ],
      });
      expect(dados).toEqual({
        roteiro: "r1",
        banca: NIVEIS.banca_padrao,
        lancamento: "AVALIADOR",
        avaliadores: [
          {
            id: "a1",
            nome: "Ana",
            origem: "AgSUS",
            banca: 1,
            perfil: null,
            competencias: null,
          },
          {
            nome: "Bia",
            origem: "CONDISI",
            banca: 2,
            perfil: null,
            competencias: null,
          },
        ],
      });
    });
  });

  describe("avaliador por competência", () => {
    const COMPS = NIVEIS.competencias;
    const ANA = { id: "a1", nome: "Ana", banca: 1, competencias: null };
    const DSEI = { id: "a2", nome: "Davi", banca: 1, competencias: ["c2"] };

    it("sem lista avalia todas; com lista, só as dela (na ordem do roteiro)", () => {
      expect(competenciasDoAvaliador(ANA, COMPS)).toEqual([
        "c1",
        "c2",
        "c3",
        "c4",
      ]);
      expect(
        competenciasDoAvaliador({ competencias: ["c4", "c1"] }, COMPS),
      ).toEqual(["c1", "c4"]);
      expect(avaliaTodas(ANA, COMPS)).toBe(true);
      expect(avaliaTodas(DSEI, COMPS)).toBe(false);
      expect(avaliaACompetencia(DSEI, "c2", COMPS)).toBe(true);
      expect(avaliaACompetencia(DSEI, "c1", COMPS)).toBe(false);
      // Lista de outro roteiro (nenhuma competência deste): conta como todas.
      expect(avaliaTodas({ competencias: ["x9"] }, COMPS)).toBe(true);
      expect(
        avaliadoresDaCompetencia([ANA, DSEI], "c1", COMPS).map((a) => a.id),
      ).toEqual(["a1"]);
      expect(atribuicoesDaBanca([ANA, DSEI], COMPS)).toEqual({ a2: ["c2"] });
    });

    it("cada competência precisa de alguém em cada banca", () => {
      expect(competenciasSemAvaliador([ANA, DSEI], COMPS)).toEqual([]);
      const faltas = competenciasSemAvaliador(
        [
          { ...ANA, competencias: ["c1"] },
          DSEI,
          { id: "a3", banca: 2, competencias: null },
          { id: "a4", banca: 1, ativo: false },
        ],
        COMPS,
      );
      expect(faltas.map((f) => `${f.banca}:${f.competencia.id}`)).toEqual([
        "1:c3",
        "1:c4",
      ]);
    });

    it("a configuração valida, normaliza 'todas' e o roteiro novo zera as escolhas", () => {
      const base = {
        roteiro: "r1",
        banca: [],
        lancamento: "SECRETARIA",
        avaliadores: [
          { ...ANA, chave: "k1", origem: "AgSUS", perfil: "", banca: "1" },
          { ...DSEI, chave: "k2", origem: "DSEI", perfil: "", banca: "1" },
        ],
      };
      expect(errosDaConfiguracao(base, NIVEIS)).toEqual({});
      const semNinguem = {
        ...base,
        avaliadores: [
          { ...base.avaliadores[0], competencias: ["c1"] },
          { ...base.avaliadores[1], competencias: [] },
        ],
      };
      const erros = errosDaConfiguracao(semNinguem, NIVEIS);
      expect(erros["avaliador.k2.competencias"]).toBeTruthy();
      expect(erros.cobertura).toContain("Banca 1: ninguém avalia “C2”.");
      const todas = {
        ...base,
        avaliadores: [
          { ...base.avaliadores[1], competencias: ["c1", "c2", "c3", "c4"] },
        ],
      };
      expect(
        dadosDaConfiguracaoParaSalvar(todas, NIVEIS).avaliadores[0]
          .competencias,
      ).toBeNull();
      expect(
        dadosDaConfiguracaoParaSalvar(base, NIVEIS).avaliadores.map(
          (a) => a.competencias,
        ),
      ).toEqual([null, ["c2"]]);
      expect(
        rascunhoDaConfiguracao({
          avaliadores: [{ ...DSEI, origem: "DSEI", ativo: true }],
        }).avaliadores[0].competencias,
      ).toEqual(["c2"]);
      const outro = aplicarRoteiroNaConfiguracao(base, { ...NIVEIS, id: "r9" });
      expect(outro.avaliadores.map((a) => a.competencias)).toEqual([
        null,
        null,
      ]);
      const mesmo = aplicarRoteiroNaConfiguracao(base, NIVEIS);
      expect(mesmo.avaliadores[1].competencias).toEqual(["c2"]);
    });

    it("cálculo: só a nota de quem avalia conta; o progresso conta só o atribuído", () => {
      const avaliacoes = [
        ...notas({ c1: [4, 0], c2: [3, 5], c3: [3, 1], c4: [2, 0] }),
      ];
      const sem = calcularEntrevista({
        roteiro: NIVEIS,
        compareceu: "S",
        avaliacoes,
      });
      expect(sem.parecer).toBe("INAPTO");
      const com = calcularEntrevista({
        roteiro: NIVEIS,
        compareceu: "S",
        avaliacoes,
        atribuicoes: atribuicoesDaBanca([ANA, DSEI], COMPS),
      });
      expect(com.competencias.map((c) => c.nota)).toEqual([4, 4, 3, 2]);
      expect(com.competencias.map((c) => c.quantidade)).toEqual([1, 2, 1, 1]);
      expect(com.parecer).toBe("APTO");
      expect(
        progressoDasNotas(
          { avaliacoes: notas({ c1: [4, 0], c2: [3] }) },
          [ANA, DSEI],
          COMPS,
        ),
      ).toEqual({ lancadas: 2, esperadas: 5 });
    });
  });

  describe("editais e erros", () => {
    it("marca os que já têm entrevistas e não acrescenta edital fora da lista", () => {
      const lista = editaisParaConduzir(
        [
          { id: "m2", edital: "105/2026", unidade: "DSEI Litoral Sul" },
          { id: "m1", edital: "100/2026", unidade: "CASAI Brasília" },
        ],
        [
          { edital_id: "m1", edital: "100/2026" },
          { edital_id: "m3", edital: "110/2026", unidade: "DSEI Porto Velho" },
          { edital_id: null, edital: "sem id" },
        ],
      );
      expect(lista.map((e) => [e.id, e.comEntrevistas])).toEqual([
        ["m2", false],
        ["m1", true],
      ]);
    });

    it("descreve a janela e o motivo de o edital aparecer", async () => {
      const { marcaDoEdital, textoDaJanela } =
        await import("../src/lib/entrevistas/conducao-de-entrevista.ts");
      const [liberado, fora, pendente, semCronograma] = editaisParaConduzir(
        [
          {
            id: "a",
            edital: "120/2026",
            na_janela: false,
            visivel_por: "liberado",
            liberado_ate: "2026-11-15",
            janela_inicio: "2026-12-01",
            janela_fim: "2026-12-20",
          },
          {
            id: "b",
            edital: "119/2026",
            na_janela: false,
            visivel_por: "admin",
          },
          {
            id: "c",
            edital: "118/2026",
            na_janela: false,
            visivel_por: "convocados",
            pendentes: 3,
          },
          {
            id: "d",
            edital: "117/2026",
            na_janela: true,
            visivel_por: "janela",
          },
        ],
        [],
      );
      expect(marcaDoEdital(liberado)).toBe("liberado até 15/11");
      expect(marcaDoEdital(fora)).toBe("fora da janela");
      expect(marcaDoEdital(pendente)).toBe("3 sem parecer");
      expect(marcaDoEdital(semCronograma)).toBe("");
      expect(textoDaJanela(liberado)).toBe(
        "janela da entrevista: 01/12 a 20/12",
      );
      expect(textoDaJanela(fora)).toBe("sem etapa de entrevista no cronograma");
    });

    it("traduz os códigos das RPCs", () => {
      expect(
        mensagemDoErroDaEntrevista({
          code: "22023",
          message: "Nota 7 fora da faixa",
        }),
      ).toBe("Dado inválido: Nota 7 fora da faixa.");
      expect(
        mensagemDoErroDaEntrevista({
          code: "42501",
          message: "Neste edital cada avaliador lança a própria nota",
        }),
      ).toMatch(/^Sem permissão: Neste edital/);
      expect(
        mensagemDoErroDaEntrevista({
          code: "23514",
          message: "Configure a entrevista do edital antes de convocar",
        }),
      ).toBe("Configure a entrevista do edital antes de convocar.");
      expect(mensagemDoErroDaEntrevista({ code: "PGRST202" })).toMatch(
        /publicada/,
      );
    });
  });

  describe("ajustes de 30/09: ordem dos editais e nome do cargo", () => {
    it("editais do mais novo para o mais antigo", async () => {
      const { editaisParaConduzir } =
        await import("../src/lib/entrevistas/conducao-de-entrevista.ts");
      const lista = editaisParaConduzir(
        [
          { id: "a", edital: "03/2025", unidade: "X" },
          { id: "b", edital: "06/2026", unidade: "Y" },
          { id: "c", edital: "110/2026", unidade: "Z" },
        ],
        [],
      );
      expect(lista.map((e) => e.edital)).toEqual([
        "110/2026",
        "06/2026",
        "03/2025",
      ]);
    });

    it("tira o resto da planilha do nome do cargo", async () => {
      const { nomeDoCargo } =
        await import("../src/lib/entrevistas/conducao-de-entrevista.ts");
      expect(
        nomeDoCargo(
          "Enfermeiro - DSEI Porto Velho em Excel (questionário NÍVEL SUPERIOR",
        ),
      ).toBe("Enfermeiro - DSEI Porto Velho");
      expect(nomeDoCargo("Analista Técnico de Saúde Indígena")).toBe(
        "Analista Técnico de Saúde Indígena",
      );
    });
  });

  describe("selo PcD", () => {
    it("só o sim da planilha conta como PcD", async () => {
      const { ehPcd } =
        await import("../src/lib/entrevistas/conducao-de-entrevista.ts");
      expect(["SIM", "Sim", " s ", "true", true, 1].map(ehPcd)).toEqual([
        true,
        true,
        true,
        true,
        true,
        true,
      ]);
      expect(
        ["NÃO", "Não", "nao", "N", "", null, undefined, false, 0].map(ehPcd),
      ).toEqual(Array(9).fill(false));
    });
  });

  describe("ficha com aspectos", async () => {
    const lib =
      await import("../src/lib/entrevistas/conducao-de-entrevista.ts");
    const ASPECTOS = [{ id: "s1" }, { id: "s2" }, { id: "s3" }];

    it("mapa por aspecto, ida e volta", () => {
      const mapa = lib.mapaDasAvaliacoes(
        [
          {
            competencia: "c1",
            avaliador: "a1",
            nota: 1.33,
            aspectos: [
              { aspecto: "s1", nota: 2 },
              { aspecto: "s2", nota: 1 },
              { aspecto: "s3", nota: 1 },
            ],
          },
        ],
        ASPECTOS,
      );
      expect(mapa).toEqual({
        "c1|a1|s1": "2",
        "c1|a1|s2": "1",
        "c1|a1|s3": "1",
      });
      expect(lib.avaliacoesDoMapa(mapa, ASPECTOS)).toEqual([
        {
          competencia: "c1",
          avaliador: "a1",
          aspectos: [
            { aspecto: "s1", nota: 2 },
            { aspecto: "s2", nota: 1 },
            { aspecto: "s3", nota: 1 },
          ],
        },
      ]);
    });

    it("alteradas: todos os aspectos, nulo ao apagar; incompleta fica de fora", () => {
      const original = { "c1|a1|s1": "2", "c1|a1|s2": "1", "c1|a1|s3": "1" };
      const atual = {
        "c1|a1|s1": "",
        "c1|a1|s2": "",
        "c1|a1|s3": "",
        "c1|a2|s1": "3",
        "c2|a1|s1": "4",
        "c2|a1|s2": "4",
        "c2|a1|s3": "5",
      };
      expect(lib.notasAlteradas(original, atual, ASPECTOS)).toEqual([
        { competencia: "c1", avaliador: "a1", aspectos: null },
        {
          competencia: "c2",
          avaliador: "a1",
          aspectos: [
            { aspecto: "s1", nota: 4 },
            { aspecto: "s2", nota: 4 },
            { aspecto: "s3", nota: 5 },
          ],
        },
      ]);
      expect(lib.aspectosIncompletos(atual, ASPECTOS)).toEqual([
        { competencia: "c1", avaliador: "a2" },
      ]);
    });

    it("média dos aspectos só com todos", () => {
      expect(
        lib.mediaDosAspectos(ASPECTOS, { s1: "2", s2: "2", s3: "3" }),
      ).toBeCloseTo(7 / 3);
      expect(lib.mediaDosAspectos(ASPECTOS, { s1: "2" })).toBeNull();
    });
  });
});

bloco("convocacao-da-entrevista", () => {
  describe("entrada externa da convocação", () => {
    it("descarta retratos e cálculos sem uma lista de vagas", () => {
      for (const retrato of [null, [], "lista", { vagas: {} }]) {
        expect(
          fonteDaConvocacao({
            lista_convocacao: { lista: { id: "l1" }, retrato },
          }).tipo,
        ).toBe("NENHUMA");
      }
      expect(fonteDaConvocacao(null, { vagas: "lista" }).tipo).toBe("NENHUMA");
      expect(
        fonteDaConvocacao({
          lista_convocacao: { lista: { id: 42 }, retrato: { vagas: [] } },
        }).tipo,
      ).toBe("NENHUMA");
    });
    it("usa o cálculo atual quando o retrato registrado não pode ser lido", () => {
      const calculo = { vagas: [] };
      expect(
        fonteDaConvocacao(
          { lista_convocacao: { lista: { id: "l1" }, retrato: { vagas: {} } } },
          calculo,
        ),
      ).toEqual({ tipo: "CALCULO", lista: null, resultado: calculo });
    });
    it("normaliza metadados sem interpretar texto como publicação", () => {
      const fonte = fonteDaConvocacao({
        lista_convocacao: {
          lista: {
            id: "l1",
            gerada_em: [],
            por: {},
            versao_regra: "3",
            publicada: "false",
            extra: "mantido",
          },
          retrato: { vagas: [] },
        },
      });
      expect(fonte.lista).toMatchObject({
        id: "l1",
        gerada_em: null,
        por: null,
        versao_regra: 3,
        publicada: false,
        extra: "mantido",
      });
    });
    it("descarta vagas, linhas e modalidades com estrutura inválida", () => {
      expect(vagasDaLista({ vagas: {} })).toEqual([]);
      const vagas = vagasDaLista({
        vagas: [
          null,
          "vaga",
          {
            codigo: "V1",
            geral: [
              null,
              "candidato",
              { analise_id: {}, nome: "Inválido" },
              { analise_id: "a1", nome: "Ana", modalidades: ["AC", null, {}] },
            ],
            listas: { PPIQ: {} },
            limite_convocacao: "dez",
          },
        ],
      });
      expect(vagas).toHaveLength(1);
      expect(vagas[0].candidatos).toEqual([
        {
          analiseId: "a1",
          nome: "Ana",
          posicao: null,
          nota: null,
          modalidades: ["AC"],
          situacao: "",
          lista: "",
        },
      ]);
      expect(vagas[0].limite).toBeNull();
    });
  });

  /*
  A convocação para a entrevista é a lista CONVOCACAO da Classificação: o
  retrato registrado (instantaneoDaLista) ou, sem lista, o resultado do motor.
  Nada de ranking, regra ou vagas próprios.
*/

  const RETRATO = {
    schema: 1,
    tipo: "CONVOCACAO",
    vagas: [
      {
        chave: "V1",
        codigo: "V1",
        cargo: "Enfermeiro - DSEI Manaus",
        lotacao: "Polo Base Manaus",
        cabecalho: "VAGA V1 - Enfermeiro",
        total: 2,
        cadastro_reserva: true,
        origem_das_vagas: "QUADRO",
        limite_convocacao: { limite: 10, origem: "5 × 2 vaga(s)" },
        geral: [
          {
            posicao: 1,
            analise_id: "a1",
            nome: "Ana",
            nota: 90,
            modalidades: ["AC"],
          },
          {
            posicao: 2,
            analise_id: "a2",
            nome: "Bia",
            nota: 80,
            modalidades: ["AC", "PPIQ"],
          },
        ],
        listas: {
          PPIQ: [
            {
              posicao: 1,
              analise_id: "a2",
              nome: "Bia",
              nota: 80,
              modalidades: ["PPIQ"],
            },
            {
              posicao: 2,
              analise_id: "a3",
              nome: "Caio",
              nota: 70,
              modalidades: ["PPIQ"],
            },
          ],
        },
        eliminados: [
          { analise_id: "a9", nome: "Zé", motivo: "FORA_DO_LIMITE" },
        ],
      },
      {
        chave: "V2",
        codigo: "V2",
        cargo: "Médico",
        // Sem linha no quadro de vagas do edital.
        total: null,
        origem_das_vagas: null,
        geral: [],
        listas: {},
        eliminados: [],
      },
    ],
  };

  const DADOS = {
    regra_classificacao: {
      versao: 3,
      convocacao: { multiplo_vagas: 5, posicao_max_cr: 10, excecoes: [] },
    },
    lista_convocacao: {
      lista: { id: "l1", versao_regra: 3, gerada_em: "2026-10-05T12:00:00Z" },
      retrato: RETRATO,
    },
    convocados: [
      {
        id: "e1",
        analise_id: "a1",
        vaga: "V1",
        candidato: "Ana",
        avaliacoes: [],
      },
      {
        id: "e8",
        analise_id: "a8",
        vaga: "V1",
        candidato: "Antigo",
        avaliacoes: [],
      },
      {
        id: "e7",
        analise_id: "a7",
        vaga: "V9",
        cargo: "Outro",
        candidato: "Sem vaga",
      },
    ],
  };

  describe("a fonte da convocação", () => {
    it("a lista registrada na Classificação vale; sem ela, o cálculo atual; sem nada, nenhuma", () => {
      expect(fonteDaConvocacao(DADOS).tipo).toBe("LISTA");
      expect(fonteDaConvocacao(DADOS).lista.id).toBe("l1");
      const calculada = { tipo: "CONVOCACAO", vagas: [] };
      expect(
        fonteDaConvocacao({ ...DADOS, lista_convocacao: null }, calculada),
      ).toMatchObject({ tipo: "CALCULO", resultado: calculada });
      expect(fonteDaConvocacao({ lista_convocacao: null }).tipo).toBe(
        "NENHUMA",
      );
    });
  });

  describe("as vagas da lista", () => {
    it("geral e depois quem só está na lista da modalidade, sem repetir; eliminados fora", () => {
      const [v1, v2] = vagasDaLista(RETRATO);
      expect(v1.candidatos.map((c) => [c.analiseId, c.lista])).toEqual([
        ["a1", ""],
        ["a2", ""],
        ["a3", "PPIQ"],
      ]);
      expect(v1).toMatchObject({
        vaga: "V1",
        total: 2,
        cadastroReserva: true,
        origemDasVagas: "QUADRO",
        limite: 10,
        origemDoLimite: "5 × 2 vaga(s)",
      });
      expect(v2.candidatos).toEqual([]);
      expect(v2.total).toBeNull();
    });

    it("o resultado do motor (camelCase) entra igual ao retrato", () => {
      const motor = {
        vagas: [
          {
            chave: "V1",
            codigo: "V1",
            cargo: "Enfermeiro",
            total: 1,
            cadastroReserva: false,
            origemDasVagas: "CONVOCACAO",
            limiteConvocacao: { limite: 5, origem: "5 × 1 vaga(s)" },
            geral: [{ posicao: 1, analiseId: "a1", nome: "Ana" }],
            porModalidade: {
              PCD: [{ posicao: 1, analiseId: "a4", nome: "Duda" }],
            },
          },
        ],
      };
      const [v] = vagasDaLista(motor);
      expect(v.candidatos.map((c) => c.analiseId)).toEqual(["a1", "a4"]);
      expect(v.limite).toBe(5);
      expect(v.origemDasVagas).toBe("CONVOCACAO");
    });

    it("o retrato novo guarda as vagas e o limite que a Classificação contou", () => {
      const retrato = instantaneoDaLista(
        {
          tipo: "CONVOCACAO",
          casas: 2,
          dataCorte: null,
          vagas: [
            {
              chave: "V1",
              codigo: "V1",
              cargo: "Enfermeiro",
              lotacao: "",
              cabecalho: "VAGA V1",
              total: 2,
              cadastroReserva: false,
              origemDasVagas: "QUADRO",
              limiteConvocacao: { limite: 10, origem: "5 × 2 vaga(s)" },
              geral: [{ posicao: 1, analiseId: "a1", nome: "Ana", nota: 9 }],
              porModalidade: {},
              eliminados: [],
            },
          ],
          avisos: [],
          pendencias: [],
          totais: {},
        },
        { regra: {} },
      );
      expect(retrato.vagas[0]).toMatchObject({
        total: 2,
        cadastro_reserva: false,
        origem_das_vagas: "QUADRO",
        limite_convocacao: { limite: 10, origem: "5 × 2 vaga(s)" },
      });
      expect(vagasDaLista(retrato)[0].limite).toBe(10);
    });
  });

  describe("quem vai para a ficha", () => {
    const grupos = gruposDaConvocacao(RETRATO, DADOS.convocados);

    it("marca os já convocados; quem não está na lista fica em `fora` (na própria vaga ou numa nova)", () => {
      expect(grupos[0].candidatos.map((c) => c.convocado?.id ?? null)).toEqual([
        "e1",
        null,
        null,
      ]);
      expect(grupos[0].fora.map((c) => c.id)).toEqual(["e8"]);
      expect(grupos.at(-1)).toMatchObject({ vaga: "V9", candidatos: [] });
      expect(grupos.at(-1).fora.map((c) => c.id)).toEqual(["e7"]);
    });

    it("a convocar = os da lista ainda fora da ficha; o resumo conta", () => {
      expect(aConvocar(grupos)).toEqual(["a2", "a3"]);
      expect(resumoDaConvocacao(grupos)).toEqual({
        naLista: 3,
        naFicha: 1,
        aConvocar: 2,
        fora: 2,
      });
    });
  });

  describe("textos e avisos", () => {
    it("vagas, limite e origem", () => {
      const [v1, v2] = vagasDaLista(RETRATO);
      expect(textoDasVagas(v1)).toBe("2 vagas imediatas + cadastro reserva");
      expect(textoDasVagas({ total: 0 })).toBe("cadastro reserva");
      expect(textoDasVagas(v2)).toBe("sem quadro de vagas");
      expect(textoDoLimite(v1)).toBe("até a 10ª (5 × 2 vaga(s))");
      expect(textoDoLimite(v2)).toBe("");
      expect(origemDasVagas(v1)).toMatchObject({
        view: "nucleo",
        onde: "Editais",
      });
      expect(origemDasVagas({ origemDasVagas: "CONVOCACAO" }).view).toBe(
        "approved",
      );
      expect(origemDasVagas({ origemDasVagas: "REGRA" }).view).toBe(
        "classificacao",
      );
      // O botão da origem leva à tela: a view tem de ser uma aba do menu
      // ("aprovados" é o id da aba; a view é "approved").
      for (const origem of ["QUADRO", "CONVOCACAO", "REGRA"])
        expect(
          linkInterno({
            view: origemDasVagas({ origemDasVagas: origem }).view,
          }),
        ).not.toBeNull();
    });

    it("lista gerada antes de o retrato guardar as vagas: não diz que falta quadro", () => {
      const [antiga] = vagasDaLista({
        vagas: [{ codigo: "V1", cargo: "Enfermeiro", geral: [], listas: {} }],
      });
      expect(antiga.semVagasNaLista).toBe(true);
      expect(textoDasVagas(antiga)).toBe("");
      expect(origemDasVagas(antiga)).toMatchObject({
        rotulo: "não registrado nesta lista",
        view: "classificacao",
      });
      expect(vagasDaLista(RETRATO)[1].semVagasNaLista).toBe(false);
    });

    it("a regra da Classificação em uma linha, com as exceções", () => {
      expect(
        textoDaRegraDaClassificacao({
          multiplo_vagas: 5,
          posicao_max_cr: 10,
          incluir_empatados: true,
          excecoes: [
            {
              termos: ["Enfermeiro", "Técnico de Enfermagem"],
              multiplo_vagas: 10,
              posicao_max_cr: 20,
            },
          ],
        }),
      ).toBe(
        "5× as vagas imediatas · até a 10ª no cadastro reserva · empatados no limite entram · exceções: Enfermeiro, Técnico de Enfermagem (10× / 20ª)",
      );
      expect(textoDaRegraDaClassificacao({})).toBe("sem limite na regra");
      expect(textoDaRegraDaClassificacao(null)).toBe("");
    });

    it("avisa sem lista, regra mudada depois da lista e convocado fora da lista", () => {
      const semLista = avisosDaConvocacao(
        DADOS,
        { tipo: "CALCULO", lista: null },
        [],
      );
      expect(semLista.map((a) => a.codigo)).toEqual(["SEM_LISTA"]);
      expect(semLista[0].texto).toContain(
        "Lista ainda não gerada na Classificação",
      );
      const grupos = gruposDaConvocacao(RETRATO, DADOS.convocados);
      const mudou = avisosDaConvocacao(
        { ...DADOS, regra_classificacao: { versao: 4 } },
        fonteDaConvocacao(DADOS),
        grupos,
      );
      expect(mudou.map((a) => a.codigo)).toEqual([
        "REGRA_MUDOU",
        "FORA_DA_LISTA",
      ]);
      expect(mudou[0].texto).toContain("v3 → v4");
      expect(mudou[1].texto).toBe("2 convocados não estão na lista vigente.");
      expect(avisosDaConvocacao(DADOS, fonteDaConvocacao(DADOS), [])).toEqual(
        [],
      );
    });
  });
});

bloco("convocacao-mgi-e-saude-indigena", () => {
  /*
  A ordem do simulador de reserva de vagas do MGI e o modelo da Saúde Indígena
  (edital 91/2026, DSEI Alagoas e Sergipe), mais a prévia da ordem de chamada.
*/
  const MGI = normalizarModelo(modeloDeReferencia("mgi-simulador"));
  const SAUDE_INDIGENA = normalizarModelo(
    modeloDeReferencia("saude-indigena-91-2026"),
  );
  const SAUDE_INDIGENA_2026 = normalizarModelo(
    modeloDeReferencia("saude-indigena-2026"),
  );
  const SEM_TROCA = normalizarModelo(
    modeloDeReferencia("saude-indigena-2026-sem-troca"),
  );
  const CEBRASPE = normalizarModelo(modeloDeReferencia("cebraspe-lei-15142"));
  const RESERVA_UNICA = normalizarModelo(
    modeloDeReferencia("lei-15142-reserva-unica"),
  );

  const posicoesDe = (sequencia, id) =>
    sequencia.flatMap((categoria, indice) =>
      categoria === id ? [indice + 1] : [],
    );

  describe("ordem do simulador do MGI", () => {
    const candidato = (nome, modalidade, nota) => ({
      candidato_id: nome,
      nome,
      modalidade,
      nota,
      classificacao: 101 - nota,
      cargo: "ANALISTA",
      codigo_vaga: "VG-MGI",
      edital_id: "1",
      edital: "FGV",
      lista_ativa: true,
    });

    it("continua a série MGI no cadastro reserva quando há só 1 vaga imediata", () => {
      const { linhas, totalImediatas } = montarConvocacaoDaVaga({
        candidatos: [
          candidato("AC-1", "Ampla concorrência", 100),
          candidato("AC-2", "Ampla concorrência", 99),
          candidato("PP-1", "Pretos e pardos", 98),
          candidato("AC-3", "Ampla concorrência", 97),
          candidato("PCD-1", "PCD", 96),
          candidato("PP-2", "Pretos e pardos", 95),
          candidato("AC-4", "Ampla concorrência", 94),
          candidato("AC-5", "Ampla concorrência", 93),
        ],
        quadro: { ampla: 1 },
        modelo: MGI,
        proporcionalidade: true,
      });

      expect(totalImediatas).toBe(1);
      expect(linhas.map((linha) => linha.categoria)).toEqual([
        "ampla",
        "pretos_pardos",
        "ampla",
        "ampla",
        "pcd",
        "pretos_pardos",
        "ampla",
        "ampla",
      ]);
      expect(linhas.map((linha) => linha.imediata)).toEqual([
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ]);
    });

    it("aplica a série MGI também quando não há vaga imediata", () => {
      const { linhas, totalImediatas } = montarConvocacaoDaVaga({
        candidatos: [
          candidato("AC-1", "Ampla concorrência", 100),
          candidato("PP-1", "Pretos e pardos", 99),
          candidato("AC-2", "Ampla concorrência", 98),
          candidato("AC-3", "Ampla concorrência", 97),
          candidato("PCD-1", "PCD", 96),
          candidato("PP-2", "Pretos e pardos", 95),
        ],
        quadro: {},
        modelo: MGI,
        proporcionalidade: true,
      });

      expect(totalImediatas).toBe(0);
      expect(linhas.map((linha) => linha.categoria)).toEqual([
        "ampla",
        "pretos_pardos",
        "ampla",
        "ampla",
        "pcd",
        "pretos_pardos",
      ]);
      expect(linhas.every((linha) => !linha.imediata)).toBe(true);
    });

    it("segue a série MGI na reserva mesmo com os mínimos da FGV (2 racial, 5 PCD)", () => {
      const referencia = modeloDeReferencia("mgi-simulador");
      const FGV = normalizarModelo({
        ...referencia,
        categorias: referencia.categorias.map((categoria) =>
          categoria.id === "pcd"
            ? { ...categoria, minimo: 5 }
            : categoria.ampla
              ? categoria
              : { ...categoria, minimo: 2 },
        ),
      });
      const { linhas } = montarConvocacaoDaVaga({
        candidatos: [
          candidato("AC-1", "Ampla concorrência", 100),
          candidato("AC-2", "Ampla concorrência", 99),
          candidato("AC-3", "Ampla concorrência", 98),
          candidato("AC-4", "Ampla concorrência", 97),
          candidato("PP-1", "Pretos e pardos", 96),
          candidato("PCD-1", "PCD", 95),
          candidato("PP-2", "Pretos e pardos", 94),
        ],
        quadro: derivarQuadro(1, FGV),
        modelo: FGV,
        proporcionalidade: true,
      });

      expect(linhas.map((linha) => linha.candidato.nome)).toEqual([
        "AC-1",
        "PP-1",
        "AC-2",
        "AC-3",
        "PCD-1",
        "PP-2",
        "AC-4",
      ]);
    });

    it("nas imediatas respeita o quadro manual e na reserva segue a série", () => {
      const { linhas } = montarConvocacaoDaVaga({
        candidatos: [
          candidato("AC-1", "Ampla concorrência", 100),
          candidato("AC-2", "Ampla concorrência", 99),
          candidato("PP-1", "Pretos e pardos", 98),
          candidato("PP-2", "Pretos e pardos", 97),
        ],
        quadro: { pretos_pardos: 1 },
        modelo: MGI,
        proporcionalidade: true,
      });

      expect(linhas.map((linha) => linha.categoria)).toEqual([
        "pretos_pardos",
        "pretos_pardos",
        "ampla",
        "ampla",
      ]);
      expect(linhas[0].imediata).toBe(true);
    });

    /* A simulação de 100 vagas que o simulador publica (PcD 5, PN 25, PI 3, PQ 2). */
    it("reproduz posição por posição a simulação de 100 vagas", () => {
      const quadro = derivarQuadro(100, MGI);
      expect(quadro).toEqual({
        ampla: 65,
        pretos_pardos: 25,
        indigena: 3,
        quilombola: 2,
        pcd: 5,
      });
      const sequencia = sequenciaDeConvocacao(quadro, MGI);
      expect(posicoesDe(sequencia, "pcd")).toEqual([5, 21, 41, 61, 81]);
      expect(posicoesDe(sequencia, "pretos_pardos")).toEqual(
        Array.from({ length: 25 }, (_, k) => 2 + 4 * k),
      );
      // A 50ª é de pretos e pardos: a 2ª indígena fica com a livre anterior.
      expect(posicoesDe(sequencia, "indigena")).toEqual([17, 49, 84]);
      expect(posicoesDe(sequencia, "quilombola")).toEqual([25, 75]);
    });

    /* O passo vem do percentual, e não do total: 45 vagas continuam de 4 em 4. */
    it("numa vaga de 45, o 5º é PCD e pretos e pardos seguem de 4 em 4", () => {
      const quadro = {
        ampla: 30,
        pretos_pardos: 11,
        indigena: 1,
        quilombola: 1,
        pcd: 2,
      };
      const sequencia = sequenciaDeConvocacao(quadro, MGI);
      expect(sequencia).toHaveLength(45);
      expect(posicoesDe(sequencia, "pcd")).toEqual([5, 21]);
      expect(posicoesDe(sequencia, "pretos_pardos")).toEqual([
        2, 6, 10, 14, 18, 22, 26, 30, 34, 38, 42,
      ]);
      expect(posicoesDe(sequencia, "indigena")).toEqual([17]);
      expect(posicoesDe(sequencia, "quilombola")).toEqual([25]);
    });

    /*
    Em qualquer total, a 1ª PCD é a 5ª (STF), a 1ª indígena a 17ª e a 1ª
    quilombola a 25ª — quando o total chega a ter vaga para elas.
  */
    it("a 1ª PCD é sempre a 5ª, a 1ª indígena a 17ª e a 1ª quilombola a 25ª", () => {
      for (const modelo of [
        MGI,
        SAUDE_INDIGENA,
        SAUDE_INDIGENA_2026,
        SEM_TROCA,
        CEBRASPE,
      ])
        for (let total = 1; total <= 300; total += 1) {
          const quadro = derivarQuadro(total, modelo);
          const sequencia = sequenciaDeConvocacao(quadro, modelo);
          const primeira = (id) => posicoesDe(sequencia, id)[0] ?? null;
          expect(primeira("pcd")).toBe(quadro.pcd ? 5 : null);
          expect(primeira("indigena")).toBe(quadro.indigena ? 17 : null);
          expect(primeira("quilombola")).toBe(quadro.quilombola ? 25 : null);
          if (total < 17) expect(quadro.indigena).toBe(0);
          if (total < 25) expect(quadro.quilombola).toBe(0);
        }
    });

    /* Posição calculada além do total vai para a última livre. */
    it("cota que passaria do total fica na última posição livre", () => {
      const sequencia = sequenciaDeConvocacao({ ampla: 3, pcd: 1 }, MGI);
      expect(sequencia).toEqual(["ampla", "ampla", "ampla", "pcd"]);
    });

    it("trocar para a ordem do MGI dá à PCD a série 5ª, 21ª, de 20 em 20", () => {
      const antigo = normalizarModelo(LEI_15142_ESPALHADA);
      const pcd = comDistribuicao(antigo, "serie_mgi").categorias.find(
        (categoria) => categoria.id === "pcd",
      );
      expect(pcd.posicoes).toEqual([5, 21]);
      expect(pcd.intervalo).toBe(20);
      // Posições já informadas não são trocadas, e as outras cotas não mudam.
      const pp = comDistribuicao(antigo, "serie_mgi").categorias.find(
        (categoria) => categoria.id === "pretos_pardos",
      );
      expect(pp.posicoes).toEqual([]);
      expect(
        comDistribuicao(antigo, "proporcional").categorias.find(
          (categoria) => categoria.id === "pcd",
        ).posicoes,
      ).toEqual([]);
    });
  });

  describe("modelo da Saúde Indígena (91/2026)", () => {
    const categoria = (id) =>
      SAUDE_INDIGENA.categorias.find((item) => item.id === id);

    it("segue as cascatas do edital: PCD vazia vai para os indígenas", () => {
      expect(categoria("pcd").cascata).toEqual(["indigena"]); // 4.1.1
      expect(categoria("quilombola").cascata).toEqual([
        "indigena",
        "pretos_pardos",
      ]); // 5.2.1 e 5.2.3
      expect(categoria("indigena").cascata).toEqual([
        "quilombola",
        "pretos_pardos",
      ]); // 5.2.2 e 5.2.3
      expect(categoria("pretos_pardos").cascata).toEqual([]); // 5.2.4
    });

    it("PCD arredonda para cima até 20%, e cota racial só com 2 vagas ou mais", () => {
      expect(derivarQuadro(1, SAUDE_INDIGENA)).toMatchObject({
        ampla: 1,
        pretos_pardos: 0,
        pcd: 0,
      });
      // 5.3: com 2 vagas a reserva vale (25% de 2 = 0,5 sobe para 1).
      expect(derivarQuadro(2, SAUDE_INDIGENA).pretos_pardos).toBe(1);
      // 4.2: 5% de 4 subiria para 1, mas 20% de 4 é 0,8 — o limite corta.
      expect(derivarQuadro(4, SAUDE_INDIGENA).pcd).toBe(0);
      expect(derivarQuadro(5, SAUDE_INDIGENA).pcd).toBe(1);
    });

    /* 5.13: PCD soma com outra cota. */
    it("quem declara PCD e indígena guarda as duas reservas", () => {
      expect(SAUDE_INDIGENA.cotaMultipla).toBe("acumula_com_acumulavel");
      expect(categoria("pcd").acumulavel).toBe(true);
    });

    it("a PCD sem candidato vai para o próximo indígena, e não para a ampla", () => {
      const candidato = (nome, modalidade, nota) => ({
        candidato_id: nome,
        nome,
        modalidade,
        nota,
        cargo: "ENFERMEIRO",
        codigo_vaga: "VG-1",
        lista_ativa: true,
      });
      const { linhas } = montarConvocacaoDaVaga({
        candidatos: [
          candidato("ANA", "Ampla concorrência", 90),
          candidato("BIA", "Pretos e pardos", 85),
          candidato("CAU", "Ampla concorrência", 80),
          candidato("DUDA", "Ampla concorrência", 75),
          candidato("EDU", "Indígena", 60),
        ],
        quadro: { ampla: 3, pretos_pardos: 1, pcd: 1 },
        modelo: SAUDE_INDIGENA,
        proporcionalidade: true,
      });
      const quinta = linhas.find((linha) => linha.posicao === 5);
      expect(quinta?.candidato.nome).toBe("EDU");
    });
  });

  /*
  Editais 108/2026 (Alto Rio Negro), 112/2026 (Alto Rio Purus) e 117/2026
  (Xingu): a reserva é a mesma nos três. Difere do 91/2026 na PCD vazia (4.1.1)
  e em quem declara duas cotas (5.13).
*/
  describe("modelo da Saúde Indígena (108, 112 e 117/2026)", () => {
    const categoria = (id) =>
      SAUDE_INDIGENA_2026.categorias.find((item) => item.id === id);
    const candidato = (nome, modalidade, nota) => ({
      candidato_id: nome,
      nome,
      modalidade,
      nota,
      cargo: "ENFERMEIRO",
      codigo_vaga: "VG-1",
      lista_ativa: true,
    });

    it("segue as cascatas do edital: PCD vazia vai para a ampla", () => {
      expect(categoria("pcd").cascata).toEqual([]); // 4.1.1
      expect(categoria("quilombola").cascata).toEqual([
        "indigena",
        "pretos_pardos",
      ]); // 5.2.1, 5.2.3 e 5.2.5
      expect(categoria("indigena").cascata).toEqual([
        "quilombola",
        "pretos_pardos",
      ]); // 5.2.2, 5.2.3 e 5.2.5
      expect(categoria("pretos_pardos").cascata).toEqual([]); // 5.2.4
    });

    it("quem declara duas cotas é classificado na de maior percentual", () => {
      expect(SAUDE_INDIGENA_2026.cotaMultipla).toBe("maior_percentual"); // 5.13.1
      expect(categoria("pcd").acumulavel).toBe(false);
    });

    it("reserva só com 2 vagas ou mais, e PCD até 20%", () => {
      expect(derivarQuadro(1, SAUDE_INDIGENA_2026)).toMatchObject({
        ampla: 1,
        pretos_pardos: 0,
        pcd: 0,
      }); // 5.3
      expect(derivarQuadro(2, SAUDE_INDIGENA_2026).pretos_pardos).toBe(1);
      expect(derivarQuadro(4, SAUDE_INDIGENA_2026).pcd).toBe(0); // 4.2
      expect(derivarQuadro(5, SAUDE_INDIGENA_2026).pcd).toBe(1);
    });

    it("a PCD sem candidato vai para o próximo da ampla, e não para o indígena", () => {
      const { linhas } = montarConvocacaoDaVaga({
        candidatos: [
          candidato("ANA", "Ampla concorrência", 90),
          candidato("BIA", "Pretos e pardos", 85),
          candidato("CAU", "Ampla concorrência", 80),
          candidato("DUDA", "Ampla concorrência", 75),
          candidato("EDU", "Indígena", 60),
          candidato("FABI", "Ampla concorrência", 55),
        ],
        quadro: { ampla: 3, pretos_pardos: 1, pcd: 1 },
        modelo: SAUDE_INDIGENA_2026,
        proporcionalidade: true,
      });
      const quinta = linhas.find((linha) => linha.posicao === 5);
      // EDU (60) tem nota maior que FABI (55): a vaga vai para a ampla, pela nota.
      expect(quinta?.candidato.nome).toBe("EDU");
      expect(quinta?.categoria).toBe("ampla");
    });
  });

  describe("prévia da ordem de chamada", () => {
    it("diz onde entra a 1ª vaga de cada cota", () => {
      const previa = previaDaConvocacao(45, MGI);
      expect(previa.vagas).toBe(45);
      expect(previa.posicoes[4]).toMatchObject({
        posicao: 5,
        sigla: "PCD",
        reserva: true,
      });
      const primeira = Object.fromEntries(
        previa.primeiras.map((item) => [item.sigla, item.posicao]),
      );
      expect(primeira).toEqual({ PP: 2, IND: 17, QUI: 25, PCD: 5 });
    });

    it("cota abaixo do mínimo aparece sem posição", () => {
      const previa = previaDaConvocacao(1, SAUDE_INDIGENA);
      expect(previa.posicoes).toHaveLength(1);
      expect(previa.primeiras.every((item) => item.posicao === null)).toBe(
        true,
      );
    });

    it("resume as regras da cota numa frase", () => {
      const pcd = SAUDE_INDIGENA.categorias.find((item) => item.id === "pcd");
      expect(resumoDasRegrasDaCategoria(pcd)).toBe(
        "Arredonda sempre para cima · no máximo 20% das vagas · só com 2 vagas ou mais · posições 5ª, 21ª e depois de 20 em 20",
      );
      const pp = SAUDE_INDIGENA.categorias.find(
        (item) => item.id === "pretos_pardos",
      );
      expect(resumoDasRegrasDaCategoria(pp)).toBe(
        "Fração de 0,5 sobe · sem limite máximo · só com 2 vagas ou mais",
      );
    });
  });

  /* A leitura dos 109 editais da AgSUS (02/10/2026): os modelos que eles pedem. */
  describe("modelos lidos dos editais", () => {
    const categoria = (modelo, id) =>
      modelo.categorias.find((item) => item.id === id);

    /* 34 e 39 a 70/2026: a reserva vazia vai direto para a ampla (5.10). */
    it("sem troca entre cotas: nenhuma cascata, reserva só com 2 vagas", () => {
      for (const id of ["pretos_pardos", "indigena", "quilombola", "pcd"])
        expect(categoria(SEM_TROCA, id).cascata).toEqual([]);
      expect(SEM_TROCA.cotaMultipla).toBe("maior_percentual");
      expect(derivarQuadro(1, SEM_TROCA).pretos_pardos).toBe(0);
      expect(derivarQuadro(2, SEM_TROCA).pretos_pardos).toBe(1);
      expect(derivarQuadro(4, SEM_TROCA).pcd).toBe(0);
    });

    /* 96/2025, 04/2026, 30/2026 e 93/2026: a fração de 0,5 sobe também na PCD. */
    it("padrão Cebraspe: PCD pela regra do 0,5, sem mínimo nem limite", () => {
      expect(derivarQuadro(9, CEBRASPE).pcd).toBe(0); // 0,45 desce
      expect(derivarQuadro(10, CEBRASPE).pcd).toBe(1); // 0,5 sobe
      expect(derivarQuadro(2, CEBRASPE).pretos_pardos).toBe(1);
      expect(categoria(CEBRASPE, "quilombola").cascata).toEqual([
        "indigena",
        "pretos_pardos",
      ]);
      expect(categoria(CEBRASPE, "pcd").cascata).toEqual([]);
    });

    /* Editais DSEI de 2025: 30% numa lista só; PCD sobe sempre, com 2 vagas ou mais. */
    it("reserva única: 30% numa lista e PCD arredondando para cima", () => {
      expect(derivarQuadro(1, RESERVA_UNICA)).toMatchObject({
        ampla: 1,
        ppiq: 0,
        pcd: 0,
      }); // 4.2 e 5.3
      expect(derivarQuadro(2, RESERVA_UNICA)).toMatchObject({
        ampla: 0,
        ppiq: 1,
        pcd: 1,
      }); // 5% de 2 = 0,1 sobe para 1; 30% de 2 = 0,6 sobe para 1
      expect(derivarQuadro(10, RESERVA_UNICA)).toMatchObject({
        ampla: 6,
        ppiq: 3,
        pcd: 1,
      });
      const sequencia = sequenciaDeConvocacao(
        derivarQuadro(10, RESERVA_UNICA),
        RESERVA_UNICA,
      );
      expect(posicoesDe(sequencia, "pcd")).toEqual([5]);
    });

    it("o catálogo tem um modelo para cada regra encontrada", () => {
      expect(
        [
          "mgi-simulador",
          "saude-indigena-2026",
          "saude-indigena-91-2026",
          "saude-indigena-2026-sem-troca",
          "cebraspe-lei-15142",
          "portaria-5801-trans",
          "lei-15142-reserva-unica",
          "etnico-racial-posicoes",
        ].every((id) => modeloDeReferencia(id)),
      ).toBe(true);
    });
  });
});

bloco("dados-da-conducao", () => {
  describe("dados externos de Conduzir entrevistas", () => {
    it("preserva os campos antigos do roteiro e os retratos da Classificação", () => {
      const roteiro = {
        id: "r1",
        nome: "Roteiro",
        competencias: [{ id: "c1", nome: "Escuta", minimo: 2 }],
        convocacao_padrao: { multiplo_imediatas: 5, excecoes: [] },
        desempate: ["critério antigo"],
        renomeacoes: [{ de: null, para: "Novo nome" }],
      };
      expect(roteirosDaConducao([roteiro])).toEqual([roteiro]);
      const retrato = {
        vagas: [{ chave: "V1", linhas: [{ analise_id: "a1" }] }],
      };
      const resultado = dadosDoEditalDaConducao({
        edital: { id: "e1" },
        lista_convocacao: { lista: { id: "l1" }, retrato },
        configuracao: { roteiro },
        avaliadores: [],
        convocados: [],
        versao: 3,
      });
      expect(resultado.lista_convocacao.retrato).toBe(retrato);
      expect(resultado.configuracao.roteiro).toBe(roteiro);
      expect(resultado.versao).toBe(3);
    });
    it("filtra roteiros incompatíveis antes de chegarem ao editor", () => {
      expect(
        roteirosDaConducao([
          null,
          7,
          { id: 3 },
          { id: "r1", competencias: {} },
          { id: "r2", niveis: [null] },
          { id: "r3", desempate: [4] },
          { id: "r4" },
        ]),
      ).toEqual([{ id: "r4" }]);
    });
    it("não interpreta texto como permissão e ignora membros e convocados inválidos", () => {
      const dados = dadosDoEditalDaConducao({
        edital: { id: "e1" },
        pode_editar: "true",
        admin_global: "false",
        avaliadores: [null, { id: "a1", competencias: {} }, { id: "a2" }],
        convocados: [
          4,
          { id: "c1", observacoes: [null] },
          {
            id: "c2",
            avaliacoes: [
              { competencia: "x1", aspectos: [{ aspecto: "p1", nota: 4 }] },
            ],
          },
        ],
      });
      expect(dados.pode_editar).toBe(false);
      expect(dados.admin_global).toBe(false);
      expect(dados.avaliadores.map((a) => a.id)).toEqual(["a2"]);
      expect(dados.convocados.map((c) => c.id)).toEqual(["c2"]);
    });
    it("recusa respostas sem identificador textual de edital", () => {
      for (const valor of [null, [], "edital", {}, { edital: { id: 7 } }])
        expect(dadosDoEditalDaConducao(valor)).toBeNull();
    });
    it("não aceita listas e identificadores malformados na agenda e convocação", () => {
      const dados = dadosDoEditalDaConducao({
        edital: { id: "e1" },
        lista_convocacao: { lista: { id: 7 } },
        avaliadores: {},
        convocados: "lista",
      });
      expect(dados.lista_convocacao.lista).toBeNull();
      expect(dados.avaliadores).toEqual([]);
      expect(dados.convocados).toEqual([]);
      expect(
        agendaDaConducao({
          itens: [null, { analise_id: {} }, { analise_id: "a1", banca: 1 }],
        }).itens,
      ).toEqual([{ analise_id: "a1", banca: 1 }]);
      expect(agendaDaConducao([])).toBeNull();
    });
    it("só usa códigos textuais de falha", () => {
      expect(codigoDaFalhaDaConducao({ code: "42501" })).toBe("42501");
      for (const erro of [null, "42501", { code: 42501 }, new Error("falha")])
        expect(codigoDaFalhaDaConducao(erro)).toBe("");
    });
  });
});

bloco("digitacao-de-notas", () => {
  /*
  O lançamento da ficha de notas como planilha (src/lib/entrevistas/digitacao-de-notas.ts):
  o que fazer com o que foi digitado numa célula e para onde o foco vai.
*/

  const ZERO_A_CINCO = [0, 1, 2, 3, 4, 5];

  describe("lerDigitacao", () => {
    it("num 0 a 5, um dígito da escala já é a nota completa (avança)", () => {
      expect(lerDigitacao("3", ZERO_A_CINCO)).toEqual({
        estado: "completa",
        texto: "3",
      });
      expect(lerDigitacao("0", ZERO_A_CINCO).estado).toBe("completa");
    });

    it("fora da escala é recusado", () => {
      expect(lerDigitacao("7", ZERO_A_CINCO).estado).toBe("recusada");
      expect(lerDigitacao("05", ZERO_A_CINCO).estado).toBe("recusada");
      expect(lerDigitacao("a", ZERO_A_CINCO).estado).toBe("recusada");
      expect(lerDigitacao("-1", ZERO_A_CINCO).estado).toBe("recusada");
    });

    it("vazio apaga", () => {
      expect(lerDigitacao("", ZERO_A_CINCO)).toEqual({
        estado: "vazia",
        texto: "",
      });
      expect(lerDigitacao("  ", ZERO_A_CINCO).estado).toBe("vazia");
    });

    it("o que ainda pode virar outra nota espera (0 a 10, meias notas)", () => {
      const zeroADez = Array.from({ length: 11 }, (_, i) => i);
      expect(lerDigitacao("1", zeroADez).estado).toBe("parcial");
      expect(lerDigitacao("10", zeroADez).estado).toBe("completa");
      expect(lerDigitacao("2", zeroADez).estado).toBe("completa");
      const meias = [0, 0.5, 1, 1.5, 2, 2.5, 3];
      expect(lerDigitacao("2", meias).estado).toBe("parcial");
      expect(lerDigitacao("2,", meias).estado).toBe("parcial");
      expect(lerDigitacao("2.5", meias)).toEqual({
        estado: "completa",
        texto: "2,5",
      });
      expect(lerDigitacao("3", meias).estado).toBe("completa");
      expect(lerDigitacao("2,7", meias).estado).toBe("recusada");
    });

    it("sem as notas da escala, aceita número e nunca avança sozinha", () => {
      expect(lerDigitacao("12", []).estado).toBe("parcial");
      expect(lerDigitacao("x", []).estado).toBe("recusada");
    });
  });

  describe("textoDaEscala", () => {
    it("inteiras seguidas viram faixa; poucas soltas, a lista", () => {
      expect(textoDaEscala(ZERO_A_CINCO)).toBe("0 a 5");
      expect(textoDaEscala([0, 2.5, 5])).toBe("0; 2,5; 5");
      expect(textoDaEscala([])).toBe("");
    });
  });

  describe("movimento na grade", () => {
    it("teclas → movimentos", () => {
      expect(movimentoDaTecla("ArrowRight")).toBe("direita");
      expect(movimentoDaTecla("ArrowUp")).toBe("cima");
      expect(movimentoDaTecla("Enter")).toBe("proxima");
      expect(movimentoDaTecla("Enter", true)).toBe("anterior");
      expect(movimentoDaTecla("a")).toBeNull();
    });

    it("próxima segue a leitura e passa à linha de baixo; fora da grade, null", () => {
      expect(moverNaGrade({ linha: 0, coluna: 2 }, "proxima", 4, 3)).toEqual({
        linha: 1,
        coluna: 0,
      });
      expect(moverNaGrade({ linha: 3, coluna: 2 }, "proxima", 4, 3)).toBeNull();
      expect(moverNaGrade({ linha: 1, coluna: 0 }, "anterior", 4, 3)).toEqual({
        linha: 0,
        coluna: 2,
      });
      expect(
        moverNaGrade({ linha: 0, coluna: 0 }, "anterior", 4, 3),
      ).toBeNull();
    });

    it("as setas param na borda", () => {
      expect(moverNaGrade({ linha: 0, coluna: 2 }, "direita", 4, 3)).toBeNull();
      expect(moverNaGrade({ linha: 0, coluna: 1 }, "baixo", 4, 3)).toEqual({
        linha: 1,
        coluna: 1,
      });
      expect(moverNaGrade({ linha: 0, coluna: 1 }, "cima", 4, 3)).toBeNull();
      expect(moverNaGrade({ linha: 2, coluna: 1 }, "esquerda", 4, 3)).toEqual({
        linha: 2,
        coluna: 0,
      });
    });
  });
});

bloco("entrevistas-calculo-dourado", () => {
  /*
  Casos dourados do cálculo da entrevista, compartilhados com o Python
  (tests/python/test_entrevistas_calculo.py, monitora.entrevistas.calculo) e
  escritos pela regra do banco (private."FC_CALCULAR_ENTREVISTA"). Mudou a regra
  num lado sem mudar no outro, um dos testes cai.
*/
  const DADOS = JSON.parse(
    readFileSync("tests/fixtures/entrevistas/casos-de-calculo.json", "utf8"),
  );

  /*
  `caso.aspectos`: por competência, uma lista de notas por avaliador, na ordem
  dos aspectos. Nas listas, a posição é o avaliador (a1, a2…) e `null` é "sem
  nota dele" (avaliador por competência, `caso.atribuicoes`).
*/
  function avaliacoesPorAspecto(roteiro, aspectos) {
    return Object.entries(aspectos).flatMap(([competencia, porAvaliador]) =>
      porAvaliador.flatMap((notas, i) =>
        notas === null
          ? []
          : [
              {
                competencia,
                avaliador: `a${i + 1}`,
                aspectos: roteiro.aspectos.map((a, j) => ({
                  aspecto: a.id,
                  nota: notas[j],
                })),
              },
            ],
      ),
    );
  }

  function entrada(caso) {
    const roteiro = { ...DADOS.roteiros[caso.roteiro] };
    if ("nota_minima_total" in caso)
      roteiro.nota_minima_total = caso.nota_minima_total;
    const avaliacoes = caso.aspectos
      ? avaliacoesPorAspecto(roteiro, caso.aspectos)
      : Object.entries(caso.notas).flatMap(([competencia, notas]) =>
          notas.flatMap((nota, i) =>
            nota === null
              ? []
              : [{ competencia, avaliador: `a${i + 1}`, nota }],
          ),
        );
    return {
      roteiro,
      compareceu: caso.compareceu,
      avaliacoes,
      atribuicoes: caso.atribuicoes || null,
    };
  }

  describe("cálculo da entrevista: casos dourados JS × Python × banco", () => {
    it("tem casos suficientes", () => {
      expect(DADOS.casos.length).toBeGreaterThanOrEqual(10);
      expect(
        DADOS.casos.filter((c) => c.aspectos).length,
      ).toBeGreaterThanOrEqual(3);
      expect(
        DADOS.casos.filter((c) => c.atribuicoes).length,
      ).toBeGreaterThanOrEqual(3);
    });

    for (const caso of DADOS.casos) {
      it(caso.nome, () => {
        const r = calcularEntrevista(entrada(caso));
        expect(r.competencias.map((c) => c.nota)).toEqual(caso.esperado.notas);
        expect(r.total).toBe(caso.esperado.total);
        expect(r.parecer).toBe(caso.esperado.parecer);
      });
    }
  });
});

bloco("entrevistas-da-planilha", () => {
  const CABECALHO = [
    "DSEI",
    "Edital",
    "Link planilha entrevista",
    "Vaga",
    "Nome",
    "Modalidade de concorrência",
    "Cargo",
    "Código",
    "Nota total (0 a 20)",
    "Parecer",
    "Comparecimento",
    "Critério 1",
    "Nota 1",
    "Critério 2",
    "Nota 2",
  ];

  describe("aba Entrevistados -> linhas da carga", () => {
    it("normaliza cabeçalho sem acento, caixa e pontuação", () => {
      expect(normalizarCabecalho(" Modalidade de concorrência ")).toBe(
        "MODALIDADE DE CONCORRENCIA",
      );
      expect(normalizarCabecalho("Nota total (0 a 20)")).toBe(
        "NOTA TOTAL 0 A 20",
      );
      expect(normalizarCabecalho(null)).toBe("");
    });

    it("lê a linha no formato de sincronizar_entrevistas", () => {
      const linhas = linhasDaAbaEntrevistados([
        CABECALHO,
        [
          " DSEI Yanomami ",
          "39/2026 (sanitarista)",
          "https://exemplo/planilha",
          "Vaga 1234",
          "Maria  da Silva",
          "Ampla concorrência",
          "Enfermeiro",
          "cod-0987",
          "17,5",
          "Apto",
          "Sim",
          "Comunicação",
          "8,5",
          "Trabalho em equipe",
          "9",
        ],
      ]);
      expect(linhas).toEqual([
        {
          unidade: "DSEI Yanomami",
          edital: "39/2026 (sanitarista)",
          vaga: "1234",
          candidato: "Maria da Silva",
          codigo: "0987",
          modalidade: "Ampla concorrência",
          cargo: "Enfermeiro",
          nota: "17,5",
          parecer: "Apto",
          compareceu: "Sim",
          link: "https://exemplo/planilha",
          notas: [
            { criterio: "Comunicação", nota: "8,5" },
            { criterio: "Trabalho em equipe", nota: "9" },
          ],
        },
      ]);
    });

    it("aceita linha cortada pela API (células vazias do fim) e tira critério vazio", () => {
      const [linha] = linhasDaAbaEntrevistados([
        CABECALHO,
        [
          "DSEI X",
          "1/2026",
          "",
          "55",
          "João",
          "",
          "",
          "",
          "",
          "",
          "",
          "Critério A",
          "7",
        ],
      ]);
      expect(linha.parecer).toBe("");
      expect(linha.compareceu).toBe("");
      expect(linha.notas).toEqual([{ criterio: "Critério A", nota: "7" }]);
    });

    it("pula linha sem candidato, vaga ou edital", () => {
      const linhas = linhasDaAbaEntrevistados([
        CABECALHO,
        ["DSEI X", "1/2026", "", "55", ""],
        ["DSEI X", "1/2026", "", "sem número", "Ana"],
        ["DSEI X", "", "", "55", "Ana"],
        ["DSEI X", "1/2026", "", "55", "Ana"],
      ]);
      expect(linhas.map((l) => l.candidato)).toEqual(["Ana"]);
    });

    it("para os critérios no primeiro par que falta", () => {
      const [linha] = linhasDaAbaEntrevistados([
        [
          "DSEI",
          "EDITAL",
          "VAGA",
          "NOME",
          "CRITÉRIO 1",
          "NOTA 1",
          "CRITÉRIO 3",
          "NOTA 3",
        ],
        ["D", "1/2026", "9", "Ana", "C1", "5", "C3", "6"],
      ]);
      expect(linha.notas).toEqual([{ criterio: "C1", nota: "5" }]);
      expect(linha.codigo).toBe("");
    });

    it("recusa aba sem coluna obrigatória e devolve vazio sem dados", () => {
      expect(() =>
        linhasDaAbaEntrevistados([
          ["DSEI", "EDITAL", "NOME"],
          ["D", "1/2026", "Ana"],
        ]),
      ).toThrow(/vaga/);
      expect(linhasDaAbaEntrevistados([CABECALHO])).toEqual([]);
      expect(linhasDaAbaEntrevistados(undefined)).toEqual([]);
    });
  });

  describe("carga", () => {
    it("divide em lotes dentro do limite da RPC", () => {
      const lotes = emLotes(
        Array.from({ length: 1201 }, (_, i) => i),
        500,
      );
      expect(lotes.map((l) => l.length)).toEqual([500, 500, 201]);
    });

    it("gera identificador aceito pelo banco, no horário de Brasília", () => {
      const id = identificadorDaCarga(
        new Date("2026-09-30T12:00:05Z"),
        "a1b2-c3d4-e5f6",
      );
      expect(id).toBe("gh-20260930-090005-a1b2c3d4");
      expect(id).toMatch(/^[A-Za-z0-9_-]{8,80}$/);
    });

    it("a planilha de entrevistados está no catálogo", () => {
      expect(PLANILHAS.entrevistados.idGoogle).toMatch(/^[A-Za-z0-9_-]{10,}$/);
      expect(PLANILHAS.entrevistados.aba).toBe("Entrevistados");
      expect(PLANILHAS.entrevistados.area).toBe("saude-indigena");
    });
  });
});

bloco("entrevistas-do-painel", () => {
  const CRITERIOS = [
    "HABILIDADE TÉCNICA INTERCULTURAL (Conhecimentos sobre a saúde indígena)",
    "COMUNICAÇÃO (Clareza, objetividade)",
    "POSTURA",
  ];

  function entrevista(extra = {}) {
    return {
      id: "e1",
      edital_id: "m1",
      edital: "Edital 01/2026",
      edital_planilha: "01/2026",
      unidade: "DSEI Yanomami",
      vaga: "V1",
      cargo: "Enfermeiro",
      candidato: "Ana Clara",
      codigo: "C1",
      modalidade: "Ampla",
      nota: 12,
      parecer: "APTO",
      compareceu: "S",
      link: "https://docs.google.com/x",
      notas: [
        [0, 4],
        [1, 4],
        [2, 4],
      ],
      analise: {
        id: "a1",
        ligacao: "codigo",
        nota: 70,
        resultado: "Aprovado",
        etapa: "Final",
        responsavel: "Fulano",
        ativo: true,
      },
      ...extra,
    };
  }

  const PAYLOAD = {
    schema_version: 1,
    area: "saude-indigena",
    gerado_em: "2026-09-29T12:00:00Z",
    ultima_carga: {
      em: "2026-09-29T13:30:00Z",
      linhas: 4,
      ligadas_analise: 3,
      sem_analise: 1,
      sem_edital: 1,
    },
    criterios: CRITERIOS,
    entrevistas: [
      entrevista(),
      entrevista({
        id: "e2",
        candidato: "Bruno Érico",
        codigo: "C2",
        nota: 18,
        notas: [
          [0, 5],
          [1, 5],
          [2, 5],
        ],
        unidade: "DSEI Xingu",
      }),
      entrevista({
        id: "e3",
        candidato: "Carla",
        codigo: null,
        vaga: "V2",
        nota: 4,
        parecer: "INAPTO",
        notas: [],
        analise: null,
        edital_id: null,
      }),
      entrevista({
        id: "e4",
        candidato: "Davi",
        codigo: "C4",
        vaga: "V2",
        nota: null,
        parecer: "qualquer",
        compareceu: "N",
        notas: [],
        modalidade: null,
      }),
    ],
    aprovados_sem_entrevista: [
      {
        analise_id: "a9",
        candidato: "Eva",
        codigo: "C9",
        vaga: "V1",
        cargo: "Enfermeiro",
        edital: "Edital 01/2026",
        unidade: "DSEI Yanomami",
        nota: 80,
        modalidade: "Ampla",
      },
      {
        analise_id: "a10",
        candidato: "Fábio",
        codigo: "C10",
        vaga: "V2",
        cargo: "Médico",
        edital: "Edital 01/2026",
        unidade: "DSEI Xingu",
        nota: 75,
        modalidade: "PcD",
      },
    ],
  };

  describe("rótulo curto do critério", () => {
    it("corta no primeiro ' (' e mantém o texto sem parênteses", () => {
      expect(rotuloCurtoDoCriterio(CRITERIOS[0])).toBe(
        "HABILIDADE TÉCNICA INTERCULTURAL",
      );
      expect(rotuloCurtoDoCriterio("POSTURA")).toBe("POSTURA");
      expect(rotuloCurtoDoCriterio(null)).toBe("");
    });
  });

  describe("normalização do payload", () => {
    const dados = normalizarPayload(PAYLOAD);

    it("resolve as notas pelos índices dos critérios", () => {
      const [primeira] = dados.entrevistas;
      expect(primeira.notas).toEqual([
        {
          indice: 0,
          criterio: CRITERIOS[0],
          curto: "HABILIDADE TÉCNICA INTERCULTURAL",
          nota: 4,
        },
        { indice: 1, criterio: CRITERIOS[1], curto: "COMUNICAÇÃO", nota: 4 },
        { indice: 2, criterio: CRITERIOS[2], curto: "POSTURA", nota: 4 },
      ]);
      expect(primeira.somaDasNotas).toBe(12);
      expect(primeira.divergente).toBe(false);
    });

    it("marca divergência, sem edital, parecer desconhecido e ultima carga", () => {
      const [, segunda, terceira, quarta] = dados.entrevistas;
      expect(segunda.divergente).toBe(true); // 18 x 15
      expect(terceira.semEdital).toBe(true);
      expect(terceira.divergente).toBe(false); // sem notas
      // Parecer desconhecido vira SEM_PARECER no banco; quem faltou tem situação própria.
      expect(quarta.parecerDoBanco).toBe("SEM_PARECER");
      expect(quarta.parecer).toBe("FALTOU");
      expect(dados.ultimaCarga.linhas).toBe(4);
      expect(dados.aprovadosSemEntrevista).toHaveLength(2);
    });

    it("aguenta payload vazio", () => {
      const vazio = normalizarPayload(null);
      expect(vazio.entrevistas).toEqual([]);
      expect(vazio.criterios).toEqual([]);
      expect(vazio.ultimaCarga).toBeNull();
    });

    it("lê objetos externos sem supor o formato das listas ou da análise", () => {
      for (const invalido of [null, 7, "texto", [], true]) {
        expect(normalizarPayload(invalido).entrevistas).toEqual([]);
      }
      const dados = normalizarPayload({
        criterios: ["Postura"],
        entrevistas: [
          null,
          7,
          {
            id: "e1",
            candidato: "Ana",
            analise: "inválida",
            notas: [null, [0, "3"], [9, 2], [0, "NaN"]],
          },
        ],
      });
      expect(dados.entrevistas).toHaveLength(1);
      expect(dados.entrevistas[0].notas).toEqual([
        { indice: 0, criterio: "Postura", curto: "Postura", nota: 3 },
      ]);
      expect(dados.entrevistas[0].analise.nota).toBeNull();
    });

    it("normaliza a agenda externa e descarta entradas que não são objetos", () => {
      expect(normalizarAgendaDoPainel(null)).toEqual([]);
      expect(normalizarAgendaDoPainel({ itens: "inválido" })).toEqual([]);
      const [agenda] = normalizarAgendaDoPainel({
        itens: [
          null,
          7,
          [],
          { nome: "Ana", vaga: 7, inicio: "09:00", banca: "2" },
        ],
      });
      expect(agenda).toEqual({
        analise_id: null,
        nome: "Ana",
        vaga: null,
        cargo: null,
        data: null,
        inicio: "09:00",
        banca: 2,
      });
    });

    it("tolera diferença de até 0,05 na soma", () => {
      expect(notaDivergente(12.04, [{ nota: 4 }, { nota: 8 }])).toBe(false);
      expect(notaDivergente(12.06, [{ nota: 4 }, { nota: 8 }])).toBe(true);
      expect(notaDivergente(12, [])).toBe(false);
      expect(notaDivergente(null, [{ nota: 1 }])).toBe(false);
    });
  });

  describe("filtros", () => {
    const { entrevistas, aprovadosSemEntrevista } = normalizarPayload(PAYLOAD);
    const filtrar = (f) =>
      filtrarEntrevistas(entrevistas, { ...FILTROS_VAZIOS, ...f }).map(
        (e) => e.id,
      );

    it("busca por nome (sem acento) e código", () => {
      expect(filtrar({ busca: "erico" })).toEqual(["e2"]);
      expect(filtrar({ busca: "c4" })).toEqual(["e4"]);
    });

    it("parecer, comparecimento, modalidade e ligação", () => {
      expect(filtrar({ parecer: "INAPTO" })).toEqual(["e3"]);
      expect(filtrar({ comparecimento: "N" })).toEqual(["e4"]);
      expect(filtrar({ comparecimento: "NI" })).toEqual([]);
      expect(filtrar({ ligacao: "sem_analise" })).toEqual(["e3"]);
      expect(filtrar({ ligacao: "sem_edital" })).toEqual(["e3"]);
      expect(filtrar({ ligacao: "divergente" })).toEqual(["e2"]);
      expect(filtrar({ ligacao: "ligado" })).toEqual(["e1", "e2", "e4"]);
      expect(filtrar({ unidade: "DSEI Xingu" })).toEqual(["e2"]);
    });

    it("os aprovados sem entrevista seguem só os filtros que valem para eles", () => {
      const f = { ...FILTROS_VAZIOS, unidade: "DSEI Xingu", parecer: "APTO" };
      expect(
        filtrarAprovadosSemEntrevista(aprovadosSemEntrevista, f).map(
          (a) => a.candidato,
        ),
      ).toEqual(["Fábio"]);
    });

    it("opções distintas e ordenadas", () => {
      const opcoes = opcoesDosFiltros(entrevistas);
      expect(opcoes.unidades.map((o) => o.valor)).toEqual([
        "DSEI Xingu",
        "DSEI Yanomami",
      ]);
      expect(opcoes.modalidades.map((o) => o.valor)).toEqual(["Ampla"]);
      expect(opcoes.comparecimentos.map((o) => o.valor)).toEqual([
        "S",
        "N",
        "NI",
      ]);
    });
  });

  describe("KPIs e gráficos", () => {
    const { entrevistas, criterios, aprovadosSemEntrevista } =
      normalizarPayload(PAYLOAD);

    it("calcula os indicadores (média só de quem compareceu)", () => {
      const k = calcularIndicadores(entrevistas, aprovadosSemEntrevista);
      expect(k).toEqual({
        vagas: 2,
        candidatos: 4,
        compareceram: 3,
        aptos: 2,
        inaptos: 1,
        faltaram: 1,
        media: (12 + 18 + 4) / 3,
        semEntrevista: 2,
      });
      expect(formatarNota(k.media)).toBe("11,33");
      expect(formatarNota(null)).toBe("—");
      expect(calcularIndicadores([]).media).toBeNull();
    });

    it("faixas de nota entre quem compareceu (20 entra na última)", () => {
      const lista = normalizarPayload({
        entrevistas: [
          { id: "a", candidato: "a", nota: 0, compareceu: "S" },
          { id: "b", candidato: "b", nota: 5, compareceu: "S" },
          { id: "c", candidato: "c", nota: 20, compareceu: "S" },
          { id: "d", candidato: "d", nota: 14.99, compareceu: "S" },
          { id: "e", candidato: "e", nota: 10, compareceu: "N" },
        ],
      }).entrevistas;
      expect(faixasDeNota(lista).map((f) => f.valor)).toEqual([1, 1, 1, 1]);
    });

    it("contagens, média por critério e top unidades", () => {
      // Apto, Inapto, Faltou, Sem parecer: quem faltou não entra em Inapto.
      expect(contagemPorParecer(entrevistas).map((c) => c.valor)).toEqual([
        2, 1, 1, 0,
      ]);
      expect(
        contagemPorComparecimento(entrevistas).map((c) => c.valor),
      ).toEqual([3, 1, 0]);
      const medias = mediaPorCriterio(entrevistas, criterios);
      expect(medias.map((m) => [m.rotulo, m.media])).toEqual([
        ["HABILIDADE TÉCNICA INTERCULTURAL", 4.5],
        ["COMUNICAÇÃO", 4.5],
        ["POSTURA", 4.5],
      ]);
      expect(topUnidades(entrevistas, 1)).toEqual([
        { rotulo: "DSEI Yanomami", valor: 3 },
      ]);
    });
  });

  describe("pendências, datas e exportação", () => {
    const { entrevistas, aprovadosSemEntrevista, ultimaCarga } =
      normalizarPayload(PAYLOAD);

    it("conta as pendências (ligação e andamento)", () => {
      const p = pendenciasDasEntrevistas(entrevistas, aprovadosSemEntrevista);
      expect(Object.fromEntries(p.map((x) => [x.chave, x.valor]))).toEqual({
        sem_entrevista: 2,
        sem_analise: 1,
        sem_edital: 1,
        divergente: 1,
        sem_comparecimento: 0,
        sem_nota: 0,
        sem_parecer: 0,
      });
    });

    it("agrupa os aprovados sem entrevista por edital e vaga", () => {
      const grupos = agruparAprovadosSemEntrevista(aprovadosSemEntrevista);
      expect(grupos.map((g) => [g.vaga, g.candidatos.length])).toEqual([
        ["V1", 1],
        ["V2", 1],
      ]);
    });

    it("formata a última carga", () => {
      expect(dataHoraBR("2026-09-29T10:30:00")).toBe("29/09/2026 10:30");
      expect(dataHoraBR("x")).toBe("");
    });

    it("a tabela da exportação: notas como número, texto como veio", () => {
      const perigosa = normalizarPayload({
        entrevistas: [{ id: "z", candidato: "=HYPERLINK(1)", nota: 10.5 }],
      }).entrevistas;
      const { colunas, linhas } = tabelaDasEntrevistas(perigosa);
      expect(colunas.slice(0, 2)).toEqual(["Candidato", "Código"]);
      const linha = linhas[0];
      expect(linha[0]).toBe("=HYPERLINK(1)");
      expect(linha[colunas.indexOf("Nota da entrevista")]).toBe(10.5);
      expect(linha[colunas.indexOf("Resultado da análise")]).toBe(
        "Sem análise",
      );
    });
  });

  describe("registro da aba", async () => {
    const { ABAS_DO_MENU } =
      await import("../src/lib/navegacao/menu-lateral.ts");
    const { RESOURCES } =
      await import("../src/lib/acessos/permissoes-recursos.ts");
    const { canViewEntrevistas, paginasPermitidas } =
      await import("../src/lib/acessos/access-roles.ts");
    const { NOMES_DE_ICONES } = await import("../src/modules/icones.ts");

    it("Painel de entrevistas fica em Acompanhar (depois do Painel de recursos); Entrevistas, no processo, entre Recursos e Classificação, como beta", () => {
      const ids = ABAS_DO_MENU.map((aba) => aba.id);
      expect(ids.indexOf("entrevistas")).toBe(ids.indexOf("recursos") + 1);
      expect(ids.indexOf("conduzir-entrevistas")).toBe(
        ids.indexOf("analisar-recursos") + 1,
      );
      expect(ids.indexOf("classificacao")).toBe(
        ids.indexOf("conduzir-entrevistas") + 1,
      );
      expect(
        ABAS_DO_MENU.find((aba) => aba.id === "conduzir-entrevistas"),
      ).toMatchObject({
        rotulo: "Entrevistas",
        view: "conduzir-entrevistas",
        recurso: "entrevistas",
        icone: "clipboard-pen-line",
        // 11 e 4 até o Mapa entrar na ordem 2 (20261118160000).
        ordem: 12,
        beta: true,
      });
      expect(NOMES_DE_ICONES).toContain("clipboard-pen-line");
      expect(ids.indexOf("aprovados")).toBe(ids.indexOf("classificacao") + 1);
      expect(
        ABAS_DO_MENU.find((aba) => aba.id === "entrevistas"),
      ).toMatchObject({
        rotulo: "Painel de entrevistas",
        view: "entrevistas",
        recurso: "entrevistas",
        icone: "messages-square",
        ordem: 5,
        beta: true,
      });
      expect(ABAS_DO_MENU.find((aba) => aba.id === "recursos").ordem).toBe(4);
      expect(NOMES_DE_ICONES).toContain("messages-square");
      expect(RESOURCES).toContainEqual(["entrevistas", "Entrevistas"]);
    });

    it("leitor vê; sem a chave na matriz, a aba some", () => {
      const perfil = (nivel) => ({
        perfil: "usuario",
        permissoes: { entrevistas: nivel },
      });
      expect(canViewEntrevistas(perfil("leitor"))).toBe(true);
      expect(canViewEntrevistas(perfil("sem_acesso"))).toBe(false);
      expect(canViewEntrevistas({ perfil: "admin", permissoes: {} })).toBe(
        false,
      );
      expect(paginasPermitidas(perfil("leitor")).entrevistas).toBe(true);
    });
  });

  describe("cópia guardada", async () => {
    const { PAINEL_DE_ENTREVISTAS, payloadMudou } =
      await import("../src/lib/entrevistas/entrevistas-do-painel.ts");

    it("chave por área, esquema 1 e payload com a lista", () => {
      expect(PAINEL_DE_ENTREVISTAS.chave({ area: "sede" })).toBe(
        "entrevistas:sede",
      );
      expect(PAINEL_DE_ENTREVISTAS.esquema(PAYLOAD)).toBe(1);
      expect(PAINEL_DE_ENTREVISTAS.valido(PAYLOAD)).toBe(true);
      expect(PAINEL_DE_ENTREVISTAS.valido({})).toBe(false);
    });

    it("gerado_em não conta como mudança", () => {
      expect(
        payloadMudou(PAYLOAD, { ...PAYLOAD, gerado_em: "2030-01-01" }),
      ).toBe(false);
      expect(payloadMudou(PAYLOAD, { ...PAYLOAD, entrevistas: [] })).toBe(true);
    });
  });

  describe("de quando são os números (planilha × sistema)", () => {
    const agora = new Date("2026-10-22T18:00:00Z");
    it("só a planilha: a hora da última carga", () => {
      const dados = normalizarPayload(PAYLOAD);
      expect(textoDasFontesDoPainel(dados, agora)).toBe(
        "Planilha conferida em 29/09, 10:30",
      );
    });
    it("com entrevistas do sistema: também a hora do pacote, que elas acompanham", () => {
      const dados = normalizarPayload({
        ...PAYLOAD,
        gerado_em: "2026-10-22T17:00:00Z",
        entrevistas: [
          ...PAYLOAD.entrevistas,
          entrevista({ id: "s1", origem: "sistema" }),
        ],
      });
      expect(textoDasFontesDoPainel(dados, agora)).toBe(
        "Planilha conferida em 29/09, 10:30 · sistema às 14:00",
      );
      expect(dados.entrevistas.at(-1).origem).toBe("sistema");
    });
    it("sem carga nem sistema: nada (a tela usa a hora da leitura)", () => {
      expect(
        textoDasFontesDoPainel(
          { ultimaCarga: null, geradoEm: null, entrevistas: [] },
          agora,
        ),
      ).toBeNull();
    });
  });
});

bloco("lista-aprovados-filtros-multiplos", () => {
  const candidatos = [
    {
      candidato_id: "1",
      nome: "Ana Ribeiro",
      modalidade: "Ampla concorrência",
      cargo: "Enfermeiro",
      edital_id: "10",
      edital: "03/2025",
      status: "Contratado",
    },
    {
      candidato_id: "2",
      nome: "Bruno Lima",
      modalidade: "Pessoa negra",
      cargo: "Médico",
      edital_id: "10",
      edital: "03/2025",
      status: "",
    },
    {
      candidato_id: "3",
      nome: "Carla Souza",
      modalidade: "Pessoa com deficiência",
      cargo: "Enfermeiro",
      edital_id: "20",
      edital: "04/2025",
      status: "Desistente",
    },
    {
      candidato_id: "4",
      nome: "Diego Alves",
      modalidade: "Ampla concorrência",
      cargo: "Dentista",
      edital_id: "30",
      edital: "05/2025",
      status: "Migração",
    },
  ];

  const nomes = (rows) => rows.map((row) => row.nome);

  describe("filterApprovedCandidates com escolha múltipla", () => {
    it("aceita vários editais ao mesmo tempo", () => {
      const resultado = filterApprovedCandidates(candidatos, {
        editalId: ["10", "30"],
      });
      expect(nomes(resultado)).toEqual([
        "Ana Ribeiro",
        "Bruno Lima",
        "Diego Alves",
      ]);
    });

    it("aceita vários cargos ao mesmo tempo", () => {
      const resultado = filterApprovedCandidates(candidatos, {
        cargo: ["Médico", "Dentista"],
      });
      expect(nomes(resultado)).toEqual(["Bruno Lima", "Diego Alves"]);
    });

    it("combina 'Sem status' com um status concreto", () => {
      const resultado = filterApprovedCandidates(candidatos, {
        status: ["__sem_status__", "Desistente"],
      });
      expect(nomes(resultado)).toEqual(["Bruno Lima", "Carla Souza"]);
    });

    it("cruza filtros de campos diferentes com E, não com OU", () => {
      const resultado = filterApprovedCandidates(candidatos, {
        editalId: ["10", "20"],
        cargo: ["Enfermeiro"],
      });
      expect(nomes(resultado)).toEqual(["Ana Ribeiro", "Carla Souza"]);
    });

    it("lista vazia não filtra nada", () => {
      const resultado = filterApprovedCandidates(candidatos, {
        editalId: [],
        cargo: [],
        status: [],
      });
      expect(resultado).toHaveLength(4);
    });

    /*
    A tela antiga mandava strings. `summarizeApprovedCandidates` ainda zera o
    status com `""`, por isso a forma antiga tem de continuar a valer.
  */
    it("continua a aceitar um valor único em string", () => {
      expect(
        nomes(filterApprovedCandidates(candidatos, { editalId: "20" })),
      ).toEqual(["Carla Souza"]);
      expect(
        nomes(
          filterApprovedCandidates(candidatos, { status: "__sem_status__" }),
        ),
      ).toEqual(["Bruno Lima"]);
    });

    /*
    A tela deixou de ter campo de busca livre, mas a regra mantém o suporte:
    quem chamar com `query` continua a cruzá-la com os filtros.
  */
    it("aceita várias modalidades ao mesmo tempo", () => {
      const resultado = filterApprovedCandidates(candidatos, {
        modalidade: ["Pessoa negra", "Pessoa com deficiência"],
      });
      expect(nomes(resultado)).toEqual(["Bruno Lima", "Carla Souza"]);
    });

    it("cruza modalidade com os outros campos", () => {
      const resultado = filterApprovedCandidates(candidatos, {
        editalId: ["10", "30"],
        modalidade: ["Ampla concorrência"],
      });
      expect(nomes(resultado)).toEqual(["Ana Ribeiro", "Diego Alves"]);
    });

    it("cruza a busca por texto com os filtros", () => {
      const resultado = filterApprovedCandidates(candidatos, {
        editalId: ["10", "20"],
        query: "carla",
      });
      expect(nomes(resultado)).toEqual(["Carla Souza"]);
    });
  });

  describe("summarizeApprovedCandidates com escolha múltipla", () => {
    /*
    Convocado é estado próprio (chamado, aguardando apresentação): não é
    contratado — a Seleção e os KPIs de contratados também não o contam.
  */
    it("conta o convocado à parte, sem o somar a contratado", () => {
      const resumo = summarizeApprovedCandidates(
        [
          ...candidatos,
          {
            candidato_id: "99",
            nome: "Elza Martins",
            modalidade: "Ampla concorrência",
            cargo: "Enfermeiro",
            edital_id: "10",
            edital: "03/2025",
            status: "Convocado",
          },
        ],
        {},
      );
      expect(resumo.convocado).toBe(1);
      expect(resumo).not.toHaveProperty("fimDeFila");
    });

    it("conta dentro dos editais escolhidos, ignorando o filtro de status", () => {
      const resumo = summarizeApprovedCandidates(candidatos, {
        editalId: ["10", "20"],
        status: ["Contratado"],
      });
      expect(resumo).toMatchObject({
        total: 3,
        contratado: 1,
        desistente: 1,
        migracao: 0,
      });
    });
  });

  describe("candidateModalidadesForEdital", () => {
    it("junta as modalidades dos editais escolhidos, sem repetir", () => {
      expect(candidateModalidadesForEdital(candidatos, ["10", "30"])).toEqual([
        "Ampla concorrência",
        "Pessoa negra",
      ]);
    });

    it("sem edital escolhido, devolve as modalidades de toda a lista", () => {
      expect(candidateModalidadesForEdital(candidatos, [])).toEqual([
        "Ampla concorrência",
        "Pessoa com deficiência",
        "Pessoa negra",
      ]);
    });
  });

  describe("candidateCargosForEdital com escolha múltipla", () => {
    it("junta os cargos de todos os editais escolhidos, sem repetir", () => {
      expect(candidateCargosForEdital(candidatos, ["10", "20"])).toEqual([
        "Enfermeiro",
        "Médico",
      ]);
    });

    it("sem edital escolhido, devolve os cargos de toda a lista", () => {
      expect(candidateCargosForEdital(candidatos, [])).toEqual([
        "Dentista",
        "Enfermeiro",
        "Médico",
      ]);
    });
  });

  describe("opções de status", () => {
    it("Convocado entra e Fim de Fila sai, nos filtros e no modal", () => {
      const valores = OPCOES_DO_FILTRO_DE_STATUS.map((o) => o.value);
      expect(valores).toContain("Convocado");
      expect(valores).not.toContain("Fim de Fila");
      expect(STATUS_DO_CANDIDATO[0]).toBe("Convocado");
    });
  });
});

bloco("lista-aprovados-paginacao", () => {
  /** Candidatos falsos, só com o que a paginação precisa: a ordem. */
  const candidatos = (quantidade) =>
    Array.from({ length: quantidade }, (_, indice) => ({
      candidato_id: String(indice + 1),
      nome: `Candidato ${indice + 1}`,
    }));

  describe("paginateApprovedCandidates", () => {
    it("tamanho positivo menor que 1 mantém ao menos uma linha por página", () => {
      const resultado = paginateApprovedCandidates(candidatos(3), 2, 0.5);
      expect(resultado).toMatchObject({
        page: 2,
        totalPages: 3,
        total: 3,
        from: 2,
        to: 2,
      });
      expect(resultado.rows.map((c) => c.candidato_id)).toEqual(["2"]);
    });
    it("devolve só as linhas da página pedida", () => {
      const resultado = paginateApprovedCandidates(candidatos(120), 2, 50);
      expect(resultado.rows).toHaveLength(50);
      expect(resultado.rows[0].nome).toBe("Candidato 51");
      expect(resultado.rows.at(-1).nome).toBe("Candidato 100");
    });

    it("conta as páginas incluindo a última incompleta", () => {
      expect(
        paginateApprovedCandidates(candidatos(120), 1, 50).totalPages,
      ).toBe(3);
      expect(
        paginateApprovedCandidates(candidatos(100), 1, 50).totalPages,
      ).toBe(2);
      expect(paginateApprovedCandidates(candidatos(1), 1, 50).totalPages).toBe(
        1,
      );
    });

    it("descreve o intervalo como uma pessoa o leria", () => {
      const primeira = paginateApprovedCandidates(candidatos(120), 1, 50);
      expect([primeira.from, primeira.to]).toEqual([1, 50]);
      const ultima = paginateApprovedCandidates(candidatos(120), 3, 50);
      expect([ultima.from, ultima.to]).toEqual([101, 120]);
    });

    /*
    O caso que motiva a função corrigir a página em vez de confiar em quem chama:
    estando na página 7, filtrar por um cargo que só tem 3 candidatos deixaria a
    fatia vazia — e a tabela pareceria não ter encontrado nada.
  */
    it("traz a página para dentro do total quando o filtro encurta a lista", () => {
      const resultado = paginateApprovedCandidates(candidatos(3), 7, 50);
      expect(resultado.page).toBe(1);
      expect(resultado.rows).toHaveLength(3);
    });

    it("nunca devolve página menor que 1", () => {
      for (const pedida of [0, -5, NaN, undefined, null]) {
        expect(
          paginateApprovedCandidates(candidatos(10), pedida, 50).page,
        ).toBe(1);
      }
    });

    it("aguenta lista vazia sem inventar intervalo", () => {
      const resultado = paginateApprovedCandidates([], 1, 50);
      expect(resultado.rows).toEqual([]);
      expect(resultado.total).toBe(0);
      expect(resultado.totalPages).toBe(1);
      // `from` a 0 diz "nada a mostrar"; 1 sugeriria uma primeira linha.
      expect([resultado.from, resultado.to]).toEqual([0, 0]);
    });

    it("aguenta entrada inválida no lugar das linhas", () => {
      for (const entrada of [null, undefined, "texto", 42]) {
        const resultado = paginateApprovedCandidates(entrada, 1, 50);
        expect(resultado.rows).toEqual([]);
        expect(resultado.total).toBe(0);
      }
    });

    it("cai no tamanho padrão quando o pedido não faz sentido", () => {
      for (const tamanho of [0, -10, NaN, undefined]) {
        expect(
          paginateApprovedCandidates(candidatos(60), 1, tamanho).rows,
        ).toHaveLength(50);
      }
    });

    it("respeita o tamanho de página escolhido", () => {
      expect(
        paginateApprovedCandidates(candidatos(300), 1, 25).rows,
      ).toHaveLength(25);
      expect(
        paginateApprovedCandidates(candidatos(300), 1, 200).rows,
      ).toHaveLength(200);
      expect(
        paginateApprovedCandidates(candidatos(300), 2, 200).rows,
      ).toHaveLength(100);
    });

    it("não perde nem repete candidatos ao percorrer todas as páginas", () => {
      const todos = candidatos(137);
      const vistos = [];
      let pagina = 1;
      let total = Infinity;
      while (vistos.length < 137 && pagina <= total) {
        const resultado = paginateApprovedCandidates(todos, pagina, 25);
        total = resultado.totalPages;
        vistos.push(...resultado.rows.map((row) => row.candidato_id));
        pagina += 1;
      }
      expect(vistos).toHaveLength(137);
      expect(new Set(vistos).size).toBe(137);
    });
  });
});

bloco("lista-convocacao-regras-do-edital", () => {
  /*
  AS CLÁUSULAS DOS EDITAIS, UMA A UMA.

  Cada teste afirma uma regra publicada, com o número do item ao lado, e é por
  aqui que se confere a implementação contra o PDF. Ficam à parte dos testes de
  mecânica (`lista-convocacao-rules.test.js`) porque servem a outro leitor: quem
  quer saber se o sistema obedece ao edital, não como o laço está escrito.

  Oito editais da AgSUS foram lidos. Cinco têm regras idênticas e cabem no
  primeiro modelo de referência; os outros três é que justificam o modelo ser
  configurável, e cada um deles tem o seu bloco aqui.
*/

  const LEI_15142 = normalizarModelo(LEI_15142_ESPALHADA);
  const PORTARIA_5801 = normalizarModelo(
    modeloDeReferencia("portaria-5801-trans"),
  );
  const FCC_POSICOES = normalizarModelo(
    modeloDeReferencia("etnico-racial-posicoes"),
  );

  /*
  91/2026 é o modelo "Saúde Indígena" do catálogo: PCD com arredondamento e
  cascata próprios, mínimo de duas vagas e acumulação. As cláusulas abaixo
  conferem o modelo que a tela oferece.
*/
  const EDITAL_91 = normalizarModelo(
    modeloDeReferencia("saude-indigena-91-2026"),
  );

  let sequencial = 0;
  const candidato = (nome, modalidade, extra = {}) => {
    sequencial += 1;
    return {
      candidato_id: `c${sequencial}`,
      nome,
      modalidade,
      nota: 100 - sequencial,
      classificacao: sequencial,
      ...extra,
    };
  };

  const nomes = (linhas) => linhas.map((linha) => linha.candidato.nome);
  const categorias = (linhas) => linhas.map((linha) => linha.categoria);
  const posicoesDe = (ciclo, id) =>
    ciclo.map((c, i) => (c === id ? i + 1 : null)).filter(Boolean);

  describe("arredondamento (96/2025 item 5.2.1.1; 91/2026 item 4.2)", () => {
    it("por omissão, fração de 0,5 sobe e abaixo disso desce", () => {
      expect(arredondarVaga(2.5)).toBe(3);
      expect(arredondarVaga(2.49)).toBe(2);
      expect(arredondarVaga(0.49)).toBe(0);
      expect(arredondarVaga(0)).toBe(0);
    });

    it("no modo do 91/2026, qualquer fração sobe", () => {
      expect(arredondarVaga(0.15, "sempre_acima")).toBe(1);
      expect(arredondarVaga(2.1, "sempre_acima")).toBe(3);
    });
  });

  describe("Lei 15.142/2025 — 96/2025, 30/2026, 93/2026, Cebraspe e FGV", () => {
    /* 25% negros, 3% indígenas, 2% quilombolas (5.2.1) e 5% PCD (5.1.1). */
    it("aplica os percentuais e deixa o resto para a ampla", () => {
      expect(derivarQuadro(10, LEI_15142)).toEqual({
        ampla: 6,
        pretos_pardos: 3,
        indigena: 0,
        quilombola: 0,
        pcd: 1,
      });
    });

    it("com poucas vagas, só a reserva maior alcança uma vaga", () => {
      expect(derivarQuadro(3, LEI_15142)).toMatchObject({
        ampla: 2,
        pretos_pardos: 1,
        pcd: 0,
      });
      expect(derivarQuadro(1, LEI_15142)).toMatchObject({
        ampla: 1,
        pretos_pardos: 0,
      });
    });

    /*
    A cláusula mais importante do conjunto, e a que aparece em TODOS os editais
    lidos — com numeração diferente em cada um, o que a torna fácil de perder de
    vista: 5.2.3.1.3 no 96/2025, no 97/2025 e no Cebraspe; 5.7.15 no 30/2026;
    5.8.4 no 93/2026; 7.4.2 no da FGV.

    "Optantes pela reserva aprovados dentro do número de vagas oferecido para
    ampla concorrência NÃO serão computados para efeito de preenchimento das
    vagas reservadas."

    Por ser universal, é código e não configuração do modelo. E cai de graça do
    desenho: a vaga é uma posição na sequência, então ocupar uma posição de
    ampla deixa as de reserva intactas. JOÃO entra pela ampla e a vaga de negros
    passa a PEDRO.
  */
    it("não computa na reserva quem entrou pela ampla", () => {
      const { linhas } = montarConvocacaoDaVaga({
        candidatos: [
          candidato("JOÃO", '"Pretos e Pardos"'),
          candidato("MARIA", "Ampla Concorrência"),
          candidato("PEDRO", '"Pretos e Pardos"'),
        ],
        quadro: { ampla: 2, pretos_pardos: 1 },
        modelo: LEI_15142,
      });
      expect(nomes(linhas)).toEqual(["JOÃO", "PEDRO", "MARIA"]);
      expect(categorias(linhas)).toEqual(["ampla", "pretos_pardos", "ampla"]);
    });

    /* 5.2.3.2: quem concorre a mais de uma reserva vai só na de maior percentual. */
    it("põe o cotista múltiplo só na reserva de maior percentual", () => {
      const { linhas } = montarConvocacaoDaVaga({
        candidatos: [
          candidato("ANA", '"pretos e pardos" e "quilombola"'),
          candidato("BRUNO", "Ampla Concorrência"),
          candidato("CLARA", '"quilombola"'),
        ],
        quadro: { pretos_pardos: 1, quilombola: 1 },
        modelo: LEI_15142,
      });
      expect(nomes(linhas).slice(0, 2)).toEqual(["ANA", "CLARA"]);
      expect(categorias(linhas).slice(0, 2)).toEqual([
        "pretos_pardos",
        "quilombola",
      ]);
      expect(linhas[0].reservasEfetivas).toEqual(["pretos_pardos"]);
      // A tela continua a mostrar as duas reservas declaradas.
      expect(linhas[0].reservas).toEqual(["pretos_pardos", "quilombola"]);
    });

    /* 5.2.3.2.2: percentuais iguais, decide a melhor posição relativa. */
    it("com percentual empatado, vale a melhor posição relativa", () => {
      const empatado = normalizarModelo({
        ...LEI_15142_ESPALHADA,
        categorias: LEI_15142_ESPALHADA.categorias.map((categoria) =>
          categoria.id === "indigena"
            ? { ...categoria, percentual: 2 }
            : categoria,
        ),
      });
      const posicoes = new Map([
        ["quilombola", 3],
        ["indigena", 1],
      ]);
      expect(
        reservasEfetivas(["quilombola", "indigena"], empatado, posicoes),
      ).toEqual(["indigena"]);
    });

    /* 5.2.5.1: sem quilombolas, a vaga vai para os indígenas. */
    it("passa a vaga de quilombola para o indígena", () => {
      const { linhas } = montarConvocacaoDaVaga({
        candidatos: [
          candidato("MARIA", "Ampla Concorrência"),
          candidato("IARA", '"Indígena"'),
        ],
        quadro: { quilombola: 1, ampla: 1 },
        modelo: LEI_15142,
      });
      const vaga = linhas.find((l) => l.categoriaReservada === "quilombola");
      expect(vaga.candidato.nome).toBe("IARA");
      expect(vaga.categoria).toBe("indigena");
    });

    /* 5.2.5.2: sem indígenas, a vaga vai para os quilombolas. */
    it("passa a vaga de indígena para o quilombola", () => {
      const { linhas } = montarConvocacaoDaVaga({
        candidatos: [
          candidato("MARIA", "Ampla Concorrência"),
          candidato("JOANA", '"Quilombola"'),
        ],
        quadro: { indigena: 1, ampla: 1 },
        modelo: LEI_15142,
      });
      const vaga = linhas.find((l) => l.categoriaReservada === "indigena");
      expect(vaga.candidato.nome).toBe("JOANA");
      expect(vaga.categoria).toBe("quilombola");
    });

    /* 5.2.5.3: faltando os dois, vai para os negros e, por último, para a ampla. */
    it("faltando indígena e quilombola, a vaga vai para os negros", () => {
      const { linhas } = montarConvocacaoDaVaga({
        candidatos: [
          candidato("MARIA", "Ampla Concorrência"),
          candidato("PEDRO", '"Pretos e Pardos"'),
        ],
        quadro: { quilombola: 1, ampla: 1 },
        modelo: LEI_15142,
      });
      const vaga = linhas.find((l) => l.categoriaReservada === "quilombola");
      expect(vaga.candidato.nome).toBe("PEDRO");
      expect(vaga.categoria).toBe("pretos_pardos");
    });

    it("sem nenhum cotista, a vaga reverte para a ampla", () => {
      const { linhas } = montarConvocacaoDaVaga({
        candidatos: [
          candidato("MARIA", "Ampla Concorrência"),
          candidato("CARLOS", "Ampla Concorrência"),
        ],
        quadro: { quilombola: 1, ampla: 1 },
        modelo: LEI_15142,
      });
      expect(categorias(linhas)).toEqual(["ampla", "ampla"]);
      expect(linhas[1].categoriaReservada).toBe("quilombola");
    });

    /* A reserva de PCD não tem cascata própria neste modelo. */
    it("a reserva de PCD reverte direto para a ampla", () => {
      const { linhas } = montarConvocacaoDaVaga({
        candidatos: [
          candidato("MARIA", "Ampla Concorrência"),
          candidato("IARA", '"Indígena"'),
        ],
        quadro: { pcd: 1, ampla: 1 },
        modelo: LEI_15142,
      });
      expect(linhas.find((l) => l.categoriaReservada === "pcd").categoria).toBe(
        "ampla",
      );
    });
  });

  describe("Portaria GM/MS 5.801/2024 — edital 97/2025", () => {
    /*
    O edital acrescenta uma reserva que nenhum outro tem (5.2.1 alínea d) e
    muda todos os percentuais: 30/5/5/5 e 10% de PCD.
  */
    it("reserva também para candidatos trans", () => {
      expect(derivarQuadro(20, PORTARIA_5801)).toEqual({
        ampla: 9,
        pretos_pardos: 6,
        indigena: 1,
        quilombola: 1,
        trans: 1,
        pcd: 2,
      });
    });

    it("chama o candidato trans pela reserva própria", () => {
      const { linhas } = montarConvocacaoDaVaga({
        candidatos: [
          candidato("MARIA", "Ampla Concorrência"),
          candidato("LUA", "Pessoa Trans"),
        ],
        quadro: { ampla: 1, trans: 1 },
        modelo: PORTARIA_5801,
      });
      const vaga = linhas.find((l) => l.categoria === "trans");
      expect(vaga.candidato.nome).toBe("LUA");
      expect(vaga.categoriaReservada).toBeNull();
    });
  });

  describe("FCC 125 — posições publicadas no edital", () => {
    /*
    6.1.2: "aos candidatos de grupo étnico-racial serão destinadas... a 3ª, a
    8ª, a 13ª, a 18ª, a 23ª... seguindo intervalos de cinco vagas".
    5.2.2: PCD ocupa "a 5ª, 21ª, 41ª, 61ª, 81ª... de vinte em vinte".
  */
    it("põe a cota nas posições que o edital publica", () => {
      const quadro = derivarQuadro(25, FCC_POSICOES);
      const ciclo = sequenciaDeConvocacao(quadro, FCC_POSICOES);
      expect(posicoesDe(ciclo, "etnico_racial")).toEqual([3, 8, 13, 18, 23]);
      expect(posicoesDe(ciclo, "pcd")).toEqual([5]);
    });

    it("continua a série pelo intervalo do edital quando há vagas para tanto", () => {
      const ciclo = sequenciaDeConvocacao(
        { ampla: 95, pcd: 5, etnico_racial: 0 },
        FCC_POSICOES,
      );
      expect(posicoesDe(ciclo, "pcd")).toEqual([5, 21, 41, 61, 81]);
    });

    /* 6.1: negros e indígenas concorrem à MESMA reserva neste edital. */
    it("trata negros e indígenas como uma cota só", () => {
      const { linhas } = montarConvocacaoDaVaga({
        candidatos: [
          candidato("A", "Ampla"),
          candidato("B", "Ampla"),
          candidato("IARA", '"Indígena"'),
        ],
        quadro: { ampla: 2, etnico_racial: 1 },
        modelo: FCC_POSICOES,
      });
      const vaga = linhas.find((l) => l.categoria === "etnico_racial");
      expect(vaga.candidato.nome).toBe("IARA");
    });

    /* 6.1.3: esgotada a lista específica, passa-se à de ampla concorrência. */
    it("reverte para a ampla quando a lista específica se esgota", () => {
      const { linhas } = montarConvocacaoDaVaga({
        candidatos: [candidato("A", "Ampla"), candidato("B", "Ampla")],
        quadro: { ampla: 1, etnico_racial: 1 },
        modelo: FCC_POSICOES,
      });
      expect(categorias(linhas)).toEqual(["ampla", "ampla"]);
    });
  });

  describe("Edital 91/2026 — DSEI Alagoas e Sergipe", () => {
    /*
    5.3: a reserva só se aplica havendo duas ou mais vagas.

    O caso que isola o mínimo é o PCD: com 1 vaga, 5% dá 0,05, e o
    arredondamento "sempre para cima" deste edital levaria a 1. É o mínimo, e
    só ele, que o mantém em zero.
  */
    it("não aplica reserva abaixo do mínimo de vagas", () => {
      expect(derivarQuadro(1, EDITAL_91)).toMatchObject({
        ampla: 1,
        pretos_pardos: 0,
        pcd: 0,
      });
      expect(derivarQuadro(2, EDITAL_91)).toMatchObject({
        pretos_pardos: 1,
        pcd: 0,
      });
    });

    /*
    4.2: o PCD arredonda sempre para cima, "desde que a reserva não exceda o
    limite de 20% das vagas". Com 3 vagas, uma de PCD seria 33% — o teto corta.
    Com 5, uma é exatamente 20% e passa.
  */
    it("arredonda o PCD para cima, mas respeita o teto de 20%", () => {
      expect(derivarQuadro(3, EDITAL_91).pcd).toBe(0);
      expect(derivarQuadro(5, EDITAL_91).pcd).toBe(1);
    });

    /* 4.1.1: sem PCD, a vaga vai para as pessoas indígenas — e não para a ampla. */
    it("manda a vaga de PCD vazia para os indígenas", () => {
      const { linhas } = montarConvocacaoDaVaga({
        candidatos: [
          candidato("MARIA", "Ampla Concorrência"),
          candidato("IARA", '"Indígena"'),
        ],
        quadro: { pcd: 1, ampla: 1 },
        modelo: EDITAL_91,
      });
      const vaga = linhas.find((l) => l.categoriaReservada === "pcd");
      expect(vaga.candidato.nome).toBe("IARA");
      expect(vaga.categoria).toBe("indigena");
    });

    /*
    5.13: pode concorrer em mais de uma reserva desde que uma delas seja a de
    PCD. Quem declara PCD e indígena guarda as DUAS — o que o modelo comum não
    faria.
  */
    it("deixa acumular a reserva de PCD com outra", () => {
      const efetivas = reservasEfetivas(
        ["pcd", "indigena"],
        EDITAL_91,
        new Map(),
      );
      expect(efetivas).toEqual(expect.arrayContaining(["pcd", "indigena"]));
      expect(efetivas).toHaveLength(2);
    });

    it("no modelo comum, a mesma pessoa ficaria só numa reserva", () => {
      expect(
        reservasEfetivas(["pcd", "indigena"], LEI_15142, new Map()),
      ).toEqual(["pcd"]);
    });
  });

  /*
  RESERVA ÚNICA DE 30% — editais 65/2025 (DSEI Mato Grosso do Sul), 05/2026
  (MFC) e 63/2025.

  A mesma Lei 15.142/2025 dos outros, mas estes não publicam a repartição
  25/3/2: abrem UMA lista de reserva de 30% e chamam por ela. É a razão de as
  categorias serem dado — não há como escrever cinco delas no código e servir a
  um edital que tem duas.
*/
  describe("Lei 15.142/2025 com reserva única — 65/2025, 05/2026 e 63/2025", () => {
    const RESERVA_UNICA = normalizarModelo(
      modeloDeReferencia("lei-15142-reserva-unica"),
    );

    it("reserva 30% numa cota só, e 5% para PCD", () => {
      expect(derivarQuadro(10, RESERVA_UNICA)).toEqual({
        ampla: 6,
        ppiq: 3,
        pcd: 1,
      });
    });

    it("põe pretos, quilombolas e indígenas na mesma fila", () => {
      const { linhas } = montarConvocacaoDaVaga({
        candidatos: [
          candidato("ANA", "Ampla"),
          candidato("BENTO", "Ampla"),
          candidato("IARA", '"Indígena"'),
          candidato("JOANA", '"Quilombola"'),
        ],
        quadro: { ampla: 2, ppiq: 2 },
        modelo: RESERVA_UNICA,
      });
      const reservadas = linhas.filter((linha) => linha.categoria === "ppiq");
      expect(nomes(reservadas)).toEqual(["IARA", "JOANA"]);
    });

    /* Sem repartição, não há cascata: a reserva vazia vai direto para a ampla. */
    it("reverte para a ampla quando a reserva única fica sem candidato", () => {
      const { linhas } = montarConvocacaoDaVaga({
        candidatos: [candidato("ANA", "Ampla"), candidato("BENTO", "Ampla")],
        quadro: { ampla: 1, ppiq: 1 },
        modelo: RESERVA_UNICA,
      });
      expect(categorias(linhas)).toEqual(["ampla", "ampla"]);
      expect(linhas[1].categoriaReservada).toBe("ppiq");
    });
  });

  /*
  EDITAL SEM RESERVA — 03/2025, DSEI Alto Rio Solimões.

  Não tem cota nenhuma: a ação afirmativa entra como PONTUAÇÃO na avaliação
  ("ser pessoa preta/parda ou pessoa com deficiência: 20 pontos"), e não como
  vaga reservada. Quando a lista chega aqui, a nota já embute isso e a
  convocação é a classificação pura.

  Vale como teste porque é o extremo do modelo configurável: zero reservas tem
  de sair uma ordem correta, e não um erro.
*/
  describe("Edital sem reserva de vagas — 03/2025 Alto Rio Solimões", () => {
    const SEM_RESERVA = normalizarModelo({
      nome: "Sem reserva de vagas",
      categorias: [
        {
          id: "ampla",
          rotulo: "Ampla concorrência",
          sigla: "AC",
          ampla: true,
          termos: ["ampla*", "geral*"],
        },
      ],
    });

    it("dá todas as vagas imediatas à ampla", () => {
      expect(derivarQuadro(7, SEM_RESERVA)).toEqual({ ampla: 7 });
    });

    it("convoca pela classificação, mesmo quem declarou cota", () => {
      const { linhas } = montarConvocacaoDaVaga({
        candidatos: [
          candidato("ANA", "Ampla"),
          candidato("IARA", '"Indígena"'),
          candidato("BENTO", "Ampla"),
        ],
        quadro: derivarQuadro(3, SEM_RESERVA),
        modelo: SEM_RESERVA,
      });
      expect(nomes(linhas)).toEqual(["ANA", "IARA", "BENTO"]);
      expect(categorias(linhas)).toEqual(["ampla", "ampla", "ampla"]);
      expect(linhas.every((linha) => linha.categoriaReservada === null)).toBe(
        true,
      );
    });
  });

  /*
  105/2026 (DSEI Litoral Sul) e 110/2026 (DSEI Porto Velho) repetem o 91/2026
  em tudo — teto de 20% no PCD, mínimo de duas vagas, acumulação com PCD —
  MENOS num ponto: o item 4.1.1 manda a vaga de PCD vazia para a AMPLA, e não
  para os indígenas. Um campo de diferença entre dois editais quase gémeos, que
  é o argumento de a cascata ser configurável por categoria.
*/
  describe("105/2026 e 110/2026 — o mesmo do 91/2026, menos a cascata do PCD", () => {
    const LITORAL_SUL = normalizarModelo({
      ...EDITAL_91,
      categorias: EDITAL_91.categorias.map((categoria) =>
        categoria.id === "pcd" ? { ...categoria, cascata: [] } : categoria,
      ),
    });

    it("manda a vaga de PCD vazia para a ampla", () => {
      const candidatos = [
        candidato("MARIA", "Ampla Concorrência"),
        candidato("IARA", '"Indígena"'),
      ];
      const naLitoral = montarConvocacaoDaVaga({
        candidatos,
        quadro: { pcd: 1, ampla: 1 },
        modelo: LITORAL_SUL,
      });
      expect(
        naLitoral.linhas.find((l) => l.categoriaReservada === "pcd").categoria,
      ).toBe("ampla");

      // O 91/2026, com a mesma gente, dá a vaga à indígena.
      const noNoventaEUm = montarConvocacaoDaVaga({
        candidatos,
        quadro: { pcd: 1, ampla: 1 },
        modelo: EDITAL_91,
      });
      expect(
        noNoventaEUm.linhas.find((l) => l.categoriaReservada === "pcd")
          .categoria,
      ).toBe("indigena");
    });
  });

  /*
  EDITAL DA FGV — o que obrigou o mínimo a ser POR CATEGORIA.

  Mesmos percentuais da Lei 15.142/2025, mas com dois mínimos diferentes no
  mesmo edital: 6.5 exige CINCO vagas no cargo para haver reserva de PCD, e
  7.1.3 exige DUAS para as raciais. Um mínimo único no modelo não representaria
  isto — daria reserva de PCD numa vaga de três, contra o edital.

  E dois arredondamentos: 6.4 manda o PCD para o inteiro seguinte sempre
  (Decreto 9.508 §3), enquanto 7.1.1 aplica a regra dos 0,5 às raciais.
*/
  describe("FGV — mínimos e arredondamentos diferentes no mesmo edital", () => {
    const FGV = normalizarModelo(FGV_MINIMOS_POR_CARGO);

    it("com 3 vagas, vale a reserva racial e não a de PCD", () => {
      expect(derivarQuadro(3, FGV)).toMatchObject({
        ampla: 2,
        pretos_pardos: 1,
        pcd: 0,
      });
    });

    it("a partir de 5 vagas, a reserva de PCD entra", () => {
      expect(derivarQuadro(4, FGV).pcd).toBe(0);
      expect(derivarQuadro(5, FGV).pcd).toBe(1);
    });

    /* 6.4: qualquer fração sobe. 5 x 5% = 0,25, e ainda assim dá uma vaga. */
    it("o PCD arredonda sempre para cima, ao contrário das raciais", () => {
      expect(derivarQuadro(5, FGV)).toMatchObject({
        pcd: 1,
        // 5 x 3% = 0,15 e 5 x 2% = 0,10 descem, pela regra dos 0,5.
        indigena: 0,
        quilombola: 0,
      });
    });

    it("com 1 vaga não há reserva nenhuma", () => {
      expect(derivarQuadro(1, FGV)).toMatchObject({
        ampla: 1,
        pretos_pardos: 0,
        pcd: 0,
      });
    });

    /* 7.13: a reserva vazia vai direto para a ampla — a FGV não tem cascata. */
    it("reverte direto para a ampla, sem cascata entre as cotas", () => {
      const { linhas } = montarConvocacaoDaVaga({
        candidatos: [
          candidato("MARIA", "Ampla Concorrência"),
          candidato("IARA", '"Indígena"'),
        ],
        quadro: { quilombola: 1, ampla: 1 },
        modelo: FGV,
      });
      const vaga = linhas.find((l) => l.categoriaReservada === "quilombola");
      expect(vaga.categoria).toBe("ampla");
      /*
      IARA é indígena, e num modelo com cascata a vaga de quilombola teria ido
      para ela COMO indígena. Aqui vai como ampla, "preenchida pelas demais
      pessoas candidatas aprovadas, observada a ordem de classificação geral" —
      MARIA já tinha tomado a 1ª posição, também pela ampla.
    */
      expect(vaga.candidato.nome).toBe("IARA");
      expect(linhas[0].candidato.nome).toBe("MARIA");
    });
  });
});

bloco("lista-convocacao-rules", () => {
  /*
  A MECÂNICA do cálculo: ordenação, sequência, preenchimento e agrupamento. As
  cláusulas de cada edital estão em `lista-convocacao-regras-do-edital.test.js`.
*/
  const MODELO = normalizarModelo(LEI_15142_ESPALHADA);

  /*
  Candidatos falsos com o mínimo que o cálculo lê. A nota decresce com o índice
  para que a ordem geral seja a ordem de escrita — assim o esperado de cada
  teste se lê sem contas.
*/
  let sequencial = 0;
  const candidato = (nome, modalidade, extra = {}) => {
    sequencial += 1;
    return {
      candidato_id: `c${sequencial}`,
      nome,
      modalidade,
      nota: 100 - sequencial,
      classificacao: sequencial,
      cargo: "ENFERMEIRO",
      codigo_vaga: "VG-001",
      edital_id: "1",
      edital: "53/2025",
      lista_ativa: true,
      ...extra,
    };
  };

  const nomes = (linhas) => linhas.map((linha) => linha.candidato.nome);
  const categorias = (linhas) => linhas.map((linha) => linha.categoria);
  const convocar = (candidatos, quadro, modelo = MODELO) =>
    montarConvocacaoDaVaga({ candidatos, quadro, modelo });

  describe("sequenciaDeConvocacao", () => {
    it("intercala a reserva entre as vagas de ampla", () => {
      expect(
        sequenciaDeConvocacao({ ampla: 2, pretos_pardos: 1 }, MODELO),
      ).toEqual(["ampla", "pretos_pardos", "ampla"]);
    });

    it("espalha cada categoria em vez de a empilhar no fim", () => {
      expect(
        sequenciaDeConvocacao({ ampla: 4, pretos_pardos: 2 }, MODELO),
      ).toEqual([
        "ampla",
        "pretos_pardos",
        "ampla",
        "ampla",
        "pretos_pardos",
        "ampla",
      ]);
    });

    it("devolve ciclo vazio quando a vaga não tem vaga imediata", () => {
      expect(sequenciaDeConvocacao({}, MODELO)).toEqual([]);
      expect(sequenciaDeConvocacao({ ampla: 0, pcd: 0 }, MODELO)).toEqual([]);
    });

    it("é estável: a mesma configuração dá sempre a mesma ordem", () => {
      const quadro = { ampla: 3, pretos_pardos: 1, quilombola: 1, pcd: 1 };
      expect(sequenciaDeConvocacao(quadro, MODELO)).toEqual(
        sequenciaDeConvocacao(quadro, MODELO),
      );
    });
  });

  describe("ordenarPorClassificacao", () => {
    /*
    O motivo de a nota mandar: a coluna `classificacao` do XLSX costuma vir por
    modalidade, e aí o 1º da ampla e o 1º da cota chegam ambos como "1".
  */
    it("usa a nota e não a classificação por modalidade", () => {
      const linhas = [
        { nome: "ANA", nota: 93.5, classificacao: 1 },
        { nome: "MARIA", nota: 95.5, classificacao: 1 },
        { nome: "CARLOS", nota: 92, classificacao: 2 },
        { nome: "JOÃO", nota: 94, classificacao: 1 },
      ];
      expect(
        ordenarPorClassificacao(linhas).map((linha) => linha.nome),
      ).toEqual(["MARIA", "JOÃO", "ANA", "CARLOS"]);
    });

    it("desempata nota igual pela classificação e depois pelo nome", () => {
      const linhas = [
        { nome: "ZILDA", nota: 90, classificacao: 2 },
        { nome: "BRUNO", nota: 90, classificacao: 1 },
        { nome: "ALICE", nota: 90, classificacao: 2 },
      ];
      expect(
        ordenarPorClassificacao(linhas).map((linha) => linha.nome),
      ).toEqual(["BRUNO", "ALICE", "ZILDA"]);
    });

    it("sem classificação ou sem nota vai para o fim, não vale zero", () => {
      const linhas = [
        { nome: "ANA", nota: 8, classificacao: 1 },
        { nome: "BIA", nota: 8, classificacao: null },
        { nome: "CAIO", nota: 8, classificacao: "" },
        { nome: "DORA", nota: null, classificacao: 2 },
        { nome: "EVA", nota: 0, classificacao: 3 },
      ];
      expect(
        ordenarPorClassificacao(linhas).map((linha) => linha.nome),
      ).toEqual(["ANA", "BIA", "CAIO", "EVA", "DORA"]);
    });
  });

  describe("montarConvocacaoDaVaga", () => {
    it("chama pela sequência, e não pela classificação", () => {
      const { linhas } = convocar(
        [
          candidato("MARIA", "Ampla Concorrência"),
          candidato("CARLOS", "Ampla Concorrência"),
          candidato("JOÃO", '" pretos e pardos"'),
        ],
        { ampla: 2, pretos_pardos: 1 },
      );
      expect(nomes(linhas)).toEqual(["MARIA", "JOÃO", "CARLOS"]);
      expect(categorias(linhas)).toEqual(["ampla", "pretos_pardos", "ampla"]);
    });

    /*
    A regra central: quem é chamado pela ampla não gasta a vaga da reserva. JOÃO
    tem a 1ª nota e entra pela ampla; a vaga de pretos e pardos continua de pé e
    cabe a PEDRO.
  */
    it("não gasta a vaga de reserva quando o cotista entra pela ampla", () => {
      const { linhas } = convocar(
        [
          candidato("JOÃO", '"Pretos e Pardos"'),
          candidato("MARIA", "Ampla Concorrência"),
          candidato("PEDRO", '"Pretos e Pardos"'),
        ],
        { ampla: 2, pretos_pardos: 1 },
      );
      expect(nomes(linhas)).toEqual(["JOÃO", "PEDRO", "MARIA"]);
      expect(categorias(linhas)).toEqual(["ampla", "pretos_pardos", "ampla"]);
    });

    /*
    A ORDEM É FIXA (27/11/2026): quem saiu fica no seu número, sem vaga, e a vaga
    imediata dele vai para o primeiro do cadastro de reserva que a disputa. Os
    números de todos ficam como estavam.
  */
    it("quem saiu fica no seu lugar e a vaga vai para o primeiro da reserva", () => {
      const resultado = convocar(
        [
          candidato("MARIA", "Ampla Concorrência", { status: "Desistente" }),
          candidato("CARLOS", "Ampla Concorrência"),
          candidato("PAULO", "Ampla Concorrência", {
            status: "Documentação Rejeitada",
          }),
          candidato("RITA", "Ampla Concorrência"),
        ],
        { ampla: 2 },
      );
      expect(nomes(resultado.linhas)).toEqual([
        "MARIA",
        "CARLOS",
        "PAULO",
        "RITA",
      ]);
      expect(resultado.linhas.map((linha) => linha.posicao)).toEqual([
        1, 2, 3, 4,
      ]);
      expect(resultado.linhas.map((linha) => Boolean(linha.saiu))).toEqual([
        true,
        false,
        true,
        false,
      ]);
      expect(nomes(resultado.linhas.filter((linha) => linha.imediata))).toEqual(
        ["CARLOS", "RITA"],
      );
      expect(resultado.linhas[3].noLugarDe).toEqual({
        nome: "MARIA",
        posicao: 1,
      });
      expect(resultado.linhas[1].noLugarDe).toBeUndefined();
      expect(situacaoNaChamada(resultado.linhas[0])).toBe("Fora da fila");
    });

    it("a vaga de cota de quem saiu vai para o próximo da mesma cota, não para o próximo da ampla", () => {
      const { linhas } = convocar(
        [
          candidato("ANA", "Ampla Concorrência"),
          candidato("BIA", '"Pretos e Pardos"', { status: "Desistente" }),
          candidato("CAIO", "Ampla Concorrência"),
          candidato("DANI", "Ampla Concorrência"),
          candidato("EDU", '"Pretos e Pardos"'),
        ],
        { ampla: 1, pretos_pardos: 1 },
      );
      // A ordem original: ANA (AC) e BIA (PP) nas imediatas; a reserva segue o
      // ciclo AC, PP (CAIO, EDU, DANI).
      expect(nomes(linhas)).toEqual(["ANA", "BIA", "CAIO", "EDU", "DANI"]);
      const imediatas = linhas.filter((linha) => linha.imediata);
      expect(nomes(imediatas)).toEqual(["ANA", "EDU"]);
      const edu = linhas[3];
      expect(edu.posicao).toBe(4);
      expect(edu.categoria).toBe("pretos_pardos");
      expect(edu.categoriaReservada).toBeNull();
      expect(edu.noLugarDe).toEqual({ nome: "BIA", posicao: 2 });
      expect(linhas[2].imediata).toBe(false);
    });

    it("sem ninguém da cota na reserva, a vaga de quem saiu desce até a ampla", () => {
      const { linhas } = convocar(
        [
          candidato("ANA", "Ampla Concorrência"),
          candidato("BIA", '"Pretos e Pardos"', { status: "Desistente" }),
          candidato("CAIO", "Ampla Concorrência"),
        ],
        { ampla: 1, pretos_pardos: 1 },
      );
      const caio = linhas[2];
      expect(caio.imediata).toBe(true);
      expect(caio.categoria).toBe("ampla");
      expect(caio.categoriaReservada).toBe("pretos_pardos");
      expect(caio.noLugarDe).toEqual({ nome: "BIA", posicao: 2 });
    });

    it("sem proporcionalidade, também fica a ordem e a vaga vai ao próximo", () => {
      const { linhas } = montarConvocacaoDaVaga({
        candidatos: [
          candidato("ANA", "Ampla", { status: "Desistente" }),
          candidato("BRUNO", "Ampla"),
          candidato("CARLA", "Ampla"),
        ],
        quadro: { ampla: 1 },
        modelo: MODELO,
        proporcionalidade: false,
      });
      expect(nomes(linhas)).toEqual(["ANA", "BRUNO", "CARLA"]);
      expect(linhas.map((linha) => linha.imediata)).toEqual([
        false,
        true,
        false,
      ]);
      expect(linhas[1].noLugarDe).toEqual({ nome: "ANA", posicao: 1 });
    });

    it("mantém na fila quem está contratado ou em migração", () => {
      const { linhas } = convocar(
        [
          candidato("MARIA", "Ampla Concorrência", { status: "Contratado" }),
          candidato("CARLOS", "Ampla Concorrência", { status: "Migração" }),
        ],
        { ampla: 2 },
      );
      expect(nomes(linhas)).toEqual(["MARIA", "CARLOS"]);
      expect(linhas.some((linha) => linha.saiu)).toBe(false);
    });

    it("segue o mesmo ciclo depois das vagas imediatas, para ordenar a reserva", () => {
      const { linhas, totalImediatas } = convocar(
        [
          candidato("A", "Ampla Concorrência"),
          candidato("B", "Ampla Concorrência"),
          candidato("C", '"Indígena"'),
          candidato("D", "Ampla Concorrência"),
        ],
        { ampla: 1, indigena: 1 },
      );
      expect(totalImediatas).toBe(2);
      expect(nomes(linhas)).toEqual(["A", "C", "B", "D"]);
      expect(linhas.map((linha) => linha.imediata)).toEqual([
        true,
        true,
        false,
        false,
      ]);
    });

    it("trata vaga sem vaga imediata como cadastro de reserva na ordem geral", () => {
      const { linhas, totalImediatas } = convocar(
        [candidato("A", '"Indígena"'), candidato("B", "Ampla Concorrência")],
        {},
      );
      expect(totalImediatas).toBe(0);
      expect(nomes(linhas)).toEqual(["A", "B"]);
      expect(linhas.every((linha) => !linha.imediata)).toBe(true);
    });

    it("sem proporcionalidade devolve a ordem de classificação, sem categorias", () => {
      const { linhas } = montarConvocacaoDaVaga({
        candidatos: [
          candidato("JOÃO", '"Pretos e Pardos"'),
          candidato("MARIA", "Ampla Concorrência"),
          candidato("PEDRO", '"Pretos e Pardos"'),
        ],
        quadro: { ampla: 2, pretos_pardos: 1 },
        modelo: MODELO,
        proporcionalidade: false,
      });
      expect(nomes(linhas)).toEqual(["JOÃO", "MARIA", "PEDRO"]);
      expect(categorias(linhas)).toEqual([null, null, null]);
    });

    it("não deixa candidato de fora nem o repete", () => {
      const { linhas } = convocar(
        [
          candidato("A", '"Indígena"'),
          candidato("B", '"Quilombola"'),
          candidato("C", "Ampla"),
          candidato("D", "PCD"),
          candidato("E", '"pretos e pardos"'),
          candidato("F", ""),
        ],
        { ampla: 1, pretos_pardos: 1, quilombola: 1, indigena: 1, pcd: 1 },
      );
      expect(linhas).toHaveLength(6);
      expect(new Set(nomes(linhas)).size).toBe(6);
    });
  });

  describe("montarListaDeConvocacao", () => {
    const configuracao =
      (quadro, modelo = MODELO) =>
      () => ({ quadro, modelo, proporcionalidade: true });

    it("separa uma convocação por vaga do edital", () => {
      const grupos = montarListaDeConvocacao(
        [
          candidato("A", "Ampla", {
            codigo_vaga: "VG-001",
            cargo: "ENFERMEIRO",
          }),
          candidato("B", "Ampla", { codigo_vaga: "VG-002", cargo: "MÉDICO" }),
          candidato("C", "Ampla", {
            codigo_vaga: "VG-001",
            cargo: "ENFERMEIRO",
          }),
        ],
        configuracao({ ampla: 1 }),
      );
      expect(grupos).toHaveLength(2);
      expect(grupos.map((grupo) => grupo.codigoVaga)).toEqual([
        "VG-001",
        "VG-002",
      ]);
      expect(grupos[0].linhas).toHaveLength(2);
    });

    /*
    Sub judice entra pela inclusão manual, que não pede código de vaga. Deixá-lo
    numa vaga só dele daria uma convocação de uma pessoa, à parte da do cargo.
  */
    it("anexa o sub judice sem código à única vaga do seu cargo", () => {
      const grupos = montarListaDeConvocacao(
        [
          candidato("A", "Ampla", {
            codigo_vaga: "VG-001",
            cargo: "ENFERMEIRO",
          }),
          candidato("SUB", null, {
            codigo_vaga: null,
            cargo: "ENFERMEIRO",
            sub_judice: true,
          }),
        ],
        configuracao({ ampla: 1 }),
      );
      expect(grupos).toHaveLength(1);
      expect(nomes(grupos[0].linhas)).toEqual(["A", "SUB"]);
    });

    it("aplica a configuração devolvida para cada vaga", () => {
      const grupos = montarListaDeConvocacao(
        [
          candidato("A", "Ampla", { codigo_vaga: "VG-001" }),
          candidato("B", "Ampla", { codigo_vaga: "VG-002", cargo: "MÉDICO" }),
        ],
        (_edital, codigo) => ({
          quadro: codigo === "VG-001" ? { ampla: 1 } : {},
          modelo: MODELO,
          proporcionalidade: true,
        }),
      );
      const porCodigo = Object.fromEntries(
        grupos.map((grupo) => [grupo.codigoVaga, grupo]),
      );
      expect(porCodigo["VG-001"].totalImediatas).toBe(1);
      expect(porCodigo["VG-002"].totalImediatas).toBe(0);
    });
  });

  describe("resumirConvocacao", () => {
    it("conta vagas imediatas, reserva e quem saiu da fila", () => {
      const grupos = montarListaDeConvocacao(
        [
          candidato("A", "Ampla"),
          candidato("B", "Ampla"),
          candidato("C", "Ampla", { status: "Desistente" }),
        ],
        () => ({
          quadro: { ampla: 1 },
          modelo: MODELO,
          proporcionalidade: true,
        }),
      );
      expect(resumirConvocacao(grupos)).toMatchObject({
        vagas: 1,
        imediatas: 1,
        aConvocar: 1,
        reserva: 1,
        foraDaFila: 1,
      });
    });

    it("quem já foi chamado da reserva sai do cadastro (como a coluna Situação)", () => {
      const grupos = montarListaDeConvocacao(
        [
          candidato("A", "Ampla", { status: "Contratado" }),
          candidato("B", "Ampla", { status: "Contratado" }),
          candidato("C", "Ampla"),
        ],
        () => ({
          quadro: { ampla: 1 },
          modelo: MODELO,
          proporcionalidade: true,
        }),
      );
      // B está além da vaga imediata mas já foi contratado: "Já chamado".
      expect(resumirConvocacao(grupos)).toMatchObject({
        imediatas: 1,
        reserva: 1,
      });
    });
  });

  /*
  CONVOCADO — história "Marcar convocados" (docs/historias-de-usuario/
  lista-de-aprovados.md): quem foi chamado continua na posição que o cálculo
  lhe deu e não é chamado de novo; Desistente e Documentação Rejeitada saem da
  fila e o próximo toma a vaga. "Fim de Fila" deixou de existir.
*/
  describe("status Convocado", () => {
    it("continua na fila, na mesma posição, e não conta como a convocar", () => {
      const grupos = montarListaDeConvocacao(
        [
          candidato("ANA", "Ampla", { status: "Convocado" }),
          candidato("BRUNO", "Ampla"),
          candidato("CARLA", "Ampla"),
        ],
        () => ({
          quadro: { ampla: 2 },
          modelo: MODELO,
          proporcionalidade: true,
        }),
      );
      const [grupo] = grupos;
      expect(nomes(grupo.linhas)).toEqual(["ANA", "BRUNO", "CARLA"]);
      expect(grupo.linhas[0].imediata).toBe(true);
      expect(estaAConvocar(grupo.linhas[0])).toBe(false);
      expect(estaAConvocar(grupo.linhas[1])).toBe(true);
      expect(situacaoNaChamada(grupo.linhas[0])).toBe("Já chamado");
      expect(situacaoNaChamada(grupo.linhas[2])).toBe("Cadastro de reserva");
      expect(resumirConvocacao(grupos)).toMatchObject({
        aConvocar: 1,
        convocados: 1,
        reserva: 1,
      });
    });

    it("convocado que desiste fica no lugar e o próximo passa a ser a convocar", () => {
      const grupos = montarListaDeConvocacao(
        [
          candidato("ANA", "Ampla", { status: "Desistente" }),
          candidato("BRUNO", "Ampla"),
          candidato("CARLA", "Ampla"),
        ],
        () => ({
          quadro: { ampla: 1 },
          modelo: MODELO,
          proporcionalidade: true,
        }),
      );
      expect(nomes(grupos[0].linhas)).toEqual(["ANA", "BRUNO", "CARLA"]);
      expect(grupos[0].linhas[0].saiu).toBe(true);
      expect(nomes(grupos[0].linhas.filter(estaAConvocar))).toEqual(["BRUNO"]);
      expect(resumirConvocacao(grupos)).toMatchObject({
        aConvocar: 1,
        foraDaFila: 1,
        reserva: 1,
      });
    });

    it("contratado e migração também já foram chamados", () => {
      expect(jaFoiChamado({ status: "Contratado" })).toBe(true);
      expect(jaFoiChamado({ status: "Migração" })).toBe(true);
      expect(jaFoiChamado({ status: "Convocado" })).toBe(true);
      expect(jaFoiChamado({ status: "" })).toBe(false);
      expect(jaFoiChamado({ status: "Desistente" })).toBe(false);
    });

    it("não há mais tratamento de Fim de Fila: o status antigo não muda a ordem", () => {
      const { linhas } = convocar(
        [
          candidato("ANA", "Ampla", { status: "Fim de Fila" }),
          candidato("BRUNO", "Ampla"),
        ],
        { ampla: 2 },
      );
      expect(nomes(linhas)).toEqual(["ANA", "BRUNO"]);
    });
  });

  describe("CSV da ordem de convocação", () => {
    it("traz situação na chamada, status e data da convocação, na ordem da tela", () => {
      const grupos = montarListaDeConvocacao(
        [
          candidato("ANA", "Ampla", { status: "Convocado" }),
          candidato("BRUNO", "Ampla"),
          candidato("CARLA", "Ampla", { status: "Desistente" }),
        ],
        () => ({
          quadro: { ampla: 2 },
          modelo: MODELO,
          proporcionalidade: true,
        }),
      );
      const idDaAna = grupos[0].linhas[0].candidato.candidato_id;
      const linhas = linhasDoCsvDaConvocacao(grupos, {
        convocacoes: new Map([[idDaAna, { data: "2026-10-05" }]]),
        rotulo: () => "Ampla",
      });
      expect(linhas[0]).toContain("Data da convocação");
      expect(linhas[0]).toContain("Situação na chamada");
      const porNome = Object.fromEntries(linhas.slice(1).map((l) => [l[8], l]));
      expect(porNome.ANA.slice(6, 8)).toEqual([
        "Imediata · Ampla",
        "Já chamado",
      ]);
      expect(porNome.ANA.slice(11)).toEqual(["Convocado", "05/10/2026"]);
      expect(porNome.BRUNO[7]).toBe("A convocar");
      expect(porNome.BRUNO[11]).toBe("Sem status");
      expect(porNome.CARLA[7]).toBe("Fora da fila");
      expect(linhas.at(-1)[8]).toBe("CARLA");
    });
  });

  describe("csvDaConvocacao", () => {
    it("usa ;, BOM e protege célula que parece fórmula", () => {
      const grupos = montarListaDeConvocacao(
        [
          candidato("=HYPERLINK(1)", "Ampla"),
          candidato("BRUNO; LIMA", "Ampla"),
        ],
        () => ({
          quadro: { ampla: 1 },
          modelo: MODELO,
          proporcionalidade: true,
        }),
      );
      const csv = csvDaConvocacao(grupos);
      expect(csv.startsWith("\uFEFFEdital;")).toBe(true);
      expect(csv).toContain(";'=HYPERLINK(1);");
      expect(csv).toContain(';"BRUNO; LIMA";');
    });
  });
});

bloco("modelo-de-convocacao", () => {
  const padrao = normalizarModelo(LEI_15142_ESPALHADA);
  const comTrans = normalizarModelo(modeloDeReferencia("portaria-5801-trans"));
  const etnicoRacial = normalizarModelo(
    modeloDeReferencia("etnico-racial-posicoes"),
  );

  const reservas = (valor, modelo = padrao) =>
    lerModalidade(valor, modelo).reservas;

  describe("normalizarTexto", () => {
    it("tira acento, caixa e pontuação, deixando palavras", () => {
      expect(normalizarTexto('  "Ampla Concorrência" ')).toBe(
        "ampla concorrencia",
      );
      expect(normalizarTexto("PRETOS/PARDOS")).toBe("pretos pardos");
    });
  });

  describe("lerModalidade", () => {
    it("reconhece a ampla escrita das formas que chegam", () => {
      [
        "Ampla Concorrência",
        '"Ampla Concorrência"',
        " AMPLA ",
        "ac",
        "Geral",
      ].forEach((valor) => {
        expect(lerModalidade(valor, padrao).reconhecida).toBe(true);
        expect(reservas(valor)).toEqual([]);
      });
    });

    it("atravessa aspas, espaços e caixa", () => {
      expect(reservas(' " Indígena" ')).toEqual(["indigena"]);
      expect(reservas('"QUILOMBOLA"')).toEqual(["quilombola"]);
      expect(reservas("pessoa com deficiência")).toEqual(["pcd"]);
      expect(reservas("PcD")).toEqual(["pcd"]);
    });

    /*
    Dividir a célula por um separador era o caminho óbvio e está errado: " e "
    partiria "pretos e pardos" ao meio, e o separador varia de edital para
    edital. Os termos são testados contra a célula inteira.
  */
    it("não se deixa partir por 'pretos e pardos'", () => {
      expect(reservas("Pretos e Pardos")).toEqual(["pretos_pardos"]);
      expect(reservas('"pretos e pardos"')).toEqual(["pretos_pardos"]);
      expect(reservas("Pretos, Pardos")).toEqual(["pretos_pardos"]);
    });

    it("ignora o separador entre as cotas, seja ele qual for", () => {
      const duas = ["pretos_pardos", "quilombola"];
      expect(reservas('"pretos e pardos", "quilombola"')).toEqual(duas);
      expect(reservas('"pretos e pardos","quilombola"')).toEqual(duas);
      expect(reservas('" pretos e pardos" e "quilombola"')).toEqual(duas);
      expect(reservas("Pretos e Pardos; Quilombola")).toEqual(duas);
      expect(reservas("Pretos e Pardos / Quilombola")).toEqual(duas);
      expect(
        reservas("Ampla Concorrência, Pretos e Pardos, Quilombola"),
      ).toEqual(duas);
    });

    it("marca como não reconhecida a célula vazia ou com termo inesperado", () => {
      expect(lerModalidade("", padrao).reconhecida).toBe(false);
      expect(lerModalidade(null, padrao).reconhecida).toBe(false);
      expect(lerModalidade("reserva técnica", padrao).reconhecida).toBe(false);
      expect(reservas("reserva técnica")).toEqual([]);
    });

    /*
    A razão de os termos serem dado e não código: o 97/2025 tem uma reserva que
    nenhum outro edital tem, e o da FCC junta duas numa só. Nenhum dos dois
    caberia num conjunto fixo de categorias.
  */
    it("reconhece a cota trans no modelo que a declara — e não no que não declara", () => {
      expect(reservas("Pessoa Trans", comTrans)).toEqual(["trans"]);
      expect(lerModalidade("Pessoa Trans", padrao).reconhecida).toBe(false);
    });

    it("junta negros e indígenas numa cota só no modelo da FCC", () => {
      expect(reservas('"Indígena"', etnicoRacial)).toEqual(["etnico_racial"]);
      expect(reservas('"Pretos e Pardos"', etnicoRacial)).toEqual([
        "etnico_racial",
      ]);
    });
  });

  describe("termos", () => {
    it("aceita lista ou texto separado por ponto e vírgula", () => {
      expect(lerTermos("preto*; pardo*")).toEqual(["preto*", "pardo*"]);
      expect(lerTermos(["preto*", "pardo*"])).toEqual(["preto*", "pardo*"]);
      expect(lerTermos("")).toEqual([]);
    });

    /*
    O asterisco é o que separa "casa com a palavra" de "casa com as flexões", e
    existe para quem configura não precisar de saber o que é uma regex.
  */
    it("o asterisco alcança as flexões; sem ele, só a palavra inteira", () => {
      const modelo = normalizarModelo({
        categorias: [
          {
            id: "ampla",
            rotulo: "Ampla",
            sigla: "AC",
            ampla: true,
            termos: ["ampla"],
          },
          {
            id: "teste",
            rotulo: "Teste",
            sigla: "T",
            percentual: 10,
            termos: ["preto*"],
          },
          {
            id: "curto",
            rotulo: "Curto",
            sigla: "C",
            percentual: 5,
            termos: ["ac"],
          },
        ],
      });
      expect(lerModalidade("pretos", modelo).reservas).toEqual(["teste"]);
      expect(lerModalidade("acesso", modelo).reservas).toEqual([]);
      expect(lerModalidade("ac", modelo).reservas).toEqual(["curto"]);
    });
  });

  describe("normalizarModelo", () => {
    it("garante exatamente uma categoria de ampla", () => {
      const semAmpla = normalizarModelo({
        categorias: [{ id: "pcd", rotulo: "PCD", sigla: "PCD", percentual: 5 }],
      });
      expect(semAmpla.categorias.filter((c) => c.ampla)).toHaveLength(1);

      const duasAmplas = normalizarModelo({
        categorias: [
          { id: "a", rotulo: "A", sigla: "A", ampla: true },
          { id: "b", rotulo: "B", sigla: "B", ampla: true },
        ],
      });
      expect(duasAmplas.categorias.filter((c) => c.ampla)).toHaveLength(1);
    });

    it("zera o percentual da ampla, que é o resto e não uma fatia", () => {
      const modelo = normalizarModelo({
        categorias: [
          {
            id: "ampla",
            rotulo: "A",
            sigla: "AC",
            ampla: true,
            percentual: 70,
          },
        ],
      });
      expect(modelo.categorias[0].percentual).toBe(0);
    });

    /* Cascata apontando para categoria apagada deixaria a vaga sem destino. */
    it("descarta cascata que aponta para categoria inexistente ou para si mesma", () => {
      const modelo = normalizarModelo({
        categorias: [
          { id: "ampla", rotulo: "A", sigla: "AC", ampla: true },
          {
            id: "quilombola",
            rotulo: "Q",
            sigla: "QUI",
            percentual: 2,
            cascata: ["indigena", "quilombola", "inexistente"],
          },
          { id: "indigena", rotulo: "I", sigla: "IND", percentual: 3 },
        ],
      });
      const quilombola = modelo.categorias.find((c) => c.id === "quilombola");
      expect(quilombola.cascata).toEqual(["indigena"]);
    });

    it("dá um modelo em branco utilizável, só com a ampla", () => {
      const modelo = modeloEmBranco();
      expect(modelo.categorias).toHaveLength(1);
      expect(modelo.categorias[0].ampla).toBe(true);
    });
  });
});

bloco("modulos/agenda-do-painel-de-entrevistas", () => {
  const armazenamento = () => ({
    ler: () => null,
    guardar: () => {},
    apagarTudo: () => {},
  });
  const item = (nome) => ({
    analise_id: "a1",
    nome,
    vaga: "V1",
    data: "2026-10-09",
    inicio: "09:00",
  });

  describe("respostas antigas da agenda do painel", () => {
    it.each(["troca de área", "reinício da sessão"])(
      "descarta a agenda após %s, inclusive com o mesmo edital",
      async (motivo) => {
        const respostas = [];
        const supabase = {
          rpc: vi.fn((nome) =>
            nome === "obter_agenda_entrevista"
              ? new Promise((resolver) => respostas.push(resolver))
              : Promise.resolve({ data: { entrevistas: [] }, error: null }),
          ),
        };
        const estado = criarEstadoDasEntrevistas({
          supabase,
          armazenamento: armazenamento(),
          avaliarMarcos: null,
        });
        await estado.carregar("saude-indigena");
        const antiga = estado.carregarAgenda("edital-1");
        if (motivo === "troca de área") await estado.carregar("sede");
        else estado.reiniciar();
        const atual = estado.carregarAgenda("edital-1");
        respostas[0]({
          data: { itens: [item("Usuário anterior")] },
          error: null,
        });
        expect(await antiga).toBeNull();
        expect(estado.obter().agenda.itens).toBeNull();
        respostas[1]({ data: { itens: [item("Agenda atual")] }, error: null });
        const itens = await atual;
        expect(itens[0].nome).toBe("Agenda atual");
        expect(await estado.carregarAgenda("edital-1")).toBe(itens);
        expect(
          supabase.rpc.mock.calls.filter(
            ([nome]) => nome === "obter_agenda_entrevista",
          ),
        ).toHaveLength(2);
      },
    );

    it("ignora também o erro de um pedido da sessão anterior", async () => {
      let responder;
      const supabase = {
        rpc: vi.fn(
          () =>
            new Promise((resolver) => {
              responder = resolver;
            }),
        ),
      };
      const estado = criarEstadoDasEntrevistas({
        supabase,
        armazenamento: armazenamento(),
        avaliarMarcos: null,
      });
      const antiga = estado.carregarAgenda("edital-1");
      estado.reiniciar();
      responder({ data: null, error: { code: "42501" } });
      expect(await antiga).toBeNull();
      expect(estado.obter().agenda).toEqual({
        editalId: "",
        itens: null,
        erro: "",
      });
    });
  });
});

bloco("modulos/carta-confirmacao-e-modelos", () => {
  const modelo = () =>
    lerModelosDoBanco({
      modelos: [
        {
          modelo_id: "m1",
          nome: "Carta",
          vigente: { titulo: "Carta", texto: "Olá {NOME}" },
        },
      ],
    }).modelos[0];
  describe("confirmação e dados da carta", () => {
    it("histórico malformado libera a carga e permite tentar novamente", async () => {
      const rpc = vi
        .fn()
        .mockResolvedValueOnce({ data: { cartas: [null] }, error: null })
        .mockResolvedValueOnce({
          data: { cartas: [{ carta_id: "c1" }] },
          error: null,
        });
      const estado = criarEstadoDaCarta({ supabase: { rpc } });
      await estado.carregarHistorico("a1");
      expect(estado.obter().historicos.get("a1")).toMatchObject({
        carregando: false,
        cartas: [],
        erro: expect.stringMatching(/Dados da carta inválidos/),
      });
      await estado.carregarHistorico("a1");
      expect(rpc).toHaveBeenCalledTimes(2);
      expect(estado.obter().historicos.get("a1")).toMatchObject({
        carregando: false,
        erro: "",
        cartas: [{ carta_id: "c1" }],
      });
    });
    it("confirmação incompleta bloqueia a saída e não repete o registro", async () => {
      const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
      const imprimir = vi.fn(),
        toast = vi.fn();
      const estado = criarEstadoDaCarta({
        supabase: { rpc },
        perfil: () => ({ role: "admin" }),
        areaAtual: () => "saude-indigena",
        imprimir,
        toast,
      });
      const pedido = {
        modelo: modelo(),
        candidatos: [{ candidato_id: "a1", nome: "Ana" }],
        emissao: {},
        saida: "PDF",
      };
      expect(await estado.emitir(pedido)).toBeNull();
      expect(await estado.emitir(pedido)).toBeNull();
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(imprimir).not.toHaveBeenCalled();
      expect(toast.mock.calls[0][0]).toMatch(/confirmação está incompleta/);
      expect(estado.obter().acao).toBeNull();
    });
    it("coleção malformada mostra erro e libera o carregamento", async () => {
      const estado = criarEstadoDaCarta({
        supabase: {
          rpc: async () => ({ data: { modelos: [null] }, error: null }),
        },
        areaAtual: () => "saude-indigena",
      });
      expect(await estado.carregarModelos()).toBe(false);
      expect(estado.obter()).toMatchObject({
        carregando: false,
        carregado: false,
        modelos: [],
      });
      expect(estado.obter().erro).toMatch(/Dados da carta inválidos/);
    });
  });
});

bloco("modulos/carta-de-convocacao-troca-de-area", () => {
  /*
  Trocar de área enquanto os modelos da carta carregavam descartava a
  resposta, mas deixava `carregando: true` publicado: a tela de modelos e o
  modal da carta ficavam no esqueleto para sempre.
*/
  function supabaseControlado() {
    const pendentes = [];
    return {
      pendentes,
      rpc: (nome, argumentos) =>
        new Promise((resolver) =>
          pendentes.push({ nome, argumentos, resolver }),
        ),
    };
  }

  const RESPOSTA = { data: { modelos: [], pode_editar: true }, error: null };

  describe("Carta de convocação: troca de área durante a carga", () => {
    it("descarta a resposta da área anterior sem ficar carregando", async () => {
      const supabase = supabaseControlado();
      let area = "saude-indigena";
      const estado = criarEstadoDaCarta({ supabase, areaAtual: () => area });
      const carga = estado.carregarModelos();
      expect(estado.obter().carregando).toBe(true);

      area = "projetos";
      supabase.pendentes[0].resolver(RESPOSTA);

      expect(await carga).toBe(false);
      expect(estado.obter().carregando).toBe(false);
      expect(estado.obter().carregado).toBe(false);
    });

    it("a carga antiga que termina depois não desliga a carga nova", async () => {
      const supabase = supabaseControlado();
      let area = "saude-indigena";
      const estado = criarEstadoDaCarta({ supabase, areaAtual: () => area });
      const antiga = estado.carregarModelos();
      area = "projetos";
      const nova = estado.carregarModelos();

      supabase.pendentes[0].resolver(RESPOSTA);
      await antiga;
      expect(estado.obter().carregando).toBe(true);

      supabase.pendentes[1].resolver(RESPOSTA);
      expect(await nova).toBe(true);
      expect(estado.obter()).toMatchObject({
        area: "projetos",
        carregando: false,
        carregado: true,
      });
    });
  });
});

bloco("modulos/conducao-gravacao-e-leitura", () => {
  /*
  Leituras e gravações da condução fora de ordem: a releitura do edital pedida
  antes de uma gravação chegava depois dela e devolvia à tela as notas
  antigas; a falha na leitura dos roteiros deixava a lista "não carregada" e
  a tela relia a cada desenho.
*/
  function supabaseControlado() {
    const pendentes = [];
    return {
      pendentes,
      rpc: (nome, argumentos) =>
        new Promise((resolver) =>
          pendentes.push({ nome, argumentos, resolver }),
        ),
    };
  }

  const responder = (pedido, data) => pedido.resolver({ data, error: null });
  const pedidos = (supabase, nome) =>
    supabase.pendentes.filter((p) => p.nome === nome);

  // Com a lista de convocação registrada, abrir o edital não pede o cálculo.
  const edital = (versao) => ({
    edital: { id: "m1" },
    pode_editar: true,
    lista_convocacao: { lista: { id: "lista1" } },
    convocados: [],
    versao,
  });

  describe("condução: gravação e leitura fora de ordem", () => {
    it("a releitura pedida antes da gravação não sobrescreve o payload gravado", async () => {
      const supabase = supabaseControlado();
      const conducao = criarEstadoDaConducao({
        supabase,
        toast: () => {},
        tempoLimiteMs: 10_000,
      });
      const abrir = conducao.abrirEdital("m1");
      responder(pedidos(supabase, "obter_entrevistas_do_edital")[0], edital(1));
      responder(pedidos(supabase, "obter_previsao_entrevista_edital")[0], {
        situacao: "NAO_INFORMADA",
        motivo: null,
        pode_alterar: false,
      });
      responder(pedidos(supabase, "obter_agenda_entrevista")[0], null);
      await abrir;

      const releitura = conducao.recarregarEdital();
      const gravacao = conducao.lancarNotas("e1", { notas: [] });
      responder(pedidos(supabase, "lancar_notas_entrevista")[0], edital(3));
      await gravacao;
      expect(conducao.obter().edital.versao).toBe(3);

      responder(pedidos(supabase, "obter_entrevistas_do_edital")[1], edital(2));
      responder(pedidos(supabase, "obter_previsao_entrevista_edital")[1], {
        situacao: "NAO_INFORMADA",
        motivo: null,
        pode_alterar: false,
      });
      responder(pedidos(supabase, "obter_agenda_entrevista")[1], null);
      await releitura;
      expect(conducao.obter().edital.versao).toBe(3);
      expect(conducao.obter().carregandoEdital).toBe(false);
    });

    it("falha nos roteiros: fica carregado com o erro (não relê sozinha)", async () => {
      const supabase = supabaseControlado();
      const conducao = criarEstadoDaConducao({
        supabase,
        tempoLimiteMs: 10_000,
      });
      const carga = conducao.carregarRoteiros("sede");
      pedidos(supabase, "listar_roteiros_entrevista")[0].resolver({
        data: null,
        error: { code: "XX000", message: "falhou" },
      });
      await carga;
      const { roteiros } = conducao.obter();
      expect(roteiros.carregando).toBe(false);
      expect(roteiros.carregado).toBe(true);
      expect(roteiros.erro).not.toBe("");
    });
  });
});

bloco("modulos/conducao-gravacao-obsoleta", () => {
  function servidor() {
    const pendentes = [];
    let aoMudarSessao;
    return {
      pendentes,
      rpc: (nome) =>
        new Promise((resolver) => pendentes.push({ nome, resolver })),
      auth: {
        onAuthStateChange: (ouvinte) => {
          aoMudarSessao = ouvinte;
        },
      },
      sessao: (id) => aoMudarSessao("SIGNED_IN", id ? { user: { id } } : null),
    };
  }
  const payload = (versao) => ({
    edital: { id: "e1" },
    pode_editar: true,
    lista_convocacao: { lista: { id: "l1" } },
    versao,
    convocados: [],
    avaliadores: [],
  });
  const responder = (pedido, dados) =>
    pedido.resolver({ data: dados, error: null });
  async function abrir(estado, supabase, versao) {
    const posicao = supabase.pendentes.length;
    const abertura = estado.abrirEdital("e1");
    responder(supabase.pendentes[posicao], payload(versao));
    responder(supabase.pendentes[posicao + 1], {
      situacao: "NAO_INFORMADA",
      motivo: null,
      pode_alterar: false,
    });
    responder(supabase.pendentes[posicao + 2], null);
    await abertura;
  }

  describe("gravações antigas de Conduzir entrevistas", () => {
    it("trocar área protege o mesmo edital e a gravação nova de uma resposta antiga", async () => {
      const supabase = servidor(),
        toast = vi.fn(),
        aoMudarResultados = vi.fn();
      const estado = criarEstadoDaConducao({
        supabase,
        toast,
        aoMudarResultados,
        tempoLimiteMs: 10_000,
      });
      estado.trocarArea("sede");
      await abrir(estado, supabase, 1);
      const antiga = estado.lancarNotas("i1", { notas: [] });
      const pedidoAntigo = supabase.pendentes.at(-1);
      estado.trocarArea("projetos");
      await abrir(estado, supabase, 2);
      const nova = estado.lancarNotas("i1", { notas: [] });
      const pedidoNovo = supabase.pendentes.at(-1);
      responder(pedidoAntigo, payload(10));
      expect((await antiga).ok).not.toBe(true);
      expect(estado.obter().edital.versao).toBe(2);
      expect(estado.obter().acao.tipo).toBe("notas");
      expect(toast).not.toHaveBeenCalled();
      expect(aoMudarResultados).not.toHaveBeenCalled();
      responder(pedidoNovo, payload(3));
      expect((await nova).ok).toBe(true);
      expect(estado.obter().edital.versao).toBe(3);
      expect(estado.obter().acao).toBeNull();
      expect(aoMudarResultados).toHaveBeenCalledTimes(1);
    });
    it("a falha de uma gravação da sessão anterior não afeta a pessoa que entrou", async () => {
      const supabase = servidor(),
        toast = vi.fn(),
        aoMudarResultados = vi.fn();
      const estado = criarEstadoDaConducao({
        supabase,
        toast,
        aoMudarResultados,
        tempoLimiteMs: 10_000,
      });
      supabase.sessao("pessoa-1");
      estado.trocarArea("sede");
      await abrir(estado, supabase, 1);
      const antiga = estado.lancarNotas("i1", { notas: [] });
      const pedido = supabase.pendentes.at(-1);
      supabase.sessao(null);
      supabase.sessao("pessoa-2");
      estado.trocarArea("sede");
      await abrir(estado, supabase, 2);
      pedido.resolver({
        data: null,
        error: { code: "42501", message: "acesso antigo" },
      });
      expect((await antiga).ok).not.toBe(true);
      expect(estado.obter().edital.versao).toBe(2);
      expect(estado.obter().podeEditar).toBe(true);
      expect(toast).not.toHaveBeenCalled();
      expect(aoMudarResultados).not.toHaveBeenCalled();
    });
  });
});

bloco("modulos/conducao-leituras-opcionais", () => {
  /*
  Leituras opcionais da condução (agenda, configuração e modelos da
  convocação): sem a migration ou sem acesso, segue sem elas; outra falha
  aparece. Antes, `.catch(() => null)` engolia qualquer erro — a agenda que
  caiu por rede virava "sem agenda" e a convocação era calculada sem a
  configuração, calada.
*/

  const EDITAL_COM_LISTA = {
    edital: { id: "m1" },
    pode_editar: true,
    lista_convocacao: { lista: { id: "lista1" } },
    convocados: [],
  };
  const EDITAL_SEM_LISTA = { ...EDITAL_COM_LISTA, lista_convocacao: null };

  function supabaseCom(respostas) {
    return {
      rpc: vi.fn(async (nome) => {
        if (nome === "obter_previsao_entrevista_edital")
          return {
            data: {
              situacao: "NAO_INFORMADA",
              motivo: null,
              pode_alterar: false,
            },
            error: null,
          };
        return respostas[nome]
          ? respostas[nome]()
          : { data: null, error: null };
      }),
    };
  }

  describe("leituras opcionais da condução", () => {
    it("sem a função ou sem acesso: nulo; outra falha passa adiante", async () => {
      await expect(
        opcionalDaConducao(Promise.reject({ code: "PGRST202" })),
      ).resolves.toBeNull();
      await expect(
        opcionalDaConducao(Promise.reject({ code: "42501" })),
      ).resolves.toBeNull();
      await expect(
        opcionalDaConducao(Promise.reject({ message: "Failed to fetch" })),
      ).rejects.toEqual({ message: "Failed to fetch" });
    });

    it("agenda que falhou por rede: o edital abre e a falha é avisada", async () => {
      const toast = vi.fn();
      const conducao = criarEstadoDaConducao({
        supabase: supabaseCom({
          obter_entrevistas_do_edital: () => ({
            data: EDITAL_COM_LISTA,
            error: null,
          }),
          obter_agenda_entrevista: () => ({
            data: null,
            error: { message: "tempo esgotado", code: "57014" },
          }),
        }),
        toast,
      });
      await expect(conducao.abrirEdital("m1")).resolves.toBe(true);
      expect(conducao.obter().agenda).toBeNull();
      expect(toast).toHaveBeenCalledWith(
        expect.stringContaining("Não foi possível carregar a agenda"),
        "warn",
      );
    });

    it("agenda sem a migration: segue calada, como sempre", async () => {
      const toast = vi.fn();
      const conducao = criarEstadoDaConducao({
        supabase: supabaseCom({
          obter_entrevistas_do_edital: () => ({
            data: EDITAL_COM_LISTA,
            error: null,
          }),
          obter_agenda_entrevista: () => ({
            data: null,
            error: { message: "não existe", code: "PGRST202" },
          }),
        }),
        toast,
      });
      await conducao.abrirEdital("m1");
      expect(toast).not.toHaveBeenCalled();
    });

    it("configuração da convocação que falhou vira erro do cálculo, não ordem calada", async () => {
      const conducao = criarEstadoDaConducao({
        supabase: supabaseCom({
          obter_entrevistas_do_edital: () => ({
            data: EDITAL_SEM_LISTA,
            error: null,
          }),
          obter_classificacao_do_edital: () => ({
            data: { regra: { versao: 1 } },
            error: null,
          }),
          listar_configuracao_convocacao: () => ({
            data: null,
            error: { message: "falha no banco", code: "XX000" },
          }),
          listar_modelos_convocacao: () => ({ data: [], error: null }),
        }),
        toast: () => {},
      });
      await conducao.abrirEdital("m1");
      expect(conducao.obter().calculo).toEqual({
        erro: expect.any(String),
      });
    });
  });
});

bloco("modulos/conducao-troca-de-area", () => {
  /*
  Trocar de área com a lista ainda carregando: a resposta da área antiga
  chegava depois e a tela da área nova mostrava editais/roteiros da anterior.
*/
  function supabaseControlado() {
    const pendentes = [];
    return {
      pendentes,
      rpc: (nome, argumentos) =>
        new Promise((resolver) =>
          pendentes.push({ nome, argumentos, resolver }),
        ),
    };
  }

  const responder = (pedido, data) => pedido.resolver({ data, error: null });

  describe("condução: troca de área com carga em andamento", () => {
    it("a lista de roteiros da área antiga não cai sobre a nova", async () => {
      const supabase = supabaseControlado();
      const conducao = criarEstadoDaConducao({
        supabase,
        tempoLimiteMs: 10_000,
      });
      const antiga = conducao.carregarRoteiros("sede");
      const nova = conducao.carregarRoteiros("projetos");
      responder(supabase.pendentes[1], [{ id: "r-projetos" }]);
      await nova;
      responder(supabase.pendentes[0], [{ id: "r-sede" }]);
      await antiga;
      expect(conducao.obter().area).toBe("projetos");
      expect(conducao.obter().roteiros.lista).toEqual([{ id: "r-projetos" }]);
    });

    it("a lista de editais da área antiga não cai sobre a nova", async () => {
      const supabase = supabaseControlado();
      const conducao = criarEstadoDaConducao({
        supabase,
        tempoLimiteMs: 10_000,
      });
      const antiga = conducao.carregarEditais("sede");
      const nova = conducao.carregarEditais("projetos");
      responder(supabase.pendentes[0], {
        admin_global: false,
        editais: [{ id: "e-sede", edital: "01/2026" }],
      });
      await antiga;
      expect(conducao.obter().editais.carregando).toBe(true);
      responder(supabase.pendentes[1], { admin_global: false, editais: [] });
      await nova;
      expect(conducao.obter().area).toBe("projetos");
      expect(conducao.obter().editais.lista).toEqual([]);
    });
  });
});

bloco("modulos/data-no-nome-da-exportacao", () => {
  /*
  O nome da planilha exportada leva o dia de Brasília. Com toISOString o dia era o de UTC:
  quem exportava depois das 21h recebia o arquivo com a data de amanhã.
*/
  const NOITE_EM_BRASILIA = () => Date.parse("2026-10-01T22:30:00-03:00");

  const casos = [
    [
      "entrevistas",
      criarEstadoDasEntrevistas,
      /^entrevistas-(.*-)?2026-10-01\.xlsx$/,
    ],
    ["recursos", criarEstadoDosRecursos, /^recursos-(.*-)?2026-10-01\.xlsx$/],
    ["seleção", criarEstadoDaSelecao, /^selecao-(.*-)?2026-10-01\.xlsx$/],
  ];

  describe("data no nome da planilha exportada", () => {
    it.each(casos)(
      "%s: o dia é o de Brasília, não o de UTC",
      async (_, criar, nome) => {
        const baixar = vi.fn();
        const estado = criar({ baixar, agora: NOITE_EM_BRASILIA });
        await estado.exportar("excel", [], []);
        expect(baixar).toHaveBeenCalledTimes(1);
        expect(baixar.mock.calls[0][1]).toMatch(nome);
      },
    );
  });
});

bloco("ordem-dos-aprovados", () => {
  /* A ordem da tabela da aba Aprovados, pelo cabeçalho. */

  const linhas = [
    {
      candidato_id: "1",
      nome: "Érica",
      classificacao: 10,
      nota: "7,5",
      status: "Convocado",
    },
    { candidato_id: "2", nome: "ana", classificacao: 2, nota: 9, status: "" },
    {
      candidato_id: "3",
      nome: "Bruno",
      classificacao: null,
      nota: null,
      status: "Contratado",
    },
    {
      candidato_id: "4",
      nome: "Carla",
      classificacao: 1,
      nota: 8,
      status: "Contratado",
      contratacao_situacao: "OUTRA_LISTA",
    },
  ];
  const ids = (lista) => lista.map((l) => l.candidato_id);

  describe("ordenarAprovados", () => {
    it("sem ordem devolve a própria lista", () => {
      expect(ordenarAprovados(linhas, SEM_ORDEM)).toBe(linhas);
    });

    it("texto em pt-BR, sem caixa nem acento", () => {
      expect(
        ids(ordenarAprovados(linhas, { chave: "nome", sentido: "asc" })),
      ).toEqual(["2", "3", "4", "1"]);
      expect(
        ids(ordenarAprovados(linhas, { chave: "nome", sentido: "desc" })),
      ).toEqual(["1", "4", "3", "2"]);
    });

    it("número como número (10 depois de 2) e nota com vírgula; vazio no fim nos dois sentidos", () => {
      expect(
        ids(
          ordenarAprovados(linhas, { chave: "classificacao", sentido: "asc" }),
        ),
      ).toEqual(["4", "2", "1", "3"]);
      expect(
        ids(
          ordenarAprovados(linhas, { chave: "classificacao", sentido: "desc" }),
        ),
      ).toEqual(["1", "2", "4", "3"]);
      expect(
        ids(ordenarAprovados(linhas, { chave: "nota", sentido: "asc" })),
      ).toEqual(["1", "4", "2", "3"]);
    });

    it("situação como o selo a mostra (espelho da outra lista tem rótulo próprio)", () => {
      expect(
        ids(ordenarAprovados(linhas, { chave: "situacao", sentido: "asc" })),
      ).toEqual(["3", "4", "1", "2"]);
    });

    it("não muda a lista recebida", () => {
      const copia = [...linhas];
      ordenarAprovados(linhas, { chave: "nome", sentido: "asc" });
      expect(linhas).toEqual(copia);
    });
  });

  describe("proximaOrdemDosAprovados", () => {
    it("asc → desc → sem ordem; outra coluna recomeça em asc", () => {
      const a = proximaOrdemDosAprovados(SEM_ORDEM, "nome");
      expect(a).toEqual({ chave: "nome", sentido: "asc" });
      const b = proximaOrdemDosAprovados(a, "nome");
      expect(b).toEqual({ chave: "nome", sentido: "desc" });
      expect(proximaOrdemDosAprovados(b, "nome")).toEqual(SEM_ORDEM);
      expect(proximaOrdemDosAprovados(b, "nota")).toEqual({
        chave: "nota",
        sentido: "asc",
      });
    });
  });
});

bloco("painel-e-conducao-de-entrevistas", () => {
  /*
  O painel (acompanhar) e Conduzir entrevistas (fazer), sem React: a fila do
  dia (situações, recortes, contador), o edital do recorte, os
  empates na nota da entrevista, a agenda dos próximos dias, as pendências de
  andamento, o desempate da Classificação e os links antigos.
*/

  const HOJE = "2026-10-07";

  it("IDs externos inválidos não viram destinos da agenda ou do desempate", () => {
    const entrevistas = [
      {
        id: "e1",
        edital: "93/2026",
        edital_id: { id: "externo" },
        vaga: "V1",
        nota: 12,
        compareceu: "S",
      },
      {
        id: "e2",
        edital: "93/2026",
        edital_id: 7,
        vaga: "V1",
        nota: 12,
        compareceu: "S",
      },
    ];
    expect(editalDoRecorte(entrevistas, "").editalId).toBeNull();
    expect(gruposEmpatados(entrevistas)[0].editalId).toBeNull();
    entrevistas[1].edital_id = "edital-real";
    expect(editalDoRecorte(entrevistas, "").editalId).toBe("edital-real");
  });
  const comp = [{ id: "c1" }, { id: "c2" }];
  const avaliadores = [
    { id: "a1", banca: 1, ativo: true },
    { id: "a2", banca: 1, ativo: true },
  ];
  const nota = (competencia, avaliador, valor = 3) => ({
    competencia,
    avaliador,
    nota: valor,
  });
  const todas = ["c1", "c2"].flatMap((c) => [nota(c, "a1"), nota(c, "a2")]);

  const convocados = [
    {
      id: "e1",
      analise_id: "an1",
      candidato: "Ana Lúcia Terena",
      vaga: "V1",
      banca: 1,
      compareceu: null,
      parecer: "SEM_PARECER",
      avaliacoes: [],
    },
    {
      id: "e2",
      analise_id: "an2",
      candidato: "Bruno",
      vaga: "V2",
      banca: 1,
      compareceu: "S",
      parecer: "SEM_PARECER",
      avaliacoes: [nota("c1", "a1")],
    },
    {
      id: "e3",
      analise_id: "an3",
      candidato: "Carla da Silva",
      vaga: "V1",
      banca: 1,
      compareceu: "S",
      parecer: "APTO",
      avaliacoes: todas,
      concluida_em: "2026-10-07T13:00:00Z",
    },
    {
      id: "e4",
      analise_id: "an4",
      candidato: "Diego",
      vaga: "V2",
      banca: 1,
      compareceu: "N",
      parecer: "INAPTO",
      avaliacoes: [],
    },
    {
      id: "e5",
      analise_id: "an5",
      candidato: "Eva",
      vaga: "V1",
      banca: 1,
      compareceu: null,
      parecer: "SEM_PARECER",
      avaliacoes: [],
    },
    {
      id: "e6",
      analise_id: null,
      candidato: "Fábio",
      vaga: "V3",
      banca: null,
      compareceu: null,
      parecer: "SEM_PARECER",
      avaliacoes: [],
    },
  ];
  const agenda = {
    itens: [
      {
        analise_id: "an2",
        data: HOJE,
        inicio: "09:00:00",
        fim: "09:30",
        banca: 1,
      },
      {
        analise_id: "an1",
        data: HOJE,
        inicio: "08:00",
        fim: "08:30",
        banca: 1,
      },
      {
        analise_id: "an3",
        data: HOJE,
        inicio: "10:00",
        fim: "10:30",
        banca: 2,
      },
      {
        analise_id: "an4",
        data: HOJE,
        inicio: "11:00",
        fim: "11:30",
        banca: 1,
      },
      {
        analise_id: "an5",
        data: "2026-10-08",
        inicio: "08:00",
        fim: "08:30",
        banca: 1,
      },
    ],
  };
  const dados = {
    convocados,
    avaliadores,
    configuracao: { roteiro: { competencias: comp } },
  };

  describe("fila de Conduzir entrevistas", () => {
    const fila = montarFila(dados, agenda);

    it("junta a agenda, ordena por dia e horário (sem horário no fim) e dá a situação de cada um", () => {
      expect(fila.map((i) => [i.id, i.inicio, i.situacao])).toEqual([
        ["e1", "08:00", "aguardando"],
        ["e2", "09:00", "em_andamento"],
        ["e3", "10:00", "concluida"],
        ["e4", "11:00", "faltou"],
        ["e5", "08:00", "aguardando"],
        ["e6", null, "aguardando"],
      ]);
      expect(fila.find((i) => i.id === "e3")).toMatchObject({
        banca: 2,
        lancadas: 4,
        esperadas: 4,
      });
    });

    it("todas as notas lançadas (mesmo sem parecer) fica A concluir até concluir; aspectos contam o par uma vez", () => {
      const comAspectos = {
        ...convocados[1],
        avaliacoes: [...todas, { ...nota("c1", "a1"), aspecto: "x" }],
      };
      const p = progressoDoConvocado(comAspectos, avaliadores, comp);
      expect(p).toEqual({ lancadas: 4, esperadas: 4 });
      expect(situacaoDoConvocado(comAspectos, p)).toBe("a_concluir");
      expect(
        situacaoDoConvocado(
          { ...comAspectos, concluida_em: "2026-10-07T13:00:00Z" },
          p,
        ),
      ).toBe("concluida");
    });

    it("parecer sem conclusão: A concluir, que não conta como feita nem vira Sem nota", () => {
      const pronta = { ...convocados[2], concluida_em: null };
      const p = progressoDoConvocado(pronta, avaliadores, comp);
      expect(situacaoDoConvocado(pronta, p)).toBe("a_concluir");
      const item = { situacao: "a_concluir", data: "2026-10-01" };
      expect(situacaoNaTela(item, HOJE)).toBe("a_concluir");
      expect(contadorDoDia([{ ...item, data: HOJE }], HOJE).feitas).toBe(0);
      // Faltou continua Faltou (com ou sem conclusão).
      expect(
        situacaoDoConvocado(
          { ...convocados[3], concluida_em: "2026-10-07T13:00:00Z" },
          { lancadas: 0, esperadas: 4 },
        ),
      ).toBe("faltou");
    });

    it("recortes Hoje / Próximos / Todos, vaga e o recorte inicial", () => {
      expect(contagemDosRecortes(fila, HOJE)).toEqual({
        hoje: 4,
        proximos: 1,
        todos: 6,
      });
      expect(recorteInicial(fila, HOJE)).toBe("hoje");
      expect(recorteInicial(fila, "2026-10-08")).toBe("hoje");
      expect(recorteInicial(fila, "2026-10-01")).toBe("proximos");
      expect(recorteInicial(montarFila(dados, null), HOJE)).toBe("todos");
      expect(
        recortarFila(fila, { recorte: "hoje", vaga: "V2", hoje: HOJE }).map(
          (i) => i.id,
        ),
      ).toEqual(["e2", "e4"]);
      expect(
        recortarFila(fila, { recorte: "proximos", hoje: HOJE }).map(
          (i) => i.id,
        ),
      ).toEqual(["e5"]);
      expect(vagasDaFila(fila)).toEqual(["V1", "V2", "V3"]);
    });

    it("contador do dia: concluídas e faltas entre as de hoje; completo só com todas", () => {
      expect(contadorDoDia(fila, HOJE)).toEqual({
        feitas: 2,
        total: 4,
        completo: false,
      });
      const feitas = montarFila(
        {
          ...dados,
          convocados: convocados.map((c) =>
            c.id === "e1" || c.id === "e2" ? { ...c, compareceu: "N" } : c,
          ),
        },
        agenda,
      );
      expect(contadorDoDia(feitas, HOJE)).toEqual({
        feitas: 4,
        total: 4,
        completo: true,
      });
      expect(contadorDoDia(fila, "2026-10-01").completo).toBe(false);
      expect(resumoDasSituacoes(fila, HOJE)).toEqual({
        aguardando: 3,
        em_andamento: 1,
        a_concluir: 0,
        concluida: 1,
        faltou: 1,
        sem_nota: 0,
      });
      // Sem nota: aguardando ou em andamento depois do dia marcado.
      const depois = "2026-10-20";
      expect(fila.map((i) => situacaoNaTela(i, depois))).toEqual(
        fila.map((i) =>
          i.data &&
          (i.situacao === "aguardando" || i.situacao === "em_andamento")
            ? "sem_nota"
            : i.situacao,
        ),
      );
      expect(resumoDasSituacoes(fila, depois).sem_nota).toBeGreaterThan(0);
    });

    it("a próxima do dia: a primeira que aguarda a partir de agora", () => {
      const deHoje = fila.filter(
        (i) => i.data === HOJE && i.situacao === "aguardando",
      );
      expect(proximaDoDia(fila, HOJE, "00:00")).toBe(deHoje[0]);
      // Depois da última: a primeira que ainda aguarda hoje.
      expect(proximaDoDia(fila, HOJE, "23:59")).toBe(deHoje[0] ?? null);
      expect(proximaDoDia(fila, "2000-01-01", "08:00")).toBeNull();
      expect(horaEmBrasilia(new Date("2026-10-07T13:05:00Z"))).toBe("10:05");
    });

    it("o rótulo do dia", () => {
      expect(rotuloDoDia(HOJE, HOJE)).toBe("Hoje");
      expect(rotuloDoDia("2026-10-08", HOJE)).toBe("Amanhã");
      expect(rotuloDoDia("2026-10-09", HOJE)).toBe("sex., 09/10");
      expect(rotuloDoDia(null, HOJE)).toBe("Sem horário");
    });
  });

  const doPainel = (extra) => ({
    id: extra.id,
    edital_id: "m1",
    edital: "100/2026",
    unidade: "DSEI Xingu",
    vaga: "V1",
    cargo: "Enfermeiro",
    candidato: extra.id,
    nota: null,
    parecer: "SEM_PARECER",
    compareceu: null,
    ...extra,
  });
  const painel = [
    doPainel({ id: "p1", compareceu: "S", nota: 12, parecer: "APTO" }),
    doPainel({ id: "p2", compareceu: "S", nota: 12, parecer: "APTO" }),
    doPainel({ id: "p3", compareceu: "S", nota: 4, parecer: "INAPTO" }),
    doPainel({ id: "p4", compareceu: "N", parecer: "INAPTO" }),
    doPainel({ id: "p5", compareceu: "S" }),
    doPainel({ id: "p6", compareceu: "S", nota: 8 }),
    doPainel({
      id: "p7",
      vaga: "V2",
      compareceu: "S",
      nota: 12,
      parecer: "APTO",
    }),
    doPainel({
      id: "p8",
      edital: "83/2026",
      edital_id: "m2",
      vaga: "V1",
      compareceu: "S",
      nota: 12,
      parecer: "APTO",
    }),
  ];

  describe("Painel de entrevistas", () => {
    it("edital do recorte: o filtrado ou, havendo um só, ele", () => {
      expect(editalDoRecorte(painel, "100/2026")).toEqual({
        edital: "100/2026",
        editalId: "m1",
      });
      expect(editalDoRecorte(painel, "")).toBeNull();
      expect(
        editalDoRecorte(
          painel.filter((e) => e.edital === "83/2026"),
          "",
        ),
      ).toEqual({ edital: "83/2026", editalId: "m2" });
      expect(editalDoRecorte(painel, "999/2026")).toBeNull();
    });

    it("empate: mesma nota no mesmo edital e na mesma vaga, só de quem compareceu", () => {
      const grupos = gruposEmpatados(painel);
      expect(grupos).toHaveLength(1);
      expect(grupos[0]).toMatchObject({
        edital: "100/2026",
        editalId: "m1",
        vaga: "V1",
        nota: 12,
        ids: ["p1", "p2"],
      });
      expect([...mapaDeEmpates(grupos)]).toEqual([
        ["p1", 2],
        ["p2", 2],
      ]);
    });

    it("agenda dos próximos dias: de hoje em diante, por horário, até N dias", () => {
      const dias = proximosDiasDaAgenda(
        [
          { analise_id: "x", data: "2026-10-06", inicio: "08:00" },
          { analise_id: "b", data: HOJE, inicio: "10:00" },
          { analise_id: "a", data: HOJE, inicio: "08:00" },
          { analise_id: "c", data: "2026-10-09", inicio: "08:00" },
          { analise_id: "d", data: null, inicio: null },
        ],
        HOJE,
        1,
      );
      expect(dias).toEqual([
        {
          data: HOJE,
          itens: [
            { analise_id: "a", data: HOJE, inicio: "08:00" },
            { analise_id: "b", data: HOJE, inicio: "10:00" },
          ],
        },
      ]);
    });

    it("pendências de andamento e o filtro: sem comparecimento, sem nota, sem parecer", () => {
      const normal = (e) => ({
        ...e,
        divergente: false,
        semEdital: false,
        analise: {},
        busca: "",
      });
      const lista = painel.map(normal);
      expect(lista.map(andamentoDaEntrevista)).toEqual([
        "",
        "",
        "",
        "",
        "sem_nota",
        "sem_parecer",
        "",
        "",
      ]);
      const semCompareceu = normal(doPainel({ id: "p9" }));
      expect(andamentoDaEntrevista(semCompareceu)).toBe("sem_comparecimento");
      const p = Object.fromEntries(
        pendenciasDasEntrevistas([...lista, semCompareceu], []).map((x) => [
          x.chave,
          [x.valor, x.campo],
        ]),
      );
      expect(p.sem_comparecimento).toEqual([1, "andamento"]);
      expect(p.sem_nota).toEqual([1, "andamento"]);
      expect(p.sem_parecer).toEqual([1, "andamento"]);
      expect(
        filtrarEntrevistas(lista, {
          ...FILTROS_VAZIOS,
          andamento: "sem_nota",
        }).map((e) => e.id),
      ).toEqual(["p5"]);
      expect(
        filtrarEntrevistas(lista, { ...FILTROS_VAZIOS, vaga: "V2" }).map(
          (e) => e.id,
        ),
      ).toEqual(["p7"]);
    });
  });

  describe("desempate da entrevista é o da Classificação", () => {
    it("critérios do catálogo, na ordem, com o empate final", () => {
      const regra = {
        desempate: [
          { criterio: "NOTA_ENTREVISTA", direcao: "MAIOR_PRIMEIRO" },
          { criterio: "IDOSO_60" },
          { criterio: "INVENTADO" },
        ],
        empate_final: { metodo: "SORTEIO" },
      };
      expect(criteriosDeDesempate(regra).map((c) => c.codigo)).toEqual([
        "NOTA_ENTREVISTA",
        "IDOSO_60",
      ]);
      expect(criteriosDeDesempate(regra)[1].nome).toBe(
        "60 anos ou mais na data de corte",
      );
      expect(textoDoEmpateFinal(regra)).toBe("Sorteio registrado");
      // Banco antigo (sem a chave) ou sem regra: nada a mostrar.
      expect(criteriosDeDesempate({ convocacao: {} })).toBeNull();
      expect(criteriosDeDesempate(null)).toBeNull();
      expect(textoDoEmpateFinal(null)).toBe("");
    });
  });

  describe("menu e links antigos", () => {
    it("links antigos da tela de Entrevistas vão para o lugar novo", () => {
      expect(destinoDaTela("entrevistas:conduzir")).toEqual({
        view: "conduzir-entrevistas",
        visao: "fila",
      });
      expect(destinoDaTela("entrevistas:roteiros")).toEqual({
        view: "conduzir-entrevistas",
        visao: "preparar",
      });
      expect(destinoDaTela("entrevistas:resultados")).toEqual({
        view: "entrevistas",
        visao: "",
      });
      expect(destinoDaTela(" entrevistas ")).toEqual({
        view: "entrevistas",
        visao: "",
      });
    });

    it("quem acessa Entrevistas acessa o painel e Conduzir; sem o recurso, nenhum", () => {
      const perfil = (nivel) => ({
        perfil: "analista",
        permissoes: { entrevistas: nivel },
      });
      expect(paginasPermitidas(perfil("leitor"))).toMatchObject({
        entrevistas: true,
        "conduzir-entrevistas": true,
      });
      expect(paginasPermitidas(perfil("sem_acesso"))).toMatchObject({
        entrevistas: false,
        "conduzir-entrevistas": false,
      });
      expect(bloqueioDaTela("conduzir-entrevistas", perfil("leitor"))).toBe("");
      expect(bloqueioDaTela("conduzir-entrevistas", perfil("sem_acesso"))).toBe(
        "Sem permissão para Entrevistas.",
      );
    });
  });
});

bloco("preparar-e-fila-de-entrevistas", () => {
  /*
  Entrevistas mais claras: a busca e a ordem da fila, os passos de Preparar (com o que falta), a lista do que
  falta no editor do roteiro, as frases da eliminação e o parecer em texto
  pronto da ficha.
*/

  const HOJE = "2026-10-07";

  const convocado = (n, extra = {}) => ({
    id: `e${n}`,
    analise_id: `an${n}`,
    candidato: `Pessoa ${n}`,
    codigo: `K${n}`,
    vaga: "V1",
    cargo: "Enfermeiro",
    avaliacoes: [],
    ...extra,
  });

  describe("fila: busca, vaga e ordem", () => {
    const dados = {
      convocados: [
        convocado(1, { candidato: "Zé Ninguém", vaga: "V2", cargo: "Técnico" }),
        convocado(2, { candidato: "Ana Íris" }),
        convocado(3, { candidato: "Bruna Lima", codigo: "43015" }),
        convocado(4, { candidato: "Carlos", vaga: "" }),
      ],
      avaliadores: [],
    };
    const agenda = {
      itens: [
        { analise_id: "an3", data: HOJE, inicio: "09:00", banca: 1 },
        { analise_id: "an2", data: HOJE, inicio: "09:00", banca: 2 },
        { analise_id: "an1", data: HOJE, inicio: "08:00", banca: 1 },
      ],
    };
    const fila = montarFila(dados, agenda);

    it("ordena por horário e depois pelo nome (sem desempatar pela banca)", () => {
      expect(fila.map((i) => i.nome)).toEqual([
        "Zé Ninguém",
        "Ana Íris",
        "Bruna Lima",
        "Carlos",
      ]);
    });

    it("busca por nome (sem acento) ou código, palavra por palavra", () => {
      expect(buscarNaFila(fila, "ana iris").map((i) => i.id)).toEqual(["e2"]);
      expect(buscarNaFila(fila, "43015").map((i) => i.id)).toEqual(["e3"]);
      expect(buscarNaFila(fila, "v2").map((i) => i.id)).toEqual(["e1"]);
      expect(buscarNaFila(fila, "  ")).toHaveLength(4);
      expect(buscarNaFila(fila, "ninguém lima")).toEqual([]);
    });
  });

  describe("passos de Preparar", () => {
    const base = {
      roteiro: { nome: "Roteiro", rotuloDaVersao: "v2" },
      membros: 2,
      bancas: 1,
      errosDaBanca: [],
      convocacao: { temLista: true, naLista: 2, naFicha: 2, aConvocar: 0 },
      agenda: { comHorario: 2, convocados: 2 },
    };

    it("tudo pronto: quatro passos feitos, com o resumo de cada um", () => {
      const passos = passosDoPreparar(base);
      expect(passos.map((p) => [p.id, p.estado, p.resumo])).toEqual([
        ["roteiro", "feito", "Roteiro · v2"],
        ["banca", "feito", "2 membros em 1 banca"],
        ["convocacao", "feito", "2 convocados"],
        ["agenda", "feito", "2 horários"],
      ]);
      expect(textoDoAndamento(passos)).toBe("4 de 4 passos prontos");
      expect(passoInicial(passos)).toBe(0);
    });

    it("diz o que falta em cada passo e abre no primeiro pendente", () => {
      const passos = passosDoPreparar({
        ...base,
        roteiro: null,
        membros: 0,
        bancas: 0,
        errosDaBanca: ["Banca 1: ninguém avalia “Escuta”."],
        convocacao: { temLista: false, naLista: 0, naFicha: 0, aConvocar: 0 },
        agenda: { comHorario: 0, convocados: 0 },
      });
      expect(passos.map((p) => p.falta)).toEqual([
        ["Escolha o roteiro da entrevista."],
        ["Cadastre os membros da banca.", "Banca 1: ninguém avalia “Escuta”."],
        ["Gere a lista de convocação na Classificação."],
        ["Convoque os candidatos antes de montar a agenda."],
      ]);
      expect(textoDoAndamento(passos)).toBe("0 de 4 passos prontos");
      expect(passoInicial(passos)).toBe(0);
    });

    it("convocação e agenda pela metade", () => {
      const passos = passosDoPreparar({
        ...base,
        convocacao: { temLista: true, naLista: 5, naFicha: 2, aConvocar: 3 },
        agenda: { comHorario: 1, convocados: 2 },
      });
      expect(passos[2].falta).toEqual([
        "3 candidatos da lista ainda não foram convocados.",
      ]);
      expect(passos[3].falta).toEqual(["1 convocado ainda está sem horário."]);
      expect(passoInicial(passos)).toBe(2);
      expect(
        passosDoPreparar({
          ...base,
          convocacao: { temLista: true, naLista: 2, naFicha: 0, aConvocar: 2 },
        })[2].falta,
      ).toEqual(["Convoque os 2 candidatos da lista."]);
    });

    it("o que falta para salvar a configuração, com o membro pelo nome", () => {
      expect(
        pendenciasDaConfiguracao(
          {
            roteiro: "Escolha o roteiro da entrevista.",
            "avaliador.k2.origem": "Origem: de 2 a 80 caracteres.",
            "banca.b1.quantidade": "Quantidade: número inteiro de 1 a 20.",
            cobertura: "Banca 1: ninguém avalia “Escuta”.",
          },
          [
            { chave: "k1", nome: "Ana" },
            { chave: "k2", nome: "Beto" },
          ],
        ),
      ).toEqual([
        {
          chave: "roteiro",
          passo: "roteiro",
          texto: "Escolha o roteiro da entrevista.",
        },
        {
          chave: "avaliador.k2.origem",
          passo: "banca",
          texto: "Membro 2 (Beto): Origem: de 2 a 80 caracteres.",
        },
        {
          chave: "banca.b1.quantidade",
          passo: "banca",
          texto: "Composição: Quantidade: número inteiro de 1 a 20.",
        },
        {
          chave: "cobertura",
          passo: "banca",
          texto: "Banca 1: ninguém avalia “Escuta”.",
        },
      ]);
    });

    it("a agenda por dia, em ordem, e quem está sem horário", () => {
      const { dias, semHorario } = agendaPorDia(
        {
          itens: [
            { analise_id: "an2", data: "2026-10-08", inicio: "09:00:00" },
            { analise_id: "an1", data: HOJE, inicio: "10:00:00", banca: 2 },
            { analise_id: "an9", data: HOJE, inicio: "08:00:00" },
          ],
        },
        [convocado(1), convocado(2), convocado(3)],
        HOJE,
      );
      expect(
        dias.map((d) => [d.rotulo, d.linhas.map((l) => [l.inicio, l.nome])]),
      ).toEqual([
        ["Hoje", [["10:00", "Pessoa 1"]]],
        ["Amanhã", [["09:00", "Pessoa 2"]]],
      ]);
      expect(semHorario.map((c) => c.id)).toEqual(["e3"]);
    });
  });

  describe("editor do roteiro: o que falta e as frases da eliminação", () => {
    const rascunho = {
      nome: "",
      etapa: "",
      descricao: "",
      escala: "NIVEIS",
      niveis: [{ chave: "n1", nota: "0", nome: "", descricao: "" }],
      aspectos: [],
      competencias: [
        {
          chave: "k1",
          nome: "Escuta",
          descricao: "",
          nota_maxima: "0",
          peso: "1",
          minimo: "",
          tipo_minimo: "VALOR",
        },
      ],
      nota_minima_total: "",
      notas_eliminatorias: [],
      banca: [],
    };

    it("cada erro com o lugar, na ordem das seções", () => {
      const pendencias = pendenciasDoRoteiro(
        errosDoRoteiro(rascunho),
        rascunho,
      );
      expect(pendencias.map((p) => [p.secao, p.texto])).toEqual([
        ["identificacao", "Nome do roteiro: de 3 a 150 caracteres."],
        [
          "competencias",
          "Competência 1 (Escuta): Nota máxima: maior que 0 e até 100.",
        ],
        ["escala", "Nível 1: Nome do nível: de 2 a 80 caracteres."],
      ]);
      expect(errosPorSecao(pendencias)).toMatchObject({
        identificacao: 1,
        competencias: 1,
        escala: 1,
        aprovacao: 0,
      });
      expect(secaoDoErro("nota_minima_total")).toBe("aprovacao");
      expect(secaoDoErro("banca.x.quantidade")).toBe("banca");
    });

    it("frases simples do que elimina, do rascunho", () => {
      expect(
        frasesDaEliminacao({
          competencias: [
            { id: "a", nota_maxima: "5", minimo: "2", tipo_minimo: "VALOR" },
            { id: "b", nota_maxima: "5", minimo: "2", tipo_minimo: "VALOR" },
          ],
          notas_eliminatorias: [],
          nota_minima_total: "8",
          ausencia_elimina: true,
        }),
      ).toEqual([
        "Abaixo de 2 em qualquer competência ou abaixo de 8 no total, o candidato fica inapto.",
        "Quem falta é eliminado.",
      ]);
      expect(
        frasesDaEliminacao({
          competencias: [{ id: "a", nota_maxima: "5" }],
          ausencia_elimina: false,
        }),
      ).toEqual(["Quem falta fica com nota 0, sem ser eliminado."]);
    });
  });

  describe("parecer da entrevista em texto pronto", () => {
    const base = {
      candidato: "Bruna Lima",
      codigo: "43015",
      edital: "991/2099",
      vaga: "V1",
      cargo: "Enfermeiro",
      roteiro: "Entrevista individual",
      versao: "Banca de outubro · v2",
      avaliadores: [
        { nome: "Ana", origem: "AgSUS" },
        { nome: "Beto", origem: "DSEI" },
      ],
      competencias: [
        { nome: "Escuta", nota: 3.333, maximo: 5, minimo: 2 },
        { nome: "Equipe", nota: 4, maximo: 5, minimo: 2 },
      ],
      total: 7.333,
      maxima: 10,
      minimoTotal: 6,
      parecer: "APTO",
      motivos: [],
      faltou: false,
    };

    it("só fica pronto com tudo lançado e parecer Apto ou Inapto", () => {
      expect(parecerPronto("APTO", "")).toBe(true);
      expect(parecerPronto("INAPTO", "")).toBe(true);
      expect(parecerPronto("APTO", "faltam 2 notas")).toBe(false);
      expect(parecerPronto("SEM_PARECER", "")).toBe(false);
    });

    it("apto: quem, onde, roteiro, banca, notas, total e o parecer", () => {
      expect(textoDoParecerDaEntrevista(base)).toBe(
        [
          "Parecer da entrevista — Bruna Lima (cód. 43015)",
          "Edital 991/2099 · Vaga V1 · Enfermeiro",
          "Roteiro: Entrevista individual · Banca de outubro · v2",
          "Banca: Ana (AgSUS), Beto (DSEI)",
          "",
          "Notas por competência (média da banca):",
          "1. Escuta: 3,33 de 5 (mínimo 2)",
          "2. Equipe: 4 de 5 (mínimo 2)",
          "Total: 7,33 de 10 (mínimo 6)",
          "",
          "Parecer: APTO — atingiu os mínimos do roteiro.",
        ].join("\n"),
      );
    });

    it("inapto com os motivos; falta com o efeito da ausência", () => {
      expect(
        textoDoParecerDaEntrevista({
          ...base,
          parecer: "INAPTO",
          motivos: ["Escuta abaixo do mínimo (1 < 2)."],
        })
          .split("\n")
          .at(-1),
      ).toBe("Parecer: INAPTO — Escuta abaixo do mínimo (1 < 2).");
      const falta = textoDoParecerDaEntrevista({
        ...base,
        parecer: "INAPTO",
        faltou: true,
      });
      expect(falta).toContain("O candidato não compareceu à entrevista.");
      expect(falta.split("\n").at(-1)).toBe(
        "Parecer: INAPTO — a ausência elimina neste roteiro.",
      );
      expect(falta).not.toContain("Notas por competência");
      expect(
        textoDoParecerDaEntrevista({
          ...base,
          parecer: "INAPTO",
          faltou: true,
          justificativa: "  Não compareceu no horário.  ",
        })
          .split("\n")
          .slice(-2),
      ).toEqual(["", "Justificativa da banca: Não compareceu no horário."]);
    });
  });
});

bloco("resumo-da-entrevista", () => {
  /*
  O resumo das regras da entrevista em linguagem simples (Conduzir ›
  Preparar): as frases saem dos dados da regra, do roteiro e da banca.
*/
  const comp = (id, ordem, nome, extra = {}) => ({
    id,
    ordem,
    nome,
    nota_maxima: 5,
    peso: 1,
    minimo: 2,
    tipo_minimo: "VALOR",
    ...extra,
  });
  const ROTEIRO_SI = {
    nome: "Treinamento",
    escala: "NIVEIS",
    nota_minima_total: 8,
    notas_eliminatorias: [],
    ausencia_elimina: true,
    niveis: [0, 1, 2, 3, 4, 5].map((nota) => ({ nota, nome: `N${nota}` })),
    aspectos: [
      { id: "s1", ordem: 1, nome: "Conceitua" },
      { id: "s2", ordem: 2, nome: "Propriedade" },
      { id: "s3", ordem: 3, nome: "Profundidade" },
    ],
    competencias: [
      comp("c1", 1, "Comunicação e escuta"),
      comp("c2", 2, "Trabalho em equipe"),
      comp("c3", 3, "Respeito à diversidade cultural"),
      comp("c4", 4, "Conhecimento da função"),
    ],
  };
  const BANCA = [
    {
      id: "a1",
      nome: "Avaliador Teste 1",
      origem: "AgSUS",
      banca: 1,
      ativo: true,
      competencias: null,
    },
    {
      id: "a2",
      nome: "Avaliador Teste 2",
      origem: "DSEI",
      banca: 1,
      ativo: true,
      competencias: ["c2"],
    },
  ];

  describe("resumo das regras da entrevista", () => {
    it("lista em português", () => {
      expect(listaBr(["A"])).toBe("A");
      expect(listaBr(["A", "B", "C"])).toBe("A, B e C");
    });

    it("quem é chamado: múltiplo, exceção, cadastro reserva e empatados", () => {
      expect(
        fraseDaConvocacao({
          multiplo_vagas: 3,
          posicao_max_cr: 5,
          incluir_empatados: true,
          excecoes: [{ termos: ["Enfermeiro"], multiplo_vagas: 6 }],
        }),
      ).toBe(
        "até 3 pessoas por vaga imediata (Enfermeiro: 6 pessoas); nas vagas só de cadastro reserva, até a 5ª posição; quem empatar com o último chamado também entra",
      );
      expect(
        fraseDaConvocacao({ multiplo_vagas: 1, incluir_empatados: false }),
      ).toBe(
        "até 1 pessoa por vaga imediata; quem empatar com o último chamado só entra se couber no limite",
      );
      expect(fraseDaConvocacao({ posicao_max_cr: 10 })).toBe(
        "até a 10ª posição de cada vaga; quem empatar com o último chamado também entra",
      );
      expect(fraseDaConvocacao({})).toBe(
        "todos os classificados (a regra não tem limite)",
      );
      expect(fraseDaConvocacao(null)).toBe("");
    });

    it("a tabelinha das vagas", () => {
      expect(
        linhasDasVagas([
          { vaga: "001", cargo: "Enfermeiro", total: 1, limite: 6 },
          { vaga: "003", cargo: "Agente", total: 0, limite: 5 },
          { vaga: "009", cargo: "Antiga", semVagasNaLista: true, limite: null },
        ]),
      ).toEqual([
        {
          vaga: "001",
          cargo: "Enfermeiro",
          imediatas: "1",
          chamaAte: "até a 6ª",
        },
        {
          vaga: "003",
          cargo: "Agente",
          imediatas: "cadastro reserva",
          chamaAte: "até a 5ª",
        },
        { vaga: "009", cargo: "Antiga", imediatas: "—", chamaAte: "—" },
      ]);
    });

    it("como a nota é calculada: aspectos, média de quem avalia, inapto e falta", () => {
      expect(frasesDaNota(ROTEIRO_SI, true)).toEqual([
        "Cada avaliador dá 3 notas (Conceitua, Propriedade e Profundidade) de 0 a 5 em cada uma das 4 competências; a nota dele na competência é a média dessas notas.",
        "A nota da competência é a média dos avaliadores que a avaliam; a nota final é a soma das competências, até 20 pontos.",
        "Abaixo de 2 em qualquer competência ou abaixo de 8 no total, o candidato fica inapto.",
        "Quem falta é eliminado.",
      ]);
    });

    it("sem aspectos: uma nota, peso, mínimos diferentes, eliminatórias e falta que não elimina", () => {
      const frases = frasesDaNota({
        escala: "FAIXA",
        passo: 0.5,
        nota_minima_total: null,
        notas_eliminatorias: [0, 1],
        ausencia_elimina: false,
        competencias: [
          comp("p1", 1, "Técnica", {
            nota_maxima: 2,
            minimo: 50,
            tipo_minimo: "PERCENTUAL",
          }),
          comp("p2", 2, "Intercultural", {
            nota_maxima: 2,
            peso: 1.5,
            minimo: null,
          }),
        ],
      });
      expect(frases[0]).toBe(
        "Cada avaliador dá uma nota (0; 0,5; 1; 1,5 ou 2) em cada uma das 2 competências.",
      );
      expect(frases[1]).toBe(
        "A nota da competência é a média dos avaliadores vezes o peso (Intercultural: peso 1,5); a nota final é a soma das competências, até 5 pontos.",
      );
      expect(frases[2]).toBe(
        "Abaixo do mínimo da competência (Técnica: 1) ou com média 0 ou 1 em alguma competência, o candidato fica inapto.",
      );
      expect(frases[3]).toBe("Quem falta fica com nota 0, sem ser eliminado.");
    });

    it("quem avalia: por banca, só as competências de cada um, contagem e avisos", () => {
      const { frases, avisos } = frasesDaBanca(BANCA, ROTEIRO_SI, "SECRETARIA");
      expect(frases).toEqual([
        "Banca 1 — Avaliador Teste 1 (AgSUS) avalia todas as competências; Avaliador Teste 2 (DSEI) avalia só Trabalho em equipe.",
        "Na banca 1, Trabalho em equipe: 2 avaliadores; as outras: 1 avaliador.",
        "A secretaria passa a limpo as notas de cada avaliador.",
      ]);
      expect(avisos).toEqual([]);
      const semNinguem = frasesDaBanca(
        [
          { ...BANCA[1], banca: 2 },
          { ...BANCA[0], competencias: ["c1", "c3", "c4"] },
        ],
        ROTEIRO_SI,
        "AVALIADOR",
      );
      expect(semNinguem.avisos).toEqual([
        "Na banca 1, ninguém avalia “Trabalho em equipe”.",
        "Na banca 2, ninguém avalia “Comunicação e escuta”.",
        "Na banca 2, ninguém avalia “Respeito à diversidade cultural”.",
        "Na banca 2, ninguém avalia “Conhecimento da função”.",
      ]);
      expect(semNinguem.frases.at(-1)).toBe(
        "Cada avaliador lança as próprias notas no sistema.",
      );
      expect(frasesDaBanca([], ROTEIRO_SI).frases).toEqual([
        "Ainda sem membros na banca.",
      ]);
    });

    it("desempate na ordem, com o empate final", () => {
      expect(
        fraseDoDesempate(
          [
            { nome: "60 anos ou mais na data de corte" },
            { nome: "Maior pontuação na entrevista" },
          ],
          "Sorteio registrado",
        ),
      ).toBe(
        "Se a nota final empatar, vale, nesta ordem: 1º 60 anos ou mais na data de corte; 2º maior pontuação na entrevista. Se ainda empatar: sorteio registrado.",
      );
      expect(fraseDoDesempate([], "")).toBe("");
    });

    it("o resumo inteiro: quatro blocos, cada um com o caminho para editar", () => {
      const blocos = resumoDasRegrasDaEntrevista({
        temRegra: true,
        convocacao: { multiplo_vagas: 3, posicao_max_cr: 5 },
        vagas: [{ vaga: "001", cargo: "Enfermeiro", total: 1, limite: 3 }],
        roteiro: ROTEIRO_SI,
        avaliadores: BANCA,
        lancamento: "SECRETARIA",
        desempate: [{ nome: "Maior pontuação na entrevista" }],
        empateFinal: "Sorteio registrado",
        convocados: { naFicha: 2, naLista: 3 },
      });
      expect(blocos.map((b) => b.id)).toEqual([
        "convocacao",
        "nota",
        "banca",
        "desempate",
      ]);
      expect(blocos[0].frases).toEqual([
        "Até 3 pessoas por vaga imediata; nas vagas só de cadastro reserva, até a 5ª posição; quem empatar com o último chamado também entra.",
        "Na ficha de notas: 2 de 3 da lista de convocação.",
      ]);
      expect(blocos[0].vagas).toHaveLength(1);
      expect(blocos.map((b) => b.acoes.map((a) => a.destino))).toEqual([
        ["classificacao", "convocacao"],
        ["roteiro"],
        ["configuracao"],
        ["classificacao"],
      ]);
      expect(blocos[1].frases[1]).toContain("dos avaliadores que a avaliam");
    });

    it("sem regra e sem roteiro: diz onde definir", () => {
      const blocos = resumoDasRegrasDaEntrevista({ temRegra: false });
      expect(blocos[0].frases[0]).toBe(
        "O edital ainda não tem regra de classificação: quem é chamado é definido lá.",
      );
      expect(blocos[1].acoes).toEqual([
        { destino: "configuracao", rotulo: "Escolher roteiro" },
      ]);
      expect(blocos[1].frases[1] ?? "").toBe("");
      // Todos avaliam todas: a média é "dos avaliadores" (sem "que a avaliam").
      const todas = resumoDasRegrasDaEntrevista({
        temRegra: true,
        roteiro: ROTEIRO_SI,
        avaliadores: [BANCA[0]],
      });
      expect(todas[1].frases[1]).not.toContain("que a avaliam");
    });
  });
});

bloco("roteiro-de-entrevista", () => {
  /* Os dois roteiros iniciais da migration 20260930220000. */
  const SAUDE_INDIGENA = {
    id: "r1",
    origem: "r1",
    versao: 1,
    area: "saude-indigena",
    nome: "Saúde Indígena 2026 — Entrevista individual",
    etapa: "Entrevista Individual",
    escala: "NIVEIS",
    passo: 1,
    notas_permitidas: [],
    nota_minima_total: 8,
    notas_eliminatorias: [0, 1],
    ausencia_elimina: true,
    desempate: ["Idade igual ou superior a 60 anos", "Ser indígena"],
    soma_analise: true,
    convocacao_padrao: {
      multiplo_imediatas: 5,
      posicao_cadastro_reserva: 10,
      excecoes: [
        {
          termo_cargo: "Enfermagem",
          multiplo_imediatas: 10,
          posicao_cadastro_reserva: 20,
        },
      ],
    },
    banca_padrao: [{ origem: "AgSUS", quantidade: 1 }],
    competencias: [1, 2, 3, 4].map((ordem) => ({
      id: `c${ordem}`,
      ordem,
      nome: `Competência ${ordem}`,
      descricao: null,
      nota_maxima: 5,
      peso: 1,
      minimo: 2,
      tipo_minimo: "VALOR",
      avaliacao: "INDIVIDUAL",
    })),
    niveis: [0, 1, 2, 3, 4, 5].map((nota) => ({
      nota,
      nome: `Nível ${nota}`,
      descricao: `Descrição ${nota}`,
    })),
    editais_em_uso: 3,
  };

  const SESMT = {
    ...SAUDE_INDIGENA,
    id: "r2",
    origem: "r2",
    escala: "FAIXA",
    passo: 0.5,
    nota_minima_total: 5,
    notas_eliminatorias: [],
    niveis: [],
    competencias: [
      {
        id: "p1",
        ordem: 1,
        nome: "Técnica",
        nota_maxima: 2,
        peso: 1,
        minimo: 50,
        tipo_minimo: "PERCENTUAL",
        avaliacao: "INDIVIDUAL",
      },
      {
        id: "p2",
        ordem: 2,
        nome: "Intercultural",
        nota_maxima: 2,
        peso: 1.5,
        minimo: 50,
        tipo_minimo: "PERCENTUAL",
        avaliacao: "INDIVIDUAL",
      },
      {
        id: "p3",
        ordem: 3,
        nome: "Comportamental",
        nota_maxima: 2,
        peso: 1.5,
        minimo: 50,
        tipo_minimo: "PERCENTUAL",
        avaliacao: "INDIVIDUAL",
      },
      {
        id: "p4",
        ordem: 4,
        nome: "Estudo de caso",
        nota_maxima: 2,
        peso: 1,
        minimo: 50,
        tipo_minimo: "PERCENTUAL",
        avaliacao: "GRUPO",
      },
    ],
  };

  describe("números do formulário", () => {
    it("lê vírgula e ponto, vazio vira nulo e texto vira NaN", () => {
      expect(lerNumero("1,5")).toBe(1.5);
      expect(lerNumero("1.5")).toBe(1.5);
      expect(lerNumero(" ")).toBeNull();
      expect(lerNumero("abc")).toBeNaN();
      expect(lerNumero(2)).toBe(2);
      expect(lerListaDeNotas("0; 1; 2,5 ; x")).toEqual([0, 1, 2.5]);
    });

    it("arredonda como o PostgreSQL (metade para longe do zero)", () => {
      expect(arredondar(2.345)).toBe(2.35);
      expect(arredondar(1.005)).toBe(1.01);
      expect(arredondar(3.3333)).toBe(3.33);
    });
  });

  describe("peso, mínimo e pontuação", () => {
    it("mostra o peso como acréscimo amigável", () => {
      expect(rotuloDoPeso(1.5)).toBe("+50%");
      expect(rotuloDoPeso("2")).toBe("+100%");
      expect(rotuloDoPeso(0.5)).toBe("−50%");
      expect(rotuloDoPeso(1)).toBe("");
      expect(rotuloDoPeso("")).toBe("");
    });

    it("converte o mínimo em % da nota máxima × peso", () => {
      expect(minimoEmPontos(SESMT.competencias[1])).toBe(1.5);
      expect(minimoEmPontos(SAUDE_INDIGENA.competencias[0])).toBe(2);
      expect(minimoEmPontos({ nota_maxima: 5, minimo: null })).toBeNull();
    });

    it("soma a pontuação máxima e escreve a prévia", () => {
      expect(pontuacaoMaxima(SAUDE_INDIGENA.competencias)).toBe(20);
      expect(pontuacaoMaxima(SESMT.competencias)).toBe(10);
      expect(textoDaPontuacao(SAUDE_INDIGENA)).toBe(
        "Pontuação máxima 20 · mínimo 8",
      );
      expect(
        textoDaPontuacao({
          competencias: SESMT.competencias,
          nota_minima_total: "",
        }),
      ).toBe("Pontuação máxima 10 · sem mínimo total");
    });

    it("resume o roteiro para o cartão", () => {
      expect(resumoDoRoteiro(SESMT)).toMatchObject({
        competencias: 4,
        maxima: 10,
        minimo: 5,
        emUso: 3,
        versao: 1,
        grupo: true,
      });
    });
  });

  describe("escala", () => {
    it("FAIXA: de 0 ao máximo, de passo em passo", () => {
      expect(opcoesDaEscala(SESMT, 2).map((o) => o.valor)).toEqual([
        0, 0.5, 1, 1.5, 2,
      ]);
      expect(notaNaEscala(SESMT, SESMT.competencias[0], 1.5)).toBe(true);
      expect(notaNaEscala(SESMT, SESMT.competencias[0], 1.25)).toBe(false);
      expect(notaNaEscala(SESMT, SESMT.competencias[0], 2.5)).toBe(false);
    });

    it("nota aceita: a da escala ou a já gravada, mesmo fora dela (importada da planilha, 16/11/2026)", () => {
      const c = SESMT.competencias[0];
      expect(notaAceita(SESMT, c, 1.5, null)).toBe(true);
      // Gravada pela importação (média da planilha) e não mexida: vale.
      expect(notaAceita(SESMT, c, "1,67", 1.67)).toBe(true);
      expect(notaAceita(SESMT, c, 0.75, "0.75")).toBe(true);
      // Mudou: a nova segue a escala.
      expect(notaAceita(SESMT, c, 1.25, 1.67)).toBe(false);
      expect(notaAceita(SESMT, c, 1.25, null)).toBe(false);
      // Fora da faixa nunca vale, nem gravada.
      expect(notaAceita(SESMT, c, 2.5, 2.5)).toBe(false);
      expect(notaAceita(SESMT, c, -1, -1)).toBe(false);
    });

    it("FAIXA de 0,01 em 0,01 (93/2026, 17/11/2026): aceita a nota quebrada da banca e se digita", () => {
      const duasCasas = { ...SESMT, passo: 0.01 };
      const c = SESMT.competencias[0];
      expect(notaNaEscala(duasCasas, c, 1.29)).toBe(true);
      expect(notaNaEscala(duasCasas, c, 0.88)).toBe(true);
      expect(notaNaEscala(duasCasas, c, 1.295)).toBe(false);
      expect(notaNaEscala(duasCasas, c, 2.01)).toBe(false);
      const opcoes = opcoesDaEscala(duasCasas, 2).map((o) => o.valor);
      expect(opcoes).toHaveLength(201);
      expect(lerDigitacao("1", opcoes).estado).toBe("parcial");
      expect(lerDigitacao("1,2", opcoes).estado).toBe("parcial");
      expect(lerDigitacao("1,29", opcoes)).toEqual({
        estado: "completa",
        texto: "1,29",
      });
      expect(lerDigitacao("1,295", opcoes).estado).toBe("recusada");
    });

    it("NIVEIS: os níveis até a nota máxima, com nome e descrição", () => {
      const opcoes = opcoesDaEscala(SAUDE_INDIGENA, 3);
      expect(opcoes.map((o) => o.valor)).toEqual([0, 1, 2, 3]);
      expect(opcoes[2]).toEqual({
        valor: 2,
        rotulo: "Nível 2",
        descricao: "Descrição 2",
      });
      expect(
        notaNaEscala(SAUDE_INDIGENA, SAUDE_INDIGENA.competencias[0], 4),
      ).toBe(true);
      expect(
        notaNaEscala(SAUDE_INDIGENA, SAUDE_INDIGENA.competencias[0], 3.5),
      ).toBe(false);
    });

    it("LISTA: só as notas permitidas, sem repetir", () => {
      const lista = { escala: "LISTA", notas_permitidas: [5, 0, 2.5, 2.5, 10] };
      expect(opcoesDaEscala(lista, 5).map((o) => o.valor)).toEqual([0, 2.5, 5]);
      expect(notaNaEscala(lista, { nota_maxima: 5 }, 2.5)).toBe(true);
      expect(notaNaEscala(lista, { nota_maxima: 5 }, 1)).toBe(false);
    });
  });

  describe("rascunho, validação e gravação", () => {
    it("editar mantém a origem (grava a versão seguinte); duplicar cria outro", () => {
      const edicao = rascunhoDoRoteiro(SAUDE_INDIGENA, { modo: "editar" });
      expect(edicao.origem).toBe("r1");
      expect(edicao.versao).toBe(1);
      expect(edicao.competencias).toHaveLength(4);
      expect(edicao.niveis[5]).toMatchObject({ nota: "5", nome: "Nível 5" });
      expect(dadosDoRoteiroParaSalvar(edicao).origem).toBe("r1");

      const copia = rascunhoDoRoteiro(SAUDE_INDIGENA, { modo: "duplicar" });
      expect(copia.origem).toBeNull();
      expect(copia.nome).toMatch(/\(cópia\)$/);
      expect("origem" in dadosDoRoteiroParaSalvar(copia)).toBe(false);
    });

    it("o roteiro do banco volta igual pelo formulário", () => {
      const dados = dadosDoRoteiroParaSalvar(rascunhoDoRoteiro(SAUDE_INDIGENA));
      expect(dados).toMatchObject({
        nome: SAUDE_INDIGENA.nome,
        escala: "NIVEIS",
        nota_minima_total: 8,
        notas_eliminatorias: [0, 1],
        ausencia_elimina: true,
        soma_analise: true,
        desempate: SAUDE_INDIGENA.desempate,
        convocacao_padrao: SAUDE_INDIGENA.convocacao_padrao,
        banca_padrao: SAUDE_INDIGENA.banca_padrao,
      });
      expect(dados.competencias[0]).toEqual({
        nome: "Competência 1",
        descricao: null,
        nota_maxima: 5,
        peso: 1,
        minimo: 2,
        tipo_minimo: "VALOR",
        avaliacao: "INDIVIDUAL",
      });
      expect(dados.niveis).toHaveLength(6);
      expect(errosDoRoteiro(rascunhoDoRoteiro(SAUDE_INDIGENA))).toEqual({});
      expect(errosDoRoteiro(rascunhoDoRoteiro(SESMT))).toEqual({});
    });

    it("aponta os campos inválidos", () => {
      const r = rascunhoDoRoteiro(null, { area: "projetos" });
      expect(r.area).toBe("projetos");
      const vazio = errosDoRoteiro(r);
      expect(vazio.nome).toBeTruthy();
      expect(vazio[`competencia.${r.competencias[0].chave}.nome`]).toBeTruthy();

      const c = {
        ...r.competencias[0],
        nome: "Técnica",
        nota_maxima: "5",
        peso: "20",
        minimo: "30",
      };
      const erros = errosDoRoteiro({
        ...r,
        nome: "Roteiro",
        escala: "LISTA",
        notas_permitidas: "",
        competencias: [c],
        nota_minima_total: "999",
        desempate: [""],
        convocacao: {
          multiplo_imediatas: "0",
          posicao_cadastro_reserva: "10",
          excecoes: [{ chave: "e1", termo_cargo: "" }],
        },
      });
      expect(Object.keys(erros).sort()).toEqual(
        [
          "notas_permitidas",
          `competencia.${c.chave}.peso`,
          "nota_minima_total",
          "desempate.0",
          // A convocação padrão não vale mais (é a da Classificação): não é conferida.
        ].sort(),
      );

      const niveis = errosDoRoteiro({
        ...rascunhoDoRoteiro(SAUDE_INDIGENA),
        niveis: [
          { chave: "n1", nota: "1", nome: "Um" },
          { chave: "n2", nota: "1", nome: "X" },
        ],
      });
      expect(niveis["nivel.n2.nota"]).toMatch(/mesma nota/);
      expect(niveis["nivel.n2.nome"]).toBeTruthy();
    });

    it("move itens da lista", () => {
      expect(moverItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
      expect(moverItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    });
  });

  describe("aspectos do roteiro", async () => {
    const lib = await import("../src/lib/entrevistas/roteiro-de-entrevista.ts");

    it("rascunho, validação e o que vai ao banco", () => {
      const r = lib.rascunhoDoRoteiro({
        id: "r1",
        nome: "Roteiro",
        escala: "FAIXA",
        passo: 1,
        competencias: [{ id: "c1", ordem: 1, nome: "Uma", nota_maxima: 5 }],
        notas_eliminatorias: [0],
        aspectos: [
          { id: "s2", ordem: 2, nome: "Propriedade" },
          { id: "s1", ordem: 1, nome: "Conceitua" },
        ],
      });
      expect(r.aspectos.map((a) => a.nome)).toEqual([
        "Conceitua",
        "Propriedade",
      ]);
      expect(lib.errosDoRoteiro(r)).toEqual({});
      const dados = lib.dadosDoRoteiroParaSalvar(r);
      expect(dados.aspectos).toEqual([
        { nome: "Conceitua" },
        { nome: "Propriedade" },
      ]);
      expect(dados.notas_eliminatorias).toEqual([]);
      const repetido = {
        ...r,
        aspectos: [...r.aspectos, lib.novoAspecto("conceitua")],
      };
      expect(Object.values(lib.errosDoRoteiro(repetido))).toContain(
        "Dois aspectos com o mesmo nome.",
      );
      expect(lib.MODELO_DE_ASPECTOS).toEqual([
        "Conceitua",
        "Propriedade",
        "Profundidade",
      ]);
      expect(lib.resumoDoRoteiro(r).aspectos).toEqual([
        "Conceitua",
        "Propriedade",
      ]);
    });
  });
});
