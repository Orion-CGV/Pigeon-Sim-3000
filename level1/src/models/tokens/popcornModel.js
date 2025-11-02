import * as THREE from 'three';

export function createPopcornModel() {
    const group = new THREE.Group();
    
    const popcornMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xfff8dc,
        roughness: 0.9,
        metalness: 0.0
    });
    
    // Popcorn kernel - irregular fluffy shape
    const kernelGeometry = new THREE.DodecahedronGeometry(0.08, 0);
    const kernel = new THREE.Mesh(kernelGeometry, popcornMaterial);
    
    // Make it more irregular
    kernel.scale.set(
        0.8 + Math.random() * 0.4,
        1.0 + Math.random() * 0.3,
        0.8 + Math.random() * 0.4
    );
    
    group.add(kernel);
    
    // Add a couple of small pieces around it
    for (let i = 0; i < 2; i++) {
        const pieceGeometry = new THREE.SphereGeometry(0.03, 3, 2);
        const piece = new THREE.Mesh(pieceGeometry, popcornMaterial);
        
        piece.position.set(
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.05,
            (Math.random() - 0.5) * 0.1
        );
        
        group.add(piece);
    }
    
    return group;
}

export function getPopcornColliderSize() {
    return { width: 0.2, height: 0.15, depth: 0.2 };
}