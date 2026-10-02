/*
  O MAPA NACIONAL DA SAÚDE INDÍGENA, SEM LEAFLET

  O que o `drawDSEIBubbles`, o `drawCasai`, o `procCounts` e o
  `renderPainelNacional` do `legacy-app.js` decidiam, agora como entrada →
  saída: as bolhas dos DSEIs (tamanho pela população, cor pelos editais do
  recorte ou pela ociosidade no modo calor), as CASAIs nacionais, a lista
  "Territórios por vagas" e o enquadramento.

  Os editais chegam já recortados (filtros, busca, área, DSEI escolhido): o
  mapa só conta. Com filtro ativo, só aparecem os DSEIs e as CASAIs nacionais
  que têm edital no recorte.
*/
import { raioDaBolha } from "../mapa-render.js";
import { siglaDaUf } from "../uf-ibge.js";
import {
  chaveDoDsei,
  formatarNumero,
  numero,
  plural,
  temCoordenada,
  texto,
} from "./chaves.js";
import { CORES_DO_MAPA, corDoCalor } from "./formas.js";

/* Editais, vagas e ociosas por DSEI (chave de `chaveDoDsei`). */
export function contarPorDsei(linhas) {
  const contagens = new Map();
  for (const linha of Array.isArray(linhas) ? linhas : []) {
    const chave = chaveDoDsei(linha?.unidade);
    if (!chave) continue;
    const atual = contagens.get(chave) || { editais: 0, vagas: 0, ociosas: 0 };
    atual.editais += 1;
    atual.vagas += numero(linha.vagas_total);
    atual.ociosas += numero(linha.vagas_ociosas);
    contagens.set(chave, atual);
  }
  return contagens;
}

const VAZIO = Object.freeze({ editais: 0, vagas: 0, ociosas: 0 });

export const porcentagemOciosa = (vagas, ociosas) =>
  vagas > 0 ? Math.round((ociosas / vagas) * 100) : 0;

/*
  Uma bolha por DSEI com coordenada. Ordem: da maior para a menor, para que a
  menor fique por cima e as duas continuem clicáveis onde se sobrepõem (o
  leque, `leque-de-marcadores.js`, separa as que caem no mesmo pixel).
*/
export function bolhasDosDsei({
  dseis = [],
  contagens = new Map(),
  filtroAtivo = false,
  calor = false,
} = {}) {
  const lista = Array.isArray(dseis) ? dseis : [];
  const populacaoMaxima = Math.max(0, ...lista.map((d) => numero(d?.pop))) || 1;

  return lista
    .filter((d) => d && temCoordenada(d.lat, d.lon))
    .map((d) => {
      const chave = chaveDoDsei(d.k);
      const { editais, vagas, ociosas } = contagens.get(chave) || VAZIO;
      const comEdital = editais > 0;
      const pctOciosas = porcentagemOciosa(vagas, ociosas);
      const raio = raioDaBolha(d.pop, populacaoMaxima);
      const cores = calor
        ? comEdital
          ? {
              preenchimento: corDoCalor(pctOciosas),
              borda: corDoCalor(pctOciosas),
            }
          : CORES_DO_MAPA.semEditalNoCalor
        : comEdital
          ? CORES_DO_MAPA.comEdital
          : CORES_DO_MAPA.semEdital;
      return {
        dsei: d,
        chave,
        lat: Number(d.lat),
        lon: Number(d.lon),
        raio,
        editais,
        vagas,
        ociosas,
        pctOciosas,
        comEdital,
        estilo: {
          radius: raio,
          color: cores.borda,
          weight: comEdital ? 3 : 1.5,
          fillColor: cores.preenchimento,
          fillOpacity: calor ? 0.82 : 0.7,
        },
      };
    })
    .filter((b) => !filtroAtivo || b.comEdital)
    .sort((a, b) => b.raio - a.raio);
}

/*
  "Territórios por vagas": os mesmos DSEIs que o mapa desenhou, por vagas
  (desempate pela população). A barra é o preenchimento, (vagas − ociosas) ÷
  vagas, com as faixas do calor lidas pelo avesso.
*/
export function territoriosPorVagas(bolhas) {
  return [...(Array.isArray(bolhas) ? bolhas : [])]
    .sort(
      (a, b) => b.vagas - a.vagas || numero(b.dsei?.pop) - numero(a.dsei?.pop),
    )
    .map((b, indice) => {
      const preenchidas = b.vagas
        ? Math.round((Math.max(0, b.vagas - b.ociosas) / b.vagas) * 100)
        : 0;
      return {
        ...b,
        posicao: indice + 1,
        preenchidas,
        situacao:
          preenchidas > 80 ? "ok" : preenchidas > 40 ? "atencao" : "critico",
        detalhe: [
          plural(b.ociosas, "ociosa", "ociosas"),
          b.editais ? plural(b.editais, "processo", "processos") : "",
          numero(b.dsei?.pop) ? `${formatarNumero(b.dsei.pop)} hab.` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      };
    });
}

/* Frase da confiança da coordenada de um estabelecimento do `rede_cnes`. */
export function textoDaFonteDaCoordenada(meta) {
  const compartilhada = numero(meta?.coordenada_compartilhada_qtd);
  if (meta?.confirmacao_independente === true)
    return "Localização validada por fonte independente";
  if (compartilhada > 1)
    return `Localização em validação · ${compartilhada} estabelecimentos usam este ponto`;
  return "Localização em validação · coordenada cadastral CNES";
}

/*
  CASAIs nacionais (Brasília, São Paulo…): direto do `rede_cnes.nac`, a fonte
  de verdade, não da lista fixa do `lmap`. O clique filtra a página pela busca
  "CASAI <cidade>", como antes.
*/
export function casaisNacionais({
  nac = [],
  contagens = new Map(),
  filtroAtivo = false,
} = {}) {
  return (Array.isArray(nac) ? nac : [])
    .filter((a) => Array.isArray(a) && temCoordenada(a[2], a[3]))
    .map((a) => {
      const nome = texto(a[0]);
      const cidade = texto(a[4]);
      const meta = a[9] && typeof a[9] === "object" ? a[9] : null;
      return {
        chave: `${nome}|${a[2]}|${a[3]}`,
        nome,
        cnes: texto(a[1]),
        lat: Number(a[2]),
        lon: Number(a[3]),
        cidade,
        uf: siglaDaUf(a[5]) || texto(a[5]),
        editais: (contagens.get(chaveDoDsei(nome)) || VAZIO).editais,
        fonteDaCoordenada: textoDaFonteDaCoordenada(meta),
        termoDeBusca: `CASAI ${cidade}`.trim(),
      };
    })
    .filter((c) => !filtroAtivo || c.editais > 0);
}

/*
  Enquadramento do mapa nacional. Sem filtro: o Brasil. Com filtro: os DSEIs
  e as CASAIs que sobraram (um ponto só vira zoom 7 nele). A `chave` muda só
  quando muda o que enquadrar — o mapa não reenquadra a cada redesenho.
*/
export function enquadramentoNacional({
  bolhas = [],
  casais = [],
  filtroAtivo = false,
} = {}) {
  const pontos = [...bolhas, ...casais].map((p) => [p.lat, p.lon]);
  const chave =
    (filtroAtivo ? "F|" : "A|") +
    pontos.map((p) => p.map((v) => Number(v).toFixed(4)).join(",")).join("|");
  if (!filtroAtivo || !pontos.length)
    return { modo: "brasil", pontos: [], chave };
  if (pontos.length === 1) return { modo: "ponto", pontos, chave };
  return { modo: "caixa", pontos, chave };
}

/* Texto da dica (tooltip) da bolha do DSEI. */
export function dicaDaBolha(bolha, resumoDaRede = [], { calor = false } = {}) {
  const d = bolha?.dsei || {};
  const linhas = [
    `População do DSEI: ${formatarNumero(d.pop)} indígenas`,
    ...resumoDaRede,
    `Estados administrativos: ${(d.ufs?.length ? d.ufs : [d.sedeuf]).filter(Boolean).join(", ")}`,
    `Processos seletivos: ${formatarNumero(bolha?.editais)}`,
  ];
  if (bolha?.comEdital) {
    linhas.push(
      calor
        ? `Ociosidade: ${bolha.pctOciosas}% (${formatarNumero(bolha.ociosas)} de ${formatarNumero(bolha.vagas)} vagas)`
        : `Vagas ociosas: ${formatarNumero(bolha.ociosas)} de ${formatarNumero(bolha.vagas)}`,
    );
  }
  return { titulo: `DSEI ${texto(d.n)}`, linhas };
}

export function dicaDaCasaiNacional(casai) {
  return {
    titulo: casai.nome,
    linhas: [
      [casai.cidade, casai.uf].filter(Boolean).join(" – "),
      `Processos seletivos: ${formatarNumero(casai.editais)}`,
    ],
  };
}

export function popupDaCasaiNacional(casai) {
  return {
    titulo: casai.nome,
    linhas: [
      "Casa de Saúde Indígena (referência nacional)",
      [casai.cidade, casai.uf].filter(Boolean).join(" – "),
      `Processos seletivos: ${formatarNumero(casai.editais)}`,
    ],
    nota: casai.fonteDaCoordenada,
  };
}
