# TurboBot Studio

TurboBot Studio is a static, browser-based Arduino robot IDE. It combines a Scratch/TurboWarp-inspired editor experience with BlocklyDuino-style Arduino code generation, without loading Scratch projects.

## Features

- Colorful drag-and-drop blocks for pins, PWM motors, timing, and serial output
- A small Python alternative that translates common robot commands into Arduino C++
- Live generated Arduino code and .ino downloads
- Web Serial connection, monitor, and send controls
- Automatic local project saving and GitHub Pages deployment

## Develop

Install with npm install, start with npm run dev, test with npm test, and build with npm run build.

The production build uses relative asset URLs, so it works both at a custom domain and under a GitHub Pages repository path such as `/Arduino-Web-Coding/`.

## Uploading

The editor generates a standard .ino sketch. Download it and flash it with Arduino IDE or arduino-cli. Once firmware is installed, Connect provides a live 9600-baud Web Serial terminal. Browser compilation is not claimed because a fully static Pages site does not include board-specific compiler toolchains.

## Credits and license

The interaction design is inspired by [TurboWarp](https://github.com/TurboWarp/scratch-gui) and the Arduino workflow by [BlocklyDuino](https://github.com/BlocklyDuino/BlocklyDuino/tree/v2). This implementation is original and uses the maintained Blockly package. Licensed under GPL-3.0; see [LICENSE](LICENSE).
