---
tipo: modulo
area: modulo
atualizado: 2026-11-18
---

# Módulo: Página do edital

A página própria de um edital, com endereço: `/<área>/edital/<número-ano>`
(`/saude-indigena/edital/105-2026`). Inspirada no "Ver processo" do SIGEPSI, que não tem endereço
por tela. Pasta `src/modulos/pagina-do-edital/`; regras em `src/lib/pagina-do-edital/`. Só leitura.

## Arquivos

```
pagina-do-edital.tsx  componente e criarPaginaDoEdital() → { estado, conteudo, nome, render() }
estado.ts             store sem React: o cronograma de cada edital e o acompanhamento da área
abrir.ts              abrirPaginaDoEdital(linha, linhasDaArea): o "Abrir página do edital" das outras telas
pagina-do-edital.css  só o que é desta tela; o resto vem de src/ui/
```

## Endereço e navegação

- O pedaço do endereço é o número do edital ("105-2026"; "091-2026" vale como 91/2026). Dois
  editais de mesmo número na área: o endereço de cada um passa a ser o id do monitoramento, e o
  número abre a escolha entre eles (`enderecoDoEdital`, `editalDoEndereco`).
- A rota tem `editalObrigatorio` (`src/lib/navegacao/rotas.ts`): sem edital não é rota, e o edital
  fica no endereço depois de aberto (as outras telas com edital o esquecem). A página não vira a
  tela de entrada guardada.
- **Volta para onde a pessoa veio**: aberta por um clique noutra tela, a navegação guarda o
  `retorno` (a tela e o edital) e o "Voltar" volta pelo histórico, com os filtros da tela de
  antes. Aberta por link ou F5, vai à Visão geral (ou a Editais, ou ao Cronograma, a primeira que o
  perfil abre). Ir à Classificação do edital e voltar pelo navegador mantém o retorno.
- Quem abre: quem vê Visão geral, Editais ou Cronograma (`podeAbrirPaginaDoEdital`,
  `src/lib/acessos/access-roles.ts`). O banco confere de novo: `get_monitoramento_cronograma`
  exige uma delas (ou Lista de aprovados/importação) e o acesso ao edital (`FC_PODE_VER_EDITAL`).

## De onde vem cada dado

- **Cabeçalho**: a linha do monitoramento (`listar_monitoramento_operacional`, a página está em
  `TELAS_COM_LINHAS`): edital, unidade, status, período e o link do edital publicado
  (`link_edital`). A situação excepcional (suspenso, paralisado, cancelado) vem do cronograma
  (`status_override` com motivo, decisão e retomada) ou, sem ela, do status.
- **Vagas** e **candidatos**: as contas da Visão geral (`indicadores-do-monitoramento.ts`) sobre a
  linha enriquecida com o acompanhamento da área (`listar_acompanhamento_da_visao_geral_se_mudou`,
  com versão: aberta depois da Visão geral, o banco responde "inalterado"). "0 de 70
  preenchidas" são as contratações dentro das imediatas; reabertas, as vagas sem contratação
  reabertas em edital mais novo; cadastro reserva, as contratações acima das imediatas. Candidatos
  da lista vigente: aprovados, contratados, aguardando chamada (sem status), demais situações e
  desistentes à parte; sem lista, "—".
- **Linha do tempo**: `get_monitoramento_cronograma`, relido a cada abertura. Cada etapa é
  Concluída, Etapa atual ou Prevista só pelas datas de hoje em Brasília (a mesma regra da linha do
  tempo de Editais); o aviso de sequência incoerente (`sequencia-do-cronograma.ts`) baixa sob
  demanda. As retificações são as erratas do histórico (`TH_CRONOGRAMA_MONIT_INDIG`, ação
  `errata`), da mais recente para a mais antiga.

## Testes

`tests/pagina-do-edital.test.ts` (regras), `tests/modulos/pagina-do-edital.test.ts` (tela),
`tests/rotas.test.js` (rota), `tests/navegacao.test.js` (permissão) e `tests/app/navegacao.test.ts`
("a página do edital": endereço, retorno e permissão).

## Relacionadas

- [[modulo-editais]] — o cadastro, o cronograma e a linha do tempo em modal
- [[modulo-visao-geral]] — as mesmas contas de vagas e candidatos
- [[modulo-cronograma]] — as etapas por data
- [[arquitetura-do-front]] — rotas e navegação
- [[modulo-acessos]] — quem vê
