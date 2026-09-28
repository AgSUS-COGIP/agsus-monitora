/*
  A Visão geral da SEDE e de Projetos, sem DOM nem rede.

  O desenho é de `src/componentes/visao-geral-da-area/`. Os números da faixa de
  indicadores são os mesmos da Saúde Indígena (`indicadores-do-monitoramento.js`)
  e as próximas etapas saem das próprias linhas dos editais
  (`editaisComEtapaNosProximosDias`, de `boas-vindas.js`). Aqui ficam a tabela
  dos editais da área e os pontos do mapa de municípios.
*/

import { chaveDoDia } from "./boas-vindas.js";
import { coordenadasDoMunicipio } from "./coordenadas-dos-municipios.js";
import { compararEditais } from "./editais-do-nucleo.js";
import { dataLocal } from "./etapas-de-edital.js";
import {
  ehEditalEncerrado,
  ehRiscoAtivo,
} from "./indicadores-do-monitoramento.js";

const num = (valor) => {
  const numero = Number(valor || 0);
  return Number.isFinite(numero) ? numero : 0;
};
const texto = (valor) => String(valor ?? "").trim();

/*
  Áreas com mapa de municípios. A SEDE não tem: a equipe dela fica em
  Brasília. Projetos tem, porque as vagas das UBS móveis dizem o município.
*/
export const AREAS_COM_MAPA_DE_MUNICIPIOS = Object.freeze(["projetos"]);

export function temMapaDeMunicipios(area) {
  return AREAS_COM_MAPA_DE_MUNICIPIOS.includes(texto(area));
}

// ── Tabela dos editais ───────────────────────────────────────────────────

/*
  Os editais da tabela: os em andamento primeiro, na fila do Núcleo (risco,
  depois vagas ociosas); os encerrados só quando pedidos. \`soCriticos\` é o
  filtro do indicador "Processos críticos".
*/
export function editaisDaTabela(
  linhas,
  { mostrarEncerrados = false, soCriticos = false } = {},
) {
  return (Array.isArray(linhas) ? linhas : [])
    .filter((linha) => !soCriticos || ehRiscoAtivo(linha))
    .filter((linha) => mostrarEncerrados || !ehEditalEncerrado(linha))
    .sort(
      (a, b) =>
        Number(ehEditalEncerrado(a)) - Number(ehEditalEncerrado(b)) ||
        compararEditais(a, b),
    );
}

/** Quantos editais encerrados a tabela esconde por padrão. */
export function contarEncerrados(linhas) {
  return (Array.isArray(linhas) ? linhas : []).filter(ehEditalEncerrado).length;
}

// ── Próximas etapas ──────────────────────────────────────────────────────

/** "Hoje", "Amanhã", "Em 3 dias" — da data AAAA-MM-DD em relação a hoje. */
export function quandoDaEtapa(data, hoje = new Date()) {
  const dia = dataLocal(texto(data).slice(0, 10));
  const referencia = dataLocal(chaveDoDia(hoje));
  if (!dia || !referencia) return "";
  const dias = Math.round((dia - referencia) / 86_400_000);
  if (dias <= 0) return "Hoje";
  if (dias === 1) return "Amanhã";
  return `Em ${dias} dias`;
}

/** "2026-09-30" → "30/09". */
export function diaEMes(data) {
  const [, mes, dia] = texto(data).slice(0, 10).split("-");
  return dia && mes ? `${dia}/${mes}` : "";
}

// ── Mapa de municípios ───────────────────────────────────────────────────

/*
  A resposta de \`listar_municipios_das_vagas_da_area\`: uma linha por
  município, com as contagens. Normaliza números e descarta linha sem
  município.
*/
export function municipiosDaResposta(dados) {
  return (Array.isArray(dados) ? dados : [])
    .map((linha) => ({
      municipioUf: texto(linha?.municipio_uf),
      municipio: texto(linha?.municipio),
      uf: texto(linha?.uf),
      vagas: num(linha?.vagas),
      candidatos: num(linha?.candidatos),
      aprovados: num(linha?.aprovados),
      reprovados: num(linha?.reprovados),
    }))
    .filter((linha) => linha.municipioUf);
}

export const RAIO_MINIMO = 8;
export const RAIO_MAXIMO = 24;

/*
  Raio do ponto pela raiz do valor: a ÁREA do círculo cresce com o número de
  candidatos, que é como o olho compara. Sem candidato, o raio mínimo.
*/
export function raioDoPonto(valor, maior) {
  if (!(maior > 0) || !(valor > 0)) return RAIO_MINIMO;
  const proporcao = Math.sqrt(Math.min(valor, maior) / maior);
  return Math.round(RAIO_MINIMO + (RAIO_MAXIMO - RAIO_MINIMO) * proporcao);
}

/*
  Os municípios, do que tem mais candidatos para o que tem menos, cada um com
  a coordenada (ou \`null\`, se a tabela ainda não o tem) e o raio do ponto.
*/
export function pontosDosMunicipios(municipios) {
  const lista = [...(Array.isArray(municipios) ? municipios : [])].sort(
    (a, b) =>
      b.candidatos - a.candidatos ||
      a.municipioUf.localeCompare(b.municipioUf, "pt-BR"),
  );
  const maior = Math.max(0, ...lista.map((item) => item.candidatos));
  return lista.map((item) => {
    const lugar = coordenadasDoMunicipio(item.municipioUf);
    return {
      ...item,
      coordenadas: lugar ? [lugar.latitude, lugar.longitude] : null,
      raio: raioDoPonto(item.candidatos, maior),
    };
  });
}

/** Total de uma contagem sobre os municípios (vagas, candidatos…). */
export function totalDosMunicipios(municipios, campo) {
  return (Array.isArray(municipios) ? municipios : []).reduce(
    (total, item) => total + num(item?.[campo]),
    0,
  );
}
