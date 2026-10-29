/*
  REGRAS PRÓPRIAS DA TRIAGEM (antiga Pré-classificação; decisão de 29/10/2026).

  Onde cada regra da Triagem morava até aqui (e quem lia):
    TH_REGRA_ANALISE."DS_CONFIGURACAO" (regra da Avaliação documental)
      provisoria.eliminacao_automatica  requisitos e motivos de eliminação
      provisoria.nota_declarada / base_da_nota / divergencia_tolerancia
      provisoria.desempate / pergunta_experiencia
      lote                              formação do lote, corte, linha que anda
      blocos[MODALIDADE].perguntas      de onde vem a cota escolhida
    TH_REGRA_CLASSIFICACAO."DS_CONFIGURACAO" (via FC_DOCUMENTAL_DO_EDITAL)
      documental.niveis_por_cargo / nivel_padrao  nível da vaga
      cotas.acumulo, modalidades[].percentual     ordem das cotas
    Leitores: pre_classificacao_ler_editais → scripts/pre_classificacao/ →
    python/monitora/avaliacao_documental/pre_classificacao.py (cálculo).

  Agora: TB_REGRA_TRIAGEM × TH_REGRA_TRIAGEM, versionada, com conferência
  (dupla), formato 1: requisitos, nota, desempate, modalidade, nivel, lote.
  RPCs obter_regra_triagem, salvar_regra_triagem e conferir_regra_triagem,
  com a permissão da regra da análise (coordenação do edital na Avaliação
  documental, configurável em Acessos; o administrador global passa).
  pre_classificacao_ler_editais passa a devolver 'triagem' (e a mudança da
  regra da Triagem entra no "sem_mudanca").

  Migração: a versão 1 de cada edital com regra da análise é a cópia exata do
  que a Triagem usava (assinada pela conta do setor), com a mesma situação de
  conferência. Não muda candidato, lote, ficha nem execução, e não dispara
  cálculo — o 114/2026 (inscrições congeladas) não é recalculado.
  Prova de resultado idêntico: scripts/pre_classificacao/comparar_regra_da_triagem.py.

  Ordem: aplicar esta migration ANTES de mesclar o código (o job novo lê 'triagem').
  Ensaio: supabase/ensaios/20261029160000_regras_proprias_da_triagem.sql
  Rollback: supabase/rollback/20261029160000_regras_proprias_da_triagem.sql
*/
begin;
set local lock_timeout = '5s';

do $$
begin
  if to_regclass('public."TB_REGRA_TRIAGEM"') is not null then
    raise exception 'TB_REGRA_TRIAGEM já existe: conferir antes de aplicar.';
  end if;
  if to_regprocedure('public.pre_classificacao_ler_editais(text[], boolean, boolean, uuid)') is null then
    raise exception 'pre_classificacao_ler_editais (20261020170000) ausente.';
  end if;
  if not exists (select 1 from auth.users where id = 'a01afddb-f64b-47d9-80e8-476a1ed14e43') then
    raise exception 'Conta do setor (Gestão da Informação de Pessoal) ausente.';
  end if;
end;
$$;

-- 1. A regra da Triagem: uma por edital, com histórico de versões ----------------
create table public."TB_REGRA_TRIAGEM" (
  "CO_REGRA_TRIAGEM" uuid not null default gen_random_uuid(),
  "CO_MONITORAMENTO" uuid not null,
  "NU_VERSAO_VIGENTE" integer not null,
  "TP_SITUACAO" varchar(10) not null default 'CONFERIR',
  "CO_USUARIO_ATUALIZACAO" uuid,
  "CO_USUARIO_CONFERENCIA" uuid,
  "DT_CONFERENCIA" timestamptz,
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_REGRA_TRIAGEM" primary key ("CO_REGRA_TRIAGEM"),
  constraint "UK_REGRATRIAGEM_EDITAL" unique ("CO_MONITORAMENTO"),
  constraint "FK_MONITORAMENTO_REGRATRIAGEM" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA"(id),
  constraint "CK_REGRATRIAGEM_NUVERSAO" check ("NU_VERSAO_VIGENTE" >= 1),
  constraint "CK_REGRATRIAGEM_TPSITUACAO" check ("TP_SITUACAO" in ('CONFERIR', 'CONFERIDA')),
  constraint "CK_REGRATRIAGEM_CONFERENCIA" check (
    (("TP_SITUACAO" = 'CONFERIDA') = ("DT_CONFERENCIA" is not null))
    and (("DT_CONFERENCIA" is null) = ("CO_USUARIO_CONFERENCIA" is null)))
);
comment on table public."TB_REGRA_TRIAGEM" is
  'Regra da Triagem (antiga Pré-classificação) de um edital (20261029160000): requisitos e motivos de eliminação, nota (declarada, base, tolerância), desempate, modalidade (perguntas, acúmulo e percentuais das cotas), nível da vaga e formação do lote. Antes moravam na regra da análise (provisoria, lote, bloco MODALIDADE) e na regra da Classificação (documental, cotas). Versão vigente e conferência; o histórico fica em TH_REGRA_TRIAGEM. Escrita só por salvar_regra_triagem e conferir_regra_triagem.';

create table public."TH_REGRA_TRIAGEM" (
  "CO_REGRA_TRIAGEM" uuid not null,
  "NU_VERSAO" integer not null,
  "DS_CONFIGURACAO" jsonb not null,
  "DS_HASH" varchar(64) not null,
  "DS_MOTIVO" varchar(2000) not null,
  "NO_VERSAO" varchar(80),
  "DS_ORIGEM" jsonb,
  "CO_USUARIO" uuid,
  "DT_CRIACAO" timestamptz not null default now(),
  constraint "PK_TH_REGRA_TRIAGEM" primary key ("CO_REGRA_TRIAGEM", "NU_VERSAO"),
  constraint "FK_REGRATRIAGEM_THREGRATRIAGEM" foreign key ("CO_REGRA_TRIAGEM")
    references public."TB_REGRA_TRIAGEM"("CO_REGRA_TRIAGEM"),
  constraint "CK_THREGRATRIAGEM_NUVERSAO" check ("NU_VERSAO" >= 1),
  constraint "CK_THREGRATRIAGEM_CONFIG" check (jsonb_typeof("DS_CONFIGURACAO") = 'object'),
  constraint "CK_THREGRATRIAGEM_DSHASH" check ("DS_HASH" ~ '^[0-9a-f]{64}$'),
  constraint "CK_THREGRATRIAGEM_MOTIVO" check (length(btrim("DS_MOTIVO")) between 10 and 2000),
  constraint "CK_THREGRATRIAGEM_NOVERSAO" check ("NO_VERSAO" is null
    or (length("NO_VERSAO") between 3 and 80 and "NO_VERSAO" = btrim("NO_VERSAO")))
);
comment on table public."TH_REGRA_TRIAGEM" is
  'Histórico imutável das versões da regra da Triagem (20261029160000). DS_ORIGEM: de onde veio a versão migrada (versões da regra da análise e da Classificação).';

alter table public."TB_REGRA_TRIAGEM" enable row level security;
alter table public."TH_REGRA_TRIAGEM" enable row level security;
revoke all on public."TB_REGRA_TRIAGEM", public."TH_REGRA_TRIAGEM" from public, anon, authenticated;

create function private."FC_TG_REGRA_TRIAGEM_IMUTAVEL"()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Regra da Triagem não se apaga (%): crie outra versão', tg_table_name using errcode = '42501';
  end if;
  if tg_table_name = 'TH_REGRA_TRIAGEM' then
    raise exception 'Histórico da regra da Triagem não muda: crie outra versão' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger "TG_REGRATRIAGEM_SEMAPAGAR" before delete on public."TB_REGRA_TRIAGEM"
  for each row execute function private."FC_TG_REGRA_TRIAGEM_IMUTAVEL"();
create trigger "TG_THREGRATRIAGEM_IMUTAVEL" before update or delete on public."TH_REGRA_TRIAGEM"
  for each row execute function private."FC_TG_REGRA_TRIAGEM_IMUTAVEL"();

-- 2. Validação ---------------------------------------------------------------
create function private."FC_VALIDAR_REGRA_TRIAGEM"(p_regra jsonb)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_lista jsonb;
  v_obj jsonb;
  v_item record;
  v_codigos text[] := '{}';
  v_mapa jsonb;
  v_por_nivel jsonb;
  v_tipo text;
  v_desempate jsonb;
  v_pergunta jsonb;
  v_por_vaga jsonb;
begin
  if jsonb_typeof(p_regra) is distinct from 'object' then
    raise exception 'Regra da Triagem inválida: envie um objeto.' using errcode = '22023';
  end if;
  if length(p_regra::text) > 200000 then
    raise exception 'Regra da Triagem grande demais.' using errcode = '22023';
  end if;
  if p_regra -> 'formato' is distinct from '1'::jsonb then
    raise exception 'Versão do formato da regra da Triagem deve ser 1.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(p_regra) k
              where k not in ('formato', 'requisitos', 'nota', 'desempate', 'modalidade', 'nivel', 'lote')) then
    raise exception 'Regra da Triagem: seções requisitos, nota, desempate, modalidade, nivel e lote.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(array['requisitos', 'nota', 'desempate', 'modalidade', 'nivel', 'lote']) k
              where p_regra ? k and jsonb_typeof(p_regra -> k) <> 'object') then
    raise exception 'Regra da Triagem: cada seção é um objeto.' using errcode = '22023';
  end if;

  -- Requisitos: a eliminação automática (as mesmas regras de antes, na Provisória).
  v_lista := coalesce(p_regra #> '{requisitos,eliminacao_automatica}', '[]'::jsonb);
  if jsonb_typeof(v_lista) <> 'array' or jsonb_array_length(v_lista) > 20 then
    raise exception 'Eliminação automática: até 20 regras.' using errcode = '22023';
  end if;
  for v_item in select e.value, e.ordinality from jsonb_array_elements(v_lista) with ordinality e loop
    if jsonb_typeof(v_item.value) <> 'object' or coalesce(v_item.value ->> 'codigo', '') !~ '^[A-Z][A-Z0-9_]{1,29}$' then
      raise exception 'Eliminação automática %: código em maiúsculas.', v_item.ordinality using errcode = '22023';
    end if;
    if (v_item.value ->> 'codigo') = any (v_codigos) then
      raise exception 'Eliminação automática %: código repetido.', v_item.ordinality using errcode = '22023';
    end if;
    v_codigos := v_codigos || (v_item.value ->> 'codigo');
    if (select count(*) from unnest(array['coluna', 'coluna_prefixo', 'pergunta']) k
         where jsonb_typeof(v_item.value -> k) = 'string' and btrim(v_item.value ->> k) <> '') <> 1 then
      raise exception 'Eliminação automática %: diga uma coluna, um prefixo de coluna ou uma pergunta.', v_item.ordinality using errcode = '22023';
    end if;
    if not private."FC_JSON_TEXTOS_OK"(v_item.value -> 'quando', 20) or not private."FC_JSON_TEXTOS_OK"(v_item.value -> 'exceto', 20) then
      raise exception 'Eliminação automática %: quando/exceto com até 20 textos.', v_item.ordinality using errcode = '22023';
    end if;
    if coalesce(jsonb_array_length(case when jsonb_typeof(v_item.value -> 'quando') = 'array' then v_item.value -> 'quando' end), 0)
       + coalesce(jsonb_array_length(case when jsonb_typeof(v_item.value -> 'exceto') = 'array' then v_item.value -> 'exceto' end), 0) = 0 then
      raise exception 'Eliminação automática %: diga os valores que eliminam (quando) ou os que passam (exceto).', v_item.ordinality using errcode = '22023';
    end if;
    if not private."FC_JSON_TEXTO_OK"(v_item.value -> 'motivo', true, 200) then
      raise exception 'Eliminação automática % (motivo): obrigatório, até 200 caracteres.', v_item.ordinality using errcode = '22023';
    end if;
  end loop;

  -- Nota: a nota declarada, a tolerância e a base da nota do corte e da ordem.
  v_obj := coalesce(p_regra -> 'nota', '{}'::jsonb);
  v_lista := coalesce(v_obj -> 'nota_declarada', '[]'::jsonb);
  if jsonb_typeof(v_lista) <> 'array' or jsonb_array_length(v_lista) > 20 then
    raise exception 'Nota declarada: até 20 perguntas.' using errcode = '22023';
  end if;
  for v_item in select d.value, d.ordinality from jsonb_array_elements(v_lista) with ordinality d loop
    if jsonb_typeof(v_item.value) <> 'object' then
      raise exception 'Nota declarada %: inválida.', v_item.ordinality using errcode = '22023';
    end if;
    if coalesce(v_item.value ->> 'parcial', '') not in ('ETNICO', 'FORMACAO', 'CURSOS', 'EXPERIENCIA') then
      raise exception 'Nota declarada %: parcial ETNICO, FORMACAO, CURSOS ou EXPERIENCIA.', v_item.ordinality using errcode = '22023';
    end if;
    if not private."FC_JSON_PERGUNTA_OK"(v_item.value -> 'pergunta', true) then
      raise exception 'Nota declarada % (pergunta): obrigatória, texto ou lista de 1 a 10 textos de até 200 caracteres.', v_item.ordinality using errcode = '22023';
    end if;
    v_tipo := v_item.value ->> 'tipo';
    if v_tipo is null or v_tipo not in ('OPCAO', 'OPCOES_SOMADAS', 'FAIXA_EM_MESES') then
      raise exception 'Nota declarada %: tipo OPCAO, OPCOES_SOMADAS ou FAIXA_EM_MESES.', v_item.ordinality using errcode = '22023';
    end if;
    v_por_nivel := v_item.value -> 'pontos_por_nivel';
    if coalesce(jsonb_typeof(v_por_nivel), 'null') <> 'null' then
      if v_tipo = 'FAIXA_EM_MESES' then
        raise exception 'Nota declarada %: pontos por nível só em OPCAO ou OPCOES_SOMADAS.', v_item.ordinality using errcode = '22023';
      end if;
      if coalesce(jsonb_typeof(v_item.value -> 'pontos'), 'null') <> 'null' then
        raise exception 'Nota declarada %: pontos ou pontos por nível, não os dois.', v_item.ordinality using errcode = '22023';
      end if;
      if jsonb_typeof(v_por_nivel) <> 'object'
         or not exists (select 1 from jsonb_object_keys(v_por_nivel))
         or exists (select 1 from jsonb_each(v_por_nivel) n
                     where n.key not in ('superior', 'tecnico', 'medio', 'fundamental')
                        or not private."FC_JSON_MAPA_DECLARADA_OK"(n.value, 100)) then
        raise exception 'Nota declarada %: pontos por nível (superior, tecnico, medio, fundamental), de 0 a 100 em cada resposta (até 50 respostas).', v_item.ordinality using errcode = '22023';
      end if;
    else
      v_mapa := case when v_tipo = 'FAIXA_EM_MESES' then v_item.value -> 'meses' else v_item.value -> 'pontos' end;
      if not private."FC_JSON_MAPA_DECLARADA_OK"(v_mapa, case when v_tipo = 'FAIXA_EM_MESES' then 1200 else 100 end) then
        raise exception 'Nota declarada %: % de cada resposta (até 50 respostas).', v_item.ordinality,
          case when v_tipo = 'FAIXA_EM_MESES' then 'meses (0 a 1200)' else 'pontos (0 a 100)' end using errcode = '22023';
      end if;
    end if;
    if v_tipo = 'FAIXA_EM_MESES' and not private."FC_JSON_NUMERO_OBRIGATORIO"(v_item.value -> 'pontos_por_mes', 0, 100) then
      raise exception 'Nota declarada %: pontos por mês entre 0 e 100.', v_item.ordinality using errcode = '22023';
    end if;
    if not private."FC_JSON_NUMERO_ENTRE"(v_item.value -> 'teto', 0, 100) then
      raise exception 'Nota declarada %: teto entre 0 e 100.', v_item.ordinality using errcode = '22023';
    end if;
  end loop;
  if not private."FC_JSON_NUMERO_ENTRE"(v_obj -> 'divergencia_tolerancia', 0, 30) then
    raise exception 'Tolerância da divergência entre 0 e 30 pontos.' using errcode = '22023';
  end if;
  if coalesce(jsonb_typeof(v_obj -> 'base_da_nota'), 'null') <> 'null' then
    if jsonb_typeof(v_obj -> 'base_da_nota') <> 'string' or (v_obj ->> 'base_da_nota') not in ('DECLARADA', 'ART') then
      raise exception 'Base da nota do lote: DECLARADA ou ART.' using errcode = '22023';
    end if;
    if v_obj ->> 'base_da_nota' = 'DECLARADA' and jsonb_array_length(v_lista) = 0 then
      raise exception 'Base da nota do lote pela declarada: configure a nota declarada.' using errcode = '22023';
    end if;
  end if;

  -- Desempate da lista (o mesmo de FC_TG_REGRA_ANALISE_F2).
  v_desempate := p_regra #> '{desempate,criterios}';
  v_pergunta := p_regra #> '{desempate,pergunta_experiencia}';
  if v_desempate is not null and jsonb_typeof(v_desempate) <> 'null' then
    if jsonb_typeof(v_desempate) <> 'array' or jsonb_array_length(v_desempate) > 5
       or exists (select 1 from jsonb_array_elements(v_desempate) d
                   where jsonb_typeof(d) <> 'string'
                      or d #>> '{}' not in ('IDOSO', 'EXPERIENCIA_DECLARADA', 'MAIOR_IDADE', 'MAIS_VELHO', 'CANDIDATURA'))
       or (select count(distinct d #>> '{}') from jsonb_array_elements(v_desempate) d) <> jsonb_array_length(v_desempate) then
      raise exception 'Desempate da Triagem: IDOSO, EXPERIENCIA_DECLARADA, MAIOR_IDADE, MAIS_VELHO ou CANDIDATURA, sem repetir.' using errcode = '22023';
    end if;
  end if;
  if not private."FC_JSON_PERGUNTA_OK"(v_pergunta, false) then
    raise exception 'Pergunta da experiência declarada: texto ou lista de 1 a 10 textos de até 200 caracteres.' using errcode = '22023';
  end if;
  if v_desempate @> '["EXPERIENCIA_DECLARADA"]'::jsonb and not private."FC_JSON_PERGUNTA_OK"(v_pergunta, true) then
    raise exception 'Desempate pela experiência declarada: informe a pergunta da experiência.' using errcode = '22023';
  end if;

  -- Modalidade: as perguntas da cota escolhida, o acúmulo e os percentuais das cotas.
  v_obj := coalesce(p_regra -> 'modalidade', '{}'::jsonb);
  if v_obj ? 'perguntas' and (jsonb_typeof(v_obj -> 'perguntas') <> 'array' or jsonb_array_length(v_obj -> 'perguntas') > 20
     or exists (select 1 from jsonb_array_elements(v_obj -> 'perguntas') p where not private."FC_JSON_PERGUNTA_OK"(p, true))) then
    raise exception 'Modalidade: até 20 perguntas, cada uma texto ou lista de textos.' using errcode = '22023';
  end if;
  if coalesce(jsonb_typeof(v_obj -> 'acumulo'), 'null') not in ('null', 'string') then
    raise exception 'Modalidade: acúmulo de cotas é um texto.' using errcode = '22023';
  end if;
  if v_obj ? 'percentuais' and (jsonb_typeof(v_obj -> 'percentuais') <> 'object'
     or exists (select 1 from jsonb_each(v_obj -> 'percentuais') p
                 where p.key !~ '^[A-Z]{2,10}$' or jsonb_typeof(p.value) <> 'number'
                    or (p.value #>> '{}')::numeric not between 0 and 100)) then
    raise exception 'Modalidade: percentual de cada cota (código em maiúsculas) de 0 a 100.' using errcode = '22023';
  end if;

  -- Nível da vaga (para a nota declarada que pontua por nível).
  v_obj := coalesce(p_regra -> 'nivel', '{}'::jsonb);
  if v_obj ? 'niveis_por_cargo' and (jsonb_typeof(v_obj -> 'niveis_por_cargo') <> 'array'
     or jsonb_array_length(v_obj -> 'niveis_por_cargo') > 200
     or exists (select 1 from jsonb_array_elements(v_obj -> 'niveis_por_cargo') n
                 where jsonb_typeof(n) <> 'object'
                    or not private."FC_JSON_TEXTO_OK"(n -> 'termo', true, 200)
                    or coalesce(n ->> 'nivel', '') not in ('superior', 'tecnico', 'medio', 'fundamental'))) then
    raise exception 'Nível por cargo: termo (até 200) e nível superior, tecnico, medio ou fundamental.' using errcode = '22023';
  end if;
  if coalesce(jsonb_typeof(v_obj -> 'nivel_padrao'), 'null') <> 'null'
     and coalesce(v_obj ->> 'nivel_padrao', '') not in ('superior', 'tecnico', 'medio', 'fundamental') then
    raise exception 'Nível padrão: superior, tecnico, medio ou fundamental.' using errcode = '22023';
  end if;

  -- Lote (as mesmas regras de antes) e o tamanho por vaga.
  v_obj := coalesce(p_regra -> 'lote', '{}'::jsonb);
  if coalesce(v_obj ->> 'base', '') not in ('MULTIPLO_VAGAS', 'FIXO', 'NOTA_MINIMA') then
    raise exception 'Lote: múltiplo das vagas, número fixo ou nota mínima.' using errcode = '22023';
  end if;
  if v_obj ->> 'base' = 'MULTIPLO_VAGAS' and not private."FC_JSON_NUMERO_OBRIGATORIO"(v_obj -> 'multiplo', 1, 100) then
    raise exception 'Lote: múltiplo de 1 a 100.' using errcode = '22023';
  end if;
  if v_obj ->> 'base' = 'FIXO' and not private."FC_JSON_NUMERO_OBRIGATORIO"(v_obj -> 'fixo', 1, 100000) then
    raise exception 'Lote: número fixo de 1 a 100.000.' using errcode = '22023';
  end if;
  if v_obj ->> 'base' = 'NOTA_MINIMA' and not private."FC_JSON_NUMERO_OBRIGATORIO"(v_obj -> 'nota_minima', 0, 1000) then
    raise exception 'Lote: nota mínima de 0 a 1.000.' using errcode = '22023';
  end if;
  if not private."FC_JSON_TEXTO_OK"(v_obj -> 'item_edital', false, 40) then
    raise exception 'Lote: item do edital com até 40 caracteres.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(array['inclui_cr', 'por_modalidade', 'inclui_empatados', 'linha_anda', 'publica_reposicao']) k
              where not private."FC_JSON_SIM_NAO_OK"(v_obj, k)) then
    raise exception 'Lote: as opções são sim ou não.' using errcode = '22023';
  end if;
  v_por_vaga := v_obj -> 'por_vaga';
  if v_por_vaga is not null and jsonb_typeof(v_por_vaga) <> 'null' then
    if jsonb_typeof(v_por_vaga) <> 'object'
       or (select count(*) from jsonb_object_keys(v_por_vaga)) > 500
       or exists (select 1 from jsonb_each(v_por_vaga) p
                   where p.key !~ '^[0-9]{1,20}$'
                      or case when jsonb_typeof(p.value) <> 'number' then true
                              else (p.value #>> '{}')::numeric <> trunc((p.value #>> '{}')::numeric)
                                   or (p.value #>> '{}')::numeric not between 1 and 100000 end) then
      raise exception 'Lote por vaga: código da vaga (só dígitos) e tamanho inteiro de 1 a 100.000.' using errcode = '22023';
    end if;
  end if;
end;
$$;

-- 3. Leitura, gravação e conferência (a mesma permissão da regra da análise) -----
create function private."FC_REGRA_TRIAGEM_JSON"(p_edital uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
           'versao', r."NU_VERSAO_VIGENTE",
           'nome', h."NO_VERSAO",
           'situacao', r."TP_SITUACAO",
           'configuracao', h."DS_CONFIGURACAO",
           'hash', h."DS_HASH",
           'atualizada_em', r."DT_ATUALIZACAO",
           'conferida_em', r."DT_CONFERENCIA",
           'versoes', coalesce((
             select json_agg(json_build_object('versao', v."NU_VERSAO", 'nome', v."NO_VERSAO", 'motivo', v."DS_MOTIVO",
                                               'criada_em', v."DT_CRIACAO", 'origem', v."DS_ORIGEM")
                    order by v."NU_VERSAO" desc)
               from public."TH_REGRA_TRIAGEM" v where v."CO_REGRA_TRIAGEM" = r."CO_REGRA_TRIAGEM"), '[]'::json))
    from public."TB_REGRA_TRIAGEM" r
    join public."TH_REGRA_TRIAGEM" h
      on h."CO_REGRA_TRIAGEM" = r."CO_REGRA_TRIAGEM" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
   where r."CO_MONITORAMENTO" = p_edital;
$$;

create function public.obter_regra_triagem(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
  v_papel text := private."FC_PAPEL_AVALIACAO"(p_edital);
begin
  return json_build_object(
    'schema_version', 1,
    'edital', (select json_build_object('id', m.id, 'edital', m.edital, 'area', v_area,
                                        'numero', private."FC_NUMERO_EDITAL"(m.edital))
                 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital),
    'papel', v_papel,
    'pode_coordenar', coalesce(v_papel = 'COORDENADOR', false),
    'regra', private."FC_REGRA_TRIAGEM_JSON"(p_edital));
end;
$$;

create function public.salvar_regra_triagem(
  p_edital uuid, p_configuracao jsonb, p_versao_atual integer, p_motivo text, p_nome text default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_area text := private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
  v_regra public."TB_REGRA_TRIAGEM";
  v_nova integer;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_nome varchar := private."FC_NOME_DA_VERSAO"(p_nome);
  v_uid uuid := (select auth.uid());
begin
  perform private."FC_VALIDAR_REGRA_TRIAGEM"(p_configuracao);
  if v_motivo is null or length(v_motivo) not between 10 and 2000 then
    raise exception 'Informe o motivo da alteração (10 a 2.000 caracteres).' using errcode = '22023';
  end if;
  select * into v_regra from public."TB_REGRA_TRIAGEM" where "CO_MONITORAMENTO" = p_edital for update;
  if v_regra."CO_REGRA_TRIAGEM" is null then
    if coalesce(p_versao_atual, 0) <> 0 then
      raise exception 'A regra da Triagem mudou desde que você abriu; recarregue.' using errcode = 'PT409';
    end if;
    insert into public."TB_REGRA_TRIAGEM" ("CO_MONITORAMENTO", "NU_VERSAO_VIGENTE", "CO_USUARIO_ATUALIZACAO")
    values (p_edital, 1, v_uid)
    returning * into v_regra;
    v_nova := 1;
  else
    if p_versao_atual is distinct from v_regra."NU_VERSAO_VIGENTE" then
      raise exception 'A regra da Triagem mudou desde que você abriu (versão %); recarregue.', v_regra."NU_VERSAO_VIGENTE" using errcode = 'PT409';
    end if;
    v_nova := v_regra."NU_VERSAO_VIGENTE" + 1;
  end if;

  insert into public."TH_REGRA_TRIAGEM" ("CO_REGRA_TRIAGEM", "NU_VERSAO", "DS_CONFIGURACAO", "DS_HASH", "DS_MOTIVO", "CO_USUARIO", "NO_VERSAO")
  values (v_regra."CO_REGRA_TRIAGEM", v_nova, p_configuracao,
          encode(sha256(convert_to(p_configuracao::text, 'UTF8')), 'hex'), v_motivo, v_uid, v_nome);

  -- Versão nova volta a "conferir": o cálculo só usa regra conferida (dupla conferência).
  update public."TB_REGRA_TRIAGEM"
     set "NU_VERSAO_VIGENTE" = v_nova, "TP_SITUACAO" = 'CONFERIR', "CO_USUARIO_CONFERENCIA" = null, "DT_CONFERENCIA" = null,
         "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = v_uid
   where "CO_REGRA_TRIAGEM" = v_regra."CO_REGRA_TRIAGEM";

  return json_build_object('regra', private."FC_REGRA_TRIAGEM_JSON"(p_edital));
end;
$$;

create function public.conferir_regra_triagem(p_edital uuid, p_versao integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_area text := private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
  v_regra public."TB_REGRA_TRIAGEM";
  v_autor uuid;
begin
  select * into v_regra from public."TB_REGRA_TRIAGEM" where "CO_MONITORAMENTO" = p_edital for update;
  if v_regra."CO_REGRA_TRIAGEM" is null then
    raise exception 'O edital ainda não tem regra da Triagem.' using errcode = '22023';
  end if;
  if p_versao is distinct from v_regra."NU_VERSAO_VIGENTE" then
    raise exception 'A regra da Triagem mudou (versão %); confira de novo.', v_regra."NU_VERSAO_VIGENTE" using errcode = 'PT409';
  end if;
  if v_regra."TP_SITUACAO" <> 'CONFERIDA' then
    select h."CO_USUARIO" into v_autor
      from public."TH_REGRA_TRIAGEM" h
     where h."CO_REGRA_TRIAGEM" = v_regra."CO_REGRA_TRIAGEM" and h."NU_VERSAO" = v_regra."NU_VERSAO_VIGENTE";
    if v_autor = (select auth.uid()) and not private.is_master() then
      raise exception 'Dupla conferência: quem salvou a versão % não pode conferi-la. Peça a outra pessoa da coordenação do edital.', v_regra."NU_VERSAO_VIGENTE"
        using errcode = '42501';
    end if;
    update public."TB_REGRA_TRIAGEM"
       set "TP_SITUACAO" = 'CONFERIDA', "CO_USUARIO_CONFERENCIA" = (select auth.uid()), "DT_CONFERENCIA" = now(), "DT_ATUALIZACAO" = now()
     where "CO_REGRA_TRIAGEM" = v_regra."CO_REGRA_TRIAGEM";
  end if;
  return json_build_object('regra', private."FC_REGRA_TRIAGEM_JSON"(p_edital));
end;
$$;

revoke all on function private."FC_VALIDAR_REGRA_TRIAGEM"(jsonb) from public, anon, authenticated;
revoke all on function private."FC_REGRA_TRIAGEM_JSON"(uuid) from public, anon, authenticated;
revoke all on function private."FC_TG_REGRA_TRIAGEM_IMUTAVEL"() from public, anon, authenticated;
revoke all on function public.obter_regra_triagem(uuid) from public, anon;
revoke all on function public.salvar_regra_triagem(uuid, jsonb, integer, text, text) from public, anon;
revoke all on function public.conferir_regra_triagem(uuid, integer) from public, anon;
grant execute on function public.obter_regra_triagem(uuid) to authenticated;
grant execute on function public.salvar_regra_triagem(uuid, jsonb, integer, text, text) to authenticated;
grant execute on function public.conferir_regra_triagem(uuid, integer) to authenticated;

-- 4. Migração das regras de hoje: versão 1 de cada edital, conteúdo idêntico ----
-- Só cópia de configuração: nenhuma linha de candidato, lote, ficha ou execução
-- muda, e nada aqui dispara cálculo (o 114/2026, com inscrições congeladas,
-- continua sem recálculo). A conta é a de
-- python/monitora/avaliacao_documental/regra_da_triagem.py (secao_da_regra_antiga);
-- a prova roda as duas regras em todos os editais e compara o resultado.
with origem as (
  select r."CO_MONITORAMENTO" as edital, r."TP_SITUACAO" as situacao, r."CO_USUARIO_CONFERENCIA" as conferiu,
         r."DT_CONFERENCIA" as conferida_em, r."NU_VERSAO_VIGENTE" as versao_analise,
         h."DS_CONFIGURACAO" as analise,
         coalesce(h."DS_CONFIGURACAO" -> 'provisoria', '{}'::jsonb) as prov,
         private."FC_DOCUMENTAL_DO_EDITAL"(r."CO_MONITORAMENTO") as doc,
         (select c."NU_VERSAO_VIGENTE" from public."TB_REGRA_CLASSIFICACAO" c
           where c."CO_MONITORAMENTO" = r."CO_MONITORAMENTO") as versao_classificacao,
         (select x.b from jsonb_array_elements(case when jsonb_typeof(h."DS_CONFIGURACAO" -> 'blocos') = 'array'
                                                    then h."DS_CONFIGURACAO" -> 'blocos' else '[]'::jsonb end)
                          with ordinality x(b, n)
           where jsonb_typeof(x.b) = 'object' and x.b ->> 'codigo' = 'MODALIDADE' order by x.n limit 1) as bloco
    from public."TB_REGRA_ANALISE" r
    join public."TH_REGRA_ANALISE" h
      on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
),
-- Cada campo só entra se existe na origem (inclusive com valor nulo): assim os
-- padrões do cálculo valem igual. Grupo sem campo nenhum fica de fora.
grupos as (
  select o.*,
         (select coalesce(jsonb_object_agg(c, o.prov -> c), '{}'::jsonb)
            from unnest(array['eliminacao_automatica']) c where o.prov ? c) as requisitos,
         (select coalesce(jsonb_object_agg(c, o.prov -> c), '{}'::jsonb)
            from unnest(array['nota_declarada', 'base_da_nota', 'divergencia_tolerancia']) c where o.prov ? c) as nota,
         (select coalesce(jsonb_object_agg(case c when 'desempate' then 'criterios' else c end, o.prov -> c), '{}'::jsonb)
            from unnest(array['desempate', 'pergunta_experiencia']) c where o.prov ? c) as desempate,
         (case when jsonb_typeof(o.bloco) = 'object' and o.bloco ? 'perguntas'
               then jsonb_build_object('perguntas', o.bloco -> 'perguntas') else '{}'::jsonb end)
         || (select coalesce(jsonb_object_agg(c, o.doc -> 'cotas' -> c), '{}'::jsonb)
               from unnest(array['acumulo', 'percentuais']) c
              where jsonb_typeof(o.doc -> 'cotas') = 'object' and (o.doc -> 'cotas') ? c) as modalidade,
         (select coalesce(jsonb_object_agg(c, o.doc -> c), '{}'::jsonb)
            from unnest(array['niveis_por_cargo', 'nivel_padrao']) c where o.doc ? c) as nivel
    from origem o
),
configuracao as (
  select g.*,
         jsonb_build_object('formato', 1)
         || case when g.requisitos <> '{}'::jsonb then jsonb_build_object('requisitos', g.requisitos) else '{}'::jsonb end
         || case when g.nota <> '{}'::jsonb then jsonb_build_object('nota', g.nota) else '{}'::jsonb end
         || case when g.desempate <> '{}'::jsonb then jsonb_build_object('desempate', g.desempate) else '{}'::jsonb end
         || case when g.modalidade <> '{}'::jsonb then jsonb_build_object('modalidade', g.modalidade) else '{}'::jsonb end
         || case when g.nivel <> '{}'::jsonb then jsonb_build_object('nivel', g.nivel) else '{}'::jsonb end
         || case when g.analise ? 'lote' then jsonb_build_object('lote', g.analise -> 'lote') else '{}'::jsonb end as cfg
    from grupos g
),
regras as (
  insert into public."TB_REGRA_TRIAGEM"
    ("CO_MONITORAMENTO", "NU_VERSAO_VIGENTE", "TP_SITUACAO", "CO_USUARIO_ATUALIZACAO", "CO_USUARIO_CONFERENCIA", "DT_CONFERENCIA")
  select c.edital, 1, c.situacao, 'a01afddb-f64b-47d9-80e8-476a1ed14e43'::uuid, c.conferiu, c.conferida_em
    from configuracao c
  returning "CO_REGRA_TRIAGEM", "CO_MONITORAMENTO"
)
insert into public."TH_REGRA_TRIAGEM"
  ("CO_REGRA_TRIAGEM", "NU_VERSAO", "DS_CONFIGURACAO", "DS_HASH", "DS_MOTIVO", "NO_VERSAO", "DS_ORIGEM", "CO_USUARIO")
select g."CO_REGRA_TRIAGEM", 1, c.cfg, encode(sha256(convert_to(c.cfg::text, 'UTF8')), 'hex'),
       'Regras da Triagem separadas da regra da análise (v' || c.versao_analise || ') e da regra da Classificação'
         || coalesce(' (v' || c.versao_classificacao || ')', ' (sem regra)') || ', sem mudar conteúdo.',
       'Migrada da regra da análise',
       jsonb_build_object('regra_analise_versao', c.versao_analise, 'regra_classificacao_versao', c.versao_classificacao,
                          'migration', '20261029160000_regras_proprias_da_triagem.sql'),
       'a01afddb-f64b-47d9-80e8-476a1ed14e43'::uuid
  from regras g
  join configuracao c on c.edital = g."CO_MONITORAMENTO";

-- 5. O job da Triagem passa a ler a regra da Triagem ----------------------------
CREATE OR REPLACE FUNCTION public.pre_classificacao_ler_editais(p_editais text[] DEFAULT NULL::text[], p_apos_robo boolean DEFAULT false, p_incluir_congelados boolean DEFAULT false, p_liberacao uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_pedidos text[] := array(select btrim(x) from unnest(coalesce(p_editais, '{}')) x where btrim(x) <> '');
  v_ids uuid[];
  v_sync text;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_congelados uuid[] := '{}';
begin
  if cardinality(v_pedidos) > 100 then
    raise exception 'Até 100 editais por execução' using errcode = '22023';
  end if;
  if cardinality(v_pedidos) > 0 then
    -- Cada pedido é o id do edital, o número ("93/2026") ou, sem número, o nome ("FCC").
    select coalesce(array_agg(distinct m.id), '{}') into v_ids
      from public."TB_MONITORAMENTO_INDIGENA" m
      join unnest(v_pedidos) p(texto)
        on m.id::text = lower(p.texto)
        or private."FC_NUMERO_EDITAL"(m.edital) = p.texto
        or lower(btrim(m.edital)) = lower(p.texto);
  elsif p_apos_robo then
    -- Os editais das vagas gravadas na última execução fechada do robô.
    select s."CO_SYNC" into v_sync
      from public."TL_SYNC_EMPREGARE" s
     where s."TP_SITUACAO" in ('CONCLUIDA', 'PARCIAL')
     order by s."DT_INICIO" desc limit 1;
    select coalesce(array_agg(distinct v."CO_MONITORAMENTO"), '{}') into v_ids
      from public."TB_EMPREGARE_VAGA" v
     where v."CO_SYNC" = v_sync and v."CO_MONITORAMENTO" is not null
       and not private."FC_EDITAL_EH_TREINAMENTO"(v."CO_MONITORAMENTO");
  else
    select coalesce(array_agg(distinct v."CO_MONITORAMENTO"), '{}') into v_ids
      from public."TB_EMPREGARE_VAGA" v
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = v."CO_MONITORAMENTO"
     where coalesce(m.ativo, false) and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO");
  end if;

  -- [congeladas] Edital com inscrições congeladas (20261020170000): fica fora (após robô,
  -- normal e refazer lote), salvo liberação válida; o modo seco pede p_incluir_congelados.
  if not coalesce(p_incluir_congelados, false) then
    select coalesce(array_agg(x), '{}') into v_congelados
      from unnest(v_ids) x
     where private."FC_INSCRICOES_CONGELADAS"(x)
       and not private."FC_LIBERACAO_CONGELAMENTO_VALIDA"(p_liberacao, x);
    v_ids := array(select x from unnest(v_ids) x where not x = any (v_congelados));
  end if;

  return jsonb_build_object(
    'hoje', v_hoje,
    'sync', v_sync,
    'congelados', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id, 'rotulo', private."FC_ROTULO_DO_EDITAL"(m.edital), 'pedido', cardinality(v_pedidos) > 0)
             order by private."FC_ROTULO_DO_EDITAL"(m.edital), m.id)
        from public."TB_MONITORAMENTO_INDIGENA" m
       where m.id = any (v_congelados)), '[]'::jsonb),
    'nao_encontrados', coalesce((
      select jsonb_agg(p.texto order by p.texto)
        from unnest(v_pedidos) p(texto)
       where not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m
                          where m.id::text = lower(p.texto)
                             or private."FC_NUMERO_EDITAL"(m.edital) = p.texto
                             or lower(btrim(m.edital)) = lower(p.texto))), '[]'::jsonb),
    'editais', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id,
               'rotulo', private."FC_ROTULO_DO_EDITAL"(m.edital),
               'area', m."CO_AREA",
               'ativo', coalesce(m.ativo, false),
               'treinamento', private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO"),
               'congelado', private."FC_INSCRICOES_CONGELADAS"(m.id),
               'regra', (select jsonb_build_object('versao', r."NU_VERSAO_VIGENTE", 'situacao', r."TP_SITUACAO",
                                                   'configuracao', private."FC_REGRA_COM_DATA_LIMITE"(h."DS_CONFIGURACAO", m.id))
                           from public."TB_REGRA_ANALISE" r
                           join public."TH_REGRA_ANALISE" h
                             on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
                          where r."CO_MONITORAMENTO" = m.id),
               'documental', private."FC_DOCUMENTAL_DO_EDITAL"(m.id),
               -- A regra própria da Triagem (20261029160000): é ela que o cálculo usa.
               'triagem', (select jsonb_build_object('versao', t."NU_VERSAO_VIGENTE", 'situacao', t."TP_SITUACAO",
                                                     'configuracao', ht."DS_CONFIGURACAO")
                             from public."TB_REGRA_TRIAGEM" t
                             join public."TH_REGRA_TRIAGEM" ht
                               on ht."CO_REGRA_TRIAGEM" = t."CO_REGRA_TRIAGEM" and ht."NU_VERSAO" = t."NU_VERSAO_VIGENTE"
                            where t."CO_MONITORAMENTO" = m.id),
               -- O cronograma: o job congela a declarada depois do fim das inscrições.
               'cronograma', coalesce((
                 select jsonb_agg(jsonb_build_object('atividade', c.atividade, 'inicio', c.data_inicio, 'fim', c.data_fim)
                        order by c.ordem)
                   from public."TB_CRONOGRAMA_MONIT_INDIG" c where c.monitoramento_id = m.id), '[]'::jsonb),
               -- Refazer o lote do zero: ninguém analisado e TODAS as fichas do edital intocadas
               -- (FC_FICHAS_INICIADAS = 0); fichas_iniciadas vai para a mensagem da recusa (20261013110000).
               'fichas_iniciadas', fi.n,
               'refazer_permitido', fi.n = 0
                                    and not exists (select 1 from public."TB_PRE_CLASSIFICACAO" a
                                                     where a."CO_MONITORAMENTO" = m.id and a."TP_SITUACAO" = 'ANALISADO'),
               -- [sem-mudanca] Só no fim do robô: nada mudou desde a última pré-classificação
               -- CONCLUÍDA de hoje que processou o edital (o job pula o edital).
               'sem_mudanca', p_apos_robo and cardinality(v_pedidos) = 0 and exists (
                 select 1
                   from public."TL_PRE_CLASSIFICACAO" l
                  where l."TP_SITUACAO" = 'CONCLUIDA'
                    and (l."DT_INICIO" at time zone 'America/Sao_Paulo')::date = v_hoje
                    and l."DS_EDITAL" @> jsonb_build_array(jsonb_build_object('edital', m.id, 'situacao', 'PROCESSADO'))
                    and l."DT_INICIO" > coalesce((
                          select max(c."DT_ATUALIZACAO")
                            from public."TB_EMPREGARE_VAGA" v
                            join public."TB_EMPREGARE_CANDIDATO" c on c."CO_VAGA" = v."CO_VAGA"
                           where v."CO_MONITORAMENTO" = m.id), '-infinity'::timestamptz)
                    and l."DT_INICIO" > coalesce((
                          select max(greatest(d."DT_CRIACAO", d."DT_ATUALIZACAO", d."DT_REVOGACAO"))
                            from public."TB_DECISAO_LOTE" d where d."CO_MONITORAMENTO" = m.id), '-infinity'::timestamptz)
                    and l."DT_INICIO" > coalesce((
                          select greatest(r."DT_CRIACAO", r."DT_ATUALIZACAO", r."DT_CONFERENCIA")
                            from public."TB_REGRA_ANALISE" r where r."CO_MONITORAMENTO" = m.id), '-infinity'::timestamptz)
                    and l."DT_INICIO" > coalesce((
                          select greatest(t."DT_CRIACAO", t."DT_ATUALIZACAO", t."DT_CONFERENCIA")
                            from public."TB_REGRA_TRIAGEM" t where t."CO_MONITORAMENTO" = m.id), '-infinity'::timestamptz)
                    and l."DT_INICIO" > coalesce((
                          select max(greatest(q."DT_CRIACAO", q."DT_DESATIVACAO"))
                            from public."TB_QUADRO_VAGA_EDITAL" q where q."CO_MONITORAMENTO" = m.id), '-infinity'::timestamptz)),
               -- Só os metadados da vaga: o cargo e a linha do quadro vêm com os inscritos
               -- (pre_classificacao_ler_candidatos, uma vaga por chamada, desde 20261014110000).
               'vagas', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'codigo', v."CO_VAGA",
                          'situacao_carga', v."TP_SITUACAO",
                          'candidatos_ativos', v."QT_CANDIDATO_ATIVO",
                          'ultima_carga', v."DT_ULTIMA_CARGA",
                          'ultimo_lote', coalesce(pv."NU_ULTIMO_LOTE", 0))
                        order by v."CO_VAGA")
                   from public."TB_EMPREGARE_VAGA" v
                   left join public."TB_PRE_CLASSIF_VAGA" pv on pv."CO_MONITORAMENTO" = m.id and pv."CO_VAGA" = v."CO_VAGA"
                  where v."CO_MONITORAMENTO" = m.id), '[]'::jsonb))
             order by private."FC_ROTULO_DO_EDITAL"(m.edital), m.id)
        from public."TB_MONITORAMENTO_INDIGENA" m
       cross join lateral (select private."FC_FICHAS_INICIADAS"(m.id) as n) fi
       where m.id = any (v_ids)), '[]'::jsonb)
  );
end;
$function$;

commit;
