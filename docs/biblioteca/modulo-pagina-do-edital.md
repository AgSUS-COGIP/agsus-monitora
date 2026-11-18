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
                      (usa src/lib/pagina-do-edital/endereco-do-edital.ts, leve, para não pesar na entrada)
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
- **Quem leva à página**: o botão "Abrir página do edital" na gaveta da Visão geral (o primeiro do
  rodapé; fecha a gaveta), em cada linha de Editais, na linha do
  tempo do Cronograma (o edital escolhido) e na busca global (o resultado marcado; a área troca
  para a do edital, e volta se a navegação recusar: `abrirPaginaDoEditalNaArea`). Todos chamam
  `abrir.ts` na hora do clique.
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
  reabertas em edital mais novo; contratações além das vagas imediatas, as acima delas. Candidatos
  da lista vigente: aprovados, contratados, aguardando chamada (sem status), demais situações e
  desistentes à parte; sem lista, "—".
- **Linha do tempo**: `get_monitoramento_cronograma`, relido a cada abertura. Cada etapa é
  Concluída, Etapa atual ou Prevista só pelas datas de hoje em Brasília (a mesma regra da linha do
  tempo de Editais); o aviso de sequência incoerente (`sequencia-do-cronograma.ts`) baixa sob
  demanda. As retificações são as erratas do histórico (`TH_CRONOGRAMA_MONIT_INDIG`, ação
  `errata`), da mais recente para a mais antiga.

## Abas

A aba vai no endereço (`?aba=etapas`) sem empilhar entrada no histórico: o "Voltar" da página não
passeia pelas abas.

- **Resumo**: vagas, candidatos, o andamento (a etapa atual e a próxima prevista) e os avisos de
  conferência abertos do edital (o estado da central, `criarEstadoDosAvisos`, lido pela área e
  recortado pelo `editalId`; quem não vê os avisos não vê o bloco).
- **Vagas e cargos**: o quadro de vagas (`obter_quadro_de_vagas`, lido quando a aba abre) e o
  vínculo vaga–quadro de [[modulo-editais]]: confirmadas, ambíguas (com as linhas possíveis) e
  ausentes, só para ler. O quadro é de Editais, Cronograma ou Entrevistas: sem esse recurso, aviso.
  Com zero vagas imediatas, o Resumo também lê o quadro: só mostra **Somente cadastro reserva**
  quando todas as linhas confirmam zero imediatas e cadastro reserva. Nesse caso, troca o
  "0 de 0 preenchidas" por "Sem vagas imediatas" e as contratações do cadastro reserva.
  Quadro ausente, incompleto ou com erro não comprova cadastro reserva.
- **Etapas**: a linha do tempo inteira e as retificações.
- **Candidatos**: os números e as telas da seleção já no edital, só as que o perfil abre. Triagem,
  Avaliação documental, Entrevistas e Classificação recebem o id (`abrirEdital`); Seleção e Lista de
  aprovados, o número num pedido de filtro (`src/app/pedido-de-filtro.ts`).
- **Fontes e histórico**: de onde vem cada dado (cadastro, cronograma e sua origem, quadro de vagas
  e o arquivo, funil, admissões conciliadas, edital publicado) e o histórico inteiro do cronograma.

## Testes

Blocos `lib/pagina-do-edital` (regras, `tests/editais-cargas-e-paineis.test.ts`) e
`modulos/pagina-do-edital` (tela, `tests/editais-cargas-e-paineis-na-tela.test.ts`); a rota e a
permissão em `tests/casca-sessao-e-interface.test.js`; endereço, retorno e permissão na navegação
em `tests/casca-sessao-e-interface-na-tela.test.ts` (bloco `app/navegacao`, "a página do edital").

## Relacionadas

- [[modulo-editais]] — o cadastro, o cronograma e a linha do tempo em modal
- [[modulo-visao-geral]] — as mesmas contas de vagas e candidatos
- [[modulo-cronograma]] — as etapas por data
- [[arquitetura-do-front]] — rotas e navegação
- [[modulo-acessos]] — quem vê
