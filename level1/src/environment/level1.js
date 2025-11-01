import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';
import { createGroundCollider } from "../physics/collider.js";

export function createLevel() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 3, 5);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 5);
    scene.add(light);

    const groundGeo = new THREE.PlaneGeometry(100, 100);
    // Make the ground green to match level1.js visuals
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x2d5a2d });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Attach a simple collider for the ground so other systems can query it
    const groundCollider = createGroundCollider(ground);
    // store on scene.userData for easy access by gameplay/physics code
    scene.userData.groundCollider = groundCollider;

    return { scene, camera };
}
