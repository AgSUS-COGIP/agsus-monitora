/*
  ENSAIO de 20261007240000_casos_dos_avisos_resolvidos.sql — begin … rollback.

  PRÉ-REQUISITO: 20261007120000_casos_dos_avisos_de_conferencia.sql aplicada.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela) e:
    E1  confere a coluna nova, os grants e que as funções privadas não executam;
    E2  grava (papel service_role) um aviso sintético ENSAIO_RESOLVIDOS do
        módulo aprovados com até três casos — um aprovado real da área, um UUID
        que não existe e um aprovado de outra área — e confere que o banco
        recusa tipo desconhecido;
    E3  cria atores sintéticos (leitor da lista de aprovados na área, pessoa sem
        a área e o administrador global, no grupo 'admin');
    E4  lê como cada um (papel authenticated): o aprovado sai com nome, edital
        e situação e as vagas da pessoa; o UUID que não existe sai "removido";
        o de outra área sai "sem_acesso" para o leitor (sem dado); nenhuma
        referência UUID na saída; busca pelo nome;
    E5  o aviso REAL de "Contratado em duas vagas": quantos casos resolvidos e
        quantos não, como administrador global (só contagens).
  Termina em ROLLBACK: nada fica gravado. Resultado: a linha "ENSAIO OK" do
  SELECT final (só contagens). Qualquer "FALHOU …" interrompe e desfaz tudo.

  Mantenha em sincronia: tests/casos-dos-avisos-resolvidos-migration.test.js
  confere que o corpo da migration aqui é idêntico ao do arquivo da migration.
*/
begin;

-- ═══ CORPO DA MIGRATION (início) ═══
-- 0. Pré-requisito ----------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TB_CASO_AVISO_CONFERENCIA"') is null then
    raise exception 'Aplique antes 20261007120000_casos_dos_avisos_de_conferencia.sql.';
  end if;
end;
$$;

-- 1. O tipo da referência ---------------------------------------------------------------
alter table public."TB_CASO_AVISO_CONFERENCIA"
  add column "TP_REFERENCIA" varchar(30),
  add constraint "CK_CASOAVISO_TPREFERENCIA" check (
    "TP_REFERENCIA" is null
    or "TP_REFERENCIA" in ('candidato_aprovado', 'entrevista', 'lista_classificacao',
                           'ajuste_recurso', 'vaga', 'vaga_empregare'));
comment on column public."TB_CASO_AVISO_CONFERENCIA"."TP_REFERENCIA" is 'O que DS_REFERENCIA identifica: candidato_aprovado (TB_CANDIDATO_APROVADO.id), entrevista (TB_ENTREVISTA), lista_classificacao (TB_LISTA_CLASSIFICACAO), ajuste_recurso (TB_AJUSTE_PONTUACAO_RECURSO), vaga (código da vaga nas análises) ou vaga_empregare (TB_EMPREGARE_VAGA). Nulo nos casos gravados antes: a leitura deduz pelo código da conferência.';
comment on constraint "CK_CASOAVISO_TPREFERENCIA" on public."TB_CASO_AVISO_CONFERENCIA" is 'Tipo da referência entre os conhecidos pela leitura (listar_casos_aviso_conferencia).';

-- As vagas da mesma pessoa (FC_VINCULOS_DO_APROVADO): pelo código do candidato
-- nas análises e, sem código, pelo nome normalizado do aprovado.
create index if not exists "IN_ANALISECURR_IDORIGEMTRIM" on public."TB_ANALISE_CURRICULAR" (btrim(id_origem));
comment on index public."IN_ANALISECURR_IDORIGEMTRIM" is 'Análises (ativas ou não) pelo código do candidato sem espaços: as vagas da mesma pessoa na lista de aprovados (casos dos avisos de conferência).';
create index if not exists "IN_CANDAPROVADO_NOMENORM" on public."TB_CANDIDATO_APROVADO"
  (lower(regexp_replace(btrim(nome), '\s+', ' ', 'g'))) where removido_em is null;
comment on index public."IN_CANDAPROVADO_NOMENORM" is 'Aprovados pelo nome normalizado (sem caixa e com espaços simples): as vagas da mesma pessoa sem código do candidato (casos dos avisos de conferência).';

-- 2. Funções de apoio (privadas) --------------------------------------------------------
create function private."FC_PESSOA_DO_APROVADO"(p_id_origem text, p_nome text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select coalesce('cod:' || nullif(btrim(p_id_origem), ''),
                  'nome:' || nullif(lower(regexp_replace(btrim(p_nome), '\s+', ' ', 'g')), ''));
$function$;
comment on function private."FC_PESSOA_DO_APROVADO"(text, text) is 'Chave da pessoa na lista de aprovados: o código do candidato na Empregare ou, sem ele, o nome normalizado (a mesma de conferencia_ler_aprovados, antes do hash).';

create function private."FC_REFERENCIA_DO_CASO"(
  p_modulo text,
  p_conferencia text,
  p_tipo text,
  p_referencia text,
  p_analise uuid,
  p_area text,
  p_edital uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_tipo text := p_tipo;
  v_uuid uuid;
  r record;
begin
  if p_referencia ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_uuid := p_referencia::uuid;
  end if;
  -- Caso gravado antes do tipo: o código da conferência diz o que é a referência.
  if v_tipo is null then
    v_tipo := case
      when p_modulo = 'aprovados' then 'candidato_aprovado'
      when p_conferencia = 'ENTREVISTA_NOTA_FORA_DA_ESCALA' then 'entrevista'
      when p_conferencia = 'CLASSIFICACAO_LISTA_FINAL_DESATUALIZADA' then 'lista_classificacao'
      when p_conferencia = 'CLASSIFICACAO_EMPATE_PENDENTE' then
        case when v_uuid is not null then 'lista_classificacao' else 'vaga' end
      when p_conferencia = 'CLASSIFICACAO_VAGA_SEM_QUADRO' then 'vaga'
      when p_conferencia = 'CLASSIFICACAO_AJUSTE_APOS_LISTA' then 'ajuste_recurso'
      when p_conferencia = 'CARGA_VARIACAO_BRUSCA' then 'vaga_empregare'
      when p_modulo = 'entrevistas' and p_analise is not null then 'entrevista'
    end;
  end if;
  if v_tipo is null or (p_referencia is null and not (v_tipo = 'entrevista' and p_analise is not null)) then
    return null;
  end if;

  if v_tipo = 'candidato_aprovado' then
    if v_uuid is null then
      return jsonb_build_object('tipo', v_tipo, 'resolucao', 'removido');
    end if;
    select c.id, c.nome, c.status, c.codigo_vaga, c.cargo, c."DT_CONVOCACAO" as convocacao,
           c.removido_em, l.id as lista, m.id as edital_id, m.edital, m."CO_AREA" as area,
           nullif(btrim(a.id_origem), '') as codigo
      into r
      from public."TB_CANDIDATO_APROVADO" c
      left join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
      left join public."TB_MONITORAMENTO_INDIGENA" m
        on m.id = case when l.edital_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                       then l.edital_id::uuid end
      left join public."TB_ANALISE_CURRICULAR" a on a.id = c."CO_ANALISE_CURRICULAR"
     where c.id = v_uuid;
    if not found or r.removido_em is not null or r.lista is null then
      return jsonb_build_object('tipo', v_tipo, 'resolucao', 'removido');
    end if;
    if not private."FC_PODE_VER_AVISO"('aprovados', r.area, r.edital_id) then
      return jsonb_build_object('tipo', v_tipo, 'resolucao', 'sem_acesso');
    end if;
    return jsonb_build_object(
      'tipo', v_tipo, 'resolucao', 'ok', 'aprovado_id', r.id, 'nome', r.nome, 'codigo', r.codigo,
      'edital', r.edital, 'edital_id', r.edital_id, 'codigo_vaga', r.codigo_vaga, 'nome_vaga', r.cargo,
      'status', r.status, 'data_convocacao', r.convocacao,
      'data_contratacao', (select max(h.alterado_em) from public."TH_CANDIDATO_APROVADO" h
                            where h.candidato_id = r.id and h.status_novo = 'Contratado'));
  end if;

  if v_tipo = 'entrevista' then
    if v_uuid is not null then
      select e."CO_ENTREVISTA" as id, e."NO_CANDIDATO" as nome, nullif(btrim(e."CO_CANDIDATO"), '') as codigo,
             e."CO_VAGA" as codigo_vaga, e."NO_CARGO" as cargo, e."VL_NOTA_TOTAL" as nota,
             e."TP_PARECER" as parecer, e."ST_COMPARECEU" as compareceu, e."ST_ATIVO" as ativo,
             e."CO_AREA" as area, e."CO_MONITORAMENTO" as edital_id, coalesce(m.edital, e."DS_EDITAL") as edital
        into r
        from public."TB_ENTREVISTA" e
        left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = e."CO_MONITORAMENTO"
       where e."CO_ENTREVISTA" = v_uuid;
      if not found then
        return jsonb_build_object('tipo', v_tipo, 'resolucao', 'removido');
      end if;
    elsif p_referencia is null then
      -- Caso de entrevista pela análise: a entrevista ativa dela no edital do aviso.
      select e."CO_ENTREVISTA" as id, e."NO_CANDIDATO" as nome, nullif(btrim(e."CO_CANDIDATO"), '') as codigo,
             e."CO_VAGA" as codigo_vaga, e."NO_CARGO" as cargo, e."VL_NOTA_TOTAL" as nota,
             e."TP_PARECER" as parecer, e."ST_COMPARECEU" as compareceu, e."ST_ATIVO" as ativo,
             e."CO_AREA" as area, e."CO_MONITORAMENTO" as edital_id, coalesce(m.edital, e."DS_EDITAL") as edital
        into r
        from public."TB_ENTREVISTA" e
        left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = e."CO_MONITORAMENTO"
       where e."CO_ANALISE_CURRICULAR" = p_analise
         and coalesce(e."ST_ATIVO", 'S') = 'S'
         and (p_edital is null or e."CO_MONITORAMENTO" = p_edital)
       order by e."DT_ATUALIZACAO" desc nulls last, e."CO_ENTREVISTA"
       limit 1;
      if not found then
        return null;
      end if;
    else
      return jsonb_build_object('tipo', v_tipo, 'resolucao', 'removido');
    end if;
    if coalesce(r.ativo, 'S') <> 'S' then
      return jsonb_build_object('tipo', v_tipo, 'resolucao', 'removido');
    end if;
    if not private."FC_PODE_VER_AVISO"('entrevistas', r.area, r.edital_id) then
      return jsonb_build_object('tipo', v_tipo, 'resolucao', 'sem_acesso');
    end if;
    return jsonb_build_object(
      'tipo', v_tipo, 'resolucao', 'ok', 'entrevista_id', r.id, 'nome', r.nome, 'codigo', r.codigo,
      'edital', r.edital, 'edital_id', r.edital_id, 'codigo_vaga', r.codigo_vaga, 'nome_vaga', r.cargo,
      'status', r.parecer, 'nota', r.nota, 'compareceu', r.compareceu);
  end if;

  if v_tipo = 'lista_classificacao' then
    select l."CO_LISTA_CLASSIFICACAO" as id, l."TP_LISTA" as tipo_lista, l."DT_GERACAO" as gerada_em,
           l."QT_PENDENCIA" as pendencias, l."ST_PUBLICADA" as publicada,
           m.id as edital_id, m.edital, m."CO_AREA" as area
      into r
      from public."TB_LISTA_CLASSIFICACAO" l
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = l."CO_MONITORAMENTO"
     where l."CO_LISTA_CLASSIFICACAO" = v_uuid;
    if not found then
      return jsonb_build_object('tipo', v_tipo, 'resolucao', 'removido');
    end if;
    if not private."FC_PODE_VER_AVISO"('classificacao', r.area, r.edital_id) then
      return jsonb_build_object('tipo', v_tipo, 'resolucao', 'sem_acesso');
    end if;
    return jsonb_build_object(
      'tipo', v_tipo, 'resolucao', 'ok', 'edital', r.edital, 'edital_id', r.edital_id,
      'lista', jsonb_build_object('tipo', r.tipo_lista, 'gerada_em', r.gerada_em,
                                  'pendencias', r.pendencias, 'publicada', r.publicada = 'S'));
  end if;

  if v_tipo = 'ajuste_recurso' then
    select j."CO_AJUSTE_PONTUACAO" as id, j."TP_SITUACAO" as situacao, j."TP_LISTA" as tipo_lista,
           j."DT_APROVACAO" as aprovado_em, m.id as edital_id, m.edital, m."CO_AREA" as area,
           a.id as analise_id, a.candidato, nullif(btrim(a.id_origem), '') as codigo, a.codigo_vaga, a.nome_vaga
      into r
      from public."TB_AJUSTE_PONTUACAO_RECURSO" j
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = j."CO_MONITORAMENTO"
      left join public."TB_ANALISE_CURRICULAR" a on a.id = j."CO_ANALISE_CURRICULAR"
     where j."CO_AJUSTE_PONTUACAO" = v_uuid;
    if not found then
      return jsonb_build_object('tipo', v_tipo, 'resolucao', 'removido');
    end if;
    if not private."FC_PODE_VER_AVISO"('classificacao', r.area, r.edital_id) then
      return jsonb_build_object('tipo', v_tipo, 'resolucao', 'sem_acesso');
    end if;
    return jsonb_build_object(
      'tipo', v_tipo, 'resolucao', 'ok', 'analise_id', r.analise_id, 'nome', r.candidato, 'codigo', r.codigo,
      'edital', r.edital, 'edital_id', r.edital_id, 'codigo_vaga', r.codigo_vaga, 'nome_vaga', r.nome_vaga,
      'status', r.situacao, 'lista', jsonb_build_object('tipo', r.tipo_lista, 'aprovado_em', r.aprovado_em));
  end if;

  if v_tipo = 'vaga' then
    -- A vaga do edital do aviso: quem chama já vê o aviso (a leitura só resolve casos de avisos visíveis).
    return jsonb_build_object(
      'tipo', v_tipo, 'resolucao', 'ok', 'edital_id', p_edital,
      'edital', (select m.edital from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital),
      'codigo_vaga', case when p_referencia = 'sem-codigo' then null else p_referencia end,
      'nome_vaga', (select a.nome_vaga from public."TB_ANALISE_CURRICULAR" a
                     where a.codigo_vaga = p_referencia and a."CO_AREA" = p_area and a.ativo is true
                       and nullif(btrim(a.nome_vaga), '') is not null
                     limit 1));
  end if;

  if v_tipo = 'vaga_empregare' then
    select v."CO_VAGA" as codigo, v."QT_CANDIDATO_ATIVO" as ativos, m.id as edital_id, m.edital,
           coalesce(m."CO_AREA", p_area) as area
      into r
      from public."TB_EMPREGARE_VAGA" v
      left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = v."CO_MONITORAMENTO"
     where v."CO_VAGA" = p_referencia;
    if not found then
      return jsonb_build_object('tipo', v_tipo, 'resolucao', 'removido');
    end if;
    if not private."FC_PODE_VER_AVISO"('cargas', r.area, r.edital_id) then
      return jsonb_build_object('tipo', v_tipo, 'resolucao', 'sem_acesso');
    end if;
    return jsonb_build_object(
      'tipo', v_tipo, 'resolucao', 'ok', 'edital', r.edital, 'edital_id', r.edital_id,
      'codigo_vaga', r.codigo, 'candidatos', r.ativos,
      'nome_vaga', (select a.nome_vaga from public."TB_ANALISE_CURRICULAR" a
                     where a.codigo_vaga = r.codigo and a.ativo is true
                       and nullif(btrim(a.nome_vaga), '') is not null
                     limit 1));
  end if;

  return null;
end;
$function$;
comment on function private."FC_REFERENCIA_DO_CASO"(text, text, text, text, uuid, text, uuid) is 'Resolve a referência de um caso de aviso (aprovado, entrevista, lista, ajuste, vaga) com a permissão do módulo de quem chama sobre o REGISTRO (FC_PODE_VER_AVISO com a área e o edital dele): nome, código, edital, vaga, situação, datas, nota. resolucao = ok, removido (não existe mais) ou sem_acesso (sem nenhum dado). Sem tipo gravado, deduz pelo código da conferência. Sem CPF.';

create function private."FC_VINCULOS_DO_APROVADO"(p_candidato uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_chave text;
  v_ids uuid[];
  v_saida jsonb;
begin
  select private."FC_PESSOA_DO_APROVADO"(a.id_origem, c.nome) into v_chave
    from public."TB_CANDIDATO_APROVADO" c
    left join public."TB_ANALISE_CURRICULAR" a on a.id = c."CO_ANALISE_CURRICULAR"
   where c.id = p_candidato;
  if v_chave is null then
    return jsonb_build_object('vinculos', '[]'::jsonb, 'fora', 0);
  end if;

  -- Mesma chave do job: pelo código, os aprovados ligados às análises com aquele
  -- código; sem código, o nome normalizado (de quem não tem código).
  if v_chave like 'cod:%' then
    select array_agg(o.id) into v_ids
      from public."TB_ANALISE_CURRICULAR" x
      join public."TB_CANDIDATO_APROVADO" o on o."CO_ANALISE_CURRICULAR" = x.id
     where btrim(x.id_origem) = substr(v_chave, 5)
       and o.removido_em is null;
  else
    select array_agg(o.id) into v_ids
      from public."TB_CANDIDATO_APROVADO" o
      left join public."TB_ANALISE_CURRICULAR" x on x.id = o."CO_ANALISE_CURRICULAR"
     where lower(regexp_replace(btrim(o.nome), '\s+', ' ', 'g')) = substr(v_chave, 6)
       and o.removido_em is null
       and nullif(btrim(x.id_origem), '') is null;
  end if;

  with da_pessoa as (
    select o.id, o.status, o.codigo_vaga, o.cargo, o."DT_CONVOCACAO" as convocacao,
           m.id as edital_id, m.edital, m."CO_AREA" as area
      from public."TB_CANDIDATO_APROVADO" o
      join public."TB_LISTA_APROVADO" l on l.id = o.lista_id and l.vigente is true and coalesce(l.ativo, true)
      left join public."TB_MONITORAMENTO_INDIGENA" m
        on m.id = case when l.edital_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                       then l.edital_id::uuid end
     where o.id = any (coalesce(v_ids, '{}'))
       and o.status in ('Convocado', 'Contratado')
  ),
  vistos as (
    select d.*, private."FC_PODE_VER_AVISO"('aprovados', d.area, d.edital_id) as pode
      from da_pessoa d
  )
  select jsonb_build_object(
           'vinculos', coalesce(jsonb_agg(jsonb_build_object(
               'id', v.id, 'edital', v.edital, 'edital_id', v.edital_id,
               'codigo_vaga', v.codigo_vaga, 'nome_vaga', v.cargo, 'status', v.status,
               'data_convocacao', v.convocacao,
               'data_contratacao', (select max(h.alterado_em) from public."TH_CANDIDATO_APROVADO" h
                                     where h.candidato_id = v.id and h.status_novo = 'Contratado'))
             order by v.edital, v.codigo_vaga, v.id) filter (where v.pode), '[]'::jsonb),
           'fora', count(*) filter (where not v.pode))
    into v_saida
    from vistos v;
  return v_saida;
end;
$function$;
comment on function private."FC_VINCULOS_DO_APROVADO"(uuid) is 'As vagas da mesma pessoa do aprovado (código do candidato ou nome normalizado) nas listas vigentes, convocada ou contratada: edital, vaga, situação, data da convocação e da contratação — só as que quem chama vê na lista de aprovados; as demais só contadas (fora). Sem CPF.';

revoke all on function private."FC_PESSOA_DO_APROVADO"(text, text) from public, anon, authenticated;
revoke all on function private."FC_REFERENCIA_DO_CASO"(text, text, text, text, uuid, text, uuid) from public, anon, authenticated;
revoke all on function private."FC_VINCULOS_DO_APROVADO"(uuid) from public, anon, authenticated;

-- 3. Gravação: o caso traz o tipo da referência -----------------------------------------
create or replace function public.gravar_avisos_conferencia(p_execucao text, p_avisos jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_aviso jsonb;
  v_atual public."TB_AVISO_CONFERENCIA";
  v_id uuid;
  v_conferencia text;
  v_escopo text;
  v_gravidade text;
  v_modulo text;
  v_area text;
  v_edital uuid;
  v_qt integer;
  v_exemplos jsonb;
  v_casos jsonb;
  v_resumo text;
  v_novos integer := 0;
  v_reabertos integer := 0;
  v_mantidos integer := 0;
begin
  perform private."FC_EXIGIR_EXECUCAO_CONFERENCIA"(p_execucao);
  if jsonb_typeof(p_avisos) is distinct from 'array' or jsonb_array_length(p_avisos) > 1000 then
    raise exception 'Envie até 1000 avisos por chamada, em lista' using errcode = '22023';
  end if;

  for v_aviso in select x from jsonb_array_elements(p_avisos) x loop
    v_conferencia := v_aviso ->> 'conferencia';
    v_escopo := v_aviso ->> 'escopo';
    v_gravidade := v_aviso ->> 'gravidade';
    v_modulo := v_aviso ->> 'modulo';
    v_area := nullif(v_aviso ->> 'area', '');
    v_exemplos := coalesce(v_aviso -> 'exemplos', '[]'::jsonb);
    v_casos := v_aviso -> 'casos';
    v_resumo := btrim(coalesce(v_aviso ->> 'resumo', ''));

    if v_conferencia is null or v_conferencia !~ '^[A-Z][A-Z0-9_]{2,59}$' then
      raise exception 'Código de conferência inválido' using errcode = '22023';
    end if;
    if v_escopo is null or v_escopo !~ '^[a-z_]{2,20}:[A-Za-z0-9._:/|-]{1,170}$' then
      raise exception 'Escopo inválido em %', v_conferencia using errcode = '22023';
    end if;
    if v_gravidade is null or v_gravidade not in ('CRITICA', 'ATENCAO', 'INFORMATIVO') then
      raise exception 'Gravidade inválida em %', v_conferencia using errcode = '22023';
    end if;
    if v_modulo is null or v_modulo not in ('analises', 'entrevistas', 'classificacao', 'aprovados', 'cargas') then
      raise exception 'Módulo inválido em %', v_conferencia using errcode = '22023';
    end if;
    if v_area is not null and not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
      raise exception 'Área inválida em %', v_conferencia using errcode = '22023';
    end if;
    begin
      v_edital := nullif(v_aviso ->> 'edital', '')::uuid;
      v_qt := (v_aviso ->> 'quantidade')::integer;
    exception when others then
      raise exception 'Edital ou quantidade inválidos em %', v_conferencia using errcode = '22023';
    end;
    if v_edital is not null and not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_edital) then
      raise exception 'Edital inexistente em %', v_conferencia using errcode = '22023';
    end if;
    if v_qt is null or v_qt < 1 then
      raise exception 'Quantidade inválida em %', v_conferencia using errcode = '22023';
    end if;
    if jsonb_typeof(v_exemplos) <> 'array' or jsonb_array_length(v_exemplos) > 20
       or exists (select 1 from jsonb_array_elements(v_exemplos) e
                   where jsonb_typeof(e) <> 'string'
                      or (e #>> '{}') !~ '^[A-Za-z0-9._:/-]{1,80}$'
                      or (e #>> '{}') ~ '[0-9]{11}') then
      raise exception 'Exemplos de % só com ids e códigos (até 20, sem espaço, sem @, sem 11 dígitos)', v_conferencia
        using errcode = '22023';
    end if;
    -- Casos: até 5000 objetos, cada um com análise (uuid), código ou referência
    -- (identificadores), o tipo da referência e o detalhe (objeto de valores
    -- simples, sem dado pessoal).
    if v_casos is not null and (
         jsonb_typeof(v_casos) <> 'array' or jsonb_array_length(v_casos) > 5000
         or exists (
           select 1 from jsonb_array_elements(v_casos) c
            where jsonb_typeof(c) <> 'object'
               or (c ? 'analise' and jsonb_typeof(c -> 'analise') <> 'null'
                   and coalesce(c ->> 'analise', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
               or (c ? 'codigo' and jsonb_typeof(c -> 'codigo') <> 'null'
                   and (coalesce(c ->> 'codigo', '') !~ '^[A-Za-z0-9._:/-]{1,80}$' or (c ->> 'codigo') ~ '[0-9]{11}'))
               or (c ? 'referencia' and jsonb_typeof(c -> 'referencia') <> 'null'
                   and (coalesce(c ->> 'referencia', '') !~ '^[A-Za-z0-9._:/-]{1,80}$' or (c ->> 'referencia') ~ '[0-9]{11}'))
               or (c ? 'tipo' and jsonb_typeof(c -> 'tipo') <> 'null'
                   and coalesce(c ->> 'tipo', '') not in ('candidato_aprovado', 'entrevista', 'lista_classificacao',
                                                          'ajuste_recurso', 'vaga', 'vaga_empregare'))
               or num_nonnulls(nullif(c ->> 'analise', ''), nullif(c ->> 'codigo', ''), nullif(c ->> 'referencia', '')) = 0
               or (c ? 'detalhe' and (
                     jsonb_typeof(c -> 'detalhe') <> 'object'
                     or exists (select 1 from jsonb_each(c -> 'detalhe') d
                                 where d.key !~ '^[a-z_]{1,30}$'
                                    or jsonb_typeof(d.value) not in ('string', 'number', 'boolean', 'null')
                                    or (jsonb_typeof(d.value) = 'string' and (d.value #>> '{}') !~ '^[A-Za-z0-9._:/-]{0,40}$')
                                    or (d.value #>> '{}') ~ '[0-9]{11}')
                     or length((c -> 'detalhe')::text) > 1000))
         )) then
      raise exception 'Casos de % só com ids, códigos, tipo conhecido e detalhe simples (até 5000, sem nome, @ ou 11 dígitos)', v_conferencia
        using errcode = '22023';
    end if;
    if length(v_resumo) not between 3 and 300 or not private."FC_TEXTO_SEGURO_DO_AVISO"(v_resumo) then
      raise exception 'Resumo de % vazio, longo ou com cara de dado pessoal', v_conferencia using errcode = '22023';
    end if;

    select * into v_atual from public."TB_AVISO_CONFERENCIA" a
     where a."CO_CONFERENCIA" = v_conferencia and a."DS_ESCOPO" = v_escopo
     for update;

    if v_atual."CO_AVISO_CONFERENCIA" is null then
      insert into public."TB_AVISO_CONFERENCIA" (
        "CO_CONFERENCIA", "DS_ESCOPO", "TP_GRAVIDADE", "CO_MODULO", "CO_AREA", "CO_MONITORAMENTO",
        "QT_OCORRENCIA", "DS_EXEMPLO", "DS_RESUMO", "CO_EXECUCAO")
      values (v_conferencia, v_escopo, v_gravidade, v_modulo, v_area, v_edital, v_qt, v_exemplos, v_resumo, p_execucao)
      returning "CO_AVISO_CONFERENCIA" into v_id;
      v_novos := v_novos + 1;
    elsif v_atual."TP_SITUACAO" = 'RESOLVIDO'
       or (v_atual."TP_SITUACAO" = 'IGNORADO' and v_qt > v_atual."QT_OCORRENCIA_IGNORADA") then
      v_id := v_atual."CO_AVISO_CONFERENCIA";
      update public."TB_AVISO_CONFERENCIA" set
        "TP_GRAVIDADE" = v_gravidade, "CO_MODULO" = v_modulo, "CO_AREA" = v_area, "CO_MONITORAMENTO" = v_edital,
        "QT_OCORRENCIA" = v_qt, "DS_EXEMPLO" = v_exemplos, "DS_RESUMO" = v_resumo, "CO_EXECUCAO" = p_execucao,
        "TP_SITUACAO" = 'ABERTO', "DT_ULTIMA_VEZ" = now(), "DT_RESOLUCAO" = null,
        "DT_PRIMEIRA_VEZ" = case when v_atual."TP_SITUACAO" = 'RESOLVIDO' then now() else "DT_PRIMEIRA_VEZ" end,
        "CO_USUARIO_IGNORADO" = null, "DT_IGNORADO" = null, "DS_MOTIVO_IGNORADO" = null, "QT_OCORRENCIA_IGNORADA" = null
       where "CO_AVISO_CONFERENCIA" = v_id;
      v_reabertos := v_reabertos + 1;
    else
      v_id := v_atual."CO_AVISO_CONFERENCIA";
      update public."TB_AVISO_CONFERENCIA" set
        "TP_GRAVIDADE" = v_gravidade, "CO_MODULO" = v_modulo, "CO_AREA" = v_area, "CO_MONITORAMENTO" = v_edital,
        "QT_OCORRENCIA" = v_qt, "DS_EXEMPLO" = v_exemplos, "DS_RESUMO" = v_resumo, "CO_EXECUCAO" = p_execucao,
        "DT_ULTIMA_VEZ" = now()
       where "CO_AVISO_CONFERENCIA" = v_id;
      v_mantidos := v_mantidos + 1;
    end if;

    -- Com 'casos', os do aviso são trocados pelos desta execução.
    if v_casos is not null then
      delete from public."TB_CASO_AVISO_CONFERENCIA" k where k."CO_AVISO_CONFERENCIA" = v_id;
      insert into public."TB_CASO_AVISO_CONFERENCIA" (
        "CO_AVISO_CONFERENCIA", "NU_CASO", "CO_ANALISE_CURRICULAR", "CO_CANDIDATO_EMPREGARE", "DS_REFERENCIA",
        "TP_REFERENCIA", "DS_DETALHE")
      select v_id, x.ordem::integer, nullif(x.caso ->> 'analise', '')::uuid,
             nullif(x.caso ->> 'codigo', ''), nullif(x.caso ->> 'referencia', ''), nullif(x.caso ->> 'tipo', ''),
             coalesce(case when jsonb_typeof(x.caso -> 'detalhe') = 'object' then x.caso -> 'detalhe' end, '{}'::jsonb)
        from jsonb_array_elements(v_casos) with ordinality as x(caso, ordem);
    end if;
  end loop;

  update public."TL_CONFERENCIA" set "QT_AVISO_NOVO" = "QT_AVISO_NOVO" + v_novos + v_reabertos
   where "CO_EXECUCAO" = p_execucao;
  return jsonb_build_object('novos', v_novos, 'reabertos', v_reabertos, 'mantidos', v_mantidos);
end;
$function$;
comment on function public.gravar_avisos_conferencia(text, jsonb) is
  'Grava até 1000 avisos de uma execução (um por conferência + escopo): novo abre; resolvido reabre; ignorado reabre só se a quantidade passou da ignorada; aberto atualiza quantidade e exemplos. Com ''casos'' (até 5000: análise, código do candidato, referência, tipo da referência e o detalhe que motivou), troca os casos do aviso. Recusa (22023) exemplo ou caso que não seja id ou código (espaço, @, 11 dígitos), tipo desconhecido e resumo com cara de dado pessoal. Só service_role.';
revoke all on function public.gravar_avisos_conferencia(text, jsonb) from public, anon, authenticated;
grant execute on function public.gravar_avisos_conferencia(text, jsonb) to service_role;

-- 4. Leitura dos casos na tela (authenticated) ------------------------------------------
create or replace function public.listar_casos_aviso_conferencia(
  p_aviso uuid default null,
  p_busca text default null,
  p_area text default null,
  p_modulo text default null,
  p_limite integer default 50,
  p_deslocamento integer default 0)
returns json
language plpgsql
stable
security definer
set search_path to ''
set statement_timeout to '15s'
as $function$
declare
  v_area text := nullif(lower(btrim(coalesce(p_area, ''))), '');
  v_modulo text := nullif(lower(btrim(coalesce(p_modulo, ''))), '');
  v_busca text := nullif(private."FC_TEXTO_DE_BUSCA"(left(coalesce(p_busca, ''), 80)), '');
  v_limite integer := least(greatest(coalesce(p_limite, 50), 1), 1000);
  v_deslocamento integer := greatest(coalesce(p_deslocamento, 0), 0);
  v_total integer;
  v_casos json;
begin
  if auth.uid() is null then
    raise exception 'Sessão necessária' using errcode = '42501';
  end if;
  if v_area is not null and not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if v_modulo is not null and v_modulo not in ('analises', 'entrevistas', 'classificacao', 'aprovados', 'cargas') then
    raise exception 'Módulo inválido' using errcode = '22023';
  end if;
  if p_aviso is null and v_busca is null then
    raise exception 'Informe o aviso ou o que buscar' using errcode = '22023';
  end if;
  if p_aviso is not null and not exists (
       select 1 from public."TB_AVISO_CONFERENCIA" a
        where a."CO_AVISO_CONFERENCIA" = p_aviso
          and a."TP_SITUACAO" in ('ABERTO', 'IGNORADO')
          and private."FC_PODE_VER_AVISO"(a."CO_MODULO", a."CO_AREA", a."CO_MONITORAMENTO")) then
    raise exception 'Aviso não encontrado' using errcode = '22023';
  end if;

  with avisos as (
    select a."CO_AVISO_CONFERENCIA" as id, a."CO_CONFERENCIA" as conferencia, a."CO_MODULO" as modulo,
           a."CO_AREA" as area, a."CO_MONITORAMENTO" as edital
      from public."TB_AVISO_CONFERENCIA" a
     where a."TP_SITUACAO" in ('ABERTO', 'IGNORADO')
       and (p_aviso is null or a."CO_AVISO_CONFERENCIA" = p_aviso)
       and (v_area is null or a."CO_AREA" = v_area)
       and (v_modulo is null or a."CO_MODULO" = v_modulo)
       and private."FC_PODE_VER_AVISO"(a."CO_MODULO", a."CO_AREA", a."CO_MONITORAMENTO")
  ),
  casos as materialized (
    select av.id as aviso, av.conferencia, k."NU_CASO" as ordem,
           k."CO_ANALISE_CURRICULAR" as analise_do_caso, k."CO_CANDIDATO_EMPREGARE" as codigo_do_caso,
           k."DS_REFERENCIA" as referencia_do_caso, k."DS_DETALHE" as detalhe,
           an.id as an_id, nullif(btrim(an.id_origem), '') as an_codigo, an.candidato as an_nome,
           an.edital as an_edital, an.codigo_vaga as an_codigo_vaga, an.nome_vaga as an_nome_vaga,
           an.responsavel_analise, an.status_consolidado as an_status, an.data_analise,
           private."FC_REFERENCIA_DO_CASO"(av.modulo, av.conferencia, k."TP_REFERENCIA", k."DS_REFERENCIA",
                                           k."CO_ANALISE_CURRICULAR", av.area, av.edital) as r
      from avisos av
      join public."TB_CASO_AVISO_CONFERENCIA" k on k."CO_AVISO_CONFERENCIA" = av.id
      left join lateral (
        (select x.id, x.id_origem, x.candidato, x.edital, x.codigo_vaga, x.nome_vaga,
                x.responsavel_analise, x.status_consolidado, x.data_analise
           from public."TB_ANALISE_CURRICULAR" x
          where x.id = k."CO_ANALISE_CURRICULAR"
            and private."FC_PODE_VER_ANALISE_DO_AVISO"(x."CO_AREA", x.edital_norm, x.unidade_norm))
        union all
        (select x.id, x.id_origem, x.candidato, x.edital, x.codigo_vaga, x.nome_vaga,
                x.responsavel_analise, x.status_consolidado, x.data_analise
           from public."TB_ANALISE_CURRICULAR" x
          where k."CO_ANALISE_CURRICULAR" is null
            and x.ativo is true
            and x.id_origem = k."CO_CANDIDATO_EMPREGARE"
            and private."FC_PODE_VER_ANALISE_DO_AVISO"(x."CO_AREA", x.edital_norm, x.unidade_norm)
          order by x.edital, x.id
          limit 1)
        limit 1
      ) an on true
  ),
  resolvidos as materialized (
    select c.*,
           coalesce(c.an_nome, c.r ->> 'nome') as nome,
           coalesce(c.codigo_do_caso, c.an_codigo, c.r ->> 'codigo') as codigo,
           coalesce(c.an_edital, c.r ->> 'edital') as edital,
           coalesce(c.an_codigo_vaga, c.r ->> 'codigo_vaga') as codigo_vaga,
           coalesce(c.an_nome_vaga, c.r ->> 'nome_vaga') as nome_vaga,
           coalesce(c.r ->> 'status', c.an_status) as status,
           c.r ->> 'tipo' as tipo,
           case
             when c.an_id is not null or c.r ->> 'resolucao' = 'ok' then 'ok'
             when c.r ? 'resolucao' then c.r ->> 'resolucao'
             when c.analise_do_caso is not null then
               case when exists (select 1 from public."TB_ANALISE_CURRICULAR" x where x.id = c.analise_do_caso)
                    then 'sem_acesso' else 'removido' end
             when c.codigo_do_caso is not null then
               case when exists (select 1 from public."TB_ANALISE_CURRICULAR" x
                                  where x.ativo is true and x.id_origem = c.codigo_do_caso)
                    then 'sem_acesso' else 'removido' end
             when c.referencia_do_caso ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then 'removido'
             else 'ok'
           end as resolucao,
           -- A referência só sai quando é um código (vaga, lista do job antigo), nunca um UUID.
           case when c.referencia_do_caso ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then null else c.referencia_do_caso end as referencia,
           case when c.r ->> 'tipo' = 'candidato_aprovado'
                 and c.referencia_do_caso ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then c.referencia_do_caso::uuid end as aprovado_do_caso
      from casos c
  ),
  filtrados as (
    select f.* from resolvidos f
     where v_busca is null
        or private."FC_TEXTO_DE_BUSCA"(coalesce(f.codigo, '')) like '%' || v_busca || '%'
        or private."FC_TEXTO_DE_BUSCA"(coalesce(f.referencia, '')) like '%' || v_busca || '%'
        or private."FC_TEXTO_DE_BUSCA"(coalesce(f.nome, '')) like '%' || v_busca || '%'
        or private."FC_TEXTO_DE_BUSCA"(coalesce(f.codigo_vaga, '')) like '%' || v_busca || '%'
        or private."FC_TEXTO_DE_BUSCA"(coalesce(f.nome_vaga, '')) like '%' || v_busca || '%'
  ),
  numerados as (
    select f.*,
           row_number() over (order by f.nome is null, private."FC_TEXTO_DE_BUSCA"(f.nome),
                                       f.codigo, f.codigo_vaga, f.conferencia, f.ordem) as posicao,
           count(*) over () as total
      from filtrados f
  ),
  pagina as materialized (
    select n.*,
           case when n.aprovado_do_caso is not null
                then private."FC_VINCULOS_DO_APROVADO"(n.aprovado_do_caso) end as vinculos
      from numerados n
     where n.posicao > v_deslocamento and n.posicao <= v_deslocamento + v_limite
  )
  select (select max(n.total) from numerados n)::integer,
         json_agg(json_build_object(
           'aviso_id', p.aviso,
           'conferencia', p.conferencia,
           'ordem', p.ordem,
           'tipo', p.tipo,
           'resolucao', p.resolucao,
           'analise_id', coalesce(p.an_id::text, p.r ->> 'analise_id'),
           'aprovado_id', p.r ->> 'aprovado_id',
           'entrevista_id', p.r ->> 'entrevista_id',
           'edital_id', p.r ->> 'edital_id',
           'codigo', p.codigo,
           'nome', p.nome,
           'edital', p.edital,
           'codigo_vaga', p.codigo_vaga,
           'nome_vaga', p.nome_vaga,
           'responsavel', p.responsavel_analise,
           'status', p.status,
           'data_analise', p.data_analise,
           'nota', p.r -> 'nota',
           'compareceu', p.r ->> 'compareceu',
           'data_convocacao', p.r ->> 'data_convocacao',
           'data_contratacao', p.r ->> 'data_contratacao',
           'candidatos', p.r -> 'candidatos',
           'lista', p.r -> 'lista',
           'referencia', p.referencia,
           'detalhe', p.detalhe,
           'vinculos', p.vinculos -> 'vinculos',
           'analises', case when p.analise_do_caso is null and p.codigo_do_caso is not null then (
             select coalesce(json_agg(json_build_object(
                      'id', x.id, 'edital', x.edital, 'codigo_vaga', x.codigo_vaga, 'nome_vaga', x.nome_vaga,
                      'status', x.status_consolidado, 'responsavel', x.responsavel_analise,
                      'data_analise', x.data_analise) order by x.edital, x.codigo_vaga, x.id), '[]'::json)
               from public."TB_ANALISE_CURRICULAR" x
              where x.ativo is true and x.id_origem = p.codigo_do_caso
                and private."FC_PODE_VER_ANALISE_DO_AVISO"(x."CO_AREA", x.edital_norm, x.unidade_norm)) end,
           'fora_do_acesso', case
             when p.analise_do_caso is null and p.codigo_do_caso is not null then (
               select count(*)::integer
                 from public."TB_ANALISE_CURRICULAR" x
                where x.ativo is true and x.id_origem = p.codigo_do_caso
                  and not private."FC_PODE_VER_ANALISE_DO_AVISO"(x."CO_AREA", x.edital_norm, x.unidade_norm))
             when p.vinculos is not null then (p.vinculos ->> 'fora')::integer end
         ) order by p.posicao)
    into v_total, v_casos
    from pagina p;

  return json_build_object(
    'schema_version', 2,
    'total', coalesce(v_total, 0),
    'limite', v_limite,
    'deslocamento', v_deslocamento,
    'casos', coalesce(v_casos, '[]'::json));
end;
$function$;
comment on function public.listar_casos_aviso_conferencia(uuid, text, text, text, integer, integer) is
  'Casos (json, em páginas de até 1000) de um aviso de conferência, ou de todos os avisos abertos e ignorados que quem chama vê (área e módulo opcionais; exige p_busca). Busca por código do candidato, nome, código ou nome da vaga e referência (sem acento e sem caixa). Cada caso: tipo e resolução (ok, removido, sem_acesso), código, nome, edital, vaga, situação e datas — da análise (área e recorte de quem lê) ou do registro do módulo (aprovado, entrevista, lista, ajuste, vaga) com a permissão daquele módulo —, o detalhe que motivou o aviso, as análises do candidato em dois editais e as vagas da pessoa nas listas de aprovados (com quantas ficaram fora do acesso). A referência só sai quando não é UUID. Sem CPF.';
revoke all on function public.listar_casos_aviso_conferencia(uuid, text, text, text, integer, integer) from public, anon;
grant execute on function public.listar_casos_aviso_conferencia(uuid, text, text, text, integer, integer) to authenticated;

-- ═══ CORPO DA MIGRATION (fim) ═══

-- ENSAIO (tudo abaixo corre na mesma transação e é desfeito no rollback final)

-- E1. Coluna nova; gravar só service_role; ler só authenticated; privadas sem execução.
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'TB_CASO_AVISO_CONFERENCIA'
                    and column_name = 'TP_REFERENCIA') then
    raise exception 'FALHOU E1: sem TP_REFERENCIA';
  end if;
  if has_function_privilege('authenticated', 'public.gravar_avisos_conferencia(text, jsonb)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.gravar_avisos_conferencia(text, jsonb)', 'EXECUTE') then
    raise exception 'FALHOU E1: gravar_avisos_conferencia fora do service_role';
  end if;
  if has_function_privilege('anon', 'public.listar_casos_aviso_conferencia(uuid, text, text, text, integer, integer)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.listar_casos_aviso_conferencia(uuid, text, text, text, integer, integer)', 'EXECUTE') then
    raise exception 'FALHOU E1: permissão de listar_casos_aviso_conferencia';
  end if;
  if has_function_privilege('authenticated', 'private."FC_REFERENCIA_DO_CASO"(text, text, text, text, uuid, text, uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private."FC_VINCULOS_DO_APROVADO"(uuid)', 'EXECUTE') then
    raise exception 'FALHOU E1: função privada executável';
  end if;
  raise notice 'ok E1: coluna, grants e funções privadas';
end;
$$;

-- Um aprovado real (lista vigente e ativa, com edital e área) e, se houver, um de outra área (nada deles muda).
select set_config('ensaio.aprovado', (
  select c.id::text from public."TB_CANDIDATO_APROVADO" c
    join public."TB_LISTA_APROVADO" l on l.id = c.lista_id and l.vigente is true and coalesce(l.ativo, true)
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
   where c.removido_em is null and nullif(btrim(c.nome), '') is not null and m."CO_AREA" is not null
     and c.status in ('Convocado', 'Contratado')
   order by c.id limit 1), true);
select set_config('ensaio.area', (
  select m."CO_AREA" from public."TB_CANDIDATO_APROVADO" c
    join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
   where c.id = current_setting('ensaio.aprovado')::uuid), true);
select set_config('ensaio.outro', coalesce((
  select c.id::text from public."TB_CANDIDATO_APROVADO" c
    join public."TB_LISTA_APROVADO" l on l.id = c.lista_id and l.vigente is true
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
   where c.removido_em is null and m."CO_AREA" <> current_setting('ensaio.area')
   order by c.id limit 1), ''), true);

-- E2. O job (papel service_role): casos com o tipo da referência; tipo desconhecido recusado.
set local role service_role;
do $$
declare
  c_aprovado constant text := current_setting('ensaio.aprovado');
  c_outro constant text := current_setting('ensaio.outro');
  c_area constant text := current_setting('ensaio.area');
  v jsonb;
  v_aviso jsonb;
  v_casos jsonb;
begin
  if coalesce(c_aprovado, '') = '' then
    raise exception 'FALHOU E2: o banco não tem aprovado convocado ou contratado numa lista vigente';
  end if;
  v_casos := jsonb_build_array(
    jsonb_build_object('referencia', c_aprovado, 'tipo', 'candidato_aprovado', 'detalhe', jsonb_build_object('vagas', 2)),
    jsonb_build_object('referencia', '00000000-0000-4000-a000-00000000dead', 'tipo', 'candidato_aprovado'));
  if c_outro <> '' then
    v_casos := v_casos || jsonb_build_array(jsonb_build_object('referencia', c_outro, 'tipo', 'candidato_aprovado'));
  end if;
  v_aviso := jsonb_build_object(
    'conferencia', 'ENSAIO_RESOLVIDOS', 'escopo', 'area:' || c_area, 'gravidade', 'CRITICA',
    'modulo', 'aprovados', 'area', c_area, 'quantidade', jsonb_array_length(v_casos),
    'exemplos', '[]'::jsonb, 'resumo', 'casos do ensaio', 'casos', v_casos);

  perform public.iniciar_conferencia('ensaio-resolvidos-0001', 'GITHUB');
  begin
    perform public.gravar_avisos_conferencia('ensaio-resolvidos-0001', jsonb_build_array(
      v_aviso || jsonb_build_object('casos', jsonb_build_array(
        jsonb_build_object('referencia', c_aprovado, 'tipo', 'pessoa')))));
    raise exception 'FALHOU E2: aceitou tipo desconhecido';
  exception when invalid_parameter_value then null;
  end;
  v := public.gravar_avisos_conferencia('ensaio-resolvidos-0001', jsonb_build_array(v_aviso));
  if (v ->> 'novos')::int <> 1 then raise exception 'FALHOU E2: novo %', v; end if;
  perform public.finalizar_conferencia('ensaio-resolvidos-0001', array['ENSAIO_RESOLVIDOS']);
  raise notice 'ok E2: casos com tipo gravados; tipo desconhecido recusado';
end;
$$;
reset role;

do $$
begin
  if (select count(*) from public."TB_CASO_AVISO_CONFERENCIA" k
        join public."TB_AVISO_CONFERENCIA" a on a."CO_AVISO_CONFERENCIA" = k."CO_AVISO_CONFERENCIA"
       where a."CO_CONFERENCIA" = 'ENSAIO_RESOLVIDOS' and k."TP_REFERENCIA" = 'candidato_aprovado') < 2 then
    raise exception 'FALHOU E2: o tipo da referência não foi gravado';
  end if;
end;
$$;

-- E3. Atores sintéticos (somem no rollback); o administrador fica no grupo 'admin', o único admin global.
do $$
declare
  c_area constant text := current_setting('ensaio.area');
begin
  insert into public."TB_GRUPO_ACESSO" ("CO_GRUPO_ACESSO", "NO_GRUPO_ACESSO", "DS_GRUPO_ACESSO", "ST_SISTEMA", "ST_ADMIN_GLOBAL", "NU_ORDEM")
  values ('ensaio_resolv_leitor', 'Ensaio resolvidos (leitor)', 'Grupo do ensaio: aprovados leitor.', false, false, 994);
  insert into public."TA_GRUPO_ACESSO_RECURSO" ("CO_GRUPO_ACESSO", "NO_RECURSO", "TP_NIVEL")
  values ('ensaio_resolv_leitor', 'aprovados', 'leitor')
  on conflict ("CO_GRUPO_ACESSO", "NO_RECURSO") do update set "TP_NIVEL" = excluded."TP_NIVEL";

  insert into auth.users (id, instance_id, aud, role, email) values
    ('00000000-0000-4000-a000-00000000d301', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.resolvidos.admin@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000d302', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.resolvidos.leitor@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000d304', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.resolvidos.semarea@ensaio.invalid');
  insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo) values
    ('00000000-0000-4000-a000-00000000d301', 'ensaio.resolvidos.admin@ensaio.invalid', 'Ensaio Admin', 'admin', true),
    ('00000000-0000-4000-a000-00000000d302', 'ensaio.resolvidos.leitor@ensaio.invalid', 'Ensaio Leitor', 'ensaio_resolv_leitor', true),
    ('00000000-0000-4000-a000-00000000d304', 'ensaio.resolvidos.semarea@ensaio.invalid', 'Ensaio Sem Área', 'ensaio_resolv_leitor', true);
  insert into public."RL_PERFIL_USUARIO_AREA" ("CO_PERFIL_USUARIO", "CO_AREA")
  select p.id, c_area from public."TB_PERFIL_USUARIO" p
   where p.user_id = '00000000-0000-4000-a000-00000000d302';
  raise notice 'ok E3: atores criados';
end;
$$;

-- E4. A tela, como cada pessoa (papel authenticated).
set local role authenticated;
do $$
declare
  c_area constant text := current_setting('ensaio.area');
  c_aprovado constant text := current_setting('ensaio.aprovado');
  c_outro constant text := current_setting('ensaio.outro');
  c_admin constant text := '{"sub":"00000000-0000-4000-a000-00000000d301","role":"authenticated"}';
  c_leitor constant text := '{"sub":"00000000-0000-4000-a000-00000000d302","role":"authenticated"}';
  c_semarea constant text := '{"sub":"00000000-0000-4000-a000-00000000d304","role":"authenticated"}';
  v json;
  v_id uuid;
  v_caso json;
  v_nome text;
begin
  perform set_config('request.jwt.claims', c_leitor, true);
  select (a ->> 'id')::uuid into v_id
    from json_array_elements(public.listar_avisos_conferencia(c_area, 'aprovados') -> 'avisos') a
   where a ->> 'conferencia' = 'ENSAIO_RESOLVIDOS';
  if v_id is null then raise exception 'FALHOU E4: o leitor não vê o aviso do ensaio'; end if;

  v := public.listar_casos_aviso_conferencia(v_id);
  if exists (select 1 from json_array_elements(v -> 'casos') c
              where (c ->> 'referencia') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-') then
    raise exception 'FALHOU E4: referência UUID na saída';
  end if;
  if exists (select 1 from json_array_elements(v -> 'casos') c where c::text ~* 'cpf|email') then
    raise exception 'FALHOU E4: caso com cpf ou e-mail';
  end if;
  select c into v_caso from json_array_elements(v -> 'casos') c where c ->> 'aprovado_id' = c_aprovado;
  if v_caso is null or v_caso ->> 'resolucao' <> 'ok' or v_caso ->> 'nome' is null
     or v_caso ->> 'edital' is null or v_caso ->> 'status' is null or v_caso ->> 'tipo' <> 'candidato_aprovado' then
    raise exception 'FALHOU E4: o aprovado da área devia sair com nome, edital e situação';
  end if;
  if json_typeof(v_caso -> 'vinculos') <> 'array' or json_array_length(v_caso -> 'vinculos') < 1 then
    raise exception 'FALHOU E4: o aprovado devia trazer as vagas da pessoa';
  end if;
  v_nome := v_caso ->> 'nome';
  if (select count(*) from json_array_elements(v -> 'casos') c where c ->> 'resolucao' = 'removido') <> 1 then
    raise exception 'FALHOU E4: o UUID que não existe devia sair removido';
  end if;
  if c_outro <> '' and exists (select 1 from json_array_elements(v -> 'casos') c
                                where c ->> 'resolucao' = 'sem_acesso' and c ->> 'nome' is not null) then
    raise exception 'FALHOU E4: caso sem acesso com nome';
  end if;
  if c_outro <> '' and (select count(*) from json_array_elements(v -> 'casos') c where c ->> 'resolucao' = 'sem_acesso') <> 1 then
    raise exception 'FALHOU E4: o aprovado de outra área devia sair sem acesso para o leitor';
  end if;

  -- Busca pelo nome resolvido (sem acento, maiúsculas), no aviso e em todos.
  v := public.listar_casos_aviso_conferencia(v_id, upper(translate(left(btrim(v_nome), 6), 'áàâãéêíóôõúç', 'aaaaeeiooouc')));
  if (v ->> 'total')::int < 1 then raise exception 'FALHOU E4: busca pelo nome do aprovado'; end if;
  v := public.listar_casos_aviso_conferencia(null, v_nome, c_area, 'aprovados');
  if (select count(*) from json_array_elements(v -> 'casos') c where c ->> 'aviso_id' = v_id::text) < 1 then
    raise exception 'FALHOU E4: busca geral pelo nome do aprovado';
  end if;

  perform set_config('request.jwt.claims', c_semarea, true);
  begin
    perform public.listar_casos_aviso_conferencia(v_id);
    raise exception 'FALHOU E4: quem não tem a área leu os casos';
  exception when invalid_parameter_value then null;
  end;

  perform set_config('request.jwt.claims', c_admin, true);
  v := public.listar_casos_aviso_conferencia(v_id);
  if c_outro <> '' and (select count(*) from json_array_elements(v -> 'casos') c where c ->> 'resolucao' = 'ok') <> 2 then
    raise exception 'FALHOU E4: o administrador global devia resolver os dois aprovados';
  end if;
  raise notice 'ok E4: aprovado resolvido com vagas; removido e sem acesso sem dado; busca pelo nome';
end;
$$;

-- E5. O aviso REAL de "Contratado em duas vagas", como administrador global (só contagens).
create temp table tt_ensaio_real (avisos integer, casos integer, resolvidos integer, nao_resolvidos integer,
                                  com_nome integer, com_duas_vagas integer, uuid_na_referencia integer) on commit drop;
do $$
declare
  v json;
  v_id text;
  v_avisos integer := 0;
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000d301","role":"authenticated"}', true);
  insert into tt_ensaio_real values (0, 0, 0, 0, 0, 0, 0);
  for v_id in select a ->> 'id' from json_array_elements(public.listar_avisos_conferencia(null, 'aprovados') -> 'avisos') a
               where a ->> 'conferencia' = 'APROVADOS_CONTRATADO_DUPLICADO' loop
    v_avisos := v_avisos + 1;
    v := public.listar_casos_aviso_conferencia(v_id::uuid, null, null, null, 1000, 0);
    update tt_ensaio_real t set
      avisos = v_avisos,
      casos = t.casos + (v ->> 'total')::int,
      resolvidos = t.resolvidos + (select count(*) from json_array_elements(v -> 'casos') c where c ->> 'resolucao' = 'ok'),
      nao_resolvidos = t.nao_resolvidos + (select count(*) from json_array_elements(v -> 'casos') c where c ->> 'resolucao' <> 'ok'),
      com_nome = t.com_nome + (select count(*) from json_array_elements(v -> 'casos') c where c ->> 'nome' is not null),
      com_duas_vagas = t.com_duas_vagas + (select count(*) from json_array_elements(v -> 'casos') c
                                            where json_typeof(c -> 'vinculos') = 'array' and json_array_length(c -> 'vinculos') >= 2),
      uuid_na_referencia = t.uuid_na_referencia + (select count(*) from json_array_elements(v -> 'casos') c
                                                    where (c ->> 'referencia') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-');
  end loop;
  if (select uuid_na_referencia from tt_ensaio_real) <> 0 then
    raise exception 'FALHOU E5: referência UUID no aviso real';
  end if;
  raise notice 'ok E5: aviso real lido';
end;
$$;
reset role;
select set_config('request.jwt.claims', '', true);

-- Resumo (só contagens; o que o ensaio gravou e o aviso real, antes do rollback).
select
  'ENSAIO OK' as resultado,
  (select count(*) from public."TB_CASO_AVISO_CONFERENCIA" k
     join public."TB_AVISO_CONFERENCIA" a on a."CO_AVISO_CONFERENCIA" = k."CO_AVISO_CONFERENCIA"
    where a."CO_CONFERENCIA" = 'ENSAIO_RESOLVIDOS') as casos_do_ensaio,
  r.avisos as avisos_reais_contratado_duplicado,
  r.casos as casos_reais,
  r.resolvidos as casos_resolvidos,
  r.nao_resolvidos as casos_nao_resolvidos,
  r.com_nome as casos_com_nome,
  r.com_duas_vagas as casos_com_duas_ou_mais_vagas
  from tt_ensaio_real r;

rollback;
