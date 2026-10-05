/*
  ROBÔ DA EMPREGARE: CANDIDATOS DE CADA VAGA NO MONITORA

  A Empregare não tem API. O robô (scripts/robo-empregare/, Selenium no GitHub
  Actions, .github/workflows/robo-empregare.yml) entra no portal da empresa,
  pede para cada vaga a exportação "Candidatos da vaga (Excel)" com o
  questionário, baixa da Central de Exportações, lê o Excel e grava aqui.
  Guia de operação: docs/robo-empregare.md.

  QUAIS VAGAS (listar_vagas_empregare)
    O código da vaga da Empregare é o CO_VAGA de TB_SELECAO_VAGA (aba
    Resultado da Auditoria; ex.: 177979). Sem filtro, entram as vagas ativas
    com código cujo edital ligado está ativo (TB_MONITORAMENTO_INDIGENA.ativo)
    e ainda em curso: sem cronograma, ou com alguma etapa terminando há no
    máximo 30 dias. Com p_editais (números "80/2026"), as vagas desses
    editais; com p_vagas, só esses códigos (mesmo fora da Seleção). Ordem:
    as nunca carregadas e as carregadas há mais tempo primeiro; até p_limite.

  O QUE FICA GUARDADO
    TL_SYNC_EMPREGARE        cada execução: início, fim, situação, quem
                             disparou (agenda, MONITORA ou GitHub), vagas
                             pedidas/baixadas/com falha/recusadas, linhas,
                             desativadas, erro e o endereço da execução.
    TB_EMPREGARE_VAGA        a última carga de cada vaga: situação, colunas do
                             arquivo (na ordem), candidatos ativos.
    TB_EMPREGARE_CANDIDATO   um candidato por vaga. Chave natural: código do
                             candidato da Empregare (cod:…); sem ele, hash
                             SHA-256 do CPF (cpf:…) ou do e-mail (email:…) —
                             nunca o CPF em claro na chave. Colunas conhecidas
                             (nome, e-mail, CPF, telefone, nascimento, etapa,
                             data da candidatura) e TODAS as colunas do Excel
                             em DS_COLUNA_ORIGINAL (respostas do questionário),
                             com o hash da linha para saber quando mudou.

  TRAVA (como na Seleção)
    Uma vaga cujo arquivo traz menos da metade dos candidatos ativos que ela
    já tinha é RECUSADA, só ela: nada é gravado nem desativado naquela vaga.
    Forçar (modo forcar do workflow) aceita. Sem hard delete: quem sai do
    arquivo fica inativo (ST_REGISTRO_ATIVO = N, DT_DESATIVACAO).

  FUNÇÕES
    Carga, só service_role (o robô):
      listar_vagas_empregare, iniciar_sync_empregare, gravar_lote_empregare,
      fechar_vaga_empregare, finalizar_sync_empregare
    Leitura:
      obter_candidatos_empregare(p_vaga)  selecao >= editor, área e recorte
                                          do edital (vaga sem edital: só o
                                          administrador global)
      get_saude_das_cargas()              ganha 'empregare' (últimas 10)
      pode_disparar_carga()               true para o administrador global
                                          (api/rodar-carga.js confere com o
                                          Bearer de quem clicou)

  Ensaio: supabase/ensaios/20261005170000_robo_empregare.sql
  Rollback: supabase/rollback/20261005170000_robo_empregare.sql
*/
begin;

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TB_SELECAO_VAGA"') is null then
    raise exception 'Aplique antes 20261001090000_selecao.sql.';
  end if;
  if to_regprocedure('public.get_saude_das_cargas()') is null then
    raise exception 'Aplique antes 20261001120000_saude_das_cargas.sql.';
  end if;
end;
$$;

-- 1. Log das execuções ------------------------------------------------------------------
create table public."TL_SYNC_EMPREGARE" (
  "CO_SYNC" text not null,
  "DT_INICIO" timestamptz not null default now(),
  "DT_FIM" timestamptz,
  "TP_SITUACAO" text not null default 'EM_ANDAMENTO',
  "TP_DISPARO" text not null,
  "CO_USUARIO_DISPARO" uuid,
  "ST_FORCADA" varchar(1) not null default 'N',
  "DS_FILTRO" jsonb not null default '{}'::jsonb,
  "QT_VAGA_PEDIDA" integer not null default 0,
  "QT_VAGA_BAIXADA" integer not null default 0,
  "QT_VAGA_FALHA" integer not null default 0,
  "QT_VAGA_RECUSADA" integer not null default 0,
  "QT_LINHA" integer not null default 0,
  "QT_DESATIVADA" integer not null default 0,
  "DS_MENSAGEM" text,
  "DS_URL_EXECUCAO" text,
  constraint "PK_TL_SYNC_EMPREGARE" primary key ("CO_SYNC"),
  constraint "CK_SYNCEMPREG_COSYNC" check ("CO_SYNC" ~ '^[A-Za-z0-9_-]{8,80}$'),
  constraint "CK_SYNCEMPREG_TPSITUACAO" check ("TP_SITUACAO" in ('EM_ANDAMENTO', 'CONCLUIDA', 'PARCIAL', 'FALHOU')),
  constraint "CK_SYNCEMPREG_TPDISPARO" check ("TP_DISPARO" in ('AGENDA', 'MONITORA', 'GITHUB')),
  constraint "CK_SYNCEMPREG_USUARIO" check (("TP_DISPARO" = 'MONITORA') = ("CO_USUARIO_DISPARO" is not null)),
  constraint "CK_SYNCEMPREG_STFORCADA" check ("ST_FORCADA" in ('S', 'N')),
  constraint "CK_SYNCEMPREG_FILTRO" check (jsonb_typeof("DS_FILTRO") = 'object'),
  constraint "CK_SYNCEMPREG_QT" check (
    "QT_VAGA_PEDIDA" >= 0 and "QT_VAGA_BAIXADA" >= 0 and "QT_VAGA_FALHA" >= 0
    and "QT_VAGA_RECUSADA" >= 0 and "QT_LINHA" >= 0 and "QT_DESATIVADA" >= 0
  ),
  constraint "CK_SYNCEMPREG_TAMANHOS" check (
    coalesce(length("DS_MENSAGEM"), 0) <= 2000
    and ("DS_URL_EXECUCAO" is null or ("DS_URL_EXECUCAO" ~ '^https://github\.com/' and length("DS_URL_EXECUCAO") <= 300))
  )
);
comment on table public."TL_SYNC_EMPREGARE" is 'Log das execuções do robô da Empregare (scripts/robo-empregare/): uma linha por execução.';
comment on column public."TL_SYNC_EMPREGARE"."CO_SYNC" is 'Identificador da execução (gerado pelo robô: gh-<data>-<sufixo>).';
comment on column public."TL_SYNC_EMPREGARE"."DT_INICIO" is 'Início da execução.';
comment on column public."TL_SYNC_EMPREGARE"."DT_FIM" is 'Fechamento (finalizar_sync_empregare). Nulo enquanto roda.';
comment on column public."TL_SYNC_EMPREGARE"."TP_SITUACAO" is 'EM_ANDAMENTO; CONCLUIDA (todas as vagas gravadas); PARCIAL (alguma vaga falhou ou foi recusada pela trava); FALHOU (erro geral ou nenhuma vaga baixada).';
comment on column public."TL_SYNC_EMPREGARE"."TP_DISPARO" is 'Quem disparou: AGENDA (horário do workflow), MONITORA (botão Rodar agora) ou GITHUB (Run workflow na aba Actions).';
comment on column public."TL_SYNC_EMPREGARE"."CO_USUARIO_DISPARO" is 'Usuário do MONITORA (auth.users.id) que clicou em Rodar agora; nulo nos outros disparos.';
comment on column public."TL_SYNC_EMPREGARE"."ST_FORCADA" is 'S: rodou com forçar (a trava de metade dos candidatos não vale).';
comment on column public."TL_SYNC_EMPREGARE"."DS_FILTRO" is 'Filtro pedido: {"editais": [...], "vagas": [...], "limite": n}; vazio = vagas dos editais em curso.';
comment on column public."TL_SYNC_EMPREGARE"."QT_VAGA_PEDIDA" is 'Vagas que o robô tentou exportar.';
comment on column public."TL_SYNC_EMPREGARE"."QT_VAGA_BAIXADA" is 'Vagas cujo Excel foi baixado.';
comment on column public."TL_SYNC_EMPREGARE"."QT_VAGA_FALHA" is 'Vagas que falharam (exportar, baixar ou ler o Excel).';
comment on column public."TL_SYNC_EMPREGARE"."QT_VAGA_RECUSADA" is 'Vagas recusadas pela trava (arquivo com menos da metade dos candidatos ativos).';
comment on column public."TL_SYNC_EMPREGARE"."QT_LINHA" is 'Candidatos gravados (sem repetidos) em todas as vagas.';
comment on column public."TL_SYNC_EMPREGARE"."QT_DESATIVADA" is 'Candidatos que saíram do arquivo da vaga e ficaram inativos.';
comment on column public."TL_SYNC_EMPREGARE"."DS_MENSAGEM" is 'Erro geral ou observação (sem dado pessoal).';
comment on column public."TL_SYNC_EMPREGARE"."DS_URL_EXECUCAO" is 'Endereço da execução no GitHub Actions.';
comment on constraint "CK_SYNCEMPREG_COSYNC" on public."TL_SYNC_EMPREGARE" is 'Identificador de 8 a 80 caracteres seguros.';
comment on constraint "CK_SYNCEMPREG_TPSITUACAO" on public."TL_SYNC_EMPREGARE" is 'Situações válidas.';
comment on constraint "CK_SYNCEMPREG_TPDISPARO" on public."TL_SYNC_EMPREGARE" is 'Disparos válidos.';
comment on constraint "CK_SYNCEMPREG_USUARIO" on public."TL_SYNC_EMPREGARE" is 'Usuário só (e sempre) no disparo pelo MONITORA.';
comment on constraint "CK_SYNCEMPREG_STFORCADA" on public."TL_SYNC_EMPREGARE" is 'Flag S/N.';
comment on constraint "CK_SYNCEMPREG_FILTRO" on public."TL_SYNC_EMPREGARE" is 'Filtro é um objeto json.';
comment on constraint "CK_SYNCEMPREG_QT" on public."TL_SYNC_EMPREGARE" is 'Contagens não negativas.';
comment on constraint "CK_SYNCEMPREG_TAMANHOS" on public."TL_SYNC_EMPREGARE" is 'Mensagem até 2000 caracteres; endereço só do GitHub, até 300.';

create index "IN_SYNCEMPREG_INICIO" on public."TL_SYNC_EMPREGARE" ("DT_INICIO" desc);
comment on index public."IN_SYNCEMPREG_INICIO" is 'Últimas execuções (Status das atualizações).';

-- 2. Última carga de cada vaga ----------------------------------------------------------
create table public."TB_EMPREGARE_VAGA" (
  "CO_VAGA" text not null,
  "CO_MONITORAMENTO" uuid,
  "TP_SITUACAO" text not null default 'EM_CARGA',
  "DS_COLUNA" jsonb not null default '[]'::jsonb,
  "NO_ARQUIVO" varchar(300),
  "QT_CANDIDATO_ATIVO" integer not null default 0,
  "QT_LINHA_ARQUIVO" integer,
  "QT_RECEBIDA" integer not null default 0,
  "DS_MENSAGEM" text,
  "CO_SYNC" text,
  "DT_ULTIMA_CARGA" timestamptz,
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_EMPREGARE_VAGA" primary key ("CO_VAGA"),
  constraint "FK_MONITORAMENTO_EMPREGVAGA" foreign key ("CO_MONITORAMENTO") references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "FK_SYNCEMPREG_EMPREGVAGA" foreign key ("CO_SYNC") references public."TL_SYNC_EMPREGARE" ("CO_SYNC"),
  constraint "CK_EMPREGVAGA_COVAGA" check ("CO_VAGA" ~ '^[0-9]{1,20}$'),
  constraint "CK_EMPREGVAGA_TPSITUACAO" check ("TP_SITUACAO" in ('EM_CARGA', 'GRAVADA', 'RECUSADA', 'INCOMPLETA')),
  constraint "CK_EMPREGVAGA_DSCOLUNA" check (jsonb_typeof("DS_COLUNA") = 'array'),
  constraint "CK_EMPREGVAGA_QT" check ("QT_CANDIDATO_ATIVO" >= 0 and "QT_RECEBIDA" >= 0 and coalesce("QT_LINHA_ARQUIVO", 0) >= 0),
  constraint "CK_EMPREGVAGA_MENSAGEM" check (coalesce(length("DS_MENSAGEM"), 0) <= 1000)
);
comment on table public."TB_EMPREGARE_VAGA" is 'Última carga de cada vaga da Empregare pelo robô: situação, colunas do Excel e candidatos ativos.';
comment on column public."TB_EMPREGARE_VAGA"."CO_VAGA" is 'Código da vaga na Empregare (o CO_VAGA de TB_SELECAO_VAGA; ex.: 177979).';
comment on column public."TB_EMPREGARE_VAGA"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id), pela vaga ativa de TB_SELECAO_VAGA; nulo sem ligação.';
comment on column public."TB_EMPREGARE_VAGA"."TP_SITUACAO" is 'EM_CARGA (recebendo lotes); GRAVADA; RECUSADA (trava da metade); INCOMPLETA (a execução terminou no meio da vaga: nada foi desativado).';
comment on column public."TB_EMPREGARE_VAGA"."DS_COLUNA" is 'Nomes das colunas do último Excel gravado, na ordem do arquivo (o jsonb das linhas não guarda ordem).';
comment on column public."TB_EMPREGARE_VAGA"."NO_ARQUIVO" is 'Nome do último Excel gravado.';
comment on column public."TB_EMPREGARE_VAGA"."QT_CANDIDATO_ATIVO" is 'Candidatos ativos da vaga depois da última carga gravada.';
comment on column public."TB_EMPREGARE_VAGA"."QT_LINHA_ARQUIVO" is 'Candidatos com chave no último arquivo recebido (gravado ou recusado).';
comment on column public."TB_EMPREGARE_VAGA"."QT_RECEBIDA" is 'Candidatos recebidos na carga em curso (soma dos lotes).';
comment on column public."TB_EMPREGARE_VAGA"."DS_MENSAGEM" is 'Motivo da recusa ou da carga incompleta.';
comment on column public."TB_EMPREGARE_VAGA"."CO_SYNC" is 'Última execução (TL_SYNC_EMPREGARE) que mexeu na vaga.';
comment on column public."TB_EMPREGARE_VAGA"."DT_ULTIMA_CARGA" is 'Quando a vaga foi gravada pela última vez (situação GRAVADA).';
comment on column public."TB_EMPREGARE_VAGA"."DT_CRIACAO" is 'Primeira carga da vaga.';
comment on column public."TB_EMPREGARE_VAGA"."DT_ATUALIZACAO" is 'Última mudança na linha.';
comment on constraint "FK_MONITORAMENTO_EMPREGVAGA" on public."TB_EMPREGARE_VAGA" is 'Edital da vaga.';
comment on constraint "FK_SYNCEMPREG_EMPREGVAGA" on public."TB_EMPREGARE_VAGA" is 'Execução que mexeu na vaga.';
comment on constraint "CK_EMPREGVAGA_COVAGA" on public."TB_EMPREGARE_VAGA" is 'Código da vaga só com dígitos.';
comment on constraint "CK_EMPREGVAGA_TPSITUACAO" on public."TB_EMPREGARE_VAGA" is 'Situações válidas.';
comment on constraint "CK_EMPREGVAGA_DSCOLUNA" on public."TB_EMPREGARE_VAGA" is 'Colunas em lista json.';
comment on constraint "CK_EMPREGVAGA_QT" on public."TB_EMPREGARE_VAGA" is 'Contagens não negativas.';
comment on constraint "CK_EMPREGVAGA_MENSAGEM" on public."TB_EMPREGARE_VAGA" is 'Mensagem até 1000 caracteres.';

create index "IN_FKEMPREGVAGA_COMONITOR" on public."TB_EMPREGARE_VAGA" ("CO_MONITORAMENTO");
create index "IN_FKEMPREGVAGA_COSYNC" on public."TB_EMPREGARE_VAGA" ("CO_SYNC");
comment on index public."IN_FKEMPREGVAGA_COMONITOR" is 'Chave estrangeira para TB_MONITORAMENTO_INDIGENA.';
comment on index public."IN_FKEMPREGVAGA_COSYNC" is 'Chave estrangeira para TL_SYNC_EMPREGARE.';

-- 3. Candidatos -------------------------------------------------------------------------
create table public."TB_EMPREGARE_CANDIDATO" (
  "CO_EMPREGARE_CANDIDATO" uuid not null default gen_random_uuid(),
  "CO_VAGA" text not null,
  "DS_CHAVE_CANDIDATO" varchar(80) not null,
  "TP_CHAVE" varchar(10) not null,
  "CO_CANDIDATO_EMPREGARE" varchar(60),
  "NO_CANDIDATO" varchar(300),
  "DS_EMAIL" varchar(320),
  "NU_CPF" varchar(11),
  "NU_TELEFONE" varchar(60),
  "DT_NASCIMENTO" date,
  "DS_SITUACAO_EMPREGARE" varchar(200),
  "DT_CANDIDATURA" timestamptz,
  "DS_COLUNA_ORIGINAL" jsonb not null,
  "DS_HASH_LINHA" varchar(64) not null,
  "CO_SYNC" text,
  "ST_REGISTRO_ATIVO" varchar(1) not null default 'S',
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  "DT_CONFERENCIA" timestamptz not null default now(),
  "DT_DESATIVACAO" timestamptz,
  constraint "PK_TB_EMPREGARE_CANDIDATO" primary key ("CO_EMPREGARE_CANDIDATO"),
  constraint "UK_EMPREGCAND_VAGACHAVE" unique ("CO_VAGA", "DS_CHAVE_CANDIDATO"),
  constraint "FK_EMPREGVAGA_EMPREGCAND" foreign key ("CO_VAGA") references public."TB_EMPREGARE_VAGA" ("CO_VAGA"),
  constraint "FK_SYNCEMPREG_EMPREGCAND" foreign key ("CO_SYNC") references public."TL_SYNC_EMPREGARE" ("CO_SYNC"),
  constraint "CK_EMPREGCAND_CHAVE" check ("DS_CHAVE_CANDIDATO" ~ '^(cod:[A-Za-z0-9._-]{1,60}|cpf:[0-9a-f]{64}|email:[0-9a-f]{64})$'),
  constraint "CK_EMPREGCAND_TPCHAVE" check (
    "TP_CHAVE" in ('CODIGO', 'CPF', 'EMAIL')
    and split_part("DS_CHAVE_CANDIDATO", ':', 1) = case "TP_CHAVE" when 'CODIGO' then 'cod' when 'CPF' then 'cpf' else 'email' end
  ),
  constraint "CK_EMPREGCAND_NUCPF" check ("NU_CPF" is null or "NU_CPF" ~ '^[0-9]{11}$'),
  constraint "CK_EMPREGCAND_ORIGINAL" check (jsonb_typeof("DS_COLUNA_ORIGINAL") = 'object'),
  constraint "CK_EMPREGCAND_HASH" check ("DS_HASH_LINHA" ~ '^[0-9a-f]{64}$'),
  constraint "CK_EMPREGCAND_STATIVO" check ("ST_REGISTRO_ATIVO" in ('S', 'N')),
  constraint "CK_EMPREGCAND_DESATIVACAO" check (("ST_REGISTRO_ATIVO" = 'N') = ("DT_DESATIVACAO" is not null))
);
comment on table public."TB_EMPREGARE_CANDIDATO" is 'Candidato de uma vaga da Empregare, do Excel "Candidatos da vaga" baixado pelo robô: colunas conhecidas e todas as colunas originais (questionário). Quem sai do arquivo fica inativo.';
comment on column public."TB_EMPREGARE_CANDIDATO"."CO_EMPREGARE_CANDIDATO" is 'Identificador da linha.';
comment on column public."TB_EMPREGARE_CANDIDATO"."CO_VAGA" is 'Vaga da Empregare (TB_EMPREGARE_VAGA).';
comment on column public."TB_EMPREGARE_CANDIDATO"."DS_CHAVE_CANDIDATO" is 'Chave natural na vaga: cod:<código do candidato na Empregare>; sem ele, cpf:<SHA-256 do CPF> ou email:<SHA-256 do e-mail>. Nunca o CPF em claro.';
comment on column public."TB_EMPREGARE_CANDIDATO"."TP_CHAVE" is 'De onde veio a chave: CODIGO, CPF ou EMAIL.';
comment on column public."TB_EMPREGARE_CANDIDATO"."CO_CANDIDATO_EMPREGARE" is 'Código do candidato ou da candidatura na Empregare, quando o Excel traz.';
comment on column public."TB_EMPREGARE_CANDIDATO"."NO_CANDIDATO" is 'Nome do candidato.';
comment on column public."TB_EMPREGARE_CANDIDATO"."DS_EMAIL" is 'E-mail do candidato (minúsculas).';
comment on column public."TB_EMPREGARE_CANDIDATO"."NU_CPF" is 'CPF só com dígitos (11).';
comment on column public."TB_EMPREGARE_CANDIDATO"."NU_TELEFONE" is 'Telefone ou celular como veio.';
comment on column public."TB_EMPREGARE_CANDIDATO"."DT_NASCIMENTO" is 'Data de nascimento.';
comment on column public."TB_EMPREGARE_CANDIDATO"."DS_SITUACAO_EMPREGARE" is 'Etapa ou status do candidato na Empregare, como veio.';
comment on column public."TB_EMPREGARE_CANDIDATO"."DT_CANDIDATURA" is 'Data da candidatura (hora de Brasília quando o Excel não traz fuso).';
comment on column public."TB_EMPREGARE_CANDIDATO"."DS_COLUNA_ORIGINAL" is 'Todas as colunas do Excel da linha, {"nome da coluna": "valor"}, inclusive as respostas do questionário. A ordem das colunas fica em TB_EMPREGARE_VAGA.DS_COLUNA.';
comment on column public."TB_EMPREGARE_CANDIDATO"."DS_HASH_LINHA" is 'SHA-256 de DS_COLUNA_ORIGINAL: muda quando alguma coluna muda.';
comment on column public."TB_EMPREGARE_CANDIDATO"."CO_SYNC" is 'Última execução (TL_SYNC_EMPREGARE) que trouxe a linha.';
comment on column public."TB_EMPREGARE_CANDIDATO"."ST_REGISTRO_ATIVO" is 'S: está no último arquivo gravado da vaga; N: saiu (fica para o histórico).';
comment on column public."TB_EMPREGARE_CANDIDATO"."DT_CRIACAO" is 'Primeira carga da linha.';
comment on column public."TB_EMPREGARE_CANDIDATO"."DT_ATUALIZACAO" is 'Última carga em que alguma coluna mudou (ou a linha voltou ou saiu).';
comment on column public."TB_EMPREGARE_CANDIDATO"."DT_CONFERENCIA" is 'Última carga que trouxe a linha, mudando ou não.';
comment on column public."TB_EMPREGARE_CANDIDATO"."DT_DESATIVACAO" is 'Quando saiu do arquivo da vaga; nulo enquanto ativa.';
comment on constraint "UK_EMPREGCAND_VAGACHAVE" on public."TB_EMPREGARE_CANDIDATO" is 'Um candidato por chave natural em cada vaga.';
comment on constraint "FK_EMPREGVAGA_EMPREGCAND" on public."TB_EMPREGARE_CANDIDATO" is 'Vaga do candidato.';
comment on constraint "FK_SYNCEMPREG_EMPREGCAND" on public."TB_EMPREGARE_CANDIDATO" is 'Execução que trouxe a linha.';
comment on constraint "CK_EMPREGCAND_CHAVE" on public."TB_EMPREGARE_CANDIDATO" is 'Chave: código seguro ou hash SHA-256 (64 hexadecimais) de CPF ou e-mail.';
comment on constraint "CK_EMPREGCAND_TPCHAVE" on public."TB_EMPREGARE_CANDIDATO" is 'Tipo da chave confere com o prefixo.';
comment on constraint "CK_EMPREGCAND_NUCPF" on public."TB_EMPREGARE_CANDIDATO" is 'CPF com 11 dígitos.';
comment on constraint "CK_EMPREGCAND_ORIGINAL" on public."TB_EMPREGARE_CANDIDATO" is 'Colunas originais em objeto json.';
comment on constraint "CK_EMPREGCAND_HASH" on public."TB_EMPREGARE_CANDIDATO" is 'Hash SHA-256 em hexadecimal.';
comment on constraint "CK_EMPREGCAND_STATIVO" on public."TB_EMPREGARE_CANDIDATO" is 'Flag S/N.';
comment on constraint "CK_EMPREGCAND_DESATIVACAO" on public."TB_EMPREGARE_CANDIDATO" is 'Data de desativação só (e sempre) na linha inativa.';

create index "IN_EMPREGCAND_VAGAATIVA" on public."TB_EMPREGARE_CANDIDATO" ("CO_VAGA") where "ST_REGISTRO_ATIVO" = 'S';
create index "IN_EMPREGCAND_NUCPF" on public."TB_EMPREGARE_CANDIDATO" ("NU_CPF") where "NU_CPF" is not null;
create index "IN_FKEMPREGCAND_COSYNC" on public."TB_EMPREGARE_CANDIDATO" ("CO_SYNC");
comment on index public."IN_EMPREGCAND_VAGAATIVA" is 'Candidatos ativos por vaga (trava, desativação e leitura).';
comment on index public."IN_EMPREGCAND_NUCPF" is 'Cruzamento por CPF com análises e aprovados.';
comment on index public."IN_FKEMPREGCAND_COSYNC" is 'Chave estrangeira para TL_SYNC_EMPREGARE.';

-- 4. Acesso: só as funções abaixo -------------------------------------------------------
alter table public."TL_SYNC_EMPREGARE" enable row level security;
alter table public."TB_EMPREGARE_VAGA" enable row level security;
alter table public."TB_EMPREGARE_CANDIDATO" enable row level security;
revoke all on public."TL_SYNC_EMPREGARE", public."TB_EMPREGARE_VAGA", public."TB_EMPREGARE_CANDIDATO"
  from public, anon, authenticated;

-- 5. Funções de apoio (privadas) --------------------------------------------------------
create function private."FC_EMPREGARE_DATA"(p_texto text)
returns date
language plpgsql
immutable
set search_path to ''
as $function$
begin
  if p_texto is null or p_texto !~ '^\d{4}-\d{2}-\d{2}' then
    return null;
  end if;
  return left(p_texto, 10)::date;
exception when others then
  return null;
end;
$function$;
comment on function private."FC_EMPREGARE_DATA"(text) is 'Data ISO (AAAA-MM-DD…) do Excel da Empregare; data impossível ou outro formato vira nulo.';

create function private."FC_EMPREGARE_MOMENTO"(p_texto text)
returns timestamptz
language plpgsql
stable
set search_path to ''
as $function$
begin
  if p_texto is null or p_texto !~ '^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$' then
    return null;
  end if;
  return (replace(p_texto, 'T', ' ')::timestamp) at time zone 'America/Sao_Paulo';
exception when others then
  return null;
end;
$function$;
comment on function private."FC_EMPREGARE_MOMENTO"(text) is 'Data e hora ISO sem fuso do Excel da Empregare, lida na hora de Brasília; outro formato vira nulo.';

/*
  Abre a vaga na execução (primeiro lote, ou o fechamento de um arquivo sem
  candidatos): cria a linha da vaga, liga o edital e aplica a trava. Devolve
  'EM_CARGA' (pode gravar) ou 'RECUSADA'.
*/
create function private."FC_EMPREGARE_ABRIR_VAGA"(p_sync text, p_vaga text, p_total integer)
returns text
language plpgsql
set search_path to ''
as $function$
declare
  v_vaga public."TB_EMPREGARE_VAGA";
  v_forcada boolean;
  v_ativos integer;
  v_edital uuid;
begin
  select (s."ST_FORCADA" = 'S') into v_forcada from public."TL_SYNC_EMPREGARE" s where s."CO_SYNC" = p_sync;
  select s."CO_MONITORAMENTO" into v_edital
    from public."TB_SELECAO_VAGA" s
   where s."CO_VAGA" = p_vaga and s."ST_REGISTRO_ATIVO" = 'S'
   order by (s."CO_MONITORAMENTO" is null), s."DT_ATUALIZACAO" desc
   limit 1;

  insert into public."TB_EMPREGARE_VAGA" ("CO_VAGA", "CO_MONITORAMENTO")
  values (p_vaga, v_edital)
  on conflict ("CO_VAGA") do nothing;
  select * into v_vaga from public."TB_EMPREGARE_VAGA" v where v."CO_VAGA" = p_vaga for update;

  if v_vaga."CO_SYNC" is not distinct from p_sync then
    return v_vaga."TP_SITUACAO";
  end if;

  select count(*) into v_ativos
    from public."TB_EMPREGARE_CANDIDATO" c
   where c."CO_VAGA" = p_vaga and c."ST_REGISTRO_ATIVO" = 'S';

  if not v_forcada and v_ativos > 0 and p_total * 2 < v_ativos then
    update public."TB_EMPREGARE_VAGA" set
      "TP_SITUACAO" = 'RECUSADA', "CO_SYNC" = p_sync, "QT_LINHA_ARQUIVO" = p_total, "QT_RECEBIDA" = 0,
      "CO_MONITORAMENTO" = coalesce(v_edital, "CO_MONITORAMENTO"),
      "DS_MENSAGEM" = format('Arquivo com %s candidatos e a vaga tem %s ativos: menos da metade. Nada foi gravado nem desativado.', p_total, v_ativos),
      "DT_ATUALIZACAO" = now()
     where "CO_VAGA" = p_vaga;
    update public."TL_SYNC_EMPREGARE" set "QT_VAGA_RECUSADA" = "QT_VAGA_RECUSADA" + 1 where "CO_SYNC" = p_sync;
    return 'RECUSADA';
  end if;

  update public."TB_EMPREGARE_VAGA" set
    "TP_SITUACAO" = 'EM_CARGA', "CO_SYNC" = p_sync, "QT_LINHA_ARQUIVO" = p_total, "QT_RECEBIDA" = 0,
    "CO_MONITORAMENTO" = coalesce(v_edital, "CO_MONITORAMENTO"), "DS_MENSAGEM" = null, "DT_ATUALIZACAO" = now()
   where "CO_VAGA" = p_vaga;
  return 'EM_CARGA';
end;
$function$;
comment on function private."FC_EMPREGARE_ABRIR_VAGA"(text, text, integer) is 'Abre a vaga numa execução do robô da Empregare: cria a linha, liga o edital (TB_SELECAO_VAGA) e aplica a trava (arquivo com menos da metade dos ativos, sem forçar, é RECUSADA). Chamada pelas RPCs de carga.';

create function private."FC_EMPREGARE_EXIGIR_SYNC"(p_sync text)
returns void
language plpgsql
stable
set search_path to ''
as $function$
begin
  if p_sync is null or p_sync !~ '^[A-Za-z0-9_-]{8,80}$' then
    raise exception 'Identificador de execução inválido' using errcode = '22023';
  end if;
  if not exists (select 1 from public."TL_SYNC_EMPREGARE" s
                  where s."CO_SYNC" = p_sync and s."TP_SITUACAO" = 'EM_ANDAMENTO') then
    raise exception 'Execução % não encontrada ou já fechada', p_sync using errcode = '22023';
  end if;
end;
$function$;
comment on function private."FC_EMPREGARE_EXIGIR_SYNC"(text) is 'Recusa (22023) identificador inválido ou execução do robô da Empregare que não está em andamento.';

revoke all on function private."FC_EMPREGARE_DATA"(text) from public, anon, authenticated;
revoke all on function private."FC_EMPREGARE_MOMENTO"(text) from public, anon, authenticated;
revoke all on function private."FC_EMPREGARE_ABRIR_VAGA"(text, text, integer) from public, anon, authenticated;
revoke all on function private."FC_EMPREGARE_EXIGIR_SYNC"(text) from public, anon, authenticated;

-- 6. Carga (service_role) ---------------------------------------------------------------
create function public.listar_vagas_empregare(p_editais text[] default null, p_vagas text[] default null, p_limite integer default 60)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 60), 1), 500);
  v_vagas text[] := coalesce(p_vagas, '{}');
  v_editais text[];
  v_modo text;
begin
  if exists (select 1 from unnest(v_vagas) v where v !~ '^[0-9]{1,20}$') then
    raise exception 'Código de vaga inválido: use só dígitos' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct private."FC_NUMERO_EDITAL"(e)), '{}') into v_editais
    from unnest(coalesce(p_editais, '{}')) e;
  if exists (select 1 from unnest(v_editais) e where e is null) then
    raise exception 'Edital inválido: use o número, como 80/2026' using errcode = '22023';
  end if;
  v_modo := case when cardinality(v_vagas) > 0 then 'VAGAS'
                 when cardinality(v_editais) > 0 then 'EDITAIS'
                 else 'PADRAO' end;

  return (
    with selecao as (
      select distinct on (s."CO_VAGA")
             s."CO_VAGA" as vaga, s."CO_MONITORAMENTO" as edital_id, s."DS_EDITAL" as edital,
             s."NO_UNIDADE" as unidade, s."NO_CARGO" as cargo, s."CO_AREA" as area,
             m.ativo as edital_ativo,
             (select max(coalesce(c.data_fim, c.data_inicio)::date)
                from public."TB_CRONOGRAMA_MONIT_INDIG" c
               where c.monitoramento_id = m.id) as fim_do_cronograma
        from public."TB_SELECAO_VAGA" s
        left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = s."CO_MONITORAMENTO"
       where s."ST_REGISTRO_ATIVO" = 'S' and s."CO_VAGA" is not null
       order by s."CO_VAGA", (s."CO_MONITORAMENTO" is null), s."DT_ATUALIZACAO" desc
    ),
    escolhidas as (
      select s.vaga, s.edital_id, s.edital, s.unidade, s.cargo, s.area
        from selecao s
       where (v_modo = 'VAGAS' and s.vaga = any (v_vagas))
          or (v_modo = 'EDITAIS' and private."FC_NUMERO_EDITAL"(s.edital) = any (v_editais))
          or (v_modo = 'PADRAO' and s.edital_ativo is true
              and (s.fim_do_cronograma is null or s.fim_do_cronograma >= current_date - 30))
      union all
      -- Código pedido que não está na Seleção: vai mesmo assim, sem edital.
      select v, null::uuid, null, null, null, null
        from unnest(v_vagas) v
       where v_modo = 'VAGAS' and not exists (select 1 from selecao s where s.vaga = v)
    ),
    ordenadas as (
      select e.*, ev."DT_ULTIMA_CARGA" as ultima_carga
        from escolhidas e
        left join public."TB_EMPREGARE_VAGA" ev on ev."CO_VAGA" = e.vaga
       order by ev."DT_ULTIMA_CARGA" nulls first, e.edital nulls last, e.vaga
       limit v_limite
    )
    select jsonb_build_object(
      'modo', v_modo,
      'limite', v_limite,
      'vagas', coalesce(jsonb_agg(jsonb_build_object(
          'vaga', o.vaga, 'edital_id', o.edital_id, 'edital', o.edital, 'unidade', o.unidade,
          'cargo', o.cargo, 'area', o.area, 'ultima_carga', o.ultima_carga
        ) order by o.ultima_carga nulls first, o.edital nulls last, o.vaga), '[]'::jsonb)
    )
      from ordenadas o
  );
end;
$function$;
comment on function public.listar_vagas_empregare(text[], text[], integer) is
  'Vagas que o robô da Empregare deve exportar: sem filtro, as vagas ativas com código de TB_SELECAO_VAGA cujo edital está ativo e em curso (sem cronograma ou com etapa terminando há no máximo 30 dias); p_editais (números como 80/2026) ou p_vagas (códigos) restringem. Nunca carregadas e mais antigas primeiro, até p_limite (1 a 500). Só service_role.';

create function public.iniciar_sync_empregare(
  p_sync text, p_disparo text, p_usuario uuid default null, p_filtro jsonb default '{}'::jsonb,
  p_vagas_pedidas integer default 0, p_url text default null, p_forcar boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_interrompidas integer;
begin
  if p_sync is null or p_sync !~ '^[A-Za-z0-9_-]{8,80}$' then
    raise exception 'Identificador de execução inválido' using errcode = '22023';
  end if;
  if p_disparo is null or p_disparo not in ('AGENDA', 'MONITORA', 'GITHUB') then
    raise exception 'Disparo inválido: AGENDA, MONITORA ou GITHUB' using errcode = '22023';
  end if;
  if (p_disparo = 'MONITORA') <> (p_usuario is not null) then
    raise exception 'Usuário só (e sempre) no disparo pelo MONITORA' using errcode = '22023';
  end if;
  if coalesce(p_vagas_pedidas, -1) not between 0 and 500 then
    raise exception 'Vagas pedidas fora de 0 a 500' using errcode = '22023';
  end if;

  -- Execução que morreu sem fechar (o workflow tem tempo limite de 2 h) não segura as próximas.
  update public."TL_SYNC_EMPREGARE" set
    "TP_SITUACAO" = 'FALHOU', "DT_FIM" = now(),
    "DS_MENSAGEM" = 'Interrompida: a execução terminou sem fechar a carga.'
   where "TP_SITUACAO" = 'EM_ANDAMENTO' and "DT_INICIO" < now() - interval '3 hours';
  get diagnostics v_interrompidas = row_count;

  if exists (select 1 from public."TL_SYNC_EMPREGARE" s where s."TP_SITUACAO" = 'EM_ANDAMENTO') then
    raise exception 'Já há uma execução do robô da Empregare em andamento' using errcode = '55P03';
  end if;

  insert into public."TL_SYNC_EMPREGARE" (
    "CO_SYNC", "TP_DISPARO", "CO_USUARIO_DISPARO", "ST_FORCADA", "DS_FILTRO", "QT_VAGA_PEDIDA", "DS_URL_EXECUCAO")
  values (
    p_sync, p_disparo, p_usuario, case when coalesce(p_forcar, false) then 'S' else 'N' end,
    case when jsonb_typeof(p_filtro) = 'object' then p_filtro else '{}'::jsonb end,
    p_vagas_pedidas, p_url);

  return jsonb_build_object('sync', p_sync, 'interrompidas', v_interrompidas);
end;
$function$;
comment on function public.iniciar_sync_empregare(text, text, uuid, jsonb, integer, text, boolean) is
  'Abre uma execução do robô da Empregare em TL_SYNC_EMPREGARE (quem disparou, filtro, vagas pedidas, endereço da execução, forçar). Fecha como FALHOU a execução esquecida há mais de 3 h e recusa (55P03) se outra estiver em andamento. Só service_role.';

create function public.gravar_lote_empregare(p_sync text, p_vaga text, p_total integer, p_linhas jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_situacao text;
  v_qt integer;
begin
  perform private."FC_EMPREGARE_EXIGIR_SYNC"(p_sync);
  if p_vaga is null or p_vaga !~ '^[0-9]{1,20}$' then
    raise exception 'Código de vaga inválido' using errcode = '22023';
  end if;
  if coalesce(p_total, -1) not between 1 and 50000 then
    raise exception 'Total de candidatos fora de 1 a 50000' using errcode = '22023';
  end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' or jsonb_array_length(p_linhas) not between 1 and 1000 then
    raise exception 'Envie de 1 a 1000 linhas por lote' using errcode = '22023';
  end if;

  v_situacao := private."FC_EMPREGARE_ABRIR_VAGA"(p_sync, p_vaga, p_total);
  if v_situacao <> 'EM_CARGA' then
    return jsonb_build_object('situacao', v_situacao, 'gravadas', 0);
  end if;

  create temporary table if not exists pg_temp.tmp_empregare_lote (
    chave text, tipo text, codigo text, nome text, email text, cpf text, telefone text,
    nascimento date, situacao text, candidatura timestamptz, colunas jsonb, hash text
  ) on commit drop;
  truncate pg_temp.tmp_empregare_lote;

  insert into pg_temp.tmp_empregare_lote
  select distinct on (l.chave)
         l.chave, l.tipo,
         nullif(left(btrim(l.codigo), 60), ''),
         nullif(left(btrim(l.nome), 300), ''),
         nullif(left(lower(btrim(l.email)), 320), ''),
         case when l.cpf ~ '^[0-9]{11}$' then l.cpf end,
         nullif(left(btrim(l.telefone), 60), ''),
         private."FC_EMPREGARE_DATA"(l.nascimento),
         nullif(left(btrim(l.situacao), 200), ''),
         private."FC_EMPREGARE_MOMENTO"(l.candidatura),
         l.colunas,
         encode(sha256(convert_to(l.colunas::text, 'UTF8')), 'hex')
    from jsonb_to_recordset(p_linhas) as l(
      chave text, tipo text, codigo text, nome text, email text, cpf text, telefone text,
      nascimento text, situacao text, candidatura text, colunas jsonb)
   where l.chave ~ '^(cod:[A-Za-z0-9._-]{1,60}|cpf:[0-9a-f]{64}|email:[0-9a-f]{64})$'
     and l.tipo in ('CODIGO', 'CPF', 'EMAIL')
     and jsonb_typeof(l.colunas) = 'object'
   order by l.chave;

  insert into public."TB_EMPREGARE_CANDIDATO" as c (
    "CO_VAGA", "DS_CHAVE_CANDIDATO", "TP_CHAVE", "CO_CANDIDATO_EMPREGARE", "NO_CANDIDATO", "DS_EMAIL",
    "NU_CPF", "NU_TELEFONE", "DT_NASCIMENTO", "DS_SITUACAO_EMPREGARE", "DT_CANDIDATURA",
    "DS_COLUNA_ORIGINAL", "DS_HASH_LINHA", "CO_SYNC", "ST_REGISTRO_ATIVO")
  select p_vaga, t.chave, t.tipo, t.codigo, t.nome, t.email, t.cpf, t.telefone, t.nascimento,
         t.situacao, t.candidatura, t.colunas, t.hash, p_sync, 'S'
    from pg_temp.tmp_empregare_lote t
  on conflict ("CO_VAGA", "DS_CHAVE_CANDIDATO") do update set
    "TP_CHAVE" = excluded."TP_CHAVE",
    "CO_CANDIDATO_EMPREGARE" = excluded."CO_CANDIDATO_EMPREGARE",
    "NO_CANDIDATO" = excluded."NO_CANDIDATO",
    "DS_EMAIL" = excluded."DS_EMAIL",
    "NU_CPF" = excluded."NU_CPF",
    "NU_TELEFONE" = excluded."NU_TELEFONE",
    "DT_NASCIMENTO" = excluded."DT_NASCIMENTO",
    "DS_SITUACAO_EMPREGARE" = excluded."DS_SITUACAO_EMPREGARE",
    "DT_CANDIDATURA" = excluded."DT_CANDIDATURA",
    "DS_COLUNA_ORIGINAL" = excluded."DS_COLUNA_ORIGINAL",
    "DS_HASH_LINHA" = excluded."DS_HASH_LINHA",
    "CO_SYNC" = excluded."CO_SYNC",
    "DT_ATUALIZACAO" = case
      when c."DS_HASH_LINHA" is distinct from excluded."DS_HASH_LINHA" or c."ST_REGISTRO_ATIVO" = 'N' then now()
      else c."DT_ATUALIZACAO" end,
    "DT_CONFERENCIA" = now(),
    "ST_REGISTRO_ATIVO" = 'S',
    "DT_DESATIVACAO" = null;

  select count(*) into v_qt from pg_temp.tmp_empregare_lote;
  update public."TB_EMPREGARE_VAGA" set "QT_RECEBIDA" = "QT_RECEBIDA" + v_qt, "DT_ATUALIZACAO" = now()
   where "CO_VAGA" = p_vaga;
  update public."TL_SYNC_EMPREGARE" set "QT_LINHA" = "QT_LINHA" + v_qt where "CO_SYNC" = p_sync;
  return jsonb_build_object('situacao', 'EM_CARGA', 'recebidas', jsonb_array_length(p_linhas), 'gravadas', v_qt);
end;
$function$;
comment on function public.gravar_lote_empregare(text, text, integer, jsonb) is
  'Recebe um lote (até 1000) de candidatos de uma vaga e faz upsert em TB_EMPREGARE_CANDIDATO pela chave natural (o hash da linha diz se mudou). p_total = candidatos do arquivo inteiro: no primeiro lote da vaga, a trava recusa (RECUSADA, nada gravado) o arquivo com menos da metade dos ativos sem forçar. Fechar com fechar_vaga_empregare. Só service_role.';

create function public.fechar_vaga_empregare(p_sync text, p_vaga text, p_colunas jsonb, p_arquivo text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_situacao text;
  v_desativadas integer;
  v_ativos integer;
  v_recebidas integer;
begin
  perform private."FC_EMPREGARE_EXIGIR_SYNC"(p_sync);
  if p_vaga is null or p_vaga !~ '^[0-9]{1,20}$' then
    raise exception 'Código de vaga inválido' using errcode = '22023';
  end if;
  if jsonb_typeof(p_colunas) is distinct from 'array' or jsonb_array_length(p_colunas) > 2000 then
    raise exception 'Colunas em lista de até 2000 nomes' using errcode = '22023';
  end if;

  -- Arquivo sem nenhum candidato não passou por gravar_lote: a trava vale aqui.
  v_situacao := private."FC_EMPREGARE_ABRIR_VAGA"(p_sync, p_vaga, 0);
  if v_situacao = 'RECUSADA' then
    return jsonb_build_object('situacao', 'RECUSADA',
      'mensagem', (select v."DS_MENSAGEM" from public."TB_EMPREGARE_VAGA" v where v."CO_VAGA" = p_vaga));
  end if;
  if v_situacao <> 'EM_CARGA' then
    raise exception 'Vaga % já fechada nesta execução', p_vaga using errcode = '22023';
  end if;

  update public."TB_EMPREGARE_CANDIDATO" c set
    "ST_REGISTRO_ATIVO" = 'N', "DT_DESATIVACAO" = now(), "DT_ATUALIZACAO" = now()
   where c."CO_VAGA" = p_vaga and c."ST_REGISTRO_ATIVO" = 'S' and c."CO_SYNC" is distinct from p_sync;
  get diagnostics v_desativadas = row_count;

  select count(*) into v_ativos
    from public."TB_EMPREGARE_CANDIDATO" c
   where c."CO_VAGA" = p_vaga and c."ST_REGISTRO_ATIVO" = 'S';

  update public."TB_EMPREGARE_VAGA" set
    "TP_SITUACAO" = 'GRAVADA', "DS_COLUNA" = p_colunas, "NO_ARQUIVO" = left(p_arquivo, 300),
    "QT_CANDIDATO_ATIVO" = v_ativos, "DS_MENSAGEM" = null, "DT_ULTIMA_CARGA" = now(), "DT_ATUALIZACAO" = now()
   where "CO_VAGA" = p_vaga
  returning "QT_RECEBIDA" into v_recebidas;

  update public."TL_SYNC_EMPREGARE" set "QT_DESATIVADA" = "QT_DESATIVADA" + v_desativadas where "CO_SYNC" = p_sync;
  return jsonb_build_object('situacao', 'GRAVADA', 'recebidas', v_recebidas, 'ativos', v_ativos, 'desativadas', v_desativadas);
end;
$function$;
comment on function public.fechar_vaga_empregare(text, text, jsonb, text) is
  'Fecha a vaga na execução: desativa (ST_REGISTRO_ATIVO = N) quem não veio no arquivo e grava colunas, arquivo e ativos em TB_EMPREGARE_VAGA. Vaga recusada pela trava não muda. Arquivo sem candidatos passa pela trava aqui. Só service_role.';

create function public.finalizar_sync_empregare(p_sync text, p_vagas_baixadas integer, p_vagas_falha integer, p_erro text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_sync public."TL_SYNC_EMPREGARE";
  v_situacao text;
  v_mensagem text := nullif(left(btrim(coalesce(p_erro, '')), 2000), '');
  v_incompletas integer;
begin
  perform private."FC_EMPREGARE_EXIGIR_SYNC"(p_sync);
  if coalesce(p_vagas_baixadas, -1) < 0 or coalesce(p_vagas_falha, -1) < 0 then
    raise exception 'Contagens de vagas inválidas' using errcode = '22023';
  end if;

  -- Vaga que ficou no meio (a execução caiu entre um lote e o fechamento): nada foi desativado nela.
  update public."TB_EMPREGARE_VAGA" set
    "TP_SITUACAO" = 'INCOMPLETA', "DT_ATUALIZACAO" = now(),
    "DS_MENSAGEM" = 'A execução terminou no meio da vaga: ninguém foi desativado.'
   where "CO_SYNC" = p_sync and "TP_SITUACAO" = 'EM_CARGA';
  get diagnostics v_incompletas = row_count;

  select * into v_sync from public."TL_SYNC_EMPREGARE" s where s."CO_SYNC" = p_sync for update;
  v_situacao := case
    when v_mensagem is not null then 'FALHOU'
    when v_sync."QT_VAGA_PEDIDA" > 0 and p_vagas_baixadas = 0 then 'FALHOU'
    when p_vagas_falha > 0 or v_sync."QT_VAGA_RECUSADA" > 0 or v_incompletas > 0 then 'PARCIAL'
    else 'CONCLUIDA' end;
  if v_situacao = 'FALHOU' and v_mensagem is null then
    v_mensagem := 'Nenhuma vaga foi baixada da Empregare.';
  end if;

  update public."TL_SYNC_EMPREGARE" set
    "TP_SITUACAO" = v_situacao, "DT_FIM" = now(),
    "QT_VAGA_BAIXADA" = p_vagas_baixadas, "QT_VAGA_FALHA" = p_vagas_falha,
    "DS_MENSAGEM" = coalesce(v_mensagem, case when v_sync."ST_FORCADA" = 'S' then 'Rodou com forçar.' end)
   where "CO_SYNC" = p_sync;

  return jsonb_build_object(
    'situacao', v_situacao, 'pedidas', v_sync."QT_VAGA_PEDIDA", 'baixadas', p_vagas_baixadas,
    'falhas', p_vagas_falha, 'recusadas', v_sync."QT_VAGA_RECUSADA", 'incompletas', v_incompletas,
    'linhas', v_sync."QT_LINHA", 'desativadas', v_sync."QT_DESATIVADA");
end;
$function$;
comment on function public.finalizar_sync_empregare(text, integer, integer, text) is
  'Fecha a execução do robô da Empregare: CONCLUIDA, PARCIAL (falha, recusa ou vaga incompleta) ou FALHOU (p_erro, ou nada baixado). Vaga que ficou no meio vira INCOMPLETA, sem desativar ninguém. Só service_role.';

revoke all on function public.listar_vagas_empregare(text[], text[], integer) from public, anon, authenticated;
revoke all on function public.iniciar_sync_empregare(text, text, uuid, jsonb, integer, text, boolean) from public, anon, authenticated;
revoke all on function public.gravar_lote_empregare(text, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.fechar_vaga_empregare(text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.finalizar_sync_empregare(text, integer, integer, text) from public, anon, authenticated;
grant execute on function public.listar_vagas_empregare(text[], text[], integer) to service_role;
grant execute on function public.iniciar_sync_empregare(text, text, uuid, jsonb, integer, text, boolean) to service_role;
grant execute on function public.gravar_lote_empregare(text, text, integer, jsonb) to service_role;
grant execute on function public.fechar_vaga_empregare(text, text, jsonb, text) to service_role;
grant execute on function public.finalizar_sync_empregare(text, integer, integer, text) to service_role;

-- 7. Leitura ----------------------------------------------------------------------------
create function public.obter_candidatos_empregare(p_vaga text)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_vaga public."TB_EMPREGARE_VAGA";
  v_area text;
  v_editais uuid[];
begin
  if auth.uid() is null then
    raise exception 'Sessão necessária' using errcode = '42501';
  end if;
  if p_vaga is null or p_vaga !~ '^[0-9]{1,20}$' then
    raise exception 'Código de vaga inválido' using errcode = '22023';
  end if;
  if not private.pode_recurso('selecao', 2) then
    raise exception 'Sem permissão para os candidatos da Empregare' using errcode = '42501';
  end if;
  select * into v_vaga from public."TB_EMPREGARE_VAGA" v where v."CO_VAGA" = p_vaga;
  if v_vaga."CO_VAGA" is null then
    return null;
  end if;
  if v_vaga."CO_MONITORAMENTO" is null then
    if not private.is_master() then
      raise exception 'Vaga sem edital: só o administrador global vê' using errcode = '42501';
    end if;
  else
    select m."CO_AREA" into v_area from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_vaga."CO_MONITORAMENTO";
    if v_area is null or not private."FC_PODE_AREA"(v_area) then
      raise exception 'Sem acesso a esta área' using errcode = '42501';
    end if;
    v_editais := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];
    if v_editais is not null and not (v_vaga."CO_MONITORAMENTO" = any (v_editais)) then
      raise exception 'Sem acesso a este edital' using errcode = '42501';
    end if;
  end if;

  return json_build_object(
    'schema_version', 1,
    'vaga', v_vaga."CO_VAGA",
    'edital_id', v_vaga."CO_MONITORAMENTO",
    'situacao', v_vaga."TP_SITUACAO",
    'ultima_carga', v_vaga."DT_ULTIMA_CARGA",
    'colunas', v_vaga."DS_COLUNA",
    'candidatos', (
      select coalesce(json_agg(json_build_object(
          'id', c."CO_EMPREGARE_CANDIDATO",
          'codigo', c."CO_CANDIDATO_EMPREGARE",
          'nome', c."NO_CANDIDATO",
          'email', c."DS_EMAIL",
          'cpf', c."NU_CPF",
          'telefone', c."NU_TELEFONE",
          'nascimento', c."DT_NASCIMENTO",
          'situacao', c."DS_SITUACAO_EMPREGARE",
          'candidatura', c."DT_CANDIDATURA",
          'colunas', c."DS_COLUNA_ORIGINAL",
          'atualizado_em', c."DT_ATUALIZACAO"
        ) order by c."NO_CANDIDATO", c."DS_CHAVE_CANDIDATO"), '[]'::json)
        from public."TB_EMPREGARE_CANDIDATO" c
       where c."CO_VAGA" = p_vaga and c."ST_REGISTRO_ATIVO" = 'S'
    )
  );
end;
$function$;
comment on function public.obter_candidatos_empregare(text) is
  'Candidatos ativos de uma vaga da Empregare (json): colunas conhecidas e todas as colunas originais, com a ordem das colunas do último Excel. Exige selecao >= editor, a área e o recorte do edital; vaga sem edital, só o administrador global. Nulo se a vaga nunca foi carregada.';
revoke all on function public.obter_candidatos_empregare(text) from public, anon;
grant execute on function public.obter_candidatos_empregare(text) to authenticated, service_role;

create function public.pode_disparar_carga()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select (select auth.uid()) is not null and private.is_master();
$function$;
comment on function public.pode_disparar_carga() is
  'true quando quem chama é o administrador global: api/rodar-carga.js confere com o Bearer de quem clicou em Rodar agora antes de disparar o workflow.';
revoke all on function public.pode_disparar_carga() from public, anon;
grant execute on function public.pode_disparar_carga() to authenticated;

-- 8. Status das atualizações ganha o robô da Empregare ------------------------------------
create or replace function public.get_saude_das_cargas()
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_tarefas json;
begin
  if not private.is_master() then
    raise exception 'Somente o administrador global vê a saúde das cargas' using errcode = '42501';
  end if;

  -- pg_cron pode não estar acessível: a seção mostra "indisponível" nessa parte.
  begin
    select coalesce(json_agg(json_build_object(
        'nome', j.jobname,
        'agenda', j.schedule,
        'ativa', j.active,
        'execucoes', (
          select coalesce(json_agg(json_build_object(
              'inicio', d.start_time,
              'fim', d.end_time,
              'situacao', d.status,
              'mensagem', left(d.return_message, 500)
            ) order by d.start_time desc), '[]'::json)
            from (select * from cron.job_run_details r
                   where r.jobid = j.jobid
                   order by r.start_time desc limit 10) d
        )
      ) order by j.jobname), '[]'::json)
      into v_tarefas
      from cron.job j
     where left(j.jobname, 6) = 'agsus_';
  exception when others then
    v_tarefas := null;
  end;

  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'analises', (
      select coalesce(json_agg(json_build_object(
          'origem', o."CO_ORIGEM",
          'area', p."CO_AREA",
          'planilha', p."NO_PLANILHA",
          'tipo', o."TP_CARGA",
          'execucoes', (
            select coalesce(json_agg(json_build_object(
                'inicio', x.j ->> 'started_at',
                'fim', x.j ->> 'finished_at',
                'situacao', x.j ->> 'status',
                'linhas', coalesce(x.j ->> 'total_processados', x.j ->> 'total_lidos', x.j ->> 'linhas_staging'),
                'mensagem', left(coalesce(x.j ->> 'erro', x.j ->> 'mensagem'), 500)
              ) order by x.inicio desc nulls last), '[]'::json)
              from (select to_jsonb(s) as j, s.started_at as inicio
                      from public."TL_SYNC_ANALISE" s
                     where s.origem = o."CO_ORIGEM"
                     order by s.started_at desc nulls last
                     limit 10) x
          )
        ) order by p."CO_AREA", o."TP_CARGA" desc), '[]'::json)
        from public."TA_ORIGEM_ANALISE" o
        join public."TB_PLANILHA_ANALISE" p on p."CO_PLANILHA" = o."CO_PLANILHA"
    ),
    'entrevistas', (
      select coalesce(json_agg(json_build_object(
          'inicio', e."DT_INICIO",
          'fim', e."DT_FIM",
          'situacao', e."TP_SITUACAO",
          'linhas', e."QT_LINHA",
          'mensagem', e."DS_MENSAGEM",
          'area', e."CO_AREA"
        ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_ENTREVISTA" t order by t."DT_INICIO" desc limit 10) e
    ),
    'selecao', (
      select coalesce(json_agg(json_build_object(
          'inicio', e."DT_INICIO",
          'fim', e."DT_FIM",
          'situacao', e."TP_SITUACAO",
          'linhas', e."QT_LINHA",
          'mensagem', e."DS_MENSAGEM"
        ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_SELECAO" t order by t."DT_INICIO" desc limit 10) e
    ),
    'empregare', (
      select coalesce(json_agg(json_build_object(
          'inicio', e."DT_INICIO",
          'fim', e."DT_FIM",
          'situacao', e."TP_SITUACAO",
          'linhas', e."QT_LINHA",
          'mensagem', e."DS_MENSAGEM",
          'disparo', e."TP_DISPARO",
          'vagas_pedidas', e."QT_VAGA_PEDIDA",
          'vagas_baixadas', e."QT_VAGA_BAIXADA",
          'vagas_falha', e."QT_VAGA_FALHA",
          'vagas_recusadas', e."QT_VAGA_RECUSADA",
          'desativadas', e."QT_DESATIVADA",
          'execucao', e."DS_URL_EXECUCAO"
        ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_EMPREGARE" t order by t."DT_INICIO" desc limit 10) e
    ),
    'tarefas', v_tarefas
  );
end;
$function$;
comment on function public.get_saude_das_cargas() is
  'Saúde das cargas (Configurações, só administrador global): as últimas 10 execuções de cada carga das análises (por origem), das entrevistas, da seleção, do robô da Empregare (com vagas pedidas/baixadas/falhas/recusadas e quem disparou) e das tarefas agsus_* do pg_cron (nulas sem acesso ao pg_cron). Só leitura.';

commit;
