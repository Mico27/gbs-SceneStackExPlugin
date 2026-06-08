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
3. [Technicalities and Restrictions](#technicalities-and-restrictions)
4. [Events Reference](#events-reference)
5. [Inner Workings](#inner-workings)

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

## Technicalities and Restrictions

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

If `scene_stack_ex_count` is already at the maximum (2), `vm_push_scene_stack_ex` silently does nothing. No error is raised.

### Modified Engine Files

| File | Change |
|---|---|
| `core.c` | Handles `EXCEPTION_PUSH_SCENE_STACK` and `EXCEPTION_POP_SCENE_STACK`; calls `scene_stack_init()` in `core_reset` |
| `data_manager.c` | Adds `scene_stack_count` tracking to standard `load_init`; includes `scene_stack_ex.h` |
| `vm_scene.c` | Adds overflow/underflow guards to standard push/pop functions |
| `load_save.c` | Includes modified save point list (extended stack is excluded from saves) |
| `include/data_manager.h` | Exports `scene_stack_count` and standard stack symbols |
| `include/vm_exceptions.h` | Adds exception codes 5 (`EXCEPTION_PUSH_SCENE_STACK`) and 6 (`EXCEPTION_POP_SCENE_STACK`) |
| `include/vm.i` | Adds the same two exception code constants to the VM assembler namespace |
| NEW `scene_stack_ex.c` | All extended stack logic |
| NEW `scene_stack_ex.h` | Public interface and `MAX_SCENE_STACK_EX_COUNT` constant |

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

## Inner Workings

### New Exception Codes

The plugin adds two new VM exception codes:

```c
EXCEPTION_PUSH_SCENE_STACK = 5
EXCEPTION_POP_SCENE_STACK  = 6
```

These are defined in both the C header (`vm_exceptions.h`) and the assembler constants file (`vm.i`) so the VM bytecode compiler can reference them. They work identically to the built-in scene-change exception mechanism: a native function sets `vm_exception_code` and the main game loop in `core.c` handles it at the top of the next iteration.

### `push_scene_stack_ex` — Saving the Snapshot

`vm_push_scene_stack_ex` raises `EXCEPTION_PUSH_SCENE_STACK`. The `core.c` exception handler calls `push_scene_stack_ex()` and then `continue`s — meaning **no scene reload occurs**. The game loop simply resumes.

`push_scene_stack_ex` saves state into `scene_stacks_ex[scene_stack_ex_count]` at `0xA000` (SRAM):

```c
void push_scene_stack_ex(void) BANKED {
    if (scene_stack_ex_count < MAX_SCENE_STACK_EX_COUNT) {
        scene_stack_ex_ptr->scene      = current_scene;
        scene_stack_ex_ptr->player_pos = PLAYER.pos;
        scene_stack_ex_ptr->player_dir = PLAYER.dir;
        push_vm_stack_item();        // CTXS, context_stacks, list pointers, lock state
        push_event_stack_item();     // input events, timer events/values
        push_music_stack_item();     // current track, music events
        push_actor_stack_item();     // all actors, list heads/tails, player state
        push_projectile_stack_item();// all projectiles and defs
        push_camera_stack_item();    // camera x/y, clamp, offset, deadzone, settings
        scene_stack_ex_ptr->rand_seed = __rand_seed;
        scene_stack_ex_ptr++;
        scene_stack_ex_count++;
    }
}
```

### `pop_scene_stack_ex` — Restoring the Snapshot

`vm_pop_scene_stack_ex` raises `EXCEPTION_POP_SCENE_STACK`. The handler:

```c
case EXCEPTION_POP_SCENE_STACK: {
    remove_LCD_ISRs();
    vm_pop_scene_stack_state = pop_scene_stack_ex();
    load_scene(current_scene.ptr, current_scene.bank, FALSE);
    fade_in = FALSE;
    break;
}
```

`pop_scene_stack_ex` decrements the pointer and restores all fields in reverse order:

```c
UBYTE pop_scene_stack_ex(void) BANKED {
    if (scene_stack_ex_count > 0) {
        scene_stack_ex_count--;
        scene_stack_ex_ptr--;
        current_scene  = scene_stack_ex_ptr->scene;
        PLAYER.pos     = scene_stack_ex_ptr->player_pos;
        PLAYER.dir     = scene_stack_ex_ptr->player_dir;
        pop_vm_stack_item();
        pop_event_stack_item();
        pop_music_stack_item();
        pop_actor_stack_item();
        pop_projectile_stack_item();
        pop_camera_stack_item();
        __rand_seed = scene_stack_ex_ptr->rand_seed;
        return TRUE;
    }
    return FALSE;
}
```

`load_scene(..., FALSE)` then reloads the background and sprite VRAM data from ROM without reinitialising actor positions or running the scene init script — since all actor state was already restored from the snapshot.

After the exception is handled, the main loop checks `vm_pop_scene_stack_state`:

```c
if (!vm_pop_scene_stack_state) {
    player_init();
    state_init();
}
```

Because the flag is `TRUE`, `player_init` and `state_init` are skipped. The restored VM contexts take over immediately, and music is restarted by the pop path if the track has changed.

### The Push/Pop Branching Model in the Compiled Script

The `eventPushSceneStackEx.js` event compiles to roughly the following sequence:

```
vm_push_scene_stack_ex       ; raises EXCEPTION_PUSH_SCENE_STACK, then continues
vm_poll_stack_pop [hasPoppedRef] ; reads vm_pop_scene_stack_state → clears it
if hasPoppedRef == 1 → jump popLabel
  [On push script]
  jump endLabel
popLabel:
  [On pop script]
  (fade in if on-pop script is empty)
endLabel:
```

`vm_poll_stack_pop` reads `vm_pop_scene_stack_state` into a local variable and immediately clears the flag. On the first pass (after the push), the flag is 0 — the "On push" path runs. When the snapshot is later restored via `pop_scene_stack_ex`, the VM state is rewound to the instruction right after `vm_push_scene_stack_ex`, `vm_pop_scene_stack_state` is `TRUE`, and `vm_poll_stack_pop` returns 1 — the "On pop" path runs.

This means both paths share a single compiled script and the branching costs only one additional `vm_poll_stack_pop` call per push event.

### Music Restoration

`pop_music_stack_item` compares the saved track to the current one before overwriting:

```c
if (prev_music_current_track_bank != music_current_track_bank ||
    prev_music_current_track != music_current_track) {
    if (music_current_track_bank != MUSIC_STOP_BANK) {
        music_next_track = music_current_track;
    } else {
        music_sound_cut();
    }
}
```

If the track that was playing when the push happened is different from whatever is playing when the pop occurs, the saved track is queued to restart. If the saved state had no music, `music_sound_cut()` stops playback.

### `vm_pop_all_scene_stack_ex`

Pop-all is implemented by collapsing the pointer back to just one entry above the base and setting count to 1, then raising the same `EXCEPTION_POP_SCENE_STACK`:

```c
void vm_pop_all_scene_stack_ex(void) OLDCALL BANKED {
    if (scene_stack_ex_count > 0) {
        scene_stack_ex_ptr = scene_stacks_ex;
        scene_stack_ex_ptr++;
        scene_stack_ex_count = 1;
        vm_exception_code = EXCEPTION_POP_SCENE_STACK;
    }
}
```

This discards all entries above the first one and then pops to the oldest saved scene, executing its **On pop** script.
