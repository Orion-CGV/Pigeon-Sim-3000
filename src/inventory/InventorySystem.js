// Inventory System - Manages collected items
import * as THREE from 'three';

/**
 * InventorySystem - Manages player inventory for collected items
 */
export class InventorySystem {
    constructor() {
        this.items = [];
        this.uiElement = null;
        this.isVisible = false;
        this.boundKeyHandler = null;
    }

    /**
     * Initialize the inventory system and create UI
     */
    init() {
        this.createUI();
        this.setupKeyListener();
        // Update UI to show any preserved joysticks
        if (this.items.length > 0) {
            this.updateUI();
        }
    }
    
    /**
     * Setup Tab key listener for toggling inventory
     */
    setupKeyListener() {
        if (this.boundKeyHandler) return;
        
        this.boundKeyHandler = (e) => {
            if (e.key === 'Tab' || e.keyCode === 9) {
                e.preventDefault(); // Prevent default browser Tab behavior
                this.toggle();
            }
        };
        
        document.addEventListener('keydown', this.boundKeyHandler);
    }

    /**
     * Create inventory UI element
     */
    createUI() {
        if (this.uiElement && this.uiElement.parentNode) {
            return;
        }

        this.uiElement = document.createElement("div");
        this.uiElement.className = "game-ui inventory-ui";
        this.uiElement.style.cssText = `
            position: absolute;
            top: 20px;
            left: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            font-family: 'Jersey 10', sans-serif;
            font-weight: normal;
            padding: 20px;
            border-radius: 8px;
            min-width: 280px;
            z-index: 100;
            box-shadow: 0 0 15px rgba(0, 255, 0, 0.5);
            border: 1px solid #0f0;
            display: none;
        `;

        const title = document.createElement("h3");
        title.textContent = "Inventory";
        title.style.cssText = `
            color: #00ff00;
            margin: 0 0 10px 0;
            font-size: 22px;
            font-weight: normal;
            text-align: center;
            border-bottom: 1px solid rgba(0, 255, 0, 0.3);
            padding-bottom: 8px;
        `;
        this.uiElement.appendChild(title);

        this.itemsList = document.createElement("div");
        this.itemsList.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        this.uiElement.appendChild(this.itemsList);

        document.body.appendChild(this.uiElement);
    }

    /**
     * Add an item to inventory
     * @param {string} itemName - Name of the item
     * @param {object} itemData - Optional item metadata
     */
    addItem(itemName, itemData = {}) {
        // Check if item already exists
        const existingItem = this.items.find(item => item.name === itemName);
        if (existingItem) {
            existingItem.count = (existingItem.count || 1) + 1;
        } else {
            this.items.push({
                name: itemName,
                count: 1,
                ...itemData
            });
        }

        this.updateUI();
        console.log(`✅ Added ${itemName} to inventory`);
    }

    /**
     * Check if item is in inventory
     * @param {string} itemName - Name of the item to check
     * @returns {boolean}
     */
    hasItem(itemName) {
        return this.items.some(item => item.name === itemName);
    }

    /**
     * Get item from inventory
     * @param {string} itemName - Name of the item
     * @returns {object|null}
     */
    getItem(itemName) {
        return this.items.find(item => item.name === itemName) || null;
    }

    /**
     * Update the inventory UI
     */
    updateUI() {
        if (!this.itemsList) return;

        this.itemsList.innerHTML = '';

        if (this.items.length === 0) {
            const emptyMsg = document.createElement("div");
            emptyMsg.textContent = "Empty";
            emptyMsg.style.cssText = `
                color: #aaa;
                font-size: 18px;
                font-weight: normal;
                text-align: center;
                padding: 10px;
            `;
            this.itemsList.appendChild(emptyMsg);
            return;
        }

        this.items.forEach(item => {
            const itemElement = document.createElement("div");
            itemElement.style.cssText = `
                padding: 10px;
                border-radius: 5px;
                background: rgba(0, 255, 0, 0.1);
                border-left: 3px solid #00ff00;
                font-size: 18px;
                font-weight: normal;
                display: flex;
                align-items: center;
                gap: 10px;
            `;

            const countText = item.count > 1 ? ` x${item.count}` : '';
            
            // Check if item is a joystick and use the image
            let itemContent = '';
            if (item.name.toLowerCase().includes('joystick') && !item.name.toLowerCase().includes('head')) {
                itemContent = `
                    <img src="./assets/images/joysticks.png" 
                         alt="${item.name}" 
                         style="width: 50px; height: 50px; object-fit: contain; image-rendering: pixelated;">
                    <div style="font-weight: normal; flex: 1;">
                        ${item.name}${countText}
                    </div>
                `;
            } else {
                itemContent = `
                    <div style="font-weight: normal;">
                        ✅ ${item.name}${countText}
                    </div>
                `;
            }
            
            itemElement.innerHTML = itemContent;
            this.itemsList.appendChild(itemElement);
        });
    }

    /**
     * Show inventory UI
     */
    show() {
        if (this.uiElement) {
            this.uiElement.style.display = 'block';
            this.isVisible = true;
        }
    }

    /**
     * Hide inventory UI
     */
    hide() {
        if (this.uiElement) {
            this.uiElement.style.display = 'none';
            this.isVisible = false;
        }
    }

    /**
     * Toggle inventory visibility
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Get all items in inventory
     * @returns {array}
     */
    getAllItems() {
        return this.items;
    }

    /**
     * Clear inventory (but preserve joysticks)
     */
    clear() {
        // Keep joysticks in inventory permanently
        const joysticks = this.items.filter(item => 
            item.name.toLowerCase().includes('joystick') && 
            !item.name.toLowerCase().includes('head')
        );
        this.items = joysticks; // Keep only joysticks
        this.updateUI();
    }

    /**
     * Cleanup - remove UI elements (but preserve joysticks in memory)
     */
    cleanup() {
        // Preserve joysticks before cleanup
        const joysticks = this.items.filter(item => 
            item.name.toLowerCase().includes('joystick') && 
            !item.name.toLowerCase().includes('head')
        );
        
        // Remove key listener
        if (this.boundKeyHandler) {
            document.removeEventListener('keydown', this.boundKeyHandler);
            this.boundKeyHandler = null;
        }
        
        if (this.uiElement && this.uiElement.parentNode) {
            this.uiElement.parentNode.removeChild(this.uiElement);
            this.uiElement = null;
        }
        this.itemsList = null;
        
        // Keep joysticks in memory (will be restored when UI is recreated)
        this.items = joysticks;
    }
}

