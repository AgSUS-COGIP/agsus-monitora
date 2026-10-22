/*
  Coordenadas do mapa da Saúde Indígena: 62 correções de confiança alta da
  auditoria contra fontes oficiais de 01/10/2026 (CNES dados abertos, Funai
  aldeias_pontos, malhas IBGE). 60 polos base do lmap (16 deles empilhados num
  mesmo ponto do Alto Rio Negro), a CASAI Nacional Brasília (lmap.casai) e a
  CASAI Porto Velho (rede_cnes). Ficaram de fora, para revisão com a área: os
  46 polos de confiança média e 21 itens em que o ponto atual está sobre uma
  aldeia Funai ou em outra terra indígena.

  Backup antes: chaves lmap_backup_20261001_pre_auditoria_oficial e
  rede_cnes_backup_20261001_pre_auditoria_oficial. Cada item só muda se o nome e
  a coordenada atuais forem os auditados; senão a transação inteira falha.
  Desfazer: copiar o payload das chaves de backup de volta para lmap/rede_cnes.
*/
begin;

insert into public."TB_CONFIG_MAPA_SAUDE_INDIG" (chave, payload, descricao, updated_at)
select chave || '_backup_20261001_pre_auditoria_oficial', payload,
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
  perform pg_temp.mover('lmap', '{dsei,3,polos,19,n}', 'TAPERERA', '{dsei,3,polos,19,lat}', '{dsei,3,polos,19,lon}', 0.3318, -68.0903, -0.222433, -66.171716); -- ALTO RIO NEGRO TAPERERA (222.06 km, CNES 7620233)
  perform pg_temp.mover('lmap', '{dsei,3,polos,0,n}', 'BALAIO', '{dsei,3,polos,0,lat}', '{dsei,3,polos,0,lon}', 0.3318, -68.0903, 0.23185, -66.385865); -- ALTO RIO NEGRO BALAIO (189.85 km, CNES 9493263)
  perform pg_temp.mover('lmap', '{dsei,5,polos,11,n}', 'VILA BITENCOURT', '{dsei,5,polos,11,lat}', '{dsei,5,polos,11,lon}', -1.547, -68.3189, -1.834403, -67.203369); -- ALTO RIO SOLIMOES VILA BITENCOURT (128.04 km, CNES 5244714)
  perform pg_temp.mover('lmap', '{dsei,3,polos,23,n}', 'VILA NOVA', '{dsei,3,polos,23,lat}', '{dsei,3,polos,23,lon}', 0.3318, -68.0903, 0.574767, -67.109687); -- ALTO RIO NEGRO VILA NOVA (112.33 km, CNES 7620160)
  perform pg_temp.mover('lmap', '{dsei,3,polos,21,n}', 'TUCUMÃ', '{dsei,3,polos,21,lat}', '{dsei,3,polos,21,lon}', 0.3318, -68.0903, 1.292298, -68.384272); -- ALTO RIO NEGRO TUCUMÃ (111.69 km, CNES 9523006)
  perform pg_temp.mover('lmap', '{dsei,2,polos,5,n}', 'FEIJÓ', '{dsei,2,polos,5,lat}', '{dsei,2,polos,5,lon}', -9.114, -70.6086, -8.160772, -70.353398); -- ALTO RIO JURUA FEIJÓ (109.64 km, CNES 6748759)
  perform pg_temp.mover('lmap', '{dsei,3,polos,8,n}', 'ILHA DAS FLORES', '{dsei,3,polos,8,lat}', '{dsei,3,polos,8,lon}', 0.3318, -68.0903, 0.014419, -67.161493); -- ALTO RIO NEGRO ILHA DAS FLORES (109.14 km, CNES 7620152)
  perform pg_temp.mover('lmap', '{dsei,21,polos,13,n}', 'COARI', '{dsei,21,polos,13,lat}', '{dsei,21,polos,13,lon}', -3.9678, -64.1191, -4.082856, -63.142757); -- MEDIO RIO SOLIMOES E AFLUENTES COARI (109.05 km, CNES 7418442)
  perform pg_temp.mover('lmap', '{dsei,19,polos,0,n}', 'ANTÔNIO JOÃO', '{dsei,19,polos,0,lat}', '{dsei,19,polos,0,lon}', -21.2357, -56.0635, -22.194061, -55.942919); -- MATO GROSSO DO SUL ANTÔNIO JOÃO (107.29 km, CNES 6371515)
  perform pg_temp.mover('lmap', '{dsei,3,polos,9,n}', 'JURUTI', '{dsei,3,polos,9,lat}', '{dsei,3,polos,9,lon}', 0.3318, -68.0903, 0.373481, -67.145572); -- ALTO RIO NEGRO JURUTI (105.15 km, CNES 7620217)
  perform pg_temp.mover('lmap', '{dsei,33,polos,34,n}', 'TOOTOTOBI', '{dsei,33,polos,34,lat}', '{dsei,33,polos,34,lon}', -0.3707, -63.5372, 0.517337, -63.486471); -- YANOMAMI TOOTOTOBI (98.91 km, CNES 7779623)
  perform pg_temp.mover('lmap', '{dsei,3,polos,22,n}', 'TUNUÍ-CACHOEIRA', '{dsei,3,polos,22,lat}', '{dsei,3,polos,22,lon}', 0.3318, -68.0903, 1.10955, -67.994385); -- ALTO RIO NEGRO TUNUÍ-CACHOEIRA (87.14 km, CNES 7620187)
  perform pg_temp.mover('lmap', '{dsei,33,polos,28,n}', 'ARACÁ', '{dsei,33,polos,28,lat}', '{dsei,33,polos,28,lon}', -0.3707, -63.5372, -0.395505, -62.759399); -- YANOMAMI ARACÁ (86.53 km, CNES 7779569)
  perform pg_temp.mover('lmap', '{dsei,3,polos,3,n}', 'CARURU - TIQUIÉ', '{dsei,3,polos,3,lat}', '{dsei,3,polos,3,lon}', 0.3318, -68.0903, -0.021973, -67.461548); -- ALTO RIO NEGRO CARURU - TIQUIÉ (80.22 km, CNES 7620241)
  perform pg_temp.mover('lmap', '{dsei,21,polos,9,n}', 'BIÁ', '{dsei,21,polos,9,lat}', '{dsei,21,polos,9,lon}', -3.342, -67.4383, -2.840175, -66.926651); -- MEDIO RIO SOLIMOES E AFLUENTES BIÁ (79.63 km, CNES 7340923)
  perform pg_temp.mover('lmap', '{dsei,3,polos,1,n}', 'CAMARÃO', '{dsei,3,polos,1,lat}', '{dsei,3,polos,1,lon}', 0.3318, -68.0903, 0.621767, -67.448062); -- ALTO RIO NEGRO CAMARÃO (78.35 km, CNES 7620144)
  perform pg_temp.mover('lmap', '{dsei,21,polos,7,n}', 'MORADA NOVA', '{dsei,21,polos,7,lat}', '{dsei,21,polos,7,lon}', -6.4562, -68.4289, -6.285233, -67.887493); -- MEDIO RIO SOLIMOES E AFLUENTES MORADA NOVA (62.78 km, CNES 9239774)
  perform pg_temp.mover('lmap', '{dsei,11,polos,0,n}', 'SANTARÉM', '{dsei,11,polos,0,lat}', '{dsei,11,polos,0,lon}', -2.6717, -55.2194, -2.432419, -54.710412); -- GUAMA-TOCANTINS SANTARÉM (62.49 km, CNES 7801653)
  perform pg_temp.mover('lmap', '{dsei,30,polos,0,n}', 'VILHENA', '{dsei,30,polos,0,lat}', '{dsei,30,polos,0,lon}', -13.1073, -60.5498, -12.745759, -60.147527); -- VILHENA VILHENA (59.3 km, CNES 7534256)
  perform pg_temp.mover('lmap', '{dsei,3,polos,11,n}', 'MASSARABÍ', '{dsei,3,polos,11,lat}', '{dsei,3,polos,11,lon}', -0.1813, -65.4909, -0.341293, -65.984445); -- ALTO RIO NEGRO MASSARABÍ (57.69 km, CNES 3818705)
  perform pg_temp.mover('lmap', '{dsei,20,polos,2,n}', 'ABAQUADI', '{dsei,20,polos,2,lat}', '{dsei,20,polos,2,lon}', -5.9496, -65.0257, -5.869867, -64.518538); -- MEDIO RIO PURUS ABAQUADI (56.79 km, CNES 9472851)
  perform pg_temp.mover('lmap', '{dsei,16,polos,7,n}', 'LONDRINA', '{dsei,16,polos,7,lat}', '{dsei,16,polos,7,lon}', -23.7499, -50.8897, -23.311892, -51.164017); -- LITORAL SUL LONDRINA (56.16 km, CNES 7983468)
  perform pg_temp.mover('lmap', '{dsei,21,polos,14,n}', 'UARINI', '{dsei,21,polos,14,lat}', '{dsei,21,polos,14,lon}', -3.1246, -65.4085, -2.871722, -65.00061); -- MEDIO RIO SOLIMOES E AFLUENTES UARINI (53.31 km, CNES 7356188)
  perform pg_temp.mover('lmap', '{dsei,17,polos,11,n}', 'PONTA NATAL', '{dsei,17,polos,11,lat}', '{dsei,17,polos,11,lon}', -5.6083, -60.9423, -5.809, -61.3); -- MANAUS PONTA NATAL (45.44 km, CNES 9423397)
  perform pg_temp.mover('lmap', '{dsei,10,polos,2,n}', 'CUIABÁ', '{dsei,10,polos,2,lat}', '{dsei,10,polos,2,lon}', -15.74029, -56.058975, -15.354941, -56.061801); -- CUIABA CUIABÁ (42.85 km, CNES 7427018)
  perform pg_temp.mover('lmap', '{dsei,12,polos,2,n}', 'PASSO FUNDO', '{dsei,12,polos,2,lat}', '{dsei,12,polos,2,lon}', -28.1842, -51.9693, -28.25593, -52.398348); -- INTERIOR SUL PASSO FUNDO (42.79 km, CNES 7929153)
  perform pg_temp.mover('lmap', '{dsei,20,polos,4,n}', 'JAPIIM', '{dsei,20,polos,4,lat}', '{dsei,20,polos,4,lon}', -7.717, -64.6153, -7.465964, -64.868774); -- MEDIO RIO PURUS JAPIIM (39.49 km, CNES 4206991)
  perform pg_temp.mover('lmap', '{dsei,3,polos,20,n}', 'TARACUÁ', '{dsei,3,polos,20,lat}', '{dsei,3,polos,20,lon}', 0.3318, -68.0903, 0.075821, -68.326201); -- ALTO RIO NEGRO TARACUÁ (38.71 km, CNES 9523022)
  perform pg_temp.mover('lmap', '{dsei,2,polos,2,n}', 'MARECHAL THAUMATURGO', '{dsei,2,polos,2,lat}', '{dsei,2,polos,2,lon}', -9.1449, -72.5727, -8.945402, -72.78765); -- ALTO RIO JURUA MARECHAL THAUMATURGO (32.39 km, CNES 7625855)
  perform pg_temp.mover('lmap', '{dsei,24,polos,10,n}', 'PIPIPAN', '{dsei,24,polos,10,lat}', '{dsei,24,polos,10,lon}', -8.5632, -38.3076, -8.595107, -38.573434); -- PERNAMBUCO PIPIPAN (29.44 km, CNES 7397615)
  perform pg_temp.mover('lmap', '{dsei,30,polos,2,n}', 'ARIPUANÃ', '{dsei,30,polos,2,lat}', '{dsei,30,polos,2,lon}', -9.9833, -59.6414, -10.169812, -59.457321); -- VILHENA ARIPUANÃ (28.92 km, CNES 7497725)
  perform pg_temp.mover('lmap', '{dsei,3,polos,2,n}', 'CANADÁ', '{dsei,3,polos,2,lat}', '{dsei,3,polos,2,lon}', 0.3318, -68.0903, 0.241699, -67.851563); -- ALTO RIO NEGRO CANADÁ (28.37 km, CNES 9493360)
  perform pg_temp.mover('lmap', '{dsei,15,polos,1,n}', 'MILHO', '{dsei,15,polos,1,lat}', '{dsei,15,polos,1,lon}', 3.4413, -60.4131, 3.20222, -60.501709); -- LESTE DE RORAIMA MILHO (28.35 km, CNES 2319829)
  perform pg_temp.mover('lmap', '{dsei,18,polos,3,n}', 'ARAME', '{dsei,18,polos,3,lat}', '{dsei,18,polos,3,lon}', -5.0984, -46.1471, -4.889333, -46.010925); -- MARANHAO ARAME (27.71 km, CNES 7514077)
  perform pg_temp.mover('lmap', '{dsei,17,polos,13,n}', 'BEIJA FLOR', '{dsei,17,polos,13,lat}', '{dsei,17,polos,13,lon}', -2.7956, -59.4847, -2.695591, -59.700952); -- MANAUS BEIJA FLOR (26.47 km, CNES 7919557)
  perform pg_temp.mover('lmap', '{dsei,12,polos,8,n}', 'GUARITA', '{dsei,12,polos,8,lat}', '{dsei,12,polos,8,lon}', -27.5651, -53.6117, -27.37335, -53.75708); -- INTERIOR SUL GUARITA (25.7 km, CNES 7941765)
  perform pg_temp.mover('lmap', '{dsei,17,polos,6,n}', 'NOSSA SENHORA DA SAÚDE', '{dsei,17,polos,6,lat}', '{dsei,17,polos,6,lon}', -2.869, -60.2732, -2.784753, -60.451786); -- MANAUS NOSSA SENHORA DA SAÚDE (21.93 km, CNES 7132034)
  perform pg_temp.mover('lmap', '{casai,0,n}', null, '{casai,0,lat}', '{casai,0,lon}', -15.7939, -47.8828, -15.750355, -47.715662); --  CASAI Nacional Brasília (18.53 km, CNES 7898215)
  perform pg_temp.mover('lmap', '{dsei,12,polos,11,n}', 'VIAMÃO', '{dsei,12,polos,11,lat}', '{dsei,12,polos,11,lon}', -30.1932, -50.9196, -30.092431, -51.070401); -- INTERIOR SUL VIAMÃO (18.33 km, CNES 4468228)
  perform pg_temp.mover('lmap', '{dsei,3,polos,4,n}', 'CARURU - UAUPÉS', '{dsei,3,polos,4,lat}', '{dsei,3,polos,4,lon}', 0.3318, -68.0903, 0.302123, -67.93396); -- ALTO RIO NEGRO CARURU - UAUPÉS (17.69 km, CNES 9493417)
  perform pg_temp.mover('lmap', '{dsei,27,polos,1,n}', 'SAI CINZA', '{dsei,27,polos,1,lat}', '{dsei,27,polos,1,lon}', -6.4477, -57.7766, -6.590102, -57.713138); -- RIO TAPAJOS SAI CINZA (17.32 km, CNES 7588755)
  perform pg_temp.mover('lmap', '{dsei,19,polos,10,n}', 'AQUIDAUANA', '{dsei,19,polos,10,lat}', '{dsei,19,polos,10,lon}', -20.3254, -55.7751, -20.476135, -55.798278); -- MATO GROSSO DO SUL AQUIDAUANA (16.93 km, CNES 7006519)
  perform pg_temp.mover('lmap', '{dsei,19,polos,6,n}', 'TACURU', '{dsei,19,polos,6,lat}', '{dsei,19,polos,6,lon}', -23.6591, -54.8596, -23.633, -55.016); -- MATO GROSSO DO SUL TACURU (16.19 km, CNES 6889158)
  perform pg_temp.mover('lmap', '{dsei,4,polos,0,n}', 'BOCA DO ACRE', '{dsei,4,polos,0,lat}', '{dsei,4,polos,0,lon}', -8.7599, -67.474, -8.775419, -67.330163); -- ALTO RIO PURUS BOCA DO ACRE (15.9 km, CNES 7299761)
  perform pg_temp.mover('lmap', '{dsei,6,polos,2,n}', 'ARAMIRÃ', '{dsei,6,polos,2,lat}', '{dsei,6,polos,2,lon}', 1.1482, -52.7133, 1.113411, -52.58091); -- AMAPA E NORTE DO PARA ARAMIRÃ (15.22 km, CNES 2021412)
  perform pg_temp.mover('lmap', '{dsei,17,polos,3,n}', 'MANAQUIRI', '{dsei,17,polos,3,lat}', '{dsei,17,polos,3,lon}', -3.5576, -60.4998, -3.433357, -60.45834); -- MANAUS MANAQUIRI (14.56 km, CNES 9003452)
  perform pg_temp.mover('lmap', '{dsei,15,polos,17,n}', 'CAMPO FORMOSO', '{dsei,15,polos,17,lat}', '{dsei,15,polos,17,lon}', 4.611, -60.8424, 4.721756, -60.774194); -- LESTE DE RORAIMA CAMPO FORMOSO (14.45 km, CNES 7459211)
  perform pg_temp.mover('lmap', '{dsei,15,polos,27,n}', 'ROÇA', '{dsei,15,polos,27,lat}', '{dsei,15,polos,27,lon}', 3.8928, -60.582, 3.791628, -60.513314); -- LESTE DE RORAIMA ROÇA (13.59 km, CNES 4243838)
  perform pg_temp.mover('lmap', '{dsei,15,polos,26,n}', 'VISTA ALEGRE', '{dsei,15,polos,26,lat}', '{dsei,15,polos,26,lon}', 3.2008, -60.5219, 3.113091, -60.441284); -- LESTE DE RORAIMA VISTA ALEGRE (13.24 km, CNES 2319802)
  perform pg_temp.mover('lmap', '{dsei,24,polos,8,n}', 'KAMBIWÁ-TUXÁ', '{dsei,24,polos,8,lat}', '{dsei,24,polos,8,lon}', -8.7982, -37.8126, -8.9044, -37.825517); -- PERNAMBUCO KAMBIWÁ-TUXÁ (11.89 km, CNES 7374534)
  perform pg_temp.mover('lmap', '{dsei,25,polos,2,n}', 'HUMAITÁ', '{dsei,25,polos,2,lat}', '{dsei,25,polos,2,lon}', -7.4295, -63.1204, -7.507833, -63.047619); -- PORTO VELHO HUMAITÁ (11.84 km, CNES 7907893)
  perform pg_temp.mover('lmap', '{dsei,8,polos,6,n}', 'EUCLIDES DA CUNHA', '{dsei,8,polos,6,lat}', '{dsei,8,polos,6,lon}', -10.4591, -38.927, -10.503553, -39.023534); -- BAHIA EUCLIDES DA CUNHA (11.66 km, CNES 890030)
  perform pg_temp.mover('lmap', '{dsei,12,polos,5,n}', 'BARRA DO RIBEIRO', '{dsei,12,polos,5,lat}', '{dsei,12,polos,5,lon}', -30.3569, -51.3595, -30.416777, -51.454897); -- INTERIOR SUL BARRA DO RIBEIRO (11.32 km, CNES 6177743)
  perform pg_temp.mover('lmap', '{dsei,12,polos,7,n}', 'FLORIANÓPOLIS', '{dsei,12,polos,7,lat}', '{dsei,12,polos,7,lon}', -27.4298, -48.6999, -27.515827, -48.645792); -- INTERIOR SUL FLORIANÓPOLIS (10.95 km, CNES 312657)
  perform pg_temp.mover('lmap', '{dsei,21,polos,6,n}', 'EIRUNEPÉ', '{dsei,21,polos,6,lat}', '{dsei,21,polos,6,lon}', -6.7912, -69.8748, -6.702926, -69.831805); -- MEDIO RIO SOLIMOES E AFLUENTES EIRUNEPÉ (10.9 km, CNES 7420528)
  perform pg_temp.mover('lmap', '{dsei,7,polos,0,n}', 'SANTA TEREZINHA', '{dsei,7,polos,0,lat}', '{dsei,7,polos,0,lon}', -10.566, -50.5433, -10.47617, -50.508518); -- ARAGUAIA SANTA TEREZINHA (10.69 km, CNES 7691483)
  perform pg_temp.mover('lmap', '{dsei,27,polos,7,n}', 'MISSÃO CURURU', '{dsei,27,polos,7,lat}', '{dsei,27,polos,7,lon}', -7.6082, -57.6829, -7.612447, -57.590611); -- RIO TAPAJOS MISSÃO CURURU (10.18 km, CNES 7921802)
  perform pg_temp.mover('lmap', '{dsei,19,polos,14,n}', 'SIDROLÂNDIA', '{dsei,19,polos,14,lat}', '{dsei,19,polos,14,lon}', -20.9358, -55.0427, -20.922501, -54.954901); -- MATO GROSSO DO SUL SIDROLÂNDIA (9.24 km, CNES 6982573)
  perform pg_temp.mover('lmap', '{dsei,21,polos,0,n}', 'MUCURA', '{dsei,21,polos,0,lat}', '{dsei,21,polos,0,lon}', -2.5049, -65.9894, -2.497375, -66.068966); -- MEDIO RIO SOLIMOES E AFLUENTES MUCURA (8.88 km, CNES 7669666)
  perform pg_temp.mover('lmap', '{dsei,21,polos,2,n}', 'BUÁ-BUÁ', '{dsei,21,polos,2,lat}', '{dsei,21,polos,2,lon}', -1.8125, -66.9693, -1.774352, -66.906052); -- MEDIO RIO SOLIMOES E AFLUENTES BUÁ-BUÁ (8.21 km, CNES 7671660)
  perform pg_temp.mover('rede_cnes', '{rede,PORTO VELHO,c,5,0}', 'CASA DE APOIO A SAUDE INDIGENA CASAI PORTO VELHO', '{rede,PORTO VELHO,c,5,2}', '{rede,PORTO VELHO,c,5,3}', -8.74977, -63.846772, -8.785444, -63.898623); -- PORTO VELHO CASA DE APOIO A SAUDE INDIGENA CASAI PORTO VELHO (6.94 km, CNES 7260792)
  perform pg_temp.mover('lmap', '{dsei,17,polos,12,n}', 'CAREIRO CASTANHO', '{dsei,17,polos,12,lat}', '{dsei,17,polos,12,lon}', -3.8151, -60.4284, -3.820429, -60.367384); -- MANAUS CAREIRO CASTANHO (6.8 km, CNES 7323158)
end $$;

commit;
