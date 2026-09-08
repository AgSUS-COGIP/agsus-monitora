import { join } from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";

/*
  Verificação do contrato de RPC CONTRA O BANCO — job próprio, fora do build.

  POR QUE NÃO PELO PostgREST
  A primeira versão desta verificação lia a especificação OpenAPI publicada em
  `/rest/v1/` usando a chave publicável. Estava errada, e de um jeito que só
  aparece quando há credencial: **o OpenAPI do PostgREST reflete os privilégios
  da role que pergunta.** Com `anon`, 21 das 22 funções que existem no banco real
  ficam invisíveis, porque são de `authenticated`. A verificação acusaria ausência
  de funções que existem — e, ligada ao build, derrubaria tudo.

  Usar a chave publicável como `Authorization: Bearer` não resolve: ela não é um
  token de usuário autenticado, e insistir nisso seria tratar chave pública como
  credencial privilegiada.

  O QUE ESTE JOB FAZ
  Consulta o catálogo do PostgreSQL (`pg_proc`) por conexão direta, com uma
  credencial que só existe no CI ou no servidor. Vê o que existe de fato,
  independentemente de quem pode executar — e ainda informa, por função, quais
  roles têm EXECUTE, que é a outra metade da pergunta.

  CREDENCIAL
  `SUPABASE_DB_URL` — string de conexão do Postgres, **segredo de CI**. Nunca
  `VITE_*`: tudo que leva esse prefixo entra no bundle e vai para o navegador.
  Este ficheiro não é importado por nenhum módulo do frontend; `pg` é
  dependência de desenvolvimento e não entra em build algum.

  ONDE RODAR
  Contra um Supabase de desenvolvimento ou branch primeiro. Só depois contra
  produção, e ainda assim em leitura: a sessão é aberta como somente-leitura.
*/

const CONEXAO = process.env.SUPABASE_DB_URL || "";

if (!CONEXAO) {
  console.error(
    "SUPABASE_DB_URL não definida. Este job precisa de credencial de servidor/CI.",
  );
  console.error(
    "Não use VITE_SUPABASE_* aqui: essas variáveis entram no bundle do navegador.",
  );
  process.exit(2);
}

const { CONTRATO_RPC } = await import(
  pathToFileURL(join(process.cwd(), "src/lib/rpc-contrato.js")).href
);

const cliente = new pg.Client({
  connectionString: CONEXAO,
  application_name: "check-rpc-contract-db",
});

await cliente.connect();

let saida = 0;
try {
  // Sessão somente-leitura: este job jamais deve escrever.
  await cliente.query("set session characteristics as transaction read only");

  const { rows } = await cliente.query(
    `
    select p.proname                          as nome,
           pg_get_function_arguments(p.oid)   as argumentos,
           p.prosecdef                        as security_definer,
           coalesce(array_to_string(p.proconfig, ', '), '') as configuracao,
           coalesce(
             (select string_agg(r.rolname, ', ' order by r.rolname)
              from pg_roles r
              where has_function_privilege(r.rolname, p.oid, 'EXECUTE')
                and r.rolname in ('anon', 'authenticated', 'service_role')),
             ''
           ) as roles_com_execute
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
    `,
  );

  const noBanco = new Map();
  for (const linha of rows) {
    if (!noBanco.has(linha.nome)) noBanco.set(linha.nome, []);
    noBanco.get(linha.nome).push(linha);
  }

  const ausentes = [];
  const divergentes = [];
  const semExecute = [];

  for (const [nome, contrato] of Object.entries(CONTRATO_RPC)) {
    const versoes = noBanco.get(nome);
    if (!versoes) {
      ausentes.push({ nome, critica: contrato.critica });
      continue;
    }

    // Basta uma sobrecarga aceitar todos os parâmetros declarados.
    const atende = versoes.some((v) =>
      contrato.argumentos.every((a) =>
        // String.raw: em template literal, `\b` é backspace, não âncora de palavra.
        new RegExp(String.raw`\b${a}\b`).test(v.argumentos),
      ),
    );
    if (!atende) {
      divergentes.push({
        nome,
        critica: contrato.critica,
        assinaturas: versoes.map((v) => v.argumentos),
      });
    }

    const executavel = versoes.some((v) =>
      /anon|authenticated|service_role/.test(v.roles_com_execute),
    );
    if (!executavel) semExecute.push(nome);
  }

  console.log(
    `Catálogo lido: ${noBanco.size} função(ões) em public; contrato declara ${Object.keys(CONTRATO_RPC).length}.`,
  );

  for (const { nome, critica } of ausentes) {
    console[critica ? "error" : "warn"](
      `${critica ? "AUSENTE" : "aviso"}: ${nome} não existe no banco.`,
    );
  }
  for (const { nome, critica, assinaturas } of divergentes) {
    console[critica ? "error" : "warn"](
      `${critica ? "ASSINATURA" : "aviso"}: ${nome} não aceita os parâmetros declarados. No banco: ${assinaturas.join(" | ")}`,
    );
  }
  /*
    Sem EXECUTE para nenhuma role da aplicação, a função existe mas ninguém a
    chama pelo PostgREST. É aviso, não erro: pode ser função interna chamada por
    outra, ou acesso concedido a uma role específica fora desta lista.
  */
  for (const nome of semExecute) {
    console.warn(
      `aviso: ${nome} existe mas sem EXECUTE para anon/authenticated/service_role.`,
    );
  }

  const criticas = [...ausentes, ...divergentes].filter((p) => p.critica);
  if (criticas.length) {
    console.error(
      `${criticas.length} função(ões) crítica(s) fora do contrato.`,
    );
    saida = 1;
  } else {
    console.log("Contrato de RPC validado contra o catálogo do banco.");
  }
} finally {
  await cliente.end();
}

process.exit(saida);
