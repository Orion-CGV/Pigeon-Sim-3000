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
        if (!this.impactFlashElement) return;
        
        const opacity = Math.min(intensity / 10, 0.5); // Max 50% opacity
        this.impactFlashElement.style.opacity = opacity;
        
        // Fade out quickly
        setTimeout(() => {
            this.impactFlashElement.style.opacity = '0';
        }, 50);
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
     */
    update(deltaTime) {
        this.updateParticles(deltaTime);
        this.updateScreenShake();
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

