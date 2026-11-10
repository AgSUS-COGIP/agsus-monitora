-- Desfaz 20261110130000: tira o porteiro do importador de anexos.
-- ATENCAO: com o endpoint novo publicado, a importacao passa a responder 503
-- para todos. Voltar o api/anexos-do-edital.py antes, ou junto.
-- Nao ha dado a desfazer: a funcao so le.
begin;
set local lock_timeout = '3s';
do $guarda$
begin
  if to_regprocedure('public.pode_importar_anexos_do_edital()') is null then
    raise exception 'Migration 20261110130000 nao aplicada: nada a desfazer';
  end if;
end $guarda$;
drop function public.pode_importar_anexos_do_edital();
commit;
