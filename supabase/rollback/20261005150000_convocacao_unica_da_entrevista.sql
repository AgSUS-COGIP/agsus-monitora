-- Desfaz 20261005150000_convocacao_unica_da_entrevista: volta o ranking próprio de
-- Entrevistas › Conduzir (obter_entrevistas_do_edital de 20260930233000), a
-- configuração com regra de convocação e vagas imediatas (20260930220000) e a
-- convocar_para_entrevista(p_edital, p_analises) de dois argumentos.
-- Nada se perde: os convocados e as notas lançados ficam em TB_ENTREVISTA; o que
-- havia em DS_CONVOCACAO e TB_ENTREVISTA_VAGA continua lá (a migration não apagou).
-- Volte junto o front anterior (a tela nova chama a convocar de três argumentos).
begin;

drop function if exists public.convocar_para_entrevista(uuid, uuid, uuid[]);

create or replace function public.obter_entrevistas_do_edital(p_edital uuid)
 returns json
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_ENTREVISTAS_EDITAL"(p_edital, 1);
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_cfg public."TB_ENTREVISTA_EDITAL";
  v_eu uuid;
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  select * into v_cfg from public."TB_ENTREVISTA_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  select p.id into v_eu from private.current_profile() p;
  return json_build_object(
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade, 'area', v_area),
    'pode_editar', private.pode_recurso('entrevistas', 2),
    'admin_global', private.is_master(),
    'meu_perfil', v_eu,
    'configuracao', case when v_cfg."CO_MONITORAMENTO" is null then null else json_build_object(
        'roteiro', private."FC_ROTEIRO_JSON"(v_cfg."CO_ROTEIRO"), 'convocacao', v_cfg."DS_CONVOCACAO",
        'banca', v_cfg."DS_BANCA", 'lancamento', v_cfg."TP_LANCAMENTO", 'atualizado_em', v_cfg."DT_ATUALIZACAO") end,
    'vagas', coalesce((
      select json_agg(json_build_object('vaga', v.codigo_vaga, 'cargo', v.cargo, 'aprovados', v.aprovados,
               'vagas_imediatas', coalesce(v.manual, v.do_quadro, v.da_lista),
               'vagas_imediatas_origem', case when v.manual is not null then 'manual' when v.do_quadro is not null then 'quadro'
                                              when v.da_lista is not null then 'lista' end,
               'lotacao_quadro', v.lotacao_quadro,
               'vagas_imediatas_salvas', v.manual is not null) order by v.cargo)
        from (select x.*, ev."QT_VAGA_IMEDIATA" manual, qv."QT_VAGA_IMEDIATA" do_quadro,
                     nullif(concat_ws(' — ', qv."NO_CARGO", qv."NO_LOTACAO"), '') lotacao_quadro,
                     (select vi."QT_VAGA_IMEDIATA" from public."TB_VAGA_IMEDIATA" vi
                       where vi."CO_EDITAL" = p_edital::text and (vi."CO_VAGA" = x.codigo_vaga or upper(vi."NO_CARGO") = upper(x.cargo)) limit 1) da_lista
                from (select a.codigo_vaga, min(a.nome_vaga) cargo, count(*) filter (where a.status_consolidado = 'Aprovado') aprovados
                        from public."TB_ANALISE_CURRICULAR" a
                       where a."CO_AREA" = v_area and a.ativo
                         and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(v_m.edital)
                       group by a.codigo_vaga) x
                left join public."TB_ENTREVISTA_VAGA" ev on ev."CO_MONITORAMENTO" = p_edital and ev."CO_VAGA" = x.codigo_vaga
                left join public."TB_QUADRO_VAGA_EDITAL" qv on qv."CO_QUADRO_VAGA" = private."FC_QUADRO_DA_VAGA"(p_edital, x.cargo)) v), '[]'::json),
    'candidatos', coalesce((
      select json_agg(json_build_object('analise_id', c.id, 'candidato', c.candidato, 'codigo', c.id_origem,
               'vaga', c.codigo_vaga, 'cargo', c.nome_vaga, 'nota_analise', c.nota_final_ajustada,
               'modalidade', c.modalidade_concorrencia, 'pcd', c.pcd, 'posicao', c.posicao)
             order by c.codigo_vaga, c.posicao)
        from (select a.*, row_number() over (partition by a.codigo_vaga
                                             order by a.nota_final_ajustada desc nulls last, a.candidato) posicao
                from public."TB_ANALISE_CURRICULAR" a
               where a."CO_AREA" = v_area and a.ativo and a.status_consolidado = 'Aprovado'
                 and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(v_m.edital)) c), '[]'::json),
    'avaliadores', coalesce((
      select json_agg(json_build_object('id', b."CO_AVALIADOR", 'nome', b."NO_AVALIADOR", 'origem', b."NO_ORIGEM",
               'banca', b."NU_BANCA", 'perfil', b."CO_PERFIL_USUARIO", 'ativo', b."ST_ATIVO" = 'S') order by b."NU_BANCA", b."NO_ORIGEM", b."NO_AVALIADOR")
        from public."TB_ENTREVISTA_AVALIADOR" b where b."CO_MONITORAMENTO" = p_edital), '[]'::json),
    'convocados', coalesce((
      select json_agg(json_build_object('id', e."CO_ENTREVISTA", 'analise_id', e."CO_ANALISE_CURRICULAR",
               'candidato', e."NO_CANDIDATO", 'codigo', e."CO_CANDIDATO", 'vaga', e."CO_VAGA", 'cargo', e."NO_CARGO",
               'modalidade', e."DS_MODALIDADE", 'banca', e."NU_BANCA", 'compareceu', e."ST_COMPARECEU",
               'nota', e."VL_NOTA_TOTAL", 'parecer', e."TP_PARECER", 'nota_analise', a.nota_final_ajustada,
               'avaliacoes', coalesce((select json_agg(json_build_object('competencia', x."CO_COMPETENCIA",
                      'avaliador', x."CO_AVALIADOR", 'nota', x."VL_NOTA"))
                   from public."TB_ENTREVISTA_AVALIACAO" x where x."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json),
               'notas', coalesce((select json_agg(json_build_array(n."NU_ORDEM", n."VL_NOTA") order by n."NU_ORDEM")
                   from public."TB_ENTREVISTA_NOTA" n where n."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json))
             order by e."CO_VAGA", e."NO_CANDIDATO")
        from public."TB_ENTREVISTA" e
        left join public."TB_ANALISE_CURRICULAR" a on a.id = e."CO_ANALISE_CURRICULAR"
       where e."CO_MONITORAMENTO" = p_edital and e."TP_ORIGEM" = 'sistema' and e."ST_ATIVO" = 'S'), '[]'::json)
  );
end;
$function$;
comment on function public.obter_entrevistas_do_edital(uuid) is 'Tudo para conduzir a entrevista de um edital: configuração (roteiro, convocação, banca), vagas com vagas imediatas, candidatos aprovados na análise (com posição por vaga), banca e convocados com as notas.';

create or replace function public.configurar_entrevista_edital(p_edital uuid, p_dados jsonb)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_ENTREVISTAS_EDITAL"(p_edital, 2);
  v_roteiro uuid := nullif(p_dados ->> 'roteiro', '')::uuid;
  v jsonb;
  b jsonb;
begin
  if v_roteiro is null or not exists (select 1 from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO" = v_roteiro) then
    raise exception 'Escolha um roteiro' using errcode = '22023';
  end if;
  if exists (select 1 from public."TB_ENTREVISTA" e join public."TB_ENTREVISTA_AVALIACAO" x on x."CO_ENTREVISTA" = e."CO_ENTREVISTA"
              where e."CO_MONITORAMENTO" = p_edital and e."CO_ROTEIRO" is distinct from v_roteiro) then
    raise exception 'Já há notas lançadas com outro roteiro neste edital; o roteiro não pode mais ser trocado' using errcode = '23514';
  end if;
  insert into public."TB_ENTREVISTA_EDITAL" ("CO_MONITORAMENTO", "CO_ROTEIRO", "DS_CONVOCACAO", "DS_BANCA", "TP_LANCAMENTO", "CO_USUARIO_ATUALIZACAO")
  values (p_edital, v_roteiro, coalesce(p_dados -> 'convocacao', '{}'), coalesce(p_dados -> 'banca', '[]'),
          coalesce(nullif(p_dados ->> 'lancamento', ''), 'SECRETARIA'), (select auth.uid()))
  on conflict ("CO_MONITORAMENTO") do update set
    "CO_ROTEIRO" = excluded."CO_ROTEIRO", "DS_CONVOCACAO" = excluded."DS_CONVOCACAO", "DS_BANCA" = excluded."DS_BANCA",
    "TP_LANCAMENTO" = excluded."TP_LANCAMENTO", "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = excluded."CO_USUARIO_ATUALIZACAO";

  update public."TB_ENTREVISTA" set "CO_ROTEIRO" = v_roteiro
   where "CO_MONITORAMENTO" = p_edital and "TP_ORIGEM" = 'sistema' and "CO_ROTEIRO" is distinct from v_roteiro;

  for v in select value from jsonb_array_elements(coalesce(p_dados -> 'vagas', '[]')) loop
    insert into public."TB_ENTREVISTA_VAGA" ("CO_MONITORAMENTO", "CO_VAGA", "QT_VAGA_IMEDIATA")
    values (p_edital, v ->> 'vaga', greatest(coalesce((v ->> 'vagas_imediatas')::integer, 0), 0))
    on conflict ("CO_MONITORAMENTO", "CO_VAGA") do update set "QT_VAGA_IMEDIATA" = excluded."QT_VAGA_IMEDIATA";
  end loop;

  -- Banca: membros enviados (com id = atualiza; sem id = novo); os que não vieram saem (ST_ATIVO N).
  if jsonb_typeof(p_dados -> 'avaliadores') = 'array' then
    update public."TB_ENTREVISTA_AVALIADOR" a set "ST_ATIVO" = 'N'
     where a."CO_MONITORAMENTO" = p_edital and a."ST_ATIVO" = 'S'
       and not exists (select 1 from jsonb_array_elements(p_dados -> 'avaliadores') x where nullif(x ->> 'id', '')::uuid = a."CO_AVALIADOR");
    for b in select value from jsonb_array_elements(p_dados -> 'avaliadores') loop
      if nullif(b ->> 'id', '') is not null then
        update public."TB_ENTREVISTA_AVALIADOR" set "NO_AVALIADOR" = btrim(b ->> 'nome'), "NO_ORIGEM" = btrim(b ->> 'origem'),
               "NU_BANCA" = coalesce(nullif(b ->> 'banca', '')::smallint, 1), "CO_PERFIL_USUARIO" = nullif(b ->> 'perfil', '')::uuid, "ST_ATIVO" = 'S'
         where "CO_AVALIADOR" = (b ->> 'id')::uuid and "CO_MONITORAMENTO" = p_edital;
      else
        insert into public."TB_ENTREVISTA_AVALIADOR" ("CO_MONITORAMENTO", "NO_AVALIADOR", "NO_ORIGEM", "NU_BANCA", "CO_PERFIL_USUARIO")
        values (p_edital, btrim(b ->> 'nome'), btrim(b ->> 'origem'), coalesce(nullif(b ->> 'banca', '')::smallint, 1), nullif(b ->> 'perfil', '')::uuid);
      end if;
    end loop;
  end if;

  return public.obter_entrevistas_do_edital(p_edital);
end;
$function$;
comment on function public.configurar_entrevista_edital(uuid, jsonb) is 'Grava a configuração da entrevista do edital: roteiro, convocação, banca, modo de lançamento, vagas imediatas e membros da banca. entrevistas >= editor e o edital.';
revoke all on function public.configurar_entrevista_edital(uuid, jsonb) from public, anon;
grant execute on function public.configurar_entrevista_edital(uuid, jsonb) to authenticated, service_role;

create function public.convocar_para_entrevista(p_edital uuid, p_analises uuid[])
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_ENTREVISTAS_EDITAL"(p_edital, 2);
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_roteiro uuid;
  v_qt integer;
begin
  select "CO_ROTEIRO" into v_roteiro from public."TB_ENTREVISTA_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  if v_roteiro is null then raise exception 'Configure a entrevista do edital antes de convocar' using errcode = '23514'; end if;
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  if coalesce(cardinality(p_analises), 0) not between 1 and 2000 then raise exception 'Escolha de 1 a 2000 candidatos' using errcode = '22023'; end if;

  insert into public."TB_ENTREVISTA" as e ("CO_AREA", "CO_MONITORAMENTO", "CO_ANALISE_CURRICULAR", "TP_LIGACAO_ANALISE",
    "NO_UNIDADE", "DS_EDITAL", "CO_VAGA", "NO_CANDIDATO", "CO_CANDIDATO", "DS_MODALIDADE", "NO_CARGO", "TP_PARECER",
    "TP_ORIGEM", "DS_CHAVE_ORIGEM", "CO_ROTEIRO", "ST_ATIVO")
  select v_area, p_edital, a.id, 'codigo', left(coalesce(v_m.unidade, ''), 200), left(v_m.edital, 120), left(a.codigo_vaga, 60),
         left(a.candidato, 200), left(a.id_origem, 60), left(a.modalidade_concorrencia, 300), left(a.nome_vaga, 400), 'SEM_PARECER',
         'sistema', 'sistema|' || p_edital || '|' || a.id, v_roteiro, 'S'
    from public."TB_ANALISE_CURRICULAR" a
   where a.id = any (p_analises) and a."CO_AREA" = v_area
     and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(v_m.edital)
  on conflict ("DS_CHAVE_ORIGEM") do update set "ST_ATIVO" = 'S', "CO_ROTEIRO" = excluded."CO_ROTEIRO", "DT_ATUALIZACAO" = now();
  get diagnostics v_qt = row_count;

  insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "DS_CAMPO", "DS_VALOR_NOVO", "CO_USUARIO")
  select e."CO_ENTREVISTA", 'convocacao', 'convocado', (select auth.uid())
    from public."TB_ENTREVISTA" e where e."DS_CHAVE_ORIGEM" = any (select 'sistema|' || p_edital || '|' || x from unnest(p_analises) x);

  return json_build_object('convocados', v_qt, 'dados', public.obter_entrevistas_do_edital(p_edital));
end;
$function$;
comment on function public.convocar_para_entrevista(uuid, uuid[]) is 'Convoca candidatos aprovados na análise curricular do edital para a entrevista (TB_ENTREVISTA, TP_ORIGEM sistema). Idempotente. entrevistas >= editor.';
revoke all on function public.convocar_para_entrevista(uuid, uuid[]) from public, anon;
grant execute on function public.convocar_para_entrevista(uuid, uuid[]) to authenticated, service_role;

drop function if exists private."FC_CONVOCADOS_DA_LISTA"(uuid);
drop function if exists private."FC_LISTA_CONVOCACAO_VIGENTE"(uuid);

comment on table public."TB_ENTREVISTA_VAGA" is 'Vagas de provimento imediato por vaga de um edital (0 = só cadastro reserva), para sugerir os convocados.';
comment on table public."TB_ENTREVISTA_EDITAL" is 'Configuração da entrevista de um edital: roteiro (versão exata), convocação, banca e quem lança as notas.';
comment on column public."TB_ENTREVISTA_EDITAL"."DS_CONVOCACAO" is 'Regra de convocação deste edital (mesmo formato de DS_CONVOCACAO_PADRAO).';
comment on column public."TB_ROTEIRO_ENTREVISTA"."DS_CONVOCACAO_PADRAO" is 'Regra de convocação sugerida ao edital: {multiplo_imediatas, posicao_cadastro_reserva, excecoes:[{termo_cargo, multiplo_imediatas, posicao_cadastro_reserva}]}.';

commit;
