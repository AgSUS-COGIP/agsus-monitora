import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  carregarMunicipios,
  dentroDoMunicipio,
  garantirMalhasMunicipais,
} from "./malhas-dos-municipios.mjs";

/*
  A SEDE DO DSEI NO ENDEREÇO DA SEDE

  A estrela da sede estava na cidade certa e no ponto errado: em 32 dos 34
  DSEIs a coordenada era o ponto de referência da cidade, com quatro casas
  decimais — a mesma que a Wikipédia dá para a cidade. No Xingu, o centro de
  Canarana. Só Yanomami e Leste de Roraima tinham ponto de endereço, e esse
  ponto era o do CNES.

  DUAS FONTES, PORQUE NENHUMA BASTA SOZINHA

  1. O CNES da própria sede. O CNES cadastra a sede de cada DSEI como
     estabelecimento (tipo 72), com endereço e coordenada. Mas a coordenada é
     declarada por quem cadastra: a do DSEI Maranhão tem o endereço certo — Rua
     05 de Janeiro, Jordoa, São Luís — e um ponto que nem cai em São Luís.

  2. O endereço, geocodificado no OpenStreetMap (Nominatim). Independente do
     CNES na posição, dependente dele no texto do endereço.

  A decisão, para cada DSEI (ver `decidir`, que conta as três versões erradas
  que vieram antes desta):

      número de porta no bairro declarado, a ≤ 300 m do CNES → ponto do CNES
      número de porta no bairro declarado, mais longe       → a porta
      CNES a ≤ 100 m do traçado da rua do endereço          → ponto do CNES
      CNES a ≤ 1 km da rua                                  → encaixado nela
      CNES mais longe, ou fora do município, ou sem ponto   → a rua, no bairro
      rua ausente do OSM                                    → CNES, fonte única
          — mas nunca um CNES que repete o centro da cidade
      o resto                                               → não se mexe, e
          diz-se porquê

  Nenhum ponto novo é aceite fora do município da sede, pela malha do IBGE.

      node scripts/localizar-sedes-dos-dsei.mjs <lmap.json>

  Escreve `supabase/correcoes/20260923-leva-as-sedes-dos-dsei-ao-endereco.sql`
  e `docs/sedes-dos-dsei.md`. O SQL é para aplicar à mão, como os outros.
*/

const CACHE_MALHAS = ".cache/malhas-ibge-maxima";
const CACHE_CONSULTAS = ".cache/sedes-dos-dsei";
const SAIDA_SQL =
  "supabase/correcoes/20260923-leva-as-sedes-dos-dsei-ao-endereco.sql";
const SAIDA_RELATORIO = "docs/sedes-dos-dsei.md";

const API_CNES = "https://apidadosabertos.saude.gov.br/cnes/estabelecimentos";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const IBGE_MUNICIPIOS =
  "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado";
// A política do Nominatim pede identificação e no máximo um pedido por segundo.
const AGENTE =
  "agsus-monitora-auditoria/1.0 (+https://github.com/AgSUS-COGIP/agsus-monitora)";

/*
  QUANDO É QUE O CNES E O ENDEREÇO "CONCORDAM"

  A primeira versão aceitava 1 km entre o ponto do CNES e o ponto que o
  Nominatim devolvia para a rua. Não servia para nada, nem para mais nem para
  menos: achada só a rua, o Nominatim devolve UM trecho dela, e numa avenida
  longa esse trecho fica a quilómetros do prédio. Na Av. Ville Roy, em Boa
  Vista, 10,6 km do CNES — com o CNES certo. Em Cuiabá, o ponto do CNES estava
  27,8 km a norte da Rua Rui Barbosa, e continuava "dentro" do município.

  A pergunta passa a ser a certa: o ponto do CNES está EM CIMA da rua que o
  próprio CNES declara? Mede-se a distância do ponto ao traçado de todos os
  trechos da rua. A 100 m, está na rua; o prédio fica à beira dela.

  Com número de porta, a comparação é ponto a ponto, e 300 m bastam: a
  numeração do OSM é muitas vezes interpolada.
*/
export const NA_RUA_KM = 0.1;
export const CONCORDANCIA_COM_NUMERO_KM = 0.3;
export const CENTRO_DA_CIDADE_KM = 0.15;

/*
  Distância, em km, de um ponto ao traçado de uma geometria GeoJSON (linha,
  multilinha ou polígono). Plana, com o cosseno da latitude: a escala é de
  centenas de metros, e o erro dela é de centímetros.
*/
export function kmAteAGeometria(lat, lon, geometrias) {
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180);
  const ky = 110.574;
  let menor = Infinity;
  const segmentos = (coords) => {
    for (let i = 1; i < coords.length; i += 1) {
      const [x1, y1] = coords[i - 1];
      const [x2, y2] = coords[i];
      const ax = (x1 - lon) * kx;
      const ay = (y1 - lat) * ky;
      const bx = (x2 - lon) * kx;
      const by = (y2 - lat) * ky;
      const dx = bx - ax;
      const dy = by - ay;
      const t =
        dx || dy
          ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy)))
          : 0;
      menor = Math.min(menor, Math.hypot(ax + t * dx, ay + t * dy));
    }
  };
  for (const g of geometrias || []) {
    if (!g) continue;
    if (g.type === "LineString") segmentos(g.coordinates);
    if (g.type === "MultiLineString" || g.type === "Polygon")
      g.coordinates.forEach(segmentos);
    if (g.type === "MultiPolygon")
      g.coordinates.forEach((p) => p.forEach(segmentos));
    if (g.type === "Point") {
      const [x, y] = g.coordinates;
      menor = Math.min(menor, Math.hypot((x - lon) * kx, (y - lat) * ky));
    }
  }
  return menor;
}

/*
  SEDES QUE NÃO ESTÃO NO CNES

  O DSEI Kaiapó do Mato Grosso não tem estabelecimento tipo 72 com o nome do
  distrito em Colíder. O endereço vem de um documento publicado, e é FONTE
  ÚNICA: passa pelo Nominatim e pela malha do IBGE como os outros, mas não tem
  coordenada de CNES para confirmar.

  (A planilha de Lotações tem uma unidade "SEDE DO DSEI KAIAPÓ DO MT" em
  -9.0278, -57.0964 — Apiacás, a 268 km de Colíder. Não serve de segunda fonte.)
*/
export const SEDES_DOCUMENTADAS = Object.freeze({
  "KAIAPO DE MATO GROSSO": {
    logradouro: "RUA APARECIDO DARCI GAVIOLLI",
    numero: "626",
    bairro: "BOA ESPERANCA",
    endereco: "RUA APARECIDO DARCI GAVIOLLI, 626 — BOA ESPERANCA",
    fonte: "Edital AgSUS 14/2025, Anexo I (DSEI Kaiapó do Mato Grosso), p. 18",
  },
});

const UF_CODIGO = {
  RO: 11,
  AC: 12,
  AM: 13,
  RR: 14,
  PA: 15,
  AP: 16,
  TO: 17,
  MA: 21,
  PI: 22,
  CE: 23,
  RN: 24,
  PB: 25,
  PE: 26,
  AL: 27,
  SE: 28,
  BA: 29,
  MG: 31,
  ES: 32,
  RJ: 33,
  SP: 35,
  PR: 41,
  SC: 42,
  RS: 43,
  MS: 50,
  MT: 51,
  GO: 52,
  DF: 53,
};

const semAcento = (t) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function kmEntre(lat1, lon1, lat2, lon2) {
  const rad = (g) => (g * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) *
      Math.cos(rad(lat2)) *
      Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/*
  O que é a sede e o que não é. O CNES do município traz também a CASAI, os
  polos e os postos: só a unidade que se chama distrito é a sede.
*/
const EH_SEDE = /DISTRITO SANIT|\bDSEI\b/;
const NAO_EH_SEDE =
  /POLO|UBSI|CASAI|CASA DE (APOIO|SAUDE)|POSTO|ALDEIA|UNIDADE BASICA|UBS\b|MISSAO/;

export function pareceSede(nome) {
  const n = semAcento(nome);
  return EH_SEDE.test(n) && !NAO_EH_SEDE.test(n);
}

/*
  SÓ O NOME FANTASIA

  A primeira versão olhava também a razão social — e a razão social de TODO
  polo, CASAI e UBSI de um DSEI é "Distrito Sanitário Especial Indígena ...",
  porque o dono jurídico de todos é o distrito. Passavam todos, e escolhia-se o
  atualizado mais recentemente: no Yanomami e no Leste de Roraima, o Polo Base
  Milho; em Manaus, um polo no Rio Cuieiras; em Cuiabá, a CASAI.
*/
export function nomeDoEstabelecimento(e) {
  return String(e?.nome || "").trim() || String(e?.razao || "").trim();
}

const PALAVRAS_VAZIAS = new Set(["DE", "DO", "DA", "DOS", "DAS", "E", "RIO"]);
const palavras = (t) =>
  semAcento(t)
    .split(" ")
    .filter((p) => p.length > 1 && !PALAVRAS_VAZIAS.has(p));

/*
  Quantas palavras do nome do DSEI o estabelecimento tem. Em Boa Vista há duas
  sedes — Yanomami e Leste de Roraima —, e é o nome que diz qual é qual.
*/
export function afinidadeComODsei(nomeDoCnes, nomeDoDsei) {
  const doCnes = new Set(palavras(nomeDoCnes));
  return palavras(nomeDoDsei).filter((p) => doCnes.has(p)).length;
}

/*
  O bairro do CNES contra o do OSM. "GOIABEIRAS" no CNES é "Goiabeira" no OSM:
  compara-se sem o S final de cada palavra, e basta um conter o outro.
*/
const raizDoBairro = (t) =>
  semAcento(t)
    .split(" ")
    .filter(Boolean)
    .map((p) => p.replace(/S$/, ""))
    .join(" ");
export function bairroGenerico(bairro) {
  return (
    !bairro ||
    /^(CENTRO|CENTRAL|ZONA RURAL|ZONA URBANA)$/.test(semAcento(bairro))
  );
}
export function mesmoBairro(doCnes, doOsm) {
  if (bairroGenerico(doCnes) || !doOsm) return false;
  const a = raizDoBairro(doCnes);
  const b = raizDoBairro(doOsm);
  return b.includes(a) || a.includes(b);
}

/*
  O Nominatim, quando não acha a rua pedida, devolve outra: pediu-se "777
  Avenida Goiás" em Canarana e veio a Avenida Santa Catarina. O achado só
  conta se a rua dele tiver as palavras da rua pedida.
*/
const TIPOS_DE_VIA = new Set([
  "RUA",
  "R",
  "AVENIDA",
  "AV",
  "TRAVESSA",
  "TV",
  "PASSAGEM",
  "ESTRADA",
  "RODOVIA",
  "ALAMEDA",
  "PRACA",
  "LARGO",
  "VIA",
  "BR",
  "QUADRA",
]);
export function mesmaRua(pedida, achada) {
  const chave = (t) =>
    palavras(t)
      .filter((p) => !TIPOS_DE_VIA.has(p) && !/^\d+$/.test(p))
      .map((p) => p.replace(/^0+(?=\d)/, ""));
  const a = chave(pedida);
  const b = new Set(chave(achada));
  return a.length > 0 && a.every((p) => b.has(p));
}

/*
  O nível a que o endereço foi achado. Só "numero" e "rua" servem para pôr uma
  estrela num prédio; bairro e cidade são o problema que se quer resolver.
*/
export function nivelDoAchado(resultado) {
  if (!resultado) return "nenhum";
  if (resultado.address?.house_number) return "numero";
  const tipo = String(resultado.addresstype || resultado.type || "");
  if (
    /^(road|street|residential|primary|secondary|tertiary|trunk|living_street|pedestrian|unclassified|service)$/.test(
      tipo,
    )
  )
    return "rua";
  if (/^(building|house|office|amenity|government|hospital|clinic)$/.test(tipo))
    return "numero";
  if (/^(suburb|neighbourhood|quarter|city_district)$/.test(tipo))
    return "bairro";
  return "cidade";
}

/*
  O ponto de uma geometria mais próximo de (lat, lon). É o "encaixe": o CNES
  que está a poucas centenas de metros da rua certa vai para a beira dela, e
  guarda a posição ao longo da rua, que é o que o endereço sem número não sabe.
*/
export function pontoMaisProximo(lat, lon, geometrias) {
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180);
  const ky = 110.574;
  let melhor = null;
  const segmentos = (coords) => {
    for (let i = 1; i < coords.length; i += 1) {
      const [x1, y1] = coords[i - 1];
      const [x2, y2] = coords[i];
      const ax = (x1 - lon) * kx;
      const ay = (y1 - lat) * ky;
      const dx = (x2 - x1) * kx;
      const dy = (y2 - y1) * ky;
      const t =
        dx || dy
          ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy)))
          : 0;
      const d = Math.hypot(ax + t * dx, ay + t * dy);
      if (!melhor || d < melhor.km) {
        melhor = { km: d, lat: y1 + t * (y2 - y1), lon: x1 + t * (x2 - x1) };
      }
    }
  };
  for (const g of geometrias || []) {
    if (g?.type === "LineString") segmentos(g.coordinates);
    if (g?.type === "MultiLineString") g.coordinates.forEach(segmentos);
  }
  return melhor;
}

/*
  A DECISÃO, DEPOIS DE TRÊS VERSÕES ERRADAS

  `geo` traz duas coisas separadas, porque servem para perguntas diferentes:

    geo.numero   o número de porta achado no OSM — mas só se cair no bairro
                 que o CNES declara. Em Manaus o "1018 Av. Djalma Batista" do
                 OSM era o SINE, no bairro São Geraldo; o CNES diz Chapada. Um
                 número no bairro errado não confirma nada.
    geo.trechos  o traçado de TODOS os trechos da rua, para medir se o ponto
                 do CNES está em cima dela.
    geo.ponto    um ponto da rua para quando o CNES não serve: o trecho do
                 bairro declarado, ou o primeiro.
*/
export const ENCAIXE_MAXIMO_KM = 1;

export function decidir({ cnes, geo, centroAtual }) {
  // (0, 0) é o CNES sem coordenada preenchida, não um ponto no Atlântico.
  const cnesUtil =
    cnes &&
    Number.isFinite(cnes.lat) &&
    Number.isFinite(cnes.lon) &&
    !(cnes.lat === 0 && cnes.lon === 0);
  const temRua = Boolean(geo?.trechos?.length || geo?.numero);
  const cnesRepeteCentro =
    cnesUtil &&
    kmEntre(cnes.lat, cnes.lon, centroAtual.lat, centroAtual.lon) <
      CENTRO_DA_CIDADE_KM;

  if (cnesUtil && cnes.dentro && temRua) {
    const kmDaRua = geo.trechos?.length
      ? kmAteAGeometria(cnes.lat, cnes.lon, geo.trechos)
      : Infinity;
    const kmDoNumero = geo.numero
      ? kmEntre(cnes.lat, cnes.lon, geo.numero.lat, geo.numero.lon)
      : Infinity;

    /*
      O número de porta (já validado pelo bairro) vem antes do teste da rua. No
      Amapá o OSM tem "1071, Avenida Pedro Baião, Central" — o endereço exato —
      e o CNES está na mesma avenida a quase 1 km. "Algum ponto da avenida
      certa" é menos do que "a porta certa".
    */
    if (geo.numero) {
      return kmDoNumero <= CONCORDANCIA_COM_NUMERO_KM
        ? { acao: "cnes", motivo: "duas_fontes_concordam", kmDaRua, kmDoNumero }
        : {
            acao: "numero",
            motivo: "endereco_com_numero_desmente_o_cnes",
            kmDaRua,
            kmDoNumero,
          };
    }
    /*
      Número achado em bairro vizinho. Não substitui o CNES — em Manaus era o
      SINE, a 2 km —, mas confirma-o se estiver ao lado: em Belém a Av.
      Conselheiro Furtado é a divisa entre Nazaré e Batista Campos, e o CNES
      declara um lado enquanto o OSM rotula o outro, a 188 m.
    */
    const vizinho = geo.numeroDescartado;
    if (
      vizinho &&
      kmEntre(cnes.lat, cnes.lon, vizinho.lat, vizinho.lon) <=
        CONCORDANCIA_COM_NUMERO_KM
    ) {
      return {
        acao: "cnes",
        motivo: "numero_no_bairro_vizinho_confirma_o_cnes",
        kmDaRua,
        kmDoNumero: kmEntre(cnes.lat, cnes.lon, vizinho.lat, vizinho.lon),
      };
    }
    if (kmDaRua <= NA_RUA_KM) {
      return { acao: "cnes", motivo: "cnes_na_rua_declarada", kmDaRua };
    }
    if (kmDaRua <= ENCAIXE_MAXIMO_KM) {
      return {
        acao: "encaixe",
        motivo: "cnes_encaixado_na_rua_declarada",
        kmDaRua,
      };
    }
    return { acao: "rua", motivo: "cnes_longe_da_rua_declarada", kmDaRua };
  }
  if (cnes && temRua && (!cnesUtil || !cnes.dentro)) {
    let motivo = cnesUtil ? "cnes_fora_do_municipio" : "cnes_sem_coordenada";
    if (cnes.documentado) motivo = "endereco_documentado_sem_cnes";
    return { acao: geo.numero ? "numero" : "rua", motivo };
  }
  // Rua não achada no OSM: fica o CNES, dito como fonte única — nunca o centro da cidade.
  if (cnesUtil && cnes.dentro && !cnesRepeteCentro) {
    return { acao: "cnes", motivo: "fonte_unica_cnes" };
  }
  if (cnesRepeteCentro)
    return { acao: "manter", motivo: "cnes_repete_o_centro_da_cidade" };
  if (!cnes) return { acao: "manter", motivo: "sede_sem_cnes" };
  return { acao: "manter", motivo: "nada_confirma" };
}

// ---------------------------------------------------------------------------

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function lembrar(nome, gerar) {
  mkdirSync(CACHE_CONSULTAS, { recursive: true });
  const caminho = `${CACHE_CONSULTAS}/${nome.replace(/[^a-z0-9_-]+/gi, "_")}.json`;
  if (existsSync(caminho))
    return Promise.resolve(JSON.parse(readFileSync(caminho, "utf8")));
  return gerar().then((valor) => {
    writeFileSync(caminho, JSON.stringify(valor));
    return valor;
  });
}

async function obterJson(url, cabecalhos = {}) {
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    try {
      const r = await fetch(url, {
        headers: { Accept: "application/json", ...cabecalhos },
        signal: AbortSignal.timeout(60000),
      });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (erro) {
      if (tentativa === 2) throw new Error(`${url}: ${erro.message}`);
      await espera(2000);
    }
  }
  return null;
}

async function estabelecimentosIndigenas(codigo6) {
  return lembrar(`cnes-mun-${codigo6}`, async () => {
    const todos = [];
    for (let offset = 0; offset < 400; offset += 20) {
      const j = await obterJson(
        `${API_CNES}?codigo_municipio=${codigo6}&codigo_tipo_unidade=72&limit=20&offset=${offset}`,
      );
      const lista = j?.estabelecimentos || [];
      todos.push(
        ...lista.map((e) => ({
          cnes: e.codigo_cnes,
          nome: e.nome_fantasia,
          razao: e.nome_razao_social,
        })),
      );
      if (lista.length < 20) break;
    }
    return todos;
  });
}

async function detalheDoCnes(codigo) {
  return lembrar(`cnes-${codigo}`, () => obterJson(`${API_CNES}/${codigo}`));
}

/*
  "MATO GROSSO X AVENIDA GOIAS" é uma esquina. Tenta-se cada rua, e o número
  só com a rua a que ele pertence — a última da esquina, no uso do CNES.
*/
export function variantesDoEndereco(logradouro, numero) {
  const partes = String(logradouro ?? "")
    .split(/\s+X\s+|\s+ESQ(?:UINA)?\.?\s+(?:COM\s+)?/i)
    .map((p) => p.trim().replace(/\b0+(\d)/g, "$1"))
    .filter(Boolean);
  const num = /^\d+/.test(String(numero ?? "").trim())
    ? String(numero).trim()
    : "";
  const saida = [];
  const ultima = partes[partes.length - 1];
  if (ultima && num) saida.push(`${num} ${ultima}`);
  for (const p of [...partes].reverse()) saida.push(p);
  return [...new Set(saida)];
}

async function geocodificar(rua, municipio, uf) {
  const chave = `geo2-${semAcento(`${rua}-${municipio}-${uf}`)}`;
  return lembrar(chave, async () => {
    await espera(1100);
    // `polygon_geojson`: o traçado da rua, para medir se o CNES está em cima dela.
    const url =
      `${NOMINATIM}?format=jsonv2&addressdetails=1&polygon_geojson=1&limit=10&countrycodes=br` +
      `&street=${encodeURIComponent(rua)}&city=${encodeURIComponent(municipio)}` +
      `&state=${encodeURIComponent(uf)}&country=Brasil`;
    return (await obterJson(url, { "User-Agent": AGENTE })) || [];
  });
}

function municipioDoPonto(porCodigo, ufCodigo, lat, lon) {
  for (const [codigo] of porCodigo) {
    if (!codigo.startsWith(String(ufCodigo))) continue;
    if (dentroDoMunicipio(porCodigo, codigo, lat, lon)) return codigo;
  }
  return null;
}

const fmt = (v) => Number(v).toFixed(6);
const sqlTexto = (t) => `'${String(t ?? "").replace(/'/g, "''")}'`;

function enderecoLegivel(d) {
  const partes = [
    [d.endereco_estabelecimento, d.numero_estabelecimento]
      .filter(Boolean)
      .join(", "),
    d.bairro_estabelecimento,
  ].filter(Boolean);
  return partes.join(" — ");
}

async function principal() {
  const [caminhoLmap] = process.argv.slice(2);
  if (!caminhoLmap) {
    console.error("uso: node scripts/localizar-sedes-dos-dsei.mjs <lmap.json>");
    process.exitCode = 1;
    return;
  }
  const bruto = JSON.parse(readFileSync(caminhoLmap, "utf8"));
  const lmap = Array.isArray(bruto)
    ? (bruto[0]?.payload ?? bruto[0])
    : (bruto.payload ?? bruto);

  await garantirMalhasMunicipais(CACHE_MALHAS);
  const porCodigo = carregarMunicipios(CACHE_MALHAS);
  const nomes = new Map(
    (await lembrar("ibge-municipios", () => obterJson(IBGE_MUNICIPIOS))).map(
      (m) => [
        String(m["municipio-id"]),
        { nome: m["municipio-nome"], uf: m["UF-sigla"] },
      ],
    ),
  );

  const linhas = [];
  for (const d of lmap.dsei) {
    const uf = String(d.sedeuf || "").toUpperCase();
    const centroAtual = { lat: Number(d.lat), lon: Number(d.lon) };
    const codigo7 = municipioDoPonto(
      porCodigo,
      UF_CODIGO[uf],
      centroAtual.lat,
      centroAtual.lon,
    );
    const municipio = nomes.get(String(codigo7))?.nome || "";
    const linha = {
      k: d.k,
      dsei: d.n,
      uf,
      municipio,
      codigo7,
      de: centroAtual,
    };

    if (!codigo7) {
      linhas.push({
        ...linha,
        decisao: {
          acao: "manter",
          motivo: "municipio_da_sede_nao_identificado",
        },
      });
      continue;
    }

    const sedes = (await estabelecimentosIndigenas(codigo7.slice(0, 6))).filter(
      (e) => pareceSede(nomeDoEstabelecimento(e)),
    );
    // A que tem o nome deste DSEI; entre as que o têm por igual, a mais recente.
    const maiorAfinidade = Math.max(
      0,
      ...sedes.map((e) => afinidadeComODsei(nomeDoEstabelecimento(e), d.n)),
    );
    const candidatos = sedes.filter(
      (e) =>
        afinidadeComODsei(nomeDoEstabelecimento(e), d.n) === maiorAfinidade &&
        (maiorAfinidade > 0 || sedes.length === 1),
    );
    linha.candidatos = candidatos.map(
      (c) => `${c.cnes} ${nomeDoEstabelecimento(c)}`,
    );

    let cnes = null;
    if (candidatos.length) {
      const detalhes = [];
      for (const c of candidatos) detalhes.push(await detalheDoCnes(c.cnes));
      const melhor = detalhes
        .filter(Boolean)
        .sort((a, b) =>
          String(b.data_atualizacao).localeCompare(String(a.data_atualizacao)),
        )[0];
      if (melhor) {
        const lat = Number(melhor.latitude_estabelecimento_decimo_grau);
        const lon = Number(melhor.longitude_estabelecimento_decimo_grau);
        cnes = {
          codigo: melhor.codigo_cnes,
          nome: melhor.nome_fantasia,
          endereco: enderecoLegivel(melhor),
          atualizado: melhor.data_atualizacao,
          lat,
          lon,
          dentro: dentroDoMunicipio(porCodigo, codigo7, lat, lon) === true,
          bruto: melhor,
        };
      }
    }
    // Sem CNES da sede: o endereço documentado, sem coordenada (ver SEDES_DOCUMENTADAS).
    const documentada = SEDES_DOCUMENTADAS[semAcento(d.n)];
    if (!cnes && documentada) {
      cnes = {
        codigo: "",
        nome: d.n,
        endereco: documentada.endereco,
        atualizado: "",
        lat: NaN,
        lon: NaN,
        dentro: false,
        documentado: documentada.fonte,
        bruto: {
          endereco_estabelecimento: documentada.logradouro,
          numero_estabelecimento: documentada.numero,
          bairro_estabelecimento: documentada.bairro,
        },
      };
    }
    linha.cnes = cnes;

    /*
      Pede-se CADA variante do endereço — com número e sem ele, cada rua de
      uma esquina — e junta-se tudo o que for a mesma rua, dentro do município.
      A primeira versão parava no primeiro achado, e quando esse era o número
      de porta ficava sem o traçado da rua para medir o CNES contra ela.
    */
    let geo = null;
    if (cnes) {
      const bairroDoCnes = semAcento(cnes.bruto.bairro_estabelecimento);
      const achadosNoMunicipio = [];
      for (const rua of variantesDoEndereco(
        cnes.bruto.endereco_estabelecimento,
        cnes.bruto.numero_estabelecimento,
      )) {
        for (const a of await geocodificar(rua, municipio, uf)) {
          const lat = Number(a.lat);
          const lon = Number(a.lon);
          const achado = {
            lat,
            lon,
            nivel: nivelDoAchado(a),
            nome: a.display_name,
            consulta: rua,
            rua: a.address?.road || a.name || "",
            bairro: [
              a.address?.suburb,
              a.address?.neighbourhood,
              a.address?.city_district,
              a.address?.quarter,
            ]
              .filter(Boolean)
              .join(" "),
            geometria: a.geojson || null,
          };
          if (
            dentroDoMunicipio(porCodigo, codigo7, lat, lon) === true &&
            (achado.nivel === "numero" || achado.nivel === "rua") &&
            mesmaRua(rua, achado.rua)
          ) {
            achadosNoMunicipio.push(achado);
          }
        }
      }
      if (achadosNoMunicipio.length) {
        const noBairro = (a) => mesmoBairro(bairroDoCnes, a.bairro);
        // O número de porta só vale no bairro que o CNES declara (ver `decidir`).
        const numero =
          achadosNoMunicipio.find(
            (a) =>
              a.nivel === "numero" &&
              (noBairro(a) || bairroGenerico(bairroDoCnes)),
          ) || null;
        const trechos = achadosNoMunicipio.filter((a) => a.nivel === "rua");
        const ponto = trechos.find(noBairro) || trechos[0] || numero;
        geo = {
          numero,
          ponto,
          trechos: trechos.map((a) => a.geometria).filter(Boolean),
          quantosTrechos: trechos.length,
          numeroDescartado:
            achadosNoMunicipio.find(
              (a) => a.nivel === "numero" && a !== numero,
            ) || null,
        };
      }
    }
    linha.geo = geo;
    linha.decisao = decidir({ cnes, geo, centroAtual });

    const acao = linha.decisao.acao;
    if (acao === "cnes") linha.para = { lat: cnes.lat, lon: cnes.lon };
    if (acao === "numero")
      linha.para = { lat: geo.numero.lat, lon: geo.numero.lon };
    if (acao === "rua") linha.para = { lat: geo.ponto.lat, lon: geo.ponto.lon };
    if (acao === "encaixe") {
      const p = pontoMaisProximo(cnes.lat, cnes.lon, geo.trechos);
      linha.para = { lat: p.lat, lon: p.lon };
    }
    if (linha.para) {
      // Rede final: nunca fora do município da sede.
      if (
        dentroDoMunicipio(
          porCodigo,
          codigo7,
          linha.para.lat,
          linha.para.lon,
        ) !== true
      ) {
        linha.decisao = {
          acao: "manter",
          motivo: "ponto_novo_fora_do_municipio",
        };
        delete linha.para;
      } else {
        linha.para.km = kmEntre(
          centroAtual.lat,
          centroAtual.lon,
          linha.para.lat,
          linha.para.lon,
        );
      }
    }
    linhas.push(linha);
    console.log(
      `${d.n.padEnd(32)} ${acao.padEnd(9)} ${linha.decisao.motivo.padEnd(38)} ${linha.para ? `${linha.para.km.toFixed(2)} km do centro` : ""}`,
    );
  }

  writeFileSync(
    `${CACHE_CONSULTAS}/resultado.json`,
    JSON.stringify(
      linhas,
      (k, v) =>
        ["bruto", "geometria", "geometrias"].includes(k) ? undefined : v,
      1,
    ),
  );
  escreverSql(linhas);
  escreverRelatorio(linhas);
  const mudam = linhas.filter((l) => l.para).length;
  console.log(`\n${mudam} de ${linhas.length} sedes com ponto novo.`);
}

export const MOTIVOS = {
  duas_fontes_concordam: "CNES e número de porta concordam",
  numero_no_bairro_vizinho_confirma_o_cnes:
    "o número de porta, rotulado no bairro vizinho, confirma o CNES",
  cnes_na_rua_declarada: "o ponto do CNES está na rua do endereço",
  cnes_encaixado_na_rua_declarada:
    "o CNES estava ao lado da rua do endereço; encaixado nela",
  cnes_longe_da_rua_declarada:
    "o ponto do CNES está longe da rua do endereço; vale a rua, no bairro declarado",
  cnes_sem_coordenada: "o CNES não tem coordenada; vale o endereço",
  endereco_documentado_sem_cnes:
    "sem CNES; endereço de documento publicado (fonte única)",
  endereco_com_numero_desmente_o_cnes:
    "o número de porta, no bairro declarado, desmente o ponto do CNES",
  cnes_fora_do_municipio:
    "o ponto do CNES cai fora do município; vale o endereço",
  fonte_unica_cnes: "só o CNES (a rua não existe no OpenStreetMap)",
  cnes_repete_o_centro_da_cidade:
    "o CNES repete o centro da cidade — nada a confirmar",
  sede_sem_cnes: "a sede não tem CNES no município",
  nada_confirma: "nenhuma fonte confirma",
  municipio_da_sede_nao_identificado: "município da sede não identificado",
  ponto_novo_fora_do_municipio: "o ponto novo cairia fora do município",
};

function escreverSql(linhas) {
  const mudam = linhas.filter((l) => l.para);
  const valores = mudam
    .map(
      (l) =>
        `    (${sqlTexto(l.k)}, ${fmt(l.para.lat)}, ${fmt(l.para.lon)}, ${l.de.lat}, ${l.de.lon}, ${sqlTexto(l.cnes?.endereco || "")}, ${sqlTexto(l.municipio)}, ${sqlTexto(l.decisao.motivo)}, ${sqlTexto(l.cnes?.codigo || "")})`,
    )
    .join(",\n");
  const cte = `with correcao(k, lat, lon, de_lat, de_lon, endereco, municipio, fonte, cnes) as (values\n${valores}\n)`;
  const tabela = mudam
    .map(
      (l) =>
        `--   ${l.dsei.padEnd(32)} ${l.municipio.padEnd(26)} ${l.para.km.toFixed(2).padStart(6)} km  ${MOTIVOS[l.decisao.motivo]}`,
    )
    .join("\n");
  const ficam = linhas
    .filter((l) => !l.para)
    .map(
      (l) =>
        `--   ${l.dsei.padEnd(32)} ${MOTIVOS[l.decisao.motivo] || l.decisao.motivo}`,
    )
    .join("\n");

  const sql = `-- ---------------------------------------------------------------------------
-- A ESTRELA DA SEDE NO ENDEREÇO DA SEDE
--
-- Gerado por \`scripts/localizar-sedes-dos-dsei.mjs\`. O relatório completo, com
-- as duas fontes de cada DSEI, está em \`docs/sedes-dos-dsei.md\`.
--
-- Em 32 dos 34 DSEIs a coordenada da sede era o ponto de referência da cidade.
-- Cada sede passou por duas fontes: o CNES da própria sede (tipo 72) e o
-- endereço dele geocodificado no OpenStreetMap, e nenhum ponto novo é aceite
-- fora do município da sede (malha do IBGE, qualidade máxima).
--
-- MUDAM (${mudam.length}) — distância do ponto antigo ao novo:
--
${tabela}
--
-- FICAM COMO ESTÃO (${linhas.length - mudam.length}):
--
${ficam || "--   nenhuma"}
--
-- Além da coordenada, grava \`sede_endereco\`, \`sede_municipio\`, \`sede_fonte\` e
-- \`sede_cnes\`: o popup da estrela passa a dizer onde a sede fica.
--
-- COMO APLICAR
--
-- 1. Correr a CONFERÊNCIA. Não altera nada. Esperado: ${mudam.length} linhas.
-- 2. Correr a CORREÇÃO. Só escreve onde a coordenada atual for a de antes.
-- 3. Repetir a CONFERÊNCIA: atual deve passar a ser igual a nova.
--
-- PARA DESFAZER
--
-- Os VALUES guardam de onde cada sede veio (de_lat, de_lon). No bloco da
-- CORREÇÃO, trocar \`c.lat\`/\`c.lon\` por \`c.de_lat\`/\`c.de_lon\`, e a guarda
-- para comparar com \`c.lat\`/\`c.lon\`.
-- ---------------------------------------------------------------------------

-- ============================ 1. CONFERÊNCIA ===============================

${cte}
select c.k,
       (d.value ->> 'lat')::numeric as atual_lat,
       (d.value ->> 'lon')::numeric as atual_lon,
       c.lat as nova_lat,
       c.lon as nova_lon,
       c.endereco
from "TB_CONFIG_MAPA_SAUDE_INDIG" cfg
cross join lateral jsonb_array_elements(cfg.payload -> 'dsei') as d(value)
join correcao c on c.k = d.value ->> 'k'
where cfg.chave = 'lmap'
order by c.k;

-- ============================ 2. CORREÇÃO ==================================

${cte}
update "TB_CONFIG_MAPA_SAUDE_INDIG" cfg
set payload = jsonb_set(
  cfg.payload,
  '{dsei}',
  (
    select jsonb_agg(
      coalesce(
        (
          select d.value || jsonb_build_object(
            'lat', c.lat,
            'lon', c.lon,
            'sede_endereco', c.endereco,
            'sede_municipio', c.municipio,
            'sede_fonte', c.fonte,
            'sede_cnes', c.cnes
          )
          from correcao c
          where c.k = d.value ->> 'k'
            and (d.value ->> 'lat')::numeric = c.de_lat
            and (d.value ->> 'lon')::numeric = c.de_lon
        ),
        d.value
      )
      order by d.ordem
    )
    from jsonb_array_elements(cfg.payload -> 'dsei') with ordinality as d(value, ordem)
  )
)
where cfg.chave = 'lmap';
`;
  writeFileSync(SAIDA_SQL, sql);
}

function escreverRelatorio(linhas) {
  const metros = (km) =>
    Number.isFinite(km) ? `${(km * 1000).toFixed(0)} m` : "—";
  const corpo = linhas
    .map((l) => {
      const semPonto = l.cnes && l.cnes.lat === 0 && l.cnes.lon === 0;
      let cnes = "—";
      if (l.cnes?.documentado) {
        cnes = `sem CNES · ${l.cnes.endereco} · fonte: ${l.cnes.documentado}`;
      } else if (l.cnes) {
        cnes = `${l.cnes.codigo} · ${l.cnes.endereco} · atualizado ${l.cnes.atualizado} · ${semPonto ? "**sem coordenada**" : l.cnes.dentro ? "no município" : "**fora do município**"}`;
      }
      const geo = l.geo
        ? [
            l.geo.numero ? "número de porta achado" : "",
            l.geo.numeroDescartado
              ? "número achado em outro bairro (descartado)"
              : "",
            `${l.geo.quantosTrechos} trecho(s) da rua`,
            Number.isFinite(l.decisao.kmDaRua)
              ? `CNES a ${metros(l.decisao.kmDaRua)} da rua`
              : "",
          ]
            .filter(Boolean)
            .join(" · ")
        : "rua não achada no OpenStreetMap";
      const para = l.para
        ? `${fmt(l.para.lat)}, ${fmt(l.para.lon)} (${l.para.km.toFixed(2)} km)`
        : "fica";
      return `| ${l.dsei} | ${l.municipio}/${l.uf} | ${cnes} | ${geo} | ${MOTIVOS[l.decisao.motivo] || l.decisao.motivo} | ${para} |`;
    })
    .join("\n");
  const md = `# Sedes dos DSEI — de onde vem cada ponto

Gerado por \`scripts/localizar-sedes-dos-dsei.mjs\`. Correção correspondente:
\`supabase/correcoes/20260923-leva-as-sedes-dos-dsei-ao-endereco.sql\`.

Fontes: CNES (API de dados abertos do Ministério da Saúde, estabelecimento tipo
72 do município da sede) e o endereço desse CNES geocodificado no
OpenStreetMap (Nominatim). Validação: malha municipal do IBGE, qualidade máxima.

| DSEI | Município da sede | CNES da sede | Endereço no mapa | Decisão | Ponto novo (distância do antigo) |
|---|---|---|---|---|---|
${corpo}
`;
  writeFileSync(SAIDA_RELATORIO, md);
}

if (process.argv[1]?.endsWith("localizar-sedes-dos-dsei.mjs"))
  await principal();
