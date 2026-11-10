# Documentação do MONITORA

Página inicial da pasta `docs/`. Cada documento aparece uma vez, no assunto principal dele.
Fora daqui ficam o `README.md` da raiz (como rodar o projeto), o `DESIGN.md` (guia de interface) e
os `CLAUDE.md` de cada pasta (instruções para o Claude Code).

## Abrir no Obsidian

1. No Obsidian: **Open folder as vault** → escolha a pasta `docs` deste repositório.
2. As configurações combinadas já vêm em `docs/.obsidian/`: links em Markdown comum (funcionam no
   GitHub), caminho relativo, anexos em `anexos/` e modelos em `_modelos/`.
3. Para criar um documento a partir de um modelo, use **Templates: Insert template** (Ctrl+P). Se
   o comando não aparecer, ative o plugin principal **Templates** em _Settings → Core plugins_.

**Não renomeie nem mova documentos pelo Obsidian.** Ele corrige os links entre os docs, mas não os
caminhos citados em workflows, scripts, testes e `CLAUDE.md` (por exemplo,
`docs/sincronizacao-das-planilhas.md` é citado em `.github/workflows/`). Para renomear, faça a busca
no repositório inteiro.

Anotações pessoais (reuniões, rascunhos) vão em `_rascunhos/`. A pasta aparece no Obsidian, mas o
Git a ignora, então ela não tem cópia em lugar nenhum além do seu computador.

## Etiquetas

Cada documento traz no topo (`tags`) um **tipo** e uma ou mais **áreas**. No Obsidian, o painel
_Tags_ e a busca `tag:#tipo/guia` filtram por elas.

| Tipo | O que é |
|---|---|
| `tipo/guia` | passo a passo para operar algo no dia a dia, inclusive na ausência de quem montou |
| `tipo/referencia` | como algo funciona hoje: contrato, modelo, padrão |
| `tipo/arquitetura` | decisão técnica e o rumo do sistema |
| `tipo/desenho` | proposta ainda não implementada, ou implementada em parte |
| `tipo/historia` | histórias de usuário com critérios de aceite ligados a testes |
| `tipo/auditoria` | conferência pontual, com data no nome do arquivo |
| `tipo/registro` | fato datado: o que foi feito, passagem de trabalho |

Áreas: `area/robos`, `area/banco`, `area/front`, `area/servidor`, `area/design`, `area/mapas`,
`area/aya`, `area/avaliacao-documental`, `area/analises-curriculares`, `area/editais`,
`area/aprovados`, `area/conferencias`, `area/recursos`.

## Arquitetura e decisões

- [Arquitetura do MONITORA](arquitetura.md): banco, áreas e permissões.
- [Arquitetura de evolução](arquitetura-evolucao.md): plano técnico de evolução.
- [Arquitetura React](arquitetura-react.md): regras dos módulos, `src/ui/`, etapas da migração.
- [Raiz React única e rotas no endereço](arquitetura/raiz-react.md).
- [TypeScript no frontend](typescript-no-frontend.md): migração gradual.
- [Organização por módulo](superpowers/specs/2026-11-10-organizacao-por-modulo-design.md): regras, `CLAUDE.md` e testes por módulo; piloto em Aprovados ([plano](superpowers/plans/2026-11-10-organizacao-por-modulo-aprovados.md)).
- [Python no MONITORA](python-no-monitora.md): onde o Python roda e como criar um job.
- [Aya pela base de conhecimento](aya-sem-ia-local.md): busca no navegador, sem IA local.

## Banco de dados

- [Banco de dados](banco-de-dados.md): estado, convenções e o que falta reconciliar.
- [Validação do banco no CI](validacao-do-banco-no-ci.md).
- [Mapa da padronização de nomenclatura](padronizacao-nomenclatura-mapa.md): padrão MAD das tabelas.
- [Ajustes de código da padronização](padronizacao-nomenclatura-ajustes-frontend.md) (aplicado).
- Propostas de SQL que ainda não viraram migration: pasta `propostas/`.

## Robôs e cargas

- [Agenda dos robôs](agenda-dos-robos.md): o banco é o único agendador.
- [Sincronização das planilhas](sincronizacao-das-planilhas.md): Entrevistas e Seleção.
- [Robô da Empregare](robo-empregare.md): carga dos candidatos.
- [Leitura automática dos arquivos](leitura-dos-arquivos.md): anexos lidos para a avaliação.

## Front e servidor

- [Design System AgSUS](design-system-agsus.md): guia oficial de UI/UX.
- [Servidor web](servidor.md): contrato, rodar, implantar.
- [Painel externo que avisa quando carregou](painel-externo-avisa-que-carregou.md).

## Mapas e geografia

- [Equipe Núcleo e mapas](nucleo-e-mapas.md): guia de uso.
- [Auditoria geográfica](auditoria-geografica.md): origem das coordenadas (longo, leia por seção).
- [Auditoria das coordenadas contra fontes oficiais](auditoria-oficial-das-coordenadas-2026-10-01.md) (01/10/2026).
- [Auditoria das sedes dos 34 DSEIs](auditoria-sedes-dsei-2026-09-16.md) (16/09/2026).
- [Sedes dos DSEI](sedes-dos-dsei.md): de onde vem cada ponto.
- [Pontos que só existiam na planilha de Lotações](pontos-so-na-planilha-de-lotacoes.md) (02/10/2026).
- [Passagem para o Codex: mapas](handoff-codex-mapas.md) (15/09/2026).

## Avaliação documental e recursos

- [Avaliação documental no MONITORA: desenho](analises-no-monitora/README.md).
- [Modelo de dados](analises-no-monitora/modelo-de-dados.md).
- [Plano de construção](analises-no-monitora/plano-de-construcao.md).
- [Regras dos editais recentes](analises-no-monitora/regras-dos-editais-recentes.md).
- [Parecer de recurso em blocos](recursos/parecer-em-blocos.md) (protótipo).

## Histórias de usuário

Cada critério de aceite tem um código (`ED-1.2`, `AC-3.1`…) repetido no teste que o confere.

- [Análises curriculares](historias-de-usuario/analises-curriculares.md) (`AC`).
- [Avaliação documental no MONITORA](historias-de-usuario/analises-no-monitora.md) (`AM`).
- [Conferências de consistência](historias-de-usuario/conferencias.md).
- [Editais](historias-de-usuario/editais.md) (`ED`).
- [Lista de aprovados](historias-de-usuario/lista-de-aprovados.md).

## Aya

[Base de conhecimento da Aya](aya/README.md). Os `.md` de `aya/` são compilados para o bundle por
`npm run aya:conhecimento`; editou, recompile. Esses arquivos **não levam `tags` no topo** e não
podem receber notas de outro tipo: o compilador lê todo `.md` da pasta.

## Criar um documento

1. Nome em português, kebab-case; com data no nome quando for registro pontual
   (`auditoria-…-AAAA-MM-DD.md`).
2. Comece por um modelo de `_modelos/` e preencha o tipo e a área no topo.
3. Acrescente o link na seção certa desta página.
