import * as THREE from 'three';
import { Game } from "./gameManager/game.js";

console.log("Main.js loaded");

// Create renderer and attach to DOM before creating the Game.
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
console.log('Renderer created and attached to document');

// Start the game with the renderer instance
new Game(renderer);

// Optional initializer kept for compatibility but the game already starts above.
export function initGame() {
  console.log('initGame called');
}
