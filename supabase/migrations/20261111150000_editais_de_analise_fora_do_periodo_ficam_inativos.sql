/*
  ANÁLISES: EDITAL COM O PERÍODO ENCERRADO FICA INATIVO

  A Central da Saúde Indígena marca cada edital com ativo SIM/NÃO na DIM_EDITAIS e o
  MONITORA seguia a planilha. Em 11/11/2026, 112/2026 (fim em 02/11), 116 e 117/2026
  (fim em 09/11) seguiam SIM: o painel mostrava as análises como ativas e a carga
  incremental contava 1.471 delas como ausentes (a trava segurou). Em Projetos, 93/2026
  (fim em 08/10) estava igual.

  Regra nova: o edital cujo último dia de análise (data_fim_analise) é antes de hoje em
  Brasília é inativo, mesmo com SIM na planilha. As análises ficam, e o painel as mostra
  em Inativo (edital_ativo false), como as de 94 a 111/2026. O edital sem data de fim e
  o edital com a avaliação no MONITORA (FC_EDITAL_ANALISE_NO_MONITORA) não mudam.

  O QUE MUDA
    1. private."FC_EDITAL_ANALISE_ENCERRADO"(planilha, edital, fim): a regra.
    2. Gatilho BEFORE "TG_EDITALANALISE_PERIODO" (private."FC_TG_PERIODO_EDITAL_ANALISE"):
       a carga que grava SIM num edital encerrado grava NÃO; se a linha fica igual à de
       antes, a regravação é descartada (o incremental não remonta o painel à toa).
    3. private."FC_INATIVAR_EDITAIS_ANALISE_ENCERRADOS"() e a tarefa
       agsus_analises_inativar_editais_encerrados (todo dia às 00:10 de Brasília, sem
       chave, no catálogo TB_TAREFA_AGENDADA): o edital que acaba hoje fica inativo à
       meia-noite, sem esperar mudança na planilha.
    4. Roda a inativação uma vez agora (4 editais em 11/11/2026; recusa acima de 10).

  Para reabrir um edital, basta estender a data de fim na planilha: a próxima carga
  grava SIM de novo.

  GUARDAS: já aplicada, tarefa ou gatilho já existentes, ou pg_cron ausente: recusa.

  Ensaio: supabase/ensaios/20261111150000_editais_de_analise_fora_do_periodo_ficam_inativos.sql   Rollback: supabase/rollback/20261111150000_editais_de_analise_fora_do_periodo_ficam_inativos.sql
  Teste: tests/editais-de-analise-fora-do-periodo.test.ts
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

do $agora$
declare
  v_inativados integer := private."FC_INATIVAR_EDITAIS_ANALISE_ENCERRADOS"();
begin
  if v_inativados > 10 then
    raise exception 'Inativaria % editais de uma vez (esperados 4 em 11/11/2026): confira as datas de fim antes de aplicar.', v_inativados;
  end if;
  raise notice 'Editais de análise inativados agora: %', v_inativados;
end;
$agora$;

commit;
