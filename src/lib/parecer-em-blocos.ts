/*
  Parecer de recurso montado em blocos (protótipo, docs/recursos/parecer-em-blocos.md).

  Espelha o "Sistema automatizado de elaboração de pareceres" que a equipe da
  Saúde Indígena usa (um HTML avulso): o cabeçalho, 1 Objeto, 2 Relatório,
  3 Admissibilidade, 4 Análise de mérito (requisitos eliminatórios e os blocos)
  e 5 Conclusão, com os gestores que assinam. A ordem das seções e os textos
  são os do simulador e viram o MODELO PADRÃO do parecer (TEXTOS_PADRAO), que
  o administrador poderá editar depois, como os modelos de resposta.

  Diferenças de propósito (todas listadas no doc):
  - cada bloco pertence a uma ETAPA (hoje só a Avaliação documental; a
    Entrevista entra depois, com blocos próprios, sem refazer a tela);
  - os números de item e anexo do edital ("6.4, alínea c", "8.12.2"…) não
    ficam no texto: vêm das referências do edital (Regras do edital), com os
    do simulador como padrão (REFERENCIAS_DO_EDITAL);
  - três palavras em inglês que escaparam no simulador (established,
    declared, confirmed) saem corrigidas (CORRECOES_DO_SIMULADOR).

  Sem DOM e sem estado: rascunho (JSON que o banco guardaria por versão) →
  documento (seções, parágrafos e listas, com trechos em negrito) → texto.
  A conta dos meses é a da ficha (diasDosIntervalos): dias corridos com o
  primeiro e o último, unidos, divididos por 30, só os inteiros.

  O código fica em src/lib/parecer-em-blocos/, um arquivo por assunto; este
  arquivo só reexporta a API pública (quem importa não precisa mudar).
*/

export {
  ETAPAS_DO_PARECER,
  etapaDoParecer,
  REFERENCIAS_DO_EDITAL,
  REFERENCIAS_PADRAO,
  referenciasDoEdital,
} from "./parecer-em-blocos/etapas-e-referencias.ts";
export type {
  EtapaDoParecer,
  DefinicaoDaEtapa,
  ChaveDaReferencia,
  DefinicaoDaReferencia,
  ReferenciasDoEdital,
  RegraParaOParecer,
  FonteDaReferencia,
} from "./parecer-em-blocos/etapas-e-referencias.ts";
export {
  TEXTOS_PADRAO,
  textosDoModelo,
  CORRECOES_DO_SIMULADOR,
} from "./parecer-em-blocos/modelo.ts";
export type {
  ChaveDoTexto,
  TextosDoModelo,
} from "./parecer-em-blocos/modelo.ts";
export {
  NIVEIS_DA_VAGA,
  TITULOS_POR_NIVEL,
  MOTIVOS_DA_FORMACAO,
  CRITERIOS_DA_EXPERIENCIA,
  QUADROS_DA_EXPERIENCIA,
  rotuloDoQuadro,
  TEMPOS_MINIMOS,
  OPCOES_DO_PCD,
  DOCUMENTOS_DA_ALDEIA,
  DOCUMENTOS_DO_QUILOMBOLA,
} from "./parecer-em-blocos/catalogos.ts";
export type {
  NivelDaVaga,
  TituloDaFormacao,
  MotivoDaFormacao,
  CriterioDaExperiencia,
  OpcaoDoPcd,
} from "./parecer-em-blocos/catalogos.ts";
export {
  CATALOGO_DE_BLOCOS,
  blocosDaEtapa,
  DECISOES,
  ASSINATURAS_PADRAO,
  novoIdDeExperiencia,
  novaExperiencia,
  blocoVazio,
  rascunhoVazio,
  blocoDo,
} from "./parecer-em-blocos/rascunho.ts";
export type {
  CodigoDoBloco,
  DefinicaoDoBloco,
  BlocoDeRequisitos,
  BlocoDeFormacao,
  ExperienciaDoParecer,
  BlocoDeExperiencia,
  BlocoDePcd,
  BlocoIndigena,
  BlocoQuilombola,
  BlocoDeHeteroidentificacao,
  BlocoDoParecer,
  Decisao,
  Assinatura,
  RascunhoDoParecer,
} from "./parecer-em-blocos/rascunho.ts";
export {
  DIAS_POR_MES,
  mesesDaExperiencia,
  totalSemSobreposicao,
  dataDoParecer,
  pontosDoParecer,
} from "./parecer-em-blocos/meses-e-formatacao.ts";
export {
  preencher,
  comporParecer,
  linhasDeTexto,
  textoDoParecer,
} from "./parecer-em-blocos/composicao.ts";
export type {
  Trecho,
  LinhaDoDocumento,
  DocumentoDoParecer,
} from "./parecer-em-blocos/composicao.ts";
export {
  ROTULO_DA_FONTE,
  dataEHoraDeBrasilia,
  rascunhoInicial,
  periodoDeInterposicao,
} from "./parecer-em-blocos/pre-preenchimento.ts";
export type {
  FonteDoCampo,
  FichaParaOParecer,
  DadosParaOParecer,
  FonteDoParecer,
} from "./parecer-em-blocos/pre-preenchimento.ts";
