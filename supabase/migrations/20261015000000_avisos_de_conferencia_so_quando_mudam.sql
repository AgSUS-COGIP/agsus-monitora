/*
  AVISOS DE CONFERÊNCIA SÓ QUANDO MUDAM

  Por quê: o plano gratuito do Supabase está a 85% do egress (5 GB/mês).
  listar_avisos_conferencia foi chamada 2.192 vezes de 02/10 a 14/10 e devolve
  24,6 kB no recorte de tudo (Configurações › Status das atualizações): o selo
  de Análises, Entrevistas, Classificação e Lista de aprovados é montado de novo
  a cada visita à tela, e o cartão do Status das atualizações era recriado a
  cada releitura da tela (de 20 em 20 s enquanto um robô rodava). Os avisos
  mudam uma vez por dia (job das 6h), no "Rodar agora" e no "ignorar".

  O QUE ENTRA
    listar_avisos_conferencia_se_mudou(p_area, p_modulo, p_versao)
  O payload de listar_avisos_conferencia (a função de sempre, intocada), com
  a chave `versao` a mais (private."FC_SE_MUDOU", 20261013160000/190000), ou só
  { inalterado: true, versao } quando p_versao é a atual. Além disso, cada
  aviso sai mais leve:
    - sem as chaves nulas (ignorado_em e motivo dos abertos, edital e área dos
      avisos sem edital ou área): o front já trata a chave ausente como nula
      (src/lib/avisos-de-conferencia.ts, normalizarAviso);
    - sem `exemplos` quando o aviso tem casos (TB_CASO_AVISO_CONFERENCIA): a
      tela só mostra os exemplos de aviso gravado antes dos casos (job antigo).
      Em 14/10, os 30 avisos abertos tinham casos: 6,4 kB a menos.

  SEGURANÇA
    SECURITY DEFINER só para ler TB_CASO_AVISO_CONFERENCIA (saber se o aviso tem
    casos). Quem pode ver o quê continua sendo decidido pela função de dentro
    (auth.uid() e FC_PODE_VER_AVISO): a de fora só emagrece o que ela devolveu.

  COMPATIBILIDADE
    Só acrescenta: listar_avisos_conferencia continua como está, e o front de
    hoje segue funcionando com esta migration aplicada. O front novo
    (src/modulos/conferencias/estado.ts) chama a função nova: aplique esta
    migration ANTES de publicar o front.

  Ensaio: supabase/ensaios/20261015000000_avisos_de_conferencia_so_quando_mudam.sql
  Rollback: supabase/rollback/20261015000000_avisos_de_conferencia_so_quando_mudam.sql
*/

begin;

create or replace function public.listar_avisos_conferencia_se_mudou(
  p_area text default null, p_modulo text default null, p_versao text default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with bruto as (
    select public.listar_avisos_conferencia(p_area, p_modulo)::jsonb as j
  )
  select private."FC_SE_MUDOU"(
           b.j || jsonb_build_object('avisos', coalesce((
             select jsonb_agg(
                      jsonb_strip_nulls(
                        case
                          when exists (
                            select 1
                              from public."TB_CASO_AVISO_CONFERENCIA" c
                             where c."CO_AVISO_CONFERENCIA" = (a.aviso ->> 'id')::uuid)
                            then a.aviso - 'exemplos'
                          else a.aviso
                        end)
                      order by a.ordem)
               from jsonb_array_elements(b.j -> 'avisos') with ordinality a(aviso, ordem)
           ), '[]'::jsonb)),
           p_versao)
    from bruto b;
$function$;

comment on function public.listar_avisos_conferencia_se_mudou(text, text, text) is
  'listar_avisos_conferencia com versão (FC_SE_MUDOU): o payload com a chave versao, cada aviso sem chaves nulas e sem exemplos quando tem casos (TB_CASO_AVISO_CONFERENCIA); p_versao igual à atual devolve só { inalterado, versao } (20261015000000). A permissão é a da função de dentro.';

revoke all on function public.listar_avisos_conferencia_se_mudou(text, text, text) from public, anon;
grant execute on function public.listar_avisos_conferencia_se_mudou(text, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
