import * as THREE from 'three';

export function createBenchModel() {
    const benchGroup = new THREE.Group();
    
    // Bench material
    const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const metalMaterial = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.8 });
    
    // Seat
    const seatGeometry = new THREE.BoxGeometry(6, 0.2, 1.2);
    const seat = new THREE.Mesh(seatGeometry, woodMaterial);
    seat.position.y = 1.1;
    benchGroup.add(seat);
    
    // Backrest
    const backrestGeometry = new THREE.BoxGeometry(6, 1.5, 0.1);
    const backrest = new THREE.Mesh(backrestGeometry, woodMaterial);
    backrest.position.y = 1.9;
    backrest.position.z = -0.5;
    benchGroup.add(backrest);
    
    // Legs
    const legGeometry = new THREE.BoxGeometry(0.3, 1, 0.3);
    
    // Front legs
    const frontLeftLeg = new THREE.Mesh(legGeometry, metalMaterial);
    frontLeftLeg.position.set(-2.5, 0.5, 0.4);
    benchGroup.add(frontLeftLeg);
    
    const frontRightLeg = new THREE.Mesh(legGeometry, metalMaterial);
    frontRightLeg.position.set(2.5, 0.5, 0.4);
    benchGroup.add(frontRightLeg);
    
    // Back legs
    const backLeftLeg = new THREE.Mesh(legGeometry, metalMaterial);
    backLeftLeg.position.set(-2.5, 0.5, -0.4);
    backLeftLeg.scale.y = 1.8;
    benchGroup.add(backLeftLeg);
    
    const backRightLeg = new THREE.Mesh(legGeometry, metalMaterial);
    backRightLeg.position.set(2.5, 0.5, -0.4);
    backRightLeg.scale.y = 1.8;
    benchGroup.add(backRightLeg);
    
    // Support bars
    const supportGeometry = new THREE.BoxGeometry(5, 0.1, 0.1);
    const frontSupport = new THREE.Mesh(supportGeometry, metalMaterial);
    frontSupport.position.y = 0.3;
    frontSupport.position.z = 0.4;
    benchGroup.add(frontSupport);
    
    const backSupport = new THREE.Mesh(supportGeometry, metalMaterial);
    backSupport.position.y = 0.3;
    backSupport.position.z = -0.4;
    benchGroup.add(backSupport);
    
    return benchGroup;
}

export function getBenchColliderSize() {
    return { width: 6, height: 2, depth: 1.4 };
}