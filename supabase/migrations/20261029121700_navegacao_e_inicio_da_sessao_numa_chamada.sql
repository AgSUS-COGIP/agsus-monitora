/*
  NAVEGAÇÃO E INÍCIO DA SESSÃO, CADA UM NUMA CHAMADA (29/10/2026)

  POR QUE
  O diagnóstico de desempenho de 29/10/2026 (logs de ~19 h com 1–2 pessoas) mostrou que cada troca
  de página fazia duas chamadas (registrar_evento_acesso "abertura_tela" e
  registrar_presenca_monitora) e que cada carga de página fazia ~10 chamadas de inicialização
  (TB_CONFIGURACAO 32×, obter_branding_acesso_publico 26×, TB_PAINEL_EXTERNO 22×,
  listar_abas_do_menu 22×, obter_situacao_do_sistema 22×, obter_contexto_monitora 21×). No
  Supabase NANO cada ida ao banco conta.

  O QUE CRIA
    1. public.registrar_navegacao_monitora(...) — numa chamada, o evento de auditoria e a presença.
       Chama as duas funções que já existem (registrar_evento_acesso → TL_EVENTO_ACESSO;
       registrar_presenca_monitora → TB_PRESENCA_ONLINE_MONITORA, com a versão do catálogo de abas
       de carona): o que se grava não muda. A falha da presença (conta sem perfil ativo) não desfaz
       o evento — volta em `presenca_erro`, como quando eram duas chamadas independentes.
       `p_presenca = false` registra só o evento; sem `p_evento`, só a presença.
    2. public.obter_inicio_da_sessao() — numa chamada, o que a entrada do app lê depois do perfil:
       configuração (TB_CONFIGURACAO), painéis externos (TB_PAINEL_EXTERNO), catálogo de abas
       (listar_abas_do_menu), situação do sistema (obter_situacao_do_sistema) e unidades ativas
       (TD_UNIDADE). SECURITY INVOKER de propósito: cada parte passa pela mesma RLS das consultas
       de hoje (os painéis liberados, as unidades ativas), e o resultado é o mesmo das cinco.

  Nenhuma tabela nova, nenhum dado muda. As funções antigas ficam: o front cai nelas se esta
  migration ainda não estiver aplicada, e a auditoria da expiração, o "Atualizar" dos painéis e
  Configurações ainda as usam.

  ENSAIO: supabase/ensaios/20261029121700_navegacao_e_inicio_da_sessao_numa_chamada.sql (compara cada parte com a consulta de antes, como
  administrador global e como pessoa sem esse grupo; grava e desfaz).
  ROLLBACK: supabase/rollback/20261029121700_navegacao_e_inicio_da_sessao_numa_chamada.sql (drop das duas funções).
*/
begin;

set local lock_timeout = '5s';

do $$
begin
  if to_regprocedure('public.registrar_presenca_monitora(text)') is null
     or to_regprocedure('public.registrar_evento_acesso(text, text, text, jsonb, text, text, text)') is null
     or to_regprocedure('public.listar_abas_do_menu()') is null
     or to_regprocedure('public.obter_situacao_do_sistema()') is null then
    raise exception 'Faltam as RPCs de presença, auditoria, catálogo de abas ou situação do sistema.';
  end if;
end;
$$;

-- 1. A navegação numa chamada: o evento de auditoria e a presença ---------------------------------
create or replace function public.registrar_navegacao_monitora(
  p_evento text default null,
  p_tela text default null,
  p_detalhes jsonb default '{}'::jsonb,
  p_client_session_id text default null,
  p_user_agent text default null,
  p_app_version text default null,
  p_origem text default 'index',
  p_presenca boolean default true,
  p_current_view text default null
)
 returns jsonb
 language plpgsql
 security invoker
 set search_path to ''
 set statement_timeout to '3s'
as $function$
declare
  v_evento_id bigint;
  v_presenca jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sessao nao localizada.' using errcode = '28000';
  end if;

  -- O mesmo registro de registrar_evento_acesso (TL_EVENTO_ACESSO).
  if nullif(btrim(p_evento), '') is not null then
    v_evento_id := public.registrar_evento_acesso(
      p_evento, p_tela, p_origem, p_detalhes,
      p_client_session_id, p_user_agent, p_app_version
    );
  end if;

  -- A mesma linha de registrar_presenca_monitora; a falha dela não desfaz o evento.
  if p_presenca then
    begin
      v_presenca := public.registrar_presenca_monitora(p_current_view);
    exception when others then
      v_presenca := jsonb_build_object(
        'presenca_erro', jsonb_build_object('codigo', sqlstate, 'mensagem', sqlerrm)
      );
    end;
  end if;

  return coalesce(v_presenca, '{}'::jsonb) || jsonb_build_object('evento_id', v_evento_id);
end;
$function$;

comment on function public.registrar_navegacao_monitora(text, text, jsonb, text, text, text, text, boolean, text) is
  'Uma chamada por navegação: o evento de auditoria (registrar_evento_acesso) e a presença (registrar_presenca_monitora, com a versão do catálogo de abas). Falha da presença volta em presenca_erro e não desfaz o evento.';

revoke all on function public.registrar_navegacao_monitora(text, text, jsonb, text, text, text, text, boolean, text) from public, anon;
grant execute on function public.registrar_navegacao_monitora(text, text, jsonb, text, text, text, text, boolean, text) to authenticated;

-- 2. O início da sessão numa chamada --------------------------------------------------------------
create or replace function public.obter_inicio_da_sessao()
 returns jsonb
 language plpgsql
 stable
 security invoker
 set search_path to ''
 set statement_timeout to '5s'
as $function$
begin
  if auth.uid() is null then
    raise exception 'Sessao nao localizada.' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'configuracao', coalesce((
      select jsonb_agg(jsonb_build_object(
               'chave', c.chave, 'valor', c.valor, 'descricao', c.descricao))
        from public."TB_CONFIGURACAO" c
    ), '[]'::jsonb),
    'paineis', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'codigo', p.codigo, 'titulo', p.titulo, 'icone', p.icone,
               'url', p.url, 'ordem', p.ordem, 'ativo', p.ativo,
               'em_manutencao', p.em_manutencao, 'tipo_abertura', p.tipo_abertura)
             order by p.ordem)
        from public."TB_PAINEL_EXTERNO" p
    ), '[]'::jsonb),
    'abas', public.listar_abas_do_menu()::jsonb,
    'situacao', public.obter_situacao_do_sistema()::jsonb,
    'unidades', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id_unidade', u.id_unidade, 'sigla', u.sigla,
               'nome_oficial', u.nome_oficial, 'tipo', u.tipo,
               'uf_sede', u.uf_sede, 'ativo', u.ativo)
             order by u.tipo, u.nome_oficial)
        from public."TD_UNIDADE" u
       where u.ativo = true
    ), '[]'::jsonb)
  );
end;
$function$;

comment on function public.obter_inicio_da_sessao() is
  'O que a entrada do app lê depois do perfil, numa chamada: configuração (TB_CONFIGURACAO), painéis externos (TB_PAINEL_EXTERNO), catálogo de abas (listar_abas_do_menu), situação do sistema (obter_situacao_do_sistema) e unidades ativas (TD_UNIDADE). SECURITY INVOKER: cada parte passa pela RLS de sempre.';

revoke all on function public.obter_inicio_da_sessao() from public, anon;
grant execute on function public.obter_inicio_da_sessao() to authenticated;

commit;
