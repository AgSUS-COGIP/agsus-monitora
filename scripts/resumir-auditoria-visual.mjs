#!/usr/bin/env node
/*
  Resumo da auditoria visual: lê as medições de
  `test-results/auditoria-visual/medicoes/*.json` (gravadas por
  tests/auditoria-visual.spec.js) e escreve, na mesma pasta de cima:

    resumo.md    — as tabelas para ler (e copiar para o relatório)
    resumo.json  — os mesmos números, para comparar uma rodada com outra

  Conta "achados distintos": a mesma regra repetida em 50 linhas de tabela é
  um achado só (assinatura do elemento + propriedade + valor), e a soma é
  feita por tela (união das larguras e temas). É o número que encolhe quando
  se corrige na fonte.

  Uso: node scripts/resumir-auditoria-visual.mjs [pasta]
*/
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PASTA = process.argv[2] || "test-results/auditoria-visual";
const MEDICOES = join(PASTA, "medicoes");

/* RPCs de fundo da moldura: não são dados da tela. */
const RPC_DE_FUNDO =
  /^(registrar_|obter_inicio_da_sessao|obter_situacao_do_sistema|listar_abas_do_menu|obter_meu_resumo_do_dia|listar_avisos_conferencia_se_mudou|obter_encerramentos_do_edital)/;

const TIPOS = {
  rolagem: "Rolagem horizontal da página",
  transbordaPai: "Elemento passa do pai",
  cortado: "Conteúdo cortado (overflow hidden)",
  reticencias: "Texto com reticências sem o texto inteiro (title)",
  toque: "Alvo de toque < 44 × 44 px (375 e 768)",
  fonte: "Fonte fora da escala",
  peso: "Peso fora de 400/500/600",
  espaco: "Espaçamento fora da escala",
  cor: "Cor que não é token",
  feitoAMao: "Componente feito à mão",
};

const chaveDoAchado = (tipo, a) => {
  switch (tipo) {
    case "transbordaPai":
      return `${a.el} ⊄ ${a.pai}`;
    case "cortado":
    case "reticencias":
      return a.el;
    case "toque":
      return `${a.el} (${a.tamanho})`;
    case "espaco":
      return `${a.el} | ${a.prop} ${a.valor}`;
    case "cor":
      return `${a.el} | ${a.prop} ${a.valor}`;
    case "feitoAMao":
      return `${a.tipo}: ${a.el}`;
    default:
      return `${a.el} | ${a.valor}`;
  }
};

/* O que conta em cada tipo (o resto vai para notas, não para o ranking). */
const conta = (tipo, a) => {
  if (tipo === "reticencias") return !a.intencional;
  if (tipo === "cor") return !a.derivada && !a.barra;
  return true;
};

const medicoes = readdirSync(MEDICOES)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(MEDICOES, f), "utf8")));

if (!medicoes.length) {
  console.error(
    `Nenhuma medição em ${MEDICOES}. Rode antes: npm run auditoria:visual`,
  );
  process.exit(1);
}

const porTela = new Map();
const porTipo = Object.fromEntries(
  Object.keys(TIPOS).map((t) => [t, new Map()]),
);
const causas = new Map();
const rolagens = [];
const semDados = new Map();
const errosDaPagina = [];
const notas = {
  corDerivada: new Set(),
  corDaBarra: new Set(),
  reticenciasComTitle: new Set(),
};
/* O que mora na moldura: se repete em todas as telas e se corrige uma vez. */
const moldura = Object.fromEntries(
  Object.keys(TIPOS).map((t) => [t, new Map()]),
);
const guardar = (mapa, chave, tela, origem) => {
  if (!mapa.has(chave)) mapa.set(chave, { telas: new Set(), vezes: 0, origem });
  const item = mapa.get(chave);
  item.telas.add(tela);
  item.vezes += 1;
  if (!item.origem && origem) item.origem = origem;
};

for (const m of medicoes) {
  const tela = m.tela;
  if (!porTela.has(tela))
    porTela.set(tela, {
      variantes: 0,
      rolagem: 0,
      larguraMaxima: 0,
      distintos: Object.fromEntries(
        Object.keys(TIPOS).map((t) => [t, new Set()]),
      ),
    });
  const t = porTela.get(tela);
  t.variantes += 1;
  const faltam = (m.semDados || []).filter((n) => !RPC_DE_FUNDO.test(n));
  if (faltam.length) semDados.set(`${tela} (${m.estado})`, faltam);
  if (m.errosDaPagina?.length)
    errosDaPagina.push({ captura: m.captura, erros: m.errosDaPagina });

  if (m.achados.rolagem) {
    const daTela = m.achados.rolagem.culpados.some(
      (c) => c.regiao !== "moldura",
    );
    if (daTela) {
      t.rolagem += 1;
      t.larguraMaxima = Math.max(t.larguraMaxima, m.achados.rolagem.largura);
    }
    rolagens.push({ captura: m.captura, ...m.achados.rolagem });
    for (const c of m.achados.rolagem.culpados) {
      const chave = c.caminho;
      if (c.regiao === "moldura") {
        guardar(moldura.rolagem, chave, tela, "");
        continue;
      }
      t.distintos.rolagem.add(chave);
      const mapa = porTipo.rolagem;
      if (!mapa.has(chave)) mapa.set(chave, { telas: new Set(), vezes: 0 });
      mapa.get(chave).telas.add(tela);
      mapa.get(chave).vezes += 1;
    }
  }

  for (const tipo of Object.keys(TIPOS)) {
    if (tipo === "rolagem") continue;
    for (const a of m.achados[tipo] || []) {
      const chave = chaveDoAchado(tipo, a);
      if (tipo === "cor" && a.derivada) notas.corDerivada.add(chave);
      if (tipo === "cor" && a.barra) notas.corDaBarra.add(chave);
      if (tipo === "reticencias" && a.intencional)
        notas.reticenciasComTitle.add(chave);
      if (!conta(tipo, a)) continue;
      if (a.origem && ["fonte", "peso", "espaco", "cor"].includes(tipo)) {
        const prop =
          a.prop ||
          (tipo === "fonte"
            ? "font-size"
            : tipo === "peso"
              ? "font-weight"
              : tipo);
        const chaveDaCausa = `${a.origem} ⟶ ${prop}: ${a.valor}`;
        if (!causas.has(chaveDaCausa))
          causas.set(chaveDaCausa, {
            tipo,
            regiao: a.regiao,
            telas: new Set(),
            elementos: new Set(),
            vezes: 0,
          });
        const causa = causas.get(chaveDaCausa);
        causa.telas.add(tela);
        causa.elementos.add(a.el);
        causa.vezes += 1;
      }
      // A moldura (barra lateral, cabeçalho, avisos) vai para a seção dela.
      if (a.regiao === "moldura") {
        guardar(moldura[tipo], chave, tela, a.origem);
        continue;
      }
      t.distintos[tipo].add(chave);
      guardar(porTipo[tipo], chave, tela, a.origem);
    }
  }
}

/* Peso de cada tipo no ranking das telas: o que mais quebra o uso pesa mais. */
const PESO = {
  rolagem: 5,
  transbordaPai: 2,
  cortado: 2,
  reticencias: 1,
  toque: 2,
  fonte: 1,
  peso: 1,
  espaco: 0.5,
  cor: 1,
  feitoAMao: 1,
};

const ranking = [...porTela.entries()]
  .map(([tela, t]) => {
    const n = Object.fromEntries(
      Object.keys(TIPOS).map((tipo) => [tipo, t.distintos[tipo].size]),
    );
    n.rolagem = t.rolagem;
    const pontos = Object.keys(TIPOS).reduce(
      (s, tipo) => s + n[tipo] * PESO[tipo],
      0,
    );
    return {
      tela,
      variantes: t.variantes,
      larguraMaxima: t.larguraMaxima,
      ...n,
      pontos,
    };
  })
  .sort((a, b) => b.pontos - a.pontos);

const topo = (mapa, quantos = 15) =>
  [...mapa.entries()]
    .map(([chave, v]) => ({
      chave,
      telas: v.telas.size,
      vezes: v.vezes,
      origem: v.origem,
    }))
    .sort((a, b) => b.telas - a.telas || b.vezes - a.vezes)
    .slice(0, quantos);

const componentes = new Map();
for (const tipo of Object.keys(TIPOS))
  for (const [chave, v] of porTipo[tipo]) {
    const el = chave.split(/ \| | ⊄ | \(/)[0].replace(/^[^:]+: /, "");
    if (!componentes.has(el))
      componentes.set(el, { tipos: new Set(), telas: new Set(), vezes: 0 });
    const c = componentes.get(el);
    c.tipos.add(tipo);
    for (const tela of v.telas) c.telas.add(tela);
    c.vezes += v.vezes;
  }

const linhasMd = [];
const md = (texto = "") => linhasMd.push(texto);
/* Texto numa célula de tabela Markdown: a barra invertida primeiro (senão o
   escape do `|` se desfaz), depois a barra vertical, e a quebra de linha vira espaço. */
const celula = (texto) =>
  String(texto)
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ");

md(`# Resumo da auditoria visual`);
md();
md(
  `${medicoes.length} medições (${porTela.size} telas × estados × larguras × temas).`,
);
md();
md(`## Total por tipo (achados distintos)`);
md();
md(`| Tipo | Na tela | Telas afetadas | Na moldura |`);
md(`| --- | ---: | ---: | ---: |`);
for (const [tipo, nome] of Object.entries(TIPOS)) {
  const telas = ranking.filter((r) => r[tipo] > 0).length;
  md(`| ${nome} | ${porTipo[tipo].size} | ${telas} | ${moldura[tipo].size} |`);
}
md();
md(
  `Rolagem horizontal: ${rolagens.length} das ${medicoes.length} medições têm conteúdo além da borda direita (${rolagens.filter((r) => r.escondidaPeloBody).length} delas escondidas pelo \`overflow-x: hidden\` do body, sem rolagem para alcançar).`,
);
md();
md(
  `Fora da conta: ${notas.corDerivada.size} cores derivadas de token (color-mix, até 8 de diferença por canal), ${notas.corDaBarra.size} da barra lateral (cor configurada) e ${notas.reticenciasComTitle.size} reticências com \`title\`.`,
);
md();
md(`## Moldura (barra lateral, cabeçalho, avisos: vale para todas as telas)`);
md();
md(`| Tipo | Achados distintos | Os mais repetidos (regra de origem) |`);
md(`| --- | ---: | --- |`);
for (const [tipo, nome] of Object.entries(TIPOS)) {
  if (!moldura[tipo].size) continue;
  const exemplos = topo(moldura[tipo], 4)
    .map(
      (i) =>
        `\`${celula(i.chave)}\`${i.origem ? ` ← \`${celula(i.origem)}\`` : ""}`,
    )
    .join("<br>");
  md(`| ${nome} | ${moldura[tipo].size} | ${exemplos} |`);
}
md();
md(
  `## Ranking das telas (só o conteúdo da tela e as camadas; a moldura está acima)`,
);
md();
md(
  `| # | Tela | Pontos | Rolagem (medições) | Passa do pai | Cortado | Reticências | Toque | Fonte | Peso | Espaço | Cor | À mão |`,
);
md(
  `| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |`,
);
ranking.forEach((r, i) =>
  md(
    `| ${i + 1} | ${r.tela} | ${r.pontos} | ${r.rolagem}${r.larguraMaxima ? ` (até ${r.larguraMaxima}px)` : ""} | ${r.transbordaPai} | ${r.cortado} | ${r.reticencias} | ${r.toque} | ${r.fonte} | ${r.peso} | ${r.espaco} | ${r.cor} | ${r.feitoAMao} |`,
  ),
);
md();
md(`## Componentes mais afetados`);
md();
md(`| Elemento | Telas | Ocorrências | Tipos |`);
md(`| --- | ---: | ---: | --- |`);
for (const [el, c] of [...componentes.entries()]
  .sort((a, b) => b[1].telas.size - a[1].telas.size || b[1].vezes - a[1].vezes)
  .slice(0, 30))
  md(
    `| \`${celula(el)}\` | ${c.telas.size} | ${c.vezes} | ${[...c.tipos].join(", ")} |`,
  );
md();
md(`## Causas comuns (a regra CSS de onde vem o valor)`);
md();
md(`| Regra ⟶ valor | Tipo | Onde | Telas | Elementos | Ocorrências |`);
md(`| --- | --- | --- | ---: | ---: | ---: |`);
for (const [chave, c] of [...causas.entries()]
  .sort((a, b) => b[1].telas.size - a[1].telas.size || b[1].vezes - a[1].vezes)
  .slice(0, 40))
  md(
    `| \`${celula(chave)}\` | ${c.tipo} | ${c.regiao} | ${c.telas.size} | ${c.elementos.size} | ${c.vezes} |`,
  );
md();
md(`## Rolagem horizontal`);
md();
if (!rolagens.length) md("Nenhuma medição com rolagem horizontal da página.");
for (const r of rolagens.sort((a, b) => b.largura - a.largura))
  md(
    `- \`${r.captura}\`: até ${r.largura}px numa janela de ${r.janela}px${r.escondidaPeloBody ? " (cortado, sem rolagem)" : ""} — ${r.culpados.map((c) => `\`${c.caminho}\` [${c.regiao}] (até ${c.direita}px)`).join("; ") || "sem culpado isolado"}`,
  );
for (const tipo of [
  "transbordaPai",
  "cortado",
  "reticencias",
  "toque",
  "fonte",
  "peso",
  "espaco",
  "cor",
  "feitoAMao",
]) {
  md();
  md(`## ${TIPOS[tipo]} — os mais repetidos`);
  md();
  md(`| Achado | Telas | Ocorrências | Regra de origem |`);
  md(`| --- | ---: | ---: | --- |`);
  for (const item of topo(porTipo[tipo], 20))
    md(
      `| \`${celula(item.chave)}\` | ${item.telas} | ${item.vezes} | ${item.origem ? `\`${celula(item.origem)}\`` : ""} |`,
    );
}
md();
md(`## Cobertura`);
md();
if (errosDaPagina.length) {
  md(`Erros da página (pageerror):`);
  for (const e of errosDaPagina)
    md(`- \`${e.captura}\`: ${e.erros.join(" · ")}`);
  md();
}
if (semDados.size) {
  md(
    `Telas que abriram sem resposta fictícia para alguma RPC de dados (aparecem no estado de erro):`,
  );
  for (const [tela, faltam] of semDados) md(`- ${tela}: ${faltam.join(", ")}`);
} else md(`Todas as RPCs de dados tiveram resposta fictícia.`);

writeFileSync(join(PASTA, "resumo.md"), `${linhasMd.join("\n")}\n`);
writeFileSync(
  join(PASTA, "resumo.json"),
  JSON.stringify(
    {
      medicoes: medicoes.length,
      ranking,
      rolagens,
      causas: [...causas.entries()].map(([chave, c]) => ({
        chave,
        tipo: c.tipo,
        telas: [...c.telas],
        vezes: c.vezes,
      })),
    },
    null,
    1,
  ),
);
console.log(
  `Resumo em ${join(PASTA, "resumo.md")} (${medicoes.length} medições, ${porTela.size} telas).`,
);
