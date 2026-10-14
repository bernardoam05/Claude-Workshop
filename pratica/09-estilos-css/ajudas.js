// Funções de apoio aos testes de estilos (*.spec.js). Não precisas de mexer aqui.
import { mkdirSync } from 'node:fs';

// "rgb(37, 99, 235)" ou "rgba(0, 0, 0, 0.5)" → [37, 99, 235]
export function rgb(cor) {
  const m = cor.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`cor num formato inesperado: ${cor}`);
  return m[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3).map(Number);
}

// Luminância relativa (0 = preto, 1 = branco), a mesma fórmula das regras de contraste WCAG.
export function luminancia(cor) {
  const [r, g, b] = rgb(cor).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Valor CALCULADO de uma propriedade CSS, tal como o browser a aplicou ao elemento.
export const estilo = (locator, propriedade) =>
  locator.evaluate((el, p) => getComputedStyle(el)[p], propriedade);

// A cor final de uma variável CSS (ex.: '--cor-fundo' → 'rgb(245, 246, 248)'), para comparar.
export const corDaVariavel = (page, variavel) =>
  page.evaluate((v) => {
    const d = document.createElement('div');
    d.style.color = `var(${v})`;
    document.body.append(d);
    const cor = getComputedStyle(d).color;
    d.remove();
    return cor;
  }, variavel);

// Espera que as transições CSS acabem (ex.: depois de um hover).
export const esperarTransicoes = (page) => page.waitForTimeout(400);

// Guarda uma captura de ecrã em pratica/09-estilos-css/capturas/<nome>.png, para veres o resultado.
// Espera primeiro pelas transições: logo a seguir a mudar para modo escuro, um botão com
// transition-colors ainda está a meio do caminho entre as cores claras e as escuras.
export async function capturar(page, nome) {
  await esperarTransicoes(page);
  const pasta = new URL('./capturas/', import.meta.url);
  mkdirSync(pasta, { recursive: true });
  await page.screenshot({ path: new URL(`${nome}.png`, pasta).pathname, fullPage: true });
}
