// O código antigo, tal como está em produção. NÃO MEXER: é a "fotografia" do comportamento
// atual contra a qual os testes de caracterização comparam a tua versão nova.
export function calc(i, c) {
  var t = 0;
  for (var k = 0; k < i.length; k++) {
    var x = i[k];
    var p = x.p * x.q;
    if (x.q >= 10) {
      if (x.q >= 50) {
        p = p * 0.85;
      } else {
        p = p * 0.95;
      }
    }
    if (x.cat == 'livro') {
      p = p + p * 0.06;
    } else if (x.cat == 'comida') {
      p = p + p * 0.13;
    } else {
      p = p + p * 0.23;
    }
    t = t + p;
  }
  if (c && c.vip) {
    t = t * 0.9;
  }
  if (t < 50) {
    t = t + 4.99;
  }
  return Math.round(t * 100) / 100;
}
