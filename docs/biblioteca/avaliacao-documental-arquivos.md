---
tipo: referencia
area: modulo
atualizado: 2026-11-10
---

# Avaliação documental: arquivos, contratos e testes

Mapa de `src/modulos/avaliacao-documental/` ([[modulo-avaliacao-documental]]).

```
avaliacao-documental.tsx  tela e montarAvaliacaoDocumental() (na #page-avaliacao-documental)
estado.ts                 store sem React: editais, regra, equipe e as gravações (RPCs)
abas-e-entrada.ts         abas por papel, edital que abre sozinho, último edital lembrado
entrada-da-avaliacao.tsx  cartões dos editais vigentes (sem edital escolhido)
regra.tsx                 editor da regra (Regras do edital, etapa 2): formulário, perguntas, versões, aldeias
assistente/               assistente da regra; diferencas-por-cargo.tsx (assistente e modo avançado)
blocos.tsx                os blocos da ficha na regra
previa.tsx                "Testar com um candidato fictício" (entradas à esquerda, resultado à direita)
equipe.tsx                aba Equipe
pre-classificacao.tsx     Triagem (Pessoas, Por vaga e Regra, faixa de situação, listas oficiais)
pessoas-da-triagem.tsx    aba Pessoas da Triagem (BarraDaLista, TabelaDaLista, AcoesDaLinha; 50 por vez;
                          regras em src/lib/avaliacao-documental/pessoas-da-triagem.ts; filtro na sessão)
fila.tsx                  aba Fila (FaixaDeSituacao, BarraDaLista, seleção em lote, TabelaDaLista, ficha
                          aberta); números em src/lib/avaliacao-documental/numeros-da-fila.ts (selo e meta
                          do dia de obter_ritmo_da_analise, a conta do Painel das análises)
resumo-do-andamento.tsx   "Por vaga (N)" recolhível, embaixo da faixa da Fila
estado-da-fila.ts         obter_fila_avaliacao (lote e contagens), fora do lote sob demanda em páginas
                          (obter_fila_fora_do_lote, lib fila-fora-do-lote.ts), Pegar próximo, reserva,
                          distribuição, revisão, filtros salvos
ficha/ficha.tsx           conteúdo da ficha aberta: modo foco / lista, passos, teclas, rodapé
ficha/*.tsx               cabeçalho, stepper, item, Conclusão, nota, "⋯", rodapé, links da Empregare
                          (contratos em ficha/tipos.ts); escolhas em lib apurado-da-ficha.ts
ficha/diferencas-do-cargo.tsx  requisitos e extras do cargo, aviso do 8.2.7, área exigida
ficha/espelho-de-nota.ts  "Espelho de nota": monta (lib espelho-de-nota.ts), imprime ou baixa o PDF
                          (espelho-em-pdf.ts: jsPDF + autotable, sob demanda), sem banco nem Storage;
                          entrada em lib espelho-da-ficha-gravada.ts (a mesma dos espelhos em massa e da
                          gaveta do Painel das análises); baixarZipDosEspelhos: o ZIP (fflate)
ficha/estado-da-ficha.ts  obter_ficha_analise, rascunho automático, concluir_ficha, reabrir_ficha,
                          registrar_acesso_ficha
ficha/reabrir-a-ficha.tsx "Reabrir": motivo da lista fixa, complemento e "Outro" (lib
                          motivos-da-reabertura.ts, qualidade-do-motivo.ts; 20261021110000)
ficha/ficha.css           estilos da ficha (só tokens)
modelo-do-espelho.tsx     Documentos › "Modelo e pré-visualização" (lib modelo-do-espelho.ts, banco em
                          modelo-do-espelho-no-banco.ts, 20261019120000)
espelhos-em-massa.tsx     vaga e filtro ou códigos colados, obter_espelhos_de_nota em páginas de 200
                          (20261015180000); ZIP com um PDF por candidato ou um documento para imprimir
espelhos.tsx              aba Documentos (só coordenação): espelhos das concluídas, em massa, modelo e o
                          atalho para os comunicados (que ficam na Triagem)
documentos-em-lote.tsx    AcoesEmLote (PDF / ZIP / impressão, "x de N", Cancelar) e DocumentosEmLote;
                          lib documentos-em-lote.ts; a Triagem usa AcoesEmLote nos comunicados
relatorio-de-motivos.tsx  Ações › "Relatório de motivos": filtros, listar_relatorio_de_motivos em páginas
                          de 500 (20261020120000), CSV/XLSX no navegador; lib relatorio-de-motivos.ts
estado-da-pre-classificacao.ts  obter_pre_classificacao, Recalcular, listas, Copiar para o SEI e DOCX
decisao-do-lote.tsx       selo "Decisão: …", incluir e revogar decisão (Triagem e Fila)
decisao-no-banco.ts       incluir_no_lote_por_decisao / revogar_decisao_lote (uma chamada por vaga)
campos.tsx                peças de formulário da regra
avaliacao-documental.css  só tokens
```

Os arquivos de `lib` acima estão em `src/lib/avaliacao-documental/`.

## TypeScript

Módulo e lib estão em TypeScript/TSX, sem JS/JSX. Contratos: `tipos-do-estado.ts` (snapshot e ações
dos stores da avaliação e da fila, linhas das RPCs, gravações), `tipos-da-pre-classificacao.ts`
(linhas de `obter_pre_classificacao`, store da aba, decisão do lote), `ficha/tipos.ts`,
`assistente/tipos.ts` (rascunho da regra) e, na lib, `tipos-da-regra.ts` (regra normalizada) e
`tipos-da-ficha.ts` (lançamento, conta, pendências e passos). O que vem do banco entra como
`unknown` ou é afirmado na fronteira (`as` na resposta da RPC); a anotação não valida JSON em
execução — quem valida a forma são `normalizarRegraAnalise`, `validarRegraAnalise`,
`normalizarFiltro` e o banco.

## Testes

`tests/modulos/avaliacao-documental.test.js`, `tests/modulos/avaliacao-documental-assistente.test.js`,
`tests/modulos/avaliacao-documental-fila.test.js`,
`tests/modulos/avaliacao-documental-ficha.test.js`, `tests/lib/avaliacao-documental-ficha.test.js`,
`tests/python/test_pontuacao.py`,
`tests/python/test_distribuicao.py`, `tests/lib/avaliacao-documental-decisao-do-lote.test.js`,
`tests/modulos/avaliacao-documental-pre-classificacao.test.js`,
`tests/lib/avaliacao-documental-*.test.js`, `tests/python/test_pre_classificacao.py`,
`tests/python/test_pre_classificacao_job.py`; diferenças por cargo em
[[avaliacao-documental-regra]].

## Relacionadas

- [[modulo-avaliacao-documental]] — a tela
- [[avaliacao-documental-fila-e-ficha]] — o comportamento da Fila e da ficha
- [[testes]] — como rodar
- [[typescript-no-front]] — estado da migração
