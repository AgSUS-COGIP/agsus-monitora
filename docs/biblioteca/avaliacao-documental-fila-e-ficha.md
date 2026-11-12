---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Avaliação documental: Fila e ficha

As fases F3 (Fila) e F4 (conteúdo da ficha) da [[modulo-avaliacao-documental]].

## Fila (F3)

- Faixa de situação (No lote, Pendentes, Em análise, Em revisão e Concluídas, cada número um filtro
  da etapa; "N fora do lote" embaixo); filtros (vaga, responsável, modalidade, código ou nome —
  Enter com o código abre a ficha) e **filtros salvos** por pessoa (`TB_FILTRO_FILA_ANALISE`; o
  último filtro também fica no navegador, só por conveniência).
- **Pegar próxima ficha** e o responsável "Minhas fichas" para o analista.
- **Ações em lote** da coordenação, com prévia, confirmação e motivo: distribuir (entre a equipe,
  para uma pessoa ou de volta à fila), liberar reservas, mandar para revisão; "Distribuir as livres"
  e "Abrir fichas do lote".
- **Ficha aberta** no modo de análise (ocupa a área de conteúdo; a lista some): topo fixo com
  "Voltar à fila", candidato (código e nome), vaga, posição, nota declarada (ART), situação,
  responsável, reserva e Anterior / Próxima pela lista filtrada; Esc volta; a ficha aberta fica na
  sessão da aba (recarregar volta a ela).
- **Reserva** de 15 minutos, renovada a cada 5 e liberada ao fechar; vencida, a renovação reserva de
  novo para o responsável sem subir a versão (`20261022130000`) e o cabeçalho mostra "Reserva
  vencida: reabra a ficha"; "Em uso por … desde HH:MM" só para leitura; a coordenação libera reserva
  presa com motivo.
- O seletor mostra só os editais vigentes (`src/lib/avaliacao-documental/editais.ts`), com "Mostrar
  todos os editais da área".
- Na Fila, as concluídas mostram nota e resultado; o analista vê só as vagas que analisa. As listas
  são a TabelaInfinita (`src/ui/`): colunas por etapa, ordem por coluna, busca, "N de M",
  carregamento contínuo e Exportar CSV (`csvDaFila`, csv-security).

## Conteúdo da ficha (F4, `ficha/`)

- **Cabeçalho enxuto** (nome e código, vaga com o nível, chips da nota declarada, posição e
  modalidade; situação, responsável, reserva e regra no "i"; aviso só com menos de 5 minutos de
  reserva) e o stepper (um passo por item que se aplica + Conclusão, com marca de estado e barra de
  progresso). No notebook o bloco preso ao alto encolhe pela altura (`data-tamanho`): "enxuto" até
  860 px de altura CSS e "compacto" ao rolar ou até 680 px (125% de zoom: só as marcas e o nome do
  passo atual); volta ao normal quando a rolagem volta ao alto.
- **Modo foco** (padrão): um item por vez — o enunciado curto ("ver texto completo") e a resposta da
  Empregare em destaque: os arquivos capturados da pergunta, cada um com o link (também quando a
  exportação traz "--"); resposta lida e sem arquivo, "Sem arquivo enviado" e "Conferir na
  Empregare"; arquivo só num envio anterior, "Ver documento do envio anterior"; sem resposta
  capturada, "Abrir na Empregare" e onde achar ("Na Empregare: aba Questionários › Pergunta N — …").
  Tudo sai de `src/lib/avaliacao-documental/anexo-na-empregare.ts`.
- "O documento confere com o declarado?": Confere (pontuação = declarado), Não confere (só o motivo,
  pontuação 0; "não enviou" vira NAO_ENVIADO) e, nos itens que pontuam, Editar nota (−/+ e "Usar o
  calculado") — teclas 1, 2, 3; J/K; Ctrl+S; Ctrl+Enter. Um só resumo "Pontuação: X de 5 · declarou
  5"; no máximo uma mensagem por item (`mensagemDoBloco`). Mapeamento para o banco em
  `apurado-da-ficha.ts`. Confere sem pendência avança sozinho (`proximoPassoPendente`); "Ver todos"
  troca para a lista compacta (escolha no navegador). Pontuação diferente da declarada pede
  justificativa; o stepper conta "X de 6 conferidos" pela regra do "!" (`itemConferido`).
- **Lateral** só com a nota (parcial enquanto falta conferir; Inapto só quando um item conferido
  elimina), o mínimo e a composição por bloco em barras finas (`composicaoDaNota`); ações
  secundárias no "⋯" (copiar código, abrir na Empregare, nível da vaga para a coordenação).
- **Conclusão**: resumo dos itens (clicáveis), nota final com a composição, observações prontas e
  observação, prévia do parecer (sem resultado enquanto falta conferir) e histórico.
- **Rodapé**: "Salvo às HH:MM" (rascunho automático), Anterior / Próximo item e o botão do momento
  ("Próximo pendente", "Revisar e concluir"; na Conclusão, "Concluir e próxima", travado até não
  faltar nada, e "Salvar rascunho"); "← Voltar à fila" salva antes de soltar a reserva; trocar de
  área pergunta se há alteração não guardada (`confirmarTrocaDeArea`), e a ficha que sai salva o
  pendente antes de a fila liberar a reserva (`registrarSalvamento` em `estado-da-fila.ts`).
- **Concluída**: abre na Conclusão, só leitura, com parecer e histórico; a coordenação reabre com
  motivo; "Espelho de nota" imprime o espelho para o candidato (eliminado sem pontos; apto/inapto
  com a pontuação por critério) e "Baixar PDF" baixa o mesmo espelho (gerado no navegador), sem
  gravar nada.

## Modelo do espelho de nota

Os textos da folha (título, subtítulo, saudação com `{candidato}`, abertura, nomes dos quadros,
rótulos das notas, "Não se aplica" do eliminado, "Sem observação registrada.", rodapé e a nota
autodeclarada) são do edital: a coordenação edita em Documentos › "Modelo e pré-visualização" (ao
lado dos espelhos em massa), com prévia e "Restaurar padrão". O espelho da ficha, os em massa, a
impressão e o PDF/ZIP leem o modelo na hora (`textosParaOEspelho`; sem modelo ou sem a RPC, o
padrão). O conteúdo não se edita. Banco: `TB_MODELO_ESPELHO_NOTA` / `TH_MODELO_ESPELHO_NOTA`,
`obter_modelo_espelho_nota` e `salvar_modelo_espelho_nota` (PT409), `20261019120000`.

O editor (`modelo-do-espelho.tsx`, CSS só em `espelho-editor.css`) mostra o timbrado de
Configurações › Marca só para leitura, as seções com nome, contador, "Inserir {candidato}", o resumo
de erros que leva ao campo, Ctrl/⌘+S e "Imprimir exemplo"; a prévia fica fixa ao rolar na tela larga
e embaixo dos campos na estreita. A folha (`ESTILO` em `src/lib/avaliacao-documental/espelho-de-nota.ts`)
segue o manual da AgSUS (General Sans, `#0055a1`), com regras de impressão e de tela pequena; o PDF
(`espelho-em-pdf.ts`) não mudou e tem impressão digital em
`tests/lib/avaliacao-documental-espelho-visual.test.ts`.

## Relacionadas

- [[modulo-avaliacao-documental]] — a tela
- [[avaliacao-documental-arquivos]] — onde está cada peça
- [[modulo-analises]] — a gaveta mostra o mesmo espelho
- [[componentes-padrao]] — TabelaInfinita e demais peças de `src/ui/`
