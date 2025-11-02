import * as THREE from 'three';

export function createSeedModel() {
    const group = new THREE.Group();
    
    const seedMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xdaa520,
        roughness: 0.5,
        metalness: 0.2
    });
    
    // Seed shape - teardrop like
    const seedGeometry = new THREE.ConeGeometry(0.04, 0.1, 5);
    const seed = new THREE.Mesh(seedGeometry, seedMaterial);
    
    group.add(seed);
    
    return group;
}

export function getSeedColliderSize() {
    return { width: 0.08, height: 0.1, depth: 0.08 };
}
