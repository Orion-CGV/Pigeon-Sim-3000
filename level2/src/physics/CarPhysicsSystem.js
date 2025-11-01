/**
 * ========================================
 * CAR PHYSICS SYSTEM
 * ========================================
 * 
 * Manages all car physics:
 * - Physics body creation and setup
 * - Force-based movement and acceleration
 * - Boost mechanics
 * - Steering and turning
 * - Wheel rotation animations
 * - Physics/visual model synchronization
 * 
 * This module handles all car physics simulation.
 * ========================================
 */

export class CarPhysicsSystem {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        
        // Physics body and offset
        this.carBody = null;
        this.carPhysicsOffset = new THREE.Vector3();
        
        // Car control state
        this.carSpeed = 0;
        this.carDirection = 0;
        this.currentAcceleration = 0;
        
        // Boost system
        this.isBoosting = false;
        this.boostAmount = 4.0;
        this.maxBoost = 4.0;
        this.boostDrainRate = 1.0;
        this.boostRefillRate = 0.5;
        
        // Visual debug helper
        this.carHelper = null;
    }
    
    /**
     * Create physics body for the car
     * @param {THREE.Object3D} carWrapper - Car wrapper object
     */
    createPhysicsBody(carWrapper) {
        // Create a box shape for the car based on its bounding box
        const box = new THREE.Box3().setFromObject(carWrapper);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        // Calculate the offset between wrapper position and bounding box center
        this.carPhysicsOffset.copy(center).sub(carWrapper.position);
        
        // Create physics body with box shape
        const carShape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
        this.carBody = new CANNON.Body({
            mass: 5,
            shape: carShape,
            material: new CANNON.Material({ friction: 0.05, restitution: 0 }),
            linearDamping: 0.01,
            angularDamping: 0.05
        });
        
        // Position the physics body at the center of the bounding box
        this.carBody.position.set(center.x, center.y, center.z);
        
        // Set initial rotation
        this.carBody.quaternion.set(
            carWrapper.quaternion.x,
            carWrapper.quaternion.y,
            carWrapper.quaternion.z,
            carWrapper.quaternion.w
        );
        
        // Lock rotation on X and Z axes to prevent flipping/tipping
        this.carBody.angularFactor = new CANNON.Vec3(0, 1, 0);
        this.carBody.updateMassProperties();
        
        this.world.addBody(this.carBody);
        
        // Create visual helper for car collision box
        const helperGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const helperMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff0000, 
            wireframe: true,
            transparent: true,
            opacity: 0.7
        });
        this.carHelper = new THREE.Mesh(helperGeometry, helperMaterial);
        this.scene.add(this.carHelper);
        
        // Debug: check position after a few frames
        setTimeout(() => {




        }, 1000);
    }
    
    /**
     * Update boost system
     * @param {number} deltaTime - Time since last frame
     */
    updateBoost(deltaTime) {
        // Drain boost when boosting
        if (this.isBoosting && this.boostAmount > 0) {
            this.boostAmount -= this.boostDrainRate * deltaTime;
            if (this.boostAmount <= 0) {
                this.boostAmount = 0;
                this.isBoosting = false;
            }
        }
        
        // Refill boost when not boosting
        if (!this.isBoosting && this.boostAmount < this.maxBoost) {
            this.boostAmount += this.boostRefillRate * deltaTime;
            if (this.boostAmount > this.maxBoost) {
                this.boostAmount = this.maxBoost;
            }
        }
    }
    
    /**
     * Update wheel steering animation
     * @param {THREE.Object3D} frontWheelsGroup - Front wheels group
     */
    updateWheelSteering(frontWheelsGroup) {
        if (!frontWheelsGroup) return;
        
        const maxSteerAngle = Math.PI / 4;
        const steerAngle = this.carDirection * maxSteerAngle;
        const targetRotation = -1 * steerAngle;
        
        if (frontWheelsGroup.wheels) {
            frontWheelsGroup.wheels.forEach(function (wheel) {
                gsap.to(wheel.rotation, {
                    y: targetRotation,
                    duration: 0.25,
                    ease: "power2.out"
                });
            });
        } else {
            frontWheelsGroup.traverse(function (node) {
                if (node.name === "FrontRightWheel" || node.name === "FrontLeftWheel") {
                    gsap.to(node.rotation, {
                        y: targetRotation,
                        duration: 0.25,
                        ease: "power2.out"
                    });
                }
            });
        }
    }
    
    /**
     * Update physics simulation
     * @param {THREE.Object3D} carWrapper - Car wrapper object
     * @param {THREE.Object3D} frontWheelsGroup - Front wheels for steering animation
     */
    update(carWrapper, frontWheelsGroup) {
        if (!carWrapper || !this.carBody) return;
        
        // Update wheel steering animation
        this.updateWheelSteering(frontWheelsGroup);
        
        // Wake up the physics body to ensure it responds
        this.carBody.wakeUp();
        
        // Force the car to stay perfectly level (no pitch or roll)
        const euler = new CANNON.Vec3();
        this.carBody.quaternion.toEuler(euler);
        this.carBody.quaternion.setFromEuler(0, euler.y, 0);
        
        // Zero out any X or Z angular velocity to prevent tipping
        this.carBody.angularVelocity.x = 0;
        this.carBody.angularVelocity.z = 0;
        
        // PHYSICS-BASED MOVEMENT with forces and momentum
        const forwardVector = new CANNON.Vec3(1, 0, 0);
        this.carBody.quaternion.vmult(forwardVector, forwardVector);
        
        if (Math.abs(this.carSpeed) > 0.1) {
            // Gradually interpolate acceleration toward target (smooth buildup)
            const targetAcceleration = this.carSpeed;
            const accelerationRate = 0.08;
            this.currentAcceleration += (targetAcceleration - this.currentAcceleration) * accelerationRate;
            
            // Apply force based on current (smoothed) acceleration
            let acceleration = this.currentAcceleration * 300;
            
            // Apply boost multiplier when space is pressed
            if (this.isBoosting) {
                acceleration *= 2.0; // 2x speed boost
            }
            
            const driveForce = new CANNON.Vec3(
                forwardVector.x * acceleration,
                0,
                forwardVector.z * acceleration
            );
            this.carBody.applyForce(driveForce, this.carBody.position);
            
            // Calculate current speed
            const currentSpeed = Math.sqrt(
                this.carBody.velocity.x ** 2 + this.carBody.velocity.z ** 2
            );
            
            // Lower top speed
            const maxSpeed = Math.abs(this.carSpeed) * 1.0;
            if (currentSpeed > maxSpeed) {
                const dragForce = new CANNON.Vec3(
                    -this.carBody.velocity.x * 150,
                    0,
                    -this.carBody.velocity.z * 150
                );
                this.carBody.applyForce(dragForce, this.carBody.position);
            }
            
            // Trackmania drift: Apply lateral friction to allow sliding
            const rightVector = new CANNON.Vec3(0, 0, 1);
            this.carBody.quaternion.vmult(rightVector, rightVector);
            
            // Calculate lateral (sideways) velocity
            const lateralVel = this.carBody.velocity.x * rightVector.x + 
                              this.carBody.velocity.z * rightVector.z;
            
            // Apply grip force (less = more drift)
            const gripForce = -lateralVel * 150;
            const lateralForce = new CANNON.Vec3(
                rightVector.x * gripForce,
                0,
                rightVector.z * gripForce
            );
            this.carBody.applyForce(lateralForce, this.carBody.position);
            
        } else {
            // Gradually reduce acceleration when not pressing keys
            this.currentAcceleration *= 0.9;
            
            // Very gentle slowdown when not accelerating
            const frictionForce = new CANNON.Vec3(
                -this.carBody.velocity.x * 50,
                0,
                -this.carBody.velocity.z * 50
            );
            this.carBody.applyForce(frictionForce, this.carBody.position);
        }
        
        // Dampen Y velocity to prevent bouncing/jittering
        if (Math.abs(this.carBody.velocity.y) < 0.5) {
            this.carBody.velocity.y *= 0.8;
        }
        
        // More controlled turning
        if (Math.abs(this.carDirection) > 0.01 && Math.abs(this.carSpeed) > 0.1) {
            const turnTorque = -this.carDirection * this.carSpeed * 15;
            this.carBody.torque.set(0, turnTorque, 0);
            
            // Lower max turning speed
            const maxAngularSpeed = 2.5;
            if (Math.abs(this.carBody.angularVelocity.y) > maxAngularSpeed) {
                this.carBody.angularVelocity.y = Math.sign(this.carBody.angularVelocity.y) * maxAngularSpeed;
            }
        } else {
            // Gentler snap back to center
            const counterTorque = -this.carBody.angularVelocity.y * 70;
            this.carBody.torque.set(0, counterTorque, 0);
        }
        
        // Sync Three.js visual model with physics body
        carWrapper.quaternion.copy(this.carBody.quaternion);
        
        // Rotate the offset based on current rotation, then subtract from physics position
        const rotatedOffset = this.carPhysicsOffset.clone();
        rotatedOffset.applyQuaternion(carWrapper.quaternion);
        carWrapper.position.copy(this.carBody.position).sub(rotatedOffset);
        
        // Update collision helper to match physics body
        if (this.carHelper) {
            this.carHelper.position.copy(this.carBody.position);
            this.carHelper.quaternion.copy(this.carBody.quaternion);
        }
    }
    
    /**
     * Set car speed
     * @param {number} speed - Speed value (-1 to 1)
     */
    setSpeed(speed) {
        this.carSpeed = speed;
    }
    
    /**
     * Set car direction (steering)
     * @param {number} direction - Direction value (-1 to 1)
     */
    setDirection(direction) {
        this.carDirection = Math.max(-1, Math.min(1, direction));
    }
    
    /**
     * Start boosting
     */
    startBoost() {
        if (this.boostAmount > 0) {
            this.isBoosting = true;
        }
    }
    
    /**
     * Stop boosting
     */
    stopBoost() {
        this.isBoosting = false;
    }
    
    /**
     * Get current speed
     * @returns {number}
     */
    getSpeed() {
        return this.carSpeed;
    }
    
    /**
     * Get current direction
     * @returns {number}
     */
    getDirection() {
        return this.carDirection;
    }
    
    /**
     * Get boost amount
     * @returns {number}
     */
    getBoostAmount() {
        return this.boostAmount;
    }
    
    /**
     * Get max boost
     * @returns {number}
     */
    getMaxBoost() {
        return this.maxBoost;
    }
    
    /**
     * Get boosting state
     * @returns {boolean}
     */
    getIsBoosting() {
        return this.isBoosting;
    }
    
    /**
     * Get physics body
     * @returns {CANNON.Body}
     */
    getPhysicsBody() {
        return this.carBody;
    }
    
    /**
     * Get physics offset
     * @returns {THREE.Vector3}
     */
    getPhysicsOffset() {
        return this.carPhysicsOffset;
    }
    
    /**
     * Get collision helper
     * @returns {THREE.Mesh}
     */
    getCollisionHelper() {
        return this.carHelper;
    }
    
    /**
     * Cleanup physics system
     */
    cleanup() {
        if (this.carBody) {
            this.world.removeBody(this.carBody);
        }
        if (this.carHelper) {
            this.scene.remove(this.carHelper);
            this.carHelper.geometry.dispose();
            this.carHelper.material.dispose();
        }
    }
}

