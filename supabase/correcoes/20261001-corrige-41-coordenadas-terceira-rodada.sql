/*
  Coordenadas do mapa da Saúde Indígena: terceira rodada da auditoria oficial
  (01/10/2026). 41 polos base do lmap com duas fontes independentes concordando
  a até 5 km: localidades indígenas do Censo 2022 (IBGE), PDSI 2024-2027 de cada
  DSEI (aldeia-sede, coordenada ou TI do polo), aldeias Funai e OpenStreetMap.
  Inclui 11 dos polos empilhados do Alto Rio Negro. 93 continuam em revisão.

  Backup antes: chaves lmap_backup_20261001_pre_terceira_rodada e
  rede_cnes_backup_20261001_pre_terceira_rodada. Cada item só muda se nome e
  coordenada atuais forem os auditados; senão a transação inteira falha.
  Desfazer: copiar o payload das chaves de backup de volta para lmap/rede_cnes.
*/
begin;

insert into public."TB_CONFIG_MAPA_SAUDE_INDIG" (chave, payload, descricao, updated_at)
select chave || '_backup_20261001_pre_terceira_rodada', payload,
       'Backup de ' || chave || ' antes das correções da auditoria oficial de 01/10/2026', now()
  from public."TB_CONFIG_MAPA_SAUDE_INDIG" where chave in ('lmap', 'rede_cnes');

create function pg_temp.mover(p_chave text, p_nome text, p_nome_esperado text, p_lat text, p_lon text,
                              de_lat numeric, de_lon numeric, para_lat numeric, para_lon numeric)
returns void language plpgsql as $f$
declare v jsonb;
begin
  select payload into v from public."TB_CONFIG_MAPA_SAUDE_INDIG" where chave = p_chave for update;
  if p_nome_esperado is not null and v #>> p_nome::text[] is distinct from p_nome_esperado then
    raise exception 'nome diferente em % %: %', p_chave, p_nome, v #>> p_nome::text[];
  end if;
  if (v #>> p_lat::text[])::numeric <> de_lat or (v #>> p_lon::text[])::numeric <> de_lon then
    raise exception 'coordenada mudou em % %', p_chave, p_lat;
  end if;
  v := jsonb_set(jsonb_set(v, p_lat::text[], to_jsonb(para_lat)), p_lon::text[], to_jsonb(para_lon));
  update public."TB_CONFIG_MAPA_SAUDE_INDIG" set payload = v, updated_at = now() where chave = p_chave;
end $f$;

do $$
begin
  perform pg_temp.mover('lmap', '{dsei,3,polos,5,n}', 'CAUBURIS', '{dsei,3,polos,5,lat}', '{dsei,3,polos,5,lon}', -0.3707, -63.5372, -1.17438, -62.511091); -- ALTO RIO NEGRO CAUBURIS (144.92 km, CNES 228699)
  perform pg_temp.mover('lmap', '{dsei,3,polos,6,n}', 'CUCUÍ', '{dsei,3,polos,6,lat}', '{dsei,3,polos,6,lon}', 0.3318, -68.0903, 1.1882, -66.8389); -- ALTO RIO NEGRO CUCUÍ (168.6 km, CNES 7620306)
  perform pg_temp.mover('lmap', '{dsei,3,polos,7,n}', 'CUMARÚ', '{dsei,3,polos,7,lat}', '{dsei,3,polos,7,lon}', -0.3707, -63.5372, -0.60331, -63.385556); -- ALTO RIO NEGRO CUMARÚ (30.88 km, CNES 228710)
  perform pg_temp.mover('lmap', '{dsei,3,polos,10,n}', 'MARABITANA DO WAUPES', '{dsei,3,polos,10,lat}', '{dsei,3,polos,10,lon}', 0.3318, -68.0903, 0.434494, -68.833822); -- ALTO RIO NEGRO MARABITANA DO WAUPES (83.46 km, CNES 7620853)
  perform pg_temp.mover('lmap', '{dsei,3,polos,12,n}', 'NAZARÉ DO ENUIXÍ', '{dsei,3,polos,12,lat}', '{dsei,3,polos,12,lon}', -0.1813, -65.4909, -0.525258, -65.079403); -- ALTO RIO NEGRO NAZARÉ DO ENUIXÍ (59.64 km, CNES null)
  perform pg_temp.mover('lmap', '{dsei,3,polos,13,n}', 'PARI-CACHOEIRA', '{dsei,3,polos,13,lat}', '{dsei,3,polos,13,lon}', 0.3318, -68.0903, 0.2544, -69.7908); -- ALTO RIO NEGRO PARI-CACHOEIRA (189.28 km, CNES 9493433)
  perform pg_temp.mover('lmap', '{dsei,3,polos,15,n}', 'SÃO JOAQUIM', '{dsei,3,polos,15,lat}', '{dsei,3,polos,15,lon}', 0.3318, -68.0903, 1.703804, -69.384533); -- ALTO RIO NEGRO SÃO JOAQUIM (209.71 km, CNES 9493387)
  perform pg_temp.mover('lmap', '{dsei,3,polos,16,n}', 'SÃO JOSÉ II', '{dsei,3,polos,16,lat}', '{dsei,3,polos,16,lon}', 0.3318, -68.0903, 0.2244, -69.613); -- ALTO RIO NEGRO SÃO JOSÉ II (169.74 km, CNES 7620195)
  perform pg_temp.mover('lmap', '{dsei,3,polos,17,n}', 'SERRINHA', '{dsei,3,polos,17,lat}', '{dsei,3,polos,17,lon}', -0.1813, -65.4909, -0.482107, -64.827682); -- ALTO RIO NEGRO SERRINHA (80.98 km, CNES 3818721)
  perform pg_temp.mover('lmap', '{dsei,3,polos,18,n}', 'TAPERA', '{dsei,3,polos,18,lat}', '{dsei,3,polos,18,lon}', -0.3707, -63.5372, -0.189624, -64.079196); -- ALTO RIO NEGRO TAPERA (63.54 km, CNES 228680)
  perform pg_temp.mover('lmap', '{dsei,3,polos,24,n}', 'YAUARETÊ', '{dsei,3,polos,24,lat}', '{dsei,3,polos,24,lon}', 0.3318, -68.0903, 0.607878, -69.193626); -- ALTO RIO NEGRO YAUARETÊ (126.46 km, CNES 9493190)
  perform pg_temp.mover('lmap', '{dsei,6,polos,0,n}', 'BONA', '{dsei,6,polos,0,lat}', '{dsei,6,polos,0,lon}', 0.9169, -54.6214, 1.214637, -54.655419); -- AMAPA E NORTE DO PARA BONA (33.32 km, CNES 494747)
  perform pg_temp.mover('lmap', '{dsei,6,polos,3,n}', 'KUMARUMÃ', '{dsei,6,polos,3,lat}', '{dsei,6,polos,3,lon}', 3.3094, -51.339, 3.378611, -51.297222); -- AMAPA E NORTE DO PARA KUMARUMÃ (8.99 km, CNES 2021110)
  perform pg_temp.mover('lmap', '{dsei,6,polos,1,n}', 'MISSÃO TIRIYÓ', '{dsei,6,polos,1,lat}', '{dsei,6,polos,1,lon}', 1.7036, -55.9526, 2.2326, -55.9607); -- AMAPA E NORTE DO PARA MISSÃO TIRIYÓ (58.83 km, CNES null)
  perform pg_temp.mover('lmap', '{dsei,10,polos,5,n}', 'BACAVAL', '{dsei,10,polos,5,lat}', '{dsei,10,polos,5,lon}', -13.6321, -58.182, -13.640883, -58.288065); -- CUIABA BACAVAL (11.5 km, CNES 7798202)
  perform pg_temp.mover('lmap', '{dsei,10,polos,4,n}', 'BRASNORTE', '{dsei,10,polos,4,lat}', '{dsei,10,polos,4,lon}', -12.8014, -57.9844, -12.1223, -58.0029); -- CUIABA BRASNORTE (75.54 km, CNES 7567367)
  perform pg_temp.mover('lmap', '{dsei,10,polos,10,n}', 'MERURI', '{dsei,10,polos,10,lat}', '{dsei,10,polos,10,lon}', -15.5606, -53.2985, -15.552405, -53.079482); -- CUIABA MERURI (23.48 km, CNES 7546823)
  perform pg_temp.mover('lmap', '{dsei,10,polos,6,n}', 'TRES LAGOAS', '{dsei,10,polos,6,lat}', '{dsei,10,polos,6,lon}', -14.5406, -58.9235, -14.533498, -59.058437); -- CUIABA TRES LAGOAS (14.55 km, CNES 7732279)
  perform pg_temp.mover('lmap', '{dsei,13,polos,2,n}', 'SEDE DO DSEI KAIAPÓ DO MT', '{dsei,13,polos,2,lat}', '{dsei,13,polos,2,lon}', -9.0278, -57.0964, -10.8053, -55.4564); -- KAIAPO DO MATO GROSSO SEDE DO DSEI KAIAPÓ DO MT (267.08 km, CNES null)
  perform pg_temp.mover('lmap', '{dsei,15,polos,2,n}', 'ARAÇÁ', '{dsei,15,polos,2,lat}', '{dsei,15,polos,2,lon}', 3.7696, -61.3633, 3.586505, -61.114105); -- LESTE DE RORAIMA ARAÇÁ (34.34 km, CNES 9187243)
  perform pg_temp.mover('lmap', '{dsei,15,polos,6,n}', 'BOQUEIRÃO', '{dsei,15,polos,6,lat}', '{dsei,15,polos,6,lon}', 3.1401, -61.3172, 3.284082, -61.285486); -- LESTE DE RORAIMA BOQUEIRÃO (16.39 km, CNES 2589818)
  perform pg_temp.mover('lmap', '{dsei,15,polos,25,n}', 'PIUM', '{dsei,15,polos,25,lat}', '{dsei,15,polos,25,lon}', 3.3634, -61.098, 3.412729, -61.098785); -- LESTE DE RORAIMA PIUM (5.49 km, CNES 2319934)
  perform pg_temp.mover('lmap', '{dsei,19,polos,13,n}', 'BRASILÂNDIA', '{dsei,19,polos,13,lat}', '{dsei,19,polos,13,lon}', -21.0823, -52.4595, -21.248522, -52.133553); -- MATO GROSSO DO SUL BRASILÂNDIA (38.52 km, CNES null)
  perform pg_temp.mover('lmap', '{dsei,19,polos,8,n}', 'JAPORÃ', '{dsei,19,polos,8,lat}', '{dsei,19,polos,8,lon}', -23.6833, -54.4409, -23.771481, -54.597108); -- MATO GROSSO DO SUL JAPORÃ (18.68 km, CNES null)
  perform pg_temp.mover('lmap', '{dsei,20,polos,6,n}', 'CASA NOVA', '{dsei,20,polos,6,lat}', '{dsei,20,polos,6,lon}', -7.2623, -65.3622, -7.305293, -65.259851); -- MEDIO RIO PURUS CASA NOVA (12.26 km, CNES 9425640)
  perform pg_temp.mover('lmap', '{dsei,20,polos,1,n}', 'MARRECÃO', '{dsei,20,polos,1,lat}', '{dsei,20,polos,1,lon}', -5.628, -63.183, -6.811085, -66.933467); -- MEDIO RIO PURUS MARRECÃO (434.94 km, CNES 9472878)
  perform pg_temp.mover('lmap', '{dsei,22,polos,11,n}', 'TOPÁZIO', '{dsei,22,polos,11,lat}', '{dsei,22,polos,11,lon}', -17.57, -41.273, -17.6458, -41.384); -- MINAS GERAIS E ESPIRITO SANTO TOPÁZIO (14.47 km, CNES null)
  perform pg_temp.mover('lmap', '{dsei,23,polos,11,n}', 'KURUATUBA', '{dsei,23,polos,11,lat}', '{dsei,23,polos,11,lon}', -3.9212, -55.9945, -3.770624, -56.805955); -- PARINTINS KURUATUBA (91.57 km, CNES 7575106)
  perform pg_temp.mover('lmap', '{dsei,23,polos,4,n}', 'NOVA ALDEIA', '{dsei,23,polos,4,lat}', '{dsei,23,polos,4,lon}', -3.695, -57.0243, -3.6823, -57.0852); -- PARINTINS NOVA ALDEIA (6.9 km, CNES 7651511)
  perform pg_temp.mover('lmap', '{dsei,27,polos,9,n}', 'CAROÇAL DO RIO DAS TROPAS', '{dsei,27,polos,9,lat}', '{dsei,27,polos,9,lon}', -6.5051, -57.4516, -6.827942, -57.435599); -- RIO TAPAJOS CAROÇAL DO RIO DAS TROPAS (35.94 km, CNES null)
  perform pg_temp.mover('lmap', '{dsei,27,polos,8,n}', 'RESTINGA', '{dsei,27,polos,8,lat}', '{dsei,27,polos,8,lon}', -7.1415, -58.1142, -7.206762, -58.137198); -- RIO TAPAJOS RESTINGA (7.69 km, CNES 7592248)
  perform pg_temp.mover('lmap', '{dsei,27,polos,4,n}', 'TELES PIRES', '{dsei,27,polos,4,lat}', '{dsei,27,polos,4,lon}', -6.970049, -58.359375, -8.391569, -57.672575); -- RIO TAPAJOS TELES PIRES (175.25 km, CNES 7597355)
  perform pg_temp.mover('lmap', '{dsei,29,polos,2,n}', 'JAQUIRANA', '{dsei,29,polos,2,lat}', '{dsei,29,polos,2,lon}', -5.271, -72.8594, -5.661562, -72.962575); -- VALE DO JAVARI JAQUIRANA (44.9 km, CNES 7159250)
  perform pg_temp.mover('lmap', '{dsei,32,polos,2,n}', 'PAVURÚ', '{dsei,32,polos,2,lat}', '{dsei,32,polos,2,lon}', -12.069, -53.8565, -11.742587, -53.611142); -- XINGU PAVURÚ (45.06 km, CNES 7896018)
  perform pg_temp.mover('lmap', '{dsei,33,polos,29,n}', 'AUARIS', '{dsei,33,polos,29,lat}', '{dsei,33,polos,29,lon}', 3.7769, -62.5529, 4.004, -64.4972); -- YANOMAMI AUARIS (217.17 km, CNES 6784542)
  perform pg_temp.mover('lmap', '{dsei,33,polos,0,n}', 'ERICÓ', '{dsei,33,polos,0,lat}', '{dsei,33,polos,0,lon}', 3.6968, -62.3944, 3.6357, -62.398089); -- YANOMAMI ERICÓ (6.81 km, CNES 6784526)
  perform pg_temp.mover('lmap', '{dsei,33,polos,31,n}', 'HOMOXI', '{dsei,33,polos,31,lat}', '{dsei,33,polos,31,lon}', 2.167258, -61.052743, 2.506631, -63.701037); -- YANOMAMI HOMOXI (296.64 km, CNES 7163223)
  perform pg_temp.mover('lmap', '{dsei,33,polos,32,n}', 'MISSÃO CATRIMANI', '{dsei,33,polos,32,lat}', '{dsei,33,polos,32,lon}', 1.803871, -61.149176, 1.739636, -62.286883); -- YANOMAMI MISSÃO CATRIMANI (126.65 km, CNES 6954480)
  perform pg_temp.mover('lmap', '{dsei,33,polos,14,n}', 'NOVO-DEMINI', '{dsei,33,polos,14,lat}', '{dsei,33,polos,14,lon}', 1.5208, -63.447, 1.614461, -63.654255); -- YANOMAMI NOVO-DEMINI (25.28 km, CNES 7779615)
  perform pg_temp.mover('lmap', '{dsei,33,polos,33,n}', 'PALIMIÚ', '{dsei,33,polos,33,lat}', '{dsei,33,polos,33,lon}', 3.0779, -62.6675, 3.330506, -62.971229); -- YANOMAMI PALIMIÚ (43.89 km, CNES 6856497)
  perform pg_temp.mover('lmap', '{dsei,33,polos,16,n}', 'PARAFURI', '{dsei,33,polos,16,lat}', '{dsei,33,polos,16,lon}', 3.3273, -63.868, 3.28395, -63.8508); -- YANOMAMI PARAFURI (5.18 km, CNES 6856365)
end $$;

commit;
