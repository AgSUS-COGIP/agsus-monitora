/*
  Situação dos módulos (sistema, áreas e abas) para a tela — sem DOM.

  O banco guarda, em quatro níveis, se cada coisa está ATIVA ou em
  MANUTENCAO (migration `20260930140000_modulos_e_manutencao.sql`):
    - o sistema inteiro e cada área: `obter_situacao_do_sistema()`;
    - cada aba (em todas as áreas) e cada aba numa área: `listar_abas_do_menu()`
      (o catálogo chega ao menu por `abasDoCatalogo`, em `menu-lateral.js`,
      já com `manutencao` na aba e na área dela).
  Área desativada some do menu; aba desativada nem chega no catálogo.

  A situação EFETIVA de uma página (área, aba) segue a precedência
  sistema > área > aba em todas as áreas > aba nesta área: a mensagem e a
  previsão mostradas são as do nível mais alto em manutenção.

  O liga/desliga das comemorações (`sistema.comemoracoes`) vem junto, em
  `comemoracoes`.

  Sem resposta do banco (erro de rede, função ainda não publicada), vale
  `SITUACAO_PADRAO`: tudo ativo (e comemorações desligadas). A tela nunca
  tranca ninguém por falha de rede.
*/
import { comemoracoesLigadasNaResposta } from "./comemoracao.js";

export const ATIVA = "ATIVA";
export const MANUTENCAO = "MANUTENCAO";

export const MENSAGEM_PADRAO_DE_MANUTENCAO =
  "Esta parte do MONITORA está passando por manutenção. Tente de novo mais tarde.";

const texto = (valor) => String(valor ?? "").trim();
const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})/;

/** Data `aaaa-mm-dd` (o que o banco manda em `date`) ou `null`. */
export function dataDaPrevisao(valor) {
  const achado = DATA_ISO.exec(texto(valor));
  return achado ? `${achado[1]}-${achado[2]}-${achado[3]}` : null;
}

/** `aaaa-mm-dd` → `dd/mm/aaaa`; o resto, vazio. */
export function formatarPrevisao(valor) {
  const data = dataDaPrevisao(valor);
  if (!data) return "";
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

/**
 * A manutenção de uma linha (situação, mensagem, previsão), ou `null` quando
 * a linha está ativa. É o formato que o catálogo do menu e a tela usam.
 */
export function manutencaoDaLinha(situacao, mensagem, previsao) {
  if (texto(situacao).toUpperCase() !== MANUTENCAO) return null;
  return Object.freeze({
    mensagem: texto(mensagem),
    previsao: dataDaPrevisao(previsao),
  });
}

export const SITUACAO_PADRAO = Object.freeze({
  carregada: false,
  adminGlobal: false,
  /* Sem resposta do banco, comemoração nenhuma (src/lib/comemoracao.js). */
  comemoracoes: false,
  sistema: null,
  areas: Object.freeze([]),
});

/**
 * A resposta de `obter_situacao_do_sistema` no formato da tela. Resposta que
 * não é objeto vira `SITUACAO_PADRAO` (tudo ativo).
 */
export function normalizarSituacaoDoSistema(dados) {
  if (!dados || typeof dados !== "object" || Array.isArray(dados))
    return SITUACAO_PADRAO;
  const sistema = dados.sistema || {};
  const areas = (Array.isArray(dados.areas) ? dados.areas : [])
    .map((area) => ({
      id: texto(area?.co_area),
      ativo: area?.ativo !== false,
      manutencao: manutencaoDaLinha(
        area?.situacao,
        area?.mensagem,
        area?.previsao,
      ),
    }))
    .filter((area) => area.id)
    .map((area) => Object.freeze(area));
  return Object.freeze({
    carregada: true,
    adminGlobal: dados.admin_global === true,
    comemoracoes: comemoracoesLigadasNaResposta(dados),
    sistema: manutencaoDaLinha(
      sistema.situacao,
      sistema.mensagem,
      sistema.previsao,
    ),
    areas: Object.freeze(areas),
  });
}

const areaDa = (situacao, area) =>
  (situacao?.areas || []).find((item) => item.id === texto(area)) || null;

/** Área desconhecida (ou sem situação carregada) conta como ativa. */
export function areaEstaAtiva(situacao, area) {
  return areaDa(situacao, area)?.ativo !== false;
}

export function filtrarAreasAtivas(areas, situacao) {
  return (Array.isArray(areas) ? areas : []).filter((area) =>
    areaEstaAtiva(situacao, area),
  );
}

export function manutencaoDaArea(situacao, area) {
  return areaDa(situacao, area)?.manutencao || null;
}

/*
  A aba de uma página: a que tem, na área, essa view (a da área, se ela
  troca; senão, a da aba). Sem área que bata — página aberta sem área —, a
  aba de mesma view, sem o recorte da área.
*/
export function abaDaPagina(abas, view, area) {
  const lista = Array.isArray(abas) ? abas : [];
  const alvo = texto(view);
  if (!alvo) return null;
  for (const aba of lista) {
    const naArea = (aba.areas || []).find((item) => item.area === texto(area));
    if (naArea && (naArea.view || aba.view) === alvo) return { aba, naArea };
  }
  const aba = lista.find((item) => item.view === alvo);
  return aba ? { aba, naArea: null } : null;
}

/**
 * A manutenção que vale para a página (view) na área, ou `null`. O sistema em
 * manutenção vale para toda página; área e aba, só para as abas do catálogo
 * (Configurações e painéis externos não são abas).
 *
 * Devolve `{ origem, mensagem, previsao }`, com `origem` em
 * 'sistema' | 'area' | 'aba' | 'aba_area'.
 */
export function situacaoEfetiva({
  situacao = SITUACAO_PADRAO,
  abas = [],
  view,
  area,
} = {}) {
  const comOrigem = (origem, manutencao) => ({
    origem,
    mensagem: manutencao.mensagem || "",
    previsao: manutencao.previsao || null,
  });
  if (situacao?.sistema) return comOrigem("sistema", situacao.sistema);
  const encontrada = abaDaPagina(abas, view, area);
  if (!encontrada) return null;
  const daArea = encontrada.naArea ? manutencaoDaArea(situacao, area) : null;
  if (daArea) return comOrigem("area", daArea);
  if (encontrada.aba.manutencao)
    return comOrigem("aba", encontrada.aba.manutencao);
  if (encontrada.naArea?.manutencao)
    return comOrigem("aba_area", encontrada.naArea.manutencao);
  return null;
}

/** O que a tela de manutenção mostra (título, mensagem e previsão). */
export function textosDaManutencao(efetiva) {
  const previsao = formatarPrevisao(efetiva?.previsao);
  return {
    titulo: "Em manutenção",
    mensagem: texto(efetiva?.mensagem) || MENSAGEM_PADRAO_DE_MANUTENCAO,
    previsao: previsao ? `Previsão de volta: ${previsao}` : "",
  };
}

/** A faixa que o administrador global vê no lugar da tela de manutenção. */
export function textoDaFaixaDoAdministrador(efetiva) {
  if (!efetiva) return "";
  const previsao = formatarPrevisao(efetiva.previsao);
  const quem =
    efetiva.origem === "sistema"
      ? "O sistema inteiro está em manutenção para os demais usuários"
      : "Em manutenção para os demais usuários";
  return previsao ? `${quem} (previsão de volta: ${previsao}).` : `${quem}.`;
}

/** Dica do indicador de manutenção no menu. */
export function dicaDaManutencao(manutencao) {
  if (!manutencao) return "";
  const previsao = formatarPrevisao(manutencao.previsao);
  return [
    "Em manutenção",
    texto(manutencao.mensagem),
    previsao ? `Previsão de volta: ${previsao}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
