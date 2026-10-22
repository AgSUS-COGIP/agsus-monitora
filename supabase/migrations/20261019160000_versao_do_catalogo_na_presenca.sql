/*
  VERSÃO DO CATÁLOGO DE ABAS NA PRESENÇA

  A coordenação desliga abas por área (Configurações › Módulos e abas) para
  aliviar o banco — em 19/10/2026 o Supabase NANO saturou com Visão geral,
  Seleção, Aprovados etc. abertos. Mas o catálogo (listar_abas_do_menu) e a
  situação (obter_situacao_do_sistema) eram lidos uma vez só, na entrada: quem
  já estava numa página desligada continuava nela até recarregar (vimos
  presença em "Visão geral · Saúde Indígena" 16 min depois de desligada).

  Para a tela saber que mudou SEM chamada nova, a versão do catálogo pega
  carona no sinal de presença que ela já manda (a cada 90 s com a aba
  visível, e na troca de página): registrar_presenca_monitora passa a
  devolver também `versao_do_catalogo`. A tela só relê o catálogo e a
  situação quando a versão muda (src/app/vigia-do-catalogo.ts).

  A versão é o md5 das linhas de TB_SITUACAO_SISTEMA, TB_AREA, TB_ABA e
  RL_ABA_AREA (12 abas, 36 ligações, 3 áreas e 1 linha de sistema em
  19/10/2026): pega toda mudança, venha ela da tela de Módulos e abas, de uma
  migration ou de um update direto. Não há versão por usuário: o catálogo é o
  mesmo para todos.

  Contrato mantido: mesmo argumento, mesmo retorno jsonb com `status: 'OK'`
  (a tela antiga ignora a chave nova), mesmas permissões (só authenticated).
  O corpo é o de 20261005200000_foto_do_google_no_perfil.sql, com o
  search_path vazio e tudo qualificado.

  Rollback: supabase/rollback/20261019160000_versao_do_catalogo_na_presenca.sql
*/
begin;

set local lock_timeout = '5s';

create or replace function private."FC_VERSAO_DO_CATALOGO_DE_ABAS"()
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select md5(concat_ws('#',
    (select string_agg(s::text, '|' order by s::text) from public."TB_SITUACAO_SISTEMA" s),
    (select string_agg(a::text, '|' order by a::text) from public."TB_AREA" a),
    (select string_agg(b::text, '|' order by b::text) from public."TB_ABA" b),
    (select string_agg(r::text, '|' order by r::text) from public."RL_ABA_AREA" r)
  ));
$function$;

comment on function private."FC_VERSAO_DO_CATALOGO_DE_ABAS"() is
  'Versão (md5) do catálogo de abas e da situação do sistema e das áreas (TB_SITUACAO_SISTEMA, TB_AREA, TB_ABA, RL_ABA_AREA). Muda a cada alteração; a tela relê o catálogo só quando ela muda.';

revoke all on function private."FC_VERSAO_DO_CATALOGO_DE_ABAS"() from public, anon, authenticated;

create or replace function public.registrar_presenca_monitora(p_current_view text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_email text := coalesce(auth.jwt() ->> 'email', '');
  v_foto text;
begin
  if v_user_id is null then
    raise exception 'Sessao nao localizada.' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public."TB_PERFIL_USUARIO" p
    where p.ativo is true
      and (
        p.user_id = v_user_id
        or lower(p.email) = lower(v_email)
      )
  ) then
    raise exception 'Perfil institucional nao localizado.' using errcode = 'P0002';
  end if;

  insert into public."TB_PRESENCA_ONLINE_MONITORA" (user_id, current_view, seen_at)
  values (v_user_id, left(nullif(trim(p_current_view), ''), 120), timezone('utc', now()))
  on conflict (user_id) do update
    set current_view = excluded.current_view,
        seen_at = excluded.seen_at;

  select private."FC_FOTO_DO_GOOGLE"(u.raw_user_meta_data)
    into v_foto
    from auth.users u
   where u.id = v_user_id;
  if v_foto is not null then
    update public."TB_PERFIL_USUARIO" p
       set google_avatar_url = v_foto
     where p.user_id = v_user_id
       and p.google_avatar_url is distinct from v_foto;
  end if;

  return jsonb_build_object(
    'status', 'OK',
    'versao_do_catalogo', private."FC_VERSAO_DO_CATALOGO_DE_ABAS"()
  );
end;
$function$;

comment on function public.registrar_presenca_monitora(text) is
  'Sinal de presença do MONITORA (Pessoas online); copia a foto do Google do login para TB_PERFIL_USUARIO.google_avatar_url quando ela mudou e devolve a versão do catálogo de abas (versao_do_catalogo), para a tela reler o menu só quando ele muda.';

revoke all on function public.registrar_presenca_monitora(text) from public, anon;
grant execute on function public.registrar_presenca_monitora(text) to authenticated;

commit;
