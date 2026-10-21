/*
  ENCERRAMENTO DO EDITAL: TELA, SELO E QUEM FECHOU

  Quando todas as fichas do lote de um edital com a avaliação documental no
  MONITORA estão concluídas, cada pessoa que concluiu ao menos uma vê, uma vez,
  a tela de encerramento (totais do edital e a própria contribuição) e ganha o
  selo do edital no perfil. Quem concluiu a última ficha (a que zerou o lote)
  "fechou o edital". Nada aparece antes de o lote chegar a 100%.

  O QUE ENTRA
    public."RL_ENCERRAMENTO_EDITAL_USUARIO"
                        quem já viu a tela de encerramento de cada edital (uma
                        linha por pessoa e edital). Só a RPC abaixo escreve.
    private."FC_EDITAIS_ENCERRADOS"()
                        os editais encerrados: origem MONITORA, fora do
                        treinamento, com ficha no lote e todas as do lote
                        CONCLUIDA (FORA_LOTE não entra na conta). Concluído em =
                        a maior DT_CONCLUSAO; quem fechou = o CO_USUARIO_CONCLUSAO
                        dessa ficha. Derivado das fichas: reaberta uma ficha, o
                        edital deixa de estar encerrado até fechar de novo.
    public.obter_encerramentos_do_edital()
                        para quem chama, os editais encerrados em que concluiu
                        ao menos uma ficha: totais (inscritos, fichas
                        concluídas, dias com conclusão), se já viu a tela e a
                        própria contribuição (fichas, % do total, melhor dia,
                        se fechou). Nada de outras pessoas. Serve à tela e aos
                        selos do perfil.
    public.marcar_encerramento_visto(p_edital)
                        grava que a pessoa viu a tela daquele edital (só edital
                        encerrado em que ela concluiu ficha).

  Permissão: sessão e perfil ativo; a leitura só devolve dados de quem chama.
  Front velho não chama nada daqui (as funções novas não mudam nenhuma
  existente): aplicar antes do merge é seguro.

  Rollback: supabase/rollback/20261021180000_encerramento_do_edital.sql
  Ensaio:   supabase/ensaios/20261021180000_encerramento_do_edital.sql
*/
begin;

set local lock_timeout = '10s';

-- 1. Quem já viu a tela de encerramento ------------------------------------------------------
create table if not exists public."RL_ENCERRAMENTO_EDITAL_USUARIO" (
  "CO_MONITORAMENTO" uuid not null,
  "CO_USUARIO" uuid not null,
  "DT_VISTO" timestamptz not null default now(),
  constraint "PK_RL_ENCERRAMENTO_EDITAL_USUARIO" primary key ("CO_MONITORAMENTO", "CO_USUARIO"),
  constraint "FK_MONITORAMENTO_ENCERREDITUSU" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id) on delete cascade
);
comment on table public."RL_ENCERRAMENTO_EDITAL_USUARIO" is
  'Quem já viu a tela de encerramento de cada edital (20261021180000): uma linha por pessoa e edital, gravada por marcar_encerramento_visto. Sem linha, a tela aparece na próxima entrada.';
comment on column public."RL_ENCERRAMENTO_EDITAL_USUARIO"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id).';
comment on column public."RL_ENCERRAMENTO_EDITAL_USUARIO"."CO_USUARIO" is 'Quem viu (auth.users.id).';
comment on column public."RL_ENCERRAMENTO_EDITAL_USUARIO"."DT_VISTO" is 'Quando viu a tela pela primeira vez.';
comment on constraint "PK_RL_ENCERRAMENTO_EDITAL_USUARIO" on public."RL_ENCERRAMENTO_EDITAL_USUARIO" is 'Uma vez por pessoa e edital.';
comment on constraint "FK_MONITORAMENTO_ENCERREDITUSU" on public."RL_ENCERRAMENTO_EDITAL_USUARIO" is 'Edital da tela vista.';
alter table public."RL_ENCERRAMENTO_EDITAL_USUARIO" enable row level security;
revoke all on public."RL_ENCERRAMENTO_EDITAL_USUARIO" from public, anon, authenticated;

-- 2. Os editais encerrados -------------------------------------------------------------------
create or replace function private."FC_EDITAIS_ENCERRADOS"()
returns table (
  "CO_MONITORAMENTO" uuid,
  "NO_EDITAL" text,
  "NU_EDITAL" text,
  "CO_AREA" text,
  "QT_FICHAS" integer,
  "DT_CONCLUSAO" timestamptz,
  "CO_USUARIO_FECHOU" uuid
)
language sql
stable
security definer
set search_path to ''
as $function$
  select m.id,
         m.edital,
         coalesce(private."FC_NUMERO_EDITAL"(m.edital), btrim(m.edital)),
         m."CO_AREA",
         s.concluidas::integer,
         u.dt_conclusao,
         u.usuario
    from public."TB_ORIGEM_ANALISE_EDITAL" o
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id = o."CO_MONITORAMENTO"
    cross join lateral (
      select count(*) filter (where f."TP_SITUACAO" <> 'FORA_LOTE') as no_lote,
             count(*) filter (where f."TP_SITUACAO" = 'CONCLUIDA') as concluidas
        from public."TB_FICHA_ANALISE" f
       where f."CO_MONITORAMENTO" = m.id) s
    cross join lateral (
      select f."DT_CONCLUSAO" as dt_conclusao, f."CO_USUARIO_CONCLUSAO" as usuario
        from public."TB_FICHA_ANALISE" f
       where f."CO_MONITORAMENTO" = m.id
         and f."TP_SITUACAO" = 'CONCLUIDA'
       order by f."DT_CONCLUSAO" desc nulls last, f."CO_FICHA_ANALISE"
       limit 1) u
   where o."TP_ORIGEM" = 'MONITORA'
     and coalesce(m."ST_TREINAMENTO", 'N') <> 'S'
     and s.no_lote > 0
     and s.concluidas = s.no_lote;
$function$;
comment on function private."FC_EDITAIS_ENCERRADOS"() is
  'Editais com a avaliação documental no MONITORA (fora do treinamento) cujo lote está todo concluído: toda ficha que não é FORA_LOTE está CONCLUIDA. Devolve o número do edital (NN/AAAA), as fichas concluídas, a última conclusão e quem a fez (quem fechou o edital). Derivado das fichas, sem tabela a alimentar (20261021180000).';
revoke all on function private."FC_EDITAIS_ENCERRADOS"() from public, anon, authenticated, service_role;

-- 3. A leitura de quem chama -----------------------------------------------------------------
create or replace function public.obter_encerramentos_do_edital()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
set statement_timeout to '5s'
as $function$
declare
  v_usuario uuid := auth.uid();
begin
  if v_usuario is null then
    raise exception using errcode = '42501', message = 'Sessão necessária.';
  end if;
  if not exists (select 1 from public."TB_PERFIL_USUARIO" p
                  where p.user_id = v_usuario and p.ativo is true) then
    raise exception using errcode = '42501', message = 'Sem permissão para este recurso';
  end if;

  return jsonb_build_object(
    'gerado_em', now(),
    'editais', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e."CO_MONITORAMENTO",
               'edital', e."NO_EDITAL",
               'numero', e."NU_EDITAL",
               'area', e."CO_AREA",
               'concluido_em', e."DT_CONCLUSAO",
               'inscritos', (select count(*) from public."TB_PRE_CLASSIFICACAO" p
                              where p."CO_MONITORAMENTO" = e."CO_MONITORAMENTO"),
               'fichas', e."QT_FICHAS",
               'dias', t.dias,
               'visto', exists (select 1 from public."RL_ENCERRAMENTO_EDITAL_USUARIO" v
                                 where v."CO_MONITORAMENTO" = e."CO_MONITORAMENTO"
                                   and v."CO_USUARIO" = v_usuario),
               'minha', jsonb_build_object(
                 'fichas', t.minhas,
                 'percentual', round(100.0 * t.minhas / nullif(e."QT_FICHAS", 0), 1),
                 'melhor_dia', (
                   select jsonb_build_object('dia', d.dia, 'qt', d.qt)
                     from (select (f."DT_CONCLUSAO" at time zone 'America/Sao_Paulo')::date as dia,
                                  count(*) as qt
                             from public."TB_FICHA_ANALISE" f
                            where f."CO_MONITORAMENTO" = e."CO_MONITORAMENTO"
                              and f."TP_SITUACAO" = 'CONCLUIDA'
                              and f."CO_USUARIO_CONCLUSAO" = v_usuario
                            group by 1) d
                    order by d.qt desc, d.dia
                    limit 1),
                 'fechou', e."CO_USUARIO_FECHOU" = v_usuario))
             order by e."DT_CONCLUSAO", e."NU_EDITAL")
        from private."FC_EDITAIS_ENCERRADOS"() e
        cross join lateral (
          select count(*) filter (where f."CO_USUARIO_CONCLUSAO" = v_usuario) as minhas,
                 count(distinct (f."DT_CONCLUSAO" at time zone 'America/Sao_Paulo')::date) as dias
            from public."TB_FICHA_ANALISE" f
           where f."CO_MONITORAMENTO" = e."CO_MONITORAMENTO"
             and f."TP_SITUACAO" = 'CONCLUIDA') t
       where t.minhas > 0), '[]'::jsonb));
end;
$function$;
comment on function public.obter_encerramentos_do_edital() is
  'Tela de encerramento e selos do perfil (20261021180000): os editais encerrados (private."FC_EDITAIS_ENCERRADOS") em que quem chama concluiu ao menos uma ficha, com os totais (inscritos da pré-classificação, fichas concluídas, dias com conclusão em Brasília), se já viu a tela e só a contribuição de quem chama (fichas, % do total, melhor dia, se fechou o edital). Sessão e perfil ativo.';
revoke all on function public.obter_encerramentos_do_edital() from public, anon;
grant execute on function public.obter_encerramentos_do_edital() to authenticated;

-- 4. Viu a tela ------------------------------------------------------------------------------
create or replace function public.marcar_encerramento_visto(p_edital uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path to ''
set statement_timeout to '5s'
as $function$
declare
  v_usuario uuid := auth.uid();
begin
  if v_usuario is null then
    raise exception using errcode = '42501', message = 'Sessão necessária.';
  end if;
  if not exists (select 1 from public."TB_PERFIL_USUARIO" p
                  where p.user_id = v_usuario and p.ativo is true) then
    raise exception using errcode = '42501', message = 'Sem permissão para este recurso';
  end if;
  if p_edital is null or not exists (
       select 1
         from private."FC_EDITAIS_ENCERRADOS"() e
        where e."CO_MONITORAMENTO" = p_edital
          and exists (select 1 from public."TB_FICHA_ANALISE" f
                       where f."CO_MONITORAMENTO" = p_edital
                         and f."TP_SITUACAO" = 'CONCLUIDA'
                         and f."CO_USUARIO_CONCLUSAO" = v_usuario)) then
    raise exception using errcode = '22023', message = 'Edital não encerrado ou sem ficha sua.';
  end if;
  insert into public."RL_ENCERRAMENTO_EDITAL_USUARIO" ("CO_MONITORAMENTO", "CO_USUARIO")
  values (p_edital, v_usuario)
  on conflict do nothing;
  return true;
end;
$function$;
comment on function public.marcar_encerramento_visto(uuid) is
  'Grava que quem chama viu a tela de encerramento do edital (RL_ENCERRAMENTO_EDITAL_USUARIO; repetir não muda nada). Só edital encerrado em que a pessoa concluiu ficha (22023). Sessão e perfil ativo (20261021180000).';
revoke all on function public.marcar_encerramento_visto(uuid) from public, anon;
grant execute on function public.marcar_encerramento_visto(uuid) to authenticated;

commit;
