// Lighting System - Handles scene lighting (ambient, directional, etc.)
import * as THREE from 'three';

/**
 * LightingSystem - Manages all lighting in the scene
 */
export class LightingSystem {
    constructor(scene) {
        this.scene = scene;
        this.ambientLight = null;
        this.directionalLight = null;
        this.ceilingLight = null;
        this.lightBulb = null;
    }

    /**
     * Initializes the lighting for the scene
     * Sets up ambient and directional lights with shadows
     */
    init() {
        try {
            // Add ambient light for soft, even illumination (reduced so shadows are more visible)
            this.ambientLight = new THREE.AmbientLight(0xffffff, 0.2); // White light, 20% intensity (reduced for better shadow visibility)
            this.ambientLight.name = 'ambientLight';
            this.scene.add(this.ambientLight);

            // Add directional light to simulate sunlight (reduced so ceiling light is more prominent)
            this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.3); // White light, 30% intensity (reduced)
            // Position light above and to the side
            this.directionalLight.position.set(10, 20, 10);
            this.directionalLight.name = 'directionalLight';
            
            // Enable shadows for directional light
            this.directionalLight.castShadow = true;
            
            // Configure shadow properties for better quality
            this.directionalLight.shadow.mapSize.width = 1024; // Shadow map resolution
            this.directionalLight.shadow.mapSize.height = 1024;
            
            // Set shadow camera bounds
            this.directionalLight.shadow.camera.left = -20;
            this.directionalLight.shadow.camera.right = 20;
            this.directionalLight.shadow.camera.top = 20;
            this.directionalLight.shadow.camera.bottom = -20;
            
            // Set shadow camera near and far planes
            this.directionalLight.shadow.camera.near = 0.1;
            this.directionalLight.shadow.camera.far = 50;
            
            // Add directional light to scene
            this.scene.add(this.directionalLight);
        } catch (error) {
            console.error('Error creating lighting:', error);
        }
    }

    /**
     * Gets the ambient light
     * @returns {THREE.AmbientLight|null}
     */
    getAmbientLight() {
        return this.ambientLight;
    }

    /**
     * Gets the directional light
     * @returns {THREE.DirectionalLight|null}
     */
    getDirectionalLight() {
        return this.directionalLight;
    }

    /**
     * Sets ambient light intensity
     * @param {number} intensity - Light intensity (0-1)
     */
    setAmbientIntensity(intensity) {
        if (this.ambientLight) {
            this.ambientLight.intensity = intensity;
        }
    }

    /**
     * Sets directional light intensity
     * @param {number} intensity - Light intensity (0-1)
     */
    setDirectionalIntensity(intensity) {
        if (this.directionalLight) {
            this.directionalLight.intensity = intensity;
        }
    }

    /**
     * Sets directional light position
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} z - Z position
     */
    setDirectionalPosition(x, y, z) {
        if (this.directionalLight) {
            this.directionalLight.position.set(x, y, z);
        }
    }

    /**
     * Finds and attaches lights to objects in the scene (Ceiling_Light and Light_Bulb)
     * Should be called after the basement model is loaded
     */
    setupModelLights() {
        // Find Ceiling_Light and Light_Bulb objects in the scene
        this.scene.traverse((object) => {
            if (object.name) {
                // Ceiling Light - General room lighting with shadows
                if (object.name === 'Ceiling_Light' || object.name === 'ceiling_light' || object.name.toLowerCase().includes('ceiling_light')) {
                    // Get world position of the light object
                    const worldPosition = new THREE.Vector3();
                    object.getWorldPosition(worldPosition);
                    
                    // Position light slightly below the light object so it's not blocked by the fixture
                    worldPosition.y -= 0.5; // Move down 0.5 units
                    
                    // Create point light for general room illumination (main light source)
                    this.ceilingLight = new THREE.PointLight(0xffffff, 20.0, 30); // White, high intensity (4.0), 30 unit range
                    this.ceilingLight.position.copy(worldPosition);
                    this.ceilingLight.castShadow = true;
                    this.ceilingLight.name = 'ceilingLightPoint';
                    
                    // Configure shadow properties for high-quality shadows from all objects
                    this.ceilingLight.shadow.mapSize.width = 2048; // High resolution for sharp shadows
                    this.ceilingLight.shadow.mapSize.height = 2048;
                    this.ceilingLight.shadow.camera.near = 0.1;
                    this.ceilingLight.shadow.camera.far = 30;
                    this.ceilingLight.shadow.bias = -0.0001;
                    this.ceilingLight.shadow.normalBias = 0.02; // Help prevent shadow acne
                    this.ceilingLight.shadow.radius = 4; // Soft shadow radius for smoother edges
                    
                    // Add light to scene
                    this.scene.add(this.ceilingLight);
                }
                
                // Light Bulb - Table lamp pointing downward
                if (object.name === 'Light_Bulb' || object.name === 'light_bulb' || object.name.toLowerCase().includes('light_bulb')) {
                    // Get world position and direction of the light object
                    const worldPosition = new THREE.Vector3();
                    const worldDirection = new THREE.Vector3();
                    object.getWorldPosition(worldPosition);
                    
                    // Get the forward direction of the object (usually -Y for downward pointing)
                    object.getWorldDirection(worldDirection);
                    
                    // Create spotlight pointing downward for table emphasis
                    this.lightBulb = new THREE.SpotLight(0xffffff, 2.0, 15, Math.PI / 6, 0.3, 2); // White, bright, narrow cone
                    this.lightBulb.position.copy(worldPosition);
                    this.lightBulb.target.position.copy(worldPosition);
                    this.lightBulb.target.position.y -= 2; // Point downward by default
                    this.lightBulb.castShadow = true;
                    this.lightBulb.name = 'lightBulbSpot';
                    
                    // Configure shadow properties for better shadow quality
                    this.lightBulb.shadow.mapSize.width = 2048; // Higher resolution for sharper shadows
                    this.lightBulb.shadow.mapSize.height = 2048;
                    this.lightBulb.shadow.camera.near = 0.1;
                    this.lightBulb.shadow.camera.far = 15;
                    this.lightBulb.shadow.bias = -0.0001;
                    this.lightBulb.shadow.normalBias = 0.02; // Help prevent shadow acne
                    
                    // SpotLight automatically configures its shadow camera FOV based on the light angle
                    // The shadow camera is a PerspectiveCamera that matches the spotlight cone
                    
                    // Add light and target to scene
                    this.scene.add(this.lightBulb);
                    this.scene.add(this.lightBulb.target);
                }
            }
        });
    }

    /**
     * Gets the ceiling light
     * @returns {THREE.PointLight|null}
     */
    getCeilingLight() {
        return this.ceilingLight;
    }

    /**
     * Gets the light bulb
     * @returns {THREE.SpotLight|null}
     */
    getLightBulb() {
        return this.lightBulb;
    }

    /**
     * Cleanup lighting system
     */
    cleanup() {
        if (this.ambientLight) {
            this.scene.remove(this.ambientLight);
            this.ambientLight = null;
        }
        if (this.directionalLight) {
            this.scene.remove(this.directionalLight);
            this.directionalLight = null;
        }
        if (this.ceilingLight) {
            this.scene.remove(this.ceilingLight);
            this.ceilingLight = null;
        }
        if (this.lightBulb) {
            this.scene.remove(this.lightBulb);
            this.scene.remove(this.lightBulb.target);
            this.lightBulb = null;
        }
    }
}
