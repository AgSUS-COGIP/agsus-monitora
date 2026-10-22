-- Desfaz 20261010100000_leitura_relidos_primeiro: volta listar_anexos_para_leitura de 5 argumentos,
-- com o corpo de 20261009220000_leitura_dos_arquivos.sql (nunca lidos primeiro, sem p_so_relidos).
begin;

set local lock_timeout = '10s';

drop function if exists public.listar_anexos_para_leitura(text[], text, boolean, integer, text, boolean);

create function public.listar_anexos_para_leitura(p_editais text[], p_versao text, p_forcar boolean,
                                                   p_limite integer, p_sal text)
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
       where coalesce(p_forcar, false) or situacao is null or versao <> p_versao or situacao = 'ERRO'
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
      -- Primeiro quem tem ficha, depois o que nunca foi lido, versão antiga e, por último, erro.
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
                         order by pd.com_ficha desc, (pd.situacao is null) desc, (pd.situacao = 'ERRO'),
                                  pd.candidato, pd.ordem nulls last, pd.pergunta, pd.arquivo) as n
                  from pendentes pd) x
         where x.n <= p_limite), '[]'::jsonb)
    )
  );
end;
$function$;
comment on function public.listar_anexos_para_leitura(text[], text, boolean, integer, text) is
  'Para o robô da leitura dos arquivos (Python): os anexos da resposta vigente do questionário (FC_RESPOSTA_VIGENTE_EMPREGARE) dos inscritos ativos dos editais pedidos (id, número ou nome; sem pedido, os ativos com vagas da Empregare e regra) ainda não lidos, lidos com extrator de outra versão ou com erro (todos, com p_forcar), primeiro os de quem tem ficha; até p_limite. Cada anexo vem com o link, a pergunta, o nome do inscrito e o CPF (o do cadastro ou a resposta à pergunta do CPF) só como sha256(p_sal || 11 dígitos), para o robô conferir sem ver o número. Traz a regra vigente de cada edital (o robô liga a pergunta ao item da ficha). Só service_role.';
revoke all on function public.listar_anexos_para_leitura(text[], text, boolean, integer, text) from public, anon, authenticated;
grant execute on function public.listar_anexos_para_leitura(text[], text, boolean, integer, text) to service_role;

commit;
