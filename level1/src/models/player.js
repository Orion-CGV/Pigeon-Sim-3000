import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';

export function createPlayer() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const player = new THREE.Mesh(geometry, material);

    player.position.set(0, 2, 0); // small lift above ground
    player.castShadow = true;

    return player;
}
