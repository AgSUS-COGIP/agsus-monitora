/*
  TIRAR DO BANCO OS PONTOS DO MAPA DA SAÚDE INDÍGENA: TUDO VEM DO SIGEPSI (17/11/2026)

  POR QUE
  O mapa da Saúde Indígena passou a usar só a API do SIGEPSI (função api/dseis.ts): a lista de
  DSEIs, a sede, os polos, as CASAIs e as unidades de lotação. Sem plano B: se o SIGEPSI não
  responde, a tela mostra o erro (um dado desatualizado seria pior). O editor de coordenadas
  deste mapa saiu (corrige-se no SIGEPSI). Do banco, o mapa só lê, de cada DSEI, o nome bem
  grafado, a população (tamanho da bolha) e as UFs administrativas, que a API não traz.

  O QUE MUDA (medido em 17/11/2026)
    - lmap: cada DSEI fica só com k, n, pop, ufs e sedeuf. Saem os polos (381), a posição e os
      dados da sede (lat, lon, sede_municipio, sede_endereco, sede_cnes, sede_fonte,
      sede_verificada_em) e a lista casai.
    - rede_cnes: a linha sai inteira (1.011 unidades do CNES; as CASAIs saem em 20261117150000).
      A RPC listar_mapa_da_saude_indigena passa a entregar só o lmap.
    - private."TB_PENDENCIA_COORDENADA_MAPA": as 248 pendências de coordenada do editor (92 de
      polos, 156 de UBSI/postos) saem.
    - Antes, cópias em TB_CONFIG_MAPA_SAUDE_INDIG (o costume da tabela; a RPC só entrega lmap):
      lmap_backup_20261117_pre_sigepsi, rede_cnes_backup_20261117_pre_sigepsi e
      pendencias_coordenada_backup_20261117_pre_sigepsi (as linhas da tabela, em JSON).
  FICAM: o histórico das alterações de coordenada (private."TH_COORDENADA_MAPA_SAUDE_INDIG", é
  auditoria), as funções do editor (sem uso no front; saem numa migration própria, se for o caso)
  e o catálogo TD_UNIDADE (DSEI/CASAI dos editais, da seleção e dos acessos).

  QUANDO: depois de publicar o front que lê tudo do SIGEPSI. Antes, o mapa no ar ficaria sem
  pontos. Depois de 20261117150000 (as CASAIs), ou no lugar dela: esta também guarda e tira tudo.

  GUARDAS: as cópias não existem ainda; entre 30 e 40 DSEIs no lmap; até 1.200 unidades no
  rede_cnes; até 300 pendências.
  Ensaio: supabase/ensaios/20261117170000_tirar_do_banco_os_pontos_do_mapa_que_vem_do_sigepsi.sql
  Rollback: supabase/rollback/20261117170000_tirar_do_banco_os_pontos_do_mapa_que_vem_do_sigepsi.sql
            (volta lmap, rede_cnes e as pendências das cópias).
*/

begin;

set local lock_timeout = '5s';

do $tirar$
declare
  v_dseis integer;
  v_unidades integer;
  v_pendencias integer;
begin
  if exists (
    select 1 from public."TB_CONFIG_MAPA_SAUDE_INDIG"
     where chave in ('lmap_backup_20261117_pre_sigepsi',
                     'rede_cnes_backup_20261117_pre_sigepsi',
                     'pendencias_coordenada_backup_20261117_pre_sigepsi')
  ) then
    raise notice 'Cópias já existem: migration já aplicada, nada a fazer.';
    return;
  end if;

  select coalesce(jsonb_array_length(payload -> 'dsei'), 0) into v_dseis
    from public."TB_CONFIG_MAPA_SAUDE_INDIG" where chave = 'lmap';
  select coalesce(sum(jsonb_array_length(coalesce(e.v -> 'u', '[]'::jsonb))), 0) into v_unidades
    from public."TB_CONFIG_MAPA_SAUDE_INDIG" m
    cross join lateral jsonb_each(m.payload -> 'rede') e(k, v)
   where m.chave = 'rede_cnes';
  select count(*) into v_pendencias from private."TB_PENDENCIA_COORDENADA_MAPA";

  if coalesce(v_dseis, 0) not between 30 and 40 or v_unidades > 1200 or v_pendencias > 300 then
    raise exception 'Fora do medido (dseis=%, unidades=%, pendencias=%): conferir antes de apagar.',
      v_dseis, v_unidades, v_pendencias;
  end if;

  insert into public."TB_CONFIG_MAPA_SAUDE_INDIG" (chave, payload, descricao)
  select chave || '_backup_20261117_pre_sigepsi', payload,
         'Cópia antes de o mapa passar a ler tudo do SIGEPSI, 20261117170000'
    from public."TB_CONFIG_MAPA_SAUDE_INDIG"
   where chave in ('lmap', 'rede_cnes');

  insert into public."TB_CONFIG_MAPA_SAUDE_INDIG" (chave, payload, descricao)
  select 'pendencias_coordenada_backup_20261117_pre_sigepsi',
         coalesce(jsonb_agg(to_jsonb(p) order by p."CO_SEQ_PENDENCIA"), '[]'::jsonb),
         'Cópia de private."TB_PENDENCIA_COORDENADA_MAPA" antes de o editor sair, 20261117170000'
    from private."TB_PENDENCIA_COORDENADA_MAPA" p;

  -- Cada DSEI fica só com o que o mapa lê do banco; a lista casai sai.
  update public."TB_CONFIG_MAPA_SAUDE_INDIG" m
     set payload = jsonb_build_object('dsei', coalesce((
           select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                    'k', d -> 'k', 'n', d -> 'n', 'pop', d -> 'pop',
                    'ufs', d -> 'ufs', 'sedeuf', d -> 'sedeuf')) order by o)
             from jsonb_array_elements(m.payload -> 'dsei') with ordinality x(d, o)), '[]'::jsonb)),
         updated_at = now()
   where m.chave = 'lmap';

  delete from public."TB_CONFIG_MAPA_SAUDE_INDIG" where chave = 'rede_cnes';
  delete from private."TB_PENDENCIA_COORDENADA_MAPA";

  raise notice 'Mapa só do SIGEPSI: % DSEIs reduzidos, % unidades do CNES e % pendências tiradas.',
    v_dseis, v_unidades, v_pendencias;
end
$tirar$;

commit;
