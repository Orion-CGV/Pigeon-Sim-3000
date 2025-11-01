import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';

export function createPlayer() {
    const arrowGroup = new THREE.Group();
    
    // Arrow shaft (thicker cylinder)
    const shaftGeometry = new THREE.CylinderGeometry(0.08, 0.08, 1.0, 8);
    const shaftMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Green shaft
    const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
    shaft.position.y = 0.5;
    shaft.rotation.x = Math.PI / 2;
    
    // Arrow head (larger cone)
    const headGeometry = new THREE.ConeGeometry(0.15, 0.4, 8);
    const headMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red head
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.z = 0.7;
    head.rotation.x = Math.PI / 2;
    
    arrowGroup.add(shaft);
    arrowGroup.add(head);
    
    // Position at ground level
    arrowGroup.position.y = 0.5;
    
    return arrowGroup;
}