/*
  Corrige a acentuação das funções afetadas pelo mesmo mojibake de
  `alterar_status_candidato_aprovado` (ver migration 20260921120000).

  Durante a padronização de nomenclatura MAD as funções foram recriadas à mão, e
  o SQL passou por uma ferramenta que leu os bytes UTF-8 como Latin-1 e os gravou
  de novo como UTF-8. O `ç` virou `Ã§`, o `ã` virou `Ã£`, o `í` virou `Ã­`, e
  assim por diante. Sete funções ficaram com literais estragados:

    definir_fundo_acesso_monitora            mensagem de erro
    get_acessos_config_master                rótulos devolvidos à interface
    get_monitoramento_cronograma_estado      o valor 'Concluído' do status
    registrar_bridge_aya                     um comentário
    restaurar_configuracoes_versao           texto gravado no histórico
    salvar_monitoramento_com_cronograma_v2   mensagens de erro
    set_my_avatar_choice                     mensagens de erro

  POR QUE UM LOOP E NÃO SETE `create or replace` ESCRITOS À MÃO.
  Foi copiar e colar DDL entre ferramentas que causou o problema. Reescrever as
  sete definições à mão repetiria exatamente o risco que se está a corrigir, e
  com funções de centenas de linhas — `get_acessos_config_master` tem mais de
  200 — a chance de introduzir outra diferença por acidente é alta. Aqui o texto
  nunca sai do banco: `pg_get_functiondef` lê a definição atual, a conversão
  desfaz a leitura errada e o `execute` a reaplica.

  `convert_to(texto, 'LATIN1')` devolve os bytes como se o texto fosse Latin-1,
  que é como ele foi lido por engano; `convert_from(..., 'UTF8')` volta a lê-los
  como UTF-8, que é o que sempre deviam ter sido. É o inverso exato do estrago.

  `jsonb_bool_or_null` É EXCLUÍDA DE PROPÓSITO — não a acrescente.
  Ela contém `'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ'`, a lista de letras que usa para remover
  acentos. O `Ã` ali é legítimo, não é mojibake, e a conversão iria estragá-la.
  É o único falso positivo da varredura por `Ã`.
*/

do $$
declare
  r record;
  v_corrigidas integer := 0;
begin
  for r in
    select p.oid, n.nspname, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prokind = 'f'
      and p.prosrc like '%Ã%'
      and p.proname <> 'jsonb_bool_or_null'
    order by n.nspname, p.proname
  loop
    execute convert_from(
      convert_to(pg_get_functiondef(r.oid), 'LATIN1'),
      'UTF8'
    );
    v_corrigidas := v_corrigidas + 1;
    raise notice 'acentuacao corrigida: %.%', r.nspname, r.proname;
  end loop;

  raise notice 'total de funcoes corrigidas: %', v_corrigidas;
end $$;

/*
  Conferência: depois de aplicar, esta consulta deve devolver apenas
  `jsonb_bool_or_null`. Qualquer outro nome significa que sobrou alguma coisa.

    select n.nspname, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prosrc like '%Ã%'
    order by 1, 2;
*/
