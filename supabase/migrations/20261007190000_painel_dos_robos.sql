/*
  PAINEL DOS ROBÔS: "RODAR COM OPÇÕES" E AS ÚLTIMAS EXECUÇÕES

  Configurações › Status das atualizações ganhou, no robô da Empregare, na
  pré-classificação e nas conferências, o "Rodar com opções" (editais, códigos
  de vaga, modo e limite; api/rodar-carga.js) e o histórico curto de cada robô
  com os parâmetros usados e quem pediu. Esta migration só LÊ: nenhuma tabela
  nova nem coluna nova — o robô já grava o filtro (TL_SYNC_EMPREGARE.DS_FILTRO)
  e a pré-classificação o pedido (TL_PRE_CLASSIFICACAO.DS_PEDIDO), cada um com
  quem disparou (CO_USUARIO_DISPARO).

  get_painel_dos_robos() (json; só administrador global, como a seção):
    areas       as áreas do sistema (TB_AREA), para agrupar os editais;
    editais     todos os editais (id, número, área, unidade, ativo, status) — a
                tela mostra só os vigentes por padrão, pela regra da Avaliação
                documental (src/lib/avaliacao-documental/editais.js);
    empregare   as 8 últimas execuções do robô: filtro, forçada, quem pediu
                (nome do perfil), contagens, endereço no GitHub e, por vaga
                cuja última carga foi aquela execução, situação, candidatos no
                arquivo, ativos e quantos com link da Empregare;
    pre_classificacao  as 8 últimas: pedido, refazer lote, quem pediu,
                contagens e endereço no GitHub.

  listar_vagas_dos_robos(p_editais uuid[], p_vagas text[]) (json; idem):
    as vagas da Empregare conhecidas dos editais escolhidos ou dos códigos
    colados, das mesmas fontes do robô (quadro do edital, Seleção) e das já
    carregadas (TB_EMPREGARE_VAGA): código, edital, cargo, última carga,
    situação e ativos — as sugestões e a prévia do campo "Vagas". Fica fora
    do painel porque são milhares de vagas: a tela pede só as do edital.

  DADO PESSOAL: nenhum candidato sai daqui — por vaga, só contagens. "Quem
  pediu" é o nome do perfil de quem clicou, só para o administrador global.

  Pré-requisitos: 20261006080000 (vagas do quadro), 20261006110000
  (pré-classificação) e 20261007160000 (links da Empregare).
  Ensaio: supabase/ensaios/20261007190000_painel_dos_robos.sql
  Rollback: supabase/rollback/20261007190000_painel_dos_robos.sql
*/
begin;

do $$
begin
  if to_regprocedure('private."FC_EMPREGARE_VAGAS_DO_QUADRO"(text)') is null then
    raise exception 'Aplique antes 20261006080000_robo_empregare_vagas_do_quadro.sql.';
  end if;
  if to_regclass('public."TL_PRE_CLASSIFICACAO"') is null then
    raise exception 'Aplique antes 20261006110000_pre_classificacao_e_lote.sql.';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'TB_EMPREGARE_CANDIDATO'
                    and column_name = 'DS_LINK_DETALHE') then
    raise exception 'Aplique antes 20261007160000_link_do_candidato_na_empregare.sql.';
  end if;
end;
$$;

create function public.get_painel_dos_robos()
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not private.is_master() then
    raise exception 'Somente o administrador global vê o painel dos robôs' using errcode = '42501';
  end if;

  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'areas', (
      select coalesce(json_agg(json_build_object('area', a."CO_AREA", 'nome', a."NO_AREA")
               order by a."NU_ORDEM"), '[]'::json)
        from public."TB_AREA" a
    ),
    'editais', (
      select coalesce(json_agg(json_build_object(
               'id', m.id, 'edital', m.edital, 'numero', private."FC_NUMERO_EDITAL"(m.edital),
               'area', m."CO_AREA", 'unidade', m.unidade, 'ativo', m.ativo, 'status', m.status)
             order by m."CO_AREA", private."FC_NUMERO_EDITAL"(m.edital) desc nulls last), '[]'::json)
        from public."TB_MONITORAMENTO_INDIGENA" m
       where private."FC_NUMERO_EDITAL"(m.edital) is not null
    ),
    'empregare', (
      select coalesce(json_agg(json_build_object(
               'id', e."CO_SYNC",
               'inicio', e."DT_INICIO", 'fim', e."DT_FIM", 'situacao', e."TP_SITUACAO",
               'disparo', e."TP_DISPARO",
               'quem', case when e."CO_USUARIO_DISPARO" is null then null
                            else coalesce(nullif(btrim(p.nome), ''), 'Usuário do MONITORA') end,
               'filtro', e."DS_FILTRO", 'forcada', e."ST_FORCADA" = 'S',
               'vagas_pedidas', e."QT_VAGA_PEDIDA", 'vagas_baixadas', e."QT_VAGA_BAIXADA",
               'vagas_falha', e."QT_VAGA_FALHA", 'vagas_recusadas', e."QT_VAGA_RECUSADA",
               'linhas', e."QT_LINHA", 'desativadas', e."QT_DESATIVADA",
               'mensagem', e."DS_MENSAGEM", 'execucao', e."DS_URL_EXECUCAO",
               'por_vaga', (
                 select coalesce(json_agg(json_build_object(
                          'vaga', v."CO_VAGA", 'situacao', v."TP_SITUACAO",
                          'arquivo', v."QT_LINHA_ARQUIVO", 'ativos', v."QT_CANDIDATO_ATIVO",
                          'com_link', (select count(*) from public."TB_EMPREGARE_CANDIDATO" c
                                        where c."CO_VAGA" = v."CO_VAGA" and c."ST_REGISTRO_ATIVO" = 'S'
                                          and c."DS_LINK_DETALHE" is not null),
                          'mensagem', left(v."DS_MENSAGEM", 300))
                        order by v."CO_VAGA"), '[]'::json)
                   from public."TB_EMPREGARE_VAGA" v
                  where v."CO_SYNC" = e."CO_SYNC"
               )
             ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_EMPREGARE" t order by t."DT_INICIO" desc limit 8) e
        left join public."TB_PERFIL_USUARIO" p on p.user_id = e."CO_USUARIO_DISPARO"
    ),
    'pre_classificacao', (
      select coalesce(json_agg(json_build_object(
               'id', x."CO_EXECUCAO",
               'inicio', x."DT_INICIO", 'fim', x."DT_FIM", 'situacao', x."TP_SITUACAO",
               'disparo', x."TP_DISPARO",
               'quem', case when x."CO_USUARIO_DISPARO" is null then null
                            else coalesce(nullif(btrim(p.nome), ''), 'Usuário do MONITORA') end,
               'pedido', x."DS_PEDIDO", 'refazer', x."ST_REFAZER_LOTE" = 'S',
               'editais', x."QT_EDITAL", 'vagas', x."QT_VAGA", 'inscritos', x."QT_INSCRITO",
               'lote', x."QT_LOTE", 'mensagem', x."DS_MENSAGEM", 'execucao', x."DS_URL_EXECUCAO"
             ) order by x."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_PRE_CLASSIFICACAO" t order by t."DT_INICIO" desc limit 8) x
        left join public."TB_PERFIL_USUARIO" p on p.user_id = x."CO_USUARIO_DISPARO"
    )
  );
end;
$function$;
comment on function public.get_painel_dos_robos() is
  'Painel dos robôs (Configurações › Status das atualizações, só administrador global): áreas, editais (com status, para a regra de vigente) e as 8 últimas execuções do robô da Empregare (filtro, quem pediu, contagens e, por vaga, situação, candidatos e quantos com link) e da pré-classificação (pedido, quem pediu, contagens). Nenhum dado de candidato. Só leitura.';
revoke all on function public.get_painel_dos_robos() from public, anon;
grant execute on function public.get_painel_dos_robos() to authenticated;

create function public.listar_vagas_dos_robos(p_editais uuid[] default null, p_vagas text[] default null)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_editais uuid[] := coalesce(p_editais, '{}');
  v_vagas text[] := coalesce(p_vagas, '{}');
begin
  if not private.is_master() then
    raise exception 'Somente o administrador global vê o painel dos robôs' using errcode = '42501';
  end if;
  if cardinality(v_editais) > 100 or cardinality(v_vagas) > 500 then
    raise exception 'Até 100 editais e 500 vagas por consulta' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_vagas) v where v !~ '^[0-9]{1,20}$') then
    raise exception 'Código de vaga inválido: use só dígitos' using errcode = '22023';
  end if;
  if cardinality(v_editais) = 0 and cardinality(v_vagas) = 0 then
    return '[]'::json;
  end if;

  return (
    with quadro as (
      select q.vaga, q.edital_id, q.cargo, 1 as prioridade
        from private."FC_EMPREGARE_VAGAS_DO_QUADRO"() q
    ),
    selecao as (
      select s."CO_VAGA" as vaga, s."CO_MONITORAMENTO" as edital_id, s."NO_CARGO" as cargo, 2 as prioridade
        from public."TB_SELECAO_VAGA" s
       where s."ST_REGISTRO_ATIVO" = 'S' and s."CO_VAGA" ~ '^[0-9]{1,20}$'
    ),
    carregadas as (
      select v."CO_VAGA" as vaga, v."CO_MONITORAMENTO" as edital_id, null::text as cargo, 3 as prioridade
        from public."TB_EMPREGARE_VAGA" v
    ),
    todas as (
      select distinct on (f.vaga) f.vaga, f.edital_id, f.cargo
        from (select * from quadro union all select * from selecao union all select * from carregadas) f
       order by f.vaga, (f.edital_id is null), f.prioridade
    )
    select coalesce(json_agg(json_build_object(
             'vaga', t.vaga, 'edital_id', t.edital_id,
             'cargo', coalesce(t.cargo, (select min(s."NO_CARGO") from public."TB_SELECAO_VAGA" s
                                          where s."CO_VAGA" = t.vaga)),
             'ultima_carga', ev."DT_ULTIMA_CARGA", 'situacao', ev."TP_SITUACAO",
             'ativos', ev."QT_CANDIDATO_ATIVO")
           order by t.vaga), '[]'::json)
      from todas t
      left join public."TB_EMPREGARE_VAGA" ev on ev."CO_VAGA" = t.vaga
     where t.edital_id = any (v_editais) or t.vaga = any (v_vagas)
  );
end;
$function$;
comment on function public.listar_vagas_dos_robos(uuid[], text[]) is
  'Vagas da Empregare conhecidas dos editais pedidos (p_editais, ids) ou dos códigos pedidos (p_vagas, só dígitos), das mesmas fontes do robô (quadro do edital, Seleção) e das já carregadas (TB_EMPREGARE_VAGA): código, edital, cargo, última carga, situação e ativos. Sugestões do "Rodar com opções" (Status das atualizações, só administrador global). Até 100 editais e 500 vagas; sem filtro, lista vazia.';
revoke all on function public.listar_vagas_dos_robos(uuid[], text[]) from public, anon;
grant execute on function public.listar_vagas_dos_robos(uuid[], text[]) to authenticated;

commit;
