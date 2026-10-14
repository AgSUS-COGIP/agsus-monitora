import { normalizarModelo } from "../modelo-de-convocacao.js";
import type { RegistroDoMotor } from "./tipos-do-motor.ts";
import type {
  ConvocacaoDoEdital,
  ModeloDaConvocacao,
} from "./tipos-das-vagas.ts";

export function registroDoMotor(valor: unknown): RegistroDoMotor {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? Object.fromEntries(Object.entries(valor))
    : {};
}

export function ordemDoMotor(valor: unknown): string[] {
  if (valor == null) return [];
  if (!Array.isArray(valor))
    throw new Error("Ordem de desempate inválida. Recarregue o edital.");
  return valor.map(String);
}

function texto(valor: unknown): string {
  if (typeof valor !== "string")
    throw new Error(
      "Configuração de convocação inválida. Recarregue o edital.",
    );
  return valor;
}

function quantidade(valor: unknown): number {
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor < 0)
    throw new Error(
      "Configuração de convocação inválida. Recarregue o edital.",
    );
  return valor;
}

function entradas(valor: unknown): [string, unknown][] {
  if (!(valor instanceof Map))
    throw new Error(
      "Configuração de convocação inválida. Recarregue o edital.",
    );
  return Array.from(valor.entries(), ([chave, item]: [unknown, unknown]) => [
    texto(chave),
    item,
  ]);
}

function modeloDoMotor(valor: unknown): ModeloDaConvocacao {
  const modelo = registroDoMotor(valor);
  if (!Array.isArray(modelo.categorias))
    throw new Error("Modelo de convocação inválido. Recarregue o edital.");
  for (const valor of modelo.categorias) {
    const categoria = registroDoMotor(valor);
    texto(categoria.id);
    texto(categoria.rotulo);
    texto(categoria.sigla);
    quantidade(categoria.percentual);
    quantidade(categoria.minimo);
    if (typeof categoria.ampla !== "boolean")
      throw new Error("Modelo de convocação inválido. Recarregue o edital.");
  }
  return normalizarModelo(modelo);
}

/** A ponte já normalizada tem Map; JSON incompleto não pode gerar uma lista parcial. */
export function convocacaoDoMotor(valor: unknown): ConvocacaoDoEdital | null {
  if (valor == null) return null;
  const c = registroDoMotor(valor);
  const configs: ConvocacaoDoEdital["configs"] = new Map(
    entradas(c.configs).map(([chave, valor]) => {
      const config = registroDoMotor(valor);
      if (typeof config.proporcionalidade !== "boolean")
        throw new Error(
          "Configuração de convocação inválida. Recarregue o edital.",
        );
      return [
        chave,
        {
          modeloId: texto(config.modeloId),
          padraoImediata: quantidade(config.padraoImediata),
          proporcionalidade: config.proporcionalidade,
          vagas: new Map(
            entradas(config.vagas).map(([codigo, valor]) => {
              const vaga = registroDoMotor(valor);
              if (
                typeof vaga.manual !== "boolean" ||
                vaga.quadro === null ||
                typeof vaga.quadro !== "object" ||
                Array.isArray(vaga.quadro)
              )
                throw new Error(
                  "Configuração de convocação inválida. Recarregue o edital.",
                );
              return [
                codigo,
                {
                  cargo: texto(vaga.cargo),
                  imediatas: quantidade(vaga.imediatas),
                  manual: vaga.manual,
                  quadro: registroDoMotor(vaga.quadro),
                },
              ];
            }),
          ),
        },
      ];
    }),
  );
  return {
    editalId: texto(c.editalId),
    modeloId: texto(c.modeloId),
    modeloNome: texto(c.modeloNome),
    modelo: c.modelo == null ? null : modeloDoMotor(c.modelo),
    configs,
    modelos: new Map(
      entradas(c.modelos).map(([chave, valor]) => [
        chave,
        modeloDoMotor(valor),
      ]),
    ),
  };
}
