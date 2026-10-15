import { nomeDaArea } from "../../lib/menu-lateral.ts";

/*
  Embaixo da lista da Equipe, só para a coordenação: quem aparece em
  "Pessoa" e como incluir outra pessoa. A lista vem de obter_equipe_edital
  (20261006100000): contas ativas com Editor ou mais em Avaliação documental
  que veem o edital (a área do edital no perfil e, com coordenação, o
  recorte dela). Quem não está lá precisa desse acesso, liberado em
  Configurações › Acessos (o sistema é só por convite).
*/
export function QuemEntraNaEquipe({
  quantas,
  area,
}: {
  quantas: number;
  area: string | null | undefined;
}) {
  const rotulo = nomeDaArea(area);
  const daArea = rotulo ? `a área ${rotulo}` : "a área do edital";
  return (
    <p className="ui-texto-secundario avd-quem-entra" data-quem-entra>
      Em “Pessoa” {quantas === 1 ? "aparece" : "aparecem"}{" "}
      {quantas === 1 ? "1 pessoa" : `${quantas} pessoas`}: quem tem {daArea} e
      Editor (ou mais) em Avaliação documental. Para incluir outra, peça a um
      administrador em Configurações › Acessos: {daArea} e Editor em Avaliação
      documental (quem ainda não tem conta recebe o convite lá).
    </p>
  );
}
