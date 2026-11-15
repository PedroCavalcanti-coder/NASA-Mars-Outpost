# Movement synchronization

Online movement is authoritative on the server. Camera orbit changes only the local view.
Controls are converted once into the map coordinate frame: centered base, scale 0.75,
X east, Z south, heading 0 facing +Z. Rendering, navigation and physics use that same frame.

The server advances at 30 fixed steps per second and publishes complete room movement
snapshots at 20 Hz, including the requesting player. Clients send sequenced controls,
map destinations and acknowledged actions; they cannot assign player or rover positions.
Input queues are bounded and controls expire after 250 ms without an update.

Local prediction reuses the server physics and navigation masks. Confirmations discard
processed inputs and replay outstanding inputs. Small corrections affect only the visual
model; authoritative positions change immediately. Remote presentation uses a 100 ms
snapshot buffer, holds the latest available state and never interpolates across obstacles
or teleports. Disconnect freezes controls and discards pending inputs. Resume tokens can
recover the last confirmed pose for 120 seconds; positions are not persisted across a
server restart. A driver disconnect parks the rover and disembarks the passenger.

The server chooses spawns, paths, collisions, driver/passenger ownership, disembark points,
gesture anchors and infirmary destinations. The gameplay authority supplies movement
restrictions through `RoomMovement.restrict(id, { blocked, cold })`; snapshots include
those restrictions so prediction follows the same rules. Campaign resources, health and
rewards belong to the separate gameplay simulation. Online failures never create a
fallback room.

The gameplay adapter reads `RoomMovement.players.get(id).state` and `grid` for canonical
positions and proximity. It requests recovery with `action(id, "infirmary")`; it must not
assign `GameRoom.players.motion` or `world.vehicle`, which are movement projections.

## Navigation assets and compatibility

`npm run navigation:build` generates the eight navigation maps, spawn points, parking and
infirmary positions from the tracked GLBs and layouts. `npm run navigation:check` verifies
that checked-in data matches the inputs. Regenerate after changing geometry or movement
rules. The headless decoder reads geometry without loading textures or a renderer.

The join handshake checks movement protocol version and navigation hash. Incompatible
clients must refresh. Base, terrain, crop and layout URLs carry the hash so old cached
geometry is not reused with a new navigation map. Deploy client and server together.
Existing world saves remain compatible; saved rover coordinates are validated against
the navigation map before use.

## Verification

Run `npm test`, `npm run typecheck`, `npm run build`, `npm run build:server`, and
`npm run navigation:check`. Against a running app:

```sh
node scripts/multiplayer-smoke.mjs http://127.0.0.1:5173
node scripts/multiplayer-smoke.mjs http://127.0.0.1:5173 polling
```

The smoke uses four temporary guests and checks self confirmations, room capacity and
agreement within 0.05 map unit after stopping. It does not save a world. Automated tests
cover all eight bases, stale/duplicate/invalid inputs, pause, walls, vehicle ownership,
driver disconnect, reconnection, snapshot loss and prediction at up to 300 ms latency.
`BaseViewer.diagnostics.movement` exposes snapshot tick/age, acknowledged input sequence,
pending input count and correction distance without adding controls to the game HUD.
