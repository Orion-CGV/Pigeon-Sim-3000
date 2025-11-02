/**
 * Subtitle System - Manages subtitle display throughout the game
 * Allows easy subtitle display anywhere in the game
 */
export class SubtitleSystem {
    constructor() {
        this.subtitleElement = null;
        this.currentTimeout = null;
        this.isVisible = false;
    }

    /**
     * Initialize the subtitle system
     */
    init() {
        this.createSubtitleElement();
        console.log('✅ SubtitleSystem initialized');
    }

    /**
     * Create the subtitle UI element
     */
    createSubtitleElement() {
        if (this.subtitleElement && this.subtitleElement.parentNode) {
            return;
        }

        this.subtitleElement = document.createElement('div');
        this.subtitleElement.id = 'subtitle-display';
        this.subtitleElement.className = 'game-ui subtitle-display';
        this.subtitleElement.style.cssText = `
            position: fixed !important;
            bottom: 80px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            color: #fff !important;
            font-family: 'Jersey 10', sans-serif !important;
            font-size: 24px !important;
            font-weight: normal !important;
            text-align: center !important;
            background: rgba(0, 0, 0, 0.8) !important;
            padding: 16px 24px !important;
            border-radius: 8px !important;
            border: 2px solid rgba(255, 255, 255, 0.3) !important;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
            z-index: 9999 !important;
            max-width: 80% !important;
            min-width: 300px !important;
            opacity: 0 !important;
            transition: opacity 0.3s ease !important;
            pointer-events: none !important;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8) !important;
            word-wrap: break-word !important;
            display: block !important;
            visibility: visible !important;
        `;
        this.subtitleElement.textContent = '';
        document.body.appendChild(this.subtitleElement);
    }

    /**
     * Show a subtitle
     * @param {string} text - The subtitle text to display
     * @param {number} duration - Duration in seconds to show subtitle (0 = show until manually hidden)
     * @param {object} options - Optional styling options { fontSize, color, backgroundColor, etc. }
     */
    show(text, duration = 0, options = {}) {
        if (!this.subtitleElement) {
            console.log('📝 Creating subtitle element in show()...');
            this.createSubtitleElement();
        }
        
        // Ensure element exists in DOM (it might have been removed)
        if (!this.subtitleElement.parentNode) {
            console.log('📝 Subtitle element missing from DOM, re-adding...');
            document.body.appendChild(this.subtitleElement);
        }

        // Clear any existing timeout
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
            this.currentTimeout = null;
        }

        // Set text
        this.subtitleElement.textContent = text;

        // Apply custom styling if provided
        if (options.fontSize) {
            this.subtitleElement.style.fontSize = options.fontSize;
        }
        if (options.color) {
            this.subtitleElement.style.color = options.color;
        }
        if (options.backgroundColor) {
            this.subtitleElement.style.background = options.backgroundColor;
        }
        if (options.borderColor) {
            this.subtitleElement.style.borderColor = options.borderColor;
        }
        if (options.maxWidth) {
            this.subtitleElement.style.maxWidth = options.maxWidth;
        }

        // Show subtitle - use !important to override any conflicting styles
        this.subtitleElement.style.setProperty('display', 'block', 'important');
        this.subtitleElement.style.setProperty('opacity', '1', 'important');
        this.subtitleElement.style.setProperty('visibility', 'visible', 'important');
        this.subtitleElement.style.setProperty('z-index', '9999', 'important');
        this.isVisible = true;
        
        // Force a reflow to ensure the opacity change is visible
        this.subtitleElement.offsetHeight;
        
        // Double-check it's actually visible by checking computed styles
        const computedStyle = window.getComputedStyle(this.subtitleElement);
        console.log('📝 Subtitle computed styles:', {
            display: computedStyle.display,
            opacity: computedStyle.opacity,
            visibility: computedStyle.visibility,
            zIndex: computedStyle.zIndex,
            position: computedStyle.position,
            bottom: computedStyle.bottom
        });

        // Auto-hide after duration if specified
        if (duration > 0) {
            this.currentTimeout = setTimeout(() => {
                this.hide();
            }, duration * 1000);
        }

        console.log(`📝 Subtitle displayed: "${text}"${duration > 0 ? ` (${duration}s)` : ''}`, {
            element: this.subtitleElement,
            display: this.subtitleElement.style.display,
            opacity: this.subtitleElement.style.opacity,
            inDOM: !!this.subtitleElement.parentNode
        });
    }

    /**
     * Hide the subtitle
     */
    hide() {
        if (!this.subtitleElement) return;

        // Clear any existing timeout
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
            this.currentTimeout = null;
        }

        // Hide subtitle
        this.subtitleElement.style.opacity = '0';
        this.isVisible = false;

        // Remove from DOM after fade out
        setTimeout(() => {
            if (this.subtitleElement && !this.isVisible) {
                this.subtitleElement.style.display = 'none';
                this.subtitleElement.textContent = '';
            }
        }, 300);
    }

    /**
     * Check if subtitle is currently visible
     * @returns {boolean}
     */
    getIsVisible() {
        return this.isVisible;
    }

    /**
     * Cleanup the subtitle system
     */
    cleanup() {
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
            this.currentTimeout = null;
        }

        if (this.subtitleElement && this.subtitleElement.parentNode) {
            this.subtitleElement.parentNode.removeChild(this.subtitleElement);
            this.subtitleElement = null;
        }

        this.isVisible = false;
    }
}

