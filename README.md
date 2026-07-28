# Delaporia Pet

An extensible desktop-pet foundation for macOS and Windows, built with Tauri 2,
Rust, TypeScript, Vite, and Canvas.

## Development

Requirements:

- Node.js and npm
- Rust stable
- Tauri 2 platform prerequisites

```bash
npm install
npm run tauri dev
```

Run the complete deterministic verification suite:

```bash
npm run verify
```

Build a local release:

```bash
npm run tauri build
```

## Built-in pets

The catalog is stored at `src/assets/pets/catalog.json`. Each pet lives in
`src/assets/pets/<pet-id>/` and contains:

- `pet.json`: identity, sprite layout, animation clips, and capabilities
- `spritesheet.webp`: the animation sprite sheet

Add the new pet ID to `catalog.json`, then run `npm run validate:pets`. The
application discovers the pet from the catalog and exposes it in the tray menu
without requiring pet-specific application code.

## Extending behavior

Runtime behavior is split into an extensible state machine and animation clips.
New actions can be added by defining a clip/capability in the pet schema, adding
the corresponding behavior state and transition, and registering its renderer
selection. Existing pets can omit unsupported optional capabilities.

Autonomous animation-only actions can be added without application code by
declaring them in `autonomousActions`. Use `playback: "once"` to play one full
animation cycle, or `playback: "timed"` with `minDurationMs` and
`maxDurationMs` to run a looping animation for a randomized interval.

## Release status

The current local macOS artifact targets Apple Silicon. The included GitHub
Actions workflow builds macOS and Windows artifacts on their native runners.
See `docs/platform-qa.md` for the verified and pending manual QA matrix.
