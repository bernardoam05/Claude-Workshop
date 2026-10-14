import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// Verifica a ESTRUTURA do teu ADR (P3). Não consegue verificar se o raciocínio é bom:
// isso é contigo (e com a solução de referência, no módulo).
const pasta = new URL('./adr/', import.meta.url);

function secao(texto, titulo) {
  const m = texto.match(new RegExp(`^##+ ${titulo}\\s*$([\\s\\S]*?)(?=^##? |(?![\\s\\S]))`, 'm'));
  return m ? m[1].trim() : null;
}

describe('P3 · ADR', () => {
  it('existe um adr/0001-*.md com o formato do modelo', () => {
    const ficheiro = readdirSync(pasta).find((f) => /^0001-.+\.md$/.test(f));
    assert.ok(ficheiro, 'cria o teu ADR em pratica/13-decisoes-e-trade-offs/adr/0001-<tema>.md (copia o 0000-modelo.md)');
    const texto = readFileSync(new URL(ficheiro, pasta), 'utf8');

    assert.match(texto, /^# ADR 0001: .{10,}/m, 'título: "# ADR 0001: <decisão>"');
    assert.match(secao(texto, 'Estado') ?? '', /^(Proposto|Aceite)\b/, 'Estado: Proposto ou Aceite');
    for (const s of ['Contexto', 'Decisão']) {
      const conteudo = secao(texto, s) ?? '';
      assert.ok(conteudo.length >= 80, `a secção "${s}" está vazia ou é demasiado curta`);
      assert.doesNotMatch(conteudo, /Sem opinião ainda|numa ou duas frases afirmativas/, `"${s}" ainda tem o texto do modelo`);
    }
    const alternativas = (secao(texto, 'Alternativas consideradas') ?? '').match(/^- /gm) ?? [];
    assert.ok(alternativas.length >= 2, 'pelo menos duas alternativas consideradas');
    for (const s of ['Positivas', 'Negativas']) {
      const itens = (secao(texto, s) ?? '').match(/^- .{10,}/gm) ?? [];
      assert.ok(itens.length >= 1, `pelo menos uma consequência ${s.toLowerCase()} (com conteúdo a sério)`);
      assert.doesNotMatch(secao(texto, s), /O que fica (melhor|pior)/, `"${s}" ainda tem o texto do modelo`);
    }
  });
});
