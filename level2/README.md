# Level 2 - Speed Delivery Game Integration

## ✅ Setup Complete!

The Speed Delivery Game has been integrated as Level 2 of Timmy's Lost Treasure!

## 📁 Required File Structure

Your `level2/` folder should contain:

```
level2/
├── Car.glb                          (7.9MB - 3D car model)
├── style.css                        (6.8KB - Game UI styles)
├── README.md                        (This file)
└── src/
    ├── camera/
    │   └── CameraSystem.js          (334 lines)
    ├── delivery/
    │   └── DeliverySystem.js        (272 lines)
    ├── effects/
    │   └── EffectsSystem.js         (245 lines)
    ├── environment/
    │   └── EnvironmentSystem.js     (556 lines)
    ├── input/
    │   └── InputSystem.js           (417 lines)
    ├── lighting/
    │   └── LightingSystem.js        (412 lines)
    ├── physics/
    │   └── CarPhysicsSystem.js      (405 lines)
    └── ui/
        └── UISystem.js              (478 lines)
```

## 🎮 Game Features

Level 2 now includes:
- **Realistic car physics** with CANNON.js
- **Modular systems** (8 separate modules)
- **Package delivery gameplay** (pickup from yellow zone, deliver to purple zone)
- **Boost mechanic** (Space bar)
- **Dynamic day/night cycle** (H key to toggle)
- **Camera modes** (Q key to cycle)
- **Headlights** (L key at night)
- **Collision effects** with particles and screen shake
- **Professional UI** with HUD, minimap, speedometer

## 🔧 Integration Details

### Files Modified:
1. **`level2.js`** - New integration wrapper (488 lines)
   - Imports all 8 modular systems
   - Manages game lifecycle (init, update, cleanup)
   - Handles ESC for pause menu integration
   - Passes existing camera from main.js to CameraSystem (ensures rendering consistency)
   
2. **`level2/src/camera/CameraSystem.js`** - Updated for integration
   - Modified to accept existing camera from main.js
   - Updates camera FOV (75° → 45°) and near/far clipping planes
   - Calls `updateProjectionMatrix()` to apply camera setting changes

3. **`index.html`** - Updated with:
   - CANNON.js physics library CDN
   - GSAP animation library CDN
   - Level 2 CSS stylesheet link
   - Updated Level 2 description
   - Updated instructions for Level 2

4. **`menu.js`** - No changes needed (already supports pause)

5. **`main.js`** - No changes needed (already supports all levels)

### Libraries Added:
```html
<!-- Added to index.html -->
<script src="https://cdn.jsdelivr.net/npm/cannon@0.6.2/build/cannon.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.2/dist/gsap.min.js"></script>
<link rel="stylesheet" href="level2/style.css">
```

## 🚀 How to Play

1. **Start the game** - Run your web server and open `index.html`
2. **Select Level 2** from the menu
3. **Drive the car**:
   - W/S: Accelerate/Brake
   - A/D: Steer
   - Space: Boost
   - Q: Cycle camera modes
   - H: Toggle day/night
   - L: Headlights (night only)
   - ESC: Pause menu

4. **Objective**: Pick up packages from the **yellow zone** and deliver them to the **purple zone**!

## 🎯 Key Bindings

| Key | Action |
|-----|--------|
| **W** | Accelerate forward |
| **S** | Brake/Reverse |
| **A** | Turn left |
| **D** | Turn right |
| **Space** | Boost (drains boost meter) |
| **Q** | Cycle camera views (behind car / top-down) |
| **H** | Toggle day/night cycle |
| **L** | Toggle headlights (night mode only) |
| **C** | Reset camera to default |
| **ESC** | Pause menu |

## 🔌 System Architecture

The game uses a modular architecture with 8 independent systems:

1. **EffectsSystem** - Particle effects and screen shake
2. **UISystem** - HUD, minimap, speedometer, FPS counter
3. **InputSystem** - Keyboard/mobile input handling
4. **DeliverySystem** - Package pickup/delivery zones
5. **LightingSystem** - Day/night cycle, shadows, headlights
6. **CameraSystem** - Multiple camera modes, collision detection
7. **CarPhysicsSystem** - Realistic car movement and boost
8. **EnvironmentSystem** - 3D model loading and physics

Each system is self-contained and communicates through clean interfaces!

## 🐛 Troubleshooting

**If you see "THREE is not defined" or "OrbitControls is not a constructor" error:**
- ✅ Fixed! `level2.js` exposes `window.THREE`, `window.OrbitControls`, and `window.GLTFLoader`
- The system modules have been updated to use global `OrbitControls` and `GLTFLoader`
- Works the same way as Level 3 - simple and clean!
- CANNON and GSAP are already global (loaded via `<script>` tags in index.html)

**If the car doesn't load:**
- Make sure `Car.glb` is in the `level2/` folder
- Check browser console for loading errors
- Verify the path in level2.js: `./level2/Car.glb`

**If styles are missing:**
- Verify `level2/style.css` exists
- Check that it's linked in `index.html`

**If physics don't work or car bounces:**
- ✅ Physics settings restored to match original Arcade game
- Gravity: -9.8 (lower than main.js levels)
- Friction: 0.05 (low friction for Trackmania-style drifting)
- LinearDamping: 0.01, AngularDamping: 0.05
- Ensure CANNON.js is loaded (check browser console)
- Verify the CDN link in `index.html`
- CANNON should be globally available (loaded via `<script>` tag)

**If camera is weird or turning feels bad/stuck:**
- ✅ Fixed! Removed duplicate keyboard handlers in level2.js that were interfering with InputSystem
- ✅ ESC handling moved to InputSystem (centralized input handling)
- ✅ CameraSystem now uses the camera from main.js instead of creating a new one
- ✅ Camera FOV is updated from 75° (main.js default) to 45° (Arcade game setting)
- ✅ Physics settings match original Arcade game for consistent behavior
- ✅ `updateProjectionMatrix()` is called to apply the camera changes
- This ensures proper synchronization between the game logic and rendering
- Press C to reset camera
- Press Q to cycle camera modes

**If boost doesn't work:**
- Ensure GSAP is loaded (check browser console)
- Verify the CDN link in `index.html`
- GSAP should be globally available (loaded via `<script>` tag)

## 📊 Stats

- **Total Lines of Code**: ~3,100 lines (modular systems)
- **Main Integration File**: 482 lines (level2.js)
- **Systems**: 8 independent modules
- **Dependencies**: Three.js, CANNON.js, GSAP
- **Asset Size**: ~8MB (Car.glb)

## ✨ What Makes This Special

Unlike the simple cube demo, Level 2 is a **fully-featured 3D racing game** with:
- Production-quality modular architecture
- Zero console.log spam (clean console!)
- Proper error handling (console.warn/error only)
- Professional UI with multiple HUD elements
- Realistic physics simulation
- Dynamic lighting and effects
- Complete game loop integration with pause system

This is the same codebase from the Arcade folder, but now properly integrated into the Timmy's Lost Treasure menu system!

---

**Enjoy racing! 🏎️💨**
