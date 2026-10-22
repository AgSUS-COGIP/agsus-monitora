/*
  AVALIAÇÃO DOCUMENTAL: O RESUMO DAS PERGUNTAS DA CARGA VIRA INSTANTÂNEO

  Por quê: abrir o edital 114/2026 (5.491 candidatos em 29 vagas gravadas) na
  Avaliação documental estourava o tempo do banco ("canceling statement due to
  statement timeout"). obter_regra_analise levava 11–13 s porque, a cada
  abertura pela coordenação, montava o campo 'perguntas' lendo
  DS_COLUNA_ORIGINAL de todos os candidatos ativos das vagas do edital — o
  JSON de cada candidato era aberto uma vez por coluna de pergunta (92 colunas
  no 114) — e contava cada coluna com subconsultas correlacionadas.

  A conta sai do banco e da tela e vai para o Python do robô da Empregare
  (scripts/robo-empregare/resumo_das_perguntas.py, conta em
  python/monitora/avaliacao_documental/perguntas_da_carga.py). O banco guarda
  o resumo pronto, confere o formato e serve:
    TB_RESUMO_PERGUNTA_EDITAL   o resumo por edital (perguntas, até 30
                                respostas por pergunta, "outras",
                                "distintas"), a assinatura das vagas de que
                                saiu (DS_HASH_VAGA) e DT_ATUALIZACAO.
    private."FC_HASH_VAGA_EDITAL"(p_edital)
                                assinatura das vagas GRAVADA do edital com a
                                execução que as gravou: muda a cada carga.
    listar_resumos_pergunta_pendentes(p_editais, p_forcar)    (service_role)
                                editais com carga cujo resumo falta ou está
                                velho (ou todos, com p_forcar), com as vagas e
                                as colunas de pergunta.
    ler_respostas_pergunta_vaga(p_vaga)                       (service_role)
                                as respostas cruas da vaga (só colunas de
                                pergunta, candidatos ativos, sem espaços nas
                                pontas, até 200 caracteres). Sem conta.
    gravar_resumo_pergunta_edital(p_edital, p_hash, p_perguntas, p_candidatos)
                                (service_role) confere o formato (inclusive a
                                privacidade: nenhuma resposta com menos de 2
                                ocorrências, até 30 por pergunta, até 200
                                caracteres) e grava; carga que mudou no meio
                                (assinatura diferente) = 40001.
    obter_perguntas_carga_analise(p_edital)
                                RPC da tela: lê o resumo (só a coordenação;
                                os demais recebem lista vazia), com 'atual'
                                (a assinatura ainda bate). A tela chama só
                                quando a coordenação abre o passo "Perguntas
                                da Empregare" do assistente ou o formulário.
    obter_regra_analise         sem o campo 'perguntas' e com
                                FC_PAPEL_AVALIACAO chamada uma vez.

  Quando o resumo é feito: no fim de cada carga do robô, para todo edital com
  carga cujo resumo falta ou cuja assinatura mudou — a primeira carga depois
  desta migration já resume todos os editais carregados antes. Também à mão,
  sem entrar na Empregare: robo_empregare.py --resumir-perguntas [--forcar].
  Até lá, as perguntas aparecem vazias (a regra abre normalmente).

  Privacidade (igual à de antes): resposta que aparece uma vez só não sai
  (pode ser texto livre com dado pessoal) — vira a contagem "outras". A
  tabela não tem acesso direto do cliente (RLS ligada, sem grant).

  Ensaio: supabase/ensaios/20261009180000_resumo_das_perguntas_da_carga.sql
  Rollback: supabase/rollback/20261009180000_resumo_das_perguntas_da_carga.sql
*/
begin;

set local lock_timeout = '10s';

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TB_EMPREGARE_CANDIDATO"') is null
     or to_regprocedure('public.obter_regra_analise(uuid)') is null
     or to_regprocedure('private."FC_PAPEL_AVALIACAO"(uuid)') is null then
    raise exception 'Aplique antes 20261005170000_robo_empregare.sql e 20261006100000_regra_da_analise.sql.';
  end if;
end;
$$;

-- 1. O instantâneo ----------------------------------------------------------------------
create table public."TB_RESUMO_PERGUNTA_EDITAL" (
  "CO_MONITORAMENTO" uuid not null,
  "DS_PERGUNTA" jsonb not null default '[]'::jsonb,
  "QT_CANDIDATO" integer not null default 0,
  "DS_HASH_VAGA" varchar(32) not null,
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_RESUMO_PERGUNTA_EDITAL" primary key ("CO_MONITORAMENTO"),
  constraint "FK_MONITORAMENTO_RESPERGEDT" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id) on delete cascade,
  constraint "CK_RESPERGEDT_DSPERGUNTA" check (jsonb_typeof("DS_PERGUNTA") = 'array'),
  constraint "CK_RESPERGEDT_QTCANDIDATO" check ("QT_CANDIDATO" >= 0)
);
comment on table public."TB_RESUMO_PERGUNTA_EDITAL" is
  'Instantâneo das perguntas da última carga da Empregare por edital (o que a coordenação liga aos blocos da regra da avaliação documental). Calculado em Python pelo robô da Empregare ao fim de cada carga (scripts/robo-empregare/resumo_das_perguntas.py → gravar_resumo_pergunta_edital) e lido por obter_perguntas_carga_analise. Sem acesso direto do cliente.';
comment on column public."TB_RESUMO_PERGUNTA_EDITAL"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id).';
comment on column public."TB_RESUMO_PERGUNTA_EDITAL"."DS_PERGUNTA" is 'Lista [{coluna, respostas: [{valor, quantidade}], outras, distintas}] das colunas "Pergunta N" das vagas GRAVADA do edital, na ordem do número. Só respostas que aparecem 2+ vezes (até 30 por pergunta, 200 caracteres cada); as que aparecem uma vez entram só na contagem "outras".';
comment on column public."TB_RESUMO_PERGUNTA_EDITAL"."QT_CANDIDATO" is 'Candidatos ativos (TB_EMPREGARE_CANDIDATO) das vagas lidas.';
comment on column public."TB_RESUMO_PERGUNTA_EDITAL"."DS_HASH_VAGA" is 'md5 das vagas GRAVADA do edital com a execução que as gravou (FC_HASH_VAGA_EDITAL): mudou, o resumo está velho.';
comment on column public."TB_RESUMO_PERGUNTA_EDITAL"."DT_ATUALIZACAO" is 'Quando o resumo foi calculado.';
comment on constraint "PK_TB_RESUMO_PERGUNTA_EDITAL" on public."TB_RESUMO_PERGUNTA_EDITAL" is 'Um resumo por edital.';
comment on constraint "FK_MONITORAMENTO_RESPERGEDT" on public."TB_RESUMO_PERGUNTA_EDITAL" is 'Edital (o resumo sai com ele).';
comment on constraint "CK_RESPERGEDT_DSPERGUNTA" on public."TB_RESUMO_PERGUNTA_EDITAL" is 'O resumo é uma lista.';
comment on constraint "CK_RESPERGEDT_QTCANDIDATO" on public."TB_RESUMO_PERGUNTA_EDITAL" is 'Contagem não negativa.';

alter table public."TB_RESUMO_PERGUNTA_EDITAL" enable row level security;
revoke all on public."TB_RESUMO_PERGUNTA_EDITAL" from public, anon, authenticated;

-- 2. A assinatura das vagas -------------------------------------------------------------
create function private."FC_HASH_VAGA_EDITAL"(p_edital uuid)
returns varchar
language sql
stable
security definer
set search_path to ''
as $function$
  select md5(coalesce(string_agg(v."CO_VAGA" || ':' || coalesce(v."CO_SYNC", ''), ',' order by v."CO_VAGA"), ''))::varchar(32)
    from public."TB_EMPREGARE_VAGA" v
   where v."CO_MONITORAMENTO" = p_edital and v."TP_SITUACAO" = 'GRAVADA';
$function$;
comment on function private."FC_HASH_VAGA_EDITAL"(uuid) is
  'Assinatura das vagas GRAVADA do edital (código e execução que gravou, md5): muda a cada carga nova, vaga que sai ou entra. Compara com TB_RESUMO_PERGUNTA_EDITAL.DS_HASH_VAGA.';
revoke all on function private."FC_HASH_VAGA_EDITAL"(uuid) from public, anon, authenticated, service_role;

-- 3. O que o robô usa (só service_role) -------------------------------------------------
create function public.listar_resumos_pergunta_pendentes(p_editais text[] default null, p_forcar boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if cardinality(p_editais) > 200 then
    raise exception 'Até 200 editais' using errcode = '22023';
  end if;
  return (
    with com_carga as (
      select m.id, m.edital, private."FC_HASH_VAGA_EDITAL"(m.id) as hash
        from public."TB_MONITORAMENTO_INDIGENA" m
       where exists (select 1 from public."TB_EMPREGARE_VAGA" v
                      where v."CO_MONITORAMENTO" = m.id and v."TP_SITUACAO" = 'GRAVADA')
         and (p_editais is null or private."FC_NUMERO_EDITAL"(m.edital) = any (p_editais))
    )
    select jsonb_build_object('editais', coalesce(jsonb_agg(jsonb_build_object(
             'edital', e.id,
             'numero', private."FC_NUMERO_EDITAL"(e.edital),
             'hash', e.hash,
             'vagas', (select jsonb_agg(v."CO_VAGA" order by v."CO_VAGA")
                         from public."TB_EMPREGARE_VAGA" v
                        where v."CO_MONITORAMENTO" = e.id and v."TP_SITUACAO" = 'GRAVADA'),
             'colunas', coalesce((
               select jsonb_agg(distinct c.coluna)
                 from public."TB_EMPREGARE_VAGA" v,
                      lateral jsonb_array_elements_text(v."DS_COLUNA") c(coluna)
                where v."CO_MONITORAMENTO" = e.id and v."TP_SITUACAO" = 'GRAVADA'
                  and c.coluna ilike 'Pergunta %'), '[]'::jsonb))
             order by e.edital), '[]'::jsonb))
      from com_carga e
      left join public."TB_RESUMO_PERGUNTA_EDITAL" s on s."CO_MONITORAMENTO" = e.id
     where coalesce(p_forcar, false) or s."DS_HASH_VAGA" is distinct from e.hash);
end;
$function$;
comment on function public.listar_resumos_pergunta_pendentes(text[], boolean) is
  'Robô da Empregare (resumo_das_perguntas.py): os editais com carga GRAVADA cujo resumo das perguntas falta ou está velho (assinatura das vagas mudou) — ou todos, com p_forcar —, filtrados pelos números (p_editais, até 200). Por edital: id, número, assinatura, vagas e as colunas de pergunta. Só service_role.';
revoke all on function public.listar_resumos_pergunta_pendentes(text[], boolean) from public, anon, authenticated;
grant execute on function public.listar_resumos_pergunta_pendentes(text[], boolean) to service_role;

create function public.ler_respostas_pergunta_vaga(p_vaga text)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
           'vaga', p_vaga,
           'candidatos', count(*),
           'linhas', coalesce(jsonb_agg(x.linha) filter (where x.linha is not null), '[]'::jsonb))
    from (select (select jsonb_object_agg(e.key, left(btrim(e.value), 200))
                    from jsonb_each_text(c."DS_COLUNA_ORIGINAL") e
                   where e.key ilike 'Pergunta %' and coalesce(btrim(e.value), '') <> '') as linha
            from public."TB_EMPREGARE_CANDIDATO" c
           where c."CO_VAGA" = p_vaga and c."ST_REGISTRO_ATIVO" = 'S') x;
$function$;
comment on function public.ler_respostas_pergunta_vaga(text) is
  'Robô da Empregare (resumo_das_perguntas.py): as respostas cruas das colunas de pergunta dos candidatos ativos da vaga (sem espaços nas pontas, até 200 caracteres; vazias fora), uma linha por candidato com resposta, e quantos candidatos ativos. Nenhuma conta: o resumo é feito em Python. Só service_role.';
revoke all on function public.ler_respostas_pergunta_vaga(text) from public, anon, authenticated;
grant execute on function public.ler_respostas_pergunta_vaga(text) to service_role;

create function public.gravar_resumo_pergunta_edital(p_edital uuid, p_hash text, p_perguntas jsonb, p_candidatos integer)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_ruins integer;
begin
  if not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital) then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;
  if coalesce(p_candidatos, -1) < 0 then
    raise exception 'Contagem de candidatos inválida' using errcode = '22023';
  end if;
  if jsonb_typeof(p_perguntas) is distinct from 'array' or jsonb_array_length(p_perguntas) > 500 then
    raise exception 'Resumo: lista de até 500 perguntas' using errcode = '22023';
  end if;

  -- O formato e a privacidade: só colunas de pergunta; até 30 respostas, cada uma com 2+ ocorrências e até 200 caracteres.
  select count(*) into v_ruins
    from jsonb_array_elements(p_perguntas) p
   where case
           when jsonb_typeof(p) <> 'object'
             or jsonb_typeof(p -> 'coluna') is distinct from 'string'
             or jsonb_typeof(p -> 'respostas') is distinct from 'array'
             or jsonb_typeof(p -> 'outras') is distinct from 'number'
             or jsonb_typeof(p -> 'distintas') is distinct from 'number' then true
           when not (p ->> 'coluna' ilike 'Pergunta %') or length(p ->> 'coluna') > 1000
             or jsonb_array_length(p -> 'respostas') > 30
             or (p ->> 'outras')::numeric < 0
             or (p ->> 'distintas')::numeric < jsonb_array_length(p -> 'respostas') + (p ->> 'outras')::numeric then true
           else exists (
             select 1 from jsonb_array_elements(p -> 'respostas') r
              where case
                      when jsonb_typeof(r) <> 'object'
                        or jsonb_typeof(r -> 'valor') is distinct from 'string'
                        or jsonb_typeof(r -> 'quantidade') is distinct from 'number' then true
                      else length(r ->> 'valor') not between 1 and 200 or (r ->> 'quantidade')::numeric < 2
                    end)
         end;
  if v_ruins > 0 then
    raise exception 'Resumo fora do formato (% pergunta(s))', v_ruins using errcode = '22023';
  end if;

  if p_hash is distinct from private."FC_HASH_VAGA_EDITAL"(p_edital) then
    raise exception 'A carga do edital mudou desde a leitura; o resumo fica para a próxima vez' using errcode = '40001';
  end if;

  insert into public."TB_RESUMO_PERGUNTA_EDITAL" as r
    ("CO_MONITORAMENTO", "DS_PERGUNTA", "QT_CANDIDATO", "DS_HASH_VAGA", "DT_ATUALIZACAO")
  values (p_edital, p_perguntas, p_candidatos, p_hash, now())
  on conflict ("CO_MONITORAMENTO") do update set
    "DS_PERGUNTA" = excluded."DS_PERGUNTA", "QT_CANDIDATO" = excluded."QT_CANDIDATO",
    "DS_HASH_VAGA" = excluded."DS_HASH_VAGA", "DT_ATUALIZACAO" = excluded."DT_ATUALIZACAO";
  return jsonb_build_object('edital', p_edital, 'perguntas', jsonb_array_length(p_perguntas), 'candidatos', p_candidatos);
end;
$function$;
comment on function public.gravar_resumo_pergunta_edital(uuid, text, jsonb, integer) is
  'Robô da Empregare (resumo_das_perguntas.py): grava o resumo das perguntas da carga do edital calculado em Python. Confere o formato e a privacidade (só colunas "Pergunta N", até 30 respostas por pergunta, cada uma com 2+ ocorrências e até 200 caracteres) e a assinatura das vagas lida (p_hash; mudou = 40001). Só service_role.';
revoke all on function public.gravar_resumo_pergunta_edital(uuid, text, jsonb, integer) from public, anon, authenticated;
grant execute on function public.gravar_resumo_pergunta_edital(uuid, text, jsonb, integer) to service_role;

-- 4. A leitura da tela ------------------------------------------------------------------
create function public.obter_perguntas_carga_analise(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
  v_coordena boolean := coalesce(private."FC_PAPEL_AVALIACAO"(p_edital) = 'COORDENADOR', false);
  v_r public."TB_RESUMO_PERGUNTA_EDITAL";
  v_hash varchar;
begin
  -- Perguntas e respostas da última carga: só para a coordenação, que liga os blocos.
  if v_coordena then
    select * into v_r from public."TB_RESUMO_PERGUNTA_EDITAL" r where r."CO_MONITORAMENTO" = p_edital;
    v_hash := private."FC_HASH_VAGA_EDITAL"(p_edital);
  end if;
  return json_build_object(
    'schema_version', 1,
    'perguntas', coalesce(v_r."DS_PERGUNTA", '[]'::jsonb),
    'candidatos', v_r."QT_CANDIDATO",
    'atualizado_em', v_r."DT_ATUALIZACAO",
    'atual', v_r."CO_MONITORAMENTO" is not null and v_r."DS_HASH_VAGA" = v_hash);
end;
$function$;
comment on function public.obter_perguntas_carga_analise(uuid) is
  'As perguntas da última carga da Empregare do edital com as respostas encontradas (json; do resumo TB_RESUMO_PERGUNTA_EDITAL, calculado em Python pelo robô ao fim de cada carga): só as respostas que aparecem 2+ vezes, até 30 por pergunta; as únicas viram "outras". atual = o resumo é da carga vigente. Só para a coordenação do edital (os demais recebem lista vazia). Exige avaliacao_documental >= leitor, a área e o recorte da coordenação.';
revoke all on function public.obter_perguntas_carga_analise(uuid) from public, anon;
grant execute on function public.obter_perguntas_carga_analise(uuid) to authenticated, service_role;

create or replace function public.obter_regra_analise(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_papel text := private."FC_PAPEL_AVALIACAO"(p_edital);
  v_coordena boolean := coalesce(v_papel = 'COORDENADOR', false);
  v_vagas integer;
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  select count(*) into v_vagas
    from public."TB_EMPREGARE_VAGA" v
   where v."CO_MONITORAMENTO" = p_edital and v."TP_SITUACAO" = 'GRAVADA';

  return json_build_object(
    'schema_version', 1,
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade, 'area', v_area,
                                'numero', private."FC_NUMERO_EDITAL"(v_m.edital), 'id_unidade', v_m.id_unidade),
    'papel', v_papel,
    'pode_coordenar', v_coordena,
    'origem', coalesce((select o."TP_ORIGEM" from public."TB_ORIGEM_ANALISE_EDITAL" o where o."CO_MONITORAMENTO" = p_edital), 'PLANILHA'),
    'regra', private."FC_REGRA_ANALISE_JSON"(p_edital),
    'modelos', coalesce((
      select json_agg(json_build_object('codigo', d."CO_MODELO", 'nome', d."NO_MODELO", 'configuracao', d."DS_CONFIGURACAO")
             order by d."CO_MODELO")
        from public."TB_REGRA_ANALISE_MODELO" d where d."ST_ATIVO" = 'S'), '[]'::json),
    'nota_minima', (
      select json_build_object('nota_minima', h."DS_CONFIGURACAO" #> '{documental,nota_minima}',
                               'nota_minima_por_nivel', coalesce(h."DS_CONFIGURACAO" #> '{documental,nota_minima_por_nivel}', '{}'::jsonb),
                               'versao_regra_classificacao', r."NU_VERSAO_VIGENTE")
        from public."TB_REGRA_CLASSIFICACAO" r
        join public."TH_REGRA_CLASSIFICACAO" h
          on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
       where r."CO_MONITORAMENTO" = p_edital),
    'aldeias', (
      select json_build_object('quantidade', count(*), 'atualizado_em', max(a."DT_ATUALIZACAO"),
                               'fonte', (array_agg(a."DS_FONTE" order by a."DT_ATUALIZACAO" desc))[1])
        from public."TD_ALDEIA_DSEI" a
       where v_m.id_unidade is not null and a."CO_UNIDADE" = v_m.id_unidade::text and a."ST_ATIVO" = 'S'),
    'pode_carregar_aldeias', private.is_master(),
    'vagas_empregare', v_vagas,
    'fichas_concluidas', 0
  );
end;
$function$;
comment on function public.obter_regra_analise(uuid) is
  'A regra da avaliação documental do edital (json): vigente e versões, modelos para copiar, nota mínima da regra de classificação, aldeias do DSEI do edital, dono da avaliação, papel de quem está logado e quantas vagas da Empregare têm carga. As perguntas da carga saíram para obter_perguntas_carga_analise (20261009180000). fichas_concluidas fica 0 até as fichas da fase F3. Exige avaliacao_documental >= leitor, a área e o recorte da coordenação.';

commit;
