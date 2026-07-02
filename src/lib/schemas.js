import { z } from "zod";

export const accessProfileSchema = z.enum(["leitor", "editor", "admin", "master"]);

export const accessRequestSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  nome: z.string().trim().min(2, "Informe o nome."),
  email: z.string().trim().email("Informe um e-mail valido."),
  setor: z.string().trim().optional().default(""),
  justificativa: z.string().trim().optional().default(""),
  perfil_solicitado: accessProfileSchema.default("leitor"),
  status: z.enum(["pendente", "aprovado", "recusado"]).default("pendente"),
  observacao_admin: z.string().trim().optional().default("")
});

export const panelSchema = z.object({
  id: z.union([z.string(), z.number()]),
  codigo: z.string().trim().optional().default(""),
  titulo: z.string().trim().optional().default(""),
  url: z.string().trim().optional().default(""),
  ativo: z.boolean().optional().default(true)
});

export const dashboardRowSchema = z.record(z.string(), z.unknown());

export function parseAccessRequest(input) {
  return accessRequestSchema.parse(input);
}

export function parsePanelList(input) {
  return z.array(panelSchema).parse(input ?? []);
}

export function safeParseList(schema, input) {
  const result = z.array(schema).safeParse(input ?? []);
  return result.success ? result.data : [];
}
