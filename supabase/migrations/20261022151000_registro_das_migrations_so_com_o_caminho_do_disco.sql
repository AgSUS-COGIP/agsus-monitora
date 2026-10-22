/*
  REGISTRO DAS MIGRATIONS SÓ COM O CAMINHO DO DISCO

  Por quê: public.migracoes_aplicadas guarda o caminho como
  scripts/estado-das-migrations.mjs o escreve ("migrations/<arquivo>.sql" ou
  "correcoes/<arquivo>.sql"). A auditoria de 13/10/2026 corrigiu 125 linhas
  gravadas à mão com o prefixo "supabase/"; de 13 a 20/10 entraram mais 47
  iguais (origem 'arquivo', registradas à mão depois de aplicar). O script
  aceita os dois, mas o registro deixa de servir de lista única. A correção
  dos dados está em supabase/correcoes/20261022-registro-das-migrations.sql;
  aqui o banco passa a recusar o caminho fora do formato, para não voltar.

  O que faz: CHECK ck_migracoes_aplicadas_caminho
  (caminho ~ '^(migrations|correcoes)/[^/]+\.sql$'). Se ainda houver linha
  fora do formato (correção não aplicada), a regra entra NOT VALID: já vale
  para todo insert/update novo e não reprova as antigas; depois da correção,
  roda-se o VALIDATE (abaixo, ao reaplicar). Idempotente.

  Ensaio: supabase/ensaios/20261022151000_registro_das_migrations_so_com_o_caminho_do_disco.sql
  Rollback: supabase/rollback/20261022151000_registro_das_migrations_so_com_o_caminho_do_disco.sql
*/
begin;

do $$
declare
  v_fora integer;
begin
  select count(*) into v_fora
    from public.migracoes_aplicadas
   where caminho !~ '^(migrations|correcoes)/[^/]+\.sql$';

  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.migracoes_aplicadas'::regclass
                    and conname = 'ck_migracoes_aplicadas_caminho') then
    if v_fora = 0 then
      alter table public.migracoes_aplicadas
        add constraint ck_migracoes_aplicadas_caminho
        check (caminho ~ '^(migrations|correcoes)/[^/]+\.sql$');
    else
      alter table public.migracoes_aplicadas
        add constraint ck_migracoes_aplicadas_caminho
        check (caminho ~ '^(migrations|correcoes)/[^/]+\.sql$') not valid;
    end if;
  elsif v_fora = 0 then
    alter table public.migracoes_aplicadas validate constraint ck_migracoes_aplicadas_caminho;
  end if;
end;
$$;

comment on constraint ck_migracoes_aplicadas_caminho on public.migracoes_aplicadas is
  'O caminho como o disco o escreve: migrations/<arquivo>.sql ou correcoes/<arquivo>.sql (sem o prefixo supabase/). 20261022151000.';

commit;
