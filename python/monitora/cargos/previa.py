"""
Prévia do casamento das grafias de cargo com a tabela oficial (fase 1 da tabela de cargos).

    agrupar(linhas)                 linhas {grafia, tabela, area, ocorrencias} → uma por grafia normalizada
    casar_todas(grupos, catalogo)   aplica monitora.cargos.casamento.casar a cada grupo
    resumo(grupos)                  cobertura em grafias e em ocorrências (geral e só da Saúde Indígena)
    escrever_csv(caminho, grupos)   CSV ";" com BOM (abre direto no Excel), por ocorrências
    sql_da_correcao(grupos, …)      a correção que grava os apelidos de alta confiança da Saúde Indígena

A leitura das grafias é o SQL de scripts/cargos/grafias-de-cargo.sql (só leitura); a entrada do
script é o resultado dele em JSON ou CSV. Nada aqui fala com o banco.
"""

import csv
from collections import Counter
from dataclasses import dataclass, field

from monitora.cargos.casamento import ALTA, MEDIA, SEM, casar
from monitora.cargos.normalizacao import normalizar
from monitora.cargos.sql import literal_sql

AREA_SI = "saude-indigena"
CONTA_DO_SETOR = "a01afddb-f64b-47d9-80e8-476a1ed14e43"
EMAIL_DO_SETOR = "dados.recursoshumanos@agenciasus.org.br"


@dataclass
class Grupo:
    grafia: str
    ocorrencias: int = 0
    originais: Counter = field(default_factory=Counter)
    tabelas: Counter = field(default_factory=Counter)
    areas: Counter = field(default_factory=Counter)
    casamento: object = None

    @property
    def exemplo(self):
        return self.originais.most_common(1)[0][0]


def agrupar(linhas):
    grupos = {}
    for r in linhas:
        g = normalizar(r.get("grafia"))
        if not g:
            continue
        n = int(r.get("ocorrencias") or 0)
        grupo = grupos.setdefault(g, Grupo(g))
        grupo.ocorrencias += n
        grupo.originais[r["grafia"]] += n
        grupo.tabelas[r.get("tabela") or "?"] += n
        grupo.areas[r.get("area") or "?"] += n
    return sorted(grupos.values(), key=lambda x: (-x.ocorrencias, x.grafia))


def casar_todas(grupos, catalogo):
    for g in grupos:
        g.casamento = casar(g.grafia, catalogo)
    return grupos


def _faixa(grupos, nivel, area=None):
    sel = [g for g in grupos if g.casamento.nivel == nivel and (area is None or g.areas[area])]
    ocorr = sum(g.areas[area] if area else g.ocorrencias for g in sel)
    originais = sum(len(g.originais) for g in sel)
    return len(sel), originais, ocorr


def resumo(grupos):
    """{'geral': {...}, 'saude-indigena': {...}, 'regras': {...}} com contagens por nível."""
    saida = {}
    for chave, area in (("geral", None), (AREA_SI, AREA_SI)):
        base = [g for g in grupos if area is None or g.areas[area]]
        total = {
            "grafias_normalizadas": len(base),
            "grafias_originais": sum(len(g.originais) for g in base),
            "ocorrencias": sum(g.areas[area] if area else g.ocorrencias for g in base),
        }
        niveis = {}
        for nivel in (ALTA, MEDIA, SEM):
            n, o, oc = _faixa(grupos, nivel, area)
            niveis[nivel] = {"grafias_normalizadas": n, "grafias_originais": o, "ocorrencias": oc}
        saida[chave] = {"total": total, "niveis": niveis}
    regras = Counter()
    for g in grupos:
        if g.casamento.regra:
            regras[(g.casamento.nivel, g.casamento.regra)] += 1
    saida["regras"] = {f"{n}/{r}": q for (n, r), q in sorted(regras.items())}
    return saida


def _pct(parte, todo):
    return f"{(100 * parte / todo):.1f}%" if todo else "-"


def texto_do_resumo(grupos, quantos_sem=15):
    r = resumo(grupos)
    linhas = ["PRÉVIA DO CASAMENTO DAS GRAFIAS DE CARGO (tabela oficial: CARGOS SI - SIP)", ""]
    for chave, titulo in (("geral", "TODAS AS ÁREAS"), (AREA_SI, "SÓ SAÚDE INDÍGENA (ocorrências nessa área)")):
        t = r[chave]["total"]
        linhas.append(
            f"{titulo}: {t['grafias_normalizadas']} grafias normalizadas "
            f"({t['grafias_originais']} originais), {t['ocorrencias']} ocorrências"
        )
        for nivel, nome in ((ALTA, "casadas (alta)"), (MEDIA, "sugestões (média)"), (SEM, "sem casamento")):
            n = r[chave]["niveis"][nivel]
            linhas.append(
                f"  {nome:<18} {n['grafias_normalizadas']:>5} grafias ({_pct(n['grafias_normalizadas'], t['grafias_normalizadas'])})"
                f"  {n['ocorrencias']:>6} ocorrências ({_pct(n['ocorrencias'], t['ocorrencias'])})"
            )
        linhas.append("")
    linhas.append("Regras: " + ", ".join(f"{k}={v}" for k, v in r["regras"].items()))
    linhas.append("")
    for titulo, area in (("todas as áreas", None), ("Saúde Indígena", AREA_SI)):
        sem = [g for g in grupos if g.casamento.nivel == SEM and (area is None or g.areas[area])]
        sem.sort(key=lambda g: (-(g.areas[area] if area else g.ocorrencias), g.grafia))
        linhas.append(f"Os {quantos_sem} maiores sem casamento ({titulo}):")
        for g in sem[:quantos_sem]:
            n = g.areas[area] if area else g.ocorrencias
            obs = f"  [{g.casamento.observacao}]" if g.casamento.observacao else ""
            linhas.append(f"  {n:>6}  {g.grafia}{obs}")
        linhas.append("")
    return "\n".join(linhas)


COLUNAS = [
    "ocorrencias",
    "ocorrencias_saude_indigena",
    "grafia_normalizada",
    "grafias_originais",
    "exemplo",
    "tabelas",
    "areas",
    "codigo",
    "cargo",
    "regra",
    "confianca",
    "observacao",
]


def _linha(g):
    c = g.casamento
    return {
        "ocorrencias": g.ocorrencias,
        "ocorrencias_saude_indigena": g.areas[AREA_SI],
        "grafia_normalizada": g.grafia,
        "grafias_originais": len(g.originais),
        "exemplo": g.exemplo,
        "tabelas": ", ".join(f"{t}:{n}" for t, n in g.tabelas.most_common()),
        "areas": ", ".join(f"{a}:{n}" for a, n in g.areas.most_common()),
        "codigo": c.codigo if c.codigo is not None else "",
        "cargo": c.cargo or "",
        "regra": c.regra or "",
        "confianca": f"{c.confianca:.3f}".replace(".", ",") if c.confianca is not None else "",
        "observacao": c.observacao or "",
    }


def escrever_csv(caminho, grupos):
    with open(caminho, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUNAS, delimiter=";")
        w.writeheader()
        for g in grupos:
            w.writerow(_linha(g))


def apelidos_da_correcao(grupos):
    """Alta confiança, da Saúde Indígena, que o nome oficial sozinho não resolve (regra ≠ EXATA)."""
    return [g for g in grupos if g.casamento.nivel == ALTA and g.casamento.regra != "EXATA" and g.areas[AREA_SI]]


def sql_da_correcao(grupos, data="04/11/2026"):
    apelidos = sorted(apelidos_da_correcao(grupos), key=lambda g: g.grafia)
    regras = Counter(g.casamento.regra for g in apelidos)
    valores = ",\n".join(
        f"  ({literal_sql(g.grafia)}, {g.casamento.codigo}, '{g.casamento.regra}', {g.casamento.confianca:.3f})"
        for g in apelidos
    )
    claims = '{"sub":"' + CONTA_DO_SETOR + '","role":"authenticated","email":"' + EMAIL_DO_SETOR + '"}'
    return f"""/*
  CORREÇÃO DE DADOS — apelidos de cargo de alta confiança ({data})

  Por quê: a tabela oficial de cargos (public."TD_CARGO",
  20261104150000_tabela_de_cargos.sql) chega com os 91 cargos da planilha
  "CARGOS SI - SIP", mas o cargo continua texto livre nas tabelas do MONITORA,
  com centenas de grafias para o mesmo cargo ("Enfermeiro (a)", "ENFERMEIRA",
  "Enfermeiro - DSEI Yanomami - 18 vagas…"). Esta correção grava em
  public."TD_CARGO_APELIDO" as grafias que o casamento do Python
  (python/monitora/cargos/casamento.py; prévia por
  scripts/cargos/previa_do_casamento.py) ligou a um cargo com ALTA confiança,
  só as que aparecem na Saúde Indígena, e não as de regra EXATA (o nome oficial
  já resolve). Sugestões de média confiança e grafias sem casamento NÃO entram:
  ficam para a tela da fase 2.

  {len(apelidos)} apelidos: {", ".join(f"{r} {n}" for r, n in sorted(regras.items()))}.
  Todos AUTOMATICO, área saude-indigena, confirmados pela conta do setor.

  O que faz (uma transação):
    1. confere a conta do setor (administrador global ativo, auth.uid) e que a
       migration 20261104150000 já foi aplicada;
    2. confere que cada grafia está normalizada e que cada código é cargo
       ativo da Saúde Indígena;
    3. grava os apelidos (TP_ORIGEM AUTOMATICO, regra e confiança do casamento,
       ST_CONFIRMADO S, confirmados e criados pela conta do setor);
    4. reprova (raise exception → nada fica) se o número gravado não for o
       esperado ou se FC_CARGO_DA_GRAFIA não devolver o código de cada grafia.

  Assinada pela conta do setor Gestão da Informação de Pessoal
  ({CONTA_DO_SETOR}). Rode SÓ COM A AUTORIZAÇÃO do
  usuário, depois da migration 20261104150000. Não é idempotente de propósito:
  rodar de novo falha na chave única (área, grafia).
  Ensaio: supabase/ensaios/20261104-apelidos-de-cargo.sql.
  Depois de aplicar, registre:
    npm run db:estado -- --registrar=correcoes/20261104-apelidos-de-cargo.sql
  Para desfazer: delete from public."TD_CARGO_APELIDO"
    where "TP_ORIGEM" = 'AUTOMATICO' and "CO_USUARIO_CRIACAO" = '{CONTA_DO_SETOR}';
*/
begin;

-- >>> correcao
set local lock_timeout = '3s';

-- A autoria desta transação: auth.uid() = conta do setor.
select set_config('request.jwt.claims',
  '{claims}', true);

do $$
begin
  if not exists (select 1 from public."TB_PERFIL_USUARIO" p
                   join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
                  where p.user_id = '{CONTA_DO_SETOR}' and p.ativo is true and a."ST_ADMIN_GLOBAL") then
    raise exception 'A conta do setor (a01afddb-…) não é administrador global ativo.';
  end if;
  if auth.uid() is distinct from '{CONTA_DO_SETOR}'::uuid then
    raise exception 'auth.uid() desta transação não é a conta do setor.';
  end if;
  if to_regclass('public."TD_CARGO_APELIDO"') is null
     or to_regprocedure('private."FC_CARGO_DA_GRAFIA"(text, text)') is null then
    raise exception 'Aplique antes a migration 20261104150000_tabela_de_cargos.sql.';
  end if;
end;
$$;

create temporary table tmp_apelido_de_cargo (grafia text not null, codigo integer not null,
  regra text not null, confianca numeric(4, 3) not null) on commit drop;

insert into tmp_apelido_de_cargo (grafia, codigo, regra, confianca) values
{valores};

do $$
declare
  v_esperado integer := {len(apelidos)};
  v_n integer;
begin
  if (select count(*) from tmp_apelido_de_cargo) <> v_esperado then
    raise exception 'A lista tem % apelidos (esperado %).', (select count(*) from tmp_apelido_de_cargo), v_esperado;
  end if;
  if exists (select 1 from tmp_apelido_de_cargo
              where grafia is distinct from private."FC_NORMALIZAR_GRAFIA_CARGO"(grafia)) then
    raise exception 'Há grafia que não está normalizada.';
  end if;
  if exists (select 1 from tmp_apelido_de_cargo t
              where not exists (select 1 from public."TD_CARGO" c
                                 where c."CO_CARGO" = t.codigo and c."CO_AREA" = '{AREA_SI}'
                                   and c."ST_REGISTRO_ATIVO" = 'S')) then
    raise exception 'Há código que não é cargo ativo da Saúde Indígena.';
  end if;

  insert into public."TD_CARGO_APELIDO" ("CO_AREA", "DS_GRAFIA_NORMALIZADA", "CO_CARGO", "TP_ORIGEM",
    "TP_REGRA", "VL_CONFIANCA", "ST_CONFIRMADO", "CO_USUARIO_CONFIRMACAO", "DT_CONFIRMACAO",
    "CO_USUARIO_CRIACAO", "CO_USUARIO_ATUALIZACAO")
  select '{AREA_SI}', t.grafia, t.codigo, 'AUTOMATICO', t.regra, t.confianca, 'S', auth.uid(), now(),
         auth.uid(), auth.uid()
    from tmp_apelido_de_cargo t;
  get diagnostics v_n = row_count;
  if v_n <> v_esperado then
    raise exception 'Gravou % apelidos (esperado %).', v_n, v_esperado;
  end if;

  if exists (select 1 from tmp_apelido_de_cargo t
              where private."FC_CARGO_DA_GRAFIA"(t.grafia, '{AREA_SI}') is distinct from t.codigo) then
    raise exception 'FC_CARGO_DA_GRAFIA não devolve o código de alguma grafia gravada.';
  end if;
end;
$$;
-- <<< correcao

commit;
"""


def apelidos_novos(grupos, ja_gravados):
    """Os apelidos da correção (alta, SI, sem EXATA) cuja grafia ainda não está em TD_CARGO_APELIDO."""
    return [g for g in apelidos_da_correcao(grupos) if g.grafia not in ja_gravados]


def sql_da_inclusao_de_cargo(grupos, cargo, ja_gravados, data="04/11/2026"):
    """Correção que inclui um cargo da folha SIP em TD_CARGO (Saúde Indígena) e grava os apelidos
    novos de alta confiança dele. Recusa se houver apelido novo de outro cargo (casamento mudou)."""
    novos = sorted(apelidos_novos(grupos, ja_gravados), key=lambda g: g.grafia)
    outros = [g.grafia for g in novos if g.casamento.codigo != cargo.codigo]
    if outros:
        raise ValueError(f"Há apelido novo de outro cargo: {outros[:5]}")
    regras = Counter(g.casamento.regra for g in novos)
    valores = ",\n".join(
        f"  ({literal_sql(g.grafia)}, {g.casamento.codigo}, '{g.casamento.regra}', {g.casamento.confianca:.3f})"
        for g in novos
    )
    claims = '{"sub":"' + CONTA_DO_SETOR + '","role":"authenticated","email":"' + EMAIL_DO_SETOR + '"}'
    ocorrencias = sum(g.areas[AREA_SI] for g in novos)
    return f"""/*
  CORREÇÃO DE DADOS — cargo {cargo.codigo} {cargo.nome} na tabela de cargos ({data})

  Por quê: a planilha "CARGOS SI - SIP" exportada para a migration
  20261104150000_tabela_de_cargos.sql não trazia {cargo.nome}, que o usuário
  confirmou ser o código SIP {cargo.codigo}, cargo da Saúde Indígena. Era o maior
  grupo sem casamento da prévia na Saúde Indígena. A lista dos cargos do
  repositório (python/monitora/cargos/cargos_si_sip.csv) já o inclui; a
  migration, já aplicada, não muda: a inclusão é esta correção.

  Grava também os {len(novos)} apelidos NOVOS de alta confiança das grafias de
  {cargo.nome} da Saúde Indígena ({ocorrencias} ocorrências; {", ".join(f"{r} {n}" for r, n in sorted(regras.items()))}),
  pelo mesmo casamento do Python (python/monitora/cargos/casamento.py;
  scripts/cargos/previa_do_casamento.py --incluir-cargo {cargo.codigo}), sem
  repetir os já gravados por 20261104-apelidos-de-cargo.sql.

  O que faz (uma transação):
    1. confere a conta do setor (administrador global ativo, auth.uid), que a
       tabela de cargos existe e que o cargo {cargo.codigo} ainda não está nela;
    2. inclui o cargo {cargo.codigo} ({cargo.nome}, saude-indigena, não sintético),
       criado pela conta do setor;
    3. grava os apelidos (AUTOMATICO, regra e confiança do casamento,
       confirmados e criados pela conta do setor);
    4. reprova (raise exception → nada fica) se o número gravado não for o
       esperado ou se FC_CARGO_DA_GRAFIA não devolver {cargo.codigo} para cada
       grafia e para o próprio nome.

  Assinada pela conta do setor Gestão da Informação de Pessoal
  ({CONTA_DO_SETOR}). Rode SÓ COM A AUTORIZAÇÃO do
  usuário. Não é idempotente de propósito: rodar de novo falha no passo 1.
  Ensaio: supabase/ensaios/20261104-cargo-psicologo.sql.
  Depois de aplicar, registre:
    npm run db:estado -- --registrar=correcoes/20261104-cargo-psicologo.sql
  Para desfazer: delete dos apelidos do cargo {cargo.codigo} criados pela conta
  do setor e depois do cargo {cargo.codigo} em public."TD_CARGO".
*/
begin;

-- >>> correcao
set local lock_timeout = '3s';

-- A autoria desta transação: auth.uid() = conta do setor.
select set_config('request.jwt.claims',
  '{claims}', true);

do $$
begin
  if not exists (select 1 from public."TB_PERFIL_USUARIO" p
                   join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
                  where p.user_id = '{CONTA_DO_SETOR}' and p.ativo is true and a."ST_ADMIN_GLOBAL") then
    raise exception 'A conta do setor (a01afddb-…) não é administrador global ativo.';
  end if;
  if auth.uid() is distinct from '{CONTA_DO_SETOR}'::uuid then
    raise exception 'auth.uid() desta transação não é a conta do setor.';
  end if;
  if to_regclass('public."TD_CARGO_APELIDO"') is null
     or to_regprocedure('private."FC_CARGO_DA_GRAFIA"(text, text)') is null then
    raise exception 'Aplique antes a migration 20261104150000_tabela_de_cargos.sql.';
  end if;
  if exists (select 1 from public."TD_CARGO" where "CO_CARGO" = {cargo.codigo} or "CO_CARGO_SIP" = {cargo.codigo}) then
    raise exception 'O cargo {cargo.codigo} já está em TD_CARGO.';
  end if;
end;
$$;

insert into public."TD_CARGO" ("CO_CARGO", "CO_CARGO_SIP", "NO_CARGO", "CO_AREA", "ST_SINTETICO",
  "CO_USUARIO_CRIACAO", "CO_USUARIO_ATUALIZACAO")
values ({cargo.codigo}, {cargo.codigo}, {literal_sql(cargo.nome)}, '{AREA_SI}', '{"S" if cargo.sintetico else "N"}', auth.uid(), auth.uid());

create temporary table tmp_apelido_de_cargo (grafia text not null, codigo integer not null,
  regra text not null, confianca numeric(4, 3) not null) on commit drop;

insert into tmp_apelido_de_cargo (grafia, codigo, regra, confianca) values
{valores};

do $$
declare
  v_esperado integer := {len(novos)};
  v_n integer;
begin
  if (select count(*) from tmp_apelido_de_cargo) <> v_esperado then
    raise exception 'A lista tem % apelidos (esperado %).', (select count(*) from tmp_apelido_de_cargo), v_esperado;
  end if;
  if exists (select 1 from tmp_apelido_de_cargo
              where grafia is distinct from private."FC_NORMALIZAR_GRAFIA_CARGO"(grafia)) then
    raise exception 'Há grafia que não está normalizada.';
  end if;
  if exists (select 1 from tmp_apelido_de_cargo t
               join public."TD_CARGO_APELIDO" a on a."CO_AREA" = '{AREA_SI}' and a."DS_GRAFIA_NORMALIZADA" = t.grafia) then
    raise exception 'Há grafia que já tem apelido.';
  end if;

  insert into public."TD_CARGO_APELIDO" ("CO_AREA", "DS_GRAFIA_NORMALIZADA", "CO_CARGO", "TP_ORIGEM",
    "TP_REGRA", "VL_CONFIANCA", "ST_CONFIRMADO", "CO_USUARIO_CONFIRMACAO", "DT_CONFIRMACAO",
    "CO_USUARIO_CRIACAO", "CO_USUARIO_ATUALIZACAO")
  select '{AREA_SI}', t.grafia, t.codigo, 'AUTOMATICO', t.regra, t.confianca, 'S', auth.uid(), now(),
         auth.uid(), auth.uid()
    from tmp_apelido_de_cargo t;
  get diagnostics v_n = row_count;
  if v_n <> v_esperado then
    raise exception 'Gravou % apelidos (esperado %).', v_n, v_esperado;
  end if;

  if private."FC_CARGO_DA_GRAFIA"({literal_sql(cargo.nome)}, '{AREA_SI}') is distinct from {cargo.codigo}
     or exists (select 1 from tmp_apelido_de_cargo t
                 where private."FC_CARGO_DA_GRAFIA"(t.grafia, '{AREA_SI}') is distinct from t.codigo) then
    raise exception 'FC_CARGO_DA_GRAFIA não devolve {cargo.codigo} para alguma grafia.';
  end if;
end;
$$;
-- <<< correcao

commit;
"""
