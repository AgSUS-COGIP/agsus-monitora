-- ---------------------------------------------------------------------------
-- ALINHA 21 COORDENADAS COM O CNES OFICIAL
--
-- Auditoria de 21/09/2026: os 1080 códigos CNES do payload foram consultados
-- um a um na API de dados abertos do Ministério da Saúde. Todos existem e
-- todos têm coordenada oficial.
--
-- O CRITÉRIO
--
-- A coordenada oficial de cada estabelecimento foi testada contra a malha do
-- MUNICÍPIO que o próprio CNES declara para ele (IBGE, qualidade máxima). Só
-- entram aqui os casos em que:
--
--   1. a coordenada oficial cai DENTRO do município que ela própria declara, e
--   2. o que o mapa desenha diverge dela em 1 km ou mais.
--
-- Quando a coordenada oficial cai FORA do município que declara, ela não serve
-- de referência e o caso NÃO entra aqui. São 90 assim. Em 86 deles o mapa já
-- copia o oficial e não há o que trocar; nos outros 3 — Kató, Cucuí e Riozinho
-- — o mapa já usa a coordenada que cai dentro do município, pelo ficheiro
-- 20260921-coordenadas-cnes-fora-da-uf.sql.
--
-- O QUE MUDA, POR ORDEM DE DISTÂNCIA
--
--    71.771 km  4243897  POLO BASE INDIGENA CANTA GALO (em atualização 
--    56.483 km  843873  UNIDADE DE APOIO INDIGENA SAMAUMA
--    47.245 km  4243846  POLO BASE INDIGENA BARRO (em atualização cadas
--    45.198 km  7836929  POSTO DE SAUDE INDIGENA ALDEIA POTIKRO (em atu
--    42.141 km  7836775  POSTO DE SAUDE INDIGENA ALDEIA PYTOTKO (em atu
--     40.96 km  7834896  POSTO DE SAUDE INDIGENA ALDEIA MROTDJAN (em at
--    22.564 km  2595141  UNIDADE BASICA DE SAUDE RESERVA INDIGENA DE MA
--    19.444 km  7798555  CASAI DE GAUCHA DO NORTE (≈ por endereço)
--    16.765 km  7427204  CASAI CUIABA (≈ por endereço)
--     8.861 km  7898215  CASAI BRASÍLIA
--     8.629 km  7423888  UBSI ALDEIA MUA MIMATXI
--      7.28 km  4344693  CASA DE APOIO A SAUDE INDIGENA CASAI (≈ por en
--      5.48 km  6834957  POLO BASE DE SAUDE INDIGENA MARAJAI
--     4.688 km  7541023  CASAI SÃO PAULO
--      4.19 km  7116500  UNIDADE BASICA DE SAUDE AREA INDIGENA DE PALMA
--     3.372 km  9279695  POLO BASE MONGAGUA
--     3.314 km  7866429  POLO BASE DE GUARAPUAVA
--     2.906 km  4239814  POSTO DE SAUDE INDIGENA NOVA ESPERANCA (em atu
--     2.069 km  7079982  CASAI TANGARA DA SERRA
--     1.791 km  7815379  POLO BASE BAURU
--     1.391 km  5297532  EQUIPE MULTIDISCIPLINAR DE SAUDE INDIGENA
--
-- ESTRUTURA ASSUMIDA, E VERIFICADA
--
-- payload.rede tem exatamente 34 chaves, cada uma com os arrays 'u' e 'c';
-- payload.nac é um array. Cada linha é [nome, cnes, lat, lon, municipio, uf].
-- Confirmado sobre o payload em produção antes de gerar este ficheiro.
--
-- COMO APLICAR
--
-- 1. Correr a CONFERÊNCIA. Não altera nada. Esperado: 21 linhas, com
--    atual_lat/atual_lon diferentes de nova_lat/nova_lon. Se vierem menos de
--    21, PARE: o payload mudou desde a auditoria.
-- 2. Correr a CORREÇÃO.
-- 3. Repetir a CONFERÊNCIA: agora atual deve ser igual a nova.
--
-- O UPDATE só escreve onde a coordenada atual for exatamente a auditada. Para
-- desfazer, trocar c.lat/c.lon por c.de_lat/c.de_lon nas duas primeiras linhas
-- do jsonb_set, e de_lat/de_lon por lat/lon na condição.
-- ---------------------------------------------------------------------------

-- ============================ 1. CONFERÊNCIA ===============================

with correcao(cnes, lat, lon, de_lat, de_lon) as (values
    ('4243897', 4.188250, -60.546244, 4.431000, -61.146000),
    ('843873', 0.884000, -59.696000, 0.443569, -59.442902),
    ('4243846', 4.195152, -60.791582, 4.431000, -61.146000),
    ('7836929', -3.859256, -51.315944, -3.469241, -51.201194),
    ('7836775', -3.841202, -51.273975, -3.469241, -51.201194),
    ('7834896', -3.833576, -51.255604, -3.469241, -51.201194),
    ('2595141', -25.947993, -52.174952, -25.935429, -52.400179),
    ('7798555', -13.187503, -53.258810, -13.182000, -53.079300),
    ('7427204', -15.740290, -56.058975, -15.589600, -56.064000),
    ('7898215', -15.750355, -47.715662, -15.721900, -47.793000),
    ('7423888', -20.470320, -45.043216, -20.473000, -45.126000),
    ('4344693', -20.485463, -54.641899, -20.427500, -54.609400),
    ('6834957', -3.176983, -64.826209, -3.221000, -64.804000),
    ('7541023', -23.582050, -46.613640, -23.567291, -46.570551),
    ('7116500', -26.512711, -52.031400, -26.488347, -51.999282),
    ('9279695', -24.111689, -46.652404, -24.092649, -46.626548),
    ('7866429', -25.390637, -51.460226, -25.364416, -51.475916),
    ('4239814', 4.442156, -61.122264, 4.430974, -61.145954),
    ('7079982', -14.618987, -57.486026, -14.606051, -57.472208),
    ('7815379', -22.339568, -49.062421, -22.333373, -49.078495),
    ('5297532', -17.032477, -39.535573, -17.041721, -39.526760)
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
    ('4243897', 4.188250, -60.546244, 4.431000, -61.146000),
    ('843873', 0.884000, -59.696000, 0.443569, -59.442902),
    ('4243846', 4.195152, -60.791582, 4.431000, -61.146000),
    ('7836929', -3.859256, -51.315944, -3.469241, -51.201194),
    ('7836775', -3.841202, -51.273975, -3.469241, -51.201194),
    ('7834896', -3.833576, -51.255604, -3.469241, -51.201194),
    ('2595141', -25.947993, -52.174952, -25.935429, -52.400179),
    ('7798555', -13.187503, -53.258810, -13.182000, -53.079300),
    ('7427204', -15.740290, -56.058975, -15.589600, -56.064000),
    ('7898215', -15.750355, -47.715662, -15.721900, -47.793000),
    ('7423888', -20.470320, -45.043216, -20.473000, -45.126000),
    ('4344693', -20.485463, -54.641899, -20.427500, -54.609400),
    ('6834957', -3.176983, -64.826209, -3.221000, -64.804000),
    ('7541023', -23.582050, -46.613640, -23.567291, -46.570551),
    ('7116500', -26.512711, -52.031400, -26.488347, -51.999282),
    ('9279695', -24.111689, -46.652404, -24.092649, -46.626548),
    ('7866429', -25.390637, -51.460226, -25.364416, -51.475916),
    ('4239814', 4.442156, -61.122264, 4.430974, -61.145954),
    ('7079982', -14.618987, -57.486026, -14.606051, -57.472208),
    ('7815379', -22.339568, -49.062421, -22.333373, -49.078495),
    ('5297532', -17.032477, -39.535573, -17.041721, -39.526760)
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
    ('4243897', 4.188250, -60.546244, 4.431000, -61.146000),
    ('843873', 0.884000, -59.696000, 0.443569, -59.442902),
    ('4243846', 4.195152, -60.791582, 4.431000, -61.146000),
    ('7836929', -3.859256, -51.315944, -3.469241, -51.201194),
    ('7836775', -3.841202, -51.273975, -3.469241, -51.201194),
    ('7834896', -3.833576, -51.255604, -3.469241, -51.201194),
    ('2595141', -25.947993, -52.174952, -25.935429, -52.400179),
    ('7798555', -13.187503, -53.258810, -13.182000, -53.079300),
    ('7427204', -15.740290, -56.058975, -15.589600, -56.064000),
    ('7898215', -15.750355, -47.715662, -15.721900, -47.793000),
    ('7423888', -20.470320, -45.043216, -20.473000, -45.126000),
    ('4344693', -20.485463, -54.641899, -20.427500, -54.609400),
    ('6834957', -3.176983, -64.826209, -3.221000, -64.804000),
    ('7541023', -23.582050, -46.613640, -23.567291, -46.570551),
    ('7116500', -26.512711, -52.031400, -26.488347, -51.999282),
    ('9279695', -24.111689, -46.652404, -24.092649, -46.626548),
    ('7866429', -25.390637, -51.460226, -25.364416, -51.475916),
    ('4239814', 4.442156, -61.122264, 4.430974, -61.145954),
    ('7079982', -14.618987, -57.486026, -14.606051, -57.472208),
    ('7815379', -22.339568, -49.062421, -22.333373, -49.078495),
    ('5297532', -17.032477, -39.535573, -17.041721, -39.526760)
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
