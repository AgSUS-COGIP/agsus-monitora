/*
  O MAPA NACIONAL DA SAÚDE INDÍGENA, SEM LEAFLET

  O que o `drawDSEIBubbles`, o `drawCasai`, o `procCounts` e o
  `renderPainelNacional` do `legacy-app.js` decidiam, agora como entrada →
  saída: as bolhas dos DSEIs (tamanho pela população, cor pelos editais do
  recorte), as CASAIs nacionais, a lista
  "Territórios por vagas" e o enquadramento.

  Os editais chegam já recortados (filtros, busca, área, DSEI escolhido): o
  mapa só conta. Com filtro ativo, só aparecem os DSEIs e as CASAIs nacionais
  que têm edital no recorte.
*/
import { enquadramentoDoRecorte } from "../enquadramento-do-brasil.js";
import { OPACIDADE_DA_BOLHA, raioDaBolha } from "../mapa-render.js";
import { siglaDaUf } from "../uf-ibge.js";
import {
  chaveDoDsei,
  formatarNumero,
  numero,
  plural,
  temCoordenada,
  texto,
} from "./chaves.js";
import { CORES_DO_MAPA } from "./formas.js";

/* Editais, vagas e ociosas por DSEI (chave de `chaveDoDsei`). */
/** @param {readonly import("../../componentes/tipos-do-monitoramento.ts").LinhaDoMonitoramento[]} linhas
 * @returns {Map<string, import("./tipos.ts").ContagemDoDsei>} */
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

/*
  Uma bolha por DSEI com coordenada. Ordem: da maior para a menor, para que a
  menor fique por cima e as duas continuem clicáveis onde se sobrepõem (o
  leque, `leque-de-marcadores.js`, separa as que caem no mesmo pixel).
*/
/** @param {{ dseis?: import("./tipos.ts").DseiDoMapa[], contagens?: Map<string, import("./tipos.ts").ContagemDoDsei>, filtroAtivo?: boolean }} opcoes
 * @returns {import("./tipos.ts").BolhaDoDsei[]} */
export function bolhasDosDsei({
  dseis = [],
  contagens = new Map(),
  filtroAtivo = false,
} = {}) {
  const lista = Array.isArray(dseis) ? dseis : [];
  const populacaoMaxima = Math.max(0, ...lista.map((d) => numero(d?.pop))) || 1;

  return lista
    .filter((d) => d && temCoordenada(d.lat, d.lon))
    .map((d) => {
      const chave = chaveDoDsei(d.k);
      const { editais, vagas, ociosas } = contagens.get(chave) || VAZIO;
      const comEdital = editais > 0;
      const raio = raioDaBolha(d.pop, populacaoMaxima);
      const cores = comEdital
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
        comEdital,
        estilo: {
          radius: raio,
          color: cores.borda,
          weight: comEdital ? 3 : 1.5,
          fillColor: cores.preenchimento,
          fillOpacity: OPACIDADE_DA_BOLHA,
        },
      };
    })
    .filter((b) => !filtroAtivo || b.comEdital)
    .sort((a, b) => b.raio - a.raio);
}

/*
  "Territórios por vagas": os mesmos DSEIs que o mapa desenhou, por vagas
  (desempate pela população). A barra é o preenchimento, (vagas − ociosas) ÷
  vagas: acima de 80% ok, acima de 40% atenção, o resto crítico.
*/
/** @param {import("./tipos.ts").BolhaDoDsei[]} bolhas
 * @returns {import("./tipos.ts").TerritorioDoMapa[]} */
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

/*
  CASAIs nacionais (Brasília, São Paulo…): direto do `rede_cnes.nac`, a fonte
  de verdade, não da lista fixa do `lmap`. O clique filtra a página pela busca
  "CASAI <cidade>", como antes.
*/
/** @param {{ nac?: import("./tipos.ts").EstabelecimentoCompacto[], contagens?: Map<string, import("./tipos.ts").ContagemDoDsei>, filtroAtivo?: boolean }} opcoes
 * @returns {import("./tipos.ts").CasaiNacionalDoMapa[]} */
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
      return {
        chave: `${nome}|${a[2]}|${a[3]}`,
        nome,
        cnes: texto(a[1]),
        lat: Number(a[2]),
        lon: Number(a[3]),
        cidade,
        uf: siglaDaUf(a[5]) || texto(a[5]),
        editais: (contagens.get(chaveDoDsei(nome)) || VAZIO).editais,
        termoDeBusca: `CASAI ${cidade}`.trim(),
      };
    })
    .filter((c) => !filtroAtivo || c.editais > 0);
}

/*
  Enquadramento do mapa nacional: a regra comum aos mapas da Visão geral
  (`enquadramentoDoRecorte`, src/lib/enquadramento-do-brasil.js) com os DSEIs
  e as CASAIs que sobraram. Sem filtro, o Brasil; um ponto só, zoom 7 nele.
*/
/** @param {{ bolhas?: import("./tipos.ts").BolhaDoDsei[], casais?: import("./tipos.ts").CasaiNacionalDoMapa[], filtroAtivo?: boolean }} opcoes
 * @returns {import("./tipos.ts").EnquadramentoDoMapa} */
export function enquadramentoNacional({
  bolhas = [],
  casais = [],
  filtroAtivo = false,
} = {}) {
  return enquadramentoDoRecorte({
    pontos: [...bolhas, ...casais].map((p) => [p.lat, p.lon]),
    filtroAtivo,
  });
}

/* Texto da dica (tooltip) da bolha do DSEI. */
export function dicaDaBolha(bolha, resumoDaRede = []) {
  const d = bolha?.dsei || {};
  const linhas = [
    `População do DSEI: ${formatarNumero(d.pop)} indígenas`,
    ...resumoDaRede,
    `Estados administrativos: ${(d.ufs?.length ? d.ufs : [d.sedeuf]).filter(Boolean).join(", ")}`,
    `Processos seletivos: ${formatarNumero(bolha?.editais)}`,
  ];
  if (bolha?.comEdital) {
    linhas.push(
      `Vagas ociosas: ${formatarNumero(bolha.ociosas)} de ${formatarNumero(bolha.vagas)}`,
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
      casai.cnes ? `CNES: ${casai.cnes}` : "",
      `Processos seletivos: ${formatarNumero(casai.editais)}`,
    ].filter(Boolean),
  };
}
