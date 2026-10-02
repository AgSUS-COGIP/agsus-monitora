import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  20261002200000 (ainda não aplicada; o ensaio begin…rollback está em
  supabase/ensaios/): "Edital gestor" vira "Gestor" só no nome, o Gestor corrige
  coordenadas pelas RPCs dos dois mapas e o último acesso passa a ser real.
  Aqui, as invariantes estáticas.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261002200000_gestor_coordenadas_e_ultimo_acesso.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const FONTES = {
  20261002160000: ler(
    "supabase/migrations/20261002160000_conferir_coordenadas_mapa.sql",
  ),
  20261002190000: ler(
    "supabase/migrations/20261002190000_coordenadas_mapa_projetos.sql",
  ),
};

const FUNCOES = [
  ["20261002160000", 'private."FC_APLICAR_COORDENADA_MAPA"('],
  ["20261002160000", "public.salvar_coordenada_mapa_saude_indigena("],
  ["20261002160000", "public.desfazer_coordenada_mapa_saude_indigena("],
  ["20261002160000", "public.listar_historico_coordenada_mapa_saude_indigena("],
  [
    "20261002160000",
    "public.listar_pendencias_coordenada_mapa_saude_indigena(",
  ],
  ["20261002190000", 'private."FC_APLICAR_COORDENADA_LOCAL"('],
  ["20261002190000", "public.salvar_coordenada_mapa_projetos("],
  ["20261002190000", "public.desfazer_coordenada_mapa_projetos("],
  ["20261002190000", "public.listar_historico_coordenada_mapa_projetos("],
  ["20261002190000", "public.listar_pendencias_coordenada_mapa_projetos("],
];

const corpo = (texto, cabecalho) => {
  const inicio = texto.indexOf(cabecalho);
  expect(inicio, cabecalho).toBeGreaterThan(-1);
  return texto.slice(inicio, texto.indexOf("\n$$;", inicio));
};

describe("migration do Gestor nas coordenadas e do último acesso", () => {
  it("vem depois das coordenadas de Projetos e é uma transação só", () => {
    expect(NOME.slice(0, 14) > "20261002190000").toBe(true);
    expect(MIGRATION.match(/^begin;$/gm)).toHaveLength(1);
    expect(MIGRATION.trim().endsWith("commit;")).toBe(true);
  });

  it('"Gestor" troca só o nome exibido; o código edital_gestor fica', () => {
    expect(MIGRATION).toMatch(
      /set "NO_GRUPO_ACESSO" = 'Gestor',[\s\S]*where a\."CO_GRUPO_ACESSO" = 'edital_gestor'\s+and a\."NO_GRUPO_ACESSO" = 'Edital gestor';/,
    );
    expect(MIGRATION).not.toMatch(/set "CO_GRUPO_ACESSO"/);
    expect(MIGRATION).not.toMatch(/update public\."TB_PERFIL_USUARIO"/);
    expect(ROLLBACK).toMatch(/set "NO_GRUPO_ACESSO" = 'Edital gestor'/);
  });

  it("FC_PODE_EDITAR_COORDENADA: admin global ou edital_gestor, SECURITY DEFINER, sem execução direta", () => {
    const f = corpo(
      MIGRATION,
      'create function private."FC_PODE_EDITAR_COORDENADA"()',
    );
    expect(f).toMatch(/security definer\nset search_path = ''/);
    expect(f).toMatch(
      /private\.is_master\(\) or private\.monitora_role\(\) = 'edital_gestor'/,
    );
    expect(MIGRATION).toContain(
      'revoke all on function private."FC_PODE_EDITAR_COORDENADA"() from public, anon, authenticated;',
    );
    expect(MIGRATION).toContain(
      'comment on function private."FC_PODE_EDITAR_COORDENADA"() is',
    );
  });

  it("as 10 funções do editor: mesmo corpo da fonte, só a checagem e a mensagem mudam", () => {
    for (const [fonte, cabecalho] of FUNCOES) {
      const original = corpo(FONTES[fonte], `create function ${cabecalho}`);
      const nova = corpo(MIGRATION, `create or replace function ${cabecalho}`);
      expect(nova, cabecalho).not.toContain("is_master");
      expect(nova, cabecalho).toContain(
        'if auth.uid() is null or not private."FC_PODE_EDITAR_COORDENADA"() then',
      );
      expect(nova, cabecalho).toMatch(/Somente administrador ou gestor pode/);
      const esperado = original
        .replace(/^create function /, "create or replace function ")
        .replace("private.is_master()", 'private."FC_PODE_EDITAR_COORDENADA"()')
        .replace(
          "Somente administrador pode",
          "Somente administrador ou gestor pode",
        );
      expect(nova, cabecalho).toBe(esperado);
      // O rollback volta o corpo original.
      expect(
        corpo(ROLLBACK, `create or replace function ${cabecalho}`),
        cabecalho,
      ).toBe(
        original.replace(/^create function /, "create or replace function "),
      );
    }
    expect(MIGRATION).toContain(
      "'Somente administrador ou gestor pode corrigir coordenadas.'",
    );
  });

  it("a escrita direta em lmap/rede_cnes continua só do administrador global", () => {
    expect(MIGRATION).not.toMatch(/alter policy|create policy|drop policy/i);
    expect(MIGRATION).not.toMatch(/grant (insert|update|delete|all)/i);
  });

  it("último acesso: o mais recente entre login, evento de uso e presença, numa função só", () => {
    const f = corpo(MIGRATION, 'create function private."FC_ULTIMO_ACESSO"(');
    expect(f).toMatch(/security definer\nset search_path = ''/);
    expect(f).toContain("greatest(");
    expect(f).toContain("au.last_sign_in_at");
    expect(f).toContain('public."TL_EVENTO_ACESSO"');
    expect(f).toContain('public."TB_PRESENCA_ONLINE_MONITORA"');
    expect(MIGRATION).toContain(
      'revoke all on function private."FC_ULTIMO_ACESSO"(uuid, text) from public, anon, authenticated;',
    );
    expect(MIGRATION).toMatch(
      /create index "IN_TLEVENTOACESSO_USUARIO_DATA" on public\."TL_EVENTO_ACESSO" \(user_id, created_at desc\);/,
    );

    const matriz = MIGRATION.slice(
      MIGRATION.indexOf(
        "CREATE OR REPLACE FUNCTION public.obter_matriz_acessos(",
      ),
      MIGRATION.indexOf("comment on function public.obter_matriz_acessos("),
    );
    expect(matriz).not.toContain("last_sign_in_at");
    expect(matriz).toContain(
      'private."FC_ULTIMO_ACESSO"(p.user_id, p.email) as ultimo_acesso_real',
    );
    expect(matriz).toContain("'ultimo_acesso', u.ultimo_acesso_real,");
    expect(matriz).toContain(
      "'convite_pendente', u.ultimo_acesso_real is null,",
    );

    const desativadas = corpo(
      MIGRATION.replace(/\$function\$;/g, () => "$$;"),
      "create or replace function public.listar_contas_desativadas(",
    );
    expect(desativadas).not.toContain("last_sign_in_at");
    expect(desativadas).toContain(
      "'ultimo_acesso', private.\"FC_ULTIMO_ACESSO\"(u.user_id, u.email)",
    );
    expect(ROLLBACK).toContain(
      'drop function if exists private."FC_ULTIMO_ACESSO"(uuid, text);',
    );
    expect(ROLLBACK).toMatch(/max\(au\.last_sign_in_at\)/);
  });

  it("o ensaio aplica o mesmo corpo e confere o que foi pedido, e termina em rollback", () => {
    const abre = "-- ═══ CORPO DA MIGRATION (início) ═══";
    const fecha = "-- ═══ CORPO DA MIGRATION (fim) ═══";
    const corpoEnsaio = ENSAIO.slice(
      ENSAIO.indexOf(abre) + abre.length,
      ENSAIO.indexOf(fecha),
    ).trim();
    const corpoMigration = MIGRATION.slice(
      MIGRATION.indexOf("\nbegin;\n") + "\nbegin;\n".length,
      MIGRATION.lastIndexOf("\ncommit;"),
    ).trim();
    expect(corpoEnsaio).toBe(corpoMigration);
    expect(ENSAIO.trim().endsWith("rollback;")).toBe(true);
    for (const passo of [
      "ok E1",
      "ok E2",
      "ok E3",
      "ok E4",
      "ok E5",
      "ok E6",
      "ENSAIO OK",
    ])
      expect(ENSAIO, passo).toContain(passo);
    // Troca de papel e volta antes de ler tabela sem grant.
    expect(ENSAIO.indexOf("set local role authenticated;")).toBeLessThan(
      ENSAIO.indexOf("reset role;"),
    );
    expect(ENSAIO).toContain("exception when sqlstate '42501'");
    expect(ENSAIO).toMatch(/> 1e-9/);
  });

  it("o contrato das RPCs do editor cita o Gestor", () => {
    for (const nome of [
      "salvar_coordenada_mapa_saude_indigena",
      "desfazer_coordenada_mapa_saude_indigena",
      "listar_historico_coordenada_mapa_saude_indigena",
      "listar_pendencias_coordenada_mapa_saude_indigena",
      "salvar_coordenada_mapa_projetos",
      "desfazer_coordenada_mapa_projetos",
      "listar_historico_coordenada_mapa_projetos",
      "listar_pendencias_coordenada_mapa_projetos",
    ])
      expect(CONTRATO_RPC[nome].resumo, nome).toMatch(
        /administrador global ou Gestor/,
      );
  });
});
