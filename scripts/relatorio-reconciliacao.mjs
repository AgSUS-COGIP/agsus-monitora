import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { lerDoArquivo, lerDoBanco } from "./auditar-coordenadas.mjs";
import {
  DIVERGENCIA,
  LIMIAR_PENDENTE_KM,
  LIMIAR_PROXIMA_KM,
  nomeCanonico,
  reconciliarDsei,
  tipoDeclarado,
} from "../src/lib/reconciliacao-unidades.js";

/*
  RELATÓRIO DA RECONCILIAÇÃO — SOMENTE LEITURA.

  Corre a mesma função que o mapa usa, sobre os dados reais, e diz o que ela
  reconciliou sozinha, o que deixou ambíguo e o que recusou. Não escreve no
  banco, não altera payload, não corrige coordenada nenhuma.

    node scripts/relatorio-reconciliacao.mjs                   # SUPABASE_DB_URL
    node scripts/relatorio-reconciliacao.mjs --arquivo d.json
    node scripts/relatorio-reconciliacao.mjs --csv pares.csv

  A lista de ambíguos é a entrega mais importante deste relatório: é o trabalho
  que a máquina não pode fazer por ninguém, apresentado para decisão humana em
  vez de resolvido por adivinhação.
*/

const args = process.argv.slice(2);
const valorDe = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};

export function reconciliarPayload({ lmap, rede_cnes }) {
  const rede = rede_cnes?.rede || {};
  const total = {
    reconciliados: [],
    ambiguos: [],
    rejeitados: [],
    polosSemPar: [],
  };

  (lmap?.dsei || []).forEach((d) => {
    const r = rede[d.k] || { u: [], c: [] };
    const estabelecimentos = [...(r.u || []), ...(r.c || [])].map((a) => ({
      nome: a[0],
      cnes: a[1],
      chave: a[1] || `${a[0]}|${a[2]}|${a[3]}`,
      lat: a[2],
      lon: a[3],
      municipio: a[4],
      uf: a[5],
    }));

    const saida = reconciliarDsei({
      dseiChave: d.k,
      polos: (d.polos || []).map((p) => ({
        nome: p.n,
        lat: p.lat,
        lon: p.lon,
        uf: p.uf,
        cod: p.cod ?? null,
        tipo: "polo",
      })),
      estabelecimentos,
    });

    const comDsei = (lista) =>
      lista.map((item) => ({ ...item, dsei: item.dsei || d.k }));
    total.reconciliados.push(...saida.reconciliados);
    total.ambiguos.push(...comDsei(saida.ambiguos));
    total.rejeitados.push(...comDsei(saida.rejeitados));
    total.polosSemPar.push(...comDsei(saida.polosSemPar));
  });

  return total;
}

function imprimir(t) {
  const porDivergencia = {};
  t.reconciliados.forEach((u) => {
    porDivergencia[u.divergencia] = (porDivergencia[u.divergencia] || 0) + 1;
  });

  console.log(
    `\nPARES RECONCILIADOS AUTOMATICAMENTE: ${t.reconciliados.length}`,
  );
  console.log(
    `  ${String(porDivergencia[DIVERGENCIA.PROXIMA] || 0).padStart(4)}  provável mesma localização (< ${LIMIAR_PROXIMA_KM} km)`,
  );
  console.log(
    `  ${String(porDivergencia[DIVERGENCIA.DIVERGENTE] || 0).padStart(4)}  reconciliado com divergência (${LIMIAR_PROXIMA_KM}–${LIMIAR_PENDENTE_KM} km)`,
  );
  console.log(
    `  ${String(porDivergencia[DIVERGENCIA.PENDENTE] || 0).padStart(4)}  localização pendente de validação (> ${LIMIAR_PENDENTE_KM} km)`,
  );

  console.log(`\nAMBÍGUOS — precisam de decisão humana: ${t.ambiguos.length}`);
  t.ambiguos
    .slice(0, 20)
    .forEach((a) =>
      console.log(
        `  ${a.dsei} | ${a.polo.nome} → ${a.candidatos.length} candidatos: ${a.candidatos.map((c) => `${c.nome} (CNES ${c.cnes})`).join(" ; ")}`,
      ),
    );

  console.log(`\nREJEITADOS — nome bate, tipo não: ${t.rejeitados.length}`);
  t.rejeitados
    .slice(0, 20)
    .forEach((r) =>
      console.log(
        `  ${r.dsei} | ${r.polo.nome} vs ${r.candidatos.map((c) => `${c.nome} [${tipoDeclarado(c.nome)}]`).join(" ; ")}`,
      ),
    );

  console.log(`\nPOLOS SEM PAR NO DSEI: ${t.polosSemPar.length}`);
  const motivos = {};
  t.polosSemPar.forEach((p) => {
    motivos[p.motivo] = (motivos[p.motivo] || 0) + 1;
  });
  Object.entries(motivos).forEach(([m, n]) =>
    console.log(`  ${String(n).padStart(4)}  ${m}`),
  );

  const maiores = [...t.reconciliados]
    .filter((u) => u.distancia_entre_fontes_km != null)
    .sort((a, b) => b.distancia_entre_fontes_km - a.distancia_entre_fontes_km)
    .slice(0, 15);
  if (maiores.length) {
    console.log("\nMAIORES DIVERGÊNCIAS ENTRE AS FONTES\n");
    maiores.forEach((u) =>
      console.log(
        `  ${String(u.distancia_entre_fontes_km).padStart(7)} km  ${u.dsei} | ${u.nomes.lmap} ↔ ${u.nomes.rede_cnes} (CNES ${u.cnes || "-"})`,
      ),
    );
  }
}

function gravarCsv(caminho, t) {
  const cab = [
    "situacao",
    "dsei",
    "canonico",
    "nome_lmap",
    "nome_rede_cnes",
    "cnes",
    "cod",
    "lat_lmap",
    "lon_lmap",
    "lat_rede_cnes",
    "lon_rede_cnes",
    "lat_exibida",
    "lon_exibida",
    "distancia_entre_fontes_km",
    "divergencia",
    "municipio",
    "uf",
    "observacao",
  ];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const linhas = [];

  t.reconciliados.forEach((u) =>
    linhas.push(
      [
        "reconciliado",
        u.dsei,
        u.canonico,
        u.nomes.lmap,
        u.nomes.rede_cnes,
        u.cnes,
        u.cod,
        u.coordenadas.lmap.lat,
        u.coordenadas.lmap.lon,
        u.coordenadas.rede_cnes.lat,
        u.coordenadas.rede_cnes.lon,
        u.lat,
        u.lon,
        u.distancia_entre_fontes_km,
        u.divergencia,
        u.municipio,
        u.uf,
        `exibida a coordenada de ${u.coordenada_exibida}`,
      ].map(esc),
    ),
  );

  t.ambiguos.forEach((a) =>
    linhas.push(
      [
        "ambiguo",
        a.dsei,
        a.canonico,
        a.polo.nome,
        a.candidatos.map((c) => c.nome).join(" | "),
        a.candidatos.map((c) => c.cnes).join(" | "),
        a.polo.cod,
        a.polo.lat,
        a.polo.lon,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        a.polo.uf,
        a.motivo,
      ].map(esc),
    ),
  );

  t.rejeitados.forEach((r) =>
    linhas.push(
      [
        "rejeitado",
        r.dsei,
        r.canonico,
        r.polo.nome,
        r.candidatos
          .map((c) => `${c.nome} [${tipoDeclarado(c.nome)}]`)
          .join(" | "),
        r.candidatos.map((c) => c.cnes).join(" | "),
        r.polo.cod,
        r.polo.lat,
        r.polo.lon,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        r.polo.uf,
        r.motivo,
      ].map(esc),
    ),
  );

  t.polosSemPar.forEach((p) =>
    linhas.push(
      [
        "sem_par",
        p.dsei,
        nomeCanonico(p.polo.nome),
        p.polo.nome,
        "",
        "",
        p.polo.cod,
        p.polo.lat,
        p.polo.lon,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        p.polo.uf,
        p.motivo,
      ].map(esc),
    ),
  );

  writeFileSync(
    caminho,
    [cab.join(";"), ...linhas.map((l) => l.join(";"))].join("\n"),
    "utf8",
  );
  console.log(`\nTabela dos pares gravada em ${caminho}`);
}

async function principal() {
  const arquivo = valorDe("--arquivo");
  const payload = arquivo ? lerDoArquivo(arquivo) : await lerDoBanco();
  if (!payload?.lmap || !payload?.rede_cnes) {
    console.error(
      "Sem fonte de dados. Defina SUPABASE_DB_URL (somente leitura) ou passe --arquivo <export.json>.",
    );
    process.exit(2);
  }

  const total = reconciliarPayload(payload);
  imprimir(total);

  const csv = valorDe("--csv");
  if (csv) gravarCsv(csv, total);

  console.log(
    "\nEste script não alterou nada. Nenhuma escrita no banco nem no payload.",
  );
  return total;
}

const executadoDireto =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (executadoDireto) {
  principal().catch((erro) => {
    console.error("Relatório falhou:", erro?.message || erro);
    process.exit(1);
  });
}
