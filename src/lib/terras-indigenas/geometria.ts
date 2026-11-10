import type {
  CaixaDaTerra,
  FeatureDaTerra,
  LimitesDoMapa,
  PoligonoGeoJson,
  PontoProjetado,
  PosicaoGeoJson,
  ResumoDaTerra,
  UnidadeDoDsei,
} from "./tipos.ts";
import { ehPreenchimentoSemPovo } from "./textos.ts";

/*
  TERRAS PEQUENAS DEMAIS PARA SEREM VISTAS

  Aumentar o preenchimento resolvia terras grandes. No DSEI Alagoas e Sergipe
  não resolvia nada, e a razão é aritmética: no zoom em que cabe o distrito
  inteiro, 1 pixel vale 600 metros. Medidas as 21 terras desse enquadramento,
  a maior — Pankararé, 25,6 km — dá 43 px, e a menor — uma das Xucuru-Kariri,
  800 m — dá 1,4 px. Catorze das 21 ficam abaixo de 20 px. Nenhuma opacidade
  faz uma mancha de três pixels ler-se como área.

  Abaixo deste limiar a terra ganha um símbolo de posição no centro. É prática
  cartográfica corrente: à escala pequena, a área vira ponto. O símbolo diz
  onde a terra está; a partir daí o zoom mostra o limite verdadeiro, e o
  tooltip avisa que o círculo não é o limite — para ninguém o ler como tal.
*/
const SIMBOLO_ABAIXO_DE_PX = 20;

/*
  Quanto ocupa a terra no ecrã, em pixels, na sua maior dimensão. `projetar`
  é a projeção do mapa; separá-la daqui é o que torna isto verificável sem
  Leaflet nem navegador.
*/
export function tamanhoNaTelaEmPixels<P>(
  limites: { getNorthEast(): P; getSouthWest(): P },
  projetar: (ponto: P) => Partial<PontoProjetado> | null | undefined,
): number {
  const ne = projetar(limites.getNorthEast());
  const sw = projetar(limites.getSouthWest());
  const [nx, ny, sx, sy] = [ne?.x, ne?.y, sw?.x, sw?.y];
  if (
    typeof nx !== "number" ||
    typeof ny !== "number" ||
    typeof sx !== "number" ||
    typeof sy !== "number" ||
    ![nx, ny, sx, sy].every(Number.isFinite)
  )
    return 0;
  return Math.max(Math.abs(nx - sx), Math.abs(ny - sy));
}

export function terraPrecisaDeSimbolo(tamanhoEmPixels: unknown): boolean {
  return Number(tamanhoEmPixels) < SIMBOLO_ABAIXO_DE_PX;
}

/*
  QUE TERRAS SÃO DESTE DSEI

  O mapa do DSEI Bahia mostrava Xerente, Ava-Canoeiro e Xacriabá. Nenhuma é da
  Bahia: a camada pedia à Funai tudo o que cabia no enquadramento e desenhava
  tudo, sem perguntar se o distrito aberto tinha alguma relação com aquilo.
  Quem abria um DSEI via o vizinho junto.

  O CAMINHO QUE NÃO EXISTE MAIS

  O natural seria cruzar com a abrangência oficial do DSEI. A Funai deixou de
  publicá-la: o GetCapabilities do GeoServer lista hoje `tis_poligonais`,
  `tis_pontos`, `tis_cr`, `aldeias_pontos` e mais três — nenhuma de DSEI. O
  pedido a `Funai:areas_dsei` responde "Feature type unknown"; o proxy deixou de
  oferecer `dataset=dsei` (10/11/2026), e o contorno do DSEI vem do arquivo
  local `contornos-dos-dseis.json`, sem limite de terra.

  O QUE SE USA EM VEZ DISSO, E QUANTO ISSO VALE

  As unidades de saúde do próprio distrito, que o MONITORA já conhece. Uma
  terra é deste DSEI se ele tem unidade dentro dela, ou unidade perto dela.

  A primeira metade é observação. A segunda é inferência, e foi medida antes de
  ser usada: das 665 terras do país, 239 têm alguma unidade dentro; em 227
  delas — 95% — a unidade mais próxima do centro da terra é do mesmo DSEI que
  tem unidade lá dentro. É essa concordância que autoriza a segunda regra a
  estender a primeira.

  O raio é 50 km. A distância de uma terra à unidade mais próxima tem mediana
  de 17 km e terceiro quartil de 40 km; 50 km cobre a folga sem puxar terras
  do distrito vizinho. Xerente fica a mais de 500 km de qualquer unidade da
  Bahia, e sai.

  Isto é atribuição inferida, não cadastro. Se a Funai voltar a publicar a
  abrangência, é esta função que deve ser substituída por ela.
*/
export const RAIO_DE_ATENDIMENTO_KM = 50;

const RAIO_DA_TERRA_KM = 6371;

function distanciaEmKm(
  latA: number,
  lonA: number,
  latB: number,
  lonB: number,
): number {
  const rad = (grau: number) => (grau * Math.PI) / 180;
  const dLat = rad(latB - latA);
  const dLon = rad(lonB - lonA);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(latA)) * Math.cos(rad(latB)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAIO_DA_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function caixaDeCoordenadas(
  poligonos: readonly PoligonoGeoJson[] | null | undefined,
): CaixaDaTerra {
  let oeste = 180;
  let leste = -180;
  let sul = 90;
  let norte = -90;
  for (const poligono of poligonos || []) {
    for (const [x = NaN, y = NaN] of poligono[0] || []) {
      if (x < oeste) oeste = x;
      if (x > leste) leste = x;
      if (y < sul) sul = y;
      if (y > norte) norte = y;
    }
  }
  return { oeste, leste, sul, norte };
}

/*
  A caixa de uma terra não muda, e calculá-la percorre todos os vértices dela.
  Com 665 terras a cada movimento do mapa isso seria o novo gargalo, depois de
  se ter tirado a rede do caminho. Fica guardada na própria feature.
*/
const CAIXA = Symbol.for("agsus.caixaDaTerra");

export function caixaDaFeature(feature: unknown): CaixaDaTerra | null {
  if (!feature || typeof feature !== "object") return null;
  const guardada: unknown = Reflect.get(feature, CAIXA);
  if (guardada) return guardada as CaixaDaTerra;
  const poligonos = poligonosDaFeature(feature as FeatureDaTerra);
  if (!poligonos.length) return null;
  const caixa = caixaDeCoordenadas(poligonos);
  try {
    Object.defineProperty(feature, CAIXA, { value: caixa, enumerable: false });
  } catch {
    // Feature congelada: recalcula-se, que é correto, só mais lento.
  }
  return caixa;
}

/*
  A LISTA DAS TERRAS E DOS POVOS

  O mapa mostrava as terras e não as nomeava em lugar nenhum: para saber quais
  eram e que povos vivem nelas, era preciso passar o ponteiro por cima de cada
  uma, uma a uma. Num DSEI com trinta terras isso não é consulta, é garimpo.

  A Funai declara os povos num campo só, separados por vírgula — "Kaingang,
  Guarani" —, e a mesma terra aparece repetida quando o limite dela é feito de
  vários polígonos. Aqui os polígonos colapsam por nome e os povos saem em
  lista, ordenados por nome da terra.
*/
export function povosDaFeature(
  propriedades: FeatureDaTerra["properties"],
): string[] {
  return String(propriedades?.etnia_nome ?? "")
    .split(/\s*[,;/]\s*/)
    .map((p) => p.trim())
    .filter((p) => p && !ehPreenchimentoSemPovo(p));
}

export function resumoDasTerras(
  features: readonly FeatureDaTerra[] = [],
): ResumoDaTerra[] {
  const porNome = new Map<string, ResumoDaTerra>();

  for (const f of Array.isArray(features) ? features : []) {
    const nome = String(f?.properties?.terrai_nome ?? "").trim();
    if (!nome) continue;
    let terra = porNome.get(nome);
    if (!terra) {
      terra = {
        nome,
        povos: [],
        ufs: [],
        fase: String(f?.properties?.fase_ti ?? "").trim(),
        caixa: null,
      };
      porNome.set(nome, terra);
    }
    /*
      A caixa da terra inteira, para a lista poder levar o mapa até ela. Uma
      terra feita de vários polígonos soma as caixas de todos.
    */
    const caixa = caixaDaFeature(f);
    if (caixa) {
      terra.caixa = terra.caixa
        ? {
            oeste: Math.min(terra.caixa.oeste, caixa.oeste),
            sul: Math.min(terra.caixa.sul, caixa.sul),
            leste: Math.max(terra.caixa.leste, caixa.leste),
            norte: Math.max(terra.caixa.norte, caixa.norte),
          }
        : { ...caixa };
    }
    for (const povo of povosDaFeature(f?.properties)) {
      if (!terra.povos.includes(povo)) terra.povos.push(povo);
    }
    for (const uf of String(f?.properties?.uf_sigla ?? "")
      .split(/\s*[,;/]\s*/)
      .map((u) => u.trim())
      .filter(Boolean)) {
      if (!terra.ufs.includes(uf)) terra.ufs.push(uf);
    }
  }

  for (const terra of porNome.values()) {
    terra.povos.sort((a, b) => a.localeCompare(b, "pt-BR"));
    terra.ufs.sort();
  }

  return [...porNome.values()].sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR"),
  );
}

export function caixasSeIntersectam(
  a: CaixaDaTerra | null | undefined,
  b: CaixaDaTerra | null | undefined,
): boolean {
  if (!a || !b) return false;
  return !(
    a.leste < b.oeste ||
    a.oeste > b.leste ||
    a.norte < b.sul ||
    a.sul > b.norte
  );
}

/*
  O que cabe no ecrã. Sem isto, mudar de enquadramento redesenharia as 665
  terras, e o Leaflet paga por cada traçado que cria.
*/
export function terrasNoEnquadramento<F extends FeatureDaTerra>(
  features: readonly F[] | null | undefined,
  caixaDoMapa: CaixaDaTerra | null | undefined,
): F[] {
  if (!Array.isArray(features)) return [];
  const todas = features as F[];
  if (!caixaDoMapa) return todas;
  return todas.filter((f) =>
    caixasSeIntersectam(caixaDaFeature(f), caixaDoMapa),
  );
}

export function caixaDoMapa(
  bounds: LimitesDoMapa | null | undefined,
): CaixaDaTerra | null {
  const oeste = Number(bounds?.getWest?.());
  const leste = Number(bounds?.getEast?.());
  const sul = Number(bounds?.getSouth?.());
  const norte = Number(bounds?.getNorth?.());
  if (![oeste, leste, sul, norte].every(Number.isFinite)) return null;
  return { oeste, leste, sul, norte };
}

export function poligonosDaFeature(
  feature: FeatureDaTerra | null | undefined,
): readonly PoligonoGeoJson[] {
  const geometria = feature?.geometry;
  if (geometria?.type === "Polygon") return [geometria.coordinates];
  if (geometria?.type === "MultiPolygon") return geometria.coordinates;
  return [];
}

function pontoEmAnel(
  ponto: PosicaoGeoJson,
  anel: readonly PosicaoGeoJson[],
): boolean {
  const [x = NaN, y = NaN] = ponto;
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i, i += 1) {
    const [xi = NaN, yi = NaN] = anel[i] ?? [];
    const [xj = NaN, yj = NaN] = anel[j] ?? [];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      dentro = !dentro;
    }
  }
  return dentro;
}

export function pontoEmPoligonos(
  ponto: PosicaoGeoJson,
  poligonos: readonly PoligonoGeoJson[] | null | undefined,
): boolean {
  return (poligonos || []).some(
    (poligono) =>
      pontoEmAnel(ponto, poligono[0] || []) &&
      !poligono.slice(1).some((buraco) => pontoEmAnel(ponto, buraco)),
  );
}

export function terraPertenceAoDsei(
  terra: FeatureDaTerra | null | undefined,
  unidadesDoDsei: readonly UnidadeDoDsei[] | null | undefined,
  ufsDoDsei: readonly unknown[] | null | undefined = [],
  raioKm: number = RAIO_DE_ATENDIMENTO_KM,
): boolean {
  const unidades = (unidadesDoDsei || []).filter(
    (u) => Number.isFinite(Number(u?.lat)) && Number.isFinite(Number(u?.lon)),
  );
  // Sem unidades não se filtra: é a visão nacional, ou um distrito sem dados.
  if (!unidades.length) return true;

  const poligonos = poligonosDaFeature(terra);
  if (!poligonos.length) return false;

  /*
    A UF É UM SEGUNDO CRIVO, E SEM ELE O RAIO VAZA.

    O raio de 50 km em volta de cada unidade não conhece fronteira. No DSEI
    Bahia entravam 8 terras de outros estados, puxadas por unidades do São
    Francisco que estão mesmo a menos de 50 km de terras de Pernambuco. Medido
    sobre os dados reais: 41 terras estranhas, em 16 distritos.

    O distrito declara as UFs que atende, e a Funai declara a UF de cada terra.
    Quando os dois dizem, e não se cruzam, a terra não é daqui — por mais perto
    que esteja. Uma terra que atravessa estados traz as duas siglas
    ("AM,PA" e mais treze combinações na camada), e basta uma bater.

    Sem UF declarada de um dos lados, o crivo não se aplica: ausência de dado
    não é motivo para esconder.
  */
  const ufs = new Set(
    (ufsDoDsei || [])
      .map((u) =>
        String(u || "")
          .trim()
          .toUpperCase(),
      )
      .filter(Boolean),
  );
  if (ufs.size) {
    const daTerra = String(terra?.properties?.uf_sigla || "")
      .toUpperCase()
      .split(/[^A-Z]+/)
      .filter(Boolean);
    if (daTerra.length && !daTerra.some((u) => ufs.has(u))) return false;
  }

  const caixa = caixaDeCoordenadas(poligonos);
  // Um grau de latitude são cerca de 111 km; a folga em graus sobredimensiona
  // de propósito, porque a caixa só serve para descartar o que está longe.
  const folga = raioKm / 111;

  for (const unidade of unidades) {
    const lat = Number(unidade.lat);
    const lon = Number(unidade.lon);
    if (
      lon < caixa.oeste - folga ||
      lon > caixa.leste + folga ||
      lat < caixa.sul - folga ||
      lat > caixa.norte + folga
    ) {
      continue;
    }
    if (pontoEmPoligonos([lon, lat], poligonos)) return true;
    if (
      distanciaEmKm(
        lat,
        lon,
        (caixa.sul + caixa.norte) / 2,
        (caixa.oeste + caixa.leste) / 2,
      ) <= raioKm
    ) {
      return true;
    }
  }
  return false;
}

/*
  Rótulos que não se pisam.

  No DSEI Bahia os nomes saíam uns por cima dos outros — "Tuxá", "Pankarú" e
  "Kiriri" sobrepostos no mesmo punhado de pixels, ilegíveis os três. A terra
  maior fica com o rótulo; as que caem perto demais dele ficam sem, e continuam
  a ter o nome no ponteiro.

  Trabalha em pixels de ecrã porque é isso que decide a leitura, e recebe as
  posições já projetadas para poder ser verificada sem mapa nenhum.
*/
export const DISTANCIA_MINIMA_ENTRE_ROTULOS_PX = 64;

export function rotulosSemColisao<
  C extends { x?: number | undefined; y?: number | undefined; peso?: number },
>(
  candidatos: readonly C[] | null | undefined,
  distanciaMinima: number = DISTANCIA_MINIMA_ENTRE_ROTULOS_PX,
): C[] {
  const aceites: { candidato: C; x: number; y: number }[] = [];
  const ordenados = [...(candidatos || [])].sort(
    (a, b) => (b.peso ?? 0) - (a.peso ?? 0),
  );
  for (const candidato of ordenados) {
    const { x, y } = candidato;
    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    )
      continue;
    const colide = aceites.some(
      (aceite) => Math.hypot(aceite.x - x, aceite.y - y) < distanciaMinima,
    );
    if (!colide) aceites.push({ candidato, x, y });
  }
  return aceites.map((aceite) => aceite.candidato);
}
