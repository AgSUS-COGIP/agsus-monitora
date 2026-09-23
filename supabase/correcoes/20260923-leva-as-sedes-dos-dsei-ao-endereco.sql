-- ---------------------------------------------------------------------------
-- A ESTRELA DA SEDE NO ENDEREÇO DA SEDE
--
-- Gerado por `scripts/localizar-sedes-dos-dsei.mjs`. O relatório completo, com
-- as duas fontes de cada DSEI, está em `docs/sedes-dos-dsei.md`.
--
-- Em 32 dos 34 DSEIs a coordenada da sede era o ponto de referência da cidade.
-- Cada sede passou por duas fontes: o CNES da própria sede (tipo 72) e o
-- endereço dele geocodificado no OpenStreetMap, e nenhum ponto novo é aceite
-- fora do município da sede (malha do IBGE, qualidade máxima).
--
-- MUDAM (33) — distância do ponto antigo ao novo:
--
--   Alagoas e Sergipe                Maceió                       7.67 km  o CNES estava ao lado da rua do endereço; encaixado nela
--   Altamira                         Altamira                     1.48 km  o CNES não tem coordenada; vale o endereço
--   Alto Rio Juruá                   Cruzeiro do Sul              1.07 km  só o CNES (a rua não existe no OpenStreetMap)
--   Alto Rio Negro                   São Gabriel da Cachoeira     1.13 km  o ponto do CNES está na rua do endereço
--   Alto Rio Purus                   Rio Branco                   1.83 km  CNES e número de porta concordam
--   Alto Rio Solimões                Tabatinga                    2.61 km  o CNES estava ao lado da rua do endereço; encaixado nela
--   Amapá e Norte do Pará            Macapá                       0.88 km  o número de porta, no bairro declarado, desmente o ponto do CNES
--   Araguaia                         São Félix do Araguaia        0.71 km  só o CNES (a rua não existe no OpenStreetMap)
--   Bahia                            Salvador                     5.41 km  o ponto do CNES está na rua do endereço
--   Ceará                            Fortaleza                    3.07 km  CNES e número de porta concordam
--   Cuiabá                           Cuiabá                       1.12 km  o ponto do CNES está longe da rua do endereço; vale a rua, no bairro declarado
--   Guamá-Tocantins                  Belém                        0.47 km  o número de porta, rotulado no bairro vizinho, confirma o CNES
--   Interior Sul                     São José                     0.50 km  o ponto do CNES está na rua do endereço
--   Kaiapó do Pará                   Redenção                     1.65 km  o ponto do CNES está na rua do endereço
--   Leste de Roraima                 Boa Vista                    0.00 km  o ponto do CNES está na rua do endereço
--   Litoral Sul                      Curitiba                     4.37 km  o ponto do CNES está na rua do endereço
--   Manaus                           Manaus                       2.99 km  o CNES estava ao lado da rua do endereço; encaixado nela
--   Maranhão                         São Luís                     4.70 km  o ponto do CNES cai fora do município; vale o endereço
--   Mato Grosso do Sul               Campo Grande                 2.81 km  o ponto do CNES está na rua do endereço
--   Médio Rio Purus                  Lábrea                       0.28 km  o ponto do CNES está na rua do endereço
--   Médio Rio Solimões e Afluentes   Tefé                         2.73 km  o ponto do CNES está na rua do endereço
--   Minas Gerais e Espírito Santo    Governador Valadares         2.14 km  o ponto do CNES está na rua do endereço
--   Parintins                        Parintins                    0.77 km  só o CNES (a rua não existe no OpenStreetMap)
--   Pernambuco                       Recife                       2.62 km  o ponto do CNES está na rua do endereço
--   Porto Velho                      Porto Velho                  1.86 km  o ponto do CNES está na rua do endereço
--   Potiguara                        João Pessoa                  0.92 km  o ponto do CNES está na rua do endereço
--   Rio Tapajós                      Itaituba                     1.50 km  o ponto do CNES está na rua do endereço
--   Tocantins                        Palmas                       2.31 km  só o CNES (a rua não existe no OpenStreetMap)
--   Vale do Javari                   Atalaia do Norte             0.28 km  o ponto do CNES está na rua do endereço
--   Vilhena                          Cacoal                       0.67 km  o CNES estava ao lado da rua do endereço; encaixado nela
--   Xavante                          Barra do Garças              0.74 km  o ponto do CNES está na rua do endereço
--   Xingu                            Canarana                     0.68 km  o ponto do CNES está na rua do endereço
--   Yanomami                         Boa Vista                    0.00 km  o ponto do CNES está na rua do endereço
--
-- FICAM COMO ESTÃO (1):
--
--   Kaiapó de Mato Grosso            nenhuma fonte confirma
--
-- Além da coordenada, grava `sede_endereco`, `sede_municipio`, `sede_fonte` e
-- `sede_cnes`: o popup da estrela passa a dizer onde a sede fica.
--
-- COMO APLICAR
--
-- 1. Correr a CONFERÊNCIA. Não altera nada. Esperado: 33 linhas.
-- 2. Correr a CORREÇÃO. Só escreve onde a coordenada atual for a de antes.
-- 3. Repetir a CONFERÊNCIA: atual deve passar a ser igual a nova.
--
-- PARA DESFAZER
--
-- Os VALUES guardam de onde cada sede veio (de_lat, de_lon). No bloco da
-- CORREÇÃO, trocar `c.lat`/`c.lon` por `c.de_lat`/`c.de_lon`, e a guarda
-- para comparar com `c.lat`/`c.lon`.
-- ---------------------------------------------------------------------------

-- ============================ 1. CONFERÊNCIA ===============================

with correcao(k, lat, lon, de_lat, de_lon, endereco, municipio, fonte, cnes) as (values
    ('ALAGOAS E SERGIPE', -9.595223, -35.751669, -9.6498, -35.7089, 'AVENIDA DURVAL DE GOES MONTEIRO, 6001 — PETROPOLIS', 'Maceió', 'cnes_encaixado_na_rua_declarada', '7748396'),
    ('ALTAMIRA', -3.191381, -52.214129, -3.2039, -52.2096, 'RUA HORACIO BOANERGES, 1336 — BRASILIA', 'Altamira', 'cnes_sem_coordenada', '7444699'),
    ('ALTO RIO JURUA', -7.626460, -72.679324, -7.6308, -72.6707, 'RUA AFONSO PENA, 1830 — 25 DE AGOSTO', 'Cruzeiro do Sul', 'fonte_unica_cnes', '7036302'),
    ('ALTO RIO NEGRO', -0.135333, -67.080395, -0.1303, -67.0892, 'AV 7 DE SETEMBRO, 500 — PRAIA', 'São Gabriel da Cachoeira', 'cnes_na_rua_declarada', '9229280'),
    ('ALTO RIO PURUS', -9.972830, -67.826600, -9.9747, -67.81, 'RUA RIO DE JANEIRO, 1214 — ABRAAO ALAB', 'Rio Branco', 'duas_fontes_concordam', '6971016'),
    ('ALTO RIO SOLIMOES', -4.229832, -69.943704, -4.2526, -69.9381, 'RUA MARECHAL RONDON, 279 — SANTA ROSA', 'Tabatinga', 'cnes_encaixado_na_rua_declarada', '6987885'),
    ('AMAPA E NORTE DO PARA', 0.029861, -51.063334, 0.0349, -51.0694, 'AV PEDRO BAIAO, 1071 — CENTRAL', 'Macapá', 'endereco_com_numero_desmente_o_cnes', '3577902'),
    ('ARAGUAIA', -11.616224, -50.662894, -11.6164, -50.6694, 'RUA NEWTON BURJACK, 322 — CENTRO', 'São Félix do Araguaia', 'fonte_unica_cnes', '6989446'),
    ('BAHIA', -12.997896, -38.459576, -12.9714, -38.5014, 'RUA ERICO VERISSIMO, 80 — ITAIGARA', 'Salvador', 'cnes_na_rua_declarada', '7000901'),
    ('CEARA', -3.746772, -38.503357, -3.7319, -38.5267, 'RUA TOMAS ACIOLI, 1595 — DIONISIO TORRES', 'Fortaleza', 'duas_fontes_concordam', '7007094'),
    ('CUIABA', -15.600988, -56.108395, -15.6014, -56.0979, 'RUA RUI BARBOSA, 282 — GOIABEIRAS', 'Cuiabá', 'cnes_longe_da_rua_declarada', '7017650'),
    ('GUAMA-TOCANTINS', -1.456000, -48.486000, -1.4558, -48.4902, 'AVENIDA CONSELHEIRO FURTADO, 1597 — BATISTA CAMPOS', 'Belém', 'numero_no_bairro_vizinho_confirma_o_cnes', '7460708'),
    ('INTERIOR SUL', -27.570958, -48.605776, -27.5741, -48.6094, 'RUA CAPITAO PEDRO LEITE, 530 — BARREIROS', 'São José', 'cnes_na_rua_declarada', '7336764'),
    ('KAIAPO DO PARA', -8.022473, -50.044141, -8.0289, -50.0306, 'AV BRASIL, 10 — PARK DOS BURITIS I', 'Redenção', 'cnes_na_rua_declarada', '6957889'),
    ('LESTE DE RORAIMA', 2.807181, -60.685269, 2.807181, -60.685269, 'AVENIDA VILLE ROY, 8282 — SAO VICENTE', 'Boa Vista', 'cnes_na_rua_declarada', '7511582'),
    ('LITORAL SUL', -25.462200, -49.295574, -25.4284, -49.2733, 'RUA PROFESSOR BRAZILIO OVIDIO DA COSTA, 639 — PORTAO', 'Curitiba', 'cnes_na_rua_declarada', '7132972'),
    ('MANAUS', -3.092258, -60.024111, -3.119, -60.0217, 'AV DJALMA BATISTA, 1018 — CHAPADA', 'Manaus', 'cnes_encaixado_na_rua_declarada', '7026153'),
    ('MARANHAO', -2.546568, -44.267601, -2.5307, -44.3068, 'RUA 05 DE JANEIRO, 166 — JORDOA', 'São Luís', 'cnes_fora_do_municipio', '7341075'),
    ('MATO GROSSO DO SUL', -20.484159, -54.642180, -20.4697, -54.6201, 'ALEXANDRE FLEMING, 2007 — VILA BANDEIRANTE', 'Campo Grande', 'cnes_na_rua_declarada', '9761195'),
    ('MEDIO RIO PURUS', -7.260797, -64.796848, -7.2586, -64.7981, 'T PADRE MONTEIRO, 165 — CENTRO', 'Lábrea', 'cnes_na_rua_declarada', '7723628'),
    ('MEDIO RIO SOLIMOES E AFLUENTES', -3.347486, -64.708604, -3.3686, -64.7211, 'MONTEIRO DE SOUZA, 289 — CENTRO', 'Tefé', 'cnes_na_rua_declarada', '7098022'),
    ('MINAS GERAIS E ESPIRITO SANTO', -18.870149, -41.945887, -18.8512, -41.9494, 'AVENIDA PIRACICABA, 325 — ILHA DOS ARAUJOS', 'Governador Valadares', 'cnes_na_rua_declarada', '6967671'),
    ('PARINTINS', -2.622542, -56.731896, -2.6283, -56.7358, 'RUA SILVA CAMPO, 1433 — CENTRO', 'Parintins', 'fonte_unica_cnes', '6957595'),
    ('PERNAMBUCO', -8.041053, -34.899869, -8.0476, -34.877, 'RUA DO FUTURO, 600 — GRACAS', 'Recife', 'cnes_na_rua_declarada', '7330979'),
    ('PORTO VELHO', -8.751616, -63.890569, -8.7619, -63.9039, 'AV RAFAEL VAZ E SILVA, 2646 — LIBERDADE', 'Porto Velho', 'cnes_na_rua_declarada', '6960294'),
    ('POTIGUARA', -7.119545, -34.836702, -7.1195, -34.845, 'AVENIDA PRESIDENTE EPITACIO PESSOA, 2953 — BRISAMAR', 'João Pessoa', 'cnes_na_rua_declarada', '7341067'),
    ('RIO TAPAJOS', -4.262597, -55.984387, -4.2761, -55.9836, 'AVENIDA SANTA CATARINA, 98 — BELA VISTA', 'Itaituba', 'cnes_na_rua_declarada', '7393229'),
    ('TOCANTINS', -10.188346, -48.339116, -10.1689, -48.3317, '103 SUL AV LO 01 LOTE 02, 82 — CENTRO', 'Palmas', 'fonte_unica_cnes', '7749260'),
    ('VALE DO JAVARI', -4.369968, -70.192659, -4.3717, -70.1908, 'RAIMUNDO GIMAQUE, 405 — CENTRO', 'Atalaia do Norte', 'cnes_na_rua_declarada', '7158122'),
    ('VILHENA', -11.436783, -61.450583, -11.4343, -61.4562, 'AV GUAPORE, 3046 — JARDIM CLODOALDO', 'Cacoal', 'cnes_encaixado_na_rua_declarada', '7988710'),
    ('XAVANTE', -15.892416, -52.263164, -15.89, -52.2567, 'RUA PIRES DE CAMPOS, 681 — CENTRO', 'Barra do Garças', 'cnes_na_rua_declarada', '6811205'),
    ('XINGU', -13.549506, -52.274001, -13.5547, -52.2706, 'MATO GROSSO X AVENIDA GOIAS, 777 — CENTRO', 'Canarana', 'cnes_na_rua_declarada', '6967531'),
    ('YANOMAMI', 2.813777, -60.670369, 2.813777, -60.670369, 'RUA CECILIA BRASIL, 1043 — CENTRO', 'Boa Vista', 'cnes_na_rua_declarada', '7893787')
)
select c.k,
       (d.value ->> 'lat')::numeric as atual_lat,
       (d.value ->> 'lon')::numeric as atual_lon,
       c.lat as nova_lat,
       c.lon as nova_lon,
       c.endereco
from "TB_CONFIG_MAPA_SAUDE_INDIG" cfg
cross join lateral jsonb_array_elements(cfg.payload -> 'dsei') as d(value)
join correcao c on c.k = d.value ->> 'k'
where cfg.chave = 'lmap'
order by c.k;

-- ============================ 2. CORREÇÃO ==================================

with correcao(k, lat, lon, de_lat, de_lon, endereco, municipio, fonte, cnes) as (values
    ('ALAGOAS E SERGIPE', -9.595223, -35.751669, -9.6498, -35.7089, 'AVENIDA DURVAL DE GOES MONTEIRO, 6001 — PETROPOLIS', 'Maceió', 'cnes_encaixado_na_rua_declarada', '7748396'),
    ('ALTAMIRA', -3.191381, -52.214129, -3.2039, -52.2096, 'RUA HORACIO BOANERGES, 1336 — BRASILIA', 'Altamira', 'cnes_sem_coordenada', '7444699'),
    ('ALTO RIO JURUA', -7.626460, -72.679324, -7.6308, -72.6707, 'RUA AFONSO PENA, 1830 — 25 DE AGOSTO', 'Cruzeiro do Sul', 'fonte_unica_cnes', '7036302'),
    ('ALTO RIO NEGRO', -0.135333, -67.080395, -0.1303, -67.0892, 'AV 7 DE SETEMBRO, 500 — PRAIA', 'São Gabriel da Cachoeira', 'cnes_na_rua_declarada', '9229280'),
    ('ALTO RIO PURUS', -9.972830, -67.826600, -9.9747, -67.81, 'RUA RIO DE JANEIRO, 1214 — ABRAAO ALAB', 'Rio Branco', 'duas_fontes_concordam', '6971016'),
    ('ALTO RIO SOLIMOES', -4.229832, -69.943704, -4.2526, -69.9381, 'RUA MARECHAL RONDON, 279 — SANTA ROSA', 'Tabatinga', 'cnes_encaixado_na_rua_declarada', '6987885'),
    ('AMAPA E NORTE DO PARA', 0.029861, -51.063334, 0.0349, -51.0694, 'AV PEDRO BAIAO, 1071 — CENTRAL', 'Macapá', 'endereco_com_numero_desmente_o_cnes', '3577902'),
    ('ARAGUAIA', -11.616224, -50.662894, -11.6164, -50.6694, 'RUA NEWTON BURJACK, 322 — CENTRO', 'São Félix do Araguaia', 'fonte_unica_cnes', '6989446'),
    ('BAHIA', -12.997896, -38.459576, -12.9714, -38.5014, 'RUA ERICO VERISSIMO, 80 — ITAIGARA', 'Salvador', 'cnes_na_rua_declarada', '7000901'),
    ('CEARA', -3.746772, -38.503357, -3.7319, -38.5267, 'RUA TOMAS ACIOLI, 1595 — DIONISIO TORRES', 'Fortaleza', 'duas_fontes_concordam', '7007094'),
    ('CUIABA', -15.600988, -56.108395, -15.6014, -56.0979, 'RUA RUI BARBOSA, 282 — GOIABEIRAS', 'Cuiabá', 'cnes_longe_da_rua_declarada', '7017650'),
    ('GUAMA-TOCANTINS', -1.456000, -48.486000, -1.4558, -48.4902, 'AVENIDA CONSELHEIRO FURTADO, 1597 — BATISTA CAMPOS', 'Belém', 'numero_no_bairro_vizinho_confirma_o_cnes', '7460708'),
    ('INTERIOR SUL', -27.570958, -48.605776, -27.5741, -48.6094, 'RUA CAPITAO PEDRO LEITE, 530 — BARREIROS', 'São José', 'cnes_na_rua_declarada', '7336764'),
    ('KAIAPO DO PARA', -8.022473, -50.044141, -8.0289, -50.0306, 'AV BRASIL, 10 — PARK DOS BURITIS I', 'Redenção', 'cnes_na_rua_declarada', '6957889'),
    ('LESTE DE RORAIMA', 2.807181, -60.685269, 2.807181, -60.685269, 'AVENIDA VILLE ROY, 8282 — SAO VICENTE', 'Boa Vista', 'cnes_na_rua_declarada', '7511582'),
    ('LITORAL SUL', -25.462200, -49.295574, -25.4284, -49.2733, 'RUA PROFESSOR BRAZILIO OVIDIO DA COSTA, 639 — PORTAO', 'Curitiba', 'cnes_na_rua_declarada', '7132972'),
    ('MANAUS', -3.092258, -60.024111, -3.119, -60.0217, 'AV DJALMA BATISTA, 1018 — CHAPADA', 'Manaus', 'cnes_encaixado_na_rua_declarada', '7026153'),
    ('MARANHAO', -2.546568, -44.267601, -2.5307, -44.3068, 'RUA 05 DE JANEIRO, 166 — JORDOA', 'São Luís', 'cnes_fora_do_municipio', '7341075'),
    ('MATO GROSSO DO SUL', -20.484159, -54.642180, -20.4697, -54.6201, 'ALEXANDRE FLEMING, 2007 — VILA BANDEIRANTE', 'Campo Grande', 'cnes_na_rua_declarada', '9761195'),
    ('MEDIO RIO PURUS', -7.260797, -64.796848, -7.2586, -64.7981, 'T PADRE MONTEIRO, 165 — CENTRO', 'Lábrea', 'cnes_na_rua_declarada', '7723628'),
    ('MEDIO RIO SOLIMOES E AFLUENTES', -3.347486, -64.708604, -3.3686, -64.7211, 'MONTEIRO DE SOUZA, 289 — CENTRO', 'Tefé', 'cnes_na_rua_declarada', '7098022'),
    ('MINAS GERAIS E ESPIRITO SANTO', -18.870149, -41.945887, -18.8512, -41.9494, 'AVENIDA PIRACICABA, 325 — ILHA DOS ARAUJOS', 'Governador Valadares', 'cnes_na_rua_declarada', '6967671'),
    ('PARINTINS', -2.622542, -56.731896, -2.6283, -56.7358, 'RUA SILVA CAMPO, 1433 — CENTRO', 'Parintins', 'fonte_unica_cnes', '6957595'),
    ('PERNAMBUCO', -8.041053, -34.899869, -8.0476, -34.877, 'RUA DO FUTURO, 600 — GRACAS', 'Recife', 'cnes_na_rua_declarada', '7330979'),
    ('PORTO VELHO', -8.751616, -63.890569, -8.7619, -63.9039, 'AV RAFAEL VAZ E SILVA, 2646 — LIBERDADE', 'Porto Velho', 'cnes_na_rua_declarada', '6960294'),
    ('POTIGUARA', -7.119545, -34.836702, -7.1195, -34.845, 'AVENIDA PRESIDENTE EPITACIO PESSOA, 2953 — BRISAMAR', 'João Pessoa', 'cnes_na_rua_declarada', '7341067'),
    ('RIO TAPAJOS', -4.262597, -55.984387, -4.2761, -55.9836, 'AVENIDA SANTA CATARINA, 98 — BELA VISTA', 'Itaituba', 'cnes_na_rua_declarada', '7393229'),
    ('TOCANTINS', -10.188346, -48.339116, -10.1689, -48.3317, '103 SUL AV LO 01 LOTE 02, 82 — CENTRO', 'Palmas', 'fonte_unica_cnes', '7749260'),
    ('VALE DO JAVARI', -4.369968, -70.192659, -4.3717, -70.1908, 'RAIMUNDO GIMAQUE, 405 — CENTRO', 'Atalaia do Norte', 'cnes_na_rua_declarada', '7158122'),
    ('VILHENA', -11.436783, -61.450583, -11.4343, -61.4562, 'AV GUAPORE, 3046 — JARDIM CLODOALDO', 'Cacoal', 'cnes_encaixado_na_rua_declarada', '7988710'),
    ('XAVANTE', -15.892416, -52.263164, -15.89, -52.2567, 'RUA PIRES DE CAMPOS, 681 — CENTRO', 'Barra do Garças', 'cnes_na_rua_declarada', '6811205'),
    ('XINGU', -13.549506, -52.274001, -13.5547, -52.2706, 'MATO GROSSO X AVENIDA GOIAS, 777 — CENTRO', 'Canarana', 'cnes_na_rua_declarada', '6967531'),
    ('YANOMAMI', 2.813777, -60.670369, 2.813777, -60.670369, 'RUA CECILIA BRASIL, 1043 — CENTRO', 'Boa Vista', 'cnes_na_rua_declarada', '7893787')
)
update "TB_CONFIG_MAPA_SAUDE_INDIG" cfg
set payload = jsonb_set(
  cfg.payload,
  '{dsei}',
  (
    select jsonb_agg(
      coalesce(
        (
          select d.value || jsonb_build_object(
            'lat', c.lat,
            'lon', c.lon,
            'sede_endereco', c.endereco,
            'sede_municipio', c.municipio,
            'sede_fonte', c.fonte,
            'sede_cnes', c.cnes
          )
          from correcao c
          where c.k = d.value ->> 'k'
            and (d.value ->> 'lat')::numeric = c.de_lat
            and (d.value ->> 'lon')::numeric = c.de_lon
        ),
        d.value
      )
      order by d.ordem
    )
    from jsonb_array_elements(cfg.payload -> 'dsei') with ordinality as d(value, ordem)
  )
)
where cfg.chave = 'lmap';
