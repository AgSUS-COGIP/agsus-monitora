# `docs/`

Cada `[[nome]]` é `docs/biblioteca/<nome>.md`. Como a documentação se organiza: [[documentacao]].
Leia **só a nota ou o documento do assunto**. Nada aqui é carregado pelo build, exceto `aya/`.

| Pasta ou arquivo                                         | O que é                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------ |
| `biblioteca/`                                            | notas curtas, uma por assunto; índice no `CLAUDE.md` da raiz             |
| `_templates/`                                            | modelos de nota (`nota.md`, `modulo.md`, `decisao.md`)                   |
| `_arquivo/`                                              | o que saiu de uso (auditorias datadas, passagens, propostas superadas)  |
| `aya/`                                                   | **base de conhecimento da Aya**, compilada para o app ([[aya-base-de-conhecimento]]) |
| `arquitetura-react.md`, `arquitetura/raiz-react.md`      | alvo do front ([[arquitetura-do-front]])                                 |
| `typescript-no-frontend.md`                              | estado da migração para TypeScript ([[typescript-no-front]])            |
| `banco-de-dados.md`                                      | modelo de dados e história do banco, por seção ([[banco-e-migrations]]) |
| `design-system-agsus.md`                                 | norma visual institucional ([[design-e-tokens]])                         |
| `python-no-monitora.md`, `agenda-dos-robos.md`, `robo-empregare.md`, `leitura-dos-arquivos.md` | robôs e jobs ([[python-e-jobs]], [[robos-e-agenda]]) |
| `sincronizacao-das-planilhas.md`, `painel-externo-avisa-que-carregou.md` | cargas e painéis externos ([[cargas-de-planilha]])   |
| `nucleo-e-mapas.md`                                      | guia de uso do Núcleo e dos mapas                                        |
| `coordenadas/`                                           | auditorias e origem das coordenadas do mapa ([[coordenadas]])            |
| `analises-no-monitora/`, `historias-de-usuario/`, `recursos/parecer-em-blocos.md` | desenho e histórias das telas da seleção     |
| `propostas/`                                             | SQL proposto, ainda não virou migration                                  |

Regras:

- **`aya/` não se reorganiza** (os testes leem os arquivos); editou, rode `npm run aya:conhecimento`.
- Assunto novo vira nota em `biblioteca/` a partir de `_templates/`, ligada por outra nota ou pelo
  índice; `npm run check:docs` confere links e órfãs.
- Documento longo que código, teste ou a Aya citam pelo caminho fica onde está.
- Registro pontual leva a data no nome (`auditoria-…-AAAA-MM-DD.md`) e vai para `_arquivo/` quando
  deixar de valer. Documento descreve o código; quando divergirem, corrija o documento.
