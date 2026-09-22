/*
  Marca todos os editais já cadastrados como responsabilidade da USI.

  O campo `responsavel` mudou de significado. Até agora era texto livre e
  guardava a pessoa que acompanhava o edital ("Responsável pelo
  acompanhamento"); passou a ser a área responsável, escolhida num select com
  duas opções: USI e CORES.

  Todos os editais que existem hoje são da USI — o CORES entra com este campo.
  Sem esta migração, cada um deles abriria no formulário com o responsável
  vazio, porque um nome de pessoa não é nenhuma das duas opções, e alguém
  teria de escolher à mão edital a edital.

  O valor anterior NÃO é preservado: quem acompanha o edital é outra informação,
  que este campo deixou de carregar. A operação é irreversível.

  A escolha também decide o catálogo de unidades do formulário — USI usa
  `TD_UNIDADE` (DSEI e CASAI), CORES tem sete unidades próprias fixadas no
  frontend. Por isso marcar tudo como USI mantém as unidades já gravadas
  coerentes com o que o select vai oferecer; o contrário deixaria editais de
  DSEI apontando para um catálogo que não os contém.
*/

/*
  `updated_at` fica como está de propósito. Esta é uma correção de semântica do
  campo, não uma edição de edital por alguém — carimbar hoje em todas as linhas
  faria a tela mostrar a base inteira como recém-alterada.

  `is distinct from` em vez de `<>` para alcançar também as linhas com
  `responsavel` nulo, que `<>` deixaria de fora.
*/
update public."TB_MONITORAMENTO_INDIGENA"
set responsavel = 'USI'
where responsavel is distinct from 'USI';

comment on column public."TB_MONITORAMENTO_INDIGENA".responsavel is
  'Área responsável pelo edital: USI ou CORES. Define o catálogo de unidades oferecido no formulário.';
