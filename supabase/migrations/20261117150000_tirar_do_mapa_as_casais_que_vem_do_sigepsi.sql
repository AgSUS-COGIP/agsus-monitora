/*
  TIRAR DO MAPA DA SAÚDE INDÍGENA AS CASAIs DO BANCO: ELAS VÊM DO SIGEPSI (17/11/2026)

  POR QUE
  O mapa da Saúde Indígena passou a ler a lista de DSEIs, as sedes, os pontos e as CASAIs da API
  do SIGEPSI (função api/dseis.ts; src/lib/mapa-saude-indigena/localizacoes-do-sigepsi.ts). As
  CASAIs nacionais são as localizações 131 (CASAI DF) e 132 (CASAI São Paulo); as de cada DSEI vêm
  como TP_UNIDADE = CASAI. As que ficaram em TB_CONFIG_MAPA_SAUDE_INDIG são redundantes.

  O QUE MUDA (só os dados do mapa; o catálogo TD_UNIDADE, com DSEI/CASAI como lotação dos editais,
  da seleção e dos pedidos de acesso, NÃO muda)
    - lmap.casai (as 2 nacionais que só o editor de coordenadas via) → [].
    - rede_cnes.nac (as 2 nacionais do CNES, o losango do mapa nacional) → [].
    - rede_cnes.rede[<DSEI>].c (as CASAIs do CNES de cada DSEI; 70 medidas) → [].
    - Antes, cópia de cada linha em lmap_backup_20261117_pre_casais_do_sigepsi e
      rede_cnes_backup_20261117_pre_casais_do_sigepsi (o costume da tabela; a RPC
      listar_mapa_da_saude_indigena só entrega lmap e rede_cnes).
  Medido em 17/11/2026: nenhuma unidade (u) nem polo com nome de CASAI e nenhuma pendência de
  coordenada de CASAI (TB_PENDENCIA_COORDENADA_MAPA): nada a tirar lá.

  QUANDO: depois de publicar o front que lê as CASAIs do SIGEPSI (PR #856). Antes, o mapa no ar
  ficaria sem CASAI. Sem resposta do SIGEPSI, o mapa usa o banco e fica sem CASAI.

  GUARDAS: as cópias não existem ainda (não roda duas vezes por cima de dado já limpo); entre 60 e
  80 CASAIs nos DSEIs e até 2 nacionais em cada lista.
  Ensaio: supabase/ensaios/20261117150000_tirar_do_mapa_as_casais_que_vem_do_sigepsi.sql
  Rollback: supabase/rollback/20261117150000_tirar_do_mapa_as_casais_que_vem_do_sigepsi.sql (põe
            de volta as CASAIs das cópias, sem desfazer outras mudanças feitas depois).
*/

begin;

set local lock_timeout = '5s';

do $tirar$
declare
  v_c integer;
  v_nac integer;
  v_casai integer;
begin
  if exists (
    select 1 from public."TB_CONFIG_MAPA_SAUDE_INDIG"
     where chave in ('lmap_backup_20261117_pre_casais_do_sigepsi',
                     'rede_cnes_backup_20261117_pre_casais_do_sigepsi')
  ) then
    raise notice 'Cópias já existem: migration já aplicada, nada a fazer.';
    return;
  end if;

  select coalesce(sum(jsonb_array_length(coalesce(e.v -> 'c', '[]'::jsonb))), 0)
    into v_c
    from public."TB_CONFIG_MAPA_SAUDE_INDIG" m
    cross join lateral jsonb_each(m.payload -> 'rede') e(k, v)
   where m.chave = 'rede_cnes';
  select coalesce(jsonb_array_length(coalesce(payload -> 'nac', '[]'::jsonb)), 0)
    into v_nac
    from public."TB_CONFIG_MAPA_SAUDE_INDIG" where chave = 'rede_cnes';
  select coalesce(jsonb_array_length(coalesce(payload -> 'casai', '[]'::jsonb)), 0)
    into v_casai
    from public."TB_CONFIG_MAPA_SAUDE_INDIG" where chave = 'lmap';

  if v_c not between 60 and 80 or v_nac > 2 or v_casai > 2 then
    raise exception 'Fora do medido (c=%, nac=%, casai=%): conferir antes de apagar.', v_c, v_nac, v_casai;
  end if;

  insert into public."TB_CONFIG_MAPA_SAUDE_INDIG" (chave, payload, descricao)
  select chave || '_backup_20261117_pre_casais_do_sigepsi', payload,
         'Cópia antes de tirar as CASAIs do mapa (vêm do SIGEPSI), 20261117150000'
    from public."TB_CONFIG_MAPA_SAUDE_INDIG"
   where chave in ('lmap', 'rede_cnes');

  update public."TB_CONFIG_MAPA_SAUDE_INDIG"
     set payload = jsonb_set(payload, '{casai}', '[]'::jsonb), updated_at = now()
   where chave = 'lmap';

  update public."TB_CONFIG_MAPA_SAUDE_INDIG" m
     set payload = jsonb_set(
           jsonb_set(m.payload, '{nac}', '[]'::jsonb),
           '{rede}',
           coalesce((select jsonb_object_agg(e.k, e.v || jsonb_build_object('c', '[]'::jsonb))
                       from jsonb_each(m.payload -> 'rede') e(k, v)), '{}'::jsonb)),
         updated_at = now()
   where m.chave = 'rede_cnes';

  raise notice 'CASAIs tiradas do mapa: % dos DSEIs, % nacionais (rede_cnes) e % do lmap.', v_c, v_nac, v_casai;
end
$tirar$;

commit;
