import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/*
  A PARTE QUE SE PODE TESTAR SEM BANCO E SEM DISCO

  `estado-das-migrations.mjs` fala com o `psql` e lê argumentos de linha de
  comando ao ser importado — um ficheiro assim não se testa. O que decide o
  resultado, porém, é uma comparação entre duas listas, e essa cabe aqui.

  É o mesmo arranjo de `scripts/endereco-do-tunel.mjs`, e pelo mesmo motivo.
*/
export const DIRETORIOS = ["migrations", "correcoes"];

export function hashDoConteudo(conteudo) {
  return createHash("sha256").update(conteudo).digest("hex");
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
  const porCaminho = new Map(
    (Array.isArray(registados) ? registados : []).map((r) => [r.caminho, r]),
  );
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

  const orfaos = (Array.isArray(registados) ? registados : []).filter(
    (r) => !noDiscoPorCaminho.has(r.caminho),
  );

  return { aplicados, pendentes, divergentes, orfaos };
}

/*
  Um literal de texto para SQL. O caminho vem do disco, e nome de ficheiro com
  apóstrofo é raro mas legal em quase todo sistema de ficheiros — e é a forma
  que uma injeção teria aqui.
*/
export function escaparLiteral(valor) {
  return `'${String(valor).replace(/'/g, "''")}'`;
}
