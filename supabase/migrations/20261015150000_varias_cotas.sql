/*
  VÁRIAS COTAS POR CANDIDATO (EDITAL 114/2026)

  Por quê: o edital 114/2026 manda que (5.1.5/5.1.6) só concorre às vagas de PcD quem
  INDICOU no campo da inscrição (a pergunta "Indique em qual sistema de concorrência…"),
  e que (5.8.1) quem optou por pretos e pardos, indígenas ou quilombolas concorre ao mesmo
  tempo às reservadas, à ampla e às de PcD, ficando AO FINAL só na de maior percentual
  (5.8.5; empate pela melhor posição relativa, 5.8.6), podendo constar, informativamente,
  nas listas de todos os grupos (5.8.7). Até aqui o MONITORA guardava UMA modalidade por
  inscrito (NO_MODALIDADE) e a ficha só abria o bloco dessa cota.

  O QUE MUDA
    1. TB_PRE_CLASSIFICACAO."DS_MODALIDADES" (jsonb, lista): as cotas optadas, sem a ampla,
       a principal primeiro (["PP","PCD"]; [] = só a ampla). NO_MODALIDADE continua a
       principal (lista do lote e do corte). Preenchida para as linhas já gravadas com a
       modalidade única (as outras ficam []).
    2. private."FC_LINHAS_PRE_CLASSIF"(jsonb): mais a coluna modalidades (o job manda; o
       job antigo, sem ela, vale pela modalidade única).
    3. private."FC_MODALIDADES_DO_LANCAMENTO"(jsonb): as cotas do lançamento da ficha
       (modalidades; sem a lista, a modalidade única), como modalidadesDoLancamento
       (pontuacao.js) e modalidades_do_lancamento (pontuacao.py).
    4. private."FC_BLOCO_SE_APLICA": o bloco de cota (condição MODALIDADE=X) vale se X está
       entre as cotas do lançamento (blocoSeAplica, ficha.js).
    5. private."FC_COTAS_CONFIRMADAS"(regra, lançamento, cotas): as optadas sem as de bloco
       Não conforme ou Não enviado, a final primeiro (PCD_MAIS_UMA → PcD; depois o maior
       percentual da regra de classificação; empate na ordem optada), como cotasConfirmadas
       (pontuacao.js). private."FC_MODALIDADES_DA_FICHA"(ficha): antes da análise, as
       optadas (pré-classificação); analisada, as confirmadas. private."FC_MODALIDADES_PUBLICADAS"
       e private."FC_PCD_DAS_MODALIDADES": a lista no vocabulário da planilha.
    6. public.gravar_pre_classificacao_vaga: confere e grava a lista (DS_MODALIDADES). Com
       statement_timeout de 30 s (o mesmo SET da migration paralela de limites).
    7. private."FC_PUBLICAR_FICHA_ANALISE": a linha publicada leva todas as cotas da ficha
       ("Pretos e pardos | Pessoas com deficiência (PCD)"; pcd SIM se a PcD está entre elas).
       A Classificação (motor.ts, modalidadesNaLista) já põe o candidato nas listas de todas
       na preliminar e só na de maior percentual na final (cotas.acumulo), com o desempate
       pela posição relativa.
    8. private."FC_ABRIR_FICHAS": a ficha não concluída passa às cotas de agora
       (DS_LANCAMENTO.modalidades, histórico MODALIDADE "PP → PP + PCD") e a linha publicada
       segue FC_MODALIDADES_DA_FICHA.
    9. private."FC_FICHA_ANALISE_JSON": mais a chave modalidades (a lista da pré-classificação).

  Nada muda para quem tem uma cota só ou nenhuma: a lista tem a mesma modalidade.

  Ensaio: supabase/ensaios/20261015150000_varias_cotas.sql
  Rollback: supabase/rollback/20261015150000_varias_cotas.sql
*/

begin;

-- 1. A lista das cotas optadas na pré-classificação -----------------------------------------
alter table public."TB_PRE_CLASSIFICACAO"
  add column if not exists "DS_MODALIDADES" jsonb not null default '[]'::jsonb;
alter table public."TB_PRE_CLASSIFICACAO"
  drop constraint if exists "CK_PRECLASSIF_DSMODALIDADES",
  add constraint "CK_PRECLASSIF_DSMODALIDADES" check (jsonb_typeof("DS_MODALIDADES") = 'array' and jsonb_array_length("DS_MODALIDADES") <= 10);
comment on column public."TB_PRE_CLASSIFICACAO"."DS_MODALIDADES" is
  'As cotas que o inscrito optou (códigos PP, PI, PQ, PCD…, sem a ampla), a principal primeiro: a ordem do acúmulo da regra de classificação (maior percentual; PCD_MAIS_UMA → PcD). [] = só a ampla. NO_MODALIDADE é a primeira (ou AC). Desde 20261015150000.';
comment on constraint "CK_PRECLASSIF_DSMODALIDADES" on public."TB_PRE_CLASSIFICACAO" is 'Lista de até 10 códigos.';
update public."TB_PRE_CLASSIFICACAO"
   set "DS_MODALIDADES" = jsonb_build_array("NO_MODALIDADE")
 where "NO_MODALIDADE" <> 'AC' and "DS_MODALIDADES" = '[]'::jsonb;

-- 2. As linhas do job com a lista ------------------------------------------------------------
drop function if exists private."FC_LINHAS_PRE_CLASSIF"(jsonb);
create function private."FC_LINHAS_PRE_CLASSIF"(p_linhas jsonb)
 RETURNS TABLE(id uuid, situacao text, motivo_codigo text, motivo text, art numeric, nota numeric, origem_nota text, declarada numeric, declarada_parciais jsonb, sem_mapa integer, divergente boolean, modalidade text, posicao integer, posicao_modalidade integer, lote integer, lista_lote text, entrada text, motivo_entrada text, declarada_completa boolean, declarada_congelada jsonb, modalidades jsonb)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select (l ->> 'id')::uuid, l ->> 'situacao', l ->> 'motivo_codigo', l ->> 'motivo',
         (l ->> 'art')::numeric, (l ->> 'nota')::numeric, l ->> 'origem_nota',
         (l ->> 'declarada')::numeric, case when jsonb_typeof(l -> 'declarada_parciais') = 'object' then l -> 'declarada_parciais' end,
         coalesce((l ->> 'sem_mapa')::integer, 0), coalesce((l ->> 'divergente')::boolean, false),
         coalesce(l ->> 'modalidade', 'AC'), (l ->> 'posicao')::integer, (l ->> 'posicao_modalidade')::integer,
         (l ->> 'lote')::integer, l ->> 'lista_lote', l ->> 'entrada', l ->> 'motivo_entrada',
         (l ->> 'declarada_completa')::boolean,
         case when jsonb_typeof(l -> 'declarada_congelada') = 'object' then l -> 'declarada_congelada' end,
         -- Sem a lista (job antigo): a modalidade única.
         case when l ? 'modalidades' then l -> 'modalidades'
              when coalesce(l ->> 'modalidade', 'AC') = 'AC' then '[]'::jsonb
              else jsonb_build_array(l ->> 'modalidade') end
    from jsonb_array_elements(p_linhas) l;
$function$;
comment on function private."FC_LINHAS_PRE_CLASSIF"(jsonb) is
  'As linhas da pré-classificação de uma vaga enviadas pelo job (lista json) como tabela tipada (com a declarada completa e a declarada congelada desde 20261007170000; com as cotas optadas, modalidades, desde 20261015150000 — sem a chave, a modalidade única); tipo inválido levanta erro de conversão.';
revoke all on function private."FC_LINHAS_PRE_CLASSIF"(jsonb) from public, anon, authenticated, service_role;

-- 3. As cotas do lançamento da ficha ---------------------------------------------------------
create or replace function private."FC_MODALIDADES_DO_LANCAMENTO"(p_lanc jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $function$
  select coalesce(array_agg(d.codigo order by d.ordem), '{}'::text[])
    from (select distinct on (s.codigo) s.codigo, s.ordem
            from (select upper(btrim(x.valor)) as codigo, x.ordem
                    from jsonb_array_elements_text(
                           case when jsonb_typeof(p_lanc -> 'modalidades') = 'array' then p_lanc -> 'modalidades'
                                else jsonb_build_array(coalesce(p_lanc ->> 'modalidade', '')) end)
                         with ordinality x(valor, ordem)) s
           where s.codigo ~ '^[A-Z]{2,10}$' and s.codigo <> 'AC'
           order by s.codigo, s.ordem) d;
$function$;
comment on function private."FC_MODALIDADES_DO_LANCAMENTO"(jsonb) is
  'As cotas do lançamento da ficha, na ordem (a principal primeiro): a lista modalidades ou, no lançamento antigo sem ela, a modalidade única; sem a ampla, sem repetir. {} = só a ampla. Como modalidadesDoLancamento (pontuacao.js) e modalidades_do_lancamento (pontuacao.py). Desde 20261015150000.';
revoke all on function private."FC_MODALIDADES_DO_LANCAMENTO"(jsonb) from public, anon, authenticated, service_role;

-- 4. O bloco de cota vale para quem optou pela cota ------------------------------------------
create or replace function private."FC_BLOCO_SE_APLICA"(p_bloco jsonb, p_lancamento jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
           when p_bloco -> 'nao_se_aplica' = 'true'::jsonb then false
           when private."FC_BLOCO_NAO_PONTUA_NO_NIVEL"(p_bloco, p_lancamento ->> 'nivel') then false
           when coalesce(p_bloco ->> 'condicao', case when p_bloco ->> 'tipo' = 'PONTUACAO' then 'INDIGENA' end) is null then true
           when coalesce(p_bloco ->> 'condicao', 'INDIGENA') = 'INDIGENA' then coalesce((p_lancamento ->> 'indigena')::boolean, false)
           else upper(btrim(split_part(p_bloco ->> 'condicao', '=', 2))) = any (private."FC_MODALIDADES_DO_LANCAMENTO"(p_lancamento))
         end;
$function$;
comment on function private."FC_BLOCO_SE_APLICA"(jsonb, jsonb) is
  'O bloco vale para o candidato (condição INDIGENA ou MODALIDADE=…; o critério étnico só para quem se declarou indígena; desde 20261015150000 o bloco de cota vale para quem optou pela cota, entre as várias do lançamento, FC_MODALIDADES_DO_LANCAMENTO; o bloco marcado nao_se_aplica pela diferença do cargo, FC_BLOCO_DO_CARGO, não vale; nem o que não pontua no nível da vaga, FC_BLOCO_NAO_PONTUA_NO_NIVEL, 20261014210000), como blocoSeAplica (ficha.js).';
revoke all on function private."FC_BLOCO_SE_APLICA"(jsonb, jsonb) from public, anon, authenticated, service_role;

-- 5. As cotas confirmadas, a final primeiro, e a publicação da lista -------------------------
create or replace function private."FC_COTAS_CONFIRMADAS"(p_regra jsonb, p_lanc jsonb, p_cotas jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $function$
  with optadas as (
    select o.codigo, o.ordem
      from unnest(private."FC_MODALIDADES_DO_LANCAMENTO"(p_lanc)) with ordinality o(codigo, ordem)
  ),
  negadas as (
    select upper(btrim(split_part(b ->> 'condicao', '=', 2))) as codigo
      from jsonb_array_elements(case when jsonb_typeof(p_regra -> 'blocos') = 'array' then p_regra -> 'blocos' else '[]'::jsonb end) b
     where jsonb_typeof(b) = 'object'
       and upper(btrim(split_part(b ->> 'condicao', '=', 1))) = 'MODALIDADE'
       and coalesce(p_lanc #>> array['blocos', b ->> 'codigo', 'situacao'], '') in ('NAO_CONFORME', 'NAO_ENVIADO')
  )
  select coalesce(array_agg(o.codigo order by
           case when p_cotas ->> 'acumulo' = 'PCD_MAIS_UMA' and o.codigo = 'PCD' then 0 else 1 end,
           case when jsonb_typeof(p_cotas #> array['percentuais', o.codigo]) = 'number'
                then (p_cotas #>> array['percentuais', o.codigo])::numeric else 0 end desc,
           o.ordem), '{}'::text[])
    from optadas o
   where o.codigo not in (select n.codigo from negadas n);
$function$;
comment on function private."FC_COTAS_CONFIRMADAS"(jsonb, jsonb, jsonb) is
  'As cotas optadas que a ficha confirmou, a final primeiro: sai a cota com bloco (condição MODALIDADE=<cota>) Não conforme ou Não enviado no lançamento. Ordem pelo acúmulo da regra de classificação (p_cotas {acumulo, percentuais}, FC_DOCUMENTAL_DO_EDITAL): PCD_MAIS_UMA → PcD primeiro; depois o maior percentual (114/2026, 5.8.5); empate na ordem optada. {} = ampla. Como cotasConfirmadas (pontuacao.js) e cotas_confirmadas (pontuacao.py). Desde 20261015150000.';
revoke all on function private."FC_COTAS_CONFIRMADAS"(jsonb, jsonb, jsonb) from public, anon, authenticated, service_role;

create or replace function private."FC_MODALIDADES_DA_FICHA"(p_ficha uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_f public."TB_FICHA_ANALISE";
  v_lista jsonb;
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha;
  if not found then
    return '{}'::text[];
  end if;
  -- Analisada (com resultado, concluída ou em revisão): as cotas confirmadas pelo lançamento.
  if v_f."TP_RESULTADO" is not null and v_f."TP_SITUACAO" in ('CONCLUIDA', 'REVISAR') then
    return private."FC_COTAS_CONFIRMADAS"(
      (select r.p_configuracao from private."FC_REGRA_VIGENTE_FICHA"(p_ficha) r),
      v_f."DS_LANCAMENTO",
      private."FC_DOCUMENTAL_DO_EDITAL"(v_f."CO_MONITORAMENTO") -> 'cotas');
  end if;
  -- Antes da análise: as optadas na pré-classificação.
  select p."DS_MODALIDADES" into v_lista
    from public."TB_PRE_CLASSIFICACAO" p
   where p."CO_MONITORAMENTO" = v_f."CO_MONITORAMENTO" and p."CO_EMPREGARE_CANDIDATO" = v_f."CO_EMPREGARE_CANDIDATO";
  return private."FC_MODALIDADES_DO_LANCAMENTO"(jsonb_build_object('modalidades', coalesce(v_lista, '[]'::jsonb)));
end;
$function$;
comment on function private."FC_MODALIDADES_DA_FICHA"(uuid) is
  'As cotas da ficha para publicar, a final primeiro: antes da análise, as optadas na pré-classificação (DS_MODALIDADES); analisada (resultado, CONCLUIDA ou REVISAR), as confirmadas pelo lançamento (FC_COTAS_CONFIRMADAS com a regra da ficha e as cotas da regra de classificação). {} = ampla. Desde 20261015150000.';
revoke all on function private."FC_MODALIDADES_DA_FICHA"(uuid) from public, anon, authenticated, service_role;

create or replace function private."FC_MODALIDADES_PUBLICADAS"(p_cotas text[])
returns text
language sql
immutable
set search_path = ''
as $function$
  select case when coalesce(cardinality(p_cotas), 0) = 0 then private."FC_MODALIDADE_PUBLICADA"('AC')
              else (select string_agg(private."FC_MODALIDADE_PUBLICADA"(c.codigo), ' | ' order by c.ordem)
                      from unnest(p_cotas) with ordinality c(codigo, ordem)) end;
$function$;
comment on function private."FC_MODALIDADES_PUBLICADAS"(text[]) is
  'As cotas (códigos) como a planilha de análises escreve modalidade_concorrencia, separadas por " | " ("Pretos e pardos | Pessoas com deficiência (PCD)"); nenhuma = "Ampla concorrência". Desde 20261015150000.';
revoke all on function private."FC_MODALIDADES_PUBLICADAS"(text[]) from public, anon, authenticated, service_role;

create or replace function private."FC_PCD_DAS_MODALIDADES"(p_cotas text[])
returns text
language sql
immutable
set search_path = ''
as $function$
  select case when 'PCD' = any (coalesce(p_cotas, '{}'::text[])) then 'SIM' else 'NÃO' end;
$function$;
comment on function private."FC_PCD_DAS_MODALIDADES"(text[]) is
  'A coluna pcd da planilha de análises pelas cotas: SIM se a PcD está entre elas. Desde 20261015150000.';
revoke all on function private."FC_PCD_DAS_MODALIDADES"(text[]) from public, anon, authenticated, service_role;

-- 9 (antes das funções que leem a ficha). O cabeçalho da ficha com a lista ------------------
create or replace function private."FC_FICHA_ANALISE_JSON"(p_ficha uuid)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select json_build_object(
           'id', f."CO_FICHA_ANALISE", 'versao', f."NU_VERSAO", 'edital', f."CO_MONITORAMENTO",
           'vaga', f."CO_VAGA", 'cargo', pv."NO_CARGO", 'lotacao', pv."NO_LOTACAO",
           'candidato', f."CO_EMPREGARE_CANDIDATO", 'codigo', c."CO_CANDIDATO_EMPREGARE", 'nome', c."NO_CANDIDATO",
           'posicao', p."NU_POSICAO", 'lote', f."NU_LOTE", 'art', p."VL_ART", 'nota', p."VL_NOTA_ORDEM",
           'modalidade', p."NO_MODALIDADE", 'modalidades', p."DS_MODALIDADES",
           'situacao', f."TP_SITUACAO", 'motivo_saida', f."DS_MOTIVO_SAIDA",
           'versao_regra', f."NU_VERSAO_REGRA",
           'responsavel', f."CO_USUARIO_RESPONSAVEL", 'responsavel_nome', coalesce(ur.nome, ur.email),
           'atribuida_em', f."DT_ATRIBUICAO",
           'reserva', case when f."DT_RESERVA_EXPIRA" > now() then json_build_object(
                             'usuario', f."CO_USUARIO_RESERVA", 'nome', coalesce(uv.nome, uv.email),
                             'desde', f."DT_RESERVA", 'expira', f."DT_RESERVA_EXPIRA") end)
    from public."TB_FICHA_ANALISE" f
    join public."TB_PRE_CLASSIFICACAO" p
      on p."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and p."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
    join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
    left join public."TB_PRE_CLASSIF_VAGA" pv on pv."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and pv."CO_VAGA" = f."CO_VAGA"
    left join public."TB_PERFIL_USUARIO" ur on ur.user_id = f."CO_USUARIO_RESPONSAVEL"
    left join public."TB_PERFIL_USUARIO" uv on uv.user_id = f."CO_USUARIO_RESERVA"
   where f."CO_FICHA_ANALISE" = p_ficha;
$function$;
comment on function private."FC_FICHA_ANALISE_JSON"(uuid) is
  'O cabeçalho da ficha (json): candidato pelo código e nome (sem CPF nem contato), vaga e cargo, posição, lote, ART, modalidade (a principal) e, desde 20261015150000, modalidades (as cotas optadas), situação, responsável, versão e a reserva vigente (quem, desde, até).';
revoke all on function private."FC_FICHA_ANALISE_JSON"(uuid) from public, anon, authenticated, service_role;

-- 6. A gravação da pré-classificação leva a lista (DS_MODALIDADES) ------------------------
CREATE OR REPLACE FUNCTION public.gravar_pre_classificacao_vaga(p_execucao text, p_edital uuid, p_vaga text, p_versao_regra integer, p_resumo jsonb, p_linhas jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '30s'
AS $function$
declare
  v_exec public."TL_PRE_CLASSIFICACAO" := private."FC_EXIGIR_EXECUCAO_PRECLASSIF"(p_execucao);
  v_refazer boolean := v_exec."ST_REFAZER_LOTE" = 'S';
  v_quadro public."TB_QUADRO_VAGA_EDITAL";
  v_qt integer;
  v_erro text;
  v_mudancas integer;
  v_avisos jsonb := coalesce(p_resumo -> 'avisos', '[]'::jsonb);
  v_ant jsonb;
  v_iniciadas integer;
  v_quadro_id uuid;
begin
  -- A regra usada é a vigente e está conferida.
  if not exists (select 1 from public."TB_REGRA_ANALISE" r
                  where r."CO_MONITORAMENTO" = p_edital and r."NU_VERSAO_VIGENTE" = p_versao_regra
                    and r."TP_SITUACAO" = 'CONFERIDA') then
    raise exception 'A regra do edital mudou ou não está conferida; rode de novo' using errcode = '40001';
  end if;
  -- Refazer o lote do zero só com TODAS as fichas do edital intocadas: PENDENTE (ou FORA_LOTE),
  -- nunca atribuídas, reservadas, salvas nem concluídas, e no histórico só as ações do lote
  -- (FC_FICHA_INICIADA). A trava é a mesma da abertura das fichas (20261013110000).
  if v_refazer then
    perform pg_advisory_xact_lock(hashtextextended('avaliacao-documental:fichas:' || p_edital::text, 0));
    v_iniciadas := private."FC_FICHAS_INICIADAS"(p_edital);
    if v_iniciadas > 0 then
      raise exception 'Lote não refeito: o lote já está em análise: % fichas iniciadas', v_iniciadas
        using errcode = '55000';
    end if;
  end if;
  if not exists (select 1 from public."TB_EMPREGARE_VAGA" v where v."CO_VAGA" = p_vaga and v."CO_MONITORAMENTO" = p_edital) then
    raise exception 'A vaga % não é do edital', p_vaga using errcode = '22023';
  end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' or jsonb_array_length(p_linhas) > 20000 then
    raise exception 'Linhas inválidas (lista de até 20000)' using errcode = '22023';
  end if;
  if jsonb_typeof(p_resumo) is distinct from 'object' or jsonb_typeof(v_avisos) <> 'array' or jsonb_array_length(v_avisos) > 50
     or exists (select 1 from jsonb_array_elements(v_avisos) a where jsonb_typeof(a) <> 'string' or a #>> '{}' !~ '^[A-Z][A-Z0-9_:]{1,59}$')
     or length(coalesce(p_resumo ->> 'descricao', '')) > 200
     or (p_resumo -> 'tamanho' is not null and jsonb_typeof(p_resumo -> 'tamanho') not in ('number', 'null'))
     or (p_resumo -> 'por_modalidade' is not null and jsonb_typeof(p_resumo -> 'por_modalidade') not in ('object', 'null'))
     or (p_resumo ? 'quadro' and jsonb_typeof(p_resumo -> 'quadro') not in ('string', 'null')) then
    raise exception 'Resumo da vaga inválido' using errcode = '22023';
  end if;

  -- As linhas lidas do JSON UMA vez (antes, cada conferência relia o p_linhas inteiro).
  drop table if exists pg_temp.t_linhas_vaga;
  begin
    create temporary table t_linhas_vaga on commit drop as
      select * from private."FC_LINHAS_PRE_CLASSIF"(p_linhas);
  exception when invalid_text_representation or numeric_value_out_of_range or datatype_mismatch then
    raise exception 'Linha com tipo inválido (id, nota, posição ou lote)' using errcode = '22023';
  end;
  analyze pg_temp.t_linhas_vaga;

  -- A forma do resultado (as mesmas regras das CK_, com mensagem clara).
  select case
    when exists (select 1 from pg_temp.t_linhas_vaga t where t.id is null) then 'linha sem id'
    when (select count(*) from pg_temp.t_linhas_vaga) <> (select count(distinct t.id) from pg_temp.t_linhas_vaga t) then 'inscrito repetido'
    when exists (select 1 from pg_temp.t_linhas_vaga t
                  where not exists (select 1 from public."TB_EMPREGARE_CANDIDATO" c
                                     where c."CO_EMPREGARE_CANDIDATO" = t.id and c."CO_VAGA" = p_vaga)) then 'inscrito que não é da vaga'
    when exists (select 1 from public."TB_PRE_CLASSIFICACAO" a
                  where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = p_vaga
                    and not exists (select 1 from pg_temp.t_linhas_vaga t where t.id = a."CO_EMPREGARE_CANDIDATO")) then 'faltam inscritos já pré-classificados'
    when exists (select 1 from pg_temp.t_linhas_vaga t where t.situacao is null or t.situacao not in ('ELIMINADO', 'RANQUEADO', 'NO_LOTE', 'ANALISADO')) then 'situação inválida'
    when exists (select 1 from pg_temp.t_linhas_vaga t
                  where (t.situacao = 'ELIMINADO') <> (t.motivo_codigo is not null)
                     or (t.motivo_codigo is not null and (t.motivo_codigo !~ '^[A-Z][A-Z0-9_]{1,29}$'
                         or coalesce(length(btrim(t.motivo)), 0) not between 1 and 200))) then 'eliminado sem motivo (ou motivo fora de eliminado)'
    when exists (select 1 from pg_temp.t_linhas_vaga t
                  where (t.situacao = 'ELIMINADO' and (t.posicao is not null or t.posicao_modalidade is not null))
                     or (t.situacao <> 'ELIMINADO' and (coalesce(t.posicao, 0) < 1 or coalesce(t.posicao_modalidade, 0) < 1))) then 'posição inválida'
    when (select count(*) from pg_temp.t_linhas_vaga t where t.situacao <> 'ELIMINADO')
         <> coalesce((select max(t.posicao) from pg_temp.t_linhas_vaga t where t.situacao <> 'ELIMINADO'), 0)
      or (select count(distinct t.posicao) from pg_temp.t_linhas_vaga t where t.situacao <> 'ELIMINADO')
         <> (select count(*) from pg_temp.t_linhas_vaga t where t.situacao <> 'ELIMINADO') then 'posições não vão de 1 a N sem repetir'
    when exists (select 1 from pg_temp.t_linhas_vaga t
                  where case when t.situacao in ('NO_LOTE', 'ANALISADO')
                             then coalesce(t.lote, 0) not between 1 and 999
                                  or coalesce(t.lista_lote, '') !~ '^(GERAL|[A-Z]{2,10})$'
                                  or coalesce(t.entrada, '') not in ('INICIAL', 'REPOSICAO', 'AMPLIACAO', 'DECISAO')
                                  or length(coalesce(t.motivo_entrada, '')) > 300
                             else t.lote is not null or t.lista_lote is not null or t.entrada is not null end) then 'lote inválido'
    when exists (select 1 from pg_temp.t_linhas_vaga t
                  where coalesce(t.origem_nota, 'ART') not in ('ART', 'DECLARADA')
                     or t.modalidade !~ '^[A-Z]{2,10}$'
                     -- As cotas optadas (20261015150000): códigos sem a ampla, a principal primeiro.
                     or jsonb_typeof(t.modalidades) is distinct from 'array'
                     or jsonb_array_length(t.modalidades) > 10
                     or exists (select 1 from jsonb_array_elements(t.modalidades) m
                                 where jsonb_typeof(m) <> 'string' or m #>> '{}' !~ '^[A-Z]{2,10}$' or m #>> '{}' = 'AC')
                     or (t.modalidade = 'AC') <> (jsonb_array_length(t.modalidades) = 0)
                     or (t.modalidade <> 'AC' and t.modalidades ->> 0 is distinct from t.modalidade)
                     or abs(coalesce(t.art, 0)) > 1000 or abs(coalesce(t.nota, 0)) > 1000 or abs(coalesce(t.declarada, 0)) > 1000
                     or t.sem_mapa not between 0 and 100) then 'nota, origem ou modalidade inválida'
    -- A declarada congelada: completa, com o total igual à declarada da linha.
    when exists (select 1 from pg_temp.t_linhas_vaga t
                  where t.declarada_congelada is not null
                    and (jsonb_typeof(t.declarada_congelada -> 'total') is distinct from 'number'
                         or (t.declarada_congelada ->> 'total')::numeric not between 0 and 1000
                         or (t.declarada_congelada ->> 'total')::numeric is distinct from t.declarada
                         or t.declarada_completa is not true
                         or jsonb_typeof(coalesce(t.declarada_congelada -> 'respostas', '[]'::jsonb)) <> 'array'
                         or jsonb_array_length(coalesce(t.declarada_congelada -> 'respostas', '[]'::jsonb)) > 20
                         or length(t.declarada_congelada::text) > 20000)) then 'declarada congelada inválida'
    else null end
    into v_erro;
  if v_erro is not null then
    raise exception 'Resultado da vaga % recusado: %', p_vaga, v_erro using errcode = '22023';
  end if;

  -- A situação de antes de cada inscrito (para as travas e o histórico).
  select coalesce(jsonb_object_agg(a."CO_EMPREGARE_CANDIDATO",
                                   jsonb_build_object('s', a."TP_SITUACAO", 'l', a."NU_LOTE", 'e', a."TP_ENTRADA_LOTE")), '{}'::jsonb)
    into v_ant
    from public."TB_PRE_CLASSIFICACAO" a
   where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = p_vaga;

  -- As decisões da coordenação (TB_DECISAO_LOTE): toda decisão vigente aplicada (no lote) e só
  -- entra por decisão quem tem decisão vigente, com o mesmo motivo.
  select case
    when exists (select 1 from pg_temp.t_linhas_vaga t
                   join public."TB_DECISAO_LOTE" d
                     on d."CO_MONITORAMENTO" = p_edital and d."CO_EMPREGARE_CANDIDATO" = t.id and d."ST_ATIVO" = 'S'
                  where t.situacao = 'RANQUEADO'
                     or (t.situacao = 'ELIMINADO' and t.motivo_codigo is distinct from 'SAIU_DA_EMPREGARE')) then 'decisão da coordenação não aplicada'
    when exists (select 1 from pg_temp.t_linhas_vaga t
                  where t.entrada = 'DECISAO'
                    and not exists (select 1 from public."TB_DECISAO_LOTE" d
                                     where d."CO_MONITORAMENTO" = p_edital and d."CO_EMPREGARE_CANDIDATO" = t.id and d."ST_ATIVO" = 'S'
                                       and btrim(d."DS_MOTIVO") = btrim(coalesce(t.motivo_entrada, '')))) then 'entrada por decisão sem decisão vigente'
    else null end
    into v_erro;
  if v_erro is not null then
    raise exception 'Resultado da vaga % recusado: %', p_vaga, v_erro using errcode = '22023';
  end if;

  -- A declarada congelada não muda: só a coordenação descongela (descongelar_declarada_pre_classificacao).
  if exists (select 1 from pg_temp.t_linhas_vaga t
               join public."TB_PRE_CLASSIFICACAO" a
                 on a."CO_MONITORAMENTO" = p_edital and a."CO_EMPREGARE_CANDIDATO" = t.id
              where a."VL_DECLARADA_CONGELADA" is not null and t.declarada is not null
                and t.declarada is distinct from a."VL_DECLARADA_CONGELADA") then
    raise exception 'Resultado da vaga % recusado: a nota declarada congelada não muda (descongele antes)', p_vaga using errcode = '22023';
  end if;

  -- Quem tem ficha (ANALISADO) não muda; ANALISADO só vem do banco (fase F3).
  if exists (select 1 from pg_temp.t_linhas_vaga t
               cross join lateral (select v_ant -> t.id::text ->> 's' as ant_situacao, (v_ant -> t.id::text ->> 'l')::integer as ant_lote) h
              where (h.ant_situacao is not distinct from 'ANALISADO') <> (t.situacao = 'ANALISADO')
                 or (h.ant_situacao = 'ANALISADO' and h.ant_lote is distinct from t.lote)) then
    raise exception 'Resultado da vaga % recusado: quem já tem ficha não muda', p_vaga using errcode = '22023';
  end if;
  -- Quem está no lote só sai eliminado (a não ser que a execução refaça o lote); quem entrou
  -- por decisão da coordenação já revogada sai.
  if not v_refazer and exists (
      select 1 from pg_temp.t_linhas_vaga t
       cross join lateral (select v_ant -> t.id::text ->> 's' as ant_situacao, (v_ant -> t.id::text ->> 'l')::integer as ant_lote,
                                  v_ant -> t.id::text ->> 'e' as ant_entrada) h
       where h.ant_situacao = 'NO_LOTE'
         and not (t.situacao = 'ELIMINADO' or (t.situacao = 'NO_LOTE' and t.lote = h.ant_lote))
         and not (h.ant_entrada = 'DECISAO'
                  and not exists (select 1 from public."TB_DECISAO_LOTE" d
                                   where d."CO_MONITORAMENTO" = p_edital and d."CO_EMPREGARE_CANDIDATO" = t.id and d."ST_ATIVO" = 'S'))) then
    raise exception 'Resultado da vaga % recusado: quem está no lote só sai eliminado (AM-5.5)', p_vaga using errcode = '22023';
  end if;

  -- Grava o resultado (rodar de novo atualiza a mesma linha: AM-4.2).
  insert into public."TB_PRE_CLASSIFICACAO" as a
    ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO", "CO_VAGA", "NU_VERSAO_REGRA", "TP_SITUACAO",
     "CO_MOTIVO_ELIMINACAO", "DS_MOTIVO_ELIMINACAO", "VL_ART", "VL_NOTA_ORDEM", "TP_ORIGEM_NOTA",
     "VL_NOTA_DECLARADA", "DS_NOTA_DECLARADA", "ST_DIVERGENTE", "NO_MODALIDADE", "NU_POSICAO",
     "NU_POSICAO_MODALIDADE", "NU_LOTE", "CO_LISTA_LOTE", "TP_ENTRADA_LOTE", "DS_MOTIVO_ENTRADA",
     "DT_ENTRADA_LOTE", "CO_EXECUCAO", "VL_DECLARADA_CONGELADA", "DS_DECLARADA_CONGELADA", "DT_CONGELAMENTO_DECLARADA",
     "DS_MODALIDADES")
  select p_edital, t.id, p_vaga, p_versao_regra, t.situacao,
         t.motivo_codigo, left(btrim(t.motivo), 200), t.art, t.nota, t.origem_nota,
         t.declarada,
         case when t.declarada is null then null
              else jsonb_build_object('parciais', coalesce(t.declarada_parciais, '{}'::jsonb), 'sem_mapa', t.sem_mapa,
                                      'completa', t.declarada_completa) end,
         case when t.divergente then 'S' else 'N' end, t.modalidade, t.posicao,
         t.posicao_modalidade, t.lote, t.lista_lote, t.entrada, nullif(left(btrim(t.motivo_entrada), 300), ''),
         case when t.lote is not null then now() end, p_execucao,
         (t.declarada_congelada ->> 'total')::numeric,
         case when t.declarada_congelada is not null
              then (t.declarada_congelada - 'total') || jsonb_build_object('versao_regra', p_versao_regra) end,
         case when t.declarada_congelada is not null then now() end,
         t.modalidades
    from pg_temp.t_linhas_vaga t
  on conflict ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO") do update set
    "NU_VERSAO_REGRA" = excluded."NU_VERSAO_REGRA",
    "TP_SITUACAO" = excluded."TP_SITUACAO",
    "CO_MOTIVO_ELIMINACAO" = excluded."CO_MOTIVO_ELIMINACAO",
    "DS_MOTIVO_ELIMINACAO" = excluded."DS_MOTIVO_ELIMINACAO",
    "VL_ART" = excluded."VL_ART",
    "VL_NOTA_ORDEM" = excluded."VL_NOTA_ORDEM",
    "TP_ORIGEM_NOTA" = excluded."TP_ORIGEM_NOTA",
    "VL_NOTA_DECLARADA" = excluded."VL_NOTA_DECLARADA",
    "DS_NOTA_DECLARADA" = excluded."DS_NOTA_DECLARADA",
    "ST_DIVERGENTE" = excluded."ST_DIVERGENTE",
    "NO_MODALIDADE" = excluded."NO_MODALIDADE",
    "DS_MODALIDADES" = excluded."DS_MODALIDADES",
    "NU_POSICAO" = excluded."NU_POSICAO",
    "NU_POSICAO_MODALIDADE" = excluded."NU_POSICAO_MODALIDADE",
    "NU_LOTE" = excluded."NU_LOTE",
    "CO_LISTA_LOTE" = excluded."CO_LISTA_LOTE",
    "TP_ENTRADA_LOTE" = excluded."TP_ENTRADA_LOTE",
    "DS_MOTIVO_ENTRADA" = excluded."DS_MOTIVO_ENTRADA",
    -- Quem continua no mesmo lote guarda a data de entrada.
    "DT_ENTRADA_LOTE" = case when excluded."NU_LOTE" is null then null
                             when a."NU_LOTE" is not distinct from excluded."NU_LOTE" then a."DT_ENTRADA_LOTE"
                             else now() end,
    "CO_EXECUCAO" = excluded."CO_EXECUCAO",
    -- A congelada fica como estava; só entra quando ainda não há.
    "VL_DECLARADA_CONGELADA" = coalesce(a."VL_DECLARADA_CONGELADA", excluded."VL_DECLARADA_CONGELADA"),
    "DS_DECLARADA_CONGELADA" = case when a."VL_DECLARADA_CONGELADA" is not null then a."DS_DECLARADA_CONGELADA"
                                    else excluded."DS_DECLARADA_CONGELADA" end,
    "DT_CONGELAMENTO_DECLARADA" = case when a."VL_DECLARADA_CONGELADA" is not null then a."DT_CONGELAMENTO_DECLARADA"
                                       else excluded."DT_CONGELAMENTO_DECLARADA" end,
    "DT_ATUALIZACAO" = now();

  -- Histórico: entrada na lista, troca de situação ou de lote (com o motivo).
  insert into public."TH_PRE_CLASSIFICACAO"
    ("CO_EXECUCAO", "CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO", "CO_VAGA", "TP_SITUACAO_ANTERIOR",
     "TP_SITUACAO", "NU_LOTE_ANTERIOR", "NU_LOTE", "NU_POSICAO", "DS_MOTIVO")
  select p_execucao, p_edital, t.id, p_vaga, h.ant_situacao, t.situacao, h.ant_lote, t.lote, t.posicao,
         left(case when t.situacao = 'ELIMINADO' then t.motivo
                   when t.entrada = 'DECISAO' and h.ant_entrada is distinct from 'DECISAO'
                     then 'Incluído no lote por decisão da coordenação: ' || t.motivo_entrada
                   when h.ant_entrada = 'DECISAO' and t.lote is null
                     then 'Saiu do lote: a decisão da coordenação foi revogada'
                   when t.lote is not null and t.lote is distinct from h.ant_lote then t.motivo_entrada
                   when h.ant_situacao = 'NO_LOTE' and t.situacao = 'RANQUEADO' then 'Saiu do lote: o recorte foi refeito'
                   when h.ant_situacao is null then 'Entrou na Provisória'
                   else null end, 300)
    from pg_temp.t_linhas_vaga t
   cross join lateral (select v_ant -> t.id::text ->> 's' as ant_situacao, (v_ant -> t.id::text ->> 'l')::integer as ant_lote,
                              v_ant -> t.id::text ->> 'e' as ant_entrada) h
   where h.ant_situacao is null
      or h.ant_situacao is distinct from t.situacao
      or h.ant_lote is distinct from t.lote
      or h.ant_entrada is distinct from t.entrada;
  get diagnostics v_mudancas = row_count;

  -- O resumo da vaga: contagens feitas aqui. A linha do quadro é a que o job leu nesta execução
  -- (pre_classificacao_ler_candidatos, p_resumo.quadro; nula = vaga sem quadro), conferida aqui
  -- (do edital e ativa); sem a chave, o banco acha a linha (FC_QUADRO_DA_VAGA_EMPREGARE, até 1,8 s).
  if p_resumo ? 'quadro' then
    if jsonb_typeof(p_resumo -> 'quadro') = 'string' then
      begin
        v_quadro_id := (p_resumo ->> 'quadro')::uuid;
      exception when invalid_text_representation then
        raise exception 'Resumo da vaga inválido (quadro)' using errcode = '22023';
      end;
      select * into v_quadro from public."TB_QUADRO_VAGA_EDITAL" q
       where q."CO_QUADRO_VAGA" = v_quadro_id and q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S';
      if not found then
        raise exception 'Resumo da vaga % recusado: a linha do quadro não é do edital (ou não está ativa)', p_vaga
          using errcode = '22023';
      end if;
    end if;
  else
    v_quadro := private."FC_QUADRO_DA_VAGA_EMPREGARE"(p_edital, p_vaga);
  end if;
  select count(*) into v_qt from pg_temp.t_linhas_vaga;
  insert into public."TB_PRE_CLASSIF_VAGA" as pv
    ("CO_MONITORAMENTO", "CO_VAGA", "CO_EXECUCAO", "NU_VERSAO_REGRA", "CO_QUADRO_VAGA", "NO_CARGO", "NO_LOTACAO",
     "QT_VAGA_IMEDIATA", "ST_CADASTRO_RESERVA", "QT_INSCRITO", "QT_ELIMINADO", "QT_RANQUEADO", "QT_LOTE",
     "QT_TAMANHO_LOTE", "DS_TAMANHO_LOTE", "DS_TAMANHO_MODALIDADE", "VL_ART_CORTE", "QT_DIVERGENCIA", "QT_SEM_ART",
     "QT_ACIMA_CORTE", "NU_ULTIMO_LOTE", "DS_AVISO")
  select p_edital, p_vaga, p_execucao, p_versao_regra, v_quadro."CO_QUADRO_VAGA", v_quadro."NO_CARGO", v_quadro."NO_LOTACAO",
         v_quadro."QT_VAGA_IMEDIATA", coalesce(v_quadro."ST_CADASTRO_RESERVA", 'N'), v_qt,
         count(*) filter (where t.situacao = 'ELIMINADO'),
         count(*) filter (where t.situacao <> 'ELIMINADO'),
         count(*) filter (where t.situacao in ('NO_LOTE', 'ANALISADO')),
         case when jsonb_typeof(p_resumo -> 'tamanho') = 'number'
              then greatest(0, least(100000, (p_resumo ->> 'tamanho')::numeric))::integer end,
         nullif(left(btrim(coalesce(p_resumo ->> 'descricao', '')), 200), ''),
         case when jsonb_typeof(p_resumo -> 'por_modalidade') = 'object' then p_resumo -> 'por_modalidade' end,
         -- A linha de corte só com os da regra (quem entrou por decisão fica fora).
         min(t.nota) filter (where t.situacao in ('NO_LOTE', 'ANALISADO') and t.entrada is distinct from 'DECISAO'),
         count(*) filter (where t.divergente),
         count(*) filter (where t.situacao <> 'ELIMINADO' and t.art is null),
         case when jsonb_typeof(p_resumo -> 'acima_do_corte') = 'number'
              then greatest(0, least(100000, (p_resumo ->> 'acima_do_corte')::numeric))::integer else 0 end,
         coalesce(max(t.lote), 0),
         v_avisos
    from pg_temp.t_linhas_vaga t
  on conflict ("CO_MONITORAMENTO", "CO_VAGA") do update set
    "CO_EXECUCAO" = excluded."CO_EXECUCAO",
    "NU_VERSAO_REGRA" = excluded."NU_VERSAO_REGRA",
    "CO_QUADRO_VAGA" = excluded."CO_QUADRO_VAGA",
    "NO_CARGO" = excluded."NO_CARGO",
    "NO_LOTACAO" = excluded."NO_LOTACAO",
    "QT_VAGA_IMEDIATA" = excluded."QT_VAGA_IMEDIATA",
    "ST_CADASTRO_RESERVA" = excluded."ST_CADASTRO_RESERVA",
    "QT_INSCRITO" = excluded."QT_INSCRITO",
    "QT_ELIMINADO" = excluded."QT_ELIMINADO",
    "QT_RANQUEADO" = excluded."QT_RANQUEADO",
    "QT_LOTE" = excluded."QT_LOTE",
    "QT_TAMANHO_LOTE" = excluded."QT_TAMANHO_LOTE",
    "DS_TAMANHO_LOTE" = excluded."DS_TAMANHO_LOTE",
    "DS_TAMANHO_MODALIDADE" = excluded."DS_TAMANHO_MODALIDADE",
    "VL_ART_CORTE" = excluded."VL_ART_CORTE",
    "QT_DIVERGENCIA" = excluded."QT_DIVERGENCIA",
    "QT_SEM_ART" = excluded."QT_SEM_ART",
    "QT_ACIMA_CORTE" = excluded."QT_ACIMA_CORTE",
    "NU_ULTIMO_LOTE" = greatest(pv."NU_ULTIMO_LOTE", excluded."NU_ULTIMO_LOTE"),
    "DS_AVISO" = excluded."DS_AVISO",
    "DT_ATUALIZACAO" = now();

  return jsonb_build_object('vaga', p_vaga, 'inscritos', v_qt, 'mudancas', v_mudancas);
end;
$function$;
comment on function public.gravar_pre_classificacao_vaga(text, uuid, text, integer, jsonb, jsonb) is
  'Grava a pré-classificação PRONTA de uma vaga (calculada pelo job Python): confere a regra vigente e conferida (40001), que os inscritos são da vaga, que nenhum já gravado falta, a forma (eliminado com motivo, posições de 1 a N, lote com número, lista e entrada; desde 20261015150000 as cotas optadas — modalidades, sem a ampla, a principal primeiro — gravadas em DS_MODALIDADES), que quem tem ficha não muda, que quem está no lote só sai eliminado (salvo execução que refaz o lote — desde 20261013110000 só com todas as fichas do edital intocadas, senão 55000 "o lote já está em análise: N fichas iniciadas" — ou, desde 20261007200000, quem entrou por decisão já revogada), que a nota declarada congelada não muda e, desde 20261007200000, que toda decisão vigente da coordenação (TB_DECISAO_LOTE) foi aplicada e só entra por decisão (entrada DECISAO, com o motivo da decisão) quem a tem; grava o histórico das mudanças com o motivo e o resumo da vaga (contagens feitas no banco, a linha de corte só com os da regra). Desde 20261014130000 o p_linhas é lido uma vez e a linha do quadro vem do job (p_resumo.quadro: id lido em pre_classificacao_ler_candidatos, conferido do edital e ativo; nulo = sem quadro; sem a chave, lida no banco). Limite de 30 s (statement_timeout). 22023 com o motivo da recusa. Só service_role.';
revoke all on function public.gravar_pre_classificacao_vaga(text, uuid, text, integer, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.gravar_pre_classificacao_vaga(text, uuid, text, integer, jsonb, jsonb) to service_role;

-- 7. A publicação pelas cotas da ficha ----------------------------------------------------
CREATE OR REPLACE FUNCTION private."FC_PUBLICAR_FICHA_ANALISE"(p_ficha uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_f public."TB_FICHA_ANALISE";
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_c public."TB_EMPREGARE_CANDIDATO";
  v_p public."TB_PRE_CLASSIFICACAO";
  v_pv public."TB_PRE_CLASSIF_VAGA";
  v_grupo text;
  v_planilha text;
  v_numero text;
  v_codigo text;
  v_chave text;
  v_id uuid;
  v_com_nota boolean;
  v_inapto_requisito boolean;
  v_status text;
  v_etapa text;
  v_responsavel text;
  v_data date;
  v_nome_vaga text;
  v_modalidade text;
  v_pcd text;
  v_cotas text[];
  v_parciais jsonb;
  v_exp jsonb;
  v_dias integer;
  v_exp_si numeric;
  v_exp_ab numeric;
  v_formacao numeric;
  v_cursos numeric;
  v_experiencia numeric;
  v_etnico numeric;
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha;
  if not found then
    return null;
  end if;
  -- Só o edital com a avaliação no MONITORA publica (PLANILHA e COMPARACAO não).
  if not exists (select 1 from public."TB_ORIGEM_ANALISE_EDITAL" o
                  where o."CO_MONITORAMENTO" = v_f."CO_MONITORAMENTO" and o."TP_ORIGEM" = 'MONITORA') then
    return null;
  end if;

  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = v_f."CO_MONITORAMENTO";
  select a."NO_GRUPO_PLANILHA" into v_grupo from public."TB_AREA" a where a."CO_AREA" = v_m."CO_AREA";
  select p."CO_PLANILHA" into v_planilha
    from public."TB_PLANILHA_ANALISE" p
   where p."CO_AREA" = v_m."CO_AREA"
   order by p."CO_PLANILHA" = v_m."CO_AREA" desc, p."CO_PLANILHA"
   limit 1;
  if v_grupo is null or v_planilha is null then
    raise exception 'Área % sem grupo ou planilha de análises: a ficha não tem onde publicar', v_m."CO_AREA"
      using errcode = '23514';
  end if;

  select * into v_c from public."TB_EMPREGARE_CANDIDATO" where "CO_EMPREGARE_CANDIDATO" = v_f."CO_EMPREGARE_CANDIDATO";
  select * into v_p from public."TB_PRE_CLASSIFICACAO"
   where "CO_MONITORAMENTO" = v_f."CO_MONITORAMENTO" and "CO_EMPREGARE_CANDIDATO" = v_f."CO_EMPREGARE_CANDIDATO";
  select * into v_pv from public."TB_PRE_CLASSIF_VAGA"
   where "CO_MONITORAMENTO" = v_f."CO_MONITORAMENTO" and "CO_VAGA" = v_f."CO_VAGA";

  -- Situação e etapa no vocabulário da planilha (o que o painel e a Classificação leem).
  v_com_nota := v_f."TP_RESULTADO" is not null and v_f."TP_SITUACAO" in ('CONCLUIDA', 'REVISAR');
  v_inapto_requisito := v_f."TP_RESULTADO" = 'INAPTO_REQUISITO';
  v_status := case
    when v_f."TP_SITUACAO" = 'CONCLUIDA' and v_f."TP_RESULTADO" = 'APTO' then 'Aprovado'
    when v_f."TP_SITUACAO" = 'CONCLUIDA' then 'Reprovado'
    when v_f."TP_SITUACAO" = 'REVISAR' then 'Revisar'
    when v_f."TP_SITUACAO" = 'EM_ANALISE' then 'Em análise'
    else 'Pendente'
  end;
  -- Etapa só com decisão, como na planilha (sem decisão, nem etapa nem data).
  v_etapa := case
    when v_status = 'Aprovado' then 'Triados'
    when v_status = 'Reprovado' then 'Reprovado'
    when v_status = 'Revisar' then 'Avaliação documental'
  end;
  select coalesce(nullif(btrim(u.nome), ''), u.email) into v_responsavel
    from public."TB_PERFIL_USUARIO" u
   where u.user_id = coalesce(case when v_com_nota then v_f."CO_USUARIO_CONCLUSAO" end, v_f."CO_USUARIO_RESPONSAVEL")
   order by u.ativo desc nulls last
   limit 1;
  v_data := case when v_com_nota
                 then (coalesce(v_f."DT_CONCLUSAO", v_f."DT_ATUALIZACAO") at time zone 'America/Sao_Paulo')::date end;

  v_nome_vaga := nullif(concat_ws(' - ', nullif(btrim(v_pv."NO_CARGO"), ''), nullif(btrim(v_pv."NO_LOTACAO"), '')), '');
  -- A modalidade e a PcD pelas cotas da ficha (20261015150000): antes da análise, as optadas;
  -- analisada, as confirmadas (sem as de bloco Não conforme/Não enviado). Todas vão para a
  -- linha ("Pretos e pardos | Pessoas com deficiência (PCD)"): a Classificação põe o candidato
  -- nas listas de todas na preliminar (5.8.7) e, na final, só na de maior percentual (5.8.5 e
  -- 5.8.6, cotas.acumulo da regra de classificação). Nenhuma: "Ampla concorrência".
  v_cotas := private."FC_MODALIDADES_DA_FICHA"(p_ficha);
  v_modalidade := private."FC_MODALIDADES_PUBLICADAS"(v_cotas);
  v_pcd := private."FC_PCD_DAS_MODALIDADES"(v_cotas);

  -- Parciais e experiência só da ficha concluída (ou em revisão); inapto por requisito vale 0.
  if v_com_nota then
    v_parciais := v_f."DS_RESULTADO" -> 'parciais';
    v_exp := v_f."DS_RESULTADO" -> 'experiencia';
    v_formacao := case when v_inapto_requisito then 0 else coalesce(public.jsonb_num_or_null(v_parciais, 'FORMACAO'), 0) end;
    v_cursos := case when v_inapto_requisito then 0 else coalesce(public.jsonb_num_or_null(v_parciais, 'CURSOS'), 0) end;
    v_experiencia := case when v_inapto_requisito then 0 else coalesce(public.jsonb_num_or_null(v_parciais, 'EXPERIENCIA'), 0) end;
    v_etnico := case when v_inapto_requisito then 0 else coalesce(public.jsonb_num_or_null(v_parciais, 'ETNICO'), 0) end;
    v_dias := public.jsonb_int_or_null(v_exp, 'dias_total');
    if jsonb_typeof(v_exp -> 'por_categoria') = 'object' then
      select sum(public.jsonb_num_or_null(c.value, 'dias_total')) filter (where c.key ilike '%indigen%'),
             sum(public.jsonb_num_or_null(c.value, 'dias_total')) filter (where c.key ilike '%atenc%basic%' or c.key ilike '%aps%')
        into v_exp_si, v_exp_ab
        from jsonb_each(v_exp -> 'por_categoria') c
       where jsonb_typeof(c.value) = 'object';
    end if;
  end if;

  -- A linha: a da ficha, ou a da planilha (mesmo edital, vaga e código), adotada; MONITORA primeiro.
  v_numero := private."FC_NUMERO_EDITAL"(v_m.edital);
  v_codigo := nullif(btrim(v_c."CO_CANDIDATO_EMPREGARE"), '');
  v_chave := 'monitora|' || v_f."CO_MONITORAMENTO" || '|' || v_f."CO_EMPREGARE_CANDIDATO";
  select a.id into v_id from public."TB_ANALISE_CURRICULAR" a where a.chave_natural = v_chave;
  if v_id is null and v_codigo is not null and v_numero is not null then
    select a.id into v_id
      from public."TB_ANALISE_CURRICULAR" a
     where btrim(a.id_origem) = v_codigo
       and a.codigo_vaga = v_f."CO_VAGA"
       and a."CO_AREA" = v_m."CO_AREA"
       and private."FC_NUMERO_EDITAL"(a.edital) = v_numero
     order by a."TP_ORIGEM_REGISTRO" = 'MONITORA' desc, a.ativo desc, a.updated_at desc, a.id
     limit 1;
  end if;

  if v_id is null then
    insert into public."TB_ANALISE_CURRICULAR" (
      chave_natural, grupo, unidade, edital, codigo_vaga, nome_vaga, candidato, id_origem, data_nascimento,
      modalidade_concorrencia, pcd, nota_empregare, status_consolidado, etapa, responsavel_analise, data_analise,
      nota_final_ajustada, somatorio, pontuacao_escolaridade, pontuacao_cursos_aperfeicoamento,
      pontuacao_experiencia_profissional, pontuacao_criterio_etnico, experiencia_saude_indigena_total,
      experiencia_atencao_basica_total, experiencia_profissional_anos, experiencia_profissional_meses,
      experiencia_profissional_dias, experiencia_profissional_total, analise, origem_planilha, ativo,
      ultima_atualizacao, "CO_PLANILHA", "TP_ORIGEM_REGISTRO")
    values (
      v_chave, v_grupo, coalesce(nullif(btrim(v_m.unidade), ''), 'Não informada'), coalesce(nullif(btrim(v_m.edital), ''), 'Sem edital'),
      v_f."CO_VAGA", v_nome_vaga, v_c."NO_CANDIDATO", v_codigo, v_c."DT_NASCIMENTO",
      v_modalidade, v_pcd, v_p."VL_ART", v_status, v_etapa, v_responsavel, v_data,
      case when v_com_nota then v_f."VL_NOTA_FINAL" end, case when v_com_nota then v_f."VL_NOTA_APURADA" end,
      v_formacao, v_cursos, v_experiencia, v_etnico, v_exp_si, v_exp_ab,
      v_dias / 365, (v_dias % 365) / 30, (v_dias % 365) % 30, v_dias,
      case when v_com_nota then v_f."DS_PARECER" end,
      case when private."FC_EH_TREINAMENTO"(v_m."ST_TREINAMENTO") then 'treinamento' end,
      v_f."TP_SITUACAO" <> 'FORA_LOTE', now(), v_planilha, 'MONITORA')
    returning id into v_id;
    return v_id;
  end if;

  -- Linha existente: edital, unidade e grupo ficam (a linha adotada mantém a identidade da planilha).
  update public."TB_ANALISE_CURRICULAR" a set
    codigo_vaga = v_f."CO_VAGA",
    nome_vaga = coalesce(v_nome_vaga, a.nome_vaga),
    candidato = coalesce(v_c."NO_CANDIDATO", a.candidato),
    id_origem = coalesce(v_codigo, a.id_origem),
    data_nascimento = coalesce(v_c."DT_NASCIMENTO", a.data_nascimento),
    modalidade_concorrencia = coalesce(v_modalidade, a.modalidade_concorrencia),
    pcd = v_pcd,
    nota_empregare = coalesce(v_p."VL_ART", a.nota_empregare),
    status_consolidado = v_status,
    etapa = v_etapa,
    responsavel_analise = v_responsavel,
    data_analise = v_data,
    nota_final_ajustada = case when v_com_nota then v_f."VL_NOTA_FINAL" end,
    somatorio = case when v_com_nota then v_f."VL_NOTA_APURADA" end,
    pontuacao_escolaridade = v_formacao,
    pontuacao_cursos_aperfeicoamento = v_cursos,
    pontuacao_experiencia_profissional = v_experiencia,
    pontuacao_criterio_etnico = v_etnico,
    experiencia_saude_indigena_total = v_exp_si,
    experiencia_atencao_basica_total = v_exp_ab,
    experiencia_profissional_anos = v_dias / 365,
    experiencia_profissional_meses = (v_dias % 365) / 30,
    experiencia_profissional_dias = (v_dias % 365) % 30,
    experiencia_profissional_total = v_dias,
    analise = case when v_com_nota then v_f."DS_PARECER" end,
    ativo = v_f."TP_SITUACAO" <> 'FORA_LOTE',
    "TP_ORIGEM_REGISTRO" = 'MONITORA',
    ultima_atualizacao = now()
   where a.id = v_id
     and (a.codigo_vaga, a.nome_vaga, a.candidato, a.id_origem, a.data_nascimento, a.modalidade_concorrencia, a.pcd,
          a.nota_empregare, a.status_consolidado, a.etapa, a.responsavel_analise, a.data_analise, a.nota_final_ajustada,
          a.somatorio, a.pontuacao_escolaridade, a.pontuacao_cursos_aperfeicoamento, a.pontuacao_experiencia_profissional,
          a.pontuacao_criterio_etnico, a.experiencia_saude_indigena_total, a.experiencia_atencao_basica_total,
          a.experiencia_profissional_total, a.analise, a.ativo, a."TP_ORIGEM_REGISTRO")
         is distinct from
         (v_f."CO_VAGA"::text, coalesce(v_nome_vaga, a.nome_vaga), coalesce(v_c."NO_CANDIDATO"::text, a.candidato),
          coalesce(v_codigo, a.id_origem), coalesce(v_c."DT_NASCIMENTO", a.data_nascimento),
          private.normalizar_modalidade_concorrencia(coalesce(v_modalidade, a.modalidade_concorrencia)), v_pcd,
          coalesce(v_p."VL_ART", a.nota_empregare), v_status, v_etapa, v_responsavel, v_data,
          case when v_com_nota then v_f."VL_NOTA_FINAL" end, case when v_com_nota then v_f."VL_NOTA_APURADA" end,
          v_formacao, v_cursos, v_experiencia, v_etnico, v_exp_si, v_exp_ab, v_dias::numeric,
          case when v_com_nota then v_f."DS_PARECER" end, v_f."TP_SITUACAO" <> 'FORA_LOTE', 'MONITORA'::varchar);
  return v_id;
end;
$function$;
comment on function private."FC_PUBLICAR_FICHA_ANALISE"(uuid) is
  'Publica a ficha do edital com a avaliação no MONITORA em TB_ANALISE_CURRICULAR (a linha da ficha ou a da planilha adotada), no vocabulário da planilha; desde 20261015150000 a modalidade e a PcD pelas cotas da ficha (FC_MODALIDADES_DA_FICHA: as optadas antes da análise, as confirmadas depois; todas na linha, a Classificação escolhe a final pelo acúmulo), FC_MODALIDADES_PUBLICADAS e FC_PCD_DAS_MODALIDADES. Só grava o que mudou.';
revoke all on function private."FC_PUBLICAR_FICHA_ANALISE"(uuid) from public, anon, authenticated, service_role;

-- 8. As fichas seguem as cotas da pré-classificação --------------------------------------
CREATE OR REPLACE FUNCTION private."FC_ABRIR_FICHAS"(p_edital uuid, p_atribuicoes jsonb, p_usuario uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_regra public."TB_REGRA_ANALISE";
  v_atrib jsonb := coalesce(p_atribuicoes, '[]'::jsonb);
  v_item record;
  v_criados uuid[] := '{}';
  v_saem integer := 0;
  v_voltam integer := 0;
  v_atribuidas integer := 0;
  v_regra_nova integer := 0;
  v_modalidade integer := 0;
  v_republicadas integer := 0;
  v_publicar record;
  v_ficha public."TB_FICHA_ANALISE";
  v_origem constant text := case when p_usuario is null then 'JOB' else 'TELA' end;
begin
  -- Uma abertura por edital de cada vez (job e tela não se atropelam).
  perform pg_advisory_xact_lock(hashtextextended('avaliacao-documental:fichas:' || p_edital::text, 0));
  select * into v_regra from public."TB_REGRA_ANALISE" where "CO_MONITORAMENTO" = p_edital;
  if v_regra."CO_REGRA_ANALISE" is null then
    raise exception 'O edital ainda não tem regra da avaliação' using errcode = '22023';
  end if;
  if jsonb_typeof(v_atrib) <> 'array' or jsonb_array_length(v_atrib) > 20000 then
    raise exception 'Atribuições inválidas (lista de até 20.000)' using errcode = '22023';
  end if;

  -- Seguem o último recálculo: a ficha ainda não concluída fica com a versão da regra da
  -- pré-classificação atual; a concluída mantém a versão com que foi analisada.
  update public."TB_FICHA_ANALISE" f
     set "NU_VERSAO_REGRA" = p."NU_VERSAO_REGRA", "DT_ATUALIZACAO" = now()
    from public."TB_PRE_CLASSIFICACAO" p
   where p."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and p."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
     and f."CO_MONITORAMENTO" = p_edital
     and f."TP_SITUACAO" <> 'CONCLUIDA'
     and f."NU_VERSAO_REGRA" is distinct from p."NU_VERSAO_REGRA";
  get diagnostics v_regra_nova = row_count;

  -- Saem do lote: eliminados (ou fora do recorte) com ficha aberta. A ficha fica, com o motivo.
  -- Fora do lote refeito (a execução da linha refez o lote): "Lote refeito em dd/mm", ação REFAZER_LOTE.
  -- O histórico (o mesmo de FC_HISTORICO_FICHA) sai no mesmo comando, com a ficha já atualizada.
  with alvo as (
    select f."CO_FICHA_ANALISE" as ficha, f."TP_SITUACAO" as situacao, f."CO_USUARIO_RESPONSAVEL" as responsavel,
           left(case when p."TP_SITUACAO" = 'RANQUEADO' and t."CO_EXECUCAO" is not null
                     then 'Lote refeito em ' || to_char(t."DT_INICIO" at time zone 'America/Sao_Paulo', 'DD/MM')
                     else coalesce(p."DS_MOTIVO_ELIMINACAO", 'Saiu do lote de convocação') end, 300) as motivo,
           case when p."TP_SITUACAO" = 'RANQUEADO' and t."CO_EXECUCAO" is not null
                then 'REFAZER_LOTE' else 'SAIR_LOTE' end as acao
      from public."TB_FICHA_ANALISE" f
      join public."TB_PRE_CLASSIFICACAO" p
        on p."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and p."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
      left join public."TL_PRE_CLASSIFICACAO" t on t."CO_EXECUCAO" = p."CO_EXECUCAO" and t."ST_REFAZER_LOTE" = 'S'
     where f."CO_MONITORAMENTO" = p_edital
       and f."TP_SITUACAO" in ('PENDENTE', 'EM_ANALISE', 'REVISAR')
       and p."TP_SITUACAO" in ('ELIMINADO', 'RANQUEADO')
  ),
  saiu as (
    update public."TB_FICHA_ANALISE" f set
      "TP_SITUACAO" = 'FORA_LOTE', "DS_MOTIVO_SAIDA" = a.motivo,
      "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null, "DT_RESERVA_EXPIRA" = null,
      "NU_VERSAO" = f."NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
      from alvo a
     where f."CO_FICHA_ANALISE" = a.ficha
    returning f."CO_FICHA_ANALISE" as ficha, f."NU_VERSAO" as versao, f."TP_SITUACAO" as situacao,
              f."CO_USUARIO_RESPONSAVEL" as responsavel, a.acao, a.situacao as situacao_anterior,
              a.responsavel as responsavel_anterior, a.motivo
  )
  insert into public."TH_FICHA_ANALISE"
    ("CO_FICHA_ANALISE", "NU_VERSAO", "TP_ACAO", "TP_SITUACAO_ANTERIOR", "TP_SITUACAO", "CO_USUARIO_RESP_ANTERIOR",
     "CO_USUARIO_RESPONSAVEL", "DS_MOTIVO", "TP_ORIGEM", "CO_USUARIO")
  select s.ficha, s.versao, s.acao, s.situacao_anterior, s.situacao, s.responsavel_anterior, s.responsavel,
         nullif(left(btrim(coalesce(s.motivo, '')), 2000), ''), v_origem, p_usuario
    from saiu s;
  get diagnostics v_saem = row_count;

  -- Voltam ao lote: quem saiu e está no lote de novo recomeça livre na fila.
  with alvo as (
    select f."CO_FICHA_ANALISE" as ficha, f."CO_USUARIO_RESPONSAVEL" as responsavel,
           coalesce('Voltou ao lote refeito em ' || to_char(t."DT_INICIO" at time zone 'America/Sao_Paulo', 'DD/MM'),
                    p."DS_MOTIVO_ENTRADA", 'Voltou ao lote de convocação') as motivo
      from public."TB_FICHA_ANALISE" f
      join public."TB_PRE_CLASSIFICACAO" p
        on p."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and p."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
      left join public."TL_PRE_CLASSIFICACAO" t on t."CO_EXECUCAO" = p."CO_EXECUCAO" and t."ST_REFAZER_LOTE" = 'S'
     where f."CO_MONITORAMENTO" = p_edital and f."TP_SITUACAO" = 'FORA_LOTE'
       and p."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO')
  ),
  voltou as (
    update public."TB_FICHA_ANALISE" f set
      "TP_SITUACAO" = 'PENDENTE', "DS_MOTIVO_SAIDA" = null, "CO_USUARIO_RESPONSAVEL" = null, "DT_ATRIBUICAO" = null,
      "NU_VERSAO" = f."NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
      from alvo a
     where f."CO_FICHA_ANALISE" = a.ficha
    returning f."CO_FICHA_ANALISE" as ficha, f."NU_VERSAO" as versao, f."TP_SITUACAO" as situacao,
              f."CO_USUARIO_RESPONSAVEL" as responsavel, a.responsavel as responsavel_anterior, a.motivo
  )
  insert into public."TH_FICHA_ANALISE"
    ("CO_FICHA_ANALISE", "NU_VERSAO", "TP_ACAO", "TP_SITUACAO_ANTERIOR", "TP_SITUACAO", "CO_USUARIO_RESP_ANTERIOR",
     "CO_USUARIO_RESPONSAVEL", "DS_MOTIVO", "TP_ORIGEM", "CO_USUARIO")
  select v.ficha, v.versao, 'VOLTAR_LOTE', 'FORA_LOTE', v.situacao, v.responsavel_anterior, v.responsavel,
         nullif(left(btrim(coalesce(v.motivo, '')), 2000), ''), v_origem, p_usuario
    from voltou v;
  get diagnostics v_voltam = row_count;

  -- As cotas seguem a pré-classificação (20261015020000; a lista desde 20261015150000): a ficha
  -- não concluída com lançamento gravado passa às cotas optadas de agora (DS_LANCAMENTO.modalidades,
  -- a principal primeiro, e .modalidade = a principal): o bloco de cota passa a valer para quem optou
  -- e deixa de valer para quem não optou, com o histórico (MODALIDADE). Só muda o que difere (o
  -- lançamento antigo sem a lista vale pela modalidade única, FC_MODALIDADES_DO_LANCAMENTO). A
  -- concluída fica como foi analisada (reabra para conferir a cota).
  with alvo as (
    select f."CO_FICHA_ANALISE" as ficha, f."TP_SITUACAO" as situacao, f."CO_USUARIO_RESPONSAVEL" as responsavel,
           private."FC_MODALIDADES_DO_LANCAMENTO"(f."DS_LANCAMENTO") as de,
           private."FC_MODALIDADES_DO_LANCAMENTO"(jsonb_build_object('modalidades', p."DS_MODALIDADES")) as para,
           coalesce(nullif(btrim(p."NO_MODALIDADE"), ''), 'AC') as principal
      from public."TB_FICHA_ANALISE" f
      join public."TB_PRE_CLASSIFICACAO" p
        on p."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and p."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
     where f."CO_MONITORAMENTO" = p_edital
       and f."TP_SITUACAO" <> 'CONCLUIDA'
       and jsonb_typeof(f."DS_LANCAMENTO") = 'object'
       and (private."FC_MODALIDADES_DO_LANCAMENTO"(f."DS_LANCAMENTO")
              is distinct from private."FC_MODALIDADES_DO_LANCAMENTO"(jsonb_build_object('modalidades', p."DS_MODALIDADES"))
            or coalesce(nullif(btrim(f."DS_LANCAMENTO" ->> 'modalidade'), ''), 'AC')
              is distinct from coalesce(nullif(btrim(p."NO_MODALIDADE"), ''), 'AC'))
  ),
  mudou as (
    update public."TB_FICHA_ANALISE" f set
      "DS_LANCAMENTO" = f."DS_LANCAMENTO" || jsonb_build_object('modalidade', a.principal, 'modalidades', to_jsonb(a.para)),
      "NU_VERSAO" = f."NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
      from alvo a
     where f."CO_FICHA_ANALISE" = a.ficha
    returning f."CO_FICHA_ANALISE" as ficha, f."NU_VERSAO" as versao, a.situacao, a.responsavel, a.de, a.para
  )
  insert into public."TH_FICHA_ANALISE"
    ("CO_FICHA_ANALISE", "NU_VERSAO", "TP_ACAO", "TP_SITUACAO_ANTERIOR", "TP_SITUACAO", "CO_USUARIO_RESP_ANTERIOR",
     "CO_USUARIO_RESPONSAVEL", "DS_MOTIVO", "TP_ORIGEM", "CO_USUARIO")
  select m.ficha, m.versao, 'MODALIDADE', m.situacao, m.situacao, m.responsavel, m.responsavel,
         'Modalidade da pré-classificação: ' || coalesce(nullif(array_to_string(m.de, ' + '), ''), 'AC')
           || ' → ' || coalesce(nullif(array_to_string(m.para, ' + '), ''), 'AC'), v_origem, p_usuario
    from mudou m;
  get diagnostics v_modalidade = row_count;

  -- A linha publicada (TB_ANALISE_CURRICULAR) com as cotas de agora (FC_MODALIDADES_DA_FICHA:
  -- as optadas antes da análise, as confirmadas depois): a ficha (qualquer situação) cuja linha
  -- MONITORA difere é publicada de novo.
  for v_publicar in
    select s.ficha
      from (select f."CO_FICHA_ANALISE" as ficha, a.modalidade_concorrencia, a.pcd,
                   private."FC_MODALIDADES_DA_FICHA"(f."CO_FICHA_ANALISE") as cotas
              from public."TB_FICHA_ANALISE" f
              join public."TB_ANALISE_CURRICULAR" a
                on a.chave_natural = 'monitora|' || f."CO_MONITORAMENTO" || '|' || f."CO_EMPREGARE_CANDIDATO"
             where f."CO_MONITORAMENTO" = p_edital) s
     where s.modalidade_concorrencia is distinct from
             coalesce(private.normalizar_modalidade_concorrencia(private."FC_MODALIDADES_PUBLICADAS"(s.cotas)),
                      s.modalidade_concorrencia)
        or s.pcd is distinct from private."FC_PCD_DAS_MODALIDADES"(s.cotas)
  loop
    perform private."FC_PUBLICAR_FICHA_ANALISE"(v_publicar.ficha);
    v_republicadas := v_republicadas + 1;
  end loop;

  -- Entram: quem está no lote e ainda não tem ficha (uma por inscrito; "a linha anda" cria ficha nova).
  with entra as (
    select p."CO_EMPREGARE_CANDIDATO" as candidato, p."CO_VAGA" as vaga, p."NU_VERSAO_REGRA" as versao,
           p."NU_LOTE" as lote, p."NU_POSICAO" as posicao,
           coalesce('Entrou no lote refeito em ' || to_char(t."DT_INICIO" at time zone 'America/Sao_Paulo', 'DD/MM'),
                    p."DS_MOTIVO_ENTRADA", 'Entrou no lote ' || p."NU_LOTE") as motivo
      from public."TB_PRE_CLASSIFICACAO" p
      left join public."TL_PRE_CLASSIFICACAO" t on t."CO_EXECUCAO" = p."CO_EXECUCAO" and t."ST_REFAZER_LOTE" = 'S'
     where p."CO_MONITORAMENTO" = p_edital and p."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO')
       and not exists (select 1 from public."TB_FICHA_ANALISE" f
                        where f."CO_MONITORAMENTO" = p_edital and f."CO_EMPREGARE_CANDIDATO" = p."CO_EMPREGARE_CANDIDATO")
  ),
  nova as (
    insert into public."TB_FICHA_ANALISE"
      ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO", "CO_VAGA", "CO_REGRA_ANALISE", "NU_VERSAO_REGRA", "NU_LOTE")
    select p_edital, e.candidato, e.vaga, v_regra."CO_REGRA_ANALISE", e.versao, e.lote
      from entra e
     order by e.posicao, e.vaga, e.candidato
    returning *
  ),
  historico as (
    insert into public."TH_FICHA_ANALISE"
      ("CO_FICHA_ANALISE", "NU_VERSAO", "TP_ACAO", "TP_SITUACAO_ANTERIOR", "TP_SITUACAO", "CO_USUARIO_RESP_ANTERIOR",
       "CO_USUARIO_RESPONSAVEL", "DS_MOTIVO", "TP_ORIGEM", "CO_USUARIO")
    select n."CO_FICHA_ANALISE", n."NU_VERSAO", 'CRIAR', null, n."TP_SITUACAO", null, n."CO_USUARIO_RESPONSAVEL",
           nullif(left(btrim(coalesce(e.motivo, '')), 2000), ''), v_origem, p_usuario
      from nova n
      join entra e on e.candidato = n."CO_EMPREGARE_CANDIDATO"
    returning 1
  )
  select coalesce(array_agg(n."CO_EMPREGARE_CANDIDATO"), '{}') into v_criados from nova n;

  -- As fichas novas que já vão para alguém (quem entra depois, para quem tem menos pendentes).
  begin
    for v_item in
      select (a ->> 'candidato')::uuid as candidato, (a ->> 'usuario')::uuid as usuario
        from jsonb_array_elements(v_atrib) a
    loop
      select * into v_ficha from public."TB_FICHA_ANALISE"
       where "CO_MONITORAMENTO" = p_edital and "CO_EMPREGARE_CANDIDATO" = v_item.candidato
       for update;
      if v_item.candidato is null or not (v_item.candidato = any (v_criados)) or v_ficha."CO_USUARIO_RESPONSAVEL" is not null then
        raise exception 'Atribuição recusada: só a ficha aberta agora, uma vez' using errcode = '22023';
      end if;
      if v_item.usuario is null or not private."FC_PODE_ANALISAR_VAGA"(p_edital, v_item.usuario, v_ficha."CO_VAGA") then
        raise exception 'Atribuição recusada: a pessoa não analisa a vaga %', v_ficha."CO_VAGA" using errcode = '22023';
      end if;
      update public."TB_FICHA_ANALISE" set
        "CO_USUARIO_RESPONSAVEL" = v_item.usuario, "DT_ATRIBUICAO" = now(),
        "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
       where "CO_FICHA_ANALISE" = v_ficha."CO_FICHA_ANALISE";
      perform private."FC_HISTORICO_FICHA"(v_ficha."CO_FICHA_ANALISE", 'DISTRIBUIR', 'PENDENTE', null,
                                           'Entrou depois: para quem tem menos pendentes', p_usuario);
      v_atribuidas := v_atribuidas + 1;
    end loop;
  exception when invalid_text_representation then
    raise exception 'Atribuição com id inválido' using errcode = '22023';
  end;

  return jsonb_build_object('criadas', cardinality(v_criados), 'atribuidas', v_atribuidas,
                            'fora_do_lote', v_saem, 'voltaram', v_voltam, 'regra_atualizada', v_regra_nova,
                            'modalidade_atualizada', v_modalidade, 'republicadas', v_republicadas);
end;
$function$;
comment on function private."FC_ABRIR_FICHAS"(uuid, jsonb, uuid) is
  'Sincroniza as fichas do edital com a pré-classificação gravada: quem saiu do lote (eliminado) fica FORA_LOTE com o motivo e sem reserva — desde 20261013110000, quem ficou fora do lote refeito do zero fica FORA_LOTE com "Lote refeito em dd/mm" e histórico REFAZER_LOTE; quem voltou ao lote volta PENDENTE e livre; desde 20261015020000, a ficha não concluída com lançamento gravado passa à modalidade da pré-classificação (desde 20261015150000 às cotas optadas: DS_LANCAMENTO.modalidades e .modalidade; histórico MODALIDADE; modalidade_atualizada) e a linha publicada com modalidade ou PcD diferente das cotas da ficha (FC_MODALIDADES_DA_FICHA) é publicada de novo (republicadas); quem está no lote sem ficha ganha uma (PENDENTE); a ficha não concluída segue a versão da regra do último recálculo (a concluída mantém a sua; regra_atualizada conta as que mudaram). p_atribuicoes [{candidato, usuario}] dá responsável só às fichas criadas agora, para analistas da vaga. p_usuario nulo = o job. Histórico de tudo. Em comandos de conjunto desde 20261014130000. Devolve as contagens.';
revoke all on function private."FC_ABRIR_FICHAS"(uuid, jsonb, uuid) from public, anon, authenticated, service_role;

commit;
