// P1 · Ler o Cache-Control e calcular quanto tempo uma resposta pode ser reutilizada.

// interpretarCacheControl(texto) → objeto com as diretivas
//   'public, max-age=60, s-maxage="300", no-cache' → { public: true, 'max-age': 60, 's-maxage': 300, 'no-cache': true }
//   Nomes em minúsculas; valores sem aspas; valores só com algarismos viram números; diretivas
//   sem valor ficam true; espaços e entradas vazias ignorados. undefined ou '' → {}.
export function interpretarCacheControl(texto = '') {
  throw new Error('Por fazer: P1');
}

// tempoDeVida(cabecalhos, { partilhada = false }) → segundos em que a resposta está "fresca"
//   cabecalhos: objeto com nomes em minúsculas ('cache-control', 'expires', 'date')
//   partilhada: true para uma cache partilhada (CDN, proxy); false para a do browser
//   Regras, por ordem:
//     no-store                         → 0 (não se guarda de todo)
//     partilhada e private             → 0 (só o browser do utilizador pode guardar)
//     partilhada e s-maxage            → s-maxage
//     max-age                          → max-age
//     expires e date                   → (expires − date) em segundos, nunca negativo
//     nada disto                       → 0 (sem heurísticas)
export function tempoDeVida(cabecalhos, { partilhada = false } = {}) {
  throw new Error('Por fazer: P1');
}

// politica(tipo) → o Cache-Control recomendado para cada tipo de recurso:
//   'estatico-com-hash' (app.3f2a9c1b.js)  → 'public, max-age=31536000, immutable'
//   'html'                                → 'no-cache'   (guarda, mas revalida SEMPRE antes de usar)
//   'api-publica'                         → 'public, max-age=60, s-maxage=300, stale-while-revalidate=30'
//   'api-privada'                         → 'private, no-cache'
//   'sensivel'  (dados bancários, tokens)  → 'no-store'
//   outro                                 → lança um Error
export function politica(tipo) {
  throw new Error('Por fazer: P1');
}
