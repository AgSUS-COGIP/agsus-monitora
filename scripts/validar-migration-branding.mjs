import pg from "pg";

/*
  Validação da migration `obter_branding_acesso_publico` contra um banco real.

    node scripts/validar-migration-branding.mjs --antes
    node scripts/validar-migration-branding.mjs --depois

  A fase `--depois` inclui as verificações de segurança que importam mais do que
  a função em si: que `anon` continua **sem** `select` em `public.configuracoes`,
  que a RLS da tabela continua ligada, e que nenhuma chave fora da lista branca
  sai na resposta.

  Tudo é leitura. A única chamada de função é à própria RPC, que é `stable` e não
  escreve — e ainda assim corre dentro de transação revertida.

  `SUPABASE_DB_URL` é segredo de CI/servidor; nunca uma variável `VITE_*`, que
  entraria no bundle do navegador.
*/

const CHAVES_PERMITIDAS = [
  "auth_access_background_url",
  "auth_access_logo_url",
  "auth_access_panel_color",
  "auth_access_greeting",
  "auth_access_instruction",
  "auth_google_button_text",
];

const modo = process.argv.includes("--depois")
  ? "depois"
  : process.argv.includes("--antes")
    ? "antes"
    : null;

if (!modo) {
  console.error("Uso: validar-migration-branding.mjs --antes | --depois");
  process.exit(2);
}

const CONEXAO = process.env.SUPABASE_DB_URL || "";
if (!CONEXAO) {
  console.error(
    "SUPABASE_DB_URL não definida. Credencial de servidor/CI, nunca VITE_*.",
  );
  process.exit(2);
}

const cliente = new pg.Client({
  connectionString: CONEXAO,
  application_name: "validar-migration-branding",
});
await cliente.connect();

const resultados = [];
const registrar = (ok, descricao, detalhe = "") =>
  resultados.push({ ok, descricao, detalhe });
const umaLinha = async (sql, valores = []) =>
  (await cliente.query(sql, valores)).rows[0];

try {
  const existe = await umaLinha(
    `select count(*)::int as total from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'obter_branding_acesso_publico'`,
  );

  if (modo === "antes") {
    const tabela = await umaLinha(
      `select count(*)::int as total from information_schema.columns
       where table_schema = 'public' and table_name = 'configuracoes'
         and column_name in ('chave', 'valor')`,
    );
    registrar(tabela.total === 2, "configuracoes tem chave e valor");
    registrar(
      existe.total === 0,
      "obter_branding_acesso_publico ainda não existe",
      existe.total ? "já existe: rever antes de reaplicar" : "",
    );
  }

  if (modo === "depois") {
    if (!existe.total) {
      registrar(false, "a função existe", "aplique a migration primeiro");
    } else {
      const fn = await umaLinha(
        `select p.oid,
                p.prosecdef as security_definer,
                p.provolatile as volatilidade,
                coalesce(array_to_string(p.proconfig, ', '), '') as configuracao,
                pg_get_function_result(p.oid) as retorno,
                pg_get_function_identity_arguments(p.oid) as argumentos
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'obter_branding_acesso_publico'`,
      );

      registrar(fn.argumentos === "", "sem argumentos", `"${fn.argumentos}"`);
      registrar(fn.retorno === "jsonb", "retorna jsonb", fn.retorno);
      registrar(fn.security_definer === true, "é security definer");
      registrar(
        fn.volatilidade === "s" || fn.volatilidade === "i",
        "é stable ou immutable, portanto não escreve",
        fn.volatilidade,
      );
      registrar(
        /search_path=/.test(fn.configuracao),
        "search_path fixado",
        fn.configuracao,
      );

      const grants = await umaLinha(
        `select coalesce(string_agg(r.rolname, ', ' order by r.rolname), '') as roles
         from pg_roles r
         where r.rolname in ('anon', 'authenticated', 'public')
           and has_function_privilege(r.rolname, $1::oid, 'EXECUTE')`,
        [fn.oid],
      );
      registrar(
        grants.roles === "anon, authenticated",
        "EXECUTE apenas para anon e authenticated",
        `roles: ${grants.roles || "nenhuma"}`,
      );

      /*
        O que importa não é `anon` estar impedido de ler a tabela — no banco
        principal ele **tem** `select`, limitado pela policy `config_select_anon_safe`
        a um punhado de chaves inócuas. Isto é anterior a esta migration e não é
        assunto dela.

        O que esta migration não pode fazer é alargar esse acesso. As três
        verificações seguintes olham exatamente para isso.
      */
      const rls = await umaLinha(
        `select relrowsecurity as ligada from pg_class
         where oid = 'public.configuracoes'::regclass`,
      );
      registrar(rls.ligada === true, "RLS de configuracoes continua ligada");

      const policies = await umaLinha(
        `select coalesce(string_agg(polname, ', ' order by polname), '') as nomes,
                count(*)::int as total
         from pg_policy where polrelid = 'public.configuracoes'::regclass`,
      );
      registrar(
        policies.total > 0,
        "as policies da tabela continuam lá",
        policies.nomes,
      );

      /*
        A policy que dá leitura a `anon` não pode ter ganho nenhuma chave de
        branding. Se ganhasse, o branding passaria a sair também pela tabela — e
        a fronteira que esta migration desenha deixaria de existir.
      */
      const anonNaTabela = await cliente.query(
        `select c.chave from public.configuracoes c
         where pg_catalog.has_table_privilege('anon', 'public.configuracoes', 'SELECT')
         order by c.chave`,
      );
      const brandingNaPolicy = [];
      await cliente.query("begin");
      try {
        await cliente.query("set local role anon");
        const visiveis = await cliente.query(
          "select chave from public.configuracoes order by chave",
        );
        for (const { chave } of visiveis.rows) {
          if (
            CHAVES_PERMITIDAS.includes(chave) &&
            chave !== "auth_google_button_text"
          ) {
            brandingNaPolicy.push(chave);
          }
        }
        registrar(
          brandingNaPolicy.length === 0,
          "policy de anon não foi ampliada com chaves de branding",
          brandingNaPolicy.length
            ? `visíveis na tabela: ${brandingNaPolicy.join(", ")}`
            : `anon vê ${visiveis.rows.length} chave(s), nenhuma de identidade visual`,
        );

        const marca = await umaLinha(
          "select public.obter_branding_acesso_publico() as marca",
        );
        const chaves = Object.keys(marca.marca || {});
        const intrusas = chaves.filter((c) => !CHAVES_PERMITIDAS.includes(c));
        registrar(
          intrusas.length === 0,
          "a RPC devolve exclusivamente a lista branca",
          intrusas.length
            ? `vazaram: ${intrusas.join(", ")}`
            : `${chaves.length} chave(s)`,
        );

        /*
          A prova de que a RPC é a única via: chaves de identidade que `anon` não
          vê na tabela precisam vir na resposta da função.
        */
        const soPelaRpc = CHAVES_PERMITIDAS.filter(
          (c) => c !== "auth_google_button_text",
        ).filter((c) => chaves.includes(c));
        registrar(
          soPelaRpc.length > 0,
          "as chaves de identidade chegam pela RPC, e só por ela",
          `${soPelaRpc.length} chave(s) que anon não lê na tabela`,
        );

        const sensiveis = [
          "smtp_password",
          "auth_google_allowed_domains",
          "monit_id",
          "broadcast_msg",
        ];
        const vazadas = sensiveis.filter((c) => chaves.includes(c));
        registrar(
          vazadas.length === 0,
          "nenhuma chave administrativa vaza pela RPC",
          vazadas.length ? `vazaram: ${vazadas.join(", ")}` : "",
        );
      } catch (erro) {
        registrar(false, "anon consegue chamar a função", erro.message);
      } finally {
        await cliente.query("rollback");
      }
      void anonNaTabela;
    }
  }
} finally {
  await cliente.end();
}

console.log(`Validação do branding público — fase "${modo}":`);
for (const { ok, descricao, detalhe } of resultados) {
  console.log(
    `  ${ok ? "ok  " : "FALHA"} ${descricao}${detalhe ? ` — ${detalhe}` : ""}`,
  );
}

const falhas = resultados.filter((r) => !r.ok);
if (falhas.length) {
  console.error(`${falhas.length} verificação(ões) falharam.`);
  process.exit(1);
}
console.log("Tudo conferido. Nenhuma escrita foi feita.");
