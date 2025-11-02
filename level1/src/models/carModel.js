import * as THREE from 'three';

export function createCarModel(color = 0xff3333) {
    const carGroup = new THREE.Group();

    const bodyMaterial = new THREE.MeshStandardMaterial({ color: color, metalness: 0.8, roughness: 0.4 });
    const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x87CEEB, transparent: true, opacity: 0.6 });
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const lightMaterial = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffff00 });

    // Main body
    const bodyGeometry = new THREE.BoxGeometry(3.5, 0.6, 1.6);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.4;
    carGroup.add(body);

    // Cabin (slightly sloped)
    const cabinGeometry = new THREE.BoxGeometry(2, 0.6, 1.6);
    const cabin = new THREE.Mesh(cabinGeometry, bodyMaterial);
    cabin.position.y = 0.7;
    cabin.position.z = 0.0;
    carGroup.add(cabin);

    // Windows (front + sides)
    const frontWindowGeometry = new THREE.BoxGeometry(2.1, 0.3, 1.3);
    const frontWindow = new THREE.Mesh(frontWindowGeometry, windowMaterial);
    frontWindow.position.set(0, 0.8, 0.0);
    frontWindow.rotation.z = 0.00;
    carGroup.add(frontWindow);

    const sideWindowGeometry = new THREE.BoxGeometry(1.4, 0.3, 0.1);
    const leftWindow = new THREE.Mesh(sideWindowGeometry, windowMaterial);
    leftWindow.position.set(0, 0.8, -0.8);
    carGroup.add(leftWindow);

    const rightWindow = new THREE.Mesh(sideWindowGeometry, windowMaterial);
    rightWindow.position.set(0, 0.8, 0.8);
    carGroup.add(rightWindow);

    // Wheels
    const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 6); // hex low-poly
    wheelGeometry.rotateX(Math.PI / 2);

    const wheelPositions = [
        [-1.2, 0.0, 0.8], // front left
        [1.2, 0.0, 0.8],  // front right
        [-1.2, 0.0, -0.8], // rear left
        [1.2, 0.0, -0.8]   // rear right
    ];

    wheelPositions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.position.set(...pos);
        carGroup.add(wheel);
    });

    // Headlights (slightly inset)
    const headlightGeometry = new THREE.SphereGeometry(0.12, 6, 6);
    const headlightPositions = [
        [1.7, 0.6, -0.5],
        [1.7, 0.6, 0.5]
    ];
    headlightPositions.forEach(pos => {
        const light = new THREE.Mesh(headlightGeometry, lightMaterial);
        light.position.set(...pos);
        carGroup.add(light);
    });

    return carGroup;
}

export function getCarColliderSize() {
    return { width: 3.5, height: 2, depth: 1.6 };
}

export function getRandomCarColor() {
    const colors = [
        0xff3333, 0x3366ff, 0x33ff33, 0xffff33,
        0xff33ff, 0x33ffff, 0x888888, 0xffffff
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}
