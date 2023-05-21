import { load, LoadOptions } from '../boot';

/**
 * Launch the game.
 * @param {HTMLElement} panel the parent panel for game canvas
 */
export default async function launch(panel) {
    const option = new LoadOptions();
    option.replay = "/demo/replay-demo.json";
    const game = await load(option);
    panel.appendChild(game.app.view);
    window.onresize = () => game.windowResize(window.innerWidth, window.innerHeight);
    game.start();
}