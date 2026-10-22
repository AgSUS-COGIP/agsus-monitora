# Barra lateral

O módulo inteiro está em React e TypeScript: marca e montagem síncrona,
navegação por área, seletor, acordeões, painéis flutuantes, recolhimento,
rodapé e hooks do ambiente. O estado externo em `estado.ts` recebe a árvore
e o item ativo do app; `tipos.ts` declara os contratos da árvore, do catálogo,
das opções de navegação e dos eventos do painel flutuante.

As regras puras ficam em `src/lib/menu-lateral.ts`: catálogo de abas,
árvore por páginas permitidas, áreas do usuário, manutenção, beta,
seleção do item ativo, troca de área, transbordo e posicionamento.
O snapshot e as listas são expostos somente para leitura.

`abasDoCatalogo` recebe `unknown`, ignora linhas sem identificação, rótulo
ou view textuais e áreas sem identificação textual. Uma resposta sem abas
válidas devolve `null`; o app usa o catálogo do código. Ordens numéricas
aceitam números finitos ou texto numérico. Esta validação não substitui
as permissões: a navegação do app continua decidindo quais páginas entram.

`integracao.ts` resolve as ações existentes da janela no momento do clique,
incluindo as confirmações de saída. Os ids e atributos usados pelo menu no
celular, branding, versão, mapas e tours são preservados. O CSS continua
em `src/styles/`; o breakpoint da gaveta permanece em 900 px.
A logo e a versão continuam sendo atualizadas pelos seus donos no app.

Os hooks limpam os eventos, o observador de tamanho e os temporizadores
ao desmontar. As preferências de áreas fechadas são lidas como `unknown`,
aceitando apenas uma lista de identificações textuais; erros de armazenamento
mantêm o menu aberto por padrão.

O compilador estrito verifica componentes e contratos em
`tests/tipos/barra-lateral.tsx`; não verifica os consumidores JavaScript nem
o perfil de acesso em tempo de execução. Os testes da barra, da navegação,
do catálogo e do menu no celular simulam o app sem usar o banco.
