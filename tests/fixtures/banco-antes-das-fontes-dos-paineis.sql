-- O banco antes das fontes das colunas dos Painéis (20261113220000): o trecho que os testes usam.
-- A guarda dos relatórios dos Painéis, copiada da migration 20261113210000_relatorios_dos_paineis.sql
-- (aplicada em 13/11/2026; saiu do repositório no mesmo PR e segue no banco e no histórico do Git).

create function private."FC_EXIGIR_PAINEIS_DA_AREA"(p_area text)
 returns void
 language plpgsql
 stable
 set search_path to ''
as $function$
begin
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if not private.pode_recurso('paineis_dados', 1) then
    raise exception 'Sem permissão para Painéis' using errcode = '42501';
  end if;
  if not private."FC_PODE_AREA"(p_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
end;
$function$;
