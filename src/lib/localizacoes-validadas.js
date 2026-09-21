/*
  CONSULTA AOS VEREDITOS DE LOCALIZAÇÃO

  O mapa dizia "Localização em validação" em toda a unidade, sempre. Não era um
  estado do dado — era a ausência de quem fizesse a validação. Este módulo é o
  lado de leitura dessa validação, feita por `scripts/validar-localizacoes.mjs`
  cruzando a planilha de Lotações, o CNES e as malhas das UFs do IBGE.

  A chave é a mesma que a reconciliação já usa: DSEI mais nome canónico. Não é
  o nome bruto, porque as duas fontes escrevem o mesmo sítio de maneiras
  diferentes — `POLO BASE XITEI`, `PB XITEI` e `XITEI` são o mesmo polo.

  O que não estiver aqui não tem veredito, e continua "em validação". Isso é a
  maioria: 508 das 606 lotações com coordenada. Ausência de veredito não é
  veredito negativo.
*/
import { nomeCanonico } from "./reconciliacao-unidades.js";
import { LOCALIZACOES_VALIDADAS } from "./localizacoes-validadas-gerado.js";

const semAcento = (valor) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

export function chaveDaUnidade(dsei, nome) {
  const canonico = nomeCanonico(nome);
  if (!canonico) return "";
  return `${semAcento(dsei)}|${canonico}`;
}

export function indexarVereditos(lista = LOCALIZACOES_VALIDADAS) {
  const indice = new Map();
  for (const item of Array.isArray(lista) ? lista : []) {
    const chave = `${semAcento(item?.dsei)}|${String(item?.canonico ?? "")}`;
    if (!item?.estado || chave === "|") continue;
    // Chave repetida é ambiguidade, e ambiguidade não decide nada: cai fora.
    if (indice.has(chave)) {
      indice.set(chave, null);
      continue;
    }
    indice.set(chave, item);
  }
  for (const [chave, valor] of indice) {
    if (valor === null) indice.delete(chave);
  }
  return indice;
}

const INDICE = indexarVereditos();

export function veredictoDaUnidade(dsei, nome, indice = INDICE) {
  const chave = chaveDaUnidade(dsei, nome);
  if (!chave) return null;
  return indice.get(chave) ?? null;
}

/*
  O que o popup mostra. `validada` só sai quando houve prova; `erro` diz que a
  coordenada publicada cai fora da UF que o próprio registro declara, e nesse
  caso esconder o problema seria pior do que mostrá-lo.
*/
export function rotuloDaLocalizacao(veredicto) {
  if (veredicto?.estado === "validada") return "Localização validada";
  if (veredicto?.estado === "erro") {
    return "Coordenada fora da UF declarada — não confirmada";
  }
  return "Localização em validação";
}

/*
  A coordenada que o mapa deve desenhar. Só se substitui a que lá está quando
  a validação apurou uma melhor; nos outros casos devolve null e quem chama
  mantém a sua.
*/
export function coordenadaValidada(veredicto) {
  if (veredicto?.estado !== "validada") return null;
  const lat = Number(veredicto.lat);
  const lon = Number(veredicto.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}
