/*
  A Visão geral de cada área, sem DOM nem rede.

  Saúde Indígena, SEDE e Projetos abrem a MESMA página (`dashboard`, no
  legado): indicadores, filtros, "Unidades com mais de um processo seletivo",
  resumo, gráfico, atenção e tabela, sempre com os editais da área atual. O
  que muda é o bloco "Visão nacional":

  - Saúde Indígena: o mapa dos DSEIs e CASAIs, com as Terras Indígenas, e a
    lista "Territórios por vagas" — como sempre foi;
  - Projetos: o mesmo mapa, sem nada da Saúde Indígena, com um ponto por
    município das vagas (UBS móvel no nome da vaga, RPC
    `listar_municipios_das_vagas_da_area`) e a lista "Municípios por vagas";
  - SEDE: sem o bloco — a equipe fica em Brasília.

  Aqui ficam essa escolha, os textos de cada bloco e a conta dos municípios.
  O desenho é de `src/modules/municipios-da-visao-geral.js` e do legado.
*/

import { coordenadasDoMunicipio } from "./coordenadas-dos-municipios.js";
import { nomeDaArea } from "./menu-lateral.js";
import { AREA_SAUDE_INDIGENA } from "./responsavel-do-edital.js";

const num = (valor) => {
  const numero = Number(valor || 0);
  return Number.isFinite(numero) ? numero : 0;
};
const texto = (valor) => String(valor ?? "").trim();

export const MAPA_DOS_DSEIS = "dsei";
export const MAPA_DOS_MUNICIPIOS = "municipios";

const MAPA_POR_AREA = Object.freeze({
  [AREA_SAUDE_INDIGENA]: MAPA_DOS_DSEIS,
  projetos: MAPA_DOS_MUNICIPIOS,
});

/** O mapa da Visão geral da área: `"dsei"`, `"municipios"` ou `""` (sem mapa). */
export function mapaDaVisaoGeral(area) {
  return MAPA_POR_AREA[texto(area)] ?? "";
}

/*
  Título e subtítulo do cabeçalho. A Saúde Indígena segue a configuração
  (`page_title`, `page_subtitle`: "Saúde Indígena", "Monitoramento
  DSEI/CASAI"); as outras áreas dizem o nome delas.
*/
export function cabecalhoDaVisaoGeral(
  area,
  { titulo = "", subtitulo = "" } = {},
) {
  if (texto(area) === AREA_SAUDE_INDIGENA) return { titulo, subtitulo };
  return {
    titulo: nomeDaArea(texto(area)) || titulo,
    subtitulo: "Monitoramento dos processos seletivos",
  };
}

/*
  Os textos do bloco do mapa, por tipo de mapa. Os da Saúde Indígena são os
  do `index.html`: trocar de área e voltar deixa o bloco como estava.
*/
export const TEXTOS_DO_MAPA = Object.freeze({
  [MAPA_DOS_DSEIS]: Object.freeze({
    area: "Mapas da rede de saúde indígena",
    titulo: "DSEIs / CASAIs do Brasil",
    mapa: "Mapa do Brasil com processos seletivos por DSEI, polos base e CASAI",
    lista: "Territórios por vagas",
    dica: "Escolha um DSEI no mapa para ver polos e unidades.",
  }),
  [MAPA_DOS_MUNICIPIOS]: Object.freeze({
    area: "Mapa dos municípios das vagas",
    titulo: "Municípios das vagas",
    mapa: "Mapa do Brasil com os municípios das vagas da área",
    lista: "Municípios por vagas",
    dica: "Clique num município para ver vagas, candidatos e o resultado das análises.",
  }),
});

export function textosDoMapa(mapa) {
  return TEXTOS_DO_MAPA[mapa] ?? TEXTOS_DO_MAPA[MAPA_DOS_DSEIS];
}

export const plural = (total, um, varios) =>
  `${num(total).toLocaleString("pt-BR")} ${num(total) === 1 ? um : varios}`;

// ── Municípios ───────────────────────────────────────────────────────────

/*
  A resposta de `listar_municipios_das_vagas_da_area`: uma linha por
  município, com as contagens. Normaliza números e descarta linha sem
  município.
*/
export function municipiosDaResposta(dados) {
  return (Array.isArray(dados) ? dados : [])
    .map((linha) => ({
      municipioUf: texto(linha?.municipio_uf),
      vagas: num(linha?.vagas),
      candidatos: num(linha?.candidatos),
      aprovados: num(linha?.aprovados),
      reprovados: num(linha?.reprovados),
    }))
    .filter((linha) => linha.municipioUf);
}

export const RAIO_MINIMO = 6;
export const RAIO_MAXIMO = 15;

/*
  Raio do ponto pela raiz do valor: a ÁREA do círculo cresce com as vagas,
  que é como o olho compara. O teto é o das bolhas dos DSEIs (15 px).
*/
export function raioDoPonto(valor, maior) {
  if (!(maior > 0) || !(valor > 0)) return RAIO_MINIMO;
  const proporcao = Math.sqrt(Math.min(valor, maior) / maior);
  return Math.round(RAIO_MINIMO + (RAIO_MAXIMO - RAIO_MINIMO) * proporcao);
}

/*
  O resultado das análises do município: a parte aprovada entre as já
  decididas (aprovados + reprovados). Sem nenhuma decidida, sem barra.
*/
export function resultadoDoMunicipio({ aprovados = 0, reprovados = 0 } = {}) {
  const decididos = num(aprovados) + num(reprovados);
  if (!decididos) return null;
  return { pct: Math.round((num(aprovados) / decididos) * 100), decididos };
}

/*
  Os municípios por vagas, decrescente (candidatos desempatam), cada um com a
  coordenada (ou `null`, se a tabela ainda não o tem) e o raio do ponto.
*/
export function pontosDosMunicipios(municipios) {
  const lista = [...(Array.isArray(municipios) ? municipios : [])].sort(
    (a, b) =>
      b.vagas - a.vagas ||
      b.candidatos - a.candidatos ||
      a.municipioUf.localeCompare(b.municipioUf, "pt-BR"),
  );
  const maior = Math.max(0, ...lista.map((item) => item.vagas));
  return lista.map((item) => {
    const lugar = coordenadasDoMunicipio(item.municipioUf);
    return {
      ...item,
      coordenadas: lugar ? [lugar.latitude, lugar.longitude] : null,
      raio: raioDoPonto(item.vagas, maior),
    };
  });
}
