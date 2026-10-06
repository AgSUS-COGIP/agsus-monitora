begin;

-- Somente os dois módulos de dashboard. Permissões continuam decididas pelo banco.
create function public.pode_atualizar_dashboard(p_modulo text)
returns boolean language sql stable security definer set search_path = ''
as $function$
  select (select auth.uid()) is not null
    and p_modulo in ('selecao', 'entrevistas')
    and (private.is_master() or private.pode_recurso(p_modulo, 2));
$function$;
revoke all on function public.pode_atualizar_dashboard(text) from public, anon;
grant execute on function public.pode_atualizar_dashboard(text) to authenticated;
comment on function public.pode_atualizar_dashboard(text) is
  'Autoriza editor/admin de Seleção ou Entrevistas a executar a sincronização completa do respectivo módulo, em todas as áreas; não libera outras cargas.';

commit;
