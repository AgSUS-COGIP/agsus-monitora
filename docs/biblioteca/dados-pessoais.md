---
tipo: regra
area: seguranca
atualizado: 2026-11-17
---

# Dados pessoais (LGPD)

O MONITORA guarda dados de candidatos (nome, CPF, nascimento, contatos, documentos). O repositório
e os logs do GitHub Actions são **públicos**: nada pessoal sai em log, artefato ou resultado de job.

## Na tela (desenho da Avaliação documental, LGPD)

| Dado                                  | Quem vê                                    | Como                                                                               |
| ------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------- |
| Nome, vaga, modalidade, nota, parecer | leitor do painel e da Avaliação documental | aberto                                                                             |
| CPF                                   | analista, revisor e coordenação do edital  | mascarado; "Mostrar" por 60 s, registrado                                          |
| Nascimento                            | os mesmos                                  | a idade sempre; a data só na ficha                                                 |
| E-mail e telefone                     | ninguém na ficha                           | só na Lista de aprovados/convocação                                                |
| Documentos                            | quem tem o papel na ficha                  | na Empregare ou em bucket privado com URL assinada curta; cada abertura registrada |
| Nome do parente (P20)                 | analista, revisor e coordenação            | mascarado como o CPF                                                               |

Os registros de acesso (`TL_ACESSO_FICHA_ANALISE`) ficam só para a coordenação e o administrador
global. Decisões da Avaliação documental em [[modulo-avaliacao-documental]],
seção 10.

## No aparelho (cópias para abrir rápido e sem rede)

Algumas telas guardam no navegador (IndexedDB `agsus-monitora-analises`, loja `payload`) uma cópia
do que o banco mandou, para abrir na hora e para consultar sem rede.

| Cópia (chave)                                                              | O que leva                                                                                                                                     |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Análises (`<área>:<escopo>`)                                               | candidato, vaga, responsável, data e nota da análise                                                                                           |
| Lista de aprovados (`aprovados:<área>`)                                    | nome, nota, classificação, modalidade, status, SEI, matrícula; as listas                                                                       |
| Entrevistas › Resultados (`entrevistas:<área>`)                            | nome e código, notas por critério, parecer, comparecimento                                                                                     |
| Condução (`conducao:editais:…`, `conducao:edital:<id>`)                    | editais da área; convocados (nome, código, vaga, banca), notas, observações e agenda: só da banca de quem avalia (a coordenação leva o edital) |
| Perfil para entrar sem rede (`perfil`)                                     | o perfil (nome, e-mail, grupo, permissões) e os painéis liberados                                                                              |
| Seleção (`selecao:<área>`)                                                 | só contagens por vaga                                                                                                                          |
| Avaliação documental, pré-classificação e Classificação (`<RPC>:<edital>`) | regra; nome, código e notas dos candidatos                                                                                                     |

- **Sem CPF, e-mail nem telefone:** as RPCs dessas telas não os mandam.
- **48 horas** (`VALIDADE_DO_CACHE_MS`, `src/lib/validade-das-copias.ts`): a cópia vencida é apagada
  na leitura e na abertura do app (`src/app/varredura-das-copias.ts`), não só ignorada.
- **De um usuário só:** outra pessoa abrindo uma tela no mesmo navegador apaga as cópias de quem
  veio antes.
- **Saem inteiras** ao Sair, no "Limpar sessão", ao perder o acesso (perfil sem acesso; 42501/22023
  na leitura) e quando outro usuário entra (`apagarCacheDePayload`, `src/app/sistema.ts`).
- Sem rede, a tela mostra a cópia só para consulta, com "Dados de 17/11, 10:14" no topo; gravar
  exige rede.
- A cópia da sessão (banco `agsus-monitora`, `src/lib/copia-da-sessao.ts`) não leva dado de candidato e
  segue com 7 dias.

## Nos robôs e jobs

- Log público: só contagens, códigos de erro e números de edital. Todo log do Python passa por
  `python/monitora/mascaramento.py` (tira e-mail, CPF, telefone, JWT, dígitos longos e segredos).
- Leitura para o job devolve id, código, número de edital, contagem; quando precisa achar a mesma
  pessoa em duas listas, vai um hash.
- O que o job grava para a tela também não leva dado pessoal: os avisos de conferência recusam
  espaço, `@` e 11 dígitos nos exemplos; nome, vaga e responsável a RPC da tela busca na hora, com a
  permissão de quem lê (`listar_casos_aviso_conferencia`).
- Leitura dos arquivos dos candidatos: o arquivo nunca vai para disco, artefato ou log; o texto do
  documento não é guardado. O CPF não chega ao robô: o banco manda `sha256(sal + CPF)` com sal
  sorteado a cada execução e grava só "confere / não confere"; `gravar_leituras_de_arquivos` recusa
  qualquer coisa com cara de CPF ([docs/leitura-dos-arquivos.md](../leitura-dos-arquivos.md)).

## Em outros lugares

- A API `/api/aprovados` entrega nome e matrícula: só com a chave do outro sistema
  ([[deploy-e-vercel]]).
- O relatório da diretoria (aba Aprovados do montador da Visão geral) entrega nome e matrícula só a
  quem é leitor da Lista de aprovados; `exportar_aprovados_da_diretoria` grava cada download em
  `TL_EXPORTACAO_APROVADO` antes de devolver ([[modulo-visao-geral]]).
- Os anexos PDF do candidato aprovado ficam no banco (bytea), com limite de tamanho e quantidade
  ([[modulo-aprovados]]).
- Testes usam dados fictícios; nenhum teste fala com o Supabase ([[testes]]).
- O chamado da Aya omite CPF e e-mail do corpo ([[aya-base-de-conhecimento]]).

## Relacionadas

- [[seguranca]] — segredos e fronteiras
- [[python-e-jobs]] — os padrões dos jobs
- [[modulo-avaliacao-documental]] — onde a ficha mostra os dados
- [[pwa-e-modo-offline]] — o que abre sem rede
