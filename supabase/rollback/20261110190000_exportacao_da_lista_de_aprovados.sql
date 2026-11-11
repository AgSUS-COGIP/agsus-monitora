/*
  ROLLBACK de 20261110190000_exportacao_da_lista_de_aprovados.sql

  Volta ao estado de antes: saem public.registrar_exportacao_aprovados e a
  tabela public."TL_EXPORTACAO_APROVADO". Nada mais no banco mudou com a
  migration (nenhuma função de antes foi trocada).

  O botão "Exportar" do front publicado passa a receber PGRST202 e avisa que a
  exportação não está disponível; o resto da Lista de aprovados não muda.

  Guarda: o registro das exportações é histórico. Com linhas na tabela, o
  rollback recusa, a menos que se confirme o descarte na mesma sessão:
      set agsus.rollback_descartar_exportacoes = 'sim';
  Exporte antes o que precisar guardar (Segurança: "antes de limpar, exporte").
*/
begin;

set local lock_timeout = '5s';

do $$
declare
  v_linhas bigint;
begin
  if to_regclass('public."TL_EXPORTACAO_APROVADO"') is null then
    raise exception 'A migration 20261110190000 não está aplicada (TL_EXPORTACAO_APROVADO não existe).';
  end if;
  execute 'select count(*) from public."TL_EXPORTACAO_APROVADO"' into v_linhas;
  if v_linhas > 0
     and coalesce(current_setting('agsus.rollback_descartar_exportacoes', true), '') <> 'sim' then
    raise exception 'TL_EXPORTACAO_APROVADO tem % exportações registradas. Exporte-as e confirme com set agsus.rollback_descartar_exportacoes = ''sim''.', v_linhas;
  end if;
end;
$$;

drop function public.registrar_exportacao_aprovados(text, text, uuid[], text[], text[], text[], boolean, integer, integer);
drop table public."TL_EXPORTACAO_APROVADO";

commit;
