-- ---------------------------------------------------------------------------
-- DESEMPILHA 72 UNIDADES QUE ESTAVAM NO CENTRO DO MUNICÍPIO
--
-- Varrendo os 34 DSEIs, 126 estabelecimentos partilhavam 11 coordenadas:
--
--      38 unidades  LESTE DE RORAIMA         4.5960, -60.1680
--       8 unidades  LESTE DE RORAIMA         3.6520, -61.3710
--       7 unidades  ALTAMIRA                 -3.2030, -52.2060
--       4 unidades  YANOMAMI                 2.9800, -61.2920
--       4 unidades  LESTE DE RORAIMA         2.9800, -61.2920
--       2 unidades  MARANHAO                 -3.5650, -45.9940
--       2 unidades  YANOMAMI                 3.6520, -61.3710
--       2 unidades  ALTO RIO NEGRO           -0.1300, -67.0890
--       1 unidades  VILHENA                  -11.4386, -61.4522
--       1 unidades  VILHENA                  -11.4386, -61.4522
--       1 unidades  YANOMAMI                 3.6520, -61.3710
--       1 unidades  YANOMAMI                 3.6520, -61.3710
--       1 unidades  YANOMAMI                 3.6520, -61.3710
--
-- Isto não é duplicação. São unidades diferentes e reais — 57 postos de saúde
-- indígena distintos, cada um com o seu CNES. O que está errado é a posição: o
-- cadastro não tem ponto para elas e ficou um ponto de referência do município.
--
-- A prova é a própria partilha. Uma coordenada que 57 unidades partilham não é
-- a posição de nenhuma delas. E no mapa isso aparece como um único marcador
-- onde deveriam estar 57, o que esconde a rede inteira de um distrito.
--
-- O ÁRBITRO, E AS TRÊS CONDIÇÕES
--
-- O mesmo que resolveu os 49 casos das correções anteriores: `aldeias_pontos`
-- da Funai, 4730 aldeias com nome, município e coordenada. Estas unidades são
-- nomeadas pelas aldeias que atendem.
--
--   1. o nome da aldeia aparece como sequência de palavras inteiras no nome da
--      unidade, e é a ÚNICA aldeia candidata dentro daquele município;
--   2. nomes de aldeia com menos de cinco letras não contam;
--   3. a aldeia tem de cair DENTRO do município, conferido contra a malha
--      municipal do IBGE em qualidade máxima.
--
-- A TERCEIRA CONDIÇÃO É O QUE TORNOU ISTO SEGURO
--
-- Emparelharam-se 78 unidades. Seis foram descartadas pela malha, e são
-- exatamente as que davam os saltos mais estranhos — todas em Óbidos:
--
--     374.15 km  UBSI URUNAI            aldeia Urunai
--     333.33 km  UBSI I BOCA DO MARAPI  aldeia Boca do marapí
--     327.71 km  UBSI I SANTO ANTONIO   aldeia Santo Antonio
--     310.44 km  UBSI PEDRA DA ONCA     aldeia Pedra da Onça
--        310 km  UBSI KUXARE            aldeia Kuxaré
--      282.6 km  UBSI I MARITEPU        aldeia Maritepú
--
-- A Funai atribui essas aldeias a Óbidos, mas as coordenadas dela caem fora de
-- Óbidos. Um dos dois campos está errado, e não se sabe qual. Ficam de fora.
--
-- OS SALTOS GRANDES QUE FICARAM, E POR QUE SÃO COERENTES
--
-- Onze aceites andam mais de 200 km, e isso incomoda até se olhar o tamanho do
-- município. Para cada um deles conferiu-se que a coordenada ANTIGA também cai
-- dentro do município e que o salto é menor do que o próprio município:
--
--     366 km  POSTO DE SAUDE INDIGENA KURUATXE   Altamira/PA     diâmetro 861 km
--     348 km  POLO BASE DE AUARIS                Amajari/RR      diâmetro 488 km
--     290 km  POLO BASE XITEI                    Alto Alegre/RR  diâmetro 385 km
--     210 km  POLO BASE SAO JOSE II              S. Gabriel/AM   diâmetro 624 km
--
-- Altamira tem 861 km de ponta a ponta. Andar 366 km lá dentro é ir da sede a
-- uma aldeia do Xingu, não é sair do município.
--
-- O QUE A COORDENADA NOVA É, E O QUE NÃO É
--
-- É o ponto que a Funai regista para a aldeia. Não é um levantamento do
-- edifício. Para um posto de aldeia os dois coincidem na prática; para um polo
-- base que atende várias aldeias, o ponto da aldeia que lhe dá nome é a melhor
-- aproximação disponível — e é muito melhor do que o centro do município,
-- empilhado com outras 56 unidades.
--
-- O QUE ISTO NÃO RESOLVE
--
-- Sobram 52 unidades em 8 coordenadas, das 126 em 11. Para elas o nome não
-- nomeia aldeia nenhuma do município, ou nomeia mais de uma, e ambiguidade não
-- é prova. Essas precisam de quem conhece o território.
--
-- O QUE MUDA, DO MAIOR ERRO PARA O MENOR
--
--       365.85 km   921351  POSTO DE SAUDE INDIGENA KURUATXE           aldeia Kuruatxê                 Altamira/PA
--       348.44 km  6784542  POLO BASE DE AUARIS                        aldeia Auaris                   Amajari/RR
--       348.31 km   921432  POSTO DE SAUDE INDIGENA TUKAYA             aldeia Tukayá                   Altamira/PA
--       344.62 km  9587012  UNIDADE BASICA DE SAUDE INDIGENA KOLULU    aldeia Kolulu                   Amajari/RR
--       309.48 km  9587004  POLO BASE ONKIOLA                          aldeia Onkiola                  Amajari/RR
--       290.45 km  9586989  POLO BASE KURATANHA                        aldeia Kuratanha                Amajari/RR
--       289.62 km  6554350  POLO BASE XITEI                            aldeia XITEI                    Alto Alegre/RR
--       274.72 km  6856330  POLO BASE HAXIU                            aldeia Haxiu                    Alto Alegre/RR
--       210.13 km  7620195  POLO BASE SAO JOSE II                      aldeia SÃO JOSE                 São Gabriel da Cachoeira/AM
--       205.22 km   921416  POSTO DE SAUDE INDIGENA TA AKATI           aldeia Ta-akati                 Altamira/PA
--       203.86 km  7620853  POLO BASE MARABITANA DO WAUPES             aldeia MARABITANA               São Gabriel da Cachoeira/AM
--       176.25 km   921408  POSTO DE SAUDE INDIGENA PARATATIM          aldeia Paratatim                Altamira/PA
--       161.41 km   921386  POSTO DE SAUDE INDIGENA PAKANA             aldeia Pakañã                   Altamira/PA
--       125.16 km   921033  POSTO DE SAUDE INDIGENA ARADYTI            aldeia Aradyti                  Altamira/PA
--          114 km  6784526  POLO BASE ERICO                            aldeia ERICÓ                    Amajari/RR
--       105.81 km  6856373  POLO BASE URARICOERA                       aldeia Uraricoera               Alto Alegre/RR
--       105.79 km  6856500  POLO BASE ALTO MUCAJAI                     aldeia ALTO MUCAJAI             Alto Alegre/RR
--        75.93 km   921157  POSTO DE SAUDE INDIGENA ITAAKA             aldeia Itaaka                   Altamira/PA
--        72.68 km  9326766  POSTO DE SAUDE INDIGENA MAPAE              aldeia MAPAÉ                    Uiramutã/RR
--        66.11 km  9327126  POSTO DE SAUDE INDIGENA CUTIA              aldeia CUTIA                    Uiramutã/RR
--        55.33 km  9326715  POSTO DE SAUDE INDIGENA AWENDEI            aldeia AWENDEI                  Uiramutã/RR
--        54.92 km  7806051  POSTO DE SAUDE INDIGENA PICARRA PRETA      aldeia PIÇARRA PRETA            Bom Jardim/MA
--        54.37 km  9345701  POSTO DE SAUDE INDIGENA ANARO              aldeia ANARO                    Amajari/RR
--        54.32 km  2319675  POLO BASE INDIGENA SANTA INES              aldeia SANTA INES               Amajari/RR
--        53.83 km  9326804  POSTO DE SAUDE INDIGENA SAUPARU            aldeia SAUPARU                  Uiramutã/RR
--        52.57 km  9327339  POSTO DE SAUDE INDIGENA TRIUNFO            aldeia TRIUNFO                  Uiramutã/RR
--        49.48 km  9345728  POSTO DE SAUDE INDIGENA JURACI             aldeia JURACI                   Amajari/RR
--        47.91 km  2566192  POSTO DE SAUDE INDIGENA PONTA DA SERRA     aldeia PONTA DA SERRA           Amajari/RR
--        47.46 km  9327274  POSTO DE SAUDE INDIGENA NOVA ALIANCA II    aldeia NOVA ALIANÇA II          Uiramutã/RR
--        46.32 km  9327266  POSTO DE SAUDE INDIGENA NOVA ALIANCA I     aldeia ALIANÇA I                Uiramutã/RR
--         45.8 km  9326782  POSTO DE SAUDE INDIGENA PARANA             aldeia PARANÃ                   Uiramutã/RR
--        41.55 km  7806078  POSTO DE SAUDE INDIGENA ALDEIA TIRACAMBU   aldeia Tiracambu                Bom Jardim/MA
--        41.45 km  9327118  POSTO DE SAUDE INDIGENA ARAMU              aldeia ARAMU                    Uiramutã/RR
--        40.62 km  9327673  POSTO DE SAUDE INDIGENA MUDUBIM            aldeia MUDUBIM                  Uiramutã/RR
--        40.55 km  9345116  UNIDADE DE APOIO INDIGENA BARATA           aldeia BARATA                   Alto Alegre/RR
--        38.05 km  9327185  POSTO DE SAUDE INDIGENA MUTUM              aldeia MUTUM                    Uiramutã/RR
--        37.32 km  9326693  POSTO DE SAUDE INDIGENA AREA UNICA         aldeia ÁREA ÚNICA               Uiramutã/RR
--        36.65 km  9327614  POSTO DE SAUDE INDIGENA AGUA FRIA          aldeia AGUA FRIA                Uiramutã/RR
--        34.16 km  9327657  POSTO DE SAUDE INDIGENA ESTEVAO            aldeia ESTEVÃO                  Uiramutã/RR
--        34.15 km  2589818  POLO BASE INDIGENA BOQUEIRAO               aldeia BOQUEIRÃO                Alto Alegre/RR
--        33.89 km  9327649  POSTO DE SAUDE INDIGENA CARAPARU IV        aldeia CARAPARÚ IV              Uiramutã/RR
--        33.11 km  9327207  POSTO DE SAUDE INDIGENA WARAPATA           aldeia WARAPATÁ                 Uiramutã/RR
--        31.97 km  9345671  UNIDADE DE APOIO INDIGENA MANGUEIRA        aldeia MANGUEIRA                Amajari/RR
--        31.87 km  9327711  POSTO DE SAUDE INDIGENA TABOCA             aldeia TABOCA                   Uiramutã/RR
--        31.72 km  9140743  UBSI LINHA 11 AMARAL                       aldeia AMARAL                   Cacoal/RO
--        30.74 km  9326812  POSTO DE SAUDE INDIGENA BANANEIRA          aldeia BANANEIRA                Uiramutã/RR
--        29.96 km  9327304  POSTO DE SAUDE INDIGENA SANTA LIBERDADE    aldeia SANTA LIBERDADE          Uiramutã/RR
--        29.39 km  9140654  UBSI LINHA 11 LAPETANHA                    aldeia LAPETANHA                Cacoal/RO
--        27.69 km  9345647  UNIDADE DE APOIO INDIGENA ANANAS           aldeia ANANÁS                   Amajari/RR
--        27.06 km  9327665  POSTO DE SAUDE INDIGENA MANAPARU           aldeia MANAPARU                 Uiramutã/RR
--        25.22 km  9327622  POSTO DE SAUDE INDIGENA CARAPARU III       aldeia CARAPARÚ III             Uiramutã/RR
--        22.44 km  2657236  UNIDADE DE APOIO INDIGENA ANINGAL          aldeia ANINGAL                  Amajari/RR
--        20.07 km  9327282  POSTO DE SAUDE INDIGENA PEDRA BRANCA (em   aldeia PEDRA BRANCA             Uiramutã/RR
--           20 km  9327703  POSTO DE SAUDE INDIGENA SOL NASCENTE       aldeia SOL NASCENTE             Uiramutã/RR
--        18.06 km  9327746  POSTO DE SAUDE INDIGENA TAMANDUA           aldeia TAMANDUÁ                 Uiramutã/RR
--        17.61 km  9327592  POSTO DE SAUDE INDIGENA SANTA CREUZA       aldeia SANTA CREUZA             Uiramutã/RR
--         16.9 km  9327509  POSTO DE SAUDE INDIGENA ANDORINHA          aldeia ANDORINHA                Uiramutã/RR
--        16.16 km  9327576  POSTO DE SAUDE INDIGENA SALVADOR           aldeia SALVADOR                 Uiramutã/RR
--        15.38 km  9327320  POSTO DE SAUDE INDIGENA TABATINGA          aldeia TABATINGA                Uiramutã/RR
--        14.14 km  9327568  POSTO DE SAUDE INDIGENA NOVA VIDA          aldeia NOVA VIDA                Uiramutã/RR
--        14.09 km  9327525  POSTO DE SAUDE INDIGENA MACUQUEM           aldeia MACUQUEM                 Uiramutã/RR
--        13.97 km  2319896  POSTO DE SAUDE INDIGENA SUCUBA             aldeia SUCUBA                   Alto Alegre/RR
--        13.84 km  9327517  POSTO DE SAUDE INDIGENA ARAPA              aldeia ARAPÁ                    Uiramutã/RR
--        13.78 km  9345663  UNIDADE DE APOIO INDIGENA GARAGEM          aldeia GARAGEM                  Amajari/RR
--        13.05 km  9326847  POSTO DE SAUDE INDIGENA FLEXALZINHO        aldeia FLEXALZINHO              Uiramutã/RR
--        11.26 km  9326855  POSTO DE SAUDE INDIGENA LILAS              aldeia LILAS                    Uiramutã/RR
--         10.8 km  9345140  POSTO DE SAUDE INDIGENA RAIMUNDAO II       aldeia RAIMUNDÃO II             Alto Alegre/RR
--         7.86 km  9326839  POSTO DE SAUDE INDIGENA CAMARAREM          aldeia CAMARARÉM                Uiramutã/RR
--         7.56 km  9327452  POSTO DE SAUDE INDIGENA PROTOTO            aldeia PROTOTÓ                  Uiramutã/RR
--         5.72 km  9327371  POSTO DE SAUDE INDIGENA KUMAPAI            aldeia KUMAPAI                  Uiramutã/RR
--         3.89 km  9327479  POSTO DE SAUDE INDIGENA SAO GABRIEL        aldeia SÃO GABRIEL              Uiramutã/RR
--         0.59 km  9327487  POSTO DE SAUDE INDIGENA UIRAMUTA           aldeia UIRAMUTÃ                 Uiramutã/RR
--
-- COMO APLICAR
--
-- 1. Correr a CONFERÊNCIA. Não altera nada. Esperado: 72 linhas.
-- 2. Correr a CORREÇÃO. Só escreve onde a coordenada atual for a auditada.
-- 3. Repetir a CONFERÊNCIA: atual deve passar a ser igual a nova.
--
-- PARA DESFAZER
--
-- Cada linha dos VALUES guarda de onde veio. No bloco da CORREÇÃO, trocar
-- `c.lat` por `c.de_lat` e `c.lon` por `c.de_lon` nos `jsonb_set`, e trocar
-- também as duas comparações da guarda, que passam a exigir a coordenada nova.
-- Aplicado assim, devolve as 72 ao ponto de partida.
-- ---------------------------------------------------------------------------

-- ============================ 1. CONFERÊNCIA ===============================

with correcao(cnes, lat, lon, de_lat, de_lon) as (values
    ('921351', -5.551, -54.5176944444, -3.203, -52.206),
    ('6784542', 4.003983303, -64.49171671, 3.65198, -61.371023),
    ('921432', -5.39111666667, -54.4539777778, -3.203, -52.206),
    ('9587012', 3.957245866, -64.461949659, 3.651959, -61.37098),
    ('9587004', 3.709981092, -64.159387751, 3.651959, -61.371023),
    ('9586989', 3.764163836, -63.986143091, 3.651959, -61.371023),
    ('6554350', 2.60684444444, -63.8727833333, 2.98, -61.292),
    ('6856330', 2.66895833333, -63.7459333333, 2.98, -61.292),
    ('7620195', 0.414719444444, -68.8985277778, -0.13, -67.089),
    ('921416', -4.93361111111, -52.8488888889, -3.203, -52.206),
    ('7620853', 0.433572222222, -68.8335805556, -0.13, -67.089),
    ('921408', -4.70055555556, -52.7266666667, -3.203, -52.206),
    ('921386', -4.6075, -52.5736111111, -3.203, -52.206),
    ('921033', -4.24027777778, -52.6440277778, -3.203, -52.206),
    ('6784526', 3.6357, -62.3980888889, 3.652002, -61.370959),
    ('6856373', 3.14592777778, -62.2303027778, 2.98, -61.292),
    ('6856500', 2.766035613, -62.220193954, 2.98, -61.292),
    ('921157', -3.78620555556, -52.5619194444, -3.203, -52.206),
    ('9326766', 5.15614722222, -60.5060777778, 4.596, -60.168),
    ('9327126', 4.16813333333, -59.7540222222, 4.596, -60.168),
    ('9326715', 5.03156944444, -60.4095166667, 4.596, -60.168),
    ('7806051', -3.62828333333, -45.5031861111, -3.565, -45.994),
    ('9345701', 3.93441944444, -60.9709444444, 3.652, -61.371),
    ('2319675', 4.13960277778, -61.3412416667, 3.652, -61.371),
    ('9326804', 5.0003, -60.4352694444, 4.596, -60.168),
    ('9327339', 4.230825, -60.4691, 4.596, -60.168),
    ('9345728', 3.64136666667, -60.9252777778, 3.652, -61.371),
    ('2566192', 3.58082777778, -60.9451722222, 3.652, -61.371),
    ('9327274', 4.215075, -60.3611972222, 4.596, -60.168),
    ('9327266', 4.21463611111, -60.3361666667, 4.596, -60.168),
    ('9326782', 4.94345833333, -60.3899305556, 4.596, -60.168),
    ('7806078', -3.87194444444, -46.2075, -3.565, -45.994),
    ('9327118', 4.32220277778, -59.9142777778, 4.596, -60.168),
    ('9327673', 4.42135, -60.4898722222, 4.596, -60.168),
    ('9345116', 3.27039166667, -61.0710361111, 2.98, -61.292),
    ('9327185', 4.45346944444, -59.8559666667, 4.596, -60.168),
    ('9326693', 4.8688, -60.3641083333, 4.596, -60.168),
    ('9327614', 4.64508055556, -60.4949805556, 4.596, -60.168),
    ('9327657', 4.44433333333, -60.4360027778, 4.596, -60.168),
    ('2589818', 3.28706666667, -61.2889583333, 2.98, -61.292),
    ('9327649', 4.55848055556, -60.4714194444, 4.596, -60.168),
    ('9327207', 4.41575833333, -59.9302222222, 4.596, -60.168),
    ('9345671', 3.65453333333, -61.0829388889, 3.652, -61.371),
    ('9327711', 4.59308055556, -60.4555083333, 4.596, -60.168),
    ('9140743', -11.1954166667, -61.2999972222, -11.438554, -61.452155),
    ('9326812', 4.32089444444, -60.195375, 4.596, -60.168),
    ('9327304', 4.32948888889, -60.12855, 4.596, -60.168),
    ('9140654', -11.2211888889, -61.2988861111, -11.438596, -61.452241),
    ('9345647', 3.89416666667, -61.4291666667, 3.652, -61.371),
    ('9327665', 4.54831111111, -60.4073861111, 4.596, -60.168),
    ('9327622', 4.58583333333, -60.3953333333, 4.596, -60.168),
    ('2657236', 3.45078611111, -61.3867388889, 3.652, -61.371),
    ('9327282', 4.44400555556, -60.2656111111, 4.596, -60.168),
    ('9327703', 4.492675, -60.3157333333, 4.596, -60.168),
    ('9327746', 4.57316944444, -60.3292888889, 4.596, -60.168),
    ('9327592', 4.64186944444, -60.3201166667, 4.596, -60.168),
    ('9327509', 4.73043888889, -60.2391305556, 4.596, -60.168),
    ('9327576', 4.72325555556, -60.2384833333, 4.596, -60.168),
    ('9327320', 4.49443611111, -60.2622305556, 4.596, -60.168),
    ('9327568', 4.64759444444, -60.2846194444, 4.596, -60.168),
    ('9327525', 4.68875277778, -60.254675, 4.596, -60.168),
    ('2319896', 2.99318055556, -61.16685, 2.98, -61.292),
    ('9327517', 4.63616388889, -60.28615, 4.596, -60.168),
    ('9345663', 3.771975, -61.3398222222, 3.652, -61.371),
    ('9326847', 4.49638055556, -60.2302638889, 4.596, -60.168),
    ('9326855', 4.49698055556, -60.1893222222, 4.596, -60.168),
    ('9345140', 2.89893611111, -61.3454944444, 2.98, -61.292),
    ('9326839', 4.52626111111, -60.1797305556, 4.596, -60.168),
    ('9327452', 4.654275, -60.2031138889, 4.596, -60.168),
    ('9327371', 4.6064, -60.1174527778, 4.596, -60.168),
    ('9327479', 4.62140555556, -60.1439166667, 4.596, -60.168),
    ('9327487', 4.59978611111, -60.1643333333, 4.596, -60.168)
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
    ('921351', -5.551, -54.5176944444, -3.203, -52.206),
    ('6784542', 4.003983303, -64.49171671, 3.65198, -61.371023),
    ('921432', -5.39111666667, -54.4539777778, -3.203, -52.206),
    ('9587012', 3.957245866, -64.461949659, 3.651959, -61.37098),
    ('9587004', 3.709981092, -64.159387751, 3.651959, -61.371023),
    ('9586989', 3.764163836, -63.986143091, 3.651959, -61.371023),
    ('6554350', 2.60684444444, -63.8727833333, 2.98, -61.292),
    ('6856330', 2.66895833333, -63.7459333333, 2.98, -61.292),
    ('7620195', 0.414719444444, -68.8985277778, -0.13, -67.089),
    ('921416', -4.93361111111, -52.8488888889, -3.203, -52.206),
    ('7620853', 0.433572222222, -68.8335805556, -0.13, -67.089),
    ('921408', -4.70055555556, -52.7266666667, -3.203, -52.206),
    ('921386', -4.6075, -52.5736111111, -3.203, -52.206),
    ('921033', -4.24027777778, -52.6440277778, -3.203, -52.206),
    ('6784526', 3.6357, -62.3980888889, 3.652002, -61.370959),
    ('6856373', 3.14592777778, -62.2303027778, 2.98, -61.292),
    ('6856500', 2.766035613, -62.220193954, 2.98, -61.292),
    ('921157', -3.78620555556, -52.5619194444, -3.203, -52.206),
    ('9326766', 5.15614722222, -60.5060777778, 4.596, -60.168),
    ('9327126', 4.16813333333, -59.7540222222, 4.596, -60.168),
    ('9326715', 5.03156944444, -60.4095166667, 4.596, -60.168),
    ('7806051', -3.62828333333, -45.5031861111, -3.565, -45.994),
    ('9345701', 3.93441944444, -60.9709444444, 3.652, -61.371),
    ('2319675', 4.13960277778, -61.3412416667, 3.652, -61.371),
    ('9326804', 5.0003, -60.4352694444, 4.596, -60.168),
    ('9327339', 4.230825, -60.4691, 4.596, -60.168),
    ('9345728', 3.64136666667, -60.9252777778, 3.652, -61.371),
    ('2566192', 3.58082777778, -60.9451722222, 3.652, -61.371),
    ('9327274', 4.215075, -60.3611972222, 4.596, -60.168),
    ('9327266', 4.21463611111, -60.3361666667, 4.596, -60.168),
    ('9326782', 4.94345833333, -60.3899305556, 4.596, -60.168),
    ('7806078', -3.87194444444, -46.2075, -3.565, -45.994),
    ('9327118', 4.32220277778, -59.9142777778, 4.596, -60.168),
    ('9327673', 4.42135, -60.4898722222, 4.596, -60.168),
    ('9345116', 3.27039166667, -61.0710361111, 2.98, -61.292),
    ('9327185', 4.45346944444, -59.8559666667, 4.596, -60.168),
    ('9326693', 4.8688, -60.3641083333, 4.596, -60.168),
    ('9327614', 4.64508055556, -60.4949805556, 4.596, -60.168),
    ('9327657', 4.44433333333, -60.4360027778, 4.596, -60.168),
    ('2589818', 3.28706666667, -61.2889583333, 2.98, -61.292),
    ('9327649', 4.55848055556, -60.4714194444, 4.596, -60.168),
    ('9327207', 4.41575833333, -59.9302222222, 4.596, -60.168),
    ('9345671', 3.65453333333, -61.0829388889, 3.652, -61.371),
    ('9327711', 4.59308055556, -60.4555083333, 4.596, -60.168),
    ('9140743', -11.1954166667, -61.2999972222, -11.438554, -61.452155),
    ('9326812', 4.32089444444, -60.195375, 4.596, -60.168),
    ('9327304', 4.32948888889, -60.12855, 4.596, -60.168),
    ('9140654', -11.2211888889, -61.2988861111, -11.438596, -61.452241),
    ('9345647', 3.89416666667, -61.4291666667, 3.652, -61.371),
    ('9327665', 4.54831111111, -60.4073861111, 4.596, -60.168),
    ('9327622', 4.58583333333, -60.3953333333, 4.596, -60.168),
    ('2657236', 3.45078611111, -61.3867388889, 3.652, -61.371),
    ('9327282', 4.44400555556, -60.2656111111, 4.596, -60.168),
    ('9327703', 4.492675, -60.3157333333, 4.596, -60.168),
    ('9327746', 4.57316944444, -60.3292888889, 4.596, -60.168),
    ('9327592', 4.64186944444, -60.3201166667, 4.596, -60.168),
    ('9327509', 4.73043888889, -60.2391305556, 4.596, -60.168),
    ('9327576', 4.72325555556, -60.2384833333, 4.596, -60.168),
    ('9327320', 4.49443611111, -60.2622305556, 4.596, -60.168),
    ('9327568', 4.64759444444, -60.2846194444, 4.596, -60.168),
    ('9327525', 4.68875277778, -60.254675, 4.596, -60.168),
    ('2319896', 2.99318055556, -61.16685, 2.98, -61.292),
    ('9327517', 4.63616388889, -60.28615, 4.596, -60.168),
    ('9345663', 3.771975, -61.3398222222, 3.652, -61.371),
    ('9326847', 4.49638055556, -60.2302638889, 4.596, -60.168),
    ('9326855', 4.49698055556, -60.1893222222, 4.596, -60.168),
    ('9345140', 2.89893611111, -61.3454944444, 2.98, -61.292),
    ('9326839', 4.52626111111, -60.1797305556, 4.596, -60.168),
    ('9327452', 4.654275, -60.2031138889, 4.596, -60.168),
    ('9327371', 4.6064, -60.1174527778, 4.596, -60.168),
    ('9327479', 4.62140555556, -60.1439166667, 4.596, -60.168),
    ('9327487', 4.59978611111, -60.1643333333, 4.596, -60.168)
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
    ('921351', -5.551, -54.5176944444, -3.203, -52.206),
    ('6784542', 4.003983303, -64.49171671, 3.65198, -61.371023),
    ('921432', -5.39111666667, -54.4539777778, -3.203, -52.206),
    ('9587012', 3.957245866, -64.461949659, 3.651959, -61.37098),
    ('9587004', 3.709981092, -64.159387751, 3.651959, -61.371023),
    ('9586989', 3.764163836, -63.986143091, 3.651959, -61.371023),
    ('6554350', 2.60684444444, -63.8727833333, 2.98, -61.292),
    ('6856330', 2.66895833333, -63.7459333333, 2.98, -61.292),
    ('7620195', 0.414719444444, -68.8985277778, -0.13, -67.089),
    ('921416', -4.93361111111, -52.8488888889, -3.203, -52.206),
    ('7620853', 0.433572222222, -68.8335805556, -0.13, -67.089),
    ('921408', -4.70055555556, -52.7266666667, -3.203, -52.206),
    ('921386', -4.6075, -52.5736111111, -3.203, -52.206),
    ('921033', -4.24027777778, -52.6440277778, -3.203, -52.206),
    ('6784526', 3.6357, -62.3980888889, 3.652002, -61.370959),
    ('6856373', 3.14592777778, -62.2303027778, 2.98, -61.292),
    ('6856500', 2.766035613, -62.220193954, 2.98, -61.292),
    ('921157', -3.78620555556, -52.5619194444, -3.203, -52.206),
    ('9326766', 5.15614722222, -60.5060777778, 4.596, -60.168),
    ('9327126', 4.16813333333, -59.7540222222, 4.596, -60.168),
    ('9326715', 5.03156944444, -60.4095166667, 4.596, -60.168),
    ('7806051', -3.62828333333, -45.5031861111, -3.565, -45.994),
    ('9345701', 3.93441944444, -60.9709444444, 3.652, -61.371),
    ('2319675', 4.13960277778, -61.3412416667, 3.652, -61.371),
    ('9326804', 5.0003, -60.4352694444, 4.596, -60.168),
    ('9327339', 4.230825, -60.4691, 4.596, -60.168),
    ('9345728', 3.64136666667, -60.9252777778, 3.652, -61.371),
    ('2566192', 3.58082777778, -60.9451722222, 3.652, -61.371),
    ('9327274', 4.215075, -60.3611972222, 4.596, -60.168),
    ('9327266', 4.21463611111, -60.3361666667, 4.596, -60.168),
    ('9326782', 4.94345833333, -60.3899305556, 4.596, -60.168),
    ('7806078', -3.87194444444, -46.2075, -3.565, -45.994),
    ('9327118', 4.32220277778, -59.9142777778, 4.596, -60.168),
    ('9327673', 4.42135, -60.4898722222, 4.596, -60.168),
    ('9345116', 3.27039166667, -61.0710361111, 2.98, -61.292),
    ('9327185', 4.45346944444, -59.8559666667, 4.596, -60.168),
    ('9326693', 4.8688, -60.3641083333, 4.596, -60.168),
    ('9327614', 4.64508055556, -60.4949805556, 4.596, -60.168),
    ('9327657', 4.44433333333, -60.4360027778, 4.596, -60.168),
    ('2589818', 3.28706666667, -61.2889583333, 2.98, -61.292),
    ('9327649', 4.55848055556, -60.4714194444, 4.596, -60.168),
    ('9327207', 4.41575833333, -59.9302222222, 4.596, -60.168),
    ('9345671', 3.65453333333, -61.0829388889, 3.652, -61.371),
    ('9327711', 4.59308055556, -60.4555083333, 4.596, -60.168),
    ('9140743', -11.1954166667, -61.2999972222, -11.438554, -61.452155),
    ('9326812', 4.32089444444, -60.195375, 4.596, -60.168),
    ('9327304', 4.32948888889, -60.12855, 4.596, -60.168),
    ('9140654', -11.2211888889, -61.2988861111, -11.438596, -61.452241),
    ('9345647', 3.89416666667, -61.4291666667, 3.652, -61.371),
    ('9327665', 4.54831111111, -60.4073861111, 4.596, -60.168),
    ('9327622', 4.58583333333, -60.3953333333, 4.596, -60.168),
    ('2657236', 3.45078611111, -61.3867388889, 3.652, -61.371),
    ('9327282', 4.44400555556, -60.2656111111, 4.596, -60.168),
    ('9327703', 4.492675, -60.3157333333, 4.596, -60.168),
    ('9327746', 4.57316944444, -60.3292888889, 4.596, -60.168),
    ('9327592', 4.64186944444, -60.3201166667, 4.596, -60.168),
    ('9327509', 4.73043888889, -60.2391305556, 4.596, -60.168),
    ('9327576', 4.72325555556, -60.2384833333, 4.596, -60.168),
    ('9327320', 4.49443611111, -60.2622305556, 4.596, -60.168),
    ('9327568', 4.64759444444, -60.2846194444, 4.596, -60.168),
    ('9327525', 4.68875277778, -60.254675, 4.596, -60.168),
    ('2319896', 2.99318055556, -61.16685, 2.98, -61.292),
    ('9327517', 4.63616388889, -60.28615, 4.596, -60.168),
    ('9345663', 3.771975, -61.3398222222, 3.652, -61.371),
    ('9326847', 4.49638055556, -60.2302638889, 4.596, -60.168),
    ('9326855', 4.49698055556, -60.1893222222, 4.596, -60.168),
    ('9345140', 2.89893611111, -61.3454944444, 2.98, -61.292),
    ('9326839', 4.52626111111, -60.1797305556, 4.596, -60.168),
    ('9327452', 4.654275, -60.2031138889, 4.596, -60.168),
    ('9327371', 4.6064, -60.1174527778, 4.596, -60.168),
    ('9327479', 4.62140555556, -60.1439166667, 4.596, -60.168),
    ('9327487', 4.59978611111, -60.1643333333, 4.596, -60.168)
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
