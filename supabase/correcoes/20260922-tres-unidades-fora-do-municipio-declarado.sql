-- ---------------------------------------------------------------------------
-- TRÊS UNIDADES CUJA COORDENADA CAÍA FORA DO MUNICÍPIO DECLARADO
--
-- A segunda passagem da auditoria de localização comparou cada coordenada com
-- a malha do município que o próprio CNES declara. Cinquenta e duas caíam fora.
--
-- O PRIMEIRO ACHADO FOI QUE A MAIORIA NÃO É ERRO
--
-- Medida a distância de cada ponto à divisa do município declarado:
--
--     a menos de 2 km da divisa    20
--     2 a 10 km                    19
--     10 a 30 km                    7
--     mais de 30 km                 6
--
-- Vinte estavam praticamente em cima da linha, várias a cem metros. Isso não é
-- coordenada errada: são dois campos administrativos a discordar numa divisa
-- que o próprio IBGE não desenha com essa precisão. O critério da auditoria
-- passou a exigir 2 km de margem, e 53 "erros" viraram 31.
--
-- DOS 31 QUE RESTARAM, A ALDEIA RESOLVE TRÊS
--
-- Mesmo árbitro das correções anteriores: `aldeias_pontos` da Funai, com as
-- mesmas condições — o nome da aldeia aparece no nome da unidade, é a única
-- candidata do município, e a aldeia cai DENTRO do município declarado.
--
-- Quando as três condições se verificam, são dois campos independentes a
-- concordar — o município no cadastro e a posição da aldeia na Funai — contra
-- a coordenada sozinha.
--
--       9.84 km  5791944  UBSI TUPI II                     aldeia TUPI II      São Paulo de Olivença/AM
--       8.89 km  2463458  UBS INDIGENA ALDEIA PORQUINHOS   aldeia PORQUINHOS   Fernando Falcão/MA
--       5.84 km  6457401  POSTO DE SAUDE ALDEIA TROCARA    aldeia Trocará      Tucuruí/PA
--
-- O QUE FICA POR RESOLVER
--
-- Vinte e oito. Para elas, nenhuma aldeia do município declarado aparece no
-- nome da unidade, e sem isso não há como saber qual dos dois campos está
-- errado: a coordenada, ou o município. O padrão é sempre o município vizinho
-- — Vitória do Xingu contra Anapu, Parauapebas contra Marabá —, e escolher sem
-- prova seria trocar um erro conhecido por um erro invisível.
--
-- Essas precisam de quem conhece o território.
--
-- COMO APLICAR
--
-- 1. Correr a CONFERÊNCIA. Não altera nada. Esperado: 3 linhas.
-- 2. Correr a CORREÇÃO. Só escreve onde a coordenada atual for a auditada.
-- 3. Repetir a CONFERÊNCIA: atual deve passar a ser igual a nova.
--
-- PARA DESFAZER
--
-- Cada linha dos VALUES guarda de onde veio. No bloco da CORREÇÃO, trocar
-- `c.lat` por `c.de_lat` e `c.lon` por `c.de_lon` nos `jsonb_set`, e trocar
-- também as duas comparações da guarda.
-- ---------------------------------------------------------------------------

-- ============================ 1. CONFERÊNCIA ===============================

with correcao(cnes, lat, lon, de_lat, de_lon) as (values
    ('5791944', -4.21678888889, -69.4109361111, -4.143722, -69.46106),
    ('2463458', -6.09027777778, -45.5644444444, -6.09018, -45.64489),
    ('6457401', -3.5873055555556, -49.655666666667, -3.555398, -49.697428)
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
    ('5791944', -4.21678888889, -69.4109361111, -4.143722, -69.46106),
    ('2463458', -6.09027777778, -45.5644444444, -6.09018, -45.64489),
    ('6457401', -3.5873055555556, -49.655666666667, -3.555398, -49.697428)
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
    ('5791944', -4.21678888889, -69.4109361111, -4.143722, -69.46106),
    ('2463458', -6.09027777778, -45.5644444444, -6.09018, -45.64489),
    ('6457401', -3.5873055555556, -49.655666666667, -3.555398, -49.697428)
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
