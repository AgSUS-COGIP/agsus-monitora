// @vitest-environment node
import { bloco } from "./apoio/bloco.ts";
import * as alcanceDaSelecaoNs from "../src/lib/base/alcance-da-selecao.ts";
import {
  contarPorSituacao,
  separarAtivosEHistorico,
  textoDasSituacoes,
  vistaDaLista,
} from "../src/lib/base/ativos-e-historico.ts";
import {
  comSituacaoDoMonitoramento,
  editalDoHistorico,
  situacaoDoEdital,
  tomDaSituacaoDoEdital,
} from "../src/lib/editais/editais-ativos.ts";
import {
  arquivoDaTabela,
  nomeDoArquivoExportado,
  pdfDaTabela,
  textoDaCelula,
  xlsxDaTabela,
} from "../src/lib/base/exportacao-da-tabela.ts";
import {
  camposDasLinhas,
  casarChaveDoDsei,
  cnesDaUnidade,
  estabelecimentosDoCnes,
  motivoDaFalha,
  terrasDistintas,
  territorioPorDsei,
} from "../src/lib/mapas/mapa-saude-indigena/territorio-do-sigepsi.ts";
import { lembrarBanco } from "./apoio/bancos-abertos.ts";
import {
  ACAO_DA_PENDENCIA,
  editaisDaPendencia,
} from "../src/lib/visao-geral/visao-geral.ts";
import {
  ETAPAS_DO_FLUXO,
  etapaDoFluxo,
  etapasDoFluxo,
  idaParaAEtapa,
  tituloDoFluxo,
  vagaDaChave,
} from "../src/lib/navegacao/fluxo-das-etapas.ts";
import {
  consumirPedidoDeFiltro,
  pedirFiltro,
} from "../src/app/pedido-de-filtro.ts";
import { filtrosDeRecursos } from "../src/lib/aya/filtro-da-aya.ts";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { calcularKpis } from "../src/lib/analises/analises-curriculares.ts";
import {
  aptosEEliminados,
  formatarTaxa,
} from "../src/lib/selecao/selecao-do-painel.ts";
import { type VagaDaSelecao } from "../src/modulos/selecao/tipos.ts";
import {
  categoriaNaTriagem,
  conferirEntrada,
  ehEliminacaoAdministrativa,
  fundamentoDoBanco,
  fundamentoDoComunicado,
  linhaDoFundamento,
  quadroDosFundamentos,
} from "../src/lib/avaliacao-documental/fundamento-da-eliminacao.ts";
import { espelhoDaEliminacaoPreAnalise } from "../src/lib/avaliacao-documental/espelho-da-pre-classificacao.ts";
import { comunicadosDosEliminados } from "../src/lib/avaliacao-documental/documentos-em-lote.ts";
import {
  marcaDaImportacao,
  normalizarPrevia,
  parciaisDaMarca,
  resumoDaImportacao,
  semMarcaDaImportacao,
} from "../src/lib/avaliacao-documental/importacao-da-planilha.ts";
import { lancamentoInicial } from "../src/lib/avaliacao-documental/ficha.ts";
import { deflateRawSync } from "node:zlib";
import {
  limparModalidade,
  normalizeApprovedHeaders,
  readApprovedWorkbook,
  validateApprovedRows,
} from "../src/lib/aprovados/aprovados-import.ts";
import {
  zipSemCompressao,
  type ArquivoDoZip,
} from "../src/lib/recursos/documento-da-resposta.ts";
import { rotuloEmLinhas } from "../src/lib/selecao/rotulo-em-linhas.ts";
import { criarEstadoDaAvaliacao } from "../src/modulos/avaliacao-documental/estado.ts";
import { type ClienteDaAvaliacao } from "../src/modulos/avaliacao-documental/tipos-do-estado.ts";
import { CATALOGO_DE_MARCOS } from "../src/lib/comemoracao/catalogo-de-comemoracoes.ts";
import { exemploDoMarco } from "../src/lib/comemoracao/exemplos-das-comemoracoes.ts";
import { readFileSync, existsSync } from "node:fs";
import {
  COLUNAS_DO_MONITORAMENTO,
  INTERVALO_DO_REALTIME_MS,
  criarCarga,
  type ConsultaDaCarga,
  type DependenciasDaCarga,
  type OpcoesDaConsulta,
} from "../src/app/carga.ts";
import { type OpcoesDaCargaDaConfiguracao } from "../src/app/configuracao.ts";
import {
  type CopiaDaSessao,
  assinaturaDoAcesso,
  montarCopia,
} from "../src/lib/sessao/copia-da-sessao";
import { type PerfilDeAcesso } from "../src/lib/acessos/tipos-dos-acessos.ts";
import { definido } from "./definido.ts";
import {
  obterDadosDoMonitoramento,
  redefinirDadosDoMonitoramento,
  linhasPedidas,
} from "../src/componentes/dados-do-monitoramento.ts";
import {
  type SupabaseClient,
  AuthRetryableFetchError,
  AuthApiError,
} from "@supabase/supabase-js";
import {
  criarInicioDaSessao,
  parteDoInicio,
} from "../src/app/inicio-da-sessao.ts";
import { acompanharPaginaAberta } from "../src/app/pagina-aberta.ts";
import {
  TELAS_COM_LINHAS,
  telaUsaAsLinhas,
} from "../src/lib/navegacao/telas-com-linhas.ts";
import {
  buscarAcompanhamentoNoSupabase,
  criarEstadoDaVisaoGeral,
} from "../src/modulos/visao-geral/estado.ts";
import {
  criarGuardaDeAlteracoes,
  confirmarTrocaDeArea,
} from "../src/app/guarda-de-alteracoes.ts";
import { criarRascunhoDaRegra } from "../src/app/rascunho-da-regra.ts";
import { chaveDoRascunhoLocal } from "../src/lib/regras-do-edital/rascunho-da-regra.ts";
import {
  medirArte,
  type ImagemMedivel,
  type MedidaDaArte,
} from "../src/app/entrada/marca.ts";
import {
  createHtmlSecurityPlugin,
  sanitizeAnalyticsPageLocation,
  secureHtmlDocument,
  stripSupabaseCdnScripts,
} from "../src/lib/seguranca/html-security";
import {
  conflitosDaPublicacao,
  linhasDasSecoes,
  normalizarValoresCarregados,
} from "../src/lib/configuracoes/publicacao-de-configuracoes.ts";
import {
  linhasDosPaineisAlterados,
  normalizarPaineis,
} from "../src/lib/configuracoes/paineis-externos-das-configuracoes.ts";
import {
  LIMITE_SEM_REDE_MS,
  sessaoSemRede,
} from "../src/lib/sessao/sessao-sem-rede.ts";
import {
  PERFIL_GUARDADO,
  perfilParaGuardar,
} from "../src/lib/sessao/perfil-sem-rede.ts";
import {
  ARQUIVO_DO_RETRATO,
  CABECALHO,
  limparDump,
  montarRetrato,
  tarefasComoSql,
} from "../scripts/gerar-esquema-atual.mjs";
import {
  aplicarLocalizacoes,
  casaisNacionaisDoSigepsi,
  localizacoesPorDsei,
  tipoDaLocalizacao,
  ufDoCep,
} from "../src/lib/mapas/mapa-saude-indigena/localizacoes-do-sigepsi.ts";
import {
  registrosDoDsei,
  resumoDaRede,
  classificarRegistros,
  dicaDoRegistro,
} from "../src/lib/mapas/mapa-saude-indigena/mapa-do-dsei.ts";
import { casaisNacionaisDoMapa } from "../src/lib/mapas/mapa-saude-indigena/dados-do-mapa.ts";
import { type DseiDoMapa } from "../src/lib/mapas/mapa-saude-indigena/tipos.ts";
import {
  type PedidoDaVercel,
  type RespostaDaVercel,
} from "../api/_tipos-da-vercel.ts";
import {
  VINCULO_EXTERNO,
  VINCULO_INDETERMINADO,
  VINCULO_NORMAL,
} from "../src/lib/mapas/uf-ibge.ts";
import {
  aprovadosNoRecorte,
  chaveDoTexto,
  linhasDeAprovados,
  linhasPorCargo,
  normalizarAprovadosDaDiretoria,
  normalizarVagasPorCargo,
  vagasPeloTexto,
} from "../src/lib/visao-geral/relatorio-da-diretoria.ts";
import {
  conteudoDoRelatorio,
  MODELOS_DO_RELATORIO,
  normalizarEscolha,
  planilhasDoRelatorio,
  secoesPermitidas,
  alternarNaEscolha,
  modeloDaEscolha,
  nomeDoArquivoDoRelatorio,
  recorteDaAreaInteira,
  textoDaColuna,
  xlsxDoRelatorio,
} from "../src/lib/visao-geral/relatorio-da-visao-geral.ts";
import {
  filtrosVazios,
  indicadoresDaVisaoGeral,
  acompanhamentoDaResposta,
  enriquecerLinhas,
  COLUNAS_DA_TABELA,
  COLUNAS_INICIAIS,
  csvDaVisaoGeral,
  duracaoEmDias,
  valorParaOrdenar,
  andamentoPorFase,
  opcoesDosFiltros,
  prazoDoEdital,
  statusDaVisaoGeral,
  urgenciaDoCronograma,
} from "../src/lib/visao-geral/visao-geral.ts";
import { strFromU8, unzipSync, zipSync } from "fflate";
import { carregarBibliotecasDoPdf } from "../src/lib/avaliacao-documental/espelho-em-pdf.ts";
import { pdfDoRelatorio } from "../src/lib/visao-geral/relatorio-da-visao-geral-em-pdf.ts";
import {
  type Indicadores,
  type LinhaDaVisaoGeral,
  type LinhaDoMonitoramento,
  type Acompanhamento,
  type ListaDoAcompanhamento,
} from "../src/modulos/visao-geral/tipos.ts";
import {
  calcularReaberturas,
  cargosDaResposta,
  chaveDoCargo,
  reaberturasDosCargos,
  textoDaReabertura,
} from "../src/lib/visao-geral/vagas-reabertas.ts";
import {
  indicadoresDoMonitoramento,
  vagasEfetivas,
  vagasSemContratacao,
  ehConcluido,
  temResultado,
} from "../src/lib/visao-geral/indicadores-do-monitoramento.ts";
import {
  CHAVE_DO_MAPA_RECOLHIDO,
  lerMapaRecolhido,
  valorDoMapaRecolhido,
} from "../src/lib/mapas/mapa-recolhido.ts";
import { MODULOS_DOS_AVISOS } from "../src/lib/conferencias/avisos-de-conferencia.ts";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.ts";
import { faseDoEdital } from "../src/lib/visao-geral/fases-do-processo.ts";
import {
  contarPorFaixa,
  diasAte,
  faixaDosDias,
  situacaoDoPrazo,
  textoDosDiasRestantes,
} from "../src/lib/base/prazos.ts";
import {
  chaveDoDseiNoEndereco,
  dseiNoEndereco,
  resumoDoMapa,
} from "../src/lib/mapas/mapa-saude-indigena/aba-do-mapa.ts";
import { processosDoDsei } from "../src/lib/mapas/mapa-saude-indigena/processos-do-dsei.ts";
import { chaveDoDsei } from "../src/lib/mapas/mapa-saude-indigena/chaves.ts";
import { origemDoNumero } from "../src/lib/visao-geral/origem-dos-numeros.ts";
import {
  composicaoDaLinha,
  composicaoDoIndicador,
} from "../src/lib/visao-geral/composicao-dos-numeros.ts";
import { avisosDoEdital } from "../src/lib/visao-geral/avisos-do-edital.ts";
import {
  colunasDoPreset,
  PRESETS_DE_COLUNAS,
  presetDasColunas,
} from "../src/lib/visao-geral/presets-de-colunas.ts";
import { COLUNAS_PADRAO } from "../src/lib/visao-geral/visao-geral.ts";

bloco("arredondamento-dos-percentuais", () => {
  /*
  Auditoria dos cálculos (10/11/2026): dividir antes de multiplicar deixava o
  meio abaixo de .5 por causa da vírgula flutuante (29/200 dava 14%, 201/400
  dava 50,2%), e uma taxa de conclusão de 995/1.000 aparecia como 100% com
  itens pendentes.
*/
  describe("arredondamento dos percentuais", () => {
    it("a taxa da Seleção arredonda o meio para cima", () => {
      expect(formatarTaxa(201 / 400)).toBe("50,3%");
      expect(formatarTaxa(1 / 3)).toBe("33,3%");
      expect(formatarTaxa(0.25)).toBe("25%");
    });

    it("a conclusão das análises só chega a 100% sem pendência", () => {
      const linhas = (aprovadas: number, pendentes: number) => [
        ...Array.from({ length: aprovadas }, () => ({
          status_consolidado: "Aprovado",
        })),
        ...Array.from({ length: pendentes }, () => ({
          status_consolidado: "Pendente",
        })),
      ];
      expect(calcularKpis(linhas(995, 5)).taxa).toBe(99);
      expect(calcularKpis(linhas(1000, 0)).taxa).toBe(100);
      expect(calcularKpis(linhas(29, 171)).taxa).toBe(15);
    });
  });

  describe("Aptos na análise e eliminados", () => {
    const vaga = (parcial: Partial<VagaDaSelecao>): VagaDaSelecao => ({
      id: "1",
      edital_id: 1,
      edital: "01/2026",
      edital_planilha: "01/2026",
      unidade: "DSEI X",
      vaga: null,
      vagaPlanilha: "",
      cargo: "Enfermeiro",
      observacao: null,
      origemConvocados: "planilha",
      busca: "",
      inscritos: null,
      aptos: null,
      cancelados: null,
      reprovadosQuestionario: null,
      eliminadosNota: null,
      reprovadosAnalise: null,
      triados: null,
      totalEliminados: null,
      convocados: null,
      aprovados: null,
      contratados: null,
      naoContratados: null,
      ...parcial,
    });

    it("eliminados é a soma de cancelados, questionário e nota, não a coluna da planilha", () => {
      // A coluna da planilha já soma os 40 reprovados na análise.
      const vagas = [
        vaga({
          aptos: 100,
          cancelados: 5,
          reprovadosQuestionario: 10,
          eliminadosNota: 15,
          reprovadosAnalise: 40,
          totalEliminados: 70,
        }),
      ];
      expect(aptosEEliminados(vagas).map((x) => x.valor)).toEqual([100, 30]);
    });
  });
});

bloco("lib/aba-do-mapa", () => {
  /*
    A aba Mapa (src/lib/mapas/mapa-saude-indigena/aba-do-mapa.ts): o DSEI no
    endereço vai e volta pela mesma chave do mapa, e o cartão da Visão geral
    resume o mapa com as contas das bolhas. Dados fictícios.
  */

  const edital = (
    unidade: string,
    vagas_total: number,
    contratados: number,
    status = "Concluído",
  ): LinhaDoMonitoramento => ({ unidade, vagas_total, contratados, status });

  describe("o DSEI no endereço", () => {
    it("vira um pedaço de endereço legível", () => {
      expect(dseiNoEndereco("DSEI Yanomami")).toBe("yanomami");
      expect(dseiNoEndereco("Alto Rio Negro")).toBe("alto-rio-negro");
      expect(dseiNoEndereco("Médio Rio Solimões e Afluentes")).toBe(
        "medio-rio-solimoes-afluentes",
      );
      expect(dseiNoEndereco("DSEI Guamá-Tocantins")).toBe("guama-tocantins");
      expect(dseiNoEndereco("")).toBe("");
    });

    it("volta à chave do mapa (a mesma de `chaveDoDsei`)", () => {
      for (const nome of [
        "DSEI Yanomami",
        "DSEI Kaiapó do Mato Grosso",
        "Médio Rio Solimões e Afluentes",
        "DSEI Guamá-Tocantins",
      ])
        expect(chaveDoDseiNoEndereco(dseiNoEndereco(nome))).toBe(
          chaveDoDsei(nome),
        );
      expect(chaveDoDseiNoEndereco("")).toBe("");
    });
  });

  describe("o cartão do mapa na Visão geral", () => {
    it("conta os DSEIs com edital e acha o de mais ociosas e o menos preenchido", () => {
      const resumo = resumoDoMapa([
        edital("DSEI Yanomami", 20, 5),
        edital("DSEI Yanomami", 10, 10),
        edital("DSEI Ceará", 10, 9),
        edital("DSEI Xingu", 4, 1),
        // Em seleção: conta como edital, mas as vagas ainda não são ociosas.
        edital("DSEI Altamira", 8, 0, "Em andamento"),
        // CASAI nacional não é um dos 34 DSEIs.
        edital("CASAI Nacional Brasília", 5, 0),
      ]);
      expect(resumo.comEdital).toBe(4);
      expect(resumo.total).toBe(34);
      expect(resumo.maisOciosas).toEqual({
        nome: "Yanomami",
        endereco: "yanomami",
        valor: 15,
      });
      // Altamira: 0% preenchido (em seleção) é o menos preenchido.
      expect(resumo.menosPreenchido).toEqual({
        nome: "Altamira",
        endereco: "altamira",
        valor: 0,
      });
    });

    it("sem editais, nenhum destaque", () => {
      expect(resumoDoMapa([])).toEqual({
        comEdital: 0,
        total: 34,
        maisOciosas: null,
        menosPreenchido: null,
      });
    });

    it("empate vai pelo nome", () => {
      const resumo = resumoDoMapa([
        edital("DSEI Xingu", 10, 5),
        edital("DSEI Bahia", 10, 5),
      ]);
      expect(resumo.maisOciosas?.nome).toBe("Bahia");
      expect(resumo.menosPreenchido?.nome).toBe("Bahia");
    });
  });
});

bloco("lib/processos-do-dsei", () => {
  /*
    O cartão "Processos seletivos" do DSEI no Mapa
    (src/lib/mapas/mapa-saude-indigena/processos-do-dsei.ts): as contas da
    Visão geral só com as linhas do distrito. Dados fictícios.
  */
  const linha = (
    unidade: string,
    campos: Record<string, unknown>,
  ): LinhaDoMonitoramento => ({ unidade, ...campos });

  const LINHAS = [
    linha("DSEI Yanomami", {
      vagas_total: 10,
      contratados: 6,
      status: "Concluído",
      cadastro_reserva: 3,
    }),
    linha("Yanomami", {
      vagas_total: 5,
      contratados: 1,
      status: "Em andamento",
      fase: "Inscrições",
      cadastro_reserva: null,
    }),
    linha("DSEI Yanomami", {
      vagas_total: 8,
      contratados: 0,
      status: "Cancelado",
      cadastro_reserva: 4,
    }),
    linha("DSEI Xingu", {
      vagas_total: 20,
      contratados: 0,
      status: "Concluído",
    }),
  ];

  it("conta só o DSEI, pelas contas da Visão geral", () => {
    const p = processosDoDsei(LINHAS, "YANOMAMI");
    expect(p.indicadores.processos).toBe(3);
    expect(p.editaisAbertos).toBe(1);
    // O cancelado não entra nas vagas.
    expect(p.indicadores.vagas).toBe(15);
    expect(p.indicadores.contratadas).toBe(7);
    expect(p.indicadores.ociosas).toBe(4);
    expect(p.indicadores.emSelecao).toBe(4);
    expect(
      p.indicadores.contratadas +
        p.indicadores.emSelecao +
        p.indicadores.ociosas,
    ).toBe(p.indicadores.vagas);
  });

  it("aguardando chamada soma só os editais com lista e não cancelados", () => {
    expect(processosDoDsei(LINHAS, "Yanomami").aguardandoChamada).toBe(3);
    // Nenhum edital com lista: dado ausente, não zero.
    expect(processosDoDsei(LINHAS, "Xingu").aguardandoChamada).toBeNull();
  });

  it("devolve as unidades do DSEI para o filtro Unidade da Visão geral", () => {
    expect(processosDoDsei(LINHAS, "DSEI Yanomami").unidades).toEqual([
      "DSEI Yanomami",
      "Yanomami",
    ]);
  });

  it("DSEI sem edital ou vazio fica zerado", () => {
    const p = processosDoDsei(LINHAS, "Alto Rio Negro");
    expect(p.indicadores.processos).toBe(0);
    expect(p.unidades).toEqual([]);
    expect(processosDoDsei(null, "").editaisAbertos).toBe(0);
  });
});

bloco("lib/fundamento-da-eliminacao", () => {
  /*
  Issue #593: o fundamento normativo das eliminações da Triagem só entra no
  comunicado quando conferido por quem tem a autoridade (banco), nunca presumido.
  Dados fictícios.
*/

  const CONFERIDO = {
    situacao: "CONFERIDO",
    item_edital: "6.4",
    versao_regra: 2,
    fonte: "Edital de exemplo nº 1/2099, texto publicado",
    conferido_em: "2099-01-02T10:00:00Z",
  };

  describe("motivos administrativos × fora do lote pela nota", () => {
    it("QUESTIONARIO, CANCELADO e REPROVADO_EMPREGARE são administrativos; os demais não", () => {
      for (const m of ["QUESTIONARIO", "CANCELADO", "REPROVADO_EMPREGARE"])
        expect(ehEliminacaoAdministrativa(m)).toBe(true);
      for (const m of ["TERMO", "SAIU_DA_EMPREGARE", "", null])
        expect(ehEliminacaoAdministrativa(m)).toBe(false);
    });

    it("separa eliminado administrativo, outro eliminado, fora do lote pela nota e no lote", () => {
      expect(
        categoriaNaTriagem({
          situacao: "ELIMINADO",
          motivo_codigo: "CANCELADO",
        }),
      ).toBe("ELIMINADO_ADMINISTRATIVO");
      expect(
        categoriaNaTriagem({ situacao: "ELIMINADO", motivo_codigo: "TERMO" }),
      ).toBe("ELIMINADO");
      expect(
        categoriaNaTriagem({ situacao: "RANQUEADO", motivo_codigo: null }),
      ).toBe("FORA_DO_LOTE_POR_NOTA");
      expect(categoriaNaTriagem({ situacao: "NO_LOTE" })).toBe("NO_LOTE");
    });
  });

  describe("fundamento do banco", () => {
    it("lê o conferido e recusa o malformado", () => {
      expect(fundamentoDoBanco(CONFERIDO)).toEqual(CONFERIDO);
      expect(fundamentoDoBanco(null)).toBeNull();
      expect(
        fundamentoDoBanco({ ...CONFERIDO, item_edital: "item 6" }),
      ).toBeNull();
      expect(
        fundamentoDoBanco({ ...CONFERIDO, situacao: "PRESUMIDO" }),
      ).toBeNull();
      expect(fundamentoDoBanco({ ...CONFERIDO, versao_regra: "2" })).toBeNull();
    });

    it("só o CONFERIDO vira linha do comunicado", () => {
      expect(
        fundamentoDoComunicado({ ...CONFERIDO, situacao: "RECONFERIR" }),
      ).toBeNull();
      expect(linhaDoFundamento(CONFERIDO)).toBe(
        "Fundamento normativo: item 6.4 do edital (conferido pela gestão do edital na regra da triagem, versão 2).",
      );
      expect(linhaDoFundamento(undefined)).toBeNull();
    });
  });

  describe("até o PDF do comunicado", () => {
    const eliminado = {
      vaga: "101",
      codigo: "9001",
      nome: "Candidato Fictício",
      situacao: "ELIMINADO",
      motivo: "Não finalizou o questionário",
      motivo_codigo: "QUESTIONARIO",
      art: 0,
      declarada: 0,
    };
    const pessoa = {
      chave: "101|9001",
      codigo: "9001",
      nome: "Candidato Fictício",
      vaga: "101",
      detalhe: "",
    };

    it("o lote leva o fundamento conferido ao comunicado e não mostra notas administrativas", () => {
      const { documentos } = comunicadosDosEliminados(
        [{ ...eliminado, fundamento: CONFERIDO }],
        [{ codigo: "101", cargo: "Enfermeiro(a)" }],
        [pessoa],
        { edital: "Edital 1/2099" },
      );
      expect(documentos[0]?.justificativas).toEqual([
        "Não finalizou o questionário",
        "Fundamento normativo: item 6.4 do edital (conferido pela gestão do edital na regra da triagem, versão 2).",
      ]);
      expect(documentos[0]?.notas.map((n) => n.rotulo)).toEqual([
        "Nota da análise documental",
      ]);
    });

    it("sem fundamento conferido, o comunicado sai só com o motivo (nada presumido)", () => {
      for (const fundamento of [
        null,
        { ...CONFERIDO, situacao: "RECONFERIR" },
      ]) {
        const e = espelhoDaEliminacaoPreAnalise({
          ...eliminado,
          edital: "Edital 1/2099",
          fundamento,
        });
        expect(e.justificativas).toEqual(["Não finalizou o questionário"]);
        expect(e.justificativas.join(" ")).not.toMatch(/8\.2\.6/);
      }
    });
  });

  describe("quadro dos fundamentos", () => {
    it("normaliza o que o banco devolve", () => {
      const q = quadroDosFundamentos({
        pode_conferir: true,
        regra: { versao: 2, situacao: "CONFERIDA", item_da_nota: "8.2.6" },
        motivos: [
          {
            codigo: "QUESTIONARIO",
            motivo: "Não finalizou",
            item_na_regra: null,
            eliminados: 3,
            fundamento: CONFERIDO,
          },
          {
            codigo: "TERMO",
            motivo: "Recusou",
            item_na_regra: "5.7.5",
            eliminados: 0,
            fundamento: null,
          },
          { codigo: "" },
        ],
        fora_da_regra: [
          { codigo: "SAIU_DA_EMPREGARE", motivo: "Saiu", eliminados: 1 },
        ],
        fora_do_lote_por_nota: 7,
        historico: [
          {
            id: 1,
            motivo_codigo: "QUESTIONARIO",
            item_edital: "6.4",
            versao_regra: 2,
            fonte: "x",
            papel: "COORDENADOR",
            por: "Pessoa",
            em: "2099-01-02T10:00:00Z",
          },
        ],
      });
      expect(q.podeConferir).toBe(true);
      expect(q.regra).toEqual({
        versao: 2,
        situacao: "CONFERIDA",
        itemDaNota: "8.2.6",
      });
      expect(
        q.motivos.map((m) => [
          m.codigo,
          m.administrativo,
          m.fundamento?.item_edital ?? null,
        ]),
      ).toEqual([
        ["QUESTIONARIO", true, "6.4"],
        ["TERMO", false, null],
      ]);
      expect(q.foraDaRegra).toHaveLength(1);
      expect(q.foraDoLotePorNota).toBe(7);
      expect(q.historico[0]?.papel).toBe("COORDENADOR");
    });

    it("resposta vazia ou estranha não inventa permissão nem fundamento", () => {
      const q = quadroDosFundamentos(null);
      expect(q).toEqual({
        podeConferir: false,
        regra: null,
        motivos: [],
        foraDaRegra: [],
        foraDoLotePorNota: 0,
        historico: [],
      });
    });
  });

  describe("conferência do formulário (igual à do banco)", () => {
    const base = {
      item: "6.4",
      fonte: "Edital nº 1/2099 publicado",
      justificativa: "",
    };

    it("aceita item e fonte válidos sem conferência anterior", () => {
      expect(
        conferirEntrada(base, { anterior: null, itemDaNota: "8.2.6" }),
      ).toEqual({
        erros: {},
        exigeJustificativa: [],
      });
    });

    it("recusa item fora do formato e fonte curta", () => {
      const { erros } = conferirEntrada(
        { item: "item 6", fonte: "edital", justificativa: "" },
        { anterior: null, itemDaNota: null },
      );
      expect(Object.keys(erros).sort()).toEqual(["fonte", "item"]);
    });

    it("o item da nota mínima do lote pede justificativa", () => {
      const r = conferirEntrada(
        { ...base, item: "8.2.6" },
        { anterior: null, itemDaNota: "8.2.6" },
      );
      expect(r.exigeJustificativa).toEqual(["ITEM_DA_NOTA"]);
      expect(r.erros.justificativa).toMatch(/nota mínima do lote/);
    });

    it("retificar (item ou fonte diferentes) pede justificativa; repetir, não", () => {
      const anterior = { item_edital: "6.4", fonte: base.fonte };
      expect(
        conferirEntrada(base, { anterior, itemDaNota: null })
          .exigeJustificativa,
      ).toEqual([]);
      const r = conferirEntrada(
        { ...base, item: "6.5" },
        { anterior, itemDaNota: null },
      );
      expect(r.exigeJustificativa).toEqual(["RETIFICACAO"]);
      expect(r.erros.justificativa).toMatch(/retificação/);
      expect(
        conferirEntrada(
          {
            ...base,
            item: "6.5",
            justificativa: "Conferido de novo no texto publicado",
          },
          { anterior, itemDaNota: null },
        ).erros,
      ).toEqual({});
    });
  });
});

bloco("lib/importacao-da-planilha", () => {
  /*
  A importação da avaliação da planilha (fase F8, 16/11/2026): a prévia que a
  coordenação vê e a marca da ficha importada. O banco faz a importação
  (20261116233000_importar_avaliacao_da_planilha; o ensaio confere o 93/2026).
*/

  describe("prévia da importação", () => {
    it("o 93/2026: 60 aprovados e 34 reprovados, 2 fichas saem do lote", () => {
      const r = resumoDaImportacao(
        normalizarPrevia({
          aprovados: 60,
          reprovados: 34,
          em_aberto: 0,
          saem_do_lote: 2,
          analista_sem_cadastro: 0,
          problemas: {},
          origem: "PLANILHA",
        }),
      );
      expect(r).toEqual({
        importa: true,
        pode: true,
        linhas: [
          "60 aprovados e 34 reprovados viram fichas concluídas, com o resultado, a nota, o parecer e a data da planilha.",
          "2 fichas sem análise na planilha saem do lote.",
        ],
        problemas: [],
      });
    });

    it("problema trava a importação e diz o que resolver, no singular e no plural", () => {
      const r = resumoDaImportacao(
        normalizarPrevia({
          aprovados: 1,
          reprovados: 0,
          problemas: { EM_REVISAO: 1, SEM_PARECER: 3, NOVO: 2 },
        }),
      );
      expect(r.importa).toBe(true);
      expect(r.pode).toBe(false);
      expect(r.linhas[0]).toBe(
        "1 aprovado e 0 reprovados viram fichas concluídas, com o resultado, a nota, o parecer e a data da planilha.",
      );
      expect(r.problemas).toEqual([
        "1 análise em revisão na planilha (termine a revisão lá)",
        "3 análises decididas sem parecer",
        "2 casos que impedem (NOVO)",
      ]);
    });

    it("sem análise decidida na planilha, a troca é a simples", () => {
      const r = resumoDaImportacao(normalizarPrevia({ em_aberto: 5 }));
      expect(r.importa).toBe(false);
      expect(r.pode).toBe(false);
    });

    it("resposta vazia ou estranha vira zeros", () => {
      expect(normalizarPrevia(null)).toEqual({
        aprovados: 0,
        reprovados: 0,
        em_aberto: 0,
        saem_do_lote: 0,
        analista_sem_cadastro: 0,
        problemas: {},
        origem: "PLANILHA",
      });
      expect(
        normalizarPrevia({ aprovados: "x", problemas: { A: 0, B: -1, C: 2 } })
          .problemas,
      ).toEqual({ C: 2 });
    });

    it("analista sem cadastro e análise em aberto aparecem na prévia", () => {
      const r = resumoDaImportacao(
        normalizarPrevia({
          aprovados: 2,
          reprovados: 1,
          analista_sem_cadastro: 1,
          em_aberto: 3,
        }),
      );
      expect(r.linhas).toContain(
        "1 análise tem analista sem cadastro no Yeendé: a ficha fica em nome de quem importa, e o nome da planilha continua no painel.",
      );
      expect(r.linhas).toContain("3 análises em aberto continuam na fila.");
    });
  });

  describe("marca da ficha importada", () => {
    const lancamento = {
      importada_da_planilha: {
        linha: "6c0d…",
        versao: 3,
        em: "2026-11-16T23:40:00+00:00",
        status: "Aprovado",
        responsavel: "Ana Analista",
        data: "2026-10-06",
        nota_final: 52.5,
        parciais: { FORMACAO: 20, EXPERIENCIA: 32.5, CURSOS: null },
        modalidade: "Ampla concorrência",
        link_pdf: "https://drive.google.com/x",
      },
    };

    it("lê a marca e as parciais na ordem da nota", () => {
      const m = marcaDaImportacao(lancamento)!;
      expect(m).toMatchObject({
        status: "Aprovado",
        responsavel: "Ana Analista",
        data: "2026-10-06",
        nota: 52.5,
        modalidade: "Ampla concorrência",
        link: "https://drive.google.com/x",
      });
      expect(parciaisDaMarca(m)).toEqual([
        { codigo: "FORMACAO", rotulo: "Escolaridade", valor: "20,00" },
        {
          codigo: "EXPERIENCIA",
          rotulo: "Experiência profissional",
          valor: "32,50",
        },
      ]);
    });

    it("ficha comum não tem marca; link que não é https não vira botão", () => {
      expect(marcaDaImportacao({ blocos: {} })).toBeNull();
      expect(marcaDaImportacao(null)).toBeNull();
      expect(marcaDaImportacao({ importada_da_planilha: [] })).toBeNull();
      expect(
        marcaDaImportacao({
          importada_da_planilha: { link_pdf: "javascript:alert(1)" },
        })!.link,
      ).toBe("");
    });

    it("reaberta, a marca não volta a ser gravada (o lançamento inicial a tira)", () => {
      expect(semMarcaDaImportacao(lancamento)).toEqual({});
      const comum = { blocos: { A: {} } };
      expect(semMarcaDaImportacao(comum)).toBe(comum);
      const inicial = lancamentoInicial({
        regra: { blocos: [] },
        respostas: {},
        gravado: lancamento as never,
      }) as Record<string, unknown>;
      expect(inicial).not.toHaveProperty("importada_da_planilha");
    });
  });
});

bloco("lib/importacao-xlsx-de-aprovados", () => {
  // Usa streams e arquivos nativos: exercita a leitura real, sem DOM nem rede.

  const cabecalhos = [
    "Código Vaga",
    "Cargo",
    "Classificação Final",
    "Nota",
    "Candidato",
    "Modalidade",
  ];
  const valores = [
    "VG-01",
    "Enfermeiro",
    "1",
    "87,50",
    "Ana & José",
    "Ampla concorrência",
  ];
  type Linha = readonly unknown[];

  const escapar = (v: unknown) =>
    String(v)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll('"', "&quot;");
  const linhaXml = (valores: Linha, numero: number) =>
    `<row r="${numero}">${valores.map((v, i) => `<c r="${String.fromCharCode(65 + i)}${numero}" t="inlineStr"><is><t>${escapar(v)}</t></is></c>`).join("")}</row>`;
  const folha = (linhas: readonly Linha[]) =>
    `<worksheet><sheetData>${linhas.map((v, i) => linhaXml(v, i + 1)).join("")}</sheetData></worksheet>`;
  const esperado = {
    codigo_vaga: "VG-01",
    cargo: "Enfermeiro",
    classificacao: 1,
    nota: 87.5,
    nome: "Ana & José",
    modalidade: "Ampla concorrência",
  };
  const arquivo = (arquivos: readonly ArquivoDoZip[]) =>
    new File([zipSemCompressao(arquivos)], "aprovados.xlsx");
  const planilha = (linhas: readonly Linha[]) =>
    arquivo([{ nome: "xl/worksheets/sheet1.xml", conteudo: folha(linhas) }]);

  // Um ZIP de uma entrada com deflate, independente do descompactador do app.
  function planilhaComDeflate(xml: string) {
    const nome = "xl/worksheets/sheet1.xml";
    const original = zipSemCompressao([{ nome, conteudo: xml }]);
    const tamanhoNome = Buffer.byteLength(nome);
    const tamanhoDados = Buffer.byteLength(xml);
    const inicioCentral = 30 + tamanhoNome + tamanhoDados;
    const local = original.slice(0, 30 + tamanhoNome);
    const dados = deflateRawSync(Buffer.from(xml));
    const central = original.slice(
      inicioCentral,
      inicioCentral + 46 + tamanhoNome,
    );
    const fim = original.slice(-22);
    const vLocal = new DataView(local.buffer);
    vLocal.setUint16(8, 8, true);
    vLocal.setUint32(18, dados.length, true);
    const vCentral = new DataView(central.buffer);
    vCentral.setUint16(10, 8, true);
    vCentral.setUint32(20, dados.length, true);
    new DataView(fim.buffer).setUint32(16, local.length + dados.length, true);
    return new File([local, dados, central, fim], "compactada.xlsx");
  }

  describe("Importação real de XLSX de Aprovados", () => {
    it("normaliza aliases, acentos e espaços dos cabeçalhos", () => {
      expect(normalizeApprovedHeaders(cabecalhos)).toEqual([
        "codigo_vaga",
        "cargo",
        "classificacao",
        "nota",
        "nome",
        "modalidade",
      ]);
      // Um cabeçalho extra não pode resolver uma propriedade herdada do objeto de aliases.
      expect(normalizeApprovedHeaders(["CONSTRUCTOR"])).toEqual([
        "constructor",
      ]);
    });
    it.each(["sem compressão", "deflate"])(
      "lê ZIP %s, XML e nota com vírgula",
      async (tipo) => {
        const linhas = [cabecalhos, valores];
        const f =
          tipo === "deflate"
            ? planilhaComDeflate(folha(linhas))
            : planilha(linhas);
        expect(await readApprovedWorkbook(f)).toEqual([esperado]);
      },
    );
    it("segue o relacionamento para outra folha e lê strings compartilhadas", async () => {
      const todos = [...cabecalhos, ...valores];
      const xml = `<worksheet><sheetData>${[0, 1].map((n) => `<row>${Array.from({ length: 6 }, (_, i) => `<c r="${String.fromCharCode(65 + i)}${n + 1}" t="s"><v>${n * 6 + i}</v></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
      const f = arquivo([
        {
          nome: "xl/workbook.xml",
          conteudo:
            '<workbook><sheets><sheet r:id="rId9"/></sheets></workbook>',
        },
        {
          nome: "xl/_rels/workbook.xml.rels",
          conteudo:
            '<Relationships><Relationship Id="rId9" Target="worksheets/sheet9.xml"/></Relationships>',
        },
        {
          nome: "xl/sharedStrings.xml",
          conteudo: `<sst>${todos.map((v) => `<si><t>${escapar(v)}</t></si>`).join("")}</sst>`,
        },
        { nome: "xl/worksheets/sheet9.xml", conteudo: xml },
      ]);
      expect(await readApprovedWorkbook(f)).toEqual([esperado]);
    });
    it("ignora linha vazia e aceita nota zero sem perder a ordem das pessoas", async () => {
      const segunda = [...valores];
      segunda[3] = "0";
      segunda[4] = "Bia";
      segunda[2] = "2";
      expect(
        await readApprovedWorkbook(
          planilha([cabecalhos, valores, [], segunda]),
        ),
      ).toEqual([
        esperado,
        { ...esperado, classificacao: 2, nota: 0, nome: "Bia" },
      ]);
    });
    it("célula e linha vazias com formatação (`<c …/>`, `<row …/>`) não engolem as vizinhas", async () => {
      // O Excel grava a célula vazia formatada sem fechamento: <c r="A2" s="1"/>.
      const celulas = (numero: number, linha: Linha) =>
        linha
          .map(
            (v, i) =>
              `<c r="${String.fromCharCode(66 + i)}${numero}" t="inlineStr"><is><t>${escapar(v)}</t></is></c>`,
          )
          .join("");
      const xml =
        `<worksheet><sheetData>` +
        `<row r="1"><c r="A1" t="inlineStr"><is><t>Observação</t></is></c>${celulas(1, cabecalhos)}</row>` +
        `<row r="2" spans="1:7" s="1" customFormat="1"/>` +
        `<row r="3"><c r="A3" s="1"/>${celulas(3, valores)}</row>` +
        `</sheetData></worksheet>`;
      const f = arquivo([{ nome: "xl/worksheets/sheet1.xml", conteudo: xml }]);
      expect(await readApprovedWorkbook(f)).toEqual([esperado]);
    });
    it("não entrega lista parcial quando uma linha é inválida", async () => {
      const invalida = [...valores];
      invalida[2] = "0";
      invalida[3] = "-1";
      await expect(
        readApprovedWorkbook(planilha([cabecalhos, valores, invalida])),
      ).rejects.toThrow(/Linha 3:.*classificacao.*nota/);
    });
    it("recusa colunas ausentes e arquivo sem candidatos", async () => {
      await expect(
        readApprovedWorkbook(planilha([cabecalhos.slice(0, -1), valores])),
      ).rejects.toThrow(/Colunas obrigatórias ausentes: modalidade/);
      await expect(
        readApprovedWorkbook(planilha([cabecalhos])),
      ).rejects.toThrow(/Nenhum candidato válido/);
    });
    it("mantém o número da linha e limita a prévia de erros", async () => {
      const invalida = [...valores];
      invalida[3] = "inválida";
      await expect(
        readApprovedWorkbook(
          planilha([cabecalhos, ...Array.from({ length: 14 }, () => invalida)]),
        ),
      ).rejects.toThrow(/Linha 13:.*\n\.\.\. e mais 2 erro\(s\)\./);
      const r = validateApprovedRows([{}, { ...esperado, classificacao: 0 }]);
      expect(r.errors[0]).toMatch(/^Linha 3:/);
    });
    it('tira as aspas da modalidade e separa várias por "; " (como o banco guarda)', async () => {
      for (const [celula, limpa] of [
        ['"Ampla concorrência"', "Ampla concorrência"],
        ["“Ampla Concorrência”", "Ampla Concorrência"],
        ['Ampla Concorrência"', "Ampla Concorrência"],
        [
          '"Ampla concorrência", "Pretos e pardos"',
          "Ampla concorrência; Pretos e pardos",
        ],
        ['"Ampla concorrência" "Indígenas"', "Ampla concorrência; Indígenas"],
        [
          '"Ampla concorrência", "Indígenas", "Pessoas com deficiência (PCD)"',
          "Ampla concorrência; Indígenas; Pessoas com deficiência (PCD)",
        ],
        [
          "Ampla Concorrência; Pretos e Pardos",
          "Ampla Concorrência; Pretos e Pardos",
        ],
        ["  PCD  ", "PCD"],
      ]) {
        expect(limparModalidade(celula)).toBe(limpa);
      }
      const lida = await readApprovedWorkbook(
        planilha([
          cabecalhos,
          [...valores.slice(0, 5), '"Ampla concorrência", "Pretos e pardos"'],
        ]),
      );
      expect(lida[0]?.modalidade).toBe("Ampla concorrência; Pretos e pardos");
      const soAspas = validateApprovedRows([{ ...esperado, modalidade: '""' }]);
      expect(soAspas.rows).toEqual([]);
      expect(soAspas.errors[0]).toMatch(
        /campos obrigatórios vazios: modalidade/,
      );
    });
    /*
    O Excel não grava linha vazia: `<row r="7">` logo depois de `<row r="3">`.
    O erro contava as linhas pela posição no XML e mandava a pessoa corrigir
    a linha 4 quando o problema estava na 7.
  */
    const folhaNumerada = (linhas: readonly (readonly [number, Linha])[]) =>
      arquivo([
        {
          nome: "xl/worksheets/sheet1.xml",
          conteudo: `<worksheet><sheetData>${linhas.map(([n, v]) => linhaXml(v, n)).join("")}</sheetData></worksheet>`,
        },
      ]);

    it("o erro aponta a linha da planilha, mesmo com linhas vazias omitidas", async () => {
      await expect(
        readApprovedWorkbook(
          folhaNumerada([
            [1, cabecalhos],
            [2, valores],
            [3, [...valores.slice(0, 2), "2", ...valores.slice(3)]],
            [7, [...valores.slice(0, 2), "3", "abc", ...valores.slice(4)]],
          ]),
        ),
      ).rejects.toThrow(/^Linha 7: nota deve ser numérica/);
    });

    it("cabeçalho fora da linha 1: lê a lista e numera pela planilha", async () => {
      const xlsx = (nota: string) =>
        folhaNumerada([
          [3, cabecalhos],
          [4, valores],
          [6, [...valores.slice(0, 2), "2", nota, ...valores.slice(4)]],
        ]);
      expect(await readApprovedWorkbook(xlsx("70"))).toEqual([
        esperado,
        { ...esperado, classificacao: 2, nota: 70 },
      ]);
      await expect(readApprovedWorkbook(xlsx("abc"))).rejects.toThrow(
        /^Linha 6: nota deve ser numérica/,
      );
    });

    it("recusa extensão errada e ZIP inválido", async () => {
      await expect(
        readApprovedWorkbook(new File(["x"], "lista.csv")),
      ).rejects.toThrow(/formato .xlsx/);
      await expect(
        readApprovedWorkbook(new File(["zip inválido"], "lista.xlsx")),
      ).rejects.toThrow(/ZIP inválido/);
    });
  });
});

bloco("lib/rotulo-em-linhas", () => {
  describe("rotuloEmLinhas", () => {
    it("quebra entre palavras até a largura", () => {
      expect(rotuloEmLinhas("Questionário não finalizado", 14)).toEqual([
        "Questionário",
        "não finalizado",
      ]);
    });

    it("rótulo curto fica numa linha", () => {
      expect(rotuloEmLinhas("Cancelados")).toEqual(["Cancelados"]);
    });

    it("corta com reticências além do número de linhas", () => {
      expect(
        rotuloEmLinhas("Saúde da Família e Comunidade (Mais Médicos)", 10, 2),
      ).toEqual(["Saúde da", "Família e…"]);
    });

    it("palavra maior que a largura fica inteira", () => {
      expect(rotuloEmLinhas("Interdisciplinaridade", 8)).toEqual([
        "Interdisciplinaridade",
      ]);
    });

    it("vazio ou nulo vira lista vazia", () => {
      expect(rotuloEmLinhas("")).toEqual([]);
      expect(rotuloEmLinhas(null)).toEqual([]);
    });
  });
});

bloco("modulos/avaliacao-documental-voltar-aos-cartoes", () => {
  /*
  Voltar aos cartões (a opção vazia do seletor, ou o Voltar do navegador para
  o endereço sem edital) com um edital ainda abrindo: a leitura dele é
  descartada, e o "carregando" não pode ficar preso — o "Atualizar" do topo
  ficava desativado até abrir outro edital.
*/

  type Resposta = { data: unknown; error: unknown };

  function bancoControlado() {
    const pendentes: { nome: string; responder: (r: Resposta) => void }[] = [];
    const cliente: ClienteDaAvaliacao = {
      rpc: (nome) =>
        new Promise<Resposta>((responder) =>
          pendentes.push({ nome, responder }),
        ),
    };
    return { cliente, pendentes };
  }

  const esperar = () => new Promise((r) => setTimeout(r, 0));

  describe("Avaliação documental: voltar aos cartões com o edital abrindo", () => {
    it("solta o carregando e não deixa dados do edital que saiu", async () => {
      const { cliente, pendentes } = bancoControlado();
      const estado = criarEstadoDaAvaliacao({
        supabase: cliente,
        toast: () => {},
        copias: null,
      });

      const abrindo = estado.escolherEdital("edital-a");
      await esperar();
      expect(estado.obter().carregandoEdital).toBe(true);

      await estado.escolherEdital("");
      expect(estado.obter().editalId).toBe("");
      expect(estado.obter().carregandoEdital).toBe(false);

      // A leitura do edital que saiu chega depois: não muda nada.
      for (const p of pendentes.splice(0))
        p.responder({ data: { regra: null, versao: "1" }, error: null });
      await abrindo;
      await esperar();
      expect(estado.obter()).toMatchObject({
        editalId: "",
        carregandoEdital: false,
        dados: null,
        erroDoEdital: "",
      });
    });
  });
});

bloco("exemplos-das-comemoracoes", () => {
  /*
  O "Testar" de Configurações › Comemorações mostrava no aviso o rótulo da
  configuração ("Marco do ano da área (1.000, 2.500… análises)"); agora
  mostra a frase que a pessoa vai ler, montada pela mesma função do marco.
  As frases dizem o fato com o número: sem exclamação empilhada e sem
  "Obrigado, equipe".
*/
  describe("exemplos das comemorações", () => {
    it("todo marco do catálogo tem uma frase de exemplo, diferente do rótulo", () => {
      for (const marco of CATALOGO_DE_MARCOS) {
        const texto = exemploDoMarco(marco.id, marco.rotulo);
        expect(texto, marco.id).not.toBe(marco.rotulo);
        expect(texto, marco.id).not.toMatch(/undefined|null|NaN|🎉|Obrigado/);
      }
    });

    it("as frases saem das funções de verdade", () => {
      expect(exemploDoMarco("edital-concluido", "")).toBe(
        "Edital 114/2026 (Rio de Janeiro): as 1.512 fichas foram analisadas.",
      );
      expect(exemploDoMarco("edital-fechado", "")).toBe(
        "Você concluiu a última ficha do edital 114/2026.",
      );
      expect(exemploDoMarco("fila-zerada", "")).toBe(
        "Nenhuma ficha pendente na SEDE.",
      );
      expect(exemploDoMarco("vaga-pronta", "")).toBe(
        "Vaga 179698 (Químico): todas as entrevistas têm parecer. Já pode seguir para a Classificação.",
      );
      expect(exemploDoMarco("marco-do-ano", "")).toMatch(
        /^Saúde Indígena: 7\.500 análises concluídas em \d{4}\.$/,
      );
      expect(exemploDoMarco("acesso-liberado", "")).toBe(
        "Boas-vindas, Ana! Seu acesso ao Yeendé foi liberado.",
      );
    });

    it("marco sem exemplo cai no rótulo", () => {
      expect(exemploDoMarco("nao-existe", "Rótulo")).toBe("Rótulo");
    });
  });
});

bloco("app/carga", () => {
  /*
  A carga dos dados (src/app/carga.ts): consultas em paralelo na entrada,
  cópia da sessão, "Atualizar dados" sem tela de carregamento e o Realtime.
  O Supabase, a configuração, os painéis e a navegação são falsos.
*/

  const USUARIO = { id: "u1", email: "ana@agenciasus.org.br" };
  const PERFIL: PerfilDeAcesso = {
    id: "p1",
    ativo: true,
    perfil: "edital_gestor",
  };
  const LINHAS = [{ id: 1, unidade: "DSEI Xingu", CO_AREA: "saude-indigena" }];
  const VERSAO_DAS_LINHAS = "md5-das-linhas";
  const MAPA = [{ chave: "lmap", payload: { dsei: [] } }];
  const VERSAO_DO_MAPA = "md5-do-mapa";

  /* Consulta preguiçosa como a do Supabase: só "sai" quando alguém chama then. */
  type Resposta = { data: unknown; error: unknown };

  function consultaPreguicosa(
    nome: string,
    resposta: () => Resposta,
    registro: string[],
  ) {
    const consulta = {
      nome,
      saiu: false,
      then<R1 = Resposta, R2 = never>(
        resolver?: ((valor: Resposta) => R1 | PromiseLike<R1>) | null,
        rejeitar?: ((motivo: unknown) => R2 | PromiseLike<R2>) | null,
      ): PromiseLike<R1 | R2> {
        if (!consulta.saiu) registro.push(nome);
        consulta.saiu = true;
        return Promise.resolve(resposta()).then(resolver, rejeitar);
      },
    };
    const encadear = () => consulta;
    Object.assign(consulta, {
      select: encadear,
      eq: encadear,
      in: encadear,
      order: encadear,
    });
    return consulta;
  }

  /*
  Quem precisa das linhas (src/componentes/dados-do-monitoramento.ts), falso:
  `pedir()` é a página aberta que as usa; devolve a devolução.
*/
  function pedidosFalsos() {
    const ouvintes = new Set<() => void>();
    let quantos = 0;
    const avisarTodos = () => ouvintes.forEach((ouvinte) => ouvinte());
    return {
      ha: () => quantos > 0,
      assinar(ouvinte: () => void) {
        ouvintes.add(ouvinte);
        return () => ouvintes.delete(ouvinte);
      },
      pedir() {
        quantos += 1;
        avisarTodos();
        let devolvido = false;
        return () => {
          if (devolvido) return;
          devolvido = true;
          quantos -= 1;
          avisarTodos();
        };
      },
    };
  }

  /*
  As dependências falsas têm só o que a carga usa (o cliente do Supabase, a
  navegação e a configuração reais descrevem muito mais). A guarda confere as
  três obrigatórias e devolve o objeto.
*/
  function ehDependencias(deps: object): deps is DependenciasDaCarga {
    return "configuracao" in deps && "paineis" in deps && "navegacao" in deps;
  }
  function comoDependencias(deps: object): DependenciasDaCarga {
    if (!ehDependencias(deps)) throw new TypeError("dependências incompletas");
    return deps;
  }

  type OpcoesDaMontagem = {
    copiaGuardada?: CopiaDaSessao | null;
    erroNasLinhas?: { message: string } | null;
    perfil?: PerfilDeAcesso | null;
    pedindo?: boolean;
    telaDeEntrada?: string;
    semInicio?: boolean;
    agora?: () => number;
  };

  /* Um canal do Realtime falso: `ao` é o aviso de mudança que a carga registrou. */
  type CanalFalso = {
    ao: (() => unknown) | null;
    on(tipo: unknown, filtro: unknown, funcao: () => unknown): CanalFalso;
    subscribe: () => CanalFalso;
  };

  type ArgumentosDoRpc = { p_versao?: unknown };

  function montar({
    copiaGuardada = null,
    erroNasLinhas = null,
    perfil = PERFIL,
    // Por padrão, a página aberta usa as linhas (o comportamento de antes).
    pedindo = true,
    telaDeEntrada = "nucleo",
    // O banco sem obter_inicio_da_sessao (migration ainda não aplicada).
    semInicio = false,
    // O relógio da cópia da sessão; o Realtime usa o falso do vitest (`Date.now`).
    agora = () => 1_000,
  }: OpcoesDaMontagem = {}) {
    const saidas: string[] = [];
    const ordem: unknown[][] = [];
    const respostas: Record<string, unknown[]> = {
      TB_CONFIGURACAO: [{ chave: "app_title", valor: "MONITORA" }],
      TB_PAINEL_EXTERNO: [{ id: "1", codigo: "bi" }],
      TD_UNIDADE: [{ nome_oficial: "DSEI Xingu" }],
    };
    const canais: CanalFalso[] = [];
    const cliente = {
      from: vi.fn((tabela: string) =>
        consultaPreguicosa(
          tabela,
          () => ({ data: respostas[tabela], error: null }),
          saidas,
        ),
      ),
      // O monitoramento vem por RPC com versão (migration 20261013160000).
      rpc: vi.fn(
        async (
          nome: string,
          { p_versao }: ArgumentosDoRpc = {},
        ): Promise<Resposta> => {
          saidas.push(nome);
          // O mapa também (migration 20261015000100).
          if (nome === "listar_mapa_da_saude_indigena")
            return p_versao === VERSAO_DO_MAPA
              ? { data: { inalterado: true, versao: p_versao }, error: null }
              : { data: { versao: VERSAO_DO_MAPA, linhas: MAPA }, error: null };
          // Configuração, painéis, abas, situação e unidades numa chamada (20261029121700).
          if (nome === "obter_inicio_da_sessao")
            return semInicio
              ? { data: null, error: { code: "PGRST202" } }
              : {
                  data: {
                    configuracao: respostas.TB_CONFIGURACAO,
                    paineis: respostas.TB_PAINEL_EXTERNO,
                    unidades: respostas.TD_UNIDADE,
                    abas: null,
                    situacao: null,
                  },
                  error: null,
                };
          if (nome !== "listar_monitoramento_operacional")
            return { data: { resumo: true }, error: null };
          if (erroNasLinhas) return { data: null, error: erroNasLinhas };
          if (p_versao === VERSAO_DAS_LINHAS)
            return {
              data: { inalterado: true, versao: p_versao },
              error: null,
            };
          return {
            data: { versao: VERSAO_DAS_LINHAS, linhas: LINHAS },
            error: null,
          };
        },
      ),
      channel: vi.fn(() => {
        const canal: CanalFalso = {
          ao: null,
          on(_tipo, _filtro, funcao) {
            canal.ao = funcao;
            return canal;
          },
          subscribe: vi.fn(() => canal),
        };
        canais.push(canal);
        return canal;
      }),
      removeChannel: vi.fn(),
    };
    const configuracao = {
      consulta: () => cliente.from("TB_CONFIGURACAO"),
      carregar: vi.fn(async ({ consulta }: OpcoesDaCargaDaConfiguracao) => {
        ordem.push(["config", saidas.length]);
        return definido(await consulta).data;
      }),
      booleano: vi.fn(() => true),
    };
    let liberados = new Set<unknown>(["1"]);
    const paineis = {
      consulta: () => cliente.from("TB_PAINEL_EXTERNO"),
      carregar: vi.fn(async ({ consulta }: { consulta?: ConsultaDaCarga }) => {
        ordem.push(["paineis"]);
        await consulta;
      }),
      completarLiberados: vi.fn(),
      liberados: () => liberados,
      descartarAbertos: vi.fn(),
      podeAbrir: (codigo: string) => codigo === "bi",
      esquecerAtual: vi.fn(),
    };
    let view = "dashboard";
    const irPara = vi.fn((tela: string) => {
      view = tela;
      ordem.push(["irPara", tela]);
    });
    const navegacao = {
      obter: () => ({ view }),
      montarMenu: vi.fn(),
      irPara,
      telaDeEntrada: () => telaDeEntrada,
      telaPermitida: (tela: string) => tela !== "proibida",
      definir: (tela: string) => (view = tela),
      // A entrada abre a tela de entrada; reabrir é a tela de agora de novo.
      abrirEntrada: vi.fn(() => irPara(telaDeEntrada)),
      reabrir: vi.fn(() => irPara(view)),
    };
    const copia = {
      ler: vi.fn(async () => copiaGuardada),
      guardar: vi.fn(async (_copia: CopiaDaSessao) => {}),
      apagar: vi.fn(async () => {}),
      versao: "v1",
    };
    const abas = {
      consulta: () => Promise.resolve({ data: null, error: null }),
      carregar: vi.fn(async (_opcoes: OpcoesDaConsulta) => {}),
    };
    const situacao = {
      consulta: () => Promise.resolve({ data: null, error: null }),
      carregar: vi.fn(async () => {}),
    };
    const esqueleto = {
      esconder: vi.fn(() => ordem.push(["esconder"])),
      marcarAtualizacao: vi.fn(),
    };
    const visaoGeral = { obter: () => ({}), definirDadosDoMapa: vi.fn() };
    const avisar = vi.fn();
    const pedidos = pedidosFalsos();
    if (pedindo) pedidos.pedir();
    const mostrarApp = vi.fn(() => ordem.push(["mostrarApp"]));
    const comemorar = vi.fn(() => ordem.push(["comemorar"]));
    const carga = criarCarga(
      comoDependencias({
        cliente: () => cliente,
        configuracao,
        paineis,
        navegacao,
        obterPerfil: () => perfil,
        obterUsuario: () => USUARIO,
        avisar,
        mostrarApp,
        comemorar,
        copia,
        abas,
        situacao,
        esqueleto,
        visaoGeral,
        pedidos,
        agora,
      }),
    );
    return {
      carga,
      cliente,
      configuracao,
      paineis,
      navegacao,
      copia,
      esqueleto,
      avisar,
      mostrarApp,
      comemorar,
      saidas,
      ordem,
      canais,
      pedidos,
      definirLiberados: (ids: unknown[]) => (liberados = new Set(ids)),
    };
  }

  const esperarTudo = () => new Promise((resolver) => setTimeout(resolver, 0));

  beforeEach(() => redefinirDadosDoMonitoramento());
  afterEach(() => vi.useRealTimers());

  describe("entrada", () => {
    it("dispara todas as consultas antes da primeira espera", async () => {
      const { carga, ordem, saidas } = montar();
      await carga.carregarEntrada();
      // Quando a configuração começou a ser aplicada, o início da sessão (uma
      // chamada para configuração, painéis, abas, situação e unidades) já tinha
      // saído; mapa e monitoramento saem assim que a cópia local é lida.
      expect(
        ordem.find(([etapa]) => etapa === "config")?.[1],
      ).toBeGreaterThanOrEqual(1);
      expect(saidas).toContain("obter_inicio_da_sessao");
      expect(saidas).toContain("listar_monitoramento_operacional");
      expect(saidas).toContain("listar_mapa_da_saude_indigena");
    });

    it("configuração, painéis, abas, situação e unidades: uma chamada, não cinco", async () => {
      const { carga, saidas, cliente } = montar();
      await carga.carregarEntrada();
      await esperarTudo();
      expect(saidas.filter((s) => s === "obter_inicio_da_sessao")).toHaveLength(
        1,
      );
      expect(cliente.from).not.toHaveBeenCalled();
      expect(obterDadosDoMonitoramento().unidades).toHaveLength(1);
      // "Atualizar dados" pergunta de novo (o início usado na entrada foi esquecido).
      await carga.atualizarDados();
      expect(saidas.filter((s) => s === "obter_inicio_da_sessao")).toHaveLength(
        2,
      );
      expect(cliente.from).not.toHaveBeenCalled();
    });

    it("banco sem obter_inicio_da_sessao: as consultas de antes, cada uma uma vez", async () => {
      const { carga, saidas, configuracao } = montar({ semInicio: true });
      await expect(carga.carregarEntrada()).resolves.toBe(true);
      await esperarTudo();
      for (const tabela of [
        "TB_CONFIGURACAO",
        "TB_PAINEL_EXTERNO",
        "TD_UNIDADE",
      ])
        expect(saidas.filter((s) => s === tabela)).toHaveLength(1);
      expect(configuracao.carregar).toHaveBeenCalled();
      expect(obterDadosDoMonitoramento().unidades).toHaveLength(1);
    });

    it("abre o app na tela de entrada, esconde o skeleton e comemora, nessa ordem", async () => {
      const { carga, ordem, navegacao } = montar();
      await expect(carga.carregarEntrada()).resolves.toBe(true);
      const fim = ordem.slice(ordem.findIndex(([e]) => e === "mostrarApp"));
      expect(fim).toEqual([
        ["mostrarApp"],
        ["irPara", "nucleo"],
        ["esconder"],
        ["comemorar"],
      ]);
      expect(navegacao.montarMenu).toHaveBeenCalled();
      expect(obterDadosDoMonitoramento().linhas).toEqual(LINHAS);
      expect(obterDadosDoMonitoramento().unidades).toHaveLength(1);
    });

    it("falha nas linhas do monitoramento avisa uma vez e abre o app mesmo assim", async () => {
      const { carga, mostrarApp, esqueleto, avisar, cliente } = montar({
        erroNasLinhas: { message: "falhou" },
      });
      await expect(carga.carregarEntrada()).resolves.toBe(true);
      expect(mostrarApp).toHaveBeenCalled();
      expect(esqueleto.esconder).toHaveBeenCalled();
      expect(avisar).toHaveBeenCalledWith(
        "Erro ao carregar dados: falhou",
        "error",
      );
      await esperarTudo();
      const leituras = cliente.rpc.mock.calls.filter(
        ([nome]) => nome === "listar_monitoramento_operacional",
      );
      expect(leituras).toHaveLength(1);
    });

    it("lê a cópia junto com o perfil (prepararEntrada) e uma vez só", async () => {
      const { carga, copia } = montar();
      carga.prepararEntrada();
      await carga.carregarEntrada();
      expect(copia.ler).toHaveBeenCalledTimes(1);
    });

    it("depois de abrir, guarda a cópia nova com as consultas reais", async () => {
      const { carga, copia } = montar();
      await carga.carregarEntrada();
      await esperarTudo();
      expect(copia.guardar).toHaveBeenCalledTimes(1);
      const guardada = definido(copia.guardar.mock.calls[0])[0];
      expect(guardada).toMatchObject({ usuarioId: "u1", versao: "v1" });
      expect(guardada.dados.monitoramento).toEqual({
        linhas: LINHAS,
        versao: VERSAO_DAS_LINHAS,
      });
    });

    it("não chama a RPC do payload consolidado (ninguém o lia)", async () => {
      const { carga, cliente } = montar();
      await carga.carregarEntrada();
      await esperarTudo();
      await carga.atualizarDados();
      const nomes = new Set(cliente.rpc.mock.calls.map(([nome]) => nome));
      expect([...nomes].sort()).toEqual([
        "listar_mapa_da_saude_indigena",
        "listar_monitoramento_operacional",
        "obter_inicio_da_sessao",
      ]);
    });

    it("o monitoramento pergunta pela versão que já tem: sem mudança, as linhas ficam", async () => {
      const { carga, cliente } = montar();
      await carga.carregarEntrada();
      await esperarTudo();
      await carga.atualizarDados();
      const pedidos = cliente.rpc.mock.calls.filter(
        ([nome]) => nome === "listar_monitoramento_operacional",
      );
      expect(pedidos.map(([, argumentos]) => argumentos?.p_versao)).toEqual([
        null,
        VERSAO_DAS_LINHAS,
      ]);
      expect(carga.linhas()).toEqual(LINHAS);
    });

    it("o mapa também pergunta pela versão: sem mudança, o mesmo mapa", async () => {
      const { carga, cliente } = montar();
      await carga.carregarEntrada();
      await esperarTudo();
      await carga.atualizarDados();
      const pedidos = cliente.rpc.mock.calls.filter(
        ([nome]) => nome === "listar_mapa_da_saude_indigena",
      );
      expect(pedidos.map(([, argumentos]) => argumentos?.p_versao)).toEqual([
        null,
        VERSAO_DO_MAPA,
      ]);
    });

    it("a cópia guarda a versão do mapa e a próxima entrada a manda", async () => {
      const primeira = montar();
      await primeira.carga.carregarEntrada();
      await esperarTudo();
      const guardada = definido(primeira.copia.guardar.mock.calls[0])[0];
      expect(guardada.dados.mapa).toEqual(MAPA);
      expect(guardada.dados.versaoDoMapa).toBe(VERSAO_DO_MAPA);
      const { carga, cliente } = montar({ copiaGuardada: guardada });
      await carga.carregarEntrada();
      await esperarTudo();
      const pedido = cliente.rpc.mock.calls.find(
        ([nome]) => nome === "listar_mapa_da_saude_indigena",
      );
      expect(pedido?.[1]).toEqual({ p_versao: VERSAO_DO_MAPA });
    });

    it("a cópia da sessão leva a versão das linhas: a entrada não baixa de novo", async () => {
      const dados = {
        config: [{ chave: "app_title", valor: "MONITORA" }],
        paineis: [{ id: "1", codigo: "bi" }],
        mapa: [],
        unidades: [{ nome_oficial: "DSEI Xingu" }],
        abas: null,
        monitoramento: { linhas: LINHAS, versao: VERSAO_DAS_LINHAS },
      };
      const copiaGuardada = montarCopia({
        usuarioId: "u1",
        acesso: assinaturaDoAcesso(PERFIL, ["1"]),
        versao: "v1",
        agora: 500,
        dados,
      });
      const { carga, cliente } = montar({ copiaGuardada });
      await carga.carregarEntrada();
      await esperarTudo();
      const pedido = cliente.rpc.mock.calls.find(
        ([nome]) => nome === "listar_monitoramento_operacional",
      );
      expect(pedido?.[1]).toEqual({ p_versao: VERSAO_DAS_LINHAS });
      expect(carga.linhas()).toEqual(LINHAS);
    });

    it("a cópia que serve abre a tela; a configuração vem dela, não da rede", async () => {
      const dados = {
        config: [{ chave: "app_title", valor: "Da cópia" }],
        paineis: [],
        mapa: [],
        unidades: [],
        abas: null,
        monitoramento: { linhas: LINHAS, versao: undefined },
      };
      const copiaGuardada = montarCopia({
        usuarioId: "u1",
        acesso: assinaturaDoAcesso(PERFIL, ["1"]),
        versao: "v1",
        agora: 500,
        dados,
      });
      const { carga, configuracao } = montar({ copiaGuardada });
      await carga.carregarEntrada();
      expect(
        await definido(configuracao.carregar.mock.calls[0])[0].consulta,
      ).toEqual({
        data: dados.config,
        error: null,
      });
    });

    it("apaga a cópia de outra pessoa", async () => {
      const { carga, copia } = montar({
        copiaGuardada: {
          usuarioId: "outra",
          acesso: undefined,
          versao: undefined,
          guardadaEm: undefined,
          dados: {},
        },
      });
      await carga.carregarEntrada();
      expect(copia.apagar).toHaveBeenCalled();
    });

    it("perfil sem monitoramento: linhas vazias e menu montado", async () => {
      const { carga, navegacao } = montar({
        perfil: { id: "x", ativo: true, permissoes: { recursos: "leitor" } },
      });
      await expect(carga.carregarLinhas()).resolves.toBe(true);
      expect(obterDadosDoMonitoramento().linhas).toEqual([]);
      expect(navegacao.montarMenu).toHaveBeenCalled();
    });
  });

  describe("atualizar dados", () => {
    it("marca a barra, descarta os painéis abertos e reabre a tela atual", async () => {
      const { carga, esqueleto, paineis, navegacao, avisar } = montar();
      navegacao.definir("recursos");
      await expect(carga.atualizarDados()).resolves.toBe(true);
      expect(esqueleto.marcarAtualizacao.mock.calls).toEqual([[true], [false]]);
      expect(paineis.descartarAbertos).toHaveBeenCalled();
      expect(navegacao.irPara).toHaveBeenLastCalledWith("recursos");
      expect(avisar).toHaveBeenCalledWith("Dados atualizados.");
    });

    it("painel que deixou de valer volta à tela de entrada", async () => {
      const { carga, navegacao, paineis } = montar();
      navegacao.definir("panel:sumiu");
      await carga.atualizarDados();
      expect(paineis.esquecerAtual).toHaveBeenCalled();
      expect(navegacao.irPara).toHaveBeenLastCalledWith("nucleo");
    });

    it("desmarca a barra mesmo quando falha, e dois cliques esperam a mesma carga", async () => {
      const { carga, esqueleto, cliente } = montar({
        erroNasLinhas: { message: "x" },
      });
      const [a, b] = [carga.atualizarDados(), carga.atualizarDados()];
      expect(await a).toBe(false);
      expect(await b).toBe(false);
      expect(
        cliente.rpc.mock.calls.filter(
          ([nome]) => nome === "obter_inicio_da_sessao",
        ),
      ).toHaveLength(1);
      expect(esqueleto.marcarAtualizacao).toHaveBeenLastCalledWith(false);
    });
  });

  describe("Realtime do monitoramento", () => {
    it("relê as linhas uma vez por rajada e para ao sair", async () => {
      vi.useFakeTimers();
      const { carga, cliente, canais, avisar } = montar();
      carga.iniciarRealtime();
      carga.iniciarRealtime();
      expect(cliente.channel).toHaveBeenCalledTimes(1);
      definido(definido(canais[0]).ao)();
      definido(definido(canais[0]).ao)();
      await vi.advanceTimersByTimeAsync(800);
      expect(avisar).toHaveBeenCalledWith(
        "Dashboard atualizado automaticamente.",
        "ok",
      );
      expect(
        cliente.rpc.mock.calls.filter(
          ([nome]) => nome === "listar_monitoramento_operacional",
        ),
      ).toHaveLength(1);
      carga.pararRealtime();
      expect(cliente.removeChannel).toHaveBeenCalledWith(canais[0]);
    });

    it("releitura que falha não diz que atualizou (o erro já foi avisado)", async () => {
      vi.useFakeTimers();
      const { carga, canais, avisar } = montar({
        erroNasLinhas: { message: "falhou" },
      });
      carga.iniciarRealtime();
      definido(definido(canais[0]).ao)();
      await vi.advanceTimersByTimeAsync(800);
      expect(avisar).toHaveBeenCalledWith(
        "Erro ao carregar dados: falhou",
        "error",
      );
      expect(avisar).not.toHaveBeenCalledWith(
        "Dashboard atualizado automaticamente.",
        "ok",
      );
    });

    it("releitura que estoura vira aviso de erro, sem rejeição solta", async () => {
      vi.useFakeTimers();
      const { carga, canais, avisar, cliente } = montar();
      carga.iniciarRealtime();
      cliente.rpc.mockImplementation(() => {
        throw new Error("sem rede");
      });
      definido(definido(canais[0]).ao)();
      await vi.advanceTimersByTimeAsync(800);
      expect(avisar).toHaveBeenCalledWith(
        "Erro ao carregar dados: sem rede",
        "error",
      );
      expect(avisar).not.toHaveBeenCalledWith(
        "Dashboard atualizado automaticamente.",
        "ok",
      );
    });

    it("esquecer (saída) fecha o canal e tira as linhas do store; o próximo login assina de novo", async () => {
      const { carga, cliente, canais } = montar();
      await carga.carregarEntrada();
      carga.iniciarRealtime();
      expect(obterDadosDoMonitoramento().linhas).toEqual(LINHAS);

      carga.esquecer();
      expect(cliente.removeChannel).toHaveBeenCalledWith(canais[0]);
      expect(carga.linhas()).toEqual([]);
      expect(obterDadosDoMonitoramento()).toMatchObject({
        linhas: [],
        carregado: false,
      });

      carga.iniciarRealtime();
      // O pedido da página continua: o próximo login assina de novo.
      expect(cliente.channel).toHaveBeenCalledTimes(2);
    });

    it("relê no máximo uma vez por intervalo, sem perder a última mudança", async () => {
      vi.useFakeTimers();
      const { carga, cliente, canais } = montar({ agora: () => Date.now() });
      const leituras = () =>
        cliente.rpc.mock.calls.filter(
          ([nome]) => nome === "listar_monitoramento_operacional",
        ).length;
      carga.iniciarRealtime();
      definido(definido(canais[0]).ao)();
      await vi.advanceTimersByTimeAsync(800);
      expect(leituras()).toBe(1);
      // Escritas seguidas por 20 s: nenhuma releitura antes do intervalo.
      for (let i = 0; i < 20; i += 1) {
        definido(definido(canais[0]).ao)();
        await vi.advanceTimersByTimeAsync(1_000);
      }
      expect(leituras()).toBe(1);
      // A última vira uma releitura só, no fim do intervalo.
      await vi.advanceTimersByTimeAsync(INTERVALO_DO_REALTIME_MS);
      expect(leituras()).toBe(2);
      await vi.advanceTimersByTimeAsync(INTERVALO_DO_REALTIME_MS * 3);
      expect(leituras()).toBe(2);
    });

    it("resposta inalterada não avisa que atualizou", async () => {
      vi.useFakeTimers();
      const { carga, cliente, canais, avisar } = montar({
        agora: () => Date.now(),
      });
      await carga.carregarEntrada();
      carga.iniciarRealtime();
      definido(definido(canais[0]).ao)();
      await vi.advanceTimersByTimeAsync(INTERVALO_DO_REALTIME_MS);
      const leituras = cliente.rpc.mock.calls.filter(
        ([nome]) => nome === "listar_monitoramento_operacional",
      );
      expect(leituras).toHaveLength(2);
      expect(leituras[1]?.[1]).toEqual({ p_versao: VERSAO_DAS_LINHAS });
      expect(avisar).not.toHaveBeenCalledWith(
        "Dashboard atualizado automaticamente.",
        "ok",
      );
    });

    it("a volta do fundo relê com a versão as linhas já lidas", async () => {
      vi.useFakeTimers();
      const { carga, cliente } = montar({ agora: () => Date.now() });
      const leituras = () =>
        cliente.rpc.mock.calls.filter(
          ([nome]) => nome === "listar_monitoramento_operacional",
        );
      await carga.carregarEntrada();
      carga.iniciarRealtime();
      expect(leituras()).toHaveLength(1);
      carga.pararRealtime();
      await vi.advanceTimersByTimeAsync(5 * 60_000);
      carga.retomarRealtime();
      await vi.advanceTimersByTimeAsync(0);
      expect(cliente.channel).toHaveBeenCalledTimes(2);
      expect(leituras()).toHaveLength(2);
      expect(leituras()[1]?.[1]).toEqual({ p_versao: VERSAO_DAS_LINHAS });
    });

    it("a volta do fundo sem linhas lidas não lê nada", async () => {
      const { carga, cliente } = montar({
        pedindo: false,
        telaDeEntrada: "avaliacao-documental",
      });
      await carga.carregarEntrada();
      carga.iniciarRealtime();
      carga.pararRealtime();
      carga.retomarRealtime();
      await esperarTudo();
      expect(
        cliente.rpc.mock.calls.filter(
          ([nome]) => nome === "listar_monitoramento_operacional",
        ),
      ).toHaveLength(0);
    });

    it("desligado na configuração, não assina", () => {
      const { carga, cliente, configuracao } = montar();
      configuracao.booleano.mockReturnValue(false);
      carga.iniciarRealtime();
      expect(cliente.channel).not.toHaveBeenCalled();
    });
  });

  /*
  As linhas sob demanda (19/10/2026: o Supabase NANO saturou com avaliadores
  que nunca abriam uma página com elas). Quem entra numa página sem linhas não
  paga `listar_monitoramento_operacional` nem assina o Realtime.
*/
  describe("linhas do monitoramento sob demanda", () => {
    const RPC = "listar_monitoramento_operacional";
    const pedidosDasLinhas = (cliente: ReturnType<typeof montar>["cliente"]) =>
      cliente.rpc.mock.calls.filter(([nome]) => nome === RPC);
    const COPIA_COM_LINHAS = () =>
      montarCopia({
        usuarioId: "u1",
        acesso: assinaturaDoAcesso(PERFIL, ["1"]),
        versao: "v1",
        agora: 500,
        dados: {
          config: [{ chave: "app_title", valor: "MONITORA" }],
          paineis: [{ id: "1", codigo: "bi" }],
          mapa: MAPA,
          versaoDoMapa: VERSAO_DO_MAPA,
          unidades: [{ nome_oficial: "DSEI Xingu" }],
          abas: null,
          monitoramento: { linhas: LINHAS, versao: VERSAO_DAS_LINHAS },
        },
      });

    it("entrar direto na Avaliação documental não lê as linhas", async () => {
      const { carga, cliente, navegacao, copia } = montar({
        pedindo: false,
        telaDeEntrada: "avaliacao-documental",
      });
      await expect(carga.carregarEntrada()).resolves.toBe(true);
      await esperarTudo();
      expect(navegacao.irPara).toHaveBeenCalledWith("avaliacao-documental");
      expect(pedidosDasLinhas(cliente)).toHaveLength(0);
      expect(obterDadosDoMonitoramento().carregado).toBe(false);
      // A cópia da sessão vai sem linhas (ninguém as leu), e sem quebrar.
      expect(copia.guardar).toHaveBeenCalledTimes(1);
      expect(
        definido(copia.guardar.mock.calls[0])[0].dados.monitoramento,
      ).toBeNull();
    });

    it("a página que usa as linhas, aberta depois, lê uma vez", async () => {
      const { carga, cliente, pedidos } = montar({
        pedindo: false,
        telaDeEntrada: "avaliacao-documental",
      });
      await carga.carregarEntrada();
      const devolver = pedidos.pedir();
      pedidos.pedir();
      await esperarTudo();
      expect(pedidosDasLinhas(cliente)).toHaveLength(1);
      expect(obterDadosDoMonitoramento().linhas).toEqual(LINHAS);
      devolver();
      pedidos.pedir();
      await esperarTudo();
      expect(pedidosDasLinhas(cliente)).toHaveLength(1);
    });

    describe("leitura que falha", () => {
      const avisosDeErro = (avisar: ReturnType<typeof montar>["avisar"]) =>
        avisar.mock.calls.filter(([texto]) =>
          String(texto).startsWith("Erro ao carregar dados"),
        );

      it("dois pedidos juntos: uma chamada, um aviso e o erro guardado para a tela", async () => {
        const { carga, cliente, pedidos, avisar } = montar({
          pedindo: false,
          telaDeEntrada: "avaliacao-documental",
          erroNasLinhas: { message: "falhou" },
        });
        await carga.carregarEntrada();
        pedidos.pedir();
        pedidos.pedir();
        await esperarTudo();
        expect(pedidosDasLinhas(cliente)).toHaveLength(1);
        expect(avisosDeErro(avisar)).toHaveLength(1);
        expect(obterDadosDoMonitoramento().erro).toBe("falhou");
        expect(obterDadosDoMonitoramento().carregado).toBe(false);
      });

      it("pedido novo depois da falha tenta de novo, sem repetir o mesmo aviso", async () => {
        const { carga, cliente, pedidos, avisar } = montar({
          pedindo: false,
          telaDeEntrada: "avaliacao-documental",
          erroNasLinhas: { message: "falhou" },
        });
        await carga.carregarEntrada();
        pedidos.pedir();
        await esperarTudo();
        pedidos.pedir();
        await esperarTudo();
        // Falha transitória não deixa a tela sem nova tentativa...
        expect(pedidosDasLinhas(cliente)).toHaveLength(2);
        // ...e a mesma falha não vira um segundo toast.
        expect(avisosDeErro(avisar)).toHaveLength(1);
      });
    });

    it("antes da entrada terminar, o pedido espera (não lê fora da sessão)", async () => {
      const { carga, cliente, pedidos } = montar({
        pedindo: false,
        telaDeEntrada: "avaliacao-documental",
      });
      pedidos.pedir();
      await esperarTudo();
      expect(pedidosDasLinhas(cliente)).toHaveLength(0);
      await carga.carregarEntrada();
      await esperarTudo();
      // O pedido que já estava (da página da sessão anterior) vale na entrada.
      expect(pedidosDasLinhas(cliente)).toHaveLength(1);
    });

    it("com a cópia da sessão, a página pinta pelas linhas dela e pergunta pela versão", async () => {
      const { carga, cliente, pedidos, copia } = montar({
        pedindo: false,
        telaDeEntrada: "avaliacao-documental",
        copiaGuardada: COPIA_COM_LINHAS(),
      });
      await carga.carregarEntrada();
      await esperarTudo();
      expect(pedidosDasLinhas(cliente)).toHaveLength(0);
      // A cópia nova não perde as linhas (nem a versão) da anterior.
      expect(
        definido(copia.guardar.mock.calls[0])[0].dados.monitoramento,
      ).toEqual({
        linhas: LINHAS,
        versao: VERSAO_DAS_LINHAS,
      });
      let responder: (() => void) | undefined;
      cliente.rpc.mockImplementationOnce(
        (_nome, argumentos) =>
          new Promise<Resposta>((resolver) => {
            responder = () =>
              resolver({
                data: {
                  inalterado: true,
                  versao: definido(argumentos).p_versao,
                },
                error: null,
              });
          }),
      );
      pedidos.pedir();
      await esperarTudo();
      // Pintou pela cópia antes de o banco responder.
      expect(obterDadosDoMonitoramento()).toMatchObject({
        linhas: LINHAS,
        carregado: true,
      });
      expect(pedidosDasLinhas(cliente)[0]?.[1]).toEqual({
        p_versao: VERSAO_DAS_LINHAS,
      });
      definido(responder)();
      await esperarTudo();
      expect(carga.linhas()).toEqual(LINHAS);
    });

    it('"Atualizar dados" sem página com linhas não as lê', async () => {
      const { carga, cliente } = montar({
        pedindo: false,
        telaDeEntrada: "avaliacao-documental",
      });
      await carga.carregarEntrada();
      await expect(carga.atualizarDados()).resolves.toBe(true);
      expect(pedidosDasLinhas(cliente)).toHaveLength(0);
    });

    it("sem ninguém usando as linhas, o Realtime nem assina", async () => {
      const { carga, cliente, pedidos } = montar({
        pedindo: false,
        telaDeEntrada: "avaliacao-documental",
      });
      await carga.carregarEntrada();
      carga.iniciarRealtime();
      expect(cliente.channel).not.toHaveBeenCalled();
      // Abriu uma página com linhas: assina.
      pedidos.pedir();
      await esperarTudo();
      expect(cliente.channel).toHaveBeenCalledTimes(1);
    });

    it("mudança com a pessoa em outra página só marca desatualizadas; a volta relê uma vez", async () => {
      vi.useFakeTimers();
      const { carga, cliente, canais, pedidos, avisar } = montar({
        pedindo: false,
        telaDeEntrada: "avaliacao-documental",
      });
      await carga.carregarEntrada();
      carga.iniciarRealtime();
      const devolver = pedidos.pedir();
      await vi.advanceTimersByTimeAsync(0);
      expect(pedidosDasLinhas(cliente)).toHaveLength(1);
      devolver();
      // O canal fica (as linhas foram lidas), mas a rajada não relê ninguém.
      expect(cliente.removeChannel).not.toHaveBeenCalled();
      definido(definido(canais[0]).ao)();
      definido(definido(canais[0]).ao)();
      await vi.advanceTimersByTimeAsync(INTERVALO_DO_REALTIME_MS);
      expect(pedidosDasLinhas(cliente)).toHaveLength(1);
      expect(avisar).not.toHaveBeenCalledWith(
        "Dashboard atualizado automaticamente.",
        "ok",
      );
      pedidos.pedir();
      pedidos.pedir();
      await vi.advanceTimersByTimeAsync(0);
      expect(pedidosDasLinhas(cliente)).toHaveLength(2);
      expect(pedidosDasLinhas(cliente)[1]?.[1]).toEqual({
        p_versao: VERSAO_DAS_LINHAS,
      });
    });

    it("sair fecha o canal e esquece as linhas; a próxima sessão começa sem elas", async () => {
      const { carga, cliente, pedidos } = montar({
        pedindo: false,
        telaDeEntrada: "avaliacao-documental",
      });
      await carga.carregarEntrada();
      carga.iniciarRealtime();
      const devolver = pedidos.pedir();
      await esperarTudo();
      devolver();
      carga.esquecer();
      expect(cliente.removeChannel).toHaveBeenCalledTimes(1);
      await carga.carregarEntrada();
      carga.iniciarRealtime();
      expect(cliente.channel).toHaveBeenCalledTimes(1);
      expect(pedidosDasLinhas(cliente)).toHaveLength(1);
    });
  });

  describe("contratos da carga", () => {
    it("uma leitura só do monitoramento traz o cronograma e a área", () => {
      const colunas = COLUNAS_DO_MONITORAMENTO.split(",");
      for (const coluna of ["cronograma_automatico", "CO_AREA", "link_edital"])
        expect(colunas).toContain(coluna);
    });

    it("sem tela de carregamento (o skeleton e a barra do cabeçalho bastam)", () => {
      const fonte = readFileSync("src/app/carga.ts", "utf8");
      expect(fonte).not.toContain("mostrarCarregamento");
      expect(fonte).not.toContain("loader(");
      expect(fonte).not.toContain("sleep(");
    });
  });
});

bloco("app/inicio-da-sessao", () => {
  type ClienteDoInicio = Pick<SupabaseClient, "rpc">;

  /*
  O cliente só com `rpc`: o início chama `rpc(nome)` e lê `{ data, error }`
  da promessa, sem os filtros do PostgREST que o tipo do Supabase descreve.
*/
  function clienteSoComRpc(
    rpc: (nome: string) => Promise<{ data: unknown; error: unknown }>,
  ): ClienteDoInicio {
    const cliente = { rpc };
    if (!temRpc(cliente)) throw new TypeError("cliente sem rpc");
    return cliente;
  }

  function temRpc(cliente: object): cliente is ClienteDoInicio {
    return "rpc" in cliente && typeof cliente.rpc === "function";
  }

  /*
  O início da sessão numa chamada (src/app/inicio-da-sessao.ts):
  obter_inicio_da_sessao traz configuração, painéis, abas, situação e
  unidades; sem ela, cada parte vai pela consulta de antes, uma vez só.
*/

  const INICIO = {
    configuracao: [{ chave: "app_title", valor: "MONITORA", descricao: null }],
    paineis: [{ id: "1", codigo: "bi" }],
    abas: [{ id: "aprovados" }],
    situacao: { sistema: { ativo: true } },
    unidades: [{ id_unidade: "1", nome_oficial: "DSEI Xingu" }],
  };

  function avulsasFalsas() {
    const avulsa = (nome: string) =>
      vi.fn(async () => ({ data: `avulsa:${nome}`, error: null }));
    return {
      config: avulsa("config"),
      paineis: avulsa("paineis"),
      abas: avulsa("abas"),
      situacao: avulsa("situacao"),
      unidades: avulsa("unidades"),
    };
  }

  describe("parteDoInicio", () => {
    it("lê cada parte pela chave do banco; sem ela, null", () => {
      const resposta = { data: INICIO, error: null };
      expect(parteDoInicio(resposta, "config")).toEqual({
        data: INICIO.configuracao,
        error: null,
      });
      expect(parteDoInicio(resposta, "situacao")?.data).toBe(INICIO.situacao);
      expect(
        parteDoInicio({ data: { paineis: [] }, error: null }, "abas"),
      ).toBeNull();
      expect(
        parteDoInicio({ data: null, error: { code: "PGRST202" } }, "config"),
      ).toBeNull();
      expect(parteDoInicio({ data: [], error: null }, "config")).toBeNull();
    });
  });

  describe("criarInicioDaSessao", () => {
    it("uma chamada para as cinco partes; o pedido feito cedo é reaproveitado", async () => {
      const rpc = vi.fn(async () => ({ data: INICIO, error: null }));
      const inicio = criarInicioDaSessao({
        cliente: () => clienteSoComRpc(rpc),
      });
      void inicio.pedir();
      const config = await inicio.parte("config", vi.fn());
      const avulsas = avulsasFalsas();
      const partes = inicio.partes(avulsas);
      expect(config.data).toBe(INICIO.configuracao);
      expect((await partes.config).data).toBe(INICIO.configuracao);
      expect((await partes.unidades).data).toBe(INICIO.unidades);
      expect((await partes.abas).data).toBe(INICIO.abas);
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith("obter_inicio_da_sessao");
      for (const avulsa of Object.values(avulsas))
        expect(avulsa).not.toHaveBeenCalled();
    });

    it("sem a função no banco: cada parte pela consulta de antes, uma vez só", async () => {
      const rpc = vi.fn(async () => ({
        data: null,
        error: { code: "PGRST202" },
      }));
      const inicio = criarInicioDaSessao({
        cliente: () => clienteSoComRpc(rpc),
      });
      const avulsas = avulsasFalsas();
      await inicio.parte("config", avulsas.config);
      const partes = inicio.partes(avulsas);
      expect((await partes.config).data).toBe("avulsa:config");
      expect((await partes.situacao).data).toBe("avulsa:situacao");
      expect(avulsas.config).toHaveBeenCalledTimes(1);
      expect(avulsas.situacao).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledTimes(1);
    });

    it("rede caída no início e na avulsa: a parte responde com o erro, sem rejeitar", async () => {
      const inicio = criarInicioDaSessao({
        cliente: () =>
          clienteSoComRpc(async () =>
            Promise.reject(new TypeError("Failed to fetch")),
          ),
      });
      const resposta = await inicio.parte("paineis", async () => {
        throw new TypeError("Failed to fetch");
      });
      expect(resposta.data).toBeNull();
      expect(resposta.error).toBeInstanceOf(TypeError);
    });

    it("esquecer: o próximo pedido vai ao banco de novo", async () => {
      const rpc = vi.fn(async () => ({ data: INICIO, error: null }));
      const inicio = criarInicioDaSessao({
        cliente: () => clienteSoComRpc(rpc),
      });
      await inicio.parte("config", vi.fn());
      inicio.esquecer();
      await inicio.parte("config", vi.fn());
      expect(rpc).toHaveBeenCalledTimes(2);
    });
  });

  describe("registro de navegação sem prender a página", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_SUPABASE_URL", "https://exemplo.supabase.co");
      vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "chave-de-teste");
      vi.resetModules();
    });
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
      vi.resetModules();
    });

    it("registrar_navegacao_monitora e registrar_evento_acesso saem com keepalive; o resto, não", async () => {
      const pedidos: { url: string; keepalive: boolean }[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: RequestInfo | URL, opcoes?: RequestInit) => {
          pedidos.push({
            url: String(url),
            keepalive: opcoes?.keepalive === true,
          });
          return new Response("{}", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }),
      );
      const { getSupabaseClient } =
        await import("../src/lib/sessao/supabaseClient");
      const cliente = definido(getSupabaseClient());
      await cliente.rpc("registrar_navegacao_monitora", { p_presenca: true });
      await cliente.rpc("registrar_evento_acesso", { p_evento: "logout" });
      await cliente.rpc("obter_inicio_da_sessao");
      const porRpc = Object.fromEntries(
        pedidos
          .filter((p) => p.url.includes("/rest/v1/rpc/"))
          .map((p) => [p.url.split("/rpc/")[1], p.keepalive]),
      );
      expect(porRpc).toEqual({
        registrar_navegacao_monitora: true,
        registrar_evento_acesso: true,
        obter_inicio_da_sessao: false,
      });
    });
  });
});

bloco("app/pagina-aberta", () => {
  /*
  A página aberta decide o que se carrega (src/app/pagina-aberta.ts): as
  linhas do monitoramento só para as páginas que as usam
  (src/lib/navegacao/telas-com-linhas.ts) e o acompanhamento da Visão geral só com ela
  aberta. Em 19/10/2026 o Supabase NANO saturou com ~10 avaliadores que
  entravam direto na Avaliação documental e, mesmo assim, liam tudo isso.
*/

  /* O aviso da navegação (src/app/navegacao.ts) que a página aberta escuta. */
  type EventoDaNavegacao = { tipo: string; view?: string; anterior?: string };

  function navegacaoFalsa(telaDeEntrada: string) {
    const ouvintes = new Set<(evento: EventoDaNavegacao) => void>();
    let view = "";
    const avisarTodos = (evento: EventoDaNavegacao) =>
      ouvintes.forEach((ouvinte) => ouvinte(evento));
    return {
      obter: () => ({ view }),
      assinar(ouvinte: (evento: EventoDaNavegacao) => void) {
        ouvintes.add(ouvinte);
        return () => ouvintes.delete(ouvinte);
      },
      montarMenu: vi.fn(),
      telaDeEntrada: () => telaDeEntrada,
      telaPermitida: () => true,
      irPara: vi.fn((tela: string) => {
        const anterior = view;
        view = tela;
        avisarTodos({ tipo: "abertura", view: tela, anterior });
      }),
      mostrarAviso(tela: string) {
        view = tela;
        avisarTodos({ tipo: "aviso", view: tela });
      },
      abrirEntrada() {
        return this.irPara(telaDeEntrada);
      },
      reabrir() {
        return this.irPara(view);
      },
    };
  }

  describe("as páginas que usam as linhas", () => {
    it("Visão geral, Mapa, Editais, Cronograma e Lista de aprovados; não a Avaliação documental", () => {
      expect([...TELAS_COM_LINHAS].sort()).toEqual(
        [
          "approved",
          "calendario",
          "dashboard",
          "edital",
          "mapa",
          "nucleo",
        ].sort(),
      );
      for (const view of [
        "avaliacao-documental",
        "analises",
        "recursos",
        "entrevistas",
        "classificacao",
        "selecao",
        "config",
        "panel:bi",
        "",
        null,
      ])
        expect(telaUsaAsLinhas(view)).toBe(false);
    });
  });

  describe("acompanharPaginaAberta", () => {
    function montar() {
      const navegacao = navegacaoFalsa("nucleo");
      const devolver = vi.fn();
      const pedirLinhas = vi.fn(() => devolver);
      const visaoGeral = {
        definirAberta: vi.fn(),
        definirLidaPeloMapa: vi.fn(),
      };
      const parar = acompanharPaginaAberta({
        navegacao,
        pedirLinhas,
        visaoGeral,
      });
      return { navegacao, pedirLinhas, devolver, visaoGeral, parar };
    }

    it("um pedido de linhas enquanto a página aberta as usa; devolve ao sair dela", () => {
      const { navegacao, pedirLinhas, devolver } = montar();
      navegacao.irPara("dashboard");
      navegacao.irPara("nucleo");
      navegacao.irPara("calendario");
      expect(pedirLinhas).toHaveBeenCalledTimes(1);
      expect(devolver).not.toHaveBeenCalled();
      navegacao.irPara("avaliacao-documental");
      expect(devolver).toHaveBeenCalledTimes(1);
      navegacao.irPara("approved");
      expect(pedirLinhas).toHaveBeenCalledTimes(2);
    });

    it("aviso no lugar da página (desligada, manutenção) devolve o pedido", () => {
      const { navegacao, devolver, visaoGeral } = montar();
      navegacao.irPara("dashboard");
      navegacao.mostrarAviso("dashboard");
      expect(devolver).toHaveBeenCalledTimes(1);
      expect(visaoGeral.definirAberta).toHaveBeenLastCalledWith(false);
    });

    it("a Visão geral sabe se está aberta", () => {
      const { navegacao, visaoGeral } = montar();
      navegacao.irPara("dashboard");
      expect(visaoGeral.definirAberta).toHaveBeenLastCalledWith(true);
      navegacao.irPara("nucleo");
      expect(visaoGeral.definirAberta).toHaveBeenLastCalledWith(false);
    });

    it("o Mapa lê o estado da Visão geral sem abri-la", () => {
      const { navegacao, visaoGeral, pedirLinhas } = montar();
      navegacao.irPara("mapa");
      expect(visaoGeral.definirLidaPeloMapa).toHaveBeenLastCalledWith(true);
      expect(visaoGeral.definirAberta).toHaveBeenLastCalledWith(false);
      expect(pedirLinhas).toHaveBeenCalledTimes(1);
      navegacao.irPara("nucleo");
      expect(visaoGeral.definirLidaPeloMapa).toHaveBeenLastCalledWith(false);
    });

    it("parar devolve o pedido e fecha a Visão geral", () => {
      const { navegacao, devolver, visaoGeral, parar } = montar();
      navegacao.irPara("dashboard");
      parar();
      expect(devolver).toHaveBeenCalledTimes(1);
      expect(visaoGeral.definirAberta).toHaveBeenLastCalledWith(false);
      navegacao.irPara("nucleo");
      expect(visaoGeral.definirAberta).toHaveBeenCalledTimes(2);
    });
  });

  /*
  MEDIÇÃO: as chamadas ao banco de quem entra, com cliente falso, na carga de
  verdade (src/app/carga.ts), a página aberta de verdade e o estado da Visão
  geral de verdade (montado escondido, como no app).

  ANTES (main de 19/10/2026), um avaliador entrando direto na Avaliação
  documental fazia 8 chamadas, mais o canal do Realtime: TB_CONFIGURACAO,
  TB_PAINEL_EXTERNO, TD_UNIDADE, listar_mapa_da_saude_indigena,
  listar_abas_do_menu, obter_situacao_do_sistema,
  listar_monitoramento_operacional (~0,8 s) e
  listar_acompanhamento_da_visao_geral_se_mudou (a Visão geral escondida, a
  cada carga das linhas) — e, com as comemorações ligadas, obter_marcos_da_area;
  cada mudança de edital (Realtime) relia as linhas e o acompanhamento.
  DEPOIS: as 6 primeiras e nenhum canal. Fora da carga, as da própria
  Avaliação documental e a presença, iguais nos dois casos.
*/
  /* A resposta do banco, como o Supabase devolve. */
  type Resposta = { data: unknown; error: unknown };

  /*
  As dependências falsas têm só o que a carga usa (o cliente do Supabase, a
  navegação e a configuração reais descrevem muito mais). A guarda confere as
  três obrigatórias e devolve o objeto.
*/
  function ehDependencias(deps: object): deps is DependenciasDaCarga {
    return "configuracao" in deps && "paineis" in deps && "navegacao" in deps;
  }
  function comoDependencias(deps: object): DependenciasDaCarga {
    if (!ehDependencias(deps)) throw new TypeError("dependências incompletas");
    return deps;
  }

  describe("entrada: chamadas ao banco", () => {
    const LINHAS = [
      { id: 1, unidade: "DSEI Xingu", CO_AREA: "saude-indigena" },
    ];
    let carga: ReturnType<typeof criarCarga> | undefined;
    let parar: (() => void) | undefined;

    function montar(telaDeEntrada: string) {
      const chamadas: string[] = [];
      const consulta = (nome: string, data: unknown) => {
        const pedido = {
          then<R1 = Resposta, R2 = never>(
            resolver?: ((valor: Resposta) => R1 | PromiseLike<R1>) | null,
            rejeitar?: ((motivo: unknown) => R2 | PromiseLike<R2>) | null,
          ): PromiseLike<R1 | R2> {
            chamadas.push(nome);
            return Promise.resolve<Resposta>({ data, error: null }).then(
              resolver,
              rejeitar,
            );
          },
        };
        const encadear = () => pedido;
        Object.assign(pedido, {
          select: encadear,
          eq: encadear,
          order: encadear,
        });
        return pedido;
      };
      const cliente = {
        from: (tabela: string) => consulta(tabela, []),
        rpc: vi.fn(async (nome: string, _argumentos?: object) => {
          chamadas.push(nome);
          if (nome === "listar_monitoramento_operacional")
            return { data: { versao: "v", linhas: LINHAS }, error: null };
          if (nome === "listar_mapa_da_saude_indigena")
            return { data: { versao: "m", linhas: [] }, error: null };
          if (nome === "obter_inicio_da_sessao")
            return {
              data: {
                configuracao: [],
                paineis: [],
                abas: null,
                situacao: null,
                unidades: [],
              },
              error: null,
            };
          return { data: null, error: null };
        }),
        channel: vi.fn(() => {
          const canal = { on: () => canal, subscribe: () => canal };
          return canal;
        }),
        removeChannel: vi.fn(),
      };
      const navegacao = navegacaoFalsa(telaDeEntrada);
      const visaoGeral = criarEstadoDaVisaoGeral({
        aberta: false,
        armazenamento: null,
      });
      visaoGeral.definirBuscaDoAcompanhamento(
        buscarAcompanhamentoNoSupabase(cliente),
      );
      parar = acompanharPaginaAberta({ navegacao, visaoGeral });
      carga = criarCarga(
        comoDependencias({
          cliente: () => cliente,
          configuracao: {
            consulta: () => cliente.from("TB_CONFIGURACAO"),
            carregar: async ({ consulta: c }: OpcoesDaCargaDaConfiguracao) =>
              definido(await c).data,
            booleano: () => true,
          },
          paineis: {
            consulta: () => cliente.from("TB_PAINEL_EXTERNO"),
            carregar: async ({ consulta: c }: { consulta?: ConsultaDaCarga }) =>
              c,
            completarLiberados: () => {},
            liberados: () => new Set(),
          },
          navegacao,
          obterPerfil: () => ({
            id: "a",
            ativo: true,
            permissoes: { dashboard: "leitor", avaliacao_documental: "editor" },
          }),
          obterUsuario: () => ({ id: "u-avaliador" }),
          avisar: () => {},
          copia: {
            ler: async () => null,
            guardar: async () => {},
            apagar: async () => {},
            versao: "v1",
          },
          abas: {
            consulta: (sb: typeof cliente) => sb.rpc("listar_abas_do_menu"),
            carregar: async () => {},
          },
          situacao: {
            consulta: (sb: typeof cliente) =>
              sb.rpc("obter_situacao_do_sistema"),
            carregar: async () => {},
          },
          esqueleto: { esconder: () => {}, marcarAtualizacao: () => {} },
          visaoGeral,
        }),
      );
      return { chamadas, cliente, navegacao };
    }

    const esperar = () =>
      new Promise<void>((resolver) => setTimeout(resolver, 0));

    beforeEach(() => redefinirDadosDoMonitoramento());
    afterEach(() => {
      parar?.();
      carga?.esquecer();
      redefinirDadosDoMonitoramento();
    });

    it("avaliador direto na Avaliação documental: 2 chamadas, sem linhas, acompanhamento nem Realtime", async () => {
      const { chamadas, cliente } = montar("avaliacao-documental");
      await definido(carga).carregarEntrada();
      definido(carga).iniciarRealtime();
      await esperar();
      expect([...chamadas].sort()).toEqual(
        // Configuração, painéis, abas, situação e unidades: obter_inicio_da_sessao.
        ["listar_mapa_da_saude_indigena", "obter_inicio_da_sessao"].sort(),
      );
      expect(cliente.channel).not.toHaveBeenCalled();
      expect(linhasPedidas()).toBe(false);
    });

    it("quem entra na Visão geral continua com as linhas e o acompanhamento na entrada", async () => {
      const { chamadas, cliente } = montar("dashboard");
      await definido(carga).carregarEntrada();
      definido(carga).iniciarRealtime();
      await esperar();
      expect(chamadas).toContain("listar_monitoramento_operacional");
      expect(chamadas).toContain(
        "listar_acompanhamento_da_visao_geral_se_mudou",
      );
      expect(
        chamadas.filter((nome) => nome === "listar_monitoramento_operacional"),
      ).toHaveLength(1);
      expect(obterDadosDoMonitoramento().linhas).toEqual(LINHAS);
      expect(cliente.channel).toHaveBeenCalledTimes(1);
    });

    it("quem entra direto no Mapa tem as linhas e o acompanhamento (as mesmas contas da Visão geral)", async () => {
      const { chamadas } = montar("mapa");
      await definido(carga).carregarEntrada();
      await esperar();
      expect(chamadas).toContain("listar_monitoramento_operacional");
      expect(chamadas).toContain(
        "listar_acompanhamento_da_visao_geral_se_mudou",
      );
    });

    it("o avaliador que abre Editais depois lê as linhas uma vez; a Visão geral escondida não pede nada", async () => {
      const { chamadas, navegacao } = montar("avaliacao-documental");
      await definido(carga).carregarEntrada();
      navegacao.irPara("nucleo");
      await esperar();
      expect(
        chamadas.filter((nome) => nome === "listar_monitoramento_operacional"),
      ).toHaveLength(1);
      expect(chamadas).not.toContain(
        "listar_acompanhamento_da_visao_geral_se_mudou",
      );
      navegacao.irPara("avaliacao-documental");
      navegacao.irPara("nucleo");
      await esperar();
      expect(
        chamadas.filter((nome) => nome === "listar_monitoramento_operacional"),
      ).toHaveLength(1);
    });
  });
});

bloco("app/rascunho-da-regra", () => {
  /*
  O rascunho da regra guardado a cada mudança (src/app/rascunho-da-regra.ts):
  gravação com atraso, cópia neste computador sem conexão (e envio quando ela
  volta), recuperar, descartar, versão nova salva e a guarda do app (F5 e
  versão nova do sistema).
*/

  const EDITAL = "e114";
  const USUARIO = "u1";
  const CHAVE = chaveDoRascunhoLocal("ANALISE", EDITAL, USUARIO);

  function memoria() {
    const dados = new Map<string, string>();
    return {
      getItem: (k: string) => dados.get(k) ?? null,
      setItem: (k: string, v: unknown) => dados.set(k, String(v)),
      removeItem: (k: string) => dados.delete(k),
      dados,
    };
  }

  function relogio() {
    let fila: { id: symbol; fn: () => void }[] = [];
    return {
      agendar: (fn: () => void) => {
        const id = Symbol("t");
        fila.push({ id, fn });
        return id;
      },
      cancelar: (id: unknown) => {
        fila = fila.filter((t) => t.id !== id);
      },
      /** Dispara o que estiver agendado (o "1 segundo depois"). */
      passar() {
        const agora = fila;
        fila = [];
        agora.forEach((t) => t.fn());
      },
      get agendados() {
        return fila.length;
      },
    };
  }

  /* O rascunho no banco de mentira (a linha de obter_rascunho_regra). */
  type Guardado = {
    conteudo: unknown;
    versao_base: unknown;
    atualizado_em: string;
  };
  type Ouvinte = EventListenerOrEventListenerObject;

  /* Chama o ouvinte que o código registrou na janela de mentira, como antes. */
  function chamarOuvinte(
    ouvintes: Record<string, Ouvinte | undefined>,
    tipo: string,
    ...argumentos: unknown[]
  ) {
    const ouvinte = definido(ouvintes[tipo], tipo);
    if (typeof ouvinte !== "function")
      throw new TypeError(`ouvinte de ${tipo} não é função`);
    return Reflect.apply(ouvinte, ouvintes, argumentos);
  }

  function criar({
    banco = null,
    rpcFalha = null,
  }: {
    banco?: Guardado | null;
    rpcFalha?: ((nome: string) => unknown) | null;
  } = {}) {
    let guardado: Guardado | null = banco;
    const chamadas: [string, Record<string, unknown>][] = [];
    const rpc = vi.fn(async (nome: string, args: Record<string, unknown>) => {
      chamadas.push([nome, args]);
      const falha = rpcFalha?.(nome);
      if (falha) throw falha;
      if (nome === "obter_rascunho_regra") return guardado;
      if (nome === "salvar_rascunho_regra") {
        guardado = {
          conteudo: args.p_conteudo,
          versao_base: args.p_versao_base,
          atualizado_em: "2026-10-13T17:05:00.000Z",
        };
        return { atualizado_em: guardado.atualizado_em };
      }
      if (nome === "descartar_rascunho_regra") {
        const havia = Boolean(guardado);
        guardado = null;
        return { descartado: havia };
      }
      return null;
    });
    const armazenamento = memoria();
    const r = relogio();
    const ouvintes: Record<string, Ouvinte | undefined> = {};
    const janela = {
      addEventListener: (tipo: string, fn: Ouvinte) => (ouvintes[tipo] = fn),
      removeEventListener: () => {},
    };
    const guarda = criarGuardaDeAlteracoes({ janela });
    const loja = criarRascunhoDaRegra({
      tipo: "ANALISE",
      rpc,
      usuario: async () => USUARIO,
      armazenamento: () => armazenamento,
      agendar: r.agendar,
      cancelar: r.cancelar,
      agora: () => new Date("2026-10-13T17:10:00.000Z"),
      guarda,
      janela,
    });
    return {
      loja,
      rpc,
      chamadas,
      armazenamento,
      relogio: r,
      guarda,
      ouvintes,
      banco: () => guardado,
    };
  }

  const esperar = () => new Promise((resolve) => setTimeout(resolve, 0));
  const nomes = (chamadas: [string, unknown][]) => chamadas.map(([n]) => n);

  describe("abrir e gravar", () => {
    it("sem rascunho: edita; cada mudança grava 1 s depois (só a última)", async () => {
      const { loja, chamadas, relogio: r, banco } = criar();
      await loja.abrir(EDITAL, 2);
      expect(loja.obter().fase).toBe("editando");
      loja.mudar({ regra: { titulo_etapa: "A" } }, true);
      loja.mudar({ regra: { titulo_etapa: "AB" } }, true);
      expect(loja.naoGuardado()).toBe(true);
      expect(nomes(chamadas)).toEqual(["obter_rascunho_regra"]);
      r.passar();
      expect(loja.obter().gravacao).toBe("guardando");
      await esperar();
      expect(banco()).toMatchObject({
        conteudo: { regra: { titulo_etapa: "AB" } },
        versao_base: 2,
      });
      expect(loja.obter()).toMatchObject({
        gravacao: "guardado",
        guardadoEm: "2026-10-13T17:05:00.000Z",
      });
      expect(loja.naoGuardado()).toBe(false);
    });

    it("voltar à versão vigente apaga o guardado", async () => {
      const { loja, relogio: r, banco } = criar();
      await loja.abrir(EDITAL, 2);
      loja.mudar({ regra: { x: 1 } }, true);
      r.passar();
      await esperar();
      expect(banco()).not.toBeNull();
      loja.mudar({ regra: { x: 0 } }, false);
      r.passar();
      await esperar();
      expect(banco()).toBeNull();
      expect(loja.obter().gravacao).toBe("ocioso");
    });

    it("sem conexão: guarda neste computador e manda quando a conexão volta", async () => {
      let fora = true;
      const {
        loja,
        relogio: r,
        armazenamento,
        ouvintes,
        banco,
      } = criar({
        rpcFalha: (nome) =>
          fora && nome === "salvar_rascunho_regra"
            ? new TypeError("Failed to fetch")
            : null,
      });
      await loja.abrir(EDITAL, 2);
      loja.mudar({ regra: { x: 1 } }, true);
      r.passar();
      await esperar();
      expect(loja.obter().gravacao).toBe("local");
      expect(JSON.parse(String(armazenamento.getItem(CHAVE)))).toMatchObject({
        conteudo: { regra: { x: 1 } },
        versao_base: 2,
        local: true,
      });
      expect(loja.naoGuardado()).toBe(false);
      fora = false;
      chamarOuvinte(ouvintes, "online");
      await esperar();
      expect(banco()).toMatchObject({ conteudo: { regra: { x: 1 } } });
      expect(armazenamento.getItem(CHAVE)).toBeNull();
      expect(loja.obter().gravacao).toBe("guardado");
    });

    it("RPC ainda não publicada: guarda neste computador, sem dizer que caiu a conexão", async () => {
      const { loja, relogio: r } = criar({
        rpcFalha: (nome) =>
          nome === "salvar_rascunho_regra"
            ? Object.assign(new Error("not found"), { code: "PGRST202" })
            : null,
      });
      await loja.abrir(EDITAL, 0);
      loja.mudar({ regra: { x: 1 } }, true);
      r.passar();
      await esperar();
      expect(loja.obter().gravacao).toBe("neste-computador");
    });
  });

  describe("recuperar", () => {
    const GUARDADO = {
      conteudo: { regra: { titulo_etapa: "do incidente" } },
      versao_base: 2,
      atualizado_em: "2026-10-13T14:05:00.000Z",
    };

    it("com rascunho no banco: pergunta; continuar devolve o conteúdo e regrava na vigente", async () => {
      const { loja, relogio: r, banco } = criar({ banco: GUARDADO });
      await loja.abrir(EDITAL, 3);
      expect(loja.obter()).toMatchObject({
        fase: "decidir",
        retomarSemPerguntar: false,
        guardado: { versaoBase: 2, local: false },
      });
      expect(loja.continuar()).toEqual(GUARDADO.conteudo);
      expect(loja.obter().fase).toBe("editando");
      expect(loja.comAlteracoes()).toBe(true);
      r.passar();
      await esperar();
      expect(banco()?.versao_base).toBe(3);
    });

    it("descartar apaga no banco e neste computador", async () => {
      const { loja, banco, armazenamento } = criar({ banco: GUARDADO });
      armazenamento.setItem(CHAVE, "{}");
      await loja.abrir(EDITAL, 2);
      await loja.descartar();
      expect(banco()).toBeNull();
      expect(armazenamento.getItem(CHAVE)).toBeNull();
      expect(loja.obter()).toMatchObject({ fase: "editando", guardado: null });
    });

    it("a cópia deste computador mais nova que a do banco ganha (ficou sem conexão)", async () => {
      const { loja, armazenamento } = criar({ banco: GUARDADO });
      armazenamento.setItem(
        CHAVE,
        JSON.stringify({
          conteudo: { regra: { titulo_etapa: "offline" } },
          versao_base: 2,
          atualizado_em: "2026-10-13T15:00:00.000Z",
          local: true,
        }),
      );
      await loja.abrir(EDITAL, 2);
      expect(loja.obter().guardado).toMatchObject({
        conteudo: { regra: { titulo_etapa: "offline" } },
        local: true,
      });
    });

    it("banco fora ao abrir: vale a cópia deste computador", async () => {
      const { loja, armazenamento } = criar({
        rpcFalha: () => new TypeError("Failed to fetch"),
      });
      armazenamento.setItem(
        CHAVE,
        JSON.stringify({
          conteudo: { regra: { x: 1 } },
          versao_base: 1,
          atualizado_em: "2026-10-13T15:00:00.000Z",
          local: true,
        }),
      );
      await loja.abrir(EDITAL, 1);
      expect(loja.obter().fase).toBe("decidir");
    });

    it("o rascunho desta sessão, na mesma versão, volta sem perguntar (trocar de aba)", async () => {
      const { loja, relogio: r } = criar();
      await loja.abrir(EDITAL, 2);
      loja.mudar({ regra: { x: 1 } }, true);
      loja.fechar(EDITAL); // grava já o agendado
      expect(r.agendados).toBe(0);
      await loja.abrir(EDITAL, 2);
      expect(loja.obter()).toMatchObject({
        fase: "decidir",
        retomarSemPerguntar: true,
      });
    });

    it("outra pessoa salvou no meio (versão vigente mudou): pergunta, mesmo nesta sessão", async () => {
      const { loja } = criar();
      await loja.abrir(EDITAL, 2);
      loja.mudar({ regra: { x: 1 } }, true);
      loja.fechar(EDITAL);
      await loja.abrir(EDITAL, 3);
      expect(loja.obter()).toMatchObject({
        fase: "decidir",
        retomarSemPerguntar: false,
        guardado: { versaoBase: 2 },
      });
    });
  });

  describe("versão nova salva", () => {
    it("esquecer apaga antes de a tela reabrir; a reabertura não acha nada", async () => {
      const { loja, relogio: r, banco } = criar();
      await loja.abrir(EDITAL, 2);
      loja.mudar({ regra: { x: 1 } }, true);
      r.passar();
      await esperar();
      loja.mudar({ regra: { x: 2 } }, true);
      void loja.esquecer(EDITAL);
      expect(r.agendados).toBe(0);
      loja.fechar(EDITAL);
      await loja.abrir(EDITAL, 3);
      expect(banco()).toBeNull();
      expect(loja.obter()).toMatchObject({ fase: "editando", guardado: null });
    });
  });

  describe("guarda do app", () => {
    it("F5 com alteração pede confirmação e grava a cópia local do que estava por gravar", async () => {
      const { loja, guarda, ouvintes, armazenamento } = criar();
      await loja.abrir(EDITAL, 2);
      const evento = { preventDefault: vi.fn(), returnValue: undefined };
      chamarOuvinte(ouvintes, "beforeunload", evento);
      expect(evento.preventDefault).not.toHaveBeenCalled();
      loja.mudar({ regra: { x: 1 } }, true);
      expect(guarda.podeRecarregar()).toBe(false);
      chamarOuvinte(ouvintes, "beforeunload", evento);
      expect(evento.preventDefault).toHaveBeenCalled();
      expect(JSON.parse(String(armazenamento.getItem(CHAVE))).conteudo).toEqual(
        {
          regra: { x: 1 },
        },
      );
    });

    it("versão nova do sistema espera a gravação terminar", async () => {
      const { loja, guarda, relogio: r } = criar();
      await loja.abrir(EDITAL, 2);
      expect(guarda.podeRecarregar()).toBe(true);
      loja.mudar({ regra: { x: 1 } }, true);
      expect(guarda.podeRecarregar()).toBe(false);
      r.passar();
      expect(guarda.podeRecarregar()).toBe(false);
      await esperar();
      expect(guarda.podeRecarregar()).toBe(true);
      expect(guarda.comAlteracoes()).toBe(true);
    });
  });
});

bloco("app/troca-de-area-com-alteracao-pendente", () => {
  /*
  Trocar de área remonta as telas da área: a ficha aberta da Avaliação
  documental sai. Com mudança ainda não guardada, a troca pergunta antes.
*/
  describe("troca de área e a guarda de alterações", () => {
    it("sem nada pendente, troca sem perguntar", () => {
      const confirmar = vi.fn(() => false);
      const guarda = criarGuardaDeAlteracoes({ janela: undefined });
      expect(confirmarTrocaDeArea(confirmar, guarda)).toBe(true);
      expect(confirmar).not.toHaveBeenCalled();
    });

    it("com alteração ainda não guardada, pergunta e respeita a resposta", () => {
      const guarda = criarGuardaDeAlteracoes({ janela: undefined });
      guarda.registrar({ comAlteracoes: () => true, naoGuardado: () => true });
      const recusar = vi.fn(() => false);
      expect(confirmarTrocaDeArea(recusar, guarda)).toBe(false);
      expect(recusar).toHaveBeenCalledWith(
        "Há alteração que ainda não foi salva. Trocar de área mesmo assim?",
      );
      expect(confirmarTrocaDeArea(() => true, guarda)).toBe(true);
    });
  });
});

bloco("arte-de-fundo-larga", () => {
  /*
  Tela de acesso, 11/11/2026: a arte ocupa a altura toda, ancorada à direita.
  Tela mais estreita que a arte → a arte cobre tudo (corte à esquerda); mais
  larga → a sobra é a arte desfocada, e a borda se dissolve. A proporção da
  arte (--login-arte-proporcao) é medida quando ela carrega: arte larga (21:9)
  cobre a tela larga inteira, sem a faixa desfocada.

  13/11/2026: a medida (proporção e cor da borda esquerda) é guardada com o
  endereço da arte, e o primeiro quadro da visita seguinte já sai com ela.
*/

  function telaFalsa() {
    const vars = new Map<string, string>();
    return {
      vars,
      tela: {
        style: {
          setProperty: (nome: string, valor: string) => {
            vars.set(nome, valor);
          },
        },
      },
    };
  }

  const imagem = (largura: number, altura: number): ImagemMedivel => ({
    onload: null,
    onerror: null,
    crossOrigin: null,
    src: "",
    naturalWidth: largura,
    naturalHeight: altura,
  });

  const semCor = () => null;
  const naoGuarda = () => {};

  describe("medirArte", () => {
    it("grava largura ÷ altura quando a arte carrega", () => {
      const { tela, vars } = telaFalsa();
      const img = imagem(2560, 1080);
      medirArte(tela, " https://exemplo.test/arte.webp ", {
        criarImagem: () => img,
        lerCor: semCor,
        guardar: naoGuarda,
      });
      expect(img.src).toBe("https://exemplo.test/arte.webp");
      expect(vars.has("--login-arte-proporcao")).toBe(false);
      img.onload?.(new Event("load"));
      expect(vars.get("--login-arte-proporcao")).toBe("2.3704");
    });

    it("arte 16:9 continua 16:9", () => {
      const { tela, vars } = telaFalsa();
      const img = imagem(1920, 1080);
      medirArte(tela, "/arte.png", {
        criarImagem: () => img,
        lerCor: semCor,
        guardar: naoGuarda,
      });
      img.onload?.(new Event("load"));
      expect(vars.get("--login-arte-proporcao")).toBe("1.7778");
    });

    it("pede a arte com CORS, grava a cor da borda e guarda a medida com o endereço", () => {
      const { tela, vars } = telaFalsa();
      const img = imagem(3200, 1370);
      const guardadas: MedidaDaArte[] = [];
      medirArte(tela, "https://exemplo.test/arte.jpg", {
        criarImagem: () => img,
        lerCor: () => "#043231",
        guardar: (medida) => guardadas.push(medida),
      });
      expect(img.crossOrigin).toBe("anonymous");
      img.onload?.(new Event("load"));
      expect(vars.get("--login-arte-cor")).toBe("#043231");
      expect(guardadas).toEqual([
        {
          arteMedidaDe: "https://exemplo.test/arte.jpg",
          arteProporcao: "2.3358",
          arteCor: "#043231",
        },
      ]);
    });

    it("servidor sem CORS: mede de novo sem CORS, só a proporção", () => {
      const { tela, vars } = telaFalsa();
      const comCors = imagem(3200, 1370);
      const semCors = imagem(3200, 1370);
      const fila = [comCors, semCors];
      const guardadas: MedidaDaArte[] = [];
      let lida = false;
      medirArte(tela, "https://outro.test/arte.jpg", {
        criarImagem: () => fila.shift() ?? null,
        lerCor: () => {
          lida = true;
          return "#ffffff";
        },
        guardar: (medida) => guardadas.push(medida),
      });
      comCors.onerror?.(new Event("error"));
      expect(semCors.crossOrigin).toBeNull();
      semCors.onload?.(new Event("load"));
      expect(lida).toBe(false);
      expect(vars.get("--login-arte-proporcao")).toBe("2.3358");
      expect(vars.has("--login-arte-cor")).toBe(false);
      expect(guardadas).toEqual([
        {
          arteMedidaDe: "https://outro.test/arte.jpg",
          arteProporcao: "2.3358",
        },
      ]);
    });

    it("sem endereço, sem tela, sem medidas ou sem Image: não grava nada", () => {
      const { tela, vars } = telaFalsa();
      const vazia = imagem(0, 0);
      const opcoes = (img: ImagemMedivel | null) => ({
        criarImagem: () => img,
        lerCor: semCor,
        guardar: naoGuarda,
      });
      medirArte(tela, "", opcoes(imagem(10, 10)));
      medirArte(null, "/arte.png", opcoes(imagem(10, 10)));
      medirArte(tela, "/arte.png", opcoes(vazia));
      vazia.onload?.(new Event("load"));
      medirArte(tela, "/arte.png", opcoes(null));
      expect(vars.size).toBe(0);
    });
  });

  describe("o CSS da arte de fundo", () => {
    const css = readFileSync("src/styles/platform-shell.css", "utf8");

    it("não troca mais de modo numa proporção fixa de tela", () => {
      expect(css).not.toMatch(/min-aspect-ratio/);
    });

    it("a arte nítida ocupa a altura toda, à direita, e a borda usa a proporção medida", () => {
      const depois = css.slice(css.indexOf(".login-screen::after {"));
      expect(depois).toMatch(/background-size: auto 100%;/);
      expect(depois).toMatch(/background-position: right center;/);
      expect(depois).toMatch(/var\(--login-arte-proporcao, 1\.7778\)/);
      expect(depois).toMatch(/mask-image: linear-gradient\(/);
    });

    it("o fundo da própria tela não leva a arte (ela está nas camadas)", () => {
      const tela = css.slice(css.indexOf(".login-screen {"));
      expect(tela.slice(0, tela.indexOf("}"))).toMatch(
        /background-image: none;/,
      );
    });

    it("enquanto a arte não aparece, o fundo é a cor da borda dela", () => {
      const partida = readFileSync(
        "src/styles/post157-interface-tuning.css",
        "utf8",
      );
      const tela = partida.slice(partida.indexOf(".login-screen {"));
      expect(tela.slice(0, tela.indexOf("}"))).toContain(
        "background-color: var(--login-arte-cor, #eef4f8);",
      );
    });
  });
});

bloco("lib/html-security", () => {
  describe("html security", () => {
    it("remove o script CDN do Supabase e preserva os demais scripts", () => {
      const html = `<!doctype html><html><head>
      <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
      <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
    </head></html>`;

      const result = stripSupabaseCdnScripts(html);

      expect(result).not.toContain("@supabase/supabase-js");
      expect(result).toContain("chart.js@4.4.1");
    });

    it("remove variantes com aspas simples e versão específica", () => {
      const html =
        "<script defer src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1'></script>";

      expect(stripSupabaseCdnScripts(html)).not.toContain("supabase-js");
    });

    it("remove query string e hash da localização enviada ao GA4", () => {
      const html = `gtag('config', 'G-TESTE', {
      page_title: document.title,
      page_location: window.location.href
    });`;

      const result = sanitizeAnalyticsPageLocation(html);

      expect(result).toContain(
        "page_location: window.location.origin + window.location.pathname",
      );
      expect(result).not.toContain("window.location.href");
    });

    it("aplica todas as proteções na transformação final", () => {
      const html = `
      <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
      <script>gtag('config', 'G-TESTE', { page_location: window.location.href });</script>`;

      const result = secureHtmlDocument(html);

      expect(result).not.toContain("@supabase/supabase-js");
      expect(result).not.toContain("window.location.href");
      expect(result).toContain(
        "window.location.origin + window.location.pathname",
      );
    });

    it("expõe a transformação como plugin do Vite", () => {
      const plugin = createHtmlSecurityPlugin();
      const html =
        '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>';

      expect(plugin.name).toBe("agsus-html-security");
      expect(plugin.enforce).toBe("pre");
      // O gancho não usa o `this` do Vite (o contexto do plugin).
      const transformar: (html: string) => string = plugin.transformIndexHtml;
      expect(transformar(html)).not.toContain("supabase-js");
    });
  });
});

bloco("lib/publicacao-so-do-alterado", () => {
  /*
  22/10: publicar Configurações mandava todas as chaves e todos os painéis com
  os valores de quando a tela carregou, e desfazia o que outro administrador
  tivesse mudado nesse meio-tempo. Agora vai só o que a pessoa mudou (painel
  a partir do que está no banco) e a revisão avisa do conflito.
*/

  const PAINEL = {
    id: "p1",
    codigo: "recursos",
    titulo: "Recursos",
    url: "https://script.google.com/a",
    ativo: true,
    em_manutencao: false,
  };

  describe("publicação só do que mudou", () => {
    it("linhasDasSecoes com chaves manda só essas (e ignora chave fora das seções)", () => {
      const valores = new Map([
        ["page_title", "Novo"],
        ["page_subtitle", "Antigo"],
      ]);
      const linhas = linhasDasSecoes(valores, ["page_title", "nao_existe"]);
      expect(linhas.map((l) => l.chave)).toEqual(["page_title"]);
      expect(linhas[0]?.valor).toBe("Novo");
    });

    it("painel alterado parte do banco: o campo não mexido fica como outra pessoa deixou", () => {
      const banco = [
        { ...PAINEL, titulo: "Recursos (novo nome)" },
        { ...PAINEL, id: "p2", codigo: "outro" },
      ];
      const linhas = linhasDosPaineisAlterados(
        banco,
        new Map([["p1", { em_manutencao: true }]]),
      );
      expect(linhas).toEqual([
        {
          id: "p1",
          titulo: "Recursos (novo nome)",
          url: PAINEL.url,
          ativo: true,
          em_manutencao: true,
        },
      ]);
    });

    it("conflito: outro administrador mudou a mesma chave ou o mesmo campo do painel", () => {
      const carregados = normalizarValoresCarregados({ page_title: "A" });
      const retrato = {
        configuracoes: [{ chave: "page_title", valor: "B" }],
        paineis: [{ ...PAINEL, url: "https://script.google.com/b" }],
      };
      const conflitos = conflitosDaPublicacao(retrato, {
        carregados,
        rascunho: new Map([["page_title", "C"]]),
        paineisCarregados: normalizarPaineis([PAINEL]),
        rascunhoDosPaineis: new Map([
          ["p1", { url: "https://script.google.com/c", ativo: false }],
        ]),
      });
      expect(conflitos.map((c) => [c.entity, c.field])).toEqual([
        ["Configuração", "Valor"],
        ["Painel", "URL"],
      ]);
    });

    it("sem mudança no banco, sem conflito", () => {
      const carregados = normalizarValoresCarregados({ page_title: "A" });
      expect(
        conflitosDaPublicacao(
          {
            configuracoes: [{ chave: "page_title", valor: "A" }],
            paineis: [PAINEL],
          },
          {
            carregados,
            rascunho: new Map([["page_title", "C"]]),
            paineisCarregados: normalizarPaineis([PAINEL]),
            rascunhoDosPaineis: new Map([["p1", { ativo: false }]]),
          },
        ),
      ).toEqual([]);
    });
  });
});

bloco("sessao-sem-rede", () => {
  /*
  Sem rede e com o token vencido, o auth-js devolve `session: null` embora a
  sessão continue guardada. Até 48 h depois de vencer, a guardada serve; erro
  que não é de rede, ou leitura sem erro (não há sessão), seguem como vieram.
*/

  const VENCE_EM = 1_800_000_000; // segundos, como o auth-js grava
  const GUARDADA = JSON.stringify({
    access_token: "token-vencido",
    refresh_token: "renovacao",
    expires_at: VENCE_EM,
    user: { id: "u1" },
  });
  const SEM_SESSAO = (error: unknown) => ({ data: { session: null }, error });
  const SEM_REDE = new AuthRetryableFetchError("Failed to fetch", 0);
  const depoisDeVencer = (ms: number) => VENCE_EM * 1000 + ms;

  describe("a sessão guardada sem rede", () => {
    it("serve quando a renovação falhou por falta de rede, até 48 h depois de vencer", () => {
      const lida = sessaoSemRede(SEM_SESSAO(SEM_REDE), {
        guardada: GUARDADA,
        agora: depoisDeVencer(LIMITE_SEM_REDE_MS),
        online: true,
      });
      expect(lida.error).toBeNull();
      expect(lida.data.session).toMatchObject({ user: { id: "u1" } });

      expect(
        sessaoSemRede(SEM_SESSAO(SEM_REDE), {
          guardada: GUARDADA,
          agora: depoisDeVencer(LIMITE_SEM_REDE_MS + 1),
          online: true,
        }).data.session,
      ).toBeNull();
    });

    it("serve com o navegador sem conexão, qualquer que seja o erro", () => {
      expect(
        sessaoSemRede(SEM_SESSAO(new Error("qualquer")), {
          guardada: GUARDADA,
          agora: depoisDeVencer(1),
          online: false,
        }).data.session,
      ).not.toBeNull();
    });

    it("não serve quando o servidor recusou, quando não há erro ou sem sessão guardada", () => {
      const recusa = new AuthApiError(
        "Invalid Refresh Token",
        400,
        "refresh_token_not_found",
      );
      const opcoes = {
        guardada: GUARDADA,
        agora: depoisDeVencer(1),
        online: true,
      };
      expect(sessaoSemRede(SEM_SESSAO(recusa), opcoes).data.session).toBeNull();
      expect(sessaoSemRede(SEM_SESSAO(null), opcoes).data.session).toBeNull();
      expect(
        sessaoSemRede(SEM_SESSAO(SEM_REDE), { ...opcoes, guardada: null }).data
          .session,
      ).toBeNull();
      expect(
        sessaoSemRede(SEM_SESSAO(SEM_REDE), { ...opcoes, guardada: "{lixo" })
          .data.session,
      ).toBeNull();
      expect(
        sessaoSemRede(SEM_SESSAO(SEM_REDE), {
          ...opcoes,
          guardada: JSON.stringify({ access_token: "t", expires_at: VENCE_EM }),
        }).data.session,
      ).toBeNull();
    });

    it("a leitura que já trouxe a sessão fica como veio", () => {
      const resposta = {
        data: { session: { user: { id: "u9" } } },
        error: null,
      };
      expect(
        sessaoSemRede(resposta, {
          guardada: GUARDADA,
          agora: 0,
          online: false,
        }),
      ).toBe(resposta);
    });
  });

  describe("o perfil guardado para entrar sem rede", () => {
    const contexto = {
      perfil: { id: "p1", nome: "Ana", ativo: true, permissoes: {} },
      painelIds: ["painel-1"],
      contextoCarregado: true,
    };

    it("guarda o perfil, os painéis e o formato", () => {
      const guardado = perfilParaGuardar(contexto);
      expect(guardado).toEqual({ formato: 1, ...contexto });
      expect(PERFIL_GUARDADO.valido(guardado)).toBe(true);
      expect(PERFIL_GUARDADO.esquema(guardado)).toBe(1);
    });

    it("perfil desativado ou sem id não serve", () => {
      expect(
        PERFIL_GUARDADO.valido(
          perfilParaGuardar({
            ...contexto,
            perfil: { id: "p1", ativo: false },
          }),
        ),
      ).toBe(false);
      expect(
        PERFIL_GUARDADO.valido(perfilParaGuardar({ ...contexto, perfil: {} })),
      ).toBe(false);
    });
  });
});

bloco("conferencias-leituras-no-retrato", () => {
  /*
  AS LEITURAS DAS CONFERÊNCIAS NO BANCO (migration 20261117193000, aplicada em 18/11/2026)

  O job scripts/conferencias/ depende de três campos que essas leituras passaram a trazer; as regras
  que os usam estão em scripts/conferencias/regras.py (tests/python/test_conferencias.py). Aqui, o
  retrato do banco (supabase/esquema-atual.sql) confere que o corpo vigente de cada leitura os traz.
*/
  const RETRATO = readFileSync("supabase/esquema-atual.sql", "utf8").replace(
    /\r/g,
    "",
  );

  function corpo(funcao: string) {
    const i = RETRATO.indexOf(`CREATE FUNCTION public.${funcao}`);
    expect(i, funcao).toBeGreaterThanOrEqual(0);
    const resto = RETRATO.slice(i);
    const achado = /AS (\$[A-Za-z_]*\$)/.exec(resto);
    const tag = achado?.[1];
    if (!achado || !tag) throw new Error(`sem corpo: ${funcao}`);
    const ini = achado.index + achado[0].length;
    return resto.slice(ini, resto.indexOf(tag, ini));
  }

  describe("leituras das conferências no retrato do banco", () => {
    it("inscrição só da candidatura no mesmo edital ou na vaga da análise", () => {
      const sql = corpo("conferencia_ler_analises(");
      expect(sql).toContain(`v."CO_MONITORAMENTO" = e.edital_id`);
      expect(sql).toContain(`c."CO_VAGA" = nullif(btrim(p.codigo_vaga), '')`);
    });

    it("aprovados com a admissão conciliada, só de lista ativa", () => {
      const sql = corpo("conferencia_ler_aprovados(");
      expect(sql).toContain(`public."TB_ADMISSAO_CONCILIADA"`);
      expect(sql).toContain(
        `'admitido', c.admissao is not null, 'admissao', c.admissao`,
      );
      expect(sql).toContain("coalesce(l.ativo, true)");
    });

    it("listas com a versão da regra", () => {
      expect(corpo("conferencia_ler_listas_e_quadros(")).toContain(
        `'versao_regra', u."NU_VERSAO_REGRA"`,
      );
    });
  });
});

bloco("retrato-do-esquema", () => {
  /*
  O retrato do schema (supabase/esquema-atual.sql): o código vigente do banco, só leitura,
  gerado por `npm run db:esquema` depois de cada migration aplicada.
*/
  const DUMP = [
    "--",
    "-- PostgreSQL database dump",
    "--",
    "\\restrict AbC123aleatorio",
    "-- Dumped from database version 17.4",
    "-- Dumped by pg_dump version 17.6",
    "SET statement_timeout = 0;",
    "",
    "",
    "",
    'CREATE FUNCTION private."FC_X"() RETURNS integer',
    "    LANGUAGE sql AS $$ select 1 $$;",
    "\\unrestrict AbC123aleatorio",
    "",
  ].join("\r\n");

  describe("limparDump", () => {
    it("tira o que muda a cada execução sem mudança no banco", () => {
      const limpo = limparDump(DUMP);
      expect(limpo).not.toMatch(/restrict|Dumped (from|by)|\r/);
      expect(limpo).toContain('CREATE FUNCTION private."FC_X"()');
      expect(limpo).toContain("SET statement_timeout = 0;");
      expect(limpo).not.toMatch(/\n{3,}/);
    });

    it("duas execuções com chaves de \\restrict diferentes dão o mesmo retrato", () => {
      const outra = DUMP.replace(/AbC123aleatorio/g, "Zz9outra").replace(
        "17.6",
        "17.7",
      );
      expect(limparDump(outra)).toBe(limparDump(DUMP));
    });
  });

  describe("tarefas do pg_cron", () => {
    it("em ordem de nome, uma por linha, com o comando numa linha só", () => {
      expect(
        tarefasComoSql([
          {
            nome: "b",
            agenda: "0 9 * * *",
            ativa: false,
            comando: "select\n  2;",
          },
          {
            nome: "a",
            agenda: "*/5 * * * *",
            ativa: true,
            comando: "select 1;",
          },
        ]),
      ).toBe(
        [
          "-- Tarefas do pg_cron (cron.job), em ordem de nome: nome | agenda | ativa | comando.",
          "-- a | */5 * * * * | ativa | select 1;",
          "-- b | 0 9 * * * | parada | select 2;",
        ].join("\n"),
      );
    });

    it("o retrato começa pelo aviso de não aplicar", () => {
      const retrato = montarRetrato(DUMP, []);
      expect(retrato.startsWith(CABECALHO)).toBe(true);
      expect(CABECALHO).toContain("NÃO APLICAR");
      expect(retrato.endsWith("\n")).toBe(true);
    });
  });

  describe.runIf(existsSync(ARQUIVO_DO_RETRATO))("o retrato gravado", () => {
    const texto = existsSync(ARQUIVO_DO_RETRATO)
      ? readFileSync(ARQUIVO_DO_RETRATO, "utf8")
      : "";

    it("veio do script (cabeçalho, sem a chave de \\restrict nem a versão)", () => {
      expect(texto.startsWith(CABECALHO)).toBe(true);
      expect(texto).not.toMatch(/^\\(un)?restrict\b|^-- Dumped (from|by)/m);
    });

    it("não traz credencial", () => {
      expect(texto).not.toMatch(/postgres(ql)?:\/\/[^\s'"]*@/);
      expect(texto).not.toMatch(/\bghp_[A-Za-z0-9]{20,}|\bsb_secret_/);
    });
  });
});

bloco("lib/localizacoes-do-sigepsi", () => {
  /* Linhas no formato da API do SIGEPSI (/api/mapa-dseis/localizacoes/todas). */
  const linha = (campos: Record<string, unknown> = {}) => ({
    CO_SEQ_LOCALIZACAO_POLO_BASE: "2",
    NO_DSEI: "ALAGOAS E SERGIPE",
    TP_UNIDADE: "POLO BASE",
    NO_LOTACAO: "PB ACONÃ",
    NU_CEP: "57370000",
    NO_MUNICIPIO: "TRAIPU",
    CG_LATITUDE: "-9.97100000000000",
    CG_LONGITUDE: "-37.00300000000000",
    ST_REGISTRO_ATIVO: "S",
    ...campos,
  });

  const CASAI = linha({
    CO_SEQ_LOCALIZACAO_POLO_BASE: "1",
    TP_UNIDADE: "CASAI",
    NO_LOTACAO: "CASAI DSEI AL/SE",
    NU_CEP: "57052483",
    NO_MUNICIPIO: "MACEIO",
    CG_LATITUDE: "-9.62718000000000",
    CG_LONGITUDE: "-35.73629000000000",
  });

  const SEDE = linha({
    CO_SEQ_LOCALIZACAO_POLO_BASE: "3",
    TP_UNIDADE: "SEDE",
    NO_LOTACAO: "SEDE DSEI",
    NU_CEP: "57062280",
    NO_MUNICIPIO: "MACEIO",
    CG_LATITUDE: "-9.60197",
    CG_LONGITUDE: "-35.7481",
  });

  const LOTACAO = linha({
    CO_SEQ_LOCALIZACAO_POLO_BASE: "4",
    TP_UNIDADE: "UNIDADE DE LOTAÇÃO",
    NO_LOTACAO: "NOVO DIA",
    NO_MUNICIPIO: "PORTO REAL DO COLEGIO",
    CG_LATITUDE: "-10.1",
    CG_LONGITUDE: "-36.8",
  });

  /* As CASAIs nacionais do SIGEPSI: localizações 131 (DF) e 132 (São Paulo). */
  const CASAI_DF = linha({
    CO_SEQ_LOCALIZACAO_POLO_BASE: "131",
    NO_DSEI: "CASAI DF",
    TP_UNIDADE: "CASAI",
    NO_LOTACAO: "CASAI DF",
    NU_CEP: "",
    NO_MUNICIPIO: "BRASILIA",
    CG_LATITUDE: "-15.7432",
    CG_LONGITUDE: "-47.7133",
  });
  const CASAI_SP = linha({
    CO_SEQ_LOCALIZACAO_POLO_BASE: "132",
    NO_DSEI: "CASAI SÃO PAULO",
    TP_UNIDADE: "CASAI",
    NO_LOTACAO: "CASAI SÃO PAULO",
    NU_CEP: "05161000",
    NO_MUNICIPIO: "SAO PAULO",
    CG_LATITUDE: "-23.5821",
    CG_LONGITUDE: "-46.6136",
  });

  describe("CASAIs só do SIGEPSI", () => {
    it("as nacionais são as localizações 131 e 132, fora da lista de DSEIs", () => {
      const linhas = [CASAI, CASAI_DF, CASAI_SP];
      expect(casaisNacionaisDoSigepsi(linhas)).toEqual([
        ["CASAI DF", "131", -15.7432, -47.7133, "BRASILIA", "DF"],
        ["CASAI SÃO PAULO", "132", -23.5821, -46.6136, "SAO PAULO", "SP"],
      ]);
      // A CASAI de um DSEI não é nacional; as nacionais não viram DSEI.
      expect(Object.keys(localizacoesPorDsei(linhas))).toEqual([
        "ALAGOAS SERGIPE",
      ]);
      expect(
        casaisNacionaisDoSigepsi([
          linha({ ...CASAI_DF, ST_REGISTRO_ATIVO: "N" }),
        ]),
      ).toEqual([]);
    });

    it("a validação do mapa aceita as CASAIs nacionais e ignora lixo", () => {
      const nacionais = casaisNacionaisDoSigepsi([CASAI_DF, CASAI_SP]);
      expect(casaisNacionaisDoMapa([...nacionais, "x", [null], null])).toEqual(
        nacionais,
      );
    });
  });

  describe("localizacoesPorDsei", () => {
    it("agrupa pela chave do DSEI, com tipo, UF pelo CEP e origem", () => {
      const porDsei = localizacoesPorDsei([CASAI, linha(), LOTACAO, SEDE]);
      expect(Object.keys(porDsei)).toEqual(["ALAGOAS SERGIPE"]);
      expect(porDsei["ALAGOAS SERGIPE"]?.polos).toEqual([
        {
          n: "CASAI DSEI AL/SE",
          lat: -9.62718,
          lon: -35.73629,
          uf: "AL",
          cod: "1",
          tipo: "casai",
          municipio: "MACEIO",
          origem: "sigepsi",
          // Sem as colunas de acesso na linha: não informado.
          meios: ["Não informado"],
          acessibilidade: "Não informado",
          localidade: "Não informado",
          floresta: "Não informado",
        },
        expect.objectContaining({ n: "PB ACONÃ", tipo: "polo", uf: "AL" }),
        expect.objectContaining({ n: "NOVO DIA", tipo: "unidade" }),
      ]);
      expect(porDsei["ALAGOAS SERGIPE"]?.sede).toEqual({
        lat: -9.60197,
        lon: -35.7481,
        uf: "AL",
        municipio: "MACEIO",
      });
    });

    it("ignora inativas, sem coordenada, 0,0, tipo desconhecido e lixo", () => {
      const porDsei = localizacoesPorDsei([
        linha({ ST_REGISTRO_ATIVO: "N" }),
        linha({ CG_LATITUDE: "" }),
        linha({ CG_LATITUDE: "0", CG_LONGITUDE: "0" }),
        linha({ NO_DSEI: "" }),
        linha({ TP_UNIDADE: "OUTRA COISA" }),
        // CASAI nacional no lugar do DSEI: não é distrito.
        linha({ NO_DSEI: "CASAI DF", TP_UNIDADE: "CASAI" }),
        null,
        "texto",
      ]);
      // O DSEI ativo existe mesmo sem nenhum ponto utilizável.
      expect(porDsei).toEqual({
        "ALAGOAS SERGIPE": { nome: "ALAGOAS E SERGIPE", polos: [], sede: null },
      });
      expect(localizacoesPorDsei({ nao: "lista" })).toEqual({});
    });

    it("tipo e UF", () => {
      expect(tipoDaLocalizacao("CASAI")).toBe("casai");
      expect(tipoDaLocalizacao("Polo Base")).toBe("polo");
      expect(tipoDaLocalizacao("ROTA")).toBe("polo");
      expect(tipoDaLocalizacao("SEDE")).toBe("sede");
      expect(tipoDaLocalizacao("UNIDADE DE LOTAÇÃO", "UBSI X")).toBe("unidade");
      expect(tipoDaLocalizacao("UNIDADE DE LOTAÇÃO", "PB X")).toBe("polo");
      expect(tipoDaLocalizacao("UNIDADE DE LOTAÇÃO", "CASAI X")).toBe("casai");
      expect(tipoDaLocalizacao("OUTRA")).toBeNull();
      expect(ufDoCep("69301-000")).toBe("RR");
      expect(ufDoCep("70040-010")).toBe("DF");
      expect(ufDoCep("123")).toBe("");
    });
  });

  describe("aplicarLocalizacoes", () => {
    const lmap = {
      dsei: [
        {
          k: "YANOMAMI",
          n: "Yanomami",
          polos: [{ n: "POLO DO BANCO", lat: 2, lon: -61 }],
        },
        {
          k: "ALAGOAS E SERGIPE",
          n: "Alagoas e Sergipe",
          lat: -9.6,
          lon: -35.7,
          pop: 12000,
          ufs: ["AL", "SE"],
          sedeuf: "AL",
          sede_municipio: "Maceió",
          polos: [{ n: "POLO ANTIGO", lat: -9, lon: -36, uf: "AL" }],
        },
      ],
      casai: [{ n: "CASAI Nacional Brasília" }],
    };

    it("a lista é a do SIGEPSI; do banco, só nome, população e UFs", () => {
      const porDsei = localizacoesPorDsei([
        CASAI,
        linha(),
        SEDE,
        linha({
          NO_DSEI: "MÉDIO RIO SOLIMÕES E AFLUENTES",
          TP_UNIDADE: "SEDE",
          NU_CEP: "69553000",
          NO_MUNICIPIO: "TEFE",
          CG_LATITUDE: "-3.35",
          CG_LONGITUDE: "-64.71",
        }),
      ]);
      const novo = aplicarLocalizacoes(lmap, porDsei);
      // Yanomami (só no banco) sai; o DSEI só do SIGEPSI entra; nada mais do banco.
      expect(novo).toEqual({
        dsei: [
          {
            k: "ALAGOAS E SERGIPE",
            n: "Alagoas e Sergipe",
            pop: 12000,
            ufs: ["AL", "SE"],
            sedeuf: "AL",
            polos: porDsei["ALAGOAS SERGIPE"]?.polos,
            lat: -9.60197,
            lon: -35.7481,
            sede_municipio: "MACEIO",
            sede_uf: "AL",
          },
          {
            k: "MÉDIO RIO SOLIMÕES E AFLUENTES",
            n: "Médio Rio Solimões e Afluentes",
            ufs: ["AM"],
            sedeuf: "AM",
            polos: [],
            lat: -3.35,
            lon: -64.71,
            sede_municipio: "TEFE",
            sede_uf: "AM",
          },
        ],
      });
    });

    it("sem sede no SIGEPSI, o DSEI fica sem posição (a do banco não vale)", () => {
      const [dsei] = aplicarLocalizacoes(
        lmap,
        localizacoesPorDsei([linha()]),
      ).dsei;
      expect(dsei).not.toHaveProperty("lat");
      expect(dsei).not.toHaveProperty("sede_municipio");
    });

    it("sem o banco, a lista do SIGEPSI basta", () => {
      expect(
        aplicarLocalizacoes(null, localizacoesPorDsei([SEDE])).dsei,
      ).toEqual([
        expect.objectContaining({ n: "Alagoas e Sergipe", ufs: ["AL"] }),
      ]);
    });
  });

  describe("no mapa do DSEI", () => {
    const { dsei } = aplicarLocalizacoes(
      { dsei: [{ k: "ALAGOAS E SERGIPE", n: "Alagoas e Sergipe" }] },
      localizacoesPorDsei([
        CASAI,
        linha(),
        LOTACAO,
        linha({ NO_LOTACAO: "UBSI BANANAL", TP_UNIDADE: "UNIDADE DE LOTAÇÃO" }),
        SEDE,
      ]),
    ) as { dsei: DseiDoMapa[] };
    const distrito = dsei[0]!;

    it("só os pontos do SIGEPSI, com o tipo de TP_UNIDADE e do nome", () => {
      const registros = registrosDoDsei(distrito);
      expect(
        registros.map((r) => [r.name, r.type.key, r.city, r.uf, r.origens]),
      ).toEqual([
        ["CASAI DSEI AL/SE", "casai", "MACEIO", "AL", ["sigepsi"]],
        ["PB ACONÃ", "polo", "TRAIPU", "AL", ["sigepsi"]],
        ["NOVO DIA", "unit", "PORTO REAL DO COLEGIO", "AL", ["sigepsi"]],
        ["UBSI BANANAL", "ubsi", "TRAIPU", "AL", ["sigepsi"]],
      ]);
      expect(resumoDaRede(distrito, registros)[0]).toBe("Polos base: 1");
    });
  });

  describe("/api/dseis", () => {
    const ambiente = { ...process.env };
    const original = globalThis.fetch;

    /* A resposta da Vercel guardando o que a função escreveu. */
    function respostaFalsa() {
      const gravado = {
        codigo: 0,
        cabecalhos: {} as Record<string, string>,
        corpo: "",
      };
      const res: Pick<RespostaDaVercel, "status" | "setHeader" | "end"> = {
        status(codigo) {
          gravado.codigo = codigo;
          return res as RespostaDaVercel;
        },
        setHeader(nome, valor) {
          gravado.cabecalhos[nome] = String(valor);
          return res as RespostaDaVercel;
        },
        end(corpo?: unknown) {
          gravado.corpo = String(corpo ?? "");
          return res as RespostaDaVercel;
        },
      };
      return { gravado, res: res as RespostaDaVercel };
    }

    beforeEach(async () => {
      process.env.VITE_SUPABASE_URL = "https://banco.exemplo";
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "pub";
      process.env.SIGEPSI_API_TOKEN = "segredo";
      const { esquecerCache } = await import("../api/dseis.ts");
      esquecerCache();
    });
    afterEach(() => {
      process.env = { ...ambiente };
      globalThis.fetch = original;
    });

    async function chamar(headers: Record<string, string> = {}) {
      const { default: handler } = await import("../api/dseis.ts");
      const { gravado, res } = respostaFalsa();
      const pedido: Pick<PedidoDaVercel, "method" | "headers"> = {
        method: "GET",
        headers,
      };
      await handler(pedido as PedidoDaVercel, res);
      const json: unknown = gravado.corpo ? JSON.parse(gravado.corpo) : null;
      return { ...gravado, json };
    }

    const urlDe = (entrada: Parameters<typeof fetch>[0]) =>
      typeof entrada === "string"
        ? entrada
        : entrada instanceof URL
          ? entrada.href
          : entrada.url;

    it("sem o token do SIGEPSI, diz o nome da variável que falta", async () => {
      delete process.env.SIGEPSI_API_TOKEN;
      const r = await chamar();
      expect(r.codigo).toBe(500);
      expect(r.json).toEqual({
        erro: "configuracao_ausente",
        faltam: ["SIGEPSI_API_TOKEN"],
      });
    });

    it("sem sessão, 401 sem chamar o SIGEPSI", async () => {
      const fetchFalso = vi.fn<typeof fetch>();
      globalThis.fetch = fetchFalso;
      const r = await chamar();
      expect(r.codigo).toBe(401);
      expect(fetchFalso).not.toHaveBeenCalled();
    });

    it("com sessão, lê o SIGEPSI com o token do servidor e guarda", async () => {
      const fetchFalso = vi.fn<typeof fetch>(async (entrada) =>
        urlDe(entrada).endsWith("/auth/v1/user")
          ? new Response("{}", { status: 200 })
          : new Response(JSON.stringify([CASAI, CASAI_DF]), { status: 200 }),
      );
      globalThis.fetch = fetchFalso;
      const r = await chamar({ authorization: "Bearer sessao" });
      expect(r.codigo).toBe(200);
      expect(r.json).toMatchObject({
        dseis: {
          "ALAGOAS SERGIPE": {
            polos: [expect.objectContaining({ tipo: "casai" })],
          },
        },
        casaisNacionais: [
          ["CASAI DF", "131", -15.7432, -47.7133, "BRASILIA", "DF"],
        ],
      });
      expect(r.corpo).not.toContain("segredo");
      const opcoes = fetchFalso.mock.calls[1]?.[1];
      expect(new Headers(opcoes?.headers).get("Authorization")).toBe(
        "Bearer segredo",
      );
      expect(r.cabecalhos["Cache-Control"]).toMatch(/^private/);

      await chamar({ authorization: "Bearer sessao" });
      // Segunda vez: confere a sessão, mas não pede de novo ao SIGEPSI.
      expect(fetchFalso).toHaveBeenCalledTimes(3);
    });

    it("SIGEPSI recusando o token vira 502 com o status", async () => {
      globalThis.fetch = vi.fn<typeof fetch>(async (entrada) =>
        urlDe(entrada).endsWith("/auth/v1/user")
          ? new Response("{}", { status: 200 })
          : new Response("", { status: 401 }),
      );
      const r = await chamar({ authorization: "Bearer sessao" });
      expect(r.codigo).toBe(502);
      expect(r.json).toEqual({
        erro: "falha_no_sigepsi",
        status_do_sigepsi: 401,
      });
    });
  });

  describe("carregarLocalizacoes (navegador)", () => {
    const sessao = {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: "token-da-sessao" } },
          error: null,
        }),
      },
    };
    const DSEIS = {
      "ALAGOAS SERGIPE": { nome: "ALAGOAS E SERGIPE", polos: [], sede: null },
    };

    beforeEach(async () => {
      const { esquecerLocalizacoes } =
        await import("../src/modulos/mapa-saude-indigena/localizacoes.ts");
      esquecerLocalizacoes();
    });

    it("manda o token da sessão e guarda por 10 minutos", async () => {
      const { carregarLocalizacoes, CACHE_MS } =
        await import("../src/modulos/mapa-saude-indigena/localizacoes.ts");
      const buscar = vi.fn<typeof fetch>(
        async () =>
          new Response(JSON.stringify({ dseis: DSEIS, casaisNacionais: [] }), {
            status: 200,
          }),
      );
      let agora = 0;
      const relogio = () => agora;
      expect(await carregarLocalizacoes(sessao, { buscar, relogio })).toEqual({
        dseis: DSEIS,
        casaisNacionais: [],
      });
      const [rota, opcoes] = buscar.mock.calls[0] ?? [];
      expect(rota).toBe("/api/dseis");
      expect(new Headers(opcoes?.headers).get("Authorization")).toBe(
        "Bearer token-da-sessao",
      );
      agora = CACHE_MS - 1;
      await carregarLocalizacoes(sessao, { buscar, relogio });
      expect(buscar).toHaveBeenCalledTimes(1);
      agora = CACHE_MS;
      await carregarLocalizacoes(sessao, { buscar, relogio });
      expect(buscar).toHaveBeenCalledTimes(2);
    });

    it("falha não fica guardada e devolve null (o mapa usa o banco)", async () => {
      const { carregarLocalizacoes } =
        await import("../src/modulos/mapa-saude-indigena/localizacoes.ts");
      const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
      const buscar = vi.fn<typeof fetch>(
        async () => new Response("", { status: 502 }),
      );
      expect(await carregarLocalizacoes(sessao, { buscar })).toBeNull();
      expect(await carregarLocalizacoes(sessao, { buscar })).toBeNull();
      expect(buscar).toHaveBeenCalledTimes(2);
      aviso.mockRestore();
    });
  });
});

bloco("lib/territorio-do-sigepsi", () => {
  /*
    Território, acesso e CNES do SIGEPSI
    (src/lib/mapas/mapa-saude-indigena/territorio-do-sigepsi.ts e
    api/territorio-dos-dseis.ts). Linhas no formato das rotas
    /api/mapa-dseis/territorio, /localizacoes e /rede. Dados fictícios.
  */
  const TERRITORIO = [
    {
      dsei: "DSEI ALAGOAS E SERGIPE",
      uf: "AL",
      populacaoIndigena: 12000,
      qtdAldeias: 40,
      qtdTerrasIndigenas: 3,
      terras: [
        { codigo: "10", nome: "TERRA B", aldeias: [{ uf: "AL" }] },
        { codigo: "11", nome: "TERRA A", aldeias: [] },
        { codigo: "10", nome: "TERRA B", aldeias: [{ uf: "SE" }] },
      ],
    },
    {
      dsei: "Yanomami",
      populacaoIndigena: "",
      qtdAldeias: null,
      terras: 7,
    },
    { dsei: "", populacaoIndigena: 1 },
  ];
  const REDE = [
    {
      dsei: "DSEI ALAGOAS E SERGIPE",
      nome: "Polo Base Indígena Xitei",
      cnes: "1234567",
      uf: "al",
      municipio: "MACEIO",
      lat: -9.9,
      lng: -36,
      grupo: "u",
    },
    { dsei: "DSEI ALAGOAS E SERGIPE", nome: "Sem código", cnes: "" },
  ];

  describe("conversão", () => {
    it("território: população, aldeias e terras distintas por código", () => {
      const t = territorioPorDsei(TERRITORIO);
      expect(Object.keys(t)).toEqual(["ALAGOAS SERGIPE", "YANOMAMI"]);
      expect(t["ALAGOAS SERGIPE"]).toEqual({
        nome: "DSEI ALAGOAS E SERGIPE",
        populacao: 12000,
        aldeias: 40,
        terras: 2,
        listaDeTerras: [
          { codigo: "11", nome: "TERRA A" },
          { codigo: "10", nome: "TERRA B" },
        ],
      });
      // Campo vazio é dado ausente, não zero; `terras` número vale.
      expect(t.YANOMAMI).toMatchObject({
        populacao: null,
        aldeias: null,
        terras: 7,
      });
    });

    it("terras que atravessam dois DSEIs contam uma vez no total", () => {
      const t = territorioPorDsei([
        TERRITORIO[0],
        { ...TERRITORIO[0], dsei: "Xingu" },
      ]);
      expect(terrasDistintas(Object.values(t))).toBe(2);
    });

    it("acesso: as colunas da /todas viram meios, acessibilidade, localidade e floresta", () => {
      const linha = (campos: Record<string, unknown>) => ({
        CO_SEQ_LOCALIZACAO_POLO_BASE: "5",
        NO_DSEI: "ALAGOAS E SERGIPE",
        TP_UNIDADE: "POLO BASE",
        NO_LOTACAO: "POLO BASE XITEI",
        NU_CEP: "57370000",
        NO_MUNICIPIO: "TRAIPU",
        CG_LATITUDE: "-9.9",
        CG_LONGITUDE: "-36",
        ST_REGISTRO_ATIVO: "S",
        DS_OBSERVACAO: "texto livre",
        AU_USUARIO_INCLUSAO: "alguém",
        AU_DATA_INCLUSAO: "2026-01-01",
        ...campos,
      });
      const { polos } = localizacoesPorDsei([
        linha({
          TP_MEIO_ACESSO: "terrestre/FLUVIAL e aereo",
          TP_ACESSIBILIDADE_GEOGRAFICA: "MUITO REMOTO",
          TP_CATEGORIA_LOCALIDADE: "rural",
          ST_FLORESTA: "s",
        }),
        linha({
          CO_SEQ_LOCALIZACAO_POLO_BASE: "6",
          NO_LOTACAO: "UBSI BANANAL",
          TP_UNIDADE: "UNIDADE DE LOTAÇÃO",
          TP_MEIO_ACESSO: "",
          TP_ACESSIBILIDADE_GEOGRAFICA: null,
          TP_CATEGORIA_LOCALIDADE: "?",
          ST_FLORESTA: "NÃO",
        }),
      ])["ALAGOAS SERGIPE"] ?? { polos: [] };
      expect(polos[0]).toMatchObject({
        cod: "5",
        meios: ["Terrestre", "Fluvial", "Aéreo"],
        acessibilidade: "Muito remoto",
        localidade: "Rural",
        floresta: "Sim",
      });
      expect(polos[1]).toMatchObject({
        meios: ["Não informado"],
        acessibilidade: "Não informado",
        localidade: "Não informado",
        floresta: "Não",
      });
      // Auditoria e texto livre não saem da função.
      const campos = Object.keys(polos[0] ?? {});
      for (const fora of [
        "DS_OBSERVACAO",
        "AU_USUARIO_INCLUSAO",
        "AU_DATA_INCLUSAO",
      ])
        expect(campos).not.toContain(fora);
      expect(JSON.stringify(polos)).not.toContain("texto livre");
    });

    it("CNES: só com código, e casa com a unidade pelo nome", () => {
      const rede = estabelecimentosDoCnes(REDE);
      expect(rede).toEqual([
        {
          dsei: "ALAGOAS SERGIPE",
          nome: "Polo Base Indígena Xitei",
          cnes: "1234567",
          uf: "AL",
          municipio: "MACEIO",
          lat: -9.9,
          lon: -36,
        },
      ]);
      expect(
        cnesDaUnidade("POLO BASE XITEI", "ALAGOAS SERGIPE", rede)?.cnes,
      ).toBe("1234567");
      expect(cnesDaUnidade("POLO BASE XITEI", "YANOMAMI", rede)).toBeNull();
      expect(cnesDaUnidade("UBSI BANANAL", "ALAGOAS SERGIPE", rede)).toBeNull();
    });

    it("a chave do DSEI casa com a do mapa (KAYAPO × KAIAPO)", () => {
      const doMapa = ["KAIAPO PARA", "LESTE RORAIMA", "YANOMAMI"];
      expect(casarChaveDoDsei("KAYAPO PARA", doMapa)).toBe("KAIAPO PARA");
      expect(casarChaveDoDsei("YANOMAMI", doMapa)).toBe("YANOMAMI");
      expect(casarChaveDoDsei("XINGU", doMapa)).toBeNull();
    });

    it("o motivo diz qual liberação pedir", () => {
      expect(motivoDaFalha(401)).toBe("a chave do Yeendé não lê esta rota");
      expect(motivoDaFalha(403)).toBe("a chave do Yeendé não lê esta rota");
      expect(motivoDaFalha(404)).toBe("a rota não existe no SIGEPSI");
      expect(motivoDaFalha(null)).toBe("o SIGEPSI não respondeu");
      expect(motivoDaFalha(500)).toBe("o SIGEPSI respondeu 500");
    });

    it("os campos do diagnóstico são só nomes", () => {
      expect(camposDasLinhas(REDE)).toEqual([
        "cnes",
        "dsei",
        "grupo",
        "lat",
        "lng",
        "municipio",
        "nome",
        "uf",
      ]);
    });
  });

  describe("/api/territorio-dos-dseis", () => {
    const ambiente = { ...process.env };
    const original = globalThis.fetch;

    beforeEach(async () => {
      process.env.VITE_SUPABASE_URL = "https://banco.exemplo";
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "pub";
      process.env.SIGEPSI_API_TOKEN = "segredo";
      const { esquecerCache } = await import("../api/territorio-dos-dseis.ts");
      esquecerCache();
    });
    afterEach(() => {
      process.env = { ...ambiente };
      globalThis.fetch = original;
      vi.restoreAllMocks();
    });

    async function chamar(headers: Record<string, string> = {}) {
      const { default: handler } =
        await import("../api/territorio-dos-dseis.ts");
      const gravado = {
        codigo: 0,
        cabecalhos: {} as Record<string, string>,
        corpo: "",
      };
      const res: Pick<RespostaDaVercel, "status" | "setHeader" | "end"> = {
        status(codigo) {
          gravado.codigo = codigo;
          return res as RespostaDaVercel;
        },
        setHeader(nome, valor) {
          gravado.cabecalhos[nome] = String(valor);
          return res as RespostaDaVercel;
        },
        end(corpo?: unknown) {
          gravado.corpo = String(corpo ?? "");
          return res as RespostaDaVercel;
        },
      };
      const pedido: Pick<PedidoDaVercel, "method" | "headers"> = {
        method: "GET",
        headers,
      };
      await handler(pedido as PedidoDaVercel, res as RespostaDaVercel);
      const json: unknown = gravado.corpo ? JSON.parse(gravado.corpo) : null;
      return { ...gravado, json };
    }

    const urlDe = (entrada: Parameters<typeof fetch>[0]) =>
      typeof entrada === "string"
        ? entrada
        : entrada instanceof URL
          ? entrada.href
          : entrada.url;

    /* O SIGEPSI falso: cada rota com a sua lista; `status` nega uma rota. */
    function sigepsi(status: Record<string, number> = {}) {
      return vi.fn<typeof fetch>(async (entrada) => {
        const url = urlDe(entrada);
        if (url.endsWith("/auth/v1/user")) return new Response("{}");
        const rota = new URL(url).pathname;
        const negada = status[rota];
        if (negada) return new Response("", { status: negada });
        const corpo =
          rota === "/api/mapa-dseis/territorio"
            ? TERRITORIO
            : rota === "/api/mapa-dseis/rede"
              ? REDE
              : { erro: "rota que a função não deveria ler" };
        return new Response(JSON.stringify(corpo));
      });
    }

    it("sem sessão, 401 sem chamar o SIGEPSI", async () => {
      const fetchFalso = sigepsi();
      globalThis.fetch = fetchFalso;
      expect((await chamar()).codigo).toBe(401);
      expect(fetchFalso).not.toHaveBeenCalled();
    });

    it("lê as duas rotas com o token do servidor, e nunca a da força de trabalho", async () => {
      const fetchFalso = sigepsi();
      globalThis.fetch = fetchFalso;
      const r = await chamar({ authorization: "Bearer sessao" });
      expect(r.codigo).toBe(200);
      const rotas = fetchFalso.mock.calls
        .map(([entrada]) => new URL(urlDe(entrada)).pathname)
        .filter((rota) => rota.startsWith("/api/"))
        .sort();
      expect(rotas).toEqual([
        "/api/mapa-dseis/rede",
        "/api/mapa-dseis/territorio",
      ]);
      for (const [entrada, opcoes] of fetchFalso.mock.calls)
        if (urlDe(entrada).includes("sigepsi"))
          expect(new Headers(opcoes?.headers).get("Authorization")).toBe(
            "Bearer segredo",
          );
      expect(r.corpo).not.toContain("segredo");
      expect(r.cabecalhos["Cache-Control"]).toMatch(/^private/);
      expect(r.json).toMatchObject({
        territorio: { ok: true, linhas: 3 },
        cnes: { ok: true, linhas: 2, campos: expect.arrayContaining(["cnes"]) },
      });
    });

    it("rota negada não derruba as outras e diz o porquê", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      globalThis.fetch = sigepsi({ "/api/mapa-dseis/territorio": 403 });
      const r = await chamar({ authorization: "Bearer sessao" });
      expect(r.codigo).toBe(200);
      expect(r.json).toMatchObject({
        territorio: {
          ok: false,
          status: 403,
          motivo: "a chave do Yeendé não lê esta rota",
        },
        cnes: { ok: true },
      });
    });

    it("guarda o que leu: a segunda chamada só confere a sessão", async () => {
      const fetchFalso = sigepsi();
      globalThis.fetch = fetchFalso;
      await chamar({ authorization: "Bearer sessao" });
      await chamar({ authorization: "Bearer sessao" });
      // 2 sessões + 2 rotas.
      expect(fetchFalso).toHaveBeenCalledTimes(4);
    });
  });
});

bloco("lib/ponto-sem-cep-no-mapa-do-dsei", () => {
  /*
  PONTO DO SIGEPSI SEM CEP: VÍNCULO NÃO CLASSIFICADO

  A UF de cada ponto vem só do CEP (`ufDoCep`, localizacoes-do-sigepsi.ts).
  Sem CEP, o ponto não herda a UF da sede: herdar escondia a unidade de fora
  da área, sempre contada como local. Fica indeterminado (desenhado e contado
  como local no enquadramento, sem afirmar que está dentro), e a dica avisa.
  Dados fictícios.
*/

  const dsei: DseiDoMapa = {
    k: "TESTE",
    n: "Teste",
    lat: -9.6,
    lon: -35.7,
    sedeuf: "AL",
    ufs: ["AL"],
    polos: [
      { n: "POLO COM CEP", lat: -9.9, lon: -36.0, uf: "AL", tipo: "polo" },
      { n: "POLO FORA", lat: -8.0, lon: -35.0, uf: "PE", tipo: "polo" },
      { n: "UBSI SEM CEP", lat: -10.1, lon: -36.4, uf: "", tipo: "unidade" },
    ],
  };

  describe("ponto do SIGEPSI sem CEP no mapa do DSEI", () => {
    const classificados = classificarRegistros(registrosDoDsei(dsei), dsei);
    const porNome = (nome: string) => {
      const achado = classificados.find((r) => r.name === nome);
      if (!achado) throw new Error(`sem ${nome}`);
      return achado;
    };

    it("não herda a UF da sede: o vínculo fica indeterminado", () => {
      const semCep = porNome("UBSI SEM CEP");
      expect(semCep.uf).toBe("");
      expect(semCep.vinculo).toBe(VINCULO_INDETERMINADO);
      expect(semCep.ufAdministrativa).toBeNull();
    });

    it("a dica diz que a UF não veio do SIGEPSI", () => {
      expect(dicaDoRegistro(porNome("UBSI SEM CEP"), dsei).linhas).toContain(
        "UF não informada no SIGEPSI (sem CEP) — vínculo não classificado",
      );
    });

    it("com CEP, segue a UF do CEP: dentro ou fora da área", () => {
      expect(porNome("POLO COM CEP").vinculo).toBe(VINCULO_NORMAL);
      expect(porNome("POLO FORA").vinculo).toBe(VINCULO_EXTERNO);
    });
  });
});

bloco("lib/relatorio-da-diretoria", () => {
  const SI = "e1";
  const PROJ = "e2";

  /* Dados fictícios no formato de listar_vagas_por_cargo_da_visao_geral. */
  const bruto = {
    vagas: [
      {
        monitoramento_id: SI,
        codigo: "178534",
        vaga: "Enfermeiro - CASAI Brasília - 2 vagas (1 AC + 1 Pretos e Pardos + CR)",
        cargo:
          "Enfermeiro - CASAI Brasília - 2 vagas (1 AC + 1 Pretos e Pardos + CR)",
        unidade: "CASAI Brasília",
        inscritos: 1366,
      },
      {
        monitoramento_id: SI,
        codigo: "178532",
        vaga: "Assistente Social 30h - CASAI Brasília - 1 vaga (1 AC + CR)",
        cargo: "Assistente Social 30h - CASAI Brasília - 1 vaga (1 AC + CR)",
        unidade: "CASAI Brasília",
        inscritos: 244,
      },
      {
        monitoramento_id: SI,
        codigo: "178535",
        vaga: "Farmacêutico - CASAI Brasília - Cadastro Reserva",
        cargo: "Farmacêutico - CASAI Brasília - Cadastro Reserva",
        unidade: "CASAI Brasília",
        inscritos: 486,
      },
      {
        monitoramento_id: PROJ,
        codigo: null,
        vaga: "CARGO 1: ASSISTENTE DE PROJETO – GAB DAIS – SEDE AGSUS",
        cargo: "CARGO 1: ASSISTENTE DE PROJETO – GAB DAIS – SEDE AGSUS",
        unidade: "Sede",
        inscritos: 900,
      },
      {
        monitoramento_id: PROJ,
        codigo: "128074",
        vaga: "128074",
        cargo: "Assistente de Projetos",
        unidade: "Sede",
        inscritos: "12",
      },
      { monitoramento_id: "", vaga: "sem edital" },
      "lixo",
    ],
    quadro: [
      {
        monitoramento_id: SI,
        cargo: "Enfermeiro",
        lotacao: "CASAI Brasília",
        vagas: 2,
        reserva: true,
      },
      /* Sem acento e sem carga horária: casa com "Assistente Social 30h". */
      {
        monitoramento_id: SI,
        cargo: "Assistente social",
        lotacao: null,
        vagas: 1,
      },
      { monitoramento_id: SI, cargo: "Farmaceutico", lotacao: "", vagas: 0 },
      { monitoramento_id: SI, cargo: "Psicólogo", lotacao: "", vagas: 1 },
    ],
    lista: [
      {
        monitoramento_id: SI,
        codigo_vaga: "178534",
        cargo: "Enfermeiro …",
        aprovados: 7,
      },
      {
        monitoramento_id: SI,
        codigo_vaga: "178532",
        cargo: "Assistente …",
        aprovados: 2,
      },
      /* Vaga que não está na Seleção: linha própria. */
      {
        monitoramento_id: SI,
        codigo_vaga: "999999",
        cargo: "Nutricionista - CASAI Brasília - Cadastro Reserva",
        aprovados: 3,
      },
      /* Projetos: o texto da vaga no lugar do código. */
      {
        monitoramento_id: PROJ,
        codigo_vaga: "CARGO 1: ASSISTENTE DE PROJETO – GAB DAIS – SEDE AGSUS",
        cargo: "CARGO 1: ASSISTENTE DE PROJETO – GAB DAIS – SEDE AGSUS",
        aprovados: 40,
      },
      /* SEDE: "128074 CARGO" → o número do começo. */
      {
        monitoramento_id: PROJ,
        codigo_vaga: "128074 ASSISTENTE DE PROJETOS",
        cargo: "128074 ASSISTENTE DE PROJETOS",
        aprovados: 5,
      },
      { monitoramento_id: "fora", codigo_vaga: "1", cargo: "x", aprovados: 1 },
    ],
  };

  const editais = [
    { id: PROJ, edital: "04/2026", unidade: "Sede" },
    { id: SI, edital: "100/2026", unidade: "CASAI Brasília" },
  ];

  describe("aba 2: vagas por cargo", () => {
    it("normaliza a resposta e descarta o que não serve", () => {
      const dados = normalizarVagasPorCargo(bruto);
      expect(dados.vagas).toHaveLength(5);
      expect(dados.vagas[4]?.inscritos).toBe(12);
      expect(dados.vagas[3]?.codigo).toBe("");
      expect(dados.quadro).toHaveLength(4);
      expect(dados.quadro[0]?.reserva).toBe(true);
      expect(dados.lista).toHaveLength(6);
      expect(normalizarVagasPorCargo(null)).toEqual({
        vagas: [],
        quadro: [],
        lista: [],
      });
    });

    it("compara textos sem acento, maiúscula nem pontuação", () => {
      expect(chaveDoTexto("  Farmacêutico – CASAI/Brasília ")).toBe(
        "farmaceutico casai brasilia",
      );
    });

    it("lê as vagas imediatas do texto da vaga", () => {
      expect(vagasPeloTexto("Enfermeiro - X - 2 vagas (1 AC + CR)")).toBe(2);
      expect(vagasPeloTexto("Médico - X - 1 vaga (1 AC + CR)")).toBe(1);
      expect(vagasPeloTexto("Pedagogo - X - Cadastro Reserva")).toBe(0);
      expect(
        vagasPeloTexto("Técnico Químico - Abrangência do DSEI"),
      ).toBeNull();
    });

    it("liga lista e quadro a cada vaga, na ordem dos editais do recorte", () => {
      const linhas = linhasPorCargo(normalizarVagasPorCargo(bruto), editais);
      expect(
        linhas.map((l) => [
          l.edital,
          l.vaga,
          l.vagasImediatas,
          l.inscritos,
          l.aprovados,
        ]),
      ).toEqual([
        ["04/2026", "Assistente de Projetos", null, 12, 5],
        [
          "04/2026",
          "CARGO 1: ASSISTENTE DE PROJETO – GAB DAIS – SEDE AGSUS",
          null,
          900,
          40,
        ],
        [
          "100/2026",
          "Assistente Social 30h - CASAI Brasília - 1 vaga (1 AC + CR)",
          1,
          244,
          2,
        ],
        [
          "100/2026",
          "Enfermeiro - CASAI Brasília - 2 vagas (1 AC + 1 Pretos e Pardos + CR)",
          2,
          1366,
          7,
        ],
        [
          "100/2026",
          "Farmacêutico - CASAI Brasília - Cadastro Reserva",
          0,
          486,
          0,
        ],
        [
          "100/2026",
          "Nutricionista - CASAI Brasília - Cadastro Reserva",
          0,
          null,
          3,
        ],
      ]);
      // O edital fora do recorte não entra; a soma dos aprovados bate com a lista.
      expect(linhas.reduce((s, l) => s + l.aprovados, 0)).toBe(57);
    });

    it("liga pelo começo do texto quando a lista acrescenta a modalidade", () => {
      const dados = normalizarVagasPorCargo({
        vagas: [
          {
            monitoramento_id: PROJ,
            codigo: "1",
            vaga: "1",
            cargo: "CARGO 1: ASSISTENTE - PIAUÍ",
            inscritos: 10,
          },
          {
            monitoramento_id: PROJ,
            codigo: "2",
            vaga: "2",
            cargo: "CARGO 1: ASSISTENTE - PIAUÍ - POLO NORTE",
            inscritos: 4,
          },
        ],
        quadro: [],
        lista: [
          {
            monitoramento_id: PROJ,
            codigo_vaga: "CARGO 1: ASSISTENTE - PIAUÍ - AMPLA CONCORRÊNCIA",
            cargo: "CARGO 1: ASSISTENTE - PIAUÍ - AMPLA CONCORRÊNCIA",
            aprovados: 6,
          },
          {
            monitoramento_id: PROJ,
            codigo_vaga: "CARGO 1: ASSISTENTE - PIAUÍ - POLO NORTE - PCD",
            cargo: "x",
            aprovados: 1,
          },
        ],
      });
      expect(
        linhasPorCargo(dados, [{ id: PROJ, edital: "97/2025" }]).map((l) => [
          l.inscritos,
          l.aprovados,
        ]),
      ).toEqual([
        [10, 6],
        [4, 1],
      ]);
    });

    it('casa o quadro pela unidade, sem "(a)" nem carga horária, e pela lotação cortada', () => {
      const dados = normalizarVagasPorCargo({
        vagas: [
          {
            monitoramento_id: SI,
            codigo: "104116",
            vaga: "104116",
            cargo: "Técnico (a) de Enfermagem",
            unidade: "DSEI Alto Rio Solimões",
          },
          {
            monitoramento_id: SI,
            codigo: "104004",
            vaga: "104004",
            cargo: "Cirurgião Dentista (40h)",
            unidade: "DSEI Alto Rio Solimões",
          },
          {
            monitoramento_id: SI,
            codigo: "104005",
            vaga: "104005",
            cargo: "Enfermeiro - Polo Base Barra do Cord...",
            unidade: "DSEI Maranhão",
          },
        ],
        quadro: [
          {
            monitoramento_id: SI,
            cargo: "Enfermeiro",
            lotacao: "Polo Base Barra do Corda",
            vagas: 2,
          },
          {
            monitoramento_id: SI,
            cargo: "Técnico de Enfermagem",
            lotacao: "DSEI Alto Rio Solimões",
            vagas: 4,
          },
          {
            monitoramento_id: SI,
            cargo: "Cirurgião Dentista",
            lotacao: "Polo X",
            vagas: 9,
          },
        ],
        lista: [],
      });
      expect(
        linhasPorCargo(dados, [{ id: SI, edital: "03/2025" }]).map((l) => [
          l.vaga,
          l.vagasImediatas,
        ]),
      ).toEqual([
        ["Cirurgião Dentista (40h)", null],
        ["Enfermeiro - Polo Base Barra do Cord...", 2],
        ["Técnico (a) de Enfermagem", 4],
      ]);
    });

    it("não reparte um item do quadro entre duas vagas: usa o texto de cada uma", () => {
      const dados = normalizarVagasPorCargo({
        vagas: [
          {
            monitoramento_id: SI,
            codigo: "1",
            vaga: "Enfermeiro - Polo A - 1 vaga (1 AC)",
          },
          {
            monitoramento_id: SI,
            codigo: "2",
            vaga: "Enfermeiro - Polo B - Cadastro Reserva",
          },
        ],
        quadro: [
          { monitoramento_id: SI, cargo: "Enfermeiro", lotacao: "", vagas: 5 },
        ],
        lista: [],
      });
      expect(
        linhasPorCargo(dados, [{ id: SI, edital: "1/2026" }]).map(
          (l) => l.vagasImediatas,
        ),
      ).toEqual([1, 0]);
    });
  });

  describe("aba 3: aprovados", () => {
    const resposta = {
      exportacao_id: "reg-1",
      emitida_em: "2026-11-16T12:00:00Z",
      registros: 3,
      aprovados: [
        {
          monitoramento_id: SI,
          cargo: "Enfermeiro - CASAI Brasília",
          nota: 87.5,
          classificacao: 1,
          nome: "Pessoa Fictícia Um",
          status: "Contratado",
          matricula: "000123",
          admissao: "2026-03-02",
        },
        {
          monitoramento_id: SI,
          cargo: "Enfermeiro - CASAI Brasília",
          nota: null,
          classificacao: null,
          nome: "Pessoa Fictícia Dois",
          status: null,
          matricula: null,
          admissao: null,
        },
        { monitoramento_id: "fora", cargo: "x", nome: "Fora do recorte" },
      ],
    };

    it("recusa a resposta sem o registro do download", () => {
      expect(() => normalizarAprovadosDaDiretoria({ aprovados: [] })).toThrow(
        /não registrou/,
      );
    });

    it("monta as linhas com nota, status, matrícula e admissão", () => {
      const exportacao = normalizarAprovadosDaDiretoria(resposta);
      expect(exportacao.id).toBe("reg-1");
      expect(linhasDeAprovados(exportacao.aprovados, editais)).toEqual([
        [
          "100/2026",
          "Enfermeiro - CASAI Brasília",
          "87,5",
          "1",
          "Pessoa Fictícia Um",
          "Contratado",
          "000123",
          "02/03/2026",
        ],
        [
          "100/2026",
          "Enfermeiro - CASAI Brasília",
          "—",
          "—",
          "Pessoa Fictícia Dois",
          "Sem status",
          "—",
          "—",
        ],
      ]);
    });

    it("soma os aprovados do recorte pela contagem de cada edital", () => {
      expect(
        aprovadosNoRecorte([
          { aprovados: 10 },
          { aprovados: null },
          {},
          { aprovados: 5 },
        ]),
      ).toBe(15);
    });
  });

  describe("as abas no montador", () => {
    const base = {
      linhas: [],
      filtros: filtrosVazios(),
      area: "saude-indigena",
      rotuloDaArea: "Saúde Indígena",
      indicadores: {
        processos: 0,
        vagas: 0,
        reabertas: 0,
        contratadas: 0,
        emSelecao: 0,
        ociosas: 0,
        alemDasVagas: 0,
        criticos: 0,
        inscritos: 0,
        editais: 0,
        inscritosInformados: 0,
        editaisComResultado: 0,
        editaisSemResultado: 0,
      },
      agora: new Date("2026-11-16T12:00:00Z"),
    } satisfies Omit<Parameters<typeof conteudoDoRelatorio>[0], "escolha">;

    it("o modelo Diretoria leva editais, vagas por cargo e aprovados em Excel", () => {
      const diretoria = MODELOS_DO_RELATORIO.find((m) => m.id === "diretoria");
      expect(diretoria?.escolha.secoes).toEqual([
        "editais",
        "cargos",
        "aprovados",
      ]);
      expect(diretoria?.escolha.formato).toBe("XLSX");
      expect(normalizarEscolha(diretoria?.escolha).secoes).toEqual([
        "editais",
        "cargos",
        "aprovados",
      ]);
    });

    it("só quem vê a Lista de aprovados pode gerar a aba Aprovados", () => {
      expect(secoesPermitidas(false)).not.toContain("aprovados");
      expect(secoesPermitidas(true)).toContain("aprovados");
    });

    it("as abas viram tabelas e planilhas, com número como número", () => {
      const conteudo = conteudoDoRelatorio({
        ...base,
        escolha: {
          secoes: ["cargos", "aprovados"],
          colunas: ["edital"],
          formato: "XLSX",
        },
        porCargo: linhasPorCargo(normalizarVagasPorCargo(bruto), editais),
        aprovados: {
          linhas: [
            [
              "100/2026",
              "Enfermeiro",
              "87,5",
              "1",
              "Pessoa Fictícia",
              "Contratado",
              "000123",
              "02/03/2026",
            ],
          ],
          registro: "reg-1",
        },
      });
      expect(conteudo.tabelas.map((t) => t.titulo)).toEqual([
        "Vagas por cargo",
        "Aprovados",
      ]);
      expect(conteudo.identificacao).toContainEqual([
        "Registro do download",
        "reg-1",
      ]);
      const [, cargos, aprovados] = planilhasDoRelatorio(conteudo);
      expect(cargos?.nome).toBe("Vagas por cargo");
      expect(cargos?.linhas[0]).toEqual([
        "Edital",
        "Unidade",
        "Vaga",
        "Vagas imediatas",
        "Inscritos",
        "Aprovados",
      ]);
      // "—" vira célula vazia; inscritos e aprovados, números.
      expect(cargos?.linhas[1]?.slice(3)).toEqual(["", 12, 5]);
      expect(aprovados?.linhas[1]).toEqual([
        "100/2026",
        "Enfermeiro",
        87.5,
        1,
        "Pessoa Fictícia",
        "Contratado",
        "000123",
        "02/03/2026",
      ]);
    });

    it("sem as linhas do banco, a seção não sai (nem o registro)", () => {
      const conteudo = conteudoDoRelatorio({
        ...base,
        escolha: {
          secoes: ["cargos", "aprovados"],
          colunas: ["edital"],
          formato: "PDF",
        },
      });
      expect(conteudo.tabelas).toEqual([]);
      expect(conteudo.identificacao.map(([r]) => r)).not.toContain(
        "Registro do download",
      );
    });
  });
});

bloco("lib/relatorio-da-visao-geral", () => {
  /*
  O MONTADOR DE RELATÓRIO DA VISÃO GERAL (13/11/2026: "no SIGEPSI você
  consegue montar o relatório do jeito que quiser")

  A escolha (seções, colunas, formato), os modelos prontos, o conteúdo tirado
  do recorte da tela, o Excel com uma aba por seção e o PDF desenhado (não a
  impressão da tela). Dados fictícios.
*/

  function linha(parcial: Partial<LinhaDaVisaoGeral>): LinhaDaVisaoGeral {
    return {
      fase: "Concluído",
      atencao: [],
      pos_resultado: [],
      desistentes: 0,
      aprovados: null,
      cadastro_reserva: null,
      primeira_admissao: null,
      ultima_admissao: null,
      admissoes: 0,
      ...parcial,
    };
  }

  const LINHAS = [
    linha({
      id: "e1",
      edital: "04/2099",
      unidade: "DSEI Exemplo",
      ciclo: "1º ciclo",
      status: "Concluído",
      data_inicio: "2099-02-20",
      data_fim: "2099-06-16",
      vagas_total: 59,
      inscritos: 3256,
      contratados: 110,
      vagas_ociosas: 0,
      aprovados: 2417,
      primeira_admissao: "2099-05-12",
      ultima_admissao: "2100-06-11",
      admissoes: 111,
    }),
    linha({
      id: "e2",
      edital: "70/2099",
      unidade: "DSEI Teste",
      ciclo: "",
      status: "Concluído",
      vagas_total: 10,
      contratados: 4,
      vagas_ociosas: 6,
      inscritos: null,
      atencao: [
        { codigo: "contratacao", rotulo: "Contratação abaixo de 50%", tom: "" },
      ],
    }),
  ];

  const INDICADORES: Indicadores = {
    processos: 2,
    vagas: 69,
    reabertas: 0,
    contratadas: 63,
    emSelecao: 0,
    ociosas: 6,
    alemDasVagas: 51,
    criticos: 1,
    inscritos: 3256,
    editais: 2,
    inscritosInformados: 2,
    editaisComResultado: 2,
    editaisSemResultado: 0,
  };

  const conteudo = (escolha = MODELOS_DO_RELATORIO[1]!.escolha) =>
    conteudoDoRelatorio({
      escolha,
      linhas: LINHAS,
      filtros: { ...filtrosVazios(), ciclo: ["1º ciclo"] },
      area: "saude-indigena",
      rotuloDaArea: "Saúde Indígena",
      indicadores: INDICADORES,
      quem: "Pessoa Exemplo",
      agora: new Date("2099-11-13T15:00:00Z"),
    });

  describe("a escolha", () => {
    it("normaliza: só seções e colunas conhecidas, na ordem da tela; formato válido", () => {
      expect(
        normalizarEscolha({
          secoes: ["editais", "invasora", "numeros"],
          colunas: ["status", "edital", "observacoes", "x"],
          formato: "XLSX",
        }),
      ).toEqual({
        secoes: ["numeros", "editais"],
        colunas: ["edital", "status"],
        formato: "XLSX",
      });
      expect(normalizarEscolha(null)).toEqual(MODELOS_DO_RELATORIO[0]!.escolha);
      expect(normalizarEscolha({ formato: "DOC" }).formato).toBe("PDF");
    });

    it("marcar e desmarcar mantém a ordem e ao menos um item", () => {
      const todos = ["a", "b", "c"] as const;
      expect(alternarNaEscolha(todos, ["c"], "a")).toEqual(["a", "c"]);
      expect(alternarNaEscolha(todos, ["a", "c"], "a")).toEqual(["c"]);
      expect(alternarNaEscolha(todos, ["c"], "c")).toEqual(["c"]);
    });

    it("reconhece o modelo pronto; mexeu, vira personalizado", () => {
      const diretoria = MODELOS_DO_RELATORIO.find((m) => m.id === "diretoria")!;
      expect(modeloDaEscolha(diretoria.escolha)).toBe("diretoria");
      expect(modeloDaEscolha({ ...diretoria.escolha, formato: "PDF" })).toBe(
        "",
      );
    });

    it("o modelo da diretoria: número, DSEI, vagas, divulgação, encerramento e ciclo", () => {
      const diretoria = MODELOS_DO_RELATORIO.find((m) => m.id === "diretoria")!;
      expect(diretoria.escolha.colunas).toEqual([
        "edital",
        "unidade",
        "vagas_total",
        "data_inicio",
        "data_fim",
        "ciclo",
      ]);
    });
  });

  describe("o conteúdo", () => {
    it("identificação com área, recorte, processos, data e quem gerou", () => {
      const c = conteudo();
      expect(Object.fromEntries(c.identificacao)).toMatchObject({
        Área: "Saúde Indígena",
        Recorte: "Ciclo: 1º ciclo",
        Processos: "2",
        "Gerado por": "Pessoa Exemplo",
      });
      expect(c.geradoEm).toBe("13/11/2099, 12:00");
    });

    it("os números com os rótulos dos indicadores", () => {
      const numeros = Object.fromEntries(conteudo().numeros || []);
      expect(numeros["Vagas imediatas"]).toBe("69");
      expect(Object.values(numeros)).toContain("3.256");
    });

    it("as colunas como a tela: datas, '—', contratados com o CR e a taxa de ociosas", () => {
      expect(textoDaColuna("primeira_admissao", LINHAS[0]!)).toBe("12/05/2099");
      expect(textoDaColuna("inscritos", LINHAS[1]!)).toBe("—");
      expect(textoDaColuna("ciclo", LINHAS[1]!)).toBe("—");
      expect(textoDaColuna("contratados", LINHAS[0]!)).toBe("59 +51 além");
      expect(textoDaColuna("vagas_ociosas", LINHAS[1]!)).toBe("6 (60%)");
      expect(textoDaColuna("duracao", LINHAS[0]!)).toBe("116");
    });

    it("só as seções escolhidas; 'atenção' lista só quem pede atenção", () => {
      const c = conteudo();
      expect(c.tabelas.map((t) => t.titulo)).toEqual([
        "Editais",
        "Editais que pedem atenção",
      ]);
      expect(c.tabelas[1]!.linhas).toEqual([
        ["70/2099", "DSEI Teste", "Concluído", "Contratação abaixo de 50%"],
      ]);
      const soTabela = conteudo({
        secoes: ["editais"],
        colunas: ["edital", "ciclo"],
        formato: "PDF",
      });
      expect(soTabela.numeros).toBeNull();
      expect(soTabela.tabelas[0]!.linhas).toEqual([
        ["04/2099", "1º ciclo"],
        ["70/2099", "—"],
      ]);
    });
  });

  describe("os arquivos", () => {
    it("Excel: Resumo e uma aba por tabela, com números como número", () => {
      const planilhas = planilhasDoRelatorio(conteudo());
      expect(planilhas.map((p) => p.nome)).toEqual([
        "Resumo",
        "Editais",
        "Editais que pedem atenção",
      ]);
      const editais = planilhas[1]!;
      const vagas = (editais.linhas[0] as string[]).indexOf("Vagas");
      expect(editais.linhas[1]![vagas]).toBe(59);
      const zip = unzipSync(
        xlsxDoRelatorio(conteudo(), (arquivos, opcoes) =>
          zipSync(arquivos, opcoes),
        ),
      );
      expect(strFromU8(zip["xl/workbook.xml"]!)).toContain('name="Editais"');
    });

    it("PDF desenhado: título, área, tabela e rodapé com páginas", async () => {
      const libs = await carregarBibliotecasDoPdf();
      const bytes = await pdfDoRelatorio(conteudo(), libs, {
        comprimir: false,
      });
      const texto = new TextDecoder("latin1").decode(bytes);
      expect(texto.startsWith("%PDF-")).toBe(true);
      for (const trecho of ["Relat", "04/2099", "DSEI Teste", "gina 1 de 1"])
        expect(texto).toContain(trecho);
    });

    it("o nome do arquivo tem a área, o dia e a extensão do formato", () => {
      const agora = new Date("2099-11-13T15:00:00Z");
      expect(nomeDoArquivoDoRelatorio("saude-indigena", "PDF", agora)).toBe(
        "Yeende_Relatorio_SaudeIndigena_20991113.pdf",
      );
      expect(nomeDoArquivoDoRelatorio("sede", "XLSX", agora)).toMatch(
        /\.xlsx$/,
      );
    });
  });

  describe("o recorte da área inteira (montador nos Painéis)", () => {
    it("leva todos os editais da área, sem filtro, busca nem atalho", () => {
      const recorte = recorteDaAreaInteira("saude-indigena", LINHAS);
      expect(recorte).toEqual({
        area: "saude-indigena",
        filtradas: LINHAS,
        filtros: filtrosVazios(),
        busca: "",
        atalho: "",
        indicadores: indicadoresDaVisaoGeral(LINHAS),
      });
    });
  });

  describe("na tela", () => {
    it("o Exportar da Visão geral abre o montador; o menu da conta não tem mais", () => {
      const tela = readFileSync(
        "src/modulos/visao-geral/visao-geral.tsx",
        "utf8",
      );
      expect(tela).toContain("aoExportar={estado.abrirMontador}");
      expect(tela).toContain("<MontadorDeRelatorio");
      // 16/11/2026: o "Montar relatório" saiu do menu da conta para os Painéis.
      const sistema = readFileSync("src/app/sistema.ts", "utf8");
      expect(sistema).not.toContain("exportPDF");
      const topo = readFileSync("src/app/casca/topo.tsx", "utf8");
      expect(topo).not.toContain("Montar relatório");
    });
  });
});

bloco("lib/vagas-reabertas", () => {
  const edital = (
    campos: Partial<LinhaDoMonitoramento>,
  ): LinhaDoMonitoramento => ({
    unidade: "DSEI Altamira",
    sigla_unidade: "ALT",
    status: "Concluído",
    contratados: 0,
    ...campos,
  });

  /* Cargos por edital: cargo → vagas do quadro (null = sem quadro). */
  /*
  Cargos por edital: texto → vagas do quadro (null = sem quadro), ou
  { codigo, vagas } para o cargo oficial (co_cargo).
*/
  type CargoDoTeste = number | null | { codigo: number; vagas: number | null };
  const cargos = (porEdital: Record<string, Record<string, CargoDoTeste>>) =>
    new Map(
      Object.entries(porEdital).map(([id, c]) => [
        id,
        new Map(
          Object.entries(c).map(([texto, valor]) => {
            const oficial = valor !== null && typeof valor === "object";
            const codigo = oficial ? String(valor.codigo) : null;
            const vagas = oficial ? valor.vagas : valor;
            return [
              codigo ? `c:${codigo}` : `t:${texto}`,
              { codigo, texto, vagas },
            ];
          }),
        ),
      ]),
    );

  describe("chaveDoCargo", () => {
    it("compara o cargo sem lotação, cota, parênteses, carga horária nem cadastro reserva", () => {
      expect(chaveDoCargo("Enfermeiro - PPP")).toBe("enfermeiro");
      expect(chaveDoCargo("Enfermeiro - Pólo Base Aquidauana")).toBe(
        "enfermeiro",
      );
      expect(chaveDoCargo("Antropólogo - Cadastro Reserva")).toBe(
        "antropologo",
      );
      expect(chaveDoCargo("Cirurgião Dentista (40h) -")).toBe(
        "cirurgiao dentista",
      );
      expect(chaveDoCargo("Cirurgião Dentista 40h -")).toBe(
        "cirurgiao dentista",
      );
      expect(chaveDoCargo("Analista Técnico em Saúde Indígena")).toBe(
        chaveDoCargo("Analista Técnico de Saúde Indígena"),
      );
      expect(
        chaveDoCargo("1 | Analista Técnico de Saúde Indígena - Aracruz/ES"),
      ).toBe("analista tecnico saude indigena");
      expect(chaveDoCargo("")).toBe("");
    });
  });

  describe("cargosDaResposta", () => {
    it("soma o quadro por cargo e acrescenta os cargos da Seleção sem quantidade", () => {
      const porEdital = cargosDaResposta({
        quadro: [
          {
            monitoramento_id: "a",
            cargo: "Enfermeiro",
            lotacao: "Polo 1",
            vagas: 2,
          },
          {
            monitoramento_id: "a",
            cargo: "Enfermeiro",
            lotacao: "Polo 2",
            vagas: 1,
          },
        ],
        vagas: [
          {
            monitoramento_id: "a",
            codigo: "1",
            vaga: "1",
            cargo: "Enfermeiro - PPP",
          },
          { monitoramento_id: "a", codigo: "2", vaga: "2", cargo: "Psicólogo" },
          // Só o código, sem cargo: não serve para comparar.
          { monitoramento_id: "b", codigo: "3", vaga: "117222", cargo: "" },
        ],
        lista: [],
      });
      expect(porEdital.get("a")).toEqual(
        new Map([
          ["t:enfermeiro", { codigo: null, texto: "enfermeiro", vagas: 3 }],
          ["t:psicologo", { codigo: null, texto: "psicologo", vagas: null }],
        ]),
      );
      expect(porEdital.has("b")).toBe(false);
    });

    it("com o cargo oficial, grafias diferentes do mesmo cargo viram um só", () => {
      const porEdital = cargosDaResposta({
        quadro: [
          {
            monitoramento_id: "a",
            cargo: "ENFERMEIRA (A)",
            co_cargo: 12,
            vagas: 2,
          },
        ],
        vagas: [
          { monitoramento_id: "a", cargo: "Enfermeiro - PPP", co_cargo: 12 },
          { monitoramento_id: "a", cargo: "AISAN", co_cargo: 40 },
          // co_cargo torto vale como sem cargo oficial: fica o texto.
          { monitoramento_id: "a", cargo: "Psicólogo", co_cargo: "x" },
        ],
      });
      expect(porEdital.get("a")).toEqual(
        new Map([
          ["c:12", { codigo: "12", texto: "enfermeira", vagas: 2 }],
          ["c:40", { codigo: "40", texto: "aisan", vagas: null }],
          ["t:psicologo", { codigo: null, texto: "psicologo", vagas: null }],
        ]),
      );
    });

    it("resposta torta vira mapa vazio", () => {
      expect(cargosDaResposta(null).size).toBe(0);
      expect(cargosDaResposta([1, 2]).size).toBe(0);
      expect(cargosDaResposta({ vagas: "x", quadro: [null] }).size).toBe(0);
    });
  });

  describe("calcularReaberturas", () => {
    const antigo = edital({
      id: "e1",
      edital: "78/2025",
      data_inicio: "2025-10-27",
      data_fim: "2025-12-08",
      vagas_total: 10,
      contratados: 4,
    });
    const novo = edital({
      id: "e2",
      edital: "79/2026",
      status: "Em andamento",
      data_inicio: "2026-06-26",
      data_fim: "2026-09-23",
      vagas_total: 50,
    });
    const mesmoCargo = cargos({
      e1: { enfermeiro: null, psicologo: null },
      e2: { enfermeiro: null },
    });

    it("a vaga sem contratação reaberta no edital mais novo do mesmo DSEI conta só no novo", () => {
      const r = calcularReaberturas([antigo, novo], mesmoCargo);
      expect(r.get("e1")).toEqual({
        reabertas: 6,
        reabertasEm: [{ edital: "79/2026", vagas: 6 }],
        reabre: [],
      });
      expect(r.get("e2")).toEqual({
        reabertas: 0,
        reabertasEm: [],
        reabre: [{ edital: "78/2025", vagas: 6 }],
      });
    });

    it("mesmo cargo oficial com grafias diferentes: a vaga reaberta conta uma vez só", () => {
      const r = calcularReaberturas(
        [antigo, novo],
        cargos({
          e1: { aisan: { codigo: 40, vagas: null } },
          e2: { "agente indigena saneamento": { codigo: 40, vagas: null } },
        }),
      );
      expect(r.get("e1")?.reabertas).toBe(6);
    });

    it("cargos oficiais diferentes não casam, nem com o mesmo texto", () => {
      expect(
        calcularReaberturas(
          [antigo, novo],
          cargos({
            e1: { medico: { codigo: 7, vagas: null } },
            e2: { medico: { codigo: 8, vagas: null } },
          }),
        ).size,
      ).toBe(0);
    });

    it("sem cargo oficial num dos lados (SEDE, Projetos, grafia sem casamento), vale o texto", () => {
      const r = calcularReaberturas(
        [antigo, novo],
        cargos({
          e1: { enfermeiro: { codigo: 12, vagas: null } },
          e2: { enfermeiro: null },
        }),
      );
      expect(r.get("e1")?.reabertas).toBe(6);
      expect(
        calcularReaberturas(
          [antigo, novo],
          cargos({
            e1: { aisan: { codigo: 40, vagas: null } },
            e2: { "agente indigena saneamento": null },
          }),
        ).size,
      ).toBe(0);
    });

    it("cargo diferente, outra unidade, edital cancelado ou sem cargos: a vaga é nova", () => {
      expect(
        calcularReaberturas(
          [antigo, novo],
          cargos({ e1: { enfermeiro: null }, e2: { sanitarista: null } }),
        ).size,
      ).toBe(0);
      expect(
        calcularReaberturas(
          [antigo, { ...novo, unidade: "DSEI Xingu", sigla_unidade: "XIN" }],
          mesmoCargo,
        ).size,
      ).toBe(0);
      expect(
        calcularReaberturas(
          [antigo, { ...novo, status: "Cancelado" }],
          mesmoCargo,
        ).size,
      ).toBe(0);
      expect(
        calcularReaberturas(
          [antigo, novo],
          cargos({ e1: { enfermeiro: null } }),
        ).size,
      ).toBe(0);
      expect(calcularReaberturas([antigo, novo], null).size).toBe(0);
    });

    it("só reabre o edital que já tinha resultado e terminou antes do novo começar", () => {
      // Os dois ao mesmo tempo: não é reabertura.
      expect(
        calcularReaberturas(
          [antigo, { ...novo, data_inicio: "2025-11-01" }],
          mesmoCargo,
        ).size,
      ).toBe(0);
      // O antigo ainda sem resultado: as vagas dele estão em seleção, não sobraram.
      expect(
        calcularReaberturas(
          [{ ...antigo, status: "Em andamento" }, novo],
          mesmoCargo,
        ).size,
      ).toBe(0);
      // O antigo contratou tudo: o novo é necessidade nova (reposição).
      expect(
        calcularReaberturas([{ ...antigo, contratados: 12 }, novo], mesmoCargo)
          .size,
      ).toBe(0);
    });

    it("o novo reabre até as vagas dele nos cargos em comum, pelo quadro", () => {
      const r = calcularReaberturas(
        [antigo, novo],
        cargos({
          e1: { enfermeiro: null, psicologo: null },
          e2: { enfermeiro: 2, sanitarista: 40 },
        }),
      );
      expect(r.get("e1")?.reabertas).toBe(2);
    });

    it("a vaga que sobrou de um edital reaberto em outro segue a cadeia", () => {
      const primeiro = edital({
        id: "e0",
        edital: "14/2025",
        data_inicio: "2025-06-09",
        data_fim: "2025-08-20",
        vagas_total: 30,
        contratados: 24,
      });
      const r = calcularReaberturas(
        [primeiro, antigo],
        cargos({ e0: { enfermeiro: null }, e1: { enfermeiro: null } }),
      );
      expect(r.get("e0")?.reabertas).toBe(6);
      expect(r.get("e1")?.reabre).toEqual([{ edital: "14/2025", vagas: 6 }]);
    });

    it("sem quadro, o novo reabre até o total dele, do antigo mais recente para o mais velho", () => {
      // Termina depois do 78/2025 começar: só o 79/2026 o reabre.
      const outroAntigo = edital({
        id: "e0",
        edital: "14/2025",
        data_inicio: "2025-06-09",
        data_fim: "2025-11-01",
        vagas_total: 30,
        contratados: 24,
      });
      const r = calcularReaberturas(
        [outroAntigo, antigo, { ...novo, vagas_total: 8 }],
        cargos({
          e0: { enfermeiro: null },
          e1: { enfermeiro: null },
          e2: { enfermeiro: null },
        }),
      );
      expect(r.get("e1")?.reabertas).toBe(6);
      expect(r.get("e0")?.reabertas).toBe(2);
      expect(r.get("e2")?.reabre).toEqual([
        { edital: "78/2025", vagas: 6 },
        { edital: "14/2025", vagas: 2 },
      ]);
    });

    it("a vaga reaberta de novo passa adiante: conta só no edital mais recente", () => {
      const terceiro = edital({
        id: "e3",
        edital: "120/2026",
        status: "Em andamento",
        data_inicio: "2026-10-01",
        vagas_total: 3,
      });
      const r = calcularReaberturas(
        [antigo, { ...novo, status: "Concluído", vagas_total: 6 }, terceiro],
        cargos({
          e1: { enfermeiro: null },
          e2: { enfermeiro: null },
          e3: { enfermeiro: null },
        }),
      );
      expect(r.get("e1")?.reabertas).toBe(6);
      expect(r.get("e2")?.reabertas).toBe(3);
      /*
      Vagas: 10 + 6 + 3 = 19 publicadas. Contam 4 contratadas (78/2025), 3
      ociosas (as do 79/2026 que o 120/2026 não reabriu) e 3 em seleção = 10.
    */
      const linhas = [
        antigo,
        { ...novo, status: "Concluído", vagas_total: 6 },
        terceiro,
      ].map((l) => ({
        ...l,
        vagas_reabertas: r.get(String(l.id))?.reabertas ?? 0,
      }));
      const k = indicadoresDoMonitoramento(linhas);
      expect(k.vagas).toBe(10);
      expect(k.reabertas).toBe(9);
      expect(k.contratadas + k.emSelecao + k.ociosas).toBe(k.vagas);
    });
  });

  describe("indicadores com vagas reabertas", () => {
    it("a vaga reaberta sai das vagas e das ociosas do edital antigo; contratadas não mudam", () => {
      const linha = edital({
        vagas_total: 10,
        contratados: 4,
        vagas_reabertas: 6,
      });
      expect(vagasEfetivas(linha)).toBe(4);
      expect(vagasSemContratacao(linha)).toBe(0);
      const k = indicadoresDoMonitoramento([
        linha,
        edital({ status: "Em andamento", vagas_total: 50 }),
      ]);
      expect(k).toMatchObject({
        vagas: 54,
        reabertas: 6,
        contratadas: 4,
        ociosas: 0,
        emSelecao: 50,
      });
    });

    it("sem reabertura, nada muda", () => {
      const k = indicadoresDoMonitoramento([
        edital({ vagas_total: 10, contratados: 4 }),
      ]);
      expect(k).toMatchObject({
        vagas: 10,
        reabertas: 0,
        contratadas: 4,
        ociosas: 6,
      });
    });
  });

  describe("Visão geral com os cargos das vagas", () => {
    it("com a conta dos cargos, o enriquecimento marca as reabertas e as frases da gaveta", () => {
      const acompanhamento = acompanhamentoDaResposta({
        etapas: [],
        listas: [],
      });
      if (!acompanhamento) throw new Error("sem acompanhamento");
      // O estado da Visão geral põe a conta depois do import dinâmico.
      acompanhamento.reaberturas = reaberturasDosCargos({
        vagas: [
          { monitoramento_id: "e1", cargo: "Enfermeiro" },
          { monitoramento_id: "e2", cargo: "Enfermeiro - PPP" },
        ],
        quadro: [],
        lista: [],
      });
      const [velho, novo] = enriquecerLinhas(
        [
          edital({
            id: "e1",
            edital: "78/2025",
            data_inicio: "2025-10-27",
            data_fim: "2025-12-08",
            vagas_total: 10,
            contratados: 4,
          }),
          edital({
            id: "e2",
            edital: "79/2026",
            status: "Em andamento",
            data_inicio: "2026-06-26",
            vagas_total: 50,
          }),
        ],
        { hoje: "2026-11-16", acompanhamento },
      );
      expect(velho?.vagas_reabertas).toBe(6);
      expect(velho?.textos_da_reabertura).toEqual([
        "6 vagas reabertas no edital 79/2026",
      ]);
      expect(novo?.vagas_reabertas).toBe(0);
      expect(novo?.textos_da_reabertura).toEqual([
        "Reabre 6 vagas do edital 78/2025",
      ]);
    });

    it("sem os cargos (leitura falhou), as vagas ficam como cada edital publicou", () => {
      const acompanhamento = acompanhamentoDaResposta({
        etapas: [],
        listas: [],
      });
      expect(acompanhamento?.reaberturas).toBeUndefined();
      const [linha] = enriquecerLinhas(
        [edital({ id: "e1", vagas_total: 10 })],
        {
          acompanhamento,
        },
      );
      expect(linha?.vagas_reabertas).toBe(0);
    });
  });

  describe("textoDaReabertura", () => {
    it("uma linha para os detalhes do edital", () => {
      expect(
        textoDaReabertura([{ edital: "79/2026", vagas: 12 }], "reabertas"),
      ).toBe("12 vagas reabertas no edital 79/2026");
      expect(
        textoDaReabertura([{ edital: "79/2026", vagas: 1 }], "reabertas"),
      ).toBe("1 vaga reaberta no edital 79/2026");
      expect(
        textoDaReabertura(
          [
            { edital: "78/2025", vagas: 6 },
            { edital: "14/2025", vagas: 2 },
          ],
          "reabre",
        ),
      ).toBe("Reabre 8 vagas dos editais 78/2025 e 14/2025");
      expect(
        textoDaReabertura(
          [
            { edital: "1/2025", vagas: 1 },
            { edital: "2/2025", vagas: 1 },
          ],
          "reabertas",
        ),
      ).toBe("2 vagas reabertas nos editais 1/2025 e 2/2025");
      expect(textoDaReabertura([], "reabre")).toBe("");
      expect(textoDaReabertura(undefined, "reabre")).toBe("");
    });
  });
});

bloco("mapa-recolhido", () => {
  /* O mapa da Visão geral recolhido ou aberto (src/lib/mapas/mapa-recolhido.ts). */

  describe("mapa recolhido", () => {
    it("aberto é o padrão: sem nada guardado ou com valor estranho", () => {
      expect(lerMapaRecolhido(null)).toBe(false);
      expect(lerMapaRecolhido(undefined)).toBe(false);
      expect(lerMapaRecolhido("")).toBe(false);
      expect(lerMapaRecolhido("true")).toBe(false);
    });

    it("guarda e lê de volta a escolha", () => {
      expect(lerMapaRecolhido(valorDoMapaRecolhido(true))).toBe(true);
      expect(valorDoMapaRecolhido(false)).toBeNull();
    });

    it("a chave é própria do Yeendé", () => {
      expect(CHAVE_DO_MAPA_RECOLHIDO).toMatch(/^agsus_yeende_/);
    });
  });
});

bloco("resultado-do-edital-na-visao-geral", () => {
  /*
  O RESULTADO DE CADA EDITAL NA VISÃO GERAL (pedido de 13/11/2026)

  A diretoria pediu, por processo seletivo: quanto tempo levou, quantas pessoas
  se inscreveram, quantas passaram, quantas foram contratadas e quantas ficaram
  em cadastro reserva. Inscritos, contratados e as datas já estavam na linha;
  aprovados e cadastro reserva vêm da lista de aprovados vigente (aprovados =
  pessoas da lista; cadastro reserva = as que ainda não têm status). Dados
  fictícios.
*/

  function acompanhamento(listas: ListaDoAcompanhamento[]): Acompanhamento {
    return {
      etapasPorEdital: new Map(),
      listasPorEdital: new Map(
        listas.map((l) => [String(l.monitoramento_id), l]),
      ),
    };
  }

  const concluido = {
    id: "e1",
    edital: "80/2025",
    unidade: "DSEI Exemplo",
    status: "Concluído",
    data_inicio: "2025-10-27",
    data_fim: "2025-12-08",
    inscritos: 5179,
    contratados: 42,
  };

  describe("duração do edital", () => {
    it("dias corridos do início ao encerramento", () => {
      expect(duracaoEmDias(concluido)).toBe(42);
      expect(
        duracaoEmDias({ data_inicio: "2025-02-28", data_fim: "2025-03-01" }),
      ).toBe(1);
    });

    it("sem uma das datas, ou com o fim antes do início, não há duração", () => {
      expect(duracaoEmDias({ data_inicio: "2025-10-27" })).toBeNull();
      expect(duracaoEmDias({ data_fim: "2025-10-27" })).toBeNull();
      expect(
        duracaoEmDias({ data_inicio: "2025-10-27", data_fim: "2025-10-01" }),
      ).toBeNull();
    });
  });

  describe("aprovados e cadastro reserva pela lista vigente", () => {
    it("aprovados são a lista; cadastro reserva, quem ainda não tem status", () => {
      const [linha] = enriquecerLinhas([concluido], {
        hoje: "2026-11-13",
        acompanhamento: acompanhamento([
          {
            monitoramento_id: "e1",
            aprovados: 361,
            com_status: 70,
            desistentes: 9,
          },
        ]),
      });
      expect(linha?.aprovados).toBe(361);
      expect(linha?.cadastro_reserva).toBe(291);
    });

    it("sem lista vigente, os dois ficam sem número (não zero)", () => {
      const [linha] = enriquecerLinhas([concluido], {
        hoje: "2026-11-13",
        acompanhamento: acompanhamento([]),
      });
      expect(linha?.aprovados).toBeNull();
      expect(linha?.cadastro_reserva).toBeNull();
    });

    it("cadastro reserva nunca fica negativo", () => {
      const [linha] = enriquecerLinhas([concluido], {
        hoje: "2026-11-13",
        acompanhamento: acompanhamento([
          { monitoramento_id: "e1", aprovados: 3, com_status: 5 },
        ]),
      });
      expect(linha?.cadastro_reserva).toBe(0);
    });
  });

  describe("tabela e arquivo", () => {
    it("as colunas do resultado estão no padrão, para todos; só Observações fica fora", () => {
      const campos = COLUNAS_DA_TABELA.map((c) => c.campo);
      for (const campo of [
        "duracao",
        "inscritos",
        "aprovados",
        "cadastro_reserva",
      ] as const) {
        expect(campos).toContain(campo);
        expect(COLUNAS_INICIAIS).toContain(campo);
      }
      expect(COLUNAS_INICIAIS).toEqual(
        campos.filter((campo) => campo !== "observacoes"),
      );
    });

    it("sem número fica abaixo do zero ao ordenar", () => {
      expect(valorParaOrdenar({ aprovados: null }, "aprovados")).toBe(-1);
      expect(valorParaOrdenar({ aprovados: 0 }, "aprovados")).toBe(0);
      expect(valorParaOrdenar(concluido, "duracao")).toBe(42);
      expect(valorParaOrdenar({}, "duracao")).toBe(-1);
    });

    it("o CSV leva duração, inscritos, aprovados e cadastro reserva", () => {
      const [linha] = enriquecerLinhas([concluido], {
        hoje: "2026-11-13",
        acompanhamento: acompanhamento([
          { monitoramento_id: "e1", aprovados: 361, com_status: 70 },
        ]),
      });
      const [cabecalho = "", corpo = ""] = csvDaVisaoGeral(linha ? [linha] : [])
        .replace(String.fromCharCode(0xfeff), "")
        .split("\n");
      const colunas = cabecalho.split(";").map((c) => c.replaceAll('"', ""));
      const valores = corpo.split(";").map((c) => c.replaceAll('"', ""));
      const valor = (rotulo: string) => valores[colunas.indexOf(rotulo)];
      expect(valor("Duração (dias)")).toBe("42");
      expect(valor("Inscritos")).toBe("5179");
      expect(valor("Aprovados (lista vigente)")).toBe("361");
      expect(valor("Aguardando Chamada (aprovados sem status)")).toBe("291");
      expect(valor("Contratados")).toBe("42");
    });
  });
});

bloco("aviso-de-cronograma-no-retrato", () => {
  /*
  O AVISO "CRONOGRAMA ENCERRADO" NO BANCO (migration 20261118150000, aplicada em 18/11/2026)

  Pelo retrato do banco: o contexto das conferências traz o estado do cronograma pelas datas, o
  status manual e o treinamento de cada edital, e o módulo editais (recurso nucleo) é aceito em
  todas as listas. A regra está em scripts/conferencias/regras.py (tests/python/test_conferencias.py).
*/
  const RETRATO = readFileSync("supabase/esquema-atual.sql", "utf8").replace(
    /\r/g,
    "",
  );

  function corpo(funcao: string) {
    const i = RETRATO.indexOf(`CREATE FUNCTION ${funcao}`);
    expect(i, funcao).toBeGreaterThanOrEqual(0);
    const resto = RETRATO.slice(i);
    const achado = /AS (\$[A-Za-z_]*\$)/.exec(resto);
    const tag = achado?.[1];
    if (!achado || !tag) throw new Error(`sem corpo: ${funcao}`);
    const ini = achado.index + achado[0].length;
    return resto.slice(ini, resto.indexOf(tag, ini));
  }

  const LISTA =
    "('analises', 'entrevistas', 'classificacao', 'aprovados', 'cargas', 'editais')";

  describe("aviso de cronograma encerrado no retrato do banco", () => {
    it("o contexto traz o cronograma pelas datas, o status manual e o treinamento", () => {
      const sql = corpo("public.conferencia_ler_contexto(");
      expect(sql).toContain('private."FC_ESTADO_DO_CRONOGRAMA"(m.id');
      expect(sql).toContain("'status_manual'");
      expect(sql).toContain("'treinamento'");
    });

    it("o módulo editais é aceito em todas as listas e lê o recurso nucleo; a tela também o conhece", () => {
      for (const f of [
        'private."FC_MARCA_DA_RPC"(',
        "public.gravar_avisos_conferencia(",
        "public.listar_avisos_conferencia(",
        "public.listar_casos_aviso_conferencia(",
      ])
        expect(corpo(f), f).toContain(LISTA);
      expect(corpo('private."FC_CONFERENCIA_RECURSO"(')).toContain(
        "when 'editais' then 'nucleo'",
      );
      expect(RETRATO).toMatch(
        /CONSTRAINT "CK_AVISOCONF_COMODULO" CHECK .*'editais'/,
      );
      expect(MODULOS_DOS_AVISOS.map((m) => m.valor)).toContain("editais");
    });
  });
});

bloco("central-de-avisos-no-retrato", () => {
  /*
  A CENTRAL DE AVISOS NO BANCO (migration 20261118140000, aplicada em 18/11/2026)

  Pelo retrato do banco (supabase/esquema-atual.sql): o tratamento separado da situação, o histórico
  que só cresce, as evidências, as RPCs da tela (as mesmas do contrato) e a rechecagem que não apaga
  o motivo de quem tratou. O comportamento foi ensaiado no banco antes da aplicação.
*/
  const RETRATO = readFileSync("supabase/esquema-atual.sql", "utf8").replace(
    /\r/g,
    "",
  );

  function corpo(funcao: string) {
    const i = RETRATO.indexOf(`CREATE FUNCTION ${funcao}`);
    expect(i, funcao).toBeGreaterThanOrEqual(0);
    const resto = RETRATO.slice(i);
    const achado = /AS (\$[A-Za-z_]*\$)/.exec(resto);
    const tag = achado?.[1];
    if (!achado || !tag) throw new Error(`sem corpo: ${funcao}`);
    const ini = achado.index + achado[0].length;
    return resto.slice(ini, resto.indexOf(tag, ini));
  }

  describe("central de avisos no retrato do banco", () => {
    it("tratamento, responsável e prazo no aviso; histórico e evidência em tabelas próprias", () => {
      const aviso = RETRATO.slice(
        RETRATO.indexOf('CREATE TABLE public."TB_AVISO_CONFERENCIA" ('),
      );
      const colunas = aviso.slice(0, aviso.indexOf("\n);"));
      for (const coluna of [
        '"TP_TRATAMENTO"',
        '"CO_USUARIO_RESPONSAVEL"',
        '"DT_PRAZO"',
        '"QT_OCORRENCIA_DISPENSADA"',
      ])
        expect(colunas).toContain(coluna);
      expect(colunas).not.toContain("IGNORADO");
      expect(RETRATO).toContain('CREATE TABLE public."TH_AVISO_CONFERENCIA" (');
      expect(RETRATO).toContain(
        'CREATE TABLE public."TB_EVIDENCIA_AVISO_CONFERENCIA" (',
      );
    });

    it("as RPCs da tela existem com os argumentos do contrato; a de ignorar saiu", () => {
      for (const nome of [
        "tratar_aviso_conferencia",
        "atribuir_aviso_conferencia",
        "listar_responsaveis_aviso_conferencia",
        "incluir_evidencia_aviso_conferencia",
        "retirar_evidencia_aviso_conferencia",
        "listar_historico_aviso_conferencia",
      ]) {
        const assinatura = new RegExp(
          `CREATE FUNCTION public\\.${nome}\\(([^)]*)\\)`,
        ).exec(RETRATO)?.[1];
        expect(assinatura, nome).toBeDefined();
        const argumentos = (assinatura ?? "")
          .split(",")
          .map((p) => p.trim().split(/\s+/)[0]);
        expect(argumentos, nome).toEqual(CONTRATO_RPC[nome]?.argumentos);
      }
      expect(RETRATO).not.toContain(
        "CREATE FUNCTION public.ignorar_aviso_conferencia(",
      );
    });

    it("a rechecagem resolve sem apagar o motivo e grava o histórico", () => {
      const finalizar = corpo("public.finalizar_conferencia(");
      expect(finalizar).toContain("'RECHECADO_SEM_PROBLEMA'");
      expect(finalizar).toContain("'NAO_ACHADO'");
      const gravar = corpo("public.gravar_avisos_conferencia(");
      expect(gravar).toContain("'RECHECADO_COM_PROBLEMA'");
      expect(gravar).toContain('"QT_OCORRENCIA_DISPENSADA"');
    });
  });
});

bloco("cronograma-encerrado-na-visao-geral", () => {
  /*
  Item 3 da conferência de 17/11/2026: o status "Concluído" que a Visão geral
  recebe é o calculado pelas datas. Com o cálculo automático, ele só diz que a
  última data do cronograma passou, não que o resultado saiu nem que o
  processo foi homologado (em 17/11, 52 editais gravados "Em andamento"
  calculavam "Concluído"). A Visão geral mostra "Cronograma encerrado" no
  status, na fase, nos filtros, no CSV e nos contadores; o "Concluído" digitado
  à mão (cálculo manual) continua "Concluído". As regras que dependem do fim
  (pós-resultado, ociosas) seguem valendo.
*/

  const HOJE = "2026-11-18";

  const AUTOMATICO = {
    id: "a",
    edital: "42/2026",
    unidade: "DSEI Fictício A",
    status: "Concluído",
    etapa: "Resultado final do Processo Seletivo",
    cronograma_automatico: true,
    vagas_total: 10,
    contratados: 2,
    data_fim: "2026-07-31",
  };
  const MANUAL = {
    ...AUTOMATICO,
    id: "m",
    edital: "13/2025",
    cronograma_automatico: false,
  };
  const ABERTO = {
    id: "b",
    edital: "120/2026",
    unidade: "DSEI Fictício B",
    status: "Em andamento",
    etapa: "Entrevistas",
    cronograma_automatico: true,
    data_fim: "2027-01-21",
  };

  describe("cronograma encerrado não é processo concluído", () => {
    it("status: automático vira 'Cronograma encerrado'; o digitado à mão fica", () => {
      expect(statusDaVisaoGeral(AUTOMATICO)).toBe("Cronograma encerrado");
      expect(statusDaVisaoGeral(MANUAL)).toBe("Concluído");
      expect(statusDaVisaoGeral(ABERTO)).toBe("Em andamento");
      expect(statusDaVisaoGeral({ status: "Cancelado" })).toBe("Cancelado");
    });

    it("linhas enriquecidas: status e fase dizem 'Cronograma encerrado'", () => {
      const [auto, manual, aberto] = enriquecerLinhas(
        [AUTOMATICO, MANUAL, ABERTO],
        { hoje: HOJE },
      );
      expect([auto?.status, auto?.fase]).toEqual([
        "Cronograma encerrado",
        "Cronograma encerrado",
      ]);
      expect([manual?.status, manual?.fase]).toEqual([
        "Concluído",
        "Concluído",
      ]);
      expect(aberto?.status).toBe("Em andamento");
      // O fim do cronograma continua contando (pós-resultado e ociosas).
      expect(ehConcluido(auto)).toBe(true);
      expect(temResultado(auto ?? {})).toBe(true);
    });

    it("filtros, CSV e o bloco de fases usam o mesmo texto", () => {
      const linhas = enriquecerLinhas([AUTOMATICO, MANUAL, ABERTO], {
        hoje: HOJE,
      });
      const opcoes = opcoesDosFiltros(linhas, filtrosVazios());
      expect(opcoes.status).toEqual([
        "Em andamento",
        "Cronograma encerrado",
        "Concluído",
      ]);
      expect(opcoes.fase).toContain("Cronograma encerrado");
      expect(csvDaVisaoGeral(linhas)).toContain('"Cronograma encerrado"');
      expect(andamentoPorFase(linhas)).toMatchObject({
        encerrados: 1,
        concluidos: 1,
        cancelados: 0,
      });
    });

    it("prazo e selo: 'Cronograma encerrado', ou 'Processo concluído' só no manual", () => {
      expect(prazoDoEdital(AUTOMATICO, HOJE)?.rotulo).toBe(
        "Cronograma encerrado",
      );
      expect(prazoDoEdital(MANUAL, HOJE)?.rotulo).toBe("Processo concluído");
      expect(urgenciaDoCronograma(AUTOMATICO, HOJE)).toEqual({
        tom: "done",
        rotulo: "Cronograma encerrado",
      });
    });

    it("a fase reconhece o status já trocado", () => {
      expect(faseDoEdital({ status: "Cronograma encerrado" })).toBe(
        "Cronograma encerrado",
      );
    });
  });
});

bloco("lib/base/prazos", () => {
  describe("faixas de prazo", () => {
    it("conta dias de calendário, inclusive na virada de mês e de ano", () => {
      expect(diasAte("2026-11-18", "2026-11-18")).toBe(0);
      expect(diasAte("2026-12-01", "2026-11-30")).toBe(1);
      expect(diasAte("2027-01-01", "2026-12-31")).toBe(1);
      expect(diasAte("2026-11-15", "2026-11-18")).toBe(-3);
      expect(diasAte("2026-11-18T23:59:00-03:00", "2026-11-18")).toBe(0);
      expect(diasAte(null, "2026-11-18")).toBeNull();
      expect(diasAte("", "2026-11-18")).toBeNull();
      expect(diasAte("18/11/2026", "2026-11-18")).toBeNull();
    });

    it("vencido só depois do dia; os limites de 30, 90 e 180", () => {
      expect(faixaDosDias(-1)).toBe("vencido");
      expect(faixaDosDias(0)).toBe("ate-30");
      expect(faixaDosDias(29)).toBe("ate-30");
      expect(faixaDosDias(30)).toBe("ate-90");
      expect(faixaDosDias(89)).toBe("ate-90");
      expect(faixaDosDias(90)).toBe("ate-180");
      expect(faixaDosDias(179)).toBe("ate-180");
      expect(faixaDosDias(180)).toBe("depois");
      expect(situacaoDoPrazo("2026-12-18", "2026-11-18")).toEqual({
        dias: 30,
        faixa: "ate-90",
      });
      expect(situacaoDoPrazo(undefined, "2026-11-18")).toBeNull();
    });

    it("o texto da coluna dias restantes diz a situação sem depender da cor", () => {
      expect(textoDosDiasRestantes(0)).toBe("Vence hoje");
      expect(textoDosDiasRestantes(1)).toBe("Vence amanhã");
      expect(textoDosDiasRestantes(12)).toBe("Vence em 12 dias");
      expect(textoDosDiasRestantes(1200)).toBe("Vence em 1.200 dias");
      expect(textoDosDiasRestantes(-1)).toBe("Venceu ontem");
      expect(textoDosDiasRestantes(-3)).toBe("Venceu há 3 dias");
    });

    it("conta por faixa, sem as datas vazias", () => {
      expect(
        contarPorFaixa(
          ["2026-11-01", "2026-11-18", "2027-01-10", "2027-12-31", null],
          "2026-11-18",
        ),
      ).toEqual({
        vencido: 1,
        "ate-30": 1,
        "ate-90": 1,
        "ate-180": 0,
        depois: 1,
      });
    });
  });
});

bloco("lib/alcance-da-selecao", () => {
  const {
    alcanceDaSelecao,
    conviteParaTodos,
    marcarPagina,
    rotuloDaPagina,
    textoDaConfirmacao,
    textoDoAlcance,
  } = alcanceDaSelecaoNs;
  /*
    Revisão de 17/11/2026: a Lista de aprovados oferecia "Selecionar os 13.184
    da tabela" numa caixa só. Agora "esta página" (as linhas desenhadas) e
    "todos os N resultados" são escolhas separadas, e a confirmação diz quantos
    serão afetados.
  */
  const ids = (de: number, ate: number) =>
    Array.from({ length: ate - de }, (_, i) => `c${de + i}`);
  const RECORTE = ids(0, 13184);
  const PAGINA = RECORTE.slice(0, 50);
  const CANDIDATOS = { singular: "candidato", plural: "candidatos" };
  const FICHAS = { singular: "ficha", plural: "fichas", feminino: true };

  describe("alcance da seleção", () => {
    it("nada marcado: a caixa da página e nenhum convite", () => {
      const a = alcanceDaSelecao(new Set(), PAGINA, RECORTE);
      expect(a).toEqual({
        tipo: "nenhum",
        quantos: 0,
        naPagina: 50,
        marcadosNaPagina: 0,
        total: 13184,
      });
      expect(rotuloDaPagina(a)).toBe("Selecionar esta página (50)");
      expect(conviteParaTodos(a)).toBe("");
    });

    it("esta página: só as 50 desenhadas, com o convite para os 13.184", () => {
      const a = alcanceDaSelecao(
        marcarPagina(new Set(), PAGINA, true),
        PAGINA,
        RECORTE,
      );
      expect(a.tipo).toBe("pagina");
      expect(a.quantos).toBe(50);
      expect(textoDoAlcance(a, CANDIDATOS)).toBe(
        "50 candidatos desta página selecionados (de 13.184 no resultado)",
      );
      expect(conviteParaTodos(a)).toBe("Selecionar todos os 13.184 resultados");
      expect(textoDaConfirmacao(a, 50, CANDIDATOS)).toBe(
        "50 candidatos serão afetados · só esta página",
      );
    });

    it("todos os resultados: diz que vai além da página", () => {
      const a = alcanceDaSelecao(new Set(RECORTE), PAGINA, RECORTE);
      expect(a.tipo).toBe("todos");
      expect(textoDoAlcance(a, CANDIDATOS)).toBe(
        "Todos os 13.184 candidatos do resultado selecionados",
      );
      expect(conviteParaTodos(a)).toBe("");
      expect(textoDaConfirmacao(a, 13000, CANDIDATOS)).toBe(
        "13.000 candidatos serão afetados · todos os resultados do filtro, não só os 50 desta página · 184 dos marcados não se aplicam",
      );
    });

    it("marcados à mão: a parte, com o total do resultado", () => {
      const a = alcanceDaSelecao(new Set(["c1", "c70"]), PAGINA, RECORTE);
      expect(a).toMatchObject({
        tipo: "parte",
        quantos: 2,
        marcadosNaPagina: 1,
      });
      expect(textoDoAlcance(a, CANDIDATOS)).toBe(
        "2 candidatos selecionados (de 13.184 no resultado)",
      );
      expect(textoDaConfirmacao(a, 1, CANDIDATOS)).toBe(
        "1 candidato será afetado · 1 dos marcados não se aplicam",
      );
    });

    it("marcado que saiu do recorte não conta", () => {
      const a = alcanceDaSelecao(new Set(["fora"]), PAGINA, RECORTE);
      expect(a.tipo).toBe("nenhum");
    });

    it("recorte que cabe na página: marcar a página é marcar todos", () => {
      const pequeno = ids(0, 12);
      const a = alcanceDaSelecao(new Set(pequeno), pequeno, pequeno);
      expect(a.tipo).toBe("todos");
      expect(textoDaConfirmacao(a, 12, CANDIDATOS)).toBe(
        "12 candidatos serão afetados",
      );
    });

    it("concorda no feminino (fichas)", () => {
      const a = alcanceDaSelecao(new Set(["c1"]), PAGINA, RECORTE);
      expect(textoDoAlcance(a, FICHAS)).toBe(
        "1 ficha selecionada (de 13.184 no resultado)",
      );
      expect(textoDaConfirmacao(a, 1, FICHAS)).toBe("1 ficha será afetada");
      const todas = alcanceDaSelecao(new Set(RECORTE), PAGINA, RECORTE);
      expect(textoDoAlcance(todas, FICHAS)).toBe(
        "Todas as 13.184 fichas do resultado selecionadas",
      );
    });

    it("desmarcar a página tira só as dela", () => {
      const marcados = marcarPagina(new Set(["c70"]), PAGINA, true);
      expect(marcarPagina(marcados, PAGINA, false)).toEqual(new Set(["c70"]));
    });
  });
});

bloco("lib/origem-dos-numeros", () => {
  /*
    Revisão de 17/11/2026: cada número da linha leva aos dados que o compõem.
    A linha é do edital (o destino nunca é um código de vaga); só o total, sem
    os registros, é "agregada" (a tela diz "Origem agregada; detalhe
    individual não disponível", nunca abre uma lista vazia).
  */

  const COM_LISTA = {
    id: "uuid-1",
    edital: "80/2025",
    aprovados: 12,
    contratados: 9,
    cadastro_reserva: 3,
    inscritos: 300,
    TP_FONTE_FUNIL: "SELECAO",
  };

  describe("de onde vem cada número da linha", () => {
    it("Aprovados, Contratados e Aguardando chamada → Lista de aprovados no edital", () => {
      expect(
        origemDoNumero(COM_LISTA, "contratados", { comListas: true }),
      ).toEqual({
        tipo: "tela",
        view: "approved",
        rotulo: "Abrir na Lista de aprovados",
        pedido: {
          edital: "80/2025",
          editalId: "uuid-1",
          metrica: "contratados",
        },
      });
      const aguardando = origemDoNumero(COM_LISTA, "cadastro_reserva");
      expect(aguardando.tipo === "tela" && aguardando.pedido.metrica).toBe(
        "aguardandoChamada",
      );
      const aprovados = origemDoNumero(COM_LISTA, "aprovados");
      expect(aprovados.tipo === "tela" && aprovados.pedido.metrica).toBe(
        "aprovados",
      );
    });

    it("Inscritos → a tela da fonte do funil", () => {
      expect(origemDoNumero(COM_LISTA, "inscritos")).toMatchObject({
        tipo: "tela",
        view: "selecao",
        pedido: { edital: "80/2025" },
      });
      expect(
        origemDoNumero(
          { ...COM_LISTA, TP_FONTE_FUNIL: "ANALISES" },
          "inscritos",
        ),
      ).toMatchObject({ view: "analises" });
    });

    it("só o total, sem os registros: origem agregada", () => {
      // Contratados sem lista vigente (o acompanhamento já disse que não há).
      expect(
        origemDoNumero(
          { ...COM_LISTA, aprovados: null, cadastro_reserva: null },
          "contratados",
          { comListas: true },
        ),
      ).toEqual({ tipo: "agregada" });
      // Inscritos de outra fonte (ou sem fonte gravada).
      expect(
        origemDoNumero(
          { ...COM_LISTA, TP_FONTE_FUNIL: "AVALIACAO_DOCUMENTAL" },
          "inscritos",
        ),
      ).toEqual({ tipo: "agregada" });
      expect(
        origemDoNumero({ ...COM_LISTA, TP_FONTE_FUNIL: null }, "inscritos"),
      ).toEqual({ tipo: "agregada" });
    });

    it("sem número, zero ou antes do acompanhamento: nenhuma", () => {
      expect(
        origemDoNumero({ ...COM_LISTA, contratados: 0 }, "contratados"),
      ).toEqual({ tipo: "nenhuma" });
      expect(
        origemDoNumero({ ...COM_LISTA, aprovados: null }, "aprovados"),
      ).toEqual({ tipo: "nenhuma" });
      expect(
        origemDoNumero({ ...COM_LISTA, inscritos: "" }, "inscritos"),
      ).toEqual({ tipo: "nenhuma" });
      // Sem os resumos das listas, não se sabe se há lista: não promete nada.
      expect(
        origemDoNumero({ ...COM_LISTA, aprovados: null }, "contratados", {
          comListas: false,
        }),
      ).toEqual({ tipo: "nenhuma" });
      expect(origemDoNumero(null, "contratados")).toEqual({ tipo: "nenhuma" });
    });
  });
});

bloco("lib/composicao-dos-numeros", () => {
  /*
    Revisão de 17/11/2026: clicar no número mostra as parcelas que o formam
    (o "Ver a composição" do SIGEPSI). As contas fecham com as da faixa.
  */

  const linha = (campos: Record<string, unknown>) =>
    ({ id: "x", status: "Em andamento", ...campos }) as LinhaDoMonitoramento;

  const ultimo = (passos: ReturnType<typeof composicaoDaLinha>) =>
    passos?.[passos.length - 1];

  describe("composição de um número da linha", () => {
    it("Contratados = dentro + além das vagas imediatas", () => {
      const passos = composicaoDaLinha(
        linha({ vagas_total: 51, contratados: 56 }),
        "contratados",
      );
      expect(passos).toEqual([
        { operacao: "", rotulo: "Dentro das vagas imediatas", valor: 51 },
        { operacao: "+", rotulo: "Além das vagas imediatas", valor: 5 },
        { operacao: "=", rotulo: "Contratados no total", valor: 56 },
      ]);
      // Sem nada além das vagas, um número só: sem composição.
      expect(
        composicaoDaLinha(
          linha({ vagas_total: 10, contratados: 4 }),
          "contratados",
        ),
      ).toBeNull();
    });

    it("Vagas = publicadas − reabertas; Sem contratação desconta as duas", () => {
      const reaberta = linha({
        vagas_total: 10,
        vagas_reabertas: 6,
        contratados: 4,
        status: "Concluído",
      });
      expect(ultimo(composicaoDaLinha(reaberta, "vagas_total"))).toEqual({
        operacao: "=",
        rotulo: "Vagas que contam",
        valor: 4,
      });
      expect(composicaoDaLinha(reaberta, "vagas_ociosas")).toEqual([
        { operacao: "", rotulo: "Vagas publicadas", valor: 10 },
        { operacao: "−", rotulo: "Reabertas em edital mais novo", valor: 6 },
        { operacao: "−", rotulo: "Contratadas dentro das vagas", valor: 4 },
        { operacao: "=", rotulo: "Sem contratação", valor: 0 },
      ]);
      expect(
        composicaoDaLinha(linha({ vagas_total: 3 }), "vagas_total"),
      ).toBeNull();
    });

    it("Aprovados = já chamados + aguardando chamada", () => {
      expect(
        composicaoDaLinha(
          linha({ aprovados: 12, cadastro_reserva: 5 }),
          "aprovados",
        ),
      ).toEqual([
        { operacao: "", rotulo: "Já chamados (com status)", valor: 7 },
        { operacao: "+", rotulo: "Aguardando chamada (sem status)", valor: 5 },
        { operacao: "=", rotulo: "Aprovados na lista vigente", valor: 12 },
      ]);
      // Sem lista vigente ("—"), nada a compor.
      expect(
        composicaoDaLinha(linha({ aprovados: null }), "aprovados"),
      ).toBeNull();
    });
  });

  describe("composição dos indicadores fecha com a faixa", () => {
    const LINHAS = [
      linha({
        id: "a",
        vagas_total: 130,
        contratados: 567,
        status: "Concluído",
      }),
      linha({ id: "b", vagas_total: 83, contratados: 1, status: "Concluído" }),
      linha({ id: "c", vagas_total: 27, contratados: 0 }),
      linha({
        id: "d",
        vagas_total: 10,
        vagas_reabertas: 6,
        contratados: 4,
        status: "Concluído",
      }),
      linha({ id: "e", vagas_total: 9, contratados: 9, status: "Cancelado" }),
    ];
    const k = indicadoresDoMonitoramento(LINHAS);

    it("Vagas imediatas = Contratadas + Em seleção + Ociosas, e publicadas − reabertas", () => {
      const passos = composicaoDoIndicador(LINHAS, "vagas")!;
      const valor = (rotulo: string) =>
        passos.find((p) => p.rotulo === rotulo)?.valor;
      expect(valor("Contratadas")).toBe(k.contratadas);
      expect(valor("Em seleção")).toBe(k.emSelecao);
      expect(valor("Ociosas")).toBe(k.ociosas);
      expect(
        passos.filter((p) => p.operacao === "=").map((p) => p.valor),
      ).toEqual([k.vagas, k.vagas]);
      expect(valor("Reabertas em edital mais novo")).toBe(k.reabertas);
    });

    it("Contratadas e além das vagas: dentro + além = contratados", () => {
      const passos = composicaoDoIndicador(LINHAS, "alemDasVagas")!;
      expect(passos.map((p) => p.valor)).toEqual([
        k.contratadas,
        k.alemDasVagas,
        k.contratadas + k.alemDasVagas,
      ]);
    });

    it("Ociosas e Em seleção: vagas do grupo − contratadas nele", () => {
      expect(ultimo(composicaoDoIndicador(LINHAS, "ociosas"))?.valor).toBe(
        k.ociosas,
      );
      expect(ultimo(composicaoDoIndicador(LINHAS, "emSelecao"))?.valor).toBe(
        k.emSelecao,
      );
      // Sem edital sem resultado, Em seleção não tem o que compor.
      expect(composicaoDoIndicador([LINHAS[0]!], "emSelecao")).toBeNull();
      expect(composicaoDoIndicador([], "vagas")).toBeNull();
    });
  });
});

bloco("lib/avisos-do-edital", () => {
  /* A gaveta da Visão geral mostra só os avisos do edital da linha. */
  describe("avisos do edital", () => {
    const lista = {
      geradoEm: null,
      abertos: [
        { id: "1", editalId: "e1" },
        { id: "2", editalId: "e2" },
        { id: "3", editalId: null },
      ],
      dispensados: [{ id: "4", editalId: "e1" }],
      resolvidos: [{ id: "5", editalId: "e1" }],
    };

    it("abertos e dispensados do edital; os resolvidos ficam na central", () => {
      expect(avisosDoEdital(lista, "e1")).toEqual({
        geradoEm: null,
        abertos: [{ id: "1", editalId: "e1" }],
        dispensados: [{ id: "4", editalId: "e1" }],
        resolvidos: [],
      });
    });

    it("sem lista ou sem edital, nada", () => {
      expect(avisosDoEdital(null, "e1")).toBeNull();
      expect(avisosDoEdital(lista, "")).toBeNull();
      expect(avisosDoEdital(lista, 7)?.abertos).toEqual([]);
    });
  });
});

bloco("lib/presets-de-colunas", () => {
  /*
    Revisão de 17/11/2026: "Gestão", "Prazos" e "Contratação" trocam as
    colunas de uma vez; Unidade e Edital (as presas) ficam em todos, na ordem
    da tabela, e o menu sabe qual conjunto está à vista.
  */
  it("cada conjunto tem as fixas e segue a ordem da tabela", () => {
    expect(colunasDoPreset("prazos")).toEqual([
      "unidade",
      "edital",
      "ciclo",
      "data_inicio",
      "data_fim",
      "duracao",
      "status",
      "fase",
    ]);
    for (const { id } of PRESETS_DE_COLUNAS) {
      const colunas = colunasDoPreset(id)!;
      expect(colunas.slice(0, 2)).toEqual(["unidade", "edital"]);
      expect(colunas).toEqual(
        COLUNAS_PADRAO.filter((c) => colunas.includes(c)),
      );
    }
    expect(colunasDoPreset("inventado")).toBeNull();
  });

  it("reconhece o conjunto à vista; escolha própria não é nenhum", () => {
    expect(presetDasColunas(colunasDoPreset("contratacao"))).toBe(
      "contratacao",
    );
    expect(presetDasColunas([...colunasDoPreset("gestao")!].reverse())).toBe(
      "gestao",
    );
    expect(presetDasColunas(["unidade", "edital", "status"])).toBe("");
    expect(presetDasColunas(null)).toBe("");
  });
});

bloco("lib/base/ativos-e-historico", () => {
  const EDITAIS = [
    { id: "a", status: "Em andamento" },
    { id: "b", status: "Concluído" },
    { id: "c", status: "Suspenso" },
    { id: "d", status: "em Andamento" },
    { id: "e", status: "Cancelado" },
    { id: "f", status: "Em andamento", ativo: false },
    { id: "g", status: "Cronograma encerrado" },
    { id: "h", status: "" },
  ];

  it("separa ativos e histórico na ordem em que vieram", () => {
    const { ativos, historico } = separarAtivosEHistorico(
      EDITAIS,
      editalDoHistorico,
    );
    expect(ativos.map((e) => e.id)).toEqual(["a", "c", "d", "h"]);
    expect(historico.map((e) => e.id)).toEqual(["b", "e", "f", "g"]);
    expect(separarAtivosEHistorico(null, () => true)).toEqual({
      ativos: [],
      historico: [],
    });
  });

  it("conta por situação: grafias juntas, mais numerosa primeiro", () => {
    const ativos = EDITAIS.filter((e) => !editalDoHistorico(e));
    const contagem = contarPorSituacao(ativos, situacaoDoEdital);
    expect(contagem).toEqual([
      { rotulo: "Em andamento", quantos: 2 },
      { rotulo: "Sem situação", quantos: 1 },
      { rotulo: "Suspenso", quantos: 1 },
    ]);
    expect(textoDasSituacoes(contagem)).toBe(
      "Em andamento 2 · Sem situação 1 · Suspenso 1",
    );
    expect(textoDasSituacoes([{ rotulo: "Concluído", quantos: 1234 }])).toBe(
      "Concluído 1.234",
    );
  });

  it("o desativado aparece como Desativado; a cor segue o status", () => {
    expect(situacaoDoEdital({ status: "Em andamento", ativo: false })).toBe(
      "Desativado",
    );
    expect(tomDaSituacaoDoEdital("Concluído")).toBe("aprovado");
    expect(tomDaSituacaoDoEdital("Cancelado")).toBe("reprovado");
    expect(tomDaSituacaoDoEdital("Em andamento")).toBe("revisar");
    expect(tomDaSituacaoDoEdital("Suspenso")).toBe("neutro");
  });

  it("a vista guardada: só historico muda o padrão", () => {
    expect(vistaDaLista("historico")).toBe("historico");
    expect(vistaDaLista("ativos")).toBe("ativos");
    expect(vistaDaLista({})).toBe("ativos");
  });

  it("junta o status do monitoramento pelo id", () => {
    const juntos = comSituacaoDoMonitoramento(
      [{ id: "x", edital: "1/2026" }, { id: "y" }],
      [{ id: "x", status: "Concluído", ativo: true }, null, { id: 7 }],
    );
    expect(juntos).toEqual([
      { id: "x", edital: "1/2026", status: "Concluído", ativo: true },
      { id: "y" },
    ]);
  });
});

bloco("lib/base/exportacao-da-tabela", () => {
  const TABELA = {
    titulo: "Seleção — Saúde Indígena",
    colunas: ["Unidade", "Cargo", "Inscritos"],
    linhas: [
      ["DSEI Xingu", "=HYPERLINK(1)", 1200],
      ["DSEI Yanomami", "Médico & cia", null],
    ],
  };
  const texto = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
  const QUANDO = new Date("2026-11-18T13:00:00Z");

  it("nome do arquivo sem acento, espaço nem barra, com a extensão", () => {
    expect(
      nomeDoArquivoExportado(
        ["Seleção", "saude-indigena", "2026-11-18"],
        "xlsx",
      ),
    ).toBe("selecao-saude-indigena-2026-11-18.xlsx");
    expect(nomeDoArquivoExportado(["A/B C", null, ""], "pdf")).toBe(
      "a-b-c.pdf",
    );
    expect(nomeDoArquivoExportado([], "pdf")).toBe("exportacao.pdf");
  });

  it("Excel: texto como texto (nunca fórmula), número como número, cabeçalho com filtro", () => {
    const xml = texto(xlsxDaTabela(TABELA, QUANDO));
    expect(xml).toContain("Seleção — Saúde Indígena");
    expect(xml).toContain('t="inlineStr"');
    expect(xml).toContain("=HYPERLINK(1)");
    expect(xml).not.toContain("<f>");
    expect(xml).toContain("<v>1200</v>");
    expect(xml).toContain("Médico &amp; cia");
    expect(xml).toContain('<autoFilter ref="A1:C3"/>');
    expect(xml.match(/<row /g)).toHaveLength(3);
  });

  it("PDF: título, emissão em Brasília, total e números à brasileira", async () => {
    const pdf = texto(
      await pdfDaTabela(TABELA, { quando: QUANDO, comprimir: false }),
    );
    expect(pdf.startsWith("%PDF")).toBe(true);
    expect(pdf).toContain("Emitido em 18/11/2026, 10:00");
    expect(pdf).toContain("2 registros");
    expect(pdf).toContain("1.200");
    expect(pdf).toContain("DSEI Yanomami");
    expect(pdf).toContain("gina 1 de 1"); // "Página", com o á da fonte padrão
    expect(textoDaCelula(1.5)).toBe("1,5");
    expect(textoDaCelula(null)).toBe("");
  });

  it("os dois formatos pelo mesmo retrato", async () => {
    const excel = await arquivoDaTabela("excel", TABELA, QUANDO);
    expect(excel.extensao).toBe("xlsx");
    expect(excel.tipo).toContain("spreadsheetml");
    const pdf = await arquivoDaTabela("pdf", TABELA, QUANDO);
    expect(pdf.extensao).toBe("pdf");
    expect(pdf.tipo).toBe("application/pdf");
  });
});

/*
  Desde o #887 os blocos de um assunto rodam no mesmo processo: os bancos PGlite
  que ninguém fechava se somavam (8,5 GB num arquivo) e derrubavam a máquina do
  GitHub. O bloco fecha o banco criado num teste ao fim dele e o do beforeAll ao
  fim do bloco (tests/apoio/bancos-abertos.ts).
*/
bloco("apoio/bancos-abertos", () => {
  const falso = () => {
    const banco = {
      closed: false,
      async close() {
        banco.closed = true;
      },
    };
    return banco;
  };
  const doBloco = falso();
  let doPrimeiroTeste = falso();

  describe("os bancos de teste são fechados", () => {
    beforeAll(() => {
      lembrarBanco(doBloco);
    });

    it("o banco criado no teste fica aberto enquanto o teste dura", () => {
      doPrimeiroTeste = lembrarBanco(falso());
      expect(doPrimeiroTeste.closed).toBe(false);
    });

    it("no teste seguinte, o do teste anterior já foi fechado e o do beforeAll continua aberto", () => {
      expect(doPrimeiroTeste.closed).toBe(true);
      expect(doBloco.closed).toBe(false);
    });
  });
});

bloco("lib/pede-acao-da-visao-geral", () => {
  /*
    "Pede ação" da Visão geral: a pendência abre os editais dela (do recorte),
    pelo número, e cada pendência tem a ação que a resolve e a tela dela.
  */
  it("os editais da pendência, pelo número do edital", () => {
    const linhas = [
      { id: 1, edital: "12/2026", pos_resultado: ["sem_lista" as const] },
      { id: 2, edital: "3/2026", pos_resultado: ["sem_lista" as const] },
      { id: 3, edital: "7/2026", pos_resultado: ["sem_status" as const] },
      { id: 4, edital: "8/2026" },
    ];
    expect(editaisDaPendencia(linhas, "sem_lista").map((l) => l.id)).toEqual([
      2, 1,
    ]);
    expect(editaisDaPendencia(linhas, "sem_status").map((l) => l.id)).toEqual([
      3,
    ]);
    expect(editaisDaPendencia(null, "sem_lista")).toEqual([]);
  });

  it("cada pendência tem a ação e a tela que a resolvem", () => {
    expect(ACAO_DA_PENDENCIA.sem_lista).toEqual({
      rotulo: "Importar lista",
      view: "nucleo",
    });
    expect(ACAO_DA_PENDENCIA.sem_status).toEqual({
      rotulo: "Atualizar status",
      view: "approved",
    });
  });
});

bloco("lib/fluxo-das-etapas", () => {
  /*
    O fluxo entre as etapas do processo seletivo
    (src/lib/navegacao/fluxo-das-etapas.ts): a ordem, o título da faixa e
    como cada tela recebe o edital e a vaga (o mesmo destino da aba
    "Candidatos" da página do edital).
  */
  const ID = "0b7c9a52-2d55-4c4e-9f7a-1c3d5e7f9a1b";
  const etapa = (view: string) => {
    const achada = etapaDoFluxo(view);
    if (!achada) throw new Error(`sem a etapa ${view}`);
    return achada;
  };

  it("as etapas, na ordem do processo, sem o Painel da Seleção", () => {
    expect(ETAPAS_DO_FLUXO.map((e) => e.curto)).toEqual([
      "Triagem",
      "Documental",
      "Recursos",
      "Entrevistas",
      "Classificação",
      "Aprovados",
    ]);
    expect(
      etapasDoFluxo((view) => view !== "analisar-recursos").map((e) => e.view),
    ).toEqual([
      "pre-classificacao",
      "avaliacao-documental",
      "conduzir-entrevistas",
      "classificacao",
      "approved",
    ]);
    expect(etapaDoFluxo("selecao")).toBeUndefined();
  });

  it("o título diz a etapa e o edital", () => {
    expect(tituloDoFluxo("avaliacao-documental", "Edital nº 093/2026")).toBe(
      "Documental do 93/2026",
    );
    expect(tituloDoFluxo("approved", "93/2026 · DSEI Fictício")).toBe(
      "Aprovados do 93/2026",
    );
    expect(tituloDoFluxo("classificacao", "")).toBe("Classificação");
    expect(tituloDoFluxo("dashboard", "93/2026")).toBe("");
  });

  it("pelo id, a navegação leva o edital; a vaga vai no pedido só para quem recorta por vaga", () => {
    const edital = { id: ID, numero: "93/2026" };
    expect(idaParaAEtapa(etapa("classificacao"), edital, "179698")).toEqual({
      view: "classificacao",
      extras: { edital: ID },
      filtro: { editalId: ID, vaga: "179698" },
    });
    expect(idaParaAEtapa(etapa("pre-classificacao"), edital)).toEqual({
      view: "pre-classificacao",
      extras: { edital: ID },
    });
    // Sem id, a tela que abre pelo id não tem para onde ir.
    expect(
      idaParaAEtapa(etapa("conduzir-entrevistas"), { numero: "93/2026" }),
    ).toBeNull();
  });

  it("pelo número (Recursos, Aprovados), o pedido leva o número e o id; a vaga fica", () => {
    expect(
      idaParaAEtapa(
        etapa("analisar-recursos"),
        { id: ID, numero: "93/2026" },
        "179698",
      ),
    ).toEqual({
      view: "analisar-recursos",
      filtro: { edital: "93/2026", editalId: ID },
    });
    expect(
      idaParaAEtapa(etapa("approved"), { numero: "Edital 93/2026" }),
    ).toEqual({
      view: "approved",
      filtro: { edital: "93/2026" },
    });
    expect(idaParaAEtapa(etapa("approved"), { id: ID })).toBeNull();
  });

  it("a vaga da Classificação segue pelo código; a linha do quadro sem código, não", () => {
    expect(vagaDaChave("179698")).toBe("179698");
    expect(vagaDaChave("quadro:42")).toBe("");
    expect(vagaDaChave(null)).toBe("");
  });

  it("o pedido com a vaga espera a tela chegar no edital dele", () => {
    const agora = 1_000;
    pedirFiltro("classificacao", { editalId: ID, vaga: "179698" }, agora);
    const noEdital = (filtro: { editalId?: string }) => filtro.editalId === ID;
    // Outro edital aberto: o pedido fica.
    expect(
      consumirPedidoDeFiltro("classificacao", agora, () => false),
    ).toBeNull();
    expect(consumirPedidoDeFiltro("classificacao", agora, noEdital)).toEqual({
      editalId: ID,
      vaga: "179698",
    });
    expect(consumirPedidoDeFiltro("classificacao", agora, noEdital)).toBeNull();
  });

  it("Recursos recorta pelo id do edital quando ele vem, e pelo número sem ele", () => {
    const opcoes = {
      editais: [
        { valor: "e1", rotulo: "93/2026 · DSEI Fictício" },
        { valor: ID, rotulo: "93/2026 · DSEI Outro" },
      ],
    };
    const vazios = {
      edital: "",
      origem: "",
      analista: "",
      situacao: "",
      pendencia: "",
      busca: "",
    };
    expect(
      filtrosDeRecursos(vazios, { edital: "93/2026", editalId: ID }, opcoes)
        .edital,
    ).toBe(ID);
    expect(
      filtrosDeRecursos(vazios, { edital: "93/2026" }, opcoes).edital,
    ).toBe("e1");
  });
});
