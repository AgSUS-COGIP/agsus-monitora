/*
  HISTÓRICO DO EDITAL IGNORA A MUDANÇA SÓ DE CARIMBO (16/11/2026)

  POR QUE
  O gatilho trg_historico_monitoramento (public.fn_registrar_historico) grava a linha inteira
  (to_jsonb(NEW)) em TH_MONITORAMENTO a cada UPDATE de TB_MONITORAMENTO_INDIGENA em que algo
  mudou. 9.152 dos 11.176 registros (cerca de 18 MB, medição de 16/11/2026) são automáticos
  (usuario_id nulo) e só mudam updated_at (6.613, de junho a setembro) ou updated_at e
  "DT_FONTE_FUNIL" (2.539, desde 27/10). Os últimos vêm de private."FC_ATUALIZAR_KPIS_PELA_SELECAO":
  a data da fonte do funil acompanha a última gravação das vagas na Seleção, que a carga renova
  sem mudar número. São uns 5 MB por mês de histórico sem conteúdo, num banco de 500 MB.

  POR QUE NO GATILHO, E NÃO NA GUARDA DA FUNÇÃO DOS KPIs
  "DT_FONTE_FUNIL" aparece na Visão geral e no modal do edital ("Fonte: Seleção, em 16/10,
  08:10", src/lib/funil-do-edital.ts). Tirá-la da guarda de FC_ATUALIZAR_KPIS_PELA_SELECAO
  congelaria essa data quando os números não mudam, e a tela passaria a dizer outra coisa.
  Ignorar o carimbo no gatilho não muda nada do que a tela mostra: só o histórico deixa de
  receber a foto que não tem mudança. Nenhuma tela, relatório, job Python ou função lê
  TH_MONITORAMENTO (só a auditoria da troca de área grava nela, com campo_alterado).

  O QUE MUDA
    - public.fn_registrar_historico: no UPDATE, compara OLD e NEW sem updated_at, updated_by e
      "DT_FONTE_FUNIL". Se só eles mudaram, não grava histórico. INSERT, desativação e qualquer
      outra mudança (humana ou automática) continuam gravando a foto inteira, como antes.
    - Nada mais: a função dos KPIs, a tabela e o gatilho ficam como estão.

  GUARDA: o corpo de fn_registrar_historico é o de 16/11/2026 (md5 do prosrc sem \r).
  ENSAIO:   supabase/ensaios/20261116234000_historico_do_edital_ignora_so_carimbo.sql
  ROLLBACK: supabase/rollback/20261116234000_historico_do_edital_ignora_so_carimbo.sql
  DEPOIS:   supabase/migrations/20261116235000_limpar_historico_do_edital_so_carimbo.sql apaga
            os registros só de carimbo já gravados (exige esta aplicada).
*/
begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.fn_registrar_historico()')), chr(13), ''))
       is distinct from '3a95b60de55006aac09a8d0169d68244' then
    raise exception 'fn_registrar_historico: o corpo no banco não é o de 16/11/2026 (md5). Já aplicada, ou alguém mudou: junte as mudanças antes.';
  end if;
end;
$guarda$;

CREATE OR REPLACE FUNCTION public.fn_registrar_historico()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_usuario_id    uuid;
  v_usuario_email text;
  v_evento        text;
begin
  v_usuario_id := auth.uid();

  if v_usuario_id is not null then
    select u.email
      into v_usuario_email
    from auth.users u
    where u.id = v_usuario_id
    limit 1;
  end if;

  if TG_OP = 'INSERT' then
    v_evento := 'criado';

    insert into public."TH_MONITORAMENTO"
      (id_registro, usuario_id, usuario_email, evento, snapshot_json)
    values
      (NEW.id, v_usuario_id, v_usuario_email, v_evento, to_jsonb(NEW));

  elsif TG_OP = 'UPDATE' then
    -- Só o carimbo mudou (updated_at, updated_by e a data da fonte do funil, que a carga da
    -- Seleção renova sem mudar número): não é mudança, não vai para o histórico
    -- (20261116234000).
    if (to_jsonb(OLD) - array['updated_at', 'updated_by', 'DT_FONTE_FUNIL'])
       is distinct from
       (to_jsonb(NEW) - array['updated_at', 'updated_by', 'DT_FONTE_FUNIL']) then
      v_evento := case
        when NEW.ativo = false and OLD.ativo = true then 'desativado'
        else 'atualizado'
      end;

      insert into public."TH_MONITORAMENTO"
        (id_registro, usuario_id, usuario_email, evento, snapshot_json)
      values
        (NEW.id, v_usuario_id, v_usuario_email, v_evento, to_jsonb(NEW));
    end if;
  end if;

  return NEW;
end;
$function$;

comment on function public.fn_registrar_historico() is
  'Gatilho trg_historico_monitoramento: grava a foto do edital (to_jsonb(NEW)) em TH_MONITORAMENTO no INSERT e no UPDATE que muda conteúdo. O UPDATE que só muda updated_at, updated_by e DT_FONTE_FUNIL não grava (20261116234000).';

commit;
