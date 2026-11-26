/*
  ENSAIO de 20261126180000_retificar_linha_do_quadro_de_vagas.sql (não grava: termina em rollback)

  Roda a migration inteira (o SQL entre o begin e o commit dela, sem mudança) e confere:
    1. TH_QUADRO_VAGA_EDITAL vazia, com RLS; a CHECK dos vínculos aceita RETIFICACAO;
    2. nenhum vínculo nem linha do quadro mudou só por aplicar.
  Com uma pessoa editora do Núcleo (rode antes, na mesma sessão,
  select set_config('agsus.ensaio_usuario', '<user_id>', false);), confere também, no edital com
  mais vínculos decididos pela equipe:
    3. a simulação (simular: true) do quadro igual, linha por linha com `anterior`, devolve as
       mesmas situações e não grava nada;
    4. a retificação de verdade (dentro deste ensaio) leva cada vínculo para a linha sucessora,
       sem pendência nova, e grava o histórico RETIFICACAO;
    5. retirar a linha de um vínculo MANUAL deixa a vaga "sem linha" (AUSENTE, MANUAL, sem
       pendência).

  psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/ensaios/20261126180000_retificar_linha_do_quadro_de_vagas.sql
*/
begin;

create temp table ensaio_vinculos_antes on commit drop as
  select v."CO_MONITORAMENTO", v."CO_VAGA", v."TP_VINCULO", v."TP_ORIGEM", v."CO_QUADRO_VAGA", v."DS_PENDENCIA"
    from public."TA_VAGA_QUADRO_EDITAL" v;
create temp table ensaio_quadro_antes on commit drop as
  select q."CO_QUADRO_VAGA", q."ST_REGISTRO_ATIVO" from public."TB_QUADRO_VAGA_EDITAL" q;

-- A migration, sem o begin e o commit ----------------------------------------------------------
-- >>> migration

set local lock_timeout = '5s';

-- 0. Guardas ---------------------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TH_QUADRO_VAGA_EDITAL"') is not null then
    raise exception 'A migration 20261126180000 já foi aplicada (TH_QUADRO_VAGA_EDITAL existe).';
  end if;
  if to_regclass('public."TA_VAGA_QUADRO_EDITAL"') is null then
    raise exception 'Falta a migration 20261118120000 (TA_VAGA_QUADRO_EDITAL).';
  end if;
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.salvar_quadro_de_vagas(uuid, jsonb)')), E'\r', ''))
       is distinct from '52b6b27ca6ba5e5d727b5db3b4622c4e'
     or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.obter_quadro_de_vagas(uuid)')), E'\r', ''))
       is distinct from 'a64aafb90c7995214a04f6d84008e7e4'
     or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('private."FC_PREENCHER_VINCULOS_QUADRO"(uuid, boolean, uuid)')), E'\r', ''))
       is distinct from '3093a81e2e90d8278ddebde1c33530a9'
     or md5(replace((select prosrc from pg_proc where oid = to_regprocedure('private."FC_GRAVAR_VINCULO_QUADRO"(uuid, text, text, text, text, text, uuid, uuid[], text, text, uuid)')), E'\r', ''))
       is distinct from 'aeb1b1104de2cc3d8fd904269e6339fd'
  then
    raise exception 'Uma das funções do quadro de vagas mudou desde 26/11/2026 (md5 do corpo): junte as mudanças antes de aplicar.';
  end if;
  if (select pg_get_constraintdef(c.oid) from pg_constraint c
       where c.conrelid = 'public."TH_VAGA_QUADRO_EDITAL"'::regclass and c.conname = 'CK_HISTVAGAQUADRO_TPEVENTO')
     is distinct from 'CHECK ((("TP_EVENTO")::text = ANY ((ARRAY[''PREENCHIMENTO''::character varying, ''CONFIRMACAO''::character varying, ''REIMPORTACAO''::character varying, ''RETORNO_AUTOMATICO''::character varying, ''REMOCAO''::character varying])::text[])))'
  then
    raise exception 'A CHECK CK_HISTVAGAQUADRO_TPEVENTO não é a de 20261118120000: junte as mudanças antes de aplicar.';
  end if;
end
$$;

-- 1. O histórico do quadro ---------------------------------------------------------------------
create table public."TH_QUADRO_VAGA_EDITAL" (
  "SQ_HISTORICO" bigint generated always as identity,
  "CO_MONITORAMENTO" uuid not null,
  "TP_EVENTO" varchar(20) not null,
  "DS_MOTIVO" varchar(500),
  "DS_NUMERO_ERRATA" varchar(100),
  "DS_LINHA_ANTERIOR" jsonb default '[]'::jsonb not null,
  "DS_LINHA_NOVA" jsonb default '[]'::jsonb not null,
  "CO_USUARIO" uuid,
  "DT_EVENTO" timestamptz default now() not null,
  constraint "PK_TH_QUADRO_VAGA_EDITAL" primary key ("SQ_HISTORICO"),
  constraint "CK_HISTQUADROVAGA_TPEVENTO" check ("TP_EVENTO" in ('IMPORTACAO', 'RETIFICACAO')),
  constraint "CK_HISTQUADROVAGA_MOTIVO" check ("TP_EVENTO" <> 'RETIFICACAO' or length(btrim("DS_MOTIVO")) between 10 and 500),
  constraint "CK_HISTQUADROVAGA_LINHAS" check (jsonb_typeof("DS_LINHA_ANTERIOR") = 'array' and jsonb_typeof("DS_LINHA_NOVA") = 'array')
);

create index "IN_HISTQUADROVAGA_EDITAL" on public."TH_QUADRO_VAGA_EDITAL" ("CO_MONITORAMENTO", "DT_EVENTO" desc);

comment on table public."TH_QUADRO_VAGA_EDITAL" is 'Histórico do quadro de vagas do edital (TB_QUADRO_VAGA_EDITAL): cada gravação, importação do PDF ou retificação de linhas, com motivo, errata e as linhas antes e depois. 20261126180000.';
comment on index public."IN_HISTQUADROVAGA_EDITAL" is 'Histórico do quadro de um edital, do mais recente.';
comment on column public."TH_QUADRO_VAGA_EDITAL"."SQ_HISTORICO" is 'Sequencial do evento.';
comment on column public."TH_QUADRO_VAGA_EDITAL"."CO_MONITORAMENTO" is 'Edital (sem chave estrangeira: o histórico fica).';
comment on column public."TH_QUADRO_VAGA_EDITAL"."TP_EVENTO" is 'IMPORTACAO (o quadro inteiro, do PDF) ou RETIFICACAO (linhas corrigidas, acrescentadas ou retiradas, com motivo).';
comment on column public."TH_QUADRO_VAGA_EDITAL"."DS_MOTIVO" is 'Por que o quadro mudou ("Retificação nº 2 do edital"); obrigatório na retificação.';
comment on column public."TH_QUADRO_VAGA_EDITAL"."DS_NUMERO_ERRATA" is 'Número da errata ou retificação publicada, quando houver.';
comment on column public."TH_QUADRO_VAGA_EDITAL"."DS_LINHA_ANTERIOR" is 'As linhas vigentes antes (id, ordem, cargo, lotação, modalidades, vagas imediatas, cadastro reserva, origem, arquivo).';
comment on column public."TH_QUADRO_VAGA_EDITAL"."DS_LINHA_NOVA" is 'As linhas gravadas, com `anterior` (a linha que cada uma substitui; nulo = linha nova).';
comment on column public."TH_QUADRO_VAGA_EDITAL"."CO_USUARIO" is 'Quem gravou (auth.users).';
comment on column public."TH_QUADRO_VAGA_EDITAL"."DT_EVENTO" is 'Quando.';
comment on constraint "CK_HISTQUADROVAGA_TPEVENTO" on public."TH_QUADRO_VAGA_EDITAL" is 'IMPORTACAO ou RETIFICACAO.';
comment on constraint "CK_HISTQUADROVAGA_MOTIVO" on public."TH_QUADRO_VAGA_EDITAL" is 'A retificação tem motivo de 10 a 500 caracteres.';
comment on constraint "CK_HISTQUADROVAGA_LINHAS" on public."TH_QUADRO_VAGA_EDITAL" is 'As linhas antes e depois são listas.';

alter table public."TH_QUADRO_VAGA_EDITAL" enable row level security;
revoke all on table public."TH_QUADRO_VAGA_EDITAL" from anon, authenticated;

-- 2. O vínculo levado pela retificação tem evento próprio -------------------------------------
alter table public."TH_VAGA_QUADRO_EDITAL" drop constraint "CK_HISTVAGAQUADRO_TPEVENTO";
alter table public."TH_VAGA_QUADRO_EDITAL" add constraint "CK_HISTVAGAQUADRO_TPEVENTO" check ("TP_EVENTO" in
  ('PREENCHIMENTO', 'CONFIRMACAO', 'REIMPORTACAO', 'RETIFICACAO', 'RETORNO_AUTOMATICO', 'REMOCAO'));
comment on column public."TH_VAGA_QUADRO_EDITAL"."TP_EVENTO" is 'PREENCHIMENTO (regra), CONFIRMACAO (equipe), REIMPORTACAO (quadro novo), RETIFICACAO (a linha foi corrigida e o vínculo foi junto, 20261126180000), RETORNO_AUTOMATICO (equipe devolveu à regra) ou REMOCAO (a vaga saiu do edital).';

-- 3. Salvar o quadro: origem por linha, motivo, histórico e o vínculo pela linha anterior -----
CREATE OR REPLACE FUNCTION public.salvar_quadro_de_vagas(p_edital uuid, p_dados jsonb) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_linhas jsonb := coalesce(p_dados -> 'linhas', '[]'::jsonb);
  v_origem text := coalesce(nullif(upper(p_dados ->> 'origem'), ''), 'PDF');
  v_arquivo text := left(nullif(btrim(p_dados ->> 'arquivo'), ''), 300);
  v_motivo text := nullif(btrim(p_dados ->> 'motivo'), '');
  v_errata text := left(nullif(btrim(p_dados ->> 'numero_errata'), ''), 100);
  v_uid uuid := (select auth.uid());
  v_simular boolean := coalesce((p_dados ->> 'simular')::boolean, false);
  v_retificacao boolean;
  v_antes jsonb;
  v_depois jsonb;
  v_resultado json;
  r record;
begin
 -- A simulação faz tudo num bloco que se desfaz no fim e devolve o quadro como ficaria.
 begin
  -- A gravação do quadro do mesmo edital fica em fila (as validações abaixo veem o quadro vigente).
  perform 1 from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital for no key update;
  if not found then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;
  if not (private.pode_recurso('nucleo', 2) or private.pode_recurso('calendario', 2)) then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;
  perform private."FC_EXIGIR_AREA_EDITAL"(p_edital::text);
  if jsonb_typeof(v_linhas) <> 'array' or jsonb_array_length(v_linhas) > 500 then
    raise exception 'Quadro de vagas inválido (até 500 linhas)' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(v_linhas) l
              where jsonb_typeof(l) <> 'object'
                 or length(btrim(coalesce(l ->> 'cargo', ''))) not between 1 and 300
                 or coalesce(nullif(l ->> 'vagas_imediatas', '')::integer, 0) not between 0 and 9999
                 or jsonb_typeof(coalesce(l -> 'modalidades', '{}'::jsonb)) <> 'object') then
    raise exception 'Há linha do quadro sem cargo ou com quantidade inválida' using errcode = '22023';
  end if;
  if v_origem not in ('PDF', 'MANUAL')
     or exists (select 1 from jsonb_array_elements(v_linhas) l
                 where upper(coalesce(nullif(l ->> 'origem', ''), 'PDF')) not in ('PDF', 'MANUAL')) then
    raise exception 'Origem do quadro inválida (PDF ou MANUAL)' using errcode = '22023';
  end if;
  -- `anterior`: uma linha do quadro vigente deste edital, sucedida por uma linha só.
  if exists (select 1 from jsonb_array_elements(v_linhas) l
              where nullif(l ->> 'anterior', '') is not null
                and not exists (select 1 from public."TB_QUADRO_VAGA_EDITAL" q
                                 where q."CO_QUADRO_VAGA"::text = lower(l ->> 'anterior')
                                   and q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S'))
     or (select count(*) <> count(distinct lower(l ->> 'anterior'))
           from jsonb_array_elements(v_linhas) l where nullif(l ->> 'anterior', '') is not null) then
    raise exception 'A linha retificada não é do quadro vigente deste edital, ou aparece duas vezes' using errcode = '22023';
  end if;

  v_retificacao := v_motivo is not null
                   or exists (select 1 from jsonb_array_elements(v_linhas) l where nullif(l ->> 'anterior', '') is not null);
  if v_retificacao and length(coalesce(v_motivo, '')) not between 10 and 500 then
    raise exception 'Diga o motivo da retificação (de 10 a 500 caracteres)' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', q."CO_QUADRO_VAGA", 'ordem', q."NU_ORDEM", 'cargo', q."NO_CARGO",
           'lotacao', q."NO_LOTACAO", 'modalidades', q."DS_MODALIDADE_VAGA", 'vagas_imediatas', q."QT_VAGA_IMEDIATA",
           'cadastro_reserva', q."ST_CADASTRO_RESERVA" = 'S', 'origem', q."TP_ORIGEM", 'arquivo', q."DS_ARQUIVO_ORIGEM")
           order by q."NU_ORDEM"), '[]'::jsonb)
    into v_antes
    from public."TB_QUADRO_VAGA_EDITAL" q
   where q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S';

  update public."TB_QUADRO_VAGA_EDITAL"
     set "ST_REGISTRO_ATIVO" = 'N', "DT_DESATIVACAO" = now()
   where "CO_MONITORAMENTO" = p_edital and "ST_REGISTRO_ATIVO" = 'S';

  -- Linha com `anterior` herda dela a origem e o arquivo que não vierem.
  insert into public."TB_QUADRO_VAGA_EDITAL" ("CO_MONITORAMENTO", "NU_ORDEM", "NO_CARGO", "NO_LOTACAO", "DS_MODALIDADE_VAGA",
    "QT_VAGA_IMEDIATA", "ST_CADASTRO_RESERVA", "TP_ORIGEM", "DS_ARQUIVO_ORIGEM", "CO_USUARIO_ATUALIZACAO")
  select p_edital, l.ordem, btrim(l.valor ->> 'cargo'), left(nullif(btrim(l.valor ->> 'lotacao'), ''), 300),
         coalesce(l.valor -> 'modalidades', '{}'::jsonb), coalesce(nullif(l.valor ->> 'vagas_imediatas', '')::integer, 0),
         case when (l.valor ->> 'cadastro_reserva')::boolean then 'S' else 'N' end,
         coalesce(nullif(upper(l.valor ->> 'origem'), ''), a."TP_ORIGEM", v_origem),
         case when l.valor ? 'arquivo' then left(nullif(btrim(l.valor ->> 'arquivo'), ''), 300)
              when a."CO_QUADRO_VAGA" is not null then a."DS_ARQUIVO_ORIGEM"
              else v_arquivo end,
         v_uid
    from jsonb_array_elements(v_linhas) with ordinality l(valor, ordem)
    left join public."TB_QUADRO_VAGA_EDITAL" a
      on a."CO_MONITORAMENTO" = p_edital and a."CO_QUADRO_VAGA"::text = lower(nullif(l.valor ->> 'anterior', ''));

  -- O vínculo da linha retificada vai direto para a sucessora, mesmo com outro cargo ou lotação.
  for r in
    select v."CO_VAGA" as vaga, v."NO_VAGA" as nome, v."TP_VINCULO" as situacao, v."TP_ORIGEM" as origem,
           v."TP_REGRA" as regra, n."CO_QUADRO_VAGA" as nova
      from jsonb_array_elements(v_linhas) with ordinality l(valor, ordem)
      join public."TB_QUADRO_VAGA_EDITAL" n
        on n."CO_MONITORAMENTO" = p_edital and n."ST_REGISTRO_ATIVO" = 'S' and n."NU_ORDEM" = l.ordem
      join public."TA_VAGA_QUADRO_EDITAL" v
        on v."CO_MONITORAMENTO" = p_edital and v."CO_QUADRO_VAGA"::text = lower(nullif(l.valor ->> 'anterior', ''))
     order by v."CO_VAGA"
  loop
    perform private."FC_GRAVAR_VINCULO_QUADRO"(p_edital, r.vaga, r.nome, r.situacao, r.origem, r.regra,
                                               r.nova, '{}', null, 'RETIFICACAO', v_uid);
  end loop;

  -- Linha retirada na retificação: a vaga que a equipe ligou a ela fica "sem linha" (MANUAL), com
  -- histórico, em vez da pendência da reimportação. O automático segue a regra, abaixo.
  if v_retificacao then
    for r in
      select v."CO_VAGA" as vaga, v."NO_VAGA" as nome
        from public."TA_VAGA_QUADRO_EDITAL" v
        join public."TB_QUADRO_VAGA_EDITAL" q on q."CO_QUADRO_VAGA" = v."CO_QUADRO_VAGA"
       where v."CO_MONITORAMENTO" = p_edital and v."TP_ORIGEM" = 'MANUAL' and q."ST_REGISTRO_ATIVO" = 'N'
       order by v."CO_VAGA"
    loop
      perform private."FC_GRAVAR_VINCULO_QUADRO"(p_edital, r.vaga, r.nome, 'AUSENTE', 'MANUAL', null,
                                                 null, '{}', null, 'RETIFICACAO', v_uid);
    end loop;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', q."CO_QUADRO_VAGA", 'ordem', q."NU_ORDEM", 'cargo', q."NO_CARGO",
           'lotacao', q."NO_LOTACAO", 'modalidades', q."DS_MODALIDADE_VAGA", 'vagas_imediatas', q."QT_VAGA_IMEDIATA",
           'cadastro_reserva', q."ST_CADASTRO_RESERVA" = 'S', 'origem', q."TP_ORIGEM", 'arquivo', q."DS_ARQUIVO_ORIGEM",
           'anterior', lower(nullif(l.valor ->> 'anterior', '')))
           order by q."NU_ORDEM"), '[]'::jsonb)
    into v_depois
    from public."TB_QUADRO_VAGA_EDITAL" q
    join jsonb_array_elements(v_linhas) with ordinality l(valor, ordem) on l.ordem = q."NU_ORDEM"
   where q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S';

  insert into public."TH_QUADRO_VAGA_EDITAL" ("CO_MONITORAMENTO", "TP_EVENTO", "DS_MOTIVO", "DS_NUMERO_ERRATA",
    "DS_LINHA_ANTERIOR", "DS_LINHA_NOVA", "CO_USUARIO")
  values (p_edital, case when v_retificacao then 'RETIFICACAO' else 'IMPORTACAO' end, v_motivo, v_errata,
          v_antes, v_depois, v_uid);

  -- Os outros vínculos: pela chave (linha sem sucessora) e pela regra (20261118120000).
  perform private."FC_PREENCHER_VINCULOS_QUADRO"(p_edital, false, v_uid);

  v_resultado := public.obter_quadro_de_vagas(p_edital);
  if v_simular then
    raise exception 'Simulação do quadro de vagas' using errcode = 'AGQ01';
  end if;
 exception when sqlstate 'AGQ01' then
  null; -- simulação: o bloco se desfez; v_resultado é o quadro como ficaria
 end;

  return v_resultado;
end;
$$;

COMMENT ON FUNCTION public.salvar_quadro_de_vagas(p_edital uuid, p_dados jsonb) IS 'Substitui o quadro de vagas do edital (o anterior fica desativado, com histórico em TH_QUADRO_VAGA_EDITAL) e passa os vínculos das vagas para as linhas novas: a linha com `anterior` leva o vínculo da linha que substitui (evento RETIFICACAO); na retificação, a vaga MANUAL de linha retirada fica sem linha; as demais, pela chave e pela regra (FC_PREENCHER_VINCULOS_QUADRO). simular: true devolve o quadro como ficaria, sem gravar. p_dados: {origem PDF|MANUAL, arquivo, motivo, numero_errata, simular, linhas:[{cargo, lotacao, modalidades, vagas_imediatas, cadastro_reserva, origem, arquivo, anterior}]}; com `anterior` ou motivo é retificação, e o motivo (10 a 500 caracteres) é obrigatório. Núcleo ou Calendário (editor) e o edital. 20261126180000.';

-- 4. Ler o quadro: origem e arquivo por linha e o histórico -----------------------------------
CREATE OR REPLACE FUNCTION public.obter_quadro_de_vagas(p_edital uuid) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_m public."TB_MONITORAMENTO_INDIGENA";
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  if v_m.id is null then raise exception 'Edital não encontrado' using errcode = '22023'; end if;
  if not (private.pode_recurso('nucleo', 1) or private.pode_recurso('calendario', 1) or private.pode_recurso('entrevistas', 1)) then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;
  perform private."FC_EXIGIR_AREA_EDITAL"(p_edital::text);
  return json_build_object(
    'edital', p_edital,
    'linhas', coalesce((
      select json_agg(json_build_object('id', q."CO_QUADRO_VAGA", 'ordem', q."NU_ORDEM", 'cargo', q."NO_CARGO",
               'lotacao', q."NO_LOTACAO", 'modalidades', q."DS_MODALIDADE_VAGA", 'vagas_imediatas', q."QT_VAGA_IMEDIATA",
               'cadastro_reserva', q."ST_CADASTRO_RESERVA" = 'S',
               'origem', q."TP_ORIGEM", 'arquivo', q."DS_ARQUIVO_ORIGEM") order by q."NU_ORDEM")
        from public."TB_QUADRO_VAGA_EDITAL" q
       where q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S'), '[]'::json),
    -- De onde veio: a primeira linha do PDF; quadro todo manual, a primeira linha (20261126180000).
    'origem', (select json_build_object('tipo', q."TP_ORIGEM", 'arquivo', q."DS_ARQUIVO_ORIGEM", 'gravado_em', q."DT_CRIACAO")
                 from public."TB_QUADRO_VAGA_EDITAL" q
                where q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S'
                order by (q."TP_ORIGEM" = 'PDF') desc, q."NU_ORDEM" limit 1),
    -- O vínculo de cada vaga (TA_VAGA_QUADRO_EDITAL, 20261118120000); 'cargo' é o nome da vaga, como antes.
    'vinculos', coalesce((
      select json_agg(json_build_object('vaga', v."CO_VAGA", 'cargo', v."NO_VAGA", 'quadro', v."CO_QUADRO_VAGA",
               'situacao', v."TP_VINCULO", 'origem', v."TP_ORIGEM", 'regra', v."TP_REGRA",
               'cargo_quadro', v."NO_CARGO_QUADRO", 'lotacao_quadro', v."NO_LOTACAO_QUADRO",
               'candidatas', v."DS_CANDIDATA", 'pendencia', v."DS_PENDENCIA",
               'confirmado_em', v."DT_CONFIRMACAO",
               'confirmado_por', (select p.nome from public."TB_PERFIL_USUARIO" p
                                   where p.user_id = v."CO_USUARIO_CONFIRMACAO" limit 1))
             order by v."NO_VAGA", v."CO_VAGA")
        from public."TA_VAGA_QUADRO_EDITAL" v
       where v."CO_MONITORAMENTO" = p_edital), '[]'::json),
    -- Sem vaga com código não há o que ligar: o motivo, sem inventar vaga.
    'vagas_do_edital', case
      when exists (select 1 from public."TA_VAGA_QUADRO_EDITAL" v where v."CO_MONITORAMENTO" = p_edital) then 'COM_CODIGO'
      when coalesce(v_m.status, '') = 'Cancelado' then 'NAO_SE_APLICA'
      when exists (select 1 from public."TB_SELECAO_VAGA" s
                    where s."CO_MONITORAMENTO" = p_edital and s."ST_REGISTRO_ATIVO" = 'S') then 'EXTERNO'
      else 'PENDENTE_INTEGRACAO' end,
    -- As 20 últimas gravações do quadro, da mais recente (TH_QUADRO_VAGA_EDITAL, 20261126180000).
    'historico', coalesce((
      select json_agg(json_build_object('evento', h."TP_EVENTO", 'motivo', h."DS_MOTIVO",
               'numero_errata', h."DS_NUMERO_ERRATA", 'gravado_em', h."DT_EVENTO",
               'gravado_por', (select p.nome from public."TB_PERFIL_USUARIO" p where p.user_id = h."CO_USUARIO" limit 1),
               'linhas_antes', jsonb_array_length(h."DS_LINHA_ANTERIOR"), 'linhas_depois', jsonb_array_length(h."DS_LINHA_NOVA"))
             order by h."DT_EVENTO" desc, h."SQ_HISTORICO" desc)
        from (select * from public."TH_QUADRO_VAGA_EDITAL" x
               where x."CO_MONITORAMENTO" = p_edital
               order by x."DT_EVENTO" desc, x."SQ_HISTORICO" desc limit 20) h), '[]'::json),
    'pode_editar', private.pode_recurso('nucleo', 2) or private.pode_recurso('calendario', 2)
  );
end;
$$;

COMMENT ON FUNCTION public.obter_quadro_de_vagas(p_edital uuid) IS 'Quadro de vagas vigente do edital (cada linha com origem PDF|MANUAL e arquivo), de onde veio, o histórico das 20 últimas gravações (TH_QUADRO_VAGA_EDITAL: evento, motivo, errata, quem, quando) e o vínculo de cada vaga com a linha (TA_VAGA_QUADRO_EDITAL: situação, origem, candidatas, pendência, quem confirmou); vagas_do_edital diz por que não há vaga para ligar (NAO_SE_APLICA, EXTERNO, PENDENTE_INTEGRACAO); pode_editar = pode gravar o quadro e o vínculo. Núcleo, Calendário ou Entrevistas (leitor) e o edital. 20261126180000.';

-- <<< migration

-- Conferências ---------------------------------------------------------------------------------
do $$
declare
  v_usuario text := nullif(current_setting('agsus.ensaio_usuario', true), '');
  v_edital uuid;
  v_linhas jsonb;
  v_sim json;
  v_retirar uuid;
  v_vaga text;
  r record;
begin
  -- 1.
  if exists (select 1 from public."TH_QUADRO_VAGA_EDITAL") then
    raise exception 'Ensaio: TH_QUADRO_VAGA_EDITAL deveria nascer vazia.';
  end if;
  if not (select c.relrowsecurity from pg_class c where c.oid = 'public."TH_QUADRO_VAGA_EDITAL"'::regclass) then
    raise exception 'Ensaio: TH_QUADRO_VAGA_EDITAL sem RLS.';
  end if;
  if pg_get_constraintdef((select c.oid from pg_constraint c where c.conname = 'CK_HISTVAGAQUADRO_TPEVENTO'))
       not like '%RETIFICACAO%' then
    raise exception 'Ensaio: a CHECK dos vínculos não aceita RETIFICACAO.';
  end if;
  -- 2.
  if exists (select v."CO_MONITORAMENTO", v."CO_VAGA", v."TP_VINCULO", v."TP_ORIGEM", v."CO_QUADRO_VAGA", v."DS_PENDENCIA"
               from public."TA_VAGA_QUADRO_EDITAL" v
             except select * from ensaio_vinculos_antes)
     or exists (select q."CO_QUADRO_VAGA", q."ST_REGISTRO_ATIVO" from public."TB_QUADRO_VAGA_EDITAL" q
                except select * from ensaio_quadro_antes) then
    raise exception 'Ensaio: aplicar a migration mudou vínculo ou linha do quadro.';
  end if;
  raise notice 'Ensaio: estrutura conferida (1 e 2).';

  if v_usuario is null then
    raise notice 'Ensaio: sem agsus.ensaio_usuario, as conferências 3 a 5 ficam de fora.';
    return;
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_usuario, 'role', 'authenticated')::text, true);

  select v."CO_MONITORAMENTO" into v_edital
    from public."TA_VAGA_QUADRO_EDITAL" v
    join public."TB_QUADRO_VAGA_EDITAL" q on q."CO_QUADRO_VAGA" = v."CO_QUADRO_VAGA" and q."ST_REGISTRO_ATIVO" = 'S'
   group by 1 order by count(*) filter (where v."TP_ORIGEM" = 'MANUAL') desc, count(*) desc limit 1;
  if v_edital is null then
    raise notice 'Ensaio: nenhum edital com vínculo confirmado; 3 a 5 de fora.';
    return;
  end if;
  select jsonb_agg(jsonb_build_object('cargo', q."NO_CARGO", 'lotacao', q."NO_LOTACAO", 'modalidades', q."DS_MODALIDADE_VAGA",
           'vagas_imediatas', q."QT_VAGA_IMEDIATA", 'cadastro_reserva', q."ST_CADASTRO_RESERVA" = 'S',
           'anterior', q."CO_QUADRO_VAGA") order by q."NU_ORDEM")
    into v_linhas
    from public."TB_QUADRO_VAGA_EDITAL" q where q."CO_MONITORAMENTO" = v_edital and q."ST_REGISTRO_ATIVO" = 'S';
  raise notice 'Ensaio: edital % (% linhas).', v_edital, jsonb_array_length(v_linhas);

  -- 3.
  v_sim := public.salvar_quadro_de_vagas(v_edital, jsonb_build_object('motivo', 'Ensaio da retificação por linha',
                                                                       'simular', true, 'linhas', v_linhas));
  if exists (select 1 from json_array_elements(v_sim -> 'vinculos') x
               join ensaio_vinculos_antes a on a."CO_MONITORAMENTO" = v_edital and a."CO_VAGA" = x ->> 'vaga'
              where (x ->> 'situacao') is distinct from a."TP_VINCULO") then
    raise exception 'Ensaio: a simulação do quadro igual mudou a situação de algum vínculo.';
  end if;
  if exists (select 1 from public."TH_QUADRO_VAGA_EDITAL")
     or exists (select q."CO_QUADRO_VAGA", q."ST_REGISTRO_ATIVO" from public."TB_QUADRO_VAGA_EDITAL" q
                except select * from ensaio_quadro_antes) then
    raise exception 'Ensaio: a simulação gravou.';
  end if;

  -- 4.
  perform public.salvar_quadro_de_vagas(v_edital, jsonb_build_object('motivo', 'Ensaio da retificação por linha',
                                                                     'linhas', v_linhas));
  for r in
    select a."CO_VAGA" as vaga, a."TP_VINCULO" as antes, v."TP_VINCULO" as depois, v."DS_PENDENCIA" as pendencia,
           qa."NU_ORDEM" as ordem_antes, qd."NU_ORDEM" as ordem_depois
      from ensaio_vinculos_antes a
      join public."TA_VAGA_QUADRO_EDITAL" v on v."CO_MONITORAMENTO" = a."CO_MONITORAMENTO" and v."CO_VAGA" = a."CO_VAGA"
      left join public."TB_QUADRO_VAGA_EDITAL" qa on qa."CO_QUADRO_VAGA" = a."CO_QUADRO_VAGA"
      left join public."TB_QUADRO_VAGA_EDITAL" qd on qd."CO_QUADRO_VAGA" = v."CO_QUADRO_VAGA"
     where a."CO_MONITORAMENTO" = v_edital
  loop
    if r.antes is distinct from r.depois or r.ordem_antes is distinct from r.ordem_depois
       or (r.pendencia is not null and r.antes = 'CONFIRMADO') then
      raise exception 'Ensaio: a vaga % mudou com o quadro igual (% → %).', r.vaga, r.antes, r.depois;
    end if;
  end loop;
  if (select count(*) from public."TH_QUADRO_VAGA_EDITAL" h where h."TP_EVENTO" = 'RETIFICACAO') <> 1 then
    raise exception 'Ensaio: a retificação não foi ao histórico do quadro.';
  end if;

  -- 5.
  select v."CO_QUADRO_VAGA", v."CO_VAGA" into v_retirar, v_vaga
    from public."TA_VAGA_QUADRO_EDITAL" v
   where v."CO_MONITORAMENTO" = v_edital and v."TP_ORIGEM" = 'MANUAL' and v."CO_QUADRO_VAGA" is not null
   order by v."CO_VAGA" limit 1;
  if v_retirar is null then
    raise notice 'Ensaio: o edital não tem vínculo MANUAL com linha; 5 de fora.';
  else
    select jsonb_agg(jsonb_build_object('cargo', q."NO_CARGO", 'lotacao', q."NO_LOTACAO", 'modalidades', q."DS_MODALIDADE_VAGA",
             'vagas_imediatas', q."QT_VAGA_IMEDIATA", 'cadastro_reserva', q."ST_CADASTRO_RESERVA" = 'S',
             'anterior', q."CO_QUADRO_VAGA") order by q."NU_ORDEM")
      into v_linhas
      from public."TB_QUADRO_VAGA_EDITAL" q
     where q."CO_MONITORAMENTO" = v_edital and q."ST_REGISTRO_ATIVO" = 'S' and q."CO_QUADRO_VAGA" <> v_retirar;
    perform public.salvar_quadro_de_vagas(v_edital, jsonb_build_object('motivo', 'Ensaio: retirar uma linha',
                                                                       'linhas', coalesce(v_linhas, '[]'::jsonb)));
    if not exists (select 1 from public."TA_VAGA_QUADRO_EDITAL" v
                    where v."CO_MONITORAMENTO" = v_edital and v."CO_VAGA" = v_vaga and v."TP_VINCULO" = 'AUSENTE'
                      and v."TP_ORIGEM" = 'MANUAL' and v."DS_PENDENCIA" is null and v."CO_QUADRO_VAGA" is null) then
      raise exception 'Ensaio: a vaga % da linha retirada não ficou "sem linha".', v_vaga;
    end if;
  end if;
  raise notice 'Ensaio: retificação conferida (3 a 5).';
end
$$;

rollback;
