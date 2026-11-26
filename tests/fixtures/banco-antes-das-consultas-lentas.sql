/*
  O banco de 26/11/2026 (supabase/esquema-atual.sql) no que as migrations das consultas lentas
  mudam: as tabelas, chaves e índices que listar_editais_classificacao e
  listar_vagas_por_cargo_da_visao_geral leem, a marca das leituras com versão (tabelas e
  funções) e o perfil, e as funções como estão em produção, copiadas do
  retrato sem mudança (o md5 do prosrc é o da guarda das migrations). Sem dado.
  Quem usa: tests/apoio/banco-das-consultas-lentas.ts.
*/

CREATE FUNCTION private."FC_NORMALIZAR_GRAFIA_CARGO"(p_texto text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    SET search_path TO ''
    AS $_$
  select nullif(
    regexp_replace(
      regexp_replace(
        upper(translate(p_texto, E'áàâãäéèêëíìîïóòôõöúùûüçñýÿÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝºª–—‐‑−“”„‘’´\u00a0\u2007\u202f\u0009\u000d\u000a\u200b\u200c\u200d\ufeff\u00ad\u200e\u200f\u2060\u2063', 'aaaaaeeeeiiiiooooouuuucnyyAAAAAEEEEIIIIOOOOOUUUUCNYOA-----"""''''''      ')),
        ' {2,}', ' ', 'g'),
      '^[ .,;:_/|*"''`-]+|[ .,;:_/|*"''`-]+$', '', 'g'),
    '');
$_$;

CREATE FUNCTION private."FC_NUMERO_EDITAL"(p_texto text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    SET search_path TO ''
    AS $$
  -- "06/2026", "6/2026 (sanitarista)", "Edital 06/2026" -> "6/2026"
  select ltrim(m[1], '0') || '/' || m[2]
    from regexp_match(coalesce(p_texto, ''), '(\d{1,4})\s*/\s*(\d{4})') m;
$$;

CREATE FUNCTION private."FC_EH_TREINAMENTO"(p_marca text) RETURNS boolean
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    SET search_path TO ''
    AS $$
  select coalesce(p_marca, 'N') = 'S';
$$;

CREATE FUNCTION public.analises_norm_key(p_text text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select regexp_replace(lower(btrim(p_text)), '\s+', ' ', 'g');
$$;

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

CREATE TABLE public."TB_MONITORAMENTO_INDIGENA" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    processo text,
    edital text NOT NULL,
    id_unidade text,
    sigla_unidade text,
    tipo_unidade text,
    unidade text NOT NULL,
    uf character(2),
    ciclo text,
    cargos text,
    vagas_total integer DEFAULT 0 NOT NULL,
    inscritos integer,
    aptos_analise integer DEFAULT 0,
    cancelados integer DEFAULT 0,
    eliminados_nota integer DEFAULT 0,
    reprovados_analise integer DEFAULT 0,
    total_eliminados integer DEFAULT 0,
    aprovados_analise integer DEFAULT 0 NOT NULL,
    aprovados_prova integer DEFAULT 0 NOT NULL,
    entrevistados integer DEFAULT 0 NOT NULL,
    contratados integer DEFAULT 0 NOT NULL,
    vagas_ociosas integer GENERATED ALWAYS AS (GREATEST((vagas_total - contratados), 0)) STORED,
    data_inicio date,
    data_fim date,
    status text,
    etapa text,
    risco text DEFAULT 'Baixo'::text,
    responsavel text,
    link_edital text,
    observacoes text,
    observacoes_internas text,
    ativo boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    quantidade_cadastro_reserva text,
    dias_ate_encerramento integer,
    duracao_total_processo text,
    origem_carga text,
    raw_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    cronograma_automatico boolean DEFAULT false NOT NULL,
    cronograma_pdf_path text,
    cronograma_pdf_nome text,
    cronograma_origem text,
    cronograma_revisado_at timestamp with time zone,
    cronograma_revisado_por uuid,
    status_override text,
    etapa_override text,
    status_override_motivo text,
    status_override_data date,
    status_override_previsao_retomada date,
    cronograma_ultima_errata text,
    "CO_AREA" text NOT NULL,
    "NU_ANOS_VALIDADE" smallint DEFAULT 0 NOT NULL,
    "NU_MESES_VALIDADE" smallint DEFAULT 0 NOT NULL,
    "ST_PRORROGADO" boolean DEFAULT false NOT NULL,
    "ST_TREINAMENTO" character varying(1) DEFAULT 'N'::character varying NOT NULL,
    "TP_FONTE_FUNIL" character varying(20),
    "DT_FONTE_FUNIL" timestamp with time zone,
    CONSTRAINT "CK_MONITINDIG_STTREINAMENTO" CHECK ((("ST_TREINAMENTO")::text = ANY (ARRAY[('S'::character varying)::text, ('N'::character varying)::text]))),
    CONSTRAINT "CK_MONITORAMENTO_INDIGENA_VALIDADE" CHECK ((("NU_ANOS_VALIDADE" >= 0) AND ("NU_ANOS_VALIDADE" <= 10) AND (("NU_MESES_VALIDADE" >= 0) AND ("NU_MESES_VALIDADE" <= 11)))),
    CONSTRAINT "CK_MONIT_INDIG_APTOS_INSCRITOS" CHECK (((ativo IS NOT TRUE) OR (aptos_analise IS NULL) OR (inscritos IS NULL) OR (aptos_analise <= inscritos))),
    CONSTRAINT "CK_MONIT_INDIG_DATA_EDITAL" CHECK ((((data_inicio IS NULL) OR ((data_inicio >= '2015-01-01'::date) AND (data_inicio <= '2100-12-31'::date))) AND ((data_fim IS NULL) OR ((data_fim >= '2015-01-01'::date) AND (data_fim <= '2100-12-31'::date))) AND ((data_inicio IS NULL) OR (data_fim IS NULL) OR (data_inicio <= data_fim)))),
    CONSTRAINT "CK_MONIT_INDIG_FONTE_FUNIL" CHECK ((("TP_FONTE_FUNIL" IS NULL) OR (("TP_FONTE_FUNIL")::text = ANY ((ARRAY['AVALIACAO_DOCUMENTAL'::character varying, 'SELECAO'::character varying, 'ANALISES'::character varying])::text[])))),
    CONSTRAINT monitoramento_indigena_aprovados_analise_check CHECK ((aprovados_analise >= 0)),
    CONSTRAINT monitoramento_indigena_aprovados_prova_check CHECK ((aprovados_prova >= 0)),
    CONSTRAINT monitoramento_indigena_aptos_analise_check CHECK ((aptos_analise >= 0)),
    CONSTRAINT monitoramento_indigena_cancelados_check CHECK ((cancelados >= 0)),
    CONSTRAINT monitoramento_indigena_contratados_check CHECK ((contratados >= 0)),
    CONSTRAINT monitoramento_indigena_eliminados_nota_check CHECK ((eliminados_nota >= 0)),
    CONSTRAINT monitoramento_indigena_entrevistados_check CHECK ((entrevistados >= 0)),
    CONSTRAINT monitoramento_indigena_inscritos_check CHECK ((inscritos >= 0)),
    CONSTRAINT monitoramento_indigena_reprovados_analise_check CHECK ((reprovados_analise >= 0)),
    CONSTRAINT monitoramento_indigena_total_eliminados_check CHECK ((total_eliminados >= 0)),
    CONSTRAINT monitoramento_indigena_vagas_total_check CHECK ((vagas_total >= 0))
);

CREATE TABLE public."TB_ANALISE_CURRICULAR" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    grupo text,
    unidade text NOT NULL,
    edital text NOT NULL,
    codigo_vaga text,
    nome_vaga text,
    candidato text,
    cpf_hash text,
    categoria text,
    modalidade_concorrencia text,
    status_consolidado text DEFAULT 'Pendente'::text NOT NULL,
    etapa text,
    responsavel_analise text,
    data_analise date,
    nota_final_ajustada numeric,
    pontuacao_escolaridade numeric,
    pontuacao_cursos_aperfeicoamento numeric,
    pontuacao_experiencia_profissional numeric,
    pontuacao_criterio_etnico numeric,
    experiencia_saude_indigena_total numeric,
    experiencia_atencao_basica_total numeric,
    analise text,
    link_pdf text,
    pdf_status text,
    erro_pdf text,
    origem_url text,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ultima_atualizacao timestamp with time zone DEFAULT now() NOT NULL,
    id_origem text,
    data_nascimento date,
    idade integer,
    regime text,
    carga_horaria text,
    nota_empregare numeric,
    somatorio numeric,
    pcd text,
    coord_demandante text,
    email_demandante text,
    origem_planilha text,
    origem_arquivo_id text,
    pdf_gerado text,
    data_geracao_pdf timestamp with time zone,
    pdf_file_id text,
    pdf_ultima_tentativa timestamp with time zone,
    pdf_hash_origem text,
    linha_origem integer,
    hash_registro text,
    chave_natural text NOT NULL,
    grupo_norm text GENERATED ALWAYS AS (COALESCE(public.analises_norm_key(grupo), ''::text)) STORED,
    unidade_norm text GENERATED ALWAYS AS (COALESCE(public.analises_norm_key(unidade), ''::text)) STORED,
    edital_norm text GENERATED ALWAYS AS (COALESCE(public.analises_norm_key(edital), ''::text)) STORED,
    "CO_AREA" text,
    "CO_PLANILHA" text NOT NULL,
    experiencia_profissional_anos integer,
    experiencia_profissional_meses integer,
    experiencia_profissional_dias integer,
    experiencia_profissional_total numeric,
    "TP_ORIGEM_REGISTRO" character varying(10) DEFAULT 'PLANILHA'::character varying NOT NULL,
    CONSTRAINT "CK_ANALISECURRIC_TPORIGEMREG" CHECK ((("TP_ORIGEM_REGISTRO")::text = ANY (ARRAY[('PLANILHA'::character varying)::text, ('MONITORA'::character varying)::text])))
);

CREATE TABLE public."TB_LISTA_CLASSIFICACAO" (
    "CO_LISTA_CLASSIFICACAO" uuid DEFAULT gen_random_uuid() NOT NULL,
    "CO_MONITORAMENTO" uuid NOT NULL,
    "TP_LISTA" character varying(20) NOT NULL,
    "CO_REGRA_CLASSIFICACAO" uuid NOT NULL,
    "NU_VERSAO_REGRA" integer NOT NULL,
    "DS_RESULTADO" jsonb NOT NULL,
    "DS_HASH" character varying(64) NOT NULL,
    "QT_ELEGIVEL" integer DEFAULT 0 NOT NULL,
    "QT_ELIMINADO" integer DEFAULT 0 NOT NULL,
    "QT_AVISO" integer DEFAULT 0 NOT NULL,
    "QT_PENDENCIA" integer DEFAULT 0 NOT NULL,
    "CO_USUARIO" uuid NOT NULL,
    "DT_GERACAO" timestamp with time zone DEFAULT now() NOT NULL,
    "ST_PUBLICADA" character varying(1) DEFAULT 'N'::character varying NOT NULL,
    "CO_USUARIO_PUBLICACAO" uuid,
    "DT_PUBLICACAO" timestamp with time zone,
    CONSTRAINT "CK_LISTACLASSIF_DSHASH" CHECK ((("DS_HASH")::text ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT "CK_LISTACLASSIF_PUBLICACAO" CHECK ((((("ST_PUBLICADA")::text = 'S'::text) = ("DT_PUBLICACAO" IS NOT NULL)) AND (("DT_PUBLICACAO" IS NULL) = ("CO_USUARIO_PUBLICACAO" IS NULL)) AND ((("ST_PUBLICADA")::text = 'N'::text) OR ("QT_PENDENCIA" = 0)))),
    CONSTRAINT "CK_LISTACLASSIF_QUANTIDADES" CHECK ((("QT_ELEGIVEL" >= 0) AND ("QT_ELIMINADO" >= 0) AND ("QT_AVISO" >= 0) AND ("QT_PENDENCIA" >= 0))),
    CONSTRAINT "CK_LISTACLASSIF_RESULTADO" CHECK ((jsonb_typeof("DS_RESULTADO") = 'object'::text)),
    CONSTRAINT "CK_LISTACLASSIF_STPUBLICADA" CHECK ((("ST_PUBLICADA")::text = ANY (ARRAY[('S'::character varying)::text, ('N'::character varying)::text]))),
    CONSTRAINT "CK_LISTACLASSIF_TPLISTA" CHECK ((("TP_LISTA")::text = ANY (ARRAY[('PROVISORIA'::character varying)::text, ('LOTE'::character varying)::text, ('PRELIMINAR'::character varying)::text, ('CONVOCACAO'::character varying)::text, ('ENTREVISTA'::character varying)::text, ('FINAL'::character varying)::text])))
);

CREATE TABLE public."TB_REGRA_CLASSIFICACAO" (
    "CO_REGRA_CLASSIFICACAO" uuid DEFAULT gen_random_uuid() NOT NULL,
    "CO_MONITORAMENTO" uuid NOT NULL,
    "NU_VERSAO_VIGENTE" integer NOT NULL,
    "CO_USUARIO_ATUALIZACAO" uuid,
    "DT_CRIACAO" timestamp with time zone DEFAULT now() NOT NULL,
    "DT_ATUALIZACAO" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "CK_REGRACLASSIF_NUVERSAO" CHECK (("NU_VERSAO_VIGENTE" >= 1))
);

CREATE TABLE public."TH_REGRA_CLASSIFICACAO" (
    "CO_REGRA_CLASSIFICACAO" uuid NOT NULL,
    "NU_VERSAO" integer NOT NULL,
    "DS_CONFIGURACAO" jsonb NOT NULL,
    "TP_EMPATE_FINAL" character varying(20) NOT NULL,
    "DS_MOTIVO" character varying(500),
    "CO_USUARIO" uuid,
    "DT_CRIACAO" timestamp with time zone DEFAULT now() NOT NULL,
    "NO_VERSAO" character varying(80),
    CONSTRAINT "CK_HISTREGRACLASSIF_CONFIG" CHECK ((jsonb_typeof("DS_CONFIGURACAO") = 'object'::text)),
    CONSTRAINT "CK_HISTREGRACLASSIF_EMPATE" CHECK ((("TP_EMPATE_FINAL")::text = ANY (ARRAY[('SORTEIO'::character varying)::text, ('ORDEM_INSCRICAO'::character varying)::text, ('MESMA_POSICAO'::character varying)::text, ('DECISAO_MANUAL'::character varying)::text]))),
    CONSTRAINT "CK_HISTREGRACLASSIF_MOTIVO" CHECK ((("DS_MOTIVO" IS NULL) OR ((length(("DS_MOTIVO")::text) >= 3) AND (length(("DS_MOTIVO")::text) <= 500)))),
    CONSTRAINT "CK_HISTREGRACLASSIF_NOVERSAO" CHECK ((("NO_VERSAO" IS NULL) OR ((length(("NO_VERSAO")::text) >= 3) AND (length(("NO_VERSAO")::text) <= 80) AND (("NO_VERSAO")::text = btrim(("NO_VERSAO")::text))))),
    CONSTRAINT "CK_HISTREGRACLASSIF_NUVERSAO" CHECK (("NU_VERSAO" >= 1))
);

CREATE TABLE public."TB_SELECAO_VAGA" (
    "CO_SELECAO_VAGA" uuid DEFAULT gen_random_uuid() NOT NULL,
    "CO_AREA" text NOT NULL,
    "CO_MONITORAMENTO" uuid,
    "DS_EDITAL" text NOT NULL,
    "CO_VAGA" text,
    "DS_VAGA_PLANILHA" text NOT NULL,
    "NO_UNIDADE" text,
    "NO_CARGO" text,
    "QT_INSCRITO" integer,
    "QT_APTO_ANALISE" integer,
    "QT_CANCELADO" integer,
    "QT_REPROVADO_QUESTIONARIO" integer,
    "QT_ELIMINADO_NOTA" integer,
    "QT_REPROVADO_ANALISE" integer,
    "QT_TRIADO" integer,
    "QT_TOTAL_ELIMINADO" integer,
    "QT_CONVOCADO_PLANILHA" integer,
    "DS_OBSERVACAO" text,
    "DS_CHAVE_ORIGEM" text NOT NULL,
    "CO_SYNC" text,
    "ST_REGISTRO_ATIVO" character varying(1) DEFAULT 'S'::character varying NOT NULL,
    "DT_CRIACAO" timestamp with time zone DEFAULT now() NOT NULL,
    "DT_ATUALIZACAO" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "CK_SELECAOVAGA_COVAGA" CHECK ((("CO_VAGA" IS NULL) OR ("CO_VAGA" ~ '^[0-9]{1,20}$'::text))),
    CONSTRAINT "CK_SELECAOVAGA_STREGATIVO" CHECK ((("ST_REGISTRO_ATIVO")::text = ANY (ARRAY[('S'::character varying)::text, ('N'::character varying)::text]))),
    CONSTRAINT "CK_SELECAOVAGA_TAMANHOS" CHECK (((length("DS_EDITAL") <= 120) AND (length("DS_VAGA_PLANILHA") <= 400) AND (COALESCE(length("NO_UNIDADE"), 0) <= 200) AND (COALESCE(length("NO_CARGO"), 0) <= 400) AND (COALESCE(length("DS_OBSERVACAO"), 0) <= 1000)))
);

CREATE TABLE public."TB_QUADRO_VAGA_EDITAL" (
    "CO_QUADRO_VAGA" uuid DEFAULT gen_random_uuid() NOT NULL,
    "CO_MONITORAMENTO" uuid NOT NULL,
    "NU_ORDEM" smallint NOT NULL,
    "NO_CARGO" character varying(300) NOT NULL,
    "NO_LOTACAO" character varying(300),
    "DS_MODALIDADE_VAGA" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "QT_VAGA_IMEDIATA" integer DEFAULT 0 NOT NULL,
    "ST_CADASTRO_RESERVA" character varying(1) DEFAULT 'N'::character varying NOT NULL,
    "TP_ORIGEM" character varying(10) DEFAULT 'PDF'::character varying NOT NULL,
    "DS_ARQUIVO_ORIGEM" character varying(300),
    "ST_REGISTRO_ATIVO" character varying(1) DEFAULT 'S'::character varying NOT NULL,
    "CO_USUARIO_ATUALIZACAO" uuid,
    "DT_CRIACAO" timestamp with time zone DEFAULT now() NOT NULL,
    "DT_DESATIVACAO" timestamp with time zone,
    CONSTRAINT "CK_QUADROVAGA_CARGO" CHECK (((length(btrim(("NO_CARGO")::text)) >= 1) AND (length(btrim(("NO_CARGO")::text)) <= 300))),
    CONSTRAINT "CK_QUADROVAGA_MODALIDADE" CHECK ((jsonb_typeof("DS_MODALIDADE_VAGA") = 'object'::text)),
    CONSTRAINT "CK_QUADROVAGA_QT" CHECK ((("QT_VAGA_IMEDIATA" >= 0) AND ("QT_VAGA_IMEDIATA" <= 9999))),
    CONSTRAINT "CK_QUADROVAGA_STATIVO" CHECK ((("ST_REGISTRO_ATIVO")::text = ANY (ARRAY[('S'::character varying)::text, ('N'::character varying)::text]))),
    CONSTRAINT "CK_QUADROVAGA_STCR" CHECK ((("ST_CADASTRO_RESERVA")::text = ANY (ARRAY[('S'::character varying)::text, ('N'::character varying)::text]))),
    CONSTRAINT "CK_QUADROVAGA_TPORIGEM" CHECK ((("TP_ORIGEM")::text = ANY (ARRAY[('PDF'::character varying)::text, ('MANUAL'::character varying)::text])))
);

CREATE TABLE public."TD_CARGO" (
    "CO_CARGO" integer NOT NULL,
    "CO_CARGO_SIP" integer,
    "NO_CARGO" character varying(150) NOT NULL,
    "CO_AREA" text NOT NULL,
    "ST_SINTETICO" character varying(1) DEFAULT 'N'::character varying NOT NULL,
    "ST_REGISTRO_ATIVO" character varying(1) DEFAULT 'S'::character varying NOT NULL,
    "CO_USUARIO_CRIACAO" uuid,
    "DT_CRIACAO" timestamp with time zone DEFAULT now() NOT NULL,
    "CO_USUARIO_ATUALIZACAO" uuid,
    "DT_ATUALIZACAO" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "CK_TDCARGO_COCARGOSIP" CHECK ((("CO_CARGO_SIP" IS NULL) OR ((("CO_CARGO_SIP" >= 1) AND ("CO_CARGO_SIP" <= 99999)) AND ("CO_CARGO" = "CO_CARGO_SIP")))),
    CONSTRAINT "CK_TDCARGO_NOCARGO" CHECK (((length(btrim(("NO_CARGO")::text)) >= 2) AND (length(btrim(("NO_CARGO")::text)) <= 150))),
    CONSTRAINT "CK_TDCARGO_STREGISTROATIVO" CHECK ((("ST_REGISTRO_ATIVO")::text = ANY ((ARRAY['S'::character varying, 'N'::character varying])::text[]))),
    CONSTRAINT "CK_TDCARGO_STSINTETICO" CHECK ((("ST_SINTETICO")::text = ANY ((ARRAY['S'::character varying, 'N'::character varying])::text[])))
);

CREATE TABLE public."TD_CARGO_APELIDO" (
    "CO_CARGO_APELIDO" bigint NOT NULL,
    "CO_AREA" text NOT NULL,
    "DS_GRAFIA_NORMALIZADA" character varying(400) NOT NULL,
    "CO_CARGO" integer NOT NULL,
    "TP_ORIGEM" character varying(10) NOT NULL,
    "TP_REGRA" character varying(12),
    "VL_CONFIANCA" numeric(4,3),
    "ST_CONFIRMADO" character varying(1) DEFAULT 'N'::character varying NOT NULL,
    "CO_USUARIO_CONFIRMACAO" uuid,
    "DT_CONFIRMACAO" timestamp with time zone,
    "ST_REGISTRO_ATIVO" character varying(1) DEFAULT 'S'::character varying NOT NULL,
    "CO_USUARIO_CRIACAO" uuid,
    "DT_CRIACAO" timestamp with time zone DEFAULT now() NOT NULL,
    "CO_USUARIO_ATUALIZACAO" uuid,
    "DT_ATUALIZACAO" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "CK_TDCARGOAPELIDO_AUTOMATICO" CHECK (((("TP_ORIGEM")::text = 'AUTOMATICO'::text) = (("TP_REGRA" IS NOT NULL) AND ("VL_CONFIANCA" IS NOT NULL)))),
    CONSTRAINT "CK_TDCARGOAPELIDO_CONFIRMACAO" CHECK (((("ST_CONFIRMADO")::text = 'S'::text) = ("DT_CONFIRMACAO" IS NOT NULL))),
    CONSTRAINT "CK_TDCARGOAPELIDO_GRAFIA" CHECK ((("DS_GRAFIA_NORMALIZADA")::text = private."FC_NORMALIZAR_GRAFIA_CARGO"(("DS_GRAFIA_NORMALIZADA")::text))),
    CONSTRAINT "CK_TDCARGOAPELIDO_STCONFIRMADO" CHECK ((("ST_CONFIRMADO")::text = ANY ((ARRAY['S'::character varying, 'N'::character varying])::text[]))),
    CONSTRAINT "CK_TDCARGOAPELIDO_STREGISTROATIVO" CHECK ((("ST_REGISTRO_ATIVO")::text = ANY ((ARRAY['S'::character varying, 'N'::character varying])::text[]))),
    CONSTRAINT "CK_TDCARGOAPELIDO_TPORIGEM" CHECK ((("TP_ORIGEM")::text = ANY ((ARRAY['AUTOMATICO'::character varying, 'MANUAL'::character varying])::text[]))),
    CONSTRAINT "CK_TDCARGOAPELIDO_TPREGRA" CHECK ((("TP_REGRA")::text = ANY ((ARRAY['EXATA'::character varying, 'LIMPEZA'::character varying, 'SINONIMO'::character varying, 'CONECTIVOS'::character varying, 'PREFIXO'::character varying, 'SIMILARIDADE'::character varying, 'CONTIDO'::character varying])::text[]))),
    CONSTRAINT "CK_TDCARGOAPELIDO_VLCONFIANCA" CHECK ((("VL_CONFIANCA" >= (0)::numeric) AND ("VL_CONFIANCA" <= (1)::numeric)))
);

CREATE TABLE public."TB_LISTA_APROVADO" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    edital_id text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    vigente boolean DEFAULT true NOT NULL,
    arquivo_nome text NOT NULL,
    arquivo_path text NOT NULL,
    importado_por uuid NOT NULL,
    importado_em timestamp with time zone DEFAULT now() NOT NULL,
    substituido_por uuid,
    substituido_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    "DS_EMAIL_IMPORTACAO" character varying(320),
    "NO_USUARIO_IMPORTACAO" character varying(255),
    "DS_EMAIL_SUBSTITUICAO" character varying(320),
    "NO_USUARIO_SUBSTITUICAO" character varying(255),
    "TP_ORIGEM" character varying(15) DEFAULT 'XLSX'::character varying NOT NULL,
    "CO_LISTA_CLASSIFICACAO" uuid,
    CONSTRAINT "CK_LISTAAPROVADO_ORIGEM" CHECK (((("TP_ORIGEM")::text = 'CLASSIFICACAO'::text) = ("CO_LISTA_CLASSIFICACAO" IS NOT NULL))),
    CONSTRAINT "CK_LISTAAPROVADO_TPORIGEM" CHECK ((("TP_ORIGEM")::text = ANY (ARRAY[('XLSX'::character varying)::text, ('CLASSIFICACAO'::character varying)::text])))
);

CREATE TABLE public."TB_CANDIDATO_APROVADO" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lista_id uuid NOT NULL,
    codigo_vaga text,
    cargo text NOT NULL,
    classificacao integer,
    nota numeric NOT NULL,
    nome text NOT NULL,
    modalidade text,
    status text,
    processo_sei text,
    matricula text,
    sub_judice boolean DEFAULT false NOT NULL,
    removido_em timestamp with time zone,
    removido_por uuid,
    created_by uuid NOT NULL,
    updated_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    alterado_judicialmente boolean DEFAULT false NOT NULL,
    nota_original numeric,
    modalidade_original text,
    classificacao_original integer,
    sub_judice_original boolean,
    "CO_ANALISE_CURRICULAR" uuid,
    "TP_SITUACAO_CLASSIFICACAO" character varying(4),
    "CO_CANDIDATO_ANTERIOR" uuid,
    "DT_CONVOCACAO" date,
    observacao_status text,
    CONSTRAINT "CK_CANDAPROVADO_DTCONVOCACAO" CHECK (((("DT_CONVOCACAO" IS NULL) OR (status IS NOT NULL)) AND ((status IS DISTINCT FROM 'Convocado'::text) OR ("DT_CONVOCACAO" IS NOT NULL)))),
    CONSTRAINT "CK_CANDAPROVADO_TPSITUACAO" CHECK ((("TP_SITUACAO_CLASSIFICACAO" IS NULL) OR (("TP_SITUACAO_CLASSIFICACAO")::text = ANY (ARRAY[('VAGA'::character varying)::text, ('CR'::character varying)::text])))),
    CONSTRAINT "CK_CANDIDATO_APROVADO_STATUS" CHECK (((status IS NULL) OR (status = ANY (ARRAY['Convocado'::text, 'Contratado'::text, 'Contratado em outra lista'::text, 'Desistente'::text, 'Migração'::text, 'Documentação Rejeitada'::text])))),
    CONSTRAINT lista_aprovados_classificacao_check CHECK (((classificacao IS NULL) OR (classificacao > 0))),
    CONSTRAINT lista_aprovados_importado_campos_check CHECK (((sub_judice IS TRUE) OR ((NULLIF(btrim(codigo_vaga), ''::text) IS NOT NULL) AND (classificacao IS NOT NULL) AND (NULLIF(btrim(modalidade), ''::text) IS NOT NULL)))),
    CONSTRAINT lista_aprovados_matricula_status_check CHECK (((status <> ALL (ARRAY['Contratado'::text, 'Migração'::text])) OR (NULLIF(btrim(matricula), ''::text) IS NOT NULL))),
    CONSTRAINT lista_aprovados_nota_check CHECK ((nota >= (0)::numeric))
);

ALTER TABLE public."TD_CARGO_APELIDO" ALTER COLUMN "CO_CARGO_APELIDO" ADD GENERATED ALWAYS AS IDENTITY;
ALTER TABLE ONLY public."TB_AREA" ADD CONSTRAINT "PK_TB_AREA" PRIMARY KEY ("CO_AREA");
ALTER TABLE ONLY public."TB_MONITORAMENTO_INDIGENA" ADD CONSTRAINT monitoramento_indigena_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public."TD_CARGO" ADD CONSTRAINT "PK_TD_CARGO" PRIMARY KEY ("CO_CARGO");
ALTER TABLE ONLY public."TB_REGRA_CLASSIFICACAO" ADD CONSTRAINT "UK_REGRACLASSIF_COMONITOR" UNIQUE ("CO_MONITORAMENTO");
ALTER TABLE ONLY public."TD_CARGO_APELIDO" ADD CONSTRAINT "UK_TDCARGOAPELIDO_AREA_GRAFIA" UNIQUE ("CO_AREA", "DS_GRAFIA_NORMALIZADA");
CREATE INDEX "IN_ANALISECURR_AREANUMEDITAL" ON public."TB_ANALISE_CURRICULAR" USING btree ("CO_AREA", private."FC_NUMERO_EDITAL"(edital)) WHERE ativo;
CREATE INDEX "IN_QUADROVAGA_EDITAL" ON public."TB_QUADRO_VAGA_EDITAL" USING btree ("CO_MONITORAMENTO", "NU_ORDEM") WHERE (("ST_REGISTRO_ATIVO")::text = 'S'::text);
CREATE UNIQUE INDEX "IN_TDCARGO_AREA_NOME" ON public."TD_CARGO" USING btree ("CO_AREA", private."FC_NORMALIZAR_GRAFIA_CARGO"(("NO_CARGO")::text));

CREATE FUNCTION private."FC_CARGO_DA_GRAFIA"(p_texto text, p_area text DEFAULT 'saude-indigena'::text) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  with g as (select private."FC_NORMALIZAR_GRAFIA_CARGO"(p_texto) as grafia),
  achados as (
    select c."CO_CARGO"
      from public."TD_CARGO" c, g
     where c."ST_REGISTRO_ATIVO" = 'S'
       and (p_area is null or c."CO_AREA" = p_area)
       and private."FC_NORMALIZAR_GRAFIA_CARGO"(c."NO_CARGO") = g.grafia
    union
    select a."CO_CARGO"
      from public."TD_CARGO_APELIDO" a
      join public."TD_CARGO" c on c."CO_CARGO" = a."CO_CARGO" and c."ST_REGISTRO_ATIVO" = 'S', g
     where a."ST_REGISTRO_ATIVO" = 'S'
       and a."ST_CONFIRMADO" = 'S'
       and (p_area is null or a."CO_AREA" = p_area)
       and a."DS_GRAFIA_NORMALIZADA" = g.grafia
  )
  select case when count(*) = 1 then min("CO_CARGO") end from achados;
$$;

CREATE FUNCTION public.listar_editais_classificacao(p_area text) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_editais uuid[];
begin
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if not private.pode_recurso('classificacao', 1) then
    raise exception 'Sem permissão para Classificação' using errcode = '42501';
  end if;
  if not private."FC_PODE_AREA"(p_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  v_editais := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];

  return json_build_object(
    'area', p_area,
    'pode_editar', private.pode_recurso('classificacao', 2),
    'editais', (
      with m as (
        select m.id, m.edital, m.unidade, m.ativo, private."FC_NUMERO_EDITAL"(m.edital) as numero,
               private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO") as treinamento,
               coalesce(m.status, '') in ('Concluído', 'Cancelado') as encerrado
          from public."TB_MONITORAMENTO_INDIGENA" m
         where m."CO_AREA" = p_area and (v_editais is null or m.id = any (v_editais))
      ),
      an as (
        select private."FC_NUMERO_EDITAL"(a.edital) as numero, count(*)::integer as qt
          from public."TB_ANALISE_CURRICULAR" a
         where a."CO_AREA" = p_area and a.ativo
         group by 1
      ),
      ul as (
        select distinct on (l."CO_MONITORAMENTO") l."CO_MONITORAMENTO" as id,
               json_build_object('tipo', l."TP_LISTA", 'em', l."DT_GERACAO", 'publicada', l."ST_PUBLICADA" = 'S') as lista
          from public."TB_LISTA_CLASSIFICACAO" l
         where l."CO_MONITORAMENTO" in (select m.id from m)
         order by l."CO_MONITORAMENTO", l."DT_GERACAO" desc
      )
      select coalesce(json_agg(json_build_object(
               'id', m.id, 'edital', m.edital, 'unidade', m.unidade, 'ativo', m.ativo,
               'treinamento', m.treinamento,
               'candidatos', coalesce(an.qt, 0),
               'versao_regra', r."NU_VERSAO_VIGENTE",
               'nome_regra', h."NO_VERSAO",
               'ultima_lista', ul.lista)
             order by m.ativo desc, m.treinamento, m.encerrado, m.edital), '[]'::json)
        from m
        left join an on an.numero = m.numero
        left join ul on ul.id = m.id
        left join public."TB_REGRA_CLASSIFICACAO" r on r."CO_MONITORAMENTO" = m.id
        left join public."TH_REGRA_CLASSIFICACAO" h
          on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
       where coalesce(an.qt, 0) > 0 or ul.id is not null
    )
  );
end;
$$;

CREATE FUNCTION public.listar_vagas_por_cargo_da_visao_geral(p_area text, p_editais uuid[]) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    SET statement_timeout TO '10s'
    AS $$
declare
  v_area text := lower(btrim(coalesce(p_area, '')));
  v_visiveis uuid[];
  v_editais uuid[];
begin
  if (select auth.uid()) is null then
    raise exception 'Sessão não localizada.' using errcode = '28000';
  end if;
  if not private.pode_recurso('dashboard') then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;
  if not (v_area = any ((select private."FC_AREAS_USUARIO"())::text[])) then
    raise exception 'Sem permissão para esta área' using errcode = '42501';
  end if;
  if cardinality(coalesce(p_editais, '{}'::uuid[])) > 1000 then
    raise exception 'Editais demais para um relatório.' using errcode = '22023';
  end if;

  -- Só os editais pedidos que a pessoa vê; os outros ficam de fora, sem erro.
  v_visiveis := private."FC_EDITAIS_VISIVEIS"();
  select coalesce(array_agg(m.id), '{}') into v_editais
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m.id = any (coalesce(p_editais, '{}'::uuid[]))
     and m."CO_AREA" = v_area
     and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
     and (v_visiveis is null or m.id = any (v_visiveis));

  return jsonb_build_object(
    'vagas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'monitoramento_id', s."CO_MONITORAMENTO",
               'codigo', s."CO_VAGA",
               'vaga', s."DS_VAGA_PLANILHA",
               'cargo', s."NO_CARGO",
               -- O cargo oficial (TD_CARGO) da grafia; nulo sem cadastro na área ou sem casamento único.
               'co_cargo', private."FC_CARGO_DA_GRAFIA"(s."NO_CARGO", v_area),
               'unidade', s."NO_UNIDADE",
               'inscritos', s."QT_INSCRITO"
             ) order by s."CO_MONITORAMENTO", s."DS_VAGA_PLANILHA")
        from public."TB_SELECAO_VAGA" s
       where s."ST_REGISTRO_ATIVO" = 'S'
         and s."CO_MONITORAMENTO" = any (v_editais)
    ), '[]'::jsonb),
    'quadro', coalesce((
      select jsonb_agg(jsonb_build_object(
               'monitoramento_id', q."CO_MONITORAMENTO",
               'cargo', q."NO_CARGO",
               'co_cargo', private."FC_CARGO_DA_GRAFIA"(q."NO_CARGO", v_area),
               'lotacao', q."NO_LOTACAO",
               'vagas', q."QT_VAGA_IMEDIATA",
               'reserva', q."ST_CADASTRO_RESERVA" = 'S'
             ) order by q."CO_MONITORAMENTO", q."NU_ORDEM")
        from public."TB_QUADRO_VAGA_EDITAL" q
       where q."ST_REGISTRO_ATIVO" = 'S'
         and q."CO_MONITORAMENTO" = any (v_editais)
    ), '[]'::jsonb),
    'lista', coalesce((
      select jsonb_agg(jsonb_build_object(
               'monitoramento_id', r.edital_id,
               'codigo_vaga', r.codigo_vaga,
               'cargo', r.cargo,
               'aprovados', r.aprovados
             ) order by r.edital_id, r.codigo_vaga, r.cargo)
        from (
          select l.edital_id, c.codigo_vaga, c.cargo, count(*)::integer as aprovados
            from public."TB_LISTA_APROVADO" l
            join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
           where l.vigente is true
             and l.edital_id = any (array(select e::text from unnest(v_editais) e))
           group by l.edital_id, c.codigo_vaga, c.cargo
        ) r
    ), '[]'::jsonb)
  );
end;
$$;

-- A marca das leituras com versão (FC_MARCA_DA_RPC → FC_MARCA_DA_LEITURA) e o cálculo das fontes.
CREATE TABLE private."TD_LEITURA_POR_MARCA" (
    "NO_LEITURA" character varying(60) NOT NULL,
    "DS_FUNCOES" text[] NOT NULL,
    "DS_FONTES_EXTRAS" text[] DEFAULT '{}'::text[] NOT NULL,
    "DS_LEITURA" text NOT NULL
);

CREATE TABLE private."TD_FONTE_DA_LEITURA" (
    "NO_LEITURA" character varying(60) NOT NULL,
    "NO_FONTE" character varying(130) NOT NULL,
    "DT_ATUALIZACAO" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE private."TL_VERSAO_FONTE" (
    "CO_VERSAO_FONTE" bigint NOT NULL,
    "NO_FONTE" character varying(130) NOT NULL,
    "QT_ALTERACAO" bigint DEFAULT 1 NOT NULL,
    "DT_REGISTRO" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "CK_TLVERSAOFONTE_QTALTERACAO" CHECK (("QT_ALTERACAO" > 0))
);

CREATE TABLE private."TD_COLUNA_SEM_MARCA" (
    "NO_FONTE" character varying(130) NOT NULL,
    "NO_COLUNA" character varying(63) NOT NULL,
    "DS_MOTIVO" text NOT NULL
);

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


ALTER TABLE private."TL_VERSAO_FONTE" ALTER COLUMN "CO_VERSAO_FONTE" ADD GENERATED ALWAYS AS IDENTITY;
ALTER TABLE ONLY private."TD_COLUNA_SEM_MARCA" ADD CONSTRAINT "PK_TD_COLUNA_SEM_MARCA" PRIMARY KEY ("NO_FONTE", "NO_COLUNA");
ALTER TABLE ONLY private."TD_FONTE_DA_LEITURA" ADD CONSTRAINT "PK_TD_FONTE_DA_LEITURA" PRIMARY KEY ("NO_LEITURA", "NO_FONTE");
ALTER TABLE ONLY private."TD_LEITURA_POR_MARCA" ADD CONSTRAINT "PK_TD_LEITURA_POR_MARCA" PRIMARY KEY ("NO_LEITURA");
ALTER TABLE ONLY private."TL_VERSAO_FONTE" ADD CONSTRAINT "PK_TL_VERSAO_FONTE" PRIMARY KEY ("CO_VERSAO_FONTE");
ALTER TABLE ONLY public."TB_PERFIL_USUARIO" ADD CONSTRAINT perfis_usuarios_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public."TB_PERFIL_USUARIO" ADD CONSTRAINT perfis_usuarios_email_key UNIQUE (email);
ALTER TABLE ONLY public."TB_PERFIL_USUARIO" ADD CONSTRAINT perfis_usuarios_user_id_key UNIQUE (user_id);
CREATE INDEX "IN_TLVERSAOFONTE_NOFONTE" ON private."TL_VERSAO_FONTE" USING btree ("NO_FONTE") INCLUDE ("QT_ALTERACAO");

CREATE FUNCTION private."FC_CODIGO_DA_LEITURA"(p_funcoes text[]) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_vistas_f text[] := '{}';
  v_vistas_r oid[] := '{}';
  v_fila_f text[] := coalesce(p_funcoes, '{}');
  v_fila_r oid[] := '{}';
  v_texto text;
  v_tudo text := '';
begin
  -- O mesmo fecho de private."FC_FONTES_PELO_CODIGO" (20261029170000), devolvendo o
  -- código (funções e views, sem comentários) em vez das tabelas.
  while cardinality(v_fila_f) > 0 or cardinality(v_fila_r) > 0 loop
    v_vistas_f := v_vistas_f || v_fila_f;
    v_vistas_r := v_vistas_r || v_fila_r;
    select coalesce(string_agg(p.prosrc, E'\n'), '') into v_texto
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private') and p.proname = any (v_fila_f);
    v_texto := v_texto || E'\n' || coalesce((
      select string_agg(pg_catalog.pg_get_viewdef(c.oid), E'\n')
        from pg_catalog.pg_class c
       where c.oid = any (v_fila_r) and c.relkind in ('v', 'm')), '');
    v_texto := regexp_replace(regexp_replace(v_texto, '/\*.*?\*/', ' ', 'g'), '--[^\n]*', ' ', 'g');
    v_tudo := v_tudo || E'\n' || v_texto;
    select coalesce(array_agg(distinct p.proname::text), '{}') into v_fila_f
      from (select (regexp_matches(v_texto, '([A-Za-z_][A-Za-z0-9_]*)"?\s*\(', 'g'))[1] as t) x
      join pg_catalog.pg_proc p on p.proname = x.t
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace and n.nspname in ('public', 'private')
     where not (p.proname::text = any (v_vistas_f));
    select coalesce(array_agg(distinct c.oid), '{}') into v_fila_r
      from (select distinct (regexp_matches(v_texto, '[A-Za-z_][A-Za-z0-9_]*', 'g'))[1] as t) x
      join pg_catalog.pg_class c on c.relname = x.t and c.relkind in ('r', 'p', 'v', 'm')
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace and n.nspname in ('public', 'private')
     where not (c.oid = any (v_vistas_r));
  end loop;
  return v_tudo;
end;
$$;

CREATE FUNCTION private."FC_FONTES_PELO_CODIGO"(p_funcoes text[]) RETURNS SETOF text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_vistas_f text[] := '{}';
  v_vistas_r oid[] := '{}';
  v_fila_f text[] := coalesce(p_funcoes, '{}');
  v_fila_r oid[] := '{}';
  v_texto text;
begin
  -- Fecho por nome: toda função (de qualquer assinatura) e view de public/private citada
  -- no código, sem comentários, até as tabelas. Sobra tabela (citada num texto): só faz a
  -- marca mudar a mais; não falta nenhuma que o código leia por nome (não há SQL dinâmico
  -- nas leituras de hoje; conferido no ensaio).
  while cardinality(v_fila_f) > 0 or cardinality(v_fila_r) > 0 loop
    v_vistas_f := v_vistas_f || v_fila_f;
    v_vistas_r := v_vistas_r || v_fila_r;
    select coalesce(string_agg(p.prosrc, E'\n'), '') into v_texto
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private') and p.proname = any (v_fila_f);
    v_texto := v_texto || E'\n' || coalesce((
      select string_agg(pg_catalog.pg_get_viewdef(c.oid), E'\n')
        from pg_catalog.pg_class c
       where c.oid = any (v_fila_r) and c.relkind in ('v', 'm')), '');
    v_texto := regexp_replace(regexp_replace(v_texto, '/\*.*?\*/', ' ', 'g'), '--[^\n]*', ' ', 'g');
    select coalesce(array_agg(distinct p.proname::text), '{}') into v_fila_f
      from (select (regexp_matches(v_texto, '([A-Za-z_][A-Za-z0-9_]*)"?\s*\(', 'g'))[1] as t) x
      join pg_catalog.pg_proc p on p.proname = x.t
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace and n.nspname in ('public', 'private')
     where not (p.proname::text = any (v_vistas_f));
    select coalesce(array_agg(distinct c.oid), '{}') into v_fila_r
      from (select distinct (regexp_matches(v_texto, '[A-Za-z_][A-Za-z0-9_]*', 'g'))[1] as t) x
      join pg_catalog.pg_class c on c.relname = x.t and c.relkind in ('r', 'p', 'v', 'm')
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace and n.nspname in ('public', 'private')
     where not (c.oid = any (v_vistas_r));
  end loop;
  return query
    select n.nspname || '.' || c.relname
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where c.oid = any (v_vistas_r)
       and c.relkind in ('r', 'p')
       and c.relname not in ('TL_VERSAO_FONTE', 'TD_LEITURA_POR_MARCA', 'TD_FONTE_DA_LEITURA')
     order by 1;
end;
$$;

CREATE FUNCTION private."FC_COMPACTAR_VERSAO_FONTE"(p_fonte text DEFAULT NULL::text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_fonte text;
  v_juntadas integer;
  v_total integer := 0;
begin
  for v_fonte in
    select distinct v."NO_FONTE" from private."TL_VERSAO_FONTE" v
     where p_fonte is null or v."NO_FONTE" = p_fonte
     order by 1
  loop
    -- Uma compactação por fonte de cada vez (até o fim da transação): as linhas apagadas
    -- e a linha com a soma aparecem juntas, e a soma não muda. Linha de transação ainda
    -- aberta não é vista pelo delete e fica para a próxima.
    continue when not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtext('agsus_versao_fonte:' || v_fonte));
    continue when (select count(*) from private."TL_VERSAO_FONTE" v where v."NO_FONTE" = v_fonte) < 2;
    with apagadas as (
      delete from private."TL_VERSAO_FONTE" v where v."NO_FONTE" = v_fonte returning v."QT_ALTERACAO"
    )
    insert into private."TL_VERSAO_FONTE" ("NO_FONTE", "QT_ALTERACAO")
    select v_fonte, sum(a."QT_ALTERACAO") from apagadas a having count(*) > 0;
    get diagnostics v_juntadas = row_count;
    v_total := v_total + v_juntadas;
  end loop;
  return v_total;
end;
$$;

CREATE FUNCTION private."FC_TG_VERSAO_FONTE"() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  -- Uma linha por transação e tabela: a marca da transação fica numa configuração local.
  v_marca constant text := 'agsus_versao_fonte.t' || tg_relid::text;
  v_transacao constant text := pg_catalog.txid_current()::text;
  v_fonte constant text := tg_table_schema || '.' || tg_table_name;
begin
  if coalesce(pg_catalog.current_setting(v_marca, true), '') = v_transacao then
    return null;
  end if;
  -- Por comando (20261103150000): só conta se a tabela de transição tem linha — o
  -- comando de 0 linhas não muda a marca. TRUNCATE não tem tabela de transição: conta.
  -- Por linha (UPDATE OF as colunas da marca, TD_COLUNA_SEM_MARCA): já é linha mudada.
  if tg_level = 'STATEMENT' then
    if tg_op in ('INSERT', 'UPDATE') then
      if not exists (select 1 from novas) then
        return null;
      end if;
    elsif tg_op = 'DELETE' then
      if not exists (select 1 from antigas) then
        return null;
      end if;
    end if;
  end if;
  perform pg_catalog.set_config(v_marca, v_transacao, true);
  insert into private."TL_VERSAO_FONTE" ("NO_FONTE") values (v_fonte);
  if (select count(*) from private."TL_VERSAO_FONTE" v where v."NO_FONTE" = v_fonte) > 50 then
    perform private."FC_COMPACTAR_VERSAO_FONTE"(v_fonte);
  end if;
  return null;
end;
$$;

CREATE FUNCTION private."FC_MARCA_DA_LEITURA"(p_leitura text, p_chave text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select 'm1:' || md5(concat_ws('|',
           p_leitura,
           coalesce(p_chave, ''),
           coalesce((select auth.uid())::text, ''),
           lower(coalesce((select auth.jwt()) ->> 'email', '')),
           coalesce((select auth.role()), ''),
           -- TRUNCATE ou tabela recriada: as somas recomeçam, a marca não repete.
           pg_catalog.pg_relation_filenode('private."TL_VERSAO_FONTE"'::regclass)::text,
           string_agg(f."NO_FONTE" || '=' || coalesce(v.qt, 0)::text, ',' order by f."NO_FONTE")))
    from private."TD_FONTE_DA_LEITURA" f
    left join lateral (
      select sum(x."QT_ALTERACAO") as qt
        from private."TL_VERSAO_FONTE" x
       where x."NO_FONTE" = f."NO_FONTE") v on true
   where f."NO_LEITURA" = p_leitura
  having count(*) > 0;
$$;

CREATE FUNCTION private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"(p_gatilhos boolean DEFAULT true) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_leitura record;
  v_fontes text[];
  v_tabela text;
  v_rel regclass;
  v_citadas text;
  v_atributos smallint[];
  v_colunas text;
  v_upd record;
  v_gatilho text;
  v_novos text[] := '{}';
  v_contagem jsonb := '{}';
begin
  for v_leitura in select * from private."TD_LEITURA_POR_MARCA" l order by l."NO_LEITURA" loop
    select coalesce(array_agg(distinct x.f order by x.f), '{}') into v_fontes
      from (select f from private."FC_FONTES_PELO_CODIGO"(v_leitura."DS_FUNCOES") f
            union
            select unnest(v_leitura."DS_FONTES_EXTRAS")) x(f);
    delete from private."TD_FONTE_DA_LEITURA" f
     where f."NO_LEITURA" = v_leitura."NO_LEITURA" and f."NO_FONTE" <> all (v_fontes);
    insert into private."TD_FONTE_DA_LEITURA" ("NO_LEITURA", "NO_FONTE")
    select v_leitura."NO_LEITURA", u.f from unnest(v_fontes) u(f)
    on conflict do nothing;
    v_contagem := v_contagem || jsonb_build_object(v_leitura."NO_LEITURA", cardinality(v_fontes));

    -- Coluna fora da marca citada no código da leitura: a marca deixaria de mudar
    -- quando ela muda. Recusa (tire a coluna de TD_COLUNA_SEM_MARCA).
    if exists (select 1 from private."TD_COLUNA_SEM_MARCA" c where c."NO_FONTE" = any (v_fontes)) then
      select string_agg(c."NO_FONTE" || '.' || c."NO_COLUNA", ', ' order by c."NO_FONTE", c."NO_COLUNA")
        into v_citadas
        from private."TD_COLUNA_SEM_MARCA" c
       cross join (select private."FC_CODIGO_DA_LEITURA"(v_leitura."DS_FUNCOES") as codigo) x
       where c."NO_FONTE" = any (v_fontes)
         and x.codigo ~ ('\m' || c."NO_COLUNA" || '\M');
      if v_citadas is not null then
        raise exception 'A leitura % cita coluna(s) fora da marca: %. Tire de private."TD_COLUNA_SEM_MARCA".',
          v_leitura."NO_LEITURA", v_citadas using errcode = '22023';
      end if;
    end if;
  end loop;

  if p_gatilhos then
    -- O gatilho antigo (um só, por comando, sem tabela de transição: contava comando de 0 linhas).
    for v_rel in select t.tgrelid::regclass from pg_catalog.pg_trigger t where t.tgname = 'TG_VERSAO_FONTE' loop
      execute format('drop trigger "TG_VERSAO_FONTE" on %s', v_rel);
    end loop;
  end if;

  for v_tabela in select distinct f."NO_FONTE" from private."TD_FONTE_DA_LEITURA" f where p_gatilhos order by 1 loop
    v_rel := to_regclass(format('%I.%I', split_part(v_tabela, '.', 1), split_part(v_tabela, '.', 2)));
    if v_rel is null then
      raise exception 'Fonte inexistente: %', v_tabela using errcode = '42P01';
    end if;

    -- Com coluna fora da marca: UPDATE OF as outras colunas, por linha. Sem: por comando.
    v_atributos := null;
    v_colunas := null;
    if exists (select 1 from private."TD_COLUNA_SEM_MARCA" c
                 join pg_catalog.pg_attribute a
                   on a.attrelid = v_rel and a.attname = c."NO_COLUNA" and a.attnum > 0 and not a.attisdropped
                where c."NO_FONTE" = v_tabela) then
      select array_agg(a.attnum order by a.attnum),
             string_agg(format('%I', a.attname), ', ' order by a.attnum)
        into v_atributos, v_colunas
        from pg_catalog.pg_attribute a
       where a.attrelid = v_rel and a.attnum > 0 and not a.attisdropped
         and not exists (select 1 from private."TD_COLUNA_SEM_MARCA" c
                          where c."NO_FONTE" = v_tabela and c."NO_COLUNA" = a.attname);
    end if;

    -- O gatilho de UPDATE que não é o que devia ser (a lista de colunas mudou) sai e volta.
    select (t.tgtype & 1) = 1 as por_linha,
           array(select x from unnest(t.tgattr::smallint[]) x order by x) as atributos
      into v_upd
      from pg_catalog.pg_trigger t
     where t.tgrelid = v_rel and t.tgname = 'TG_VERSAO_FONTE_UPD';
    if found and (case when v_atributos is null then v_upd.por_linha or cardinality(v_upd.atributos) > 0
                       else not v_upd.por_linha or v_upd.atributos is distinct from v_atributos end) then
      execute format('drop trigger "TG_VERSAO_FONTE_UPD" on %s', v_rel);
    end if;

    foreach v_gatilho in array array['TG_VERSAO_FONTE_INS', 'TG_VERSAO_FONTE_UPD', 'TG_VERSAO_FONTE_DEL', 'TG_VERSAO_FONTE_TRUNC'] loop
      if not exists (select 1 from pg_catalog.pg_trigger t where t.tgrelid = v_rel and t.tgname = v_gatilho) then
        execute format('create trigger %I after %s on %s %s execute function private."FC_TG_VERSAO_FONTE"()',
          v_gatilho,
          case v_gatilho
            when 'TG_VERSAO_FONTE_INS' then 'insert'
            when 'TG_VERSAO_FONTE_DEL' then 'delete'
            when 'TG_VERSAO_FONTE_TRUNC' then 'truncate'
            else case when v_atributos is null then 'update' else 'update of ' || v_colunas end
          end,
          v_rel,
          case v_gatilho
            when 'TG_VERSAO_FONTE_INS' then 'referencing new table as novas for each statement'
            when 'TG_VERSAO_FONTE_DEL' then 'referencing old table as antigas for each statement'
            when 'TG_VERSAO_FONTE_TRUNC' then 'for each statement'
            else case when v_atributos is null then 'referencing new table as novas for each statement'
                      else 'for each row' end
          end);
        if not (v_tabela = any (v_novos)) then
          v_novos := v_novos || v_tabela;
        end if;
      end if;
      -- Vale também com session_replication_role = replica (correções de dados).
      if exists (select 1 from pg_catalog.pg_trigger t
                  where t.tgrelid = v_rel and t.tgname = v_gatilho and t.tgenabled <> 'A') then
        execute format('alter table %s enable always trigger %I', v_rel, v_gatilho);
      end if;
    end loop;
  end loop;

  return jsonb_build_object('leituras', v_contagem, 'gatilhos_novos', to_jsonb(v_novos));
end;
$$;

CREATE FUNCTION private."FC_MARCA_DA_RPC"(p_rpc text, p_area text DEFAULT NULL::text, p_edital uuid DEFAULT NULL::uuid, p_escopo text DEFAULT NULL::text, p_modulo text DEFAULT NULL::text) RETURNS text
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

