/*
  ENSAIO de 20261022130000_renovar_reserva_sem_subir_versao.sql — begin … rollback.

  Cole no SQL Editor do Supabase (papel postgres). Aplica a migration dentro
  da transação e, com uma ficha EM_ANALISE de verdade (a primeira cujo
  responsável passa nas permissões), confere:
    1. reserva vencida + o responsável renova: a reserva volta a valer, a
       versão NÃO sobe e o histórico ganha um RESERVAR;
    2. reserva em dia + renovar: só estica o prazo (versão igual, sem histórico);
    3. ficha PENDENTE sem reserva: vira EM_ANALISE e a versão sobe 1;
    4. outra pessoa salvou no intervalo (versão já subiu): renovar não desfaz,
       e a versão que a tela guardou continua diferente (o PT409 real fica).
  Mostra só o caso e ok (sem dados pessoais). Termina em rollback.
*/
begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.renovar_reserva(p_ficha uuid)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_f public."TB_FICHA_ANALISE";
  v_uid uuid := (select auth.uid());
  v_area text;
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha;
  if v_f."CO_FICHA_ANALISE" is null then
    raise exception 'Ficha não encontrada' using errcode = '22023';
  end if;
  v_area := private."FC_EXIGIR_AVALIACAO_EDITAL"(v_f."CO_MONITORAMENTO", 2);
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha for update;
  if v_f."CO_USUARIO_RESERVA" = v_uid and v_f."DT_RESERVA_EXPIRA" > now() then
    -- Renovar não muda a versão nem vai ao histórico.
    update public."TB_FICHA_ANALISE" set "DT_RESERVA_EXPIRA" = now() + private."FC_PRAZO_RESERVA_FICHA"()
     where "CO_FICHA_ANALISE" = p_ficha;
  elsif (v_f."DT_RESERVA_EXPIRA" is null or v_f."DT_RESERVA_EXPIRA" <= now())
        and v_f."CO_USUARIO_RESPONSAVEL" = v_uid and v_f."TP_SITUACAO" in ('PENDENTE', 'EM_ANALISE')
        and private."FC_PODE_ANALISAR_VAGA"(v_f."CO_MONITORAMENTO", v_uid, v_f."CO_VAGA") then
    -- Reserva vencida, mesmo responsável: reserva de novo sem subir a versão
    -- (a tela aberta segue salvando). Só PENDENTE → EM_ANALISE sobe.
    update public."TB_FICHA_ANALISE" set
      "DT_ATRIBUICAO" = coalesce("DT_ATRIBUICAO", now()),
      "TP_SITUACAO" = case when "TP_SITUACAO" = 'PENDENTE' then 'EM_ANALISE' else "TP_SITUACAO" end,
      "CO_USUARIO_RESERVA" = v_uid, "DT_RESERVA" = now(),
      "DT_RESERVA_EXPIRA" = now() + private."FC_PRAZO_RESERVA_FICHA"(),
      "NU_VERSAO" = "NU_VERSAO" + case when "TP_SITUACAO" = 'PENDENTE' then 1 else 0 end,
      "DT_ATUALIZACAO" = now()
     where "CO_FICHA_ANALISE" = p_ficha;
    perform private."FC_HISTORICO_FICHA"(p_ficha, 'RESERVAR', v_f."TP_SITUACAO", v_f."CO_USUARIO_RESPONSAVEL", null, v_uid);
  else
    raise exception 'A ficha não está mais com você (reserva liberada ou com outra pessoa); abra de novo.' using errcode = 'PT409';
  end if;
  return json_build_object('ficha', private."FC_FICHA_ANALISE_JSON"(p_ficha));
end;
$function$;

comment on function public.renovar_reserva(uuid) is
  'Renova por mais 15 minutos a reserva de quem está com a ficha aberta (sem mudar a versão). Reserva vencida e ninguém no lugar: o responsável reserva de novo, também sem mudar a versão (só PENDENTE → EM_ANALISE sobe). Com outra pessoa ou liberada pela coordenação: PT409. Exige Editor no edital da ficha.';

create temp table ensaio_renovar (caso text, ok boolean) on commit drop;

do $ensaio$
declare
  v record;
  v_versao integer;
  v_depois integer;
  v_hist integer;
  v_hist_depois integer;
  v_expira timestamptz;
  v_situacao text;
  v_testou boolean := false;
begin
  for v in
    select f."CO_FICHA_ANALISE" as id, f."CO_USUARIO_RESPONSAVEL" as uid
      from public."TB_FICHA_ANALISE" f
     where f."TP_SITUACAO" = 'EM_ANALISE' and f."CO_USUARIO_RESPONSAVEL" is not null
     order by f."DT_ATUALIZACAO" desc
     limit 50
  loop
    begin
      -- 1. vencida, mesmo responsável
      update public."TB_FICHA_ANALISE"
         set "CO_USUARIO_RESERVA" = v.uid, "DT_RESERVA" = now() - interval '20 minutes',
             "DT_RESERVA_EXPIRA" = now() - interval '1 minute'
       where "CO_FICHA_ANALISE" = v.id;
      select "NU_VERSAO" into v_versao from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = v.id;
      select count(*) into v_hist from public."TH_FICHA_ANALISE" where "CO_FICHA_ANALISE" = v.id;
      perform set_config('request.jwt.claims', json_build_object('sub', v.uid, 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
      perform public.renovar_reserva(v.id);
      execute 'reset role';
      select "NU_VERSAO", "DT_RESERVA_EXPIRA" into v_depois, v_expira
        from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = v.id;
      select count(*) into v_hist_depois from public."TH_FICHA_ANALISE" where "CO_FICHA_ANALISE" = v.id;
      insert into ensaio_renovar values
        ('1. vencida: versão igual', v_depois = v_versao),
        ('1. vencida: reserva vale de novo', v_expira > now()),
        ('1. vencida: histórico RESERVAR', v_hist_depois = v_hist + 1 and exists (
           select 1 from public."TH_FICHA_ANALISE" h
            where h."CO_FICHA_ANALISE" = v.id and h."TP_ACAO" = 'RESERVAR' and h."NU_VERSAO" = v_versao));

      -- 2. em dia: só estica
      v_hist := v_hist_depois;
      execute 'set local role authenticated';
      perform public.renovar_reserva(v.id);
      execute 'reset role';
      select "NU_VERSAO" into v_depois from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = v.id;
      select count(*) into v_hist_depois from public."TH_FICHA_ANALISE" where "CO_FICHA_ANALISE" = v.id;
      insert into ensaio_renovar values
        ('2. em dia: versão igual e sem histórico', v_depois = v_versao and v_hist_depois = v_hist);

      -- 3. PENDENTE vencida: vira EM_ANALISE, versão sobe
      update public."TB_FICHA_ANALISE"
         set "TP_SITUACAO" = 'PENDENTE', "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null,
             "DT_RESERVA_EXPIRA" = null
       where "CO_FICHA_ANALISE" = v.id;
      execute 'set local role authenticated';
      perform public.renovar_reserva(v.id);
      execute 'reset role';
      select "NU_VERSAO", "TP_SITUACAO" into v_depois, v_situacao
        from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = v.id;
      insert into ensaio_renovar values
        ('3. pendente: EM_ANALISE e versão +1', v_situacao = 'EM_ANALISE' and v_depois = v_versao + 1);

      -- 4. outra pessoa salvou no intervalo: a versão da tela segue velha
      v_versao := v_depois;
      update public."TB_FICHA_ANALISE"
         set "NU_VERSAO" = "NU_VERSAO" + 1, "DT_RESERVA" = now() - interval '20 minutes',
             "DT_RESERVA_EXPIRA" = now() - interval '1 minute'
       where "CO_FICHA_ANALISE" = v.id;
      execute 'set local role authenticated';
      perform public.renovar_reserva(v.id);
      execute 'reset role';
      select "NU_VERSAO" into v_depois from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = v.id;
      insert into ensaio_renovar values
        ('4. conflito real: versão da tela continua diferente', v_depois = v_versao + 1);

      v_testou := true;
      exit;
    exception when insufficient_privilege or sqlstate 'PT409' or sqlstate 'PT403' then
      -- Responsável sem permissão de hoje no edital: tenta a próxima ficha.
      continue;
    end;
  end loop;
  if not v_testou then
    raise exception 'Nenhuma ficha EM_ANALISE com responsável que passe nas permissões.';
  end if;
  if exists (select 1 from ensaio_renovar where not ok) then
    raise exception 'Ensaio reprovado: %', (select string_agg(caso, '; ') from ensaio_renovar where not ok);
  end if;
end;
$ensaio$;

select caso, ok from ensaio_renovar order by caso;

rollback;
