"""
Prévia do casamento das grafias de cargo com a tabela oficial (tabela de cargos, fase 1).

Por que existe: o cargo é texto livre em dez colunas do MONITORA (1.900 grafias só nos aprovados).
Antes de gravar qualquer apelido, a equipe olha a prévia: o que casa sozinho (alta confiança), o que
é sugestão (média) e o que fica sem casamento. Nada aqui grava no banco.

Como rodar:
  1. rode scripts/cargos/grafias-de-cargo.sql (só leitura) e salve o resultado em JSON (array de
     {grafia, tabela, area, ocorrencias}) ou CSV com essas colunas;
  2. python scripts/cargos/previa_do_casamento.py --grafias grafias.json --saida <pasta>
       [--correcao supabase/correcoes/20261104-apelidos-de-cargo.sql]
       [--ensaio-da-correcao supabase/ensaios/20261104-apelidos-de-cargo.sql]
     ou, para incluir um cargo que faltava na planilha (já posto em cargos_si_sip.csv):
       --incluir-cargo 88 --ja-gravados apelidos.json --correcao supabase/correcoes/20261104-cargo-psicologo.sql
       --ensaio-da-correcao supabase/ensaios/20261104-cargo-psicologo.sql
     ou, para a lista atualizada da planilha (cargos novos e nomes trocados, NOME_ANTERIOR do CSV):
       --lista-atualizada 76 --ja-gravados apelidos.json --correcao supabase/correcoes/20261104-cargos-lista-atualizada.sql
       --ensaio-da-correcao supabase/ensaios/20261104-cargos-lista-atualizada.sql
     (apelidos.json: select "DS_GRAFIA_NORMALIZADA" g from public."TD_CARGO_APELIDO", só leitura)

Saída na pasta: casadas.csv (alta), sugestoes.csv (média), sem-casamento.csv e resumo.txt, por
número de ocorrências. --correcao gera o SQL que grava os apelidos de alta confiança da Saúde
Indígena (aplicar só com autorização); --ensaio-da-correcao, o ensaio dele (migration + correção +
conferências, termina em rollback). Regras: python/monitora/cargos/casamento.py.
"""

import argparse
import csv
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "python"))

from monitora.cargos.casamento import ALTA, MEDIA, SEM, ler_catalogo  # noqa: E402
from monitora.cargos.previa import (  # noqa: E402
    agrupar,
    casar_todas,
    escrever_csv,
    sql_da_correcao,
    sql_da_inclusao_de_cargo,
    sql_da_lista_atualizada,
    texto_do_resumo,
)

RAIZ = pathlib.Path(__file__).resolve().parents[2]
MIGRATION = RAIZ / "supabase/migrations/20261104150000_tabela_de_cargos.sql"


def ler_grafias(caminho):
    caminho = pathlib.Path(caminho)
    if caminho.suffix.lower() == ".json":
        return json.loads(caminho.read_text(encoding="utf-8"))
    with open(caminho, encoding="utf-8-sig", newline="") as f:
        amostra = f.read(4096)
        f.seek(0)
        return list(csv.DictReader(f, delimiter=";" if amostra.count(";") > amostra.count(",") else ","))


def corpo(texto, inicio, fim):
    a = texto.index(inicio) + len(inicio)
    return texto[a : texto.index(fim, a)].strip("\n")


def ensaio_da_correcao(sql_correcao):
    migration = MIGRATION.read_text(encoding="utf-8").replace("\r\n", "\n")
    corpo_migration = corpo(migration, "\nbegin;\n", "\nnotify pgrst").strip()
    corpo_correcao = corpo(sql_correcao, "-- >>> correcao\n", "\n-- <<< correcao")
    return f"""-- ENSAIO de supabase/correcoes/20261104-apelidos-de-cargo.sql: roda a migration
-- 20261104150000_tabela_de_cargos.sql e a correção na mesma transação e desfaz (rollback).
-- Confere: os 91 cargos, o número de apelidos gravados, FC_CARGO_DA_GRAFIA nas grafias gravadas e
-- em grafias de exemplo, e que nada ficou fora da Saúde Indígena. Sem carga em lote em tabela grande.
begin;

set local statement_timeout = '120s';

-- ═══ CORPO DA MIGRATION (início) ═══
{corpo_migration}
-- ═══ CORPO DA MIGRATION (fim) ═══

-- ═══ CORPO DA CORREÇÃO (início) ═══
{corpo_correcao}
-- ═══ CORPO DA CORREÇÃO (fim) ═══

select jsonb_build_object(
  'cargos', (select count(*) from public."TD_CARGO"),
  'apelidos', (select count(*) from public."TD_CARGO_APELIDO"),
  'apelidos_por_regra', (select jsonb_object_agg("TP_REGRA", n) from (select "TP_REGRA", count(*) n
                           from public."TD_CARGO_APELIDO" group by 1) r),
  'apelidos_fora_da_si', (select count(*) from public."TD_CARGO_APELIDO" where "CO_AREA" <> 'saude-indigena'),
  'todos_confirmados_pelo_setor', (select bool_and("ST_CONFIRMADO" = 'S'
                                     and "CO_USUARIO_CONFIRMACAO" = 'a01afddb-f64b-47d9-80e8-476a1ed14e43'::uuid)
                                     from public."TD_CARGO_APELIDO"),
  'exemplos', jsonb_build_object(
    'Enfermeiro (a)', private."FC_CARGO_DA_GRAFIA"('Enfermeiro (a)'),
    'Técnico de Enfermagem', private."FC_CARGO_DA_GRAFIA"('Técnico de Enfermagem'),
    'MEDICO 40H', private."FC_CARGO_DA_GRAFIA"('MEDICO 40H'),
    'Assistente de Projeto - USI', private."FC_CARGO_DA_GRAFIA"('Assistente de Projeto - USI'))
) as ensaio;

rollback;
"""


def ensaio_da_inclusao(sql_correcao, codigo):
    """Ensaio da correção que inclui um cargo: o corpo e as conferências; o resultado sai no
    raise exception 'ENSAIO_OK …', que desfaz tudo (e o rollback do fim, por garantia)."""
    corpo_correcao = corpo(sql_correcao, "-- >>> correcao\n", "\n-- <<< correcao")
    return f"""-- ENSAIO de supabase/correcoes/20261104-cargo-psicologo.sql: roda a correção e desfaz. O resultado
-- vem no erro 'ENSAIO_OK {{json}}' (o raise desfaz tudo); qualquer outro erro reprova. Pede a migration
-- 20261104150000_tabela_de_cargos.sql e a correção 20261104-apelidos-de-cargo.sql já aplicadas.
begin;

set local statement_timeout = '120s';

-- ═══ CORPO DA CORREÇÃO (início) ═══
{corpo_correcao}
-- ═══ CORPO DA CORREÇÃO (fim) ═══

do $$
begin
  raise exception 'ENSAIO_OK %', jsonb_build_object(
    'cargos', (select count(*) from public."TD_CARGO"),
    'cargo', (select jsonb_build_object('codigo', "CO_CARGO", 'sip', "CO_CARGO_SIP", 'nome', "NO_CARGO", 'area', "CO_AREA",
                'sintetico', "ST_SINTETICO", 'criado_pelo_setor', "CO_USUARIO_CRIACAO" = 'a01afddb-f64b-47d9-80e8-476a1ed14e43'::uuid)
                from public."TD_CARGO" where "CO_CARGO" = {codigo}),
    'apelidos_total', (select count(*) from public."TD_CARGO_APELIDO"),
    'apelidos_do_cargo', (select count(*) from public."TD_CARGO_APELIDO" where "CO_CARGO" = {codigo}),
    'apelidos_por_regra', (select jsonb_object_agg("TP_REGRA", n) from (select "TP_REGRA", count(*) n
                             from public."TD_CARGO_APELIDO" where "CO_CARGO" = {codigo} group by 1) r),
    'todos_confirmados_pelo_setor', (select bool_and("ST_CONFIRMADO" = 'S'
                                       and "CO_USUARIO_CONFIRMACAO" = 'a01afddb-f64b-47d9-80e8-476a1ed14e43'::uuid)
                                       from public."TD_CARGO_APELIDO" where "CO_CARGO" = {codigo}),
    'exemplos', jsonb_build_object(
      'Psicólogo', private."FC_CARGO_DA_GRAFIA"('Psicólogo'),
      'Psicólogo (a)', private."FC_CARGO_DA_GRAFIA"('Psicólogo (a)'),
      'Enfermeiro (a)', private."FC_CARGO_DA_GRAFIA"('Enfermeiro (a)')));
end;
$$;

rollback;
"""


def ensaio_da_lista_atualizada(sql_correcao):
    """Ensaio da correção da lista atualizada: o corpo e as conferências; o resultado sai no
    raise exception 'ENSAIO_OK …', que desfaz tudo (e o rollback do fim, por garantia)."""
    corpo_correcao = sql_correcao.split("-- >>> correcao", 1)[1].split("-- <<< correcao", 1)[0].strip("\n")
    return f"""-- ENSAIO de supabase/correcoes/20261104-cargos-lista-atualizada.sql: roda a correção e desfaz. O
-- resultado vem no erro 'ENSAIO_OK {{json}}' (o raise desfaz tudo); qualquer outro erro reprova. Pede a
-- migration 20261104150000 e as correções 20261104-apelidos-de-cargo e 20261104-cargo-psicologo aplicadas.
begin;

set local statement_timeout = '120s';

-- ═══ CORPO DA CORREÇÃO (início) ═══
{corpo_correcao}
-- ═══ CORPO DA CORREÇÃO (fim) ═══

do $$
begin
  raise exception 'ENSAIO_OK %', jsonb_build_object(
    'cargos', (select count(*) from public."TD_CARGO"),
    'cargos_ativos', (select count(*) from public."TD_CARGO" where "ST_REGISTRO_ATIVO" = 'S'),
    'nomes', (select jsonb_object_agg("CO_CARGO", "NO_CARGO") from public."TD_CARGO" where "CO_CARGO" in (47, 63, 76, 95)),
    'cargo_76', (select jsonb_build_object('sip', "CO_CARGO_SIP", 'area', "CO_AREA", 'sintetico', "ST_SINTETICO",
                   'criado_pelo_setor', "CO_USUARIO_CRIACAO" = 'a01afddb-f64b-47d9-80e8-476a1ed14e43'::uuid)
                   from public."TD_CARGO" where "CO_CARGO" = 76),
    'renomeados_pelo_setor', (select bool_and("CO_USUARIO_ATUALIZACAO" = 'a01afddb-f64b-47d9-80e8-476a1ed14e43'::uuid)
                                from public."TD_CARGO" where "CO_CARGO" in (47, 63, 95)),
    'apelidos_total', (select count(*) from public."TD_CARGO_APELIDO"),
    'apelidos_manuais', (select jsonb_object_agg("DS_GRAFIA_NORMALIZADA", "CO_CARGO") from public."TD_CARGO_APELIDO"
                           where "TP_ORIGEM" = 'MANUAL'),
    'apelidos_do_76', (select count(*) from public."TD_CARGO_APELIDO" where "CO_CARGO" = 76),
    'exemplos', jsonb_build_object(
      'Enfermeiro', private."FC_CARGO_DA_GRAFIA"('Enfermeiro'),
      'Enfermeiro 40h', private."FC_CARGO_DA_GRAFIA"('Enfermeiro 40h'),
      'Assistente Social', private."FC_CARGO_DA_GRAFIA"('Assistente Social'),
      'Técnico de Enfermagem', private."FC_CARGO_DA_GRAFIA"('Técnico de Enfermagem'),
      'Técnico (a) de Enfermagem', private."FC_CARGO_DA_GRAFIA"('Técnico (a) de Enfermagem'),
      'Médico Especialista - MFC', private."FC_CARGO_DA_GRAFIA"('Médico Especialista - MFC'),
      'Médico de Família e Comunidade (SI)', private."FC_CARGO_DA_GRAFIA"('Médico de Família e Comunidade'),
      'Psicólogo', private."FC_CARGO_DA_GRAFIA"('Psicólogo')));
end;
$$;

rollback;
"""


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    p.add_argument("--grafias", required=True)
    p.add_argument("--saida", required=True)
    p.add_argument("--correcao")
    p.add_argument("--ensaio-da-correcao")
    p.add_argument("--incluir-cargo", type=int, help="código SIP do cargo novo (correção de inclusão)")
    p.add_argument(
        "--lista-atualizada",
        type=int,
        nargs="+",
        metavar="CODIGO",
        help="correção da lista atualizada: os códigos dos cargos novos (os renomeados vêm do NOME_ANTERIOR)",
    )
    p.add_argument("--ja-gravados", help="JSON com as grafias já em TD_CARGO_APELIDO ([{g: grafia}])")
    a = p.parse_args(argv)

    catalogo = ler_catalogo()
    grupos = casar_todas(agrupar(ler_grafias(a.grafias)), catalogo)
    saida = pathlib.Path(a.saida)
    saida.mkdir(parents=True, exist_ok=True)
    for nivel, nome in ((ALTA, "casadas.csv"), (MEDIA, "sugestoes.csv"), (SEM, "sem-casamento.csv")):
        escrever_csv(saida / nome, [g for g in grupos if g.casamento.nivel == nivel])
    resumo = texto_do_resumo(grupos)
    (saida / "resumo.txt").write_text(resumo + "\n", encoding="utf-8")
    print(resumo)
    if a.correcao and a.lista_atualizada:
        ja = {r["g"] for r in json.loads(pathlib.Path(a.ja_gravados).read_text(encoding="utf-8"))}
        sql = sql_da_lista_atualizada(grupos, catalogo, set(a.lista_atualizada), ja)
        pathlib.Path(a.correcao).write_text(sql, encoding="utf-8", newline="\n")
        if a.ensaio_da_correcao:
            ensaio = ensaio_da_lista_atualizada(sql)
            pathlib.Path(a.ensaio_da_correcao).write_text(ensaio, encoding="utf-8", newline="\n")
    elif a.correcao and a.incluir_cargo:
        cargo = next(c for c in catalogo.cargos if c.codigo == a.incluir_cargo)
        ja = {r["g"] for r in json.loads(pathlib.Path(a.ja_gravados).read_text(encoding="utf-8"))}
        sql = sql_da_inclusao_de_cargo(grupos, cargo, ja)
        pathlib.Path(a.correcao).write_text(sql, encoding="utf-8", newline="\n")
        if a.ensaio_da_correcao:
            ensaio = ensaio_da_inclusao(sql, cargo.codigo)
            pathlib.Path(a.ensaio_da_correcao).write_text(ensaio, encoding="utf-8", newline="\n")
    elif a.correcao:
        sql = sql_da_correcao(grupos)
        pathlib.Path(a.correcao).write_text(sql, encoding="utf-8", newline="\n")
        if a.ensaio_da_correcao:
            pathlib.Path(a.ensaio_da_correcao).write_text(ensaio_da_correcao(sql), encoding="utf-8", newline="\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
