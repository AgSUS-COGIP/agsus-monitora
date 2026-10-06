# Regras das conferências de consistência

Avisos de conferência: o que o MONITORA confere todo dia entre os módulos, onde os avisos aparecem e
quem pode ignorar. Fontes: `scripts/conferencias/`, `src/modulos/conferencias/`,
`src/lib/avisos-de-conferencia.js` e as migrations `20261005210000_conferencias_de_consistencia.sql` e
`20261007120000_casos_dos_avisos_de_conferencia.sql`.

## Avisos de conferência

**perguntas:** o que sao os avisos de conferencia | avisos de conferencia | conferencias de consistencia | o que e uma conferencia de consistencia | selo de avisos | para que serve o selo de avisos
**resposta:** Todo dia às 6h de Brasília um job em Python lê o banco e confere regras que atravessam os módulos — análises, entrevistas, classificação, lista de aprovados e as cargas da Empregare. Cada problema achado vira um aviso por edital (ou por área, ou por vaga da Empregare), com a gravidade (Crítico, Atenção ou Informativo) e todos os casos (até 5000 por aviso). O job guarda só códigos, ids e o dado que motivou o aviso, nunca nome ou CPF; o nome aparece na tela para quem pode ver aquela análise. Os avisos aparecem no selo do topo de Análises, Entrevistas, Classificação e Lista de aprovados (só os do módulo, na área atual; o selo some quando não há aviso) e, todos juntos, em Configurações › Status das atualizações. A conferência só avisa: não muda análise, entrevista, lista nem aprovado. Quando a conferência deixa de achar o problema, o aviso some sozinho na execução seguinte.
**fonte:** scripts/conferencias/; supabase/migrations/20261005210000_conferencias_de_consistencia.sql
**abrir:** config:cargas

## O que cada conferência confere

**perguntas:** o que as conferencias conferem | quais conferencias existem | lista das conferencias | conferencias das analises | conferencias das entrevistas | conferencias da classificacao | conferencias dos aprovados
**resposta:** Análises: aprovada com nota abaixo da mínima da regra de classificação; nota final diferente da soma das parciais (formação, cursos, experiência e critério étnico); experiência acima do teto, quando a regra tiver teto; data da análise no futuro ou antes da inscrição na Empregare; e, só como informação, o mesmo candidato com análise em dois editais ativos. Entrevistas: convocado sem nota depois da data marcada na agenda; nota de avaliador fora da escala do roteiro; convocado que não está na lista de convocação vigente da Classificação; e dois horários para o mesmo candidato. Classificação: lista final gerada antes da última mudança nas análises; empate sem desempate registrado; vaga das análises sem linha no quadro de vagas do edital; ajuste de recurso aprovado depois da última lista. Lista de aprovados: a mesma pessoa contratada em duas vagas; convocado há mais de 15 dias sem desfecho; pessoas da publicação vinda da Classificação ainda para revisão. Cargas: vaga da Empregare cujo número de candidatos variou 50% ou mais na última carga.
**fonte:** scripts/conferencias/regras.py; scripts/conferencias/catalogo.py

## Ignorar um aviso

**perguntas:** como ignorar um aviso | ignorar aviso de conferencia | quem pode ignorar um aviso | aviso ignorado voltou | motivo para ignorar
**resposta:** Quem administra o módulo do aviso (na Classificação, quem edita) ou o administrador global vê o botão "Ignorar" no aviso aberto e precisa escrever o motivo, de 10 a 500 caracteres. O aviso vai para "Ignorados", com a data e o motivo. Se numa próxima conferência a quantidade de casos crescer, ele volta a aberto sozinho; se o problema sumir, ele sai da lista. Quem só lê o módulo vê os avisos, mas não ignora.
**fonte:** supabase/migrations/20261005210000_conferencias_de_consistencia.sql

## Quem vê os avisos

**perguntas:** quem ve os avisos de conferencia | por que nao vejo avisos | avisos da minha area | avisos das cargas
**resposta:** Cada pessoa vê os avisos dos módulos que tem (pelo menos leitura), só da sua área e dos editais do seu recorte de coordenação. Avisos das cargas da Empregare e avisos sem área ficam só para o administrador global, que vê todos em Configurações › Status das atualizações, com o filtro por módulo.
**fonte:** supabase/migrations/20261005210000_conferencias_de_consistencia.sql

## Conferir os casos de um aviso

**perguntas:** como conferir um aviso | ver os casos do aviso | quais analises estao erradas | casos do aviso | buscar candidato nos avisos | pesquisar codigo do candidato no aviso | exportar casos do aviso | csv dos avisos | abrir a analise do aviso | candidato analisado em dois editais | data da analise antes da inscricao
**resposta:** Na gaveta dos avisos, o botão com o número de casos abre a lista de todos os casos do aviso, 50 por vez ("Mostrar mais" traz os seguintes). Cada caso mostra o código do candidato na Empregare, o nome, o edital, a vaga, o responsável pela análise e o motivo: por exemplo, a data da análise e a data da inscrição, a nota e a nota mínima, a nota e a soma das parciais, a experiência e o teto. No candidato analisado em dois editais ativos aparecem as análises dele em cada edital, com vaga e situação, e quantas ficaram fora do seu acesso. O campo do aviso busca por código ou nome (sem acento) e "Exportar CSV" baixa todos os casos do aviso. O campo do topo da gaveta procura o candidato em todos os avisos. Clicar num caso das análises abre o Painel das análises já buscando pelo nome e com a análise aberta, para conferir e corrigir na planilha; o aviso some na conferência seguinte, quando o problema não aparecer mais. O nome, a vaga e o responsável só aparecem para quem tem a área e o edital da análise no seu recorte.
**fonte:** src/modulos/conferencias/avisos-de-conferencia.jsx; supabase/migrations/20261007120000_casos_dos_avisos_de_conferencia.sql
