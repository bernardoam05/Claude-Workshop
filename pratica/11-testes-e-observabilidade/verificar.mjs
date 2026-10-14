// Verifica os exercícios do módulo 11 (chamado por `npm run verificar 11 [prazos|lembretes|repositorio]`).
//
// Aqui és tu que escreves os testes. Para saber se são BONS, não chega que passem:
//   1. correm contra o código verdadeiro → têm de PASSAR (senão, o teste está errado);
//   2. correm contra cada mutante (uma cópia com um bug plantado) → cada um tem de FALHAR.
//      Um mutante que "sobrevive" é um bug que os teus testes deixariam passar.
// Isto chama-se mutation testing. Em projetos reais faz-se com ferramentas como o Stryker.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const filtro = process.argv[2] ?? '';
const alvos = ['prazos', 'lembretes', 'repositorio'].filter((a) => a.includes(filtro));

const correrTestes = (alvo, mutante, mostrar) =>
  spawnSync(process.execPath, ['--test', '--test-reporter=spec', `${alvo}.test.js`], {
    cwd: dir,
    stdio: mostrar ? 'inherit' : 'ignore',
    env: { ...process.env, MUTANTE: mutante ?? '' },
  }).status;

let tudoBem = true;
for (const alvo of alvos) {
  console.log(`\n━━━ ${alvo}.test.js contra o código verdadeiro (${alvo}.js)`);
  if (correrTestes(alvo, null, true) !== 0) {
    console.log(`\n✘ Os teus testes falham contra o código CORRETO. Corrige o teste antes de olhar para os mutantes.`);
    tudoBem = false;
    continue;
  }

  const mutantes = readdirSync(join(dir, 'mutantes'))
    .filter((f) => f.startsWith(`${alvo}-`))
    .map((f) => f.replace(/\.js$/, ''))
    .sort((a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]));
  const sobreviventes = mutantes.filter((m) => correrTestes(alvo, m, false) === 0);

  console.log(`\n━━━ ${alvo}: ${mutantes.length - sobreviventes.length} de ${mutantes.length} mutantes apanhados`);
  for (const m of mutantes) console.log(`  ${sobreviventes.includes(m) ? '✘ sobreviveu' : '✔ apanhado  '}  ${m}`);
  if (sobreviventes.length > 0) {
    tudoBem = false;
    console.log(`\n  Para ver o bug de um sobrevivente: diff ${alvo}.js mutantes/${sobreviventes[0]}.js`);
    console.log('  (tenta primeiro adivinhar que comportamento falta testar, sem abrir o mutante)');
  }
}
process.exit(tudoBem ? 0 : 1);
