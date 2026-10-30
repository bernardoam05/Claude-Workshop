import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { verificarFronteiras } from './fronteiras.js';

const bom = {
  'app/tarefas/page.js': {
    codigo: "import { db } from '../../lib/db.js';\nexport default async function Pagina() { const t = await db.tarefas(); return <Lista tarefas={t} />; }",
    importa: ['lib/db.js', 'components/Lista.js'],
  },
  'lib/db.js': { codigo: "import 'server-only';\nconst url = process.env.DATABASE_URL;", importa: ['server-only', 'pg'] },
  'components/Lista.js': {
    codigo: "'use client';\nimport { Botao } from './Botao.js';\nconst api = process.env.NEXT_PUBLIC_API_URL;",
    importa: ['components/Botao.js', 'react'],
  },
  'components/Botao.js': { codigo: 'export function Botao() {}', importa: [] },
};

describe('P4 · verificarFronteiras', () => {
  it('um projeto bem separado não tem problemas', () => {
    assert.deepEqual(verificarFronteiras(bom), []);
  });
  it('um segredo usado num componente de cliente', () => {
    const m = structuredClone(bom);
    m['components/Lista.js'].codigo += '\nconst chave = process.env.STRIPE_SECRET_KEY;';
    assert.deepEqual(verificarFronteiras(m), ['components/Lista.js: process.env.STRIPE_SECRET_KEY no cliente']);
  });
  it('o cliente propaga-se pelos imports, mesmo em vários níveis', () => {
    const m = structuredClone(bom);
    m['components/Botao.js'] = { codigo: 'const x = process.env.SEGREDO;', importa: ['lib/formatar.js'] };
    m['lib/formatar.js'] = { codigo: '', importa: ['lib/db.js'] };
    assert.deepEqual(verificarFronteiras(m), [
      'components/Botao.js: process.env.SEGREDO no cliente',
      'lib/db.js: importa pg no cliente',
      'lib/db.js: importa server-only no cliente',
      'lib/db.js: process.env.DATABASE_URL no cliente',
    ]);
  });
  it('componentes async só no servidor', () => {
    const m = { 'a.js': { codigo: '"use client"\n\nexport default async function A() {}', importa: [] } };
    assert.deepEqual(verificarFronteiras(m), ['a.js: componente async no cliente']);
  });
  it("a diretiva tem de estar no início ('use client' a meio não conta)", () => {
    const m = { 'a.js': { codigo: "const x = 'use client';\nexport default async function A() {}", importa: ['fs'] } };
    assert.deepEqual(verificarFronteiras(m), []);
  });
  it('aceita ciclos de imports sem ficar preso', () => {
    const m = {
      'a.js': { codigo: "  'use client';", importa: ['b.js'] },
      'b.js': { codigo: '', importa: ['a.js', 'node:fs'] },
    };
    assert.deepEqual(verificarFronteiras(m), ['b.js: importa node:fs no cliente']);
  });
});
