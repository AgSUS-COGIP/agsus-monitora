-- ---------------------------------------------------------------------------
-- LEVA 26 UNIDADES PARA A ALDEIA QUE LHES DÁ NOME
--
-- Estes casos tinham ficado sem veredito. A coordenada do CNES cai fora do
-- município que o próprio CNES declara, e o mapa copia-a fielmente — não havia
-- segunda coordenada com que comparar, e a malha municipal só dizia "está
-- errada", não dizia onde é o certo.
--
-- A FONTE QUE FALTAVA
--
-- A Funai publica `Funai:aldeias_pontos`: 4730 aldeias com nome, município, UF
-- e coordenada. E estas unidades são nomeadas pelas aldeias — "PSI ALDEIA
-- CAJUEIRO", "POLO BASE SURUCUCU", "UBSI DA ALDEIA ROOSEVELT CENTRAL".
--
-- O CRITÉRIO, E O QUE ELE EXIGE
--
--   1. o nome da aldeia aparece como sequência de palavras inteiras no nome da
--      unidade, e é a ÚNICA aldeia candidata dentro daquele município;
--   2. nomes de aldeia com menos de cinco letras não contam — há dezenas de
--      "Centro" e de "Boa Vista" no país;
--   3. a aldeia tem de cair DENTRO do município que o CNES declara para a
--      unidade.
--
-- A terceira condição é o que torna isto seguro. Dois campos independentes — o
-- município no cadastro do estabelecimento e a posição da aldeia na base da
-- Funai — concordam entre si, e a coordenada do estabelecimento fica sozinha a
-- discordar. Sem ela, um município errado levaria a procurar a aldeia no sítio
-- errado e a corrigir para pior. Dos 27 candidatos, um foi descartado
-- exatamente por isso.
--
-- O QUE A COORDENADA NOVA É, E O QUE NÃO É
--
-- É o ponto que a Funai regista para a aldeia. Não é um levantamento do
-- edifício da unidade. Para um posto de saúde de aldeia os dois coincidem na
-- prática; para um polo base que atende várias aldeias, o ponto da aldeia que
-- lhe dá nome é a melhor aproximação disponível, e é muito melhor do que estar
-- a 183 km e noutro município.
--
-- O QUE MUDA, DO MAIOR ERRO PARA O MENOR
--
--     183.27 km  6934404  POLO BASE SURUCUCU                       aldeia SURUCUCU
--     155.21 km  9583785  POSTO DE SAUDE INDIGENA ALDEIA TANGURO   aldeia TANGURO
--     154.77 km  7688075  UNIDADE BASICA DE SAUDE INDIGENA SERRA   aldeia SERRA GRANDE
--     153.09 km  6856586  POLO BASE HAKOMA                         aldeia HAKOMA
--      139.5 km  9425640  POLO BASE CASA NOVA                      aldeia CASA NOVA
--     107.34 km  7591691  POLO BASE WARO APOMPO MUNDURUKU          aldeia MUNDURUKU
--      102.1 km  6992803  POLO BASE DE BELEM DO SOLIMOES           aldeia BELÉM DO SOLIMÕES
--      94.72 km  7803605  PSI ALDEIA CAJUEIRO                      aldeia Cajueiro
--      61.29 km  7575084  POLO BASE PONTA ALEGRE                   aldeia PONTA ALEGRE
--      59.73 km  2960982  UBSI DA ALDEIA ROOSEVELT CENTRAL         aldeia ROOSEVELT ( Central )
--      53.74 km  7590032  POSTO DE SAUDE INDIGENA ALDEIA GOROTIR   aldeia Gorotire
--      50.78 km  966282  POSTO DE SAUDE INDIGENA FURO SECO        aldeia Furo Seco
--       50.1 km  966274  POSTO DE SAUDE INDIGENA PAQUICAMBA       aldeia Paquiçamba
--      43.79 km  5041007  UNIDADE BASICA DE SAUDE INDIGENA CUJUB   aldeia CUJUBIM
--      41.57 km  4974522  UBSI BAIXA VERDE                         aldeia Baixa Verde
--      40.17 km  4207025  UNIDADE BASICA DE SAUDE INDIGENA IRMA    aldeia IRMÃ CLEUSA
--      40.17 km  9427104  UNIDADE BASICA DE SAUDE INDIGENA IRMA    aldeia IRMÃ CLEUSA
--      39.74 km  7921667  UBSI ALDEIA SAO PEDRO                    aldeia São Pedro
--      35.81 km  4514823  UBSI NOSSA SENHORA DE NAZARE             aldeia NOSSA SENHORA DE NAZARÉ
--       34.6 km  7906315  POSTO DE SAUDE ALDEIA LINHA 10           aldeia Linha 10
--      33.84 km  9493263  POLO BASE BALAIO                         aldeia BALAIO
--      30.33 km  2402513  USFI INDIGENA BATIDA                     aldeia BATIDA
--      23.01 km  868361  POSTO DE SAUDE ALDEIA LAGE NOVO          aldeia Lage Novo
--      20.32 km  843032  POLO BASE SAO FRANCISCO                  aldeia SÃO FRANCISCO
--      12.94 km  7224230  UNIDADE BASICA DE SAUDE INDIGINA PORTE   aldeia porteira
--      10.01 km  7231261  UNIDADE BASICA DE SAUDE INDIGINA SALTO   aldeia salto
--
-- COMO APLICAR
--
-- 1. Correr a CONFERÊNCIA. Não altera nada. Esperado: 26 linhas.
-- 2. Correr a CORREÇÃO. Só escreve onde a coordenada atual for a auditada.
-- 3. Repetir a CONFERÊNCIA: atual deve passar a ser igual a nova.
-- ---------------------------------------------------------------------------

-- ============================ 1. CONFERÊNCIA ===============================

with correcao(cnes, lat, lon, de_lat, de_lon) as (values
    ('6934404', 2.836686, -63.641794, 2.686546, -61.998596),
    ('9583785', -13.546722, -51.872500, -12.598185, -52.923736),
    ('7688075', -8.626111, -47.418056, -7.392000, -46.768000),
    ('6856586', 2.719358, -63.574908, 2.476645, -62.218323),
    ('9425640', -7.305289, -65.260478, -7.333344, -63.995910),
    ('7591691', -6.202753, -57.682153, -6.042236, -58.639526),
    ('6992803', -4.041650, -69.524614, -4.940000, -69.334200),
    ('7803605', -2.742967, -46.696483, -2.199500, -47.353000),
    ('7575084', -3.301203, -57.053733, -2.804513, -56.814423),
    ('2960982', -11.489139, -60.466000, -11.525000, -61.013000),
    ('7590032', -7.765944, -51.134982, -7.629331, -51.602783),
    ('966282', -3.481794, -51.773767, -3.114170, -51.502375),
    ('966274', -3.502778, -51.804694, -3.160267, -51.511428),
    ('5041007', -7.500197, -64.854294, -7.300660, -64.511940),
    ('4974522', -12.580083, -61.850333, -12.753920, -61.511078),
    ('4207025', -7.698647, -64.559731, -7.415586, -64.333345),
    ('9427104', -7.698647, -64.559731, -7.415586, -64.333345),
    ('7921667', -1.844939, -46.981433, -1.511132, -46.853600),
    ('4514823', -3.548406, -69.150575, -3.233755, -69.219360),
    ('7906315', -10.603333, -65.083278, -10.475659, -64.794617),
    ('9493263', 0.388225, -66.646950, 0.231850, -66.385865),
    ('2402513', -9.156439, -38.383544, -9.399944, -38.258919),
    ('868361', -10.597750, -64.994250, -10.499965, -64.808693),
    ('843032', -7.262297, -65.362181, -7.153945, -65.213901),
    ('7224230', -9.450278, -48.368889, -9.564000, -48.394000),
    ('7231261', -9.485556, -48.352222, -9.564000, -48.397000)
),
atuais as (
  select
    (item.value ->> 1)          as cnes,
    (item.value ->> 0)          as nome,
    (item.value ->> 2)::numeric as atual_lat,
    (item.value ->> 3)::numeric as atual_lon
  from "TB_CONFIG_MAPA_SAUDE_INDIG" cfg
  cross join lateral (
    select unidade.value
      from jsonb_each(cfg.payload -> 'rede') as dsei(key, value)
      cross join lateral jsonb_array_elements(dsei.value -> 'u') as unidade(value)
    union all
    select casai.value
      from jsonb_each(cfg.payload -> 'rede') as dsei(key, value)
      cross join lateral jsonb_array_elements(dsei.value -> 'c') as casai(value)
    union all
    select nacional.value
      from jsonb_array_elements(coalesce(cfg.payload -> 'nac', '[]'::jsonb)) as nacional(value)
  ) as item
  where cfg.chave = 'rede_cnes'
)
select a.cnes, a.nome, a.atual_lat, a.atual_lon, c.lat as nova_lat, c.lon as nova_lon
from atuais a
join correcao c on c.cnes = a.cnes
order by a.cnes;

-- ============================ 2. CORREÇÃO ==================================

with correcao(cnes, lat, lon, de_lat, de_lon) as (values
    ('6934404', 2.836686, -63.641794, 2.686546, -61.998596),
    ('9583785', -13.546722, -51.872500, -12.598185, -52.923736),
    ('7688075', -8.626111, -47.418056, -7.392000, -46.768000),
    ('6856586', 2.719358, -63.574908, 2.476645, -62.218323),
    ('9425640', -7.305289, -65.260478, -7.333344, -63.995910),
    ('7591691', -6.202753, -57.682153, -6.042236, -58.639526),
    ('6992803', -4.041650, -69.524614, -4.940000, -69.334200),
    ('7803605', -2.742967, -46.696483, -2.199500, -47.353000),
    ('7575084', -3.301203, -57.053733, -2.804513, -56.814423),
    ('2960982', -11.489139, -60.466000, -11.525000, -61.013000),
    ('7590032', -7.765944, -51.134982, -7.629331, -51.602783),
    ('966282', -3.481794, -51.773767, -3.114170, -51.502375),
    ('966274', -3.502778, -51.804694, -3.160267, -51.511428),
    ('5041007', -7.500197, -64.854294, -7.300660, -64.511940),
    ('4974522', -12.580083, -61.850333, -12.753920, -61.511078),
    ('4207025', -7.698647, -64.559731, -7.415586, -64.333345),
    ('9427104', -7.698647, -64.559731, -7.415586, -64.333345),
    ('7921667', -1.844939, -46.981433, -1.511132, -46.853600),
    ('4514823', -3.548406, -69.150575, -3.233755, -69.219360),
    ('7906315', -10.603333, -65.083278, -10.475659, -64.794617),
    ('9493263', 0.388225, -66.646950, 0.231850, -66.385865),
    ('2402513', -9.156439, -38.383544, -9.399944, -38.258919),
    ('868361', -10.597750, -64.994250, -10.499965, -64.808693),
    ('843032', -7.262297, -65.362181, -7.153945, -65.213901),
    ('7224230', -9.450278, -48.368889, -9.564000, -48.394000),
    ('7231261', -9.485556, -48.352222, -9.564000, -48.397000)
)
update "TB_CONFIG_MAPA_SAUDE_INDIG" cfg
set payload = jsonb_set(
  jsonb_set(
    cfg.payload,
    '{rede}',
    (
      select jsonb_object_agg(
        dsei.key,
        jsonb_set(
          jsonb_set(
            dsei.value,
            '{u}',
            (
              select coalesce(jsonb_agg((
              select coalesce(
                (
                  select jsonb_set(
                           jsonb_set(x.value, '{2}', to_jsonb(c.lat)),
                           '{3}', to_jsonb(c.lon))
                  from correcao c
                  where c.cnes = x.value ->> 1
                    and (x.value ->> 2)::numeric = c.de_lat
                    and (x.value ->> 3)::numeric = c.de_lon
                ),
                x.value)
            ) order by x.ordem), '[]'::jsonb)
              from jsonb_array_elements(dsei.value -> 'u') with ordinality as x(value, ordem)
            )
          ),
          '{c}',
          (
            select coalesce(jsonb_agg((
              select coalesce(
                (
                  select jsonb_set(
                           jsonb_set(y.value, '{2}', to_jsonb(c.lat)),
                           '{3}', to_jsonb(c.lon))
                  from correcao c
                  where c.cnes = y.value ->> 1
                    and (y.value ->> 2)::numeric = c.de_lat
                    and (y.value ->> 3)::numeric = c.de_lon
                ),
                y.value)
            ) order by y.ordem), '[]'::jsonb)
            from jsonb_array_elements(dsei.value -> 'c') with ordinality as y(value, ordem)
          )
        )
      )
      from jsonb_each(cfg.payload -> 'rede') as dsei(key, value)
    )
  ),
  '{nac}',
  (
    select coalesce(jsonb_agg((
              select coalesce(
                (
                  select jsonb_set(
                           jsonb_set(z.value, '{2}', to_jsonb(c.lat)),
                           '{3}', to_jsonb(c.lon))
                  from correcao c
                  where c.cnes = z.value ->> 1
                    and (z.value ->> 2)::numeric = c.de_lat
                    and (z.value ->> 3)::numeric = c.de_lon
                ),
                z.value)
            ) order by z.ordem), '[]'::jsonb)
    from jsonb_array_elements(coalesce(cfg.payload -> 'nac', '[]'::jsonb))
         with ordinality as z(value, ordem)
  )
)
where cfg.chave = 'rede_cnes';

-- ============================ 3. VERIFICAÇÃO ===============================

with correcao(cnes, lat, lon, de_lat, de_lon) as (values
    ('6934404', 2.836686, -63.641794, 2.686546, -61.998596),
    ('9583785', -13.546722, -51.872500, -12.598185, -52.923736),
    ('7688075', -8.626111, -47.418056, -7.392000, -46.768000),
    ('6856586', 2.719358, -63.574908, 2.476645, -62.218323),
    ('9425640', -7.305289, -65.260478, -7.333344, -63.995910),
    ('7591691', -6.202753, -57.682153, -6.042236, -58.639526),
    ('6992803', -4.041650, -69.524614, -4.940000, -69.334200),
    ('7803605', -2.742967, -46.696483, -2.199500, -47.353000),
    ('7575084', -3.301203, -57.053733, -2.804513, -56.814423),
    ('2960982', -11.489139, -60.466000, -11.525000, -61.013000),
    ('7590032', -7.765944, -51.134982, -7.629331, -51.602783),
    ('966282', -3.481794, -51.773767, -3.114170, -51.502375),
    ('966274', -3.502778, -51.804694, -3.160267, -51.511428),
    ('5041007', -7.500197, -64.854294, -7.300660, -64.511940),
    ('4974522', -12.580083, -61.850333, -12.753920, -61.511078),
    ('4207025', -7.698647, -64.559731, -7.415586, -64.333345),
    ('9427104', -7.698647, -64.559731, -7.415586, -64.333345),
    ('7921667', -1.844939, -46.981433, -1.511132, -46.853600),
    ('4514823', -3.548406, -69.150575, -3.233755, -69.219360),
    ('7906315', -10.603333, -65.083278, -10.475659, -64.794617),
    ('9493263', 0.388225, -66.646950, 0.231850, -66.385865),
    ('2402513', -9.156439, -38.383544, -9.399944, -38.258919),
    ('868361', -10.597750, -64.994250, -10.499965, -64.808693),
    ('843032', -7.262297, -65.362181, -7.153945, -65.213901),
    ('7224230', -9.450278, -48.368889, -9.564000, -48.394000),
    ('7231261', -9.485556, -48.352222, -9.564000, -48.397000)
),
atuais as (
  select
    (item.value ->> 1)          as cnes,
    (item.value ->> 0)          as nome,
    (item.value ->> 2)::numeric as atual_lat,
    (item.value ->> 3)::numeric as atual_lon
  from "TB_CONFIG_MAPA_SAUDE_INDIG" cfg
  cross join lateral (
    select unidade.value
      from jsonb_each(cfg.payload -> 'rede') as dsei(key, value)
      cross join lateral jsonb_array_elements(dsei.value -> 'u') as unidade(value)
    union all
    select casai.value
      from jsonb_each(cfg.payload -> 'rede') as dsei(key, value)
      cross join lateral jsonb_array_elements(dsei.value -> 'c') as casai(value)
    union all
    select nacional.value
      from jsonb_array_elements(coalesce(cfg.payload -> 'nac', '[]'::jsonb)) as nacional(value)
  ) as item
  where cfg.chave = 'rede_cnes'
)
select a.cnes, a.nome, a.atual_lat, a.atual_lon, c.lat as nova_lat, c.lon as nova_lon
from atuais a
join correcao c on c.cnes = a.cnes
order by a.cnes;
