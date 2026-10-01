/*
  Coordenadas do mapa da Saúde Indígena: segunda rodada da auditoria oficial
  (01/10/2026). 61 polos base do lmap com duas evidências independentes
  concordando: 46 vão para o ponto do CNES (endereço urbano geocodificado no
  OpenStreetMap perto do ponto do CNES, ou CNES junto da aldeia Funai homônima)
  e 15 para a aldeia Funai homônima única no DSEI (CNES ausente ou inservível).
  Aplicada por cima das 62 da primeira rodada. 141 itens continuam para revisão
  com a área técnica; 17 confirmados como estão.

  Backup antes: chaves lmap_backup_20261001_pre_segunda_rodada e
  rede_cnes_backup_20261001_pre_segunda_rodada. Cada item só muda se nome e
  coordenada atuais forem os auditados; senão a transação inteira falha.
  Desfazer: copiar o payload das chaves de backup de volta para lmap/rede_cnes.
*/
begin;

insert into public."TB_CONFIG_MAPA_SAUDE_INDIG" (chave, payload, descricao, updated_at)
select chave || '_backup_20261001_pre_segunda_rodada', payload,
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
  perform pg_temp.mover('lmap', '{dsei,2,polos,0,n}', 'MANCIO LIMA', '{dsei,2,polos,0,lat}', '{dsei,2,polos,0,lon}', -7.4898, -73.3793, -7.606787, -72.907763); -- ALTO RIO JURUA MANCIO LIMA (53.58 km, CNES 6955525)
  perform pg_temp.mover('lmap', '{dsei,2,polos,1,n}', 'PORTO WALTER', '{dsei,2,polos,1,lat}', '{dsei,2,polos,1,lon}', -8.4502, -72.48, -8.26405, -72.743804); -- ALTO RIO JURUA PORTO WALTER (35.65 km, CNES 6308740)
  perform pg_temp.mover('lmap', '{dsei,2,polos,6,n}', 'TARAUACÁ', '{dsei,2,polos,6,lat}', '{dsei,2,polos,6,lon}', -8.3559, -71.3519, -8.161278, -70.766278); -- ALTO RIO JURUA TARAUACÁ (67.98 km, CNES 6612385)
  perform pg_temp.mover('lmap', '{dsei,4,polos,5,n}', 'ASSIS BRASIL', '{dsei,4,polos,5,lat}', '{dsei,4,polos,5,lon}', -10.5513, -69.8603, -10.937511, -69.56669); -- ALTO RIO PURUS ASSIS BRASIL (53.6 km, CNES 6428940)
  perform pg_temp.mover('lmap', '{dsei,4,polos,1,n}', 'SANTA ROSA', '{dsei,4,polos,1,lat}', '{dsei,4,polos,1,lon}', -9.1719, -70.2372, -9.443304, -70.485535); -- ALTO RIO PURUS SANTA ROSA (40.66 km, CNES 6289312)
  perform pg_temp.mover('lmap', '{dsei,4,polos,4,n}', 'SENA MADUREIRA', '{dsei,4,polos,4,lat}', '{dsei,4,polos,4,lon}', -9.1884, -69.1851, -9.066521, -68.655131); -- ALTO RIO PURUS SENA MADUREIRA (59.74 km, CNES 6697151)
  perform pg_temp.mover('lmap', '{dsei,5,polos,4,n}', 'BELÉM DO SOLIMÕES', '{dsei,5,polos,4,lat}', '{dsei,5,polos,4,lon}', -4.1022, -69.5311, -4.04165, -69.524614); -- ALTO RIO SOLIMOES BELÉM DO SOLIMÕES (6.77 km, CNES 6992803)
  perform pg_temp.mover('lmap', '{dsei,5,polos,8,n}', 'BETÂNIA', '{dsei,5,polos,8,lat}', '{dsei,5,polos,8,lon}', -2.9683, -68.3353, -3.073856, -68.065859); -- ALTO RIO SOLIMOES BETÂNIA (32.14 km, CNES 7295820)
  perform pg_temp.mover('lmap', '{dsei,7,polos,3,n}', 'CONFRESA', '{dsei,7,polos,3,lat}', '{dsei,7,polos,3,lon}', -14.2663, -53.0285, -10.645952, -51.575425); -- ARAGUAIA CONFRESA (432.37 km, CNES 7637357)
  perform pg_temp.mover('lmap', '{dsei,7,polos,1,n}', 'SÃO FÉLIX DO ARAGUAIA', '{dsei,7,polos,1,lat}', '{dsei,7,polos,1,lon}', -11.46, -50.6663, -11.615807, -50.662631); -- ARAGUAIA SÃO FÉLIX DO ARAGUAIA (17.33 km, CNES 7738110)
  perform pg_temp.mover('lmap', '{dsei,8,polos,5,n}', 'PAU BRASIL', '{dsei,8,polos,5,lat}', '{dsei,8,polos,5,lon}', -15.3143, -39.6845, -15.463924, -39.65288); -- BAHIA PAU BRASIL (16.98 km, CNES 7496915)
  perform pg_temp.mover('lmap', '{dsei,9,polos,4,n}', 'CRATEÚS', '{dsei,9,polos,4,lat}', '{dsei,9,polos,4,lon}', -5.2237, -40.811, -5.176917, -40.668474); -- CEARA CRATEÚS (16.62 km, CNES 8296553)
  perform pg_temp.mover('lmap', '{dsei,10,polos,9,n}', 'COMODORO', '{dsei,10,polos,9,lat}', '{dsei,10,polos,9,lon}', -13.3129, -59.8355, -13.652425, -59.780316); -- CUIABA COMODORO (38.22 km, CNES 624039)
  perform pg_temp.mover('lmap', '{dsei,10,polos,1,n}', 'RONDONÓPOLIS', '{dsei,10,polos,1,lat}', '{dsei,10,polos,1,lon}', -16.5285, -54.5671, -16.471316, -54.635825); -- CUIABA RONDONÓPOLIS (9.7 km, CNES 7458444)
  perform pg_temp.mover('lmap', '{dsei,10,polos,3,n}', 'TANGARÁ DA SERRA', '{dsei,10,polos,3,lat}', '{dsei,10,polos,3,lon}', -14.06, -58.7614, -14.612862, -57.497034); -- CUIABA TANGARÁ DA SERRA (149.44 km, CNES 7617453)
  perform pg_temp.mover('lmap', '{dsei,11,polos,7,n}', 'ORIXIMINA', '{dsei,11,polos,7,lat}', '{dsei,11,polos,7,lon}', -0.7578, -57.2653, -1.776218, -55.861144); -- GUAMA-TOCANTINS ORIXIMINA (192.85 km, CNES 7436319)
  perform pg_temp.mover('lmap', '{dsei,11,polos,1,n}', 'PARAGOMINAS', '{dsei,11,polos,1,lat}', '{dsei,11,polos,1,lon}', -2.6912, -46.5936, -2.993858, -47.353814); -- GUAMA-TOCANTINS PARAGOMINAS (90.89 km, CNES 5992834)
  perform pg_temp.mover('lmap', '{dsei,13,polos,1,n}', 'JUARA', '{dsei,13,polos,1,lat}', '{dsei,13,polos,1,lon}', -10.9335, -57.4086, -11.250359, -57.513123); -- KAIAPO DO MATO GROSSO JUARA (37.03 km, CNES 5610923)
  perform pg_temp.mover('lmap', '{dsei,14,polos,1,n}', 'OURILÂNDIA', '{dsei,14,polos,1,lat}', '{dsei,14,polos,1,lon}', -7.3536, -51.611, -6.763808, -51.065333); -- KAIAPO DO PARA OURILÂNDIA (89.03 km, CNES 7494548)
  perform pg_temp.mover('lmap', '{dsei,14,polos,2,n}', 'SÃO FÉLIX DO XINGU', '{dsei,14,polos,2,lat}', '{dsei,14,polos,2,lon}', -7.2113, -52.5708, -6.639415, -51.984386); -- KAIAPO DO PARA SÃO FÉLIX DO XINGU (90.74 km, CNES 7504179)
  perform pg_temp.mover('lmap', '{dsei,15,polos,23,n}', 'TRÊS CORAÇÕES', '{dsei,15,polos,23,lat}', '{dsei,15,polos,23,lon}', 3.6414, -60.9452, 3.644708, -60.975828); -- LESTE DE RORAIMA TRÊS CORAÇÕES (3.42 km, CNES 2320649)
  perform pg_temp.mover('lmap', '{dsei,16,polos,3,n}', 'ANGRA DOS REIS', '{dsei,16,polos,3,lat}', '{dsei,16,polos,3,lon}', -22.9063, -44.3863, -23.0158, -44.53614); -- LITORAL SUL ANGRA DOS REIS (19.59 km, CNES 7859228)
  perform pg_temp.mover('lmap', '{dsei,16,polos,14,n}', 'RIO SILVEIRA', '{dsei,16,polos,14,lat}', '{dsei,16,polos,14,lon}', -23.7659, -45.6077, -23.731667, -45.806028); -- LITORAL SUL RIO SILVEIRA (20.54 km, CNES null)
  perform pg_temp.mover('lmap', '{dsei,16,polos,5,n}', 'UBATUBA', '{dsei,16,polos,5,lat}', '{dsei,16,polos,5,lon}', -23.368, -44.9744, -23.434279, -45.08082); -- LITORAL SUL UBATUBA (13.12 km, CNES 7995326)
  perform pg_temp.mover('lmap', '{dsei,17,polos,14,n}', 'ANAMÃ', '{dsei,17,polos,14,lat}', '{dsei,17,polos,14,lon}', -3.662, -61.4787, -3.574458, -61.407437); -- MANAUS ANAMÃ (12.54 km, CNES 7694954)
  perform pg_temp.mover('lmap', '{dsei,17,polos,7,n}', 'KWATÁ', '{dsei,17,polos,7,lat}', '{dsei,17,polos,7,lon}', -4.2462, -59.2241, -4.227694, -59.2755); -- MANAUS KWATÁ (6.06 km, CNES 5359198)
  perform pg_temp.mover('lmap', '{dsei,17,polos,16,n}', 'MANACAPURU', '{dsei,17,polos,16,lat}', '{dsei,17,polos,16,lon}', -3.2316, -61.0048, -3.295764, -60.62464); -- MANAUS MANACAPURU (42.8 km, CNES 6698107)
  perform pg_temp.mover('lmap', '{dsei,17,polos,2,n}', 'URUCARÁ', '{dsei,17,polos,2,lat}', '{dsei,17,polos,2,lon}', -1.5536, -58.5121, -2.535533, -57.761586); -- MANAUS URUCARÁ (137.39 km, CNES 7314507)
  perform pg_temp.mover('lmap', '{dsei,18,polos,0,n}', 'AMARANTE', '{dsei,18,polos,0,lat}', '{dsei,18,polos,0,lon}', -5.2944, -46.6339, -5.566081, -46.743141); -- MARANHAO AMARANTE (32.54 km, CNES 4889738)
  perform pg_temp.mover('lmap', '{dsei,18,polos,4,n}', 'GRAJAÚ', '{dsei,18,polos,4,lat}', '{dsei,18,polos,4,lon}', -5.7851, -45.975, -5.813483, -46.137085); -- MARANHAO GRAJAÚ (18.21 km, CNES 7398050)
  perform pg_temp.mover('lmap', '{dsei,19,polos,7,n}', 'BODOQUENA', '{dsei,19,polos,7,lat}', '{dsei,19,polos,7,lon}', -20.5886, -57.0289, -20.539753, -56.666015); -- MATO GROSSO DO SUL BODOQUENA (38.17 km, CNES 9169997)
  perform pg_temp.mover('lmap', '{dsei,19,polos,2,n}', 'BONITO', '{dsei,19,polos,2,lat}', '{dsei,19,polos,2,lon}', -20.8824, -57.1465, -21.127619, -56.492686); -- MATO GROSSO DO SUL BONITO (73.14 km, CNES 7704046)
  perform pg_temp.mover('lmap', '{dsei,19,polos,4,n}', 'CAARAPÓ', '{dsei,19,polos,4,lat}', '{dsei,19,polos,4,lon}', -22.9228, -54.6075, -22.62944, -54.827067); -- MATO GROSSO DO SUL CAARAPÓ (39.63 km, CNES 6825486)
  perform pg_temp.mover('lmap', '{dsei,19,polos,5,n}', 'PARANHOS', '{dsei,19,polos,5,lat}', '{dsei,19,polos,5,lon}', -23.9307, -55.4006, -23.886701, -55.428622); -- MATO GROSSO DO SUL PARANHOS (5.66 km, CNES 6679900)
  perform pg_temp.mover('lmap', '{dsei,20,polos,5,n}', 'CRISPIM', '{dsei,20,polos,5,lat}', '{dsei,20,polos,5,lon}', -7.4331, -65.2778, -7.511111, -65.265); -- MEDIO RIO PURUS CRISPIM (8.79 km, CNES 9425578)
  perform pg_temp.mover('lmap', '{dsei,21,polos,10,n}', 'CARAUARÍ', '{dsei,21,polos,10,lat}', '{dsei,21,polos,10,lon}', -5.2074, -67.0091, -4.883, -66.896); -- MEDIO RIO SOLIMOES E AFLUENTES CARAUARÍ (38.19 km, CNES 7507844)
  perform pg_temp.mover('lmap', '{dsei,22,polos,13,n}', 'SUMARÉ III', '{dsei,22,polos,13,lat}', '{dsei,22,polos,13,lon}', -14.9608, -44.3628, -14.956522, -44.295136); -- MINAS GERAIS E ESPIRITO SANTO SUMARÉ III (7.28 km, CNES 6796494)
  perform pg_temp.mover('lmap', '{dsei,25,polos,4,n}', 'ALTA FLORESTA', '{dsei,25,polos,4,lat}', '{dsei,25,polos,4,lon}', -12.2334, -62.6277, -11.934917, -62.001987); -- PORTO VELHO ALTA FLORESTA (75.7 km, CNES 7633610)
  perform pg_temp.mover('lmap', '{dsei,25,polos,0,n}', 'GUAJARÁ MIRIM', '{dsei,25,polos,0,lat}', '{dsei,25,polos,0,lon}', -11.0786, -64.8603, -10.777662, -65.319643); -- PORTO VELHO GUAJARÁ MIRIM (60.29 km, CNES 7332963)
  perform pg_temp.mover('lmap', '{dsei,25,polos,3,n}', 'JI-PARANÁ', '{dsei,25,polos,3,lat}', '{dsei,25,polos,3,lon}', -10.7141, -60.7396, -10.88797, -61.914697); -- PORTO VELHO JI-PARANÁ (129.8 km, CNES 7638205)
  perform pg_temp.mover('lmap', '{dsei,25,polos,5,n}', 'POLO BASE DE JARU', '{dsei,25,polos,5,lat}', '{dsei,25,polos,5,lon}', -11.0689, -62.9507, -10.443754, -62.464399); -- PORTO VELHO POLO BASE DE JARU (87.49 km, CNES 7923937)
  perform pg_temp.mover('lmap', '{dsei,25,polos,1,n}', 'PORTO VELHO', '{dsei,25,polos,1,lat}', '{dsei,25,polos,1,lon}', -9.3206, -64.0972, -8.750882, -63.854438); -- PORTO VELHO PORTO VELHO (68.73 km, CNES 7633238)
  perform pg_temp.mover('lmap', '{dsei,26,polos,3,n}', 'JOÃO CÂMARA', '{dsei,26,polos,3,lat}', '{dsei,26,polos,3,lon}', -5.514, -35.9042, -5.532221, -35.812127); -- POTIGUARA JOÃO CÂMARA (10.39 km, CNES 4816196)
  perform pg_temp.mover('lmap', '{dsei,26,polos,2,n}', 'RIO TINTO', '{dsei,26,polos,2,lat}', '{dsei,26,polos,2,lon}', -6.6888, -35.0553, -6.788311, -35.065958); -- POTIGUARA RIO TINTO (11.13 km, CNES 7358237)
  perform pg_temp.mover('lmap', '{dsei,27,polos,0,n}', 'NOVO PROGRESSO', '{dsei,27,polos,0,lat}', '{dsei,27,polos,0,lon}', -8.293, -54.652, -7.034054, -55.416284); -- RIO TAPAJOS NOVO PROGRESSO (163.37 km, CNES 7708343)
  perform pg_temp.mover('lmap', '{dsei,28,polos,2,n}', 'FORMOSO DO ARAGUAIA', '{dsei,28,polos,2,lat}', '{dsei,28,polos,2,lon}', -12.1092, -50.0592, -11.797134, -49.53081); -- TOCANTINS FORMOSO DO ARAGUAIA (67.14 km, CNES 7395701)
  perform pg_temp.mover('lmap', '{dsei,28,polos,4,n}', 'ITACAJÁ', '{dsei,28,polos,4,lat}', '{dsei,28,polos,4,lon}', -8.4975, -47.6469, -8.391658, -47.771138); -- TOCANTINS ITACAJÁ (18.03 km, CNES 7393539)
  perform pg_temp.mover('lmap', '{dsei,28,polos,3,n}', 'TOCANTINÓPOLIS', '{dsei,28,polos,3,lat}', '{dsei,28,polos,3,lon}', -6.3271, -47.5544, -6.324085, -47.436304); -- TOCANTINS TOCANTINÓPOLIS (13.06 km, CNES 7395620)
  perform pg_temp.mover('lmap', '{dsei,30,polos,3,n}', 'CACOAL', '{dsei,30,polos,3,lat}', '{dsei,30,polos,3,lon}', -11.0752, -61.3611, -11.440636, -61.434968); -- VILHENA CACOAL (41.43 km, CNES 7488920)
  perform pg_temp.mover('lmap', '{dsei,31,polos,5,n}', 'ÁGUA BOA', '{dsei,31,polos,5,lat}', '{dsei,31,polos,5,lon}', -14.2295, -52.018, -14.054831, -52.157282); -- XAVANTE ÁGUA BOA (24.55 km, CNES 7227302)
  perform pg_temp.mover('lmap', '{dsei,31,polos,0,n}', 'MARÃIWATSEDE', '{dsei,31,polos,0,lat}', '{dsei,31,polos,0,lon}', -11.7134, -51.684, -11.790639, -51.678028); -- XAVANTE MARÃIWATSEDE (8.61 km, CNES 4521110)
  perform pg_temp.mover('lmap', '{dsei,31,polos,1,n}', 'SANGRADOURO', '{dsei,31,polos,1,lat}', '{dsei,31,polos,1,lon}', -15.4179, -53.8679, -15.65112, -53.90872); -- XAVANTE SANGRADOURO (26.3 km, CNES 7342039)
  perform pg_temp.mover('lmap', '{dsei,32,polos,3,n}', 'DIAUARUM', '{dsei,32,polos,3,lat}', '{dsei,32,polos,3,lon}', -11.208, -53.3546, -11.199078, -53.235272); -- XINGU DIAUARUM (13.05 km, CNES 7714920)
  perform pg_temp.mover('lmap', '{dsei,32,polos,1,n}', 'LEONARDO', '{dsei,32,polos,1,lat}', '{dsei,32,polos,1,lon}', -12.7854, -53.3917, -12.200342, -53.378506); -- XINGU LEONARDO (65.07 km, CNES 944165)
  perform pg_temp.mover('lmap', '{dsei,33,polos,26,n}', 'ALTO MUCAJAI', '{dsei,33,polos,26,lat}', '{dsei,33,polos,26,lon}', 3.0779, -62.6675, 2.766036, -62.220194); -- YANOMAMI ALTO MUCAJAI (60.58 km, CNES 6856500)
  perform pg_temp.mover('lmap', '{dsei,33,polos,2,n}', 'ARATHA-U', '{dsei,33,polos,2,lat}', '{dsei,33,polos,2,lon}', 3.3057, -63.7907, 3.1589, -63.779086); -- YANOMAMI ARATHA-U (16.37 km, CNES null)
  perform pg_temp.mover('lmap', '{dsei,33,polos,30,n}', 'HAKOMA', '{dsei,33,polos,30,lat}', '{dsei,33,polos,30,lon}', 3.0779, -62.6675, 2.719358, -63.574908); -- YANOMAMI HAKOMA (108.37 km, CNES 6856586)
  perform pg_temp.mover('lmap', '{dsei,33,polos,8,n}', 'MARAUIÁ', '{dsei,33,polos,8,lat}', '{dsei,33,polos,8,lon}', 0.5725, -65.0728, 0.454361, -65.070863); -- YANOMAMI MARAUIÁ (13.14 km, CNES 9681760)
  perform pg_temp.mover('lmap', '{dsei,33,polos,13,n}', 'SURUCUCU', '{dsei,33,polos,13,lat}', '{dsei,33,polos,13,lon}', 2.8004, -63.6971, 2.836686, -63.641794); -- YANOMAMI SURUCUCU (7.35 km, CNES 6934404)
  perform pg_temp.mover('lmap', '{dsei,33,polos,35,n}', 'URARICOERA', '{dsei,33,polos,35,lat}', '{dsei,33,polos,35,lon}', 3.0779, -62.6675, 3.145928, -62.230303); -- YANOMAMI URARICOERA (49.13 km, CNES 6856373)
  perform pg_temp.mover('lmap', '{dsei,33,polos,36,n}', 'XITEI', '{dsei,33,polos,36,lat}', '{dsei,33,polos,36,lon}', 3.0779, -62.6675, 2.606844, -63.872783); -- YANOMAMI XITEI (143.74 km, CNES 6554350)
end $$;

commit;
