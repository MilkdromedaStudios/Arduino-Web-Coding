# Arduino Web Test — `/dev`

This folder is a clean restart of the Arduino editor experiment. Nothing outside `/dev` is required or modified by this implementation.

The target is **TurboWarp with an Arduino-first hardware extension**, not a separate Scratch-like clone. The production build clones a pinned TurboWarp GUI revision, applies the small Arduino-specific source patch, and publishes the result so the new editor lives at `/dev/`.

## What this version changes

Only the Arduino-focused changes are applied to the pinned TurboWarp source:

- Automatically loads `arduino-extension.js`.
- Removes the Stage and sprite/target pane from the editor.
- Removes Costumes, Backdrops, and Sounds tabs.
- Removes Motion, Looks, Sound, Events, Sensing, and TurboWarp-only core categories from the toolbox.
- Keeps general programming categories: Control, Operators, Variables, and My Blocks.
- Adds an Arduino hardware panel for connection, upload, and hardware settings.
- Adds a dynamic Arduino block extension with aliases and custom equipment support.

Everything else is left to TurboWarp.

## Hardware blocks

The Arduino extension currently includes:

- USB cable or Bluetooth connection
- digital input/output
- analog input and PWM output
- servo angle and detach
- tone / no-tone
- generic H-bridge motor control
- ultrasonic distance sensor
- touch input (digital or analog-threshold style)
- amplifier / microphone level sampling
- analog sample recorder
- I²C read/write
- custom port aliases such as `leftMotor -> 9`
- named custom devices with a device type, port, settings object, operation, and data
- raw protocol requests for hardware not yet represented by a dedicated block

Custom pins are strings rather than a fixed Arduino Uno-only dropdown, so aliases, `A0`, numeric pins, and board-specific/custom port names can be used. The stock bridge firmware resolves standard Arduino pins; a custom board can map additional names in its own bridge implementation.

## Browser support

Use a Chromium browser that exposes the required browser hardware APIs, normally Chrome or Edge desktop. Hardware access requires HTTPS or localhost.

- USB runtime connection uses **Web Serial**.
- Bluetooth runtime connection uses **Web Bluetooth** with configurable GATT service/write/notify UUIDs.

## Build the source-patched TurboWarp version

From this folder:

```sh
npm install
npm run setup
npm run start
```

`npm run setup` does the following:

1. Deletes/recreates the ignored `dev/turbowarp-gui` checkout as needed.
2. Clones `https://github.com/TurboWarp/scratch-gui.git`.
3. Checks out the pinned commit `25c11c6f246de9c6d36b29a61c505cd35f34cb8c`.
4. Applies `scripts/patch-turbowarp.mjs`.
5. Installs TurboWarp's own dependencies.

For a deployable `/dev/` build:

```sh
npm run build
```

The build uses `/dev/` as the web root and then copies the generated TurboWarp build into this folder. `editor.html` is copied to `index.html`, so visiting `/dev/` opens the customized editor directly.

## Current checked-in `/dev/` launcher

`index.html` + `host.js` are also a working development launcher before a local TurboWarp production build has been generated. It opens TurboWarp's official web editor with this repository's Arduino extension automatically loaded and keeps the browser hardware permission calls in the top-level `/dev` page.

The launcher visually crops TurboWarp's ordinary right-side Stage/sprite area. The **source-patched build** is the strict version: it actually removes those GUI elements and unwanted categories in the cloned TurboWarp source rather than merely hiding them.

## Board bridge firmware

Flash this sketch to a board for live block control:

```text
firmware/arduino_bridge/arduino_bridge.ino
```

The bridge speaks a small tab-separated protocol at 115200 baud:

```text
Browser -> board: @12\tDWRITE\t13\t1
Board   -> browser: @12\tOK\tdone

Browser -> board: @13\tAREAD\tA0
Board   -> browser: @13\tOK\t527
```

Commands are request-ID based, so reporter blocks can wait for the matching response. The sketch includes a `handleCustomCommand(...)` hook for custom equipment without changing the web editor.

## Firmware upload

### USB

The upload button accepts Intel HEX and performs direct browser-to-board AVR/STK500v1 programming over Web Serial. This is intended for compatible AVR bootloaders such as common Uno/Nano/ATmega328P setups. Bootloader baud and page size are configurable.

This is **not** a browser C/C++ compiler. The upload flow flashes an already compiled `.hex` file.

### Bluetooth

There is no one universal Bluetooth bootloader shared by Arduino boards. Bluetooth upload therefore uses a configurable OTA GATT service/write characteristic. The sender writes:

```text
AWT1\t<binary-size>\t<filename>\n
```

followed by binary packets using the configured packet size. The target board must already run a BLE OTA receiver that understands that framing (or a compatible receiver can be substituted by changing the configured UUIDs/protocol implementation).

Runtime Bluetooth control and Bluetooth firmware upload can use different firmware designs; the browser side intentionally keeps the service/characteristic settings editable rather than hard-coding one vendor's hardware.

## Files

- `index.html` — immediate `/dev/` launcher
- `host.js` — top-frame USB/Bluetooth bridge and uploader for the launcher
- `arduino-extension.js` — TurboWarp Arduino extension
- `firmware/arduino_bridge/arduino_bridge.ino` — board-side live-control bridge
- `overrides/arduino-toolbar.jsx` — hardware panel inserted into the source-patched TurboWarp GUI
- `overrides/arduino-toolbar.css` — hardware panel styling
- `scripts/sync-turbowarp.mjs` — pinned upstream checkout
- `scripts/patch-turbowarp.mjs` — Arduino-only TurboWarp source edits
- `scripts/publish-build.mjs` — publishes the generated TurboWarp build at `/dev/`
