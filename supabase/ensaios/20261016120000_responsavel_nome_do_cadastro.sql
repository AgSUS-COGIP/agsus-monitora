/*
  Ensaio de 20261016120000_responsavel_nome_do_cadastro.sql (sempre desfeito: begin … rollback).

  Uso (Git Bash):
    source ensaio.sh
    ensaio "$(sed -E '/^\s*(begin|commit|rollback)\s*;\s*$/Id' supabase/migrations/20261016120000_responsavel_nome_do_cadastro.sql)
    $(cat supabase/ensaios/20261016120000_responsavel_nome_do_cadastro.sql)"

  Espera-se: o bloco de asserts passa (qualquer falha aborta o ensaio); 13 apelidos
  carregados; e a tabela antes → depois por edital (o que a correção
  20261016-responsavel-nome-do-cadastro.sql vai gravar).
*/
do $teste$
begin
  -- nome e sobrenome
  assert private."FC_NOME_E_SOBRENOME"('Pietra Mello Pires') = 'Pietra Pires';
  assert private."FC_NOME_E_SOBRENOME"('Ana Beatriz Jales Cirino') = 'Ana Cirino';
  assert private."FC_NOME_E_SOBRENOME"('Ana Lilian de Matos Pereira') = 'Ana Pereira';
  assert private."FC_NOME_E_SOBRENOME"('Emanuel Serrano') = 'Emanuel Serrano';
  assert private."FC_NOME_E_SOBRENOME"('Natalia Santos') = 'Natalia Santos';
  assert private."FC_NOME_E_SOBRENOME"('Yassury Suira') = 'Yassury Suira';
  assert private."FC_NOME_E_SOBRENOME"('  Camila   e Silva  Santos ') = 'Camila Santos';
  assert private."FC_NOME_E_SOBRENOME"('Maria da') = 'Maria';
  assert private."FC_NOME_E_SOBRENOME"('Ester Castro De Lima') = 'Ester Lima';
  assert private."FC_NOME_E_SOBRENOME"('Valdeir') = 'Valdeir';
  assert private."FC_NOME_E_SOBRENOME"('   ') is null;
  assert private."FC_NOME_E_SOBRENOME"(null) is null;
  -- normalização
  assert private."FC_NOME_NORMALIZADO"('  NATÁLIA   ') = 'natalia';
  assert private."FC_NOME_NORMALIZADO"('') is null;
  -- responsável: apelido da área, nome completo do cadastro, sem cadastro
  assert private."FC_NOME_DO_RESPONSAVEL"('Pietra', 'Projetos') = 'Pietra Pires';
  assert private."FC_NOME_DO_RESPONSAVEL"('  natália ', 'Projetos') = 'Natalia Santos';
  assert private."FC_NOME_DO_RESPONSAVEL"('Ana Cirino', 'Projetos') = 'Ana Cirino';
  assert private."FC_NOME_DO_RESPONSAVEL"('Ana Lilian', 'Projetos') = 'Ana Pereira';
  assert private."FC_NOME_DO_RESPONSAVEL"('Emanuel', 'Projetos') = 'Emanuel Serrano';
  assert private."FC_NOME_DO_RESPONSAVEL"('Valdeir', 'Projetos') = 'Valdeir Neves';
  assert private."FC_NOME_DO_RESPONSAVEL"('Fabiana de Almeida Santos', 'Projetos') = 'Fabiana Santos';
  assert private."FC_NOME_DO_RESPONSAVEL"('DENIS AUGUSTO', 'Saúde Indígena') = 'Denis Oliveira';
  assert private."FC_NOME_DO_RESPONSAVEL"('Pietra Mello Pires', 'Projetos') = 'Pietra Pires';
  assert private."FC_NOME_DO_RESPONSAVEL"('VANESSA DOS SANTOS SILVA', 'Saúde Indígena') = 'Vanessa Silva';
  -- o apelido da área não vale em outra área
  assert private."FC_NOME_DO_RESPONSAVEL"('Pietra', 'Saúde Indígena') = 'Pietra';
  assert private."FC_NOME_DO_RESPONSAVEL"('Suzana Carvalho', 'Projetos') = 'Suzana Carvalho';
  assert private."FC_NOME_DO_RESPONSAVEL"('João Victor de Jesus', 'Projetos') = 'João Victor de Jesus';
  assert private."FC_NOME_DO_RESPONSAVEL"(null, 'Projetos') is null;
  assert private."FC_NOME_DO_RESPONSAVEL"('', 'Projetos') = '';
  -- idempotente: o nome já padronizado não muda de novo
  assert private."FC_NOME_DO_RESPONSAVEL"('Pietra Pires', 'Projetos') = 'Pietra Pires';
  -- o sincronismo grava pela função e compara pelo hash do payload
  assert position('private."FC_NOME_DO_RESPONSAVEL"(public.jsonb_text_or_null(s.payload,''responsavel_analise'')'
                  in pg_get_functiondef('public.processar_sync_analises_lote(uuid,integer)'::regprocedure)) > 0;
  assert position('s.hash_registro' in pg_get_functiondef('public.processar_sync_analises_lote(uuid,integer)'::regprocedure)) > 0;
  assert position('private."FC_NOME_E_SOBRENOME"(u.nome)'
                  in pg_get_functiondef('private."FC_PUBLICAR_FICHA_ANALISE"(uuid)'::regprocedure)) > 0;
end;
$teste$;

select count(*) as apelidos_carregados from public."TB_APELIDO_RESPONSAVEL";

-- antes → depois por edital (só o que muda)
with nomes as (
  select a.grupo, a.responsavel_analise,
         private."FC_NOME_DO_RESPONSAVEL"(a.responsavel_analise, a.grupo) as novo
    from (select distinct grupo, responsavel_analise
            from public."TB_ANALISE_CURRICULAR"
           where responsavel_analise is not null) a
)
select t.grupo, t.edital, t.responsavel_analise as antes, n.novo as depois, count(*) as linhas
  from public."TB_ANALISE_CURRICULAR" t
  join nomes n on n.grupo is not distinct from t.grupo and n.responsavel_analise = t.responsavel_analise
 where n.novo is distinct from t.responsavel_analise
 group by 1, 2, 3, 4
 order by 1, 2, 3;
