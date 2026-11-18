/*
  O banco ANTES de 20261118120000 (vínculo da vaga com o quadro), no que
  tests/apoio/banco-do-vinculo-do-quadro.ts usa: as tabelas (com as chaves primárias, sem as
  estrangeiras, os índices e os gatilhos) e as funções do quadro de vagas, da Empregare e da
  Classificação, copiadas letra por letra do retrato de produção (supabase/esquema-atual.sql)
  da main de 18/11/2026. A guarda md5 da migration confere que são estes corpos. Não é
  migration: não aplicar.
*/

CREATE FUNCTION public.analises_norm_key(p_text text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select regexp_replace(lower(btrim(p_text)), '\s+', ' ', 'g');
$$;

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

CREATE TABLE public."TB_EMPREGARE_VAGA" (
    "CO_VAGA" text NOT NULL,
    "CO_MONITORAMENTO" uuid,
    "TP_SITUACAO" text DEFAULT 'EM_CARGA'::text NOT NULL,
    "DS_COLUNA" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "NO_ARQUIVO" character varying(300),
    "QT_CANDIDATO_ATIVO" integer DEFAULT 0 NOT NULL,
    "QT_LINHA_ARQUIVO" integer,
    "QT_RECEBIDA" integer DEFAULT 0 NOT NULL,
    "DS_MENSAGEM" text,
    "CO_SYNC" text,
    "DT_ULTIMA_CARGA" timestamp with time zone,
    "DT_CRIACAO" timestamp with time zone DEFAULT now() NOT NULL,
    "DT_ATUALIZACAO" timestamp with time zone DEFAULT now() NOT NULL,
    "CO_VAGA_INTERNO" character varying(100),
    "DT_CAPTURA_LINK" timestamp with time zone,
    CONSTRAINT "CK_EMPREGVAGA_COVAGA" CHECK (("CO_VAGA" ~ '^[0-9]{1,20}$'::text)),
    CONSTRAINT "CK_EMPREGVAGA_COVAGAINTERNO" CHECK ((("CO_VAGA_INTERNO" IS NULL) OR ((("CO_VAGA_INTERNO")::text ~ '^[A-Za-z0-9_.~=-]{1,96}[|]{0,3}$'::text) AND (("CO_VAGA_INTERNO")::text !~ '^[0-9]+[|]*$'::text)))),
    CONSTRAINT "CK_EMPREGVAGA_DSCOLUNA" CHECK ((jsonb_typeof("DS_COLUNA") = 'array'::text)),
    CONSTRAINT "CK_EMPREGVAGA_MENSAGEM" CHECK ((COALESCE(length("DS_MENSAGEM"), 0) <= 1000)),
    CONSTRAINT "CK_EMPREGVAGA_QT" CHECK ((("QT_CANDIDATO_ATIVO" >= 0) AND ("QT_RECEBIDA" >= 0) AND (COALESCE("QT_LINHA_ARQUIVO", 0) >= 0))),
    CONSTRAINT "CK_EMPREGVAGA_TPSITUACAO" CHECK (("TP_SITUACAO" = ANY (ARRAY['EM_CARGA'::text, 'GRAVADA'::text, 'RECUSADA'::text, 'INCOMPLETA'::text])))
);

CREATE TABLE public."TB_EMPREGARE_CANDIDATO" (
    "CO_EMPREGARE_CANDIDATO" uuid DEFAULT gen_random_uuid() NOT NULL,
    "CO_VAGA" text NOT NULL,
    "DS_CHAVE_CANDIDATO" character varying(80) NOT NULL,
    "TP_CHAVE" character varying(10) NOT NULL,
    "CO_CANDIDATO_EMPREGARE" character varying(60),
    "NO_CANDIDATO" character varying(300),
    "DS_EMAIL" character varying(320),
    "NU_CPF" character varying(11),
    "NU_TELEFONE" character varying(60),
    "DT_NASCIMENTO" date,
    "DS_SITUACAO_EMPREGARE" character varying(200),
    "DT_CANDIDATURA" timestamp with time zone,
    "DS_COLUNA_ORIGINAL" jsonb NOT NULL,
    "DS_HASH_LINHA" character varying(64) NOT NULL,
    "CO_SYNC" text,
    "ST_REGISTRO_ATIVO" character varying(1) DEFAULT 'S'::character varying NOT NULL,
    "DT_CRIACAO" timestamp with time zone DEFAULT now() NOT NULL,
    "DT_ATUALIZACAO" timestamp with time zone DEFAULT now() NOT NULL,
    "DT_CONFERENCIA" timestamp with time zone DEFAULT now() NOT NULL,
    "DT_DESATIVACAO" timestamp with time zone,
    "DS_LINK_DETALHE" character varying(600),
    "DT_CAPTURA_LINK" timestamp with time zone,
    CONSTRAINT "CK_EMPREGCAND_CHAVE" CHECK ((("DS_CHAVE_CANDIDATO")::text ~ '^(cod:[A-Za-z0-9._-]{1,60}|cpf:[0-9a-f]{64}|email:[0-9a-f]{64})$'::text)),
    CONSTRAINT "CK_EMPREGCAND_DESATIVACAO" CHECK (((("ST_REGISTRO_ATIVO")::text = 'N'::text) = ("DT_DESATIVACAO" IS NOT NULL))),
    CONSTRAINT "CK_EMPREGCAND_DSLINKDETALHE" CHECK ((("DS_LINK_DETALHE" IS NULL) OR ((("DS_LINK_DETALHE")::text ~ '^https://corporate\.empregare\.com/empresa/curriculo/detalhes\?[A-Za-z0-9_.~=&%|+/:-]+$'::text) AND (length(("DS_LINK_DETALHE")::text) <= 600)))),
    CONSTRAINT "CK_EMPREGCAND_HASH" CHECK ((("DS_HASH_LINHA")::text ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT "CK_EMPREGCAND_NUCPF" CHECK ((("NU_CPF" IS NULL) OR (("NU_CPF")::text ~ '^[0-9]{11}$'::text))),
    CONSTRAINT "CK_EMPREGCAND_ORIGINAL" CHECK ((jsonb_typeof("DS_COLUNA_ORIGINAL") = 'object'::text)),
    CONSTRAINT "CK_EMPREGCAND_STATIVO" CHECK ((("ST_REGISTRO_ATIVO")::text = ANY (ARRAY[('S'::character varying)::text, ('N'::character varying)::text]))),
    CONSTRAINT "CK_EMPREGCAND_TPCHAVE" CHECK (((("TP_CHAVE")::text = ANY (ARRAY[('CODIGO'::character varying)::text, ('CPF'::character varying)::text, ('EMAIL'::character varying)::text])) AND (split_part(("DS_CHAVE_CANDIDATO")::text, ':'::text, 1) =
CASE "TP_CHAVE"
    WHEN 'CODIGO'::text THEN 'cod'::text
    WHEN 'CPF'::text THEN 'cpf'::text
    ELSE 'email'::text
END)))
);

CREATE TABLE public."TB_TAREFA_AGENDADA" (
    "NO_TAREFA" character varying(63) NOT NULL,
    "ST_PREFIXO" character varying(1) DEFAULT 'N'::character varying NOT NULL,
    "DS_ROTULO" character varying(120) NOT NULL,
    "CO_CHAVE" character varying(40),
    "NO_WORKFLOW" character varying(60),
    "DT_CRIACAO" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "CK_TAREFAGEND_NOTAREFA" CHECK ((("NO_TAREFA")::text ~ '^agsus_[a-z0-9_]+$'::text)),
    CONSTRAINT "CK_TAREFAGEND_STPREFIXO" CHECK ((("ST_PREFIXO")::text = ANY ((ARRAY['S'::character varying, 'N'::character varying])::text[])))
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

CREATE TABLE public."TB_AJUSTE_PONTUACAO_RECURSO" (
    "CO_AJUSTE_PONTUACAO" uuid DEFAULT gen_random_uuid() NOT NULL,
    "CO_RECURSO_CANDIDATO" uuid NOT NULL,
    "CO_MONITORAMENTO" uuid NOT NULL,
    "CO_ANALISE_CURRICULAR" uuid NOT NULL,
    "NU_VERSAO" integer NOT NULL,
    "TP_SITUACAO" character varying(10) DEFAULT 'PROPOSTO'::character varying NOT NULL,
    "TP_LISTA" character varying(20) NOT NULL,
    "DS_JUSTIFICATIVA" text,
    "DS_PREVIA" jsonb,
    "DS_PREVIA_APROVACAO" jsonb,
    "ST_MUDOU_POSICAO" character varying(1) DEFAULT 'N'::character varying NOT NULL,
    "DT_PROPOSTA" timestamp with time zone DEFAULT now() NOT NULL,
    "CO_USUARIO_PROPOSTA" uuid NOT NULL,
    "DT_APROVACAO" timestamp with time zone,
    "CO_USUARIO_APROVACAO" uuid,
    "DT_CANCELAMENTO" timestamp with time zone,
    "CO_USUARIO_CANCELAMENTO" uuid,
    "DS_MOTIVO_CANCELAMENTO" text,
    CONSTRAINT "CK_AJUSTEPONTREC_FLUXO" CHECK (((("DT_APROVACAO" IS NULL) = ("CO_USUARIO_APROVACAO" IS NULL)) AND (("DT_CANCELAMENTO" IS NULL) = ("CO_USUARIO_CANCELAMENTO" IS NULL)) AND (("DT_CANCELAMENTO" IS NULL) = ("DS_MOTIVO_CANCELAMENTO" IS NULL)) AND ((("TP_SITUACAO")::text <> 'PROPOSTO'::text) OR (("DT_APROVACAO" IS NULL) AND ("DT_CANCELAMENTO" IS NULL))) AND ((("TP_SITUACAO")::text <> 'APROVADO'::text) OR (("DT_APROVACAO" IS NOT NULL) AND ("DT_CANCELAMENTO" IS NULL))) AND ((("TP_SITUACAO")::text <> 'CANCELADO'::text) OR ("DT_CANCELAMENTO" IS NOT NULL)) AND ((("ST_MUDOU_POSICAO")::text = 'N'::text) OR ("DT_APROVACAO" IS NOT NULL)))),
    CONSTRAINT "CK_AJUSTEPONTREC_NUVERSAO" CHECK (("NU_VERSAO" >= 1)),
    CONSTRAINT "CK_AJUSTEPONTREC_PREVIA" CHECK (((("DS_PREVIA" IS NULL) OR (jsonb_typeof("DS_PREVIA") = 'object'::text)) AND (("DS_PREVIA_APROVACAO" IS NULL) OR (jsonb_typeof("DS_PREVIA_APROVACAO") = 'object'::text)))),
    CONSTRAINT "CK_AJUSTEPONTREC_STMUDOUPOSICAO" CHECK ((("ST_MUDOU_POSICAO")::text = ANY (ARRAY[('S'::character varying)::text, ('N'::character varying)::text]))),
    CONSTRAINT "CK_AJUSTEPONTREC_TEXTOS" CHECK (((("DS_JUSTIFICATIVA" IS NULL) OR ((length("DS_JUSTIFICATIVA") >= 10) AND (length("DS_JUSTIFICATIVA") <= 4000))) AND (("DS_MOTIVO_CANCELAMENTO" IS NULL) OR ((length("DS_MOTIVO_CANCELAMENTO") >= 3) AND (length("DS_MOTIVO_CANCELAMENTO") <= 2000))))),
    CONSTRAINT "CK_AJUSTEPONTREC_TPLISTA" CHECK ((("TP_LISTA")::text = ANY (ARRAY[('PRELIMINAR'::character varying)::text, ('ENTREVISTA'::character varying)::text, ('FINAL'::character varying)::text]))),
    CONSTRAINT "CK_AJUSTEPONTREC_TPSITUACAO" CHECK ((("TP_SITUACAO")::text = ANY (ARRAY[('PROPOSTO'::character varying)::text, ('APROVADO'::character varying)::text, ('CANCELADO'::character varying)::text])))
);

CREATE TABLE public."TB_CRITERIO_CLASSIFICACAO" (
    "CO_CRITERIO" character varying(40) NOT NULL,
    "NO_CRITERIO" character varying(200) NOT NULL,
    "TP_VALOR" character varying(10) NOT NULL,
    "TP_DIRECAO_PADRAO" character varying(20) NOT NULL,
    "DS_ORIGEM" character varying(300) NOT NULL,
    "NU_ORDEM" smallint NOT NULL,
    "ST_ATIVO" character varying(1) DEFAULT 'S'::character varying NOT NULL,
    CONSTRAINT "CK_CRITERIOCLASSIF_COCRITERIO" CHECK ((("CO_CRITERIO")::text ~ '^[A-Z0-9_]{2,40}$'::text)),
    CONSTRAINT "CK_CRITERIOCLASSIF_STATIVO" CHECK ((("ST_ATIVO")::text = ANY (ARRAY[('S'::character varying)::text, ('N'::character varying)::text]))),
    CONSTRAINT "CK_CRITERIOCLASSIF_TPDIRECAO" CHECK ((("TP_DIRECAO_PADRAO")::text = ANY (ARRAY[('SIM_PRIMEIRO'::character varying)::text, ('NAO_PRIMEIRO'::character varying)::text, ('MAIOR_PRIMEIRO'::character varying)::text, ('MENOR_PRIMEIRO'::character varying)::text]))),
    CONSTRAINT "CK_CRITERIOCLASSIF_TPVALOR" CHECK ((("TP_VALOR")::text = ANY (ARRAY[('BOOLEANO'::character varying)::text, ('NUMERO'::character varying)::text])))
);

CREATE TABLE public."TB_CRONOGRAMA_MONIT_INDIG" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    monitoramento_id uuid NOT NULL,
    ordem integer NOT NULL,
    atividade text NOT NULL,
    tipo_atividade text,
    data_inicio date NOT NULL,
    data_fim date NOT NULL,
    concluida boolean,
    observacao text,
    origem text DEFAULT 'MANUAL'::text NOT NULL,
    confianca_extracao numeric(5,2),
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "CK_CRONOG_MONIT_DATA_ETAPA" CHECK (((data_inicio >= '2015-01-01'::date) AND (data_inicio <= '2100-12-31'::date) AND ((data_fim IS NULL) OR ((data_fim >= '2015-01-01'::date) AND (data_fim <= '2100-12-31'::date))))),
    CONSTRAINT monitoramento_cronograma_confianca_valida CHECK (((confianca_extracao IS NULL) OR ((confianca_extracao >= (0)::numeric) AND (confianca_extracao <= (100)::numeric)))),
    CONSTRAINT monitoramento_cronograma_datas_validas CHECK ((data_fim >= data_inicio)),
    CONSTRAINT monitoramento_cronograma_origem_valida CHECK ((origem = ANY (ARRAY['PDF'::text, 'MANUAL'::text, 'AJUSTE'::text, 'ERRATA'::text])))
);

CREATE TABLE public."TB_HORA_NASCIMENTO_CANDIDATO" (
    "CO_ANALISE_CURRICULAR" uuid NOT NULL,
    "CO_MONITORAMENTO" uuid NOT NULL,
    "HR_NASCIMENTO" time(0) without time zone NOT NULL,
    "CO_USUARIO_ATUALIZACAO" uuid,
    "DT_ATUALIZACAO" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."TB_ENTREVISTA" (
    "CO_ENTREVISTA" uuid DEFAULT gen_random_uuid() NOT NULL,
    "CO_AREA" text NOT NULL,
    "CO_MONITORAMENTO" uuid,
    "CO_ANALISE_CURRICULAR" uuid,
    "TP_LIGACAO_ANALISE" text,
    "NO_UNIDADE" text NOT NULL,
    "DS_EDITAL" text NOT NULL,
    "CO_VAGA" text NOT NULL,
    "NO_CANDIDATO" text NOT NULL,
    "CO_CANDIDATO" text,
    "DS_MODALIDADE" text,
    "NO_CARGO" text,
    "VL_NOTA_TOTAL" numeric(6,2),
    "TP_PARECER" text DEFAULT 'SEM_PARECER'::text NOT NULL,
    "ST_COMPARECEU" character varying(1),
    "DS_LINK_PLANILHA" text,
    "TP_ORIGEM" text DEFAULT 'planilha'::text NOT NULL,
    "DS_CHAVE_ORIGEM" text NOT NULL,
    "CO_SYNC" text,
    "ST_ATIVO" character varying(1) DEFAULT 'S'::character varying NOT NULL,
    "DT_CRIACAO" timestamp with time zone DEFAULT now() NOT NULL,
    "DT_ATUALIZACAO" timestamp with time zone DEFAULT now() NOT NULL,
    "CO_ROTEIRO" uuid,
    "NU_BANCA" smallint,
    "DS_JUSTIFICATIVA_BANCA" text,
    "DT_CONCLUSAO" timestamp with time zone,
    "CO_USUARIO_CONCLUSAO" uuid,
    CONSTRAINT "CK_ENTREVISTA_CONCLUSAO" CHECK ((("DT_CONCLUSAO" IS NOT NULL) OR ("CO_USUARIO_CONCLUSAO" IS NULL))),
    CONSTRAINT "CK_ENTREVISTA_DSJUSTIFICATIVABANCA" CHECK ((COALESCE(length("DS_JUSTIFICATIVA_BANCA"), 0) <= 4000)),
    CONSTRAINT "CK_ENTREVISTA_STATIVO" CHECK ((("ST_ATIVO")::text = ANY (ARRAY[('S'::character varying)::text, ('N'::character varying)::text]))),
    CONSTRAINT "CK_ENTREVISTA_STCOMPARECEU" CHECK ((("ST_COMPARECEU")::text = ANY (ARRAY[('S'::character varying)::text, ('N'::character varying)::text]))),
    CONSTRAINT "CK_ENTREVISTA_TAMANHOS" CHECK (((length("NO_UNIDADE") <= 200) AND (length("DS_EDITAL") <= 120) AND (length("CO_VAGA") <= 60) AND (length("NO_CANDIDATO") <= 200) AND (COALESCE(length("CO_CANDIDATO"), 0) <= 60) AND (COALESCE(length("DS_MODALIDADE"), 0) <= 300) AND (COALESCE(length("NO_CARGO"), 0) <= 400) AND (COALESCE(length("DS_LINK_PLANILHA"), 0) <= 500))),
    CONSTRAINT "CK_ENTREVISTA_TPLIGACAO" CHECK (((("CO_ANALISE_CURRICULAR" IS NULL) AND ("TP_LIGACAO_ANALISE" IS NULL)) OR (("CO_ANALISE_CURRICULAR" IS NOT NULL) AND ("TP_LIGACAO_ANALISE" = ANY (ARRAY['codigo'::text, 'nome'::text]))))),
    CONSTRAINT "CK_ENTREVISTA_TPORIGEM" CHECK (("TP_ORIGEM" = ANY (ARRAY['planilha'::text, 'sistema'::text]))),
    CONSTRAINT "CK_ENTREVISTA_TPPARECER" CHECK (("TP_PARECER" = ANY (ARRAY['APTO'::text, 'INAPTO'::text, 'SEM_PARECER'::text])))
);

CREATE TABLE public."TB_ENTREVISTA_NOTA" (
    "CO_ENTREVISTA" uuid NOT NULL,
    "NU_ORDEM" smallint NOT NULL,
    "DS_CRITERIO" text NOT NULL,
    "VL_NOTA" numeric(5,2),
    CONSTRAINT "CK_ENTREVISTANOTA_NUORDEM" CHECK ((("NU_ORDEM" >= 1) AND ("NU_ORDEM" <= 20))),
    CONSTRAINT "CK_ENTREVISTANOTA_TAMANHO" CHECK (((length("DS_CRITERIO") >= 1) AND (length("DS_CRITERIO") <= 600)))
);

CREATE TABLE public."TB_DESEMPATE_CLASSIFICACAO" (
    "CO_DESEMPATE_CLASSIFICACAO" uuid DEFAULT gen_random_uuid() NOT NULL,
    "CO_MONITORAMENTO" uuid NOT NULL,
    "TP_LISTA" character varying(20) NOT NULL,
    "CO_VAGA" character varying(60) NOT NULL,
    "DS_CHAVE_GRUPO" text NOT NULL,
    "TP_METODO" character varying(10) NOT NULL,
    "DS_SEMENTE" character varying(200),
    "TP_ORIGEM_SEMENTE" character varying(10),
    "DS_ORDEM" jsonb NOT NULL,
    "DS_JUSTIFICATIVA" character varying(2000),
    "ST_ATIVO" character varying(1) DEFAULT 'S'::character varying NOT NULL,
    "CO_USUARIO" uuid NOT NULL,
    "DT_REGISTRO" timestamp with time zone DEFAULT now() NOT NULL,
    "CO_USUARIO_DESATIVACAO" uuid,
    "DT_DESATIVACAO" timestamp with time zone,
    CONSTRAINT "CK_DESEMPATECLASSIF_DESATIVACAO" CHECK ((((("ST_ATIVO")::text = 'N'::text) = ("DT_DESATIVACAO" IS NOT NULL)) AND (("DT_DESATIVACAO" IS NULL) = ("CO_USUARIO_DESATIVACAO" IS NULL)))),
    CONSTRAINT "CK_DESEMPATECLASSIF_MANUAL" CHECK (((("TP_METODO")::text <> 'MANUAL'::text) OR ((length((COALESCE("DS_JUSTIFICATIVA", ''::character varying))::text) >= 10) AND (length((COALESCE("DS_JUSTIFICATIVA", ''::character varying))::text) <= 2000)))),
    CONSTRAINT "CK_DESEMPATECLASSIF_ORDEM" CHECK (((jsonb_typeof("DS_ORDEM") = 'array'::text) AND ((jsonb_array_length("DS_ORDEM") >= 2) AND (jsonb_array_length("DS_ORDEM") <= 200)))),
    CONSTRAINT "CK_DESEMPATECLASSIF_SORTEIO" CHECK ((((("TP_METODO")::text = 'SORTEIO'::text) = ("DS_SEMENTE" IS NOT NULL)) AND (("DS_SEMENTE" IS NULL) = ("TP_ORIGEM_SEMENTE" IS NULL)) AND (("TP_ORIGEM_SEMENTE" IS NULL) OR (("TP_ORIGEM_SEMENTE")::text = ANY (ARRAY[('SERVIDOR'::character varying)::text, ('INFORMADA'::character varying)::text]))) AND (("DS_SEMENTE" IS NULL) OR ((length(("DS_SEMENTE")::text) >= 4) AND (length(("DS_SEMENTE")::text) <= 200))))),
    CONSTRAINT "CK_DESEMPATECLASSIF_STATIVO" CHECK ((("ST_ATIVO")::text = ANY (ARRAY[('S'::character varying)::text, ('N'::character varying)::text]))),
    CONSTRAINT "CK_DESEMPATECLASSIF_TPLISTA" CHECK ((("TP_LISTA")::text = ANY (ARRAY[('PRELIMINAR'::character varying)::text, ('FINAL'::character varying)::text]))),
    CONSTRAINT "CK_DESEMPATECLASSIF_TPMETODO" CHECK ((("TP_METODO")::text = ANY (ARRAY[('SORTEIO'::character varying)::text, ('MANUAL'::character varying)::text])))
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

ALTER TABLE ONLY public."TB_MONITORAMENTO_INDIGENA"
    ADD CONSTRAINT monitoramento_indigena_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public."TB_QUADRO_VAGA_EDITAL"
    ADD CONSTRAINT "PK_TB_QUADRO_VAGA_EDITAL" PRIMARY KEY ("CO_QUADRO_VAGA");

ALTER TABLE ONLY public."TB_ANALISE_CURRICULAR"
    ADD CONSTRAINT analises_curriculares_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public."TB_SELECAO_VAGA"
    ADD CONSTRAINT "PK_TB_SELECAO_VAGA" PRIMARY KEY ("CO_SELECAO_VAGA");

ALTER TABLE ONLY public."TB_EMPREGARE_VAGA"
    ADD CONSTRAINT "PK_TB_EMPREGARE_VAGA" PRIMARY KEY ("CO_VAGA");

ALTER TABLE ONLY public."TB_EMPREGARE_CANDIDATO"
    ADD CONSTRAINT "PK_TB_EMPREGARE_CANDIDATO" PRIMARY KEY ("CO_EMPREGARE_CANDIDATO");

ALTER TABLE ONLY public."TB_TAREFA_AGENDADA"
    ADD CONSTRAINT "PK_TB_TAREFA_AGENDADA" PRIMARY KEY ("NO_TAREFA");

ALTER TABLE ONLY public."TB_LISTA_CLASSIFICACAO"
    ADD CONSTRAINT "PK_TB_LISTA_CLASSIFICACAO" PRIMARY KEY ("CO_LISTA_CLASSIFICACAO");

ALTER TABLE ONLY public."TB_AJUSTE_PONTUACAO_RECURSO"
    ADD CONSTRAINT "PK_TB_AJUSTE_PONTUACAO_RECURSO" PRIMARY KEY ("CO_AJUSTE_PONTUACAO");

ALTER TABLE ONLY public."TB_CRITERIO_CLASSIFICACAO"
    ADD CONSTRAINT "PK_TB_CRITERIO_CLASSIFICACAO" PRIMARY KEY ("CO_CRITERIO");

ALTER TABLE ONLY public."TB_CRONOGRAMA_MONIT_INDIG"
    ADD CONSTRAINT monitoramento_indigena_cronograma_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public."TB_HORA_NASCIMENTO_CANDIDATO"
    ADD CONSTRAINT "PK_TB_HORA_NASCIMENTO_CANDIDATO" PRIMARY KEY ("CO_ANALISE_CURRICULAR");

ALTER TABLE ONLY public."TB_ENTREVISTA"
    ADD CONSTRAINT "PK_TB_ENTREVISTA" PRIMARY KEY ("CO_ENTREVISTA");

ALTER TABLE ONLY public."TB_ENTREVISTA_NOTA"
    ADD CONSTRAINT "PK_TB_ENTREVISTA_NOTA" PRIMARY KEY ("CO_ENTREVISTA", "NU_ORDEM");

ALTER TABLE ONLY public."TB_DESEMPATE_CLASSIFICACAO"
    ADD CONSTRAINT "PK_TB_DESEMPATE_CLASSIFICACAO" PRIMARY KEY ("CO_DESEMPATE_CLASSIFICACAO");

ALTER TABLE ONLY public."TB_PERFIL_USUARIO"
    ADD CONSTRAINT perfis_usuarios_pkey PRIMARY KEY (id);

CREATE FUNCTION private."FC_EH_TREINAMENTO"(p_marca text) RETURNS boolean
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    SET search_path TO ''
    AS $$
  select coalesce(p_marca, 'N') = 'S';
$$;

CREATE FUNCTION private."FC_EDITAL_EH_TREINAMENTO"(p_edital uuid) RETURNS boolean
    LANGUAGE sql STABLE PARALLEL SAFE
    SET search_path TO ''
    AS $$
  select coalesce((select private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
                     from public."TB_MONITORAMENTO_INDIGENA" m
                    where m.id = p_edital), false);
$$;

CREATE FUNCTION private."FC_NUMERO_EDITAL"(p_texto text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    SET search_path TO ''
    AS $$
  -- "06/2026", "6/2026 (sanitarista)", "Edital 06/2026" -> "6/2026"
  select ltrim(m[1], '0') || '/' || m[2]
    from regexp_match(coalesce(p_texto, ''), '(\d{1,4})\s*/\s*(\d{4})') m;
$$;

CREATE FUNCTION private."FC_TOKENS_VAGA"(p_texto text) RETURNS text[]
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $_$
  select coalesce(array_agg(distinct t), '{}')
    from regexp_split_to_table(
           regexp_replace(
             translate(lower(
               regexp_replace(
                 regexp_replace(
                   regexp_replace(regexp_replace(coalesce(p_texto, ''), '\s+em\s+excel.*$', '', 'i'),
                                  '\([^)]*$', ' '),
                   '([a-záàâãäéèêëíìîïóòôõöúùûüç])(AC|AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO)(?![A-Za-zÀ-ÿ0-9])',
                   '\1 \2', 'g'),
                 '\([^)]*\)', ' ', 'g')),
               'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
             '[^a-z0-9]+', ' ', 'g'),
           ' ') t
   where t <> '' and t not in ('a', 'as', 'o', 'os', 'e', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'para');
$_$;

CREATE FUNCTION private."FC_QUADRO_DA_VAGA"(p_edital uuid, p_nome_vaga text) RETURNS uuid
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $_$
  with n as (select private."FC_TOKENS_VAGA"(p_nome_vaga) t),
  q as (
    select c."CO_QUADRO_VAGA" id, private."FC_TOKENS_VAGA"(c."NO_CARGO") tc, private."FC_TOKENS_VAGA"(c."NO_LOTACAO") tl
      from public."TB_QUADRO_VAGA_EDITAL" c
     where c."CO_MONITORAMENTO" = p_edital and c."ST_REGISTRO_ATIVO" = 'S'
  ),
  -- Cargo inteiro contido no nome da vaga; fica o cargo mais específico.
  cargo as (
    select q.id, cardinality(q.tc) nc, cardinality(q.tl) nl, cardinality(q.tl) > 0 and q.tl <@ n.t lotacao,
           -- O que sobra do nome além do cargo ("polo base bauru") não pode contradizer a lotação da linha.
           cardinality(q.tl) = 0 or array(
             select t from unnest(n.t) t
              where not t = any (q.tc) and t !~ '^\d+$' and t not in ('vaga', 'vagas', 'cadastro', 'reserva', 'cr')
           ) <@ q.tl compativel
      from q, n where cardinality(q.tc) > 0 and q.tc <@ n.t
  ),
  melhor as (select * from cargo where nc = (select max(nc) from cargo)),
  -- A lotação no nome decide entre as linhas do mesmo cargo.
  com_lotacao as (select * from melhor where lotacao and nl = (select max(nl) from melhor where lotacao))
  select case
           when (select count(*) from com_lotacao) = 1 then (select id from com_lotacao)
           when (select count(*) from com_lotacao) = 0 and (select count(*) from melhor) = 1
            and (select compativel from melhor) then (select id from melhor)
         end;
$_$;

CREATE FUNCTION private."FC_TITULO_DA_VAGA_EMPREGARE"(p_texto text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $_$
  select nullif(btrim(
           regexp_replace(
             regexp_replace(
               regexp_replace(
                 regexp_replace(
                   coalesce(substring(coalesce(p_texto, '') from '^Candidatos da vaga [0-9]+ - (.+?) em Excel'), p_texto, ''),
                   '^\s*\[vaga\]\s*', '', 'i'),
                 '\s*-\s*empregare(\s+ats)?\s*$', '', 'i'),
               '\s*(\.\.\.|…)\s*$', ''),
             '\s*\(n[íi]vel [^)]*\)\s*$', '', 'i')), '');
$_$;

CREATE FUNCTION private."FC_TEXTO_DO_CARGO"(p_texto text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select btrim(regexp_replace(
           translate(lower(coalesce(p_texto, '')),
                     'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
                     'aaaaaaeeeeiiiiooooouuuucnyy'),
           '[^a-z0-9]+', ' ', 'g'));
$$;

CREATE FUNCTION private."FC_NUMERO_DO_CARGO"(p_texto text) RETURNS integer
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $_$
  select (substring(private."FC_TEXTO_DO_CARGO"(p_texto) from '^cargo (?:n |no )?([0-9]{1,3})(?: |$)'))::integer;
$_$;

CREATE FUNCTION private."FC_UF_DA_LOTACAO"(p_lotacao text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $_$
  select upper(substring(btrim(coalesce(p_lotacao, '')) from '[-/(]\s*([A-Za-z]{2})\)?$'));
$_$;

CREATE FUNCTION private."FC_QUADRO_PELO_TITULO_EMPREGARE"(p_edital uuid, p_vaga text) RETURNS uuid
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
declare
  v_titulo text;
  v_numero integer;
  v_linhas uuid[];
  v_pelo_nome uuid;
  v_escolha jsonb;
begin
  select private."FC_TITULO_DA_VAGA_EMPREGARE"(v."NO_ARQUIVO") into v_titulo
    from public."TB_EMPREGARE_VAGA" v
   where v."CO_MONITORAMENTO" = p_edital and v."CO_VAGA" = p_vaga;
  if v_titulo is null then
    return null;
  end if;
  v_numero := private."FC_NUMERO_DO_CARGO"(v_titulo);
  v_pelo_nome := private."FC_QUADRO_DA_VAGA"(p_edital, v_titulo);
  if v_numero is null then
    return v_pelo_nome; -- sem "CARGO N": o casamento por palavras de sempre
  end if;

  select coalesce(array_agg(q."CO_QUADRO_VAGA" order by q."NU_ORDEM"), '{}') into v_linhas
    from public."TB_QUADRO_VAGA_EDITAL" q
   where q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S'
     and private."FC_NUMERO_DO_CARGO"(q."NO_CARGO") = v_numero;
  if cardinality(v_linhas) = 0 then
    return null;
  end if;
  if cardinality(v_linhas) = 1 then
    return v_linhas[1];
  end if;
  -- O mesmo cargo em mais de uma lotação: a lotação escrita no título decide.
  if v_pelo_nome = any (v_linhas) then
    return v_pelo_nome;
  end if;

  -- Sem a lotação no título: a UF dos inscritos de cada vaga irmã.
  with linhas as (
    select q."CO_QUADRO_VAGA" as id, private."FC_UF_DA_LOTACAO"(q."NO_LOTACAO") as uf
      from public."TB_QUADRO_VAGA_EDITAL" q
     where q."CO_QUADRO_VAGA" = any (v_linhas)
  ),
  irmas as (
    select v."CO_VAGA" as vaga
      from public."TB_EMPREGARE_VAGA" v
     where v."CO_MONITORAMENTO" = p_edital
       and private."FC_NUMERO_DO_CARGO"(private."FC_TITULO_DA_VAGA_EMPREGARE"(v."NO_ARQUIVO")) = v_numero
  ),
  contagem as (
    select i.vaga, l.id, l.uf,
           (select count(*) from public."TB_EMPREGARE_CANDIDATO" c
             where c."CO_VAGA" = i.vaga and c."ST_REGISTRO_ATIVO" = 'S'
               and upper(btrim(coalesce(c."DS_COLUNA_ORIGINAL" ->> 'ESTADO', ''))) = l.uf) as n
      from irmas i cross join linhas l
  ),
  nota as (
    select c.vaga, c.id, (c.n + 1)::numeric / (sum(c.n) over (partition by c.id) + 2) as s
      from contagem c
  ),
  melhor as (
    select n.vaga, n.id,
           n.s = max(n.s) over (partition by n.vaga) as topo,
           count(*) filter (where true) over (partition by n.vaga, n.s) as empates
      from nota n
  ),
  escolha as (
    select m.vaga, m.id from melhor m where m.topo and m.empates = 1
  )
  select jsonb_build_object(
           'ok', (select count(*) from linhas) = (select count(*) from irmas)
                 and (select count(distinct uf) from linhas where uf is not null) = (select count(*) from linhas)
                 and (select count(*) from escolha) = (select count(*) from irmas)
                 and (select count(distinct id) from escolha) = (select count(*) from linhas),
           'id', (select e.id from escolha e where e.vaga = p_vaga))
    into v_escolha;
  return case when (v_escolha ->> 'ok')::boolean then (v_escolha ->> 'id')::uuid end;
end;
$$;

CREATE FUNCTION private."FC_EMPREGARE_VAGAS_DO_QUADRO"(p_vaga text DEFAULT NULL::text) RETURNS TABLE(vaga text, edital_id uuid, quadro_id uuid, cargo text)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $_$
  with analises as (
    select btrim(a.codigo_vaga) as vaga, a."CO_AREA" as area,
           private."FC_NUMERO_EDITAL"(a.edital) as numero, min(a.nome_vaga) as nome_vaga
      from public."TB_ANALISE_CURRICULAR" a
     where p_vaga is null
       and a.ativo
       and btrim(a.codigo_vaga) ~ '^[0-9]{1,20}$'
     group by 1, 2, 3
    union all
    -- Um código: IN_ANALISECURR_VAGATRIM em vez de varrer a tabela.
    select btrim(a.codigo_vaga) as vaga, a."CO_AREA" as area,
           private."FC_NUMERO_EDITAL"(a.edital) as numero, min(a.nome_vaga) as nome_vaga
      from public."TB_ANALISE_CURRICULAR" a
     where p_vaga is not null
       and a.ativo
       and btrim(a.codigo_vaga) = p_vaga
       and btrim(a.codigo_vaga) ~ '^[0-9]{1,20}$'
     group by 1, 2, 3
  ),
  ligadas as (
    select n.vaga, m.id as edital_id, m.ativo, n.nome_vaga,
           private."FC_QUADRO_DA_VAGA"(m.id, n.nome_vaga) as quadro_id
      from analises n
      join public."TB_MONITORAMENTO_INDIGENA" m
        on m."CO_AREA" = n.area and private."FC_NUMERO_EDITAL"(m.edital) = n.numero
     where exists (select 1 from public."TB_QUADRO_VAGA_EDITAL" q
                    where q."CO_MONITORAMENTO" = m.id and q."ST_REGISTRO_ATIVO" = 'S')
  )
  select distinct on (l.vaga)
         l.vaga, l.edital_id, l.quadro_id,
         coalesce(nullif(concat_ws(' — ', q."NO_CARGO", q."NO_LOTACAO"), ''), l.nome_vaga) as cargo
    from ligadas l
    left join public."TB_QUADRO_VAGA_EDITAL" q on q."CO_QUADRO_VAGA" = l.quadro_id
   order by l.vaga, l.ativo desc nulls last, (l.quadro_id is null), l.edital_id;
$_$;

CREATE FUNCTION private."FC_QUADRO_DA_VAGA_EMPREGARE"(p_edital uuid, p_vaga text) RETURNS public."TB_QUADRO_VAGA_EDITAL"
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select q.*
    from (select coalesce(
                   (select v.quadro_id
                      from private."FC_EMPREGARE_VAGAS_DO_QUADRO"(p_vaga) v
                      join public."TB_QUADRO_VAGA_EDITAL" l
                        on l."CO_QUADRO_VAGA" = v.quadro_id and l."CO_MONITORAMENTO" = p_edital and l."ST_REGISTRO_ATIVO" = 'S'
                     where v.edital_id = p_edital
                     limit 1),
                   private."FC_QUADRO_PELO_TITULO_EMPREGARE"(p_edital, p_vaga)) as id) x
    join public."TB_QUADRO_VAGA_EDITAL" q
      on q."CO_QUADRO_VAGA" = x.id and q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S';
$$;

CREATE FUNCTION private."FC_EXIGIR_AREA_EDITAL"(p_edital_id text) RETURNS void
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if p_edital_id is not null and exists (
    select 1 from public."TB_MONITORAMENTO_INDIGENA" m
     where m.id::text = p_edital_id
       and not private."FC_PODE_VER_EDITAL"(m.id)
  ) then
    raise exception 'Sem permissão para editais desta área ou coordenação' using errcode = '42501';
  end if;
end;
$$;

CREATE FUNCTION private."FC_DADOS_CLASSIFICACAO_EDITAL"(p_edital uuid, p_area text) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_area text := p_area;
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_numero text;
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  v_numero := private."FC_NUMERO_EDITAL"(v_m.edital);
  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade, 'area', v_area, 'numero', v_numero,
                               'treinamento', private."FC_EH_TREINAMENTO"(v_m."ST_TREINAMENTO")),
    'pode_editar', private.pode_recurso('classificacao', 2),
    'regra', private."FC_REGRA_CLASSIFICACAO_JSON"(p_edital),
    'catalogo', (
      select json_agg(json_build_object('codigo', k."CO_CRITERIO", 'nome', k."NO_CRITERIO", 'tipo', k."TP_VALOR",
               'direcao', k."TP_DIRECAO_PADRAO", 'ativo', k."ST_ATIVO" = 'S') order by k."NU_ORDEM")
        from public."TB_CRITERIO_CLASSIFICACAO" k),
    'cronograma', coalesce((
      select json_agg(json_build_object('ordem', c.ordem, 'atividade', c.atividade, 'inicio', c.data_inicio, 'fim', c.data_fim)
             order by c.ordem)
        from public."TB_CRONOGRAMA_MONIT_INDIG" c where c.monitoramento_id = p_edital), '[]'::json),
    'quadro', coalesce((
      select json_agg(json_build_object('id', q."CO_QUADRO_VAGA", 'ordem', q."NU_ORDEM", 'cargo', q."NO_CARGO",
               'lotacao', q."NO_LOTACAO", 'modalidades', q."DS_MODALIDADE_VAGA", 'vagas_imediatas', q."QT_VAGA_IMEDIATA",
               'cadastro_reserva', q."ST_CADASTRO_RESERVA" = 'S') order by q."NU_ORDEM")
        from public."TB_QUADRO_VAGA_EDITAL" q
       where q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S'), '[]'::json),
    'candidatos', coalesce((
      with a as (
        select a.* from public."TB_ANALISE_CURRICULAR" a
         where a."CO_AREA" = v_area and a.ativo and private."FC_NUMERO_EDITAL"(a.edital) = v_numero
      ),
      vq as (
        select n.nome_vaga, private."FC_QUADRO_DA_VAGA"(p_edital, n.nome_vaga) as quadro
          from (select distinct a.nome_vaga from a) n
      )
      select json_agg(json_build_object(
               'analise_id', a.id, 'codigo', a.id_origem, 'nome', a.candidato, 'vaga', a.codigo_vaga,
               'cargo', a.nome_vaga, 'categoria', a.categoria, 'modalidade', a.modalidade_concorrencia, 'pcd', a.pcd,
               'data_nascimento', a.data_nascimento, 'nota_documental', a.nota_final_ajustada, 'nota_art', a.nota_empregare,
               'pontuacao_formacao', a.pontuacao_escolaridade, 'pontuacao_cursos', a.pontuacao_cursos_aperfeicoamento,
               'pontuacao_experiencia', a.pontuacao_experiencia_profissional, 'pontuacao_etnica', a.pontuacao_criterio_etnico,
               'exp_saude_indigena', a.experiencia_saude_indigena_total, 'exp_atencao_basica', a.experiencia_atencao_basica_total,
               'exp_profissional', a.experiencia_profissional_total, 'status', a.status_consolidado, 'etapa', a.etapa,
               'quadro', vq.quadro, 'hora_nascimento', to_char(h."HR_NASCIMENTO", 'HH24:MI:SS'))
             order by a.codigo_vaga, a.candidato)
        from a left join vq on vq.nome_vaga is not distinct from a.nome_vaga
               left join public."TB_HORA_NASCIMENTO_CANDIDATO" h on h."CO_ANALISE_CURRICULAR" = a.id), '[]'::json),
    'entrevistas', coalesce((
      select json_agg(json_build_object(
               'id', e."CO_ENTREVISTA", 'analise_id', e."CO_ANALISE_CURRICULAR", 'nome', e."NO_CANDIDATO",
               'vaga', e."CO_VAGA", 'nota', e."VL_NOTA_TOTAL", 'parecer', e."TP_PARECER", 'compareceu', e."ST_COMPARECEU",
               'ligacao', e."TP_LIGACAO_ANALISE", 'origem', e."TP_ORIGEM",
               'notas', coalesce((select json_agg(json_build_object('ordem', n."NU_ORDEM", 'criterio', n."DS_CRITERIO", 'nota', n."VL_NOTA")
                                         order by n."NU_ORDEM")
                                    from public."TB_ENTREVISTA_NOTA" n where n."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json))
             order by e."CO_VAGA", e."NO_CANDIDATO")
        from public."TB_ENTREVISTA" e
       where e."ST_ATIVO" = 'S'
         and (e."CO_MONITORAMENTO" = p_edital
              or (e."CO_MONITORAMENTO" is null and e."CO_AREA" = v_area
                  and private."FC_NUMERO_EDITAL"(e."DS_EDITAL") = v_numero))), '[]'::json),
    'listas', coalesce((
      select json_agg(private."FC_LISTA_CLASSIFICACAO_JSON"(l."CO_LISTA_CLASSIFICACAO") order by l."DT_GERACAO" desc)
        from (select l."CO_LISTA_CLASSIFICACAO", l."DT_GERACAO"
                from public."TB_LISTA_CLASSIFICACAO" l
               where l."CO_MONITORAMENTO" = p_edital
               order by l."DT_GERACAO" desc limit 60) l), '[]'::json),
    'desempates', coalesce((
      select json_agg(private."FC_DESEMPATE_CLASSIFICACAO_JSON"(d."CO_DESEMPATE_CLASSIFICACAO") order by d."DT_REGISTRO")
        from public."TB_DESEMPATE_CLASSIFICACAO" d
       where d."CO_MONITORAMENTO" = p_edital and d."ST_ATIVO" = 'S'), '[]'::json),
    'ajustes', coalesce((
      select json_agg(private."FC_AJUSTE_PONTUACAO_JSON"(j."CO_AJUSTE_PONTUACAO") order by j."DT_APROVACAO", j."CO_AJUSTE_PONTUACAO")
        from public."TB_AJUSTE_PONTUACAO_RECURSO" j
       where j."CO_MONITORAMENTO" = p_edital and j."TP_SITUACAO" = 'APROVADO'), '[]'::json),
    'ajustes_mudaram_em', (
      select greatest(max(j."DT_APROVACAO"), max(j."DT_CANCELAMENTO") filter (where j."DT_APROVACAO" is not null))
        from public."TB_AJUSTE_PONTUACAO_RECURSO" j
       where j."CO_MONITORAMENTO" = p_edital)
  );
end;
$$;

CREATE FUNCTION public.obter_quadro_de_vagas(p_edital uuid) RETURNS json
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
               'cadastro_reserva', q."ST_CADASTRO_RESERVA" = 'S') order by q."NU_ORDEM")
        from public."TB_QUADRO_VAGA_EDITAL" q
       where q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S'), '[]'::json),
    'origem', (select json_build_object('tipo', q."TP_ORIGEM", 'arquivo', q."DS_ARQUIVO_ORIGEM", 'gravado_em', q."DT_CRIACAO")
                 from public."TB_QUADRO_VAGA_EDITAL" q
                where q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S' limit 1),
    'vinculos', coalesce((
      select json_agg(json_build_object('vaga', v.codigo_vaga, 'cargo', v.cargo,
               'quadro', private."FC_QUADRO_DA_VAGA"(p_edital, v.cargo)) order by v.cargo)
        from (select a.codigo_vaga, min(a.nome_vaga) cargo
                from public."TB_ANALISE_CURRICULAR" a
               where a."CO_AREA" = v_m."CO_AREA" and a.ativo
                 and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(v_m.edital)
               group by a.codigo_vaga) v), '[]'::json)
  );
end;
$$;

CREATE FUNCTION public.salvar_quadro_de_vagas(p_edital uuid, p_dados jsonb) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_linhas jsonb := coalesce(p_dados -> 'linhas', '[]'::jsonb);
  v_origem text := coalesce(nullif(upper(p_dados ->> 'origem'), ''), 'PDF');
  v_arquivo text := left(nullif(btrim(p_dados ->> 'arquivo'), ''), 300);
begin
  if not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital) then
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
              where length(btrim(coalesce(l ->> 'cargo', ''))) not between 1 and 300
                 or coalesce(nullif(l ->> 'vagas_imediatas', '')::integer, 0) not between 0 and 9999
                 or jsonb_typeof(coalesce(l -> 'modalidades', '{}'::jsonb)) <> 'object') then
    raise exception 'Há linha do quadro sem cargo ou com quantidade inválida' using errcode = '22023';
  end if;

  update public."TB_QUADRO_VAGA_EDITAL"
     set "ST_REGISTRO_ATIVO" = 'N', "DT_DESATIVACAO" = now()
   where "CO_MONITORAMENTO" = p_edital and "ST_REGISTRO_ATIVO" = 'S';

  insert into public."TB_QUADRO_VAGA_EDITAL" ("CO_MONITORAMENTO", "NU_ORDEM", "NO_CARGO", "NO_LOTACAO", "DS_MODALIDADE_VAGA",
    "QT_VAGA_IMEDIATA", "ST_CADASTRO_RESERVA", "TP_ORIGEM", "DS_ARQUIVO_ORIGEM", "CO_USUARIO_ATUALIZACAO")
  select p_edital, l.ordem, btrim(l.valor ->> 'cargo'), left(nullif(btrim(l.valor ->> 'lotacao'), ''), 300),
         coalesce(l.valor -> 'modalidades', '{}'::jsonb), coalesce(nullif(l.valor ->> 'vagas_imediatas', '')::integer, 0),
         case when (l.valor ->> 'cadastro_reserva')::boolean then 'S' else 'N' end,
         v_origem, v_arquivo, (select auth.uid())
    from jsonb_array_elements(v_linhas) with ordinality l(valor, ordem);

  return public.obter_quadro_de_vagas(p_edital);
end;
$$;

CREATE FUNCTION public.conferencia_ler_listas_e_quadros() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  -- 20261103181500: a leitura da classificação das conferências sem as análises. A última
  -- atualização das análises e as vagas sem quadro saem das páginas de conferencia_ler_analises,
  -- no robô (scripts/conferencias/regras.py, python/monitora/classificacao/quadro_da_vaga.py).
  with ultimas as (
    select distinct on (l."CO_MONITORAMENTO", l."TP_LISTA")
           l."CO_LISTA_CLASSIFICACAO", l."CO_MONITORAMENTO", l."TP_LISTA", l."DT_GERACAO",
           l."QT_PENDENCIA", l."ST_PUBLICADA", l."DS_RESULTADO"
      from public."TB_LISTA_CLASSIFICACAO" l
     where not private."FC_EDITAL_EH_TREINAMENTO"(l."CO_MONITORAMENTO")
     order by l."CO_MONITORAMENTO", l."TP_LISTA", l."DT_GERACAO" desc, l."CO_LISTA_CLASSIFICACAO" desc
  )
  select jsonb_build_object(
    'schema_version', 1,
    'listas', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', u."CO_LISTA_CLASSIFICACAO", 'edital', u."CO_MONITORAMENTO", 'area', m."CO_AREA",
          'tipo', u."TP_LISTA", 'gerada_em', u."DT_GERACAO", 'pendencias', u."QT_PENDENCIA",
          'publicada', u."ST_PUBLICADA" = 'S',
          'vagas_pendentes', (select coalesce(jsonb_agg(distinct p ->> 'vaga'), '[]'::jsonb)
                                from jsonb_array_elements(case when jsonb_typeof(u."DS_RESULTADO" -> 'pendencias') = 'array'
                                                               then u."DS_RESULTADO" -> 'pendencias' else '[]'::jsonb end) p
                               where p ->> 'vaga' is not null))), '[]'::jsonb)
        from ultimas u
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = u."CO_MONITORAMENTO"
    ),
    'ajustes', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', j."CO_AJUSTE_PONTUACAO", 'edital', j."CO_MONITORAMENTO", 'area', m."CO_AREA",
          'tipo', j."TP_LISTA", 'aprovado_em', j."DT_APROVACAO")), '[]'::jsonb)
        from public."TB_AJUSTE_PONTUACAO_RECURSO" j
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = j."CO_MONITORAMENTO"
       where j."TP_SITUACAO" = 'APROVADO'
         and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
    ),
    'quadros', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', q."CO_QUADRO_VAGA", 'edital', q."CO_MONITORAMENTO", 'cargo', q."NO_CARGO", 'lotacao', q."NO_LOTACAO")
          order by q."CO_MONITORAMENTO", q."CO_QUADRO_VAGA"), '[]'::jsonb)
        from public."TB_QUADRO_VAGA_EDITAL" q
       where q."ST_REGISTRO_ATIVO" = 'S'
    )
  );
$$;

COMMENT ON FUNCTION private."FC_DADOS_CLASSIFICACAO_EDITAL"(p_edital uuid, p_area text) IS 'O que o motor de classificação precisa de um edital (json), sem conferir permissão: regra e versões, catálogo, cronograma, quadro, análises (sem CPF, com a hora de nascimento da certidão quando informada), entrevistas, listas, desempates, os ajustes da pontuação aprovados em recurso e quando eles mudaram por último. Usada por obter_classificacao_do_edital e obter_dados_previa_ajuste.';

COMMENT ON FUNCTION private."FC_QUADRO_DA_VAGA_EMPREGARE"(p_edital uuid, p_vaga text) IS 'A linha do quadro de vagas de uma vaga da Empregare no edital: pelo nome_vaga da análise curricular (planilha, FC_EMPREGARE_VAGAS_DO_QUADRO) e, sem ele, pelo título da vaga na Empregare (FC_QUADRO_PELO_TITULO_EMPREGARE, desde 20261013140000). Usada pelo job da pré-classificação (cargo e nível) e pela gravação de cada vaga (NO_CARGO, NO_LOTACAO, quadro).';

COMMENT ON FUNCTION public.obter_quadro_de_vagas(p_edital uuid) IS 'Quadro de vagas vigente do edital, de onde veio e a que linha cada vaga da análise se liga. Núcleo, Calendário ou Entrevistas (leitor) e o edital.';

COMMENT ON FUNCTION public.salvar_quadro_de_vagas(p_edital uuid, p_dados jsonb) IS 'Substitui o quadro de vagas do edital (o anterior fica desativado). p_dados: {origem PDF|MANUAL, arquivo, linhas:[{cargo, lotacao, modalidades, vagas_imediatas, cadastro_reserva}]}. Núcleo ou Calendário (editor) e o edital.';

COMMENT ON FUNCTION public.conferencia_ler_listas_e_quadros() IS 'Conferências (job Python, só service_role): a última lista de classificação de cada edital e tipo (fora do treinamento) com as vagas com empate pendente, os ajustes de recurso aprovados e as linhas ativas do quadro de vagas (id, edital, cargo, lotação), cruas. A vaga sem linha no quadro e a lista final desatualizada são conferidas no robô, com as páginas de conferencia_ler_analises (20261103181500).';
