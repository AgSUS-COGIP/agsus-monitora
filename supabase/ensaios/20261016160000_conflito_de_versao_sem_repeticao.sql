/*
  Ensaio de 20261016160000 (begin/rollback; não grava nada): chama
  private."FC_EXIGIR_GRAVAR_FICHA" (a checagem de versão de
  salvar_rascunho_ficha, concluir_ficha...) com uma ficha em análise e
  reservada, como a pessoa da reserva, e versão errada.
  Antes: 40001. Depois: PT409. Confere também que as 30 funções seguem com o
  mesmo dono, grants, comentário, SET e SECURITY DEFINER, e que o corpo só
  mudou no errcode.
*/
begin;
create temp table ensaio_antes on commit drop as
  select p.oid, p.prosrc, p.proacl::text acl, obj_description(p.oid, 'pg_proc') comentario,
         p.proowner, p.proconfig::text config, p.prosecdef
    from pg_proc p where p.prosrc ~ 'errcode = ''40001''';
create temp table ensaio_resultado (momento text, resultado text) on commit drop;
create function pg_temp.sqlstate_de(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return 'sem erro';
exception when others then
  return sqlstate || ': ' || sqlerrm;
end $$;
create temp table ensaio_ficha on commit drop as
  select f."CO_FICHA_ANALISE" ficha, f."CO_USUARIO_RESERVA" usuario
    from public."TB_FICHA_ANALISE" f
   where f."TP_SITUACAO" = 'EM_ANALISE' and f."DT_RESERVA_EXPIRA" > now()
   limit 1;
select set_config('request.jwt.claims',
  json_build_object('sub', (select usuario from ensaio_ficha), 'role', 'authenticated')::text, true);
insert into ensaio_resultado select 'antes', pg_temp.sqlstate_de(format(
  'select private."FC_EXIGIR_GRAVAR_FICHA"(f, f."NU_VERSAO" + 1) from public."TB_FICHA_ANALISE" f where f."CO_FICHA_ANALISE" = %L',
  (select ficha from ensaio_ficha)));

\ir ../migrations/20261016160000_conflito_de_versao_sem_repeticao.sql

insert into ensaio_resultado select 'depois', pg_temp.sqlstate_de(format(
  'select private."FC_EXIGIR_GRAVAR_FICHA"(f, f."NU_VERSAO" + 1) from public."TB_FICHA_ANALISE" f where f."CO_FICHA_ANALISE" = %L',
  (select ficha from ensaio_ficha)));
insert into ensaio_resultado
select 'funções', format('%s funções; corpo só muda no errcode: %s; dono/grants/comentário/SET/definer iguais: %s; ainda com 40001: %s',
       count(*),
       count(*) filter (where replace(p.prosrc, 'errcode = ''PT409''', 'errcode = ''40001''') = replace(a.prosrc, E'\r', '')),
       count(*) filter (where p.proacl::text is not distinct from a.acl
                          and obj_description(p.oid, 'pg_proc') is not distinct from a.comentario
                          and p.proowner = a.proowner
                          and p.proconfig::text is not distinct from a.config
                          and p.prosecdef = a.prosecdef),
       (select count(*) from pg_proc where prosrc ~ 'errcode = ''40001'''))
  from ensaio_antes a join pg_proc p on p.oid = a.oid;
select momento, resultado from ensaio_resultado;
rollback;
