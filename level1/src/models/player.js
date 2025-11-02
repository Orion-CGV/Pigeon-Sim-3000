
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
        leftWingMesh.position.set(-0.35, 0, 0);
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
        rightWingMesh.position.set(0.35, 0, 0);
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

        // Legs (two thin cylinders + small feet)
        const legMat = new THREE.MeshStandardMaterial({ color: 0x552e20 });
        const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8);
        const leftLeg = new THREE.Mesh(legGeo, legMat);
        leftLeg.position.set(-0.08, 0.15, 0.18);
        leftLeg.castShadow = true;
        leftLeg.receiveShadow = true;
        g.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeo.clone(), legMat.clone());
        rightLeg.position.set(0.08, 0.15, 0.18);
        rightLeg.castShadow = true;
        rightLeg.receiveShadow = true;
        g.add(rightLeg);

        // Simple feet (small flattened spheres)
        const footGeo = new THREE.SphereGeometry(0.05, 8, 6);
        const leftFoot = new THREE.Mesh(footGeo, legMat.clone());
        leftFoot.scale.set(1.2, 0.4, 1.6);
        leftFoot.position.set(-0.08, 0.02, 0.26);
        leftFoot.castShadow = true;
        g.add(leftFoot);

        const rightFoot = leftFoot.clone();
        rightFoot.position.x = 0.08;
        g.add(rightFoot);

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
            tail,
            leftLeg,
            rightLeg,
            leftFoot,
            rightFoot
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

        // initialize per-player animation state if missing
        const state = playerGroup.userData.state || (playerGroup.userData.state = {
            leftWingPivotZ: parts.leftWingPivot.rotation.z || 0,
            rightWingPivotZ: parts.rightWingPivot.rotation.z || 0,
            leftWingMeshY: parts.leftWingMesh.rotation.y || 0,
            rightWingMeshY: parts.rightWingMesh.rotation.y || 0,
            leftWingMeshZ: parts.leftWingMesh.rotation.z || 0,
            rightWingMeshZ: parts.rightWingMesh.rotation.z || 0,
            leftWingMeshX: parts.leftWingMesh.rotation.x || 0,
            rightWingMeshX: parts.rightWingMesh.rotation.x || 0,
            leftLegRotX: parts.leftLeg.rotation.x || 0,
            rightLegRotX: parts.rightLeg.rotation.x || 0,
            leftFootY: parts.leftFoot.position.y || 0,
            rightFootY: parts.rightFoot.position.y || 0,
            bodyY: parts.body.position.y || 0.35,
            headY: parts.head.position.y || 0.55,
            lastT: t,
            mode: null,
            prevMode: null,
            transitionAlpha: 1.0,
            transitionDuration: 0.2
        });

        let dt = t - (state.lastT || t);
        if (!isFinite(dt) || dt <= 0) dt = 0.016;

        const isGrounded = !!params.isGrounded;
        const isMoving = !!params.isMoving;

        // determine desired mode
        const desiredMode = isFlying ? 'flying' : (isGrounded ? (isMoving ? 'walking' : 'perched') : 'flying');

        // handle mode transitions (set up transition timing)
        if (state.mode !== desiredMode) {
            state.prevMode = state.mode || desiredMode;
            state.mode = desiredMode;
            state.transitionAlpha = 0.0;
            // choose durations: takeoff/landing slightly longer
            if (state.prevMode === 'flying' || desiredMode === 'flying') state.transitionDuration = 0.28; else state.transitionDuration = 0.14;
        }

        // advance transition alpha
        if (state.transitionAlpha < 1.0) {
            state.transitionAlpha = Math.min(1.0, state.transitionAlpha + dt / Math.max(0.0001, state.transitionDuration));
        }

        // easing function (smoothstep)
        const ease = (a) => a * a * (3 - 2 * a);
        const blend = ease(state.transitionAlpha);

        // function to produce target values for a given mode
        const getTargets = (modeName) => {
            const tgt = {
                leftWingPivotZ: 0,
                rightWingPivotZ: 0,
                leftWingMeshY: 0,
                rightWingMeshY: 0,
                leftWingMeshZ: 0,
                rightWingMeshZ: 0,
                leftWingMeshX: 0,
                rightWingMeshX: 0,
                leftLegRotX: 0,
                rightLegRotX: 0,
                leftFootY: 0.02,
                rightFootY: 0.02,
                bodyY: 0.35,
                headY: 0.55
            };

            if (modeName === 'flying') {
                const phase = Math.sin(t * speed) * amp;
                const base = 0.12;
                const flapAmp = 0.6;
                tgt.leftWingPivotZ = base + phase * flapAmp;
                tgt.rightWingPivotZ = -base - phase * flapAmp;
                tgt.leftWingMeshX = 0.05 + Math.sin(t * speed * 1.2) * 0.08;
                tgt.rightWingMeshX = 0.05 - Math.sin(t * speed * 1.2) * 0.08;
                tgt.leftLegRotX = 0.5; tgt.rightLegRotX = 0.5;
                tgt.leftFootY = 0.12; tgt.rightFootY = 0.12;
                tgt.bodyY = 0.35 + Math.sin(t * speed * 0.5) * 0.04;
                tgt.headY = 0.55 + Math.sin(t * speed * 0.6) * 0.02;
            } else if (modeName === 'walking') {
                // Keep wings tucked flush to the body while walking (no flapping)
                tgt.leftWingPivotZ = -1.5; tgt.rightWingPivotZ = 1.5;
                tgt.leftWingMeshY = 0.0; tgt.rightWingMeshY = 0.0;
                tgt.leftWingMeshZ = 0.04; tgt.rightWingMeshZ = -0.04;
                tgt.leftWingMeshX = 0.0; tgt.rightWingMeshX = 0.0;
                // walking leg motion
                const walkFreq = 5.5;
                const walkAmp = 0.28;
                const legPhase = Math.sin(t * walkFreq) * walkAmp;
                tgt.leftLegRotX = legPhase; tgt.rightLegRotX = -legPhase;
                const footBounce = Math.abs(Math.sin(t * walkFreq)) * 0.02;
                tgt.leftFootY = 0.02 + footBounce; tgt.rightFootY = 0.02 + footBounce;
                tgt.bodyY = 0.35 + Math.sin(t * walkFreq * 0.22) * 0.01;
                tgt.headY = 0.55 + Math.sin(t * walkFreq * 0.22) * 0.005;
            } else { // perched
                // Fully tucked wings flush against the sides
                tgt.leftWingPivotZ = -1.7; tgt.rightWingPivotZ = 1.7;
                tgt.leftWingMeshY = 0.0; tgt.rightWingMeshY = 0.0;
                tgt.leftWingMeshZ = 0.02; tgt.rightWingMeshZ = -0.02;
                tgt.leftWingMeshX = 0.0; tgt.rightWingMeshX = 0.0;
                tgt.leftLegRotX = 0.02; tgt.rightLegRotX = 0.02;
                tgt.leftFootY = 0.02; tgt.rightFootY = 0.02;
                tgt.bodyY = 0.35; tgt.headY = 0.55;
            }
            return tgt;
        };

        const prevTargets = getTargets(state.prevMode || state.mode);
        const newTargets = getTargets(state.mode);

        // compute blended targets using eased transition
        const blended = {};
        for (const k of Object.keys(newTargets)) {
            const pv = prevTargets[k] !== undefined ? prevTargets[k] : state[k] || 0;
            const nv = newTargets[k];
            blended[k] = pv * (1 - blend) + nv * blend;
        }

        // interpolation speed (exponential-like smoothing)
        const interpSpeed = Math.min(1, dt * 10);

        // move state toward blended targets
        state.leftWingPivotZ += (blended.leftWingPivotZ - state.leftWingPivotZ) * interpSpeed;
        state.rightWingPivotZ += (blended.rightWingPivotZ - state.rightWingPivotZ) * interpSpeed;
        state.leftWingMeshY += (blended.leftWingMeshY - state.leftWingMeshY) * interpSpeed;
        state.rightWingMeshY += (blended.rightWingMeshY - state.rightWingMeshY) * interpSpeed;
        state.leftWingMeshZ += (blended.leftWingMeshZ - state.leftWingMeshZ) * interpSpeed;
        state.rightWingMeshZ += (blended.rightWingMeshZ - state.rightWingMeshZ) * interpSpeed;
        state.leftWingMeshX += (blended.leftWingMeshX - state.leftWingMeshX) * interpSpeed;
        state.rightWingMeshX += (blended.rightWingMeshX - state.rightWingMeshX) * interpSpeed;
        state.leftLegRotX += (blended.leftLegRotX - state.leftLegRotX) * interpSpeed;
        state.rightLegRotX += (blended.rightLegRotX - state.rightLegRotX) * interpSpeed;
        state.leftFootY += (blended.leftFootY - state.leftFootY) * interpSpeed;
        state.rightFootY += (blended.rightFootY - state.rightFootY) * interpSpeed;
        state.bodyY += (blended.bodyY - state.bodyY) * interpSpeed;
        state.headY += (blended.headY - state.headY) * interpSpeed;

        // apply to parts
        parts.leftWingPivot.rotation.z = state.leftWingPivotZ;
        parts.rightWingPivot.rotation.z = state.rightWingPivotZ;
        parts.leftWingMesh.rotation.y = state.leftWingMeshY;
        parts.rightWingMesh.rotation.y = state.rightWingMeshY;
        parts.leftWingMesh.rotation.z = state.leftWingMeshZ;
        parts.rightWingMesh.rotation.z = state.rightWingMeshZ;
        parts.leftWingMesh.rotation.x = state.leftWingMeshX;
        parts.rightWingMesh.rotation.x = state.rightWingMeshX;

        parts.leftLeg.rotation.x = state.leftLegRotX;
        parts.rightLeg.rotation.x = state.rightLegRotX;
        parts.leftFoot.position.y = state.leftFootY;
        parts.rightFoot.position.y = state.rightFootY;

        parts.body.position.y = state.bodyY;
        parts.head.position.y = state.headY;

        state.lastT = t;
    }