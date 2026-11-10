---
tipo: referencia
area: modulo
atualizado: 2026-11-10
---

# Entrevistas: arquivos, contratos e testes

Mapa de `src/modulos/entrevistas/` ([[modulo-entrevistas]]).

```
entrevistas.tsx         Painel: <TelaDeEntrevistas> e montarEntrevistas()
estado.ts               store do painel: carga da área (cópia guardada), gaveta, CSV, agenda do edital
                        do recorte (obter_agenda_entrevista), comemorações
agenda-e-empates.tsx    agenda dos próximos dias (com um edital no recorte) e aviso dos empatados
paineis.tsx             topo (status, ações), filtros, KPIs, recorte, gráficos, pendências
tabela.tsx              tabela de resultados (TabelaInfinita), selo do parecer e do empate
gaveta.tsx              detalhe (caminho do candidato, critérios) e aprovados sem entrevista
conduzir.tsx            Conduzir: <TelaDeConducao>, Fila/Preparar, contador do dia, comemoração,
                        montarConducaoDeEntrevistas() (render, abrirVisao, abrirEdital)
seletor-do-edital.tsx   o edital no cabeçalho, selo Treinamento, "mostrar também os concluídos",
                        liberação e erros com "Tentar novamente"
fila-do-dia.tsx         a Fila: faixa de situação, barra da lista, tabela em ordem de horário com "Agora"
estado-da-conducao.ts   store da condução e dos roteiros: editais, edital aberto, escritas (uma por vez)
preparar.tsx            Preparar em passos (estado e o que falta de src/lib/passos-do-preparar.ts)
configuracao-do-edital.tsx  roteiro e banca sobre um rascunho só e a barra "Salvar configuração"
editor-da-configuracao.tsx  o gravado (RoteiroEscolhido, BancaGravada) e o editor com rascunho próprio
                        (Regras do edital, etapa Entrevista; grava pelo configurar da loja de condução)
conducao.tsx            BotaoIrPara, ConvocacaoDaClassificacao, DesempateDaClassificacao,
                        ListaDeConvocacao (passo 3) e LiberacaoDoEdital
resumo-das-regras.tsx   "Regras da entrevista": quem é chamado, nota, quem avalia e desempate
competencias-do-membro.tsx  "Competências que avalia" de cada membro (Todas / Só estas)
ficha.tsx               ficha de notas em modo de análise (tela inteira): por avaliador (padrão) ou por
                        competência (lembrado no navegador); componente independente
cabecalho-da-ficha.tsx  nome, vaga, chips, "i", comparecimento, banca, Anterior / "1 de 15" / Próximo
abas-da-ficha.tsx       abas dos avaliadores (ou competências), com o check ao completar
matriz-de-notas.tsx     competências × aspectos (ou "Nota") com o fluxo de planilha (dígito avança,
                        setas/Enter, Backspace volta, fora da escala recusa) e o chip da média
campo-de-nota.tsx       a célula grande da matriz (dica do nível em foco, pulso ao preencher)
resultado-da-ficha.tsx  a lateral viva: total no anel com o mínimo, barras, parecer e "X de Y notas"
textos-da-ficha.tsx     observação do avaliador (opcional) e justificativa da banca (Inapto e Faltou)
parecer-pronto.tsx      o parecer em texto pronto (src/lib/parecer-da-entrevista.ts) e "Copiar parecer"
aspectos-do-roteiro.tsx aspectos no editor (modelo Conceitua · Propriedade · Profundidade)
roteiros.tsx            cartões dos roteiros e o editor (gaveta), com versões; desempate só leitura
secoes-do-roteiro.tsx   seções recolhíveis do editor e o que falta (src/lib/pendencias-do-roteiro.ts)
partes.tsx              composição da banca, botão de linha
marcos.ts               marco "vaga pronta" (comemoração)
tipos*.ts               contratos (painel, ficha, editor de roteiro, estado da condução, convocação)
entrevistas.css         só o que é destas telas (tokens)
```

Regras puras em `src/lib/`: `entrevistas-do-painel.ts`, `painel-de-entrevistas.ts` (edital do
recorte, empates, agenda), `fila-de-conducao.ts`, `conducao-de-entrevista.ts`,
`convocacao-da-entrevista.ts`, `roteiro-de-entrevista.ts`, `digitacao-de-notas.ts`,
`resumo-da-entrevista.ts`, `passos-do-preparar.ts`, `pendencias-do-roteiro.ts`,
`parecer-da-entrevista.ts`, `comemoracao.ts`.

## TypeScript

- Painel: `tipos-do-painel.ts` (entrevistas, filtros, critérios, indicadores, pendências, aprovados
  sem entrevista). O normalizador (`entrevistas-do-painel.ts`) recebe `unknown`, verifica objetos e
  listas e mantém IDs e timestamps como `unknown`. A agenda aceita só os campos usados; respostas de
  agenda anteriores à troca de área ou sessão são descartadas, inclusive para o mesmo edital. O
  cliente declara só `get_entrevistas_da_area` e `obter_agenda_entrevista`.
- Ficha: `tipos-da-ficha.ts` distingue notas diretas de notas por aspectos e declara os campos
  enviados ao salvar (números; `null` apaga). Cálculo, configuração e roteiro em
  `conducao-de-entrevista.ts` e `roteiro-de-entrevista.ts` (escalas, pesos, mínimos, aspectos,
  atribuições, permissões, cálculo do parecer); casos de referência comparam o front com o banco.
- Editor de roteiros: `src/lib/tipos-do-roteiro-de-entrevista.ts` separa texto do rascunho de
  números enviados; campos antigos de convocação e desempate seguem preservados.
- Condução: `tipos-do-estado-da-conducao.ts` limita os nomes de RPC; `src/lib/dados-da-conducao.ts`
  verifica os campos usados e preserva dados opacos da Classificação. Respostas de gravações
  anteriores à troca de área ou sessão não alteram a tela (a gravação no banco não é cancelada).
- Convocação: `src/lib/convocacao-da-entrevista.ts` lê o retrato registrado e o cálculo atual;
  `tipos-da-convocacao-da-entrevista.ts` distingue lista convocável, cálculo de consulta e fonte
  ausente. As comemorações compartilhadas continuam em JavaScript. Nada disso valida o JSON inteiro.

## Testes

`tests/modulos/entrevistas.test.js`, `tests/modulos/agenda-do-painel-de-entrevistas.test.js`,
`tests/modulos/conduzir-entrevistas.test.js`, `tests/painel-e-conducao-de-entrevistas.test.js`,
`tests/digitacao-de-notas.test.js`, `tests/convocacao-da-entrevista.test.js`,
`tests/conducao-de-entrevista.test.js`, `tests/resumo-da-entrevista.test.js`, `tests/preparar-e-fila-de-entrevistas.test.js`. Compilação: `tests/tipos/painel-de-entrevistas.tsx`,
`regras-das-entrevistas.tsx`, `ficha-de-entrevistas.tsx`, `estado-da-conducao.tsx`,
`editor-de-roteiros.tsx`, `convocacao-de-entrevistas.tsx`.

## Relacionadas

- [[modulo-entrevistas]] — a tela
- [[typescript-no-front]] — o estado da migração
- [[testes]] — como rodar
