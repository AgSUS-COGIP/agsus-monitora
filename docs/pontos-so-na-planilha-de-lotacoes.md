# Pontos que só existiam na planilha de Lotações (02/10/2026)

Até 02/10/2026 o front mesclava a planilha "Lotações, Meios de Acesso/Polo Base"
(`public/data/lotacoes-geograficas-0*.json`) sobre o `lmap` e o `rede_cnes`
de `TB_CONFIG_MAPA_SAUDE_INDIG`. A planilha tem erros, não existe versão corrigida,
e a auditoria de 01–02/10 (`docs/auditoria-oficial-das-coordenadas-2026-10-01.md`)
corrigiu as coordenadas **no banco**. Desde esta data o mapa desenha só o banco.

## O que a planilha fornecia e a decisão

| Atributo da planilha                                   | Onde era usado                                                                                                         | Decisão                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Coordenada de polo, sede, CASAI e unidade              | preenchia ponto sem coordenada, acrescentava pontos e, via vereditos de 22/09, trocava a posição de 16 polos do `lmap` | removido: coordenada só do banco                                  |
| Município da lotação (`mun_lotacao`, `sede_municipio`) | reserva do município no popup do polo; **sobrescrevia** o `sede_municipio` gravado no banco nas 34 sedes               | removido: município vem do CNES (`rede_cnes`) e da sede no `lmap` |
| UF do polo                                             | o `lmap` já traz `uf` em cada polo                                                                                     | removido                                                          |
| Acessibilidade e meio de acesso                        | gravados no payload, sem uso em tela                                                                                   | removido                                                          |
| "Fora" do território                                   | o `lmap` já traz `fora` em cada polo; a planilha não tinha esse campo                                                  | nada a fazer                                                      |

Como nenhum atributo não geográfico era mostrado, a mesclagem saiu inteira: o
transporte `src/modules/lotacoes-geograficas-transport.js`, os oito JSON de
`public/data/` e os testes que dependiam deles.

## Pontos que não estão no banco

Medido em 02/10/2026 com o `lmap` e o `rede_cnes` de depois da terceira rodada da
auditoria: dos 598 registros da planilha (34 sedes, 403 polos, 79 CASAIs, 79 unidades
de lotação, 3 rotas), **102** não correspondem a nenhum polo do `lmap` nem a
nenhum estabelecimento do `rede_cnes` e **deixaram de ser desenhados**:

| tipo               | quantidade |
| ------------------ | ---------: |
| POLO BASE          |         37 |
| CASAI              |         12 |
| UNIDADE DE LOTAÇÃO |         53 |

Outros 14 polos que a planilha tinha e o `lmap` não continuam no mapa, porque o
estabelecimento existe no `rede_cnes` (desenhado na coordenada do CNES).

A coordenada abaixo é a da planilha e **não é confiável**: serve só como pista para
conferir com o DSEI antes de incluir o ponto no banco (`lmap` para polo,
`rede_cnes` para estabelecimento), nunca para copiar direto.

| DSEI                          | tipo               | nome na planilha                       | município                 | UF  | lat (planilha) | lon (planilha) |
| ----------------------------- | ------------------ | -------------------------------------- | ------------------------- | --- | -------------: | -------------: |
| ALTO RIO JURUA                | POLO BASE          | PB MARECHARL THAUMATURGO               | MARECHAL THAUMATURGO      | AC  |        -8.9458 |       -72.7881 |
| ALTO RIO NEGRO                | POLO BASE          | PB CARURU - WAUPÉS                     | SAO GABRIEL DA CACHOEIRA  | AM  |         0.2748 |       -69.9283 |
| ALTO RIO NEGRO                | POLO BASE          | PB ITAPERERA                           | SAO GABRIEL DA CACHOEIRA  | AM  |        -0.3735 |       -66.2880 |
| ALTO RIO SOLIMOES             | POLO BASE          | PB FEIJOAL/ SÃO LEOPOLDO               | BENJAMIN CONSTANT         | AM  |        -4.2966 |       -69.5381 |
| ALTO RIO SOLIMOES             | POLO BASE          | PB SÃO PAULO DE OLIVENÇA SEDE          | SAO PAULO DE OLIVENÇA     | AM  |        -3.4819 |       -68.9543 |
| ALTO RIO SOLIMOES             | POLO BASE          | PB UMARIAÇU 1                          | TABATINGA                 | AM  |        -4.2618 |       -69.9443 |
| ALTO RIO SOLIMOES             | POLO BASE          | PB UMARIAÇU 2                          | TABATINGA                 | AM  |        -4.2694 |       -69.9365 |
| ARAGUAIA                      | POLO BASE          | PB GOIÁS/PB ARUANÃ                     | ARUANA                    | GO  |       -14.9048 |       -51.0747 |
| CEARA                         | POLO BASE          | PB PIAUÍ ÁREA II                       | URUÇUI                    | PI  |        -7.2295 |       -44.5603 |
| CEARA                         | POLO BASE          | PB POTYRÔ TAPEBA/CAUCAIA               | CAUCAIA                   | CE  |        -3.7296 |       -38.6834 |
| CEARA                         | POLO BASE          | PB TERESINA (SEDE)                     | TERESINA                  | PI  |        -5.0799 |       -42.7868 |
| GUAMA-TOCANTINS               | POLO BASE          | PB MARABA/XIKRIN                       | MARABA                    | PA  |        -5.3465 |       -49.1065 |
| GUAMA-TOCANTINS               | POLO BASE          | PB SANTA MARIA                         | MAUES                     | AM  |        -3.9268 |       -57.1485 |
| KAIAPO DO MATO GROSSO         | POLO BASE          | PB COLÍDER                             | COLIDER                   | MT  |       -10.7970 |       -55.4715 |
| LESTE DE RORAIMA              | POLO BASE          | PB FLEXAL                              | UIRAMUTa                  | RR  |         4.6667 |       -60.2882 |
| LESTE DE RORAIMA              | POLO BASE          | PB SERRA DO TRUARUM                    | BOA VISTA                 | RR  |         3.2715 |       -60.6733 |
| MANAUS                        | POLO BASE          | PB NOVO AIRÃO                          | AUTAZES                   | AM  |         2.8072 |       -60.6853 |
| MANAUS                        | POLO BASE          | PB RIO PRETO DA EVA                    | RIO PRETO DA EVA          | AM  |        -2.6956 |       -59.7010 |
| MANAUS                        | POLO BASE          | PB SILVES                              | SILVES                    | AM  |        -2.8301 |       -58.1758 |
| MATO GROSSO DO SUL            | POLO BASE          | PB SAMUI DOURADOS                      | DOURADOS                  | MS  |       -22.1963 |       -54.7875 |
| MEDIO RIO PURUS               | POLO BASE          | PB ABAQUADI/PAJÉ SAWÊ                  | TAPAUA                    | AM  |        -5.8957 |       -64.6422 |
| MEDIO RIO PURUS               | POLO BASE          | PB FUNAI/MPI                           | LABREA                    | AM  |        -7.2595 |       -64.7977 |
| MEDIO RIO PURUS               | POLO BASE          | PB MARRECÃO/SURUWAHÁ SESAI             | ITAMARATI                 | AM  |        -6.8107 |       -66.9331 |
| MINAS GERAIS E ESPIRITO SANTO | POLO BASE          | PB CAIEIRAS VELHA                      | ARACRUZ                   | ES  |       -19.9240 |       -40.1715 |
| MINAS GERAIS E ESPIRITO SANTO | POLO BASE          | UN ARACRUZ (SEDE)                      | ARACRUZ                   | ES  |       -19.9245 |       -40.1714 |
| PERNAMBUCO                    | POLO BASE          | PB FULNI-Ô I                           | AGUAS BELAS               | PE  |        -9.1185 |       -37.1230 |
| PERNAMBUCO                    | POLO BASE          | PB FULNI-Ô II                          | AGUAS BELAS               | PE  |        -9.1166 |       -37.1231 |
| PERNAMBUCO                    | POLO BASE          | PB PIPIPÃ (FLORESTA)                   | FLORESTA                  | PE  |        -8.5951 |       -38.5734 |
| POTIGUARA                     | POLO BASE          | PB CONDE                               | JOAO PESSOA               | PB  |        -7.1193 |       -34.8438 |
| POTIGUARA                     | POLO BASE          | PB GOIANIANHA                          | GOIANINHA                 | RN  |        -6.2605 |       -35.2113 |
| RIO TAPAJOS                   | POLO BASE          | PB JACAREACANGA                        | JACAREACANGA              | PA  |        -6.2028 |       -57.6819 |
| XAVANTE                       | POLO BASE          | PB PARANATINGA/ ALDEIA PAKUERA         | PARANATINGA               | MT  |       -14.2990 |       -54.6189 |
| XINGU                         | POLO BASE          | PB LEONARDO VILLAS BÔAS                | GAUCHA DO NORTE           | MT  |       -12.2006 |       -53.3778 |
| YANOMAMI                      | POLO BASE          | PB ARATHAÚ                             | ALTO ALEGRE               | RR  |         3.1969 |       -63.7390 |
| YANOMAMI                      | POLO BASE          | PB MÉDIO PADAUIRI/ PAHANA              | BARCELOS                  | AM  |         1.1725 |       -64.4153 |
| YANOMAMI                      | POLO BASE          | PB PAAPIU                              | IRACEMA                   | RR  |         2.6669 |       -63.1606 |
| YANOMAMI                      | POLO BASE          | PB WAHARO/ALTO PADAUIRI                | BARCELOS                  | AM  |        -0.9733 |       -62.9243 |
| ALTO RIO SOLIMOES             | CASAI              | CASAI SANTO ANTÔNIO DO IÇÁ             | SANTO ANTONIO DO IÇA      | AM  |        -3.1004 |       -67.9438 |
| ALTO RIO SOLIMOES             | CASAI              | CASAI TABATINGA                        | TABATINGA                 | AM  |        -4.2398 |       -69.9350 |
| AMAPA E NORTE DO PARA         | CASAI              | CASAI OIAPOQUE                         | OIAPOQUE                  | AP  |         3.8464 |       -51.8354 |
| BAHIA                         | CASAI              | CASAI SALVADOR                         | SALVADOR                  | BA  |       -12.9514 |       -38.3543 |
| GUAMA-TOCANTINS               | CASAI              | CASAI SANTAREM                         | SANTAREM                  | PA  |        -2.4182 |       -54.7101 |
| MANAUS                        | CASAI              | CASAI NOVA OLINDA                      | NOVA OLINDA DO NORTE      | AM  |        -2.6942 |       -59.6993 |
| MARANHAO                      | CASAI              | CASAI TERESINA                         | TERESINA                  | PI  |        -5.0695 |       -42.7868 |
| MATO GROSSO DO SUL            | CASAI              | CASAI DOURADOS                         | DOURADOS                  | MS  |       -22.2134 |       -54.8011 |
| MINAS GERAIS E ESPIRITO SANTO | CASAI              | CASAI BELO HORIZONTE                   | BELO HORIZONTE            | MG  |       -19.9366 |       -43.9518 |
| PORTO VELHO                   | CASAI              | CASAI PORTO VELHO                      | PORTO VELHO               | RO  |        -8.7498 |       -63.8468 |
| XAVANTE                       | CASAI              | CASAI ARAGARÇAS                        | ARAGARÇAS                 | GO  |       -15.9050 |       -52.2494 |
| YANOMAMI                      | CASAI              | CASAI YANOMAMI                         | BOA VISTA                 | RR  |         2.7767 |       -60.7133 |
| ALTO RIO SOLIMOES             | UNIDADE DE LOTAÇÃO | UBSI BANANAL                           | AQUIDAUANA                | MS  |       -20.2527 |       -56.0674 |
| ALTO RIO SOLIMOES             | UNIDADE DE LOTAÇÃO | UBSI LAGO GRANDE                       | MARCAÇAO                  | PB  |        -6.7674 |       -35.0243 |
| ALTO RIO SOLIMOES             | UNIDADE DE LOTAÇÃO | UBSI MARI MARI                         | NORMANDIA                 | RR  |         3.9917 |       -60.0495 |
| ALTO RIO SOLIMOES             | UNIDADE DE LOTAÇÃO | UBSI NOVA ESPERANÇA                    | MAUES                     | AM  |        -3.7231 |       -57.4873 |
| ALTO RIO SOLIMOES             | UNIDADE DE LOTAÇÃO | UBSI NOVA EXTREMA                      | PORTO VELHO               | RO  |        -8.6679 |       -63.9844 |
| GUAMA-TOCANTINS               | UNIDADE DE LOTAÇÃO | UN SANTA MARIA (SUBPOLO - SANTA LUZIA) | MAUES                     | AM  |        -3.7670 |       -57.2058 |
| LESTE DE RORAIMA              | UNIDADE DE LOTAÇÃO | MONTE MORIA (ALDEIA EM WILLIMON)       | UIRAMUTA                  | RR  |         4.6347 |       -60.1758 |
| MANAUS                        | UNIDADE DE LOTAÇÃO | CAPANÃ GRANDE                          | MANICORE                  | AM  |        -5.9838 |       -61.8212 |
| MANAUS                        | UNIDADE DE LOTAÇÃO | MAICI/MARMELOS                         | HUMAITA                   | AM  |        -7.5057 |       -63.0211 |
| MEDIO RIO PURUS               | UNIDADE DE LOTAÇÃO | UN SURUWAHA/SESAI/DSEIPRP              | TAPAUA                    | AM  |        -6.9522 |       -66.3145 |
| RIO TAPAJOS                   | UNIDADE DE LOTAÇÃO | UN CASAI LOCAL CASTELO DOS SONHOS      | ALTAMIRA                  | PA  |        -8.3276 |       -55.1035 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN ARIABU (ALDEIA)                     | SAO GABRIEL DA CACHOEIRA  | AM  |         0.3436 |       -65.9055 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN AYARI (UBSI)                        | SAO GABRIEL DA CACHOEIRA  | AM  |        -0.0615 |       -66.1281 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN BALAIO (UBSI)                       | SANTA ISABEL DO RIO NEGRO | AM  |        -0.4140 |       -65.0190 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN BANDEIRA BRANCA (UBSI)              | SANTA ISABEL DO RIO NEGRO | AM  |         0.8530 |       -64.4493 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN BARCELOS (Município)                | BARCELOS                  | AM  |        -0.9735 |       -62.9259 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN BUDU-U (UBSI)                       | ALTO ALEGRE               | RR  |         3.3186 |       -63.2479 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN CURUÁ                               | SANTA ISABEL DO RIO NEGRO | AM  |        -0.2139 |       -65.0765 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN HALIKATHO-U (UBSI)                  | ALTO ALEGRE               | RR  |         3.2239 |       -63.2026 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN HEMARIPIWEI (Aldeia)                | BARCELOS                  | AM  |         1.0794 |       -62.8296 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN HOKOLASSIMU (UBSI)                  | AMAJARI                   | RR  |         3.8707 |       -64.4459 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN IXIMA (UBSI)                        | SANTA ISABEL DO RIO NEGRO | AM  |         0.5721 |       -65.0635 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN JUTAÍ (Município)                   | JUTAI                     | AM  |         0.0847 |       -65.0499 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN KALISSI (UBSI)                      | AMAJARI                   | RR  |         4.0781 |       -64.3979 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN KATANA (Aldeia)                     | AMAJARI                   | RR  |         3.6496 |       -61.3727 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN KAYANAU                             | MUCAJAI                   | RR  |         2.7579 |       -62.9066 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN KETAA (UBSI)                        | ALTO ALEGRE               | RR  |         2.5356 |       -63.9260 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN KOHEREPI (UBSI)                     | BARCELOS                  | AM  |         1.7582 |       -63.9232 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN KOLULU                              | AMAJARI                   | RR  |         3.6520 |       -61.3710 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN KOREKOREMA                          | ALTO ALEGRE               | RR  |         3.2409 |       -62.5997 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN KURATANHA                           | AMAJARI                   | RR  |         3.7656 |       -63.9882 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN LAHAKA (UBSI)                       | BARCELOS                  | AM  |         1.3161 |       -64.4625 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN MARAXI-U (UBSI)                     | IRACEMA                   | RR  |         2.7359 |       -63.4536 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN MAXAPAPI (Aldeia)                   | BARCELOS                  | AM  |         1.5711 |       -63.9584 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN NAZARÉ (UBSI)                       | SAO GABRIEL DA CACHOEIRA  | AM  |         0.2667 |       -66.4378 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN NOVA ESPERANÇA (UBSI)               | SAO GABRIEL DA CACHOEIRA  | AM  |         0.4778 |       -64.5669 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN OLOMAI                              | AMAJARI                   | RR  |         3.9278 |       -64.1863 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN ONKIOLA                             | AMAJARI                   | RR  |         3.7126 |       -64.1618 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN PARIMA (UBSI)                       | ALTO ALEGRE               | RR  |         3.1969 |       -63.7390 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN PEWA-Ú (UBSI)                       | ALTO ALEGRE               | RR  |         2.7847 |       -62.4064 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN POHOROA (UBSI)                      | SANTA ISABEL DO RIO NEGRO | AM  |         0.5710 |       -65.2486 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN Pukima Cachoeira                    | SANTA ISABEL DO RIO NEGRO | AM  |         0.7857 |       -65.2467 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN SANINAU - HOKOMAWEN (Aldeia)        | ALTO ALEGRE               | RR  |         2.7728 |       -63.2293 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN SANTA ISABEL DO RIO NEGRO           | SANTA ISABEL DO RIO NEGRO | AM  |        -0.4096 |       -65.0153 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN SÃO GABRIEL DA CACHOEIRA            | SAO GABRIEL DA CACHOEIRA  | AM  |        -0.1193 |       -67.0944 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN TARACUÁ (Aldeia)                    | SANTA ISABEL DO RIO NEGRO | AM  |        -0.0719 |       -65.1258 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN WAHARO (UBSI)                       | BARCELOS                  | AM  |         1.3131 |       -64.2089 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN XAMAKORONA (UBSI)                   | SANTA ISABEL DO RIO NEGRO | AM  |         1.0154 |       -65.0531 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN XAMANI (UBSI)                       | BARCELOS                  | AM  |         1.4861 |       -63.3775 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN XEXENA                              | IRACEMA                   | RR  |         2.0104 |       -61.8624 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN XIHOPI (Aldeia)                     | BARCELOS                  | AM  |         1.5199 |       -63.4480 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN XIROXIROPIU                         | BARCELOS                  | AM  |         1.9506 |       -63.7348 |
| YANOMAMI                      | UNIDADE DE LOTAÇÃO | UN YEKUANA (UBSI)                      | AMAJARI                   | RR  |         3.9919 |       -64.4910 |
