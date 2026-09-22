/*
  VALIDAÇÃO DAS LOCALIZAÇÕES DAS UNIDADES

  O mapa dizia "Localização em validação" em todo o lado. Não era um estado do
  dado: era a ausência de alguém a fazer a validação. `coordenadaDeExibicao`,
  em `src/lib/reconciliacao-unidades.js`, preserva a coordenada antiga e espera
  por "validação independente" que nunca chegava.

  Este script é essa validação. Cruza três fontes e emite um veredito por
  unidade, com a prova que o sustenta.

    Lotações   planilha oficial, uma linha por lotação, com latitude/longitude
    CNES       cadastro nacional dos estabelecimentos, com coordenada própria
    Malhas     limites das 27 UFs, da API de malhas territoriais do IBGE,
               em qualidade MÁXIMA — ver a nota sobre a divisa, abaixo

  O ÁRBITRO É A MALHA DA UF. Duas fontes que discordam não decidem nada entre
  si — uma terceira, independente das duas, decide. Um ponto que cai fora do
  estado que o próprio registro declara está errado, seja qual for a fonte que
  o afirme. Foi assim que se apurou que o PB TUXI, declarado em Belém do São
  Francisco (PE), tinha na planilha a coordenada de Angra dos Reis (RJ).

  POR QUE A MALHA TEM DE SER A DETALHADA

  A primeira passagem usou `qualidade=minima`. Com ela, o PB TELES PIRES, em
  Jacareacanga (PA), aparecia com a coordenada do CNES fora do estado — e a
  conclusão teria sido mandar sobrepor um dado oficial que estava certo. Na
  malha detalhada o mesmo ponto cai dentro do Pará.

  A simplificação corta os recortes da divisa, e é exatamente na divisa que
  estas unidades ficam. Para separar "está no estado" de "está a mil
  quilómetros dali" a malha grosseira chegava; para dizer a alguém que apague
  uma coordenada do cadastro, não chega.

  O QUE NÃO SE FAZ AQUI

  Não se inventa coordenada. Quando as duas fontes discordam e ambas caem
  dentro da UF declarada, a malha não distingue — e o veredito é `conflito`,
  que no mapa continua a ler-se "em validação". São 118 casos, e são trabalho
  de quem conhece o território, não de aritmética.

  COMO CORRER

    node scripts/validar-localizacoes.mjs <lotacoes.xlsx> <rede_cnes.json>

  As malhas do IBGE ficam em cache em `.cache/malhas-ibge-maxima/`. O resultado vai
  para `public/data/localizacoes-validadas.json`.
*/
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { ficheiroDosVereditos } from "./veredito-para-o-mapa.mjs";
import { join } from "node:path";
import { lerPlanilhaXlsx } from "./ler-planilha-xlsx.mjs";
import { carregarUf } from "./malhas-das-ufs.mjs";
import { decidirLocalizacao } from "./decidir-localizacao.mjs";
import {
  nomeCanonico,
  canonicoUtilizavel,
  tipoDeclarado,
  distanciaKm,
  LIMIAR_PROXIMA_KM,
} from "../src/lib/reconciliacao-unidades.js";
import { siglaDaUf } from "../src/lib/uf-ibge.js";

const CACHE = ".cache/malhas-ibge-maxima";
const SAIDA = "public/data/localizacoes-validadas.json";

const UFS = {
  11: "RO",
  12: "AC",
  13: "AM",
  14: "RR",
  15: "PA",
  16: "AP",
  17: "TO",
  21: "MA",
  22: "PI",
  23: "CE",
  24: "RN",
  25: "PB",
  26: "PE",
  27: "AL",
  28: "SE",
  29: "BA",
  31: "MG",
  32: "ES",
  33: "RJ",
  35: "SP",
  41: "PR",
  42: "SC",
  43: "RS",
  50: "MS",
  51: "MT",
  52: "GO",
  53: "DF",
};

const normalizar = (valor) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

async function baixar(url, destino) {
  if (existsSync(destino)) return;
  const resposta = await fetch(url, { signal: AbortSignal.timeout(40000) });
  if (!resposta.ok) throw new Error(`${destino}: HTTP ${resposta.status}`);
  writeFileSync(destino, await resposta.text());
}

async function garantirMalhas() {
  mkdirSync(CACHE, { recursive: true });
  await baixar(
    "https://servicodados.ibge.gov.br/api/v1/localidades/municipios",
    join(CACHE, "municipios.json"),
  );
  for (const [codigo, sigla] of Object.entries(UFS)) {
    await baixar(
      `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${codigo}` +
        "?formato=application/vnd.geo+json&qualidade=maxima",
      join(CACHE, `uf-${sigla}.json`),
    );
  }
}

function lerLotacoes(caminho) {
  const folhas = lerPlanilhaXlsx(caminho);
  const primeira = Object.keys(folhas).sort()[0];
  return folhas[primeira]
    .slice(1)
    .map((linha) => ({
      dsei: normalizar(linha.A),
      nome: linha.C,
      canonico: nomeCanonico(linha.C),
      tipo: tipoDeclarado(`${linha.B} ${linha.C}`),
      municipio: normalizar(linha.E),
      lat: Number(linha.F),
      lon: Number(linha.G),
    }))
    .filter((l) => Number.isFinite(l.lat) && Number.isFinite(l.lon));
}

function lerCnes(caminho) {
  return JSON.parse(readFileSync(caminho, "utf8")).map((e) => ({
    dsei: normalizar(e.dsei),
    nome: e.nome_estabelecimento,
    canonico: nomeCanonico(e.nome_estabelecimento),
    tipo: tipoDeclarado(e.nome_estabelecimento),
    cnes: String(e.cnes),
    municipio: normalizar(e.municipio),
    uf: siglaDaUf(e.uf_codigo),
    lat: Number(e.latitude),
    lon: Number(e.longitude),
  }));
}

async function principal() {
  const [caminhoLotacoes, caminhoCnes] = process.argv.slice(2);
  if (!caminhoLotacoes || !caminhoCnes) {
    console.error(
      "uso: node scripts/validar-localizacoes.mjs <lotacoes.xlsx> <rede_cnes.json>",
    );
    process.exitCode = 1;
    return;
  }

  await garantirMalhas();
  const malhas = new Map(
    Object.values(UFS).map((sigla) => [sigla, carregarUf(CACHE, sigla)]),
  );

  const ufsPorMunicipio = new Map();
  for (const m of JSON.parse(
    readFileSync(join(CACHE, "municipios.json"), "utf8"),
  )) {
    const sigla =
      m.microrregiao?.mesorregiao?.UF?.sigla ||
      m.regiaoImediata?.regiaoIntermediaria?.UF?.sigla;
    if (!sigla) continue;
    const chave = normalizar(m.nome);
    if (!ufsPorMunicipio.has(chave)) ufsPorMunicipio.set(chave, new Set());
    ufsPorMunicipio.get(chave).add(sigla);
  }

  const lotacoes = lerLotacoes(caminhoLotacoes);
  const estabelecimentos = lerCnes(caminhoCnes);

  const indice = new Map();
  for (const e of estabelecimentos) {
    if (!canonicoUtilizavel(e.canonico)) continue;
    const chave = `${e.dsei}|${e.canonico}`;
    if (!indice.has(chave)) indice.set(chave, []);
    indice.get(chave).push(e);
  }

  const registros = [];
  for (const lotacao of lotacoes) {
    const candidatos = (
      indice.get(`${lotacao.dsei}|${lotacao.canonico}`) || []
    ).filter(
      (e) =>
        e.tipo === lotacao.tipo ||
        lotacao.tipo === "outro" ||
        e.tipo === "outro",
    );
    // Mais de um candidato não é par: é ambiguidade, e não se arbitra.
    const estabelecimento = candidatos.length === 1 ? candidatos[0] : null;

    const uf =
      estabelecimento?.uf ||
      (ufsPorMunicipio.get(lotacao.municipio)?.size === 1
        ? [...ufsPorMunicipio.get(lotacao.municipio)][0]
        : null);

    /*
      A decisão vive em `decidir-localizacao.mjs`, partilhada com a segunda
      passagem. Duas cópias da mesma regra divergem, e dois vereditos com o
      mesmo nome passariam a querer dizer coisas diferentes.
    */
    const decisao = decidirLocalizacao({
      primeira: lotacao,
      segunda: estabelecimento,
      uf,
      malha: uf ? malhas.get(uf) : null,
    });

    registros.push({
      dsei: lotacao.dsei,
      canonico: lotacao.canonico,
      nome: lotacao.nome,
      tipo: lotacao.tipo,
      municipio: lotacao.municipio,
      uf: decisao.prova.uf,
      estado: decisao.estado,
      motivo: decisao.motivo,
      km: decisao.prova.km == null ? null : Number(decisao.prova.km.toFixed(3)),
      cnes: estabelecimento?.cnes ?? null,
      lat: decisao.ponto ? Number(decisao.ponto.lat.toFixed(6)) : null,
      lon: decisao.ponto ? Number(decisao.ponto.lon.toFixed(6)) : null,
    });
  }

  const contagem = {};
  for (const r of registros) contagem[r.estado] = (contagem[r.estado] || 0) + 1;

  writeFileSync(
    SAIDA,
    `${JSON.stringify(
      {
        gerado_em: new Date().toISOString().slice(0, 10),
        fontes: {
          lotacoes: caminhoLotacoes.split(/[\\/]/).pop(),
          cnes: caminhoCnes.split(/[\\/]/).pop(),
          arbitro: "malhas das UFs, IBGE, qualidade mínima",
        },
        limiar_concordancia_km: LIMIAR_PROXIMA_KM,
        contagem,
        registros,
      },
      null,
      1,
    )}\n`,
  );

  /*
    O JSON acima é o registro auditável e fica fora do pacote. O que vai no
    pacote é agora TUDO, e a razão está em `veredito-para-o-mapa.mjs`: o
    critério antigo — "só os que mudam alguma coisa" — deixava de fora 119
    conflitos, e o mapa escrevia "Localização em validação" em cima deles.
  */
  writeFileSync(
    "src/lib/localizacoes-validadas-gerado.js",
    await ficheiroDosVereditos(registros),
  );

  console.log(`${registros.length} lotações com coordenada`);
  for (const [estado, total] of Object.entries(contagem).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${String(total).padStart(4)}  ${estado}`);
  }
  console.log(`escrito: ${SAIDA}`);
}

await principal();
