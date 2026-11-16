/*
  ENSAIO de 20261116235500_relatorios_dos_paineis_gravam_so_o_que_mudou: aplica a migration,
  recalcula os 9 relatórios como o cron de hora em hora faz (private."FC_CALCULAR_PAINEIS"()) e
  confere, termina em rollback (não grava nada):
    - as linhas guardadas de cada relatório são exatamente o cálculo (mesmas posições, mesmo
      edital, mesmo conteúdo, nenhuma sobrando), o que o delete + insert de antes deixaria;
    - quantas linhas o recálculo regravou (versão nova) de quantas existem.
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


create temp table tmp_linhas_antes on commit drop as
select l."CO_AREA", l."CO_RELATORIO", l."NU_POSICAO" from public."TB_LINHA_RELATORIO_PAINEL" l;

do $ensaio$
declare
  v_feitos integer;
  v_total integer;
  v_regravadas integer;
  v_apagadas integer;
  v_diferentes integer;
  v_xid xid := (txid_current() % 4294967296)::text::xid;
  r record;
begin
  v_feitos := private."FC_CALCULAR_PAINEIS"();
  if v_feitos <> 3 * (select count(*) from public."TB_AREA") then
    raise exception 'FC_CALCULAR_PAINEIS calculou % relatórios; o esperado era 3 por área.', v_feitos;
  end if;

  select count(*), count(*) filter (where l.xmin = v_xid) into v_total, v_regravadas
    from public."TB_LINHA_RELATORIO_PAINEL" l;
  select count(*) into v_apagadas from tmp_linhas_antes a
   where not exists (select 1 from public."TB_LINHA_RELATORIO_PAINEL" l
                      where l."CO_AREA" = a."CO_AREA" and l."CO_RELATORIO" = a."CO_RELATORIO"
                        and l."NU_POSICAO" = a."NU_POSICAO");

  -- O guardado é o cálculo, posição por posição (o que o painel lê).
  for r in select k."CO_AREA" a, k."CO_RELATORIO" rel, k."QT_LINHA" qt
             from public."TB_CALCULO_RELATORIO_PAINEL" k order by 1, 2 loop
    with esperado as (
      select x.n::integer posicao, (x.linha ->> 'edital_id')::uuid edital, x.linha
        from jsonb_array_elements(coalesce(private."FC_LINHAS_DO_RELATORIO_PAINEL"(r.a, r.rel) -> 'linhas', '[]'::jsonb))
             with ordinality as x (linha, n)
    ), guardado as (
      select l."NU_POSICAO" posicao, l."CO_MONITORAMENTO" edital, l."DS_LINHA" linha
        from public."TB_LINHA_RELATORIO_PAINEL" l
       where l."CO_AREA" = r.a and l."CO_RELATORIO" = r.rel
    )
    select count(*) into v_diferentes
      from esperado e full join guardado g on g.posicao = e.posicao
     where (e.edital, e.linha) is distinct from (g.edital, g.linha);
    if v_diferentes <> 0 then
      raise exception '% / %: % posição(ões) guardadas diferem do cálculo.', r.a, r.rel, v_diferentes;
    end if;
    if r.qt <> (select count(*) from public."TB_LINHA_RELATORIO_PAINEL" l
                 where l."CO_AREA" = r.a and l."CO_RELATORIO" = r.rel) then
      raise exception '% / %: QT_LINHA não bate com as linhas guardadas.', r.a, r.rel;
    end if;
  end loop;

  -- Prova da comparação: estraga uma linha guardada e some com outra; o recálculo do relatório
  -- conserta só essas duas (regrava a estragada, insere a que sumiu) e não toca as outras.
  select k."CO_AREA", k."CO_RELATORIO" into r from public."TB_CALCULO_RELATORIO_PAINEL" k
   where k."QT_LINHA" >= 3 order by k."QT_LINHA" limit 1;
  update public."TB_LINHA_RELATORIO_PAINEL" l set "DS_LINHA" = l."DS_LINHA" || '{"_ensaio": 1}'
   where l."CO_AREA" = r."CO_AREA" and l."CO_RELATORIO" = r."CO_RELATORIO" and l."NU_POSICAO" = 1;
  delete from public."TB_LINHA_RELATORIO_PAINEL" l
   where l."CO_AREA" = r."CO_AREA" and l."CO_RELATORIO" = r."CO_RELATORIO" and l."NU_POSICAO" = 2;
  -- Onde está cada linha guardada (ctid) antes do recálculo: linha regravada muda de lugar.
  create temp table tmp_versao on commit drop as
  select l."NU_POSICAO", l.ctid as versao from public."TB_LINHA_RELATORIO_PAINEL" l
   where l."CO_AREA" = r."CO_AREA" and l."CO_RELATORIO" = r."CO_RELATORIO";
  perform private."FC_CALCULAR_RELATORIO_PAINEL"(r."CO_AREA", r."CO_RELATORIO", null, null);
  if exists (select 1 from public."TB_LINHA_RELATORIO_PAINEL" l
              where l."CO_AREA" = r."CO_AREA" and l."CO_RELATORIO" = r."CO_RELATORIO" and l."DS_LINHA" ? '_ensaio')
     or not exists (select 1 from public."TB_LINHA_RELATORIO_PAINEL" l
                     where l."CO_AREA" = r."CO_AREA" and l."CO_RELATORIO" = r."CO_RELATORIO" and l."NU_POSICAO" = 2) then
    raise exception 'O recálculo não consertou a linha estragada ou a que sumiu.';
  end if;
  select count(*) into v_diferentes
    from public."TB_LINHA_RELATORIO_PAINEL" l
    join tmp_versao t on t."NU_POSICAO" = l."NU_POSICAO"
   where l."CO_AREA" = r."CO_AREA" and l."CO_RELATORIO" = r."CO_RELATORIO"
     and l.ctid is distinct from t.versao;
  if v_diferentes <> 1 then
    raise exception 'O recálculo regravou % linha(s) já guardadas do relatório de teste; o esperado era 1 (a estragada).', v_diferentes;
  end if;

  raise notice 'Ensaio 20261116235500: % relatórios recalculados; das % linhas guardadas, % regravadas e % apagadas (antes: todas as % regravadas); o guardado é o cálculo em todos.',
    v_feitos, v_total, v_regravadas, v_apagadas, (select count(*) from tmp_linhas_antes);
end;
$ensaio$;

rollback;
