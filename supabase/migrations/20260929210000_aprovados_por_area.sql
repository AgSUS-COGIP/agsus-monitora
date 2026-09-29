/*
  LISTA DE APROVADOS POR ÁREA, COM DICIONÁRIO E PACOTE PRONTO

  ## O problema

  listar_candidatos_aprovados_compacto() devolvia de uma vez os candidatos de
  todas as áreas do usuário: 36.656 candidatos (112 listas), 9,8 MB de JSON,
  ~0,44 s no banco com picos de 7 s no servidor NANO. O admin recebia as três
  áreas, embora a tela mostre uma só. Cargo (~60 caracteres) e código da vaga
  (~47) vinham repetidos em cada candidato.

  ## O que muda

  - listar_candidatos_aprovados_compacto(p_area text default null,
    p_versao text default null):
    - p_area nulo: EXATAMENTE a resposta de antes (formato 1, todas as áreas do
      usuário, montada na hora) — é o que o front publicado pede até o deploy
      do front novo. Sai numa próxima migration, junto com o formato 1 do
      expansor em src/lib/candidatos-aprovados-compactos.js.
    - p_area informado (formato 2): só a área pedida. Área inexistente = 22023;
      área que não é do usuário = 42501. Mesmas checagens de permissão
      (pode_recurso + papel_recurso) e mesmo recorte por coordenação
      (FC_EDITAIS_VISIVEIS) da definição que estava no banco.
  - Formato 2 (dicionário): cargo, modalidade, status e código da vaga vão uma
    vez em `dicionarios`; a linha leva o índice (base 0). As listas vão num
    array (`listas`, com o id na primeira coluna) e a linha leva o índice da
    lista. O front remonta objetos idênticos aos do formato 1.
  - `versao`: assinatura barata dos dados da área (private."FC_VERSAO_APROVADOS_AREA").
    Se o front manda p_versao igual à atual, a resposta é só
    `{ formato, area, versao, inalterado: true }` — a cópia do navegador vale.

  ## Pacote pronto no servidor (quem vê a área inteira)

  private."TA_CANDIDATO_APROVADO_AREA" guarda, por área, o pacote formato 2 já
  montado e a versão lida ANTES da montagem. Só quem não tem recorte por
  coordenação (FC_EDITAIS_VISIVEIS() nulo) recebe o pronto; quem tem recorte
  recebe a lista montada na hora, só com o que pode ver.

  ## Quem escreve vê a própria mudança na hora (sem gatilho)

  A versão é calculada A CADA chamada, dos próprios dados (quantos e
  soma de hash do xmin das listas e dos candidatos das listas vigentes da área,
  e edital/unidade do monitoramento). Qualquer insert, update (status, sub
  judice, soft delete) ou delete muda o xmin ou a contagem — muda a versão —
  no mesmo commit que muda os dados. Por isso:
  - o pronto só é servido quando a versão dele é a de agora; senão a RPC
    remonta (sob trava consultiva por área) e, se a trava estiver com outra
    chamada ou a gravação falhar, monta na hora sem gravar. Ninguém recebe
    dado velho, nem quem acabou de escrever: não há "stale-while-cron" aqui.
  - as RPCs que escrevem (status, sub judice, importação, ativar/remover
    lista) NÃO mudam: não precisam invalidar nada.
  - a versão é lida ANTES de montar; um commit no meio deixa o pronto com
    dados mais novos que a versão gravada, e a próxima chamada remonta
    (nunca o contrário).
  - custo da versão: uma passada pelos ~47 mil candidatos (índice por lista),
    milissegundos, contra ~0,15 s por área para montar e ~1,5 MB por área.
  O pg_cron (agsus_aprovados_cache_por_area, a cada 2 min) remonta a área cuja
  versão mudou, para que a abertura seguinte à escrita de outra pessoa já
  encontre o pronto.

  O rollback está em supabase/rollback/.
*/
begin;

-- ---------------------------------------------------------------------------
-- 1. Tabela do pacote pronto
-- ---------------------------------------------------------------------------
create table private."TA_CANDIDATO_APROVADO_AREA" (
  "CO_AREA" text not null,
  "DS_LISTAS" json not null,
  "DS_DICIONARIOS" json not null,
  "DS_LINHAS" json not null,
  "QT_CANDIDATOS" integer not null,
  "DS_VERSAO_DADOS" text not null,
  "DT_GERACAO" timestamptz not null,
  "NU_DURACAO_MS" integer not null,
  constraint "PK_TA_CANDIDATO_APROVADO_AREA" primary key ("CO_AREA"),
  constraint "FK_AREA_CANDIDATO_APROVADO_AREA" foreign key ("CO_AREA")
    references public."TB_AREA" ("CO_AREA") on delete cascade
);

comment on table private."TA_CANDIDATO_APROVADO_AREA" is
  'Pacote pronto (formato 2) da lista de aprovados por área, para quem vê a área inteira. Só funções SECURITY DEFINER leem.';
comment on column private."TA_CANDIDATO_APROVADO_AREA"."DS_LISTAS" is 'Listas vigentes da área (array de arrays, colunas_da_lista do formato 2).';
comment on column private."TA_CANDIDATO_APROVADO_AREA"."DS_DICIONARIOS" is 'Valores distintos de cargo, modalidade, status e codigo_vaga; as linhas levam o índice.';
comment on column private."TA_CANDIDATO_APROVADO_AREA"."DS_LINHAS" is 'Candidatos em linhas posicionais (colunas do formato 2).';
comment on column private."TA_CANDIDATO_APROVADO_AREA"."QT_CANDIDATOS" is 'Quantidade de linhas (campo total).';
comment on column private."TA_CANDIDATO_APROVADO_AREA"."DS_VERSAO_DADOS" is
  'FC_VERSAO_APROVADOS_AREA lida antes da montagem; diferente da atual, o pacote não vale.';
comment on column private."TA_CANDIDATO_APROVADO_AREA"."DT_GERACAO" is 'Início da montagem.';
comment on column private."TA_CANDIDATO_APROVADO_AREA"."NU_DURACAO_MS" is 'Quanto a montagem levou, em milissegundos.';

alter table private."TA_CANDIDATO_APROVADO_AREA" enable row level security;
revoke all on private."TA_CANDIDATO_APROVADO_AREA" from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Versão dos dados da área
-- ---------------------------------------------------------------------------
create function private."FC_VERSAO_APROVADOS_AREA"(p_area text)
 returns text
 language sql
 stable
 set search_path to ''
as $function$
  with l as (
    select l.id,
           l.vigente,
           hashtext(l.xmin::text || '|' || coalesce(m.edital, '') || '|' || coalesce(m.unidade, ''))::bigint as h
      from public."TB_LISTA_APROVADO" l
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
     where m."CO_AREA" = p_area
  ), c as (
    select count(*) as n,
           count(*) filter (where c.removido_em is null) as vivos,
           coalesce(sum(hashtext(c.xmin::text)::bigint), 0) as s
      from public."TB_CANDIDATO_APROVADO" c
     where c.lista_id in (select l.id from l where l.vigente is true)
  )
  select (select count(*)::text || '.' || coalesce(sum(l.h), 0)::text from l)
         || '.' || c.n::text || '.' || c.vivos::text || '.' || c.s::text
    from c;
$function$;

comment on function private."FC_VERSAO_APROVADOS_AREA"(text) is
  'Assinatura dos dados da lista de aprovados da área (contagens e hash do xmin de listas e candidatos das listas vigentes, edital/unidade do monitoramento). Muda no mesmo commit de qualquer insert/update/delete.';

-- ---------------------------------------------------------------------------
-- 3. Montagem do formato 2 (sem checar permissão: quem chama já checou)
-- ---------------------------------------------------------------------------
create function private."FC_MONTAR_APROVADOS_AREA"(
  p_area text,
  p_editais uuid[],
  out p_listas json,
  out p_dicionarios json,
  out p_linhas json,
  out p_total integer
)
 language plpgsql
 stable
 set search_path to ''
 set work_mem to '64MB'
 set jit to 'off'
as $function$
begin
  with listas as (
    select l.id, l.edital_id, m.edital, m.unidade, l.ativo, l.arquivo_nome, l.importado_em,
           (row_number() over (order by m.edital, l.id) - 1)::integer as i
      from public."TB_LISTA_APROVADO" l
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
     where l.vigente is true
       and m."CO_AREA" = p_area
       and (p_editais is null or m.id = any (p_editais))
  ), cand as materialized (
    select c.id, li.i as lista, li.edital, c.cargo, c.classificacao, c.nota, c.nome,
           c.modalidade, c.status, c.processo_sei, c.matricula, c.sub_judice, c.codigo_vaga
      from listas li
      join public."TB_CANDIDATO_APROVADO" c on c.lista_id = li.id
     where c.removido_em is null
  ), d_cargo as (
    select x.v, (row_number() over (order by x.v) - 1)::integer as i
      from (select distinct cargo as v from cand where cargo is not null) x
  ), d_modalidade as (
    select x.v, (row_number() over (order by x.v) - 1)::integer as i
      from (select distinct modalidade as v from cand where modalidade is not null) x
  ), d_status as (
    select x.v, (row_number() over (order by x.v) - 1)::integer as i
      from (select distinct status as v from cand where status is not null) x
  ), d_codigo as (
    select x.v, (row_number() over (order by x.v) - 1)::integer as i
      from (select distinct codigo_vaga as v from cand where codigo_vaga is not null) x
  )
  select
    (select coalesce(json_agg(json_build_array(
              li.id, li.edital_id, li.edital, li.unidade, li.ativo, li.arquivo_nome, li.importado_em
            ) order by li.i), '[]'::json)
       from listas li),
    json_build_object(
      'cargo', (select coalesce(json_agg(d.v order by d.i), '[]'::json) from d_cargo d),
      'modalidade', (select coalesce(json_agg(d.v order by d.i), '[]'::json) from d_modalidade d),
      'status', (select coalesce(json_agg(d.v order by d.i), '[]'::json) from d_status d),
      'codigo_vaga', (select coalesce(json_agg(d.v order by d.i), '[]'::json) from d_codigo d)
    ),
    -- A ordem da função antiga; o id só desempata (antes o empate saía em qualquer ordem).
    (select coalesce(json_agg(json_build_array(
              c.id, c.lista, dc.i, c.classificacao, c.nota, c.nome, dm.i,
              ds.i, c.processo_sei, c.matricula, c.sub_judice, dv.i
            ) order by c.edital, c.cargo, c.classificacao nulls last, c.nome, c.id), '[]'::json)
       from cand c
       left join d_cargo dc on dc.v = c.cargo
       left join d_modalidade dm on dm.v = c.modalidade
       left join d_status ds on ds.v = c.status
       left join d_codigo dv on dv.v = c.codigo_vaga)
  into p_listas, p_dicionarios, p_linhas;

  p_total := json_array_length(p_linhas);
end;
$function$;

comment on function private."FC_MONTAR_APROVADOS_AREA"(text, uuid[]) is
  'Lista de aprovados da área no formato 2 (listas em array, dicionários, linhas com índices). p_editais nulo = área inteira. NÃO checa permissão.';

revoke all on function private."FC_VERSAO_APROVADOS_AREA"(text) from public, anon, authenticated, service_role;
revoke all on function private."FC_MONTAR_APROVADOS_AREA"(text, uuid[]) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Remontagem do pronto (pg_cron e a própria RPC)
-- ---------------------------------------------------------------------------
create function public.atualizar_cache_aprovados(p_area text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
 set lock_timeout to '3s'
as $function$
declare
  v_area text;
  v_inicio timestamptz;
  v_versao text;
  v_montado record;
  v_resultado jsonb := '[]'::jsonb;
begin
  if p_area is not null
     and not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = lower(btrim(p_area))) then
    raise exception 'Área inválida: %', p_area using errcode = '22023';
  end if;

  for v_area in
    select a."CO_AREA" from public."TB_AREA" a
     where p_area is null or a."CO_AREA" = lower(btrim(p_area))
     order by a."CO_AREA"
  loop
    -- Uma montagem por área de cada vez (a RPC que já tem a trava a reobtém).
    if not pg_try_advisory_xact_lock(hashtext('aprovados_area:' || v_area)::bigint) then
      v_resultado := v_resultado || jsonb_build_object('area', v_area, 'ok', false, 'erro', 'ocupado');
      continue;
    end if;
    begin
      v_inicio := clock_timestamp();
      v_versao := private."FC_VERSAO_APROVADOS_AREA"(v_area);
      select * into v_montado from private."FC_MONTAR_APROVADOS_AREA"(v_area, null);

      insert into private."TA_CANDIDATO_APROVADO_AREA" as c (
        "CO_AREA", "DS_LISTAS", "DS_DICIONARIOS", "DS_LINHAS", "QT_CANDIDATOS",
        "DS_VERSAO_DADOS", "DT_GERACAO", "NU_DURACAO_MS"
      ) values (
        v_area, v_montado.p_listas, v_montado.p_dicionarios, v_montado.p_linhas,
        v_montado.p_total, v_versao, v_inicio,
        (extract(epoch from clock_timestamp() - v_inicio) * 1000)::integer
      )
      on conflict ("CO_AREA") do update set
        "DS_LISTAS" = excluded."DS_LISTAS",
        "DS_DICIONARIOS" = excluded."DS_DICIONARIOS",
        "DS_LINHAS" = excluded."DS_LINHAS",
        "QT_CANDIDATOS" = excluded."QT_CANDIDATOS",
        "DS_VERSAO_DADOS" = excluded."DS_VERSAO_DADOS",
        "DT_GERACAO" = excluded."DT_GERACAO",
        "NU_DURACAO_MS" = excluded."NU_DURACAO_MS";

      v_resultado := v_resultado || jsonb_build_object(
        'area', v_area, 'ok', true, 'candidatos', v_montado.p_total,
        'ms', (extract(epoch from clock_timestamp() - v_inicio) * 1000)::integer);
    exception when others then
      -- Nunca derruba quem chamou: a RPC monta na hora.
      raise warning 'Pacote da lista de aprovados (%) não foi remontado: % (%)', v_area, sqlerrm, sqlstate;
      v_resultado := v_resultado || jsonb_build_object('area', v_area, 'ok', false, 'erro', sqlerrm);
    end;
  end loop;

  return v_resultado;
end;
$function$;

comment on function public.atualizar_cache_aprovados(text) is
  'Remonta o pacote pronto da lista de aprovados de uma área ou de todas. Erro numa área vira aviso e ok=false; só lança para área inexistente. Só service_role/postgres.';

revoke all on function public.atualizar_cache_aprovados(text) from public, anon, authenticated;
grant execute on function public.atualizar_cache_aprovados(text) to service_role;

create function public.atualizar_cache_aprovados_vencidos()
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_area text;
  v_cache record;
  v_resultado jsonb := '[]'::jsonb;
begin
  for v_area in select a."CO_AREA" from public."TB_AREA" a order by a."CO_AREA" loop
    select c."DS_VERSAO_DADOS", c."DT_GERACAO" into v_cache
      from private."TA_CANDIDATO_APROVADO_AREA" c
     where c."CO_AREA" = v_area;
    if not found
       or v_cache."DS_VERSAO_DADOS" is distinct from private."FC_VERSAO_APROVADOS_AREA"(v_area)
       or v_cache."DT_GERACAO" < now() - interval '6 hours' then
      v_resultado := v_resultado || public.atualizar_cache_aprovados(v_area);
    end if;
  end loop;
  return v_resultado;
end;
$function$;

comment on function public.atualizar_cache_aprovados_vencidos() is
  'Remonta só as áreas cujo pacote da lista de aprovados venceu (dados mudaram ou mais de 6 h). pg_cron a cada 2 min; barata quando nada mudou.';

revoke all on function public.atualizar_cache_aprovados_vencidos() from public, anon, authenticated;
grant execute on function public.atualizar_cache_aprovados_vencidos() to service_role;

-- ---------------------------------------------------------------------------
-- 5. A RPC, agora por área
-- ---------------------------------------------------------------------------
drop function public.listar_candidatos_aprovados_compacto();

create function public.listar_candidatos_aprovados_compacto(
  p_area text default null,
  p_versao text default null
)
returns json
language plpgsql
security definer
set search_path to ''
set work_mem to '64MB'
set jit to 'off'
as $function$
declare
  v_listas json;
  v_linhas json;
  v_area text;
  v_visiveis uuid[];
  v_versao text;
  v_cache private."TA_CANDIDATO_APROVADO_AREA";
  v_tem_cache boolean := false;
  v_dicionarios json;
  v_total integer;
  v_gerado_em timestamptz := now();
begin
  if not (private.pode_recurso('aprovados',1)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if private.papel_recurso('aprovados') = '' then
    raise exception 'Perfil sem acesso ao sistema';
  end if;

  -- Sem área: a resposta de antes (formato 1), para o front publicado até o deploy.
  if p_area is null then
    -- Dados da lista vão uma vez por lista (≈110), não repetidos em cada candidato.
    select coalesce(json_object_agg(l.id, json_build_array(
             l.edital_id, m.edital, m.unidade, l.ativo, l.arquivo_nome, l.importado_em
           )), '{}'::json)
      into v_listas
    from public."TB_LISTA_APROVADO" l
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
    where l.vigente is true
      and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
        and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]));

    select coalesce(json_agg(json_build_array(
             c.id, l.id, c.cargo, c.classificacao, c.nota, c.nome, c.modalidade,
             c.status, c.processo_sei, c.matricula, c.sub_judice, c.codigo_vaga
           ) order by m.edital, c.cargo, c.classificacao nulls last, c.nome), '[]'::json)
      into v_linhas
    from public."TB_LISTA_APROVADO" l
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
    join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id
    where l.vigente is true
      and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
        and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
      and c.removido_em is null;

    return json_build_object(
      'colunas_da_lista', json_build_array(
        'edital_id', 'edital', 'unidade', 'lista_ativa', 'arquivo_nome', 'importado_em'
      ),
      'listas', v_listas,
      'colunas', json_build_array(
        'candidato_id', 'lista_id', 'cargo', 'classificacao', 'nota', 'nome',
        'modalidade', 'status', 'processo_sei', 'matricula', 'sub_judice',
        'codigo_vaga'
      ),
      'linhas', v_linhas,
      'total', json_array_length(v_linhas)
    );
  end if;

  -- Área válida e do usuário: 22023/42501 antes de qualquer leitura.
  v_area := lower(btrim(p_area));
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
    raise exception 'Área inválida: %', p_area using errcode = '22023';
  end if;
  if not (v_area = any ((select private."FC_AREAS_USUARIO"())::text[])) then
    raise exception 'Sem permissão para a lista de aprovados desta área' using errcode = '42501';
  end if;

  -- Recorte por coordenação: entra na versão (mudou o recorte, a cópia não vale).
  v_visiveis := private."FC_EDITAIS_VISIVEIS"();
  v_versao := private."FC_VERSAO_APROVADOS_AREA"(v_area)
    || case when v_visiveis is null then ''
            else ':' || md5(array(select x from unnest(v_visiveis) x order by x)::text) end;

  if p_versao is not null and p_versao = v_versao then
    return json_build_object('formato', 2, 'area', v_area, 'versao', v_versao, 'inalterado', true);
  end if;

  if v_visiveis is null then
    select * into v_cache from private."TA_CANDIDATO_APROVADO_AREA" c where c."CO_AREA" = v_area;
    v_tem_cache := found and v_cache."DS_VERSAO_DADOS" = v_versao;
    if not v_tem_cache
       and pg_try_advisory_xact_lock(hashtext('aprovados_area:' || v_area)::bigint) then
      -- Venceu: remonta e grava. Falhou a gravação (transação só de leitura,
      -- trava), monta na hora abaixo.
      perform public.atualizar_cache_aprovados(v_area);
      select * into v_cache from private."TA_CANDIDATO_APROVADO_AREA" c where c."CO_AREA" = v_area;
      v_tem_cache := found and v_cache."DS_VERSAO_DADOS" = v_versao;
    end if;
  end if;

  if v_tem_cache then
    v_listas := v_cache."DS_LISTAS";
    v_dicionarios := v_cache."DS_DICIONARIOS";
    v_linhas := v_cache."DS_LINHAS";
    v_total := v_cache."QT_CANDIDATOS";
    v_gerado_em := v_cache."DT_GERACAO";
  else
    -- Com recorte, ou pronto ainda sem a versão de agora: montada na hora.
    select m.p_listas, m.p_dicionarios, m.p_linhas, m.p_total
      into v_listas, v_dicionarios, v_linhas, v_total
      from private."FC_MONTAR_APROVADOS_AREA"(v_area, v_visiveis) m;
  end if;

  return json_build_object(
    'formato', 2,
    'area', v_area,
    'versao', v_versao,
    'inalterado', false,
    'cache', json_build_object('hit', v_tem_cache, 'gerado_em', v_gerado_em),
    'colunas_da_lista', json_build_array(
      'lista_id', 'edital_id', 'edital', 'unidade', 'lista_ativa', 'arquivo_nome', 'importado_em'
    ),
    'listas', v_listas,
    'colunas', json_build_array(
      'candidato_id', 'lista_id', 'cargo', 'classificacao', 'nota', 'nome',
      'modalidade', 'status', 'processo_sei', 'matricula', 'sub_judice',
      'codigo_vaga'
    ),
    'dicionarios', v_dicionarios,
    'linhas', v_linhas,
    'total', v_total
  );
end;
$function$;

comment on function public.listar_candidatos_aprovados_compacto(text, text) is
  'Candidatos vigentes das listas de aprovados numa chamada só. Com p_area: só a área (formato 2: dicionários + índices, pacote pronto para quem vê a área inteira, versão para a cópia do navegador; p_versao igual = inalterado). Sem p_area: formato 1, todas as áreas do usuário. Mesma permissão e recortes de listar_candidatos_aprovados.';

revoke all on function public.listar_candidatos_aprovados_compacto(text, text) from public, anon;
grant execute on function public.listar_candidatos_aprovados_compacto(text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Agendamento e primeira carga
-- ---------------------------------------------------------------------------
do $$
declare
  v_comando constant text := 'select public.atualizar_cache_aprovados_vencidos();';
  v_id bigint;
begin
  select jobid into v_id from cron.job where jobname = 'agsus_aprovados_cache_por_area';
  if v_id is null then
    perform cron.schedule('agsus_aprovados_cache_por_area', '*/2 * * * *', v_comando);
  else
    perform cron.alter_job(v_id, schedule => '*/2 * * * *', command => v_comando);
  end if;
end;
$$;

select public.atualizar_cache_aprovados();

commit;
