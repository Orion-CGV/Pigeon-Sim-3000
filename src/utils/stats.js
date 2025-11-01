// Stats.js utility module for performance monitoring
// Creates and manages the FPS display HUD

let stats = null;

/**
 * Creates the stats HUD if available (loaded via CDN in index.html)
 * Exposes stats globally for access from levels
 */
export function ensureStats() {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') return;

    // If already created, nothing to do
    if (stats) return;

    // If Stats is available, create it now
    if (window.Stats) {
        // Create new Stats object
        stats = new window.Stats();
        // Show FPS panel (0: FPS, 1: MS, 2: MB)
        stats.showPanel(0); 
        // Add stats DOM element to document body
        document.body.appendChild(stats.dom);
        // Position stats in top-left corner
        stats.dom.style.position = 'fixed';
        stats.dom.style.left = '0px';
        stats.dom.style.top = '0px';
        // Set high z-index to ensure it's on top
        stats.dom.style.zIndex = '2002';
        // Expose globally for access from levels
        window.__stats = stats; 
        return;
    }

    // Fallback: try to load from an alternate CDN once
    if (!window.__statsLoadAttempted) {
        // Mark that we've attempted to load stats
        window.__statsLoadAttempted = true;
        // Create script element for stats.js
        const script = document.createElement('script');
        // Set CDN URL for stats.js
        script.src = 'https://unpkg.com/stats.js@0.17.0/build/stats.min.js';
        // Load script asynchronously
        script.async = true;
        // On successful load, try to create stats again
        script.onload = () => {
            // Try again after script loads
            try { ensureStats(); } catch (e) { /* noop */ }
        };
        // Handle loading errors
        script.onerror = () => {
            console.warn('Failed to load stats.js from fallback CDN');
        };
        // Add script to document head
        document.head.appendChild(script);
    }
}

/**
 * Gets the current stats instance
 * @returns {Stats|null} The stats object or null if not initialized
 */
export function getStats() {
    return stats;
}
