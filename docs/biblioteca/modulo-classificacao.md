---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Módulo: Classificação

A tela `#page-classificacao` (view `classificacao`, rota `/<área>/classificacao[/<edital>]`), em
`src/modulos/classificacao/`: `criarClassificacao()` devolve o conteúdo e o controlador; a rota
(`src/app/telas.tsx`) chama `render()` a cada abertura e `abrirEdital()` com o edital do endereço.
Área = a atual do app; sem edital, a entrada mostra a busca e os cards dos editais
(`entrada-da-classificacao.tsx`); escolhido, o nome fica no cabeçalho com "Trocar". Os cards trazem
só os editais da área com análise curricular ativa (qualquer origem) ou com lista gerada, ativos e
em andamento primeiro (`listar_editais_classificacao`,
`20261023120000_classificacao_so_editais_analisados.sql`).

## Notas desta tela

- [[classificacao-em-python]] — relatório de desempate e "Gerar listas pelo Python" (etapas 2a e 2b)
- [[classificacao-publicacao-e-agenda]] — publicar como lista de aprovados, agenda das entrevistas, documento
- [[classificacao-contratos-e-testes]] — arquivos, contratos TypeScript, banco e testes

## Regra e listas

- A regra de classificação é **de cada edital** (decidida pelo gestor, versionada no banco); nada é
  fixo no código. A conta é do motor puro `src/lib/classificacao/motor.ts`. O editor da regra é
  montado em Editais › Regras do edital, etapa 4; a visão "Regra" da tela mostra só o resumo.
- Listas (`TIPOS_DE_LISTA`), no padrão das publicações da AgSUS: `PRELIMINAR` (avaliação documental
  e de títulos, com as parciais e os eliminados — vale como preliminar ou final da etapa; a
  exportação escolhe o título), `CONVOCACAO`, `ENTREVISTA` (resultado da entrevista; empate na mesma
  posição) e `FINAL` (vagas imediatas e cadastro reserva).
- A lista `CONVOCACAO` gerada aqui é a única convocação para a entrevista: Conduzir entrevistas ›
  Preparar mostra a última gerada e registra para a ficha só quem está nela
  (`20261005150000_convocacao_unica_da_entrevista.sql`); o retrato guarda, por vaga, as vagas, a
  origem delas e o limite da convocação (`instantaneoDaLista`).
- Quem ainda não tem resultado na avaliação documental (ficha Pendente, Em análise ou Revisar;
  `SITUACOES_AGUARDANDO_ANALISE` em `catalogo.ts`) fica em "Aguardando análise" (`aguardando` por
  vaga e nos totais): fora das listas e dos eliminados, fora do documento do SEI, numa planilha à
  parte no XLSX.

## Geração desatualizada

A geração guardada é conferida com os dados de agora (`geracaoDesatualizada` em
`src/lib/classificacao/dados.ts`: versão da regra, quantidades e, com o retrato lido, o conteúdo).
Desatualizada, a tela avisa "Esta geração é de …; os dados mudaram desde então — gere de novo.",
bloqueia "Marcar como publicada"/"Publicar como lista de aprovados" e as exportações pedem
confirmação. Os dois caminhos de publicar leem o retrato (`conferirAntesDePublicar` em `estado.ts`)
e só publicam se o conteúdo inteiro bater; senão, pedem para gerar de novo.

## Vagas por modalidade

Quadro do edital > configuração de convocação do edital (Lista de aprovados › Convocação,
`TB_CONVOCACAO_EDITAL`) > percentuais da regra — as duas últimas pela mesma `derivarQuadro` da
convocação (`src/lib/classificacao/convocacao-do-edital.ts`). A regra de classificação decide
listas, remanejamento e acúmulo; a ordem de chamada é da Convocação. Sem acesso à convocação (42501)
ou sem as RPCs no banco, vale a regra; outra falha (rede, banco) vira `erroDaConvocacao`: aviso com
"Tentar novamente" e "Gerar" bloqueado até ler de novo.

## Explicações

Para a Aya: `docs/aya/regras-da-classificacao.md`, `docs/aya/regras-da-lista-de-aprovados.md` e
`docs/aya/regras-das-entrevistas.md`.

## Relacionadas

- [[modulo-avaliacao-documental]] — as notas que entram nas listas; o passo 4 do assistente grava a regra
- [[modulo-triagem]] — listas PROVISORIA e LOTE exportadas pelo gerador daqui
- [[modulo-entrevistas]] — usa a CONVOCACAO, o desempate e a agenda
- [[modulo-aprovados]] — o resultado FINAL vira a lista de aprovados
- [[modulo-recursos]] — ajustes da pontuação aprovados em recurso
- [[modulo-regras-do-edital]] — etapa 4
- [[python-e-jobs]] — a cópia do motor em Python
- [regras-da-classificacao](../aya/regras-da-classificacao.md) — o que a Aya responde sobre a tela (a explicação mora lá, não na interface)
