/*
  ENSAIO de 20261006090000_avaliacao_documental_permissao_e_menu.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela), confere o recurso avaliacao_documental, a
  semente dos grupos, as restrições das tabelas de permissão e o catálogo de
  abas, e termina em ROLLBACK: nada fica gravado.

  Resultado esperado: as mensagens "ok E1" e "ok E2" e a linha "ENSAIO OK".
  Qualquer "FALHOU …" interrompe e desfaz tudo; copie a mensagem.

  Mantenha em sincronia: tests/avaliacao-documental-migration.test.js confere
  que o corpo da migration aqui é idêntico ao do arquivo da migration.
*/
begin;

-- ═══ CORPO DA MIGRATION (início) ═══

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

-- ═══ CORPO DA MIGRATION (fim) ═══

-- E1. Recurso, semente dos grupos e catálogo de abas.
do $$
begin
  if not ('avaliacao_documental' = any (private."FC_RECURSOS_MODULO"())) then
    raise exception 'FALHOU E1: recurso fora de FC_RECURSOS_MODULO';
  end if;
  if (select count(*) from public."TB_GRUPO_ACESSO" g where g."ST_ADMIN_GLOBAL") <> 1 then
    raise notice 'aviso E1: há % grupos de administrador global', (select count(*) from public."TB_GRUPO_ACESSO" g where g."ST_ADMIN_GLOBAL");
  end if;
  if exists (select 1 from public."TB_GRUPO_ACESSO" g
              where g."ST_ADMIN_GLOBAL" and private."FC_NIVEL_DO_GRUPO"(g."CO_GRUPO_ACESSO", 'avaliacao_documental') <> 'admin') then
    raise exception 'FALHOU E1: administrador global sem admin';
  end if;
  if private."FC_NIVEL_DO_GRUPO"('edital_gestor', 'avaliacao_documental') <> 'admin'
     or (exists (select 1 from public."TB_GRUPO_ACESSO" where "CO_GRUPO_ACESSO" = 'coordenador')
         and private."FC_NIVEL_DO_GRUPO"('coordenador', 'avaliacao_documental') <> 'admin')
     or private."FC_NIVEL_DO_GRUPO"('usuario', 'avaliacao_documental') <> 'sem_acesso' then
    raise exception 'FALHOU E1: semente dos grupos (gestor e coordenador admin, usuário sem acesso)';
  end if;
  if (select count(*) from public."TA_GRUPO_ACESSO_RECURSO" where "NO_RECURSO" = 'avaliacao_documental')
     <> (select count(*) from public."TB_GRUPO_ACESSO") then
    raise exception 'FALHOU E1: um nível por grupo';
  end if;
  if not exists (select 1 from public."TB_ABA" where "CO_ABA" = 'avaliacao-documental' and "NU_ORDEM" = 5 and "ST_ATIVO" = 'N'
                    and "ST_BETA" = 'S' and "CO_VIEW" = 'avaliacao-documental' and "CO_RECURSO" = 'avaliacao_documental')
     or (select "NO_ABA" from public."TB_ABA" where "CO_ABA" = 'analises') <> 'Painel das análises'
     or (select "NU_ORDEM" from public."TB_ABA" where "CO_ABA" = 'recursos') <> 6
     or (select "NU_ORDEM" from public."TB_ABA" where "CO_ABA" = 'entrevistas') <> 7
     or (select "NU_ORDEM" from public."TB_ABA" where "CO_ABA" = 'classificacao') <> 8
     or (select "NU_ORDEM" from public."TB_ABA" where "CO_ABA" = 'aprovados') <> 9
     or (select "NU_ORDEM" from public."TB_ABA" where "CO_ABA" = 'selecao') <> 10
     or (select count(*) from public."RL_ABA_AREA" where "CO_ABA" = 'avaliacao-documental') <> (select count(*) from public."TB_AREA") then
    raise exception 'FALHOU E1: catálogo de abas';
  end if;
  raise notice 'ok E1: recurso avaliacao_documental (admin global, gestor e coordenador = admin; usuário sem acesso), aba desligada na ordem 5 e "Painel das análises"';
end;
$$;

-- E2. As restrições de permissão aceitam o recurso novo (grupo e individual) e recusam o inventado.
do $$
begin
  begin
    insert into public."TA_GRUPO_ACESSO_RECURSO" ("CO_GRUPO_ACESSO", "NO_RECURSO", "TP_NIVEL") values ('usuario', 'avaliacao_documental_x', 'leitor');
    raise exception 'FALHOU E2: recurso inventado aceito';
  exception when check_violation then null;
  end;
  update public."TA_GRUPO_ACESSO_RECURSO" set "TP_NIVEL" = 'leitor' where "CO_GRUPO_ACESSO" = 'usuario' and "NO_RECURSO" = 'avaliacao_documental';
  if private."FC_NIVEL_DO_GRUPO"('usuario', 'avaliacao_documental') <> 'leitor' then
    raise exception 'FALHOU E2: nível do grupo não mudou';
  end if;
  raise notice 'ok E2: CK das tabelas de permissão aceita avaliacao_documental e recusa recurso inventado';
end;
$$;

select 'ENSAIO OK' as resultado;

rollback;
