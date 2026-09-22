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
  O QUE O POPUP MOSTRA

  Havia dois rótulos para cinco vereditos. `validada` e `erro` tinham o seu; os
  outros 512 — de 606 — caíam todos em "Localização em validação", que é a
  frase de quem ainda não olhou.

  Tinha-se olhado. E entre esses 512 estavam 119 CONFLITOS: a planilha de
  Lotações e o CNES a discordarem sobre onde fica a unidade, com mediana de
  101 km e máximo de 821. O painel existe para mostrar isso, e escondia-o atrás
  da palavra "validação".

  Cada veredito passa a dizer o que é. A ordem das frases é a da gravidade, e
  nenhuma delas afirma mais do que a auditoria apurou:

    validada        duas fontes independentes concordam, ou a UF arbitrou
    conflito        as duas fontes discordam — e quanto
    erro            a coordenada cai fora da UF que o próprio registro declara
    coerente        uma fonte só, e ela cai dentro da UF declarada
    indeterminado   sem UF ou sem coordenada: não havia o que verificar

  `coerente` é o caso mais comum, 318, e é o mais fácil de contar mal. Uma
  fonte só a cair na UF certa não é confirmação: é ausência de contradição. A
  frase tem de dizer isso, senão vira um carimbo.
*/
const DISTANCIA = (veredicto) => {
  const km = Number(veredicto?.km);
  if (!Number.isFinite(km)) return "";
  return km >= 10 ? ` ${Math.round(km)} km` : ` ${km.toFixed(1)} km`;
};

export function rotuloDaLocalizacao(veredicto) {
  const estado = veredicto?.estado;

  if (estado === "validada") {
    return veredicto.motivo === "duas_fontes_concordam"
      ? "Localização validada — duas fontes concordam"
      : "Localização validada — arbitrada pela UF declarada";
  }

  if (estado === "conflito") {
    const km = DISTANCIA(veredicto);
    return km
      ? `Fontes discordam em${km} — localização não apurada`
      : "Fontes discordam sobre a localização — não apurada";
  }

  if (estado === "erro") {
    return veredicto.motivo === "fonte_unica_fora_do_municipio"
      ? "Coordenada fora do município declarado — não confirmada"
      : "Coordenada fora da UF declarada — não confirmada";
  }

  /*
    Três graus de , do mais forte para o mais fraco. O município é
    uma pergunta muito mais estreita do que a UF: nas 745 unidades de fonte
    única, a malha da UF acusou UMA e a municipal acusou cinquenta e duas.
    Dizer qual delas respondeu é dizer quanto vale o "coerente".
  */
  if (estado === "coerente") {
    if (veredicto.motivo === "fonte_unica_na_divisa") {
      /*
        Vinte dos 52 pontos que caíam fora do município estavam a menos de 2 km
        da divisa, vários a cem metros. Dizer que o cadastro está errado por
        isso seria acusar por uma linha que nem o IBGE desenha com essa
        precisão. Diz-se o que se viu.
      */
      return "Fonte única, sobre a divisa do município declarado";
    }
    if (veredicto.motivo === "fonte_unica_no_municipio") {
      return "Fonte única, dentro do município declarado — sem segunda fonte para conferir";
    }
    return veredicto.motivo === "copia_entre_fontes_na_uf"
      ? "Fonte única (as duas bases repetem a mesma coordenada), dentro da UF"
      : "Fonte única, dentro da UF declarada — sem segunda fonte para conferir";
  }

  if (estado === "indeterminado") {
    return "Sem UF ou sem coordenada — não foi possível verificar";
  }

  return "Localização em validação";
}

/*
  Para quem desenha: um veredito que pede atenção não pode ficar com a mesma
  cor de um que está resolvido. Devolve a severidade, não a cor — a paleta é de
  quem desenha, não desta biblioteca.
*/
export function severidadeDaLocalizacao(veredicto) {
  const estado = veredicto?.estado;
  if (estado === "validada") return "confirmada";
  if (estado === "conflito" || estado === "erro") return "divergente";
  if (estado === "coerente") return "sem_contradicao";
  return "sem_veredito";
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
