-- Desfaz 20261110140000.
-- Volta FC_GESTOR_DO_EDITAL ao corpo e ao comentario de 20261006100000 (so o
-- grupo edital_gestor) e tira public.reabrir_fichas.
-- ATENCAO: com a Fila nova publicada, o "Reabrir" em lote deixa de funcionar;
-- voltar o front antes, ou junto.
-- Dado nao se desfaz: as fichas reabertas e o historico REABRIR ficam como estao.
begin;
set local lock_timeout = '3s';
do $guarda$
begin
  if to_regprocedure('public.reabrir_fichas(uuid, jsonb, text, text)') is null then
    raise exception 'Migration 20261110140000 nao aplicada: nada a desfazer';
  end if;
end $guarda$;

drop function public.reabrir_fichas(uuid, jsonb, text, text);

create or replace function private."FC_GESTOR_DO_EDITAL"(p_perfil_usuario uuid, p_edital uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public."TB_PERFIL_USUARIO" u
     where u.id = p_perfil_usuario and u.ativo and u.perfil = 'edital_gestor'
       and private."FC_NIVEL_AVALIACAO_DO_PERFIL"(u.id) >= 3
       and private."FC_PERFIL_VE_EDITAL"(u.id, p_edital));
$function$;
comment on function private."FC_GESTOR_DO_EDITAL"(uuid, uuid) is
  'O usuário é gestor do edital na avaliação documental: grupo edital_gestor, Administrador em avaliacao_documental e vê o edital (área e coordenação). Coordena sem linha em RL_ANALISTA_EDITAL.';
revoke all on function private."FC_GESTOR_DO_EDITAL"(uuid, uuid) from public, anon, authenticated;

-- FC_GESTOR_DO_EDITAL está no fecho das leituras (20261029170000): recalcula as fontes delas.
select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"();

notify pgrst, 'reload schema';
commit;
