import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

let scene, camera, renderer, labelRenderer;
let returnToMainCallback;

export function initLevel(sceneRef, cameraRef, rendererRef, labelRendererRef, callback) {
    scene = sceneRef;
    camera = cameraRef;
    renderer = rendererRef;
    labelRenderer = labelRendererRef;
    returnToMainCallback = callback;

    while(scene.children.length > 0) { 
        scene.remove(scene.children[0]); 
    }

    setupLevel2();
    setupLevelInput();
}

function setupLevel2() {
    // Level 2 - Maze
    scene.background = new THREE.Color(0x2d2d2d); // Dark gray
    
    // Ground
    const groundGeometry = new THREE.PlaneGeometry(30, 30);
    const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x666666, side: THREE.DoubleSide });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    scene.add(ground);

    // Player
    const playerGeometry = new THREE.BoxGeometry(1, 2, 1);
    const playerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.position.set(-12, 1, -12);
    player.name = 'player';
    scene.add(player);

    // Maze walls
    const wallGeometry = new THREE.BoxGeometry(1, 2, 1);
    const wallMaterial = new THREE.MeshBasicMaterial({ color: 0xff6600 });
    
    // Create simple maze pattern
    const wallPositions = [
        // Outer walls
        [0, 1, -15], [0, 1, 15], [-15, 1, 0], [15, 1, 0],
        // Inner maze
        [-5, 1, -10], [-5, 1, -5], [5, 1, 5], [10, 1, 0],
        [0, 1, 5], [-10, 1, 10], [5, 1, -5]
    ];
    
    wallPositions.forEach(pos => {
        const wall = new THREE.Mesh(wallGeometry, wallMaterial);
        wall.position.set(pos[0], pos[1], pos[2]);
        scene.add(wall);
    });

    // Goal
    const goalGeometry = new THREE.SphereGeometry(1, 32, 32);
    const goalMaterial = new THREE.MeshBasicMaterial({ color: 0xff00ff });
    const goal = new THREE.Mesh(goalGeometry, goalMaterial);
    goal.position.set(12, 1, 12);
    goal.name = 'goal';
    scene.add(goal);

    // Level title
    const titleDiv = document.createElement('div');
    titleDiv.textContent = 'LEVEL 2 - Maze Runner';
    titleDiv.style.color = 'white';
    titleDiv.style.fontSize = '24px';
    titleDiv.style.fontWeight = 'bold';
    titleDiv.style.position = 'absolute';
    titleDiv.style.top = '20px';
    titleDiv.style.left = '50%';
    titleDiv.style.transform = 'translateX(-50%)';
    titleDiv.style.textShadow = '2px 2px 4px black';
    document.body.appendChild(titleDiv);
    scene.userData.titleElement = titleDiv;

    camera.position.set(0, 20, 0);
    camera.lookAt(0, 0, 0);
}

function setupLevelInput() {
    const handleKeyDown = (e) => {
        if (e.code === 'Escape') {
            returnToMainCallback();
        }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    scene.userData.keyHandler = handleKeyDown;
}

export function cleanupLevel() {
    if (scene.userData.titleElement) {
        document.body.removeChild(scene.userData.titleElement);
    }
    if (scene.userData.keyHandler) {
        document.removeEventListener('keydown', scene.userData.keyHandler);
    }
}