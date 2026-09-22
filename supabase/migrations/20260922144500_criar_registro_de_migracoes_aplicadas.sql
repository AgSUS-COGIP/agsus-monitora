/*
  REGISTRO DO QUE JÁ FOI APLICADO NO BANCO

  Este repositório tem 25 migrations e 7 ficheiros de correção de dados, e
  nenhum sítio que diga quais deles já correram. A resposta vive na memória de
  quem aplicou — e `docs/banco-de-dados.md` reconhece isso ao dizer que três
  ficheiros "não devem ser renomeados: já foram aplicados, e renomear quebraria
  o histórico de quem os aplicou". Esse histórico não existe em lado nenhum
  além das pessoas.

  O custo disso é medível. Na revisão de setembro de 2026, a pergunta "preciso
  rodar algum SQL?" apareceu cinco vezes, e cada resposta exigiu puxar o payload
  do banco e comparar coordenada a coordenada — treze scripts descartáveis para
  a mesma pergunta. Com este registro, é uma consulta.

  A ideia é do SIGAV (`sigav."TB_MIGRACAO"`, mantida por
  `scripts/aplicar-migrations.mjs`). Duas coisas mudam aqui:

    - o nome segue a convenção desta casa, que é `snake_case` — as tabelas daqui
      são `solicitacoes_acesso`, `perfis_usuarios`, `configuracoes`;
    - a chave é o CAMINHO do ficheiro, e não o timestamp. Três migrations deste
      repositório não têm timestamp (`add_update_user_access_rpc.sql` e outras
      duas), e as correções de dados vivem noutro diretório. O caminho é único,
      ordena bem e diz de onde veio.

  O QUE O HASH RESOLVE

  Sem ele, o registro diz "esta migration correu" e nada mais. Com ele, diz
  também se o ficheiro MUDOU depois de ter corrido — que é o defeito silencioso:
  alguém corrige um erro de digitação numa migration já aplicada, o Git fica
  coerente, o banco não, e ninguém descobre até o próximo ambiente ser criado
  do zero e sair diferente.

  QUEM PODE LER

  Ninguém pelo navegador. A tabela tem RLS ligada e nenhuma policy: nem `anon`
  nem `authenticated` alcançam uma linha. Quem a consulta é
  `scripts/estado-das-migrations.mjs`, com `SUPABASE_DB_URL` — a mesma
  credencial de servidor que `check:rpc-contract:db` já usa, e pelo mesmo
  motivo: é ferramenta de operação, não superfície da aplicação.

  DEPENDENTES
    - scripts/estado-das-migrations.mjs

  ROLLBACK
    begin;
    drop table if exists public.migracoes_aplicadas;
    commit;
*/
begin;

create table if not exists public.migracoes_aplicadas (
  caminho text not null,
  hash text not null,
  origem text not null default 'arquivo',
  aplicada_em timestamptz not null default now(),
  constraint pk_migracoes_aplicadas primary key (caminho),
  /*
    `registro-historico` é para o que já estava no banco antes desta tabela
    existir: marca-se como aplicado sem executar nada. Distinguir os dois
    importa — uma linha `arquivo` afirma que o script correu e viu o resultado;
    uma `registro-historico` afirma apenas que alguém garantiu que já estava lá.
  */
  constraint ck_migracoes_aplicadas_origem
    check (origem in ('arquivo', 'registro-historico'))
);

alter table public.migracoes_aplicadas enable row level security;
revoke all on table public.migracoes_aplicadas from public;
revoke all on table public.migracoes_aplicadas from anon;
revoke all on table public.migracoes_aplicadas from authenticated;

comment on table public.migracoes_aplicadas is
  'Histórico do que já foi aplicado no banco, mantido por scripts/estado-das-migrations.mjs. Sem policy de RLS: só alcançável com credencial de servidor.';
comment on column public.migracoes_aplicadas.caminho is
  'Caminho do ficheiro a partir de supabase/, por exemplo migrations/20260921130000_x.sql.';
comment on column public.migracoes_aplicadas.hash is
  'sha256 do conteúdo do ficheiro no momento da aplicação. Divergência significa que o ficheiro mudou depois de aplicado.';
comment on column public.migracoes_aplicadas.origem is
  'arquivo: o script viu correr. registro-historico: marcado como já aplicado, sem executar.';

commit;
