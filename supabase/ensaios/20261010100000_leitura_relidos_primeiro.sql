/*
  ENSAIO de 20261010100000_leitura_relidos_primeiro.sql — begin … rollback.

  Aplica o corpo da migration (copiado sem mudança, sem o begin/commit dela) e
  confere no 93/2026, com a versão de conferência '0-ensaio' (diferente de
  todas as gravadas, então tudo o que já foi lido conta como desatualizado):
    E1  só a assinatura nova existe, só para o service_role;
    E2  sem p_so_relidos, os já lidos vêm antes dos nunca lidos;
    E3  com p_so_relidos, só já lidos (nenhum anexo novo), e o total de
        pendentes é o de anexos já lidos do edital;
    E4  na versão atual de cada leitura, p_so_relidos sem p_forcar não traz o
        que já está em dia.
  Termina em ROLLBACK: nada fica gravado.
*/
begin;

-- ═══ CORPO DA MIGRATION (início) ═══
set local lock_timeout = '10s';

drop function if exists public.listar_anexos_para_leitura(text[], text, boolean, integer, text);

create function public.listar_anexos_para_leitura(p_editais text[], p_versao text, p_forcar boolean,
                                                   p_limite integer, p_sal text,
                                                   p_so_relidos boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_pedidos text[] := array(select btrim(x) from unnest(coalesce(p_editais, '{}')) x where btrim(x) <> '');
  v_ids uuid[];
begin
  if cardinality(v_pedidos) > 100 then
    raise exception 'Até 100 editais por execução' using errcode = '22023';
  end if;
  if coalesce(p_versao, '') !~ '^[0-9A-Za-z._-]{1,20}$' then
    raise exception 'Versão do extrator inválida' using errcode = '22023';
  end if;
  if p_limite is null or p_limite not between 1 and 2000 then
    raise exception 'Limite de 1 a 2.000 anexos' using errcode = '22023';
  end if;
  -- O sal é sorteado pelo robô a cada execução: o hash do CPF não serve fora dela.
  if coalesce(p_sal, '') !~ '^[A-Za-z0-9_-]{16,128}$' then
    raise exception 'Sal inválido' using errcode = '22023';
  end if;
  if cardinality(v_pedidos) > 0 then
    -- Cada pedido é o id do edital, o número ("93/2026") ou, sem número, o nome.
    select coalesce(array_agg(distinct m.id), '{}') into v_ids
      from public."TB_MONITORAMENTO_INDIGENA" m
      join unnest(v_pedidos) p(texto)
        on m.id::text = lower(p.texto)
        or private."FC_NUMERO_EDITAL"(m.edital) = p.texto
        or lower(btrim(m.edital)) = lower(p.texto);
  else
    -- Sem pedido: os editais ativos (fora os de treinamento) com vagas da Empregare e regra.
    select coalesce(array_agg(distinct v."CO_MONITORAMENTO"), '{}') into v_ids
      from public."TB_EMPREGARE_VAGA" v
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = v."CO_MONITORAMENTO"
      join public."TB_REGRA_ANALISE" r on r."CO_MONITORAMENTO" = m.id
     where coalesce(m.ativo, false) and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO");
  end if;

  return (
    with anexos as (
      select a."CO_EMPREGARE_RESPOSTA" as resposta, a."CO_PERGUNTA_EMPREGARE" as pergunta, a."NU_ARQUIVO" as arquivo,
             a."NU_ORDEM" as ordem, a."DS_ENUNCIADO" as enunciado, a."DS_COLUNA" as coluna, a."DS_LINK" as link,
             v."CO_MONITORAMENTO" as edital, v."CO_VAGA" as vaga, c."CO_EMPREGARE_CANDIDATO" as candidato,
             c."NO_CANDIDATO" as nome,
             -- O CPF do cadastro ou, sem ele, a resposta à pergunta do CPF no Excel (só dígitos).
             coalesce(nullif(regexp_replace(coalesce(c."NU_CPF", ''), '\D', '', 'g'), ''),
                      (select regexp_replace(e.value #>> '{}', '\D', '', 'g')
                         from jsonb_each(c."DS_COLUNA_ORIGINAL") e
                        where e.key ~* 'cpf' and jsonb_typeof(e.value) = 'string'
                        order by e.key limit 1)) as cpf,
             exists (select 1 from public."TB_FICHA_ANALISE" f
                      where f."CO_MONITORAMENTO" = v."CO_MONITORAMENTO"
                        and f."CO_EMPREGARE_CANDIDATO" = c."CO_EMPREGARE_CANDIDATO") as com_ficha,
             l."TP_SITUACAO" as situacao, l."NU_VERSAO_EXTRATOR" as versao
        from public."TB_EMPREGARE_VAGA" v
        join public."TB_EMPREGARE_CANDIDATO" c on c."CO_VAGA" = v."CO_VAGA" and c."ST_REGISTRO_ATIVO" = 'S'
        join public."TB_EMPREGARE_ANEXO" a
          on a."CO_EMPREGARE_RESPOSTA" = private."FC_RESPOSTA_VIGENTE_EMPREGARE"(c."CO_EMPREGARE_CANDIDATO")
        left join public."TB_LEITURA_ARQUIVO" l
          on l."CO_EMPREGARE_RESPOSTA" = a."CO_EMPREGARE_RESPOSTA" and l."CO_PERGUNTA_EMPREGARE" = a."CO_PERGUNTA_EMPREGARE"
         and l."NU_ARQUIVO" = a."NU_ARQUIVO"
       where v."CO_MONITORAMENTO" = any (v_ids)
    ),
    pendentes as (
      select * from anexos
       where (coalesce(p_forcar, false) or situacao is null or versao <> p_versao or situacao = 'ERRO')
         -- Só relidos: o que já foi lido (com outra versão, com erro ou, com p_forcar, todos); nunca o novo.
         and (not coalesce(p_so_relidos, false) or situacao is not null)
    )
    select jsonb_build_object(
      'nao_encontrados', coalesce((
        select jsonb_agg(p.texto order by p.texto)
          from unnest(v_pedidos) p(texto)
         where not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m
                            where m.id::text = lower(p.texto)
                               or private."FC_NUMERO_EDITAL"(m.edital) = p.texto
                               or lower(btrim(m.edital)) = lower(p.texto))), '[]'::jsonb),
      'editais', coalesce((
        select jsonb_agg(jsonb_build_object('id', m.id, 'rotulo', private."FC_ROTULO_DO_EDITAL"(m.edital),
                                            'regra', h."DS_CONFIGURACAO") order by m.id)
          from public."TB_MONITORAMENTO_INDIGENA" m
          left join public."TB_REGRA_ANALISE" r on r."CO_MONITORAMENTO" = m.id
          left join public."TH_REGRA_ANALISE" h on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
         where m.id = any (v_ids)), '[]'::jsonb),
      'total', (select count(*) from anexos),
      'pendentes', (select count(*) from pendentes),
      -- Primeiro o já lido com extrator de outra versão (a releitura troca o dado antigo), depois quem
      -- tem ficha, o que nunca foi lido e, por último, erro.
      'anexos', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'resposta', x.resposta, 'pergunta', x.pergunta, 'arquivo', x.arquivo, 'ordem', x.ordem,
                 'enunciado', x.enunciado, 'coluna', x.coluna, 'link', x.link, 'edital', x.edital, 'vaga', x.vaga,
                 'candidato', x.candidato, 'com_ficha', x.com_ficha, 'nome', x.nome,
                 'cpf', case when length(coalesce(x.cpf, '')) between 9 and 11
                             then encode(sha256(convert_to(p_sal || lpad(x.cpf, 11, '0'), 'UTF8')), 'hex')
                        end)
               order by x.n)
          from (select pd.*, row_number() over (
                         order by coalesce(pd.situacao <> 'ERRO' and pd.versao <> p_versao, false) desc,
                                  pd.com_ficha desc, (pd.situacao is null) desc, (pd.situacao = 'ERRO'),
                                  pd.candidato, pd.ordem nulls last, pd.pergunta, pd.arquivo) as n
                  from pendentes pd) x
         where x.n <= p_limite), '[]'::jsonb)
    )
  );
end;
$function$;
comment on function public.listar_anexos_para_leitura(text[], text, boolean, integer, text, boolean) is
  'Para o robô da leitura dos arquivos (Python): os anexos da resposta vigente do questionário (FC_RESPOSTA_VIGENTE_EMPREGARE) dos inscritos ativos dos editais pedidos (id, número ou nome; sem pedido, os ativos com vagas da Empregare e regra) lidos com extrator de outra versão (primeiro: a releitura troca o dado antigo), ainda não lidos ou com erro (todos, com p_forcar), depois os de quem tem ficha; com p_so_relidos, só os já lidos (nunca um anexo novo); até p_limite. Cada anexo vem com o link, a pergunta, o nome do inscrito e o CPF (o do cadastro ou a resposta à pergunta do CPF) só como sha256(p_sal || 11 dígitos), para o robô conferir sem ver o número. Traz a regra vigente de cada edital (o robô liga a pergunta ao item da ficha). Só service_role.';
revoke all on function public.listar_anexos_para_leitura(text[], text, boolean, integer, text, boolean) from public, anon, authenticated;
grant execute on function public.listar_anexos_para_leitura(text[], text, boolean, integer, text, boolean) to service_role;
-- ═══ CORPO DA MIGRATION (fim) ═══

do $$
declare
  v_sal text := 'sal-do-ensaio-0123456789';
  v jsonb;
  v_lidos integer;
  v_atual text;
  a jsonb;
  v_viu_novo boolean := false;
  v_n integer := 0;
begin
  -- E1
  if to_regprocedure('public.listar_anexos_para_leitura(text[], text, boolean, integer, text)') is not null
     or to_regprocedure('public.listar_anexos_para_leitura(text[], text, boolean, integer, text, boolean)') is null then
    raise exception 'E1: assinatura errada';
  end if;
  if has_function_privilege('authenticated', 'public.listar_anexos_para_leitura(text[], text, boolean, integer, text, boolean)', 'execute')
     or has_function_privilege('anon', 'public.listar_anexos_para_leitura(text[], text, boolean, integer, text, boolean)', 'execute')
     or not has_function_privilege('service_role', 'public.listar_anexos_para_leitura(text[], text, boolean, integer, text, boolean)', 'execute') then
    raise exception 'E1: grants errados';
  end if;
  raise notice 'E1 ok';

  select count(*) into v_lidos
    from public."TB_LEITURA_ARQUIVO" l
    join public."TB_EMPREGARE_ANEXO" x
      on x."CO_EMPREGARE_RESPOSTA" = l."CO_EMPREGARE_RESPOSTA" and x."CO_PERGUNTA_EMPREGARE" = l."CO_PERGUNTA_EMPREGARE"
     and x."NU_ARQUIVO" = l."NU_ARQUIVO";

  -- E2: com limite maior que os lidos, os lidos são os primeiros e só depois vem anexo nunca lido.
  v := public.listar_anexos_para_leitura(array['93/2026'], '0-ensaio', false, least(v_lidos + 20, 2000), v_sal);
  for a in select * from jsonb_array_elements(v -> 'anexos') loop
    v_n := v_n + 1;
    if exists (select 1 from public."TB_LEITURA_ARQUIVO" l
                where l."CO_EMPREGARE_RESPOSTA" = (a ->> 'resposta')::uuid and l."CO_PERGUNTA_EMPREGARE" = a ->> 'pergunta'
                  and l."NU_ARQUIVO" = (a ->> 'arquivo')::smallint) then
      if v_viu_novo then
        raise exception 'E2: anexo já lido depois de um nunca lido (posição %)', v_n;
      end if;
    else
      v_viu_novo := true;
    end if;
  end loop;
  raise notice 'E2 ok (% anexos, % lidos no banco)', v_n, v_lidos;

  -- E3
  v := public.listar_anexos_para_leitura(array['93/2026'], '0-ensaio', false, 2000, v_sal, true);
  if exists (select 1 from jsonb_array_elements(v -> 'anexos') a
              where not exists (select 1 from public."TB_LEITURA_ARQUIVO" l
                                 where l."CO_EMPREGARE_RESPOSTA" = (a ->> 'resposta')::uuid
                                   and l."CO_PERGUNTA_EMPREGARE" = a ->> 'pergunta'
                                   and l."NU_ARQUIVO" = (a ->> 'arquivo')::smallint)) then
    raise exception 'E3: p_so_relidos trouxe anexo nunca lido';
  end if;
  if jsonb_array_length(v -> 'anexos') = 0 or (v ->> 'pendentes')::integer <> jsonb_array_length(v -> 'anexos') then
    raise exception 'E3: pendentes % e anexos %', v ->> 'pendentes', jsonb_array_length(v -> 'anexos');
  end if;
  raise notice 'E3 ok (% relidos)', jsonb_array_length(v -> 'anexos');

  -- E4: na versão mais recente gravada, o que já está nela não volta (sem p_forcar).
  select max("NU_VERSAO_EXTRATOR") into v_atual from public."TB_LEITURA_ARQUIVO";
  v := public.listar_anexos_para_leitura(array['93/2026'], v_atual, false, 2000, v_sal, true);
  if exists (select 1 from jsonb_array_elements(v -> 'anexos') a
               join public."TB_LEITURA_ARQUIVO" l
                 on l."CO_EMPREGARE_RESPOSTA" = (a ->> 'resposta')::uuid and l."CO_PERGUNTA_EMPREGARE" = a ->> 'pergunta'
                and l."NU_ARQUIVO" = (a ->> 'arquivo')::smallint
              where l."NU_VERSAO_EXTRATOR" = v_atual and l."TP_SITUACAO" <> 'ERRO') then
    raise exception 'E4: trouxe leitura já na versão %', v_atual;
  end if;
  raise notice 'E4 ok (% desatualizados na versão %)', jsonb_array_length(v -> 'anexos'), v_atual;
end;
$$;

rollback;
