/*
  Ensaio de 20261015151000_nome_da_vaga_publicado.sql (sempre desfeito: begin … rollback).

  Uso (Git Bash):
    source ensaio.sh
    ensaio "$(sed -E '/^\s*(begin|commit|rollback)\s*;\s*$/Id' supabase/migrations/20261015151000_nome_da_vaga_publicado.sql)
    $(cat supabase/ensaios/20261015151000_nome_da_vaga_publicado.sql)"

  Espera-se: sem_nome_antes > 0, republicadas > 0 e sem_nome_depois = 0 (salvo vaga
  sem cargo nem lotação na pré-classificação, contada em sem_nome_possivel).
*/
with antes as (
  select count(*) as n
    from public."TB_ANALISE_CURRICULAR" a
   where a.chave_natural like 'monitora|bcecfb08-88ef-4e06-8401-bcad6bf88fd0|%' and a.ativo and a.nome_vaga is null
), abre as (
  select private."FC_ABRIR_FICHAS"('bcecfb08-88ef-4e06-8401-bcad6bf88fd0', '[]', null) as r
  from antes
)
select (select n from antes) as sem_nome_antes,
       (select r from abre) as abrir_114;

select count(*) filter (where a.nome_vaga is null) as sem_nome_depois,
       count(*) filter (where a.nome_vaga is null
                          and private."FC_NOME_VAGA_PUBLICADA"(f."CO_MONITORAMENTO", f."CO_VAGA") is null) as sem_nome_possivel,
       count(*) as linhas_ativas
  from public."TB_ANALISE_CURRICULAR" a
  join public."TB_FICHA_ANALISE" f
    on a.chave_natural = 'monitora|' || f."CO_MONITORAMENTO" || '|' || f."CO_EMPREGARE_CANDIDATO"
 where f."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0' and a.ativo;
