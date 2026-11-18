/*
  AVISO "CRONOGRAMA ENCERRADO, STATUS AINDA EM ANDAMENTO" (MÓDULO EDITAIS)

  Pedido de 18/11/2026 (proposta da Frente 1, aprovada pelo usuário).

  O PROBLEMA
    O estado do cronograma pelas datas (FC_ESTADO_DO_CRONOGRAMA) já é "Concluído", mas o status gravado
    em TB_MONITORAMENTO_INDIGENA.status continua outro (52 editais no diagnóstico). A Avaliação documental
    e a Classificação leem o status gravado, por decisão do usuário: ele NÃO é mudado automaticamente.
    A equipe confere se o processo terminou e marca "Concluído" no edital, ou dispensa o aviso com
    justificativa.

  O QUE MUDA
    1. conferencia_ler_contexto: cada edital traz status_manual (status_override), treinamento e
       cronograma {status, tem, data_fim} do dia de Brasília. O robô (scripts/conferencias/regras.py,
       conferir_editais) avisa um caso por edital.
    2. Módulo novo dos avisos: editais (recurso nucleo, quem edita os editais). CK_AVISOCONF_COMODULO,
       FC_CONFERENCIA_RECURSO e as listas de módulos de gravar_avisos_conferencia,
       listar_avisos_conferencia, listar_casos_aviso_conferencia e FC_MARCA_DA_RPC passam a aceitá-lo.

  DEPENDE DE 20261118120000_central_de_avisos_das_conferencias (aplicada antes): gravar, listar e listar_casos partem dos corpos dela.
  GUARDAS: já aplicada (o módulo editais já é aceito); a central não aplicada; as seis funções no
  corpo esperado (md5 do prosrc sem retorno de carro).

  Ensaio: supabase/ensaios/20261118150000_aviso_de_cronograma_encerrado.sql
  Rollback: supabase/rollback/20261118150000_aviso_de_cronograma_encerrado.sql
  Testes: tests/python/test_conferencias.py (a regra) e tests/aviso-de-cronograma-migration.test.ts
*/

begin;

do $$
begin
  if to_regclass('public."TH_AVISO_CONFERENCIA"') is null then
    raise exception 'Aplique antes 20261118120000_central_de_avisos_das_conferencias.';
  end if;
  if private."FC_CONFERENCIA_RECURSO"('editais') is not null then
    raise exception 'Já aplicada: o módulo editais já existe.';
  end if;
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.conferencia_ler_contexto()')), chr(13), ''))
       is distinct from 'c80080158174ce15d2e5ac0f7ec0ff69'
     or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('private."FC_CONFERENCIA_RECURSO"(text)')), chr(13), ''))
       is distinct from '88e149cedc4b38a73d1422e700eea84c'
     or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('private."FC_MARCA_DA_RPC"(text, text, uuid, text, text)')), chr(13), ''))
       is distinct from '23e9e210e7aa00fdc1b2e6ecb11ced61'
     or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.gravar_avisos_conferencia(text, jsonb)')), chr(13), ''))
       is distinct from '6443f23fc74d5b9ae033f219ccae3561'
     or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.listar_avisos_conferencia(text, text)')), chr(13), ''))
       is distinct from '0e9933193d1167d55c94116854cedaec'
     or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.listar_casos_aviso_conferencia(uuid, text, text, text, integer, integer)')), chr(13), ''))
       is distinct from 'e21ee015e3b00dfad0c8dee4027ec194' then
    raise exception 'Uma das funções mudou depois de 20261118120000_central_de_avisos_das_conferencias: junte as mudanças antes de aplicar.';
  end if;
end;
$$;

alter table public."TB_AVISO_CONFERENCIA" drop constraint "CK_AVISOCONF_COMODULO";
alter table public."TB_AVISO_CONFERENCIA" add constraint "CK_AVISOCONF_COMODULO"
  check ("CO_MODULO" in ('analises', 'entrevistas', 'classificacao', 'aprovados', 'cargas', 'editais'));
comment on constraint "CK_AVISOCONF_COMODULO" on public."TB_AVISO_CONFERENCIA" is 'Módulos dos avisos; editais desde 20261118150000.';

CREATE OR REPLACE FUNCTION public.conferencia_ler_contexto() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select jsonb_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'hoje', (now() at time zone 'America/Sao_Paulo')::date,
    'editais', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', m.id, 'numero', private."FC_NUMERO_EDITAL"(m.edital), 'area', m."CO_AREA",
          'ativo', coalesce(m.ativo, false), 'status', m.status,
          -- 20261118150000: o estado do cronograma pelas datas (FC_ESTADO_DO_CRONOGRAMA, no dia de
          -- Brasília), se o status é manual (status_override) e se é edital de treinamento.
          'status_manual', nullif(btrim(coalesce(m.status_override, '')), '') is not null,
          'treinamento', private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO"),
          'cronograma', (select jsonb_build_object('status', x ->> 'status', 'tem', x -> 'tem_cronograma',
                                                   'data_fim', x ->> 'data_fim')
                           from private."FC_ESTADO_DO_CRONOGRAMA"(m.id, (now() at time zone 'America/Sao_Paulo')::date) x))
          order by m."CO_AREA", m.edital), '[]'::jsonb)
        from public."TB_MONITORAMENTO_INDIGENA" m
    ),
    'regras', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'edital', r."CO_MONITORAMENTO",
          'versao', r."NU_VERSAO_VIGENTE",
          'nota_minima', h."DS_CONFIGURACAO" #> '{documental,nota_minima}',
          'teto_experiencia', h."DS_CONFIGURACAO" #> '{documental,teto_experiencia}')), '[]'::jsonb)
        from public."TB_REGRA_CLASSIFICACAO" r
        join public."TH_REGRA_CLASSIFICACAO" h
          on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
    )
  );
$$;

COMMENT ON FUNCTION public.conferencia_ler_contexto() IS 'Conferências (job Python): editais (id, número, área, ativo, status, se o status é manual, se é treinamento e o estado do cronograma pelas datas: status, se tem cronograma e o fim; 20261118150000), o dia de hoje em Brasília e a regra de classificação vigente de cada edital (nota mínima documental e teto de experiência, quando a regra tiver). Sem dado pessoal. Só service_role.';

CREATE OR REPLACE FUNCTION private."FC_CONFERENCIA_RECURSO"(p_modulo text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select case p_modulo
    when 'analises' then 'analises'
    when 'entrevistas' then 'entrevistas'
    when 'classificacao' then 'classificacao'
    when 'aprovados' then 'aprovados'
    -- 20261118150000: os avisos do edital (cronograma × status) seguem quem edita os editais.
    when 'editais' then 'nucleo'
  end;
$$;

COMMENT ON FUNCTION private."FC_CONFERENCIA_RECURSO"(p_modulo text) IS 'Módulo de permissão (pode_recurso) de cada módulo de aviso; cargas não tem: só o administrador global.';

CREATE OR REPLACE FUNCTION private."FC_MARCA_DA_RPC"(p_rpc text, p_area text DEFAULT NULL::text, p_edital uuid DEFAULT NULL::uuid, p_escopo text DEFAULT NULL::text, p_modulo text DEFAULT NULL::text) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_area text;
  v_escopo text;
  v_modulo text;
  v_pacote text;
begin
  -- A permissão de cada RPC é conferida aqui com os mesmos erros da função de sempre:
  -- a resposta `inalterado` não monta nada, mas também não sai para quem não pode ler.
  case p_rpc
  when 'get_analises_dashboard_payload_v2' then
    v_escopo := lower(btrim(coalesce(p_escopo, 'ativo')));
    v_area := lower(btrim(coalesce(p_area, 'saude-indigena')));
    if not private.pode_recurso('analises') then
      raise exception 'Sem permissão para este recurso' using errcode = '42501';
    end if;
    if v_escopo not in ('ativo', 'inativo', 'desativadas') then
      raise exception 'Escopo invalido. Use ativo, inativo ou desativadas.';
    end if;
    perform private."FC_GRUPOS_ANALISES_DA_AREA"(v_area);
    -- Sem recorte e com pacote de menos de 24 h, a função entrega o pacote e a área.
    if private."FC_EDITAIS_VISIVEIS"() is null then
      select concat_ws('|', (extract(epoch from c."DT_GERACAO") * 1000000)::bigint, c."DS_VERSAO_DADOS")
        into v_pacote
        from private."TA_PAINEL_ANALISE" c
       where c."CO_AREA" = v_area and c."TP_ESCOPO" = v_escopo
         and c."DT_GERACAO" > now() - interval '24 hours';
      if v_pacote is not null
         and not private."FC_CACHE_DESATUALIZADO"('ANALISES', v_area) then
        return private."FC_MARCA_DA_LEITURA"('analises_pacote', concat_ws('|', v_area, v_escopo, v_pacote));
      end if;
    end if;
    return private."FC_MARCA_DA_LEITURA"('analises_painel', concat_ws('|', v_area, v_escopo));

  when 'get_entrevistas_da_area' then
    if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
      raise exception 'Área inválida' using errcode = '22023';
    end if;
    if not private.pode_recurso('entrevistas', 1) then
      raise exception 'Sem permissão para Entrevistas' using errcode = '42501';
    end if;
    if not private."FC_PODE_AREA"(p_area) then
      raise exception 'Sem acesso a esta área' using errcode = '42501';
    end if;
    -- Sem recorte e com pacote, a função entrega o pacote como está (DS_PAYLOAD é not null).
    if private."FC_EDITAIS_VISIVEIS"() is null then
      select concat_ws('|', (extract(epoch from c."DT_GERACAO") * 1000000)::bigint, c."DS_VERSAO_DADOS")
        into v_pacote
        from private."TA_PAINEL_ENTREVISTA" c
       where c."CO_AREA" = p_area;
      if v_pacote is not null then
        return private."FC_MARCA_DA_LEITURA"('entrevistas_pacote', concat_ws('|', p_area, v_pacote));
      end if;
    end if;
    return private."FC_MARCA_DA_LEITURA"('entrevistas_area', p_area);

  when 'get_selecao_da_area' then
    if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
      raise exception 'Área inválida' using errcode = '22023';
    end if;
    if not private.pode_recurso('selecao', 1) then
      raise exception 'Sem permissão para Seleção' using errcode = '42501';
    end if;
    if not private."FC_PODE_AREA"(p_area) then
      raise exception 'Sem acesso a esta área' using errcode = '42501';
    end if;
    return private."FC_MARCA_DA_LEITURA"('selecao_area', p_area);

  when 'listar_acompanhamento_da_visao_geral' then
    v_area := lower(btrim(coalesce(p_area, '')));
    if not private.pode_recurso('dashboard') then
      raise exception 'Sem permissão para este recurso' using errcode = '42501';
    end if;
    if not (v_area = any ((select private."FC_AREAS_USUARIO"())::text[])) then
      raise exception 'Sem permissão para esta área' using errcode = '42501';
    end if;
    return private."FC_MARCA_DA_LEITURA"('acompanhamento_visao_geral', v_area);

  when 'obter_regra_analise' then
    perform private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
    return private."FC_MARCA_DA_LEITURA"('regra_analise', p_edital::text);

  when 'obter_classificacao_do_edital' then
    perform private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 1);
    return private."FC_MARCA_DA_LEITURA"('classificacao_edital', p_edital::text);

  when 'listar_avisos_conferencia' then
    v_area := nullif(lower(btrim(coalesce(p_area, ''))), '');
    v_modulo := nullif(lower(btrim(coalesce(p_modulo, ''))), '');
    if auth.uid() is null then
      raise exception 'Sessão necessária' using errcode = '42501';
    end if;
    if v_area is not null and not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
      raise exception 'Área inválida' using errcode = '22023';
    end if;
    if v_modulo is not null and v_modulo not in ('analises', 'entrevistas', 'classificacao', 'aprovados', 'cargas', 'editais') then
      raise exception 'Módulo inválido' using errcode = '22023';
    end if;
    return private."FC_MARCA_DA_LEITURA"('avisos_conferencia', concat_ws('|', coalesce(v_area, ''), coalesce(v_modulo, '')));

  else
    raise exception 'RPC sem marca: %', p_rpc using errcode = '22023';
  end case;
end;
$$;

COMMENT ON FUNCTION private."FC_MARCA_DA_RPC"(p_rpc text, p_area text, p_edital uuid, p_escopo text, p_modulo text) IS 'A marca da leitura de uma RPC por versão, depois de conferir a permissão dela com os mesmos erros (20261029170000). Análises e Entrevistas sem recorte com pacote pronto: marca da linha do pacote (DT_GERACAO, DS_VERSAO_DADOS) e das permissões.';

CREATE OR REPLACE FUNCTION public.gravar_avisos_conferencia(p_execucao text, p_avisos jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
    if v_modulo is null or v_modulo not in ('analises', 'entrevistas', 'classificacao', 'aprovados', 'cargas', 'editais') then
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
      insert into public."TH_AVISO_CONFERENCIA" ("CO_AVISO_CONFERENCIA", "TP_EVENTO", "TP_TRATAMENTO_ANTERIOR", "TP_TRATAMENTO", "TP_SITUACAO", "QT_OCORRENCIA", "DS_MOTIVO", "CO_EXECUCAO")
      values (v_id, 'ACHADO', null, 'PENDENTE', 'ABERTO', v_qt, null, p_execucao);
      v_novos := v_novos + 1;
    -- 20261118120000: o dispensado volta a pendente se a quantidade passar da dispensada; o resolvido
    -- reabre; tudo vai para o histórico (TH_AVISO_CONFERENCIA), nada se apaga.
    elsif v_atual."TP_SITUACAO" = 'RESOLVIDO'
       or (v_atual."TP_TRATAMENTO" = 'DISPENSADO' and v_qt > v_atual."QT_OCORRENCIA_DISPENSADA") then
      v_id := v_atual."CO_AVISO_CONFERENCIA";
      update public."TB_AVISO_CONFERENCIA" set
        "TP_GRAVIDADE" = v_gravidade, "CO_MODULO" = v_modulo, "CO_AREA" = v_area, "CO_MONITORAMENTO" = v_edital,
        "QT_OCORRENCIA" = v_qt, "DS_EXEMPLO" = v_exemplos, "DS_RESUMO" = v_resumo, "CO_EXECUCAO" = p_execucao,
        "TP_SITUACAO" = 'ABERTO', "DT_ULTIMA_VEZ" = now(), "DT_RESOLUCAO" = null,
        "DT_PRIMEIRA_VEZ" = case when v_atual."TP_SITUACAO" = 'RESOLVIDO' then now() else "DT_PRIMEIRA_VEZ" end,
        "TP_TRATAMENTO" = 'PENDENTE', "QT_OCORRENCIA_DISPENSADA" = null,
        "CO_USUARIO_TRATAMENTO" = null, "DT_TRATAMENTO" = now()
       where "CO_AVISO_CONFERENCIA" = v_id;
      insert into public."TH_AVISO_CONFERENCIA" ("CO_AVISO_CONFERENCIA", "TP_EVENTO", "TP_TRATAMENTO_ANTERIOR", "TP_TRATAMENTO", "TP_SITUACAO", "QT_OCORRENCIA", "DS_MOTIVO", "CO_EXECUCAO")
      values (v_id, 'REABERTO', v_atual."TP_TRATAMENTO", 'PENDENTE', 'ABERTO', v_qt,
              case when v_atual."TP_SITUACAO" = 'RESOLVIDO' then 'Achado de novo depois de resolvido'
                   else 'A quantidade passou da dispensada (' || v_atual."QT_OCORRENCIA_DISPENSADA" || ')' end,
              p_execucao);
      v_reabertos := v_reabertos + 1;
    elsif v_atual."TP_TRATAMENTO" = 'CORRIGIDO'
          and v_atual."DT_TRATAMENTO" < (select c."DT_INICIO" from public."TL_CONFERENCIA" c where c."CO_EXECUCAO" = p_execucao) then
      -- Marcado como corrigido antes desta execução, e ela ainda acha: volta para análise.
      v_id := v_atual."CO_AVISO_CONFERENCIA";
      update public."TB_AVISO_CONFERENCIA" set
        "TP_GRAVIDADE" = v_gravidade, "CO_MODULO" = v_modulo, "CO_AREA" = v_area, "CO_MONITORAMENTO" = v_edital,
        "QT_OCORRENCIA" = v_qt, "DS_EXEMPLO" = v_exemplos, "DS_RESUMO" = v_resumo, "CO_EXECUCAO" = p_execucao,
        "DT_ULTIMA_VEZ" = now(), "TP_TRATAMENTO" = 'EM_ANALISE', "CO_USUARIO_TRATAMENTO" = null, "DT_TRATAMENTO" = now()
       where "CO_AVISO_CONFERENCIA" = v_id;
      insert into public."TH_AVISO_CONFERENCIA" ("CO_AVISO_CONFERENCIA", "TP_EVENTO", "TP_TRATAMENTO_ANTERIOR", "TP_TRATAMENTO", "TP_SITUACAO", "QT_OCORRENCIA", "DS_MOTIVO", "CO_EXECUCAO")
      values (v_id, 'RECHECADO_COM_PROBLEMA', 'CORRIGIDO', 'EM_ANALISE', 'ABERTO', v_qt,
              'Marcado como corrigido, mas a conferência ainda acha o problema', p_execucao);
      v_mantidos := v_mantidos + 1;
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
$_$;

COMMENT ON FUNCTION public.gravar_avisos_conferencia(p_execucao text, p_avisos jsonb) IS 'Grava até 1000 avisos de uma execução (um por conferência + escopo): novo abre; resolvido reabre; dispensado volta a pendente só se a quantidade passou da dispensada; corrigido antes da execução e achado de novo volta para em análise; aberto atualiza quantidade e exemplos. Cada mudança vai para TH_AVISO_CONFERENCIA (20261118120000). Com ''casos'' (até 5000: análise, código do candidato, referência, tipo da referência e o detalhe que motivou), troca os casos do aviso. Recusa (22023) exemplo ou caso que não seja id ou código (espaço, @, 11 dígitos), tipo desconhecido e resumo com cara de dado pessoal. Só service_role.';

CREATE OR REPLACE FUNCTION public.listar_avisos_conferencia(p_area text DEFAULT NULL::text, p_modulo text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_area text := nullif(lower(btrim(coalesce(p_area, ''))), '');
  v_modulo text := nullif(lower(btrim(coalesce(p_modulo, ''))), '');
begin
  if auth.uid() is null then
    raise exception 'Sessão necessária' using errcode = '42501';
  end if;
  if v_area is not null and not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if v_modulo is not null and v_modulo not in ('analises', 'entrevistas', 'classificacao', 'aprovados', 'cargas', 'editais') then
    raise exception 'Módulo inválido' using errcode = '22023';
  end if;

  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'ultima_execucao', (
      select json_build_object('inicio', c."DT_INICIO", 'fim', c."DT_FIM", 'situacao', c."TP_SITUACAO")
        from public."TL_CONFERENCIA" c
       where c."TP_SITUACAO" <> 'EM_ANDAMENTO'
       order by c."DT_INICIO" desc
       limit 1
    ),
    'avisos', (
      select coalesce(json_agg(json_build_object(
          'id', a."CO_AVISO_CONFERENCIA",
          'conferencia', a."CO_CONFERENCIA",
          'escopo', a."DS_ESCOPO",
          'gravidade', a."TP_GRAVIDADE",
          'modulo', a."CO_MODULO",
          'area', a."CO_AREA",
          'edital_id', a."CO_MONITORAMENTO",
          'edital', m.edital,
          'quantidade', a."QT_OCORRENCIA",
          'exemplos', a."DS_EXEMPLO",
          'resumo', a."DS_RESUMO",
          'situacao', a."TP_SITUACAO",
          'primeira_vez', a."DT_PRIMEIRA_VEZ",
          'ultima_vez', a."DT_ULTIMA_VEZ",
          'resolvido_em', a."DT_RESOLUCAO",
          -- 20261118120000: o tratamento da equipe, o último motivo, responsável, prazo e evidências.
          'tratamento', a."TP_TRATAMENTO",
          'tratado_em', a."DT_TRATAMENTO",
          'tratado_por', private."FC_NOME_DO_USUARIO"(a."CO_USUARIO_TRATAMENTO"),
          'motivo', (select h."DS_MOTIVO" from public."TH_AVISO_CONFERENCIA" h
                      where h."CO_AVISO_CONFERENCIA" = a."CO_AVISO_CONFERENCIA"
                        and h."TP_EVENTO" in ('TRATAMENTO', 'REABERTO', 'RECHECADO_COM_PROBLEMA', 'MIGRADO')
                      order by h."CO_EVENTO" desc limit 1),
          'responsavel_id', a."CO_USUARIO_RESPONSAVEL",
          'responsavel', private."FC_NOME_DO_USUARIO"(a."CO_USUARIO_RESPONSAVEL"),
          'prazo', a."DT_PRAZO",
          'evidencias', (select count(*) from public."TB_EVIDENCIA_AVISO_CONFERENCIA" e
                          where e."CO_AVISO_CONFERENCIA" = a."CO_AVISO_CONFERENCIA" and e."ST_REGISTRO_ATIVO" = 'S'),
          'pode_gerir', a."TP_SITUACAO" = 'ABERTO'
                        and private."FC_PODE_IGNORAR_AVISO"(a."CO_MODULO", a."CO_AREA", a."CO_MONITORAMENTO"),
          'pode_tratar', a."TP_SITUACAO" = 'ABERTO'
                         and (a."CO_USUARIO_RESPONSAVEL" = auth.uid()
                              or private."FC_PODE_IGNORAR_AVISO"(a."CO_MODULO", a."CO_AREA", a."CO_MONITORAMENTO"))
        ) order by case a."TP_SITUACAO" when 'ABERTO' then 0 else 1 end,
                   case a."TP_GRAVIDADE" when 'CRITICA' then 0 when 'ATENCAO' then 1 else 2 end,
                   a."DT_PRIMEIRA_VEZ"), '[]'::json)
        from public."TB_AVISO_CONFERENCIA" a
        left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = a."CO_MONITORAMENTO"
       where (a."TP_SITUACAO" = 'ABERTO' or a."DT_RESOLUCAO" >= now() - interval '30 days')
         and (v_area is null or a."CO_AREA" = v_area)
         and (v_modulo is null or a."CO_MODULO" = v_modulo)
         and private."FC_PODE_VER_AVISO"(a."CO_MODULO", a."CO_AREA", a."CO_MONITORAMENTO")
    )
  );
end;
$$;

COMMENT ON FUNCTION public.listar_avisos_conferencia(p_area text, p_modulo text) IS 'Avisos de conferência abertos e os resolvidos nos últimos 30 dias (json) que quem chama pode ver: o módulo (leitor), a área e o edital no recorte; cargas e avisos sem área, só o administrador global. Filtra por área e módulo (opcionais). Com o tratamento da equipe, o último motivo, responsável, prazo e quantas evidências (20261118120000); pode_gerir (dispensar, atribuir) e pode_tratar (o gestor ou o responsável).';

CREATE OR REPLACE FUNCTION public.listar_casos_aviso_conferencia(p_aviso uuid DEFAULT NULL::uuid, p_busca text DEFAULT NULL::text, p_area text DEFAULT NULL::text, p_modulo text DEFAULT NULL::text, p_limite integer DEFAULT 50, p_deslocamento integer DEFAULT 0) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    SET statement_timeout TO '15s'
    AS $_$
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
  if v_modulo is not null and v_modulo not in ('analises', 'entrevistas', 'classificacao', 'aprovados', 'cargas', 'editais') then
    raise exception 'Módulo inválido' using errcode = '22023';
  end if;
  if p_aviso is null and v_busca is null then
    raise exception 'Informe o aviso ou o que buscar' using errcode = '22023';
  end if;
  if p_aviso is not null and not exists (
       select 1 from public."TB_AVISO_CONFERENCIA" a
        where a."CO_AVISO_CONFERENCIA" = p_aviso
          and private."FC_PODE_VER_AVISO"(a."CO_MODULO", a."CO_AREA", a."CO_MONITORAMENTO")) then
    raise exception 'Aviso não encontrado' using errcode = '22023';
  end if;

  with avisos as (
    select a."CO_AVISO_CONFERENCIA" as id, a."CO_CONFERENCIA" as conferencia, a."CO_MODULO" as modulo,
           a."CO_AREA" as area, a."CO_MONITORAMENTO" as edital
      from public."TB_AVISO_CONFERENCIA" a
     -- 20261118120000: os casos do aviso resolvido também se abrem (pelo id); a busca, só nos abertos.
     where (a."TP_SITUACAO" = 'ABERTO' or a."CO_AVISO_CONFERENCIA" = p_aviso)
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
$_$;

COMMENT ON FUNCTION public.listar_casos_aviso_conferencia(p_aviso uuid, p_busca text, p_area text, p_modulo text, p_limite integer, p_deslocamento integer) IS 'Casos (json, em páginas de até 1000) de um aviso de conferência, ou de todos os avisos abertos e ignorados que quem chama vê (área e módulo opcionais; exige p_busca). Busca por código do candidato, nome, código ou nome da vaga e referência (sem acento e sem caixa). Cada caso: tipo e resolução (ok, removido, sem_acesso), código, nome, edital, vaga, situação e datas — da análise (área e recorte de quem lê) ou do registro do módulo (aprovado, entrevista, lista, ajuste, vaga) com a permissão daquele módulo —, o detalhe que motivou o aviso, as análises do candidato em dois editais e as vagas da pessoa nas listas de aprovados (com quantas ficaram fora do acesso). A referência só sai quando não é UUID. Sem CPF.';

commit;
