---
tipo: referencia
area: front
atualizado: 2026-11-26
---

# Auditoria das telas: erros, bugs e travamentos — 26/11/2026

Esta é a frente "telas" da auditoria pedida depois das mudanças dos últimos dias (cabeçalho, lotes
de design, Relatórios com gráficos, Reativar edital, Meus acessos, login automático, Convocações,
marca nova, Aya ilustrada). As outras duas frentes revisam o código e leem os erros reais e o
desempenho do banco. A auditoria só leu: nenhuma tela, RPC ou dado foi mudado.

## O diagnóstico em poucas linhas

- **Nada quebra nem trava.** Foram 283 aberturas de tela, e nenhuma deu `pageerror` ou
  `ErrorBoundary`. Nenhuma ficou presa em "Carregando…" ou esqueleto, e nenhuma rolou de lado,
  em 375, 768 ou 1280px.
- **Sem vazamento de DOM.** Abrir e fechar 20 vezes a Visão geral, a Lista de aprovados e o
  Mapa mantém estáveis os nós e os ouvintes. A heap cresce cerca de 60 KB por ciclo, o que é
  pouco.
- **Os defeitos estão em três lugares:**
  - o registro de acesso: todo F5 vira um "login_google";
  - a navegação: link para uma tela sem permissão cai na Visão geral de **outra área**;
  - o celular: o balão de origem dos números da Visão geral abre fora da tela a 375px.
- **Leituras em dobro:**
  - a página do edital lê 4 RPCs duas vezes por abertura e descarta a primeira leitura;
  - a Triagem pede a lista de editais duas vezes;
  - o selo de avisos pede a área errada (Saúde Indígena) em toda tela fora dela.
- **Quase todos os avisos vermelhos da varredura são da simulação**, não do sistema: RPCs sem
  resposta fictícia, o realtime sem servidor e as funções `/api/*` fora do `vite preview` (lista
  no fim).

## Como foi feita

- Build com `VITE_SUPABASE_URL=https://teste.supabase.co` e servido pelo `vite preview`. O app
  abre com sessão semeada e o Supabase respondido por `page.route`, como em
  `tests/apoio/sessao-simulada.js`. As respostas fictícias são as da auditoria visual
  (`rpcsDaAuditoria` de `tests/fixtures/auditoria-visual/dados.js` e a base de
  `tests/fixtures/acabamento/dados.js`), no cenário "cheia".
- RPC sem resposta fictícia volta 404 `PGRST202` ("não simulada") e fica anotada por tela, para
  separar falha da simulação de defeito. As três RPCs de registro (`registrar_navegacao_monitora`,
  `registrar_presenca_monitora`, `registrar_evento_acesso`) voltam `null`.
- **Rotas:** todas as de `src/lib/navegacao/rotas.ts` nas 3 áreas (20 por área, com página do
  edital, `/<tela>/<edital>` e o caminho antigo `paineis-de-dados`), mais:
  - as Regras do edital (5 etapas na SEDE, Triagem nas outras);
  - Configurações (as 11 seções e a raiz);
  - `/sem-acesso`, `/paineis/inexistente` e `/`.
- **Perfis e larguras:** 94 rotas × 375/768/1280px com o administrador global (matriz inteira),
  mais 37 rotas (SEDE e Configurações) a 1280px com um perfil **Leitor** (`leitor` em tudo, sem
  Configurações, Acessos e Importação).
- **O que se mediu em cada abertura:**
  - `pageerror`, `console.error`/`warning` com origem;
  - respostas 4xx/5xx e pedidos que falharam;
  - RPCs chamadas mais de uma vez;
  - o tempo até ficar pronta (app visível, sem esqueleto nem "Carregando…" por 600ms);
  - tarefas longas (`PerformanceObserver` de `longtask`);
  - `scrollWidth > clientWidth`;
  - os alertas visíveis e a URL final.
- **Interações**, a 1280 e 375px:
  - o modal "Novo edital";
  - a gaveta da linha da Visão geral;
  - o menu ⋯ das linhas de Editais e Aprovados;
  - as abas Ativos/Histórico/Todos;
  - "Meus acessos" no menu da conta.
- **Vazamento:** 20 ciclos tela pesada ↔ Editais pelo menu, com GC forçado (CDP
  `HeapProfiler.collectGarbage`) e `Performance.getMetrics` nos ciclos 0, 1, 5, 10, 15 e 20.
- **Tempos limpos:** uma segunda passada, uma tela por vez a 1280px (a primeira rodou 4 em
  paralelo e serve só para comparar telas entre si).
- **Verificação dirigida:** cada suspeita foi reaberta isolada, com captura, e confirmada no código
  antes de entrar na tabela. Os falsos positivos estão em "Descartados".

Os scripts ficaram fora do repositório, como pedido. Para refazer, basta um spec com
`abrirComSessao` e as fixtures acima.

## Achados (defeitos do sistema)

Gravidade: **alta** quebra a tela, perde dado ou trava; **média** dá resultado errado ou
atrapalha o uso; **baixa** desperdiça leitura ou é acabamento. Nenhum achado é alto.

| #   | Tela                                                                                                     | Largura | O que acontece                                                                                                                                                                                                                                                                             | Evidência                                                                                                                                | Gravidade | Causa provável                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Todas (entrada com sessão guardada: F5, nova aba)                                                        | todas   | Todo carregamento com sessão guardada grava um evento `login_google` com tela `oauth` em `registrar_navegacao_monitora`. O evento certo seria `sessao_restaurada`. Assim a auditoria de acesso conta cada F5 como um login novo.                                                           | Em todas as 283 aberturas, a 2ª chamada de `registrar_navegacao_monitora` é `{"p_evento":"login_google","p_tela":"oauth"}`.              | média     | `src/app/sessao.ts:855-860`: o `SIGNED_IN` que o supabase-js emite ao restaurar a sessão chama `entrar(sessao, "oauth")` por `setTimeout`. Isso ganha da chamada `entrar(sessao, "boot")` (`sessao.ts:1153`), que ainda espera `carregarConfiguracao`; depois, `if (carregamento) return carregamento` descarta o "boot". O nome do evento sai em `src/app/sistema.ts:262-265`. **Para confirmar no banco** (frente do orquestrador): proporção `login_google` × `sessao_restaurada` no registro de navegação. |
| 2   | Link ou F5 numa tela sem permissão (ex.: Leitor em `/sede/recursos` ou `/administracao/configuracoes/*`) | todas   | O aviso aparece ("Sem permissão para analisar recursos.", "Sem permissão para Configurações."), mas a tela de entrada abre em **Saúde Indígena** (`/saude-indigena/visao-geral`), não na área do endereço (SEDE). A pessoa troca de área sem pedir.                                        | Leitor, `/sede/recursos` → `/saude-indigena/visao-geral`; o mesmo nas 12 rotas de Configurações; admin em `/paineis/inexistente` também. | média     | `src/app/navegacao.ts:674-692`: `usarAreaDoEndereco(destino.area)` só roda no ramo da tela permitida (linha 675). No `else` (linha 684) a área fica a padrão, que é a primeira, e `telaDeEntrada` abre nela.                                                                                                                                                                                                                                                                                                   |
| 3   | Visão geral, tabela "Processos seletivos" (cartões no celular), números com origem (Inscritos, Vagas…)   | 375     | O balão "Inscritos do Edital …: 372 · Origem agregada; detalhe individual não disponível" abre com **118px fora da tela, à esquerda**, e o começo do texto não aparece. A medida de rolagem não acusa, porque o balão sai pela esquerda.                                                   | `.ui-popover-painel` com `left: -118px`, `width: 328px`, janela de 375px (captura `balao-375.png` da verificação).                       | média     | `src/ui/ui.css:1934-1955`: o painel é `position: absolute` com `right: 0` (`data-lado="direita"`), preso ao botão, sem limite pela janela. O `max-width` só limita a largura, não a posição. Uso em `src/modulos/visao-geral/tabela.tsx:351-352` e `paineis.tsx:451`. No cartão, o número fica a ~210px da borda esquerda.                                                                                                                                                                                     |
| 4   | Página do edital (`/<área>/edital/<id>`)                                                                 | todas   | Cada abertura pede 2 vezes, no mesmo milissegundo: `listar_vagas_por_cargo_da_visao_geral` (com os ids de todos os editais da área), `listar_acompanhamento_da_visao_geral_se_mudou`, `listar_editais_criticos_manuais` e `get_monitoramento_cronograma`. A primeira leitura é descartada. | 10 de 10 aberturas da página do edital (3 áreas × 3 larguras + Leitor).                                                                  | média     | `src/modulos/pagina-do-edital/pagina-do-edital.tsx:1165-1183` lê no efeito. Logo depois, o `render()` do registro (`pagina-do-edital.tsx:1257-1260`) chama `estado.renovar()`, que soma `geracao`, zera o estado (`src/modulos/pagina-do-edital/estado.ts:222-225`) e faz os efeitos lerem de novo. O resultado da 1ª leitura cai em `minha !== geracao`.                                                                                                                                                      |
| 5   | Triagem (`/<área>/triagem`, com e sem edital)                                                            | todas   | `listar_editais_avaliacao` sai 2 vezes por abertura, com o mesmo argumento, e a primeira resposta é descartada.                                                                                                                                                                            | 20 aberturas (todas as de Triagem).                                                                                                      | baixa     | `src/modulos/avaliacao-documental/entrada-da-pre-classificacao.tsx:45-48`: o efeito chama `estado.carregar(areaDoApp)`. O `render: atualizar` do registro (`:172-178` e `:193`) chama `estado.carregar(area)` ao mesmo tempo, e `src/modulos/avaliacao-documental/estado.ts:269-278` descarta a primeira (`meu !== pedidoDosEditais`).                                                                                                                                                                         |
| 6   | Todas as telas fora da Saúde Indígena; Classificação, Análises, Entrevistas e Aprovados                  | todas   | `listar_avisos_conferencia_se_mudou` sai primeiro com `p_area: "saude-indigena"` (área errada) e depois com a área certa. Nas telas com selo próprio, o selo do módulo sai 2 vezes iguais. São 2 a 4 leituras por abertura onde bastaria 1 ou 2.                                           | 61 aberturas com repetição. Em `/sede/analises`: SI/editais, SEDE/editais, SEDE/analises ×2.                                             | baixa     | O Editais fica montado escondido desde o início (`src/app/telas.tsx:492-504`), e o `SeloDeAvisos` dele (`src/modulos/editais/nucleo.tsx:671`) lê `usarAreaAtual()` antes de a rota fixar a área (`src/modulos/conferencias/avisos-de-conferencia.tsx:1328-1330`). Cada selo cria o próprio estado (`useMemo(criarEstadoDosAvisos)`, `:1321-1324`) e `src/modulos/conferencias/estado.ts:91-140` não junta pedidos iguais em andamento.                                                                         |
| 7   | Todas (entrada)                                                                                          | todas   | `listar_mapa_da_saude_indigena` (configuração `lmap` e rede CNES) é lida em toda entrada, para qualquer área e perfil, inclusive quem só vê SEDE ou Projetos e quem abre Configurações.                                                                                                    | 82 de 82 aberturas a 1280px.                                                                                                             | baixa     | `src/app/carga.ts:97` e `:445-480`: faz parte da carga inicial. A versão guardada na cópia da sessão evita baixar de novo (`p_versao`), mas a 1ª entrada e toda entrada sem cópia pagam o pacote do mapa. **Para confirmar no banco:** o tamanho da resposta e o tempo da RPC.                                                                                                                                                                                                                                 |
| 8   | `/sede/mapa` e `/projetos/mapa`                                                                          | todas   | A rota abre (o menu não mostra o item): a tela fica vazia com "O mapa é da área Saúde Indígena." e a Aya oferece "Primeira vez em Mapa? Posso mostrar a tela item por item". O mapa de Projetos mora na Visão geral de Projetos.                                                           | Captura `mapa-sede.png`/`mapa-projetos.png` da verificação; URL final igual à pedida.                                                    | baixa     | `src/lib/navegacao/rotas.ts:83`: a rota `mapa` vale para toda área, e `src/modulos/mapa/mapa.tsx:144` só troca o conteúdo. O convite da Aya não sabe que a tela está vazia.                                                                                                                                                                                                                                                                                                                                    |
| 9   | Entrevistas com edital no endereço (`/<área>/entrevistas/<id>`)                                          | todas   | O link abre o edital, mas o endereço passa a `/<área>/entrevistas`, sem o edital. Copiar o link ou dar F5 depende do "último aberto" guardado no navegador. Classificação e Triagem mantêm `?edital=<id>`.                                                                                 | `/sede/entrevistas/<id>` → `/sede/entrevistas` (9 de 9); `/sede/classificacao/<id>` → `/sede/classificacao?edital=<id>`.                 | baixa     | `src/modulos/entrevistas/conduzir.tsx` não usa `usarEditalNaUrl`, que a Classificação usa (`src/modulos/classificacao/classificacao.tsx:161`). O edital fica em `CHAVE_DO_EDITAL`, no `localStorage` (`conduzir.tsx:140`).                                                                                                                                                                                                                                                                                     |
| 10  | Visão geral (as 3 áreas)                                                                                 | todas   | É a tela que mais bloqueia a thread. Sozinha, a maior tarefa longa é de 171ms. Com a CPU disputada (4 abas em paralelo), cada abertura tem 2 ou 3 tarefas de 270 a 350ms, até 1,2s somadas. Numa máquina fraca, a tela trava um instante ao abrir.                                         | `longtask` máx. 350ms (Projetos, 768px), 323ms (Projetos, 375px), 305ms (SEDE, 768px) na passada em paralelo; 171ms sozinha.             | baixa     | A Visão geral monta 220 editais, KPIs e tabela de uma vez, com uns 4.900 nós no DOM. Vale um perfil de CPU na frente de código para achar a função.                                                                                                                                                                                                                                                                                                                                                            |
| 11  | Configurações (prévias de Marca, Tela de acesso, Aparência)                                              | todas   | Cada abertura cancela o download de `main-*.css` e `mascote-*.css` (`net::ERR_ABORTED`): a prévia é recriada logo depois de nascer e baixa as folhas de estilo outra vez.                                                                                                                  | 30 aberturas de Configurações com os 2 cancelamentos.                                                                                    | baixa     | `src/modulos/configuracoes/moldura-da-previa.tsx:39-47`: o `<iframe>` copia os `<link rel="stylesheet">` da página. Se o quadro é recriado no mesmo ciclo, os downloads em curso são cancelados.                                                                                                                                                                                                                                                                                                               |
| 12  | Relatórios (build)                                                                                       | —       | O Vite avisa que `graficos-do-relatorio.tsx` é importado de forma dinâmica e estática ao mesmo tempo, e o `import()` dinâmico não divide nada. O Chart.js continua sob demanda (`carregarChart`), então o efeito é pequeno.                                                                | Saída do `vite build`.                                                                                                                   | baixa     | `src/modulos/paineis-de-dados/gerar-relatorio.ts:112` (dinâmico) × `src/modulos/paineis-de-dados/montador-de-relatorio.tsx:41` (estático, `MiniaturaDoGrafico`).                                                                                                                                                                                                                                                                                                                                               |

### Os 5 mais graves

1. **#1, o registro de acesso:** cada F5 vira um `login_google`. O dado de auditoria fica
   inflado e não distingue login de sessão restaurada.
2. **#2, sem permissão leva a outra área:** quem abre um link proibido na SEDE vai parar na Visão
   geral da Saúde Indígena.
3. **#3, o balão fora da tela no celular:** a explicação dos números da Visão geral fica
   cortada a 375px.
4. **#4, a página do edital lê tudo duas vezes:** 4 RPCs por abertura em dobro, inclusive a de
   vagas por cargo com todos os editais da área.
5. **#5 e #6, leituras repetidas na Triagem e nos selos de avisos:** uma lista de editais e de 1
   a 3 leituras de avisos a mais por tela, uma delas para a área errada.

## Vazamento (20 ciclos, 1280px, admin, GC forçado)

As telas visitadas **ficam montadas, escondidas** (`src/app/telas.tsx:67`, de propósito). Por
isso, o 1º ciclo soma os nós da tela pesada, e o que importa é o crescimento depois dele.

| Tela pesada ↔ Editais     | Heap (MB) c0 → c1 → c20 | Nós no documento c0 → c1 → c20 | Ouvintes c0 → c1 → c20 | Leitura                                         |
| ------------------------- | ----------------------- | ------------------------------ | ---------------------- | ----------------------------------------------- |
| Visão geral (SEDE)        | 6,6 → 10,0 → 11,1       | 2.243 → 4.000 → 4.000          | 855 → 1.111 → 1.111    | sem vazamento de DOM; heap +1,1 MB em 19 ciclos |
| Lista de aprovados (SEDE) | 6,6 → 10,6 → 11,9       | 2.243 → 5.746 → 5.746          | 855 → 1.448 → 1.448    | sem vazamento de DOM; heap +1,3 MB em 19 ciclos |
| Mapa (Saúde Indígena)     | 6,6 → 11,4 → 12,2       | 2.247 → 2.265 → 2.265          | 856 → 876 → 876        | sem vazamento; heap +0,8 MB em 19 ciclos        |

A heap cresce entre 40 e 70 KB por ciclo, sem nós nem ouvintes novos. Parece memória das
leituras (versões, avisos), não tela presa. Se houver queixa de lentidão depois de horas aberto,
o próximo passo é rodar 200 ciclos e comparar dois _heap snapshots_.

## As 10 telas mais lentas (1280px, admin, uma por vez)

Uma linha por tela, na área em que ela foi mais lenta. Mediana das 82 rotas: 675ms; a mais
rápida: 469ms.

| #   | Tela                                                            | Pronta em | Maior tarefa longa | Nós no DOM | RPCs na abertura    |
| --- | --------------------------------------------------------------- | --------- | ------------------ | ---------- | ------------------- |
| 1   | Painel da Seleção (`/sede/selecao`)                             | 1.113ms   | 102ms              | 2.381      | 12                  |
| 2   | Página do edital (`/sede/edital/<id>`)                          | 990ms     | 109ms              | 2.050      | 22 (4 em dobro, #4) |
| 3   | Classificação com edital (`/sede/classificacao/<id>`)           | 984ms     | 141ms              | 2.001      | 21                  |
| 4   | Entrevistas com edital (`/sede/entrevistas/<id>`)               | 965ms     | 93ms               | 2.013      | 17                  |
| 5   | Visão geral (`/projetos/visao-geral`)                           | 947ms     | 171ms              | 4.921      | 16                  |
| 6   | Painel das análises (`/sede/analises`)                          | 924ms     | 126ms              | 2.461      | 17                  |
| 7   | Lista de aprovados (`/sede/aprovados`)                          | 919ms     | 102ms              | 5.448      | 16                  |
| 8   | Painel de entrevistas (`/saude-indigena/painel-de-entrevistas`) | 905ms     | 78ms               | 2.644      | 14                  |
| 9   | Relatórios (`/sede/relatorios`)                                 | 839ms     | 141ms              | 1.301      | 15                  |
| 10  | Mapa (`/saude-indigena/mapa`)                                   | 824ms     | 64ms               | 1.966      | 15                  |

O tempo vai do `goto` até a tela pronta (app visível, sem esqueleto nem "Carregando…" por
600ms). As respostas simuladas voltam na hora, então isso é **custo de front** (baixar o pedaço da
tela, montar e desenhar), sem o tempo do banco, que fica com a frente do orquestrador. Sozinha,
nenhuma tela passa de 1,2s nem tem tarefa longa acima de 200ms. As telas com edital (2 a 4) só
chegaram ao estado de erro da simulação, e o tempo real delas inclui o miolo, que não foi medido.
Na passada com 4 telas em paralelo (CPU disputada, como numa máquina mais fraca), os tempos
sobem para 2 a 5s. A 768px foram os maiores, por terem rodado no fim, com a máquina mais
carregada; o Mapa, o Cronograma, a Classificação e a Avaliação documental da Saúde Indígena
ficaram no topo.

## Interações

- **Modal "Novo edital"** (Editais, 1280 e 375px): abre e fecha com Esc.
- **Gaveta da linha** (Visão geral): abre ao tocar na célula da unidade, a 1280 e a 375px.
  Tocar no número abre o balão, como esperado; o balão é o achado #3.
- **Menu ⋯ da linha** (Editais e Aprovados, 1280 e 375px): abre, o foco vai ao 1º item, e Esc
  fecha e devolve o foco ao botão.
- **Abas Ativos/Histórico/Todos** (Editais): trocam sem erro.
- **"Meus acessos"** (menu da conta): abre e fecha sem erro.
- Nenhuma interação gerou `pageerror` ou `console.error` do app.

## Descartados (pareciam defeito, não são)

- **"Esc não fecha o ⋯ a 1280px":** o seletor da varredura (`[role='menu']:visible`) pegava
  outra peça. Reaberto isolado, o `MenuDeAcoes` (`src/ui/menu-de-acoes.tsx:132-139`) fecha com
  Esc e devolve o foco.
- **"A gaveta da Visão geral não abre a 375px":** o toque caiu no número com balão, não na
  linha. Tocando na célula da unidade, a gaveta abre.
- **`registrar_navegacao_monitora` ×2 por abertura:** uma chamada é a `abertura_tela`, a outra
  é o evento da entrada. Não é repetição, mas o nome desse evento está errado (#1).
- **3 × `ler_relatorio_do_painel` em Relatórios:** são os 3 relatórios do painel, com argumentos
  diferentes.
- **"Não foi possível consultar as atualizações.O banco…"** (Status das atualizações): a falta
  de espaço só existe no `textContent`; na tela são parágrafos separados.

## Falhas da simulação (não são defeitos)

Estas aparecem como erro na varredura, mas vêm do que a sessão simulada não imita. Ao fechar a
lacuna da fixture, elas somem.

| O que aparece                                                        | Onde                                                                                                                                                                            | Por quê                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WebSocket … realtime … ERR_NAME_NOT_RESOLVED` (316 `console.error`) | todas                                                                                                                                                                           | o realtime do Supabase não é simulado (o host não existe)                                                                                                                                                                                                                                                                                                                                                                                                   |
| `Unexpected token '<', "<!doctype"…` e "o SIGEPSI não respondeu"     | Mapa da Saúde Indígena                                                                                                                                                          | `/api/territorio-dos-dseis` e a rota das localizações são funções da Vercel; o `vite preview` devolve o `index.html`                                                                                                                                                                                                                                                                                                                                        |
| "… ainda não foi publicada no banco" / "Não simulada no teste"       | Entrevistas, Classificação e Triagem com edital; Regras do edital (Triagem, Avaliação, Entrevista, Classificação); Configurações → Operação, Status das atualizações, Automação | RPCs sem resposta fictícia: `obter_entrevistas_do_edital`, `obter_previsao_entrevista_edital`, `obter_agenda_entrevista`, `listar_roteiros_entrevista`, `obter_classificacao_do_edital(_se_mudou)`, `obter_regra_analise(_se_mudou)`, `obter_regra_triagem`, `get_configuracoes_historico`, `get_saude_das_cargas`, `get_painel_dos_robos`, `obter_catalogo_dos_robos`, `obter_chaves_da_automacao`. A tela mostra o erro com "Tentar novamente", como deve |
| 404 em toda abertura                                                 | todas                                                                                                                                                                           | `obter_inicio_da_sessao`, `listar_abas_do_menu`, `obter_situacao_do_sistema`, `obter_encerramentos_do_edital`, `obter_meu_resumo_do_dia`, `listar_presenca_online_monitora` não têm resposta fictícia. O app segue com os padrões, sem quebrar                                                                                                                                                                                                              |
| "Nenhum processo seletivo nesta área" na Saúde Indígena              | Leitor redirecionado (#2)                                                                                                                                                       | a fixture monta as linhas da área do endereço (SEDE); a tela da outra área fica vazia                                                                                                                                                                                                                                                                                                                                                                       |
| `listar_municipios_das_vagas_da_area` 404                            | Visão geral de Projetos                                                                                                                                                         | o mapa de Projetos não tem resposta fictícia                                                                                                                                                                                                                                                                                                                                                                                                                |

Para a próxima varredura chegar mais fundo nas telas por edital, as fixtures precisam de respostas
para as RPCs da 3ª linha. Hoje elas param no estado de erro, e o miolo (ficha da entrevista,
quadro da classificação, regra da triagem) não foi exercitado.

## Relacionadas

- [Auditoria de responsividade e harmonia (23/11/2026)](auditoria-responsividade-e-harmonia-2026-11-23.md):
  a medição visual das mesmas telas
- [Testes](../biblioteca/testes.md): a sessão simulada e a auditoria visual
- [Arquitetura do front](../biblioteca/arquitetura-do-front.md): telas montadas, carga da entrada
  e rotas
