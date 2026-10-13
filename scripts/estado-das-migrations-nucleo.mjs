import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/*
  A PARTE QUE SE PODE TESTAR SEM BANCO E SEM DISCO

  `estado-das-migrations.mjs` fala com o `psql` e lê argumentos de linha de
  comando ao ser importado — um ficheiro assim não se testa. O que decide o
  resultado, porém, é uma comparação entre duas listas, e essa cabe aqui.

  Permite importar as funções puras sem iniciar a consulta ao banco.
*/
export const DIRETORIOS = ["migrations", "correcoes"];

/*
  O hash é do conteúdo SEM o "
": o fim de linha depende do checkout (Windows
  com core.autocrlf=true põe CRLF em tudo), não do que o SQL faz. O registro do
  banco sempre foi gravado assim (auditoria de 13/10/2026: 151 de 151 batem sem
  o "
" e nenhum com ele); com os bytes crus, quem rodasse no Windows via todas
  as migrations como divergentes. Qualquer outro espaço continua contando.
*/
export function hashDoConteudo(conteudo) {
  const bytes = Buffer.isBuffer(conteudo)
    ? conteudo
    : Buffer.from(String(conteudo), "utf8");
  return createHash("sha256")
    .update(bytes.filter((b) => b !== 0x0d))
    .digest("hex");
}

/*
  O caminho registado, como o disco o escreve ("migrations/x.sql"). Parte do
  registro foi gravada com o prefixo "supabase/" (125 linhas em 13/10/2026), o
  que fazia a mesma migration aparecer como órfã e como pendente.
*/
export function caminhoRegistado(caminho) {
  return String(caminho ?? "").replace(/^\.?\/?supabase\//, "");
}

export function ficheirosNoDisco(raiz = "supabase") {
  const lista = [];
  for (const diretorio of DIRETORIOS) {
    let entradas;
    try {
      entradas = readdirSync(join(raiz, diretorio));
    } catch (erro) {
      // Diretório ausente é estado esperado, não erro: nem todo projeto tem os dois.
      if (erro.code === "ENOENT") continue;
      throw erro;
    }
    for (const nome of entradas.filter((n) =>
      n.toLowerCase().endsWith(".sql"),
    )) {
      lista.push({
        caminho: `${diretorio}/${nome}`,
        diretorio,
        hash: hashDoConteudo(readFileSync(join(raiz, diretorio, nome))),
      });
    }
  }
  return lista.sort((a, b) => a.caminho.localeCompare(b.caminho));
}

/*
  Quatro estados, e cada um pede uma ação diferente de quem lê:

    aplicado      nada a fazer
    pendente      correr o SQL, e depois registar
    divergente    o ficheiro mudou DEPOIS de aplicado. O Git fica coerente, o
                  banco não, e ninguém descobre até um ambiente novo nascer
                  diferente. É o único que o hash encontra.
    órfão         registado no banco e sem ficheiro no disco: alguém apagou ou
                  renomeou. Não é erro por si — o SIGAV apagou 181 migrations
                  ao criar um baseline —, mas tem de ser visível.
*/
export function classificar(noDisco = [], registados = []) {
  const lista = (Array.isArray(registados) ? registados : []).map((r) => ({
    ...r,
    caminho: caminhoRegistado(r.caminho),
  }));
  const porCaminho = new Map(lista.map((r) => [r.caminho, r]));
  const noDiscoPorCaminho = new Set(
    (Array.isArray(noDisco) ? noDisco : []).map((f) => f.caminho),
  );

  const aplicados = [];
  const pendentes = [];
  const divergentes = [];

  for (const ficheiro of Array.isArray(noDisco) ? noDisco : []) {
    const registo = porCaminho.get(ficheiro.caminho);
    if (!registo) pendentes.push(ficheiro);
    else if (registo.hash !== ficheiro.hash)
      divergentes.push({ ...ficheiro, registo });
    else aplicados.push({ ...ficheiro, registo });
  }

  const orfaos = lista.filter((r) => !noDiscoPorCaminho.has(r.caminho));

  return { aplicados, pendentes, divergentes, orfaos };
}

/*
  Timestamps repetidos em supabase/migrations/. Dois arquivos com o mesmo
  prefixo não têm ordem definida (o nome decide), e duas PRs paralelas que
  escolhem o mesmo horário só descobrem no merge — #424/#430 caíram em
  20261013120000 e 20261013140000, já usados. Devolve {timestamp: [nomes]}.
*/
export function timestampsRepetidos(nomes = []) {
  const porTimestamp = {};
  for (const nome of Array.isArray(nomes) ? nomes : []) {
    const m = /^(\d{8,14})_/.exec(String(nome).split("/").pop());
    if (!m) continue;
    (porTimestamp[m[1]] ||= []).push(String(nome).split("/").pop());
  }
  return Object.fromEntries(
    Object.entries(porTimestamp)
      .filter(([, lista]) => lista.length > 1)
      .map(([ts, lista]) => [ts, lista.sort()]),
  );
}

/*
  Um literal de texto para SQL. O caminho vem do disco, e nome de ficheiro com
  apóstrofo é raro mas legal em quase todo sistema de ficheiros — e é a forma
  que uma injeção teria aqui.
*/
export function escaparLiteral(valor) {
  return `'${String(valor).replace(/'/g, "''")}'`;
}
