/*
  RECURSOS: ANEXOS, MODELOS DE RESPOSTA E RESPOSTA ESCRITA NO SISTEMA

  A aba Recursos (20260929120000_recursos.sql, com o recorte por coordenação de
  20260929190200_recorte_por_coordenacao_nos_recursos.sql) acompanha o recurso,
  mas o documento do candidato e a resposta ficavam fora. Esta migration traz os
  dois para dentro.

  O QUE ENTRA
    1. Anexos do recurso
       - Bucket privado `recursos-anexos` (20 MB por arquivo; pdf, docx, doc,
         jpg, png e odt). Caminho: `<área>/<recurso>/<uuid>-<nome>`. As
         políticas do Storage leem o caminho e conferem, por funções private:
           · envio (insert): recursos >= editor, recurso ativo, a área do
             caminho é a do edital e o edital está na área e na coordenação de
             quem envia (FC_PODE_VER_EDITAL);
           · leitura (select, que é o que gera a URL assinada): o mesmo acesso
             com leitor E um registro de download da própria pessoa naquele
             anexo nos últimos 5 minutos — o registro só nasce pela RPC
             registrar_download_anexo_recurso, que confere tudo antes. Assim
             todo download fica no histórico. A outra porta do select é o
             próprio arquivo recém-enviado por quem o enviou (10 minutos),
             porque o insert do Storage devolve a linha;
           · sem update e sem delete: nada se sobrescreve nem se apaga pela
             API. Arquivar é lógico (ST_ATIVO = 'N', com motivo); o arquivo
             fica.
       - public."TB_ANEXO_RECURSO" (metadados; o arquivo fica no bucket) e
         public."TH_ANEXO_RECURSO" (inclusão, download e arquivamento).
    2. Modelos de resposta
       - public."TB_MODELO_RESPOSTA_RECURSO": uma linha por versão (PK
         modelo + versão). Editar cria a versão seguinte e a anterior deixa de
         ser a vigente (ST_VIGENTE), sem sumir: a resposta guarda a versão que
         usou. Área e origem nulas = vale para todas. Marcadores permitidos em
         private."FC_MARCADORES_MODELO_RESPOSTA"() (os mesmos de
         src/lib/modelos-de-resposta.js).
       - 6 modelos iniciais: deferido, indeferido e parcialmente indeferido,
         para análise curricular e para entrevista.
       - Manutenção só com recursos = admin (nível 3).
    3. Resposta escrita no sistema
       - public."TB_RESPOSTA_RECURSO" (uma por recurso): modelo e versão
         usados, fundamentação, texto final, estado (rascunho, em_revisao,
         aprovada, devolvida, enviada), autor, quem enviou para revisão,
         revisor, comentário, envio, NU_REVISAO (concorrência otimista).
       - public."TH_RESPOSTA_RECURSO": cada gravação e transição, com o texto
         do momento.
       - Regras (espelhadas em src/lib/resposta-do-recurso.js):
           · rascunho/devolvida → salvar (volta a rascunho) ou enviar para
             revisão;
           · rascunho → aprovar direto (a revisão é opcional; quem aprova fica
             registrado), desde que a resposta nunca tenha ido para revisão;
           · em revisão → aprovar ou devolver (com comentário), por outra
             pessoa: nem o autor do texto nem quem enviou para revisão;
           · aprovada → marcar enviada (marca também a etapa "resposta enviada
             ao candidato" do recurso, com quem e quando) ou reabrir (com
             comentário);
           · aprovar exige o recurso decidido e com a mesma situação do modelo.
    4. O histórico do recurso (TH_RECURSO_CANDIDATO) passa a registrar anexos
       e respostas ('anexo', 'resposta'); o download fica só no histórico do
       anexo.
    5. get_recursos_da_area ganha, por recurso, o estado da resposta e o nº de
       anexos ativos, e os modelos da área (quem edita); get_recurso_candidato_detalhe
       ganha os anexos, a resposta com o histórico dela e o id de quem pede
       ('eu'). Os corpos são os de 20260929190200 (com o recorte da
       coordenação), só acrescidos.

  RPCs novas (SECURITY DEFINER, search_path vazio; anon não executa)
    listar_modelos_resposta_recurso()                        admin de recursos
    salvar_modelo_resposta_recurso(p_dados)                  admin de recursos
    arquivar_modelo_resposta_recurso(p_modelo_id, p_motivo)  admin de recursos
    salvar_resposta_recurso(p_dados)                         editor
    transicionar_resposta_recurso(p_resposta_id, p_acao, p_revisao, p_comentario)  editor
    registrar_anexo_recurso(p_recurso_id, p_tipo, p_nome, p_caminho, p_resposta_id)  editor
    arquivar_anexo_recurso(p_anexo_id, p_motivo)             editor
    registrar_download_anexo_recurso(p_anexo_id)             leitor (arquivado: editor)
  Todas passam por FC_EXIGIR_RECURSOS_NA_AREA (nível + área) e
  FC_EXIGIR_AREA_EDITAL (coordenação), pelo recurso.

  PRÉ-REQUISITO: 20260929190200 aplicada (a migration para se não estiver).

  Rollback: supabase/rollback/20260929230000_recursos_modelos_anexos_respostas.sql
  (não apaga arquivo nem bucket; só apaga as tabelas se estiverem sem dado).
*/
begin;

-- 0. Pré-requisito ------------------------------------------------------------------
do $$
begin
  if position('FC_EDITAIS_VISIVEIS' in pg_get_functiondef('public.get_recursos_da_area(text)'::regprocedure)) = 0 then
    raise exception 'Aplique antes 20260929190200_recorte_por_coordenacao_nos_recursos.sql (get_recursos_da_area sem o recorte por coordenação).';
  end if;
end;
$$;

-- 1. Histórico do recurso: anexos e respostas --------------------------------------
alter table public."TH_RECURSO_CANDIDATO" drop constraint "CK_HISTRECURSO_TPACAO";
alter table public."TH_RECURSO_CANDIDATO" add constraint "CK_HISTRECURSO_TPACAO"
  check ("TP_ACAO" in ('criacao', 'edicao', 'etapa', 'exclusao', 'anexo', 'resposta'));
comment on constraint "CK_HISTRECURSO_TPACAO" on public."TH_RECURSO_CANDIDATO" is
  'Ações registradas: criacao, edicao, etapa, exclusao, anexo (inclusão/arquivamento) e resposta (transições da resposta).';
comment on column public."TH_RECURSO_CANDIDATO"."TP_ACAO" is
  'criacao, edicao, etapa, exclusao, anexo ou resposta.';
comment on column public."TH_RECURSO_CANDIDATO"."DS_CAMPO" is
  'Campo editado, etapa (download_empregare, processo_sei, upload_sei, resposta_candidato), ação do anexo (inclusao, arquivamento) ou da resposta (criacao, enviar_revisao, aprovar, devolver, reabrir, marcar_enviada). Nulo na criação e na exclusão do recurso.';

-- 2. Modelos de resposta ------------------------------------------------------------
create table public."TB_MODELO_RESPOSTA_RECURSO" (
  "CO_MODELO_RESPOSTA" uuid not null,
  "NU_VERSAO" integer not null,
  "CO_AREA" text,
  "CO_ORIGEM_RECURSO" text,
  "TP_SITUACAO" text not null,
  "NO_MODELO" text not null,
  "DS_CORPO" text not null,
  "ST_VIGENTE" varchar(1) not null default 'S',
  "ST_ATIVO" varchar(1) not null default 'S',
  "DS_MOTIVO_ARQUIVAMENTO" text,
  "DT_ARQUIVAMENTO" timestamptz,
  "CO_USUARIO_ARQUIVAMENTO" uuid,
  "DT_CRIACAO" timestamptz not null default now(),
  "CO_USUARIO_CRIACAO" uuid,
  constraint "PK_TB_MODELO_RESPOSTA_RECURSO" primary key ("CO_MODELO_RESPOSTA", "NU_VERSAO"),
  constraint "FK_AREA_MODELORESPOSTA" foreign key ("CO_AREA") references public."TB_AREA" ("CO_AREA"),
  constraint "FK_ORIGEMRECURSO_MODELORESPOSTA" foreign key ("CO_ORIGEM_RECURSO") references public."TB_ORIGEM_RECURSO" ("CO_ORIGEM_RECURSO"),
  constraint "CK_MODELORESPOSTA_TPSITUACAO" check ("TP_SITUACAO" in ('DEFERIDO', 'INDEFERIDO', 'PARCIALMENTE_INDEFERIDO')),
  constraint "CK_MODELORESPOSTA_NUVERSAO" check ("NU_VERSAO" >= 1),
  constraint "CK_MODELORESPOSTA_STVIGENTE" check ("ST_VIGENTE" in ('S', 'N')),
  constraint "CK_MODELORESPOSTA_STATIVO" check ("ST_ATIVO" in ('S', 'N')),
  constraint "CK_MODELORESPOSTA_TAMANHOS" check (
    length(btrim("NO_MODELO")) between 3 and 150
    and length(btrim("DS_CORPO")) between 20 and 20000
    and coalesce(length("DS_MOTIVO_ARQUIVAMENTO"), 0) <= 500
  ),
  constraint "CK_MODELORESPOSTA_ARQUIVAMENTO" check (
    ("ST_ATIVO" = 'S') = ("DT_ARQUIVAMENTO" is null)
    and ("DT_ARQUIVAMENTO" is null) = ("DS_MOTIVO_ARQUIVAMENTO" is null)
    and ("DT_ARQUIVAMENTO" is null) = ("CO_USUARIO_ARQUIVAMENTO" is null)
  )
);
comment on table public."TB_MODELO_RESPOSTA_RECURSO" is
  'Modelos de resposta a recurso, uma linha por versão. Editar cria a versão seguinte (a anterior fica, não vigente); a resposta guarda modelo e versão usados.';
comment on column public."TB_MODELO_RESPOSTA_RECURSO"."CO_MODELO_RESPOSTA" is 'Identificador do modelo (o mesmo em todas as versões).';
comment on column public."TB_MODELO_RESPOSTA_RECURSO"."NU_VERSAO" is 'Versão do modelo (1, 2, …).';
comment on column public."TB_MODELO_RESPOSTA_RECURSO"."CO_AREA" is 'Área em que o modelo vale (TB_AREA). Nula: todas as áreas.';
comment on column public."TB_MODELO_RESPOSTA_RECURSO"."CO_ORIGEM_RECURSO" is 'Origem de recurso em que o modelo vale (TB_ORIGEM_RECURSO). Nula: todas as origens.';
comment on column public."TB_MODELO_RESPOSTA_RECURSO"."TP_SITUACAO" is 'Decisão a que o modelo responde: DEFERIDO, INDEFERIDO ou PARCIALMENTE_INDEFERIDO.';
comment on column public."TB_MODELO_RESPOSTA_RECURSO"."NO_MODELO" is 'Nome do modelo na lista.';
comment on column public."TB_MODELO_RESPOSTA_RECURSO"."DS_CORPO" is 'Texto do modelo, com marcadores entre chaves ({nome_candidato}, {fundamentacao}…); só os de FC_MARCADORES_MODELO_RESPOSTA.';
comment on column public."TB_MODELO_RESPOSTA_RECURSO"."ST_VIGENTE" is 'S: a versão atual do modelo (uma por modelo); N: versão anterior, mantida para as respostas que a usaram.';
comment on column public."TB_MODELO_RESPOSTA_RECURSO"."ST_ATIVO" is 'S: pode ser escolhido; N: arquivado (continua nas respostas que o usaram). Salvar de novo reativa, numa versão nova.';
comment on column public."TB_MODELO_RESPOSTA_RECURSO"."DS_MOTIVO_ARQUIVAMENTO" is 'Motivo do arquivamento.';
comment on column public."TB_MODELO_RESPOSTA_RECURSO"."DT_ARQUIVAMENTO" is 'Quando foi arquivado.';
comment on column public."TB_MODELO_RESPOSTA_RECURSO"."CO_USUARIO_ARQUIVAMENTO" is 'Quem arquivou (auth.users.id).';
comment on column public."TB_MODELO_RESPOSTA_RECURSO"."DT_CRIACAO" is 'Quando a versão foi criada.';
comment on column public."TB_MODELO_RESPOSTA_RECURSO"."CO_USUARIO_CRIACAO" is 'Quem criou a versão (auth.users.id). Nulo nos modelos iniciais, semeados pela migration.';
comment on constraint "FK_AREA_MODELORESPOSTA" on public."TB_MODELO_RESPOSTA_RECURSO" is 'Área do modelo.';
comment on constraint "FK_ORIGEMRECURSO_MODELORESPOSTA" on public."TB_MODELO_RESPOSTA_RECURSO" is 'Origem do modelo.';
comment on constraint "CK_MODELORESPOSTA_TPSITUACAO" on public."TB_MODELO_RESPOSTA_RECURSO" is 'Só situações decididas.';
comment on constraint "CK_MODELORESPOSTA_NUVERSAO" on public."TB_MODELO_RESPOSTA_RECURSO" is 'Versão começa em 1.';
comment on constraint "CK_MODELORESPOSTA_STVIGENTE" on public."TB_MODELO_RESPOSTA_RECURSO" is 'Flag S/N.';
comment on constraint "CK_MODELORESPOSTA_STATIVO" on public."TB_MODELO_RESPOSTA_RECURSO" is 'Flag S/N.';
comment on constraint "CK_MODELORESPOSTA_TAMANHOS" on public."TB_MODELO_RESPOSTA_RECURSO" is 'Nome de 3 a 150, corpo de 20 a 20.000 e motivo até 500 caracteres.';
comment on constraint "CK_MODELORESPOSTA_ARQUIVAMENTO" on public."TB_MODELO_RESPOSTA_RECURSO" is 'Arquivado guarda quando, quem e motivo juntos; ativo não guarda nenhum.';
create unique index "IN_MODELORESPOSTA_VIGENTE" on public."TB_MODELO_RESPOSTA_RECURSO" ("CO_MODELO_RESPOSTA") where "ST_VIGENTE" = 'S';
comment on index public."IN_MODELORESPOSTA_VIGENTE" is 'Uma versão vigente por modelo.';
create index "IN_FKMODELORESPOSTA_COAREA" on public."TB_MODELO_RESPOSTA_RECURSO" ("CO_AREA");
comment on index public."IN_FKMODELORESPOSTA_COAREA" is 'Chave estrangeira para TB_AREA.';
create index "IN_FKMODELORESPOSTA_COORIGEM" on public."TB_MODELO_RESPOSTA_RECURSO" ("CO_ORIGEM_RECURSO");
comment on index public."IN_FKMODELORESPOSTA_COORIGEM" is 'Chave estrangeira para TB_ORIGEM_RECURSO.';

-- 3. Resposta do recurso -------------------------------------------------------------
create table public."TB_RESPOSTA_RECURSO" (
  "CO_RESPOSTA_RECURSO" uuid not null default gen_random_uuid(),
  "CO_RECURSO_CANDIDATO" uuid not null,
  "CO_MODELO_RESPOSTA" uuid not null,
  "NU_VERSAO_MODELO" integer not null,
  "DS_FUNDAMENTACAO" text not null default '',
  "DS_TEXTO_FINAL" text not null,
  "TP_ESTADO" text not null default 'rascunho',
  "ST_PASSOU_REVISAO" varchar(1) not null default 'N',
  "CO_USUARIO_AUTOR" uuid not null,
  "DT_ENVIO_REVISAO" timestamptz,
  "CO_USUARIO_ENVIO_REVISAO" uuid,
  "DT_REVISAO" timestamptz,
  "CO_USUARIO_REVISOR" uuid,
  "DS_COMENTARIO_REVISAO" text,
  "DT_ENVIO" timestamptz,
  "CO_USUARIO_ENVIO" uuid,
  "NU_REVISAO" integer not null default 1,
  "DT_CRIACAO" timestamptz not null default now(),
  "CO_USUARIO_CRIACAO" uuid not null,
  "DT_ATUALIZACAO" timestamptz not null default now(),
  "CO_USUARIO_ATUALIZACAO" uuid not null,
  constraint "PK_TB_RESPOSTA_RECURSO" primary key ("CO_RESPOSTA_RECURSO"),
  constraint "UK_RESPOSTARECURSO_CORECURSO" unique ("CO_RECURSO_CANDIDATO"),
  constraint "FK_RECURSOCANDIDATO_RESPOSTARECURSO" foreign key ("CO_RECURSO_CANDIDATO") references public."TB_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO"),
  constraint "FK_MODELORESPOSTA_RESPOSTARECURSO" foreign key ("CO_MODELO_RESPOSTA", "NU_VERSAO_MODELO") references public."TB_MODELO_RESPOSTA_RECURSO" ("CO_MODELO_RESPOSTA", "NU_VERSAO"),
  constraint "CK_RESPOSTARECURSO_TPESTADO" check ("TP_ESTADO" in ('rascunho', 'em_revisao', 'aprovada', 'devolvida', 'enviada')),
  constraint "CK_RESPOSTARECURSO_STPASSOUREVISAO" check ("ST_PASSOU_REVISAO" in ('S', 'N')),
  constraint "CK_RESPOSTARECURSO_TAMANHOS" check (
    length("DS_FUNDAMENTACAO") <= 20000
    and length(btrim("DS_TEXTO_FINAL")) between 1 and 60000
    and coalesce(length("DS_COMENTARIO_REVISAO"), 0) <= 2000
  ),
  constraint "CK_RESPOSTARECURSO_REVISAO" check (
    ("DT_ENVIO_REVISAO" is null) = ("CO_USUARIO_ENVIO_REVISAO" is null)
    and ("DT_REVISAO" is null) = ("CO_USUARIO_REVISOR" is null)
    and ("TP_ESTADO" <> 'em_revisao' or "DT_ENVIO_REVISAO" is not null)
    and ("TP_ESTADO" not in ('aprovada', 'devolvida', 'enviada') or "CO_USUARIO_REVISOR" is not null)
    and ("TP_ESTADO" <> 'devolvida' or "DS_COMENTARIO_REVISAO" is not null)
  ),
  constraint "CK_RESPOSTARECURSO_ENVIO" check (
    ("TP_ESTADO" = 'enviada') = ("DT_ENVIO" is not null)
    and ("DT_ENVIO" is null) = ("CO_USUARIO_ENVIO" is null)
  )
);
comment on table public."TB_RESPOSTA_RECURSO" is
  'Resposta escrita a um recurso (uma por recurso): modelo e versão usados, fundamentação, texto final e o fluxo rascunho → (revisão) → aprovada → enviada.';
comment on column public."TB_RESPOSTA_RECURSO"."CO_RESPOSTA_RECURSO" is 'Identificador da resposta.';
comment on column public."TB_RESPOSTA_RECURSO"."CO_RECURSO_CANDIDATO" is 'Recurso respondido (TB_RECURSO_CANDIDATO).';
comment on column public."TB_RESPOSTA_RECURSO"."CO_MODELO_RESPOSTA" is 'Modelo usado (TB_MODELO_RESPOSTA_RECURSO).';
comment on column public."TB_RESPOSTA_RECURSO"."NU_VERSAO_MODELO" is 'Versão do modelo usada no texto.';
comment on column public."TB_RESPOSTA_RECURSO"."DS_FUNDAMENTACAO" is 'Fundamentação escrita pelo analista (entra no marcador {fundamentacao}).';
comment on column public."TB_RESPOSTA_RECURSO"."DS_TEXTO_FINAL" is 'Texto final, com os marcadores preenchidos (o que o revisor aprova e o documento leva).';
comment on column public."TB_RESPOSTA_RECURSO"."TP_ESTADO" is 'rascunho, em_revisao, aprovada, devolvida ou enviada.';
comment on column public."TB_RESPOSTA_RECURSO"."ST_PASSOU_REVISAO" is 'S: já foi enviada para revisão alguma vez (a partir daí, quem escreveu não aprova).';
comment on column public."TB_RESPOSTA_RECURSO"."CO_USUARIO_AUTOR" is 'Quem gravou o texto por último (auth.users.id).';
comment on column public."TB_RESPOSTA_RECURSO"."DT_ENVIO_REVISAO" is 'Último envio para revisão (quando).';
comment on column public."TB_RESPOSTA_RECURSO"."CO_USUARIO_ENVIO_REVISAO" is 'Último envio para revisão (quem, auth.users.id).';
comment on column public."TB_RESPOSTA_RECURSO"."DT_REVISAO" is 'Última decisão de revisão — aprovação ou devolução (quando).';
comment on column public."TB_RESPOSTA_RECURSO"."CO_USUARIO_REVISOR" is 'Quem aprovou ou devolveu por último (auth.users.id).';
comment on column public."TB_RESPOSTA_RECURSO"."DS_COMENTARIO_REVISAO" is 'Comentário da última aprovação, devolução ou reabertura.';
comment on column public."TB_RESPOSTA_RECURSO"."DT_ENVIO" is 'Quando a resposta foi marcada como enviada ao candidato.';
comment on column public."TB_RESPOSTA_RECURSO"."CO_USUARIO_ENVIO" is 'Quem marcou a resposta como enviada (auth.users.id).';
comment on column public."TB_RESPOSTA_RECURSO"."NU_REVISAO" is 'Revisão da linha: grava só se a revisão enviada for a atual.';
comment on column public."TB_RESPOSTA_RECURSO"."DT_CRIACAO" is 'Quando a resposta foi criada.';
comment on column public."TB_RESPOSTA_RECURSO"."CO_USUARIO_CRIACAO" is 'Quem criou (auth.users.id).';
comment on column public."TB_RESPOSTA_RECURSO"."DT_ATUALIZACAO" is 'Última alteração.';
comment on column public."TB_RESPOSTA_RECURSO"."CO_USUARIO_ATUALIZACAO" is 'Autor da última alteração (auth.users.id).';
comment on constraint "UK_RESPOSTARECURSO_CORECURSO" on public."TB_RESPOSTA_RECURSO" is 'Uma resposta por recurso.';
comment on constraint "FK_RECURSOCANDIDATO_RESPOSTARECURSO" on public."TB_RESPOSTA_RECURSO" is 'Recurso da resposta.';
comment on constraint "FK_MODELORESPOSTA_RESPOSTARECURSO" on public."TB_RESPOSTA_RECURSO" is 'Versão do modelo usada.';
comment on constraint "CK_RESPOSTARECURSO_TPESTADO" on public."TB_RESPOSTA_RECURSO" is 'Estados da resposta.';
comment on constraint "CK_RESPOSTARECURSO_STPASSOUREVISAO" on public."TB_RESPOSTA_RECURSO" is 'Flag S/N.';
comment on constraint "CK_RESPOSTARECURSO_TAMANHOS" on public."TB_RESPOSTA_RECURSO" is 'Fundamentação até 20.000, texto final de 1 a 60.000 e comentário até 2.000 caracteres.';
comment on constraint "CK_RESPOSTARECURSO_REVISAO" on public."TB_RESPOSTA_RECURSO" is 'Quando e quem juntos; em revisão tem envio; aprovada, devolvida e enviada têm revisor; devolvida tem comentário.';
comment on constraint "CK_RESPOSTARECURSO_ENVIO" on public."TB_RESPOSTA_RECURSO" is 'Só a enviada tem data e autor do envio.';
create index "IN_FKRESPOSTARECURSO_COMODELO" on public."TB_RESPOSTA_RECURSO" ("CO_MODELO_RESPOSTA", "NU_VERSAO_MODELO");
comment on index public."IN_FKRESPOSTARECURSO_COMODELO" is 'Chave estrangeira para TB_MODELO_RESPOSTA_RECURSO.';

create table public."TH_RESPOSTA_RECURSO" (
  "CO_HISTORICO_RESPOSTA" bigint generated always as identity,
  "CO_RESPOSTA_RECURSO" uuid not null,
  "TP_ACAO" text not null,
  "TP_ESTADO_ANTERIOR" text,
  "TP_ESTADO_NOVO" text not null,
  "DS_COMENTARIO" text,
  "CO_MODELO_RESPOSTA" uuid not null,
  "NU_VERSAO_MODELO" integer not null,
  "DS_TEXTO_FINAL" text not null,
  "NU_REVISAO" integer not null,
  "DT_ACAO" timestamptz not null default now(),
  "CO_USUARIO" uuid not null,
  constraint "PK_TH_RESPOSTA_RECURSO" primary key ("CO_HISTORICO_RESPOSTA"),
  constraint "FK_RESPOSTARECURSO_HISTRESPOSTA" foreign key ("CO_RESPOSTA_RECURSO") references public."TB_RESPOSTA_RECURSO" ("CO_RESPOSTA_RECURSO"),
  constraint "CK_HISTRESPOSTA_TPACAO" check ("TP_ACAO" in ('criacao', 'edicao', 'enviar_revisao', 'aprovar', 'devolver', 'reabrir', 'marcar_enviada'))
);
comment on table public."TH_RESPOSTA_RECURSO" is 'Histórico (auditoria) da resposta: cada gravação e transição, com o texto final daquele momento.';
comment on column public."TH_RESPOSTA_RECURSO"."CO_HISTORICO_RESPOSTA" is 'Identificador do registro de histórico.';
comment on column public."TH_RESPOSTA_RECURSO"."CO_RESPOSTA_RECURSO" is 'Resposta (TB_RESPOSTA_RECURSO).';
comment on column public."TH_RESPOSTA_RECURSO"."TP_ACAO" is 'criacao, edicao, enviar_revisao, aprovar, devolver, reabrir ou marcar_enviada.';
comment on column public."TH_RESPOSTA_RECURSO"."TP_ESTADO_ANTERIOR" is 'Estado antes (nulo na criação).';
comment on column public."TH_RESPOSTA_RECURSO"."TP_ESTADO_NOVO" is 'Estado depois.';
comment on column public."TH_RESPOSTA_RECURSO"."DS_COMENTARIO" is 'Comentário da revisão, devolução ou reabertura.';
comment on column public."TH_RESPOSTA_RECURSO"."CO_MODELO_RESPOSTA" is 'Modelo usado naquele momento.';
comment on column public."TH_RESPOSTA_RECURSO"."NU_VERSAO_MODELO" is 'Versão do modelo naquele momento.';
comment on column public."TH_RESPOSTA_RECURSO"."DS_TEXTO_FINAL" is 'Texto final naquele momento (o que foi aprovado, devolvido ou enviado).';
comment on column public."TH_RESPOSTA_RECURSO"."NU_REVISAO" is 'Revisão da resposta depois da ação.';
comment on column public."TH_RESPOSTA_RECURSO"."DT_ACAO" is 'Quando.';
comment on column public."TH_RESPOSTA_RECURSO"."CO_USUARIO" is 'Quem (auth.users.id).';
comment on constraint "FK_RESPOSTARECURSO_HISTRESPOSTA" on public."TH_RESPOSTA_RECURSO" is 'Resposta do registro.';
comment on constraint "CK_HISTRESPOSTA_TPACAO" on public."TH_RESPOSTA_RECURSO" is 'Ações registradas.';
create index "IN_FKHISTRESPOSTA_CORESPOSTA" on public."TH_RESPOSTA_RECURSO" ("CO_RESPOSTA_RECURSO", "DT_ACAO" desc);
comment on index public."IN_FKHISTRESPOSTA_CORESPOSTA" is 'Histórico de uma resposta, do mais recente ao mais antigo.';

-- 4. Anexos do recurso ---------------------------------------------------------------
create table public."TB_ANEXO_RECURSO" (
  "CO_ANEXO_RECURSO" uuid not null default gen_random_uuid(),
  "CO_RECURSO_CANDIDATO" uuid not null,
  "CO_RESPOSTA_RECURSO" uuid,
  "TP_ANEXO" text not null,
  "NO_ARQUIVO" text not null,
  "DS_CAMINHO" text not null,
  "QT_BYTES" bigint not null,
  "DS_MIME" text not null,
  "ST_ATIVO" varchar(1) not null default 'S',
  "DS_MOTIVO_ARQUIVAMENTO" text,
  "DT_ARQUIVAMENTO" timestamptz,
  "CO_USUARIO_ARQUIVAMENTO" uuid,
  "DT_INCLUSAO" timestamptz not null default now(),
  "CO_USUARIO_INCLUSAO" uuid not null,
  constraint "PK_TB_ANEXO_RECURSO" primary key ("CO_ANEXO_RECURSO"),
  constraint "UK_ANEXORECURSO_DSCAMINHO" unique ("DS_CAMINHO"),
  constraint "FK_RECURSOCANDIDATO_ANEXORECURSO" foreign key ("CO_RECURSO_CANDIDATO") references public."TB_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO"),
  constraint "FK_RESPOSTARECURSO_ANEXORECURSO" foreign key ("CO_RESPOSTA_RECURSO") references public."TB_RESPOSTA_RECURSO" ("CO_RESPOSTA_RECURSO"),
  constraint "CK_ANEXORECURSO_TPANEXO" check ("TP_ANEXO" in ('recurso_candidato', 'resposta', 'documento', 'outro')),
  constraint "CK_ANEXORECURSO_DSMIME" check ("DS_MIME" in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'image/jpeg',
    'image/png',
    'application/vnd.oasis.opendocument.text')),
  constraint "CK_ANEXORECURSO_QTBYTES" check ("QT_BYTES" between 1 and 20971520),
  constraint "CK_ANEXORECURSO_STATIVO" check ("ST_ATIVO" in ('S', 'N')),
  constraint "CK_ANEXORECURSO_TAMANHOS" check (
    length(btrim("NO_ARQUIVO")) between 1 and 200
    and length("DS_CAMINHO") <= 400
    and coalesce(length("DS_MOTIVO_ARQUIVAMENTO"), 0) <= 500
  ),
  constraint "CK_ANEXORECURSO_ARQUIVAMENTO" check (
    ("ST_ATIVO" = 'S') = ("DT_ARQUIVAMENTO" is null)
    and ("DT_ARQUIVAMENTO" is null) = ("DS_MOTIVO_ARQUIVAMENTO" is null)
    and ("DT_ARQUIVAMENTO" is null) = ("CO_USUARIO_ARQUIVAMENTO" is null)
  )
);
comment on table public."TB_ANEXO_RECURSO" is
  'Arquivos anexados a um recurso (o recurso do candidato, a resposta, documentos). O arquivo fica no bucket privado recursos-anexos; aqui ficam os metadados. Arquivar não apaga o arquivo.';
comment on column public."TB_ANEXO_RECURSO"."CO_ANEXO_RECURSO" is 'Identificador do anexo.';
comment on column public."TB_ANEXO_RECURSO"."CO_RECURSO_CANDIDATO" is 'Recurso do anexo (TB_RECURSO_CANDIDATO).';
comment on column public."TB_ANEXO_RECURSO"."CO_RESPOSTA_RECURSO" is 'Resposta que gerou o documento (TB_RESPOSTA_RECURSO), quando o anexo é o documento da resposta.';
comment on column public."TB_ANEXO_RECURSO"."TP_ANEXO" is 'recurso_candidato, resposta, documento ou outro.';
comment on column public."TB_ANEXO_RECURSO"."NO_ARQUIVO" is 'Nome original do arquivo, como a pessoa enviou.';
comment on column public."TB_ANEXO_RECURSO"."DS_CAMINHO" is 'Caminho do objeto no bucket recursos-anexos: <área>/<recurso>/<uuid>-<nome seguro>.';
comment on column public."TB_ANEXO_RECURSO"."QT_BYTES" is 'Tamanho em bytes, lido do Storage no registro (até 20 MB).';
comment on column public."TB_ANEXO_RECURSO"."DS_MIME" is 'Tipo do arquivo, lido do Storage no registro.';
comment on column public."TB_ANEXO_RECURSO"."ST_ATIVO" is 'S: anexo válido; N: arquivado (o arquivo continua no bucket).';
comment on column public."TB_ANEXO_RECURSO"."DS_MOTIVO_ARQUIVAMENTO" is 'Motivo do arquivamento.';
comment on column public."TB_ANEXO_RECURSO"."DT_ARQUIVAMENTO" is 'Quando foi arquivado.';
comment on column public."TB_ANEXO_RECURSO"."CO_USUARIO_ARQUIVAMENTO" is 'Quem arquivou (auth.users.id).';
comment on column public."TB_ANEXO_RECURSO"."DT_INCLUSAO" is 'Quando foi anexado.';
comment on column public."TB_ANEXO_RECURSO"."CO_USUARIO_INCLUSAO" is 'Quem anexou (auth.users.id; o dono do objeto no Storage).';
comment on constraint "UK_ANEXORECURSO_DSCAMINHO" on public."TB_ANEXO_RECURSO" is 'Um registro por objeto do Storage.';
comment on constraint "FK_RECURSOCANDIDATO_ANEXORECURSO" on public."TB_ANEXO_RECURSO" is 'Recurso do anexo.';
comment on constraint "FK_RESPOSTARECURSO_ANEXORECURSO" on public."TB_ANEXO_RECURSO" is 'Resposta que gerou o documento.';
comment on constraint "CK_ANEXORECURSO_TPANEXO" on public."TB_ANEXO_RECURSO" is 'Tipos de anexo.';
comment on constraint "CK_ANEXORECURSO_DSMIME" on public."TB_ANEXO_RECURSO" is 'PDF, DOCX, DOC, JPG, PNG ou ODT (os mesmos do bucket).';
comment on constraint "CK_ANEXORECURSO_QTBYTES" on public."TB_ANEXO_RECURSO" is 'De 1 byte a 20 MB (o limite do bucket).';
comment on constraint "CK_ANEXORECURSO_STATIVO" on public."TB_ANEXO_RECURSO" is 'Flag S/N.';
comment on constraint "CK_ANEXORECURSO_TAMANHOS" on public."TB_ANEXO_RECURSO" is 'Nome de 1 a 200, caminho até 400 e motivo até 500 caracteres.';
comment on constraint "CK_ANEXORECURSO_ARQUIVAMENTO" on public."TB_ANEXO_RECURSO" is 'Arquivado guarda quando, quem e motivo juntos; ativo não guarda nenhum.';
create index "IN_FKANEXORECURSO_CORECURSO" on public."TB_ANEXO_RECURSO" ("CO_RECURSO_CANDIDATO");
comment on index public."IN_FKANEXORECURSO_CORECURSO" is 'Anexos de um recurso (detalhe e contagem da aba).';
create index "IN_FKANEXORECURSO_CORESPOSTA" on public."TB_ANEXO_RECURSO" ("CO_RESPOSTA_RECURSO") where "CO_RESPOSTA_RECURSO" is not null;
comment on index public."IN_FKANEXORECURSO_CORESPOSTA" is 'Chave estrangeira para TB_RESPOSTA_RECURSO.';

create table public."TH_ANEXO_RECURSO" (
  "CO_HISTORICO_ANEXO" bigint generated always as identity,
  "CO_ANEXO_RECURSO" uuid not null,
  "TP_ACAO" text not null,
  "DS_MOTIVO" text,
  "DT_ACAO" timestamptz not null default now(),
  "CO_USUARIO" uuid not null,
  constraint "PK_TH_ANEXO_RECURSO" primary key ("CO_HISTORICO_ANEXO"),
  constraint "FK_ANEXORECURSO_HISTANEXO" foreign key ("CO_ANEXO_RECURSO") references public."TB_ANEXO_RECURSO" ("CO_ANEXO_RECURSO"),
  constraint "CK_HISTANEXO_TPACAO" check ("TP_ACAO" in ('inclusao', 'download', 'arquivamento'))
);
comment on table public."TH_ANEXO_RECURSO" is 'Histórico (auditoria) dos anexos: inclusão, cada download (a URL assinada só sai depois deste registro) e arquivamento.';
comment on column public."TH_ANEXO_RECURSO"."CO_HISTORICO_ANEXO" is 'Identificador do registro de histórico.';
comment on column public."TH_ANEXO_RECURSO"."CO_ANEXO_RECURSO" is 'Anexo (TB_ANEXO_RECURSO).';
comment on column public."TH_ANEXO_RECURSO"."TP_ACAO" is 'inclusao, download ou arquivamento.';
comment on column public."TH_ANEXO_RECURSO"."DS_MOTIVO" is 'Motivo informado (arquivamento).';
comment on column public."TH_ANEXO_RECURSO"."DT_ACAO" is 'Quando.';
comment on column public."TH_ANEXO_RECURSO"."CO_USUARIO" is 'Quem (auth.users.id).';
comment on constraint "FK_ANEXORECURSO_HISTANEXO" on public."TH_ANEXO_RECURSO" is 'Anexo do registro.';
comment on constraint "CK_HISTANEXO_TPACAO" on public."TH_ANEXO_RECURSO" is 'Ações registradas.';
create index "IN_FKHISTANEXO_COANEXO" on public."TH_ANEXO_RECURSO" ("CO_ANEXO_RECURSO", "CO_USUARIO", "DT_ACAO" desc);
comment on index public."IN_FKHISTANEXO_COANEXO" is 'Histórico de um anexo por pessoa (a política de leitura do Storage procura o download recente).';

-- 5. Acesso: nenhuma leitura ou escrita direta; só as funções abaixo ---------------
alter table public."TB_MODELO_RESPOSTA_RECURSO" enable row level security;
alter table public."TB_RESPOSTA_RECURSO" enable row level security;
alter table public."TH_RESPOSTA_RECURSO" enable row level security;
alter table public."TB_ANEXO_RECURSO" enable row level security;
alter table public."TH_ANEXO_RECURSO" enable row level security;
revoke all on public."TB_MODELO_RESPOSTA_RECURSO", public."TB_RESPOSTA_RECURSO", public."TH_RESPOSTA_RECURSO", public."TB_ANEXO_RECURSO", public."TH_ANEXO_RECURSO" from public, anon, authenticated;

-- 6. Funções auxiliares (private) ---------------------------------------------------
create function private."FC_MARCADORES_MODELO_RESPOSTA"()
returns text[]
language sql
immutable
set search_path to ''
as $function$
  select array['nome_candidato', 'codigo_candidato', 'edital', 'unidade', 'cargo', 'vaga', 'origem',
               'nota_anterior', 'nota_atual', 'resultado_anterior', 'resultado_atual', 'data_hoje',
               'analista', 'fundamentacao']::text[];
$function$;
comment on function private."FC_MARCADORES_MODELO_RESPOSTA"() is
  'Marcadores aceitos no corpo dos modelos de resposta (os mesmos de src/lib/modelos-de-resposta.js).';

create function private."FC_EXIGIR_RECURSO_ACESSIVEL"(p_recurso uuid, p_minimo integer)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text;
  v_edital uuid;
begin
  select m."CO_AREA", r."CO_MONITORAMENTO" into v_area, v_edital
  from public."TB_RECURSO_CANDIDATO" r
  join public."TB_MONITORAMENTO_INDIGENA" m on m.id = r."CO_MONITORAMENTO"
  where r."CO_RECURSO_CANDIDATO" = p_recurso and r."ST_ATIVO" = 'S';
  if v_area is null then
    raise exception 'Recurso não encontrado' using errcode = 'P0002';
  end if;
  perform private."FC_EXIGIR_RECURSOS_NA_AREA"(v_area, p_minimo);
  perform private."FC_EXIGIR_AREA_EDITAL"(v_edital::text);
  return v_area;
end;
$function$;
comment on function private."FC_EXIGIR_RECURSO_ACESSIVEL"(uuid, integer) is
  'Devolve a área do recurso ativo depois de conferir o nível em recursos (1 leitor, 2 editor), a área (FC_EXIGIR_RECURSOS_NA_AREA) e a coordenação (FC_EXIGIR_AREA_EDITAL). P0002 se não existe; 42501 se não pode.';

create function private."FC_PODE_ANEXO_RECURSO"(p_caminho text, p_minimo integer)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce((
    select private.pode_recurso('recursos', p_minimo)
       and private."FC_PODE_VER_EDITAL"(r."CO_MONITORAMENTO")
    from public."TB_RECURSO_CANDIDATO" r
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id = r."CO_MONITORAMENTO"
    where cardinality(storage.foldername(p_caminho)) = 2
      and r."ST_ATIVO" = 'S'
      and r."CO_RECURSO_CANDIDATO"::text = (storage.foldername(p_caminho))[2]
      and m."CO_AREA" = (storage.foldername(p_caminho))[1]
  ), false);
$function$;
comment on function private."FC_PODE_ANEXO_RECURSO"(text, integer) is
  'Política do bucket recursos-anexos: o caminho é <área>/<recurso>/<arquivo>, o recurso está ativo e é da área do caminho, e quem pede tem recursos no nível pedido e vê o edital (área e coordenação).';

create function private."FC_PODE_BAIXAR_ANEXO_RECURSO"(p_caminho text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
      select 1
      from public."TB_ANEXO_RECURSO" a
      join public."TH_ANEXO_RECURSO" h on h."CO_ANEXO_RECURSO" = a."CO_ANEXO_RECURSO"
      where a."DS_CAMINHO" = p_caminho
        and h."TP_ACAO" = 'download'
        and h."CO_USUARIO" = (select auth.uid())
        and h."DT_ACAO" > now() - interval '5 minutes'
    )
    and private."FC_PODE_ANEXO_RECURSO"(p_caminho, 1);
$function$;
comment on function private."FC_PODE_BAIXAR_ANEXO_RECURSO"(text) is
  'Política de leitura do bucket recursos-anexos (é ela que libera a URL assinada): quem pede registrou o download do anexo pela RPC registrar_download_anexo_recurso nos últimos 5 minutos e continua com acesso ao recurso.';

revoke all on function private."FC_MARCADORES_MODELO_RESPOSTA"(), private."FC_EXIGIR_RECURSO_ACESSIVEL"(uuid, integer) from public, anon, authenticated;
-- As políticas do Storage rodam como authenticated: precisam executar as duas.
revoke all on function private."FC_PODE_ANEXO_RECURSO"(text, integer), private."FC_PODE_BAIXAR_ANEXO_RECURSO"(text) from public, anon;
grant execute on function private."FC_PODE_ANEXO_RECURSO"(text, integer), private."FC_PODE_BAIXAR_ANEXO_RECURSO"(text) to authenticated;

-- 7. Storage: bucket privado e políticas ---------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recursos-anexos', 'recursos-anexos', false, 20971520,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'image/jpeg',
    'image/png',
    'application/vnd.oasis.opendocument.text'
  ]::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists recursos_anexos_storage_select on storage.objects;
create policy recursos_anexos_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'recursos-anexos'
  and (
    private."FC_PODE_BAIXAR_ANEXO_RECURSO"(name)
    or (
      owner_id = (select auth.uid())::text
      and created_at > now() - interval '10 minutes'
      and private."FC_PODE_ANEXO_RECURSO"(name, 2)
    )
  )
);
comment on policy recursos_anexos_storage_select on storage.objects is
  'Anexos de recurso: lê (e gera URL assinada) quem registrou o download pela RPC nos últimos 5 minutos; e quem acabou de enviar o próprio arquivo (10 minutos, o insert do Storage devolve a linha).';

drop policy if exists recursos_anexos_storage_insert on storage.objects;
create policy recursos_anexos_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'recursos-anexos'
  and private."FC_PODE_ANEXO_RECURSO"(name, 2)
);
comment on policy recursos_anexos_storage_insert on storage.objects is
  'Anexos de recurso: envia quem tem recursos >= editor e vê o edital do recurso do caminho <área>/<recurso>/<arquivo>. Sem update/delete: nada se sobrescreve nem se apaga pela API.';

-- 8. Leitura da aba e detalhe: corpos de 20260929190200, acrescidos -----------------
create or replace function public.get_recursos_da_area(p_area text)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_pode_editar boolean;
begin
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  perform private."FC_EXIGIR_RECURSOS_NA_AREA"(p_area, 1);
  v_pode_editar := private.pode_recurso('recursos', 2);
  return (
    with recursos as (
      select r.*, m.edital, m.unidade,
             a.candidato, a.id_origem, a.nome_vaga, a.codigo_vaga,
             a.nota_final_ajustada, a.status_consolidado,
             (select s."TP_ESTADO" from public."TB_RESPOSTA_RECURSO" s
               where s."CO_RECURSO_CANDIDATO" = r."CO_RECURSO_CANDIDATO") as resposta_estado,
             (select count(*) from public."TB_ANEXO_RECURSO" x
               where x."CO_RECURSO_CANDIDATO" = r."CO_RECURSO_CANDIDATO" and x."ST_ATIVO" = 'S') as qt_anexos
      from public."TB_RECURSO_CANDIDATO" r
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = r."CO_MONITORAMENTO"
      left join public."TB_ANALISE_CURRICULAR" a on a.id = r."CO_ANALISE_CURRICULAR"
      where m."CO_AREA" = p_area
        and r."ST_ATIVO" = 'S'
        and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
    )
    select json_build_object(
      'schema_version', 1,
      'area', p_area,
      'pode_editar', v_pode_editar,
      'pode_administrar_modelos', private.pode_recurso('recursos', 3),
      'gerado_em', now(),
      'origens', (
        select coalesce(json_agg(json_build_object(
            'id', o."CO_ORIGEM_RECURSO",
            'rotulo', o."NO_ORIGEM_RECURSO",
            'ativo', o."ST_ATIVO" = 'S'
          ) order by o."NU_ORDEM"), '[]'::json)
        from public."TB_ORIGEM_RECURSO" o
      ),
      'editais', case when v_pode_editar then (
        select coalesce(json_agg(json_build_object(
            'id', m.id,
            'edital', m.edital,
            'unidade', m.unidade,
            'status', m.status,
            'tem_analises', exists (
              select 1 from public."TB_ANALISE_CURRICULAR" a
              where a.edital = m.edital and a."CO_AREA" = m."CO_AREA"
            )
          ) order by m.edital), '[]'::json)
        from public."TB_MONITORAMENTO_INDIGENA" m
        where m."CO_AREA" = p_area
          and m.ativo
          and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
      ) else '[]'::json end,
      'modelos', case when v_pode_editar then (
        select coalesce(json_agg(json_build_object(
            'id', t."CO_MODELO_RESPOSTA",
            'versao', t."NU_VERSAO",
            'area', t."CO_AREA",
            'origem', t."CO_ORIGEM_RECURSO",
            'situacao', t."TP_SITUACAO",
            'nome', t."NO_MODELO",
            'corpo', t."DS_CORPO"
          ) order by t."NO_MODELO"), '[]'::json)
        from public."TB_MODELO_RESPOSTA_RECURSO" t
        where t."ST_VIGENTE" = 'S'
          and t."ST_ATIVO" = 'S'
          and (t."CO_AREA" is null or t."CO_AREA" = p_area)
      ) else '[]'::json end,
      'recursos', (
        select coalesce(json_agg(json_build_object(
            'id', r."CO_RECURSO_CANDIDATO",
            'nu', r."NU_RECURSO",
            'edital_id', r."CO_MONITORAMENTO",
            'edital', r.edital,
            'unidade', r.unidade,
            'origem', r."CO_ORIGEM_RECURSO",
            'analise_id', r."CO_ANALISE_CURRICULAR",
            'fora_analise', r."ST_FORA_ANALISE" = 'S',
            'candidato', coalesce(r.candidato, r."NO_CANDIDATO_INFORMADO"),
            'codigo', coalesce(r.id_origem, r."CO_CANDIDATO_INFORMADO"),
            'cargo', coalesce(r.nome_vaga, r."NO_CARGO_INFORMADO"),
            'vaga', coalesce(r.codigo_vaga, r."CO_VAGA_INFORMADA"),
            'nota_anterior', r."VL_NOTA_ANTERIOR",
            'nota_atual', r.nota_final_ajustada,
            'resultado_anterior', r."DS_RESULTADO_ANTERIOR",
            'resultado_atual', r.status_consolidado,
            'analista', r."NO_ANALISTA",
            'situacao', r."TP_SITUACAO",
            'processo_sei', r."NU_PROCESSO_SEI",
            'mudou_classificacao', r."ST_MUDOU_CLASSIFICACAO" = 'S',
            'download_empregare_em', r."DT_DOWNLOAD_EMPREGARE",
            'processo_sei_em', r."DT_PROCESSO_SEI",
            'upload_sei_em', r."DT_UPLOAD_SEI",
            'resposta_candidato_em', r."DT_RESPOSTA_CANDIDATO",
            'decisao_em', r."DT_DECISAO",
            'criado_em', r."DT_CRIACAO",
            'atualizado_em', r."DT_ATUALIZACAO",
            'revisao', r."NU_REVISAO",
            'resposta_estado', r.resposta_estado,
            'qt_anexos', r.qt_anexos
          ) order by r."NU_RECURSO" desc), '[]'::json)
        from recursos r
      ),
      'cronogramas', (
        select coalesce(json_agg(json_build_object(
            'edital_id', c.monitoramento_id,
            'ordem', c.ordem,
            'atividade', c.atividade,
            'inicio', c.data_inicio,
            'fim', c.data_fim
          ) order by c.monitoramento_id, c.ordem), '[]'::json)
        from public."TB_CRONOGRAMA_MONIT_INDIG" c
        where c.monitoramento_id in (select r."CO_MONITORAMENTO" from recursos r)
      )
    )
  );
end;
$function$;

create or replace function public.get_recurso_candidato_detalhe(p_id uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text;
begin
  select m."CO_AREA" into v_area
  from public."TB_RECURSO_CANDIDATO" r
  join public."TB_MONITORAMENTO_INDIGENA" m on m.id = r."CO_MONITORAMENTO"
  where r."CO_RECURSO_CANDIDATO" = p_id and r."ST_ATIVO" = 'S';
  if v_area is null then
    raise exception 'Recurso não encontrado' using errcode = 'P0002';
  end if;
  perform private."FC_EXIGIR_RECURSOS_NA_AREA"(v_area, 1);
  perform private."FC_EXIGIR_AREA_EDITAL"((select r."CO_MONITORAMENTO"::text from public."TB_RECURSO_CANDIDATO" r where r."CO_RECURSO_CANDIDATO" = p_id));
  return (
    select json_build_object(
      'id', r."CO_RECURSO_CANDIDATO",
      'eu', (select auth.uid()),
      'observacao', r."DS_OBSERVACAO",
      'modalidade', a.modalidade_concorrencia,
      'responsavel_analise', a.responsavel_analise,
      'analise_ativa', a.ativo,
      'nome_informado', r."NO_CANDIDATO_INFORMADO",
      'codigo_informado', r."CO_CANDIDATO_INFORMADO",
      'cargo_informado', r."NO_CARGO_INFORMADO",
      'vaga_informada', r."CO_VAGA_INFORMADA",
      'criado_por', private."FC_NOME_USUARIO"(r."CO_USUARIO_CRIACAO"),
      'decisao_por', private."FC_NOME_USUARIO"(r."CO_USUARIO_DECISAO"),
      'etapas', json_build_object(
        'download_empregare', private."FC_NOME_USUARIO"(r."CO_USUARIO_DOWNLOAD_EMPREGARE"),
        'processo_sei', private."FC_NOME_USUARIO"(r."CO_USUARIO_PROCESSO_SEI"),
        'upload_sei', private."FC_NOME_USUARIO"(r."CO_USUARIO_UPLOAD_SEI"),
        'resposta_candidato', private."FC_NOME_USUARIO"(r."CO_USUARIO_RESPOSTA_CANDIDATO")
      ),
      'historico', (
        select coalesce(json_agg(json_build_object(
            'em', h."DT_ALTERACAO",
            'acao', h."TP_ACAO",
            'campo', h."DS_CAMPO",
            'anterior', h."DS_VALOR_ANTERIOR",
            'novo', h."DS_VALOR_NOVO",
            'motivo', h."DS_MOTIVO",
            'autor', private."FC_NOME_USUARIO"(h."CO_USUARIO")
          ) order by h."DT_ALTERACAO" desc, h."CO_HISTORICO_RECURSO" desc), '[]'::json)
        from public."TH_RECURSO_CANDIDATO" h
        where h."CO_RECURSO_CANDIDATO" = r."CO_RECURSO_CANDIDATO"
      ),
      'anexos', (
        select coalesce(json_agg(json_build_object(
            'id', x."CO_ANEXO_RECURSO",
            'tipo', x."TP_ANEXO",
            'nome', x."NO_ARQUIVO",
            'bytes', x."QT_BYTES",
            'mime', x."DS_MIME",
            'ativo', x."ST_ATIVO" = 'S',
            'resposta_id', x."CO_RESPOSTA_RECURSO",
            'incluido_em', x."DT_INCLUSAO",
            'incluido_por', private."FC_NOME_USUARIO"(x."CO_USUARIO_INCLUSAO"),
            'arquivado_em', x."DT_ARQUIVAMENTO",
            'arquivado_por', private."FC_NOME_USUARIO"(x."CO_USUARIO_ARQUIVAMENTO"),
            'motivo_arquivamento', x."DS_MOTIVO_ARQUIVAMENTO"
          ) order by x."ST_ATIVO" desc, x."DT_INCLUSAO" desc), '[]'::json)
        from public."TB_ANEXO_RECURSO" x
        where x."CO_RECURSO_CANDIDATO" = r."CO_RECURSO_CANDIDATO"
      ),
      'resposta', (
        select json_build_object(
          'id', s."CO_RESPOSTA_RECURSO",
          'modelo_id', s."CO_MODELO_RESPOSTA",
          'modelo_versao', s."NU_VERSAO_MODELO",
          'modelo_nome', t."NO_MODELO",
          'modelo_situacao', t."TP_SITUACAO",
          'modelo_vigente', t."ST_VIGENTE" = 'S',
          'modelo_corpo', t."DS_CORPO",
          'fundamentacao', s."DS_FUNDAMENTACAO",
          'texto_final', s."DS_TEXTO_FINAL",
          'estado', s."TP_ESTADO",
          'passou_revisao', s."ST_PASSOU_REVISAO" = 'S',
          'autor_id', s."CO_USUARIO_AUTOR",
          'autor', private."FC_NOME_USUARIO"(s."CO_USUARIO_AUTOR"),
          'envio_revisao_em', s."DT_ENVIO_REVISAO",
          'envio_revisao_por_id', s."CO_USUARIO_ENVIO_REVISAO",
          'envio_revisao_por', private."FC_NOME_USUARIO"(s."CO_USUARIO_ENVIO_REVISAO"),
          'revisor_id', s."CO_USUARIO_REVISOR",
          'revisor', private."FC_NOME_USUARIO"(s."CO_USUARIO_REVISOR"),
          'revisao_em', s."DT_REVISAO",
          'comentario_revisao', s."DS_COMENTARIO_REVISAO",
          'enviada_em', s."DT_ENVIO",
          'enviada_por', private."FC_NOME_USUARIO"(s."CO_USUARIO_ENVIO"),
          'revisao', s."NU_REVISAO",
          'criado_em', s."DT_CRIACAO",
          'atualizado_em', s."DT_ATUALIZACAO",
          'historico', (
            select coalesce(json_agg(json_build_object(
                'em', h."DT_ACAO",
                'acao', h."TP_ACAO",
                'anterior', h."TP_ESTADO_ANTERIOR",
                'novo', h."TP_ESTADO_NOVO",
                'comentario', h."DS_COMENTARIO",
                'versao_modelo', h."NU_VERSAO_MODELO",
                'autor', private."FC_NOME_USUARIO"(h."CO_USUARIO")
              ) order by h."DT_ACAO" desc, h."CO_HISTORICO_RESPOSTA" desc), '[]'::json)
            from public."TH_RESPOSTA_RECURSO" h
            where h."CO_RESPOSTA_RECURSO" = s."CO_RESPOSTA_RECURSO"
          )
        )
        from public."TB_RESPOSTA_RECURSO" s
        join public."TB_MODELO_RESPOSTA_RECURSO" t
          on t."CO_MODELO_RESPOSTA" = s."CO_MODELO_RESPOSTA" and t."NU_VERSAO" = s."NU_VERSAO_MODELO"
        where s."CO_RECURSO_CANDIDATO" = r."CO_RECURSO_CANDIDATO"
      )
    )
    from public."TB_RECURSO_CANDIDATO" r
    left join public."TB_ANALISE_CURRICULAR" a on a.id = r."CO_ANALISE_CURRICULAR"
    where r."CO_RECURSO_CANDIDATO" = p_id
  );
end;
$function$;

-- 9. Modelos de resposta: RPCs de administração ------------------------------------
create function public.listar_modelos_resposta_recurso()
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not private.pode_recurso('recursos', 3) then
    raise exception 'Só a administração de Recursos gerencia os modelos de resposta' using errcode = '42501';
  end if;
  return json_build_object(
    'marcadores', to_json(private."FC_MARCADORES_MODELO_RESPOSTA"()),
    'areas', (
      select coalesce(json_agg(json_build_object('id', a."CO_AREA", 'rotulo', a."NO_AREA") order by a."NU_ORDEM"), '[]'::json)
      from public."TB_AREA" a
      where private."FC_PODE_AREA"(a."CO_AREA")
    ),
    'origens', (
      select coalesce(json_agg(json_build_object('id', o."CO_ORIGEM_RECURSO", 'rotulo', o."NO_ORIGEM_RECURSO", 'ativo', o."ST_ATIVO" = 'S') order by o."NU_ORDEM"), '[]'::json)
      from public."TB_ORIGEM_RECURSO" o
    ),
    'modelos', (
      select coalesce(json_agg(json_build_object(
          'id', t."CO_MODELO_RESPOSTA",
          'versao', t."NU_VERSAO",
          'area', t."CO_AREA",
          'origem', t."CO_ORIGEM_RECURSO",
          'situacao', t."TP_SITUACAO",
          'nome', t."NO_MODELO",
          'corpo', t."DS_CORPO",
          'ativo', t."ST_ATIVO" = 'S',
          'motivo_arquivamento', t."DS_MOTIVO_ARQUIVAMENTO",
          'arquivado_em', t."DT_ARQUIVAMENTO",
          'arquivado_por', private."FC_NOME_USUARIO"(t."CO_USUARIO_ARQUIVAMENTO"),
          'criado_em', t."DT_CRIACAO",
          'criado_por', private."FC_NOME_USUARIO"(t."CO_USUARIO_CRIACAO"),
          'em_uso', (select count(*) from public."TB_RESPOSTA_RECURSO" s where s."CO_MODELO_RESPOSTA" = t."CO_MODELO_RESPOSTA"),
          'versoes', (
            select coalesce(json_agg(json_build_object(
                'versao', v."NU_VERSAO",
                'criado_em', v."DT_CRIACAO",
                'criado_por', private."FC_NOME_USUARIO"(v."CO_USUARIO_CRIACAO")
              ) order by v."NU_VERSAO" desc), '[]'::json)
            from public."TB_MODELO_RESPOSTA_RECURSO" v
            where v."CO_MODELO_RESPOSTA" = t."CO_MODELO_RESPOSTA"
          )
        ) order by t."ST_ATIVO" desc, t."NO_MODELO"), '[]'::json)
      from public."TB_MODELO_RESPOSTA_RECURSO" t
      where t."ST_VIGENTE" = 'S'
        and (t."CO_AREA" is null or private."FC_PODE_AREA"(t."CO_AREA"))
    )
  );
end;
$function$;
comment on function public.listar_modelos_resposta_recurso() is
  'Modelos de resposta (versão vigente, ativos e arquivados) com as versões anteriores, as áreas, as origens e os marcadores aceitos. Exige recursos = admin.';

create function public.salvar_modelo_resposta_recurso(p_dados jsonb)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid := nullif(p_dados->>'id', '')::uuid;
  v_area text := nullif(btrim(coalesce(p_dados->>'area', '')), '');
  v_origem text := nullif(btrim(coalesce(p_dados->>'origem', '')), '');
  v_situacao text := p_dados->>'situacao';
  v_nome text := btrim(coalesce(p_dados->>'nome', ''));
  v_corpo text := btrim(coalesce(p_dados->>'corpo', ''));
  v_atual public."TB_MODELO_RESPOSTA_RECURSO";
  v_desconhecidos text[];
begin
  if not private.pode_recurso('recursos', 3) then
    raise exception 'Só a administração de Recursos gerencia os modelos de resposta' using errcode = '42501';
  end if;
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  if v_area is not null then
    if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
      raise exception 'Área inválida' using errcode = '22023';
    end if;
    if not private."FC_PODE_AREA"(v_area) then
      raise exception 'Sem acesso a esta área' using errcode = '42501';
    end if;
  end if;
  if v_origem is not null and not exists (select 1 from public."TB_ORIGEM_RECURSO" o where o."CO_ORIGEM_RECURSO" = v_origem) then
    raise exception 'Origem inválida' using errcode = '22023';
  end if;
  if v_situacao is null or v_situacao not in ('DEFERIDO', 'INDEFERIDO', 'PARCIALMENTE_INDEFERIDO') then
    raise exception 'Situação inválida' using errcode = '22023';
  end if;
  if length(v_nome) not between 3 and 150 then
    raise exception 'O nome do modelo deve ter de 3 a 150 caracteres' using errcode = '22023';
  end if;
  if length(v_corpo) not between 20 and 20000 then
    raise exception 'O texto do modelo deve ter de 20 a 20.000 caracteres' using errcode = '22023';
  end if;
  select array_agg(distinct m[1] order by m[1]) into v_desconhecidos
  from regexp_matches(v_corpo, '\{([a-z_]+)\}', 'g') m
  where m[1] <> all (private."FC_MARCADORES_MODELO_RESPOSTA"());
  if v_desconhecidos is not null then
    raise exception 'Marcador desconhecido no modelo: %', array_to_string(v_desconhecidos, ', ') using errcode = '22023';
  end if;

  if v_id is null then
    v_id := gen_random_uuid();
    insert into public."TB_MODELO_RESPOSTA_RECURSO" (
      "CO_MODELO_RESPOSTA", "NU_VERSAO", "CO_AREA", "CO_ORIGEM_RECURSO", "TP_SITUACAO",
      "NO_MODELO", "DS_CORPO", "CO_USUARIO_CRIACAO"
    ) values (v_id, 1, v_area, v_origem, v_situacao, v_nome, v_corpo, v_uid);
    return json_build_object('id', v_id, 'versao', 1, 'criou_versao', true);
  end if;

  select t.* into v_atual
  from public."TB_MODELO_RESPOSTA_RECURSO" t
  where t."CO_MODELO_RESPOSTA" = v_id and t."ST_VIGENTE" = 'S'
  for update;
  if not found then
    raise exception 'Modelo não encontrado' using errcode = 'P0002';
  end if;
  if v_atual."CO_AREA" is not null and not private."FC_PODE_AREA"(v_atual."CO_AREA") then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  if p_dados->>'versao' is null or (p_dados->>'versao')::integer <> v_atual."NU_VERSAO" then
    raise exception 'Outra pessoa alterou este modelo. Recarregue e tente de novo.' using errcode = '40001';
  end if;
  if v_atual."ST_ATIVO" = 'S'
     and v_atual."CO_AREA" is not distinct from v_area
     and v_atual."CO_ORIGEM_RECURSO" is not distinct from v_origem
     and v_atual."TP_SITUACAO" = v_situacao
     and v_atual."NO_MODELO" = v_nome
     and v_atual."DS_CORPO" = v_corpo then
    return json_build_object('id', v_id, 'versao', v_atual."NU_VERSAO", 'criou_versao', false);
  end if;

  update public."TB_MODELO_RESPOSTA_RECURSO" set "ST_VIGENTE" = 'N'
  where "CO_MODELO_RESPOSTA" = v_id and "NU_VERSAO" = v_atual."NU_VERSAO";
  insert into public."TB_MODELO_RESPOSTA_RECURSO" (
    "CO_MODELO_RESPOSTA", "NU_VERSAO", "CO_AREA", "CO_ORIGEM_RECURSO", "TP_SITUACAO",
    "NO_MODELO", "DS_CORPO", "CO_USUARIO_CRIACAO"
  ) values (v_id, v_atual."NU_VERSAO" + 1, v_area, v_origem, v_situacao, v_nome, v_corpo, v_uid);
  return json_build_object('id', v_id, 'versao', v_atual."NU_VERSAO" + 1, 'criou_versao', true);
end;
$function$;
comment on function public.salvar_modelo_resposta_recurso(jsonb) is
  'Cria um modelo (sem id) ou grava a versão seguinte (id + versao atual; 40001 se outra pessoa gravou antes). Sem mudança, não cria versão; salvar um arquivado o reativa. Confere área, origem, situação, tamanhos e marcadores. Exige recursos = admin.';

create function public.arquivar_modelo_resposta_recurso(p_modelo_id uuid, p_motivo text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_atual public."TB_MODELO_RESPOSTA_RECURSO";
begin
  if not private.pode_recurso('recursos', 3) then
    raise exception 'Só a administração de Recursos gerencia os modelos de resposta' using errcode = '42501';
  end if;
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 500 then
    raise exception 'Informe um motivo entre 3 e 500 caracteres' using errcode = '22023';
  end if;
  select t.* into v_atual
  from public."TB_MODELO_RESPOSTA_RECURSO" t
  where t."CO_MODELO_RESPOSTA" = p_modelo_id and t."ST_VIGENTE" = 'S'
  for update;
  if not found then
    raise exception 'Modelo não encontrado' using errcode = 'P0002';
  end if;
  if v_atual."CO_AREA" is not null and not private."FC_PODE_AREA"(v_atual."CO_AREA") then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  if v_atual."ST_ATIVO" = 'N' then
    return json_build_object('id', p_modelo_id, 'arquivado', true, 'alterou', false);
  end if;
  update public."TB_MODELO_RESPOSTA_RECURSO" set
    "ST_ATIVO" = 'N',
    "DS_MOTIVO_ARQUIVAMENTO" = btrim(p_motivo),
    "DT_ARQUIVAMENTO" = now(),
    "CO_USUARIO_ARQUIVAMENTO" = v_uid
  where "CO_MODELO_RESPOSTA" = p_modelo_id and "NU_VERSAO" = v_atual."NU_VERSAO";
  return json_build_object('id', p_modelo_id, 'arquivado', true, 'alterou', true);
end;
$function$;
comment on function public.arquivar_modelo_resposta_recurso(uuid, text) is
  'Arquiva (lógico, com motivo) a versão vigente do modelo: some da escolha, continua nas respostas que o usaram. Exige recursos = admin.';

-- 10. Resposta do recurso ------------------------------------------------------------
create function public.salvar_resposta_recurso(p_dados jsonb)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_recurso uuid := nullif(p_dados->>'recurso_id', '')::uuid;
  v_modelo uuid := nullif(p_dados->>'modelo_id', '')::uuid;
  v_versao integer := nullif(p_dados->>'modelo_versao', '')::integer;
  v_fundamentacao text := coalesce(p_dados->>'fundamentacao', '');
  v_texto text := coalesce(p_dados->>'texto_final', '');
  v_area text;
  v_rec public."TB_RECURSO_CANDIDATO";
  v_modelo_linha public."TB_MODELO_RESPOSTA_RECURSO";
  v_atual public."TB_RESPOSTA_RECURSO";
  v_id uuid;
  v_revisao integer;
begin
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  if v_recurso is null then
    raise exception 'Informe o recurso' using errcode = '22023';
  end if;
  v_area := private."FC_EXIGIR_RECURSO_ACESSIVEL"(v_recurso, 2);
  select r.* into v_rec from public."TB_RECURSO_CANDIDATO" r
  where r."CO_RECURSO_CANDIDATO" = v_recurso for update;
  if length(v_fundamentacao) > 20000 then
    raise exception 'A fundamentação passa de 20.000 caracteres' using errcode = '22023';
  end if;
  if length(btrim(v_texto)) not between 1 and 60000 then
    raise exception 'O texto da resposta deve ter de 1 a 60.000 caracteres' using errcode = '22023';
  end if;

  select s.* into v_atual from public."TB_RESPOSTA_RECURSO" s
  where s."CO_RECURSO_CANDIDATO" = v_recurso for update;

  select t.* into v_modelo_linha from public."TB_MODELO_RESPOSTA_RECURSO" t
  where t."CO_MODELO_RESPOSTA" = v_modelo and t."NU_VERSAO" = v_versao;
  if not found then
    raise exception 'Modelo de resposta não encontrado' using errcode = '22023';
  end if;
  -- Modelo novo na resposta: só a versão vigente, ativa, da área e da origem do recurso.
  if v_atual."CO_RESPOSTA_RECURSO" is null
     or v_atual."CO_MODELO_RESPOSTA" <> v_modelo
     or v_atual."NU_VERSAO_MODELO" <> v_versao then
    if v_modelo_linha."ST_VIGENTE" <> 'S' or v_modelo_linha."ST_ATIVO" <> 'S' then
      raise exception 'Este modelo foi alterado ou arquivado. Escolha de novo.' using errcode = '22023';
    end if;
    if v_modelo_linha."CO_AREA" is not null and v_modelo_linha."CO_AREA" <> v_area then
      raise exception 'O modelo é de outra área' using errcode = '22023';
    end if;
    if v_modelo_linha."CO_ORIGEM_RECURSO" is not null and v_modelo_linha."CO_ORIGEM_RECURSO" <> v_rec."CO_ORIGEM_RECURSO" then
      raise exception 'O modelo é de outra origem de recurso' using errcode = '22023';
    end if;
  end if;

  if v_atual."CO_RESPOSTA_RECURSO" is null then
    insert into public."TB_RESPOSTA_RECURSO" (
      "CO_RECURSO_CANDIDATO", "CO_MODELO_RESPOSTA", "NU_VERSAO_MODELO", "DS_FUNDAMENTACAO",
      "DS_TEXTO_FINAL", "CO_USUARIO_AUTOR", "CO_USUARIO_CRIACAO", "CO_USUARIO_ATUALIZACAO"
    ) values (v_recurso, v_modelo, v_versao, v_fundamentacao, v_texto, v_uid, v_uid, v_uid)
    returning "CO_RESPOSTA_RECURSO", "NU_REVISAO" into v_id, v_revisao;
    insert into public."TH_RESPOSTA_RECURSO" (
      "CO_RESPOSTA_RECURSO", "TP_ACAO", "TP_ESTADO_ANTERIOR", "TP_ESTADO_NOVO",
      "CO_MODELO_RESPOSTA", "NU_VERSAO_MODELO", "DS_TEXTO_FINAL", "NU_REVISAO", "CO_USUARIO"
    ) values (v_id, 'criacao', null, 'rascunho', v_modelo, v_versao, v_texto, v_revisao, v_uid);
    insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_CAMPO", "DS_VALOR_NOVO", "CO_USUARIO")
    values (v_recurso, 'resposta', 'criacao', 'rascunho', v_uid);
    return json_build_object('id', v_id, 'revisao', v_revisao, 'estado', 'rascunho');
  end if;

  if p_dados->>'revisao' is null or (p_dados->>'revisao')::integer <> v_atual."NU_REVISAO" then
    raise exception 'Outra pessoa alterou esta resposta. Recarregue e tente de novo.' using errcode = '40001';
  end if;
  if v_atual."TP_ESTADO" not in ('rascunho', 'devolvida') then
    raise exception 'A resposta só pode ser editada em rascunho ou devolvida' using errcode = '22023';
  end if;
  update public."TB_RESPOSTA_RECURSO" set
    "CO_MODELO_RESPOSTA" = v_modelo,
    "NU_VERSAO_MODELO" = v_versao,
    "DS_FUNDAMENTACAO" = v_fundamentacao,
    "DS_TEXTO_FINAL" = v_texto,
    "TP_ESTADO" = 'rascunho',
    "CO_USUARIO_AUTOR" = v_uid,
    "NU_REVISAO" = "NU_REVISAO" + 1,
    "DT_ATUALIZACAO" = now(),
    "CO_USUARIO_ATUALIZACAO" = v_uid
  where "CO_RESPOSTA_RECURSO" = v_atual."CO_RESPOSTA_RECURSO"
  returning "NU_REVISAO" into v_revisao;
  insert into public."TH_RESPOSTA_RECURSO" (
    "CO_RESPOSTA_RECURSO", "TP_ACAO", "TP_ESTADO_ANTERIOR", "TP_ESTADO_NOVO",
    "CO_MODELO_RESPOSTA", "NU_VERSAO_MODELO", "DS_TEXTO_FINAL", "NU_REVISAO", "CO_USUARIO"
  ) values (v_atual."CO_RESPOSTA_RECURSO", 'edicao', v_atual."TP_ESTADO", 'rascunho', v_modelo, v_versao, v_texto, v_revisao, v_uid);
  return json_build_object('id', v_atual."CO_RESPOSTA_RECURSO", 'revisao', v_revisao, 'estado', 'rascunho');
end;
$function$;
comment on function public.salvar_resposta_recurso(jsonb) is
  'Cria ou grava o rascunho da resposta de um recurso (modelo + versão, fundamentação e texto final). Edita só em rascunho ou devolvida (volta a rascunho); revisão → 40001. Modelo novo: vigente, ativo, da área e da origem do recurso. Exige recursos >= editor, a área e a coordenação do edital.';

create function public.transicionar_resposta_recurso(p_resposta_id uuid, p_acao text, p_revisao integer, p_comentario text default null)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_atual public."TB_RESPOSTA_RECURSO";
  v_rec public."TB_RECURSO_CANDIDATO";
  v_situacao_modelo text;
  v_comentario text := nullif(btrim(coalesce(p_comentario, '')), '');
  v_novo text;
  v_revisao integer;
  v_etapa_em timestamptz;
begin
  if p_acao is null or p_acao not in ('enviar_revisao', 'aprovar', 'devolver', 'reabrir', 'marcar_enviada') then
    raise exception 'Ação inválida' using errcode = '22023';
  end if;
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  if length(coalesce(v_comentario, '')) > 2000 then
    raise exception 'O comentário passa de 2.000 caracteres' using errcode = '22023';
  end if;
  select s.* into v_atual from public."TB_RESPOSTA_RECURSO" s where s."CO_RESPOSTA_RECURSO" = p_resposta_id;
  if not found then
    raise exception 'Resposta não encontrada' using errcode = 'P0002';
  end if;
  perform private."FC_EXIGIR_RECURSO_ACESSIVEL"(v_atual."CO_RECURSO_CANDIDATO", 2);
  -- Mesma ordem de trava de salvar_resposta_recurso: o recurso, depois a resposta.
  select r.* into v_rec from public."TB_RECURSO_CANDIDATO" r
  where r."CO_RECURSO_CANDIDATO" = v_atual."CO_RECURSO_CANDIDATO" for update;
  select s.* into v_atual from public."TB_RESPOSTA_RECURSO" s
  where s."CO_RESPOSTA_RECURSO" = p_resposta_id for update;
  if p_revisao is null or p_revisao <> v_atual."NU_REVISAO" then
    raise exception 'Outra pessoa alterou esta resposta. Recarregue e tente de novo.' using errcode = '40001';
  end if;

  if p_acao = 'enviar_revisao' then
    if v_atual."TP_ESTADO" not in ('rascunho', 'devolvida') then
      raise exception 'Só rascunho ou devolvida vai para revisão' using errcode = '22023';
    end if;
    v_novo := 'em_revisao';
  elsif p_acao = 'aprovar' then
    if v_atual."TP_ESTADO" not in ('rascunho', 'em_revisao') then
      raise exception 'Só rascunho ou resposta em revisão pode ser aprovada' using errcode = '22023';
    end if;
    if (v_atual."TP_ESTADO" = 'em_revisao' or v_atual."ST_PASSOU_REVISAO" = 'S')
       and (v_uid = v_atual."CO_USUARIO_AUTOR" or v_uid is not distinct from v_atual."CO_USUARIO_ENVIO_REVISAO") then
      raise exception 'Quem escreveu ou enviou a resposta para revisão não pode aprová-la' using errcode = '42501';
    end if;
    select t."TP_SITUACAO" into v_situacao_modelo from public."TB_MODELO_RESPOSTA_RECURSO" t
    where t."CO_MODELO_RESPOSTA" = v_atual."CO_MODELO_RESPOSTA" and t."NU_VERSAO" = v_atual."NU_VERSAO_MODELO";
    if v_rec."TP_SITUACAO" = 'EM_ANALISE' then
      raise exception 'Registre a decisão do recurso antes de aprovar a resposta' using errcode = '22023';
    end if;
    if v_rec."TP_SITUACAO" <> v_situacao_modelo then
      raise exception 'A situação do recurso não é a do modelo usado na resposta' using errcode = '22023';
    end if;
    v_novo := 'aprovada';
  elsif p_acao = 'devolver' then
    if v_atual."TP_ESTADO" <> 'em_revisao' then
      raise exception 'Só resposta em revisão pode ser devolvida' using errcode = '22023';
    end if;
    if v_uid = v_atual."CO_USUARIO_AUTOR" then
      raise exception 'Quem escreveu a resposta não pode devolvê-la' using errcode = '42501';
    end if;
    if length(coalesce(v_comentario, '')) < 3 then
      raise exception 'Informe o que precisa ser ajustado (3 caracteres ou mais)' using errcode = '22023';
    end if;
    v_novo := 'devolvida';
  elsif p_acao = 'reabrir' then
    if v_atual."TP_ESTADO" <> 'aprovada' then
      raise exception 'Só resposta aprovada pode ser reaberta' using errcode = '22023';
    end if;
    if length(coalesce(v_comentario, '')) < 3 then
      raise exception 'Informe o motivo da reabertura (3 caracteres ou mais)' using errcode = '22023';
    end if;
    v_novo := 'rascunho';
  else
    if v_atual."TP_ESTADO" <> 'aprovada' then
      raise exception 'Só resposta aprovada pode ser marcada como enviada' using errcode = '22023';
    end if;
    v_novo := 'enviada';
  end if;

  update public."TB_RESPOSTA_RECURSO" set
    "TP_ESTADO" = v_novo,
    "ST_PASSOU_REVISAO" = case when p_acao = 'enviar_revisao' then 'S' else "ST_PASSOU_REVISAO" end,
    "DT_ENVIO_REVISAO" = case when p_acao = 'enviar_revisao' then now() else "DT_ENVIO_REVISAO" end,
    "CO_USUARIO_ENVIO_REVISAO" = case when p_acao = 'enviar_revisao' then v_uid else "CO_USUARIO_ENVIO_REVISAO" end,
    "DT_REVISAO" = case when p_acao in ('aprovar', 'devolver') then now() else "DT_REVISAO" end,
    "CO_USUARIO_REVISOR" = case when p_acao in ('aprovar', 'devolver') then v_uid else "CO_USUARIO_REVISOR" end,
    "DS_COMENTARIO_REVISAO" = case when p_acao in ('aprovar', 'devolver', 'reabrir') then v_comentario else "DS_COMENTARIO_REVISAO" end,
    "DT_ENVIO" = case when p_acao = 'marcar_enviada' then now() else "DT_ENVIO" end,
    "CO_USUARIO_ENVIO" = case when p_acao = 'marcar_enviada' then v_uid else "CO_USUARIO_ENVIO" end,
    "NU_REVISAO" = "NU_REVISAO" + 1,
    "DT_ATUALIZACAO" = now(),
    "CO_USUARIO_ATUALIZACAO" = v_uid
  where "CO_RESPOSTA_RECURSO" = p_resposta_id
  returning "NU_REVISAO" into v_revisao;

  insert into public."TH_RESPOSTA_RECURSO" (
    "CO_RESPOSTA_RECURSO", "TP_ACAO", "TP_ESTADO_ANTERIOR", "TP_ESTADO_NOVO", "DS_COMENTARIO",
    "CO_MODELO_RESPOSTA", "NU_VERSAO_MODELO", "DS_TEXTO_FINAL", "NU_REVISAO", "CO_USUARIO"
  ) values (
    p_resposta_id, p_acao, v_atual."TP_ESTADO", v_novo, v_comentario,
    v_atual."CO_MODELO_RESPOSTA", v_atual."NU_VERSAO_MODELO", v_atual."DS_TEXTO_FINAL", v_revisao, v_uid
  );
  insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "DS_MOTIVO", "CO_USUARIO")
  values (v_rec."CO_RECURSO_CANDIDATO", 'resposta', p_acao, v_atual."TP_ESTADO", v_novo, v_comentario, v_uid);

  -- Resposta enviada: a etapa do recurso acompanha (se ainda não estava marcada).
  v_etapa_em := v_rec."DT_RESPOSTA_CANDIDATO";
  if p_acao = 'marcar_enviada' and v_rec."DT_RESPOSTA_CANDIDATO" is null then
    v_etapa_em := now();
    update public."TB_RECURSO_CANDIDATO" set
      "DT_RESPOSTA_CANDIDATO" = v_etapa_em,
      "CO_USUARIO_RESPOSTA_CANDIDATO" = v_uid,
      "NU_REVISAO" = "NU_REVISAO" + 1,
      "DT_ATUALIZACAO" = now(),
      "CO_USUARIO_ATUALIZACAO" = v_uid
    where "CO_RECURSO_CANDIDATO" = v_rec."CO_RECURSO_CANDIDATO";
    insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
    values (v_rec."CO_RECURSO_CANDIDATO", 'etapa', 'resposta_candidato', 'N', 'S', v_uid);
  end if;

  return json_build_object('id', p_resposta_id, 'estado', v_novo, 'revisao', v_revisao, 'resposta_candidato_em', v_etapa_em);
end;
$function$;
comment on function public.transicionar_resposta_recurso(uuid, text, integer, text) is
  'Transição da resposta: enviar_revisao, aprovar, devolver (com comentário), reabrir (com comentário) ou marcar_enviada (marca também a etapa resposta_candidato do recurso). Em revisão (ou depois de passar por ela), quem escreveu ou enviou não aprova; aprovar exige o recurso decidido com a situação do modelo. Revisão → 40001. Exige recursos >= editor, a área e a coordenação do edital.';

-- 11. Anexos: registro, arquivamento e download --------------------------------------
create function public.registrar_anexo_recurso(p_recurso_id uuid, p_tipo text, p_nome text, p_caminho text, p_resposta_id uuid default null)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_area text;
  v_nome text := btrim(coalesce(p_nome, ''));
  v_caminho text := coalesce(p_caminho, '');
  v_tamanho bigint;
  v_mime text;
  v_dono text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  if p_tipo is null or p_tipo not in ('recurso_candidato', 'resposta', 'documento', 'outro') then
    raise exception 'Tipo de anexo inválido' using errcode = '22023';
  end if;
  if length(v_nome) not between 1 and 200 then
    raise exception 'O nome do arquivo deve ter de 1 a 200 caracteres' using errcode = '22023';
  end if;
  v_area := private."FC_EXIGIR_RECURSO_ACESSIVEL"(p_recurso_id, 2);
  if length(v_caminho) > 400
     or v_caminho not like v_area || '/' || p_recurso_id::text || '/%'
     or cardinality(storage.foldername(v_caminho)) <> 2
     or position('..' in v_caminho) > 0 then
    raise exception 'Caminho do anexo não pertence a este recurso' using errcode = '22023';
  end if;
  if p_resposta_id is not null and not exists (
    select 1 from public."TB_RESPOSTA_RECURSO" s
    where s."CO_RESPOSTA_RECURSO" = p_resposta_id and s."CO_RECURSO_CANDIDATO" = p_recurso_id
  ) then
    raise exception 'A resposta não é deste recurso' using errcode = '22023';
  end if;

  select (o.metadata->>'size')::bigint, o.metadata->>'mimetype', o.owner_id
    into v_tamanho, v_mime, v_dono
  from storage.objects o
  where o.bucket_id = 'recursos-anexos' and o.name = v_caminho;
  if not found then
    raise exception 'Arquivo não encontrado no Storage' using errcode = 'P0002';
  end if;
  if v_dono is distinct from v_uid::text then
    raise exception 'O arquivo foi enviado por outra pessoa' using errcode = '42501';
  end if;
  if coalesce(v_tamanho, 0) not between 1 and 20971520 then
    raise exception 'O anexo deve ter até 20 MB' using errcode = '22023';
  end if;
  if v_mime is null or v_mime not in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'image/jpeg',
    'image/png',
    'application/vnd.oasis.opendocument.text') then
    raise exception 'Tipo de arquivo não aceito (PDF, DOCX, DOC, JPG, PNG ou ODT)' using errcode = '22023';
  end if;

  insert into public."TB_ANEXO_RECURSO" (
    "CO_RECURSO_CANDIDATO", "CO_RESPOSTA_RECURSO", "TP_ANEXO", "NO_ARQUIVO", "DS_CAMINHO",
    "QT_BYTES", "DS_MIME", "CO_USUARIO_INCLUSAO"
  ) values (p_recurso_id, p_resposta_id, p_tipo, v_nome, v_caminho, v_tamanho, v_mime, v_uid)
  returning "CO_ANEXO_RECURSO" into v_id;
  insert into public."TH_ANEXO_RECURSO" ("CO_ANEXO_RECURSO", "TP_ACAO", "CO_USUARIO")
  values (v_id, 'inclusao', v_uid);
  insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_CAMPO", "DS_VALOR_NOVO", "CO_USUARIO")
  values (p_recurso_id, 'anexo', 'inclusao', v_nome, v_uid);
  return json_build_object('id', v_id, 'bytes', v_tamanho, 'mime', v_mime);
end;
$function$;
comment on function public.registrar_anexo_recurso(uuid, text, text, text, uuid) is
  'Registra o arquivo que a pessoa acabou de enviar ao bucket recursos-anexos: o caminho é <área>/<recurso>/<arquivo>, o objeto existe, é dela, tem até 20 MB e tipo aceito (lidos do Storage, não do navegador). Exige recursos >= editor, a área e a coordenação do edital.';

create function public.arquivar_anexo_recurso(p_anexo_id uuid, p_motivo text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_anexo public."TB_ANEXO_RECURSO";
begin
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 500 then
    raise exception 'Informe um motivo entre 3 e 500 caracteres' using errcode = '22023';
  end if;
  select x.* into v_anexo from public."TB_ANEXO_RECURSO" x where x."CO_ANEXO_RECURSO" = p_anexo_id;
  if not found then
    raise exception 'Anexo não encontrado' using errcode = 'P0002';
  end if;
  perform private."FC_EXIGIR_RECURSO_ACESSIVEL"(v_anexo."CO_RECURSO_CANDIDATO", 2);
  select x.* into v_anexo from public."TB_ANEXO_RECURSO" x where x."CO_ANEXO_RECURSO" = p_anexo_id for update;
  if v_anexo."ST_ATIVO" = 'N' then
    return json_build_object('id', p_anexo_id, 'arquivado', true, 'alterou', false);
  end if;
  update public."TB_ANEXO_RECURSO" set
    "ST_ATIVO" = 'N',
    "DS_MOTIVO_ARQUIVAMENTO" = btrim(p_motivo),
    "DT_ARQUIVAMENTO" = now(),
    "CO_USUARIO_ARQUIVAMENTO" = v_uid
  where "CO_ANEXO_RECURSO" = p_anexo_id;
  insert into public."TH_ANEXO_RECURSO" ("CO_ANEXO_RECURSO", "TP_ACAO", "DS_MOTIVO", "CO_USUARIO")
  values (p_anexo_id, 'arquivamento', btrim(p_motivo), v_uid);
  insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_MOTIVO", "CO_USUARIO")
  values (v_anexo."CO_RECURSO_CANDIDATO", 'anexo', 'arquivamento', v_anexo."NO_ARQUIVO", btrim(p_motivo), v_uid);
  return json_build_object('id', p_anexo_id, 'arquivado', true, 'alterou', true);
end;
$function$;
comment on function public.arquivar_anexo_recurso(uuid, text) is
  'Arquiva (lógico, com motivo) um anexo; o arquivo continua no bucket. Exige recursos >= editor, a área e a coordenação do edital.';

create function public.registrar_download_anexo_recurso(p_anexo_id uuid)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_anexo public."TB_ANEXO_RECURSO";
begin
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  select x.* into v_anexo from public."TB_ANEXO_RECURSO" x where x."CO_ANEXO_RECURSO" = p_anexo_id;
  if not found then
    raise exception 'Anexo não encontrado' using errcode = 'P0002';
  end if;
  -- Arquivado continua baixável, mas só por quem edita.
  perform private."FC_EXIGIR_RECURSO_ACESSIVEL"(v_anexo."CO_RECURSO_CANDIDATO", case when v_anexo."ST_ATIVO" = 'S' then 1 else 2 end);
  insert into public."TH_ANEXO_RECURSO" ("CO_ANEXO_RECURSO", "TP_ACAO", "CO_USUARIO")
  values (p_anexo_id, 'download', v_uid);
  return json_build_object(
    'bucket', 'recursos-anexos',
    'caminho', v_anexo."DS_CAMINHO",
    'nome', v_anexo."NO_ARQUIVO",
    'mime', v_anexo."DS_MIME",
    'validade_segundos', 60
  );
end;
$function$;
comment on function public.registrar_download_anexo_recurso(uuid) is
  'Confere o acesso (leitor; anexo arquivado, editor), registra o download no histórico do anexo e devolve o caminho. A política de leitura do bucket só libera a URL assinada (60 s) a quem tem este registro nos últimos 5 minutos.';

revoke all on function
  public.listar_modelos_resposta_recurso(),
  public.salvar_modelo_resposta_recurso(jsonb),
  public.arquivar_modelo_resposta_recurso(uuid, text),
  public.salvar_resposta_recurso(jsonb),
  public.transicionar_resposta_recurso(uuid, text, integer, text),
  public.registrar_anexo_recurso(uuid, text, text, text, uuid),
  public.arquivar_anexo_recurso(uuid, text),
  public.registrar_download_anexo_recurso(uuid)
from public, anon;
grant execute on function
  public.listar_modelos_resposta_recurso(),
  public.salvar_modelo_resposta_recurso(jsonb),
  public.arquivar_modelo_resposta_recurso(uuid, text),
  public.salvar_resposta_recurso(jsonb),
  public.transicionar_resposta_recurso(uuid, text, integer, text),
  public.registrar_anexo_recurso(uuid, text, text, text, uuid),
  public.arquivar_anexo_recurso(uuid, text),
  public.registrar_download_anexo_recurso(uuid)
to authenticated, service_role;

-- 12. Modelos iniciais ---------------------------------------------------------------
insert into public."TB_MODELO_RESPOSTA_RECURSO" ("CO_MODELO_RESPOSTA", "NU_VERSAO", "CO_AREA", "CO_ORIGEM_RECURSO", "TP_SITUACAO", "NO_MODELO", "DS_CORPO") values
('6f1d8a52-3b0e-4c11-9a51-000000000101', 1, null, 'analise-curricular', 'DEFERIDO', 'Deferido — Análise curricular', $modelo$RESPOSTA A RECURSO — ETAPA DE ANÁLISE CURRICULAR

Processo seletivo: Edital nº {edital} — {unidade}
Candidato(a): {nome_candidato} — código de inscrição {codigo_candidato}
Cargo/função: {cargo} — vaga {vaga}
Etapa recorrida: {origem}

Prezado(a) candidato(a),

A Agência Brasileira de Apoio à Gestão do Sistema Único de Saúde (AgSUS), após a análise do recurso interposto contra o resultado da etapa de análise curricular do processo seletivo acima identificado, comunica que o recurso foi DEFERIDO.

Fundamentação:
{fundamentacao}

Em decorrência do deferimento, a pontuação atribuída na análise curricular passou de {nota_anterior} para {nota_atual}, e o resultado registrado passou de "{resultado_anterior}" para "{resultado_atual}". A classificação será atualizada na próxima publicação de resultado, conforme o cronograma do edital.

Não cabe novo recurso contra esta decisão, salvo disposição diversa prevista no edital.

Brasília, {data_hoje}.

{analista}
Equipe responsável pela análise de recursos — AgSUS$modelo$),
('6f1d8a52-3b0e-4c11-9a51-000000000102', 1, null, 'analise-curricular', 'INDEFERIDO', 'Indeferido — Análise curricular', $modelo$RESPOSTA A RECURSO — ETAPA DE ANÁLISE CURRICULAR

Processo seletivo: Edital nº {edital} — {unidade}
Candidato(a): {nome_candidato} — código de inscrição {codigo_candidato}
Cargo/função: {cargo} — vaga {vaga}
Etapa recorrida: {origem}

Prezado(a) candidato(a),

A Agência Brasileira de Apoio à Gestão do Sistema Único de Saúde (AgSUS), após a análise do recurso interposto contra o resultado da etapa de análise curricular do processo seletivo acima identificado, comunica que o recurso foi INDEFERIDO.

Fundamentação:
{fundamentacao}

Dessa forma, ficam mantidos a pontuação de {nota_atual} e o resultado "{resultado_atual}" atribuídos na análise curricular, em conformidade com os critérios estabelecidos no edital.

Não cabe novo recurso contra esta decisão, salvo disposição diversa prevista no edital.

Brasília, {data_hoje}.

{analista}
Equipe responsável pela análise de recursos — AgSUS$modelo$),
('6f1d8a52-3b0e-4c11-9a51-000000000103', 1, null, 'analise-curricular', 'PARCIALMENTE_INDEFERIDO', 'Parcialmente indeferido — Análise curricular', $modelo$RESPOSTA A RECURSO — ETAPA DE ANÁLISE CURRICULAR

Processo seletivo: Edital nº {edital} — {unidade}
Candidato(a): {nome_candidato} — código de inscrição {codigo_candidato}
Cargo/função: {cargo} — vaga {vaga}
Etapa recorrida: {origem}

Prezado(a) candidato(a),

A Agência Brasileira de Apoio à Gestão do Sistema Único de Saúde (AgSUS), após a análise do recurso interposto contra o resultado da etapa de análise curricular do processo seletivo acima identificado, comunica que o recurso foi PARCIALMENTE INDEFERIDO: foram acolhidos apenas os pontos indicados na fundamentação a seguir, e os demais pedidos foram indeferidos.

Fundamentação:
{fundamentacao}

Em decorrência do acolhimento parcial, a pontuação atribuída na análise curricular passou de {nota_anterior} para {nota_atual}, e o resultado registrado é "{resultado_atual}". A classificação será atualizada na próxima publicação de resultado, conforme o cronograma do edital.

Não cabe novo recurso contra esta decisão, salvo disposição diversa prevista no edital.

Brasília, {data_hoje}.

{analista}
Equipe responsável pela análise de recursos — AgSUS$modelo$),
('6f1d8a52-3b0e-4c11-9a51-000000000201', 1, null, 'entrevista', 'DEFERIDO', 'Deferido — Entrevista', $modelo$RESPOSTA A RECURSO — ETAPA DE ENTREVISTA

Processo seletivo: Edital nº {edital} — {unidade}
Candidato(a): {nome_candidato} — código de inscrição {codigo_candidato}
Cargo/função: {cargo} — vaga {vaga}
Etapa recorrida: {origem}

Prezado(a) candidato(a),

A Agência Brasileira de Apoio à Gestão do Sistema Único de Saúde (AgSUS), após a análise do recurso interposto contra o resultado da etapa de entrevista do processo seletivo acima identificado, comunica que o recurso foi DEFERIDO.

Fundamentação:
{fundamentacao}

Em decorrência do deferimento, a avaliação da entrevista foi revista nos termos da fundamentação acima, e o resultado será atualizado na próxima publicação, conforme o cronograma do edital.

Não cabe novo recurso contra esta decisão, salvo disposição diversa prevista no edital.

Brasília, {data_hoje}.

{analista}
Equipe responsável pela análise de recursos — AgSUS$modelo$),
('6f1d8a52-3b0e-4c11-9a51-000000000202', 1, null, 'entrevista', 'INDEFERIDO', 'Indeferido — Entrevista', $modelo$RESPOSTA A RECURSO — ETAPA DE ENTREVISTA

Processo seletivo: Edital nº {edital} — {unidade}
Candidato(a): {nome_candidato} — código de inscrição {codigo_candidato}
Cargo/função: {cargo} — vaga {vaga}
Etapa recorrida: {origem}

Prezado(a) candidato(a),

A Agência Brasileira de Apoio à Gestão do Sistema Único de Saúde (AgSUS), após a análise do recurso interposto contra o resultado da etapa de entrevista do processo seletivo acima identificado, comunica que o recurso foi INDEFERIDO.

Fundamentação:
{fundamentacao}

Dessa forma, fica mantida a avaliação atribuída na entrevista, realizada em conformidade com os critérios estabelecidos no edital.

Não cabe novo recurso contra esta decisão, salvo disposição diversa prevista no edital.

Brasília, {data_hoje}.

{analista}
Equipe responsável pela análise de recursos — AgSUS$modelo$),
('6f1d8a52-3b0e-4c11-9a51-000000000203', 1, null, 'entrevista', 'PARCIALMENTE_INDEFERIDO', 'Parcialmente indeferido — Entrevista', $modelo$RESPOSTA A RECURSO — ETAPA DE ENTREVISTA

Processo seletivo: Edital nº {edital} — {unidade}
Candidato(a): {nome_candidato} — código de inscrição {codigo_candidato}
Cargo/função: {cargo} — vaga {vaga}
Etapa recorrida: {origem}

Prezado(a) candidato(a),

A Agência Brasileira de Apoio à Gestão do Sistema Único de Saúde (AgSUS), após a análise do recurso interposto contra o resultado da etapa de entrevista do processo seletivo acima identificado, comunica que o recurso foi PARCIALMENTE INDEFERIDO: foram acolhidos apenas os pontos indicados na fundamentação a seguir, e os demais pedidos foram indeferidos.

Fundamentação:
{fundamentacao}

A avaliação da entrevista foi revista somente quanto aos pontos acolhidos, e o resultado será atualizado na próxima publicação, conforme o cronograma do edital.

Não cabe novo recurso contra esta decisão, salvo disposição diversa prevista no edital.

Brasília, {data_hoje}.

{analista}
Equipe responsável pela análise de recursos — AgSUS$modelo$);

commit;
