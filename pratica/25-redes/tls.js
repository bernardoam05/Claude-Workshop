// P4 · TLS: ligar a um servidor HTTPS e ler o certificado que ele apresenta.
import tls from 'node:tls';

// inspecionar({ host, porta, ca, servername })
//   → Promise<{ autorizado, erro, protocolo, sujeito, emissor, validoAte, nomes }>
//
// Liga com tls.connect, SEM recusar certificados inválidos (rejectUnauthorized: false), para
// poder mostrar o que está mal em vez de rebentar. ca é opcional (um certificado de uma CA em que
// confiamos, em PEM); servername é o nome pedido (SNI), por omissão o host.
//   autorizado: socket.authorized (o Node confia no certificado?)
//   erro:       socket.authorizationError (ex.: "DEPTH_ZERO_SELF_SIGNED_CERT"), ou null
//   protocolo:  socket.getProtocol() (ex.: "TLSv1.3")
//   sujeito:    o CN do sujeito do certificado
//   emissor:    o CN do emissor
//   validoAte:  um Date com o fim da validade (valid_to)
//   nomes:      a lista dos nomes do subjectaltname, sem o prefixo "DNS:"
//               ("DNS:a.pt, DNS:b.pt" → ["a.pt", "b.pt"])
// Fecha a ligação no fim (socket.end()).
export function inspecionar({ host, porta, ca, servername }) {
  throw new Error('Por fazer: P4');
}
