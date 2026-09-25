# TurboWarp Arduino

A browser-based Arduino editor built from the [TurboWarp GUI](https://github.com/TurboWarp/scratch-gui) and **TurboWarp's own fork of Scratch Blocks**. The new extension-first editor is served at `/dev/`; the existing editor at `/` is intentionally unchanged.

## What is included

- A reproducible `npm run sync:turbowarp` command that clones the complete TurboWarp GUI into `dev/turbowarp-gui` at upstream commit `25c11c6f246de9c6d36b29a61c505cd35f34cb8c`
- Real TurboWarp Scratch Blocks, pinned to upstream commit `7c58de666658df1bb447d010132aa3914c10f41e`
- TurboWarp’s real menu bar, rounded editor tabs, editor/stage split, run controls, stage sizing controls, and target selector adapted for an Arduino device
- An automatically loaded Arduino extension without sprites, costumes, backdrops, motion, or looks categories
- Digital, analog, serial, servo, tone, touch, sound recorder/amplifier, ultrasonic, and I²C blocks
- A dynamic “Add Extension” flow for named custom input/output equipment and unrestricted custom port aliases
- Arduino C++ generation and `.ino` download
- USB serial and configurable Web Bluetooth connections
- Direct browser-to-board `.hex` flashing for Uno, Nano, old-bootloader clones, Pro Mini, and LGT8F328P-compatible modified boards
- Configurable Bluetooth firmware transfer for boards already running a compatible BLE OTA receiver
- A custom-board mode without arbitrary pin-number limits
- Local, offline-friendly project storage and relative paths for GitHub Pages

## Develop

```sh
npm install
npm run sync:turbowarp
npm run dev
npm test
npm run build
```

Open `http://localhost:5173/dev/` for the new editor. Bluetooth firmware transfer is intentionally configurable because Arduino boards do not share one universal Bluetooth bootloader; its service and write-characteristic UUIDs must match the OTA firmware already installed on the target board.

The sync command preserves an exact local checkout of the upstream GUI source used as the UI reference without committing a Git submodule (gitlinks can cause “Pull request object state is invalid” errors in patch-based PR systems), while the Arduino-specific blocks, board stage, code generator, serial monitor, and uploader are maintained in this repository. The checked-in browser bundle in `public/vendor/turbowarp-scratch-blocks.js` is built directly from TurboWarp's GPL-3.0 `scratch-blocks` repository. Its required SVG runtime media is in `public/media/`. Binary click sounds and cursor files are intentionally omitted so patch-based hosts can create pull requests without rejecting binary files; CSS supplies native cursor fallbacks.

## Uploading without the Arduino IDE

1. Build your project with blocks and open **Arduino C++** to download the `.ino` source.
2. Obtain a compiled `.hex` for the sketch (from a school, maker-space, build service, or another computer).
3. Press **Upload**, choose the `.hex`, select the matching bootloader profile, and attach the board with a USB **data** cable.
4. Chrome or Edge transfers the firmware directly with Web Serial. Nothing is installed locally.

Compiling arbitrary Arduino C++ entirely in a static page is not claimed: board cores and third-party libraries are large, board-specific toolchains. The USB flashing step itself is fully browser based. Mega and non-AVR boards can still use generated `.ino` code and serial monitoring, but require a compatible external compiler/uploader.

## License and credits

TurboWarp Scratch Blocks is derived from Scratch Blocks and licensed under GPL-3.0. The uploader uses `web-arduino-uploader` (MIT). This project is GPL-3.0; see [LICENSE](LICENSE).
