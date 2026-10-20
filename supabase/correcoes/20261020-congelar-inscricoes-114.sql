/*
  CORREÇÃO DE DADOS — Congelar as inscrições do edital 114/2026 (Projetos,
  AGSUS/FUNASA PES Rio Doce; CO_MONITORAMENTO bcecfb08-88ef-4e06-8401-bcad6bf88fd0).

  Por quê: as inscrições acabaram em 14/10/2026 e a regra da coordenação é não
  atualizar as inscrições nem o lote do 114 sem autorização explícita. A tarefa
  agsus_robo_inscricoes_114_2026 já está desligada, mas o "Rodar agora" do robô
  da Empregare sem filtro pega todo edital com cronograma encerrado há até 30
  dias — incluiria o 114 —, e a pré-classificação "após robô" já tirou do lote
  uma candidata antes (auditoria de 20/10/2026).

  O que faz: liga a trava "inscrições congeladas" do 114/2026
  (TB_CONGELAMENTO_INSCRICAO = S) e registra o evento CONGELAR no histórico
  (TH_CONGELAMENTO_INSCRICAO). Com a trava, o robô da Empregare não exporta nem
  grava candidatos das vagas do 114 (nem no "Rodar agora" sem filtro, nem com o
  edital/vaga pedidos) e a pré-classificação não recalcula nem refaz o lote do
  114; o modo "Só anexos" continua. Override: só o administrador global, em
  Status das atualizações › Rodar com opções › "Forçar edital com inscrições
  congeladas", com motivo (fica registrado). Para liberar de vez: aba
  Pré-classificação do 114 › Inscrições congeladas › Liberar (com motivo).

  Pré-requisito: a migration 20261020170000_inscricoes_congeladas.sql aplicada.
  Assinada pela conta do setor a01afddb-f64b-47d9-80e8-476a1ed14e43 (Gestão da
  Informação de Pessoal). Rode no SQL Editor (papel postgres) SÓ COM A
  AUTORIZAÇÃO do usuário. Idempotente: se já estiver congelado, não muda nada
  nem duplica o histórico. Não mexe em candidatos, fichas, lote nem robôs.
*/
begin;

do $$
begin
  if to_regclass('public."TB_CONGELAMENTO_INSCRICAO"') is null then
    raise exception 'Aplique antes a migration 20261020170000_inscricoes_congeladas.sql.';
  end if;
  if not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m
                  where m.id = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0' and m.edital = '114/2026') then
    raise exception 'Edital 114/2026 (bcecfb08-…) não encontrado.';
  end if;
end;
$$;

with motivo as (
  select 'Inscrições encerradas em 14/10/2026: inscrições e lote do 114/2026 não mudam sem autorização explícita da coordenação (auditoria de 20/10/2026).'::text as texto
),
mudou as (
  insert into public."TB_CONGELAMENTO_INSCRICAO" as c
         ("CO_MONITORAMENTO", "ST_INSCRICOES_CONGELADAS", "DS_MOTIVO", "CO_USUARIO_ATUALIZACAO")
  select 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0', 'S', motivo.texto, 'a01afddb-f64b-47d9-80e8-476a1ed14e43'
    from motivo
  on conflict ("CO_MONITORAMENTO") do update set
    "ST_INSCRICOES_CONGELADAS" = 'S',
    "DS_MOTIVO" = excluded."DS_MOTIVO",
    "CO_USUARIO_ATUALIZACAO" = excluded."CO_USUARIO_ATUALIZACAO",
    "DT_ATUALIZACAO" = now()
   where c."ST_INSCRICOES_CONGELADAS" <> 'S'
  returning c."CO_MONITORAMENTO"
)
insert into public."TH_CONGELAMENTO_INSCRICAO" ("CO_MONITORAMENTO", "TP_EVENTO", "DS_MOTIVO", "CO_USUARIO")
select m."CO_MONITORAMENTO", 'CONGELAR', motivo.texto, 'a01afddb-f64b-47d9-80e8-476a1ed14e43'
  from mudou m, motivo;

-- Conferência: deve sair congelado = S e o último evento CONGELAR.
select c."ST_INSCRICOES_CONGELADAS" as congelado,
       c."DT_ATUALIZACAO" as em,
       (select h."TP_EVENTO" from public."TH_CONGELAMENTO_INSCRICAO" h
         where h."CO_MONITORAMENTO" = c."CO_MONITORAMENTO"
         order by h."DT_EVENTO" desc, h."CO_EVENTO" desc limit 1) as ultimo_evento
  from public."TB_CONGELAMENTO_INSCRICAO" c
 where c."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';

commit;
