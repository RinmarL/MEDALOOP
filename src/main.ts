import { MedalGame } from './game';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('Canvas element #game-canvas not found');
  }
  (window as unknown as { game: MedalGame }).game = new MedalGame(canvas);
});
