/*
  ENSAIO de 20261111150000_editais_de_analise_fora_do_periodo_ficam_inativos.sql
  Roda no SQL Editor (papel postgres) ANTES de aplicar. Termina em rollback.
  Confere: cria os mesmos objetos da migration (o teste confere letra por letra);
  inativa os encerrados de hoje (no máximo 10); a carga que manda SIM de novo num
  encerrado não regrava; o edital novo já encerrado entra inativo; estender a data de
  fim reabre; o edital que acaba hoje continua ativo; a tarefa está no pg_cron e no
  catálogo. Ok = NOTICE "Ensaio 20261111150000 ok" e ROLLBACK.
*/
begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if to_regprocedure('private."FC_INATIVAR_EDITAIS_ANALISE_ENCERRADOS"()') is not null then
    raise exception 'A migration 20261111150000 já foi aplicada.';
  end if;
  if to_regclass('cron.job') is null then
    raise exception 'pg_cron não está instalado: a tarefa diária não teria onde ficar.';
  end if;
  if exists (select 1 from cron.job where jobname = 'agsus_analises_inativar_editais_encerrados') then
    raise exception 'Já existe a tarefa agsus_analises_inativar_editais_encerrados no pg_cron.';
  end if;
  if exists (select 1 from pg_trigger
              where tgrelid = 'public."TB_EDITAL_ANALISE"'::regclass
                and tgname = 'TG_EDITALANALISE_PERIODO') then
    raise exception 'Já existe o gatilho TG_EDITALANALISE_PERIODO.';
  end if;
end;
$guarda$;

-- [objetos] (o ensaio repete este bloco letra por letra; o teste confere)
create function private."FC_EDITAL_ANALISE_ENCERRADO"(p_planilha text, p_edital text, p_fim date)
returns boolean
language sql
stable
security definer
set search_path to ''
as $fn$
  -- O período acabou quando o último dia (data_fim_analise) é antes de hoje em Brasília: o
  -- edital que termina hoje fica ativo até a meia-noite. Sem data de fim, nunca acaba.
  -- O edital com a avaliação no MONITORA não segue a planilha e fica de fora.
  select p_fim is not null
     and p_fim < (now() at time zone 'America/Sao_Paulo')::date
     and not public."FC_EDITAL_ANALISE_NO_MONITORA"(p_planilha, p_edital);
$fn$;

comment on function private."FC_EDITAL_ANALISE_ENCERRADO"(text, text, date) is
  'Regra do período das análises (20261111150000): o edital de análise está encerrado quando data_fim_analise é antes de hoje em Brasília (sem data, nunca), fora o edital com a avaliação no MONITORA.';

revoke all on function private."FC_EDITAL_ANALISE_ENCERRADO"(text, text, date) from public;

create function private."FC_TG_PERIODO_EDITAL_ANALISE"()
returns trigger
language plpgsql
security definer
set search_path to ''
as $fn$
begin
  if new.ativo is true
     and private."FC_EDITAL_ANALISE_ENCERRADO"(new."CO_PLANILHA", new.edital, new.data_fim_analise) then
    new.ativo := false;
    -- A planilha manda SIM a cada carga: se, já inativo, a linha ficou igual à gravada,
    -- não regrava (nem WAL nem o painel marcado para remontar a cada 20 minutos).
    if tg_op = 'UPDATE'
       and (new.grupo, new.unidade, new.edital, new.ativo, new.data_inicio_analise,
            new.data_fim_analise, new."CO_PLANILHA")
           is not distinct from
           (old.grupo, old.unidade, old.edital, old.ativo, old.data_inicio_analise,
            old.data_fim_analise, old."CO_PLANILHA") then
      return null;
    end if;
  end if;
  return new;
end;
$fn$;

comment on function private."FC_TG_PERIODO_EDITAL_ANALISE"() is
  'Gatilho BEFORE de TB_EDITAL_ANALISE (20261111150000): edital com o período encerrado (FC_EDITAL_ANALISE_ENCERRADO) entra ou fica inativo, mesmo com SIM na planilha; a regravação sem mudança é descartada.';

revoke all on function private."FC_TG_PERIODO_EDITAL_ANALISE"() from public;

create trigger "TG_EDITALANALISE_PERIODO"
  before insert or update on public."TB_EDITAL_ANALISE"
  for each row execute function private."FC_TG_PERIODO_EDITAL_ANALISE"();

create function private."FC_INATIVAR_EDITAIS_ANALISE_ENCERRADOS"()
returns integer
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_total integer;
begin
  update public."TB_EDITAL_ANALISE" e
     set ativo = false, updated_at = now()
   where e.ativo is true
     and private."FC_EDITAL_ANALISE_ENCERRADO"(e."CO_PLANILHA", e.edital, e.data_fim_analise);
  get diagnostics v_total = row_count;
  return v_total;
end;
$fn$;

comment on function private."FC_INATIVAR_EDITAIS_ANALISE_ENCERRADOS"() is
  'Inativa os editais de análise ativos com o período encerrado (FC_EDITAL_ANALISE_ENCERRADO) e devolve quantos. Tarefa agsus_analises_inativar_editais_encerrados, todo dia às 00:10 de Brasília. 20261111150000.';

revoke all on function private."FC_INATIVAR_EDITAIS_ANALISE_ENCERRADOS"() from public;

insert into public."TB_TAREFA_AGENDADA" ("NO_TAREFA", "ST_PREFIXO", "DS_ROTULO", "CO_CHAVE", "NO_WORKFLOW")
values ('agsus_analises_inativar_editais_encerrados', 'N',
        'Inativar os editais de análise com o período encerrado', null, null);

select cron.schedule(
  'agsus_analises_inativar_editais_encerrados',
  '10 3 * * *',
  $cmd$select private."FC_INATIVAR_EDITAIS_ANALISE_ENCERRADOS"() where pg_try_advisory_xact_lock(hashtext('agsus_analises_inativar_editais_encerrados'));$cmd$);
-- [/objetos]

do $confere$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_inativados integer;
  v_id uuid;
  v_n integer;
  v_ativo boolean;
begin
  v_inativados := private."FC_INATIVAR_EDITAIS_ANALISE_ENCERRADOS"();
  raise notice 'Inativados agora: %', v_inativados;
  if v_inativados > 10 then
    raise exception 'Ensaio: inativaria % editais de uma vez.', v_inativados;
  end if;
  if exists (select 1 from public."TB_EDITAL_ANALISE" e
              where e.ativo and private."FC_EDITAL_ANALISE_ENCERRADO"(e."CO_PLANILHA", e.edital, e.data_fim_analise)) then
    raise exception 'Ensaio: sobrou edital ativo com o período encerrado.';
  end if;
  if private."FC_INATIVAR_EDITAIS_ANALISE_ENCERRADOS"() <> 0 then
    raise exception 'Ensaio: a segunda rodada inativou de novo.';
  end if;

  -- A carga manda SIM num encerrado: não regrava (0 linhas) e segue inativo.
  select e.id into v_id from public."TB_EDITAL_ANALISE" e
   where not e.ativo and e.data_fim_analise < v_hoje
     and not public."FC_EDITAL_ANALISE_NO_MONITORA"(e."CO_PLANILHA", e.edital)
   order by e.data_fim_analise desc limit 1;
  if v_id is null then raise exception 'Ensaio: nenhum edital encerrado para conferir.'; end if;
  update public."TB_EDITAL_ANALISE" set ativo = true, updated_at = now() where id = v_id;
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'Ensaio: a regravação do SIM não foi descartada (% linha).', v_n; end if;
  if (select ativo from public."TB_EDITAL_ANALISE" where id = v_id) then
    raise exception 'Ensaio: o SIM da carga reativou o encerrado.';
  end if;

  -- Estender a data de fim reabre.
  update public."TB_EDITAL_ANALISE" set ativo = true, data_fim_analise = v_hoje + 7 where id = v_id;
  if not (select ativo from public."TB_EDITAL_ANALISE" where id = v_id) then
    raise exception 'Ensaio: estender a data de fim não reabriu.';
  end if;

  -- Termina hoje: ativo. Já terminou: entra inativo.
  insert into public."TB_EDITAL_ANALISE" (grupo, unidade, edital, ativo, data_fim_analise, "CO_PLANILHA")
  values ('Ensaio 20261111150000', 'Ensaio', '9991/2099', true, v_hoje, 'saude-indigena')
  returning ativo into v_ativo;
  if not v_ativo then raise exception 'Ensaio: o edital que termina hoje entrou inativo.'; end if;
  insert into public."TB_EDITAL_ANALISE" (grupo, unidade, edital, ativo, data_fim_analise, "CO_PLANILHA")
  values ('Ensaio 20261111150000', 'Ensaio', '9992/2099', true, v_hoje - 1, 'saude-indigena')
  returning ativo into v_ativo;
  if v_ativo then raise exception 'Ensaio: o edital já encerrado entrou ativo.'; end if;

  if not exists (select 1 from cron.job where jobname = 'agsus_analises_inativar_editais_encerrados'
                  and schedule = '10 3 * * *' and active) then
    raise exception 'Ensaio: a tarefa diária não ficou no pg_cron.';
  end if;
  if not exists (select 1 from public."TB_TAREFA_AGENDADA"
                  where "NO_TAREFA" = 'agsus_analises_inativar_editais_encerrados' and "CO_CHAVE" is null) then
    raise exception 'Ensaio: a tarefa não ficou no catálogo.';
  end if;
  raise notice 'Ensaio 20261111150000 ok.';
end;
$confere$;

rollback;
