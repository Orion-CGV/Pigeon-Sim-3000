/**
 * ========================================
 * DELIVERY SYSTEM
 * ========================================
 * 
 * Manages the delivery mission gameplay:
 * - Pickup zones (green circles)
 * - Delivery zones (blue circles)
 * - State machine (idle, picking_up, has_package, delivered)
 * - Distance checking
 * - Visual effects (pulsing, color changes)
 * - UI status updates
 * 
 * This module provides a simple mission system for the game.
 * ========================================
 */

export class DeliverySystem {
    constructor(scene, uiSystem) {
        this.scene = scene;
        this.uiSystem = uiSystem;
        
        // Delivery state
        this.deliveryState = 'idle'; // idle, picking_up, has_package, delivered
        this.pickupTimer = 0;
        
        // Configuration
        this.pickupLocation = { x: 30, z: 30 };
        this.deliveryLocation = { x: -40, z: -40 };
        this.pickupRequired = 5; // seconds to pickup
        this.deliveryRadius = 8; // zone radius
        
        // Zone objects
        this.pickupZone = null;
        this.deliveryZone = null;
    }
    
    /**
     * Initialize delivery zones and add to scene
     */
    init() {
        this.createDeliveryZones();
    }
    
    /**
     * Create pickup and delivery zone visuals
     */
    createDeliveryZones() {
        // Create pickup zone (green circle)
        const pickupGeometry = new THREE.CylinderGeometry(
            this.deliveryRadius, 
            this.deliveryRadius, 
            0.2, 
            32
        );
        const pickupMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.5,
            emissive: 0x00ff00,
            emissiveIntensity: 0.3,
            depthWrite: false // Prevent z-fighting
        });
        this.pickupZone = new THREE.Mesh(pickupGeometry, pickupMaterial);
        this.pickupZone.position.set(this.pickupLocation.x, 0.1, this.pickupLocation.z);
        this.pickupZone.renderOrder = 2; // Render after ground and shadows
        this.scene.add(this.pickupZone);
        
        // Create delivery zone (blue circle) - hidden initially
        const deliveryGeometry = new THREE.CylinderGeometry(
            this.deliveryRadius, 
            this.deliveryRadius, 
            0.2, 
            32
        );
        const deliveryMaterial = new THREE.MeshStandardMaterial({
            color: 0x0088ff,
            transparent: true,
            opacity: 0.5,
            emissive: 0x0088ff,
            emissiveIntensity: 0.3,
            depthWrite: false // Prevent z-fighting
        });
        this.deliveryZone = new THREE.Mesh(deliveryGeometry, deliveryMaterial);
        this.deliveryZone.position.set(this.deliveryLocation.x, 0.1, this.deliveryLocation.z);
        this.deliveryZone.renderOrder = 2; // Render after ground and shadows
        this.deliveryZone.visible = false; // Hidden until package picked up
        this.scene.add(this.deliveryZone);
    }
    
    /**
     * Update zone positions (e.g., when ground level is known)
     * @param {number} groundY - Ground level Y position
     */
    updateZonePositions(groundY) {
        if (this.pickupZone) {
            this.pickupZone.position.y = groundY + 0.1;
        }
        if (this.deliveryZone) {
            this.deliveryZone.position.y = groundY + 0.1;
        }
    }
    
    /**
     * Update delivery system logic
     * @param {number} deltaTime - Time since last frame (seconds)
     * @param {THREE.Object3D} carWrapper - Car object with position
     */
    update(deltaTime, carWrapper) {
        if (!carWrapper) return;
        
        const carPos = carWrapper.position;
        
        // Check distance to pickup zone
        const distToPickup = Math.sqrt(
            (carPos.x - this.pickupLocation.x) ** 2 + 
            (carPos.z - this.pickupLocation.z) ** 2
        );
        
        // Check distance to delivery zone
        const distToDelivery = Math.sqrt(
            (carPos.x - this.deliveryLocation.x) ** 2 + 
            (carPos.z - this.deliveryLocation.z) ** 2
        );
        
        // State machine
        if (this.deliveryState === 'idle' || this.deliveryState === 'picking_up') {
            if (distToPickup < this.deliveryRadius) {
                this.deliveryState = 'picking_up';
                this.pickupTimer += deltaTime;
                
                // Pulsing effect on zone
                this.pickupZone.material.opacity = 0.3 + Math.sin(Date.now() * 0.01) * 0.2;
                
                const remaining = Math.max(0, this.pickupRequired - this.pickupTimer);
                if (this.uiSystem) {
                    this.uiSystem.updateDeliveryStatus(
                        `Picking up... ${remaining.toFixed(1)}s`, 
                        '#ffff00'
                    );
                }
                
                if (this.pickupTimer >= this.pickupRequired) {
                    this.deliveryState = 'has_package';
                    this.pickupZone.visible = false;
                    this.deliveryZone.visible = true;
                    this.pickupTimer = 0;
                    if (this.uiSystem) {
                        this.uiSystem.updateDeliveryStatus('Go to blue zone!', '#00ff00');
                    }
                }
            } else if (this.deliveryState === 'picking_up') {
                // Left the zone
                this.deliveryState = 'idle';
                this.pickupTimer = 0;
                this.pickupZone.material.opacity = 0.5;
                if (this.uiSystem) {
                    this.uiSystem.updateDeliveryStatus('Go to green zone', '#64b5f6');
                }
            }
        } else if (this.deliveryState === 'has_package') {
            if (distToDelivery < this.deliveryRadius) {
                this.deliveryState = 'delivered';
                this.deliveryZone.material.color.setHex(0xffff00);
                if (this.uiSystem) {
                    this.uiSystem.updateDeliveryStatus('Delivered! 🎉', '#00ff00');
                }
                
                // Reset after 3 seconds
                setTimeout(() => {
                    this.deliveryState = 'idle';
                    this.pickupTimer = 0;
                    this.pickupZone.visible = true;
                    this.deliveryZone.visible = false;
                    this.deliveryZone.material.color.setHex(0x0088ff);
                    if (this.uiSystem) {
                        this.uiSystem.updateDeliveryStatus('Go to green zone', '#64b5f6');
                    }
                }, 3000);
            }
        }
    }
    
    /**
     * Get current delivery state
     * @returns {string} Current state
     */
    getState() {
        return this.deliveryState;
    }
    
    /**
     * Get pickup location
     * @returns {Object} {x, z} coordinates
     */
    getPickupLocation() {
        return this.pickupLocation;
    }
    
    /**
     * Get delivery location
     * @returns {Object} {x, z} coordinates
     */
    getDeliveryLocation() {
        return this.deliveryLocation;
    }
    
    /**
     * Set pickup location (useful for random missions)
     * @param {number} x - X coordinate
     * @param {number} z - Z coordinate
     */
    setPickupLocation(x, z) {
        this.pickupLocation = { x, z };
        if (this.pickupZone) {
            this.pickupZone.position.x = x;
            this.pickupZone.position.z = z;
        }
    }
    
    /**
     * Set delivery location (useful for random missions)
     * @param {number} x - X coordinate
     * @param {number} z - Z coordinate
     */
    setDeliveryLocation(x, z) {
        this.deliveryLocation = { x, z };
        if (this.deliveryZone) {
            this.deliveryZone.position.x = x;
            this.deliveryZone.position.z = z;
        }
    }
    
    /**
     * Reset delivery mission
     */
    reset() {
        this.deliveryState = 'idle';
        this.pickupTimer = 0;
        if (this.pickupZone) {
            this.pickupZone.visible = true;
            this.pickupZone.material.opacity = 0.5;
        }
        if (this.deliveryZone) {
            this.deliveryZone.visible = false;
            this.deliveryZone.material.color.setHex(0x0088ff);
        }
        if (this.uiSystem) {
            this.uiSystem.updateDeliveryStatus('Go to green zone', '#64b5f6');
        }
    }
    
    /**
     * Cleanup delivery system
     */
    cleanup() {
        if (this.pickupZone) {
            this.scene.remove(this.pickupZone);
            this.pickupZone.geometry.dispose();
            this.pickupZone.material.dispose();
            this.pickupZone = null;
        }
        if (this.deliveryZone) {
            this.scene.remove(this.deliveryZone);
            this.deliveryZone.geometry.dispose();
            this.deliveryZone.material.dispose();
            this.deliveryZone = null;
        }
    }
}

