import * as THREE from 'three';

export function createTreeModel() {
    const treeGroup = new THREE.Group();
    
    // Trunk
    const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 2, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 1;
    treeGroup.add(trunk);
    
    // Foliage (multiple spheres for more realistic look)
    const foliageGeometry1 = new THREE.SphereGeometry(2, 8, 6);
    const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
    const foliage1 = new THREE.Mesh(foliageGeometry1, foliageMaterial);
    foliage1.position.y = 3.5;
    treeGroup.add(foliage1);
    
    const foliageGeometry2 = new THREE.SphereGeometry(1.5, 6, 4);
    const foliage2 = new THREE.Mesh(foliageGeometry2, foliageMaterial);
    foliage2.position.y = 4.5;
    foliage2.position.x = 0.8;
    treeGroup.add(foliage2);
    
    const foliageGeometry3 = new THREE.SphereGeometry(1.2, 6, 4);
    const foliage3 = new THREE.Mesh(foliageGeometry3, foliageMaterial);
    foliage3.position.y = 4.2;
    foliage3.position.x = -0.7;
    treeGroup.add(foliage3);
    
    return treeGroup;
}

export function getTreeColliderSize() {
    return { width: 4, height: 6, depth: 4 }; // Approximate bounding box
}