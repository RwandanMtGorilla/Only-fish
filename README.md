# Only-fish

A procedural multi-species flocking simulation built with **p5.js**. Powered by the Boids algorithm for group behavior, combined with Inverse Kinematics (IK) chains for smooth, organic creature animation. All animals are rendered programmatically on Canvas 2D -- no image assets needed.

[**中文文档**](doc/README_CN.md)

## Demo

Fish schooling with full boid behaviors (separation, alignment, cohesion), while turtles roam slowly with FABRIK-driven legs. Different species avoid each other through cross-group separation.

## Features

- **Boids flocking** -- same-group animals perform full separation + alignment + cohesion; different groups only repel each other
- **IK-based animation** -- procedural spine and limb animation using inverse kinematics chains
- **Multi-species architecture** -- register new animal types with just 3 files (renderer + behavior + config)
- **Interactive controls** -- grab animals, drop food, toggle wall boundaries, adjust behavior sliders
- **Fully procedural rendering** -- every animal is drawn with code, no sprites or images
- **Responsive UI** -- desktop and mobile control panels with real-time parameter tuning
- **Zero build step** -- pure ES Modules, no bundler or transpiler needed

## Animals

| Species | Count | IK Joints | Special Features |
|---------|-------|-----------|------------------|
| Fish | 18 | 12-segment spine | Pectoral/ventral/caudal fins, body shimmer |
| Turtle | 8 | 10-segment spine + 4x3 legs | FABRIK quadruped legs, rigid shell |

## Getting Started

### Prerequisites

A local HTTP server is required because the project uses ES Modules (`type="module"`). The start scripts handle this automatically.

### Run

**Windows:**
```bash
start.bat
```

**Linux / macOS:**
```bash
chmod +x start.sh
./start.sh
```

The script starts a local server on port **8080** and opens your browser. It uses `python -m http.server` by default, falling back to a PowerShell-based server on Windows if Python is unavailable.

## Controls

| Control | Type | Default | Scope |
|---------|------|---------|-------|
| Animal Select | Dropdown | First registered | Switch which species' sliders to edit |
| Walls | Toggle | Off | Global |
| Collisions | Toggle | On | Global |
| Seek Mouse | Toggle | Off | Global |
| Feed | Toggle | On | Global |
| Catch Fish | Toggle | On | Global |
| Introversion | Slider (0-20) | 10 | Per species |
| Speed | Slider (0-20) | 12 | Per species |
| Racism | Slider (0-20) | 10 | Per species |
| Diversity | Slider (1-8) | 3 | Per species |

### Mouse Interactions

- **Click on empty space** (Feed mode on) -- drop food
- **Click & hold on animal** (Catch mode on) -- grab and drag, with a thrashing escape animation
- **Mouse tracking** (Seek Mouse on) -- animals gently follow the cursor

## Architecture

```
src/
  main.js                        -- Entry: register animals + p5.js lifecycle
  registry/AnimalRegistry.js     -- Manages groups, creation, update, render
  ui/UIController.js             -- Checkbox/slider/select two-way binding
  boids/BoidPhysics.js           -- Shared physics mixin (seek, collision, edges)
  core/Chain.js                  -- IK chain (inverse kinematics spine)
  entities/FoodItem.js           -- Food item entity
  utils/                         -- Geometry & gaussian helpers
  animals/
    fish/                        -- Fish renderer + boid + config
    turtle/                      -- Turtle renderer + boid + config
```

### Per-frame Data Flow

```
draw()
  -> registry.update(grabbedBoid)
    -> boid.flock(sameGroup, settings)          // intra-group boids
    -> boid.separateFromOthers(allBoids, group) // cross-group repulsion
    -> boid.physicsUpdate(sameGroup, settings)   // physics + IK resolve
  -> registry.checkFoodCollisions(foods)
  -> foods[i].display()
  -> registry.render()
```

### Key Design Decisions

- **Mixin over inheritance** -- boid physics are mixed in via `applyBoidPhysics()`, not class hierarchy
- **3-file convention** -- each animal is: Renderer + Boid behavior + Config, under `animals/<name>/`
- **Config-driven sliders** -- each config defines an `applySliderValue` callback for slider-to-instance mapping
- **Shared food pool** -- all species compete for the same food items

## Adding a New Animal

1. Create `src/animals/<name>/` with three files:

   | File | Purpose |
   |------|---------|
   | `<Name>.js` | Rendering class (IK chain, drawing logic) |
   | `<Name>Boid.js` | Behavior class (flock, physics, display); call `applyBoidPhysics()` at end |
   | `<name>.config.js` | Registration config (group, label, palettes, physics, sliders) |

2. Register in `main.js`:
   ```js
   import { myAnimalConfig } from './animals/myAnimal/myAnimal.config.js';
   registry.register(myAnimalConfig);
   ```

### Boid Class Contract

Your boid class must implement:

- **Constructor** accepting a config object with: `id, group, x, y, scale, bodyColor, finColor, colorId, introversion, introversionCoefficient, quickness, quicknessCoefficient, racism, racismCoefficient, speedIndex, reactionDelayMs`
- **Instance properties**: `position, velocity, maxSpeed, maxForce, radius, mass, group, isGrabbed`
- **Methods**: `flock(sameGroupBoids, settings, updateTime)`, `physicsUpdate(sameGroupBoids, settings)`, `display()`, `resolveRenderPosition()`
- Optional eating: define `lastEatTime` and `eatCooldown` to participate in food consumption

## Tech Stack

- [p5.js](https://p5js.org/) v1.9.0 -- Canvas 2D rendering
- Vanilla JavaScript (ES Modules)
- No build tools, no dependencies beyond p5.js

## License

[MIT](LICENSE) -- Copyright (c) 2026 YangZH
