
    import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';

    /**
     * Procedural pigeon model (low-poly) with a small update routine.
     * The group is positioned so its feet rest at y = 0 and the overall height
     * is roughly 1 unit to match the original cube player.
     */
    export function createPlayer() {
        const g = new THREE.Group();
        g.name = 'player';

        // Body: ellipsoid using a sphere scaled down
        const bodyGeo = new THREE.SphereGeometry(0.35, 12, 10);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8b8b8b, flatShading: true });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.scale.set(1.0, 0.85, 1.4);
        body.position.set(0, 0.35, 0);
        body.castShadow = true;
        body.receiveShadow = true;
        g.add(body);

        // Head
        const headGeo = new THREE.SphereGeometry(0.16, 10, 8);
        const head = new THREE.Mesh(headGeo, bodyMat.clone());
        head.position.set(0, 0.55, 0.45);
        head.castShadow = true;
        g.add(head);

        // Beak
        const beakGeo = new THREE.ConeGeometry(0.05, 0.18, 8);
        const beakMat = new THREE.MeshStandardMaterial({ color: 0xffc65d });
        const beak = new THREE.Mesh(beakGeo, beakMat);
        beak.rotation.x = Math.PI / 2;
        beak.position.set(0, 0.53, 0.7);
        beak.castShadow = true;
        g.add(beak);

        // Wings: plane-like flat wings using pivot groups so flapping pivots at the fuselage
        const wingMat = bodyMat.clone();
        // Wing geometry: long in X (span), thin in Y, narrow chord in Z
        const wingGeo = new THREE.BoxGeometry(0.9, 0.02, 0.3);

        // Left wing: pivot at fuselage edge
        const leftWingPivot = new THREE.Group();
        leftWingPivot.position.set(0, 0.35, 0); // hinge at body center height
        // wing mesh positioned so inner edge sits at pivot
        const leftWingMesh = new THREE.Mesh(wingGeo, wingMat);
        leftWingMesh.position.set(-0.45, 0, 0);
        leftWingMesh.castShadow = true;
        leftWingMesh.receiveShadow = true;
        // small dihedral (wing tip slightly up)
        leftWingMesh.rotation.z = 0.12;
        leftWingPivot.add(leftWingMesh);
        g.add(leftWingPivot);

        // Right wing: mirrored
        const rightWingPivot = new THREE.Group();
        rightWingPivot.position.set(0, 0.35, 0);
        const rightWingMesh = new THREE.Mesh(wingGeo.clone(), wingMat.clone());
        rightWingMesh.position.set(0.45, 0, 0);
        rightWingMesh.castShadow = true;
        rightWingMesh.receiveShadow = true;
        // mirrored dihedral (wing tip slightly up on the right)
        rightWingMesh.rotation.z = -0.12;
        rightWingPivot.add(rightWingMesh);
        g.add(rightWingPivot);

        // Tail
        const tailGeo = new THREE.BoxGeometry(0.02, 0.28, 0.5);
        const tail = new THREE.Mesh(tailGeo, wingMat.clone());
        tail.position.set(0, 0.25, -0.55);
        tail.rotation.x = -0.35;
        tail.castShadow = true;
        g.add(tail);

        // Eyes
        const eyeGeo = new THREE.SphereGeometry(0.03, 8, 8);
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.07, 0.58, 0.5);
        const eyeR = eyeL.clone();
        eyeR.position.x = 0.07;
        g.add(eyeL, eyeR);

        // store parts for animation (expose pivots and meshes)
        g.userData.parts = {
            body,
            head,
            beak,
            leftWingPivot,
            leftWingMesh,
            rightWingPivot,
            rightWingMesh,
            tail
        };

        // Position the group so feet rest on y=0. The body was positioned with center at y~0.35,
        // so shifting group to y = 0 will make bottom near y=0; to match the cube (1 unit tall)
        // we offset the group by 0.0 and let the game place it.
        g.position.set(0, 0, 0);

        return g;
    }

    export function updatePlayer(playerGroup, time, params = {}) {
        if (!playerGroup || !playerGroup.userData) return;
        const parts = playerGroup.userData.parts;
        if (!parts) return;
        const speed = params.speed || 6.0;
        const amp = params.amp || 0.7;
        const isFlying = !!params.isFlying;

        const t = time;

        if (isFlying) {
            // Active flying: wings flap up/down around the pivot's Z axis (plane-like roll)
            const phase = Math.sin(t * speed) * amp;
            const base = 0.12; // base dihedral
            const flapAmp = 0.6;

            // pivot rotation around Z will raise/lower wing tips
            parts.leftWingPivot.rotation.z = base + phase * flapAmp;
            parts.rightWingPivot.rotation.z = -base - phase * flapAmp;

            // slight wing twist for realism
            parts.leftWingMesh.rotation.x = 0.05 + Math.sin(t * speed * 1.2) * 0.08;
            parts.rightWingMesh.rotation.x = 0.05 - Math.sin(t * speed * 1.2) * 0.08;

            // Slight stronger bobbing while flying
            parts.body.position.y = 0.35 + Math.sin(t * speed * 0.5) * 0.04;
            parts.head.position.y = 0.55 + Math.sin(t * speed * 0.6) * 0.02;
        } else {
            // Idle while walking: wings hold dihedral but do not flap
            parts.leftWingPivot.rotation.z = 0.0; // keep pivot neutral; mesh already has dihedral
            parts.rightWingPivot.rotation.z = 0.0;

            // ensure small dihedral on the mesh itself
            parts.leftWingMesh.rotation.z = 0.12;
            parts.rightWingMesh.rotation.z = -0.12;

            // Stable body/head while walking
            parts.body.position.y = 0.35;
            parts.head.position.y = 0.55;
        }
    }