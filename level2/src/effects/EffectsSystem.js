/**
 * ========================================
 * EFFECTS SYSTEM
 * ========================================
 * 
 * Manages all visual effects in the game:
 * - Collision particle systems
 * - Screen shake effects
 * - Impact flash effects
 * 
 * This module is completely self-contained and handles:
 * - Creating particle effects on collisions
 * - Updating particle physics (gravity, air resistance)
 * - Screen shake based on impact intensity
 * - Flash effects for visual feedback
 * ========================================
 */

export class EffectsSystem {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        
        // Particle system state
        this.particleSystems = [];
        this.maxParticles = 50; // Max particles per collision
        
        // Screen shake state
        this.screenShakeAmount = 0;
        this.screenShakeDecay = 0.9;
        
        // Impact flash element (will be set during init)
        this.impactFlashElement = null;
        
        // Boost effect state
        this.boostActive = false;
        this.boostTrailTimer = 0;
        this.boostTrailInterval = 0.05; // Create trail particles every 50ms
    }
    
    /**
     * Initialize the effects system with DOM elements
     */
    init() {
        // Setup impact flash element
        this.impactFlashElement = document.getElementById('impact-flash');
        if (this.impactFlashElement) {
        }
    }
    
    /**
     * Create particle effects at collision point
     * @param {THREE.Vector3} position - Collision position
     * @param {THREE.Vector3} velocity - Collision velocity
     * @param {number} color - Particle color (hex)
     */
    createCollisionParticles(position, velocity, color = 0xffaa00) {
        const particleCount = Math.min(this.maxParticles, 30);
        const particles = [];
        
        // Create particle geometry
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];
        const velocities = [];
        const lifespans = [];
        
        for (let i = 0; i < particleCount; i++) {
            // Starting position at collision point
            positions.push(position.x, position.y, position.z);
            
            // Random color variation
            const col = new THREE.Color(color);
            col.offsetHSL(Math.random() * 0.1 - 0.05, 0, Math.random() * 0.2 - 0.1);
            colors.push(col.r, col.g, col.b);
            
            // Random velocities spreading outward
            const speed = 2 + Math.random() * 3;
            const angle = Math.random() * Math.PI * 2;
            const elevation = Math.random() * Math.PI * 0.5; // Up to 90 degrees up
            
            const vx = Math.cos(angle) * Math.cos(elevation) * speed + (velocity.x * 0.3);
            const vy = Math.sin(elevation) * speed + 2; // Add upward force
            const vz = Math.sin(angle) * Math.cos(elevation) * speed + (velocity.z * 0.3);
            
            velocities.push(vx, vy, vz);
            
            // Random lifespan (1-2 seconds)
            lifespans.push(1 + Math.random());
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        
        // Create particle material
        const material = new THREE.PointsMaterial({
            size: 0.3,
            vertexColors: true,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        // Create particle system
        const particleSystem = new THREE.Points(geometry, material);
        this.scene.add(particleSystem);
        
        // Store particle data
        this.particleSystems.push({
            mesh: particleSystem,
            velocities: velocities,
            lifespans: lifespans,
            age: 0,
            maxLifespan: Math.max(...lifespans)
        });
    }
    
    /**
     * Update all active particle systems
     * @param {number} deltaTime - Time since last frame (seconds)
     */
    updateParticles(deltaTime) {
        // Update all particle systems
        for (let i = this.particleSystems.length - 1; i >= 0; i--) {
            const system = this.particleSystems[i];
            system.age += deltaTime;
            
            // Remove old particle systems
            if (system.age > system.maxLifespan) {
                this.scene.remove(system.mesh);
                system.mesh.geometry.dispose();
                system.mesh.material.dispose();
                this.particleSystems.splice(i, 1);
                continue;
            }
            
            // Update particle positions and opacity
            const positions = system.mesh.geometry.attributes.position.array;
            const velocities = system.velocities;
            const lifespans = system.lifespans;
            
            for (let j = 0; j < positions.length / 3; j++) {
                const idx = j * 3;
                
                // Check if this particle is still alive
                if (system.age < lifespans[j]) {
                    // Update position
                    positions[idx] += velocities[idx] * deltaTime;
                    positions[idx + 1] += velocities[idx + 1] * deltaTime;
                    positions[idx + 2] += velocities[idx + 2] * deltaTime;
                    
                    // Apply gravity
                    velocities[idx + 1] -= 9.8 * deltaTime;
                    
                    // Apply air resistance
                    velocities[idx] *= 0.98;
                    velocities[idx + 1] *= 0.98;
                    velocities[idx + 2] *= 0.98;
                }
            }
            
            system.mesh.geometry.attributes.position.needsUpdate = true;
            
            // Fade out particles
            const fadeStart = system.maxLifespan * 0.5;
            if (system.age > fadeStart) {
                const fadeProgress = (system.age - fadeStart) / (system.maxLifespan - fadeStart);
                system.mesh.material.opacity = 1 - fadeProgress;
            }
        }
    }
    
    /**
     * Trigger screen shake effect
     * @param {number} intensity - Shake intensity (0-2)
     */
    triggerScreenShake(intensity) {
        this.screenShakeAmount = Math.min(intensity, 2); // Cap shake intensity
    }
    
    /**
     * Trigger impact flash effect
     * @param {number} intensity - Flash intensity
     */
    triggerImpactFlash(intensity) {
        // Flash effects disabled
        return;
    }
    
    /**
     * Trigger boost activation effect
     * @param {THREE.Vector3} carPosition - Car position
     * @param {THREE.Quaternion} carRotation - Car rotation
     */
    triggerBoostActivation(carPosition, carRotation) {
        // Create burst of particles at car position
        const particleCount = 40;
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];
        const velocities = [];
        const lifespans = [];
        
        // Get backward direction from car rotation
        const backwardDir = new THREE.Vector3(0, 0, 1);
        backwardDir.applyQuaternion(carRotation);
        
        for (let i = 0; i < particleCount; i++) {
            // Start particles behind the car
            const offsetX = (Math.random() - 0.5) * 2;
            const offsetY = Math.random() * 1;
            const offsetZ = (Math.random() - 0.5) * 2;
            
            positions.push(
                carPosition.x + backwardDir.x * 2 + offsetX,
                carPosition.y + offsetY,
                carPosition.z + backwardDir.z * 2 + offsetZ
            );
            
            // Blue/cyan boost colors
            const col = new THREE.Color();
            col.setHSL(0.55 + Math.random() * 0.1, 1, 0.5 + Math.random() * 0.3);
            colors.push(col.r, col.g, col.b);
            
            // Velocities spreading backward and outward
            const speed = 3 + Math.random() * 5;
            const spreadAngle = (Math.random() - 0.5) * Math.PI * 0.5;
            const elevation = (Math.random() - 0.3) * Math.PI * 0.3;
            
            const vx = (backwardDir.x + Math.sin(spreadAngle)) * speed;
            const vy = Math.sin(elevation) * speed;
            const vz = (backwardDir.z + Math.cos(spreadAngle)) * speed;
            
            velocities.push(vx, vy, vz);
            lifespans.push(0.4 + Math.random() * 0.3);
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        
        const material = new THREE.PointsMaterial({
            size: 0.4,
            vertexColors: true,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        const particleSystem = new THREE.Points(geometry, material);
        this.scene.add(particleSystem);
        
        this.particleSystems.push({
            mesh: particleSystem,
            velocities: velocities,
            lifespans: lifespans,
            age: 0,
            maxLifespan: Math.max(...lifespans)
        });
    }
    
    /**
     * Create boost trail particles
     * @param {THREE.Vector3} carPosition - Car position
     * @param {THREE.Quaternion} carRotation - Car rotation
     */
    createBoostTrailParticles(carPosition, carRotation) {
        const particleCount = 8;
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];
        const velocities = [];
        const lifespans = [];
        
        // Get backward direction
        const backwardDir = new THREE.Vector3(0, 0, 1);
        backwardDir.applyQuaternion(carRotation);
        
        for (let i = 0; i < particleCount; i++) {
            // Spawn behind car
            const offsetX = (Math.random() - 0.5) * 1.5;
            const offsetY = Math.random() * 0.5;
            const offsetZ = (Math.random() - 0.5) * 1.5;
            
            positions.push(
                carPosition.x + backwardDir.x * 2.5 + offsetX,
                carPosition.y + offsetY,
                carPosition.z + backwardDir.z * 2.5 + offsetZ
            );
            
            // Blue/cyan trail colors
            const col = new THREE.Color();
            col.setHSL(0.55 + Math.random() * 0.1, 0.9, 0.6);
            colors.push(col.r, col.g, col.b);
            
            // Slower trailing particles
            const speed = 1 + Math.random() * 2;
            velocities.push(
                backwardDir.x * speed + (Math.random() - 0.5),
                (Math.random() - 0.5) * 0.5,
                backwardDir.z * speed + (Math.random() - 0.5)
            );
            
            lifespans.push(0.3 + Math.random() * 0.2);
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        
        const material = new THREE.PointsMaterial({
            size: 0.35,
            vertexColors: true,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        const particleSystem = new THREE.Points(geometry, material);
        this.scene.add(particleSystem);
        
        this.particleSystems.push({
            mesh: particleSystem,
            velocities: velocities,
            lifespans: lifespans,
            age: 0,
            maxLifespan: Math.max(...lifespans)
        });
    }
    
    /**
     * Create wheel swoosh particles
     * @param {THREE.Object3D} carWrapper - Car wrapper object
     * @param {THREE.Quaternion} carRotation - Car rotation
     */
    createWheelSwooshParticles(carWrapper, carRotation) {
        if (!carWrapper) return;
        
        // Find actual wheel objects in the car model
        const wheels = [];
        carWrapper.traverse((node) => {
            if (node.name && (
                node.name.includes('Wheel') || 
                node.name.includes('wheel') ||
                node.name.includes('WHEEL')
            )) {
                wheels.push(node);
            }
        });
        
        
        // If no wheels found, use fallback positions
        if (wheels.length === 0) {
            wheels.push(
                { position: new THREE.Vector3(-0.8, 0.2, 1.2) },  // Front left
                { position: new THREE.Vector3(0.8, 0.2, 1.2) },   // Front right
                { position: new THREE.Vector3(-0.8, 0.2, -1.2) }, // Rear left
                { position: new THREE.Vector3(0.8, 0.2, -1.2) }   // Rear right
            );
        }
        
        // Get backward direction from car rotation
        // Right was Z+, left was Z-, so backward must be on X axis
        const backwardDir = new THREE.Vector3(-1, 0, 0); // Behind the car
        backwardDir.applyQuaternion(carRotation);
        
        const rightDir = new THREE.Vector3(0, 0, 1);
        rightDir.applyQuaternion(carRotation);
        
        // Create particles for each wheel
        wheels.forEach((wheel, wheelIndex) => {
            const particleCount = 8;
            const geometry = new THREE.BufferGeometry();
            const positions = [];
            const colors = [];
            const velocities = [];
            const lifespans = [];
            
            // Get wheel world position
            const wheelWorldPos = new THREE.Vector3();
            if (wheel.getWorldPosition) {
                wheel.getWorldPosition(wheelWorldPos);
            } else {
                // Use position relative to car
                carWrapper.getWorldPosition(wheelWorldPos);
                wheelWorldPos.add(wheel.position);
            }
            
            // Determine if this is a left or right wheel for swoosh direction
            const wheelLocalPos = wheel.position || new THREE.Vector3();
            const isLeftWheel = wheelLocalPos.x < 0;
            const lateralDir = isLeftWheel ? 
                new THREE.Vector3(-rightDir.x, -rightDir.y, -rightDir.z) : 
                rightDir.clone();
            
            for (let i = 0; i < particleCount; i++) {
                // Start at wheel position
                positions.push(wheelWorldPos.x, wheelWorldPos.y, wheelWorldPos.z);
                
                // Bright cyan/white swoosh colors
                const col = new THREE.Color();
                const hue = 0.52 + Math.random() * 0.08; // Bright cyan
                const sat = 0.8 + Math.random() * 0.2;
                const light = 0.7 + Math.random() * 0.25;
                col.setHSL(hue, sat, light);
                colors.push(col.r, col.g, col.b);
                
                // Create swoosh effect: MOSTLY backward with slight outward and upward
                const backwardSpeed = 6 + Math.random() * 5;
                const lateralSpeed = 0.3 + Math.random() * 0.5; // Much less lateral
                const upwardSpeed = 0.3 + Math.random() * 0.8;
                
                const vx = backwardDir.x * backwardSpeed + lateralDir.x * lateralSpeed;
                const vy = upwardSpeed;
                const vz = backwardDir.z * backwardSpeed + lateralDir.z * lateralSpeed;
                
                velocities.push(vx, vy, vz);
                lifespans.push(0.3 + Math.random() * 0.25);
            }
            
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            
            const material = new THREE.PointsMaterial({
                size: 1.2,
                vertexColors: true,
                transparent: true,
                opacity: 1,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                sizeAttenuation: false
            });
            
            const particleSystem = new THREE.Points(geometry, material);
            this.scene.add(particleSystem);
            
            this.particleSystems.push({
                mesh: particleSystem,
                velocities: velocities,
                lifespans: lifespans,
                age: 0,
                maxLifespan: Math.max(...lifespans)
            });
        });
    }
    
    /**
     * Update boost effects
     * @param {boolean} isBoosting - Whether boost is active
     * @param {THREE.Vector3} carPosition - Car position
     * @param {THREE.Quaternion} carRotation - Car rotation
     * @param {THREE.Object3D} carWrapper - Car wrapper object
     * @param {number} deltaTime - Time since last frame
     */
    updateBoostEffects(isBoosting, carPosition, carRotation, carWrapper, deltaTime) {
        if (isBoosting && carPosition && carRotation) {
            this.boostTrailTimer += deltaTime;
            
            // Create trail particles at intervals
            if (this.boostTrailTimer >= this.boostTrailInterval) {
                this.createBoostTrailParticles(carPosition, carRotation);
                
                // Create wheel swoosh particles
                if (carWrapper) {
                    this.createWheelSwooshParticles(carWrapper, carRotation);
                }
                
                this.boostTrailTimer = 0;
            }
        }
    }
    
    /**
     * Update screen shake effect (apply to camera)
     */
    updateScreenShake() {
        if (this.screenShakeAmount > 0.01) {
            // Apply screen shake to camera
            const shakeX = (Math.random() - 0.5) * this.screenShakeAmount;
            const shakeY = (Math.random() - 0.5) * this.screenShakeAmount;
            const shakeZ = (Math.random() - 0.5) * this.screenShakeAmount;
            
            this.camera.position.x += shakeX;
            this.camera.position.y += shakeY;
            this.camera.position.z += shakeZ;
            
            // Decay shake
            this.screenShakeAmount *= this.screenShakeDecay;
        } else {
            this.screenShakeAmount = 0;
        }
    }
    
    /**
     * Main update function - call this every frame
     * @param {number} deltaTime - Time since last frame (seconds)
     * @param {Object} options - Optional parameters {isBoosting, carPosition, carRotation, carWrapper}
     */
    update(deltaTime, options = {}) {
        this.updateParticles(deltaTime);
        this.updateScreenShake();
        
        // Update boost effects if provided
        if (options.isBoosting !== undefined && options.carPosition && options.carRotation) {
            this.updateBoostEffects(options.isBoosting, options.carPosition, options.carRotation, options.carWrapper, deltaTime);
        }
    }
    
    /**
     * Get active particle system count
     * @returns {number} Number of active particle systems
     */
    getActiveParticleCount() {
        return this.particleSystems.length;
    }
    
    /**
     * Cleanup all particle systems
     */
    cleanup() {
        for (let i = this.particleSystems.length - 1; i >= 0; i--) {
            const system = this.particleSystems[i];
            this.scene.remove(system.mesh);
            system.mesh.geometry.dispose();
            system.mesh.material.dispose();
        }
        this.particleSystems = [];
    }
}

