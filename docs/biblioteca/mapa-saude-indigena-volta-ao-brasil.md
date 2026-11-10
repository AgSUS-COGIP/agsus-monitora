---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Mapa da Saúde Indígena: a volta ao Brasil

Como o [[modulo-mapa-saude-indigena]] sai do mapa do DSEI e volta ao nacional
(`volta-ao-brasil.ts`: `usarVoltaDoDsei` e `usarEscParaVoltar`).

## O voo

- Ao sair do DSEI — "← Voltar ao Brasil", Esc, o chip "DSEI" da Visão geral, "Limpar tudo" —
  `usarVoltaDoDsei` entrega ao mapa nacional `{ k, lat, lon, focar, vez }`.
- O mapa parte da sede do distrito (zoom 7, sem animar) e voa em 0,8 s
  (`DURACAO_DA_VOLTA_AO_BRASIL`) até o enquadramento:
  - o Brasil, por `voarAoBrasil` (folga das bolhas, `maxZoom` `ZOOM_NACIONAL` 4.5; o `map-guard`
    desce o mínimo se a altura atual não couber);
  - ou, se ficaram filtros, a caixa/ponto do recorte.
- Com `prefers-reduced-motion: reduce`, enquadra sem animação.
- Durante o voo, o "apareceu" do ResizeObserver não reenquadra por cima.

## Foco e Esc

- **Foco.** Pelo botão ou Esc (`focar`), o foco vai à linha do DSEI em "Territórios por vagas"
  (`data-dsei`) ou, se ela não estiver na lista, ao mapa. Pelo chip da página, fica onde está.
- **Esc.** Ligado só com DSEI aberto, na captura do `document`; volta com o foco no mapa ou no
  `body` (nunca num campo, numa janela, no painel da Aya ou com um modal aberto).
- Na tela cheia, o primeiro Esc volta ao Brasil (`preventDefault`) e o `usarTelaCheia`, que ignora
  Esc já usado (`defaultPrevented`), só sai no segundo.

## Enquadramento do Brasil

- Por `BRASIL_BOUNDS` (contorno real), como o `map-guard`, em vez do retângulo antigo que cortava a
  ponta leste.
- Com folga da maior bolha (raio + traço + 12 px) e zoom mínimo que desce em quartos até o país
  caber (`src/lib/enquadramento-do-brasil.ts`, usado pelo `map-guard`).
- Os mapas React têm `enquadramentoProprio` (o guarda não reenquadra por cima) e reenquadram ao
  mudar de tamanho até a pessoa mexer (`criarMapaDoBrasil`).
- O mapa do DSEI é criado ao abrir o distrito e destruído ao sair (antes ficava montado escondido).

## Relacionadas

- [[modulo-mapa-saude-indigena]] — o mapa
- [[acessibilidade]] — foco, Esc e movimento reduzido
- [[mapas-e-leaflet]] — `map-guard` e enquadramento comum
- [[mapa-saude-indigena-legado]] — o que mudou em relação ao mapa antigo
