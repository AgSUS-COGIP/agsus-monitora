# Auditoria das coordenadas contra fontes oficiais (01/10/2026)

A planilha "Lotações, Meios de Acesso_Polo Base" que alimentou o mapa tem erros e não
existe versão corrigida. Esta auditoria conferiu os 1.500 pontos do mapa da Saúde
Indígena (payloads `lmap` e `rede_cnes` de `TB_CONFIG_MAPA_SAUDE_INDIG`) só contra
fontes oficiais.

## Fontes

| Fonte                                                                                   | Uso                                                                                                                       |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| CNES, API de dados abertos do MS (`apidadosabertos.saude.gov.br/cnes/estabelecimentos`) | coordenada, município e situação dos 1.089 códigos; todos os 1.584 estabelecimentos tipo 72 (para casar polos sem código) |
| IBGE, malhas municipais em qualidade máxima                                             | ponto dentro do município declarado                                                                                       |
| Funai, `aldeias_pontos` (4.731 aldeias, WFS paginado) e `tis_poligonais`                | aldeia homônima mais próxima; ponto dentro de terra indígena                                                              |
| `docs/sedes-dos-dsei.md`                                                                | sedes dos DSEI                                                                                                            |

## Resultado

| tipo           |  OK | Corrigir | Revisar | Sem fonte |
| -------------- | --: | -------: | ------: | --------: |
| sede           |  33 |        0 |       0 |         1 |
| polo           | 363 |      125 |     169 |        51 |
| ubsi           | 419 |        2 |     176 |         0 |
| casai          |  67 |        1 |       2 |         0 |
| casai nacional |   3 |        1 |       0 |         0 |
| outro          |  73 |        0 |      14 |         0 |

Achados principais:

- Os polos do `lmap` nunca vieram do CNES; havia divergências de centenas de km
  (Confresa 432 km, Bona 353 km, Vale do Javari 280–345 km).
- Pontos empilhados: 19 polos do Alto Rio Negro na mesma coordenada; o próprio CNES
  acumula estabelecimentos em pontos coletores (ex. `4.596,-60.168`, Yanomami).
- Na Amazônia Legal o CNES de unidades de aldeia costuma apontar para a sede do
  município (291 casos). Nesses casos o CNES não é verdade: ficaram em "Revisar".
- Conflito de DSEI entre as bases: Cauburis, Cumarú, Tapera (Alto Rio Negro × Yanomami)
  e Pauini.

## O que foi aplicado

`supabase/correcoes/20261001-corrige-62-coordenadas-pela-auditoria-oficial.sql`, aplicado
em produção em 01/10/2026 às 12:01 com a aprovação do usuário: 60 polos do `lmap` (16 deles
os empilhados do Alto Rio Negro), a CASAI Nacional Brasília e a CASAI Porto Velho. Cada item
só mudava se nome e coordenada atuais fossem os auditados. Backup nas chaves
`lmap_backup_20261001_pre_auditoria_oficial` e `rede_cnes_backup_20261001_pre_auditoria_oficial`
(para desfazer, copiar o payload delas de volta).

Ficaram de fora, para revisão com a área técnica, 67 pontos: os 46 polos de confiança média
(ponto atual na aldeia e CNES na cidade — pode ser polo que funciona na sede municipal) e 21
em que o ponto atual está sobre a aldeia Funai homônima ou a posição do CNES cairia em outra
terra indígena (ex. Posto Tanguro, DSEI Xavante → Parque do Xingu).

## Limitações

- Coordenada do CNES é declarada por quem cadastra; não há campo de situação na API
  (desabilitado = `codigo_motivo_desabilitacao` preenchido).
- Polos sem CNES próprio foram casados por nome (normalizado, mesmo numeral romano).
- A camada de aldeias da Funai é rala fora da Amazônia; o teste "unidade de aldeia longe
  de aldeia" só rodou na Amazônia Legal.

## Segunda e terceira rodadas (mesmo dia)

Para reduzir o que dependeria de revisão manual, duas rodadas a mais, sempre com
duas fontes independentes concordando:

- **2ª rodada** — `supabase/correcoes/20261001-corrige-61-coordenadas-segunda-rodada.sql`:
  61 polos. Endereço do CNES geocodificado no OpenStreetMap (Nominatim) perto do
  ponto do CNES, ou CNES junto da aldeia Funai homônima (46 para o CNES); aldeia
  Funai homônima única no DSEI quando o CNES não servia (15). 17 confirmados como
  estavam.
- **3ª rodada** — `supabase/correcoes/20261001-corrige-41-coordenadas-terceira-rodada.sql`:
  41 polos. Localidades Indígenas do Censo 2022 (IBGE, geoftp, versão 17/09/2025),
  PDSI 2024-2027 de cada DSEI (aldeia-sede, coordenada ou TI do polo), aldeias Funai
  e OpenStreetMap. Inclui 11 dos polos empilhados do Alto Rio Negro. 7 confirmados.

Cada rodada guardou backup das chaves antes (`*_backup_20261001_pre_segunda_rodada`,
`*_backup_20261001_pre_terceira_rodada`). No total, 162 polos e 2 CASAIs corrigidos.

Restam 93 pontos sem duas fontes: só uma fonte (29), fontes que discordam (22),
nenhum homônimo em fonte oficial (20, sobretudo Ceará, Minas Gerais/Espírito Santo,
Interior Sul e Litoral Sul), homônimos fora das TIs do DSEI (18) e casos ambíguos.
33 deles têm o nome do próprio município, mas o PDSI não diz que o polo fica na sede.
Não existe lista oficial de polos com coordenadas em dados abertos.

## UBSI e postos (02/10)

`supabase/correcoes/20261002-corrige-147-ubsi.sql`: 147 UBSI/postos da `rede_cnes`
(lista "u") com duas fontes concordando (Localidades Indígenas IBGE 2022, aldeias
Funai, OpenStreetMap); 63 estavam na sede municipal e 18 em ponto coletor. 251
confirmadas como estavam; 156 seguem para revisão. Backup em
`*_backup_20261002_pre_ubsi`.

No mesmo dia o front passou a desenhar **só** a coordenada do banco: saíram os
vereditos de 22/09 (que sobrepunham 16 polos corrigidos) e a planilha de
Lotações (102 pontos que só existiam nela, listados em
`docs/pontos-so-na-planilha-de-lotacoes.md`).
