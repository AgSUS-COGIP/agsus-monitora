import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { ficheiroDosVereditos } from "./veredito-para-o-mapa.mjs";
import { applyLotacoesGeograficas } from "../src/modules/lotacoes-geograficas-transport.js";
import {
  canonicoUtilizavel,
  nomeCanonico,
} from "../src/lib/reconciliacao-unidades.js";
import {
  caixaDaFeature,
  poligonosDaFeature,
  pontoEmPoligonos,
} from "../src/modules/indigenous-territories-layer.js";

/*
  A PROVA QUE ESTAVA DEBAIXO DO NARIZ: A PRÓPRIA TERRA INDÍGENA

  As duas primeiras passagens cruzaram a planilha de Lotações, o CNES e as
  malhas do IBGE. Nenhuma cruzou com o que este mapa desenha em cima de tudo —
  as 665 Terras Indígenas que a Funai publica.

  E um polo base de saúde indígena normalmente fica DENTRO da terra que atende.
  Quando fica, isso é confirmação de uma terceira fonte, independente das duas
  primeiras: não vem da planilha nem do cadastro, vem da geometria da Funai.

  Medido sobre os 1577 pontos do mapa:

      tipo            dentro   <5 km   5-30 km   >30 km
      unidade           410     152       112       63
      polo              249      78        67       38
      polo (CNES)       130      93        72       32
      casai               0      19        25       37

  Nenhuma CASAI cai dentro de terra, e está certo: casa de apoio fica na cidade,
  perto do hospital de referência. É o contrário que seria suspeito.

  O QUE ISTO MUDA, E O QUE NÃO MUDA

  Sobe o veredito de quem estava em `indeterminado` — não se conseguiu olhar —
  e de quem estava em `coerente` por um crivo mais fraco. Não toca em `erro`
  nem em `conflito`: estar dentro de uma terra não diz qual de duas coordenadas
  discordantes é a certa, nem conserta um município mal escrito.

  E não vira `validada`. Estar dentro da terra confirma que o ponto está num
  lugar coerente com o que a unidade faz; não confirma o ponto exato. A
  distinção importa, e o rótulo no ecrã diz qual das duas coisas se apurou.

      node scripts/validar-localizacoes-por-terra.mjs <lmap.json> <rede_cnes.json>
*/
const SAIDA = "public/data/localizacoes-validadas.json";
const CATALOGO = "public/data/terras-indigenas.json";
const DADOS = "public/data";

const semAcento = (valor) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

/*
  Só estes sobem. `erro` e `conflito` ficam onde estão — a terra não arbitra
  entre duas coordenadas nem corrige um rótulo de município —, e `validada` já
  tem confirmação de posição, que é mais do que isto dá.
*/
const MOTIVOS_QUE_SOBEM = new Set([
  "uf_indeterminada",
  "fonte_unica_na_uf",
  "fonte_unica_na_divisa",
  "fonte_unica_no_municipio",
  "copia_entre_fontes_na_uf",
]);

function lerPayload(caminho) {
  const bruto = JSON.parse(readFileSync(caminho, "utf8"));
  if (Array.isArray(bruto)) return bruto[0]?.payload ?? bruto[0];
  return bruto.payload ?? bruto;
}

function carregarTerras() {
  const catalogo = JSON.parse(readFileSync(CATALOGO, "utf8"));
  return catalogo.features.map((f) => ({
    nome: f.properties.terrai_nome,
    caixa: caixaDaFeature(f),
    poligonos: poligonosDaFeature(f),
  }));
}

function terraQueContem(terras, lat, lon) {
  for (const t of terras) {
    const c = t.caixa;
    if (!c) continue;
    // A caixa descarta quase tudo antes do teste caro de ponto-em-polígono.
    if (lat < c.sul || lat > c.norte || lon < c.oeste || lon > c.leste) continue;
    if (pontoEmPoligonos([lon, lat], t.poligonos)) return t;
  }
  return null;
}

function pontosDoMapa(caminhoLmap, caminhoRede) {
  const dataset = Object.assign(
    {},
    ...readdirSync(DADOS)
      .filter((f) => f.startsWith("lotacoes-geograficas-"))
      .map((f) => JSON.parse(readFileSync(`${DADOS}/${f}`, "utf8"))),
  );
  const saida = applyLotacoesGeograficas(
    [
      { chave: "lmap", payload: lerPayload(caminhoLmap) },
      { chave: "rede_cnes", payload: lerPayload(caminhoRede) },
    ],
    dataset,
  );
  const lmap = saida.find((r) => r.chave === "lmap").payload;
  const rede = saida.find((r) => r.chave === "rede_cnes").payload;

  const pontos = [];
  for (const d of lmap.dsei || []) {
    for (const p of d.polos || []) {
      pontos.push({ dsei: d.k, nome: p.n, lat: Number(p.lat), lon: Number(p.lon), casai: false });
    }
    const g = rede.rede?.[d.k] || { u: [], c: [] };
    for (const lista of ["u", "c"]) {
      for (const x of g[lista] || []) {
        pontos.push({
          dsei: d.k,
          nome: x[0],
          lat: Number(x[2]),
          lon: Number(x[3]),
          casai: lista === "c",
        });
      }
    }
  }
  return pontos;
}

async function principal() {
  const [caminhoLmap, caminhoRede] = process.argv.slice(2);
  if (!caminhoLmap || !caminhoRede) {
    console.error(
      "uso: node scripts/validar-localizacoes-por-terra.mjs <lmap.json> <rede_cnes.json>",
    );
    process.exitCode = 1;
    return;
  }

  const auditoria = JSON.parse(readFileSync(SAIDA, "utf8"));
  const terras = carregarTerras();
  const pontos = pontosDoMapa(caminhoLmap, caminhoRede);

  /*
    Qual terra contém cada chave. Duas entradas com a mesma chave e respostas
    diferentes não decidem nada — e isso acontece quando o polo e o registo do
    CNES estão em lados opostos do limite.
  */
  const porChave = new Map();
  for (const p of pontos) {
    const canonico = nomeCanonico(p.nome);
    if (!canonicoUtilizavel(canonico)) continue;
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
    const chave = `${semAcento(p.dsei)}|${canonico}|${p.casai ? "C" : "X"}`;
    const terra = terraQueContem(terras, p.lat, p.lon);
    if (!porChave.has(chave)) porChave.set(chave, { terra, conflito: false });
    else {
      const atual = porChave.get(chave);
      if ((atual.terra?.nome ?? null) !== (terra?.nome ?? null)) atual.conflito = true;
    }
  }

  let subiram = 0;
  let jaConfirmados = 0;
  let ambiguos = 0;
  const registros = auditoria.registros.map((r) => {
    const chave = `${semAcento(r.dsei)}|${r.canonico}|${r.tipo === "casai" ? "C" : "X"}`;
    const achado = porChave.get(chave);
    if (!achado?.terra) return r;
    if (achado.conflito) {
      ambiguos += 1;
      return r;
    }
    if (!MOTIVOS_QUE_SOBEM.has(r.motivo)) {
      jaConfirmados += 1;
      return r;
    }
    subiram += 1;
    return {
      ...r,
      estado: "coerente",
      motivo: "dentro_de_terra_indigena",
      terra: achado.terra.nome,
      motivo_anterior: r.motivo,
      fonte_do_veredito: "terceira_passagem_terra_indigena",
    };
  });

  writeFileSync(
    SAIDA,
    JSON.stringify(
      {
        ...auditoria,
        gerado_em: new Date().toISOString().slice(0, 10),
        terceira_passagem: {
          gerado_em: new Date().toISOString().slice(0, 10),
          criterio:
            "o ponto cai dentro de uma Terra Indígena publicada pela Funai",
          arbitro: `Funai — ${terras.length} terras de ${CATALOGO}`,
          promovidos: subiram,
          ja_confirmados_por_outra_via: jaConfirmados,
          descartados_por_respostas_divergentes: ambiguos,
        },
        contagem: registros.reduce((acc, r) => {
          acc[r.estado] = (acc[r.estado] || 0) + 1;
          return acc;
        }, {}),
        registros,
      },
      null,
      1,
    ),
  );
  writeFileSync(
    "src/lib/localizacoes-validadas-gerado.js",
    await ficheiroDosVereditos(registros),
  );

  console.log(`terras no catálogo: ${terras.length}`);
  console.log(`pontos do mapa com coordenada: ${pontos.length}`);
  console.log("");
  console.log(`  promovidos a "dentro de Terra Indígena": ${subiram}`);
  console.log(`  dentro de terra, mas já confirmados por outra via: ${jaConfirmados}`);
  console.log(`  descartados por respostas divergentes na mesma chave: ${ambiguos}`);
}

await principal();
