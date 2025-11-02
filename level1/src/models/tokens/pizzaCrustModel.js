import * as THREE from 'three';

export function createPizzaCrustModel() {
    const group = new THREE.Group();
    
    const crustMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xd2691e,
        roughness: 0.8,
        metalness: 0.1
    });
    
    // Pizza crust arc shape
    const crustGeometry = new THREE.TorusGeometry(0.2, 0.05, 8, 12, Math.PI * 1.5);
    const crust = new THREE.Mesh(crustGeometry, crustMaterial);
    crust.rotation.x = Math.PI / 2;
    
    group.add(crust);
    
    return group;
}

export function getPizzaCrustColliderSize() {
    return { width: 0.5, height: 0.1, depth: 0.5 };
}