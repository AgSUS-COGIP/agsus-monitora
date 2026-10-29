/*
  O design system do MONITORA: toda tela React monta com estes componentes e
  os tokens de src/styles/tokens.css. Estilos em ui.css (importe uma vez, no
  ponto de entrada). Guia: docs/arquitetura-react.md, seção "Como usar ui/".
*/
export { Abas } from "./abas.tsx";
export type { AbaDaLista, PropriedadesDasAbas } from "./abas.tsx";
export { Aviso } from "./aviso.tsx";
export type { PropriedadesDoAviso } from "./aviso.tsx";
export { BotaoDeAcao } from "./botao-de-acao.tsx";
export {
  CaixaDeMarcarTodos,
  estadoDaMarcacao,
} from "./caixa-de-marcar-todos.tsx";
export type {
  EstadoDaMarcacao,
  PropriedadesDaCaixaDeMarcarTodos,
} from "./caixa-de-marcar-todos.tsx";
export { Campo } from "./campo.tsx";
export type { PropriedadesDoCampo } from "./campo.tsx";
export { CardDeGrafico } from "./card-de-grafico.tsx";
export type { PropriedadesDoCardDeGrafico } from "./card-de-grafico.tsx";
export { classes } from "./classes.ts";
export { Carregando, EstadoVazio } from "./estados.tsx";
export type { PropriedadesDoEstado } from "./estados.tsx";
export { ErroAoCarregar } from "./erro-ao-carregar.tsx";
export type { PropriedadesDoErroAoCarregar } from "./erro-ao-carregar.tsx";
export { BlocosEsqueleto, LinhasEsqueleto } from "./esqueleto.tsx";
export type {
  PropriedadesDasLinhasEsqueleto,
  PropriedadesDosBlocosEsqueleto,
} from "./esqueleto.tsx";
export { Gaveta, TopoDaGaveta, usarClassesDaGaveta } from "./gaveta.tsx";
export type {
  PropriedadesDaGaveta,
  PropriedadesDoTopoDaGaveta,
} from "./gaveta.tsx";
export { Grafico, paletaDosGraficos } from "./grafico.tsx";
export type {
  MontagemDoGrafico,
  PaletaDeReserva,
  PaletaDosGraficos,
  PropriedadesDoGrafico,
} from "./grafico.tsx";
export { GradeDeKpis, Kpi } from "./kpi.tsx";
export type { PropriedadesDaGradeDeKpis, PropriedadesDoKpi } from "./kpi.tsx";
export {
  LinhaDoRecorte,
  MarcasDoRecorte,
  textoDoRecorte,
} from "./linha-do-recorte.tsx";
export type {
  FiltroAtivo,
  MarcaDoRecorte,
  PropriedadesDaLinhaDoRecorte,
  PropriedadesDasMarcasDoRecorte,
} from "./linha-do-recorte.tsx";
export { ListaDePendencias } from "./lista-de-pendencias.tsx";
export type {
  Pendencia,
  PropriedadesDaListaDePendencias,
} from "./lista-de-pendencias.tsx";
export { MaisOpcoes } from "./mais-opcoes.tsx";
export type { PropriedadesDeMaisOpcoes } from "./mais-opcoes.tsx";
export { MenuDeAcoes } from "./menu-de-acoes.tsx";
export type {
  AcaoDoMenu,
  PropriedadesDoMenuDeAcoes,
} from "./menu-de-acoes.tsx";
export { Modal } from "./modal.tsx";
export type { PropriedadesDoModal } from "./modal.tsx";
export {
  CampoNomeDaVersao,
  NomeDaVersao,
  nomeDoCampo,
  RenomearVersao,
} from "./nome-da-versao.tsx";
export { Popover } from "./popover.tsx";
export { AvisoDeRascunho, SituacaoDoRascunho } from "./rascunho-guardado.tsx";
export {
  ChipDeFiltro,
  ChipsDeFiltro,
  PainelDeFiltros,
} from "./painel-de-filtros.tsx";
export type {
  PropriedadesDoChipDeFiltro,
  PropriedadesDosChipsDeFiltro,
  PropriedadesDoPainelDeFiltros,
} from "./painel-de-filtros.tsx";
export { GradeDeKv, Kv, Secao } from "./secao.tsx";
export type {
  PropriedadesDaGradeDeKv,
  PropriedadesDaSecao,
  PropriedadesDoKv,
} from "./secao.tsx";
export { Segmentado } from "./segmentado.tsx";
export type {
  OpcaoDoSegmentado,
  PropriedadesDoSegmentado,
} from "./segmentado.tsx";
export { Selo } from "./selo.tsx";
export type { PropriedadesDoSelo } from "./selo.tsx";
export { TabelaInfinita } from "./tabela-infinita.tsx";
export { LINHAS_POR_PAGINA, usarListaNoServidor } from "./lista-no-servidor.ts";
export type {
  BuscarPagina,
  ListaNoServidor,
  PaginaDoServidor,
} from "./lista-no-servidor.ts";
export type {
  BuscaDaTabela,
  ColunaDaTabela,
  GrupoDaTabela,
  PropriedadesDaTabelaInfinita,
  TabelaNoServidor,
} from "./tabela-infinita.tsx";
export { TopoDoPainel } from "./topo-do-painel.tsx";
export type { PropriedadesDoTopoDoPainel } from "./topo-do-painel.tsx";
