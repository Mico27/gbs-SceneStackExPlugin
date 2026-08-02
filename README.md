# gbs-SceneStackExPlugin

**Version 4.3.0 — Requires GB Studio ≥ 4.3.0**

A GB Studio engine plugin that provides a deep-save extended scene stack. The built-in GB Studio scene stack saves only the scene address, the player's position, and the player's direction. This plugin adds an extended variant that snapshots virtually the entire runtime state — VM script contexts, input/timer events, music state, all actors, projectiles, camera, and the random seed — so that when a scene is popped from the stack, the game resumes exactly where it left off, as if nothing happened.

The plugin also adds failsafe guards to the standard scene stack so that overflowing or underflowing it never causes undefined behaviour. It adds a pair of count-query events for both the standard and extended stacks, and extends all four standard stack operations with extended counterparts.

<img width="669" height="170" alt="image" src="https://github.com/user-attachments/assets/aa09dae9-3cc4-4664-9e0f-28147c34f8a2" />

<img width="664" height="95" alt="image" src="https://github.com/user-attachments/assets/a14d58f7-23c3-4ef7-840e-a15a49c49f8b" />

<img width="665" height="120" alt="image" src="https://github.com/user-attachments/assets/b74153c9-40a9-4bdf-8e11-b3ab46240041" />

<img width="669" height="120" alt="image" src="https://github.com/user-attachments/assets/6334bc62-c114-4cec-85e4-caba35227665" />

<img width="667" height="68" alt="image" src="https://github.com/user-attachments/assets/32ef1751-2d63-44ed-bc38-38ed84ca5484" />

---

## Table of Contents

1. [Concepts](#concepts)
2. [Project Setup](#project-setup)
3. [Size Limits and Restrictions](#size-limits-and-restrictions)
4. [Events Reference](#events-reference)
5. [Memory Footprint](#memory-footprint)

---

## Concepts

### Standard Stack vs. Extended Stack

GB Studio's built-in scene stack (`Store current scene on stack` / `Restore previous scene from stack`) is a lightweight 8-entry ring that saves only three fields per entry: the scene far pointer, the player's sub-pixel position, and the player's facing direction. All running scripts, actors, timers, and music state are discarded when a scene change occurs.

The extended stack saves a complete snapshot of the runtime state before any scene change takes place. When the scene is later popped, the snapshot is restored and the game continues from the exact moment the push happened — including the script thread that triggered the push.

### What Is Saved

Each extended stack entry captures the following categories of state:

| Category | Contents |
|---|---|
| Scene | Current scene far pointer |
| Player | Sub-pixel position, facing direction |
| VM | All script contexts (`CTXS`), context stack memory, linked-list pointers (`first_ctx`, `free_ctxs`, `executing_ctx`), VM lock state |
| Events | All 8 input event slots, all timer event slots and timer values |
| Music | Current track bank and pointer, all 4 music event slots |
| Actors | All actor structs, active/inactive linked-list heads and tails, player moving/iframe/collision state |
| Projectiles | All projectile instances and definitions, active/inactive list heads |
| Camera | Position, clamp bounds, offset, deadzone, settings byte |
| RNG | 16-bit random seed |

### What Is NOT Saved (VRAM State)

The extended stack stores only RAM/CPU state. VRAM contents — tile data, tilemaps, OAM — are not part of the snapshot. When the stack is popped, `load_scene` reloads the background and sprite tile data from ROM, but any runtime VRAM changes made after the scene originally loaded are lost:

- Replaced actor spritesheets (the new tile bitmaps are not saved)
- Submapped tiles
- Swapped tileset tiles
- Runtime tile writes

These must be manually re-applied inside the **On pop** script of the push event.

### The Push/Pop Execution Model

The push event does not trigger a scene change. After saving the state snapshot, the game continues running in the same scene. The script that called the push resumes immediately and can execute the **On push** subscript.

Later, when any script calls the pop event:

1. The snapshot is restored — including the VM context that was running the push event.
2. `load_scene` is called with `init_data = FALSE` to reload VRAM without reinitialising actors or running the scene init script.
3. The script resumes executing right after the `vm_push_scene_stack_ex` call — `vm_poll_stack_pop` now returns `1`, so the **On pop** subscript runs instead of **On push**.

This mechanism means the same instruction sequence in the compiled script handles both the push and the pop paths, controlled entirely by a single flag set by the runtime.

---

## Project Setup

1. Copy the plugin folder into your GB Studio project's `plugins/` directory.
2. No engine fields or project settings are required.

---

## Size Limits and Restrictions

### Extended Stack Depth: 2 Entries

Each extended stack entry is very large (it holds the entire runtime state). Only 2 entries fit in the allocated SRAM region (`MAX_SCENE_STACK_EX_COUNT = 2`). The standard built-in stack (8 entries, lightweight) remains fully functional alongside the extended stack.

### Extended Stack Lives in SRAM

The `scene_stacks_ex` array is placed at a fixed SRAM address (`0xA000`). This means:

- The cartridge must have external RAM (SRAM) available.
- The total SRAM size consumed is `2 × sizeof(scene_stack_item_ex_t)`.

### Extended Stack Is Not Saved/Loaded

The extended stack data is not included in the game's save system. Saving and loading the game does not preserve or restore any extended stack entries.

### VRAM Must Be Manually Restored On Pop

Any runtime changes to VRAM (actor spritesheet swaps, submapping, tile replacement) are not part of the snapshot. The **On pop** subscript is the correct place to re-apply them.

### No Fade-In Is Added Automatically

After a pop, no fade-in is performed automatically. If a fade-in is desired upon returning to the previous scene, add a `Fade In` event inside the **On pop** subscript.

### Pop When Stack Is Empty Does Nothing

Both the pop and pop-all events are guarded: if the extended stack is empty they raise no exception and the game continues normally.

### Push When Stack Is Full Does Nothing

If the extended stack is already at its maximum of 2 entries, the push silently does nothing. No error is raised.

### Modified Engine Files

The plugin patches several stock engine files — scene loading, the scene-change exception handling, the built-in push/pop events and the save point list — and adds its own extended-stack files. Another plugin that patches the same stock files needs a merged build or a matching compatibility variant.

The extended stack is deliberately **excluded from saves**.

---

## Events Reference

### Push Scene State to Stack (EXTENDED)

**Event ID:** `EVENT_PUSH_SCENE_STACK_EX`  
**Group:** Scene → Scene Stack

Saves a full snapshot of the current runtime state to the extended stack, then continues executing the current scene. Contains two subscript branches compiled into the same instruction stream:

| Field | Type | Description |
|---|---|---|
| On push | Events (subscript) | Runs immediately after the state is saved. Executes in the context of the current scene. Does **not** run when the scene is later popped. |
| On pop | Events (subscript) | Runs when this entry is popped from the stack — i.e., when the game returns to this scene. Runs in the fully restored runtime context. |

**Notes:**
- Pushing when the extended stack is already at 2 entries does nothing.
- The **On pop** subscript should include a `Fade In` event if a visual transition is desired on return.
- Re-apply any VRAM changes (spritesheet swaps, submapping, etc.) inside **On pop**.

---

### Pop the Top Scene State from Stack (EXTENDED)

**Event ID:** `EVENT_POP_SCENE_STACK_EX`  
**Group:** Scene → Scene Stack

Pops the most recently pushed extended stack entry, restores the full runtime snapshot, and reloads VRAM from the scene's ROM definition.

| Field | Type | Default | Description |
|---|---|---|---|
| Fade speed | Fade speed picker | 2 | Speed of the fade-out before the scene transition. Set to **Instant** (none) to skip the fade-out entirely. |

**Notes:**
- Popping when the extended stack is empty does nothing.
- No fade-in is added automatically. Add one in the **On pop** subscript if needed.

---

### Pop All Scene States from Stack (EXTENDED)

**Event ID:** `EVENT_POP_ALL_SCENE_STACK_EX`  
**Group:** Scene → Scene Stack

Collapses the extended stack down to its first entry, then pops that entry. Equivalent to calling pop repeatedly until only one entry remains and then popping it — but implemented in a single operation.

| Field | Type | Default | Description |
|---|---|---|---|
| Fade speed | Fade speed picker | 2 | Speed of the fade-out before the scene transition. Set to **Instant** to skip. |

---

### Clears the Stack of Saved Scene States (EXTENDED)

**Event ID:** `EVENT_RESET_SCENE_STACK_EX`  
**Group:** Scene → Scene Stack

Immediately empties the extended stack without performing any scene transition. The saved entries are abandoned. Use this when you want to discard stacked scenes without returning to them (for example, after a game-over sequence).

---

### Get Scene Stack Count (EXTENDED)

**Event ID:** `EVENT_GET_SCENE_STACK_EX_COUNT`  
**Group:** Scene → Scene Stack

Stores the current number of entries in the **extended** stack (0, 1, or 2) into a variable.

| Field | Type | Description |
|---|---|---|
| Variable | Variable | Receives the current extended stack depth. |

---

### Get Scene Stack Count

**Event ID:** `EVENT_GET_SCENE_STACK_COUNT`  
**Group:** Scene → Scene Stack

Stores the current number of entries in the **standard** built-in scene stack (0–8) into a variable.

| Field | Type | Description |
|---|---|---|
| Variable | Variable | Receives the current standard stack depth. |

---

## Memory Footprint

Measured against the stock GB Studio **4.3.0-e1** engine (per-file SDCC compile with GB Studio's build flags, default engine settings). Values are the plugin's *delta* versus the stock engine; DMG build, with CGB noted where it differs. ROM cost lands in banked ROM (GB Studio's autobanker spreads it across switchable banks); using the plugin's events additionally compiles a few bytes of GBVM script per call into your project's script banks.

| | Cost |
|---|---|
| WRAM | +5 bytes |
| ROM | +1,867 bytes |

- **WRAM:** 5 bytes — the extended stack pointer and counter.
- **Engine WRAM headroom:** the stock GB Studio 4.3.0 engine leaves about **854 bytes** of WRAM free (usable engine WRAM is 7,776 bytes at 0xC0A0–0xDF00; the stock engine uses 6,922 bytes). With this plugin installed roughly **849 bytes** remain. This figure does not depend on how many global variables your project defines: the script memory array has a fixed size of VM_HEAP_SIZE + (VM_MAX_CONTEXTS × VM_CONTEXT_STACK_SIZE) words — 768 + 16 × 64 = 1,792 words (3,584 bytes) with stock engine settings.
- **SRAM:** yes — the extended scene stack lives in SRAM bank 0: 2 snapshot slots × 4,018 bytes = **8,036 bytes** at 0xA000 (with default engine settings; snapshot size scales with MAX_ACTORS, VM context count, etc.). Game saves are relocated to SRAM banks 1–3, so a cartridge with at least 32 KiB SRAM is required if your game uses save slots.

---

<!-- BANK0:BEGIN -->
## Bank 0 (HOME) Usage

Bank 0 is the 16 KB non-switchable ROM bank that the GB Studio engine core,
the interrupt handlers and the GBDK runtime all share. Banked ROM is cheap
(add another bank), bank 0 is not, so it is usually the first thing a project
runs out of.

| | Bytes |
|---|---|
| Bank 0 used by this plugin | **0** |
| Bank 0 free with this plugin installed | **1,451** of 16,384 (91% used) |

**This plugin costs nothing in bank 0.** All of its code lives in a switchable
ROM bank; nothing it adds is resident in bank 0.

<details><summary>How this was measured</summary>

GB Studio 4.3.2, DMG target, default engine settings. Each module's bank 0
contribution is the `A _HOME size` record that SDCC writes into its `.rel`
object, summed over the engine sources this plugin provides. Stock sizes come
from building projects whose only plugin ships no engine C, so every module in
them is the untouched engine; two such builds were compared and agreed on all
73 shared modules.

The "free" figure is a stock project with this plugin and nothing else. Your
own number will differ: other plugins, and any engine settings that change what
the core compiles, move it independently of this plugin.

</details>
<!-- BANK0:END -->
