/*
  ENSAIO de 20261007190000_painel_dos_robos.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (sem o
  begin/commit dela) e confere:
    E1  a função existe, é SECURITY DEFINER e só authenticated executa;
    E2  quem não é administrador global é barrado (42501);
    E3  como um administrador global de verdade (o primeiro perfil ativo com
        grupo ST_ADMIN_GLOBAL, sem mostrar quem): as chaves do painel, editais
        com número, vagas só com dígitos e nenhum dado de candidato
        (nem e-mail, nem CPF, nem nome de candidato) no json.
  Termina em ROLLBACK e só mostra contagens.
*/
begin;

-- Corpo de supabase/migrations/20261007190000_painel_dos_robos.sql (sem begin/commit):
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

do $$
declare
  f text;
begin
  foreach f in array array['public.get_painel_dos_robos()', 'public.listar_vagas_dos_robos(uuid[], text[])'] loop
    if not (select p.prosecdef from pg_proc p where p.oid = f::regprocedure) then
      raise exception 'FALHOU E1: % sem SECURITY DEFINER', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then
      raise exception 'FALHOU E1: anon executa %', f;
    end if;
    if not has_function_privilege('authenticated', f, 'execute') then
      raise exception 'FALHOU E1: authenticated não executa %', f;
    end if;
  end loop;
  raise notice 'ok E1';
end;
$$;

set local role authenticated;
do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-a000-0000000000e1","role":"authenticated","email":"ensaio.painel@ensaio.invalid"}', true);
  begin
    perform public.get_painel_dos_robos();
    raise exception 'FALHOU E2: quem não é administrador leu o painel';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform public.listar_vagas_dos_robos(null, array['177979']);
    raise exception 'FALHOU E2: quem não é administrador leu as vagas';
  exception when sqlstate '42501' then null;
  end;
  raise notice 'ok E2';
end;
$$;
reset role;

select set_config('ensaio.admin', (
  select p.user_id::text from public."TB_PERFIL_USUARIO" p
    join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
   where p.ativo is true and a."ST_ADMIN_GLOBAL" and p.user_id is not null
   order by p.user_id limit 1), true);
-- O edital com mais vagas da Empregare conhecidas (para E3).
select set_config('ensaio.edital', (
  select v."CO_MONITORAMENTO"::text from public."TB_EMPREGARE_VAGA" v
   where v."CO_MONITORAMENTO" is not null
   group by 1 order by count(*) desc limit 1), true);

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('ensaio.admin'), 'role', 'authenticated')::text, true);

do $$
begin
  begin
    perform public.listar_vagas_dos_robos(null, array['17797x']);
    raise exception 'FALHOU E3: aceitou código com letra';
  exception when sqlstate '22023' then null;
  end;
  if json_array_length(public.listar_vagas_dos_robos(null, null)) <> 0 then
    raise exception 'FALHOU E3: sem filtro devolveu vagas';
  end if;
  raise notice 'ok E3.1';
end;
$$;

with painel as (select public.get_painel_dos_robos() as j),
     doedital as (select public.listar_vagas_dos_robos(array[current_setting('ensaio.edital')::uuid], null) as v),
     doscodigos as (select public.listar_vagas_dos_robos(null, array['177979', '99999999999']) as v)
select
  (select count(*) from json_array_elements(j -> 'areas')) as areas,
  (select count(*) from json_array_elements(j -> 'editais')) as editais,
  (select count(*) from json_array_elements(j -> 'editais') e where e ->> 'numero' !~ '^[0-9]{1,4}/[0-9]{4}$') as editais_sem_numero,
  (select count(*) from json_array_elements(j -> 'empregare')) as execucoes_robo,
  (select count(*) from json_array_elements(j -> 'empregare') e, json_array_elements(e -> 'por_vaga')) as por_vaga,
  (select count(*) from json_array_elements(j -> 'empregare') e where e ->> 'quem' is not null) as robo_com_quem,
  (select count(*) from json_array_elements(j -> 'pre_classificacao')) as execucoes_precl,
  j::text ~* '@|"cpf"|"email"' as painel_com_dado_pessoal,
  length(j::text) as tamanho_do_painel,
  (select json_array_length(v) from doedital) as vagas_do_edital,
  (select count(*) from doedital, json_array_elements(v) x where x ->> 'cargo' is null) as vagas_sem_cargo,
  (select length(v::text) from doedital) as tamanho_das_vagas,
  (select json_array_length(v) from doscodigos) as vagas_pelos_codigos
  from painel;

rollback;
