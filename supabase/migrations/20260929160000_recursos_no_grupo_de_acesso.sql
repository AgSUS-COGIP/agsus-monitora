/*
  Recursos no modelo de grupos de acesso.

  O modelo de grupos (TB_GRUPO_ACESSO, TA_GRUPO_ACESSO_RECURSO,
  private."FC_RECURSOS_MODULO") entrou no banco em 29/09 depois da migration
  20260929120000_recursos e redefiniu a lista de módulos sem 'recursos' — a aba
  Recursos sumiu do menu. Aqui só se acrescenta 'recursos' à lista e o nível de
  cada grupo; nada mais do modelo muda.

  Níveis (decisão do usuário): admin = admin; gestor de edital e coordenador =
  editor; usuário e contratador = leitor.
*/
begin;

create or replace function private."FC_RECURSOS_MODULO"()
 returns text[]
 language sql
 immutable
 set search_path to ''
as $function$
  select array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes','acessos','recursos']::text[];
$function$;

insert into public."TA_GRUPO_ACESSO_RECURSO" ("CO_GRUPO_ACESSO", "NO_RECURSO", "TP_NIVEL")
select g, 'recursos', n
  from (values ('admin','admin'), ('edital_gestor','editor'), ('coordenador','editor'),
               ('contratador','leitor'), ('usuario','leitor')) v(g, n)
 where exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = v.g)
on conflict ("CO_GRUPO_ACESSO", "NO_RECURSO") do nothing;

commit;
