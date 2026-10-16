/*
  Ensaio de 20261016140000 (begin/rollback): como coordenador autenticado, tira
  da equipe do 114 uma pessoa sem fichas e força os gatilhos adiados
  (set constraints all immediate). Antes: permission denied for table
  TB_FICHA_ANALISE. Depois: salva.
*/
\ir ../migrations/20261016140000_conferencia_de_fichas_da_equipe_com_permissao.sql
create temp table eq as
  select jsonb_agg(jsonb_build_object('usuario', "CO_USUARIO", 'papel', "TP_PAPEL")) j
    from public."RL_ANALISTA_EDITAL"
   where "CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0' and "ST_ATIVO" = 'S'
     and "CO_USUARIO" <> '9ddcb2e6-9760-4bdd-9c23-a1e197693fd3';
grant select on eq to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"df5b852c-f981-4486-94b9-67857fff8f93","role":"authenticated"}', true);
select public.salvar_equipe_edital('bcecfb08-88ef-4e06-8401-bcad6bf88fd0'::uuid, (select j from eq), 'ensaio: tirar uma pessoa da equipe') is not null as salvou;
set constraints all immediate;
