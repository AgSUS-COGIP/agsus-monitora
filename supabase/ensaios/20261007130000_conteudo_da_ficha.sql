/*
  ENSAIO de 20261007130000_conteudo_da_ficha.sql — begin … rollback.

  PRÉ-REQUISITO: as migrations até 20261007100000 aplicadas (as fichas da F3 e
  a pergunta com alternativas); o corpo para se faltar. Precisa da regra do
  edital 93/2026 (Projetos) com os blocos do modelo PROJ26-CURRICULAR.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela) e:
    E1  confere a RLS, a falta de acesso direto e as permissões das RPCs novas;
    E2  cria, no 93/2026, uma vaga sintética com 3 inscritos fictícios (com a
        pergunta do CPF, para ver que não sai), 5 atores (gestor, Ana — analista
        do edital todo —, Beto — analista só de outra vaga —, leitor e sem
        acesso), uma versão conferida da regra copiada da vigente com as
        perguntas ligadas aos blocos e a nota declarada de titulação e cursos
        (como supabase/correcoes/20261007-perguntas-da-ficha-proj26.sql faz no
        modelo) e o lote com as fichas (pelo job);
    E3  percorre a ficha como cada pessoa (papel authenticated): quem vê e quem
        não vê, as respostas só das perguntas da regra (sem CPF), rascunho com
        versão velha (40001), estrutura e limites recusados (bloco, motivo,
        nota acima do teto, soma, bloco eliminatório), histórico com de quanto
        para quanto, concluir sem justificativa (recusado), com a regra velha
        (40001) e certo; a fila com o resultado; versão nova da regra lista a
        ficha concluída (AM-2.3); reabrir só a coordenação e com motivo; o
        registro de acesso;
    E4  depois de "reset role": histórico imutável, ficha não se apaga,
        concluída exige parecer, acesso registrado.
  Termina em ROLLBACK: nada fica gravado.

  Resultado esperado: os "ok E1" … "ok E4" e a linha "ENSAIO OK". Qualquer
  "FALHOU …" interrompe e desfaz tudo; copie a mensagem.

  Mantenha em sincronia: tests/conteudo-da-ficha-migration.test.js confere que
  o corpo da migration aqui é idêntico ao do arquivo da migration.
*/
begin;

-- ═══ CORPO DA MIGRATION (início) ═══

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TB_FICHA_ANALISE"') is null
     or to_regprocedure('private."FC_PODE_ANALISAR_VAGA"(uuid, uuid, text)') is null then
    raise exception 'Aplique antes 20261006120000_fichas_fila_e_reserva.sql.';
  end if;
  if to_regprocedure('private."FC_JSON_PERGUNTA_OK"(jsonb, boolean)') is null then
    raise exception 'Aplique antes 20261007100000_pergunta_com_alternativas.sql.';
  end if;
end;
$$;

-- 1. O conteúdo na ficha ---------------------------------------------------------------------
alter table public."TB_FICHA_ANALISE"
  add column "DS_LANCAMENTO" jsonb,
  add column "DS_RESULTADO" jsonb,
  add column "DS_PARECER" text,
  add column "TP_RESULTADO" varchar(16),
  add column "VL_NOTA_APURADA" numeric(8,4),
  add column "VL_NOTA_FINAL" numeric(8,4),
  add column "CO_USUARIO_RASCUNHO" uuid,
  add column "DT_RASCUNHO" timestamptz,
  add column "CO_USUARIO_CONCLUSAO" uuid,
  add column "DT_CONCLUSAO" timestamptz,
  add constraint "FK_USUARIORASC_FICHAANALISE" foreign key ("CO_USUARIO_RASCUNHO") references auth.users (id),
  add constraint "FK_USUARIOCONCL_FICHAANALISE" foreign key ("CO_USUARIO_CONCLUSAO") references auth.users (id),
  add constraint "CK_FICHAANALISE_TPRESULTADO" check (
    "TP_RESULTADO" is null or "TP_RESULTADO" in ('APTO', 'INAPTO_REQUISITO', 'INAPTO_NOTA')),
  add constraint "CK_FICHAANALISE_CONTEUDO" check (
    ("DS_LANCAMENTO" is null or (jsonb_typeof("DS_LANCAMENTO") = 'object' and length("DS_LANCAMENTO"::text) <= 200000))
    and ("DS_RESULTADO" is null or (jsonb_typeof("DS_RESULTADO") = 'object' and length("DS_RESULTADO"::text) <= 100000))
    and ("DS_PARECER" is null or length("DS_PARECER") <= 8000)
    and coalesce("VL_NOTA_APURADA", 0) between 0 and 1000 and coalesce("VL_NOTA_FINAL", 0) between 0 and 1000
    and ("CO_USUARIO_RASCUNHO" is null) = ("DT_RASCUNHO" is null)
    and ("CO_USUARIO_CONCLUSAO" is null) = ("DT_CONCLUSAO" is null)),
  add constraint "CK_FICHAANALISE_CONCLUSAO" check (
    "TP_SITUACAO" <> 'CONCLUIDA'
    or ("TP_RESULTADO" is not null and "VL_NOTA_FINAL" is not null and "VL_NOTA_APURADA" is not null
        and length(btrim(coalesce("DS_PARECER", ''))) > 0 and "DS_LANCAMENTO" is not null and "DS_RESULTADO" is not null
        and "DT_CONCLUSAO" is not null
        and ("TP_RESULTADO" <> 'INAPTO_REQUISITO' or "VL_NOTA_FINAL" = 0)));
create index "IN_FKFICHAANALISE_RASCUNHO" on public."TB_FICHA_ANALISE" ("CO_USUARIO_RASCUNHO");
create index "IN_FKFICHAANALISE_CONCLUSAO" on public."TB_FICHA_ANALISE" ("CO_USUARIO_CONCLUSAO");
comment on table public."TB_FICHA_ANALISE" is
  'Ficha da avaliação documental de um inscrito do lote de convocação: situação, responsável, reserva de 15 minutos, versão para o controle otimista e o conteúdo da análise (lançamento do analista, resultado da conta, nota e parecer). Criada pelo banco (FC_ABRIR_FICHAS) para quem está no lote; quem sai eliminado mantém a ficha como FORA_LOTE. Nada se apaga.';
comment on column public."TB_FICHA_ANALISE"."NU_VERSAO_REGRA" is 'Versão da regra: a com que o inscrito entrou no lote e, depois de concluída, a com que foi analisado (concluir_ficha grava a vigente). Pendente e em análise seguem a vigente (AM-2.3).';
comment on column public."TB_FICHA_ANALISE"."TP_SITUACAO" is 'PENDENTE (na fila, com ou sem responsável), EM_ANALISE (o responsável abriu; rascunho), REVISAR (mandada para revisão), CONCLUIDA (concluir_ficha; só leitura até reabrir) ou FORA_LOTE (saiu do lote, eliminado; a ficha fica com o motivo).';
comment on column public."TB_FICHA_ANALISE"."NU_VERSAO" is 'Versão da ficha (controle otimista): sobe a cada mudança de situação, responsável, reserva ou conteúdo (rascunho); quem age com versão velha recebe 40001.';
comment on column public."TB_FICHA_ANALISE"."DS_LANCAMENTO" is 'O que o analista lançou, no formato do candidato de src/lib/avaliacao-documental/pontuacao.js: nível, modalidade, indígena/aldeia, blocos {situação, motivos, motivo livre, nota ajustada, justificativas, complemento}, títulos, cursos, vínculos, estágio e observações. Sem CPF nem contato.';
comment on column public."TB_FICHA_ANALISE"."DS_RESULTADO" is 'O resultado da conta da tela (resumoParaGravar de src/lib/avaliacao-documental/ficha.js): resultado, nota apurada e final, nota mínima, parciais, calculadas e ajustadas, a declarada por parcial, motivos eliminatórios, encaminhamentos, observações e a experiência apurada.';
comment on column public."TB_FICHA_ANALISE"."DS_PARECER" is 'Parecer gerado pela regra a partir dos motivos, das justificativas e das observações (até 8.000 caracteres).';
comment on column public."TB_FICHA_ANALISE"."TP_RESULTADO" is 'APTO, INAPTO_REQUISITO (nota final 0) ou INAPTO_NOTA; gravado na conclusão.';
comment on column public."TB_FICHA_ANALISE"."VL_NOTA_APURADA" is 'Soma das parciais apuradas (na conclusão).';
comment on column public."TB_FICHA_ANALISE"."VL_NOTA_FINAL" is 'Nota final: a apurada, ou 0 se inapto por requisito (na conclusão).';
comment on column public."TB_FICHA_ANALISE"."CO_USUARIO_RASCUNHO" is 'Quem salvou o último rascunho (auth.users.id).';
comment on column public."TB_FICHA_ANALISE"."DT_RASCUNHO" is 'Último rascunho salvo ("Salvo às HH:MM").';
comment on column public."TB_FICHA_ANALISE"."CO_USUARIO_CONCLUSAO" is 'Quem concluiu (auth.users.id): o login, nada digitado (AM-12.6).';
comment on column public."TB_FICHA_ANALISE"."DT_CONCLUSAO" is 'Quando foi concluída (a última vez, se reaberta e concluída de novo).';
comment on constraint "FK_USUARIORASC_FICHAANALISE" on public."TB_FICHA_ANALISE" is 'Quem salvou o rascunho.';
comment on constraint "FK_USUARIOCONCL_FICHAANALISE" on public."TB_FICHA_ANALISE" is 'Quem concluiu.';
comment on constraint "CK_FICHAANALISE_TPRESULTADO" on public."TB_FICHA_ANALISE" is 'Resultados válidos.';
comment on constraint "CK_FICHAANALISE_CONTEUDO" on public."TB_FICHA_ANALISE" is 'Lançamento e resultado são objetos json de tamanho limitado; parecer até 8.000; notas de 0 a 1.000; rascunho e conclusão têm quem e quando.';
comment on constraint "CK_FICHAANALISE_CONCLUSAO" on public."TB_FICHA_ANALISE" is 'Concluída tem resultado, notas, parecer, lançamento, resultado da conta e data; inapto por requisito tem nota final 0.';
comment on index public."IN_FKFICHAANALISE_RASCUNHO" is 'Chave estrangeira para auth.users (rascunho).';
comment on index public."IN_FKFICHAANALISE_CONCLUSAO" is 'Chave estrangeira para auth.users (conclusão).';

-- 2. O histórico guarda o conteúdo -------------------------------------------------------------
alter table public."TH_FICHA_ANALISE"
  add column "TP_RESULTADO" varchar(16),
  add column "VL_NOTA_FINAL" numeric(8,4),
  add column "DS_ALTERACAO" jsonb,
  add column "DS_RETRATO" jsonb,
  drop constraint "CK_THFICHA_TPACAO",
  drop constraint "CK_THFICHA_MOTIVO",
  add constraint "CK_THFICHA_TPACAO" check ("TP_ACAO" in ('CRIAR', 'PEGAR', 'RESERVAR', 'LIBERAR', 'LIBERAR_RESERVA', 'DISTRIBUIR',
    'REDISTRIBUIR', 'DEVOLVER_FILA', 'REVISAR', 'SAIR_LOTE', 'VOLTAR_LOTE', 'SALVAR', 'CONCLUIR', 'REABRIR')),
  add constraint "CK_THFICHA_MOTIVO" check (
    "TP_ACAO" not in ('REDISTRIBUIR', 'DEVOLVER_FILA', 'LIBERAR_RESERVA', 'REVISAR', 'REABRIR')
    or length(btrim(coalesce("DS_MOTIVO", ''))) between 10 and 2000),
  add constraint "CK_THFICHA_CONTEUDO" check (
    ("TP_RESULTADO" is null or "TP_RESULTADO" in ('APTO', 'INAPTO_REQUISITO', 'INAPTO_NOTA'))
    and coalesce("VL_NOTA_FINAL", 0) between 0 and 1000
    and ("DS_ALTERACAO" is null or jsonb_typeof("DS_ALTERACAO") = 'array')
    and ("DS_RETRATO" is null or jsonb_typeof("DS_RETRATO") = 'object')
    and ("TP_ACAO" not in ('SALVAR', 'CONCLUIR') or "DS_RETRATO" is not null));
comment on table public."TH_FICHA_ANALISE" is
  'Histórico imutável da ficha: criação, pegar, reservar e liberar, distribuição e redistribuição (com motivo), devolução à fila, envio à revisão, saída ou volta ao lote e, do conteúdo, cada rascunho com alteração, a conclusão e a reabertura (com motivo), com o retrato do lançamento e o que mudou.';
comment on column public."TH_FICHA_ANALISE"."TP_ACAO" is 'CRIAR, PEGAR (Pegar próximo), RESERVAR (abriu), LIBERAR (fechou), LIBERAR_RESERVA (a coordenação liberou a reserva de outra pessoa), DISTRIBUIR, REDISTRIBUIR, DEVOLVER_FILA, REVISAR, SAIR_LOTE, VOLTAR_LOTE, SALVAR (rascunho com alteração), CONCLUIR ou REABRIR.';
comment on column public."TH_FICHA_ANALISE"."DS_MOTIVO" is 'Motivo (obrigatório, 10 a 2.000, em redistribuir, devolver à fila, liberar a reserva de outra pessoa, mandar para revisão e reabrir; nas saídas e entradas do lote, o motivo da pré-classificação).';
comment on column public."TH_FICHA_ANALISE"."TP_RESULTADO" is 'Resultado da conta depois da ação (rascunho ou conclusão).';
comment on column public."TH_FICHA_ANALISE"."VL_NOTA_FINAL" is 'Nota final depois da ação (rascunho ou conclusão).';
comment on column public."TH_FICHA_ANALISE"."DS_ALTERACAO" is 'O que mudou no conteúdo: [{campo, bloco, parcial, rotulo, de, para, justificativas}] — situação e motivos dos blocos, nota ajustada, justificativas, parciais (de quanto para quanto), itens, resultado e nota.';
comment on column public."TH_FICHA_ANALISE"."DS_RETRATO" is 'Retrato do conteúdo depois da ação ({lancamento, resultado, parecer, versao_regra}); obrigatório em SALVAR e CONCLUIR.';
comment on constraint "CK_THFICHA_TPACAO" on public."TH_FICHA_ANALISE" is 'Ações válidas.';
comment on constraint "CK_THFICHA_MOTIVO" on public."TH_FICHA_ANALISE" is 'Motivo de 10 a 2.000 caracteres nas ações que mexem no trabalho de outra pessoa e na reabertura.';
comment on constraint "CK_THFICHA_CONTEUDO" on public."TH_FICHA_ANALISE" is 'Resultado válido, nota de 0 a 1.000, alterações em lista, retrato em objeto (obrigatório ao salvar e concluir).';

-- 3. Funções de apoio ---------------------------------------------------------------------------
create function private."FC_TEXTO_COMPARAVEL"(p_texto text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select btrim(regexp_replace(lower(translate(
           regexp_replace(coalesce(p_texto, ''), '&nbsp;|&#160;', ' ', 'gi'),
           'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
           'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')), '\s+', ' ', 'g'));
$function$;
comment on function private."FC_TEXTO_COMPARAVEL"(text) is
  'Texto comparável como normalizarTexto (src/lib/avaliacao-documental/nota-declarada.js): &nbsp; vira espaço, sem acento, minúsculo e espaços simples.';
revoke all on function private."FC_TEXTO_COMPARAVEL"(text) from public, anon, authenticated;

create function private."FC_RESPOSTAS_DA_FICHA"(p_candidato uuid, p_regra jsonb)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  with textos as (
    select jsonb_array_elements_text(b -> 'perguntas') as t
      from jsonb_array_elements(case when jsonb_typeof(p_regra -> 'blocos') = 'array' then p_regra -> 'blocos' else '[]'::jsonb end) b
     where jsonb_typeof(b -> 'perguntas') = 'array'
    union all
    select case when jsonb_typeof(d -> 'pergunta') = 'string' then d ->> 'pergunta' end
      from jsonb_array_elements(case when jsonb_typeof(p_regra #> '{provisoria,nota_declarada}') = 'array'
                                     then p_regra #> '{provisoria,nota_declarada}' else '[]'::jsonb end) d
    union all
    select a
      from jsonb_array_elements(case when jsonb_typeof(p_regra #> '{provisoria,nota_declarada}') = 'array'
                                     then p_regra #> '{provisoria,nota_declarada}' else '[]'::jsonb end) d,
           lateral jsonb_array_elements_text(case when jsonb_typeof(d -> 'pergunta') = 'array' then d -> 'pergunta' else '[]'::jsonb end) a
    union all
    select case when jsonb_typeof(p_regra #> '{provisoria,pergunta_experiencia}') = 'string'
                then p_regra #>> '{provisoria,pergunta_experiencia}' end
    union all
    select a from jsonb_array_elements_text(case when jsonb_typeof(p_regra #> '{provisoria,pergunta_experiencia}') = 'array'
                                                 then p_regra #> '{provisoria,pergunta_experiencia}' else '[]'::jsonb end) a
  ),
  alvos as (
    select distinct private."FC_TEXTO_COMPARAVEL"(t) as alvo from textos where coalesce(btrim(t), '') <> ''
  ),
  colunas as (
    select k.key as coluna, k.value as valor, private."FC_TEXTO_COMPARAVEL"(k.key) as nome
      from public."TB_EMPREGARE_CANDIDATO" c,
           lateral jsonb_each(c."DS_COLUNA_ORIGINAL") k
     where c."CO_EMPREGARE_CANDIDATO" = p_candidato and k.key ~* '^\s*pergunta'
  )
  select coalesce(jsonb_object_agg(k.coluna, k.valor), '{}'::jsonb)
    from colunas k
   where exists (
     select 1 from alvos a
      where a.alvo <> ''
        and (left(k.nome, length(a.alvo)) = a.alvo
             or left(regexp_replace(k.nome, '^pergunta ?[0-9]+ ?[-–—] ?', ''), length(a.alvo)) = a.alvo));
$function$;
comment on function private."FC_RESPOSTAS_DA_FICHA"(uuid, jsonb) is
  'As respostas da Empregare do inscrito (DS_COLUNA_ORIGINAL) só das colunas "Pergunta N - …" que a regra usa: as perguntas dos blocos, da nota declarada e da experiência, casadas pelo começo do nome ou do enunciado como colunasDaPergunta (nota-declarada.js). Nunca as colunas de cadastro nem as perguntas que a regra não liga.';
revoke all on function private."FC_RESPOSTAS_DA_FICHA"(uuid, jsonb) from public, anon, authenticated;

create function private."FC_REGRA_VIGENTE_FICHA"(p_ficha uuid, out p_versao integer, out p_situacao text, out p_configuracao jsonb)
language sql
stable
security definer
set search_path to ''
as $function$
  select h."NU_VERSAO", case when h."NU_VERSAO" = r."NU_VERSAO_VIGENTE" then r."TP_SITUACAO" else 'CONFERIDA' end, h."DS_CONFIGURACAO"
    from public."TB_FICHA_ANALISE" f
    join public."TB_REGRA_ANALISE" r on r."CO_REGRA_ANALISE" = f."CO_REGRA_ANALISE"
    join public."TH_REGRA_ANALISE" h
      on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE"
     and h."NU_VERSAO" = case when f."TP_SITUACAO" = 'CONCLUIDA' then f."NU_VERSAO_REGRA" else r."NU_VERSAO_VIGENTE" end
   where f."CO_FICHA_ANALISE" = p_ficha;
$function$;
comment on function private."FC_REGRA_VIGENTE_FICHA"(uuid) is
  'A regra com que a ficha é analisada (AM-2.3): a versão gravada se concluída; senão a vigente do edital (com a situação Conferir/Conferida).';
revoke all on function private."FC_REGRA_VIGENTE_FICHA"(uuid) from public, anon, authenticated;

create function private."FC_DOCUMENTAL_DO_EDITAL"(p_edital uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce((
    select jsonb_build_object(
             'nota_minima', h."DS_CONFIGURACAO" #> '{documental,nota_minima}',
             'nota_minima_por_nivel', coalesce(h."DS_CONFIGURACAO" #> '{documental,nota_minima_por_nivel}', '{}'::jsonb),
             'niveis_por_cargo', coalesce(h."DS_CONFIGURACAO" #> '{documental,niveis_por_cargo}', '[]'::jsonb),
             'nivel_padrao', h."DS_CONFIGURACAO" #> '{documental,nivel_padrao}')
      from public."TB_REGRA_CLASSIFICACAO" r
      join public."TH_REGRA_CLASSIFICACAO" h
        on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
     where r."CO_MONITORAMENTO" = p_edital), '{}'::jsonb);
$function$;
comment on function private."FC_DOCUMENTAL_DO_EDITAL"(uuid) is
  'Da regra de classificação vigente do edital, o que a ficha usa: nota mínima (geral e por nível) e como achar o nível da vaga (niveis_por_cargo, nivel_padrao).';
revoke all on function private."FC_DOCUMENTAL_DO_EDITAL"(uuid) from public, anon, authenticated;

create function private."FC_BLOCO_SE_APLICA"(p_bloco jsonb, p_lancamento jsonb)
returns boolean
language sql
immutable
set search_path to ''
as $function$
  select case
           when coalesce(p_bloco ->> 'condicao', case when p_bloco ->> 'tipo' = 'PONTUACAO' then 'INDIGENA' end) is null then true
           when coalesce(p_bloco ->> 'condicao', 'INDIGENA') = 'INDIGENA' then coalesce((p_lancamento ->> 'indigena')::boolean, false)
           else upper(coalesce(p_lancamento ->> 'modalidade', '')) = upper(split_part(p_bloco ->> 'condicao', '=', 2))
         end;
$function$;
comment on function private."FC_BLOCO_SE_APLICA"(jsonb, jsonb) is 'O bloco vale para o candidato (condição INDIGENA ou MODALIDADE=…; o critério étnico só para quem se declarou indígena), como blocoSeAplica (ficha.js).';
revoke all on function private."FC_BLOCO_SE_APLICA"(jsonb, jsonb) from public, anon, authenticated;

create function private."FC_TETO_DO_BLOCO"(p_bloco jsonb, p_nivel text)
returns numeric
language sql
immutable
set search_path to ''
as $function$
  select case when jsonb_typeof(x.teto) = 'number' then (x.teto #>> '{}')::numeric end
    from (select case when p_bloco ->> 'tipo' in ('CURSOS', 'VINCULOS') and p_bloco #> array['por_nivel', p_nivel, 'teto'] is not null
                      then p_bloco #> array['por_nivel', p_nivel, 'teto']
                      else p_bloco -> 'teto' end as teto) x;
$function$;
comment on function private."FC_TETO_DO_BLOCO"(jsonb, text) is 'Teto de pontos do bloco no nível da vaga (por_nivel nos cursos e na experiência), como tetoDoBloco (pontuacao.js); nulo = sem teto.';
revoke all on function private."FC_TETO_DO_BLOCO"(jsonb, text) from public, anon, authenticated;

create function private."FC_PARCIAL_DO_TIPO"(p_tipo text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case p_tipo when 'PONTUACAO' then 'ETNICO' when 'TITULOS' then 'FORMACAO'
                     when 'CURSOS' then 'CURSOS' when 'VINCULOS' then 'EXPERIENCIA' end;
$function$;
comment on function private."FC_PARCIAL_DO_TIPO"(text) is 'A parcial que cada tipo de bloco pontua (PARCIAL_DO_TIPO de catalogo.js).';
revoke all on function private."FC_PARCIAL_DO_TIPO"(text) from public, anon, authenticated;

create function private."FC_VALIDAR_LANCAMENTO_FICHA"(p_regra jsonb, p_lanc jsonb)
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
end;
$function$;
comment on function private."FC_VALIDAR_LANCAMENTO_FICHA"(jsonb, jsonb) is
  'Confere a estrutura do lançamento da ficha contra a regra (22023): nível, modalidade, blocos e motivos/justificativas da regra, nota ajustada de 0 ao teto do bloco no nível, até 50 títulos/cursos/vínculos com campos válidos, datas e textos limitados. Não refaz a conta.';
revoke all on function private."FC_VALIDAR_LANCAMENTO_FICHA"(jsonb, jsonb) from public, anon, authenticated;

create function private."FC_VALIDAR_RESULTADO_FICHA"(p_regra jsonb, p_lanc jsonb, p_res jsonb, p_documental jsonb)
returns void
language plpgsql
immutable
set search_path to ''
as $function$
declare
  v_resultado text := p_res ->> 'resultado';
  v_nivel text := p_lanc ->> 'nivel';
  v_apurada numeric;
  v_final numeric;
  v_soma numeric := 0;
  v_minima numeric;
  v_item record;
  v_bloco jsonb;
  v_lancado jsonb;
  v_teto numeric;
  v_elimina boolean := false;
begin
  if jsonb_typeof(p_res) is distinct from 'object' or length(p_res::text) > 100000 then
    raise exception 'Resultado da ficha inválido.' using errcode = '22023';
  end if;
  if v_resultado is null or v_resultado not in ('APTO', 'INAPTO_REQUISITO', 'INAPTO_NOTA') then
    raise exception 'Resultado inválido.' using errcode = '22023';
  end if;
  if not private."FC_JSON_NUMERO_OBRIGATORIO"(p_res -> 'nota_apurada', 0, 1000) or not private."FC_JSON_NUMERO_OBRIGATORIO"(p_res -> 'nota_final', 0, 1000) then
    raise exception 'Notas de 0 a 1.000.' using errcode = '22023';
  end if;
  v_apurada := (p_res ->> 'nota_apurada')::numeric;
  v_final := (p_res ->> 'nota_final')::numeric;
  if jsonb_typeof(coalesce(p_res -> 'parciais', '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_res -> 'eliminatorios', '[]'::jsonb)) <> 'array' then
    raise exception 'Parciais ou motivos inválidos.' using errcode = '22023';
  end if;

  -- Cada parcial é de um bloco da regra, de 0 ao teto; a nota ajustada vale (ou o bloco zerou).
  for v_item in select key, value from jsonb_each(coalesce(p_res -> 'parciais', '{}'::jsonb)) loop
    select b into v_bloco from jsonb_array_elements(coalesce(p_regra -> 'blocos', '[]'::jsonb)) b
     where private."FC_PARCIAL_DO_TIPO"(b ->> 'tipo') = v_item.key limit 1;
    if v_bloco is null then
      raise exception 'A parcial % não é de um bloco da regra.', v_item.key using errcode = '22023';
    end if;
    v_teto := coalesce(private."FC_TETO_DO_BLOCO"(v_bloco, v_nivel), 1000);
    if not private."FC_JSON_NUMERO_OBRIGATORIO"(v_item.value, 0, v_teto) then
      raise exception 'A parcial % passa do teto de % pontos.', v_item.key, v_teto using errcode = '22023';
    end if;
    v_lancado := p_lanc #> array['blocos', v_bloco ->> 'codigo'];
    if jsonb_typeof(v_lancado -> 'nota_ajustada') = 'number'
       and (v_item.value #>> '{}')::numeric <> 0
       and abs((v_item.value #>> '{}')::numeric - least((v_lancado ->> 'nota_ajustada')::numeric, v_teto)) > 0.0001 then
      raise exception 'A parcial % não é a nota ajustada do bloco.', v_item.key using errcode = '22023';
    end if;
    v_soma := v_soma + (v_item.value #>> '{}')::numeric;
  end loop;
  if abs(v_soma - v_apurada) > 0.001 then
    raise exception 'A nota apurada não é a soma das parciais.' using errcode = '22023';
  end if;
  if abs(v_final - case when v_resultado = 'INAPTO_REQUISITO' then 0 else v_apurada end) > 0.001 then
    raise exception 'A nota final não confere com o resultado.' using errcode = '22023';
  end if;
  if (v_resultado = 'INAPTO_REQUISITO') <> (jsonb_array_length(coalesce(p_res -> 'eliminatorios', '[]'::jsonb)) > 0) then
    raise exception 'Inapto por requisito exige o motivo eliminatório (e só ele).' using errcode = '22023';
  end if;

  -- Bloco eliminatório (pela situação, sem motivo mais brando) exige Inapto por requisito.
  for v_bloco in select b from jsonb_array_elements(coalesce(p_regra -> 'blocos', '[]'::jsonb)) b loop
    v_lancado := p_lanc #> array['blocos', v_bloco ->> 'codigo'];
    continue when v_lancado is null or not private."FC_BLOCO_SE_APLICA"(v_bloco, p_lanc)
               or coalesce(v_lancado ->> 'situacao', '') not in ('NAO_CONFORME', 'NAO_ENVIADO');
    if exists (select 1 from jsonb_array_elements_text(coalesce(v_lancado -> 'motivos', '[]'::jsonb)) m
                 join jsonb_array_elements(coalesce(v_bloco -> 'motivos', '[]'::jsonb)) x on x ->> 'codigo' = m
                where coalesce(x ->> 'efeito', '') <> '') then
      v_elimina := v_elimina or exists (
        select 1 from jsonb_array_elements_text(coalesce(v_lancado -> 'motivos', '[]'::jsonb)) m
          join jsonb_array_elements(coalesce(v_bloco -> 'motivos', '[]'::jsonb)) x on x ->> 'codigo' = m
         where x ->> 'efeito' = 'ELIMINA');
    else
      v_elimina := v_elimina or (v_bloco #>> array['efeitos', v_lancado ->> 'situacao']) = 'ELIMINA';
    end if;
  end loop;
  if v_elimina and v_resultado <> 'INAPTO_REQUISITO' then
    raise exception 'Há bloco eliminatório: o resultado é Inapto por requisito.' using errcode = '22023';
  end if;

  -- Nota mínima da regra de classificação (por nível, se houver).
  v_minima := case when jsonb_typeof(p_documental #> array['nota_minima_por_nivel', v_nivel]) = 'number'
                   then (p_documental #>> array['nota_minima_por_nivel', v_nivel])::numeric
                   when jsonb_typeof(p_documental -> 'nota_minima') = 'number' then (p_documental ->> 'nota_minima')::numeric end;
  if v_resultado = 'APTO' and v_minima is not null and v_apurada < v_minima then
    raise exception 'Nota abaixo da mínima (%): o resultado é Inapto por nota.', v_minima using errcode = '22023';
  end if;
  if v_resultado = 'INAPTO_NOTA' and (v_minima is null or v_apurada >= v_minima) then
    raise exception 'Inapto por nota só abaixo da nota mínima.' using errcode = '22023';
  end if;
end;
$function$;
comment on function private."FC_VALIDAR_RESULTADO_FICHA"(jsonb, jsonb, jsonb, jsonb) is
  'Revalida o resultado que a tela calculou (22023): parciais de blocos da regra até o teto, nota ajustada respeitada, soma = nota apurada, nota final 0 só no inapto por requisito, motivo eliminatório presente, bloco eliminatório marcado ⇒ inapto por requisito, apto/inapto por nota coerente com a nota mínima da regra de classificação. A conta inteira é reconferida pelo Python.';
revoke all on function private."FC_VALIDAR_RESULTADO_FICHA"(jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;

create function private."FC_PENDENCIAS_FICHA"(p_regra jsonb, p_lanc jsonb, p_res jsonb)
returns text[]
language plpgsql
immutable
set search_path to ''
as $function$
declare
  v_bloco jsonb;
  v_l jsonb;
  v_parcial text;
  v_decl jsonb;
  v_apur jsonb;
  v_tem_opcoes boolean;
  v_itens text;
  v_pend text[] := '{}';
  v_titulo text;
begin
  for v_bloco in select b from jsonb_array_elements(coalesce(p_regra -> 'blocos', '[]'::jsonb)) b loop
    continue when v_bloco ->> 'tipo' = 'REGISTRO' or not private."FC_BLOCO_SE_APLICA"(v_bloco, p_lanc);
    v_l := coalesce(p_lanc #> array['blocos', v_bloco ->> 'codigo'], '{}'::jsonb);
    v_titulo := coalesce(v_bloco ->> 'titulo', v_bloco ->> 'codigo');
    if coalesce(v_l ->> 'situacao', '') = '' then
      v_pend := v_pend || (v_titulo || ': marque a situação');
    end if;
    if v_l ->> 'situacao' in ('NAO_CONFORME', 'NAO_ENVIADO')
       and jsonb_array_length(coalesce(v_l -> 'motivos', '[]'::jsonb)) = 0
       and not (jsonb_array_length(coalesce(v_bloco -> 'motivos', '[]'::jsonb)) = 0 and length(btrim(coalesce(v_l ->> 'motivo_livre', ''))) >= 10) then
      v_pend := v_pend || (v_titulo || ': escolha o motivo');
    end if;
    v_itens := case v_bloco ->> 'tipo' when 'TITULOS' then 'titulos' when 'CURSOS' then 'cursos' when 'VINCULOS' then 'vinculos' end;
    if v_itens is not null and exists (
         select 1 from jsonb_array_elements(coalesce(p_lanc -> v_itens, '[]'::jsonb)) i
          where i -> 'aceito' = 'false'::jsonb and coalesce(i ->> 'motivo', '') = '') then
      v_pend := v_pend || (v_titulo || ': item recusado sem motivo');
    end if;
    if v_itens = 'vinculos' and exists (
         select 1 from jsonb_array_elements(coalesce(p_lanc -> 'vinculos', '[]'::jsonb)) i
          where coalesce(i ->> 'inicio', '') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(i ->> 'fim', '') !~ '^\d{4}-\d{2}-\d{2}$'
             or i ->> 'fim' < i ->> 'inicio') then
      v_pend := v_pend || (v_titulo || ': vínculo com data inválida');
    end if;
    -- Nota diferente da declarada exige justificativa (fora do inapto por requisito).
    v_parcial := private."FC_PARCIAL_DO_TIPO"(v_bloco ->> 'tipo');
    v_decl := p_res #> array['declarada', coalesce(v_parcial, '')];
    v_apur := p_res #> array['parciais', coalesce(v_parcial, '')];
    if v_parcial is not null and p_res ->> 'resultado' <> 'INAPTO_REQUISITO'
       and jsonb_typeof(v_decl) = 'number' and jsonb_typeof(v_apur) = 'number'
       and abs((v_decl #>> '{}')::numeric - (v_apur #>> '{}')::numeric) > 0.0001 then
      v_tem_opcoes := jsonb_array_length(coalesce(v_bloco -> 'motivos', '[]'::jsonb)) > 0
                      or jsonb_array_length(coalesce(p_regra -> 'observacoes_prontas', '[]'::jsonb)) > 0;
      if jsonb_array_length(coalesce(v_l -> 'justificativas', '[]'::jsonb)) = 0
         and not (v_l ->> 'situacao' in ('NAO_CONFORME', 'NAO_ENVIADO')
                  and (jsonb_array_length(coalesce(v_l -> 'motivos', '[]'::jsonb)) > 0 or length(btrim(coalesce(v_l ->> 'motivo_livre', ''))) >= 10))
         and not (not v_tem_opcoes and length(btrim(coalesce(v_l ->> 'justificativa_livre', ''))) >= 10) then
        v_pend := v_pend || (v_titulo || ': nota diferente da declarada sem justificativa');
      end if;
    end if;
  end loop;
  return v_pend;
end;
$function$;
comment on function private."FC_PENDENCIAS_FICHA"(jsonb, jsonb, jsonb) is
  'O que falta para concluir (pendenciasDaFicha de ficha.js): situação de cada bloco que se aplica, motivo do Não conforme/Não enviado, motivo do item recusado, datas dos vínculos e justificativa de toda nota diferente da declarada (fora do inapto por requisito). Vazio = pode concluir.';
revoke all on function private."FC_PENDENCIAS_FICHA"(jsonb, jsonb, jsonb) from public, anon, authenticated;

create function private."FC_ALTERACOES_FICHA"(p_regra jsonb, p_antes_lanc jsonb, p_antes_res jsonb, p_lanc jsonb, p_res jsonb)
returns jsonb
language sql
immutable
set search_path to ''
as $function$
  with blocos as (
    select b ->> 'codigo' as codigo, coalesce(b ->> 'titulo', b ->> 'codigo') as titulo,
           private."FC_PARCIAL_DO_TIPO"(b ->> 'tipo') as parcial, o.n
      from jsonb_array_elements(coalesce(p_regra -> 'blocos', '[]'::jsonb)) with ordinality o(b, n)
  ),
  mudancas as (
    select x.n * 10 + x.k as ordem, x.alt
      from blocos bl,
           lateral (values
             (bl.n, 1, case when (p_antes_lanc #> array['blocos', bl.codigo, 'situacao']) is distinct from (p_lanc #> array['blocos', bl.codigo, 'situacao'])
                     then jsonb_build_object('campo', 'situacao', 'bloco', bl.codigo, 'rotulo', bl.titulo,
                                             'de', p_antes_lanc #>> array['blocos', bl.codigo, 'situacao'],
                                             'para', p_lanc #>> array['blocos', bl.codigo, 'situacao']) end),
             (bl.n, 2, case when coalesce(p_antes_lanc #> array['blocos', bl.codigo, 'motivos'], '[]') is distinct from coalesce(p_lanc #> array['blocos', bl.codigo, 'motivos'], '[]')
                       or coalesce(p_antes_lanc #>> array['blocos', bl.codigo, 'motivo_livre'], '') is distinct from coalesce(p_lanc #>> array['blocos', bl.codigo, 'motivo_livre'], '')
                     then jsonb_build_object('campo', 'motivos', 'bloco', bl.codigo, 'rotulo', bl.titulo || ' (motivo)',
                                             'de', p_antes_lanc #> array['blocos', bl.codigo, 'motivos'],
                                             'para', p_lanc #> array['blocos', bl.codigo, 'motivos']) end),
             (bl.n, 3, case when bl.parcial is not null and (p_antes_res #> array['parciais', bl.parcial]) is distinct from (p_res #> array['parciais', bl.parcial])
                     then jsonb_build_object('campo', 'parcial', 'bloco', bl.codigo, 'parcial', bl.parcial, 'rotulo', bl.titulo,
                                             'de', p_antes_res #> array['parciais', bl.parcial], 'para', p_res #> array['parciais', bl.parcial],
                                             'ajustada', p_lanc #> array['blocos', bl.codigo, 'nota_ajustada'],
                                             'justificativas', p_lanc #> array['blocos', bl.codigo, 'justificativas']) end),
             (bl.n, 4, case when coalesce(p_antes_lanc #> array['blocos', bl.codigo, 'justificativas'], '[]') is distinct from coalesce(p_lanc #> array['blocos', bl.codigo, 'justificativas'], '[]')
                       or coalesce(p_antes_lanc #>> array['blocos', bl.codigo, 'justificativa_livre'], '') is distinct from coalesce(p_lanc #>> array['blocos', bl.codigo, 'justificativa_livre'], '')
                     then jsonb_build_object('campo', 'justificativas', 'bloco', bl.codigo, 'rotulo', bl.titulo || ' (justificativa)',
                                             'de', p_antes_lanc #> array['blocos', bl.codigo, 'justificativas'],
                                             'para', p_lanc #> array['blocos', bl.codigo, 'justificativas']) end)
           ) x(n, k, alt)
    union all
    select 100000 + v.k, v.alt
      from (values
        (1, case when jsonb_array_length(coalesce(p_antes_lanc -> 'titulos', '[]')) <> jsonb_array_length(coalesce(p_lanc -> 'titulos', '[]'))
                 then jsonb_build_object('campo', 'itens', 'rotulo', 'Títulos', 'de', jsonb_array_length(coalesce(p_antes_lanc -> 'titulos', '[]')),
                                         'para', jsonb_array_length(coalesce(p_lanc -> 'titulos', '[]'))) end),
        (2, case when jsonb_array_length(coalesce(p_antes_lanc -> 'cursos', '[]')) <> jsonb_array_length(coalesce(p_lanc -> 'cursos', '[]'))
                 then jsonb_build_object('campo', 'itens', 'rotulo', 'Cursos', 'de', jsonb_array_length(coalesce(p_antes_lanc -> 'cursos', '[]')),
                                         'para', jsonb_array_length(coalesce(p_lanc -> 'cursos', '[]'))) end),
        (3, case when jsonb_array_length(coalesce(p_antes_lanc -> 'vinculos', '[]')) <> jsonb_array_length(coalesce(p_lanc -> 'vinculos', '[]'))
                 then jsonb_build_object('campo', 'itens', 'rotulo', 'Vínculos', 'de', jsonb_array_length(coalesce(p_antes_lanc -> 'vinculos', '[]')),
                                         'para', jsonb_array_length(coalesce(p_lanc -> 'vinculos', '[]'))) end),
        (4, case when coalesce(p_antes_lanc ->> 'observacoes', '') <> coalesce(p_lanc ->> 'observacoes', '')
                   or coalesce(p_antes_lanc -> 'observacoes_prontas', '[]') <> coalesce(p_lanc -> 'observacoes_prontas', '[]')
                 then jsonb_build_object('campo', 'observacoes', 'rotulo', 'Observações') end),
        (5, case when (p_antes_res -> 'resultado') is distinct from (p_res -> 'resultado')
                 then jsonb_build_object('campo', 'resultado', 'rotulo', 'Resultado', 'de', p_antes_res -> 'resultado', 'para', p_res -> 'resultado') end),
        (6, case when (p_antes_res -> 'nota_final') is distinct from (p_res -> 'nota_final')
                 then jsonb_build_object('campo', 'nota_final', 'rotulo', 'Nota final', 'de', p_antes_res -> 'nota_final', 'para', p_res -> 'nota_final') end),
        (7, case when coalesce(p_antes_lanc ->> 'nivel', '') <> coalesce(p_lanc ->> 'nivel', '')
                   or coalesce(p_antes_lanc -> 'indigena', 'false') <> coalesce(p_lanc -> 'indigena', 'false')
                   or coalesce(p_antes_lanc -> 'mora_aldeia', 'false') <> coalesce(p_lanc -> 'mora_aldeia', 'false')
                   or coalesce(p_antes_lanc -> 'aldeia_na_lista', 'false') <> coalesce(p_lanc -> 'aldeia_na_lista', 'false')
                 then jsonb_build_object('campo', 'candidato', 'rotulo', 'Nível, indígena ou aldeia') end)
      ) v(k, alt)
  )
  select coalesce(jsonb_agg(m.alt order by m.ordem), '[]'::jsonb)
    from (select * from mudancas where alt is not null order by ordem limit 60) m;
$function$;
comment on function private."FC_ALTERACOES_FICHA"(jsonb, jsonb, jsonb, jsonb, jsonb) is
  'O que mudou entre dois lançamentos da ficha (para o histórico): situação e motivo de cada bloco, parcial de quanto para quanto (com a nota ajustada e as justificativas), justificativas, número de títulos/cursos/vínculos, observações, nível/indígena/aldeia, resultado e nota final. Até 60 itens.';
revoke all on function private."FC_ALTERACOES_FICHA"(jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;

create function private."FC_HISTORICO_CONTEUDO_FICHA"(
  p_ficha uuid, p_acao text, p_situacao_anterior text, p_motivo text, p_usuario uuid, p_alteracao jsonb, p_retrato jsonb)
returns void
language sql
security definer
set search_path to ''
as $function$
  insert into public."TH_FICHA_ANALISE"
    ("CO_FICHA_ANALISE", "NU_VERSAO", "TP_ACAO", "TP_SITUACAO_ANTERIOR", "TP_SITUACAO", "CO_USUARIO_RESP_ANTERIOR",
     "CO_USUARIO_RESPONSAVEL", "DS_MOTIVO", "TP_ORIGEM", "CO_USUARIO", "TP_RESULTADO", "VL_NOTA_FINAL", "DS_ALTERACAO", "DS_RETRATO")
  select f."CO_FICHA_ANALISE", f."NU_VERSAO", p_acao, p_situacao_anterior, f."TP_SITUACAO", f."CO_USUARIO_RESPONSAVEL",
         f."CO_USUARIO_RESPONSAVEL", nullif(left(btrim(coalesce(p_motivo, '')), 2000), ''), 'TELA', p_usuario,
         f."DS_RESULTADO" ->> 'resultado',
         case when jsonb_typeof(f."DS_RESULTADO" -> 'nota_final') = 'number' then (f."DS_RESULTADO" ->> 'nota_final')::numeric end,
         p_alteracao, p_retrato
    from public."TB_FICHA_ANALISE" f
   where f."CO_FICHA_ANALISE" = p_ficha;
$function$;
comment on function private."FC_HISTORICO_CONTEUDO_FICHA"(uuid, text, text, text, uuid, jsonb, jsonb) is
  'Grava em TH_FICHA_ANALISE uma ação sobre o conteúdo (SALVAR, CONCLUIR, REABRIR) com o resultado e a nota de depois, o que mudou e o retrato.';
revoke all on function private."FC_HISTORICO_CONTEUDO_FICHA"(uuid, text, text, text, uuid, jsonb, jsonb) from public, anon, authenticated;

create function private."FC_EXIGIR_VER_FICHA"(p_ficha public."TB_FICHA_ANALISE")
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_papel text;
begin
  if p_ficha."CO_FICHA_ANALISE" is null then
    raise exception 'Ficha não encontrada' using errcode = '22023';
  end if;
  perform private."FC_EXIGIR_AVALIACAO_EDITAL"(p_ficha."CO_MONITORAMENTO", 1);
  v_papel := private."FC_PAPEL_AVALIACAO"(p_ficha."CO_MONITORAMENTO");
  if coalesce(v_papel, '') in ('COORDENADOR', 'REVISOR')
     or private."FC_PODE_ANALISAR_VAGA"(p_ficha."CO_MONITORAMENTO", (select auth.uid()), p_ficha."CO_VAGA")
     or (v_papel is null and p_ficha."TP_SITUACAO" = 'CONCLUIDA') then
    return v_papel;
  end if;
  raise exception 'Esta ficha é de uma vaga que você não analisa' using errcode = '42501';
end;
$function$;
comment on function private."FC_EXIGIR_VER_FICHA"(public."TB_FICHA_ANALISE") is
  'Barra (42501) quem não vê a ficha: vê a coordenação e a revisão do edital, o analista da vaga e, só concluída, quem lê a avaliação documental sem papel na equipe. Devolve o papel.';
revoke all on function private."FC_EXIGIR_VER_FICHA"(public."TB_FICHA_ANALISE") from public, anon, authenticated;

create function private."FC_EXIGIR_GRAVAR_FICHA"(p_ficha public."TB_FICHA_ANALISE", p_versao integer)
returns void
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
begin
  if p_ficha."CO_FICHA_ANALISE" is null then
    raise exception 'Ficha não encontrada' using errcode = '22023';
  end if;
  perform private."FC_EXIGIR_AVALIACAO_EDITAL"(p_ficha."CO_MONITORAMENTO", 2);
  if p_ficha."TP_SITUACAO" <> 'EM_ANALISE' then
    raise exception 'A ficha não está em análise (%): só leitura.', lower(p_ficha."TP_SITUACAO") using errcode = '22023';
  end if;
  if p_ficha."CO_USUARIO_RESERVA" is distinct from v_uid or p_ficha."DT_RESERVA_EXPIRA" <= now() then
    raise exception 'A ficha não está mais com você (reserva vencida, liberada ou com outra pessoa); abra de novo.' using errcode = '55P03';
  end if;
  if not (private."FC_PODE_ANALISAR_VAGA"(p_ficha."CO_MONITORAMENTO", v_uid, p_ficha."CO_VAGA")
          or coalesce(private."FC_PAPEL_AVALIACAO"(p_ficha."CO_MONITORAMENTO"), '') = 'COORDENADOR') then
    raise exception 'Você não analisa a vaga %.', p_ficha."CO_VAGA" using errcode = '42501';
  end if;
  if p_versao is distinct from p_ficha."NU_VERSAO" then
    raise exception 'Esta ficha mudou desde que você abriu (outra aba ou outra pessoa); recarregue.' using errcode = '40001';
  end if;
end;
$function$;
comment on function private."FC_EXIGIR_GRAVAR_FICHA"(public."TB_FICHA_ANALISE", integer) is
  'Barra quem não pode gravar o conteúdo: ficha fora de análise (22023), sem a reserva vigente de quem chama (55P03), quem não analisa a vaga nem coordena (42501) e versão velha (40001).';
revoke all on function private."FC_EXIGIR_GRAVAR_FICHA"(public."TB_FICHA_ANALISE", integer) from public, anon, authenticated;

-- 4. RPCs da ficha ---------------------------------------------------------------------------------
create function public.obter_ficha_analise(p_ficha uuid)
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
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha;
  v_papel := private."FC_EXIGIR_VER_FICHA"(v_f);
  select * into v_regra from private."FC_REGRA_VIGENTE_FICHA"(p_ficha);
  select r."NU_VERSAO_VIGENTE" into v_vigente from public."TB_REGRA_ANALISE" r where r."CO_REGRA_ANALISE" = v_f."CO_REGRA_ANALISE";
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = v_f."CO_MONITORAMENTO";
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
  'A ficha para analisar (json): o cabeçalho (sem CPF nem contato), o lançamento e o resultado gravados, a regra com que é analisada (a vigente; a da conclusão, se concluída — AM-2.3), a nota mínima e os níveis da regra de classificação, a nota declarada e a ART da pré-classificação, as respostas da Empregare SÓ das perguntas que a regra liga, o histórico (até 200, com as alterações) e se quem chama pode editar (reserva vigente, em análise) ou reabrir (coordenação, concluída). Vê: coordenação e revisão; o analista, só nas vagas dele; o leitor, só concluída.';
revoke all on function public.obter_ficha_analise(uuid) from public, anon;
grant execute on function public.obter_ficha_analise(uuid) to authenticated;

create function public.salvar_rascunho_ficha(p_ficha uuid, p_versao integer, p_lancamento jsonb, p_resultado jsonb, p_parecer text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_f public."TB_FICHA_ANALISE";
  v_uid uuid := (select auth.uid());
  v_regra record;
  v_alt jsonb;
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha for update;
  perform private."FC_EXIGIR_GRAVAR_FICHA"(v_f, p_versao);
  select * into v_regra from private."FC_REGRA_VIGENTE_FICHA"(p_ficha);
  perform private."FC_VALIDAR_LANCAMENTO_FICHA"(v_regra.p_configuracao, p_lancamento);
  perform private."FC_VALIDAR_RESULTADO_FICHA"(v_regra.p_configuracao, p_lancamento, p_resultado,
                                                private."FC_DOCUMENTAL_DO_EDITAL"(v_f."CO_MONITORAMENTO"));
  if length(coalesce(p_parecer, '')) > 8000 then
    raise exception 'Parecer com até 8.000 caracteres.' using errcode = '22023';
  end if;
  v_alt := private."FC_ALTERACOES_FICHA"(v_regra.p_configuracao, v_f."DS_LANCAMENTO", v_f."DS_RESULTADO", p_lancamento, p_resultado);
  update public."TB_FICHA_ANALISE" set
    "DS_LANCAMENTO" = p_lancamento, "DS_RESULTADO" = p_resultado, "DS_PARECER" = nullif(btrim(coalesce(p_parecer, '')), ''),
    "CO_USUARIO_RASCUNHO" = v_uid, "DT_RASCUNHO" = now(),
    "DT_RESERVA_EXPIRA" = now() + private."FC_PRAZO_RESERVA_FICHA"(),
    "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
   where "CO_FICHA_ANALISE" = p_ficha;
  if jsonb_array_length(v_alt) > 0 then
    perform private."FC_HISTORICO_CONTEUDO_FICHA"(p_ficha, 'SALVAR', v_f."TP_SITUACAO", null, v_uid, v_alt,
      jsonb_build_object('lancamento', p_lancamento, 'resultado', p_resultado, 'versao_regra', v_regra.p_versao));
  end if;
  return json_build_object('versao', v_f."NU_VERSAO" + 1, 'salvo_em', now(), 'alteracoes', jsonb_array_length(v_alt),
                           'versao_regra', v_regra.p_versao);
end;
$function$;
comment on function public.salvar_rascunho_ficha(uuid, integer, jsonb, jsonb, text) is
  'Salva o rascunho da ficha (o salvamento automático da tela): lançamento, resultado da conta e parecer gerado, conferidos contra a regra vigente (estrutura, limites e coerência do resultado; nada é recalculado). Exige a reserva vigente de quem chama, em análise, e a versão que a tela abriu (40001); renova a reserva; sobe a versão. Alteração de conteúdo vai ao histórico (SALVAR, com o retrato e de quanto para quanto). Devolve a versão nova e a hora.';
revoke all on function public.salvar_rascunho_ficha(uuid, integer, jsonb, jsonb, text) from public, anon;
grant execute on function public.salvar_rascunho_ficha(uuid, integer, jsonb, jsonb, text) to authenticated;

create function public.concluir_ficha(
  p_ficha uuid, p_versao integer, p_versao_regra integer, p_lancamento jsonb, p_resultado jsonb, p_parecer text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_f public."TB_FICHA_ANALISE";
  v_uid uuid := (select auth.uid());
  v_regra record;
  v_alt jsonb;
  v_pend text[];
  v_parecer text := btrim(coalesce(p_parecer, ''));
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha for update;
  perform private."FC_EXIGIR_GRAVAR_FICHA"(v_f, p_versao);
  select * into v_regra from private."FC_REGRA_VIGENTE_FICHA"(p_ficha);
  if p_versao_regra is distinct from v_regra.p_versao then
    raise exception 'A regra mudou (versão %): a ficha foi recalculada; confira e conclua de novo.', v_regra.p_versao using errcode = '40001';
  end if;
  if v_regra.p_situacao <> 'CONFERIDA' then
    raise exception 'A versão % da regra ainda não foi conferida pela coordenação: dá para salvar o rascunho, mas não concluir.', v_regra.p_versao
      using errcode = '22023';
  end if;
  perform private."FC_VALIDAR_LANCAMENTO_FICHA"(v_regra.p_configuracao, p_lancamento);
  perform private."FC_VALIDAR_RESULTADO_FICHA"(v_regra.p_configuracao, p_lancamento, p_resultado,
                                                private."FC_DOCUMENTAL_DO_EDITAL"(v_f."CO_MONITORAMENTO"));
  v_pend := private."FC_PENDENCIAS_FICHA"(v_regra.p_configuracao, p_lancamento, p_resultado);
  if cardinality(v_pend) > 0 then
    raise exception 'Falta para concluir: %.', array_to_string(v_pend[1:5], '; ') using errcode = '22023';
  end if;
  if length(v_parecer) not between 1 and 8000 then
    raise exception 'O parecer é obrigatório (até 8.000 caracteres).' using errcode = '22023';
  end if;
  v_alt := private."FC_ALTERACOES_FICHA"(v_regra.p_configuracao, v_f."DS_LANCAMENTO", v_f."DS_RESULTADO", p_lancamento, p_resultado);
  update public."TB_FICHA_ANALISE" set
    "TP_SITUACAO" = 'CONCLUIDA', "NU_VERSAO_REGRA" = v_regra.p_versao,
    "DS_LANCAMENTO" = p_lancamento, "DS_RESULTADO" = p_resultado, "DS_PARECER" = v_parecer,
    "TP_RESULTADO" = p_resultado ->> 'resultado',
    "VL_NOTA_APURADA" = (p_resultado ->> 'nota_apurada')::numeric, "VL_NOTA_FINAL" = (p_resultado ->> 'nota_final')::numeric,
    "CO_USUARIO_CONCLUSAO" = v_uid, "DT_CONCLUSAO" = now(),
    "CO_USUARIO_RASCUNHO" = v_uid, "DT_RASCUNHO" = now(),
    "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null, "DT_RESERVA_EXPIRA" = null,
    "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
   where "CO_FICHA_ANALISE" = p_ficha;
  perform private."FC_HISTORICO_CONTEUDO_FICHA"(p_ficha, 'CONCLUIR', v_f."TP_SITUACAO", null, v_uid, v_alt,
    jsonb_build_object('lancamento', p_lancamento, 'resultado', p_resultado, 'parecer', v_parecer, 'versao_regra', v_regra.p_versao));
  return json_build_object('versao', v_f."NU_VERSAO" + 1, 'resultado', p_resultado ->> 'resultado',
                           'nota_final', (p_resultado ->> 'nota_final')::numeric, 'versao_regra', v_regra.p_versao);
end;
$function$;
comment on function public.concluir_ficha(uuid, integer, integer, jsonb, jsonb, text) is
  'Conclui a ficha: confere a reserva, a versão da ficha (40001), a versão da regra (tem de ser a vigente, 40001, e conferida, 22023), a estrutura e a coerência do resultado e o que falta (situação, motivos, itens recusados, datas e justificativa de nota diferente da declarada); grava resultado, notas, parecer, a versão da regra usada (AM-2.3), quem e quando (o login, AM-12.6); libera a reserva; histórico CONCLUIR com o retrato. A conta é a da tela, reconferida em lote pelo Python.';
revoke all on function public.concluir_ficha(uuid, integer, integer, jsonb, jsonb, text) from public, anon;
grant execute on function public.concluir_ficha(uuid, integer, integer, jsonb, jsonb, text) to authenticated;

create function public.reabrir_ficha(p_ficha uuid, p_versao integer, p_motivo text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_f public."TB_FICHA_ANALISE";
  v_uid uuid := (select auth.uid());
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha for update;
  if v_f."CO_FICHA_ANALISE" is null then
    raise exception 'Ficha não encontrada' using errcode = '22023';
  end if;
  perform private."FC_EXIGIR_COORD_FICHAS"(v_f."CO_MONITORAMENTO");
  if v_f."TP_SITUACAO" <> 'CONCLUIDA' then
    raise exception 'Só a ficha concluída se reabre.' using errcode = '22023';
  end if;
  if p_versao is distinct from v_f."NU_VERSAO" then
    raise exception 'Esta ficha mudou desde que você abriu; recarregue.' using errcode = '40001';
  end if;
  if length(v_motivo) not between 10 and 2000 then
    raise exception 'Informe o motivo para reabrir (10 a 2.000 caracteres).' using errcode = '22023';
  end if;
  update public."TB_FICHA_ANALISE" set
    "TP_SITUACAO" = 'EM_ANALISE',
    "CO_USUARIO_RESPONSAVEL" = coalesce("CO_USUARIO_RESPONSAVEL", "CO_USUARIO_CONCLUSAO"),
    "DT_ATRIBUICAO" = coalesce("DT_ATRIBUICAO", now()),
    "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
   where "CO_FICHA_ANALISE" = p_ficha;
  perform private."FC_HISTORICO_CONTEUDO_FICHA"(p_ficha, 'REABRIR', 'CONCLUIDA', v_motivo, v_uid, null, null);
  return json_build_object('versao', v_f."NU_VERSAO" + 1);
end;
$function$;
comment on function public.reabrir_ficha(uuid, integer, text) is
  'A coordenação do edital reabre uma ficha concluída (volta a Em análise com o mesmo responsável, que a abre e conclui de novo pela regra vigente), com motivo de 10 a 2.000 e a versão que a tela abriu (40001). Histórico REABRIR.';
revoke all on function public.reabrir_ficha(uuid, integer, text) from public, anon;
grant execute on function public.reabrir_ficha(uuid, integer, text) to authenticated;

create function public.registrar_acesso_ficha(p_ficha uuid, p_tipo text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_f public."TB_FICHA_ANALISE";
begin
  if p_tipo is null or p_tipo not in ('ABRIR_EMPREGARE', 'COPIAR_CODIGO') then
    raise exception 'Tipo de acesso inválido.' using errcode = '22023';
  end if;
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha;
  perform private."FC_EXIGIR_VER_FICHA"(v_f);
  insert into public."TL_ACESSO_FICHA_ANALISE" ("CO_FICHA_ANALISE", "TP_ACESSO", "CO_USUARIO")
  values (p_ficha, p_tipo, (select auth.uid()));
  return json_build_object('registrado', true);
end;
$function$;
comment on function public.registrar_acesso_ficha(uuid, text) is
  'Registra (LGPD, AM-7.2) que quem vê a ficha abriu o candidato na Empregare (ABRIR_EMPREGARE) ou copiou o código para a busca de lá (COPIAR_CODIGO).';
revoke all on function public.registrar_acesso_ficha(uuid, text) from public, anon;
grant execute on function public.registrar_acesso_ficha(uuid, text) to authenticated;

-- 5. A fila traz o resultado e mostra ao analista só as vagas dele -------------------------------
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

-- 6. Versão nova da regra lista as fichas concluídas com versão anterior (AM-2.3) ------------------
create or replace function public.salvar_regra_analise(p_edital uuid, p_configuracao jsonb, p_versao_atual integer, p_motivo text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
  v_regra public."TB_REGRA_ANALISE";
  v_nova integer;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_uid uuid := (select auth.uid());
begin
  perform private."FC_VALIDAR_REGRA_ANALISE"(p_configuracao);
  if v_motivo is not null and length(v_motivo) > 2000 then
    raise exception 'Motivo com até 2.000 caracteres.' using errcode = '22023';
  end if;

  select * into v_regra from public."TB_REGRA_ANALISE" where "CO_MONITORAMENTO" = p_edital for update;
  if v_regra."CO_REGRA_ANALISE" is null then
    if coalesce(p_versao_atual, 0) <> 0 then
      raise exception 'A regra mudou desde que você abriu; recarregue.' using errcode = '40001';
    end if;
    insert into public."TB_REGRA_ANALISE" ("CO_MONITORAMENTO", "NU_VERSAO_VIGENTE", "CO_USUARIO_ATUALIZACAO")
    values (p_edital, 1, v_uid)
    returning * into v_regra;
    v_nova := 1;
  else
    if p_versao_atual is distinct from v_regra."NU_VERSAO_VIGENTE" then
      raise exception 'A regra mudou desde que você abriu (versão %); recarregue.', v_regra."NU_VERSAO_VIGENTE" using errcode = '40001';
    end if;
    if v_motivo is null or length(v_motivo) < 10 then
      raise exception 'Informe o motivo da alteração (10 a 2.000 caracteres).' using errcode = '22023';
    end if;
    v_nova := v_regra."NU_VERSAO_VIGENTE" + 1;
  end if;

  insert into public."TH_REGRA_ANALISE" ("CO_REGRA_ANALISE", "NU_VERSAO", "DS_CONFIGURACAO", "DS_HASH", "DS_MOTIVO", "CO_USUARIO")
  values (v_regra."CO_REGRA_ANALISE", v_nova, p_configuracao,
          encode(sha256(convert_to(p_configuracao::text, 'UTF8')), 'hex'), coalesce(v_motivo, 'Regra criada do zero'), v_uid);

  update public."TB_REGRA_ANALISE"
     set "NU_VERSAO_VIGENTE" = v_nova, "TP_SITUACAO" = 'CONFERIR', "CO_USUARIO_CONFERENCIA" = null, "DT_CONFERENCIA" = null,
         "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = v_uid
   where "CO_REGRA_ANALISE" = v_regra."CO_REGRA_ANALISE";

  return json_build_object(
    'regra', private."FC_REGRA_ANALISE_JSON"(p_edital),
    'fichas_afetadas', coalesce((
      select json_agg(json_build_object('ficha', f."CO_FICHA_ANALISE", 'codigo', c."CO_CANDIDATO_EMPREGARE", 'vaga', f."CO_VAGA",
                                        'versao_regra', f."NU_VERSAO_REGRA", 'resultado', f."TP_RESULTADO", 'nota_final', f."VL_NOTA_FINAL")
                      order by f."CO_VAGA", c."CO_CANDIDATO_EMPREGARE")
        from public."TB_FICHA_ANALISE" f
        join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
       where f."CO_REGRA_ANALISE" = v_regra."CO_REGRA_ANALISE" and f."TP_SITUACAO" = 'CONCLUIDA' and f."NU_VERSAO_REGRA" < v_nova), '[]'::json));
end;
$function$;
comment on function public.salvar_regra_analise(uuid, jsonb, integer, text) is
  'Salva a regra da avaliação documental do edital como versão nova (a anterior fica no histórico, imutável) e volta a situação para Conferir. p_versao_atual = a versão que a tela abriu (0 sem regra; outra = 40001). Motivo obrigatório da versão 2 em diante (10 a 2.000). fichas_afetadas: as fichas concluídas com versão anterior (código, vaga, versão, resultado e nota) — nenhuma nota muda (AM-2.3); as pendentes e em análise passam a seguir a versão nova. Só a coordenação do edital.';

-- ═══ CORPO DA MIGRATION (fim) ═══

-- E1. RLS, sem acesso direto, permissões das RPCs.
do $$
begin
  if has_table_privilege('authenticated', 'public."TB_FICHA_ANALISE"', 'select')
     or has_table_privilege('authenticated', 'public."TH_FICHA_ANALISE"', 'select') then
    raise exception 'FALHOU E1: tabela com acesso direto';
  end if;
  if not (select c.relrowsecurity from pg_class c where c.oid = 'public."TB_FICHA_ANALISE"'::regclass) then
    raise exception 'FALHOU E1: ficha sem RLS';
  end if;
  if not has_function_privilege('authenticated', 'public.obter_ficha_analise(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.salvar_rascunho_ficha(uuid, integer, jsonb, jsonb, text)', 'execute')
     or not has_function_privilege('authenticated', 'public.concluir_ficha(uuid, integer, integer, jsonb, jsonb, text)', 'execute')
     or not has_function_privilege('authenticated', 'public.reabrir_ficha(uuid, integer, text)', 'execute')
     or not has_function_privilege('authenticated', 'public.registrar_acesso_ficha(uuid, text)', 'execute')
     or has_function_privilege('anon', 'public.obter_ficha_analise(uuid)', 'execute')
     or has_function_privilege('anon', 'public.concluir_ficha(uuid, integer, integer, jsonb, jsonb, text)', 'execute')
     or has_function_privilege('authenticated', 'private."FC_VALIDAR_RESULTADO_FICHA"(jsonb, jsonb, jsonb, jsonb)', 'execute') then
    raise exception 'FALHOU E1: permissões das funções';
  end if;
  raise notice 'ok E1: RLS, sem acesso direto, RPCs só para authenticated, funções privadas fechadas';
end;
$$;

-- E2. Dados sintéticos (somem no rollback) no 93/2026.
do $$
declare
  v_edital uuid;
  v_area text;
  v_regra uuid;
  v_versao integer;
  v_config jsonb;
  c_cols jsonb := $c${"Pergunta 2 - Para fins de identificação de seu cadastro, favor nos informe seu CPF:Ex: 000.000.000-00": "\"000.000.000-00\"",
    "Pergunta 4 - Anexe o documento de identificação com foto, frente e verso, conforme instruções": "Anexo",
    "Pergunta 5 - Você possui Graduação na área da vaga? (Será necessário comprovar)": "\"Sim\"",
    "Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo: (contabilizada a partir de 06 meses)": "\"4 anos ou mais\"",
    "Pergunta 12 - Anexe o comprovante de Experiência Profissional em atividades compatíveis com o cargo.": "Anexo",
    "Pergunta 13 - Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)": "\"Especialização\"",
    "Pergunta 14 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área": "\"5 pontos\"",
    "Pergunta 25 - Você está com contrato de trabalho ativo na AgSUS ou foi desligado nos últimos 6 meses?": "\"Não\""}$c$;
begin
  select m.id, m."CO_AREA" into v_edital, v_area
    from public."TB_MONITORAMENTO_INDIGENA" m
    join public."TB_REGRA_ANALISE" r on r."CO_MONITORAMENTO" = m.id
   where private."FC_NUMERO_EDITAL"(m.edital) = '93/2026' and m."CO_AREA" = 'projetos'
   limit 1;
  if v_edital is null then raise exception 'ENSAIO: o 93/2026 (Projetos) com regra não foi achado'; end if;
  perform set_config('ensaio.edital', v_edital::text, true);

  insert into public."TB_EMPREGARE_VAGA" ("CO_VAGA", "CO_MONITORAMENTO", "TP_SITUACAO", "QT_CANDIDATO_ATIVO")
  values ('99999401', v_edital, 'GRAVADA', 3), ('99999402', v_edital, 'GRAVADA', 0);
  insert into public."TB_EMPREGARE_CANDIDATO"
    ("CO_EMPREGARE_CANDIDATO", "CO_VAGA", "DS_CHAVE_CANDIDATO", "TP_CHAVE", "CO_CANDIDATO_EMPREGARE", "NO_CANDIDATO",
     "NU_CPF", "DT_NASCIMENTO", "DT_CANDIDATURA", "DS_COLUNA_ORIGINAL", "DS_HASH_LINHA")
  select ('00000000-0000-4000-a000-0000000f400' || x.n)::uuid, '99999401', 'cod:F4E000' || x.n, 'CODIGO', 'F4E000' || x.n,
         'Ensaio F4 ' || x.n, '00000000000', date '1990-01-01', timestamptz '2026-09-20 12:00:00+00', c_cols, repeat('b', 64)
    from generate_series(1, 3) x(n);

  insert into auth.users (id, instance_id, aud, role, email) values
    ('00000000-0000-4000-a000-0000000f4a02', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.f4.gestor@ensaio.invalid'),
    ('00000000-0000-4000-a000-0000000f4a03', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.f4.ana@ensaio.invalid'),
    ('00000000-0000-4000-a000-0000000f4a04', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.f4.beto@ensaio.invalid'),
    ('00000000-0000-4000-a000-0000000f4a05', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.f4.leitor@ensaio.invalid'),
    ('00000000-0000-4000-a000-0000000f4a06', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.f4.sem@ensaio.invalid');
  insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo) values
    ('00000000-0000-4000-a000-0000000f4a02', 'ensaio.f4.gestor@ensaio.invalid', 'Ensaio F4 Gestor', 'edital_gestor', true),
    ('00000000-0000-4000-a000-0000000f4a03', 'ensaio.f4.ana@ensaio.invalid', 'Ensaio F4 Ana', 'usuario', true),
    ('00000000-0000-4000-a000-0000000f4a04', 'ensaio.f4.beto@ensaio.invalid', 'Ensaio F4 Beto', 'usuario', true),
    ('00000000-0000-4000-a000-0000000f4a05', 'ensaio.f4.leitor@ensaio.invalid', 'Ensaio F4 Leitor', 'usuario', true),
    ('00000000-0000-4000-a000-0000000f4a06', 'ensaio.f4.sem@ensaio.invalid', 'Ensaio F4 Sem Acesso', 'usuario', true);
  insert into public."RL_PERFIL_USUARIO_AREA" ("CO_PERFIL_USUARIO", "CO_AREA")
  select u.id, v_area from public."TB_PERFIL_USUARIO" u where u.email like 'ensaio.f4.%@ensaio.invalid';
  insert into public."TB_PERMISSAO_RECURSO" (perfil_usuario_id, recurso, nivel, updated_by)
  select u.id, 'avaliacao_documental', x.nivel, '00000000-0000-4000-a000-0000000f4a02'
    from (values ('ensaio.f4.ana@ensaio.invalid', 'editor'), ('ensaio.f4.beto@ensaio.invalid', 'editor'),
                 ('ensaio.f4.leitor@ensaio.invalid', 'leitor')) x(email, nivel)
    join public."TB_PERFIL_USUARIO" u on u.email = x.email;
  insert into public."RL_ANALISTA_EDITAL" ("CO_MONITORAMENTO", "CO_USUARIO", "TP_PAPEL", "CO_VAGA", "CO_USUARIO_ATUALIZACAO") values
    (v_edital, '00000000-0000-4000-a000-0000000f4a03', 'ANALISTA', null, '00000000-0000-4000-a000-0000000f4a02'),
    (v_edital, '00000000-0000-4000-a000-0000000f4a04', 'ANALISTA', '99999402', '00000000-0000-4000-a000-0000000f4a02');

  -- Regra: a vigente com as perguntas ligadas e a nota declarada de titulação e cursos.
  select r."CO_REGRA_ANALISE", r."NU_VERSAO_VIGENTE", h."DS_CONFIGURACAO" into v_regra, v_versao, v_config
    from public."TB_REGRA_ANALISE" r
    join public."TH_REGRA_ANALISE" h on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
   where r."CO_MONITORAMENTO" = v_edital;
  if not exists (select 1 from jsonb_array_elements(v_config -> 'blocos') b where b ->> 'codigo' = 'EXPERIENCIA')
     or not exists (select 1 from jsonb_array_elements(v_config -> 'observacoes_prontas') o where o ->> 'codigo' = 'CURSOS_DIMINUIDA') then
    raise exception 'ENSAIO: a regra vigente do 93/2026 não tem os blocos do modelo PROJ26-CURRICULAR';
  end if;
  v_config := jsonb_set(jsonb_set(v_config, '{blocos}', (
      select jsonb_agg(case b ->> 'codigo'
               when 'IDENTIDADE' then jsonb_set(b, '{perguntas}', '["Anexe o documento de identificação", "Anexe um documento de identificação"]')
               when 'ESCOLARIDADE' then jsonb_set(b, '{perguntas}', '["Você possui Graduação na área da vaga", "Você possui Ensino Médio completo e Curso Técnico"]')
               when 'FORMACAO' then jsonb_set(b, '{perguntas}', '["Qual seu Nível de Titulação Acadêmica", "Anexe seu comprovante de Titulação Acadêmica"]')
               when 'CURSOS' then jsonb_set(b, '{perguntas}', '["Selecione a pontuação relativa à carga horária de Cursos", "Anexe os seus Certificados de Conclusão dos Cursos"]')
               when 'EXPERIENCIA' then jsonb_set(b, '{perguntas}', '["Experiência Profissional em atividades", "Anexe o comprovante de Experiência Profissional"]')
               else b end order by o)
        from jsonb_array_elements(v_config -> 'blocos') with ordinality t(b, o))),
    '{provisoria,nota_declarada}', $n$[
      {"parcial": "FORMACAO", "pergunta": "Qual seu Nível de Titulação Acadêmica", "tipo": "OPCAO",
       "pontos": {"Especialização": 5, "Mestrado": 8, "Doutorado": 10, "Não possuo": 0}},
      {"parcial": "CURSOS", "pergunta": "Selecione a pontuação relativa à carga horária de Cursos", "tipo": "OPCAO",
       "pontos": {"Não possuo": 0, "1 ponto": 1, "2 pontos": 2, "3 pontos": 3, "4 pontos": 4, "5 pontos": 5}}]$n$);
  perform private."FC_VALIDAR_REGRA_ANALISE"(v_config);
  v_versao := v_versao + 1;
  insert into public."TH_REGRA_ANALISE" ("CO_REGRA_ANALISE", "NU_VERSAO", "DS_CONFIGURACAO", "DS_HASH", "DS_MOTIVO", "CO_USUARIO")
  values (v_regra, v_versao, v_config, encode(sha256(convert_to(v_config::text, 'UTF8')), 'hex'),
          'Versão do ensaio da fase F4', '00000000-0000-4000-a000-0000000f4a02');
  update public."TB_REGRA_ANALISE" set "NU_VERSAO_VIGENTE" = v_versao, "TP_SITUACAO" = 'CONFERIDA',
         "CO_USUARIO_CONFERENCIA" = '00000000-0000-4000-a000-0000000f4a02', "DT_CONFERENCIA" = now()
   where "CO_REGRA_ANALISE" = v_regra;
  perform set_config('ensaio.versao', v_versao::text, true);
  perform set_config('ensaio.config', v_config::text, true);
  perform set_config('ensaio.minima', coalesce((
    select case when jsonb_typeof(d #> '{nota_minima_por_nivel,superior}') = 'number' then d #>> '{nota_minima_por_nivel,superior}'
                when jsonb_typeof(d -> 'nota_minima') = 'number' then d ->> 'nota_minima' end
      from (select private."FC_DOCUMENTAL_DO_EDITAL"(v_edital) as d) x), ''), true);

  -- O job grava o lote (3) e abre as fichas.
  perform public.iniciar_pre_classificacao('ensaio-precl-f4-0001', 'GITHUB');
  perform public.gravar_pre_classificacao_vaga('ensaio-precl-f4-0001', v_edital, '99999401', v_versao,
    '{"tamanho":3,"descricao":"3 (número fixo)","avisos":[]}'::jsonb,
    (select jsonb_agg(jsonb_build_object('id', '00000000-0000-4000-a000-0000000f400' || x.n, 'situacao', 'NO_LOTE', 'posicao', x.n,
                                         'posicao_modalidade', x.n, 'lote', 1, 'lista_lote', 'GERAL', 'entrada', 'INICIAL',
                                         'motivo_entrada', 'Lote inicial', 'art', 30 - x.n, 'nota', 30 - x.n, 'origem_nota', 'ART',
                                         'modalidade', 'AC', 'motivo_codigo', null, 'motivo', null))
       from generate_series(1, 3) x(n)));
  perform public.abrir_fichas_pre_classificacao('ensaio-precl-f4-0001', v_edital, '[]'::jsonb);
  perform public.finalizar_pre_classificacao('ensaio-precl-f4-0001', '[]'::jsonb, null);
  if (select count(*) from public."TB_FICHA_ANALISE" f where f."CO_VAGA" = '99999401') <> 3 then
    raise exception 'FALHOU E2: fichas do lote sintético';
  end if;
  perform set_config('ensaio.ficha', (select f."CO_FICHA_ANALISE"::text from public."TB_FICHA_ANALISE" f
                                       where f."CO_EMPREGARE_CANDIDATO" = '00000000-0000-4000-a000-0000000f4001'), true);
  raise notice 'ok E2: 93/2026, vaga sintética com 3 fichas, regra v% conferida com as perguntas ligadas', v_versao;
end;
$$;

-- E3. A ficha, como cada pessoa (papel authenticated).
set local role authenticated;
do $$
declare
  c_gestor constant text := '{"sub":"00000000-0000-4000-a000-0000000f4a02","role":"authenticated","email":"ensaio.f4.gestor@ensaio.invalid"}';
  c_ana constant text := '{"sub":"00000000-0000-4000-a000-0000000f4a03","role":"authenticated","email":"ensaio.f4.ana@ensaio.invalid"}';
  c_beto constant text := '{"sub":"00000000-0000-4000-a000-0000000f4a04","role":"authenticated","email":"ensaio.f4.beto@ensaio.invalid"}';
  c_leitor constant text := '{"sub":"00000000-0000-4000-a000-0000000f4a05","role":"authenticated","email":"ensaio.f4.leitor@ensaio.invalid"}';
  c_sem constant text := '{"sub":"00000000-0000-4000-a000-0000000f4a06","role":"authenticated","email":"ensaio.f4.sem@ensaio.invalid"}';
  v_edital uuid := current_setting('ensaio.edital')::uuid;
  v_versao_regra integer := current_setting('ensaio.versao')::integer;
  v_config jsonb := current_setting('ensaio.config')::jsonb;
  v json;
  v_ficha uuid;
  v_versao integer;
  v_min numeric;
  v_resultado text;
  v_msg text;
  v_lanc jsonb := $l${"nivel": "superior", "modalidade": "AC",
    "blocos": {"IDENTIDADE": {"situacao": "CONFORME"}, "ESCOLARIDADE": {"situacao": "CONFORME"},
               "REGISTRO_CONSELHO": {"situacao": "CONFORME"}, "FORMACAO": {"situacao": "CONFORME"},
               "CURSOS": {"situacao": "CONFORME"},
               "EXPERIENCIA": {"situacao": "CONFORME", "nota_ajustada": 20, "justificativas": ["EXPERIENCIA_DIMINUIDA"]}},
    "titulos": [{"titulo": "ESPECIALIZACAO", "nome": "Especialização fictícia", "aceito": true}],
    "cursos": [{"nome": "Curso A", "horas": 120, "aceito": true}, {"nome": "Curso B", "horas": 40, "aceito": true}],
    "vinculos": [{"empregador": "Empresa fictícia", "categoria": "AREA_OU_SUS", "inicio": "2020-01-01", "fim": "2022-12-31", "aceito": true}],
    "observacoes": "", "observacoes_prontas": []}$l$;
  v_res jsonb;
  v_ok boolean;
begin
  -- A nota mínima do edital decide se a ficha de 29 pontos é Apta ou Inapta por nota.
  v_min := nullif(current_setting('ensaio.minima'), '')::numeric;
  v_resultado := case when v_min is not null and 29 < v_min then 'INAPTO_NOTA' else 'APTO' end;
  v_res := jsonb_build_object('resultado', v_resultado, 'nota_apurada', 29, 'nota_final', 29,
                              'parciais', '{"FORMACAO": 5, "CURSOS": 4, "EXPERIENCIA": 20}'::jsonb,
                              'declarada', '{"FORMACAO": 5, "CURSOS": 5}'::jsonb, 'eliminatorios', '[]'::jsonb);

  v_ficha := current_setting('ensaio.ficha')::uuid;

  perform set_config('request.jwt.claims', c_sem, true);
  begin
    perform public.obter_ficha_analise(v_ficha);
    raise exception 'FALHOU E3: sem acesso viu a ficha';
  exception when sqlstate '42501' then null;
  end;
  perform set_config('request.jwt.claims', c_beto, true);
  begin
    perform public.obter_ficha_analise(v_ficha);
    raise exception 'FALHOU E3: analista de outra vaga viu a ficha';
  exception when sqlstate '42501' then null;
  end;
  v := public.obter_fila_avaliacao(v_edital);
  if exists (select 1 from json_array_elements(v -> 'candidatos') c where c ->> 'vaga' = '99999401') then
    raise exception 'FALHOU E3: analista de outra vaga vê a vaga na fila';
  end if;
  perform set_config('request.jwt.claims', c_leitor, true);
  begin
    perform public.obter_ficha_analise(v_ficha);
    raise exception 'FALHOU E3: leitor viu ficha não concluída';
  exception when sqlstate '42501' then null;
  end;
  raise notice 'ok E3.1: sem acesso, analista de outra vaga (nem na fila) e leitor (ficha não concluída) não veem';

  perform set_config('request.jwt.claims', c_ana, true);
  v := public.reservar_ficha(v_ficha);
  if not (v ->> 'reservada')::boolean then raise exception 'FALHOU E3: Ana não reservou %', v; end if;
  v := public.obter_ficha_analise(v_ficha);
  if not (v ->> 'pode_editar')::boolean or (v ->> 'pode_reabrir')::boolean
     or (v -> 'regra' ->> 'versao')::int <> v_versao_regra then
    raise exception 'FALHOU E3: ficha da Ana (regra v%)', v -> 'regra' ->> 'versao';
  end if;
  if (select count(*) from json_object_keys(v -> 'respostas')) <> 6
     or (v -> 'respostas')::text ~* 'cpf' or (v -> 'respostas')::text ~ '000\.000' or (v -> 'respostas')::text ~ 'contrato de trabalho ativo' then
    raise exception 'FALHOU E3: respostas fora das perguntas da regra (% colunas)', (select count(*) from json_object_keys(v -> 'respostas'));
  end if;
  v_versao := (v -> 'ficha' ->> 'versao')::int;
  raise notice 'ok E3.2: Ana abre e pode editar; regra v%; 6 respostas, só das perguntas da regra (sem CPF nem outras)', v_versao_regra;

  begin
    perform public.salvar_rascunho_ficha(v_ficha, v_versao - 1, v_lanc, v_res, 'Parecer');
    raise exception 'FALHOU E3: salvou com versão velha';
  exception when sqlstate '40001' then null;
  end;
  begin
    perform public.salvar_rascunho_ficha(v_ficha, v_versao, jsonb_set(v_lanc, '{blocos,NAO_EXISTE}', '{"situacao": "CONFORME"}'), v_res, 'Parecer');
    raise exception 'FALHOU E3: aceitou bloco fora da regra';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.salvar_rascunho_ficha(v_ficha, v_versao, jsonb_set(v_lanc, '{blocos,IDENTIDADE}', '{"situacao": "NAO_CONFORME", "motivos": ["INVENTADO"]}'), v_res, 'Parecer');
    raise exception 'FALHOU E3: aceitou motivo fora da regra';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.salvar_rascunho_ficha(v_ficha, v_versao, jsonb_set(v_lanc, '{blocos,EXPERIENCIA,nota_ajustada}', '40'), v_res, 'Parecer');
    raise exception 'FALHOU E3: aceitou nota acima do teto';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.salvar_rascunho_ficha(v_ficha, v_versao, v_lanc, jsonb_set(v_res, '{nota_apurada}', '31'), 'Parecer');
    raise exception 'FALHOU E3: aceitou soma errada';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.salvar_rascunho_ficha(v_ficha, v_versao, jsonb_set(v_lanc, '{blocos,IDENTIDADE}', '{"situacao": "NAO_ENVIADO", "motivos": ["ILEGIVEL"]}'), v_res, 'Parecer');
    raise exception 'FALHOU E3: aceitou apto com bloco eliminatório';
  exception when sqlstate '22023' then null;
  end;
  v := public.salvar_rascunho_ficha(v_ficha, v_versao, v_lanc, v_res, 'Parecer do rascunho');
  if (v ->> 'versao')::int <> v_versao + 1 or (v ->> 'alteracoes')::int < 1 then raise exception 'FALHOU E3: rascunho %', v; end if;
  v_versao := v_versao + 1;
  -- O mesmo de novo: sobe a versão, mas não vai ao histórico (nada mudou).
  v := public.salvar_rascunho_ficha(v_ficha, v_versao, v_lanc, v_res, 'Parecer do rascunho');
  if (v ->> 'alteracoes')::int <> 0 then raise exception 'FALHOU E3: rascunho igual gerou alteração %', v; end if;
  v_versao := v_versao + 1;
  raise notice 'ok E3.3: versão velha (40001), bloco, motivo, teto, soma e eliminatório recusados (22023); rascunho salvo; sem mudança não vai ao histórico';

  begin
    perform public.concluir_ficha(v_ficha, v_versao, v_versao_regra, v_lanc, v_res, 'Parecer final');
    raise exception 'FALHOU E3: concluiu com nota de cursos diferente da declarada sem justificativa';
  exception when sqlstate '22023' then
    get stacked diagnostics v_msg = message_text;
    if v_msg !~ 'sem justificativa' then raise exception 'FALHOU E3: mensagem da pendência: %', v_msg; end if;
  end;
  v_lanc := jsonb_set(v_lanc, '{blocos,CURSOS}', '{"situacao": "CONFORME", "justificativas": ["CURSOS_DIMINUIDA"]}');
  begin
    perform public.concluir_ficha(v_ficha, v_versao, v_versao_regra - 1, v_lanc, v_res, 'Parecer final');
    raise exception 'FALHOU E3: concluiu com a versão velha da regra';
  exception when sqlstate '40001' then null;
  end;
  v := public.concluir_ficha(v_ficha, v_versao, v_versao_regra, v_lanc, v_res, 'Parecer final');
  if v ->> 'resultado' <> v_res ->> 'resultado' or (v ->> 'versao_regra')::int <> v_versao_regra then
    raise exception 'FALHOU E3: conclusão %', v;
  end if;
  v_versao := (v ->> 'versao')::int;
  begin
    perform public.salvar_rascunho_ficha(v_ficha, v_versao, v_lanc, v_res, 'Depois');
    raise exception 'FALHOU E3: salvou ficha concluída';
  exception when sqlstate '22023' or sqlstate '55P03' then null;
  end;
  v := public.obter_fila_avaliacao(v_edital);
  select (c -> 'ficha' ->> 'situacao') = 'CONCLUIDA' and (c -> 'ficha' ->> 'nota_final')::numeric = 29
         and c -> 'ficha' ->> 'resultado' = v_res ->> 'resultado' and (c -> 'ficha' -> 'reserva')::text = 'null'
    into v_ok
    from json_array_elements(v -> 'candidatos') c where c ->> 'codigo' = 'F4E0001';
  if not coalesce(v_ok, false) then raise exception 'FALHOU E3: fila depois de concluir'; end if;
  v := public.registrar_acesso_ficha(v_ficha, 'COPIAR_CODIGO');
  begin
    perform public.registrar_acesso_ficha(v_ficha, 'REVELAR_CPF');
    raise exception 'FALHOU E3: registrou acesso de tipo não permitido';
  exception when sqlstate '22023' then null;
  end;
  raise notice 'ok E3.4: sem justificativa recusa; regra velha 40001; conclui (%) com a versão da regra; só leitura; a fila mostra nota e resultado; acesso registrado', v_res ->> 'resultado';

  perform set_config('request.jwt.claims', c_leitor, true);
  v := public.obter_ficha_analise(v_ficha);
  if (v ->> 'pode_editar')::boolean or v -> 'ficha' ->> 'parecer' <> 'Parecer final' then raise exception 'FALHOU E3: leitor na concluída'; end if;

  -- AM-2.3: versão nova da regra lista a concluída; a nota não muda.
  perform set_config('request.jwt.claims', c_gestor, true);
  v := public.salvar_regra_analise(v_edital, v_config, v_versao_regra, 'Versão nova do ensaio da fase F4');
  if not exists (select 1 from json_array_elements(v -> 'fichas_afetadas') a
                  where (a ->> 'ficha')::uuid = v_ficha and (a ->> 'versao_regra')::int = v_versao_regra) then
    raise exception 'FALHOU E3: fichas afetadas %', v -> 'fichas_afetadas';
  end if;
  v := public.obter_ficha_analise(v_ficha);
  if (v -> 'regra' ->> 'versao')::int <> v_versao_regra or (v -> 'regra' ->> 'vigente')::int <> v_versao_regra + 1 then
    raise exception 'FALHOU E3: a concluída devia seguir a versão da conclusão';
  end if;

  perform set_config('request.jwt.claims', c_ana, true);
  begin
    perform public.reabrir_ficha(v_ficha, v_versao, 'Analista tentando reabrir');
    raise exception 'FALHOU E3: analista reabriu';
  exception when sqlstate '42501' then null;
  end;
  perform set_config('request.jwt.claims', c_gestor, true);
  begin
    perform public.reabrir_ficha(v_ficha, v_versao, 'curto');
    raise exception 'FALHOU E3: reabriu sem motivo';
  exception when sqlstate '22023' then null;
  end;
  v := public.reabrir_ficha(v_ficha, v_versao, 'Conferir de novo os cursos no ensaio');
  perform set_config('request.jwt.claims', c_ana, true);
  v := public.obter_ficha_analise(v_ficha);
  if v -> 'ficha' ->> 'situacao' <> 'EM_ANALISE' or (v -> 'regra' ->> 'versao')::int <> v_versao_regra + 1
     or (select count(*) from json_array_elements(v -> 'historico') h where h ->> 'acao' in ('SALVAR', 'CONCLUIR', 'REABRIR')) <> 3
     or not exists (select 1 from json_array_elements(v -> 'historico') h, json_array_elements(h -> 'alteracao') a
                     where h ->> 'acao' = 'SALVAR' and a ->> 'parcial' = 'EXPERIENCIA' and (a ->> 'para')::numeric = 20) then
    raise exception 'FALHOU E3: depois de reabrir %', v -> 'historico';
  end if;
  raise notice 'ok E3.5: leitor vê a concluída; versão nova da regra lista a ficha (AM-2.3) sem mudar a nota; só a coordenação reabre, com motivo; reaberta segue a vigente; histórico SALVAR/CONCLUIR/REABRIR com de quanto para quanto';
end;
$$;
reset role;

-- E4. Imutáveis.
do $$
declare
  v_ficha uuid := (select f."CO_FICHA_ANALISE" from public."TB_FICHA_ANALISE" f
                    where f."CO_EMPREGARE_CANDIDATO" = '00000000-0000-4000-a000-0000000f4001');
begin
  begin
    update public."TH_FICHA_ANALISE" set "DS_MOTIVO" = 'mudado' where "CO_FICHA_ANALISE" = v_ficha;
    raise exception 'FALHOU E4: histórico mudou';
  exception when sqlstate '42501' then null;
  end;
  begin
    delete from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = v_ficha;
    raise exception 'FALHOU E4: ficha apagada';
  exception when sqlstate '42501' then null;
  end;
  begin
    update public."TB_FICHA_ANALISE" set "TP_SITUACAO" = 'CONCLUIDA', "DS_PARECER" = null where "CO_FICHA_ANALISE" = v_ficha;
    raise exception 'FALHOU E4: concluída sem parecer';
  exception when check_violation then null;
  end;
  if not exists (select 1 from public."TL_ACESSO_FICHA_ANALISE" a where a."CO_FICHA_ANALISE" = v_ficha and a."TP_ACESSO" = 'COPIAR_CODIGO') then
    raise exception 'FALHOU E4: acesso não registrado';
  end if;
  raise notice 'ok E4: histórico imutável, ficha não se apaga, concluída exige parecer, acesso registrado';
end;
$$;

select 'ENSAIO OK' as resultado;

rollback;
