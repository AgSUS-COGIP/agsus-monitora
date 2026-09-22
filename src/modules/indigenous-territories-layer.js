const STORAGE_KEY = "agsus_map_terras_indigenas_v1";

export const FUNAI_TERRITORIES_WMS =
  "https://geoserver.funai.gov.br/geoserver/Funai/wms";
export const FUNAI_TERRITORIES_WFS =
  "https://geoserver.funai.gov.br/geoserver/Funai/ows";
export const FUNAI_TERRITORIES_LAYER = "Funai:tis_poligonais";

export const FUNAI_PROXY_WMS = "/api/funai-wms";
export const FUNAI_PROXY_GEOJSON = "/api/funai-geodata";

/*
  O CATÁLOGO LOCAL, E POR QUE ELE EXISTE

  O mapa pedia a geometria à Funai a cada movimento. O enquadramento vira um
  bbox de floats crus, dois arrastos seguidos nunca partilham URL, e por isso
  nenhuma cache acertava. Medido contra o GeoServer:

      um enquadramento (250 polígonos no máximo)   677 ms   23 terras   1,22 MB
      o mesmo enquadramento, um pixel ao lado      507 ms   23 terras   1,22 MB

  Meio segundo por arrasto, e 1,22 MB para desenhar 23 terras.

  `scripts/compilar-terras-indigenas.mjs` traz as 665 de uma vez, simplifica a
  111 metros e guarda 2,2 MB — 0,61 MB comprimido, menos de metade do que
  custava UM enquadramento. Carrega-se uma vez, fica em memória, e a partir daí
  enquadrar, filtrar por distrito e limpar o filtro não tocam na rede.

  Isto também remove um teto que estragava o filtro: com o distrito aberto
  pedia-se o enquadramento inteiro limitado a 250 polígonos e só depois se
  descartava o que não era dali — gastando o teto com terras a deitar fora.
  Agora filtra-se primeiro, sobre as 665.

  A Funai continua a ser a fonte, e continua a ser o recurso quando o catálogo
  não carrega.
*/
export const CATALOGO_DE_TERRAS = "/data/terras-indigenas.json";

/*
  O CATÁLOGO LARGO, E POR QUE SÃO DOIS

  A visão nacional desenhava o raster da Funai — uma imagem só, recolorida por
  inteiro. Uma imagem não sabe distinguir fase: a legenda prometia terra
  homologada, terra em processo e terra em estudo, e o mapa do Brasil mostrava
  tudo da mesma cor.

  O piso de zoom que mandava no raster existia porque, antes do catálogo, pedir
  a geometria abaixo dele traria o país inteiro da Funai. Esse motivo morreu: o
  catálogo JÁ é o país inteiro, e está em memória.

  O que sobra é o custo de desenhar. No zoom 4 um pixel vale ~9,8 km, e os
  113.864 vértices do catálogo fino desenham detalhe que o ecrã não resolve
  enquanto o Leaflet paga por cada um. O largo, simplificado a 1113 metros —
  pouco mais de um décimo de pixel nessa escala —, tem 17.598 vértices e 0,43 MB.

  Carrega primeiro, e é o que a visão nacional usa.
*/
export const CATALOGO_DE_TERRAS_LARGO = "/data/terras-indigenas-largo.json";

/*
  Onde se troca um pelo outro. A 1113 metros de tolerância, o desvio passa a
  valer um pixel por volta do zoom 7 — que é também onde se deixa de ver o país
  e se passa a ver um distrito.
*/
export const ZOOM_DO_CATALOGO_FINO = 7;

export function catalogoParaOZoom(zoom) {
  return Number(zoom) >= ZOOM_DO_CATALOGO_FINO
    ? CATALOGO_DE_TERRAS
    : CATALOGO_DE_TERRAS_LARGO;
}
export const CATALOGO_DE_TERRAS_EM_ESTUDO =
  "/data/terras-indigenas-em-estudo.json";

/*
  Um pedido só por catálogo, para a aplicação inteira: o mapa nacional e o do
  território partilham as mesmas promessas. Falha guarda `null` e não volta a
  tentar em cascata — quem chamar a seguir recebe o mesmo `null` e usa o recurso.
*/
const catalogosEmCurso = new Map();

export function carregarCatalogo(url, buscar) {
  const fonte = typeof buscar === "function" ? buscar : globalThis.fetch;
  if (typeof fonte !== "function") return Promise.resolve(null);
  // `Promise.resolve().then` porque um fetch que ATIRA — em vez de rejeitar —
  // escapava ao catch abaixo e partia o mapa em vez de cair no recurso.
  return Promise.resolve()
    .then(() =>
      fonte(url, {
        cache: "force-cache",
        headers: { Accept: "application/geo+json,application/json" },
      }),
    )
    .then((resposta) => {
      if (!resposta?.ok) throw new Error(`HTTP ${resposta?.status}`);
      return resposta.json();
    })
    .then((corpo) => (Array.isArray(corpo?.features) ? corpo : null))
    .catch((erro) => {
      console.warn("Catálogo de Terras Indígenas indisponível.", erro);
      return null;
    });
}

export function reiniciarCatalogo() {
  catalogosEmCurso.clear();
}

function obterCatalogo(url, buscar) {
  if (!catalogosEmCurso.has(url)) {
    catalogosEmCurso.set(url, carregarCatalogo(url, buscar));
  }
  return catalogosEmCurso.get(url);
}

const VECTOR_MAX_FEATURES = 250;
const VECTOR_REFRESH_DELAY_MS = 220;

/*
  Acima disto o mapa deixa de ganhar com os rótulos e passa a perder: nomes
  sobrepostos escondem o traçado das próprias terras e as unidades de saúde.
  Numa vista de DSEI as terras cabem bem abaixo do limite; numa vista ampla do
  Amazonas não cabem, e aí o nome volta a ser só no ponteiro.
*/
const LIMITE_DE_ROTULOS_NO_MAPA = 40;

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
const RAIO_DO_SIMBOLO_PX = 8;

export const AVISO_DO_SIMBOLO =
  "<i>Área pequena nesta escala — o círculo marca a posição, não o limite</i>";

let installed = false;
let dseiFeaturesPromise = null;

export function isHealthMapElementId(value) {
  const id = typeof value === "string" ? value : String(value?.id || "");
  return id === "map" || id === "detailMap";
}

/*
  `terrai_nome` é o nome que a Funai publica hoje em `Funai:tis_poligonais`.
  Consultado o DescribeFeatureType do GeoServer, os atributos são: gid,
  terrai_codigo, terrai_nome, etnia_nome, municipio_nome, uf_sigla,
  superficie_perimetro_ha, fase_ti, modalidade_ti, reestudo_ti, cr,
  faixa_fronteira, undadm_codigo, undadm_nome, undadm_sigla, the_geom,
  dominio_uniao, data_atualizacao, epsg.

  A lista abaixo começava em `terrai_nom` — sem o "e" final, como o shapefile
  trunca — e nenhum dos outros nomes existe na camada. O resultado era string
  vazia para todo polígono, e o tooltip da Terra Indígena nunca aparecia. Os
  nomes antigos ficam como reserva, caso a Funai republique com o esquema de
  shapefile.
*/
export function funaiFeatureName(properties = {}) {
  return String(
    properties.terrai_nome ||
      properties.terrai_nom ||
      properties.terra_nome ||
      properties.ti_nome ||
      properties.nome ||
      properties.name ||
      "",
  ).trim();
}

/*
  Quem olha o mapa do DSEI quer saber que povos ele atende — não o nome
  cartorial do polígono. A Funai declara isso em `etnia_nome`, num só campo de
  texto e com separador inconsistente: "Pataxó, Pataxo Há-Há-Há" numa linha,
  "Guaraní e Kaingang e Xetá" noutra. Os dois casos são reais e foram vistos na
  camada publicada.

  Nada é inferido: se o campo vier vazio, a lista vem vazia e o mapa não afirma
  povo nenhum.
*/
export function povosDaTerraIndigena(properties = {}) {
  const bruto = String(
    properties.etnia_nome || properties.etnias || properties.etnia || "",
  );

  const vistos = new Set();
  const povos = [];
  for (const parte of bruto.split(/\s*(?:,|;|\/|\se\s)\s*/i)) {
    const nome = parte.trim();
    if (!nome) continue;
    const chave = nome.toLocaleLowerCase("pt-BR");
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    povos.push(nome);
  }
  return povos;
}

const escaparHtml = (valor) =>
  String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/*
  O povo vem primeiro e em destaque; a Terra Indígena, que é o recorte
  fundiário, vem abaixo. Sem `etnia_nome` o polígono continua identificado pelo
  nome da terra — é melhor do que não dizer nada, e não inventa atendimento.
*/
export function tooltipDaTerraIndigena(properties = {}) {
  const povos = povosDaTerraIndigena(properties);
  const nome = funaiFeatureName(properties);
  const uf = String(properties?.uf_sigla || "").trim();

  const linhas = [];
  if (povos.length) {
    linhas.push(
      `<b>${escaparHtml(povos.length === 1 ? "Povo" : "Povos")}: ${escaparHtml(povos.join(", "))}</b>`,
    );
  }
  if (nome) {
    linhas.push(
      `${povos.length ? "" : "<b>"}Terra Indígena ${escaparHtml(nome)}${povos.length ? "" : "</b>"}`,
    );
  }
  if (uf) linhas.push(escaparHtml(uf));

  return linhas.join("<br>");
}

/*
  Quanto ocupa a terra no ecrã, em pixels, na sua maior dimensão. `projetar`
  é a projeção do mapa; separá-la daqui é o que torna isto verificável sem
  Leaflet nem navegador.
*/
export function tamanhoNaTelaEmPixels(limites, projetar) {
  const ne = projetar(limites.getNorthEast());
  const sw = projetar(limites.getSouthWest());
  if (![ne?.x, ne?.y, sw?.x, sw?.y].every(Number.isFinite)) return 0;
  return Math.max(Math.abs(ne.x - sw.x), Math.abs(ne.y - sw.y));
}

export function terraPrecisaDeSimbolo(tamanhoEmPixels) {
  return Number(tamanhoEmPixels) < SIMBOLO_ABAIXO_DE_PX;
}

/*
  O rótulo desenhado sobre o polígono, ao contrário do tooltip, compete por
  espaço com tudo o resto no mapa. Leva o povo — que é o que se quer ver — e
  cala o resto. Com muitos povos na mesma terra, dois e a contagem do que
  sobra; escrever cinco nomes numa linha ocuparia meio estado.
*/
export function rotuloDaTerraIndigena(properties = {}) {
  const povos = povosDaTerraIndigena(properties);
  if (!povos.length) return funaiFeatureName(properties);
  if (povos.length <= 2) return povos.join(", ");
  return `${povos.slice(0, 2).join(", ")} +${povos.length - 2}`;
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
  pedido a `Funai:areas_dsei` responde "Feature type unknown", e é por isso que
  `/api/funai-geodata?dataset=dsei` devolve 502 em produção.

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

function distanciaEmKm(latA, lonA, latB, lonB) {
  const rad = (grau) => (grau * Math.PI) / 180;
  const dLat = rad(latB - latA);
  const dLon = rad(lonB - lonA);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(latA)) * Math.cos(rad(latB)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAIO_DA_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function caixaDeCoordenadas(poligonos) {
  let oeste = 180;
  let leste = -180;
  let sul = 90;
  let norte = -90;
  for (const poligono of poligonos || []) {
    for (const [x, y] of poligono[0] || []) {
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

export function caixaDaFeature(feature) {
  if (!feature || typeof feature !== "object") return null;
  if (feature[CAIXA]) return feature[CAIXA];
  const poligonos = poligonosDaFeature(feature);
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
export function povosDaFeature(propriedades) {
  return String(propriedades?.etnia_nome ?? "")
    .split(/\s*[,;/]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function resumoDasTerras(features = []) {
  const porNome = new Map();

  for (const f of Array.isArray(features) ? features : []) {
    const nome = String(f?.properties?.terrai_nome ?? "").trim();
    if (!nome) continue;
    if (!porNome.has(nome)) {
      porNome.set(nome, {
        nome,
        povos: [],
        ufs: [],
        fase: String(f?.properties?.fase_ti ?? "").trim(),
      });
    }
    const terra = porNome.get(nome);
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

export function caixasSeIntersectam(a, b) {
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
export function terrasNoEnquadramento(features, caixaDoMapa) {
  if (!Array.isArray(features)) return [];
  if (!caixaDoMapa) return features;
  return features.filter((f) =>
    caixasSeIntersectam(caixaDaFeature(f), caixaDoMapa),
  );
}

export function caixaDoMapa(bounds) {
  const oeste = Number(bounds?.getWest?.());
  const leste = Number(bounds?.getEast?.());
  const sul = Number(bounds?.getSouth?.());
  const norte = Number(bounds?.getNorth?.());
  if (![oeste, leste, sul, norte].every(Number.isFinite)) return null;
  return { oeste, leste, sul, norte };
}

export function poligonosDaFeature(feature) {
  const tipo = feature?.geometry?.type;
  if (tipo === "Polygon") return [feature.geometry.coordinates];
  if (tipo === "MultiPolygon") return feature.geometry.coordinates;
  return [];
}

function pontoEmAnel(ponto, anel) {
  const [x, y] = ponto;
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i, i += 1) {
    const [xi, yi] = anel[i];
    const [xj, yj] = anel[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      dentro = !dentro;
    }
  }
  return dentro;
}

export function pontoEmPoligonos(ponto, poligonos) {
  return (poligonos || []).some(
    (poligono) =>
      pontoEmAnel(ponto, poligono[0] || []) &&
      !poligono.slice(1).some((buraco) => pontoEmAnel(ponto, buraco)),
  );
}

export function terraPertenceAoDsei(
  terra,
  unidadesDoDsei,
  ufsDoDsei = [],
  raioKm = RAIO_DE_ATENDIMENTO_KM,
) {
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

export function rotulosSemColisao(
  candidatos,
  distanciaMinima = DISTANCIA_MINIMA_ENTRE_ROTULOS_PX,
) {
  const aceites = [];
  const ordenados = [...(candidatos || [])].sort(
    (a, b) => (b.peso ?? 0) - (a.peso ?? 0),
  );
  for (const candidato of ordenados) {
    const { x, y } = candidato;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const colide = aceites.some(
      (aceite) => Math.hypot(aceite.x - x, aceite.y - y) < distanciaMinima,
    );
    if (!colide) aceites.push(candidato);
  }
  return aceites;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\bDSEI\b/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function dseiFeatureName(properties = {}) {
  const preferred = [
    "dsei",
    "nome_dsei",
    "nom_dsei",
    "dsei_nome",
    "ds_nome",
    "nome",
    "name",
  ];
  for (const key of preferred) {
    const value = String(properties?.[key] || "").trim();
    if (value) return value;
  }

  for (const [key, raw] of Object.entries(properties || {})) {
    if (!/(dsei|nome|name)/i.test(key)) continue;
    const value = String(raw || "").trim();
    if (value) return value;
  }
  return "";
}

export function dseiFeatureMatches(feature, dseiName) {
  const target = normalizeText(dseiName);
  if (!target) return false;

  const properties = feature?.properties || {};
  const candidates = new Set(
    [
      dseiFeatureName(properties),
      ...Object.entries(properties)
        .filter(
          ([key, value]) => /(dsei|nome|name)/i.test(key) && value != null,
        )
        .map(([, value]) => String(value)),
    ]
      .map(normalizeText)
      .filter(Boolean),
  );

  for (const candidate of candidates) {
    if (candidate === target) return true;
    if (
      candidate.length >= 6 &&
      target.length >= 6 &&
      (candidate.includes(target) || target.includes(candidate))
    ) {
      return true;
    }
  }
  return false;
}

export function funaiViewportUrl(bounds) {
  const west = Number(bounds?.getWest?.());
  const south = Number(bounds?.getSouth?.());
  const east = Number(bounds?.getEast?.());
  const north = Number(bounds?.getNorth?.());
  if (![west, south, east, north].every(Number.isFinite)) return "";

  const params = new URLSearchParams({
    dataset: "territories",
    maxFeatures: String(VECTOR_MAX_FEATURES),
    bbox: [west, south, east, north].join(","),
  });
  return `${FUNAI_PROXY_GEOJSON}?${params.toString()}`;
}

export function funaiDseiUrl() {
  return `${FUNAI_PROXY_GEOJSON}?dataset=dsei`;
}

export function funaiEstudoUrl() {
  return `${FUNAI_PROXY_GEOJSON}?dataset=estudo`;
}

/*
  AS TERRAS QUE AINDA NÃO TÊM LIMITE

  A camada de polígonos traz seis fases — Regularizada, Declarada, Delimitada,
  Encaminhada RI, Homologada e Em Estudo —, mas só quem já tem limite
  desenhado. As 163 terras em estudo sem limite definido existem apenas como
  ponto, noutra camada.

  Sem elas o mapa mostrava polos base aparentemente fora de qualquer terra
  indígena. Medido: dos 146 polos fora de polígono, nove estão a menos de 5 km
  de uma terra em estudo, e o polo de João Câmara está a 60 metros da TI
  Mendonça do Amarelão. Esses polos atendem terra indígena — é a terra que
  ainda não tem limite publicado.

  O DESENHO TEM DE DIZER QUE NÃO É LIMITE

  Um círculo tracejado, oco, do tamanho de um marcador. Não é a área da terra,
  porque a área não existe ainda: é a posição que a Funai regista enquanto o
  estudo corre. Preenchê-lo ou desenhá-lo como polígono seria afirmar uma
  extensão que nenhum documento sustenta.
*/
export const AVISO_DE_ESTUDO =
  "<i>Terra Indígena em estudo — sem limite publicado; o círculo marca a posição</i>";

export function tooltipDaTerraEmEstudo(properties = {}) {
  const povos = povosDaTerraIndigena(properties);
  const nome = funaiFeatureName(properties);
  const uf = String(properties?.uf_sigla || "").trim();

  const linhas = [];
  if (povos.length) {
    linhas.push(
      `<b>${escaparHtml(povos.length === 1 ? "Povo" : "Povos")}: ${escaparHtml(povos.join(", "))}</b>`,
    );
  }
  if (nome) linhas.push(`Terra Indígena ${escaparHtml(nome)}`);
  if (uf) linhas.push(escaparHtml(uf));
  linhas.push(AVISO_DE_ESTUDO);
  return linhas.join("<br>");
}

function supportsHover() {
  try {
    return window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches;
  } catch {
    return false;
  }
}

async function loadDseiFeatures() {
  if (dseiFeaturesPromise) return dseiFeaturesPromise;
  dseiFeaturesPromise = fetch(funaiDseiUrl(), {
    cache: "force-cache",
    headers: { Accept: "application/geo+json,application/json" },
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`FUNAI DSEI HTTP ${response.status}`);
      const geojson = await response.json();
      if (!Array.isArray(geojson?.features))
        throw new Error("GeoJSON de DSEI inválido");
      return geojson;
    })
    .catch((error) => {
      dseiFeaturesPromise = null;
      throw error;
    });
  return dseiFeaturesPromise;
}

export function installIndigenousTerritoriesLayer() {
  if (installed) return true;
  const L = window.L;
  if (!L?.map || !L.tileLayer?.wms || !L.control || !L.DomUtil || !L.DomEvent)
    return false;
  if (L.__agsusIndigenousTerritoriesInstalled) {
    installed = true;
    return true;
  }

  const originalMap = L.map;
  L.map = function agsusMapWithIndigenousTerritories(element, options = {}) {
    const map = originalMap.call(this, element, options);
    if (isHealthMapElementId(element)) enhanceMap(L, map);
    return map;
  };

  L.__agsusIndigenousTerritoriesInstalled = true;
  installed = true;
  return true;
}

function enhanceMap(L, map) {
  if (!map || map.__agsusIndigenousTerritoriesReady) return;
  map.__agsusIndigenousTerritoriesReady = true;

  const mapElementId = String(map.getContainer?.()?.id || "");

  const rasterPaneName = "agsus-indigenous-territories";
  const rasterPane =
    map.getPane?.(rasterPaneName) || map.createPane?.(rasterPaneName);
  if (rasterPane?.style) {
    rasterPane.style.zIndex = "250";
    rasterPane.style.pointerEvents = "none";
    // O raster vem verde da Funai. Ver o comentário de FILTRO_DO_RASTER.
    rasterPane.style.filter = FILTRO_DO_RASTER;
  }

  const dseiPaneName = "agsus-dsei-coverage";
  const dseiPane =
    map.getPane?.(dseiPaneName) || map.createPane?.(dseiPaneName);
  if (dseiPane?.style) {
    dseiPane.style.zIndex = "253";
    dseiPane.style.pointerEvents = supportsHover() ? "auto" : "none";
  }

  const vectorPaneName = "agsus-indigenous-territories-vector";
  const vectorPane =
    map.getPane?.(vectorPaneName) || map.createPane?.(vectorPaneName);
  if (vectorPane?.style) {
    vectorPane.style.zIndex = "255";
    vectorPane.style.pointerEvents = supportsHover() ? "auto" : "none";
  }

  /*
    Os rótulos ficam acima do traçado das terras e abaixo dos marcadores das
    unidades — o painel do MONITORA é de saúde, e um nome de povo não pode
    tapar um polo base. Sem eventos de ponteiro: o rótulo não intercepta nem o
    clique no marcador nem o hover no polígono que ele cobre.
  */
  const rotulosPaneName = "agsus-indigenous-territories-labels";
  const rotulosPane =
    map.getPane?.(rotulosPaneName) || map.createPane?.(rotulosPaneName);
  if (rotulosPane?.style) {
    rotulosPane.style.zIndex = "256";
    rotulosPane.style.pointerEvents = "none";
  }

  /*
    O GeoServer oficial da Funai bloqueia requisições de navegador com Origin.
    O raster e o WFS passam por endpoints same-origin estreitos e allowlisted.
    Assim a camada nacional deixa de depender de CORS, sem copiar a base oficial
    para dentro do repositório.
  */
  const rasterLayer = L.tileLayer.wms(FUNAI_PROXY_WMS, {
    layers: FUNAI_TERRITORIES_LAYER,
    format: "image/png",
    transparent: true,
    version: "1.1.1",
    // Abaixo do zoom 7 este raster é a única representação das terras. Em 0.34
    // ele lia-se como sombra do mapa base; acompanha o destaque do vetorial.
    opacity: 0.52,
    pane: rasterPaneName,
    attribution: "Terras Indígenas: Funai",
    updateWhenIdle: false,
    keepBuffer: 3,
    detectRetina: true,
  });
  rasterLayer.__agsusOverlayKind = "indigenous-territories";
  map.__agsusIndigenousTerritoriesLayer = rasterLayer;

  const vectorLayer = L.geoJSON([], {
    pane: vectorPaneName,
    interactive: supportsHover(),
    style: (feature) => vectorStyle(map, feature),
    onEachFeature: (feature, layer) => {
      if (!supportsHover()) return;
      const texto = tooltipDaTerraIndigena(feature?.properties);
      if (!texto) return;
      layer.bindTooltip(texto, {
        sticky: true,
        direction: "top",
        className: "agsus-ti-tooltip",
      });
    },
  });
  map.__agsusIndigenousTerritoriesVectorLayer = vectorLayer;

  const rotulosLayer = L.layerGroup([], { pane: rotulosPaneName });
  map.__agsusIndigenousTerritoriesLabelsLayer = rotulosLayer;

  const simbolosLayer = L.layerGroup([], { pane: vectorPaneName });
  map.__agsusIndigenousTerritoriesSymbolsLayer = simbolosLayer;

  /*
    As terras em estudo são 163 pontos no país e não mudam com o enquadramento:
    carregam-se uma vez, ficam em memória, e cada mapa desenha as suas.
  */
  const estudoLayer = L.layerGroup([], { pane: vectorPaneName });
  map.__agsusTerrasEmEstudoLayer = estudoLayer;
  let estudoGeojson = null;

  const desenharEstudo = () => {
    estudoLayer.clearLayers();
    if (!estudoGeojson?.features || !visible()) {
      if (map.hasLayer(estudoLayer)) map.removeLayer(estudoLayer);
      return;
    }

    const doDistrito = unidadesDoDsei.length
      ? estudoGeojson.features.filter((f) =>
          terraPertenceAoDsei(
            {
              ...f,
              geometry: {
                type: "Polygon",
                coordinates: [[f.geometry?.coordinates || [0, 0]]],
              },
            },
            unidadesDoDsei,
            ufsDoDsei,
          ),
        )
      : estudoGeojson.features;

    for (const f of doDistrito) {
      const [lon, lat] = f.geometry?.coordinates || [];
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const marca = L.circleMarker([lat, lon], {
        pane: vectorPaneName,
        radius: RAIO_DO_SIMBOLO_PX,
        interactive: supportsHover(),
        color: COR_DA_TERRA,
        weight: 2.2,
        opacity: 1,
        // Oco e tracejado: não há área, e o desenho não pode sugerir uma.
        fill: false,
        dashArray: "4 3",
      });
      if (supportsHover()) {
        marca.bindTooltip(tooltipDaTerraEmEstudo(f.properties), {
          direction: "top",
          className: "agsus-ti-tooltip",
        });
      }
      estudoLayer.addLayer(marca);
    }

    if (estudoLayer.getLayers().length && !map.hasLayer(estudoLayer)) {
      estudoLayer.addTo(map);
    }
  };

  const carregarEstudo = async () => {
    if (estudoGeojson) return desenharEstudo();
    // O catálogo local primeiro; a Funai fica como recurso.
    estudoGeojson =
      (await carregarCatalogo(CATALOGO_DE_TERRAS_EM_ESTUDO)) ||
      (await carregarCatalogo(funaiEstudoUrl()));
    if (!estudoGeojson) {
      // A ausência é honesta: sem esta camada o mapa continua correto, só menos
      // completo. Não se inventa ponto nenhum.
      return;
    }
    desenharEstudo();
  };

  const limparRotulos = () => {
    rotulosLayer.clearLayers();
    if (map.hasLayer(rotulosLayer)) map.removeLayer(rotulosLayer);
    simbolosLayer.clearLayers();
    if (map.hasLayer(simbolosLayer)) map.removeLayer(simbolosLayer);
  };

  let selectedDsei = "";
  let dseiGeojson = null;
  let unidadesDoDsei = [];
  let ufsDoDsei = [];
  const dseiLayer = L.geoJSON([], {
    pane: dseiPaneName,
    interactive: supportsHover(),
    style: (feature) => dseiStyle(mapElementId, feature, selectedDsei),
    onEachFeature: (feature, layer) => {
      if (!supportsHover()) return;
      const nome = dseiFeatureName(feature?.properties);
      if (!nome) return;
      layer.bindTooltip(`DSEI ${nome}`, {
        sticky: true,
        direction: "top",
        className: "agsus-dsei-tooltip",
      });
    },
  });
  map.__agsusDseiCoverageLayer = dseiLayer;

  const renderDseiCoverage = () => {
    if (!dseiGeojson?.features) return;
    dseiLayer.clearLayers();

    let features = dseiGeojson.features;
    if (mapElementId === "detailMap") {
      features = selectedDsei
        ? features.filter((feature) =>
            dseiFeatureMatches(feature, selectedDsei),
          )
        : [];
    }

    dseiLayer.addData({ type: "FeatureCollection", features });
    dseiLayer.setStyle?.((feature) =>
      dseiStyle(mapElementId, feature, selectedDsei),
    );
    if (features.length && !map.hasLayer(dseiLayer)) dseiLayer.addTo(map);
    if (!features.length && map.hasLayer(dseiLayer)) map.removeLayer(dseiLayer);

    if (mapElementId === "detailMap") {
      const bounds = features.length ? dseiLayer.getBounds?.() : null;
      map.__agsusDseiCoverageBounds =
        bounds?.isValid?.() === true ? bounds : null;
      if (map.__agsusDseiCoverageBounds) {
        map.fire?.("agsus:dsei-coverage-ready", {
          dsei: selectedDsei,
          bounds: map.__agsusDseiCoverageBounds,
        });
      }
    }
  };

  const ensureDseiCoverage = async () => {
    try {
      dseiGeojson = dseiGeojson || (await loadDseiFeatures());
      renderDseiCoverage();
    } catch (error) {
      console.warn(
        "Abrangência oficial dos DSEIs indisponível no momento.",
        error,
      );
    }
  };

  /*
    `unidades` são os pontos de saúde do distrito aberto — polos, UBSI, CASAI.
    É com eles que se decide que Terras Indígenas pertencem a este DSEI, já que
    a Funai deixou de publicar a abrangência. Quem chama passa o que já tem em
    mãos; sem lista, não se filtra nada.
  */
  map.__agsusSetDseiCoverage = (name = "", unidades = [], ufs = []) => {
    selectedDsei = String(name || "").trim();
    unidadesDoDsei = selectedDsei && Array.isArray(unidades) ? unidades : [];
    ufsDoDsei = selectedDsei && Array.isArray(ufs) ? ufs : [];
    // O enquadramento não mudou, mas o conjunto de terras a mostrar mudou.
    lastViewportKey = "";
    if (!selectedDsei) map.__agsusDseiCoverageBounds = null;
    if (dseiGeojson) renderDseiCoverage();
    else void ensureDseiCoverage();
    void carregarEstudo();
    scheduleRefresh();
  };

  if (mapElementId === "map") {
    map.whenReady?.(() => {
      void ensureDseiCoverage();
      void carregarEstudo();
    });
  }

  let requestController = null;
  let refreshTimer = 0;
  let lastViewportKey = "";

  const visible = () => map.__agsusIndigenousTerritoriesVisible !== false;

  const useRasterFallback = () => {
    if (!visible()) return;
    /*
      O raster da Funai é uma imagem do país inteiro: não sabe o que é deste
      distrito e o que é do vizinho. Com um DSEI aberto ele desfaria o filtro
      que acabámos de aplicar às terras, e voltaria a pintar Xerente no mapa da
      Bahia. Antes nada: a ausência é honesta, a imagem errada não.
    */
    if (unidadesDoDsei.length) {
      if (map.hasLayer(rasterLayer)) map.removeLayer(rasterLayer);
      return;
    }
    if (!map.hasLayer(rasterLayer)) rasterLayer.addTo(map);
  };

  const clearVector = () => {
    vectorLayer.clearLayers();
    if (map.hasLayer(vectorLayer)) map.removeLayer(vectorLayer);
    limparRotulos();
  };

  /*
    Uma passagem por todas as terras desenhadas, que decide duas coisas.

    O SÍMBOLO, para a terra pequena demais para se ver nesta escala. Medido em
    pixels no ecrã, não em quilómetros: o que decide se uma área se lê é o
    tamanho que ela tem no monitor, e isso muda a cada zoom.

    O RÓTULO, que não vai como tooltip do polígono — o polígono já usa o seu
    tooltip para o detalhe no ponteiro, e um layer do Leaflet só tem um. Vai
    como marcador sem interação, numa camada acima do traçado e abaixo das
    unidades de saúde.
  */
  const desenharApoios = (quantidade) => {
    limparRotulos();
    const comRotulo = quantidade <= LIMITE_DE_ROTULOS_NO_MAPA;
    const projetar = (ponto) => map.latLngToLayerPoint(ponto);
    const candidatos = [];

    vectorLayer.eachLayer?.((camada) => {
      const propriedades = camada?.feature?.properties;
      const limites = camada.getBounds?.();
      if (!limites?.isValid?.()) return;
      const centro = limites.getCenter();

      if (terraPrecisaDeSimbolo(tamanhoNaTelaEmPixels(limites, projetar))) {
        const simbolo = L.circleMarker(centro, {
          pane: vectorPaneName,
          radius: RAIO_DO_SIMBOLO_PX,
          interactive: supportsHover(),
          ...estiloDoSimbolo(map),
        });
        if (supportsHover()) {
          const detalhe = tooltipDaTerraIndigena(propriedades);
          if (detalhe) {
            simbolo.bindTooltip(`${detalhe}<br>${AVISO_DO_SIMBOLO}`, {
              direction: "top",
              className: "agsus-ti-tooltip",
            });
          }
        }
        simbolosLayer.addLayer(simbolo);
      }

      if (!comRotulo) return;
      const texto = rotuloDaTerraIndigena(propriedades);
      if (!texto) return;
      const ponto = projetar(centro);
      candidatos.push({
        x: ponto?.x,
        y: ponto?.y,
        centro,
        texto,
        // A terra maior ganha o rótulo quando dois disputam o mesmo espaço.
        peso: tamanhoNaTelaEmPixels(limites, projetar),
      });
    });

    for (const rotulo of rotulosSemColisao(candidatos)) {
      rotulosLayer.addLayer(
        L.marker(rotulo.centro, {
          pane: rotulosPaneName,
          interactive: false,
          keyboard: false,
          icon: L.divIcon({
            className: "agsus-ti-rotulo",
            html: `<span class="agsus-ti-rotulo__texto">${escaparHtml(rotulo.texto)}</span>`,
            iconSize: [0, 0],
          }),
        }),
      );
    }

    if (simbolosLayer.getLayers().length && !map.hasLayer(simbolosLayer)) {
      simbolosLayer.addTo(map);
    }
    if (rotulosLayer.getLayers().length && !map.hasLayer(rotulosLayer)) {
      rotulosLayer.addTo(map);
    }
  };

  const refreshVector = async () => {
    if (!visible()) return;
    const zoom = Number(map.getZoom?.());

    /*
      NÃO HÁ MAIS PISO DE ZOOM.

      Havia um, de 7, e abaixo dele o raster da Funai tomava conta. A razão era
      que, sem catálogo, pedir a geometria nessa escala traria o país inteiro —
      e essa razão morreu quando o catálogo chegou: ele JÁ é o país inteiro.

      O que ficava no lugar era pior do que lento: o raster é uma imagem só,
      recolorida por inteiro, e não sabe distinguir fase. A legenda prometia
      três coisas e o mapa nacional mostrava uma. Agora quem desenha é sempre o
      vetorial — largo abaixo do zoom 7, fino a partir dele — e o raster passa a
      ser só o recurso de quando o catálogo não carrega.
    */
    if (!Number.isFinite(zoom)) {
      clearVector();
      useRasterFallback();
      return;
    }

    const bounds = map.getBounds?.();
    const caixa = caixaDoMapa(bounds);
    if (!caixa) return;

    /*
      A chave mudou de propósito. Antes era a URL do pedido — floats crus, nunca
      repetidos, o que forçava um pedido novo a cada pixel arrastado. Agora é o
      enquadramento arredondado mais o distrito aberto: arrastos pequenos dentro
      da mesma casa decimal não redesenham nada, e mudar de distrito redesenha
      sempre, mesmo sem mexer a câmara.
    */
    const urlDoCatalogo = catalogoParaOZoom(zoom);

    /*
      O catálogo entra na chave: cruzar o zoom 7 troca de ficheiro, e sem isso o
      mapa ficaria com o traçado largo depois de aproximar.
    */
    const key = [
      urlDoCatalogo,
      zoom.toFixed(1),
      caixa.oeste.toFixed(2),
      caixa.sul.toFixed(2),
      caixa.leste.toFixed(2),
      caixa.norte.toFixed(2),
      selectedDsei || "",
    ].join("|");
    if (key === lastViewportKey) return;
    lastViewportKey = key;

    const catalogo = await obterCatalogo(urlDoCatalogo);
    const doEnquadramento = catalogo
      ? terrasNoEnquadramento(catalogo.features, caixa)
      : await terrasDaFunai(bounds);
    if (!doEnquadramento) {
      clearVector();
      useRasterFallback();
      return;
    }

    /*
      Com um DSEI aberto, só entram as terras que tocam a abrangência dele. Sem
      isso o mapa da Bahia mostrava Xerente e Xacriabá, que são de outros
      distritos, e quem olhava não tinha como saber a diferença.
    */
    const doDistrito = unidadesDoDsei.length
      ? doEnquadramento.filter((f) =>
          terraPertenceAoDsei(f, unidadesDoDsei, ufsDoDsei),
        )
      : doEnquadramento;

    /*
      A LISTA É DO DISTRITO, O DESENHO É DO ENQUADRAMENTO

      A lista saía de `doDistrito`, que já passou pelo recorte do ecrã. Quem
      aproximasse o mapa num posto de saúde via "Terras Indígenas e povos: 0"
      num distrito que tem dezenas delas — o painel respondia à pergunta
      "o que cabe no ecrã", e a pergunta é "o que este DSEI atende".

      O recorte do enquadramento continua a existir, e tem de continuar: são
      665 terras, e o Leaflet paga por cada traçado. Mas ele é sobre o desenho,
      não sobre a lista.
    */
    if (catalogo) {
      const doDistritoInteiro = unidadesDoDsei.length
        ? catalogo.features.filter((f) =>
            terraPertenceAoDsei(f, unidadesDoDsei, ufsDoDsei),
          )
        : doDistrito;
      map.__agsusAoMudarTerras?.(resumoDasTerras(doDistritoInteiro));
    }

    vectorLayer.clearLayers();
    vectorLayer.addData({ type: "FeatureCollection", features: doDistrito });
    vectorLayer.setStyle?.((feature) => vectorStyle(map, feature));
    if (!map.hasLayer(vectorLayer)) vectorLayer.addTo(map);
    if (map.hasLayer(rasterLayer)) map.removeLayer(rasterLayer);
    desenharApoios(doDistrito.length);
  };

  /*
    O caminho antigo, agora só como recurso: se o catálogo local não carregar,
    volta-se a pedir à Funai por enquadramento. Devolve `null` quando também
    isso falha, e aí o raster toma conta.
  */
  const terrasDaFunai = async (bounds) => {
    const url = funaiViewportUrl(bounds);
    if (!url) return null;
    requestController?.abort?.();
    requestController = new AbortController();
    try {
      const response = await fetch(url, {
        signal: requestController.signal,
        cache: "force-cache",
        headers: { Accept: "application/geo+json,application/json" },
      });
      if (!response.ok) throw new Error(`FUNAI WFS HTTP ${response.status}`);
      const geojson = await response.json();
      if (!Array.isArray(geojson?.features))
        throw new Error("GeoJSON inválido");
      return geojson.features;
    } catch (error) {
      if (error?.name === "AbortError") return null;
      console.warn(
        "Camada vetorial de Terras Indígenas indisponível; usando WMS da Funai.",
        error,
      );
      return null;
    }
  };

  const scheduleRefresh = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshVector, VECTOR_REFRESH_DELAY_MS);
  };

  map.on("moveend zoomend", scheduleRefresh);
  map.getContainer?.().addEventListener("agsus:map-base-layer-changed", () => {
    vectorLayer.setStyle?.((feature) => vectorStyle(map, feature));
    simbolosLayer.eachLayer?.((simbolo) =>
      simbolo.setStyle?.(estiloDoSimbolo(map)),
    );
    dseiLayer.setStyle?.((feature) =>
      dseiStyle(mapElementId, feature, selectedDsei),
    );
  });

  const desired = readStoredVisibility();
  map.__agsusIndigenousTerritoriesVisible = desired;
  if (desired) {
    rasterLayer.addTo(map);
    map.whenReady?.(scheduleRefresh);
  }
  addControl(L, map, rasterLayer, vectorLayer, desired, scheduleRefresh, () => {
    limparRotulos();
    lastViewportKey = "";
  });
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
  especificação de filtros —, de modo que o resultado não se adivinha. Aplicada
  a #4daf4a, a cadeia em FILTRO_DO_RASTER dá #e030a6, e é esse valor, e não um
  magenta escolhido à parte, que COR_DA_TERRA usa. Assim o traço não muda de
  cor quando o mapa troca o raster pelo vetorial, no zoom 7.

  O contraste sobre satélite continua a vir também do traço, mais grosso, com
  o preenchimento discreto para não tapar a imagem que se foi ver.
*/
const FILTRO_DO_RASTER = "hue-rotate(218deg) saturate(3) brightness(0.88)";
const COR_DA_TERRA = "#e030a6";
const PREENCHIMENTO_DA_TERRA = "#f472d0";

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

  Mantém-se a matiz: as duas são magenta, pela mesma razão de antes (nada na
  paisagem é magenta, e não colide com o azul do DSEI). O que muda é o valor —
  a definitiva é cheia e escura, a que está em processo é clara e tracejada.
  Tracejado, porque uma linha interrompida é como um limite provisório se
  desenha em cartografia desde sempre.
*/
const FASES_DEFINITIVAS = new Set(["REGULARIZADA", "HOMOLOGADA"]);

export function faseDaTerra(propriedades) {
  const fase = String(propriedades?.fase_ti ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
  if (!fase) return "desconhecida";
  if (FASES_DEFINITIVAS.has(fase)) return "definitiva";
  if (fase.includes("ESTUDO")) return "em_estudo";
  return "em_processo";
}

const COR_EM_PROCESSO = "#f9a8d4";

/*
  Sem fase declarada desenha-se como definitiva, e não como provisória: dizer
  "ainda em processo" sobre uma terra que talvez esteja regularizada é afirmar
  mais do que se sabe, e na direção que pesa contra quem lá vive.
*/
export function estiloDaFase(fase, satellite) {
  if (fase === "em_processo") {
    return {
      color: COR_EM_PROCESSO,
      weight: satellite ? 3 : 2.4,
      dashArray: "7 5",
      fillColor: COR_EM_PROCESSO,
      fillOpacity: satellite ? 0.1 : 0.14,
    };
  }
  return {
    color: COR_DA_TERRA,
    weight: satellite ? 3.2 : 2.4,
    dashArray: null,
    fillColor: PREENCHIMENTO_DA_TERRA,
    fillOpacity: satellite ? 0.18 : 0.26,
  };
}

function estiloDoSimbolo(map) {
  const satellite = map?.__agsusBaseMapMode === "satellite";
  return {
    color: COR_DA_TERRA,
    weight: satellite ? 2.8 : 2.2,
    opacity: 1,
    fillColor: PREENCHIMENTO_DA_TERRA,
    fillOpacity: 0.45,
  };
}

function vectorStyle(map, feature) {
  const satellite = map?.__agsusBaseMapMode === "satellite";
  return {
    opacity: 1,
    ...estiloDaFase(faseDaTerra(feature?.properties), satellite),
  };
}

function dseiStyle(mapElementId, feature, selectedDsei) {
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

function addControl(
  L,
  map,
  rasterLayer,
  vectorLayer,
  initialVisible,
  scheduleRefresh,
  aoOcultar,
) {
  if (map.__agsusIndigenousTerritoriesControl) return;
  const control = L.control({ position: "topright" });
  control.onAdd = () => {
    const container = L.DomUtil.create(
      "div",
      "leaflet-control agsus-indigenous-territories-control",
    );
    const button = L.DomUtil.create(
      "button",
      "agsus-indigenous-territories-control__button",
      container,
    );
    button.type = "button";
    button.innerHTML =
      '<span class="agsus-indigenous-territories-control__swatch" aria-hidden="true"></span><span>Terras Indígenas</span>';
    button.title = "Mostrar ou ocultar Terras Indígenas (Funai)";
    button.setAttribute("aria-label", button.title);

    const sync = () => {
      const current = map.__agsusIndigenousTerritoriesVisible !== false;
      button.classList.toggle("is-active", current);
      button.setAttribute("aria-pressed", current ? "true" : "false");
      container.dataset.visible = current ? "true" : "false";
    };

    button.addEventListener("click", () => {
      const next = !(map.__agsusIndigenousTerritoriesVisible !== false);
      map.__agsusIndigenousTerritoriesVisible = next;
      /*
        `aoOcultar` também zera a chave do último enquadramento. Sem isso,
        reativar a camada sem mexer no mapa caía no atalho de "mesmo
        enquadramento, nada a fazer" do `refreshVector`: o botão acendia e os
        polígonos não voltavam até alguém arrastar o mapa.
      */
      aoOcultar?.();
      if (!next) {
        map.removeLayer(rasterLayer);
        map.removeLayer(vectorLayer);
      } else {
        rasterLayer.addTo(map);
        scheduleRefresh();
      }
      storeVisibility(next);
      sync();
    });

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
    button.setAttribute("aria-pressed", initialVisible ? "true" : "false");
    sync();
    return container;
  };
  control.addTo(map);
  map.__agsusIndigenousTerritoriesControl = control;
}

function readStoredVisibility() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value == null ? true : value !== "0";
  } catch {
    return true;
  }
}

function storeVisibility(visible) {
  try {
    localStorage.setItem(STORAGE_KEY, visible ? "1" : "0");
  } catch {
    // O mapa continua funcional mesmo sem armazenamento local.
  }
}
