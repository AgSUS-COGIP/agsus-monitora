/*
  Os dados de monitoramento que o legado carrega, para os componentes React.

  `legacy-app.js` continua dono da carga: as linhas de
  `TB_MONITORAMENTO_INDIGENA` (`loadData`) alimentam o mapa, a tabela da Saúde
  Indígena e os editais do Núcleo, e o catálogo `TD_UNIDADE` (`loadUnidades`)
  alimenta o formulário do edital. Ele só empurra o resultado para cá; os
  componentes leem com `useSyncExternalStore`. Este arquivo não importa React:
  o legado pode importá-lo sem puxar o React para o grafo dele.

  Aqui também mora a ÁREA ATUAL (Saúde Indígena, SEDE ou Projetos): o menu tem
  um grupo por área, com as mesmas páginas em cada um, e Editais, Cronograma e
  Lista de aprovados mostram só o que é da área escolhida. O menu lateral a
  define no clique, antes de navegar; o legado a corrige quando as áreas do
  usuário chegam (`buildNav`); as telas leem daqui.
*/

import {
  AREA_SAUDE_INDIGENA,
  ehEditalDaSaudeIndigena,
} from "../lib/responsavel-do-edital.js";

/*
  Guardada na aba (sessionStorage): recarregar a página volta à mesma área,
  como já volta à mesma tela; outra aba começa na primeira área do usuário.
*/
const CHAVE_AREA_ATUAL = "agsus_monitora_area_atual_v1";

const ESTADO_INICIAL = Object.freeze({
  linhas: Object.freeze([]),
  unidades: Object.freeze([]),
  /** Falso até a primeira carga: "ainda não chegou" não é "não há editais". */
  carregado: false,
  /** Até o perfil chegar, a área de todo mundo; `definirAreasDoUsuario` corrige. */
  areas: Object.freeze([AREA_SAUDE_INDIGENA]),
  areaAtual: AREA_SAUDE_INDIGENA,
});

const texto = (valor) => String(valor ?? "").trim();

function lerAreaGuardada() {
  try {
    return texto(window.sessionStorage.getItem(CHAVE_AREA_ATUAL));
  } catch {
    return "";
  }
}

function guardarArea(area) {
  try {
    window.sessionStorage.setItem(CHAVE_AREA_ATUAL, area);
  } catch {
    // Sem armazenamento (janela privada, bloqueio): só não lembra ao recarregar.
  }
}

let estado = {
  ...ESTADO_INICIAL,
  areaAtual: lerAreaGuardada() || ESTADO_INICIAL.areaAtual,
};
const ouvintes = new Set();

function publicar(mudancas) {
  estado = { ...estado, ...mudancas };
  for (const ouvinte of ouvintes) ouvinte();
}

export function assinarDadosDoMonitoramento(ouvinte) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function obterDadosDoMonitoramento() {
  return estado;
}

export function publicarLinhasDoMonitoramento(linhas) {
  publicar({ linhas: Array.isArray(linhas) ? linhas : [], carregado: true });
}

export function publicarUnidadesDoCatalogo(unidades) {
  publicar({ unidades: Array.isArray(unidades) ? unidades : [] });
}

/*
  As áreas do usuário (já normalizadas por `areasDoUsuario`, de
  `menu-lateral.js`). A área atual continua a mesma se o usuário a tem; senão,
  vira a primeira dele — é o padrão de quem acabou de entrar.
*/
export function definirAreasDoUsuario(areas) {
  const lista = (Array.isArray(areas) ? areas : []).map(texto).filter(Boolean);
  const proximas = lista.length ? lista : [AREA_SAUDE_INDIGENA];
  const areaAtual = proximas.includes(estado.areaAtual)
    ? estado.areaAtual
    : proximas[0];
  guardarArea(areaAtual);
  publicar({ areas: proximas, areaAtual });
}

export function definirAreaAtual(area) {
  const proxima = texto(area);
  if (!proxima || proxima === estado.areaAtual) return;
  guardarArea(proxima);
  publicar({ areaAtual: proxima });
}

/*
  A área de uma linha: `CO_AREA`, que o banco calcula. Linha sem a coluna
  (cache offline de antes dela) só é reconhecida como Saúde Indígena, pela regra
  local de `ehEditalDaSaudeIndigena`; qualquer outra fica fora de todas as
  áreas, em vez de aparecer na área errada.
*/
export function areaDaLinha(linha) {
  if (linha?.CO_AREA) return texto(linha.CO_AREA);
  return ehEditalDaSaudeIndigena(linha) ? AREA_SAUDE_INDIGENA : "";
}

export function linhasDaArea(linhas, area) {
  return (Array.isArray(linhas) ? linhas : []).filter(
    (linha) => areaDaLinha(linha) === area,
  );
}

/* Os ids dos editais das linhas, em texto: o banco devolve número ou uuid. */
export function idsDasLinhas(linhas) {
  return new Set((linhas || []).map((linha) => String(linha?.id)));
}

/*
  Cronograma e Lista de aprovados não trazem a área: trazem o edital (etapa,
  lista e candidato). O recorte é pelo conjunto de ids dos editais da área.
*/
export function soDosEditais(itens, ids, campo = "edital_id") {
  return (Array.isArray(itens) ? itens : []).filter((item) =>
    ids.has(String(item?.[campo])),
  );
}

/* Só para os testes: volta ao estado de antes da primeira carga. */
export function redefinirDadosDoMonitoramento() {
  publicar(ESTADO_INICIAL);
}
