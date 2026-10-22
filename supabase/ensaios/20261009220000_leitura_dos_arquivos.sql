/*
  ENSAIO de 20261009220000_leitura_dos_arquivos.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela) e confere:
    E1  tabela com RLS e sem grant; as RPCs do robô só para o service_role e a
        conferência privada;
    E2  listar_anexos_para_leitura no 93/2026 (limite 5): só anexos da resposta
        vigente, primeiro quem tem ficha, CPF só como hash de 64 hexadecimais e
        o mesmo hash para o mesmo sal;
    E3  gravar_leituras_de_arquivos grava uma leitura sintética num anexo real,
        troca na segunda gravação e ignora anexo que não existe; o anexo lido
        sai da lista de pendentes da mesma versão e volta em outra versão;
    E4  leitura com número com cara de CPF, item de tipo desconhecido ou texto
        longo é recusada (22023);
    E5  a ficha do candidato (como quem coordena) traz a leitura em "leituras",
        sem nome nem CPF;
    E6  o validador do lançamento aceita recusas_lidas e do_arquivo no formato
        e recusa motivo fora da lista e chave fora do formato.
  Termina em ROLLBACK: nada fica gravado.
*/
begin;

-- ═══ CORPO DA MIGRATION (início) ═══
set local lock_timeout = '10s';

-- 0. Pré-requisito ----------------------------------------------------------------------
do $$
begin
  if to_regprocedure('private."FC_RESPOSTA_VIGENTE_EMPREGARE"(uuid)') is null
     or to_regprocedure('private."FC_VALIDAR_LANCAMENTO_FICHA"(jsonb,jsonb)') is null then
    raise exception 'Aplique antes 20261009210000_ficha_com_a_resposta_vigente.sql.';
  end if;
end;
$$;

-- 1. Tabela -----------------------------------------------------------------------------
create table public."TB_LEITURA_ARQUIVO" (
  "CO_LEITURA_ARQUIVO" uuid not null default gen_random_uuid(),
  "CO_EMPREGARE_RESPOSTA" uuid not null,
  "CO_PERGUNTA_EMPREGARE" varchar(20) not null,
  "NU_ARQUIVO" smallint not null,
  "TP_SITUACAO" varchar(15) not null,
  "TP_METODO" varchar(5),
  "TP_FORMATO" varchar(6),
  "TP_DOCUMENTO" varchar(30),
  "QT_PAGINA" smallint,
  "VL_CONFIANCA_OCR" numeric(4, 3),
  "ST_NOME_CONFERE" varchar(1),
  "ST_CPF_CONFERE" varchar(1),
  "DS_ITEM" jsonb not null default '[]'::jsonb,
  "DS_ALERTA" jsonb not null default '[]'::jsonb,
  "DS_RESUMO" varchar(200),
  "CO_ERRO" varchar(60),
  "DS_HASH_ARQUIVO" varchar(64),
  "NU_VERSAO_EXTRATOR" varchar(20) not null,
  "CO_EXECUCAO" varchar(60),
  "DT_LEITURA" timestamptz not null default now(),
  constraint "PK_TB_LEITURA_ARQUIVO" primary key ("CO_LEITURA_ARQUIVO"),
  constraint "UK_LEITARQ_RESPPERGARQ" unique ("CO_EMPREGARE_RESPOSTA", "CO_PERGUNTA_EMPREGARE", "NU_ARQUIVO"),
  constraint "FK_EMPREGRESP_LEITARQ" foreign key ("CO_EMPREGARE_RESPOSTA")
    references public."TB_EMPREGARE_RESPOSTA" ("CO_EMPREGARE_RESPOSTA") on delete cascade,
  constraint "CK_LEITARQ_COPERGUNTA" check ("CO_PERGUNTA_EMPREGARE" ~ '^[0-9]{1,20}$'),
  constraint "CK_LEITARQ_NUARQUIVO" check ("NU_ARQUIVO" between 1 and 50),
  constraint "CK_LEITARQ_TPSITUACAO" check ("TP_SITUACAO" in ('LIDO', 'ILEGIVEL', 'ERRO', 'NAO_SUPORTADO')),
  constraint "CK_LEITARQ_TPMETODO" check ("TP_METODO" is null or "TP_METODO" in ('TEXTO', 'OCR')),
  constraint "CK_LEITARQ_TPFORMATO" check ("TP_FORMATO" is null or "TP_FORMATO" in ('PDF', 'IMAGEM', 'DOCX', 'TXT', 'OUTRO')),
  constraint "CK_LEITARQ_TPDOCUMENTO" check ("TP_DOCUMENTO" is null or "TP_DOCUMENTO" ~ '^[A-Z][A-Z0-9_]{1,29}$'),
  constraint "CK_LEITARQ_QTPAGINA" check ("QT_PAGINA" is null or "QT_PAGINA" between 0 and 10000),
  constraint "CK_LEITARQ_VLCONFIANCAOCR" check ("VL_CONFIANCA_OCR" is null or "VL_CONFIANCA_OCR" between 0 and 1),
  constraint "CK_LEITARQ_STNOMECONFERE" check ("ST_NOME_CONFERE" is null or "ST_NOME_CONFERE" in ('S', 'N')),
  constraint "CK_LEITARQ_STCPFCONFERE" check ("ST_CPF_CONFERE" is null or "ST_CPF_CONFERE" in ('S', 'N')),
  constraint "CK_LEITARQ_DSITEM" check (jsonb_typeof("DS_ITEM") = 'array' and jsonb_array_length("DS_ITEM") <= 60),
  constraint "CK_LEITARQ_DSALERTA" check (jsonb_typeof("DS_ALERTA") = 'array' and jsonb_array_length("DS_ALERTA") <= 40),
  constraint "CK_LEITARQ_COERRO" check ("CO_ERRO" is null or "CO_ERRO" ~ '^[a-z0-9_]{1,60}$'),
  constraint "CK_LEITARQ_DSHASHARQUIVO" check ("DS_HASH_ARQUIVO" is null or "DS_HASH_ARQUIVO" ~ '^[0-9a-f]{64}$'),
  constraint "CK_LEITARQ_NUVERSAOEXTRATOR" check ("NU_VERSAO_EXTRATOR" ~ '^[0-9A-Za-z._-]{1,20}$'),
  constraint "CK_LEITARQ_COEXECUCAO" check ("CO_EXECUCAO" is null or "CO_EXECUCAO" ~ '^[A-Za-z0-9_.:-]{1,60}$')
);
comment on table public."TB_LEITURA_ARQUIVO" is 'Leitura automática dos anexos do questionário da Empregare pelo robô (Python, leitura_de_arquivos): por anexo, a situação, o método, os itens achados (cursos, títulos, vínculos, identidade, registro) e os alertas, para AJUDAR o avaliador na ficha da Avaliação documental — quem decide é ele. Não guarda o texto do documento, o nome nem o CPF lidos (só se conferem). Só a RPC da ficha devolve.';
comment on column public."TB_LEITURA_ARQUIVO"."CO_LEITURA_ARQUIVO" is 'Identificador da leitura.';
comment on column public."TB_LEITURA_ARQUIVO"."CO_EMPREGARE_RESPOSTA" is 'Resposta do questionário a que o anexo pertence (TB_EMPREGARE_RESPOSTA). O anexo é (resposta, pergunta, arquivo): TB_EMPREGARE_ANEXO é regravada a cada captura e muda de id.';
comment on column public."TB_LEITURA_ARQUIVO"."CO_PERGUNTA_EMPREGARE" is 'PerguntaID da Empregare do anexo (como em TB_EMPREGARE_ANEXO).';
comment on column public."TB_LEITURA_ARQUIVO"."NU_ARQUIVO" is 'Posição do arquivo na pergunta (1 a 50, como em TB_EMPREGARE_ANEXO).';
comment on column public."TB_LEITURA_ARQUIVO"."TP_SITUACAO" is 'LIDO, ILEGIVEL (texto e OCR não trouxeram o bastante), ERRO (download ou arquivo corrompido: o robô tenta de novo) ou NAO_SUPORTADO (ZIP, RAR, DOC antigo…).';
comment on column public."TB_LEITURA_ARQUIVO"."TP_METODO" is 'TEXTO (texto selecionável do PDF, DOCX, TXT) ou OCR (Tesseract em português, PDF escaneado e imagem).';
comment on column public."TB_LEITURA_ARQUIVO"."TP_FORMATO" is 'Formato real do arquivo, pelos primeiros bytes: PDF, IMAGEM, DOCX, TXT ou OUTRO.';
comment on column public."TB_LEITURA_ARQUIVO"."TP_DOCUMENTO" is 'Tipo achado: CERTIFICADO, DIPLOMA, CTPS, DECLARACAO, CONTRATO, CERTIDAO, HOLERITE, RG, CIN, CNH, PASSAPORTE, REGISTRO_<CONSELHO>, OUTRO.';
comment on column public."TB_LEITURA_ARQUIVO"."QT_PAGINA" is 'Páginas do arquivo.';
comment on column public."TB_LEITURA_ARQUIVO"."VL_CONFIANCA_OCR" is 'Confiança média do OCR (0 a 1); null sem OCR.';
comment on column public."TB_LEITURA_ARQUIVO"."ST_NOME_CONFERE" is 'S se o nome do candidato aparece no documento, N se não aparece, null se não deu para saber.';
comment on column public."TB_LEITURA_ARQUIVO"."ST_CPF_CONFERE" is 'S se um CPF do documento é o do candidato, N se há CPF e nenhum é, null sem CPF no documento. O número nunca é guardado.';
comment on column public."TB_LEITURA_ARQUIVO"."DS_ITEM" is 'Itens achados: [{tipo CURSO|TITULO|VINCULO|IDENTIDADE|REGISTRO, campos do tipo (curso, horas, instituicao, conclusao; titulo, curso, instituicao, data; empregador, cargo, inicio, fim, atual, carga_semanal, dias, documento; documento; conselho, ativo, validade), pagina, nome_confere, alertas [{codigo, texto}]}].';
comment on column public."TB_LEITURA_ARQUIVO"."DS_ALERTA" is 'Alertas do arquivo inteiro: [{codigo, texto}] (DOCUMENTO_ILEGIVEL, NOME_DIVERGENTE, CPF_DIVERGENTE, NADA_ENCONTRADO, PAGINAS_NAO_LIDAS, LEITURA_DUVIDOSA).';
comment on column public."TB_LEITURA_ARQUIVO"."DS_RESUMO" is 'Uma linha para a ficha ("3 certificados · 145 h, 60 h, 40 h · nome confere").';
comment on column public."TB_LEITURA_ARQUIVO"."CO_ERRO" is 'Código curto do erro (situação ERRO), sem dado pessoal.';
comment on column public."TB_LEITURA_ARQUIVO"."DS_HASH_ARQUIVO" is 'sha256 do arquivo lido (o arquivo não é guardado; o hash mostra se mudou).';
comment on column public."TB_LEITURA_ARQUIVO"."NU_VERSAO_EXTRATOR" is 'Versão do extrator (VERSAO_DO_EXTRATOR): versão nova relê.';
comment on column public."TB_LEITURA_ARQUIVO"."CO_EXECUCAO" is 'Execução do robô que leu (GitHub Actions).';
comment on column public."TB_LEITURA_ARQUIVO"."DT_LEITURA" is 'Quando foi lido.';
comment on constraint "UK_LEITARQ_RESPPERGARQ" on public."TB_LEITURA_ARQUIVO" is 'Uma leitura por anexo (resposta, pergunta, arquivo).';
comment on constraint "CK_LEITARQ_DSITEM" on public."TB_LEITURA_ARQUIVO" is 'Itens numa lista de até 60.';
comment on constraint "CK_LEITARQ_DSALERTA" on public."TB_LEITURA_ARQUIVO" is 'Alertas numa lista de até 40.';

alter table public."TB_LEITURA_ARQUIVO" enable row level security;
revoke all on public."TB_LEITURA_ARQUIVO" from public, anon, authenticated;

-- 2. Conferência de uma leitura (o que o robô manda) -------------------------------------
create function private."FC_VALIDAR_LEITURA_ARQUIVO"(p jsonb)
returns void
language plpgsql
immutable
set search_path to ''
as $function$
declare
  v_textos text;
begin
  if jsonb_typeof(p) is distinct from 'object' then
    raise exception 'Leitura inválida.' using errcode = '22023';
  end if;
  if coalesce(p ->> 'situacao', '') not in ('LIDO', 'ILEGIVEL', 'ERRO', 'NAO_SUPORTADO')
     or coalesce(p ->> 'metodo', 'TEXTO') not in ('TEXTO', 'OCR')
     or coalesce(p ->> 'formato', 'PDF') not in ('PDF', 'IMAGEM', 'DOCX', 'TXT', 'OUTRO')
     or coalesce(p ->> 'documento', 'OUTRO') !~ '^[A-Z][A-Z0-9_]{1,29}$'
     or coalesce(p ->> 'versao', '') !~ '^[0-9A-Za-z._-]{1,20}$'
     or coalesce(p ->> 'hash', '0000000000000000000000000000000000000000000000000000000000000000') !~ '^[0-9a-f]{64}$'
     or coalesce(p ->> 'erro', 'ok') !~ '^[a-z0-9_]{1,60}$'
     or length(coalesce(p ->> 'resumo', '')) > 200
     or not private."FC_JSON_NUMERO_ENTRE"(p -> 'paginas', 0, 10000)
     or not private."FC_JSON_NUMERO_ENTRE"(p -> 'confianca', 0, 1)
     or jsonb_typeof(coalesce(p -> 'nome_confere', 'null'::jsonb)) not in ('boolean', 'null')
     or jsonb_typeof(coalesce(p -> 'cpf_confere', 'null'::jsonb)) not in ('boolean', 'null') then
    raise exception 'Leitura com campo inválido.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p -> 'itens', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p -> 'itens', '[]'::jsonb)) > 60
     or jsonb_typeof(coalesce(p -> 'alertas', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p -> 'alertas', '[]'::jsonb)) > 40
     or length(coalesce(p -> 'itens', '[]'::jsonb)::text) > 40000 then
    raise exception 'Itens ou alertas da leitura inválidos.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p -> 'itens', '[]'::jsonb)) i
              where jsonb_typeof(i) <> 'object'
                 or coalesce(i ->> 'tipo', '') not in ('CURSO', 'TITULO', 'VINCULO', 'IDENTIDADE', 'REGISTRO')
                 or exists (select 1 from jsonb_each(i) e
                             where jsonb_typeof(e.value) = 'string' and length(e.value #>> '{}') > 200))
     or exists (select 1 from jsonb_array_elements(coalesce(p -> 'alertas', '[]'::jsonb)) a
                 where jsonb_typeof(a) <> 'object' or coalesce(a ->> 'codigo', '') !~ '^[A-Z][A-Z0-9_]{1,29}$'
                    or length(coalesce(a ->> 'texto', '')) > 200) then
    raise exception 'Item ou alerta da leitura fora do formato.' using errcode = '22023';
  end if;
  -- Rede de segurança: nada com cara de CPF (o robô só guarda o booleano).
  v_textos := coalesce(p -> 'itens', '[]'::jsonb)::text || coalesce(p -> 'alertas', '[]'::jsonb)::text || coalesce(p ->> 'resumo', '');
  if v_textos ~ '\d{3}\.?\d{3}\.?\d{3}-?\d{2}' then
    raise exception 'Leitura com número de documento: o robô não guarda CPF.' using errcode = '22023';
  end if;
end;
$function$;
comment on function private."FC_VALIDAR_LEITURA_ARQUIVO"(jsonb) is
  'Confere uma leitura mandada pelo robô (22023): situação, método, formato, tipo, versão, hash e erro nos formatos da tabela, até 60 itens (CURSO, TITULO, VINCULO, IDENTIDADE, REGISTRO; textos até 200) e 40 alertas ({codigo, texto}), resumo até 200 e nada com cara de CPF.';
revoke all on function private."FC_VALIDAR_LEITURA_ARQUIVO"(jsonb) from public, anon, authenticated;

-- 3. O robô pede os anexos a ler ---------------------------------------------------------
create function public.listar_anexos_para_leitura(p_editais text[], p_versao text, p_forcar boolean,
                                                   p_limite integer, p_sal text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_pedidos text[] := array(select btrim(x) from unnest(coalesce(p_editais, '{}')) x where btrim(x) <> '');
  v_ids uuid[];
begin
  if cardinality(v_pedidos) > 100 then
    raise exception 'Até 100 editais por execução' using errcode = '22023';
  end if;
  if coalesce(p_versao, '') !~ '^[0-9A-Za-z._-]{1,20}$' then
    raise exception 'Versão do extrator inválida' using errcode = '22023';
  end if;
  if p_limite is null or p_limite not between 1 and 2000 then
    raise exception 'Limite de 1 a 2.000 anexos' using errcode = '22023';
  end if;
  -- O sal é sorteado pelo robô a cada execução: o hash do CPF não serve fora dela.
  if coalesce(p_sal, '') !~ '^[A-Za-z0-9_-]{16,128}$' then
    raise exception 'Sal inválido' using errcode = '22023';
  end if;
  if cardinality(v_pedidos) > 0 then
    -- Cada pedido é o id do edital, o número ("93/2026") ou, sem número, o nome.
    select coalesce(array_agg(distinct m.id), '{}') into v_ids
      from public."TB_MONITORAMENTO_INDIGENA" m
      join unnest(v_pedidos) p(texto)
        on m.id::text = lower(p.texto)
        or private."FC_NUMERO_EDITAL"(m.edital) = p.texto
        or lower(btrim(m.edital)) = lower(p.texto);
  else
    -- Sem pedido: os editais ativos (fora os de treinamento) com vagas da Empregare e regra.
    select coalesce(array_agg(distinct v."CO_MONITORAMENTO"), '{}') into v_ids
      from public."TB_EMPREGARE_VAGA" v
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = v."CO_MONITORAMENTO"
      join public."TB_REGRA_ANALISE" r on r."CO_MONITORAMENTO" = m.id
     where coalesce(m.ativo, false) and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO");
  end if;

  return (
    with anexos as (
      select a."CO_EMPREGARE_RESPOSTA" as resposta, a."CO_PERGUNTA_EMPREGARE" as pergunta, a."NU_ARQUIVO" as arquivo,
             a."NU_ORDEM" as ordem, a."DS_ENUNCIADO" as enunciado, a."DS_COLUNA" as coluna, a."DS_LINK" as link,
             v."CO_MONITORAMENTO" as edital, v."CO_VAGA" as vaga, c."CO_EMPREGARE_CANDIDATO" as candidato,
             c."NO_CANDIDATO" as nome,
             -- O CPF do cadastro ou, sem ele, a resposta à pergunta do CPF no Excel (só dígitos).
             coalesce(nullif(regexp_replace(coalesce(c."NU_CPF", ''), '\D', '', 'g'), ''),
                      (select regexp_replace(e.value #>> '{}', '\D', '', 'g')
                         from jsonb_each(c."DS_COLUNA_ORIGINAL") e
                        where e.key ~* 'cpf' and jsonb_typeof(e.value) = 'string'
                        order by e.key limit 1)) as cpf,
             exists (select 1 from public."TB_FICHA_ANALISE" f
                      where f."CO_MONITORAMENTO" = v."CO_MONITORAMENTO"
                        and f."CO_EMPREGARE_CANDIDATO" = c."CO_EMPREGARE_CANDIDATO") as com_ficha,
             l."TP_SITUACAO" as situacao, l."NU_VERSAO_EXTRATOR" as versao
        from public."TB_EMPREGARE_VAGA" v
        join public."TB_EMPREGARE_CANDIDATO" c on c."CO_VAGA" = v."CO_VAGA" and c."ST_REGISTRO_ATIVO" = 'S'
        join public."TB_EMPREGARE_ANEXO" a
          on a."CO_EMPREGARE_RESPOSTA" = private."FC_RESPOSTA_VIGENTE_EMPREGARE"(c."CO_EMPREGARE_CANDIDATO")
        left join public."TB_LEITURA_ARQUIVO" l
          on l."CO_EMPREGARE_RESPOSTA" = a."CO_EMPREGARE_RESPOSTA" and l."CO_PERGUNTA_EMPREGARE" = a."CO_PERGUNTA_EMPREGARE"
         and l."NU_ARQUIVO" = a."NU_ARQUIVO"
       where v."CO_MONITORAMENTO" = any (v_ids)
    ),
    pendentes as (
      select * from anexos
       where coalesce(p_forcar, false) or situacao is null or versao <> p_versao or situacao = 'ERRO'
    )
    select jsonb_build_object(
      'nao_encontrados', coalesce((
        select jsonb_agg(p.texto order by p.texto)
          from unnest(v_pedidos) p(texto)
         where not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m
                            where m.id::text = lower(p.texto)
                               or private."FC_NUMERO_EDITAL"(m.edital) = p.texto
                               or lower(btrim(m.edital)) = lower(p.texto))), '[]'::jsonb),
      'editais', coalesce((
        select jsonb_agg(jsonb_build_object('id', m.id, 'rotulo', private."FC_ROTULO_DO_EDITAL"(m.edital),
                                            'regra', h."DS_CONFIGURACAO") order by m.id)
          from public."TB_MONITORAMENTO_INDIGENA" m
          left join public."TB_REGRA_ANALISE" r on r."CO_MONITORAMENTO" = m.id
          left join public."TH_REGRA_ANALISE" h on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
         where m.id = any (v_ids)), '[]'::jsonb),
      'total', (select count(*) from anexos),
      'pendentes', (select count(*) from pendentes),
      -- Primeiro quem tem ficha, depois o que nunca foi lido, versão antiga e, por último, erro.
      'anexos', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'resposta', x.resposta, 'pergunta', x.pergunta, 'arquivo', x.arquivo, 'ordem', x.ordem,
                 'enunciado', x.enunciado, 'coluna', x.coluna, 'link', x.link, 'edital', x.edital, 'vaga', x.vaga,
                 'candidato', x.candidato, 'com_ficha', x.com_ficha, 'nome', x.nome,
                 'cpf', case when length(coalesce(x.cpf, '')) between 9 and 11
                             then encode(sha256(convert_to(p_sal || lpad(x.cpf, 11, '0'), 'UTF8')), 'hex')
                        end)
               order by x.n)
          from (select pd.*, row_number() over (
                         order by pd.com_ficha desc, (pd.situacao is null) desc, (pd.situacao = 'ERRO'),
                                  pd.candidato, pd.ordem nulls last, pd.pergunta, pd.arquivo) as n
                  from pendentes pd) x
         where x.n <= p_limite), '[]'::jsonb)
    )
  );
end;
$function$;
comment on function public.listar_anexos_para_leitura(text[], text, boolean, integer, text) is
  'Para o robô da leitura dos arquivos (Python): os anexos da resposta vigente do questionário (FC_RESPOSTA_VIGENTE_EMPREGARE) dos inscritos ativos dos editais pedidos (id, número ou nome; sem pedido, os ativos com vagas da Empregare e regra) ainda não lidos, lidos com extrator de outra versão ou com erro (todos, com p_forcar), primeiro os de quem tem ficha; até p_limite. Cada anexo vem com o link, a pergunta, o nome do inscrito e o CPF (o do cadastro ou a resposta à pergunta do CPF) só como sha256(p_sal || 11 dígitos), para o robô conferir sem ver o número. Traz a regra vigente de cada edital (o robô liga a pergunta ao item da ficha). Só service_role.';
revoke all on function public.listar_anexos_para_leitura(text[], text, boolean, integer, text) from public, anon, authenticated;
grant execute on function public.listar_anexos_para_leitura(text[], text, boolean, integer, text) to service_role;

-- 4. O robô grava as leituras ------------------------------------------------------------
create function public.gravar_leituras_de_arquivos(p_execucao text, p_leituras jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v jsonb;
  v_gravadas integer := 0;
  v_fora integer := 0;
  v_bool text;
begin
  if coalesce(p_execucao, '') !~ '^[A-Za-z0-9_.:-]{1,60}$' then
    raise exception 'Execução inválida' using errcode = '22023';
  end if;
  if jsonb_typeof(p_leituras) is distinct from 'array' or jsonb_array_length(p_leituras) > 200 then
    raise exception 'Envie até 200 leituras por vez' using errcode = '22023';
  end if;
  for v in select x from jsonb_array_elements(p_leituras) x loop
    -- Só anexo que existe (resposta, pergunta, arquivo); o resto é contado e ignorado.
    if coalesce(v ->> 'resposta', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or coalesce(v ->> 'pergunta', '') !~ '^[0-9]{1,20}$' or coalesce(v ->> 'arquivo', '') !~ '^[0-9]{1,2}$'
       or not exists (select 1 from public."TB_EMPREGARE_ANEXO" a
                       where a."CO_EMPREGARE_RESPOSTA" = (v ->> 'resposta')::uuid
                         and a."CO_PERGUNTA_EMPREGARE" = v ->> 'pergunta'
                         and a."NU_ARQUIVO" = (v ->> 'arquivo')::smallint) then
      v_fora := v_fora + 1;
      continue;
    end if;
    perform private."FC_VALIDAR_LEITURA_ARQUIVO"(v);
    insert into public."TB_LEITURA_ARQUIVO" (
      "CO_EMPREGARE_RESPOSTA", "CO_PERGUNTA_EMPREGARE", "NU_ARQUIVO", "TP_SITUACAO", "TP_METODO", "TP_FORMATO",
      "TP_DOCUMENTO", "QT_PAGINA", "VL_CONFIANCA_OCR", "ST_NOME_CONFERE", "ST_CPF_CONFERE", "DS_ITEM", "DS_ALERTA",
      "DS_RESUMO", "CO_ERRO", "DS_HASH_ARQUIVO", "NU_VERSAO_EXTRATOR", "CO_EXECUCAO", "DT_LEITURA")
    values (
      (v ->> 'resposta')::uuid, v ->> 'pergunta', (v ->> 'arquivo')::smallint, v ->> 'situacao', v ->> 'metodo',
      v ->> 'formato', v ->> 'documento', (v ->> 'paginas')::numeric::smallint, round((v ->> 'confianca')::numeric, 3),
      case v -> 'nome_confere' when 'true'::jsonb then 'S' when 'false'::jsonb then 'N' end,
      case v -> 'cpf_confere' when 'true'::jsonb then 'S' when 'false'::jsonb then 'N' end,
      coalesce(v -> 'itens', '[]'::jsonb), coalesce(v -> 'alertas', '[]'::jsonb), nullif(v ->> 'resumo', ''),
      v ->> 'erro', v ->> 'hash', v ->> 'versao', p_execucao, now())
    on conflict ("CO_EMPREGARE_RESPOSTA", "CO_PERGUNTA_EMPREGARE", "NU_ARQUIVO") do update set
      "TP_SITUACAO" = excluded."TP_SITUACAO", "TP_METODO" = excluded."TP_METODO", "TP_FORMATO" = excluded."TP_FORMATO",
      "TP_DOCUMENTO" = excluded."TP_DOCUMENTO", "QT_PAGINA" = excluded."QT_PAGINA",
      "VL_CONFIANCA_OCR" = excluded."VL_CONFIANCA_OCR", "ST_NOME_CONFERE" = excluded."ST_NOME_CONFERE",
      "ST_CPF_CONFERE" = excluded."ST_CPF_CONFERE", "DS_ITEM" = excluded."DS_ITEM", "DS_ALERTA" = excluded."DS_ALERTA",
      "DS_RESUMO" = excluded."DS_RESUMO", "CO_ERRO" = excluded."CO_ERRO", "DS_HASH_ARQUIVO" = excluded."DS_HASH_ARQUIVO",
      "NU_VERSAO_EXTRATOR" = excluded."NU_VERSAO_EXTRATOR", "CO_EXECUCAO" = excluded."CO_EXECUCAO",
      "DT_LEITURA" = excluded."DT_LEITURA";
    v_gravadas := v_gravadas + 1;
  end loop;
  return jsonb_build_object('recebidas', jsonb_array_length(p_leituras), 'gravadas', v_gravadas, 'fora', v_fora);
end;
$function$;
comment on function public.gravar_leituras_de_arquivos(text, jsonb) is
  'Recebe do robô da leitura dos arquivos (Python) até 200 leituras: [{resposta, pergunta, arquivo, situacao, metodo, formato, documento, paginas, confianca, nome_confere, cpf_confere, itens, alertas, resumo, erro, hash, versao}]. Só anexo que existe em TB_EMPREGARE_ANEXO; cada leitura conferida por FC_VALIDAR_LEITURA_ARQUIVO; troca a leitura anterior do mesmo anexo. Só service_role.';
revoke all on function public.gravar_leituras_de_arquivos(text, jsonb) from public, anon, authenticated;
grant execute on function public.gravar_leituras_de_arquivos(text, jsonb) to service_role;

-- 5. As decisões do avaliador sobre o que foi lido, no lançamento da ficha ---------------
create function private."FC_VALIDAR_LEITURAS_LANCAMENTO"(p_lanc jsonb)
returns void
language plpgsql
immutable
set search_path to ''
as $function$
declare
  v_recusas jsonb := p_lanc -> 'recusas_lidas';
begin
  -- recusas_lidas: {"<resposta>:<pergunta>:<arquivo>:<item>": {motivo, texto}} — o item lido que o avaliador recusou.
  if v_recusas is not null and jsonb_typeof(v_recusas) <> 'null' then
    if jsonb_typeof(v_recusas) <> 'object'
       or (select count(*) from jsonb_object_keys(v_recusas)) > 300
       or exists (select 1 from jsonb_each(v_recusas) e
                   where e.key !~ '^[0-9]{1,20}:[0-9]{1,20}:[0-9]{1,2}:[0-9]{1,3}$'
                      or jsonb_typeof(e.value) <> 'object'
                      or coalesce(e.value ->> 'motivo', '') not in
                         ('FORA_DA_AREA', 'CARGA_NAO_COMPROVADA', 'NOME_DIVERGENTE', 'ILEGIVEL', 'PERIODO_SOBREPOSTO', 'OUTRO')
                      or length(coalesce(e.value ->> 'texto', '')) > 200) then
      raise exception 'Recusa de item lido inválida.' using errcode = '22023';
    end if;
  end if;
  -- do_arquivo: a linha aceita veio do item lido com esta chave.
  if exists (select 1
               from unnest(array['titulos', 'cursos', 'vinculos']) k
               cross join lateral jsonb_array_elements(
                 case when jsonb_typeof(p_lanc -> k) = 'array' then p_lanc -> k else '[]'::jsonb end) i
              where i ? 'do_arquivo'
                and coalesce(i ->> 'do_arquivo', '') !~ '^[0-9]{1,20}:[0-9]{1,20}:[0-9]{1,2}:[0-9]{1,3}$') then
    raise exception 'Origem de linha lida do arquivo inválida.' using errcode = '22023';
  end if;
end;
$function$;
comment on function private."FC_VALIDAR_LEITURAS_LANCAMENTO"(jsonb) is
  'Confere no lançamento da ficha as decisões sobre o que o robô leu dos arquivos (22023): recusas_lidas ({"<resposta>:<pergunta>:<arquivo>:<item>": {motivo FORA_DA_AREA | CARGA_NAO_COMPROVADA | NOME_DIVERGENTE | ILEGIVEL | PERIODO_SOBREPOSTO | OUTRO, texto até 200}}, até 300) e do_arquivo das linhas aceitas (a mesma chave).';
revoke all on function private."FC_VALIDAR_LEITURAS_LANCAMENTO"(jsonb) from public, anon, authenticated;

-- 6. O validador do lançamento chama a conferência acima (o resto igual a 20261007130000) --
create or replace function private."FC_VALIDAR_LANCAMENTO_FICHA"(p_regra jsonb, p_lanc jsonb)
returns void
language plpgsql
stable
set search_path to ''
as $function$
declare
  v_blocos jsonb := case when jsonb_typeof(p_regra -> 'blocos') = 'array' then p_regra -> 'blocos' else '[]'::jsonb end;
  v_nivel text := p_lanc ->> 'nivel';
  v_item record;
  v_bloco jsonb;
  v_teto numeric;
  v_codigo text;
  v_lista jsonb;
  v_campo text;
begin
  if jsonb_typeof(p_lanc) is distinct from 'object' or length(p_lanc::text) > 200000 then
    raise exception 'Lançamento da ficha inválido.' using errcode = '22023';
  end if;
  if v_nivel is null or v_nivel not in ('superior', 'tecnico', 'medio', 'fundamental') then
    raise exception 'Escolha o nível da vaga.' using errcode = '22023';
  end if;
  if p_lanc ? 'modalidade' and coalesce(p_lanc ->> 'modalidade', '') !~ '^[A-Z]{2,10}$' then
    raise exception 'Modalidade inválida.' using errcode = '22023';
  end if;
  foreach v_campo in array array['indigena', 'mora_aldeia', 'aldeia_na_lista'] loop
    if p_lanc ? v_campo and jsonb_typeof(p_lanc -> v_campo) not in ('boolean', 'null') then
      raise exception 'Campo % inválido.', v_campo using errcode = '22023';
    end if;
  end loop;
  if p_lanc ? 'estagio_horas' and not private."FC_JSON_NUMERO_ENTRE"(p_lanc -> 'estagio_horas', 0, 20000) then
    raise exception 'Horas de estágio de 0 a 20.000.' using errcode = '22023';
  end if;
  if length(coalesce(p_lanc ->> 'observacoes', '')) > 4000 then
    raise exception 'Observações com até 4.000 caracteres.' using errcode = '22023';
  end if;
  if p_lanc ? 'observacoes_prontas' and (jsonb_typeof(p_lanc -> 'observacoes_prontas') <> 'array'
     or exists (select 1 from jsonb_array_elements_text(p_lanc -> 'observacoes_prontas') o
                 where not exists (select 1 from jsonb_array_elements(coalesce(p_regra -> 'observacoes_prontas', '[]'::jsonb)) r
                                    where r ->> 'codigo' = o))) then
    raise exception 'Observação pronta que não está na regra.' using errcode = '22023';
  end if;

  -- Blocos: só os da regra, com situação, motivos e justificativas da regra e nota até o teto.
  if p_lanc ? 'blocos' and jsonb_typeof(p_lanc -> 'blocos') <> 'object' then
    raise exception 'Blocos da ficha inválidos.' using errcode = '22023';
  end if;
  for v_item in select key, value from jsonb_each(coalesce(p_lanc -> 'blocos', '{}'::jsonb)) loop
    select b into v_bloco from jsonb_array_elements(v_blocos) b where b ->> 'codigo' = v_item.key;
    if v_bloco is null then
      raise exception 'O bloco % não está na regra.', v_item.key using errcode = '22023';
    end if;
    if jsonb_typeof(v_item.value) <> 'object' then
      raise exception 'Bloco % inválido.', v_item.key using errcode = '22023';
    end if;
    if coalesce(v_item.value ->> 'situacao', 'CONFORME') not in ('CONFORME', 'NAO_CONFORME', 'NAO_ENVIADO', 'NAO_SE_APLICA') then
      raise exception 'Situação inválida no bloco %.', v_item.key using errcode = '22023';
    end if;
    v_lista := coalesce(v_item.value -> 'motivos', '[]'::jsonb);
    if jsonb_typeof(v_lista) <> 'array' or jsonb_array_length(v_lista) > 30
       or exists (select 1 from jsonb_array_elements_text(v_lista) m
                   where not exists (select 1 from jsonb_array_elements(coalesce(v_bloco -> 'motivos', '[]'::jsonb)) x
                                      where x ->> 'codigo' = m)) then
      raise exception 'Motivo que não está na regra no bloco %.', v_item.key using errcode = '22023';
    end if;
    v_lista := coalesce(v_item.value -> 'justificativas', '[]'::jsonb);
    if jsonb_typeof(v_lista) <> 'array' or jsonb_array_length(v_lista) > 10
       or exists (select 1 from jsonb_array_elements_text(v_lista) j
                   where not exists (select 1 from jsonb_array_elements(coalesce(v_bloco -> 'motivos', '[]'::jsonb)) x where x ->> 'codigo' = j)
                     and not exists (select 1 from jsonb_array_elements(coalesce(p_regra -> 'observacoes_prontas', '[]'::jsonb)) x where x ->> 'codigo' = j)) then
      raise exception 'Justificativa que não está na regra no bloco %.', v_item.key using errcode = '22023';
    end if;
    if length(coalesce(v_item.value ->> 'motivo_livre', '')) > 2000 or length(coalesce(v_item.value ->> 'justificativa_livre', '')) > 2000 then
      raise exception 'Texto do bloco % com até 2.000 caracteres.', v_item.key using errcode = '22023';
    end if;
    if jsonb_typeof(v_item.value -> 'nota_ajustada') is not null and jsonb_typeof(v_item.value -> 'nota_ajustada') <> 'null' then
      if private."FC_PARCIAL_DO_TIPO"(v_bloco ->> 'tipo') is null then
        raise exception 'O bloco % não pontua: não tem nota.', v_item.key using errcode = '22023';
      end if;
      v_teto := coalesce(private."FC_TETO_DO_BLOCO"(v_bloco, v_nivel), 100);
      if not private."FC_JSON_NUMERO_OBRIGATORIO"(v_item.value -> 'nota_ajustada', 0, v_teto) then
        raise exception 'Nota do bloco % de 0 a %.', v_item.key, v_teto using errcode = '22023';
      end if;
    end if;
  end loop;

  -- Itens: títulos, cursos e vínculos.
  foreach v_campo in array array['titulos', 'cursos', 'vinculos'] loop
    v_lista := coalesce(p_lanc -> v_campo, '[]'::jsonb);
    if jsonb_typeof(v_lista) <> 'array' or jsonb_array_length(v_lista) > 50 then
      raise exception 'Lista de % inválida (até 50).', v_campo using errcode = '22023';
    end if;
    for v_item in select value from jsonb_array_elements(v_lista) loop
      if jsonb_typeof(v_item.value) <> 'object'
         or jsonb_typeof(coalesce(v_item.value -> 'aceito', 'true'::jsonb)) <> 'boolean'
         or length(coalesce(v_item.value ->> 'nome', '')) > 200 or length(coalesce(v_item.value ->> 'empregador', '')) > 200
         or coalesce(v_item.value ->> 'motivo', 'OK') !~ '^[A-Z][A-Z0-9_]{1,29}$' then
        raise exception 'Item de % inválido.', v_campo using errcode = '22023';
      end if;
      if v_campo = 'titulos' and coalesce(v_item.value ->> 'titulo', '') not in
         ('ENSINO_MEDIO', 'TECNICO', 'GRADUACAO', 'ESPECIALIZACAO', 'RESIDENCIA', 'MESTRADO', 'DOUTORADO') then
        raise exception 'Título acadêmico inválido.' using errcode = '22023';
      end if;
      if v_campo = 'cursos' and not private."FC_JSON_NUMERO_ENTRE"(coalesce(v_item.value -> 'horas', '0'::jsonb), 0, 20000) then
        raise exception 'Carga horária do curso de 0 a 20.000.' using errcode = '22023';
      end if;
      if v_campo = 'vinculos' then
        if coalesce(v_item.value ->> 'categoria', '') !~ '^[A-Z][A-Z0-9_]{1,29}$' then
          raise exception 'Categoria do vínculo inválida.' using errcode = '22023';
        end if;
        if coalesce(v_item.value ->> 'inicio', '') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(v_item.value ->> 'fim', '') !~ '^\d{4}-\d{2}-\d{2}$' then
          continue; -- rascunho com data incompleta: não conta; concluir pede a data
        end if;
        begin
          if (v_item.value ->> 'inicio')::date < date '1950-01-01' or (v_item.value ->> 'fim')::date > current_date + 3660 then
            raise exception 'Datas do vínculo fora do intervalo.' using errcode = '22023';
          end if;
        exception when datetime_field_overflow or invalid_datetime_format then
          raise exception 'Data do vínculo inválida.' using errcode = '22023';
        end;
      end if;
    end loop;
  end loop;
  -- O que o robô leu dos arquivos (20261009220000): as recusas e a origem das linhas aceitas.
  perform private."FC_VALIDAR_LEITURAS_LANCAMENTO"(p_lanc);
end;
$function$;
comment on function private."FC_VALIDAR_LANCAMENTO_FICHA"(jsonb, jsonb) is
  'Confere a estrutura do lançamento da ficha contra a regra (22023): nível, modalidade, blocos e motivos/justificativas da regra, nota ajustada de 0 ao teto do bloco no nível, até 50 títulos/cursos/vínculos com campos válidos, datas e textos limitados. As recusas dos itens lidos dos arquivos (recusas_lidas) e a origem das linhas aceitas (do_arquivo) vão por FC_VALIDAR_LEITURAS_LANCAMENTO (20261009220000). Não refaz a conta.';
revoke all on function private."FC_VALIDAR_LANCAMENTO_FICHA"(jsonb, jsonb) from public, anon, authenticated;

-- 7. A ficha devolve as leituras dos anexos da resposta vigente (o resto igual a 20261009210000)
create or replace function public.obter_ficha_analise(p_ficha uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_f public."TB_FICHA_ANALISE";
  v_papel text;
  v_uid uuid := (select auth.uid());
  v_regra record;
  v_vigente integer;
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_envio uuid;
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha;
  v_papel := private."FC_EXIGIR_VER_FICHA"(v_f);
  select * into v_regra from private."FC_REGRA_VIGENTE_FICHA"(p_ficha);
  select r."NU_VERSAO_VIGENTE" into v_vigente from public."TB_REGRA_ANALISE" r where r."CO_REGRA_ANALISE" = v_f."CO_REGRA_ANALISE";
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = v_f."CO_MONITORAMENTO";
  v_envio := private."FC_RESPOSTA_VIGENTE_EMPREGARE"(v_f."CO_EMPREGARE_CANDIDATO");
  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'edital', json_build_object('id', v_m.id, 'rotulo', private."FC_ROTULO_DO_EDITAL"(v_m.edital), 'area', v_m."CO_AREA"),
    'papel', v_papel,
    'eu', v_uid,
    'pode_editar', v_f."TP_SITUACAO" = 'EM_ANALISE' and v_f."CO_USUARIO_RESERVA" = v_uid and v_f."DT_RESERVA_EXPIRA" > now(),
    'pode_reabrir', v_f."TP_SITUACAO" = 'CONCLUIDA' and coalesce(v_papel, '') = 'COORDENADOR',
    'ficha', (private."FC_FICHA_ANALISE_JSON"(p_ficha)::jsonb || jsonb_build_object(
               'lancamento', v_f."DS_LANCAMENTO", 'resultado', v_f."DS_RESULTADO", 'parecer', v_f."DS_PARECER",
               'tp_resultado', v_f."TP_RESULTADO", 'nota_final', v_f."VL_NOTA_FINAL", 'nota_apurada', v_f."VL_NOTA_APURADA",
               'rascunho_em', v_f."DT_RASCUNHO", 'concluida_em', v_f."DT_CONCLUSAO",
               'concluida_por', (select coalesce(u.nome, u.email) from public."TB_PERFIL_USUARIO" u where u.user_id = v_f."CO_USUARIO_CONCLUSAO"))),
    'regra', json_build_object('versao', v_regra.p_versao, 'vigente', v_vigente, 'situacao', v_regra.p_situacao,
                               'configuracao', v_regra.p_configuracao),
    'documental', private."FC_DOCUMENTAL_DO_EDITAL"(v_f."CO_MONITORAMENTO"),
    'declarada_gravada', (select json_build_object('total', p."VL_NOTA_DECLARADA", 'parciais', p."DS_NOTA_DECLARADA" -> 'parciais',
                                                   'art', p."VL_ART", 'divergente', p."ST_DIVERGENTE" = 'S')
                            from public."TB_PRE_CLASSIFICACAO" p
                           where p."CO_MONITORAMENTO" = v_f."CO_MONITORAMENTO" and p."CO_EMPREGARE_CANDIDATO" = v_f."CO_EMPREGARE_CANDIDATO"),
    'respostas', private."FC_RESPOSTAS_DA_FICHA"(v_f."CO_EMPREGARE_CANDIDATO", v_regra.p_configuracao),
    -- As linhas que as respostas do candidato já dão (job Python, 20261009190000): a tela só exibe.
    'sugestoes', coalesce((select s."DS_SUGESTAO" from public."TB_SUGESTAO_FICHA" s
                            where s."CO_MONITORAMENTO" = v_f."CO_MONITORAMENTO"
                              and s."CO_EMPREGARE_CANDIDATO" = v_f."CO_EMPREGARE_CANDIDATO"), '{}'::jsonb),
    -- O que o robô leu dos anexos da resposta vigente (job Python, 20261009220000): a tela só exibe;
    -- quem decide é o avaliador. Sem o texto do documento, nem nome, nem CPF: só os booleanos.
    'leituras', coalesce((
      select json_agg(json_build_object('resposta', r."CO_RESPOSTA_QUESTIONARIO", 'pergunta', l."CO_PERGUNTA_EMPREGARE",
                                        'arquivo', l."NU_ARQUIVO", 'situacao', l."TP_SITUACAO", 'metodo', l."TP_METODO",
                                        'documento', l."TP_DOCUMENTO", 'paginas', l."QT_PAGINA",
                                        'nome_confere', case l."ST_NOME_CONFERE" when 'S' then true when 'N' then false end,
                                        'cpf_confere', case l."ST_CPF_CONFERE" when 'S' then true when 'N' then false end,
                                        'itens', l."DS_ITEM", 'alertas', l."DS_ALERTA", 'resumo', l."DS_RESUMO",
                                        'lido_em', l."DT_LEITURA")
                      order by l."CO_PERGUNTA_EMPREGARE", l."NU_ARQUIVO")
        from public."TB_LEITURA_ARQUIVO" l
        join public."TB_EMPREGARE_RESPOSTA" r on r."CO_EMPREGARE_RESPOSTA" = l."CO_EMPREGARE_RESPOSTA"
       where l."CO_EMPREGARE_RESPOSTA" = v_envio), '[]'::json),
    -- Links da Empregare (dado restrito, só aqui): o do candidato, o das candidaturas, os da resposta vigente
    -- do questionário e dos anexos dela (20261009210000) e, à parte, os dos envios anteriores.
    'empregare', (select json_build_object(
                           'link_candidato', c."DS_LINK_DETALHE",
                           'capturado_em', c."DT_CAPTURA_LINK",
                           'vaga_interno', ev."CO_VAGA_INTERNO",
                           'link_vaga', case when ev."CO_VAGA_INTERNO" is not null
                                             then 'https://corporate.empregare.com/empresa/vagas/candidaturas/' || ev."CO_VAGA_INTERNO" end,
                           'respostas', coalesce((
                             select json_agg(json_build_object('resposta', r."CO_RESPOSTA_QUESTIONARIO",
                                                               'link_impressao', r."DS_LINK_IMPRESSAO",
                                                               'perguntas', r."QT_PERGUNTA", 'anexos', r."QT_ANEXO",
                                                               'capturado_em', r."DT_CAPTURA")
                                             order by r."CO_RESPOSTA_QUESTIONARIO")
                               from public."TB_EMPREGARE_RESPOSTA" r
                              where r."CO_EMPREGARE_RESPOSTA" = v_envio), '[]'::json),
                           'anexos', coalesce((
                             select json_agg(json_build_object('resposta', r."CO_RESPOSTA_QUESTIONARIO",
                                                               'pergunta', a."CO_PERGUNTA_EMPREGARE",
                                                               'arquivo', a."NU_ARQUIVO", 'ordem', a."NU_ORDEM",
                                                               'enunciado', a."DS_ENUNCIADO",
                                                               'coluna', a."DS_COLUNA", 'tipo', a."TP_LINK",
                                                               'link', a."DS_LINK")
                                             order by r."CO_RESPOSTA_QUESTIONARIO", a."CO_PERGUNTA_EMPREGARE", a."NU_ARQUIVO")
                               from public."TB_EMPREGARE_ANEXO" a
                               join public."TB_EMPREGARE_RESPOSTA" r on r."CO_EMPREGARE_RESPOSTA" = a."CO_EMPREGARE_RESPOSTA"
                              where r."CO_EMPREGARE_RESPOSTA" = v_envio), '[]'::json),
                           -- As outras respostas com alguma pergunta lida, da mais nova para a mais antiga.
                           'envios_anteriores', coalesce((
                             select json_agg(json_build_object('resposta', r."CO_RESPOSTA_QUESTIONARIO",
                                                               'link_impressao', r."DS_LINK_IMPRESSAO",
                                                               'perguntas', r."QT_PERGUNTA",
                                                               'capturado_em', r."DT_CAPTURA",
                                                               'arquivos', coalesce((
                                                                 select json_agg(json_build_object('pergunta', a."CO_PERGUNTA_EMPREGARE",
                                                                                                   'arquivo', a."NU_ARQUIVO", 'ordem', a."NU_ORDEM",
                                                                                                   'enunciado', a."DS_ENUNCIADO",
                                                                                                   'coluna', a."DS_COLUNA", 'tipo', a."TP_LINK",
                                                                                                   'link', a."DS_LINK")
                                                                                 order by a."NU_ORDEM" nulls last, a."CO_PERGUNTA_EMPREGARE", a."NU_ARQUIVO")
                                                                   from public."TB_EMPREGARE_ANEXO" a
                                                                  where a."CO_EMPREGARE_RESPOSTA" = r."CO_EMPREGARE_RESPOSTA"), '[]'::json))
                                             order by r."CO_RESPOSTA_QUESTIONARIO"::numeric desc)
                               from public."TB_EMPREGARE_RESPOSTA" r
                              where r."CO_EMPREGARE_CANDIDATO" = c."CO_EMPREGARE_CANDIDATO"
                                and r."CO_EMPREGARE_RESPOSTA" is distinct from v_envio
                                and r."QT_PERGUNTA" > 0), '[]'::json))
                    from public."TB_EMPREGARE_CANDIDATO" c
                    left join public."TB_EMPREGARE_VAGA" ev on ev."CO_VAGA" = c."CO_VAGA"
                   where c."CO_EMPREGARE_CANDIDATO" = v_f."CO_EMPREGARE_CANDIDATO"),
    'historico', coalesce((
      select json_agg(json_build_object('versao', h."NU_VERSAO", 'acao', h."TP_ACAO", 'situacao', h."TP_SITUACAO",
                                        'quando', h."DT_REGISTRO", 'por', coalesce(u.nome, u.email), 'motivo', h."DS_MOTIVO",
                                        'resultado', h."TP_RESULTADO", 'nota_final', h."VL_NOTA_FINAL",
                                        'alteracao', h."DS_ALTERACAO")
                      order by h."CO_HISTORICO_FICHA" desc)
        from (select * from public."TH_FICHA_ANALISE" x where x."CO_FICHA_ANALISE" = p_ficha
               order by x."CO_HISTORICO_FICHA" desc limit 200) h
        left join public."TB_PERFIL_USUARIO" u on u.user_id = h."CO_USUARIO"), '[]'::json)
  );
end;
$function$;
comment on function public.obter_ficha_analise(uuid) is
  'A ficha para analisar (json): o cabeçalho (sem CPF nem contato), o lançamento e o resultado gravados, a regra com que é analisada (a vigente; a da conclusão, se concluída — AM-2.3), a nota mínima e os níveis da regra de classificação, a nota declarada e a ART da pré-classificação, as respostas da Empregare SÓ das perguntas que a regra liga, os links da Empregare capturados pelo robô (empregare: link_candidato da página de detalhes, vaga_interno e link_vaga das candidaturas, respostas [{resposta, link_impressao, perguntas, anexos, capturado_em}] e anexos [{resposta, pergunta, arquivo, ordem, enunciado, coluna, tipo, link}] SÓ da resposta vigente do questionário — a mais nova com pergunta lida, FC_RESPOSTA_VIGENTE_EMPREGARE — e envios_anteriores [{resposta, link_impressao, perguntas, capturado_em, arquivos: [{pergunta, arquivo, ordem, enunciado, coluna, tipo, link}]}] com as outras, da mais nova para a mais antiga (20261009210000); dado restrito, só aqui), as sugestões de títulos, cursos e vínculos tiradas das respostas pelo job Python (20261009190000), as leituras dos anexos da resposta vigente feitas pelo robô (leituras [{resposta, pergunta, arquivo, situacao, metodo, documento, paginas, nome_confere, cpf_confere, itens, alertas, resumo, lido_em}], 20261009220000), o histórico (até 200, com as alterações) e se quem chama pode editar (reserva vigente, em análise) ou reabrir (coordenação, concluída). Vê: coordenação e revisão; o analista, só nas vagas dele; o leitor, só concluída.';
revoke all on function public.obter_ficha_analise(uuid) from public, anon;
grant execute on function public.obter_ficha_analise(uuid) to authenticated;
-- ═══ CORPO DA MIGRATION (fim) ═══

-- E1: tabela fechada, RPCs só do service_role ----------------------------------------------
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public."TB_LEITURA_ARQUIVO"'::regclass) then
    raise exception 'E1: TB_LEITURA_ARQUIVO sem RLS';
  end if;
  if has_table_privilege('authenticated', 'public."TB_LEITURA_ARQUIVO"', 'select')
     or has_table_privilege('anon', 'public."TB_LEITURA_ARQUIVO"', 'select') then
    raise exception 'E1: a tabela está aberta';
  end if;
  if has_function_privilege('authenticated', 'public.listar_anexos_para_leitura(text[], text, boolean, integer, text)', 'execute')
     or has_function_privilege('authenticated', 'public.gravar_leituras_de_arquivos(text, jsonb)', 'execute')
     or has_function_privilege('anon', 'public.gravar_leituras_de_arquivos(text, jsonb)', 'execute')
     or has_function_privilege('authenticated', 'private."FC_VALIDAR_LEITURA_ARQUIVO"(jsonb)', 'execute')
     or has_function_privilege('authenticated', 'private."FC_VALIDAR_LEITURAS_LANCAMENTO"(jsonb)', 'execute') then
    raise exception 'E1: RPC do robô ou conferência aberta a quem usa o app';
  end if;
  if not has_function_privilege('service_role', 'public.listar_anexos_para_leitura(text[], text, boolean, integer, text)', 'execute')
     or not has_function_privilege('service_role', 'public.gravar_leituras_de_arquivos(text, jsonb)', 'execute') then
    raise exception 'E1: o service_role não executa as RPCs do robô';
  end if;
  raise notice 'E1 ok';
end;
$$;

create temporary table ensaio_lista on commit drop as
select public.listar_anexos_para_leitura(array['93/2026'], 'ensaio-1', false, 5, 'sal-do-ensaio-0123456789') as j;

-- E2: a lista do 93/2026 ---------------------------------------------------------------------
do $$
declare
  v jsonb := (select j from ensaio_lista);
  v_outra jsonb := public.listar_anexos_para_leitura(array['93/2026'], 'ensaio-1', false, 5, 'sal-do-ensaio-0123456789');
  a jsonb;
begin
  if jsonb_array_length(v -> 'editais') <> 1 or v -> 'editais' -> 0 -> 'regra' is null then
    raise exception 'E2: o 93/2026 sem regra na lista (%)', v -> 'editais';
  end if;
  if jsonb_array_length(v -> 'anexos') = 0 then
    raise exception 'E2: nenhum anexo pendente no 93/2026';
  end if;
  if jsonb_array_length(v -> 'anexos') > 5 then
    raise exception 'E2: o limite não valeu';
  end if;
  for a in select x from jsonb_array_elements(v -> 'anexos') x loop
    if (a ->> 'resposta')::uuid is distinct from private."FC_RESPOSTA_VIGENTE_EMPREGARE"((a ->> 'candidato')::uuid) then
      raise exception 'E2: anexo de resposta que não é a vigente';
    end if;
    if a ->> 'cpf' is not null and a ->> 'cpf' !~ '^[0-9a-f]{64}$' then
      raise exception 'E2: CPF fora do formato de hash';
    end if;
  end loop;
  if (v -> 'anexos' -> 0 ->> 'com_ficha')::boolean is distinct from
     exists (select 1 from public."TB_FICHA_ANALISE" f where f."CO_MONITORAMENTO" = 'f57d77e1-7f6b-416c-9f9e-6e40c6d5bded') then
    raise exception 'E2: quem tem ficha não veio primeiro';
  end if;
  if v_outra -> 'anexos' -> 0 ->> 'cpf' is distinct from v -> 'anexos' -> 0 ->> 'cpf' then
    raise exception 'E2: o mesmo sal deu hash diferente';
  end if;
  raise notice 'E2 ok: % anexos no edital, % pendentes', v ->> 'total', v ->> 'pendentes';
end;
$$;

-- E3: gravação, troca e o anexo sai da lista ---------------------------------------------------
do $$
declare
  a jsonb := (select j -> 'anexos' -> 0 from ensaio_lista);
  v_leitura jsonb;
  v_r jsonb;
  v_depois jsonb;
begin
  v_leitura := jsonb_build_object(
    'resposta', a ->> 'resposta', 'pergunta', a ->> 'pergunta', 'arquivo', (a ->> 'arquivo')::int,
    'situacao', 'LIDO', 'metodo', 'TEXTO', 'formato', 'PDF', 'documento', 'CERTIFICADO', 'paginas', 3,
    'nome_confere', true, 'cpf_confere', null,
    'itens', jsonb_build_array(jsonb_build_object('tipo', 'CURSO', 'curso', 'Curso do ensaio', 'horas', 145,
                                                  'pagina', 1, 'alertas', '[]'::jsonb)),
    'alertas', '[]'::jsonb, 'resumo', '1 certificado · 145 h · nome confere',
    'hash', repeat('a', 64), 'versao', 'ensaio-1');
  v_r := public.gravar_leituras_de_arquivos('gh-ensaio', jsonb_build_array(v_leitura,
           v_leitura || jsonb_build_object('pergunta', '999999999')));
  if (v_r ->> 'gravadas')::int <> 1 or (v_r ->> 'fora')::int <> 1 then
    raise exception 'E3: %', v_r;
  end if;
  v_r := public.gravar_leituras_de_arquivos('gh-ensaio', jsonb_build_array(v_leitura || '{"situacao": "ILEGIVEL", "itens": []}'::jsonb));
  if (select count(*) from public."TB_LEITURA_ARQUIVO" l where l."CO_EMPREGARE_RESPOSTA" = (a ->> 'resposta')::uuid
        and l."CO_PERGUNTA_EMPREGARE" = a ->> 'pergunta' and l."NU_ARQUIVO" = (a ->> 'arquivo')::int and l."TP_SITUACAO" = 'ILEGIVEL') <> 1 then
    raise exception 'E3: a segunda gravação não trocou a primeira';
  end if;
  v_r := public.gravar_leituras_de_arquivos('gh-ensaio', jsonb_build_array(v_leitura));
  v_depois := public.listar_anexos_para_leitura(array['93/2026'], 'ensaio-1', false, 2000, 'sal-do-ensaio-0123456789');
  if exists (select 1 from jsonb_array_elements(v_depois -> 'anexos') x
              where x ->> 'resposta' = a ->> 'resposta' and x ->> 'pergunta' = a ->> 'pergunta' and x ->> 'arquivo' = a ->> 'arquivo') then
    raise exception 'E3: o anexo lido continua pendente na mesma versão';
  end if;
  v_depois := public.listar_anexos_para_leitura(array['93/2026'], 'ensaio-2', false, 2000, 'sal-do-ensaio-0123456789');
  if not exists (select 1 from jsonb_array_elements(v_depois -> 'anexos') x
                  where x ->> 'resposta' = a ->> 'resposta' and x ->> 'pergunta' = a ->> 'pergunta' and x ->> 'arquivo' = a ->> 'arquivo') then
    raise exception 'E3: com outra versão do extrator o anexo não volta para a lista';
  end if;
  raise notice 'E3 ok';
end;
$$;

-- E4: o que não pode ser gravado -----------------------------------------------------------------
do $$
declare
  a jsonb := (select j -> 'anexos' -> 0 from ensaio_lista);
  v_base jsonb;
  v_ruim jsonb;
  v_recusou boolean;
begin
  v_base := jsonb_build_object('resposta', a ->> 'resposta', 'pergunta', a ->> 'pergunta', 'arquivo', (a ->> 'arquivo')::int,
                               'situacao', 'LIDO', 'versao', 'ensaio-1');
  foreach v_ruim in array array[
    v_base || '{"resumo": "CPF 123.456.789-09"}'::jsonb,
    v_base || '{"itens": [{"tipo": "QUALQUER"}]}'::jsonb,
    v_base || jsonb_build_object('itens', jsonb_build_array(jsonb_build_object('tipo', 'CURSO', 'curso', repeat('x', 201)))),
    v_base || '{"situacao": "TALVEZ"}'::jsonb
  ] loop
    v_recusou := false;
    begin
      perform public.gravar_leituras_de_arquivos('gh-ensaio', jsonb_build_array(v_ruim));
    exception when sqlstate '22023' then
      v_recusou := true;
    end;
    if not v_recusou then
      raise exception 'E4: aceitou %', left(v_ruim::text, 200);
    end if;
  end loop;
  raise notice 'E4 ok';
end;
$$;

-- E5: a ficha traz a leitura (como quem coordena) ---------------------------------------------------
create temporary table ensaio_ficha on commit drop as
select f."CO_FICHA_ANALISE" as ficha
  from public."TB_FICHA_ANALISE" f
 where f."CO_EMPREGARE_CANDIDATO" = (select (j -> 'anexos' -> 0 ->> 'candidato')::uuid from ensaio_lista)
 limit 1;
grant select on ensaio_ficha to authenticated;
grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated"}', true);

do $$
declare
  v_ficha uuid := (select ficha from ensaio_ficha);
  v_l jsonb;
begin
  if v_ficha is null then
    raise notice 'E5 pulado: o primeiro anexo da lista não é de candidato com ficha';
    return;
  end if;
  v_l := public.obter_ficha_analise(v_ficha)::jsonb -> 'leituras';
  if jsonb_array_length(v_l) < 1 or v_l -> 0 ->> 'situacao' <> 'LIDO' or (v_l -> 0 ->> 'nome_confere')::boolean is not true
     or v_l -> 0 -> 'itens' -> 0 ->> 'horas' <> '145' then
    raise exception 'E5: leituras na ficha: %', left(v_l::text, 300);
  end if;
  raise notice 'E5 ok';
end;
$$;

reset role;

-- E6: o validador do lançamento ----------------------------------------------------------------------
do $$
declare
  v_regra jsonb := (select h."DS_CONFIGURACAO" from public."TB_REGRA_ANALISE" r
                      join public."TH_REGRA_ANALISE" h on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
                     where r."CO_MONITORAMENTO" = 'f57d77e1-7f6b-416c-9f9e-6e40c6d5bded');
  v_ok jsonb := '{"nivel": "superior", "blocos": {},
                  "cursos": [{"nome": "Curso lido", "horas": 145, "aceito": true, "do_arquivo": "8019889:123:1:0"}],
                  "recusas_lidas": {"8019889:123:1:1": {"motivo": "FORA_DA_AREA"},
                                    "8019889:123:1:2": {"motivo": "OUTRO", "texto": "certificado repetido"}}}';
  v_ruim jsonb;
  v_recusou boolean;
begin
  perform private."FC_VALIDAR_LANCAMENTO_FICHA"(v_regra, v_ok);
  perform private."FC_VALIDAR_LANCAMENTO_FICHA"(v_regra, '{"nivel": "superior"}'::jsonb);
  foreach v_ruim in array array[
    v_ok || '{"recusas_lidas": {"8019889:123:1:1": {"motivo": "PORQUE_SIM"}}}'::jsonb,
    v_ok || '{"recusas_lidas": {"qualquer": {"motivo": "OUTRO"}}}'::jsonb,
    v_ok || '{"recusas_lidas": []}'::jsonb,
    v_ok || '{"cursos": [{"nome": "x", "horas": 40, "do_arquivo": "abc"}]}'::jsonb
  ] loop
    v_recusou := false;
    begin
      perform private."FC_VALIDAR_LANCAMENTO_FICHA"(v_regra, v_ruim);
    exception when sqlstate '22023' then
      v_recusou := true;
    end;
    if not v_recusou then
      raise exception 'E6: aceitou %', left(v_ruim::text, 200);
    end if;
  end loop;
  raise notice 'E6 ok';
end;
$$;

-- O que a lista do robô traz do 93/2026 (sem nome nem hash).
select j ->> 'total' as anexos_no_edital, j ->> 'pendentes' as pendentes,
       (select jsonb_agg(jsonb_build_object('ordem', x -> 'ordem', 'com_ficha', x -> 'com_ficha',
                                            'tem_cpf', x ->> 'cpf' is not null))
          from jsonb_array_elements(j -> 'anexos') x) as primeiros
  from ensaio_lista;

rollback;
