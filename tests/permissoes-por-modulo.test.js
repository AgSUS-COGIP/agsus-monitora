import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MODULOS,
  MODULOS_VALIDOS,
  NIVEIS_VALIDOS,
  NIVEL_PADRAO,
  diferencaDeMatrizes,
  forcaDoNivel,
  matrizDoPerfil,
  moduloValido,
  nivelNoModulo,
  normalizarNivel,
  podeAdministrar,
  podeEditar,
  podeLer,
  rotuloDoModulo,
  rotuloDoNivel,
} from "../src/lib/permissoes-por-modulo.js";
import { PERFIS_VALIDOS } from "../src/lib/perfis-de-acesso.js";

describe("o vocabulário", () => {
  it("tem os quatro níveis, na ordem em que crescem", () => {
    expect(NIVEIS_VALIDOS).toEqual(["sem_acesso", "leitor", "editor", "admin"]);
    expect(forcaDoNivel("sem_acesso")).toBe(0);
    expect(forcaDoNivel("leitor")).toBe(1);
    expect(forcaDoNivel("editor")).toBe(2);
    expect(forcaDoNivel("admin")).toBe(3);
  });

  /*
    O padrão de um sistema de permissão erra para o lado de não deixar entrar.
    Valor desconhecido, nulo, vazio ou de outro vocabulário cai em `sem_acesso`.
  */
  it("o que não se reconhece não abre porta", () => {
    expect(normalizarNivel(undefined)).toBe(NIVEL_PADRAO);
    expect(normalizarNivel(null)).toBe(NIVEL_PADRAO);
    expect(normalizarNivel("")).toBe(NIVEL_PADRAO);
    expect(normalizarNivel("master")).toBe(NIVEL_PADRAO);
    expect(normalizarNivel("Leitor ")).toBe("leitor");
    expect(NIVEL_PADRAO).toBe("sem_acesso");
  });

  it("os sete módulos têm id, rótulo e descrição", () => {
    expect(MODULOS).toHaveLength(7);
    for (const m of MODULOS) {
      expect(m.id, "módulo sem id").toBeTruthy();
      expect(m.rotulo, `${m.id} sem rótulo`).toBeTruthy();
      expect(m.descricao, `${m.id} sem descrição`).toBeTruthy();
    }
    expect(new Set(MODULOS_VALIDOS).size).toBe(MODULOS.length);
  });

  it("módulo que não existe não é módulo", () => {
    expect(moduloValido("dashboard")).toBe(true);
    expect(moduloValido("folha_de_pagamento")).toBe(false);
    expect(rotuloDoModulo("configuracoes")).toBe("Configurações");
    expect(rotuloDoNivel("editor")).toBe("Editor");
  });

  it("as fronteiras de leitura, escrita e administração", () => {
    expect(podeLer("sem_acesso")).toBe(false);
    expect(podeLer("leitor")).toBe(true);
    expect(podeEditar("leitor")).toBe(false);
    expect(podeEditar("editor")).toBe(true);
    expect(podeAdministrar("editor")).toBe(false);
    expect(podeAdministrar("admin")).toBe(true);
  });
});

/*
  A SEMENTE É O PONTO DE RISCO DESTA MUDANÇA

  No dia em que a migration correr, cada pessoa passa de um perfil global para
  sete células. Se a tradução não for fiel, alguém perde acesso ao que usa para
  trabalhar — ou ganha acesso ao que não devia ver. Estes casos travam as duas
  direções.
*/
describe("a semente a partir dos quatro perfis", () => {
  it("cobre exatamente os perfis que existem", () => {
    for (const perfil of PERFIS_VALIDOS) {
      const matriz = matrizDoPerfil(perfil);
      expect(Object.keys(matriz).sort()).toEqual([...MODULOS_VALIDOS].sort());
    }
  });

  /*
    A regra que o banco aplica hoje: p_ind, p_cores e p_paineis são `true` para
    todos os perfis. Quem tem perfil vê todos os módulos — menos Configurações.
  */
  it("quem tem perfil continua a ver o que já via", () => {
    for (const perfil of ["usuario", "edital_gestor", "contratador"]) {
      const matriz = matrizDoPerfil(perfil);
      for (const modulo of MODULOS_VALIDOS) {
        if (modulo === "configuracoes") continue;
        expect(podeLer(matriz[modulo]), `${perfil} perdeu ${modulo}`).toBe(
          true,
        );
      }
    }
  });

  /*
    p_config e p_admin são `true` só para admin. Configurações é a única porta
    que os outros três perfis não têm, e tem de continuar assim.
  */
  it("só o admin entra em Configurações", () => {
    expect(matrizDoPerfil("usuario").configuracoes).toBe("sem_acesso");
    expect(matrizDoPerfil("edital_gestor").configuracoes).toBe("sem_acesso");
    expect(matrizDoPerfil("contratador").configuracoes).toBe("sem_acesso");
    expect(matrizDoPerfil("admin").configuracoes).toBe("admin");
  });

  it("o admin administra tudo", () => {
    const matriz = matrizDoPerfil("admin");
    for (const modulo of MODULOS_VALIDOS) {
      expect(podeAdministrar(matriz[modulo]), modulo).toBe(true);
    }
  });

  /*
    `usuario` é definido como "vê tudo, não altera nada". Uma única célula de
    escrita nesse perfil seria a migração a conceder o que ninguém pediu.
  */
  it("usuario não ganha escrita em lado nenhum", () => {
    const matriz = matrizDoPerfil("usuario");
    for (const modulo of MODULOS_VALIDOS) {
      expect(podeEditar(matriz[modulo]), `usuario escreve em ${modulo}`).toBe(
        false,
      );
    }
  });

  /*
    E as escritas que os perfis intermédios têm, têm de sobreviver: um
    contratador que não mexe na lista de aprovados não consegue trabalhar.
  */
  it("o gestor de edital mantém o calendário, e só ele", () => {
    const matriz = matrizDoPerfil("edital_gestor");
    expect(podeEditar(matriz.calendario)).toBe(true);
    expect(podeEditar(matriz.aprovados)).toBe(false);
  });

  it("o contratador mantém a lista de aprovados", () => {
    const matriz = matrizDoPerfil("contratador");
    expect(podeEditar(matriz.aprovados)).toBe(true);
    expect(podeEditar(matriz.calendario)).toBe(true);
  });

  /*
    Sem perfil não é `usuario`: é ausência de acesso. `normalizarPerfil` já faz
    essa distinção, e a matriz não pode desfazê-la.
  */
  it("sem perfil, nenhuma porta", () => {
    for (const valor of ["", null, undefined, "perfil_inventado"]) {
      const matriz = matrizDoPerfil(valor);
      for (const modulo of MODULOS_VALIDOS) {
        expect(podeLer(matriz[modulo]), `${valor} leu ${modulo}`).toBe(false);
      }
    }
  });
});

describe("o nível de uma pessoa num módulo", () => {
  it("a linha gravada vale mais que o perfil", () => {
    const matriz = { aprovados: "editor" };
    expect(nivelNoModulo(matriz, "aprovados", "usuario")).toBe("editor");
  });

  /*
    Um módulo novo entra no sistema sem linha nenhuma na tabela. Devolver
    `sem_acesso` aí trancava toda a gente fora dele no instante em que fosse
    criado — por isso cai para o que o perfil concederia.
  */
  it("módulo sem linha cai no que o perfil daria", () => {
    expect(nivelNoModulo({}, "dashboard", "usuario")).toBe("leitor");
    expect(nivelNoModulo({}, "configuracoes", "usuario")).toBe("sem_acesso");
    expect(nivelNoModulo({}, "configuracoes", "admin")).toBe("admin");
  });

  it("valor inválido na linha não vale como linha", () => {
    expect(nivelNoModulo({ dashboard: "chefe" }, "dashboard", "admin")).toBe(
      "admin",
    );
  });

  it("módulo que não existe não devolve acesso", () => {
    expect(nivelNoModulo({ folha: "admin" }, "folha", "admin")).toBe(
      "sem_acesso",
    );
  });
});

describe("o que mudou antes de gravar", () => {
  it("lista só as células alteradas", () => {
    const antes = matrizDoPerfil("usuario");
    const depois = { ...antes, aprovados: "editor", nucleo: "sem_acesso" };
    expect(diferencaDeMatrizes(antes, depois)).toEqual([
      { modulo: "nucleo", de: "leitor", para: "sem_acesso" },
      { modulo: "aprovados", de: "leitor", para: "editor" },
    ]);
  });

  it("matriz igual não tem o que gravar", () => {
    const m = matrizDoPerfil("contratador");
    expect(diferencaDeMatrizes(m, { ...m })).toEqual([]);
  });
});

/*
  O ficheiro JS e a migration descrevem a mesma matriz. Se divergirem, a
  interface oferece o que o banco recusa — que é o defeito que
  `perfis-de-acesso.js` já tinha documentado ao juntar perfil e caixas `p_*`.
*/
describe("o JS e a migration dizem o mesmo", () => {
  const sql = readFileSync(
    "supabase/migrations/20260922160000_permissoes_por_modulo.sql",
    "utf8",
  );

  it("a migration semeia os sete módulos", () => {
    for (const modulo of MODULOS_VALIDOS) {
      expect(sql, `${modulo} não aparece na migration`).toContain(
        `'${modulo}'`,
      );
    }
  });

  it("a migration conhece os quatro níveis", () => {
    for (const nivel of NIVEIS_VALIDOS) {
      expect(sql, `${nivel} não aparece na migration`).toContain(`'${nivel}'`);
    }
  });

  /*
    A tabela nova tem de nascer com RLS. Uma tabela de permissões legível por
    qualquer autenticado entrega o mapa de quem pode o quê.
  */
  it("a tabela nasce com RLS ligada", () => {
    expect(sql).toContain("enable row level security");
  });

  it("só admin escreve, e é o banco que verifica", () => {
    expect(sql).toContain("private.is_master()");
  });
});
