-- ROLLBACK de supabase/migrations/20261007200000_inclusao_no_lote_por_decisao.sql
-- Volta pre_classificacao_ler_candidatos, gravar_pre_classificacao_vaga e
-- obter_pre_classificacao aos corpos de 20261007180000_lote_pela_declarada.sql;
-- FC_TG_LOTE_COM_FICHA ao de 20261006120000_fichas_fila_e_reserva.sql;
-- obter_fila_avaliacao ao de 20261007130000_conteudo_da_ficha.sql;
-- registrar_lista_pre_classificacao ao de 20261006110000_pre_classificacao_e_lote.sql; apaga
-- incluir_no_lote_por_decisao, revogar_decisao_lote e as funções de apoio; volta
-- CK_PRECLASSIF_ENTRADA sem DECISAO.
-- ATENÇÃO: recusa se ainda houver inscrito no lote por decisão (revogue antes pela
-- tela). As tabelas TB_DECISAO_LOTE e TH_DECISAO_LOTE só saem vazias: com decisões
-- (revogadas) registradas, ficam (nada se apaga) e o bloco abaixo avisa.
begin;

do $$
begin
  if exists (select 1 from public."TB_PRE_CLASSIFICACAO" where "TP_ENTRADA_LOTE" = 'DECISAO') then
    raise exception 'Há inscritos no lote por decisão da coordenação: revogue as decisões antes do rollback.';
  end if;
end;
$$;

drop function public.incluir_no_lote_por_decisao(uuid, text[], text, text);
drop function public.revogar_decisao_lote(uuid, text[], text, text);
drop function private."FC_INSCRITOS_DA_DECISAO"(uuid, text[], text);
drop function private."FC_RECONTAR_PRE_CLASSIF_VAGA"(uuid, text);

alter table public."TB_PRE_CLASSIFICACAO" drop constraint "CK_PRECLASSIF_ENTRADA";
alter table public."TB_PRE_CLASSIFICACAO"
  add constraint "CK_PRECLASSIF_ENTRADA" check ("TP_ENTRADA_LOTE" is null or "TP_ENTRADA_LOTE" in ('INICIAL', 'REPOSICAO', 'AMPLIACAO'));
comment on constraint "CK_PRECLASSIF_ENTRADA" on public."TB_PRE_CLASSIFICACAO" is 'Entradas válidas.';
comment on column public."TB_PRE_CLASSIFICACAO"."TP_ENTRADA_LOTE" is 'INICIAL, REPOSICAO (no lugar de quem saiu) ou AMPLIACAO (o lote cresceu).';
comment on column public."TB_PRE_CLASSIFICACAO"."DS_MOTIVO_ENTRADA" is 'Por que entrou no lote ("Entrou no lugar de 7000654 (Cancelou a inscrição)").';

create or replace function private."FC_TG_LOTE_COM_FICHA"()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if old."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO') and new."TP_SITUACAO" = 'RANQUEADO'
     and exists (select 1 from public."TB_FICHA_ANALISE" f
                  where f."CO_MONITORAMENTO" = new."CO_MONITORAMENTO"
                    and f."CO_EMPREGARE_CANDIDATO" = new."CO_EMPREGARE_CANDIDATO"
                    and f."TP_SITUACAO" <> 'FORA_LOTE') then
    raise exception 'Resultado da vaga % recusado: quem tem ficha aberta não sai do lote por recálculo (refazer o lote só antes das fichas)', new."CO_VAGA"
      using errcode = '22023';
  end if;
  return new;
end;
$function$;
comment on function private."FC_TG_LOTE_COM_FICHA"() is 'Gatilho de TB_PRE_CLASSIFICACAO: recusa tirar do lote (NO_LOTE → RANQUEADO, o "refazer o lote") quem já tem ficha aberta; sair eliminado continua valendo.';
revoke all on function private."FC_TG_LOTE_COM_FICHA"() from public, anon, authenticated;

create or replace function public.pre_classificacao_ler_candidatos(p_edital uuid, p_vaga text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not exists (select 1 from public."TB_EMPREGARE_VAGA" v where v."CO_VAGA" = p_vaga and v."CO_MONITORAMENTO" = p_edital) then
    raise exception 'A vaga % não é do edital', p_vaga using errcode = '22023';
  end if;
  return jsonb_build_object(
    'candidatos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c."CO_EMPREGARE_CANDIDATO",
               'codigo', coalesce(c."CO_CANDIDATO_EMPREGARE", left(c."DS_CHAVE_CANDIDATO", 12)),
               'ativo', c."ST_REGISTRO_ATIVO" = 'S',
               'nascimento', c."DT_NASCIMENTO",
               'candidatura', to_char(c."DT_CANDIDATURA" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"+00:00"'),
               -- As respostas do questionário e as colunas do processo, sem as do cadastro.
               'colunas', coalesce((
                 select jsonb_object_agg(k.key, k.value)
                   from jsonb_each(c."DS_COLUNA_ORIGINAL") k
                  where lower(k.key) like 'pergunta %'
                     or lower(k.key) !~ '(nome|e-?mail|cpf|telefone|celular|whatsapp|endere|logradouro|bairro|cep|nascimento|linkedin|^rg$|documento)'),
                 '{}'::jsonb))
             order by c."CO_EMPREGARE_CANDIDATO")
        from public."TB_EMPREGARE_CANDIDATO" c
       where c."CO_VAGA" = p_vaga), '[]'::jsonb),
    'anterior', coalesce((
      select jsonb_object_agg(a."CO_EMPREGARE_CANDIDATO", jsonb_build_object(
               'situacao', a."TP_SITUACAO", 'posicao', a."NU_POSICAO", 'lote', a."NU_LOTE",
               'lista_lote', a."CO_LISTA_LOTE", 'entrada', a."TP_ENTRADA_LOTE", 'motivo_entrada', a."DS_MOTIVO_ENTRADA",
               -- A declarada congelada não se recalcula (o job usa o valor guardado).
               'declarada_congelada', case when a."VL_DECLARADA_CONGELADA" is not null
                                           then a."DS_DECLARADA_CONGELADA" || jsonb_build_object('total', a."VL_DECLARADA_CONGELADA") end))
        from public."TB_PRE_CLASSIFICACAO" a
       where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = p_vaga), '{}'::jsonb)
  );
end;
$function$;
comment on function public.pre_classificacao_ler_candidatos(uuid, text) is
  'Pré-classificação (job Python): os inscritos de uma vaga do edital (id, código, ativo, nascimento, data da candidatura e as colunas do questionário e do processo SEM as do cadastro — nome, e-mail, CPF, telefone, endereço) e a situação anterior de cada um (situação, posição, lote, lista, entrada e, desde 20261007170000, a nota declarada congelada, que o job usa sem recalcular). Só service_role.';


create or replace function public.gravar_pre_classificacao_vaga(
  p_execucao text, p_edital uuid, p_vaga text, p_versao_regra integer, p_resumo jsonb, p_linhas jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_exec public."TL_PRE_CLASSIFICACAO" := private."FC_EXIGIR_EXECUCAO_PRECLASSIF"(p_execucao);
  v_refazer boolean := v_exec."ST_REFAZER_LOTE" = 'S';
  v_quadro public."TB_QUADRO_VAGA_EDITAL";
  v_qt integer;
  v_erro text;
  v_mudancas integer;
  v_avisos jsonb := coalesce(p_resumo -> 'avisos', '[]'::jsonb);
  v_ant jsonb;
begin
  -- A regra usada é a vigente e está conferida.
  if not exists (select 1 from public."TB_REGRA_ANALISE" r
                  where r."CO_MONITORAMENTO" = p_edital and r."NU_VERSAO_VIGENTE" = p_versao_regra
                    and r."TP_SITUACAO" = 'CONFERIDA') then
    raise exception 'A regra do edital mudou ou não está conferida; rode de novo' using errcode = '40001';
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
     or (p_resumo -> 'por_modalidade' is not null and jsonb_typeof(p_resumo -> 'por_modalidade') not in ('object', 'null')) then
    raise exception 'Resumo da vaga inválido' using errcode = '22023';
  end if;

  begin
    perform count(*) from private."FC_LINHAS_PRE_CLASSIF"(p_linhas);
  exception when invalid_text_representation or numeric_value_out_of_range or datatype_mismatch then
    raise exception 'Linha com tipo inválido (id, nota, posição ou lote)' using errcode = '22023';
  end;

  -- A forma do resultado (as mesmas regras das CK_, com mensagem clara).
  select case
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t where t.id is null) then 'linha sem id'
    when (select count(*) from private."FC_LINHAS_PRE_CLASSIF"(p_linhas)) <> (select count(distinct t.id) from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t) then 'inscrito repetido'
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
                  where not exists (select 1 from public."TB_EMPREGARE_CANDIDATO" c
                                     where c."CO_EMPREGARE_CANDIDATO" = t.id and c."CO_VAGA" = p_vaga)) then 'inscrito que não é da vaga'
    when exists (select 1 from public."TB_PRE_CLASSIFICACAO" a
                  where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = p_vaga
                    and not exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t where t.id = a."CO_EMPREGARE_CANDIDATO")) then 'faltam inscritos já pré-classificados'
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t where t.situacao is null or t.situacao not in ('ELIMINADO', 'RANQUEADO', 'NO_LOTE', 'ANALISADO')) then 'situação inválida'
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
                  where (t.situacao = 'ELIMINADO') <> (t.motivo_codigo is not null)
                     or (t.motivo_codigo is not null and (t.motivo_codigo !~ '^[A-Z][A-Z0-9_]{1,29}$'
                         or coalesce(length(btrim(t.motivo)), 0) not between 1 and 200))) then 'eliminado sem motivo (ou motivo fora de eliminado)'
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
                  where (t.situacao = 'ELIMINADO' and (t.posicao is not null or t.posicao_modalidade is not null))
                     or (t.situacao <> 'ELIMINADO' and (coalesce(t.posicao, 0) < 1 or coalesce(t.posicao_modalidade, 0) < 1))) then 'posição inválida'
    when (select count(*) from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t where t.situacao <> 'ELIMINADO')
         <> coalesce((select max(t.posicao) from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t where t.situacao <> 'ELIMINADO'), 0)
      or (select count(distinct t.posicao) from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t where t.situacao <> 'ELIMINADO')
         <> (select count(*) from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t where t.situacao <> 'ELIMINADO') then 'posições não vão de 1 a N sem repetir'
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
                  where case when t.situacao in ('NO_LOTE', 'ANALISADO')
                             then coalesce(t.lote, 0) not between 1 and 999
                                  or coalesce(t.lista_lote, '') !~ '^(GERAL|[A-Z]{2,10})$'
                                  or coalesce(t.entrada, '') not in ('INICIAL', 'REPOSICAO', 'AMPLIACAO')
                                  or length(coalesce(t.motivo_entrada, '')) > 300
                             else t.lote is not null or t.lista_lote is not null or t.entrada is not null end) then 'lote inválido'
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
                  where coalesce(t.origem_nota, 'ART') not in ('ART', 'DECLARADA')
                     or t.modalidade !~ '^[A-Z]{2,10}$'
                     or abs(coalesce(t.art, 0)) > 1000 or abs(coalesce(t.nota, 0)) > 1000 or abs(coalesce(t.declarada, 0)) > 1000
                     or t.sem_mapa not between 0 and 100) then 'nota, origem ou modalidade inválida'
    -- A declarada congelada: completa, com o total igual à declarada da linha.
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
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
  select coalesce(jsonb_object_agg(a."CO_EMPREGARE_CANDIDATO", jsonb_build_object('s', a."TP_SITUACAO", 'l', a."NU_LOTE")), '{}'::jsonb)
    into v_ant
    from public."TB_PRE_CLASSIFICACAO" a
   where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = p_vaga;

  -- A declarada congelada não muda: só a coordenação descongela (descongelar_declarada_pre_classificacao).
  if exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
               join public."TB_PRE_CLASSIFICACAO" a
                 on a."CO_MONITORAMENTO" = p_edital and a."CO_EMPREGARE_CANDIDATO" = t.id
              where a."VL_DECLARADA_CONGELADA" is not null and t.declarada is not null
                and t.declarada is distinct from a."VL_DECLARADA_CONGELADA") then
    raise exception 'Resultado da vaga % recusado: a nota declarada congelada não muda (descongele antes)', p_vaga using errcode = '22023';
  end if;

  -- Quem tem ficha (ANALISADO) não muda; ANALISADO só vem do banco (fase F3).
  if exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
               cross join lateral (select v_ant -> t.id::text ->> 's' as ant_situacao, (v_ant -> t.id::text ->> 'l')::integer as ant_lote) h
              where (h.ant_situacao is not distinct from 'ANALISADO') <> (t.situacao = 'ANALISADO')
                 or (h.ant_situacao = 'ANALISADO' and h.ant_lote is distinct from t.lote)) then
    raise exception 'Resultado da vaga % recusado: quem já tem ficha não muda', p_vaga using errcode = '22023';
  end if;
  -- Quem está no lote só sai eliminado (a não ser que a execução refaça o lote).
  if not v_refazer and exists (
      select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
       cross join lateral (select v_ant -> t.id::text ->> 's' as ant_situacao, (v_ant -> t.id::text ->> 'l')::integer as ant_lote) h
       where h.ant_situacao = 'NO_LOTE'
         and not (t.situacao = 'ELIMINADO' or (t.situacao = 'NO_LOTE' and t.lote = h.ant_lote))) then
    raise exception 'Resultado da vaga % recusado: quem está no lote só sai eliminado (AM-5.5)', p_vaga using errcode = '22023';
  end if;

  -- Grava o resultado (rodar de novo atualiza a mesma linha: AM-4.2).
  insert into public."TB_PRE_CLASSIFICACAO" as a
    ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO", "CO_VAGA", "NU_VERSAO_REGRA", "TP_SITUACAO",
     "CO_MOTIVO_ELIMINACAO", "DS_MOTIVO_ELIMINACAO", "VL_ART", "VL_NOTA_ORDEM", "TP_ORIGEM_NOTA",
     "VL_NOTA_DECLARADA", "DS_NOTA_DECLARADA", "ST_DIVERGENTE", "NO_MODALIDADE", "NU_POSICAO",
     "NU_POSICAO_MODALIDADE", "NU_LOTE", "CO_LISTA_LOTE", "TP_ENTRADA_LOTE", "DS_MOTIVO_ENTRADA",
     "DT_ENTRADA_LOTE", "CO_EXECUCAO", "VL_DECLARADA_CONGELADA", "DS_DECLARADA_CONGELADA", "DT_CONGELAMENTO_DECLARADA")
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
         case when t.declarada_congelada is not null then now() end
    from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
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
                   when t.lote is not null and t.lote is distinct from h.ant_lote then t.motivo_entrada
                   when h.ant_situacao = 'NO_LOTE' and t.situacao = 'RANQUEADO' then 'Saiu do lote: o recorte foi refeito'
                   when h.ant_situacao is null then 'Entrou na Provisória'
                   else null end, 300)
    from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
   cross join lateral (select v_ant -> t.id::text ->> 's' as ant_situacao, (v_ant -> t.id::text ->> 'l')::integer as ant_lote) h
   where h.ant_situacao is null
      or h.ant_situacao is distinct from t.situacao
      or h.ant_lote is distinct from t.lote;
  get diagnostics v_mudancas = row_count;

  -- O resumo da vaga: contagens feitas aqui; quadro lido aqui.
  v_quadro := private."FC_QUADRO_DA_VAGA_EMPREGARE"(p_edital, p_vaga);
  select count(*) into v_qt from private."FC_LINHAS_PRE_CLASSIF"(p_linhas);
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
         min(t.nota) filter (where t.situacao in ('NO_LOTE', 'ANALISADO')),
         count(*) filter (where t.divergente),
         count(*) filter (where t.situacao <> 'ELIMINADO' and t.art is null),
         case when jsonb_typeof(p_resumo -> 'acima_do_corte') = 'number'
              then greatest(0, least(100000, (p_resumo ->> 'acima_do_corte')::numeric))::integer else 0 end,
         coalesce(max(t.lote), 0),
         v_avisos
    from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
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
  'Grava a pré-classificação PRONTA de uma vaga (calculada pelo job Python): confere a regra vigente e conferida (40001), que os inscritos são da vaga, que nenhum já gravado falta, a forma (eliminado com motivo, posições de 1 a N, lote com número, lista e entrada), que quem tem ficha não muda, que quem está no lote só sai eliminado (salvo execução que refaz o lote) e, desde 20261007170000, que a nota declarada congelada não muda (guarda a congelada nova, completa, com as respostas usadas, a versão da regra e a data); grava o histórico das mudanças com o motivo e o resumo da vaga (contagens feitas no banco; quadro lido no banco). 22023 com o motivo da recusa. Só service_role.';

create or replace function public.obter_pre_classificacao(p_edital uuid)
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
  v_classif_editor boolean := private.pode_recurso('classificacao', 2);
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade, 'area', v_area,
                                'numero', private."FC_NUMERO_EDITAL"(v_m.edital), 'rotulo', private."FC_ROTULO_DO_EDITAL"(v_m.edital)),
    'papel', v_papel,
    'pode_coordenar', coalesce(v_papel = 'COORDENADOR', false),
    'pode_registrar_lista', coalesce(v_papel = 'COORDENADOR', false) or coalesce(v_classif_editor, false),
    'pode_publicar_lista', coalesce(v_classif_editor, false),
    'regra', (select json_build_object('versao', r."NU_VERSAO_VIGENTE", 'situacao', r."TP_SITUACAO",
                                       'configuracao', h."DS_CONFIGURACAO")
                from public."TB_REGRA_ANALISE" r
                join public."TH_REGRA_ANALISE" h on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
               where r."CO_MONITORAMENTO" = p_edital),
    'regra_classificacao', (select json_build_object('versao', r."NU_VERSAO_VIGENTE", 'configuracao', h."DS_CONFIGURACAO")
                              from public."TB_REGRA_CLASSIFICACAO" r
                              join public."TH_REGRA_CLASSIFICACAO" h
                                on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
                             where r."CO_MONITORAMENTO" = p_edital),
    'em_andamento', exists (select 1 from public."TL_PRE_CLASSIFICACAO" t
                             where t."TP_SITUACAO" = 'EM_ANDAMENTO' and t."DT_INICIO" > now() - interval '1 hour'),
    'ultima_execucao', (
      select json_build_object('id', t."CO_EXECUCAO", 'inicio', t."DT_INICIO", 'fim', t."DT_FIM", 'situacao', t."TP_SITUACAO",
                               'disparo', t."TP_DISPARO", 'refazer', t."ST_REFAZER_LOTE" = 'S', 'mensagem', t."DS_MENSAGEM",
                               'execucao', t."DS_URL_EXECUCAO",
                               'edital', (select e from jsonb_array_elements(t."DS_EDITAL") e where e ->> 'edital' = p_edital::text limit 1))
        from public."TL_PRE_CLASSIFICACAO" t
       where t."DS_EDITAL" @> jsonb_build_array(jsonb_build_object('edital', p_edital::text))
       order by t."DT_INICIO" desc limit 1),
    'vagas', coalesce((
      select json_agg(json_build_object(
               'codigo', v."CO_VAGA",
               'candidatos_empregare', v."QT_CANDIDATO_ATIVO",
               'ultima_carga', v."DT_ULTIMA_CARGA",
               'cargo', pv."NO_CARGO", 'lotacao', pv."NO_LOTACAO",
               'vagas_imediatas', pv."QT_VAGA_IMEDIATA", 'cadastro_reserva', pv."ST_CADASTRO_RESERVA" = 'S',
               'inscritos', pv."QT_INSCRITO", 'eliminados', pv."QT_ELIMINADO", 'ranqueados', pv."QT_RANQUEADO",
               'no_lote', pv."QT_LOTE", 'tamanho', pv."QT_TAMANHO_LOTE", 'descricao', pv."DS_TAMANHO_LOTE",
               'por_modalidade', pv."DS_TAMANHO_MODALIDADE", 'art_corte', pv."VL_ART_CORTE",
               'divergencias', pv."QT_DIVERGENCIA", 'sem_art', pv."QT_SEM_ART", 'acima_do_corte', pv."QT_ACIMA_CORTE",
               'ultimo_lote', pv."NU_ULTIMO_LOTE", 'avisos', coalesce(pv."DS_AVISO", '[]'::jsonb),
               'versao_regra', pv."NU_VERSAO_REGRA", 'atualizado_em', pv."DT_ATUALIZACAO")
             order by v."CO_VAGA")
        from public."TB_EMPREGARE_VAGA" v
        left join public."TB_PRE_CLASSIF_VAGA" pv on pv."CO_MONITORAMENTO" = p_edital and pv."CO_VAGA" = v."CO_VAGA"
       where v."CO_MONITORAMENTO" = p_edital), '[]'::json),
    'candidatos', coalesce((
      select json_agg(json_build_object(
               'id', a."CO_EMPREGARE_CANDIDATO", 'vaga', a."CO_VAGA",
               'codigo', c."CO_CANDIDATO_EMPREGARE", 'nome', c."NO_CANDIDATO",
               'situacao', a."TP_SITUACAO", 'motivo_codigo', a."CO_MOTIVO_ELIMINACAO", 'motivo', a."DS_MOTIVO_ELIMINACAO",
               'art', a."VL_ART", 'nota', a."VL_NOTA_ORDEM", 'origem_nota', a."TP_ORIGEM_NOTA",
               'declarada', a."VL_NOTA_DECLARADA", 'divergente', a."ST_DIVERGENTE" = 'S', 'modalidade', a."NO_MODALIDADE",
               'declarada_completa', (a."DS_NOTA_DECLARADA" ->> 'completa')::boolean,
               'declarada_congelada', a."VL_DECLARADA_CONGELADA", 'congelada_em', a."DT_CONGELAMENTO_DECLARADA",
               'posicao', a."NU_POSICAO", 'posicao_modalidade', a."NU_POSICAO_MODALIDADE",
               'lote', a."NU_LOTE", 'lista_lote', a."CO_LISTA_LOTE", 'entrada', a."TP_ENTRADA_LOTE",
               'motivo_entrada', a."DS_MOTIVO_ENTRADA", 'entrada_em', a."DT_ENTRADA_LOTE")
             order by a."CO_VAGA", a."TP_SITUACAO" = 'ELIMINADO', a."NU_POSICAO", c."CO_CANDIDATO_EMPREGARE")
        from public."TB_PRE_CLASSIFICACAO" a
        join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
       where a."CO_MONITORAMENTO" = p_edital), '[]'::json),
    'listas', coalesce((
      select json_agg(json_build_object('meta', private."FC_LISTA_CLASSIFICACAO_JSON"(l."CO_LISTA_CLASSIFICACAO"),
                                        'lote', l."DS_RESULTADO" -> 'lote')
             order by l."DT_GERACAO" desc)
        from public."TB_LISTA_CLASSIFICACAO" l
       where l."CO_MONITORAMENTO" = p_edital and l."TP_LISTA" in ('PROVISORIA', 'LOTE')), '[]'::json)
  );
end;
$function$;
comment on function public.obter_pre_classificacao(uuid) is
  'A pré-classificação do edital para a aba Pré-classificação (json): regra vigente, regra de classificação (textos do documento), última execução do job que tratou o edital, se há execução em andamento, cada vaga da Empregare com o resumo (quadro, tamanho do lote, linha de corte, divergências, avisos), os inscritos (código, nome, situação, motivo, ART, nota declarada — completa ou não, congelada e quando, desde 20261007170000 —, posição, lote e motivo da entrada; sem CPF nem contato) e as listas PROVISORIA e LOTE registradas. Exige avaliacao_documental >= leitor, a área e o recorte da coordenação.';
revoke all on function public.obter_pre_classificacao(uuid) from public, anon;
grant execute on function public.obter_pre_classificacao(uuid) to authenticated;

create or replace function public.obter_fila_avaliacao(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
  v_papel text := private."FC_PAPEL_AVALIACAO"(p_edital);
  v_uid uuid := (select auth.uid());
  v_so_minhas_vagas boolean := coalesce(v_papel, '') = 'ANALISTA';
  v_m public."TB_MONITORAMENTO_INDIGENA";
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'area', v_area,
                                'rotulo', private."FC_ROTULO_DO_EDITAL"(v_m.edital)),
    'papel', v_papel,
    'pode_coordenar', coalesce(v_papel = 'COORDENADOR', false),
    'pode_pegar', private."FC_PODE_ANALISAR_VAGA"(p_edital, v_uid, null),
    'eu', v_uid,
    'prazo_reserva_min', extract(epoch from private."FC_PRAZO_RESERVA_FICHA"())::integer / 60,
    'distribuicao', private."FC_DISTRIBUICAO_DO_EDITAL"(p_edital),
    'sem_ficha', (select count(*) from public."TB_PRE_CLASSIFICACAO" p
                   where p."CO_MONITORAMENTO" = p_edital and p."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO')
                     and not exists (select 1 from public."TB_FICHA_ANALISE" f
                                      where f."CO_MONITORAMENTO" = p_edital and f."CO_EMPREGARE_CANDIDATO" = p."CO_EMPREGARE_CANDIDATO")),
    'vagas', coalesce((
      select json_agg(json_build_object('codigo', pv."CO_VAGA", 'cargo', pv."NO_CARGO", 'lotacao', pv."NO_LOTACAO")
                      order by pv."CO_VAGA")
        from public."TB_PRE_CLASSIF_VAGA" pv
       where pv."CO_MONITORAMENTO" = p_edital
         and (not v_so_minhas_vagas or private."FC_PODE_ANALISAR_VAGA"(p_edital, v_uid, pv."CO_VAGA"))), '[]'::json),
    'analistas', private."FC_ANALISTAS_DO_EDITAL"(p_edital, true),
    'filtros', private."FC_FILTROS_FILA_JSON"(v_uid),
    'candidatos', coalesce((
      select json_agg(json_build_object(
               'id', a."CO_EMPREGARE_CANDIDATO", 'vaga', a."CO_VAGA", 'codigo', c."CO_CANDIDATO_EMPREGARE",
               'nome', c."NO_CANDIDATO", 'situacao_pre', a."TP_SITUACAO", 'motivo_eliminacao', a."DS_MOTIVO_ELIMINACAO",
               'posicao', a."NU_POSICAO", 'lote', a."NU_LOTE", 'art', a."VL_ART", 'nota', a."VL_NOTA_ORDEM",
               'modalidade', a."NO_MODALIDADE",
               'ficha', case when f."CO_FICHA_ANALISE" is null then null else json_build_object(
                 'id', f."CO_FICHA_ANALISE", 'versao', f."NU_VERSAO", 'situacao', f."TP_SITUACAO",
                 'responsavel', f."CO_USUARIO_RESPONSAVEL", 'responsavel_nome', coalesce(ur.nome, ur.email),
                 'atribuida_em', f."DT_ATRIBUICAO", 'motivo_saida', f."DS_MOTIVO_SAIDA", 'lote', f."NU_LOTE",
                 'resultado', case when f."TP_SITUACAO" = 'CONCLUIDA' then f."TP_RESULTADO" end,
                 'nota_final', case when f."TP_SITUACAO" = 'CONCLUIDA' then f."VL_NOTA_FINAL" end,
                 'concluida_em', case when f."TP_SITUACAO" = 'CONCLUIDA' then f."DT_CONCLUSAO" end,
                 'rascunho_em', f."DT_RASCUNHO",
                 'reserva', case when f."DT_RESERVA_EXPIRA" > now() then json_build_object(
                   'usuario', f."CO_USUARIO_RESERVA", 'nome', coalesce(uv.nome, uv.email),
                   'desde', f."DT_RESERVA", 'expira', f."DT_RESERVA_EXPIRA") end) end)
             order by a."CO_VAGA", a."TP_SITUACAO" = 'ELIMINADO', a."NU_POSICAO", c."CO_CANDIDATO_EMPREGARE")
        from public."TB_PRE_CLASSIFICACAO" a
        join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
        left join public."TB_FICHA_ANALISE" f
          on f."CO_MONITORAMENTO" = a."CO_MONITORAMENTO" and f."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
        left join public."TB_PERFIL_USUARIO" ur on ur.user_id = f."CO_USUARIO_RESPONSAVEL"
        left join public."TB_PERFIL_USUARIO" uv on uv.user_id = f."CO_USUARIO_RESERVA"
       where a."CO_MONITORAMENTO" = p_edital
         and (not v_so_minhas_vagas or private."FC_PODE_ANALISAR_VAGA"(p_edital, v_uid, a."CO_VAGA"))), '[]'::json)
  );
end;
$function$;
comment on function public.obter_fila_avaliacao(uuid) is
  'A fila da avaliação documental do edital (json): papel de quem está logado (coordena, pode pegar), a distribuição da regra, cada inscrito da pré-classificação com a ficha (situação, responsável, reserva vigente, versão, rascunho e, concluída, resultado e nota; nome do candidato, sem CPF nem contato), as vagas, os analistas com as pendentes, quantos do lote ainda estão sem ficha e os filtros salvos de quem chama. O analista vê só as vagas que analisa. Exige avaliacao_documental >= leitor, a área e o recorte da coordenação.';

create or replace function public.registrar_lista_pre_classificacao(p_edital uuid, p_tipo text, p_lote integer default null)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text;
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_regra public."TB_REGRA_CLASSIFICACAO";
  v_resultado jsonb;
  v_id uuid;
  v_elegiveis integer;
  v_eliminados integer;
begin
  if private."FC_PAPEL_AVALIACAO"(p_edital) = 'COORDENADOR' then
    v_area := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 3);
  else
    v_area := private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2);
  end if;
  if p_tipo is null or p_tipo not in ('PROVISORIA', 'LOTE') then
    raise exception 'Tipo de lista inválido: PROVISORIA ou LOTE' using errcode = '22023';
  end if;
  if p_lote is not null and (p_tipo <> 'LOTE' or p_lote not between 1 and 999) then
    raise exception 'Número do lote só na lista LOTE, de 1 a 999' using errcode = '22023';
  end if;
  select * into v_regra from public."TB_REGRA_CLASSIFICACAO" where "CO_MONITORAMENTO" = p_edital;
  if v_regra."CO_REGRA_CLASSIFICACAO" is null then
    raise exception 'Cadastre a regra de classificação do edital antes de registrar a lista.' using errcode = '22023';
  end if;
  if not exists (select 1 from public."TB_PRE_CLASSIFICACAO" a where a."CO_MONITORAMENTO" = p_edital) then
    raise exception 'O edital ainda não tem pré-classificação: rode o Recalcular.' using errcode = '22023';
  end if;
  if p_lote is not null and not exists (select 1 from public."TB_PRE_CLASSIFICACAO" a
                                         where a."CO_MONITORAMENTO" = p_edital and a."NU_LOTE" = p_lote) then
    raise exception 'Não há ninguém no lote %.', p_lote using errcode = '22023';
  end if;
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;

  -- O retrato (formato de src/lib/classificacao/exportacao.js): só nome, posição, nota e motivo.
  select jsonb_build_object(
           'schema', 1,
           'tipo', p_tipo,
           'edital', jsonb_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade),
           'regra_versao', v_regra."NU_VERSAO_VIGENTE",
           'regra_analise_versao', (select max(a."NU_VERSAO_REGRA") from public."TB_PRE_CLASSIFICACAO" a where a."CO_MONITORAMENTO" = p_edital),
           'lote', p_lote,
           'casas', 1,
           'modalidades', '[]'::jsonb,
           'vagas', coalesce(jsonb_agg(jsonb_build_object(
             'chave', pv."CO_VAGA",
             'codigo', pv."CO_VAGA",
             'cargo', pv."NO_CARGO",
             'lotacao', pv."NO_LOTACAO",
             'cabecalho', concat_ws(' - ', 'VAGA ' || pv."CO_VAGA", pv."NO_CARGO", pv."NO_LOTACAO",
                            case when coalesce(pv."QT_VAGA_IMEDIATA", 0) = 0 and pv."ST_CADASTRO_RESERVA" = 'S' then 'Cadastro reserva'
                                 when pv."QT_VAGA_IMEDIATA" is null then null
                                 else pv."QT_VAGA_IMEDIATA" || case when pv."QT_VAGA_IMEDIATA" = 1 then ' vaga' else ' vagas' end
                                      || case when pv."ST_CADASTRO_RESERVA" = 'S' then ' + CR' else '' end end),
             'total', pv."QT_VAGA_IMEDIATA",
             'cadastro_reserva', pv."ST_CADASTRO_RESERVA" = 'S',
             'geral', coalesce((
               select jsonb_agg(jsonb_build_object('posicao', a."NU_POSICAO", 'nome', c."NO_CANDIDATO",
                                                   'nota', a."VL_NOTA_ORDEM", 'modalidades', jsonb_build_array(a."NO_MODALIDADE"),
                                                   'situacao', a."TP_SITUACAO", 'lote', a."NU_LOTE")
                                order by a."NU_POSICAO")
                 from public."TB_PRE_CLASSIFICACAO" a
                 join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
                where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = pv."CO_VAGA"
                  and case when p_tipo = 'PROVISORIA' then a."TP_SITUACAO" <> 'ELIMINADO'
                           else a."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO') and (p_lote is null or a."NU_LOTE" = p_lote) end), '[]'::jsonb),
             'listas', '{}'::jsonb,
             'eliminados', case when p_tipo = 'PROVISORIA' then coalesce((
               select jsonb_agg(jsonb_build_object('nome', c."NO_CANDIDATO", 'motivo', a."DS_MOTIVO_ELIMINACAO", 'detalhe', '')
                                order by c."NO_CANDIDATO")
                 from public."TB_PRE_CLASSIFICACAO" a
                 join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
                where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = pv."CO_VAGA" and a."TP_SITUACAO" = 'ELIMINADO'), '[]'::jsonb)
               else '[]'::jsonb end)
             order by pv."CO_VAGA"), '[]'::jsonb),
           'avisos', '[]'::jsonb,
           'pendencias', '[]'::jsonb)
    into v_resultado
    from public."TB_PRE_CLASSIF_VAGA" pv
   where pv."CO_MONITORAMENTO" = p_edital;

  select coalesce(sum(jsonb_array_length(v -> 'geral')), 0), coalesce(sum(jsonb_array_length(v -> 'eliminados')), 0)
    into v_elegiveis, v_eliminados
    from jsonb_array_elements(v_resultado -> 'vagas') v;
  v_resultado := v_resultado || jsonb_build_object('totais', jsonb_build_object(
    'elegiveis', v_elegiveis, 'eliminados', v_eliminados, 'avisos', 0, 'pendencias', 0));

  insert into public."TB_LISTA_CLASSIFICACAO"
    ("CO_MONITORAMENTO", "TP_LISTA", "CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA", "DS_RESULTADO", "DS_HASH",
     "QT_ELEGIVEL", "QT_ELIMINADO", "QT_AVISO", "QT_PENDENCIA", "CO_USUARIO")
  values (p_edital, p_tipo, v_regra."CO_REGRA_CLASSIFICACAO", v_regra."NU_VERSAO_VIGENTE", v_resultado,
          encode(sha256(convert_to(v_resultado::text, 'UTF8')), 'hex'), v_elegiveis, v_eliminados, 0, 0, (select auth.uid()))
  returning "CO_LISTA_CLASSIFICACAO" into v_id;

  return json_build_object('lista', private."FC_LISTA_CLASSIFICACAO_JSON"(v_id), 'resultado', v_resultado);
end;
$function$;
comment on function public.registrar_lista_pre_classificacao(uuid, text, integer) is
  'Registra a lista PROVISORIA (por vaga: classificação, nome e nota da ART; os eliminados automáticos com o motivo) ou LOTE (os do lote; com p_lote, só aquele lote — uma reposição) em TB_LISTA_CLASSIFICACAO, montando o retrato a partir de TB_PRE_CLASSIFICACAO (sem conta: só leitura e ordem já gravadas). Exige a coordenação da avaliação do edital ou Editor na Classificação, a regra de classificação do edital e a pré-classificação já gravada. Devolve os metadados e o retrato.';
revoke all on function public.registrar_lista_pre_classificacao(uuid, text, integer) from public, anon;
grant execute on function public.registrar_lista_pre_classificacao(uuid, text, integer) to authenticated;

do $$
begin
  if exists (select 1 from public."TB_DECISAO_LOTE") then
    raise notice 'TB_DECISAO_LOTE tem decisões registradas (revogadas): as tabelas das decisões ficam.';
  else
    drop table public."TH_DECISAO_LOTE";
    drop table public."TB_DECISAO_LOTE";
  end if;
end;
$$;

commit;
