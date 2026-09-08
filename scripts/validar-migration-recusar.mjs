import pg from "pg";

/*
  Validação da migration `recusar_solicitacao_acesso` contra o banco real.

  Duas fases, na ordem em que devem ser corridas:

    node scripts/validar-migration-recusar.mjs --antes
      Pré-requisitos estruturais, antes de aplicar. Confere `private.is_master()`,
      as colunas de `solicitacoes_acesso`, o gatilho de `updated_at` e que a
      função ainda **não** existe. Falha se algo faltar — aplicar migration sobre
      pressuposto errado é como o repositório acumula objetos que ninguém sabe
      reconstruir.

    node scripts/validar-migration-recusar.mjs --depois
      Depois de aplicar. Confere assinatura, que o `EXECUTE` foi concedido **só**
      a `authenticated`, e o comportamento: quem não é master é recusado, e
      solicitação já avaliada não é decidida duas vezes.

  SEGURANÇA
  As verificações de comportamento precisam chamar a função, e chamar significa
  escrever. Por isso cada uma corre dentro de uma transação que **sempre** termina
  em `rollback` — inclusive quando passa. Nenhuma linha muda de estado.

  Ainda assim: correr contra um Supabase de **desenvolvimento**. `SUPABASE_DB_URL`
  é segredo de CI/servidor; nunca uma variável `VITE_*`, que iria para o bundle.
*/

const modo = process.argv.includes("--depois")
  ? "depois"
  : process.argv.includes("--antes")
    ? "antes"
    : null;

if (!modo) {
  console.error("Uso: validar-migration-recusar.mjs --antes | --depois");
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
  application_name: "validar-migration-recusar",
});
await cliente.connect();

const resultados = [];
const registrar = (ok, descricao, detalhe = "") =>
  resultados.push({ ok, descricao, detalhe });

const umaLinha = async (sql, valores = []) =>
  (await cliente.query(sql, valores)).rows[0];

try {
  if (modo === "antes") {
    const guarda = await umaLinha(
      `select count(*)::int as total from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'private' and p.proname = 'is_master'`,
    );
    registrar(guarda.total > 0, "private.is_master() existe");

    const colunas = await umaLinha(
      `select array_agg(column_name::text order by column_name) as nomes
       from information_schema.columns
       where table_schema = 'public' and table_name = 'solicitacoes_acesso'`,
    );
    const necessarias = [
      "avaliado_em",
      "avaliado_por",
      "email",
      "id",
      "observacao_admin",
      "status",
    ];
    const presentes = colunas.nomes || [];
    const faltando = necessarias.filter((c) => !presentes.includes(c));
    registrar(
      faltando.length === 0,
      "solicitacoes_acesso tem as colunas necessárias",
      faltando.length ? `faltam: ${faltando.join(", ")}` : "",
    );

    const gatilho = await umaLinha(
      `select count(*)::int as total from pg_trigger
       where tgname = 'trg_solicitacoes_acesso_updated_at' and not tgisinternal`,
    );
    registrar(
      gatilho.total > 0,
      "gatilho trg_solicitacoes_acesso_updated_at existe",
      "é ele que mantém updated_at; por isso a RPC não escreve a coluna",
    );

    const jaExiste = await umaLinha(
      `select count(*)::int as total from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'recusar_solicitacao_acesso'`,
    );
    registrar(
      jaExiste.total === 0,
      "recusar_solicitacao_acesso ainda não existe",
      jaExiste.total ? "já existe: rever antes de reaplicar" : "",
    );
  }

  if (modo === "depois") {
    const fn = await umaLinha(
      `select pg_get_function_arguments(p.oid) as argumentos,
              pg_get_function_result(p.oid)    as retorno,
              p.prosecdef                      as security_definer,
              coalesce(array_to_string(p.proconfig, ', '), '') as configuracao,
              p.oid
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'recusar_solicitacao_acesso'`,
    );

    if (!fn) {
      registrar(
        false,
        "recusar_solicitacao_acesso existe",
        "aplique a migration primeiro",
      );
    } else {
      registrar(
        /p_solicitacao_id\s+uuid/.test(fn.argumentos) &&
          /p_observacao_admin\s+text/.test(fn.argumentos),
        "assinatura confere",
        fn.argumentos,
      );
      registrar(fn.retorno === "jsonb", "retorna jsonb", fn.retorno);
      registrar(
        fn.configuracao.includes("search_path"),
        "search_path fixado",
        fn.configuracao,
      );

      const grants = await umaLinha(
        `select coalesce(string_agg(r.rolname, ', ' order by r.rolname), '') as roles
         from pg_roles r
         where r.rolname in ('anon', 'authenticated', 'service_role', 'public')
           and has_function_privilege(r.rolname, $1::oid, 'EXECUTE')`,
        [fn.oid],
      );
      const comExecute = grants.roles
        .split(", ")
        .filter(Boolean)
        .filter((r) => r !== "service_role");
      registrar(
        comExecute.length === 1 && comExecute[0] === "authenticated",
        "EXECUTE apenas para authenticated",
        `roles com EXECUTE: ${grants.roles || "nenhuma"}`,
      );

      // ── Comportamento. Tudo dentro de transação revertida. ──────────────
      const alvo = await umaLinha(
        `select id, status from public.solicitacoes_acesso order by created_at desc limit 1`,
      );

      if (!alvo) {
        registrar(
          true,
          "sem solicitação para exercitar comportamento",
          "nada a testar",
        );
      } else {
        const naoMaster = await umaLinha(
          `select user_id from public.perfis_usuarios
           where ativo is true and user_id is not null
             and lower(coalesce(perfil, '')) <> 'master'
           limit 1`,
        );

        if (naoMaster) {
          await cliente.query("begin");
          try {
            await cliente.query("set local role authenticated");
            await cliente.query(
              `select set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role', 'authenticated')::text, true)`,
              [naoMaster.user_id],
            );
            await cliente.query(
              `select public.recusar_solicitacao_acesso($1, 'teste')`,
              [alvo.id],
            );
            registrar(
              false,
              "usuário não-master é recusado",
              "a chamada foi aceite",
            );
          } catch (erro) {
            registrar(
              /master/i.test(erro.message),
              "usuário não-master é recusado",
              erro.message,
            );
          } finally {
            await cliente.query("rollback");
          }
        } else {
          registrar(
            true,
            "sem usuário não-master disponível",
            "verificação ignorada",
          );
        }

        /*
          Esta verificação precisa correr **como master**. Sem identidade, a
          chamada esbarraria antes na guarda de autenticação, e o teste passaria
          pelo motivo errado — dando por exercitada uma regra que nunca chegou a
          ser alcançada. Foi assim que ela nasceu, e foi assim que falhou na
          primeira execução real.
        */
        const master = await umaLinha(
          `select user_id from public.perfis_usuarios
           where ativo is true and user_id is not null
             and lower(coalesce(perfil, '')) = 'master'
           limit 1`,
        );

        const comoMaster = async () => {
          await cliente.query("set local role authenticated");
          await cliente.query(
            `select set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role', 'authenticated')::text, true)`,
            [master.user_id],
          );
        };

        const avaliada = await umaLinha(
          `select id from public.solicitacoes_acesso
           where lower(coalesce(status, '')) <> 'pendente' limit 1`,
        );
        if (avaliada && master) {
          await cliente.query("begin");
          try {
            await comoMaster();
            await cliente.query(
              `select public.recusar_solicitacao_acesso($1, 'teste')`,
              [avaliada.id],
            );
            registrar(
              false,
              "solicitação já avaliada é rejeitada",
              "a chamada foi aceite",
            );
          } catch (erro) {
            registrar(
              /avaliada/i.test(erro.message),
              "solicitação já avaliada é rejeitada",
              erro.message,
            );
          } finally {
            await cliente.query("rollback");
          }
        } else {
          registrar(
            true,
            "sem solicitação já avaliada ou sem master",
            "ignorada",
          );
        }

        /*
          O caminho feliz, também em transação revertida: a recusa acontece, é
          conferida linha a linha, e desfaz-se.
        */
        const pendente = await umaLinha(
          `select id from public.solicitacoes_acesso
           where lower(coalesce(status, '')) = 'pendente' limit 1`,
        );
        if (pendente && master) {
          await cliente.query("begin");
          try {
            await comoMaster();
            const retorno = await umaLinha(
              `select public.recusar_solicitacao_acesso($1, 'validação automatizada') as r`,
              [pendente.id],
            );
            const linha = await umaLinha(
              `select status, avaliado_por, avaliado_em, observacao_admin, updated_at
               from public.solicitacoes_acesso where id = $1`,
              [pendente.id],
            );
            registrar(
              retorno.r?.ok === true && linha.status === "recusado",
              "master recusa solicitação pendente",
              JSON.stringify(retorno.r),
            );
            registrar(
              linha.avaliado_por === master.user_id && !!linha.avaliado_em,
              "grava quem avaliou e quando",
              `avaliado_por=${linha.avaliado_por}`,
            );
            registrar(
              !!linha.updated_at,
              "updated_at preenchido pelo gatilho, sem a RPC o escrever",
              String(linha.updated_at),
            );
          } catch (erro) {
            registrar(
              false,
              "master recusa solicitação pendente",
              erro.message,
            );
          } finally {
            await cliente.query("rollback");
          }
        } else {
          registrar(true, "sem solicitação pendente ou sem master", "ignorada");
        }
      }
    }
  }
} finally {
  await cliente.end();
}

console.log(`Validação da migration — fase "${modo}":`);
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
console.log(
  "Tudo conferido. Nenhuma linha foi alterada: as chamadas correram em transação revertida.",
);
