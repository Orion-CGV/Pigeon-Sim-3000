import * as THREE from 'three';

export function createHotDogBunModel() {
    const group = new THREE.Group();
    
    const bunMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffe4b5,
        roughness: 0.8,
        metalness: 0.0
    });
    
    // Hot dog bun - elongated shape
    const bunGeometry = new THREE.CylinderGeometry(0.08, 0.1, 0.5, 8);
    const bun = new THREE.Mesh(bunGeometry, bunMaterial);
    bun.rotation.x = Math.PI / 2; // Lay it on its side
    
    group.add(bun);
    
    return group;
}

export function getHotDogBunColliderSize() {
    return { width: 0.5, height: 0.16, depth: 0.16 };
}
