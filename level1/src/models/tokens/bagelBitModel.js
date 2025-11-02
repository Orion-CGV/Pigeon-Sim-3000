import * as THREE from 'three';

export function createBagelBitModel() {
    const group = new THREE.Group();
    
    const bagelMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xf0e68c,
        roughness: 0.7,
        metalness: 0.1
    });
    
    // Bagel bit - curved bread piece
    const bagelGeometry = new THREE.TorusGeometry(0.12, 0.04, 8, 12, Math.PI * 0.7);
    const bagel = new THREE.Mesh(bagelGeometry, bagelMaterial);
    bagel.rotation.x = Math.PI / 2;
    
    group.add(bagel);
    
    return group;
}

export function getBagelBitColliderSize() {
    return { width: 0.3, height: 0.08, depth: 0.3 };
}