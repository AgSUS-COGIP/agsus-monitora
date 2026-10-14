/*
  MAPA DA SAÚDE INDÍGENA SÓ QUANDO MUDA

  Por quê: o plano gratuito do Supabase está a 85% do egress (5 GB/mês). A
  entrada do app (src/app/carga.js) lia TB_CONFIG_MAPA_SAUDE_INDIG por REST
  (chaves `lmap` e `rede_cnes`): 150 kB a cada entrada, F5 e "Atualizar
  dados", 843 vezes de 02/10 a 14/10 (~125 MB). Mesmo quando a cópia da sessão
  abre a tela, a consulta real sai por trás para atualizar a cópia. O mapa
  quase nunca muda.

  O QUE ENTRA
    listar_mapa_da_saude_indigena(p_versao)
  As mesmas linhas que o select do front trazia ({ chave, payload } de `lmap` e
  `rede_cnes`), em { linhas, versao }, ou só { inalterado: true, versao } quando
  p_versao é a atual (private."FC_SE_MUDOU", o mesmo padrão de
  listar_monitoramento_operacional, 20261013160000).

  SEGURANÇA
    SECURITY INVOKER: a RLS de sempre (mapa_saude_indigena_select_public, para
    anon e authenticated, só `lmap` e `rede_cnes`). A pessoa vê exatamente o que
    via pelo select.

  COMPATIBILIDADE
    Só acrescenta: a tabela e as políticas continuam como estão e o front de
    hoje segue funcionando com esta migration aplicada. O front novo chama a
    função: aplique esta migration ANTES de publicar o front.

  Ensaio: supabase/ensaios/20261015000100_mapa_da_saude_indigena_so_quando_muda.sql
  Rollback: supabase/rollback/20261015000100_mapa_da_saude_indigena_so_quando_muda.sql
*/

begin;

create or replace function public.listar_mapa_da_saude_indigena(p_versao text default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select private."FC_SE_MUDOU"(jsonb_build_object('linhas', coalesce((
    select jsonb_agg(jsonb_build_object('chave', m.chave, 'payload', m.payload) order by m.chave)
      from public."TB_CONFIG_MAPA_SAUDE_INDIG" m
     where m.chave in ('lmap', 'rede_cnes')
  ), '[]'::jsonb)), p_versao);
$function$;

comment on function public.listar_mapa_da_saude_indigena(text) is
  'O mapa da Saúde Indígena (lmap e rede_cnes de TB_CONFIG_MAPA_SAUDE_INDIG) como { linhas: [{ chave, payload }], versao }; p_versao igual à atual devolve só { inalterado, versao } (FC_SE_MUDOU, 20261015000100). SECURITY INVOKER: a RLS da tabela.';

revoke all on function public.listar_mapa_da_saude_indigena(text) from public, anon;
grant execute on function public.listar_mapa_da_saude_indigena(text) to authenticated;

notify pgrst, 'reload schema';

commit;
