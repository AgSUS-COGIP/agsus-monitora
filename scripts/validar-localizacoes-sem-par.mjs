import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { carregarUf } from "./malhas-das-ufs.mjs";
import { decidirLocalizacao } from "./decidir-localizacao.mjs";
import {
  carregarMunicipios,
  garantirMalhasMunicipais,
} from "./malhas-dos-municipios.mjs";
import { ficheiroDosVereditos } from "./veredito-para-o-mapa.mjs";
import { applyLotacoesGeograficas } from "../src/modules/lotacoes-geograficas-transport.js";
import {
  canonicoUtilizavel,
  nomeCanonico,
} from "../src/lib/reconciliacao-unidades.js";
import { siglaDaUf } from "../src/lib/uf-ibge.js";

/*
  A SEGUNDA PASSAGEM: OS PONTOS QUE A AUDITORIA NUNCA HAVIA OLHADO

  `validar-localizacoes.mjs` correu sobre as 606 linhas da planilha de
  Lotações. Ficaram de fora dois grupos, e os dois aparecem no mapa:

    66 polos que existem no banco sem estar na planilha. `FULNI-Ô` é um deles —
       a planilha traz o mesmo polo partido em `FULNI-Ô I` e `FULNI-Ô II`, e o
       banco e o CNES têm um só. O popup dele dizia "Localização em validação",
       e dizia a verdade: ninguém o tinha olhado.

    829 estabelecimentos do CNES sem lotação correspondente. Postos de aldeia,
       UBSIs, unidades que a planilha de lotações não cobre.

  O QUE SE PODE DIZER SOBRE ELES, E O QUE NÃO SE PODE

  Para estes há UMA coordenada só. Sem segunda fonte não há como confirmar
  posição — só como detetar contradição: a coordenada cai, ou não cai, dentro
  da UF que o próprio registro declara.

  A PERGUNTA É FEITA AO MUNICÍPIO, NÃO SÓ À UF

  A primeira versão desta passagem perguntava só à malha da UF, como a primeira
  passagem faz. Deu 744 "coerente" e UM "erro" — um crivo que quase nunca acusa
  nada não está a dizer muito.

  A malha municipal responde a uma pergunta mais estreita: a coordenada cai no
  município que o próprio cadastro declara? Nas mesmas unidades, ela acusou
  CINQUENTA E DUAS. Cinquenta e duas vezes mais.

  Os dois crivos ficam, do mais fino para o mais grosso:

      coerente / fonte_unica_no_municipio    cai no município declarado
      coerente / fonte_unica_na_uf           cai na UF; município não conferível
      erro     / fonte_unica_fora_do_municipio
      erro     / fonte_unica_fora_da_uf
      indeterminado / uf_indeterminada       sem UF ou sem coordenada

  Nenhum destes pode sair `validada`. Uma fonte só nunca valida nada, e o rótulo
  no ecrã diz isso por extenso.

  POR QUE UM SEGUNDO FICHEIRO, E NÃO UM ARGUMENTO A MAIS NO PRIMEIRO

  O primeiro precisa da planilha .xlsx, que não é versionada, e fala com o CNES
  e com o IBGE. Este precisa do que o mapa carrega — e nada mais do que a cache
  de malhas que o primeiro já deixou. Correr um não obriga a correr o outro.

  Os dois escrevem no mesmo JSON e pelo mesmo `ficheiroDosVereditos`. Este nunca
  toca num veredito que já lá esteja: só acrescenta chaves ausentes.

      node scripts/validar-localizacoes-sem-par.mjs <lmap.json> <rede_cnes.json>
*/
const CACHE = ".cache/malhas-ibge-maxima";
const SAIDA = "public/data/localizacoes-validadas.json";
const DADOS = "public/data";

const semAcento = (valor) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

function carregarDados(caminhoLmap, caminhoRede) {
  const lerPayload = (caminho) => {
    const bruto = JSON.parse(readFileSync(caminho, "utf8"));
    // Aceita tanto a resposta crua do PostgREST como o payload já desembrulhado.
    if (Array.isArray(bruto)) return bruto[0]?.payload ?? bruto[0];
    return bruto.payload ?? bruto;
  };

  const dataset = Object.assign(
    {},
    ...readdirSync(DADOS)
      .filter((f) => f.startsWith("lotacoes-geograficas-"))
      .map((f) => JSON.parse(readFileSync(join(DADOS, f), "utf8"))),
  );

  const saida = applyLotacoesGeograficas(
    [
      { chave: "lmap", payload: lerPayload(caminhoLmap) },
      { chave: "rede_cnes", payload: lerPayload(caminhoRede) },
    ],
    dataset,
  );
  return {
    lmap: saida.find((r) => r.chave === "lmap").payload,
    rede: saida.find((r) => r.chave === "rede_cnes").payload,
  };
}

async function principal() {
  const [caminhoLmap, caminhoRede] = process.argv.slice(2);
  if (!caminhoLmap || !caminhoRede) {
    console.error(
      "uso: node scripts/validar-localizacoes-sem-par.mjs <lmap.json> <rede_cnes.json>",
    );
    process.exitCode = 1;
    return;
  }

  await garantirMalhasMunicipais(CACHE);
  const municipios = carregarMunicipios(CACHE);
  const codigoPorNomeUf = new Map();
  for (const m of JSON.parse(
    readFileSync(join(CACHE, "municipios.json"), "utf8"),
  )) {
    const sigla = m.microrregiao?.mesorregiao?.UF?.sigla;
    if (sigla)
      codigoPorNomeUf.set(`${semAcento(m.nome)}|${sigla}`, String(m.id));
  }

  const auditoria = JSON.parse(readFileSync(SAIDA, "utf8"));
  const existentes = new Set(
    auditoria.registros.map((r) => `${semAcento(r.dsei)}|${r.canonico}`),
  );

  const { lmap, rede } = carregarDados(caminhoLmap, caminhoRede);
  const malhas = new Map();
  const malhaDe = (sigla) => {
    if (!sigla) return null;
    if (!malhas.has(sigla)) {
      try {
        malhas.set(sigla, carregarUf(CACHE, sigla));
      } catch {
        malhas.set(sigla, null);
      }
    }
    return malhas.get(sigla);
  };

  /*
    RECOLHER PRIMEIRO, DECIDIR DEPOIS

    Uma chave repetida faz o índice de leitura descartar AS DUAS entradas, e com
    razão: ambiguidade não decide nada. Mas nem toda a repetição é ambiguidade.

    O polo `FULNI-Ô` do banco e o `POLO BASE FULNI O` do CNES partilham a chave
    porque SÃO a mesma coisa — a reconciliação já os desenha como um ponto só.
    Duas coordenadas para a mesma unidade não é confusão, é a situação que a
    primeira passagem sabe julgar: concordam, discordam, ou uma delas cai fora.

    Por isso recolhe-se tudo por chave e decide-se no fim, sabendo quantas
    fontes há e de onde vêm. Só é ambiguidade quando duas entradas vêm da MESMA
    fonte — aí não se sabe qual é qual, e nenhuma é julgada.
  */
  const porChave = new Map();

  const juntar = (
    dsei,
    dseiChave,
    nome,
    lat,
    lon,
    uf,
    tipo,
    municipio,
    origem,
  ) => {
    const canonico = nomeCanonico(nome);
    if (!canonicoUtilizavel(canonico)) return;
    const chave = `${semAcento(dseiChave)}|${canonico}`;
    if (existentes.has(chave)) return;
    if (!porChave.has(chave)) porChave.set(chave, []);
    porChave.get(chave).push({
      dsei: dseiChave,
      canonico,
      nome,
      tipo,
      origem,
      municipio: municipio || "",
      uf: uf || null,
      lat: Number(lat),
      lon: Number(lon),
    });
  };

  for (const d of lmap.dsei || []) {
    for (const p of d.polos || []) {
      const uf = String(p.uf || d.sedeuf || "").toUpperCase() || null;
      juntar(d.n, d.k, p.n, p.lat, p.lon, uf, "polo", p.mun_lotacao, "lmap");
    }
    const grupo = rede.rede?.[d.k] || { u: [], c: [] };
    for (const lista of ["u", "c"]) {
      for (const x of grupo[lista] || []) {
        const uf = siglaDaUf(x[5]) || null;
        juntar(
          d.n,
          d.k,
          x[0],
          x[2],
          x[3],
          uf,
          lista === "c" ? "casai" : "unidade",
          x[4],
          "cnes",
        );
      }
    }
  }

  /*
    Agora sim, com tudo recolhido. Uma entrada é fonte única; uma do banco mais
    uma do CNES são duas fontes da MESMA unidade, e vão para a mesma decisão que
    a primeira passagem usa. Duas da mesma origem é que não se julga.

    A ordem importa: a primeira posição é a do banco, a segunda a do CNES — é o
    que os motivos `arbitrada_pela_uf_lotacoes` e `arbitrada_pela_uf_cnes`
    querem dizer, e trocá-las trocaria os nomes dos vereditos.
  */
  const novos = [];
  let ambiguos = 0;

  for (const entradas of porChave.values()) {
    const doBanco = entradas.filter((e) => e.origem === "lmap");
    const doCnes = entradas.filter((e) => e.origem === "cnes");
    if (doBanco.length > 1 || doCnes.length > 1) {
      ambiguos += 1;
      continue;
    }

    const primeira = doBanco[0] || doCnes[0];
    const segunda = doBanco[0] && doCnes[0] ? doCnes[0] : null;
    const uf = primeira.uf || segunda?.uf || null;
    const municipio = primeira.municipio || segunda?.municipio || "";

    const decisao = decidirLocalizacao({
      primeira,
      segunda,
      uf,
      malha: malhaDe(uf),
      municipios,
      codigoMunicipio: codigoPorNomeUf.get(`${semAcento(municipio)}|${uf}`),
    });

    novos.push({
      dsei: primeira.dsei,
      canonico: primeira.canonico,
      nome: primeira.nome,
      tipo: primeira.tipo,
      municipio,
      uf,
      estado: decisao.estado,
      motivo: decisao.motivo,
      km:
        decisao.prova?.km == null
          ? null
          : Number(Number(decisao.prova.km).toFixed(3)),
      cnes: null,
      // Coordenada só nos `validada`, que são os únicos que o mapa usa.
      lat: decisao.estado === "validada" ? (decisao.ponto?.lat ?? null) : null,
      lon: decisao.estado === "validada" ? (decisao.ponto?.lon ?? null) : null,
      fonte_do_veredito: segunda
        ? "segunda_passagem_banco_e_cnes"
        : "segunda_passagem_fonte_unica",
    });
  }

  const registros = [...auditoria.registros, ...novos];
  writeFileSync(
    SAIDA,
    JSON.stringify(
      {
        ...auditoria,
        gerado_em: new Date().toISOString().slice(0, 10),
        segunda_passagem: {
          gerado_em: new Date().toISOString().slice(0, 10),
          criterio:
            "fonte única: a coordenada cai, ou não, dentro do município — ou, sem município conferível, da UF — que o registro declara",
          arbitro: "malhas das UFs e dos municípios, IBGE, qualidade máxima",
          acrescentados: novos.length,
          descartados_por_nome_repetido_na_mesma_fonte: ambiguos,
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

  const porEstado = new Map();
  for (const r of novos)
    porEstado.set(r.estado, (porEstado.get(r.estado) || 0) + 1);

  console.log(`primeira passagem: ${auditoria.registros.length} vereditos`);
  console.log(`segunda passagem:  ${novos.length} vereditos novos`);
  for (const [estado, n] of [...porEstado].sort((a, b) => b[1] - a[1])) {
    console.log(`     ${String(n).padStart(4)}  ${estado}`);
  }
  console.log(`  descartados por nome repetido na mesma fonte: ${ambiguos}`);
  console.log("");
  console.log(`total: ${registros.length} vereditos`);
}

await principal();
