/*
  ENSAIO da migration 20261014190000_motivo_da_reserva_fora_da_equipe.sql — begin … rollback.

  NÃO É MIGRATION. Rode depois da migration, na mesma transação (ensaio.sh:
  sem as linhas begin/commit), e desfaça. Usa a conta do setor
  (a01afddb-…, coordenação no 114/2026, fora da equipe de analistas) e uma
  ficha livre da vaga 182528 (o 114/2026 distribui por "Pegar próximo").

  Espera:
    1. coordenação fora da equipe abre a ficha livre → só leitura, "Você não
       está na equipe de análise desta vaga." (antes: "Ficha livre: a
       coordenação distribui…");
    2. a mesma ficha com outro responsável → "Ficha de outra pessoa.";
    3. a conta do setor como analista da vaga → reserva (sem motivo).
*/
create temporary table t_saida (n int, motivo text, reservada boolean) on commit drop;
grant all on t_saida to authenticated;
create temporary table t_ficha on commit drop as
select "CO_FICHA_ANALISE" as id from public."TB_FICHA_ANALISE"
 where "CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0' and "CO_VAGA" = '182528'
   and "TP_SITUACAO" = 'PENDENTE' and "CO_USUARIO_RESPONSAVEL" is null
   and ("DT_RESERVA_EXPIRA" is null or "DT_RESERVA_EXPIRA" < now())
 limit 1;
grant select on t_ficha to authenticated;
grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;
select set_config('request.jwt.claims', '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated"}', true);

set local role authenticated;
insert into t_saida select 1, r ->> 'motivo', (r ->> 'reservada')::boolean
  from (select public.reservar_ficha((select id from t_ficha))::jsonb r) z;
reset role;

update public."TB_FICHA_ANALISE" set "CO_USUARIO_RESPONSAVEL" = (select user_id from public."TB_PERFIL_USUARIO" where user_id <> 'a01afddb-f64b-47d9-80e8-476a1ed14e43' limit 1),
       "DT_ATRIBUICAO" = now()
 where "CO_FICHA_ANALISE" = (select id from t_ficha);
set local role authenticated;
insert into t_saida select 2, r ->> 'motivo', (r ->> 'reservada')::boolean
  from (select public.reservar_ficha((select id from t_ficha))::jsonb r) z;
reset role;

update public."TB_FICHA_ANALISE" set "CO_USUARIO_RESPONSAVEL" = null, "DT_ATRIBUICAO" = null
 where "CO_FICHA_ANALISE" = (select id from t_ficha);
insert into public."RL_ANALISTA_EDITAL" ("CO_MONITORAMENTO", "CO_USUARIO", "TP_PAPEL", "CO_VAGA", "CO_USUARIO_ATUALIZACAO")
values ('bcecfb08-88ef-4e06-8401-bcad6bf88fd0', 'a01afddb-f64b-47d9-80e8-476a1ed14e43', 'ANALISTA', '182528', 'a01afddb-f64b-47d9-80e8-476a1ed14e43');
set local role authenticated;
insert into t_saida select 3, r ->> 'motivo', (r ->> 'reservada')::boolean
  from (select public.reservar_ficha((select id from t_ficha))::jsonb r) z;
reset role;

select * from t_saida order by n;
