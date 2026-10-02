# Regras dos mapas

O mapa da Visão geral em cada área: DSEIs e CASAIs na Saúde Indígena, os locais das vagas em
Projetos, nenhum na SEDE; e a auditoria das coordenadas. Fontes: `src/lib/visao-geral-da-area.js`,
`src/modulos/mapa-de-projetos/`, `src/modules/lotacoes-geograficas-transport.js`,
`scripts/validar-localizacoes.mjs`, `src/lib/localizacoes-validadas.js`,
`docs/auditoria-oficial-das-coordenadas-2026-10-01.md` e a migration
`20261001180000_locais_das_vagas_dos_projetos.sql`.

## Mapa de Projetos

**perguntas:** de onde vem os pontos do mapa de projetos | mapa de projetos | mapa dos projetos | municipios das vagas | municipios por vagas
**resposta:** Na Visão geral de Projetos, o mapa mostra um ponto por lugar das vagas de todos os projetos (Caminhoneiros, Saúde nas Fronteiras, Escritório Distrital e Regional, Rio Doce, MFC e CCE), na cor do projeto, com legenda, filtro e agrupamento por projeto; o tamanho do ponto segue as vagas. Os lugares foram lidos dos PDFs dos editais (município do IBGE ou só a UF, com o arquivo e a página como prova) e se juntam aos "UBS móvel" do nome da vaga. Lugar só com UF aparece como estado e não tem candidatos. A SEDE não tem mapa.
**fonte:** supabase/migrations/20261001180000_locais_das_vagas_dos_projetos.sql; src/lib/visao-geral-da-area.js; src/modulos/mapa-de-projetos/mapa-de-projetos.jsx

## Como usar o mapa de Projetos

**perguntas:** como uso o mapa de projetos | clicar no municipio do mapa | filtrar o mapa por projeto | agrupar por projeto | lista municipios por vagas
**resposta:** Clique num ponto do mapa, ou num lugar da lista "Municípios por vagas", para ver o projeto, o edital, as vagas publicadas, as lotações e os candidatos daquele lugar; o mapa aproxima e abre o resumo. A lista vem ordenada pelas vagas e a barra mostra a parte aprovada entre os já analisados. Com dois ou mais projetos, o campo "Projeto" mostra só os lugares de um projeto (o mapa reenquadra) e "Agrupar por projeto" separa a lista em um bloco por projeto — um lugar de dois projetos aparece nos dois. Ponto com contorno tracejado tem mais de um projeto; lugar sem coordenada aparece na lista, mas não no mapa. "Brasil" volta ao país inteiro e "Tela cheia" amplia o painel (Esc sai).
**fonte:** src/modulos/mapa-de-projetos/mapa-de-projetos.jsx; src/modulos/mapa-de-projetos/lista.jsx; src/lib/visao-geral-da-area.js

## Mapa da Saúde Indígena

**perguntas:** como uso o mapa dos dseis | mapa dos dseis | mapa da saude indigena
**resposta:** Na Visão geral da Saúde Indígena, o mapa mostra os DSEIs e as CASAIs, com as Terras Indígenas, e a lista "Territórios por vagas". Escolher um DSEI recorta a página inteira por ele e mostra polos e unidades; voltar ao Brasil sai do território e mantém os outros filtros. Trocar Mapa ou Satélite muda só o fundo cartográfico.
**fonte:** src/lib/visao-geral-da-area.js; docs/aya/regras-da-visao-geral.md

## Coordenadas do mapa

**perguntas:** de onde vem as coordenadas do mapa | coordenadas do mapa | auditoria das coordenadas | ponto errado no mapa
**resposta:** As coordenadas das unidades da Saúde Indígena foram auditadas em 01/10/2026 contra fontes oficiais: CNES (Ministério da Saúde), malhas municipais e Localidades Indígenas do Censo 2022 do IBGE, aldeias e terras indígenas da Funai e os PDSI 2024–2027 de cada DSEI. Em três rodadas, sempre com duas fontes independentes concordando, foram corrigidos 162 polos e 2 CASAIs, com backup antes de cada rodada. Restam 93 pontos sem duas fontes (só uma fonte, fontes que discordam ou nenhum homônimo oficial), que ficam para revisão com a área técnica; não existe lista oficial de polos com coordenadas em dados abertos. No mapa, uma posição só é "validada" quando duas fontes independentes concordam a menos de 5 km e as duas caem dentro da UF; nenhuma coordenada é inventada, e ponto sem essa confirmação continua "em validação".
**fonte:** docs/auditoria-oficial-das-coordenadas-2026-10-01.md; src/modules/lotacoes-geograficas-transport.js; scripts/validar-localizacoes.mjs; src/lib/localizacoes-validadas.js
