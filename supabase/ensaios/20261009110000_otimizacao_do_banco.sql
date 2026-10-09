/*
  ENSAIO de 20261009110000_otimizacao_do_banco.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres) e
  execute. Mede antes, aplica o corpo da migration (sem o begin/commit dela), mede
  depois e mostra só contagens, buffers, WAL e verdadeiro/falso (nenhum dado pessoal):
    E1  consultas e montagens que podiam usar os índices que saem e o último sync
        processado (obter_ultima_conferencia): plano e buffers antes × depois;
    E2  WAL de atualizar 2.000 análises (coluna indexada) antes × depois;
    E4  carga das entrevistas com linhas fictícias: a segunda carga igual regravava
        as notas (antes) e não regrava mais (depois); nota alterada ainda grava;
    E5  sincronizar_entrevistas com a mesma permissão, search_path e comentário;
        nenhuma FC_ sem comentário.
  Termina em ROLLBACK.
*/
begin;

create function pg_temp.ex(q text) returns text language plpgsql as $f$
declare r record; s text := '';
begin
  for r in execute 'explain (analyze, buffers, costs off) ' || q loop s := s || r."QUERY PLAN" || chr(10); end loop;
  return s;
end $f$;
create function pg_temp.resumo(v text) returns text language sql as $f$
  select coalesce((regexp_match(v, '(Index Only Scan Backward|Index Scan Backward|Index Only Scan|Index Scan|Bitmap Heap Scan|Seq Scan|Function Scan|Result)'))[1], '?')
      || coalesce(' ' || (regexp_match(v, '(?:Scan|Backward) using (\S+)'))[1], '')
      || ' | buffers ' || coalesce((regexp_match(v, 'Buffers: shared hit=(\d+)'))[1], '0')
$f$;
create temp table _r(etapa text, item text, fase text, valor text, ordem serial);
create temp table _q(item text, q text);
insert into _q values
  ('cronograma do edital', $q$ select * from public."TB_CRONOGRAMA_MONIT_INDIG" where monitoramento_id = (select id from public."TB_MONITORAMENTO_INDIGENA" order by id limit 1) order by ordem $q$),
  ('perfil por user_id', $q$ select * from public."TB_PERFIL_USUARIO" where user_id = '00000000-0000-0000-0000-000000000001'::uuid $q$),
  ('staging por sync', $q$ select count(*) from public."TM_ANALISE_CURRICULAR" where sync_id = '00000000-0000-0000-0000-000000000001'::uuid and entidade = 'DIM_EDITAIS' $q$),
  ('edital por chave', $q$ select * from public."TB_EDITAL_ANALISE" where grupo = 'x' and unidade = 'y' and edital = 'z' and ativo $q$),
  ('monitoramento ativo', $q$ select count(*) from public."TB_MONITORAMENTO_INDIGENA" where ativo and status = 'Em andamento' $q$),
  ('competencias do roteiro', $q$ select * from public."TB_ROTEIRO_COMPETENCIA" where "CO_ROTEIRO" = (select "CO_ROTEIRO" from public."TB_ROTEIRO_COMPETENCIA" limit 1) $q$),
  ('view analises todos', $q$ select count(*) from (select * from public."VW_ANALISES_DASHBOARD_BASE_TODOS" limit 500) x $q$),
  ('painel de analises SI (3 escopos)', $q$ select * from private."FC_MONTAR_PAINEL_ANALISE"('saude-indigena', array['ativo','inativo','desativadas'], true) $q$),
  ('pacote das entrevistas SI', $q$ select private."FC_MONTAR_ENTREVISTAS_AREA"('saude-indigena', null) $q$),
  ('ultimo sync processado (area)', $q$ select max(s.finished_at) from public."TL_SYNC_ANALISE" s where s.status = 'processado' and s."CO_PLANILHA" = 'saude-indigena' $q$),
  ('ultimo sync processado (todas)', $q$ select max(s.finished_at) from public."TL_SYNC_ANALISE" s where s.status = 'processado' $q$);

-- Antes ----------------------------------------------------------------------------------------
do $d$ declare r record; begin
  for r in select * from _q loop
    insert into _r(etapa, item, fase, valor) values ('E1', r.item, 'antes', pg_temp.resumo(pg_temp.ex(r.q)));
  end loop;
end $d$;

-- E2 antes: 2.000 análises com a unidade alterada (coluna de 5 índices, inclusive os que saem).
-- A primeira passada só aquece (imagens de página inteira depois do checkpoint); mede a segunda.
create temp table _alvo as select id from public."TB_ANALISE_CURRICULAR" order by id limit 2000;
create temp table _w(fase text, lsn pg_lsn);
update public."TB_ANALISE_CURRICULAR" a set unidade = a.unidade || ' ' from _alvo t where a.id = t.id;
insert into _w values ('ini_antes', pg_current_wal_insert_lsn());
update public."TB_ANALISE_CURRICULAR" a set unidade = left(a.unidade, -1) from _alvo t where a.id = t.id;
insert into _w values ('fim_antes', pg_current_wal_insert_lsn());

-- E4 antes: a mesma carga fictícia duas vezes com a função de hoje.
create temp table _carga(linhas jsonb);
insert into _carga values (jsonb_build_array(
  jsonb_build_object('unidade', 'Unidade Ensaio', 'edital', 'Edital Ensaio 999/2026', 'vaga', 'ENSAIO-1',
    'candidato', 'Pessoa Ficticia Um', 'codigo', 'ENS0001', 'modalidade', 'Ampla', 'cargo', 'Cargo Ensaio',
    'nota', '15,5', 'parecer', 'Apto', 'compareceu', 'Sim', 'link', '',
    'notas', jsonb_build_array(jsonb_build_object('criterio', 'Criterio Ensaio A', 'nota', '8'),
                               jsonb_build_object('criterio', 'Criterio Ensaio B', 'nota', '7,5'))),
  jsonb_build_object('unidade', 'Unidade Ensaio', 'edital', 'Edital Ensaio 999/2026', 'vaga', 'ENSAIO-1',
    'candidato', 'Pessoa Ficticia Dois', 'codigo', 'ENS0002', 'modalidade', 'Ampla', 'cargo', 'Cargo Ensaio',
    'nota', '12', 'parecer', 'Apto', 'compareceu', 'Sim', 'link', '',
    'notas', jsonb_build_array(jsonb_build_object('criterio', 'Criterio Ensaio A', 'nota', '6'),
                               jsonb_build_object('criterio', 'Criterio Ensaio B', 'nota', '6')))));
create temp table _upd(fase text, n bigint, ordem serial);
create function pg_temp.upd_notas() returns bigint language sql as $f$
  select coalesce((select n_tup_upd from pg_stat_xact_user_tables where relid = 'public."TB_ENTREVISTA_NOTA"'::regclass), 0)
$f$;
select public.sincronizar_entrevistas('ensaio_otimizacao_0001', 'saude-indigena', (select linhas from _carga));
insert into _upd(fase, n) values ('1a carga (insere)', pg_temp.upd_notas());
select public.sincronizar_entrevistas('ensaio_otimizacao_0001', 'saude-indigena', (select linhas from _carga));
insert into _upd(fase, n) values ('2a carga igual, funcao de hoje', pg_temp.upd_notas());

-- Corpo da migration -----------------------------------------------------------------------------
-- 1. Índices repetidos ou sem leitura ----------------------------------------------------------
drop index if exists public.idx_monitoramento_cronograma_monitoramento;
drop index if exists public.idx_perfis_usuarios_user_id;
drop index if exists public.idx_analises_staging_sync_id;
drop index if exists public.idx_analises_staging_sync_entidade;
drop index if exists public.idx_analises_editais_ativo_chave;
drop index if exists public."IN_FKROTEIROCOMPETENCIA_CO";
drop index if exists public.idx_monitoramento_indigena_ativo;
drop index if exists public.idx_monitoramento_indigena_ativo_uf;
drop index if exists public.idx_monitoramento_indigena_ativo_status;
drop index if exists public.idx_monitoramento_indigena_status_etapa;
drop index if exists public.idx_analises_curriculares_ativo_ordem_todos;
drop index if exists public.idx_analises_curriculares_ordem_todos;

-- 2. Último sync processado das análises ------------------------------------------------------
create index if not exists "IN_SYNCANALISE_PROCESSADO"
  on public."TL_SYNC_ANALISE" (finished_at)
  where status = 'processado';
comment on index public."IN_SYNCANALISE_PROCESSADO" is
  'Syncs das análises já processados por hora de término: o último (obter_ultima_conferencia), de todas as planilhas ou de uma, sem ler a tabela inteira.';

-- 3. Carga das entrevistas: só a nota que mudou -----------------------------------------------
CREATE OR REPLACE FUNCTION public.sincronizar_entrevistas(p_sync text, p_area text, p_linhas jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_qt integer;
begin
  if p_sync is null or p_sync !~ '^[A-Za-z0-9_-]{8,80}$' then
    raise exception 'Identificador de carga inválido' using errcode = '22023';
  end if;
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' or jsonb_array_length(p_linhas) not between 1 and 1000 then
    raise exception 'Envie de 1 a 1000 linhas por lote' using errcode = '22023';
  end if;

  insert into public."TL_SYNC_ENTREVISTA" ("CO_SYNC", "CO_AREA")
  values (p_sync, p_area)
  on conflict ("CO_SYNC") do nothing;
  if exists (select 1 from public."TL_SYNC_ENTREVISTA" s
              where s."CO_SYNC" = p_sync and (s."CO_AREA" <> p_area or s."TP_SITUACAO" <> 'EM_ANDAMENTO')) then
    raise exception 'Carga % já fechada ou de outra área', p_sync using errcode = '22023';
  end if;

  create temporary table if not exists pg_temp.tmp_entrevista_lote (
    chave text, unidade text, edital text, vaga text, candidato text, codigo text,
    modalidade text, cargo text, nota numeric, parecer text, compareceu text,
    link text, notas jsonb
  ) on commit drop;
  truncate pg_temp.tmp_entrevista_lote;

  insert into pg_temp.tmp_entrevista_lote
  select distinct on (x.chave) x.*
    from (
      select
        p_area || '|' || coalesce(private."FC_NUMERO_EDITAL"(l.edital), lower(l.edital)) || '|' || l.vaga || '|' ||
          coalesce(nullif(l.codigo, ''), 'nome:' || private."FC_TEXTO_BUSCA_RECURSO"(l.candidato)) as chave,
        l.unidade, l.edital, l.vaga, l.candidato, nullif(l.codigo, '') as codigo,
        nullif(array_to_string(array(
          select btrim(t) from unnest(string_to_array(replace(coalesce(l.modalidade, ''), '"', ''), ',')) t
           where btrim(t) <> ''), ' / '), '') as modalidade,
        nullif(l.cargo, '') as cargo,
        case when l.nota ~ '^-?\d+([.,]\d+)?$' then replace(l.nota, ',', '.')::numeric end as nota,
        case
          when private."FC_TEXTO_BUSCA_RECURSO"(l.parecer) ~ '(inapto|reprovad|nao apto)' then 'INAPTO'
          when private."FC_TEXTO_BUSCA_RECURSO"(l.parecer) ~ 'apto' then 'APTO'
          else 'SEM_PARECER' end as parecer,
        case
          when private."FC_TEXTO_BUSCA_RECURSO"(l.compareceu) ~ '^(nao|n|ausente|faltou)' then 'N'
          when private."FC_TEXTO_BUSCA_RECURSO"(l.compareceu) ~ '^(sim|s|compareceu|presente)' then 'S'
          end as compareceu,
        nullif(l.link, '') as link,
        coalesce(l.notas, '[]'::jsonb) as notas
      from jsonb_to_recordset(p_linhas) as l(
        unidade text, edital text, vaga text, candidato text, codigo text, modalidade text,
        cargo text, nota text, parecer text, compareceu text, link text, notas jsonb)
      where btrim(coalesce(l.candidato, '')) <> ''
        and btrim(coalesce(l.vaga, '')) <> ''
        and btrim(coalesce(l.edital, '')) <> ''
    ) x
   order by x.chave;

  insert into public."TB_ENTREVISTA" as e (
    "CO_AREA", "NO_UNIDADE", "DS_EDITAL", "CO_VAGA", "NO_CANDIDATO", "CO_CANDIDATO",
    "DS_MODALIDADE", "NO_CARGO", "VL_NOTA_TOTAL", "TP_PARECER", "ST_COMPARECEU",
    "DS_LINK_PLANILHA", "TP_ORIGEM", "DS_CHAVE_ORIGEM", "CO_SYNC", "ST_ATIVO")
  select p_area, left(coalesce(t.unidade, ''), 200), left(t.edital, 120), left(t.vaga, 60),
         left(t.candidato, 200), left(t.codigo, 60), left(t.modalidade, 300), left(t.cargo, 400),
         t.nota, t.parecer, t.compareceu, left(t.link, 500), 'planilha', t.chave, p_sync, 'S'
    from pg_temp.tmp_entrevista_lote t
  on conflict ("DS_CHAVE_ORIGEM") do update set
    "NO_UNIDADE" = excluded."NO_UNIDADE",
    "DS_EDITAL" = excluded."DS_EDITAL",
    "NO_CANDIDATO" = excluded."NO_CANDIDATO",
    "CO_CANDIDATO" = excluded."CO_CANDIDATO",
    "DS_MODALIDADE" = excluded."DS_MODALIDADE",
    "NO_CARGO" = excluded."NO_CARGO",
    "VL_NOTA_TOTAL" = excluded."VL_NOTA_TOTAL",
    "TP_PARECER" = excluded."TP_PARECER",
    "ST_COMPARECEU" = excluded."ST_COMPARECEU",
    "DS_LINK_PLANILHA" = excluded."DS_LINK_PLANILHA",
    "CO_SYNC" = excluded."CO_SYNC",
    "ST_ATIVO" = 'S',
    "DT_ATUALIZACAO" = now()
  where e."TP_ORIGEM" = 'planilha';

  -- Notas: upsert por ordem; ordem que sumiu fica com nota nula (nada é apagado).
  with n as (
    select e."CO_ENTREVISTA", (c.ord)::smallint as ordem,
           left(private."FC_CRITERIO_ENTREVISTA"(c.item->>'criterio'), 600) as criterio,
           case when (c.item->>'nota') ~ '^-?\d+([.,]\d+)?$' then replace(c.item->>'nota', ',', '.')::numeric end as nota
      from pg_temp.tmp_entrevista_lote t
      join public."TB_ENTREVISTA" e on e."DS_CHAVE_ORIGEM" = t.chave and e."TP_ORIGEM" = 'planilha'
      cross join lateral jsonb_array_elements(t.notas) with ordinality c(item, ord)
     where c.ord between 1 and 20 and btrim(coalesce(c.item->>'criterio', '')) <> ''
  )
  insert into public."TB_ENTREVISTA_NOTA" ("CO_ENTREVISTA", "NU_ORDEM", "DS_CRITERIO", "VL_NOTA")
  select "CO_ENTREVISTA", ordem, criterio, nota from n
  on conflict ("CO_ENTREVISTA", "NU_ORDEM") do update set
    "DS_CRITERIO" = excluded."DS_CRITERIO", "VL_NOTA" = excluded."VL_NOTA"
  -- Só a nota que mudou (20261009110000): a carga de hora em hora regravava todas
  -- (~100 mil linhas/dia, ~45 MB/dia de WAL que o Realtime decodifica).
  where ("TB_ENTREVISTA_NOTA"."DS_CRITERIO", "TB_ENTREVISTA_NOTA"."VL_NOTA")
        is distinct from (excluded."DS_CRITERIO", excluded."VL_NOTA");

  update public."TB_ENTREVISTA_NOTA" en set "VL_NOTA" = null
    from pg_temp.tmp_entrevista_lote t
    join public."TB_ENTREVISTA" e on e."DS_CHAVE_ORIGEM" = t.chave and e."TP_ORIGEM" = 'planilha'
   where en."CO_ENTREVISTA" = e."CO_ENTREVISTA"
     and en."NU_ORDEM" > (select count(*) from jsonb_array_elements(t.notas) x
                           where btrim(coalesce(x->>'criterio', '')) <> '')
     and en."VL_NOTA" is not null;

  select count(*) into v_qt from pg_temp.tmp_entrevista_lote;
  update public."TL_SYNC_ENTREVISTA" set "QT_LINHA" = "QT_LINHA" + v_qt where "CO_SYNC" = p_sync;
  return jsonb_build_object('recebidas', jsonb_array_length(p_linhas), 'gravadas', v_qt);
end;
$function$;

-- 3. Comentários que faltavam em objetos novos (catálogo corporativo, MAD) --------------------
comment on function private."FC_CODIGO_DE_COORDENACAO"(text) is
  'Código livre para uma coordenação nova a partir do nome: minúsculas sem acento, hífen no lugar do resto, até 60 caracteres, com sufixo numérico se já existir em TB_COORDENACAO.';
comment on function private."FC_COORDENACAO_JSON"(text) is
  'Coordenação em JSON (código, nome, área, responsável, ativo, revisão, unidades e editais), como a tela de Acessos e o histórico TH_COORDENACAO a usam.';
comment on function private."FC_DEFINIR_AREA_ANALISE"() is
  'Gatilho de TB_ANALISE_CURRICULAR: preenche CO_AREA pela área cujo NO_GRUPO_PLANILHA corresponde ao grupo da linha.';
comment on function private."FC_DEFINIR_AREA_EDITAL"() is
  'Gatilho de TB_MONITORAMENTO_INDIGENA: define CO_AREA na inclusão (por responsável e unidade) e o recalcula quando eles mudam; mudança explícita de CO_AREA é respeitada.';
comment on function private."FC_EXIGIR_GESTAO_DO_USUARIO"(public."TB_PERFIL_USUARIO") is
  'Recusa (42501) a alteração de acesso quando quem pede não pode gerir o usuário alvo: o próprio acesso, ou coordenador fora da sua coordenação.';
comment on function private."FC_EXIGIR_GESTOR_DE_ACESSOS"() is
  'Devolve o papel de gestor de acessos (admin ou coordenador) ou recusa (42501) quem não é nenhum dos dois.';
comment on function private."FC_GESTOR_DE_ACESSOS"() is
  'Papel de quem gerencia acessos: admin (administrador global), coordenador (com coordenação e acessos nível 2) ou nulo.';
comment on function private."FC_GRUPOS_ANALISES_DA_AREA"(text) is
  'Grupos da planilha de análises da área (TB_AREA.NO_GRUPO_PLANILHA), depois de conferir que a área existe e que o usuário pode vê-la.';
comment on function private."FC_GRUPO_ACESSO_JSON"(text) is
  'Grupo de acesso em JSON (código, nome, descrição, sistema, admin global, ordem, revisão, níveis por recurso e usuários), como a tela de Acessos e o histórico TH_GRUPO_ACESSO o usam.';
comment on function private."FC_GRUPO_CABE_NO_TETO"(text) is
  'Verdadeiro se quem pede pode atribuir o grupo: administrador global, ou grupo não admin cujos níveis não passam do teto do gestor (FC_TETO_DO_GESTOR).';
comment on function private."FC_RANK_NIVEL"(text) is
  'Ordem numérica do nível de acesso para comparação: admin 3, editor 2, leitor 1, outro 0.';
comment on function private."FC_TETO_DO_GESTOR"(text) is
  'Nível máximo que o gestor pode conceder no recurso: admin para o administrador global; sem_acesso em acessos e áreas; senão o próprio nível dele no recurso.';

comment on column private."TA_CANDIDATO_APROVADO_AREA"."CO_AREA" is 'Área do pacote (TB_AREA.CO_AREA).';
comment on column private."TA_PAINEL_ANALISE"."CO_AREA" is 'Área do pacote (TB_AREA.CO_AREA).';
comment on column private."TA_PAINEL_ANALISE"."TP_ESCOPO" is 'Escopo do pacote: ativo, inativo ou desativadas.';
comment on column public."TB_ANEXO_CANDIDATO_APROVADO"."CO_ANEXO" is 'Identificador do anexo.';
comment on column public."TB_ANEXO_CANDIDATO_APROVADO"."CO_CANDIDATO" is 'Candidato da lista de aprovados (TB_CANDIDATO_APROVADO.id).';
comment on column public."TB_ANEXO_CANDIDATO_APROVADO"."CO_USUARIO_INCLUSAO" is 'Usuário (auth.uid()) que anexou.';
comment on column public."TB_ANEXO_CANDIDATO_APROVADO"."DT_INCLUSAO" is 'Quando foi anexado.';
comment on column public."TB_CATEGORIA_CONVOCACAO"."CO_MODELO" is 'Modelo de convocação da categoria (TB_MODELO_CONVOCACAO).';
comment on column public."TB_CATEGORIA_CONVOCACAO"."NO_CATEGORIA" is 'Nome da categoria como aparece na tela e no quadro de vagas.';
comment on column public."TB_CATEGORIA_CONVOCACAO"."SG_CATEGORIA" is 'Sigla da categoria (até 10 caracteres), usada nas colunas do quadro.';
comment on column public."TB_CATEGORIA_CONVOCACAO"."NU_ORDEM" is 'Ordem da categoria dentro do modelo.';
comment on column public."TB_CONVOCACAO_EDITAL"."CO_MODELO" is 'Modelo de convocação usado pelo edital (TB_MODELO_CONVOCACAO).';
comment on column public."TB_CONVOCACAO_EDITAL"."CO_USUARIO_ATUALIZACAO" is 'Usuário (auth.uid()) da última alteração.';
comment on column public."TB_CONVOCACAO_EDITAL"."DT_CRIACAO" is 'Quando a ligação foi criada.';
comment on column public."TB_CONVOCACAO_EDITAL"."DT_ATUALIZACAO" is 'Quando a ligação foi alterada pela última vez.';
comment on column public."TB_MODELO_CONVOCACAO"."CO_MODELO" is 'Identificador do modelo.';
comment on column public."TB_MODELO_CONVOCACAO"."NO_MODELO" is 'Nome do modelo; identifica a regra (ex.: Lei 15.142/2025 - 25/3/2 e 5% PCD).';
comment on column public."TB_MODELO_CONVOCACAO"."CO_USUARIO_ATUALIZACAO" is 'Usuário (auth.uid()) da última alteração.';
comment on column public."TB_MODELO_CONVOCACAO"."DT_CRIACAO" is 'Quando o modelo foi criado.';
comment on column public."TB_MODELO_CONVOCACAO"."DT_ATUALIZACAO" is 'Quando o modelo foi alterado pela última vez.';
comment on column public."TB_VAGA_IMEDIATA"."CO_EDITAL" is 'Identificador do edital em TB_MONITORAMENTO_INDIGENA, como texto.';
comment on column public."TB_VAGA_IMEDIATA"."NO_CARGO" is 'Cargo da vaga, como veio na lista de aprovados.';
comment on column public."TB_VAGA_IMEDIATA"."CO_USUARIO_ATUALIZACAO" is 'Usuário (auth.uid()) da última alteração.';
comment on column public."TB_VAGA_IMEDIATA"."DT_CRIACAO" is 'Quando a linha foi criada.';
comment on column public."TB_VAGA_IMEDIATA"."DT_ATUALIZACAO" is 'Quando a linha foi alterada pela última vez.';
comment on column public."TH_COORDENACAO"."CO_HISTORICO" is 'Identificador do registro de histórico (sequencial).';
comment on column public."TH_COORDENACAO"."CO_COORDENACAO" is 'Coordenação alterada (TB_COORDENACAO).';
comment on column public."TH_COORDENACAO"."CO_ALTERADO_POR" is 'Usuário (auth.uid()) que fez a alteração.';
comment on column public."TH_COORDENACAO"."DT_ALTERACAO" is 'Quando a alteração foi feita.';
comment on column public."TH_COORDENACAO"."DS_MOTIVO" is 'Motivo informado na alteração.';
comment on column public."TH_GRUPO_ACESSO"."CO_HISTORICO" is 'Identificador do registro de histórico (sequencial).';
comment on column public."TH_GRUPO_ACESSO"."CO_GRUPO_ACESSO" is 'Grupo de acesso alterado (TB_GRUPO_ACESSO).';
comment on column public."TH_GRUPO_ACESSO"."CO_ALTERADO_POR" is 'Usuário (auth.uid()) que fez a alteração.';
comment on column public."TH_GRUPO_ACESSO"."DT_ALTERACAO" is 'Quando a alteração foi feita.';
comment on column public."TH_GRUPO_ACESSO"."DS_MOTIVO" is 'Motivo informado na alteração.';

-- Depois ---------------------------------------------------------------------------------------
do $d$ declare r record; begin
  for r in select * from _q loop
    insert into _r(etapa, item, fase, valor) values ('E1', r.item, 'depois', pg_temp.resumo(pg_temp.ex(r.q)));
  end loop;
end $d$;

insert into _w values ('ini_depois', pg_current_wal_insert_lsn());
update public."TB_ANALISE_CURRICULAR" a set unidade = a.unidade || ' ' from _alvo t where a.id = t.id;
insert into _w values ('fim_depois', pg_current_wal_insert_lsn());
insert into _r(etapa, item, fase, valor)
select 'E2', 'WAL de 2.000 analises atualizadas', 'antes',
       pg_size_pretty((select lsn from _w where fase = 'fim_antes') - (select lsn from _w where fase = 'ini_antes'));
insert into _r(etapa, item, fase, valor)
select 'E2', 'WAL de 2.000 analises atualizadas', 'depois',
       pg_size_pretty((select lsn from _w where fase = 'fim_depois') - (select lsn from _w where fase = 'ini_depois'));

select public.sincronizar_entrevistas('ensaio_otimizacao_0001', 'saude-indigena', (select linhas from _carga));
insert into _upd(fase, n) values ('3a carga igual, funcao nova', pg_temp.upd_notas());
update _carga set linhas = jsonb_set(linhas, '{0,notas,1,nota}', '"9"');
select public.sincronizar_entrevistas('ensaio_otimizacao_0001', 'saude-indigena', (select linhas from _carga));
insert into _upd(fase, n) values ('4a carga com uma nota mudada', pg_temp.upd_notas());
insert into _r(etapa, item, fase, valor)
select 'E4', u.fase, 'notas regravadas nesta carga', (u.n - coalesce(lag(u.n) over (order by u.ordem), 0))::text
  from _upd u order by u.ordem;
insert into _r(etapa, item, fase, valor)
select 'E4', 'nota alterada gravada', 'verdadeiro?',
       (exists (select 1 from public."TB_ENTREVISTA_NOTA" n
                  join public."TB_ENTREVISTA" e on e."CO_ENTREVISTA" = n."CO_ENTREVISTA"
                 where e."DS_CHAVE_ORIGEM" like 'saude-indigena|%|ENSAIO-1|ENS0001'
                   and n."NU_ORDEM" = 2 and n."VL_NOTA" = 9))::text;

insert into _r(etapa, item, fase, valor)
select 'E5', 'sincronizar_entrevistas: definer, search_path vazio, so postgres/service_role, comentario', 'verdadeiro?',
       (p.prosecdef and p.proconfig = array['search_path=""']
        and p.proacl::text = '{postgres=X/postgres,service_role=X/postgres}'
        and obj_description(p.oid, 'pg_proc') like 'Recebe um lote%')::text
  from pg_proc p where p.oid = 'public.sincronizar_entrevistas(text, text, jsonb)'::regprocedure;
insert into _r(etapa, item, fase, valor)
select 'E5', 'funcoes FC_ de private sem comentario', 'quantas', count(*)::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'private' and p.proname like 'FC\_%' and obj_description(p.oid, 'pg_proc') is null;
insert into _r(etapa, item, fase, valor)
select 'E5', 'indices de TB_ANALISE_CURRICULAR', 'quantos', count(*)::text
  from pg_index where indrelid = 'public."TB_ANALISE_CURRICULAR"'::regclass;

select string_agg(etapa || ' | ' || item || ' | ' || fase || ' | ' || valor, chr(10) order by etapa, item, ordem) as resultado from _r;

rollback;
