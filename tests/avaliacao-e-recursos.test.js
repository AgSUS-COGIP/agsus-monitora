// @vitest-environment node
import { bloco } from "./apoio/bloco.ts";
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  analisesPorResponsavel,
  apararSelecao,
  chaveDoDia,
  diaNoPeriodo,
  filtrarPorPeriodo,
  normalizarPeriodo,
  PERIODO_VAZIO,
  periodoDoClique,
  rotuloDoPeriodo,
  temPeriodo,
  calcularKpis,
  csvDasAnalises,
  dataDaPlanilha,
  descricaoDoRecorte,
  detalheDaAnalise,
  editalDaLinha,
  filtrarLinhas,
  filtrarPelaBuscaDaFila,
  FILTROS_VAZIOS,
  formatarData,
  linhasDoPayload,
  marcasDoRecorte,
  normalizarEscopo,
  opcoesDosFiltros,
  pendenciasPrioritarias,
  prepararLinhas,
  quantosFiltros,
  recorteVisual,
  rotuloDoEscopo,
  SEM_RESPONSAVEL,
  temMunicipio,
  tendenciaDiaria,
  tomDoStatus,
  ultimaAtualizacao,
  urlSegura,
  validacaoDaJanela,
  normalizarPayloadDasAnalises,
} from "../src/lib/analises/analises-curriculares.ts";
import { urlDaPlanilhaGoogle, PLANILHAS } from "../src/lib/base/planilhas.ts";
import {
  criarConsultasDasAnalises,
  VERSAO_DA_COPIA,
} from "../src/modulos/analises/consultas.ts";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  ACEITA_NO_SELETOR,
  BUCKET_DOS_ANEXOS,
  caminhoDoAnexo,
  LIMITE_DO_ANEXO,
  nomeSeguroDoAnexo,
  tamanhoLegivel,
  TIPOS_DE_ANEXO,
  TIPOS_DE_ARQUIVO,
  tipoDoArquivo,
  validarArquivoDoAnexo,
} from "../src/lib/recursos/anexos-do-recurso.ts";
import vm from "node:vm";
import {
  AREA_PADRAO_DO_PAINEL,
  chaveDoCacheDoPayload,
  colunasDoCsvDeAnalises,
  ehAreaSaudeIndigena,
  experienciaProfissionalDaLinha,
  mensagemDeAreaSemAnalises,
  nomeDoCsvDeAnalises,
  parametroDeAreaDaRpc,
  rotuloDaAreaDoPainel,
} from "../src/lib/analises/area-do-painel-de-analises.ts";
import {
  contadoresComForaDoLote,
  juntarFila,
  lerForaDoLote,
  modalidadesDaFila,
  precisaDoForaDoLote,
  resumoForaDoLote,
} from "../src/lib/avaliacao-documental/fila-fora-do-lote.ts";
import {
  normalizarDadosDosRecursos,
  normalizarDetalheDoRecurso,
  normalizarCandidatosDosRecursos,
  normalizarDadosDosModelos,
  normalizarRespostaDoRecurso,
} from "../src/lib/recursos/dados-dos-recursos.ts";
import {
  dataDaPlanilha as dataDaPlanilha__1,
  dataDeAnaliseNoFuturo,
} from "../src/lib/analises/data-de-analise.ts";
import {
  acompanhamentoDasInscricoes,
  diasEntre,
  textoDoHoje,
} from "../src/lib/avaliacao-documental/acompanhamento-das-inscricoes.ts";
import {
  dataDeCorteDoCronograma,
  janelaDasInscricoes,
} from "../src/lib/classificacao/dados.ts";
import {
  CRONOGRAMA_114,
  DADOS_114,
  r,
} from "./fixtures/acompanhamento-das-inscricoes.js";
import {
  anexosDaColuna,
  chaveDoEnunciado,
  enunciadosCasam,
  anexosDaEmpregare,
  apresentacaoDoAnexo,
  enderecoDoAnexo,
  enunciadoCompleto,
  enviosAnterioresDaEmpregare,
  impressaoDasRespostas,
  numeroDaPergunta,
  respostaLidaDaEmpregare,
} from "../src/lib/avaliacao-documental/anexo-na-empregare.ts";
import {
  abreComLinhaNova,
  apuradoDoBloco,
  blocoComDecisao,
  blocoComEscolha,
  escolhaDoBloco,
  escolhaPelosItens,
  lancamentoComEscolha,
  lancamentoConfirmadoPelosItens,
  semConfirmacaoSeMudouItens,
  tituloDaResposta,
  composicaoComPrevias,
  notaComPrevias,
  linhasDasRespostas,
} from "../src/lib/avaliacao-documental/apurado-da-ficha.ts";
import {
  faltaDoComprovado,
  itemCompleto,
  lancamentoParaGravar,
  opcoesDeJustificativa,
  calcularFicha,
  pendenciasDaFicha,
  resumoParaGravar,
  composicaoDaNota,
  conferenciaDaFicha,
  declaradaDaFicha,
  regraDaFicha,
  pontuacaoAcimaDoComprovado,
  blocoSeAplica,
  decidePelaNota,
  divergenciaDoBloco,
  enderecoDaVagaNaEmpregare,
  ehAnexo,
  enderecoDoCandidatoNaEmpregare,
  etapasDaFicha,
  lancamentoInicial,
  nivelDaFicha,
  nomeCurtoDoBloco,
  nomeDaEtapa,
  PASSO_DA_CONCLUSAO,
  passosDaFicha,
  previaDoParecer,
  proximoPassoPendente,
  respostasDoBloco,
  escolhaDaTecla,
  itemConferido,
  mensagemDoBloco,
  sugereNaoEnviado,
  textoDaAlteracao,
  textoDaSituacaoDaConferencia,
  TEXTO_DO_PARECER_EM_ANALISE,
  textoDoProgresso,
  titulosDoNivel,
  blocoNaoPontuaNoNivel,
} from "../src/lib/avaliacao-documental/ficha.ts";
import {
  alternarCartao,
  alternarDeclarada,
  cartoesDaRegra,
  codigoDoTexto,
  comEliminacao,
  comItemDaDeclarada,
  comPergunta,
  eliminacaoDoCartao,
  ligacoesDaRegra,
  ligarAutomaticamente,
  motivoDoPontoDePartida,
  moverNaLista,
  opcoesDePerguntas,
  perguntaComDadoPessoal,
  regraDoPontoDePartida,
  respostasDaPergunta,
  situacaoDaPergunta,
  sugerirPerguntas,
  GRUPOS_DO_CARDAPIO,
  regraNormalizada,
} from "../src/lib/avaliacao-documental/assistente-da-regra.ts";
import {
  regrasIguais,
  validarRegraAnalise,
  normalizarRegraAnalise,
  blocoNovo,
  codigoLivre,
  normalizarPergunta,
  perguntaDoTexto,
  textoDaPergunta,
} from "../src/lib/avaliacao-documental/regra.ts";
import {
  htmlDoResumo,
  resumoDaRegra,
  textoDoResumo,
} from "../src/lib/avaliacao-documental/resumo-da-regra.ts";
import {
  diferencasEntreRegras,
  fraseDaDiferenca,
} from "../src/lib/avaliacao-documental/comparar-regras.ts";
import {
  DESEMPATES_DA_PROVISORIA,
  TIPOS_DE_BLOCO,
} from "../src/lib/avaliacao-documental/catalogo.ts";
import {
  catalogoAgrupado,
  CRITERIOS_DA_CLASSIFICACAO,
  CRITERIOS_DA_PROVISORIA,
  GRUPOS_DE_DESEMPATE,
} from "../src/lib/avaliacao-documental/catalogo-de-desempate.ts";
import { CATALOGO_DE_CRITERIOS } from "../src/lib/classificacao/catalogo.ts";
import {
  comprovadoDaExperiencia,
  comprovadoDosCursos,
  comprovadoDosTitulos,
  diasEmComum,
  textoDoTempo,
} from "../src/lib/avaliacao-documental/comprovado-da-ficha.ts";
import {
  assuntoDaObservacao,
  justificativasDoBloco,
} from "../src/lib/avaliacao-documental/justificativas-do-bloco.ts";
import { motivosDoResultado } from "../src/lib/avaliacao-documental/motivos-do-resultado.ts";
import {
  apurarExperiencia,
  calcularAvaliacao,
  anosMesesDias,
  diasDosIntervalos,
  faixaDoCurso,
  linhasSemEspacosNasPontas,
  numeroDoParecer,
  preencherModelo,
  cotasConfirmadas,
  modalidadesDoLancamento,
} from "../src/lib/avaliacao-documental/pontuacao.ts";
import {
  faltaNasDatasDoVinculo,
  fimDoVinculoAtual,
  hojeEmBrasilia,
} from "../src/lib/avaliacao-documental/datas-do-vinculo.ts";
import {
  colunasDaEtapa,
  textoDaColuna,
  loteDaFila,
  acoesDaFicha,
  acoesDaSelecao,
  agruparPorVaga,
  andamentoDaFila,
  contadoresDaFila,
  csvDaFila,
  fichaPeloCodigo,
  filtrarFila,
  filtroEhInicial,
  FILTRO_INICIAL,
  naEtapa,
  nomeDoCsvDaFila,
  normalizarFiltro,
  ordenarFila,
  planoDeDistribuicao,
  proximaOrdem,
  reservaVigente,
  resumoDaVagaNaFila,
  textoDaReserva,
  textoDaSituacaoNaFila,
  filtrosDaFilaEmUso,
} from "../src/lib/avaliacao-documental/fila.ts";
import {
  linhaDoItemLido,
  aceitarItemCorrigido,
  aceitarItemLido,
  alertasResumidos,
  anexoEhImagem,
  linhaAceita,
  linhaParaCorrigir,
  linkDaMiniatura,
  textoDaLinha,
  aceitarTodosSemAlerta,
  alertasDoArquivo,
  conferirTodos,
  desfazerAceitos,
  desfazerDecisaoLida,
  estadoDoItemLido,
  itensParaConferir,
  leituraDoAnexo,
  leiturasDaFicha,
  recusarItemLido,
  rotuloDaRecusa,
  textoDoItemLido,
} from "../src/lib/avaliacao-documental/leitura-dos-arquivos.ts";
import { criarEstadoDaPreClassificacao } from "../src/modulos/avaliacao-documental/estado-da-pre-classificacao.ts";
import { decidirNoLote } from "../src/modulos/avaliacao-documental/decisao-no-banco.ts";
import {
  codigosPorVaga,
  contadoresDaPreClassificacao,
  entrouPorDecisao,
  erroDoMotivo,
  loteDaVaga,
  MOTIVO_DA_DECISAO,
  MOTIVO_DA_REVOGACAO,
  MOTIVO_SUGERIDO_DA_DECISAO,
  motivoDaDecisao,
  podeIncluirPorDecisao,
  seloDaDecisao,
  textoDoAviso,
  textoDoLote,
  declaradasCongeladas,
  lotesAPublicar,
  AVISOS_DA_VAGA,
} from "../src/lib/avaliacao-documental/tela-da-pre-classificacao.ts";
import {
  documentoOficial,
  htmlParaSei,
  marcasDasDecisoes,
  textoParaSei,
} from "../src/lib/classificacao/documento-sei.ts";
import { corpoXml } from "../src/lib/classificacao/documento-docx.ts";
import {
  distribuirFichas,
  tetoDoAnalista,
} from "../src/lib/avaliacao-documental/distribuicao.ts";
import {
  chaveDaPessoa,
  comunicadosDosEliminados,
  concluidosDaFila,
  eliminadosDaPre,
  filtrarPessoas,
  marcadas,
} from "../src/lib/avaliacao-documental/documentos-em-lote.ts";
import {
  nomeDoZipDosEspelhos,
  carregarBibliotecasDoPdf,
  nomeDoPdfDoEspelho,
  nomesSemRepetir,
  pdfDoEspelho,
  textoParaOPdf,
  trechoDoNome,
  zipDosEspelhos,
} from "../src/lib/avaliacao-documental/espelho-em-pdf.ts";
import { espelhoDaEliminacaoPreAnalise } from "../src/lib/avaliacao-documental/espelho-da-pre-classificacao.ts";
import {
  folhaDoEspelho,
  modeloDoEspelho,
  montarEspelho,
  paginaDoEspelho,
  COLUNAS_DOS_CRITERIOS,
  documentoDosEspelhos,
  espelhoDeExemplo,
  notasDoEspelho,
} from "../src/lib/avaliacao-documental/espelho-de-nota.ts";
import {
  TEXTOS_PADRAO_DO_ESPELHO,
  TEXTOS_PADRAO_DO_ESPELHO as PADRAO,
  CAMPOS_DO_MODELO,
  comOCandidato,
  diferencasDoPadrao,
  lerModeloDoEdital,
  textosDoModelo,
  trechosDaSaudacao,
  validarModeloDoEspelho,
} from "../src/lib/avaliacao-documental/modelo-do-espelho.ts";
import {
  entradaDoEspelho,
  espelhoDaFichaGravada,
} from "../src/lib/avaliacao-documental/espelho-da-ficha-gravada.ts";
import { unzipSync, strFromU8 } from "fflate";
import {
  argumentosDaPagina,
  avisoDoTamanho,
  codigosSemEspelho,
  estimativaDosEspelhos,
  FICHAS_POR_PAGINA,
  lerCodigos,
  ordenarParaOsEspelhos,
} from "../src/lib/avaliacao-documental/espelhos-em-massa.ts";
import { abrirEspelhosEmMassa } from "../src/modulos/avaliacao-documental/ficha/espelho-de-nota.ts";
import {
  lerFichasDosEspelhos,
  montarEspelhosLidos,
  RPC_ESPELHOS_DE_NOTA,
} from "../src/modulos/avaliacao-documental/espelhos-em-massa.tsx";
import {
  aplicarMudancasDaFila,
  argumentosDaFilaDesde,
} from "../src/lib/avaliacao-documental/fila-por-mudancas.ts";
import {
  editaisDaEscolha,
  editalVigente,
} from "../src/lib/avaliacao-documental/editais.ts";
import {
  comJustificativasDosItens,
  justificativaDoBloco,
  TAMANHO_DA_JUSTIFICATIVA,
} from "../src/lib/avaliacao-documental/justificativa-dos-itens.ts";
import {
  comListasRefeitas,
  criarLeituraPorVersao,
  funcaoAusente,
  linhasDoPacote,
} from "../src/lib/avaliacao-documental/leitura-por-versao.ts";
import {
  MOTIVOS_DA_REABERTURA,
  textoDaReabertura,
  validarReabertura,
} from "../src/lib/avaliacao-documental/motivos-da-reabertura.ts";
import {
  erroDoMotivoDaFila,
  motivoPareceTexto,
} from "../src/lib/avaliacao-documental/qualidade-do-motivo.ts";
import {
  aptasDaFila,
  concluidasHoje,
  ritmoDaFila,
} from "../src/lib/avaliacao-documental/numeros-da-fila.ts";
import { porcentagemDe } from "../src/ui/faixa-de-situacao.tsx";
import {
  argumentosDaPagina as argumentosDaPagina__2,
  contarPorVaga,
  linhasDaPreInteira,
  motivosDasLinhas,
  paginaDaResposta,
  resumoDaPreInteira,
} from "../src/lib/avaliacao-documental/paginas-da-pre-classificacao.ts";
import {
  lugarDoErro,
  pendenciasDoSalvar,
} from "../src/lib/avaliacao-documental/pendencias-do-salvar.ts";
import {
  semPerguntaNoQuestionario,
  arquivosDaPergunta,
  itensSugeridos,
} from "../src/lib/avaliacao-documental/respostas-do-candidato.ts";
import {
  acoesDaPessoa,
  chaveDasPessoas,
  FILTRO_DAS_PESSOAS_INICIAL,
  filtrosDasPessoasEmUso,
  gruposDaSituacao,
  normalizarFiltroDasPessoas,
  recorteDasPessoas,
} from "../src/lib/avaliacao-documental/pessoas-da-triagem.ts";
import {
  calcularNotaDeclarada,
  colunaDaPergunta,
  divergeDaArt,
  lerArt,
  chaveDaOpcao,
  opcoesDaResposta,
  perguntaAmbigua,
  textoDaResposta,
} from "../src/lib/avaliacao-documental/nota-declarada.ts";
import {
  comPontosQuandoInapto,
  pontuacaoInformativaDaFicha,
} from "../src/lib/avaliacao-documental/pontos-informativos.ts";
import {
  artDasColunas,
  congelaADeclarada,
  dataDaIdade,
  declaradaCongelada,
  eliminacaoDoCandidato,
  fimDasInscricoes,
  idadeEm,
  mesesDeclarados,
  modalidadeDoCandidato,
  numeroNoTexto,
  perguntasAmbiguas,
  preClassificarVaga,
  tamanhoDoLote,
  vagasPorModalidade,
} from "../src/lib/avaliacao-documental/pre-classificacao.ts";
import { nivelDaVaga } from "../src/lib/classificacao/vagas.ts";
import {
  avisosDoTituloUnico,
  cargoCasa,
  diferencaDaVaga,
  diferencaNova,
  faltasDoCargo,
  lancadoComExtra,
  lancadoComRequisito,
  pontosDosExtras,
  regraDaVaga,
  resumoDaDiferenca,
  seletorDoCargo,
  textoDoCargo,
  validarPorCargo,
} from "../src/lib/avaliacao-documental/regra-por-cargo.ts";
import {
  linhaDaEquipe,
  resumoDaEquipe,
  validarEquipe,
} from "../src/lib/avaliacao-documental/equipe.ts";
import {
  erroDoMotivoDoPedido,
  lerReinicio,
  mensagemDoErroDoReinicio,
  modoDoReinicio,
  numeroConfere,
  pedidoParaAprovar,
  textoDoEventoDoReinicio,
  textoDoImpacto,
} from "../src/lib/avaliacao-documental/reinicio-das-fichas.ts";
import {
  agruparPorOutroMotivo,
  argumentosDoRelatorio,
  catalogoDoRelatorio,
  chaveDoTexto,
  csvDoRelatorio,
  FILTROS_INICIAIS,
  filtrosDoAtalho,
  linhasDoRelatorio,
  motivosDoFiltro,
  nomeDoRelatorio,
  textoDoCodigo,
  xlsxDoRelatorio,
} from "../src/lib/avaliacao-documental/relatorio-de-motivos.ts";
import {
  ehTimeoutDaFila,
  lerFilaComRecuperacao,
} from "../src/lib/avaliacao-documental/repetir-leitura-da-fila.ts";
import { regraComTextosSemEspacosNasPontas } from "../src/lib/avaliacao-documental/textos-da-regra.ts";
import {
  ETAPAS_DAS_REGRAS,
  etapaDasRegras,
} from "../src/lib/regras-do-edital/regras-do-edital.ts";
import {
  desempateDaAvaliacao,
  resumoDaRegraDaAvaliacao,
  resumoDaRegraDaClassificacao,
} from "../src/lib/regras-do-edital/regras-do-edital-resumos.ts";
import {
  compararNaOrdemDoBanco,
  completarLinhaPeloEnvelope,
  envelopeDeTodos,
  juntarPartesDoPainel,
  linhaSemDetalhe,
  mesclarDetalhe,
  partesDoEscopo,
} from "../src/lib/analises/lista-do-painel-de-analises.ts";
import { modalidadesDaConcorrencia } from "../src/lib/analises/modalidades-de-concorrencia.ts";
import {
  CHAVES_DOS_MARCADORES,
  dadosDoModelo,
  dataPorExtenso,
  errosDoModelo,
  marcadoresDesconhecidos,
  marcadoresDoTexto,
  modelosAplicaveis,
  renderizarModelo,
  valoresDoRecurso,
} from "../src/lib/recursos/modelos-de-resposta.ts";
import { ESQUEMAS_DO_PAYLOAD } from "../src/lib/analises/cache-do-painel-de-analises.ts";
import { dataHora } from "../src/modulos/recursos/partes.ts";
import { criarEstadoDosRecursos } from "../src/modulos/recursos/estado.ts";
import {
  ACOES_DO_PARECER,
  acoesDoParecer,
  aguardandoParecer,
  avaliarAcaoDoParecer,
  erroDoTextoDoParecer,
  proximaSituacao,
} from "../src/lib/recursos/parecer-do-recurso.ts";
import {
  SITUACOES,
  calcularIndicadores,
  compararEditais,
  csvDosRecursos,
  dadosParaSalvar,
  diasEntre as diasEntre__4,
  enriquecerRecursos,
  errosDoRascunho,
  esteiraDosRecursos,
  filtrarRecursos,
  FILTROS_VAZIOS as FILTROS_VAZIOS__5,
  impactoNoResultado,
  notaMudou,
  opcoesDosFiltros as opcoesDosFiltros__6,
  pendenciasPrioritarias as pendenciasPrioritarias__7,
  RASCUNHO_VAZIO,
  recursoDuplicado,
  recursosPorAnalista,
  recursosPorSituacao,
} from "../src/lib/recursos/recursos-dos-candidatos.ts";
import { JSDOM } from "jsdom";
import {
  blocoDo,
  comporParecer,
  DIAS_POR_MES,
  linhasDeTexto,
  mesesDaExperiencia,
  periodoDeInterposicao,
  pontosDoParecer,
  preencher,
  rascunhoInicial,
  rascunhoVazio,
  referenciasDoEdital,
  REFERENCIAS_PADRAO,
  textoDoParecer,
  textosDoModelo as textosDoModelo__3,
  totalSemSobreposicao,
} from "../src/lib/recursos/parecer-em-blocos.ts";
import {
  linhasVisiveis,
  preencherOSimulador,
} from "../src/modulos/recursos/parecer-em-blocos/simulador.ts";
import { dadosFicticios } from "../src/modulos/recursos/parecer-em-blocos/dados-ficticios.ts";
import { CASOS, casoCompleto } from "./casos-do-parecer.js";
import { TEXTOS_ESPERADOS } from "./parecer-em-blocos-esperado.js";
import {
  AVISO_PRAZO_PELA_ABERTURA,
  AVISO_SEM_PRAZO,
  classificarCronograma,
  cronogramasPorEdital,
  normalizarAtividade,
  origemDaAtividade,
  papelDaAtividade,
  prazoDoRecurso,
} from "../src/lib/recursos/prazo-do-recurso.ts";
import {
  chaveDoRascunhoLocal,
  dataEHoraCurtas,
  escolherRascunho,
  rascunhoDoBanco,
  rascunhoDoLocal,
  rascunhoParaLocal,
  recuperacaoDoRascunho,
  textoDaGravacao,
} from "../src/lib/regras-do-edital/rascunho-da-regra.ts";
import {
  ACOES_DA_RESPOSTA,
  acoesDaResposta,
  avaliarAcao,
  erroDoComentario,
  ESTADOS_DA_RESPOSTA,
  podeEditarTexto,
  proximoEstado,
} from "../src/lib/recursos/resposta-do-recurso.ts";
import {
  chaveDaVaga,
  chaveDoEdital,
  inteiroPtBr,
  linhasDaAbaResultado,
} from "../src/lib/selecao/selecao-da-planilha.ts";
import {
  haLinhasSemParecer,
  linhaSemParecer,
  mapaDosTextos,
  mesclarTextos,
  municipioUfDaLinha,
  municipioUfDaVaga,
  parecerDoDetalhe,
} from "../src/lib/analises/textos-do-painel-de-analises.ts";

bloco("analises-curriculares", () => {
  /*
  As regras da tela de Análises curriculares (src/modulos/analises/): o que o
  antigo painel (analises-app.js e os sete remendos) fazia, agora em funções
  puras — payload, janela oficial, filtros em cascata, KPIs, gráficos,
  pendências, recorte, gaveta e CSV.
*/

  const AGORA = new Date(2026, 9, 1, 12); // 01/10/2026

  const linha = (extra = {}) => ({
    id: "a1",
    grupo: "Saúde Indígena",
    unidade: "DSEI Yanomami",
    edital: "10/2026",
    codigo_vaga: "V-1",
    nome_vaga: "Enfermeiro 40h",
    candidato: "Ana",
    categoria: "Saúde",
    modalidade_concorrencia: "Ampla concorrência",
    status_consolidado: "Pendente",
    etapa: "",
    responsavel_analise: "Carla",
    data_analise: "",
    ...extra,
  });

  const prontas = (linhas, opcoes = {}) =>
    prepararLinhas(linhas, { area: "saude-indigena", agora: AGORA, ...opcoes });

  describe("situação do processo", () => {
    it("só ativo, inativo ou todos; o resto vira ativo", () => {
      expect(normalizarEscopo("TODOS")).toBe("todos");
      expect(normalizarEscopo("xyz")).toBe("ativo");
      expect(rotuloDoEscopo("inativo")).toBe("Inativo");
    });
  });

  describe("linhas do payload", () => {
    it("colunas pelo nome, o envelope em cada linha e o responsável em branco", () => {
      const linhas = linhasDoPayload({
        grupo: "SEDE",
        edital_status: "Ativo",
        columns: ["id", "candidato", "responsavel_analise"],
        rows: [
          ["a1", "Ana", "Carla"],
          ["a2", "Bia", "  "],
        ],
      });
      expect(linhas[0]).toEqual({
        id: "a1",
        candidato: "Ana",
        responsavel_analise: "Carla",
        grupo: "SEDE",
        edital_status: "Ativo",
      });
      expect(linhas[1].responsavel_analise).toBe(SEM_RESPONSAVEL);
      expect(linhas[1].responsavel_ausente).toBe(true);
    });

    it("payload sem colunas é erro", () => {
      expect(() => linhasDoPayload({ rows: [] })).toThrow(/inválido/);
    });
  });

  describe("datas da planilha", () => {
    it("dd/mm/aaaa, aaaa-mm-dd e ISO; outro formato fica sem data", () => {
      expect(dataDaPlanilha("05/09/2026")).toEqual(new Date(2026, 8, 5));
      expect(dataDaPlanilha("2026-09-05")).toEqual(new Date(2026, 8, 5));
      expect(dataDaPlanilha("2026-09-05T10:00:00Z")).toBeInstanceOf(Date);
      expect(dataDaPlanilha("09-05-2026")).toBeNull();
      expect(formatarData("2026-09-05")).toBe("05/09/2026");
      expect(formatarData("semana 3")).toBe("semana 3");
    });
  });

  describe("janela oficial e validação", () => {
    const editais = [
      {
        grupo: "Saúde Indígena",
        unidade: "DSEI A",
        edital: "1/2026",
        ativo: "não",
      },
      { grupo: "SEDE", unidade: "Sede", edital: "2/2026", ativo: false },
      { grupo: "SEDE", unidade: "Outra", edital: "2/2026", ativo: true },
    ];

    it("casa o edital: completo, unidade + edital, único ativo, único", () => {
      expect(
        editalDaLinha(
          { grupo: "saude indigena", unidade: "dsei a", edital: "1/2026" },
          editais,
        ).match,
      ).toBe("full");
      expect(
        editalDaLinha({ unidade: "Sede", edital: "2/2026" }, editais).match,
      ).toBe("unit_edital");
      expect(
        editalDaLinha({ unidade: "X", edital: "2/2026" }, editais).match,
      ).toBe("edital_ativo_unico");
      expect(
        editalDaLinha({ unidade: "X", edital: "1/2026" }, editais).match,
      ).toBe("edital_unico");
      expect(
        editalDaLinha({ unidade: "X", edital: "9/2026" }, editais),
      ).toBeNull();
    });

    it("sem data, no futuro, sem janela, fora e dentro do período", () => {
      const v = (extra) => validacaoDaJanela(extra, AGORA).status;
      expect(v({})).toBe("SEM_DATA");
      expect(v({ data_analise: "02/10/2026" })).toBe("DATA_FUTURA");
      expect(v({ data_analise: "01/10/2026" })).toBe("SEM_JANELA");
      expect(
        v({
          data_analise: "01/09/2026",
          data_inicio_analise: "2026-09-10",
          data_fim_analise: "2026-09-20",
        }),
      ).toBe("FORA_PERIODO");
      expect(
        v({
          data_analise: "15/09/2026",
          data_inicio_analise: "2026-09-10",
          data_fim_analise: "2026-09-20",
        }),
      ).toBe("DENTRO_PERIODO");
      expect(
        validacaoDaJanela({ data_analise: "02/10/2026" }, AGORA).fora,
      ).toBe(true);
    });

    it("prepara as linhas: janela do edital, validação, chave e índices (sem mudar a entrada)", () => {
      const entrada = [
        linha({
          unidade: "DSEI A",
          edital: "1/2026",
          data_analise: "15/09/2026",
          analise: "Parecer completo",
        }),
      ];
      const [pronta] = prontas(entrada, {
        editais: [
          {
            grupo: "Saúde Indígena",
            unidade: "DSEI A",
            edital: "1/2026",
            data_inicio_analise: "2026-09-10",
            data_fim_analise: "2026-09-20",
          },
        ],
      });
      expect(pronta.data_inicio_analise).toBe("2026-09-10");
      expect(pronta.data_validacao_status).toBe("DENTRO_PERIODO");
      expect(pronta.__chave).toBe("a1");
      expect(pronta.__busca).toContain("parecer completo");
      expect(pronta.municipio_uf).toBeUndefined();
      expect(entrada[0].data_validacao_status).toBeUndefined();
      expect(prontas([linha({ id: "" })])[0].__chave).toBe("linha-0");
    });

    it("fora da Saúde Indígena, o município/UF sai do nome da vaga", () => {
      const [pronta] = prepararLinhas(
        [linha({ nome_vaga: "Médico UBS móvel Seropédica/RJ 40h" })],
        { area: "projetos", agora: AGORA },
      );
      expect(pronta.municipio_uf).toBe("Seropédica/RJ");
      expect(temMunicipio([pronta], "projetos")).toBe(true);
      expect(temMunicipio([pronta], "saude-indigena")).toBe(false);
    });
  });

  describe("filtros", () => {
    const linhas = prontas([
      linha({
        id: "1",
        unidade: "DSEI A",
        edital: "2/2026",
        status_consolidado: "Aprovado",
        modalidade_concorrencia: "Ampla concorrência; Pretos e pardos",
      }),
      linha({
        id: "2",
        unidade: "DSEI B",
        edital: "10/2026",
        status_consolidado: "Pendente",
        candidato: "João",
      }),
      linha({
        id: "3",
        unidade: "DSEI A",
        edital: "10/2026",
        status_consolidado: "Revisar",
        data_analise: "02/10/2026",
      }),
    ]);
    const ids = (lista) => lista.map((l) => l.id);

    it("valores de um filtro somam (ou); filtros diferentes cortam (e); sem acento nem caixa", () => {
      expect(
        ids(filtrarLinhas(linhas, { ...FILTROS_VAZIOS, unidade: ["dsei a"] })),
      ).toEqual(["1", "3"]);
      expect(
        ids(
          filtrarLinhas(linhas, {
            ...FILTROS_VAZIOS,
            unidade: ["DSEI A"],
            edital: ["10/2026"],
          }),
        ),
      ).toEqual(["3"]);
      expect(
        ids(filtrarLinhas(linhas, { ...FILTROS_VAZIOS, busca: "joao" })),
      ).toEqual(["2"]);
      expect(
        ids(
          filtrarLinhas(linhas, {
            ...FILTROS_VAZIOS,
            modalidade: ["Pretos e pardos"],
          }),
        ),
      ).toEqual(["1"]);
      expect(
        ids(
          filtrarLinhas(linhas, {
            ...FILTROS_VAZIOS,
            validacao: ["DATA_FUTURA"],
          }),
        ),
      ).toEqual(["3"]);
    });

    it("opções em cascata: as de um filtro saem das linhas que passam nos outros", () => {
      const opcoes = opcoesDosFiltros(linhas, {
        ...FILTROS_VAZIOS,
        unidade: ["DSEI A"],
      });
      // A própria unidade não se corta.
      expect(opcoes.unidade.map((o) => o.value)).toEqual(["DSEI A", "DSEI B"]);
      // Os editais, sim — e em ordem numérica.
      expect(opcoes.edital.map((o) => o.value)).toEqual(["2/2026", "10/2026"]);
      expect(opcoes.status.map((o) => o.value)).toEqual([
        "Aprovado",
        "Revisar",
      ]);
      expect(
        opcoes.validacao.find((o) => o.value === "DATA_FUTURA").label,
      ).toBe("Data no futuro");
      expect(opcoes.modalidade.map((o) => o.value)).toEqual([
        "Ampla concorrência",
        "Pretos e pardos",
      ]);
    });

    it("a seleção fica só com o que existe depois de uma carga nova", () => {
      const filtros = { ...FILTROS_VAZIOS, unidade: ["dsei a", "DSEI Z"] };
      expect(apararSelecao(filtros, linhas).unidade).toEqual(["DSEI A"]);
      const sem = { ...FILTROS_VAZIOS };
      expect(apararSelecao(sem, linhas)).toBe(sem);
    });

    it("conta os filtros em uso (a busca conta um) e só os avançados", () => {
      const filtros = {
        ...FILTROS_VAZIOS,
        unidade: ["A"],
        categoria: ["B"],
        busca: " x ",
      };
      expect(quantosFiltros(filtros)).toBe(3);
      expect(quantosFiltros(filtros, { soAvancados: true })).toBe(2);
      expect(quantosFiltros(FILTROS_VAZIOS)).toBe(0);
    });
  });

  describe("KPIs, gráficos e pendências", () => {
    const linhas = prontas([
      linha({
        id: "1",
        status_consolidado: "Aprovado",
        responsavel_analise: "Carla",
        data_analise: "10/09/2026",
      }),
      linha({
        id: "2",
        status_consolidado: "Reprovado",
        responsavel_analise: "Carla",
        data_analise: "10/09/2026",
      }),
      linha({
        id: "3",
        status_consolidado: "Revisar",
        responsavel_analise: "Diego",
        data_analise: "02/10/2026",
      }),
      linha({
        id: "4",
        status_consolidado: "Pendente",
        responsavel_analise: SEM_RESPONSAVEL,
        responsavel_ausente: true,
        etapa: "Triagem",
      }),
      linha({
        id: "5",
        status_consolidado: "Outro",
        responsavel_analise: "Diego",
        data_analise: "09/09/2026",
        data_inicio_analise: "2026-09-10",
      }),
    ]);

    it("os KPIs e a taxa de conclusão", () => {
      expect(calcularKpis(linhas)).toEqual({
        total: 5,
        analisado: 3,
        pendente: 1,
        revisar: 1,
        aprovado: 1,
        reprovado: 1,
        taxa: 40,
      });
      expect(calcularKpis([]).taxa).toBe(0);
    });

    it("o recorte do KPI (status) e da barra do gráfico (responsável)", () => {
      expect(
        recorteVisual(linhas, { kpi: "analisado" }).map((l) => l.id),
      ).toEqual(["1", "2", "3"]);
      expect(
        recorteVisual(linhas, { responsavel: "Diego" }).map((l) => l.id),
      ).toEqual(["3", "5"]);
      expect(recorteVisual(linhas, {})).toHaveLength(5);
    });

    it("carga por responsável empilhada; status desconhecido conta como Pendente", () => {
      const carga = analisesPorResponsavel(linhas);
      expect(carga[0]).toEqual({
        rotulo: "Carla",
        Pendente: 0,
        Revisar: 0,
        Aprovado: 1,
        Reprovado: 1,
        total: 2,
      });
      expect(carga.find((c) => c.rotulo === "Diego")).toMatchObject({
        Revisar: 1,
        Pendente: 1,
      });
      expect(analisesPorResponsavel(linhas, 1)).toHaveLength(1);
    });

    it("tendência diária em ordem, com data no futuro, só das análises com decisão", () => {
      // A 5 ("Outro", conta como pendente) tem data, mas não é análise feita.
      expect(tendenciaDiaria(linhas)).toEqual([
        expect.objectContaining({ rotulo: "10/09/2026", valor: 2, fora: 0 }),
        expect.objectContaining({ rotulo: "02/10/2026", valor: 1, futuras: 1 }),
      ]);
    });

    it("pendente com data (planilha refeita) não entra no gráfico", () => {
      const dias = tendenciaDiaria(
        prontas([
          linha({
            id: "a",
            status_consolidado: "Pendente",
            data_analise: "06/10/2026",
          }),
          linha({
            id: "b",
            status_consolidado: "Pendente",
            data_analise: "06/10/2026",
          }),
          linha({
            id: "c",
            status_consolidado: "Aprovado",
            data_analise: "06/10/2026",
          }),
          linha({
            id: "d",
            status_consolidado: "",
            data_analise: "05/10/2026",
          }),
        ]),
      );
      expect(dias.map((d) => [d.rotulo, d.valor])).toEqual([["06/10/2026", 1]]);
    });

    it("pendências na ordem de gravidade, com o atalho de cada uma (inclui sem responsável)", () => {
      const pendencias = pendenciasPrioritarias(linhas);
      expect(pendencias.map((p) => [p.chave, p.tom, p.atalho])).toEqual([
        ["data-futura", "perigo", { tipo: "validacao", valor: "DATA_FUTURA" }],
        [
          "fora-do-periodo",
          "perigo",
          { tipo: "validacao", valor: "FORA_PERIODO" },
        ],
        [
          "sem-responsavel",
          "perigo",
          { tipo: "responsavel", valor: SEM_RESPONSAVEL },
        ],
        ["pendentes", "alerta", { tipo: "kpi", valor: "pendente" }],
        ["em-revisao", "alerta", { tipo: "kpi", valor: "revisar" }],
      ]);
      expect(pendencias[0].detalhe).toBe(
        "1 análise(s) com data depois de hoje. Corrija na planilha de origem.",
      );
      expect(pendenciasPrioritarias([])).toEqual([]);
    });

    it("Análise sem data conta o mesmo que o atalho mostra (realizadas e sem data)", () => {
      const base = prontas([
        // Pendente sem data é o normal, mesmo com a etapa preenchida.
        linha({ id: "p1", status_consolidado: "Pendente", etapa: "Triagem" }),
        linha({ id: "p2", status_consolidado: "Pendente" }),
        linha({ id: "a1", status_consolidado: "Aprovado", etapa: "Triagem" }),
        linha({ id: "r1", status_consolidado: "Revisar" }),
        linha({
          id: "a2",
          status_consolidado: "Aprovado",
          data_analise: "10/09/2026",
        }),
      ]);
      const pendencia = pendenciasPrioritarias(base).find(
        (p) => p.chave === "analise-sem-data",
      );
      expect(pendencia).toMatchObject({
        titulo: "Análise sem data",
        detalhe: "2 análise(s) realizada(s) sem data de análise.",
        atalho: { tipo: "validacao", valor: "SEM_DATA", kpi: "analisado" },
      });
      // O que a tabela mostra com o atalho: o KPI e a validação dele.
      const naTabela = recorteVisual(
        filtrarLinhas(base, {
          ...FILTROS_VAZIOS,
          validacao: [pendencia.atalho.valor],
        }),
        { kpi: pendencia.atalho.kpi },
      );
      expect(naTabela.map((l) => l.id)).toEqual(["a1", "r1"]);
    });
  });

  describe("recorte ativo", () => {
    it("a frase com situação, filtros, busca, KPI e responsável do gráfico", () => {
      expect(
        descricaoDoRecorte({
          escopo: "todos",
          filtros: {
            ...FILTROS_VAZIOS,
            unidade: ["A", "B"],
            validacao: ["FORA_PERIODO"],
            busca: "ana",
          },
          kpi: "pendente",
          responsavel: "Carla",
        }),
      ).toBe(
        "Recorte ativo: Situação do processo: Todos · Unidade: A, B · Validação da janela: Fora do período · Busca: ana · KPI: Pendentes · Responsável no gráfico: Carla",
      );
      expect(
        descricaoDoRecorte({ escopo: "ativo", filtros: FILTROS_VAZIOS }),
      ).toBe("Recorte ativo: Situação do processo: Ativo");
    });

    it("as marcas: janela única ou várias, fora do período e sem janela", () => {
      const uma = prontas([
        linha({
          data_inicio_analise: "2026-09-01",
          data_fim_analise: "2026-09-30",
          data_analise: "15/10/2025",
        }),
      ]);
      expect(marcasDoRecorte(uma).map((m) => [m.texto, m.tom])).toEqual([
        ["Janela oficial: 01/09/2026 a 30/09/2026", undefined],
        ["1 análise(s) fora do período", "alerta"],
      ]);
      const varias = prontas([
        linha({ data_inicio_analise: "2026-09-01" }),
        linha({ data_inicio_analise: "2026-08-01" }),
        linha({ data_analise: "01/09/2026" }),
      ]);
      expect(marcasDoRecorte(varias).map((m) => [m.texto, m.tom])).toEqual([
        ["2 janelas oficiais no recorte", undefined],
        ["0 análise(s) fora do período", "sucesso"],
        ["1 sem janela configurada", "alerta"],
      ]);
    });
  });

  describe("fila, status e atualização", () => {
    it("a busca da fila procura também a etapa", () => {
      const linhas = prontas([
        linha({ id: "1", etapa: "Triagem" }),
        linha({ id: "2" }),
      ]);
      expect(
        filtrarPelaBuscaDaFila(linhas, "triagem").map((l) => l.id),
      ).toEqual(["1"]);
      expect(filtrarPelaBuscaDaFila(linhas, "")).toBe(linhas);
    });

    it("tom do selo de status", () => {
      expect(tomDoStatus("Aprovado")).toBe("aprovado");
      expect(tomDoStatus("REPROVADO")).toBe("reprovado");
      expect(tomDoStatus("Em análise")).toBe("pendente");
      expect(tomDoStatus("x")).toBe("neutro");
    });

    it("Em análise (ficha aberta no Yeendé) conta como pendente", () => {
      const linhas = prontas([
        linha({ id: "1", status_consolidado: "Em análise" }),
        linha({ id: "2", status_consolidado: "Pendente" }),
        linha({ id: "3", status_consolidado: "Aprovado" }),
      ]);
      expect(calcularKpis(linhas)).toMatchObject({
        total: 3,
        pendente: 2,
        analisado: 1,
      });
      expect(
        recorteVisual(linhas, { kpi: "pendente" }).map((l) => l.id),
      ).toEqual(["1", "2"]);
      expect(
        pendenciasPrioritarias(linhas).find((p) => p.chave === "pendentes")
          ?.detalhe,
      ).toBe("2 registro(s) pendentes no recorte atual.");
    });

    it("a hora do dado mais novo: das linhas ou do envelope", () => {
      expect(
        ultimaAtualizacao([
          { updated_at: "2026-09-01T10:00:00Z" },
          { updated_at: "2026-09-03T10:00:00Z" },
        ]),
      ).toBe("2026-09-03T10:00:00Z");
      expect(
        ultimaAtualizacao([], { atualizado_em: "2026-09-30T08:00:00Z" }),
      ).toBe("2026-09-30T08:00:00Z");
      expect(ultimaAtualizacao([], null)).toBeNull();
    });
  });

  describe("detalhe da gaveta", () => {
    it("só link http(s) absoluto", () => {
      expect(urlSegura("https://drive.google.com/x")).toBe(
        "https://drive.google.com/x",
      );
      expect(urlSegura("javascript:alert(1)")).toBe("");
      expect(urlSegura("/relativo.pdf")).toBe("");
      expect(urlSegura("")).toBe("");
    });

    it("Saúde Indígena: critério étnico e experiências; pares vazios saem", () => {
      const [pronta] = prontas([
        linha({
          etapa: "Análise",
          data_analise: "15/09/2026",
          data_inicio_analise: "2026-09-10",
          nota_final_ajustada: 7.5,
          pontuacao_escolaridade: "3",
          pontuacao_criterio_etnico: "-",
          experiencia_saude_indigena_total: "2",
          origem_arquivo_id: "1AbcDefGhijKlm",
          link_pdf: "javascript:alert(1)",
        }),
      ]);
      const d = detalheDaAnalise(pronta, "saude-indigena");
      expect(d.titulo).toBe("Ana");
      expect(d.responsavel).toBe("Carla");
      expect(d.contexto.map(([r]) => r)).toEqual([
        "Grupo",
        "Unidade",
        "Edital",
        "Código da vaga",
        "Vaga",
      ]);
      expect(d.origem).toBe(urlDaPlanilhaGoogle("1AbcDefGhijKlm"));
      expect(d.pdf).toBe("");
      expect(d.secoes.map((s) => [s.chave, s.itens])).toEqual([
        [
          "status",
          [
            ["Etapa", "Análise"],
            ["Data da análise", "15/09/2026"],
            ["Validação", "Dentro do período configurado"],
            ["Janela oficial", "10/09/2026 a --"],
          ],
        ],
        [
          "result",
          [
            ["Nota final", "7.5"],
            ["Modalidade", "Ampla concorrência"],
          ],
        ],
        [
          "score",
          [
            ["Escolaridade", "3"],
            ["Exp. Saúde Indígena", "2"],
          ],
        ],
      ]);
    });

    it("SEDE e Projetos: tempo de experiência profissional e município", () => {
      const d = detalheDaAnalise(
        linha({
          municipio_uf: "Seropédica/RJ",
          experiencia_profissional_anos: 2,
          experiencia_profissional_meses: 3,
        }),
        "projetos",
      );
      expect(d.contexto.at(-1)).toEqual(["Município/UF", "Seropédica/RJ"]);
      expect(d.secoes.find((s) => s.chave === "score").itens).toEqual([
        ["Tempo de experiência profissional", "2 anos e 3 meses"],
      ]);
    });
  });

  describe("CSV", () => {
    it("colunas da Saúde Indígena; quebra, ; e aspas saem; fórmula ganha apóstrofo", () => {
      const csv = csvDasAnalises(
        [
          linha({
            candidato: '=HYPERLINK("x")',
            analise: "linha 1\nlinha 2; fim",
          }),
        ],
        "saude-indigena",
      );
      const [cabecalho, primeira] = csv.split("\n");
      expect(cabecalho.split(";")).toHaveLength(16);
      expect(cabecalho).not.toContain("municipio_uf");
      expect(primeira).toContain("'=HYPERLINK('x')");
      expect(primeira).toContain("linha 1 linha 2  fim");
    });

    it("fora da Saúde Indígena, as colunas de experiência e município", () => {
      const [cabecalho] = csvDasAnalises([], "sede").split("\n");
      expect(cabecalho).toContain(
        "experiencia_profissional_total;municipio_uf",
      );
    });
  });

  /* Histórias em docs/historias-de-usuario/analises-curriculares.md. */
  describe("AC-1/AC-2 — filtro por data da análise (regra)", () => {
    const linhas = [
      { id: "1", status_consolidado: "Aprovado", data_analise: "01/09/2026" },
      { id: "2", status_consolidado: "Aprovado", data_analise: "2026-09-15" },
      { id: "3", status_consolidado: "Reprovado", data_analise: "15/09/2026" },
      {
        id: "4",
        status_consolidado: "Revisar",
        data_analise: "2026-09-20T10:00:00",
      },
      { id: "5", data_analise: "" },
      { id: "6", data_analise: "data esquisita" },
    ];
    const ids = (lista) => lista.map((l) => l.id);

    it("AC-1.1 — o dia do gráfico tem a chave aaaa-mm-dd do mesmo campo, e o filtro recorta por ela", () => {
      expect(chaveDoDia("15/09/2026")).toBe("2026-09-15");
      expect(chaveDoDia("2026-09-15")).toBe("2026-09-15");
      expect(chaveDoDia("2026-09-20T10:00:00")).toBe("2026-09-20");
      expect(chaveDoDia("")).toBe("");
      expect(chaveDoDia("data esquisita")).toBe("");
      const dias = tendenciaDiaria(linhas.slice(0, 4));
      expect(dias.map((d) => [d.rotulo, d.chave, d.valor])).toEqual([
        ["01/09/2026", "2026-09-01", 1],
        ["15/09/2026", "2026-09-15", 2],
        ["20/09/2026", "2026-09-20", 1],
      ]);
      const periodo = periodoDoClique(PERIODO_VAZIO, "2026-09-15");
      expect(ids(filtrarPorPeriodo(linhas, periodo))).toEqual(["2", "3"]);
    });

    it("AC-1.2 — o rótulo do chip e a frase do recorte", () => {
      const dia = { inicio: "2026-09-15", fim: "2026-09-15" };
      expect(rotuloDoPeriodo(dia)).toBe("15/09/2026");
      expect(
        descricaoDoRecorte({
          escopo: "ativo",
          filtros: FILTROS_VAZIOS,
          periodo: dia,
        }),
      ).toBe("Recorte ativo: Situação do processo: Ativo · Data: 15/09/2026");
      expect(
        descricaoDoRecorte({ escopo: "ativo", filtros: FILTROS_VAZIOS }),
      ).toBe("Recorte ativo: Situação do processo: Ativo");
    });

    it("AC-1.3 — só o dia escolhido fica em destaque", () => {
      const dia = { inicio: "2026-09-15", fim: "2026-09-15" };
      expect(diaNoPeriodo("2026-09-15", dia)).toBe(true);
      expect(diaNoPeriodo("2026-09-16", dia)).toBe(false);
      expect(diaNoPeriodo("", dia)).toBe(false);
      expect(diaNoPeriodo("2026-09-16", PERIODO_VAZIO)).toBe(true);
    });

    it("AC-1.4/AC-1.5 — o mesmo dia de novo tira; outro dia troca", () => {
      const dia = periodoDoClique(PERIODO_VAZIO, "2026-09-15");
      expect(dia).toEqual({ inicio: "2026-09-15", fim: "2026-09-15" });
      expect(periodoDoClique(dia, "2026-09-15")).toEqual(PERIODO_VAZIO);
      expect(periodoDoClique(dia, "2026-09-01")).toEqual({
        inicio: "2026-09-01",
        fim: "2026-09-01",
      });
      expect(temPeriodo(PERIODO_VAZIO)).toBe(false);
      // Clique sem dia reconhecido não muda nada.
      expect(periodoDoClique(dia, "")).toEqual(dia);
    });

    it("AC-1.7 — com filtro de data, a análise sem data sai; sem filtro, nada sai", () => {
      expect(filtrarPorPeriodo(linhas, PERIODO_VAZIO)).toBe(linhas);
      expect(
        ids(
          filtrarPorPeriodo(linhas, {
            inicio: "2026-01-01",
            fim: "2026-12-31",
          }),
        ),
      ).toEqual(["1", "2", "3", "4"]);
    });

    it("AC-2.1 — Shift + clique estende do início até o dia, em qualquer ordem", () => {
      const dia = periodoDoClique(PERIODO_VAZIO, "2026-09-15");
      const intervalo = periodoDoClique(dia, "2026-09-01", { estender: true });
      expect(intervalo).toEqual({ inicio: "2026-09-01", fim: "2026-09-15" });
      expect(rotuloDoPeriodo(intervalo)).toBe("01/09/2026 a 15/09/2026");
      expect(ids(filtrarPorPeriodo(linhas, intervalo))).toEqual([
        "1",
        "2",
        "3",
      ]);
      // Sem período, Shift + clique escolhe só o dia.
      expect(
        periodoDoClique(PERIODO_VAZIO, "2026-09-01", { estender: true }),
      ).toEqual({ inicio: "2026-09-01", fim: "2026-09-01" });
    });

    it("AC-2.2 — só uma das pontas, pontas trocadas e chave inválida", () => {
      expect(rotuloDoPeriodo({ inicio: "2026-09-15", fim: "" })).toBe(
        "a partir de 15/09/2026",
      );
      expect(rotuloDoPeriodo({ inicio: "", fim: "2026-09-15" })).toBe(
        "até 15/09/2026",
      );
      expect(ids(filtrarPorPeriodo(linhas, { inicio: "2026-09-15" }))).toEqual([
        "2",
        "3",
        "4",
      ]);
      expect(
        normalizarPeriodo({ inicio: "2026-09-20", fim: "2026-09-01" }),
      ).toEqual({ inicio: "2026-09-01", fim: "2026-09-20" });
      expect(normalizarPeriodo({ inicio: "15/09/2026", fim: null })).toEqual(
        PERIODO_VAZIO,
      );
      expect(rotuloDoPeriodo(PERIODO_VAZIO)).toBe("");
    });
  });
});

bloco("analises-dados-invalidos", () => {
  describe("dados externos de Análises curriculares", () => {
    it.each([
      null,
      [],
      { columns: [10], rows: [[]] },
      { columns: ["__proto__"], rows: [[{}]] },
      { columns: ["constructor"], rows: [[{}]] },
      { columns: ["id"], rows: [{ id: "a1" }] },
    ])("rejeita um envelope inválido antes de decodificar: %j", (payload) => {
      expect(() => normalizarPayloadDasAnalises(payload)).toThrow(/inválido/);
    });

    it("mantém valores escalares e trata objetos e arrays como células vazias", () => {
      const [linha] = linhasDoPayload({
        columns: ["id", "candidato", "nota", "analise"],
        rows: [["a1", { nome: "Pessoa" }, 0, ["parecer"]]],
      });
      expect(linha).toMatchObject({
        id: "a1",
        candidato: null,
        nota: 0,
        analise: null,
      });
      expect(
        detalheDaAnalise({ candidato: { nome: "Pessoa" } }, "sede").titulo,
      ).toBe("Registro da análise");
    });

    it("uma resposta inesperada do porteiro deixa a decisão para a consulta da lista", async () => {
      const supabase = {
        rpc: vi.fn(async () => ({ data: { permitido: true }, error: null })),
      };
      expect(
        await criarConsultasDasAnalises({ supabase }).podeLer(),
      ).toBeNull();
    });

    it("não guarda uma resposta de lista com colunas inválidas", async () => {
      const armazenamento = {
        ler: vi.fn(async () => null),
        guardar: vi.fn(async () => {}),
        apagarTudo: vi.fn(async () => {}),
      };
      const supabase = {
        rpc: vi.fn(async () => ({
          data: { columns: [42], rows: [[]] },
          error: null,
        })),
      };
      const consultas = criarConsultasDasAnalises({
        supabase,
        armazenamento,
        versao: "teste",
      });
      await expect(
        consultas.carregarEscopo({
          area: "sede",
          escopo: "ativo",
          usuarioId: "u1",
        }),
      ).rejects.toThrow(/inválido/);
      expect(armazenamento.guardar).not.toHaveBeenCalled();
    });

    it("descarta uma cópia malformada e recupera a lista do servidor", async () => {
      const memoria = new Map();
      const armazenamento = {
        ler: async (chave) => memoria.get(chave) ?? null,
        guardar: async (chave, valor) => void memoria.set(chave, valor),
        apagarTudo: vi.fn(async () => memoria.clear()),
      };
      const pacote = (id) => ({
        schema_version: 4,
        columns: ["id"],
        rows: [[id]],
      });
      const supabase = {
        rpc: vi
          .fn()
          .mockResolvedValueOnce({ data: pacote("a1"), error: null })
          .mockResolvedValueOnce({ data: pacote("a2"), error: null }),
      };
      const consultas = criarConsultasDasAnalises({
        supabase,
        armazenamento,
        versao: "teste",
      });
      const opcoes = { area: "sede", escopo: "ativo", usuarioId: "u1" };
      await consultas.carregarEscopo(opcoes);
      await new Promise((resolve) => setTimeout(resolve, 0));
      const registro = [...memoria.values()].find((valor) => valor?.texto);
      expect(registro).toBeDefined();
      registro.texto = JSON.stringify({
        schema_version: 4,
        columns: [42],
        rows: [[]],
      });
      const resultado = await consultas.carregarEscopo(opcoes);
      expect(resultado.daCopia).toBe(false);
      expect(resultado.linhas[0].id).toBe("a2");
      expect(armazenamento.apagarTudo).toHaveBeenCalledOnce();
      expect(supabase.rpc).toHaveBeenCalledTimes(2);
    });
  });
});

bloco("anexos-do-recurso", () => {
  /*
  Anexos do recurso: o caminho que as políticas do Storage leem, a validação
  antes do envio e a coerência com o bucket e as políticas da migration
  (ensaiadas em produção, begin…rollback: editor envia, leitor e outra área
  não; ninguém lê sem registrar o download; ninguém sobrescreve nem apaga).
*/

  const RECURSO = "527c2b8c-7744-4a4b-bc06-108f6683297b";
  const ID = "0b8f5e0e-1c1d-4f55-9a55-2b7c3c9d2a10";
  const arquivo = (name, size, type = "") => ({ name, size, type });

  /* O que `storage.foldername(name)` devolve: as pastas, sem o arquivo. */
  const pastas = (caminho) => caminho.split("/").slice(0, -1);

  describe("caminho no bucket", () => {
    it("é <área>/<recurso>/<uuid>-<nome seguro>, com duas pastas", () => {
      const caminho = caminhoDoAnexo(
        "saude-indigena",
        RECURSO,
        ID,
        "Recurso Ana Ribeiro (final).pdf",
      );
      expect(caminho).toBe(
        `saude-indigena/${RECURSO}/${ID}-Recurso-Ana-Ribeiro-final.pdf`,
      );
      expect(pastas(caminho)).toEqual(["saude-indigena", RECURSO]);
    });

    it("nome sem acento, barra nem ponto-ponto; longo é cortado mantendo a extensão", () => {
      expect(nomeSeguroDoAnexo("Documentação/../x.PDF")).toBe(
        "Documentacao.-x.PDF",
      );
      expect(nomeSeguroDoAnexo("../../etc/passwd")).toBe("etc-passwd");
      expect(nomeSeguroDoAnexo("../../etc/passwd")).not.toContain("..");
      expect(nomeSeguroDoAnexo("../../etc/passwd")).not.toContain("/");
      expect(nomeSeguroDoAnexo("   ")).toBe("arquivo");
      const longo = nomeSeguroDoAnexo(`${"a".repeat(300)}.docx`);
      expect(longo.length).toBe(120);
      expect(longo.endsWith(".docx")).toBe(true);
    });

    it("o caminho nunca ganha pasta a mais, mesmo com barra no nome", () => {
      for (const nome of [
        "a/b/c.pdf",
        "..\\..\\x.pdf",
        "/abs.pdf",
        "a%2Fb.pdf",
      ])
        expect(pastas(caminhoDoAnexo("sede", RECURSO, ID, nome))).toEqual([
          "sede",
          RECURSO,
        ]);
    });

    it("recusa área ou ids fora do formato", () => {
      expect(() => caminhoDoAnexo("../sede", RECURSO, ID, "a.pdf")).toThrow();
      expect(() => caminhoDoAnexo("sede", "r1", ID, "a.pdf")).toThrow();
      expect(() => caminhoDoAnexo("sede", RECURSO, "x/y", "a.pdf")).toThrow();
    });
  });

  describe("validação do arquivo", () => {
    it("aceita os seis tipos, pela extensão (o navegador às vezes não diz o tipo)", () => {
      for (const nome of [
        "a.pdf",
        "a.docx",
        "a.doc",
        "a.jpg",
        "a.jpeg",
        "a.png",
        "a.odt",
      ])
        expect(
          validarArquivoDoAnexo(arquivo(nome, 10)).mime,
          nome,
        ).toBeTruthy();
      expect(validarArquivoDoAnexo(arquivo("a.odt", 10)).mime).toBe(
        "application/vnd.oasis.opendocument.text",
      );
    });

    it("recusa outro tipo, extensão que contradiz o tipo, vazio e acima de 20 MB", () => {
      expect(validarArquivoDoAnexo(arquivo("a.exe", 10)).erro).toMatch(
        /não aceito/,
      );
      expect(
        validarArquivoDoAnexo(arquivo("a.pdf", 10, "image/png")).erro,
      ).toMatch(/não aceito/);
      expect(
        tipoDoArquivo(arquivo("a.pdf", 10, "application/octet-stream")).mime,
      ).toBe("application/pdf");
      expect(validarArquivoDoAnexo(arquivo("a.pdf", 0)).erro).toMatch(/vazio/);
      expect(
        validarArquivoDoAnexo(arquivo("a.pdf", LIMITE_DO_ANEXO)).mime,
      ).toBe("application/pdf");
      expect(
        validarArquivoDoAnexo(arquivo("a.pdf", LIMITE_DO_ANEXO + 1)).erro,
      ).toMatch(/20 MB/);
      expect(validarArquivoDoAnexo(null).erro).toBe("Escolha o arquivo.");
    });

    it("seletor e tamanho legível", () => {
      expect(ACEITA_NO_SELETOR).toBe(".pdf,.docx,.doc,.jpg,.jpeg,.png,.odt");
      expect(tamanhoLegivel(512)).toBe("512 B");
      expect(tamanhoLegivel(2048)).toBe("2 KB");
      expect(tamanhoLegivel(5.5 * 1024 * 1024)).toBe("5,5 MB");
    });
  });
});

bloco("apps-script-analises-full", () => {
  /*
  Apps Script das análises: robustez do sync FULL, da URL do banco, do fuso, dos
  gatilhos e da FATO em PARTIAL (22/10/2026).

  - O FULL buscava "o sync pendente da planilha" sem olhar o modo e adotava um
    INCREMENTAL_ACTIVE parado; finalizar um incremental como FULL desativaria o
    resto da planilha. Agora o FULL recusa sync de outro modo e descarta o
    estado local órfão (sync que sumiu, terminou em erro ou é de outro modo).
  - URL do banco: SUPABASE_URL_FIXA no código (só o projeto atual) ou a
    propriedade SUPABASE_URL; sem nenhuma, erro claro (23/10/2026).
  - Datas formatadas em America/Sao_Paulo, não no fuso do projeto.
  - Gatilho só chama função pública (sem '_' no fim).
  - FATO em PARTIAL (promovida, com vagas em erro) não bloqueia o incremental.
  - Incremental já processado no banco conclui antes de comparar a planilha.

  Os .gs não têm módulo: rodam num contexto do node:vm com dublês mínimos.
*/
  const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
  const PLANILHAS = ["saude-indigena", "projetos", "sede"];
  const FULL = Object.fromEntries(
    PLANILHAS.map((p) => [
      p,
      ler(`apps-script/${p}/2-sincronizar-com-supabase-full.gs`),
    ]),
  );
  const INCREMENTAL = Object.fromEntries(
    PLANILHAS.map((p) => [
      p,
      ler(`apps-script/${p}/3-analises-incremental.gs`),
    ]),
  );
  const ORQUESTRADOR = Object.fromEntries(
    PLANILHAS.map((p) => [
      p,
      ler(`apps-script/${p}/4-orquestrador-fato-supabase.gs`),
    ]),
  );
  const BASE_PROJETOS = ler("apps-script/projetos/1-atualizar-base.gs");
  const ARQUIVOS = {
    "saude-indigena": [
      FULL["saude-indigena"],
      INCREMENTAL["saude-indigena"],
      ORQUESTRADOR["saude-indigena"],
    ],
    projetos: [
      BASE_PROJETOS,
      FULL.projetos,
      INCREMENTAL.projetos,
      ORQUESTRADOR.projetos,
    ],
    sede: [FULL.sede, INCREMENTAL.sede, ORQUESTRADOR.sede],
  };

  function contexto(codigo, extra = {}) {
    const props = new Map();
    const logs = [];
    const gatilhos = [];
    const ctx = vm.createContext({
      Logger: { log: (m) => logs.push(String(m)) },
      PropertiesService: {
        getScriptProperties: () => ({
          getProperty: (k) => (props.has(k) ? props.get(k) : null),
          setProperty: (k, v) => props.set(k, String(v)),
          setProperties: (o) =>
            Object.entries(o).forEach(([k, v]) => props.set(k, String(v))),
          deleteProperty: (k) => props.delete(k),
        }),
      },
      LockService: {
        getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }),
      },
      ScriptApp: {
        getProjectTriggers: () => [],
        deleteTrigger: () => {},
        newTrigger: (nome) => ({
          timeBased: () => ({
            after: () => ({ create: () => gatilhos.push(nome) }),
          }),
        }),
      },
      Utilities: {
        getUuid: (() => {
          let n = 0;
          return () => `novo-${++n}`;
        })(),
        sleep: () => {},
      },
      ...extra,
    });
    vm.runInContext(codigo, ctx);
    return { ctx, props, logs, gatilhos };
  }

  /* Banco falso do FULL: o log TL_SYNC_ANALISE e as RPCs que o cliente chama. */
  function bancoFalsoDoFull(syncs) {
    const chamadas = [];
    const resposta = (corpo, codigo = 200) => ({
      getResponseCode: () => codigo,
      getContentText: () => (corpo === undefined ? "" : JSON.stringify(corpo)),
      getAllHeaders: () => ({}),
    });
    const UrlFetchApp = {
      fetch(url, opcoes) {
        const caminho = url.replace(/^https:\/\/[^/]+/, "");
        chamadas.push({ caminho, metodo: opcoes.method });
        if (caminho.startsWith("/rest/v1/TL_SYNC_ANALISE")) {
          const id = decodeURIComponent(
            caminho.match(/sync_id=eq\.([^&]+)/)?.[1] || "",
          );
          if (id)
            return resposta(
              syncs.has(id) ? [{ sync_id: id, ...syncs.get(id) }] : [],
            );
          return resposta(
            [...syncs.entries()]
              .filter(([, s]) =>
                ["carregado", "processando"].includes(s.status),
              )
              .map(([sync_id, s]) => ({ sync_id, ...s })),
          );
        }
        throw new Error(`chamada inesperada: ${opcoes.method} ${caminho}`);
      },
    };
    return { UrlFetchApp, chamadas };
  }

  function full(planilha, syncs) {
    const banco = bancoFalsoDoFull(syncs);
    const c = contexto(FULL[planilha], { UrlFetchApp: banco.UrlFetchApp });
    c.props.set("SUPABASE_URL", "https://banco.exemplo");
    c.props.set("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_teste123");
    return { ...c, chamadas: banco.chamadas };
  }

  const ESTADO_FULL = "ANALISES_SYNC_LOTES_CLIENT_V1";

  describe("o FULL não adota sync INCREMENTAL_ACTIVE", () => {
    it.each(PLANILHAS)(
      "%s: incremental pendente na planilha: o FULL recusa, sem RPC e sem guardar estado",
      (p) => {
        const { ctx, props, chamadas } = full(
          p,
          new Map([
            [
              "inc-1",
              {
                status: "processando",
                modo: "INCREMENTAL_ACTIVE",
                resultado: {},
              },
            ],
          ]),
        );
        const r = ctx.retomarSyncAnalisesCurriculares();
        expect(r).toMatchObject({
          ok: false,
          pending: true,
          skipped: true,
          sync_id: "inc-1",
          modo: "INCREMENTAL_ACTIVE",
        });
        expect(r.motivo).toContain("O FULL não o adota");
        expect(props.has(ESTADO_FULL)).toBe(false);
        expect(chamadas.some((c) => c.caminho.includes("/rpc/"))).toBe(false);
      },
    );

    it.each(PLANILHAS)(
      "%s: estado local apontando para um incremental (adotado antes da correção) é descartado",
      (p) => {
        const { ctx, props, logs, chamadas } = full(
          p,
          new Map([
            [
              "inc-2",
              {
                status: "processando",
                modo: "INCREMENTAL_ACTIVE",
                resultado: {},
              },
            ],
          ]),
        );
        props.set(
          ESTADO_FULL,
          JSON.stringify({
            sync_id: "inc-2",
            modo: "INCREMENTAL_ACTIVE",
            phase: "PROCESSING",
          }),
        );
        const r = ctx.continuarSyncAnalisesCurriculares();
        expect(props.has(ESTADO_FULL)).toBe(false);
        expect(logs.join("\n")).toContain(
          "estado local do sync inc-2 (fase PROCESSING) descartado: O sync inc-2 é INCREMENTAL_ACTIVE",
        );
        // O incremental ainda pendente continua sendo recusado, não adotado.
        expect(r).toMatchObject({ ok: false, skipped: true, sync_id: "inc-2" });
        expect(chamadas.some((c) => c.caminho.includes("/rpc/"))).toBe(false);
      },
    );
  });

  describe("o FULL descarta estado local órfão (decidirEstadoLocalLotesAnalises_)", () => {
    const { ctx } = contexto(FULL.projetos);
    const decidir = (remoto) =>
      ctx.decidirEstadoLocalLotesAnalises_({ sync_id: "s1" }, remoto);

    it("log sumiu, erro (inclusive encerrado por inatividade) ou outro modo: descarta", () => {
      expect(decidir(null).acao).toBe("DESCARTAR");
      expect(decidir({ status: "erro", modo: "FULL" })).toEqual({
        acao: "DESCARTAR",
        motivo: "Status remoto não permite processamento: erro",
      });
      expect(
        decidir({ status: "carregado", modo: "INCREMENTAL_ACTIVE" }).acao,
      ).toBe("DESCARTAR");
    });

    it("carregado, processando ou processado em FULL: segue", () => {
      for (const status of ["carregado", "processando", "processado"])
        expect(decidir({ status, modo: "FULL" }).acao).toBe("SEGUIR");
    });

    it.each(PLANILHAS)(
      "%s: sync guardado em 'erro': descarta e, sem pendente, a retomada fica ociosa (antes: pendente para sempre)",
      (p) => {
        const {
          ctx: c,
          props,
          logs,
        } = full(
          p,
          new Map([["velho", { status: "erro", modo: "FULL", resultado: {} }]]),
        );
        props.set(
          ESTADO_FULL,
          JSON.stringify({
            sync_id: "velho",
            modo: "FULL",
            phase: "PROCESSING",
          }),
        );
        const r = c.retomarSyncAnalisesCurriculares();
        expect(r).toMatchObject({ ok: false, idle: true });
        expect(props.has(ESTADO_FULL)).toBe(false);
        expect(logs.join("\n")).toContain(
          "descartado: Status remoto não permite processamento: erro",
        );
      },
    );

    it.each(PLANILHAS)(
      "%s: sync guardado que não existe mais no banco também é descartado",
      (p) => {
        const { ctx: c, props } = full(p, new Map());
        props.set(
          ESTADO_FULL,
          JSON.stringify({
            sync_id: "sumiu",
            modo: "FULL",
            phase: "UPLOADING",
          }),
        );
        expect(c.retomarSyncAnalisesCurriculares()).toMatchObject({
          idle: true,
        });
        expect(props.has(ESTADO_FULL)).toBe(false);
      },
    );
  });

  const PROJETO_ATUAL = "https://tabmkiokfuxyqjuvfiha.supabase.co";
  const semUrlFixa = (codigo) =>
    codigo.replace(
      `SUPABASE_URL_FIXA: '${PROJETO_ATUAL}',`,
      "SUPABASE_URL_FIXA: '',",
    );

  describe("URL do banco: fixa no código ou propriedade SUPABASE_URL", () => {
    it("nenhum .gs aponta para outro projeto Supabase nem tem DEFAULT_SUPABASE_URL", () => {
      for (const p of PLANILHAS)
        for (const codigo of ARQUIVOS[p]) {
          expect(codigo).not.toMatch(/DEFAULT_SUPABASE_URL/);
          for (const url of codigo.match(
            /https:\/\/[a-z0-9]{20}\.supabase\.co/g,
          ) || [])
            expect(url).toBe(PROJETO_ATUAL);
        }
    });

    it.each(PLANILHAS)("%s: a URL fixa vale antes da propriedade", (p) => {
      expect(FULL[p]).toContain(`SUPABASE_URL_FIXA: '${PROJETO_ATUAL}',`);
      const { ctx, props } = contexto(FULL[p]);
      props.set("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_teste123");
      props.set("SUPABASE_URL", "https://outro.exemplo");
      expect(ctx.obterConfiguracaoSupabaseAnalises_()).toMatchObject({
        url: PROJETO_ATUAL,
      });
    });

    it.each(PLANILHAS)(
      "%s: sem URL fixa nem propriedade, erro claro antes de qualquer requisição",
      (p) => {
        const { ctx, props } = contexto(semUrlFixa(FULL[p]));
        props.set("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_teste123");
        expect(() => ctx.obterConfiguracaoSupabaseAnalises_()).toThrow(
          /Configure a propriedade do script SUPABASE_URL .*ou SUPABASE_URL_FIXA no codigo/,
        );
        props.set("SUPABASE_URL", "https://banco.exemplo/");
        expect(ctx.obterConfiguracaoSupabaseAnalises_()).toMatchObject({
          url: "https://banco.exemplo",
        });
      },
    );
  });

  describe("datas no fuso America/Sao_Paulo", () => {
    it("nenhum .gs usa o fuso do projeto", () => {
      for (const p of PLANILHAS)
        for (const codigo of ARQUIVOS[p])
          expect(codigo).not.toContain("getScriptTimeZone");
    });

    it("todo formatDate/parseDate usa a constante FUSO_HORARIO = 'America/Sao_Paulo'", () => {
      const comFuso = [...PLANILHAS.map((p) => FULL[p]), BASE_PROJETOS];
      for (const codigo of comFuso) {
        expect(codigo).toContain("FUSO_HORARIO: 'America/Sao_Paulo',");
        const usos = [
          ...codigo.matchAll(/Utilities\.(?:formatDate|parseDate)\(([^;]+)/g),
        ];
        expect(usos.length).toBeGreaterThan(0);
        for (const [, args] of usos) expect(args).toMatch(/CFG\.FUSO_HORARIO/);
      }
    });
  });

  describe("gatilhos apontam para funções públicas que existem", () => {
    /* Valor de uma constante (CFG.X, ANALISES_SYNC_CFG.X...) nos arquivos da planilha. */
    const valor = (arquivos, expr) => {
      const nome = expr.trim().split(".").pop();
      for (const codigo of arquivos) {
        const m = codigo.match(new RegExp(`\\n\\s+${nome}: '([^']+)'`));
        if (m) return m[1];
      }
      throw new Error(`constante ${expr} não encontrada`);
    };

    it.each(PLANILHAS)(
      "%s: cada ScriptApp.newTrigger(...) chama uma função sem '_' definida nos arquivos",
      (p) => {
        const arquivos = ARQUIVOS[p];
        const gatilhos = arquivos.flatMap((codigo) =>
          [...codigo.matchAll(/ScriptApp\.newTrigger\(([^)]+)\)/g)].map((m) =>
            m[1].startsWith("'") ? m[1].slice(1, -1) : valor(arquivos, m[1]),
          ),
        );
        expect(gatilhos.length).toBeGreaterThan(0);
        for (const nome of gatilhos) {
          expect(nome, `gatilho ${nome}`).not.toMatch(/_$/);
          expect(
            arquivos.some((c) => c.includes(`\nfunction ${nome}(`)),
            `função ${nome} não existe nos arquivos de ${p}`,
          ).toBe(true);
        }
      },
    );

    it("Atualizar base de Projetos: os três gatilhos de continuação são públicos", () => {
      expect(BASE_PROJETOS).toContain(
        "CONTINUATION_SYNC_TRIGGER_HANDLER: 'processarLoteSincronizacaoAnalises',",
      );
      expect(BASE_PROJETOS).toContain(
        "RECLASS_STATUS_TRIGGER_HANDLER: 'continuarRecalculoStatusFato',",
      );
      expect(BASE_PROJETOS).toContain(
        "REPAIR_SCORE_TRIGGER_HANDLER: 'continuarRecalculoNotasPontuacoesFato',",
      );
    });
  });

  describe("FATO em PARTIAL não bloqueia o incremental para sempre", () => {
    const { ctx } = contexto(ORQUESTRADOR.projetos);
    const avaliar = (meta) => ctx.avaliarFatoParaIncrementalOrq_(meta).acao;

    it("PARTIAL com a FATO promovida na mesma execução: segue", () => {
      expect(
        avaliar({
          last_run_status: "PARTIAL",
          last_run_finished_at: "2026-10-22 10:00:01",
          last_success_at: "2026-10-22 10:00:00",
          sources_error: "1",
        }),
      ).toBe("SEGUIR");
      expect(
        avaliar({
          last_run_status: "PARTIAL",
          last_run_finished_at: "22/10/2026 10:00:00",
          last_success_at: "22/10/2026 10:00:00",
        }),
      ).toBe("SEGUIR");
    });

    it("PARTIAL sem promoção confirmada (sucesso antigo ou vazio): bloqueia", () => {
      expect(
        avaliar({
          last_run_status: "PARTIAL",
          last_run_finished_at: "2026-10-22 10:00:00",
          last_success_at: "2026-10-21 08:00:00",
        }),
      ).toBe("BLOQUEAR");
      expect(
        avaliar({
          last_run_status: "PARTIAL",
          last_run_finished_at: "2026-10-22 10:00:00",
        }),
      ).toBe("BLOQUEAR");
    });

    it("SUCCESS/NO_CHANGES seguem; ERROR/BLOCKED bloqueiam; RUNNING aguarda", () => {
      expect(avaliar({ last_run_status: "SUCCESS" })).toBe("SEGUIR");
      expect(avaliar({ last_run_status: "no_changes" })).toBe("SEGUIR");
      expect(avaliar({ last_run_status: "ERROR" })).toBe("BLOQUEAR");
      expect(avaliar({ last_run_status: "BLOCKED" })).toBe("BLOQUEAR");
      expect(avaliar({ last_run_status: "RUNNING" })).toBe("AGUARDAR");
      expect(avaliar({})).toBe("AGUARDAR");
    });

    it("Atualizar base grava PARTIAL só com a FATO promovida e last_success_at junto", () => {
      expect(BASE_PROJETOS).toMatch(
        /last_run_status: blockedPromotion \? 'BLOCKED' : \(erroCount \? 'PARTIAL' : 'SUCCESS'\),\n\s+last_run_mode: syncMode,\n\s+last_run_finished_at: new Date\(\),\n\s+last_success_at: \(!blockedPromotion && promoted\) \? new Date\(\) : '',/,
      );
    });
  });

  describe("incremental já processado no banco conclui antes de comparar a planilha", () => {
    it.each(PLANILHAS)(
      "%s: planilha mudou depois do envio e o sync está 'processado': conclui e limpa (antes: travava)",
      (p) => {
        const chamadas = [];
        const UrlFetchApp = {
          fetch(url, opcoes) {
            const caminho = url.replace(/^https:\/\/[^/]+/, "");
            chamadas.push(caminho);
            const corpo = (c) => ({
              getResponseCode: () => 200,
              getContentText: () => JSON.stringify(c),
            });
            if (caminho.startsWith("/rest/v1/TL_SYNC_ANALISE"))
              return corpo([
                { sync_id: "s-ok", status: "processado", resultado: {} },
              ]);
            if (caminho.endsWith("/rpc/verificar_sync_analises_incremental"))
              return corpo({ ok: true });
            throw new Error(`chamada inesperada: ${caminho}`);
          },
        };
        const linha = (p) => ({ linha_origem: 2, payload: p });
        const { ctx, props } = contexto(INCREMENTAL[p], {
          UrlFetchApp,
          obterConfiguracaoSupabaseAnalises_: () => ({
            url: "https://banco.exemplo",
            key: "k",
            jwt: false,
          }),
          readSheetObjectsForAnalises_: (_aba, nome) => ({
            rows:
              nome === "DIM_EDITAIS"
                ? [
                    linha({
                      grupo: "G",
                      unidade: "U",
                      edital: "1",
                      ativo: "SIM",
                    }),
                  ]
                : [linha({ grupo: "G", unidade: "U", edital: "1", id: 9 })],
          }),
          buildHashPayloadAnalises_: (x) => x,
          hashTextAnalises_: (t) => `h${t.length}`,
          SpreadsheetApp: {
            getActiveSpreadsheet: () => ({ getSheetByName: (n) => ({ n }) }),
          },
        });
        const agora = new Date().toISOString();
        props.set(
          "ANALISES_SYNC_INCREMENTAL_CLIENT_V1",
          JSON.stringify({
            sync_id: "s-ok",
            phase: "CONFIRMING",
            prepared: true,
            remote_started: true,
            snapshot_hash: "hash-de-antes",
            total_ativos_local: 1,
            created_at: agora,
            progress_at: agora,
          }),
        );
        const r = ctx.retomarSyncAnalisesCurricularesIncremental();
        expect(r).toMatchObject({
          ok: true,
          sync_id: "s-ok",
          status: "processado",
        });
        expect(props.has("ANALISES_SYNC_INCREMENTAL_CLIENT_V1")).toBe(false);
        // O hash guardado é o do envio: com a planilha mudada, o próximo ciclo envia.
        expect(
          JSON.parse(props.get("ANALISES_SYNC_INCREMENTAL_ULTIMO_V1")).hash,
        ).toBe("hash-de-antes");
      },
    );
  });

  describe("as três cópias seguem iguais onde devem", () => {
    const semOrigens = (texto) =>
      texto
        .split("\n")
        .filter(
          (l) =>
            !/^ \* PLANILHA /.test(l) && !/^\s+ORIGE(M|NS_PLANILHA): /.test(l),
        )
        .join("\n");

    it("2-sincronizar FULL: SEDE igual a Projetos, menos cabeçalho e origens", () => {
      expect(semOrigens(FULL.sede)).toBe(semOrigens(FULL.projetos));
    });

    it("2-sincronizar FULL: as funções desta correção são as mesmas na Saúde Indígena", () => {
      const funcao = (texto, nome) => {
        const i = texto.indexOf(`\nfunction ${nome}(`);
        expect(i, nome).toBeGreaterThan(-1);
        return texto.slice(i, texto.indexOf("\n}\n", i));
      };
      for (const nome of [
        "executarSyncAnalisesCurriculares_",
        "decidirEstadoLocalLotesAnalises_",
        "descartarEstadoLotesAnalises_",
        "mensagemSemUrlSupabaseAnalises_",
        "obterConfiguracaoSupabaseAnalises_",
        "configurarSupabaseAnalisesCurriculares",
        "verificarConfiguracaoSupabaseAnalisesCurriculares",
        "toIsoDateAnalises_",
        "toIsoTimestampAnalises_",
        "coerceDateAnalises_",
      ])
        expect(funcao(FULL["saude-indigena"], nome)).toBe(
          funcao(FULL.projetos, nome),
        );
    });
  });
});

bloco("apps-script-analises-incremental", () => {
  /*
  Apps Script das análises (apps-script/<planilha>/3-analises-incremental.gs e
  4-orquestrador-fato-supabase.gs): o sync incremental não fica preso.

  Incidente de 06–07/10/2026: o sync guardado na propriedade
  ANALISES_SYNC_INCREMENTAL_CLIENT_V1 ficou em 'erro' no banco e o cliente
  repetia "Status remoto nao permite retomada: erro" a cada gatilho, até alguém
  apagar a propriedade à mão. Os .gs não têm módulo: o arquivo roda num
  contexto do node:vm com dublês mínimos do Apps Script (PropertiesService,
  UrlFetchApp…) e dos auxiliares do sync FULL, que ficam em outro arquivo.
*/
  const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
  const PLANILHAS = ["saude-indigena", "projetos", "sede"];
  const INCREMENTAL = Object.fromEntries(
    PLANILHAS.map((p) => [
      p,
      ler(`apps-script/${p}/3-analises-incremental.gs`),
    ]),
  );
  const ORQUESTRADOR = Object.fromEntries(
    PLANILHAS.map((p) => [
      p,
      ler(`apps-script/${p}/4-orquestrador-fato-supabase.gs`),
    ]),
  );
  const MIN = 60 * 1000;

  function contexto(codigo, extra = {}) {
    const props = new Map();
    const logs = [];
    const ctx = vm.createContext({
      Logger: { log: (m) => logs.push(String(m)) },
      PropertiesService: {
        getScriptProperties: () => ({
          getProperty: (k) => (props.has(k) ? props.get(k) : null),
          setProperty: (k, v) => props.set(k, String(v)),
          deleteProperty: (k) => props.delete(k),
        }),
      },
      LockService: {
        getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }),
      },
      ScriptApp: {
        getProjectTriggers: () => [],
        deleteTrigger: () => {},
        newTrigger: () => ({
          timeBased: () => ({ after: () => ({ create: () => {} }) }),
        }),
      },
      Utilities: {
        getUuid: (() => {
          let n = 0;
          return () => `novo-${++n}`;
        })(),
        sleep: () => {},
      },
      ...extra,
    });
    vm.runInContext(codigo, ctx);
    return { ctx, props, logs };
  }

  /* O que muda entre as planilhas: o cabeçalho e as origens. */
  const semOrigens = (texto) =>
    texto
      .split("\n")
      .filter(
        (l) =>
          !/^ \* (PLANILHA |Sincronizacao incremental|Mesmo codigo)/.test(l) &&
          !/^\s+ORIGE(M|NS_PLANILHA): /.test(l),
      )
      .join("\n");

  describe("as três planilhas têm o mesmo incremental e o mesmo orquestrador", () => {
    it("3-analises-incremental.gs só muda no cabeçalho e nas origens", () => {
      expect(semOrigens(INCREMENTAL.projetos)).toBe(
        semOrigens(INCREMENTAL["saude-indigena"]),
      );
      expect(semOrigens(INCREMENTAL.sede)).toBe(
        semOrigens(INCREMENTAL["saude-indigena"]),
      );
    });

    it("4-orquestrador: SEDE igual a Projetos; a SI sem a processarLoteSincronizacaoAnalises pública", () => {
      const corpo = (t) => t.slice(t.indexOf("const FATO_SUPABASE_ORQ_CFG"));
      expect(corpo(ORQUESTRADOR.sede)).toBe(corpo(ORQUESTRADOR.projetos));
      expect(ORQUESTRADOR["saude-indigena"]).not.toMatch(
        /function processarLoteSincronizacaoAnalises\(/,
      );
      expect(
        corpo(ORQUESTRADOR.projetos).replace(
          /\/\*\*\n \* Handler PUBLICO[\s\S]*?\n}\n\n/,
          "",
        ),
      ).toBe(corpo(ORQUESTRADOR["saude-indigena"]));
    });

    it("os nomes que os acionadores chamam continuam existindo", () => {
      for (const p of PLANILHAS) {
        for (const nome of [
          "syncAnalisesCurricularesIncremental",
          "retomarSyncAnalisesCurricularesIncremental",
          "continuarSyncAnalisesCurricularesIncremental",
          "limparEstadoLocalAnalisesIncremental",
        ])
          expect(INCREMENTAL[p]).toContain(`function ${nome}(`);
        expect(ORQUESTRADOR[p]).toContain(
          "function orquestrarFatoESupabaseAgendado(",
        );
      }
    });
  });

  describe("retomar ou descartar o sync guardado (decidirRetomadaAnalisesIncremental_)", () => {
    const { ctx } = contexto(INCREMENTAL["saude-indigena"]);
    const decidir = (estado, remoto, agora) =>
      ctx.decidirRetomadaAnalisesIncremental_(estado, remoto, agora);
    const AGORA = Date.parse("2026-10-07T12:00:00Z");
    const ha = (min) => new Date(AGORA - min * MIN).toISOString();
    const estado = (extra = {}) => ({
      sync_id: "s1",
      phase: "COMPARING",
      remote_started: true,
      created_at: ha(120),
      progress_at: ha(2),
      ...extra,
    });

    it("o incidente: status 'erro' no banco descarta (antes travava)", () => {
      expect(decidir(estado(), { status: "erro" }, AGORA)).toEqual({
        acao: "DESCARTAR",
        motivo: "Status remoto nao permite retomada: erro",
      });
    });

    it("sync que sumiu do banco depois de iniciado também descarta", () => {
      expect(decidir(estado(), null, AGORA).acao).toBe("DESCARTAR");
    });

    it("ainda não iniciado no banco: inicia com o mesmo sync_id", () => {
      expect(decidir(estado({ remote_started: false }), null, AGORA).acao).toBe(
        "INICIAR",
      );
    });

    it("carregado/processando com progresso recente: retoma", () => {
      expect(decidir(estado(), { status: "carregado" }, AGORA).acao).toBe(
        "RETOMAR",
      );
      expect(
        decidir(
          estado({ progress_at: ha(29) }),
          { status: "processando" },
          AGORA,
        ).acao,
      ).toBe("RETOMAR");
    });

    it("processado: retoma para concluir, mesmo sem progresso recente", () => {
      expect(
        decidir(
          estado({ progress_at: ha(300) }),
          { status: "processado" },
          AGORA,
        ).acao,
      ).toBe("RETOMAR");
    });

    it("mais de 30 min sem progresso local descarta, mesmo com o banco aceitando", () => {
      const r = decidir(
        estado({ progress_at: ha(31) }),
        { status: "carregado" },
        AGORA,
      );
      expect(r.acao).toBe("DESCARTAR");
      expect(r.motivo).toContain("Sem progresso local ha mais de 30 min");
    });

    it("estado antigo, sem progress_at, usa created_at (a propriedade do incidente)", () => {
      const antigo = estado({ created_at: ha(16 * 60) });
      delete antigo.progress_at;
      expect(decidir(antigo, { status: "carregado" }, AGORA).acao).toBe(
        "DESCARTAR",
      );
    });

    it("pendente remoto sem estado local: parado só depois de 30 min sem sinal no log", () => {
      const parado = (remoto) =>
        ctx.pendenteRemotoParadoAnalisesIncremental_(remoto, AGORA);
      expect(parado({ updated_at: ha(31), created_at: ha(60) })).toBe(true);
      expect(parado({ updated_at: ha(5), created_at: ha(60) })).toBe(false);
      expect(parado(null)).toBe(false);
    });
  });

  /* Banco falso: o que o cliente consulta e chama pelo REST. */
  function bancoFalso(syncs) {
    const chamadas = [];
    const resposta = (corpo, codigo = 200) => ({
      getResponseCode: () => codigo,
      getContentText: () => (corpo === undefined ? "" : JSON.stringify(corpo)),
    });
    const UrlFetchApp = {
      fetch(url, opcoes) {
        const caminho = url.replace("https://banco", "");
        const corpo = opcoes.payload ? JSON.parse(opcoes.payload) : undefined;
        chamadas.push({ caminho, metodo: opcoes.method, corpo });
        const rpc = caminho.match(/^\/rest\/v1\/rpc\/(\w+)/)?.[1];
        if (caminho.startsWith("/rest/v1/TL_SYNC_ANALISE")) {
          const id = decodeURIComponent(
            caminho.match(/sync_id=eq\.([^&]+)/)?.[1] || "",
          );
          if (!id) return resposta([]); // nenhum pendente da planilha
          return resposta(
            syncs.has(id) ? [{ sync_id: id, ...syncs.get(id) }] : [],
          );
        }
        if (caminho.startsWith("/rest/v1/TM_ANALISE_CURRICULAR"))
          return resposta(undefined, 201);
        if (rpc === "iniciar_sync_analises_incremental") {
          syncs.set(corpo.p_sync_id, { status: "carregado", resultado: {} });
          return resposta({
            ok: true,
            sync_id: corpo.p_sync_id,
            status: "carregado",
          });
        }
        if (rpc === "comparar_analises_incremental_v2")
          return resposta({ ok: true, linhas_alteradas: [2] });
        if (rpc === "preparar_sync_analises_incremental")
          return resposta({ ok: true, sync_id: corpo.p_sync_id });
        if (rpc === "processar_sync_analises_incremental_lote")
          return resposta({
            ok: true,
            sync_id: corpo.p_sync_id,
            concluido_fato: true,
            cursor: 1,
          });
        if (rpc === "finalizar_sync_analises_incremental") {
          syncs.set(corpo.p_sync_id, { status: "processado", resultado: {} });
          return resposta({ ok: true, sync_id: corpo.p_sync_id });
        }
        if (rpc === "verificar_sync_analises_incremental")
          return resposta({ ok: true });
        throw new Error(`chamada inesperada: ${caminho}`);
      },
    };
    return { UrlFetchApp, chamadas };
  }

  /* Auxiliares do sync FULL (2-sincronizar-com-supabase-full.gs) e a planilha. */
  const AUXILIARES_DO_FULL = {
    obterConfiguracaoSupabaseAnalises_: () => ({
      url: "https://banco",
      key: "k",
      jwt: false,
    }),
    readSheetObjectsForAnalises_: (_aba, nome) => ({
      rows:
        nome === "DIM_EDITAIS"
          ? [
              {
                linha_origem: 2,
                payload: {
                  grupo: "Saúde Indígena",
                  unidade: "DSEI",
                  edital: "1/2026",
                  ativo: "SIM",
                },
              },
            ]
          : [
              {
                linha_origem: 2,
                payload: {
                  grupo: "Saúde Indígena",
                  unidade: "DSEI",
                  edital: "1/2026",
                  id: 7,
                  candidato: "Fulano",
                },
              },
            ],
    }),
    buildHashPayloadAnalises_: (p) => p,
    hashTextAnalises_: (t) => `h${t.length}`,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({ getSheetByName: (n) => ({ nome: n }) }),
    },
  };

  describe("o incidente de 06/10, ponta a ponta no cliente", () => {
    it("sync guardado em 'erro': descarta, começa outro e conclui na mesma execução", () => {
      const syncs = new Map([["51a31446-velho", { status: "erro" }]]);
      const { UrlFetchApp, chamadas } = bancoFalso(syncs);
      const { ctx, props, logs } = contexto(INCREMENTAL["saude-indigena"], {
        UrlFetchApp,
        ...AUXILIARES_DO_FULL,
      });
      props.set(
        "ANALISES_SYNC_INCREMENTAL_CLIENT_V1",
        JSON.stringify({
          sync_id: "51a31446-velho",
          phase: "COMPARING",
          remote_started: true,
          compare_index: 0,
          created_at: "2026-10-06T19:36:55Z",
        }),
      );

      // O orquestrador chama a retomada (resumeOnly): antes, devolvia pending para sempre.
      const r = ctx.retomarSyncAnalisesCurricularesIncremental();

      expect(r).toMatchObject({
        ok: true,
        sync_id: "novo-1",
        status: "processado",
      });
      expect(props.has("ANALISES_SYNC_INCREMENTAL_CLIENT_V1")).toBe(false);
      expect(logs.join("\n")).toContain(
        "estado local do sync 51a31446-velho (fase COMPARING) descartado: Status remoto nao permite retomada: erro",
      );
      const iniciar = chamadas.find((c) =>
        c.caminho.endsWith("/rpc/iniciar_sync_analises_incremental"),
      );
      expect(iniciar.corpo).toEqual({
        p_sync_id: "novo-1",
        p_origem: "apps_script_analises_incremental_v1",
      });
      // Nada do sync velho foi chamado nem apagado no banco.
      expect(
        chamadas.some(
          (c) =>
            c.metodo !== "GET" && JSON.stringify(c).includes("51a31446-velho"),
        ),
      ).toBe(false);
    });

    it("sync guardado ainda ativo e com progresso: segue o mesmo, sem descartar", () => {
      const syncs = new Map([
        ["s-ativo", { status: "carregado", resultado: {} }],
      ]);
      const { UrlFetchApp, chamadas } = bancoFalso(syncs);
      const { ctx, props } = contexto(INCREMENTAL.projetos, {
        UrlFetchApp,
        ...AUXILIARES_DO_FULL,
      });
      const agora = new Date().toISOString();
      props.set(
        "ANALISES_SYNC_INCREMENTAL_CLIENT_V1",
        JSON.stringify({
          sync_id: "s-ativo",
          phase: "COMPARING",
          remote_started: true,
          compare_index: 0,
          created_at: agora,
          progress_at: agora,
        }),
      );
      const r = ctx.continuarSyncAnalisesCurricularesIncremental();
      expect(r).toMatchObject({ ok: true, sync_id: "s-ativo" });
      expect(
        chamadas.some((c) =>
          c.caminho.endsWith("/rpc/iniciar_sync_analises_incremental"),
        ),
      ).toBe(false);
    });
  });

  describe("orquestrador: não espera retomada impossível", () => {
    const orquestrador = (incremental) =>
      contexto(ORQUESTRADOR.projetos, {
        consultarSyncAnalisesIncremental_: () => ({ status: "erro" }),
        retomarSyncAnalisesCurricularesIncremental: () => ({
          ok: false,
          idle: true,
        }),
        syncAnalisesCurricularesIncremental: incremental,
        limparContinuacoesAnalisesIncremental_: () => {},
      });

    it("sync do ciclo em 'erro' e sem estado local: começa um novo na hora", () => {
      let chamou = 0;
      const { ctx } = orquestrador(() => {
        chamou += 1;
        return { ok: true, status: "processado", sync_id: "novo" };
      });
      const r = ctx.acompanharIncrementalFatoSupabase_({
        cycle_id: "c1",
        phase: "WAIT_INCREMENTAL",
        supabase_sync_id: "velho",
      });
      expect(chamou).toBe(1);
      expect(r).toMatchObject({
        ok: true,
        sync_id: "novo",
        supabase_status: "processado",
      });
    });

    it("FATO que já gastou mais de 20 min: o incremental fica para a próxima verificação", () => {
      let chamou = 0;
      const { ctx } = orquestrador(() => {
        chamou += 1;
        return { ok: true, status: "processado" };
      });
      vm.runInContext(
        "INICIO_EXECUCAO_ORQ_MS_ = Date.now() - 25 * 60 * 1000;",
        ctx,
      );
      const r = ctx.iniciarOuRetomarIncrementalFatoSupabase_(
        { cycle_id: "c2", phase: "WAIT_INCREMENTAL" },
        false,
      );
      expect(chamou).toBe(0);
      expect(r).toMatchObject({ pending: true, phase: "WAIT_INCREMENTAL" });
      expect(r.motivo).toContain("o incremental comeca na proxima verificacao");
    });
  });

  describe("leitura lenta da planilha não trava o sync (07/10/2026)", () => {
    it.each(PLANILHAS)(
      "%s: depois de ler a planilha sobra prazo e o primeiro lote sempre sai",
      (p) => {
        const s = INCREMENTAL[p];
        expect(s).toMatch(/MIN_WORK_MS: 4 \* 60 \* 1000/);
        expect(s).toMatch(
          /const snapshot = snapshotPrevio \|\| montarSnapshotAnalisesIncremental_\(\); \/\/ \[sem-mudanca\]\n\s+deadline = Math\.max\(deadline, Date\.now\(\) \+ ANALISES_INCREMENTAL_CFG\.MIN_WORK_MS\)/,
        );
        expect(s).toMatch(
          /if \(lotesNestaExecucao > 0 && Date\.now\(\) >= deadline/,
        );
        expect(s).toMatch(
          /while \(lotesProcessados === 0 \|\| Date\.now\(\) < deadline/,
        );
      },
    );
    it.each(PLANILHAS)(
      "%s: o orquestrador deixa o incremental para depois com 15 min de FATO",
      (p) => {
        expect(ORQUESTRADOR[p]).toMatch(
          /MAX_ELAPSED_BEFORE_INCREMENTAL_MS: 15 \* 60 \* 1000/,
        );
      },
    );
  });

  describe("planilha igual ao último envio: nenhuma chamada ao banco (14/10/2026)", () => {
    const AGORA = Date.parse("2026-10-14T12:00:00Z");
    const H = 60 * MIN;

    it("pularSemMudancaAnalisesIncremental_: só com o mesmo hash e há menos de 6 h", () => {
      const { ctx } = contexto(INCREMENTAL["saude-indigena"]);
      const pular = (ultimo, hash) =>
        ctx.pularSemMudancaAnalisesIncremental_(ultimo, hash, AGORA);
      const em = (horas) => new Date(AGORA - horas * H).toISOString();
      expect(pular({ hash: "h1", em: em(1) }, "h1")).toBe(true);
      expect(pular({ hash: "h1", em: em(1) }, "h2")).toBe(false);
      expect(pular({ hash: "h1", em: em(6.1) }, "h1")).toBe(false);
      expect(pular({ hash: "h1", em: "lixo" }, "h1")).toBe(false);
      expect(pular(null, "h1")).toBe(false);
    });

    it.each(PLANILHAS)(
      "%s: depois de um envio confirmado, o próximo com a planilha igual não chama o banco",
      (p) => {
        const { UrlFetchApp, chamadas } = bancoFalso(new Map());
        const { ctx, props } = contexto(INCREMENTAL[p], {
          UrlFetchApp,
          ...AUXILIARES_DO_FULL,
        });
        const primeiro = ctx.syncAnalisesCurricularesIncremental();
        expect(primeiro).toMatchObject({ ok: true, status: "processado" });
        expect(props.has("ANALISES_SYNC_INCREMENTAL_ULTIMO_V1")).toBe(true);

        const antes = chamadas.length;
        const segundo = ctx.syncAnalisesCurricularesIncremental();
        expect(segundo).toMatchObject({
          ok: true,
          status: "processado",
          sem_mudanca: true,
          sync_id: null,
        });
        expect(chamadas.length).toBe(antes);

        // Limpar o estado local à mão força o próximo envio.
        ctx.limparEstadoLocalAnalisesIncremental("LIMPAR_ESTADO_LOCAL");
        expect(
          ctx.syncAnalisesCurricularesIncremental().sem_mudanca,
        ).toBeUndefined();
        expect(chamadas.length).toBeGreaterThan(antes);
      },
    );

    it.each(PLANILHAS)(
      "%s: o orquestrador conclui o ciclo com o incremental 'processado' sem sync_id",
      (p) => {
        expect(ORQUESTRADOR[p]).toMatch(
          /result && result\.ok === true && result\.status === 'processado'/,
        );
      },
    );
  });
});

bloco("area-do-painel-de-analises", () => {
  /*
  Saúde Indígena, SEDE e Projetos usam a MESMA tela de análises (a área do
  app): sem área (ou com lixo), é a da Saúde Indígena.
*/
  describe("a área do painel", () => {
    it("sem área ou com código desconhecido, é a Saúde Indígena", () => {
      expect(AREA_PADRAO_DO_PAINEL).toBe("saude-indigena");
      expect(rotuloDaAreaDoPainel("")).toBe("Saúde Indígena");
      expect(rotuloDaAreaDoPainel("<script>")).toBe("Saúde Indígena");
    });

    it("rótulo de cada área", () => {
      expect(rotuloDaAreaDoPainel("projetos")).toBe("Projetos");
      expect(rotuloDaAreaDoPainel("xyz")).toBe("Saúde Indígena");
      expect(ehAreaSaudeIndigena("saude-indigena")).toBe(true);
      expect(ehAreaSaudeIndigena("projetos")).toBe(false);
    });

    it("parâmetro das RPCs", () => {
      expect(parametroDeAreaDaRpc("sede")).toEqual({ p_area: "sede" });
      expect(parametroDeAreaDaRpc("qualquer")).toEqual({
        p_area: "saude-indigena",
      });
    });
  });

  describe("cache por área", () => {
    it("a cópia do navegador separa as áreas e os escopos", () => {
      expect(chaveDoCacheDoPayload("projetos", "ativo")).toBe("projetos:ativo");
      expect(chaveDoCacheDoPayload("saude-indigena", "Todos")).toBe(
        "saude-indigena:todos",
      );
      expect(chaveDoCacheDoPayload("sede", "ativo")).not.toBe(
        chaveDoCacheDoPayload("saude-indigena", "ativo"),
      );
    });
  });

  describe("experiência profissional (SEDE e Projetos)", () => {
    it("anos, meses e dias quando a planilha traz as partes", () => {
      expect(
        experienciaProfissionalDaLinha({
          experiencia_profissional_anos: 8,
          experiencia_profissional_meses: 2,
          experiencia_profissional_dias: 15,
          experiencia_profissional_total: 2995,
        }),
      ).toBe("8 anos, 2 meses e 15 dias");
      expect(
        experienciaProfissionalDaLinha({
          experiencia_profissional_anos: 1,
          experiencia_profissional_meses: 0,
          experiencia_profissional_dias: 1,
        }),
      ).toBe("1 ano e 1 dia");
      expect(
        experienciaProfissionalDaLinha({
          experiencia_profissional_anos: 0,
          experiencia_profissional_meses: 1,
          experiencia_profissional_dias: 0,
        }),
      ).toBe("1 mês");
      expect(
        experienciaProfissionalDaLinha({
          experiencia_profissional_anos: 0,
          experiencia_profissional_meses: 0,
          experiencia_profissional_dias: 0,
        }),
      ).toBe("0 dias");
    });

    it("só o total (em dias), ou nada", () => {
      expect(
        experienciaProfissionalDaLinha({
          experiencia_profissional_total: "2943",
        }),
      ).toBe("2.943 dias");
      expect(experienciaProfissionalDaLinha({})).toBe("-");
      expect(experienciaProfissionalDaLinha(null)).toBe("-");
    });
  });

  describe("CSV e tabela vazia por área", () => {
    const colunas = ["grupo", "unidade", "analise"];

    it("a Saúde Indígena exporta as colunas de sempre", () => {
      expect(colunasDoCsvDeAnalises(colunas, "saude-indigena")).toEqual(
        colunas,
      );
      expect(nomeDoCsvDeAnalises("saude-indigena")).toBe(
        "agsus_analises_curriculares_v3.csv",
      );
    });

    it("SEDE e Projetos ganham a experiência profissional e o município no fim", () => {
      expect(colunasDoCsvDeAnalises(colunas, "projetos")).toEqual([
        ...colunas,
        "experiencia_profissional_anos",
        "experiencia_profissional_meses",
        "experiencia_profissional_dias",
        "experiencia_profissional_total",
        "municipio_uf",
      ]);
      expect(nomeDoCsvDeAnalises("projetos")).toBe(
        "agsus_analises_curriculares_projetos.csv",
      );
    });

    it("só a SEDE tem mensagem própria para área sem análises", () => {
      expect(mensagemDeAreaSemAnalises("sede")).toBe(
        "Ainda não há análises da SEDE. Elas aparecem quando a planilha da SEDE começar a enviar.",
      );
      expect(mensagemDeAreaSemAnalises("projetos")).toBe("");
      expect(mensagemDeAreaSemAnalises("saude-indigena")).toBe("");
    });
  });
});

bloco("avaliacao-documental-fila-fora-do-lote", () => {
  /* A fila leve (20261014180000_fila_leve.sql): o núcleo em toda leitura, os de fora do lote sob demanda. */
  const c = (id, extra = {}) => ({
    id,
    vaga: "1",
    codigo: id,
    situacao_pre: "NO_LOTE",
    posicao: 1,
    ...extra,
  });

  describe("fila: os de fora do lote", () => {
    it("só Inscritos e Eliminados precisam da lista de fora", () => {
      expect(precisaDoForaDoLote("inscritos")).toBe(true);
      expect(precisaDoForaDoLote("eliminados")).toBe(true);
      for (const etapa of [
        "lote",
        "pendentes",
        "em_analise",
        "revisao",
        "concluidas",
      ])
        expect(precisaDoForaDoLote(etapa)).toBe(false);
    });

    it("resumo com zeros quando o banco ainda não manda", () => {
      expect(resumoForaDoLote({})).toEqual({
        total: 0,
        eliminados: 0,
        ranqueados: 0,
        modalidades: [],
        versao: "",
      });
      expect(
        resumoForaDoLote({
          fora_do_lote: {
            total: 7,
            eliminados: "5",
            ranqueados: 2,
            modalidades: ["AC", null, "PCD"],
            versao: "x",
          },
        }),
      ).toEqual({
        total: 7,
        eliminados: 5,
        ranqueados: 2,
        modalidades: ["AC", "PCD"],
        versao: "x",
      });
    });

    it("contadores: o núcleo e, em Inscritos e Eliminados, os de fora", () => {
      const nucleo = [
        c("a", { ficha: { id: "f", situacao: "PENDENTE" } }),
        c("b"),
      ];
      const r = contadoresComForaDoLote(
        nucleo,
        resumoForaDoLote({ fora_do_lote: { total: 10, eliminados: 8 } }),
      );
      expect(r).toMatchObject({
        inscritos: 12,
        lote: 2,
        pendentes: 1,
        eliminados: 8,
      });
    });

    it("junta na ordem do banco (vaga, eliminados por último, posição, código), sem repetir", () => {
      const nucleo = [
        c("n1", { vaga: "2", posicao: 1 }),
        c("n2", { vaga: "1", posicao: 2 }),
      ];
      const fora = [
        c("e1", {
          vaga: "1",
          situacao_pre: "ELIMINADO",
          posicao: null,
          codigo: "10",
        }),
        c("e2", {
          vaga: "1",
          situacao_pre: "ELIMINADO",
          posicao: null,
          codigo: "9",
        }),
        c("r1", { vaga: "1", situacao_pre: "RANQUEADO", posicao: 5 }),
        c("n2", { vaga: "1", posicao: 2 }),
      ];
      expect(juntarFila(nucleo, fora).map((x) => x.id)).toEqual([
        "n2",
        "r1",
        "e2",
        "e1",
        "n1",
      ]);
      expect(juntarFila(nucleo, null)).toBe(nucleo);
    });

    it("modalidades do núcleo e de fora, sem repetir", () => {
      expect(
        modalidadesDaFila(
          [c("a", { modalidade: "PCD" }), c("b", { modalidade: "AC" })],
          resumoForaDoLote({ fora_do_lote: { modalidades: ["AC", "PPI"] } }),
        ),
      ).toEqual(["AC", "PCD", "PPI"]);
    });

    it("lê as páginas até o banco dizer que acabou", async () => {
      const rpc = vi.fn(async (_nome, { p_apos }) =>
        p_apos === null
          ? { candidatos: [c("a")], proximo: "a" }
          : { candidatos: [c("b")], proximo: null },
      );
      expect((await lerForaDoLote(rpc, "e1", 1)).map((x) => x.id)).toEqual([
        "a",
        "b",
      ]);
      expect(rpc).toHaveBeenNthCalledWith(1, "obter_fila_fora_do_lote", {
        p_edital: "e1",
        p_apos: null,
        p_limite: 1,
      });
      expect(rpc).toHaveBeenNthCalledWith(2, "obter_fila_fora_do_lote", {
        p_edital: "e1",
        p_apos: "a",
        p_limite: 1,
      });
    });
  });
});

bloco("dados-dos-recursos", () => {
  describe("entrada da resposta e dos modelos", () => {
    it("não amplia o escopo de modelos com área ou origem malformada", () => {
      const dados = normalizarDadosDosModelos({
        modelos: [
          null,
          { id: "m1", versao: 1, area: {} },
          { id: "m2", versao: 1, origem: [] },
          { id: "m3", versao: 0 },
          {
            id: "m4",
            versao: 2,
            area: "sede",
            origem: "entrevista",
            corpo: "{fundamentacao}",
            ativo: true,
          },
        ],
        areas: [null, { id: {}, rotulo: "Área" }, { id: "sede", rotulo: {} }],
        origens: { id: "entrevista" },
      });
      expect(dados.modelos).toHaveLength(1);
      expect(dados.modelos[0]).toMatchObject({
        id: "m4",
        versao: 2,
        area: "sede",
        origem: "entrevista",
        corpo: "{fundamentacao}",
        ativo: true,
      });
      expect(dados.areas).toEqual([{ id: "sede", rotulo: "" }]);
      expect(dados.origens).toEqual([]);
    });
    it("sinaliza uma resposta inválida em vez de oferecer um novo rascunho", () => {
      for (const resposta of [
        [],
        "texto",
        { id: "resp1", estado: "rascunho", revisao: Infinity },
        { id: "resp1", estado: "inventado", revisao: 1 },
      ]) {
        const detalhe = normalizarDetalheDoRecurso({ resposta });
        expect(detalhe.resposta).toBeNull();
        expect(detalhe.erro).toContain("resposta recebida é inválida");
      }
      expect(
        normalizarDetalheDoRecurso({ resposta: null }).erro,
      ).toBeUndefined();
    });
    it("conserva a versão usada e protege textos e histórico da resposta", () => {
      const r = normalizarRespostaDoRecurso({
        id: "resp1",
        revisao: 3,
        estado: "devolvida",
        modelo_id: "m1",
        modelo_versao: 1,
        modelo_corpo: "Texto antigo {fundamentacao}",
        modelo_vigente: false,
        texto_final: "<b>Texto</b>",
        fundamentacao: {},
        comentario_revisao: [],
        historico: [null, { acao: "devolver", comentario: {}, autor: {} }],
        passou_revisao: true,
        autor_id: "autora",
        envio_revisao_por_id: "remetente",
        extra: { valor: 1 },
      });
      expect(r).toMatchObject({
        modelo_versao: 1,
        modelo_corpo: "Texto antigo {fundamentacao}",
        modelo_vigente: false,
        texto_final: "<b>Texto</b>",
        fundamentacao: "",
        comentario_revisao: "",
        passou_revisao: true,
        extra: { valor: 1 },
      });
      expect(r.historico).toEqual([
        { acao: "devolver", comentario: "", autor: "", em: "" },
      ]);
    });
  });

  describe("entrada dos Recursos", () => {
    it("conserva campos adicionais e só libera permissões booleanas", () => {
      const d = normalizarDadosDosRecursos({
        recursos: [
          {
            id: "r1",
            candidato: "Ana",
            nota_atual: "5.5",
            campo_extra: { valor: 1 },
          },
        ],
        modelos: [{ id: "m1", versao: 1, corpo: "Texto" }],
        pode_editar: true,
        pode_decidir: "true",
        pode_administrar_modelos: 1,
      });
      expect(d.recursos[0]).toMatchObject({
        id: "r1",
        candidato: "Ana",
        nota_atual: "5.5",
        campo_extra: { valor: 1 },
      });
      expect(d.modelos).toMatchObject([
        { id: "m1", versao: 1, corpo: "Texto" },
      ]);
      expect([
        d.pode_editar,
        d.pode_decidir,
        d.pode_administrar_modelos,
      ]).toEqual([true, false, false]);
    });
    it("ignora linhas sem identificador e protege arrays e valores usados na tela", () => {
      const d = normalizarDadosDosRecursos({
        recursos: [
          null,
          [],
          { id: {} },
          {
            id: "r1",
            candidato: {},
            situacao: [],
            nota_atual: {},
            qt_anexos: Infinity,
          },
        ],
        editais: {},
        origens: [null, { id: 2 }],
        cronogramas: [null, { atividade: {}, ordem: {} }],
      });
      expect(d.recursos).toHaveLength(1);
      expect(d.recursos[0]).toMatchObject({
        candidato: "",
        situacao: "",
        nota_atual: null,
        qt_anexos: null,
      });
      expect(d.editais).toEqual([]);
      expect(d.origens).toEqual([]);
      expect(d.cronogramas[0]).toMatchObject({ atividade: "", ordem: null });
    });
    it("não insere objetos nos campos editáveis e conserva o restante do detalhe", () => {
      const d = normalizarDetalheDoRecurso({
        observacao: {},
        nome_informado: [],
        codigo_informado: "001",
        resposta: {
          id: "resp1",
          estado: "rascunho",
          revisao: 1,
          texto_final: "Texto",
        },
        historico: [{ campo: "origem" }],
      });
      expect(d.observacao).toBe("");
      expect(d.nome_informado).toBeUndefined();
      expect(d.codigo_informado).toBe("001");
      expect(d.resposta).toMatchObject({ texto_final: "Texto" });
      expect(d.historico).toMatchObject([{ campo: "origem" }]);
    });
    it("normaliza candidatos sem perder códigos com zeros nem identificadores numéricos", () => {
      expect(
        normalizarCandidatosDosRecursos([
          null,
          { id: {} },
          { id: 12, candidato: "Ana", codigo: "001", nota: 7, responsavel: {} },
        ]),
      ).toMatchObject([
        { id: 12, candidato: "Ana", codigo: "001", nota: 7, responsavel: "" },
      ]);
      expect(normalizarCandidatosDosRecursos({})).toEqual([]);
    });
    it("protege histórico, autores das etapas e anexos contra dados malformados", () => {
      const d = normalizarDetalheDoRecurso({
        parecer: {},
        modalidade: [],
        criado_por: {},
        etapas: { processo_sei: { nome: "Carla" } },
        historico: [
          null,
          [],
          {
            acao: "edicao",
            campo: "codigo",
            anterior: 12,
            novo: {},
            motivo: [],
            autor: {},
          },
        ],
        anexos: [
          null,
          { id: {} },
          { id: "a1", nome: {}, mime: [], bytes: Infinity, ativo: "true" },
        ],
      });
      expect(d).toMatchObject({
        parecer: "",
        modalidade: "",
        criado_por: "",
        etapas: { processo_sei: "" },
      });
      expect(d.historico).toHaveLength(1);
      expect(d.historico[0]).toMatchObject({
        anterior: "12",
        novo: null,
        motivo: "",
        autor: "",
      });
      expect(d.anexos).toHaveLength(1);
      expect(d.anexos[0]).toMatchObject({
        id: "a1",
        nome: "",
        mime: "",
        bytes: 0,
        ativo: false,
      });
      expect(
        normalizarDetalheDoRecurso({
          historico: {},
          anexos: "texto",
          etapas: [],
        }),
      ).toMatchObject({
        historico: [],
        anexos: [],
        etapas: { upload_sei: "" },
      });
    });
    it("preserva metadados válidos do anexo e da resposta sem confundir permissões", () => {
      const d = normalizarDetalheDoRecurso({
        anexos: [
          {
            id: 1,
            nome: "recurso.pdf",
            mime: "application/pdf",
            bytes: 50,
            ativo: true,
            incluido_por: "Ana",
            caminho: "privado/arquivo",
          },
        ],
        resposta: {
          id: "resp1",
          revisao: 2,
          estado: "enviada",
          texto_final: "Texto",
          modelo_corpo: "{fundamentacao}",
        },
      });
      expect(d.anexos[0]).toMatchObject({
        id: 1,
        nome: "recurso.pdf",
        bytes: 50,
        ativo: true,
        caminho: "privado/arquivo",
      });
      expect(d.resposta).toMatchObject({
        id: "resp1",
        revisao: 2,
        estado: "enviada",
        texto_final: "Texto",
        modelo_corpo: "{fundamentacao}",
      });
      const r = normalizarDadosDosRecursos({
        recursos: [
          {
            id: "r1",
            resultado_atual: {},
            resultado_anterior: "Aprovado",
            parecer_enviado_em: [],
          },
        ],
      }).recursos[0];
      expect(r).toMatchObject({
        resultado_atual: "",
        resultado_anterior: "Aprovado",
        parecer_enviado_em: null,
      });
    });
  });
});

bloco("data-de-analise", () => {
  const dataDaPlanilha = dataDaPlanilha__1;
  describe("data da planilha", () => {
    it("lê dd/mm/aaaa e aaaa-mm-dd", () => {
      expect(dataDaPlanilha("28/09/2026")).toEqual(new Date(2026, 8, 28));
      expect(dataDaPlanilha("2026-09-28")).toEqual(new Date(2026, 8, 28));
      expect(dataDaPlanilha("29/02/2028")).toEqual(new Date(2028, 1, 29));
    });

    it("data impossível fica sem data, em vez de virar outro dia", () => {
      expect(dataDaPlanilha("31/02/2026")).toBeNull();
      expect(dataDaPlanilha("29/02/2026")).toBeNull();
      expect(dataDaPlanilha("2026-13-01")).toBeNull();
      expect(dataDaPlanilha("00/05/2026")).toBeNull();
    });
  });

  describe("data de análise no futuro", () => {
    const agora = new Date(2026, 8, 28, 23, 50); // 28/09/2026, 23:50

    it("amanhã é futuro; hoje e ontem não", () => {
      expect(dataDeAnaliseNoFuturo(new Date(2026, 8, 29), agora)).toBe(true);
      expect(dataDeAnaliseNoFuturo(new Date(2026, 8, 28), agora)).toBe(false);
      expect(dataDeAnaliseNoFuturo(new Date(2026, 8, 27), agora)).toBe(false);
    });

    it("a hora não conta: hoje às 23:59 continua sendo hoje", () => {
      expect(
        dataDeAnaliseNoFuturo(
          new Date(2026, 8, 28, 23, 59),
          new Date(2026, 8, 28, 0, 1),
        ),
      ).toBe(false);
    });

    it("sem data válida não é futuro", () => {
      expect(dataDeAnaliseNoFuturo(null, agora)).toBe(false);
      expect(dataDeAnaliseNoFuturo(new Date("x"), agora)).toBe(false);
    });
  });
});

bloco("lib/acompanhamento-das-inscricoes", () => {
  /*
  O acompanhamento das inscrições (cartão "Inscrições" da Triagem):
  a janela pelo cronograma (a "Validação das inscrições" dos Projetos não é
  inscrição), os totais do último retrato de cada vaga, a série diária com o
  retrato de cada vaga valendo até o próximo e o "hoje +N" por vaga.
*/

  describe("janela das inscrições", () => {
    it("a validação das inscrições não conta como inscrição", () => {
      expect(janelaDasInscricoes(CRONOGRAMA_114)).toEqual({
        inicio: "2026-10-05",
        fim: "2026-10-14",
      });
      expect(dataDeCorteDoCronograma(CRONOGRAMA_114)).toBe("2026-10-14");
      expect(janelaDasInscricoes(null)).toEqual({ inicio: null, fim: null });
    });

    it("o cartão aparece da véspera do início a 3 dias depois do fim", () => {
      const em = (hoje) =>
        acompanhamentoDasInscricoes({ ...DADOS_114, hoje }).mostrar;
      expect(em("2026-10-03")).toBe(false);
      expect(em("2026-10-04")).toBe(true);
      expect(em("2026-10-17")).toBe(true);
      expect(em("2026-10-18")).toBe(false);
      expect(acompanhamentoDasInscricoes({ hoje: "2026-10-09" }).mostrar).toBe(
        false,
      );
      expect(acompanhamentoDasInscricoes(null).mostrar).toBe(false);
    });
  });

  describe("totais, série e vagas", () => {
    const a = acompanhamentoDasInscricoes(DADOS_114);

    it("os totais somam o último retrato de cada vaga", () => {
      expect(a.totais).toMatchObject({
        inscritos: 21,
        finalizados: 19,
        aptos: 8,
        eliminados: 2,
        hoje: 3,
        previa: false,
        em: "2026-10-09T13:00:00Z",
      });
      expect(a.encerradas).toBe(false);
    });

    it("a série vai do início ao fim; o retrato vale até o próximo; depois de hoje, vazio", () => {
      expect(a.serie).toHaveLength(10);
      const por = Object.fromEntries(a.serie.map((p) => [p.data, p]));
      expect(por["2026-10-05"]).toEqual({
        data: "2026-10-05",
        inscritos: null,
        aptos: null,
      });
      expect(por["2026-10-06"].inscritos).toBe(10);
      expect(por["2026-10-07"]).toMatchObject({ inscritos: 13, aptos: 5 });
      expect(por["2026-10-09"]).toMatchObject({ inscritos: 21, aptos: 8 });
      expect(por["2026-10-10"].inscritos).toBeNull();
    });

    it("por vaga: inscritos, aptos e hoje +N (só com retrato de hoje)", () => {
      expect(a.vagas).toEqual([
        {
          codigo: "181100",
          cargo: "Analista — Belo Horizonte",
          inscritos: 18,
          aptos: 7,
          hoje: 3,
        },
        {
          codigo: "181101",
          cargo: "Motorista — Vitória",
          inscritos: 3,
          aptos: 1,
          hoje: null,
        },
      ]);
    });

    it("sem regra os aptos ficam vazios; com prévia, avisa", () => {
      const semRegra = acompanhamentoDasInscricoes({
        ...DADOS_114,
        retratos: [r("181100", "2026-10-09", 5, null, { eliminados: null })],
      });
      expect(semRegra.totais).toMatchObject({
        inscritos: 5,
        aptos: null,
        eliminados: null,
        previa: false,
        hoje: 5,
      });
      const previa = acompanhamentoDasInscricoes({
        ...DADOS_114,
        retratos: [r("181100", "2026-10-09", 5, 2, { previa: true })],
      });
      expect(previa.totais.previa).toBe(true);
    });

    it("sem retrato ainda: cartão sem totais; vaga do edital aparece sem números", () => {
      const vazio = acompanhamentoDasInscricoes({ ...DADOS_114, retratos: [] });
      expect(vazio.mostrar).toBe(true);
      expect(vazio.totais).toBeNull();
      expect(vazio.vagas[0]).toMatchObject({ inscritos: null, hoje: null });
    });
  });

  describe("auxiliares", () => {
    it("textoDoHoje e diasEntre", () => {
      expect([
        textoDoHoje(3),
        textoDoHoje(0),
        textoDoHoje(-1),
        textoDoHoje(null),
      ]).toEqual(["+3", "0", "-1", "—"]);
      expect(diasEntre("2026-10-30", "2026-11-02")).toEqual([
        "2026-10-30",
        "2026-10-31",
        "2026-11-01",
        "2026-11-02",
      ]);
    });
  });
});

bloco("lib/avaliacao-documental-anexo-na-empregare", () => {
  /*
  O "Abrir na Empregare" do anexo declarado (src/lib/avaliacao-documental/anexo-na-empregare.ts):
  hoje abre o candidato (o currículo) e diz onde achar o arquivo; o link
  direto do arquivo entra só ali. Dados fictícios.
*/
  const COLUNA =
    "Pergunta 4 - Anexe o documento de identificação com foto (frente e verso, legível)";
  const CANDIDATO =
    "https://corporate.empregare.com/empresa/curriculo/detalhes?tokenCandidato=TKfict&id=IDfict|";

  describe("anexo na Empregare", () => {
    it("número e enunciado inteiro da pergunta pela coluna", () => {
      expect(numeroDaPergunta(COLUNA)).toBe("Pergunta 4");
      expect(numeroDaPergunta("Sem número")).toBeNull();
      expect(enunciadoCompleto(COLUNA)).toBe(
        "Anexe o documento de identificação com foto (frente e verso, legível)",
      );
      expect(enunciadoCompleto("Pergunta 7&nbsp;-  Anexe   o registro")).toBe(
        "Anexe o registro",
      );
    });

    it("o endereço: o candidato; sem ele, a vaga ou a lista de vagas", () => {
      expect(
        enderecoDoAnexo(
          { candidato: CANDIDATO, vaga: "x", vagaDireta: true },
          COLUNA,
        ),
      ).toEqual({ href: CANDIDATO, destino: "candidato" });
      expect(
        enderecoDoAnexo({
          candidato: null,
          vaga: "https://corporate.empregare.com/empresa/vagas/candidaturas/Ab1|",
          vagaDireta: true,
        }),
      ).toEqual({
        href: "https://corporate.empregare.com/empresa/vagas/candidaturas/Ab1|",
        destino: "vaga",
      });
      expect(
        enderecoDoAnexo({
          candidato: null,
          vaga: "https://corporate.empregare.com/empresa/vagas",
          vagaDireta: false,
        })?.destino,
      ).toBe("vagas");
      expect(
        enderecoDoAnexo({ candidato: null, vaga: null, vagaDireta: false }),
      ).toBeNull();
    });

    it('rótulo "Abrir na Empregare" e a dica com a aba Questionários e a pergunta', () => {
      expect(apresentacaoDoAnexo(COLUNA)).toEqual({
        rotulo: "Abrir na Empregare",
        dica: "Na Empregare: aba Questionários › Pergunta 4 — Anexe o documento de identificação com foto",
      });
      expect(
        apresentacaoDoAnexo(
          "Pergunta 6 - Anexe o diploma ou certificado de conclusão da formação exigida para a vaga, frente e verso",
        ).dica,
      ).toBe(
        "Na Empregare: aba Questionários › Pergunta 6 — Anexe o diploma ou certificado de conclusão da formação…",
      );
      expect(apresentacaoDoAnexo("").dica).toBe(
        "Na Empregare: aba Questionários",
      );
    });
  });

  /*
  Os anexos capturados pelo robô (GetRespostaDetails; links fictícios): o
  "Visualizar Arquivo" da pergunta vira "Ver documento"; sem ele, a impressão
  das respostas ("Ver respostas na Empregare"); sem ela, o fallback de antes.
*/
  const ARQ = (pergunta, arquivo) =>
    `https://corporate.empregare.com/Company/VacancyTests/GetViewerLogArquivo?arquivo=${arquivo}.pdf&token=TKfict&questionarioRespostaID=9900001&perguntaID=${pergunta}`;
  const IMPRESSAO =
    "https://corporate.empregare.com/Company/VacancyTests/PrintResult?respostaID=9900001&pessoa=PSfict&vaga=Vaga%20Ficticia";
  const VAGA =
    "https://corporate.empregare.com/empresa/vagas/candidaturas/Vfict|";
  const COLUNA_6 = "Pergunta 6 - Anexe o diploma de graduação";
  const DA_RPC = {
    respostas: [
      { resposta: "9900002", link_impressao: "javascript:alert(1)" },
      { resposta: "9900001", link_impressao: IMPRESSAO },
    ],
    anexos: [
      {
        resposta: "9900001",
        pergunta: "501",
        arquivo: 1,
        enunciado:
          "Pergunta 4 - Anexe o documento de identificação com foto (RG ou CNH)",
        coluna: COLUNA,
        link: ARQ(501, "a"),
      },
      {
        resposta: "9900001",
        pergunta: "502",
        arquivo: 2,
        enunciado: "Anexe o diploma de graduação",
        coluna: "",
        link: ARQ(502, "c"),
      },
      {
        resposta: "9900001",
        pergunta: "502",
        arquivo: 1,
        enunciado: "Anexe o diploma de graduação",
        coluna: "",
        link: ARQ(502, "b"),
      },
      {
        resposta: "9900001",
        pergunta: "503",
        arquivo: 1,
        link: "https://storage.empregare.com/anexocurriculo/x.pdf?se=1&sig=y",
      },
      { resposta: "9900001", pergunta: "x", arquivo: 1, link: ARQ(504, "d") },
    ],
  };

  describe("anexos capturados pelo robô (empregare.anexos e respostas)", () => {
    it("valida o que veio da RPC: só Visualizar Arquivo e PrintResult da Empregare", () => {
      expect(
        anexosDaEmpregare(DA_RPC).map((a) => [a.pergunta, a.arquivo]),
      ).toEqual([
        ["501", 1],
        ["502", 2],
        ["502", 1],
      ]);
      expect(impressaoDasRespostas(DA_RPC)).toBe(IMPRESSAO);
      expect(anexosDaEmpregare(null)).toEqual([]);
      expect(impressaoDasRespostas({ respostas: "x" })).toBeNull();
    });

    it("com o link da pergunta (pela coluna casada): 'Ver documento', sem dica", () => {
      const enderecos = {
        candidato: CANDIDATO,
        vaga: VAGA,
        vagaDireta: true,
        anexos: anexosDaEmpregare(DA_RPC),
        impressao: impressaoDasRespostas(DA_RPC),
      };
      const endereco = enderecoDoAnexo(enderecos, COLUNA);
      expect(endereco).toEqual({
        href: ARQ(501, "a"),
        destino: "arquivo",
        outros: [],
      });
      expect(apresentacaoDoAnexo(COLUNA, endereco)).toEqual({
        rotulo: "Ver documento",
        dica: "",
      });
    });

    it("sem coluna casada, pelo enunciado; com dois arquivos, abre o primeiro e diz quantos são", () => {
      const enderecos = {
        candidato: CANDIDATO,
        vaga: VAGA,
        vagaDireta: true,
        anexos: anexosDaEmpregare(DA_RPC),
      };
      const endereco = enderecoDoAnexo(enderecos, COLUNA_6);
      expect(endereco).toEqual({
        href: ARQ(502, "b"),
        destino: "arquivo",
        outros: [ARQ(502, "c")],
      });
      expect(apresentacaoDoAnexo(COLUNA_6, endereco)).toEqual({
        rotulo: "Ver documento",
        dica: "2 arquivos nesta pergunta",
      });
      expect(anexosDaColuna(enderecos.anexos, "Anexe")).toEqual([]);
    });

    it("sem o link da pergunta: a impressão das respostas; sem ela, o candidato", () => {
      const coluna = "Pergunta 9 - Anexe o comprovante de residência";
      const comImpressao = enderecoDoAnexo(
        {
          candidato: CANDIDATO,
          vaga: VAGA,
          vagaDireta: true,
          anexos: anexosDaEmpregare(DA_RPC),
          impressao: IMPRESSAO,
        },
        coluna,
      );
      expect(comImpressao).toEqual({ href: IMPRESSAO, destino: "respostas" });
      expect(apresentacaoDoAnexo(coluna, comImpressao)).toEqual({
        rotulo: "Ver respostas na Empregare",
        dica: "Pergunta 9 — Anexe o comprovante de residência",
      });
      const semNada = enderecoDoAnexo(
        { candidato: CANDIDATO, vaga: VAGA, vagaDireta: true },
        coluna,
      );
      expect(semNada).toEqual({ href: CANDIDATO, destino: "candidato" });
      expect(apresentacaoDoAnexo(coluna, semNada).rotulo).toBe(
        "Abrir na Empregare",
      );
    });
  });

  describe("casamento do enunciado sem a coluna gravada (texto do edital)", () => {
    const anexo = (ordem, pergunta, enunciado) => ({
      resposta: "9900001",
      pergunta,
      arquivo: 1,
      ordem,
      enunciado,
      coluna: "",
      link: ARQ(pergunta, `a${pergunta}`),
    });
    const ANEXOS = [
      anexo(
        6,
        "601",
        "Anexe a comprovação de Nível Superior: (frente e verso do diploma ou declaração)",
      ),
      anexo(
        11,
        "611",
        "Experiência profissional: anexe a comprovação (carteira de trabalho, contrato)",
      ),
      anexo(
        12,
        "612",
        "Experiência profissional: anexe a comprovação de tempo de serviço na área",
      ),
    ];

    it("a chave tira acento, caixa, espaço e pontuação; prefixo no tamanho do menor", () => {
      expect(
        chaveDoEnunciado("Pergunta 6 - Nível Superior:(frente&nbsp;e"),
      ).toBe(chaveDoEnunciado("NIVEL  superior: (frente e"));
      expect(
        enunciadosCasam(
          "anexeacomprovacaodenivel",
          "anexeacomprovacaodenivelsuperior",
        ),
      ).toBe(true);
      expect(enunciadosCasam("anexeorg", "anexeorgecpf")).toBe(false);
    });

    it("coluna do Excel truncada e com pontuação diferente casa pela Ordem", () => {
      expect(
        anexosDaColuna(
          ANEXOS,
          "Pergunta 6 - Anexe a comprovação de Nível Superior:(frente e",
        ).map((a) => a.pergunta),
      ).toEqual(["601"]);
      expect(
        anexosDaColuna(
          ANEXOS,
          "Pergunta 11 - Experiência profissional: anexe a comprovação",
        ).map((a) => a.pergunta),
      ).toEqual(["611"]);
    });

    it("sem a Ordem certa, só casa quando é uma única pergunta", () => {
      expect(
        anexosDaColuna(ANEXOS, "Experiência profissional: anexe a comprovação"),
      ).toEqual([]);
      expect(
        anexosDaColuna(
          ANEXOS,
          "Anexe a comprovação de Nível Superior:(frente e",
        ).map((a) => a.pergunta),
      ).toEqual(["601"]);
    });
  });

  describe("envios anteriores do questionário (empregare.envios_anteriores)", () => {
    it("valida cada envio e os arquivos dele; a resposta vem do envio", () => {
      const envios = enviosAnterioresDaEmpregare({
        envios_anteriores: [
          {
            resposta: "7995988",
            link_impressao: IMPRESSAO,
            perguntas: 25,
            arquivos: [
              {
                pergunta: "179828",
                arquivo: 1,
                ordem: 4,
                enunciado: "Anexe o documento de identificação com foto",
                coluna:
                  "Pergunta 4 - Anexe o documento de identificação com foto",
                link: ARQ(179828, "rg"),
              },
              { pergunta: "179829", arquivo: 1, link: "https://exemplo.com/x" },
            ],
          },
          { resposta: "x", arquivos: [] },
          { resposta: "7990000", link_impressao: "javascript:alert(1)" },
        ],
      });
      expect(envios).toEqual([
        {
          resposta: "7995988",
          impressao: IMPRESSAO,
          arquivos: [
            {
              resposta: "7995988",
              pergunta: "179828",
              arquivo: 1,
              ordem: 4,
              enunciado: "Anexe o documento de identificação com foto",
              coluna:
                "Pergunta 4 - Anexe o documento de identificação com foto",
              link: ARQ(179828, "rg"),
            },
          ],
        },
        { resposta: "7990000", impressao: null, arquivos: [] },
      ]);
      expect(enviosAnterioresDaEmpregare(null)).toEqual([]);
      expect(enviosAnterioresDaEmpregare({ envios_anteriores: {} })).toEqual(
        [],
      );
    });
  });

  /*
  A exportação da Empregare escreve "Anexo" em toda pergunta de anexo, mesmo
  quando o candidato respondeu sem arquivo. Com a resposta vigente lida pelo
  robô (perguntas > 0) e sem arquivo na pergunta, a ficha diz "Sem arquivo
  enviado" e oferece "Conferir na Empregare" — não um botão que pareça o
  documento. Com arquivo só num envio anterior, o link vai a ele.
*/
  describe("pergunta de anexo sem arquivo na resposta lida", () => {
    const coluna = "Pergunta 7 - Anexe o registro no conselho de classe";
    const base = {
      candidato: CANDIDATO,
      vaga: VAGA,
      vagaDireta: true,
      anexos: anexosDaEmpregare(DA_RPC),
    };

    it("a resposta lida é a que tem perguntas > 0", () => {
      expect(respostaLidaDaEmpregare({ respostas: [{ perguntas: 27 }] })).toBe(
        true,
      );
      expect(
        respostaLidaDaEmpregare({ respostas: [{ perguntas: 0 }, {}] }),
      ).toBe(false);
      expect(respostaLidaDaEmpregare(null)).toBe(false);
      expect(respostaLidaDaEmpregare({ respostas: "x" })).toBe(false);
    });

    it("resposta lida e sem arquivo: 'Sem arquivo enviado' e o candidato para conferir", () => {
      const endereco = enderecoDoAnexo({ ...base, respostaLida: true }, coluna);
      expect(endereco).toEqual({ href: CANDIDATO, destino: "sem_arquivo" });
      expect(apresentacaoDoAnexo(coluna, endereco)).toEqual({
        rotulo: "Conferir na Empregare",
        texto: "Sem arquivo enviado",
        dica: "A resposta lida na Empregare não traz arquivo nesta pergunta",
      });
      // A impressão das respostas vem antes do candidato; sem nada, sem link.
      expect(
        enderecoDoAnexo(
          { ...base, impressao: IMPRESSAO, respostaLida: true },
          coluna,
        ),
      ).toEqual({ href: IMPRESSAO, destino: "sem_arquivo" });
      expect(
        enderecoDoAnexo(
          {
            candidato: null,
            vaga: null,
            vagaDireta: false,
            respostaLida: true,
          },
          coluna,
        ),
      ).toEqual({ href: null, destino: "sem_arquivo" });
    });

    it("a pergunta com arquivo continua indo ao documento, mesmo com a resposta lida", () => {
      expect(
        enderecoDoAnexo({ ...base, respostaLida: true }, COLUNA)?.destino,
      ).toBe("arquivo");
    });

    it("resposta não lida (robô não capturou): o candidato, como antes", () => {
      expect(enderecoDoAnexo(base, coluna)).toEqual({
        href: CANDIDATO,
        destino: "candidato",
      });
    });

    it("arquivo só num envio anterior: o link vai a ele", () => {
      const anteriores = enviosAnterioresDaEmpregare({
        envios_anteriores: [
          {
            resposta: "9800001",
            link_impressao: null,
            arquivos: [
              {
                pergunta: "507",
                arquivo: 1,
                ordem: 7,
                enunciado: "Anexe o registro no conselho de classe",
                coluna,
                link: ARQ(507, "antigo"),
              },
            ],
          },
        ],
      });
      const endereco = enderecoDoAnexo(
        { ...base, anteriores, respostaLida: true },
        coluna,
      );
      expect(endereco).toEqual({
        href: ARQ(507, "antigo"),
        destino: "anterior",
        outros: [],
      });
      expect(apresentacaoDoAnexo(coluna, endereco).rotulo).toBe(
        "Ver documento do envio anterior",
      );
    });
  });
});

bloco("lib/avaliacao-documental-apurado-da-ficha", () => {
  /*
  O Apurado dos itens que pontuam: vem do Calculado pelos itens registrados
  (o Declarado não preenche mais), o ajuste à mão fica por cima, Não conforme
  e Não enviado zeram (e tiram a justificativa da nota). O registro é
  obrigatório: com Declarado acima de 0 o cartão abre com uma linha e o
  Conforme pede um item completo e aceito; a linha incompleta não trava o
  rascunho.
*/
  const CURSOS = { codigo: "CURSOS", tipo: "CURSOS", teto: 5, motivos: [] };
  const declarada = { parciais: { CURSOS: 3 } };
  const TITULOS = {
    codigo: "FORMACAO",
    tipo: "TITULOS",
    teto: 5,
    motivos: [],
    titulos: [{ codigo: "MESTRADO", rotulo: "Mestrado", pontos: 3 }],
  };
  const declaradaT = { parciais: { FORMACAO: 3 } };
  const lancamento = (blocos = {}, extra = {}) => ({
    nivel: "superior",
    blocos,
    cursos: [],
    titulos: [],
    ...extra,
  });

  describe("apurado da ficha", () => {
    it("vem do calculado (não do declarado); com ajuste, o ajuste", () => {
      expect(
        apuradoDoBloco({
          bloco: CURSOS,
          calculado: 0,
          lancamento: lancamento(),
        }),
      ).toEqual({ valor: 0, origem: "calculado" });
      expect(
        apuradoDoBloco({
          bloco: CURSOS,
          calculado: 1,
          lancamento: lancamento({}, { cursos: [{ horas: 40 }] }),
        }),
      ).toEqual({ valor: 1, origem: "calculado" });
      expect(
        apuradoDoBloco({
          bloco: CURSOS,
          calculado: 1,
          lancamento: lancamento({ CURSOS: { nota_ajustada: 2 } }),
        }),
      ).toEqual({ valor: 2, origem: "ajustado" });
    });

    it("Conforme segue o calculado; Não conforme e Não enviado zeram e tiram a justificativa", () => {
      const decidir = (l, situacao) =>
        blocoComDecisao({ bloco: CURSOS, lancamento: l, situacao });
      const conforme = decidir(lancamento(), "CONFORME");
      expect(conforme).toEqual({ situacao: "CONFORME", motivos: [] });
      const nao = decidir(
        lancamento({
          CURSOS: {
            ...conforme,
            motivos: ["X"],
            justificativas: ["CURSOS_DIMINUIDA"],
            justificativa_livre: "texto",
          },
        }),
        "NAO_CONFORME",
      );
      expect(nao).toMatchObject({
        nota_ajustada: 0,
        justificativas: [],
        justificativa_livre: "",
        motivos: ["X"],
      });
      expect(decidir(lancamento(), "NAO_ENVIADO").nota_ajustada).toBe(0);
      // Volta ao Conforme ou desmarca: o zero sai (volta o calculado).
      expect(
        decidir(lancamento({ CURSOS: nao }), "CONFORME").nota_ajustada,
      ).toBeNull();
      expect(
        decidir(lancamento({ CURSOS: nao }), null).nota_ajustada,
      ).toBeNull();
      // Um ajuste feito pelo analista fica no Conforme.
      expect(
        decidir(lancamento({ CURSOS: { nota_ajustada: 2 } }), "CONFORME")
          .nota_ajustada,
      ).toBe(2);
    });
  });

  describe("registro obrigatório dos itens", () => {
    it("abre com linha nova no Confere com declarado > 0 (ou no Editar), lista vazia — Titulação; Cursos não (pela nota)", () => {
      const conferido = lancamento({ FORMACAO: { situacao: "CONFORME" } });
      // Cursos de Aperfeiçoamento decidem pela faixa/nota do bloco: nunca abrem a lista.
      expect(
        abreComLinhaNova(
          CURSOS,
          lancamento({ CURSOS: { situacao: "CONFORME" } }),
          declarada,
        ),
      ).toBe(false);
      // Sem escolha, a lista não aparece: nada abre.
      expect(abreComLinhaNova(TITULOS, lancamento(), declaradaT)).toBe(false);
      expect(abreComLinhaNova(TITULOS, conferido, declaradaT)).toBe(true);
      // Rascunho antigo, Conforme sem item: abre igual.
      expect(
        abreComLinhaNova(
          TITULOS,
          lancamento({ FORMACAO: { situacao: "CONFORME", nota_ajustada: 3 } }),
          declaradaT,
        ),
      ).toBe(true);
      expect(
        abreComLinhaNova(
          TITULOS,
          lancamento({ FORMACAO: { situacao: "CONFORME", edita_nota: true } }),
          { parciais: { FORMACAO: 0 } },
        ),
      ).toBe(true);
      expect(
        abreComLinhaNova(TITULOS, conferido, { parciais: { FORMACAO: 0 } }),
      ).toBe(false);
      expect(
        abreComLinhaNova(TITULOS, { ...conferido, titulos: [{}] }, declaradaT),
      ).toBe(false);
      expect(
        abreComLinhaNova(
          TITULOS,
          lancamento({ FORMACAO: { situacao: "NAO_ENVIADO" } }),
          declaradaT,
        ),
      ).toBe(false);
      expect(
        abreComLinhaNova(
          { codigo: "X", tipo: "DOCUMENTO" },
          lancamento(),
          null,
        ),
      ).toBe(false);
    });

    it("título pré-selecionado pela resposta do candidato", () => {
      const opcoes = [
        { codigo: "ESPECIALIZACAO", rotulo: "Especialização" },
        { codigo: "MESTRADO", rotulo: "Mestrado" },
        { codigo: "DOUTORADO", rotulo: "Doutorado" },
      ];
      expect(tituloDaResposta(opcoes, ["Mestrado"])).toBe("MESTRADO");
      expect(tituloDaResposta(opcoes, ["especializacao lato sensu"])).toBe(
        "ESPECIALIZACAO",
      );
      expect(tituloDaResposta(opcoes, ["Não possuo"])).toBeNull();
    });

    it("Conforme com declarado > 0 pede um item completo e aceito (Titulação; Cursos não pedem a lista)", () => {
      const texto = "Registre ao menos um título.";
      expect(faltaDoComprovado(CURSOS, lancamento(), declarada)).toBeNull();
      expect(faltaDoComprovado(TITULOS, lancamento(), declaradaT)).toBe(texto);
      // Linha vazia ou recusada não conta.
      expect(
        faltaDoComprovado(
          TITULOS,
          lancamento({}, { titulos: [{ titulo: "" }] }),
          declaradaT,
        ),
      ).toBe(texto);
      expect(
        faltaDoComprovado(
          TITULOS,
          lancamento({}, { titulos: [{ titulo: "MESTRADO", aceito: false }] }),
          declaradaT,
        ),
      ).toBe(texto);
      expect(
        faltaDoComprovado(
          TITULOS,
          lancamento({}, { titulos: [{ titulo: "MESTRADO", aceito: true }] }),
          declaradaT,
        ),
      ).toBeNull();
      // Declarado 0 ("Não possuo"): não pede item.
      expect(
        faltaDoComprovado(TITULOS, lancamento(), { parciais: { FORMACAO: 0 } }),
      ).toBeNull();
      expect(itemCompleto("vinculos", { inicio: "2024-01-01", fim: "" })).toBe(
        false,
      );
      expect(itemCompleto("titulos", { titulo: "MESTRADO" })).toBe(true);
    });

    it("linha incompleta não trava o rascunho; no Não conforme/Não enviado ela sai", () => {
      const regra = {
        blocos: [
          { codigo: "CURSOS", tipo: "CURSOS", titulo: "Cursos", motivos: [] },
          {
            codigo: "EXPERIENCIA",
            tipo: "VINCULOS",
            titulo: "Experiência",
            motivos: [],
            categorias: [{ codigo: "AREA", rotulo: "Área" }],
          },
        ],
      };
      const l = {
        nivel: "superior",
        blocos: { EXPERIENCIA: { situacao: "NAO_ENVIADO" } },
        cursos: [
          { nome: "Curso", horas: "" },
          { nome: "Outro", horas: 40 },
        ],
        vinculos: [
          { categoria: "AREA", inicio: "", fim: "" },
          { categoria: "AREA", inicio: "2020-01-01", fim: "2021-01-01" },
        ],
      };
      const gravado = lancamentoParaGravar(regra, l);
      // O curso sem horas vai sem o campo (o banco aceita); o resto fica.
      expect(gravado.cursos).toEqual([
        { nome: "Curso" },
        { nome: "Outro", horas: 40 },
      ]);
      // Experiência Não enviado: a linha sem datas sai.
      expect(gravado.vinculos).toEqual([
        { categoria: "AREA", inicio: "2020-01-01", fim: "2021-01-01" },
      ]);
      // O lançamento da tela não muda.
      expect(l.cursos[0].horas).toBe("");
      expect(l.vinculos).toHaveLength(2);
    });

    it("observação pronta de texto igual a um motivo do bloco não se repete", () => {
      const regra = {
        blocos: [],
        observacoes_prontas: [
          {
            codigo: "EVENTOS",
            rotulo: "Eventos acadêmicos não são pontuados",
            texto: "Eventos acadêmicos não são pontuados.",
          },
          { codigo: "OUTRA", rotulo: "Outra", texto: "Outra observação." },
        ],
      };
      const bloco = {
        codigo: "CURSOS",
        tipo: "CURSOS",
        motivos: [
          { codigo: "EVENTO", texto: "Eventos acadêmicos não são pontuados." },
        ],
      };
      expect(opcoesDeJustificativa(regra, bloco).map((o) => o.codigo)).toEqual([
        "EVENTO",
        "OUTRA",
      ]);
    });
  });

  describe("as três escolhas: Confere, Não confere e Editar nota", () => {
    const escolher = (l, escolha, extra = {}) =>
      blocoComEscolha({
        bloco: CURSOS,
        lancamento: l,
        escolha,
        declarada,
        ...extra,
      });

    it("Confere com o declarado acima do teto do bloco grava o teto (o banco recusa acima dele)", () => {
      const r = escolher(lancamento(), "CONFERE", {
        declarada: { parciais: { CURSOS: 6 } },
      });
      expect(r.nota_ajustada).toBe(5);
      expect(r.edita_nota).toBe(false);
    });

    it("Confere aceita o declarado: pontuação = declarado, sem justificativa", () => {
      expect(
        escolher(
          lancamento({
            CURSOS: { justificativas: ["X"], justificativa_livre: "t" },
          }),
          "CONFERE",
        ),
      ).toEqual({
        situacao: "CONFORME",
        motivos: [],
        edita_nota: false,
        nota_ajustada: 3,
        justificativas: [],
        justificativa_livre: "",
      });
    });

    it("Não confere zera; 'não enviou' vira NAO_ENVIADO e os motivos ficam", () => {
      const nao = escolher(
        lancamento({ CURSOS: { motivos: ["M1"], edita_nota: true } }),
        "NAO_CONFERE",
      );
      expect(nao).toMatchObject({
        situacao: "NAO_CONFORME",
        nota_ajustada: 0,
        edita_nota: true,
      });
      expect(nao.motivos).toEqual(["M1"]);
      expect(
        escolher(lancamento({ CURSOS: nao }), "NAO_CONFERE", {
          naoEnviou: true,
        }),
      ).toMatchObject({
        situacao: "NAO_ENVIADO",
        nota_ajustada: 0,
        motivos: ["M1"],
      });
    });

    it("o Outro motivo escrito fica no 'não enviou' e sai ao trocar de escolha; a observação fica sempre", () => {
      const nao = escolher(
        lancamento({
          CURSOS: {
            situacao: "NAO_CONFORME",
            motivos: ["OUTRO"],
            motivo_livre: "Só a capa do certificado.",
            observacao: "Conferido no PDF.",
          },
        }),
        "NAO_CONFERE",
        { naoEnviou: true },
      );
      expect(nao).toMatchObject({
        situacao: "NAO_ENVIADO",
        motivos: ["OUTRO"],
        motivo_livre: "Só a capa do certificado.",
      });
      const editar = escolher(lancamento({ CURSOS: nao }), "EDITAR");
      expect(editar.motivo_livre).toBe("");
      expect(editar.motivos).toEqual([]);
      expect(editar.observacao).toBe("Conferido no PDF.");
      const confere = escolher(
        lancamento({
          CURSOS: {
            situacao: "CONFORME",
            edita_nota: true,
            justificativas: ["OUTRO"],
            motivo_livre: "Sem assinatura.",
          },
        }),
        "CONFERE",
      );
      expect(confere).toMatchObject({ justificativas: [], motivo_livre: "" });
    });

    it("Editar nota: a pontuação vem do calculado; o ajuste de quem já editava fica", () => {
      const editar = escolher(
        lancamento({ CURSOS: { situacao: "CONFORME", nota_ajustada: 3 } }),
        "EDITAR",
      );
      // Cursos sem lista (pela faixa/nota): o Editar começa no declarado.
      expect(editar).toMatchObject({
        situacao: "CONFORME",
        edita_nota: true,
        nota_ajustada: 3,
      });
      // Ficha antiga com cursos lançados: a pontuação vem do calculado.
      expect(
        escolher(
          lancamento(
            { CURSOS: { situacao: "CONFORME", nota_ajustada: 3 } },
            { cursos: [{ nome: "A", horas: 60, aceito: true }] },
          ),
          "EDITAR",
        ).nota_ajustada,
      ).toBeNull();
      expect(
        escolher(
          lancamento({
            CURSOS: {
              situacao: "CONFORME",
              edita_nota: true,
              nota_ajustada: 2,
            },
          }),
          "EDITAR",
        ).nota_ajustada,
      ).toBe(2);
      // Desmarcar tira a escolha e o ajuste.
      const nada = escolher(lancamento({ CURSOS: editar }), null);
      expect(nada.situacao).toBeNull();
      expect(nada.nota_ajustada).toBeNull();
      expect("edita_nota" in nada).toBe(false);
    });

    it("blocos que não pontuam: só Confere e Não confere, sem nota", () => {
      const doc = { codigo: "IDENTIDADE", tipo: "DOCUMENTO" };
      expect(
        blocoComEscolha({
          bloco: doc,
          lancamento: lancamento(),
          escolha: "CONFERE",
          declarada,
        }),
      ).toEqual({ situacao: "CONFORME", motivos: [] });
      expect(
        escolhaDoBloco(doc, { situacao: "CONFORME" }, declarada, null),
      ).toBe("CONFERE");
    });

    it("a escolha gravada; rascunhos de antes pela pontuação (igual ao declarado = Confere)", () => {
      const de = (lancado, calculado = 0) =>
        escolhaDoBloco(CURSOS, lancado, declarada, calculado);
      expect(de({})).toBeNull();
      expect(de({ situacao: "NAO_ENVIADO" })).toBe("NAO_CONFERE");
      expect(
        de({ situacao: "CONFORME", edita_nota: true, nota_ajustada: 3 }),
      ).toBe("EDITAR");
      expect(
        de({ situacao: "CONFORME", edita_nota: false, nota_ajustada: 1 }),
      ).toBe("CONFERE");
      // Rascunho antigo: o Declarado gravado como ajuste do Apurado = Confere.
      expect(de({ situacao: "CONFORME", nota_ajustada: 3 })).toBe("CONFERE");
      // Rascunho da tela anterior: o Apurado pelos itens, diferente = Editar.
      expect(de({ situacao: "CONFORME" }, 1)).toBe("EDITAR");
      expect(de({ situacao: "CONFORME" }, 3)).toBe("CONFERE");
    });

    it("Confere em Cursos não abre a lista (pela faixa/nota); Não confere não abre nada", () => {
      const comLinha = lancamentoComEscolha({
        bloco: CURSOS,
        lancamento: lancamento(),
        escolha: "CONFERE",
        declarada,
        respostas: ['"3 pontos"'],
      });
      expect(comLinha.cursos).toEqual([]);
      expect(comLinha.blocos.CURSOS.nota_ajustada).toBe(3);
      expect(
        lancamentoComEscolha({
          bloco: CURSOS,
          lancamento: lancamento(),
          escolha: "NAO_CONFERE",
          declarada,
          respostas: [],
        }).cursos,
      ).toEqual([]);
    });
  });

  describe("pelos itens lidos: confirmar pela pontuação dos aceitos", () => {
    it("Confirmar é Confere quando os aceitos dão o declarado; senão Editar nota sem ajuste e sem linha nova", () => {
      expect(escolhaPelosItens(CURSOS, declarada, 3)).toBe("CONFERE");
      expect(escolhaPelosItens(CURSOS, declarada, 2)).toBe("EDITAR");
      expect(escolhaPelosItens(CURSOS, null, 2)).toBe("CONFERE");
      const igual = lancamentoConfirmadoPelosItens({
        bloco: CURSOS,
        lancamento: lancamento(
          {},
          { cursos: [{ nome: "A", horas: 60, aceito: true }] },
        ),
        declarada,
        calculado: 3,
      });
      expect(igual.blocos.CURSOS).toMatchObject({
        situacao: "CONFORME",
        edita_nota: false,
        nota_ajustada: 3,
      });
      const menor = lancamentoConfirmadoPelosItens({
        bloco: CURSOS,
        lancamento: lancamento({
          CURSOS: { situacao: "CONFORME", edita_nota: true, nota_ajustada: 4 },
        }),
        declarada,
        calculado: 1,
      });
      expect(menor.blocos.CURSOS).toMatchObject({
        situacao: "CONFORME",
        edita_nota: true,
        nota_ajustada: null,
      });
      // Nenhuma linha aberta sozinha (os itens estão na conferência).
      expect(menor.cursos ?? []).toEqual([]);
    });

    it("marcar o item extra do cargo (UMCQA) depois do Confere volta a pedir a confirmação (a nota gravada era o declarado)", () => {
      const antes = lancamento(
        {
          CURSOS: { situacao: "CONFORME", edita_nota: false, nota_ajustada: 3 },
        },
        { cursos: [{ nome: "A", horas: 60, aceito: true }] },
      );
      const depois = {
        ...antes,
        blocos: {
          ...antes.blocos,
          CURSOS: { ...antes.blocos.CURSOS, extras: { UMCQA: true } },
        },
      };
      const r = semConfirmacaoSeMudouItens(CURSOS, antes, depois);
      expect(r.blocos.CURSOS.situacao).toBeNull();
      expect(r.blocos.CURSOS.nota_ajustada).toBeNull();
      expect(r.blocos.CURSOS.extras).toEqual({ UMCQA: true });
    });

    it("mexer nos itens depois de confirmar volta a pedir a confirmação; sem mudança nos itens, nada muda", () => {
      const antes = lancamento(
        {
          CURSOS: {
            situacao: "CONFORME",
            edita_nota: true,
            nota_ajustada: null,
            justificativas: ["X"],
          },
        },
        { cursos: [] },
      );
      const depois = {
        ...antes,
        cursos: [{ nome: "A", horas: 60, aceito: true }],
      };
      const r = semConfirmacaoSeMudouItens(CURSOS, antes, depois);
      expect(r.blocos.CURSOS.situacao).toBeNull();
      expect(r.blocos.CURSOS.edita_nota).toBeUndefined();
      expect(r.blocos.CURSOS.justificativas).toEqual(["X"]);
      expect(semConfirmacaoSeMudouItens(CURSOS, antes, { ...antes })).toEqual(
        antes,
      );
      // O Não confere fica.
      const nao = lancamento(
        { CURSOS: { situacao: "NAO_CONFORME", nota_ajustada: 0 } },
        { cursos: [] },
      );
      expect(
        semConfirmacaoSeMudouItens(CURSOS, nao, {
          ...nao,
          cursos: [{ horas: 1 }],
        }).blocos.CURSOS.situacao,
      ).toBe("NAO_CONFORME");
    });
  });
});

bloco("lib/avaliacao-documental-assistente", () => {
  /*
  O assistente da regra da avaliação documental (src/lib/avaliacao-documental/
  assistente-da-regra.ts). Critério de aceite: refazer pelo assistente a regra
  v7 do 93/2026 a partir do modelo PROJ26-CURRICULAR (o da correção, copiado
  em casos-de-pontuacao.json) + as escolhas dá o mesmo JSON da v7 vigente.
  Fixtures sem dado pessoal: a regra (tests/fixtures/avaliacao-documental/
  regra-93-2026-v7.json) e só os NOMES das colunas "Pergunta N - …" da última
  carga das vagas do 93/2026 (colunas-da-empregare-93-2026.json).
*/

  const ler = (arquivo) =>
    JSON.parse(
      readFileSync(`tests/fixtures/avaliacao-documental/${arquivo}`, "utf8"),
    );
  const PROJ26 = ler("casos-de-pontuacao.json").regras["PROJ26-CURRICULAR"];
  const V7 = ler("regra-93-2026-v7.json");
  const VAGAS = ler("colunas-da-empregare-93-2026.json");

  const cartao = (regra, id, opcoes) =>
    cartoesDaRegra(regra, opcoes).find((c) => c.id === id);

  /* As escolhas da coordenação no assistente, como a tela faz. */
  function refazerA_v7() {
    // 1. Ponto de partida: o modelo, com o rótulo deste edital.
    let regra = regraDoPontoDePartida(
      { tipo: "modelo", codigo: "PROJ26-CURRICULAR", configuracao: PROJ26 },
      { editalRotulo: "Edital 93/2026" },
    );
    // 2. Cardápio: o questionário não finalizado elimina (decisão da CORES).
    const contexto = { fontes: [PROJ26], guardados: {} };
    const questionario = cartao(regra, "eliminacao:QUESTIONARIO", {
      area: "projetos",
    });
    expect(questionario.marcado).toBe(false);
    ({ regra } = alternarCartao(regra, questionario, true, contexto));
    regra = comEliminacao(regra, questionario, {
      ...eliminacaoDoCartao(regra, questionario),
      motivo: "Não finalizou o questionário (decisão da coordenação CORES)",
    });
    // O corte por pontos mínimos já vem do modelo (15, item 8.2.6). É da
    // Triagem: o assistente não tem mais o cartão do corte e leva o lote igual.
    expect(cartao(regra, "corte")).toBeUndefined();
    expect(regra.lote).toMatchObject({ base: "NOTA_MINIMA", nota_minima: 15 });

    // 3. Perguntas da Empregare: as que a coordenação escolheu na lista.
    const ligar = (codigo, textos) => {
      for (const texto of textos) {
        const ligacao = ligacoesDaRegra(regra).find(
          (l) => l.grupo === "bloco" && l.codigo === codigo,
        );
        regra = comPergunta(regra, ligacao, texto, { adicionar: true });
      }
    };
    ligar("IDENTIDADE", [
      "Anexe o documento de identificação",
      "Anexe um documento de identificação",
    ]);
    ligar("ESCOLARIDADE", [
      "Você possui Graduação na área da vaga",
      "Você possui Ensino Médio completo e Curso Técnico",
      "Anexe a comprovação de Nível",
      "Anexe a comprovação de conclusão do Ensino Médio",
    ]);
    ligar("REGISTRO_CONSELHO", [
      "Você possui registro profissional ativo",
      "Anexe o comprovante do seu registro profissional",
    ]);
    ligar("COTA_PP", [
      "Candidatos às vagas destinadas a Pretos ou Pardos",
      "Candidatos concorrendo às vagas destinadas a Pretos ou Pardos",
    ]);
    ligar("COTA_PCD", [
      "Os candidatos que concorrem às vagas destinadas a PcD",
    ]);
    ligar("COTA_PI", ["Para candidatos que se declaram indígenas"]);
    ligar("COTA_PQ", ["Para candidatos que se declaram quilombolas"]);
    ligar("FORMACAO", [
      "Qual seu Nível de Titulação Acadêmica",
      "Anexe seu comprovante de Titulação Acadêmica",
    ]);
    ligar("CURSOS", [
      "Selecione a pontuação relativa à carga horária de Cursos",
      "Anexe os seus Certificados de Conclusão dos Cursos",
    ]);
    ligar("EXPERIENCIA", [
      "Experiência Profissional em atividades",
      "Anexe o comprovante de Experiência Profissional",
    ]);

    // Nota declarada: titulação, cursos e experiência (por nível) valem pontos.
    for (const parcial of ["FORMACAO", "CURSOS", "EXPERIENCIA"])
      regra = alternarDeclarada(regra, parcial, true);
    const declarada = regra.provisoria.nota_declarada;
    const [formacao, cursos, experiencia] = V7.provisoria.nota_declarada;
    regra = comItemDaDeclarada(regra, 0, {
      ...declarada[0],
      pontos: formacao.pontos,
    });
    regra = comItemDaDeclarada(regra, 1, {
      ...declarada[1],
      pontos: cursos.pontos,
    });
    const { pontos: _semPontos, ...itemDaExperiencia } = declarada[2];
    regra = comItemDaDeclarada(regra, 2, {
      ...itemDaExperiencia,
      pergunta: "Experiência Profissional",
      pontos_por_nivel: experiencia.pontos_por_nivel,
    });
    // O desempate pela experiência declarada (a pergunta) e a base da nota do
    // lote são da Triagem: o assistente não os mostra; na v7 vieram assim.
    expect(ligacoesDaRegra(regra).some((l) => l.id === "experiencia")).toBe(
      false,
    );
    regra = {
      ...regra,
      provisoria: {
        ...regra.provisoria,
        pergunta_experiencia: "Experiência Profissional",
        base_da_nota: "DECLARADA",
      },
    };
    return regra;
  }

  describe("critério de aceite: a v7 do 93/2026 pelo assistente", () => {
    it("PROJ26 + as escolhas = a v7 vigente (mesmo JSON, válido)", () => {
      const regra = refazerA_v7();
      expect(validarRegraAnalise(regra)).toEqual([]);
      expect(regrasIguais(regra, V7)).toBe(true);
    });

    it("as perguntas da v7 nas colunas do 93/2026: verdes, e a da cota PP ambígua", () => {
      const situacoes = Object.fromEntries(
        ligacoesDaRegra(V7).map((l) => [
          l.id,
          situacaoDaPergunta(l.pergunta, VAGAS),
        ]),
      );
      expect(situacoes["declarada:2"].situacao).toBe("achou");
      expect(situacoes["declarada:2"].comUma).toBe(5);
      // A pergunta da experiência do desempate é da Triagem: não é ligação aqui.
      expect(situacoes.experiencia).toBeUndefined();
      expect(situacoes["bloco:EXPERIENCIA:0"].situacao).toBe("achou");
      // "Você possui Graduação…" só existe nas 3 vagas de nível superior.
      expect(situacoes["bloco:ESCOLARIDADE:0"]).toMatchObject({
        situacao: "achou",
        comUma: 3,
      });
      // O &nbsp; da Empregare vira espaço: "Candidatos concorrendo…" casa com duas colunas.
      expect(situacoes["bloco:COTA_PP:1"].situacao).toBe("ambigua");
      expect(situacoes["bloco:COTA_PP:1"].ambiguas[0].colunas).toHaveLength(2);
    });
  });

  describe("ponto de partida", () => {
    it("sempre uma cópia independente; de outro edital sai o lote por vaga e entra o rótulo deste", () => {
      const outro = { ...V7, lote: { ...V7.lote, por_vaga: { 177001: 12 } } };
      const regra = regraDoPontoDePartida(
        { tipo: "edital", edital: "93/2026", versao: 7, configuracao: outro },
        { editalRotulo: "Edital 114/2026" },
      );
      expect(regra.edital_rotulo).toBe("Edital 114/2026");
      expect(regra.lote.por_vaga).toBeUndefined();
      regra.blocos[0].titulo = "mudou";
      expect(V7.blocos[0].titulo).not.toBe("mudou");
      expect(
        motivoDoPontoDePartida({
          tipo: "edital",
          edital: "93/2026",
          versao: 7,
        }),
      ).toBe("Criada no assistente a partir da regra v7 do edital 93/2026");
    });

    it("do zero: nenhum bloco, e a validação pede ao menos um", () => {
      const regra = regraDoPontoDePartida(
        { tipo: "zero" },
        { editalRotulo: "Edital 1/2026" },
      );
      expect(regra.blocos).toEqual([]);
      expect(validarRegraAnalise(regra)).toContain("De 1 a 40 blocos.");
    });
  });

  describe("cardápio", () => {
    const base = () =>
      regraDoPontoDePartida({
        tipo: "modelo",
        codigo: "PROJ26-CURRICULAR",
        configuracao: PROJ26,
      });

    it("o critério étnico só aparece na Saúde Indígena", () => {
      const regra = base();
      expect(
        cartao(regra, "bloco:ETNICO", { area: "projetos" }),
      ).toBeUndefined();
      expect(
        cartao(regra, "bloco:ETNICO", { area: "saude-indigena" }).marcado,
      ).toBe(false);
    });

    it("desmarcar some com o bloco; marcar de novo volta igual", () => {
      let regra = base();
      let guardados = {};
      const cursos = cartao(regra, "bloco:CURSOS");
      ({ regra, guardados } = alternarCartao(regra, cursos, false, {
        guardados,
      }));
      expect(regra.blocos.some((b) => b.tipo === "CURSOS")).toBe(false);
      ({ regra, guardados } = alternarCartao(regra, cursos, true, {
        guardados,
      }));
      expect(regrasIguais(regra, base())).toBe(true);
      expect(guardados).toEqual({});
    });

    it("marcar traz os valores sugeridos da fonte (sem peso no código)", () => {
      const si = { ...PROJ26, blocos: [] };
      const etnico = {
        codigo: "ETNICO",
        titulo: "Critério étnico",
        tipo: "PONTUACAO",
        parcial: "ETNICO",
        condicao: "INDIGENA",
        indigena: 8,
        aldeia: 6,
        teto: 14,
        perguntas: [],
        efeitos: {},
        motivos: [],
      };
      const fonte = { ...PROJ26, blocos: [etnico] };
      const regra = regraDoPontoDePartida({
        tipo: "modelo",
        codigo: "X",
        configuracao: si,
      });
      const c = cartao(regra, "bloco:ETNICO", { area: "saude-indigena" });
      const comFonte = alternarCartao(regra, c, true, {
        fontes: [fonte],
      }).regra;
      expect(comFonte.blocos[0]).toMatchObject({
        indigena: 8,
        aldeia: 6,
        teto: 14,
      });
      const semFonte = alternarCartao(regra, c, true).regra;
      expect(semFonte.blocos[0]).toMatchObject({
        indigena: 0,
        aldeia: 0,
        tipo: "PONTUACAO",
      });
    });

    it("bloco novo entra na ordem dos tipos (documentos antes das cotas e dos pontos)", () => {
      let regra = base();
      const identidade = cartao(regra, "bloco:IDENTIDADE");
      ({ regra } = alternarCartao(regra, identidade, false));
      ({ regra } = alternarCartao(regra, identidade, true));
      expect(regra.blocos.map((b) => b.tipo).slice(0, 4)).toEqual([
        "DOCUMENTO",
        "DOCUMENTO",
        "DOCUMENTO",
        "COTA",
      ]);
    });

    it("o corte por pontos mínimos é da Triagem: sem cartão, e o lote passa igual", () => {
      let regra = base();
      let guardados = {};
      const lote = structuredClone(regra.lote);
      const cartoes = cartoesDaRegra(regra);
      expect(cartoes.some((c) => c.id === "corte")).toBe(false);
      expect(
        cartoes.filter((c) => c.grupo === "inscricao").map((c) => c.id),
      ).toEqual(cartoes.filter((c) => c.eliminacao).map((c) => c.id));
      for (const c of cartoes)
        ({ regra, guardados } = alternarCartao(regra, c, !c.marcado, {
          guardados,
        }));
      expect(regra.lote).toEqual(lote);
    });

    it("código de motivo a partir do texto", () => {
      expect(codigoDoTexto("Sem frente e verso")).toBe("SEM_FRENTE_E_VERSO");
      expect(codigoDoTexto("Sem frente e verso", ["SEM_FRENTE_E_VERSO"])).toBe(
        "SEM_FRENTE_E_VERSO_2",
      );
    });
  });

  describe("perguntas da Empregare", () => {
    it("lista as perguntas da carga sem repetir, com em quantas vagas aparecem", () => {
      const opcoes = opcoesDePerguntas(VAGAS);
      const experiencia = opcoes.find((o) =>
        o.texto.startsWith("Experiência Profissional em atividades"),
      );
      expect(experiencia.vagas).toBe(5);
      expect(
        sugerirPerguntas(["titulacao academica"], VAGAS).map((o) => o.texto),
      ).toEqual([
        "Qual seu Nível de Titulação Acadêmica",
        "Anexe seu comprovante de Titulação Acadêmica.",
      ]);
    });

    it("vermelho quando nenhuma vaga tem; sem carga, não decide", () => {
      expect(
        situacaoDaPergunta("Pergunta que não existe", VAGAS).situacao,
      ).toBe("nao_achou");
      expect(situacaoDaPergunta("Experiência", []).situacao).toBe("sem_carga");
      expect(situacaoDaPergunta("", VAGAS).situacao).toBe("vazia");
    });

    it("liga sozinho o bloco sem pergunta, pelo enunciado, e não mexe no que já está ligado", () => {
      const regra = regraDoPontoDePartida({
        tipo: "modelo",
        codigo: "PROJ26-CURRICULAR",
        configuracao: PROJ26,
      });
      const { regra: ligada, ligadas } = ligarAutomaticamente(regra, VAGAS);
      expect(ligadas).toBeGreaterThan(5);
      const formacao = ligada.blocos.find((b) => b.codigo === "FORMACAO");
      expect(formacao.perguntas[0]).toBe(
        "Qual seu Nível de Titulação Acadêmica",
      );
      for (const l of ligacoesDaRegra(ligada).filter(
        (x) => x.grupo === "bloco" && x.pergunta,
      ))
        expect(situacaoDaPergunta(l.pergunta, VAGAS).situacao, l.id).not.toBe(
          "nao_achou",
        );
      const outraVez = ligarAutomaticamente(ligada, VAGAS);
      expect(outraVez.ligadas).toBe(0);
    });

    it("as respostas da carga da pergunta (sem aspas), somadas entre colunas", () => {
      const carga = [
        {
          coluna:
            "Pergunta 11 - Experiência Profissional em atividades compatíveis",
          respostas: [
            { valor: '"1 ano"', quantidade: 3 },
            { valor: '"2 anos"', quantidade: 2 },
          ],
          outras: 0,
        },
        {
          coluna:
            "Pergunta 12 - Experiência Profissional em atividades compatíveis",
          respostas: [{ valor: '"1 ano"', quantidade: 4 }],
          outras: 0,
        },
      ];
      expect(respostasDaPergunta("Experiência Profissional", carga)).toEqual([
        { valor: "1 ano", quantidade: 7 },
        { valor: "2 anos", quantidade: 2 },
      ]);
    });

    it("pergunta da carga marcada como dado pessoal: sem respostas e avisada", () => {
      const carga = [
        {
          coluna: "Pergunta 2 - Informe seu CPF",
          respostas: [],
          outras: 40,
          distintas: 40,
          dado_pessoal: true,
        },
        {
          coluna: "Pergunta 5 - Sistema de concorrência",
          respostas: [{ valor: "PcD", quantidade: 3 }],
          outras: 0,
        },
      ];
      expect(perguntaComDadoPessoal("Informe seu CPF", carga)).toBe(true);
      expect(respostasDaPergunta("Informe seu CPF", carga)).toEqual([]);
      expect(perguntaComDadoPessoal("Sistema de concorrência", carga)).toBe(
        false,
      );
      expect(perguntaComDadoPessoal("", carga)).toBe(false);
    });

    it("desligar a última nota declarada volta a base do lote para a ART", () => {
      let regra = refazerA_v7();
      for (const parcial of ["FORMACAO", "CURSOS", "EXPERIENCIA"])
        regra = alternarDeclarada(regra, parcial, false);
      expect(regra.provisoria.base_da_nota).toBe("ART");
      expect(validarRegraAnalise(regra)).toEqual([]);
    });
  });

  describe("desempate", () => {
    it("move na lista sem mudar a original", () => {
      const lista = ["IDOSO", "EXPERIENCIA_DECLARADA", "MAIOR_IDADE"];
      expect(moverNaLista(lista, 2, 0)).toEqual([
        "MAIOR_IDADE",
        "IDOSO",
        "EXPERIENCIA_DECLARADA",
      ]);
      expect(lista[0]).toBe("IDOSO");
      expect(moverNaLista(lista, 0, 5)).toEqual(lista);
    });
  });

  describe("resumo de uma página", () => {
    it("o que elimina, quanto vale cada item, corte e desempate, em frases simples", () => {
      const resumo = resumoDaRegra(V7, {
        versao: 7,
        notaMinima: 15,
        desempateDaClassificacao: [
          "60 anos ou mais na data de corte",
          "Maior idade",
        ],
      });
      expect(resumo.subtitulo).toBe("Edital 93/2026 · Versão 7");
      const texto = textoDoResumo(resumo);
      expect(texto).toContain(
        "- Documento de identificação oficial com foto (item 6.5): não enviado ou não conforme elimina.",
      );
      expect(texto).toContain(
        "Titulação acadêmica (a maior), nível superior: Especialização 5, Mestrado 8, Doutorado 10.",
      );
      expect(texto).toContain(
        "Experiência na área ou no SUS: 5 pontos a cada 6 meses além do mínimo, até 35 pontos.",
      );
      expect(texto).toContain(
        "Lote: todos com pelo menos 15 pontos pela nota declarada na inscrição (item 8.2.6).",
      );
      expect(texto).toContain(
        "Na inscrição: Não finalizou o questionário (decisão da coordenação CORES) (colunas SITUAÇÃO -… diferente de FINALIZADO).",
      );
      expect(texto).toContain(
        "Classificação: 1º 60 anos ou mais na data de corte; 2º Maior idade.",
      );
      expect(texto).toContain(
        "Lista do lote (Provisória): 1º Idade de 60 anos ou mais",
      );
    });

    it("o HTML do SEI escapa o texto da regra", () => {
      const regra = { ...V7, titulo_etapa: "Etapa <b>" };
      const html = htmlDoResumo(resumoDaRegra(regra));
      expect(html).toContain("Regra da Etapa &lt;b&gt;");
      expect(html).not.toContain("<b>");
    });
  });

  describe("comparar versões", () => {
    it("diz o que entrou, saiu e mudou, com o nome de cada coisa", () => {
      const frases = diferencasEntreRegras(PROJ26, V7).map(fraseDaDiferenca);
      expect(frases).toContain("edital no parecer: — → Edital 93/2026");
      expect(frases).toContain(
        'Entrou: Provisória › eliminação automática › eliminação "Não finalizou o questionário (decisão da coordenação CORES)"',
      );
      expect(frases).toContain(
        "Provisória › nota do corte e da ordem do lote: ART → DECLARADA",
      );
      expect(frases).toContain(
        "Titulação acadêmica (a maior) › perguntas: — → Qual seu Nível de Titulação Acadêmica; Anexe seu comprovante de Titulação Acadêmica",
      );
    });

    it("regras iguais: nenhuma diferença", () => {
      expect(diferencasEntreRegras(V7, structuredClone(V7))).toEqual([]);
    });

    it("teto que muda num bloco", () => {
      const depois = structuredClone(V7);
      depois.blocos.find((b) => b.codigo === "CURSOS").teto = 6;
      expect(diferencasEntreRegras(V7, depois).map(fraseDaDiferenca)).toEqual([
        "Cursos de aperfeiçoamento na área da vaga (mínimo 40h) › teto: 5 → 6",
      ]);
    });
  });
});

bloco("lib/avaliacao-documental-calculo-no-banco", () => {
  /*
  Casos dourados do cálculo dos itens e das pendências da ficha, nos três
  lados: a tela (aqui), o Python (tests/python/test_calculo_no_banco.py) e o
  banco (o ensaio de supabase/ensaios/20261023090000_calculo_conferido_no_banco.sql
  leva o mesmo JSON; tests/calculo-conferido-no-banco-migration.test.js
  confere). Cada caso diz o lançamento, a declarada e, se houver, a data
  limite do bloco de vínculos; o resultado gravado, a conta e as pendências
  saem da tela. `banco` traduz as pendências para os trechos que
  FC_PENDENCIAS_FICHA devolve e diz se FC_VALIDAR_RESULTADO_FICHA recusa.
  Mudou a regra de propósito: ATUALIZAR_DOURADOS=1 npx vitest run <este arquivo>
  regrava o JSON (confira o diff).
*/
  const ARQUIVO =
    "tests/fixtures/avaliacao-documental/casos-do-calculo-no-banco.json";
  const DOURADOS = JSON.parse(readFileSync(ARQUIVO, "utf8"));

  const NO_BANCO = {
    acima: "acima do que",
    datas: "vínculo com",
    justificativa: "nota diferente da declarada",
  };

  /** A regra do caso: a do arquivo, com a data limite do caso no bloco de vínculos. */
  function regraDoCaso(regra, caso) {
    if (!caso.data_limite) return regra;
    return {
      ...regra,
      blocos: regra.blocos.map((b) =>
        b.tipo === "VINCULOS" ? { ...b, data_limite: caso.data_limite } : b,
      ),
    };
  }

  function calcular(caso) {
    const regra = regraDoCaso(DOURADOS.regra, caso);
    const av = calcularFicha(regra, caso.lancamento, DOURADOS.documental);
    const pendencias = pendenciasDaFicha(
      regra,
      caso.lancamento,
      av,
      caso.declarada,
      { hoje: DOURADOS.hoje },
    ).map((p) => ({ bloco: p.bloco, tipo: p.tipo }));
    const blocos = caso.lancamento.blocos;
    return {
      resultado: resumoParaGravar(av, caso.declarada),
      esperado: {
        calculados: av.calculados,
        parciais: av.parciais,
        resultado: av.resultado,
        experiencia: {
          dias_total: av.experiencia.dias_total,
          meses: av.experiencia.meses,
          meses_considerados: av.experiencia.meses_considerados,
        },
        pendencias,
        banco: {
          pendencias: pendencias.map((p) =>
            p.tipo === "minimo"
              ? blocos[p.bloco].situacao === "CONFORME"
                ? "experiência mínima"
                : "marcada como"
              : NO_BANCO[p.tipo],
          ),
          recusa:
            pendencias.some((p) => p.tipo === "acima") &&
            av.resultado !== "INAPTO_REQUISITO"
              ? "acima do que os itens registrados dão"
              : null,
        },
      },
    };
  }

  describe("casos dourados do cálculo conferido no banco", () => {
    if (process.env.ATUALIZAR_DOURADOS === "1") {
      it("regrava o arquivo", () => {
        const casos = DOURADOS.casos.map((c) => ({ ...c, ...calcular(c) }));
        writeFileSync(
          ARQUIVO,
          `${JSON.stringify({ ...DOURADOS, casos }, null, 2)}\n`,
        );
      });
      return;
    }

    it("tem os casos que importam", () => {
      const tipos = DOURADOS.casos.flatMap((c) =>
        c.esperado.pendencias.map((p) => p.tipo),
      );
      for (const tipo of ["acima", "minimo", "datas"])
        expect(tipos).toContain(tipo);
      expect(DOURADOS.casos.some((c) => c.data_limite)).toBe(true);
    });

    for (const caso of DOURADOS.casos)
      it(caso.nome, () => {
        const { resultado, esperado } = calcular(caso);
        expect(esperado).toEqual(caso.esperado);
        expect(resultado).toEqual(caso.resultado);
      });
  });
});

bloco("lib/avaliacao-documental-catalogo-de-desempate", () => {
  /*
  O passo 2 começa por "Na inscrição" e o passo 4 mostra o catálogo INTEIRO
  de desempate (classificação e Provisória), em grupos e com busca.
*/
  describe("cardápio do assistente", () => {
    it("o grupo Na inscrição vem primeiro, antes de requisitos, pontos e cotas", () => {
      expect(GRUPOS_DO_CARDAPIO.map(([g]) => g)).toEqual([
        "inscricao",
        "eliminatorios",
        "pontos",
        "cotas",
      ]);
    });
  });

  describe("catálogo de desempate", () => {
    it("a classificação oferece todos os critérios do catálogo, em grupos", () => {
      const grupos = catalogoAgrupado(CRITERIOS_DA_CLASSIFICACAO, []);
      const codigos = grupos.flatMap((g) => g.itens.map((i) => i.codigo));
      expect(codigos.sort()).toEqual(
        CATALOGO_DE_CRITERIOS.map((c) => c.codigo).sort(),
      );
      expect(grupos.map((g) => g.titulo)).toEqual(
        GRUPOS_DE_DESEMPATE.map(([, t]) => t),
      );
      const doGrupo = (grupo) =>
        grupos.find((g) => g.grupo === grupo).itens.map((i) => i.codigo);
      expect(doGrupo("legal")).toEqual([
        "IDOSO_60",
        "INDIGENA_COMPROVADO",
        "PCD",
      ]);
      expect(doGrupo("idade")).toEqual(["MAIOR_IDADE"]);
      expect(doGrupo("experiencia")).toContain("EXP_SAUDE_INDIGENA");
      expect(doGrupo("experiencia")).toContain("EXP_ATENCAO_BASICA");
      expect(doGrupo("pontuacao")).toEqual(
        expect.arrayContaining([
          "NOTA_DOCUMENTAL",
          "NOTA_ENTREVISTA",
          "PONTUACAO_ETNICA",
          "PONTUACAO_EXPERIENCIA",
          "PONTUACAO_FORMACAO",
          "PONTUACAO_CURSOS",
          "NOTA_CONHECIMENTOS_ESPECIFICOS",
        ]),
      );
      expect(doGrupo("outros")).toEqual(["MAIOR_ESCOLARIDADE"]);
    });

    it("marca os já usados com a posição e busca sem acento", () => {
      const grupos = catalogoAgrupado(CRITERIOS_DA_CLASSIFICACAO, [
        "NOTA_DOCUMENTAL",
        "IDOSO_60",
      ]);
      const item = (codigo) =>
        grupos.flatMap((g) => g.itens).find((i) => i.codigo === codigo);
      expect(item("IDOSO_60").posicao).toBe(2);
      expect(item("NOTA_DOCUMENTAL").posicao).toBe(1);
      expect(item("PCD").posicao).toBeNull();
      const busca = catalogoAgrupado(CRITERIOS_DA_CLASSIFICACAO, [], "saude");
      expect(busca.flatMap((g) => g.itens.map((i) => i.codigo))).toEqual([
        "EXP_SAUDE_INDIGENA",
        "EXP_SAUDE_DIGITAL",
      ]);
      expect(catalogoAgrupado(CRITERIOS_DA_CLASSIFICACAO, [], "zzz")).toEqual(
        [],
      );
    });

    it("a Provisória tem o próprio catálogo (o que a base Python calcula), inteiro", () => {
      const grupos = catalogoAgrupado(CRITERIOS_DA_PROVISORIA, ["IDOSO"]);
      expect(
        grupos.flatMap((g) => g.itens.map((i) => i.codigo)).sort(),
      ).toEqual(DESEMPATES_DA_PROVISORIA.map(([c]) => c).sort());
      expect(grupos.map((g) => g.grupo)).toEqual([
        "legal",
        "experiencia",
        "idade",
        "outros",
      ]);
    });
  });
});

bloco("lib/avaliacao-documental-comprovado-da-ficha", () => {
  /*
  A ficha no item Experiência (retorno do teste de 09/10): o tempo COMPROVADO
  pelos vínculos aceitos (a mesma conta da pontuação), a prévia na lateral, as
  justificativas do bloco primeiro e o POR QUÊ do Inapto. O caso "TREINO-P02"
  reproduz a ficha concluída do treinamento 992/2099: seis itens Conforme,
  nenhum vínculo lançado e o Inapto (requisito) sem motivo na tela. Dados
  fictícios.
*/
  const CASOS = JSON.parse(
    readFileSync(
      "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
      "utf8",
    ),
  );
  const REGRA = CASOS.regras["PROJ26-CURRICULAR"];
  const DOCUMENTAL = { nota_minima: 15, nota_minima_por_nivel: {} };
  const EXPERIENCIA = REGRA.blocos.find((b) => b.codigo === "EXPERIENCIA");
  const vinculo = (inicio, fim, extra = {}) => ({
    empregador: "Empresa fictícia",
    categoria: "AREA_OU_SUS",
    inicio,
    fim,
    aceito: true,
    ...extra,
  });
  const candidato = (vinculos) => ({ nivel: "superior", vinculos });

  describe("tempo comprovado pelos vínculos", () => {
    it("um vínculo: anos, meses e dias, meses inteiros e os pontos da regra", () => {
      const exp = apurarExperiencia(
        EXPERIENCIA,
        candidato([vinculo("2024-02-08", "2026-10-01")]),
      );
      expect(exp.dias_total).toBe(967);
      const c = comprovadoDaExperiencia(EXPERIENCIA, exp, "superior");
      expect(c.texto).toBe("Comprovado: 2 anos, 7 meses e 27 dias (32 meses)");
      expect(c.detalhe).toBe(
        "Além do mínimo de 6 meses: 26 meses → 4 períodos de 6 meses → 20 pontos",
      );
      expect(c.abaixoDoMinimo).toBe(false);
      expect(exp.pontos).toBe(20);
    });

    it("sobreposição conta uma vez e o dia seguinte emenda (igual à pontuação)", () => {
      const vinculos = [
        vinculo("2020-01-01", "2020-12-31"),
        vinculo("2020-06-01", "2021-03-31"), // sobrepõe
        vinculo("2021-04-01", "2021-06-29"), // emenda no dia seguinte
        vinculo("2023-01-01", "2023-01-30", { aceito: false, motivo: "X" }),
      ];
      const exp = apurarExperiencia(EXPERIENCIA, candidato(vinculos));
      expect(exp.dias_total).toBe(546);
      expect(exp.meses).toBe(18);
      const c = comprovadoDaExperiencia(EXPERIENCIA, exp, "superior");
      expect(c.texto).toBe("Comprovado: 1 ano, 6 meses e 1 dia (18 meses)");
      expect(c.detalhe).toContain(
        "12 meses → 2 períodos de 6 meses → 10 pontos",
      );
      // o mesmo número que a ficha grava
      const avaliacao = calcularFicha(
        REGRA,
        { ...candidato(vinculos), modalidade: "AC", blocos: {} },
        DOCUMENTAL,
      );
      expect(avaliacao.parciais.EXPERIENCIA).toBe(exp.pontos);
    });

    it("sem vínculo e abaixo do mínimo; teto no nível da vaga", () => {
      const zero = comprovadoDaExperiencia(
        EXPERIENCIA,
        apurarExperiencia(EXPERIENCIA, candidato([])),
        "superior",
      );
      expect(zero.texto).toBe("Comprovado: 0 meses");
      expect(zero.detalhe).toBe("Abaixo do mínimo de 6 meses (item 1.1.1 c)");
      expect(zero.abaixoDoMinimo).toBe(true);
      const longo = apurarExperiencia(
        EXPERIENCIA,
        candidato([vinculo("2000-01-01", "2020-12-31")]),
      );
      expect(
        comprovadoDaExperiencia(EXPERIENCIA, longo, "superior").detalhe,
      ).toMatch(/35 pontos \(teto\)$/);
      expect(textoDoTempo(0)).toBe("0 dias");
    });

    it("cursos e títulos: só os aceitos", () => {
      expect(
        comprovadoDosCursos([
          { horas: 40, aceito: true },
          { horas: 60 },
          { horas: 40, aceito: true },
          { horas: 100, aceito: false },
        ]).texto,
      ).toBe("Comprovado: 3 cursos, 140 h");
      expect(comprovadoDosCursos([]).texto).toBe(
        "Comprovado: nenhum curso aceito",
      );
      expect(
        comprovadoDosTitulos([{ titulo: "MESTRADO", aceito: true }], {
          MESTRADO: "Mestrado",
        }).texto,
      ).toBe("Comprovado: 1 título (Mestrado)");
    });
  });

  describe("prévia na lateral", () => {
    it("item sem decisão entra com a prévia; a nota parcial soma as prévias", () => {
      const lancamento = {
        nivel: "superior",
        modalidade: "AC",
        blocos: { CURSOS: { situacao: "CONFORME", nota_ajustada: 3 } },
        titulos: [],
        cursos: [],
        vinculos: [vinculo("2024-02-08", "2026-10-01")],
      };
      const declarada = {
        parciais: { FORMACAO: 5, CURSOS: 3, EXPERIENCIA: 15 },
      };
      const avaliacao = calcularFicha(REGRA, lancamento, DOCUMENTAL);
      const partes = composicaoComPrevias(
        composicaoDaNota(REGRA, lancamento, avaliacao, declarada),
        REGRA.blocos,
        lancamento,
        avaliacao.calculados,
      );
      const por = Object.fromEntries(partes.map((p) => [p.bloco, p]));
      expect(por.CURSOS).toMatchObject({ apurado: 3, previa: null });
      // com vínculo lançado, a prévia é o Calculado (20), não o declarado (15)
      expect(por.EXPERIENCIA).toMatchObject({ apurado: null, previa: 20 });
      // sem itens, a prévia é o calculado (0): o declarado não preenche o Apurado
      expect(por.FORMACAO).toMatchObject({ apurado: null, previa: 0 });
      expect(notaComPrevias(partes)).toEqual({ nota: 23, comPrevia: true });
      expect(notaComPrevias([{ apurado: 2, previa: null }])).toEqual({
        nota: 2,
        comPrevia: false,
      });
    });
  });

  describe("justificativas por bloco", () => {
    it("Experiência: os motivos do bloco e a observação de experiência; o resto em outras", () => {
      const { doBloco, outras } = justificativasDoBloco(REGRA, EXPERIENCIA);
      expect(doBloco.map((o) => o.codigo)).toEqual([
        "ANTES_DO_DIPLOMA",
        "ESTAGIO_OU_SIMILAR",
        "EXPERIENCIA_DIMINUIDA",
      ]);
      expect(outras.map((o) => o.codigo)).toEqual([
        "ALTERACAO_DE_NOME",
        "CURSOS_DIMINUIDA",
      ]);
    });

    it("Cursos e Titulação ficam com as do seu assunto", () => {
      const cursos = REGRA.blocos.find((b) => b.codigo === "CURSOS");
      expect(
        justificativasDoBloco(REGRA, cursos).doBloco.map((o) => o.codigo),
      ).toContain("CURSOS_DIMINUIDA");
      expect(
        justificativasDoBloco(REGRA, cursos).doBloco.map((o) => o.codigo),
      ).not.toContain("EXPERIENCIA_DIMINUIDA");
    });

    it("o rótulo vale antes do texto (alteração de nome é de Identidade)", () => {
      expect(
        assuntoDaObservacao({
          codigo: "ALTERACAO_DE_NOME",
          rotulo: "Alteração de nome sem documento",
          texto: "títulos e experiências em outro nome foram desconsiderados",
        }),
      ).toBe("IDENTIDADE");
      expect(assuntoDaObservacao({ codigo: "GERAL", rotulo: "Outro" })).toBe(
        null,
      );
    });
  });

  describe("caso TREINO-P02: Inapto com o motivo", () => {
    // A ficha gravada: seis itens Conforme, Apurado = declarado, nenhum vínculo.
    const LANCAMENTO = {
      nivel: "superior",
      modalidade: "AC",
      indigena: false,
      mora_aldeia: false,
      aldeia_na_lista: false,
      estagio_horas: 0,
      blocos: {
        IDENTIDADE: { motivos: [], situacao: "CONFORME" },
        ESCOLARIDADE: { motivos: [], situacao: "CONFORME" },
        REGISTRO_CONSELHO: { motivos: [], situacao: "CONFORME" },
        FORMACAO: { motivos: [], situacao: "CONFORME", nota_ajustada: 5 },
        CURSOS: { motivos: [], situacao: "CONFORME", nota_ajustada: 3 },
        EXPERIENCIA: { motivos: [], situacao: "CONFORME", nota_ajustada: 15 },
      },
      titulos: [],
      cursos: [],
      vinculos: [],
      observacoes_prontas: [],
    };
    const declarada = { parciais: { FORMACAO: 5, CURSOS: 3, EXPERIENCIA: 15 } };

    it("a causa: a experiência mínima conta só os vínculos lançados (0 meses)", () => {
      const avaliacao = calcularFicha(REGRA, LANCAMENTO, DOCUMENTAL);
      expect(avaliacao.resultado).toBe("INAPTO_REQUISITO");
      expect(avaliacao.nota_apurada).toBe(23);
      expect(avaliacao.nota_final).toBe(0);
      expect(avaliacao.eliminatorios).toEqual([
        "Item 1.1.1 c: não comprovou a experiência profissional mínima de 6 meses.",
      ]);
    });

    it("não conclui em silêncio: Conforme sem registro pede o título e o vínculo (cursos pela faixa/nota, sem lista)", () => {
      const avaliacao = calcularFicha(REGRA, LANCAMENTO, DOCUMENTAL);
      const pendencias = pendenciasDaFicha(
        REGRA,
        LANCAMENTO,
        avaliacao,
        declarada,
      );
      expect(pendencias.map((p) => [p.bloco, p.tipo])).toEqual([
        ["FORMACAO", "comprovado"],
        ["EXPERIENCIA", "comprovado"],
      ]);
      expect(pendencias[1].texto).toBe(
        "Registre ao menos um vínculo com início e fim.",
      );
    });

    it("vínculo registrado abaixo do mínimo: pede o mínimo (! no stepper)", () => {
      const lancamento = {
        ...LANCAMENTO,
        vinculos: [vinculo("2026-01-01", "2026-03-31")],
      };
      const avaliacao = calcularFicha(REGRA, lancamento, DOCUMENTAL);
      const pendencias = pendenciasDaFicha(
        REGRA,
        lancamento,
        avaliacao,
        declarada,
      ).filter((p) => p.bloco === "EXPERIENCIA");
      expect(pendencias).toEqual([
        {
          bloco: "EXPERIENCIA",
          tipo: "minimo",
          texto:
            "Experiência mínima de 6 meses não comprovada (comprovado 3 meses): registre os vínculos que comprovam ou escolha Não confere.",
        },
      ]);
      expect(
        conferenciaDaFicha(REGRA, lancamento, avaliacao, pendencias)
          .texto_da_falta,
      ).toBe("Falta: Experiência Profissional (experiência mínima)");
    });

    it("a tela diz por quê, com o item", () => {
      const avaliacao = calcularFicha(REGRA, LANCAMENTO, DOCUMENTAL);
      expect(
        motivosDoResultado(
          REGRA.blocos,
          LANCAMENTO,
          avaliacao,
          avaliacao.resultado,
        ),
      ).toEqual([
        {
          bloco: "EXPERIENCIA",
          texto:
            "Experiência mínima de 6 meses não comprovada (comprovado 0 meses) — item 1.1.1 c",
        },
      ]);
    });

    it("com o vínculo lançado, comprova o mínimo e fica Apto", () => {
      const lancamento = {
        ...LANCAMENTO,
        vinculos: [vinculo("2024-02-08", "2026-10-01")],
      };
      const avaliacao = calcularFicha(REGRA, lancamento, DOCUMENTAL);
      expect(avaliacao.resultado).toBe("APTO");
      expect(
        pendenciasDaFicha(REGRA, lancamento, avaliacao, declarada).filter(
          (p) => p.tipo === "minimo",
        ),
      ).toEqual([]);
    });

    it("motivo de bloco eliminatório e nota mínima", () => {
      const lancamento = {
        ...LANCAMENTO,
        vinculos: [vinculo("2024-02-08", "2026-10-01")],
        blocos: {
          ...LANCAMENTO.blocos,
          ESCOLARIDADE: {
            situacao: "NAO_CONFORME",
            motivos: ["NAO_COMPROVADA"],
          },
        },
      };
      const avaliacao = calcularFicha(REGRA, lancamento, DOCUMENTAL);
      const [motivo] = motivosDoResultado(
        REGRA.blocos,
        lancamento,
        avaliacao,
        avaliacao.resultado,
      );
      expect(motivo.bloco).toBe("ESCOLARIDADE");
      expect(motivo.texto).toMatch(/ — item 8\.2\.1$/);
      expect(
        motivosDoResultado(
          REGRA.blocos,
          lancamento,
          { nota_apurada: 10, nota_minima: 15 },
          "INAPTO_NOTA",
        ),
      ).toEqual([{ bloco: null, texto: "Nota 10 abaixo da mínima 15" }]);
    });
  });

  describe("tirar e desfazer um vínculo (a P02 perdeu o vínculo pelo ×)", () => {
    it("tira com um clique e o Desfazer devolve na mesma posição", async () => {
      const { tirarItem, devolverItem } =
        await import("../src/lib/avaliacao-documental/itens-da-ficha.ts");
      const a = vinculo("2020-01-01", "2020-12-31");
      const b = vinculo("2024-02-08", "2026-10-01");
      const r = tirarItem([a, b], 1);
      expect(r.itens).toEqual([a]);
      expect(r.tirado).toEqual({ indice: 1, item: b });
      expect(devolverItem(r.itens, r.tirado)).toEqual([a, b]);
      expect(devolverItem([], { indice: 3, item: b })).toEqual([b]);
      expect(tirarItem([a], 5).tirado).toBeNull();
    });
  });

  describe("dias em comum entre vínculos (contam uma vez)", () => {
    const BLOCO = {
      tipo: "VINCULOS",
      categorias: [{ codigo: "AREA" }, { codigo: "OUTRA", pontua: false }],
    };
    const v = (inicio, fim, extra = {}) => ({
      inicio,
      fim,
      categoria: "AREA",
      aceito: true,
      ...extra,
    });
    it("a soma menos a união dos aceitos que contam; emendar no dia seguinte não é comum", () => {
      expect(
        diasEmComum(BLOCO, [
          v("2020-01-01", "2020-01-31"),
          v("2020-01-21", "2020-02-10"),
        ]),
      ).toBe(11);
      expect(
        diasEmComum(BLOCO, [
          v("2020-01-01", "2020-01-31"),
          v("2020-02-01", "2020-02-10"),
        ]),
      ).toBe(0);
      // Recusado e categoria que não pontua ficam de fora; regra que não une, 0.
      expect(
        diasEmComum(BLOCO, [
          v("2020-01-01", "2020-01-31"),
          v("2020-01-01", "2020-01-31", { aceito: false }),
          v("2020-01-01", "2020-01-31", { categoria: "OUTRA" }),
        ]),
      ).toBe(0);
      expect(
        diasEmComum({ ...BLOCO, unir_sobreposicao: false }, [
          v("2020-01-01", "2020-01-31"),
          v("2020-01-01", "2020-01-31"),
        ]),
      ).toBe(0);
    });
  });

  describe("experiência Não confere com os vínculos aceitos cumprindo o mínimo", () => {
    // Edital 114: o avaliador marca Não confere ("experiência mínima não
    // comprovada" ou "sem correlação com a área"), mas deixa os vínculos
    // aceitos. O mínimo é pelos vínculos aceitos: não eliminaria, só zeraria.
    const LANCAMENTO = {
      nivel: "superior",
      modalidade: "AC",
      indigena: false,
      mora_aldeia: false,
      aldeia_na_lista: false,
      estagio_horas: 0,
      blocos: {
        IDENTIDADE: { motivos: [], situacao: "CONFORME" },
        ESCOLARIDADE: { motivos: [], situacao: "CONFORME" },
        REGISTRO_CONSELHO: { motivos: [], situacao: "CONFORME" },
        FORMACAO: { motivos: [], situacao: "CONFORME" },
        CURSOS: { motivos: [], situacao: "CONFORME" },
        EXPERIENCIA: {
          motivos: ["ESTAGIO_OU_SIMILAR"],
          situacao: "NAO_CONFORME",
        },
      },
      titulos: [],
      cursos: [],
      vinculos: [vinculo("2016-01-01", "2025-10-31")],
      observacoes_prontas: [],
    };
    const doMinimo = (regra, lancamento) =>
      pendenciasDaFicha(
        regra,
        lancamento,
        calcularFicha(regra, lancamento, DOCUMENTAL),
        null,
      ).filter((p) => p.tipo === "minimo");

    it("vínculo aceito acima do mínimo: pendência do mínimo", () => {
      expect(doMinimo(REGRA, LANCAMENTO)).toEqual([
        {
          bloco: "EXPERIENCIA",
          tipo: "minimo",
          texto:
            "Experiência marcada como Não confere, mas os vínculos aceitos somam 119 meses (mínimo 6 meses). Desmarque os vínculos que não foram aceitos — sem a experiência mínima o candidato é eliminado — ou marque Confere.",
        },
      ]);
    });

    it("vínculos desmarcados: sem pendência e Inapto por requisito", () => {
      const lancamento = {
        ...LANCAMENTO,
        vinculos: [
          vinculo("2016-01-01", "2025-10-31", {
            aceito: false,
            motivo: "Fora da área",
          }),
        ],
      };
      expect(doMinimo(REGRA, lancamento)).toEqual([]);
      expect(calcularFicha(REGRA, lancamento, DOCUMENTAL).resultado).toBe(
        "INAPTO_REQUISITO",
      );
    });

    it("efeito do mínimo diferente de ELIMINA: sem pendência", () => {
      const regra = {
        ...REGRA,
        blocos: REGRA.blocos.map((b) =>
          b.codigo === "EXPERIENCIA" ? { ...b, efeito_minimo: "OBSERVA" } : b,
        ),
      };
      expect(doMinimo(regra, LANCAMENTO)).toEqual([]);
    });

    it("vínculo aceito abaixo do mínimo: Não confere coerente, sem pendência", () => {
      const lancamento = {
        ...LANCAMENTO,
        vinculos: [vinculo("2026-01-01", "2026-03-31")],
      };
      expect(doMinimo(REGRA, lancamento)).toEqual([]);
    });

    it("Confere: a regra antiga continua (abaixo do mínimo pede; acima, nada)", () => {
      const confere = (vinculos) => ({
        ...LANCAMENTO,
        vinculos,
        blocos: {
          ...LANCAMENTO.blocos,
          EXPERIENCIA: { motivos: [], situacao: "CONFORME" },
        },
      });
      expect(
        doMinimo(REGRA, confere([vinculo("2026-01-01", "2026-03-31")])).map(
          (p) => p.texto,
        ),
      ).toEqual([
        "Experiência mínima de 6 meses não comprovada (comprovado 3 meses): registre os vínculos que comprovam ou escolha Não confere.",
      ]);
      expect(doMinimo(REGRA, confere(LANCAMENTO.vinculos))).toEqual([]);
    });
  });
});

bloco("lib/avaliacao-documental-datas-do-vinculo", () => {
  /*
  As datas dos vínculos da ficha (20261023090000): nada antes de 1960 nem fim
  depois de hoje (o banco recusa o mesmo ao salvar e ao concluir) e o vínculo
  "atual" que vai até a data limite do bloco (o fim das inscrições), não até
  hoje. E a coluna "Motivo da revisão" da fila. Dados fictícios.
*/
  const HOJE = "2026-10-22";

  describe("datas do vínculo", () => {
    it("aceita o vínculo comum", () => {
      expect(
        faltaNasDatasDoVinculo(
          { inicio: "2020-01-01", fim: "2026-10-14" },
          HOJE,
        ),
      ).toBeNull();
      expect(
        faltaNasDatasDoVinculo(
          { inicio: "2026-10-22", fim: "2026-10-22" },
          HOJE,
        ),
      ).toBeNull();
    });

    it("recusa a data inválida, o fim antes do início, antes de 1960 e o fim depois de hoje", () => {
      expect(
        faltaNasDatasDoVinculo(
          { inicio: "2026-02-30", fim: "2026-03-01" },
          HOJE,
        ),
      ).toBe("Confira o início e o fim do vínculo.");
      expect(
        faltaNasDatasDoVinculo(
          { inicio: "2026-03-01", fim: "2026-02-01" },
          HOJE,
        ),
      ).toBe("Confira o início e o fim do vínculo.");
      expect(
        faltaNasDatasDoVinculo(
          { inicio: "1959-12-31", fim: "1961-01-01" },
          HOJE,
        ),
      ).toMatch(/antes de 1960/);
      expect(
        faltaNasDatasDoVinculo(
          { inicio: "2026-01-01", fim: "2026-10-23" },
          HOJE,
        ),
      ).toMatch(/fim depois de hoje/);
    });

    it("hoje é o dia de Brasília", () => {
      // 02:00 UTC de 23/10 ainda é 22/10 em Brasília.
      expect(hojeEmBrasilia(new Date("2026-10-23T02:00:00Z"))).toBe(
        "2026-10-22",
      );
    });

    it("o vínculo atual vai até a data limite, não até hoje; a emissão antes dela vale", () => {
      expect(fimDoVinculoAtual({ dataLimite: "2026-10-14", hoje: HOJE })).toBe(
        "2026-10-14",
      );
      expect(
        fimDoVinculoAtual({
          emissao: "2026-09-01",
          dataLimite: "2026-10-14",
          hoje: HOJE,
        }),
      ).toBe("2026-09-01");
      expect(fimDoVinculoAtual({ dataLimite: "2026-12-31", hoje: HOJE })).toBe(
        HOJE,
      );
      expect(fimDoVinculoAtual({ emissao: "2026-09-01", hoje: HOJE })).toBe(
        "2026-09-01",
      );
      expect(fimDoVinculoAtual({ hoje: HOJE })).toBe("");
    });

    it("Aceitar o vínculo atual lido do arquivo preenche o fim com a data limite do bloco", () => {
      const bloco = {
        codigo: "EXPERIENCIA",
        tipo: "VINCULOS",
        categorias: [{ codigo: "AREA" }],
        data_limite: "2026-10-14",
      };
      const lido = (extra) => ({
        tipo: "VINCULO",
        empregador: "Clínica fictícia",
        inicio: "2025-01-01",
        fim: null,
        atual: true,
        ...extra,
      });
      // A data da leitura não é fim: vale a data limite.
      expect(
        linhaDoItemLido(
          bloco,
          lido({ dias_ate: "2026-10-20", dias_ate_fonte: "LEITURA" }),
          "k",
        ).fim,
      ).toBe("2026-10-14");
      // A emissão do documento antes da data limite: o documento comprova até ali.
      expect(
        linhaDoItemLido(
          bloco,
          lido({ dias_ate: "2026-08-31", dias_ate_fonte: "EMISSAO" }),
          "k",
        ).fim,
      ).toBe("2026-08-31");
      // Sem data limite no bloco: como antes, até onde o robô contou.
      expect(
        linhaDoItemLido(
          { ...bloco, data_limite: null },
          lido({ dias_ate: "2026-08-31", dias_ate_fonte: "EMISSAO" }),
          "k",
        ).fim,
      ).toBe("2026-08-31");
    });
  });

  describe("motivo da revisão na fila", () => {
    it("a etapa Em revisão mostra o motivo (da coordenação ou da conferência automática)", () => {
      expect(colunasDaEtapa("revisao")).toContain("motivo_revisao");
      const linha = {
        ficha: {
          situacao: "REVISAR",
          motivo_revisao:
            "Conferência automática: a ficha concluída tem pendência pela regra vigente — Experiência: …",
        },
      };
      expect(textoDaColuna(linha, "motivo_revisao")).toMatch(
        /^Conferência automática:/,
      );
      expect(textoDaColuna({ ficha: {} }, "motivo_revisao")).toBe("");
    });
  });
});

bloco("lib/avaliacao-documental-decisao-do-lote", () => {
  /*
  Inclusão no lote por decisão da coordenação (ex.: "Critério CORES"): o selo,
  os contadores "N pela regra + M por decisão", os candidatos que podem ser
  incluídos, o motivo, as chamadas ao banco (uma por vaga) e a nota de rodapé
  dos documentos oficiais (Lista Provisória e Lote). A conta do recálculo que
  respeita as decisões está nos casos dourados (casos-de-pre-classificacao.json).
*/

  const CORES = "Critério CORES";
  const daPre = (codigo, extra = {}) => ({
    id: `id-${codigo}`,
    vaga: "180258",
    codigo,
    situacao: "RANQUEADO",
    ...extra,
  });

  describe("decisão da coordenação na tela", () => {
    it("selo e motivo: só de quem entrou por decisão (triagem e fila)", () => {
      const pre = daPre("6975425", {
        situacao: "NO_LOTE",
        entrada: "DECISAO",
        motivo_entrada: CORES,
        decisao: { motivo: CORES, por: "Coordenação", em: "2026-10-07" },
      });
      const fila = { codigo: "6948286", entrada: "DECISAO", decisao: CORES };
      expect(entrouPorDecisao(pre)).toBe(true);
      expect(motivoDaDecisao(pre)).toBe(CORES);
      expect(seloDaDecisao(pre)).toBe("Decisão: Critério CORES");
      expect(seloDaDecisao(fila)).toBe("Decisão: Critério CORES");
      expect(
        seloDaDecisao({ entrada: "INICIAL", motivo_entrada: "Lote inicial" }),
      ).toBe("");
      expect(seloDaDecisao(null)).toBe("");
    });

    it('contadores: "Lote: 11 pela regra + 6 por decisão" (sem decisão, só o da regra)', () => {
      expect(textoDoLote(11, 6)).toBe("Lote: 11 pela regra + 6 por decisão");
      expect(textoDoLote(11, 6, 11)).toBe(
        "Lote: 11 de 11 pela regra + 6 por decisão",
      );
      expect(textoDoLote(11, 0, 11)).toBe("Lote: 11 de 11");
      const dados = {
        vagas: [
          {
            codigo: "180258",
            inscritos: 45,
            no_lote: 17,
            no_lote_regra: 11,
            no_lote_decisao: 6,
            tamanho: 11,
          },
          // Sem os campos novos (antes da migration): conta os inscritos.
          { codigo: "180250", inscritos: 3, no_lote: 2, tamanho: 2 },
        ],
        candidatos: [
          daPre("1", {
            vaga: "180250",
            situacao: "NO_LOTE",
            entrada: "INICIAL",
          }),
          daPre("2", {
            vaga: "180250",
            situacao: "NO_LOTE",
            entrada: "DECISAO",
            motivo_entrada: CORES,
          }),
        ],
      };
      expect(loteDaVaga(dados.vagas[0], dados.candidatos)).toEqual({
        pelaRegra: 11,
        porDecisao: 6,
      });
      expect(loteDaVaga(dados.vagas[1], dados.candidatos)).toEqual({
        pelaRegra: 1,
        porDecisao: 1,
      });
      const cont = contadoresDaPreClassificacao(dados);
      expect([
        cont.noLote,
        cont.noLotePelaRegra,
        cont.noLotePorDecisao,
      ]).toEqual([19, 12, 7]);
      const naFila = [
        { vaga: "180258", situacao_pre: "NO_LOTE", entrada: "INICIAL" },
        { vaga: "180258", situacao_pre: "ANALISADO", entrada: "DECISAO" },
        { vaga: "180258", situacao_pre: "NO_LOTE", entrada: "DECISAO" },
        { vaga: "180258", situacao_pre: "ELIMINADO" },
        { vaga: "180250", situacao_pre: "NO_LOTE", entrada: "AMPLIACAO" },
      ];
      expect(loteDaFila(naFila)).toEqual({ pelaRegra: 2, porDecisao: 2 });
      expect(loteDaFila(naFila, "180258")).toEqual({
        pelaRegra: 1,
        porDecisao: 2,
      });
    });

    it("só quem está fora do lote pela regra pode ser incluído (e não quem saiu da Empregare)", () => {
      expect(podeIncluirPorDecisao(daPre("1"))).toBe(true);
      expect(
        podeIncluirPorDecisao(
          daPre("2", { situacao: "ELIMINADO", motivo_codigo: "QUESTIONARIO" }),
        ),
      ).toBe(true);
      expect(
        podeIncluirPorDecisao(
          daPre("3", {
            situacao: "ELIMINADO",
            motivo_codigo: "SAIU_DA_EMPREGARE",
          }),
        ),
      ).toBe(false);
      expect(podeIncluirPorDecisao(daPre("4", { situacao: "NO_LOTE" }))).toBe(
        false,
      );
      expect(podeIncluirPorDecisao({ situacao_pre: "RANQUEADO" })).toBe(true);
      expect(podeIncluirPorDecisao({ situacao_pre: "ANALISADO" })).toBe(false);
    });

    it("motivo: a sugestão é Critério CORES; decisão de 5 a 250, revogação de 10 a 250", () => {
      expect(MOTIVO_SUGERIDO_DA_DECISAO).toBe(CORES);
      expect(erroDoMotivo(CORES, MOTIVO_DA_DECISAO)).toBe("");
      expect(erroDoMotivo("abc", MOTIVO_DA_DECISAO)).toMatch(/pelo menos 5/);
      expect(erroDoMotivo("x".repeat(251), MOTIVO_DA_DECISAO)).toMatch(
        /no máximo 250/,
      );
      expect(erroDoMotivo("Engano", MOTIVO_DA_REVOGACAO)).toMatch(
        /pelo menos 10/,
      );
      expect(textoDoAviso("DECISAO_SAIU_DA_EMPREGARE")).toMatch(
        /saiu do arquivo da Empregare/,
      );
    });
  });

  describe("decisão da coordenação no banco", () => {
    it("uma chamada por vaga, com os códigos, o motivo e a vaga", async () => {
      expect(
        codigosPorVaga([
          { codigo: "6975425", vaga: "180258" },
          { codigo: "6948286", vaga: "180258" },
          { codigo: "6975425", vaga: "180258" },
          { codigo: "7000001", vaga: "180250" },
          { codigo: " " },
        ]),
      ).toEqual([
        { vaga: "180258", codigos: ["6975425", "6948286"] },
        { vaga: "180250", codigos: ["7000001"] },
      ]);
      const rpc = vi.fn(async (_nome, { p_codigos }) => ({
        incluidos: p_codigos.length,
      }));
      const r = await decidirNoLote(
        rpc,
        "incluir",
        "e93",
        [
          { codigo: "6975425", vaga: "180258" },
          { codigo: "7000001", vaga: "180250" },
        ],
        ` ${CORES} `,
      );
      expect(rpc).toHaveBeenNthCalledWith(1, "incluir_no_lote_por_decisao", {
        p_edital: "e93",
        p_codigos: ["6975425"],
        p_motivo: CORES,
        p_vaga: "180258",
      });
      expect(rpc).toHaveBeenCalledTimes(2);
      expect(r).toEqual({
        quantidade: 2,
        texto: "2 candidatos incluídos no lote por decisão da coordenação.",
      });
      const revogar = vi.fn(async () => ({ revogadas: 1 }));
      const r2 = await decidirNoLote(
        revogar,
        "revogar",
        "e93",
        [{ codigo: "5112426", vaga: "180258" }],
        "Engano na lista",
      );
      expect(revogar).toHaveBeenCalledWith("revogar_decisao_lote", {
        p_edital: "e93",
        p_codigos: ["5112426"],
        p_motivo: "Engano na lista",
        p_vaga: "180258",
      });
      expect(r2.texto).toBe("1 decisão revogada.");
    });

    it("o store relê depois de incluir e devolve o erro do banco (permissão, ficha concluída)", async () => {
      const respostas = {
        // A abertura lê só o resumo (20261029120000).
        obter_resumo_pre_classificacao: () => ({
          data: { vagas: [] },
          error: null,
        }),
        incluir_no_lote_por_decisao: () => ({
          data: null,
          error: {
            code: "42501",
            message:
              "Só o gestor do edital ou a coordenação da avaliação muda a regra e a equipe",
          },
        }),
        revogar_decisao_lote: () => ({
          data: null,
          error: {
            code: "22023",
            message:
              "O candidato 6948286 já tem a ficha concluída: a decisão não se revoga.",
          },
        }),
      };
      const supabase = {
        rpc: vi.fn(async (nome) => respostas[nome]()),
      };
      const toast = vi.fn();
      const pre = criarEstadoDaPreClassificacao({ supabase, toast });
      await pre.carregar("e93");
      const negado = await pre.incluirPorDecisao(
        [{ codigo: "6975425", vaga: "180258" }],
        CORES,
      );
      expect(negado.ok).toBe(false);
      expect(negado.erro).toMatch(/coordenação/);
      const concluida = await pre.revogarDecisao(
        [{ codigo: "6948286", vaga: "180258" }],
        "Engano na lista",
      );
      expect(concluida).toEqual({
        ok: false,
        erro: expect.stringMatching(/ficha concluída/),
      });

      respostas.incluir_no_lote_por_decisao = () => ({
        data: { incluidos: 1, fichas_criadas: 1 },
        error: null,
      });
      const ok = await pre.incluirPorDecisao(
        [{ codigo: "6975425", vaga: "180258" }],
        CORES,
      );
      expect(ok).toEqual({ ok: true, quantidade: 1 });
      expect(toast).toHaveBeenCalledWith(
        "1 candidato incluído no lote por decisão da coordenação.",
        "success",
      );
      // Releu o resumo da triagem depois de incluir.
      expect(
        supabase.rpc.mock.calls.filter(
          ([n]) => n === "obter_resumo_pre_classificacao",
        ).length,
      ).toBe(2);
    });
  });

  describe("decisão da coordenação nos documentos oficiais", () => {
    const retrato = (tipo) => ({
      schema: 1,
      tipo,
      lote: tipo === "LOTE" ? 2 : null,
      edital: { id: "e93", edital: "Edital 93/2026", unidade: "Boa Vista" },
      casas: 1,
      modalidades: [],
      vagas: [
        {
          chave: "180258",
          codigo: "180258",
          cabecalho: "VAGA 180258 - Cargo 5",
          geral: [
            { posicao: 1, nome: "Ana Exemplo", nota: 26, modalidades: ["AC"] },
            {
              posicao: 28,
              nome: "Bia Exemplo",
              nota: 0,
              modalidades: ["AC"],
              decisao: CORES,
            },
            {
              posicao: 29,
              nome: "Caio Exemplo",
              nota: 0,
              modalidades: ["AC"],
              decisao: "Outro motivo.",
            },
          ],
          listas: {},
          eliminados: [],
        },
      ],
    });

    it("o nome leva a marca e a tabela, a nota: 'Incluído por decisão da coordenação: Critério CORES.'", () => {
      const marcas = marcasDasDecisoes(retrato("LOTE").vagas[0].geral);
      expect(marcas.notas).toEqual([
        "* Incluído por decisão da coordenação: Critério CORES.",
        "** Incluído por decisão da coordenação: Outro motivo.",
      ]);
      for (const tipo of ["LOTE", "PROVISORIA"]) {
        const doc = documentoOficial(retrato(tipo), {
          regra: {},
          hoje: new Date("2026-10-07T12:00:00Z"),
        });
        const tabela = doc.blocos[0].tabelas[0];
        expect(tabela.linhas.map((l) => l[1])).toEqual([
          "Ana Exemplo",
          "Bia Exemplo *",
          "Caio Exemplo **",
        ]);
        expect(tabela.notas[0]).toBe(
          "* Incluído por decisão da coordenação: Critério CORES.",
        );
        expect(htmlParaSei(doc)).toContain(
          "* Incluído por decisão da coordenação: Critério CORES.",
        );
        expect(textoParaSei(doc)).toContain(
          "* Incluído por decisão da coordenação: Critério CORES.",
        );
        expect(corpoXml(doc)).toContain(
          "* Incluído por decisão da coordenação: Critério CORES.",
        );
      }
    });

    it("sem decisão, nada muda (nem nas outras listas)", () => {
      const semDecisao = retrato("LOTE");
      semDecisao.vagas[0].geral = semDecisao.vagas[0].geral.slice(0, 1);
      const doc = documentoOficial(semDecisao, { regra: {} });
      expect(doc.blocos[0].tabelas[0].notas).toEqual([]);
      expect(doc.blocos[0].tabelas[0].linhas[0][1]).toBe("Ana Exemplo");
    });
  });
});

bloco("lib/avaliacao-documental-distribuicao", () => {
  /*
  Distribuição das fichas (fase F3). Os casos dourados rodam também no pytest
  (tests/python/test_distribuicao.py), contra
  python/monitora/avaliacao_documental/distribuicao.py.
*/
  const CASOS = JSON.parse(
    readFileSync(
      "tests/fixtures/avaliacao-documental/casos-de-distribuicao.json",
      "utf8",
    ),
  ).casos;

  describe("casos dourados da distribuição (mesmos do Python)", () => {
    it.each(CASOS.map((c) => [c.nome, c]))("%s", (_nome, caso) => {
      expect(distribuirFichas(caso.entrada)).toEqual(caso.esperado);
    });
  });

  describe("AM-6.2: distribuição inicial", () => {
    it("300 fichas para 3 analistas dá 100 para cada um", () => {
      const fichas = Array.from({ length: 300 }, (_, i) => ({
        id: `f${i}`,
        vaga: "10",
      }));
      const analistas = ["a", "b", "c"].map((usuario) => ({
        usuario,
        vagas: null,
        limite: null,
        pendentes: 0,
      }));
      const r = distribuirFichas({ fichas, analistas });
      expect(r.por_analista).toEqual({ a: 100, b: 100, c: 100 });
      expect(r.sobra).toEqual([]);
    });

    it("teto: o menor entre a equipe e a regra só no critério LIMITE", () => {
      expect(tetoDoAnalista({ limite: 5 }, "PARTES_IGUAIS", 2)).toBe(5);
      expect(tetoDoAnalista({ limite: 5 }, "LIMITE", 2)).toBe(2);
      expect(tetoDoAnalista({ limite: null }, "PARTES_IGUAIS", 2)).toBeNull();
      expect(tetoDoAnalista({}, "LIMITE", null)).toBeNull();
    });

    it("entrada vazia ou inválida não quebra", () => {
      expect(distribuirFichas()).toEqual({
        atribuicoes: [],
        sobra: [],
        por_analista: {},
      });
      expect(
        distribuirFichas({
          fichas: [{ id: "x", vaga: "1" }],
          analistas: [{ usuario: "a", pendentes: "muitas" }],
        }).atribuicoes,
      ).toEqual([{ ficha: "x", usuario: "a" }]);
    });
  });
});

bloco("lib/avaliacao-documental-documentos-em-lote", () => {
  /*
  Documentos em lote (Avaliação documental › Documentos e Triagem ›
  Comunicados): listas pesquisáveis por código OU nome, marcação por vaga +
  código e a montagem dos comunicados. Dados fictícios.
*/

  const concluida = (resultado) => ({ situacao: "CONCLUIDA", resultado });
  const FILA = [
    {
      vaga: "2",
      codigo: "9002",
      nome: "Beatriz Simões",
      ficha: concluida("APTO"),
    },
    {
      vaga: "1",
      codigo: "9001",
      nome: "Ana Conceição",
      ficha: concluida("INAPTO_NOTA"),
    },
    {
      vaga: "1",
      codigo: "9003",
      nome: "Caio Lima",
      ficha: { situacao: "PENDENTE" },
    },
    {
      vaga: "2",
      codigo: "9001",
      nome: "Ana Conceição",
      ficha: concluida("INAPTO_REQUISITO"),
    },
  ];

  const PRE = [
    {
      vaga: "1",
      codigo: "8001",
      nome: "Davi Áureo",
      situacao: "ELIMINADO",
      motivo: "Cancelou a inscrição",
    },
    {
      vaga: "1",
      codigo: "8002",
      nome: "Eva Nunes",
      situacao: "ELIMINADO",
      motivo: null,
    },
    {
      vaga: "1",
      codigo: "8003",
      nome: "Fabio Reis",
      situacao: "RANQUEADO",
      motivo: null,
    },
  ];

  const pessoa = (vaga, codigo) => ({
    chave: chaveDaPessoa(vaga, codigo),
    codigo,
    nome: "",
    vaga,
    detalhe: "",
  });

  describe("listas dos documentos", () => {
    it("concluídos da fila: só CONCLUIDA, por vaga e nome, chave vaga|código", () => {
      const lista = concluidosDaFila(FILA);
      expect(lista.map((p) => p.chave)).toEqual(["1|9001", "2|9001", "2|9002"]);
      expect(lista[0].detalhe).toBe("Inapto pela nota");
    });

    it("eliminados da pré: só ELIMINADO; sem motivo aparece como tal", () => {
      const lista = eliminadosDaPre(PRE);
      expect(lista.map((p) => p.codigo)).toEqual(["8001", "8002"]);
      expect(lista[1].detalhe).toBe("Sem justificativa registrada");
    });

    it("busca pelo começo do código ou por parte do nome, sem acento; filtra a vaga", () => {
      const lista = concluidosDaFila(FILA);
      expect(filtrarPessoas(lista, "conceicao").map((p) => p.chave)).toEqual([
        "1|9001",
        "2|9001",
      ]);
      expect(filtrarPessoas(lista, "900")).toHaveLength(3);
      expect(filtrarPessoas(lista, "002")).toHaveLength(0);
      expect(filtrarPessoas(lista, "ana", "2").map((p) => p.chave)).toEqual([
        "2|9001",
      ]);
      expect(filtrarPessoas(lista, "  ")).toHaveLength(3);
    });

    it("marcadas segue a ordem da lista", () => {
      const lista = concluidosDaFila(FILA);
      expect(
        marcadas(lista, new Set(["2|9002", "1|9001"])).map((p) => p.chave),
      ).toEqual(["1|9001", "2|9002"]);
    });
  });

  describe("comunicados dos eliminados", () => {
    it("monta só os ainda eliminados com motivo e relata os demais", () => {
      const r = comunicadosDosEliminados(
        PRE,
        [{ codigo: "1", cargo: "Técnico" }],
        [pessoa("1", "8001"), pessoa("1", "8002"), pessoa("1", "8003")],
        { edital: "93/2026", unidade: "Boa Vista" },
      );
      expect(r.documentos).toHaveLength(1);
      expect(r.semMotivo).toEqual(["8002"]);
      expect(r.foraDaSituacao).toEqual(["8003"]);
      const texto = JSON.stringify(r.documentos[0]);
      expect(texto).toContain("Cancelou a inscrição");
      expect(texto).toContain("1 - Técnico");
    });

    it("o ZIP dos comunicados tem prefixo próprio", () => {
      const quando = new Date(2026, 9, 29);
      expect(nomeDoZipDosEspelhos("Edital 93/2026", quando)).toBe(
        "espelhos-93-2026-2026-10-29.zip",
      );
      expect(
        nomeDoZipDosEspelhos("Edital 93/2026", quando, null, "comunicados"),
      ).toBe("comunicados-93-2026-2026-10-29.zip");
    });
  });
});

bloco("lib/avaliacao-documental-espelho-da-pre-classificacao", () => {
  const exemplo = {
    codigo: "C123",
    nome: "Pessoa de Exemplo",
    vaga: "V001",
    cargo: "Cargo de Exemplo",
    edital: "Edital 100/2026",
    modalidade: "Ampla concorrência",
    situacao: "ELIMINADO",
    motivo: "Questionário não finalizado no prazo do edital.",
    motivo_codigo: "QUESTIONARIO",
    art: 24,
    declarada: 25.5,
  };

  describe("espelho da eliminação antes da análise", () => {
    it("não atribui nota da comissão nem cria critérios documentais", () => {
      const espelho = espelhoDaEliminacaoPreAnalise(exemplo);
      expect(espelho.modelo).toBe("ELIMINADO");
      expect(espelho.criterios).toEqual([]);
      expect(espelho.justificativas).toEqual([exemplo.motivo]);
      expect(espelho.notas).toContainEqual({
        rotulo: "Nota da análise documental",
        valor: "Não se aplica — análise não realizada",
      });
      expect(espelho.notas.some((n) => n.valor === "0")).toBe(false);
      expect(espelho.textos.abertura).toContain("Não houve análise documental");
    });

    it("não exibe ART ou declarada quando a eliminação é administrativa", () => {
      for (const motivo_codigo of [
        "QUESTIONARIO",
        "CANCELADO",
        "REPROVADO_EMPREGARE",
      ]) {
        const espelho = espelhoDaEliminacaoPreAnalise({
          ...exemplo,
          motivo_codigo,
          art: 0,
          declarada: 0,
        });
        expect(espelho.notas).toHaveLength(1);
        expect(espelho.notas[0].valor).toContain("Não se aplica");
      }
    });

    it("referência normativa só aparece quando conferida (issue #593)", () => {
      const semItem = espelhoDaEliminacaoPreAnalise(exemplo);
      expect(semItem.justificativas).toEqual([exemplo.motivo]);
      const fundamento = {
        situacao: "CONFERIDO",
        item_edital: "6.11.2",
        versao_regra: 3,
        fonte: "Edital de exemplo publicado",
      };
      const comItem = espelhoDaEliminacaoPreAnalise({ ...exemplo, fundamento });
      expect(comItem.justificativas).toContain(
        "Fundamento normativo: item 6.11.2 do edital (conferido pela gestão do edital na regra da triagem, versão 3).",
      );
      const aReconferir = espelhoDaEliminacaoPreAnalise({
        ...exemplo,
        fundamento: { ...fundamento, situacao: "RECONFERIR" },
      });
      expect(aReconferir.justificativas).toEqual([exemplo.motivo]);
    });

    it("nota ausente não vira zero e as notas da inscrição são informativas", () => {
      const espelho = espelhoDaEliminacaoPreAnalise({
        ...exemplo,
        art: null,
        declarada: null,
      });
      expect(espelho.notas).toHaveLength(1);
      expect(espelho.notas[0].valor).toContain("Não se aplica");
    });

    it("não emite documento de aprovado, nem de eliminação sem motivo", () => {
      expect(() =>
        espelhoDaEliminacaoPreAnalise({ ...exemplo, situacao: "NO_LOTE" }),
      ).toThrow(/Somente eliminados/);
      expect(() =>
        espelhoDaEliminacaoPreAnalise({ ...exemplo, motivo: "" }),
      ).toThrow(/justificativa registrada/);
    });

    it("escapa texto do motivo no HTML do documento", () => {
      const espelho = espelhoDaEliminacaoPreAnalise({
        ...exemplo,
        motivo: '<script>alert("x")</script>',
      });
      const html = folhaDoEspelho(espelho);
      expect(html).not.toContain('<script>alert("x")</script>');
      expect(html).toContain("&lt;script&gt;");
    });
  });
});

bloco("lib/avaliacao-documental-espelho-de-nota", () => {
  const f114 = JSON.parse(
    readFileSync(
      "tests/fixtures/avaliacao-documental/ficha-114-2026.json",
      "utf8",
    ),
  );

  /* A ficha concluída como estado-da-ficha.ts a deixa (regra da vaga, conta e declarada). */
  function fichaConcluida(lancamento, documental = { nota_minima: 15 }) {
    const regra = regraDaFicha(structuredClone(f114.regra), lancamento);
    const avaliacao = calcularFicha(regra, lancamento, documental);
    const declarada = declaradaDaFicha(
      regra,
      f114.vagas["182528"].respostas,
      lancamento.nivel,
    );
    return { regra, lancamento, avaliacao, declarada };
  }

  const MOTORISTA = "CARGO 14: MOTORISTA - Categoria B (Nível Médio)";

  const ELIMINADO = {
    nivel: "medio",
    modalidade: "AC",
    vaga: "182513",
    cargo: MOTORISTA,
    blocos: {
      IDENTIDADE: {
        situacao: "CONFORME",
        observacao: "RG com foto antiga, mas legível.",
      },
      ESCOLARIDADE: { situacao: "CONFORME" },
      REQUISITO_DO_CARGO: {
        situacao: "NAO_CONFORME",
        motivos: ["OUTRO"],
        motivo_livre: "CNH enviada cortada, sem a data de validade visível.",
      },
    },
    titulos: [],
    cursos: [{ nome: "Direção defensiva", horas: 60, aceito: true }],
    vinculos: [],
  };

  const COM_PONTOS = {
    nivel: "medio",
    modalidade: "AC",
    vaga: "182513",
    cargo: MOTORISTA,
    blocos: {
      IDENTIDADE: { situacao: "CONFORME" },
      ESCOLARIDADE: { situacao: "CONFORME" },
      REQUISITO_DO_CARGO: { situacao: "CONFORME" },
      CURSOS: {
        situacao: "CONFORME",
        nota_ajustada: 1,
        justificativas: ["OUTRO"],
        motivo_livre: "Certificado de 40 h sem assinatura da instituição.",
        observacao: "Enviou os certificados num único PDF.",
      },
      EXPERIENCIA: { situacao: "CONFORME" },
    },
    titulos: [],
    cursos: [{ nome: "Primeiros socorros", horas: 120, aceito: true }],
    vinculos: [
      {
        empregador: "Transportes Exemplo",
        categoria: f114.regra.blocos.find((b) => b.tipo === "VINCULOS")
          .categorias[0].codigo,
        inicio: "2019-01-01",
        fim: "2024-12-31",
        aceito: true,
      },
    ],
    observacoes: "Candidato(a) atendeu a todos os requisitos.",
  };

  function espelhoDe(lancamento, ficha = {}) {
    const st = fichaConcluida(lancamento);
    const entrada = entradaDoEspelho(
      { ...st, dados: { edital: { rotulo: "114/2026", area: "projetos" } } },
      {
        nome: "Maria Exemplo",
        codigo: "7001",
        modalidade: "AC",
        vaga: "182513",
        cargo: MOTORISTA,
        art: 40,
        tp_resultado: st.avaliacao.resultado,
        nota_final: st.avaliacao.nota_final,
        ...ficha,
      },
    );
    return { st, espelho: montarEspelho(entrada) };
  }

  describe("modeloDoEspelho", () => {
    it("só o inapto por requisito é eliminado; apto e inapto por nota têm pontos", () => {
      expect(modeloDoEspelho("INAPTO_REQUISITO")).toBe("ELIMINADO");
      expect(modeloDoEspelho("APTO")).toBe("COM_PONTOS");
      expect(modeloDoEspelho("INAPTO_NOTA")).toBe("COM_PONTOS");
    });
  });

  describe("espelho do eliminado", () => {
    const { st, espelho } = espelhoDe(ELIMINADO);

    it("a ficha é inapta por requisito e o modelo é sem pontos", () => {
      expect(st.avaliacao.resultado).toBe("INAPTO_REQUISITO");
      expect(espelho.modelo).toBe("ELIMINADO");
      expect(espelho.criterios).toEqual([]);
    });

    it("notas: sem a nota declarada; a consolidada não se aplica", () => {
      expect(espelho.notas).toEqual([
        {
          rotulo: "Nota consolidada (após a análise documental)",
          valor: TEXTOS_PADRAO_DO_ESPELHO.nao_se_aplica,
        },
      ]);
    });

    it("justificativa: o outro motivo descrito como o avaliador escreveu (sem o item do edital), sem observações internas", () => {
      expect(espelho.justificativas).toHaveLength(1);
      expect(espelho.justificativas[0]).toMatch(
        /CNH enviada cortada, sem a data de validade visível\.?$/,
      );
      expect(espelho.justificativas[0]).not.toMatch(/— item/);
      expect(espelho.justificativas.join(" ")).not.toMatch(/RG com foto/);
    });

    it("a página não mostra pontos por critério nem pontuação informativa", () => {
      const html = paginaDoEspelho(espelho);
      expect(html).toContain('data-modelo="ELIMINADO"');
      expect(html).not.toContain("Pontuação por critério");
      expect(html).not.toMatch(/informativ/i);
      expect(html).toContain(TEXTOS_PADRAO_DO_ESPELHO.nao_se_aplica);
      expect(html).not.toMatch(/autodeclarada/i);
      // Sem o cabeçalho/rodapé do navegador (endereço do sistema, data).
      expect(html).toContain("@page { size: A4; margin: 0; }");
      expect(html).toContain(TEXTOS_PADRAO_DO_ESPELHO.rodape);
    });
  });

  describe("espelho com pontos", () => {
    const { st, espelho } = espelhoDe(COM_PONTOS);

    it("a ficha é apta e o modelo é com pontos", () => {
      expect(st.avaliacao.resultado).toBe("APTO");
      expect(espelho.modelo).toBe("COM_PONTOS");
      expect(espelho.notas[1].valor).toBe(
        st.avaliacao.nota_final.toLocaleString("pt-BR", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }),
      );
    });

    it("uma linha por critério que pontua, com declarada, após análise e teto", () => {
      const rotulos = espelho.criterios.map((c) => c.rotulo);
      expect(rotulos).toContain("Cursos de Aperfeiçoamento");
      expect(rotulos).toContain("Experiência Profissional");
      const cursos = espelho.criterios.find(
        (c) => c.rotulo === "Cursos de Aperfeiçoamento",
      );
      expect(cursos.apurada).toBe("1,0");
      expect(cursos.declarada).not.toBe("");
      expect(cursos.teto).toMatch(/^\d/);
      expect(cursos.justificativas).toEqual([
        // O Outro motivo vai como o avaliador escreveu, sem o item do edital (#466).
        "Certificado de 40 h sem assinatura da instituição.",
      ]);
    });

    it("observações: a do avaliador no item e a geral, sem repetir a do critério", () => {
      expect(espelho.justificativas).toContain(
        "Enviou os certificados num único PDF.",
      );
      expect(espelho.justificativas).toContain(
        "Candidato(a) atendeu a todos os requisitos.",
      );
      expect(espelho.justificativas.join(" ")).not.toMatch(/sem assinatura/);
    });

    it("a página tem o quadro de critérios e nada interno", () => {
      const html = paginaDoEspelho(espelho);
      expect(html).toContain("Pontuação por critério");
      expect(html).toContain("Após análise");
      expect(html).not.toMatch(/CPF|avaliador\(a\)|questionário bruto/);
    });
  });

  describe("dados do registro", () => {
    it("sem regime nem carga horária, a linha Descrição sai", () => {
      const { espelho } = espelhoDe(COM_PONTOS);
      expect(espelho.dados.map((l) => l.rotulo)).not.toContain("Descrição");
      expect(paginaDoEspelho(espelho)).not.toContain("Descrição");
      expect(espelho.dados).toContainEqual({
        rotulo: "Código do candidato",
        valor: "7001",
      });
      expect(espelho.dados).toContainEqual({
        rotulo: "Vaga",
        valor: `182513 - ${MOTORISTA}`,
      });
      expect(espelho.dados).toContainEqual({
        rotulo: "Modalidade de concorrência",
        valor: "Ampla concorrência",
      });
      expect(espelho.dados).toContainEqual({
        rotulo: "Etapa",
        valor: "Análise Curricular",
      });
    });

    it("com regime e carga horária, a linha Descrição aparece", () => {
      const { espelho } = espelhoDe(COM_PONTOS, {
        regime: "CLT",
        carga_horaria: 40,
      });
      expect(espelho.dados).toContainEqual({
        rotulo: "Descrição",
        valor: "CLT / 40 horas semanais",
      });
    });

    it("escapa o HTML dos textos", () => {
      const { espelho } = espelhoDe(COM_PONTOS, { nome: "<b>Maria</b>" });
      const html = paginaDoEspelho(espelho);
      expect(html).toContain("&lt;b&gt;Maria&lt;/b&gt;");
      expect(html).not.toContain("<b>Maria</b>");
    });
  });

  describe("espelho do inapto pela nota mínima", () => {
    it("tem pontos e a justificativa diz a nota mínima", () => {
      const st = fichaConcluida(COM_PONTOS, { nota_minima: 50 });
      expect(st.avaliacao.resultado).toBe("INAPTO_NOTA");
      const espelho = montarEspelho(
        entradaDoEspelho(
          {
            ...st,
            dados: { edital: { rotulo: "114/2026", area: "projetos" } },
          },
          {
            nome: "Maria Exemplo",
            codigo: "7001",
            tp_resultado: "INAPTO_NOTA",
            nota_final: st.avaliacao.nota_final,
          },
        ),
      );
      expect(espelho.modelo).toBe("COM_PONTOS");
      expect(espelho.criterios.length).toBeGreaterThan(0);
      expect(espelho.justificativas[0]).toMatch(
        /^Nota consolidada 36,0 abaixo da nota mínima de 50,00 pontos/,
      );
      expect(espelho.dados).toContainEqual({
        rotulo: "Situação",
        valor: "Não classificado(a) — nota abaixo da mínima",
      });
    });
  });
});

bloco("lib/avaliacao-documental-espelho-em-pdf", async () => {
  const SECOES_DO_ESPELHO = {
    dados: PADRAO.secao_dados,
    notas: PADRAO.secao_notas,
    criterios: PADRAO.secao_criterios,
    justificativas: PADRAO.secao_justificativas,
  };
  const {
    subtitulo: SUBTITULO_DO_ESPELHO,
    rodape: RODAPE_DO_ESPELHO,
    sem_observacao: SEM_OBSERVACAO,
  } = PADRAO;

  /*
  O espelho em PDF: sai do MESMO objeto Espelho (montarEspelho), com texto de
  verdade (lido aqui no PDF sem compressão), A4, os quadros na ordem da página
  impressa; os nomes dos arquivos; o ZIP com um PDF por espelho, em lotes.
*/

  const f114 = JSON.parse(
    readFileSync(
      "tests/fixtures/avaliacao-documental/ficha-114-2026.json",
      "utf8",
    ),
  );
  const MOTORISTA = "CARGO 14: MOTORISTA - Categoria B (Nível Médio)";
  const EDITAL = { rotulo: "114/2026", area: "projetos" };

  const ELIMINADO = {
    nivel: "medio",
    modalidade: "AC",
    vaga: "182513",
    cargo: MOTORISTA,
    blocos: {
      IDENTIDADE: { situacao: "CONFORME" },
      ESCOLARIDADE: { situacao: "CONFORME" },
      REQUISITO_DO_CARGO: {
        situacao: "NAO_CONFORME",
        motivos: ["OUTRO"],
        motivo_livre: "CNH enviada cortada, sem a data de validade visível.",
      },
    },
    titulos: [],
    cursos: [],
    vinculos: [],
  };

  const COM_PONTOS = {
    nivel: "medio",
    modalidade: "AC",
    vaga: "182513",
    cargo: MOTORISTA,
    blocos: {
      IDENTIDADE: { situacao: "CONFORME" },
      ESCOLARIDADE: { situacao: "CONFORME" },
      REQUISITO_DO_CARGO: { situacao: "CONFORME" },
      CURSOS: {
        situacao: "CONFORME",
        nota_ajustada: 1,
        justificativas: ["OUTRO"],
        motivo_livre: "Certificado de 40 h sem assinatura da instituição.",
        observacao: "Enviou os certificados num único PDF.",
      },
      EXPERIENCIA: { situacao: "CONFORME" },
    },
    titulos: [],
    cursos: [
      { nome: "Primeiros socorros", horas: 120, aceito: true },
      { nome: "Curso recusado", horas: 20, aceito: false, motivo: "Sem carga" },
    ],
    vinculos: [
      {
        empregador: "Transportes Exemplo",
        categoria: f114.regra.blocos.find((b) => b.tipo === "VINCULOS")
          .categorias[0].codigo,
        inicio: "2019-01-01",
        fim: "2024-12-31",
        aceito: true,
      },
    ],
    observacoes: "Candidato(a) atendeu a todos os requisitos.",
  };

  function espelhoDe(lancamento, ficha = {}) {
    const regra = regraDaFicha(structuredClone(f114.regra), lancamento);
    const avaliacao = calcularFicha(regra, lancamento, { nota_minima: 15 });
    const declarada = declaradaDaFicha(
      regra,
      f114.vagas["182528"].respostas,
      lancamento.nivel,
    );
    return montarEspelho(
      entradaDoEspelho(
        { regra, lancamento, avaliacao, declarada, dados: { edital: EDITAL } },
        {
          nome: "Maria Conceição Exemplo",
          codigo: "7001",
          modalidade: "AC",
          vaga: "182513",
          cargo: MOTORISTA,
          art: 40,
          tp_resultado: avaliacao.resultado,
          nota_final: avaliacao.nota_final,
          ...ficha,
        },
      ),
    );
  }

  const libs = await carregarBibliotecasDoPdf();
  const decodificar = (bytes) => new TextDecoder("latin1").decode(bytes);

  /* O texto escrito no PDF sem compressão (os operadores de texto "(...) Tj"), em ordem. */
  function textosDoPdf(bytes) {
    const bruto = decodificar(bytes);
    return [...bruto.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)].map((m) =>
      m[1].replace(/\\([()\\])/g, "$1"),
    );
  }
  const winAnsi = (t) =>
    new TextDecoder("latin1").decode(
      new Uint8Array(
        Array.from(textoParaOPdf(t)).map((c) =>
          c === "—" ? 0x97 : c === "•" ? 0x95 : c.charCodeAt(0),
        ),
      ),
    );

  describe("pdfDoEspelho", () => {
    it("com pontos: A4, texto de verdade e os quadros na ordem da página impressa", () => {
      const espelho = espelhoDe(COM_PONTOS);
      expect(espelho.modelo).toBe("COM_PONTOS");
      const bytes = pdfDoEspelho(espelho, libs, { comprimir: false });
      const bruto = decodificar(bytes);
      expect(bruto.startsWith("%PDF-")).toBe(true);
      // A4 em pontos (595,28 × 841,89).
      expect(bruto).toMatch(/\/MediaBox \[0 0 595\.2\d+ 841\.8\d+\]/);
      // Fonte padrão (sem fonte embutida): leve.
      expect(bruto).toContain("/BaseFont /Helvetica");
      expect(bruto).not.toContain("/FontFile");

      const textos = textosDoPdf(bytes).join("\n");
      const ordem = [
        "AGÊNCIA BRASILEIRA DE APOIO",
        espelho.titulo,
        SUBTITULO_DO_ESPELHO,
        "Prezado(a) ",
        "Maria Conceição Exemplo",
        SECOES_DO_ESPELHO.dados.toUpperCase(),
        "Código do candidato",
        SECOES_DO_ESPELHO.notas.toUpperCase(),
        "Nota autodeclarada",
        SECOES_DO_ESPELHO.criterios.toUpperCase(),
        COLUNAS_DOS_CRITERIOS[2],
        SECOES_DO_ESPELHO.justificativas.toUpperCase(),
      ].map(winAnsi);
      let desde = -1;
      for (const trecho of ordem) {
        const onde = textos.indexOf(trecho, desde + 1);
        expect(onde, trecho).toBeGreaterThan(desde);
        desde = onde;
      }
      for (const c of espelho.criterios)
        expect(textos).toContain(winAnsi(c.rotulo));
      expect(textos).toContain(
        winAnsi("Certificado de 40 h sem assinatura da instituição."),
      );
      // O rodapé (quebrado em linhas) inteiro.
      expect(textos.replace(/\s+/g, " ")).toContain(
        winAnsi(RODAPE_DO_ESPELHO).slice(0, 60),
      );
    });

    it("eliminado: sem o quadro de critérios e sem a nota autodeclarada", () => {
      const espelho = espelhoDe(ELIMINADO);
      expect(espelho.modelo).toBe("ELIMINADO");
      const textos = textosDoPdf(
        pdfDoEspelho(espelho, libs, { comprimir: false }),
      ).join("\n");
      expect(textos).not.toContain(
        winAnsi(SECOES_DO_ESPELHO.criterios.toUpperCase()),
      );
      expect(textos).not.toContain("Nota autodeclarada");
      expect(textos.replace(/\s+/g, " ")).toContain(winAnsi("Não se aplica"));
      expect(textos).toContain(winAnsi("CNH enviada cortada"));
    });

    it("sem justificativa: 'Sem observação registrada.'", () => {
      const espelho = { ...espelhoDe(ELIMINADO), justificativas: [] };
      const textos = textosDoPdf(
        pdfDoEspelho(espelho, libs, { comprimir: false }),
      ).join("\n");
      expect(textos).toContain(winAnsi(SEM_OBSERVACAO));
    });

    it("o cabeçalho configurado substitui o timbrado padrão", () => {
      const textos = textosDoPdf(
        pdfDoEspelho(espelhoDe(ELIMINADO), libs, {
          comprimir: false,
          cabecalho: "AGÊNCIA DE TESTE\nRua Exemplo, 1",
        }),
      ).join("\n");
      expect(textos).toContain(winAnsi("AGÊNCIA DE TESTE"));
      expect(textos).not.toContain("BRASILEIRA DE APOIO");
    });

    it("comprimido é menor e continua um PDF", () => {
      const espelho = espelhoDe(COM_PONTOS);
      const leve = pdfDoEspelho(espelho, libs);
      const aberto = pdfDoEspelho(espelho, libs, { comprimir: false });
      expect(decodificar(leve).startsWith("%PDF-")).toBe(true);
      expect(leve.byteLength).toBeLessThan(aberto.byteLength);
      expect(leve.byteLength).toBeLessThan(40_000);
    });
  });

  describe("textoParaOPdf", () => {
    it("compõe acentos e troca o que as fontes padrão não têm", () => {
      expect(textoParaOPdf("Conceição")).toBe("Conceição");
      expect(textoParaOPdf("nota ≥ 15 — ok • “sim”")).toBe(
        "nota >= 15 — ok • “sim”",
      );
      expect(textoParaOPdf("a\tb\u0007c 😀")).toBe("a bc ?");
    });
  });

  describe("nomes dos arquivos", () => {
    it("o PDF: vaga, código e nome sem acento, minúsculo e seguro", () => {
      const espelho = espelhoDe(COM_PONTOS, {
        nome: "  Ágata D'Ávila / São João  ",
      });
      expect(nomeDoPdfDoEspelho(espelho)).toBe(
        "espelho-182513-7001-agata-d-avila-sao-joao.pdf",
      );
      expect(
        nomeDoPdfDoEspelho({
          ...espelho,
          codigoDaVaga: "",
          candidato: "../../x",
        }),
      ).toBe("espelho-7001-x.pdf");
    });

    it("o ZIP: edital, vaga (se escolhida) e data", () => {
      const quando = new Date(2026, 9, 19, 10, 0);
      expect(nomeDoZipDosEspelhos("114/2026", quando)).toBe(
        "espelhos-114-2026-2026-10-19.zip",
      );
      expect(nomeDoZipDosEspelhos("Edital 114/2026", quando, "182513")).toBe(
        "espelhos-114-2026-vaga-182513-2026-10-19.zip",
      );
      expect(nomeDoZipDosEspelhos(null, quando)).toBe(
        "espelhos-2026-10-19.zip",
      );
    });

    it("trechoDoNome corta no tamanho sem hífen no fim", () => {
      expect(trechoDoNome("Maria da Silva Santos", 11)).toBe("maria-da-si");
      expect(trechoDoNome("Maria da Silva", 9)).toBe("maria-da");
    });

    it("nomes repetidos ganham sufixo", () => {
      expect(nomesSemRepetir(["a.pdf", "b.pdf", "a.pdf", "a.pdf"])).toEqual([
        "a.pdf",
        "b.pdf",
        "a-2.pdf",
        "a-3.pdf",
      ]);
    });
  });

  describe("zipDosEspelhos", () => {
    it("um PDF por espelho, com os nomes, em lotes com progresso", async () => {
      const espelhos = [
        espelhoDe(COM_PONTOS),
        espelhoDe(ELIMINADO, { codigo: "7002", nome: "João" }),
        espelhoDe(COM_PONTOS),
      ];
      const progresso = vi.fn();
      const esperar = vi.fn(async () => {});
      const zip = await zipDosEspelhos(espelhos, libs, {
        porLote: 2,
        aoProgredir: progresso,
        esperar,
      });
      expect(zip.nomes).toEqual([
        "espelho-182513-7001-maria-conceicao-exemplo.pdf",
        "espelho-182513-7002-joao.pdf",
        "espelho-182513-7001-maria-conceicao-exemplo-2.pdf",
      ]);
      const arquivos = unzipSync(zip.bytes);
      expect(Object.keys(arquivos)).toEqual(zip.nomes);
      for (const bytes of Object.values(arquivos))
        expect(decodificar(bytes.slice(0, 5))).toBe("%PDF-");
      expect(progresso.mock.calls).toEqual([
        [0, 3],
        [2, 3],
        [3, 3],
      ]);
      expect(esperar).toHaveBeenCalledTimes(2);
    });

    it("cancelar para no fim do lote", async () => {
      let cancelar = false;
      const zip = await zipDosEspelhos(
        [espelhoDe(COM_PONTOS), espelhoDe(COM_PONTOS), espelhoDe(COM_PONTOS)],
        libs,
        {
          porLote: 1,
          esperar: async () => {
            cancelar = true;
          },
          cancelado: () => cancelar,
        },
      );
      expect(zip).toBeNull();
    });
  });
});

bloco("lib/avaliacao-documental-espelhos-em-massa", () => {
  /*
  Espelhos de nota em massa: escolha, ordem, códigos sem espelho, a leitura em
  páginas e, principalmente, que cada espelho sai IGUAL ao do botão da ficha
  (a mesma montagem, com o lançamento enxuto que obter_espelhos_de_nota devolve).
*/

  const f114 = JSON.parse(
    readFileSync(
      "tests/fixtures/avaliacao-documental/ficha-114-2026.json",
      "utf8",
    ),
  );
  const MOTORISTA = "CARGO 14: MOTORISTA - Categoria B (Nível Médio)";
  const DOCUMENTAL = { nota_minima: 15 };
  const EDITAL = { rotulo: "114/2026", area: "projetos" };

  const ELIMINADO = {
    nivel: "medio",
    modalidade: "AC",
    vaga: "182513",
    cargo: MOTORISTA,
    blocos: {
      IDENTIDADE: { situacao: "CONFORME", observacao: "RG antigo, legível." },
      ESCOLARIDADE: { situacao: "CONFORME" },
      REQUISITO_DO_CARGO: {
        situacao: "NAO_CONFORME",
        motivos: ["OUTRO"],
        motivo_livre: "CNH enviada cortada, sem a data de validade visível.",
      },
    },
    titulos: [],
    cursos: [{ nome: "Direção defensiva", horas: 60, aceito: true }],
    vinculos: [],
  };

  const COM_PONTOS = {
    nivel: "medio",
    modalidade: "AC",
    vaga: "182513",
    cargo: MOTORISTA,
    blocos: {
      IDENTIDADE: { situacao: "CONFORME" },
      ESCOLARIDADE: { situacao: "CONFORME" },
      REQUISITO_DO_CARGO: { situacao: "CONFORME" },
      CURSOS: {
        situacao: "CONFORME",
        nota_ajustada: 1,
        justificativas: ["OUTRO"],
        motivo_livre: "Certificado de 40 h sem assinatura da instituição.",
        observacao: "Enviou os certificados num único PDF.",
      },
      EXPERIENCIA: { situacao: "CONFORME" },
    },
    titulos: [],
    cursos: [
      { nome: "Primeiros socorros", horas: 120, aceito: true },
      { nome: "Curso recusado", horas: 20, aceito: false, motivo: "Sem carga" },
    ],
    vinculos: [
      {
        empregador: "Transportes Exemplo",
        categoria: f114.regra.blocos.find((b) => b.tipo === "VINCULOS")
          .categorias[0].codigo,
        inicio: "2019-01-01",
        fim: "2024-12-31",
        aceito: true,
      },
    ],
    observacoes: "Candidato(a) atendeu a todos os requisitos.",
  };

  /* O que private."FC_LANCAMENTO_DO_ESPELHO" tira do lançamento (sem empregador nem nome de curso). */
  function lancamentoEnxuto(l) {
    return {
      ...l,
      ...(Array.isArray(l.vinculos)
        ? { vinculos: l.vinculos.map(({ empregador: _e, ...v }) => v) }
        : {}),
      ...(Array.isArray(l.cursos)
        ? { cursos: l.cursos.map(({ nome: _n, ...c }) => c) }
        : {}),
    };
  }

  /* O espelho do botão da ficha (estado-da-ficha.ts + entradaDoEspelho). */
  function espelhoIndividual(lancamento, ficha) {
    const regra = regraDaFicha(structuredClone(f114.regra), lancamento);
    const avaliacao = calcularFicha(regra, lancamento, DOCUMENTAL);
    const declarada = declaradaDaFicha(
      regra,
      f114.vagas["182528"].respostas,
      lancamento.nivel,
    );
    const espelho = montarEspelho(
      entradaDoEspelho(
        { regra, lancamento, avaliacao, declarada, dados: { edital: EDITAL } },
        {
          ...ficha,
          tp_resultado: avaliacao.resultado,
          nota_final: avaliacao.nota_final,
        },
      ),
    );
    return { espelho, avaliacao, declarada };
  }

  /* A linha de obter_espelhos_de_nota da mesma ficha (declarada como gravada na conclusão). */
  function linhaDoBanco(lancamento, individual, extra = {}) {
    return {
      id: "f-1",
      codigo: "7001",
      nome: "Maria Exemplo",
      vaga: "182513",
      cargo: MOTORISTA,
      modalidade: "AC",
      posicao: 3,
      art: 40,
      resultado: individual.avaliacao.resultado,
      nota_final: individual.avaliacao.nota_final,
      regra: "r1:1",
      declarada: { ...individual.declarada.parciais },
      lancamento: lancamentoEnxuto(structuredClone(lancamento)),
      ...extra,
    };
  }

  const FICHA = {
    nome: "Maria Exemplo",
    codigo: "7001",
    modalidade: "AC",
    vaga: "182513",
    cargo: MOTORISTA,
    art: 40,
  };

  describe("a montagem é a mesma do espelho individual", () => {
    for (const [nome, lancamento] of [
      ["eliminado", ELIMINADO],
      ["com pontos", COM_PONTOS],
    ])
      it(`${nome}: espelho e página idênticos`, () => {
        const individual = espelhoIndividual(lancamento, FICHA);
        const emMassa = espelhoDaFichaGravada(
          linhaDoBanco(lancamento, individual),
          structuredClone(f114.regra),
          DOCUMENTAL,
          EDITAL,
        );
        expect(emMassa).toEqual(individual.espelho);
        expect(paginaDoEspelho(emMassa)).toBe(
          paginaDoEspelho(individual.espelho),
        );
      });

    it("a folha do documento em massa é a mesma da página individual", () => {
      const { espelho } = espelhoIndividual(COM_PONTOS, FICHA);
      const pagina = paginaDoEspelho(espelho);
      const folha = pagina.slice(
        pagina.indexOf('<div class="folha"'),
        pagina.lastIndexOf("</body>"),
      );
      const doc = documentoDosEspelhos([espelho, espelho, espelho]);
      expect(doc.split(folha)).toHaveLength(4);
      expect(doc.match(/<div class="folha"/g)).toHaveLength(3);
      // Um por página, sem o cabeçalho/rodapé do navegador.
      expect(doc).toContain(
        ".folha + .folha { break-before: page; page-break-before: always; }",
      );
      expect(doc).toContain("@page { size: A4; margin: 0; }");
      expect(doc).not.toContain("<script");
    });

    it("abrirEspelhosEmMassa manda um documento só para a impressão", () => {
      const { espelho } = espelhoIndividual(ELIMINADO, FICHA);
      const imprimir = vi.fn();
      abrirEspelhosEmMassa([espelho, espelho], {
        imprimir,
        cabecalho: () => "AGÊNCIA DE TESTE",
        titulo: "Espelhos de nota - vaga 182513",
      });
      expect(imprimir).toHaveBeenCalledTimes(1);
      const html = imprimir.mock.calls[0][0];
      expect(html).toContain("<title>Espelhos de nota - vaga 182513</title>");
      expect(html.match(/AGÊNCIA DE TESTE/g)).toHaveLength(2);
    });
  });

  describe("lerCodigos", () => {
    it("separa por vírgula, ponto e vírgula, espaço e linha, sem repetir, na ordem", () => {
      expect(lerCodigos("123, 456;789\n 123\r\n\t1011  ")).toEqual([
        "123",
        "456",
        "789",
        "1011",
      ]);
      expect(lerCodigos("")).toEqual([]);
      expect(lerCodigos(null)).toEqual([]);
    });
  });

  const f = (id, vaga, resultado, nota_final, nome, posicao = null) => ({
    id,
    codigo: id,
    nome,
    vaga,
    resultado,
    nota_final,
    posicao,
  });

  describe("ordenarParaOsEspelhos", () => {
    const fichas = [
      f("1", "182513", "INAPTO_REQUISITO", 0, "Zeca"),
      f("2", "182513", "APTO", 30, "Bia", 2),
      f("3", "182421", "APTO", 10, "Caio"),
      f("4", "182513", "APTO", 30, "Ana", 1),
      f("5", "182513", "INAPTO_NOTA", 12, "Davi"),
      f("6", "182513", "INAPTO_REQUISITO", 0, "Ágata"),
      f("7", "182513", "APTO", 45, "Rui"),
    ];

    it("por vaga; aptos pela nota (empate pela posição), inaptos pela nota, eliminados pelo nome", () => {
      expect(ordenarParaOsEspelhos(fichas).map((x) => x.id)).toEqual([
        "3",
        "7",
        "4",
        "2",
        "5",
        "6",
        "1",
      ]);
    });

    it("com a lista colada, a ordem colada", () => {
      expect(
        ordenarParaOsEspelhos(fichas, ["5", "1", "7"])
          .slice(0, 3)
          .map((x) => x.id),
      ).toEqual(["5", "1", "7"]);
    });

    it("não muda a lista recebida", () => {
      const copia = [...fichas];
      ordenarParaOsEspelhos(fichas);
      expect(fichas).toEqual(copia);
    });
  });

  describe("codigosSemEspelho", () => {
    it("separa os sem ficha no edital dos com ficha não concluída", () => {
      const r = codigosSemEspelho(
        ["1", "2", "3", "4"],
        [f("1", "v", "APTO", 1, "A")],
        [
          { codigo: 3, situacao: "EM_ANALISE" },
          { codigo: "4", situacao: "FORA_LOTE" },
        ],
      );
      expect(r.naoEncontrados).toEqual(["2"]);
      expect(r.naoConcluidos).toEqual([
        { codigo: "3", situacao: "em análise" },
        { codigo: "4", situacao: "fora do lote" },
      ]);
    });
  });

  describe("escolha, estimativa e aviso", () => {
    const fila = [
      { vaga: "1", ficha: { situacao: "CONCLUIDA", resultado: "APTO" } },
      { vaga: "1", ficha: { situacao: "CONCLUIDA", resultado: "INAPTO_NOTA" } },
      {
        vaga: "2",
        ficha: { situacao: "CONCLUIDA", resultado: "INAPTO_REQUISITO" },
      },
      { vaga: "2", ficha: { situacao: "EM_ANALISE" } },
      { vaga: "2", ficha: null },
    ];

    it("estima pelos concluídos da fila, por vaga e filtro", () => {
      const est = (e) => estimativaDosEspelhos(fila, e);
      expect(est({ modo: "filtro", vaga: "", filtro: "TODOS" })).toBe(3);
      expect(est({ modo: "filtro", vaga: "", filtro: "APTOS" })).toBe(1);
      expect(est({ modo: "filtro", vaga: "", filtro: "INAPTOS" })).toBe(2);
      expect(est({ modo: "filtro", vaga: "2", filtro: "TODOS" })).toBe(1);
      expect(est({ modo: "codigos", codigos: ["a", "b"] })).toBe(2);
    });

    it("argumentos: vaga e filtro, ou só os códigos", () => {
      expect(
        argumentosDaPagina(
          "e1",
          { modo: "filtro", vaga: "9", filtro: "APTOS" },
          null,
          [],
        ),
      ).toEqual({
        p_edital: "e1",
        p_vagas: ["9"],
        p_filtro: "APTOS",
        p_codigos: null,
        p_apos: null,
        p_limite: FICHAS_POR_PAGINA,
        p_regras: null,
      });
      expect(
        argumentosDaPagina("e1", { modo: "codigos", codigos: ["1"] }, "x", [
          "r:1",
        ]),
      ).toMatchObject({
        p_vagas: null,
        p_filtro: "TODOS",
        p_codigos: ["1"],
        p_apos: "x",
        p_regras: ["r:1"],
      });
      expect(FICHAS_POR_PAGINA).toBe(200);
    });

    it("avisa acima de 500", () => {
      expect(avisoDoTamanho(500)).toBe("");
      expect(avisoDoTamanho(1234)).toMatch(
        /^Vai gerar 1\.234 páginas; pode demorar/,
      );
    });
  });

  describe("leitura em páginas", () => {
    const individual = espelhoIndividual(COM_PONTOS, FICHA);
    const linha = (id, extra) =>
      linhaDoBanco(COM_PONTOS, individual, { id, ...extra });

    it("segue o proximo, manda as regras já lidas e junta tudo", async () => {
      const rpc = vi
        .fn()
        .mockResolvedValueOnce({
          edital: EDITAL,
          documental: DOCUMENTAL,
          regras: { "r1:1": structuredClone(f114.regra) },
          fichas: [linha("a", { codigo: "1", nome: "Bia" })],
          nao_concluidos: [{ codigo: "9", situacao: "PENDENTE" }],
          proximo: "a",
        })
        .mockResolvedValueOnce({
          edital: EDITAL,
          documental: DOCUMENTAL,
          regras: {},
          fichas: [linha("b", { codigo: "2", nome: "Ana" })],
          proximo: null,
        });
      const progresso = [];
      const lidas = await lerFichasDosEspelhos({
        rpc,
        editalId: "e1",
        escolha: { modo: "codigos", codigos: ["2", "1", "9", "8"] },
        aoProgredir: (n) => progresso.push(n),
      });
      expect(rpc).toHaveBeenCalledTimes(2);
      expect(rpc.mock.calls[0][0]).toBe(RPC_ESPELHOS_DE_NOTA);
      expect(rpc.mock.calls[1][1]).toMatchObject({
        p_apos: "a",
        p_regras: ["r1:1"],
      });
      expect(progresso).toEqual([1, 2]);
      const espelhos = montarEspelhosLidos(lidas, ["2", "1", "9", "8"]);
      expect(espelhos.map((e) => e.candidato)).toEqual(["Ana", "Bia"]);
      expect(espelhos[0].criterios).toEqual(individual.espelho.criterios);
      expect(
        codigosSemEspelho(
          ["2", "1", "9", "8"],
          lidas.fichas,
          lidas.naoConcluidos,
        ),
      ).toEqual({
        naoEncontrados: ["8"],
        naoConcluidos: [{ codigo: "9", situacao: "pendente" }],
      });
    });

    it("cancelar para depois da página em curso", async () => {
      let cancelado = false;
      const rpc = vi.fn(async () => {
        cancelado = true;
        return { fichas: [linha("a")], regras: {}, proximo: "a" };
      });
      const lidas = await lerFichasDosEspelhos({
        rpc,
        editalId: "e1",
        escolha: { modo: "filtro", vaga: "", filtro: "TODOS" },
        cancelado: () => cancelado,
      });
      expect(lidas).toBeNull();
      expect(rpc).toHaveBeenCalledTimes(1);
    });
  });
});

bloco("lib/avaliacao-documental-experiencia-acima", () => {
  /*
  Auditoria de 20/10/2026 (edital 114/2026): o Confere da experiência grava a
  declarada como ajuste (nota_ajustada) e a parcial fica acima do que os
  vínculos aceitos comprovam (16 meses = 5 pontos, ficha com 35). A ficha
  passa a pedir (tipo "acima") que os vínculos sejam lançados ou a pontuação
  ajustada em Editar nota com justificativa; o banco pede o mesmo
  (FC_PENDENCIAS_FICHA, migration 20261020180000). Dados fictícios.
*/
  const CASOS = JSON.parse(
    readFileSync(
      "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
      "utf8",
    ),
  );
  const REGRA = CASOS.regras["PROJ26-CURRICULAR"];
  const EXPERIENCIA = REGRA.blocos.find((b) => b.codigo === "EXPERIENCIA");
  const DOCUMENTAL = { nota_minima: 15, nota_minima_por_nivel: {} };
  const DECLARADA = { parciais: { EXPERIENCIA: 35, FORMACAO: 0, CURSOS: 0 } };
  const vinculo = (inicio, fim, extra = {}) => ({
    empregador: "Empresa fictícia",
    categoria: "AREA_OU_SUS",
    inicio,
    fim,
    aceito: true,
    ...extra,
  });
  // 2025-01-01 a 2026-04-30: 485 dias = 16 meses → (16 − 6) / 6 = 1 período = 5 pontos.
  const DEZESSEIS_MESES = [vinculo("2025-01-01", "2026-04-30")];
  const lancamento = (experiencia, vinculos = DEZESSEIS_MESES) => ({
    nivel: "superior",
    modalidade: "AC",
    indigena: false,
    mora_aldeia: false,
    aldeia_na_lista: false,
    estagio_horas: 0,
    blocos: {
      IDENTIDADE: { motivos: [], situacao: "CONFORME" },
      ESCOLARIDADE: { motivos: [], situacao: "CONFORME" },
      REGISTRO_CONSELHO: { motivos: [], situacao: "CONFORME" },
      FORMACAO: { motivos: [], situacao: "CONFORME" },
      CURSOS: { motivos: [], situacao: "CONFORME" },
      EXPERIENCIA: { motivos: [], ...experiencia },
    },
    titulos: [],
    cursos: [],
    vinculos,
    observacoes_prontas: [],
  });
  // O Confere como a tela grava (blocoComEscolha): a declarada como ajuste.
  const CONFERE = {
    situacao: "CONFORME",
    edita_nota: false,
    nota_ajustada: 35,
  };
  const avaliar = (l) => calcularFicha(REGRA, l, DOCUMENTAL);
  const pendencias = (l) => pendenciasDaFicha(REGRA, l, avaliar(l), DECLARADA);
  const doTipo = (l, tipo) =>
    pendencias(l).filter((p) => p.bloco === "EXPERIENCIA" && p.tipo === tipo);

  describe("experiência confirmada acima do que os vínculos aceitos comprovam", () => {
    it("Confere com a declarada acima do calculado: pendência", () => {
      const l = lancamento(CONFERE);
      const av = avaliar(l);
      expect(av.parciais.EXPERIENCIA).toBe(35);
      expect(av.calculados.EXPERIENCIA).toBe(5);
      expect(pontuacaoAcimaDoComprovado(EXPERIENCIA, l, av)).toEqual({
        parcial: "EXPERIENCIA",
        valor: 35,
        calculado: 5,
        meses: 16,
      });
      expect(doTipo(l, "acima")).toEqual([
        {
          bloco: "EXPERIENCIA",
          tipo: "acima",
          texto:
            "Experiência confirmada com 35 pontos, mas os vínculos aceitos comprovam 16 meses (5 pontos). Lance os vínculos que comprovam o período declarado ou ajuste a pontuação em Editar nota, com justificativa.",
        },
      ]);
      // A diferença da declarada não aparece (parcial = declarada): só esta falta.
      expect(doTipo(l, "justificativa")).toEqual([]);
      expect(
        conferenciaDaFicha(REGRA, l, av, pendencias(l)).texto_da_falta,
      ).toContain("pontuação acima do comprovado");
    });

    it("eliminado por outro critério: sem pendência (pontuação só informativa)", () => {
      // 21/10/2026: a equipe confirma a experiência do candidato já eliminado só
      // para registrar o mínimo; a ficha não pode travar (20261021090000).
      const l = lancamento(CONFERE);
      l.blocos.IDENTIDADE = {
        situacao: "NAO_CONFORME",
        motivos: [
          REGRA.blocos.find((b) => b.codigo === "IDENTIDADE").motivos[0].codigo,
        ],
      };
      expect(avaliar(l).resultado).toBe("INAPTO_REQUISITO");
      expect(doTipo(l, "acima")).toEqual([]);
    });

    it("vínculos que comprovam o declarado: sem pendência", () => {
      // 2016-01-01 a 2025-10-31: 119 meses → 35 pontos (teto).
      const l = lancamento(CONFERE, [vinculo("2016-01-01", "2025-10-31")]);
      expect(avaliar(l).calculados.EXPERIENCIA).toBe(35);
      expect(doTipo(l, "acima")).toEqual([]);
    });

    it("Editar nota com justificativa: sem pendência (o caminho legítimo)", () => {
      const l = lancamento({
        situacao: "CONFORME",
        edita_nota: true,
        nota_ajustada: 35,
        justificativas: ["ANTES_DO_DIPLOMA"],
      });
      expect(doTipo(l, "acima")).toEqual([]);
    });

    it("Editar nota acima do calculado sem justificativa: pendência", () => {
      const l = lancamento({
        situacao: "CONFORME",
        edita_nota: true,
        nota_ajustada: 35,
        justificativas: [],
        justificativa_livre: "",
      });
      expect(doTipo(l, "acima")).toHaveLength(1);
    });

    it("Editar nota pelo calculado: sem pendência (a diferença pede a justificativa de sempre)", () => {
      const l = lancamento({
        situacao: "CONFORME",
        edita_nota: true,
        nota_ajustada: null,
      });
      expect(doTipo(l, "acima")).toEqual([]);
      expect(doTipo(l, "justificativa")).toHaveLength(1);
    });

    it("abaixo do mínimo ou sem vínculo: a falta é a do mínimo/registro, não esta", () => {
      expect(
        doTipo(
          lancamento(CONFERE, [vinculo("2026-01-01", "2026-03-31")]),
          "acima",
        ),
      ).toEqual([]);
      expect(doTipo(lancamento(CONFERE, []), "acima")).toEqual([]);
      expect(doTipo(lancamento(CONFERE, []), "comprovado")).toHaveLength(1);
    });

    it("Não confere: a regra existente (mínimo), sem esta", () => {
      const l = lancamento({
        situacao: "NAO_CONFORME",
        motivos: ["ESTAGIO_OU_SIMILAR"],
        nota_ajustada: 0,
      });
      expect(doTipo(l, "acima")).toEqual([]);
      expect(doTipo(l, "minimo").map((p) => p.texto)).toEqual([
        "Experiência marcada como Não confere, mas os vínculos aceitos somam 16 meses (mínimo 6 meses). Desmarque os vínculos que não foram aceitos — sem a experiência mínima o candidato é eliminado — ou marque Confere.",
      ]);
    });

    it("a pendência não muda a conta (espelho inalterado)", () => {
      const l = lancamento(CONFERE);
      const antes = avaliar(l);
      const copia = structuredClone(antes);
      pendenciasDaFicha(REGRA, l, antes, DECLARADA);
      expect(antes).toEqual(copia);
      expect(avaliar(l)).toEqual(copia);
      expect(antes.parciais.EXPERIENCIA).toBe(35);
      expect(antes.parecer).toBe(copia.parecer);
    });
  });
});

bloco("lib/avaliacao-documental-ficha", () => {
  /*
  A ficha da avaliação documental (fase F4, src/lib/avaliacao-documental/ficha.ts):
  o que o candidato declarou por bloco (no formato real da Empregare), o que
  falta para concluir (incluindo a justificativa de nota diferente da
  declarada) e o resumo que vai para o banco. Dados fictícios.
*/
  const CASOS = JSON.parse(
    readFileSync(
      "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
      "utf8",
    ),
  );
  const BASE = CASOS.regras["PROJ26-CURRICULAR"];

  /* A regra do 93/2026 com as perguntas ligadas e a nota declarada (como a correção de 07/10). */
  const REGRA = structuredClone(BASE);
  const PERGUNTAS = {
    IDENTIDADE: ["Anexe o documento de identificação"],
    FORMACAO: ["Qual seu Nível de Titulação Acadêmica"],
    CURSOS: ["Selecione a pontuação relativa à carga horária de Cursos"],
    EXPERIENCIA: [
      "Experiência Profissional em atividades",
      "Anexe o comprovante de Experiência Profissional",
    ],
    COTA_PI: ["Para candidatos que se declaram indígenas"],
  };
  for (const b of REGRA.blocos) b.perguntas = PERGUNTAS[b.codigo] ?? [];
  REGRA.provisoria = {
    ...REGRA.provisoria,
    nota_declarada: [
      {
        parcial: "FORMACAO",
        pergunta: "Qual seu Nível de Titulação Acadêmica",
        tipo: "OPCAO",
        pontos: { Especialização: 5, Mestrado: 8, "Não possuo": 0 },
      },
      {
        parcial: "CURSOS",
        pergunta: "Selecione a pontuação relativa à carga horária de Cursos",
        tipo: "OPCAO",
        pontos: { "Não possuo": 0, "4 pontos": 4, "5 pontos": 5 },
      },
    ],
  };

  const RESPOSTAS = {
    "Pergunta 4 - Anexe o documento de identificação com foto, frente e verso":
      "Anexo",
    "Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo: (contabilizada a partir de 06 meses)":
      '"4 anos ou mais&nbsp;"',
    "Pergunta 12 - Anexe o comprovante de Experiência Profissional em atividades compatíveis com o cargo.":
      "--",
    "Pergunta 13 - Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)":
      '"Especialização"',
    "Pergunta 14 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área":
      '"5 pontos"',
  };
  const DOCUMENTAL = { nota_minima: 15, nota_minima_por_nivel: {} };
  const bloco = (codigo) => REGRA.blocos.find((b) => b.codigo === codigo);

  function lancamentoCompleto(extra = {}) {
    return {
      ...lancamentoInicial({
        regra: REGRA,
        respostas: RESPOSTAS,
        modalidade: "AC",
        cargo: "Engenheiro de Segurança do Trabalho",
        documental: DOCUMENTAL,
      }),
      blocos: {
        IDENTIDADE: { situacao: "CONFORME" },
        ESCOLARIDADE: { situacao: "CONFORME" },
        REGISTRO_CONSELHO: { situacao: "CONFORME" },
        FORMACAO: { situacao: "CONFORME" },
        CURSOS: { situacao: "CONFORME" },
        EXPERIENCIA: { situacao: "CONFORME" },
      },
      titulos: [
        { titulo: "ESPECIALIZACAO", nome: "Especialização", aceito: true },
      ],
      cursos: [
        { nome: "Curso A", horas: 120, aceito: true },
        { nome: "Curso B", horas: 61, aceito: true },
      ],
      vinculos: [
        {
          empregador: "Empresa fictícia",
          categoria: "AREA_OU_SUS",
          inicio: "2020-01-01",
          fim: "2022-12-31",
          aceito: true,
        },
      ],
      ...extra,
    };
  }

  describe("o que o candidato declarou", () => {
    it("lê a resposta das perguntas ligadas ao bloco no formato da Empregare", () => {
      const linhas = respostasDoBloco(bloco("EXPERIENCIA"), RESPOSTAS);
      expect(linhas.map((l) => l.texto)).toEqual(["4 anos ou mais", ""]);
      expect(linhas[0].enunciado).toBe(
        "Experiência Profissional em atividades compatíveis com o cargo",
      );
      expect(respostasDoBloco(bloco("IDENTIDADE"), RESPOSTAS)[0].texto).toBe(
        "Anexo",
      );
    });

    it("múltipla escolha vira a lista das opções marcadas", () => {
      const linhas = respostasDoBloco(
        { perguntas: ["Você se declara"] },
        { "Pergunta 6 - Você se declara:": '"Sou indígena", "Moro em aldeia"' },
      );
      expect(linhas[0].texto).toBe("Sou indígena, Moro em aldeia");
      expect(linhas[0].opcoes).toEqual(["Sou indígena", "Moro em aldeia"]);
    });

    it("sem resposta em nenhuma pergunta sugere Não enviado (AM-7.5)", () => {
      expect(sugereNaoEnviado([{ texto: "" }, { texto: "" }])).toBe(true);
      expect(sugereNaoEnviado([{ texto: "Anexo" }, { texto: "" }])).toBe(false);
      expect(sugereNaoEnviado([])).toBe(false);
    });

    it("pontos declarados só das parciais cuja pergunta foi achada", () => {
      const d = declaradaDaFicha(REGRA, RESPOSTAS);
      expect(d.parciais).toEqual({ FORMACAO: 5, CURSOS: 5 });
      expect(declaradaDaFicha(REGRA, {}).parciais).toEqual({});
    });
  });

  describe("lançamento inicial", () => {
    it("nível pela regra de classificação; sem regra, superior", () => {
      expect(
        nivelDaFicha("Técnico de Enfermagem do Trabalho", {
          niveis_por_cargo: [{ termo: "Técnico", nivel: "tecnico" }],
        }),
      ).toBe("tecnico");
      expect(nivelDaFicha("Engenheiro", {})).toBe("superior");
    });

    it("sem termo na regra, o nível escrito no cargo (93/2026: '(Nível Superior)', 'TÉCNICO DE…')", () => {
      expect(nivelDaFicha("TÉCNICO DE ENFERMAGEM DO TRABALHO", {})).toBe(
        "tecnico",
      );
      expect(
        nivelDaFicha("TÉCNICO DE SEGURANÇA DO TRABALHO (Nível Médio)", {}),
      ).toBe("medio");
      expect(
        nivelDaFicha("ANALISTA DE GESTÃO: MÉDICO DO TRABALHO (Nível Superior)"),
      ).toBe("superior");
    });

    it("indígena e aldeia como o candidato respondeu, só com critério étnico na regra", () => {
      const regra = structuredClone(REGRA);
      regra.blocos.push({
        codigo: "ETNICO",
        titulo: "Critério étnico",
        tipo: "PONTUACAO",
        perguntas: ["Você se declara"],
        indigena: 8,
        aldeia: 6,
        teto: 14,
      });
      const l = lancamentoInicial({
        regra,
        respostas: {
          "Pergunta 6 - Você se declara:": '"Sou indígena", "Moro em aldeia"',
        },
        modalidade: "AC",
      });
      expect(l).toMatchObject({ indigena: true, mora_aldeia: true });
      expect(
        lancamentoInicial({
          regra,
          respostas: { "Pergunta 6 - Você se declara:": '"Não sou indígena"' },
        }).indigena,
      ).toBe(false);
      expect(
        lancamentoInicial({ regra: REGRA, respostas: RESPOSTAS }).indigena,
      ).toBe(false);
    });

    it("o gravado vem por cima", () => {
      const l = lancamentoInicial({
        regra: REGRA,
        respostas: RESPOSTAS,
        gravado: {
          nivel: "tecnico",
          blocos: { CURSOS: { situacao: "NAO_ENVIADO" } },
        },
      });
      expect(l.nivel).toBe("tecnico");
      expect(l.blocos.CURSOS.situacao).toBe("NAO_ENVIADO");
      expect(l.vinculos).toEqual([]);
    });
  });

  describe("o que falta para concluir", () => {
    const declarada = declaradaDaFicha(REGRA, RESPOSTAS);

    it("ficha completa e igual à declarada: nada falta", () => {
      const lanc = lancamentoCompleto({
        cursos: [
          { nome: "Curso A", horas: 120, aceito: true },
          { horas: 61, aceito: true },
        ],
      });
      const av = calcularFicha(REGRA, lanc, DOCUMENTAL);
      expect(av.parciais).toEqual({ FORMACAO: 5, CURSOS: 5, EXPERIENCIA: 25 });
      expect(pendenciasDaFicha(REGRA, lanc, av, declarada)).toEqual([]);
    });

    it("Cursos pela nota: a linha vazia da tela antiga e o item lido do arquivo não trazem a lista de volta", () => {
      const bloco = REGRA.blocos.find((b) => b.tipo === "CURSOS");
      const vazia = { cursos: [{ nome: "", horas: "", aceito: true }] };
      const lido = {
        cursos: [{ nome: "NR-10", horas: 40, aceito: true, do_arquivo: true }],
      };
      const amao = { cursos: [{ nome: "NR-10", horas: 40, aceito: true }] };
      expect(decidePelaNota(bloco, vazia)).toBe(true);
      expect(decidePelaNota(bloco, lido)).toBe(true);
      expect(decidePelaNota(bloco, amao)).toBe(false);
      const lanc = lancamentoCompleto(vazia);
      lanc.blocos.CURSOS = {
        situacao: "CONFORME",
        edita_nota: true,
        nota_ajustada: 5,
      };
      const av = calcularFicha(REGRA, lanc, DOCUMENTAL);
      const p = pendenciasDaFicha(REGRA, lanc, av, declarada);
      expect(
        p.filter(
          (x) =>
            x.bloco === "CURSOS" &&
            ["horas", "item", "comprovado"].includes(x.tipo),
        ),
      ).toEqual([]);
      expect(lancamentoParaGravar(REGRA, lanc).cursos).toEqual([]);
    });

    it("Cursos pela nota: a linha recusada sem motivo (escondida) não vai ao banco e não trava a conclusão", () => {
      // Ficha antiga com o único curso à mão recusado sem motivo: a lista some
      // (decidePelaNota) e a tela não pede nada; o banco (FC_PENDENCIAS_FICHA)
      // pediria "item recusado sem motivo" numa linha que o avaliador não vê.
      const bloco = REGRA.blocos.find((b) => b.tipo === "CURSOS");
      const lanc = lancamentoCompleto({
        cursos: [
          { nome: "NR-10", horas: 40, aceito: false },
          { nome: "NR-35", horas: 40, aceito: false, motivo: "EVENTO" },
        ],
      });
      lanc.blocos.CURSOS = {
        situacao: "CONFORME",
        edita_nota: true,
        nota_ajustada: 5,
      };
      expect(decidePelaNota(bloco, lanc)).toBe(true);
      const av = calcularFicha(REGRA, lanc, DOCUMENTAL);
      expect(
        pendenciasDaFicha(REGRA, lanc, av, declarada).filter(
          (x) => x.bloco === "CURSOS",
        ),
      ).toEqual([]);
      expect(lancamentoParaGravar(REGRA, lanc).cursos).toEqual([
        { nome: "NR-35", horas: 40, aceito: false, motivo: "EVENTO" },
      ]);
    });

    it("bloco sem situação e Não conforme sem motivo", () => {
      const lanc = lancamentoCompleto();
      delete lanc.blocos.IDENTIDADE;
      lanc.blocos.ESCOLARIDADE = { situacao: "NAO_CONFORME" };
      const av = calcularFicha(REGRA, lanc, DOCUMENTAL);
      const p = pendenciasDaFicha(REGRA, lanc, av, declarada);
      expect(p).toContainEqual({
        bloco: "IDENTIDADE",
        tipo: "situacao",
        texto: "Escolha Confere ou Não confere.",
      });
      expect(p).toContainEqual({
        bloco: "ESCOLARIDADE",
        tipo: "motivo",
        texto: "Escolha o motivo.",
      });
    });

    it("Outro motivo (descrever): o texto vale como motivo; sem texto, pede a descrição", () => {
      const lanc = lancamentoCompleto();
      lanc.blocos.ESCOLARIDADE = {
        situacao: "NAO_CONFORME",
        motivos: ["OUTRO"],
        motivo_livre: "curto",
      };
      const faltas = (l) =>
        pendenciasDaFicha(
          REGRA,
          l,
          calcularFicha(REGRA, l, DOCUMENTAL),
          declarada,
        ).filter((p) => p.bloco === "ESCOLARIDADE");
      expect(faltas(lanc)).toEqual([
        {
          bloco: "ESCOLARIDADE",
          tipo: "motivo",
          texto: "Descreva o outro motivo (10 caracteres ou mais).",
        },
      ]);
      lanc.blocos.ESCOLARIDADE.motivo_livre = "Diploma sem o verso.";
      expect(faltas(lanc)).toEqual([]);
      const av = calcularFicha(REGRA, lanc, DOCUMENTAL);
      expect(av.parecer).toContain("Diploma sem o verso.");
    });

    it("Outro motivo na justificativa da nota diferente da declarada", () => {
      const lanc = lancamentoCompleto({
        cursos: [{ nome: "Curso A", horas: 120, aceito: true }],
      });
      lanc.blocos.CURSOS = {
        situacao: "CONFORME",
        justificativas: ["OUTRO"],
        motivo_livre: "",
      };
      const faltas = () =>
        pendenciasDaFicha(
          REGRA,
          lanc,
          calcularFicha(REGRA, lanc, DOCUMENTAL),
          declarada,
        );
      // Uma falta só: a descrição (não também "escolha a justificativa").
      expect(faltas()).toEqual([
        {
          bloco: "CURSOS",
          tipo: "justificativa",
          texto: "Descreva o outro motivo (10 caracteres ou mais).",
        },
      ]);
      lanc.blocos.CURSOS.motivo_livre = "Certificado de 60 h sem assinatura.";
      expect(faltas()).toEqual([]);
    });

    it("cota de outra modalidade não pede nada", () => {
      const lanc = lancamentoCompleto();
      expect(blocoSeAplica(bloco("COTA_PP"), lanc)).toBe(false);
      // A lista das cotas optadas manda (a modalidade única só vale sem ela).
      expect(
        blocoSeAplica(bloco("COTA_PP"), {
          ...lanc,
          modalidade: "PP",
          modalidades: ["PP"],
        }),
      ).toBe(true);
      const { modalidades: _semLista, ...antigo } = lanc;
      expect(
        blocoSeAplica(bloco("COTA_PP"), { ...antigo, modalidade: "PP" }),
      ).toBe(true);
    });

    it("nota diferente da declarada exige justificativa; com ela, não", () => {
      const lanc = lancamentoCompleto({
        cursos: [{ nome: "Curso A", horas: 120, aceito: true }],
      });
      const av = calcularFicha(REGRA, lanc, DOCUMENTAL);
      expect(divergenciaDoBloco(bloco("CURSOS"), av, declarada)).toMatchObject({
        declarada: 5,
        apurada: 3,
        diferenca: -2,
      });
      expect(pendenciasDaFicha(REGRA, lanc, av, declarada)).toEqual([
        {
          bloco: "CURSOS",
          tipo: "justificativa",
          texto: "Pontuação diferente da declarada: escolha a justificativa.",
        },
      ]);
      lanc.blocos.CURSOS = {
        situacao: "CONFORME",
        justificativas: ["CURSOS_DIMINUIDA"],
      };
      const av2 = calcularFicha(REGRA, lanc, DOCUMENTAL);
      expect(pendenciasDaFicha(REGRA, lanc, av2, declarada)).toEqual([]);
      expect(av2.parecer).toContain(
        "Nota de cursos de aperfeiçoamento diminuída",
      );
    });

    it("nota ajustada para mais também exige justificativa e respeita o teto", () => {
      const lanc = lancamentoCompleto({
        cursos: [
          { horas: 120, aceito: true },
          { horas: 61, aceito: true },
        ],
      });
      lanc.blocos.FORMACAO = { situacao: "CONFORME", nota_ajustada: 8 };
      const av = calcularFicha(REGRA, lanc, DOCUMENTAL);
      expect(av.parciais.FORMACAO).toBe(8);
      // Acima do que os títulos aceitos dão, sem Editar nota: também "acima"
      // (o banco recalcula os itens e recusa o mesmo, 20261023090000).
      expect(
        pendenciasDaFicha(REGRA, lanc, av, declarada).map((p) => p.tipo),
      ).toEqual(["acima", "justificativa"]);
      lanc.blocos.FORMACAO.nota_ajustada = 12;
      expect(
        pendenciasDaFicha(
          REGRA,
          lanc,
          calcularFicha(REGRA, lanc, DOCUMENTAL),
          declarada,
        ),
      ).toContainEqual({
        bloco: "FORMACAO",
        tipo: "nota",
        texto: "Ajuste a pontuação entre 0 e 10.",
      });
    });

    it("inapto por requisito não pede justificativa de nota", () => {
      const lanc = lancamentoCompleto({ cursos: [] });
      lanc.blocos.IDENTIDADE = {
        situacao: "NAO_ENVIADO",
        motivos: ["ILEGIVEL"],
      };
      const av = calcularFicha(REGRA, lanc, DOCUMENTAL);
      expect(av.resultado).toBe("INAPTO_REQUISITO");
      expect(pendenciasDaFicha(REGRA, lanc, av, declarada)).toEqual([]);
    });

    it("item recusado sem motivo, vínculo sem data e curso sem horas", () => {
      const lanc = lancamentoCompleto({
        titulos: [{ titulo: "MESTRADO", aceito: false }],
        vinculos: [{ categoria: "AREA_OU_SUS", inicio: "2020-01-01", fim: "" }],
        cursos: [{ nome: "Sem horas", horas: 0 }],
      });
      const textos = pendenciasDaFicha(
        REGRA,
        lanc,
        calcularFicha(REGRA, lanc, DOCUMENTAL),
        {},
      ).map((p) => `${p.bloco}: ${p.texto}`);
      expect(textos).toEqual(
        expect.arrayContaining([
          "FORMACAO: Escolha o motivo da recusa do item.",
          "EXPERIENCIA: Confira o início e o fim do vínculo.",
        ]),
      );
      // Cursos pela nota: a linha sem horas não pede nada (decidePelaNota).
      expect(textos.filter((t) => t.startsWith("CURSOS:"))).toEqual([]);
    });

    it("item recusado (com motivo) não pede datas nem carga horária", () => {
      const lanc = lancamentoCompleto({
        vinculos: [
          {
            categoria: "AREA_OU_SUS",
            inicio: "2020-01-01",
            fim: "",
            aceito: false,
            motivo: "DATAS_ILEGIVEIS",
          },
        ],
        cursos: [{ nome: "Sem horas", horas: "", aceito: false, motivo: "CH" }],
      });
      const tipos = pendenciasDaFicha(
        REGRA,
        lanc,
        calcularFicha(REGRA, lanc, DOCUMENTAL),
        {},
      ).map((p) => p.tipo);
      expect(tipos).not.toContain("datas");
      expect(tipos).not.toContain("horas");
    });
  });

  describe("apoio da tela", () => {
    it("atalhos 1, 2 e 3: Confere, Não confere e Editar nota", () => {
      expect(["1", "2", "3", "4"].map(escolhaDaTecla)).toEqual([
        "CONFERE",
        "NAO_CONFERE",
        "EDITAR",
        null,
      ]);
    });

    it("uma só mensagem por item: a falta mais útil primeiro", () => {
      const pendencias = [
        {
          bloco: "CURSOS",
          tipo: "horas",
          texto: "Informe a carga horária do curso.",
        },
        {
          bloco: "CURSOS",
          tipo: "comprovado",
          texto: "Registre ao menos um curso com carga horária.",
        },
        { bloco: "CURSOS", tipo: "situacao", texto: "Escolha…" },
        {
          bloco: "FORMACAO",
          tipo: "justificativa",
          texto: "Pontuação diferente…",
        },
      ];
      expect(mensagemDoBloco(pendencias, "CURSOS")).toBe(
        "Registre ao menos um curso com carga horária.",
      );
      expect(mensagemDoBloco(pendencias, "CURSOS", { comSituacao: true })).toBe(
        "Escolha…",
      );
      expect(mensagemDoBloco(pendencias, "IDENTIDADE")).toBeNull();
      // Conferido = com decisão e sem falta (o contador e o "!" do stepper).
      const lanc = {
        blocos: {
          CURSOS: { situacao: "CONFORME" },
          IDENTIDADE: { situacao: "CONFORME" },
        },
      };
      expect(itemConferido({ codigo: "CURSOS" }, lanc, pendencias)).toBe(false);
      expect(itemConferido({ codigo: "IDENTIDADE" }, lanc, pendencias)).toBe(
        true,
      );
      expect(itemConferido({ codigo: "FORMACAO" }, lanc, pendencias)).toBe(
        false,
      );
    });

    it("justificativas: os motivos do bloco e as observações prontas", () => {
      const opcoes = opcoesDeJustificativa(REGRA, bloco("EXPERIENCIA"));
      expect(opcoes.map((o) => o.codigo)).toEqual([
        "ANTES_DO_DIPLOMA",
        "ESTAGIO_OU_SIMILAR",
        "ALTERACAO_DE_NOME",
        "EXPERIENCIA_DIMINUIDA",
        "CURSOS_DIMINUIDA",
      ]);
      expect(opcoes[3]).toMatchObject({
        texto: "Nota de experiência diminuída",
        grupo: "Observações prontas",
      });
    });

    it("títulos do nível com os pontos da regra", () => {
      expect(titulosDoNivel(bloco("FORMACAO"), "superior")).toEqual([
        { codigo: "ESPECIALIZACAO", rotulo: "Especialização", pontos: 5 },
        { codigo: "MESTRADO", rotulo: "Mestrado", pontos: 8 },
        { codigo: "DOUTORADO", rotulo: "Doutorado", pontos: 10 },
      ]);
      expect(
        titulosDoNivel(bloco("FORMACAO"), "tecnico").length,
      ).toBeGreaterThan(3);
    });

    it("resumo para gravar traz o que o banco confere", () => {
      const lanc = lancamentoCompleto();
      const av = calcularFicha(REGRA, lanc, DOCUMENTAL);
      const r = resumoParaGravar(av, declaradaDaFicha(REGRA, RESPOSTAS));
      expect(Object.keys(r)).toEqual(
        expect.arrayContaining([
          "resultado",
          "nota_apurada",
          "nota_final",
          "parciais",
          "declarada",
          "eliminatorios",
          "experiencia",
        ]),
      );
      expect(r.declarada).toEqual({ FORMACAO: 5, CURSOS: 5 });
      expect(r.experiencia.meses).toBe(36);
    });

    it("endereço da vaga na Empregare só com código numérico", () => {
      expect(enderecoDaVagaNaEmpregare("177979")).toBe(
        "https://corporate.empregare.com/empresa/vagas",
      );
      expect(enderecoDaVagaNaEmpregare("abc")).toBeNull();
    });

    it("com o identificador interno, a vaga abre direto nas candidaturas", () => {
      expect(enderecoDaVagaNaEmpregare("177979", "Ab1cD2eF3g|")).toBe(
        "https://corporate.empregare.com/empresa/vagas/candidaturas/Ab1cD2eF3g|",
      );
      // O código numérico não abre (Sem permissão) e lixo não vira endereço: lista de vagas.
      for (const ruim of ["177979|", "177979", "a b", "x/../y", "", null])
        expect(enderecoDaVagaNaEmpregare("177979", ruim)).toBe(
          "https://corporate.empregare.com/empresa/vagas",
        );
    });

    it("link do candidato só se for a página de detalhes da Empregare", () => {
      const link =
        "https://corporate.empregare.com/empresa/curriculo/detalhes?tokenCandidato=TKfict&id=IDfict|&candidatura=CDfict||";
      expect(enderecoDoCandidatoNaEmpregare(link)).toBe(link);
      for (const ruim of [
        null,
        "",
        "javascript:alert(1)",
        "https://exemplo.invalid/empresa/curriculo/detalhes?x=1",
        "http://corporate.empregare.com/empresa/curriculo/detalhes?x=1",
        `${link}"><script>`,
      ])
        expect(enderecoDoCandidatoNaEmpregare(ruim)).toBeNull();
    });

    it("alteração do histórico em texto", () => {
      expect(
        textoDaAlteracao({ rotulo: "Experiência", de: 25, para: 20 }),
      ).toBe("Experiência: 25 → 20");
      expect(
        textoDaAlteracao({ rotulo: "Situação", de: null, para: "CONFORME" }),
      ).toBe("Situação: — → CONFORME");
    });
  });

  describe("conferência: em análise, progresso e o que falta", () => {
    const declarada = declaradaDaFicha(REGRA, RESPOSTAS);
    const conferir = (lanc) => {
      const av = calcularFicha(REGRA, lanc, DOCUMENTAL);
      const pendencias = pendenciasDaFicha(REGRA, lanc, av, declarada);
      return {
        av,
        pendencias,
        c: conferenciaDaFicha(REGRA, lanc, av, pendencias),
      };
    };
    const nova = () =>
      lancamentoInicial({
        regra: REGRA,
        respostas: RESPOSTAS,
        modalidade: "AC",
        cargo: "Engenheiro de Segurança do Trabalho",
        documental: DOCUMENTAL,
      });

    it("ficha recém-aberta: em análise (neutro), não Inapto, mesmo com a conta dando Inapto", () => {
      const { av, c } = conferir(nova());
      // A conta conta o bloco não marcado como Conforme e a experiência sem vínculo elimina.
      expect(av.resultado).toBe("INAPTO_REQUISITO");
      expect(c.situacao).toBe("EM_ANALISE");
      expect(c).toMatchObject({
        total: 6,
        conferidos: 0,
        requisitos: { total: 4, conferidos: 0 },
        pode_concluir: false,
      });
      expect(textoDaSituacaoDaConferencia(c)).toBe(
        "Em análise · 0 de 4 requisitos conferidos",
      );
      expect(textoDoProgresso(c)).toBe("0 de 6 conferidos");
    });

    it("antes de conferir, a nota diferente da declarada não pede justificativa", () => {
      const lanc = nova();
      lanc.cursos = [{ nome: "Curso A", horas: 120, aceito: true }];
      const { av, pendencias } = conferir(lanc);
      expect(divergenciaDoBloco(bloco("CURSOS"), av, declarada)).not.toBeNull();
      expect(
        pendencias.filter((p) => p.bloco === "CURSOS").map((p) => p.tipo),
      ).toEqual(["situacao"]);
      lanc.blocos.CURSOS = { situacao: "CONFORME" };
      lanc.vinculos = lancamentoCompleto().vinculos;
      expect(
        conferir(lanc)
          .pendencias.filter((p) => p.bloco === "CURSOS")
          .map((p) => p.tipo),
      ).toEqual(["justificativa"]);
    });

    it("Inapto só quando um requisito conferido elimina", () => {
      const lanc = nova();
      lanc.blocos.IDENTIDADE = { situacao: "CONFORME" };
      expect(conferir(lanc).c.situacao).toBe("EM_ANALISE");
      lanc.blocos.REGISTRO_CONSELHO = {
        situacao: "NAO_ENVIADO",
        motivos: ["SEM_REGISTRO"],
      };
      const { c } = conferir(lanc);
      expect(c.situacao).toBe("INAPTO_REQUISITO");
      expect(textoDaSituacaoDaConferencia(c)).toBe("Inapto (requisito)");
      expect(c.requisitos).toEqual({ total: 4, conferidos: 2 });
    });

    it("experiência conferida abaixo do mínimo elimina; tudo conferido mostra o resultado da conta", () => {
      const lanc = nova();
      lanc.blocos.EXPERIENCIA = { situacao: "CONFORME" };
      expect(conferir(lanc).c.situacao).toBe("INAPTO_REQUISITO");
      const completo = lancamentoCompleto();
      const { c } = conferir(completo);
      expect(c).toMatchObject({
        situacao: "APTO",
        conferidos: 6,
        total: 6,
        texto_da_falta: "",
        pode_concluir: true,
      });
    });

    it("o que falta, com o tipo da falta entre parênteses", () => {
      const lanc = lancamentoCompleto({
        cursos: [{ nome: "Curso A", horas: 120, aceito: true }],
      });
      delete lanc.blocos.FORMACAO;
      const { c } = conferir(lanc);
      expect(c.texto_da_falta).toBe(
        "Falta: Formação Acadêmica, Cursos de Aperfeiçoamento (justificativa)",
      );
      expect(c.pode_concluir).toBe(false);
      const { c: tudo } = conferir(nova());
      expect(tudo.texto_da_falta).toBe(
        "Falta: Documento de identificação oficial com foto, Formação exigida pela vaga, Registro ativo no conselho de classe e mais 3",
      );
      expect(nomeCurtoDoBloco(bloco("COTA_PCD"))).toBe(
        "Pessoa com deficiência",
      );
    });
  });

  describe("experiência declarada por nível (93/2026)", () => {
    const COM_EXP = structuredClone(REGRA);
    COM_EXP.provisoria.nota_declarada.push({
      parcial: "EXPERIENCIA",
      pergunta: "Experiência Profissional",
      tipo: "OPCAO",
      pontos_por_nivel: {
        superior: { "6 meses obrigatórios": 0, "2 anos": 15 },
        tecnico: { "6 meses obrigatórios": 0, "2 anos": 12 },
        medio: { "6 meses obrigatórios": 0, "2 anos": 12 },
      },
    });
    const RESP = {
      ...RESPOSTAS,
      "Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo: (contabilizada a partir de 06 meses)":
        '"2 anos&nbsp;"',
    };

    it("o bloco de experiência mostra os pontos declarados do nível da vaga", () => {
      expect(declaradaDaFicha(COM_EXP, RESP, "superior").parciais).toEqual({
        FORMACAO: 5,
        CURSOS: 5,
        EXPERIENCIA: 15,
      });
      expect(
        declaradaDaFicha(COM_EXP, RESP, "tecnico").parciais.EXPERIENCIA,
      ).toBe(12);
      expect(
        declaradaDaFicha(COM_EXP, RESP, "fundamental").parciais.EXPERIENCIA,
      ).toBeUndefined();
    });

    it("nota apurada da experiência diferente da declarada exige justificativa", () => {
      const lanc = lancamentoCompleto();
      const av = calcularFicha(COM_EXP, lanc, DOCUMENTAL);
      expect(av.parciais.EXPERIENCIA).toBe(25);
      const declarada = declaradaDaFicha(COM_EXP, RESP, lanc.nivel);
      expect(pendenciasDaFicha(COM_EXP, lanc, av, declarada)).toContainEqual({
        bloco: "EXPERIENCIA",
        tipo: "justificativa",
        texto: "Pontuação diferente da declarada: escolha a justificativa.",
      });
      expect(resumoParaGravar(av, declarada).declarada.EXPERIENCIA).toBe(15);
    });
  });

  describe("modo de análise: etapas, prévia do parecer e anexos", () => {
    const declarada = declaradaDaFicha(REGRA, RESPOSTAS);
    const nova = () =>
      lancamentoInicial({
        regra: REGRA,
        respostas: RESPOSTAS,
        modalidade: "AC",
        cargo: "Engenheiro de Segurança do Trabalho",
        documental: DOCUMENTAL,
      });
    const conta = (lanc) => {
      const av = calcularFicha(REGRA, lanc, DOCUMENTAL);
      const pendencias = pendenciasDaFicha(REGRA, lanc, av, declarada);
      return {
        av,
        pendencias,
        c: conferenciaDaFicha(REGRA, lanc, av, pendencias),
      };
    };

    it("nomes curtos das etapas do 93/2026", () => {
      expect(
        REGRA.blocos
          .filter((b) => b.tipo !== "COTA" && b.tipo !== "REGISTRO")
          .map(nomeDaEtapa),
      ).toEqual([
        "Identidade",
        "Formação",
        "Conselho",
        "Titulação",
        "Cursos",
        "Experiência",
      ]);
      expect(nomeDaEtapa({ titulo: "Qualquer", rotulo_curto: "Meu" })).toBe(
        "Meu",
      );
    });

    it("estado de cada etapa: não conferido, conforme, não enviado e pendência", () => {
      const lanc = nova();
      lanc.blocos.IDENTIDADE = { situacao: "CONFORME" };
      lanc.blocos.ESCOLARIDADE = { situacao: "NAO_ENVIADO" };
      lanc.blocos.REGISTRO_CONSELHO = {
        situacao: "NAO_CONFORME",
        motivos: ["SEM_REGISTRO"],
      };
      const { pendencias } = conta(lanc);
      expect(etapasDaFicha(REGRA, lanc, pendencias)).toEqual([
        {
          codigo: "IDENTIDADE",
          nome: "Identidade",
          estado: "CONFORME",
          motivo: null,
        },
        {
          codigo: "ESCOLARIDADE",
          nome: "Formação",
          estado: "pendencia",
          // O "!" diz o que falta: a mesma mensagem do item.
          motivo: "Escolha o motivo.",
        },
        {
          codigo: "REGISTRO_CONSELHO",
          nome: "Conselho",
          estado: "NAO_CONFORME",
          motivo: null,
        },
        {
          codigo: "FORMACAO",
          nome: "Titulação",
          estado: "nao_conferido",
          motivo: null,
        },
        {
          codigo: "CURSOS",
          nome: "Cursos",
          estado: "nao_conferido",
          motivo: null,
        },
        {
          codigo: "EXPERIENCIA",
          nome: "Experiência",
          estado: "nao_conferido",
          motivo: null,
        },
      ]);
    });

    it("com item não conferido, a prévia do parecer não traz resultado; só os motivos já lançados", () => {
      const lanc = nova();
      const { av, c } = conta(lanc);
      // A conta, sozinha, já daria INABILITADO (experiência sem vínculo).
      expect(av.parecer).toContain("INABILITADO");
      const previa = previaDoParecer(av, c, lanc);
      expect(previa).toEqual({
        completa: false,
        texto: TEXTO_DO_PARECER_EM_ANALISE,
        motivos: [],
      });
      lanc.blocos.REGISTRO_CONSELHO = {
        situacao: "NAO_ENVIADO",
        motivos: ["SEM_REGISTRO"],
      };
      const depois = conta(lanc);
      const comMotivo = previaDoParecer(depois.av, depois.c, lanc);
      expect(comMotivo.completa).toBe(false);
      expect(comMotivo.texto).not.toMatch(/HABILITADO/);
      expect(comMotivo.motivos).toHaveLength(1);
      expect(comMotivo.motivos[0]).toMatch(/^Item 6\.4: /);
    });

    it("tudo conferido: o parecer da conta", () => {
      const lanc = lancamentoCompleto();
      const { av, c } = conta(lanc);
      expect(previaDoParecer(av, c, lanc)).toEqual({
        completa: true,
        texto: av.parecer,
        motivos: [],
      });
      expect(av.parecer).toContain("HABILITADO(A)");
    });

    it("anexo: a resposta que a Empregare escreve como Anexo", () => {
      expect(ehAnexo("Anexo")).toBe(true);
      expect(ehAnexo(" anexo ")).toBe(true);
      expect(ehAnexo("Especialização")).toBe(false);
      expect(ehAnexo("")).toBe(false);
    });
  });

  describe("modo foco: passos, próximo pendente e composição da nota", () => {
    const nova = () =>
      lancamentoInicial({
        regra: REGRA,
        respostas: RESPOSTAS,
        modalidade: "AC",
        cargo: "Engenheiro de Segurança do Trabalho",
        documental: DOCUMENTAL,
      });
    const declarada = declaradaDaFicha(REGRA, RESPOSTAS);
    const pendencias = (lanc) =>
      pendenciasDaFicha(
        REGRA,
        lanc,
        calcularFicha(REGRA, lanc, DOCUMENTAL),
        declarada,
      );

    it("as etapas e, no fim, a Conclusão (pronta só sem pendência)", () => {
      const lanc = nova();
      const passos = passosDaFicha(REGRA, lanc, pendencias(lanc));
      expect(passos.map((p) => p.codigo)).toEqual([
        "IDENTIDADE",
        "ESCOLARIDADE",
        "REGISTRO_CONSELHO",
        "FORMACAO",
        "CURSOS",
        "EXPERIENCIA",
        PASSO_DA_CONCLUSAO,
      ]);
      expect(passos.at(-1)).toEqual({
        codigo: "CONCLUSAO",
        nome: "Conclusão",
        estado: "nao_conferido",
      });
      expect(passosDaFicha(REGRA, lanc, []).at(-1).estado).toBe("pronta");
    });

    it("o critério étnico fica nos passos mesmo antes de valer (é nele que se marca Indígena)", () => {
      const regra = structuredClone(REGRA);
      regra.blocos.push({
        codigo: "ETNICO",
        titulo: "Critério étnico",
        tipo: "PONTUACAO",
        perguntas: [],
        indigena: 8,
        aldeia: 6,
        teto: 14,
      });
      const lanc = { ...nova(), indigena: false };
      const etnico = passosDaFicha(regra, lanc, []).find(
        (p) => p.codigo === "ETNICO",
      );
      expect(etnico).toEqual({
        codigo: "ETNICO",
        nome: "Critério étnico",
        estado: "opcional",
      });
      const comIndigena = passosDaFicha(regra, { ...lanc, indigena: true }, []);
      expect(comIndigena.find((p) => p.codigo === "ETNICO").estado).toBe(
        "nao_conferido",
      );
    });

    it("depois de decidir, vai ao próximo que pede algo; volta ao começo; com tudo resolvido, à Conclusão", () => {
      const passos = [
        { codigo: "A", estado: "CONFORME" },
        { codigo: "B", estado: "nao_conferido" },
        { codigo: "C", estado: "NAO_CONFORME" },
        { codigo: "D", estado: "pendencia" },
        { codigo: "E", estado: "opcional" },
        { codigo: PASSO_DA_CONCLUSAO, estado: "nao_conferido" },
      ];
      expect(proximoPassoPendente(passos, "A")).toBe("B");
      expect(proximoPassoPendente(passos, "B")).toBe("D");
      expect(proximoPassoPendente(passos, "D")).toBe("B");
      expect(proximoPassoPendente(passos, null)).toBe("B");
      expect(
        proximoPassoPendente(
          passos.map((p) => ({ ...p, estado: "CONFORME" })),
          "A",
        ),
      ).toBe(PASSO_DA_CONCLUSAO);
    });

    it("a composição: apurado só depois de conferir, declarado, teto no nível e a diferença", () => {
      const lanc = nova();
      const av0 = calcularFicha(REGRA, lanc, DOCUMENTAL);
      expect(composicaoDaNota(REGRA, lanc, av0, declarada)).toEqual([
        {
          bloco: "FORMACAO",
          parcial: "FORMACAO",
          rotulo: "Formação Acadêmica",
          apurado: null,
          declarado: 5,
          teto: 10,
          divergente: false,
        },
        {
          bloco: "CURSOS",
          parcial: "CURSOS",
          rotulo: "Cursos de Aperfeiçoamento",
          apurado: null,
          declarado: 5,
          teto: 5,
          divergente: false,
        },
        expect.objectContaining({
          bloco: "EXPERIENCIA",
          apurado: null,
          teto: 35,
        }),
      ]);
      lanc.blocos.FORMACAO = { situacao: "CONFORME" };
      const av1 = calcularFicha(REGRA, lanc, DOCUMENTAL);
      expect(composicaoDaNota(REGRA, lanc, av1, declarada)[0]).toMatchObject({
        apurado: 0,
        divergente: true,
      });
    });
  });
});

bloco("lib/avaliacao-documental-fila-por-mudancas", () => {
  /*
  A fila só com o que mudou (supabase/migrations/20261014231000): a junção da
  resposta parcial com a fila que a tela tem, e quando não dá (lê inteira).
*/

  const linha = (id, extra = {}) => ({
    id,
    vaga: "182418",
    codigo: id.toUpperCase(),
    situacao_pre: "NO_LOTE",
    ficha: { id: `f-${id}`, situacao: "PENDENTE", versao: 1 },
    ...extra,
  });

  const ANTERIOR = Object.freeze({
    gerado_em: "2026-10-15T12:00:00Z",
    marca: "m1",
    parcial: false,
    vagas: [{ codigo: "182418" }],
    analistas: [{ id: "u1", pendentes: 3 }],
    candidatos: [linha("a"), linha("b"), linha("c")],
  });

  describe("argumentosDaFilaDesde", () => {
    it("com gerado_em e marca: pede só o que mudou desde então", () => {
      expect(argumentosDaFilaDesde("e1", ANTERIOR)).toEqual({
        p_edital: "e1",
        p_desde: "2026-10-15T12:00:00Z",
        p_marca: "m1",
      });
    });

    it("sem leitura anterior (ou sem marca): pede a fila inteira", () => {
      const inteira = { p_edital: "e1", p_desde: null, p_marca: null };
      expect(argumentosDaFilaDesde("e1", null)).toEqual(inteira);
      expect(
        argumentosDaFilaDesde("e1", { gerado_em: "2026-10-15T12:00:00Z" }),
      ).toEqual(inteira);
    });
  });

  describe("aplicarMudancasDaFila", () => {
    it("a fila inteira (parcial false) volta como veio", () => {
      const inteira = { ...ANTERIOR, gerado_em: "2026-10-15T12:05:00Z" };
      expect(aplicarMudancasDaFila(null, inteira)).toBe(inteira);
    });

    it("parcial: troca as linhas no lugar, mantém as vagas e atualiza o resto", () => {
      const b = linha("b", {
        ficha: { id: "f-b", situacao: "EM_ANALISE", versao: 2 },
      });
      const r = aplicarMudancasDaFila(ANTERIOR, {
        gerado_em: "2026-10-15T12:05:00Z",
        marca: "m1",
        parcial: true,
        analistas: [{ id: "u1", pendentes: 2 }],
        candidatos: [b],
        saiu: [],
        total_nucleo: 3,
      });
      expect(r.candidatos.map((c) => c.id)).toEqual(["a", "b", "c"]);
      expect(r.candidatos[1]).toBe(b);
      expect(r.candidatos[0]).toBe(ANTERIOR.candidatos[0]);
      expect(r.vagas).toBe(ANTERIOR.vagas);
      expect(r.analistas).toEqual([{ id: "u1", pendentes: 2 }]);
      expect(r.gerado_em).toBe("2026-10-15T12:05:00Z");
      expect(r.parcial).toBe(false);
      expect(r).not.toHaveProperty("total_nucleo");
      expect(r).not.toHaveProperty("saiu");
    });

    it("parcial sem mudança: a mesma lista", () => {
      const r = aplicarMudancasDaFila(ANTERIOR, {
        gerado_em: "2026-10-15T12:05:00Z",
        marca: "m1",
        parcial: true,
        candidatos: [],
        saiu: [],
        total_nucleo: 3,
      });
      expect(r.candidatos).toEqual(ANTERIOR.candidatos);
    });

    it("tira as que saíram do núcleo", () => {
      const r = aplicarMudancasDaFila(ANTERIOR, {
        parcial: true,
        candidatos: [],
        saiu: ["c", "z"],
        total_nucleo: 2,
      });
      expect(r.candidatos.map((c) => c.id)).toEqual(["a", "b"]);
    });

    it("linha nova no núcleo ou total diferente: null (a tela lê a fila inteira)", () => {
      expect(
        aplicarMudancasDaFila(ANTERIOR, {
          parcial: true,
          candidatos: [linha("d")],
          saiu: [],
          total_nucleo: 4,
        }),
      ).toBeNull();
      expect(
        aplicarMudancasDaFila(ANTERIOR, {
          parcial: true,
          candidatos: [],
          saiu: [],
          total_nucleo: 5,
        }),
      ).toBeNull();
    });

    it("parcial sem fila anterior ou resposta inválida: null", () => {
      expect(
        aplicarMudancasDaFila(null, {
          parcial: true,
          candidatos: [],
          total_nucleo: 0,
        }),
      ).toBeNull();
      expect(aplicarMudancasDaFila(ANTERIOR, null)).toBeNull();
      expect(aplicarMudancasDaFila(ANTERIOR, [])).toBeNull();
    });
  });

  describe("parcial vazia (20261103171500_leituras_pesadas_sem_refazer)", () => {
    it("sem mudança, o banco não monta nada e a fila da tela fica a mesma (com o gerado_em de antes)", () => {
      const vazia = {
        marca: "m1",
        parcial: true,
        total_nucleo: ANTERIOR.candidatos.length,
        candidatos: [],
        saiu: [],
      };
      const r = aplicarMudancasDaFila(ANTERIOR, vazia);
      expect(r).toEqual(ANTERIOR);
      expect(argumentosDaFilaDesde("e1", r)).toEqual(
        argumentosDaFilaDesde("e1", ANTERIOR),
      );
    });

    it("com outro total do núcleo, lê a fila inteira", () => {
      expect(
        aplicarMudancasDaFila(ANTERIOR, {
          marca: "m1",
          parcial: true,
          total_nucleo: 7,
          candidatos: [],
          saiu: [],
        }),
      ).toBeNull();
    });
  });
});

bloco("lib/avaliacao-documental-fila", () => {
  const AGORA = new Date("2026-10-06T15:00:00Z");
  const EM_10_MIN = "2026-10-06T15:10:00Z";
  const HA_5_MIN = "2026-10-06T14:55:00Z";

  const ficha = (id, situacao, extra = {}) => ({
    id,
    versao: 2,
    situacao,
    responsavel: null,
    reserva: null,
    ...extra,
  });
  const FILA = [
    {
      id: "c1",
      vaga: "10",
      codigo: "7001",
      nome: "Ana Lúcia",
      situacao_pre: "NO_LOTE",
      posicao: 1,
      modalidade: "AC",
      ficha: ficha("f1", "EM_ANALISE", {
        responsavel: "u-a",
        reserva: {
          usuario: "u-a",
          nome: "Ana",
          desde: HA_5_MIN,
          expira: EM_10_MIN,
        },
      }),
    },
    {
      id: "c2",
      vaga: "10",
      codigo: "7002",
      nome: "Bruno",
      situacao_pre: "NO_LOTE",
      posicao: 2,
      modalidade: "PP",
      ficha: ficha("f2", "PENDENTE", { responsavel: "u-b" }),
    },
    {
      id: "c3",
      vaga: "20",
      codigo: "7003",
      nome: "Carla",
      situacao_pre: "NO_LOTE",
      posicao: 1,
      modalidade: "AC",
      ficha: ficha("f3", "PENDENTE"),
    },
    {
      id: "c4",
      vaga: "20",
      codigo: "7004",
      nome: "Davi",
      situacao_pre: "ANALISADO",
      posicao: 2,
      modalidade: "AC",
      ficha: ficha("f4", "CONCLUIDA", { responsavel: "u-a" }),
    },
    {
      id: "c5",
      vaga: "10",
      codigo: "7005",
      nome: "Eva",
      situacao_pre: "ELIMINADO",
      posicao: null,
      modalidade: "AC",
      ficha: ficha("f5", "FORA_LOTE", { responsavel: "u-b" }),
    },
    {
      id: "c6",
      vaga: "10",
      codigo: "7006",
      nome: "Fábio",
      situacao_pre: "RANQUEADO",
      posicao: 3,
      modalidade: "AC",
      ficha: null,
    },
    {
      id: "c7",
      vaga: "20",
      codigo: "7007",
      nome: "Gil",
      situacao_pre: "NO_LOTE",
      posicao: 3,
      modalidade: "AC",
      ficha: ficha("f7", "REVISAR", { responsavel: "u-b" }),
    },
  ];
  const EQUIPE = [
    { usuario: "u-a", nome: "Ana", vagas: null, limite: null, pendentes: 1 },
    { usuario: "u-b", nome: "Beto", vagas: ["10"], limite: null, pendentes: 1 },
  ];

  describe("etapas e contadores (abas com contadores)", () => {
    it("conta cada etapa do funil", () => {
      expect(contadoresDaFila(FILA)).toEqual({
        inscritos: 7,
        lote: 5,
        pendentes: 2,
        em_analise: 1,
        revisao: 1,
        concluidas: 1,
        eliminados: 1,
        fora: 2,
      });
      expect(contadoresDaFila(null).inscritos).toBe(0);
    });
    it("sem ficha não é pendente; fora do lote não é do lote", () => {
      expect(naEtapa(FILA[5], "pendentes")).toBe(false);
      expect(naEtapa(FILA[4], "lote")).toBe(false);
      expect(naEtapa(FILA[4], "eliminados")).toBe(true);
      // Fora do lote: todos os que não estão no lote (eliminados também).
      expect(naEtapa(FILA[4], "fora")).toBe(true);
      expect(naEtapa(FILA[0], "fora")).toBe(false);
    });
  });

  describe("filtros", () => {
    it("normaliza o filtro salvo (só chaves conhecidas, etapa válida)", () => {
      expect(normalizarFiltro({ etapa: "x", vaga: " 10 ", outra: 1 })).toEqual({
        ...FILTRO_INICIAL,
        vaga: "10",
      });
      expect(normalizarFiltro(null)).toEqual(FILTRO_INICIAL);
      expect(filtroEhInicial({})).toBe(true);
      expect(filtroEhInicial({ etapa: "pendentes" })).toBe(false);
    });
    it("Minhas fichas, sem responsável, vaga, modalidade e busca sem acento", () => {
      const ids = (f, eu) => filtrarFila(FILA, f, eu).map((c) => c.id);
      expect(ids({ etapa: "inscritos", responsavel: "eu" }, "u-a")).toEqual([
        "c1",
        "c4",
      ]);
      expect(ids({ etapa: "inscritos", responsavel: "eu" }, "")).toEqual([]);
      expect(ids({ etapa: "lote", responsavel: "ninguem" })).toEqual(["c3"]);
      expect(ids({ etapa: "lote", responsavel: "u-b" })).toEqual(["c2", "c7"]);
      expect(ids({ etapa: "lote", vaga: "20" })).toEqual(["c3", "c4", "c7"]);
      expect(ids({ etapa: "inscritos", modalidade: "PP" })).toEqual(["c2"]);
      expect(ids({ etapa: "inscritos", busca: "lucia" })).toEqual(["c1"]);
      expect(ids({ etapa: "inscritos", busca: "7006" })).toEqual(["c6"]);
    });
    it("AM-6.4: o código abre direto só com uma ficha que casa", () => {
      expect(fichaPeloCodigo(FILA, " 7002 ")?.id).toBe("c2");
      expect(fichaPeloCodigo(FILA, "7006")).toBeNull();
      expect(fichaPeloCodigo(FILA, "")).toBeNull();
    });
  });

  describe("AM-12.2: reserva", () => {
    const reserva = FILA[0].ficha.reserva;
    it("vale até expirar", () => {
      expect(reservaVigente(reserva, AGORA)).toBe(true);
      expect(reservaVigente(reserva, new Date("2026-10-06T15:11:00Z"))).toBe(
        false,
      );
      expect(reservaVigente(null, AGORA)).toBe(false);
    });
    it("mostra quem está e desde quando", () => {
      expect(textoDaReserva(reserva, "u-b", AGORA)).toMatch(
        /^Em uso por Ana desde \d{2}:\d{2}$/,
      );
      expect(textoDaReserva(reserva, "u-a", AGORA)).toMatch(
        /^Com você até \d{2}:\d{2}$/,
      );
      expect(
        textoDaReserva(reserva, "u-a", new Date("2026-10-07T00:00:00Z")),
      ).toBe("");
    });
  });

  describe("ações em lote e o plano da distribuição", () => {
    it("cada ação pega só o que cabe nela", () => {
      const a = acoesDaSelecao(FILA, AGORA);
      expect(a.distribuir.map((c) => c.id)).toEqual(["c1", "c2", "c3", "c7"]);
      expect(a.liberar.map((c) => c.id)).toEqual(["c1"]);
      expect(a.revisao.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
      // Concluída (c4) e em revisão (c7): só reabrir; concluída não é atribuída (AM-6.3).
      expect(a.reabrir.map((c) => c.id)).toEqual(["c4", "c7"]);
      expect(a.distribuir.map((c) => c.id)).not.toContain("c4");
    });
    it("o ⋯ da linha concluída oferece Reabrir, não Atribuir", () => {
      const c4 = FILA.find((c) => c.id === "c4");
      expect(acoesDaFicha(c4, AGORA)).toEqual(["reabrir"]);
      const c7 = FILA.find((c) => c.id === "c7");
      expect(acoesDaFicha(c7, AGORA)).toEqual(["distribuir", "reabrir"]);
    });
    it("AM-6.2: a prévia distribui na ordem da Provisória, tirando da carga o que é redistribuído", () => {
      const p = planoDeDistribuicao([FILA[2], FILA[1]], EQUIPE, {
        criterio: "PARTES_IGUAIS",
      });
      // c2 (vaga 10, pos 2) e c3 (vaga 20, pos 1): c3 primeiro; Beto só analisa a vaga 10.
      expect(p.atribuicoes).toEqual([
        { ficha: "f3", usuario: "u-a", versao: 2 },
        { ficha: "f2", usuario: "u-b", versao: 2 },
      ]);
      expect(p.redistribui).toBe(true);
      expect(p.resumo).toEqual([
        { usuario: "u-a", nome: "Ana", novas: 1, total: 2 },
        { usuario: "u-b", nome: "Beto", novas: 1, total: 1 },
      ]);
    });
    it("para uma pessoa ou de volta à fila", () => {
      const p = planoDeDistribuicao([FILA[2], FILA[1]], EQUIPE, {}, "u-b");
      expect(p.atribuicoes).toEqual([
        { ficha: "f2", usuario: "u-b", versao: 2 },
      ]);
      expect(p.sobra).toEqual(["f3"]);
      const f = planoDeDistribuicao([FILA[1]], EQUIPE, {}, "fila");
      expect(f.atribuicoes).toEqual([
        { ficha: "f2", usuario: null, versao: 2 },
      ]);
      expect(f.resumo).toEqual([]);
    });
    it("regra com distribuicao nula no banco: abre o Distribuir como sem critério", () => {
      expect(planoDeDistribuicao([FILA[2], FILA[1]], EQUIPE, null)).toEqual(
        planoDeDistribuicao([FILA[2], FILA[1]], EQUIPE, {}),
      );
    });
  });

  describe("editais vigentes no seletor", () => {
    const EDITAIS = [
      { id: "a", edital: "93/2026", ativo: true, status: "Em andamento" },
      { id: "b", edital: "23/2025", ativo: true, status: "Concluído" },
      { id: "c", edital: "FCC", ativo: true, status: "Cancelado" },
      { id: "d", edital: "10/2026", ativo: false, status: "Em andamento" },
      { id: "e", edital: "11/2026", ativo: true },
    ];
    it("só os vigentes, com o escolhido mantido e o total dos ocultos", () => {
      expect(editaisDaEscolha(EDITAIS).lista.map((e) => e.id)).toEqual([
        "a",
        "e",
      ]);
      expect(editaisDaEscolha(EDITAIS).ocultos).toBe(3);
      expect(
        editaisDaEscolha(EDITAIS, { escolhido: "b" }).lista.map((e) => e.id),
      ).toEqual(["a", "b", "e"]);
      expect(editaisDaEscolha(EDITAIS, { todos: true }).lista).toHaveLength(5);
      expect(editalVigente(null)).toBe(false);
    });
  });

  describe("colunas de cada aba, ordem e CSV", () => {
    const eliminado = {
      id: "c9",
      vaga: "11",
      codigo: "7009",
      nome: "=Cmd|' /C calc'!A0",
      situacao_pre: "ELIMINADO",
      posicao: null,
      art: 12.5,
      motivo_eliminacao: "Cancelou a inscrição",
      ficha: null,
    };
    const concluida = {
      id: "c3",
      vaga: "10",
      codigo: "7003",
      nome: "Carla",
      situacao_pre: "NO_LOTE",
      posicao: 3,
      art: 20,
      ficha: ficha("f3", "CONCLUIDA", {
        resultado: "INAPTO_NOTA",
        nota_final: 12.25,
        responsavel_nome: "Ana",
        concluida_em: "2026-10-06T17:30:00Z",
      }),
    };

    it("Eliminados mostra código, nome, vaga, motivo e ART (sem posição, reserva nem responsável)", () => {
      expect(colunasDaEtapa("eliminados")).toEqual([
        "codigo",
        "nome",
        "vaga",
        "motivo",
        "art",
      ]);
      expect(textoDaColuna(eliminado, "motivo")).toBe("Cancelou a inscrição");
      expect(textoDaColuna(eliminado, "art")).toBe("12,5");
      expect(textoDaSituacaoNaFila(eliminado)).toBe("Eliminado");
      // Ficha sem situação (dado incompleto): texto vazio, nunca undefined.
      expect(textoDaSituacaoNaFila({ ...eliminado, ficha: { id: "f9" } })).toBe(
        "",
      );
    });

    it("Concluídas: nota, resultado, responsável e data; Pendentes: posição, ART, responsável e reserva", () => {
      expect(colunasDaEtapa("concluidas")).toEqual(
        expect.arrayContaining([
          "nota",
          "resultado",
          "responsavel",
          "concluida_em",
        ]),
      );
      expect(colunasDaEtapa("concluidas")).not.toContain("reserva");
      expect(textoDaColuna(concluida, "resultado")).toBe(
        "Inapto (nota mínima)",
      );
      expect(textoDaColuna(concluida, "nota")).toBe("12,25");
      expect(textoDaColuna(concluida, "concluida_em")).toBe(
        "06/10/2026, 14:30",
      );
      expect(colunasDaEtapa("pendentes")).toEqual(
        expect.arrayContaining(["posicao", "art", "responsavel", "reserva"]),
      );
    });

    it("ordena por coluna (números como número, vazio no fim) e volta à ordem do banco", () => {
      const lista = [concluida, eliminado, FILA[0], FILA[1]];
      expect(
        ordenarFila(lista, { chave: "posicao", sentido: "asc" }).map(
          (c) => c.codigo,
        ),
      ).toEqual(["7001", "7002", "7003", "7009"]);
      expect(
        ordenarFila(lista, { chave: "posicao", sentido: "desc" }).map(
          (c) => c.codigo,
        ),
      ).toEqual(["7003", "7002", "7001", "7009"]);
      expect(
        ordenarFila(lista, { chave: "nome", sentido: "asc" })[0].codigo,
      ).toBe("7009");
      expect(ordenarFila(lista, { chave: "", sentido: "" })).toBe(lista);
      let ordem = proximaOrdem({ chave: "", sentido: "" }, "art");
      expect(ordem).toEqual({ chave: "art", sentido: "asc" });
      ordem = proximaOrdem(ordem, "art");
      expect(ordem).toEqual({ chave: "art", sentido: "desc" });
      expect(proximaOrdem(ordem, "art")).toEqual({ chave: "", sentido: "" });
    });

    it("CSV da aba: colunas da aba, ';', BOM e célula protegida contra fórmula", () => {
      const csv = csvDaFila([eliminado], "eliminados");
      expect(
        csv.startsWith(
          "\uFEFFCódigo;Nome;Vaga;Motivo da eliminação;Nota declarada (ART)\r\n",
        ),
      ).toBe(true);
      expect(csv).toContain(
        "7009;'=Cmd|' /C calc'!A0;11;Cancelou a inscrição;12,5",
      );
      expect(
        nomeDoCsvDaFila("93/2026", "eliminados", new Date(2026, 9, 6)),
      ).toBe("fila-93-2026-eliminados-2026-10-06.csv");
    });
  });

  describe("andamento por vaga e agrupamento da tabela", () => {
    const c = (codigo, vaga, extra = {}) => ({
      id: `c-${codigo}`,
      codigo,
      vaga,
      situacao_pre: "NO_LOTE",
      entrada: "REGRA",
      ficha: null,
      ...extra,
    });
    const f = (situacao) => ({ id: `f-${situacao}`, situacao });
    const CANDIDATOS = [
      c("1", "A", { ficha: f("CONCLUIDA"), nota: 30 }),
      c("2", "A", { ficha: f("EM_ANALISE"), nota: 28 }),
      c("3", "A", { ficha: f("PENDENTE"), nota: 25 }),
      c("4", "A", { nota: 24 }),
      c("5", "A", { entrada: "DECISAO", ficha: f("PENDENTE"), nota: 9 }),
      c("6", "A", { situacao_pre: "ELIMINADO", nota: 40 }),
      c("7", "B", { ficha: f("REVISAR"), art: 18 }),
      c("8", "B", {
        ficha: f("CONCLUIDA"),
        situacao_pre: "ANALISADO",
        art: 20,
      }),
      c("9", "C", { situacao_pre: "RANQUEADO" }),
    ];
    const VAGAS = [
      { codigo: "B", cargo: "Enfermeiro" },
      { codigo: "A", cargo: "Técnico" },
      { codigo: "C", cargo: "Médico" },
    ];

    it("conta o andamento do edital e de cada vaga com lote, na ordem das vagas", () => {
      const a = andamentoDaFila(CANDIDATOS, VAGAS);
      expect(a.total).toEqual({
        lote: 7,
        concluidas: 2,
        em_analise: 1,
        revisao: 1,
        pendentes: 3,
      });
      expect(a.vagas.map((v) => v.codigo)).toEqual(["B", "A"]);
      expect(a.vagas[1]).toEqual({
        codigo: "A",
        cargo: "Técnico",
        lotacao: "",
        lote: 5,
        concluidas: 1,
        em_analise: 1,
        revisao: 0,
        pendentes: 3,
      });
    });

    it("o grupo da vaga: lote pela regra + por decisão e a linha de corte só com os da regra", () => {
      expect(resumoDaVagaNaFila(CANDIDATOS, "A")).toEqual({
        pelaRegra: 4,
        porDecisao: 1,
        total: 5,
        corte: 24,
      });
      // Sem a nota do lote, a ART.
      expect(resumoDaVagaNaFila(CANDIDATOS, "B").corte).toBe(18);
      expect(resumoDaVagaNaFila(CANDIDATOS, "C")).toMatchObject({
        total: 0,
        corte: null,
      });
    });

    it("agrupa por vaga sem mudar a ordem dentro do grupo", () => {
      const linhas = [
        CANDIDATOS[2],
        CANDIDATOS[6],
        CANDIDATOS[0],
        CANDIDATOS[7],
      ];
      expect(agruparPorVaga(linhas, VAGAS).map((x) => x.codigo)).toEqual([
        "7",
        "8",
        "3",
        "1",
      ]);
    });
  });
});

bloco("lib/avaliacao-documental-justificativa-dos-itens", () => {
  /*
  A "Justificativa do ajuste" (pedido das COREs na Avaliação documental): o
  resumo dos itens aceitos e dos não pontuados, montado do que foi lançado, e
  quando ele acompanha os itens no campo justificativa_livre. Regra
  PROJ26-CURRICULAR dos casos dourados (cursos: faixas 40–60, 61–119 e ≥120 h,
  teto 5; titulação: a maior; experiência: blocos de 6 meses além do mínimo
  de 6). Dados fictícios.
*/
  const CASOS = JSON.parse(
    readFileSync(
      "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
      "utf8",
    ),
  );
  const REGRA = CASOS.regras["PROJ26-CURRICULAR"];
  const bloco = (codigo) => REGRA.blocos.find((b) => b.codigo === codigo);

  /* A leitura de um arquivo com três certificados (o terceiro foi recusado). */
  const LEITURAS = [
    {
      resposta: "8019889",
      pergunta: "915",
      arquivo: 1,
      situacao: "LIDO",
      metodo: "TEXTO",
      itens: [
        { tipo: "CURSO", curso: "Arboviroses", horas: 145 },
        { tipo: "CURSO", curso: "Saúde Indígena", horas: 60 },
        { tipo: "CURSO", curso: "Primeiros Socorros", horas: 20 },
      ],
    },
  ];

  function retrato(lancamento, declarada = null) {
    const regra = regraDaFicha(REGRA, lancamento);
    return {
      regra,
      lancamento,
      avaliacao: calcularAvaliacao(regra, lancamento),
      declarada,
    };
  }

  const base = (extra = {}) => ({
    nivel: "superior",
    modalidade: "AC",
    blocos: {},
    titulos: [],
    cursos: [],
    vinculos: [],
    ...extra,
  });

  describe("resumo dos cursos", () => {
    it("aceitos com a faixa e os pontos; não pontuados agrupados pelo motivo", () => {
      const l = base({
        blocos: { CURSOS: { situacao: "CONFORME" } },
        cursos: [
          { nome: "A", horas: 145, aceito: true },
          { nome: "B", horas: 60, aceito: true },
          { nome: "C", horas: 30, aceito: true },
          { nome: "D", horas: 20, aceito: true },
          { nome: "Congresso", horas: 16, aceito: false, motivo: "EVENTO" },
          { nome: "Sem horas", horas: "", aceito: true },
          { nome: "", horas: "", aceito: true },
        ],
        recusas_lidas: {
          "8019889:915:1:2": { motivo: "CARGA_NAO_COMPROVADA" },
        },
      });
      const j = justificativaDoBloco(retrato(l), bloco("CURSOS"), LEITURAS);
      expect(j.texto).toBe(
        "Aceitos 2 cursos (205 h): 145 h (faixa ≥120 h, 3 pontos) e 60 h (faixa 40–60 h, 1 ponto). " +
          "Não pontuados: 2 cursos (30 h e 20 h) — abaixo de 40 h (8.2.6); " +
          "1 curso de 16 h — eventos acadêmicos, palestras, workshops, simpósios, seminários, congressos e afins não são pontuados (6.4); " +
          "1 curso — sem carga horária; 1 curso de 20 h — carga horária não comprovada.",
      );
      expect(j.naoPontuados).toBe(5);
      expect(j.precisa).toBe(true);
    });

    it("a soma acima do teto aparece; o nível muda as faixas", () => {
      const cursos = [120, 130].map((horas) => ({ horas, aceito: true }));
      const superior = base({
        blocos: { CURSOS: { situacao: "CONFORME" } },
        cursos,
      });
      expect(
        justificativaDoBloco(retrato(superior), bloco("CURSOS"), []).texto,
      ).toBe(
        "Aceitos 2 cursos (250 h): 120 h (faixa ≥120 h, 3 pontos) e 130 h (faixa ≥120 h, 3 pontos). Soma de 6 pontos limitada ao teto de 5.",
      );
      const tecnico = { ...superior, nivel: "tecnico" };
      expect(
        justificativaDoBloco(retrato(tecnico), bloco("CURSOS"), []).texto,
      ).toContain(
        "6 pontos) e 130 h (faixa ≥120 h, 6 pontos). Soma de 12 pontos limitada ao teto de 10.",
      );
    });

    it("todos aceitos e pontuação igual à declarada: não precisa", () => {
      const l = base({
        blocos: { CURSOS: { situacao: "CONFORME" } },
        cursos: [{ horas: 120, aceito: true }],
      });
      const j = justificativaDoBloco(
        retrato(l, { parciais: { CURSOS: 3 } }),
        bloco("CURSOS"),
        [],
      );
      expect(j).toEqual({
        texto: "Aceito 1 curso: 120 h (faixa ≥120 h, 3 pontos).",
        naoPontuados: 0,
        precisa: false,
      });
      // Declarou 5: a diferença pede a justificativa.
      expect(
        justificativaDoBloco(
          retrato(l, { parciais: { CURSOS: 5 } }),
          bloco("CURSOS"),
          [],
        ).precisa,
      ).toBe(true);
    });

    it("sem Confere (Não confere ou sem decisão) não precisa", () => {
      const cursos = [{ horas: 30, aceito: true }];
      for (const situacao of [undefined, "NAO_CONFORME"]) {
        const l = base({ blocos: { CURSOS: { situacao } }, cursos });
        const j = justificativaDoBloco(retrato(l), bloco("CURSOS"), []);
        expect(j.texto).toBe(
          "Nenhum curso pontuado. Não pontuados: 1 curso de 30 h — abaixo de 40 h (8.2.6).",
        );
        expect(j.precisa).toBe(false);
      }
    });

    it("o texto respeita o limite do campo no banco", () => {
      // Um curso lançado à mão e aceito: ficha antiga, com a lista.
      const cursos = [
        { nome: "A", horas: 40, aceito: true },
        ...Array.from({ length: 49 }, (_, i) => ({
          horas: 1 + i,
          aceito: false,
          motivo: i % 2 ? "EVENTO" : "OUTRO",
        })),
      ];
      const l = base({ blocos: { CURSOS: { situacao: "CONFORME" } }, cursos });
      const blocoLongo = {
        ...bloco("CURSOS"),
        motivos: [
          ...bloco("CURSOS").motivos,
          { codigo: "OUTRO", texto: "x".repeat(1900), item_edital: "6.4" },
        ],
      };
      const j = justificativaDoBloco(retrato(l), blocoLongo, []);
      expect(j.texto.length).toBe(TAMANHO_DA_JUSTIFICATIVA);
      expect(j.texto.endsWith("…")).toBe(true);
    });
  });

  describe("resumo da titulação e da experiência", () => {
    it("titulação: vale o maior; recusado com o motivo; sem pontos no nível", () => {
      const l = base({
        blocos: { FORMACAO: { situacao: "CONFORME" } },
        titulos: [
          { titulo: "ESPECIALIZACAO", aceito: true },
          { titulo: "MESTRADO", aceito: true },
          {
            titulo: "ESPECIALIZACAO",
            aceito: false,
            motivo: "LATO_SENSU_SEM_CH",
          },
          { titulo: "GRADUACAO", aceito: true },
        ],
      });
      const j = justificativaDoBloco(retrato(l), bloco("FORMACAO"), []);
      expect(j.texto).toBe(
        "Aceitos 2 títulos: Especialização (5 pontos) e Mestrado (8 pontos); vale o maior. " +
          "Não pontuados: 1 título (Especialização) — certificado de pós-graduação lato sensu sem a carga horária mínima de 360h não foi pontuado (8.2.10.4); " +
          "1 título (Graduação) — sem pontos no nível da vaga.",
      );
      expect(j.naoPontuados).toBe(2);
    });

    it("experiência: dias unidos, dias em comum, a conta além do mínimo e os não contados", () => {
      const l = base({
        blocos: { EXPERIENCIA: { situacao: "CONFORME" } },
        vinculos: [
          {
            categoria: "AREA_OU_SUS",
            inicio: "2020-01-01",
            fim: "2021-12-31",
            aceito: true,
          },
          {
            categoria: "AREA_OU_SUS",
            inicio: "2021-07-01",
            fim: "2022-12-31",
            aceito: true,
          },
          {
            categoria: "AREA_OU_SUS",
            inicio: "2018-01-01",
            fim: "2018-12-31",
            aceito: false,
            motivo: "ESTAGIO_OU_SIMILAR",
          },
        ],
      });
      const j = justificativaDoBloco(retrato(l), bloco("EXPERIENCIA"), []);
      expect(j.texto).toBe(
        "Aceitos 2 vínculos: 1.096 dias unidos (3 anos e 1 dia; 36 meses); 184 dias em comum entre vínculos contam uma vez. " +
          "Além do mínimo de 6 meses: 30 meses → 5 períodos de 6 meses → 25 pontos. " +
          "Não contados: 1 vínculo — estágio curricular, monitoria, tutoria, docência, bolsa ou voluntariado não comprovam experiência profissional (8.2.5).",
      );
    });

    it("experiência abaixo do mínimo: a conta fica de fora (o parecer já diz)", () => {
      const l = base({
        blocos: { EXPERIENCIA: { situacao: "CONFORME" } },
        vinculos: [
          {
            categoria: "AREA_OU_SUS",
            inicio: "2024-01-01",
            fim: "2024-03-31",
            aceito: true,
          },
        ],
      });
      const j = justificativaDoBloco(retrato(l), bloco("EXPERIENCIA"), []);
      expect(j.texto).toBe(
        "Aceito 1 vínculo: 91 dias unidos (3 meses e 1 dia; 3 meses).",
      );
      expect(j.texto).not.toContain("mínimo");
    });
  });

  describe("a justificativa acompanha os itens (comJustificativasDosItens)", () => {
    const comCursos = (cursos, blocoCursos = { situacao: "CONFORME" }) =>
      base({ blocos: { CURSOS: blocoCursos }, cursos });
    const texto = (l) => l.blocos.CURSOS?.justificativa_livre;

    it("na abertura, preenche só o campo vazio do item que precisa", () => {
      const l = comCursos([{ horas: 30, aceito: true }]);
      const aberto = comJustificativasDosItens(null, retrato(l), []);
      expect(texto(aberto)).toBe(
        "Nenhum curso pontuado. Não pontuados: 1 curso de 30 h — abaixo de 40 h (8.2.6).",
      );
      const escrito = comCursos([{ horas: 30, aceito: true }], {
        situacao: "CONFORME",
        justificativa_livre: "Texto do avaliador.",
      });
      expect(comJustificativasDosItens(null, retrato(escrito), [])).toBe(
        escrito,
      );
      const semNecessidade = comCursos([{ horas: 120, aceito: true }]);
      expect(
        comJustificativasDosItens(
          null,
          retrato(semNecessidade, { parciais: { CURSOS: 3 } }),
          [],
        ),
      ).toBe(semNecessidade);
    });

    it("o texto automático segue os itens; o editado fica; sem necessidade, sai", () => {
      const antes = retrato(
        comJustificativasDosItens(
          null,
          retrato(comCursos([{ horas: 30, aceito: true }])),
          [],
        ),
      );
      // Mais um curso: o resumo muda e o texto automático acompanha.
      const mais = structuredClone(antes.lancamento);
      mais.cursos.push({ horas: 60, aceito: true });
      const depois = comJustificativasDosItens(antes, retrato(mais), []);
      expect(texto(depois)).toBe(
        "Aceito 1 curso: 60 h (faixa 40–60 h, 1 ponto). Não pontuados: 1 curso de 30 h — abaixo de 40 h (8.2.6).",
      );
      // O avaliador editou: mexer nos itens não apaga o texto dele.
      const editado = structuredClone(depois);
      editado.blocos.CURSOS.justificativa_livre = "Texto do avaliador.";
      const outro = structuredClone(editado);
      outro.cursos.push({ horas: 120, aceito: true });
      expect(
        texto(comJustificativasDosItens(retrato(editado), retrato(outro), [])),
      ).toBe("Texto do avaliador.");
      // Tirou o curso de 30 h (sem não pontuado, sem declarada): o automático sai.
      const semTrinta = structuredClone(depois);
      semTrinta.cursos = [{ horas: 60, aceito: true }];
      expect(
        texto(
          comJustificativasDosItens(retrato(depois), retrato(semTrinta), []),
        ),
      ).toBe("");
    });

    it("apagado pelo avaliador fica apagado enquanto os itens não mudam", () => {
      const l = comCursos([{ horas: 30, aceito: true }], {
        situacao: "CONFORME",
        justificativa_livre: "",
      });
      const antes = retrato(l);
      const outra = { ...structuredClone(l), observacoes: "Observação geral." };
      const depois = comJustificativasDosItens(antes, retrato(outra), []);
      expect(texto(depois)).toBe("");
    });

    it("Não confere tira o texto automático; voltar a Confere põe de novo", () => {
      const aberto = comJustificativasDosItens(
        null,
        retrato(comCursos([{ horas: 30, aceito: true }])),
        [],
      );
      const naoConfere = structuredClone(aberto);
      naoConfere.blocos.CURSOS.situacao = "NAO_CONFORME";
      const semTexto = comJustificativasDosItens(
        retrato(aberto),
        retrato(naoConfere),
        [],
      );
      expect(texto(semTexto)).toBe("");
      const confere = structuredClone(semTexto);
      confere.blocos.CURSOS.situacao = "CONFORME";
      expect(
        texto(
          comJustificativasDosItens(retrato(semTexto), retrato(confere), []),
        ),
      ).toContain("abaixo de 40 h");
    });

    it("o texto entra no parecer sem repetir o motivo escolhido que ele já cita", () => {
      const l = comJustificativasDosItens(
        null,
        retrato(
          comCursos(
            [
              { horas: 120, aceito: true },
              { horas: 16, aceito: false, motivo: "EVENTO" },
            ],
            { situacao: "CONFORME", justificativas: ["EVENTO"] },
          ),
        ),
        [],
      );
      const { observacoes } = calcularAvaliacao(REGRA, l);
      expect(observacoes).toEqual([
        "Item 8.2.6: Aceito 1 curso: 120 h (faixa ≥120 h, 3 pontos). Não pontuados: 1 curso de 16 h — eventos acadêmicos, palestras, workshops, simpósios, seminários, congressos e afins não são pontuados (6.4).",
      ]);
    });
  });
});

bloco("lib/avaliacao-documental-leitura-dos-arquivos", () => {
  /*
  O que o robô leu dos arquivos, na ficha: a leitura vem pronta do Python
  (tests/python/test_leitura_de_arquivos.py testa a interpretação); aqui só a
  validação do que a RPC devolve, o texto de cada item e as decisões do
  avaliador no lançamento (aceitar vira linha com do_arquivo; recusar fica em
  recusas_lidas com o motivo; desfazer volta a pendente).
*/
  const CURSOS = { codigo: "CURSOS", tipo: "CURSOS" };
  const EXPERIENCIA = {
    codigo: "EXPERIENCIA",
    tipo: "VINCULOS",
    categorias: [{ codigo: "AREA_OU_SUS" }],
  };
  const FORMACAO = { codigo: "FORMACAO", tipo: "TITULOS" };
  const ANEXO = {
    resposta: "8019889",
    pergunta: "555",
    arquivo: 1,
    link: "https://corporate.empregare.com/Company/VacancyTests/GetViewerLogArquivo?arquivo=a.pdf&nome=Case",
    nome: "a.pdf",
  };
  const curso = (curso, horas, alertas = []) => ({
    tipo: "CURSO",
    curso,
    horas,
    instituicao: "Fiocruz MS",
    conclusao: "2023-05-12",
    pagina: 1,
    alertas,
  });
  const LEITURA = {
    resposta: "8019889",
    pergunta: "555",
    arquivo: 1,
    situacao: "LIDO",
    metodo: "TEXTO",
    documento: "CERTIFICADO",
    paginas: 11,
    nome_confere: true,
    cpf_confere: null,
    itens: [
      curso("Enfrentamento das Arboviroses", 145),
      curso("Saúde Indígena", 60),
      curso("Primeiros Socorros", 20, [
        {
          codigo: "HORAS_ABAIXO_MINIMO",
          texto: "20 h, abaixo do mínimo de 40 h do edital",
        },
      ]),
    ],
    alertas: [],
    resumo: "3 certificados · 145 h, 60 h, 20 h · nome confere",
  };

  describe("leituras da ficha", () => {
    it("valida o que a RPC devolve e acha a leitura do anexo", () => {
      const leituras = leiturasDaFicha([
        LEITURA,
        { ...LEITURA, resposta: "x" },
        { ...LEITURA, situacao: "TALVEZ" },
        {
          ...LEITURA,
          pergunta: "556",
          itens: [{ tipo: "OUTRA" }, curso("X", 1)],
        },
      ]);
      expect(leituras).toHaveLength(2);
      expect(leituras[1].itens).toHaveLength(1);
      expect(leituraDoAnexo(leituras, ANEXO)?.resumo).toBe(LEITURA.resumo);
      expect(leituraDoAnexo(leituras, { ...ANEXO, arquivo: 2 })).toBeNull();
      expect(leiturasDaFicha(null)).toEqual([]);
    });

    it("o item lido numa linha, sem calcular nada", () => {
      expect(textoDoItemLido(LEITURA.itens[0])).toBe(
        "Enfrentamento das Arboviroses · 145 h · Fiocruz MS · 2023",
      );
      expect(
        textoDoItemLido({
          tipo: "VINCULO",
          empregador: "Hospital Regional",
          cargo: "Enfermeira",
          inicio: "2018-02-01",
          fim: "2020-01-31",
          carga_semanal: 40,
          dias: 730,
        }),
      ).toBe(
        "Hospital Regional · Enfermeira · 01/02/2018 a 31/01/2020 · 40 h/sem · 730 dias",
      );
      expect(
        textoDoItemLido({
          tipo: "VINCULO",
          empregador: "Prefeitura",
          inicio: "2020-03-01",
          fim: null,
          atual: true,
          dias: 2000,
        }),
      ).toBe("Prefeitura · 01/03/2020 a atual · 2.000 dias até hoje");
      expect(
        textoDoItemLido({
          tipo: "VINCULO",
          empregador: "Prefeitura",
          cargo: "Técnico de enfermagem",
          inicio: "2020-03-01",
          fim: null,
          atual: true,
          dias: 2000,
          dias_ate: "2025-08-21",
        }),
      ).toBe(
        "Prefeitura · Técnico de enfermagem · 01/03/2020 a atual · 2.000 dias até 21/08/2025",
      );
      // Declaração sem saída nem "até a presente data": nunca "?"; sem carga declarada, diz.
      expect(
        textoDoItemLido({
          tipo: "VINCULO",
          empregador: "Fundação Exemplo",
          cargo: "Médica",
          inicio: "2020-03-10",
          fim: null,
          atual: false,
          fim_nao_informado: true,
          carga_nao_encontrada: true,
          dias: 0,
        }),
      ).toBe(
        "Fundação Exemplo · Médica · desde 10/03/2020, fim não informado · carga não encontrada",
      );
      expect(
        textoDoItemLido({
          tipo: "VINCULO",
          empregador: "SESI",
          inicio: "2024-09-01",
          fim: null,
          atual: true,
          plantonista: true,
          plantao_horas: 12,
          dias: 758,
          dias_ate: "2026-09-28",
        }),
      ).toBe(
        "SESI · 01/09/2024 a atual · plantões de 12 h · 758 dias até 28/09/2026",
      );
      expect(
        textoDoItemLido({
          tipo: "TITULO",
          titulo: "MESTRADO",
          curso: "Saúde Coletiva",
          data: "2019-12-10",
        }),
      ).toBe("Mestrado · Saúde Coletiva · 2019");
    });

    it("os itens do bloco para conferir, com a chave e os alertas do arquivo", () => {
      const leitura = {
        ...LEITURA,
        alertas: [{ codigo: "NOME_DIVERGENTE", texto: "O nome não aparece" }],
      };
      const itens = itensParaConferir(CURSOS, leiturasDaFicha([leitura]), [
        ANEXO,
      ]);
      expect(itens.map((i) => i.chave)).toEqual([
        "8019889:555:1:0",
        "8019889:555:1:1",
        "8019889:555:1:2",
      ]);
      expect(itens[0].alertas.map((a) => a.codigo)).toEqual([
        "NOME_DIVERGENTE",
      ]);
      expect(itens[2].alertas.map((a) => a.codigo)).toEqual([
        "NOME_DIVERGENTE",
        "HORAS_ABAIXO_MINIMO",
      ]);
      expect(alertasDoArquivo(leitura)).toBe("O nome não aparece");
      // Bloco de outro tipo e leitura ilegível: nada para conferir.
      expect(
        itensParaConferir(EXPERIENCIA, leiturasDaFicha([LEITURA]), [ANEXO]),
      ).toEqual([]);
      expect(
        itensParaConferir(
          CURSOS,
          leiturasDaFicha([{ ...LEITURA, situacao: "ILEGIVEL" }]),
          [ANEXO],
        ),
      ).toEqual([]);
    });

    it("a linha que o item vira ao aceitar", () => {
      expect(linhaDoItemLido(CURSOS, LEITURA.itens[0], "1:2:1:0")).toEqual({
        nome: "Enfrentamento das Arboviroses",
        horas: 145,
        aceito: true,
        do_arquivo: "1:2:1:0",
      });
      expect(
        linhaDoItemLido(
          EXPERIENCIA,
          {
            tipo: "VINCULO",
            empregador: "Hospital",
            cargo: "Enfermeira",
            inicio: "2018-02-01",
            fim: null,
            atual: true,
          },
          "1:2:1:0",
        ),
      ).toEqual({
        empregador: "Hospital · Enfermeira",
        categoria: "AREA_OU_SUS",
        inicio: "2018-02-01",
        fim: "",
        aceito: true,
        do_arquivo: "1:2:1:0",
      });
      expect(
        linhaDoItemLido(
          FORMACAO,
          {
            tipo: "TITULO",
            titulo: "MESTRADO",
            curso: "Saúde",
            instituicao: "UF",
          },
          "1:2:1:0",
        ),
      ).toEqual({
        titulo: "MESTRADO",
        nome: "Saúde · UF",
        aceito: true,
        do_arquivo: "1:2:1:0",
      });
      expect(
        linhaDoItemLido(
          FORMACAO,
          { tipo: "TITULO", titulo: "OUTRO" },
          "1:2:1:0",
        ),
      ).toBeNull();
      expect(
        linhaDoItemLido(CURSOS, { tipo: "VINCULO" }, "1:2:1:0"),
      ).toBeNull();
    });
  });

  describe("decisões do avaliador no lançamento", () => {
    const itens = itensParaConferir(CURSOS, leiturasDaFicha([LEITURA]), [
      ANEXO,
    ]);
    const vazio = {
      nivel: "superior",
      cursos: [{ nome: "", horas: "", aceito: true }],
    };

    it("aceitar vira linha (no lugar da linha vazia) e recusar guarda o motivo", () => {
      let l = aceitarItemLido(vazio, CURSOS, itens[0]);
      expect(l.cursos).toEqual([
        {
          nome: "Enfrentamento das Arboviroses",
          horas: 145,
          aceito: true,
          do_arquivo: "8019889:555:1:0",
        },
      ]);
      expect(estadoDoItemLido(l, CURSOS, itens[0].chave)).toBe("ACEITO");
      // Aceitar de novo não duplica.
      expect(aceitarItemLido(l, CURSOS, itens[0]).cursos).toHaveLength(1);
      l = recusarItemLido(l, CURSOS, itens[2].chave, "CARGA_NAO_COMPROVADA");
      expect(l.recusas_lidas).toEqual({
        "8019889:555:1:2": { motivo: "CARGA_NAO_COMPROVADA" },
      });
      expect(estadoDoItemLido(l, CURSOS, itens[2].chave)).toBe("RECUSADO");
      expect(estadoDoItemLido(l, CURSOS, itens[1].chave)).toBe("PENDENTE");
      // Recusar o aceito tira a linha; aceitar o recusado tira a recusa.
      l = recusarItemLido(l, CURSOS, itens[0].chave, "FORA_DA_AREA");
      expect(l.cursos).toEqual([]);
      l = aceitarItemLido(l, CURSOS, itens[2]);
      expect(Object.keys(l.recusas_lidas)).toEqual(["8019889:555:1:0"]);
      // Desfazer volta a pendente (e some com recusas_lidas vazio).
      l = desfazerDecisaoLida(
        desfazerDecisaoLida(l, CURSOS, itens[0].chave),
        CURSOS,
        itens[2].chave,
      );
      expect(l.recusas_lidas).toBeUndefined();
      expect(l.cursos).toEqual([]);
      // O lançamento de entrada não muda.
      expect(vazio.cursos).toHaveLength(1);
    });

    it("motivo fora da lista não grava; o outro… guarda o texto como foi digitado", () => {
      expect(recusarItemLido(vazio, CURSOS, itens[0].chave, "PORQUE_SIM")).toBe(
        vazio,
      );
      const l = recusarItemLido(
        vazio,
        CURSOS,
        itens[0].chave,
        "OUTRO",
        "certificado repetido ",
      );
      expect(l.recusas_lidas[itens[0].chave]).toEqual({
        motivo: "OUTRO",
        texto: "certificado repetido ",
      });
      expect(rotuloDaRecusa(l.recusas_lidas[itens[0].chave])).toBe(
        "certificado repetido",
      );
      expect(rotuloDaRecusa({ motivo: "FORA_DA_AREA" })).toBe(
        "fora da área da vaga",
      );
    });

    it("aceitar todos sem alerta deixa o item com alerta para o avaliador", () => {
      const l = aceitarTodosSemAlerta(
        { nivel: "superior", cursos: [] },
        CURSOS,
        itens,
      );
      expect(l.cursos.map((c) => c.horas)).toEqual([145, 60]);
      expect(estadoDoItemLido(l, CURSOS, itens[2].chave)).toBe("PENDENTE");
    });

    it("conferir todos aceita os pendentes com ou sem alerta e não mexe no recusado nem no já aceito", () => {
      const base = recusarItemLido(
        aceitarItemLido({ nivel: "superior", cursos: [] }, CURSOS, itens[0]),
        CURSOS,
        itens[1].chave,
        "FORA_DA_AREA",
      );
      const { lancamento: l, aceitos } = conferirTodos(base, CURSOS, itens);
      expect(aceitos).toEqual([itens[2].chave]);
      expect(l.cursos.map((c) => c.horas)).toEqual([145, 20]);
      expect(estadoDoItemLido(l, CURSOS, itens[1].chave)).toBe("RECUSADO");
      expect(l.recusas_lidas[itens[1].chave].motivo).toBe("FORA_DA_AREA");
      // Desfazer: só os aceitos naquele clique voltam a pendente.
      const d = desfazerAceitos(l, CURSOS, aceitos);
      expect(d.cursos.map((c) => c.horas)).toEqual([145]);
      expect(estadoDoItemLido(d, CURSOS, itens[2].chave)).toBe("PENDENTE");
      expect(estadoDoItemLido(d, CURSOS, itens[1].chave)).toBe("RECUSADO");
      // Tudo pendente: os três de uma vez; o lançamento de entrada não muda.
      const vazio = { nivel: "superior", cursos: [] };
      expect(
        conferirTodos(vazio, CURSOS, itens).lancamento.cursos.map(
          (c) => c.horas,
        ),
      ).toEqual([145, 60, 20]);
      expect(vazio.cursos).toEqual([]);
    });

    it("conferir todos deixa o incompleto pendente (curso sem horas)", () => {
      const semHoras = itensParaConferir(
        CURSOS,
        leiturasDaFicha([
          {
            ...LEITURA,
            itens: [curso("Sem carga", null), curso("Com carga", 80)],
          },
        ]),
        [ANEXO],
      );
      const { lancamento: l, aceitos } = conferirTodos(
        { nivel: "superior", cursos: [] },
        CURSOS,
        semHoras,
      );
      expect(aceitos).toEqual([semHoras[1].chave]);
      expect(l.cursos.map((c) => c.horas)).toEqual([80]);
      expect(estadoDoItemLido(l, CURSOS, semHoras[0].chave)).toBe("PENDENTE");
    });

    it("aceitar todos sem alerta deixa o incompleto pendente (vínculo atual sem a data do fim, curso sem horas)", () => {
      const vinculo = {
        tipo: "VINCULO",
        empregador: "Instituto",
        inicio: "2022-01-01",
        fim: null,
        atual: true,
        alertas: [],
      };
      const leitura = {
        ...LEITURA,
        itens: [vinculo, { ...vinculo, fim: "2023-12-31", atual: false }],
      };
      const doVinculo = itensParaConferir(
        EXPERIENCIA,
        leiturasDaFicha([leitura]),
        [ANEXO],
      );
      const l = aceitarTodosSemAlerta(
        { nivel: "superior", vinculos: [] },
        EXPERIENCIA,
        doVinculo,
      );
      expect(l.vinculos.map((v) => v.fim)).toEqual(["2023-12-31"]);
      expect(estadoDoItemLido(l, EXPERIENCIA, doVinculo[0].chave)).toBe(
        "PENDENTE",
      );
      const semHoras = itensParaConferir(
        CURSOS,
        leiturasDaFicha([{ ...LEITURA, itens: [curso("Sem carga", null)] }]),
        [ANEXO],
      );
      expect(
        aceitarTodosSemAlerta(
          { nivel: "superior", cursos: [] },
          CURSOS,
          semHoras,
        ).cursos,
      ).toEqual([]);
    });
  });

  describe("corrigir o item lido, alertas resumidos e foto", () => {
    const VINCULO = {
      tipo: "VINCULO",
      empregador: "Instituto de Saúde",
      cargo: "Enfermeiro",
      inicio: "2024-02-01",
      fim: null,
      atual: true,
      dias: 984,
    };
    const leitura = { ...LEITURA, pergunta: "912", itens: [VINCULO] };
    const [item] = itensParaConferir(EXPERIENCIA, leiturasDaFicha([leitura]), [
      { ...ANEXO, pergunta: "912" },
    ]);

    it("o atual com emissão vira fim; sem emissão, o fim fica em branco e o texto diz até hoje", () => {
      expect(
        linhaDoItemLido(
          EXPERIENCIA,
          { ...VINCULO, dias_ate: "2025-08-21" },
          "1:2:1:0",
        ).fim,
      ).toBe("2025-08-21");
      expect(linhaDoItemLido(EXPERIENCIA, VINCULO, "1:2:1:0").fim).toBe("");
      expect(textoDoItemLido(VINCULO)).toContain("984 dias até hoje");
    });

    it("aceitar com a correção: a linha corrigida no lugar, marcada corrigido; sem mudança, sem a marca", () => {
      const base = {
        nivel: "superior",
        vinculos: [{ empregador: "", inicio: "", fim: "", aceito: true }],
        recusas_lidas: { [item.chave]: { motivo: "ILEGIVEL" } },
      };
      const linha = linhaParaCorrigir(EXPERIENCIA, item.item, item.chave);
      const corrigido = aceitarItemCorrigido(base, EXPERIENCIA, item, {
        ...linha,
        fim: "2026-10-13",
      });
      // A linha vazia aberta sai; a recusa do item também.
      expect(corrigido.vinculos).toEqual([
        {
          empregador: "Instituto de Saúde · Enfermeiro",
          categoria: "AREA_OU_SUS",
          inicio: "2024-02-01",
          fim: "2026-10-13",
          aceito: true,
          do_arquivo: item.chave,
          corrigido: true,
        },
      ]);
      expect(corrigido.recusas_lidas).toBeUndefined();
      expect(estadoDoItemLido(corrigido, EXPERIENCIA, item.chave)).toBe(
        "ACEITO",
      );
      expect(linhaAceita(corrigido, EXPERIENCIA, item.chave).corrigido).toBe(
        true,
      );
      // Corrigir de novo troca a mesma linha (não duplica).
      const outra = aceitarItemCorrigido(corrigido, EXPERIENCIA, item, {
        ...linha,
        fim: "2026-01-31",
      });
      expect(outra.vinculos).toHaveLength(1);
      expect(outra.vinculos[0].fim).toBe("2026-01-31");
      // Sem mudar nada em relação ao lido: aceito sem a marca.
      const igual = aceitarItemCorrigido(
        { vinculos: [] },
        EXPERIENCIA,
        item,
        linha,
      );
      expect(igual.vinculos[0].corrigido).toBeUndefined();
      expect(textoDaLinha("vinculos", corrigido.vinculos[0])).toBe(
        "Instituto de Saúde · Enfermeiro · 01/02/2024 a 13/10/2026",
      );
    });

    it("título não classificado: o Corrigir abre com o título padrão do nível", () => {
      expect(
        linhaParaCorrigir(
          FORMACAO,
          { tipo: "TITULO", titulo: null, curso: "Saúde", instituicao: "UF" },
          "1:2:1:0",
          "MESTRADO",
        ),
      ).toEqual({
        titulo: "MESTRADO",
        nome: "Saúde · UF",
        aceito: true,
        do_arquivo: "1:2:1:0",
      });
    });

    it("no máximo um alerta visível: o que impede primeiro; os leves em cinza; atual e concomitante não são alerta", () => {
      const a = (codigo) => ({ codigo, texto: codigo });
      expect(
        alertasResumidos([
          a("SEM_EMPREGADOR"),
          a("NOME_DIVERGENTE"),
          a("DATA_FUTURA"),
        ]),
      ).toEqual({
        principal: a("NOME_DIVERGENTE"),
        grave: true,
        outros: [a("SEM_EMPREGADOR"), a("DATA_FUTURA")],
        concomitante: false,
      });
      expect(alertasResumidos([a("SEM_EMPREGADOR")])).toMatchObject({
        principal: a("SEM_EMPREGADOR"),
        grave: false,
        outros: [],
      });
      expect(
        alertasResumidos([a("SEM_DATA_FIM"), a("PERIODO_CONCOMITANTE")]),
      ).toEqual({
        principal: null,
        grave: false,
        outros: [],
        concomitante: true,
      });
      // O mesmo empregador repetido é laranja.
      expect(alertasResumidos([a("PERIODO_SOBREPOSTO")]).grave).toBe(true);
    });

    it("foto: ícone pelo nome; miniatura só com link https direto da imagem (não o visualizador da Empregare)", () => {
      expect(anexoEhImagem("carteira.JPG")).toBe(true);
      expect(anexoEhImagem("diploma.pdf")).toBe(false);
      expect(linkDaMiniatura(ANEXO.link)).toBeNull();
      expect(
        linkDaMiniatura(
          "https://corporate.empregare.com/Company/VacancyTests/GetViewerLogArquivo?arquivo=foto.jpg",
        ),
      ).toBeNull();
      expect(linkDaMiniatura("https://arquivos.exemplo.org/foto.png")).toBe(
        "https://arquivos.exemplo.org/foto.png",
      );
      expect(
        linkDaMiniatura("http://arquivos.exemplo.org/foto.png"),
      ).toBeNull();
    });
  });
});

bloco("lib/avaliacao-documental-leitura-por-versao", () => {
  /*
  A leitura por versão (supabase/migrations/20261014230000): os objetos
  refeitos das colunas, a revalidação com p_versao e a volta para a RPC de
  sempre quando o banco ainda não tem a nova.
*/

  /* O formato de private."FC_COLUNAS_JSON" (colunas em ordem, dicionário por índice). */
  const PACOTE = {
    colunas: ["art", "codigo", "decisao", "motivo", "situacao", "vaga"],
    dicionarios: {
      motivo: [null, "Não finalizou o questionário"],
      situacao: ["ELIMINADO", "NO_LOTE"],
      vaga: ["182418", "182444"],
      decisao: [null, { motivo: "Critério CORES", por: "Ana" }],
    },
    linhas: [
      [50, "7016549", 0, 0, 1, 0],
      [0, "1266667", 0, 1, 0, 0],
      [12.5, "7000001", 1, 0, 1, 1],
    ],
  };

  describe("linhasDoPacote", () => {
    it("refaz os objetos com todas as chaves, nulos incluídos, na ordem das linhas", () => {
      expect(linhasDoPacote(PACOTE)).toEqual([
        {
          art: 50,
          codigo: "7016549",
          decisao: null,
          motivo: null,
          situacao: "NO_LOTE",
          vaga: "182418",
        },
        {
          art: 0,
          codigo: "1266667",
          decisao: null,
          motivo: "Não finalizou o questionário",
          situacao: "ELIMINADO",
          vaga: "182418",
        },
        {
          art: 12.5,
          codigo: "7000001",
          decisao: { motivo: "Critério CORES", por: "Ana" },
          motivo: null,
          situacao: "NO_LOTE",
          vaga: "182444",
        },
      ]);
    });

    it("pacote vazio ou inválido: lista vazia; célula que falta vira nulo", () => {
      expect(linhasDoPacote(null)).toEqual([]);
      expect(linhasDoPacote({ colunas: [], linhas: [] })).toEqual([]);
      expect(linhasDoPacote({ colunas: ["a", "b"], linhas: [[1]] })).toEqual([
        { a: 1, b: null },
      ]);
    });
  });

  describe("comListasRefeitas", () => {
    it("troca <campo>_em_colunas pelo campo, sem mexer no resto", () => {
      const r = comListasRefeitas({
        versao: "v1",
        vagas: [{ codigo: "182418" }],
        candidatos_em_colunas: PACOTE,
      });
      expect(r).not.toHaveProperty("candidatos_em_colunas");
      expect(r.candidatos).toHaveLength(3);
      expect(r.vagas).toEqual([{ codigo: "182418" }]);
      expect(r.versao).toBe("v1");
    });

    it("payload da RPC de sempre volta como veio", () => {
      const antigo = { candidatos: [{ codigo: "1" }] };
      expect(comListasRefeitas(antigo)).toBe(antigo);
    });
  });

  describe("funcaoAusente", () => {
    it("PGRST202 (PostgREST) e 42883 (Postgres) são função ausente", () => {
      expect(funcaoAusente({ code: "PGRST202" })).toBe(true);
      expect(funcaoAusente({ code: "42883" })).toBe(true);
      expect(funcaoAusente({ code: "42501" })).toBe(false);
      expect(funcaoAusente(new Error("rede"))).toBe(false);
      expect(funcaoAusente(null)).toBe(false);
    });
  });

  function banco(respostas) {
    return vi.fn(async (nome, argumentos) => {
      const r = respostas[nome];
      if (r instanceof Error) throw r;
      return typeof r === "function" ? r(argumentos) : (r ?? null);
    });
  }

  describe("criarLeituraPorVersao", () => {
    const OPCOES = { nova: "obter_x_se_mudou", antiga: "obter_x" };

    it("primeira leitura sem versão; a segunda manda a versão e reaproveita o que tem", async () => {
      const leitura = criarLeituraPorVersao(OPCOES);
      const rpc = banco({
        obter_x_se_mudou: ({ p_versao }) =>
          p_versao === "v1"
            ? { inalterado: true, versao: "v1" }
            : { versao: "v1", candidatos_em_colunas: PACOTE },
      });
      const primeira = await leitura.ler(rpc, { p_edital: "e1" }, "e1");
      expect(rpc).toHaveBeenLastCalledWith("obter_x_se_mudou", {
        p_edital: "e1",
        p_versao: null,
      });
      expect(primeira.candidatos).toHaveLength(3);
      const segunda = await leitura.ler(rpc, { p_edital: "e1" }, "e1");
      expect(rpc).toHaveBeenLastCalledWith("obter_x_se_mudou", {
        p_edital: "e1",
        p_versao: "v1",
      });
      expect(segunda).toBe(primeira);
    });

    it("outra chave (outro edital) não manda a versão do primeiro", async () => {
      const leitura = criarLeituraPorVersao(OPCOES);
      const rpc = banco({ obter_x_se_mudou: { versao: "v1", candidatos: [] } });
      await leitura.ler(rpc, { p_edital: "e1" }, "e1");
      await leitura.ler(rpc, { p_edital: "e2" }, "e2");
      expect(rpc).toHaveBeenLastCalledWith("obter_x_se_mudou", {
        p_edital: "e2",
        p_versao: null,
      });
    });

    it("banco sem a RPC nova: a de sempre, e não tenta a nova de novo", async () => {
      const leitura = criarLeituraPorVersao(OPCOES);
      const ausente = Object.assign(new Error("Could not find"), {
        code: "PGRST202",
      });
      const rpc = banco({ obter_x_se_mudou: ausente, obter_x: { ok: 1 } });
      expect(await leitura.ler(rpc, { p_edital: "e1" }, "e1")).toEqual({
        ok: 1,
      });
      expect(await leitura.ler(rpc, { p_edital: "e1" }, "e1")).toEqual({
        ok: 1,
      });
      expect(rpc.mock.calls.map(([nome]) => nome)).toEqual([
        "obter_x_se_mudou",
        "obter_x",
        "obter_x",
      ]);
    });

    it("outro erro (permissão, rede) sobe sem tentar a antiga", async () => {
      const leitura = criarLeituraPorVersao(OPCOES);
      const negado = Object.assign(new Error("negado"), { code: "42501" });
      const rpc = banco({ obter_x_se_mudou: negado, obter_x: { ok: 1 } });
      await expect(leitura.ler(rpc, {}, "e1")).rejects.toBe(negado);
      expect(rpc).toHaveBeenCalledTimes(1);
    });

    it("resposta vazia: lê pela antiga (sem guardar versão)", async () => {
      const leitura = criarLeituraPorVersao(OPCOES);
      const rpc = banco({ obter_x_se_mudou: null, obter_x: { ok: 1 } });
      expect(await leitura.ler(rpc, { p_edital: "e1" }, "e1")).toEqual({
        ok: 1,
      });
    });

    it("com cópia no navegador: manda a versão guardada e guarda o que veio em colunas", async () => {
      const guardadas = new Map([
        ["e1", { versao: "v0", candidatos_em_colunas: PACOTE }],
      ]);
      const copias = {
        ler: vi.fn(async (chave) => guardadas.get(chave) ?? null),
        guardar: vi.fn(async (chave, payload) => guardadas.set(chave, payload)),
      };
      const leitura = criarLeituraPorVersao({ ...OPCOES, copias });
      const rpc = banco({
        obter_x_se_mudou: ({ p_versao }) =>
          p_versao === "v0"
            ? { inalterado: true, versao: "v0" }
            : { versao: "v1", candidatos: [] },
      });
      const dados = await leitura.ler(rpc, { p_edital: "e1" }, "e1");
      expect(rpc).toHaveBeenLastCalledWith("obter_x_se_mudou", {
        p_edital: "e1",
        p_versao: "v0",
      });
      expect(dados.candidatos).toHaveLength(3);
      expect(copias.guardar).not.toHaveBeenCalled();

      await leitura.ler(rpc, { p_edital: "e2" }, "e2");
      expect(copias.guardar).toHaveBeenCalledWith("e2", {
        versao: "v1",
        candidatos: [],
      });
    });

    it("esquecer: a próxima leitura não manda a versão da memória", async () => {
      const leitura = criarLeituraPorVersao(OPCOES);
      const rpc = banco({ obter_x_se_mudou: { versao: "v1" } });
      await leitura.ler(rpc, {}, "e1");
      leitura.esquecer();
      await leitura.ler(rpc, {}, "e1");
      expect(rpc).toHaveBeenLastCalledWith("obter_x_se_mudou", {
        p_versao: null,
      });
    });
  });
});

bloco("lib/avaliacao-documental-modelo-do-espelho", () => {
  /*
  O modelo do espelho de nota por edital: o padrão (os textos de hoje), a
  validação (as mesmas regras do banco), o que vai ao banco (só as
  diferenças) e a folha (HTML e PDF) com um modelo customizado — só os
  textos mudam; o conteúdo continua o da montagem.
*/

  const CUSTOM = {
    ...TEXTOS_PADRAO_DO_ESPELHO,
    titulo: "Espelho da Análise Curricular — 114/2026",
    subtitulo: "",
    saudacao: "Olá, {candidato}!",
    abertura: "{candidato}, segue o resultado.",
    secao_dados: "Seus dados",
    secao_notas: "Suas notas",
    secao_criterios: "Critérios",
    secao_justificativas: "Observações",
    rotulo_consolidada: "Nota final",
    nao_se_aplica: "Eliminado(a): sem nota",
    sem_observacao: "Nada a observar.",
    rodape: "",
    mostrar_autodeclarada: false,
  };

  describe("padrão e validação", () => {
    it("o padrão são os textos de hoje e é válido", () => {
      expect(TEXTOS_PADRAO_DO_ESPELHO.titulo).toBe(
        "Espelho de Pontuação da Análise Curricular",
      );
      expect(TEXTOS_PADRAO_DO_ESPELHO.saudacao).toBe("Prezado(a) {candidato},");
      expect(TEXTOS_PADRAO_DO_ESPELHO.mostrar_autodeclarada).toBe(true);
      expect(validarModeloDoEspelho({ ...TEXTOS_PADRAO_DO_ESPELHO })).toEqual(
        {},
      );
      expect(validarModeloDoEspelho(CUSTOM)).toEqual({});
      // Um campo para cada texto do padrão.
      expect(CAMPOS_DO_MODELO.map((c) => c.chave).sort()).toEqual(
        Object.keys(TEXTOS_PADRAO_DO_ESPELHO)
          .filter((k) => k !== "mostrar_autodeclarada")
          .sort(),
      );
    });

    it("recusa o que o banco recusa", () => {
      expect(validarModeloDoEspelho({ titulo: "" }).titulo).toMatch(/vazio/);
      expect(
        validarModeloDoEspelho({ titulo: "x".repeat(201) }).titulo,
      ).toMatch(/200/);
      expect(
        validarModeloDoEspelho({ saudacao: "Prezado(a)," }).saudacao,
      ).toMatch(/\{candidato\}/);
      expect(validarModeloDoEspelho({ rodape: "Até {data}" }).rodape).toMatch(
        /marcador/,
      );
      expect(
        validarModeloDoEspelho({ titulo: "Espelho de {candidato}" }).titulo,
      ).toMatch(/saudação e na abertura/);
      expect(validarModeloDoEspelho({ campo: "x" })._).toMatch(/desconhecido/);
      expect(
        validarModeloDoEspelho({ mostrar_autodeclarada: "sim" })
          .mostrar_autodeclarada,
      ).toBeTruthy();
      // Vazio só onde a linha some da folha.
      expect(
        validarModeloDoEspelho({ subtitulo: "", abertura: " ", rodape: "" }),
      ).toEqual({});
    });
  });

  describe("o que vai ao banco e o que volta", () => {
    it("só as diferenças do padrão; o padrão vira {}", () => {
      expect(diferencasDoPadrao({ ...TEXTOS_PADRAO_DO_ESPELHO })).toEqual({});
      expect(
        diferencasDoPadrao({
          ...TEXTOS_PADRAO_DO_ESPELHO,
          titulo: "  Outro título  ",
          mostrar_autodeclarada: false,
        }),
      ).toEqual({ titulo: "Outro título", mostrar_autodeclarada: false });
    });

    it("textosDoModelo: padrão por baixo; campo inválido volta ao padrão", () => {
      expect(textosDoModelo(null)).toEqual(TEXTOS_PADRAO_DO_ESPELHO);
      const t = textosDoModelo({
        titulo: "Novo",
        saudacao: "sem marcador",
        desconhecido: "x",
        mostrar_autodeclarada: false,
      });
      expect(t.titulo).toBe("Novo");
      expect(t.saudacao).toBe(TEXTOS_PADRAO_DO_ESPELHO.saudacao);
      expect(t.mostrar_autodeclarada).toBe(false);
      expect(t).not.toHaveProperty("desconhecido");
    });

    it("lerModeloDoEdital lê a resposta da RPC", () => {
      const m = lerModeloDoEdital({
        versao: 3,
        textos: { titulo: "T" },
        atualizado_em: "2026-10-19T10:00:00Z",
        atualizado_por: "Gestão Pessoal",
        pode_editar: true,
      });
      expect(m.versao).toBe(3);
      expect(m.textos.titulo).toBe("T");
      expect(m.salvos).toEqual({ titulo: "T" });
      expect(m.podeEditar).toBe(true);
      expect(lerModeloDoEdital(null).versao).toBe(0);
    });
  });

  describe("saudação e abertura", () => {
    it("o nome no lugar de {candidato}, em negrito na saudação", () => {
      expect(trechosDaSaudacao("Prezado(a) {candidato},", "Ana")).toEqual([
        { texto: "Prezado(a) ", negrito: false },
        { texto: "Ana", negrito: true },
        { texto: ",", negrito: false },
      ]);
      expect(comOCandidato("{candidato}, veja.", "Ana")).toBe("Ana, veja.");
    });
  });

  describe("a folha com o modelo do edital", () => {
    it("padrão: a página igual à de antes do modelo", () => {
      const html = paginaDoEspelho(espelhoDeExemplo("COM_PONTOS"));
      expect(html).toContain(
        "<h1>Espelho de Pontuação da Análise Curricular</h1>",
      );
      expect(html).toContain(
        '<p class="subtitulo">Documento simplificado para atendimento ao candidato</p>',
      );
      expect(html).toContain(
        "<p>Prezado(a) <strong>Maria Exemplo da Silva</strong>,</p>",
      );
      expect(html).toContain("<h2>Dados do registro</h2>");
      expect(html).toContain("Nota autodeclarada (antes da análise)");
      expect(html).toContain('<p class="rodape">');
    });

    it("customizado: títulos, saudação, quadros e rótulos; sem subtítulo, rodapé e autodeclarada", () => {
      const espelho = espelhoDeExemplo("COM_PONTOS", CUSTOM);
      const html = paginaDoEspelho(espelho);
      expect(html).toContain(`<h1>${CUSTOM.titulo}</h1>`);
      expect(html).not.toContain('class="subtitulo"');
      expect(html).toContain(
        "<p>Olá, <strong>Maria Exemplo da Silva</strong>!</p>",
      );
      expect(html).toContain(
        "<p>Maria Exemplo da Silva, segue o resultado.</p>",
      );
      for (const s of ["Seus dados", "Suas notas", "Critérios", "Observações"])
        expect(html).toContain(`<h2>${s}</h2>`);
      expect(html).toContain("Nota final");
      expect(html).not.toContain("autodeclarada");
      expect(html).not.toContain('class="rodape"');
      // O conteúdo não muda: os mesmos critérios e justificativas.
      expect(espelho.criterios).toEqual(
        espelhoDeExemplo("COM_PONTOS").criterios,
      );
    });

    it("eliminado: o 'Não se aplica' e o 'sem observação' do modelo", () => {
      expect(notasDoEspelho("ELIMINADO", "30,0", "0,0", CUSTOM)).toEqual([
        { rotulo: "Nota final", valor: "Eliminado(a): sem nota" },
      ]);
      const html = paginaDoEspelho({
        ...espelhoDeExemplo("ELIMINADO", CUSTOM),
        justificativas: [],
      });
      expect(html).toContain("Eliminado(a): sem nota");
      expect(html).toContain("Nada a observar.");
    });

    it("escapa o HTML dos textos do modelo", () => {
      const html = paginaDoEspelho(
        espelhoDeExemplo("COM_PONTOS", { ...CUSTOM, titulo: "<b>x</b>" }),
      );
      expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    });

    it("o PDF usa os mesmos textos do modelo", async () => {
      const libs = await carregarBibliotecasDoPdf();
      const bytes = pdfDoEspelho(espelhoDeExemplo("COM_PONTOS", CUSTOM), libs, {
        comprimir: false,
      });
      const bruto = new TextDecoder("latin1").decode(bytes);
      const textos = [...bruto.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)]
        .map((m) => m[1])
        .join("\n");
      expect(textos).toContain("SEUS DADOS");
      expect(textos).toContain("OBSERVA");
      expect(textos).toContain("Ol");
      expect(textos).toContain("Maria Exemplo da Silva");
      expect(textos).not.toContain("autodeclarada");
      expect(textos).not.toContain("Documento simplificado");
      expect(textos).not.toContain("Observação: este espelho");
    });
  });
});

bloco("lib/avaliacao-documental-motivos-da-reabertura", () => {
  /*
  Motivos da reabertura (20261021110000): lista fixa e obrigatória,
  complemento opcional, "Outro" com descrição que pareça texto; e o texto
  mínimo dos motivos livres da fila. Os exemplos aleatórios e os bons são os
  do histórico real (TH_FICHA_ANALISE, 21/10/2026).
*/

  const ALEATORIOS = [
    "fhyxjyfhujyu",
    "YUTFDYTSERYHG",
    "dsdfsdfsfsa",
    "DTHGDXGDRXGD",
    "TERERTERTE",
    "6.6.1trtrhytr",
    "dvdddddddddddddd",
    "ioidhgdsoigfsoiuhf",
    "TESTETESTE",
  ];
  const BONS = [
    "Correção da avaliação",
    "Correção do criterio cotas",
    "erro em formação",
    "erro nos cursos",
    "Correção da experiência",
    "erro de digitação",
    "Nova distribuição.",
    "Alteração de pessoa responsável",
    "Remanejamento de análise",
  ];

  describe("texto mínimo do motivo", () => {
    it("as sequências aleatórias do histórico não passam nem com 2 palavras exigidas", () => {
      for (const t of ALEATORIOS)
        expect(motivoPareceTexto(t, 2), t).toBe(false);
      expect(motivoPareceTexto("TESTE FDFDF", 2)).toBe(false);
      expect(motivoPareceTexto("teste teste teste", 2)).toBe(false);
      // Duas "palavras" com vogais passam nas 2 da fila; nas 3 do Outro, não.
      expect(motivoPareceTexto("ÇGI.OLKJUÇGB", 3)).toBe(false);
    });

    it("os motivos bons passam; siglas curtas contam, sigla sem vogal longa não reprova", () => {
      for (const t of BONS) expect(motivoPareceTexto(t, 2), t).toBe(true);
      expect(motivoPareceTexto("Laudo de PcD sem CID", 3)).toBe(true);
      expect(motivoPareceTexto("Erro na CTPS do candidato", 3)).toBe(true);
    });

    it("motivo da fila: 10 a 2.000 caracteres e 2 palavras", () => {
      expect(erroDoMotivoDaFila("curto")).toBe("De 10 a 2.000 caracteres.");
      expect(erroDoMotivoDaFila("dvdddddddddddddd")).toBe(
        "Escreva o motivo com pelo menos 2 palavras.",
      );
      expect(erroDoMotivoDaFila("Nova distribuição.")).toBe("");
    });
  });

  describe("motivos da reabertura", () => {
    it("lista fixa, com códigos únicos e Outro por último", () => {
      const codigos = MOTIVOS_DA_REABERTURA.map((m) => m.codigo);
      expect(new Set(codigos).size).toBe(codigos.length);
      expect(codigos.at(-1)).toBe("OUTRO");
      expect(codigos).toEqual([
        "EXPERIENCIA",
        "CURSOS",
        "FORMACAO",
        "REQUISITO",
        "IDENTIDADE",
        "COTA",
        "ETNICO",
        "DOCUMENTO_NOVO",
        "RECURSO",
        "COORDENACAO",
        "DIGITACAO",
        "OUTRO",
      ]);
      // Cada bloco das regras vigentes cai num motivo só.
      const blocos = MOTIVOS_DA_REABERTURA.flatMap((m) => m.blocos);
      expect(new Set(blocos).size).toBe(blocos.length);
      for (const b of [
        "IDENTIDADE",
        "ESCOLARIDADE",
        "REQUISITO_DO_CARGO",
        "REGISTRO_CONSELHO",
        "COTA_PP",
        "COTA_PI",
        "COTA_PQ",
        "COTA_PCD",
        "FORMACAO",
        "CURSOS",
        "EXPERIENCIA",
      ])
        expect(blocos).toContain(b);
    });

    it("a escolha é obrigatória: vazio ou texto livre (a chamada antiga) não vale", () => {
      for (const codigo of ["", null, "Correção da experiência", "outro"])
        expect(validarReabertura(codigo, "")).toEqual({
          ok: false,
          campo: "motivo",
          erro: "Escolha o motivo da reabertura.",
        });
    });

    it("motivo da lista sem complemento", () => {
      expect(validarReabertura("EXPERIENCIA", "   ")).toEqual({
        ok: true,
        argumentos: { p_motivo: "EXPERIENCIA", p_complemento: null },
        texto: "Correção de experiência",
      });
    });

    it("complemento opcional: limpo no texto; aleatório ou longo demais é recusado", () => {
      expect(validarReabertura("COTA", "  laudo   sem CID ")).toEqual({
        ok: true,
        argumentos: { p_motivo: "COTA", p_complemento: "laudo sem CID" },
        texto: "Correção de cota (PP/PI/PQ/PcD) — laudo sem CID",
      });
      expect(validarReabertura("COTA", "dsdfsdfsfsa")).toMatchObject({
        ok: false,
        campo: "complemento",
      });
      expect(validarReabertura("COTA", "palavra ".repeat(70))).toMatchObject({
        ok: false,
        erro: "Até 500 caracteres.",
      });
    });

    it("Outro exige 15 caracteres e 3 palavras que pareçam texto", () => {
      const erro = {
        ok: false,
        campo: "complemento",
        erro: "Descreva o motivo com pelo menos 15 caracteres e 3 palavras.",
      };
      expect(validarReabertura("OUTRO", "")).toEqual(erro);
      expect(validarReabertura("OUTRO", "erro na nota")).toEqual(erro);
      expect(validarReabertura("OUTRO", "reabertura solicitada")).toEqual(erro);
      expect(
        validarReabertura("OUTRO", "dsdfsdfsfsa TERERTERTE fhyxjyfhujyu"),
      ).toEqual(erro);
      expect(validarReabertura("OUTRO", "Nome da mãe trocado no RG")).toEqual({
        ok: true,
        argumentos: {
          p_motivo: "OUTRO",
          p_complemento: "Nome da mãe trocado no RG",
        },
        texto: "Outro — Nome da mãe trocado no RG",
      });
    });

    it("o texto legível é o que o banco grava", () => {
      expect(textoDaReabertura("DIGITACAO", "")).toBe(
        "Erro de digitação ou lançamento",
      );
      expect(textoDaReabertura("RECURSO", "recurso 12")).toBe(
        "Decisão de recurso — recurso 12",
      );
    });
  });
});

bloco("lib/avaliacao-documental-numeros-da-fila", () => {
  /*
  Os números da faixa de situação da Fila (numeros-da-fila.ts) e as ações
  do "⋯" de cada linha (a mesma regra das ações em lote, em fila.ts).
*/

  const ficha = (situacao, extra = {}) => ({
    ficha: { id: `f-${situacao}`, situacao, ...extra },
  });

  describe("números dos cards da Fila", () => {
    it("concluídas hoje contam pelo dia de Brasília", () => {
      // 05/11 às 01:30 UTC ainda é 04/11 em Brasília.
      const agora = new Date("2026-11-05T15:00:00Z");
      const lista = [
        ficha("CONCLUIDA", { concluida_em: "2026-11-05T12:00:00Z" }),
        ficha("CONCLUIDA", { concluida_em: "2026-11-05T01:30:00Z" }),
        ficha("CONCLUIDA", { concluida_em: null }),
        ficha("EM_ANALISE", { concluida_em: "2026-11-05T12:00:00Z" }),
        { ficha: null },
      ];
      expect(concluidasHoje(lista, agora)).toBe(1);
      expect(concluidasHoje(null, agora)).toBe(0);
    });

    it("as aptas: só as concluídas com resultado Apto", () => {
      const lista = [
        ficha("CONCLUIDA", { resultado: "APTO" }),
        ficha("CONCLUIDA", { resultado: "INAPTO_NOTA" }),
        ficha("EM_ANALISE", { resultado: "APTO" }),
        { ficha: null },
      ];
      expect(aptasDaFila(lista)).toBe(1);
      expect(aptasDaFila(null)).toBe(0);
    });

    it("percentual com uma casa, para baixo; 100% só com tudo feito; sem total, vazio", () => {
      expect(porcentagemDe(1, 3)).toBe("33,3%");
      expect(porcentagemDe(1999, 2000)).toBe("99,9%");
      expect(porcentagemDe(1, 4)).toBe("25%");
      expect(porcentagemDe(200, 200)).toBe("100%");
      expect(porcentagemDe(0, 0)).toBe("");
    });

    const retrato = (cronograma) => ({
      editais: [
        {
          id: "e93",
          edital: "93/2026",
          situacoes: { pendente: 20, em_analise: 0, revisar: 0, concluida: 10 },
          por_dia: [{ dia: "2026-11-04", qt: 4 }],
          qt_equipe: 2,
          cronograma,
        },
      ],
    });
    const ANALISE = [
      {
        ordem: 1,
        atividade: "Análise documental",
        inicio: "2026-11-01",
        fim: "2026-11-06",
      },
    ];

    it("a meta do dia é a do Painel das análises: o que falta pelos dias úteis até o prazo", () => {
      // Quarta, 04/11: quarta, quinta e sexta até o prazo → (20 + 4) / 3.
      expect(
        ritmoDaFila(retrato(ANALISE), "e93", {
          hoje: "2026-11-04",
          hora: 10,
          minuto: 0,
        }),
      ).toEqual({
        meta: 8,
        feito: 4,
        selo: { rotulo: "No ritmo hoje", tom: "aprovado" },
      });
    });

    it("sem o edital: nada; sem prazo no cronograma ou fora de dia útil: sem meta", () => {
      const quarta = { hoje: "2026-11-04", hora: 10, minuto: 0 };
      expect(ritmoDaFila(retrato(ANALISE), "outro", quarta)).toBeNull();
      expect(ritmoDaFila(null, "e93", quarta)).toBeNull();
      expect(ritmoDaFila(retrato([]), "e93", quarta)?.meta).toBeNull();
      const sabado = ritmoDaFila(retrato(ANALISE), "e93", {
        hoje: "2026-11-07",
        hora: 10,
        minuto: 0,
      });
      expect(sabado?.meta).toBeNull();
      expect(sabado?.selo.rotulo).toBe("Hoje não é dia útil");
    });
  });

  describe("ações do ⋯ de uma linha da Fila", () => {
    const agora = new Date("2026-11-05T12:00:00Z");
    const reserva = {
      usuario: "u-beto",
      desde: "2026-11-05T11:55:00Z",
      expira: "2026-11-05T12:10:00Z",
    };

    it("a mesma regra das ações em lote, na ordem do menu", () => {
      const linhas = [
        { id: "1", ...ficha("PENDENTE") },
        { id: "2", ...ficha("EM_ANALISE", { reserva }) },
        { id: "3", ...ficha("CONCLUIDA") },
        { id: "4", ...ficha("FORA_LOTE") },
        { id: "5", ficha: null },
      ];
      expect(linhas.map((c) => acoesDaFicha(c, agora))).toEqual([
        ["distribuir", "revisao"],
        ["distribuir", "liberar", "revisao"],
        // Concluída: só reabrir (AM-6.3: reaberta, aí aceita Atribuir a…).
        ["reabrir"],
        [],
        [],
      ]);
      // Uma linha é a seleção de uma: o mesmo resultado das ações em lote.
      for (const c of linhas) {
        const lote = acoesDaSelecao([c], agora);
        expect(
          ["distribuir", "liberar", "revisao", "reabrir"].filter((a) =>
            lote[a].includes(c),
          ),
        ).toEqual(acoesDaFicha(c, agora));
      }
    });

    it("filtros em uso: vaga, responsável, modalidade e busca (a etapa não conta)", () => {
      expect(filtrosDaFilaEmUso(FILTRO_INICIAL)).toBe(0);
      expect(
        filtrosDaFilaEmUso({
          ...FILTRO_INICIAL,
          etapa: "concluidas",
          busca: "  ",
        }),
      ).toBe(0);
      expect(
        filtrosDaFilaEmUso({
          etapa: "lote",
          vaga: "1",
          responsavel: "eu",
          modalidade: "AC",
          busca: "ana",
        }),
      ).toBe(4);
    });
  });
});

bloco("lib/avaliacao-documental-paginas-da-pre-classificacao", () => {
  const argumentosDaPagina = argumentosDaPagina__2;
  /*
  A triagem em páginas: a leitura de reserva (banco sem
  listar_pre_classificacao) tem de dar as mesmas linhas, na mesma ordem, que o
  banco (CLASSIFICADOS: no lote e depois fora do lote, pela posição;
  ELIMINADOS: pelo código; PODE_INCLUIR: fora do lote e eliminados que não
  saíram da Empregare), e o mesmo resumo (lotes e congeladas).
*/
  const c = (codigo, vaga, situacao, extra = {}) => ({
    id: `id-${codigo}`,
    codigo,
    nome: `Pessoa ${codigo}`,
    vaga,
    situacao,
    ...extra,
  });
  const DADOS = {
    pode_coordenar: true,
    pode_registrar_lista: true,
    pode_publicar_lista: false,
    regra: { versao: 3 },
    regra_classificacao: null,
    em_andamento: false,
    ultima_execucao: null,
    listas: [],
    vagas: [{ codigo: "10" }, { codigo: "20" }],
    candidatos: [
      c("300", "10", "RANQUEADO", { posicao: 3 }),
      c("100", "10", "NO_LOTE", { posicao: 1, lote: 1 }),
      c("900", "10", "ELIMINADO", { motivo_codigo: "SAIU_DA_EMPREGARE" }),
      c("200", "10", "ANALISADO", {
        posicao: 2,
        lote: 1,
        declarada_congelada: 9,
        congelada_em: "2026-10-20T10:00:00Z",
      }),
      c("150", "10", "ELIMINADO", { motivo_codigo: "NOTA" }),
      c("400", "10", "RANQUEADO", { posicao: null }),
      c("Ágata", "20", "ELIMINADO", { nome: "Ágata Souza" }),
      c("500", "20", "NO_LOTE", {
        posicao: 1,
        lote: 2,
        declarada_congelada: 7,
        congelada_em: "2026-10-19T10:00:00Z",
      }),
    ],
  };
  const codigos = (linhas) => linhas.map((l) => l.codigo);

  describe("linhasDaPreInteira", () => {
    it("CLASSIFICADOS: no lote e depois fora do lote, pela posição (sem posição no fim)", () => {
      expect(
        codigos(
          linhasDaPreInteira(DADOS, { vaga: "10", grupo: "CLASSIFICADOS" }),
        ),
      ).toEqual(["100", "200", "300", "400"]);
    });

    it("ELIMINADOS pelo código; PODE_INCLUIR sem quem saiu da Empregare", () => {
      expect(
        codigos(linhasDaPreInteira(DADOS, { vaga: "10", grupo: "ELIMINADOS" })),
      ).toEqual(["150", "900"]);
      expect(
        codigos(
          linhasDaPreInteira(DADOS, { vaga: "10", grupo: "PODE_INCLUIR" }),
        ),
      ).toEqual(["300", "400", "150"]);
    });

    it("busca no edital todo, sem acento, por código ou nome; conta por vaga", () => {
      const achados = linhasDaPreInteira(DADOS, {
        vaga: null,
        grupo: "ELIMINADOS",
        busca: "agata",
      });
      expect(codigos(achados)).toEqual(["Ágata"]);
      expect(contarPorVaga(achados)).toEqual({ 20: 1 });
    });
  });

  describe("resumoDaPreInteira", () => {
    it("tira os inscritos e traz lotes, congeladas e fora do lote por vaga", () => {
      const resumo = resumoDaPreInteira(DADOS);
      expect(resumo.candidatos).toBeUndefined();
      expect(resumo.lotes).toEqual([
        { lote: 1, quantidade: 2 },
        { lote: 2, quantidade: 1 },
      ]);
      expect(resumo.congeladas).toEqual({
        quantidade: 2,
        em: "2026-10-19T10:00:00Z",
      });
      expect(resumo.vagas.map((v) => v.fora_do_lote)).toEqual([2, 0]);
    });

    it("os contadores da tela dão o mesmo com o resumo e com a leitura inteira", () => {
      const resumo = resumoDaPreInteira(DADOS);
      expect(lotesAPublicar(resumo)).toEqual(lotesAPublicar(DADOS));
      expect(declaradasCongeladas(resumo)).toEqual(declaradasCongeladas(DADOS));
    });
  });

  describe("a página do banco", () => {
    it("lê a resposta (total, cursor e quantos por vaga)", () => {
      expect(
        paginaDaResposta({
          candidatos: [{ id: "a" }],
          proximo: { vaga: "10", grupo: 0, posicao: 1, codigo: "1" },
          total: "120",
          por_vaga: { 10: 3, 20: "4" },
        }),
      ).toEqual({
        linhas: [{ id: "a" }],
        proximo: { vaga: "10", grupo: 0, posicao: 1, codigo: "1" },
        total: 120,
        porVaga: { 10: 3, 20: 4 },
        porMotivo: [],
      });
      expect(paginaDaResposta(null)).toEqual({
        linhas: [],
        proximo: null,
        total: 0,
        porVaga: {},
        porMotivo: [],
      });
    });

    it("lê as opções de motivo dos eliminados (20261029210000)", () => {
      expect(
        paginaDaResposta({
          candidatos: [],
          total: 3,
          por_motivo: [
            { codigo: "CANCELADO", motivo: "Cancelou a inscrição", total: "2" },
            { codigo: "", motivo: "sem código", total: 1 },
            null,
          ],
        }).porMotivo,
      ).toEqual([
        { codigo: "CANCELADO", motivo: "Cancelou a inscrição", total: 2 },
      ]);
    });

    it("manda p_motivo só com motivo escolhido (o banco antigo não o conhece)", () => {
      expect(
        argumentosDaPagina("e1", { vaga: null, grupo: "ELIMINADOS" }, null, 50),
      ).not.toHaveProperty("p_motivo");
      expect(
        argumentosDaPagina(
          "e1",
          { vaga: null, grupo: "ELIMINADOS", motivo: "CANCELADO" },
          null,
          50,
        ).p_motivo,
      ).toBe("CANCELADO");
    });

    it("conta os motivos dos eliminados (leitura inteira) e filtra por motivo", () => {
      const linhas = [
        {
          vaga: "1",
          codigo: "a",
          situacao: "ELIMINADO",
          motivo_codigo: "X",
          motivo: "Xis",
        },
        {
          vaga: "1",
          codigo: "b",
          situacao: "ELIMINADO",
          motivo_codigo: "Y",
          motivo: "Ípsilon",
        },
        {
          vaga: "2",
          codigo: "c",
          situacao: "ELIMINADO",
          motivo_codigo: "Y",
          motivo: "Ípsilon",
        },
      ];
      expect(motivosDasLinhas(linhas)).toEqual([
        { codigo: "Y", motivo: "Ípsilon", total: 2 },
        { codigo: "X", motivo: "Xis", total: 1 },
      ]);
      expect(
        linhasDaPreInteira(
          { candidatos: linhas },
          { vaga: null, grupo: "ELIMINADOS", motivo: "X" },
        ).map((c) => c.codigo),
      ).toEqual(["a"]);
    });

    it("monta os argumentos (busca vazia vira nulo)", () => {
      expect(
        argumentosDaPagina(
          "e1",
          { vaga: "10", grupo: "ELIMINADOS", busca: "  " },
          null,
          50,
        ),
      ).toEqual({
        p_edital: "e1",
        p_vaga: "10",
        p_grupo: "ELIMINADOS",
        p_busca: null,
        p_apos: null,
        p_limite: 50,
      });
    });
  });
});

bloco("lib/avaliacao-documental-pendencias-do-salvar", () => {
  /*
  "Salvar como versão N" diz o que falta: cada item leva ao passo e ao campo.
  Os que impedem desabilitam o botão; os outros são para conferir.
*/
  const ler = (arquivo) =>
    JSON.parse(
      readFileSync(`tests/fixtures/avaliacao-documental/${arquivo}`, "utf8"),
    );
  const PROJ = regraNormalizada(
    ler("casos-de-pontuacao.json").regras["PROJ26-CURRICULAR"],
  );
  const VAGAS = ler("colunas-da-empregare-93-2026.json");

  const base = {
    regra: PROJ,
    erros: [],
    mudou: true,
    temVigente: true,
    motivo: "Ajuste do edital retificado",
    motivoObrigatorio: true,
  };
  const impedem = (lista) => lista.filter((p) => p.impede);

  describe("pendências do salvar", () => {
    it("sem mudança em relação à vigente", () => {
      const lista = pendenciasDoSalvar({ ...base, mudou: false, motivo: "" });
      expect(impedem(lista).map((p) => p.texto)).toEqual([
        "Nenhuma mudança em relação à versão vigente",
      ]);
    });

    it("motivo curto leva ao campo do motivo", () => {
      const [p] = impedem(pendenciasDoSalvar({ ...base, motivo: "curto" }));
      expect(p).toMatchObject({
        texto: "Escreva o motivo da alteração (mín. 10 caracteres)",
        passo: "conferir",
        alvo: "[data-campo='motivo'] input",
      });
      // A primeira versão (sem vigente) não pede motivo.
      expect(
        impedem(
          pendenciasDoSalvar({
            ...base,
            temVigente: false,
            motivoObrigatorio: false,
            motivo: "",
          }),
        ),
      ).toEqual([]);
    });

    it("nome inválido e erros da regra, cada um no seu passo", () => {
      const lista = impedem(
        pendenciasDoSalvar({
          ...base,
          erroDoNome: "De 3 a 80 caracteres.",
          erros: [
            "Bloco 2 (ESCOLARIDADE): título obrigatório.",
            "Nota declarada 1: pontos de cada resposta (0 a 100, até 50 respostas).",
            "Classificação: Critério repetido: IDOSO_60.",
            "Base da nota do lote pela declarada: configure a nota declarada.",
          ],
        }),
      );
      expect(lista.map((p) => p.passo)).toEqual([
        "conferir",
        "cardapio",
        "perguntas",
        "nota",
        "perguntas",
      ]);
      expect(lista[0].texto).toBe("Nome da versão: de 3 a 80 caracteres");
      expect(lista[1].alvo).toBe('[data-cartao="bloco:ESCOLARIDADE"]');
    });

    it("para conferir (não impede): pergunta sem ligação e requisito sem item do edital", () => {
      const regra = structuredClone(PROJ);
      const id = regra.blocos.find((b) => b.codigo === "IDENTIDADE");
      id.perguntas = ["Pergunta que não existe na carga"];
      delete id.item_edital;
      const lista = pendenciasDoSalvar({ ...base, regra, vagas: VAGAS });
      expect(impedem(lista)).toEqual([]);
      const textos = lista.map((p) => p.texto);
      expect(textos).toContain(
        `Pergunta de “${id.titulo}” sem ligação com a Empregare`,
      );
      expect(textos).toContain(`Requisito “${id.titulo}” sem item do edital`);
      const pergunta = lista.find((p) => p.texto.startsWith("Pergunta de"));
      expect(pergunta).toMatchObject({
        passo: "perguntas",
        alvo: '[data-ligacao="bloco:IDENTIDADE:0"]',
      });
    });

    it("erro sem lugar conhecido vai ao cardápio", () => {
      expect(lugarDoErro("Regra grande demais.")).toEqual({
        passo: "cardapio",
      });
    });
  });
});

bloco("lib/avaliacao-documental-perguntas-do-cargo", () => {
  /*
  A ficha do 114/2026 com a regra vigente (v18) e as respostas reais de um
  candidato por vaga (tests/fixtures/avaliacao-documental/ficha-114-2026.json).
  A regra liga a cada bloco as perguntas de todos os questionários (superior,
  técnico, médio, Motorista): a ficha mostra só as do questionário do
  candidato. A titulação só pontua no superior: no médio e no técnico o item
  não pede conferência ("Não pontua neste nível") e sai da composição da nota
  (FC_BLOCO_NAO_PONTUA_NO_NIVEL, migration 20261014210000).
*/
  const DADOS = JSON.parse(
    readFileSync(
      "tests/fixtures/avaliacao-documental/ficha-114-2026.json",
      "utf8",
    ),
  );
  const REGRA = DADOS.regra;
  const DOCUMENTAL = { nota_minima: 10, nota_minima_por_nivel: {} };

  function fichaDaVaga(vaga) {
    const { cargo, respostas } = DADOS.vagas[vaga];
    const lancamento = lancamentoInicial({
      regra: REGRA,
      respostas,
      modalidade: "AC",
      cargo,
      vaga,
      documental: DOCUMENTAL,
    });
    return { lancamento, respostas, regra: regraDaFicha(REGRA, lancamento) };
  }
  const bloco = (regra, codigo) =>
    regra.blocos.find((b) => b.codigo === codigo);
  const perguntas = (regra, codigo, respostas) =>
    respostasDoBloco(bloco(regra, codigo), respostas).map((l) => l.enunciado);

  describe("perguntas do questionário do candidato (114/2026)", () => {
    it("Motorista D: só as perguntas do questionário de nível médio do Motorista", () => {
      const { regra, respostas } = fichaDaVaga("182567");
      expect(perguntas(regra, "ESCOLARIDADE", respostas)).toEqual([
        "Você possui Ensino Médio completo",
        "Anexe a comprovação de conclusão do Nível Médio.",
      ]);
      expect(perguntas(regra, "REQUISITO_DO_CARGO", respostas)).toEqual([
        "Você possui CNH Categoria D vigente",
        "Anexe aqui sua CNH Categoria D.",
        "Você possui curso de direção defensiva",
        "Anexe o comprovante de conclusão do curso de direção defensiva",
      ]);
      expect(perguntas(regra, "FORMACAO", respostas)).toEqual([]);
    });

    it("Técnico e superior: a formação e o requisito de cada questionário", () => {
      const tec = fichaDaVaga("182445");
      expect(perguntas(tec.regra, "ESCOLARIDADE", tec.respostas)).toEqual([
        "Você possui Curso Técnico na área da vaga",
        "Anexe a comprovação de Nível Técnico",
      ]);
      expect(perguntas(tec.regra, "REQUISITO_DO_CARGO", tec.respostas)).toEqual(
        [],
      );
      const sup = fichaDaVaga("182418");
      expect(perguntas(sup.regra, "ESCOLARIDADE", sup.respostas)).toEqual([
        "Você possui Graduação na área da vaga",
        "Anexe a comprovação de Nível Superior",
      ]);
      expect(perguntas(sup.regra, "FORMACAO", sup.respostas)).toHaveLength(2);
    });

    it("a pergunta que existe e ficou em branco continua, sem resposta", () => {
      const { regra, respostas } = fichaDaVaga("182567");
      const coluna = Object.keys(respostas).find((c) =>
        c.includes("direção defensiva?"),
      );
      const linhas = respostasDoBloco(bloco(regra, "REQUISITO_DO_CARGO"), {
        ...respostas,
        [coluna]: "--",
      });
      expect(linhas.find((l) => l.coluna === coluna)?.texto).toBe("");
      expect(linhas).toHaveLength(4);
    });

    it("o item sem pergunta no questionário avisa (e só ele)", () => {
      const { regra, respostas } = fichaDaVaga("182444");
      const requisito = bloco(regra, "REQUISITO_DO_CARGO");
      const linhas = respostasDoBloco(requisito, respostas).length;
      expect(semPerguntaNoQuestionario(requisito, respostas, linhas)).toBe(
        true,
      );
      const cursos = bloco(regra, "CURSOS");
      expect(
        semPerguntaNoQuestionario(
          cursos,
          respostas,
          respostasDoBloco(cursos, respostas).length,
        ),
      ).toBe(false);
      // Sem as respostas carregadas, nada a dizer.
      expect(semPerguntaNoQuestionario(requisito, {}, 0)).toBe(false);
      expect(
        semPerguntaNoQuestionario(
          { tipo: "PONTUACAO", perguntas: ["x"] },
          respostas,
          0,
        ),
      ).toBe(false);
    });
  });

  describe("bloco que não pontua no nível da vaga (114/2026)", () => {
    it("a titulação só pontua no superior", () => {
      for (const [vaga, nivel, pontua] of [
        ["182567", "medio", false],
        ["182444", "medio", false],
        ["182445", "tecnico", false],
        ["182418", "superior", true],
      ]) {
        const { regra, lancamento } = fichaDaVaga(vaga);
        expect(lancamento.nivel).toBe(nivel);
        expect(blocoNaoPontuaNoNivel(bloco(regra, "FORMACAO"), nivel)).toBe(
          !pontua,
        );
        expect(blocoSeAplica(bloco(regra, "FORMACAO"), lancamento)).toBe(
          pontua,
        );
        // Cursos e experiência pontuam em todos os níveis.
        expect(blocoSeAplica(bloco(regra, "CURSOS"), lancamento)).toBe(true);
        expect(blocoSeAplica(bloco(regra, "EXPERIENCIA"), lancamento)).toBe(
          true,
        );
      }
    });

    it("Motorista D: sem a etapa nem a pendência da titulação, e fora da lateral", () => {
      const { lancamento } = fichaDaVaga("182567");
      const av = calcularFicha(REGRA, lancamento, DOCUMENTAL);
      expect(
        etapasDaFicha(REGRA, lancamento).map((e) => e.codigo),
      ).not.toContain("FORMACAO");
      expect(
        pendenciasDaFicha(REGRA, lancamento, av, null).some(
          (p) => p.bloco === "FORMACAO",
        ),
      ).toBe(false);
      expect(
        composicaoDaNota(REGRA, lancamento, av, null).map((p) => p.parcial),
      ).toEqual(["CURSOS", "EXPERIENCIA"]);
      // A conta não muda: a titulação vale 0 no médio.
      expect(av.parciais.FORMACAO ?? 0).toBe(0);
    });

    it("superior: a titulação continua pedindo a conferência", () => {
      const { lancamento } = fichaDaVaga("182418");
      const av = calcularFicha(REGRA, lancamento, DOCUMENTAL);
      expect(etapasDaFicha(REGRA, lancamento).map((e) => e.codigo)).toContain(
        "FORMACAO",
      );
      expect(
        composicaoDaNota(REGRA, lancamento, av, null).map((p) => p.parcial),
      ).toContain("FORMACAO");
    });

    it("não vale quando o bloco pode mudar o resultado, nem sem nível", () => {
      const titulos = {
        tipo: "TITULOS",
        teto: 10,
        pontos_por_nivel: { superior: [{ titulo: "MESTRADO", pontos: 8 }] },
      };
      expect(blocoNaoPontuaNoNivel(titulos, "medio")).toBe(true);
      expect(blocoNaoPontuaNoNivel(titulos, "superior")).toBe(false);
      expect(blocoNaoPontuaNoNivel(titulos, null)).toBe(false);
      expect(
        blocoNaoPontuaNoNivel(
          { ...titulos, efeitos: { NAO_ENVIADO: "ELIMINA" } },
          "medio",
        ),
      ).toBe(false);
      expect(
        blocoNaoPontuaNoNivel(
          { ...titulos, efeitos: { NAO_CONFORME: "SO_REGISTRO" } },
          "medio",
        ),
      ).toBe(true);
      expect(
        blocoNaoPontuaNoNivel(
          { ...titulos, motivos: [{ codigo: "X", efeito: "ZERA_PONTOS" }] },
          "medio",
        ),
      ).toBe(false);
      expect(
        blocoNaoPontuaNoNivel(
          { ...titulos, extras: [{ codigo: "E", pontos: 2 }] },
          "medio",
        ),
      ).toBe(false);
      // Cursos com teto 0 no nível; experiência com mínimo continua valendo.
      const cursos = {
        tipo: "CURSOS",
        teto: 5,
        por_nivel: { medio: { teto: 0 } },
      };
      expect(blocoNaoPontuaNoNivel(cursos, "medio")).toBe(true);
      expect(blocoNaoPontuaNoNivel(cursos, "superior")).toBe(false);
      expect(
        blocoNaoPontuaNoNivel(
          { tipo: "VINCULOS", teto: 0, minimo_meses: 6 },
          "medio",
        ),
      ).toBe(false);
      expect(
        blocoNaoPontuaNoNivel({ tipo: "DOCUMENTO", teto: 0 }, "medio"),
      ).toBe(false);
    });
  });
});

bloco("lib/avaliacao-documental-pessoas-da-triagem", () => {
  /*
  A aba Pessoas da Triagem (pessoas-da-triagem.ts): o filtro guardado na
  sessão, o que ele pede ao banco e as ações de cada pessoa.
*/

  describe("filtro da aba Pessoas", () => {
    it("o guardado volta no formato de agora; o que não serve vira o padrão", () => {
      expect(normalizarFiltroDasPessoas(null)).toEqual(
        FILTRO_DAS_PESSOAS_INICIAL,
      );
      expect(
        normalizarFiltroDasPessoas({
          busca: "maria",
          vaga: 179698,
          situacao: "ELIMINADOS",
          sobra: true,
        }),
      ).toEqual({ busca: "maria", vaga: "179698", situacao: "ELIMINADOS" });
      expect(
        normalizarFiltroDasPessoas({ situacao: "QUALQUER" }).situacao,
      ).toBe("TODAS");
      expect(
        normalizarFiltroDasPessoas({ busca: "x".repeat(500) }).busca,
      ).toHaveLength(120);
    });

    it("conta a busca, a vaga e a situação diferente de Todas", () => {
      expect(filtrosDasPessoasEmUso(FILTRO_DAS_PESSOAS_INICIAL)).toBe(0);
      expect(
        filtrosDasPessoasEmUso({ busca: "  ", vaga: "", situacao: "TODAS" }),
      ).toBe(0);
      expect(
        filtrosDasPessoasEmUso({
          busca: "ana",
          vaga: "179698",
          situacao: "PODE_INCLUIR",
        }),
      ).toBe(3);
    });

    it("a chave é por edital; sem edital, nada se guarda", () => {
      expect(chaveDasPessoas("e93")).toBe("monitora:triagem:pessoas:e93");
      expect(chaveDasPessoas("")).toBe("");
    });

    it("Todas pede classificados e eliminados; o recorte leva a vaga e a busca aparada", () => {
      expect(gruposDaSituacao("TODAS")).toEqual([
        "CLASSIFICADOS",
        "ELIMINADOS",
      ]);
      expect(gruposDaSituacao("PODE_INCLUIR")).toEqual(["PODE_INCLUIR"]);
      expect(
        recorteDasPessoas(
          { busca: " ana ", vaga: "", situacao: "TODAS" },
          "ELIMINADOS",
        ),
      ).toEqual({ vaga: null, grupo: "ELIMINADOS", busca: "ana" });
      expect(
        recorteDasPessoas(
          { busca: "digitando", vaga: "179698", situacao: "TODAS" },
          "CLASSIFICADOS",
          "di",
        ),
      ).toEqual({ vaga: "179698", grupo: "CLASSIFICADOS", busca: "di" });
    });
  });

  describe("ações de cada pessoa", () => {
    const coordena = { podeCoordenar: true };
    it("eliminado com motivo: o comunicado é a principal; incluir vai ao ⋯", () => {
      expect(
        acoesDaPessoa(
          { situacao: "ELIMINADO", motivo: "Cancelou", motivo_codigo: "CANC" },
          coordena,
        ),
      ).toEqual({
        principal: "comunicado",
        outras: ["incluir", "ver-vaga", "copiar"],
      });
    });

    it("quem saiu da Empregare não entra por decisão; sem motivo, sem comunicado", () => {
      expect(
        acoesDaPessoa(
          {
            situacao: "ELIMINADO",
            motivo: "",
            motivo_codigo: "SAIU_DA_EMPREGARE",
          },
          coordena,
        ),
      ).toEqual({ principal: null, outras: ["ver-vaga", "copiar"] });
    });

    it("fora do lote: incluir é a principal; no lote por decisão, revogar no ⋯", () => {
      expect(acoesDaPessoa({ situacao: "RANQUEADO" }, coordena)).toEqual({
        principal: "incluir",
        outras: ["ver-vaga", "copiar"],
      });
      expect(
        acoesDaPessoa(
          {
            situacao: "NO_LOTE",
            entrada: "DECISAO",
            decisao: { motivo: "Critério CORES" },
          },
          coordena,
        ),
      ).toEqual({ principal: null, outras: ["revogar", "ver-vaga", "copiar"] });
      expect(acoesDaPessoa({ situacao: "NO_LOTE" }, coordena)).toEqual({
        principal: null,
        outras: ["ver-vaga", "copiar"],
      });
    });

    it("quem não coordena não inclui nem revoga", () => {
      expect(
        acoesDaPessoa({ situacao: "RANQUEADO" }, { podeCoordenar: false }),
      ).toEqual({ principal: null, outras: ["ver-vaga", "copiar"] });
      expect(
        acoesDaPessoa(
          { situacao: "NO_LOTE", decisao: { motivo: "Critério CORES" } },
          { podeCoordenar: false },
        ).outras,
      ).not.toContain("revogar");
    });
  });
});

bloco("lib/avaliacao-documental-pontuacao", () => {
  /*
  A conta da avaliação documental (src/lib/avaliacao-documental/). Os casos
  dourados ficam em tests/fixtures/avaliacao-documental/casos-de-pontuacao.json,
  para o banco (F4) e a base Python conferirem o mesmo número.
*/
  const CASOS = JSON.parse(
    readFileSync(
      "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
      "utf8",
    ),
  );

  /*
  A regra do caso: parecer_da_regra põe as opções do parecer por cima, e
  motivos_da_regra ({ BLOCO: { MOTIVO: texto } }) troca o texto de motivos.
*/
  const regraDoCaso = (caso) => {
    const regra = CASOS.regras[caso.regra];
    const textos = caso.motivos_da_regra ?? {};
    return {
      ...regra,
      parecer: { ...regra.parecer, ...caso.parecer_da_regra },
      blocos: regra.blocos.map((b) =>
        textos[b.codigo]
          ? {
              ...b,
              motivos: b.motivos.map((m) =>
                Object.hasOwn(textos[b.codigo], m.codigo)
                  ? { ...m, texto: textos[b.codigo][m.codigo] }
                  : m,
              ),
            }
          : b,
      ),
    };
  };

  describe("casos dourados", () => {
    it.each(CASOS.casos.map((c) => [c.nome, c]))("%s", (_nome, caso) => {
      const r = calcularAvaliacao(
        regraDoCaso(caso),
        caso.candidato,
        caso.opcoes,
      );
      expect(r.resultado).toBe(caso.esperado.resultado);
      expect(r.nota_final).toBe(caso.esperado.nota_final);
      expect(r.nota_apurada).toBe(caso.esperado.nota_apurada);
      expect(r.parciais).toEqual(caso.esperado.parciais);
      expect(r.eliminatorios).toEqual(caso.esperado.eliminatorios);
      expect(r.encaminhamentos).toEqual(caso.esperado.encaminhamentos);
      expect(r.parecer).toBe(caso.esperado.parecer);
      if (caso.esperado.experiencia)
        expect(r.experiencia).toMatchObject(caso.esperado.experiencia);
      if (caso.esperado.calculados)
        expect(r.calculados).toEqual(caso.esperado.calculados);
      if (caso.esperado.ajustes)
        expect(r.ajustes).toEqual(caso.esperado.ajustes);
      if ("pontos_informativos" in caso.esperado)
        expect(r.pontos_informativos).toEqual(
          caso.esperado.pontos_informativos,
        );
    });

    it.each(CASOS.nota_declarada.map((c) => [c.nome, c]))(
      "nota declarada: %s",
      (_nome, caso) => {
        expect(
          calcularNotaDeclarada(CASOS.regras[caso.regra], caso.respostas),
        ).toEqual(caso.esperado);
      },
    );
  });

  describe("AM-2.6: cada edital pontua com os seus pesos", () => {
    it("o mesmo indígena morador de aldeia vale 12 no 28/2026 e 14 no 100/2026", () => {
      const candidato = {
        nivel: "superior",
        indigena: true,
        mora_aldeia: true,
        aldeia_na_lista: true,
        vinculos: [
          { categoria: "SAUDE_GERAL", inicio: "2024-01-01", fim: "2024-12-31" },
          { categoria: "AREA", inicio: "2024-01-01", fim: "2024-12-31" },
        ],
      };
      expect(
        calcularAvaliacao(CASOS.regras["SI26-INTERIOR-SUL"], candidato).parciais
          .ETNICO,
      ).toBe(12);
      expect(
        calcularAvaliacao(CASOS.regras["SI26-100"], candidato).parciais.ETNICO,
      ).toBe(14);
    });

    it("mudar o peso na regra muda a nota (nada fixo no código)", () => {
      const regra = structuredClone(CASOS.regras["SI26-INTERIOR-SUL"]);
      regra.blocos.find((b) => b.codigo === "ETNICO").indigena = 9;
      regra.blocos.find((b) => b.codigo === "ETNICO").teto = null;
      const r = calcularAvaliacao(regra, {
        nivel: "superior",
        indigena: true,
        mora_aldeia: true,
        aldeia_na_lista: true,
        vinculos: [
          { categoria: "SAUDE_GERAL", inicio: "2024-01-01", fim: "2024-12-31" },
        ],
      });
      expect(r.parciais.ETNICO).toBe(14);
    });

    it("o modelo de Projetos não tem critério étnico", () => {
      const r = calcularAvaliacao(CASOS.regras["PROJ26-CURRICULAR"], {
        nivel: "superior",
        indigena: true,
        mora_aldeia: true,
      });
      expect(Object.keys(r.parciais)).not.toContain("ETNICO");
    });
  });

  describe("vínculos e tempo", () => {
    it("AM-10.1: sobreposição conta uma vez; dia seguinte emenda; sem unir, soma", () => {
      const intervalos = [
        { inicio: "2020-01-01", fim: "2020-01-31" },
        { inicio: "2020-01-15", fim: "2020-02-10" },
        { inicio: "2020-02-11", fim: "2020-02-20" },
      ];
      expect(diasDosIntervalos(intervalos)).toBe(51);
      expect(diasDosIntervalos(intervalos, { unir: false })).toBe(31 + 27 + 10);
      expect(diasDosIntervalos(intervalos, { limite: "2020-01-31" })).toBe(31);
    });

    it("datas inválidas ou fim antes do início não contam", () => {
      expect(
        diasDosIntervalos([
          { inicio: "2020-02-30", fim: "2020-03-10" },
          { inicio: "2020-05-10", fim: "2020-05-01" },
        ]),
      ).toBe(0);
    });

    it("AM-10.5: anos de 365, meses de 30", () => {
      expect(anosMesesDias(912)).toEqual({ anos: 2, meses: 6, dias: 2 });
      expect(anosMesesDias(0)).toEqual({ anos: 0, meses: 0, dias: 0 });
      // Meses até 11: o resto fica nos dias (364 dias não é "12 meses e 4 dias").
      expect(anosMesesDias(364)).toEqual({ anos: 0, meses: 11, dias: 34 });
      expect(anosMesesDias(360)).toEqual({ anos: 0, meses: 11, dias: 30 });
      expect(anosMesesDias(729)).toEqual({ anos: 1, meses: 11, dias: 34 });
    });

    it("AM-10.2: 55 meses a 0,2 com teto 10 vale 10", () => {
      const regra = CASOS.regras["SI26-INTERIOR-SUL"];
      const r = calcularAvaliacao(regra, {
        nivel: "superior",
        vinculos: [
          { categoria: "SAUDE_GERAL", inicio: "2019-01-01", fim: "2023-07-24" },
        ],
      });
      expect(r.experiencia.meses).toBe(55);
      expect(r.parciais.EXPERIENCIA).toBe(10);
    });

    it("AM-10.6: indígena sem experiência e 800 h de estágio = 4 meses", () => {
      const r = calcularAvaliacao(CASOS.regras["SI26-INTERIOR-SUL"], {
        nivel: "superior",
        indigena: true,
        estagio_horas: 800,
      });
      expect(r.experiencia.meses_estagio).toBe(4);
      expect(r.parciais.EXPERIENCIA).toBe(0.8);
    });

    it("estágio não conta para quem já tem experiência", () => {
      const r = calcularAvaliacao(CASOS.regras["SI26-INTERIOR-SUL"], {
        nivel: "superior",
        indigena: true,
        estagio_horas: 800,
        vinculos: [
          { categoria: "SAUDE_GERAL", inicio: "2024-01-01", fim: "2024-03-31" },
        ],
      });
      expect(r.experiencia.meses_estagio).toBe(0);
      expect(r.experiencia.meses_considerados).toBe(3);
    });

    it("faixa do curso pela carga horária", () => {
      const faixas = CASOS.regras["PROJ26-CURRICULAR"].blocos.find(
        (b) => b.codigo === "CURSOS",
      ).faixas;
      expect(faixaDoCurso(faixas, 39)).toBeNull();
      expect(faixaDoCurso(faixas, 60).pontos).toBe(1);
      expect(faixaDoCurso(faixas, 61).pontos).toBe(2);
      expect(faixaDoCurso(faixas, 500).pontos).toBe(3);
    });
  });

  describe("blocos, efeitos e parecer", () => {
    const regra = CASOS.regras["SI26-100"];
    const base = {
      nivel: "superior",
      vinculos: [
        { categoria: "AREA", inicio: "2020-01-01", fim: "2022-12-31" },
      ],
    };

    it("AM-7.6: graduação não conforme com motivo elimina, nota 0 e o parecer lista o motivo", () => {
      const r = calcularAvaliacao(regra, {
        ...base,
        blocos: {
          GRADUACAO: {
            situacao: "NAO_CONFORME",
            motivos: ["DIPLOMA_SEM_VERSO"],
          },
        },
      });
      expect(r.resultado).toBe("INAPTO_REQUISITO");
      expect(r.nota_final).toBe(0);
      expect(r.parecer).toContain("INABILITADO(A)");
      expect(r.parecer).toContain("Item 8.11.2: Diploma sem o verso.");
    });

    it("AM-7.5: bloco de cota de outra modalidade não se aplica", () => {
      const r = calcularAvaliacao(regra, { ...base, modalidade: "AC" });
      expect(r.blocos.find((b) => b.codigo === "COTA_PP").situacao).toBe(
        "NAO_SE_APLICA",
      );
    });

    it("AM-7.7: PcD conforme encaminha à perícia; incompleta segue na ampla", () => {
      expect(
        calcularAvaliacao(regra, { ...base, modalidade: "PCD" })
          .encaminhamentos,
      ).toEqual(["ENCAMINHA_PERICIA"]);
      expect(
        calcularAvaliacao(regra, {
          ...base,
          modalidade: "PCD",
          blocos: { COTA_PCD: { situacao: "NAO_ENVIADO" } },
        }).encaminhamentos,
      ).toEqual(["SEGUE_AMPLA"]);
    });

    it("AM-8.2: motivo Aldeia fora tira só a aldeia; AM-8.3: Não conforme zera sem eliminar", () => {
      const indigena = {
        ...base,
        indigena: true,
        mora_aldeia: true,
        aldeia_na_lista: true,
      };
      expect(
        calcularAvaliacao(regra, {
          ...indigena,
          blocos: {
            ETNICO: { situacao: "NAO_CONFORME", motivos: ["ALDEIA_FORA"] },
          },
        }).parciais.ETNICO,
      ).toBe(8);
      const zerado = calcularAvaliacao(regra, {
        ...indigena,
        blocos: { ETNICO: { situacao: "NAO_CONFORME" } },
      });
      expect(zerado.parciais.ETNICO).toBe(0);
      expect(zerado.resultado).toBe("APTO");
    });

    it("AM-9.1: títulos não cumulativos valem o maior; recusado não conta", () => {
      const r = calcularAvaliacao(regra, {
        ...base,
        titulos: [
          { titulo: "ESPECIALIZACAO", aceito: true },
          { titulo: "MESTRADO", aceito: true },
          { titulo: "DOUTORADO", aceito: false },
        ],
      });
      expect(r.parciais.FORMACAO).toBe(2);
    });

    it("nota mínima por nível vale antes da geral", () => {
      const r = calcularAvaliacao(regra, base, {
        notaMinima: 1,
        notaMinimaPorNivel: { superior: 10 },
      });
      expect(r.nota_minima).toBe(10);
      expect(r.resultado).toBe("INAPTO_NOTA");
      expect(r.parecer).toContain("nota mínima de 10,00 pontos (item 8.5)");
    });

    it("outro motivo escrito e observações entram no parecer", () => {
      const r = calcularAvaliacao(regra, {
        ...base,
        blocos: {
          EXPERIENCIA: {
            situacao: "NAO_CONFORME",
            motivos: ["SEM_DATA_TERMINO", "OUTRO"],
            motivo_livre: "Declaração sem carimbo do órgão.",
          },
        },
        observacoes_prontas: ["EXP_DIMINUIDA"],
        observacoes: "Conferido na Empregare.",
      });
      expect(r.observacoes).toEqual([
        "Item 8.14 a: Vínculo sem data de término.",
        // O Outro motivo vai como o avaliador escreveu, sem o item do edital.
        "Declaração sem carimbo do órgão.",
        "Nota de experiência profissional diminuída em decorrência do tempo de serviço comprovado pelo candidato(a).",
        "Conferido na Empregare.",
      ]);
      expect(r.parecer).toContain("Observações da análise:\n- Item 8.14 a");
    });

    it("o texto que ficou sem o Outro motivo marcado não entra no parecer", () => {
      const r = calcularAvaliacao(regra, {
        ...base,
        blocos: {
          EXPERIENCIA: {
            situacao: "NAO_CONFORME",
            motivos: ["SEM_DATA_TERMINO"],
            motivo_livre: "Texto de outra escolha.",
          },
        },
      });
      expect(r.observacoes).toEqual([
        "Item 8.14 a: Vínculo sem data de término.",
      ]);
    });

    it("Outro motivo na justificativa da nota vale como escrito, sem o item do bloco", () => {
      const r = calcularAvaliacao(regra, {
        ...base,
        blocos: {
          EXPERIENCIA: {
            situacao: "CONFORME",
            nota_ajustada: 1,
            justificativas: ["OUTRO"],
            motivo_livre: "Vínculo de 2019 sem assinatura do empregador.",
          },
        },
      });
      expect(r.observacoes).toContain(
        "Vínculo de 2019 sem assinatura do empregador.",
      );
      expect(r.observacoes.join(" | ")).not.toContain(
        "Item 8.14: Vínculo de 2019",
      );
    });

    it("observação do avaliador de cada item, como escrita (sem item do edital) e sem repetir a justificativa", () => {
      const r = calcularAvaliacao(regra, {
        ...base,
        blocos: {
          EXPERIENCIA: {
            situacao: "CONFORME",
            justificativa_livre: "Aceito 1 vínculo.",
            observacao: "aceito 1 vínculo",
          },
          FORMACAO: {
            situacao: "CONFORME",
            observacao: "Diploma\n em  duas linhas.",
          },
        },
      });
      // Como o avaliador escreveu: sem o item do edital nem o título do bloco.
      expect(r.observacoes).toContain("Diploma em duas linhas.");
      expect(r.observacoes.join(" | ")).not.toMatch(/ — Diploma/);
      expect(r.observacoes.filter((t) => /aceito 1 vínculo/i.test(t))).toEqual([
        "Item 8.14: Aceito 1 vínculo.",
      ]);
    });

    it("modelo do parecer: campo desconhecido fica; número com vírgula", () => {
      expect(preencherModelo("{nota} e {outro}", { nota: "1,0" })).toBe(
        "1,0 e {outro}",
      );
      expect(numeroDoParecer(7.25, 1)).toBe("7,3");
      expect(numeroDoParecer(12, 2)).toBe("12,00");
    });

    it("parecer: cada linha sem espaço nas pontas, o meio da linha igual", () => {
      expect(linhasSemEspacosNasPontas("  a  b \n\tc\t\n\n d. ")).toBe(
        "a  b\nc\n\nd.",
      );
      expect(linhasSemEspacosNasPontas(null)).toBe("");
      const caso = CASOS.casos.find((c) => c.motivos_da_regra);
      const r = calcularAvaliacao(
        regraDoCaso(caso),
        caso.candidato,
        caso.opcoes,
      );
      // A observação guarda o texto da regra; o parecer, não o espaço do fim.
      expect(r.observacoes.every((t) => t.endsWith(". "))).toBe(true);
      expect(r.parecer.split("\n").some((l) => /^\s|\s$/.test(l))).toBe(false);
    });
  });

  describe("nota declarada e ART", () => {
    it("acha a pergunta pelo começo do nome, sem acento nem caixa; P1 não casa com P15", () => {
      const respostas = {
        "Pergunta 15 - Formação": "x",
        "PERGUNTA 1 - Identidade": "Anexo",
      };
      expect(colunaDaPergunta(respostas, "pergunta 1 -")).toBe(
        "PERGUNTA 1 - Identidade",
      );
      expect(colunaDaPergunta(respostas, "Pergunta 15 -")).toBe(
        "Pergunta 15 - Formação",
      );
      expect(colunaDaPergunta(respostas, "Pergunta 2 -")).toBeNull();
    });

    it("faixa em meses × pontos por mês, com teto", () => {
      const regra = {
        provisoria: {
          nota_declarada: [
            {
              parcial: "EXPERIENCIA",
              pergunta: "Pergunta 17 -",
              tipo: "FAIXA_EM_MESES",
              meses: { "Acima de 60 meses": 61, "De 6 a 12 meses": 6 },
              pontos_por_mes: 0.2,
              teto: 10,
            },
          ],
        },
      };
      expect(
        calcularNotaDeclarada(regra, {
          "Pergunta 17 - Exp": "Acima de 60 meses",
        }).total,
      ).toBe(10);
      expect(
        calcularNotaDeclarada(regra, { "Pergunta 17 - Exp": "De 6 a 12 meses" })
          .total,
      ).toBe(1.2);
    });

    it("AM-4.3: ART lida do texto x/30 e divergência pela tolerância", () => {
      expect(lerArt("6,0/30,0")).toBe(6);
      expect(lerArt("12.5/30")).toBe(12.5);
      expect(lerArt("x/30")).toBeNull();
      expect(divergeDaArt(6, 6)).toBe(false);
      expect(divergeDaArt(6, 7)).toBe(true);
      expect(divergeDaArt(6, 7, 1)).toBe(false);
      expect(divergeDaArt(null, 7)).toBe(false);
    });
  });

  describe("pontuação informativa no inapto por requisito", () => {
    const caso = CASOS.casos.find((c) => c.parecer_da_regra);
    const ligada = regraDoCaso(caso);
    const desligada = CASOS.regras[caso.regra];

    it("desligada (padrão): como hoje, sem a informativa nem a linha", () => {
      const r = calcularAvaliacao(desligada, caso.candidato, caso.opcoes);
      expect([r.resultado, r.nota_final, r.nota_apurada]).toEqual([
        "INAPTO_REQUISITO",
        0,
        10,
      ]);
      expect(r.pontos_informativos).toBeNull();
      expect(r.parecer).not.toContain("para fins informativos");
      expect(resumoParaGravar(r, null)).not.toHaveProperty(
        "pontos_informativos",
      );
      expect(pontuacaoInformativaDaFicha(r, r.resultado)).toBeNull();
    });

    it("ligada: nota final 0, informativa 10 gravada e mostrada na ficha", () => {
      const r = calcularAvaliacao(ligada, caso.candidato, caso.opcoes);
      expect(r.nota_final).toBe(0);
      expect(resumoParaGravar(r, null).pontos_informativos).toEqual({
        nota: 10,
        parciais: { FORMACAO: 8, CURSOS: 2, EXPERIENCIA: 0 },
      });
      expect(pontuacaoInformativaDaFicha(r, "INAPTO_REQUISITO")).toEqual({
        nota: 10,
        partes: [
          { parcial: "FORMACAO", rotulo: "Titulação", valor: 8 },
          { parcial: "CURSOS", rotulo: "Cursos", valor: 2 },
          { parcial: "EXPERIENCIA", rotulo: "Experiência", valor: 0 },
        ],
      });
      // A ficha só mostra no inapto por requisito (o resultado mostrado).
      expect(pontuacaoInformativaDaFicha(r, "APTO")).toBeNull();
    });

    it("ligar traz o modelo padrão; desligar devolve a regra de antes", () => {
      const regra = normalizarRegraAnalise(desligada);
      const com = comPontosQuandoInapto(regra, true);
      expect(com.parecer.mostrar_pontos_quando_inapto).toBe(true);
      expect(com.parecer.pontos_informativos).toContain("{nota_informativa}");
      expect(comPontosQuandoInapto(com, false)).toEqual(regra);
      // Religar mantém o modelo que a regra já tinha.
      const propria = comPontosQuandoInapto(
        { ...com, parecer: { ...com.parecer, pontos_informativos: "X" } },
        true,
      );
      expect(propria.parecer.pontos_informativos).toBe("X");
    });
  });
});

bloco("lib/avaliacao-documental-pre-classificacao", () => {
  /*
  Os mesmos casos rodam no pytest (tests/python/test_pre_classificacao.py),
  contra a conta oficial do job (python/monitora/avaliacao_documental/).
*/
  const CASOS = JSON.parse(
    readFileSync(
      "tests/fixtures/avaliacao-documental/casos-de-pre-classificacao.json",
      "utf8",
    ),
  );
  const CAMPOS = [
    "situacao",
    "motivo_codigo",
    "posicao",
    "posicao_modalidade",
    "lote",
    "lista_lote",
    "entrada",
    "motivo_entrada",
    "nota",
    "origem_nota",
    "divergente",
    "modalidade",
  ];

  const rodar = (c) =>
    preClassificarVaga({
      regra: normalizarRegraAnalise(c.regra),
      vaga: c.vaga,
      candidatos: c.candidatos,
      anterior: c.anterior,
      ultimo_lote: c.ultimo_lote,
      refazer: c.refazer,
      hoje: c.hoje,
      congelar: c.congelar ?? false,
      decisoes: c.decisoes ?? {},
      cronograma: c.cronograma ?? null,
    });

  describe("casos dourados da triagem", () => {
    it.each(CASOS.casos.map((c) => [`${c.historia} — ${c.nome}`, c]))(
      "%s",
      (_nome, c) => {
        const r = rodar(c);
        const linhas = Object.fromEntries(
          r.linhas.map((l) => [
            l.id,
            Object.fromEntries(CAMPOS.map((k) => [k, l[k]])),
          ]),
        );
        expect(linhas).toEqual(c.esperado.linhas);
        expect(r.resumo).toEqual(c.esperado.resumo);
        if (c.esperado.declaradas)
          expect(
            Object.fromEntries(
              r.linhas.map((l) => [
                l.id,
                {
                  declarada: l.declarada,
                  art: l.art,
                  congelada: l.declarada_congelada?.total ?? null,
                },
              ]),
            ),
          ).toEqual(c.esperado.declaradas);
      },
    );

    it("a regra de cada caso é uma regra válida", () => {
      for (const c of CASOS.casos)
        expect(validarRegraAnalise(normalizarRegraAnalise(c.regra))).toEqual(
          [],
        );
    });

    it("rodar de novo com o resultado como anterior não muda nada (AM-4.2)", () => {
      for (const c of CASOS.casos) {
        const primeira = rodar(c);
        const anterior = Object.fromEntries(
          primeira.linhas.map((l) => [l.id, l]),
        );
        const segunda = rodar({
          ...c,
          candidatos: c.candidatos.filter(
            (x) => x.ativo !== false || anterior[x.id],
          ),
          anterior,
          refazer: false,
          ultimo_lote: Math.max(0, ...primeira.linhas.map((l) => l.lote ?? 0)),
        });
        expect(segunda.linhas.map((l) => [l.id, l.situacao, l.lote])).toEqual(
          primeira.linhas.map((l) => [l.id, l.situacao, l.lote]),
        );
        expect(segunda.resumo.entraram).toBe(0);
      }
    });
  });

  describe("a pergunta pelo começo do enunciado (os mesmos casos no pytest)", () => {
    it.each(CASOS.perguntas.map((c) => [c.nome, c]))("%s", (_nome, c) => {
      const colunas = Object.fromEntries(c.colunas.map((n) => [n, "x"]));
      expect({
        coluna: colunaDaPergunta(colunas, c.pergunta),
        ambigua: perguntaAmbigua(colunas, c.pergunta),
      }).toEqual(c.esperado);
    });

    it("as perguntas ambíguas da regra viram os códigos dos avisos", () => {
      const regra = normalizarRegraAnalise(CASOS.casos.at(-1).regra);
      const candidato = CASOS.casos.at(-1).candidatos.at(-1);
      expect(
        perguntasAmbiguas(
          regra,
          candidato.colunas,
          regra.provisoria.pergunta_experiencia,
        ).sort(),
      ).toEqual(CASOS.casos.at(-1).esperado.resumo.avisos);
      expect(perguntasAmbiguas(regra, {}, "x")).toEqual([]);
    });
  });

  describe("as respostas no formato da Empregare (os mesmos casos no pytest)", () => {
    const R = CASOS.respostas;
    it.each(R.texto)("texto de %j", (valor, esperado) =>
      expect(textoDaResposta(valor)).toBe(esperado),
    );
    it.each(R.opcoes)("opções de %j", (valor, esperado) =>
      expect(opcoesDaResposta(valor)).toEqual(esperado),
    );
    it.each(R.mesma_opcao)("%j e %j são a mesma opção? %j", (a, b, igual) =>
      expect(chaveDaOpcao(a) === chaveDaOpcao(b)).toBe(igual),
    );
    it.each(R.meses)("meses de %j", (valor, esperado) =>
      expect(mesesDeclarados(valor)).toBe(esperado),
    );
    it.each(R.art)("ART de %j", (valor, esperado) =>
      expect(lerArt(valor)).toBe(esperado),
    );
  });

  describe("peças da conta", () => {
    it("ART da coluna NOTA - …", () => {
      expect(artDasColunas({ "NOTA - Questionário": "24,5/30,0" })).toBe(24.5);
      expect(artDasColunas({ "nota - x": "x/30", "NOTA - y": "3/30" })).toBe(3);
      expect(artDasColunas({ NOTAS: "10" })).toBeNull();
    });

    it("eliminação: a primeira regra que vale, e as colunas ausentes", () => {
      const regra = normalizarRegraAnalise(CASOS.casos[0].regra);
      expect(
        eliminacaoDoCandidato(regra, {
          SITUAÇÃO: "cancelado",
          "SITUAÇÃO - Q": "EM ANDAMENTO",
        }).eliminacao.codigo,
      ).toBe("CANCELADO");
      const semColunas = eliminacaoDoCandidato(regra, {});
      expect(semColunas.eliminacao).toBeNull();
      expect(semColunas.ausentes).toEqual([
        "CANCELADO",
        "QUESTIONARIO",
        "REPROVADO_EMPREGARE",
        "TERMO",
      ]);
    });

    it("modalidade pelo bloco MODALIDADE; sem ele, ampla", () => {
      const regra = normalizarRegraAnalise(CASOS.casos[0].regra);
      expect(
        modalidadeDoCandidato(regra, {
          "Pergunta 5 - Sistema": "Pessoa com deficiência (PcD)",
        }),
      ).toBe("PCD");
      expect(modalidadeDoCandidato({ blocos: [] }, {})).toBe("AC");
    });

    it("tamanho do lote: múltiplo, CR, fixo, por vaga e sem quadro", () => {
      const lote = normalizarRegraAnalise({}).lote;
      expect(
        tamanhoDoLote(lote, { vagas_imediatas: 11, cadastro_reserva: true })
          .descricao,
      ).toBe("3 × (11 + CR) = 36");
      expect(
        tamanhoDoLote(
          { ...lote, multiplo: 2.5, inclui_cr: false },
          { vagas_imediatas: 3, cadastro_reserva: true },
        ),
      ).toMatchObject({ tamanho: 8, descricao: "2,5 × 3 = 8" });
      expect(
        tamanhoDoLote(lote, { vagas_imediatas: 0, cadastro_reserva: false })
          .aviso,
      ).toBe("SEM_VAGAS");
      expect(
        tamanhoDoLote(
          { ...lote, por_modalidade: true },
          {
            vagas_imediatas: 2,
            cadastro_reserva: false,
            modalidades: { AC: null },
          },
        ).aviso,
      ).toBe("QUADRO_SEM_MODALIDADES");
    });

    it("lote pela nota mínima: a descrição sai com o item; sem nota, aviso", () => {
      expect(
        tamanhoDoLote(
          { base: "NOTA_MINIMA", nota_minima: 15, item_edital: "8.2.6" },
          { vagas_imediatas: null },
        ),
      ).toEqual({
        tamanho: null,
        descricao: "nota ≥ 15 (item 8.2.6)",
        por_modalidade: null,
        aviso: null,
        nota_minima: 15,
      });
      expect(
        tamanhoDoLote({ base: "NOTA_MINIMA", nota_minima: null }, {}).aviso,
      ).toBe("SEM_NOTA_MINIMA");
    });

    it("lote por número fixo sem o número: sem tamanho, aviso e nada de 'null' na descrição", () => {
      expect(tamanhoDoLote({ base: "FIXO", fixo: null }, {})).toEqual({
        tamanho: null,
        descricao: "",
        por_modalidade: null,
        aviso: "SEM_FIXO",
      });
      expect(tamanhoDoLote({ base: "FIXO", fixo: 40 }, {})).toMatchObject({
        tamanho: 40,
        descricao: "40 (número fixo)",
        aviso: null,
      });
      expect(AVISOS_DA_VAGA.SEM_FIXO).toBeTruthy();
    });

    it("meses de experiência declarados pela faixa", () => {
      expect(mesesDeclarados("De 1 a 2 anos")).toBe(12);
      expect(mesesDeclarados("Mais de 5 anos")).toBe(60);
      expect(mesesDeclarados("De 6 meses a 1 ano")).toBe(6);
      expect(mesesDeclarados("Sem experiência")).toBe(0);
      expect(mesesDeclarados("1,5 ano")).toBe(18);
      expect(mesesDeclarados("Menos de 6 meses")).toBe(0);
      expect(mesesDeclarados("Até 1 ano")).toBe(0);
      expect(mesesDeclarados("Abaixo de 2 anos")).toBe(0);
      expect(mesesDeclarados("Inferior a 6 meses")).toBe(0);
      expect(mesesDeclarados("atendimento por 2 anos")).toBe(24);
      expect(mesesDeclarados(24)).toBe(24);
      expect(mesesDeclarados("texto livre")).toBeNull();
      expect(mesesDeclarados("")).toBeNull();
    });

    it("vagas por modalidade do quadro", () => {
      expect(
        vagasPorModalidade({
          "Ampla Concorrência": "2",
          PcD: null,
          Indígenas: 1,
        }),
      ).toEqual({ AC: 2, PCD: 0, PI: 1 });
      expect(vagasPorModalidade({ "Ampla Concorrência": null })).toBeNull();
    });

    it("idade e número no texto", () => {
      expect(idadeEm("1966-10-07", "2026-10-06")).toBe(59);
      expect(idadeEm("1966-10-06", "2026-10-06")).toBe(60);
      expect(idadeEm(null, "2026-10-06")).toBeNull();
      expect(numeroNoTexto(24)).toBe("24");
      expect(numeroNoTexto(18.5)).toBe("18,5");
    });
  });

  describe("base da nota do lote e declarada congelada (os mesmos casos no pytest)", () => {
    const casoDaBase = CASOS.casos.find((c) =>
      c.nome.startsWith("base da nota pela declarada"),
    );

    it("sem base na regra: DECLARADA com nota declarada, ART sem", () => {
      expect(normalizarRegraAnalise({}).provisoria.base_da_nota).toBe("ART");
      expect(
        normalizarRegraAnalise(casoDaBase.regra).provisoria.base_da_nota,
      ).toBe("DECLARADA");
      expect(
        normalizarRegraAnalise({
          ...casoDaBase.regra,
          provisoria: { ...casoDaBase.regra.provisoria, base_da_nota: "ART" },
        }).provisoria.base_da_nota,
      ).toBe("ART");
    });

    it("base desconhecida não trava (é da Triagem); a declarada sem nota declarada, sim", () => {
      const com = (provisoria) =>
        validarRegraAnalise(
          normalizarRegraAnalise({ ...casoDaBase.regra, provisoria }),
        ).join(" ");
      expect(
        com({ ...casoDaBase.regra.provisoria, base_da_nota: "MAIOR" }),
      ).toBe("");
      expect(
        com({
          ...casoDaBase.regra.provisoria,
          nota_declarada: [],
          base_da_nota: "DECLARADA",
        }),
      ).toMatch(/configure a nota declarada/);
      expect(com({ ...casoDaBase.regra.provisoria, base_da_nota: "ART" })).toBe(
        "",
      );
    });

    it("com a base ART o mesmo caso volta à ordem pela ART", () => {
      const r = rodar({
        ...casoDaBase,
        regra: {
          ...casoDaBase.regra,
          provisoria: { ...casoDaBase.regra.provisoria, base_da_nota: "ART" },
        },
      });
      const porCodigo = Object.fromEntries(r.linhas.map((l) => [l.codigo, l]));
      expect(porCodigo["2171493"].situacao).toBe("RANQUEADO");
      expect(porCodigo["7100004"].situacao).toBe("NO_LOTE");
      expect(r.resumo.base_da_nota).toBe("ART");
      expect(r.resumo.avisos).not.toContain("SEM_DECLARADA_COMPLETA");
    });

    it.each(CASOS.congelamento.fim_das_inscricoes)(
      "fim das inscrições de %j",
      (cronograma, esperado) =>
        expect(fimDasInscricoes(cronograma)).toBe(esperado),
    );

    it.each(CASOS.data_da_idade.casos)(
      "idade do desempate: cronograma %j e hoje %s → %s",
      (cronograma, hoje, esperado) =>
        expect(dataDaIdade(cronograma, hoje)).toBe(esperado),
    );

    it.each(CASOS.congelamento.congela)(
      "congela em %s com fim %s: %s",
      (hoje, fim, esperado) =>
        expect(congelaADeclarada(hoje, fim)).toBe(esperado),
    );

    it("a congelada guarda as respostas usadas e o anterior inválido é ignorado", () => {
      const c = CASOS.casos.find((x) => x.nome.startsWith("congelamento:"));
      const linha = rodar(c).linhas.find((l) => l.codigo === "2171493");
      expect(linha.declarada_congelada.respostas).toHaveLength(3);
      expect(linha.declarada_congelada.respostas[2]).toEqual({
        parcial: "EXPERIENCIA",
        coluna:
          "Pergunta 5 - Experiência Profissional em atividades compatíveis",
        resposta: '"1 ano"',
        pontos: 10,
      });
      expect(declaradaCongelada({ total: "20" })).toBeNull();
      expect(declaradaCongelada(null)).toBeNull();
      expect(declaradaCongelada({ total: 20 })).toEqual({
        total: 20,
        parciais: {},
        sem_mapa: 0,
        respostas: [],
      });
    });
  });

  describe("regra: desempate e lote por vaga", () => {
    it("o padrão do desempate é idoso e candidatura", () => {
      expect(normalizarRegraAnalise({}).provisoria.desempate).toEqual([
        "IDOSO",
        "CANDIDATURA",
      ]);
    });

    it("desempate e lote por vaga são da Triagem: não travam o salvar da análise", () => {
      const base = normalizarRegraAnalise(CASOS.casos[0].regra);
      const com = (mudar) => {
        const r = structuredClone(base);
        mudar(r);
        return validarRegraAnalise(r).join(" ");
      };
      expect(com((r) => (r.provisoria.desempate = ["SORTEIO"]))).toBe("");
      expect(com((r) => (r.provisoria.desempate = ["IDOSO", "IDOSO"]))).toBe(
        "",
      );
      expect(com((r) => (r.lote.por_vaga = { "17A": 3 }))).toBe("");
      expect(com((r) => (r.lote.por_vaga = { 179698: 0 }))).toBe("");
      expect(com((r) => (r.lote.por_vaga = { 179698: 40 }))).toBe("");
    });
  });

  describe("nota declarada por nível da vaga (os mesmos casos no pytest)", () => {
    const ND = CASOS.nota_declarada_por_nivel;
    it.each(ND.casos.map((c) => [c.nome, c]))("%s", (_nome, c) => {
      expect(calcularNotaDeclarada(ND.regra, c.respostas, c.nivel)).toEqual(
        c.esperado,
      );
    });

    it("caso real do 93/2026: vaga técnica, '5 anos e 6 meses ou mais' + cursos '10 pontos' = 50 = ART", () => {
      const r = calcularNotaDeclarada(
        ND.regra,
        ND.casos[0].respostas,
        "tecnico",
      );
      expect(r.parciais).toEqual({ FORMACAO: 0, CURSOS: 10, EXPERIENCIA: 40 });
      expect(r.total).toBe(50);
      expect(r.completa).toBe(true);
      expect(divergeDaArt(artDasColunas(ND.casos[0].respostas), r.total)).toBe(
        false,
      );
    });

    it("a mesma resposta vale pontos diferentes por nível; sem nível não soma", () => {
      const respostas = { "Pergunta 11 - Experiência Profissional": '"1 ano"' };
      const exp = (nivel) =>
        calcularNotaDeclarada(ND.regra, respostas, nivel).parciais.EXPERIENCIA;
      expect([exp("superior"), exp("tecnico"), exp("medio")]).toEqual([
        5, 4, 4,
      ]);
      const sem = calcularNotaDeclarada(ND.regra, respostas, null);
      expect(sem.parciais.EXPERIENCIA).toBeUndefined();
      expect(sem.itens[2].nivel_desconhecido).toBe(true);
      expect(sem.completa).toBe(false);
      expect(sem.sem_mapa).toBe(0);
    });

    it("o nível da vaga sai do cargo e da regra de classificação", () => {
      for (const c of CASOS.niveis_da_vaga.casos)
        expect(
          nivelDaVaga({ cargo: c.cargo ?? "" }, { documental: c.documental }),
          String(c.cargo),
        ).toBe(c.esperado);
    });

    it("divergência ART × declarada só com a declarada completa; sem nível vira aviso", () => {
      const [porNivel, semNivel] = CASOS.casos.filter((c) =>
        c.nome.includes("nível"),
      );
      const div = (caso) =>
        Object.fromEntries(rodar(caso).linhas.map((l) => [l.id, l.divergente]));
      expect(div(porNivel)).toEqual({
        t01: false,
        t02: false,
        t03: true,
        t04: false,
      });
      expect(div(semNivel)).toEqual({
        t01: false,
        t02: false,
        t03: false,
        t04: false,
      });
      expect(rodar(semNivel).resumo.avisos).toEqual([
        "SEM_NIVEL:NOTA_EXPERIENCIA",
      ]);
      for (const caso of [porNivel, semNivel])
        expect(
          Object.fromEntries(
            rodar(caso).linhas.map((l) => [
              l.id,
              { declarada: l.declarada, parciais: l.declarada_parciais },
            ]),
          ),
        ).toEqual(caso.esperado_declarada);
    });

    it("a regra aceita pontos por nível só em OPCAO/OPCOES_SOMADAS, com nível conhecido, sem os pontos simples", () => {
      const regra = (item) =>
        normalizarRegraAnalise({
          ...CASOS.casos[0].regra,
          provisoria: {
            ...CASOS.casos[0].regra.provisoria,
            nota_declarada: [item],
          },
        });
      const exp = ND.regra.provisoria.nota_declarada[2];
      const erros = (item) => validarRegraAnalise(regra(item)).join(" ");
      expect(erros(exp)).toBe("");
      expect(erros({ ...exp, tipo: "OPCOES_SOMADAS" })).toBe("");
      expect(erros({ ...exp, pontos: { "1 ano": 5 } })).toMatch(/não os dois/);
      expect(
        erros({ ...exp, tipo: "FAIXA_EM_MESES", meses: {}, pontos_por_mes: 1 }),
      ).toMatch(/só em OPCAO ou OPCOES_SOMADAS/);
      expect(erros({ ...exp, pontos_por_nivel: { doutor: { a: 1 } } })).toMatch(
        /pontos por nível/,
      );
      expect(erros({ ...exp, pontos_por_nivel: {} })).toMatch(
        /pontos por nível/,
      );
      expect(
        erros({ ...exp, pontos_por_nivel: { superior: { a: 101 } } }),
      ).toMatch(/pontos por nível/);
    });
  });
});

bloco("lib/avaliacao-documental-regra-por-cargo", () => {
  /*
  Diferenças por cargo da regra (regra-por-cargo.ts): quem vale para a vaga,
  a regra da vaga (cargo > nível > padrão), os extras e requisitos na ficha,
  o aviso do 8.2.7 e a validação. A conta com o 114/2026 está nos casos
  dourados ("por cargo: …"), que o Python também roda.
*/
  const CASOS = JSON.parse(
    readFileSync(
      "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
      "utf8",
    ),
  );
  const REGRA = CASOS.regras["E114-POR-CARGO"];
  const CORRECAO = readFileSync(
    "tests/fixtures/sql-de-dados/20261013-edital-114-regra-por-cargo.sql",
    "utf8",
  ).replace(/\r\n/g, "\n");
  const DOCUMENTAL = { nota_minima: 10, nota_minima_por_nivel: {} };
  const bloco = (regra, codigo) =>
    regra.blocos.find((b) => b.codigo === codigo);

  describe("quem vale para a vaga", () => {
    it("compara o cargo sem acento e por palavras inteiras", () => {
      expect(
        textoDoCargo("CARGO 15: MOTORISTA - Categoria D (Nível Médio)"),
      ).toBe("cargo 15 motorista categoria d nivel medio");
      expect(cargoCasa("CARGO 15 MOTORISTA - Categoria D", "CARGO 15")).toBe(
        true,
      );
      expect(cargoCasa("CARGO 15 MOTORISTA - Categoria D", "CARGO 1")).toBe(
        false,
      );
      expect(
        cargoCasa("Técnico de Laboratório", "tecnico de laboratorio"),
      ).toBe(true);
      expect(cargoCasa("", "CARGO 1")).toBe(false);
    });

    it("o código da vaga vale antes do nome do cargo", () => {
      expect(diferencaDaVaga(REGRA, { vaga: "182567" })?.codigo).toBe(
        "MOTORISTA_D",
      );
      // A vaga do cargo 14 com um nome de cargo 15: vale a vaga.
      expect(
        diferencaDaVaga(REGRA, { vaga: "182513", cargo: "CARGO 15" })?.codigo,
      ).toBe("MOTORISTA_B");
      expect(
        diferencaDaVaga(REGRA, { vaga: "1", cargo: "CARGO 1: QUÍMICO" })
          ?.codigo,
      ).toBe("ANALISE_DA_AGUA");
      expect(diferencaDaVaga(REGRA, { vaga: "1", cargo: "Outro" })).toBeNull();
      expect(diferencaDaVaga({ blocos: [] }, { vaga: "182567" })).toBeNull();
    });

    it("o seletor curto de um cargo do quadro", () => {
      expect(
        seletorDoCargo("CARGO 15: MOTORISTA - Categoria D (Nível Médio)"),
      ).toBe("CARGO 15");
      expect(seletorDoCargo("Cargo nº 3 - Biólogo")).toBe("CARGO 3");
      expect(seletorDoCargo("Agente Indígena de Saúde (Nível Médio)")).toBe(
        "Agente Indígena de Saúde",
      );
    });
  });

  describe("a regra da vaga", () => {
    it("Motorista D: cursos com teto 15, faixas do médio e o UMCQA; o cargo vence o nível", () => {
      const r = regraDaVaga(REGRA, { vaga: "182528", nivel: "superior" });
      const cursos = bloco(r, "CURSOS");
      expect(cursos.teto).toBe(15);
      expect(cursos.faixas.map((f) => f.pontos)).toEqual([2, 4, 6]);
      expect(cursos.extras[0]).toMatchObject({ codigo: "UMCQA", pontos: 5 });
      expect(cursos.por_nivel).toBeUndefined();
      expect(r.cargo).toEqual({
        codigo: "MOTORISTA_D",
        rotulo: "Cargo 15 — Motorista categoria D",
      });
      const req = bloco(r, "REQUISITO_DO_CARGO");
      expect(req.requisitos.map((q) => q.codigo)).toEqual([
        "CNH_D",
        "DIRECAO_DEFENSIVA",
      ]);
      expect(req.motivos.find((m) => m.codigo === "CNH_D")).toEqual({
        codigo: "CNH_D",
        texto: "Não apresentou CNH categoria D vigente (Anexo I).",
        item_edital: "2 e Anexo I",
        efeito: "ELIMINA",
      });
      expect(bloco(r, "EXPERIENCIA").area).toMatch(/^Condução de veículos/);
      // Os blocos que o cargo não muda ficam iguais.
      expect(bloco(r, "FORMACAO")).toBe(bloco(REGRA, "FORMACAO"));
    });

    it("aplicar de novo não muda nada; sem diferença, a própria regra", () => {
      const uma = regraDaVaga(REGRA, { vaga: "182528", nivel: "medio" });
      expect(regraDaVaga(uma, { vaga: "182528", nivel: "medio" })).toBe(uma);
      expect(
        regraDaFicha(uma, { vaga: "182528", nivel: "medio" }).blocos,
      ).toEqual(uma.blocos);
      expect(regraDaVaga(REGRA, { vaga: "1", cargo: "Outro" })).toBe(REGRA);
    });

    it("teto null na diferença tira o teto", () => {
      const regra = {
        ...REGRA,
        por_cargo: [
          {
            codigo: "SEM_TETO",
            rotulo: "x",
            vagas: ["1"],
            blocos: { CURSOS: { teto: null } },
          },
        ],
      };
      expect(
        bloco(regraDaVaga(regra, { vaga: "1", nivel: "medio" }), "CURSOS").teto,
      ).toBeNull();
    });
  });

  describe("a ficha do Motorista D", () => {
    const base = () =>
      lancamentoInicial({
        regra: REGRA,
        respostas: {},
        modalidade: "AC",
        cargo: "CARGO 15: MOTORISTA - Categoria D (Nível Médio)",
        vaga: 182528,
        documental: DOCUMENTAL,
        gravado: { vaga: "999", cargo: "gravado antes", nivel: "medio" },
      });

    it("o lançamento leva a vaga e o cargo da ficha (o gravado não vence)", () => {
      const l = base();
      expect(l.vaga).toBe("182528");
      expect(l.cargo).toBe("CARGO 15: MOTORISTA - Categoria D (Nível Médio)");
    });

    it("composição com o teto do cargo (Cursos 0/15) e o UMCQA somando até o teto", () => {
      const l = base();
      l.blocos.CURSOS = { situacao: "CONFORME", edita_nota: true };
      const antes = composicaoDaNota(
        REGRA,
        l,
        calcularFicha(REGRA, l, DOCUMENTAL),
        null,
      );
      expect(antes.find((p) => p.parcial === "CURSOS")).toMatchObject({
        apurado: 0,
        teto: 15,
      });
      const com = {
        ...l,
        blocos: {
          ...l.blocos,
          CURSOS: lancadoComExtra(l.blocos.CURSOS, "UMCQA", true),
        },
      };
      com.cursos = [{ nome: "A", horas: 61, aceito: true }];
      expect(calcularFicha(REGRA, com, DOCUMENTAL).parciais.CURSOS).toBe(9);
      expect(
        pontosDosExtras(
          bloco(regraDaFicha(REGRA, com), "CURSOS"),
          com.blocos.CURSOS,
        ),
      ).toBe(5);
    });

    it("pede cada requisito do cargo e o extra na pontuação pelos itens", () => {
      const l = base();
      l.blocos.REQUISITO_DO_CARGO = { situacao: "CONFORME" };
      l.blocos.CURSOS = { situacao: "CONFORME", edita_nota: true };
      const faltas = pendenciasDaFicha(
        REGRA,
        l,
        calcularFicha(REGRA, l, DOCUMENTAL),
        null,
      )
        .filter((p) => ["requisito", "extra"].includes(p.tipo))
        .map((p) => [p.bloco, p.tipo]);
      expect(faltas).toEqual([
        ["REQUISITO_DO_CARGO", "requisito"],
        ["CURSOS", "extra"],
      ]);
      // Com a nota ajustada (Confere com o declarado), o extra não conta.
      expect(
        faltasDoCargo(bloco(regraDaFicha(REGRA, l), "CURSOS"), {
          situacao: "CONFORME",
          nota_ajustada: 10,
        }),
      ).toEqual([]);
    });

    it("um requisito Não confere vira o motivo que elimina", () => {
      const r = regraDaFicha(REGRA, base());
      const req = bloco(r, "REQUISITO_DO_CARGO");
      let lancado = lancadoComRequisito(req, {}, "CNH_D", true);
      expect(lancado).toMatchObject({ situacao: null, motivos: [] });
      lancado = lancadoComRequisito(req, lancado, "DIRECAO_DEFENSIVA", true);
      expect(lancado).toMatchObject({ situacao: "CONFORME", motivos: [] });
      lancado = lancadoComRequisito(req, lancado, "CNH_D", false);
      expect(lancado).toMatchObject({
        situacao: "NAO_CONFORME",
        motivos: ["CNH_D"],
      });
      const l = { ...base(), blocos: { REQUISITO_DO_CARGO: lancado } };
      const a = calcularAvaliacao(REGRA, l, { notaMinima: 10 });
      expect(a.resultado).toBe("INAPTO_REQUISITO");
      expect(a.eliminatorios[0]).toBe(
        "Item 2 e Anexo I: Não apresentou CNH categoria D vigente (Anexo I).",
      );
      // Outro motivo do bloco fica; desmarcar o requisito tira só o dele.
      const comOutro = { ...lancado, motivos: ["SEM_CNH", "CNH_D"] };
      expect(lancadoComRequisito(req, comOutro, "CNH_D", null)).toMatchObject({
        situacao: "NAO_CONFORME",
        motivos: ["SEM_CNH"],
      });
    });

    it("8.2.7: o curso de direção defensiva lançado para pontuar é avisado", () => {
      const l = base();
      l.blocos.REQUISITO_DO_CARGO = {
        situacao: "CONFORME",
        requisitos: { CNH_D: true, DIRECAO_DEFENSIVA: true },
      };
      const r = regraDaFicha(REGRA, l);
      const cursos = bloco(r, "CURSOS");
      const comNome = avisosDoTituloUnico(
        r,
        cursos,
        [{ nome: "Curso de Direção Defensiva", horas: 50 }],
        l,
      );
      expect(comNome).toHaveLength(1);
      expect(comNome[0].texto).toMatch(
        /^Item 8\.2\.7: "Curso de Direção Defensiva" parece ser o requisito "Curso de direção defensiva"/,
      );
      const semNome = avisosDoTituloUnico(
        r,
        cursos,
        [{ nome: "Mecânica", horas: 50 }],
        l,
      );
      expect(semNome.map((a) => a.texto)).toEqual([
        'Item 8.2.7: "Curso de direção defensiva" já valeu como requisito do cargo e não pontua aqui.',
      ]);
      expect(
        avisosDoTituloUnico(
          r,
          cursos,
          [{ nome: "Direção defensiva", aceito: false }],
          l,
        ),
      ).toEqual([]);
      expect(
        avisosDoTituloUnico(
          r,
          bloco(r, "FORMACAO"),
          [{ nome: "Direção defensiva" }],
          l,
        ),
      ).toEqual([]);
    });
  });

  describe("bloco que não se aplica ao cargo (nao_se_aplica)", () => {
    // O registro no conselho não se aplica ao Motorista D (114/2026, Anexo I).
    const comNaoSeAplica = () => {
      const r = structuredClone(REGRA);
      r.por_cargo.find(
        (d) => d.codigo === "MOTORISTA_D",
      ).blocos.REGISTRO_CONSELHO = { nao_se_aplica: true };
      return r;
    };
    const motorista = (regra) =>
      lancamentoInicial({
        regra,
        respostas: {},
        modalidade: "AC",
        cargo: "CARGO 15: MOTORISTA - Categoria D (Nível Médio)",
        vaga: 182528,
        documental: DOCUMENTAL,
      });

    it("a regra da vaga marca o bloco e a ficha não o pede", () => {
      const regra = comNaoSeAplica();
      const l = motorista(regra);
      const r = regraDaFicha(regra, l);
      expect(bloco(r, "REGISTRO_CONSELHO").nao_se_aplica).toBe(true);
      expect(blocoSeAplica(bloco(r, "REGISTRO_CONSELHO"), l)).toBe(false);
      expect(blocoSeAplica(bloco(r, "IDENTIDADE"), l)).toBe(true);
      // Em outra vaga o bloco vale.
      const quimico = { ...l, vaga: "182418", cargo: "CARGO 1: QUÍMICO" };
      expect(
        bloco(regraDaFicha(regra, quimico), "REGISTRO_CONSELHO").nao_se_aplica,
      ).toBeUndefined();
      const pendentes = pendenciasDaFicha(
        regra,
        l,
        calcularFicha(regra, l, DOCUMENTAL),
        null,
      ).map((p) => p.bloco);
      expect(pendentes).not.toContain("REGISTRO_CONSELHO");
      expect(pendentes).toContain("IDENTIDADE");
    });

    it("o Não enviado no bloco que não se aplica não elimina", () => {
      const l = {
        ...motorista(REGRA),
        blocos: {
          REGISTRO_CONSELHO: {
            situacao: "NAO_ENVIADO",
            motivos: ["SEM_REGISTRO"],
          },
        },
      };
      const doRegistro = (a) =>
        a.eliminatorios.filter((t) => t.includes("conselho de classe"));
      expect(
        doRegistro(calcularAvaliacao(REGRA, l, { notaMinima: 0 })),
      ).toEqual([
        "Item 6.4: Não apresentou registro ativo no conselho de classe exigido para a vaga.",
      ]);
      const a = calcularAvaliacao(comNaoSeAplica(), l, { notaMinima: 0 });
      expect(doRegistro(a)).toEqual([]);
      expect(
        a.blocos.find((b) => b.codigo === "REGISTRO_CONSELHO").situacao,
      ).toBe("NAO_SE_APLICA");
    });

    it("valida: só em bloco de documento, marcado e sozinho; aparece no resumo", () => {
      const regra = comNaoSeAplica();
      expect(validarRegraAnalise(regra)).toEqual([]);
      const d = regra.por_cargo.find((x) => x.codigo === "MOTORISTA_D");
      expect(resumoDaDiferenca(d, regra.blocos)).toContain(
        "Registro ativo no conselho de classe: não se aplica",
      );
      const erros = validarPorCargo({
        blocos: REGRA.blocos,
        por_cargo: [
          {
            codigo: "A1",
            rotulo: "A",
            vagas: ["1"],
            blocos: { REGISTRO_CONSELHO: { nao_se_aplica: false } },
          },
          {
            codigo: "A2",
            rotulo: "B",
            vagas: ["2"],
            blocos: {
              REQUISITO_DO_CARGO: {
                nao_se_aplica: true,
                requisitos: [{ codigo: "X1", rotulo: "X", motivo: "Y" }],
              },
            },
          },
          {
            codigo: "A3",
            rotulo: "C",
            vagas: ["3"],
            blocos: { CURSOS: { nao_se_aplica: true } },
          },
        ],
      });
      expect(erros).toEqual([
        'Diferença por cargo 1 (A), REGISTRO_CONSELHO: "não se aplica" só aceita marcado (true).',
        'Diferença por cargo 2 (B), REQUISITO_DO_CARGO: "não se aplica" não vai com outras mudanças.',
        "Diferença por cargo 3 (C), CURSOS: nao_se_aplica não muda por cargo neste bloco.",
      ]);
    });
  });

  describe("validação", () => {
    it("a regra do 114 com as diferenças é válida e é a mesma da correção", () => {
      expect(validarRegraAnalise(REGRA)).toEqual([]);
      const literal = CORRECAO.match(
        /\$por_cargo\$\n([\s\S]*?)\n\$por_cargo\$/,
      )[1];
      expect(JSON.parse(literal)).toEqual(REGRA.por_cargo);
    });

    it("recusa o que não faz sentido", () => {
      const erros = validarPorCargo({
        blocos: REGRA.blocos,
        por_cargo: [
          { codigo: "a", rotulo: "", vagas: ["x"], blocos: {} },
          {
            codigo: "B1",
            rotulo: "B",
            vagas: ["182528"],
            blocos: { COTA_PP: { teto: 1 } },
          },
          {
            codigo: "B2",
            rotulo: "C",
            vagas: ["182528"],
            cargos: [],
            blocos: {
              CURSOS: {
                teto: 200,
                extras: [{ codigo: "X", rotulo: "", pontos: -1 }],
              },
            },
          },
          { codigo: "B3", rotulo: "D", blocos: { EXPERIENCIA: { area: "" } } },
        ],
      });
      expect(erros).toEqual(
        expect.arrayContaining([
          "Diferença por cargo 1: código em maiúsculas (2 a 30, letras, dígitos, _).",
          "Diferença por cargo 1 (nome): obrigatório.",
          "Diferença por cargo 1: vagas com o código da Empregare (só dígitos, até 200).",
          "Diferença por cargo 1: diga o que muda em ao menos um bloco.",
          "Diferença por cargo 2 (B), COTA_PP: este tipo de bloco não muda por cargo.",
          "Diferença por cargo 3 (C): a vaga 182528 já está na diferença 2.",
          "Diferença por cargo 3 (C), CURSOS: teto entre 0 e 100.",
          "Diferença por cargo 3 (C), CURSOS, extra 1: código em maiúsculas (2 a 30, letras, dígitos, _).",
          "Diferença por cargo 4 (D): diga as vagas ou o cargo.",
          "Diferença por cargo 4 (D), EXPERIENCIA (área exigida): obrigatório.",
        ]),
      );
      expect(validarPorCargo({ blocos: [] })).toEqual([]);
    });

    it("uma diferença nova e o resumo de uma linha", () => {
      expect(diferencaNova([{ codigo: "CARGO_2" }])).toEqual({
        codigo: "CARGO_3",
        rotulo: "",
        vagas: [],
        cargos: [],
        blocos: {},
      });
      const motorista = REGRA.por_cargo.find((d) => d.codigo === "MOTORISTA_D");
      expect(resumoDaDiferenca(motorista, REGRA.blocos)).toBe(
        "Cursos de aperfeiçoamento na área da vaga: teto 15, 3 faixas, +1 extra · Requisito específico do cargo: 2 requisitos · Experiência na área: área exigida",
      );
    });
  });

  describe("resumo, comparação e o que falta para salvar", () => {
    it("o resumo de uma página traz as diferenças por cargo", async () => {
      const { resumoDaRegra } =
        await import("../src/lib/avaliacao-documental/resumo-da-regra.ts");
      const secao = resumoDaRegra(REGRA).secoes.find(
        (s) => s.titulo === "Diferenças por cargo",
      );
      expect(secao.itens).toHaveLength(9);
      expect(secao.itens.at(-1)).toContain(
        "Cargo 15 — Motorista categoria D (CARGO 15; vagas 182528, 182567) — Cursos: 40 a 60 h: 2 pontos",
      );
      expect(secao.itens.at(-1)).toContain("+5 por Certificado de capacitação");
      expect(secao.itens.every((t) => !t.endsWith(".."))).toBe(true);
    });

    it("a comparação de versões diz cada diferença que entrou ou saiu", async () => {
      const { diferencasEntreRegras, fraseDaDiferenca } =
        await import("../src/lib/avaliacao-documental/comparar-regras.ts");
      const sem = { ...REGRA };
      delete sem.por_cargo;
      expect(diferencasEntreRegras(sem, REGRA).map(fraseDaDiferenca)).toContain(
        'Entrou: Diferenças por cargo › diferença "Cargo 15 — Motorista categoria D"',
      );
      const outra = structuredClone(REGRA);
      outra.por_cargo.at(-1).blocos.CURSOS.teto = 14;
      expect(diferencasEntreRegras(REGRA, outra).map(fraseDaDiferenca)).toEqual(
        [
          'Diferenças por cargo › diferença "Cargo 15 — Motorista categoria D" › blocos › CURSOS › teto: 15 → 14',
        ],
      );
      expect(diferencasEntreRegras(REGRA, sem).map(fraseDaDiferenca)).toContain(
        'Saiu: Diferenças por cargo › diferença "Cargos 1 a 4 — Análise da Água"',
      );
    });

    it("o erro de uma diferença leva ao passo 2, na seção", async () => {
      const { lugarDoErro } =
        await import("../src/lib/avaliacao-documental/pendencias-do-salvar.ts");
      expect(
        lugarDoErro("Diferença por cargo 2 (B): diga as vagas ou o cargo."),
      ).toEqual({
        passo: "cardapio",
        alvo: "[data-tour='avd-diferencas-por-cargo']",
      });
    });
  });
});

bloco("lib/avaliacao-documental-regra", () => {
  /*
  Formato e validação da regra da avaliação documental (AM-2.x) e da equipe
  (AM-3.x). O banco repete a validação (FC_VALIDAR_REGRA_ANALISE); o ensaio
  da migration recusa as mesmas regras ruins.
*/
  const { regras } = JSON.parse(
    readFileSync(
      "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
      "utf8",
    ),
  );
  const boa = () => structuredClone(regras["PROJ26-CURRICULAR"]);
  const comBloco = (codigo, mudar) => {
    const r = boa();
    mudar(r.blocos.find((b) => b.codigo === codigo));
    return r;
  };

  describe("validarRegraAnalise", () => {
    it.each(Object.keys(regras))("o modelo %s é válido", (codigo) => {
      expect(validarRegraAnalise(regras[codigo])).toEqual([]);
    });

    it("a regra normalizada de um objeto vazio só falta os blocos", () => {
      expect(validarRegraAnalise(normalizarRegraAnalise({}))).toEqual([
        "De 1 a 40 blocos.",
      ]);
    });

    it.each([
      ["não objeto", () => [], "Regra inválida"],
      ["schema 2", () => ({ ...boa(), schema: 2 }), "schema"],
      [
        "sem título da etapa",
        () => ({ ...boa(), titulo_etapa: "" }),
        "Título da etapa",
      ],
      [
        "bloco repetido",
        () => ({ ...boa(), blocos: [...boa().blocos, boa().blocos[0]] }),
        "repetido",
      ],
      [
        "código minúsculo",
        () => comBloco("IDENTIDADE", (b) => (b.codigo = "identidade")),
        "código",
      ],
      [
        "tipo inventado",
        () => comBloco("IDENTIDADE", (b) => (b.tipo = "FOTO")),
        "tipo desconhecido",
      ],
      [
        "efeito inventado",
        () => comBloco("IDENTIDADE", (b) => (b.efeitos.NAO_CONFORME = "SOME")),
        "efeito desconhecido",
      ],
      [
        "Conforme que elimina",
        () => comBloco("IDENTIDADE", (b) => (b.efeitos.CONFORME = "ELIMINA")),
        "Conforme não pode",
      ],
      [
        "documento que zera pontos",
        () =>
          comBloco(
            "IDENTIDADE",
            (b) => (b.efeitos.NAO_CONFORME = "ZERA_PONTOS"),
          ),
        "só bloco que pontua",
      ],
      [
        "documento que encaminha",
        () =>
          comBloco(
            "IDENTIDADE",
            (b) => (b.efeitos.CONFORME = "ENCAMINHA_PERICIA"),
          ),
        "só bloco de cota",
      ],
      [
        "motivo sem texto",
        () => comBloco("IDENTIDADE", (b) => (b.motivos[0].texto = "")),
        "texto",
      ],
      [
        "condição inventada",
        () => comBloco("COTA_PP", (b) => (b.condicao = "SE_QUISER")),
        "condição",
      ],
      [
        "dois blocos de títulos",
        () => ({
          ...boa(),
          blocos: [
            ...boa().blocos,
            {
              ...boa().blocos.find((b) => b.tipo === "TITULOS"),
              codigo: "OUTRO",
            },
          ],
        }),
        "Só um bloco do tipo TITULOS",
      ],
      [
        "título desconhecido",
        () =>
          comBloco(
            "FORMACAO",
            (b) => (b.pontos_por_nivel.superior[0].titulo = "MBA"),
          ),
        "título conhecido",
      ],
      [
        "nível desconhecido",
        () => comBloco("FORMACAO", (b) => (b.pontos_por_nivel.pos = [])),
        "nível pos",
      ],
      [
        "faixa invertida",
        () => comBloco("CURSOS", (b) => (b.faixas[0].max_horas = 10)),
        "mínimo ≤ máximo",
      ],
      [
        "faixa por nível sem pontos",
        () =>
          comBloco(
            "CURSOS",
            (b) => (b.por_nivel.tecnico.faixas[0].pontos = -1),
          ),
        "tecnico, faixa 1",
      ],
      [
        "período zero",
        () => comBloco("EXPERIENCIA", (b) => (b.periodo_meses = 0)),
        "período",
      ],
      [
        "desempate repetido",
        () =>
          comBloco(
            "EXPERIENCIA",
            (b) =>
              b.categorias.push(
                { codigo: "OUTRA", rotulo: "Outra", desempate: null },
                { codigo: "MAIS", rotulo: "Mais", desempate: null },
              ) &&
              (b.categorias[1].desempate = 1) &&
              (b.categorias[2].desempate = 1),
          ),
        "desempate 1 repetido",
      ],
      [
        "data limite inválida",
        () => comBloco("EXPERIENCIA", (b) => (b.data_limite = "2026-02-30")),
        "data limite",
      ],
      [
        "distribuição inventada",
        () => ({ ...boa(), distribuicao: { modo: "SORTEIO" } }),
        "Distribuição",
      ],
      [
        "amostra acima de 100%",
        () => ({
          ...boa(),
          revisao: { ...boa().revisao, amostra_percentual: 150 },
        }),
        "amostra",
      ],
      [
        "nota mínima fora da regra de classificação",
        () => ({ ...boa(), corte: { fonte: "AQUI" } }),
        "regra de classificação",
      ],
      [
        "parecer sem modelo de apto",
        () => ({ ...boa(), parecer: { ...boa().parecer, APTO: "" } }),
        "Parecer (APTO)",
      ],
      [
        "eliminação sem coluna",
        () => ({
          ...boa(),
          provisoria: {
            ...boa().provisoria,
            eliminacao_automatica: [
              { codigo: "X1", quando: ["A"], motivo: "m" },
            ],
          },
        }),
        "coluna",
      ],
      [
        "nota declarada com pontos negativos",
        () => ({
          ...boa(),
          provisoria: {
            ...boa().provisoria,
            nota_declarada: [
              {
                parcial: "FORMACAO",
                pergunta: "Pergunta 1 -",
                tipo: "OPCAO",
                pontos: { Sim: -1 },
              },
            ],
          },
        }),
        "pontos de cada resposta",
      ],
      [
        "pergunta da nota declarada em lista com texto vazio",
        () => ({
          ...boa(),
          provisoria: {
            ...boa().provisoria,
            nota_declarada: [
              {
                parcial: "ETNICO",
                pergunta: ["Você é indígena", " "],
                tipo: "OPCAO",
                pontos: { Sim: 1 },
              },
            ],
          },
        }),
        "lista de 1 a 10 textos",
      ],
      [
        "observação pronta repetida",
        () => ({
          ...boa(),
          observacoes_prontas: [
            boa().observacoes_prontas[0],
            boa().observacoes_prontas[0],
          ],
        }),
        "repetido",
      ],
    ])("recusa %s", (_nome, montar, trecho) => {
      const erros = validarRegraAnalise(montar());
      expect(erros.join(" | ")).toContain(trecho);
    });
  });

  /*
  O que é da Triagem (lote, base da nota do lote, desempate da lista e a
  pergunta da experiência) não trava o salvar da regra da análise: a Triagem
  tem a regra própria (Regras do edital, etapa Triagem), e uma regra antiga
  com um valor estranho ali continua salvável pelo formulário.
*/
  describe("campos da Triagem na regra da análise", () => {
    it.each([
      [
        "lote sem múltiplo",
        () => ({
          ...boa(),
          lote: { ...boa().lote, base: "MULTIPLO_VAGAS", multiplo: 0 },
        }),
      ],
      [
        "lote pela nota mínima sem a nota",
        () => ({
          ...boa(),
          lote: { ...boa().lote, base: "NOTA_MINIMA", nota_minima: null },
        }),
      ],
      [
        "desempate pela experiência sem a pergunta",
        () => ({
          ...boa(),
          provisoria: {
            ...boa().provisoria,
            desempate: ["EXPERIENCIA_DECLARADA"],
            pergunta_experiencia: null,
          },
        }),
      ],
      [
        "lote fixo sem número",
        () => ({ ...boa(), lote: { ...boa().lote, base: "FIXO", fixo: null } }),
      ],
      [
        "pergunta da experiência em lista vazia",
        () => ({
          ...boa(),
          provisoria: { ...boa().provisoria, pergunta_experiencia: [] },
        }),
      ],
    ])("não trava o salvar: %s", (_nome, montar) => {
      expect(validarRegraAnalise(montar())).toEqual([]);
    });

    it("a base pela declarada sem nota declarada continua recusada (o banco também recusa)", () => {
      const r = boa();
      r.provisoria.base_da_nota = "DECLARADA";
      r.provisoria.nota_declarada = [];
      expect(validarRegraAnalise(r)).toEqual([
        "Base da nota do lote pela declarada: configure a nota declarada.",
      ]);
    });
  });

  describe("a pergunta da regra: texto ou lista de alternativas", () => {
    const alternativas = [
      "Selecione sua Experiência Profissional",
      "Marque a pontuação referente a sua experiência profissional",
    ];

    it("aceita lista na experiência do desempate e na nota declarada", () => {
      const r = boa();
      r.provisoria.desempate = ["IDOSO", "EXPERIENCIA_DECLARADA"];
      r.provisoria.pergunta_experiencia = alternativas;
      r.provisoria.nota_declarada = [
        {
          parcial: "ETNICO",
          pergunta: ["Você é indígena e mora em aldeia", "Você é indígena"],
          tipo: "OPCOES_SOMADAS",
          pontos: { "Sou indígena": 8 },
          teto: 14,
        },
      ];
      expect(validarRegraAnalise(r)).toEqual([]);
    });

    it("normaliza: tira espaços e textos vazios; sem texto, null", () => {
      expect(normalizarPergunta([" a ", "", 3, "b"])).toEqual(["a", "b"]);
      expect(normalizarPergunta([" "])).toBeNull();
      expect(normalizarPergunta("  Experiência  ")).toBe("Experiência");
      expect(normalizarPergunta(undefined)).toBeNull();
      expect(
        normalizarRegraAnalise({
          provisoria: { pergunta_experiencia: [" x "] },
        }).provisoria.pergunta_experiencia,
      ).toEqual(["x"]);
    });

    it("a tela mostra as alternativas separadas por ';' e lê de volta", () => {
      expect(textoDaPergunta(alternativas)).toBe(
        "Selecione sua Experiência Profissional; Marque a pontuação referente a sua experiência profissional",
      );
      expect(perguntaDoTexto(textoDaPergunta(alternativas))).toEqual(
        alternativas,
      );
      expect(perguntaDoTexto("Experiência Profissional ")).toBe(
        "Experiência Profissional",
      );
      expect(perguntaDoTexto(" ; ")).toBe("");
    });
  });

  describe("blocos novos", () => {
    it.each(TIPOS_DE_BLOCO.map(([tipo]) => tipo))(
      "%s nasce sem peso inventado e fica válido com título",
      (tipo) => {
        const bloco = { ...blocoNovo(tipo, "NOVO"), titulo: "Novo" };
        if (tipo === "TITULOS")
          bloco.pontos_por_nivel.superior.push({
            titulo: "MESTRADO",
            pontos: 0,
          });
        const regra = { ...normalizarRegraAnalise({}), blocos: [bloco] };
        expect(validarRegraAnalise(regra)).toEqual([]);
        for (const chave of [
          "indigena",
          "aldeia",
          "pontos_por_mes",
          "pontos_por_periodo",
        ])
          if (chave in bloco) expect(bloco[chave]).toBe(0);
      },
    );

    it("código livre não repete", () => {
      expect(codigoLivre([{ codigo: "BLOCO_2" }])).toBe("BLOCO_3");
      expect(codigoLivre([])).toBe("BLOCO_1");
    });

    it("regras iguais ignoram a ordem das chaves", () => {
      expect(
        regrasIguais(
          { a: 1, b: [1, { c: 2, d: 3 }] },
          { b: [1, { d: 3, c: 2 }], a: 1 },
        ),
      ).toBe(true);
      expect(regrasIguais({ a: 1 }, { a: 2 })).toBe(false);
    });
  });

  describe("equipe do edital (AM-3)", () => {
    const ana = "00000000-0000-4000-a000-000000000001";
    const bia = "00000000-0000-4000-a000-000000000002";

    it("linha da tela vira o formato do banco", () => {
      expect(
        linhaDaEquipe({
          usuario: ana,
          papel: "analista",
          vaga: " 177979 ",
          limite: "30",
        }),
      ).toEqual({
        usuario: ana,
        papel: "ANALISTA",
        vaga: "177979",
        limite: 30,
      });
      expect(
        linhaDaEquipe({ usuario: ana, papel: "REVISOR", vaga: "", limite: "" }),
      ).toMatchObject({ vaga: null, limite: null });
    });

    it("confere pessoa, papel, vaga, limite e repetição", () => {
      expect(
        validarEquipe([
          { usuario: ana, papel: "ANALISTA" },
          { usuario: ana, papel: "REVISOR" },
        ]),
      ).toEqual([]);
      const erros = validarEquipe(
        [
          { usuario: "", papel: "ANALISTA" },
          { usuario: ana, papel: "CHEFE" },
          { usuario: ana, papel: "ANALISTA", vaga: "12a" },
          { usuario: ana, papel: "ANALISTA", limite: "0" },
          { usuario: bia, papel: "COORDENADOR", vaga: "1" },
          { usuario: ana, papel: "REVISOR" },
          { usuario: ana, papel: "REVISOR" },
          { usuario: bia, papel: "COORDENADOR" },
        ],
        { gestores: [{ usuario: bia }] },
      );
      expect(erros).toEqual([
        "Linha 1: escolha a pessoa.",
        "Linha 2: escolha o papel.",
        "Linha 3: código da vaga só com dígitos.",
        "Linha 4: limite de fichas de 1 a 5.000.",
        "Linha 5: a coordenação é do edital todo, sem vaga.",
        "Linha 5: o gestor do edital já coordena.",
        "Linha 7: repetida.",
        "Linha 8: o gestor do edital já coordena.",
      ]);
    });

    it("AM-3.1: o gestor conta como coordenação sem linha", () => {
      expect(
        resumoDaEquipe(
          [{ usuario: ana, papel: "ANALISTA" }],
          [{ usuario: bia }],
        ),
      ).toEqual({
        ANALISTA: 1,
        REVISOR: 0,
        COORDENADOR: 1,
      });
    });
  });
});

bloco("lib/avaliacao-documental-reinicio-das-fichas", () => {
  /*
  Regras da tela do reinício das fichas com dois administradores
  (20261022210000): leitura da resposta, o que a gaveta oferece, o número
  digitado e o motivo do pedido.
*/

  const impacto = (extra = {}) => ({
    concluidas: 1509,
    em_analise: 12,
    com_lancamento: 10,
    iniciadas: 1530,
    exige_aprovacao: true,
    ...extra,
  });
  const pedido = (extra = {}) => ({
    id: 3,
    situacao: "PENDENTE",
    vencido: false,
    motivo: "Regra errada no edital inteiro",
    por: "Beto",
    meu: false,
    em: "2026-10-22T12:00:00Z",
    validade: "2026-10-23T12:00:00Z",
    impacto: { concluidas: 1509, em_analise: 12, iniciadas: 1530 },
    ...extra,
  });

  describe("lerReinicio", () => {
    it("lê o impacto, o pedido e o histórico", () => {
      const r = lerReinicio({
        numero: "114/2026",
        impacto: impacto(),
        bloqueio: null,
        pedido: pedido(),
        historico: [
          {
            pedido: 3,
            tipo: "PEDIR",
            em: "2026-10-22T12:00:00Z",
            por: "Beto",
            motivo: "x",
          },
          {
            pedido: 2,
            tipo: "EXECUTAR",
            em: "2026-10-21T12:00:00Z",
            por: "Ana",
            reiniciadas: 40,
          },
          { pedido: 1, tipo: "OUTRO" },
        ],
      });
      expect(r.numero).toBe("114/2026");
      expect(r.impacto).toEqual({
        concluidas: 1509,
        emAnalise: 12,
        comLancamento: 10,
        iniciadas: 1530,
        exigeAprovacao: true,
      });
      expect(r.pedido?.id).toBe(3);
      expect(r.pedido?.em).toBeInstanceOf(Date);
      expect(r.historico.map((h) => h.tipo)).toEqual(["PEDIR", "EXECUTAR"]);
      expect(r.historico[1].reiniciadas).toBe(40);
    });

    it("entrada vazia ou pedido que não está pendente vira sem pedido", () => {
      expect(lerReinicio(null).pedido).toBeNull();
      expect(
        lerReinicio({ pedido: pedido({ situacao: "EXECUTADO" }) }).pedido,
      ).toBeNull();
      expect(lerReinicio("lixo").impacto.exigeAprovacao).toBe(false);
    });
  });

  describe("modoDoReinicio e pedidoParaAprovar", () => {
    const ler = (extra) =>
      lerReinicio({ numero: "114/2026", impacto: impacto(), ...extra });

    it("bloqueio vence tudo (congelado ou encerrado)", () => {
      expect(
        modoDoReinicio(
          ler({
            bloqueio: "As inscrições deste edital estão congeladas.",
            pedido: pedido(),
          }),
        ),
      ).toBe("bloqueado");
    });

    it("pedido de outro: aprovar; meu: aguardando; vencido: pede de novo", () => {
      expect(modoDoReinicio(ler({ pedido: pedido() }))).toBe("aprovar");
      expect(pedidoParaAprovar(ler({ pedido: pedido() }))?.id).toBe(3);
      expect(modoDoReinicio(ler({ pedido: pedido({ meu: true }) }))).toBe(
        "aguardando",
      );
      expect(
        pedidoParaAprovar(ler({ pedido: pedido({ meu: true }) })),
      ).toBeNull();
      expect(modoDoReinicio(ler({ pedido: pedido({ vencido: true }) }))).toBe(
        "pedir",
      );
      expect(
        pedidoParaAprovar(ler({ pedido: pedido({ vencido: true }) })),
      ).toBeNull();
    });

    it("sem ficha trabalhada: direto; sem ficha iniciada: nada", () => {
      expect(
        modoDoReinicio(
          ler({
            impacto: impacto({
              concluidas: 0,
              com_lancamento: 0,
              exige_aprovacao: false,
            }),
          }),
        ),
      ).toBe("direto");
      expect(
        modoDoReinicio(
          ler({ impacto: impacto({ iniciadas: 0, exige_aprovacao: false }) }),
        ),
      ).toBe("nada");
    });
  });

  describe("numeroConfere", () => {
    it("aceita zeros à esquerda e espaços; recusa outro edital", () => {
      expect(numeroConfere("114/2026", "114/2026")).toBe(true);
      expect(numeroConfere(" 0114 / 2026 ", "114/2026")).toBe(true);
      expect(numeroConfere("114/2025", "114/2026")).toBe(false);
      expect(numeroConfere("14/2026", "114/2026")).toBe(false);
      expect(numeroConfere("", "114/2026")).toBe(false);
      expect(numeroConfere("", "")).toBe(false);
    });

    it("edital sem número: o nome, sem diferença de maiúsculas", () => {
      expect(numeroConfere("fcc", "FCC")).toBe(true);
      expect(numeroConfere("FC", "FCC")).toBe(false);
    });
  });

  describe("erroDoMotivoDoPedido", () => {
    it("pede de 10 a 1.000 caracteres e 3 palavras que pareçam texto", () => {
      expect(erroDoMotivoDoPedido("curto")).toBe("De 10 a 1.000 caracteres.");
      expect(erroDoMotivoDoPedido("x".repeat(1001))).toBe(
        "De 10 a 1.000 caracteres.",
      );
      expect(erroDoMotivoDoPedido("dsdfsdfsfsa fdfdfdf")).toBe(
        "Escreva o motivo com pelo menos 3 palavras.",
      );
      expect(erroDoMotivoDoPedido("testeeee do reinicio")).toBe(
        "Escreva o motivo com pelo menos 3 palavras.",
      );
      expect(erroDoMotivoDoPedido("A regra do edital estava errada")).toBe("");
    });
  });

  describe("textos", () => {
    it("impacto em pt-BR, com singular", () => {
      expect(textoDoImpacto(1509, 12)).toBe("1.509 concluídas e 12 em análise");
      expect(textoDoImpacto(1, 0)).toBe("1 concluída e 0 em análise");
    });

    it("evento do histórico", () => {
      const [executar, recusar] = lerReinicio({
        historico: [
          {
            pedido: 2,
            tipo: "EXECUTAR",
            em: "2026-10-22T15:00:00Z",
            por: "Ana",
            reiniciadas: 40,
          },
          {
            pedido: 1,
            tipo: "RECUSAR",
            em: "2026-10-22T15:00:00Z",
            por: "Beto",
            motivo: "Sem decisão da coordenação",
          },
        ],
      }).historico;
      expect(textoDoEventoDoReinicio(executar)).toMatch(
        /^Pedido 2 · Reiniciou em \d{2}\/\d{2} por Ana: 40 ficha\(s\)$/,
      );
      expect(textoDoEventoDoReinicio(recusar)).toMatch(
        /Recusou .* por Beto: Sem decisão da coordenação$/,
      );
    });

    it("erro do banco: a mensagem dele; função ausente: a migration", () => {
      expect(
        mensagemDoErroDoReinicio({
          code: "42501",
          message: "Você pediu este reinício.",
        }),
      ).toBe("Você pediu este reinício.");
      expect(mensagemDoErroDoReinicio({ code: "PGRST202" })).toContain(
        "20261022210000",
      );
      expect(mensagemDoErroDoReinicio(null)).toBe(
        "Não consegui concluir o reinício.",
      );
    });
  });
});

bloco("lib/avaliacao-documental-relatorio-de-motivos", () => {
  /*
  Relatório de motivos (Avaliação documental › Ações da coordenação): o
  catálogo vem da regra real do 114/2026 (motivos do bloco, requisitos por
  cargo e "Outro motivo"), os filtros viram p_filtros só com o escolhido, os
  atalhos montam os relatórios mais pedidos, as linhas trazem os textos (não
  só os códigos) e o CSV abre no Excel.
*/

  const { regra } = JSON.parse(
    readFileSync(
      "tests/fixtures/avaliacao-documental/ficha-114-2026.json",
      "utf8",
    ),
  );
  const catalogo = catalogoDoRelatorio(regra);

  const ficha = (codigo, blocos, extra = {}) => ({
    id: `f-${codigo}`,
    codigo,
    nome: `Candidato ${codigo}`,
    vaga: "182502",
    cargo: "CARGO 13: AUXILIAR ADMINISTRATIVO",
    situacao: "CONCLUIDA",
    resultado: "INAPTO_REQUISITO",
    nota_final: 0,
    avaliador: "Emanuel Serrano",
    concluida_em: "2026-10-16T19:30:22Z",
    blocos,
    ...extra,
  });

  describe("catálogo da regra", () => {
    it("blocos na ordem da regra, com o Outro motivo por último", () => {
      expect(catalogo.blocos.map((b) => b.codigo).slice(0, 3)).toEqual([
        "IDENTIDADE",
        "ESCOLARIDADE",
        "REQUISITO_DO_CARGO",
      ]);
      const identidade = catalogo.blocos[0];
      expect(identidade.motivos.map((m) => m.codigo)).toEqual([
        "NAO_ACEITO",
        "ILEGIVEL",
        "SEM_IDENTIDADE_6_5",
        "OUTRO",
      ]);
      expect(identidade.motivos.at(-1).texto).toBe("Outro motivo");
    });

    it("os requisitos das diferenças por cargo viram motivos do bloco, sem repetir", () => {
      const requisito = catalogo.blocos.find(
        (b) => b.codigo === "REQUISITO_DO_CARGO",
      );
      const codigos = requisito.motivos.map((m) => m.codigo);
      expect(codigos).toContain("CROMATOGRAFIA");
      expect(codigos).toContain("CNH_D");
      expect(codigos.filter((c) => c === "DIRECAO_DEFENSIVA")).toHaveLength(1);
    });

    it("motivos do filtro: os do critério escolhido (todos sem critério), com Outro motivo", () => {
      expect(
        motivosDoFiltro(catalogo, ["IDENTIDADE"]).map((m) => m.codigo),
      ).toEqual(["NAO_ACEITO", "ILEGIVEL", "SEM_IDENTIDADE_6_5", "OUTRO"]);
      const todos = motivosDoFiltro(catalogo, []).map((m) => m.codigo);
      expect(todos.filter((c) => c === "OUTRO")).toHaveLength(1);
      expect(todos.at(-1)).toBe("OUTRO");
    });

    it("texto do código: do bloco, da observação pronta, senão o próprio código", () => {
      expect(textoDoCodigo(catalogo, "CURSOS", "CURSOS_DIMINUIDA")).not.toBe(
        "CURSOS_DIMINUIDA",
      );
      expect(textoDoCodigo(catalogo, "IDENTIDADE", "OUTRO")).toBe(
        "Outro motivo",
      );
      expect(textoDoCodigo(catalogo, "IDENTIDADE", "SUMIU")).toBe("SUMIU");
    });

    it("sem regra: catálogo vazio, sem quebrar", () => {
      expect(catalogoDoRelatorio(null)).toEqual({
        blocos: [],
        observacoes: {},
      });
    });
  });

  describe("filtros e atalhos", () => {
    it("só os filtros escolhidos vão ao banco; o padrão é concluída", () => {
      expect(argumentosDoRelatorio("e1", FILTROS_INICIAIS)).toEqual({
        p_edital: "e1",
        p_filtros: { limite: 500, situacoes_ficha: ["CONCLUIDA"] },
      });
    });

    it("todos os filtros, com Não confere levando junto o Não enviado e Em análise o A revisar", () => {
      const { p_filtros } = argumentosDoRelatorio(
        "e1",
        {
          blocos: ["IDENTIDADE"],
          situacao: "NAO_CONFORME",
          motivo: "OUTRO",
          ajustada: true,
          resultado: "INAPTO_REQUISITO",
          situacaoDaFicha: "EM_ANALISE",
          vaga: "182502",
          avaliador: "u1",
          de: "2026-10-01",
          ate: "2026-10-20",
        },
        "f-9",
      );
      expect(p_filtros).toEqual({
        limite: 500,
        blocos: ["IDENTIDADE"],
        situacoes: ["NAO_CONFORME", "NAO_ENVIADO"],
        motivo: "OUTRO",
        ajustada: true,
        resultados: ["INAPTO_REQUISITO"],
        situacoes_ficha: ["EM_ANALISE", "REVISAR"],
        vagas: ["182502"],
        avaliador: "u1",
        de: "2026-10-01",
        ate: "2026-10-20",
        apos: "f-9",
      });
      expect(
        argumentosDoRelatorio("e1", {
          ...FILTROS_INICIAIS,
          situacaoDaFicha: "",
        }).p_filtros.situacoes_ficha,
      ).toBeUndefined();
    });

    it("Outro motivo por critério: Identidade por padrão, ou o critério já escolhido", () => {
      const f = filtrosDoAtalho("outro-por-criterio", catalogo);
      expect(f).toMatchObject({
        blocos: ["IDENTIDADE"],
        motivo: "OUTRO",
        situacaoDaFicha: "CONCLUIDA",
      });
      expect(
        filtrosDoAtalho("outro-por-criterio", catalogo, {
          ...FILTROS_INICIAIS,
          blocos: ["ESCOLARIDADE"],
          vaga: "182502",
        }),
      ).toMatchObject({ blocos: ["ESCOLARIDADE"], vaga: "182502" });
    });

    it("Eliminados por critério e Pontuação ajustada (cursos + experiência)", () => {
      expect(
        filtrosDoAtalho("eliminados-por-criterio", catalogo),
      ).toMatchObject({
        blocos: ["IDENTIDADE"],
        situacao: "NAO_CONFORME",
        resultado: "INAPTO_REQUISITO",
      });
      expect(filtrosDoAtalho("pontuacao-ajustada", catalogo)).toMatchObject({
        blocos: ["CURSOS", "EXPERIENCIA"],
        ajustada: true,
        motivo: "",
      });
    });
  });

  describe("linhas, agrupamento e exportação", () => {
    const fichas = [
      ficha("3989940", {
        IDENTIDADE: {
          situacao: "NAO_CONFORME",
          motivos: ["SEM_IDENTIDADE_6_5", "OUTRO"],
          motivo_livre: "Documento não apresentado de forma integral.",
        },
      }),
      ficha("4000001", {
        IDENTIDADE: {
          situacao: "NAO_CONFORME",
          motivos: ["OUTRO"],
          motivo_livre: "  documento NÃO apresentado de forma integral ",
        },
      }),
      ficha(
        "5179000",
        {
          CURSOS: {
            situacao: "CONFORME",
            nota_ajustada: 6,
            justificativas: ["CURSOS_DIMINUIDA", "OUTRO"],
            motivo_livre: "Nota ajustada conforme análise",
          },
          EXPERIENCIA: {
            situacao: "CONFORME",
            nota_ajustada: 10.5,
            justificativas: ["EXPERIENCIA_DIMINUIDA"],
          },
        },
        { resultado: "APTO", nota_final: 41.5 },
      ),
    ];
    const linhas = linhasDoRelatorio(fichas, catalogo);

    it("uma linha por ficha, com os textos dos motivos e o outro motivo separado", () => {
      expect(linhas[0]).toMatchObject({
        codigo: "3989940",
        resultado: "Inapto (requisito)",
        criterio: "Documento de identificação oficial com foto",
        situacaoDoBloco: "Não confere",
        outroMotivo: "Documento não apresentado de forma integral",
        concluidaPor: "Emanuel Serrano",
        concluidaEm: "16/10/2026 16:30",
      });
      expect(linhas[0].demaisMotivos).not.toContain("SEM_IDENTIDADE_6_5");
      expect(linhas[0].demaisMotivos.length).toBeGreaterThan(5);
    });

    it("dois blocos na linha: cada parte leva o nome do bloco; a nota ajustada só com justificativa", () => {
      const l = linhas[2];
      expect(l.criterio).toBe(
        "Cursos de Aperfeiçoamento, Experiência Profissional",
      );
      expect(l.outroMotivo).toBe(
        "Cursos de Aperfeiçoamento: Nota ajustada conforme análise",
      );
      expect(l.notaAjustada).toBe(
        "Cursos de Aperfeiçoamento: 6 | Experiência Profissional: 10,5",
      );
      expect(l.justificativas).toMatch(
        /^Cursos de Aperfeiçoamento: .+ \| Experiência Profissional: /,
      );
    });

    it("agrupa os textos iguais (acento, caixa, espaços, ponto final) e ordena por repetição", () => {
      expect(chaveDoTexto(" Ílegível. ")).toBe("ilegivel");
      const grupos = agruparPorOutroMotivo(linhas);
      expect(grupos[0]).toEqual({
        texto: "Documento não apresentado de forma integral",
        quantidade: 2,
        codigos: ["3989940", "4000001"],
      });
      expect(grupos).toHaveLength(2);
    });

    it("CSV: BOM, ponto e vírgula, CRLF, aspas quando precisa e fórmula neutralizada", () => {
      const csv = csvDoRelatorio([
        ...linhas,
        {
          ...linhas[0],
          id: "x",
          candidato: '=HYPERLINK("x")',
          outroMotivo: "a;b",
        },
      ]);
      expect(csv.startsWith("\uFEFFCódigo;Candidato;Vaga;Cargo;")).toBe(true);
      expect(csv.endsWith("\r\n")).toBe(true);
      const partes = csv.trimEnd().split("\r\n");
      expect(partes).toHaveLength(5);
      expect(partes[0]).toContain("Texto do outro motivo;Demais motivos");
      expect(partes[3]).toContain(";41,5;");
      expect(partes[4]).toContain(`"'=HYPERLINK(""x"")"`);
      expect(partes[4]).toContain('"a;b"');
      expect(csv).not.toMatch(/cpf|e-mail|telefone/i);
    });

    it("XLSX com as fichas e a planilha dos textos do outro motivo", () => {
      const arquivos = unzipSync(
        xlsxDoRelatorio(linhas, new Date(2026, 9, 20)),
      );
      const livro = strFromU8(arquivos["xl/workbook.xml"]);
      expect(livro).toContain('name="Fichas"');
      expect(livro).toContain('name="Outro motivo"');
      const fichasXml = strFromU8(arquivos["xl/worksheets/sheet1.xml"]);
      expect(fichasXml).toContain("3989940");
      expect(fichasXml).toContain("<v>41.5</v>");
    });

    it("nome do arquivo com o edital, o critério (um só) e a data", () => {
      const d = new Date(2026, 9, 20);
      expect(nomeDoRelatorio("114/2026", ["IDENTIDADE"], d)).toBe(
        "relatorio-de-motivos-114-2026-identidade-2026-10-20",
      );
      expect(nomeDoRelatorio(null, ["CURSOS", "EXPERIENCIA"], d)).toBe(
        "relatorio-de-motivos-edital-2026-10-20",
      );
    });
  });
});

bloco("lib/avaliacao-documental-repetir-leitura-da-fila", () => {
  describe("recuperação da leitura da fila", () => {
    const timeout = {
      code: "57014",
      message: "canceling statement due to statement timeout",
    };

    it("reconhece somente o timeout do banco", () => {
      expect(ehTimeoutDaFila(timeout)).toBe(true);
      const cancelado = { code: "57014", message: "user request" };
      const semPermissao = { code: "42501", message: timeout.message };
      expect(ehTimeoutDaFila(cancelado)).toBe(false);
      expect(ehTimeoutDaFila(semPermissao)).toBe(false);
      expect(ehTimeoutDaFila(null)).toBe(false);
    });

    it("faz uma segunda leitura após timeout", async () => {
      const leitura = vi.fn();
      leitura.mockRejectedValueOnce(timeout);
      leitura.mockResolvedValueOnce({ candidatos: [] });
      const pausa = vi.fn(async () => {});
      const resultado = lerFilaComRecuperacao(leitura, pausa);
      await expect(resultado).resolves.toEqual({ candidatos: [] });
      expect(leitura).toHaveBeenCalledTimes(2);
      expect(pausa).toHaveBeenCalledWith(1200);
    });

    it("interrompe após dois timeouts", async () => {
      const leitura = vi.fn(async () => Promise.reject(timeout));
      const resultado = lerFilaComRecuperacao(leitura, async () => {});
      await expect(resultado).rejects.toEqual(timeout);
      expect(leitura).toHaveBeenCalledTimes(2);
    });

    it("não repete erros de autorização", async () => {
      const proibido = { code: "42501", message: "permission denied" };
      const leitura = vi.fn(async () => Promise.reject(proibido));
      const resultado = lerFilaComRecuperacao(leitura, async () => {});
      await expect(resultado).rejects.toEqual(proibido);
      expect(leitura).toHaveBeenCalledTimes(1);
    });
  });
});

bloco("lib/avaliacao-documental-respostas-do-candidato", () => {
  /*
  O que o candidato informou, para a ficha vir pronta para conferir: os
  arquivos de cada pergunta de anexo (link direto e nome) e as linhas que o
  job Python tirou das respostas (sugestoes da ficha; a interpretação e os
  testes dela estão em tests/python/test_sugestoes_da_ficha.py). A tela só lê.
*/
  const LINK = (arquivo, n = 1) =>
    `https://corporate.empregare.com/Company/VacancyTests/GetViewerLogArquivo?arquivo=${arquivo}&nome=Case&token=TK${n}&questionarioRespostaID=9`;
  const COLUNA = "Pergunta 16 - Anexe os certificados dos cursos";
  const anexo = (arquivo, link) => ({
    resposta: "9",
    pergunta: "16",
    arquivo,
    ordem: 16,
    enunciado: "",
    coluna: COLUNA,
    link,
  });

  // O anexo na Empregare, a chave da leitura automática dos arquivos.
  const ID = (arquivo) => ({ resposta: "9", pergunta: "16", arquivo });

  describe("arquivos da pergunta de anexo", () => {
    it("um link por arquivo, na ordem, com o nome que a Empregare guardou", () => {
      const enderecos = {
        candidato: null,
        vaga: null,
        vagaDireta: false,
        anexos: [
          anexo(2, LINK("0a1b2c3d4e5f_certificado%20NR-35.pdf", 2)),
          anexo(1, LINK("NR-10.pdf")),
          anexo(3, LINK("%20", 3)),
        ],
      };
      expect(arquivosDaPergunta(enderecos, COLUNA)).toEqual([
        { numero: 1, nome: "NR-10.pdf", link: LINK("NR-10.pdf"), ...ID(1) },
        {
          numero: 2,
          nome: "certificado NR-35.pdf",
          link: LINK("0a1b2c3d4e5f_certificado%20NR-35.pdf", 2),
          ...ID(2),
        },
        // Sem nome legível: o número.
        { numero: 3, nome: "Arquivo 3", link: LINK("%20", 3), ...ID(3) },
      ]);
      expect(arquivosDaPergunta({ ...enderecos, anexos: [] }, COLUNA)).toEqual(
        [],
      );
    });
  });

  describe("linhas sugeridas pelo job Python", () => {
    const CURSOS = { codigo: "CURSOS", tipo: "CURSOS" };
    const EXPERIENCIA = {
      codigo: "EXPERIENCIA",
      tipo: "VINCULOS",
      categorias: [{ codigo: "AREA_OU_SUS" }],
    };

    it("lê as sugestões do bloco; o vínculo sem categoria ganha a do bloco", () => {
      const sugestoes = {
        CURSOS: [
          { nome: "NR-10", horas: 120, aceito: true, da_resposta: true },
        ],
        EXPERIENCIA: [
          { empregador: "H", inicio: "2020-01-01", fim: "2021-12-31" },
        ],
      };
      expect(itensSugeridos(sugestoes, CURSOS)).toEqual(sugestoes.CURSOS);
      expect(itensSugeridos(sugestoes, EXPERIENCIA)).toEqual([
        {
          empregador: "H",
          inicio: "2020-01-01",
          fim: "2021-12-31",
          categoria: "AREA_OU_SUS",
          aceito: true,
          da_resposta: true,
        },
      ]);
      expect(itensSugeridos(null, CURSOS)).toEqual([]);
      expect(itensSugeridos({ CURSOS: "x" }, CURSOS)).toEqual([]);
    });

    it("a primeira linha: a sugestão; sem ela, vazia", () => {
      expect(linhasDasRespostas(CURSOS, "superior", ['"5 pontos"'])).toEqual([
        { nome: "", horas: "", aceito: true },
      ]);
      expect(
        linhasDasRespostas(CURSOS, "superior", [], {
          CURSOS: [{ nome: "Gestão em saúde", horas: 60 }],
        }),
      ).toEqual([
        { nome: "Gestão em saúde", horas: 60, aceito: true, da_resposta: true },
      ]);
    });
  });
});

bloco("lib/avaliacao-documental-textos-da-regra", () => {
  /*
  O salvar da regra (assistente e modo avançado) tira os espaços das pontas
  dos textos que vão para o parecer: o motivo da regra do 114/2026 terminava
  com espaço (item 8.2.10.7).
*/
  const CASOS = JSON.parse(
    readFileSync(
      "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
      "utf8",
    ),
  );

  describe("textos da regra sem espaço nas pontas ao salvar", () => {
    const regra = {
      schema: 1,
      titulo_etapa: " Avaliação ",
      provisoria: {
        eliminacao_automatica: [{ coluna_prefixo: "SITUAÇÃO - " }],
      },
      blocos: [
        {
          codigo: "IDENTIDADE",
          titulo: "Identidade ",
          motivos: [
            {
              codigo: "NOME",
              texto: " Sem a certidão  que justifique a alteração de nome. ",
              item_edital: "8.2.10.7 ",
            },
          ],
        },
        { codigo: "CURSOS", titulo: "Cursos" },
      ],
      observacoes_prontas: [
        {
          codigo: "OBS",
          rotulo: " Rótulo ",
          texto: "\tAceito. ",
          item_edital: "",
        },
      ],
      por_cargo: [
        {
          codigo: "C15",
          rotulo: "Cargo 15",
          blocos: {
            REQUISITO_DO_CARGO: {
              requisitos: [
                {
                  codigo: "CNH",
                  rotulo: "CNH",
                  motivo: "Sem CNH D. ",
                  item_edital: " 2",
                },
              ],
            },
            CURSOS: { teto: 15 },
          },
        },
      ],
    };

    it("tira só as pontas dos motivos, observações prontas e requisitos por cargo", () => {
      const limpa = regraComTextosSemEspacosNasPontas(regra);
      expect(limpa.blocos[0].motivos[0]).toEqual({
        codigo: "NOME",
        texto: "Sem a certidão  que justifique a alteração de nome.",
        item_edital: "8.2.10.7",
      });
      expect(limpa.observacoes_prontas[0]).toEqual({
        codigo: "OBS",
        rotulo: " Rótulo ",
        texto: "Aceito.",
        item_edital: "",
      });
      expect(
        limpa.por_cargo[0].blocos.REQUISITO_DO_CARGO.requisitos[0],
      ).toMatchObject({ motivo: "Sem CNH D.", item_edital: "2" });
      expect(limpa.por_cargo[0].blocos.CURSOS).toEqual({ teto: 15 });
      // O resto da regra fica como está (o prefixo da coluna termina em espaço de propósito).
      expect(limpa.provisoria).toBe(regra.provisoria);
      expect(limpa.titulo_etapa).toBe(" Avaliação ");
      expect(limpa.blocos[0].titulo).toBe("Identidade ");
      expect(limpa.blocos[1]).toBe(regra.blocos[1]);
    });

    it("não muda a regra de entrada", () => {
      const antes = JSON.stringify(regra);
      regraComTextosSemEspacosNasPontas(regra);
      expect(JSON.stringify(regra)).toBe(antes);
    });

    it("regras dos casos dourados: só os motivos do 8.2.10.7 do 114 mudam", () => {
      for (const [codigo, r] of Object.entries(CASOS.regras)) {
        const esperada =
          codigo === "E114-POR-CARGO"
            ? JSON.parse(
                JSON.stringify(r).replaceAll(
                  'do(a) candidato(a). "',
                  'do(a) candidato(a)."',
                ),
              )
            : r;
        expect(regraComTextosSemEspacosNasPontas(r)).toEqual(esperada);
      }
      expect(JSON.stringify(CASOS.regras["E114-POR-CARGO"])).toContain(
        'do(a) candidato(a). "',
      );
    });
  });
});

bloco("lib/avaliacao-documental-varias-cotas", () => {
  /*
  Várias cotas por candidato (114/2026, itens 5.8.1 e 5.8.5): o bloco de cota
  vale para cada cota optada (lançamento.modalidades) e a modalidade final é a
  confirmada de maior percentual; sem nenhuma confirmada, a ampla. O mesmo que
  tests/python/test_pontuacao.py (VariasCotas) e FC_COTAS_CONFIRMADAS no banco.
*/

  const CASOS = JSON.parse(
    readFileSync(
      "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
      "utf8",
    ),
  );
  const REGRA = CASOS.regras["E114-POR-CARGO"];
  const DOCUMENTAL = {
    nota_minima: 0,
    cotas: {
      acumulo: "MAIOR_PERCENTUAL",
      percentuais: { PCD: 5, PP: 25, PI: 3, PQ: 2 },
    },
  };
  const bloco = (codigo) => REGRA.blocos.find((b) => b.codigo === codigo);

  function lancamento(blocos, modalidades = ["PP", "PCD"]) {
    return {
      nivel: "medio",
      vaga: "182528",
      modalidade: modalidades[0] ?? "AC",
      modalidades,
      blocos,
      titulos: [],
      cursos: [],
      vinculos: [],
    };
  }

  describe("várias cotas", () => {
    it("as cotas do lançamento: a lista ou, na ficha antiga, a modalidade única", () => {
      expect(
        modalidadesDoLancamento({ modalidades: ["pp", "PCD", "AC", "PP"] }),
      ).toEqual(["PP", "PCD"]);
      expect(modalidadesDoLancamento({ modalidade: "PI" })).toEqual(["PI"]);
      expect(modalidadesDoLancamento({ modalidade: "AC" })).toEqual([]);
      expect(modalidadesDoLancamento({})).toEqual([]);
    });

    it("PP e PCD optados abrem os dois blocos de cota (e só eles)", () => {
      const lanc = lancamento({});
      expect(blocoSeAplica(bloco("COTA_PP"), lanc)).toBe(true);
      expect(blocoSeAplica(bloco("COTA_PCD"), lanc)).toBe(true);
      expect(blocoSeAplica(bloco("COTA_PI"), lanc)).toBe(false);
      expect(blocoSeAplica(bloco("COTA_PCD"), lancamento({}, ["PP"]))).toBe(
        false,
      );
      expect(blocoSeAplica(bloco("COTA_PP"), lancamento({}, []))).toBe(false);
    });

    it("os dois conformes: final PP (25%), PcD também confirmada", () => {
      const r = calcularFicha(
        REGRA,
        lancamento({
          COTA_PP: { situacao: "CONFORME" },
          COTA_PCD: { situacao: "CONFORME" },
        }),
        DOCUMENTAL,
      );
      expect(r.modalidade_final).toBe("PP");
      expect(r.modalidades_confirmadas).toEqual(["PP", "PCD"]);
      const situacoes = Object.fromEntries(
        r.blocos
          .filter((b) => b.codigo.startsWith("COTA_"))
          .map((b) => [b.codigo, b.situacao]),
      );
      expect(situacoes).toEqual({
        COTA_PP: "CONFORME",
        COTA_PI: "NAO_SE_APLICA",
        COTA_PQ: "NAO_SE_APLICA",
        COTA_PCD: "CONFORME",
      });
    });

    it("PP não conforme e PCD conforme: final PCD", () => {
      const r = calcularFicha(
        REGRA,
        lancamento({
          COTA_PP: { situacao: "NAO_CONFORME" },
          COTA_PCD: { situacao: "CONFORME" },
        }),
        DOCUMENTAL,
      );
      expect(r.modalidade_final).toBe("PCD");
      expect(r.modalidades_confirmadas).toEqual(["PCD"]);
      expect(resumoParaGravar(r, null).modalidade_final).toBe("PCD");
    });

    it("os dois não conformes: fica na ampla", () => {
      const r = calcularFicha(
        REGRA,
        lancamento({
          COTA_PP: { situacao: "NAO_CONFORME" },
          COTA_PCD: { situacao: "NAO_ENVIADO" },
        }),
        DOCUMENTAL,
      );
      expect(r.modalidade_final).toBe("AC");
      expect(r.modalidades_confirmadas).toEqual([]);
    });

    it("PCD_MAIS_UMA põe a PcD primeiro; sem percentual, a ordem optada", () => {
      const avaliados = [];
      expect(
        cotasConfirmadas(
          avaliados,
          { modalidades: ["PP", "PCD"] },
          { acumulo: "PCD_MAIS_UMA" },
        ),
      ).toEqual(["PCD", "PP"]);
      expect(
        cotasConfirmadas(avaliados, { modalidades: ["PI", "PQ"] }, null),
      ).toEqual(["PI", "PQ"]);
    });

    it("a ficha nova leva a lista da triagem", () => {
      const lanc = lancamentoInicial({
        regra: REGRA,
        respostas: {},
        modalidade: "PP",
        modalidades: ["PP", "PCD"],
        cargo: "Técnico",
        vaga: "182528",
        documental: DOCUMENTAL,
        gravado: null,
      });
      expect(lanc.modalidades).toEqual(["PP", "PCD"]);
      // Sem a lista (cabeçalho antigo): a modalidade única.
      expect(
        lancamentoInicial({
          regra: REGRA,
          respostas: {},
          modalidade: "PI",
          documental: DOCUMENTAL,
        }).modalidades,
      ).toEqual(["PI"]);
    });
  });
});

bloco("lib/regras-do-edital", () => {
  /*
  Regras do edital (Editais › Regras do edital): a ordem das etapas e os
  resumos só-leitura que as telas da Avaliação documental e da Classificação
  mostram no topo.
*/

  const { regras } = JSON.parse(
    readFileSync(
      "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
      "utf8",
    ),
  );

  describe("etapas das Regras do edital", () => {
    it("na ordem do processo, da Triagem à Chamada para contratação", () => {
      expect(ETAPAS_DAS_REGRAS.map((e) => e.valor)).toEqual([
        "triagem",
        "avaliacao",
        "entrevista",
        "classificacao",
        "chamada",
      ]);
    });

    it("etapa desconhecida abre na Triagem", () => {
      expect(etapaDasRegras("classificacao")).toBe("classificacao");
      expect(etapaDasRegras("lote")).toBe("triagem");
      expect(etapaDasRegras(undefined)).toBe("triagem");
    });
  });

  describe("resumo da regra da Classificação", () => {
    const REGRA = {
      composicao: {
        componentes: [
          { codigo: "DOCUMENTAL", peso: 2 },
          { codigo: "ENTREVISTA", peso: 1 },
        ],
        casas: 2,
      },
      documental: { nota_minima: 15 },
      desempate: [{ criterio: "IDOSO_60" }, { criterio: "EXP_SAUDE_INDIGENA" }],
      empate_final: { metodo: "SORTEIO" },
      modalidades: [{ codigo: "AC" }, { codigo: "PP", percentual: 25 }],
    };

    it("composição, mínimos, desempate (com o que vem da Avaliação) e cotas", () => {
      const linhas = Object.fromEntries(
        resumoDaRegraDaClassificacao(REGRA).map((l) => [l.rotulo, l.valor]),
      );
      expect(linhas["Composição da nota"]).toBe(
        "Nota documental (curricular) (peso 2) + Nota da entrevista (peso 1); 2 casas decimais",
      );
      expect(linhas["Notas mínimas"]).toBe("documental 15");
      expect(linhas.Desempate).toBe(
        "1º 60+; 2º exp. saúde indígena (comprovado na Avaliação documental)",
      );
      expect(linhas["Empate depois dos critérios"]).toBe("Sorteio registrado");
      expect(linhas.Cotas).toMatch(/^PP 25%; /);
    });

    it("sem regra, nada", () => {
      expect(resumoDaRegraDaClassificacao(null)).toEqual([]);
    });

    it("critérios que usam o comprovado na Avaliação documental", () => {
      expect(desempateDaAvaliacao("INDIGENA_COMPROVADO")).toBe(true);
      expect(desempateDaAvaliacao("IDOSO_60")).toBe(false);
    });
  });

  describe("resumo da regra da Avaliação documental", () => {
    it("documentos, o que pontua, como a experiência conta e a nota mínima", () => {
      const regra = normalizarRegraAnalise(regras["PROJ26-CURRICULAR"]);
      const linhas = resumoDaRegraDaAvaliacao(regra, 15);
      const rotulos = linhas.map((l) => l.rotulo);
      expect(rotulos[0]).toBe("Documentos exigidos");
      expect(rotulos).toContain("O que pontua");
      expect(rotulos.at(-1)).toBe("Nota mínima");
      const experiencia = linhas.find((l) =>
        /Comprovada nas categorias/.test(l.valor),
      );
      expect(experiencia).toBeDefined();
      expect(experiencia.valor).toMatch(/pontos/);
      expect(linhas.at(-1).valor).toBe("15 pontos (regra da Classificação)");
      // Requisitos da inscrição e lote são da Triagem: não aparecem aqui.
      expect(linhas.map((l) => l.valor).join(" ")).not.toMatch(
        /Na inscrição|Lote:/,
      );
    });

    it("sem regra, nada", () => {
      expect(resumoDaRegraDaAvaliacao(null)).toEqual([]);
    });
  });
});

bloco("lista-enxuta-do-painel-de-analises", () => {
  /*
  A lista enxuta do painel de análises (20260929150000): o que sai da linha
  volta pelo envelope, pelo detalhamento ou pela junção dos escopos de "Todos".
*/

  const linha = (
    id,
    unidade,
    edital = "1/2026",
    vaga = "10",
    candidato = "Ana",
  ) => ({
    id,
    unidade,
    edital,
    codigo_vaga: vaga,
    candidato,
  });

  const parte = (geradoEm, linhas, extra = {}) => ({
    payload: {
      schema_version: 4,
      generated_at: geradoEm,
      rows: [],
      editais: [{ edital: "1/2026" }],
      cache: { hit: true, refreshed_at: geradoEm },
      ...extra,
    },
    linhas,
  });

  describe("Todos = ativo + inativo (sem as desativadas)", () => {
    it("pede os dois escopos só para Todos", () => {
      expect(partesDoEscopo("todos")).toEqual(["ativo", "inativo"]);
      expect(partesDoEscopo("todos")).not.toContain("desativadas");
      expect(partesDoEscopo("inativo")).toEqual(["inativo"]);
    });

    it("junta na ordem do banco: unidade, edital, vaga e candidato, com a colação en-US e o id no desempate", () => {
      const ativo = [
        linha("b", "DSEI Alto Rio Negro"),
        linha("d", "dsei manaus"),
      ];
      const inativo = [
        linha("a", "CASAI Brasília"),
        linha("c", "DSEI Alto Rio Negro", "1/2026", "10", "Ana"),
        linha("e", "Polo Base"),
      ];
      const desativadas = [linha("f", null)];
      const juntas = juntarPartesDoPainel([
        parte("10:00", ativo),
        parte("10:00", inativo),
        parte("10:00", desativadas),
      ]);
      expect(juntas.map((l) => l.id)).toEqual(["a", "b", "c", "d", "e", "f"]);
    });

    it("colação do banco: maiúsculas e acentos não passam na frente", () => {
      expect(
        compararNaOrdemDoBanco(
          linha("1", "DSEI Ária"),
          linha("2", "dsei Arib"),
        ),
      ).toBeLessThan(0);
      expect(
        compararNaOrdemDoBanco(linha("1", "dsei x"), linha("2", "DSEI X")),
      ).toBeLessThan(0);
    });

    it("análise que mudou de escopo entre a cópia e a nova aparece uma vez, a da parte mais nova", () => {
      const antiga = parte("2026-09-29T10:00:00Z", [
        { ...linha("x", "A"), status_consolidado: "Pendente" },
      ]);
      const nova = parte("2026-09-29T10:30:00Z", [
        { ...linha("x", "A"), status_consolidado: "Aprovado" },
        linha("y", "B"),
      ]);
      const juntas = juntarPartesDoPainel([antiga, nova]);
      expect(juntas.map((l) => [l.id, l.status_consolidado])).toEqual([
        ["x", "Aprovado"],
        ["y", undefined],
      ]);
    });

    it("o envelope de Todos: editais de uma parte, hora da mais velha e o dado mais novo", () => {
      const envelope = envelopeDeTodos(
        [
          parte("2026-09-29T10:00:00Z", [], {
            atualizado_em: "2026-09-28T09:00:00Z",
          }),
          parte("2026-09-29T10:30:00Z", [], {
            atualizado_em: "2026-09-29T08:00:00Z",
            cache: { hit: false, refreshed_at: "2026-09-29T10:30:00Z" },
          }),
        ],
        7,
      );
      expect(envelope).toMatchObject({
        scope: "todos",
        total: 7,
        edital_status: null,
        editais: [{ edital: "1/2026" }],
        generated_at: "2026-09-29T10:00:00Z",
        atualizado_em: "2026-09-29T08:00:00Z",
        cache: { hit: false, refreshed_at: "2026-09-29T10:00:00Z" },
      });
      expect(envelope).not.toHaveProperty("rows");
      expect(envelopeDeTodos([], 0)).toBeNull();
    });
  });

  describe("o que a linha não traz mais", () => {
    it("grupo e situação do edital vêm do envelope; a linha do payload antigo fica como está", () => {
      const envelope = { grupo: "Projetos", edital_status: "Inativo" };
      expect(completarLinhaPeloEnvelope({ id: "1" }, envelope)).toEqual({
        id: "1",
        grupo: "Projetos",
        edital_status: "Inativo",
      });
      expect(
        completarLinhaPeloEnvelope(
          { id: "1", grupo: "Saúde Indígena", edital_status: "Ativo" },
          envelope,
        ),
      ).toEqual({ id: "1", grupo: "Saúde Indígena", edital_status: "Ativo" });
    });

    it("o detalhamento completa a linha sem trocar o que ela tem nem a chave da tabela", () => {
      const linhaDaLista = {
        id: "a",
        grupo: "Projetos",
        data_validacao_status: "DATA_FUTURA",
      };
      expect(linhaSemDetalhe(linhaDaLista)).toBe(true);
      const mudou = mesclarDetalhe(linhaDaLista, {
        id: "a",
        area: "projetos",
        chave_natural: "k",
        grupo: "PROJETOS",
        data_validacao_status: "DENTRO_PERIODO",
        pontuacao_escolaridade: 10,
        analise: "Apto",
      });
      expect(mudou).toBe(true);
      expect(linhaDaLista).toEqual({
        id: "a",
        grupo: "Projetos",
        data_validacao_status: "DATA_FUTURA",
        pontuacao_escolaridade: 10,
        analise: "Apto",
      });
      expect(linhaSemDetalhe(linhaDaLista)).toBe(false);
      expect(mesclarDetalhe(linhaDaLista, null)).toBe(false);
      // A linha do payload antigo já vem com as pontuações.
      expect(linhaSemDetalhe({ id: "b", pontuacao_escolaridade: null })).toBe(
        false,
      );
    });
  });
});

bloco("modalidades-de-concorrencia", () => {
  describe("modalidadesDaConcorrencia", () => {
    it("mantém uma modalidade canônica", () => {
      expect(modalidadesDaConcorrencia("Ampla concorrência")).toEqual([
        "Ampla concorrência",
      ]);
    });

    it("separa combinações antigas com aspas", () => {
      expect(
        modalidadesDaConcorrencia('Ampla concorrência", "Indígenas'),
      ).toEqual(["Ampla concorrência", "Indígenas"]);
    });

    it("separa combinações canônicas do banco", () => {
      expect(
        modalidadesDaConcorrencia(
          "Pretos e pardos | Pessoas com deficiência (PCD)",
        ),
      ).toEqual(["Pretos e pardos", "Pessoas com deficiência (PCD)"]);
    });

    it("padroniza quilombola no singular", () => {
      expect(modalidadesDaConcorrencia("Quilombola")).toEqual(["Quilombolas"]);
    });

    it("preserva valor novo que ainda não possui regra", () => {
      expect(modalidadesDaConcorrencia('"Outra modalidade"')).toEqual([
        "Outra modalidade",
      ]);
    });

    it("retorna lista vazia para valor ausente", () => {
      expect(modalidadesDaConcorrencia(null)).toEqual([]);
    });
  });
});

bloco("modelos-de-resposta", () => {
  /*
  Os modelos de resposta a recurso: o preenchimento dos marcadores (texto
  puro, uma passada, sem valor vira "[não informado: …]"), a escolha dos
  modelos do recurso e a lista de marcadores, que tem de ser a do banco.
*/

  const RECURSO = {
    id: "r1",
    nu: 7,
    candidato: "Ana Ribeiro",
    codigo: "111",
    edital: "105/2026",
    unidade: "DSEI Litoral Sul",
    cargo: "Enfermeiro 40h",
    vaga: "V-10",
    origem: "analise-curricular",
    nota_anterior: 50,
    nota_atual: 55.5,
    resultado_anterior: "Reprovado",
    resultado_atual: "Aprovado",
    analista: "Carla",
    situacao: "DEFERIDO",
  };

  describe("marcadores", () => {
    it("acha os marcadores do texto, sem repetir, e os desconhecidos", () => {
      const corpo = "{nome_candidato} {foo} {nome_candidato} {Maiusculo} {x_y}";
      expect(marcadoresDoTexto(corpo)).toEqual([
        "nome_candidato",
        "foo",
        "x_y",
      ]);
      expect(marcadoresDesconhecidos(corpo)).toEqual(["foo", "x_y"]);
    });
  });

  describe("preenchimento", () => {
    const hoje = new Date(2026, 8, 29, 10);

    it("troca cada marcador pelo valor do recurso", () => {
      const valores = valoresDoRecurso(RECURSO, {
        fundamentacao: "O diploma foi aceito.",
        hoje,
      });
      const { texto, faltando, desconhecidos } = renderizarModelo(
        "{nome_candidato} ({codigo_candidato}) — {edital}/{unidade} — {origem}: {nota_anterior} → {nota_atual}; {resultado_atual}. {fundamentacao} {data_hoje}, {analista}.",
        valores,
      );
      expect(texto).toBe(
        "Ana Ribeiro (111) — 105/2026/DSEI Litoral Sul — Análise curricular: 50 → 55,5; Aprovado. O diploma foi aceito. 29 de setembro de 2026, Carla.",
      );
      expect(faltando).toEqual([]);
      expect(desconhecidos).toEqual([]);
    });

    it("sem valor: marca visível e a lista do que falta", () => {
      const valores = valoresDoRecurso(
        { ...RECURSO, nota_atual: null, analista: "" },
        { hoje },
      );
      const { texto, faltando } = renderizarModelo(
        "Nota {nota_atual}. {fundamentacao} {analista}",
        valores,
      );
      expect(texto).toBe(
        "Nota [não informado: Nota atual]. [não informado: Fundamentação] [não informado: Analista]",
      );
      expect(faltando).toEqual(["nota_atual", "fundamentacao", "analista"]);
    });

    it("o analista cai no nome dado quando o recurso não tem", () => {
      expect(
        valoresDoRecurso({ ...RECURSO, analista: " " }, { analista: "Diego" })
          .analista,
      ).toBe("Diego");
    });

    it("marcador desconhecido fica como está e é avisado", () => {
      const { texto, desconhecidos } = renderizarModelo("Olá {apelido}", {});
      expect(texto).toBe("Olá {apelido}");
      expect(desconhecidos).toEqual(["apelido"]);
    });

    it("uma passada: valor com marcador ou HTML não vira marcador nem HTML", () => {
      const { texto } = renderizarModelo("{fundamentacao} / {nome_candidato}", {
        fundamentacao: "Veja {nota_atual} <script>alert(1)</script>",
        nome_candidato: "Ana & <b>Bia</b>",
        nota_atual: "99",
      });
      expect(texto).toBe(
        "Veja {nota_atual} <script>alert(1)</script> / Ana & <b>Bia</b>",
      );
    });

    it("normaliza quebras de linha e aceita corpo vazio", () => {
      expect(renderizarModelo("a\r\nb\rc", {}).texto).toBe("a\nb\nc");
      expect(renderizarModelo(null, {}).texto).toBe("");
    });

    it("data por extenso, em português", () => {
      expect(dataPorExtenso(new Date("2026-01-05T15:00:00Z"))).toBe(
        "5 de janeiro de 2026",
      );
      // 01:00 UTC ainda é dia 4 em Brasília (antes, o fuso de quem usava decidia).
      expect(dataPorExtenso(new Date("2026-01-05T01:00:00Z"))).toBe(
        "4 de janeiro de 2026",
      );
      expect(dataPorExtenso("2026-09-29")).toBe("29 de setembro de 2026");
      expect(dataPorExtenso("x")).toBe("");
    });
  });

  describe("modelos do recurso", () => {
    const MODELOS = [
      {
        id: "a",
        nome: "Deferido — geral",
        situacao: "DEFERIDO",
        origem: null,
        area: null,
      },
      {
        id: "b",
        nome: "Deferido — análise",
        situacao: "DEFERIDO",
        origem: "analise-curricular",
        area: null,
      },
      {
        id: "c",
        nome: "Indeferido — análise",
        situacao: "INDEFERIDO",
        origem: "analise-curricular",
        area: null,
      },
      {
        id: "d",
        nome: "Deferido — entrevista",
        situacao: "DEFERIDO",
        origem: "entrevista",
        area: null,
      },
      {
        id: "e",
        nome: "Deferido — só SEDE",
        situacao: "DEFERIDO",
        origem: null,
        area: "sede",
      },
    ];

    it("recurso decidido: da área, da origem e da situação; a origem exata primeiro", () => {
      expect(
        modelosAplicaveis(MODELOS, RECURSO, "saude-indigena").map((m) => m.id),
      ).toEqual(["b", "a"]);
      expect(
        modelosAplicaveis(MODELOS, RECURSO, "sede").map((m) => m.id),
      ).toEqual(["b", "a", "e"]);
    });

    it("recurso em análise: todas as situações da origem", () => {
      expect(
        modelosAplicaveis(
          MODELOS,
          { ...RECURSO, situacao: "EM_ANALISE" },
          "saude-indigena",
        ).map((m) => m.id),
      ).toEqual(["b", "c", "a"]);
    });
  });

  describe("formulário de modelo", () => {
    it("valida nome, situação, tamanho e marcadores", () => {
      expect(
        errosDoModelo({ nome: "ab", situacao: "EM_ANALISE", corpo: "curto" }),
      ).toEqual({
        nome: expect.any(String),
        situacao: expect.any(String),
        corpo: expect.any(String),
      });
      expect(
        errosDoModelo({
          nome: "Modelo",
          situacao: "DEFERIDO",
          corpo: "Prezado {nome_candidato}, veja {nota_final}.",
        }).corpo,
      ).toBe("Marcador desconhecido: {nota_final}.");
      expect(
        errosDoModelo({
          nome: "Modelo",
          situacao: "DEFERIDO",
          corpo: "Prezado {nome_candidato}, {fundamentacao}",
        }),
      ).toEqual({});
    });

    it("o p_dados: novo sem id; edição com id e versão; vazios viram null", () => {
      expect(
        dadosDoModelo({
          id: null,
          nome: " A ",
          situacao: "DEFERIDO",
          origem: "",
          area: "",
          corpo: " x ",
        }),
      ).toEqual({
        nome: "A",
        situacao: "DEFERIDO",
        origem: null,
        area: null,
        corpo: "x",
      });
      expect(
        dadosDoModelo({
          id: "m",
          versao: 3,
          nome: "A",
          situacao: "INDEFERIDO",
          origem: "entrevista",
          area: "sede",
          corpo: "x",
        }),
      ).toMatchObject({
        id: "m",
        versao: 3,
        origem: "entrevista",
        area: "sede",
      });
    });
  });
});

bloco("modelos-dos-editais-recentes", () => {
  /*
  Modelos da regra lidos dos editais recentes (91, 93, 100, 109, 111 e
  114/2026): docs/analises-no-monitora/regras-dos-editais-recentes.md.
  Os JSON de tests/fixtures/avaliacao-documental/modelos/ são a fonte dos
  testes (aqui e no pytest) e têm de ser iguais aos das correções.
*/
  const ler = (caminho) => readFileSync(caminho, "utf8");
  const MODELOS_SI = ["SI26-100", "SI26-ALSE", "SI26-MRSA", "SI26-PARINTINS"];
  const DEPOIS_DA_F3 = ["PROJ26-RIO-DOCE"];
  const modelo = (codigo) =>
    JSON.parse(
      ler(`tests/fixtures/avaliacao-documental/modelos/${codigo}.json`),
    );
  const CASOS = JSON.parse(
    ler("tests/fixtures/avaliacao-documental/casos-dos-modelos-recentes.json"),
  );

  const modelosDaCorrecao = (arquivo) =>
    Object.fromEntries(
      [
        ...ler(`tests/fixtures/sql-de-dados/${arquivo}`).matchAll(
          /\('([A-Z0-9-]+)', '(?:[^']|'')*', \$modelo\$(.*?)\$modelo\$::jsonb\)/g,
        ),
      ].map((m) => [m[1], JSON.parse(m[2])]),
    );
  // 20261007-perguntas-pelo-texto.sql: o que muda na provisória de cada modelo.
  const PERGUNTAS_PELO_TEXTO = Object.fromEntries(
    [
      ...ler(
        "tests/fixtures/sql-de-dados/20261007-perguntas-pelo-texto.sql",
      ).matchAll(
        /\('([A-Z0-9-]+)', \$provisoria\$(.*?)\$provisoria\$::jsonb\)/g,
      ),
    ].map((m) => [m[1], JSON.parse(m[2])]),
  );
  const comAsPerguntasPeloTexto = (codigo, m) =>
    PERGUNTAS_PELO_TEXTO[codigo]
      ? {
          ...m,
          provisoria: { ...m.provisoria, ...PERGUNTAS_PELO_TEXTO[codigo] },
        }
      : m;
  // 20261007-declarada-experiencia-por-nivel.sql: o item de experiência da nota declarada.
  const EXPERIENCIA_DECLARADA = Object.fromEntries(
    [
      ...ler(
        "tests/fixtures/sql-de-dados/20261007-declarada-experiencia-por-nivel.sql",
      ).matchAll(/\('([A-Z0-9-]+)', \$item\$(.*?)\$item\$::jsonb\)/g),
    ].map((m) => [m[1], JSON.parse(m[2])]),
  );
  const comAExperienciaDeclarada = (codigo, m) =>
    EXPERIENCIA_DECLARADA[codigo]
      ? {
          ...m,
          provisoria: {
            ...m.provisoria,
            nota_declarada: [
              ...m.provisoria.nota_declarada.filter(
                (i) => i.parcial !== "EXPERIENCIA",
              ),
              EXPERIENCIA_DECLARADA[codigo],
            ],
          },
        }
      : m;
  // 20261007-perguntas-da-ficha-proj26.sql: a nota declarada de titulação e cursos do 93/2026.
  const DECLARADA_DA_FICHA = JSON.parse(
    /\$n\$(.*?)\$n\$/s.exec(
      ler("tests/fixtures/sql-de-dados/20261007-perguntas-da-ficha-proj26.sql"),
    )[1],
  );
  const SI = modelosDaCorrecao("20261006-modelos-dos-editais-recentes.sql");
  const RIO_DOCE = modelosDaCorrecao("20261006-modelo-proj26-rio-doce.sql");
  const PERGUNTA_PELO_NUMERO = /^pergunta \d+ ?-/i;
  const textosDe = (valor) =>
    Array.isArray(valor)
      ? valor.flatMap(textosDe)
      : valor && typeof valor === "object"
        ? Object.values(valor).flatMap(textosDe)
        : typeof valor === "string"
          ? [valor]
          : [];

  describe("correções dos modelos dos editais recentes", () => {
    it("a da Saúde Indígena traz os quatro modelos, iguais aos JSON (com as perguntas pelo texto)", () => {
      expect(Object.keys(SI).sort()).toEqual(MODELOS_SI);
      for (const codigo of MODELOS_SI) {
        expect(comAsPerguntasPeloTexto(codigo, SI[codigo])).toEqual(
          modelo(codigo),
        );
        expect(SI[codigo].modelo).toBe(codigo);
      }
    });

    it("a do Rio Doce traz o PROJ26-RIO-DOCE e avisa que é depois da F3", () => {
      expect(Object.keys(RIO_DOCE)).toEqual(DEPOIS_DA_F3);
      expect(
        comAExperienciaDeclarada(
          "PROJ26-RIO-DOCE",
          comAsPerguntasPeloTexto(
            "PROJ26-RIO-DOCE",
            RIO_DOCE["PROJ26-RIO-DOCE"],
          ),
        ),
      ).toEqual(modelo("PROJ26-RIO-DOCE"));
      expect(
        ler("tests/fixtures/sql-de-dados/20261006-modelo-proj26-rio-doce.sql"),
      ).toMatch(/^\/\*\s+APLICAR DEPOIS DA F3\./);
    });

    it("a das perguntas pelo texto muda o PROJ26-CURRICULAR, o PROJ26-RIO-DOCE e o SI26-100, idempotente e validada", () => {
      expect(Object.keys(PERGUNTAS_PELO_TEXTO).sort()).toEqual([
        "PROJ26-CURRICULAR",
        "PROJ26-RIO-DOCE",
        "SI26-100",
      ]);
      for (const [codigo, provisoria] of Object.entries(PERGUNTAS_PELO_TEXTO))
        expect(modelo(codigo).provisoria).toMatchObject(provisoria);
      const sql = ler(
        "tests/fixtures/sql-de-dados/20261007-perguntas-pelo-texto.sql",
      );
      expect(sql).toContain("is distinct from");
      expect(sql).toContain(
        'perform private."FC_VALIDAR_REGRA_ANALISE"(v_modelo."DS_CONFIGURACAO");',
      );
      expect(sql).toMatch(/^begin;$/m);
      expect(sql).toMatch(/^commit;$/m);
    });

    it("nenhuma pergunta da Provisória pelo número nos modelos de Projetos e na nota declarada", () => {
      for (const codigo of ["PROJ26-CURRICULAR", "PROJ26-RIO-DOCE"])
        expect(
          textosDe(modelo(codigo).provisoria).filter((t) =>
            PERGUNTA_PELO_NUMERO.test(t),
          ),
        ).toEqual([]);
      for (const codigo of [
        ...MODELOS_SI,
        ...DEPOIS_DA_F3,
        "PROJ26-CURRICULAR",
      ])
        expect(
          textosDe(
            modelo(codigo).provisoria.nota_declarada.map((i) => i.pergunta),
          ).filter((t) => PERGUNTA_PELO_NUMERO.test(t)),
        ).toEqual([]);
    });

    it("a da experiência declarada por nível: 93/2026 por nível (superior +5 até 35, técnico e médio +4 até 40) e 114/2026 +5 até 35 em todos, idempotente e validada", () => {
      expect(Object.keys(EXPERIENCIA_DECLARADA).sort()).toEqual([
        "PROJ26-CURRICULAR",
        "PROJ26-RIO-DOCE",
      ]);
      const cur = EXPERIENCIA_DECLARADA["PROJ26-CURRICULAR"];
      expect(cur.pergunta).toBe("Experiência Profissional");
      const maximo = (mapa) => Math.max(...Object.values(mapa));
      expect(maximo(cur.pontos_por_nivel.superior)).toBe(35);
      expect(maximo(cur.pontos_por_nivel.tecnico)).toBe(40);
      expect(cur.pontos_por_nivel.medio).toEqual(cur.pontos_por_nivel.tecnico);
      expect(cur.pontos_por_nivel.superior["1 anos e 6 meses"]).toBe(10);
      expect(cur.pontos_por_nivel.tecnico["5 anos e 6 meses ou mais"]).toBe(40);
      const rio = EXPERIENCIA_DECLARADA["PROJ26-RIO-DOCE"];
      expect(rio.pontos).toEqual(cur.pontos_por_nivel.superior);
      expect(rio.pontos_por_nivel).toBeUndefined();
      // O PROJ26-CURRICULAR: titulação e cursos (perguntas da ficha) + a experiência.
      expect(modelo("PROJ26-CURRICULAR").provisoria.nota_declarada).toEqual([
        ...DECLARADA_DA_FICHA,
        cur,
      ]);
      for (const codigo of ["PROJ26-CURRICULAR", "PROJ26-RIO-DOCE"])
        expect(comAExperienciaDeclarada(codigo, modelo(codigo))).toEqual(
          modelo(codigo),
        );
      const sql = ler(
        "tests/fixtures/sql-de-dados/20261007-declarada-experiencia-por-nivel.sql",
      );
      expect(sql).toContain(
        'perform private."FC_VALIDAR_REGRA_ANALISE"(v_modelo."DS_CONFIGURACAO");',
      );
      expect(sql).toContain("is distinct from 'EXPERIENCIA'");
      expect(sql).toMatch(/^begin;$/m);
      expect(sql).toMatch(/^commit;$/m);
    });

    it.each([
      "20261006-modelos-dos-editais-recentes.sql",
      "20261006-modelo-proj26-rio-doce.sql",
    ])("%s é idempotente, valida no banco e fecha a transação", (arquivo) => {
      const sql = ler(`tests/fixtures/sql-de-dados/${arquivo}`);
      expect(sql).toContain('on conflict ("CO_MODELO") do update');
      expect(sql).toContain(
        'perform private."FC_VALIDAR_REGRA_ANALISE"(v_modelo."DS_CONFIGURACAO");',
      );
      expect(sql).toMatch(/^begin;$/m);
      expect(sql).toMatch(/^commit;$/m);
    });
  });

  describe("os modelos passam na validação da regra", () => {
    it.each(MODELOS_SI)("%s é válido", (codigo) => {
      expect(validarRegraAnalise(modelo(codigo))).toEqual([]);
    });

    it("o PROJ26-RIO-DOCE usa o lote por nota mínima 10 (8.2.6) e desempata pelo item 10.1: idoso, experiência declarada, maior idade", () => {
      const m = modelo("PROJ26-RIO-DOCE");
      expect(m.lote).toMatchObject({
        base: "NOTA_MINIMA",
        nota_minima: 10,
        item_edital: "8.2.6",
      });
      expect(m.provisoria.desempate).toEqual([
        "IDOSO",
        "EXPERIENCIA_DECLARADA",
        "MAIOR_IDADE",
      ]);
      expect(m.provisoria.pergunta_experiencia).toBe(
        "Experiência Profissional",
      );
      expect(validarRegraAnalise(m)).toEqual([]);
    });

    it("o PROJ26-CURRICULAR (93/2026) acha a experiência pelo enunciado, não pela Pergunta 17", () => {
      const m = modelo("PROJ26-CURRICULAR");
      expect(m.lote).toMatchObject({ base: "NOTA_MINIMA", nota_minima: 15 });
      expect(m.provisoria.desempate).toEqual([
        "IDOSO",
        "EXPERIENCIA_DECLARADA",
        "MAIOR_IDADE",
      ]);
      expect(m.provisoria.pergunta_experiencia).toBe(
        "Experiência Profissional",
      );
      expect(validarRegraAnalise(m)).toEqual([]);
    });
  });

  describe("o que o edital oficial pede, conferido nos modelos", () => {
    const bloco = (codigo, b) =>
      modelo(codigo).blocos.find((x) => x.codigo === b);

    it("Saúde Indígena: étnico 8 + 6, Anexo VI irregular zera (não elimina), aldeia sem lista", () => {
      for (const codigo of MODELOS_SI) {
        const etnico = bloco(codigo, "ETNICO");
        expect([etnico.indigena, etnico.aldeia, etnico.teto]).toEqual([
          8, 6, 14,
        ]);
        expect(etnico.efeitos.NAO_CONFORME).toBe("ZERA_PONTOS");
        expect(etnico.lista_aldeias).toBeNull();
      }
    });

    it("Saúde Indígena: títulos cumulativos até 6, experiência 0,2/mês até 10, sem cursos", () => {
      for (const codigo of MODELOS_SI) {
        const formacao = bloco(codigo, "FORMACAO");
        expect([formacao.cumulativa, formacao.teto]).toEqual([true, 6]);
        const exp = bloco(codigo, "EXPERIENCIA");
        expect([exp.pontos_por_mes, exp.teto]).toEqual([0.2, 10]);
        expect(exp.estagio_indigena.so_sem_experiencia).toBe(false);
        expect(modelo(codigo).blocos.some((b) => b.tipo === "CURSOS")).toBe(
          false,
        );
      }
    });

    it("mínimo de experiência, estágio e nível fundamental de cada edital", () => {
      const resumo = (codigo) => {
        const exp = bloco(codigo, "EXPERIENCIA");
        return [
          exp.minimo_meses,
          exp.estagio_indigena.horas_por_dia,
          Boolean(bloco(codigo, "FORMACAO").pontos_por_nivel.fundamental),
        ];
      };
      expect(resumo("SI26-100")).toEqual([6, 8, false]);
      expect(resumo("SI26-ALSE")).toEqual([3, 8, true]);
      expect(resumo("SI26-PARINTINS")).toEqual([3, 4, true]);
      expect(resumo("SI26-MRSA")).toEqual([6, 4, true]);
    });

    it("SI26-100 corrigido mantém as perguntas do questionário e a nota declarada", () => {
      const m = modelo("SI26-100");
      expect(bloco("SI26-100", "ETNICO").perguntas).toEqual([
        "Pergunta 6 -",
        "Pergunta 7 -",
      ]);
      expect(bloco("SI26-100", "GRADUACAO").perguntas).toEqual([
        "Pergunta 13 -",
        "Pergunta 14 -",
      ]);
      expect(m.provisoria.nota_declarada).toHaveLength(2);
      expect(m.provisoria.eliminacao_automatica.map((e) => e.codigo)).toContain(
        "TERMO",
      );
    });

    it("Rio Doce: 5 pontos por bloco de 6 meses e máximo de 35 em todos os níveis", () => {
      const exp = bloco("PROJ26-RIO-DOCE", "EXPERIENCIA");
      expect(exp.por_nivel).toBeUndefined();
      expect([exp.pontos_por_periodo, exp.teto, exp.desconta_minimo]).toEqual([
        5,
        35,
        true,
      ]);
      expect(
        modelo("PROJ26-RIO-DOCE").blocos.find((b) => b.tipo === "PONTUACAO"),
      ).toBeUndefined();
    });
  });

  describe("casos dourados de pontuação", () => {
    it.each(CASOS.pontuacao.map((c) => [c.nome, c]))("%s", (_nome, caso) => {
      const r = calcularAvaliacao(
        modelo(caso.modelo),
        caso.candidato,
        caso.opcoes,
      );
      const e = caso.esperado;
      expect(r.resultado).toBe(e.resultado);
      expect(r.nota_apurada).toBe(e.nota_apurada);
      expect(r.nota_final).toBe(e.nota_final);
      expect(r.parciais).toEqual(e.parciais);
      expect(r.eliminatorios).toEqual(e.eliminatorios);
      expect(r.encaminhamentos).toEqual(e.encaminhamentos);
      const {
        meses,
        meses_estagio,
        meses_considerados,
        pontos,
        abaixo_do_minimo,
      } = r.experiencia;
      expect({
        meses,
        meses_estagio,
        meses_considerados,
        pontos,
        abaixo_do_minimo,
      }).toEqual(e.experiencia);
    });
  });

  describe("lote e Provisória (os mesmos casos no pytest)", () => {
    it.each(CASOS.lote.map((c) => [`${c.modelo} ${c.vaga.codigo}`, c]))(
      "%s",
      (_nome, caso) => {
        const lote = normalizarRegraAnalise(modelo(caso.modelo)).lote;
        const { tamanho, descricao, aviso } = tamanhoDoLote(lote, caso.vaga);
        expect({ tamanho, descricao, aviso }).toEqual(caso.esperado);
      },
    );

    it.each(CASOS.provisoria.map((c) => [c.nome, c]))("%s", (_nome, caso) => {
      const r = preClassificarVaga({
        regra: normalizarRegraAnalise(modelo(caso.modelo)),
        vaga: CASOS.provisoria_vaga,
        candidatos: CASOS.provisoria_candidatos,
        anterior: {},
        ultimo_lote: 0,
        refazer: false,
        hoje: CASOS.hoje,
      });
      expect(
        Object.fromEntries(r.linhas.map((l) => [l.id, l.posicao])),
      ).toEqual(caso.esperado);
    });

    it.each(CASOS.provisoria_pelo_enunciado.map((c) => [c.nome, c]))(
      "pelo enunciado — %s",
      (_nome, caso) => {
        const r = preClassificarVaga({
          regra: normalizarRegraAnalise(modelo(caso.modelo)),
          vaga: caso.vaga,
          candidatos: caso.candidatos,
          anterior: {},
          ultimo_lote: 0,
          refazer: false,
          hoje: CASOS.hoje_pelo_enunciado,
        });
        expect({
          posicoes: Object.fromEntries(r.linhas.map((l) => [l.id, l.posicao])),
          eliminados: Object.fromEntries(
            r.linhas
              .filter((l) => l.motivo_codigo)
              .map((l) => [l.id, l.motivo_codigo]),
          ),
          avisos: r.resumo.avisos,
        }).toEqual(caso.esperado);
      },
    );
  });
});

bloco("modulos/analises-consultas", () => {
  /*
  As consultas de Análises curriculares (src/modulos/analises/consultas.ts):
  a lista por escopo com a cópia do navegador e a revalidação por trás,
  "Todos" com os três pacotes, o detalhamento e os pareceres guardados até o
  "Atualizar". No lugar dos testes do antigo transporte consolidado e dos
  pareceres sob demanda do painel.
*/

  const pacote = (escopo, ids, extra = {}) => ({
    schema_version: 4,
    scope: escopo,
    grupo: "Saúde Indígena",
    edital_status: escopo === "inativo" ? "Inativo" : "Ativo",
    columns: [
      "id",
      "unidade",
      "edital",
      "codigo_vaga",
      "candidato",
      "responsavel_analise",
    ],
    rows: ids.map((id) => [
      id,
      "DSEI A",
      "1/2026",
      "V",
      `Pessoa ${id}`,
      "Carla",
    ]),
    editais: [],
    total: ids.length,
    generated_at: `2026-09-30T10:00:0${ids.length}Z`,
    ...extra,
  });

  function memoria() {
    const mapa = new Map();
    return {
      mapa,
      ler: async (chave) => mapa.get(chave) ?? null,
      guardar: async (chave, valor) => void mapa.set(chave, valor),
      apagarTudo: async () => mapa.clear(),
    };
  }

  function supabaseCom(responder) {
    return { rpc: vi.fn(async (nome, args) => responder(nome, args)) };
  }

  const opcoes = { area: "saude-indigena", usuarioId: "u1" };

  describe("a versão da cópia do painel", () => {
    it("segue o formato do payload, não a publicação do front", () => {
      expect(VERSAO_DA_COPIA).not.toContain("http");
      expect(VERSAO_DA_COPIA).not.toContain("file:");
      for (const esquema of ESQUEMAS_DO_PAYLOAD)
        expect(VERSAO_DA_COPIA).toContain(String(esquema));
    });
  });

  describe("a lista por escopo e a cópia do navegador", () => {
    it("sem cópia, pede ao servidor e guarda; com cópia, devolve na hora e revalida por trás", async () => {
      const armazenamento = memoria();
      let versao = pacote("ativo", ["a1"]);
      const supabase = supabaseCom(() => ({ data: versao, error: null }));
      const consultas = criarConsultasDasAnalises({
        supabase,
        armazenamento,
        versao: "t",
      });

      const primeira = await consultas.carregarEscopo({
        ...opcoes,
        escopo: "ativo",
      });
      expect(primeira.daCopia).toBe(false);
      expect(primeira.linhas[0]).toMatchObject({
        id: "a1",
        grupo: "Saúde Indígena",
      });
      await new Promise((ok) => setTimeout(ok, 0));
      expect(armazenamento.mapa.size).toBe(2); // o dono e a cópia

      versao = pacote("ativo", ["a1", "a2"]);
      const aoMudar = vi.fn();
      const segunda = await consultas.carregarEscopo({
        ...opcoes,
        escopo: "ativo",
        aoMudar,
      });
      expect(segunda.daCopia).toBe(true);
      expect(segunda.linhas).toHaveLength(1);
      await segunda.revalidacao;
      expect(aoMudar).toHaveBeenCalledTimes(1);
      expect(aoMudar.mock.calls[0][0].linhas).toHaveLength(2);
    });

    it("a revalidação compara pela regra do painel: dado novo redesenha, o mesmo não, e nada cai no aviso do console", async () => {
      const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        const armazenamento = memoria();
        let versao = pacote("ativo", ["a1"]);
        const supabase = supabaseCom(() => ({ data: versao, error: null }));
        const consultas = criarConsultasDasAnalises({
          supabase,
          armazenamento,
          versao: "t",
        });
        await consultas.carregarEscopo({ ...opcoes, escopo: "ativo" });
        await new Promise((ok) => setTimeout(ok, 0));

        // O mesmo pacote (mesma generated_at e total): a cópia fica, sem redesenhar.
        const semMudanca = vi.fn();
        const mesma = await consultas.carregarEscopo({
          ...opcoes,
          escopo: "ativo",
          aoMudar: semMudanca,
        });
        expect(await mesma.revalidacao).toBe(true);
        expect(semMudanca).not.toHaveBeenCalled();

        versao = pacote("ativo", ["a1", "a2", "a3"]);
        const comMudanca = vi.fn();
        const nova = await consultas.carregarEscopo({
          ...opcoes,
          escopo: "ativo",
          aoMudar: comMudanca,
        });
        expect(nova.daCopia).toBe(true);
        await nova.revalidacao;
        expect(comMudanca).toHaveBeenCalledTimes(1);
        expect(comMudanca.mock.calls[0][0].linhas.map((l) => l.id)).toEqual([
          "a1",
          "a2",
          "a3",
        ]);
        expect(aviso).not.toHaveBeenCalled();
      } finally {
        aviso.mockRestore();
      }
    });

    it("sem rede, a revalidação não chega: a cópia fica, com a hora em que foi guardada", async () => {
      const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        const armazenamento = memoria();
        let semRede = false;
        const supabase = supabaseCom(() =>
          semRede
            ? {
                data: null,
                error: { message: "TypeError: Failed to fetch", code: "" },
              }
            : { data: pacote("ativo", ["a1"]), error: null },
        );
        const consultas = criarConsultasDasAnalises({
          supabase,
          armazenamento,
          versao: "t",
        });
        await consultas.carregarEscopo({ ...opcoes, escopo: "ativo" });
        await new Promise((ok) => setTimeout(ok, 0));
        const { guardadoEm } = [...armazenamento.mapa.values()].find(
          (valor) => typeof valor === "object",
        );

        semRede = true;
        const comCopia = await consultas.carregarEscopo({
          ...opcoes,
          escopo: "ativo",
        });
        expect(comCopia).toMatchObject({ daCopia: true, guardadoEm });
        expect(comCopia.linhas).toHaveLength(1);
        expect(await comCopia.revalidacao).toBe(false);
        expect(armazenamento.mapa.size).toBe(2);
      } finally {
        aviso.mockRestore();
      }
    });

    it("acesso revogado na revalidação: as cópias saem e a tela é avisada", async () => {
      const armazenamento = memoria();
      let erro = null;
      const supabase = supabaseCom(() =>
        erro
          ? { data: null, error: erro }
          : { data: pacote("ativo", ["a1"]), error: null },
      );
      const consultas = criarConsultasDasAnalises({
        supabase,
        armazenamento,
        versao: "t",
      });
      await consultas.carregarEscopo({ ...opcoes, escopo: "ativo" });
      await new Promise((ok) => setTimeout(ok, 0));

      erro = { code: "42501", message: "sem acesso" };
      const aoPerderAcesso = vi.fn();
      const comCopia = await consultas.carregarEscopo({
        ...opcoes,
        escopo: "ativo",
        aoPerderAcesso,
      });
      await comCopia.revalidacao;
      expect(aoPerderAcesso).toHaveBeenCalledWith(erro);
      expect(armazenamento.mapa.size).toBe(0);
    });

    it("Todos: ativo e inativo, juntos e sem repetir (sem as desativadas)", async () => {
      const supabase = supabaseCom((_, { p_scope }) => ({
        data: {
          ativo: pacote("ativo", ["a1", "a3"]),
          inativo: pacote("inativo", ["a2"]),
          desativadas: pacote("desativadas", ["a4"]),
        }[p_scope],
        error: null,
      }));
      const consultas = criarConsultasDasAnalises({
        supabase,
        armazenamento: memoria(),
        versao: "t",
      });
      const todos = await consultas.carregarEscopo({
        ...opcoes,
        escopo: "todos",
        forcarRede: true,
      });
      expect(supabase.rpc.mock.calls.map(([, a]) => a.p_scope)).toEqual([
        "ativo",
        "inativo",
      ]);
      expect(todos.linhas.map((l) => l.id).sort()).toEqual(["a1", "a2", "a3"]);
      expect(todos.payload.scope).toBe("todos");
    });
  });

  describe("porteiro, detalhamento e pareceres", () => {
    it("porteiro: true/false; sem resposta, null (a lista decide)", async () => {
      const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
      const responde = (data, error = null) =>
        criarConsultasDasAnalises({
          supabase: supabaseCom(() => ({ data, error })),
          armazenamento: memoria(),
        });
      expect(await responde([true]).podeLer()).toBe(true);
      expect(await responde(false).podeLer()).toBe(false);
      expect(await responde(null, { message: "x" }).podeLer()).toBeNull();
      aviso.mockRestore();
    });

    it("detalhamento uma vez por registro; falha não fica guardada", async () => {
      let falhar = true;
      const supabase = supabaseCom((nome, args) =>
        falhar
          ? { data: null, error: { message: "x" } }
          : { data: [{ id: args.p_id, analise: "ok" }], error: null },
      );
      const consultas = criarConsultasDasAnalises({
        supabase,
        armazenamento: memoria(),
      });
      await expect(consultas.detalhe("a1")).rejects.toBeTruthy();
      falhar = false;
      expect(await consultas.detalhe("a1")).toEqual({
        id: "a1",
        analise: "ok",
      });
      await consultas.detalhe("a1");
      expect(supabase.rpc).toHaveBeenCalledTimes(2);
      expect(await consultas.detalhe("")).toBeNull();
    });

    it("pareceres em lote por área e escopo, até o esquecer()", async () => {
      const supabase = supabaseCom(() => ({
        data: { columns: ["id", "analise"], rows: [["a1", "Parecer"]] },
        error: null,
      }));
      const consultas = criarConsultasDasAnalises({
        supabase,
        armazenamento: memoria(),
      });
      const mapa = await consultas.textos("sede", "ativo");
      expect(mapa.get("a1")).toEqual({ analise: "Parecer" });
      expect(supabase.rpc).toHaveBeenCalledWith(
        "get_analises_texto_do_painel",
        {
          p_scope: "ativo",
          p_area: "sede",
        },
      );
      await consultas.textos("sede", "ativo");
      expect(supabase.rpc).toHaveBeenCalledTimes(1);
      consultas.esquecer();
      await consultas.textos("sede", "ativo");
      expect(supabase.rpc).toHaveBeenCalledTimes(2);
    });
  });
});

bloco("modulos/recursos-datas", () => {
  /*
  Datas da gaveta de Recursos sempre no horário de Brasília: antes, o fuso do
  computador de quem abria decidia (um recurso das 23h podia aparecer no dia
  seguinte).
*/
  describe("data e hora dos Recursos", () => {
    it("mostra o horário de Brasília, qualquer que seja o fuso da máquina", () => {
      const texto = dataHora("2026-10-02T02:30:00Z");
      expect(texto).toContain("01/10/2026");
      expect(texto).toContain("23:30");
    });

    it("vazio fica vazio", () => {
      expect(dataHora(null)).toBe("");
    });
  });
});

bloco("modulos/recursos-estado-contexto", () => {
  const adiar = () => {
    let resolver;
    const promessa = new Promise((r) => {
      resolver = r;
    });
    return { promessa, resolver };
  };
  const dados = {
    edital_id: "e1",
    origem: "entrevista",
    analista: "",
    processo_sei: "",
    observacao: "",
    fora_analise: true,
    analise_id: null,
    permitir_duplicado: false,
    nome_informado: "Ana",
  };

  describe("Recursos após trocar área ou sessão", () => {
    it.each(["salvar", "arquivar"])(
      "não recarrega a área nova ao terminar a releitura do modelo (%s)",
      async (acao) => {
        const leitura = adiar();
        const supabase = {
          rpc: vi.fn((nome) =>
            nome === "listar_modelos_resposta_recurso"
              ? leitura.promessa
              : Promise.resolve({ data: { recursos: [] }, error: null }),
          ),
        };
        const e = criarEstadoDosRecursos({ supabase });
        await e.carregar("a");
        const gravacao =
          acao === "arquivar"
            ? e.arquivarModelo("m1", "Substituído")
            : e.salvarModelo({
                nome: "Modelo",
                situacao: "DEFERIDO",
                origem: "entrevista",
                area: "a",
                corpo: "Texto",
              });
        await vi.waitFor(() =>
          expect(
            supabase.rpc.mock.calls.some(
              ([nome]) => nome === "listar_modelos_resposta_recurso",
            ),
          ).toBe(true),
        );
        await e.carregar("b");
        const antes = supabase.rpc.mock.calls.filter(
          ([nome]) => nome === "get_recursos_da_area",
        ).length;
        leitura.resolver({ data: { modelos: [] }, error: null });
        expect(await gravacao).toBeNull();
        expect(e.obter().modelosAdmin).toBeNull();
        expect(
          supabase.rpc.mock.calls.filter(
            ([nome]) => nome === "get_recursos_da_area",
          ),
        ).toHaveLength(antes);
      },
    );
    it("um pedido antigo de ajuste não bloqueia nem libera o pedido da nova área", async () => {
      const antiga = adiar();
      const nova = adiar();
      let numero = 0;
      const supabase = {
        rpc: vi.fn((nome) =>
          nome === "obter_ajustes_pontuacao_recurso"
            ? ++numero === 1
              ? antiga.promessa
              : nova.promessa
            : Promise.resolve({ data: { recursos: [] }, error: null }),
        ),
      };
      const e = criarEstadoDosRecursos({ supabase });
      await e.carregar("a");
      const primeiro = e.carregarAjustes("r1");
      await e.carregar("b");
      const segundo = e.carregarAjustes("r1");
      expect(numero).toBe(2);
      antiga.resolver({ data: { versoes: [{ id: "antiga" }] }, error: null });
      await primeiro;
      await e.carregarAjustes("r1");
      expect(numero).toBe(2);
      nova.resolver({ data: { versoes: [{ id: "nova" }] }, error: null });
      await segundo;
      expect(e.obter().ajustes.get("r1").versoes).toEqual([{ id: "nova" }]);
    });
    it("ignora detalhe, ajuste, prévia e modelos da área anterior", async () => {
      const espera = adiar();
      const supabase = {
        rpc: vi.fn((nome) =>
          nome === "get_recursos_da_area"
            ? Promise.resolve({ data: { recursos: [] }, error: null })
            : espera.promessa,
        ),
      };
      const e = criarEstadoDosRecursos({ supabase });
      await e.carregar("a");
      const consultas = [
        e.carregarDetalhe("r1"),
        e.carregarAjustes("r1"),
        e.carregarDadosDaPrevia("r1"),
        e.carregarModelos(),
      ];
      await e.carregar("b");
      espera.resolver({
        data: { observacao: "Dados da outra área", versoes: [{ id: "v1" }] },
        error: null,
      });
      await Promise.all(consultas);
      expect(e.obter().area).toBe("b");
      expect(e.obter().detalhes.size).toBe(0);
      expect(e.obter().ajustes.size).toBe(0);
      expect(e.obter().previas.size).toBe(0);
      expect(e.obter().modelosAdmin).toBeNull();
    });
    it.each([null, { message: "Erro antigo", code: "40001" }])(
      "escrita antiga não fecha formulário, avisa ou libera ação nova (erro: %j)",
      async (error) => {
        const antiga = adiar();
        const nova = adiar();
        let numero = 0;
        const toast = vi.fn();
        const supabase = {
          rpc: vi.fn((nome) =>
            nome === "salvar_recurso_candidato"
              ? ++numero === 1
                ? antiga.promessa
                : nova.promessa
              : Promise.resolve({ data: { recursos: [] }, error: null }),
          ),
        };
        const e = criarEstadoDosRecursos({ supabase, toast });
        await e.carregar("a");
        const primeiro = e.salvar(dados);
        await e.carregar("b");
        e.abrirNovo();
        const segundo = e.salvar(dados);
        const formulario = e.obter().formulario;
        antiga.resolver({ data: { id: "antigo", nu: 1 }, error });
        expect(await primeiro).toBeNull();
        expect(e.obter().formulario).toBe(formulario);
        expect(e.obter().acao?.tipo).toBe("salvar");
        expect(toast).not.toHaveBeenCalled();
        nova.resolver({ data: { id: "novo", nu: 2 }, error: null });
        expect(await segundo).toMatchObject({ ok: true, id: "novo" });
        expect(e.obter().acao).toBeNull();
        expect(toast).toHaveBeenCalledTimes(1);
      },
    );
    it("troca de usuário descarta a resposta de uma gravação em curso", async () => {
      const espera = adiar();
      let aoMudar;
      const toast = vi.fn();
      const supabase = {
        auth: {
          onAuthStateChange: (fn) => {
            aoMudar = fn;
          },
        },
        rpc: vi.fn((nome) =>
          nome === "salvar_recurso_candidato"
            ? espera.promessa
            : Promise.resolve({ data: { recursos: [] }, error: null }),
        ),
      };
      const e = criarEstadoDosRecursos({ supabase, toast });
      aoMudar("SIGNED_IN", { user: { id: "u1" } });
      await e.carregar("a");
      const gravacao = e.salvar(dados);
      aoMudar("SIGNED_IN", { user: { id: "u2" } });
      espera.resolver({ data: { id: "antigo" }, error: null });
      expect(await gravacao).toBeNull();
      expect(e.obter().dados).toBeNull();
      expect(toast).not.toHaveBeenCalled();
    });
    it("não registra um upload antigo nem inicia download após mudança de área", async () => {
      const envio = adiar();
      const assinatura = adiar();
      const abrirUrl = vi.fn();
      const toast = vi.fn();
      const bucket = {
        upload: vi.fn(() => envio.promessa),
        remove: vi.fn(async () => ({ error: null })),
        createSignedUrl: vi.fn(() => assinatura.promessa),
      };
      const supabase = {
        storage: { from: () => bucket },
        rpc: vi.fn((nome) =>
          Promise.resolve({
            data:
              nome === "registrar_download_anexo_recurso"
                ? { caminho: "a/r1/a.pdf", nome: "a.pdf" }
                : { recursos: [] },
            error: null,
          }),
        ),
      };
      const e = criarEstadoDosRecursos({ supabase, toast, abrirUrl });
      await e.carregar("a");
      const upload = e.enviarAnexo(
        "11111111-2222-4333-8444-555555555555",
        new File(["PDF"], "a.pdf", { type: "application/pdf" }),
        "documento",
      );
      await e.carregar("b");
      envio.resolver({ error: null });
      expect(await upload).toBeNull();
      expect(
        supabase.rpc.mock.calls.some(
          ([nome]) => nome === "registrar_anexo_recurso",
        ),
      ).toBe(false);
      // O arquivo enviado e não registrado sai do bucket (não fica órfão).
      expect(bucket.remove).toHaveBeenCalledWith([
        bucket.upload.mock.calls[0][0],
      ]);
      const download = e.baixarAnexo({ id: "an1" });
      await vi.waitFor(() => expect(bucket.createSignedUrl).toHaveBeenCalled());
      await e.carregar("c");
      assinatura.resolver({
        data: { signedUrl: "https://exemplo.test/anexo" },
        error: null,
      });
      expect(await download).toBeNull();
      expect(abrirUrl).not.toHaveBeenCalled();
      expect(toast).not.toHaveBeenCalled();
    });
    it("registro do anexo recusado: o arquivo enviado sai do bucket", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const bucket = {
        upload: vi.fn(async () => ({ error: null })),
        remove: vi.fn(async () => ({ error: null })),
      };
      const toast = vi.fn();
      const supabase = {
        storage: { from: () => bucket },
        rpc: vi.fn(async (nome) =>
          nome === "registrar_anexo_recurso"
            ? { data: null, error: { message: "recusado" } }
            : { data: { recursos: [] }, error: null },
        ),
      };
      const e = criarEstadoDosRecursos({ supabase, toast });
      await e.carregar("a");
      const ok = await e.enviarAnexo(
        "11111111-2222-4333-8444-555555555555",
        new File(["PDF"], "a.pdf", { type: "application/pdf" }),
        "documento",
      );
      expect(ok).toBe(false);
      expect(bucket.remove).toHaveBeenCalledWith([
        bucket.upload.mock.calls[0][0],
      ]);
      expect(toast).toHaveBeenCalledWith(
        expect.stringContaining("Não foi possível anexar"),
        "error",
      );
      console.warn.mockRestore();
    });
    it("detalhe lido duas vezes: a resposta antiga que volta depois não sobrescreve a nova", async () => {
      const antiga = adiar();
      const nova = adiar();
      let numero = 0;
      const supabase = {
        rpc: vi.fn((nome) =>
          nome === "get_recurso_candidato_detalhe"
            ? ++numero === 1
              ? antiga.promessa
              : nova.promessa
            : Promise.resolve({ data: { recursos: [] }, error: null }),
        ),
      };
      const e = criarEstadoDosRecursos({ supabase });
      await e.carregar("a");
      const primeira = e.carregarDetalhe("r1");
      const segunda = e.carregarDetalhe("r1");
      nova.resolver({ data: { observacao: "nova" }, error: null });
      await segunda;
      antiga.resolver({ data: { observacao: "antiga" }, error: null });
      await primeira;
      expect(e.obter().detalhes.get("r1").observacao).toBe("nova");
    });

    it("leitura de ajuste que começou antes da gravação não sobrescreve o gravado", async () => {
      const leitura = adiar();
      let numero = 0;
      const supabase = {
        rpc: vi.fn((nome) => {
          if (nome === "obter_ajustes_pontuacao_recurso")
            return ++numero === 1
              ? leitura.promessa
              : Promise.resolve({
                  data: { versoes: [{ id: "relida" }] },
                  error: null,
                });
          if (nome === "propor_ajuste_pontuacao")
            return Promise.resolve({
              data: { versoes: [{ id: "gravada" }] },
              error: null,
            });
          return Promise.resolve({ data: { recursos: [] }, error: null });
        }),
      };
      const e = criarEstadoDosRecursos({ supabase, toast: () => {} });
      await e.carregar("a");
      const antiga = e.carregarAjustes("r1");
      await e.proporAjuste({ id: "r1" }, { motivo: "Revisão" });
      expect(e.obter().ajustes.get("r1").versoes).toEqual([{ id: "gravada" }]);
      leitura.resolver({ data: { versoes: [{ id: "antiga" }] }, error: null });
      await antiga;
      await vi.waitFor(() =>
        expect(e.obter().ajustes.get("r1").versoes).toEqual([{ id: "relida" }]),
      );
    });
  });
});

bloco("parecer-do-recurso", () => {
  /*
  O fluxo do parecer jurídico sem DOM — espelho de
  transicionar_recurso_candidato (20261001170000_recursos_parecer_juridico.sql).
*/

  it("rejeita nomes herdados de objeto como ações desconhecidas", () => {
    for (const acao of ["toString", "constructor", "__proto__"]) {
      expect(proximaSituacao("EM_ANALISE_JURIDICA", acao)).toBeNull();
      expect(
        avaliarAcaoDoParecer(acao, {
          situacao: "EM_ANALISE_JURIDICA",
          podeDecidir: true,
        }),
      ).toEqual({ permitida: false, motivo: "Ação desconhecida." });
      expect(erroDoTextoDoParecer(acao, "Texto longo de parecer")).toBe(
        "Ação desconhecida.",
      );
    }
  });

  describe("estados e transições", () => {
    it.each([
      ["REGISTRADO", "enviar_parecer", "EM_ANALISE_JURIDICA"],
      ["EM_ANALISE_JURIDICA", "devolver", "REGISTRADO"],
      ["EM_ANALISE_JURIDICA", "deferir", "DEFERIDO"],
      [
        "EM_ANALISE_JURIDICA",
        "deferir_parcialmente",
        "PARCIALMENTE_INDEFERIDO",
      ],
      ["EM_ANALISE_JURIDICA", "indeferir", "INDEFERIDO"],
      ["DEFERIDO", "reabrir", "EM_ANALISE_JURIDICA"],
      ["INDEFERIDO", "reabrir", "EM_ANALISE_JURIDICA"],
      // Inválidas: decidir sem passar pelo jurídico, reenviar, reabrir sem decisão.
      ["REGISTRADO", "deferir", null],
      ["REGISTRADO", "devolver", null],
      ["EM_ANALISE_JURIDICA", "enviar_parecer", null],
      ["DEFERIDO", "indeferir", null],
      ["REGISTRADO", "reabrir", null],
      ["EM_ANALISE_JURIDICA", "reabrir", null],
      ["REGISTRADO", "inventada", null],
    ])("%s --%s--> %s", (de, acao, para) => {
      expect(proximaSituacao(de, acao)).toBe(para);
    });
  });

  describe("quem vê cada botão", () => {
    const editor = { podeEditar: true, podeDecidir: false };
    const juridico = { podeEditar: true, podeDecidir: true };
    const acoes = (situacao, quem, extra = {}) =>
      acoesDoParecer({ situacao, ...quem, ...extra }).map((a) => a.acao);

    it("quem edita só envia para parecer; não vê decidir, devolver nem reabrir", () => {
      expect(acoes("REGISTRADO", editor)).toEqual(["enviar_parecer"]);
      expect(acoes("EM_ANALISE_JURIDICA", editor)).toEqual([]);
      expect(acoes("DEFERIDO", editor)).toEqual([]);
      expect(aguardandoParecer("EM_ANALISE_JURIDICA", false)).toBe(true);
      expect(
        avaliarAcaoDoParecer("deferir", {
          situacao: "EM_ANALISE_JURIDICA",
          ...editor,
        }),
      ).toEqual({ permitida: false, motivo: "Sem permissão." });
    });

    it("o jurídico decide, devolve e reabre; quem só lê não vê nada", () => {
      expect(acoes("EM_ANALISE_JURIDICA", juridico)).toEqual([
        "deferir",
        "deferir_parcialmente",
        "indeferir",
        "devolver",
      ]);
      expect(acoes("INDEFERIDO", juridico)).toEqual(["reabrir"]);
      expect(aguardandoParecer("EM_ANALISE_JURIDICA", true)).toBe(false);
      expect(
        acoes("EM_ANALISE_JURIDICA", { podeEditar: false, podeDecidir: false }),
      ).toEqual([]);
      expect(
        acoes("REGISTRADO", { podeEditar: false, podeDecidir: false }),
      ).toEqual([]);
    });

    it("com a resposta enviada, reabrir aparece desligado, com o motivo", () => {
      const [reabrir] = acoesDoParecer({
        situacao: "DEFERIDO",
        ...juridico,
        respostaEnviada: true,
      });
      expect(reabrir).toMatchObject({
        acao: "reabrir",
        permitida: false,
        motivo: "A resposta já foi enviada ao candidato.",
      });
    });
  });

  describe("textos", () => {
    it("decidir exige parecer (10 a 20.000); devolver e reabrir, motivo; enviar, opcional", () => {
      expect(erroDoTextoDoParecer("deferir", "curto")).toMatch(/parecer/);
      expect(erroDoTextoDoParecer("indeferir", "x".repeat(10))).toBe("");
      expect(erroDoTextoDoParecer("deferir", "x".repeat(20001))).toMatch(
        /20.000/,
      );
      expect(erroDoTextoDoParecer("devolver", " ")).toBe(
        "Diga o que precisa ser ajustado.",
      );
      expect(erroDoTextoDoParecer("reabrir", "ok")).toBe("Informe o motivo.");
      expect(erroDoTextoDoParecer("enviar_parecer", "")).toBe("");
    });
  });
});

bloco("parecer-em-blocos", () => {
  const textosDoModelo = textosDoModelo__3;
  /*
  O parecer em blocos escreve o MESMO texto que o simulador da equipe.

  1. Texto esperado (sempre roda): cada caso de casos-do-parecer.js (nomes
     fictícios) tem o texto, linha a linha, em parecer-em-blocos-esperado.js —
     conferido contra o simulador quando foi escrito.
  2. Paridade com o simulador (só com SIMULADOR_DE_PARECERES apontando para o
     HTML da equipe, que NÃO fica no repositório; no CI, pulado): abre o
     simulador no jsdom com o script dele, preenche os campos com o mesmo caso
     (como o clique faria) e compara o texto visível da prévia dele. As
     diferenças aceitas são CORRECOES_DO_SIMULADOR (palavras em inglês) e os
     números do total de meses da experiência (ver o item 3).
  3. Meses: desde 10/11/2026, a regra da ficha (dias corridos com o primeiro
     e o último, unidos, ÷ 30), e não mais a do simulador (meses de
     calendário sem o dia final), que dava um mês a menos que a ficha.
*/

  const textoDoMonitora = (rascunho) =>
    linhasDeTexto(comporParecer(rascunho)).map((l) =>
      l.replace(/\s+/g, " ").trim(),
    );

  describe("o texto de cada caso é o esperado", () => {
    it("todos os casos têm texto esperado", () => {
      expect(Object.keys(TEXTOS_ESPERADOS).sort()).toEqual(
        CASOS.map(([nome]) => nome).sort(),
      );
    });

    for (const [nome, caso] of CASOS)
      it(nome, async () => {
        expect(textoDoMonitora(await caso())).toEqual(TEXTOS_ESPERADOS[nome]);
      });

    it("o cômputo sem sobreposição do caso completo", () => {
      expect(textoDoMonitora(casoCompleto()).join("\n")).toContain(
        "consolida-se o tempo efetivo de 29 mês(es) completo(s), o que perfaz a pontuação total de 5,8 ponto(s)",
      );
    });
  });

  const SIMULADOR_DE_PARECERES = process.env.SIMULADOR_DE_PARECERES || "";

  describe.skipIf(
    !SIMULADOR_DE_PARECERES || !existsSync(SIMULADOR_DE_PARECERES),
  )("paridade com o simulador da equipe (SIMULADOR_DE_PARECERES)", () => {
    async function textoDoSimulador(rascunho) {
      const dom = new JSDOM(readFileSync(SIMULADOR_DE_PARECERES, "utf8"), {
        runScripts: "dangerously",
        beforeParse(janela) {
          // O jsdom não tem innerText; o simulador escreve a prévia por ele.
          Object.defineProperty(janela.HTMLElement.prototype, "innerText", {
            configurable: true,
            get() {
              return this.textContent;
            },
            set(valor) {
              this.textContent = valor;
            },
          });
          janela.confirm = () => true;
        },
      });
      // O simulador monta a 1ª experiência no DOMContentLoaded (o jsdom dispara depois).
      await new Promise((pronto) =>
        dom.window.addEventListener("DOMContentLoaded", pronto, { once: true }),
      );
      preencherOSimulador(dom.window, rascunho);
      return linhasVisiveis(
        dom.window.document.querySelector(".document-page"),
        { corrigir: true },
      );
    }

    // O total de meses segue a ficha, não o simulador: os números saem da comparação.
    const semOsMeses = (linhas) =>
      linhas.map((l) =>
        l.replace(
          /tempo efetivo de \d+ mês\(es\) completo\(s\), o que perfaz a pontuação total de [\d,]+ ponto\(s\)/,
          "tempo efetivo de # mês(es) completo(s), o que perfaz a pontuação total de # ponto(s)",
        ),
      );

    for (const [nome, caso] of CASOS)
      it(nome, async () => {
        const rascunho = await caso();
        expect(semOsMeses(textoDoMonitora(rascunho))).toEqual(
          semOsMeses(await textoDoSimulador(rascunho)),
        );
      });
  });

  describe("meses da experiência: a regra da ficha", () => {
    const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

    it("dá o mesmo que a ficha (dias ÷ 30) numa grade de datas", () => {
      const inicio = Date.UTC(2019, 0, 1);
      let comparados = 0;
      for (let a = 0; a < 800; a += 3) {
        const d1 = inicio + a * 86_400_000;
        for (const dias of [
          0, 1, 27, 28, 29, 30, 31, 58, 59, 60, 61, 89, 90, 365, 366, 400, 731,
        ]) {
          const d2 = d1 + dias * 86_400_000;
          const esperado = Math.floor(
            diasDosIntervalos([{ inicio: iso(d1), fim: iso(d2) }]) /
              DIAS_POR_MES,
          );
          expect(mesesDaExperiencia(iso(d1), iso(d2))).toBe(esperado);
          expect(
            totalSemSobreposicao([
              { atende: true, inicio: iso(d1), fim: iso(d2) },
            ]).meses,
          ).toBe(esperado);
          comparados++;
        }
      }
      expect(comparados).toBeGreaterThan(4000);
    });

    it("casos que a equipe deve conhecer (o dia final conta)", () => {
      // 30 dias com o primeiro e o último fecham um mês.
      expect(mesesDaExperiencia("2026-01-01", "2026-01-30")).toBe(1);
      expect(mesesDaExperiencia("2026-01-01", "2026-01-29")).toBe(0);
      // Antes (simulador): 01/01 a 31/01 dava 0 mês.
      expect(mesesDaExperiencia("2026-01-01", "2026-01-31")).toBe(1);
      expect(mesesDaExperiencia("2026-01-01", "2026-12-31")).toBe(12);
      expect(mesesDaExperiencia("2026-03-10", "2026-03-01")).toBe(0);
      expect(mesesDaExperiencia("", "2026-03-01")).toBe(0);
    });

    it("une sobreposições e emenda o dia seguinte (como a ficha)", () => {
      // 182 + 184 dias seguidos = 366 dias = 12 meses (o simulador dava 5 + 5).
      expect(
        totalSemSobreposicao([
          { atende: true, inicio: "2020-01-01", fim: "2020-06-30" },
          { atende: true, inicio: "2020-07-01", fim: "2020-12-31" },
        ]),
      ).toEqual({ meses: 12, pontos: 12 * 0.2 });
      expect(
        totalSemSobreposicao([
          { atende: true, inicio: "2020-01-01", fim: "2020-12-31" },
          { atende: true, inicio: "2020-03-01", fim: "2020-05-31" },
          { atende: false, inicio: "2010-01-01", fim: "2020-01-01" },
        ]).meses,
      ).toBe(12);
    });
  });

  describe("pontos no parecer", () => {
    it("um decimal, meio para cima sem o erro do float", () => {
      expect(pontosDoParecer(1.45)).toBe("1,5");
      expect(pontosDoParecer(0.05)).toBe("0,1");
      expect(pontosDoParecer(2.25)).toBe("2,3");
      expect(pontosDoParecer(1.44)).toBe("1,4");
      expect(pontosDoParecer(5.8)).toBe("5,8");
      expect(pontosDoParecer(0)).toBe("0,0");
    });
  });

  describe("referências do edital", () => {
    it("sem regra, valem os números do simulador", () => {
      const { referencias, fontes } = referenciasDoEdital(null);
      expect(referencias).toEqual(REFERENCIAS_PADRAO);
      expect(new Set(Object.values(fontes))).toEqual(new Set(["padrao"]));
    });

    it("o item do bloco da regra e as referências gravadas vencem o padrão e entram no texto", () => {
      const { referencias, fontes } = referenciasDoEdital({
        blocos: [
          { codigo: "TITULACAO", tipo: "TITULOS", item_edital: "9.3" },
          { codigo: "EXPERIENCIA", tipo: "VINCULOS", item_edital: "" },
        ],
        referencias_do_parecer: {
          anexo_quilombola: "XII",
          heteroidentificacao: "5.6.2",
          inexistente: "1",
        },
      });
      expect(referencias.formacao).toBe("9.3");
      expect(referencias.experiencia).toBe("8.15");
      expect(fontes).toMatchObject({
        formacao: "bloco",
        anexo_quilombola: "regra",
        experiencia: "padrao",
      });
      const r = casoCompleto();
      r.referencias = referencias;
      const texto = textoDoParecer(comporParecer(r));
      expect(texto).toContain("conforme item 9.3. do edital");
      expect(texto).toContain("conforme modelo estabelecido no Anexo XII.");
      expect(texto).toContain(
        "Declaração conforme modelo estabelecido no Anexo VI",
      );
      expect(texto).toContain("item 5.6.2 do Edital");
      expect(texto).not.toContain("{ref_");
    });
  });

  describe("modelo e marcadores", () => {
    it("o valor digitado com ** não vira negrito; marcador desconhecido fica", () => {
      expect(preencher("A **{x}** e {y}", { x: "**b**" })).toEqual([
        { texto: "A " },
        { texto: "**b**", negrito: true },
        { texto: " e {y}" },
      ]);
    });

    it("o modelo editado troca só o texto gravado", () => {
      const textos = textosDoModelo({
        titulo_objeto: "1. DO OBJETO",
        desconhecido: "x",
        objeto: "  ",
      });
      const linhas = linhasDeTexto(comporParecer(rascunhoVazio(), textos));
      expect(linhas).toContain("1. DO OBJETO");
      expect(linhas.some((l) => l.startsWith("1.1. O presente parecer"))).toBe(
        true,
      );
    });
  });

  describe("pré-preenchimento com o que o Yeendé sabe", () => {
    it("cabeçalho, prazo, envio, ficha, cotas e ajuste, com a fonte de cada campo", async () => {
      const {
        rascunho: r,
        fontes,
        avisos,
      } = rascunhoInicial(await dadosFicticios.carregar("ficticio-1"));
      expect(r.cabecalho.candidato).toBeTruthy();
      expect(r.admissibilidade.prazo_de).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.admissibilidade.envio_hora).toMatch(/^\d{2}:\d{2}$/);
      expect(r.admissibilidade.tempestivo).toBe(true);
      expect(blocoDo(r, "experiencia").itens.length).toBeGreaterThan(1);
      expect(blocoDo(r, "formacao").titulos.length).toBeGreaterThan(0);
      expect(r.conclusao.retificar).toBe(true);
      expect(fontes).toMatchObject({
        "cabecalho.candidato": "recurso",
        "admissibilidade.prazo": "cronograma",
        "admissibilidade.envio": "recurso",
        "bloco.experiencia": "ficha",
        "conclusao.notas": "ajuste",
      });
      // Parecer e ficha contam igual (dias ÷ 30): sem aviso de diferença.
      expect(avisos.some((a) => a.includes("A ficha apurou"))).toBe(false);
    });

    it("avisa quando a ficha apurou outro total (estágio ou data limite)", async () => {
      const dados = await dadosFicticios.carregar("ficticio-1");
      const ficha = { ...dados.ficha, meses_apurados: 999 };
      const { avisos } = rascunhoInicial({ ...dados, ficha });
      expect(
        avisos.some((a) =>
          a.startsWith("A ficha apurou 999 meses; o parecer conta"),
        ),
      ).toBe(true);
    });

    it("envio depois do prazo vira intempestivo e indeferimento", async () => {
      const dados = await dadosFicticios.carregar("ficticio-1");
      dados.recurso.enviado_em = "2026-10-22T09:10:00-03:00";
      const { rascunho } = rascunhoInicial(dados);
      expect(rascunho.admissibilidade.tempestivo).toBe(false);
      expect(textoDoParecer(comporParecer(rascunho))).toContain(
        "NÃO CONHECIMENTO",
      );
    });

    it("sem ficha e sem cronograma: blocos em branco e avisos", () => {
      const { rascunho, avisos } = rascunhoInicial({
        recurso: {
          id: 1,
          candidato: "X",
          codigo: 1,
          edital: "1/2026",
          unidade: "U",
          vaga: "V",
          criado_em: "2026-10-21T12:00:00Z",
        },
      });
      expect(rascunho.blocos.map((b) => b.codigo)).toEqual(
        rascunhoVazio().blocos.map((b) => b.codigo),
      );
      expect(avisos).toHaveLength(3);
    });

    it("período de interposição: a atividade de abertura mais tardia da origem", () => {
      expect(
        periodoDeInterposicao(
          [
            {
              atividade: "Prazo de recurso",
              inicio: "2026-10-01",
              fim: "2026-10-02",
              origem: "analise-curricular",
              papel: "abertura",
            },
            {
              atividade: "Prazo de recurso (errata)",
              inicio: "2026-10-20",
              fim: "2026-10-21",
              origem: "analise-curricular",
              papel: "abertura",
            },
            {
              atividade: "Resposta",
              inicio: "2026-10-28",
              fim: "2026-10-30",
              origem: "analise-curricular",
              papel: "resposta",
            },
            {
              atividade: "Prazo de recurso",
              inicio: "2026-11-20",
              fim: "2026-11-21",
              origem: "entrevista",
              papel: "abertura",
            },
          ],
          "analise-curricular",
        ),
      ).toEqual({
        inicio: "2026-10-20",
        fim: "2026-10-21",
        atividade: "Prazo de recurso (errata)",
      });
    });
  });
});

bloco("prazo-do-recurso", () => {
  /*
  O prazo de resposta do recurso sai do cronograma do edital, cujas atividades
  são texto livre. Os nomes abaixo são reais (TB_CRONOGRAMA_MONIT_INDIG, 29/09/2026).
*/

  describe("classificação de cada atividade", () => {
    it.each([
      [
        "Prazo de recurso do resultado preliminar documental",
        "analise-curricular",
        "abertura",
      ],
      ["Prazo para recursos das entrevistas", "entrevista", "abertura"],
      [
        "Resultado preliminar da análise curricular e abertura do prazo de recurso",
        "analise-curricular",
        "abertura",
      ],
      [
        "Resultado preliminar do Avaliação de Conhecimentos e abertura do prazo para recurso",
        "avaliacao-conhecimentos",
        "abertura",
      ],
      [
        "Análise e resposta ao recurso da Avaliação de Conhecimento",
        "avaliacao-conhecimentos",
        "resposta",
      ],
      [
        "Prazo para recursos referentes ao resultado preliminar das entrevistas",
        "entrevista",
        "abertura",
      ],
      [
        "Prazo de recurso referente ao resultado preliminar da Avaliação Documental e de Títulos",
        "analise-curricular",
        "abertura",
      ],
      [
        "Abertura do Prazo de Recurso Curricular",
        "analise-curricular",
        "abertura",
      ],
      [
        "Resposta aos Recursos e Resultado Final das Entrevistas",
        "entrevista",
        "resposta",
      ],
      ["Abertura do Prazo de Recurso Entrevista", "entrevista", "abertura"],
      [
        "Recurso contra o resultado preliminar das Entrevistas",
        "entrevista",
        "abertura",
      ],
      [
        "Divulgação da resposta aos recursos e Publicação do Resultado Definitivo da Avaliação de Títulos",
        "analise-curricular",
        "resposta",
      ],
      [
        "Recurso contra o Resultado Preliminar da Análise Curricular",
        "analise-curricular",
        "abertura",
      ],
      [
        "Recebimento dos recursos contra o resultado preliminar Entrevista para os candidatos negros, indígenas e quilombolas ",
        "entrevista",
        "abertura",
      ],
      [
        "Submissão de recursos relativos à análise documental",
        "analise-curricular",
        "abertura",
      ],
      [
        "Prazo  para  a  interposição  de  recursos  quanto  às  questões  formuladas  e(ou)  aos  gabaritos  oficiais  preliminares",
        "avaliacao-conhecimentos",
        "abertura",
      ],
    ])("%s → %s / %s", (atividade, origem, papel) => {
      expect(origemDaAtividade(atividade)).toBe(origem);
      expect(papelDaAtividade(atividade)).toBe(papel);
    });

    it("atividade sem etapa citada não tem origem própria", () => {
      for (const atividade of [
        "Análise e resposta ao recurso ",
        "Envio de Resposta aos Recursos",
        "Prazo de recursos",
        "Análise e resposta aos recursos interpostos",
      ]) {
        expect(origemDaAtividade(atividade)).toBeNull();
        expect(papelDaAtividade(atividade)).not.toBeNull();
      }
    });

    it("atividade que não é de recurso não tem papel", () => {
      expect(
        papelDaAtividade("Resultado final do Processo Seletivo"),
      ).toBeNull();
      expect(
        papelDaAtividade("Solicitação pelo candidato do espelho de nota"),
      ).toBeNull();
      expect(origemDaAtividade("Resultado final do Processo Seletivo")).toBe(
        "resultado-final",
      );
    });

    it("o que vem depois de “e convocação” fala da etapa seguinte", () => {
      expect(
        origemDaAtividade(
          "Resultado final da análise curricular e convocação para a Avaliação de Conhecimentos",
        ),
      ).toBe("analise-curricular");
    });

    it("normaliza acento, caixa e espaços", () => {
      expect(normalizarAtividade("  Análise  e RESPOSTA — ao Recurso ")).toBe(
        "analise e resposta ao recurso",
      );
    });
  });

  /* Cronograma real (edital de Projetos com análise curricular e avaliação de conhecimentos). */
  const CRONOGRAMA = [
    {
      ordem: 1,
      atividade: "Publicação do Edital",
      inicio: "2025-09-24",
      fim: "2025-09-24",
    },
    {
      ordem: 4,
      atividade: "Análise curricular ",
      inicio: "2025-10-08",
      fim: "2025-10-14",
    },
    {
      ordem: 5,
      atividade:
        "Resultado preliminar da análise curricular e abertura do prazo de recurso",
      inicio: "2025-10-15",
      fim: "2025-10-15",
    },
    {
      ordem: 6,
      atividade: "Análise e resposta ao recurso ",
      inicio: "2025-10-16",
      fim: "2025-10-17",
    },
    {
      ordem: 7,
      atividade:
        "Resultado final da análise curricular e convocação para a Avaliação de Conhecimentos",
      inicio: "2025-10-20",
      fim: "2025-10-20",
    },
    {
      ordem: 9,
      atividade:
        "Resultado preliminar do Avaliação de Conhecimentos e abertura do prazo para recurso",
      inicio: "2025-10-23",
      fim: "2025-10-23",
    },
    {
      ordem: 10,
      atividade: "Análise e resposta ao recurso da Avaliação de Conhecimento",
      inicio: "2025-10-24",
      fim: "2025-10-27",
    },
    {
      ordem: 11,
      atividade: "Divulgação do resultado final do Processo Seletivo",
      inicio: "2025-10-28",
      fim: "2025-10-28",
    },
  ];

  /* Cronograma típico da Saúde Indígena: só o prazo de recurso, sem a resposta. */
  const CRONOGRAMA_SI = [
    {
      ordem: 3,
      atividade: "Resultado Preliminar da Avaliação Documental e de Títulos",
      inicio: "2026-05-04",
      fim: "2026-05-04",
    },
    {
      ordem: 4,
      atividade: "Prazo de recurso do resultado preliminar documental",
      inicio: "2026-05-05",
      fim: "2026-05-06",
    },
    {
      ordem: 5,
      atividade: "Resultado Final da Avaliação Documental e de Títulos",
      inicio: "2026-05-08",
      fim: "2026-05-08",
    },
    {
      ordem: 7,
      atividade: "Resultado Preliminar das Entrevistas",
      inicio: "2026-05-15",
      fim: "2026-05-15",
    },
    {
      ordem: 8,
      atividade: "Prazo para recursos das entrevistas",
      inicio: "2026-05-18",
      fim: "2026-05-19",
    },
    {
      ordem: 9,
      atividade: "Resultado final do Processo Seletivo",
      inicio: "2026-05-22",
      fim: null,
    },
  ];

  describe("contexto: recurso sem etapa herda a da atividade anterior", () => {
    it("“Análise e resposta ao recurso” depois do resultado da análise curricular é dela", () => {
      const classificadas = classificarCronograma(CRONOGRAMA);
      expect(classificadas.find((e) => e.ordem === 6)).toMatchObject({
        origem: "analise-curricular",
        papel: "resposta",
      });
    });

    it("a ordem do cronograma vale, mesmo que a lista chegue embaralhada", () => {
      const embaralhado = [...CRONOGRAMA].reverse();
      expect(prazoDoRecurso(embaralhado, "analise-curricular").data).toBe(
        "2025-10-17",
      );
    });

    it("etapa sem ordem vai para o fim, não para o começo", () => {
      // Antes, Number(null) = 0 punha a resposta sem ordem antes da entrevista,
      // e ela herdava a origem errada (ou nenhuma).
      for (const vazio of [null, undefined, "", "  "]) {
        const etapas = [
          { ordem: 1, atividade: "Resultado preliminar da entrevista" },
          {
            ordem: vazio,
            atividade: "Análise e resposta ao recurso",
            fim: "2025-11-20",
          },
          { ordem: 2, atividade: "Resultado final" },
        ];
        const classificadas = classificarCronograma(etapas);
        expect(classificadas.map((e) => e.atividade)).toEqual([
          "Resultado preliminar da entrevista",
          "Resultado final",
          "Análise e resposta ao recurso",
        ]);
        expect(classificadas.at(-1)).toMatchObject({
          origem: "resultado-final",
          papel: "resposta",
        });
      }
    });
  });

  describe("prazo por origem", () => {
    it("usa o fim da atividade de resposta daquela origem", () => {
      expect(prazoDoRecurso(CRONOGRAMA, "analise-curricular")).toEqual({
        data: "2025-10-17",
        fonte: "resposta",
        atividade: "Análise e resposta ao recurso",
        aviso: "",
      });
      expect(prazoDoRecurso(CRONOGRAMA, "avaliacao-conhecimentos").data).toBe(
        "2025-10-27",
      );
    });

    it("sem resposta no cronograma, usa o fim do prazo de recurso, com aviso", () => {
      expect(prazoDoRecurso(CRONOGRAMA_SI, "analise-curricular")).toEqual({
        data: "2026-05-06",
        fonte: "abertura",
        atividade: "Prazo de recurso do resultado preliminar documental",
        aviso: AVISO_PRAZO_PELA_ABERTURA,
      });
      expect(prazoDoRecurso(CRONOGRAMA_SI, "entrevista").data).toBe(
        "2026-05-19",
      );
    });

    it("origem sem atividade de recurso: prazo não encontrado", () => {
      expect(prazoDoRecurso(CRONOGRAMA_SI, "resultado-final")).toEqual({
        data: null,
        fonte: null,
        atividade: "",
        aviso: AVISO_SEM_PRAZO,
      });
      expect(prazoDoRecurso([], "entrevista").data).toBeNull();
      expect(prazoDoRecurso(null, "entrevista").data).toBeNull();
    });

    it("duas respostas (errata): vale a de fim mais tardio; sem fim, o início", () => {
      const etapas = [
        {
          ordem: 1,
          atividade: "Prazo para recursos das entrevistas",
          inicio: "2026-01-02",
          fim: "2026-01-03",
        },
        {
          ordem: 2,
          atividade: "Resposta aos Recursos e Resultado Final das Entrevistas",
          inicio: "2026-01-06",
          fim: "2026-01-07",
        },
        {
          ordem: 3,
          atividade: "Resposta aos Recursos e Resultado Final das Entrevistas",
          inicio: "2026-01-10",
          fim: null,
        },
      ];
      expect(prazoDoRecurso(etapas, "entrevista").data).toBe("2026-01-10");
    });
  });

  describe("agrupamento do payload", () => {
    it("agrupa as etapas por edital e ignora linha sem edital", () => {
      const mapa = cronogramasPorEdital([
        { edital_id: "a", ordem: 1 },
        { edital_id: "b", ordem: 1 },
        { edital_id: "a", ordem: 2 },
        { ordem: 3 },
      ]);
      expect([...mapa.keys()]).toEqual(["a", "b"]);
      expect(mapa.get("a")).toHaveLength(2);
    });
  });
});

bloco("rascunho-da-regra", () => {
  /* Regras puras do rascunho guardado das regras (src/lib/regras-do-edital/rascunho-da-regra.ts). */
  const HORA_LOCAL = new Date(2026, 9, 13, 14, 5).toISOString();

  const DO_BANCO = {
    conteudo: { regra: { titulo_etapa: "X" } },
    versao_base: 2,
    atualizado_em: "2026-10-13T14:05:00+00:00",
  };

  describe("formato", () => {
    it("lê a resposta do banco e recusa o estranho", () => {
      expect(rascunhoDoBanco(DO_BANCO)).toEqual({
        conteudo: { regra: { titulo_etapa: "X" } },
        versaoBase: 2,
        atualizadoEm: "2026-10-13T14:05:00.000Z",
        local: false,
      });
      expect(rascunhoDoBanco(null)).toBeNull();
      expect(rascunhoDoBanco({ ...DO_BANCO, conteudo: [1] })).toBeNull();
      expect(rascunhoDoBanco({ ...DO_BANCO, versao_base: -1 })).toBeNull();
      expect(
        rascunhoDoBanco({ ...DO_BANCO, atualizado_em: "ontem" }),
      ).toBeNull();
    });

    it("ida e volta da cópia local; texto estragado = nada", () => {
      const r = { ...rascunhoDoBanco(DO_BANCO), local: true };
      expect(rascunhoDoLocal(rascunhoParaLocal(r))).toEqual(r);
      expect(rascunhoDoLocal("{")).toBeNull();
      expect(rascunhoDoLocal(null)).toBeNull();
    });

    it("chave por tipo, edital e pessoa", () => {
      expect(chaveDoRascunhoLocal("ANALISE", "e1", "u1")).not.toBe(
        chaveDoRascunhoLocal("CLASSIFICACAO", "e1", "u1"),
      );
      expect(chaveDoRascunhoLocal("ANALISE", "e1", "u1")).not.toBe(
        chaveDoRascunhoLocal("ANALISE", "e1", "u2"),
      );
    });
  });

  describe("qual vale ao abrir", () => {
    const banco = rascunhoDoBanco(DO_BANCO);
    const local = (iso, ehLocal = true) => ({
      ...banco,
      atualizadoEm: iso,
      local: ehLocal,
    });

    it("a cópia local não enviada e mais nova ganha; a mais velha perde", () => {
      expect(
        escolherRascunho(banco, local("2026-10-13T15:00:00.000Z")),
      ).toEqual(local("2026-10-13T15:00:00.000Z"));
      expect(escolherRascunho(banco, local("2026-10-13T13:00:00.000Z"))).toBe(
        banco,
      );
      expect(escolherRascunho(null, local("2026-10-13T13:00:00.000Z"))).toEqual(
        local("2026-10-13T13:00:00.000Z"),
      );
      expect(escolherRascunho(null, null)).toBeNull();
    });
  });

  describe("aviso e indicador", () => {
    it("diz quando e se a vigente mudou desde o rascunho", () => {
      const r = rascunhoDoBanco({ ...DO_BANCO, atualizado_em: HORA_LOCAL });
      expect(recuperacaoDoRascunho(r, 2)).toEqual({
        quando: "13/10 14:05",
        versaoBase: 2,
        versaoMudou: false,
      });
      expect(recuperacaoDoRascunho(r, 3).versaoMudou).toBe(true);
      expect(dataEHoraCurtas("x")).toBe("");
    });

    it("textos discretos", () => {
      expect(textoDaGravacao("guardado", HORA_LOCAL)).toBe(
        "Rascunho guardado às 14:05",
      );
      expect(textoDaGravacao("guardando", null)).toBe("Guardando…");
      expect(textoDaGravacao("local", null)).toBe(
        "Sem conexão — guardado neste computador",
      );
      expect(textoDaGravacao("ocioso", null)).toBe("");
    });
  });
});

bloco("recursos-dos-candidatos", () => {
  const diasEntre = diasEntre__4;
  const FILTROS_VAZIOS = FILTROS_VAZIOS__5;
  const opcoesDosFiltros = opcoesDosFiltros__6;
  const pendenciasPrioritarias = pendenciasPrioritarias__7;
  /*
  A aba Recursos sem DOM: o que se calcula de cada recurso, os indicadores e
  as pendências do painel antigo (Apps Script), agora com prazo e "a nota
  mudou" calculados.
*/

  const HOJE = "2026-05-20";
  const CRONOGRAMAS = [
    {
      edital_id: "e1",
      ordem: 1,
      atividade: "Prazo de recurso do resultado preliminar documental",
      inicio: "2026-05-05",
      fim: "2026-05-06",
    },
    {
      edital_id: "e1",
      ordem: 2,
      atividade: "Resultado Preliminar das Entrevistas",
      inicio: "2026-05-15",
      fim: "2026-05-15",
    },
    {
      edital_id: "e1",
      ordem: 3,
      atividade: "Prazo para recursos das entrevistas",
      inicio: "2026-05-21",
      fim: "2026-05-22",
    },
  ];

  const recurso = (extra = {}) => {
    const n = extra.nu;
    return {
      id: `r${n}`,
      nu: n,
      edital_id: "e1",
      edital: "105/2026",
      unidade: "DSEI Litoral Sul",
      origem: "analise-curricular",
      analise_id: `a${n}`,
      fora_analise: false,
      candidato: `Candidato ${n}`,
      codigo: `C${n}`,
      cargo: "Enfermeiro",
      vaga: "V1",
      nota_anterior: 10,
      nota_atual: 10,
      analista: "Ana",
      situacao: "REGISTRADO",
      processo_sei: null,
      mudou_classificacao: false,
      download_empregare_em: null,
      processo_sei_em: null,
      upload_sei_em: null,
      resposta_candidato_em: null,
      decisao_em: null,
      criado_em: "2026-05-10T12:00:00Z",
      revisao: 1,
      ...extra,
    };
  };

  const RECURSOS = () => [
    // Em análise, sem SEI, prazo da análise curricular vencido (06/05).
    recurso({ nu: 1 }),
    // Decidido sem resposta, nota mudou.
    recurso({
      nu: 2,
      situacao: "DEFERIDO",
      decisao_em: "2026-05-15T12:00:00Z",
      nota_atual: 12.5,
      processo_sei_em: "2026-05-11T00:00:00Z",
    }),
    // Entrevista, prazo ainda por vir (22/05), processo SEI sem upload.
    recurso({
      nu: 3,
      origem: "entrevista",
      processo_sei_em: "2026-05-11T00:00:00Z",
      analista: "",
    }),
    // Tudo feito.
    recurso({
      nu: 4,
      situacao: "INDEFERIDO",
      decisao_em: "2026-05-12T12:00:00Z",
      download_empregare_em: "2026-05-10T13:00:00Z",
      processo_sei_em: "2026-05-10T13:00:00Z",
      upload_sei_em: "2026-05-10T14:00:00Z",
      resposta_candidato_em: "2026-05-12T15:00:00Z",
      mudou_classificacao: true,
    }),
    // Fora das análises, resultado final (sem prazo no cronograma).
    recurso({
      nu: 5,
      origem: "resultado-final",
      fora_analise: true,
      analise_id: null,
      nota_anterior: null,
      nota_atual: null,
      candidato: "José da Silva",
    }),
  ];

  const enriquecidos = () =>
    enriquecerRecursos(
      { recursos: RECURSOS(), cronogramas: CRONOGRAMAS },
      HOJE,
    );

  describe("o que se calcula de cada recurso", () => {
    it("a nota mudou quando a atual difere da do cadastro; sem nota, não", () => {
      expect(notaMudou({ nota_anterior: 10, nota_atual: 10 })).toBe(false);
      expect(notaMudou({ nota_anterior: 10, nota_atual: "12.5" })).toBe(true);
      expect(notaMudou({ nota_anterior: null, nota_atual: 3 })).toBe(false);
      expect(notaMudou({ nota_anterior: 0, nota_atual: 0 })).toBe(false);
    });

    it("prazo, atraso e dias em aberto", () => {
      const [r1, r2, r3, r4, r5] = enriquecidos();
      expect(r1.prazo).toMatchObject({ data: "2026-05-06", fonte: "abertura" });
      expect(r1.atrasado).toBe(true);
      expect(r1.diasParaPrazo).toBe(-14);
      expect(r1.diasEmAberto).toBe(10);
      // Decidido: os dias em aberto param na decisão.
      expect(r2.diasEmAberto).toBe(5);
      expect(r3.prazo.data).toBe("2026-05-22");
      expect(r3.atrasado).toBe(false);
      // Respondido não fica atrasado, mesmo com o prazo passado.
      expect(r4.atrasado).toBe(false);
      expect(r4.etapasFeitas).toBe(4);
      expect(r5.prazo.data).toBeNull();
    });

    describe("o dia é o de Brasília, não o do fuso do computador", () => {
      afterEach(() => vi.useRealTimers());

      it("cadastro às 22h de Brasília (01h UTC do dia seguinte) conta do dia de Brasília", () => {
        const [r] = enriquecerRecursos(
          {
            recursos: [recurso({ nu: 1, criado_em: "2026-05-10T01:00:00Z" })],
            cronogramas: CRONOGRAMAS,
          },
          "2026-05-10",
        );
        expect(r.diasEmAberto).toBe(1);
      });

      it("sem hoje informado, hoje é o de Brasília: 01h UTC de 21/05 ainda é 20/05", () => {
        vi.useFakeTimers({ now: new Date("2026-05-21T01:00:00Z") });
        const [r1, , r3] = enriquecerRecursos({
          recursos: RECURSOS(),
          cronogramas: CRONOGRAMAS,
        });
        expect(r1.diasParaPrazo).toBe(-14);
        expect(r3.diasParaPrazo).toBe(2);
        expect(r3.vencendo).toBe(true);
      });
    });

    it("dias entre datas atravessam o mês", () => {
      expect(diasEntre("2026-01-30", "2026-02-02")).toBe(3);
      expect(diasEntre(null, "2026-02-02")).toBeNull();
    });
  });

  describe("indicadores e pendências", () => {
    it("os números dos 4 KPIs (e o total e a taxa, que vão para a fila e o recorte)", () => {
      expect(calcularIndicadores(enriquecidos())).toEqual({
        total: 5,
        registrados: 3,
        aguardandoParecer: 0,
        concluidos: 2,
        deferidos: 1,
        indeferidos: 1,
        atrasados: 2,
        vencendo: 1,
        taxaConclusao: 40,
      });
      expect(calcularIndicadores([]).taxaConclusao).toBe(0);
    });

    it("deferidos somam os deferidos parcialmente; aguardando parecer é a análise jurídica", () => {
      const todos = enriquecerRecursos(
        {
          recursos: [
            recurso({ nu: 1, situacao: "EM_ANALISE_JURIDICA" }),
            recurso({ nu: 2, situacao: "EM_ANALISE_JURIDICA" }),
            recurso({
              nu: 3,
              situacao: "PARCIALMENTE_INDEFERIDO",
              decisao_em: "2026-05-15T12:00:00Z",
            }),
            recurso({
              nu: 4,
              situacao: "DEFERIDO",
              decisao_em: "2026-05-15T12:00:00Z",
            }),
            recurso({ nu: 5, devolvido_em: "2026-05-16T12:00:00Z" }),
          ],
          cronogramas: CRONOGRAMAS,
        },
        HOJE,
      );
      const k = calcularIndicadores(todos);
      expect(k.aguardandoParecer).toBe(2);
      expect(k.deferidos).toBe(2);
      expect(k.indeferidos).toBe(0);
      expect(todos[4].devolvido).toBe(true);
      const nus = (filtros) =>
        filtrarRecursos(todos, { ...FILTROS_VAZIOS, ...filtros }).map(
          (r) => r.nu,
        );
      expect(nus({ situacao: "deferidos" })).toEqual([3, 4]);
      expect(nus({ situacao: "EM_ANALISE_JURIDICA" })).toEqual([1, 2]);
      expect(nus({ pendencia: "devolvido" })).toEqual([5]);
    });

    it("pendências com ocorrência, na ordem de prioridade", () => {
      const pendencias = pendenciasPrioritarias(enriquecidos());
      expect(pendencias.map((p) => [p.chave, p.valor])).toEqual([
        ["prazo_vencido", 2],
        ["prazo_vencendo", 1],
        ["sem_envio_parecer", 3],
        ["sem_analista", 1],
        ["sem_sei", 2],
        ["sem_upload_sei", 2],
        ["sem_resposta", 1],
        ["mudou_resultado", 2],
        ["sem_prazo", 1],
        ["fora_analise", 1],
      ]);
      expect(pendenciasPrioritarias([])).toEqual([]);
    });
  });

  describe("filtros", () => {
    it("por origem, analista (inclusive sem analista), situação, pendência e busca sem acento", () => {
      const todos = enriquecidos();
      const nus = (filtros) =>
        filtrarRecursos(todos, { ...FILTROS_VAZIOS, ...filtros }).map(
          (r) => r.nu,
        );
      expect(nus({ origem: "entrevista" })).toEqual([3]);
      expect(nus({ analista: "Sem analista" })).toEqual([3]);
      expect(nus({ situacao: "REGISTRADO" })).toEqual([1, 3, 5]);
      expect(nus({ pendencia: "prazo_vencido" })).toEqual([1, 2]);
      expect(nus({ busca: "jose" })).toEqual([5]);
      expect(nus({ busca: "C3" })).toEqual([3]);
      expect(nus({})).toEqual([1, 2, 3, 4, 5]);
    });

    it("opções: editais do mais novo, origens ativas ou em uso, analistas ordenados", () => {
      const opcoes = opcoesDosFiltros(enriquecidos());
      expect(opcoes.origens.map((o) => o.valor)).toEqual([
        "analise-curricular",
        "entrevista",
        "resultado-final",
      ]);
      expect(opcoes.analistas.map((a) => a.valor)).toEqual([
        "Ana",
        "Sem analista",
      ]);
      expect(["30/2026", "105/2026", "07/2025"].sort(compararEditais)).toEqual([
        "105/2026",
        "30/2026",
        "07/2025",
      ]);
    });

    it("opções de edital: ordem pelo número do edital, não pelo rótulo com a unidade", () => {
      const recurso = (edital_id, edital, unidade) => ({
        edital_id,
        edital,
        unidade,
      });
      const opcoes = opcoesDosFiltros([
        recurso("e1", "5/2026", "DSEI A"),
        recurso("e2", "30/2025", "DSEI B"),
        recurso("e3", "7/2026", ""),
      ]);
      expect(opcoes.editais).toEqual([
        { valor: "e3", rotulo: "7/2026" },
        { valor: "e1", rotulo: "5/2026 · DSEI A" },
        { valor: "e2", rotulo: "30/2025 · DSEI B" },
      ]);
    });
  });

  describe("gráficos", () => {
    it("por analista, situação, impacto e esteira", () => {
      const todos = enriquecidos();
      expect(recursosPorAnalista(todos)).toEqual([
        { rotulo: "Ana", total: 4, pendentes: 2, concluidos: 2 },
        { rotulo: "Sem analista", total: 1, pendentes: 1, concluidos: 0 },
      ]);
      // Registrado, em análise jurídica, deferido, deferido parcialmente, indeferido.
      expect(recursosPorSituacao(todos).map((s) => s.valor)).toEqual([
        3, 0, 1, 0, 1,
      ]);
      expect(impactoNoResultado(todos).map((i) => i.valor)).toEqual([1, 1, 3]);
      expect(esteiraDosRecursos(todos).map((e) => e.valor)).toEqual([
        5, 1, 3, 1, 1,
      ]);
    });
  });

  describe("duplicado e formulário", () => {
    it("acha outro em análise do mesmo candidato, edital e origem", () => {
      const todos = enriquecidos();
      expect(
        recursoDuplicado(todos, {
          editalId: "e1",
          origem: "analise-curricular",
          analiseId: "a1",
        })?.nu,
      ).toBe(1);
      // Outra origem ou já decidido: não é duplicado.
      expect(
        recursoDuplicado(todos, {
          editalId: "e1",
          origem: "entrevista",
          analiseId: "a1",
        }),
      ).toBeNull();
      expect(
        recursoDuplicado(todos, {
          editalId: "e1",
          origem: "analise-curricular",
          analiseId: "a2",
        }),
      ).toBeNull();
      // Fora das análises: pelo nome, sem acento.
      expect(
        recursoDuplicado(todos, {
          editalId: "e1",
          origem: "resultado-final",
          nomeInformado: " jose da  silva",
        })?.nu,
      ).toBe(5);
    });

    it("valida o rascunho e monta o p_dados do banco", () => {
      expect(errosDoRascunho(RASCUNHO_VAZIO)).toEqual({
        edital_id: "Escolha o edital.",
        origem: "Escolha a origem do recurso.",
        candidato: "Escolha o candidato na lista das análises.",
      });
      const fora = {
        ...RASCUNHO_VAZIO,
        edital_id: "e1",
        origem: "entrevista",
        fora_analise: true,
        nome_informado: "Jo",
      };
      expect(Object.keys(errosDoRascunho(fora))).toEqual(["nome_informado"]);
      const rascunho = {
        ...RASCUNHO_VAZIO,
        edital_id: "e1",
        origem: "entrevista",
        analise: { id: "a9" },
        analista: " Bia ",
        processo_sei: " 1 ",
      };
      expect(errosDoRascunho(rascunho)).toEqual({});
      expect(dadosParaSalvar(rascunho)).toEqual({
        edital_id: "e1",
        fora_analise: false,
        analise_id: "a9",
        permitir_duplicado: false,
        origem: "entrevista",
        analista: "Bia",
        processo_sei: "1",
        observacao: "",
      });
      // A marca "mudou a classificação" é automática (ajuste aprovado): não vai no salvar.
      expect(
        dadosParaSalvar({ ...rascunho, mudou_classificacao: true }),
      ).not.toHaveProperty("mudou_classificacao");
      expect(dadosParaSalvar(rascunho, { id: "r1", revisao: 3 })).toMatchObject(
        {
          id: "r1",
          revisao: 3,
          origem: "entrevista",
        },
      );
      expect(dadosParaSalvar(rascunho, { id: "r1" })).not.toHaveProperty(
        "edital_id",
      );
    });
  });

  describe("CSV", () => {
    it("cabeçalho, ; e BOM, com célula protegida contra fórmula", () => {
      const [r1] = enriquecidos();
      const csv = csvDosRecursos([
        { ...r1, candidato: "=HYPERLINK(1)", analista: "Ana; Bia" },
      ]);
      expect(csv.startsWith("\uFEFFNº;Edital;Unidade;Origem;")).toBe(true);
      expect(csv).toContain(";'=HYPERLINK(1);");
      expect(csv).toContain(';"Ana; Bia";');
      expect(csv).toContain(";06/05/2026;Sim;10;10/05/2026");
    });
  });
});

bloco("resposta-do-recurso", () => {
  /*
  A máquina de estados da resposta ao recurso e quem pode fazer cada
  transição — o espelho das regras de transicionar_resposta_recurso (o ensaio
  em produção, begin…rollback, conferiu o banco caso a caso).
*/

  const AUTORA = "u-autora";
  const REVISOR = "u-revisor";
  const resposta = (extra = {}) => ({
    id: "resp1",
    estado: "rascunho",
    revisao: 1,
    passou_revisao: false,
    autor_id: AUTORA,
    envio_revisao_por_id: null,
    modelo_situacao: "DEFERIDO",
    ...extra,
  });
  const contexto = (extra = {}) => ({
    resposta: resposta(),
    eu: AUTORA,
    podeEditar: true,
    podeDecidir: true,
    situacao: "DEFERIDO",
    ...extra,
  });

  it("ignora nomes herdados de objeto como transições da resposta", () => {
    for (const acao of ["constructor", "toString", "__proto__"]) {
      expect(proximoEstado("rascunho", acao)).toBeNull();
      expect(avaliarAcao(acao, contexto())).toEqual({
        permitida: false,
        motivo: "Ação desconhecida.",
      });
    }
  });

  describe("estados e transições", () => {
    it.each([
      ["rascunho", "enviar_revisao", "em_revisao"],
      ["devolvida", "enviar_revisao", "em_revisao"],
      ["rascunho", "aprovar", "aprovada"],
      ["em_revisao", "aprovar", "aprovada"],
      ["em_revisao", "devolver", "devolvida"],
      ["aprovada", "reabrir", "rascunho"],
      ["aprovada", "marcar_enviada", "enviada"],
      ["enviada", "reabrir", null],
      ["enviada", "aprovar", null],
      ["devolvida", "aprovar", null],
      ["rascunho", "devolver", null],
      ["em_revisao", "marcar_enviada", null],
      ["rascunho", "inventada", null],
    ])("%s --%s--> %s", (de, acao, para) => {
      expect(proximoEstado(de, acao)).toBe(para);
    });

    it("o texto só muda em rascunho, devolvida ou sem resposta", () => {
      expect(podeEditarTexto(null)).toBe(true);
      expect(podeEditarTexto({ estado: "rascunho" })).toBe(true);
      expect(podeEditarTexto({ estado: "devolvida" })).toBe(true);
      for (const estado of ["em_revisao", "aprovada", "enviada"])
        expect(podeEditarTexto({ estado })).toBe(false);
    });
  });

  describe("permissões", () => {
    it("quem só lê não faz nada", () => {
      for (const acao of Object.keys(ACOES_DA_RESPOSTA))
        expect(avaliarAcao(acao, contexto({ podeEditar: false }))).toEqual({
          permitida: false,
          motivo: "Sem permissão para responder.",
        });
    });

    it("sem resposta salva, nenhuma transição", () => {
      expect(avaliarAcao("aprovar", contexto({ resposta: null })).motivo).toBe(
        "Salve o rascunho primeiro.",
      );
    });

    it("revisão opcional: a autora aprova o próprio rascunho que nunca foi à revisão", () => {
      expect(avaliarAcao("aprovar", contexto()).permitida).toBe(true);
    });

    it("em revisão, nem a autora nem quem enviou aprova; outra pessoa, sim", () => {
      const emRevisao = resposta({
        estado: "em_revisao",
        passou_revisao: true,
        envio_revisao_por_id: "u-envio",
      });
      expect(
        avaliarAcao("aprovar", contexto({ resposta: emRevisao })).permitida,
      ).toBe(false);
      expect(
        avaliarAcao("aprovar", contexto({ resposta: emRevisao, eu: "u-envio" }))
          .permitida,
      ).toBe(false);
      expect(
        avaliarAcao("aprovar", contexto({ resposta: emRevisao, eu: REVISOR })),
      ).toEqual({ permitida: true, motivo: "" });
    });

    it("depois de passar pela revisão, a autora não aprova direto do rascunho", () => {
      const corrigida = resposta({ estado: "rascunho", passou_revisao: true });
      expect(
        avaliarAcao("aprovar", contexto({ resposta: corrigida })).motivo,
      ).toMatch(/não pode aprová-la/);
      expect(
        avaliarAcao("aprovar", contexto({ resposta: corrigida, eu: REVISOR }))
          .permitida,
      ).toBe(true);
    });

    it("a autora não devolve a própria resposta", () => {
      const emRevisao = resposta({
        estado: "em_revisao",
        passou_revisao: true,
      });
      expect(
        avaliarAcao("devolver", contexto({ resposta: emRevisao })).permitida,
      ).toBe(false);
      expect(
        avaliarAcao("devolver", contexto({ resposta: emRevisao, eu: REVISOR }))
          .permitida,
      ).toBe(true);
    });

    it("aprovar exige o recurso decidido e com a situação do modelo", () => {
      expect(
        avaliarAcao("aprovar", contexto({ situacao: "EM_ANALISE_JURIDICA" }))
          .motivo,
      ).toMatch(/decisão do recurso/);
      expect(
        avaliarAcao("aprovar", contexto({ situacao: "REGISTRADO" })).motivo,
      ).toMatch(/decisão do recurso/);
      expect(
        avaliarAcao("aprovar", contexto({ situacao: "INDEFERIDO" })).motivo,
      ).toMatch(/situação do recurso não é a do modelo/);
    });

    it("com alteração não salva, não envia nem aprova", () => {
      expect(
        avaliarAcao("enviar_revisao", contexto({ alterada: true })).motivo,
      ).toBe("Salve as alterações antes.");
    });

    it("as ações oferecidas são as do estado atual", () => {
      expect(acoesDaResposta(contexto()).map((a) => a.acao)).toEqual([
        "enviar_revisao",
        "aprovar",
      ]);
      expect(
        acoesDaResposta(
          contexto({ resposta: resposta({ estado: "aprovada" }), eu: REVISOR }),
        ).map((a) => a.acao),
      ).toEqual(["reabrir", "marcar_enviada"]);
      expect(
        acoesDaResposta(
          contexto({ resposta: resposta({ estado: "enviada" }) }),
        ),
      ).toEqual([]);
    });

    it("aprovar e devolver são do parecer jurídico: sem ele, nem aparecem", () => {
      const semParecer = (extra) => contexto({ podeDecidir: false, ...extra });
      for (const acao of ["aprovar", "devolver"]) {
        expect(ACOES_DA_RESPOSTA[acao].juridico).toBe(true);
        expect(avaliarAcao(acao, semParecer()).motivo).toBe(
          "É do parecer jurídico.",
        );
      }
      expect(acoesDaResposta(semParecer()).map((a) => a.acao)).toEqual([
        "enviar_revisao",
      ]);
      // Aprovada: quem edita reabre ou marca enviada (o recurso está decidido).
      expect(
        acoesDaResposta(
          semParecer({ resposta: resposta({ estado: "aprovada" }) }),
        ).map((a) => [a.acao, a.permitida]),
      ).toEqual([
        ["reabrir", true],
        ["marcar_enviada", true],
      ]);
      expect(
        acoesDaResposta(
          semParecer({ resposta: resposta({ estado: "em_revisao" }) }),
        ),
      ).toEqual([]);
    });

    it("marcar enviada é de quem edita, mas só com o recurso decidido", () => {
      const aprovada = resposta({ estado: "aprovada" });
      const quemEdita = (situacao) =>
        avaliarAcao("marcar_enviada", {
          ...contexto({ resposta: aprovada, podeDecidir: false }),
          situacao,
        });
      expect(ACOES_DA_RESPOSTA.marcar_enviada.juridico).toBeUndefined();
      for (const situacao of [
        "DEFERIDO",
        "PARCIALMENTE_INDEFERIDO",
        "INDEFERIDO",
      ])
        expect(quemEdita(situacao).permitida).toBe(true);
      for (const situacao of ["REGISTRADO", "EM_ANALISE_JURIDICA"])
        expect(quemEdita(situacao)).toEqual({
          permitida: false,
          motivo: "O recurso não está decidido.",
        });
    });

    it("devolver e reabrir pedem comentário; aprovar, não", () => {
      expect(erroDoComentario("devolver", "  ")).toBe(
        "Diga o que precisa ser ajustado.",
      );
      expect(erroDoComentario("reabrir", "ok")).toBe("Informe o motivo.");
      expect(erroDoComentario("aprovar", "")).toBe("");
      expect(erroDoComentario("aprovar", "x".repeat(2001))).toMatch(/2.000/);
    });
  });
});

bloco("selecao-da-planilha", () => {
  /* O cabeçalho de hoje (A–Y), com as colunas que não entram (D, E, M–O, Q–S, W–Y). */
  const CABECALHO = [
    "Vaga",
    "Edital",
    "Nome da Unidade",
    "Nome do arquivo",
    "Resultado",
    "Inscritos",
    "Aptos para analise",
    "Cancelados",
    "Reprovados por não finalizar o questionário",
    "Eliminados por nota",
    "Reprovados na Análise",
    "Triados",
    "Reprovados Segunda Extração",
    "Triados Segunda Extração",
    "OUTROS ELIMINADOS",
    "Total de Eliminados",
    "Validação Total de Inscritos",
    "Validação Total de Aptos",
    "Validação Aptos + Eliminados = Inscritos",
    "Observação",
    "Nome do cargo",
    "Total convocados para entrevista",
    "Total de Aprovados",
    "Total de Contratados",
    "Total de não contratados",
  ];

  const linha = (campos) => {
    const l = Array(CABECALHO.length).fill("");
    for (const [coluna, valor] of Object.entries(campos))
      l[CABECALHO.indexOf(coluna)] = valor;
    return l;
  };

  describe("números da planilha (pt-BR)", () => {
    it.each([
      ["83", 83],
      ["1.234", 1234],
      ["732,00", 732],
      ["19,6", 20],
      ["-1", -1],
      ["", null],
      ["OK", null],
    ])("%s → %s", (bruto, esperado) => {
      expect(inteiroPtBr(bruto)).toBe(esperado);
    });
  });

  describe("chave da vaga (a mesma regra do banco)", () => {
    it("edital sem zero à esquerda e sem complemento", () => {
      expect(chaveDoEdital("06/2026")).toBe("6/2026");
      expect(chaveDoEdital("39/2026 (sanitarista)")).toBe("39/2026");
      expect(chaveDoEdital("FGV 2025")).toBe("fgv 2025");
    });

    it("código da vaga, ou o nome do cargo nas outras bancas", () => {
      expect(chaveDaVaga("03/2025", "104123")).toBe("3/2025|104123");
      expect(chaveDaVaga("96/2025", "CARGO 1: MÉDICO")).toBe(
        "96/2025|cargo:cargo 1: medico",
      );
    });
  });

  describe("aba Resultado -> linhas da carga", () => {
    it("lê só as colunas pedidas, com números inteiros", () => {
      const [vaga] = linhasDaAbaResultado([
        CABECALHO,
        linha({
          Vaga: "104123",
          Edital: "03/2025",
          "Nome da Unidade": "DSEI Alto Rio Solimões",
          "Nome do arquivo": "Vaga_104123_TSB",
          Inscritos: "83",
          "Aptos para analise": "72",
          Cancelados: "2",
          "Reprovados por não finalizar o questionário": "9",
          "Reprovados na Análise": "3",
          Triados: "69",
          "Triados Segunda Extração": "999",
          "Total de Eliminados": "11,00",
          Observação: "1 Interessado",
          "Nome do cargo": "Técnico de Saúde Bucal (TSB)",
          "Total convocados para entrevista": "0",
          "Total de Aprovados": "69",
          "Total de Contratados": "1",
        }),
      ]);
      expect(vaga).toEqual({
        edital: "03/2025",
        vaga: "104123",
        unidade: "DSEI Alto Rio Solimões",
        cargo: "Técnico de Saúde Bucal (TSB)",
        observacao: "1 Interessado",
        inscritos: 83,
        aptos: 72,
        cancelados: 2,
        reprovados_questionario: 9,
        eliminados_nota: null,
        reprovados_analise: 3,
        triados: 69,
        total_eliminados: 11,
        convocados: 0,
        repeticao: 1,
      });
      // W, X e Y (aprovados/contratados) não vêm da planilha.
      expect(Object.keys(vaga)).not.toContain("aprovados");
    });

    it("outras bancas: cargo na coluna A, só inscritos e eliminados", () => {
      const [vaga] = linhasDaAbaResultado([
        CABECALHO,
        [
          "CARGO 1: MÉDICO ‐ UBS MÓVEL URUAÇU/GO",
          "96/2025",
          "Projeto Agora Tem Especialistas Caminhoneiros",
          "",
          "",
          "30",
        ],
      ]);
      expect(vaga).toMatchObject({
        vaga: "CARGO 1: MÉDICO ‐ UBS MÓVEL URUAÇU/GO",
        edital: "96/2025",
        inscritos: 30,
        aptos: null,
        total_eliminados: null,
        convocados: null,
      });
    });

    it("cópia idêntica entra uma vez; mesmo nome com números diferentes entra de novo", () => {
      const copia = linha({
        Vaga: "163604",
        Edital: "30/2026",
        Inscritos: "937",
      });
      const cargo = (inscritos) =>
        linha({
          Vaga: "CARGO 3: TÉCNICO",
          Edital: "96/2025",
          Inscritos: inscritos,
        });
      const linhas = linhasDaAbaResultado([
        CABECALHO,
        copia,
        [...copia],
        cargo("4"),
        cargo("8"),
        cargo("4"),
      ]);
      expect(linhas.map((l) => [l.vaga, l.inscritos, l.repeticao])).toEqual([
        ["163604", 937, 1],
        ["CARGO 3: TÉCNICO", 4, 1],
        ["CARGO 3: TÉCNICO", 8, 2],
      ]);
      expect(linhas.copias).toBe(2);
    });

    it("pula linha sem vaga ou sem edital e aceita linha cortada pela API", () => {
      const linhas = linhasDaAbaResultado([
        CABECALHO,
        ["", "03/2025", "X", "", "", "5"],
        ["104", "", "X", "", "", "5"],
        ["105", "03/2025"],
      ]);
      expect(linhas).toHaveLength(1);
      expect(linhas[0]).toMatchObject({
        vaga: "105",
        inscritos: null,
        unidade: "",
      });
    });

    it("coluna de nome parecido não é confundida (Triados x Triados Segunda Extração)", () => {
      const sem = CABECALHO.filter((c) => c !== "Triados");
      const [vaga] = linhasDaAbaResultado([
        sem,
        sem.map(
          (c) =>
            ({
              Vaga: "1",
              Edital: "1/2026",
              Inscritos: "3",
              "Triados Segunda Extração": "7",
            })[c] ?? "",
        ),
      ]);
      expect(vaga.triados).toBeNull();
    });

    it("recusa aba sem coluna obrigatória e devolve vazio sem dados", () => {
      expect(() =>
        linhasDaAbaResultado([
          ["Vaga", "Edital"],
          ["1", "1/2026"],
        ]),
      ).toThrow(/inscritos/);
      expect(linhasDaAbaResultado([CABECALHO])).toEqual([]);
      expect(linhasDaAbaResultado(null)).toEqual([]);
    });

    it("a planilha da Auditoria está no catálogo", () => {
      expect(PLANILHAS.auditoriaDaSelecao.idGoogle).toMatch(
        /^[A-Za-z0-9_-]{10,}$/,
      );
      expect(PLANILHAS.auditoriaDaSelecao.aba).toBe("Resultado");
    });
  });
});

bloco("textos-do-painel-de-analises", () => {
  describe("município/UF da vaga", () => {
    it("lê o município e a UF da UBS móvel", () => {
      expect(
        municipioUfDaVaga(
          "Cargo 2: Enfermeiro - Responsável Técnico - UBS móvel Seropédica/RJ - Cadastro Reserva",
        ),
      ).toBe("Seropédica/RJ");
      expect(
        municipioUfDaVaga(
          "Cargo 1: Médico - UBS movel Cubatão/SP - Projeto Agora tem Especialistas",
        ),
      ).toBe("Cubatão/SP");
    });

    it("devolve null quando a vaga não diz onde fica", () => {
      expect(municipioUfDaVaga("Enfermeiro - DSEI Yanomami")).toBeNull();
      expect(municipioUfDaVaga("UBS móvel Irati/pr")).toBeNull();
      expect(municipioUfDaVaga(null)).toBeNull();
    });

    it("usa o do payload e, sem ele, o do nome da vaga; na Saúde Indígena, nada", () => {
      const linha = { nome_vaga: "Técnico - UBS móvel Palhoça/SC - CR" };
      expect(municipioUfDaLinha(linha, "projetos")).toBe("Palhoça/SC");
      expect(
        municipioUfDaLinha({ ...linha, municipio_uf: "Irati/PR" }, "projetos"),
      ).toBe("Irati/PR");
      expect(municipioUfDaLinha(linha, "saude-indigena")).toBeNull();
    });
  });

  describe("parecer sob demanda", () => {
    it("sabe quando a linha veio sem o parecer", () => {
      expect(linhaSemParecer({ id: "1" })).toBe(true);
      expect(linhaSemParecer({ id: "1", analise: null })).toBe(false);
      expect(linhaSemParecer({ id: "1", analise: "Apto" })).toBe(false);
      expect(haLinhasSemParecer([{ analise: "" }, { id: "2" }])).toBe(true);
      expect(haLinhasSemParecer([{ analise: "" }])).toBe(false);
      expect(haLinhasSemParecer(null)).toBe(false);
    });

    it("monta o mapa pelos nomes das colunas", () => {
      const mapa = mapaDosTextos({
        columns: ["id", "analise", "link_pdf", "experiencia_profissional_anos"],
        rows: [
          ["a", "Apto", "https://pdf/a", 2],
          ["b", "  texto com espaço  ", null, null],
          [null, "sem id", null, null],
        ],
      });
      expect([...mapa]).toEqual([
        [
          "a",
          {
            analise: "Apto",
            link_pdf: "https://pdf/a",
            experiencia_profissional_anos: 2,
          },
        ],
        [
          "b",
          {
            analise: "  texto com espaço  ",
            link_pdf: null,
            experiencia_profissional_anos: null,
          },
        ],
      ]);
      // O payload antigo, só com o parecer, continua servindo.
      expect(
        mapaDosTextos({ columns: ["id", "analise"], rows: [["a", "X"]] }).get(
          "a",
        ),
      ).toEqual({ analise: "X" });
      expect(mapaDosTextos({ columns: ["id"], rows: [["a"]] }).size).toBe(0);
      expect(mapaDosTextos(null).size).toBe(0);
    });

    it("põe o parecer e o que veio junto só nas linhas sem ele, e null para quem não tem no banco", () => {
      const linhas = [
        { id: "a", link_pdf: "já tinha" },
        { id: "b" },
        { id: "c", analise: "já veio" },
      ];
      const mapa = new Map([
        [
          "a",
          {
            analise: "Apto",
            link_pdf: "novo",
            experiencia_profissional_total: 30,
          },
        ],
      ]);
      const alteradas = mesclarTextos(linhas, mapa);
      expect(alteradas).toEqual([linhas[0], linhas[1]]);
      expect(linhas.map((linha) => linha.analise)).toEqual([
        "Apto",
        null,
        "já veio",
      ]);
      // Campo que a linha já tem não é trocado.
      expect(linhas[0].link_pdf).toBe("já tinha");
      expect(linhas[0].experiencia_profissional_total).toBe(30);
      expect(mesclarTextos(linhas, mapa)).toEqual([]);
    });

    it("lê o parecer do detalhe", () => {
      expect(parecerDoDetalhe({ id: "a", analise: "Apto" })).toBe("Apto");
      expect(parecerDoDetalhe([{ id: "a", analise: "Apto" }])).toBe("Apto");
      expect(parecerDoDetalhe({ id: "a", analise: null })).toBeNull();
      expect(parecerDoDetalhe(null)).toBeNull();
    });
  });
});
