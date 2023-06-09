import { createElement } from "react";
import { KeyBinding } from "./action";
import TextBox from "./app/text-box";
import { ElementData, ElementModelPart } from "./element";
import { GAME_EVENTS, GameEvent } from "./event";
import { GameDisplay, GameMode } from "./game-display";
import { Task, Tasker } from "./utils/tasker";
import * as PIXI from "pixi.js";
import ReactDOM from "react-dom/client";

export class LoadOptions {
    ELEMENT_DATA_LOCATION: string = "/resource/element-data.json";
    TEXTURES_LOCATION: string = "/resource/textures.json";
    KEY_BINDING_LOCATION: string = "/resource/key-binding.json";
    width: number;    // game display's width (in pixels)
    height: number;   // game display's heigth (in pixels)
    mode: GameMode;   // game mode
    replay?: string;     // When this flag is set, the game will load the replay file and start in replay mode.
    socketAddr?: string; // When this flag is set, the game will open a WebSocket at this URL.
    displayHP: boolean;  // Whether to display HP bar
    constructor(width: number, height: number, mode: GameMode, replay?: string, socketAddr?: string, displayHP?: boolean) {
        this.width = width;
        this.height = height;
        this.mode = mode;
        this.replay = replay;
        this.socketAddr = socketAddr;
        this.displayHP = displayHP ?? true;
    }
};

/**
 * Load all resources required to launch the game.
 * @param options Loading options. This includes all adjustable options when loading the game.
 * @param taskStart Callback function when a task starts executing.
 * @param taskComplete Callback function when a task completes executing.
 * @returns The tasker that yields a GameDisplay object.
 */
export function load(options: LoadOptions) {
    const loadElemData: Task<Map<string, ElementData>> = {
        // load element data from "/resource/element-data.json"
        prerequisite: [],
        callback: async () => {
            const data = (await fetch(options.ELEMENT_DATA_LOCATION)).json();
            for(const [_, entry] of Object.entries(await data as { [key: string]: ElementData })) {
                // fill out the default values
                for(const part of entry.parts) {
                    part.xOffset ??= 0;
                    part.yOffset ??= 0;
                    part.width ??= 1;
                    part.height ??= 1;
                    part.bgColor ??= false;
                }
            }
            return new Map(Object.entries(await data));
        }
    }

    const loadTextures: Task<Map<string, PIXI.Texture>> = {
        // load all textures using the entries in "/resource/textures.json"
        prerequisite: [],
        callback: async () => {
            const textures = new Map<string, PIXI.Texture>();
            const textureNames = (await fetch(options.TEXTURES_LOCATION)).json();
            for(const [name, file] of Object.entries(await textureNames)) {
                textures.set(name, PIXI.Texture.from(`/resource/texture/${file}`));
            }
            return textures;
        }
    }

    switch(options.mode) {
        case GameMode.REPLAY: {
            /*** Replay Mode ***/
            const replayFile = options.replay!!;
            type EventEntry = { t: number, [key: string]: any };   // Event in replay file's format
            const loadReplay: Task<GameEvent[]> = {
                // load replay file
                prerequisite: [],
                callback: async () => {
                    const data = (await fetch(replayFile)).json();
                    const events: GameEvent[] = (await data as EventEntry[]
                    ).map(
                        entry => new GameEvent(entry.t, GAME_EVENTS[entry.type], entry)
                    );
                    return events;
                }
            };

            const initGameDisplay: Task<GameDisplay> = {
                // initialize the game display with the loaded data
                prerequisite: ["load element data", "load textures", "load replay file"],
                callback: async (
                    elemData: Map<string, ElementData>,
                    textures: Map<string, PIXI.Texture>,
                    replay: GameEvent[]
                ) => {
                    const app = new PIXI.Application({
                        width: options.width,
                        height: options.height,
                        backgroundColor: 0x000000
                    });
                    const game = new GameDisplay(app, textures, elemData, { mode: options.mode, loadedEvents: replay, displayHP: options.displayHP });
                    return game;
                }
            }

            return new Tasker({
                "load element data": loadElemData,
                "load textures": loadTextures,
                "load replay file": loadReplay,
                "initialize game": initGameDisplay
            }, "initialize game");
        }
    
        case GameMode.REAL_TIME: {
            /*** Real-Time Playing Mode ****/
            const loadKeyBinding: Task<KeyBinding> = {
                prerequisite: [],
                callback: async () => {
                    const data = (await fetch(options.KEY_BINDING_LOCATION)).json();
                    return new Map(Object.entries(await data)) as KeyBinding;
                }
            };
            const requireName: Task<string> = {
                prerequisite: [],
                callback: () => {
                    return new Promise<string>((resolve, reject) => {
                        ReactDOM.createRoot(document.getElementById("user-interaction")!).render(
                            createElement(TextBox,
                                { label: "please enter your name: ", placeholder: "press ENTER to continue",
                                    onsubmit: (name: string) => {
                                        document.getElementById("text-box")?.remove()
                                        resolve(name)
                                    }
                                }
                            )
                        );
                    });
                }
            }
            const addr = options.socketAddr!!;
            const initGameDisplay: Task<GameDisplay> = {
                // initialize the game display with the loaded data
                prerequisite: ["load element data", "load textures", "load key bindings", "require name"],
                callback: (
                    elemData: Map<string, ElementData>,
                    textures: Map<string, PIXI.Texture>,
                    keyBinding: KeyBinding,
                    name: string
                ) => {
                    return new Promise((resolve, reject) => {
                        const socket = new WebSocket(addr);
                        const app = new PIXI.Application({
                            width: options.width,
                            height: options.height,
                            backgroundColor: 0x000000
                        });
                        const game = new GameDisplay(app, textures, elemData, { mode: options.mode, loadedEvents: [], socket, keyBinding, displayHP: options.displayHP });
                        socket.onopen = _ => {
                            socket.send(name);
                            resolve(game);
                        }
                        socket.onclose = _ => {
                            reject(`Cannot establish connection to ${addr}`);
                        }
                        setTimeout(() => {
                            reject(`Connection to ${addr} timed out.`);
                        }, 10000);
                    });
                }
            }
            return new Tasker({
                "load element data": loadElemData,
                "load textures": loadTextures,
                "load key bindings": loadKeyBinding,
                "require name": requireName,
                "initialize game": initGameDisplay
            }, "initialize game");
        }

        case GameMode.OBSERVER: {
            const addr = options.socketAddr!!;
            const initGameDisplay: Task<GameDisplay> = {
                // initialize the game display with the loaded data
                prerequisite: ["load element data", "load textures"],
                callback: (
                    elemData: Map<string, ElementData>,
                    textures: Map<string, PIXI.Texture>
                ) => {
                    return new Promise((resolve, reject) => {
                        const socket = new WebSocket(addr);
                        const app = new PIXI.Application({
                            width: options.width,
                            height: options.height,
                            backgroundColor: 0x000000
                        });
                        const game = new GameDisplay(app, textures, elemData, { mode: options.mode, loadedEvents: [], socket, displayHP: options.displayHP });
                        socket.onopen = _ => {
                            socket.send("OBSERVER");
                            resolve(game);
                        }
                        socket.onclose = _ => {
                            reject(`Cannot establish connection to ${addr}`);
                        }
                        setTimeout(() => {
                            reject(`Connection to ${addr} timed out.`);
                        }, 10000);
                    });
                }
            }
            return new Tasker({
                "load element data": loadElemData,
                "load textures": loadTextures,
                "initialize game": initGameDisplay
            }, "initialize game");
        }
    }
}