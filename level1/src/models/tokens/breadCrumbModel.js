import * as THREE from 'three';

export function createBreadCrumbModel() {
    const group = new THREE.Group();
    
    const breadMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xf5deb3,
        roughness: 0.7,
        metalness: 0.1
    });
    
    // Main bread crumb body (irregular shape)
    const bodyGeometry = new THREE.SphereGeometry(0.15, 6, 4);
    bodyGeometry.scale(1.2, 0.8, 0.9); // Make it irregular
    
    const body = new THREE.Mesh(bodyGeometry, breadMaterial);
    group.add(body);
    
    // Add some small irregular pieces around it
    for (let i = 0; i < 3; i++) {
        const pieceGeometry = new THREE.SphereGeometry(0.05, 4, 3);
        const piece = new THREE.Mesh(pieceGeometry, breadMaterial);
        
        const angle = (i / 3) * Math.PI * 2;
        const radius = 0.12;
        piece.position.set(
            Math.cos(angle) * radius,
            Math.sin(angle) * 0.05,
            Math.sin(angle) * radius * 0.5
        );
        piece.scale.set(0.8 + Math.random() * 0.4, 0.6 + Math.random() * 0.4, 0.8 + Math.random() * 0.4);
        
        group.add(piece);
    }
    
    return group;
}

export function getBreadCrumbColliderSize() {
    return { width: 0.4, height: 0.2, depth: 0.4 };
}