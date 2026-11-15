/**
 * Korenvliet in the browser.
 */
import { GameClient } from 'tads3js/src/web/client';
import { ModernUI } from './ModernUI';

async function main() {
  const root = document.getElementById('game-root')!;
  let pictures: Record<string, string> = {};
  try {
    pictures = await (await fetch('images.json', { cache: 'no-cache' })).json();
  } catch(e) { /* (no pictures: placeholders) */ }
  const ui = new ModernUI(root, {
    title: 'Korenvliet',
    byline: 'by Alexander van Oostenrijk',
    version: '1.2',
  }, pictures);
  try {
    await ui.start(await GameClient.fetchImage('korenvliet.t3'), 'Korenvliet');
  } catch(e) {
    root.textContent = 'The game could not be loaded: ' + e.message;
  }
}

main();
