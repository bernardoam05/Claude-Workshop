// P1 · Endereços IPv4 e redes CIDR. Ver docs/25-redes.md, secção "Prática".
//
// Um IPv4 são 32 bits, escritos como 4 números de 0 a 255: 192.168.1.10.
// Uma rede CIDR é "endereço/prefixo": 192.168.1.0/24 = todos os IPs cujos 24 primeiros bits são
// iguais aos de 192.168.1.0 (ou seja, 192.168.1.0 a 192.168.1.255).

// ipParaNumero("192.168.1.10") → 3232235786 (um inteiro sem sinal de 32 bits).
// Lança um Error (mensagem com "IP") se não for um IPv4 válido: 4 partes, cada uma de 0 a 255,
// só dígitos ("1.2.3", "256.1.1.1", "1.2.3.x" e "01.2.3.4" são inválidos).
export function ipParaNumero(ip) {
  throw new Error('Por fazer: P1');
}

// numeroParaIp(3232235786) → "192.168.1.10"
export function numeroParaIp(n) {
  throw new Error('Por fazer: P1');
}

// naRede("192.168.1.77", "192.168.1.0/24") → true. O prefixo vai de 0 a 32.
export function naRede(ip, cidr) {
  throw new Error('Por fazer: P1');
}

// intervalo("192.168.1.0/24") → { rede: "192.168.1.0", broadcast: "192.168.1.255", total: 256 }
// (aceita um endereço que não seja o início da rede: "192.168.1.77/24" dá o mesmo resultado)
export function intervalo(cidr) {
  throw new Error('Por fazer: P1');
}
