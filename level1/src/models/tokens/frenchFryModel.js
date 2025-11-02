import * as THREE from 'three';

export function createFrenchFryModel() {
    const group = new THREE.Group();
    
    const fryMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffd700,
        roughness: 0.6,
        metalness: 0.1
    });
    
    // French fry stick
    const fryGeometry = new THREE.CylinderGeometry(0.03, 0.02, 0.4, 6);
    const fry = new THREE.Mesh(fryGeometry, fryMaterial);
    fry.rotation.x = Math.PI / 2; // Lay it flat
    
    // Add some texture by creating slight bends and irregularities
    fry.geometry.translate(0, 0, 0.2);
    
    group.add(fry);
    
    return group;
}

export function getFrenchFryColliderSize() {
    return { width: 0.4, height: 0.06, depth: 0.06 };
}