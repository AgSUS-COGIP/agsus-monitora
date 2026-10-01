# Regras das Entrevistas

A aba Entrevistas (view `entrevistas`): Resultados, Conduzir entrevistas (configuração, convocação e
ficha de notas) e Roteiros. Fontes: `src/modulos/entrevistas/`, `src/lib/conducao-de-entrevista.js`,
`src/lib/roteiro-de-entrevista.js`, `src/lib/entrevistas-do-painel.js`,
`docs/sincronizacao-das-planilhas.md`, `.github/workflows/sincronizar-entrevistas.yml` e as
migrations `20260929235000_entrevistas.sql`, `20260930220000_entrevistas_roteiros_e_notas.sql` e
`20260930235000_janela_da_entrevista.sql`.

## Tela de Entrevistas

**perguntas:** tela de entrevistas | tela entrevistas | aba entrevistas | para que serve entrevistas | para que serve a tela de entrevistas
**resposta:** Entrevistas tem três visões, escolhidas no topo: Resultados (só consulta), Conduzir entrevistas (Passo 1 Configuração, Passo 2 Convocação e Passo 3 Ficha de notas, por edital) e Roteiros. Tudo é da área atual; trocar de área recomeça filtros e edital aberto. Quem não tem nível Editor vê tudo, sem os botões. Lançar notas, convocar, configurar o edital e editar roteiros exige Editor em Entrevistas e acesso à área e ao edital.
**fonte:** src/modulos/entrevistas/entrevistas.jsx; src/modulos/entrevistas/conducao.jsx; supabase/migrations/20260930220000_entrevistas_roteiros_e_notas.sql
**abrir:** entrevistas

## Janela da entrevista

**perguntas:** como funciona a janela da entrevista | janela da entrevista | janela do cronograma da entrevista | 7 dias antes | 15 dias depois
**resposta:** Em Conduzir entrevistas, cada edital tem uma janela: começa 7 dias antes da data de início mais antiga das etapas de entrevista do cronograma e termina 15 dias depois da data de fim mais tardia (sem data de fim, vale a de início). Conta como etapa de entrevista toda atividade cujo nome tenha "entrevista" ou "comportamental". O dia de hoje é o de Brasília, e os dois extremos contam. O edital aparece na lista se estiver na janela, se tiver uma liberação vigente ou se tiver convocado ainda sem parecer.
**fato:** Conduzir entrevistas mostra o edital de 7 dias antes a 15 dias depois das etapas de entrevista do cronograma, quando liberado pelo administrador global ou quando há convocado sem parecer.
**fonte:** supabase/migrations/20260930235000_janela_da_entrevista.sql

## Edital que não aparece em Conduzir entrevistas

**perguntas:** por que um edital nao aparece em conduzir entrevistas | por que o edital nao aparece em conduzir entrevistas | edital nao aparece em conduzir entrevistas | nenhum edital na janela da entrevista | edital sumiu de conduzir entrevistas
**resposta:** Um edital fica fora de Conduzir entrevistas quando: o cronograma não tem atividade com "entrevista" ou "comportamental" (aparece "sem etapa de entrevista no cronograma"); hoje está fora da janela (antes de 7 dias do início ou depois de 15 dias do fim das etapas de entrevista); não há liberação vigente (nunca liberado, vencida ou encerrada); e não há convocado sem parecer. Também some se o edital é de outra área, está inativo ou fica fora do recorte da sua coordenação, ou se você não tem acesso a Entrevistas ou à área. Ter entrevistas em Resultados não faz o edital entrar. Para incluir um edital fora da janela, peça ao administrador global que o libere; ele também tem a caixa "Mostrar todos os editais da área".
**fonte:** supabase/migrations/20260930235000_janela_da_entrevista.sql; src/lib/conducao-de-entrevista.js
**abrir:** entrevistas

## Liberar edital fora da janela

**perguntas:** como liberar um edital fora da janela | liberar edital fora da janela | liberacao fora da janela | encerrar liberacao | mostrar todos os editais da area
**resposta:** Só o administrador global libera um edital fora da janela: em Conduzir entrevistas, escolhe o edital e preenche "Liberar até" (de hoje até no máximo 180 dias) e o Motivo (3 a 500 caracteres). A liberação vence sozinha depois da data e pode ser encerrada antes, também com motivo. Só existe uma liberação vigente por edital; a anterior fica guardada no histórico. A caixa "Mostrar todos os editais da área" também é só do administrador global e traz todos os editais ativos da área, ignorando a janela.
**fonte:** supabase/migrations/20260930235000_janela_da_entrevista.sql; src/modulos/entrevistas/conducao.jsx

## Roteiros e versões

**perguntas:** como funcionam as versoes dos roteiros | roteiro de entrevista | roteiros de entrevista | versao do roteiro | o que e um roteiro
**resposta:** O roteiro é um modelo reutilizável da entrevista: competências (1 a 20, cada uma com nota máxima, peso e mínimo), escala, regra de aprovação, critérios de desempate, convocação padrão e banca padrão; serve a vários editais. Editar grava uma versão nova: os editais que já usam a anterior continuam nela, e a nova vale para as próximas configurações. "Duplicar" cria um roteiro novo, na versão 1. Roteiro sem área serve para qualquer área.
**fonte:** supabase/migrations/20260930220000_entrevistas_roteiros_e_notas.sql; src/lib/roteiro-de-entrevista.js

## Escalas e aprovação na entrevista

**perguntas:** escala do roteiro | escala faixa | escala lista | escala niveis | notas eliminatorias | quando o candidato e apto | como o candidato fica apto
**resposta:** A escala do roteiro pode ser FAIXA (de 0 até a nota máxima, de passo em passo; passo até 5, padrão 0,5), LISTA (só as notas cadastradas) ou NIVEIS (níveis com nome e descrição). O candidato fica APTO quando compareceu, todas as competências têm nota, o total chega ao mínimo total, cada competência chega ao seu mínimo e nenhuma média é eliminatória (se a média da banca numa competência for uma das notas eliminatórias, ele fica INAPTO). Faltou e o roteiro diz que ausência elimina: INAPTO. Falta nota ou comparecimento: SEM_PARECER. A nota da competência é a média dos avaliadores vezes o peso.
**fonte:** supabase/migrations/20260930220000_entrevistas_roteiros_e_notas.sql; src/lib/roteiro-de-entrevista.js

## Banca da entrevista

**perguntas:** banca da entrevista | completar banca | completar pela composicao | quem sai da banca | modo avaliador | secretaria passa a limpo
**resposta:** Na configuração do edital, escolher o roteiro preenche a regra de convocação e a composição da banca com o padrão dele. "Completar pela composição" acrescenta as linhas que faltam, com o nome vazio; "Sou eu" liga o membro ao seu perfil. Quem sai da banca deixa de avaliar, mas as notas que já deu ficam na ficha, com a marca "saiu da banca". O modo de lançamento pode ser "Secretaria passa a limpo" (padrão) ou "Cada avaliador lança a sua": nesse caso cada avaliador só edita a própria coluna (o administrador global lança por qualquer um). A troca de roteiro fica bloqueada quando já há notas lançadas com outro roteiro.
**fonte:** src/lib/conducao-de-entrevista.js; src/modulos/entrevistas/conducao.jsx; supabase/migrations/20260930220000_entrevistas_roteiros_e_notas.sql

## Convocação para a entrevista

**perguntas:** como funciona a regra de convocacao da entrevista | regra de convocacao da entrevista | convocacao da entrevista | desconvocar | convocar candidatos | sugerido | alem da regra
**resposta:** Na convocação aparecem só os candidatos aprovados na análise curricular, da mesma área e edital, na ordem de cada vaga (nota final, depois nome). A regra marca a sugestão: com vaga imediata, até a posição múltiplo × vagas imediatas; sem vaga imediata, até a posição X do cadastro reserva. Uma exceção vale quando o termo dela aparece no nome do cargo, sem diferenciar maiúsculas e acentos. Os de fora aparecem como "Além da regra", e "Voltar à sugestão" refaz a seleção. Convocar exige a configuração salva. Desconvocar exige motivo (3 a 500 caracteres), fica no histórico e só vale para quem ainda não tem nota.
**fonte:** src/lib/conducao-de-entrevista.js; supabase/migrations/20260930220000_entrevistas_roteiros_e_notas.sql

## Ficha de notas

**perguntas:** ficha de notas | como lancar notas da entrevista | lancar notas | comparecimento | resultado recalculado
**resposta:** Na ficha de notas, abra um convocado para lançar o comparecimento (Compareceu ou Faltou) e as notas; a nota precisa estar na escala do roteiro. A cada gravação o banco recalcula o resultado, que aparece em Resultados; toda nota lançada, corrigida ou apagada vai para o histórico. Enter passa para a próxima nota, Ctrl+Enter salva, e há "Salvar e abrir o próximo". A coluna Notas mostra lançadas sobre esperadas (competências × avaliadores da banca).
**fonte:** src/modulos/entrevistas/ficha.jsx; supabase/migrations/20260930220000_entrevistas_roteiros_e_notas.sql; src/lib/conducao-de-entrevista.js

## Resultados das entrevistas

**perguntas:** resultados das entrevistas | indicadores das entrevistas | aprovados sem entrevista | nota divergente | entrevista sem analise
**resposta:** Resultados é só de consulta (a condução é em Conduzir entrevistas). Indicadores: Vagas com entrevista, Candidatos, Compareceram, Aptos, Inaptos, Média das notas (de quem compareceu) e Aprovados na análise sem entrevista; clicar em Compareceram, Aptos ou Inaptos filtra a tela. A nota total vai de 0 a 20 e cada critério, em geral, de 0 a 5. Pendências: aprovados sem entrevista (só nas vagas que já têm entrevista), entrevista sem análise ligada, sem edital cadastrado e nota divergente (total diferente da soma dos critérios). A ligação com a análise curricular é pelo código do candidato e da vaga e, na falta, pelo nome.
**fonte:** src/modulos/entrevistas/paineis.jsx; src/lib/entrevistas-do-painel.js; supabase/migrations/20260929235000_entrevistas.sql

## Carga das entrevistas

**perguntas:** quando as entrevistas sao atualizadas | carga das entrevistas | planilha de entrevistados | atualizacao das entrevistas
**resposta:** Os dados de Resultados vêm da planilha "[dash] entrevistados" (aba Entrevistados), carregada todo dia às 9h de Brasília pelo GitHub Actions, que também pode ser disparado à mão. Uma carga com menos da metade das linhas ativas é recusada, para não apagar tudo por uma planilha quebrada; quem some da planilha fica inativo, nada é apagado. A data da última carga aparece no topo da tela.
**fonte:** .github/workflows/sincronizar-entrevistas.yml; docs/sincronizacao-das-planilhas.md; supabase/migrations/20260929235000_entrevistas.sql
