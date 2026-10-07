import { dataHora } from "../../lib/saude-das-cargas.ts";
import { Aviso } from "../../ui/index.js";

/*
  Status das atualizações › linha "Agenda dos robôs" (20261008140000): o banco
  pede ao GitHub as execuções agendadas (pg_cron + pg_net). Uma frase curta
  embaixo da linha: o último pedido aceito e as falhas das últimas 24 h; sem a
  chave github_disparo_robos no Vault, o aviso que pede ação. O porquê e o que
  fazer quando a chave expira ficam com a Aya (regras-do-status-das-atualizacoes).
*/

export type ResumoDaAgenda = {
  chaveCadastrada: boolean | null;
  ultimoAceito: Date | null;
  falhas24h: number;
  semChave24h: number;
};

const contagem = (n: number, um: string, varios: string) =>
  `${n} ${n === 1 ? um : varios}`;

export function textoDaAgenda(agenda: ResumoDaAgenda): string {
  const partes = [
    agenda.ultimoAceito
      ? `Último pedido aceito: ${dataHora(agenda.ultimoAceito)}`
      : "Nenhum pedido aceito ainda",
  ];
  if (agenda.falhas24h > 0)
    partes.push(`${contagem(agenda.falhas24h, "falha", "falhas")} em 24 h`);
  if (agenda.semChave24h > 0)
    partes.push(
      `${contagem(agenda.semChave24h, "pedido", "pedidos")} sem chave em 24 h`,
    );
  return partes.join(" · ");
}

export function AgendaDosRobos({ agenda }: { agenda: ResumoDaAgenda }) {
  if (agenda.chaveCadastrada === false)
    return (
      <Aviso tom="danger" papel="alert" como="p" className="saude-agenda">
        Sem chave no Vault: os robôs não rodam sozinhos. Cadastre{" "}
        <code>github_disparo_robos</code>.
      </Aviso>
    );
  return (
    <p className="saude-agenda" role="status">
      {textoDaAgenda(agenda)}
    </p>
  );
}
