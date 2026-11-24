--
-- Trechos do retrato do banco (supabase/esquema-atual.sql) de 24/11/2026, ANTES da migration
-- 20261124210000_ampliar_pedido_de_acesso.sql: as tabelas, o índice, as funções e os grants
-- que o banco de teste do pedido de acesso monta (tests/apoio/banco-do-pedido-de-acesso.ts).
-- Copiados sem mudança; o retrato atual já tem a migration aplicada. Só leitura de teste.
--

CREATE TABLE public."TB_PERFIL_USUARIO" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    email text,
    nome text,
    perfil text DEFAULT 'usuario'::text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    p_ind boolean DEFAULT false NOT NULL,
    p_cores boolean DEFAULT false NOT NULL,
    p_paineis boolean DEFAULT false NOT NULL,
    p_config boolean DEFAULT false NOT NULL,
    p_admin boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    avatar_source text DEFAULT 'INITIALS'::text NOT NULL,
    avatar_url text,
    avatar_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    google_avatar_url text,
    "CO_COORDENACAO" text,
    CONSTRAINT perfis_usuarios_avatar_source_check CHECK ((avatar_source = ANY (ARRAY['GOOGLE'::text, 'UPLOADED'::text, 'GENERATED'::text, 'INITIALS'::text])))
);

CREATE TABLE public."TB_GRUPO_ACESSO" (
    "CO_GRUPO_ACESSO" text NOT NULL,
    "NO_GRUPO_ACESSO" text NOT NULL,
    "DS_GRUPO_ACESSO" text,
    "ST_SISTEMA" boolean DEFAULT false NOT NULL,
    "ST_ADMIN_GLOBAL" boolean DEFAULT false NOT NULL,
    "NU_ORDEM" smallint DEFAULT 100 NOT NULL,
    "NU_REVISAO" integer DEFAULT 1 NOT NULL,
    "DT_ATUALIZACAO" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "CK_GRUPOACESSO_ADMINSISTEMA" CHECK (((NOT "ST_ADMIN_GLOBAL") OR "ST_SISTEMA")),
    CONSTRAINT "CK_GRUPOACESSO_CODIGO" CHECK (("CO_GRUPO_ACESSO" ~ '^[a-z]+(_[a-z]+)*$'::text))
);

CREATE TABLE public."TA_GRUPO_ACESSO_RECURSO" (
    "CO_GRUPO_ACESSO" text NOT NULL,
    "NO_RECURSO" text NOT NULL,
    "TP_NIVEL" text NOT NULL,
    CONSTRAINT "CK_GRUPACESSOREC_ACESSOS" CHECK ((("NO_RECURSO" <> 'acessos'::text) OR ("TP_NIVEL" = ANY (ARRAY['sem_acesso'::text, 'editor'::text])))),
    CONSTRAINT "CK_GRUPACESSOREC_CHAT" CHECK ((("NO_RECURSO" <> 'chat'::text) OR ("TP_NIVEL" = ANY (ARRAY['sem_acesso'::text, 'leitor'::text])))),
    CONSTRAINT "CK_GRUPACESSOREC_CONFIG" CHECK ((("NO_RECURSO" <> 'configuracoes'::text) OR ("TP_NIVEL" <> 'leitor'::text))),
    CONSTRAINT "CK_GRUPACESSOREC_NIVEL" CHECK (("TP_NIVEL" = ANY (ARRAY['sem_acesso'::text, 'leitor'::text, 'editor'::text, 'admin'::text]))),
    CONSTRAINT "CK_GRUPACESSOREC_PARECER" CHECK ((("NO_RECURSO" <> 'recursos_parecer'::text) OR ("TP_NIVEL" = ANY (ARRAY['sem_acesso'::text, 'editor'::text])))),
    CONSTRAINT "CK_GRUPACESSOREC_RECURSO" CHECK (("NO_RECURSO" = ANY (private."FC_RECURSOS_MODULO"())))
);

CREATE TABLE public."TB_AREA" (
    "CO_AREA" text NOT NULL,
    "NO_AREA" text NOT NULL,
    "NO_GRUPO_PLANILHA" text NOT NULL,
    "NU_ORDEM" smallint NOT NULL,
    "ST_ATIVO" character varying(1) DEFAULT 'S'::character varying NOT NULL,
    "TP_SITUACAO" text DEFAULT 'ATIVA'::text NOT NULL,
    "DS_MENSAGEM_MANUTENCAO" text,
    "DT_PREVISAO_RETORNO" date,
    CONSTRAINT "CK_AREA_COAREA" CHECK (("CO_AREA" ~ '^[a-z]+(-[a-z]+)*$'::text)),
    CONSTRAINT "CK_AREA_MENSAGEM" CHECK ((COALESCE(length("DS_MENSAGEM_MANUTENCAO"), 0) <= 500)),
    CONSTRAINT "CK_AREA_STATIVO" CHECK ((("ST_ATIVO")::text = ANY (ARRAY[('S'::character varying)::text, ('N'::character varying)::text]))),
    CONSTRAINT "CK_AREA_TPSITUACAO" CHECK (("TP_SITUACAO" = ANY (ARRAY['ATIVA'::text, 'MANUTENCAO'::text])))
);

CREATE TABLE public."RL_PERFIL_USUARIO_AREA" (
    "CO_PERFIL_USUARIO" uuid NOT NULL,
    "CO_AREA" text NOT NULL,
    "DT_INCLUSAO" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."TB_COORDENACAO" (
    "CO_COORDENACAO" text NOT NULL,
    "NO_COORDENACAO" text NOT NULL,
    "CO_AREA" text NOT NULL,
    "TP_RESPONSAVEL" text,
    "ST_ATIVO" boolean DEFAULT true NOT NULL,
    "NU_REVISAO" integer DEFAULT 1 NOT NULL,
    "DT_ATUALIZACAO" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "CK_COORDENACAO_CODIGO" CHECK (("CO_COORDENACAO" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text)),
    CONSTRAINT "CK_COORDENACAO_RESPONSAVEL" CHECK ((("TP_RESPONSAVEL" IS NULL) OR ("TP_RESPONSAVEL" = ANY (ARRAY['USI'::text, 'CORES'::text]))))
);

CREATE TABLE public."TB_PERMISSAO_RECURSO" (
    perfil_usuario_id uuid NOT NULL,
    recurso text NOT NULL,
    nivel text NOT NULL,
    revisao integer DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid NOT NULL,
    CONSTRAINT "CK_PERMISSAORECURSO_CHAT" CHECK (((recurso <> 'chat'::text) OR (nivel = ANY (ARRAY['sem_acesso'::text, 'leitor'::text])))),
    CONSTRAINT "CK_PERMISSAORECURSO_PARECER" CHECK (((recurso <> 'recursos_parecer'::text) OR (nivel = ANY (ARRAY['sem_acesso'::text, 'editor'::text])))),
    CONSTRAINT "CK_PERMISSAORECURSO_RECURSO" CHECK (((recurso = ANY (private."FC_RECURSOS_MODULO"())) OR (recurso ~ '^painel:[0-9a-f-]{36}$'::text))),
    CONSTRAINT "TB_PERMISSAO_RECURSO_nivel_check" CHECK ((nivel = ANY (ARRAY['sem_acesso'::text, 'leitor'::text, 'editor'::text, 'admin'::text])))
);

CREATE TABLE public."TH_PERMISSAO_RECURSO" (
    id bigint NOT NULL,
    perfil_usuario_id uuid NOT NULL,
    recurso text NOT NULL,
    nivel_anterior text NOT NULL,
    nivel_novo text NOT NULL,
    alterado_por uuid NOT NULL,
    alterado_em timestamp with time zone DEFAULT now() NOT NULL,
    motivo text NOT NULL
);

CREATE TABLE public."TB_PAINEL_EXTERNO" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo text NOT NULL,
    titulo text NOT NULL,
    icone text,
    url text,
    ordem integer DEFAULT 0 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    em_manutencao boolean DEFAULT false NOT NULL,
    tipo_abertura text DEFAULT 'iframe'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."TB_SOLICITACAO_ACESSO" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text NOT NULL,
    nome text,
    setor text,
    justificativa text,
    perfil_solicitado text DEFAULT 'usuario'::text NOT NULL,
    status text DEFAULT 'pendente'::text NOT NULL,
    avaliado_por uuid,
    avaliado_em timestamp with time zone,
    observacao_admin text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    "CO_COORDENACAO" text,
    "CO_AREA" text,
    "CO_CARGO_SOLICITADO" text,
    "DS_CARGO_OUTRO" text,
    "CO_MOTIVO_RECUSA" text,
    CONSTRAINT "CK_SOLICACESSO_CARGO" CHECK ((("CO_CARGO_SOLICITADO" IS NULL) OR (("CO_AREA" IS NOT NULL) AND ("CO_CARGO_SOLICITADO" = ANY (ARRAY['AVALIADOR'::text, 'GESTOR'::text, 'CONTRATACAO'::text, 'COORDENACAO_DSEI'::text, 'COORDENACAO_PROJETO'::text, 'COORDENACAO_SEDE'::text, 'JURIDICO'::text, 'APOIO'::text, 'CONSULTA'::text, 'OUTRO'::text]))))),
    CONSTRAINT "CK_SOLICACESSO_CARGOOUTRO" CHECK (
CASE
    WHEN ("CO_CARGO_SOLICITADO" = 'OUTRO'::text) THEN ((length(btrim(COALESCE("DS_CARGO_OUTRO", ''::text))) >= 3) AND (length(btrim(COALESCE("DS_CARGO_OUTRO", ''::text))) <= 120))
    ELSE ("DS_CARGO_OUTRO" IS NULL)
END),
    CONSTRAINT "CK_SOLICACESSO_MOTIVORECUSA" CHECK ((("CO_MOTIVO_RECUSA" IS NULL) OR ((status = 'recusado'::text) AND ("CO_MOTIVO_RECUSA" = ANY (ARRAY['FORA_DO_PUBLICO'::text, 'VINCULO_NAO_CONFIRMADO'::text, 'AREA_OU_LOTACAO'::text, 'JA_TEM_ACESSO'::text, 'JUSTIFICATIVA_INSUFICIENTE'::text, 'OUTRO'::text]))))),
    CONSTRAINT solicitacoes_acesso_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'aprovado'::text, 'recusado'::text, 'cancelado'::text])))
);

CREATE UNIQUE INDEX solicitacoes_acesso_user_pendente_uidx ON public."TB_SOLICITACAO_ACESSO" USING btree (user_id) WHERE (status = 'pendente'::text);

CREATE FUNCTION private."FC_RECURSOS_MODULO"() RETURNS text[]
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes','acessos','recursos','entrevistas','selecao','recursos_parecer','classificacao','chat','avaliacao_documental','aprovados_pendencias','paineis_dados']::text[];
$$;

CREATE FUNCTION private."FC_RANK_NIVEL"(p_nivel text) RETURNS integer
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select case p_nivel when 'admin' then 3 when 'editor' then 2 when 'leitor' then 1 else 0 end;
$$;

CREATE FUNCTION private."FC_MOTIVO_PARECE_TEXTO"(p_texto text, p_minimo_palavras integer) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select lower(coalesce(p_texto, '')) !~ '([[:alpha:]])\1{3,}'
     and (select count(distinct w)
            from regexp_split_to_table(lower(coalesce(p_texto, '')), '[^[:alpha:]]+') w
           where length(w) >= 2
             and (length(w) <= 3
                  or length(regexp_replace(w, '[^aeiouáàâãéêíóôõúü]', '', 'g')) * 5 >= length(w))
         ) >= coalesce(p_minimo_palavras, 1);
$$;

CREATE FUNCTION private.is_master() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
      from public."TB_PERFIL_USUARIO" p
      join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
     where p.user_id = (select auth.uid())
       and p.ativo is true
       and a."ST_ADMIN_GLOBAL"
  );
$$;

CREATE FUNCTION private.current_profile() RETURNS public."TB_PERFIL_USUARIO"
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth', 'pg_temp'
    AS $$
  select p
  from public."TB_PERFIL_USUARIO" p
  where p.ativo = true
    and (
      p.user_id = auth.uid()
      or lower(p.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
    )
  limit 1;
$$;

CREATE FUNCTION private.nivel_recurso(p_recurso text) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare p public."TB_PERFIL_USUARIO";
begin
  if (select auth.uid()) is null then return 'sem_acesso'; end if;
  p := private.current_profile();
  if p.id is null or p.ativo is not true then return 'sem_acesso'; end if;
  return private."FC_NIVEL_EFETIVO"(p.id, p.perfil, p_recurso);
end;
$$;

CREATE FUNCTION private.pode_recurso(p_recurso text, p_minimo integer DEFAULT 1) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select coalesce((select auth.role())='service_role',false) or case private.nivel_recurso(p_recurso) when 'admin' then 3 when 'editor' then 2 when 'leitor' then 1 else 0 end >= greatest(p_minimo,1);
$$;

CREATE FUNCTION private."FC_NIVEL_DO_GRUPO"(p_grupo text, p_recurso text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select coalesce(
    (select t."TP_NIVEL" from public."TA_GRUPO_ACESSO_RECURSO" t
      where t."CO_GRUPO_ACESSO" = p_grupo and t."NO_RECURSO" = p_recurso),
    'sem_acesso');
$$;

CREATE FUNCTION private."FC_NIVEL_EFETIVO"(p_perfil_usuario uuid, p_grupo text, p_recurso text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  -- Administrador global faz tudo: o maior nível, acima da permissão individual e do grupo.
  select case
    when exists (select 1 from public."TB_GRUPO_ACESSO" a
                  where a."CO_GRUPO_ACESSO" = p_grupo and a."ST_ADMIN_GLOBAL") then 'admin'
    else coalesce(
      (select g.nivel from public."TB_PERMISSAO_RECURSO" g
        where g.perfil_usuario_id = p_perfil_usuario and g.recurso = p_recurso),
      private."FC_NIVEL_DO_GRUPO"(p_grupo, p_recurso))
  end;
$$;

CREATE FUNCTION private."FC_TETO_DO_GESTOR"(p_recurso text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select case
    when private.is_master() then 'admin'
    when p_recurso = 'acessos' or p_recurso like 'area:%' then 'sem_acesso'
    else private.nivel_recurso(p_recurso)
  end;
$$;

CREATE FUNCTION private."FC_GRUPO_CABE_NO_TETO"(p_grupo text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select private.is_master() or (
    exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = p_grupo and not a."ST_ADMIN_GLOBAL")
    and not exists (
      select 1 from public."TA_GRUPO_ACESSO_RECURSO" t
       where t."CO_GRUPO_ACESSO" = p_grupo
         and private."FC_RANK_NIVEL"(t."TP_NIVEL") > private."FC_RANK_NIVEL"(private."FC_TETO_DO_GESTOR"(t."NO_RECURSO"))
    )
  );
$$;

CREATE FUNCTION private."FC_COORDENACAO_USUARIO"() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select case
    when coalesce((select auth.role()) = 'service_role', false) or private.is_master() then null
    else (select p."CO_COORDENACAO" from private.current_profile() p where p.ativo)
  end;
$$;

CREATE FUNCTION private."FC_GESTOR_DE_ACESSOS"() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select case
    when private.is_master() then 'admin'
    when private."FC_COORDENACAO_USUARIO"() is not null and private.pode_recurso('acessos', 2) then 'coordenador'
    else null
  end;
$$;

CREATE FUNCTION private."FC_EXIGIR_GESTOR_DE_ACESSOS"() RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v text := private."FC_GESTOR_DE_ACESSOS"();
begin
  if v is null then
    raise exception 'Somente administradores ou coordenadores podem gerenciar acessos' using errcode = '42501';
  end if;
  return v;
end;
$$;

CREATE FUNCTION private."FC_EXIGIR_GESTAO_DO_USUARIO"(p_alvo public."TB_PERFIL_USUARIO") RETURNS void
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_gestor text := private."FC_EXIGIR_GESTOR_DE_ACESSOS"();
begin
  if p_alvo.id is null then raise exception 'Usuário ativo não encontrado'; end if;
  if p_alvo.user_id = (select auth.uid())
     or lower(p_alvo.email) = lower(coalesce((select auth.jwt() ->> 'email'), '')) then
    raise exception 'Outra pessoa deve alterar seu acesso' using errcode = '42501';
  end if;
  if v_gestor = 'coordenador' then
    if p_alvo."CO_COORDENACAO" is distinct from private."FC_COORDENACAO_USUARIO"() then
      raise exception 'Usuário fora da sua coordenação' using errcode = '42501';
    end if;
    if exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = p_alvo.perfil and a."ST_ADMIN_GLOBAL") then
      raise exception 'Só um administrador altera outro administrador' using errcode = '42501';
    end if;
  end if;
end;
$$;

CREATE FUNCTION private."FC_AREAS_DO_PERFIL"(p_perfil_usuario uuid) RETURNS text[]
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select case
    when a."ST_ADMIN_GLOBAL" is true
      then (select coalesce(array_agg(x."CO_AREA" order by x."NU_ORDEM"), '{}') from public."TB_AREA" x)
    when u."CO_COORDENACAO" is not null
      then coalesce((select array[c."CO_AREA"] from public."TB_COORDENACAO" c where c."CO_COORDENACAO" = u."CO_COORDENACAO"), '{}')
    else coalesce((
      select array_agg(r."CO_AREA" order by x."NU_ORDEM")
        from public."RL_PERFIL_USUARIO_AREA" r
        join public."TB_AREA" x on x."CO_AREA" = r."CO_AREA"
       where r."CO_PERFIL_USUARIO" = u.id), '{}')
  end
  from public."TB_PERFIL_USUARIO" u
  left join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = u.perfil
  where u.id = p_perfil_usuario and u.ativo;
$$;

CREATE FUNCTION private."FC_CARGO_SOLICITACAO_ACESSO"(p_area text, p_codigo text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select c.rotulo
    from (values
      ('AVALIADOR', 'Avaliador(a) da análise curricular', '{projetos,saude-indigena,sede}'::text[]),
      ('GESTOR', 'Gestor(a) de processo seletivo', '{projetos,saude-indigena,sede}'::text[]),
      ('CONTRATACAO', 'Contratação e admissão', '{projetos,saude-indigena,sede}'::text[]),
      ('COORDENACAO_DSEI', 'Coordenação de DSEI ou CASAI', '{saude-indigena}'::text[]),
      ('COORDENACAO_PROJETO', 'Coordenação de projeto', '{projetos}'::text[]),
      ('COORDENACAO_SEDE', 'Coordenação ou diretoria', '{sede}'::text[]),
      ('JURIDICO', 'Jurídico', '{sede}'::text[]),
      ('APOIO', 'Apoio administrativo', '{projetos,saude-indigena,sede}'::text[]),
      ('CONSULTA', 'Consulta e acompanhamento', '{projetos,saude-indigena,sede}'::text[]),
      ('OUTRO', 'Outro', '{projetos,saude-indigena,sede}'::text[])
    ) as c(codigo, rotulo, areas)
   where c.codigo = p_codigo and (p_area is null or p_area = any (c.areas));
$$;

CREATE FUNCTION private."FC_MOTIVO_RECUSA_SOLICITACAO"(p_codigo text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select m.rotulo
    from (values
      ('FORA_DO_PUBLICO', 'Não faz parte do público do MONITORA'),
      ('VINCULO_NAO_CONFIRMADO', 'Vínculo com a área não confirmado'),
      ('AREA_OU_LOTACAO', 'Área ou lotação não confere'),
      ('JA_TEM_ACESSO', 'Já tem acesso por outra conta'),
      ('JUSTIFICATIVA_INSUFICIENTE', 'Justificativa insuficiente'),
      ('OUTRO', 'Outro')
    ) as m(codigo, rotulo)
   where m.codigo = p_codigo;
$$;

CREATE FUNCTION public.registrar_solicitacao_acesso(p_nome text, p_area text DEFAULT NULL::text, p_cargo text DEFAULT NULL::text, p_cargo_outro text DEFAULT NULL::text, p_lotacao text DEFAULT NULL::text, p_justificativa text DEFAULT NULL::text, p_coordenacao text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
  v_nome text := btrim(coalesce(p_nome, ''));
  v_area text := nullif(btrim(coalesce(p_area, '')), '');
  v_cargo text := nullif(btrim(coalesce(p_cargo, '')), '');
  v_cargo_outro text := nullif(btrim(coalesce(p_cargo_outro, '')), '');
  v_lotacao text := nullif(btrim(coalesce(p_lotacao, '')), '');
  v_justificativa text := btrim(coalesce(p_justificativa, ''));
  v_justificativa_limpa text := btrim(regexp_replace(coalesce(p_justificativa, ''), '\s+', ' ', 'g'));
  v_coordenacao text := nullif(btrim(coalesce(p_coordenacao, '')), '');
  v_reativacao boolean;
  v_id uuid;
begin
  if v_uid is null or v_email = '' then raise exception 'Usuário não autenticado' using errcode = '42501'; end if;
  if length(v_nome) not between 2 and 120 then
    raise exception 'Informe seu nome completo (2 a 120 caracteres).' using errcode = '22023';
  end if;
  if length(v_justificativa_limpa) not between 20 and 2000
     or not private."FC_MOTIVO_PARECE_TEXTO"(v_justificativa_limpa, 3) then
    raise exception 'Explique por que precisa do acesso: de 20 a 2.000 caracteres, com pelo menos 3 palavras.' using errcode = '22023';
  end if;

  -- Conta desativada pede reativação: o administrador já sabe a área de antes.
  v_reativacao := exists (
    select 1 from public."TB_PERFIL_USUARIO" u
     where not u.ativo and (u.user_id = v_uid or lower(u.email) = v_email));

  if v_area is null and not v_reativacao then
    raise exception 'Escolha a área: Projetos, Saúde Indígena ou SEDE.' using errcode = '22023';
  end if;
  if v_area is not null and not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
    raise exception 'Área inválida: %', v_area using errcode = '22023';
  end if;
  if v_area is null then
    v_cargo := null; v_cargo_outro := null; v_lotacao := null;
  else
    if v_cargo is null or private."FC_CARGO_SOLICITACAO_ACESSO"(v_area, v_cargo) is null then
      raise exception 'Escolha o cargo ou a função na lista da área.' using errcode = '22023';
    end if;
    if v_cargo = 'OUTRO' then
      if length(coalesce(v_cargo_outro, '')) not between 3 and 120 then
        raise exception 'Descreva o cargo ou a função (3 a 120 caracteres).' using errcode = '22023';
      end if;
    else
      v_cargo_outro := null;
    end if;
    if v_lotacao is null or length(v_lotacao) > 200 then
      raise exception 'Informe a unidade ou a lotação (até 200 caracteres).' using errcode = '22023';
    end if;
    if v_area = 'saude-indigena' and not exists (
         select 1 from public."TD_UNIDADE" t where t.ativo and t.nome_oficial = v_lotacao) then
      raise exception 'Escolha o DSEI ou a CASAI na lista.' using errcode = '22023';
    end if;
    if v_area = 'projetos' and not exists (
         select 1 from public."TA_UNIDADE_AREA" x where x."CO_AREA" = 'projetos' and x."NO_UNIDADE" = v_lotacao) then
      raise exception 'Escolha o projeto na lista.' using errcode = '22023';
    end if;
  end if;
  if v_coordenacao is not null and not exists (
       select 1 from public."TB_COORDENACAO" c
        where c."CO_COORDENACAO" = v_coordenacao and c."ST_ATIVO"
          and (v_area is null or c."CO_AREA" = v_area)) then
    raise exception 'Coordenação inválida para a área escolhida.' using errcode = '22023';
  end if;

  -- Pedido pendente: editar (a pessoa corrige o que pediu enquanto aguarda).
  update public."TB_SOLICITACAO_ACESSO"
     set nome = v_nome, setor = v_lotacao, justificativa = v_justificativa,
         "CO_AREA" = v_area, "CO_CARGO_SOLICITADO" = v_cargo, "DS_CARGO_OUTRO" = v_cargo_outro,
         "CO_COORDENACAO" = v_coordenacao, updated_at = now()
   where user_id = v_uid and status = 'pendente'
  returning id into v_id;
  if v_id is not null then
    return jsonb_build_object('ok', true, 'id', v_id, 'status', 'pendente', 'atualizado', true);
  end if;

  insert into public."TB_SOLICITACAO_ACESSO" (user_id, email, nome, setor, justificativa, perfil_solicitado, status,
                                              "CO_COORDENACAO", "CO_AREA", "CO_CARGO_SOLICITADO", "DS_CARGO_OUTRO")
  values (v_uid, v_email, v_nome, v_lotacao, v_justificativa, 'usuario', 'pendente',
          v_coordenacao, v_area, v_cargo, v_cargo_outro)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'status', 'pendente', 'atualizado', false);
end;
$$;

CREATE FUNCTION public.aprovar_solicitacao_acesso(p_solicitacao_id uuid, p_grupo text, p_coordenacao text DEFAULT NULL::text, p_areas text[] DEFAULT NULL::text[], p_observacao_admin text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_gestor text := private."FC_EXIGIR_GESTOR_DE_ACESSOS"();
  v_req public."TB_SOLICITACAO_ACESSO";
  v_perfil_id uuid;
  v_coordenacao text := nullif(btrim(coalesce(p_coordenacao, '')), '');
  v_admin boolean;
  v_areas text[];
begin
  select * into v_req from public."TB_SOLICITACAO_ACESSO" where id = p_solicitacao_id for update;
  if v_req.id is null then raise exception 'Solicitação de acesso não encontrada'; end if;
  if v_req.status <> 'pendente' then raise exception 'Solicitação já avaliada (status atual: %)', v_req.status; end if;
  if not exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = p_grupo) then
    raise exception 'Grupo inválido: %', p_grupo;
  end if;
  v_admin := exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = p_grupo and a."ST_ADMIN_GLOBAL");

  if v_gestor = 'coordenador' then
    if v_req."CO_COORDENACAO" is distinct from private."FC_COORDENACAO_USUARIO"() then
      raise exception 'Solicitação de outra coordenação' using errcode = '42501';
    end if;
    v_coordenacao := private."FC_COORDENACAO_USUARIO"();
    if not private."FC_GRUPO_CABE_NO_TETO"(p_grupo) then
      raise exception 'O grupo % dá mais acesso do que você tem', p_grupo using errcode = '42501';
    end if;
  end if;

  if v_admin then
    v_coordenacao := null;
  elsif v_coordenacao is not null then
    if not exists (select 1 from public."TB_COORDENACAO" c where c."CO_COORDENACAO" = v_coordenacao and c."ST_ATIVO") then
      raise exception 'Coordenação inválida ou desativada';
    end if;
  else
    select coalesce(array_agg(distinct a."CO_AREA"), '{}') into v_areas
      from public."TB_AREA" a where a."CO_AREA" = any (coalesce(p_areas, '{}'));
    if cardinality(v_areas) = 0 then
      raise exception 'Sem coordenação, escolha ao menos uma área';
    end if;
  end if;

  select id into v_perfil_id
    from public."TB_PERFIL_USUARIO"
   where (v_req.user_id is not null and user_id = v_req.user_id) or lower(email) = lower(v_req.email)
   order by case when user_id = v_req.user_id then 0 else 1 end, updated_at desc
   limit 1
   for update;

  if v_perfil_id is null then
    insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, "CO_COORDENACAO", ativo, p_ind, p_cores, p_paineis, p_config, p_admin)
    values (v_req.user_id, v_req.email, coalesce(nullif(btrim(v_req.nome), ''), v_req.email),
            p_grupo, v_coordenacao, true, true, true, true, v_admin, v_admin)
    returning id into v_perfil_id;
  else
    if v_gestor = 'coordenador' and exists (
      select 1 from public."TB_PERFIL_USUARIO" u where u.id = v_perfil_id and u.ativo
         and u."CO_COORDENACAO" is distinct from v_coordenacao) then
      raise exception 'Esta pessoa já tem acesso por outra coordenação' using errcode = '42501';
    end if;
    update public."TB_PERFIL_USUARIO"
       set user_id = coalesce(user_id, v_req.user_id),
           email = v_req.email,
           nome = coalesce(nullif(btrim(v_req.nome), ''), nome, v_req.email),
           perfil = p_grupo,
           "CO_COORDENACAO" = v_coordenacao,
           ativo = true, p_ind = true, p_cores = true, p_paineis = true, p_config = v_admin, p_admin = v_admin,
           updated_at = now()
     where id = v_perfil_id;
  end if;

  if v_areas is not null then
    delete from public."RL_PERFIL_USUARIO_AREA" where "CO_PERFIL_USUARIO" = v_perfil_id;
    insert into public."RL_PERFIL_USUARIO_AREA" ("CO_PERFIL_USUARIO", "CO_AREA") select v_perfil_id, unnest(v_areas);
  end if;

  -- Painéis ativos em leitura, como na carga de 23/09 (o grupo decide se vê "Painéis").
  insert into public."TB_PERMISSAO_RECURSO" (perfil_usuario_id, recurso, nivel, updated_by)
  select v_perfil_id, 'painel:' || e.id, 'leitor', (select auth.uid())
    from public."TB_PAINEL_EXTERNO" e
   where e.ativo and (v_gestor = 'admin' or private.pode_recurso('painel:' || e.id))
  on conflict (perfil_usuario_id, recurso) do nothing;

  update public."TB_SOLICITACAO_ACESSO"
     set status = 'aprovado', perfil_solicitado = p_grupo, "CO_COORDENACAO" = coalesce(v_coordenacao, "CO_COORDENACAO"),
         avaliado_por = (select auth.uid()), avaliado_em = now(),
         observacao_admin = nullif(btrim(p_observacao_admin), ''), updated_at = now()
   where id = v_req.id;

  insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
  values (v_perfil_id, '#grupo', '(solicitação)', p_grupo, (select auth.uid()),
          coalesce(nullif(btrim(p_observacao_admin), ''), 'Solicitação de acesso aprovada'));

  return jsonb_build_object('ok', true, 'perfil_usuario_id', v_perfil_id, 'grupo', p_grupo, 'coordenacao', v_coordenacao);
end;
$$;

CREATE FUNCTION public.recusar_solicitacao_acesso(p_solicitacao_id uuid, p_motivo text, p_complemento text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_gestor text := private."FC_EXIGIR_GESTOR_DE_ACESSOS"();
  v_req public."TB_SOLICITACAO_ACESSO";
  v_rotulo text := private."FC_MOTIVO_RECUSA_SOLICITACAO"(p_motivo);
  v_complemento text := nullif(btrim(regexp_replace(coalesce(p_complemento, ''), '\s+', ' ', 'g')), '');
  v_texto text;
begin
  if v_rotulo is null then
    raise exception 'Escolha o motivo da recusa na lista.' using errcode = '22023';
  end if;
  if p_motivo = 'OUTRO' then
    if length(coalesce(v_complemento, '')) not between 15 and 500
       or not private."FC_MOTIVO_PARECE_TEXTO"(v_complemento, 3) then
      raise exception 'Descreva o motivo: de 15 a 500 caracteres, com pelo menos 3 palavras.' using errcode = '22023';
    end if;
    v_texto := v_complemento;
  else
    if v_complemento is not null
       and (length(v_complemento) > 500 or not private."FC_MOTIVO_PARECE_TEXTO"(v_complemento, 1)) then
      raise exception 'O complemento precisa ser um texto de até 500 caracteres.' using errcode = '22023';
    end if;
    v_texto := v_rotulo || coalesce(' — ' || v_complemento, '');
  end if;

  select * into v_req from public."TB_SOLICITACAO_ACESSO" where id = p_solicitacao_id for update;
  if v_req.id is null then raise exception 'Solicitação de acesso não encontrada'; end if;
  if v_req.status <> 'pendente' then raise exception 'Solicitação já avaliada (status atual: %)', v_req.status; end if;
  if v_gestor = 'coordenador' and v_req."CO_COORDENACAO" is distinct from private."FC_COORDENACAO_USUARIO"() then
    raise exception 'Solicitação de outra coordenação' using errcode = '42501';
  end if;
  update public."TB_SOLICITACAO_ACESSO"
     set status = 'recusado', avaliado_por = (select auth.uid()), avaliado_em = now(),
         "CO_MOTIVO_RECUSA" = p_motivo, observacao_admin = v_texto, updated_at = now()
   where id = p_solicitacao_id;
  return jsonb_build_object('ok', true, 'solicitacao_id', v_req.id, 'email', v_req.email, 'status', 'recusado',
                            'motivo', p_motivo, 'observacao_admin', v_texto);
end;
$$;

CREATE FUNCTION public.cancelar_minha_solicitacao_acesso() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then raise exception 'Usuário não autenticado' using errcode = '42501'; end if;
  update public."TB_SOLICITACAO_ACESSO"
     set status = 'cancelado', updated_at = now()
   where user_id = v_uid and status = 'pendente'
  returning id into v_id;
  if v_id is null then
    raise exception 'Nenhum pedido pendente para cancelar.' using errcode = '22023';
  end if;
  return jsonb_build_object('ok', true, 'id', v_id, 'status', 'cancelado');
end;
$$;

CREATE FUNCTION public.obter_minha_solicitacao_acesso() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select jsonb_build_object('id', s.id, 'status', s.status, 'nome', s.nome, 'setor', s.setor,
                            'justificativa', s.justificativa, 'created_at', s.created_at,
                            'updated_at', s.updated_at, 'avaliado_em', s.avaliado_em,
                            'observacao_admin', s.observacao_admin, 'coordenacao', s."CO_COORDENACAO",
                            'coordenacao_nome', c."NO_COORDENACAO",
                            'area', s."CO_AREA", 'area_nome', a."NO_AREA",
                            'cargo', s."CO_CARGO_SOLICITADO",
                            'cargo_rotulo', private."FC_CARGO_SOLICITACAO_ACESSO"(null, s."CO_CARGO_SOLICITADO"),
                            'cargo_outro', s."DS_CARGO_OUTRO",
                            'motivo_recusa', s."CO_MOTIVO_RECUSA")
    from public."TB_SOLICITACAO_ACESSO" s
    left join public."TB_COORDENACAO" c on c."CO_COORDENACAO" = s."CO_COORDENACAO"
    left join public."TB_AREA" a on a."CO_AREA" = s."CO_AREA"
   where s.user_id = (select auth.uid())
      or lower(s.email) = lower(coalesce((select auth.jwt() ->> 'email'), '-'))
   order by (s.status = 'pendente') desc, s.created_at desc
   limit 1;
$$;

CREATE FUNCTION public.listar_solicitacoes_acesso(p_status text DEFAULT 'pendente'::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_gestor text := private."FC_EXIGIR_GESTOR_DE_ACESSOS"();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'user_id', s.user_id, 'email', s.email, 'nome', s.nome, 'setor', s.setor,
      'justificativa', s.justificativa, 'status', s.status, 'created_at', s.created_at,
      'updated_at', s.updated_at,
      'observacao_admin', s.observacao_admin, 'coordenacao', s."CO_COORDENACAO",
      'coordenacao_nome', c."NO_COORDENACAO", 'area', coalesce(s."CO_AREA", c."CO_AREA"),
      'area_nome', ar."NO_AREA",
      'cargo', s."CO_CARGO_SOLICITADO",
      'cargo_rotulo', private."FC_CARGO_SOLICITACAO_ACESSO"(null, s."CO_CARGO_SOLICITADO"),
      'cargo_outro', s."DS_CARGO_OUTRO",
      'reativacao', p.id is not null,
      'desativada_em', h.alterado_em,
      'desativada_por', h.autor,
      'motivo_desativacao', h.motivo,
      'grupo_anterior', p.perfil
    ) order by s.created_at)
      from public."TB_SOLICITACAO_ACESSO" s
      left join public."TB_COORDENACAO" c on c."CO_COORDENACAO" = s."CO_COORDENACAO"
      left join public."TB_AREA" ar on ar."CO_AREA" = coalesce(s."CO_AREA", c."CO_AREA")
      -- Pedido de quem tem conta desativada = pedido de reativação (com o histórico).
      left join lateral (
        select u.id, u.perfil from public."TB_PERFIL_USUARIO" u
         where not u.ativo
           and ((s.user_id is not null and u.user_id = s.user_id) or lower(u.email) = lower(s.email))
         order by u.updated_at desc limit 1) p on true
      left join lateral (
        select t.alterado_em, t.motivo,
               (select a.email from public."TB_PERFIL_USUARIO" a where a.user_id = t.alterado_por limit 1) autor
          from public."TH_PERMISSAO_RECURSO" t
         where p.id is not null and t.perfil_usuario_id = p.id and t.recurso = '#conta'
         order by t.alterado_em desc limit 1) h on true
     where s.status = coalesce(nullif(btrim(p_status), ''), 'pendente')
       and (v_gestor = 'admin' or s."CO_COORDENACAO" = private."FC_COORDENACAO_USUARIO"())
     limit 200), '[]'::jsonb);
end;
$$;

CREATE FUNCTION public.listar_opcoes_da_solicitacao_acesso() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if (select auth.uid()) is null then
    raise exception 'Usuário não autenticado' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'areas', coalesce((
      select jsonb_agg(jsonb_build_object('codigo', a."CO_AREA", 'nome', a."NO_AREA") order by a."NU_ORDEM")
        from public."TB_AREA" a), '[]'::jsonb),
    'unidades', coalesce((
      select jsonb_agg(u.item order by u.area, u.tipo, u.nome)
        from (
          select 'saude-indigena' as area, t.tipo, t.nome_oficial as nome,
                 jsonb_build_object('area', 'saude-indigena', 'nome', t.nome_oficial, 'sigla', t.sigla, 'tipo', t.tipo) as item
            from public."TD_UNIDADE" t
           where t.ativo
          union all
          select 'projetos', '', x."NO_UNIDADE",
                 jsonb_build_object('area', 'projetos', 'nome', x."NO_UNIDADE", 'sigla', null, 'tipo', null)
            from public."TA_UNIDADE_AREA" x
           where x."CO_AREA" = 'projetos'
        ) u), '[]'::jsonb),
    'coordenacoes', coalesce((
      select jsonb_agg(jsonb_build_object('codigo', c."CO_COORDENACAO", 'nome', c."NO_COORDENACAO", 'area', c."CO_AREA")
                       order by c."NO_COORDENACAO")
        from public."TB_COORDENACAO" c
       where c."ST_ATIVO"), '[]'::jsonb));
end;
$$;

REVOKE ALL ON FUNCTION public.registrar_solicitacao_acesso(p_nome text, p_area text, p_cargo text, p_cargo_outro text, p_lotacao text, p_justificativa text, p_coordenacao text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.registrar_solicitacao_acesso(p_nome text, p_area text, p_cargo text, p_cargo_outro text, p_lotacao text, p_justificativa text, p_coordenacao text) TO authenticated;

REVOKE ALL ON FUNCTION public.aprovar_solicitacao_acesso(p_solicitacao_id uuid, p_grupo text, p_coordenacao text, p_areas text[], p_observacao_admin text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.aprovar_solicitacao_acesso(p_solicitacao_id uuid, p_grupo text, p_coordenacao text, p_areas text[], p_observacao_admin text) TO authenticated;

REVOKE ALL ON FUNCTION public.recusar_solicitacao_acesso(p_solicitacao_id uuid, p_motivo text, p_complemento text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.recusar_solicitacao_acesso(p_solicitacao_id uuid, p_motivo text, p_complemento text) TO authenticated;

REVOKE ALL ON FUNCTION public.cancelar_minha_solicitacao_acesso() FROM PUBLIC;
GRANT ALL ON FUNCTION public.cancelar_minha_solicitacao_acesso() TO authenticated;

REVOKE ALL ON FUNCTION public.obter_minha_solicitacao_acesso() FROM PUBLIC;
GRANT ALL ON FUNCTION public.obter_minha_solicitacao_acesso() TO authenticated;

REVOKE ALL ON FUNCTION public.listar_solicitacoes_acesso(p_status text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.listar_solicitacoes_acesso(p_status text) TO authenticated;

REVOKE ALL ON FUNCTION public.listar_opcoes_da_solicitacao_acesso() FROM PUBLIC;
GRANT ALL ON FUNCTION public.listar_opcoes_da_solicitacao_acesso() TO authenticated;
