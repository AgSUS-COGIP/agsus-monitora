# Regras dos mapas

O mapa da Visão geral em cada área: DSEIs e CASAIs na Saúde Indígena, os locais das vagas em
Projetos, nenhum na SEDE; e a auditoria das coordenadas. Fontes: `src/lib/visao-geral-da-area.js`,
`src/modules/municipios-da-visao-geral.js`, `src/lib/mapa-saude-indigena/mapa-do-dsei.js`,
`docs/auditoria-oficial-das-coordenadas-2026-10-01.md` e a migration
`20261001180000_locais_das_vagas_dos_projetos.sql`.

## Mapa de Projetos

**perguntas:** de onde vem os pontos do mapa de projetos | mapa de projetos | mapa dos projetos | municipios das vagas | municipios por vagas
**resposta:** Na Visão geral de Projetos, o mapa mostra um ponto por lugar das vagas de todos os projetos (Caminhoneiros, Saúde nas Fronteiras, Escritório Distrital e Regional, Rio Doce, MFC e CCE), na cor do projeto, com legenda, filtro e agrupamento por projeto; o tamanho do ponto segue as vagas. Os lugares foram lidos dos PDFs dos editais (município do IBGE ou só a UF, com o arquivo e a página como prova) e se juntam aos "UBS móvel" do nome da vaga. Lugar só com UF aparece como estado e não tem candidatos. A SEDE não tem mapa.
**fonte:** supabase/migrations/20261001180000_locais_das_vagas_dos_projetos.sql; src/lib/visao-geral-da-area.js; src/modules/municipios-da-visao-geral.js

## Mapa da Saúde Indígena

**perguntas:** como uso o mapa dos dseis | mapa dos dseis | mapa da saude indigena
**resposta:** Na Visão geral da Saúde Indígena, o mapa mostra os DSEIs e as CASAIs, com as Terras Indígenas, e a lista "Territórios por vagas". Escolher um DSEI recorta a página inteira por ele e mostra polos e unidades; voltar ao Brasil sai do território e mantém os outros filtros. Trocar Mapa ou Satélite muda só o fundo cartográfico.
**fonte:** src/lib/visao-geral-da-area.js; docs/aya/regras-da-visao-geral.md

## Coordenadas do mapa

**perguntas:** de onde vem as coordenadas do mapa | coordenadas do mapa | auditoria das coordenadas | ponto errado no mapa | planilha de lotacoes no mapa
**resposta:** No mapa da Saúde Indígena, toda coordenada vem do banco do MONITORA: os polos base e as sedes dos DSEIs do cadastro do mapa (lmap) e os estabelecimentos (UBSI, CASAI e demais unidades) do cadastro do CNES guardado no banco (rede_cnes). O mapa desenha exatamente o que está gravado; nada é recalculado na tela. Essas coordenadas foram auditadas em 01 e 02/10/2026 contra fontes oficiais: CNES (Ministério da Saúde), malhas municipais e Localidades Indígenas do Censo 2022 do IBGE, aldeias e terras indígenas da Funai, PDSI 2024–2027 de cada DSEI e OpenStreetMap. Em três rodadas, sempre com duas fontes independentes concordando, foram corrigidos no banco 162 polos e 2 CASAIs, com backup antes de cada rodada. 93 polos ainda aguardam confirmação do DSEI (só uma fonte, fontes que discordam ou nenhum homônimo oficial); eles aparecem na posição gravada no banco, sem aviso no popup. A planilha "Lotações, Meios de Acesso/Polo Base" não entra mais no mapa: ela tem erros e não há versão corrigida; os pontos que só existiam nela estão listados em docs/pontos-so-na-planilha-de-lotacoes.md para inclusão manual no banco, se a área confirmar. Para corrigir um ponto, a correção é feita no banco.
**fonte:** docs/auditoria-oficial-das-coordenadas-2026-10-01.md; docs/pontos-so-na-planilha-de-lotacoes.md; src/lib/mapa-saude-indigena/mapa-do-dsei.js
