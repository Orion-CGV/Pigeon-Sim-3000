import * as THREE from 'three';

export function createPretzelModel() {
    const group = new THREE.Group();
    
    const pretzelMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x8b4513,
        roughness: 0.7,
        metalness: 0.1
    });
    
    // Pretzel knot shape (simplified)
    const pretzelGeometry = new THREE.TorusGeometry(0.15, 0.03, 8, 24);
    const pretzel = new THREE.Mesh(pretzelGeometry, pretzelMaterial);
    pretzel.rotation.x = Math.PI / 2;
    
    group.add(pretzel);
    
    return group;
}

export function getPretzelColliderSize() {
    return { width: 0.35, height: 0.06, depth: 0.35 };
}
