/*
  Os dados de monitoramento que o legado carrega, para os componentes React.

  `legacy-app.js` continua dono da carga: as linhas de
  `TB_MONITORAMENTO_INDIGENA` (`loadData`) alimentam o mapa, a tabela da Saúde
  Indígena e os editais do Núcleo, e o catálogo `TD_UNIDADE` (`loadUnidades`)
  alimenta o formulário do edital. Ele só empurra o resultado para cá; os
  componentes leem com `useSyncExternalStore`. Este arquivo não importa React:
  o legado pode importá-lo sem puxar o React para o grafo dele.
*/

const ESTADO_INICIAL = Object.freeze({
  linhas: Object.freeze([]),
  unidades: Object.freeze([]),
  /** Falso até a primeira carga: "ainda não chegou" não é "não há editais". */
  carregado: false,
});

let estado = ESTADO_INICIAL;
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

/* Só para os testes: volta ao estado de antes da primeira carga. */
export function redefinirDadosDoMonitoramento() {
  publicar(ESTADO_INICIAL);
}
