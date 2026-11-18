-- Migration aplicada em produção e registrada em public.migracoes_aplicadas, guardada aqui
-- só para montar o banco dos testes (PGlite); não aplicar. A fonte do código do banco é o
-- banco e o retrato supabase/esquema-atual.sql. O arquivo saiu de supabase/migrations/ em
-- 17/11/2026 (histórico no Git). Daqui para baixo, o conteúdo aplicado, sem mudança.
/*
  RELATÓRIOS DOS PAINÉIS GRAVAM SÓ A LINHA QUE MUDOU (16/11/2026)

  POR QUE
  private."FC_CALCULAR_RELATORIO_PAINEL" (20261116160000) apaga e regrava todas as linhas do
  relatório a cada cálculo, e o cron agsus_paineis_recalcular_relatorios recalcula os 9
  relatórios (3 áreas × 3) de hora em hora: cerca de 34.700 linhas (16 MB) reescritas por hora,
  mesmo quando nada mudou. A tabela TB_LINHA_RELATORIO_PAINEL já ocupa 41 MB (34 MB de heap para
  16 MB de dados), num banco de 500 MB.

  O QUE MUDA
    - FC_CALCULAR_RELATORIO_PAINEL compara o cálculo novo com as linhas guardadas, posição por
      posição: apaga as posições que sobraram, atualiza só a posição cujo edital ou conteúdo
      (DS_LINHA) mudou e insere as posições novas. A linha igual não é tocada (nenhuma versão
      nova, nada para o autovacuum).
    - O resto da função fica igual: o lock por área e relatório, o intervalo do Sincronizar e o
      registro do cálculo em TB_CALCULO_RELATORIO_PAINEL (DT_CALCULO continua sendo a hora do
      último cálculo, que a tela mostra).
    - TB_LINHA_RELATORIO_PAINEL ganha fillfactor 90: a atualização de uma linha que só muda
      DS_LINHA cabe na mesma página (HOT) e não mexe nos índices. Vale para páginas novas e,
      nas antigas, depois do VACUUM FULL.

  O QUE NÃO MUDA
  O que o painel mostra: depois do cálculo, as linhas guardadas são as mesmas, nas mesmas
  posições, que o delete + insert de antes deixaria (o ensaio e
  tests/relatorios-dos-paineis-gravam-so-o-que-mudou.test.ts conferem). Nenhuma RPC muda.

  GUARDA: o corpo de FC_CALCULAR_RELATORIO_PAINEL é o de 20261116160000 (md5 do prosrc sem \r).
  ENSAIO:   supabase/ensaios/20261116235500_relatorios_dos_paineis_gravam_so_o_que_mudou.sql
  ROLLBACK: supabase/rollback/20261116235500_relatorios_dos_paineis_gravam_so_o_que_mudou.sql
*/
begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('private."FC_CALCULAR_RELATORIO_PAINEL"(text, text, uuid, interval)')), chr(13), ''))
       is distinct from '6310777671e9060e9a891ec3012cd42a' then
    raise exception 'FC_CALCULAR_RELATORIO_PAINEL: o corpo no banco não é o de 20261116160000 (md5). Já aplicada, ou alguém mudou: junte as mudanças antes.';
  end if;
end;
$guarda$;

create or replace function private."FC_CALCULAR_RELATORIO_PAINEL"(
  p_area text, p_relatorio text, p_usuario uuid, p_intervalo interval default null)
 returns boolean
 language plpgsql
 volatile
 set search_path to ''
as $function$
declare
  v jsonb;
  v_linhas jsonb;
  v_qt integer;
  v_ultimo timestamptz;
begin
  -- Um cálculo por vez para a mesma área e relatório: quem chega depois espera e, com intervalo,
  -- recebe o que acabou de ser calculado.
  perform pg_advisory_xact_lock(hashtext('painel:' || p_area || ':' || p_relatorio));
  if p_intervalo is not null then
    select k."DT_CALCULO" into v_ultimo from public."TB_CALCULO_RELATORIO_PAINEL" k
     where k."CO_AREA" = p_area and k."CO_RELATORIO" = p_relatorio;
    if v_ultimo is not null and v_ultimo > now() - p_intervalo then
      return false;
    end if;
  end if;

  v := private."FC_LINHAS_DO_RELATORIO_PAINEL"(p_area, p_relatorio);
  v_linhas := coalesce(v -> 'linhas', '[]'::jsonb);
  v_qt := jsonb_array_length(v_linhas);
  insert into public."TB_CALCULO_RELATORIO_PAINEL"
    ("CO_AREA", "CO_RELATORIO", "DT_CALCULO", "QT_LINHA", "DS_FONTES", "DS_AVISOS", "CO_USUARIO_CALCULO")
  values (p_area, p_relatorio, now(), v_qt,
          coalesce(v -> 'fontes', '{}'::jsonb), coalesce(v -> 'avisos', '[]'::jsonb), p_usuario)
  on conflict ("CO_AREA", "CO_RELATORIO") do update
    set "DT_CALCULO" = excluded."DT_CALCULO", "QT_LINHA" = excluded."QT_LINHA",
        "DS_FONTES" = excluded."DS_FONTES", "DS_AVISOS" = excluded."DS_AVISOS",
        "CO_USUARIO_CALCULO" = excluded."CO_USUARIO_CALCULO";

  -- Só o que mudou (20261116235500): a linha igual à guardada não é regravada.
  delete from public."TB_LINHA_RELATORIO_PAINEL" l
   where l."CO_AREA" = p_area and l."CO_RELATORIO" = p_relatorio
     and l."NU_POSICAO" > v_qt;
  update public."TB_LINHA_RELATORIO_PAINEL" l
     set "CO_MONITORAMENTO" = x.edital, "DS_LINHA" = x.linha
    from (select n::integer as posicao, (linha ->> 'edital_id')::uuid as edital, linha
            from jsonb_array_elements(v_linhas) with ordinality as t (linha, n)) x
   where l."CO_AREA" = p_area and l."CO_RELATORIO" = p_relatorio
     and l."NU_POSICAO" = x.posicao
     and (l."CO_MONITORAMENTO", l."DS_LINHA") is distinct from (x.edital, x.linha);
  insert into public."TB_LINHA_RELATORIO_PAINEL"
    ("CO_AREA", "CO_RELATORIO", "NU_POSICAO", "CO_MONITORAMENTO", "DS_LINHA")
  select p_area, p_relatorio, x.n::integer, (x.linha ->> 'edital_id')::uuid, x.linha
    from jsonb_array_elements(v_linhas) with ordinality as x (linha, n)
   where not exists (select 1 from public."TB_LINHA_RELATORIO_PAINEL" l
                      where l."CO_AREA" = p_area and l."CO_RELATORIO" = p_relatorio
                        and l."NU_POSICAO" = x.n);
  return true;
end;
$function$;
comment on function private."FC_CALCULAR_RELATORIO_PAINEL"(text, text, uuid, interval) is
  'Painéis: recalcula um relatório da área e atualiza as linhas prontas, sob lock por área e relatório. Grava só a posição que mudou (a linha igual não é regravada; 20261116235500). Com p_intervalo, não recalcula se o último cálculo for mais recente (devolve false).';
revoke all on function private."FC_CALCULAR_RELATORIO_PAINEL"(text, text, uuid, interval) from public, anon, authenticated;

alter table public."TB_LINHA_RELATORIO_PAINEL" set (fillfactor = 90);

commit;
