/*
  RECURSOS DOS CANDIDATOS VIRAM ABA NATIVA

  O acompanhamento de recursos era um painel externo (Apps Script sobre uma
  planilha, em beta). Passa a ser a aba "Recursos" de cada área, com os dados
  no banco. Não há migração de dados: a aba começa vazia.

  O QUE ENTRA
    - public."TB_ORIGEM_RECURSO": domínio das origens do recurso (análise
      curricular, entrevista, resultado final e, inativa por enquanto,
      avaliação de conhecimentos). Origem nova = uma linha.
    - public."TB_RECURSO_CANDIDATO": um recurso de um candidato contra uma
      etapa de um edital (TB_MONITORAMENTO_INDIGENA). O candidato é a linha da
      análise curricular do edital (FK para TB_ANALISE_CURRICULAR): nome,
      código, cargo, vaga, nota e resultado vêm de lá, sem cópia. Só quando o
      candidato não está nas análises ("fora das análises") os dados digitados
      ficam no recurso. A nota e o resultado da análise no dia do cadastro
      ficam guardados ("VL_NOTA_ANTERIOR", "DS_RESULTADO_ANTERIOR"): é o que
      permite dizer, depois, se a nota mudou. A área é a do edital (sem
      coluna própria).
      As etapas (documentação baixada da Empregare, processo SEI criado,
      documentação juntada no SEI, resposta enviada) guardam quando e quem.
    - public."TH_RECURSO_CANDIDATO": histórico de cada criação, edição, etapa
      e exclusão (auditoria; o detalhe do recurso mostra).
    - Permissão: novo recurso 'recursos' em TB_PERMISSAO_RECURSO. Padrão:
      admin = admin, edital_gestor = editor, usuario e contratador = leitor.
      A matriz de acessos passa a mostrá-lo. Além do nível, a pessoa precisa
      ter a área do edital (private."FC_PODE_AREA"), como nas análises.
    - RPCs (todas SECURITY DEFINER, search_path vazio):
        get_recursos_da_area(p_area)                 leitura da aba (json)
        get_recurso_candidato_detalhe(p_id)          detalhe + histórico
        buscar_candidatos_recurso(p_edital_id, p_busca)  candidatos das análises do edital
        salvar_recurso_candidato(p_dados)            cria e edita
        marcar_etapa_recurso(p_id, p_etapa, p_feita) marca/desmarca uma etapa
        excluir_recurso_candidato(p_id, p_motivo)    exclusão lógica
      Leitura exige 'recursos' >= leitor; escrita, >= editor. As tabelas não
      têm policy nem grant: só as funções leem e escrevem.
    - Catálogo de abas: 'recursos' em TB_ABA e nas três áreas (RL_ABA_AREA),
      espelho de ABAS_DO_MENU (src/lib/menu-lateral.js).

  O QUE NÃO MUDA
    O painel externo "Recursos" (TB_PAINEL_EXTERNO) continua como está; sai
    depois da aprovação da aba nova.

  PRAZO
    O prazo de resposta vem do cronograma do edital
    (TB_CRONOGRAMA_MONIT_INDIG), cujas atividades são texto livre. A leitura
    devolve as etapas dos editais que têm recurso; quem classifica é o front
    (src/lib/prazo-do-recurso.js, com teste), sem cópia do prazo no banco.

  Rollback: supabase/rollback/20260929120000_recursos.sql
*/
begin;

-- 1. Permissão: recurso 'recursos' ------------------------------------------------
alter table public."TB_PERMISSAO_RECURSO" drop constraint "TB_PERMISSAO_RECURSO_recurso_check";
alter table public."TB_PERMISSAO_RECURSO" add constraint "TB_PERMISSAO_RECURSO_recurso_check"
  check (recurso in ('dashboard','analises','nucleo','calendario','aprovados','recursos','importacao','paineis','configuracoes') or recurso ~ '^painel:[0-9a-f-]{36}$');

create or replace function private.nivel_padrao_recurso(p_perfil text, p_recurso text)
 returns text
 language sql
 immutable
 set search_path to ''
as $function$
  select case
    when p_perfil not in ('usuario','edital_gestor','contratador','admin') then 'sem_acesso'
    when p_recurso like 'painel:%' then 'leitor'
    when p_recurso not in ('dashboard','analises','nucleo','calendario','aprovados','recursos','importacao','paineis','configuracoes') then 'sem_acesso'
    when p_perfil='admin' then 'admin'
    when p_recurso='configuracoes' then 'sem_acesso'
    when p_recurso='importacao' then case when p_perfil in ('edital_gestor','contratador') then 'editor' else 'sem_acesso' end
    when p_recurso in ('nucleo','calendario') and p_perfil in ('edital_gestor','contratador') then 'editor'
    when p_recurso='aprovados' and p_perfil='contratador' then 'editor'
    when p_recurso='recursos' and p_perfil='edital_gestor' then 'editor'
    else 'leitor' end;
$function$;

create or replace function public.obter_contexto_monitora()
 returns jsonb
 language sql
 stable
 set search_path to ''
as $function$
select jsonb_build_object('profile',to_jsonb(p)||jsonb_build_object('permissoes',
  (select jsonb_object_agg(m,private.nivel_recurso(m)) from unnest(array['dashboard','analises','nucleo','calendario','aprovados','recursos','importacao','paineis','configuracoes']) m),
  'areas', to_jsonb(private."FC_AREAS_USUARIO"())),
  'panel_ids',coalesce((select jsonb_agg(e.id::text) from public."TB_PAINEL_EXTERNO" e
    where e.ativo and private.pode_recurso('paineis') and private.pode_recurso('painel:'||e.id)),'[]'::jsonb))
from private.current_profile() p where p.id is not null and p.ativo;
$function$;

create or replace function public.obter_matriz_acessos(p_busca text default ''::text, p_offset integer default 0)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare resultado jsonb;
begin
  if not private.is_master() then raise exception 'Somente administradores podem gerenciar acessos' using errcode='42501'; end if;
  with usuarios as (
    select u.id,u.user_id,u.email,u.nome,u.perfil,u.ativo from public."TB_PERFIL_USUARIO" u
    where u.ativo and (coalesce(u.nome,'') ilike '%'||left(p_busca,100)||'%' or u.email ilike '%'||left(p_busca,100)||'%')
    order by lower(u.email),u.id limit 30 offset greatest(p_offset,0)
  ), recursos as (
    select m recurso from unnest(array['dashboard','analises','nucleo','calendario','aprovados','recursos','importacao','paineis','configuracoes']) m
    union all select 'painel:'||id from public."TB_PAINEL_EXTERNO" where ativo
    union all select 'area:'||a."CO_AREA" from public."TB_AREA" a
  )
  select jsonb_build_object('usuarios',coalesce((select jsonb_agg(to_jsonb(u)||jsonb_build_object('permissoes',
    (select jsonb_object_agg(r.recurso,jsonb_build_object('nivel',case when r.recurso like 'area:%' then case when exists(select 1 from public."RL_PERFIL_USUARIO_AREA" x where x."CO_PERFIL_USUARIO"=u.id and 'area:'||x."CO_AREA"=r.recurso) then 'leitor' else 'sem_acesso' end else coalesce(g.nivel,case when r.recurso like 'painel:%' then 'sem_acesso' else private.nivel_padrao_recurso(u.perfil,r.recurso) end) end,'revisao',coalesce(g.revisao,0)))
    from recursos r left join public."TB_PERMISSAO_RECURSO" g on g.perfil_usuario_id=u.id and g.recurso=r.recurso))) from usuarios u),'[]'::jsonb),
    'total',(select count(*) from public."TB_PERFIL_USUARIO" u where u.ativo and (coalesce(u.nome,'') ilike '%'||left(p_busca,100)||'%' or u.email ilike '%'||left(p_busca,100)||'%')),
    'areas',coalesce((select jsonb_agg(jsonb_build_object('id',a."CO_AREA",'titulo',a."NO_AREA") order by a."NU_ORDEM") from public."TB_AREA" a),'[]'::jsonb),
    'paineis',coalesce((select jsonb_agg(jsonb_build_object('id',id,'titulo',titulo) order by ordem,titulo) from public."TB_PAINEL_EXTERNO" where ativo),'[]'::jsonb),
    'historico',coalesce((select jsonb_agg(to_jsonb(h)) from (
      select h.*,u.email,autor.email autor from public."TH_PERMISSAO_RECURSO" h
      left join public."TB_PERFIL_USUARIO" u on u.id=h.perfil_usuario_id
      left join lateral (select a.email from public."TB_PERFIL_USUARIO" a where a.user_id=h.alterado_por order by a.updated_at desc limit 1) autor on true
      order by h.alterado_em desc,h.id desc limit 50) h),'[]'::jsonb)) into resultado;
  return resultado;
end;
$function$;

create or replace function public.salvar_matriz_acessos(p_alteracoes jsonb, p_motivo text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare item jsonb; alvo public."TB_PERFIL_USUARIO"; anterior text; revisao_atual integer; recurso_atual text; novo text; quantidade integer:=0;
begin
  if not private.is_master() then raise exception 'Somente administradores podem gerenciar acessos' using errcode='42501'; end if;
  if jsonb_typeof(p_alteracoes) is distinct from 'array' or jsonb_array_length(p_alteracoes) not between 1 and 500 then raise exception 'Alterações inválidas'; end if;
  if length(btrim(coalesce(p_motivo,''))) not between 3 and 500 then raise exception 'Informe um motivo entre 3 e 500 caracteres'; end if;
  -- Serializes absent-row inserts as well as updates. Revision checks avoid lost updates.
  perform pg_advisory_xact_lock(73923124153);
  for item in select value from jsonb_array_elements(p_alteracoes) loop
    select * into alvo from public."TB_PERFIL_USUARIO" where id=(item->>'usuario_id')::uuid and ativo for update;
    if alvo.id is null then raise exception 'Usuário ativo não encontrado'; end if;
    if alvo.user_id=(select auth.uid()) or lower(alvo.email)=lower(coalesce((select auth.jwt()->>'email'),'')) then raise exception 'Outro administrador deve alterar seu acesso'; end if;
    recurso_atual:=item->>'recurso'; novo:=item->>'nivel';
    if recurso_atual like 'area:%' then
      if not exists(select 1 from public."TB_AREA" a where 'area:'||a."CO_AREA"=recurso_atual) then raise exception 'Área inválida'; end if;
      if novo is null or novo not in ('sem_acesso','leitor') then raise exception 'Área aceita apenas Sim ou Não'; end if;
      if lower(coalesce(alvo.perfil,''))='admin' then raise exception 'Administrador já vê todas as áreas'; end if;
      anterior:=case when exists(select 1 from public."RL_PERFIL_USUARIO_AREA" x where x."CO_PERFIL_USUARIO"=alvo.id and 'area:'||x."CO_AREA"=recurso_atual) then 'leitor' else 'sem_acesso' end;
      if anterior=novo then continue; end if;
      if novo='leitor' then
        insert into public."RL_PERFIL_USUARIO_AREA"("CO_PERFIL_USUARIO","CO_AREA") values(alvo.id,substr(recurso_atual,6));
      else
        delete from public."RL_PERFIL_USUARIO_AREA" where "CO_PERFIL_USUARIO"=alvo.id and "CO_AREA"=substr(recurso_atual,6);
      end if;
      insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id,recurso,nivel_anterior,nivel_novo,alterado_por,motivo)
      values(alvo.id,recurso_atual,anterior,novo,(select auth.uid()),btrim(p_motivo));
      quantidade:=quantidade+1;
      continue;
    end if;
    if recurso_atual is null or (recurso_atual not in ('dashboard','analises','nucleo','calendario','aprovados','recursos','importacao','paineis','configuracoes') and not exists(select 1 from public."TB_PAINEL_EXTERNO" where 'painel:'||id=recurso_atual and ativo)) then raise exception 'Recurso inválido'; end if;
    if novo is null or novo not in ('sem_acesso','leitor','editor','admin') then raise exception 'Nível inválido'; end if;
    if recurso_atual='configuracoes' and novo='leitor' then raise exception 'Configurações exige Editor ou Administrador'; end if;
    if recurso_atual like 'painel:%' and novo not in ('sem_acesso','leitor') then raise exception 'Painel externo permite apenas acesso de leitura no portal'; end if;
    select nivel,revisao into anterior,revisao_atual from public."TB_PERMISSAO_RECURSO" where perfil_usuario_id=alvo.id and recurso=recurso_atual;
    if item->>'revisao' is null or coalesce(revisao_atual,0)<>(item->>'revisao')::integer then raise exception 'Permissão alterada por outro administrador. Recarregue a matriz.' using errcode='40001'; end if;
    anterior:=coalesce(anterior,case when recurso_atual like 'painel:%' then 'sem_acesso' else private.nivel_padrao_recurso(alvo.perfil,recurso_atual) end);
    if anterior=novo then continue; end if;
    insert into public."TB_PERMISSAO_RECURSO" (perfil_usuario_id,recurso,nivel,updated_by) values(alvo.id,recurso_atual,novo,(select auth.uid()))
    on conflict(perfil_usuario_id,recurso) do update set nivel=excluded.nivel,revisao="TB_PERMISSAO_RECURSO".revisao+1,updated_at=now(),updated_by=excluded.updated_by;
    insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id,recurso,nivel_anterior,nivel_novo,alterado_por,motivo)
    values(alvo.id,recurso_atual,anterior,novo,(select auth.uid()),btrim(p_motivo));
    quantidade:=quantidade+1;
  end loop;
  return jsonb_build_object('alteradas',quantidade);
end;
$function$;

-- 2. Origem do recurso (domínio) ---------------------------------------------------
create table public."TB_ORIGEM_RECURSO" (
  "CO_ORIGEM_RECURSO" text not null,
  "NO_ORIGEM_RECURSO" text not null,
  "NU_ORDEM" smallint not null,
  "ST_ATIVO" varchar(1) not null default 'S',
  constraint "PK_TB_ORIGEM_RECURSO" primary key ("CO_ORIGEM_RECURSO"),
  constraint "CK_ORIGEMRECURSO_COORIGEM" check ("CO_ORIGEM_RECURSO" ~ '^[a-z]+(-[a-z]+)*$'),
  constraint "CK_ORIGEMRECURSO_STATIVO" check ("ST_ATIVO" in ('S', 'N'))
);
comment on table public."TB_ORIGEM_RECURSO" is
  'Domínio das origens de recurso (a etapa do processo seletivo contra a qual o candidato recorre).';
comment on column public."TB_ORIGEM_RECURSO"."CO_ORIGEM_RECURSO" is 'Código da origem (analise-curricular, entrevista, resultado-final, avaliacao-conhecimentos). O classificador de prazo do front usa os mesmos códigos.';
comment on column public."TB_ORIGEM_RECURSO"."NO_ORIGEM_RECURSO" is 'Rótulo da origem na tela.';
comment on column public."TB_ORIGEM_RECURSO"."NU_ORDEM" is 'Ordem na lista de origens.';
comment on column public."TB_ORIGEM_RECURSO"."ST_ATIVO" is 'S: pode ser escolhida em recurso novo; N: só aparece nos recursos que já a usam.';
comment on constraint "CK_ORIGEMRECURSO_COORIGEM" on public."TB_ORIGEM_RECURSO" is 'Código em minúsculas, palavras separadas por hífen.';
comment on constraint "CK_ORIGEMRECURSO_STATIVO" on public."TB_ORIGEM_RECURSO" is 'Flag S/N.';

insert into public."TB_ORIGEM_RECURSO" ("CO_ORIGEM_RECURSO", "NO_ORIGEM_RECURSO", "NU_ORDEM", "ST_ATIVO") values
  ('analise-curricular', 'Análise curricular', 1, 'S'),
  ('entrevista', 'Entrevista', 2, 'S'),
  ('resultado-final', 'Resultado final', 3, 'S'),
  ('avaliacao-conhecimentos', 'Avaliação de conhecimentos', 4, 'N');

-- 3. Recurso do candidato ----------------------------------------------------------
create table public."TB_RECURSO_CANDIDATO" (
  "CO_RECURSO_CANDIDATO" uuid not null default gen_random_uuid(),
  "NU_RECURSO" bigint generated always as identity,
  "CO_MONITORAMENTO" uuid not null,
  "CO_ORIGEM_RECURSO" text not null,
  "CO_ANALISE_CURRICULAR" uuid,
  "ST_FORA_ANALISE" varchar(1) not null default 'N',
  "NO_CANDIDATO_INFORMADO" text,
  "CO_CANDIDATO_INFORMADO" text,
  "NO_CARGO_INFORMADO" text,
  "CO_VAGA_INFORMADA" text,
  "VL_NOTA_ANTERIOR" numeric,
  "DS_RESULTADO_ANTERIOR" text,
  "NO_ANALISTA" text,
  "TP_SITUACAO" text not null default 'EM_ANALISE',
  "NU_PROCESSO_SEI" text,
  "ST_MUDOU_CLASSIFICACAO" varchar(1) not null default 'N',
  "DS_OBSERVACAO" text,
  "DT_DOWNLOAD_EMPREGARE" timestamptz,
  "CO_USUARIO_DOWNLOAD_EMPREGARE" uuid,
  "DT_PROCESSO_SEI" timestamptz,
  "CO_USUARIO_PROCESSO_SEI" uuid,
  "DT_UPLOAD_SEI" timestamptz,
  "CO_USUARIO_UPLOAD_SEI" uuid,
  "DT_RESPOSTA_CANDIDATO" timestamptz,
  "CO_USUARIO_RESPOSTA_CANDIDATO" uuid,
  "DT_DECISAO" timestamptz,
  "CO_USUARIO_DECISAO" uuid,
  "ST_ATIVO" varchar(1) not null default 'S',
  "NU_REVISAO" integer not null default 1,
  "DT_CRIACAO" timestamptz not null default now(),
  "CO_USUARIO_CRIACAO" uuid not null,
  "DT_ATUALIZACAO" timestamptz not null default now(),
  "CO_USUARIO_ATUALIZACAO" uuid not null,
  constraint "PK_TB_RECURSO_CANDIDATO" primary key ("CO_RECURSO_CANDIDATO"),
  constraint "UK_RECURSOCANDIDATO_NURECURSO" unique ("NU_RECURSO"),
  constraint "FK_MONITORAMENTO_RECURSOCANDIDATO" foreign key ("CO_MONITORAMENTO") references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "FK_ORIGEMRECURSO_RECURSOCANDIDATO" foreign key ("CO_ORIGEM_RECURSO") references public."TB_ORIGEM_RECURSO" ("CO_ORIGEM_RECURSO"),
  constraint "FK_ANALISECURRICULAR_RECURSOCANDIDATO" foreign key ("CO_ANALISE_CURRICULAR") references public."TB_ANALISE_CURRICULAR" (id),
  constraint "CK_RECURSOCANDIDATO_TPSITUACAO" check ("TP_SITUACAO" in ('EM_ANALISE', 'DEFERIDO', 'INDEFERIDO', 'PARCIALMENTE_INDEFERIDO')),
  constraint "CK_RECURSOCANDIDATO_STFORAANALISE" check ("ST_FORA_ANALISE" in ('S', 'N')),
  constraint "CK_RECURSOCANDIDATO_STMUDOUCLASSIFICACAO" check ("ST_MUDOU_CLASSIFICACAO" in ('S', 'N')),
  constraint "CK_RECURSOCANDIDATO_STATIVO" check ("ST_ATIVO" in ('S', 'N')),
  constraint "CK_RECURSOCANDIDATO_CANDIDATO" check (
    ("ST_FORA_ANALISE" = 'N' and "CO_ANALISE_CURRICULAR" is not null
      and "NO_CANDIDATO_INFORMADO" is null and "CO_CANDIDATO_INFORMADO" is null
      and "NO_CARGO_INFORMADO" is null and "CO_VAGA_INFORMADA" is null)
    or ("ST_FORA_ANALISE" = 'S' and "CO_ANALISE_CURRICULAR" is null
      and length(btrim("NO_CANDIDATO_INFORMADO")) between 3 and 200)
  ),
  constraint "CK_RECURSOCANDIDATO_ETAPAS" check (
    ("DT_DOWNLOAD_EMPREGARE" is null) = ("CO_USUARIO_DOWNLOAD_EMPREGARE" is null)
    and ("DT_PROCESSO_SEI" is null) = ("CO_USUARIO_PROCESSO_SEI" is null)
    and ("DT_UPLOAD_SEI" is null) = ("CO_USUARIO_UPLOAD_SEI" is null)
    and ("DT_RESPOSTA_CANDIDATO" is null) = ("CO_USUARIO_RESPOSTA_CANDIDATO" is null)
  ),
  constraint "CK_RECURSOCANDIDATO_DECISAO" check (
    ("TP_SITUACAO" = 'EM_ANALISE') = ("DT_DECISAO" is null)
    and ("DT_DECISAO" is null) = ("CO_USUARIO_DECISAO" is null)
  ),
  constraint "CK_RECURSOCANDIDATO_TAMANHOS" check (
    coalesce(length("CO_CANDIDATO_INFORMADO"), 0) <= 60
    and coalesce(length("NO_CARGO_INFORMADO"), 0) <= 200
    and coalesce(length("CO_VAGA_INFORMADA"), 0) <= 60
    and coalesce(length("NO_ANALISTA"), 0) <= 200
    and coalesce(length("NU_PROCESSO_SEI"), 0) <= 60
    and coalesce(length("DS_OBSERVACAO"), 0) <= 2000
  )
);
comment on table public."TB_RECURSO_CANDIDATO" is
  'Recurso de um candidato contra uma etapa de um edital (aba Recursos). Candidato, cargo, vaga, nota e resultado vêm da análise curricular ligada; os campos *_INFORMADO só existem quando o candidato está fora das análises. A área é a do edital.';
comment on column public."TB_RECURSO_CANDIDATO"."CO_RECURSO_CANDIDATO" is 'Identificador do recurso.';
comment on column public."TB_RECURSO_CANDIDATO"."NU_RECURSO" is 'Número sequencial do recurso, para citar na conversa (nº 12).';
comment on column public."TB_RECURSO_CANDIDATO"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id). Define a área do recurso ("CO_AREA" do edital).';
comment on column public."TB_RECURSO_CANDIDATO"."CO_ORIGEM_RECURSO" is 'Etapa contra a qual o candidato recorre (TB_ORIGEM_RECURSO).';
comment on column public."TB_RECURSO_CANDIDATO"."CO_ANALISE_CURRICULAR" is 'Linha da análise curricular do candidato neste edital (TB_ANALISE_CURRICULAR.id). Nula só fora das análises.';
comment on column public."TB_RECURSO_CANDIDATO"."ST_FORA_ANALISE" is 'S: candidato não encontrado nas análises do edital (dados digitados em *_INFORMADO); N: ligado à análise.';
comment on column public."TB_RECURSO_CANDIDATO"."NO_CANDIDATO_INFORMADO" is 'Nome digitado (só fora das análises).';
comment on column public."TB_RECURSO_CANDIDATO"."CO_CANDIDATO_INFORMADO" is 'Código do candidato digitado (só fora das análises).';
comment on column public."TB_RECURSO_CANDIDATO"."NO_CARGO_INFORMADO" is 'Cargo digitado (só fora das análises).';
comment on column public."TB_RECURSO_CANDIDATO"."CO_VAGA_INFORMADA" is 'Código da vaga digitado (só fora das análises).';
comment on column public."TB_RECURSO_CANDIDATO"."VL_NOTA_ANTERIOR" is 'Nota final ajustada da análise no dia do cadastro. Diferente da nota atual da análise = a nota mudou.';
comment on column public."TB_RECURSO_CANDIDATO"."DS_RESULTADO_ANTERIOR" is 'Status consolidado da análise no dia do cadastro.';
comment on column public."TB_RECURSO_CANDIDATO"."NO_ANALISTA" is 'Analista responsável pelo recurso (padrão: o responsável pela análise).';
comment on column public."TB_RECURSO_CANDIDATO"."TP_SITUACAO" is 'EM_ANALISE, DEFERIDO, INDEFERIDO ou PARCIALMENTE_INDEFERIDO.';
comment on column public."TB_RECURSO_CANDIDATO"."NU_PROCESSO_SEI" is 'Número do processo SEI do recurso.';
comment on column public."TB_RECURSO_CANDIDATO"."ST_MUDOU_CLASSIFICACAO" is 'S: o recurso mudou a classificação do candidato (marcado pelo analista).';
comment on column public."TB_RECURSO_CANDIDATO"."DS_OBSERVACAO" is 'Observação livre do analista.';
comment on column public."TB_RECURSO_CANDIDATO"."DT_DOWNLOAD_EMPREGARE" is 'Etapa: documentação baixada da Empregare (quando). Nula = pendente.';
comment on column public."TB_RECURSO_CANDIDATO"."CO_USUARIO_DOWNLOAD_EMPREGARE" is 'Etapa: documentação baixada da Empregare (quem, auth.users.id).';
comment on column public."TB_RECURSO_CANDIDATO"."DT_PROCESSO_SEI" is 'Etapa: processo SEI criado (quando). Preenchida também ao informar o número do processo.';
comment on column public."TB_RECURSO_CANDIDATO"."CO_USUARIO_PROCESSO_SEI" is 'Etapa: processo SEI criado (quem, auth.users.id).';
comment on column public."TB_RECURSO_CANDIDATO"."DT_UPLOAD_SEI" is 'Etapa: documentação juntada ao processo SEI (quando).';
comment on column public."TB_RECURSO_CANDIDATO"."CO_USUARIO_UPLOAD_SEI" is 'Etapa: documentação juntada ao processo SEI (quem, auth.users.id).';
comment on column public."TB_RECURSO_CANDIDATO"."DT_RESPOSTA_CANDIDATO" is 'Etapa: resposta enviada ao candidato (quando).';
comment on column public."TB_RECURSO_CANDIDATO"."CO_USUARIO_RESPOSTA_CANDIDATO" is 'Etapa: resposta enviada ao candidato (quem, auth.users.id).';
comment on column public."TB_RECURSO_CANDIDATO"."DT_DECISAO" is 'Quando a situação saiu de EM_ANALISE (fim dos dias em aberto). Nula em análise.';
comment on column public."TB_RECURSO_CANDIDATO"."CO_USUARIO_DECISAO" is 'Quem registrou a decisão (auth.users.id).';
comment on column public."TB_RECURSO_CANDIDATO"."ST_ATIVO" is 'S: recurso válido; N: excluído (cadastrado por engano), fica para o histórico.';
comment on column public."TB_RECURSO_CANDIDATO"."NU_REVISAO" is 'Revisão da linha: a edição só grava se a revisão enviada for a atual (sem sobrescrever o que outra pessoa salvou).';
comment on column public."TB_RECURSO_CANDIDATO"."DT_CRIACAO" is 'Quando o recurso foi cadastrado (início dos dias em aberto).';
comment on column public."TB_RECURSO_CANDIDATO"."CO_USUARIO_CRIACAO" is 'Quem cadastrou (auth.users.id).';
comment on column public."TB_RECURSO_CANDIDATO"."DT_ATUALIZACAO" is 'Última alteração.';
comment on column public."TB_RECURSO_CANDIDATO"."CO_USUARIO_ATUALIZACAO" is 'Autor da última alteração (auth.users.id).';
comment on constraint "UK_RECURSOCANDIDATO_NURECURSO" on public."TB_RECURSO_CANDIDATO" is 'Número do recurso único.';
comment on constraint "FK_MONITORAMENTO_RECURSOCANDIDATO" on public."TB_RECURSO_CANDIDATO" is 'Edital do recurso.';
comment on constraint "FK_ORIGEMRECURSO_RECURSOCANDIDATO" on public."TB_RECURSO_CANDIDATO" is 'Origem do recurso.';
comment on constraint "FK_ANALISECURRICULAR_RECURSOCANDIDATO" on public."TB_RECURSO_CANDIDATO" is 'Análise do candidato. Sem ON DELETE: a análise citada por um recurso não pode sumir (o sync só faz upsert).';
comment on constraint "CK_RECURSOCANDIDATO_TPSITUACAO" on public."TB_RECURSO_CANDIDATO" is 'Situações válidas do recurso.';
comment on constraint "CK_RECURSOCANDIDATO_STFORAANALISE" on public."TB_RECURSO_CANDIDATO" is 'Flag S/N.';
comment on constraint "CK_RECURSOCANDIDATO_STMUDOUCLASSIFICACAO" on public."TB_RECURSO_CANDIDATO" is 'Flag S/N.';
comment on constraint "CK_RECURSOCANDIDATO_STATIVO" on public."TB_RECURSO_CANDIDATO" is 'Flag S/N.';
comment on constraint "CK_RECURSOCANDIDATO_CANDIDATO" on public."TB_RECURSO_CANDIDATO" is 'Ligado à análise (sem dados digitados) ou fora das análises (com nome digitado de 3 a 200 caracteres).';
comment on constraint "CK_RECURSOCANDIDATO_ETAPAS" on public."TB_RECURSO_CANDIDATO" is 'Cada etapa guarda quando e quem juntos.';
comment on constraint "CK_RECURSOCANDIDATO_DECISAO" on public."TB_RECURSO_CANDIDATO" is 'Data e autor da decisão existem só fora de EM_ANALISE.';
comment on constraint "CK_RECURSOCANDIDATO_TAMANHOS" on public."TB_RECURSO_CANDIDATO" is 'Limites de tamanho dos textos.';

create index "IN_FKRECURSOCANDIDATO_COMONITORAMENTO" on public."TB_RECURSO_CANDIDATO" ("CO_MONITORAMENTO") where "ST_ATIVO" = 'S';
create index "IN_FKRECURSOCANDIDATO_COANALISE" on public."TB_RECURSO_CANDIDATO" ("CO_ANALISE_CURRICULAR");
create index "IN_FKRECURSOCANDIDATO_COORIGEM" on public."TB_RECURSO_CANDIDATO" ("CO_ORIGEM_RECURSO");
comment on index public."IN_FKRECURSOCANDIDATO_COMONITORAMENTO" is 'Recursos ativos por edital (leitura da aba por área).';
comment on index public."IN_FKRECURSOCANDIDATO_COANALISE" is 'Chave estrangeira para TB_ANALISE_CURRICULAR (e a busca de duplicado).';
comment on index public."IN_FKRECURSOCANDIDATO_COORIGEM" is 'Chave estrangeira para TB_ORIGEM_RECURSO.';

-- 4. Histórico ---------------------------------------------------------------------
create table public."TH_RECURSO_CANDIDATO" (
  "CO_HISTORICO_RECURSO" bigint generated always as identity,
  "CO_RECURSO_CANDIDATO" uuid not null,
  "TP_ACAO" text not null,
  "DS_CAMPO" text,
  "DS_VALOR_ANTERIOR" text,
  "DS_VALOR_NOVO" text,
  "DS_MOTIVO" text,
  "DT_ALTERACAO" timestamptz not null default now(),
  "CO_USUARIO" uuid not null,
  constraint "PK_TH_RECURSO_CANDIDATO" primary key ("CO_HISTORICO_RECURSO"),
  constraint "FK_RECURSOCANDIDATO_HISTRECURSO" foreign key ("CO_RECURSO_CANDIDATO") references public."TB_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO"),
  constraint "CK_HISTRECURSO_TPACAO" check ("TP_ACAO" in ('criacao', 'edicao', 'etapa', 'exclusao'))
);
comment on table public."TH_RECURSO_CANDIDATO" is 'Histórico (auditoria) dos recursos: criação, cada campo editado, cada etapa marcada ou desmarcada e a exclusão.';
comment on column public."TH_RECURSO_CANDIDATO"."CO_HISTORICO_RECURSO" is 'Identificador do registro de histórico.';
comment on column public."TH_RECURSO_CANDIDATO"."CO_RECURSO_CANDIDATO" is 'Recurso alterado (TB_RECURSO_CANDIDATO).';
comment on column public."TH_RECURSO_CANDIDATO"."TP_ACAO" is 'criacao, edicao, etapa ou exclusao.';
comment on column public."TH_RECURSO_CANDIDATO"."DS_CAMPO" is 'Campo editado ou etapa (download_empregare, processo_sei, upload_sei, resposta_candidato). Nulo na criação e na exclusão.';
comment on column public."TH_RECURSO_CANDIDATO"."DS_VALOR_ANTERIOR" is 'Valor antes (S/N nas etapas).';
comment on column public."TH_RECURSO_CANDIDATO"."DS_VALOR_NOVO" is 'Valor depois (S/N nas etapas).';
comment on column public."TH_RECURSO_CANDIDATO"."DS_MOTIVO" is 'Motivo informado (exclusão).';
comment on column public."TH_RECURSO_CANDIDATO"."DT_ALTERACAO" is 'Quando.';
comment on column public."TH_RECURSO_CANDIDATO"."CO_USUARIO" is 'Quem (auth.users.id).';
comment on constraint "FK_RECURSOCANDIDATO_HISTRECURSO" on public."TH_RECURSO_CANDIDATO" is 'Recurso do registro.';
comment on constraint "CK_HISTRECURSO_TPACAO" on public."TH_RECURSO_CANDIDATO" is 'Ações registradas.';
create index "IN_FKHISTRECURSO_CORECURSO" on public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "DT_ALTERACAO" desc);
comment on index public."IN_FKHISTRECURSO_CORECURSO" is 'Histórico de um recurso, do mais recente ao mais antigo.';

-- 5. Acesso: nenhuma leitura ou escrita direta; só as funções abaixo ---------------
alter table public."TB_ORIGEM_RECURSO" enable row level security;
alter table public."TB_RECURSO_CANDIDATO" enable row level security;
alter table public."TH_RECURSO_CANDIDATO" enable row level security;
revoke all on public."TB_ORIGEM_RECURSO", public."TB_RECURSO_CANDIDATO", public."TH_RECURSO_CANDIDATO" from public, anon, authenticated;

-- 6. Funções auxiliares (private, sem EXECUTE para os papéis da API) ---------------
create function private."FC_EXIGIR_RECURSOS_NA_AREA"(p_area text, p_minimo integer)
returns void
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not private.pode_recurso('recursos', p_minimo) then
    raise exception 'Sem permissão para Recursos' using errcode = '42501';
  end if;
  if not private."FC_PODE_AREA"(p_area) then
    raise exception 'Sem acesso à área deste edital' using errcode = '42501';
  end if;
end;
$function$;
comment on function private."FC_EXIGIR_RECURSOS_NA_AREA"(text, integer) is
  'Barra (42501) quem não tem o recurso de permissão recursos no nível pedido (1 leitor, 2 editor) ou não tem a área.';

create function private."FC_TEXTO_BUSCA_RECURSO"(p_texto text)
returns text
language sql
immutable
parallel safe
set search_path to ''
as $function$
  select btrim(regexp_replace(
    translate(lower(coalesce(p_texto, '')), 'áàâãäåéèêëíìîïóòôõöúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn'),
    '\s+', ' ', 'g'));
$function$;
comment on function private."FC_TEXTO_BUSCA_RECURSO"(text) is
  'Texto para comparar na busca de candidato e no duplicado: minúsculas, sem acento, espaços simples.';

create function private."FC_NOME_USUARIO"(p_usuario uuid)
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(nullif(btrim(p.nome), ''), p.email)
  from public."TB_PERFIL_USUARIO" p
  where p.user_id = p_usuario
  order by p.updated_at desc nulls last
  limit 1;
$function$;
comment on function private."FC_NOME_USUARIO"(uuid) is
  'Nome (ou e-mail) de quem tem o auth.users.id informado, para o histórico e as etapas do recurso.';

revoke all on function private."FC_EXIGIR_RECURSOS_NA_AREA"(text, integer), private."FC_TEXTO_BUSCA_RECURSO"(text), private."FC_NOME_USUARIO"(uuid) from public, anon, authenticated;

-- 7. Leitura da aba ----------------------------------------------------------------
create function public.get_recursos_da_area(p_area text)
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
             a.nota_final_ajustada, a.status_consolidado
      from public."TB_RECURSO_CANDIDATO" r
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = r."CO_MONITORAMENTO"
      left join public."TB_ANALISE_CURRICULAR" a on a.id = r."CO_ANALISE_CURRICULAR"
      where m."CO_AREA" = p_area
        and r."ST_ATIVO" = 'S'
    )
    select json_build_object(
      'schema_version', 1,
      'area', p_area,
      'pode_editar', v_pode_editar,
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
            'criado_em', r."DT_CRIACAO",
            'atualizado_em', r."DT_ATUALIZACAO",
            'revisao', r."NU_REVISAO"
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
  'Aba Recursos de uma área (json): recursos ativos com os dados do candidato vindos da análise, origens, editais da área (só para quem edita) e as etapas do cronograma dos editais com recurso (o prazo é classificado no front). Exige recursos >= leitor e a área (42501).';

create function public.get_recurso_candidato_detalhe(p_id uuid)
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
  return (
    select json_build_object(
      'id', r."CO_RECURSO_CANDIDATO",
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
      )
    )
    from public."TB_RECURSO_CANDIDATO" r
    left join public."TB_ANALISE_CURRICULAR" a on a.id = r."CO_ANALISE_CURRICULAR"
    where r."CO_RECURSO_CANDIDATO" = p_id
  );
end;
$function$;
comment on function public.get_recurso_candidato_detalhe(uuid) is
  'Detalhe de um recurso (observação, quem fez cada etapa, dados digitados) e o histórico, do mais recente ao mais antigo. Mesma permissão da leitura da aba, na área do edital.';

create function public.buscar_candidatos_recurso(p_edital_id uuid, p_busca text)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_edital text;
  v_area text;
  v_busca text := btrim(coalesce(p_busca, ''));
  v_texto text;
begin
  select m.edital, m."CO_AREA" into v_edital, v_area
  from public."TB_MONITORAMENTO_INDIGENA" m
  where m.id = p_edital_id;
  if v_area is null then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;
  perform private."FC_EXIGIR_RECURSOS_NA_AREA"(v_area, 2);
  if length(v_busca) < 2 then
    return '[]'::json;
  end if;
  v_texto := private."FC_TEXTO_BUSCA_RECURSO"(left(v_busca, 100));
  return (
    select coalesce(json_agg(json_build_object(
        'id', x.id,
        'candidato', x.candidato,
        'codigo', x.id_origem,
        'vaga', x.codigo_vaga,
        'cargo', x.nome_vaga,
        'nota', x.nota_final_ajustada,
        'resultado', x.status_consolidado,
        'responsavel', x.responsavel_analise,
        'modalidade', x.modalidade_concorrencia,
        'ativo', x.ativo
      ) order by x.ativo desc, x.candidato, x.codigo_vaga), '[]'::json)
    from (
      select a.id, a.candidato, a.id_origem, a.codigo_vaga, a.nome_vaga,
             a.nota_final_ajustada, a.status_consolidado, a.responsavel_analise,
             a.modalidade_concorrencia, a.ativo
      from public."TB_ANALISE_CURRICULAR" a
      where a.edital = v_edital
        and a."CO_AREA" = v_area
        and (strpos(private."FC_TEXTO_BUSCA_RECURSO"(a.candidato), v_texto) > 0
             or a.id_origem = v_busca)
      order by a.ativo desc, a.candidato, a.codigo_vaga
      limit 20
    ) x
  );
end;
$function$;
comment on function public.buscar_candidatos_recurso(uuid, text) is
  'Candidatos das análises curriculares do edital (mesmo edital e área), por parte do nome (sem acento) ou pelo código exato; até 20. Exige recursos >= editor e a área do edital.';

-- 8. Escrita -----------------------------------------------------------------------
create function public.salvar_recurso_candidato(p_dados jsonb)
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
  v_situacao text;
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
    -- Cadastro ---------------------------------------------------------------
    v_edital_id := nullif(p_dados->>'edital_id', '')::uuid;
    select m.edital, m."CO_AREA" into v_edital, v_area
    from public."TB_MONITORAMENTO_INDIGENA" m
    where m.id = v_edital_id;
    if v_area is null then
      raise exception 'Edital não encontrado' using errcode = '22023';
    end if;
    perform private."FC_EXIGIR_RECURSOS_NA_AREA"(v_area, 2);

    v_origem := nullif(p_dados->>'origem', '');
    if not exists (select 1 from public."TB_ORIGEM_RECURSO" o where o."CO_ORIGEM_RECURSO" = v_origem and o."ST_ATIVO" = 'S') then
      raise exception 'Origem do recurso inválida' using errcode = '22023';
    end if;
    v_situacao := coalesce(nullif(p_dados->>'situacao', ''), 'EM_ANALISE');
    if v_situacao not in ('EM_ANALISE', 'DEFERIDO', 'INDEFERIDO', 'PARCIALMENTE_INDEFERIDO') then
      raise exception 'Situação inválida' using errcode = '22023';
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
        and r."TP_SITUACAO" = 'EM_ANALISE'
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
        and r."TP_SITUACAO" = 'EM_ANALISE'
      order by r."NU_RECURSO"
      limit 1;
    end if;

    if v_duplicado is not null and not coalesce((p_dados->>'permitir_duplicado')::boolean, false) then
      raise exception 'Já existe o recurso nº % em análise para este candidato, edital e origem', v_duplicado
        using errcode = '23505', hint = 'duplicado:' || v_duplicado;
    end if;

    insert into public."TB_RECURSO_CANDIDATO" (
      "CO_MONITORAMENTO", "CO_ORIGEM_RECURSO", "CO_ANALISE_CURRICULAR", "ST_FORA_ANALISE",
      "NO_CANDIDATO_INFORMADO", "CO_CANDIDATO_INFORMADO", "NO_CARGO_INFORMADO", "CO_VAGA_INFORMADA",
      "VL_NOTA_ANTERIOR", "DS_RESULTADO_ANTERIOR", "NO_ANALISTA", "TP_SITUACAO",
      "NU_PROCESSO_SEI", "ST_MUDOU_CLASSIFICACAO", "DS_OBSERVACAO",
      "DT_PROCESSO_SEI", "CO_USUARIO_PROCESSO_SEI", "DT_DECISAO", "CO_USUARIO_DECISAO",
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
      v_situacao,
      nullif(btrim(p_dados->>'processo_sei'), ''),
      case when coalesce((p_dados->>'mudou_classificacao')::boolean, false) then 'S' else 'N' end,
      nullif(btrim(p_dados->>'observacao'), ''),
      case when nullif(btrim(p_dados->>'processo_sei'), '') is not null then now() end,
      case when nullif(btrim(p_dados->>'processo_sei'), '') is not null then v_uid end,
      case when v_situacao <> 'EM_ANALISE' then now() end,
      case when v_situacao <> 'EM_ANALISE' then v_uid end,
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
  if (p_dados->>'revisao') is null or (p_dados->>'revisao')::integer <> v_atual."NU_REVISAO" then
    raise exception 'O recurso foi alterado por outra pessoa. Recarregue e tente de novo.' using errcode = '40001';
  end if;

  v_novo := v_atual;
  if p_dados ? 'origem' then
    v_novo."CO_ORIGEM_RECURSO" := nullif(p_dados->>'origem', '');
    if v_novo."CO_ORIGEM_RECURSO" is distinct from v_atual."CO_ORIGEM_RECURSO"
       and not exists (select 1 from public."TB_ORIGEM_RECURSO" o where o."CO_ORIGEM_RECURSO" = v_novo."CO_ORIGEM_RECURSO" and o."ST_ATIVO" = 'S') then
      raise exception 'Origem do recurso inválida' using errcode = '22023';
    end if;
  end if;
  if p_dados ? 'situacao' then
    v_novo."TP_SITUACAO" := coalesce(nullif(p_dados->>'situacao', ''), 'EM_ANALISE');
    if v_novo."TP_SITUACAO" not in ('EM_ANALISE', 'DEFERIDO', 'INDEFERIDO', 'PARCIALMENTE_INDEFERIDO') then
      raise exception 'Situação inválida' using errcode = '22023';
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

  -- Decisão: sair de "em análise" fecha os dias em aberto; voltar reabre.
  if v_novo."TP_SITUACAO" <> 'EM_ANALISE' and v_atual."TP_SITUACAO" = 'EM_ANALISE' then
    v_novo."DT_DECISAO" := now();
    v_novo."CO_USUARIO_DECISAO" := v_uid;
  elsif v_novo."TP_SITUACAO" = 'EM_ANALISE' then
    v_novo."DT_DECISAO" := null;
    v_novo."CO_USUARIO_DECISAO" := null;
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
    ('edicao', 'situacao', v_atual."TP_SITUACAO", v_novo."TP_SITUACAO"),
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
    "TP_SITUACAO" = v_novo."TP_SITUACAO",
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
    "DT_DECISAO" = v_novo."DT_DECISAO",
    "CO_USUARIO_DECISAO" = v_novo."CO_USUARIO_DECISAO",
    "NU_REVISAO" = v_atual."NU_REVISAO" + 1,
    "DT_ATUALIZACAO" = now(),
    "CO_USUARIO_ATUALIZACAO" = v_uid
  where "CO_RECURSO_CANDIDATO" = v_id
  returning * into v_novo;

  return json_build_object('id', v_novo."CO_RECURSO_CANDIDATO", 'nu', v_novo."NU_RECURSO", 'revisao', v_novo."NU_REVISAO");
end;
$function$;
comment on function public.salvar_recurso_candidato(jsonb) is
  'Cadastra (sem id) ou edita (com id e revisão) um recurso. Cadastro: edital, origem ativa e o candidato das análises do mesmo edital (ou fora_analise com nome); guarda a nota e o resultado da análise do dia; analista padrão = responsável pela análise; duplicado em análise (mesmo candidato, edital e origem) dá 23505 salvo permitir_duplicado. Edição: origem, situação, analista, processo SEI, mudou a classificação, observação e, fora das análises, os dados digitados; revisão desatualizada dá 40001. Número do processo SEI marca a etapa; a decisão grava quando e quem. Tudo vai para TH_RECURSO_CANDIDATO. Exige recursos >= editor e a área do edital.';

create function public.marcar_etapa_recurso(p_id uuid, p_etapa text, p_feita boolean)
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
  'Marca (p_feita = true, com quando e quem) ou desmarca uma etapa do recurso: download_empregare, processo_sei, upload_sei ou resposta_candidato. Registra no histórico e sobe a revisão. Exige recursos >= editor e a área do edital.';

create function public.excluir_recurso_candidato(p_id uuid, p_motivo text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_edital uuid;
  v_area text;
begin
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 500 then
    raise exception 'Informe um motivo entre 3 e 500 caracteres' using errcode = '22023';
  end if;
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  select r."CO_MONITORAMENTO" into v_edital
  from public."TB_RECURSO_CANDIDATO" r
  where r."CO_RECURSO_CANDIDATO" = p_id and r."ST_ATIVO" = 'S'
  for update;
  if v_edital is null then
    raise exception 'Recurso não encontrado' using errcode = 'P0002';
  end if;
  select m."CO_AREA" into v_area from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_edital;
  perform private."FC_EXIGIR_RECURSOS_NA_AREA"(v_area, 2);
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
  'Exclusão lógica (ST_ATIVO = N) de um recurso cadastrado por engano, com motivo no histórico. Exige recursos >= editor e a área do edital.';

revoke all on function
  public.get_recursos_da_area(text),
  public.get_recurso_candidato_detalhe(uuid),
  public.buscar_candidatos_recurso(uuid, text),
  public.salvar_recurso_candidato(jsonb),
  public.marcar_etapa_recurso(uuid, text, boolean),
  public.excluir_recurso_candidato(uuid, text)
from public, anon;
grant execute on function
  public.get_recursos_da_area(text),
  public.get_recurso_candidato_detalhe(uuid),
  public.buscar_candidatos_recurso(uuid, text),
  public.salvar_recurso_candidato(jsonb),
  public.marcar_etapa_recurso(uuid, text, boolean),
  public.excluir_recurso_candidato(uuid, text)
to authenticated, service_role;

-- 9. Catálogo de abas: Recursos nas três áreas (espelho de ABAS_DO_MENU) -----------
insert into public."TB_ABA" ("CO_ABA", "NO_ABA", "DS_ICONE", "NU_ORDEM", "CO_VIEW", "CO_RECURSO", "TP_ABA") values
  ('recursos', 'Recursos', 'scale', 6, 'recursos', 'recursos', 'nativa');

insert into public."RL_ABA_AREA" ("CO_ABA", "CO_AREA", "CO_VIEW", "DS_ICONE") values
  ('recursos', 'saude-indigena', null, null),
  ('recursos', 'sede', null, null),
  ('recursos', 'projetos', null, null);

commit;
