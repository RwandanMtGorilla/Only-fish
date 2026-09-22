# Only-fish

A procedural pond simulation using p5.js 1.9.0 and native JavaScript ES modules. No build step is required. [中文文档](doc/README_CN.md)

## Run

Serve the repository over HTTP (opening index.html as a file does not support module imports):

```sh
python -m http.server 8080
```

Open http://localhost:8080. Windows users can also run start.bat; Linux/macOS users can run ./start.sh. p5.js loads from a CDN, so the page needs internet access.

## Pond and controls

The default scene contains 5 fish, 22 goldfish, 3 turtles, 8 shrimp, 3 lilypads and 2 lotus flowers with individually simulated petals. Counts, palettes and scale ranges live in species configs.

Click empty water to feed; hold a creature or plant to drag it. The gear opens controls. Walls starts off; Collisions, Feed and Catch start on. Seek Mouse and collision-radius debugging start off.

Choose a species to edit its controls. Moving animals expose Introversion, Speed, Color Separation (extra separation from other colors) and Diversity. Plants expose only Diversity: they drift through springs, damping and collisions rather than flocking. Slider labels, bounds, defaults and conversions come from the selected config, including mobile buttons.

## Architecture

- `src/main.js`: registration, p5 lifecycle, fixed-step scheduling and pointer interaction.
- `src/core/FixedStepClock.js`: 60 Hz simulation clock, independent of display refresh rate.
- `src/registry/AnimalRegistry.js`: group creation, staged steering, integration, food and rendering.
- `src/boids/BoidPhysics.js`: shared steering, boundaries, collisions and delayed velocity history.
- `src/core/FishLocomotion.js`, `FishSpine.js`, `LighthillGait.js`: fish/goldfish path-following spines and time-based gait.
- `src/core/Chain.js`: IK chains used by shrimp, turtles and fins.
- `src/animals/`: species renderers, behavior and configs. `pond_plant` creates a composite group using `lilypad` and `lotus`.
- `src/ui/UIController.js`: schema-generated sliders and synchronized desktop/mobile toggles.
- `src/entities/FoodItem.js`: attraction, consumption cooldowns and procedural food rendering.

Each draw accumulates elapsed milliseconds and executes zero or more simulation ticks, then renders. Each tick updates dragging, records velocity history, computes all steering while preserving pre-step neighbor positions/velocities, commits velocities and plant reaction impulses, integrates physics, attracts food and checks consumption. Gait receives 1/60 second per tick; velocity is pixels per tick and maxForce is the steering increment per tick. Cooldowns, alignment delay and petal fading use simulation milliseconds.

Catch-up is capped at 250 ms per draw to avoid large jumps after backgrounding. Rendering has no interpolation, so a 120 Hz screen still displays 60 Hz motion. Collision solving remains sequential in stable group/id order; it is not a simultaneous multi-body solver. Stable unique ids within a group are required.

## Extend

For an ordinary moving species, add a renderer, Boid class and config, then import/register the config in main.js. Configs define group, label, count, scale range, palettes, physics, individual coefficient distributions, sliders and applySliderValue.

The standard factory passes physics options to the constructor. Keep the constructor and slider callback on the same speed formula. Boids provide position, velocity, radius, mass, maxSpeed, maxForce, id/group and the methods flock, separateFromOthers, physicsUpdate, display and resolveRenderPosition. Shared methods can be mixed in with applyBoidPhysics. Steering may update its own velocity; use pendingImpulse for reaction forces on another entity rather than changing that entity's velocity during steering. Position changes belong in physicsUpdate.

Each slider schema supplies label, min, max, step, defaultValue, toParam and toUI; applySliderValue maps it to instances. Arbitrary slider keys are supported. Species with a different constructor or composite anatomy can provide customCreateBoids(groupState), as plants do.

A config's zIndex sets its default render layer. Optional getZIndex(boid) returns a dynamic layer; detached petals use this hook. Registry has no petal-specific rendering branch. Optional eatCooldown/lastEatTime enable food consumption; isDead triggers cleanup.

## Tests

Node.js 22 or newer is needed only for development tests; there are no npm dependencies.

```sh
npm test
```

Tests use Node's built-in runner and a small deterministic p5 math/DOM adapter. They cover refresh-rate equivalence, stalls, traversal order, pre-step steering, speed/config consistency, plants, dynamic sliders and checkbox synchronization. They do not validate Canvas appearance or real touch hardware. GitHub Actions runs the suite on pushes and pull requests.

Personal IDE, virtual-environment and AI-tool settings are ignored. The old internal/UI term has been renamed to colorSeparation / Color Separation.

## Turn animation study

Run `npm run study:turn -- --interval=8 --speed=1 --yaw=0.3` to generate
`screenshots/turn-study.html`, `.svg`, and `.json`. Open the HTML or SVG to compare
symmetric strokes, the previous turn strength (0.16), and the current default.
The tool uses production locomotion and spine code with a simplified fish outline;
it does not reproduce the p5 fin renderer. All variants share the same trajectory
and starting phase. The top strips sample every `interval` simulation frames;
the lower path samples every 30 frames. Speed is in body lengths per second,
yaw in radians per second (use a negative value for the opposite turn).
The sequence includes turn onset and recovery, and reports joint-limit hits
and the largest per-frame joint change. Generated artifacts are git-ignored.

## License

[MIT](LICENSE)
