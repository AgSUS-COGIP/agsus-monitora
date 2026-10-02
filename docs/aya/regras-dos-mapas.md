# Regras dos mapas

O mapa da Visão geral em cada área: DSEIs e CASAIs na Saúde Indígena, os locais das vagas em
Projetos, nenhum na SEDE; e a auditoria das coordenadas. Fontes: `src/lib/visao-geral-da-area.js`,
`src/modulos/mapa-de-projetos/`, `src/lib/mapa-saude-indigena/mapa-do-dsei.js`,
`docs/auditoria-oficial-das-coordenadas-2026-10-01.md` e a migration
`20261001180000_locais_das_vagas_dos_projetos.sql`.

## Mapa de Projetos

**perguntas:** de onde vem os pontos do mapa de projetos | mapa de projetos | mapa dos projetos | municipios das vagas | municipios por vagas
**resposta:** Na Visão geral de Projetos, o mapa mostra um ponto por lugar das vagas de todos os projetos (Caminhoneiros, Saúde nas Fronteiras, Escritório Distrital e Regional, Rio Doce, MFC e CCE), na cor do projeto, com legenda, filtro e agrupamento por projeto; o tamanho do ponto segue as vagas. Os lugares foram lidos dos PDFs dos editais (município do IBGE ou só a UF, com o arquivo e a página como prova) e se juntam aos "UBS móvel" do nome da vaga. Lugar só com UF aparece como estado e não tem candidatos. A SEDE não tem mapa.
**fonte:** supabase/migrations/20261001180000_locais_das_vagas_dos_projetos.sql; src/lib/visao-geral-da-area.js; src/modulos/mapa-de-projetos/mapa-de-projetos.jsx

## Como usar o mapa de Projetos

**perguntas:** como uso o mapa de projetos | clicar no municipio do mapa | filtrar o mapa por projeto | agrupar por projeto | lista municipios por vagas
**resposta:** Clique num ponto do mapa, ou num lugar da lista "Municípios por vagas", para ver o projeto, o edital, as vagas publicadas, as lotações e os candidatos daquele lugar; o mapa aproxima e abre o resumo. A lista vem ordenada pelas vagas e a barra mostra a parte aprovada entre os já analisados. Cada lugar mostra o nome e as vagas na primeira linha e os projetos como selos na segunda (com o filtro de um projeto ou agrupada, os selos saem, porque seriam iguais). Os candidatos só aparecem quando o nome da vaga nas análises diz o lugar (como "UBS móvel Irati/PR"); vagas como as dos escritórios não dizem o município, então o lugar fica sem a contagem, em vez de mostrar um zero que não é real. Com dois ou mais projetos, o campo "Projeto" mostra só os lugares de um projeto (o mapa reenquadra) e "Agrupar por projeto" separa a lista em um bloco por projeto — um lugar de dois projetos aparece nos dois. Ponto com contorno tracejado tem mais de um projeto; lugar sem coordenada aparece na lista, mas não no mapa. "Brasil" volta ao país inteiro e "Tela cheia" amplia o painel (Esc sai).
**fonte:** src/modulos/mapa-de-projetos/mapa-de-projetos.jsx; src/modulos/mapa-de-projetos/lista.jsx; src/lib/visao-geral-da-area.js

## Coordenadas dos lugares do mapa de Projetos

**perguntas:** de onde vem a coordenada de um lugar de projetos | coordenadas do mapa de projetos | ponto do municipio no mapa de projetos | por que o ponto fica no meio do estado | lugar sem coordenada no mapa de projetos
**resposta:** Cada ponto do mapa de Projetos é um lugar das vagas, e a coordenada dele fica no banco do MONITORA. Na carga inicial, o município vai para a sede municipal do IBGE (pelo código do IBGE do edital ou pelo nome do "UBS móvel" da vaga) e o lugar que o edital só diz a UF (a CCE, por exemplo) vai para o centro do estado, calculado pela média das sedes municipais. Depois disso, quem muda a posição é o administrador global, pelo editor de coordenadas, e cada alteração fica registrada com autoria e motivo. Lugar sem coordenada no banco aparece na lista, mas não no mapa.
**fonte:** supabase/migrations/20261002190000_coordenadas_mapa_projetos.sql; supabase/correcoes/20261002-pendencias-das-coordenadas-dos-projetos.sql; src/lib/visao-geral-da-area.js

## Corrigir a coordenada de um lugar de Projetos

**perguntas:** corrigir lugar no mapa de projetos | editor de coordenadas de projetos | mover ponto do mapa de projetos | botao coordenadas no mapa de projetos | conferir lugar de projetos
**resposta:** No mapa de Projetos, o administrador global vê o botão "Coordenadas", que troca a lista "Municípios por vagas" pelo editor; "Voltar à lista" fecha. Busque pelo lugar, município, UF, projeto, edital ou lotação e escolha um item: o mapa vai até ele e aparece um pin de prévia. Para mudar a posição, digite latitude e longitude, arraste o pin ou use uma sugestão ("Usar esta" ou um clique no círculo dela no mapa). Depois informe o motivo e a fonte e clique em "Salvar coordenada" e em "Confirmar correção". Se a posição já estiver certa, "Conferido" (com confirmação) tira o lugar da fila sem mudar a posição. O histórico abaixo mostra quem mudou, quando e de onde para onde, e "Desfazer última alteração" volta a mais recente, com motivo. Se outra pessoa mudou o lugar antes, atualize a página e tente de novo. O mapa já mostra a posição nova assim que ela é gravada.
**fonte:** src/modulos/mapa-de-projetos/editor-de-coordenadas.jsx; src/modulos/editor-de-coordenadas/editor-de-coordenadas.jsx; supabase/migrations/20261002190000_coordenadas_mapa_projetos.sql

## Lugares pendentes no mapa de Projetos

**perguntas:** lugares pendentes de projetos | gravidade dos lugares de projetos | sede do municipio ou endereco | sugestoes do lugar de projetos | lugar duvidoso no mapa de projetos
**resposta:** A fila do editor de Projetos começa em "Só pendentes": são os lugares cuja posição ainda não foi conferida por um administrador. Na carga inicial, todo município aparece porque o ponto é só a sede do município (o edital diz o município, não o endereço), e todo lugar só com UF aparece porque o ponto é o centro do estado. Também ficam pendentes o lugar sem coordenada, o município cujo nome, código ou UF não batem, o mesmo município com coordenadas diferentes e o ponto fora do Brasil. A gravidade compara a posição com a referência do lugar (a sede do município pelo IBGE ou o centro da UF): "Provável erro" quando falta a coordenada, o motivo já é um erro ou a referência está a mais de 10 km; "Revisar" quando ela está entre 2 e 10 km, ou quando a lotação é um escritório e o edital só diz a UF; "Só confirmar" quando a posição é a da referência; e "Sem sugestão" quando não há posição candidata. As sugestões são a sede do município (IBGE), o centro da UF, a sede do DSEI do mapa da Saúde Indígena (para escritório distrital) e os outros lugares das vagas na mesma UF.
**fonte:** src/lib/coordenadas-dos-projetos.js; src/lib/editor-de-coordenadas.js; supabase/correcoes/20261002-pendencias-das-coordenadas-dos-projetos.sql

## Mapa da Saúde Indígena

**perguntas:** como uso o mapa dos dseis | mapa dos dseis | mapa da saude indigena
**resposta:** Na Visão geral da Saúde Indígena, o mapa mostra os DSEIs e as CASAIs, com as Terras Indígenas, e a lista "Territórios por vagas". Escolher um DSEI recorta a página inteira por ele e mostra polos e unidades; voltar ao Brasil sai do território e mantém os outros filtros. Trocar Mapa ou Satélite muda só o fundo cartográfico.
**fonte:** src/lib/visao-geral-da-area.js; docs/aya/regras-da-visao-geral.md

## Coordenadas do mapa

**perguntas:** de onde vem as coordenadas do mapa | coordenadas do mapa | auditoria das coordenadas | ponto errado no mapa | planilha de lotacoes no mapa
**resposta:** No mapa da Saúde Indígena, toda coordenada vem do banco do MONITORA: os polos base e as sedes dos DSEIs do cadastro do mapa (lmap) e os estabelecimentos (UBSI, CASAI e demais unidades) do cadastro do CNES guardado no banco (rede_cnes). O mapa desenha exatamente o que está gravado; nada é recalculado na tela. Essas coordenadas foram auditadas em 01 e 02/10/2026 contra fontes oficiais: CNES (Ministério da Saúde), malhas municipais e Localidades Indígenas do Censo 2022 do IBGE, aldeias e terras indígenas da Funai, PDSI 2024–2027 de cada DSEI e OpenStreetMap. Em três rodadas, sempre com duas fontes independentes concordando, foram corrigidos no banco 162 polos e 2 CASAIs, com backup antes de cada rodada. 93 polos ainda aguardam confirmação do DSEI (só uma fonte, fontes que discordam ou nenhum homônimo oficial); eles aparecem na posição gravada no banco, sem aviso no popup. A planilha "Lotações, Meios de Acesso/Polo Base" não entra mais no mapa: ela tem erros e não há versão corrigida; os pontos que só existiam nela estão listados em docs/pontos-so-na-planilha-de-lotacoes.md para inclusão manual no banco, se a área confirmar. Para corrigir um ponto, a correção é feita no banco.
**fonte:** docs/auditoria-oficial-das-coordenadas-2026-10-01.md; docs/pontos-so-na-planilha-de-lotacoes.md; src/lib/mapa-saude-indigena/mapa-do-dsei.js
