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
        
        // Imported zones from model
        this.importedPickupZone = null;
        this.importedDropoffZone = null;
        this.usingImportedZones = false;
        
        // Zone helpers (visual outlines)
        this.pickupZoneHelper = null;
        this.deliveryZoneHelper = null;
    }
    
    /**
     * Initialize delivery zones and add to scene
     * @param {Object} options - Optional configuration
     * @param {Array} options.pickupZones - Imported pickup zones from model
     * @param {Array} options.dropoffZones - Imported dropoff zones from model
     */
    init(options = {}) {
        if (options.pickupZones && options.pickupZones.length > 0 && 
            options.dropoffZones && options.dropoffZones.length > 0) {
            this.setupImportedZones(options.pickupZones, options.dropoffZones);
        } else {
            this.createDeliveryZones();
        }
    }
    
    /**
     * Setup imported zones from the model as detectors
     * @param {Array} pickupZones - Array of pickup zone objects
     * @param {Array} dropoffZones - Array of dropoff zone objects
     */
    setupImportedZones(pickupZones, dropoffZones) {
        console.log('🎯 Setting up imported delivery zones as detectors...');
        this.usingImportedZones = true;
        
        // Use the first pickup zone
        this.importedPickupZone = pickupZones[0];
        this.pickupZone = this.importedPickupZone;
        
        // Use the first dropoff zone
        this.importedDropoffZone = dropoffZones[0];
        this.deliveryZone = this.importedDropoffZone;
        
        // Setup pickup zone as detector
        this.setupZoneAsDetector(this.pickupZone, 0x00ff00, true);
        
        // Setup dropoff zone as detector (hidden initially)
        this.setupZoneAsDetector(this.deliveryZone, 0x0088ff, false);
        
        // Update locations based on zone positions
        this.pickupLocation = {
            x: this.pickupZone.position.x,
            z: this.pickupZone.position.z
        };
        this.deliveryLocation = {
            x: this.deliveryZone.position.x,
            z: this.deliveryZone.position.z
        };
        
        // Calculate radius from zone bounding box
        const pickupBBox = new THREE.Box3().setFromObject(this.pickupZone);
        const pickupSize = pickupBBox.getSize(new THREE.Vector3());
        this.deliveryRadius = Math.max(pickupSize.x, pickupSize.z) / 2;
        
        // Create visual outlines for the zones
        this.createZoneOutline(this.pickupZone, 0x00ff00, true);
        this.createZoneOutline(this.deliveryZone, 0x0088ff, false);
        
        console.log(`✅ Pickup zone at (${this.pickupLocation.x.toFixed(2)}, ${this.pickupLocation.z.toFixed(2)})`);
        console.log(`✅ Dropoff zone at (${this.deliveryLocation.x.toFixed(2)}, ${this.deliveryLocation.z.toFixed(2)})`);
        console.log(`✅ Detection radius: ${this.deliveryRadius.toFixed(2)}`);
    }
    
    /**
     * Setup a zone object as a detector (no physics, just visual trigger)
     * @param {THREE.Object3D} zone - Zone object
     * @param {number} color - Hex color for emissive material
     * @param {boolean} visible - Initial visibility
     */
    setupZoneAsDetector(zone, color, visible) {
        zone.visible = visible;
        
        // Traverse and setup materials for detector visualization
        zone.traverse((node) => {
            if (node.isMesh) {
                // Make the material transparent and emissive for detector effect
                if (node.material) {
                    const materials = Array.isArray(node.material) ? node.material : [node.material];
                    materials.forEach(mat => {
                        mat.transparent = true;
                        mat.opacity = 0.5;
                        mat.emissive = new THREE.Color(color);
                        mat.emissiveIntensity = 0.3;
                        mat.depthWrite = false;
                        mat.needsUpdate = true;
                    });
                }
                node.renderOrder = 2; // Render after ground
            }
        });
        
        console.log(`✓ Zone "${zone.name}" configured as detector (color: ${color.toString(16)})`);
    }
    
    /**
     * Create visual outline for a zone
     * @param {THREE.Object3D} zone - Zone object
     * @param {number} color - Hex color for outline
     * @param {boolean} visible - Initial visibility
     */
    createZoneOutline(zone, color, visible) {
        // Calculate bounding box for the zone
        const bbox = new THREE.Box3().setFromObject(zone);
        const size = bbox.getSize(new THREE.Vector3());
        const center = bbox.getCenter(new THREE.Vector3());
        
        // Expand the outline to match the expanded detection area
        const expandedSize = new THREE.Vector3(
            size.x + 4,  // Expand X by 4 (2 on each side)
            size.y + 20, // Expand Y by 20 (10 on each side) - taller trigger
            size.z + 4   // Expand Z by 4 (2 on each side)
        );
        
        // Create wireframe box as outline
        const outlineGeometry = new THREE.BoxGeometry(expandedSize.x, expandedSize.y, expandedSize.z);
        const outlineMaterial = new THREE.MeshBasicMaterial({
            color: color,
            wireframe: true,
            transparent: true,
            opacity: 0.8,
            linewidth: 2
        });
        
        const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
        outline.position.copy(center);
        outline.visible = visible;
        outline.renderOrder = 3; // Render on top
        
        this.scene.add(outline);
        
        // Store reference based on which zone
        if (zone === this.pickupZone) {
            this.pickupZoneHelper = outline;
        } else if (zone === this.deliveryZone) {
            this.deliveryZoneHelper = outline;
        }
        
        console.log(`✓ Created outline for zone "${zone.name}" (expanded for better detection)`);
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
        
        // Check if car is in pickup zone (use bounding box for imported zones)
        let inPickupZone = false;
        let inDeliveryZone = false;
        
        if (this.usingImportedZones && this.pickupZone) {
            inPickupZone = this.isCarInZone(carWrapper, this.pickupZone);
        } else {
            // Fallback to distance-based detection for created zones
            const distToPickup = Math.sqrt(
                (carPos.x - this.pickupLocation.x) ** 2 + 
                (carPos.z - this.pickupLocation.z) ** 2
            );
            inPickupZone = distToPickup < this.deliveryRadius;
        }
        
        if (this.usingImportedZones && this.deliveryZone) {
            inDeliveryZone = this.isCarInZone(carWrapper, this.deliveryZone);
        } else {
            // Fallback to distance-based detection for created zones
            const distToDelivery = Math.sqrt(
                (carPos.x - this.deliveryLocation.x) ** 2 + 
                (carPos.z - this.deliveryLocation.z) ** 2
            );
            inDeliveryZone = distToDelivery < this.deliveryRadius;
        }
        
        // Update outline colors based on detection
        if (this.pickupZoneHelper && this.deliveryState !== 'has_package' && this.deliveryState !== 'delivered') {
            this.pickupZoneHelper.material.color.setHex(inPickupZone ? 0xffff00 : 0x00ff00);
            this.pickupZoneHelper.material.opacity = inPickupZone ? 1.0 : 0.6;
        }
        
        if (this.deliveryZoneHelper && this.deliveryState === 'has_package') {
            this.deliveryZoneHelper.material.color.setHex(inDeliveryZone ? 0xffff00 : 0x0088ff);
            this.deliveryZoneHelper.material.opacity = inDeliveryZone ? 1.0 : 0.6;
        }
        
        // State machine
        if (this.deliveryState === 'idle' || this.deliveryState === 'picking_up') {
            if (inPickupZone) {
                this.deliveryState = 'picking_up';
                this.pickupTimer += deltaTime;
                
                // Pulsing effect on zone
                if (this.usingImportedZones) {
                    this.updateZoneOpacity(this.pickupZone, 0.3 + Math.sin(Date.now() * 0.01) * 0.2);
                } else {
                    this.pickupZone.material.opacity = 0.3 + Math.sin(Date.now() * 0.01) * 0.2;
                }
                
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
                    
                    // Show delivery zone outline, hide pickup zone outline
                    if (this.pickupZoneHelper) this.pickupZoneHelper.visible = false;
                    if (this.deliveryZoneHelper) this.deliveryZoneHelper.visible = true;
                    
                    this.pickupTimer = 0;
                    if (this.uiSystem) {
                        this.uiSystem.updateDeliveryStatus('Go to blue zone!', '#00ff00');
                    }
                }
            } else if (this.deliveryState === 'picking_up') {
                // Left the zone
                this.deliveryState = 'idle';
                this.pickupTimer = 0;
                if (this.usingImportedZones) {
                    this.updateZoneOpacity(this.pickupZone, 0.5);
                } else {
                    this.pickupZone.material.opacity = 0.5;
                }
                if (this.uiSystem) {
                    this.uiSystem.updateDeliveryStatus('Go to green zone', '#64b5f6');
                }
            }
        } else if (this.deliveryState === 'has_package') {
            if (inDeliveryZone) {
                this.deliveryState = 'delivered';
                if (this.usingImportedZones) {
                    this.updateZoneColor(this.deliveryZone, 0xffff00);
                } else {
                    this.deliveryZone.material.color.setHex(0xffff00);
                }
                if (this.uiSystem) {
                    this.uiSystem.updateDeliveryStatus('Delivered! 🎉', '#00ff00');
                }
                
                // Reset after 3 seconds
                setTimeout(() => {
                    this.deliveryState = 'idle';
                    this.pickupTimer = 0;
                    this.pickupZone.visible = true;
                    this.deliveryZone.visible = false;
                    
                    // Show pickup zone outline, hide delivery zone outline
                    if (this.pickupZoneHelper) this.pickupZoneHelper.visible = true;
                    if (this.deliveryZoneHelper) this.deliveryZoneHelper.visible = false;
                    
                    if (this.usingImportedZones) {
                        this.updateZoneColor(this.deliveryZone, 0x0088ff);
                    } else {
                        this.deliveryZone.material.color.setHex(0x0088ff);
                    }
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
     * Check if car is inside a zone using bounding box detection
     * @param {THREE.Object3D} carWrapper - Car object
     * @param {THREE.Object3D} zone - Zone object
     * @returns {boolean} True if car is in zone
     */
    isCarInZone(carWrapper, zone) {
        // Get bounding boxes
        const carBBox = new THREE.Box3().setFromObject(carWrapper);
        const zoneBBox = new THREE.Box3().setFromObject(zone);
        
        // Expand the zone bounding box to make detection more generous
        // Expand horizontally (X and Z) by 2 units and vertically (Y) by 10 units
        const expansion = new THREE.Vector3(2, 10, 2);
        zoneBBox.expandByVector(expansion);
        
        // Check if car's center point is inside the expanded zone bounding box
        const carCenter = carBBox.getCenter(new THREE.Vector3());
        
        // Also check if car position is within the zone (ignore Y axis for more lenient detection)
        const carPos = carWrapper.position;
        const isInXZ = carPos.x >= zoneBBox.min.x && carPos.x <= zoneBBox.max.x &&
                       carPos.z >= zoneBBox.min.z && carPos.z <= zoneBBox.max.z;
        
        return isInXZ || zoneBBox.containsPoint(carCenter);
    }
    
    /**
     * Update zone opacity (for imported zones)
     * @param {THREE.Object3D} zone - Zone object
     * @param {number} opacity - Opacity value (0-1)
     */
    updateZoneOpacity(zone, opacity) {
        zone.traverse((node) => {
            if (node.isMesh && node.material) {
                const materials = Array.isArray(node.material) ? node.material : [node.material];
                materials.forEach(mat => {
                    mat.opacity = opacity;
                    mat.needsUpdate = true;
                });
            }
        });
    }
    
    /**
     * Update zone color (for imported zones)
     * @param {THREE.Object3D} zone - Zone object
     * @param {number} color - Hex color
     */
    updateZoneColor(zone, color) {
        zone.traverse((node) => {
            if (node.isMesh && node.material) {
                const materials = Array.isArray(node.material) ? node.material : [node.material];
                materials.forEach(mat => {
                    mat.emissive.setHex(color);
                    mat.needsUpdate = true;
                });
            }
        });
    }
    
    /**
     * Reset delivery mission
     */
    reset() {
        this.deliveryState = 'idle';
        this.pickupTimer = 0;
        if (this.pickupZone) {
            this.pickupZone.visible = true;
            if (this.usingImportedZones) {
                this.updateZoneOpacity(this.pickupZone, 0.5);
            } else {
                this.pickupZone.material.opacity = 0.5;
            }
        }
        if (this.deliveryZone) {
            this.deliveryZone.visible = false;
            if (this.usingImportedZones) {
                this.updateZoneColor(this.deliveryZone, 0x0088ff);
            } else {
                this.deliveryZone.material.color.setHex(0x0088ff);
            }
        }
        if (this.uiSystem) {
            this.uiSystem.updateDeliveryStatus('Go to green zone', '#64b5f6');
        }
    }
    
    /**
     * Cleanup delivery system
     */
    cleanup() {
        // Clean up zone helpers
        if (this.pickupZoneHelper) {
            this.scene.remove(this.pickupZoneHelper);
            this.pickupZoneHelper.geometry.dispose();
            this.pickupZoneHelper.material.dispose();
            this.pickupZoneHelper = null;
        }
        if (this.deliveryZoneHelper) {
            this.scene.remove(this.deliveryZoneHelper);
            this.deliveryZoneHelper.geometry.dispose();
            this.deliveryZoneHelper.material.dispose();
            this.deliveryZoneHelper = null;
        }
        
        // Only clean up created zones, not imported ones
        if (!this.usingImportedZones) {
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
        } else {
            // Just clear references for imported zones
            this.pickupZone = null;
            this.deliveryZone = null;
            this.importedPickupZone = null;
            this.importedDropoffZone = null;
        }
    }
}

