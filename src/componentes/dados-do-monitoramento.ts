import type {
  LinhaDoMonitoramento,
  SnapshotDoMonitoramento,
} from "./tipos-do-monitoramento.ts";
import {
  identificacaoDoMonitoramento,
  normalizarLinhasDoMonitoramento,
  normalizarUnidadesDoCatalogo,
} from "../lib/linhas-do-monitoramento.ts";

/*
  Os dados de monitoramento que o app carrega, para os componentes React.

  A carga é de src/app/carga.js: as linhas de `TB_MONITORAMENTO_INDIGENA`
  (`carregarLinhas`) alimentam o mapa, a Visão geral e os editais do Núcleo, e
  o catálogo `TD_UNIDADE` (`carregarUnidades`) alimenta o formulário do
  edital. Ela só empurra o resultado para cá; os componentes leem com
  `useSyncExternalStore`. Este arquivo não importa React.

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

const ESTADO_INICIAL: SnapshotDoMonitoramento = Object.freeze({
  linhas: Object.freeze([]),
  unidades: Object.freeze([]),
  /** Falso até a primeira carga: "ainda não chegou" não é "não há editais". */
  carregado: false,
  /** Até o perfil chegar, a área de todo mundo; `definirAreasDoUsuario` corrige. */
  areas: Object.freeze([AREA_SAUDE_INDIGENA]),
  areaAtual: AREA_SAUDE_INDIGENA,
});

const texto = (valor: unknown) =>
  typeof valor === "string" ? valor.trim() : "";

function lerAreaGuardada() {
  try {
    return texto(window.sessionStorage.getItem(CHAVE_AREA_ATUAL));
  } catch {
    return "";
  }
}

function guardarArea(area: string) {
  try {
    window.sessionStorage.setItem(CHAVE_AREA_ATUAL, area);
  } catch {
    // Sem armazenamento (janela privada, bloqueio): só não lembra ao recarregar.
  }
}

let estado: SnapshotDoMonitoramento = {
  ...ESTADO_INICIAL,
  areaAtual: lerAreaGuardada() || ESTADO_INICIAL.areaAtual,
};
const ouvintes = new Set<() => void>();

function publicar(mudancas: Partial<SnapshotDoMonitoramento>) {
  estado = { ...estado, ...mudancas };
  for (const ouvinte of ouvintes) ouvinte();
}

export function assinarDadosDoMonitoramento(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function obterDadosDoMonitoramento() {
  return estado;
}

export function publicarLinhasDoMonitoramento(linhas: unknown) {
  publicar({
    linhas: normalizarLinhasDoMonitoramento(linhas),
    carregado: true,
  });
}

/*
  A pessoa saiu (ou ficou sem acesso): as linhas dela saem da memória e o
  store volta a "ainda não carregou". A área fica: é da aba, e quem entrar a
  corrige pelas áreas dele (`definirAreasDoUsuario`).
*/
export function esquecerLinhasDoMonitoramento() {
  publicar({ linhas: ESTADO_INICIAL.linhas, carregado: false });
}

export function publicarUnidadesDoCatalogo(unidades: unknown) {
  publicar({ unidades: normalizarUnidadesDoCatalogo(unidades) });
}

/*
  As áreas do usuário (já normalizadas por `areasDoUsuario`, de
  `menu-lateral.ts`). A área atual continua a mesma se o usuário a tem; senão,
  vira a primeira dele — é o padrão de quem acabou de entrar.
*/
export function definirAreasDoUsuario(areas: unknown) {
  const lista = (Array.isArray(areas) ? areas : []).map(texto).filter(Boolean);
  const proximas = lista.length ? lista : [AREA_SAUDE_INDIGENA];
  const areaAtual = proximas.includes(estado.areaAtual)
    ? estado.areaAtual
    : (proximas[0] ?? AREA_SAUDE_INDIGENA);
  guardarArea(areaAtual);
  publicar({ areas: proximas, areaAtual });
}

export function definirAreaAtual(area: string) {
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
export function areaDaLinha(linha: LinhaDoMonitoramento | null | undefined) {
  if (linha?.CO_AREA) return texto(linha.CO_AREA);
  return ehEditalDaSaudeIndigena(linha) ? AREA_SAUDE_INDIGENA : "";
}

export function linhasDaArea<T extends LinhaDoMonitoramento>(
  linhas: readonly T[] | null | undefined,
  area: string,
): T[] {
  return (Array.isArray(linhas) ? linhas : []).filter(
    (linha) => areaDaLinha(linha) === area,
  );
}

/* Os ids dos editais das linhas, em texto: o banco devolve número ou uuid. */
export function idsDasLinhas(
  linhas: readonly LinhaDoMonitoramento[] | null | undefined,
) {
  return new Set(
    (linhas || []).flatMap((linha) => {
      const id = identificacaoDoMonitoramento(linha?.id);
      return id === undefined ? [] : [String(id)];
    }),
  );
}

/*
  Cronograma e Lista de aprovados não trazem a área: trazem o edital (etapa,
  lista e candidato). O recorte é pelo conjunto de ids dos editais da área.
*/
/**
 * @template T
 * @param {readonly T[]} itens
 * @param {ReadonlySet<string>} ids
 * @param {keyof T} [campo]
 * @returns {T[]}
 */
export function soDosEditais<T extends object>(
  itens: readonly T[] | null | undefined,
  ids: ReadonlySet<string>,
  campo: keyof T = "edital_id" as keyof T,
): T[] {
  const lista: readonly T[] = Array.isArray(itens) ? itens : [];
  return lista.filter(
    (item) =>
      identificacaoDoMonitoramento(item?.[campo]) !== undefined &&
      ids.has(String(item?.[campo])),
  );
}

/* Só para os testes: volta ao estado de antes da primeira carga. */
export function redefinirDadosDoMonitoramento() {
  publicar(ESTADO_INICIAL);
}
