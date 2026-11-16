/*
  ROLLBACK de 20261116235500_relatorios_dos_paineis_gravam_so_o_que_mudou: volta
  private."FC_CALCULAR_RELATORIO_PAINEL" ao corpo e ao comentário de 20261116160000 (copiados do
  banco com pg_get_functiondef e obj_description em 16/11/2026), que apaga e regrava todas as
  linhas a cada cálculo, e devolve o fillfactor padrão a TB_LINHA_RELATORIO_PAINEL.

  Dado não se desfaz: as linhas prontas ficam como estão (são as mesmas que o corpo antigo
  gravaria) e são regravadas no próximo cálculo.
*/
begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if position('20261116235500' in coalesce((select prosrc from pg_proc where oid = to_regprocedure('private."FC_CALCULAR_RELATORIO_PAINEL"(text, text, uuid, interval)')), '')) = 0 then
    raise exception 'FC_CALCULAR_RELATORIO_PAINEL não tem o corpo de 20261116235500: a migration não está aplicada, nada a desfazer.';
  end if;
end;
$guarda$;

CREATE OR REPLACE FUNCTION private."FC_CALCULAR_RELATORIO_PAINEL"(p_area text, p_relatorio text, p_usuario uuid, p_intervalo interval DEFAULT NULL::interval)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v jsonb;
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
  insert into public."TB_CALCULO_RELATORIO_PAINEL"
    ("CO_AREA", "CO_RELATORIO", "DT_CALCULO", "QT_LINHA", "DS_FONTES", "DS_AVISOS", "CO_USUARIO_CALCULO")
  values (p_area, p_relatorio, now(), jsonb_array_length(coalesce(v -> 'linhas', '[]'::jsonb)),
          coalesce(v -> 'fontes', '{}'::jsonb), coalesce(v -> 'avisos', '[]'::jsonb), p_usuario)
  on conflict ("CO_AREA", "CO_RELATORIO") do update
    set "DT_CALCULO" = excluded."DT_CALCULO", "QT_LINHA" = excluded."QT_LINHA",
        "DS_FONTES" = excluded."DS_FONTES", "DS_AVISOS" = excluded."DS_AVISOS",
        "CO_USUARIO_CALCULO" = excluded."CO_USUARIO_CALCULO";
  delete from public."TB_LINHA_RELATORIO_PAINEL" l
   where l."CO_AREA" = p_area and l."CO_RELATORIO" = p_relatorio;
  insert into public."TB_LINHA_RELATORIO_PAINEL"
    ("CO_AREA", "CO_RELATORIO", "NU_POSICAO", "CO_MONITORAMENTO", "DS_LINHA")
  select p_area, p_relatorio, x.n::integer, (x.linha ->> 'edital_id')::uuid, x.linha
    from jsonb_array_elements(coalesce(v -> 'linhas', '[]'::jsonb)) with ordinality as x (linha, n);
  return true;
end;
$function$;
comment on function private."FC_CALCULAR_RELATORIO_PAINEL"(text, text, uuid, interval) is
  'Painéis: recalcula um relatório da área e troca as linhas prontas, sob lock por área e relatório. Com p_intervalo, não recalcula se o último cálculo for mais recente (devolve false).';

alter table public."TB_LINHA_RELATORIO_PAINEL" reset (fillfactor);

do $confere$
begin
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('private."FC_CALCULAR_RELATORIO_PAINEL"(text, text, uuid, interval)')), chr(13), ''))
       is distinct from '6310777671e9060e9a891ec3012cd42a' then
    raise exception 'O corpo restaurado não bate com o de 20261116160000 (md5).';
  end if;
end;
$confere$;

commit;
