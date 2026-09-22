import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { urlDoTunel } from "../scripts/endereco-do-tunel.mjs";

/*
  A AYA FICOU SEM IA COM O LOG A DIZER QUE ESTAVA TUDO BEM

  O serviço da Aya sobe o bridge local, sobe um quick tunnel da Cloudflare e
  anuncia o endereço do túnel no banco. `/api/aya` lê esse endereço. Duas falhas
  no anúncio deixaram a Aya sem IA sem deixar rasto:

  1. O batimento reanunciava o mesmo endereço de cinco em cinco minutos sem
     nunca perguntar se ele ainda existia. Um quick tunnel é derrubado do lado
     da Cloudflare — o hostname deixa de resolver e o processo local continua de
     pé —, e o serviço passou horas a anunciar
     `special-considers-tips-immigration.trycloudflare.com`, que não resolvia em
     resolvedor nenhum. Pior: o registo ficava sempre fresco, e a defesa do
     outro lado, que recusa registo com mais de 30 minutos, nunca disparava.

  2. Ao reiniciar, o serviço anunciou `https://api.trycloudflare.com`. Quando o
     pedido de túnel falha, o cloudflared menciona no erro o seu próprio
     serviço, e a expressão que lia a saída aceitava-o como se fosse a máquina.
*/
describe("o que conta como endereço de túnel", () => {
  const banner = `2026-09-21T19:29:36Z INF +------------------------------------+
2026-09-21T19:29:36Z INF |  Your quick Tunnel has been created! Visit it at:  |
2026-09-21T19:29:36Z INF |  https://assessment-necklace-weight-pichunter.trycloudflare.com  |
2026-09-21T19:29:36Z INF +------------------------------------+`;

  it("lê o hostname da moldura que o cloudflared imprime", () => {
    expect(urlDoTunel(banner)).toBe(
      "https://assessment-necklace-weight-pichunter.trycloudflare.com",
    );
  });

  it("recusa o serviço da própria Cloudflare", () => {
    expect(
      urlDoTunel(
        "failed to request quick Tunnel: https://api.trycloudflare.com/tunnel",
      ),
    ).toBe("");
    expect(urlDoTunel("https://www.trycloudflare.com")).toBe("");
  });

  /*
    O hostname de um quick tunnel é sempre um punhado de palavras com hífen.
    Um nome de uma palavra só é da Cloudflare, não de uma máquina nossa.
  */
  it("recusa hostname de palavra única", () => {
    expect(urlDoTunel("https://qualquercoisa.trycloudflare.com")).toBe("");
  });

  it("não confunde com os outros domínios do aviso de arranque", () => {
    const aviso =
      "Thank you for trying Cloudflare Tunnel ... (https://www.cloudflare.com/website-terms/) ... https://developers.cloudflare.com/cloudflare-one/";
    expect(urlDoTunel(aviso)).toBe("");
  });

  it("aguenta lixo", () => {
    expect(urlDoTunel("")).toBe("");
    expect(urlDoTunel(null)).toBe("");
    expect(urlDoTunel(undefined)).toBe("");
  });
});

/*
  O resto do serviço não se testa por chamada — sobe processos e fala com a
  Cloudflare. O que estes casos guardam é que as defesas continuam ligadas no
  lugar onde têm de estar, porque foi a ausência delas que causou a avaria, e
  porque a primeira tentativa de as ligar causou outra.
*/
describe("as defesas do anúncio continuam no lugar", () => {
  const servico = readFileSync("scripts/aya-servico.mjs", "utf8");

  it("nada é anunciado antes de o hostname existir", () => {
    expect(servico).toContain("await esperarOTunelAbrir(url)");
  });

  it("o batimento confere antes de reanunciar", () => {
    expect(servico).toContain(
      "(await hostnameDoTunelExiste(urlAtual)) === false",
    );
  });

  /*
    A primeira versão desta defesa buscava o /health do próprio túnel. Nesta
    rede isso derrubava túnel bom em ciclo: o resolvedor local não resolve
    `*.trycloudflare.com` de todo, enquanto 1.1.1.1 e 8.8.8.8 resolvem o mesmo
    hostname no mesmo instante. Quem lê o anúncio é a função em `/api/aya`, que
    resolve pela rede dela — julgar o túnel pelo resolvedor daqui é julgá-lo por
    um impedimento que não é dele.
  */
  it("a pergunta atravessa o resolvedor da rede", () => {
    expect(servico).toContain("https://dns.google/resolve");
    expect(servico).toContain("application/dns-json");
  });

  /*
    NXDOMAIN é o único veredito negativo aceite. Rede fora ou resolvedor sem
    resposta devolve `null`, e sem veredito não se derruba nada: falso negativo
    custa uma troca de túnel à toa, falso positivo custa a Aya inteira.
  */
  it("só NXDOMAIN derruba o túnel", () => {
    expect(servico).toContain("if (dados?.Status === 3) return false;");
    expect(servico).toContain("if (dados?.Status !== 0) return null;");
  });

  it("o túnel que deixou de existir é derrubado, para vir outro", () => {
    expect(servico).toContain("processoDoTunel?.kill()");
  });

  /*
    Sem esta reatribuição, a referência aponta para um processo morto depois da
    primeira troca, e nenhuma queda seguinte volta a ser tratada.
  */
  it("o reinício atualiza a referência do processo", () => {
    expect(servico).toContain("processoDoTunel = subirTunel(aoObterUrl)");
  });
});
