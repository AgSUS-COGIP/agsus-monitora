# Levantamento: convocações e a issue #581 (24/11/2026)

Levantamento só de leitura, sobre o `origin/main` em `a0bdb83d`. Issue:
[#581](https://github.com/AgSUS-COGIP/agsus-monitora/issues/581), "Centralizar Convocações em uma
aba e auditar funções redundantes" (aberta em 27/10/2026, último andamento em 10/11/2026). Nada de
código, banco ou migration foi tocado.

**Em uma frase:** a Central de convocações existe e já resolve a navegação (um controle "Para
contratação / Para entrevistas" na aba Convocação da Lista de aprovados), mas é só **leitura** para
entrevistas e **ninguém aponta para ela**: as telas de origem continuam como eram. Faltam a agenda
na central, um atalho "Abrir em Convocações" nas telas de origem e a prova (testes e conferência
com perfis) para fechar a issue. A auditoria de funções SQL e utilitários não rendeu nada para
apagar.

## 1. O plano incremental da issue, item a item

| #   | Item da issue                                                                                                                            | Situação                      | Evidência                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Página Convocações com Entrevistas / Contratação e filtros por área, edital e cargo                                                      | **Parcial**                   | O controle está em `src/modulos/aprovados/central-de-convocacoes.tsx:14-20` (`Segmentado`) e é desenhado no topo da aba Convocação (`aba-convocacao.tsx:566`). **Não é uma página**: não há rota própria em `src/app/telas.tsx`. Filtros: a contratação tem Edital, Cargo e Situação (`aba-convocacao.tsx:635-653`); as entrevistas só têm "Edital da entrevista" (`convocacao-para-leitura.tsx`), que é o edital da loja de Conduzir. Os dois blocos **não compartilham** o edital. A área é a da casca. A agenda **não está** na central: `AgendaDoEdital` (`entrevistas/preparar.tsx:133`) nem é exportada.                                                                                                   |
| 2   | Cada bloco só aparece conforme a permissão existente                                                                                     | **Feito**                     | `aba-convocacao.tsx:399`: `podeEntrevistas = canViewEntrevistas(perfil) && conducaoLigada`; sem isso a central devolve `null` (`central-de-convocacoes.tsx:107`) e só resta a contratação. O botão para a Classificação só vem com `canViewClassificacao` (`:108-116`). Conduzir entrevistas desligada na área também esconde o bloco (`usarConducaoLigada`, `:72`).                                                                                                                                                                                                                                                                                                                                             |
| 3   | Redirecionar ações antigas de navegação para o novo ponto único                                                                          | **Não feito**                 | Nenhuma tela de origem leva à central: `grep` por "Abrir em Convocações" não acha nada. O sentido que existe é o contrário (central → Conduzir, `convocacao-para-leitura.tsx`; central → Classificação, `central-de-convocacoes.tsx:108`). A aba e o tipo da central são `useState` local (`lista-aprovados.tsx:384`, `aba-convocacao.tsx:396`), **não vão no endereço**; um atalho precisa de parâmetro na URL (ver `app/usar-filtros-na-url.ts`); `app/pedido-de-filtro.ts` é o canal da Aya e não foi feito para isso. Os links antigos seguem funcionando, que era o outro lado da exigência.                                                                                                                |
| 4   | Trocar botões de convocação repetidos por resumo + "Abrir em Convocações"                                                                | **Não feito**                 | Preparar › Convocação segue completo, com `aoConvocar`/`aoDesconvocar` (`preparar.tsx:569-578`); Classificação › Listas segue com "Agenda das entrevistas" (`listas.tsx:1175`) e gerar/publicar. Ver a seção 2: boa parte disso **não é repetição de verdade**.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 5   | Consolidar utilitários duplicados só após provar equivalência                                                                            | **Não feito, sem alvo claro** | O achado 1 da issue continua certo: `classificacao/convocacao-do-edital.ts:42` importa `derivarQuadro` de `aprovados/lista-convocacao-rules.ts`. `entrevistas/convocacao-da-entrevista.ts` (393 linhas) trata da lista do motor por vaga e do que vai para a ficha, e não repete a ordem de chamada. Não encontrei função equivalente para fundir. O que se repete é a **carga**: três lojas leem `listar_configuracao_convocacao` e `listar_modelos_convocacao` (`classificacao/estado.ts:158-159`, `entrevistas/estado-da-conducao.ts:98-99`, e a de Aprovados), e as de Classificação e Conduzir leem `obter_classificacao_do_edital` e `obter_agenda_entrevista`. Isso é custo de rede, não regra duplicada. |
| 6   | Testar classificação, publicação, entrevista, desconvocação, agenda, carta, status e RLS (troca de área, resposta obsoleta, mobile, Aya) | **Parcial**                   | O #758 trouxe testes da central (leitura, loja compartilhada, falta de permissão, página desligada, falha ao abrir; o arquivo citado no commit `873040d6` hoje está coberto em `tests/casca-com-modulo-simulado-na-tela.test.ts`). **Falta**, como a própria issue diz: contas de perfis diferentes, SEDE e Projetos, celular e tour da Aya (`src/lib/aya/tours/tours.ts` não tem passo para `central-convocacoes`; o `data-tour` existe em `central-de-convocacoes.tsx:121`).                                                                                                                                                                                                                                   |
| 7   | Nenhuma RPC ou tabela removida, nenhuma migration destrutiva                                                                             | **Feito**                     | As duas PRs da issue (#582 e #758) não tocam `supabase/` (`git show --stat`). As RPCs de convocação continuam em `src/lib/rpc-contrato.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## 2. Onde hoje se convoca, e o que de fato se repete

### Convocação para entrevista

| Tela                                                   | Botão / ação                                                                                               | RPC (escrita)                                                   | Lê                                                      |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------- |
| Classificação › Listas › Convocação para entrevista    | **Gerar**; "Marcar como publicada"; exportar/Copiar para o SEI                                             | `registrar_lista_classificacao`, `publicar_lista_classificacao` | cálculo do motor                                        |
| Classificação › Agenda                                 | salvar agenda e regra da agenda                                                                            | `salvar_agenda_entrevista`, `salvar_regra_agenda_entrevista`    | `obter_agenda_entrevista`                               |
| Classificação › Listas (mesma tela)                    | "Agenda das entrevistas" (`listas.tsx:1175`)                                                               | só navega para a aba Agenda                                     |                                                         |
| Conduzir entrevistas › Preparar › passo 3 Convocação   | **Convocar selecionados**; **Desconvocar** (com motivo, só sem notas)                                      | `convocar_para_entrevista`, `desconvocar_da_entrevista`         | `obter_entrevistas_do_edital` (traz `lista_convocacao`) |
| Conduzir entrevistas › Preparar › passo 4 Agenda       | só leitura (`AgendaDoEdital`)                                                                              | —                                                               | `obter_agenda_entrevista`                               |
| Entrevistas (visão do dia)                             | "Agenda na Classificação" (`agenda-e-empates.tsx:54`)                                                      | só navega                                                       |                                                         |
| Lista de aprovados › Convocação › **Para entrevistas** | "Convocar em Conduzir entrevistas" (ou "Abrir…" sem permissão de editar) e "Abrir listas da Classificação" | nenhuma: só leitura                                             | mesma loja de Conduzir                                  |

### Convocação para contratação

| Tela                                                    | Botão / ação                                                                             | RPC (escrita)                                                                           |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Classificação › Listas › Resultado final                | **Publicar como lista de aprovados** (num passo só desde #981, `publicar-aprovados.tsx`) | `pedir_casamento_da_lista`, `aplicar_casamento_da_lista`                                |
| Editais › Regras do edital › 5 Chamada para contratação | editar a configuração de convocação (modelo, vagas imediatas) via `EditorDaChamada`      | `salvar_configuracao_convocacao` (loja de Aprovados)                                    |
| Lista de aprovados › Convocação › Para contratação      | **Marcar quem falta convocar**, **Carta de convocação**, Modelos da carta, Exportar CSV  | `registrar_carta_convocacao`, `marcar_candidatos_convocados` (status Convocado em lote) |
| Lista de aprovados › Aprovados / Pendências             | situação, anexos, sub judice                                                             | RPCs próprias de Aprovados                                                              |
| Editais › modal Listas do edital › aba Convocação       | só resumo (`ResumoDaChamada`)                                                            | —                                                                                       |

### O que de fato se repete para quem usa

1. **A mesma lista para entrevista aparece em dois lugares com ações diferentes:** Classificação ›
   Listas (gerar e publicar) e Conduzir › Preparar (convocar para a ficha); a central mostra uma
   terceira vez, só leitura. Quem convoca precisa saber que "gerar" é na Classificação e "convocar"
   é em Conduzir, e a central **não diz isso nem leva a nenhum dos dois com um clique que já vá
   para o passo certo**. A repetição é de _apresentação_, e é pequena: a lista é a mesma loja.
2. **A agenda aparece em três lugares** (Classificação › Agenda edita; Preparar passo 4 lê; a
   central não tem). Só um deles escreve; os outros dois são leituras.
3. **A configuração da contratação** vive em Regras do edital (etapa 5) e em Aprovados › Convocação
   (a lista que ela produz), mas é a mesma loja; não há duas fontes.
4. **O que _não_ se repete:** convocar para entrevista (ficha, `convocar_para_entrevista`) e
   convocar para contratação (carta e status Convocado) têm candidatos, permissões, RPCs e efeitos
   diferentes, como a própria issue já concluiu no achado 3.

### Prints (sessão simulada, SEDE, administrador, 1280px)

Build com `VITE_SUPABASE_URL=https://teste.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=chave-publicavel-de-teste`,
Supabase respondido por `page.route` com as respostas fictícias de `tests/fixtures/auditoria-visual/`.

- [Para contratação](levantamento-convocacoes-2026-11-24/central-para-contratacao.png): o
  controle no topo e, embaixo, KPIs, filtros e a tabela por vaga.
- [Para entrevistas](levantamento-convocacoes-2026-11-24/central-para-entrevistas.png): o mesmo
  controle, o seletor "Edital da entrevista" e "Abrir listas da Classificação". Com o edital
  escolhido aparece "Convocar em Conduzir entrevistas" (não coberto no print: a simulação não
  responde `obter_entrevistas_do_edital`).

**Não cobri com print:** Preparar › Convocação e Classificação › Listas (pedem respostas fictícias
de `obter_entrevistas_do_edital` e do cálculo do motor que a simulação não tem), nem celular nem
perfis restritos. O levantamento dessas telas vem do código.

## 3. Proposta: 3 PRs pequenas, sem migration

Ordem pensada para cada uma valer sozinha.

**PR 1: Agenda dos convocados na central (só leitura).** A "próxima etapa sugerida" do próprio
andamento da issue.

- Tela: em "Para entrevistas", abaixo da lista, o bloco da agenda do edital escolhido, com o mesmo
  desenho do passo 4 de Preparar; "Editar na Classificação › Agenda" abre a aba certa.
- Arquivos: `entrevistas/preparar.tsx` (exportar `AgendaDoEdital`, hoje função local),
  `entrevistas/convocacao-para-leitura.tsx` (usar com `e.agenda`, a loja já carrega),
  `aprovados/convocacao.css` se precisar de espaço, teste em
  `tests/casca-com-modulo-simulado-na-tela.test.ts` ou no arquivo da central.
- Risco: baixo. Sem estado novo; a loja é a de Conduzir. Cuidar do edital sem agenda salva
  (estado vazio, não erro) e do peso da lista longa (a `AgendaDoEdital` já pagina por 50).

**PR 2: Atalho "Ver em Convocações" nas telas de origem, com link que já cai no bloco certo.**
Resolve os itens 3 e 4 sem tirar nada de lugar.

- Tela: em Classificação › Listas (lista CONVOCACAO) e em Preparar › Convocação, um botão
  secundário "Ver em Convocações" que abre a Lista de aprovados na aba Convocação, em "Para
  entrevistas", com o mesmo edital. **Não** remover "Convocar selecionados" nem "Gerar":
  a central é só leitura, e tirar a escrita das telas de origem deixaria o fluxo sem ação.
- Arquivos: `aprovados/lista-aprovados.tsx` e `aprovados/aba-convocacao.tsx` (ler aba e tipo do
  endereço, hoje `useState` local), `app/usar-filtros-na-url.ts` e
  `app/filtros-no-endereco.ts`, `classificacao/listas.tsx`, `entrevistas/preparar.tsx`, testes.
- Risco: médio-baixo. O ponto delicado é o deep link (aba e tipo hoje não vão para a URL) e o
  caso sem permissão de Aprovados ou sem Conduzir ligada: o atalho **não deve aparecer** (mesma
  regra de `podeEntrevistas`). Não mexe em rota.

**PR 3: Prova: testes de perfil e do celular, e o passo da Aya.** O item 6.

- Tela: nenhuma mudança visível; entra o passo do tour para `central-convocacoes` e o texto da Aya
  (`docs/aya/regras-da-lista-de-aprovados.md`, depois `npm run aya:conhecimento`).
- Arquivos: `lib/aya/tours/tours.ts`, `docs/aya/`, um spec em `tests/sessao-simulada.spec.js` (ou
  novo) para os quatro perfis (só Aprovados; Aprovados + Entrevistas; + Classificação; Conduzir
  desligada) a 375px, e o teste do atalho da PR 2.
- Risco: baixo. Fazer **depois** da PR 2 para testar o atalho também. O tour mexe em IDs
  `data-tour`: não renomear nenhum.

Não precisa de PR de "limpeza de utilitários": ver a seção 4.

## 4. O que da issue não vale mais a pena

- **Consolidar utilitários (item 5).** Não achei equivalência a provar: a regra comum já é
  compartilhada (`derivarQuadro`) e o resto é lógica de domínios diferentes. Fundir
  `convocacao-da-entrevista.ts` com `lista-convocacao-rules.ts` aumentaria o acoplamento entre
  Aprovados e Entrevistas para ganhar pouco. Só vale reabrir se um teste de cota ou empate mostrar
  duas respostas para o mesmo caso.
- **Auditoria e remoção de funções SQL (achados 4 a 6).** A própria issue disse para não remover
  por semelhança de nome; os pares de carga integral e condicional são deliberados, e os dois
  motores (TS e Python) são alinhados por casos dourados. Sem custo claro, nenhuma migration, e
  o risco de quebrar robô ou tela é real. Registrar como "mantido" e fechar.
- **Filtros de edital e cargo valendo para os dois blocos.** O edital da entrevista é o da loja de
  Conduzir (um só) e o da contratação é um filtro múltiplo de uma lista inteira; unir os dois
  muda comportamento da tela de entrevistas. A área já é a da casca. O ganho é pequeno e há risco
  de trocar o edital de Conduzir por acidente; deixar como está.
- **Uma página própria "Convocações" com rota.** A aba com o controle já cumpre o "ponto único"
  sem duplicar permissões nem mexer em menu, tours e `data-tour`. Uma rota nova obrigaria a
  repetir o catálogo de abas e a ligação por área. Só valeria se o usuário pedir convocar a partir
  dela.
- **Trazer a escrita (convocar, desconvocar) para a central.** Iria contra a "fonte única" da
  issue: duas telas escrevendo a convocação da ficha. Convocar fica em Conduzir; a central lê.

## 5. Observações

- **Documentação:** a nota `docs/biblioteca/modulo-regras-do-edital.md` citada no pedido **não
  existe**; as Regras do edital (e a etapa 5 Chamada para contratação) estão em
  `modulo-editais.md` (linhas ~152-153). Não criei nota nova neste levantamento.
- **Ambiente:** na Saúde Indígena deste ambiente, Conduzir entrevistas está desligada em Módulos e
  abas (andamento da issue, 10/11); lá a central some, de propósito. Não revisei se isso mudou.
- **Limites:** não rodei os testes de unidade nem o Playwright completo; li a central, as telas de
  origem, `estado*.ts` e o contrato de RPC. Não consultei o banco.
