-- ---------------------------------------------------------------------------
-- CORRIGE 56 POLOS BASE QUE O MAPA DESENHA FORA DO MUNICÍPIO
--
-- Auditoria de 21/09/2026. A auditoria anterior percorreu os 1080 códigos CNES
-- do payload `rede_cnes`; os polos vivem no payload `lmap` e não têm código
-- próprio, por isso ficaram de fora — mesmo sendo eles que o mapa desenha como
-- "Polo base".
--
-- O QUE SE MEDIU
--
-- Cada polo foi emparelhado com o seu gémeo na rede pelo DSEI e pelo nome
-- canónico, a mesma regra que a reconciliação do app usa. Dos 381 polos, 234
-- têm gémeo inequívoco. Nenhum deles está na coordenada oficial do CNES:
--
--     10 m a 1 km        6
--     1 a 10 km         38
--     10 a 50 km        78
--     50 a 200 km       84
--     mais de 200 km    28
--
-- Isto não é acidente: `coordenadaDeExibicao` preserva de propósito a posição
-- histórica do lmap "até validação independente". Esta é a validação.
--
-- QUEM ESTÁ CERTO
--
-- Cada par foi testado contra a malha do MUNICÍPIO que o CNES declara para o
-- estabelecimento (IBGE, qualidade máxima):
--
--     56 o CNES cai no município e o lmap NÃO  -> entram aqui
--     13 o lmap cai no município e o CNES NÃO  -> ficam como estão
--    156 os dois caem no município             -> a malha não decide
--      3 nenhum se sustenta
--
-- Os 156 não entram: municípios amazónicos têm centenas de quilómetros, e
-- "ambos dentro" não distingue nada. São trabalho de quem conhece o território.
--
-- O QUE MUDA, DO MAIOR ERRO PARA O MENOR
--
--    1379.106 km  Parintins                SANTA MARIA
--    1261.686 km  Parintins                SÃO FRANCISCO
--    1162.372 km  Parintins                NOVA ESPERANÇA
--    1127.235 km  Parintins                VILA NOVA II
--    1030.743 km  Médio Rio Purus          SÃO PEDRO
--     597.787 km  Parintins                ARATICUM
--     428.502 km  Médio Rio Purus          MARRECÃO
--     398.309 km  Yanomami                 MARARI
--     347.826 km  Araguaia                 GOIÂNIA
--     316.939 km  Yanomami                 BAIXO CATRIMANI
--     271.662 km  Pernambuco               TRUKÁ
--     244.677 km  Médio Rio Solimões e A   ENVIRA
--      240.76 km  Yanomami                 ALTO CATRIMANI
--     240.258 km  Parintins                UMIRITUBA
--     215.889 km  Yanomami                 KAYANAÚ
--     186.317 km  Pernambuco               PANKARÁ
--     178.149 km  Vale do Javari           ITACOAÍ
--     171.129 km  Yanomami                 BAIXO MUCAJAI
--     169.266 km  Yanomami                 HOMOXI
--     164.574 km  Yanomami                 MAIA
--     157.622 km  Rio Tapajós              TELES PIRES
--     151.719 km  Alto Rio Purus           EXTREMA
--     149.391 km  Bahia                    JUAZEIRO
--     146.058 km  Bahia                    IBOTIRAMA
--     137.787 km  Rio Tapajós              KARAPANATUBA
--     119.699 km  Kaiapó do Pará           REDENÇÃO
--     113.052 km  Maranhão                 ZÉ DOCA
--     107.916 km  Yanomami                 AJARANI
--     107.916 km  Yanomami                 MISSÃO CATRIMANI
--     107.339 km  Litoral Sul              SANTA HELENA
--     102.209 km  Pernambuco               PANKARARU
--      95.443 km  Guamá-Tocantins          TUCURUÍ
--      93.028 km  Bahia                    ILHÉUS
--      91.701 km  Maranhão                 BARRA DO CORDA
--      87.283 km  Litoral Sul              BAURÚ
--      83.446 km  Manaus                   BOCA DO JAUARI
--      82.269 km  Minas Gerais e Espírit   CARMÉSIA
--       70.03 km  Rio Tapajós              ITAITUBA
--      70.029 km  Alto Rio Purus           MANOEL URBANO
--      54.173 km  Vilhena                  JUÍNA
--      48.275 km  Litoral Sul              MONGAGUÁ
--      47.793 km  Potiguara                GOIANINHA
--      46.682 km  Alto Rio Solimões        VENDAVAL
--      42.491 km  Cuiabá                   CUIABÁ
--       41.12 km  Litoral Sul              MIRACATU
--      37.471 km  Interior Sul             NONOAI
--      35.884 km  Litoral Sul              GUARAPUAVA
--      34.017 km  Interior Sul             OSÓRIO
--      27.842 km  Bahia                    PAULO AFONSO
--       24.36 km  Litoral Sul              REGISTRO
--      24.096 km  Interior Sul             JOSÉ BOITEUX
--      21.074 km  Manaus                   MURUTINGA
--      20.908 km  Guamá-Tocantins          MARABÁ
--      20.051 km  Bahia                    RIBEIRA DO POMBAL
--      15.295 km  Guamá-Tocantins          CAPITÃO POÇO
--      11.847 km  Maranhão                 SANTA INÊS
--
-- COMO APLICAR
--
-- 1. Correr a CONFERÊNCIA. Não altera nada. Esperado: 56 linhas.
-- 2. Correr a CORREÇÃO. Só escreve onde a coordenada atual for a auditada.
-- 3. Repetir a CONFERÊNCIA: atual deve passar a ser igual a nova.
-- ---------------------------------------------------------------------------

-- ============================ 1. CONFERÊNCIA ===============================

with correcao(dsei, polo, lat, lon, de_lat, de_lon) as (values
    ('PARINTINS', 'SANTA MARIA', -3.766967, -57.205811, -4.037300, -69.634400),
    ('PARINTINS', 'SÃO FRANCISCO', -3.150182, -56.863612, -3.434200, -68.225500),
    ('PARINTINS', 'NOVA ESPERANÇA', -3.723116, -57.487335, -7.834000, -67.149900),
    ('PARINTINS', 'VILA NOVA II', -3.782041, -57.315674, -0.223000, -66.815200),
    ('MEDIO RIO PURUS', 'SÃO PEDRO', -7.371915, -64.917698, 0.643100, -69.586500),
    ('PARINTINS', 'ARATICUM', -2.775708, -56.817169, -3.080100, -62.191600),
    ('MEDIO RIO PURUS', 'MARRECÃO', -5.628000, -63.183000, -6.802000, -66.875200),
    ('YANOMAMI', 'MARARI', -0.197754, -63.325195, -3.496700, -64.721900),
    ('ARAGUAIA', 'GOIÂNIA', -16.731646, -49.231904, -13.758900, -48.222800),
    ('YANOMAMI', 'BAIXO CATRIMANI', 1.862541, -61.182175, 4.600300, -60.387800),
    ('PERNAMBUCO', 'TRUKÁ', -8.513858, -39.306358, -8.428400, -36.837800),
    ('MEDIO RIO SOLIMOES E AFLUENTES', 'ENVIRA', -7.432049, -70.021255, -6.807500, -72.147600),
    ('YANOMAMI', 'ALTO CATRIMANI', 2.430000, -60.900000, 2.505500, -63.065900),
    ('PARINTINS', 'UMIRITUBA', -2.801770, -56.822662, -4.931100, -57.190300),
    ('YANOMAMI', 'KAYANAÚ', 2.168215, -61.052258, 2.755700, -62.904500),
    ('PERNAMBUCO', 'PANKARÁ', -8.317112, -38.745089, -8.461800, -37.057700),
    ('VALE DO JAVARI', 'ITACOAÍ', -4.383725, -70.203495, -5.941000, -70.581500),
    ('YANOMAMI', 'BAIXO MUCAJAI', 2.735200, -62.018800, 3.246400, -60.565200),
    ('YANOMAMI', 'HOMOXI', 2.167258, -61.052743, 2.251200, -62.573800),
    ('YANOMAMI', 'MAIA', -0.153808, -67.153931, 0.500400, -65.826300),
    ('RIO TAPAJOS', 'TELES PIRES', -6.970049, -58.359375, -8.222300, -57.689200),
    ('ALTO RIO PURUS', 'EXTREMA', -8.667918, -63.984375, -9.420700, -65.136700),
    ('BAHIA', 'JUAZEIRO', -9.414156, -40.502944, -8.816300, -39.284400),
    ('BAHIA', 'IBOTIRAMA', -12.185320, -43.221320, -13.396500, -43.742600),
    ('RIO TAPAJOS', 'KARAPANATUBA', -6.172641, -57.666550, -7.291800, -57.130900),
    ('KAIAPO DO PARA', 'REDENÇÃO', -8.037522, -50.038827, -7.557000, -51.011100),
    ('MARANHAO', 'ZÉ DOCA', -3.273669, -45.657342, -4.230900, -46.000700),
    ('YANOMAMI', 'AJARANI', 1.803871, -61.149176, 0.834100, -61.111300),
    ('YANOMAMI', 'MISSÃO CATRIMANI', 1.803871, -61.149176, 0.834100, -61.111300),
    ('LITORAL SUL', 'SANTA HELENA', -24.944351, -54.310226, -24.005400, -54.064000),
    ('PERNAMBUCO', 'PANKARARU', -9.174487, -38.242893, -8.702900, -37.444200),
    ('GUAMA-TOCANTINS', 'TUCURUÍ', -3.766978, -49.668782, -4.585900, -49.926600),
    ('BAHIA', 'ILHÉUS', -14.786605, -39.045775, -13.962200, -39.192800),
    ('MARANHAO', 'BARRA DO CORDA', -5.509502, -45.246978, -5.311000, -46.051000),
    ('LITORAL SUL', 'BAURÚ', -22.339568, -49.062421, -22.042700, -49.847200),
    ('MANAUS', 'BOCA DO JAUARI', -5.809000, -61.300000, -6.256200, -61.906000),
    ('MINAS GERAIS E ESPIRITO SANTO', 'CARMÉSIA', -19.034946, -43.118198, -19.565100, -43.665000),
    ('RIO TAPAJOS', 'ITAITUBA', -4.258624, -55.972122, -4.725700, -56.395900),
    ('ALTO RIO PURUS', 'MANOEL URBANO', -8.838598, -69.259615, -9.126500, -69.826700),
    ('VILHENA', 'JUÍNA', -11.443412, -58.782241, -11.234200, -58.333500),
    ('LITORAL SUL', 'MONGAGUÁ', -24.111689, -46.652404, -23.875600, -46.253600),
    ('POTIGUARA', 'GOIANINHA', -6.257626, -35.209808, -6.621200, -34.979100),
    ('ALTO RIO SOLIMOES', 'VENDAVAL', -3.464246, -69.119797, -3.734500, -69.441700),
    ('CUIABA', 'CUIABÁ', -15.740290, -56.058975, -16.005300, -56.345200),
    ('LITORAL SUL', 'MIRACATU', -24.283956, -47.456710, -24.653100, -47.432500),
    ('INTERIOR SUL', 'NONOAI', -27.361706, -52.770853, -27.669400, -52.925800),
    ('LITORAL SUL', 'GUARAPUAVA', -25.390637, -51.460226, -25.074200, -51.390200),
    ('INTERIOR SUL', 'OSÓRIO', -29.890290, -50.270476, -29.585300, -50.243000),
    ('BAHIA', 'PAULO AFONSO', -9.396456, -38.233322, -9.338500, -38.480200),
    ('LITORAL SUL', 'REGISTRO', -24.508481, -47.846285, -24.367100, -48.030100),
    ('INTERIOR SUL', 'JOSÉ BOITEUX', -26.966185, -49.620888, -26.780700, -49.746500),
    ('MANAUS', 'MURUTINGA', -3.378530, -59.252508, -3.433200, -59.434300),
    ('GUAMA-TOCANTINS', 'MARABÁ', -5.346517, -49.106466, -5.204600, -48.982600),
    ('BAHIA', 'RIBEIRA DO POMBAL', -10.831599, -38.544095, -10.659200, -38.597900),
    ('GUAMA-TOCANTINS', 'CAPITÃO POÇO', -1.750741, -47.072283, -1.853500, -46.980800),
    ('MARANHAO', 'SANTA INÊS', -3.658606, -45.381047, -3.647300, -45.487200)
),
atuais as (
  select
    dsei.value ->> 'k'                as dsei,
    polo.value ->> 'n'                as polo,
    (polo.value ->> 'lat')::numeric   as atual_lat,
    (polo.value ->> 'lon')::numeric   as atual_lon
  from "TB_CONFIG_MAPA_SAUDE_INDIG" cfg
  cross join lateral jsonb_array_elements(cfg.payload -> 'dsei') as dsei(value)
  cross join lateral jsonb_array_elements(coalesce(dsei.value -> 'polos', '[]'::jsonb)) as polo(value)
  where cfg.chave = 'lmap'
)
select a.dsei, a.polo, a.atual_lat, a.atual_lon, c.lat as nova_lat, c.lon as nova_lon
from atuais a
join correcao c on c.dsei = a.dsei and c.polo = a.polo
order by a.dsei, a.polo;

-- ============================ 2. CORREÇÃO ==================================

with correcao(dsei, polo, lat, lon, de_lat, de_lon) as (values
    ('PARINTINS', 'SANTA MARIA', -3.766967, -57.205811, -4.037300, -69.634400),
    ('PARINTINS', 'SÃO FRANCISCO', -3.150182, -56.863612, -3.434200, -68.225500),
    ('PARINTINS', 'NOVA ESPERANÇA', -3.723116, -57.487335, -7.834000, -67.149900),
    ('PARINTINS', 'VILA NOVA II', -3.782041, -57.315674, -0.223000, -66.815200),
    ('MEDIO RIO PURUS', 'SÃO PEDRO', -7.371915, -64.917698, 0.643100, -69.586500),
    ('PARINTINS', 'ARATICUM', -2.775708, -56.817169, -3.080100, -62.191600),
    ('MEDIO RIO PURUS', 'MARRECÃO', -5.628000, -63.183000, -6.802000, -66.875200),
    ('YANOMAMI', 'MARARI', -0.197754, -63.325195, -3.496700, -64.721900),
    ('ARAGUAIA', 'GOIÂNIA', -16.731646, -49.231904, -13.758900, -48.222800),
    ('YANOMAMI', 'BAIXO CATRIMANI', 1.862541, -61.182175, 4.600300, -60.387800),
    ('PERNAMBUCO', 'TRUKÁ', -8.513858, -39.306358, -8.428400, -36.837800),
    ('MEDIO RIO SOLIMOES E AFLUENTES', 'ENVIRA', -7.432049, -70.021255, -6.807500, -72.147600),
    ('YANOMAMI', 'ALTO CATRIMANI', 2.430000, -60.900000, 2.505500, -63.065900),
    ('PARINTINS', 'UMIRITUBA', -2.801770, -56.822662, -4.931100, -57.190300),
    ('YANOMAMI', 'KAYANAÚ', 2.168215, -61.052258, 2.755700, -62.904500),
    ('PERNAMBUCO', 'PANKARÁ', -8.317112, -38.745089, -8.461800, -37.057700),
    ('VALE DO JAVARI', 'ITACOAÍ', -4.383725, -70.203495, -5.941000, -70.581500),
    ('YANOMAMI', 'BAIXO MUCAJAI', 2.735200, -62.018800, 3.246400, -60.565200),
    ('YANOMAMI', 'HOMOXI', 2.167258, -61.052743, 2.251200, -62.573800),
    ('YANOMAMI', 'MAIA', -0.153808, -67.153931, 0.500400, -65.826300),
    ('RIO TAPAJOS', 'TELES PIRES', -6.970049, -58.359375, -8.222300, -57.689200),
    ('ALTO RIO PURUS', 'EXTREMA', -8.667918, -63.984375, -9.420700, -65.136700),
    ('BAHIA', 'JUAZEIRO', -9.414156, -40.502944, -8.816300, -39.284400),
    ('BAHIA', 'IBOTIRAMA', -12.185320, -43.221320, -13.396500, -43.742600),
    ('RIO TAPAJOS', 'KARAPANATUBA', -6.172641, -57.666550, -7.291800, -57.130900),
    ('KAIAPO DO PARA', 'REDENÇÃO', -8.037522, -50.038827, -7.557000, -51.011100),
    ('MARANHAO', 'ZÉ DOCA', -3.273669, -45.657342, -4.230900, -46.000700),
    ('YANOMAMI', 'AJARANI', 1.803871, -61.149176, 0.834100, -61.111300),
    ('YANOMAMI', 'MISSÃO CATRIMANI', 1.803871, -61.149176, 0.834100, -61.111300),
    ('LITORAL SUL', 'SANTA HELENA', -24.944351, -54.310226, -24.005400, -54.064000),
    ('PERNAMBUCO', 'PANKARARU', -9.174487, -38.242893, -8.702900, -37.444200),
    ('GUAMA-TOCANTINS', 'TUCURUÍ', -3.766978, -49.668782, -4.585900, -49.926600),
    ('BAHIA', 'ILHÉUS', -14.786605, -39.045775, -13.962200, -39.192800),
    ('MARANHAO', 'BARRA DO CORDA', -5.509502, -45.246978, -5.311000, -46.051000),
    ('LITORAL SUL', 'BAURÚ', -22.339568, -49.062421, -22.042700, -49.847200),
    ('MANAUS', 'BOCA DO JAUARI', -5.809000, -61.300000, -6.256200, -61.906000),
    ('MINAS GERAIS E ESPIRITO SANTO', 'CARMÉSIA', -19.034946, -43.118198, -19.565100, -43.665000),
    ('RIO TAPAJOS', 'ITAITUBA', -4.258624, -55.972122, -4.725700, -56.395900),
    ('ALTO RIO PURUS', 'MANOEL URBANO', -8.838598, -69.259615, -9.126500, -69.826700),
    ('VILHENA', 'JUÍNA', -11.443412, -58.782241, -11.234200, -58.333500),
    ('LITORAL SUL', 'MONGAGUÁ', -24.111689, -46.652404, -23.875600, -46.253600),
    ('POTIGUARA', 'GOIANINHA', -6.257626, -35.209808, -6.621200, -34.979100),
    ('ALTO RIO SOLIMOES', 'VENDAVAL', -3.464246, -69.119797, -3.734500, -69.441700),
    ('CUIABA', 'CUIABÁ', -15.740290, -56.058975, -16.005300, -56.345200),
    ('LITORAL SUL', 'MIRACATU', -24.283956, -47.456710, -24.653100, -47.432500),
    ('INTERIOR SUL', 'NONOAI', -27.361706, -52.770853, -27.669400, -52.925800),
    ('LITORAL SUL', 'GUARAPUAVA', -25.390637, -51.460226, -25.074200, -51.390200),
    ('INTERIOR SUL', 'OSÓRIO', -29.890290, -50.270476, -29.585300, -50.243000),
    ('BAHIA', 'PAULO AFONSO', -9.396456, -38.233322, -9.338500, -38.480200),
    ('LITORAL SUL', 'REGISTRO', -24.508481, -47.846285, -24.367100, -48.030100),
    ('INTERIOR SUL', 'JOSÉ BOITEUX', -26.966185, -49.620888, -26.780700, -49.746500),
    ('MANAUS', 'MURUTINGA', -3.378530, -59.252508, -3.433200, -59.434300),
    ('GUAMA-TOCANTINS', 'MARABÁ', -5.346517, -49.106466, -5.204600, -48.982600),
    ('BAHIA', 'RIBEIRA DO POMBAL', -10.831599, -38.544095, -10.659200, -38.597900),
    ('GUAMA-TOCANTINS', 'CAPITÃO POÇO', -1.750741, -47.072283, -1.853500, -46.980800),
    ('MARANHAO', 'SANTA INÊS', -3.658606, -45.381047, -3.647300, -45.487200)
)
update "TB_CONFIG_MAPA_SAUDE_INDIG" cfg
set payload = jsonb_set(
  cfg.payload,
  '{dsei}',
  (
    select coalesce(jsonb_agg(
      case
        when dsei.value ? 'polos' then jsonb_set(
          dsei.value,
          '{polos}',
          (
            select coalesce(jsonb_agg((
            select coalesce(
              (
                select jsonb_set(
                         jsonb_set(polo.value, '{lat}', to_jsonb(c.lat)),
                         '{lon}', to_jsonb(c.lon))
                from correcao c
                where c.dsei = dsei.value ->> 'k'
                  and c.polo = polo.value ->> 'n'
                  and (polo.value ->> 'lat')::numeric = c.de_lat
                  and (polo.value ->> 'lon')::numeric = c.de_lon
              ),
              polo.value)
          ) order by polo.ordem), '[]'::jsonb)
            from jsonb_array_elements(dsei.value -> 'polos')
                 with ordinality as polo(value, ordem)
          )
        )
        else dsei.value
      end
      order by dsei.ordem
    ), '[]'::jsonb)
    from jsonb_array_elements(cfg.payload -> 'dsei') with ordinality as dsei(value, ordem)
  )
)
where cfg.chave = 'lmap';

-- ============================ 3. VERIFICAÇÃO ===============================

with correcao(dsei, polo, lat, lon, de_lat, de_lon) as (values
    ('PARINTINS', 'SANTA MARIA', -3.766967, -57.205811, -4.037300, -69.634400),
    ('PARINTINS', 'SÃO FRANCISCO', -3.150182, -56.863612, -3.434200, -68.225500),
    ('PARINTINS', 'NOVA ESPERANÇA', -3.723116, -57.487335, -7.834000, -67.149900),
    ('PARINTINS', 'VILA NOVA II', -3.782041, -57.315674, -0.223000, -66.815200),
    ('MEDIO RIO PURUS', 'SÃO PEDRO', -7.371915, -64.917698, 0.643100, -69.586500),
    ('PARINTINS', 'ARATICUM', -2.775708, -56.817169, -3.080100, -62.191600),
    ('MEDIO RIO PURUS', 'MARRECÃO', -5.628000, -63.183000, -6.802000, -66.875200),
    ('YANOMAMI', 'MARARI', -0.197754, -63.325195, -3.496700, -64.721900),
    ('ARAGUAIA', 'GOIÂNIA', -16.731646, -49.231904, -13.758900, -48.222800),
    ('YANOMAMI', 'BAIXO CATRIMANI', 1.862541, -61.182175, 4.600300, -60.387800),
    ('PERNAMBUCO', 'TRUKÁ', -8.513858, -39.306358, -8.428400, -36.837800),
    ('MEDIO RIO SOLIMOES E AFLUENTES', 'ENVIRA', -7.432049, -70.021255, -6.807500, -72.147600),
    ('YANOMAMI', 'ALTO CATRIMANI', 2.430000, -60.900000, 2.505500, -63.065900),
    ('PARINTINS', 'UMIRITUBA', -2.801770, -56.822662, -4.931100, -57.190300),
    ('YANOMAMI', 'KAYANAÚ', 2.168215, -61.052258, 2.755700, -62.904500),
    ('PERNAMBUCO', 'PANKARÁ', -8.317112, -38.745089, -8.461800, -37.057700),
    ('VALE DO JAVARI', 'ITACOAÍ', -4.383725, -70.203495, -5.941000, -70.581500),
    ('YANOMAMI', 'BAIXO MUCAJAI', 2.735200, -62.018800, 3.246400, -60.565200),
    ('YANOMAMI', 'HOMOXI', 2.167258, -61.052743, 2.251200, -62.573800),
    ('YANOMAMI', 'MAIA', -0.153808, -67.153931, 0.500400, -65.826300),
    ('RIO TAPAJOS', 'TELES PIRES', -6.970049, -58.359375, -8.222300, -57.689200),
    ('ALTO RIO PURUS', 'EXTREMA', -8.667918, -63.984375, -9.420700, -65.136700),
    ('BAHIA', 'JUAZEIRO', -9.414156, -40.502944, -8.816300, -39.284400),
    ('BAHIA', 'IBOTIRAMA', -12.185320, -43.221320, -13.396500, -43.742600),
    ('RIO TAPAJOS', 'KARAPANATUBA', -6.172641, -57.666550, -7.291800, -57.130900),
    ('KAIAPO DO PARA', 'REDENÇÃO', -8.037522, -50.038827, -7.557000, -51.011100),
    ('MARANHAO', 'ZÉ DOCA', -3.273669, -45.657342, -4.230900, -46.000700),
    ('YANOMAMI', 'AJARANI', 1.803871, -61.149176, 0.834100, -61.111300),
    ('YANOMAMI', 'MISSÃO CATRIMANI', 1.803871, -61.149176, 0.834100, -61.111300),
    ('LITORAL SUL', 'SANTA HELENA', -24.944351, -54.310226, -24.005400, -54.064000),
    ('PERNAMBUCO', 'PANKARARU', -9.174487, -38.242893, -8.702900, -37.444200),
    ('GUAMA-TOCANTINS', 'TUCURUÍ', -3.766978, -49.668782, -4.585900, -49.926600),
    ('BAHIA', 'ILHÉUS', -14.786605, -39.045775, -13.962200, -39.192800),
    ('MARANHAO', 'BARRA DO CORDA', -5.509502, -45.246978, -5.311000, -46.051000),
    ('LITORAL SUL', 'BAURÚ', -22.339568, -49.062421, -22.042700, -49.847200),
    ('MANAUS', 'BOCA DO JAUARI', -5.809000, -61.300000, -6.256200, -61.906000),
    ('MINAS GERAIS E ESPIRITO SANTO', 'CARMÉSIA', -19.034946, -43.118198, -19.565100, -43.665000),
    ('RIO TAPAJOS', 'ITAITUBA', -4.258624, -55.972122, -4.725700, -56.395900),
    ('ALTO RIO PURUS', 'MANOEL URBANO', -8.838598, -69.259615, -9.126500, -69.826700),
    ('VILHENA', 'JUÍNA', -11.443412, -58.782241, -11.234200, -58.333500),
    ('LITORAL SUL', 'MONGAGUÁ', -24.111689, -46.652404, -23.875600, -46.253600),
    ('POTIGUARA', 'GOIANINHA', -6.257626, -35.209808, -6.621200, -34.979100),
    ('ALTO RIO SOLIMOES', 'VENDAVAL', -3.464246, -69.119797, -3.734500, -69.441700),
    ('CUIABA', 'CUIABÁ', -15.740290, -56.058975, -16.005300, -56.345200),
    ('LITORAL SUL', 'MIRACATU', -24.283956, -47.456710, -24.653100, -47.432500),
    ('INTERIOR SUL', 'NONOAI', -27.361706, -52.770853, -27.669400, -52.925800),
    ('LITORAL SUL', 'GUARAPUAVA', -25.390637, -51.460226, -25.074200, -51.390200),
    ('INTERIOR SUL', 'OSÓRIO', -29.890290, -50.270476, -29.585300, -50.243000),
    ('BAHIA', 'PAULO AFONSO', -9.396456, -38.233322, -9.338500, -38.480200),
    ('LITORAL SUL', 'REGISTRO', -24.508481, -47.846285, -24.367100, -48.030100),
    ('INTERIOR SUL', 'JOSÉ BOITEUX', -26.966185, -49.620888, -26.780700, -49.746500),
    ('MANAUS', 'MURUTINGA', -3.378530, -59.252508, -3.433200, -59.434300),
    ('GUAMA-TOCANTINS', 'MARABÁ', -5.346517, -49.106466, -5.204600, -48.982600),
    ('BAHIA', 'RIBEIRA DO POMBAL', -10.831599, -38.544095, -10.659200, -38.597900),
    ('GUAMA-TOCANTINS', 'CAPITÃO POÇO', -1.750741, -47.072283, -1.853500, -46.980800),
    ('MARANHAO', 'SANTA INÊS', -3.658606, -45.381047, -3.647300, -45.487200)
),
atuais as (
  select
    dsei.value ->> 'k'                as dsei,
    polo.value ->> 'n'                as polo,
    (polo.value ->> 'lat')::numeric   as atual_lat,
    (polo.value ->> 'lon')::numeric   as atual_lon
  from "TB_CONFIG_MAPA_SAUDE_INDIG" cfg
  cross join lateral jsonb_array_elements(cfg.payload -> 'dsei') as dsei(value)
  cross join lateral jsonb_array_elements(coalesce(dsei.value -> 'polos', '[]'::jsonb)) as polo(value)
  where cfg.chave = 'lmap'
)
select a.dsei, a.polo, a.atual_lat, a.atual_lon, c.lat as nova_lat, c.lon as nova_lon
from atuais a
join correcao c on c.dsei = a.dsei and c.polo = a.polo
order by a.dsei, a.polo;
