/*
  ENSAIO de 20261001170000_recursos_parecer_juridico.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela), confere os dados migrados e percorre o
  fluxo com três pessoas sintéticas (editor = edital_gestor, jurídico = grupo
  Jurídico, leitor = usuario) e termina em ROLLBACK: nada fica gravado.

  Resultado esperado: as mensagens "ok E1" … "ok E5" e "ENSAIO OK". Qualquer
  "FALHOU …" interrompe e desfaz tudo; copie a mensagem.

  Mantenha em sincronia: tests/recursos-parecer-migration.test.js confere que
  o corpo da migration aqui é idêntico ao do arquivo da migration.
*/
begin;

-- Antes da migration: quantos recursos por situação.
create temp table ensaio_antes on commit drop as
select "TP_SITUACAO" as situacao, count(*) as n
  from public."TB_RECURSO_CANDIDATO"
 group by 1;

-- ═══ CORPO DA MIGRATION (início) ═══

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TB_RESPOSTA_RECURSO"') is null then
    raise exception 'Aplique antes 20260929230000_recursos_modelos_anexos_respostas.sql.';
  end if;
  if not ('selecao' = any (private."FC_RECURSOS_MODULO"())) then
    raise exception 'Aplique antes 20261001090000_selecao.sql (lista de módulos sem selecao).';
  end if;
end;
$$;

-- 1. Permissão 'recursos_parecer' ------------------------------------------------------
create or replace function private."FC_RECURSOS_MODULO"()
 returns text[]
 language sql
 immutable
 set search_path to ''
as $function$
  select array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes','acessos','recursos','entrevistas','selecao','recursos_parecer']::text[];
$function$;

alter table public."TA_GRUPO_ACESSO_RECURSO"
  add constraint "CK_GRUPACESSOREC_PARECER"
  check ("NO_RECURSO" <> 'recursos_parecer' or "TP_NIVEL" in ('sem_acesso', 'editor'));
comment on constraint "CK_GRUPACESSOREC_PARECER" on public."TA_GRUPO_ACESSO_RECURSO" is
  'Parecer jurídico dos recursos aceita só Sem acesso ou Editor (decide ou não decide).';

alter table public."TB_PERMISSAO_RECURSO"
  add constraint "CK_PERMISSAORECURSO_PARECER"
  check (recurso <> 'recursos_parecer' or nivel in ('sem_acesso', 'editor'));
comment on constraint "CK_PERMISSAORECURSO_PARECER" on public."TB_PERMISSAO_RECURSO" is
  'Permissão individual de parecer jurídico dos recursos: só Sem acesso ou Editor.';

insert into public."TA_GRUPO_ACESSO_RECURSO" ("CO_GRUPO_ACESSO", "NO_RECURSO", "TP_NIVEL")
select g."CO_GRUPO_ACESSO", 'recursos_parecer', case when g."ST_ADMIN_GLOBAL" then 'editor' else 'sem_acesso' end
  from public."TB_GRUPO_ACESSO" g
on conflict ("CO_GRUPO_ACESSO", "NO_RECURSO") do nothing;

insert into public."TB_GRUPO_ACESSO"
  ("CO_GRUPO_ACESSO", "NO_GRUPO_ACESSO", "DS_GRUPO_ACESSO", "ST_SISTEMA", "ST_ADMIN_GLOBAL", "NU_ORDEM")
values ('juridico', 'Jurídico', 'Dá o parecer jurídico dos recursos: defere, defere parcialmente, indefere ou devolve para ajuste.', false, false, 35)
on conflict ("CO_GRUPO_ACESSO") do nothing;

insert into public."TA_GRUPO_ACESSO_RECURSO" ("CO_GRUPO_ACESSO", "NO_RECURSO", "TP_NIVEL")
select 'juridico', m,
       case m
         when 'recursos' then 'editor'
         when 'recursos_parecer' then 'editor'
         when 'acessos' then 'sem_acesso'
         else private."FC_NIVEL_DO_GRUPO"('usuario', m)
       end
  from unnest(private."FC_RECURSOS_MODULO"()) m
on conflict ("CO_GRUPO_ACESSO", "NO_RECURSO") do nothing;

-- 2. Recurso: estados, parecer, envio e devolução ------------------------------------------
alter table public."TB_RECURSO_CANDIDATO" drop constraint "CK_RECURSOCANDIDATO_TPSITUACAO";
alter table public."TB_RECURSO_CANDIDATO" drop constraint "CK_RECURSOCANDIDATO_DECISAO";

alter table public."TB_RECURSO_CANDIDATO"
  add column "DS_PARECER_JURIDICO" text,
  add column "DT_ENVIO_PARECER" timestamptz,
  add column "CO_USUARIO_ENVIO_PARECER" uuid,
  add column "DT_DEVOLUCAO" timestamptz,
  add column "CO_USUARIO_DEVOLUCAO" uuid,
  add column "DS_COMENTARIO_DEVOLUCAO" text;
alter table public."TB_RECURSO_CANDIDATO" alter column "TP_SITUACAO" set default 'REGISTRADO';

-- Dados de antes: em análise vira registrado; decidido ganha a marca de parecer.
update public."TB_RECURSO_CANDIDATO" set "TP_SITUACAO" = 'REGISTRADO'
 where "TP_SITUACAO" = 'EM_ANALISE';
update public."TB_RECURSO_CANDIDATO"
   set "DS_PARECER_JURIDICO" = 'Decisão registrada antes do parecer jurídico no sistema (migração 20261001170000); sem texto de parecer.'
 where "TP_SITUACAO" in ('DEFERIDO', 'INDEFERIDO', 'PARCIALMENTE_INDEFERIDO')
   and "DS_PARECER_JURIDICO" is null;

alter table public."TB_RECURSO_CANDIDATO"
  add constraint "CK_RECURSOCANDIDATO_TPSITUACAO" check (
    "TP_SITUACAO" in ('REGISTRADO', 'EM_ANALISE_JURIDICA', 'DEFERIDO', 'INDEFERIDO', 'PARCIALMENTE_INDEFERIDO')),
  add constraint "CK_RECURSOCANDIDATO_DECISAO" check (
    ("TP_SITUACAO" in ('DEFERIDO', 'INDEFERIDO', 'PARCIALMENTE_INDEFERIDO')) = ("DT_DECISAO" is not null)
    and ("DT_DECISAO" is null) = ("CO_USUARIO_DECISAO" is null)
    and ("DT_DECISAO" is null) = ("DS_PARECER_JURIDICO" is null)),
  add constraint "CK_RECURSOCANDIDATO_PARECER" check (
    ("DT_ENVIO_PARECER" is null) = ("CO_USUARIO_ENVIO_PARECER" is null)
    and ("TP_SITUACAO" <> 'EM_ANALISE_JURIDICA' or "DT_ENVIO_PARECER" is not null)
    and ("DT_DEVOLUCAO" is null) = ("CO_USUARIO_DEVOLUCAO" is null)
    and ("DT_DEVOLUCAO" is null) = ("DS_COMENTARIO_DEVOLUCAO" is null)
    and ("DT_DEVOLUCAO" is null or "TP_SITUACAO" = 'REGISTRADO')),
  add constraint "CK_RECURSOCANDIDATO_TAMPARECER" check (
    coalesce(length("DS_PARECER_JURIDICO"), 0) <= 20000
    and coalesce(length("DS_COMENTARIO_DEVOLUCAO"), 0) <= 2000);

comment on column public."TB_RECURSO_CANDIDATO"."TP_SITUACAO" is
  'REGISTRADO, EM_ANALISE_JURIDICA (enviado para parecer), DEFERIDO, INDEFERIDO ou PARCIALMENTE_INDEFERIDO (na tela: Deferido parcialmente). Muda só por transicionar_recurso_candidato.';
comment on column public."TB_RECURSO_CANDIDATO"."DT_DECISAO" is 'Quando o jurídico decidiu (fim dos dias em aberto). Nula sem decisão.';
comment on column public."TB_RECURSO_CANDIDATO"."CO_USUARIO_DECISAO" is 'Quem decidiu (auth.users.id; tem recursos_parecer).';
comment on column public."TB_RECURSO_CANDIDATO"."DS_PARECER_JURIDICO" is 'Parecer jurídico da decisão (10 a 20.000 caracteres). Decisões de antes de 20261001170000 trazem uma marca no lugar do texto.';
comment on column public."TB_RECURSO_CANDIDATO"."DT_ENVIO_PARECER" is 'Último envio para parecer jurídico (ou reabertura da decisão) — quando.';
comment on column public."TB_RECURSO_CANDIDATO"."CO_USUARIO_ENVIO_PARECER" is 'Último envio para parecer jurídico — quem (auth.users.id).';
comment on column public."TB_RECURSO_CANDIDATO"."DT_DEVOLUCAO" is 'Última devolução do jurídico para ajuste — quando. Some ao reenviar.';
comment on column public."TB_RECURSO_CANDIDATO"."CO_USUARIO_DEVOLUCAO" is 'Última devolução para ajuste — quem (auth.users.id).';
comment on column public."TB_RECURSO_CANDIDATO"."DS_COMENTARIO_DEVOLUCAO" is 'O que o jurídico pediu para ajustar (3 a 2.000 caracteres).';
comment on constraint "CK_RECURSOCANDIDATO_TPSITUACAO" on public."TB_RECURSO_CANDIDATO" is 'Situações do fluxo com parecer jurídico.';
comment on constraint "CK_RECURSOCANDIDATO_DECISAO" on public."TB_RECURSO_CANDIDATO" is 'Decidido tem quando, quem e parecer; não decidido não tem nenhum.';
comment on constraint "CK_RECURSOCANDIDATO_PARECER" on public."TB_RECURSO_CANDIDATO" is 'Envio e devolução guardam quando e quem juntos; em análise jurídica tem envio; devolução só em registrado.';
comment on constraint "CK_RECURSOCANDIDATO_TAMPARECER" on public."TB_RECURSO_CANDIDATO" is 'Parecer até 20.000 e comentário de devolução até 2.000 caracteres.';

alter table public."TH_RECURSO_CANDIDATO" drop constraint "CK_HISTRECURSO_TPACAO";
alter table public."TH_RECURSO_CANDIDATO" add constraint "CK_HISTRECURSO_TPACAO"
  check ("TP_ACAO" in ('criacao', 'edicao', 'etapa', 'exclusao', 'anexo', 'resposta', 'parecer'));
comment on constraint "CK_HISTRECURSO_TPACAO" on public."TH_RECURSO_CANDIDATO" is
  'Ações registradas: criacao, edicao, etapa, exclusao, anexo, resposta e parecer (transições do fluxo jurídico).';
comment on column public."TH_RECURSO_CANDIDATO"."TP_ACAO" is
  'criacao, edicao, etapa, exclusao, anexo, resposta ou parecer.';
comment on column public."TH_RECURSO_CANDIDATO"."DS_CAMPO" is
  'Campo editado, etapa, ação do anexo (inclusao, arquivamento), da resposta (criacao, enviar_revisao, aprovar, devolver, reabrir, marcar_enviada) ou do parecer (enviar_parecer, devolver, deferir, deferir_parcialmente, indeferir, reabrir). Nulo na criação e na exclusão do recurso.';
comment on column public."TH_RECURSO_CANDIDATO"."DS_MOTIVO" is
  'Motivo (exclusão, arquivamento), comentário da resposta, parecer jurídico ou comentário da devolução/reabertura.';

-- 3. Quem decide ----------------------------------------------------------------------
create function private."FC_PODE_PARECER_RECURSO"()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select private.pode_recurso('recursos_parecer', 2);
$function$;
comment on function private."FC_PODE_PARECER_RECURSO"() is
  'Quem está logado tem o parecer jurídico dos recursos (recursos_parecer = editor)?';

create function private."FC_EXIGIR_PARECER_RECURSO"()
returns void
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not private."FC_PODE_PARECER_RECURSO"() then
    raise exception 'Só quem tem o parecer jurídico decide o recurso' using errcode = '42501';
  end if;
end;
$function$;
comment on function private."FC_EXIGIR_PARECER_RECURSO"() is
  'Barra (42501) quem não tem recursos_parecer = editor.';

revoke all on function private."FC_PODE_PARECER_RECURSO"(), private."FC_EXIGIR_PARECER_RECURSO"() from public, anon, authenticated;

-- Gatilho: nenhuma gravação decide sem o parecer jurídico.
create function private."FC_TG_SITUACAO_RECURSO"()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if tg_op = 'INSERT' then
    if (new."TP_SITUACAO" <> 'REGISTRADO' or new."DS_PARECER_JURIDICO" is not null or new."DT_DECISAO" is not null)
       and not private."FC_PODE_PARECER_RECURSO"() then
      raise exception 'Recurso novo nasce registrado; decidir é do parecer jurídico' using errcode = '42501';
    end if;
    return new;
  end if;
  if ((new."TP_SITUACAO" is distinct from old."TP_SITUACAO"
        and not (old."TP_SITUACAO" = 'REGISTRADO' and new."TP_SITUACAO" = 'EM_ANALISE_JURIDICA'))
      or new."DS_PARECER_JURIDICO" is distinct from old."DS_PARECER_JURIDICO"
      or new."DT_DECISAO" is distinct from old."DT_DECISAO"
      or new."CO_USUARIO_DECISAO" is distinct from old."CO_USUARIO_DECISAO")
     and not private."FC_PODE_PARECER_RECURSO"() then
    raise exception 'Só quem tem o parecer jurídico decide, devolve ou reabre o recurso' using errcode = '42501';
  end if;
  return new;
end;
$function$;
comment on function private."FC_TG_SITUACAO_RECURSO"() is
  'Gatilho de TB_RECURSO_CANDIDATO: mudar a situação (fora REGISTRADO → EM_ANALISE_JURIDICA), o parecer ou a decisão exige recursos_parecer (42501).';
revoke all on function private."FC_TG_SITUACAO_RECURSO"() from public, anon, authenticated;

create trigger "TG_RECURSOCANDIDATO_SITUACAO"
  before insert or update on public."TB_RECURSO_CANDIDATO"
  for each row execute function private."FC_TG_SITUACAO_RECURSO"();
comment on trigger "TG_RECURSOCANDIDATO_SITUACAO" on public."TB_RECURSO_CANDIDATO" is
  'Decisão, devolução e reabertura só com o parecer jurídico (FC_TG_SITUACAO_RECURSO).';

-- 4. Transição do recurso ---------------------------------------------------------------
create function public.transicionar_recurso_candidato(p_id uuid, p_acao text, p_revisao integer, p_texto text default null)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_atual public."TB_RECURSO_CANDIDATO";
  v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
  v_decisao boolean := p_acao in ('deferir', 'deferir_parcialmente', 'indeferir');
  v_novo text;
  v_revisao integer;
begin
  if p_acao is null or p_acao not in ('enviar_parecer', 'devolver', 'deferir', 'deferir_parcialmente', 'indeferir', 'reabrir') then
    raise exception 'Ação inválida' using errcode = '22023';
  end if;
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  -- Enviar para parecer: quem edita. Devolver, decidir e reabrir: o parecer jurídico.
  perform private."FC_EXIGIR_RECURSO_ACESSIVEL"(p_id, case when p_acao = 'enviar_parecer' then 2 else 1 end);
  if p_acao <> 'enviar_parecer' then
    perform private."FC_EXIGIR_PARECER_RECURSO"();
  end if;

  select r.* into v_atual from public."TB_RECURSO_CANDIDATO" r
  where r."CO_RECURSO_CANDIDATO" = p_id and r."ST_ATIVO" = 'S'
  for update;
  if not found then
    raise exception 'Recurso não encontrado' using errcode = 'P0002';
  end if;
  if p_revisao is null or p_revisao <> v_atual."NU_REVISAO" then
    raise exception 'O recurso foi alterado por outra pessoa. Recarregue e tente de novo.' using errcode = '40001';
  end if;

  if v_decisao then
    if length(coalesce(v_texto, '')) not between 10 and 20000 then
      raise exception 'Escreva o parecer jurídico (10 a 20.000 caracteres)' using errcode = '22023';
    end if;
  elsif p_acao in ('devolver', 'reabrir') then
    if length(coalesce(v_texto, '')) not between 3 and 2000 then
      raise exception 'Informe o motivo (3 a 2.000 caracteres)' using errcode = '22023';
    end if;
  elsif length(coalesce(v_texto, '')) > 2000 then
    raise exception 'A observação passa de 2.000 caracteres' using errcode = '22023';
  end if;

  if p_acao = 'enviar_parecer' then
    if v_atual."TP_SITUACAO" <> 'REGISTRADO' then
      raise exception 'Só recurso registrado vai para parecer jurídico' using errcode = '22023';
    end if;
    v_novo := 'EM_ANALISE_JURIDICA';
  elsif p_acao = 'reabrir' then
    if v_atual."TP_SITUACAO" not in ('DEFERIDO', 'INDEFERIDO', 'PARCIALMENTE_INDEFERIDO') then
      raise exception 'Só recurso decidido pode ser reaberto' using errcode = '22023';
    end if;
    if v_atual."DT_RESPOSTA_CANDIDATO" is not null or exists (
      select 1 from public."TB_RESPOSTA_RECURSO" s
      where s."CO_RECURSO_CANDIDATO" = p_id and s."TP_ESTADO" = 'enviada') then
      raise exception 'A resposta já foi enviada ao candidato: a decisão não reabre' using errcode = '22023';
    end if;
    v_novo := 'EM_ANALISE_JURIDICA';
  else
    if v_atual."TP_SITUACAO" <> 'EM_ANALISE_JURIDICA' then
      raise exception 'O recurso não está em análise jurídica' using errcode = '22023';
    end if;
    v_novo := case p_acao
      when 'devolver' then 'REGISTRADO'
      when 'deferir' then 'DEFERIDO'
      when 'deferir_parcialmente' then 'PARCIALMENTE_INDEFERIDO'
      else 'INDEFERIDO' end;
  end if;

  update public."TB_RECURSO_CANDIDATO" set
    "TP_SITUACAO" = v_novo,
    "DT_DECISAO" = case when v_decisao then now() when p_acao = 'reabrir' then null else "DT_DECISAO" end,
    "CO_USUARIO_DECISAO" = case when v_decisao then v_uid when p_acao = 'reabrir' then null else "CO_USUARIO_DECISAO" end,
    "DS_PARECER_JURIDICO" = case when v_decisao then v_texto when p_acao = 'reabrir' then null else "DS_PARECER_JURIDICO" end,
    "DT_ENVIO_PARECER" = case when p_acao in ('enviar_parecer', 'reabrir') then now() when p_acao = 'devolver' then null else "DT_ENVIO_PARECER" end,
    "CO_USUARIO_ENVIO_PARECER" = case when p_acao in ('enviar_parecer', 'reabrir') then v_uid when p_acao = 'devolver' then null else "CO_USUARIO_ENVIO_PARECER" end,
    "DT_DEVOLUCAO" = case when p_acao = 'devolver' then now() when p_acao = 'enviar_parecer' then null else "DT_DEVOLUCAO" end,
    "CO_USUARIO_DEVOLUCAO" = case when p_acao = 'devolver' then v_uid when p_acao = 'enviar_parecer' then null else "CO_USUARIO_DEVOLUCAO" end,
    "DS_COMENTARIO_DEVOLUCAO" = case when p_acao = 'devolver' then v_texto when p_acao = 'enviar_parecer' then null else "DS_COMENTARIO_DEVOLUCAO" end,
    "NU_REVISAO" = "NU_REVISAO" + 1,
    "DT_ATUALIZACAO" = now(),
    "CO_USUARIO_ATUALIZACAO" = v_uid
  where "CO_RECURSO_CANDIDATO" = p_id
  returning "NU_REVISAO" into v_revisao;

  insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "DS_MOTIVO", "CO_USUARIO")
  values (p_id, 'parecer', p_acao, v_atual."TP_SITUACAO", v_novo, v_texto, v_uid);

  return json_build_object('id', p_id, 'situacao', v_novo, 'revisao', v_revisao);
end;
$function$;
comment on function public.transicionar_recurso_candidato(uuid, text, integer, text) is
  'Fluxo do parecer jurídico: enviar_parecer (REGISTRADO → EM_ANALISE_JURIDICA; recursos >= editor), devolver (comentário; volta a REGISTRADO), deferir / deferir_parcialmente / indeferir (parecer de 10 a 20.000 caracteres; grava quem e quando) e reabrir (motivo; só sem resposta enviada) — estas exigem recursos_parecer. Revisão desatualizada → 40001. Tudo vai para TH_RECURSO_CANDIDATO (parecer). Área e coordenação do edital conferidas.';

revoke all on function public.transicionar_recurso_candidato(uuid, text, integer, text) from public, anon;
grant execute on function public.transicionar_recurso_candidato(uuid, text, integer, text) to authenticated, service_role;

-- 5. Leitura da aba: corpo de 20260929230000, com o parecer ------------------------------
create or replace function public.get_recursos_da_area(p_area text)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_pode_editar boolean;
begin
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  perform private."FC_EXIGIR_RECURSOS_NA_AREA"(p_area, 1);
  v_pode_editar := private.pode_recurso('recursos', 2);
  return (
    with recursos as (
      select r.*, m.edital, m.unidade,
             a.candidato, a.id_origem, a.nome_vaga, a.codigo_vaga,
             a.nota_final_ajustada, a.status_consolidado,
             (select s."TP_ESTADO" from public."TB_RESPOSTA_RECURSO" s
               where s."CO_RECURSO_CANDIDATO" = r."CO_RECURSO_CANDIDATO") as resposta_estado,
             (select count(*) from public."TB_ANEXO_RECURSO" x
               where x."CO_RECURSO_CANDIDATO" = r."CO_RECURSO_CANDIDATO" and x."ST_ATIVO" = 'S') as qt_anexos
      from public."TB_RECURSO_CANDIDATO" r
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = r."CO_MONITORAMENTO"
      left join public."TB_ANALISE_CURRICULAR" a on a.id = r."CO_ANALISE_CURRICULAR"
      where m."CO_AREA" = p_area
        and r."ST_ATIVO" = 'S'
        and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
    )
    select json_build_object(
      'schema_version', 1,
      'area', p_area,
      'pode_editar', v_pode_editar,
      'pode_decidir', private."FC_PODE_PARECER_RECURSO"(),
      'pode_administrar_modelos', private.pode_recurso('recursos', 3),
      'gerado_em', now(),
      'origens', (
        select coalesce(json_agg(json_build_object(
            'id', o."CO_ORIGEM_RECURSO",
            'rotulo', o."NO_ORIGEM_RECURSO",
            'ativo', o."ST_ATIVO" = 'S'
          ) order by o."NU_ORDEM"), '[]'::json)
        from public."TB_ORIGEM_RECURSO" o
      ),
      'editais', case when v_pode_editar then (
        select coalesce(json_agg(json_build_object(
            'id', m.id,
            'edital', m.edital,
            'unidade', m.unidade,
            'status', m.status,
            'tem_analises', exists (
              select 1 from public."TB_ANALISE_CURRICULAR" a
              where a.edital = m.edital and a."CO_AREA" = m."CO_AREA"
            )
          ) order by m.edital), '[]'::json)
        from public."TB_MONITORAMENTO_INDIGENA" m
        where m."CO_AREA" = p_area
          and m.ativo
          and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
      ) else '[]'::json end,
      'modelos', case when v_pode_editar then (
        select coalesce(json_agg(json_build_object(
            'id', t."CO_MODELO_RESPOSTA",
            'versao', t."NU_VERSAO",
            'area', t."CO_AREA",
            'origem', t."CO_ORIGEM_RECURSO",
            'situacao', t."TP_SITUACAO",
            'nome', t."NO_MODELO",
            'corpo', t."DS_CORPO"
          ) order by t."NO_MODELO"), '[]'::json)
        from public."TB_MODELO_RESPOSTA_RECURSO" t
        where t."ST_VIGENTE" = 'S'
          and t."ST_ATIVO" = 'S'
          and (t."CO_AREA" is null or t."CO_AREA" = p_area)
      ) else '[]'::json end,
      'recursos', (
        select coalesce(json_agg(json_build_object(
            'id', r."CO_RECURSO_CANDIDATO",
            'nu', r."NU_RECURSO",
            'edital_id', r."CO_MONITORAMENTO",
            'edital', r.edital,
            'unidade', r.unidade,
            'origem', r."CO_ORIGEM_RECURSO",
            'analise_id', r."CO_ANALISE_CURRICULAR",
            'fora_analise', r."ST_FORA_ANALISE" = 'S',
            'candidato', coalesce(r.candidato, r."NO_CANDIDATO_INFORMADO"),
            'codigo', coalesce(r.id_origem, r."CO_CANDIDATO_INFORMADO"),
            'cargo', coalesce(r.nome_vaga, r."NO_CARGO_INFORMADO"),
            'vaga', coalesce(r.codigo_vaga, r."CO_VAGA_INFORMADA"),
            'nota_anterior', r."VL_NOTA_ANTERIOR",
            'nota_atual', r.nota_final_ajustada,
            'resultado_anterior', r."DS_RESULTADO_ANTERIOR",
            'resultado_atual', r.status_consolidado,
            'analista', r."NO_ANALISTA",
            'situacao', r."TP_SITUACAO",
            'processo_sei', r."NU_PROCESSO_SEI",
            'mudou_classificacao', r."ST_MUDOU_CLASSIFICACAO" = 'S',
            'download_empregare_em', r."DT_DOWNLOAD_EMPREGARE",
            'processo_sei_em', r."DT_PROCESSO_SEI",
            'upload_sei_em', r."DT_UPLOAD_SEI",
            'resposta_candidato_em', r."DT_RESPOSTA_CANDIDATO",
            'decisao_em', r."DT_DECISAO",
            'parecer_enviado_em', r."DT_ENVIO_PARECER",
            'devolvido_em', r."DT_DEVOLUCAO",
            'criado_em', r."DT_CRIACAO",
            'atualizado_em', r."DT_ATUALIZACAO",
            'revisao', r."NU_REVISAO",
            'resposta_estado', r.resposta_estado,
            'qt_anexos', r.qt_anexos
          ) order by r."NU_RECURSO" desc), '[]'::json)
        from recursos r
      ),
      'cronogramas', (
        select coalesce(json_agg(json_build_object(
            'edital_id', c.monitoramento_id,
            'ordem', c.ordem,
            'atividade', c.atividade,
            'inicio', c.data_inicio,
            'fim', c.data_fim
          ) order by c.monitoramento_id, c.ordem), '[]'::json)
        from public."TB_CRONOGRAMA_MONIT_INDIG" c
        where c.monitoramento_id in (select r."CO_MONITORAMENTO" from recursos r)
      )
    )
  );
end;
$function$;
comment on function public.get_recursos_da_area(text) is
  'Aba Recursos de uma área (json): recursos ativos (com o estado da resposta, o nº de anexos, o envio para parecer e a última devolução), origens, editais e modelos (quem edita), as etapas do cronograma e as permissões (pode_editar, pode_decidir = recursos_parecer, pode_administrar_modelos). Exige recursos >= leitor, a área e o recorte da coordenação.';

-- 6. Detalhe: corpo de 20260929230000, com o parecer --------------------------------------
create or replace function public.get_recurso_candidato_detalhe(p_id uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text;
begin
  select m."CO_AREA" into v_area
  from public."TB_RECURSO_CANDIDATO" r
  join public."TB_MONITORAMENTO_INDIGENA" m on m.id = r."CO_MONITORAMENTO"
  where r."CO_RECURSO_CANDIDATO" = p_id and r."ST_ATIVO" = 'S';
  if v_area is null then
    raise exception 'Recurso não encontrado' using errcode = 'P0002';
  end if;
  perform private."FC_EXIGIR_RECURSOS_NA_AREA"(v_area, 1);
  perform private."FC_EXIGIR_AREA_EDITAL"((select r."CO_MONITORAMENTO"::text from public."TB_RECURSO_CANDIDATO" r where r."CO_RECURSO_CANDIDATO" = p_id));
  return (
    select json_build_object(
      'id', r."CO_RECURSO_CANDIDATO",
      'eu', (select auth.uid()),
      'observacao', r."DS_OBSERVACAO",
      'modalidade', a.modalidade_concorrencia,
      'responsavel_analise', a.responsavel_analise,
      'analise_ativa', a.ativo,
      'nome_informado', r."NO_CANDIDATO_INFORMADO",
      'codigo_informado', r."CO_CANDIDATO_INFORMADO",
      'cargo_informado', r."NO_CARGO_INFORMADO",
      'vaga_informada', r."CO_VAGA_INFORMADA",
      'criado_por', private."FC_NOME_USUARIO"(r."CO_USUARIO_CRIACAO"),
      'decisao_por', private."FC_NOME_USUARIO"(r."CO_USUARIO_DECISAO"),
      'parecer', r."DS_PARECER_JURIDICO",
      'parecer_enviado_em', r."DT_ENVIO_PARECER",
      'parecer_enviado_por', private."FC_NOME_USUARIO"(r."CO_USUARIO_ENVIO_PARECER"),
      'devolvido_em', r."DT_DEVOLUCAO",
      'devolvido_por', private."FC_NOME_USUARIO"(r."CO_USUARIO_DEVOLUCAO"),
      'comentario_devolucao', r."DS_COMENTARIO_DEVOLUCAO",
      'etapas', json_build_object(
        'download_empregare', private."FC_NOME_USUARIO"(r."CO_USUARIO_DOWNLOAD_EMPREGARE"),
        'processo_sei', private."FC_NOME_USUARIO"(r."CO_USUARIO_PROCESSO_SEI"),
        'upload_sei', private."FC_NOME_USUARIO"(r."CO_USUARIO_UPLOAD_SEI"),
        'resposta_candidato', private."FC_NOME_USUARIO"(r."CO_USUARIO_RESPOSTA_CANDIDATO")
      ),
      'historico', (
        select coalesce(json_agg(json_build_object(
            'em', h."DT_ALTERACAO",
            'acao', h."TP_ACAO",
            'campo', h."DS_CAMPO",
            'anterior', h."DS_VALOR_ANTERIOR",
            'novo', h."DS_VALOR_NOVO",
            'motivo', h."DS_MOTIVO",
            'autor', private."FC_NOME_USUARIO"(h."CO_USUARIO")
          ) order by h."DT_ALTERACAO" desc, h."CO_HISTORICO_RECURSO" desc), '[]'::json)
        from public."TH_RECURSO_CANDIDATO" h
        where h."CO_RECURSO_CANDIDATO" = r."CO_RECURSO_CANDIDATO"
      ),
      'anexos', (
        select coalesce(json_agg(json_build_object(
            'id', x."CO_ANEXO_RECURSO",
            'tipo', x."TP_ANEXO",
            'nome', x."NO_ARQUIVO",
            'bytes', x."QT_BYTES",
            'mime', x."DS_MIME",
            'ativo', x."ST_ATIVO" = 'S',
            'resposta_id', x."CO_RESPOSTA_RECURSO",
            'incluido_em', x."DT_INCLUSAO",
            'incluido_por', private."FC_NOME_USUARIO"(x."CO_USUARIO_INCLUSAO"),
            'arquivado_em', x."DT_ARQUIVAMENTO",
            'arquivado_por', private."FC_NOME_USUARIO"(x."CO_USUARIO_ARQUIVAMENTO"),
            'motivo_arquivamento', x."DS_MOTIVO_ARQUIVAMENTO"
          ) order by x."ST_ATIVO" desc, x."DT_INCLUSAO" desc), '[]'::json)
        from public."TB_ANEXO_RECURSO" x
        where x."CO_RECURSO_CANDIDATO" = r."CO_RECURSO_CANDIDATO"
      ),
      'resposta', (
        select json_build_object(
          'id', s."CO_RESPOSTA_RECURSO",
          'modelo_id', s."CO_MODELO_RESPOSTA",
          'modelo_versao', s."NU_VERSAO_MODELO",
          'modelo_nome', t."NO_MODELO",
          'modelo_situacao', t."TP_SITUACAO",
          'modelo_vigente', t."ST_VIGENTE" = 'S',
          'modelo_corpo', t."DS_CORPO",
          'fundamentacao', s."DS_FUNDAMENTACAO",
          'texto_final', s."DS_TEXTO_FINAL",
          'estado', s."TP_ESTADO",
          'passou_revisao', s."ST_PASSOU_REVISAO" = 'S',
          'autor_id', s."CO_USUARIO_AUTOR",
          'autor', private."FC_NOME_USUARIO"(s."CO_USUARIO_AUTOR"),
          'envio_revisao_em', s."DT_ENVIO_REVISAO",
          'envio_revisao_por_id', s."CO_USUARIO_ENVIO_REVISAO",
          'envio_revisao_por', private."FC_NOME_USUARIO"(s."CO_USUARIO_ENVIO_REVISAO"),
          'revisor_id', s."CO_USUARIO_REVISOR",
          'revisor', private."FC_NOME_USUARIO"(s."CO_USUARIO_REVISOR"),
          'revisao_em', s."DT_REVISAO",
          'comentario_revisao', s."DS_COMENTARIO_REVISAO",
          'enviada_em', s."DT_ENVIO",
          'enviada_por', private."FC_NOME_USUARIO"(s."CO_USUARIO_ENVIO"),
          'revisao', s."NU_REVISAO",
          'criado_em', s."DT_CRIACAO",
          'atualizado_em', s."DT_ATUALIZACAO",
          'historico', (
            select coalesce(json_agg(json_build_object(
                'em', h."DT_ACAO",
                'acao', h."TP_ACAO",
                'anterior', h."TP_ESTADO_ANTERIOR",
                'novo', h."TP_ESTADO_NOVO",
                'comentario', h."DS_COMENTARIO",
                'versao_modelo', h."NU_VERSAO_MODELO",
                'autor', private."FC_NOME_USUARIO"(h."CO_USUARIO")
              ) order by h."DT_ACAO" desc, h."CO_HISTORICO_RESPOSTA" desc), '[]'::json)
            from public."TH_RESPOSTA_RECURSO" h
            where h."CO_RESPOSTA_RECURSO" = s."CO_RESPOSTA_RECURSO"
          )
        )
        from public."TB_RESPOSTA_RECURSO" s
        join public."TB_MODELO_RESPOSTA_RECURSO" t
          on t."CO_MODELO_RESPOSTA" = s."CO_MODELO_RESPOSTA" and t."NU_VERSAO" = s."NU_VERSAO_MODELO"
        where s."CO_RECURSO_CANDIDATO" = r."CO_RECURSO_CANDIDATO"
      )
    )
    from public."TB_RECURSO_CANDIDATO" r
    left join public."TB_ANALISE_CURRICULAR" a on a.id = r."CO_ANALISE_CURRICULAR"
    where r."CO_RECURSO_CANDIDATO" = p_id
  );
end;
$function$;
comment on function public.get_recurso_candidato_detalhe(uuid) is
  'Detalhe de um recurso: observação, quem fez cada etapa, o parecer jurídico (envio, devolução, decisão e texto), o histórico, os anexos, a resposta (com o histórico dela) e o id de quem pede. Mesma permissão da leitura da aba, na área e na coordenação do edital.';

-- 7. Salvar: corpo de 20260929190200, sem mudar a situação --------------------------------
create or replace function public.salvar_recurso_candidato(p_dados jsonb)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_edital_id uuid;
  v_edital text;
  v_area text;
  v_origem text;
  v_fora boolean;
  v_analise_id uuid;
  v_nota numeric;
  v_resultado text;
  v_responsavel text;
  v_duplicado bigint;
  v_atual public."TB_RECURSO_CANDIDATO";
  v_novo public."TB_RECURSO_CANDIDATO";
  v_texto text;
begin
  if jsonb_typeof(p_dados) is distinct from 'object' then
    raise exception 'Dados inválidos' using errcode = '22023';
  end if;
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  v_id := nullif(p_dados->>'id', '')::uuid;

  if v_id is null then
    -- Cadastro: nasce REGISTRADO; a situação muda só pelo fluxo do parecer.
    v_edital_id := nullif(p_dados->>'edital_id', '')::uuid;
    select m.edital, m."CO_AREA" into v_edital, v_area
    from public."TB_MONITORAMENTO_INDIGENA" m
    where m.id = v_edital_id;
    if v_area is null then
      raise exception 'Edital não encontrado' using errcode = '22023';
    end if;
    perform private."FC_EXIGIR_RECURSOS_NA_AREA"(v_area, 2);
    perform private."FC_EXIGIR_AREA_EDITAL"(v_edital_id::text);

    if coalesce(nullif(p_dados->>'situacao', ''), 'REGISTRADO') <> 'REGISTRADO' then
      raise exception 'O recurso nasce registrado; a decisão é do parecer jurídico' using errcode = '22023';
    end if;
    v_origem := nullif(p_dados->>'origem', '');
    if not exists (select 1 from public."TB_ORIGEM_RECURSO" o where o."CO_ORIGEM_RECURSO" = v_origem and o."ST_ATIVO" = 'S') then
      raise exception 'Origem do recurso inválida' using errcode = '22023';
    end if;
    v_fora := coalesce((p_dados->>'fora_analise')::boolean, false);

    if not v_fora then
      select a.id, a.nota_final_ajustada, a.status_consolidado, a.responsavel_analise
        into v_analise_id, v_nota, v_resultado, v_responsavel
      from public."TB_ANALISE_CURRICULAR" a
      where a.id = nullif(p_dados->>'analise_id', '')::uuid
        and a.edital = v_edital
        and a."CO_AREA" = v_area;
      if v_analise_id is null then
        raise exception 'Candidato não encontrado nas análises deste edital' using errcode = '22023';
      end if;
      select r."NU_RECURSO" into v_duplicado
      from public."TB_RECURSO_CANDIDATO" r
      where r."CO_ANALISE_CURRICULAR" = v_analise_id
        and r."CO_MONITORAMENTO" = v_edital_id
        and r."CO_ORIGEM_RECURSO" = v_origem
        and r."ST_ATIVO" = 'S'
        and r."TP_SITUACAO" in ('REGISTRADO', 'EM_ANALISE_JURIDICA')
      order by r."NU_RECURSO"
      limit 1;
    else
      v_texto := btrim(coalesce(p_dados->>'nome_informado', ''));
      if length(v_texto) not between 3 and 200 then
        raise exception 'Informe o nome do candidato (3 a 200 caracteres)' using errcode = '22023';
      end if;
      select r."NU_RECURSO" into v_duplicado
      from public."TB_RECURSO_CANDIDATO" r
      where r."ST_FORA_ANALISE" = 'S'
        and private."FC_TEXTO_BUSCA_RECURSO"(r."NO_CANDIDATO_INFORMADO") = private."FC_TEXTO_BUSCA_RECURSO"(v_texto)
        and r."CO_MONITORAMENTO" = v_edital_id
        and r."CO_ORIGEM_RECURSO" = v_origem
        and r."ST_ATIVO" = 'S'
        and r."TP_SITUACAO" in ('REGISTRADO', 'EM_ANALISE_JURIDICA')
      order by r."NU_RECURSO"
      limit 1;
    end if;

    if v_duplicado is not null and not coalesce((p_dados->>'permitir_duplicado')::boolean, false) then
      raise exception 'Já existe o recurso nº % sem decisão para este candidato, edital e origem', v_duplicado
        using errcode = '23505', hint = 'duplicado:' || v_duplicado;
    end if;

    insert into public."TB_RECURSO_CANDIDATO" (
      "CO_MONITORAMENTO", "CO_ORIGEM_RECURSO", "CO_ANALISE_CURRICULAR", "ST_FORA_ANALISE",
      "NO_CANDIDATO_INFORMADO", "CO_CANDIDATO_INFORMADO", "NO_CARGO_INFORMADO", "CO_VAGA_INFORMADA",
      "VL_NOTA_ANTERIOR", "DS_RESULTADO_ANTERIOR", "NO_ANALISTA", "TP_SITUACAO",
      "NU_PROCESSO_SEI", "ST_MUDOU_CLASSIFICACAO", "DS_OBSERVACAO",
      "DT_PROCESSO_SEI", "CO_USUARIO_PROCESSO_SEI",
      "CO_USUARIO_CRIACAO", "CO_USUARIO_ATUALIZACAO"
    ) values (
      v_edital_id, v_origem,
      v_analise_id,
      case when v_fora then 'S' else 'N' end,
      case when v_fora then v_texto end,
      case when v_fora then nullif(btrim(p_dados->>'codigo_informado'), '') end,
      case when v_fora then nullif(btrim(p_dados->>'cargo_informado'), '') end,
      case when v_fora then nullif(btrim(p_dados->>'vaga_informada'), '') end,
      v_nota,
      v_resultado,
      coalesce(nullif(btrim(p_dados->>'analista'), ''), nullif(btrim(v_responsavel), '')),
      'REGISTRADO',
      nullif(btrim(p_dados->>'processo_sei'), ''),
      case when coalesce((p_dados->>'mudou_classificacao')::boolean, false) then 'S' else 'N' end,
      nullif(btrim(p_dados->>'observacao'), ''),
      case when nullif(btrim(p_dados->>'processo_sei'), '') is not null then now() end,
      case when nullif(btrim(p_dados->>'processo_sei'), '') is not null then v_uid end,
      v_uid, v_uid
    )
    returning * into v_novo;

    insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_VALOR_NOVO", "CO_USUARIO")
    values (v_novo."CO_RECURSO_CANDIDATO", 'criacao', v_novo."TP_SITUACAO", v_uid);

    return json_build_object('id', v_novo."CO_RECURSO_CANDIDATO", 'nu', v_novo."NU_RECURSO", 'revisao', v_novo."NU_REVISAO");
  end if;

  -- Edição -------------------------------------------------------------------
  select r.* into v_atual
  from public."TB_RECURSO_CANDIDATO" r
  where r."CO_RECURSO_CANDIDATO" = v_id and r."ST_ATIVO" = 'S'
  for update;
  if not found then
    raise exception 'Recurso não encontrado' using errcode = 'P0002';
  end if;
  select m."CO_AREA" into v_area from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_atual."CO_MONITORAMENTO";
  perform private."FC_EXIGIR_RECURSOS_NA_AREA"(v_area, 2);
  perform private."FC_EXIGIR_AREA_EDITAL"(v_atual."CO_MONITORAMENTO"::text);
  if (p_dados->>'revisao') is null or (p_dados->>'revisao')::integer <> v_atual."NU_REVISAO" then
    raise exception 'O recurso foi alterado por outra pessoa. Recarregue e tente de novo.' using errcode = '40001';
  end if;
  if p_dados ? 'situacao' and coalesce(nullif(p_dados->>'situacao', ''), v_atual."TP_SITUACAO") <> v_atual."TP_SITUACAO" then
    raise exception 'A situação do recurso muda só pelo fluxo do parecer jurídico' using errcode = '22023';
  end if;

  v_novo := v_atual;
  if p_dados ? 'origem' then
    v_novo."CO_ORIGEM_RECURSO" := nullif(p_dados->>'origem', '');
    if v_novo."CO_ORIGEM_RECURSO" is distinct from v_atual."CO_ORIGEM_RECURSO"
       and not exists (select 1 from public."TB_ORIGEM_RECURSO" o where o."CO_ORIGEM_RECURSO" = v_novo."CO_ORIGEM_RECURSO" and o."ST_ATIVO" = 'S') then
      raise exception 'Origem do recurso inválida' using errcode = '22023';
    end if;
  end if;
  if p_dados ? 'analista' then v_novo."NO_ANALISTA" := nullif(btrim(p_dados->>'analista'), ''); end if;
  if p_dados ? 'processo_sei' then v_novo."NU_PROCESSO_SEI" := nullif(btrim(p_dados->>'processo_sei'), ''); end if;
  if p_dados ? 'mudou_classificacao' then
    v_novo."ST_MUDOU_CLASSIFICACAO" := case when coalesce((p_dados->>'mudou_classificacao')::boolean, false) then 'S' else 'N' end;
  end if;
  if p_dados ? 'observacao' then v_novo."DS_OBSERVACAO" := nullif(btrim(p_dados->>'observacao'), ''); end if;
  if v_atual."ST_FORA_ANALISE" = 'S' then
    if p_dados ? 'nome_informado' then
      v_novo."NO_CANDIDATO_INFORMADO" := btrim(coalesce(p_dados->>'nome_informado', ''));
      if length(v_novo."NO_CANDIDATO_INFORMADO") not between 3 and 200 then
        raise exception 'Informe o nome do candidato (3 a 200 caracteres)' using errcode = '22023';
      end if;
    end if;
    if p_dados ? 'codigo_informado' then v_novo."CO_CANDIDATO_INFORMADO" := nullif(btrim(p_dados->>'codigo_informado'), ''); end if;
    if p_dados ? 'cargo_informado' then v_novo."NO_CARGO_INFORMADO" := nullif(btrim(p_dados->>'cargo_informado'), ''); end if;
    if p_dados ? 'vaga_informada' then v_novo."CO_VAGA_INFORMADA" := nullif(btrim(p_dados->>'vaga_informada'), ''); end if;
  end if;

  -- Informar o número do processo SEI marca a etapa "processo SEI criado".
  if v_novo."NU_PROCESSO_SEI" is not null and v_novo."DT_PROCESSO_SEI" is null then
    v_novo."DT_PROCESSO_SEI" := now();
    v_novo."CO_USUARIO_PROCESSO_SEI" := v_uid;
  end if;

  insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
  select v_id, c.acao, c.campo, c.antes, c.depois, v_uid
  from (values
    ('edicao', 'origem', v_atual."CO_ORIGEM_RECURSO", v_novo."CO_ORIGEM_RECURSO"),
    ('edicao', 'analista', v_atual."NO_ANALISTA", v_novo."NO_ANALISTA"),
    ('edicao', 'processo_sei', v_atual."NU_PROCESSO_SEI", v_novo."NU_PROCESSO_SEI"),
    ('edicao', 'mudou_classificacao', v_atual."ST_MUDOU_CLASSIFICACAO", v_novo."ST_MUDOU_CLASSIFICACAO"),
    ('edicao', 'observacao', v_atual."DS_OBSERVACAO", v_novo."DS_OBSERVACAO"),
    ('edicao', 'nome_informado', v_atual."NO_CANDIDATO_INFORMADO", v_novo."NO_CANDIDATO_INFORMADO"),
    ('edicao', 'codigo_informado', v_atual."CO_CANDIDATO_INFORMADO", v_novo."CO_CANDIDATO_INFORMADO"),
    ('edicao', 'cargo_informado', v_atual."NO_CARGO_INFORMADO", v_novo."NO_CARGO_INFORMADO"),
    ('edicao', 'vaga_informada', v_atual."CO_VAGA_INFORMADA", v_novo."CO_VAGA_INFORMADA"),
    ('etapa', 'processo_sei', case when v_atual."DT_PROCESSO_SEI" is null then 'N' else 'S' end, case when v_novo."DT_PROCESSO_SEI" is null then 'N' else 'S' end)
  ) as c(acao, campo, antes, depois)
  where c.antes is distinct from c.depois;
  if not found then
    return json_build_object('id', v_atual."CO_RECURSO_CANDIDATO", 'nu', v_atual."NU_RECURSO", 'revisao', v_atual."NU_REVISAO");
  end if;

  update public."TB_RECURSO_CANDIDATO" set
    "CO_ORIGEM_RECURSO" = v_novo."CO_ORIGEM_RECURSO",
    "NO_ANALISTA" = v_novo."NO_ANALISTA",
    "NU_PROCESSO_SEI" = v_novo."NU_PROCESSO_SEI",
    "ST_MUDOU_CLASSIFICACAO" = v_novo."ST_MUDOU_CLASSIFICACAO",
    "DS_OBSERVACAO" = v_novo."DS_OBSERVACAO",
    "NO_CANDIDATO_INFORMADO" = v_novo."NO_CANDIDATO_INFORMADO",
    "CO_CANDIDATO_INFORMADO" = v_novo."CO_CANDIDATO_INFORMADO",
    "NO_CARGO_INFORMADO" = v_novo."NO_CARGO_INFORMADO",
    "CO_VAGA_INFORMADA" = v_novo."CO_VAGA_INFORMADA",
    "DT_PROCESSO_SEI" = v_novo."DT_PROCESSO_SEI",
    "CO_USUARIO_PROCESSO_SEI" = v_novo."CO_USUARIO_PROCESSO_SEI",
    "NU_REVISAO" = v_atual."NU_REVISAO" + 1,
    "DT_ATUALIZACAO" = now(),
    "CO_USUARIO_ATUALIZACAO" = v_uid
  where "CO_RECURSO_CANDIDATO" = v_id
  returning * into v_novo;

  return json_build_object('id', v_novo."CO_RECURSO_CANDIDATO", 'nu', v_novo."NU_RECURSO", 'revisao', v_novo."NU_REVISAO");
end;
$function$;
comment on function public.salvar_recurso_candidato(jsonb) is
  'Cadastra (sem id; nasce REGISTRADO) ou edita (com id e revisão) um recurso. Cadastro: edital, origem ativa e o candidato das análises do mesmo edital (ou fora_analise com nome); guarda a nota e o resultado do dia; duplicado sem decisão (mesmo candidato, edital e origem) dá 23505 salvo permitir_duplicado. Edição: origem, analista, processo SEI, mudou a classificação, observação e, fora das análises, os dados digitados; revisão desatualizada dá 40001. A situação não muda aqui (22023): é de transicionar_recurso_candidato. Tudo vai para TH_RECURSO_CANDIDATO. Exige recursos >= editor, a área e a coordenação do edital.';

-- 8. Etapa: corpo de 20260929190200; "resposta enviada" só com o recurso decidido ----------
create or replace function public.marcar_etapa_recurso(p_id uuid, p_etapa text, p_feita boolean)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_atual public."TB_RECURSO_CANDIDATO";
  v_area text;
  v_antes timestamptz;
  v_em timestamptz;
  v_revisao integer;
begin
  if p_etapa is null or p_etapa not in ('download_empregare', 'processo_sei', 'upload_sei', 'resposta_candidato') then
    raise exception 'Etapa inválida' using errcode = '22023';
  end if;
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  select r.* into v_atual
  from public."TB_RECURSO_CANDIDATO" r
  where r."CO_RECURSO_CANDIDATO" = p_id and r."ST_ATIVO" = 'S'
  for update;
  if not found then
    raise exception 'Recurso não encontrado' using errcode = 'P0002';
  end if;
  select m."CO_AREA" into v_area from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_atual."CO_MONITORAMENTO";
  perform private."FC_EXIGIR_RECURSOS_NA_AREA"(v_area, 2);
  perform private."FC_EXIGIR_AREA_EDITAL"(v_atual."CO_MONITORAMENTO"::text);
  -- A etapa "resposta enviada" (quem edita) só com o recurso já decidido pelo jurídico.
  if p_etapa = 'resposta_candidato' then
    if coalesce(p_feita, false) and v_atual."TP_SITUACAO" not in ('DEFERIDO', 'INDEFERIDO', 'PARCIALMENTE_INDEFERIDO') then
      raise exception 'Registre a decisão antes de marcar a resposta enviada' using errcode = '22023';
    end if;
  end if;

  v_antes := case p_etapa
    when 'download_empregare' then v_atual."DT_DOWNLOAD_EMPREGARE"
    when 'processo_sei' then v_atual."DT_PROCESSO_SEI"
    when 'upload_sei' then v_atual."DT_UPLOAD_SEI"
    else v_atual."DT_RESPOSTA_CANDIDATO" end;
  if (v_antes is not null) = coalesce(p_feita, false) then
    return json_build_object('revisao', v_atual."NU_REVISAO", 'alterou', false, 'em', v_antes);
  end if;
  v_em := case when p_feita then now() end;

  update public."TB_RECURSO_CANDIDATO" set
    "DT_DOWNLOAD_EMPREGARE" = case when p_etapa = 'download_empregare' then v_em else "DT_DOWNLOAD_EMPREGARE" end,
    "CO_USUARIO_DOWNLOAD_EMPREGARE" = case when p_etapa = 'download_empregare' then case when p_feita then v_uid end else "CO_USUARIO_DOWNLOAD_EMPREGARE" end,
    "DT_PROCESSO_SEI" = case when p_etapa = 'processo_sei' then v_em else "DT_PROCESSO_SEI" end,
    "CO_USUARIO_PROCESSO_SEI" = case when p_etapa = 'processo_sei' then case when p_feita then v_uid end else "CO_USUARIO_PROCESSO_SEI" end,
    "DT_UPLOAD_SEI" = case when p_etapa = 'upload_sei' then v_em else "DT_UPLOAD_SEI" end,
    "CO_USUARIO_UPLOAD_SEI" = case when p_etapa = 'upload_sei' then case when p_feita then v_uid end else "CO_USUARIO_UPLOAD_SEI" end,
    "DT_RESPOSTA_CANDIDATO" = case when p_etapa = 'resposta_candidato' then v_em else "DT_RESPOSTA_CANDIDATO" end,
    "CO_USUARIO_RESPOSTA_CANDIDATO" = case when p_etapa = 'resposta_candidato' then case when p_feita then v_uid end else "CO_USUARIO_RESPOSTA_CANDIDATO" end,
    "NU_REVISAO" = "NU_REVISAO" + 1,
    "DT_ATUALIZACAO" = now(),
    "CO_USUARIO_ATUALIZACAO" = v_uid
  where "CO_RECURSO_CANDIDATO" = p_id
  returning "NU_REVISAO" into v_revisao;

  insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
  values (p_id, 'etapa', p_etapa, case when v_antes is null then 'N' else 'S' end, case when p_feita then 'S' else 'N' end, v_uid);

  return json_build_object('revisao', v_revisao, 'alterou', true, 'em', v_em);
end;
$function$;
comment on function public.marcar_etapa_recurso(uuid, text, boolean) is
  'Marca (com quando e quem) ou desmarca uma etapa: download_empregare, processo_sei, upload_sei ou resposta_candidato. Marcar a resposta enviada exige o recurso decidido (pelo parecer jurídico). Registra no histórico e sobe a revisão. Exige recursos >= editor, a área e a coordenação do edital.';

-- 9. Excluir: corpo de 20260929190200; decidido só com o parecer jurídico ---------------------
create or replace function public.excluir_recurso_candidato(p_id uuid, p_motivo text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_edital uuid;
  v_situacao text;
  v_area text;
begin
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 500 then
    raise exception 'Informe um motivo entre 3 e 500 caracteres' using errcode = '22023';
  end if;
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  select r."CO_MONITORAMENTO", r."TP_SITUACAO" into v_edital, v_situacao
  from public."TB_RECURSO_CANDIDATO" r
  where r."CO_RECURSO_CANDIDATO" = p_id and r."ST_ATIVO" = 'S'
  for update;
  if v_edital is null then
    raise exception 'Recurso não encontrado' using errcode = 'P0002';
  end if;
  select m."CO_AREA" into v_area from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_edital;
  perform private."FC_EXIGIR_RECURSOS_NA_AREA"(v_area, 2);
  perform private."FC_EXIGIR_AREA_EDITAL"(v_edital::text);
  if v_situacao in ('DEFERIDO', 'INDEFERIDO', 'PARCIALMENTE_INDEFERIDO') then
    perform private."FC_EXIGIR_PARECER_RECURSO"();
  end if;
  update public."TB_RECURSO_CANDIDATO" set
    "ST_ATIVO" = 'N',
    "NU_REVISAO" = "NU_REVISAO" + 1,
    "DT_ATUALIZACAO" = now(),
    "CO_USUARIO_ATUALIZACAO" = v_uid
  where "CO_RECURSO_CANDIDATO" = p_id;
  insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "DS_MOTIVO", "CO_USUARIO")
  values (p_id, 'exclusao', 'S', 'N', btrim(p_motivo), v_uid);
  return json_build_object('id', p_id, 'excluido', true);
end;
$function$;
comment on function public.excluir_recurso_candidato(uuid, text) is
  'Exclusão lógica (ST_ATIVO = N) de um recurso cadastrado por engano, com motivo no histórico. Exige recursos >= editor, a área e a coordenação do edital; recurso decidido, também o parecer jurídico.';

-- 10. Resposta: corpo de 20260929230000; aprovar e devolver são do parecer ------------------
create or replace function public.transicionar_resposta_recurso(p_resposta_id uuid, p_acao text, p_revisao integer, p_comentario text default null)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_atual public."TB_RESPOSTA_RECURSO";
  v_rec public."TB_RECURSO_CANDIDATO";
  v_situacao_modelo text;
  v_comentario text := nullif(btrim(coalesce(p_comentario, '')), '');
  v_novo text;
  v_revisao integer;
  v_etapa_em timestamptz;
begin
  if p_acao is null or p_acao not in ('enviar_revisao', 'aprovar', 'devolver', 'reabrir', 'marcar_enviada') then
    raise exception 'Ação inválida' using errcode = '22023';
  end if;
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  if length(coalesce(v_comentario, '')) > 2000 then
    raise exception 'O comentário passa de 2.000 caracteres' using errcode = '22023';
  end if;
  select s.* into v_atual from public."TB_RESPOSTA_RECURSO" s where s."CO_RESPOSTA_RECURSO" = p_resposta_id;
  if not found then
    raise exception 'Resposta não encontrada' using errcode = 'P0002';
  end if;
  perform private."FC_EXIGIR_RECURSO_ACESSIVEL"(v_atual."CO_RECURSO_CANDIDATO", 2);
  -- Aprovar ou devolver o texto da resposta (a revisão final): o parecer jurídico.
  if p_acao in ('aprovar', 'devolver') then
    perform private."FC_EXIGIR_PARECER_RECURSO"();
  end if;
  -- Mesma ordem de trava de salvar_resposta_recurso: o recurso, depois a resposta.
  select r.* into v_rec from public."TB_RECURSO_CANDIDATO" r
  where r."CO_RECURSO_CANDIDATO" = v_atual."CO_RECURSO_CANDIDATO" for update;
  select s.* into v_atual from public."TB_RESPOSTA_RECURSO" s
  where s."CO_RESPOSTA_RECURSO" = p_resposta_id for update;
  if p_revisao is null or p_revisao <> v_atual."NU_REVISAO" then
    raise exception 'Outra pessoa alterou esta resposta. Recarregue e tente de novo.' using errcode = '40001';
  end if;

  if p_acao = 'enviar_revisao' then
    if v_atual."TP_ESTADO" not in ('rascunho', 'devolvida') then
      raise exception 'Só rascunho ou devolvida vai para revisão' using errcode = '22023';
    end if;
    v_novo := 'em_revisao';
  elsif p_acao = 'aprovar' then
    if v_atual."TP_ESTADO" not in ('rascunho', 'em_revisao') then
      raise exception 'Só rascunho ou resposta em revisão pode ser aprovada' using errcode = '22023';
    end if;
    if (v_atual."TP_ESTADO" = 'em_revisao' or v_atual."ST_PASSOU_REVISAO" = 'S')
       and (v_uid = v_atual."CO_USUARIO_AUTOR" or v_uid is not distinct from v_atual."CO_USUARIO_ENVIO_REVISAO") then
      raise exception 'Quem escreveu ou enviou a resposta para revisão não pode aprová-la' using errcode = '42501';
    end if;
    select t."TP_SITUACAO" into v_situacao_modelo from public."TB_MODELO_RESPOSTA_RECURSO" t
    where t."CO_MODELO_RESPOSTA" = v_atual."CO_MODELO_RESPOSTA" and t."NU_VERSAO" = v_atual."NU_VERSAO_MODELO";
    if v_rec."TP_SITUACAO" not in ('DEFERIDO', 'INDEFERIDO', 'PARCIALMENTE_INDEFERIDO') then
      raise exception 'Registre a decisão do recurso antes de aprovar a resposta' using errcode = '22023';
    end if;
    if v_rec."TP_SITUACAO" <> v_situacao_modelo then
      raise exception 'A situação do recurso não é a do modelo usado na resposta' using errcode = '22023';
    end if;
    v_novo := 'aprovada';
  elsif p_acao = 'devolver' then
    if v_atual."TP_ESTADO" <> 'em_revisao' then
      raise exception 'Só resposta em revisão pode ser devolvida' using errcode = '22023';
    end if;
    if v_uid = v_atual."CO_USUARIO_AUTOR" then
      raise exception 'Quem escreveu a resposta não pode devolvê-la' using errcode = '42501';
    end if;
    if length(coalesce(v_comentario, '')) < 3 then
      raise exception 'Informe o que precisa ser ajustado (3 caracteres ou mais)' using errcode = '22023';
    end if;
    v_novo := 'devolvida';
  elsif p_acao = 'reabrir' then
    if v_atual."TP_ESTADO" <> 'aprovada' then
      raise exception 'Só resposta aprovada pode ser reaberta' using errcode = '22023';
    end if;
    if length(coalesce(v_comentario, '')) < 3 then
      raise exception 'Informe o motivo da reabertura (3 caracteres ou mais)' using errcode = '22023';
    end if;
    v_novo := 'rascunho';
  else
    if v_atual."TP_ESTADO" <> 'aprovada' then
      raise exception 'Só resposta aprovada pode ser marcada como enviada' using errcode = '22023';
    end if;
    -- Quem edita marca enviada, mas só com o recurso decidido (a decisão pode ter sido reaberta depois da aprovação).
    if v_rec."TP_SITUACAO" not in ('DEFERIDO', 'INDEFERIDO', 'PARCIALMENTE_INDEFERIDO') then
      raise exception 'O recurso não está decidido: a resposta não pode ser enviada' using errcode = '22023';
    end if;
    v_novo := 'enviada';
  end if;

  update public."TB_RESPOSTA_RECURSO" set
    "TP_ESTADO" = v_novo,
    "ST_PASSOU_REVISAO" = case when p_acao = 'enviar_revisao' then 'S' else "ST_PASSOU_REVISAO" end,
    "DT_ENVIO_REVISAO" = case when p_acao = 'enviar_revisao' then now() else "DT_ENVIO_REVISAO" end,
    "CO_USUARIO_ENVIO_REVISAO" = case when p_acao = 'enviar_revisao' then v_uid else "CO_USUARIO_ENVIO_REVISAO" end,
    "DT_REVISAO" = case when p_acao in ('aprovar', 'devolver') then now() else "DT_REVISAO" end,
    "CO_USUARIO_REVISOR" = case when p_acao in ('aprovar', 'devolver') then v_uid else "CO_USUARIO_REVISOR" end,
    "DS_COMENTARIO_REVISAO" = case when p_acao in ('aprovar', 'devolver', 'reabrir') then v_comentario else "DS_COMENTARIO_REVISAO" end,
    "DT_ENVIO" = case when p_acao = 'marcar_enviada' then now() else "DT_ENVIO" end,
    "CO_USUARIO_ENVIO" = case when p_acao = 'marcar_enviada' then v_uid else "CO_USUARIO_ENVIO" end,
    "NU_REVISAO" = "NU_REVISAO" + 1,
    "DT_ATUALIZACAO" = now(),
    "CO_USUARIO_ATUALIZACAO" = v_uid
  where "CO_RESPOSTA_RECURSO" = p_resposta_id
  returning "NU_REVISAO" into v_revisao;

  insert into public."TH_RESPOSTA_RECURSO" (
    "CO_RESPOSTA_RECURSO", "TP_ACAO", "TP_ESTADO_ANTERIOR", "TP_ESTADO_NOVO", "DS_COMENTARIO",
    "CO_MODELO_RESPOSTA", "NU_VERSAO_MODELO", "DS_TEXTO_FINAL", "NU_REVISAO", "CO_USUARIO"
  ) values (
    p_resposta_id, p_acao, v_atual."TP_ESTADO", v_novo, v_comentario,
    v_atual."CO_MODELO_RESPOSTA", v_atual."NU_VERSAO_MODELO", v_atual."DS_TEXTO_FINAL", v_revisao, v_uid
  );
  insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "DS_MOTIVO", "CO_USUARIO")
  values (v_rec."CO_RECURSO_CANDIDATO", 'resposta', p_acao, v_atual."TP_ESTADO", v_novo, v_comentario, v_uid);

  -- Resposta enviada: a etapa do recurso acompanha (se ainda não estava marcada).
  v_etapa_em := v_rec."DT_RESPOSTA_CANDIDATO";
  if p_acao = 'marcar_enviada' and v_rec."DT_RESPOSTA_CANDIDATO" is null then
    v_etapa_em := now();
    update public."TB_RECURSO_CANDIDATO" set
      "DT_RESPOSTA_CANDIDATO" = v_etapa_em,
      "CO_USUARIO_RESPOSTA_CANDIDATO" = v_uid,
      "NU_REVISAO" = "NU_REVISAO" + 1,
      "DT_ATUALIZACAO" = now(),
      "CO_USUARIO_ATUALIZACAO" = v_uid
    where "CO_RECURSO_CANDIDATO" = v_rec."CO_RECURSO_CANDIDATO";
    insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
    values (v_rec."CO_RECURSO_CANDIDATO", 'etapa', 'resposta_candidato', 'N', 'S', v_uid);
  end if;

  return json_build_object('id', p_resposta_id, 'estado', v_novo, 'revisao', v_revisao, 'resposta_candidato_em', v_etapa_em);
end;
$function$;
comment on function public.transicionar_resposta_recurso(uuid, text, integer, text) is
  'Transição da resposta: enviar_revisao, reabrir (com comentário) e marcar_enviada (só com o recurso decidido; marca também a etapa resposta_candidato) por quem edita; aprovar e devolver (com comentário) só com o parecer jurídico (recursos_parecer). Em revisão (ou depois de passar por ela), quem escreveu ou enviou não aprova; aprovar exige o recurso decidido com a situação do modelo. Revisão → 40001. Exige recursos >= editor, a área e a coordenação do edital.';

-- 11. Modelos iniciais: "Parcialmente indeferido" → "Deferido parcialmente" -----------------
-- Título: só se ainda for o semeado (qualquer versão). Corpo: só a versão 1 ainda vigente
-- (ninguém editou) — a resposta já escrita guarda o próprio texto e não muda.
update public."TB_MODELO_RESPOSTA_RECURSO" t
   set "NO_MODELO" = v.novo
  from (values
    ('6f1d8a52-3b0e-4c11-9a51-000000000103'::uuid, 'Parcialmente indeferido — Análise curricular', 'Deferido parcialmente — Análise curricular'),
    ('6f1d8a52-3b0e-4c11-9a51-000000000203'::uuid, 'Parcialmente indeferido — Entrevista', 'Deferido parcialmente — Entrevista')
  ) as v(id, original, novo)
 where t."CO_MODELO_RESPOSTA" = v.id
   and t."NO_MODELO" = v.original;

update public."TB_MODELO_RESPOSTA_RECURSO" t
   set "DS_CORPO" = replace(t."DS_CORPO",
         'comunica que o recurso foi PARCIALMENTE INDEFERIDO:',
         'comunica que o recurso foi DEFERIDO PARCIALMENTE:')
 where t."CO_MODELO_RESPOSTA" in ('6f1d8a52-3b0e-4c11-9a51-000000000103', '6f1d8a52-3b0e-4c11-9a51-000000000203')
   and t."NU_VERSAO" = 1
   and t."ST_VIGENTE" = 'S'
   and position('comunica que o recurso foi PARCIALMENTE INDEFERIDO:' in t."DS_CORPO") > 0;

-- ═══ CORPO DA MIGRATION (fim) ═══

-- ═══════════════════════════════════════════════════════════════════════════
-- ENSAIO (tudo abaixo corre na mesma transação e é desfeito no rollback final)
-- ═══════════════════════════════════════════════════════════════════════════

-- E1. Dados de antes: EM_ANALISE virou REGISTRADO; decididos continuam, com parecer.
do $$
declare
  v_antes_em_analise bigint := coalesce((select n from pg_temp.ensaio_antes where situacao = 'EM_ANALISE'), 0);
  v_antes_decididos bigint := coalesce((select sum(n) from pg_temp.ensaio_antes where situacao <> 'EM_ANALISE'), 0);
begin
  if (select count(*) from public."TB_RECURSO_CANDIDATO" where "TP_SITUACAO" = 'REGISTRADO') <> v_antes_em_analise then
    raise exception 'FALHOU E1: REGISTRADO não bate com o EM_ANALISE de antes';
  end if;
  if (select count(*) from public."TB_RECURSO_CANDIDATO" where "TP_SITUACAO" in ('DEFERIDO', 'INDEFERIDO', 'PARCIALMENTE_INDEFERIDO')) <> v_antes_decididos then
    raise exception 'FALHOU E1: decididos mudaram';
  end if;
  if exists (select 1 from public."TB_RECURSO_CANDIDATO" where "TP_SITUACAO" = 'EM_ANALISE') then
    raise exception 'FALHOU E1: sobrou EM_ANALISE';
  end if;
  if exists (select 1 from public."TB_RECURSO_CANDIDATO"
              where "TP_SITUACAO" in ('DEFERIDO', 'INDEFERIDO', 'PARCIALMENTE_INDEFERIDO')
                and ("DS_PARECER_JURIDICO" is null or "CO_USUARIO_DECISAO" is null)) then
    raise exception 'FALHOU E1: decidido sem parecer ou sem autor';
  end if;
  raise notice 'ok E1: % registrados e % decididos preservados', v_antes_em_analise, v_antes_decididos;
end;
$$;

-- E2. Catálogo de permissões e o grupo Jurídico.
do $$
begin
  if not ('recursos_parecer' = any (private."FC_RECURSOS_MODULO"())) then
    raise exception 'FALHOU E2: recursos_parecer fora da lista de módulos';
  end if;
  if private."FC_NIVEL_DO_GRUPO"('juridico', 'recursos_parecer') <> 'editor'
     or private."FC_NIVEL_DO_GRUPO"('juridico', 'recursos') <> 'editor'
     or private."FC_NIVEL_DO_GRUPO"('admin', 'recursos_parecer') <> 'editor'
     or private."FC_NIVEL_DO_GRUPO"('edital_gestor', 'recursos_parecer') <> 'sem_acesso' then
    raise exception 'FALHOU E2: semente dos grupos';
  end if;
  begin
    update public."TA_GRUPO_ACESSO_RECURSO" set "TP_NIVEL" = 'leitor'
     where "CO_GRUPO_ACESSO" = 'juridico' and "NO_RECURSO" = 'recursos_parecer';
    raise exception 'FALHOU E2: parecer aceitou Leitor';
  exception when check_violation then
    raise notice 'ok E2: parecer só aceita Sem acesso ou Editor';
  end;
end;
$$;

-- E3. Atores sintéticos (somem no rollback) e um edital ativo de alguma área.
do $$
declare
  v_edital uuid;
  v_area text;
begin
  select m.id, m."CO_AREA" into v_edital, v_area
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m.ativo and m."CO_AREA" is not null
   order by m.edital
   limit 1;
  if v_edital is null then raise exception 'ENSAIO: nenhum edital ativo para usar'; end if;
  perform set_config('ensaio.edital', v_edital::text, true);
  perform set_config('ensaio.area', v_area, true);

  insert into auth.users (id, instance_id, aud, role, email) values
    ('00000000-0000-4000-a000-00000000e101', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.editor@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000e102', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.juridico@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000e103', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.leitor@ensaio.invalid');
  insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo) values
    ('00000000-0000-4000-a000-00000000e101', 'ensaio.editor@ensaio.invalid', 'Ensaio Editor', 'edital_gestor', true),
    ('00000000-0000-4000-a000-00000000e102', 'ensaio.juridico@ensaio.invalid', 'Ensaio Jurídico', 'juridico', true),
    ('00000000-0000-4000-a000-00000000e103', 'ensaio.leitor@ensaio.invalid', 'Ensaio Leitor', 'usuario', true);
  insert into public."RL_PERFIL_USUARIO_AREA" ("CO_PERFIL_USUARIO", "CO_AREA")
  select u.id, v_area from public."TB_PERFIL_USUARIO" u where u.email like 'ensaio.%@ensaio.invalid';
  raise notice 'ok E3: atores criados; edital % (área %)', v_edital, v_area;
end;
$$;

-- E4. O fluxo, como cada pessoa, pelas RPCs (papel authenticated).
set local role authenticated;
do $$
declare
  c_editor constant text := '{"sub":"00000000-0000-4000-a000-00000000e101","role":"authenticated","email":"ensaio.editor@ensaio.invalid"}';
  c_juridico constant text := '{"sub":"00000000-0000-4000-a000-00000000e102","role":"authenticated","email":"ensaio.juridico@ensaio.invalid"}';
  c_leitor constant text := '{"sub":"00000000-0000-4000-a000-00000000e103","role":"authenticated","email":"ensaio.leitor@ensaio.invalid"}';
  v json;
  v_id uuid;
  v_rev integer;
  v_area text;
begin
  -- Editor: não decide; cadastra (nasce REGISTRADO) e envia para parecer.
  perform set_config('request.jwt.claims', c_editor, true);
  v_area := current_setting('ensaio.area');
  if (public.get_recursos_da_area(v_area)->>'pode_decidir')::boolean then
    raise exception 'FALHOU E4: editor com pode_decidir';
  end if;
  begin
    perform public.salvar_recurso_candidato(jsonb_build_object(
      'edital_id', current_setting('ensaio.edital'), 'origem', 'analise-curricular',
      'fora_analise', true, 'nome_informado', 'Candidato Ensaio Decidido', 'situacao', 'DEFERIDO'));
    raise exception 'FALHOU E4: cadastro já decidido';
  exception when invalid_parameter_value then null;
  end;
  v := public.salvar_recurso_candidato(jsonb_build_object(
    'edital_id', current_setting('ensaio.edital'), 'origem', 'analise-curricular',
    'fora_analise', true, 'nome_informado', 'Candidato Ensaio Parecer', 'permitir_duplicado', true));
  v_id := (v->>'id')::uuid;
  v_rev := (v->>'revisao')::integer;
  begin
    perform public.transicionar_recurso_candidato(v_id, 'deferir', v_rev, 'Parecer escrito por quem não pode.');
    raise exception 'FALHOU E4: editor deferiu';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.salvar_recurso_candidato(jsonb_build_object('id', v_id, 'revisao', v_rev, 'situacao', 'DEFERIDO'));
    raise exception 'FALHOU E4: editor decidiu pelo salvar';
  exception when invalid_parameter_value then null;
  end;
  v := public.transicionar_recurso_candidato(v_id, 'enviar_parecer', v_rev, null);
  if v->>'situacao' <> 'EM_ANALISE_JURIDICA' then raise exception 'FALHOU E4: envio'; end if;
  v_rev := (v->>'revisao')::integer;
  begin
    perform public.marcar_etapa_recurso(v_id, 'resposta_candidato', true);
    raise exception 'FALHOU E4: resposta enviada sem decisão';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'ok E4.1: editor cadastra e envia; não decide (42501) nem marca resposta enviada sem decisão (22023)';

  -- Leitor: não mexe no fluxo.
  perform set_config('request.jwt.claims', c_leitor, true);
  begin
    perform public.transicionar_recurso_candidato(v_id, 'devolver', v_rev, 'Leitor tentando');
    raise exception 'FALHOU E4: leitor devolveu';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok E4.2: leitor não mexe no fluxo (42501)';

  -- Jurídico: parecer obrigatório, revisão e estado conferidos; devolve com comentário.
  perform set_config('request.jwt.claims', c_juridico, true);
  if not (public.get_recursos_da_area(v_area)->>'pode_decidir')::boolean then
    raise exception 'FALHOU E4: jurídico sem pode_decidir';
  end if;
  begin
    perform public.transicionar_recurso_candidato(v_id, 'deferir', v_rev, 'curto');
    raise exception 'FALHOU E4: deferiu sem parecer';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.transicionar_recurso_candidato(v_id, 'deferir', v_rev - 1, 'Parecer com revisão velha.');
    raise exception 'FALHOU E4: revisão velha passou';
  exception when serialization_failure then null;
  end;
  v := public.transicionar_recurso_candidato(v_id, 'devolver', v_rev, 'Falta o processo SEI');
  if v->>'situacao' <> 'REGISTRADO' then raise exception 'FALHOU E4: devolução'; end if;
  v_rev := (v->>'revisao')::integer;
  if public.get_recurso_candidato_detalhe(v_id)->>'comentario_devolucao' is distinct from 'Falta o processo SEI' then
    raise exception 'FALHOU E4: comentário da devolução';
  end if;
  begin
    perform public.transicionar_recurso_candidato(v_id, 'deferir', v_rev, 'Decidir registrado não pode.');
    raise exception 'FALHOU E4: decidiu recurso registrado';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'ok E4.3: jurídico exige parecer, revisão e estado; devolve com comentário';

  -- Editor reenvia; jurídico defere com parecer.
  perform set_config('request.jwt.claims', c_editor, true);
  v := public.transicionar_recurso_candidato(v_id, 'enviar_parecer', v_rev, 'Processo SEI juntado');
  v_rev := (v->>'revisao')::integer;
  if public.get_recurso_candidato_detalhe(v_id)->>'comentario_devolucao' is not null then
    raise exception 'FALHOU E4: devolução não saiu ao reenviar';
  end if;
  perform set_config('request.jwt.claims', c_juridico, true);
  v := public.transicionar_recurso_candidato(v_id, 'deferir', v_rev, 'Defiro: a documentação comprova a experiência exigida.');
  if v->>'situacao' <> 'DEFERIDO' then raise exception 'FALHOU E4: deferimento'; end if;
  v_rev := (v->>'revisao')::integer;
  v := public.get_recurso_candidato_detalhe(v_id);
  if v->>'decisao_por' is distinct from 'Ensaio Jurídico' or v->>'parecer' not like 'Defiro:%' then
    raise exception 'FALHOU E4: quem decidiu / parecer';
  end if;

  -- Editor não exclui decidido; jurídico reabre.
  perform set_config('request.jwt.claims', c_editor, true);
  begin
    perform public.excluir_recurso_candidato(v_id, 'Tentando apagar a decisão');
    raise exception 'FALHOU E4: editor excluiu decidido';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', c_juridico, true);
  v := public.transicionar_recurso_candidato(v_id, 'reabrir', v_rev, 'Erro material no parecer');
  if v->>'situacao' <> 'EM_ANALISE_JURIDICA' then raise exception 'FALHOU E4: reabertura'; end if;
  v_rev := (v->>'revisao')::integer;
  raise notice 'ok E4.4: decisão grava quem, quando e parecer; editor não exclui decidido; jurídico reabre';

  -- Jurídico indefere; o editor (sem o parecer) marca a resposta enviada; daí a decisão não reabre.
  v := public.transicionar_recurso_candidato(v_id, 'indeferir', v_rev, 'Indefiro: o recurso foi interposto fora do prazo.');
  v_rev := (v->>'revisao')::integer;
  perform set_config('request.jwt.claims', c_editor, true);
  v := public.marcar_etapa_recurso(v_id, 'resposta_candidato', true);
  if not (v->>'alterou')::boolean then raise exception 'FALHOU E4: editor não marcou a resposta enviada'; end if;
  v_rev := (v->>'revisao')::integer;
  perform set_config('request.jwt.claims', c_juridico, true);
  begin
    perform public.transicionar_recurso_candidato(v_id, 'reabrir', v_rev, 'Tentando reabrir depois do envio');
    raise exception 'FALHOU E4: reabriu com a resposta enviada';
  exception when invalid_parameter_value then null;
  end;

  perform set_config('ensaio.recurso', v_id::text, true);
  raise notice 'ok E4.5: com o recurso decidido, quem edita marca a resposta enviada; a decisão não reabre mais';
end;
$$;
reset role;

-- E5. Gatilho: nem uma gravação direta decide sem o parecer jurídico.
do $$
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000e101","role":"authenticated","email":"ensaio.editor@ensaio.invalid"}', true);
  begin
    update public."TB_RECURSO_CANDIDATO"
       set "TP_SITUACAO" = 'DEFERIDO', "DT_DECISAO" = now(),
           "CO_USUARIO_DECISAO" = '00000000-0000-4000-a000-00000000e101', "DS_PARECER_JURIDICO" = 'Direto na tabela.'
     where "CO_RECURSO_CANDIDATO" = current_setting('ensaio.recurso')::uuid;
    raise exception 'FALHOU E5: gatilho deixou decidir';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from public."TH_RECURSO_CANDIDATO"
       where "CO_RECURSO_CANDIDATO" = current_setting('ensaio.recurso')::uuid and "TP_ACAO" = 'parecer') <> 6 then
    raise exception 'FALHOU E5: histórico do parecer não tem as 6 transições';
  end if;
  raise notice 'ok E5: gatilho barra a decisão direta (42501); histórico com as 6 transições';
end;
$$;

-- E6. Modelos iniciais: o título semeado virou "Deferido parcialmente"; o código ficou.
do $$
begin
  if exists (select 1 from public."TB_MODELO_RESPOSTA_RECURSO"
              where "CO_MODELO_RESPOSTA" in ('6f1d8a52-3b0e-4c11-9a51-000000000103', '6f1d8a52-3b0e-4c11-9a51-000000000203')
                and "NO_MODELO" like 'Parcialmente indeferido — %') then
    raise exception 'FALHOU E6: título semeado não foi renomeado';
  end if;
  if exists (select 1 from public."TB_MODELO_RESPOSTA_RECURSO"
              where "CO_MODELO_RESPOSTA" in ('6f1d8a52-3b0e-4c11-9a51-000000000103', '6f1d8a52-3b0e-4c11-9a51-000000000203')
                and "TP_SITUACAO" <> 'PARCIALMENTE_INDEFERIDO') then
    raise exception 'FALHOU E6: o código da situação mudou';
  end if;
  raise notice 'ok E6: modelos iniciais com o título novo; código PARCIALMENTE_INDEFERIDO mantido';
  raise notice 'ENSAIO OK — nada foi gravado (rollback a seguir)';
end;
$$;

rollback;
