---
tipo: decisao
area: modulo
atualizado: 2026-11-11
---

# Avaliação documental: o que falta e as decisões

O que sobrou do desenho de 05/10/2026 (desenho, modelo de dados, plano de construção e protótipo
saíram em 11/11/2026: F1 a F4 estão no código e em [[modulo-avaliacao-documental]]). Critérios de
aceite nas histórias AM-n
([historias-de-usuario/analises-no-monitora.md](../historias-de-usuario/analises-no-monitora.md)).

## O que falta (F5–F8)

Conferido no código em 11/11/2026.

| Fase | Entrega | Situação |
| ---- | ------- | -------- |
| F5 — Revisão personalizável | amostra (X%, todas, só inaptos, divergentes, sinais, os que entraram pela linha, duplo-cego), sorteio com semente, validar ou devolver com motivo (quem analisou não valida), aba "Para revisar" (AM-13) | não feita: só a configuração "Revisão" da regra; não há `FC_SORTEAR_REVISAO`, `validar_ficha` nem `devolver_ficha` |
| F6 — Listas com o parecer | PRELIMINAR (Preliminar e Final) com o título "…ETAPA DE AVALIAÇÃO DOCUMENTAL E DE TÍTULOS", a coluna "Classificação na Modalidade", o parecer da ficha como justificativa dos inaptos, "Ver ficha da avaliação" na gaveta do recurso (AM-17, AM-20.1) | parcial: o título já sai em `src/lib/classificacao/documento-sei.ts`; falta o "Ver ficha" no recurso |
| F7 — Endereços da Empregare | o robô grava a cada execução o endereço das candidaturas de cada vaga (`DS_URL_CANDIDATURAS`) e o do currículo de cada candidato (`DS_URL_CURRICULO`), sobrescrevendo (os tokens mudam); "Abrir na Empregare" abre direto o currículo, senão a vaga + "Copiar código" (AM-7.2, AM-18b) | não feita (o robô já baixa os anexos, modo "Só anexos"). Links são dado restrito: só a RPC da ficha os devolve; nenhum token no log do Actions |
| F8 — Virada do 93/2026 | `definir_origem_analise` com **adoção** das linhas ativas da planilha (o mesmo `id`, `CO_PLANILHA` = `monitora-projetos`): as em Revisar viram fichas "importadas da planilha" em Revisar, as Pendentes viram fichas Pendentes; conferidor Python antes e depois; aviso no Painel das análises (AM-18) | não feita: a troca de dono existe, a adoção não. Antes: o edital inativo na `DIM_EDITAIS` da planilha de Projetos e nenhuma carga em andamento, senão a carga inteira de Projetos é recusada |

Depois da F8, editais novos nascem `MONITORA` (regra copiada de um modelo); os em andamento viram
edital a edital, entre etapas, nunca durante prazo de recurso. No fim saem o simulador e o web app
do Apps Script, as planilhas de vaga (arquivadas, só leitura), os scripts de sync de `apps-script/`
e, no banco, `TL_SYNC_ANALISE`, `TM_ANALISE_CURRICULAR`, `TA_ORIGEM_ANALISE` e as RPCs de sync.

## Decisões

- **Uma tabela só:** a ficha publica na mesma `TB_ANALISE_CURRICULAR` (origens `monitora-*`);
  `id_origem` = código Empregare, então a `chave_natural` é a da planilha. Tabela nova com view
  unificada foi descartada: os vínculos apontam para `TB_ANALISE_CURRICULAR.id`, e a view criaria
  dois `id` para o mesmo candidato.
- **Dono único por edital** (`TB_ORIGEM_ANALISE_EDITAL`: `PLANILHA`, `COMPARACAO` ou `MONITORA`).
- **ART** é a nota da Empregare. **Lote** recortado da Provisória por ART, tamanho personalizável
  por edital e vaga; "a linha anda" repõe o lote. Revisão e distribuição personalizáveis. Título
  padrão das listas: "Avaliação Documental e de Títulos". Piloto: 93/2026 (SESMT, Projetos).
- **Recurso:** o ajuste aprovado vale por cima da nota, sem alterar a ficha. Sem ninguém no grupo
  Jurídico, só os administradores dão o parecer jurídico: atribua o grupo antes do primeiro prazo.
- Quem vê CPF, nascimento e documentos: [[dados-pessoais]].

## Riscos

| Risco | Cuidado |
| ----- | ------- |
| A Empregare muda os enunciados e o bloco perde a pergunta | ligação pelo enunciado, conferida a cada carga; a ficha mostra "pergunta não encontrada" |
| A Empregare muda o HTML ou os tokens | teste de fumaça do robô; recaptura a cada execução |
| Planilha e MONITORA no mesmo edital | dono único por edital; virada em passos |
| Conta diferente do simulador (dias ÷ 30, união com o dia seguinte, ano = 365) | casos dourados em JS, Python e banco |

## Perguntas em aberto

- Documentação de cota incompleta faz o candidato seguir na ampla? Heteroidentificação e perícia
  serão registradas no MONITORA?
- Vínculo ativo ou parentesco: só alerta, ou impedimento em algum edital?
- Bloquear "Concluir" fora da janela da análise, ou só avisar?
- Quem tem as listas de aldeias dos outros DSEI? O recurso pode mudar os desempates?
- Na virada do 93/2026, as fichas em "Revisar" entram como importadas para um revisor validar, ou
  a equipe preenche a etapa na planilha antes?

## Relacionadas

- [[modulo-avaliacao-documental]] — a tela e as fases F1 a F4
- [[modulo-triagem]] — a Provisória e o lote (F2)
- [[robos-e-agenda]] — o robô da Empregare (F7)
