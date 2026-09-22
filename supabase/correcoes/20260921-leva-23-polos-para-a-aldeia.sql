-- ---------------------------------------------------------------------------
-- LEVA 23 POLOS PARA ONDE A ALDEIA DIZ QUE ELES ESTÃO
--
-- Continuação de 20260921-corrige-56-polos-fora-do-municipio.sql. Aquele tratou
-- os polos cuja coordenada cai fora do município declarado. Sobraram 156 em que
-- AS DUAS candidatas caem dentro do município e discordam entre si — municípios
-- amazónicos têm centenas de quilómetros, e a malha não distingue nada ali.
--
-- A ALDEIA DISTINGUE
--
-- A Funai publica `Funai:aldeias_pontos`: 4730 aldeias com nome, município e
-- coordenada. Se o polo se chama como uma aldeia daquele município, o ponto da
-- aldeia diz qual das duas candidatas está perto do sítio certo.
--
--   156  polos em que a malha municipal não decidia
--    74  emparelham com uma aldeia que cai no município declarado
--    67  com diferença de 2 km ou mais entre as candidatas — decisão clara
--    32  a aldeia dá razão ao CNES
--    35  a aldeia dá razão ao que o mapa já desenha, e nada se faz
--
-- O CORTE QUE FALTAVA
--
-- Dos 32, só entram aqui os 23 em que o vencedor está a menos de
-- 5 km da aldeia. O POLO BASE TOOTOTOBI tem o CNES a 139 km da aldeia e o
-- mapa a 238 km: o CNES é menos errado, não é certo, e trocar um erro grande
-- por outro erro grande não é correção. Esses ficam de fora.
--
-- O QUE MUDA, DO MAIOR ERRO PARA O MENOR
--
--     22.88 km  Leste de Roraima       SÃO FRANCISCO            aldeia SÃO FRANCISCO          (o CNES está a 0.17 km dela)
--     16.98 km  Médio Rio Solimões e   BUGAIO                   aldeia Bugaio                 (o CNES está a 0.28 km dela)
--      14.1 km  Leste de Roraima       JACAREZINHO              aldeia JACAREZINHO            (o CNES está a 3.53 km dela)
--     12.82 km  Leste de Roraima       JACAMIM                  aldeia JACAMIM                (o CNES está a 2.09 km dela)
--     12.25 km  Pernambuco             XUKURU DE CIMBRES        aldeia CIMBRES                (o CNES está a 0.16 km dela)
--      11.6 km  Alagoas e Sergipe      KOIUPANKÁ                aldeia Koiupanká              (o CNES está a 0.17 km dela)
--      9.04 km  Leste de Roraima       TESO DO GAVIÃO           aldeia GAVIÃO                 (o CNES está a 0.36 km dela)
--      8.96 km  Leste de Roraima       MATURUCA                 aldeia MATURUCA               (o CNES está a 0.38 km dela)
--      7.52 km  Leste de Roraima       JATAPUZINHO              aldeia JATAPUZINHO            (o CNES está a 0.23 km dela)
--      6.95 km  Leste de Roraima       SERRA DO SOL             aldeia SERRA DO SOL           (o CNES está a 0.22 km dela)
--      6.88 km  Leste de Roraima       CAMARA                   aldeia CAMARA                 (o CNES está a 0.11 km dela)
--      5.98 km  Alto Rio Solimões      FILADÉLFIA               aldeia FILADELFIA             (o CNES está a 0.59 km dela)
--      5.72 km  Leste de Roraima       PEDRA PRETA              aldeia PEDRA PRETA            (o CNES está a 0.26 km dela)
--      5.57 km  Leste de Roraima       SOROCAIMA II             aldeia SOROCAIMA II           (o CNES está a 0.13 km dela)
--      5.34 km  Manaus                 PANTALEÃO                aldeia PANTALEÃO              (o CNES está a 0.65 km dela)
--      5.31 km  Leste de Roraima       MORRO                    aldeia MORRO                  (o CNES está a 0.29 km dela)
--      4.61 km  Médio Rio Solimões e   MARAJAÍ                  aldeia MARAJAÍ                (o CNES está a 0.3 km dela)
--      3.93 km  Leste de Roraima       PEDREIRA                 aldeia PEDREIRA               (o CNES está a 0.09 km dela)
--      3.41 km  Leste de Roraima       CARACANÃ                 aldeia CARACANÃ               (o CNES está a 0.35 km dela)
--      3.34 km  Leste de Roraima       MALACACHETA              aldeia MALACACHETA            (o CNES está a 0.21 km dela)
--       2.9 km  Minas Gerais e Espír   IRAJÁ                    aldeia Irajá                  (o CNES está a 0.44 km dela)
--      2.42 km  Leste de Roraima       BARRO                    aldeia BARRO                  (o CNES está a 0.31 km dela)
--      2.22 km  Alto Rio Solimões      NOVA ITÁLIA              aldeia NOVA ITALIA            (o CNES está a 0.07 km dela)
--
-- COMO APLICAR
--
-- 1. Correr a CONFERÊNCIA. Não altera nada. Esperado: 23 linhas.
-- 2. Correr a CORREÇÃO. Só escreve onde a coordenada atual for a auditada.
-- 3. Repetir a CONFERÊNCIA: atual deve passar a ser igual a nova.
--
-- Pode ser aplicado antes ou depois do ficheiro dos 56: os conjuntos de polos
-- não se cruzam, e cada UPDATE só toca no que a sua própria guarda reconhece.
-- ---------------------------------------------------------------------------

-- ============================ 1. CONFERÊNCIA ===============================

with correcao(dsei, polo, lat, lon, de_lat, de_lon) as (values
    ('LESTE DE RORAIMA', 'SÃO FRANCISCO', 3.958945, -60.441636, 3.769000, -60.365700),
    ('MEDIO RIO SOLIMOES E AFLUENTES', 'BUGAIO', -2.823544, -66.900902, -2.807500, -67.051200),
    ('LESTE DE RORAIMA', 'JACAREZINHO', 3.796111, -59.733944, 3.769300, -59.825400),
    ('LESTE DE RORAIMA', 'JACAMIM', 2.160914, -59.771986, 2.167300, -59.898900),
    ('PERNAMBUCO', 'XUKURU DE CIMBRES', -8.340969, -36.828919, -8.393600, -36.732400),
    ('ALAGOAS E SERGIPE', 'KOIUPANKÁ', -9.215707, -37.755568, -9.273900, -37.669100),
    ('LESTE DE RORAIMA', 'TESO DO GAVIÃO', 4.121462, -60.361560, 4.101100, -60.441100),
    ('LESTE DE RORAIMA', 'MATURUCA', 4.467511, -60.099169, 4.470700, -60.179700),
    ('LESTE DE RORAIMA', 'JATAPUZINHO', 0.600453, -59.221122, 0.665400, -59.234900),
    ('LESTE DE RORAIMA', 'SERRA DO SOL', 4.942925, -60.470214, 4.943500, -60.409500),
    ('LESTE DE RORAIMA', 'CAMARA', 3.998128, -60.178286, 4.006400, -60.117500),
    ('ALTO RIO SOLIMOES', 'FILADÉLFIA', -4.384430, -69.994466, -4.390300, -69.941900),
    ('LESTE DE RORAIMA', 'PEDRA PRETA', 4.711858, -60.475236, 4.710100, -60.528400),
    ('LESTE DE RORAIMA', 'SOROCAIMA II', 4.413420, -61.161919, 4.415900, -61.110600),
    ('MANAUS', 'PANTALEÃO', -3.580616, -59.130918, -3.604300, -59.177300),
    ('LESTE DE RORAIMA', 'MORRO', 4.358795, -59.971578, 4.359500, -59.922300),
    ('MEDIO RIO SOLIMOES E AFLUENTES', 'MARAJAÍ', -3.176983, -64.826209, -3.178600, -64.869900),
    ('LESTE DE RORAIMA', 'PEDREIRA', 4.474712, -60.801819, 4.488100, -60.835300),
    ('LESTE DE RORAIMA', 'CARACANÃ', 4.698469, -60.265619, 4.669800, -60.268000),
    ('LESTE DE RORAIMA', 'MALACACHETA', 2.667753, -60.454419, 2.687000, -60.475800),
    ('MINAS GERAIS E ESPIRITO SANTO', 'IRAJÁ', -19.904659, -40.221001, -19.879000, -40.236200),
    ('LESTE DE RORAIMA', 'BARRO', 4.195152, -60.791582, 4.195700, -60.767000),
    ('ALTO RIO SOLIMOES', 'NOVA ITÁLIA', -3.409263, -68.225226, -3.392100, -68.235400)
),
atuais as (
  select
    dsei.value ->> 'k'              as dsei,
    polo.value ->> 'n'              as polo,
    (polo.value ->> 'lat')::numeric as atual_lat,
    (polo.value ->> 'lon')::numeric as atual_lon
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
    ('LESTE DE RORAIMA', 'SÃO FRANCISCO', 3.958945, -60.441636, 3.769000, -60.365700),
    ('MEDIO RIO SOLIMOES E AFLUENTES', 'BUGAIO', -2.823544, -66.900902, -2.807500, -67.051200),
    ('LESTE DE RORAIMA', 'JACAREZINHO', 3.796111, -59.733944, 3.769300, -59.825400),
    ('LESTE DE RORAIMA', 'JACAMIM', 2.160914, -59.771986, 2.167300, -59.898900),
    ('PERNAMBUCO', 'XUKURU DE CIMBRES', -8.340969, -36.828919, -8.393600, -36.732400),
    ('ALAGOAS E SERGIPE', 'KOIUPANKÁ', -9.215707, -37.755568, -9.273900, -37.669100),
    ('LESTE DE RORAIMA', 'TESO DO GAVIÃO', 4.121462, -60.361560, 4.101100, -60.441100),
    ('LESTE DE RORAIMA', 'MATURUCA', 4.467511, -60.099169, 4.470700, -60.179700),
    ('LESTE DE RORAIMA', 'JATAPUZINHO', 0.600453, -59.221122, 0.665400, -59.234900),
    ('LESTE DE RORAIMA', 'SERRA DO SOL', 4.942925, -60.470214, 4.943500, -60.409500),
    ('LESTE DE RORAIMA', 'CAMARA', 3.998128, -60.178286, 4.006400, -60.117500),
    ('ALTO RIO SOLIMOES', 'FILADÉLFIA', -4.384430, -69.994466, -4.390300, -69.941900),
    ('LESTE DE RORAIMA', 'PEDRA PRETA', 4.711858, -60.475236, 4.710100, -60.528400),
    ('LESTE DE RORAIMA', 'SOROCAIMA II', 4.413420, -61.161919, 4.415900, -61.110600),
    ('MANAUS', 'PANTALEÃO', -3.580616, -59.130918, -3.604300, -59.177300),
    ('LESTE DE RORAIMA', 'MORRO', 4.358795, -59.971578, 4.359500, -59.922300),
    ('MEDIO RIO SOLIMOES E AFLUENTES', 'MARAJAÍ', -3.176983, -64.826209, -3.178600, -64.869900),
    ('LESTE DE RORAIMA', 'PEDREIRA', 4.474712, -60.801819, 4.488100, -60.835300),
    ('LESTE DE RORAIMA', 'CARACANÃ', 4.698469, -60.265619, 4.669800, -60.268000),
    ('LESTE DE RORAIMA', 'MALACACHETA', 2.667753, -60.454419, 2.687000, -60.475800),
    ('MINAS GERAIS E ESPIRITO SANTO', 'IRAJÁ', -19.904659, -40.221001, -19.879000, -40.236200),
    ('LESTE DE RORAIMA', 'BARRO', 4.195152, -60.791582, 4.195700, -60.767000),
    ('ALTO RIO SOLIMOES', 'NOVA ITÁLIA', -3.409263, -68.225226, -3.392100, -68.235400)
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
    ('LESTE DE RORAIMA', 'SÃO FRANCISCO', 3.958945, -60.441636, 3.769000, -60.365700),
    ('MEDIO RIO SOLIMOES E AFLUENTES', 'BUGAIO', -2.823544, -66.900902, -2.807500, -67.051200),
    ('LESTE DE RORAIMA', 'JACAREZINHO', 3.796111, -59.733944, 3.769300, -59.825400),
    ('LESTE DE RORAIMA', 'JACAMIM', 2.160914, -59.771986, 2.167300, -59.898900),
    ('PERNAMBUCO', 'XUKURU DE CIMBRES', -8.340969, -36.828919, -8.393600, -36.732400),
    ('ALAGOAS E SERGIPE', 'KOIUPANKÁ', -9.215707, -37.755568, -9.273900, -37.669100),
    ('LESTE DE RORAIMA', 'TESO DO GAVIÃO', 4.121462, -60.361560, 4.101100, -60.441100),
    ('LESTE DE RORAIMA', 'MATURUCA', 4.467511, -60.099169, 4.470700, -60.179700),
    ('LESTE DE RORAIMA', 'JATAPUZINHO', 0.600453, -59.221122, 0.665400, -59.234900),
    ('LESTE DE RORAIMA', 'SERRA DO SOL', 4.942925, -60.470214, 4.943500, -60.409500),
    ('LESTE DE RORAIMA', 'CAMARA', 3.998128, -60.178286, 4.006400, -60.117500),
    ('ALTO RIO SOLIMOES', 'FILADÉLFIA', -4.384430, -69.994466, -4.390300, -69.941900),
    ('LESTE DE RORAIMA', 'PEDRA PRETA', 4.711858, -60.475236, 4.710100, -60.528400),
    ('LESTE DE RORAIMA', 'SOROCAIMA II', 4.413420, -61.161919, 4.415900, -61.110600),
    ('MANAUS', 'PANTALEÃO', -3.580616, -59.130918, -3.604300, -59.177300),
    ('LESTE DE RORAIMA', 'MORRO', 4.358795, -59.971578, 4.359500, -59.922300),
    ('MEDIO RIO SOLIMOES E AFLUENTES', 'MARAJAÍ', -3.176983, -64.826209, -3.178600, -64.869900),
    ('LESTE DE RORAIMA', 'PEDREIRA', 4.474712, -60.801819, 4.488100, -60.835300),
    ('LESTE DE RORAIMA', 'CARACANÃ', 4.698469, -60.265619, 4.669800, -60.268000),
    ('LESTE DE RORAIMA', 'MALACACHETA', 2.667753, -60.454419, 2.687000, -60.475800),
    ('MINAS GERAIS E ESPIRITO SANTO', 'IRAJÁ', -19.904659, -40.221001, -19.879000, -40.236200),
    ('LESTE DE RORAIMA', 'BARRO', 4.195152, -60.791582, 4.195700, -60.767000),
    ('ALTO RIO SOLIMOES', 'NOVA ITÁLIA', -3.409263, -68.225226, -3.392100, -68.235400)
),
atuais as (
  select
    dsei.value ->> 'k'              as dsei,
    polo.value ->> 'n'              as polo,
    (polo.value ->> 'lat')::numeric as atual_lat,
    (polo.value ->> 'lon')::numeric as atual_lon
  from "TB_CONFIG_MAPA_SAUDE_INDIG" cfg
  cross join lateral jsonb_array_elements(cfg.payload -> 'dsei') as dsei(value)
  cross join lateral jsonb_array_elements(coalesce(dsei.value -> 'polos', '[]'::jsonb)) as polo(value)
  where cfg.chave = 'lmap'
)
select a.dsei, a.polo, a.atual_lat, a.atual_lon, c.lat as nova_lat, c.lon as nova_lon
from atuais a
join correcao c on c.dsei = a.dsei and c.polo = a.polo
order by a.dsei, a.polo;
