/**
 * Entry point. Boots the game once the canvas exists and hides the splash on
 * the first frame, because a black flash before the first render is the
 * cheapest way to look broken.
 */
import { Game } from './app/Game';

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
const boot = document.getElementById('boot');

if (!canvas) {
  throw new Error('canvas #game is missing');
}

const game = new Game(canvas);
game.start();

// Two frames in, the first render has definitely landed.
requestAnimationFrame(() => requestAnimationFrame(() => boot?.classList.add('gone')));

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.dispose());
}

// Handy while developing; harmless in production.
(globalThis as unknown as { game: Game }).game = game;
