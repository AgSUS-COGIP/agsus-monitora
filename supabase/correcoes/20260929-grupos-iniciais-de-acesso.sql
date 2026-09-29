/*
  GRUPOS INICIAIS DE ACESSO (29/09/2026)

  Rodar no SQL Editor DEPOIS das migrations 20260929121000 a 20260929190000.

  Pedido do responsável (29/09/2026):
    * administradores globais: João Armandes Vieira, Yassuri Suira e Larissa
      Moreno Silva;
    * todos os demais: grupo "usuario" (leitor), sem permissão individual de
      módulo. Painéis externos e áreas continuam como estão; quem ficaria sem
      área nem coordenação recebe Saúde Indígena (senão não veria nada).

  PARTE 1 é só leitura: lista quem tem acesso e o setor que a pessoa escreveu
  no pedido de acesso — a única pista do banco sobre a coordenação dela. Use o
  resultado para criar as coordenações em Configurações › Acessos.

  PARTE 2 muda dados, numa transação: confere que acha exatamente as três
  pessoas pelo nome e aborta se não achar.
*/

-- PARTE 1 — consulta (só leitura) ---------------------------------------------------
select u.nome,
       u.email,
       u.perfil as grupo,
       u."CO_COORDENACAO" as coordenacao,
       (select nullif(btrim(s.setor), '') from public."TB_SOLICITACAO_ACESSO" s
         where s.user_id = u.user_id or lower(s.email) = lower(u.email)
         order by s.created_at desc limit 1) as setor_informado,
       -- Conta de e-mail compartilhado com nome de coordenação: use "Mover para
       -- Coordenações" na gaveta da conta (migration 20260929190100).
       translate(lower(u.nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
         ~ '(coordenacao|diretoria|gerencia|assessoria|gestao da|nucleo|^[a-z]{3,6} *[-–])' as parece_coordenacao
  from public."TB_PERFIL_USUARIO" u
 where u.ativo
 order by u.nome;

-- PARTE 2 — admins e leitores -----------------------------------------------------------
begin;

create temporary table tmp_admins on commit drop as
select u.id
  from public."TB_PERFIL_USUARIO" u
 where u.ativo
   and (translate(lower(btrim(u.nome)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like 'joao armandes vieira%'
        or translate(lower(btrim(u.nome)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like 'yassuri suira%'
        or translate(lower(btrim(u.nome)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like 'larissa moreno silva%');

do $$
declare n integer;
begin
  select count(*) into n from tmp_admins;
  if n <> 3 then
    raise exception 'Esperava 3 administradores pelo nome e achei %. Confira os nomes na PARTE 1.', n;
  end if;
end;
$$;

-- Permissões individuais de módulo saem (com histórico); painéis ficam.
insert into public."TH_PERMISSAO_RECURSO" (perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
select g.perfil_usuario_id, g.recurso, g.nivel,
       private."FC_NIVEL_DO_GRUPO"(case when a.id is not null then 'admin' else 'usuario' end, g.recurso),
       '00000000-0000-0000-0000-000000000000'::uuid, 'Carga inicial dos grupos (29/09/2026) [padrão do grupo]'
  from public."TB_PERMISSAO_RECURSO" g
  left join tmp_admins a on a.id = g.perfil_usuario_id
 where g.recurso = any (private."FC_RECURSOS_MODULO"());
delete from public."TB_PERMISSAO_RECURSO" where recurso = any (private."FC_RECURSOS_MODULO"());

insert into public."TH_PERMISSAO_RECURSO" (perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
select u.id, '#grupo', u.perfil, case when a.id is not null then 'admin' else 'usuario' end,
       '00000000-0000-0000-0000-000000000000'::uuid, 'Carga inicial dos grupos (29/09/2026)'
  from public."TB_PERFIL_USUARIO" u
  left join tmp_admins a on a.id = u.id
 where u.ativo
   and u.perfil is distinct from case when a.id is not null then 'admin' else 'usuario' end;

update public."TB_PERFIL_USUARIO" u
   set perfil = case when a.id is not null then 'admin' else 'usuario' end,
       "CO_COORDENACAO" = case when a.id is not null then null else u."CO_COORDENACAO" end,
       p_config = a.id is not null,
       p_admin = a.id is not null,
       updated_at = now()
  from public."TB_PERFIL_USUARIO" x
  left join tmp_admins a on a.id = x.id
 where x.id = u.id
   and u.ativo;

-- Leitor sem coordenação e sem área não veria nada: recebe Saúde Indígena.
insert into public."RL_PERFIL_USUARIO_AREA" ("CO_PERFIL_USUARIO", "CO_AREA")
select u.id, 'saude-indigena'
  from public."TB_PERFIL_USUARIO" u
 where u.ativo and u.perfil = 'usuario' and u."CO_COORDENACAO" is null
   and not exists (select 1 from public."RL_PERFIL_USUARIO_AREA" r where r."CO_PERFIL_USUARIO" = u.id);

-- Conferência: 3 admins, o resto usuario, nenhuma permissão individual de módulo.
select u.perfil as grupo, count(*) as pessoas
  from public."TB_PERFIL_USUARIO" u
 where u.ativo
 group by u.perfil
 order by u.perfil;

commit;
