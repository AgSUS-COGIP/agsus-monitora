// @vitest-environment node
import { bloco } from "./apoio/bloco.ts";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import {
  editalDiferente,
  etapasDoAnexo,
  juntarAnexos,
  lerAnexoNoServidor,
  problemaDoArquivo,
  quadroParaSalvar,
  resumoDoQuadro,
  textoDaModalidade,
} from "../src/lib/editais/anexos-do-edital.ts";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import {
  CONFERENCIAS,
  contagemPorModulo,
  diaDoAviso,
  agruparPorEdital,
  chaveDoCaso,
  erroDaEvidencia,
  erroDoMotivoDoTratamento,
  normalizarHistorico,
  opcoesDeTratamento,
  prazoVencido,
  filtrarPorModulo,
  normalizarAvisos,
  ondeDoAviso,
  tituloDaConferencia,
  tomDoSelo,
  tabelaDosCasos,
  destinoDoCaso,
  linhaDoVinculo,
  normalizarCaso,
  ondeDoCaso,
  quemDoCaso,
  casoAbreAnalise,
  casosRestantes,
  diaDoCaso,
  filtroDoCaso,
  juntarPaginasDeCasos,
  motivoDoCaso,
  nomeDoArquivoDosCasos,
  normalizarCasos,
  termoDeBusca,
} from "../src/lib/conferencias/avisos-de-conferencia.ts";
import {
  BACKGROUND_SUSPEND_DELAY_MS,
  shouldSuspendBackgroundResources,
} from "../src/lib/carga/background-resource-lifecycle";
import {
  CHAVE_DO_DONO,
  VALIDADE_DO_CACHE_MS,
} from "../src/lib/carga/cache-de-payload";
import {
  ESQUEMAS_DO_PAYLOAD,
  chavesDoCacheAntigo,
  criarCacheDoPainel,
  payloadMudou,
  revalidarPayload,
} from "../src/lib/analises/cache-do-painel-de-analises.ts";
import {
  apagarCacheDePayload,
  armazenamentoDePayload,
} from "../src/modules/cache-de-payload-indexeddb.ts";
import { indexedDBFalso } from "./indexeddb-falso.js";
import {
  FILTROS_VAZIOS,
  alternarTipoOculto,
  cabecalhoDoDiaDaLista,
  chaveDoDia,
  chavesDaSemana,
  contarEtapasNoIntervalo,
  contarEtapasNoMes,
  diasDaLista,
  emAndamentoNoDia,
  etapasAtivasNoDia,
  filtrarEtapas,
  inicioDaSemana,
  intervaloDoMes,
  marcaNoDia,
  montarEtapasDosEditais,
  montarGradeDoMes,
  rotuloDaSemana,
  rotuloDoNumeroDoEdital,
  tiposOcultosValidos,
  unidadeCurta,
  visaoInicial,
  comLimite,
  editaisComCronograma,
  proximasEtapas,
  TIPOS_DA_LEGENDA,
} from "../src/lib/cronograma/calendario-editais.ts";
import { criarEstadoDoCalendario } from "../src/modulos/cronograma/estado.ts";
import { chamarRpc, textoDoErro } from "../scripts/carga-de-planilha.mjs";
import {
  filtrosDeEntrevistas,
  filtrosDasAnalises,
} from "../src/lib/aya/filtro-da-aya.ts";
import {
  filterApprovedCandidates,
  nomeDosCandidatosFiltrados,
} from "../src/lib/aprovados/lista-aprovados-rules.ts";
import { criarEstadoDosAvisos } from "../src/modulos/conferencias/estado.ts";
import {
  avisoSemEfeito,
  chaveDaLinha,
  chaveQueFalta,
  mensagemDaRecusa,
  motivoValido,
  normalizarChaves,
  proximaDaChave,
  semProxima,
  tarefasForaDaChave,
  ultimaExecucao,
} from "../src/lib/automacao/chaves-da-automacao.ts";
import { proximaExecucao } from "../src/lib/automacao/agenda-do-cron.ts";
import { CATALOGO_DOS_ROBOS } from "./fixtures/catalogo-dos-robos.ts";
import {
  normalizarSaude,
  visaoSimples,
  marcaDasConferencias,
  prazoDaAgenda,
  PRAZO_DIARIO_MIN,
  PRAZO_FREQUENTE_MIN,
  PRAZO_MENSAL_MIN,
  textoDaIdade,
} from "../src/lib/automacao/saude-das-cargas.ts";
import {
  CONFLITO_DE_VERSAO,
  CONFLITO_DE_VERSAO_ANTIGO,
  ehConflitoDeVersao,
} from "../src/lib/base/conflito-de-versao.ts";
import {
  PENDENTE,
  aplicarDatasEmLote,
  analisarCronograma,
  estadoDoCronograma,
  etapasDoModeloPadrao,
  lerLinhaDeDatas,
  novaEtapa,
  situacaoNaLinhaDoTempo,
} from "../src/lib/cronograma/cronograma-do-edital.ts";
import {
  dataPlausivel,
  editaisComDatasARevisar,
  etapaComDatasValidas,
  proximasEtapas as proximasEtapas__1,
} from "../src/lib/cronograma/datas-do-cronograma.ts";
import {
  TIPO_DEMANDA_INTERNA,
  comDemanda,
  demandaAtrasada,
  demandaComoEtapa,
  demandaDoEditalId,
  demandasDaArea,
  formularioDaDemanda,
  juntarPorInicio,
  lerDemanda,
  lerDemandasInternas,
  payloadDaDemanda,
  periodoDaDemanda,
  problemaDoFormulario,
  situacaoDaDemanda,
} from "../src/lib/cronograma/demandas-internas.ts";
import handler from "../api/editais.ts";
import {
  editaisDaApi,
  filtrosDaApi,
  totaisDaApi,
} from "../src/lib/editais/editais-da-api.ts";
import {
  chaveDoEdital,
  editaisDasLinhas,
  editalEstaAtivo,
} from "../src/lib/editais/editais-das-linhas.ts";
import {
  areaDaUnidade,
  compararEditais,
  contarAtivosEInativos,
  editalParaSalvar,
  filtrarEditais,
  formularioDoEdital,
  indexarResumo,
  indicadoresDoResumo,
  vistaDoIndicador,
  mapaDeAreasDasUnidades,
  opcoesDeUnidade,
  periodoDoCronograma,
  passaNoFiltroOperacional,
  resumoDasLinhas,
  resumoDoEdital,
  rotuloDoFiltroOperacional,
  situacaoDoEdital,
  unidadesDaArea,
  unidadesDisponiveis,
} from "../src/lib/editais/editais-do-nucleo.ts";
import {
  UNIDADES_CORES,
  ehEditalDaSaudeIndigena,
  ehResponsavelCores,
  normalizarResponsavel,
  unidadesDoResponsavel,
} from "../src/lib/editais/responsavel-do-edital.ts";
import { enderecoDoPainel } from "../src/lib/paineis/endereco-do-painel";
import {
  SITUACAO_ETAPA,
  TIPOS_DE_ETAPA,
  classificarEtapa,
  dataLocal,
  etapaConcluida,
  normalizarTexto,
  situacaoDaEtapa,
} from "../src/lib/editais/etapas-de-edital.ts";
import {
  SEM_SERVIDOR,
  TempoEsgotado,
  comTempoLimite,
  ehFalhaDeConexao,
  mensagemDeFalha,
} from "../src/lib/carga/falha-de-rede";
import { fonteDoApp } from "./fonte-do-app.ts";
import {
  CONTRATO_RPC,
  RPCS_CRITICAS,
  contratoDe,
} from "../src/lib/rpc-contrato.ts";
import {
  createPerformanceSnapshot,
  roundMetric,
  summarizeResourceEntries,
} from "../src/lib/carga/frontend-performance-monitor";
import {
  carregarChart,
  chartCarregado,
} from "../src/lib/base/chartjs-global.ts";
import { join, relative, resolve } from "node:path";
import {
  FA_MODIFICADORES,
  FA_PARA_LUCIDE,
} from "../src/lib/base/mapa-de-icones-lucide.ts";
import { gerarCssDosIcones } from "../scripts/gerar-icones-lucide.mjs";
import {
  CHAVE_DA_RECARGA,
  importarComRecarga,
  JANELA_DA_RECARGA_MS,
  recarregarUmaVez,
} from "../src/lib/carga/importar-com-recarga";
import {
  acompanhamentoDoPedido,
  editaisDoPedido,
  normalizarPainel,
  normalizarVagas,
  opcoesDosEditais,
  previaDoDisparo,
} from "../src/lib/automacao/painel-dos-robos.ts";
import {
  inputsDoPedido,
  MENSAGEM_DA_CHAVE,
  mensagemDoErroDoDisparo,
  OPCOES_DOS_ROBOS,
  roboDeCarga,
  separarCodigos,
  situacaoDoPedido,
  validarOpcoes,
} from "../src/lib/automacao/robos-de-carga.ts";
import {
  PLANILHAS,
  urlDaPlanilhaGoogle,
  urlDeExportacaoXlsx,
} from "../src/lib/base/planilhas.ts";
import {
  bloqueioDaRetificacao,
  casarEtapas,
  compararRetificacao,
  etapasRetificadas,
  lerRetificacaoNoServidor,
  motivoDaRetificacao,
  numeroDaErrata,
  problemasDaComparacao,
  resumoDaComparacao,
  semelhancaDeAtividade,
} from "../src/lib/cronograma/retificacao-do-cronograma.ts";
import { criarEstadoDaSaude } from "../src/componentes/saude-das-cargas/estado.ts";
import vm from "node:vm";
import {
  quandoFoi,
  textoDaConferencia,
} from "../src/lib/conferencias/texto-da-conferencia.ts";
import { NOVIDADES, novidadesVisiveis } from "../src/lib/base/novidades.ts";
import {
  ehErroDeTelaAntiga,
  lerVersaoPublicada,
  novidadeParaMostrar,
  observarRespostasDoBanco,
} from "../src/lib/base/versao-do-sistema.ts";

bloco("anexos-do-edital", () => {
  const CRONOGRAMA = [
    {
      atividade: "Publicação do Edital",
      data_inicio: "2026-09-29",
      data_fim: "2026-09-29",
      texto_datas: "29/09",
    },
    {
      atividade: "Impugnação do Edital",
      data_inicio: "2026-09-30",
      data_fim: "2026-10-02",
      texto_datas: "30/09 a 02/10",
    },
  ];
  const VAGAS = [
    {
      cargo: "Enfermeiro",
      lotacao: "Polo Base Leonardo",
      modalidades: { "Ampla Concorrência": 1, PcD: null },
      vagas_imediatas: 1,
      cadastro_reserva: true,
    },
    {
      cargo: "Enfermeiro",
      lotacao: "Polo Base Pavuru",
      modalidades: { "Ampla Concorrência": null, PcD: null },
      vagas_imediatas: 0,
      cadastro_reserva: true,
    },
  ];

  describe("arquivo e número do edital", () => {
    it("recusa o que não é PDF ou passa de 4 MB", () => {
      expect(
        problemaDoArquivo({ name: "a.pdf", type: "application/pdf", size: 10 }),
      ).toBe("");
      expect(problemaDoArquivo({ name: "a.docx", type: "", size: 10 })).toMatch(
        /não é PDF/,
      );
      expect(
        problemaDoArquivo({
          name: "a.pdf",
          type: "application/pdf",
          size: 5 * 1024 * 1024,
        }),
      ).toMatch(/4 MB/);
    });

    it("avisa quando o PDF é de outro edital", () => {
      expect(editalDiferente("117/2026", "117/2026")).toBe(false);
      expect(editalDiferente("117/2026", "105/2026")).toBe(true);
      expect(editalDiferente("", "105/2026")).toBe(false);
    });
  });

  describe("leitura no servidor", () => {
    const arquivo = { name: "anexos.pdf", type: "application/pdf", size: 100 };

    it("manda o PDF com o token e devolve a resposta com o nome do arquivo", async () => {
      const buscar = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          edital: "117/2026",
          cronograma: CRONOGRAMA,
          vagas: VAGAS,
        }),
      }));
      const r = await lerAnexoNoServidor(arquivo, { token: "tk", buscar });
      expect(buscar).toHaveBeenCalledWith(
        "/api/anexos-do-edital",
        expect.objectContaining({
          method: "POST",
          body: arquivo,
          headers: expect.objectContaining({ Authorization: "Bearer tk" }),
        }),
      );
      expect(r.arquivo).toBe("anexos.pdf");
    });

    it("traduz 404 (fora da Vercel) e erros da função", async () => {
      await expect(
        lerAnexoNoServidor(arquivo, {
          token: "tk",
          buscar: async () => ({
            ok: false,
            status: 404,
            json: async () => ({}),
          }),
        }),
      ).rejects.toThrow(/Vercel/);
      await expect(
        lerAnexoNoServidor(arquivo, {
          token: "tk",
          buscar: async () => ({
            ok: false,
            status: 422,
            json: async () => ({ erro: "Não consegui ler este PDF." }),
          }),
        }),
      ).rejects.toThrow("Não consegui ler este PDF.");
    });
  });

  describe("juntar e converter", () => {
    it("junta cronograma de um PDF e quadro de outro (Projetos)", () => {
      const j = juntarAnexos([
        {
          arquivo: "anexo-i.pdf",
          edital: "93/2026",
          cronograma: [],
          vagas: VAGAS,
          modalidades: [],
        },
        {
          arquivo: "anexo-ii.pdf",
          edital: "93/2026",
          cronograma: CRONOGRAMA,
          vagas: [],
        },
      ]);
      expect(j.edital).toBe("93/2026");
      expect(j.arquivoDoCronograma).toBe("anexo-ii.pdf");
      expect(j.arquivoDoQuadro).toBe("anexo-i.pdf");
      expect(j.vagas).toHaveLength(2);
      expect(j.avisos).toEqual([]);
    });

    it("avisa o que faltou", () => {
      const j = juntarAnexos([{ arquivo: "x.pdf", cronograma: [], vagas: [] }]);
      expect(j.avisos).toHaveLength(2);
    });

    it("vira etapas do editor com origem PDF", () => {
      const etapas = etapasDoAnexo([
        ...CRONOGRAMA,
        {
          atividade: "Resultado",
          data_inicio: "",
          data_fim: "",
          texto_datas: "A definir",
        },
      ]);
      expect(etapas.map((e) => e.ordem)).toEqual([1, 2, 3]);
      expect(etapas[1]).toMatchObject({
        data_inicio: "2026-09-30",
        data_fim: "2026-10-02",
        origem: "PDF",
      });
      expect(etapas[2].observacao).toBe("No PDF: A definir");
    });

    it("monta o p_dados do quadro e o resumo", () => {
      const dados = quadroParaSalvar({
        arquivoDoQuadro: "anexos.pdf",
        vagas: VAGAS,
      });
      expect(dados.origem).toBe("PDF");
      expect(dados.linhas[0]).toEqual({
        cargo: "Enfermeiro",
        lotacao: "Polo Base Leonardo",
        modalidades: { "Ampla Concorrência": 1, PcD: null },
        vagas_imediatas: 1,
        cadastro_reserva: true,
      });
      expect(resumoDoQuadro(VAGAS)).toEqual({
        linhas: 2,
        cargos: 1,
        imediatas: 1,
        soCadastroReserva: 1,
      });
      expect(textoDaModalidade(null, true)).toBe("CR");
      expect(textoDaModalidade(2, true)).toBe("2");
      expect(textoDaModalidade(null, false)).toBe("—");
    });
  });
});

bloco("avisos-de-conferencia", () => {
  /*
  Regras puras dos avisos de conferência (src/lib/conferencias/avisos-de-conferencia.ts).
  O catálogo é conferido contra o caso dourado compartilhado com o pytest
  (tests/fixtures/conferencias/catalogo.json ↔ scripts/conferencias/catalogo.py).
*/
  const DOURADO = JSON.parse(
    readFileSync("tests/fixtures/conferencias/catalogo.json", "utf8"),
  );

  const PAYLOAD = {
    schema_version: 1,
    gerado_em: "2026-10-05T09:10:00Z",
    ultima_execucao: {
      inicio: "2026-10-05T09:00:00Z",
      fim: "2026-10-05T09:02:00Z",
      situacao: "CONCLUIDA",
    },
    avisos: [
      {
        id: "a2",
        conferencia: "CLASSIFICACAO_VAGA_SEM_QUADRO",
        escopo: "edital:e1",
        gravidade: "ATENCAO",
        modulo: "classificacao",
        area: "saude-indigena",
        edital_id: "e1",
        edital: "101/2026",
        quantidade: 2,
        exemplos: ["180001", "180002"],
        resumo:
          "2 vagas das análises sem linha no quadro de vagas no edital 101/2026.",
        situacao: "ABERTO",
        primeira_vez: "2026-10-04T09:00:00Z",
        ultima_vez: "2026-10-05T09:00:00Z",
        tratamento: "AGUARDANDO_DOCUMENTO",
        motivo: "Falta o quadro retificado.",
        responsavel_id: "u1",
        responsavel: "Pessoa Fictícia",
        prazo: "2026-10-10",
        evidencias: 2,
        pode_gerir: true,
        pode_tratar: true,
      },
      {
        id: "a1",
        conferencia: "ANALISE_APROVADA_ABAIXO_DO_CORTE",
        escopo: "edital:e1",
        gravidade: "CRITICA",
        modulo: "analises",
        area: "saude-indigena",
        edital_id: "e1",
        edital: "101/2026",
        quantidade: 1,
        exemplos: [],
        resumo: "1 análise aprovada com nota abaixo de 60 no edital 101/2026.",
        situacao: "ABERTO",
        primeira_vez: "2026-10-05T09:00:00Z",
      },
      {
        id: "a3",
        conferencia: "CARGA_VARIACAO_BRUSCA",
        escopo: "vaga:177979",
        gravidade: "ATENCAO",
        modulo: "cargas",
        quantidade: 1,
        resumo: "Vaga 177979: candidatos foram de 1200 para 300.",
        situacao: "ABERTO",
        tratamento: "DISPENSADO",
        tratado_em: "2026-10-05T10:00:00Z",
        motivo: "Vaga encerrada na Empregare.",
      },
      {
        id: "a4",
        conferencia: "ENTREVISTA_HORARIO_DUPLICADO",
        escopo: "edital:e2",
        gravidade: "ATENCAO",
        modulo: "entrevistas",
        area: "saude-indigena",
        edital_id: "e2",
        edital: "80/2026",
        quantidade: 1,
        resumo:
          "1 candidato com mais de um horário de entrevista no edital 80/2026.",
        situacao: "RESOLVIDO",
        resolvido_em: "2026-10-05T09:02:00Z",
        tratamento: "RECHECADO_SEM_PROBLEMA",
      },
    ],
  };

  describe("catálogo das conferências", () => {
    it("igual ao caso dourado compartilhado com o pytest", () => {
      expect(JSON.parse(JSON.stringify(CONFERENCIAS))).toEqual(
        DOURADO.conferencias,
      );
    });

    it("título de código desconhecido é o próprio código", () => {
      expect(tituloDaConferencia("NOVA_CONFERENCIA")).toBe("NOVA_CONFERENCIA");
    });
  });

  describe("normalizarAvisos", () => {
    const lista = normalizarAvisos(PAYLOAD);

    it("abertos por gravidade; dispensados e resolvidos à parte", () => {
      expect(lista.abertos.map((a) => a.id)).toEqual(["a1", "a2"]);
      expect(lista.dispensados.map((a) => a.id)).toEqual(["a3"]);
      expect(lista.resolvidos.map((a) => a.id)).toEqual(["a4"]);
      expect(lista.abertos[0]).toMatchObject({
        titulo: "Aprovada com nota abaixo da mínima",
        tom: "perigo",
        rotuloDaGravidade: "Crítico",
        onde: "Edital 101/2026",
        tratamento: "PENDENTE",
        podeGerir: false,
        podeTratar: false,
      });
      expect(lista.abertos[1]).toMatchObject({
        tratamento: "AGUARDANDO_DOCUMENTO",
        motivo: "Falta o quadro retificado.",
        responsavelId: "u1",
        responsavel: "Pessoa Fictícia",
        prazo: "2026-10-10",
        evidencias: 2,
        podeGerir: true,
        podeTratar: true,
      });
      expect(lista.abertos[1].ultimaVez).toEqual(
        new Date("2026-10-05T09:00:00Z"),
      );
      expect(lista.dispensados[0]).toMatchObject({
        onde: "Vaga 177979",
        motivo: "Vaga encerrada na Empregare.",
      });
      expect(lista.resolvidos[0]).toMatchObject({
        situacao: "RESOLVIDO",
        tratamento: "RECHECADO_SEM_PROBLEMA",
      });
      expect(lista.ultimaExecucao.situacao).toBe("CONCLUIDA");
    });

    it("payload vazio ou estranho não quebra", () => {
      expect(normalizarAvisos(null)).toMatchObject({
        abertos: [],
        dispensados: [],
        resolvidos: [],
        ultimaExecucao: null,
      });
      expect(
        normalizarAvisos({ avisos: [{ id: "x", tratamento: "OUTRO" }] })
          .abertos[0].tratamento,
      ).toBe("PENDENTE");
    });

    it("contagem e tom do selo por módulo; filtro por módulo", () => {
      expect(contagemPorModulo(lista)).toEqual({
        analises: 1,
        entrevistas: 0,
        classificacao: 1,
        aprovados: 0,
        cargas: 0,
        editais: 0,
      });
      expect(tomDoSelo(lista.abertos)).toBe("perigo");
      expect(tomDoSelo([])).toBeNull();
      const so = filtrarPorModulo(lista, "cargas");
      expect(so.abertos).toEqual([]);
      expect(so.dispensados.map((a) => a.id)).toEqual(["a3"]);
      expect(filtrarPorModulo(lista, "entrevistas").resolvidos).toHaveLength(1);
      expect(filtrarPorModulo(lista, "todos")).toBe(lista);
    });
  });

  describe("textos", () => {
    it("onde: edital, vaga ou área", () => {
      expect(ondeDoAviso({ escopo: "area:sede", area: "sede" })).toBe("SEDE");
      expect(ondeDoAviso({ escopo: "area:sem-area" })).toBe("Sem área");
    });

    it("dia do aviso", () => {
      expect(diaDoAviso(new Date(2026, 9, 5))).toBe("05/10/2026");
      expect(diaDoAviso(null)).toBe("—");
    });
  });

  describe("central de avisos", () => {
    const [a1, a2] = normalizarAvisos(PAYLOAD).abertos;

    it("o gestor dispensa; o responsável só trata; o rechecado é da conferência", () => {
      expect(opcoesDeTratamento(a2)).toEqual([
        "EM_ANALISE",
        "AGUARDANDO_DOCUMENTO",
        "CORRIGIDO",
        "DISPENSADO",
      ]);
      expect(
        opcoesDeTratamento({ podeGerir: false, podeTratar: true }),
      ).toEqual(["EM_ANALISE", "AGUARDANDO_DOCUMENTO", "CORRIGIDO"]);
      expect(opcoesDeTratamento(a1)).toEqual([]);
    });

    it("motivo: dispensar pede 10; aguardando e corrigido, 3; em análise, opcional; sem CPF nem e-mail", () => {
      expect(erroDoMotivoDoTratamento("DISPENSADO", "curto")).toMatch(
        /justificativa.*10/,
      );
      expect(
        erroDoMotivoDoTratamento("DISPENSADO", "Vaga cancelada no edital."),
      ).toBe("");
      expect(erroDoMotivoDoTratamento("CORRIGIDO", "")).toMatch(/pelo menos 3/);
      expect(erroDoMotivoDoTratamento("AGUARDANDO_DOCUMENTO", "SEI")).toBe("");
      expect(erroDoMotivoDoTratamento("EM_ANALISE", "")).toBe("");
      expect(erroDoMotivoDoTratamento("EM_ANALISE", "x".repeat(501))).toMatch(
        /500/,
      );
      expect(erroDoMotivoDoTratamento("CORRIGIDO", "CPF 00000000191")).toMatch(
        /CPF/,
      );
      expect(
        erroDoMotivoDoTratamento("CORRIGIDO", "pessoa@exemplo.invalid"),
      ).toMatch(/e-mail/);
    });

    it("prazo vencido só depois do dia", () => {
      expect(prazoVencido("2026-10-10", "2026-10-11")).toBe(true);
      expect(prazoVencido("2026-10-10", "2026-10-10")).toBe(false);
      expect(prazoVencido(null, "2026-10-11")).toBe(false);
    });

    it("agrupa por edital, o mais grave primeiro", () => {
      const grupos = agruparPorEdital(normalizarAvisos(PAYLOAD).abertos);
      expect(grupos.map((g) => [g.titulo, g.avisos.map((a) => a.id)])).toEqual([
        ["Edital 101/2026", ["a1", "a2"]],
      ]);
    });

    it("evidência: tipo, descrição, link https e sem dado pessoal", () => {
      expect(erroDaEvidencia({ tipo: "SEI", descricao: "" })).toMatch(/SEI/);
      expect(
        erroDaEvidencia({ tipo: "SEI", descricao: "25000.000001/2026-01" }),
      ).toBe("");
      expect(erroDaEvidencia({ tipo: "LINK", descricao: "Ata" })).toMatch(
        /link/,
      );
      expect(
        erroDaEvidencia({ tipo: "LINK", descricao: "Ata", url: "http://x" }),
      ).toMatch(/https/);
      expect(
        erroDaEvidencia({ tipo: "NOTA", descricao: "pessoa@exemplo.invalid" }),
      ).toMatch(/e-mail/);
      expect(erroDaEvidencia({ tipo: "OUTRO", descricao: "Ata" })).toMatch(
        /tipo/,
      );
    });

    it("chave estável do caso para a evidência", () => {
      expect(chaveDoCaso({ analiseId: "an1", codigo: "C1" })).toBe(
        "analise:an1",
      );
      expect(chaveDoCaso({ codigo: "C1" })).toBe("codigo:C1");
      expect(chaveDoCaso({ aprovadoId: "ap1" })).toBe("referencia:ap1");
      expect(chaveDoCaso({})).toBeNull();
    });

    it("histórico: o que aconteceu, quem (ou a conferência) e as evidências", () => {
      const h = normalizarHistorico({
        eventos: [
          {
            id: 3,
            evento: "NAO_ACHADO",
            tratamento: "RECHECADO_SEM_PROBLEMA",
            robo: true,
            em: "2026-10-06T09:00:00Z",
          },
          {
            id: 2,
            evento: "TRATAMENTO",
            tratamento: "CORRIGIDO",
            motivo: "Nota refeita.",
            por: "Pessoa Fictícia",
          },
          {
            id: 1,
            evento: "RESPONSAVEL",
            responsavel: "Pessoa Fictícia",
            prazo: "2026-10-10",
          },
          { id: 0, evento: "MIGRADO", motivo: "Vaga encerrada." },
        ],
        evidencias: [
          {
            id: "ev1",
            tipo: "LINK",
            descricao: "Ata",
            url: "https://exemplo.invalid/ata",
            ativa: true,
          },
          {
            id: "ev2",
            tipo: "X",
            descricao: "Nota",
            url: "javascript:alert(1)",
            ativa: false,
          },
        ],
      });
      expect(h.eventos.map((e) => e.texto)).toEqual([
        "Rechecado sem problema",
        "Corrigido",
        "Responsável: Pessoa Fictícia, até 10/10/2026",
        "Dispensado (era “ignorado”)",
      ]);
      expect(h.eventos[0].por).toBe("Conferência automática");
      expect(h.eventos[1]).toMatchObject({
        por: "Pessoa Fictícia",
        motivo: "Nota refeita.",
      });
      expect(h.evidencias[0]).toMatchObject({
        tipo: "LINK",
        url: "https://exemplo.invalid/ata",
        ativa: true,
      });
      expect(h.evidencias[1]).toMatchObject({
        tipo: "NOTA",
        url: null,
        ativa: false,
      });
      expect(normalizarHistorico(null)).toEqual({
        eventos: [],
        evidencias: [],
      });
    });
  });
});

bloco("background-resource-lifecycle", () => {
  describe("background resource lifecycle", () => {
    it("usa atraso de dois minutos antes de suspender recursos", () => {
      expect(BACKGROUND_SUSPEND_DELAY_MS).toBe(120000);
    });

    it("suspende somente quando a aba está oculta", () => {
      expect(shouldSuspendBackgroundResources("hidden")).toBe(true);
      expect(shouldSuspendBackgroundResources("visible")).toBe(false);
      expect(shouldSuspendBackgroundResources("prerender")).toBe(false);
    });
  });
});

bloco("cache-do-painel-de-analises", () => {
  const payload = (geradoEm, total = 2) => ({
    schema_version: 4,
    columns: ["id", "candidato"],
    rows: Array.from({ length: total }, (_, i) => [`id${i}`, `Pessoa ${i}`]),
    editais: [],
    total,
    generated_at: geradoEm,
    cache: { hit: true, refreshed_at: geradoEm },
  });

  /** Armazenamento em memória com a interface que o IndexedDB entrega. */
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

  const armazenamentoQueFalha = {
    ler: async () => {
      throw new Error("QuotaExceeded");
    },
    guardar: async () => {
      throw new Error("QuotaExceeded");
    },
    apagarTudo: async () => {
      throw new Error("bloqueado");
    },
  };

  const U1 = { usuarioId: "u1", area: "saude-indigena", escopo: "ativo" };

  describe("cópia do painel de análises no navegador", () => {
    it("guarda e devolve o payload do mesmo usuário, área e escopo", async () => {
      const cache = criarCacheDoPainel({
        armazenamento: armazenamentoEmMemoria(),
        versao: "v1",
      });
      expect(await cache.ler(U1)).toBeNull();
      expect(await cache.guardar(U1, payload("10:00"))).toBe(true);
      expect(await cache.ler(U1)).toEqual(payload("10:00"));
    });

    it("áreas e escopos nunca se misturam", async () => {
      const cache = criarCacheDoPainel({
        armazenamento: armazenamentoEmMemoria(),
        versao: "v1",
      });
      await cache.guardar(U1, payload("10:00"));
      expect(await cache.ler({ ...U1, area: "projetos" })).toBeNull();
      expect(await cache.ler({ ...U1, escopo: "todos" })).toBeNull();
    });

    it("outro usuário não vê a cópia e ela é apagada", async () => {
      const armazenamento = armazenamentoEmMemoria();
      const cache = criarCacheDoPainel({ armazenamento, versao: "v1" });
      await cache.guardar(U1, payload("10:00"));
      await cache.guardar({ ...U1, area: "projetos" }, payload("10:00"));

      expect(await cache.ler({ ...U1, usuarioId: "u2" })).toBeNull();
      expect(armazenamento.dados.size).toBe(0);
      expect(await cache.ler(U1)).toBeNull();
    });

    it("sem usuário, nada é lido nem guardado", async () => {
      const armazenamento = armazenamentoEmMemoria();
      const cache = criarCacheDoPainel({ armazenamento, versao: "v1" });
      expect(await cache.guardar({ ...U1, usuarioId: "" }, payload("1"))).toBe(
        false,
      );
      expect(armazenamento.dados.size).toBe(0);
      expect(await cache.ler({ ...U1, usuarioId: "" })).toBeNull();
    });

    it("publicação nova do painel invalida a cópia", async () => {
      const armazenamento = armazenamentoEmMemoria();
      await criarCacheDoPainel({ armazenamento, versao: "v1" }).guardar(
        U1,
        payload("10:00"),
      );
      const depoisDoDeploy = criarCacheDoPainel({
        armazenamento,
        versao: "v2",
      });
      expect(await depoisDoDeploy.ler(U1)).toBeNull();
    });

    it("aceita a lista enxuta (4) e a de 35 colunas (3), que o servidor manda até a migration", async () => {
      expect(ESQUEMAS_DO_PAYLOAD).toEqual([3, 4]);
      const armazenamento = armazenamentoEmMemoria();
      const cache = criarCacheDoPainel({ armazenamento, versao: "v1" });
      expect(
        await cache.guardar(U1, { ...payload("1"), schema_version: 3 }),
      ).toBe(true);
      expect((await cache.ler(U1))?.schema_version).toBe(3);
    });

    it("payload de outro schema_version não é guardado", async () => {
      const armazenamento = armazenamentoEmMemoria();
      const cache = criarCacheDoPainel({ armazenamento, versao: "v1" });
      expect(
        await cache.guardar(U1, { ...payload("1"), schema_version: 2 }),
      ).toBe(false);
      expect(armazenamento.dados.has(CHAVE_DO_DONO)).toBe(false);
    });

    it("cópia vencida não serve", async () => {
      let agora = 1_000;
      const armazenamento = armazenamentoEmMemoria();
      const cache = criarCacheDoPainel({
        armazenamento,
        versao: "v1",
        relogio: () => agora,
      });
      await cache.guardar(U1, payload("10:00"));
      agora += VALIDADE_DO_CACHE_MS;
      expect(await cache.ler(U1)).not.toBeNull();
      agora += 1;
      expect(await cache.ler(U1)).toBeNull();
    });

    it("registro corrompido vira 'não há cópia'", async () => {
      const armazenamento = armazenamentoEmMemoria();
      const cache = criarCacheDoPainel({ armazenamento, versao: "v1" });
      await cache.guardar(U1, payload("10:00"));
      const chave = [...armazenamento.dados.keys()].find(
        (k) => k !== CHAVE_DO_DONO,
      );
      armazenamento.dados.get(chave).texto = "{quebrado";
      expect(await cache.ler(U1)).toBeNull();
    });

    it("armazenamento cheio ou bloqueado nunca lança erro", async () => {
      const cache = criarCacheDoPainel({
        armazenamento: armazenamentoQueFalha,
        versao: "v1",
      });
      await expect(cache.ler(U1)).resolves.toBeNull();
      await expect(cache.guardar(U1, payload("1"))).resolves.toBe(false);
      await expect(cache.apagarTudo()).resolves.toBeUndefined();
    });
  });

  describe("quando redesenhar", () => {
    it("só quando o servidor montou outro payload", () => {
      expect(payloadMudou(payload("10:00"), payload("10:00"))).toBe(false);
      expect(payloadMudou(payload("10:00"), payload("10:30"))).toBe(true);
      expect(payloadMudou(payload("10:00", 2), payload("10:00", 3))).toBe(true);
      expect(payloadMudou(payload(""), payload(""))).toBe(true);
      expect(payloadMudou(null, payload("10:00"))).toBe(true);
    });
  });

  describe("revalidação por trás da cópia", () => {
    const base = () => ({
      guardar: vi.fn(async () => true),
      aoMudar: vi.fn(),
      aoPerderAcesso: vi.fn(),
      apagarTudo: vi.fn(async () => {}),
    });

    it("dados iguais: guarda e não redesenha", async () => {
      const f = base();
      await revalidarPayload({
        ...f,
        guardado: payload("10:00"),
        buscar: async () => payload("10:00"),
      });
      expect(f.guardar).toHaveBeenCalledOnce();
      expect(f.aoMudar).not.toHaveBeenCalled();
    });

    it("dados novos: guarda e redesenha com eles", async () => {
      const f = base();
      const novo = payload("10:30", 3);
      await revalidarPayload({
        ...f,
        guardado: payload("10:00"),
        buscar: async () => novo,
      });
      expect(f.guardar).toHaveBeenCalledWith(novo);
      expect(f.aoMudar).toHaveBeenCalledWith(novo);
    });

    it("acesso revogado (42501) ou área inválida (22023) apaga as cópias", async () => {
      for (const code of ["42501", "22023"]) {
        const f = base();
        await revalidarPayload({
          ...f,
          guardado: payload("10:00"),
          buscar: async () => {
            throw Object.assign(new Error("sem acesso"), { code });
          },
        });
        expect(f.apagarTudo).toHaveBeenCalledOnce();
        expect(f.aoPerderAcesso).toHaveBeenCalledOnce();
        expect(f.aoMudar).not.toHaveBeenCalled();
      }
    });

    it("falha de rede mantém a cópia na tela", async () => {
      const f = base();
      const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
      await revalidarPayload({
        ...f,
        guardado: payload("10:00"),
        buscar: async () => {
          throw new Error("Failed to fetch");
        },
      });
      expect(f.apagarTudo).not.toHaveBeenCalled();
      expect(f.aoPerderAcesso).not.toHaveBeenCalled();
      expect(f.aoMudar).not.toHaveBeenCalled();
      aviso.mockRestore();
    });
  });

  describe("cache antigo no localStorage", () => {
    it("todas as chaves agsus_analises_cache_* e o marcador saem; o resto fica", () => {
      expect(
        chavesDoCacheAntigo([
          "agsus_analises_cache_v1_v5_u1_ativo",
          "agsus_analises_cache_v1_v4_u1_projetos_todos",
          "agsus_analises_responsavel_normalizado_v1",
          "agsus_analises_theme_v3",
          "sb-auth-token",
          null,
        ]),
      ).toEqual([
        "agsus_analises_cache_v1_v5_u1_ativo",
        "agsus_analises_cache_v1_v4_u1_projetos_todos",
        "agsus_analises_responsavel_normalizado_v1",
      ]);
    });
  });

  describe("armazenamento no IndexedDB", () => {
    const original = globalThis.indexedDB;
    afterEach(() => {
      globalThis.indexedDB = original;
    });

    it("o painel guarda e lê pelo IndexedDB; o Yeendé apaga o banco inteiro", async () => {
      const falso = indexedDBFalso();
      globalThis.indexedDB = falso;
      const cache = criarCacheDoPainel({
        armazenamento: armazenamentoDePayload,
        versao: "v1",
      });
      expect(await cache.guardar(U1, payload("10:00"))).toBe(true);
      expect(await cache.ler(U1)).toEqual(payload("10:00"));
      expect(falso.bancos.has("agsus-monitora-analises")).toBe(true);

      await apagarCacheDePayload();
      expect(falso.bancos.has("agsus-monitora-analises")).toBe(false);
      expect(await cache.ler(U1)).toBeNull();
    });

    it("sem IndexedDB (janela anônima, bloqueado), o painel segue pela rede", async () => {
      globalThis.indexedDB = undefined;
      const cache = criarCacheDoPainel({
        armazenamento: armazenamentoDePayload,
        versao: "v1",
      });
      await expect(cache.guardar(U1, payload("1"))).resolves.toBe(false);
      await expect(cache.ler(U1)).resolves.toBeNull();
      await expect(apagarCacheDePayload()).resolves.toBeUndefined();
    });
  });
});

bloco("calendario-editais-lista", () => {
  /*
  As regras das vistas Lista e Semana do Cronograma. As etapas passam pelo
  mesmo parser da carga (`montarEtapasDosEditais`), para os testes verem as
  datas como a tela as vê — inclusive as que chegam como timestamp.
*/

  const EDITAL = { id: 1, unidade: "DSEI Yanomami", edital: "20/2026" };
  const etapas = (...brutas) =>
    montarEtapasDosEditais(
      [{ ...EDITAL, cronograma_total: brutas.length }],
      [brutas.map((etapa, indice) => ({ ordem: indice + 1, ...etapa }))],
    ).etapas;

  const CARREGADAS = etapas(
    {
      atividade: "Inscrições",
      data_inicio: "2026-11-01",
      data_fim: "2026-11-03",
    },
    {
      atividade: "Prazo de recurso",
      data_inicio: "2026-10-20",
      data_fim: "2026-11-20",
    },
    // Timestamp à meia-noite: tem de cair em 30/11, não em 29/11.
    {
      atividade: "Entrevistas",
      data_inicio: "2026-11-30T00:00:00",
      data_fim: "2026-12-02T23:59:59",
    },
    {
      atividade: "Resultado final",
      data_inicio: "2026-11-10",
      data_fim: "2026-11-10",
    },
  );
  // A carga ordena pelo início; aqui cada uma é achada pelo nome.
  const pelaAtividade = (nome) =>
    CARREGADAS.find((etapa) => etapa.atividade === nome);
  const CURTA = pelaAtividade("Inscrições");
  const VIRADA = pelaAtividade("Entrevistas");
  const PONTUAL = pelaAtividade("Resultado final");
  const TODAS = CARREGADAS;

  describe("marcaNoDia (começa ou termina no dia)", () => {
    it("marca o começo, o último dia, o dia único e os dias pelo meio", () => {
      expect(marcaNoDia(CURTA, "2026-11-01")).toBe("começa");
      expect(marcaNoDia(CURTA, "2026-11-02")).toBe("em andamento");
      expect(marcaNoDia(CURTA, "2026-11-03")).toBe("último dia");
      expect(marcaNoDia(PONTUAL, "2026-11-10")).toBe("no dia");
      expect(marcaNoDia(CURTA, "2026-10-31")).toBeNull();
      expect(marcaNoDia(CURTA, "2026-11-04")).toBeNull();
    });

    it("o timestamp à meia-noite fica no próprio dia (sem fuso a empurrar)", () => {
      expect(VIRADA.data_inicio).toBe("2026-11-30");
      expect(marcaNoDia(VIRADA, "2026-11-29")).toBeNull();
      expect(marcaNoDia(VIRADA, "2026-11-30")).toBe("começa");
      expect(marcaNoDia(VIRADA, "2026-12-02")).toBe("último dia");
    });
  });

  describe("diasDaLista", () => {
    const { inicio, fim } = intervaloDoMes(new Date(2026, 10, 15));

    it("agrupa por dia só o que começa ou termina, sem repetir o período longo", () => {
      const dias = diasDaLista(TODAS, inicio, fim, 2026);
      expect(dias.map((dia) => dia.chave)).toEqual([
        "2026-11-01",
        "2026-11-03",
        "2026-11-10",
        "2026-11-20",
        "2026-11-30",
      ]);
      expect(dias[0].titulo).toBe("Dom, 1 de novembro");
      expect(
        dias.map((dia) =>
          dia.itens.map(({ etapa, marca }) => `${etapa.atividade}:${marca}`),
        ),
      ).toEqual([
        ["Inscrições:começa"],
        ["Inscrições:último dia"],
        ["Resultado final:no dia"],
        ["Prazo de recurso:último dia"],
        ["Entrevistas:começa"],
      ]);
    });

    it("respeita as bordas do mês: o fim em dezembro não entra em novembro", () => {
      const dezembro = intervaloDoMes(new Date(2026, 11, 1));
      expect(dezembro).toEqual({ inicio: "2026-12-01", fim: "2026-12-31" });
      const dias = diasDaLista(TODAS, dezembro.inicio, dezembro.fim);
      expect(dias.map((dia) => dia.chave)).toEqual(["2026-12-02"]);
    });

    it("fevereiro e a virada do ano têm a última chave certa", () => {
      expect(intervaloDoMes(new Date(2028, 1, 10)).fim).toBe("2028-02-29");
      expect(intervaloDoMes(new Date(2026, 11, 31, 23, 59)).fim).toBe(
        "2026-12-31",
      );
    });

    it("deixa de fora a etapa de data impossível", () => {
      const [errada] = etapas({
        atividade: "Ano digitado errado",
        data_inicio: "0202-11-05",
        data_fim: "0202-11-06",
      });
      expect(diasDaLista([errada], "0202-11-01", "0202-11-30")).toEqual([]);
      expect(emAndamentoNoDia([errada], "0202-11-05")).toEqual([]);
    });
  });

  describe("emAndamentoNoDia", () => {
    it("só o que atravessa o dia — começar ou terminar nele não conta", () => {
      expect(
        emAndamentoNoDia(TODAS, "2026-11-02").map((etapa) => etapa.atividade),
      ).toEqual(["Inscrições", "Prazo de recurso"]);
      expect(
        emAndamentoNoDia(TODAS, "2026-11-01").map((etapa) => etapa.atividade),
      ).toEqual(["Prazo de recurso"]);
      expect(emAndamentoNoDia(TODAS, "2026-11-20")).toEqual([]);
    });

    it("vem pelo fim mais próximo", () => {
      expect(
        emAndamentoNoDia(TODAS, "2026-12-01").map((etapa) => etapa.atividade),
      ).toEqual(["Entrevistas"]);
    });

    it("hoje às 23h30 e às 00h30 do dia seguinte são dias diferentes", () => {
      expect(chaveDoDia(new Date(2026, 10, 2, 23, 30))).toBe("2026-11-02");
      expect(chaveDoDia(new Date(2026, 10, 3, 0, 30))).toBe("2026-11-03");
      const noite = emAndamentoNoDia(
        TODAS,
        chaveDoDia(new Date(2026, 10, 2, 23, 30)),
      );
      const madrugada = emAndamentoNoDia(
        TODAS,
        chaveDoDia(new Date(2026, 10, 3, 0, 30)),
      );
      expect(noite.map((etapa) => etapa.atividade)).toContain("Inscrições");
      expect(madrugada.map((etapa) => etapa.atividade)).not.toContain(
        "Inscrições",
      );
    });
  });

  describe("semana", () => {
    it("começa no domingo e atravessa o mês e o ano", () => {
      const inicio = inicioDaSemana(new Date(2026, 11, 31, 0, 5));
      expect(chaveDoDia(inicio)).toBe("2026-12-27");
      expect(chavesDaSemana(inicio)).toEqual([
        "2026-12-27",
        "2026-12-28",
        "2026-12-29",
        "2026-12-30",
        "2026-12-31",
        "2027-01-01",
        "2027-01-02",
      ]);
      expect(rotuloDaSemana(inicio)).toBe(
        "27 de dezembro de 2026 a 2 de janeiro de 2027",
      );
      expect(rotuloDaSemana(inicioDaSemana(new Date(2026, 10, 3)))).toBe(
        "1 a 7 de novembro de 2026",
      );
      expect(rotuloDaSemana(inicioDaSemana(new Date(2026, 10, 30)))).toBe(
        "29 de novembro a 5 de dezembro de 2026",
      );
    });

    it("lista as ativas no dia, as pontas antes do que só atravessa", () => {
      expect(
        etapasAtivasNoDia(TODAS, "2026-11-02").map(
          ({ etapa, marca }) => `${etapa.atividade}:${marca}`,
        ),
      ).toEqual(["Prazo de recurso:em andamento", "Inscrições:em andamento"]);
      expect(
        etapasAtivasNoDia(TODAS, "2026-11-03").map(({ marca }) => marca),
      ).toEqual(["último dia", "em andamento"]);
      expect(contarEtapasNoIntervalo(TODAS, "2026-11-01", "2026-11-07")).toBe(
        2,
      );
    });
  });

  describe("dentro do dia: pela legenda, depois pela unidade", () => {
    const varias = montarEtapasDosEditais(
      [
        { id: 1, unidade: "DSEI Xingu", edital: "1/2026", cronograma_total: 2 },
        {
          id: 2,
          unidade: "DSEI Alto Rio Purus",
          edital: "2/2026",
          cronograma_total: 2,
        },
      ],
      [
        [
          {
            atividade: "Período de Entrevistas",
            data_inicio: "2026-11-03",
            data_fim: "2026-11-03",
            ordem: 1,
          },
          {
            atividade: "Prazo de recurso",
            data_inicio: "2026-11-03",
            data_fim: "2026-11-03",
            ordem: 2,
          },
        ],
        [
          {
            atividade: "Período de Entrevistas",
            data_inicio: "2026-11-03",
            data_fim: "2026-11-03",
            ordem: 1,
          },
          {
            atividade: "Resultado final do processo seletivo",
            data_inicio: "2026-11-03",
            data_fim: "2026-11-03",
            ordem: 2,
          },
        ],
      ],
    ).etapas;

    it("Recursos, Resultado final, Entrevistas; empate pela unidade", () => {
      const [dia] = diasDaLista(varias, "2026-11-01", "2026-11-30", 2026);
      expect(
        dia.itens.map(({ etapa }) => `${etapa.tipo.rotulo}:${etapa.unidade}`),
      ).toEqual([
        "Recursos:DSEI Xingu",
        "Resultado final:DSEI Alto Rio Purus",
        "Entrevistas:DSEI Alto Rio Purus",
        "Entrevistas:DSEI Xingu",
      ]);
    });
  });

  describe("marcos do mês (chips só no início e no fim)", () => {
    const grade = montarGradeDoMes(new Date(2026, 10, 1), TODAS, {
      hoje: new Date(2026, 10, 1),
    });
    const dia = (chave) => grade.find((celula) => celula.chave === chave);
    const marcos = (chave) =>
      dia(chave).marcos.map(
        ({ etapa, marca }) => `${etapa.atividade}:${marca}`,
      );

    it("a etapa com período aparece só no dia em que começa e no dia em que termina", () => {
      expect(marcos("2026-11-01")).toEqual(["Inscrições:começa"]);
      expect(marcos("2026-11-03")).toEqual(["Inscrições:último dia"]);
      expect(marcos("2026-11-20")).toEqual(["Prazo de recurso:último dia"]);
    });

    it("o dia do meio fica sem chip, mas a etapa continua ativa nele", () => {
      expect(marcos("2026-11-02")).toEqual([]);
      expect(dia("2026-11-02").pontos).toEqual([]);
      // O recurso e as inscrições atravessam o dia 2: o popup lista as duas.
      expect(dia("2026-11-02").total).toBe(2);
      expect(dia("2026-11-02").rotulo).toBe(
        "2 de novembro: 2 etapas, 2 em andamento",
      );
    });

    it("a etapa de um dia é um chip no próprio dia", () => {
      expect(marcos("2026-11-10")).toEqual(["Resultado final:no dia"]);
      expect(dia("2026-11-10").rotulo).toBe(
        "10 de novembro: 2 etapas, 1 em andamento",
      );
    });
  });

  describe("filtro de tipo da legenda", () => {
    it("os tipos desligados saem das etapas e da contagem do mês", () => {
      const semResultado = filtrarEtapas(TODAS, FILTROS_VAZIOS, {
        hoje: new Date(2026, 10, 1),
        tiposOcultos: ["resultado"],
      });
      expect(semResultado.map(({ atividade }) => atividade)).not.toContain(
        "Resultado final",
      );
      expect(contarEtapasNoMes(semResultado, new Date(2026, 10, 1))).toBe(
        contarEtapasNoMes(TODAS, new Date(2026, 10, 1)) - 1,
      );
    });

    it("alterna um tipo e só aceita, do que estava guardado, tipos da legenda", () => {
      expect(alternarTipoOculto([], "recursos")).toEqual(["recursos"]);
      expect(alternarTipoOculto(["recursos", "outros"], "recursos")).toEqual([
        "outros",
      ]);
      expect(
        tiposOcultosValidos('["recursos","inventado","recursos"]'),
      ).toEqual(["recursos"]);
      expect(tiposOcultosValidos("{quebrado")).toEqual([]);
      expect(tiposOcultosValidos(null)).toEqual([]);
    });
  });

  describe("textos curtos", () => {
    it("tira o 'DSEI ' da frente; o resto fica como está", () => {
      expect(unidadeCurta("DSEI Alto Rio Purus")).toBe("Alto Rio Purus");
      expect(unidadeCurta("dsei - Litoral Sul")).toBe("Litoral Sul");
      expect(unidadeCurta("CASAI São Paulo")).toBe("CASAI São Paulo");
      expect(unidadeCurta("DSEI")).toBe("DSEI");
    });

    it("o edital sai como está guardado, sem inventar ano nem repetir 'Ed.'", () => {
      expect(rotuloDoNumeroDoEdital("112/2026")).toBe("Ed. 112/2026");
      expect(rotuloDoNumeroDoEdital("115")).toBe("Ed. 115");
      expect(rotuloDoNumeroDoEdital("Edital 115")).toBe("Ed. 115");
      expect(rotuloDoNumeroDoEdital("Ed. 115")).toBe("Ed. 115");
    });
  });

  describe("vista inicial e cabeçalho do dia", () => {
    it("guardada vale; senão Mês no computador e Lista no celular", () => {
      expect(visaoInicial("semana", true)).toBe("semana");
      expect(visaoInicial(null, false)).toBe("mes");
      expect(visaoInicial(null, true)).toBe("lista");
      expect(visaoInicial("ano", false)).toBe("mes");
    });

    it("o cabeçalho do dia é curto; o ano só quando não é o de hoje", () => {
      expect(cabecalhoDoDiaDaLista("2026-11-03", 2026)).toBe(
        "Ter, 3 de novembro",
      );
      expect(cabecalhoDoDiaDaLista("2027-01-01", 2026)).toBe(
        "Sex, 1 de janeiro de 2027",
      );
    });
  });
});

bloco("calendario-editais", () => {
  const RESUMO = [
    { id: 1, unidade: "DSEI Manaus", edital: "10/2026", cronograma_total: 1 },
  ];
  const ETAPA = {
    monitoramento_id: 1,
    atividade: "Entrevista",
    data_inicio: "2026-09-15T12:00:00",
    data_fim: "2026-09-17",
    ordem: 1,
  };
  const auth = {
    getSession: async () => ({
      data: { session: { access_token: "token-falso" } },
      error: null,
    }),
  };

  describe("normalização das respostas do calendário", () => {
    it("só solicita cronogramas com ID utilizável e contagem positiva", () => {
      expect(
        editaisComCronograma([
          ...RESUMO,
          { id: "uuid", cronograma_total: "2" },
          null,
          false,
          [],
          { cronograma_total: 1 },
          { id: {}, cronograma_total: 1 },
          { id: "", cronograma_total: 1 },
          { id: 2, cronograma_total: "inválida" },
          { id: 3, cronograma_total: "Infinity" },
          { id: 5, cronograma_total: { toString: null, valueOf: null } },
          { id: 4, cronograma_total: 0 },
        ]),
      ).toEqual([
        ...RESUMO,
        {
          id: "uuid",
          cronograma_total: 2,
          unidade: "Unidade não informada",
          edital: "Edital sem número",
        },
      ]);
      expect(editaisComCronograma({ id: 1 })).toEqual([]);
    });

    it("ignora etapas malformadas, normaliza timestamps e conserva os marcos do intervalo", () => {
      const { etapas, editais, falhas } = montarEtapasDosEditais(
        editaisComCronograma(RESUMO),
        [[null, 7, [], {}, { data_inicio: "sem data" }, ETAPA]],
      );
      expect(etapas).toHaveLength(1);
      expect(etapas[0]).toMatchObject({
        editalId: "1",
        data_inicio: "2026-09-15",
        data_fim: "2026-09-17",
        tipo: { id: "entrevistas" },
      });
      expect(editais).toEqual([
        { id: "1", unidade: "DSEI Manaus", edital: "10/2026" },
      ]);
      expect(falhas).toBe(0);
      const grade = montarGradeDoMes(new Date(2026, 8, 1), etapas, {
        hoje: new Date(2026, 8, 15),
      });
      expect(grade).toHaveLength(42);
      expect(grade.find((c) => c.chave === "2026-09-15")).toMatchObject({
        hoje: true,
        total: 1,
      });
      // O dia do meio conta como ativo (o popup lista), mas não tem chip.
      expect(grade.find((c) => c.chave === "2026-09-16")).toMatchObject({
        total: 1,
        marcos: [],
      });
      expect(etapasAtivasNoDia(etapas, "2026-09-15")[0].marca).toBe("começa");
      expect(etapasAtivasNoDia(etapas, "2026-09-16")[0].marca).toBe(
        "em andamento",
      );
      expect(etapasAtivasNoDia(etapas, "2026-09-17")[0].marca).toBe(
        "último dia",
      );
      expect(proximasEtapas(etapas, new Date(2026, 8, 16))).toEqual(etapas);
      const campoMalformado = { toString: null, valueOf: null };
      const comCamposInvalidos = montarEtapasDosEditais(
        editaisComCronograma([
          { id: 1, unidade: campoMalformado, cronograma_total: 1 },
        ]),
        [[{ ...ETAPA, atividade: campoMalformado, ordem: campoMalformado }]],
      );
      expect(comCamposInvalidos.etapas[0]).toMatchObject({
        unidade: "Unidade não informada",
        atividade: "Etapa sem nome",
        ordem: 0,
      });
    });
  });

  describe("concorrência no carregamento por edital", () => {
    it("preserva a ordem, limita pedidos simultâneos e isola uma falha", async () => {
      const liberar = new Map();
      let ativos = 0;
      let maximo = 0;
      const tarefa = vi.fn(async (item) => {
        ativos++;
        maximo = Math.max(maximo, ativos);
        try {
          if (item === "falha") throw new Error("indisponível");
          await new Promise((resolve) => liberar.set(item, resolve));
          return item.toUpperCase();
        } finally {
          ativos--;
        }
      });
      const carga = comLimite(["lento", "rápido", "falha", "resto"], 2, tarefa);
      expect(tarefa).toHaveBeenCalledTimes(2);
      liberar.get("rápido")();
      await vi.waitFor(() => expect(liberar.has("resto")).toBe(true));
      liberar.get("resto")();
      liberar.get("lento")();
      expect(await carga).toEqual(["LENTO", "RÁPIDO", null, "RESTO"]);
      expect(maximo).toBe(2);
      expect(ativos).toBe(0);
      expect(tarefa).toHaveBeenCalledTimes(4);
    });
  });

  describe("fronteiras das RPCs do calendário", () => {
    it("um item nulo na carga em lote não impede o cache nem as etapas válidas", async () => {
      const rpc = vi.fn(async (nome) => ({
        data:
          nome === "get_nucleo_cronograma_resumo"
            ? RESUMO
            : [
                null,
                false,
                [],
                { ...ETAPA, monitoramento_id: { toString: null } },
                ETAPA,
              ],
        error: null,
      }));
      const estado = criarEstadoDoCalendario({ supabase: { auth, rpc } });
      await estado.carregar();
      expect(estado.obter()).toMatchObject({
        carregado: true,
        carregando: false,
        erro: "",
      });
      expect(estado.obter().etapas).toHaveLength(1);
      await estado.carregar();
      // Resumo, etapas e demandas internas (que aqui vêm malformadas: lista vazia).
      expect(rpc).toHaveBeenCalledTimes(3);
      expect(estado.obter().demandas).toEqual([]);
    });

    /*
    Salvar um cronograma (EVENTO_CRONOGRAMA_SALVO → invalidar) enquanto a
    carga corre: a carga terminava, gravava "carregado agora" e apagava a
    invalidação; reabrir a tela em menos de 1 min mostrava a etapa antiga.
  */
    it("invalidar durante a carga faz a próxima abertura reler", async () => {
      const soltar = [];
      const rpc = vi.fn(
        (nome) =>
          new Promise((resolver) =>
            soltar.push(() =>
              resolver({
                data:
                  nome === "get_nucleo_cronograma_resumo" ? RESUMO : [ETAPA],
                error: null,
              }),
            ),
          ),
      );
      let agora = Date.parse("2026-11-10T12:00:00Z");
      const estado = criarEstadoDoCalendario({
        supabase: { auth, rpc },
        relogio: () => agora,
      });
      const carga = estado.carregar();
      await vi.waitFor(() => expect(rpc).toHaveBeenCalledTimes(3));
      estado.invalidar();
      for (const soltarUm of soltar.splice(0)) soltarUm();
      await carga;
      expect(estado.obter().etapas).toHaveLength(1);

      agora += 1_000;
      const reaberta = estado.carregar();
      await vi.waitFor(() => expect(rpc).toHaveBeenCalledTimes(6));
      for (const soltarUm of soltar.splice(0)) soltarUm();
      await reaberta;
    });

    it("sem invalidar, reabrir logo depois usa o que já está na tela", async () => {
      const rpc = vi.fn(async (nome) => ({
        data: nome === "get_nucleo_cronograma_resumo" ? RESUMO : [ETAPA],
        error: null,
      }));
      let agora = Date.parse("2026-11-10T12:00:00Z");
      const estado = criarEstadoDoCalendario({
        supabase: { auth, rpc },
        relogio: () => agora,
      });
      await estado.carregar();
      agora += 1_000;
      await estado.carregar();
      expect(rpc).toHaveBeenCalledTimes(3);
    });

    it("o resumo, as etapas e as demandas saem juntos, sem um esperar o outro", async () => {
      const soltar = new Map();
      const rpc = vi.fn(
        (nome) =>
          new Promise((resolver) =>
            soltar.set(nome, () =>
              resolver({
                data:
                  nome === "get_nucleo_cronograma_resumo" ? RESUMO : [ETAPA],
                error: null,
              }),
            ),
          ),
      );
      const estado = criarEstadoDoCalendario({ supabase: { auth, rpc } });
      const carga = estado.carregar();
      await vi.waitFor(() => expect(rpc).toHaveBeenCalledTimes(3));
      expect(rpc.mock.calls.map(([nome]) => nome).sort()).toEqual([
        "get_nucleo_cronograma_resumo",
        "listar_demandas_internas",
        "listar_etapas_do_cronograma",
      ]);
      soltar.get("listar_demandas_internas")();
      soltar.get("listar_etapas_do_cronograma")();
      soltar.get("get_nucleo_cronograma_resumo")();
      await carga;
      expect(estado.obter().etapas).toHaveLength(1);
    });

    it("erros sem mensagem textual mostram a reserva e permitem tentar novamente", async () => {
      const rpc = vi.fn(async () => ({
        data: null,
        error: { message: { detalhe: "falha" } },
      }));
      const estado = criarEstadoDoCalendario({ supabase: { auth, rpc } });
      await estado.carregar();
      expect(estado.obter()).toMatchObject({
        carregado: false,
        carregando: false,
        erro: "Não foi possível carregar os cronogramas.",
      });
      rpc.mockImplementation(async (nome) => ({
        data: nome === "get_nucleo_cronograma_resumo" ? RESUMO : [ETAPA],
        error: null,
      }));
      await estado.carregar(true);
      expect(estado.obter()).toMatchObject({
        carregado: true,
        carregando: false,
        erro: "",
      });
    });
  });
});

bloco("carga-da-entrada", () => {
  /*
  A carga da entrada: o comportamento da carga (consultas em paralelo, cópia da
  sessão, "Atualizar dados", Realtime) está em tests/demais-regras.test.ts (bloco app/carga) e o dos
  painéis externos em tests/casca-sessao-e-interface-na-tela.test.ts (bloco app/paineis-externos). Aqui fica o contrato
  com a sessão (src/app/sessao.ts): a ordem dos ganchos e quem apaga a cópia.
*/

  const ligacao = readFileSync("src/app/sistema.ts", "utf8");
  const sessao = readFileSync("src/app/sessao.ts", "utf8");

  const semComentarios = (fonte) =>
    fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  /** Corpo de uma função de topo da ligação com a sessão. */
  function funcao(cabecalho) {
    const inicio = ligacao.indexOf(cabecalho);
    expect(inicio, cabecalho).toBeGreaterThan(-1);
    const resto = ligacao.slice(inicio + cabecalho.length);
    const fim = resto.search(/\n(async )?function /);
    return semComentarios(
      cabecalho + resto.slice(0, fim < 0 ? undefined : fim),
    );
  }

  /** Corpo de uma função de src/app/sessao.ts (até a próxima do mesmo nível). */
  function funcaoDaSessao(cabecalho) {
    const inicio = sessao.indexOf(cabecalho);
    expect(inicio, cabecalho).toBeGreaterThan(-1);
    const resto = sessao.slice(inicio + cabecalho.length);
    const fim = resto.search(/\n {2}(async )?function /);
    return semComentarios(
      cabecalho + resto.slice(0, fim < 0 ? undefined : fim),
    );
  }

  /*
  O gancho `aoVerificar` (prepararEntrada) liga o skeleton e começa a ler a
  cópia ANTES da consulta do perfil, para as duas correrem juntas.
*/
  describe("cópia da sessão na entrada", () => {
    it("lê a cópia junto com o perfil, não depois", () => {
      expect(funcao("function prepararEntrada()")).toContain(
        "carga.prepararEntrada()",
      );
      const abrir = funcaoDaSessao("async function abrirSessao(");
      expect(abrir.indexOf('chamar("aoVerificar"')).toBeGreaterThan(-1);
      expect(abrir.indexOf('chamar("aoVerificar"')).toBeLessThan(
        abrir.indexOf("await carregarPerfil()"),
      );
    });

    it("só abre (e usa a cópia) depois de confirmar o perfil", () => {
      const abrir = funcaoDaSessao("async function abrirSessao(");
      expect(abrir.indexOf("await carregarPerfil()")).toBeLessThan(
        abrir.indexOf('chamar("abrir"'),
      );
      expect(funcao("async function abrirSistema(")).toContain(
        "await carga.carregarEntrada()",
      );
    });

    it("sem acesso, apaga a cópia", () => {
      expect(funcao("function ficarSemAcesso()")).toContain(
        "carga.apagarCopia()",
      );
    });

    /*
    `limparAutenticacaoLocal` roda a cada clique em "Entrar com Google". Se
    apagasse a cópia, ela nunca seria usada; quem apaga é o "Voltar ao login".
  */
    it('"Voltar ao login" apaga a cópia; entrar com Google não', () => {
      expect(ligacao).toContain("aoLimparSessao: () => carga.apagarCopia()");
      expect(funcaoDaSessao("async function limparSessao()")).toContain(
        'chamar("aoLimparSessao")',
      );
      expect(
        funcaoDaSessao("async function limparAutenticacaoLocal()"),
      ).not.toContain("aoLimparSessao");
    });
  });

  describe("sem tela de carregamento na entrada", () => {
    it.each(["async function abrirSistema(", "function prepararEntrada()"])(
      "%s não abre a tela de carregamento",
      (cabecalho) => {
        expect(funcao(cabecalho)).not.toContain("mostrarCarregamento(");
      },
    );

    it("a sessão do app não abre a tela de carregamento", () => {
      expect(semComentarios(sessao)).not.toContain("loader(");
    });

    it("a entrada liga o skeleton antes do perfil", () => {
      expect(funcao("function prepararEntrada()")).toContain(
        "mostrarEsqueleto(navegacao.telaEsperada())",
      );
    });

    it.each(["function limparEstadoDeslogado()", "function encerrarEspera()"])(
      "%s desliga o skeleton",
      (cabecalho) => {
        expect(funcao(cabecalho)).toContain("esconderEsqueleto()");
      },
    );

    it("sem acesso (ou perfil ilegível), a espera acaba", () => {
      expect(funcao("function fecharSistema()")).toContain("encerrarEspera()");
      expect(funcao("function ficarSemAcesso()")).toContain("fecharSistema()");
    });

    it("aconteça o que acontecer, a entrada encerra a espera", () => {
      const entrar = funcaoDaSessao("async function entrar(");
      const final = entrar.slice(entrar.indexOf("} finally {"));
      expect(final).toContain('chamar("encerrarEspera")');
    });

    it("sessão guardada que expirou dá lugar ao login", () => {
      const fonte = funcaoDaSessao("async function iniciar()");
      const semSessao = fonte.slice(fonte.lastIndexOf("await entrar("));
      expect(semSessao).toContain('chamar("encerrarEspera")');
    });
  });

  describe("cada consulta sai para a rede na hora", () => {
    /*
    A consulta do Supabase só dispara quando alguém chama `then`. Sem o
    `Promise.resolve` (em `iniciarConsultas`, src/app/carga.ts), ela ficaria
    parada até o `await` da sua carga e a entrada voltaria a ser sequencial.
  */
    it("a consulta preguiçosa começa ao passar por Promise.resolve", async () => {
      let chamadas = 0;
      const consulta = {
        then(resolver) {
          chamadas += 1;
          resolver("ok");
        },
      };
      const disparada = Promise.resolve(consulta);
      await null;
      expect(chamadas).toBe(1);
      await expect(disparada).resolves.toBe("ok");
      expect(chamadas).toBe(1);
    });
  });
});

bloco("carga-de-planilha", () => {
  const CONFIG = { url: "https://x.supabase.co", chave: "k" };
  const semEspera = { esperar: async () => {} };

  function resposta(status, corpo) {
    return { ok: status < 400, status, text: async () => corpo };
  }

  describe("textoDoErro", () => {
    it("leva só code e message, nunca a linha recusada", () => {
      const texto = textoDoErro(
        JSON.stringify({
          code: "23502",
          message: "null value in column",
          details:
            "Failing row contains (Maria Fictícia, maria@exemplo.invalid).",
          hint: null,
        }),
      );
      expect(texto).toBe("23502: null value in column");
      expect(texto).not.toMatch(/Maria|exemplo/);
    });

    it("não ecoa corpo que não é JSON", () => {
      expect(textoDoErro("<html>Maria</html>")).toBe("resposta sem JSON");
    });
  });

  describe("chamarRpc", () => {
    it("não repete erro 4xx e não traz details", async () => {
      let chamadas = 0;
      const buscar = async () => {
        chamadas++;
        return resposta(
          400,
          JSON.stringify({ code: "22023", message: "x", details: "Maria" }),
        );
      };
      await expect(
        chamarRpc(CONFIG, "f", {}, { buscar, ...semEspera }),
      ).rejects.toThrow("f respondeu 400: 22023: x");
      expect(chamadas).toBe(1);
    });

    it("repete 5xx e erro de rede até 3 vezes", async () => {
      let chamadas = 0;
      const buscar = async () => {
        chamadas++;
        if (chamadas === 1) throw new TypeError("fetch failed");
        if (chamadas === 2) return resposta(503, "fora");
        return resposta(200, JSON.stringify({ ok: true }));
      };
      await expect(
        chamarRpc(CONFIG, "f", {}, { buscar, ...semEspera }),
      ).resolves.toEqual({ ok: true });
      expect(chamadas).toBe(3);
    });

    it("não repete o cancelamento por tempo do banco (57014)", async () => {
      let chamadas = 0;
      const buscar = async () => {
        chamadas++;
        return resposta(
          500,
          JSON.stringify({
            code: "57014",
            message: "canceling statement due to statement timeout",
          }),
        );
      };
      await expect(
        chamarRpc(CONFIG, "f", {}, { buscar, ...semEspera }),
      ).rejects.toThrow("f respondeu 500: 57014");
      expect(chamadas).toBe(1);
    });

    it("desiste depois de 3 falhas de rede", async () => {
      const buscar = async () => {
        throw new TypeError("fetch failed");
      };
      await expect(
        chamarRpc(CONFIG, "f", {}, { buscar, ...semEspera }),
      ).rejects.toThrow("f sem resposta: TypeError");
    });
  });
});

bloco("casos-dos-avisos-dos-modulos", () => {
  /*
  Casos dos avisos dos outros módulos (20261007240000): aprovados,
  entrevistas, listas, ajustes e vagas vêm resolvidos pela leitura — quem é,
  onde, situação, as vagas da pessoa — e cada um leva à tela do módulo.
  UUID interno nunca aparece.
*/

  const UUID_DO_APROVADO = "b44c58f2-41de-448e-b6c6-88932524fa19";
  const UUID_DA_OUTRA_VAGA = "b44c58f2-41de-448e-b6c6-88932524fa20";

  const aprovado = (extra) => ({
    aviso_id: "av1",
    conferencia: "APROVADOS_CONTRATADO_DUPLICADO",
    ordem: 1,
    tipo: "candidato_aprovado",
    resolucao: "ok",
    aprovado_id: UUID_DO_APROVADO,
    edital_id: "e1",
    codigo: "4512",
    nome: "Maria Fictícia",
    edital: "Edital 12/2025",
    codigo_vaga: "1777",
    nome_vaga: "Enfermeiro",
    status: "Contratado",
    data_convocacao: "2026-01-10",
    data_contratacao: "2026-02-03T13:00:00+00:00",
    referencia: null,
    detalhe: { vagas: 2, vinculos: 2 },
    vinculos: [
      {
        id: UUID_DO_APROVADO,
        edital: "Edital 12/2025",
        codigo_vaga: "1777",
        nome_vaga: "Enfermeiro",
        status: "Contratado",
        data_contratacao: "2026-02-03T13:00:00+00:00",
      },
      {
        id: UUID_DA_OUTRA_VAGA,
        edital: "Edital 40/2026",
        codigo_vaga: "1900",
        nome_vaga: "Técnico de enfermagem",
        status: "Contratado",
        data_contratacao: "2026-05-20T13:00:00+00:00",
      },
    ],
    fora_do_acesso: 1,
    ...extra,
  });

  describe("caso de aprovado (Duas matrículas no mesmo edital)", () => {
    it("a mesma matrícula em duas listas diz o que fazer", () => {
      const caso = normalizarCaso(
        aprovado({
          conferencia: "APROVADOS_MESMA_MATRICULA_EM_DUAS_LINHAS",
          detalhe: { linhas: 2 },
        }),
      );
      expect(caso.motivo).toBe(
        'Mesma matrícula em 2 listas: marcar a outra como "Contratado em outra lista"',
      );
    });

    it("quem, onde, situação, motivo e as vagas da pessoa — sem UUID", () => {
      const caso = normalizarCaso(aprovado());
      expect(quemDoCaso(caso)).toBe("4512 · Maria Fictícia");
      expect(ondeDoCaso(caso)).toBe(
        "Edital 12/2025 · 1777 · Enfermeiro · Contratado em 03/02/2026",
      );
      expect(caso.motivo).toBe("2 matrículas no mesmo edital");
      expect(caso.vinculos.map(linhaDoVinculo)).toEqual([
        "Edital 12/2025 · 1777 · Enfermeiro · Contratado em 03/02/2026",
        "Edital 40/2026 · 1900 · Técnico de enfermagem · Contratado em 20/05/2026",
      ]);
      expect(caso.foraDoAcesso).toBe(1);
      const tudo = [quemDoCaso(caso), ondeDoCaso(caso), caso.motivo].join(" ");
      expect(tudo).not.toMatch(/b44c58f2/);
    });

    it("o aviso que virou pendência leva à aba Pendências, no edital do caso", () => {
      const caso = normalizarCaso(aprovado());
      expect(destinoDoCaso(caso)).toEqual({
        view: "approved",
        filtro: {
          candidatos: [UUID_DO_APROVADO, UUID_DA_OUTRA_VAGA],
          nome: "Maria Fictícia",
          pendencias: true,
          edital: caso.editalId || "",
        },
      });
    });

    it("os outros avisos dos aprovados levam à Lista só com as vagas da pessoa", () => {
      expect(
        destinoDoCaso(
          normalizarCaso(
            aprovado({ conferencia: "APROVADOS_PENDENCIA_DA_PUBLICACAO" }),
          ),
        ),
      ).toEqual({
        view: "approved",
        filtro: {
          candidatos: [UUID_DO_APROVADO, UUID_DA_OUTRA_VAGA],
          nome: "Maria Fictícia",
        },
      });
    });

    it("convocado sem desfecho: a data da convocação", () => {
      const caso = normalizarCaso(
        aprovado({
          conferencia: "APROVADOS_CONVOCADO_SEM_DESFECHO",
          status: "Convocado",
          detalhe: { convocado_em: "2026-09-01" },
          vinculos: null,
        }),
      );
      expect(caso.motivo).toBe("Convocado em 01/09/2026, sem desfecho");
      expect(ondeDoCaso(caso)).toContain("Convocado em 10/01/2026");
    });

    it("registro removido e fora do acesso: o rótulo, nunca o UUID", () => {
      const removido = normalizarCaso({
        aviso_id: "av1",
        conferencia: "APROVADOS_CONTRATADO_DUPLICADO",
        ordem: 2,
        tipo: "candidato_aprovado",
        resolucao: "removido",
        referencia: UUID_DO_APROVADO,
      });
      expect(quemDoCaso(removido)).toBe("Registro removido");
      expect(removido.referencia).toBe("");
      expect(destinoDoCaso(removido)).toBeNull();
      const semAcesso = normalizarCaso({
        aviso_id: "av1",
        conferencia: "APROVADOS_CONTRATADO_DUPLICADO",
        ordem: 3,
        resolucao: "sem_acesso",
      });
      expect(quemDoCaso(semAcesso)).toBe("Sem acesso");
      // Caso antigo que só trouxe a referência UUID (leitura sem resolver).
      expect(quemDoCaso(normalizarCaso({ referencia: UUID_DO_APROVADO }))).toBe(
        "Sem identificação",
      );
    });

    it("exportação: nome, situação, vagas da pessoa; sem UUID na referência", () => {
      const { linhas: tabela } = tabelaDosCasos([
        normalizarCaso(aprovado({ referencia: UUID_DO_APROVADO })),
        normalizarCaso({
          conferencia: "APROVADOS_CONTRATADO_DUPLICADO",
          ordem: 2,
          resolucao: "removido",
        }),
      ]);
      const [linha, removido] = tabela.map((l) => l.join(";"));
      expect(linha).toContain(
        "4512;Maria Fictícia;Edital 12/2025;1777 · Enfermeiro;;Contratado em 03/02/2026;",
      );
      expect(linha).toContain(
        "Edital 40/2026 · 1900 · Técnico de enfermagem · Contratado em 20/05/2026",
      );
      expect(tabela.flat().join(";")).not.toMatch(/b44c58f2/);
      expect(removido).toContain(";Registro removido;");
    });
  });

  describe("casos de entrevista, classificação e cargas", () => {
    it("entrevista: parecer e nota; leva a Entrevistas com a busca e a entrevista", () => {
      const caso = normalizarCaso({
        aviso_id: "av2",
        conferencia: "ENTREVISTA_NOTA_FORA_DA_ESCALA",
        ordem: 1,
        tipo: "entrevista",
        resolucao: "ok",
        entrevista_id: "en1",
        codigo: "C77",
        nome: "João Fictício",
        edital: "Edital 101/2026",
        codigo_vaga: "177979",
        nome_vaga: "Enfermeiro",
        status: "APTO",
        nota: 21,
        detalhe: { nota: 12, maxima: 10 },
      });
      expect(quemDoCaso(caso)).toBe("C77 · João Fictício");
      expect(ondeDoCaso(caso)).toBe(
        "Edital 101/2026 · 177979 · Enfermeiro · Apto · nota 21",
      );
      expect(caso.motivo).toBe("Nota 12 · máxima 10");
      expect(destinoDoCaso(caso)).toEqual({
        view: "entrevistas",
        filtro: { busca: "João Fictício", entrevista: "en1" },
      });
    });

    it("lista, vaga e ajuste: rótulos legíveis", () => {
      const lista = normalizarCaso({
        conferencia: "CLASSIFICACAO_LISTA_FINAL_DESATUALIZADA",
        tipo: "lista_classificacao",
        resolucao: "ok",
        edital_id: "e1",
        edital: "Edital 101/2026",
        lista: { tipo: "FINAL", gerada_em: "2026-10-01T10:00:00+00:00" },
      });
      expect(quemDoCaso(lista)).toBe("Lista final");
      expect(lista.motivo).toBe("Gerada em 01/10/2026");
      expect(destinoDoCaso(lista)).toEqual({
        view: "classificacao",
        filtro: {},
      });

      const vaga = normalizarCaso({
        conferencia: "CLASSIFICACAO_VAGA_SEM_QUADRO",
        tipo: "vaga",
        resolucao: "ok",
        edital: "Edital 101/2026",
        codigo_vaga: "180001",
        nome_vaga: "Médico",
        referencia: "180001",
      });
      expect(quemDoCaso(vaga)).toBe("Vaga 180001 · Médico");
      expect(ondeDoCaso(vaga)).toBe("Edital 101/2026");
      expect(
        quemDoCaso(
          normalizarCaso({ tipo: "vaga", resolucao: "ok", referencia: "x" }),
        ),
      ).toBe("Vaga sem código");

      const carga = normalizarCaso({
        conferencia: "CARGA_VARIACAO_BRUSCA",
        tipo: "vaga_empregare",
        resolucao: "ok",
        codigo_vaga: "177979",
        detalhe: { antes: 1200, depois: 300 },
      });
      expect(carga.motivo).toBe("De 1.200 para 300 candidatos");
      expect(destinoDoCaso(carga)).toBeNull();
    });
  });

  describe("as telas recebem o caso", () => {
    const linhas = [
      {
        candidato_id: UUID_DO_APROVADO,
        nome: "Maria Fictícia",
        edital_id: "e1",
      },
      {
        candidato_id: UUID_DA_OUTRA_VAGA,
        nome: "Maria Fictícia",
        edital_id: "e2",
      },
      { candidato_id: "outro", nome: "Outra Pessoa", edital_id: "e1" },
    ];

    it("Lista de aprovados: só os registros do caso", () => {
      expect(
        filterApprovedCandidates(linhas, {
          candidatos: [UUID_DO_APROVADO, UUID_DA_OUTRA_VAGA],
        }).map((l) => l.candidato_id),
      ).toEqual([UUID_DO_APROVADO, UUID_DA_OUTRA_VAGA]);
      expect(filterApprovedCandidates(linhas, { candidatos: [] })).toHaveLength(
        3,
      );
      expect(nomeDosCandidatosFiltrados(linhas, [UUID_DA_OUTRA_VAGA])).toBe(
        "Maria Fictícia",
      );
      expect(nomeDosCandidatosFiltrados(linhas, ["sumiu"])).toBe("");
    });

    it("Entrevistas: a busca do caso entra nos filtros", () => {
      expect(
        filtrosDeEntrevistas({ busca: "", edital: "" }, { busca: " João " }, {})
          .busca,
      ).toBe("João");
      expect(
        filtrosDeEntrevistas(
          { busca: "x", edital: "" },
          { metrica: "aptos" },
          {},
        ).busca,
      ).toBe("x");
    });
  });
});

bloco("casos-dos-avisos", () => {
  /*
  Casos dos avisos de conferência (listar_casos_aviso_conferencia,
  20261007120000): o formato de cada caso (quem, onde, motivo), as páginas,
  a busca, o CSV e o pedido que leva o Painel das análises ao caso.
*/

  const bruto = (extra) => ({
    aviso_id: "a1",
    conferencia: "ANALISE_DATA_INVALIDA",
    ordem: 1,
    analise_id: "00000000-0000-4000-a000-0000000000a1",
    codigo: "4512",
    nome: "Maria Fictícia",
    edital: "Edital 101/2026",
    codigo_vaga: "177979",
    nome_vaga: "Enfermeiro",
    responsavel: "Ana Analista",
    status: "Aprovado",
    data_analise: "2026-09-01",
    referencia: null,
    detalhe: {
      data_analise: "2026-09-01",
      inscricao: "2026-09-10",
      motivo: "antes_da_inscricao",
    },
    analises: null,
    fora_do_acesso: null,
    ...extra,
  });

  describe("formato do caso", () => {
    it("análise com data antes da inscrição: quem, onde e motivo, sem UUID", () => {
      const caso = normalizarCaso(bruto());
      expect(caso.chave).toBe("a1:1");
      expect(caso.titulo).toBe(
        "Data da análise no futuro ou antes da inscrição",
      );
      expect(quemDoCaso(caso)).toBe("4512 · Maria Fictícia");
      expect(ondeDoCaso(caso)).toBe(
        "Edital 101/2026 · 177979 · Enfermeiro · Resp. Ana Analista",
      );
      expect(caso.motivo).toBe(
        "Análise em 01/09/2026, antes da inscrição em 10/09/2026",
      );
      expect(quemDoCaso(caso)).not.toMatch(/0000-4000/);
    });

    it("data futura, notas, teto e soma", () => {
      expect(
        motivoDoCaso("ANALISE_DATA_INVALIDA", {
          data_analise: "2026-12-01",
          motivo: "futuro",
        }),
      ).toBe("Análise em 01/12/2026, data futura");
      expect(
        motivoDoCaso("ANALISE_APROVADA_ABAIXO_DO_CORTE", {
          nota: 50,
          corte: 60,
        }),
      ).toBe("Nota 50 · mínima 60");
      expect(
        motivoDoCaso("ANALISE_NOTA_DIFERENTE_DA_SOMA", {
          nota: 7.5,
          soma: 8.25,
        }),
      ).toBe("Nota 7,5 · soma das parciais 8,25");
      expect(
        motivoDoCaso("ANALISE_EXPERIENCIA_ACIMA_DO_TETO", {
          experiencia: 45,
          teto: 30,
        }),
      ).toBe("Experiência 45 · teto 30");
      expect(motivoDoCaso("CARGA_VARIACAO_BRUSCA", {})).toBe("");
    });

    it("cronograma encerrado: o caso é o edital, pelo número", () => {
      expect(
        motivoDoCaso("EDITAL_CRONOGRAMA_ENCERRADO", {
          fim: "2026-10-31",
          status: "em_andamento",
        }),
      ).toBe("Cronograma terminou em 31/10/2026 · status Em andamento");
      expect(motivoDoCaso("EDITAL_CRONOGRAMA_ENCERRADO", {})).toBe(
        "Cronograma terminou",
      );
      const caso = normalizarCaso({
        aviso_id: "av1",
        ordem: 1,
        conferencia: "EDITAL_CRONOGRAMA_ENCERRADO",
        referencia: "93/2026",
        detalhe: { fim: "2026-10-31", status: "sem_status" },
      });
      expect(quemDoCaso(caso)).toBe("Edital 93/2026");
      expect(caso.motivo).toBe(
        "Cronograma terminou em 31/10/2026 · sem status",
      );
      expect(destinoDoCaso(caso)).toBeNull();
    });

    it("admitido no RH com status desatualizado e convocação com regra anterior", () => {
      expect(
        motivoDoCaso("APROVADOS_ADMITIDO_COM_STATUS_DESATUALIZADO", {
          status: "sem_status",
          admissao: "2026-09-08",
        }),
      ).toBe("Admitido no RH em 08/09/2026 · sem status");
      expect(
        motivoDoCaso("APROVADOS_ADMITIDO_COM_STATUS_DESATUALIZADO", {
          status: "documentacao_rejeitada",
        }),
      ).toBe("Admitido no RH · status Documentação Rejeitada");
      expect(
        motivoDoCaso("CLASSIFICACAO_CONVOCACAO_REGRA_ANTERIOR", {
          versao_lista: 1,
          versao_vigente: 5,
        }),
      ).toBe("Regra v1 na convocação · vigente v5");
      expect(motivoDoCaso("CLASSIFICACAO_CONVOCACAO_REGRA_ANTERIOR", {})).toBe(
        "",
      );
    });

    it("candidato em dois editais: as análises dele e as fora do acesso", () => {
      const caso = normalizarCaso(
        bruto({
          conferencia: "ANALISE_EM_DOIS_EDITAIS",
          analise_id: null,
          detalhe: { editais: 2 },
          analises: [
            {
              id: "x1",
              edital: "Edital 101/2026",
              codigo_vaga: "1",
              nome_vaga: "Médico",
              status: "Aprovado",
            },
            { id: "x2", edital: "Edital 80/2026", status: "Pendente" },
          ],
          fora_do_acesso: 1,
        }),
      );
      expect(caso.motivo).toBe("Em 2 editais ativos");
      expect(caso.analises.map((a) => a.vaga)).toEqual(["1 · Médico", ""]);
      expect(caso.foraDoAcesso).toBe(1);
      expect(filtroDoCaso(caso)).toEqual({
        busca: "Maria Fictícia",
        analise: "x1",
      });
    });

    it("caso sem análise visível: a referência ou o código", () => {
      expect(
        quemDoCaso(
          normalizarCaso(
            bruto({ codigo: null, nome: null, referencia: "lista-9" }),
          ),
        ),
      ).toBe("Referência lista-9");
      expect(quemDoCaso(normalizarCaso(bruto({ nome: null })))).toBe("4512");
    });

    it("dia sem fuso", () => {
      expect(diaDoCaso("2026-01-02")).toBe("02/01/2026");
      expect(diaDoCaso("2026-01-02T23:59:00-03:00")).toBe("02/01/2026");
      expect(diaDoCaso("")).toBe("");
    });
  });

  describe("páginas e busca", () => {
    it("normaliza a página e junta sem repetir", () => {
      const pagina1 = normalizarCasos({
        total: 3,
        casos: [bruto(), bruto({ ordem: 2 })],
      });
      expect(pagina1.total).toBe(3);
      const pagina2 = normalizarCasos({
        total: 3,
        casos: [bruto({ ordem: 2 }), bruto({ ordem: 3 })],
      });
      const juntos = juntarPaginasDeCasos(pagina1.casos, pagina2.casos);
      expect(juntos.map((c) => c.ordem)).toEqual([1, 2, 3]);
      expect(casosRestantes(pagina1.casos, pagina1.total)).toBe(1);
      expect(casosRestantes(juntos, 3)).toBe(0);
      expect(normalizarCasos(null)).toEqual({ total: 0, casos: [] });
    });

    it("termo de busca: espaços simples e até 80 caracteres", () => {
      expect(termoDeBusca("  maria   fic ")).toBe("maria fic");
      expect(termoDeBusca("x".repeat(100))).toHaveLength(80);
      expect(termoDeBusca(null)).toBe("");
    });

    it("o estado pede a página certa: aviso, busca, recorte e deslocamento", async () => {
      const supabase = {
        rpc: vi.fn(async (nome) =>
          nome === "listar_casos_aviso_conferencia"
            ? { data: { total: 1, casos: [bruto()] }, error: null }
            : { data: { avisos: [] }, error: null },
        ),
      };
      const estado = criarEstadoDosAvisos({ supabase });
      await estado.carregar({ area: "saude-indigena", modulo: "analises" });
      await estado.listarCasos({ avisoId: "a1", deslocamento: 50 });
      expect(supabase.rpc).toHaveBeenLastCalledWith(
        "listar_casos_aviso_conferencia",
        {
          p_aviso: "a1",
          p_busca: null,
          p_area: null,
          p_modulo: null,
          p_limite: 50,
          p_deslocamento: 50,
        },
      );
      await estado.listarCasos({ busca: " 4512 " });
      expect(supabase.rpc).toHaveBeenLastCalledWith(
        "listar_casos_aviso_conferencia",
        {
          p_aviso: null,
          p_busca: "4512",
          p_area: "saude-indigena",
          p_modulo: "analises",
          p_limite: 50,
          p_deslocamento: 0,
        },
      );
    });

    it("o CSV lê todas as páginas de 1000 e baixa", async () => {
      const paginas = [
        Array.from({ length: 1000 }, (_, i) => bruto({ ordem: i + 1 })),
        [bruto({ ordem: 1001 })],
      ];
      const supabase = {
        rpc: vi.fn(async (_nome, args) => ({
          data: {
            total: 1001,
            casos: paginas[args.p_deslocamento === 0 ? 0 : 1],
          },
          error: null,
        })),
      };
      const baixar = vi.fn();
      const estado = criarEstadoDosAvisos({ supabase, baixar });
      const foi = await estado.exportarCasos({
        aviso: { id: "a1", conferencia: "ANALISE_DATA_INVALIDA" },
      });
      expect(foi).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledTimes(2);
      expect(supabase.rpc.mock.calls[1][1]).toMatchObject({
        p_limite: 1000,
        p_deslocamento: 1000,
      });
      const [bytes, nome] = baixar.mock.calls[0];
      // A planilha: o cabeçalho e uma linha por caso (os 1001 casos).
      expect(new TextDecoder().decode(bytes).match(/<row /g)).toHaveLength(
        1002,
      );
      expect(nome).toMatch(
        /^avisos-analise-data-invalida-\d{4}-\d{2}-\d{2}\.xlsx$/,
      );
    });
  });

  describe("exportação dos casos", () => {
    it("cabeçalho, uma linha por caso; o texto vai como veio (a planilha não lê fórmula)", () => {
      const { colunas, linhas } = tabelaDosCasos([
        normalizarCaso(bruto()),
        normalizarCaso(bruto({ ordem: 2, nome: "=HYPERLINK(1)", codigo: "9" })),
      ]);
      expect(colunas.join(";")).toBe(
        "Aviso;Código do candidato;Nome;Edital;Vaga;Responsável pela análise;Situação;Data da análise;Motivo;Análises do candidato;Vagas na lista de aprovados;Referência",
      );
      expect(linhas[0].join(";")).toContain(
        "4512;Maria Fictícia;Edital 101/2026;177979 · Enfermeiro;Ana Analista;Aprovado;01/09/2026",
      );
      expect(linhas[1][2]).toBe("=HYPERLINK(1)");
      expect(linhas).toHaveLength(2);
    });

    it("nome do arquivo da busca geral", () => {
      expect(nomeDoArquivoDosCasos(null, "xlsx", new Date(2026, 9, 6))).toBe(
        "avisos-busca-2026-10-06.xlsx",
      );
    });
  });

  describe("caso → Painel das análises", () => {
    it("só caso de aviso das análises, com análise, abre o painel", () => {
      const caso = normalizarCaso(bruto());
      expect(casoAbreAnalise(caso, "analises")).toBe(true);
      expect(casoAbreAnalise(caso, "entrevistas")).toBe(false);
      expect(
        casoAbreAnalise(
          normalizarCaso(bruto({ analise_id: null })),
          "analises",
        ),
      ).toBe(false);
    });

    it("o pedido vira a busca do painel", () => {
      const { filtros } = filtrosDasAnalises(
        { busca: "", edital: [] },
        filtroDoCaso(normalizarCaso(bruto())),
        [],
      );
      expect(filtros.busca).toBe("Maria Fictícia");
      // Sem nome (fora do acesso), a busca fica como estava.
      expect(
        filtrosDasAnalises({ busca: "x", edital: [] }, { busca: "" }, [])
          .filtros.busca,
      ).toBe("x");
    });
  });
});

bloco("chaves-da-automacao", () => {
  /*
  Chaves da automação (Configurações › Automação, 20261022190000): leitura do
  payload, próxima execução pela agenda do pg_cron (UTC), última execução,
  tarefas mexidas direto no banco, motivo e o efeito no Status das
  atualizações ("Desligada pelo administrador" em vez de atraso ou erro).
*/

  const AGORA = new Date("2026-10-22T14:07:30Z");
  const ha = (min) => new Date(AGORA.getTime() - min * 60000).toISOString();

  const PAYLOAD_DAS_CHAVES = () => ({
    schema_version: 1,
    gerado_em: AGORA.toISOString(),
    cron_disponivel: true,
    chaves: [
      {
        chave: "entrevistas",
        nome: "Entrevistas",
        ligada: false,
        motivo: "Pausa de propósito desde 16/10/2026.",
        em: "2026-10-22T13:00:00Z",
        por: "Gestão da Informação de Pessoal",
        tarefas: [
          {
            nome: "agsus_robo_sincronizar_entrevistas",
            agenda: "5 * * * *",
            ativa: false,
            ultima: {
              inicio: "2026-10-16T10:05:00Z",
              fim: "2026-10-16T10:05:01Z",
              situacao: "succeeded",
            },
          },
        ],
        ultimo_pedido: null,
        ultima_pre_classificacao: null,
      },
      {
        chave: "paineis",
        nome: "Pacotes dos painéis",
        ligada: true,
        motivo: "Estado inicial (migração 20261022190000).",
        em: "2026-10-22T13:00:00Z",
        por: null,
        tarefas: [
          {
            nome: "agsus_analises_cache_do_painel",
            agenda: "*/5 * * * *",
            ativa: true,
            ultima: { inicio: ha(2), fim: ha(2), situacao: "succeeded" },
          },
          {
            nome: "agsus_aprovados_cache_por_area",
            agenda: "1-59/5 * * * *",
            ativa: true,
            ultima: { inicio: ha(1), fim: ha(1), situacao: "succeeded" },
          },
        ],
      },
      {
        chave: "pre_classificacao",
        nome: "Triagem automática",
        ligada: true,
        motivo: "Estado inicial (migração 20261022190000).",
        tarefas: [],
        ultima_pre_classificacao: {
          inicio: "2026-10-15T12:14:00Z",
          situacao: "CONCLUIDA",
        },
      },
      { nome: "sem código" },
      "lixo",
    ],
    sem_chave: [
      {
        nome: "agsus_robo_conferir_disparos",
        agenda: "*/5 * * * *",
        ativa: true,
        chave: null,
      },
    ],
    historico: [
      {
        chave: "entrevistas",
        ligada: false,
        motivo: "Pausa de propósito desde 16/10/2026.",
        em: "2026-10-22T13:00:00Z",
        por: null,
        tarefas: ["agsus_robo_sincronizar_entrevistas", 3, { x: 1 }],
      },
      { ligada: true },
    ],
  });

  describe("normalizarChaves", () => {
    it("lê as chaves e descarta o que não é registro ou não tem código", () => {
      const dados = normalizarChaves(PAYLOAD_DAS_CHAVES());
      expect(dados.chaves.map((c) => c.chave)).toEqual([
        "entrevistas",
        "paineis",
        "pre_classificacao",
      ]);
      const [entrevistas] = dados.chaves;
      expect(entrevistas.ligada).toBe(false);
      expect(entrevistas.em).toEqual(new Date("2026-10-22T13:00:00Z"));
      expect(entrevistas.tarefas[0].ultima.situacao).toBe("succeeded");
      expect(dados.semChave.map((t) => t.nome)).toEqual([
        "agsus_robo_conferir_disparos",
      ]);
      expect(dados.historico).toHaveLength(1);
      expect(dados.historico[0].tarefas).toEqual([
        "agsus_robo_sincronizar_entrevistas",
        "3",
      ]);
    });

    it("entrada malformada vira lista vazia", () => {
      for (const entrada of [null, "x", 3, [], { chaves: "x" }]) {
        const dados = normalizarChaves(entrada);
        expect(dados.chaves).toEqual([]);
        expect(dados.historico).toEqual([]);
      }
      expect(normalizarChaves({ cron_disponivel: false }).cronDisponivel).toBe(
        false,
      );
    });
  });

  describe("proximaExecucao (agenda do pg_cron, UTC)", () => {
    const prox = (agenda, agora = AGORA) =>
      proximaExecucao(agenda, agora)?.toISOString() ?? null;

    it("de hora em hora, faixas, passos e listas", () => {
      expect(prox("5 * * * *")).toBe("2026-10-22T15:05:00.000Z");
      expect(prox("20,50 * * * *")).toBe("2026-10-22T14:20:00.000Z");
      expect(prox("1-59/5 * * * *")).toBe("2026-10-22T14:11:00.000Z");
      expect(prox("*/5 * * * *")).toBe("2026-10-22T14:10:00.000Z");
      expect(prox("10 11,16,21 * * *")).toBe("2026-10-22T16:10:00.000Z");
    });

    it("vira o dia, o mês e respeita o dia da semana", () => {
      expect(prox("0 9 * * *")).toBe("2026-10-23T09:00:00.000Z");
      expect(prox("0 6 1 * *")).toBe("2026-11-01T06:00:00.000Z");
      // 22/10/2026 é quinta (4); domingo seguinte, 25/10.
      expect(prox("0 12 * * 0")).toBe("2026-10-25T12:00:00.000Z");
      expect(prox("0 12 * * 7")).toBe("2026-10-25T12:00:00.000Z");
      // Dia do mês e da semana restritos: vale um ou outro.
      expect(prox("0 12 30 * 6")).toBe("2026-10-24T12:00:00.000Z");
    });

    it("o minuto exato de agora já passou: é o próximo", () => {
      expect(prox("7 14 * * *")).toBe("2026-10-23T14:07:00.000Z");
    });

    it("agenda fora do formato não tem próxima", () => {
      for (const agenda of [
        "30 seconds",
        "",
        "* * *",
        "61 * * * *",
        "a b c d e",
        null,
      ])
        expect(prox(agenda)).toBeNull();
      expect(prox("0 0 31 2 *")).toBeNull();
    });
  });

  describe("cada chave na tela", () => {
    const dados = normalizarChaves(PAYLOAD_DAS_CHAVES());
    const [entrevistas, paineis, pre] = dados.chaves;

    it("última: a tarefa mais recente, ou a triagem do fim do robô", () => {
      expect(ultimaExecucao(paineis).inicio).toEqual(new Date(ha(1)));
      expect(ultimaExecucao(pre).situacao).toBe("CONCLUIDA");
      expect(ultimaExecucao(entrevistas).inicio).toEqual(
        new Date("2026-10-16T10:05:00Z"),
      );
    });

    it("próxima: a mais cedo das tarefas ativas; nada com a chave desligada", () => {
      expect(proximaDaChave(paineis, AGORA)).toEqual(
        new Date("2026-10-22T14:10:00Z"),
      );
      expect(proximaDaChave(entrevistas, AGORA)).toBeNull();
      expect(semProxima(entrevistas)).toBe(
        "Não roda enquanto estiver desligada",
      );
      expect(semProxima(pre)).toBe("No fim de cada carga do robô da Empregare");
      expect(
        semProxima({
          ...pre,
          chave: "classificacao",
          nome: "Classificação em Python",
        }),
      ).toBe("Quando uma lista é gerada na Classificação");
    });

    it("aponta a tarefa mexida direto no banco", () => {
      expect(tarefasForaDaChave(entrevistas)).toEqual([]);
      expect(
        tarefasForaDaChave({
          ...entrevistas,
          tarefas: [{ ...entrevistas.tarefas[0], ativa: true }],
        }).map((t) => t.nome),
      ).toEqual(["agsus_robo_sincronizar_entrevistas"]);
    });

    it("chave das linhas do Status das atualizações", () => {
      expect(chaveDaLinha(dados, "entrevistas")?.chave).toBe("entrevistas");
      expect(chaveDaLinha(dados, "empregare")).toBeNull();
      expect(chaveDaLinha(dados, "constructor")).toBeNull();
      expect(chaveDaLinha(null, "entrevistas")).toBeNull();
    });

    it("o cálculo pelo Python só tem efeito com a Classificação em Python ligada (20261024110000)", () => {
      const duas = (classificacao, calculo) =>
        normalizarChaves({
          chaves: [
            {
              chave: "classificacao",
              nome: "Classificação em Python",
              ligada: classificacao,
            },
            {
              chave: "classificacao_calculo",
              nome: "Gerar listas pelo Python",
              ligada: calculo,
            },
          ],
        });
      const calculo = (d) => d.chaves[1];
      const semClassificacao = duas(false, true);
      expect(
        chaveQueFalta(semClassificacao, calculo(semClassificacao))?.chave,
      ).toBe("classificacao");
      expect(avisoSemEfeito(semClassificacao, calculo(semClassificacao))).toBe(
        'Sem efeito enquanto "Classificação em Python" estiver desligada: o Gerar segue com o cálculo da tela.',
      );
      expect(
        chaveDaLinha(semClassificacao, "classificacao_calculo")?.chave,
      ).toBe("classificacao");
      for (const d of [duas(true, true), duas(true, false), duas(false, false)])
        expect(avisoSemEfeito(d, calculo(d))).toBeNull();
      expect(
        chaveDaLinha(duas(true, true), "classificacao_calculo")?.chave,
      ).toBe("classificacao_calculo");
      expect(
        chaveDaLinha(duas(false, false), "classificacao_calculo")?.chave,
      ).toBe("classificacao_calculo");
      // As outras chaves não dependem de nenhuma.
      expect(
        avisoSemEfeito(semClassificacao, semClassificacao.chaves[0]),
      ).toBeNull();
    });
  });

  describe("motivo e recusas", () => {
    it("motivo com sentido: 15 a 500 caracteres, 3 palavras, sem teclado batido", () => {
      expect(motivoValido("curto")).toBe(false);
      // Os dois aceitos antes da regra (TB_CHAVE_AUTOMACAO, 23 e 28/10/2026).
      expect(motivoValido("sadasdsadsadasdas")).toBe(false);
      expect(motivoValido("testegcgbgfbg")).toBe(false);
      expect(motivoValido("asdf asdf asdf asdf")).toBe(false);
      expect(motivoValido("teste teste teste")).toBe(false);
      expect(motivoValido("aaaaaa bbbbbb cccccc")).toBe(false);
      expect(motivoValido("Pausa da coordenação")).toBe(true);
      expect(motivoValido("Pausa pedida")).toBe(false);
      expect(
        motivoValido("Religar a sincronização da seleção do edital 120/2026"),
      ).toBe(true);
      expect(motivoValido("  Instrução da COGIP para pausar  ")).toBe(true);
      expect(motivoValido("          ".repeat(3))).toBe(false);
      expect(motivoValido("Pausa pedida pela coordenação")).toBe(true);
      expect(motivoValido("x".repeat(501))).toBe(false);
      expect(motivoValido(null)).toBe(false);
    });

    it("recusas do banco em português", () => {
      expect(mensagemDaRecusa({ code: "42501" })).toMatch(
        /administrador global/,
      );
      expect(mensagemDaRecusa({ code: "55000" })).toMatch(/Outra pessoa/);
      expect(mensagemDaRecusa({ code: "PGRST202" })).toMatch(/20261022190000/);
      expect(mensagemDaRecusa({ message: "x" })).toBe("x");
    });
  });

  describe("Status das atualizações com as chaves", () => {
    const SAUDE = {
      gerado_em: AGORA.toISOString(),
      catalogo_dos_robos: CATALOGO_DOS_ROBOS,
      analises: [],
      entrevistas: [
        // Última de 16/10: sem chave seria "Atrasada".
        {
          inicio: "2026-10-16T10:05:00Z",
          fim: "2026-10-16T10:05:30Z",
          situacao: "CONCLUIDA",
        },
      ],
      selecao: [{ inicio: ha(30), situacao: "RECUSADA", mensagem: "falhou" }],
      agenda_dos_robos: {
        chave_cadastrada: true,
        ultimo_aceito: ha(5 * 60),
        falhas_24h: 0,
        sem_chave_24h: 0,
        disparos: [
          {
            workflow: "conferencias.yml",
            inicio: ha(5 * 60),
            fim: ha(5 * 60),
            situacao: "ACEITO",
          },
        ],
      },
      tarefas: [
        {
          nome: "agsus_analises_cache_do_painel",
          agenda: "*/5 * * * *",
          ativa: false,
          execucoes: [{ inicio: ha(600), fim: ha(600), situacao: "succeeded" }],
        },
      ],
    };

    it("sem as chaves, o prazo vem da tarefa ativa no pg_cron", () => {
      const comTarefa = {
        ...SAUDE,
        tarefas: [
          ...SAUDE.tarefas,
          {
            nome: "agsus_robo_sincronizar_entrevistas",
            agenda: "5 0-10,15,21-23 * * *",
            ativa: true,
            execucoes: [],
          },
        ],
      };
      const { linhas } = visaoSimples(normalizarSaude(comTarefa, AGORA));
      const porId = Object.fromEntries(linhas.map((l) => [l.id, l]));
      expect(porId.entrevistas.situacao).toBe("atrasada");
      // Último pedido aceito há 5 h: dentro do prazo das Entrevistas (8 h).
      expect(porId.agenda_dos_robos.situacao).toBe("em_dia");
    });

    it("chave desligada: 'Desligada pelo administrador', sem atraso nem erro", () => {
      const chaves = normalizarChaves({
        chaves: [
          {
            chave: "entrevistas",
            nome: "Entrevistas",
            ligada: false,
            motivo: "Pausa de propósito",
            por: "Setor",
          },
          { chave: "selecao", nome: "Seleção", ligada: false, motivo: "Pausa" },
          {
            chave: "paineis",
            nome: "Pacotes dos painéis",
            ligada: false,
            motivo: "Teste",
            tarefas: [
              {
                nome: "agsus_analises_cache_do_painel",
                agenda: "*/5 * * * *",
                ativa: false,
              },
            ],
          },
        ],
      });
      const { linhas, atencao } = visaoSimples(
        normalizarSaude(SAUDE, AGORA),
        chaves,
      );
      const porId = Object.fromEntries(linhas.map((l) => [l.id, l]));
      expect(porId.entrevistas.situacao).toBe("desligada");
      expect(porId.entrevistas.desligada).toEqual({
        motivo: "Pausa de propósito",
        em: null,
        por: "Setor",
      });
      expect(porId.selecao.situacao).toBe("desligada");
      expect(porId.selecao.erro).toBeNull();
      // Entrevistas desligada: a agenda só pede as diárias; 5 h sem pedido não é atraso.
      expect(porId.agenda_dos_robos.situacao).toBe("em_dia");
      expect(porId.tarefas.partes[0].situacao).toBe("desligada");
      expect(atencao.map((l) => l.id)).toEqual([]);
    });
  });
});

bloco("conferencias-fronteiras", () => {
  describe("fronteiras das conferências", () => {
    it.each([null, undefined, [], "resposta inválida"])(
      "aceita payload ausente ou fora do formato: %s",
      (entrada) => {
        expect(normalizarAvisos(entrada)).toEqual({
          geradoEm: null,
          ultimaExecucao: null,
          abertos: [],
          dispensados: [],
          resolvidos: [],
        });
        expect(normalizarCasos(entrada)).toEqual({ total: 0, casos: [] });
      },
    );

    it("ignora entradas que não são registros e normaliza campos desconhecidos", () => {
      const lista = normalizarAvisos({
        ultima_execucao: [],
        avisos: [
          null,
          [],
          "inválido",
          {
            id: "av1",
            gravidade: "constructor",
            modulo: "constructor",
            area: "constructor",
            quantidade: Infinity,
            exemplos: [null, {}, "123"],
            primeira_vez: {},
            pode_gerir: "true",
            pode_tratar: 1,
            tratamento: "constructor",
            prazo: {},
            evidencias: Infinity,
          },
        ],
      });
      expect(lista.abertos).toHaveLength(1);
      expect(lista.ultimaExecucao).toBeNull();
      expect(lista.abertos[0]).toMatchObject({
        id: "av1",
        gravidade: "ATENCAO",
        quantidade: 0,
        onde: "Sem área",
        exemplos: ["123"],
        primeiraVez: null,
        podeGerir: false,
        podeTratar: false,
        tratamento: "PENDENTE",
        prazo: null,
        evidencias: 0,
      });
      expect(contagemPorModulo(lista)).toEqual({
        analises: 0,
        entrevistas: 0,
        classificacao: 0,
        aprovados: 0,
        cargas: 0,
        editais: 0,
      });
    });

    it("trata notas, detalhes e referências inválidos sem produzir texto de objeto", () => {
      const caso = normalizarCaso({
        aviso_id: "av1",
        ordem: "2",
        conferencia: "ANALISE_APROVADA_ABAIXO_DO_CORTE",
        nome: {},
        nota: {},
        detalhe: { nota: {}, corte: Infinity },
        analises: [null, [], { id: "an1" }],
        vinculos: [null],
        fora_do_acesso: Infinity,
        resolucao: "constructor",
      });
      expect(caso).toMatchObject({
        chave: "av1:2",
        nome: "",
        nota: null,
        foraDoAcesso: 0,
        resolucao: "ok",
        motivo: "Nota — · mínima —",
        vinculos: [],
      });
      expect(caso.analises).toHaveLength(1);
      expect(destinoDoCaso(caso)?.view).toBe("analises");
      expect(tabelaDosCasos([caso]).linhas.flat().join(";")).not.toContain(
        "[object Object]",
      );
      expect(
        motivoDoCaso("ANALISE_EM_DOIS_EDITAIS", { editais: {} }, caso),
      ).toBe("Em mais de um edital ativo");
    });

    it("não transforma chaves herdadas de objetos em rótulos de listas", () => {
      const caso = normalizarCaso({
        tipo: "lista_classificacao",
        lista: { tipo: "constructor" },
      });
      expect(quemDoCaso(caso)).toBe("Lista de classificação");
      expect(normalizarCaso({ lista: [] }).lista).toBeNull();
    });

    it("a exportação encerra quando a RPC repete a página, sem repetir casos", async () => {
      const supabase = {
        rpc: vi.fn(async () => ({
          data: {
            total: 1001,
            casos: [{ aviso_id: "av1", ordem: 1, nome: "=1+1" }],
          },
          error: null,
        })),
      };
      const baixar = vi.fn();
      const estado = criarEstadoDosAvisos({ supabase, baixar });
      expect(await estado.exportarCasos()).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledTimes(2);
      const planilha = new TextDecoder().decode(baixar.mock.calls[0][0]);
      expect(planilha.match(/<row /g)).toHaveLength(2);
      expect(planilha).toContain(">=1+1<");
    });
  });
});

bloco("conflito-de-versao", () => {
  describe("ehConflitoDeVersao", () => {
    it("o código novo é PTxyz com 409: o PostgREST responde 409 e não repete", () => {
      expect(CONFLITO_DE_VERSAO).toBe("PT409");
      expect(CONFLITO_DE_VERSAO_ANTIGO).toBe("40001");
    });

    it.each(["PT409", "40001"])(
      "reconhece %s (erro do supabase-js ou Error)",
      (code) => {
        expect(ehConflitoDeVersao({ code, message: "mudou" })).toBe(true);
        expect(
          ehConflitoDeVersao(Object.assign(new Error("mudou"), { code })),
        ).toBe(true);
      },
    );

    it.each([
      null,
      undefined,
      "PT409",
      {},
      { code: 409 },
      { code: "55P03" },
      { code: "P0001" },
      { code: "42501" },
    ])("não confunde com outro erro: %j", (erro) => {
      expect(ehConflitoDeVersao(erro)).toBe(false);
    });
  });
});

bloco("cronograma-do-edital", () => {
  const etapa = (atividade, data_inicio, data_fim = data_inicio, ordem = 1) =>
    novaEtapa({ atividade, data_inicio, data_fim }, ordem);

  const EDITAL = {
    edital: "10/2026",
    unidade: "DSEI Manaus",
    cronograma_automatico: true,
  };

  describe("datas coladas em lote", () => {
    it.each([
      ["17/06/2026", "2026-06-17", "2026-06-17"],
      ["17-06-26", "2026-06-17", "2026-06-17"],
      ["18/06/2026 a 20/06/2026", "2026-06-18", "2026-06-20"],
      ["25/06/2026 – 03/07/2026", "2026-06-25", "2026-07-03"],
      ["18 até 20/06/2026", "2026-06-18", "2026-06-20"],
    ])("lê %s", (linha, inicio, fim) => {
      expect(lerLinhaDeDatas(linha)).toEqual({ inicio, fim });
    });

    /*
    O intervalo curto contém uma data completa ("20/06/2026"). Lido como data
    única, o primeiro dia sumia — e era o formato mais comum nos editais.
  */
    it("o intervalo curto não perde o primeiro dia", () => {
      expect(lerLinhaDeDatas("18 a 20/06/2026")).toEqual({
        inicio: "2026-06-18",
        fim: "2026-06-20",
      });
    });

    /*
    Com dia e mês no início ("18/06 a 20/06/2026"), o intervalo curto casava a
    partir do mês ("06 a 20/06/2026") e gravava o dia 6 como início — calado.
  */
    it.each([
      ["18/06 a 20/06/2026", "2026-06-18", "2026-06-20"],
      ["De 18/06 até 20/06/2026", "2026-06-18", "2026-06-20"],
      ["30/06 a 02/07/2026", "2026-06-30", "2026-07-02"],
      ["18/06 - 20/06/26", "2026-06-18", "2026-06-20"],
      ["29/12 a 05/01/2027", "2026-12-29", "2027-01-05"],
    ])("dia e mês no início: lê %s", (linha, inicio, fim) => {
      expect(lerLinhaDeDatas(linha)).toEqual({ inicio, fim });
    });

    it("recusa data que não existe", () => {
      expect(lerLinhaDeDatas("31/02/2026")).toBeNull();
      expect(lerLinhaDeDatas("amanhã")).toBeNull();
    });

    it("aplica na ordem e diz o que ficou por preencher", () => {
      const { etapas, aviso } = aplicarDatasEmLote(
        etapasDoModeloPadrao(),
        "17/06/2026",
      );
      expect(etapas[0]).toMatchObject({
        data_inicio: "2026-06-17",
        data_fim: "2026-06-17",
      });
      expect(etapas[1].data_inicio).toBe("");
      expect(aviso).toEqual({
        texto: "1 datas aplicadas. Ainda faltam 11 etapas para preencher.",
        tom: "warning",
      });
    });

    it("não muda nada quando alguma linha não se lê", () => {
      const antes = etapasDoModeloPadrao();
      const { etapas, aviso } = aplicarDatasEmLote(antes, "17/06/2026\nxx");
      expect(etapas).toBe(antes);
      expect(aviso.texto).toBe("Não foi possível interpretar a linha 2.");
    });
  });

  describe("estado calculado pelo cronograma", () => {
    const etapas = [
      etapa("Inscrições", "2026-09-01", "2026-09-10", 1),
      etapa("Entrevistas", "2026-09-20", "2026-09-25", 2),
    ];

    it("planejado, em andamento e concluído saem só das datas", () => {
      expect(
        estadoDoCronograma(etapas, { hoje: new Date(2026, 7, 1) }),
      ).toMatchObject({
        status: "Planejado",
        etapa: "Aguardando: Inscrições",
      });
      expect(
        estadoDoCronograma(etapas, { hoje: new Date(2026, 8, 15) }),
      ).toMatchObject({
        status: "Em andamento",
        etapa: "Aguardando: Entrevistas",
        proxima: "Entrevistas — 20/09/2026",
        percentual: 50,
      });
      expect(
        estadoDoCronograma(etapas, { hoje: new Date(2026, 9, 1) }),
      ).toMatchObject({
        status: "Concluído",
        percentual: 100,
      });
    });

    it("o status excepcional vence o calculado", () => {
      expect(
        estadoDoCronograma(etapas, {
          hoje: new Date(2026, 8, 15),
          statusExcepcional: "Suspenso",
        }).status,
      ).toBe("Suspenso");
    });

    it("sem automático, ou sem etapa completa, fica pendente", () => {
      expect(estadoDoCronograma(etapas, { automatico: false }).status).toBe(
        PENDENTE,
      );
      expect(estadoDoCronograma([etapa("Sem data", "")]).status).toBe(PENDENTE);
    });

    it("etapa com data que não se lê fica de fora (não conta como atual nem concluída)", () => {
      const comDataRuim = [
        etapa("Inscrições", "2026-09-01", "2026-09-10", 1),
        // Início ilegível: antes contava como a etapa atual.
        etapa("Recursos", "15/09/2026", "2026-09-30", 2),
        // Fim ilegível: antes contava como concluída.
        etapa("Análise", "2026-09-11", "2026-09-xx", 3),
        etapa("Entrevistas", "2026-09-20", "2026-09-25", 4),
      ];
      expect(
        estadoDoCronograma(comDataRuim, { hoje: new Date(2026, 8, 15) }),
      ).toEqual(estadoDoCronograma(etapas, { hoje: new Date(2026, 8, 15) }));
      expect(
        estadoDoCronograma([etapa("Só data ruim", "2026-02-30x")]).status,
      ).toBe(PENDENTE);
    });

    describe("sem `hoje` válido", () => {
      afterEach(() => vi.useRealTimers());

      it("usa o dia de agora, como sem `hoje`", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 8, 15, 9));
        expect(
          estadoDoCronograma(etapas, { hoje: new Date("não é data") }),
        ).toEqual(estadoDoCronograma(etapas, { hoje: new Date(2026, 8, 15) }));
      });
    });
  });

  describe("validação antes de salvar", () => {
    it("erros impedem salvar", () => {
      const { erros } = analisarCronograma(
        { ...EDITAL, unidade: "", status_override: "Suspenso" },
        [etapa("A", "2026-09-10", "2026-09-01"), etapa("a", "2026-09-11")],
        "",
      );
      expect(erros).toEqual([
        "Informe pelo menos edital e unidade.",
        "Etapa 1: a data final é anterior à inicial.",
        "Etapa 2: atividade duplicada.",
        "Status excepcional exige motivo e data da decisão.",
        "Informe o motivo da alteração do cronograma.",
      ]);
    });

    it("avisos pedem confirmação", () => {
      const { erros, avisos } = analisarCronograma(
        EDITAL,
        [
          etapa("Inscrições", "2025-09-01", "2025-09-10"),
          etapa("Entrevistas", "2026-09-05", "2026-09-06"),
        ],
        "Cadastro inicial",
      );
      expect(erros).toEqual([]);
      expect(avisos).toEqual([
        "Etapa 1: data fora do ano 2026.",
        "O cronograma não possui uma etapa de resultado final.",
      ]);
    });
  });

  describe("linha do tempo", () => {
    it("marca concluída, em andamento e só a primeira futura como próxima", () => {
      const etapas = [
        etapa("A", "2026-09-01", "2026-09-05"),
        etapa("B", "2026-09-14", "2026-09-16"),
        etapa("C", "2026-09-20"),
        etapa("D", "2026-09-25"),
      ];
      expect(
        etapas.map((item, i) =>
          situacaoNaLinhaDoTempo(item, i, etapas, "2026-09-15"),
        ),
      ).toEqual(["done", "current", "next", "future"]);
    });
  });

  describe("datas do próprio edital", () => {
    const base = { edital: "107/2026", unidade: "DSEI Vale do Javari" };
    it("ano impossível e encerramento antes do início impedem salvar", () => {
      const { erros } = analisarCronograma(
        { ...base, data_inicio: "0202-11-12", data_fim: "20206-09-14" },
        [],
        "",
        { exigirMotivo: false },
      );
      expect(erros.filter((e) => e.includes("não é possível"))).toHaveLength(2);
      expect(
        analisarCronograma(
          { ...base, data_inicio: "2026-11-12", data_fim: "2026-09-14" },
          [],
          "",
          { exigirMotivo: false },
        ).erros,
      ).toContain("A data de encerramento do edital é anterior à de início.");
    });
  });
});

bloco("datas-do-cronograma", () => {
  const proximasEtapas = proximasEtapas__1;
  const etapa = (atividade, data_inicio, data_fim, extra = {}) => ({
    atividade,
    data_inicio,
    data_fim,
    edital: "05/2026",
    unidade: "DSEI Xavante",
    ordem: 0,
    ...extra,
  });

  describe("datas do cronograma", () => {
    it("ano digitado errado não é data possível", () => {
      expect(dataPlausivel("2026-10-09")).toBe(true);
      expect(dataPlausivel("0202-10-09")).toBe(false);
      expect(dataPlausivel("2206-03-27")).toBe(false);
      expect(dataPlausivel("")).toBe(false);
    });

    it("fim antes do início também é inválido", () => {
      expect(etapaComDatasValidas(etapa("x", "2026-10-09", "2026-10-01"))).toBe(
        false,
      );
      expect(etapaComDatasValidas(etapa("x", "2026-10-09", "2026-10-10"))).toBe(
        true,
      );
    });

    it("próximas etapas vêm pela data que importa, não pelo início", () => {
      const hoje = "2026-09-24";
      const lista = proximasEtapas(
        [
          etapa("Recurso aberto desde agosto", "2026-08-01", "2026-09-25"),
          etapa("Entrevistas", "2026-09-28", "2026-10-02"),
          etapa("Resultado", "2026-10-09", "2026-10-09"),
          etapa("Ano errado", "0202-10-09", "2026-10-10"),
          etapa("Já acabou", "2026-09-01", "2026-09-10"),
        ],
        hoje,
      );
      expect(lista.map((e) => e.atividade)).toEqual([
        "Recurso aberto desde agosto",
        "Entrevistas",
        "Resultado",
      ]);
    });

    it("lista os editais que precisam de correção", () => {
      expect(
        editaisComDatasARevisar([
          etapa("a", "0202-10-09", "2026-10-10"),
          etapa("b", "2026-03-26", "2206-03-27"),
          etapa("c", "2026-03-26", "2026-03-27", { edital: "06/2026" }),
        ]),
      ).toEqual([{ edital: "05/2026 • DSEI Xavante", etapasComProblema: 2 }]);
    });
  });

  describe("dataPlausivel: o formato inteiro conta", () => {
    it("recusa ano de 5 dígitos e de 3, aceita AAAA-MM-DD nos limites", () => {
      expect(dataPlausivel("20206-09-14")).toBe(false);
      expect(dataPlausivel("0202-10-09")).toBe(false);
      expect(dataPlausivel("2026-09-14")).toBe(true);
      expect(dataPlausivel("2026-09-14T10:00:00Z")).toBe(true);
      expect(dataPlausivel("")).toBe(false);
    });
  });
});

bloco("demandas-internas", () => {
  const BRUTA = {
    id: "d1",
    area: "sede",
    edital_id: null,
    titulo: "Relatório",
    data_inicio: "2026-09-08",
    data_fim: "2026-09-10",
    concluida: false,
    responsaveis: [{ id: "p1", nome: "Ana" }, { nome: "sem id" }],
    pode_editar: true,
  };

  describe("leitura da RPC", () => {
    it("lê a demanda e descarta o que não serve", () => {
      const demanda = lerDemanda(BRUTA);
      expect(demanda).toMatchObject({
        id: "d1",
        area: "sede",
        editalId: "",
        dataFim: "2026-09-10",
        podeEditar: true,
        responsaveis: [{ id: "p1", nome: "Ana" }],
      });
      expect(lerDemanda({ ...BRUTA, titulo: "" })).toBeNull();
      expect(lerDemanda({ ...BRUTA, data_inicio: "ontem" })).toBeNull();
      // Fim antes do início ou inválido: vale o início (data única).
      expect(lerDemanda({ ...BRUTA, data_fim: "2026-09-01" })?.dataFim).toBe(
        "2026-09-08",
      );
      expect(lerDemanda(null)).toBeNull();
    });

    it("lista ordenada por início e as áreas onde pode criar", () => {
      const lista = lerDemandasInternas({
        pode_criar_em: ["sede", 3, null],
        demandas: [
          { ...BRUTA, id: "b", titulo: "B", data_inicio: "2026-09-09" },
          BRUTA,
          "lixo",
        ],
      });
      expect(lista.demandas.map((item) => item.id)).toEqual(["d1", "b"]);
      expect(lista.podeCriarEm).toEqual(["sede", "3"]);
      expect(lerDemandasInternas(null)).toEqual({
        demandas: [],
        podeCriarEm: [],
      });
    });

    it("comDemanda troca a que já existe e mantém a ordem", () => {
      const [a] = lerDemandasInternas({ demandas: [BRUTA] }).demandas;
      const trocada = { ...a, titulo: "Novo", dataInicio: "2026-01-01" };
      expect(comDemanda([a], trocada)).toEqual([trocada]);
    });
  });

  describe("atrasada, situação e período", () => {
    const demanda = lerDemanda(BRUTA);
    it("atrasada é a em aberto com fim antes de hoje", () => {
      expect(demandaAtrasada(demanda, "2026-09-10")).toBe(false);
      expect(demandaAtrasada(demanda, "2026-09-11")).toBe(true);
      expect(
        demandaAtrasada({ ...demanda, concluida: true }, "2026-09-11"),
      ).toBe(false);
      expect(situacaoDaDemanda(demanda, "2026-09-11")).toBe("Atrasada");
      expect(situacaoDaDemanda(demanda, "2026-09-09")).toBe("Em aberto");
      expect(
        situacaoDaDemanda({ ...demanda, concluida: true }, "2026-09-11"),
      ).toBe("Concluída");
    });

    it("período em texto", () => {
      expect(periodoDaDemanda(demanda)).toBe("08/09/2026 a 10/09/2026");
      expect(periodoDaDemanda({ ...demanda, dataFim: "2026-09-08" })).toBe(
        "08/09/2026",
      );
    });

    it("recorte pela área", () => {
      expect(demandasDaArea([demanda], "sede")).toHaveLength(1);
      expect(demandasDaArea([demanda], "projetos")).toHaveLength(0);
    });
  });

  describe("a demanda no calendário", () => {
    const demanda = lerDemanda(BRUTA);

    it("é uma etapa do tipo Demanda interna, que entra na legenda e no filtro", () => {
      const etapa = demandaComoEtapa(demanda, "2026-09-15");
      expect(etapa).toMatchObject({
        editalId: "demanda:d1",
        unidade: "Demanda interna",
        atividade: "Relatório · atrasada",
        tipo: TIPO_DEMANDA_INTERNA,
        demandaId: "d1",
      });
      expect(etapa.busca).toContain("ana");
      expect(demandaDoEditalId(etapa.editalId)).toBe("d1");
      expect(demandaDoEditalId("123")).toBe("");
      expect(TIPOS_DA_LEGENDA).toContain(TIPO_DEMANDA_INTERNA);
      expect(tiposOcultosValidos('["demanda-interna"]')).toEqual([
        "demanda-interna",
      ]);
    });

    it("com edital, fica no edital; concluída leva o sufixo", () => {
      const etapa = demandaComoEtapa(
        {
          ...demanda,
          editalId: "7",
          edital: "10/2026",
          unidade: "DSEI X",
          concluida: true,
        },
        "2026-09-15",
      );
      expect(etapa.editalId).toBe("7");
      expect(etapa.unidade).toBe("DSEI X");
      expect(etapa.atividade).toBe("Relatório · concluída");
    });

    it("'Ocultar concluídas' esconde só a demanda marcada como concluída", () => {
      const hoje = new Date(2026, 8, 15);
      const atrasada = demandaComoEtapa(demanda, "2026-09-15");
      const concluida = demandaComoEtapa(
        { ...demanda, id: "d2", concluida: true },
        "2026-09-15",
      );
      expect(
        filtrarEtapas(
          [atrasada, concluida],
          {},
          { ocultarConcluidas: true, hoje },
        ),
      ).toEqual([atrasada]);
      expect(
        filtrarEtapas(
          [atrasada],
          {},
          { tiposOcultos: ["demanda-interna"], hoje },
        ),
      ).toEqual([]);
    });

    it("junta etapas e demandas pela data de início", () => {
      const a = demandaComoEtapa(demanda, "2026-09-15");
      const b = { ...a, data_inicio: "2026-09-01" };
      expect(juntarPorInicio([a], [b])).toEqual([b, a]);
      expect(juntarPorInicio([a], [])).toEqual([a]);
    });
  });

  describe("formulário", () => {
    it("valida e monta o p_demanda", () => {
      const vazio = formularioDaDemanda(null, "sede");
      expect(problemaDoFormulario(vazio)).toBe(
        "O título precisa ter ao menos 3 caracteres.",
      );
      const comTitulo = { ...vazio, titulo: "  Fazer   algo " };
      expect(problemaDoFormulario(comTitulo)).toBe("Informe a data.");
      const comData = { ...comTitulo, dataInicio: "2026-09-10" };
      expect(problemaDoFormulario(comData)).toBe("");
      expect(
        problemaDoFormulario({
          ...comData,
          periodo: true,
          dataFim: "2026-09-01",
        }),
      ).toBe("O fim não pode ser antes do início.");
      expect(
        payloadDaDemanda({ ...comData, responsaveis: ["p1", "p1"] }),
      ).toEqual({
        area: "sede",
        edital_id: null,
        titulo: "Fazer algo",
        descricao: null,
        data_inicio: "2026-09-10",
        data_fim: "2026-09-10",
        responsaveis: ["p1"],
      });
    });

    it("editar parte da demanda, com período e responsáveis", () => {
      const formulario = formularioDaDemanda(lerDemanda(BRUTA), "outra");
      expect(formulario).toMatchObject({
        id: "d1",
        area: "sede",
        periodo: true,
        dataFim: "2026-09-10",
        responsaveis: ["p1"],
      });
      expect(payloadDaDemanda(formulario)).toMatchObject({
        id: "d1",
        data_fim: "2026-09-10",
      });
    });
  });
});

bloco("editais-api", () => {
  const LINHAS = [
    {
      id: 1,
      unidade: "DSEI Yanomami",
      area: "Saúde Indígena",
      edital: "001/2026",
      status: "Em andamento",
      etapa: "Análise curricular",
      vagas_total: 10,
      contratados: 4,
      vagas_ociosas: 6,
      risco: "Alto",
      link_edital: "https://exemplo.gov.br/edital-001.pdf",
      observacoes_internas: "não sai na API",
    },
    {
      id: 2,
      unidade: "DSEI Alto Rio Negro",
      area: "SEDE",
      edital: "002/2026",
      status: "Concluído",
      etapa: "Contratação",
      vagas_total: "5",
      contratados: "5",
      vagas_ociosas: null,
      risco: "Médio",
    },
  ];

  describe("formato da API de editais", () => {
    it("devolve só os campos pedidos (com o id e o link), com números", () => {
      expect(editaisDaApi({ linhas: LINHAS })).toEqual([
        {
          id: 1,
          unidade: "DSEI Yanomami",
          area: "Saúde Indígena",
          edital: "001/2026",
          status: "Em andamento",
          etapa: "Análise curricular",
          vagas: 10,
          contratados: 4,
          ociosas: 6,
          risco: "Alto",
          link: "https://exemplo.gov.br/edital-001.pdf",
        },
        {
          id: 2,
          unidade: "DSEI Alto Rio Negro",
          area: "SEDE",
          edital: "002/2026",
          status: "Concluído",
          etapa: "Contratação",
          vagas: 5,
          contratados: 5,
          ociosas: 0,
          risco: "Médio",
          link: "",
        },
      ]);
    });

    it("aceita a lista crua e payload vazio", () => {
      expect(editaisDaApi(LINHAS)).toHaveLength(2);
      expect(editaisDaApi({ inalterado: true })).toEqual([]);
      expect(editaisDaApi(null)).toEqual([]);
    });

    it("filtra risco/status sem caixa nem acento e edital/unidade por trecho", () => {
      expect(editaisDaApi(LINHAS, { risco: "medio" }).map((e) => e.id)).toEqual(
        [2],
      );
      expect(
        editaisDaApi(LINHAS, { status: "CONCLUIDO" }).map((e) => e.id),
      ).toEqual([2]);
      expect(
        editaisDaApi(LINHAS, { unidade: "yanomami" }).map((e) => e.id),
      ).toEqual([1]);
      expect(editaisDaApi(LINHAS, { edital: "2026" })).toHaveLength(2);
      expect(editaisDaApi(LINHAS, { risco: "Baixo" })).toEqual([]);
    });

    it("filtra pela área pelo nome ou pelo código", () => {
      const ids = (area) => editaisDaApi(LINHAS, { area }).map((e) => e.id);
      expect(ids("saude indigena")).toEqual([1]);
      expect(ids("saude-indigena")).toEqual([1]);
      expect(ids("Saúde Indígena")).toEqual([1]);
      expect(ids("sede")).toEqual([2]);
      expect(ids("projetos")).toEqual([]);
    });

    it("lê o primeiro valor de filtro repetido e ignora os desconhecidos", () => {
      expect(filtrosDaApi({ risco: ["Alto", "Baixo"], outro: "x" })).toEqual({
        edital: "",
        unidade: "",
        status: "",
        etapa: "",
        risco: "Alto",
        area: "",
      });
    });

    it("soma os totais", () => {
      expect(totaisDaApi(editaisDaApi(LINHAS))).toEqual({
        linhas: 2,
        vagas: 15,
        contratados: 9,
        ociosas: 6,
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

  const json = (corpo, ok = true) => ({ ok, json: async () => corpo });

  const CHAVE = "chave-da-api-combinada";
  const SERVIDOR = "sb_secret_servidor";
  const comChave = (chave = CHAVE, extra = {}) => ({
    method: "GET",
    headers: { authorization: `Bearer ${chave}` },
    ...extra,
  });

  describe("GET /api/editais (chave fixa, sem login)", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_SUPABASE_URL", "https://exemplo.supabase.co/");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SERVIDOR);
      vi.stubEnv("EDITAIS_API_CHAVE", CHAVE);
    });
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });

    it("recusa método que não é GET", async () => {
      const res = respostaFalsa();
      await handler({ method: "POST", headers: {} }, res);
      expect(res.statusCode).toBe(405);
    });

    it("sem as variáveis na Vercel responde 500 sem chamar o banco", async () => {
      vi.stubEnv("EDITAIS_API_CHAVE", "");
      const fetchFalso = vi.fn();
      vi.stubGlobal("fetch", fetchFalso);
      const res = respostaFalsa();
      await handler(comChave(), res);
      expect(res.statusCode).toBe(500);
      expect(JSON.parse(res.corpo)).toEqual({
        erro: "configuracao_ausente",
        faltam: ["EDITAIS_API_CHAVE"],
      });
      expect(fetchFalso).not.toHaveBeenCalled();
    });

    it("o 500 diz só os nomes que faltam, nunca os valores", async () => {
      vi.stubEnv("VITE_SUPABASE_URL", "");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "   \n");
      const res = respostaFalsa();
      await handler(comChave(), res);
      expect(JSON.parse(res.corpo).faltam).toEqual([
        "VITE_SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
      ]);
      expect(res.corpo).not.toContain(CHAVE);
    });

    it("aceita SUPABASE_URL e apara espaço e quebra de linha colados", async () => {
      vi.stubEnv("VITE_SUPABASE_URL", "");
      vi.stubEnv("SUPABASE_URL", " https://outro.supabase.co/ ");
      vi.stubEnv("EDITAIS_API_CHAVE", `${CHAVE}\n`);
      const fetchFalso = vi.fn(async () => json({ linhas: [] }));
      vi.stubGlobal("fetch", fetchFalso);
      const res = respostaFalsa();
      await handler(comChave(), res);
      expect(res.statusCode).toBe(200);
      expect(fetchFalso.mock.calls[0][0]).toBe(
        "https://outro.supabase.co/rest/v1/rpc/listar_editais_da_api",
      );
    });

    it("sem chave ou com chave errada: 401, sem chamar o banco", async () => {
      const fetchFalso = vi.fn();
      vi.stubGlobal("fetch", fetchFalso);
      for (const pedido of [
        { method: "GET", headers: {} },
        comChave("outra-chave"),
        comChave(`${CHAVE}x`),
      ]) {
        const res = respostaFalsa();
        await handler(pedido, res);
        expect(res.statusCode).toBe(401);
        expect(JSON.parse(res.corpo)).toEqual({ erro: "chave_invalida" });
      }
      expect(fetchFalso).not.toHaveBeenCalled();
    });

    it("com a chave certa lê a RPC com a chave de servidor e filtra", async () => {
      const fetchFalso = vi.fn(async () =>
        json({ linhas: LINHAS, versao: "v" }),
      );
      vi.stubGlobal("fetch", fetchFalso);

      const res = respostaFalsa();
      await handler(comChave(CHAVE, { query: { risco: "alto" } }), res);

      expect(res.statusCode).toBe(200);
      expect(res.headers["cache-control"]).toBe("private, no-store");
      const [url, opcoes] = fetchFalso.mock.calls[0];
      expect(url).toBe(
        "https://exemplo.supabase.co/rest/v1/rpc/listar_editais_da_api",
      );
      expect(opcoes.headers.apikey).toBe(SERVIDOR);
      // Chave nova (sb_secret_…) não vai no Authorization; a chave da API nunca vai ao banco.
      expect(opcoes.headers.Authorization).toBeUndefined();
      expect(JSON.stringify(opcoes)).not.toContain(CHAVE);
      const corpo = JSON.parse(res.corpo);
      expect(corpo.editais.map((e) => e.id)).toEqual([1]);
      expect(corpo.editais[0].link).toBe(
        "https://exemplo.gov.br/edital-001.pdf",
      );
      expect(corpo.totais).toEqual({
        linhas: 1,
        vagas: 10,
        contratados: 4,
        ociosas: 6,
      });
    });

    it("chave de servidor antiga (JWT) vai também no Authorization", async () => {
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "eyJservidor");
      const fetchFalso = vi.fn(async () => json({ linhas: [] }));
      vi.stubGlobal("fetch", fetchFalso);
      await handler(comChave(), respostaFalsa());
      expect(fetchFalso.mock.calls[0][1].headers.Authorization).toBe(
        "Bearer eyJservidor",
      );
    });

    it("falha da leitura vira 502 com status e código, sem a mensagem", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: false,
          status: 403,
          json: async () => ({
            code: "42501",
            message: "permission denied for view X",
          }),
        })),
      );
      const res = respostaFalsa();
      await handler(comChave(), res);
      expect(res.statusCode).toBe(502);
      expect(JSON.parse(res.corpo)).toEqual({
        erro: "falha_na_leitura",
        status_do_banco: 403,
        codigo: "42501",
      });
      expect(res.corpo).not.toContain("permission denied");
      expect(console.error).toHaveBeenCalled();
    });

    it("sem resposta do banco: 502 com status nulo", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new Error("rede");
        }),
      );
      const res = respostaFalsa();
      await handler(comChave(), res);
      expect(JSON.parse(res.corpo)).toEqual({
        erro: "falha_na_leitura",
        status_do_banco: null,
        codigo: null,
      });
    });
  });
});

bloco("editais-das-linhas", () => {
  describe("situação do edital vinda da view ou da planilha", () => {
    /*
    A view devolve booleano; a planilha devolve texto. O resto do painel
    pergunta pela situação com `norm(meta.ativo)`, comparando contra uma lista
    que inclui "true" — ou seja, o booleano só funciona porque a string "true"
    está lá. Estes casos existem para que remover "true" daquela lista, achando
    que é redundante, quebre um teste em vez de tornar todo edital inativo em
    silêncio.
  */
    it("aceita o booleano que a view devolve", () => {
      expect(editalEstaAtivo(true)).toBe(true);
      expect(editalEstaAtivo(false)).toBe(false);
    });

    it("aceita as formas de texto usadas na planilha", () => {
      for (const valor of ["sim", "SIM", "s", "ativo", "1", "true", "x", "X"]) {
        expect(editalEstaAtivo(valor)).toBe(true);
      }
    });

    it("trata ausência e negativa como inativo", () => {
      for (const valor of [
        null,
        undefined,
        "",
        "   ",
        "nao",
        "não",
        "0",
        "n",
      ]) {
        expect(editalEstaAtivo(valor)).toBe(false);
      }
    });

    it("ignora acento e espaço em volta", () => {
      expect(editalEstaAtivo("  Ativo  ")).toBe(true);
    });
  });

  describe("montagem dos editais a partir das linhas", () => {
    it("reduz muitas linhas de candidato a uma linha por edital", () => {
      const editais = editaisDasLinhas([
        {
          grupo: "G1",
          unidade: "DSEI X",
          edital: "01/2026",
          edital_ativo: true,
          data_inicio_analise: "2026-01-10",
          data_fim_analise: "2026-02-10",
          candidato: "Fulano",
        },
        {
          grupo: "G1",
          unidade: "DSEI X",
          edital: "01/2026",
          edital_ativo: true,
          data_inicio_analise: "2026-01-10",
          data_fim_analise: "2026-02-10",
          candidato: "Beltrano",
        },
      ]);

      expect(editais).toHaveLength(1);
      expect(editais[0]).toEqual({
        grupo: "G1",
        unidade: "DSEI X",
        edital: "01/2026",
        ativo: true,
        data_inicio_analise: "2026-01-10",
        data_fim_analise: "2026-02-10",
      });
    });

    it("completa a janela quando a primeira linha não a traz", () => {
      const [edital] = editaisDasLinhas([
        { unidade: "DSEI Y", edital: "02/2026", edital_ativo: false },
        {
          unidade: "DSEI Y",
          edital: "02/2026",
          edital_ativo: true,
          data_inicio_analise: "2026-05-01",
          data_fim_analise: "2026-06-01",
        },
      ]);

      expect(edital.data_inicio_analise).toBe("2026-05-01");
      expect(edital.data_fim_analise).toBe("2026-06-01");
      expect(edital.ativo).toBe(true);
    });

    /*
    Comportamento deliberado, registrado para ninguém mudá-lo por engano: a
    primeira janela vence. Se a view um dia devolver datas divergentes para o
    mesmo edital, a diferença é descartada aqui — e é este teste que revela onde
    a verificação teria de entrar.
  */
    it("mantém a primeira janela quando duas linhas divergem", () => {
      const [edital] = editaisDasLinhas([
        {
          unidade: "DSEI Z",
          edital: "03/2026",
          data_inicio_analise: "2026-01-10",
          data_fim_analise: "2026-02-10",
        },
        {
          unidade: "DSEI Z",
          edital: "03/2026",
          data_inicio_analise: "2026-03-01",
          data_fim_analise: "2026-04-01",
        },
      ]);

      expect(edital.data_inicio_analise).toBe("2026-01-10");
    });

    it("separa editais de unidades diferentes com o mesmo número", () => {
      const editais = editaisDasLinhas([
        { unidade: "DSEI A", edital: "01/2026" },
        { unidade: "DSEI B", edital: "01/2026" },
      ]);
      expect(editais).toHaveLength(2);
    });

    it("descarta linha sem unidade ou sem edital", () => {
      expect(
        editaisDasLinhas([
          { unidade: "", edital: "01/2026" },
          { unidade: "DSEI A", edital: "" },
          { edital: "01/2026" },
          { unidade: "DSEI A" },
        ]),
      ).toEqual([]);
    });

    it("usa o campo ativo quando a view não manda edital_ativo", () => {
      const [edital] = editaisDasLinhas([
        { unidade: "DSEI A", edital: "01/2026", ativo: "SIM" },
      ]);
      expect(edital.ativo).toBe(true);
    });

    it("aguenta entrada ausente ou de outro tipo", () => {
      expect(editaisDasLinhas(null)).toEqual([]);
      expect(editaisDasLinhas(undefined)).toEqual([]);
      expect(editaisDasLinhas("não é lista")).toEqual([]);
      expect(editaisDasLinhas([null, undefined])).toEqual([]);
    });

    it("normaliza a chave, para não duplicar por acento ou caixa", () => {
      expect(chaveDoEdital("G", "DSEI Xavánte", "01/2026")).toBe(
        chaveDoEdital("g", "dsei xavante", "01/2026"),
      );
    });
  });
});

bloco("editais-do-nucleo", () => {
  const CATALOGO = [
    {
      id_unidade: "U1",
      sigla: "MAO",
      nome_oficial: "DSEI Manaus",
      tipo: "DSEI",
      uf_sede: "am",
    },
    {
      id_unidade: "U2",
      sigla: "SP",
      nome_oficial: "CASAI São Paulo",
      tipo: "CASAI",
      uf_sede: "sp",
    },
  ];

  describe("fila do Núcleo", () => {
    it("risco alto primeiro; no mesmo risco, mais vagas ociosas primeiro", () => {
      const linhas = [
        { id: "a", risco: "Baixo", vagas_ociosas: 9 },
        { id: "b", risco: "Alto", vagas_ociosas: 1 },
        { id: "c", risco: "Médio", vagas_ociosas: 2 },
        { id: "d", risco: "Médio", vagas_ociosas: 5 },
        { id: "e", risco: "", vagas_ociosas: 50 },
      ];
      expect(linhas.sort(compararEditais).map((l) => l.id)).toEqual([
        "b",
        "d",
        "c",
        "a",
        "e",
      ]);
    });
  });

  describe("unidades do formulário", () => {
    it("o catálogo é completado pelas unidades que só existem nos editais", () => {
      const unidades = unidadesDisponiveis(CATALOGO, [
        { unidade: "DSEI Manaus" },
        { unidade: "CASAI Antiga", uf: "rr" },
      ]);
      expect(unidades.map((u) => u.nome_oficial)).toEqual([
        "CASAI Antiga",
        "CASAI São Paulo",
        "DSEI Manaus",
      ]);
    });

    it("o CORES tem as suas próprias unidades, sem UF", () => {
      expect(
        opcoesDeUnidade("CORES", CATALOGO, []).map((u) => u.nome_oficial),
      ).toEqual(UNIDADES_CORES);
    });

    it("acha a unidade pelo id e, na falta dele, pelo nome sem acento", () => {
      expect(
        formularioDoEdital({ id_unidade: "U2" }, CATALOGO, []).unidade,
      ).toBe("U2");
      const pelo = formularioDoEdital(
        { unidade: "casai sao paulo" },
        CATALOGO,
        [],
      );
      expect(pelo).toMatchObject({ unidade: "U2", idUnidade: "U2", uf: "SP" });
    });

    it("responsável antigo, com nome de pessoa, abre vazio", () => {
      expect(
        formularioDoEdital({ responsavel: "Maria" }, CATALOGO, []).responsavel,
      ).toBe("");
    });

    /*
    Edital do CORES com unidade que não está na lista: o select abre vazio, e
    salvar sem escolher tem de falhar na validação — e não gravar o texto do
    placeholder como unidade, como acontecia antes.
  */
    it("sem unidade escolhida, o payload vai sem unidade", () => {
      const formulario = formularioDoEdital(
        { edital: "1/2026", responsavel: "CORES", unidade: "Inexistente" },
        CATALOGO,
        [],
      );
      expect(formulario.unidade).toBe("");
      const edital = editalParaSalvar(
        formulario,
        null,
        { automatico: false, etapas: [] },
        { status: "", etapa: "" },
      );
      expect(edital.unidade).toBe("");
    });
  });

  describe("resumo e filtro operacional", () => {
    const resumo = [
      {
        id: "1",
        unidade: "DSEI",
        edital: "01",
        alerta_tipo: "incompleto",
        status: "Planejado",
      },
      {
        id: "2",
        unidade: "DSEI",
        edital: "01",
        alerta_tipo: "proxima_3d",
        status: "Em andamento",
      },
      {
        id: "3",
        unidade: "CASAI",
        edital: "02",
        alerta_tipo: "ok",
        status: "Concluído",
      },
    ];

    it("o id distingue dois registros com o mesmo edital e unidade", () => {
      const indice = indexarResumo(resumo);
      expect(
        resumoDoEdital(indice, { id: "2", unidade: "DSEI", edital: "01" })
          .alerta_tipo,
      ).toBe("proxima_3d");
      // Sem id no resumo, cai no nome — sem acento nem caixa.
      expect(
        resumoDoEdital(indice, { id: "9", unidade: "casai", edital: "02" }).id,
      ).toBe("3");
    });

    it("conta os indicadores", () => {
      const valores = Object.fromEntries(
        indicadoresDoResumo(resumo).map((cartao) => [cartao.key, cartao.value]),
      );
      expect(valores).toEqual({
        todos: 3,
        ativos: 2,
        inativos: 1,
        andamento: 2,
        sem_cronograma: 0,
        incompleto: 1,
        proxima: 1,
        excepcional: 0,
      });
    });

    it("sem resumo, a linha só aparece sem filtro", () => {
      expect(passaNoFiltroOperacional(null, "todos")).toBe(true);
      expect(passaNoFiltroOperacional(null, "incompleto")).toBe(false);
      expect(passaNoFiltroOperacional(null, "ativos")).toBe(false);
      expect(passaNoFiltroOperacional(resumo[1], "proxima")).toBe(true);
    });
  });

  /* Histórias em docs/historias-de-usuario/editais.md. */
  describe("ED-1 — editais ativos e inativos (regra)", () => {
    it("vistaDoIndicador: ativos e inativos às suas abas; os demais a Todos", () => {
      expect(vistaDoIndicador("ativos")).toBe("ativos");
      expect(vistaDoIndicador("inativos")).toBe("historico");
      for (const chave of [
        "todos",
        "andamento",
        "sem_cronograma",
        "incompleto",
        "proxima",
        "excepcional",
      ])
        expect(vistaDoIndicador(chave)).toBe("todas");
    });

    it("ED-1.1 — os cartões Editais ativos e Editais inativos, e o Total de editais é a soma", () => {
      const resumo = [
        { id: "1", status: "Em andamento" },
        { id: "2", status: "Planejado" },
        { id: "3", status: "Concluído" },
      ];
      const cartoes = Object.fromEntries(
        indicadoresDoResumo(resumo).map((c) => [c.key, c]),
      );
      expect(cartoes.todos.label).toBe("Total de editais");
      expect(cartoes.ativos).toMatchObject({
        label: "Editais ativos",
        value: 2,
      });
      expect(cartoes.inativos).toMatchObject({
        label: "Editais inativos",
        value: 1,
      });
      expect(cartoes.ativos.value + cartoes.inativos.value).toBe(
        cartoes.todos.value,
      );
    });

    it("ED-1.2 — cancelado é inativo; suspenso, paralisado e sem status são ativos (sem caixa nem acento)", () => {
      expect(situacaoDoEdital("Cancelado")).toBe("inativo");
      expect(situacaoDoEdital("concluido")).toBe("inativo");
      expect(situacaoDoEdital("CONCLUÍDO")).toBe("inativo");
      expect(situacaoDoEdital("Suspenso")).toBe("ativo");
      expect(situacaoDoEdital("Paralisado")).toBe("ativo");
      expect(situacaoDoEdital("")).toBe("ativo");
      expect(situacaoDoEdital(null)).toBe("ativo");
      expect(
        contarAtivosEInativos([
          { status: "Cancelado" },
          { status: "Suspenso" },
          {},
          null,
        ]),
      ).toEqual({ ativos: 3, inativos: 1 });
    });

    it("ED-1.3 — conta só os editais da área (o resumo recortado pelas linhas da área)", () => {
      const resumo = [
        { id: "1", unidade: "DSEI", edital: "01", status: "Em andamento" },
        { id: "2", unidade: "SEDE", edital: "02", status: "Concluído" },
        { id: "3", unidade: "SEDE", edital: "03", status: "Cancelado" },
      ];
      const daArea = resumoDasLinhas(resumo, [{ id: "2" }, { id: "3" }]);
      expect(contarAtivosEInativos(daArea)).toEqual({ ativos: 0, inativos: 2 });
    });

    it("ED-2.1 — o filtro de situação recorta pelo status e o chip diz Situação", () => {
      expect(
        passaNoFiltroOperacional({ status: "Concluído" }, "inativos"),
      ).toBe(true);
      expect(passaNoFiltroOperacional({ status: "Concluído" }, "ativos")).toBe(
        false,
      );
      expect(passaNoFiltroOperacional({ status: "Suspenso" }, "ativos")).toBe(
        true,
      );
      expect(rotuloDoFiltroOperacional("inativos")).toBe("Situação");
      expect(rotuloDoFiltroOperacional("sem_cronograma")).toBe("Alerta");
    });
  });

  describe("unidades por área", () => {
    const TA = [
      { unidade: "SEDE", area: "sede" },
      { unidade: "Rio Doce", area: "projetos" },
    ];

    it("TA_UNIDADE_AREA manda; depois o catálogo (Saúde Indígena); depois os editais", () => {
      const mapa = mapaDeAreasDasUnidades({
        unidadesPorArea: TA,
        catalogo: CATALOGO,
        linhas: [
          // Edital movido para a SEDE não tira o DSEI da Saúde Indígena.
          { unidade: "DSEI Manaus", CO_AREA: "sede" },
          { unidade: "Unidade Antiga", CO_AREA: "projetos" },
          { unidade: "sede", CO_AREA: "saude-indigena" },
        ],
      });
      expect(areaDaUnidade("DSEI  Manaus", mapa)).toBe("saude-indigena");
      expect(areaDaUnidade("Unidade Antiga", mapa)).toBe("projetos");
      expect(areaDaUnidade("Sede", mapa)).toBe("sede");
      expect(areaDaUnidade("Desconhecida", mapa)).toBe("");
    });

    it("filtra pela área, deixa as desconhecidas e mantém a unidade do edital aberto", () => {
      const mapa = mapaDeAreasDasUnidades({ unidadesPorArea: TA });
      const opcoes = opcoesDeUnidade("CORES", CATALOGO, []);
      expect(
        unidadesDaArea(opcoes, "sede", mapa).map((u) => u.nome_oficial),
      ).toEqual(UNIDADES_CORES.filter((nome) => nome !== "Rio Doce"));
      expect(
        unidadesDaArea(opcoes, "sede", mapa, "Rio Doce").map(
          (u) => u.nome_oficial,
        ),
      ).toContain("Rio Doce");
    });

    it("unidade registrada com área entra em qualquer responsável, uma vez só", () => {
      const registradas = [
        ...TA,
        { unidade: "CCE", area: "projetos" },
        { unidade: "Projeto Novo", area: "projetos" },
      ];
      const mapa = mapaDeAreasDasUnidades({
        unidadesPorArea: registradas,
        catalogo: CATALOGO,
      });
      const nomes = (responsavel) =>
        unidadesDaArea(
          opcoesDeUnidade(responsavel, CATALOGO, [], registradas),
          "projetos",
          mapa,
        ).map((u) => u.nome_oficial);
      expect(nomes("")).toEqual(["CCE", "Projeto Novo", "Rio Doce"]);
      expect(nomes("USI")).toEqual(["CCE", "Projeto Novo", "Rio Doce"]);
      expect(nomes("CORES")).toEqual([
        ...UNIDADES_CORES.filter((nome) => nome !== "SEDE"),
        "Projeto Novo",
      ]);
    });

    it("o payload leva co_area só quando há área", () => {
      const formulario = formularioDoEdital(null, CATALOGO, []);
      const cronograma = { automatico: false, etapas: [] };
      const previa = { status: "", etapa: "" };
      expect(
        editalParaSalvar(formulario, null, cronograma, previa, "sede").co_area,
      ).toBe("sede");
      expect(
        editalParaSalvar(formulario, null, cronograma, previa),
      ).not.toHaveProperty("co_area");
    });
  });

  describe("datas do edital pelo cronograma", () => {
    const etapas = [
      {
        atividade: "Publicação",
        data_inicio: "2026-09-14",
        data_fim: "2026-09-15",
      },
      { atividade: "Erro", data_inicio: "0202-10-09", data_fim: "0202-10-09" },
      {
        atividade: "Resultado final",
        data_inicio: "2026-11-12",
        data_fim: "2026-11-12",
      },
    ];
    it("primeira data e última, ignorando etapa com ano impossível", () => {
      expect(periodoDoCronograma(etapas)).toEqual({
        inicio: "2026-09-14",
        fim: "2026-11-12",
      });
      expect(periodoDoCronograma([])).toBeNull();
    });
    it("com o automático, as datas digitadas não valem; sem ele, valem", () => {
      const formulario = {
        edital: "107/2026",
        dataInicio: "0202-11-12",
        dataFim: "20206-09-14",
      };
      const previa = { status: "Em andamento", etapa: "x" };
      const auto = editalParaSalvar(
        formulario,
        null,
        { automatico: true, etapas },
        previa,
      );
      expect([auto.data_inicio, auto.data_fim]).toEqual([
        "2026-09-14",
        "2026-11-12",
      ]);
      const manual = editalParaSalvar(
        formulario,
        null,
        { automatico: false, etapas },
        previa,
      );
      expect(manual.data_inicio).toBe("0202-11-12");
    });
  });

  /*
  A busca da tabela de Editais diferenciava acentos: "solimoes" não achava
  "Solimões". Como na busca global, "saude" acha "Saúde" (e o contrário).
*/
  describe("busca da tabela de Editais", () => {
    const linhas = [
      {
        edital: "12/2026",
        unidade: "DSEI Alto Rio Solimões",
        status: "Em elaboração",
        risco: "Médio",
      },
      { edital: "13/2026", unidade: "DSEI Manaus", status: "Concluído" },
    ];

    it.each([
      "solimoes",
      "Solimões",
      "SOLIMOES",
      "elaboracao",
      "medio",
      "Médio",
    ])("%s acha a linha com acento", (termo) => {
      expect(filtrarEditais(linhas, termo).map((l) => l.edital)).toEqual([
        "12/2026",
      ]);
    });

    it("termo com acento acha texto sem acento", () => {
      expect(
        filtrarEditais([{ edital: "1/2026", unidade: "Saude" }], "saúde"),
      ).toHaveLength(1);
    });

    it("sem termo, devolve todas na ordem da fila", () => {
      expect(filtrarEditais(linhas, "  ")).toHaveLength(2);
    });
  });
});

bloco("endereco-do-painel", () => {
  describe("endereço do painel externo", () => {
    it("painel de fora fica como está", () => {
      const appsScript = "https://script.google.com/macros/s/abc/exec";
      expect(enderecoDoPainel(appsScript, "http://localhost:5173")).toBe(
        appsScript,
      );
    });

    it("recusa o que não é http(s)", () => {
      expect(enderecoDoPainel("javascript:alert(1)", "http://localhost")).toBe(
        "",
      );
      expect(enderecoDoPainel("", "http://localhost")).toBe("");
      expect(enderecoDoPainel("http://[x", "http://localhost")).toBe("");
    });

    it("recusa endereço relativo e o do próprio Yeendé", () => {
      const origem = "https://monitora.exemplo";
      expect(enderecoDoPainel("/analises.html", origem)).toBe("");
      expect(enderecoDoPainel("analises.html", origem)).toBe("");
      expect(enderecoDoPainel("//monitora.exemplo/x", origem)).toBe("");
      expect(
        enderecoDoPainel("https://monitora.exemplo/analises.html", origem),
      ).toBe("");
      expect(enderecoDoPainel("https://monitora.exemplo:8443/x", origem)).toBe(
        "https://monitora.exemplo:8443/x",
      );
    });
  });
});

bloco("etapas-de-edital", () => {
  /*
  As doze atividades do modelo padrão, copiadas de `nucleo-cronograma.js`
  (função que monta o modelo). São o caso real: a maioria dos editais usa este
  modelo sem alterar os nomes. Se a classificação regredir, regride aqui.
*/
  const MODELO_PADRAO = [
    ["Publicação do Edital", "inscricoes"],
    ["Impugnação do Edital", "impugnacao"],
    [
      "Período de inscrição e envio dos documentos comprobatórios",
      "inscricoes",
    ],
    ["Resultado Preliminar da Avaliação Documental e de Títulos", "resultado"],
    ["Prazo de recurso do resultado preliminar documental", "recursos"],
    ["Resultado Final da Avaliação Documental e de Títulos", "resultado"],
    ["Convocação para Entrevista", "convocacao-entrevista"],
    ["Período de Entrevistas", "entrevistas"],
    ["Resultado Preliminar das Entrevistas", "resultado"],
    ["Prazo para recursos das entrevistas", "recursos"],
    ["Resultado final da Entrevista", "resultado"],
    ["Resultado final do Processo Seletivo", "resultado-final"],
  ];

  describe("classificarEtapa", () => {
    it.each(MODELO_PADRAO)("classifica %j como %s", (atividade, esperado) => {
      expect(classificarEtapa(atividade).id).toBe(esperado);
    });

    it("ignora acentos e caixa, porque a atividade é digitada à mão", () => {
      expect(classificarEtapa("IMPUGNAÇÃO DO EDITAL").id).toBe("impugnacao");
      expect(classificarEtapa("impugnacao do edital").id).toBe("impugnacao");
      expect(classificarEtapa("  Impugnação  ").id).toBe("impugnacao");
    });

    it("dá precedência a recurso sobre resultado na mesma frase", () => {
      // O caso que motiva a ordem de TIPOS_DE_ETAPA: a frase tem as duas palavras.
      expect(
        classificarEtapa("Prazo de recurso do resultado preliminar").id,
      ).toBe("recursos");
    });

    it("dá precedência a resultado sobre entrevista na mesma frase", () => {
      expect(classificarEtapa("Resultado Preliminar das Entrevistas").id).toBe(
        "resultado",
      );
    });

    it("não confunde 'documentos comprobatórios' com análise documental", () => {
      // "documentos" não casa com o termo "documental"; inscrição deve vencer.
      expect(
        classificarEtapa("Período de inscrição e envio dos documentos").id,
      ).toBe("inscricoes");
    });

    /*
    Os três tipos abaixo foram separados de tipos maiores a pedido de quem usa a
    tela. Cada um contém a palavra-chave do tipo de onde saiu, por isso depende
    inteiramente da ordem de `TIPOS_DE_ETAPA`. Estes testes são o que impede que
    reordenar a lista os devolva silenciosamente ao tipo antigo.
  */
    it("separa impugnação de recursos", () => {
      expect(classificarEtapa("Impugnação do Edital").id).toBe("impugnacao");
      // Recurso continua recurso: contesta um resultado, não o edital.
      expect(classificarEtapa("Prazo de recurso das entrevistas").id).toBe(
        "recursos",
      );
    });

    it("separa convocação para entrevista da entrevista em si", () => {
      expect(classificarEtapa("Convocação para Entrevista").id).toBe(
        "convocacao-entrevista",
      );
      expect(classificarEtapa("Convocação para a Entrevista").id).toBe(
        "convocacao-entrevista",
      );
      expect(classificarEtapa("Período de Entrevistas").id).toBe("entrevistas");
    });

    it("não confunde outras convocações com a da entrevista", () => {
      // Não existe tipo para admissão; o que importa é não virar entrevista.
      expect(classificarEtapa("Convocação para admissão").id).not.toBe(
        "convocacao-entrevista",
      );
    });

    /*
    Homologação e admissão tiveram tipo próprio e deixaram de ter: o cronograma
    dos editais não tem essas etapas, e duas cores que nunca pintavam nada só
    gastavam a legenda. Cair em `outros`, com cor neutra, é o comportamento certo
    para o que o sistema não sabe classificar — e este teste impede que voltem
    por acidente, capturadas por termos de outro tipo.
  */
    it("deixa homologação e admissão em 'outros'", () => {
      expect(classificarEtapa("Homologação do certame").id).toBe("outros");
      expect(classificarEtapa("Início das admissões").id).toBe("outros");
      expect(classificarEtapa("Posse dos aprovados").id).toBe("outros");
    });

    it("mantém a homologação do resultado final como resultado final", () => {
      // O marco importa mais que o verbo: é o fecho do processo, não um trâmite.
      expect(
        classificarEtapa("Homologação do resultado final do processo").id,
      ).toBe("resultado-final");
    });

    it("separa o resultado final do processo dos resultados parciais", () => {
      expect(classificarEtapa("Resultado final do Processo Seletivo").id).toBe(
        "resultado-final",
      );
      expect(
        classificarEtapa("Resultado Final da Avaliação Documental e de Títulos")
          .id,
      ).toBe("resultado");
      expect(classificarEtapa("Resultado final da Entrevista").id).toBe(
        "resultado",
      );
    });

    it("não trata qualquer menção a processo seletivo como resultado final", () => {
      // Motivo de os termos serem frases inteiras e não "processo seletivo".
      expect(
        classificarEtapa("Publicação do Edital do Processo Seletivo").id,
      ).toBe("inscricoes");
    });

    it("cai em 'outros' em vez de adivinhar, quando nada casa", () => {
      expect(classificarEtapa("Reunião com a comissão").id).toBe("outros");
      expect(classificarEtapa("").id).toBe("outros");
      expect(classificarEtapa(null).id).toBe("outros");
      expect(classificarEtapa(undefined).id).toBe("outros");
    });

    it("sempre devolve um tipo utilizável, nunca null", () => {
      for (const entrada of ["", null, undefined, 42, {}, []]) {
        const tipo = classificarEtapa(entrada);
        expect(tipo).toBeTruthy();
        expect(typeof tipo.rotulo).toBe("string");
        expect(typeof tipo.cor).toBe("string");
      }
    });

    it("não tem ids nem cores duplicados entre os tipos", () => {
      const ids = TIPOS_DE_ETAPA.map((tipo) => tipo.id);
      expect(new Set(ids).size).toBe(ids.length);
      const cores = TIPOS_DE_ETAPA.map((tipo) => tipo.cor);
      expect(new Set(cores).size).toBe(cores.length);
    });
  });

  describe("normalizarTexto", () => {
    // É a base da busca do calendário: quem digita sem acento tem de encontrar.
    it("remove acentos e baixa a caixa", () => {
      expect(normalizarTexto("Homologação")).toBe("homologacao");
      expect(normalizarTexto("DSEI ALTO RIO NEGRO")).toBe(
        "dsei alto rio negro",
      );
      expect(normalizarTexto("Avaliação Documental")).toBe(
        "avaliacao documental",
      );
    });

    it("apara as pontas e aguenta entrada inválida", () => {
      expect(normalizarTexto("  Entrevistas  ")).toBe("entrevistas");
      expect(normalizarTexto("")).toBe("");
      expect(normalizarTexto(null)).toBe("");
      expect(normalizarTexto(undefined)).toBe("");
    });

    it("permite achar a etapa digitando sem acento", () => {
      const alvo = normalizarTexto(
        "Convocação para a Entrevista — Ed. 97/2026",
      );
      expect(alvo.includes(normalizarTexto("convocacao"))).toBe(true);
      expect(alvo.includes(normalizarTexto("ENTREVISTA"))).toBe(true);
    });
  });

  describe("dataLocal", () => {
    it("ancora ao meio-dia local, para a etapa não recuar um dia", () => {
      const data = dataLocal("2026-09-29");
      expect(data.getFullYear()).toBe(2026);
      expect(data.getMonth()).toBe(8); // setembro
      expect(data.getDate()).toBe(29);
    });

    it("devolve null para entrada vazia ou inválida", () => {
      expect(dataLocal("")).toBeNull();
      expect(dataLocal(null)).toBeNull();
      expect(dataLocal("não é data")).toBeNull();
    });
  });

  describe("situacaoDaEtapa", () => {
    const hoje = new Date(2026, 8, 29, 9, 30); // 29/09/2026, de manhã

    it("marca como concluída quando a data fim já passou", () => {
      expect(
        situacaoDaEtapa(
          { data_inicio: "2026-09-01", data_fim: "2026-09-10" },
          hoje,
        ),
      ).toBe(SITUACAO_ETAPA.CONCLUIDA);
    });

    it("marca como em andamento quando hoje está dentro do intervalo", () => {
      expect(
        situacaoDaEtapa(
          { data_inicio: "2026-09-25", data_fim: "2026-10-05" },
          hoje,
        ),
      ).toBe(SITUACAO_ETAPA.EM_ANDAMENTO);
    });

    it("inclui os dias de início e fim no intervalo", () => {
      expect(
        situacaoDaEtapa(
          { data_inicio: "2026-09-29", data_fim: "2026-09-29" },
          hoje,
        ),
      ).toBe(SITUACAO_ETAPA.EM_ANDAMENTO);
    });

    /*
    Houve um quarto estado, separando "Pendente" de "Programado" por um limite de
    dez dias que não vinha de regra nenhuma. Este teste fixa que não voltou: o
    que ainda não começou é futuro, esteja a cinco dias ou a dois meses.
  */
    it("não distingue futuro próximo de futuro distante", () => {
      const daquiA5Dias = situacaoDaEtapa(
        { data_inicio: "2026-10-04", data_fim: "2026-10-06" },
        hoje,
      );
      const daquiA2Meses = situacaoDaEtapa(
        { data_inicio: "2026-11-30", data_fim: "2026-12-01" },
        hoje,
      );
      expect(daquiA5Dias).toBe(SITUACAO_ETAPA.FUTURA);
      expect(daquiA2Meses).toBe(SITUACAO_ETAPA.FUTURA);
    });

    it("usa a data de início quando falta a data fim", () => {
      expect(situacaoDaEtapa({ data_inicio: "2026-09-29" }, hoje)).toBe(
        SITUACAO_ETAPA.EM_ANDAMENTO,
      );
    });

    it("devolve null quando a etapa não tem datas utilizáveis", () => {
      expect(situacaoDaEtapa({}, hoje)).toBeNull();
      expect(situacaoDaEtapa({ data_fim: "2026-09-30" }, hoje)).toBeNull();
      expect(situacaoDaEtapa(null, hoje)).toBeNull();
    });
  });

  describe("etapaConcluida", () => {
    const hoje = new Date(2026, 8, 29, 9, 30);

    it("é verdadeiro só para o que já terminou", () => {
      expect(
        etapaConcluida(
          { data_inicio: "2026-09-01", data_fim: "2026-09-10" },
          hoje,
        ),
      ).toBe(true);
      expect(
        etapaConcluida(
          { data_inicio: "2026-09-29", data_fim: "2026-09-29" },
          hoje,
        ),
      ).toBe(false);
      expect(
        etapaConcluida(
          { data_inicio: "2026-10-20", data_fim: "2026-10-21" },
          hoje,
        ),
      ).toBe(false);
    });

    // Sem datas não dá para afirmar que terminou; esconder seria perder a etapa.
    it("não trata etapa sem datas como concluída", () => {
      expect(etapaConcluida({}, hoje)).toBe(false);
    });
  });
});

bloco("falha-de-rede", () => {
  afterEach(() => vi.useRealTimers());

  describe("mensagem de falha de rede", () => {
    it("'Failed to fetch' e parecidos viram a mensagem clara", () => {
      for (const erro of [
        new TypeError("Failed to fetch"),
        { message: "TypeError: Failed to fetch" },
        { message: "NetworkError when attempting to fetch resource." },
        { message: "Load failed" },
        { name: "FalhaDeConexao", falhaTransitoria: true, message: "x" },
      ]) {
        expect(ehFalhaDeConexao(erro)).toBe(true);
        expect(mensagemDeFalha(erro)).toBe(SEM_SERVIDOR);
      }
      expect(SEM_SERVIDOR).toBe(
        "Não foi possível falar com o servidor. Verifique a conexão e tente de novo.",
      );
    });

    it("erro do banco continua com a mensagem do banco", () => {
      const erro = {
        message: "Sem permissão para este recurso",
        code: "42501",
      };
      expect(ehFalhaDeConexao(erro)).toBe(false);
      expect(mensagemDeFalha(erro)).toBe("Sem permissão para este recurso");
    });

    it("comTempoLimite rejeita com TempoEsgotado quando a promessa não volta", async () => {
      vi.useFakeTimers();
      const espera = comTempoLimite(new Promise(() => {}), 5000);
      const verificacao = expect(espera).rejects.toBeInstanceOf(TempoEsgotado);
      await vi.advanceTimersByTimeAsync(5000);
      await verificacao;
      vi.useRealTimers();
      const erro = await comTempoLimite(new Promise(() => {}), 10).catch(
        (e) => e,
      );
      expect(mensagemDeFalha(erro)).toContain(SEM_SERVIDOR);
    });

    it("comTempoLimite devolve o resultado quando chega a tempo", async () => {
      await expect(comTempoLimite(Promise.resolve(7), 1000)).resolves.toBe(7);
    });
  });
});

bloco("fronteira-de-dados", () => {
  const app = fonteDoApp();
  const acessos = readFileSync("src/modulos/acessos/estado.ts", "utf8");

  describe("contrato de RPC", () => {
    it("declara as funções de administração de acesso como críticas", () => {
      for (const nome of [
        "aprovar_solicitacao_acesso",
        "recusar_solicitacao_acesso",
        "desativar_acesso_usuario",
      ]) {
        expect(RPCS_CRITICAS, `${nome} deveria ser crítica`).toContain(nome);
      }
    });

    /*
    Auditoria e presença nunca podem derrubar a interface: se falharem, a pessoa
    continua trabalhando. Marcá-las como críticas faria o build cair por um
    registo de log.
  */
    it("não trata auditoria e presença como críticas", () => {
      expect(contratoDe("registrar_evento_acesso").critica).toBe(false);
      expect(contratoDe("registrar_presenca_monitora").critica).toBe(false);
      expect(contratoDe("listar_presenca_online_monitora").critica).toBe(false);
    });

    it("descreve cada função declarada", () => {
      for (const [nome, c] of Object.entries(CONTRATO_RPC)) {
        expect(c.resumo, `${nome} sem resumo`).toBeTruthy();
        expect(
          Array.isArray(c.argumentos),
          `${nome} sem lista de argumentos`,
        ).toBe(true);
      }
    });
  });

  describe("fronteira de dados na administração de acesso", () => {
    /*
    Esta é a regressão que motivou a mudança: aprovar, atualizar e desativar já
    passavam por RPC, mas recusar gravava direto na tabela — escolhendo no
    navegador `status`, `avaliado_por` e `avaliado_em`. A autorização da mesma
    decisão ficava em dois lugares. Hoje a decisão é do Acessos em React
    (src/modulos/acessos/estado.ts).
  */
    it("recusar solicitação passa por RPC, não por escrita direta", () => {
      const inicio = acessos.indexOf("function recusar(");
      expect(inicio).toBeGreaterThan(-1);
      const fn = acessos.slice(inicio, inicio + 900);
      expect(fn).toContain("rpc(RPC_RECUSAR");
      expect(acessos).toContain(
        'const RPC_RECUSAR = "recusar_solicitacao_acesso"',
      );
      expect(acessos).not.toMatch(
        /\.from\(\s*["']TB_SOLICITACAO_ACESSO["']\s*\)/,
      );
    });

    it("nenhuma decisão de acesso é gravada direto na tabela", () => {
      const decisoes = [
        /status:\s*"recusado"/,
        /status:\s*"aprovado"/,
        /avaliado_por:/,
      ];
      for (const fonte of [app, acessos]) {
        for (const padrao of decisoes) {
          expect(
            fonte,
            `campo de decisão escrito no cliente: ${padrao}`,
          ).not.toMatch(padrao);
        }
      }
    });
  });
});

bloco("frontend-performance-monitor", () => {
  describe("frontend performance monitor", () => {
    it("arredonda métricas inválidas com segurança", () => {
      expect(roundMetric(12.6)).toBe(13);
      expect(roundMetric("8.2")).toBe(8);
      expect(roundMetric(Number.NaN)).toBe(0);
    });

    it("resume recursos transferidos", () => {
      expect(
        summarizeResourceEntries([
          { transferSize: 1024, decodedBodySize: 2048 },
          { transferSize: 512, decodedBodySize: 1024 },
        ]),
      ).toEqual({
        count: 2,
        transferSize: 1536,
        decodedBodySize: 3072,
      });
    });

    it("cria snapshot técnico sem dados pessoais", () => {
      const snapshot = createPerformanceSnapshot({
        navigationEntry: {
          domInteractive: 1100,
          domContentLoadedEventEnd: 1500,
          loadEventEnd: 2100,
          responseEnd: 700,
        },
        resourceEntries: [{ transferSize: 2048, decodedBodySize: 4096 }],
        longTasks: { count: 2, durationMs: 125.4 },
        requests: { started: 4, completed: 3, failed: 1 },
        memory: {
          usedJSHeapSize: 20 * 1024 * 1024,
          totalJSHeapSize: 30 * 1024 * 1024,
          jsHeapSizeLimit: 100 * 1024 * 1024,
        },
        connection: {
          effectiveType: "4g",
          downlink: 10,
          rtt: 40,
          saveData: false,
        },
        pathname: "/analises.html",
        visibilityState: "visible",
        now: Date.UTC(2026, 6, 28, 12, 0, 0),
      });

      expect(snapshot.pathname).toBe("/analises.html");
      expect(snapshot.navigation.load_event_ms).toBe(2100);
      expect(snapshot.resources.transfer_kb).toBe(2);
      expect(snapshot.requests.failed).toBe(1);
      expect(snapshot.long_tasks.duration_ms).toBe(125);
      expect(snapshot.memory.used_mb).toBe(20);
      expect(snapshot.connection.effective_type).toBe("4g");
      expect(snapshot).not.toHaveProperty("user_id");
    });
  });
});

bloco("graficos-sob-demanda", () => {
  /*
  O Chart.js baixa no primeiro gráfico, não na entrada: src/main.ts importa
  chartjs-global.ts, e um import estático de chart.js ali punha o
  vendor-charts no modulepreload da tela de login.
*/
  const semComentarios = (arquivo) =>
    readFileSync(arquivo, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

  describe("gráficos sob demanda", () => {
    it("nenhum import estático de chart.js no código do app", () => {
      for (const arquivo of [
        "src/lib/base/chartjs-global.ts",
        "src/ui/grafico.tsx",
      ])
        expect(semComentarios(arquivo)).not.toMatch(
          /^\s*import\s+(?!type\b)[^;]*from\s+["']chart\.js/m,
        );
    });

    it("baixa uma vez e guarda", async () => {
      expect(chartCarregado()).toBeNull();
      const primeiro = await carregarChart();
      expect(typeof primeiro).toBe("function");
      expect(chartCarregado()).toBe(primeiro);
      expect(await carregarChart()).toBe(primeiro);
    });
  });
});

bloco("icones-lucide", () => {
  /*
  O Font Awesome não é mais carregado: um `fa-…` sem par no mapa vira um
  quadrado vazio na tela, em silêncio. Estes testes varrem o código do site.
*/
  function arquivos(pasta, extensoes) {
    return readdirSync(pasta).flatMap((nome) => {
      const caminho = join(pasta, nome);
      if (statSync(caminho).isDirectory()) return arquivos(caminho, extensoes);
      return extensoes.some((ext) => nome.endsWith(ext)) ? [caminho] : [];
    });
  }

  const fontes = [
    // Examinar também TypeScript/TSX: os ícones sem mapeamento podem sumir em silêncio.
    ...arquivos("src", [".js", ".jsx", ".ts", ".tsx", ".html"]),
    "index.html",
    "auth/callback.html",
  ];

  const usados = new Set(
    fontes.flatMap((f) =>
      [
        ...readFileSync(f, "utf8").matchAll(/\bfa-[a-z0-9]+(?:-[a-z0-9]+)*/g),
      ].map((m) => m[0]),
    ),
  );

  describe("ícones Lucide no lugar do Font Awesome", () => {
    it("todo ícone fa-… usado no código tem equivalente Lucide", () => {
      const semPar = [...usados].filter(
        (classe) =>
          !FA_MODIFICADORES.includes(classe) &&
          !Object.hasOwn(FA_PARA_LUCIDE, classe) &&
          // `fa-chevron-${…}` monta o nome em tempo de execução; os dois
          // resultados possíveis estão no mapa.
          classe !== "fa-chevron",
      );
      expect(semPar).toEqual([]);
    });

    it("icones-lucide.css está atualizado com o mapa (rode npm run icones)", () => {
      const gravado = readFileSync(
        "src/styles/icones-lucide.css",
        "utf8",
      ).replace(/\r\n/g, "\n");
      expect(gravado).toBe(gerarCssDosIcones());
    });

    it("o Font Awesome não é mais carregado", () => {
      for (const pagina of ["index.html"]) {
        expect(readFileSync(pagina, "utf8")).not.toContain("font-awesome");
      }
    });

    it("o CSS dos ícones entra logo depois dos tokens", () => {
      const main = readFileSync("src/main.ts", "utf8");
      expect(main.indexOf("icones-lucide.css")).toBeGreaterThan(-1);
      expect(main.indexOf("icones-lucide.css")).toBeLessThan(
        main.indexOf("visual-polish.css"),
      );
    });
  });
});

bloco("importar-com-recarga", () => {
  /*
  Versão nova publicada com a página aberta: o pedaço baixado sob demanda (ex.:
  uma tela sob demanda) some e o import falha. Recarrega uma vez; sem laço.
*/

  function memoria() {
    const dados = new Map();
    return {
      getItem: (k) => (dados.has(k) ? dados.get(k) : null),
      setItem: (k, v) => dados.set(k, String(v)),
    };
  }

  const falhaDeVersao = () =>
    Promise.reject(
      new TypeError(
        "Failed to fetch dynamically imported module: /assets/painel-abc123.js",
      ),
    );

  describe("recarregarUmaVez", () => {
    it("recarrega e marca a hora; dentro da janela, não recarrega de novo", () => {
      const armazenamento = memoria();
      const recarregar = vi.fn();
      expect(recarregarUmaVez({ armazenamento, recarregar, agora: 1000 })).toBe(
        true,
      );
      expect(armazenamento.getItem(CHAVE_DA_RECARGA)).toBe("1000");
      expect(
        recarregarUmaVez({
          armazenamento,
          recarregar,
          agora: 1000 + JANELA_DA_RECARGA_MS - 1,
        }),
      ).toBe(false);
      expect(recarregar).toHaveBeenCalledTimes(1);
      expect(
        recarregarUmaVez({
          armazenamento,
          recarregar,
          agora: 1000 + JANELA_DA_RECARGA_MS,
        }),
      ).toBe(true);
      expect(recarregar).toHaveBeenCalledTimes(2);
    });

    it("sem sessionStorage (acesso negado), recarrega mesmo assim", () => {
      const armazenamento = {
        getItem: () => {
          throw new Error("negado");
        },
        setItem: () => {
          throw new Error("negado");
        },
      };
      const recarregar = vi.fn();
      expect(recarregarUmaVez({ armazenamento, recarregar, agora: 5 })).toBe(
        true,
      );
      expect(recarregar).toHaveBeenCalledOnce();
    });
  });

  describe("importarComRecarga", () => {
    it("devolve o módulo quando o import funciona", async () => {
      const modulo = { default: () => null };
      const recarregar = vi.fn();
      await expect(
        importarComRecarga(() => Promise.resolve(modulo), {
          armazenamento: memoria(),
          recarregar,
        })(),
      ).resolves.toBe(modulo);
      expect(recarregar).not.toHaveBeenCalled();
    });

    it("falha de carregamento: recarrega e a promessa fica pendente (sem erro na ilha)", async () => {
      const recarregar = vi.fn();
      const promessa = importarComRecarga(falhaDeVersao, {
        armazenamento: memoria(),
        recarregar,
        agora: 10_000,
      })();
      const resultado = await Promise.race([
        promessa.then(
          () => "resolveu",
          () => "rejeitou",
        ),
        new Promise((r) => setTimeout(() => r("pendente"), 20)),
      ]);
      expect(resultado).toBe("pendente");
      expect(recarregar).toHaveBeenCalledOnce();
    });

    it("falhou de novo logo depois de recarregar: repassa o erro (sem laço)", async () => {
      const armazenamento = memoria();
      armazenamento.setItem(CHAVE_DA_RECARGA, "10000");
      const recarregar = vi.fn();
      await expect(
        importarComRecarga(falhaDeVersao, {
          armazenamento,
          recarregar,
          agora: 10_500,
        })(),
      ).rejects.toThrow(/dynamically imported module/);
      expect(recarregar).not.toHaveBeenCalled();
    });

    it("o CSS da tela que não baixou (Vite) também recarrega", async () => {
      const recarregar = vi.fn();
      void importarComRecarga(
        () =>
          Promise.reject(
            new Error(
              "Unable to preload CSS for /assets/calendario-editais-C6Way2G9.css",
            ),
          ),
        { armazenamento: memoria(), recarregar, agora: 20_000 },
      )();
      await vi.waitFor(() => expect(recarregar).toHaveBeenCalledOnce());
    });

    it("erro que não é de carregamento é repassado sem recarregar", async () => {
      const recarregar = vi.fn();
      await expect(
        importarComRecarga(() => Promise.reject(new Error("bug no painel")), {
          armazenamento: memoria(),
          recarregar,
        })(),
      ).rejects.toThrow("bug no painel");
      expect(recarregar).not.toHaveBeenCalled();
    });
  });
});

bloco("modulos/avisos-de-conferencia-troca-de-area", () => {
  /*
  O selo de avisos recarrega ao trocar de área. Antes, a lista da área
  anterior ficava no estado durante a carga e, se a leitura falhasse, o selo
  continuava mostrando a contagem da área de antes.
*/
  const aviso = {
    id: "a1",
    conferencia: "ANALISE_APROVADA_ABAIXO_DO_CORTE",
    escopo: "edital:e1",
    gravidade: "CRITICA",
    modulo: "analises",
    area: "saude-indigena",
    quantidade: 3,
    resumo: "3 análises aprovadas abaixo do corte.",
    situacao: "ABERTO",
  };

  describe("Avisos de conferência: troca de área", () => {
    it("não mantém a lista da área anterior quando a leitura da nova falha", async () => {
      let falhar = false;
      const supabase = {
        rpc: async () =>
          falhar
            ? { data: null, error: { message: "sem permissão", code: "42501" } }
            : { data: { avisos: [aviso] }, error: null },
      };
      const estado = criarEstadoDosAvisos({ supabase });
      await estado.carregar({ area: "saude-indigena", modulo: "analises" });
      expect(estado.obter().lista.abertos).toHaveLength(1);

      falhar = true;
      await estado.carregar({ area: "projetos", modulo: "analises" });

      expect(estado.obter().status).toBe("error");
      expect(estado.obter().lista).toBeNull();
    });

    it("recarregar o mesmo recorte mantém a lista enquanto lê", async () => {
      const supabase = {
        rpc: async () => ({ data: { avisos: [aviso] }, error: null }),
      };
      const estado = criarEstadoDosAvisos({ supabase });
      await estado.carregar({ area: "saude-indigena", modulo: "analises" });
      const promessa = estado.carregar({
        area: "saude-indigena",
        modulo: "analises",
      });
      expect(estado.obter().lista.abertos).toHaveLength(1);
      await promessa;
    });
  });
});

bloco("painel-dos-robos", () => {
  /*
  "Rodar com opções" dos robôs, sem DOM: a lista branca e a validação
  (src/lib/automacao/robos-de-carga.ts, a mesma de disparar_robo) e a escolha de editais, a
  prévia, o histórico e o acompanhamento (src/lib/automacao/painel-dos-robos.ts).
*/

  const EMPREGARE = roboDeCarga("empregare");
  const PRE = roboDeCarga("pre_classificacao");
  const CONFERENCIAS = roboDeCarga("conferencias");
  const ID_93 = "11111111-1111-4111-a111-111111111193";
  const ID_80 = "11111111-1111-4111-a111-111111111180";
  const ID_93_SEDE = "11111111-1111-4111-a111-222222222293";

  const PAINEL = normalizarPainel({
    gerado_em: "2026-10-07T12:00:00Z",
    areas: [
      { area: "projetos", nome: "Projetos" },
      { area: "saude-indigena", nome: "Saúde Indígena" },
      { area: "sede", nome: "SEDE" },
    ],
    editais: [
      {
        id: ID_93,
        numero: "93/2026",
        area: "projetos",
        unidade: "SESMT",
        ativo: true,
        status: "Em andamento",
      },
      {
        id: ID_80,
        numero: "80/2026",
        area: "saude-indigena",
        unidade: "DSEI Yanomami",
        ativo: true,
        status: "Concluído",
      },
      {
        id: ID_93_SEDE,
        numero: "93/2026",
        area: "sede",
        unidade: "Sede",
        ativo: false,
        status: "Em andamento",
      },
      { id: "sem-numero", numero: null, area: "sede" },
    ],
    empregare: [
      {
        id: "gh-2",
        inicio: "2026-10-07T11:00:00Z",
        fim: "2026-10-07T11:30:00Z",
        situacao: "PARCIAL",
        disparo: "MONITORA",
        quem: "Pessoa Admin",
        filtro: { editais: [], vagas: ["179698", "180231"], limite: 2 },
        forcada: true,
        vagas_pedidas: 2,
        vagas_baixadas: 1,
        vagas_falha: 1,
        linhas: 210,
        execucao: "https://github.com/x/actions/runs/2",
        por_vaga: [
          {
            vaga: "179698",
            situacao: "GRAVADA",
            arquivo: 210,
            ativos: 208,
            com_link: 200,
          },
        ],
      },
      {
        id: "gh-1",
        inicio: "2026-10-06T11:00:00Z",
        situacao: "CONCLUIDA",
        disparo: "GITHUB",
        filtro: { editais: ["93/2026"], vagas: [], limite: 10 },
        vagas_pedidas: 5,
        vagas_baixadas: 5,
        por_vaga: [],
      },
    ],
    pre_classificacao: [
      {
        id: "precl-2",
        inicio: "2026-10-07T10:00:00Z",
        situacao: "CONCLUIDA",
        disparo: "MONITORA",
        quem: "Coordenação",
        pedido: [ID_93],
        refazer: true,
        editais: 1,
        vagas: 5,
        inscritos: 800,
        lote: 40,
      },
      {
        id: "precl-1",
        inicio: "2026-10-07T09:00:00Z",
        situacao: "CONCLUIDA",
        disparo: "ROBO",
        pedido: [],
      },
    ],
  });

  describe("códigos de vaga colados", () => {
    it("separa por vírgula, ponto e vírgula, espaço e linha; sem repetir; o resto é inválido", () => {
      expect(
        separarCodigos("179698, 180231;180232\n179698  17797x\t999"),
      ).toEqual({
        codigos: ["179698", "180231", "180232", "999"],
        invalidos: ["17797x"],
      });
      expect(separarCodigos("")).toEqual({ codigos: [], invalidos: [] });
      expect(separarCodigos(["1", "2 3"]).codigos).toEqual(["1", "2", "3"]);
      expect(separarCodigos("123456789012345678901").invalidos).toHaveLength(1);
    });
  });

  describe("lista branca de cada robô (validarOpcoes)", () => {
    it("Empregare: modo, editais pelo número, vagas só dígitos e limite", () => {
      expect(
        validarOpcoes(EMPREGARE, {
          modo: "forcar",
          editais: ["93/2026", "93/2026", " 81/2026 "],
          vagas: "179698, 180231",
          limite: "5",
        }),
      ).toEqual({
        opcoes: {
          modo: "forcar",
          editais: ["93/2026", "81/2026"],
          vagas: ["179698", "180231"],
          limite: 5,
        },
      });
      expect(validarOpcoes(EMPREGARE, {})).toEqual({
        opcoes: { modo: "normal", editais: [], vagas: [], limite: null },
      });
    });

    it("recusa formato errado, modo de outro robô e opção que o robô não aceita", () => {
      expect(validarOpcoes(EMPREGARE, { vagas: ["17797x"] }).erro).toBe(
        "vaga_invalida",
      );
      expect(validarOpcoes(EMPREGARE, { editais: [ID_93] }).erro).toBe(
        "edital_invalido",
      );
      expect(validarOpcoes(EMPREGARE, { editais: ["93-2026"] }).texto).toMatch(
        /93\/2026/,
      );
      expect(validarOpcoes(EMPREGARE, { modo: "refazer_lote" }).erro).toBe(
        "modo_invalido",
      );
      expect(validarOpcoes(EMPREGARE, { limite: 0 }).erro).toBe(
        "limite_invalido",
      );
      expect(validarOpcoes(EMPREGARE, { limite: 501 }).erro).toBe(
        "limite_invalido",
      );
      expect(validarOpcoes(EMPREGARE, { limite: "1e2" }).erro).toBe(
        "limite_invalido",
      );
      expect(validarOpcoes(EMPREGARE, { ref: "outro-ramo" }).erro).toBe(
        "opcao_nao_aceita",
      );
      expect(validarOpcoes(EMPREGARE, { disparado_por: "x" }).erro).toBe(
        "opcao_nao_aceita",
      );
      expect(validarOpcoes(PRE, { vagas: ["179698"] }).erro).toBe(
        "opcao_nao_aceita",
      );
      expect(validarOpcoes(PRE, { limite: 5 }).erro).toBe("opcao_nao_aceita");
      expect(validarOpcoes(CONFERENCIAS, { editais: ["93/2026"] }).erro).toBe(
        "opcao_nao_aceita",
      );
      expect(validarOpcoes(roboDeCarga("selecao"), { modo: "seco" }).erro).toBe(
        "sem_opcoes",
      );
      expect(validarOpcoes(EMPREGARE, "modo=seco").erro).toBe(
        "opcoes_invalidas",
      );
      expect(validarOpcoes(EMPREGARE, ["seco"]).erro).toBe("opcoes_invalidas");
      const muitas = Array.from({ length: 501 }, (_, i) => String(100000 + i));
      expect(validarOpcoes(EMPREGARE, { vagas: muitas }).erro).toBe(
        "vagas_demais",
      );
      const editais = Array.from({ length: 101 }, (_, i) => `${i + 1}/2026`);
      expect(validarOpcoes(EMPREGARE, { editais }).erro).toBe("editais_demais");
    });

    it("chave vazia de opção que o robô não usa passa (o formulário manda só o que tem)", () => {
      expect(
        validarOpcoes(PRE, { modo: "seco", vagas: [], limite: "" }).opcoes,
      ).toEqual({
        modo: "seco",
        editais: [],
        vagas: [],
        limite: null,
      });
    });

    it("Triagem: editais pelo número ou pelo id (minúsculo); modos do workflow", () => {
      expect(
        validarOpcoes(PRE, {
          modo: "refazer_lote",
          editais: [ID_93.toUpperCase(), "94/2026"],
        }).opcoes,
      ).toMatchObject({ modo: "refazer_lote", editais: [ID_93, "94/2026"] });
      expect(validarOpcoes(PRE, { modo: "forcar" }).erro).toBe("modo_invalido");
      expect(validarOpcoes(PRE, { editais: ["SESMT; drop"] }).erro).toBe(
        "edital_invalido",
      );
    });

    it("os modos são os options de cada workflow", async () => {
      const { readFileSync } = await import("node:fs");
      for (const [id, aceitas] of Object.entries(OPCOES_DOS_ROBOS)) {
        const yml = readFileSync(
          `.github/workflows/${roboDeCarga(id).workflow}`,
          "utf8",
        );
        const bloco = yml.slice(
          yml.indexOf("modo:"),
          yml.indexOf("default:", yml.indexOf("modo:")),
        );
        const opcoes = [...bloco.matchAll(/^\s+- (\w+)$/gm)].map((m) => m[1]);
        expect(
          aceitas.modos.map((m) => m.valor),
          id,
        ).toEqual(opcoes);
        if (aceitas.editais) expect(yml, id).toMatch(/^\s+editais:$/m);
        if (aceitas.vagas) expect(yml, id).toMatch(/^\s+vagas:$/m);
        if (aceitas.limite) expect(yml, id).toMatch(/^\s+limite:$/m);
      }
    });
  });

  describe("o pedido ao banco (disparar_robo)", () => {
    it("p_inputs: as opções conferidas; no Recalcular, só o edital; sem nada, {}", () => {
      expect(inputsDoPedido()).toEqual({});
      expect(
        inputsDoPedido({
          opcoes: {
            modo: "seco",
            editais: ["93/2026", "81/2026"],
            vagas: ["179698"],
            limite: 5,
          },
        }),
      ).toEqual({
        modo: "seco",
        editais: ["93/2026", "81/2026"],
        vagas: ["179698"],
        limite: "5",
      });
      expect(
        inputsDoPedido({
          opcoes: { modo: "seco", editais: [], vagas: [], limite: null },
        }),
      ).toEqual({ modo: "seco" });
      expect(inputsDoPedido({ edital: ID_93 })).toEqual({ editais: [ID_93] });
      expect(inputsDoPedido({ edital: "  " })).toEqual({});
    });

    it("o erro do banco vira frase curta; sem a função, diz a migration", () => {
      expect(
        mensagemDoErroDoDisparo({
          code: "42501",
          message: "Só o administrador global roda as cargas.",
        }),
      ).toBe("Só o administrador global roda as cargas.");
      expect(mensagemDoErroDoDisparo({ code: "PGRST202" })).toContain(
        "20261008140000",
      );
      expect(mensagemDoErroDoDisparo({}, "Padrão.")).toBe("Padrão.");
    });

    it("situação do pedido: PEDIDO espera; ACEITO segue; FALHOU e SEM_TOKEN avisam", () => {
      expect(situacaoDoPedido({ situacao: "PEDIDO" })).toMatchObject({
        terminou: false,
        aceito: false,
        aviso: null,
      });
      expect(situacaoDoPedido({ situacao: "ACEITO", http: 204 })).toMatchObject(
        {
          terminou: true,
          aceito: true,
          http: 204,
          aviso: null,
        },
      );
      expect(situacaoDoPedido({ situacao: "SEM_TOKEN" }).aviso).toEqual({
        tom: "erro",
        texto: MENSAGEM_DA_CHAVE,
      });
      expect(MENSAGEM_DA_CHAVE).toBe(
        "A chave de disparo dos robôs expirou ou foi recusada; um administrador precisa trocá-la no cofre (Vault) com o nome github_disparo_robos.",
      );
    });
  });

  describe("editais da escolha", () => {
    it("normaliza: sem número fica fora; vigente pela regra da Avaliação documental", () => {
      expect(PAINEL.editais.map((e) => [e.id, e.vigente])).toEqual([
        [ID_93, true],
        [ID_80, false],
        [ID_93_SEDE, false],
      ]);
    });

    it("só os vigentes da área; mostrar todos traz os outros; o escolhido fica", () => {
      expect(opcoesDosEditais(PAINEL.editais, PAINEL.areas)).toEqual({
        opcoes: [{ value: ID_93, label: "93/2026 · SESMT (Projetos)" }],
        ocultos: 2,
      });
      expect(
        opcoesDosEditais(PAINEL.editais, PAINEL.areas, { todos: true }).opcoes,
      ).toHaveLength(3);
      expect(
        opcoesDosEditais(PAINEL.editais, PAINEL.areas, {
          area: "saude-indigena",
          escolhidos: [ID_80],
        }),
      ).toEqual({
        opcoes: [
          { value: ID_80, label: "80/2026 · DSEI Yanomami (Saúde Indígena)" },
        ],
        ocultos: 0,
      });
      expect(
        opcoesDosEditais(PAINEL.editais, PAINEL.areas, { area: "sede" }),
      ).toEqual({ opcoes: [], ocultos: 1 });
    });

    it("no pedido: o número para o robô da Empregare (sem repetir), o id para a triagem", () => {
      expect(
        editaisDoPedido("empregare", [ID_93, ID_93_SEDE], PAINEL.editais),
      ).toEqual(["93/2026"]);
      expect(
        editaisDoPedido(
          "pre_classificacao",
          [ID_93, ID_93_SEDE],
          PAINEL.editais,
        ),
      ).toEqual([ID_93, ID_93_SEDE]);
      expect(editaisDoPedido("conferencias", [ID_93], PAINEL.editais)).toEqual(
        [],
      );
      expect(editaisDoPedido("empregare", ["sumiu"], PAINEL.editais)).toEqual(
        [],
      );
    });
  });

  describe("prévia do que vai rodar", () => {
    const VAGAS = normalizarVagas([
      { vaga: "179698", edital_id: ID_93, cargo: "Técnico" },
      { vaga: "180231", edital_id: ID_93, cargo: "Engenheiro" },
      { vaga: "180232", edital_id: ID_93 },
      { vaga: "180233", edital_id: ID_93 },
      { vaga: "180234", edital_id: ID_93 },
      { vaga: "x1", edital_id: ID_93 },
    ]);
    const base = { robo: "empregare", editais: PAINEL.editais, vagas: VAGAS };

    it("vagas conhecidas do edital: '5 vagas do 93/2026: …'", () => {
      expect(VAGAS).toHaveLength(5);
      expect(previaDoDisparo({ ...base, editaisIds: [ID_93] })).toEqual({
        frase: "5 vagas do 93/2026: 179698, 180231, 180232, 180233, 180234",
        codigos: ["179698", "180231", "180232", "180233", "180234"],
        avisos: [],
      });
    });

    it("o limite corta e avisa; forçar avisa; seco diz que só lista", () => {
      const p = previaDoDisparo({
        ...base,
        editaisIds: [ID_93],
        limite: 2,
        modo: "forcar",
      });
      expect(p.frase).toBe(
        "2 de 5 vagas do 93/2026: 179698, 180231, 180232, 180233, 180234",
      );
      expect(p.avisos).toEqual([
        "O limite corta em 2: ficam as nunca carregadas ou carregadas há mais tempo.",
        "Forçar: a trava da metade não vale.",
      ]);
      expect(
        previaDoDisparo({ ...base, codigos: ["179698"], modo: "seco" }).frase,
      ).toBe("Lista, sem baixar, 1 vaga do 93/2026: 179698");
    });

    it("com códigos valem os códigos; avisa só se algum não é dos editais escolhidos", () => {
      expect(
        previaDoDisparo({ ...base, editaisIds: [ID_93], codigos: ["180231"] })
          .avisos,
      ).toEqual([]);
      const fora = previaDoDisparo({
        ...base,
        editaisIds: [ID_93],
        codigos: ["180231", "999999"],
      });
      expect(fora.frase).toBe("2 vagas do 93/2026: 180231, 999999");
      expect(fora.avisos).toEqual([
        "Com códigos de vaga, o robô roda só os códigos.",
      ]);
      const muitos = Array.from({ length: 10 }, (_, i) => String(200000 + i));
      expect(previaDoDisparo({ ...base, codigos: muitos }).frase).toBe(
        "10 vagas: 200000, 200001, 200002, 200003, 200004, 200005, 200006, 200007…",
      );
    });

    it("sem filtro, os editais em curso até o limite; edital sem vaga conhecida avisa; fumaça só testa o login", () => {
      expect(previaDoDisparo({ ...base }).frase).toBe(
        "As vagas dos editais em curso, até 60 (as nunca carregadas primeiro).",
      );
      expect(previaDoDisparo({ ...base, editaisIds: [ID_80] })).toMatchObject({
        frase: "Nenhuma vaga da Empregare conhecida do 80/2026.",
        codigos: [],
      });
      expect(
        previaDoDisparo({ ...base, editaisIds: [ID_93], modo: "fumaca" }).frase,
      ).toBe("Só o teste de login na Empregare.");
    });

    it("triagem e conferências", () => {
      const p = { editais: PAINEL.editais };
      expect(
        previaDoDisparo({
          ...p,
          robo: "pre_classificacao",
          editaisIds: [ID_93],
        }).frase,
      ).toBe("Faz a triagem de 1 edital: 93/2026.");
      expect(
        previaDoDisparo({ ...p, robo: "pre_classificacao", modo: "seco" })
          .frase,
      ).toBe("Calcula sem gravar os editais ativos com vagas da Empregare.");
      expect(
        previaDoDisparo({
          ...p,
          robo: "pre_classificacao",
          modo: "refazer_lote",
          editaisIds: [ID_93],
        }).frase,
      ).toBe("Refaz o lote de 1 edital: 93/2026.");
      expect(
        previaDoDisparo({ robo: "conferencias", modo: "seco" }).frase,
      ).toBe("Todas as conferências, sem gravar avisos.");
    });
  });

  describe("histórico dos robôs", () => {
    it("robô: parâmetros, quem pediu, resultado e vaga pedida sem arquivo", () => {
      const [ultima, anterior] = PAINEL.execucoes.empregare;
      expect(ultima).toMatchObject({
        quem: "Pessoa Admin",
        situacao: "PARCIAL",
        parametros: { texto: "2 vagas: 179698, 180231 · limite 2 · forçar" },
        resultado: "1 de 2 vagas baixadas · 1 falha · 210 candidatos",
        execucao: "https://github.com/x/actions/runs/2",
      });
      expect(
        ultima.porVaga.map((v) => [v.vaga, v.situacao, v.comLink]),
      ).toEqual([
        ["179698", "GRAVADA", 200],
        ["180231", "SEM_ARQUIVO", null],
      ]);
      expect(anterior).toMatchObject({
        quem: "GitHub",
        parametros: { texto: "Edital 93/2026 · limite 10" },
      });
    });

    it("triagem: o id pedido vira o número; disparo do robô diz de onde vieram os editais", () => {
      const [monitora, robo] = PAINEL.execucoes.pre_classificacao;
      expect(monitora.parametros.texto).toBe("Edital 93/2026 · refazer lote");
      expect(monitora.resultado).toBe(
        "1 edital · 5 vagas · 800 inscritos · lote 40",
      );
      expect(robo.quem).toBe("Depois do robô");
      expect(robo.parametros.texto).toBe("Editais da última carga do robô");
    });

    it("aguenta payload vazio ou de outra RPC", () => {
      expect(normalizarPainel(null)).toMatchObject({
        areas: [],
        editais: [],
        execucoes: { empregare: [], pre_classificacao: [] },
      });
      expect(normalizarPainel({ empregare: "x" }).execucoes.empregare).toEqual(
        [],
      );
    });
  });

  describe("acompanhamento do pedido", () => {
    const em = new Date("2026-10-07T12:00:00Z");
    const execucoes = (situacao, inicio = "2026-10-07T12:01:00Z") =>
      normalizarPainel({
        empregare: [
          { id: "n", inicio, situacao, disparo: "MONITORA", filtro: {} },
        ],
      }).execucoes.empregare;
    const pedido = (situacao, extra = {}) => ({
      em,
      disparo: situacaoDoPedido({ situacao, ...extra }),
    });

    it("aguardando → aceito pelo GitHub → rodando → terminou", () => {
      expect(
        acompanhamentoDoPedido({ robo: "empregare", pedido: null }),
      ).toBeNull();
      expect(
        acompanhamentoDoPedido({ robo: "empregare", pedido: pedido("PEDIDO") })
          .etapa,
      ).toBe("aguardando");
      // A execução de antes do pedido não conta.
      expect(
        acompanhamentoDoPedido({
          robo: "empregare",
          pedido: pedido("PEDIDO"),
          execucoes: execucoes("CONCLUIDA", "2026-10-07T10:00:00Z"),
        }).etapa,
      ).toBe("aguardando");
      expect(
        acompanhamentoDoPedido({
          robo: "empregare",
          pedido: pedido("ACEITO", { http: 204 }),
        }),
      ).toEqual({
        etapa: "github",
        execucao: null,
        url: null,
        semRegistro: false,
      });
      const rodando = acompanhamentoDoPedido({
        robo: "empregare",
        pedido: pedido("ACEITO"),
        execucoes: execucoes("EM_ANDAMENTO"),
      });
      expect(rodando.etapa).toBe("rodando");
      expect(
        acompanhamentoDoPedido({
          robo: "empregare",
          pedido: pedido("ACEITO"),
          execucoes: execucoes("PARCIAL"),
        }).etapa,
      ).toBe("terminou");
    });

    it("modo seco: aceito pelo GitHub e sem registro no banco", () => {
      expect(
        acompanhamentoDoPedido({
          robo: "empregare",
          pedido: { ...pedido("ACEITO"), modo: "seco" },
        }),
      ).toMatchObject({ etapa: "github", semRegistro: true });
    });

    it("chave ausente, vencida ou sem permissão: recusado, com a frase do cofre", () => {
      for (const disparo of [
        { situacao: "SEM_TOKEN" },
        {
          situacao: "FALHOU",
          http: 401,
          mensagem: "GitHub 401: Bad credentials",
        },
        { situacao: "FALHOU", http: 403 },
        { situacao: "FALHOU", http: 404 },
      ])
        expect(
          acompanhamentoDoPedido({
            robo: "empregare",
            pedido: pedido(disparo.situacao, disparo),
          }),
        ).toMatchObject({ etapa: "recusado", texto: MENSAGEM_DA_CHAVE });
      expect(
        acompanhamentoDoPedido({
          robo: "empregare",
          pedido: pedido("FALHOU", {
            http: 422,
            mensagem: "GitHub 422: Unexpected inputs provided",
          }),
        }).texto,
      ).toBe(
        "O GitHub não aceitou o pedido (GitHub 422: Unexpected inputs provided). Tente de novo em instantes.",
      );
    });
  });

  describe("robô da Empregare: modo Sondar e Guardar links dos anexos", () => {
    it("sondar pede um único código de vaga, sem editais, e limite de 1 a 3", () => {
      expect(
        validarOpcoes(EMPREGARE, {
          modo: "sondar",
          vagas: "179698",
          limite: "2",
        }),
      ).toEqual({
        opcoes: { modo: "sondar", editais: [], vagas: ["179698"], limite: 2 },
      });
      for (const bruto of [
        { modo: "sondar" },
        { modo: "sondar", vagas: "179698 180231" },
        { modo: "sondar", vagas: "179698", editais: ["93/2026"] },
      ])
        expect(validarOpcoes(EMPREGARE, bruto).erro).toBe("sondar_uma_vaga");
      expect(
        validarOpcoes(EMPREGARE, {
          modo: "sondar",
          vagas: "179698",
          limite: "4",
        }),
      ).toMatchObject({ erro: "limite_invalido" });
    });

    it("anexos só no robô da Empregare e nos modos Normal e Forçar; vai ao banco como booleano", () => {
      expect(OPCOES_DOS_ROBOS.empregare.anexos).toBe(true);
      const conferido = validarOpcoes(EMPREGARE, {
        modo: "forcar",
        anexos: true,
      });
      expect(conferido.opcoes).toEqual({
        modo: "forcar",
        editais: [],
        vagas: [],
        limite: null,
        anexos: true,
      });
      expect(inputsDoPedido({ opcoes: conferido.opcoes })).toEqual({
        modo: "forcar",
        anexos: true,
      });
      expect(
        validarOpcoes(EMPREGARE, { modo: "seco", anexos: true }).erro,
      ).toBe("anexos_no_modo");
      expect(
        validarOpcoes(EMPREGARE, { modo: "normal", anexos: false }).opcoes,
      ).toEqual({ modo: "normal", editais: [], vagas: [], limite: null });
      expect(validarOpcoes(CONFERENCIAS, { anexos: true }).erro).toBe(
        "opcao_nao_aceita",
      );
      expect(
        validarOpcoes(CONFERENCIAS, { anexos: false }).erro,
      ).toBeUndefined();
    });
  });
});

bloco("painel-externo-shell", () => {
  /*
  Este ficheiro cobria também o botão de recolher, que no #176 só existia dentro
  do painel externo. O botão passou a ser o controle único do sistema inteiro, e
  a cobertura dele mudou de casa: `tests/casca-com-modulo-simulado-na-tela.test.ts` (bloco `componentes/barra-lateral`). Aqui ficam
  as barras de rolagem, que continuam sendo um problema só do painel externo.
*/
  const css = readFileSync("src/styles/platform-shell.css", "utf8");

  /*
  Os comentários deste CSS explicam o defeito citando `padding`, `!important` e
  `#conteudoPrincipal`. Verificar o texto cru acusaria a própria explicação; o
  que vale são as declarações.
*/
  const regras = css.replace(/\/\*[\s\S]*?\*\//g, "");

  /*
  Recorta a regra que declara o seletor pedido. Procurar a primeira ocorrência do
  texto não serve: `body.external-panel-mode .main` aparece antes, na regra que
  esconde o cabeçalho.
*/
  const bloco = (seletor, declaracao) =>
    regras
      .split("}")
      .map((parte) => parte + "}")
      .find(
        (r) => r.includes(seletor) && (!declaracao || r.includes(declaracao)),
      ) || "";

  /*
  Duas barras de rolagem no painel externo.

  Medido no preview em 10/09/2026, com o painel de Análises embarcado:

    1440x900   scrollHeight 934 contra clientHeight 900   -> 34px a mais
     800x900   scrollHeight 948 contra clientHeight 900   -> 48px a mais

  O quadro é travado em `min-height: 100dvh` — uma tela inteira — e cada caixa da
  cadeia soma o seu espaçamento por cima. Não era um espaçamento, eram três:
  `.table-card` 14, `.content` 34, `.main` 20.
*/
  describe("o painel externo não pode ter duas barras de rolagem", () => {
    it("zera a cadeia inteira, não só uma caixa", () => {
      const alvo = bloco("body.external-panel-mode .main", "padding");
      for (const parte of [
        "body.external-panel-mode .main",
        "body.external-panel-mode #conteudoPrincipal",
        "body.external-panel-mode #page-external .table-card",
      ]) {
        expect(alvo, `${parte} ficou fora da regra`).toContain(parte);
      }
      expect(alvo).toContain("padding: 0 !important");
      expect(
        bloco("body.external-panel-mode .content", "padding-bottom"),
      ).toContain("padding-bottom: 0 !important");
    });

    /*
    Sem `!important` a correção valia só no largo: `mobile-app.css` declara os
    mesmos espaçamentos com `!important`, que vence especificidade. E sem o id a
    regra concorrente ainda ganhava no `.main`, porque alcança o elemento por
    `#conteudoPrincipal` — um id vence qualquer número de classes.
  */
    it("alcança as declarações concorrentes, que são !important e por id", () => {
      const alvo = bloco("body.external-panel-mode .main", "padding");
      expect(alvo).toContain("#conteudoPrincipal");
      expect(alvo).toMatch(/!important/);
    });

    it("trava o transbordo para o caso de alguém acrescentar espaçamento amanhã", () => {
      expect(bloco("body.external-panel-mode .app")).toContain(
        "overflow: hidden",
      );
    });

    /*
    O escopo é o que garante que nada mudou fora do painel externo: toda regra
    nova nasce de `body.external-panel-mode`.
  */
    it("nenhuma regra nova escapa do modo painel externo", () => {
      const novas = [
        "body.external-panel-mode .main",
        "body.external-panel-mode .content",
        "body.external-panel-mode .app",
      ];
      for (const seletor of novas) {
        expect(regras, `${seletor} ausente`).toContain(seletor);
      }
    });
  });
});

bloco("planilhas", () => {
  const RAIZ = process.cwd();
  const CATALOGO = join("src", "lib", "base", "planilhas.ts");

  function arquivosDeCodigo(pasta) {
    const saida = [];
    for (const nome of readdirSync(pasta)) {
      const caminho = join(pasta, nome);
      if (statSync(caminho).isDirectory())
        saida.push(...arquivosDeCodigo(caminho));
      else if (/\.(js|mjs|html)$/.test(nome)) saida.push(caminho);
    }
    return saida;
  }

  describe("catálogo de planilhas", () => {
    it("monta o link de edição do Google Sheets a partir do id", () => {
      expect(urlDaPlanilhaGoogle("1AbC_def-GHIjkl")).toBe(
        "https://docs.google.com/spreadsheets/d/1AbC_def-GHIjkl/edit",
      );
      expect(urlDeExportacaoXlsx(" 1AbC_def-GHIjkl ")).toBe(
        "https://docs.google.com/spreadsheets/d/1AbC_def-GHIjkl/export?format=xlsx",
      );
    });

    it("não monta link com id vazio, curto ou com caracteres de URL", () => {
      for (const id of [
        null,
        undefined,
        "",
        "   ",
        "abc",
        "1Abc/../../x",
        "1AbcDefGhij?x=1",
        "javascript:alert(1)",
      ]) {
        expect(urlDaPlanilhaGoogle(id)).toBe("");
        expect(urlDeExportacaoXlsx(id)).toBe("");
      }
    });

    it("o modelo de importação aponta para um arquivo que existe no build", () => {
      const modelo = PLANILHAS.modeloListaAprovados;
      // Tudo em public/ é servido na raiz do site.
      expect(join("public", modelo.url)).toBe(
        join(modelo.arquivoNoRepositorio),
      );
      expect(existsSync(join(RAIZ, modelo.arquivoNoRepositorio))).toBe(true);
      expect(modelo.url.endsWith(`/${modelo.nomeDoArquivo}`)).toBe(true);
    });

    it("nenhum código fora do catálogo escreve link, caminho ou bucket de planilha", () => {
      const proibidos = [
        "docs.google.com/spreadsheets",
        PLANILHAS.modeloListaAprovados.nomeDoArquivo,
        `"${PLANILHAS.listaAprovadosImportada.bucket}"`,
      ];
      const arquivos = [
        ...["src", "api", "scripts"].flatMap((pasta) =>
          arquivosDeCodigo(join(RAIZ, pasta)),
        ),
        join(RAIZ, "index.html"),
      ].filter((caminho) => relative(RAIZ, caminho) !== CATALOGO);

      const violacoes = arquivos.flatMap((caminho) => {
        const texto = readFileSync(caminho, "utf8");
        return proibidos
          .filter((trecho) => texto.includes(trecho))
          .map((trecho) => `${relative(RAIZ, caminho)} contém ${trecho}`);
      });

      expect(violacoes).toEqual([]);
    });
  });
});

bloco("responsavel-do-edital", () => {
  const catalogo = [
    {
      nome_oficial: "DSEI Yanomami",
      id_unidade: "1",
      sigla: "YAN",
      tipo: "DSEI",
      uf_sede: "RR",
    },
    {
      nome_oficial: "CASAI Brasília",
      id_unidade: "2",
      sigla: "CSB",
      tipo: "CASAI",
      uf_sede: "DF",
    },
  ];

  describe("normalizarResponsavel", () => {
    it("aceita as duas opções do select, em qualquer caixa", () => {
      expect(normalizarResponsavel("USI")).toBe("USI");
      expect(normalizarResponsavel("cores")).toBe("CORES");
      expect(normalizarResponsavel("  Usi  ")).toBe("USI");
    });

    /*
    Antes de virar seleção, o campo era texto livre e guardava nomes de
    pessoas. Devolver "" faz o select abrir vazio em vez de inventar uma
    opção — o nome antigo continua gravado até alguém salvar aquele edital.
  */
    it("descarta o que não é USI nem CORES", () => {
      expect(normalizarResponsavel("Maria Silva")).toBe("");
      expect(normalizarResponsavel("")).toBe("");
      expect(normalizarResponsavel(null)).toBe("");
      expect(normalizarResponsavel(undefined)).toBe("");
    });
  });

  describe("ehResponsavelCores", () => {
    it("só é verdadeiro para CORES", () => {
      expect(ehResponsavelCores("CORES")).toBe(true);
      expect(ehResponsavelCores("cores")).toBe(true);
      expect(ehResponsavelCores("USI")).toBe(false);
      expect(ehResponsavelCores("")).toBe(false);
      expect(ehResponsavelCores("Maria Silva")).toBe(false);
    });
  });

  describe("unidadesDoResponsavel", () => {
    it("USI continua com o catálogo de TD_UNIDADE", () => {
      expect(unidadesDoResponsavel("USI", catalogo)).toBe(catalogo);
    });

    it("sem responsável escolhido, mantém o catálogo de sempre", () => {
      expect(unidadesDoResponsavel("", catalogo)).toBe(catalogo);
    });

    it("CORES tem as sete unidades próprias, ignorando o catálogo", () => {
      const unidades = unidadesDoResponsavel("CORES", catalogo);
      expect(unidades.map((u) => u.nome_oficial)).toEqual([...UNIDADES_CORES]);
    });

    /*
    Estas unidades não estão em TD_UNIDADE e não pertencem a um estado, então
    o edital do CORES grava só o nome. Se algum dia vierem preenchidas, o
    formulário passaria a gravar vínculos que não existem no catálogo.
  */
    it("CORES não traz id, sigla, tipo nem UF", () => {
      unidadesDoResponsavel("CORES", catalogo).forEach((unidade) => {
        expect(unidade.id_unidade).toBe("");
        expect(unidade.sigla).toBe("");
        expect(unidade.tipo).toBe("");
        expect(unidade.uf_sede).toBe("");
      });
    });

    it("aguenta um catálogo ausente", () => {
      expect(unidadesDoResponsavel("USI", null)).toEqual([]);
      expect(unidadesDoResponsavel("CORES", null)).toHaveLength(
        UNIDADES_CORES.length,
      );
    });
  });

  describe("o painel da Saúde Indígena só mostra editais da USI", () => {
    it("DSEI e CASAI entram", () => {
      expect(
        ehEditalDaSaudeIndigena({
          responsavel: "USI",
          unidade: "DSEI Yanomami",
        }),
      ).toBe(true);
      expect(
        ehEditalDaSaudeIndigena({ responsavel: "", unidade: "CASAI Brasília" }),
      ).toBe(true);
    });

    it("edital do CORES fica fora", () => {
      expect(
        ehEditalDaSaudeIndigena({
          responsavel: "CORES",
          unidade: "DSEI Xavante",
        }),
      ).toBe(false);
    });

    it("unidade do CORES fica fora mesmo marcada como USI pela migração antiga", () => {
      for (const unidade of [
        "SEDE",
        "MFC",
        "Escritório Distrital e Regional",
        "escritorio distrital e regional",
        " Saúde nas Fronteiras ",
      ]) {
        expect(ehEditalDaSaudeIndigena({ responsavel: "USI", unidade })).toBe(
          false,
        );
      }
    });
    it("a área do banco (CO_AREA) manda quando vem na linha", () => {
      expect(
        ehEditalDaSaudeIndigena({
          CO_AREA: "saude-indigena",
          responsavel: "CORES",
          unidade: "SEDE",
        }),
      ).toBe(true);
      expect(
        ehEditalDaSaudeIndigena({
          CO_AREA: "projetos",
          responsavel: "USI",
          unidade: "DSEI Yanomami",
        }),
      ).toBe(false);
      expect(
        ehEditalDaSaudeIndigena({ CO_AREA: "sede", unidade: "CASAI Brasília" }),
      ).toBe(false);
    });
  });
});

bloco("retificacao-do-cronograma", () => {
  /*
  Retificação do cronograma: o "Leia-se" lido do PDF (pela função Python)
  comparado com o cronograma gravado, os ajustes de quem confere e o que vai
  para salvar_monitoramento_com_cronograma_v2. Nomes no formato da Saúde
  Indígena: o gravado nem sempre é igual ao do PDF.
*/

  const etapa = (atividade, inicio, fim = inicio, origem = "PDF") =>
    novaEtapa({ atividade, data_inicio: inicio, data_fim: fim, origem });

  const ATUAIS = [
    etapa("Publicação do Edital", "2026-09-08"),
    etapa("Impugnação do Edital", "2026-09-09", "2026-09-11"),
    etapa("Convocação para Entrevista", "2026-10-09", "2026-10-09", "MANUAL"),
    etapa("Período de Entrevistas", "2026-10-13", "2026-11-17"),
    etapa(
      "Prazo de recurso do resultado preliminar documental",
      "2026-10-01",
      "2026-10-02",
    ),
    etapa("Etapa extinta", "2026-11-20"),
    etapa("Resultado final do Processo Seletivo", "2026-11-27"),
  ];

  const pdf = (atividade, inicio, fim = inicio, extra = {}) => ({
    atividade,
    data_inicio: inicio,
    data_fim: fim,
    texto_datas: "",
    negrito: false,
    avisos: [],
    ...extra,
  });

  const LEIA = [
    pdf("Publicação do Edital", "2026-09-08"),
    pdf("Impugnação do Edital", "2026-09-09", "2026-09-11"),
    pdf("Publicação da Lista Geral de Classificação Provisória", "2026-09-22"),
    pdf(
      "Prazo de recurso referente ao resultado preliminar da Avaliação Documental e de Títulos",
      "2026-10-01",
      "2026-10-02",
    ),
    pdf("Convocação para a Entrevista", "2026-10-09"),
    pdf("Período de Entrevistas", "2026-10-13", "2026-11-18", {
      negrito: true,
    }),
    pdf("Resultado final do Processo Seletivo", "2026-12-03", "2026-12-03", {
      negrito: true,
      avisos: ['"03/12" conferir'],
    }),
  ];

  const LIDA = {
    tipo: "retificacao",
    numero: 2,
    rotulo: "2ª Retificação do Cronograma",
    edital: "105/2026",
    sei: "0868574",
    assinada_em: "2026-10-28",
    leia_se: LEIA,
    avisos: [],
  };

  describe("casamento das etapas", () => {
    it("nomes diferentes da mesma etapa casam; etapas diferentes não", () => {
      expect(
        semelhancaDeAtividade(
          "Convocação para Entrevista",
          "Convocação para a Entrevista",
        ),
      ).toBe(1);
      expect(
        semelhancaDeAtividade(
          "Resultado final da Entrevista",
          "Resultado final do Processo Seletivo",
        ),
      ).toBeLessThan(0.5);
      expect(casarEtapas(ATUAIS, LEIA)).toEqual([0, 1, null, 4, 2, 3, 6]);
    });

    it("nome repetido casa pela posição", () => {
      const atuais = [
        etapa("Resultado", "2026-01-01"),
        etapa("Resultado", "2026-02-01"),
      ];
      const lidas = [
        pdf("Resultado", "2026-01-05"),
        pdf("Resultado", "2026-02-05"),
      ];
      expect(casarEtapas(atuais, lidas)).toEqual([0, 1]);
    });
  });

  describe("comparação etapa a etapa", () => {
    it("igual, data muda, etapa nova e etapa que sumiu, na ordem do Leia-se", () => {
      const linhas = compararRetificacao(ATUAIS, LEIA);
      expect(
        linhas.map((l) => [l.situacao, l.atual?.atividade || l.pdf.atividade]),
      ).toEqual([
        ["igual", "Publicação do Edital"],
        ["igual", "Impugnação do Edital"],
        ["nova", "Publicação da Lista Geral de Classificação Provisória"],
        ["igual", "Prazo de recurso do resultado preliminar documental"],
        ["igual", "Convocação para Entrevista"],
        ["muda", "Período de Entrevistas"],
        ["sumiu", "Etapa extinta"],
        ["muda", "Resultado final do Processo Seletivo"],
      ]);
      expect(linhas.find((l) => l.situacao === "sumiu").incluir).toBe(false);
      expect(linhas.at(-1).avisos).toEqual(['"03/12" conferir']);
      expect(resumoDaComparacao(linhas)).toEqual({
        iguais: 4,
        mudam: 2,
        novas: 1,
        somem: 1,
      });
    });

    it("o cronograma novo guarda o nome gravado e marca ERRATA no que muda", () => {
      const novas = etapasRetificadas(compararRetificacao(ATUAIS, LEIA));
      expect(
        novas.map((e) => [
          e.ordem,
          e.atividade,
          e.data_inicio,
          e.data_fim,
          e.origem,
        ]),
      ).toEqual([
        [1, "Publicação do Edital", "2026-09-08", "2026-09-08", "PDF"],
        [2, "Impugnação do Edital", "2026-09-09", "2026-09-11", "PDF"],
        [
          3,
          "Publicação da Lista Geral de Classificação Provisória",
          "2026-09-22",
          "2026-09-22",
          "ERRATA",
        ],
        [
          4,
          "Prazo de recurso do resultado preliminar documental",
          "2026-10-01",
          "2026-10-02",
          "PDF",
        ],
        [5, "Convocação para Entrevista", "2026-10-09", "2026-10-09", "MANUAL"],
        [6, "Período de Entrevistas", "2026-10-13", "2026-11-18", "ERRATA"],
        [
          7,
          "Resultado final do Processo Seletivo",
          "2026-12-03",
          "2026-12-03",
          "ERRATA",
        ],
      ]);
    });

    it("ajustes: datas à mão, par escolhido, etapa nova de fora e etapa que sumiu mantida", () => {
      const linhas = compararRetificacao(ATUAIS, LEIA, {
        datas: { 5: { fim: "2026-11-19" } },
        pares: { 2: 5 },
        manter: [],
        ignorar: [],
      });
      const lista = linhas.find((l) => l.indicePdf === 2);
      expect(lista.situacao).toBe("muda");
      expect(lista.atual.atividade).toBe("Etapa extinta");
      expect(linhas.find((l) => l.indicePdf === 5).fim).toBe("2026-11-19");
      expect(linhas.some((l) => l.situacao === "sumiu")).toBe(false);

      const outras = compararRetificacao(ATUAIS, LEIA, {
        ignorar: [2],
        manter: [5],
      });
      const novas = etapasRetificadas(outras).map((e) => e.atividade);
      expect(novas).not.toContain(
        "Publicação da Lista Geral de Classificação Provisória",
      );
      expect(novas).toContain("Etapa extinta");
      expect(resumoDaComparacao(outras)).toMatchObject({ novas: 0, somem: 0 });
    });

    it("etapa sem data ou com fim antes do início impede aplicar", () => {
      const linhas = compararRetificacao(
        [],
        [
          pdf("Resultado final", "", ""),
          pdf("Recurso", "2026-10-10", "2026-10-01"),
        ],
      );
      expect(problemasDaComparacao(linhas)).toEqual([
        "Resultado final: preencha início e fim.",
        "Recurso: o fim é anterior ao início.",
      ]);
      expect(
        problemasDaComparacao(
          compararRetificacao([], [pdf("A", "2026-01-01")], { ignorar: [0] }),
        ),
      ).toEqual(["A retificação deixaria o cronograma vazio."]);
    });
  });

  describe("conferência e registro", () => {
    it("PDF de outro edital bloqueia; mesmo número com zeros passa", () => {
      expect(bloqueioDaRetificacao("Edital 105/2026", LIDA)).toBe("");
      expect(bloqueioDaRetificacao("0105/2026", LIDA)).toBe("");
      expect(bloqueioDaRetificacao("118/2026", LIDA)).toBe(
        "O PDF é do edital 105/2026, e este é o 118/2026. Escolha a retificação deste edital.",
      );
      expect(
        bloqueioDaRetificacao("105/2026", { ...LIDA, edital: "" }),
      ).toMatch(/número do edital no PDF/);
      expect(
        bloqueioDaRetificacao("105/2026", { ...LIDA, leia_se: [] }),
      ).toMatch(/Leia-se/);
      expect(bloqueioDaRetificacao("", LIDA)).toMatch(/sem número/);
    });

    it("errata com o nome da retificação e motivo citando o SEI", () => {
      expect(numeroDaErrata(LIDA)).toBe("2ª Retificação do Cronograma");
      expect(numeroDaErrata({ numero: 3 })).toBe(
        "3ª Retificação do Cronograma",
      );
      const resumo = resumoDaComparacao(compararRetificacao(ATUAIS, LEIA));
      expect(motivoDaRetificacao(LIDA, resumo)).toBe(
        "Lançada pela 2ª Retificação do Cronograma (SEI 0868574, assinada em 28/10/2026): 2 etapa(s) com data nova, 1 incluída(s), 1 retirada(s).",
      );
    });

    it("lê pela função Python com o token e devolve o nome do arquivo", async () => {
      const buscar = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => LIDA,
      }));
      const arquivo = new File(["%PDF-1.4"], "retificacao.pdf", {
        type: "application/pdf",
      });
      const lida = await lerRetificacaoNoServidor(arquivo, {
        token: "t",
        buscar,
      });
      expect(buscar).toHaveBeenCalledWith(
        "/api/anexos-do-edital?tipo=retificacao",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ Authorization: "Bearer t" }),
        }),
      );
      expect(lida.arquivo).toBe("retificacao.pdf");
      await expect(
        lerRetificacaoNoServidor(
          new File(["x"], "a.txt", { type: "text/plain" }),
          { buscar },
        ),
      ).rejects.toThrow("não é PDF");
      const falha = vi.fn(async () => ({
        ok: false,
        status: 422,
        json: async () => ({ erro: "Não consegui ler este PDF." }),
      }));
      await expect(
        lerRetificacaoNoServidor(arquivo, { buscar: falha }),
      ).rejects.toThrow("Não consegui ler este PDF.");
    });
  });
});

bloco("saude-das-cargas-fronteiras", () => {
  describe("fronteiras do Status das atualizações", () => {
    it("mantém o acompanhamento quando o histórico ainda não existe", () => {
      expect(
        acompanhamentoDoPedido({
          robo: "empregare",
          pedido: { em: new Date("2026-10-07T12:00:00Z"), modo: "normal" },
          execucoes: null,
        }),
      ).toMatchObject({ etapa: "aguardando", execucao: null, url: null });
    });
    it.each([null, [], "inválido"])(
      "normaliza respostas fora do formato: %s",
      (entrada) => {
        expect(normalizarPainel(entrada)).toMatchObject({
          geradoEm: null,
          areas: [],
          editais: [],
          execucoes: { empregare: [], pre_classificacao: [] },
        });
        expect(normalizarVagas(entrada)).toEqual([]);
        expect(
          visaoSimples(normalizarSaude(entrada)).linhas.every(
            (l) => l.situacao === "nunca",
          ),
        ).toBe(true);
      },
    );
    it("descarta execuções inválidas e não usa nomes herdados do objeto", () => {
      const saude = normalizarSaude(
        {
          analises: [
            null,
            [],
            {
              area: "constructor",
              origem: "origem",
              tipo: "INCREMENTAL",
              execucoes: [
                null,
                "erro",
                {
                  inicio: {},
                  fim: "2026-10-07T12:00:00Z",
                  situacao: "processado",
                  linhas: Infinity,
                  mensagem: {},
                },
              ],
            },
          ],
          empregare: [null, []],
          tarefas: [null, { nome: "constructor", agenda: {}, execucoes: [] }],
        },
        new Date("2026-10-07T12:30:00Z"),
      );
      expect(saude.grupos[0].cargas).toHaveLength(1);
      expect(saude.grupos[0].cargas[0].nome).toBe("constructor · incremental");
      expect(saude.grupos[0].cargas[0].historico).toHaveLength(1);
      expect(saude.grupos[0].cargas[0].historico[0]).toMatchObject({
        inicio: null,
        linhas: null,
        mensagem: null,
      });
      expect(saude.grupos[2].cargas[0].historico).toEqual([]);
      expect(saude.grupos.find((g) => g.id === "tarefas").cargas[0].nome).toBe(
        "constructor",
      );
    });
    it("normaliza campos desconhecidos do histórico e permite somente links HTTP ou HTTPS", () => {
      const painel = normalizarPainel({
        empregare: [
          null,
          {
            id: "e1",
            disparo: "constructor",
            execucao: "javascript:alert(1)",
            filtro: [],
            vagas_pedidas: Infinity,
            por_vaga: [null, { vaga: "123", ativos: {}, arquivo: "10" }],
          },
        ],
      });
      expect(painel.execucoes.empregare).toHaveLength(1);
      expect(painel.execucoes.empregare[0]).toMatchObject({
        quem: "—",
        execucao: null,
        porVaga: [{ vaga: "123", ativos: null, arquivo: 10 }],
      });
      expect(
        situacaoDoPedido({ situacao: {}, http: Infinity, mensagem: {} }),
      ).toMatchObject({
        situacao: "PEDIDO",
        http: null,
        mensagem: "",
        terminou: false,
        aviso: null,
      });
    });
    it("mantém opções e os dois agendamentos do pedido simulado pelo banco", async () => {
      const rpc = vi.fn(async () => ({ data: 41, error: null }));
      const agendar = vi.fn();
      const agora = () => new Date("2026-10-07T12:00:00Z");
      const estado = criarEstadoDaSaude({ supabase: { rpc }, agendar, agora });
      const opcoes = { modo: "seco", editais: [], vagas: ["123"], limite: 1 };
      expect(
        await estado.rodarComOpcoes("empregare", opcoes, "Uma vaga."),
      ).toBe(true);
      expect(rpc).toHaveBeenCalledWith("disparar_robo", {
        p_robo: "empregare",
        p_inputs: { modo: "seco", vagas: ["123"], limite: "1" },
      });
      expect(agendar).toHaveBeenCalledWith(expect.any(Function), 3000);
      expect(agendar).toHaveBeenCalledWith(expect.any(Function), 60000);
      expect(estado.obter().acompanhamentos.empregare).toMatchObject({
        id: 41,
        em: agora(),
        modo: "seco",
        frase: "Uma vaga.",
        disparo: { situacao: "PEDIDO", terminou: false },
      });
    });
    it("a releitura do acompanhamento só sai na tela; fora dela, fica para a volta", async () => {
      const rpc = vi.fn(async (nome) =>
        nome === "disparar_robo"
          ? { data: 7, error: null }
          : { data: null, error: null },
      );
      const agendados = [];
      let voltar = () => {};
      let naTela = true;
      const estado = criarEstadoDaSaude({
        supabase: { rpc },
        agendar: (fn, ms) => agendados.push({ fn, ms }),
        naTela: () => naTela,
        aoVoltar: (fn) => (voltar = fn),
      });
      expect(await estado.rodarAgora("empregare")).toBe(true);
      const releitura = agendados.find(({ ms }) => ms === 60000);
      const leituras = () =>
        rpc.mock.calls.filter(([nome]) => nome === "get_saude_das_cargas")
          .length;
      naTela = false;
      releitura.fn();
      await Promise.resolve();
      expect(leituras()).toBe(0);
      naTela = true;
      voltar();
      await Promise.resolve();
      expect(leituras()).toBe(1);
      // Voltar de novo sem releitura pendente não relê.
      voltar();
      await Promise.resolve();
      expect(leituras()).toBe(1);
    });
    it("marca das conferências: muda só com a última conferência", () => {
      const comConferencia = (inicio, fim) =>
        normalizarSaude(
          {
            conferencias: [{ inicio, fim, situacao: "CONCLUIDA" }],
          },
          new Date("2026-10-14T12:00:00Z"),
        );
      const a = marcaDasConferencias(
        comConferencia("2026-10-14T09:00:00Z", "2026-10-14T09:05:00Z"),
      );
      expect(a).toBe("2026-10-14T09:00:00.000Z|2026-10-14T09:05:00.000Z");
      expect(
        marcaDasConferencias(
          comConferencia("2026-10-14T09:00:00Z", "2026-10-14T09:05:00Z"),
        ),
      ).toBe(a);
      expect(
        marcaDasConferencias(comConferencia("2026-10-14T11:00:00Z", null)),
      ).not.toBe(a);
      expect(marcaDasConferencias(null)).toBe("");
      expect(marcaDasConferencias(normalizarSaude({}))).toBe("");
    });
    it.each([null, {}, [], "inválido", 0, Infinity, 1.5])(
      "recusa identificador inválido do disparo: %s",
      async (data) => {
        const agendar = vi.fn();
        const estado = criarEstadoDaSaude({
          supabase: { rpc: async () => ({ data, error: null }) },
          agendar,
        });
        expect(await estado.rodarAgora("empregare")).toBe(false);
        expect(estado.obter().acompanhamentos).toEqual({});
        expect(estado.obter().pedidos.empregare).toBeNull();
        expect(agendar).not.toHaveBeenCalled();
      },
    );
    it("preserva identificadores bigint recebidos como texto", async () => {
      const id = "9007199254740993";
      const estado = criarEstadoDaSaude({
        supabase: { rpc: async () => ({ data: id, error: null }) },
        agendar: vi.fn(),
      });
      expect(await estado.rodarAgora("empregare")).toBe(true);
      expect(estado.obter().acompanhamentos.empregare.id).toBe(id);
    });
    it("descarta pedidos inválidos na agenda e rótulos herdados de workflow", () => {
      const saude = normalizarSaude({
        agenda_dos_robos: {
          chave_cadastrada: true,
          ultimo_aceito: {},
          falhas_24h: Infinity,
          disparos: [
            null,
            [],
            { workflow: "constructor", situacao: "FALHOU", http: {} },
          ],
        },
      });
      const agenda = saude.grupos.find((g) => g.id === "agenda").cargas[0];
      expect(agenda.historico).toHaveLength(1);
      expect(agenda.historico[0].mensagem).toBe("constructor");
      expect(agenda.agenda).toMatchObject({ ultimoAceito: null, falhas24h: 0 });
      expect(
        normalizarSaude({ agenda_dos_robos: [] }).grupos.find(
          (g) => g.id === "agenda",
        ).cargas,
      ).toEqual([]);
    });
  });
});

bloco("saude-das-cargas", () => {
  /* "Agora" fixo: 01/10/2026 12:00 UTC. */
  const AGORA = new Date("2026-10-01T12:00:00Z");
  const ha = (min) => new Date(AGORA.getTime() - min * 60000).toISOString();
  const execucao = (situacao, minAtras, extra = {}) => ({
    inicio: ha(minAtras + 1),
    fim: ha(minAtras),
    situacao,
    ...extra,
  });

  /* O formato de get_saude_das_cargas (20261001120000_saude_das_cargas.sql). */
  const PAYLOAD = {
    schema_version: 1,
    gerado_em: AGORA.toISOString(),
    // obter_catalogo_dos_robos, que a tela junta ao payload (20261109180000).
    catalogo_dos_robos: CATALOGO_DOS_ROBOS,
    analises: [
      {
        origem: "apps_script_analises_incremental_v1",
        area: "saude-indigena",
        tipo: "INCREMENTAL",
        execucoes: [execucao("processado", 10, { linhas: "120" })],
      },
      {
        origem: "apps_script_analises_sede_incremental_v1",
        area: "sede",
        tipo: "INCREMENTAL",
        execucoes: [execucao("processado", 8 * 60)],
      },
      {
        origem: "apps_script_analises_projetos_incremental_v1",
        area: "projetos",
        tipo: "INCREMENTAL",
        // A mais recente falhou, mesmo com uma boa antes.
        execucoes: [
          execucao("processado", 40),
          execucao("erro", 5, { mensagem: "Timeout" }),
        ],
      },
      {
        origem: "apps_script_analises_curriculares_v2_pdf",
        area: "saude-indigena",
        tipo: "FULL",
        // Completa de 10 dias atrás: sem prazo, segue em dia.
        execucoes: [execucao("processado", 10 * 24 * 60)],
      },
      {
        origem: "apps_script_analises_sede_full_v1",
        area: "sede",
        tipo: "FULL",
        execucoes: [],
      },
    ],
    entrevistas: [
      { inicio: ha(181), fim: ha(180), situacao: "CONCLUIDA", linhas: 3404 },
    ],
    selecao: [
      { inicio: ha(2), fim: null, situacao: "EM_ANDAMENTO", linhas: 0 },
      {
        inicio: ha(27 * 60),
        fim: ha(27 * 60 - 1),
        situacao: "CONCLUIDA",
        linhas: 3146,
      },
    ],
    tarefas: [
      {
        nome: "agsus_entrevistas_cache_do_painel",
        agenda: "1-59/2 * * * *",
        ativa: true,
        execucoes: [{ inicio: ha(1), fim: ha(1), situacao: "succeeded" }],
      },
      {
        nome: "agsus_analises_cache_do_painel",
        agenda: "*/2 * * * *",
        ativa: true,
        execucoes: [
          {
            inicio: ha(3),
            fim: ha(3),
            situacao: "failed",
            mensagem: "deadlock",
          },
        ],
      },
      // As tarefas que pedem as cargas ao GitHub, como no banco desde 16/10/2026.
      {
        nome: "agsus_robo_sincronizar_entrevistas",
        agenda: "5 0-10,15,21-23 * * *",
        ativa: false,
        execucoes: [],
      },
      {
        nome: "agsus_robo_sincronizar_selecao",
        agenda: "10 11,16,21 * * *",
        ativa: true,
        execucoes: [{ inicio: ha(50), fim: ha(50), situacao: "succeeded" }],
      },
      {
        nome: "agsus_robo_conferencias",
        agenda: "0 9 * * *",
        ativa: true,
        execucoes: [{ inicio: ha(180), fim: ha(180), situacao: "succeeded" }],
      },
    ],
  };

  const saude = normalizarSaude(PAYLOAD, AGORA);
  const carga = (id) =>
    saude.grupos.flatMap((g) => g.cargas).find((c) => c.id === id);

  describe("selo de cada carga", () => {
    it("incremental das análises: planilha parada há 3 h segue em dia (o Apps Script só reenvia em 6 h)", () => {
      const parada = normalizarSaude(
        {
          ...PAYLOAD,
          analises: [
            {
              origem: "apps_script_analises_projetos_incremental_v1",
              area: "projetos",
              tipo: "INCREMENTAL",
              execucoes: [execucao("processado", 3 * 60)],
            },
          ],
        },
        AGORA,
      );
      const linha = parada.grupos
        .flatMap((g) => g.cargas)
        .find(
          (c) =>
            c.id === "analises:apps_script_analises_projetos_incremental_v1",
        );
      expect(linha?.situacao).toBe("em_dia");
    });

    it("incremental das análises: em dia até 7 h, atrasada depois", () => {
      expect(
        carga("analises:apps_script_analises_incremental_v1"),
      ).toMatchObject({
        nome: "Saúde Indígena · incremental",
        situacao: "em_dia",
        idadeMin: 10,
      });
      expect(
        carga("analises:apps_script_analises_incremental_v1").ultimaOk.linhas,
      ).toBe(120);
      expect(
        carga("analises:apps_script_analises_sede_incremental_v1").situacao,
      ).toBe("atrasada");
    });

    it("a execução terminada mais recente com erro é falha, com a mensagem", () => {
      const c = carga("analises:apps_script_analises_projetos_incremental_v1");
      expect(c.situacao).toBe("falhou");
      expect(c.historico[0]).toMatchObject({
        situacao: "falha",
        mensagem: "Timeout",
      });
      expect(c.ultimaOk.situacao).toBe("ok");
      expect(c.historico[0].encerradaPorInatividade).toBe(false);
    });

    it("execução encerrada por inatividade (20261007170000) é falha marcada como tal", () => {
      const saude = normalizarSaude(
        {
          analises: [
            {
              origem: "apps_script_analises_incremental_v1",
              area: "saude-indigena",
              tipo: "INCREMENTAL",
              execucoes: [
                execucao("erro", 5, {
                  mensagem:
                    "Execução encerrada por inatividade: sem progresso desde 06/10/2026 16:49 (mais de 30 min).",
                  encerrada_por_inatividade: true,
                }),
              ],
            },
          ],
        },
        AGORA,
      );
      const c = saude.grupos[0].cargas[0];
      expect(c.situacao).toBe("falhou");
      expect(c.historico[0]).toMatchObject({
        situacao: "falha",
        encerradaPorInatividade: true,
      });
    });

    it("a carga completa não tem prazo; sem execução é 'nunca rodou'", () => {
      expect(
        carga("analises:apps_script_analises_curriculares_v2_pdf"),
      ).toMatchObject({
        nome: "Saúde Indígena · carga completa",
        situacao: "em_dia",
        prazoMin: null,
      });
      expect(carga("analises:apps_script_analises_sede_full_v1").situacao).toBe(
        "nunca",
      );
    });

    it("entrevistas sem agenda ativa não atrasa; seleção atrasa pelo prazo da agenda; rodando agora aparece", () => {
      expect(carga("entrevistas")).toMatchObject({
        situacao: "em_dia",
        idadeMin: 180,
      });
      const selecao = carga("selecao");
      expect(selecao.situacao).toBe("atrasada");
      expect(selecao.emAndamento).toBe(true);
      expect(selecao.ultimaOk.linhas).toBe(3146);
    });

    it("tarefas do banco com nome legível e o prazo pela agenda", () => {
      expect(carga("tarefa:agsus_entrevistas_cache_do_painel")).toMatchObject({
        nome: "Painel de entrevistas (pacote pronto)",
        situacao: "em_dia",
        prazoMin: PRAZO_FREQUENTE_MIN,
      });
      expect(carga("tarefa:agsus_analises_cache_do_painel").situacao).toBe(
        "falhou",
      );
    });

    it("resumo conta cada situação", () => {
      expect(saude.resumo).toEqual({
        em_dia: 6,
        atrasada: 2,
        falhou: 2,
        em_andamento: 0,
        nunca: 2,
        desligada: 0,
      });
      expect(saude.total).toBe(12);
    });

    it("sem acesso ao pg_cron, o grupo das tarefas fica indisponível", () => {
      const sem = normalizarSaude({ ...PAYLOAD, tarefas: null }, AGORA);
      const grupo = sem.grupos.find((g) => g.id === "tarefas");
      expect(grupo.indisponivel).toBe(true);
      expect(grupo.cargas).toEqual([]);
    });

    it("só execução em curso, sem nenhuma terminada: em andamento", () => {
      const so = normalizarSaude(
        { selecao: [{ inicio: ha(1), situacao: "EM_ANDAMENTO" }] },
        AGORA,
      );
      expect(so.grupos[1].cargas[1].situacao).toBe("em_andamento");
    });
  });

  describe("prazos e textos", () => {
    it("prazo pela agenda do pg_cron: maior intervalo + folga", () => {
      const prazo = (agenda) => prazoDaAgenda(agenda, AGORA);
      expect(prazo("*/2 * * * *")).toBe(PRAZO_FREQUENTE_MIN);
      expect(prazo("1-59/2 * * * *")).toBe(PRAZO_FREQUENTE_MIN);
      expect(prazo("*/5 * * * *")).toBe(PRAZO_FREQUENTE_MIN);
      expect(prazo("*/10 * * * *")).toBe(20);
      expect(prazo("20 6 * * *")).toBe(PRAZO_DIARIO_MIN);
      expect(prazo("0 6 1 * *")).toBe(PRAZO_MENSAL_MIN);
      expect(prazo("qualquer")).toBeNull();
    });

    it("de hora em hora e listas também têm prazo (antes ficavam sem)", () => {
      const prazo = (agenda) => prazoDaAgenda(agenda, AGORA);
      expect(prazo("25 * * * *")).toBe(2 * 60);
      expect(prazo("20,50 * * * *")).toBe(60);
      // Seleção: a noite de 14 h + 2 h; Entrevistas: a tarde de 6 h + 2 h.
      expect(prazo("10 11,16,21 * * *")).toBe(16 * 60);
      expect(prazo("5 0-10,15,21-23 * * *")).toBe(8 * 60);
    });

    it("idade em texto", () => {
      expect(textoDaIdade(null)).toBe("—");
      expect(textoDaIdade(0)).toBe("agora há pouco");
      expect(textoDaIdade(45)).toBe("há 45 min");
      expect(textoDaIdade(180)).toBe("há 3 h");
      expect(textoDaIdade(3 * 24 * 60)).toBe("há 3 dias");
    });
  });

  describe("visão simples: uma linha por aba do sistema", () => {
    const { linhas, atencao } = visaoSimples(saude);
    const linha = (id) => linhas.find((l) => l.id === id);

    it("junta incremental e completa por área; a completa sem prazo não pesa", () => {
      expect(linhas.map((l) => l.titulo)).toEqual([
        "Análises curriculares · Saúde Indígena",
        "Análises curriculares · SEDE",
        "Análises curriculares · Projetos",
        "Entrevistas",
        "Seleção",
        "Atualização automática do banco",
      ]);
      expect(linha("analises:saude-indigena")).toMatchObject({
        situacao: "em_dia",
        idadeMin: 10,
      });
      // SEDE: a incremental está atrasada; a completa que nunca rodou não conta.
      expect(linha("analises:sede").situacao).toBe("atrasada");
    });

    it("a falha leva a mensagem e o nome da parte", () => {
      expect(linha("analises:projetos")).toMatchObject({
        situacao: "falhou",
        erro: { mensagem: "Timeout", parte: "Projetos · incremental" },
      });
    });

    it("as tarefas do banco viram uma linha só, com a pior situação", () => {
      expect(linha("tarefas")).toMatchObject({ situacao: "falhou" });
      expect(linha("tarefas").partes).toHaveLength(5);
    });

    it("tarefa pausada que falhou não pinta erro na linha que ficou em dia", () => {
      const tarefas = visaoSimples(
        normalizarSaude(
          {
            analises: [],
            entrevistas: [],
            selecao: [],
            tarefas: [
              {
                nome: "a",
                agenda: "*/2 * * * *",
                ativa: true,
                execucoes: [execucao("succeeded", 1)],
              },
              {
                nome: "b",
                agenda: "0 9 * * *",
                ativa: false,
                execucoes: [
                  execucao("failed", 10 * 60, { mensagem: "deadlock" }),
                ],
              },
            ],
          },
          AGORA,
        ),
      ).linhas.find((l) => l.id === "tarefas");
      expect(tarefas).toMatchObject({ situacao: "em_dia", erro: null });
    });

    it("o aviso do topo lista só falha e atraso", () => {
      expect(atencao.map((l) => l.id)).toEqual([
        "analises:sede",
        "analises:projetos",
        "selecao",
        "tarefas",
      ]);
    });

    it("área sem nenhuma carga (SEDE sem planilha ainda) não pede atenção", () => {
      const semSede = normalizarSaude(
        {
          analises: [
            {
              origem: "sede_inc",
              area: "sede",
              tipo: "INCREMENTAL",
              execucoes: [],
            },
            { origem: "sede_full", area: "sede", tipo: "FULL", execucoes: [] },
          ],
          entrevistas: [],
          selecao: [],
          tarefas: [],
        },
        AGORA,
      );
      const visao = visaoSimples(semSede);
      expect(visao.linhas[0]).toMatchObject({
        titulo: "Análises curriculares · SEDE",
        situacao: "nunca",
        ultimaAtualizacao: null,
      });
      expect(visao.atencao.map((l) => l.id)).not.toContain("analises:sede");
    });
  });

  describe("robô da Empregare (20261005170000)", () => {
    const comRobo = (empregare, agora = AGORA) =>
      normalizarSaude({ ...PAYLOAD, empregare }, agora);

    it("sem a chave no payload (migration não aplicada), a linha não aparece", () => {
      expect(visaoSimples(saude).linhas.map((l) => l.id)).not.toContain(
        "empregare",
      );
    });

    it("vira uma linha depois da Seleção, com as contagens e quem disparou na mensagem", () => {
      const s = comRobo([
        execucao("PARCIAL", 30, {
          linhas: 812,
          vagas_pedidas: 12,
          vagas_baixadas: 11,
          vagas_falha: 1,
          vagas_recusadas: 0,
          disparo: "MONITORA",
        }),
        execucao("CONCLUIDA", 24 * 60, { linhas: 800, disparo: "AGENDA" }),
      ]);
      const { linhas, atencao } = visaoSimples(s);
      expect(linhas.map((l) => l.titulo).slice(-3)).toEqual([
        "Seleção",
        "Robô da Empregare",
        "Atualização automática do banco",
      ]);
      const robo = linhas.find((l) => l.id === "empregare");
      expect(robo.situacao).toBe("falhou");
      expect(robo.erro.mensagem).toBe(
        "12 vagas pedidas · 11 baixadas · 1 com falha · 0 recusadas · disparo: Rodar agora",
      );
      expect(atencao.map((l) => l.id)).toContain("empregare");
      expect(robo.partes[0].historico[1].mensagem).toContain("disparo: agenda");
    });

    it("concluída dentro do prazo fica em dia; em andamento aparece", () => {
      const s = comRobo([
        { inicio: ha(5), situacao: "EM_ANDAMENTO" },
        execucao("CONCLUIDA", 60, { linhas: 10 }),
      ]);
      const robo = visaoSimples(s).linhas.find((l) => l.id === "empregare");
      expect(robo).toMatchObject({ situacao: "em_dia", emAndamento: true });
    });

    it("prazo e esperado vêm da tarefa do pg_cron que pede a carga", () => {
      const planilhas = (payload) =>
        normalizarSaude(payload, AGORA).grupos.find((g) => g.id === "planilhas")
          .cargas;
      const de = (lista, id) => lista.find((c) => c.id === id);
      const hoje = planilhas(PAYLOAD);
      expect(de(hoje, "selecao")).toMatchObject({
        prazoMin: 16 * 60,
        esperado: "às 8h10, 13h10 e 18h10",
      });
      // Tarefa inativa (pausa de 16/10/2026): sem prazo, só pelo Rodar agora.
      expect(de(hoje, "entrevistas")).toMatchObject({
        prazoMin: null,
        esperado: "só pelo Rodar agora",
      });
      // Religada no banco: prazo e texto acompanham, sem mexer na tela.
      const religada = planilhas({
        ...PAYLOAD,
        tarefas: PAYLOAD.tarefas.map((t) =>
          t.nome === "agsus_robo_sincronizar_entrevistas"
            ? { ...t, ativa: true }
            : t,
        ),
      });
      expect(de(religada, "entrevistas")).toMatchObject({
        prazoMin: 8 * 60,
        esperado: "de hora em hora das 18h05 às 7h05 e às 12h05",
      });
      // Sem a tarefa (pg_cron ilegível): também sem prazo.
      expect(
        de(planilhas({ ...PAYLOAD, tarefas: null }), "selecao").prazoMin,
      ).toBeNull();
    });

    it("robô da Empregare sem prazo: só roda quando alguém pede, nunca fica atrasado", () => {
      const domingo = new Date("2026-10-04T15:00:00Z");
      const umMesAntes = new Date("2026-09-02T09:40:00Z").toISOString();
      const s = comRobo(
        [{ inicio: umMesAntes, fim: umMesAntes, situacao: "CONCLUIDA" }],
        domingo,
      );
      const robo = visaoSimples(s).linhas.find((l) => l.id === "empregare");
      expect(robo.situacao).toBe("em_dia");
    });
  });

  describe("conferências de consistência (20261005210000)", () => {
    const comConferencias = (conferencias) =>
      normalizarSaude({ ...PAYLOAD, empregare: [], conferencias }, AGORA);

    it("sem a chave no payload (migration não aplicada), a linha não aparece", () => {
      expect(
        visaoSimples(
          normalizarSaude({ ...PAYLOAD, empregare: [] }, AGORA),
        ).linhas.map((l) => l.id),
      ).not.toContain("conferencias");
    });

    it("vira uma linha depois do robô, com os avisos e quem disparou na mensagem", () => {
      const s = comConferencias([
        execucao("CONCLUIDA", 60, {
          novos: 2,
          abertos: 7,
          resolvidos: 1,
          falhas: [],
          disparo: "AGENDA",
        }),
      ]);
      const { linhas } = visaoSimples(s);
      expect(linhas.map((l) => l.titulo).slice(-3)).toEqual([
        "Robô da Empregare",
        "Conferências de consistência",
        "Atualização automática do banco",
      ]);
      const conf = linhas.find((l) => l.id === "conferencias");
      expect(conf.situacao).toBe("em_dia");
      expect(conf.partes[0].historico[0].mensagem).toBe(
        "2 avisos novos · 7 abertos · 1 resolvidos · disparo: agenda",
      );
    });

    it("diária: atrasada depois de 26 h; parcial conta como falha", () => {
      const atrasada = comConferencias([
        execucao("CONCLUIDA", PRAZO_DIARIO_MIN + 5),
      ]);
      expect(
        visaoSimples(atrasada).linhas.find((l) => l.id === "conferencias")
          .situacao,
      ).toBe("atrasada");
      const parcial = comConferencias([
        execucao("PARCIAL", 10, { falhas: ["CARGA_VARIACAO_BRUSCA"] }),
      ]);
      const linha = visaoSimples(parcial).linhas.find(
        (l) => l.id === "conferencias",
      );
      expect(linha.situacao).toBe("falhou");
      expect(linha.erro.mensagem).toContain("1 conferências falharam");
    });

    it("a explicação diz o horário da agenda do banco", () => {
      const s = comConferencias([execucao("CONCLUIDA", 60)]);
      expect(
        visaoSimples(s).linhas.find((l) => l.id === "conferencias").explicacao,
      ).toMatch(/: todo dia às 6h\.$/);
    });
  });

  describe("triagem da Avaliação documental (20261006110000)", () => {
    it("sem a chave no payload, a linha não aparece; com ela, vem depois das conferências", () => {
      expect(
        visaoSimples(
          normalizarSaude(
            { ...PAYLOAD, empregare: [], conferencias: [] },
            AGORA,
          ),
        ).linhas.map((l) => l.id),
      ).not.toContain("pre_classificacao");
      const s = normalizarSaude(
        {
          ...PAYLOAD,
          empregare: [],
          conferencias: [],
          pre_classificacao: [
            execucao("CONCLUIDA", 30, {
              editais: 1,
              vagas: 5,
              lote: 36,
              disparo: "ROBO",
            }),
          ],
        },
        AGORA,
      );
      const { linhas } = visaoSimples(s);
      expect(linhas.map((l) => l.titulo).slice(-2)).toEqual([
        "Triagem (Avaliação documental)",
        "Atualização automática do banco",
      ]);
      const linha = linhas.find((l) => l.id === "pre_classificacao");
      expect(linha.situacao).toBe("em_dia");
      expect(linha.partes[0].historico[0].mensagem).toBe(
        "1 editais · 5 vagas · 36 no lote · disparo: fim do robô da Empregare",
      );
    });
  });

  describe("o expurgo dos anexos do chat saiu com o chat (20261014120000)", () => {
    it("payload antigo com expurgo_chat não vira linha", () => {
      const base = { ...PAYLOAD, empregare: [], conferencias: [] };
      const s = normalizarSaude(
        { ...base, expurgo_chat: [execucao("CONCLUIDA", 60)] },
        AGORA,
      );
      expect(visaoSimples(s).linhas.map((l) => l.id)).not.toContain(
        "expurgo_chat",
      );
    });
  });

  describe("agenda dos robôs pelo banco (20261008140000)", () => {
    const BASE = { ...PAYLOAD, empregare: [], conferencias: [] };
    const disparo = (situacao, minAtras, extra = {}) => ({
      workflow: "sincronizar-entrevistas.yml",
      inicio: ha(minAtras),
      fim: situacao === "PEDIDO" ? null : ha(minAtras),
      situacao,
      http: situacao === "ACEITO" ? 204 : null,
      mensagem: null,
      ...extra,
    });
    const agenda = (bruta) =>
      visaoSimples(
        normalizarSaude({ ...BASE, agenda_dos_robos: bruta }, AGORA),
      ).linhas.find((l) => l.id === "agenda_dos_robos");

    it("sem a chave no payload, a linha não aparece; com ela, vem antes das tarefas do banco", () => {
      expect(
        visaoSimples(normalizarSaude(BASE, AGORA)).linhas.map((l) => l.id),
      ).not.toContain("agenda_dos_robos");
      const { linhas } = visaoSimples(
        normalizarSaude(
          {
            ...BASE,
            agenda_dos_robos: {
              chave_cadastrada: true,
              ultimo_aceito: ha(10),
              falhas_24h: 0,
              sem_chave_24h: 0,
              disparos: [disparo("ACEITO", 10)],
            },
          },
          AGORA,
        ),
      );
      expect(linhas.map((l) => l.titulo).slice(-2)).toEqual([
        "Agenda dos robôs",
        "Atualização automática do banco",
      ]);
      const linha = linhas.find((l) => l.id === "agenda_dos_robos");
      expect(linha).toMatchObject({ situacao: "em_dia", idadeMin: 10 });
      expect(linha.agenda).toMatchObject({
        chaveCadastrada: true,
        falhas24h: 0,
      });
      expect(linha.partes[0].historico[0].mensagem).toBe(
        "Entrevistas · HTTP 204",
      );
    });

    it("execução iniciada no GitHub (com quem iniciou) e pedido pelo SQL direto (20261020170000)", () => {
      const linha = agenda({
        chave_cadastrada: true,
        ultimo_aceito: ha(30),
        falhas_24h: 0,
        sem_chave_24h: 0,
        disparos: [
          disparo("INICIADO", 5, {
            workflow: "robo-empregare.yml",
            origem: "GITHUB",
            ator: "fulano",
            mensagem: "modo normal · editais 93/2026",
          }),
          disparo("ACEITO", 20, {
            workflow: "pre-classificacao.yml",
            origem: "MANUAL",
          }),
          disparo("ACEITO", 30, { origem: "AGENDA" }),
        ],
      });
      expect(linha.partes[0].historico.map((e) => e.mensagem)).toEqual([
        "Robô da Empregare · iniciada no GitHub por fulano · modo normal · editais 93/2026",
        "Triagem · SQL direto, sem usuário · HTTP 204",
        "Entrevistas · HTTP 204",
      ]);
      expect(linha.partes[0].historico[0].situacao).toBe("ok");
    });

    it("sem chave cadastrada no Vault, falhou mesmo sem pedido nenhum", () => {
      const linha = agenda({
        chave_cadastrada: false,
        ultimo_aceito: null,
        falhas_24h: 0,
        sem_chave_24h: 0,
        disparos: [],
      });
      expect(linha.situacao).toBe("falhou");
      expect(linha.agenda.chaveCadastrada).toBe(false);
    });

    it("o último pedido recusado (chave expirada) é falha, com o código e a mensagem do GitHub", () => {
      const linha = agenda({
        chave_cadastrada: true,
        ultimo_aceito: ha(70),
        falhas_24h: 1,
        sem_chave_24h: 0,
        disparos: [
          disparo("FALHOU", 10, {
            workflow: "sincronizar-selecao.yml",
            http: 401,
            mensagem: "GitHub 401: Bad credentials",
          }),
          disparo("ACEITO", 70),
        ],
      });
      expect(linha.situacao).toBe("falhou");
      expect(linha.erro.mensagem).toBe(
        "Seleção · HTTP 401 · GitHub 401: Bad credentials",
      );
    });

    it("atrasa pelo menor prazo das tarefas dos robôs ativas; pedido aberto não conta como falha", () => {
      // Seleção (16 h) e Conferências (26 h) ativas: vale o menor, 16 h.
      const comAceito = (min) =>
        agenda({
          chave_cadastrada: true,
          ultimo_aceito: ha(min),
          falhas_24h: 0,
          sem_chave_24h: 0,
          disparos: [disparo("PEDIDO", 1)],
        });
      expect(comAceito(15 * 60).situacao).toBe("em_dia");
      expect(comAceito(17 * 60).situacao).toBe("atrasada");
      expect(comAceito(17 * 60).partes[0].esperado).toBe(
        "Seleção: às 8h10, 13h10 e 18h10; Conferências: todo dia às 6h",
      );
    });

    it("sem nenhuma tarefa de robô ativa, a agenda não atrasa (só falha)", () => {
      const linha = visaoSimples(
        normalizarSaude(
          {
            ...BASE,
            tarefas: PAYLOAD.tarefas.map((t) => ({ ...t, ativa: false })),
            agenda_dos_robos: {
              chave_cadastrada: true,
              ultimo_aceito: ha(10 * 24 * 60),
              falhas_24h: 0,
              sem_chave_24h: 0,
              disparos: [],
            },
          },
          AGORA,
        ),
      ).linhas.find((l) => l.id === "agenda_dos_robos");
      expect(linha.situacao).toBe("em_dia");
      expect(linha.partes[0].esperado).toBe(
        "nenhuma carga agendada; só pelo Rodar agora",
      );
    });
  });

  describe("Classificação em Python no Status (20261023200000)", () => {
    const item = (situacao, minAtras, extra = {}) => ({
      inicio: ha(minAtras + 1),
      fim: ha(minAtras),
      situacao,
      edital: "114/2026",
      tipo: "PRELIMINAR",
      mensagem: null,
      ...extra,
    });
    const comClassificacao = (relatorios, calculos) =>
      normalizarSaude(
        {
          ...PAYLOAD,
          empregare: [],
          conferencias: [],
          classificacao_python: { relatorios, calculos },
        },
        AGORA,
      );
    const porId = (s, chaves = null) =>
      Object.fromEntries(visaoSimples(s, chaves).linhas.map((l) => [l.id, l]));

    it("sem a chave no payload, as linhas não aparecem", () => {
      const linhas = visaoSimples(
        normalizarSaude({ ...PAYLOAD, empregare: [], conferencias: [] }, AGORA),
      ).linhas.map((l) => l.id);
      expect(linhas).not.toContain("classificacao_desempate");
      expect(linhas).not.toContain("classificacao_calculo");
    });

    it("a última lista pronta: em dia, com a última execução; a mais recente falhou: falhou, com o edital e o motivo", () => {
      const linhas = porId(
        comClassificacao(
          [item("PRONTO", 20)],
          [
            item("NAO_CONFERE", 5, {
              mensagem:
                "O cálculo do Python não confere com o da tela (2 diferença(s)); a lista não foi registrada.",
            }),
            item("REGISTRADO", 60),
          ],
        ),
      );
      expect(linhas.classificacao_desempate.situacao).toBe("em_dia");
      expect(linhas.classificacao_desempate.titulo).toBe(
        "Relatório de desempate (Classificação em Python)",
      );
      expect(linhas.classificacao_desempate.idadeMin).toBe(20);
      expect(linhas.classificacao_calculo.situacao).toBe("falhou");
      expect(linhas.classificacao_calculo.erro.mensagem).toBe(
        "114/2026 · PRELIMINAR · O cálculo do Python não confere com o da tela (2 diferença(s)); a lista não foi registrada.",
      );
    });

    it("pedido esperando o job há mais que o limite conta como falha; dentro do limite, em andamento", () => {
      const linhas = porId(
        comClassificacao(
          [item("PEDIDO", 40, { fim: ha(40) })],
          [item("CALCULANDO", 2, { fim: ha(2) })],
        ),
      );
      expect(linhas.classificacao_desempate.situacao).toBe("falhou");
      expect(linhas.classificacao_desempate.erro.mensagem).toContain(
        "Sem resposta do job há mais de 30 min.",
      );
      expect(linhas.classificacao_calculo.situacao).toBe("em_andamento");
      expect(linhas.classificacao_calculo.emAndamento).toBe(true);
    });

    it("as chaves da automação: o cálculo desligado aparece como 'Desligada pelo administrador'", () => {
      const chaves = normalizarChaves({
        chaves: [
          {
            chave: "classificacao",
            nome: "Classificação em Python",
            ligada: true,
          },
          {
            chave: "classificacao_calculo",
            nome: "Gerar listas pelo Python",
            ligada: false,
            motivo: "Só depois da publicação do 114/2026",
          },
        ],
      });
      const linhas = porId(comClassificacao([item("FALHOU", 5)], []), chaves);
      expect(linhas.classificacao_calculo.situacao).toBe("desligada");
      expect(linhas.classificacao_calculo.desligada.motivo).toBe(
        "Só depois da publicação do 114/2026",
      );
      expect(linhas.classificacao_desempate.situacao).toBe("falhou");
    });

    it("o cálculo ligado com a Classificação em Python desligada aparece desligado (20261024110000)", () => {
      const chaves = normalizarChaves({
        chaves: [
          {
            chave: "classificacao",
            nome: "Classificação em Python",
            ligada: false,
            motivo: "Pausa do Python",
          },
          {
            chave: "classificacao_calculo",
            nome: "Gerar listas pelo Python",
            ligada: true,
          },
        ],
      });
      const linhas = porId(comClassificacao([], [item("FALHOU", 5)]), chaves);
      expect(linhas.classificacao_calculo.situacao).toBe("desligada");
      expect(linhas.classificacao_calculo.desligada.motivo).toBe(
        "Pausa do Python",
      );
    });
  });
});

bloco("service-worker-policy", () => {
  function loadPolicy() {
    const source = readFileSync(resolve(process.cwd(), "sw-policy.js"), "utf8");
    const context = { self: {}, URL };
    vm.runInNewContext(source, context);
    return context.self.AgSUSPwaCachePolicy;
  }

  describe("service worker cache policy", () => {
    const policy = loadPolicy();

    it("prioriza rede para navegação, scripts e estilos", () => {
      expect(policy.getRequestStrategy({ mode: "navigate" })).toBe(
        "network-first",
      );
      expect(policy.getRequestStrategy({ destination: "script" })).toBe(
        "network-first",
      );
      expect(policy.getRequestStrategy({ destination: "style" })).toBe(
        "network-first",
      );
    });

    it("arquivo com hash no nome vem do cache primeiro: depois da publicação o da versão anterior dá 404", () => {
      for (const destination of ["script", "style", "font", "image"])
        expect(
          policy.getRequestStrategy({
            destination,
            url: "https://yeende.app/assets/calendario-editais-C6Way2G9.js",
          }),
        ).toBe("cache-first");
      expect(
        policy.getRequestStrategy({
          destination: "script",
          url: "https://yeende.app/sw-policy.js",
        }),
      ).toBe("network-first");
      // fetch() da página (destination vazio) não passa pelo cache.
      expect(
        policy.getRequestStrategy({
          url: "https://yeende.app/assets/calendario-editais-C6Way2G9.js",
        }),
      ).toBe("network-only");
    });

    it("rede primeiro: erro da rede (404, 500) usa a cópia guardada", () => {
      expect(policy.prefersCachedCopy({ ok: true, type: "basic" })).toBe(false);
      expect(
        policy.prefersCachedCopy({
          ok: false,
          status: 0,
          type: "opaqueredirect",
        }),
      ).toBe(false);
      expect(
        policy.prefersCachedCopy({ ok: false, status: 404, type: "basic" }),
      ).toBe(true);
      expect(
        policy.prefersCachedCopy({ ok: false, status: 503, type: "basic" }),
      ).toBe(true);
      expect(policy.prefersCachedCopy(undefined)).toBe(true);
    });

    it("na troca de versão herda os pedaços com hash da anterior que a nova não tem", () => {
      const o = "https://yeende.app";
      const anterior = [
        `${o}/`,
        `${o}/assets/main-AAAAAAAA.js`,
        `${o}/assets/telas-BBBBBBBB.js`,
        `${o}/assets/comum-CCCCCCCC.js`,
        `${o}/fonts/geist-latin.woff2`,
        `${o}/assets/velho-DDDDDDDD.js`,
      ];
      const novo = [`${o}/`, `${o}/assets/comum-CCCCCCCC.js`];
      // Ordem inversa: os herdados de versões mais velhas entram primeiro e saem primeiro do limite.
      expect(policy.entriesToCarry(anterior, novo)).toEqual([
        `${o}/assets/velho-DDDDDDDD.js`,
        `${o}/assets/telas-BBBBBBBB.js`,
        `${o}/assets/main-AAAAAAAA.js`,
      ]);
      expect(policy.entriesToCarry([], novo)).toEqual([]);
    });

    it("mantém cache-first para recursos visuais estáticos", () => {
      expect(policy.getRequestStrategy({ destination: "image" })).toBe(
        "cache-first",
      );
      expect(policy.getRequestStrategy({ destination: "font" })).toBe(
        "cache-first",
      );
    });

    it("não armazena respostas privadas ou no-store", () => {
      const response = (cacheControl) => ({
        ok: true,
        type: "basic",
        headers: { get: () => cacheControl },
      });

      expect(policy.isResponseCacheable(response("public, max-age=3600"))).toBe(
        true,
      );
      expect(policy.isResponseCacheable(response("private, max-age=0"))).toBe(
        false,
      );
      expect(policy.isResponseCacheable(response("no-store"))).toBe(false);
    });

    it("o cache tem limite: saem as entradas mais antigas que entraram pelo uso", () => {
      const urls = ["/", "/index.html", "/a.js", "/b.js", "/c.js", "/d.js"];
      expect(
        policy.entriesBeyondLimit(urls, {
          limit: 2,
          keep: ["/", "/index.html"],
        }),
      ).toEqual(["/a.js", "/b.js"]);
      expect(policy.entriesBeyondLimit(urls, { limit: 10 })).toEqual([]);
    });

    it("os arquivos guardados na instalação não saem nem ocupam o limite", () => {
      const guardados = Array.from(
        { length: 200 },
        (_, i) => `/assets/t${i}.js`,
      );
      const urls = [
        "/",
        ...guardados,
        "/img/a.png",
        "/img/b.png",
        "/img/c.png",
      ];
      const keep = ["/", ...guardados];

      expect(policy.entriesBeyondLimit(urls, { limit: 150, keep })).toEqual([]);
      expect(policy.entriesBeyondLimit(urls, { limit: 2, keep })).toEqual([
        "/img/a.png",
      ]);
    });

    it("reconhece o arquivo com o hash do Vite no nome", () => {
      expect(policy.isHashedAsset("/assets/estado-DDQIcVp4.js")).toBe(true);
      expect(
        policy.isHashedAsset("https://yeende.app/assets/main-CQ0xKEuX.css"),
      ).toBe(true);
      expect(policy.isHashedAsset("/assets/usar-filtros-Bz6En5IR.js")).toBe(
        true,
      );
      expect(policy.isHashedAsset("/assets/agsus-logo.webp")).toBe(false);
      expect(
        policy.isHashedAsset("/assets/access-background-default.svg"),
      ).toBe(false);
      expect(policy.isHashedAsset("/fonts/geist-latin.woff2")).toBe(false);
      expect(policy.isHashedAsset("/sw-policy.js")).toBe(false);
    });
  });

  describe("versão do cache do service worker", () => {
    it("o build troca o nome do cache pela versão publicada", async () => {
      const { swComVersao } =
        await import("../src/lib/carga/cache-do-service-worker");
      const fonte = readFileSync(resolve(process.cwd(), "sw.js"), "utf8");
      const publicado = swComVersao(fonte, "abc123");
      expect(publicado).toContain(
        'const CACHE_VERSION = "agsus-monitora-abc123";',
      );
      expect(publicado).not.toContain("agsus-monitora-dev");
    });

    it("o build grava no sw.js a lista dos arquivos guardados na instalação", async () => {
      const { swComVersao } =
        await import("../src/lib/carga/cache-do-service-worker");
      const fonte = readFileSync(resolve(process.cwd(), "sw.js"), "utf8");
      expect(fonte).toContain("const PRECACHE = [];");
      const publicado = swComVersao(fonte, "abc123", ["/assets/a-12345678.js"]);
      expect(publicado).toContain(
        'const PRECACHE = ["/assets/a-12345678.js"];',
      );
    });

    it("guarda código, estilo, fonte e imagem; deixa de fora os JSON dos mapas", async () => {
      const { arquivosParaGuardar } =
        await import("../src/lib/carga/cache-do-service-worker");
      expect(
        arquivosParaGuardar([
          "assets/main-CQ0xKEuX.css",
          "assets/telas-DDQIcVp4.js",
          "assets\\agsus-logo.webp",
          "fonts/geist-latin.woff2",
          "/icons/agsus-monitora.svg",
          "data/terras-indigenas.json",
          "assets/modelo-importacao-lista-aprovados.xlsx",
          "assets/main-DwO2Aiew.js.map",
          "index.html",
          "versao.json",
          "assets/telas-DDQIcVp4.js",
        ]),
      ).toEqual([
        "/assets/agsus-logo.webp",
        "/assets/main-CQ0xKEuX.css",
        "/assets/telas-DDQIcVp4.js",
        "/fonts/geist-latin.woff2",
        "/icons/agsus-monitora.svg",
      ]);
    });
  });
});

bloco("texto-da-conferencia", () => {
  /* A hora no topo das telas de carga: conferência (a carga rodou) e mudança (o dado mudou). */
  const agora = new Date("2026-10-05T12:55:00Z"); // 09:55 em Brasília

  describe("texto da conferência", () => {
    it("hoje mostra só a hora; outro dia, dia e hora (Brasília)", () => {
      expect(quandoFoi("2026-10-05T12:32:00Z", agora)).toBe("às 09:32");
      expect(quandoFoi("2026-10-04T16:05:00Z", agora)).toBe("em 04/10, 13:05");
      expect(quandoFoi(null, agora)).toBe("");
      expect(quandoFoi("lixo", agora)).toBe("");
    });

    it("conferido hoje e mudança antes: os dois, a carga não parou", () => {
      expect(
        textoDaConferencia({
          conferidoEm: "2026-10-05T12:32:00Z",
          mudancaEm: "2026-10-04T16:05:00Z",
          agora,
        }),
      ).toBe("Conferido às 09:32 · última mudança em 04/10, 13:05");
    });

    it("só um dos dois, ou nenhum", () => {
      expect(
        textoDaConferencia({ conferidoEm: "2026-10-04T16:43:00Z", agora }),
      ).toBe("Conferido em 04/10, 13:43");
      expect(
        textoDaConferencia({ mudancaEm: "2026-10-05T12:00:00Z", agora }),
      ).toBe("Atualizado às 09:00");
      expect(textoDaConferencia({ agora })).toBeNull();
    });

    it("mudança depois da conferência (dado novo ainda não conferido): só a conferência", () => {
      expect(
        textoDaConferencia({
          conferidoEm: "2026-10-05T12:00:00Z",
          mudancaEm: "2026-10-05T12:30:00Z",
          agora,
        }),
      ).toBe("Conferido às 09:00");
    });
  });
});

bloco("versao-do-sistema", () => {
  const novidade = (id, data, visivel = true) => ({
    id,
    data,
    texto: `texto de ${id}`,
    visivel,
  });

  describe("versao.json publicado", () => {
    it("aceita versão e só as novidades visíveis e bem formadas", () => {
      expect(
        lerVersaoPublicada({
          versao: " abc123 ",
          novidades: [
            novidade("a", "2026-10-20"),
            novidade("b", "2026-10-21", false),
            { id: "c" },
          ],
        }),
      ).toEqual({ versao: "abc123", novidades: [novidade("a", "2026-10-20")] });
    });

    it("recusa o que não é o arquivo da versão", () => {
      expect(lerVersaoPublicada(null)).toBeNull();
      expect(lerVersaoPublicada("<html>")).toBeNull();
      expect(lerVersaoPublicada({ versao: "" })).toBeNull();
    });
  });

  describe("novidade para mostrar", () => {
    it("é a visível mais recente que a versão aberta ainda não tem", () => {
      const publicadas = [
        novidade("velha", "2026-10-01"),
        novidade("nova", "2026-10-21"),
        novidade("media", "2026-10-10"),
      ];
      expect(novidadeParaMostrar(publicadas, [])).toBe("texto de nova");
      expect(
        novidadeParaMostrar(publicadas, [novidade("nova", "2026-10-21")]),
      ).toBe("texto de media");
    });

    it("só quando marcada como visível", () => {
      expect(
        novidadeParaMostrar([novidade("x", "2026-10-21", false)], []),
      ).toBeNull();
      expect(novidadeParaMostrar([], [])).toBeNull();
    });

    it("o build publica só as visíveis, da mais recente para a mais antiga", () => {
      const lista = novidadesVisiveis([
        novidade("a", "2026-10-01"),
        novidade("b", "2026-10-03", false),
        novidade("c", "2026-10-02"),
      ]);
      expect(lista.map((n) => n.id)).toEqual(["c", "a"]);
      expect(novidadesVisiveis(NOVIDADES).every((n) => n.visivel)).toBe(true);
    });

    it("as novidades do repositório têm id único, data AAAA-MM-DD e texto curto", () => {
      const ids = NOVIDADES.map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const n of NOVIDADES) {
        expect(n.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(n.texto.length).toBeLessThanOrEqual(80);
        expect(n.texto).not.toMatch(/\.$/);
      }
    });
  });

  describe("erro de tela antiga", () => {
    it("PGRST202 (função ou assinatura que não existe mais)", () => {
      expect(ehErroDeTelaAntiga({ code: "PGRST202", message: "x" })).toBe(true);
    });

    it("'recarregue a página' com 22023 ou PT409", () => {
      const message =
        "Escolha o motivo da reabertura na lista. Se a lista não aparece, recarregue a página.";
      expect(ehErroDeTelaAntiga({ code: "22023", message })).toBe(true);
      expect(ehErroDeTelaAntiga({ code: "PT409", message })).toBe(true);
    });

    it("não confunde com outros erros", () => {
      expect(
        ehErroDeTelaAntiga({ code: "22023", message: "Edital inválido" }),
      ).toBe(false);
      expect(
        ehErroDeTelaAntiga({ code: "42501", message: "recarregue a página" }),
      ).toBe(false);
      expect(ehErroDeTelaAntiga(null)).toBe(false);
    });
  });

  describe("fetch do cliente Supabase", () => {
    const corpo = (dados, status) =>
      new Response(JSON.stringify(dados), {
        status,
        headers: { "Content-Type": "application/json" },
      });

    it("avisa quando uma RPC falha com PGRST202 e devolve a resposta igual", async () => {
      const aoSinal = vi.fn();
      const base = vi.fn(async () =>
        corpo({ code: "PGRST202", message: "Could not find" }, 404),
      );
      const observado = observarRespostasDoBanco(base, aoSinal);
      const resposta = await observado(
        "https://x.supabase.co/rest/v1/rpc/reabrir_analise?x=1",
        { method: "POST" },
      );
      expect(resposta.status).toBe(404);
      expect((await resposta.json()).code).toBe("PGRST202");
      await vi.waitFor(() =>
        expect(aoSinal).toHaveBeenCalledWith({
          rpc: "reabrir_analise",
          codigo: "PGRST202",
        }),
      );
    });

    it("não lê o corpo de resposta boa nem de rota que não é RPC", async () => {
      const aoSinal = vi.fn();
      const boa = corpo([], 200);
      const clonar = vi.spyOn(boa, "clone");
      await observarRespostasDoBanco(
        async () => boa,
        aoSinal,
      )("https://x.supabase.co/rest/v1/rpc/listar");
      expect(clonar).not.toHaveBeenCalled();
      await observarRespostasDoBanco(
        async () => corpo({ code: "PGRST202" }, 404),
        aoSinal,
      )("https://x.supabase.co/auth/v1/token");
      await new Promise((r) => setTimeout(r, 0));
      expect(aoSinal).not.toHaveBeenCalled();
    });

    it("ignora erro que não é de tela antiga e corpo que não é JSON", async () => {
      const aoSinal = vi.fn();
      const url = "https://x.supabase.co/rest/v1/rpc/salvar";
      await observarRespostasDoBanco(
        async () => corpo({ code: "42501", message: "sem permissão" }, 403),
        aoSinal,
      )(url);
      await observarRespostasDoBanco(
        async () => new Response("<html>", { status: 502 }),
        aoSinal,
      )(url);
      await new Promise((r) => setTimeout(r, 0));
      expect(aoSinal).not.toHaveBeenCalled();
    });
  });
});

bloco("workflows-dos-robos", () => {
  /*
  Os robôs que gravam no banco de produção só rodam por workflow_dispatch:
  pela agenda do banco (que respeita as chaves da automação, 20261022190000),
  pelo Rodar agora, pelo Run workflow ou chamados por outro workflow
  (workflow_call). Nada de `push` (em 22/10/2026 a
  "Sincronizar entrevistas" rodou três vezes em produção por push num ramo de
  trabalho) nem de `schedule` (o agendador é o banco: docs/agenda-dos-robos.md).
*/
  const ROBOS = [
    "sincronizar-entrevistas.yml",
    "sincronizar-selecao.yml",
    "conferencias.yml",
    "robo-empregare.yml",
    "pre-classificacao.yml",
    "leitura-de-arquivos.yml",
    "classificacao.yml",
    "contratacao-dos-aprovados.yml",
    "pacotes-dos-paineis.yml",
  ];
  const gatilhos = (texto) => {
    const bloco =
      /^on:\n([\s\S]*?)^\S/m.exec(texto.replace(/\r\n/g, "\n"))?.[1] || "";
    return [...bloco.matchAll(/^ {2}(\w+):/gm)].map(([, nome]) => nome);
  };

  describe("gatilhos dos workflows dos robôs", () => {
    // workflow_call: só outro workflow do repositório chama (o fim do robô chama a pré-classificação).
    it.each(ROBOS)("%s só roda por workflow_dispatch", (arquivo) => {
      const lista = gatilhos(
        readFileSync(`.github/workflows/${arquivo}`, "utf8"),
      );
      expect(lista).toContain("workflow_dispatch");
      expect(lista.filter((g) => g !== "workflow_call")).toEqual([
        "workflow_dispatch",
      ]);
    });

    it("as conferências chamam o Contratado em outra lista antes, e rodam mesmo se ele falhar", () => {
      const conferencias = readFileSync(
        ".github/workflows/conferencias.yml",
        "utf8",
      ).replace(/\r\n/g, "\n");
      expect(conferencias).toContain(
        "    uses: ./.github/workflows/contratacao-dos-aprovados.yml\n",
      );
      expect(conferencias).toContain(
        "    needs: contratacao\n    if: ${{ always() }}\n",
      );
    });

    it("a pré-classificação no fim do robô confere a chave antes", () => {
      const pre = readFileSync(
        ".github/workflows/pre-classificacao.yml",
        "utf8",
      );
      const conferir = pre.slice(
        pre.indexOf("- name: Conferir a chave da pré-classificação automática"),
        pre.indexOf("- name: Pré-classificar\n"),
      );
      expect(conferir).toContain("if: ${{ inputs.apos_robo }}");
      expect(conferir).toContain(
        "run: python -m monitora.chave_da_automacao pre_classificacao",
      );
      expect(pre).toContain(
        "if: ${{ steps.chave_pre_classificacao.outputs.ligada != 'false' }}",
      );
    });
  });
});
