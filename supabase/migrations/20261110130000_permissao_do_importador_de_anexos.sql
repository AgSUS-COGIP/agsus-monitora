-- Dizer ao importador de anexos se quem chama pode importar.
--
-- Motivo: auditoria de 09/11/2026 (SEG-02). api/anexos-do-edital.py só
-- conferia se a sessão é válida (/auth/v1/user): qualquer conta do Supabase,
-- mesmo com perfil pendente, desativado ou sem acesso a Editais, fazia o
-- servidor processar PDFs. Sessão válida não é permissão do módulo.
--
-- Efeito: RPC só de leitura, chamada pelo endpoint com o Bearer de quem pediu.
-- A regra é a mesma de quem grava o resultado da importação
-- (salvar_quadro_de_vagas e o salvar do edital): editar Núcleo ou Calendário.
-- private.pode_recurso já recusa perfil inexistente ou inativo.
--
-- Dependentes: api/anexos-do-edital.py (fora do src/, por isso fora do
-- src/lib/rpc-contrato.ts). Aplicar ANTES do merge: sem a função, o endpoint
-- responde 503 e a importação fica parada.
-- Rollback: supabase/rollback/20261110130000_permissao_do_importador_de_anexos.sql.
-- Ensaio: supabase/ensaios/20261110130000_permissao_do_importador_de_anexos.sql.

begin;
set local statement_timeout = '20s';
set local lock_timeout = '3s';

create or replace function public.pode_importar_anexos_do_edital()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select private.pode_recurso('nucleo', 2) or private.pode_recurso('calendario', 2);
$$;

comment on function public.pode_importar_anexos_do_edital() is
  'Porteiro de /api/anexos-do-edital: editar Nucleo ou Calendario, com perfil ativo. Mesma regra de quem grava o resultado. 20261110130000.';

revoke all on function public.pode_importar_anexos_do_edital() from public, anon;
grant execute on function public.pode_importar_anexos_do_edital() to authenticated;

commit;
