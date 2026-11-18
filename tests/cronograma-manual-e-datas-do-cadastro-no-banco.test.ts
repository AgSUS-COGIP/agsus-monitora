// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  AUTOMATICO,
  type Banco,
  DIVERGENTE,
  MANUAL,
  MIGRATION,
  SEM_ETAPAS,
  bancoDeHoje,
  datasDoCadastro,
  estado,
  md5DoCorpo,
  valor,
} from "./apoio/banco-do-cronograma.ts";

/*
  Migration 20261117190000 (aplicada em 18/11/2026; o SQL em
  tests/fixtures/sql-do-banco/) num Postgres de verdade (PGlite), antes × depois. Conferência de 17/11/2026:
  1. O edital com cálculo manual e etapas (caso do 120/2026: 13 etapas, status
     "Suspenso" digitado) não é "sem cronograma": o estado traz percentual,
     próxima etapa e datas; o status e a etapa digitados continuam valendo.
  2. As datas do cadastro acompanham as etapas quando o automático está ligado
     (gatilho adiado ao fim da transação), e o acerto pontual refaz as que
     divergem; o manual mantém as suas.
*/

const LONGO = 60_000;
const DIA = "2026-11-17";
const ESTADO = 'private."FC_ESTADO_DO_CRONOGRAMA"(uuid, date)';
const RESUMO = "public.get_nucleo_cronograma_resumo()";

let db: Banco;
beforeAll(() => bancoDeHoje(), LONGO);
beforeEach(async () => {
  db = await bancoDeHoje();
}, LONGO);

const migrar = () => db.exec(MIGRATION);
const semChavesNovas = (e: Record<string, unknown>) => {
  const { calculo: _c, situacao: _s, ...resto } = e;
  return resto;
};

describe("antes (o defeito da conferência)", () => {
  it("o edital manual com 13 etapas sai como sem cronograma", async () => {
    const e = await estado(db, MANUAL, DIA);
    expect(e.tem_cronograma).toBe(false);
    expect(e.percentual).toBe(0);
    expect(e.proxima_atividade).toBeNull();
  });

  it("a guarda da migration reconhece os corpos de antes", async () => {
    expect(await md5DoCorpo(db, ESTADO)).toBe(
      "f1a2b05143c74861b1a4971f937ac9cf",
    );
    expect(await md5DoCorpo(db, RESUMO)).toBe(
      "436e0e97170a4d8ee43e01705ff574fb",
    );
  });
});

describe("depois", () => {
  beforeEach(() => migrar(), LONGO);

  it("120/2026: etapas cadastradas, cálculo manual, suspenso", async () => {
    const e = await estado(db, MANUAL, DIA);
    expect(e).toMatchObject({
      tem_cronograma: true,
      calculo: "manual",
      situacao: "suspenso",
      status: "Suspenso",
      total_etapas: 13,
      etapas_concluidas: 2,
      percentual: 15.4,
      proxima_atividade: "Período de inscrição",
      proxima_data: "2026-11-19",
      dias_para_proxima: 2,
      data_inicio: "2026-10-21",
      data_fim: "2027-02-25",
    });
    // Sem etapa digitada, a calculada.
    expect(e.etapa).toBe("Aguardando: Período de inscrição");
  });

  it("o status excepcional vale por cima do digitado", async () => {
    await db.query(
      `update public."TB_MONITORAMENTO_INDIGENA" set status_override = 'Paralisado' where id = $1`,
      [MANUAL],
    );
    const e = await estado(db, MANUAL, DIA);
    expect(e.status).toBe("Paralisado");
    expect(e.situacao).toBe("paralisado");
  });

  it("o automático tem o mesmo estado de antes (mais cálculo e situação)", async () => {
    const hoje = await bancoDeHoje();
    for (const edital of [AUTOMATICO, DIVERGENTE]) {
      const antes = await estado(hoje, edital, DIA);
      const depois = await estado(db, edital, DIA);
      expect(semChavesNovas(depois)).toEqual(antes);
      expect(depois.calculo).toBe("automatico");
      expect(depois.situacao).toBeNull();
    }
  });

  it("sem etapas continua sem cronograma, com o status digitado", async () => {
    const e = await estado(db, SEM_ETAPAS, DIA);
    expect(e).toMatchObject({
      tem_cronograma: false,
      calculo: "manual",
      situacao: null,
      status: "Em andamento",
      etapa: "Inscrições",
      percentual: 0,
    });
  });

  it("resumo do Núcleo: o manual suspenso é excepcional, não sem cronograma", async () => {
    const resumo = await valor<Record<string, unknown>[]>(db, RESUMO);
    const porId = new Map(resumo.map((r) => [r.id, r]));
    expect(porId.get(MANUAL)).toMatchObject({
      alerta_tipo: "excepcional",
      tem_cronograma: true,
      calculo: "manual",
      situacao: "suspenso",
    });
    expect(porId.get(SEM_ETAPAS)).toMatchObject({
      alerta_tipo: "sem_cronograma",
      tem_cronograma: false,
    });
  });

  it("o acerto refaz as datas do automático que divergiam, e só elas", async () => {
    expect(await datasDoCadastro(db, DIVERGENTE)).toEqual({
      inicio: "2026-09-08",
      fim: "2026-12-03",
    });
    expect(await datasDoCadastro(db, AUTOMATICO)).toEqual({
      inicio: "2026-06-16",
      fim: "2026-08-12",
    });
    // O manual mantém as datas do cadastro, mesmo com etapas até 25/02/2027.
    expect(await datasDoCadastro(db, MANUAL)).toEqual({
      inicio: "2026-10-21",
      fim: "2026-12-10",
    });
  });

  it("o gatilho leva as datas do automático às etapas, por qualquer caminho", async () => {
    // Errata: a última etapa muda de data.
    await db.query(
      `update public."TB_CRONOGRAMA_MONIT_INDIG" set data_fim = '2026-08-26', data_inicio = '2026-08-26'
        where monitoramento_id = $1 and ordem = 2`,
      [AUTOMATICO],
    );
    expect((await datasDoCadastro(db, AUTOMATICO))?.fim).toBe("2026-08-26");
    // Etapa nova antes da primeira.
    await db.query(
      `insert into public."TB_CRONOGRAMA_MONIT_INDIG" (monitoramento_id, ordem, atividade, data_inicio, data_fim)
       values ($1, 0, 'Aviso prévio', '2026-06-01', '2026-06-02')`,
      [AUTOMATICO],
    );
    expect((await datasDoCadastro(db, AUTOMATICO))?.inicio).toBe("2026-06-01");
    // Sem etapas, as datas ficam.
    await db.query(
      `delete from public."TB_CRONOGRAMA_MONIT_INDIG" where monitoramento_id = $1`,
      [AUTOMATICO],
    );
    expect(await datasDoCadastro(db, AUTOMATICO)).toEqual({
      inicio: "2026-06-01",
      fim: "2026-08-26",
    });
  });

  it("o gatilho não toca o manual", async () => {
    await db.query(
      `update public."TB_CRONOGRAMA_MONIT_INDIG" set data_fim = '2027-03-01' where monitoramento_id = $1 and ordem = 13`,
      [MANUAL],
    );
    expect((await datasDoCadastro(db, MANUAL))?.fim).toBe("2026-12-10");
  });

  it("apaga e reinsere numa transação (o salvar) grava as datas uma vez, no fim", async () => {
    await db.exec(`
      create table public.gravacoes (fim date);
      create function public.contar() returns trigger language plpgsql as $$
      begin insert into public.gravacoes values (new.data_fim); return null; end $$;
      create trigger contar after update on public."TB_MONITORAMENTO_INDIGENA"
        for each row execute function public.contar();
    `);
    await db.exec(`
      begin;
      delete from public."TB_CRONOGRAMA_MONIT_INDIG" where monitoramento_id = '${AUTOMATICO}';
      insert into public."TB_CRONOGRAMA_MONIT_INDIG" (monitoramento_id, ordem, atividade, data_inicio, data_fim) values
        ('${AUTOMATICO}', 1, 'Publicação do Edital', '2026-06-16', '2026-06-16');
      insert into public."TB_CRONOGRAMA_MONIT_INDIG" (monitoramento_id, ordem, atividade, data_inicio, data_fim) values
        ('${AUTOMATICO}', 2, 'Resultado', '2026-07-01', '2026-07-01');
      insert into public."TB_CRONOGRAMA_MONIT_INDIG" (monitoramento_id, ordem, atividade, data_inicio, data_fim) values
        ('${AUTOMATICO}', 3, 'Resultado final do Processo Seletivo', '2026-09-30', '2026-09-30');
      commit;
    `);
    const gravacoes = await db.query<{ fim: string }>(
      `select fim::text as fim from public.gravacoes`,
    );
    expect(gravacoes.rows).toEqual([{ fim: "2026-09-30" }]);
  });

  it("a guarda recusa aplicar de novo", async () => {
    await expect(migrar()).rejects.toThrow(/md5/);
  });
});
