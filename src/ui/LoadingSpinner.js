/**
 * Loading Spinner - Manages loading spinner display during model loading
 */
export class LoadingSpinner {
    constructor() {
        this.spinnerElement = null;
        this.isVisible = false;
    }

    /**
     * Initialize the loading spinner
     */
    init() {
        this.createSpinnerElement();
        console.log('✅ LoadingSpinner initialized');
    }

    /**
     * Create the loading spinner UI element
     */
    createSpinnerElement() {
        if (this.spinnerElement && this.spinnerElement.parentNode) {
            return;
        }

        this.spinnerElement = document.createElement('div');
        this.spinnerElement.id = 'loading-spinner';
        this.spinnerElement.className = 'game-ui loading-spinner';
        this.spinnerElement.style.cssText = `
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            z-index: 10000 !important;
            display: none !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            pointer-events: none !important;
        `;
        
        // Create spinner circle
        const spinnerCircle = document.createElement('div');
        spinnerCircle.style.cssText = `
            width: 60px !important;
            height: 60px !important;
            border: 4px solid rgba(255, 255, 255, 0.2) !important;
            border-top: 4px solid #00ff00 !important;
            border-radius: 50% !important;
            animation: spin 1s linear infinite !important;
            margin-bottom: 20px !important;
        `;
        
        // Create loading text
        const loadingText = document.createElement('div');
        loadingText.textContent = 'Loading...';
        loadingText.style.cssText = `
            color: #fff !important;
            font-family: 'Jersey 10', sans-serif !important;
            font-size: 24px !important;
            font-weight: normal !important;
            text-align: center !important;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8) !important;
        `;
        
        this.spinnerElement.appendChild(spinnerCircle);
        this.spinnerElement.appendChild(loadingText);
        document.body.appendChild(this.spinnerElement);
        
        // Add spin animation if not already added
        if (!document.getElementById('spinner-keyframes')) {
            const style = document.createElement('style');
            style.id = 'spinner-keyframes';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Show the loading spinner
     */
    show() {
        if (!this.spinnerElement) {
            this.createSpinnerElement();
        }
        
        // Ensure element exists in DOM
        if (!this.spinnerElement.parentNode) {
            document.body.appendChild(this.spinnerElement);
        }
        
        this.spinnerElement.style.setProperty('display', 'flex', 'important');
        this.spinnerElement.style.setProperty('opacity', '1', 'important');
        this.isVisible = true;
        console.log('📦 Loading spinner shown');
    }

    /**
     * Hide the loading spinner
     */
    hide() {
        if (!this.spinnerElement) return;
        
        this.spinnerElement.style.setProperty('opacity', '0', 'important');
        this.isVisible = false;
        
        // Remove from DOM after fade out
        setTimeout(() => {
            if (this.spinnerElement && !this.isVisible) {
                this.spinnerElement.style.setProperty('display', 'none', 'important');
            }
        }, 300);
        console.log('📦 Loading spinner hidden');
    }

    /**
     * Check if spinner is currently visible
     * @returns {boolean}
     */
    getIsVisible() {
        return this.isVisible;
    }

    /**
     * Cleanup the loading spinner
     */
    cleanup() {
        if (this.spinnerElement && this.spinnerElement.parentNode) {
            this.spinnerElement.parentNode.removeChild(this.spinnerElement);
            this.spinnerElement = null;
        }
        this.isVisible = false;
    }
}

