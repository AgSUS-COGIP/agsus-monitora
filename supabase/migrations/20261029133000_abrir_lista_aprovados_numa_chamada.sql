/*
  LISTA DE APROVADOS: A ABERTURA NUMA CHAMADA (29/10/2026)

  POR QUE
  O diagnóstico de desempenho de 29/10/2026 mostrou que abrir a Lista de aprovados fazia 11
  chamadas; listar_listas_aprovados levava ~1 s em conexão nova (conta os candidatos de todas as
  listas de todas as áreas da pessoa). Seis delas eram da própria tela, todas em paralelo:
  listar_listas_aprovados, listar_candidatos_aprovados_compacto (e depois a revalidação da cópia),
  listar_modelos_convocacao, listar_configuracao_convocacao, listar_anexos_candidatos_aprovados,
  listar_convocacoes_aprovados — e listar_pendencias_do_edital, para o selo da aba Pendências.

  O QUE CRIA
  public.abrir_lista_aprovados(p_area, p_versao, p_com_candidatos): a abertura numa chamada.
    - pacote: listar_candidatos_aprovados_compacto(p_area, p_versao) — o instantâneo
      private."TA_CANDIDATO_APROVADO_AREA" que já existe, com a versão que a tela ou a cópia do
      navegador já tem (sem mudança, volta só { inalterado: true });
    - listas: as colunas de listar_listas_aprovados, só dos editais da área (a tela já recortava
      pela área; a contagem de candidatos passa a ser só das listas da área);
    - modelos e configs: listar_modelos_convocacao() e listar_configuracao_convocacao(), como são;
    - anexos: as colunas de listar_anexos_candidatos_aprovados, só da área;
    - convocacoes: listar_convocacoes_aprovados(p_area), como é;
    - pendencias: listar_pendencias_do_edital(p_area), como é (o selo da aba).
  Cada parte valida a permissão de sempre (pode_recurso, FC_AREAS_USUARIO, FC_EDITAIS_VISIVEIS,
  o administrador global passa como antes) e, se falhar, volta em erros.<parte> com o código e a
  mensagem de sempre, sem derrubar as outras — como as chamadas separadas. Nada é gravado aqui
  além do que listar_candidatos_aprovados_compacto já grava (a remontagem do instantâneo vencido).

  As funções antigas ficam: o front cai nelas se esta migration ainda não estiver aplicada.

  ENSAIO: supabase/ensaios/20261029133000_abrir_lista_aprovados_numa_chamada.sql (cada parte comparada com a RPC de sempre, como administrador
  global em duas áreas e como Gestor na área dele; área inválida; versão que continua valendo).
  ROLLBACK: supabase/rollback/20261029133000_abrir_lista_aprovados_numa_chamada.sql.
*/
begin;

set local lock_timeout = '5s';

do $$
begin
  if to_regprocedure('public.listar_candidatos_aprovados_compacto(text, text)') is null
     or to_regprocedure('public.listar_modelos_convocacao()') is null
     or to_regprocedure('public.listar_configuracao_convocacao()') is null
     or to_regprocedure('public.listar_convocacoes_aprovados(text)') is null
     or to_regprocedure('public.listar_pendencias_do_edital(text, uuid)') is null
     or to_regclass('private."TA_CANDIDATO_APROVADO_AREA"') is null then
    raise exception 'Faltam as RPCs da Lista de aprovados (pacote por área, convocação, pendências).';
  end if;
end;
$$;

create or replace function public.abrir_lista_aprovados(
  p_area text,
  p_versao text default null,
  p_com_candidatos boolean default true
)
 returns json
 language plpgsql
 security definer
 set search_path to ''
 set statement_timeout to '20s'
as $function$
declare
  v_area text := lower(btrim(coalesce(p_area, '')));
  v_pacote json;
  v_listas json;
  v_modelos json;
  v_configs json;
  v_anexos json;
  v_convocacoes json;
  v_pendencias jsonb;
  v_erros jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sessao nao localizada.' using errcode = '28000';
  end if;

  -- Cada parte com a permissão e o erro de sempre: a falha de uma não derruba as outras.

  -- 1. Os candidatos da área: o pacote do instantâneo (private."TA_CANDIDATO_APROVADO_AREA").
  if p_com_candidatos then
    begin
      v_pacote := public.listar_candidatos_aprovados_compacto(v_area, p_versao);
    exception when others then
      v_erros := v_erros || jsonb_build_object('pacote', jsonb_build_object('code', sqlstate, 'message', sqlerrm));
    end;
  end if;

  -- 2. As listas da área (as colunas de listar_listas_aprovados, só os editais da área).
  begin
    if not (private.pode_recurso('aprovados') or private.pode_recurso('importacao', 2)) then
      raise exception 'Sem permissão para este recurso' using errcode = '42501';
    end if;
    select coalesce(json_agg(json_build_object(
             'lista_id', x.id, 'edital_id', x.edital_id, 'edital', x.edital,
             'unidade', x.unidade, 'ativo', x.ativo, 'arquivo_nome', x.arquivo_nome,
             'arquivo_path', x.arquivo_path, 'importado_em', x.importado_em,
             'total_candidatos', x.total, 'importado_por_email', x.email,
             'importado_por_nome', x.nome, 'origem', x.origem,
             'lista_classificacao_id', x.classificacao)
           order by x.edital, x.unidade), '[]'::json)
      into v_listas
      from (
        select l.id, l.edital_id, m.edital, m.unidade, l.ativo, l.arquivo_nome,
               l.arquivo_path, l.importado_em,
               (select count(*) from public."TB_CANDIDATO_APROVADO" c
                 where c.lista_id = l.id and c.removido_em is null) as total,
               l."DS_EMAIL_IMPORTACAO"::text as email, l."NO_USUARIO_IMPORTACAO"::text as nome,
               l."TP_ORIGEM"::text as origem, l."CO_LISTA_CLASSIFICACAO" as classificacao
          from public."TB_LISTA_APROVADO" l
          join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
         where l.vigente is true
           and m."CO_AREA" = v_area
           and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
           and ((select private."FC_EDITAIS_VISIVEIS"()) is null
                or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
      ) x;
  exception when others then
    v_erros := v_erros || jsonb_build_object('listas', jsonb_build_object('code', sqlstate, 'message', sqlerrm));
  end;

  -- 3. A configuração de convocação (modelos e editais), como as duas RPCs a devolvem.
  begin
    select coalesce(json_agg(m), '[]'::json) into v_modelos from public.listar_modelos_convocacao() m;
    select coalesce(json_agg(c), '[]'::json) into v_configs from public.listar_configuracao_convocacao() c;
  exception when others then
    v_modelos := null;
    v_configs := null;
    v_erros := v_erros || jsonb_build_object('configuracao', jsonb_build_object('code', sqlstate, 'message', sqlerrm));
  end;

  if p_com_candidatos then
    -- 4. Os anexos dos candidatos da área (as colunas de listar_anexos_candidatos_aprovados).
    begin
      if not private.pode_recurso('aprovados', 1) then
        raise exception 'Sem permissão para este recurso' using errcode = '42501';
      end if;
      select coalesce(json_agg(json_build_object(
               'anexo_id', a."CO_ANEXO", 'candidato_id', a."CO_CANDIDATO",
               'arquivo_nome', a."NO_ARQUIVO", 'tamanho', a."QT_TAMANHO_BYTES",
               'incluido_em', a."DT_INCLUSAO")
             order by a."CO_CANDIDATO", a."DT_INCLUSAO"), '[]'::json)
        into v_anexos
        from public."TB_ANEXO_CANDIDATO_APROVADO" a
        join public."TB_CANDIDATO_APROVADO" c on c.id = a."CO_CANDIDATO"
        join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
       where l.vigente is true
         and c.removido_em is null
         and m."CO_AREA" = v_area
         and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
         and ((select private."FC_EDITAIS_VISIVEIS"()) is null
              or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]));
    exception when others then
      v_erros := v_erros || jsonb_build_object('anexos', jsonb_build_object('code', sqlstate, 'message', sqlerrm));
    end;

    -- 5. A data da convocação e as cartas de cada candidato da área.
    begin
      v_convocacoes := public.listar_convocacoes_aprovados(v_area);
    exception when others then
      v_erros := v_erros || jsonb_build_object('convocacoes', jsonb_build_object('code', sqlstate, 'message', sqlerrm));
    end;
  end if;

  -- 6. As pendências da área (o selo da aba Pendências).
  begin
    v_pendencias := public.listar_pendencias_do_edital(v_area, null);
  exception when others then
    v_erros := v_erros || jsonb_build_object('pendencias', jsonb_build_object('code', sqlstate, 'message', sqlerrm));
  end;

  return json_build_object(
    'formato', 1,
    'area', v_area,
    'pacote', v_pacote,
    'listas', v_listas,
    'modelos', v_modelos,
    'configs', v_configs,
    'anexos', v_anexos,
    'convocacoes', v_convocacoes,
    'pendencias', v_pendencias,
    'erros', v_erros
  );
end;
$function$;

comment on function public.abrir_lista_aprovados(text, text, boolean) is
  'A abertura da Lista de aprovados numa chamada: o pacote da área (listar_candidatos_aprovados_compacto, do instantâneo private."TA_CANDIDATO_APROVADO_AREA"), as listas da área, a configuração de convocação, os anexos e as convocações da área e as pendências. Cada parte com a permissão e o erro de sempre, em erros.<parte>; a falha de uma não derruba as outras.';

revoke all on function public.abrir_lista_aprovados(text, text, boolean) from public, anon;
grant execute on function public.abrir_lista_aprovados(text, text, boolean) to authenticated;

commit;
