// P3 · A mesma API do P2, agora com Express 5.
//
// createApp() devolve a app Express (sem .listen). O contrato HTTP é EXATAMENTE o mesmo do P2
// (os testes são os mesmos), mais duas regras:
//   - um middleware teu, escrito à mão, que dá a cada pedido um identificador único
//     (crypto.randomUUID()), guarda-o em req.id e devolve-o no cabeçalho X-Request-Id
//     (é assim que, numa empresa, se segue um pedido pelos logs de vários serviços);
//   - os erros (JSON inválido incluído) passam por um middleware de erro com 4 parâmetros,
//     que responde {"error":"..."} com o status certo (400) ou 500 para tudo o que não tem status.
export function createApp() {
  throw new Error('Por fazer: P3');
}
