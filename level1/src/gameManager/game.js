import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';
import { createLevel } from "../environment/level1.js";
import { createPlayer } from "../models/player.js";
import { setupInput, input } from "../input/inputHandler.js";
import { updateWalking } from "../physics/movement.js";
import { updateFlying } from "../physics/flight.js";

export class Game {
    constructor(renderer) {
        this.renderer = renderer;
        const { scene, camera } = createLevel();
        this.scene = scene;
        this.camera = camera;

        this.player = createPlayer();
        this.scene.add(this.player);

        setupInput();

        this.isFlying = false;
        // Track previous fly key state to detect key-down edge (prevent continuous toggling)
        this.prevFlyToggle = false;
        // State object passed into updateFlying to handle smooth ascent
        this.flyState = { isAscendingToFly: false, targetFlyHeight: 0 };

        // Camera control state (mouse-look)
        this.yaw = 0; // horizontal
        this.pitch = 0; // vertical
        this.MOUSE_SENS = 0.0025;

        // Bind handlers
        this._onPointerLockChange = this._onPointerLockChange.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._requestLock = this._requestLock.bind(this);

        // Setup pointer lock on the renderer's canvas
        if (this.renderer && this.renderer.domElement) {
            this.renderer.domElement.addEventListener('click', this._requestLock);
            document.addEventListener('pointerlockchange', this._onPointerLockChange);
        }
        // Create a 3D crosshair attached to the player (remove any DOM crosshair)
        this._createCrosshair3D();
        this.lastTime = performance.now();

        this.loop();
    }

    _requestLock() {
        if (this.renderer && this.renderer.domElement && document.pointerLockElement !== this.renderer.domElement) {
            this.renderer.domElement.requestPointerLock();
        }
    }

    _createCrosshair() {
        if (document.getElementById('game-crosshair')) return;
        const container = document.createElement('div');
        container.id = 'game-crosshair';
        container.style.position = 'absolute';
        container.style.left = '50%';
        container.style.top = '50%';
        container.style.transform = 'translate(-50%,-50%)';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '1000';

        const vert = document.createElement('div');
        vert.style.width = '2px';
        vert.style.height = '20px';
        vert.style.background = 'white';
        vert.style.margin = '0 auto';

        const hor = document.createElement('div');
        hor.style.width = '20px';
        hor.style.height = '2px';
        hor.style.background = 'white';
        hor.style.position = 'relative';
        hor.style.top = '-11px';

        container.appendChild(vert);
        container.appendChild(hor);
        document.body.appendChild(container);
    }

    _createCrosshair3D() {
        // Remove DOM crosshair if present
        const dom = document.getElementById('game-crosshair');
        if (dom) dom.remove();

        // Create a canvas texture with a crosshair drawing so the sprite looks like a reticle
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        // Transparent background
        ctx.clearRect(0, 0, size, size);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';

        // Draw crosshair lines (centered)
        const cx = size / 2;
        const cy = size / 2;
        const gap = 12;
        const len = 28;

        // top
        ctx.beginPath();
        ctx.moveTo(cx, cy - gap - len);
        ctx.lineTo(cx, cy - gap);
        ctx.stroke();
        // bottom
        ctx.beginPath();
        ctx.moveTo(cx, cy + gap + len);
        ctx.lineTo(cx, cy + gap);
        ctx.stroke();
        // left
        ctx.beginPath();
        ctx.moveTo(cx - gap - len, cy);
        ctx.lineTo(cx - gap, cy);
        ctx.stroke();
        // right
        ctx.beginPath();
        ctx.moveTo(cx + gap + len, cy);
        ctx.lineTo(cx + gap, cy);
        ctx.stroke();

        // small center dot
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
        const sprite = new THREE.Sprite(material);
        // scale in world units so it's visible above the cube but not huge
        sprite.scale.set(1.0, 1.0, 1.0);
        sprite.renderOrder = 999;
        this.crosshair3D = sprite;
        this.scene.add(this.crosshair3D);
    }

    _onPointerLockChange() {
        if (document.pointerLockElement === (this.renderer && this.renderer.domElement)) {
            document.addEventListener('mousemove', this._onMouseMove);
        } else {
            document.removeEventListener('mousemove', this._onMouseMove);
        }
    }

    _onMouseMove(e) {
        // update yaw/pitch based on mouse movement
        this.yaw -= e.movementX * this.MOUSE_SENS;
        this.pitch += e.movementY * this.MOUSE_SENS;
        const PI_2 = Math.PI / 2;
        const maxPitch = PI_2 - 0.1;
        const minPitch = -maxPitch;
        this.pitch = Math.max(minPitch, Math.min(maxPitch, this.pitch));
    }

    _updateCamera() {
        // Third-person offset like level1.js
        const distance = 6;
        const height = 2.5;

        const camOffset = new THREE.Vector3(0, 0, -distance)
            .applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));

        // Desired camera position before collision/clipping adjustments
        const desiredPos = this.player.position.clone().add(camOffset);
        desiredPos.y += height;

        // Prevent camera from clipping into the ground using the ground collider when available
        const groundCollider = this.scene && this.scene.userData && this.scene.userData.groundCollider;
        if (groundCollider) {
            const groundY = groundCollider.getHeightAt(desiredPos.x, desiredPos.z);
            const minCameraY = groundY + 0.1; // small margin above ground
            if (desiredPos.y < minCameraY) desiredPos.y = minCameraY;
        } else {
            // also avoid sinking below a small world floor at y = 0
            if (desiredPos.y < 0.1) desiredPos.y = 0.1;
        }

        // Prevent the camera getting too close (inside) the player. Keep a minimum distance.
        const toCam = desiredPos.clone().sub(this.player.position);
        const minDistance = 1.2; // world units
        if (toCam.length() < minDistance) {
            toCam.setLength(minDistance);
            desiredPos.copy(this.player.position).add(toCam);
        }

        this.camera.position.copy(desiredPos);
        this.camera.lookAt(this.player.position);
    }

    loop = () => {
        requestAnimationFrame(this.loop);

        const now = performance.now();
        const delta = (now - this.lastTime) / 1000;
        this.lastTime = now;

        // Toggle flying on key-down edge only
        if (input.flyToggle && !this.prevFlyToggle) {
            this.isFlying = !this.isFlying;
            if (this.isFlying) {
                // Begin smooth ascent when starting flight
                this.flyState.isAscendingToFly = true;
                this.flyState.targetFlyHeight = this.player.position.y + 10;
            }
        }
        this.prevFlyToggle = input.flyToggle;

        if (this.isFlying) {
            const landed = updateFlying(this.player, this.camera, this.scene, delta, this.flyState);
            if (landed) {
                this.isFlying = false;
                this.flyState.isAscendingToFly = false;
            }
        } else {
            updateWalking(this.player, this.camera, this.scene, delta);
        }

        // Update camera using yaw/pitch and follow player (third-person like level1.js)
        this._updateCamera();

        // Position 3D crosshair at the player's position (slightly above the cube)
        if (this.crosshair3D) {
            const targetPos = this.player.position.clone();
            targetPos.y = this.player.position.y + 0.6; // slightly above cube
            this.crosshair3D.position.copy(targetPos);
            // Ensure sprite faces the camera
            this.crosshair3D.lookAt(this.camera.position);
        }

        this.renderer.render(this.scene, this.camera);
    }
}
