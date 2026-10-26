import { useSyncExternalStore } from "react";
import { montarModulo } from "../../app/montar-modulo.tsx";
import { Icone } from "../../componentes/icone.tsx";
import {
  numeroCurto,
  selosDoPerfil,
  tituloDeQuemFechou,
} from "../../lib/encerramento-do-edital.ts";
import type { EstadoDoEncerramentoControle } from "./estado.ts";
import "./encerramento-do-edital.css";

/*
  Selos do edital no perfil (menu da conta, no topo): um por edital encerrado
  em que a pessoa concluiu ao menos uma ficha ("114/2026"); quem fechou o
  edital leva "fechou o 114". Derivados do banco (obter_encerramentos_do_edital):
  sem edital encerrado, nada aparece. A marca no avatar só diz que há selo.
*/

function usarSelos(estado: EstadoDoEncerramentoControle) {
  const atual = useSyncExternalStore(estado.assinar, estado.obter);
  return selosDoPerfil(atual.encerramentos);
}

export function SelosDoEdital({
  estado,
}: {
  estado: EstadoDoEncerramentoControle;
}) {
  const selos = usarSelos(estado);
  if (!selos.length) return null;
  return (
    <ul className="selos-do-edital" aria-label="Selos de editais">
      {selos.map((selo) => (
        <li
          key={selo.id}
          className="selo-do-edital"
          data-fechou={selo.fechou ? "sim" : undefined}
          title={selo.titulo}
        >
          <Icone nome={selo.fechou ? "star" : "award"} tamanho={14} />
          <span>{selo.numero}</span>
          {selo.fechou ? (
            <span className="selo-do-edital-fechou">
              {tituloDeQuemFechou(selo.numero)}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function MarcaDeSeloNoAvatar({
  estado,
}: {
  estado: EstadoDoEncerramentoControle;
}) {
  const selos = usarSelos(estado);
  if (!selos.length) return null;
  const fechou = selos.find((s) => s.fechou);
  const rotulo = fechou
    ? `Você fechou o edital ${numeroCurto(fechou.numero)}`
    : `Selo do edital ${selos.at(-1)!.numero}`;
  return (
    <span
      className="selo-no-avatar-marca"
      data-fechou={fechou ? "sim" : undefined}
      role="img"
      aria-label={rotulo}
      title={rotulo}
    >
      <Icone nome={fechou ? "star" : "award"} tamanho={11} traco={2.25} />
    </span>
  );
}

export function montarSelosDoEdital({
  lista = globalThis.document?.getElementById("selosDoEditalApp"),
  avatar = globalThis.document?.getElementById("seloNoAvatarApp"),
  estado,
}: {
  lista?: HTMLElement | null;
  avatar?: HTMLElement | null;
  estado: EstadoDoEncerramentoControle;
}) {
  return [
    lista
      ? montarModulo(lista, <SelosDoEdital estado={estado} />, {
          nome: "Selos do edital",
        })
      : null,
    avatar
      ? montarModulo(avatar, <MarcaDeSeloNoAvatar estado={estado} />, {
          nome: "Selo no avatar",
        })
      : null,
  ];
}
