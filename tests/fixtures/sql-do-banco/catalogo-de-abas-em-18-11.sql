-- O catálogo de abas como está no banco em 18/11/2026: as tabelas TB_AREA, TB_ABA e RL_ABA_AREA
-- e a função listar_abas_do_menu, copiadas de supabase/esquema-atual.sql (só o que o teste da
-- aba Mapa usa; sem comentários, grants, auditoria nem RLS). As linhas são semeadas pelo teste.

CREATE TABLE public."TB_AREA" (
    "CO_AREA" text NOT NULL,
    "NO_AREA" text NOT NULL,
    "NO_GRUPO_PLANILHA" text NOT NULL,
    "NU_ORDEM" smallint NOT NULL,
    "ST_ATIVO" character varying(1) DEFAULT 'S'::character varying NOT NULL,
    "TP_SITUACAO" text DEFAULT 'ATIVA'::text NOT NULL,
    "DS_MENSAGEM_MANUTENCAO" text,
    "DT_PREVISAO_RETORNO" date,
    CONSTRAINT "PK_TB_AREA" PRIMARY KEY ("CO_AREA"),
    CONSTRAINT "CK_AREA_COAREA" CHECK (("CO_AREA" ~ '^[a-z]+(-[a-z]+)*$'::text)),
    CONSTRAINT "CK_AREA_MENSAGEM" CHECK ((COALESCE(length("DS_MENSAGEM_MANUTENCAO"), 0) <= 500)),
    CONSTRAINT "CK_AREA_STATIVO" CHECK ((("ST_ATIVO")::text = ANY (ARRAY[('S'::character varying)::text, ('N'::character varying)::text]))),
    CONSTRAINT "CK_AREA_TPSITUACAO" CHECK (("TP_SITUACAO" = ANY (ARRAY['ATIVA'::text, 'MANUTENCAO'::text])))
);

CREATE TABLE public."TB_ABA" (
    "CO_ABA" text NOT NULL,
    "NO_ABA" text NOT NULL,
    "DS_ICONE" text NOT NULL,
    "NU_ORDEM" smallint NOT NULL,
    "CO_VIEW" text NOT NULL,
    "CO_RECURSO" text NOT NULL,
    "TP_ABA" text DEFAULT 'nativa'::text NOT NULL,
    "ST_ATIVO" character varying(1) DEFAULT 'S'::character varying NOT NULL,
    "DT_CRIACAO" timestamp with time zone DEFAULT now() NOT NULL,
    "DT_ATUALIZACAO" timestamp with time zone DEFAULT now() NOT NULL,
    "CO_USUARIO_ATUALIZACAO" uuid,
    "TP_SITUACAO" text DEFAULT 'ATIVA'::text NOT NULL,
    "DS_MENSAGEM_MANUTENCAO" text,
    "DT_PREVISAO_RETORNO" date,
    "ST_BETA" character varying(1) DEFAULT 'N'::character varying NOT NULL,
    CONSTRAINT "PK_TB_ABA" PRIMARY KEY ("CO_ABA"),
    CONSTRAINT "CK_ABA_COABA" CHECK (("CO_ABA" ~ '^[a-z]+(-[a-z]+)*$'::text)),
    CONSTRAINT "CK_ABA_COVIEW" CHECK (("CO_VIEW" ~ '^[a-z]+(-[a-z]+)*$'::text)),
    CONSTRAINT "CK_ABA_MENSAGEM" CHECK ((COALESCE(length("DS_MENSAGEM_MANUTENCAO"), 0) <= 500)),
    CONSTRAINT "CK_ABA_STATIVO" CHECK ((("ST_ATIVO")::text = ANY (ARRAY[('S'::character varying)::text, ('N'::character varying)::text]))),
    CONSTRAINT "CK_ABA_STBETA" CHECK ((("ST_BETA")::text = ANY (ARRAY[('S'::character varying)::text, ('N'::character varying)::text]))),
    CONSTRAINT "CK_ABA_TPABA" CHECK (("TP_ABA" = ANY (ARRAY['nativa'::text, 'externa'::text]))),
    CONSTRAINT "CK_ABA_TPSITUACAO" CHECK (("TP_SITUACAO" = ANY (ARRAY['ATIVA'::text, 'MANUTENCAO'::text])))
);

CREATE TABLE public."RL_ABA_AREA" (
    "CO_ABA" text NOT NULL,
    "CO_AREA" text NOT NULL,
    "NU_ORDEM" smallint,
    "CO_VIEW" text,
    "DS_ICONE" text,
    "ST_ATIVO" character varying(1) DEFAULT 'S'::character varying NOT NULL,
    "DT_CRIACAO" timestamp with time zone DEFAULT now() NOT NULL,
    "DT_ATUALIZACAO" timestamp with time zone DEFAULT now() NOT NULL,
    "CO_USUARIO_ATUALIZACAO" uuid,
    "TP_SITUACAO" text DEFAULT 'ATIVA'::text NOT NULL,
    "DS_MENSAGEM_MANUTENCAO" text,
    "DT_PREVISAO_RETORNO" date,
    CONSTRAINT "PK_RL_ABA_AREA" PRIMARY KEY ("CO_ABA", "CO_AREA"),
    CONSTRAINT "FK_ABA_ABA_AREA" FOREIGN KEY ("CO_ABA") REFERENCES public."TB_ABA"("CO_ABA"),
    CONSTRAINT "FK_AREA_ABA_AREA" FOREIGN KEY ("CO_AREA") REFERENCES public."TB_AREA"("CO_AREA"),
    CONSTRAINT "CK_ABAAREA_COVIEW" CHECK (("CO_VIEW" ~ '^[a-z]+(-[a-z]+)*$'::text)),
    CONSTRAINT "CK_ABAAREA_MENSAGEM" CHECK ((COALESCE(length("DS_MENSAGEM_MANUTENCAO"), 0) <= 500)),
    CONSTRAINT "CK_ABAAREA_STATIVO" CHECK ((("ST_ATIVO")::text = ANY (ARRAY[('S'::character varying)::text, ('N'::character varying)::text]))),
    CONSTRAINT "CK_ABAAREA_TPSITUACAO" CHECK (("TP_SITUACAO" = ANY (ARRAY['ATIVA'::text, 'MANUTENCAO'::text])))
);

CREATE FUNCTION public.listar_abas_do_menu() RETURNS json
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select coalesce(json_agg(json_build_object(
      'co_aba', a."CO_ABA",
      'no_aba', a."NO_ABA",
      'ds_icone', a."DS_ICONE",
      'nu_ordem', a."NU_ORDEM",
      'co_view', a."CO_VIEW",
      'co_recurso', a."CO_RECURSO",
      'tp_aba', a."TP_ABA",
      'st_beta', a."ST_BETA" = 'S',
      'tp_situacao', a."TP_SITUACAO",
      'ds_mensagem', a."DS_MENSAGEM_MANUTENCAO",
      'dt_previsao', a."DT_PREVISAO_RETORNO",
      'areas', coalesce((
        select json_agg(json_build_object(
            'co_area', r."CO_AREA",
            'nu_ordem', coalesce(r."NU_ORDEM", a."NU_ORDEM"),
            'co_view', coalesce(r."CO_VIEW", a."CO_VIEW"),
            'ds_icone', coalesce(r."DS_ICONE", a."DS_ICONE"),
            'tp_situacao', r."TP_SITUACAO",
            'ds_mensagem', r."DS_MENSAGEM_MANUTENCAO",
            'dt_previsao', r."DT_PREVISAO_RETORNO"
          ) order by ar."NU_ORDEM", r."CO_AREA")
        from public."RL_ABA_AREA" r
        join public."TB_AREA" ar on ar."CO_AREA" = r."CO_AREA"
        where r."CO_ABA" = a."CO_ABA"
          and r."ST_ATIVO" = 'S'
          and ar."ST_ATIVO" = 'S'
      ), '[]'::json)
    ) order by a."NU_ORDEM", a."CO_ABA"), '[]'::json)
  from public."TB_ABA" a
  where a."ST_ATIVO" = 'S';
$$;
