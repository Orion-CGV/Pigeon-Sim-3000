# 🐛 Bug Report: Double FPS Issue

## Issue Description

**Problem**: When entering Level 2 from Story Mode (3D hub world), the FPS doubled from ~60 to ~120, causing performance issues and incorrect frame timing.

**Date Fixed**: October 29, 2025

**Severity**: High (affected core game loop)

---

## Root Cause

The `loadLevel()` function was being called **from within the `animate()` function** via the `handleInteraction()` callback chain:

```
animate() 
  → handleInteraction() 
    → loadLevel() 
      → setAnimationLoop(null)  // Stop old loop
      → setAnimationLoop(animate)  // Start new loop
```

This created a race condition where:
1. Story Mode's animation frame was still executing
2. User pressed E key to interact with arcade machine
3. `handleInteraction()` was called (still in the same frame)
4. `loadLevel()` was called (still in the same frame)
5. Old animation loop stopped, new animation loop started
6. **Result**: The old frame completed AND the new frame started = **2 animation loops running simultaneously**

This caused the renderer to call `animate()` twice per frame: once from the old Story Mode loop and once from the new Level 2 loop.

---

## Investigation Process

### Debug Tools Added

1. **Frame Counter**: Tracked calls to `animate()` per second
   - Expected: ~60 calls/second
   - Observed: ~120 calls/second

2. **Duplicate Frame Detection**: Measured time between `animate()` calls
   - If < 8ms between calls → likely duplicate call
   - Detected calls only 1ms apart

3. **Stack Trace Logging**: Added `console.trace()` to track where animation loops were started/stopped

### Key Stack Trace

```
animate → handleInteraction → loadLevel → setAnimationLoop
```

This revealed that `loadLevel()` was being called from within the animation frame, not from a user interaction event handler.

---

## Solution

### Primary Fix: Deferred Level Loading

**File**: `main.js`  
**Function**: `handleInteraction()`

Changed from immediate execution:
```javascript
// BEFORE: Called immediately (inside current frame)
loadLevel(level);
```

To deferred execution:
```javascript
// AFTER: Deferred to next event loop tick (after current frame)
setTimeout(() => {
    loadLevel(level);
}, 0);
```

**Why this works**: `setTimeout(..., 0)` defers the function call until after the current call stack completes. This ensures:
- The current animation frame finishes completely
- The old animation loop is fully stopped
- Only then does the new animation loop start
- No overlap between the two loops

### Secondary Fix: Double-Stop Safety

**File**: `main.js`  
**Function**: `loadLevel()`

Added an extra `setAnimationLoop(null)` call to ensure the loop is fully stopped:

```javascript
cleanupCurrentLevel();  // Stops loop once

// Double-check animation loop is stopped
if (renderer) {
    renderer.setAnimationLoop(null);
    console.log('🛑 Double-checking animation loop is stopped');
}
```

---

## Testing & Verification

### Before Fix
- FPS: ~120 (doubled)
- Console warnings: `⚠️ WARNING: animate() called 120 times in last second!`
- Duplicate frame detection: `🚨 DUPLICATE CALL DETECTED! Only 1.00ms since last frame!`

### After Fix
- FPS: ~60 (normal)
- No console warnings
- No duplicate frame calls
- Smooth transition from Story Mode → Level 2

---

## Key Lessons Learned

1. **Never start animation loops from within animation frames**
   - Always defer loop management to the next event loop tick
   - Use `setTimeout(..., 0)` or similar deferral mechanisms

2. **Animation loop lifecycle must be managed carefully**
   - Ensure old loops are fully stopped before starting new ones
   - Be aware of async timing issues

3. **Comprehensive debugging is essential**
   - Frame counting helped identify the issue
   - Stack traces revealed the exact call chain
   - Timing measurements confirmed the duplicate calls

4. **Event loop understanding is critical**
   - Animation frames run synchronously
   - Deferring with `setTimeout` breaks out of the current call stack
   - This prevents overlap between old and new loops

---

## Related Code Locations

- **Fix Location**: `main.js` → `handleInteraction()` (line ~553)
- **Safety Check**: `main.js` → `loadLevel()` (line ~268)
- **Animation Loop**: `main.js` → `animate()` (line ~786)
- **Level Entry Point**: `level2.js` → `initLevel()` (line ~56)

---

## Prevention

To prevent similar issues in the future:

1. **Code Review Checklist**:
   - [ ] Are animation loops started/stopped from within animation frames?
   - [ ] Are there any synchronous calls that could overlap loop management?
   - [ ] Is there proper cleanup between scene transitions?

2. **Best Practices**:
   - Always defer level loading and scene transitions
   - Use `setTimeout(..., 0)` for actions that change animation loops
   - Add frame counting during development to catch duplicate loops early

3. **Monitoring**:
   - Keep debug frame counter in development builds
   - Watch for FPS anomalies (>65 or <55 when expecting 60)
   - Check browser dev tools performance tab for irregular frame timing

---

## Status

✅ **FIXED** - Verified working in Story Mode → Level 2 transitions

**Fixed By**: AI Assistant (Claude)  
**Verified By**: User Testing  
**Date**: October 29, 2025

