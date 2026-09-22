import {
  classificar,
  escaparLiteral,
  ficheirosNoDisco,
} from "./estado-das-migrations-nucleo.mjs";

/*
  O QUE JÁ CORREU NO BANCO, E O QUE FALTA

  Este repositório tem migrations em `supabase/migrations/` e correções de dados
  em `supabase/correcoes/`, e até agora nada dizia quais tinham corrido. A
  resposta vivia na memória de quem aplicou.

  O custo disso foi medido: na revisão de setembro de 2026 a pergunta "preciso
  rodar algum SQL?" apareceu cinco vezes, e cada resposta exigiu puxar o payload
  do banco e comparar coordenada a coordenada — treze scripts descartáveis para
  a mesma pergunta. Aqui é uma consulta.

  A ideia é do SIGAV (`scripts/aplicar-migrations.mjs`). O que NÃO foi copiado é
  o modo `--aplicar`: neste projeto quem executa SQL no banco é a equipa, não a
  ferramenta, e o que faltava era saber o estado — não automatizar a escrita.

  USO

    node --env-file=.env.local scripts/estado-das-migrations.mjs
    node --env-file=.env.local scripts/estado-das-migrations.mjs --registrar=migrations/20260922144500_x.sql
    node --env-file=.env.local scripts/estado-das-migrations.mjs --registrar-todas-pendentes

  O segundo modo marca uma pendente como aplicada SEM executar nada: é para o
  que já estava no banco antes desta tabela existir, e para o que a equipa
  acabou de correr à mão. O terceiro faz o mesmo para todas de uma vez, e existe
  para a carga inicial — depois dela, marcar uma a uma é o que se quer, porque
  marcar sem ter aplicado é a única forma de este registro passar a mentir.

  A CREDENCIAL

  `SUPABASE_DB_URL`, a mesma que `check:rpc-contract:db` usa. A tabela tem RLS
  sem policy: nem `anon` nem `authenticated` a alcançam, de propósito. Isto é
  ferramenta de operação, não superfície da aplicação.
*/
const TABELA = "public.migracoes_aplicadas";

/*
  Separador de campos do psql. Um caractere de controlo, e não vírgula ou tab,
  porque caminho e hash são texto livre. Escrito por código em vez de literal:
  um caractere invisível no ficheiro-fonte é o tipo de coisa que uma ferramenta
  de formatação come sem ninguém ver.
*/
const SEPARADOR = String.fromCharCode(1);

const CONEXAO = process.env.SUPABASE_DB_URL || "";

/*
  `pg` é dependência do projeto? Não. Por isso a consulta vai por `psql`, que é
  o que a máquina de quem opera o banco já tem — e é o mesmo caminho de
  `check-rpc-contract-db.mjs`.
*/
async function consultar(sql) {
  const { execFileSync } = await import("node:child_process");
  return execFileSync("psql", [CONEXAO, "-At", "-F", SEPARADOR, "-c", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function comoTabela(linhas) {
  return linhas
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [caminho, hash, origem, aplicada] = l.split(SEPARADOR);
      return { caminho, hash, origem, aplicada };
    });
}

async function registrar(alvos) {
  if (!alvos.length) {
    console.log("Nada a registrar.");
    return;
  }
  const valores = alvos
    .map(
      (f) =>
        `(${escaparLiteral(f.caminho)}, ${escaparLiteral(f.hash)}, 'registro-historico')`,
    )
    .join(",\n    ");
  /*
    `on conflict do update` só no hash e na origem: a data de aplicação original
    não se reescreve. Se a linha já existia, o que mudou foi o ficheiro, e é
    isso que se está a reconhecer.
  */
  await consultar(
    `insert into ${TABELA} (caminho, hash, origem) values\n    ${valores}\n` +
      "on conflict (caminho) do update set hash = excluded.hash, origem = excluded.origem;",
  );
  console.log(`Registados ${alvos.length} ficheiro(s) como já aplicados.`);
  for (const f of alvos) console.log(`  ${f.caminho}`);
}

async function principal() {
  const argumentos = process.argv.slice(2);
  const pedidoDeRegisto = argumentos.find((a) => a.startsWith("--registrar="));
  const registarTodas = argumentos.includes("--registrar-todas-pendentes");

  const noDisco = ficheirosNoDisco();
  if (!noDisco.length) {
    console.log(
      "Nenhum ficheiro .sql em supabase/migrations/ nem em supabase/correcoes/.",
    );
    return;
  }

  if (!CONEXAO) {
    console.error(
      "SUPABASE_DB_URL não está no ambiente.\n" +
        "Rode com: node --env-file=.env.local scripts/estado-das-migrations.mjs\n\n" +
        `Sem ela dá para listar o disco, mas não o que o banco já tem:\n  ${noDisco.length} ficheiros em supabase/.`,
    );
    process.exitCode = 1;
    return;
  }

  let registados;
  try {
    registados = comoTabela(
      await consultar(
        `select caminho, hash, origem, to_char(aplicada_em, 'YYYY-MM-DD') ` +
          `from ${TABELA} order by caminho;`,
      ),
    );
  } catch (erro) {
    const texto = String(erro?.stderr || erro?.message || erro);
    if (/does not exist|não existe/i.test(texto)) {
      console.error(
        `A tabela ${TABELA} ainda não existe.\n` +
          "Aplique supabase/migrations/20260922144500_criar_registro_de_migracoes_aplicadas.sql\n" +
          "e depois rode com --registrar-todas-pendentes para a carga inicial.",
      );
      process.exitCode = 1;
      return;
    }
    throw erro;
  }

  const { aplicados, pendentes, divergentes, orfaos } = classificar(
    noDisco,
    registados,
  );

  if (pedidoDeRegisto) {
    const caminho = pedidoDeRegisto.slice("--registrar=".length);
    const alvo = noDisco.find((f) => f.caminho === caminho);
    if (!alvo) {
      console.error(`Não há ficheiro ${caminho} em supabase/.`);
      process.exitCode = 1;
      return;
    }
    await registrar([alvo]);
    return;
  }
  if (registarTodas) {
    await registrar(pendentes);
    return;
  }

  console.log(`ESTADO DE ${noDisco.length} FICHEIROS SQL`);
  console.log("");
  console.log(`  aplicados     ${String(aplicados.length).padStart(4)}`);
  console.log(`  pendentes     ${String(pendentes.length).padStart(4)}`);
  console.log(
    `  divergentes   ${String(divergentes.length).padStart(4)}   ficheiro mudou depois de aplicado`,
  );
  if (orfaos.length) {
    console.log(
      `  órfãos        ${String(orfaos.length).padStart(4)}   registados no banco, sem ficheiro no disco`,
    );
  }

  if (pendentes.length) {
    console.log("");
    console.log("POR APLICAR:");
    for (const f of pendentes) console.log(`  ${f.caminho}`);
  }

  /*
    A divergência é o achado que só o hash encontra, e o mais perigoso: o Git
    fica coerente, o banco não, e ninguém descobre até um ambiente ser criado
    do zero e sair diferente.
  */
  if (divergentes.length) {
    console.log("");
    console.log(
      "MUDARAM DEPOIS DE APLICADOS — o banco não tem o que o ficheiro diz:",
    );
    for (const f of divergentes) {
      console.log(`  ${f.caminho}   aplicado em ${f.registo.aplicada}`);
    }
    console.log("");
    console.log(
      "  Se a mudança foi só de forma (comentário, espaço), reconheça-a com",
    );
    console.log(
      "  --registrar=<caminho>. Se mudou o efeito, é migration nova.",
    );
  }

  if (orfaos.length) {
    console.log("");
    console.log("REGISTADOS SEM FICHEIRO:");
    for (const r of orfaos)
      console.log(`  ${r.caminho}   aplicado em ${r.aplicada}`);
  }

  if (!pendentes.length && !divergentes.length) {
    console.log("");
    console.log("Nada a aplicar.");
  }

  process.exitCode = pendentes.length || divergentes.length ? 1 : 0;
}

await principal();
