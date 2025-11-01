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
        // Create crosshair UI
    this._createCrosshair();
    // Create a 3D crosshair in front of the player and remove the DOM one
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
        // Keep DOM crosshair visible; we create an additional 3D sprite in front of the cube

        // Sprite-based crosshair that sits a few units in front of the player
        const map = new THREE.TextureLoader().load(''); // no texture, we'll use material color
        const material = new THREE.SpriteMaterial({ color: 0xffffff });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(0.4, 0.4, 0.4);
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

        this.camera.position.copy(this.player.position).add(camOffset);
        this.camera.position.y += height;
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

        // Position 3D crosshair a bit in front of the player along camera direction
        if (this.crosshair3D) {
            const dir = new THREE.Vector3();
            this.camera.getWorldDirection(dir);
            dir.normalize();
            const distance = 5.0; // units in front of player
            const targetPos = this.player.position.clone().add(dir.multiplyScalar(distance));
            // Raise the crosshair slightly above the cube's height so it appears over the cube
            // Player cube is 1 unit tall; offset the crosshair by ~0.6 units above the player's base
            targetPos.y = this.player.position.y + 0.6;
            this.crosshair3D.position.copy(targetPos);
            // Ensure sprite faces the camera
            this.crosshair3D.lookAt(this.camera.position);
        }

        this.renderer.render(this.scene, this.camera);
    }
}
