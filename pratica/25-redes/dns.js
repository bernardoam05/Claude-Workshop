// P2 · O DNS por dentro: construir uma pergunta e ler a resposta, byte a byte (RFC 1035).
//
// Cabeçalho (12 bytes, números em big-endian):
//   id (2) · flags (2) · nº de perguntas (2) · nº de respostas (2) · autoridade (2) · adicionais (2)
//   Numa pergunta normal: flags = 0x0100 (só o bit "recursion desired"), 1 pergunta, 0 no resto.
// Pergunta: o NOME em "labels" (cada parte precedida do seu tamanho, e um 0 no fim):
//   "api.ex.pt" → 3 'a' 'p' 'i' 2 'e' 'x' 2 'p' 't' 0
//   seguido do TIPO (2 bytes; A = 1) e da CLASSE (2 bytes; IN = 1).

// construirPergunta(0x1234, "api.ex.pt") → um Buffer com a pergunta do registo A desse nome.
export function construirPergunta(id, nome) {
  throw new Error('Por fazer: P2');
}

// lerNome(buf, pos) → { nome, fim }: lê um nome a partir da posição pos.
// ATENÇÃO à COMPRESSÃO: um byte que começa com os bits 11 (>= 0xC0) não é um tamanho, é um
// ponteiro de 2 bytes: os outros 14 bits dizem onde, no pacote, continua o nome.
// "fim" é a posição a seguir ao nome NO SÍTIO ONDE COMEÇOU (depois do ponteiro, se houver).
export function lerNome(buf, pos) {
  throw new Error('Por fazer: P2');
}

// lerResposta(buf) → { id, rcode, respostas: [{ nome, tipo, ttl, ip }] }
//   rcode: os 4 bits mais baixos das flags (0 = ok, 3 = o nome não existe: NXDOMAIN)
//   salta a(s) pergunta(s) (nome + 4 bytes); cada resposta é:
//     nome · tipo (2) · classe (2) · ttl (4) · tamanho dos dados (2) · dados
//   ip: só para o tipo A (4 bytes → "1.2.3.4"); para os outros tipos, ip = null
export function lerResposta(buf) {
  throw new Error('Por fazer: P2');
}

// perguntar({ nome, servidor, porta = 53, timeout = 2000 }) → Promise<resposta lida>
// Envia a pergunta por UDP (node:dgram, socket "udp4") com um id aleatório de 16 bits, espera pela
// resposta COM O MESMO id (ignora as outras), e devolve o lerResposta dela. Se não chegar nada a
// tempo, rejeita com um Error que contenha "timeout". Fecha sempre o socket.
export function perguntar({ nome, servidor, porta = 53, timeout = 2000 }) {
  throw new Error('Por fazer: P2');
}
