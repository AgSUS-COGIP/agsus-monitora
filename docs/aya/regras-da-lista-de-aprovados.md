# Regras da Lista de aprovados

A tela Lista de aprovados (view `approved`): status dos candidatos, importação, convocação, sub
judice e anexos. Fontes: `src/componentes/lista-aprovados/`, `src/lib/lista-aprovados-rules.js`,
`src/lib/aprovados-import.js`, `src/lib/lista-convocacao-rules.js`,
`src/lib/modelo-de-convocacao.js`, `src/lib/anexos-do-candidato.js`, `src/lib/access-roles.js` e as
migrations `20260928235000_anexos_so_admin.sql`, `20260930200000_aprovados_por_grupo_edital_gestor_edita.sql`
e `20261001150000_sub_judice_alteracao.sql`.

## Tela da Lista de aprovados

**perguntas:** tela da lista de aprovados | lista de aprovados | aba lista de aprovados | para que serve lista de aprovados | para que serve a lista de aprovados | status do candidato
**resposta:** A Lista de aprovados mostra a lista vigente de cada edital da área atual. Os status do candidato são Contratado, Desistente, Migração, Documentação Rejeitada e Fim de Fila; Contratado e Migração exigem matrícula. Status já definido só quem tem Administrador em Aprovados altera (os demais veem um cadeado). Quem tem Editor em Aprovados muda status; o grupo Edital gestor edita a lista desde que tenha a área e o edital. Quem importou ou substituiu a lista fica registrado.
**fonte:** src/lib/lista-aprovados-rules.js; src/componentes/lista-aprovados/; supabase/migrations/20260930200000_aprovados_por_grupo_edital_gestor_edita.sql
**abrir:** approved

## Lista inativa

**perguntas:** o que acontece com uma lista inativa | lista inativa | listas inativas | ativar lista | inativar lista
**resposta:** Listas inativas continuam consultáveis, mas seus candidatos não podem ser alterados, nem receber anexos. Ativar ou inativar a lista é de quem pode importar (Editor em Importação, como o grupo Edital gestor); substituir ou remover o XLSX de uma lista existente é do Administrador em Importação.
**fonte:** src/lib/lista-aprovados-rules.js; src/lib/access-roles.js

## Importar a lista

**perguntas:** importar lista de aprovados | importacao do xlsx | colunas do xlsx | substituir lista
**resposta:** A importação aceita só .xlsx e usa a primeira aba, com as colunas obrigatórias codigo_vaga, cargo, classificacao, nota, nome e modalidade (classificação inteira maior que 0; nota numérica, 0 ou mais); mostra até 12 erros por vez. Importa quem tem Editor em Importação (ou o grupo Edital gestor); substituir uma lista existente é do Administrador. A importação liga os candidatos ao edital pelo ID do edital.
**fonte:** src/lib/aprovados-import.js; src/lib/access-roles.js

## Modelo de convocação

**perguntas:** como funciona o modelo de convocacao | modelo de convocacao | cotas intercaladas | ordem da convocacao | sem modelo de convocacao
**resposta:** O modelo de convocação são as regras de reserva do edital: categorias, percentuais, arredondamento e cascata. As vagas de cota entram intercaladas às de ampla (proporcional, como AC, PP, AC, AC, PP, AC, ou nas posições fixas que o edital publica) e a convocação segue a classificação. Quem concorre a cota concorre também à ampla, e ser chamado pela ampla não gasta a vaga da cota; cota sem candidato desce a cascata e, no fim, volta para a ampla. Desistente e Documentação Rejeitada não ocupam vaga; Fim de Fila vai para depois de todos. As vagas imediatas são informadas por vaga (zero vira cadastro reserva). Sem modelo, tudo sai como ampla concorrência. O modelo é compartilhado entre editais: a tela avisa quantos serão afetados e oferece "Duplicar". Modelo e vagas valem para o edital e sobrevivem à troca do XLSX.
**fonte:** src/lib/lista-convocacao-rules.js; src/lib/modelo-de-convocacao.js; src/lib/configuracao-de-convocacao.js

## Candidato sub judice

**perguntas:** como funciona o candidato sub judice | sub judice | decisao judicial | incluir sub judice
**resposta:** Quem tem Editor em Aprovados inclui um candidato sub judice, que fica vinculado à lista vigente do edital; remover vale só para quem foi incluído assim. Alterar nota ou modalidade por decisão judicial, e desfazer, é só do Administrador em Aprovados: a classificação é refeita e o número do processo judicial é opcional.
**fonte:** src/lib/access-roles.js; src/lib/lista-aprovados-rules.js; supabase/migrations/20261001150000_sub_judice_alteracao.sql

## Anexos do candidato

**perguntas:** quem pode anexar documentos ao candidato | anexos do candidato | anexar pdf ao candidato | documentos do candidato
**resposta:** Só quem tem Administrador em Aprovados inclui e remove anexos do candidato, e só em lista ativa: PDF de até 2 MB, no máximo 5 por candidato. Ver e baixar os anexos é para quem lê a lista.
**fonte:** src/lib/anexos-do-candidato.js; src/lib/lista-aprovados-rules.js; supabase/migrations/20260928235000_anexos_so_admin.sql
