-- Reversão da observação de status de aprovados.
-- Não apaga observações já preenchidas: revisar antes de remover a coluna.
begin;
set local lock_timeout = '5s';
drop function if exists public.alterar_status_aprovado_com_observacao(uuid,text,text,text,date,text);
drop function if exists public.ler_observacao_status_aprovado(uuid);
do $$
begin
  if exists (
    select 1 from public."TB_CANDIDATO_APROVADO"
    where observacao_status is not null
  ) then
    raise exception 'Existem observações salvas. Exporte e preserve os dados antes de desfazer.';
  end if;
end;
$$;
alter table public."TB_CANDIDATO_APROVADO"
  drop column if exists observacao_status;
commit;
