import type {
  EstiloDoTraco,
  FaseDaTerra,
  FeatureDaTerra,
  PropriedadesDaTerra,
} from "./tipos.ts";
import { dseiFeatureMatches } from "./textos.ts";

/** O que o estilo lê do mapa: o fundo (Mapa/Satélite) e o zoom. */
export interface MapaDoEstilo {
  __agsusBaseMapMode?: string;
  getZoom?(): number;
}

/*
  DESTAQUE DAS TERRAS INDÍGENAS

  O preenchimento era 0.08 sobre o mapa base. O polígono estava lá e era
  desenhado, mas na prática desaparecia contra o relevo e as áreas verdes do
  próprio mapa — quem abria um DSEI não via terra indígena nenhuma.

  Sobre o mapa comum o preenchimento sobe para 0.26 e o traço engrossa: a
  terra passa a ler-se como área, não como risco. Sobre satélite continua
  contido, em 0.16 — ali o preenchimento tapa a imagem, que é justamente o que
  se foi ver, e o traço tracejado já separa o polígono do terreno.

  Nada disto cobre os marcadores das unidades: as terras ficam no z-index 255 e
  os marcadores do Leaflet em 600.
*/
/*
  UMA COR SÓ PARA A TERRA INDÍGENA, NOS DOIS MAPAS BASE — E QUE NÃO SEJA VERDE

  A camada teve três cores, nesta ordem. Primeiro duas ao mesmo tempo:
  verde-azulada sobre o mapa comum e vermelha sobre satélite. A vermelha vivia
  só no desenho vetorial, e o vetorial só existe a partir do zoom 7 — na visão
  nacional quem desenha é o raster WMS da Funai, com a simbologia dela. O botão
  e a legenda mostravam vermelho enquanto o mapa desenhava verde.

  Alinhou-se então tudo pelo verde da fonte. Mas o verde da Funai, medido no
  próprio raster, é #4daf4a — hsl(118, 41%, 49%), verde de folha. Sobre imagem
  de satélite ele desaparece dentro da floresta, que é exatamente onde quase
  toda a terra indígena está. A cor certa da fonte era a cor errada do mapa.

  A saída é magenta: nada na paisagem é magenta, e ele também não colide com o
  azul da camada de DSEI. O vetorial é nosso e muda numa constante; o raster
  vem pronto da Funai e só muda com um filtro CSS.

  Por isso as duas coisas têm de ser calculadas juntas. `hue-rotate` do CSS não
  roda a matiz de HSL — é uma aproximação linear em RGB, definida na
  especificação de filtros —, de modo que o resultado não se adivinha. A cor do
  vetorial é sempre o que a cadeia do filtro dá quando aplicada a #4daf4a, e
  não uma cor escolhida à parte. Assim a camada não muda de cor quando o mapa
  troca o raster pelo vetorial.

  O contraste sobre satélite continua a vir também do traço, mais grosso, com
  o preenchimento discreto para não tapar a imagem que se foi ver.

  E O MAGENTA VIROU O PROBLEMA SEGUINTE

  Nada na paisagem era magenta — e na visão nacional, com 665 terras cheias,
  o Brasil inteiro ficava rosa. A Amazônia é quase toda terra indígena. Quem
  abria o painel via uma mancha, não um mapa.

  O magenta tinha sido escolhido por um teste que media a distância só pelo
  MATIZ, e exigia 90° do verde e 60° do azul. Feita a conta, as únicas cores
  que passavam eram rosa, magenta e vermelho: o critério escolhia a cor antes
  de alguém a escolher. Matiz sozinho não diz se duas cores se confundem — o
  marrom tem matiz de laranja e ninguém o toma por verde-claro. A medida certa
  é a diferença perceptual (ΔE, em CIELAB), que conta também claridade e
  saturação.

  A cor passa a ser a da terra: marrom no traço, areia no fundo. É como os
  mapas do ISA desenham terra indígena, e fica longe de tudo o que o mapa já
  usa — ΔE 59 da vegetação, 108 do azul do DSEI, 49 do âmbar do polo base, 82
  do rosa que sai. Contra o fundo do mapa, 6,47:1 (WCAG 1.4.11 pede 3:1).

  O filtro abaixo leva o verde da Funai exatamente a esse marrom, calculado
  pela mesma matriz da especificação que o teste usa.
*/
// Exportado no fim do arquivo: a declaração fica numa linha só (tests/cor-da-terra-indigena.test.js a lê).
const FILTRO_DO_RASTER = "hue-rotate(-83deg) saturate(1.15) brightness(0.55)";
const COR_DA_TERRA = "#7a4a1f";
const PREENCHIMENTO_DA_TERRA = "#d6b07a";

/*
  UMA TERRA HOMOLOGADA E UMA EM PROCESSO NÃO SÃO A MESMA COISA

  O mapa pintava as 665 com a mesma cor. Mas a fase é o estado jurídico da
  terra, e no catálogo da Funai elas repartem-se assim:

      494  Regularizada      limite definitivo, registrada em cartório
       17  Homologada        limite definitivo, homologado por decreto
       73  Declarada         limite definido; o processo continua
       45  Delimitada        idem
       28  Encaminhada RI    idem
        8  Em Estudo         sem limite definido

  As duas primeiras somam 511 terras com limite definitivo. As três seguintes
  são 146 terras em processo, e para quem planeia atendimento isso muda tudo:
  um limite que ainda pode mudar não é o mesmo que um limite que não muda mais.

  A cor separa as duas famílias, e a terceira — em estudo — já tinha o seu
  desenho próprio, o círculo tracejado, porque dela não há sequer limite.

  As duas eram magenta, uma escura e cheia, outra clara e tracejada — e quem
  olhava via duas tonalidades da mesma cor e perguntava qual era qual. Passam
  a ser DUAS CORES: marrom para a definitiva, terracota para a que está em
  processo (ΔE 39 entre elas). E a diferença não fica só na cor, para quem não
  as distingue: a definitiva tem traço contínuo e fundo; a em processo tem
  traço tracejado e quase nenhum fundo — uma linha interrompida é como um
  limite provisório se desenha em cartografia desde sempre.

  A em estudo, sem limite nenhum, é um círculo tracejado na cor da em processo:
  as duas são provisórias, e a forma diz qual das duas é.
*/
const FASES_DEFINITIVAS = new Set(["REGULARIZADA", "HOMOLOGADA"]);

export function faseDaTerra(
  propriedades: PropriedadesDaTerra | null | undefined,
): FaseDaTerra {
  const fase = String(propriedades?.fase_ti ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
  if (!fase) return "desconhecida";
  if (FASES_DEFINITIVAS.has(fase)) return "definitiva";
  if (fase.includes("ESTUDO")) return "em_estudo";
  return "em_processo";
}

export const COR_EM_PROCESSO = "#c8520f";

/*
  O que a legenda nomeia, na ordem em que o mapa desenha. `desconhecida` não
  entra: desenha-se como definitiva (ver `estiloDaFase`) e liga e desliga com
  ela.
*/
export const FASES_DAS_TERRAS: readonly {
  fase: Exclude<FaseDaTerra, "desconhecida">;
  rotulo: string;
}[] = Object.freeze([
  { fase: "definitiva", rotulo: "Homologada ou regularizada" },
  { fase: "em_processo", rotulo: "Em processo (declarada, delimitada)" },
  { fase: "em_estudo", rotulo: "Em estudo — sem limite publicado" },
]);

/*
  O BRASIL INTEIRO NÃO É UM MAPA DE TERRAS

  Abaixo deste zoom o mapa é o país, e o que se foi ver são os distritos e as
  unidades. As terras recuam: traço fino, fundo quase transparente. Continuam
  lá — a forma do território indígena do país é informação —, mas deixam de
  ser a coisa mais forte do ecrã. Ao aproximar, voltam a ler-se como área.
*/
export const ZOOM_DO_PAIS = 6;

/* O raio do símbolo da terra pequena demais para se ver (ver `terraPrecisaDeSimbolo`). */
const RAIO_DO_SIMBOLO_PX = 8;

/*
  O SÍMBOLO TAMBÉM RECUA

  A primeira versão do recuo só afinava os polígonos. Na bancada, o Brasil
  continuava coberto: 410 das 665 terras são pequenas demais para se ver nesta
  escala e viravam cada uma um círculo de 8 px com fundo a 45% — mais as 163 em
  estudo, com outro círculo cada. Eram eles, e não os polígonos, que pintavam o
  país. No país o símbolo é um ponto de 3 px.
*/
const RAIO_DO_SIMBOLO_NO_PAIS_PX = 3;

export function raioDoSimbolo(zoom: number): number {
  return Number.isFinite(zoom) && zoom < ZOOM_DO_PAIS
    ? RAIO_DO_SIMBOLO_NO_PAIS_PX
    : RAIO_DO_SIMBOLO_PX;
}

/*
  Sem fase declarada desenha-se como definitiva, e não como provisória: dizer
  "ainda em processo" sobre uma terra que talvez esteja regularizada é afirmar
  mais do que se sabe, e na direção que pesa contra quem lá vive.

  `zoom` é opcional: sem ele vale o desenho de perto, que é o que os testes e
  quem chama sem mapa esperam.
*/
export function estiloDaFase(
  fase: string,
  satellite: boolean,
  zoom?: number,
): EstiloDoTraco & { dashArray: string | null; fillOpacity: number } {
  const pais = Number.isFinite(zoom) && Number(zoom) < ZOOM_DO_PAIS;
  /*
    Oito terras do catálogo têm polígono E fase "Em Estudo". Só `em_processo`
    era provisória aqui, e essas oito desenhavam-se com o traço cheio da
    regularizada — uma terra sem limite definido a passar por definitiva.
  */
  if (fase === "em_processo" || fase === "em_estudo") {
    if (pais) {
      return {
        color: COR_EM_PROCESSO,
        weight: satellite ? 1.6 : 1.2,
        dashArray: "4 3",
        fillColor: COR_EM_PROCESSO,
        fillOpacity: satellite ? 0.02 : 0.03,
      };
    }
    return {
      color: COR_EM_PROCESSO,
      weight: satellite ? 3 : 2.4,
      dashArray: "7 5",
      fillColor: COR_EM_PROCESSO,
      // Quase nada de fundo: sem ele o polígono não recebe o ponteiro.
      fillOpacity: satellite ? 0.04 : 0.06,
    };
  }
  if (pais) {
    return {
      color: COR_DA_TERRA,
      weight: satellite ? 1.4 : 1,
      dashArray: null,
      fillColor: PREENCHIMENTO_DA_TERRA,
      fillOpacity: satellite ? 0.08 : 0.12,
    };
  }
  return {
    color: COR_DA_TERRA,
    weight: satellite ? 3.2 : 2.2,
    dashArray: null,
    fillColor: PREENCHIMENTO_DA_TERRA,
    fillOpacity: satellite ? 0.2 : 0.32,
  };
}

/*
  A terra pequena demais para se ver vira um círculo — e o círculo segue a fase
  dela. Antes era sempre da cor da definitiva, e uma terra em processo que só
  aparecia como símbolo passava por regularizada.
*/
export function estiloDoSimbolo(
  map: MapaDoEstilo | null | undefined,
  fase: string | undefined,
): EstiloDoTraco {
  const satellite = map?.__agsusBaseMapMode === "satellite";
  // Idem a `estiloDaFase`: a em estudo é provisória, não definitiva.
  const emProcesso = fase === "em_processo" || fase === "em_estudo";
  if (Number(map?.getZoom?.()) < ZOOM_DO_PAIS) {
    /*
      No país, o símbolo é um ponto. Cheio para a definitiva, vazado para a em
      processo: a 3 px um tracejado não se vê, e a diferença tem de continuar
      a existir para quem não distingue as duas cores.
    */
    return {
      color: emProcesso ? COR_EM_PROCESSO : COR_DA_TERRA,
      weight: emProcesso ? 1.2 : 0.8,
      opacity: 1,
      dashArray: null,
      fillColor: emProcesso ? COR_EM_PROCESSO : COR_DA_TERRA,
      fillOpacity: emProcesso ? 0 : satellite ? 0.85 : 0.7,
    };
  }
  return {
    color: emProcesso ? COR_EM_PROCESSO : COR_DA_TERRA,
    weight: satellite ? 2.8 : 2.2,
    opacity: 1,
    dashArray: emProcesso ? "4 3" : null,
    fillColor: emProcesso ? COR_EM_PROCESSO : PREENCHIMENTO_DA_TERRA,
    fillOpacity: emProcesso ? 0.12 : 0.45,
  };
}

export function vectorStyle(
  map: MapaDoEstilo | null | undefined,
  feature: FeatureDaTerra | null | undefined,
): ReturnType<typeof estiloDaFase> & { opacity: number } {
  const satellite = map?.__agsusBaseMapMode === "satellite";
  return {
    opacity: 1,
    ...estiloDaFase(
      faseDaTerra(feature?.properties),
      satellite,
      Number(map?.getZoom?.()),
    ),
  };
}

/*
  Qual interruptor da legenda comanda a terra. A `desconhecida` desenha-se
  como definitiva, e por isso some e volta com ela.
*/
export function faseDaLegenda(fase: string): string {
  return fase === "desconhecida" ? "definitiva" : fase;
}

/*
  O que fica desenhado depois dos interruptores da legenda. Função pura para
  poder ser testada sem Leaflet: é aqui que "esconder as regularizadas e ficar
  só com as que estão em processo" acontece.
*/
export function terrasDasFasesVisiveis<F extends FeatureDaTerra>(
  features: readonly F[] | null | undefined,
  fasesOcultas: ReadonlySet<string> | null | undefined,
): F[] {
  if (!Array.isArray(features)) return [];
  const todas = features as F[];
  if (!fasesOcultas?.size) return todas;
  return todas.filter(
    (f) => !fasesOcultas.has(faseDaLegenda(faseDaTerra(f?.properties))),
  );
}

export function dseiStyle(
  mapElementId: string,
  feature: FeatureDaTerra | null | undefined,
  selectedDsei: string,
): EstiloDoTraco {
  const selected =
    Boolean(selectedDsei) && dseiFeatureMatches(feature, selectedDsei);
  if (mapElementId === "detailMap") {
    return {
      color: "#0b5fa5",
      weight: 3,
      opacity: 0.96,
      fillColor: "#38bdf8",
      fillOpacity: 0.08,
    };
  }

  return {
    color: selected ? "#0b5fa5" : "#2563eb",
    weight: selected ? 2.8 : 1.1,
    opacity: selected ? 0.96 : 0.5,
    fillColor: selected ? "#38bdf8" : "#60a5fa",
    fillOpacity: selected ? 0.08 : 0.015,
  };
}

export { FILTRO_DO_RASTER };
