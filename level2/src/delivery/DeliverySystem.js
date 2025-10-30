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
        
        // Game state machine
        this.gameState = 'first_pickup'; // first_pickup, first_delivery, refuel, second_pickup, second_delivery, completed
        this.deliveryState = 'idle'; // idle, picking_up, has_package, delivered, refueling
        this.pickupTimer = 0;
        this.refuelTimer = 0;
        
        // Configuration
        this.pickupLocation = { x: 30, z: 30 };
        this.deliveryLocation = { x: -40, z: -40 };
        this.pickupRequired = 3; // seconds to pickup/deliver
        this.refuelRequired = 5; // seconds to refuel
        this.deliveryRadius = 8; // zone radius
        
        // Game timer
        this.gameStartTime = null;
        this.gameEndTime = null;
        this.completionTime = 0;
        
        // Zone objects
        this.pickupZone1 = null;
        this.deliveryZone1 = null;
        this.pickupZone2 = null;
        this.deliveryZone2 = null;
        this.gasStation = null;
        
        // Current active zones
        this.activePickupZone = null;
        this.activeDeliveryZone = null;
        
        // Imported zones from model
        this.usingImportedZones = false;
        
        // Zone helpers (visual outlines)
        this.pickupZone1Helper = null;
        this.deliveryZone1Helper = null;
        this.pickupZone2Helper = null;
        this.deliveryZone2Helper = null;
        this.gasStationHelper = null;
        
        // Zone bounding boxes for debugging
        this.pickupZone1BBox = null;
        this.deliveryZone1BBox = null;
        this.pickupZone2BBox = null;
        this.deliveryZone2BBox = null;
        this.gasStationBBox = null;
        
        // Track if we've logged trigger activation to avoid spam
        this.lastTriggerState = { pickup: false, delivery: false, refuel: false };
        
        // Reference to lighting system (set externally)
        this.lightingSystem = null;
    }
    
    /**
     * Initialize delivery zones and add to scene
     * @param {Object} options - Optional configuration
     * @param {Array} options.pickupZones - Imported pickup zones from model
     * @param {Array} options.dropoffZones - Imported dropoff zones from model
     * @param {Array} options.refuelZones - Imported refuel zones from model
     */
    init(options = {}) {
        if (options.pickupZones && options.pickupZones.length > 0 && 
            options.dropoffZones && options.dropoffZones.length > 0) {
            this.setupImportedZones(options.pickupZones, options.dropoffZones, options.refuelZones);
        } else {
            this.createDeliveryZones();
        }
    }
    
    /**
     * Setup imported zones from the model as detectors
     * @param {Array} pickupZones - Array of pickup zone objects
     * @param {Array} dropoffZones - Array of dropoff zone objects
     * @param {Array} refuelZones - Array of refuel zone objects
     */
    setupImportedZones(pickupZones, dropoffZones, refuelZones) {
        console.log('🎯 Setting up imported delivery zones as detectors...');
        console.log(`   Received pickup zones: ${pickupZones ? pickupZones.length : 'undefined'}`);
        console.log(`   Received dropoff zones: ${dropoffZones ? dropoffZones.length : 'undefined'}`);
        console.log(`   Received refuel zones: ${refuelZones ? refuelZones.length : 'undefined'}`);
        this.usingImportedZones = true;
        
        // Setup Zone 1 (first delivery)
        if (pickupZones.length > 0) {
            this.pickupZone1 = pickupZones[0];
            this.setupZoneAsDetector(this.pickupZone1, 0x00ff00, true);
            this.pickupZone1Helper = this.createZoneOutline(this.pickupZone1, 0x00ff00, true);
            this.pickupZone1BBox = this.createZoneBBox(this.pickupZone1);
            this.activePickupZone = this.pickupZone1;
        }
        
        if (dropoffZones.length > 0) {
            this.deliveryZone1 = dropoffZones[0];
            this.setupZoneAsDetector(this.deliveryZone1, 0x0088ff, false);
            this.deliveryZone1Helper = this.createZoneOutline(this.deliveryZone1, 0x0088ff, false);
            this.deliveryZone1BBox = this.createZoneBBox(this.deliveryZone1);
        }
        
        // Setup Zone 2 (second delivery - hidden initially)
        if (pickupZones.length > 1) {
            this.pickupZone2 = pickupZones[1];
            this.setupZoneAsDetector(this.pickupZone2, 0x00ff00, false);
            this.pickupZone2Helper = this.createZoneOutline(this.pickupZone2, 0x00ff00, false);
            this.pickupZone2BBox = this.createZoneBBox(this.pickupZone2);
        }
        
        if (dropoffZones.length > 1) {
            this.deliveryZone2 = dropoffZones[1];
            this.setupZoneAsDetector(this.deliveryZone2, 0x0088ff, false);
            this.deliveryZone2Helper = this.createZoneOutline(this.deliveryZone2, 0x0088ff, false);
            this.deliveryZone2BBox = this.createZoneBBox(this.deliveryZone2);
        }
        
        // Setup refuel zone (Gas Fill Zone)
        if (refuelZones && refuelZones.length > 0) {
            this.gasStation = refuelZones[0];
            this.setupZoneAsDetector(this.gasStation, 0xffaa00, false); // Orange - hidden initially
            this.gasStationHelper = this.createZoneOutline(this.gasStation, 0xffaa00, false); // Hidden until after first delivery
            this.gasStationBBox = this.createZoneBBox(this.gasStation);
            
            const bbox = new THREE.Box3().setFromObject(this.gasStation);
            const center = bbox.getCenter(new THREE.Vector3());
            console.log(`✅ Refuel zone configured: ${this.gasStation.name} at (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})`);
        } else {
            console.warn('⚠ No refuel zone found in model!');
        }
        
        // Start the game timer
        this.gameStartTime = performance.now();
        
        console.log('✅ Multi-stage delivery system initialized!');
        console.log('   Stage 1: Pickup Zone 1 → Delivery Zone 1');
        console.log('   Stage 2: Refuel at Gas Station');
        console.log('   Stage 3: Pickup Zone 2 → Delivery Zone 2 (Night)');
    }
    
    /**
     * Create bounding box for a zone with vertical expansion
     * @param {THREE.Object3D} zone - Zone object
     * @returns {THREE.Box3} Bounding box
     */
    createZoneBBox(zone) {
        const bbox = new THREE.Box3().setFromObject(zone);
        bbox.min.y -= 10;
        bbox.max.y += 10;
        return bbox;
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
     * @returns {THREE.Mesh} The outline mesh
     */
    createZoneOutline(zone, color, visible) {
        // Calculate bounding box for the zone
        const bbox = new THREE.Box3().setFromObject(zone);
        const size = bbox.getSize(new THREE.Vector3());
        const center = bbox.getCenter(new THREE.Vector3());
        
        // Only expand vertically to show the actual detection area
        const expandedSize = new THREE.Vector3(
            size.x,      // No horizontal expansion
            size.y + 20, // Expand Y by 20 (10 on each side) - taller trigger
            size.z       // No horizontal expansion
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
        
        console.log(`✓ Created outline for zone "${zone.name}"`);
        
        return outline;
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
     * Set lighting system reference
     * @param {Object} lightingSystem - Lighting system instance
     */
    setLightingSystem(lightingSystem) {
        this.lightingSystem = lightingSystem;
    }
    
    /**
     * Update delivery system logic with multi-stage game flow
     * @param {number} deltaTime - Time since last frame (seconds)
     * @param {THREE.Object3D} carWrapper - Car object with position
     */
    update(deltaTime, carWrapper) {
        if (!carWrapper || this.gameState === 'completed') return;
        
        const carPos = carWrapper.position;
        
        // Check if car is in pickup zone (use bounding box for imported zones)
        let inPickupZone = false;
        let inDeliveryZone = false;
        
        // Determine which zones to check based on game state
        if (this.gameState === 'first_pickup' || this.gameState === 'first_delivery') {
            this.activePickupZone = this.pickupZone1;
            this.activeDeliveryZone = this.deliveryZone1;
        } else if (this.gameState === 'second_pickup' || this.gameState === 'second_delivery') {
            this.activePickupZone = this.pickupZone2;
            this.activeDeliveryZone = this.deliveryZone2;
        }
        
        // Check for refueling
        let inRefuelZone = false;
        if (this.gameState === 'refuel' && this.gasStation) {
            inRefuelZone = this.isCarInZone(carWrapper, this.gasStation);
        }
        
        if (this.usingImportedZones && this.activePickupZone) {
            inPickupZone = this.isCarInZone(carWrapper, this.activePickupZone);
        } else {
            // Fallback to distance-based detection for created zones
            const distToPickup = Math.sqrt(
                (carPos.x - this.pickupLocation.x) ** 2 + 
                (carPos.z - this.pickupLocation.z) ** 2
            );
            inPickupZone = distToPickup < this.deliveryRadius;
        }
        
        if (this.usingImportedZones && this.activeDeliveryZone) {
            inDeliveryZone = this.isCarInZone(carWrapper, this.activeDeliveryZone);
        } else {
            // Fallback to distance-based detection for created zones
            const distToDelivery = Math.sqrt(
                (carPos.x - this.deliveryLocation.x) ** 2 + 
                (carPos.z - this.deliveryLocation.z) ** 2
            );
            inDeliveryZone = distToDelivery < this.deliveryRadius;
        }
        
        // Log trigger activation/deactivation
        if (inPickupZone && !this.lastTriggerState.pickup) {
            console.log(`🟢 PICKUP TRIGGER ACTIVATED at car position: (${carPos.x.toFixed(2)}, ${carPos.y.toFixed(2)}, ${carPos.z.toFixed(2)})`);
            this.lastTriggerState.pickup = true;
        } else if (!inPickupZone && this.lastTriggerState.pickup) {
            console.log(`⚪ PICKUP TRIGGER DEACTIVATED at car position: (${carPos.x.toFixed(2)}, ${carPos.y.toFixed(2)}, ${carPos.z.toFixed(2)})`);
            this.lastTriggerState.pickup = false;
        }
        
        if (inDeliveryZone && !this.lastTriggerState.delivery) {
            console.log(`🔵 DELIVERY TRIGGER ACTIVATED at car position: (${carPos.x.toFixed(2)}, ${carPos.y.toFixed(2)}, ${carPos.z.toFixed(2)})`);
            this.lastTriggerState.delivery = true;
        } else if (!inDeliveryZone && this.lastTriggerState.delivery) {
            console.log(`⚪ DELIVERY TRIGGER DEACTIVATED at car position: (${carPos.x.toFixed(2)}, ${carPos.y.toFixed(2)}, ${carPos.z.toFixed(2)})`);
            this.lastTriggerState.delivery = false;
        }
        
        // Update outline colors - now handled by updateZoneVisuals method
        
        // State machine
        if (this.deliveryState === 'idle' || this.deliveryState === 'picking_up') {
            if (inPickupZone) {
                this.deliveryState = 'picking_up';
                this.pickupTimer += deltaTime;
                
                // Pulsing effect on zone
                if (this.usingImportedZones && this.activePickupZone) {
                    this.updateZoneOpacity(this.activePickupZone, 0.3 + Math.sin(Date.now() * 0.01) * 0.2);
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
                    this.pickupTimer = 0;
                    
                    // Hide pickup zone and show delivery zone
                    if (this.activePickupZone) this.activePickupZone.visible = false;
                    if (this.activeDeliveryZone) this.activeDeliveryZone.visible = true;
                    
                    if (this.gameState === 'first_pickup') {
                        this.gameState = 'first_delivery';
                        if (this.pickupZone1Helper) this.pickupZone1Helper.visible = false;
                        if (this.deliveryZone1Helper) this.deliveryZone1Helper.visible = true;
                    } else if (this.gameState === 'second_pickup') {
                        this.gameState = 'second_delivery';
                        if (this.pickupZone2Helper) this.pickupZone2Helper.visible = false;
                        if (this.deliveryZone2Helper) this.deliveryZone2Helper.visible = true;
                    }
                    
                    if (this.uiSystem) {
                        this.uiSystem.updateDeliveryStatus('Go to blue zone!', '#00ff00');
                    }
                }
            } else if (this.deliveryState === 'picking_up') {
                // Left the zone
                this.deliveryState = 'idle';
                this.pickupTimer = 0;
                if (this.usingImportedZones && this.activePickupZone) {
                    this.updateZoneOpacity(this.activePickupZone, 0.5);
                }
                if (this.uiSystem) {
                    this.uiSystem.updateDeliveryStatus('Go to green zone', '#64b5f6');
                }
            }
        } else if (this.deliveryState === 'has_package') {
            if (inDeliveryZone) {
                this.deliveryState = 'delivered';
                if (this.usingImportedZones && this.activeDeliveryZone) {
                    this.updateZoneColor(this.activeDeliveryZone, 0xffff00);
                }
                if (this.uiSystem) {
                    this.uiSystem.updateDeliveryStatus('Delivered! 🎉', '#00ff00');
                }
                
                // Transition to next game state after 2 seconds
                setTimeout(() => {
                    if (this.gameState === 'first_delivery') {
                        // First delivery complete - go to refuel
                        this.transitionToRefuel();
                    } else if (this.gameState === 'second_delivery') {
                        // Second delivery complete - game finished!
                        this.completeGame();
                    }
                }, 2000);
            }
        }
        
        // Refuel state machine
        if (this.gameState === 'refuel') {
            if (inRefuelZone) {
                this.deliveryState = 'refueling';
                this.refuelTimer += deltaTime;
                
                const remaining = Math.max(0, this.refuelRequired - this.refuelTimer);
                if (this.uiSystem) {
                    this.uiSystem.updateDeliveryStatus(
                        `Refueling... ${remaining.toFixed(1)}s`, 
                        '#ffaa00'
                    );
                }
                
                if (this.refuelTimer >= this.refuelRequired) {
                    // Refuel complete - transition to night and second pickup
                    this.transitionToNight();
                }
            }
        }
        
        // Update zone visuals
        this.updateZoneVisuals(inPickupZone, inDeliveryZone, inRefuelZone);
    }
    
    /**
     * Transition to refuel stage
     */
    transitionToRefuel() {
        console.log('🚗 First delivery complete! Go refuel at the gas station');
        this.gameState = 'refuel';
        this.deliveryState = 'idle';
        this.pickupTimer = 0;
        
        // Hide delivery zone 1
        if (this.deliveryZone1) this.deliveryZone1.visible = false;
        if (this.deliveryZone1Helper) this.deliveryZone1Helper.visible = false;
        
        // Show gas station
        if (this.gasStation) this.gasStation.visible = true;
        if (this.gasStationHelper) this.gasStationHelper.visible = true;
        
        if (this.uiSystem) {
            this.uiSystem.updateDeliveryStatus('Go to Gas Station (Orange)', '#ffaa00');
        }
    }
    
    /**
     * Transition to night and second pickup
     */
    transitionToNight() {
        console.log('🌙 Refueled! Day turns to night...');
        this.gameState = 'second_pickup';
        this.deliveryState = 'idle';
        this.refuelTimer = 0;
        
        // Hide gas station
        if (this.gasStation) this.gasStation.visible = false;
        if (this.gasStationHelper) this.gasStationHelper.visible = false;
        
        // Show pickup zone 2
        if (this.pickupZone2) this.pickupZone2.visible = true;
        if (this.pickupZone2Helper) this.pickupZone2Helper.visible = true;
        
        // Trigger day/night change
        if (this.lightingSystem) {
            this.lightingSystem.toggleDayNight();
        }
        
        if (this.uiSystem) {
            this.uiSystem.updateDeliveryStatus('Night delivery! Go to green zone', '#00ff00');
        }
    }
    
    /**
     * Complete the game
     */
    completeGame() {
        this.gameState = 'completed';
        this.gameEndTime = performance.now();
        this.completionTime = (this.gameEndTime - this.gameStartTime) / 1000; // Convert to seconds
        
        const minutes = Math.floor(this.completionTime / 60);
        const seconds = (this.completionTime % 60).toFixed(2);
        const paddedSeconds = seconds.padStart(5, '0'); // Pad to 5 chars (XX.XX format)
        
        console.log(`🎉 GAME COMPLETED in ${minutes}:${paddedSeconds}!`);
        
        if (this.uiSystem) {
            this.uiSystem.updateDeliveryStatus(
                `COMPLETED! Time: ${minutes}:${paddedSeconds}`, 
                '#00ff00'
            );
        }
        
        // Hide all zones
        if (this.deliveryZone2) this.deliveryZone2.visible = false;
        if (this.deliveryZone2Helper) this.deliveryZone2Helper.visible = false;
    }
    
    /**
     * Update zone visual feedback
     */
    updateZoneVisuals(inPickup, inDelivery, inRefuel) {
        // Update active zones based on game state
        if (this.gameState === 'first_pickup' || this.gameState === 'second_pickup') {
            const helper = this.gameState === 'first_pickup' ? this.pickupZone1Helper : this.pickupZone2Helper;
            if (helper) {
                helper.material.color.setHex(inPickup ? 0xffff00 : 0x00ff00);
                helper.material.opacity = inPickup ? 1.0 : 0.6;
            }
        } else if (this.gameState === 'first_delivery' || this.gameState === 'second_delivery') {
            const helper = this.gameState === 'first_delivery' ? this.deliveryZone1Helper : this.deliveryZone2Helper;
            if (helper) {
                helper.material.color.setHex(inDelivery ? 0xffff00 : 0x0088ff);
                helper.material.opacity = inDelivery ? 1.0 : 0.6;
            }
        } else if (this.gameState === 'refuel') {
            if (this.gasStationHelper) {
                this.gasStationHelper.material.color.setHex(inRefuel ? 0xffff00 : 0xffaa00);
                this.gasStationHelper.material.opacity = inRefuel ? 1.0 : 0.6;
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
     * Get pickup location (based on current game state)
     * @returns {Object} {x, z} coordinates
     */
    getPickupLocation() {
        if (this.gameState === 'first_pickup' && this.pickupZone1) {
            return { x: this.pickupZone1.position.x, z: this.pickupZone1.position.z };
        } else if (this.gameState === 'second_pickup' && this.pickupZone2) {
            return { x: this.pickupZone2.position.x, z: this.pickupZone2.position.z };
        } else if (this.gameState === 'refuel' && this.gasStation) {
            return { x: this.gasStation.position.x, z: this.gasStation.position.z };
        }
        return this.pickupLocation;
    }
    
    /**
     * Get delivery location (based on current game state)
     * @returns {Object} {x, z} coordinates
     */
    getDeliveryLocation() {
        if (this.gameState === 'first_delivery' && this.deliveryZone1) {
            return { x: this.deliveryZone1.position.x, z: this.deliveryZone1.position.z };
        } else if (this.gameState === 'second_delivery' && this.deliveryZone2) {
            return { x: this.deliveryZone2.position.x, z: this.deliveryZone2.position.z };
        } else if (this.gameState === 'refuel' && this.gasStation) {
            return { x: this.gasStation.position.x, z: this.gasStation.position.z };
        }
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
     * Check if car is inside a zone - entire car must be inside
     * @param {THREE.Object3D} carWrapper - Car object
     * @param {THREE.Object3D} zone - Zone object
     * @returns {boolean} True if entire car is in zone
     */
    isCarInZone(carWrapper, zone) {
        // Get car's bounding box
        const carBBox = new THREE.Box3().setFromObject(carWrapper);
        
        // Get zone bounding box
        const zoneBBox = new THREE.Box3().setFromObject(zone);
        
        // Only expand vertically to be more forgiving with height
        zoneBBox.min.y -= 10;
        zoneBBox.max.y += 10;
        
        // Check if the ENTIRE car bounding box is contained within the zone
        // This ensures all parts of the car are inside before triggering
        const isEntirelyInZone = carBBox.min.x >= zoneBBox.min.x && carBBox.max.x <= zoneBBox.max.x &&
                                 carBBox.min.z >= zoneBBox.min.z && carBBox.max.z <= zoneBBox.max.z &&
                                 carBBox.min.y >= zoneBBox.min.y && carBBox.max.y <= zoneBBox.max.y;
        
        return isEntirelyInZone;
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
        if (this.pickupZone1Helper) {
            this.scene.remove(this.pickupZone1Helper);
            this.pickupZone1Helper.geometry.dispose();
            this.pickupZone1Helper.material.dispose();
            this.pickupZone1Helper = null;
        }
        if (this.deliveryZone1Helper) {
            this.scene.remove(this.deliveryZone1Helper);
            this.deliveryZone1Helper.geometry.dispose();
            this.deliveryZone1Helper.material.dispose();
            this.deliveryZone1Helper = null;
        }
        if (this.pickupZone2Helper) {
            this.scene.remove(this.pickupZone2Helper);
            this.pickupZone2Helper.geometry.dispose();
            this.pickupZone2Helper.material.dispose();
            this.pickupZone2Helper = null;
        }
        if (this.deliveryZone2Helper) {
            this.scene.remove(this.deliveryZone2Helper);
            this.deliveryZone2Helper.geometry.dispose();
            this.deliveryZone2Helper.material.dispose();
            this.deliveryZone2Helper = null;
        }
        if (this.gasStationHelper) {
            this.scene.remove(this.gasStationHelper);
            this.gasStationHelper.geometry.dispose();
            this.gasStationHelper.material.dispose();
            this.gasStationHelper = null;
        }
        
        // Only clean up created zones, not imported ones
        if (!this.usingImportedZones) {
            // Clean up any fallback zones created
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
            this.pickupZone1 = null;
            this.deliveryZone1 = null;
            this.pickupZone2 = null;
            this.deliveryZone2 = null;
            this.gasStation = null;
            this.activePickupZone = null;
            this.activeDeliveryZone = null;
        }
    }
}

