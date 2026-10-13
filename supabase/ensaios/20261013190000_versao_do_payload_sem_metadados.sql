/*
  Regressão de FC_SE_MUDOU: execute depois da migration corretiva num banco
  de desenvolvimento. Usa apenas JSON sintético e termina em rollback.
  Antes da correção, a mudança de generated_at/cache reprova este ensaio.
*/
begin;

do $$
declare
  original jsonb := '{"rows":[[1,"Aprovado"]],"total":1,"atualizado_em":"2026-10-13T10:00:00Z","gerado_em":"2026-10-13T10:00:00Z","generated_at":"2026-10-13T10:00:00Z","cache":{"hit":true,"refreshed_at":"2026-10-13T10:00:00Z","gerado_em":"2026-10-13T10:00:00Z"}}';
  pacote jsonb;
  resposta jsonb;
  novo jsonb;
  versao text;
begin
  pacote := private."FC_SE_MUDOU"(original, null);
  versao := pacote->>'versao';
  if versao is null or pacote - 'versao' is distinct from original then
    raise exception 'Primeira leitura deve preservar o payload completo e acrescentar uma versão';
  end if;

  novo := original || '{"gerado_em":"2026-10-13T11:00:00Z","generated_at":"2026-10-13T11:00:00Z","cache":{"hit":false,"refreshed_at":"2026-10-13T11:00:00Z","gerado_em":"2026-10-13T11:00:00Z"}}'::jsonb;
  resposta := private."FC_SE_MUDOU"(novo, versao);
  if resposta is distinct from jsonb_build_object('inalterado', true, 'versao', versao) then
    raise exception 'Horários de geração e metadados de cache não devem invalidar os mesmos dados';
  end if;

  resposta := private."FC_SE_MUDOU"(original - array['gerado_em', 'generated_at', 'cache'], versao);
  if resposta->>'inalterado' is distinct from 'true' then
    raise exception 'Ausência de metadados deve manter a versão dos mesmos dados';
  end if;

  novo := original || '{"rows":[[1,"Reprovado"]]}'::jsonb;
  resposta := private."FC_SE_MUDOU"(novo, versao);
  if resposta->>'versao' = versao or resposta - 'versao' is distinct from novo then
    raise exception 'Mudança nas linhas deve devolver nova versão e payload completo';
  end if;

  novo := original || '{"rows":[],"total":0}'::jsonb;
  resposta := private."FC_SE_MUDOU"(novo, versao);
  if resposta->>'versao' = versao or resposta->'rows' is distinct from '[]'::jsonb then
    raise exception 'Remoção de linhas deve invalidar a versão';
  end if;

  novo := original || '{"atualizado_em":"2026-10-13T11:00:00Z"}'::jsonb;
  if private."FC_SE_MUDOU"(novo, versao)->>'versao' = versao then
    raise exception 'Data de atualização dos dados não é metadado de geração';
  end if;

  resposta := private."FC_SE_MUDOU"(original, 'versao-anterior-a-correcao');
  if resposta - 'versao' is distinct from original then
    raise exception 'Versão antiga deve receber payload completo, sem erro';
  end if;

  if private."FC_SE_MUDOU"(null, versao) is not null then
    raise exception 'Payload nulo deve continuar nulo';
  end if;
  raise notice '8 verificações de versão do payload passaram';
end;
$$;

rollback;
