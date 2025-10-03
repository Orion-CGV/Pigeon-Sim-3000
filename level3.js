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

    setupLevel3();
    setupLevelInput();
}

function setupLevel3() {
    // Level 3 - Obstacle Course
    scene.background = new THREE.Color(0x001122); // Dark blue
    
    // Ground
    const groundGeometry = new THREE.PlaneGeometry(40, 40);
    const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x228822, side: THREE.DoubleSide });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    scene.add(ground);

    // Player
    const playerGeometry = new THREE.BoxGeometry(1, 2, 1);
    const playerMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.position.set(-15, 1, 0);
    player.name = 'player';
    scene.add(player);

    // Moving obstacles
    const obstacleGeometry = new THREE.BoxGeometry(2, 2, 2);
    const obstacleMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    
    const obstacle1 = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
    obstacle1.position.set(-5, 1, 0);
    obstacle1.userData.speed = 0.05;
    obstacle1.userData.direction = 1;
    scene.add(obstacle1);
    
    const obstacle2 = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
    obstacle2.position.set(0, 1, 5);
    obstacle2.userData.speed = 0.03;
    obstacle2.userData.direction = -1;
    scene.add(obstacle2);

    scene.userData.obstacles = [obstacle1, obstacle2];

    // Goal
    const goalGeometry = new THREE.ConeGeometry(1.5, 3, 4);
    const goalMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const goal = new THREE.Mesh(goalGeometry, goalMaterial);
    goal.position.set(15, 1.5, 0);
    goal.name = 'goal';
    scene.add(goal);

    // Level title
    const titleDiv = document.createElement('div');
    titleDiv.textContent = 'LEVEL 3 - Obstacle Course';
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

    // Animation for obstacles
    scene.userData.animateObstacles = () => {
        scene.userData.obstacles.forEach(obstacle => {
            obstacle.position.x += obstacle.userData.speed * obstacle.userData.direction;
            if (obstacle.position.x > 8 || obstacle.position.x < -8) {
                obstacle.userData.direction *= -1;
            }
        });
    };

    camera.position.set(0, 15, 20);
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
    // Remove animation function
    delete scene.userData.animateObstacles;
}