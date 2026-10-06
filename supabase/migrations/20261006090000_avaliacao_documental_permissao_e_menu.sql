/*
  AVALIAÇÃO DOCUMENTAL (FASE F1): PERMISSÃO E MENU

  O trabalho da avaliação documental sai das planilhas e do simulador e vem
  para o MONITORA (docs/analises-no-monitora/). O painel e o trabalho ficam
  separados no menu:

    - "Painel das análises": a tela de hoje (view 'analises', recurso
      'analises'), só leitura. Muda só o rótulo (antes "Análises
      curriculares").
    - "Avaliação documental": a tela nova (view 'avaliacao-documental',
      src/modulos/avaliacao-documental/), com o recurso novo
      'avaliacao_documental'.

  O QUE ENTRA
    'avaliacao_documental' em private."FC_RECURSOS_MODULO"() — as restrições
    CK_GRUPACESSOREC_RECURSO e CK_PERMISSAORECURSO_RECURSO já leem a lista —
    com os níveis leitor | editor | admin:
      leitor  vê a regra e a equipe dos editais que vê;
      editor  analisa ou revisa nos editais em que tem o papel (fases F3+);
      admin   coordena (regra, equipe, lote, distribuição, revisão) os
              editais em que é gestor (automático) ou coordenador (papel).
    Semente dos grupos (o administrador global muda em Configurações ›
    Acessos): administrador global, edital_gestor e coordenador = admin; os
    demais = sem_acesso enquanto o piloto (93/2026) roda — quem analisa
    recebe Editor por pessoa ou por grupo.

    A aba 'avaliacao-documental' entra em TB_ABA DESLIGADA (ST_ATIVO = 'N',
    selo BETA), nas três áreas, na ordem 5 (depois do Painel das análises);
    Recursos, Entrevistas, Classificação, Lista de aprovados e Seleção descem
    uma posição. 20261006090500_liga_aba_avaliacao_documental.sql liga junto
    com o merge do front.

  PRÉ-REQUISITO: 20261002210000_chat.sql aplicada (a lista de módulos com
  'chat'); a migration para se não estiver.

  Ensaio: supabase/ensaios/20261006090000_avaliacao_documental_permissao_e_menu.sql
  Rollback: supabase/rollback/20261006090000_avaliacao_documental_permissao_e_menu.sql
*/
begin;

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if not ('chat' = any (private."FC_RECURSOS_MODULO"())) then
    raise exception 'Aplique antes 20261002210000_chat.sql (lista de módulos sem chat).';
  end if;
  if not exists (select 1 from public."TB_ABA" where "CO_ABA" = 'analises') then
    raise exception 'Catálogo de abas sem a aba analises (20260929110000_catalogo_de_abas.sql).';
  end if;
end;
$$;

-- 1. Permissão: recurso 'avaliacao_documental' -------------------------------------------
create or replace function private."FC_RECURSOS_MODULO"()
 returns text[]
 language sql
 immutable
 set search_path to ''
as $function$
  select array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes','acessos','recursos','entrevistas','selecao','recursos_parecer','classificacao','chat','avaliacao_documental']::text[];
$function$;

insert into public."TA_GRUPO_ACESSO_RECURSO" ("CO_GRUPO_ACESSO", "NO_RECURSO", "TP_NIVEL")
select g."CO_GRUPO_ACESSO", 'avaliacao_documental',
       case
         when g."ST_ADMIN_GLOBAL" then 'admin'
         when g."CO_GRUPO_ACESSO" in ('edital_gestor', 'coordenador') then 'admin'
         else 'sem_acesso'
       end
  from public."TB_GRUPO_ACESSO" g
on conflict ("CO_GRUPO_ACESSO", "NO_RECURSO") do nothing;

-- 2. Menu: o painel muda de rótulo; a avaliação documental entra desligada ----------------
update public."TB_ABA" set "NO_ABA" = 'Painel das análises', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'analises';

update public."TB_ABA" set "NU_ORDEM" = 6, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'recursos';
update public."TB_ABA" set "NU_ORDEM" = 7, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'entrevistas';
update public."TB_ABA" set "NU_ORDEM" = 8, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'classificacao';
update public."TB_ABA" set "NU_ORDEM" = 9, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'aprovados';
update public."TB_ABA" set "NU_ORDEM" = 10, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'selecao';

insert into public."TB_ABA" ("CO_ABA", "NO_ABA", "DS_ICONE", "NU_ORDEM", "CO_VIEW", "CO_RECURSO", "TP_ABA", "ST_ATIVO", "ST_BETA")
values ('avaliacao-documental', 'Avaliação documental', 'graduation-cap', 5, 'avaliacao-documental', 'avaliacao_documental', 'nativa', 'N', 'S');
insert into public."RL_ABA_AREA" ("CO_ABA", "CO_AREA", "ST_ATIVO")
select 'avaliacao-documental', a."CO_AREA", 'S' from public."TB_AREA" a
on conflict do nothing;

commit;
