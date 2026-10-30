// P1 · Cookies seguros: escrever o Set-Cookie e ler o Cookie.

// serializarCookie(nome, valor, opcoes) → o valor do cabeçalho Set-Cookie
//   opcoes: { httpOnly, secure, sameSite ('Strict' | 'Lax' | 'None'), path, domain, maxAge (segundos) }
//   Formato: 'nome=valor' (valor com encodeURIComponent) e depois, por esta ordem e só os que
//   existem: '; Max-Age=N', '; Domain=d', '; Path=p', '; HttpOnly', '; Secure', '; SameSite=S'.
//   Regras (lança um Error com uma mensagem que diga o problema):
//   - o nome só pode ter letras, algarismos, '_' e '-' (os prefixos '__Host-' e '__Secure-' também)
//   - SameSite=None exige Secure (os browsers rejeitam o cookie sem ele)
//   - o prefixo '__Secure-' exige Secure
//   - o prefixo '__Host-' exige Secure, Path=/ e NENHUM Domain (fica preso a este anfitrião exato)
export function serializarCookie(nome, valor, opcoes = {}) {
  throw new Error('Por fazer: P1');
}

// lerCookies(cabecalho) → { nome: valor } a partir do cabeçalho Cookie ('a=1; b=x%20y')
//   Valores descodificados com decodeURIComponent (um valor mal codificado fica como veio);
//   se um nome se repetir, ganha o PRIMEIRO; pedaços sem '=' ignoram-se; sem cabeçalho → {}.
export function lerCookies(cabecalho = '') {
  throw new Error('Por fazer: P1');
}
