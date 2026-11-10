---
tipo: regra
area: seguranca
atualizado: 2026-11-10
---

# Dados pessoais (LGPD)

O MONITORA guarda dados de candidatos (nome, CPF, nascimento, contatos, documentos). O repositório
e os logs do GitHub Actions são **públicos**: nada pessoal sai em log, artefato ou resultado de job.

## Na tela (desenho da Avaliação documental, LGPD)

| Dado                                  | Quem vê                                      | Como                                              |
| ------------------------------------- | -------------------------------------------- | ------------------------------------------------- |
| Nome, vaga, modalidade, nota, parecer | leitor do painel e da Avaliação documental   | aberto                                            |
| CPF                                   | analista, revisor e coordenação do edital    | mascarado; "Mostrar" por 60 s, registrado         |
| Nascimento                            | os mesmos                                    | a idade sempre; a data só na ficha                |
| E-mail e telefone                     | ninguém na ficha                             | só na Lista de aprovados/convocação               |
| Documentos                            | quem tem o papel na ficha                    | na Empregare ou em bucket privado com URL assinada curta; cada abertura registrada |
| Nome do parente (P20)                 | analista, revisor e coordenação              | mascarado como o CPF                              |

Os registros de acesso (`TL_ACESSO_FICHA_ANALISE`) ficam só para a coordenação e o administrador
global. Desenho completo em [docs/analises-no-monitora/README.md](../analises-no-monitora/README.md),
seção 10.

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
  ([[funcoes-da-vercel]]).
- Os anexos PDF do candidato aprovado ficam no banco (bytea), com limite de tamanho e quantidade
  ([[modulo-aprovados]]).
- Testes usam dados fictícios; nenhum teste fala com o Supabase ([[testes]]).
- O chamado da Aya omite CPF e e-mail do corpo ([[aya-base-de-conhecimento]]).

## Relacionadas

- [[seguranca]] — segredos e fronteiras
- [[python-e-jobs]] — os padrões dos jobs
- [[modulo-avaliacao-documental]] — onde a ficha mostra os dados
