import {copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const DEV_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GUI_ROOT = path.join(DEV_ROOT, 'turbowarp-gui');

if (!existsSync(GUI_ROOT)) {
    throw new Error('Missing dev/turbowarp-gui. Run npm run sync first.');
}

const replaceOnce = (source, search, replacement, label) => {
    const updated = source.replace(search, replacement);
    if (updated === source) throw new Error(`TurboWarp patch marker not found: ${label}`);
    return updated;
};

const guiPath = path.join(GUI_ROOT, 'src/components/gui/gui.jsx');
let gui = readFileSync(guiPath, 'utf8');

gui = replaceOnce(
    gui,
    "import MenuBar from '../menu-bar/menu-bar.jsx';",
    "import MenuBar from '../menu-bar/menu-bar.jsx';\nimport ArduinoToolbar from '../arduino-toolbar/arduino-toolbar.jsx';\nimport PythonEditor from '../python-editor/python-editor.jsx';",
    'Arduino and Python editor imports'
);

gui = replaceOnce(
    gui,
    "    } = omit(props, 'dispatch');\n    if (children) {",
    "    } = omit(props, 'dispatch');\n\n    const arduinoExtensionURL = new URL(basePath + 'arduino/arduino-extension.js', window.location.href).href;\n    React.useEffect(() => {\n        const manager = vm.extensionManager;\n        const security = manager.securityManager;\n        const originalGetSandboxMode = security.getSandboxMode.bind(security);\n        security.getSandboxMode = url => url === arduinoExtensionURL ? 'unsandboxed' : originalGetSandboxMode(url);\n        manager.loadExtensionURL(arduinoExtensionURL).catch(error => {\n            // eslint-disable-next-line no-console\n            console.error('Unable to load Arduino extension', error);\n        });\n        return () => {\n            security.getSandboxMode = originalGetSandboxMode;\n        };\n    }, [vm, arduinoExtensionURL]);\n\n    if (children) {",
    'automatic Arduino extension load'
);

gui = replaceOnce(
    gui,
    /<TabList className=\{tabClassNames\.tabList\}>[\s\S]*?<\/TabList>/,
    `<TabList className={tabClassNames.tabList}>\n                                    <Tab className={tabClassNames.tab}>\n                                        <img\n                                            draggable={false}\n                                            src={codeIcon()}\n                                        />\n                                        <FormattedMessage\n                                            defaultMessage="Blocks"\n                                            description="Button to get to the Arduino blocks panel"\n                                            id="arduino.gui.blocksTab"\n                                        />\n                                    </Tab>\n                                    <Tab className={tabClassNames.tab}>\n                                        <span aria-hidden="true">Py</span>\n                                        <span>Python</span>\n                                    </Tab>\n                                </TabList>`,
    'replace Scratch tabs with Blocks and Python'
);

gui = replaceOnce(
    gui,
    /\s*<Box className=\{styles\.extensionButtonContainer\}>[\s\S]*?<\/Box>/,
    '',
    'remove extension library button'
);

gui = replaceOnce(
    gui,
    /\s*<Box className=\{styles\.watermark\}>\s*<Watermark \/>\s*<\/Box>/,
    '',
    'remove Scratch/TurboWarp watermark'
);

gui = replaceOnce(
    gui,
    /\s*<TabPanel className=\{tabClassNames\.tabPanel\}>\s*\{costumesTabVisible \? <CostumeTab[\s\S]*?<\/TabPanel>/,
    '',
    'remove costume panel'
);

gui = replaceOnce(
    gui,
    /\s*<TabPanel className=\{tabClassNames\.tabPanel\}>\s*\{soundsTabVisible \? <SoundTab vm=\{vm\} \/> : null\}\s*<\/TabPanel>/,
    '',
    'remove sound panel'
);

gui = replaceOnce(
    gui,
    "                                    </Box>\n                                </TabPanel>",
    "                                    </Box>\n                                </TabPanel>\n                                <TabPanel className={tabClassNames.tabPanel}>\n                                    <PythonEditor />\n                                </TabPanel>",
    'Python tab panel'
);

// Remove web/Scratch-oriented navigation without removing local project save/load.
gui = replaceOnce(gui, '                    canRemix={canRemix}', '                    canRemix={false}', 'disable remix UI');
gui = replaceOnce(gui, '                    canShare={canShare}', '                    canShare={false}', 'disable share UI');
gui = replaceOnce(gui, '                    enableCommunity={enableCommunity}', '                    enableCommunity={false}', 'disable project-page UI');
gui = replaceOnce(gui, '                    showComingSoon={showComingSoon}', '                    showComingSoon={false}', 'disable placeholder web UI');
gui = replaceOnce(gui, '                    onClickAddonSettings={onClickAddonSettings}', '                    onClickAddonSettings={null}', 'disable addon settings UI');
gui = replaceOnce(gui, '                    onClickPackager={onClickPackager}', '                    onClickPackager={null}', 'disable packager UI');

const stageBlock = `                        <Box className={classNames(styles.stageAndTargetWrapper, styles[stageSize])}>\n                            <StageWrapper\n                                isFullScreen={isFullScreen}\n                                isRendererSupported={isRendererSupported()}\n                                isRtl={isRtl}\n                                stageSize={stageSize}\n                                vm={vm}\n                            />\n                            <Box className={styles.targetWrapper}>\n                                <TargetPane\n                                    stageSize={stageSize}\n                                    vm={vm}\n                                />\n                            </Box>\n                        </Box>`;

gui = replaceOnce(
    gui,
    stageBlock,
    `                        <ArduinoToolbar vm={vm} />`,
    'replace stage and sprite pane with Arduino controls'
);

writeFileSync(guiPath, gui);

const menuBarPath = path.join(GUI_ROOT, 'src/components/menu-bar/menu-bar.jsx');
let menuBar = readFileSync(menuBarPath, 'utf8');
menuBar = replaceOnce(
    menuBar,
    /\s*\{this\.props\.onClickAddonSettings && \(\s*<div[\s\S]*?onClick=\{this\.props\.onClickAddonSettings\}[\s\S]*?<\/div>\s*\)\}/,
    '',
    'remove Addons button'
);
menuBar = replaceOnce(
    menuBar,
    /\s*\{this\.props\.onClickSettingsModal && \(\s*<div[\s\S]*?onClick=\{this\.props\.onClickSettingsModal\}[\s\S]*?<\/div>\s*\)\}/,
    '',
    'remove inherited Advanced settings button'
);
menuBar = replaceOnce(
    menuBar,
    /\s*\{\/\* tw: add a feedback button \*\/\}[\s\S]*?<div className=\{styles\.menuBarItem\}>[\s\S]*?<\/div>/,
    '',
    'remove feedback button'
);
writeFileSync(menuBarPath, menuBar);

const toolboxPath = path.join(GUI_ROOT, 'src/lib/make-toolbox-xml.js');
let toolbox = readFileSync(toolboxPath, 'utf8');
const oldToolbox = `    const everything = [\n        xmlOpen,\n        motionXML, gap,\n        looksXML, gap,\n        soundXML, gap,\n        eventsXML, gap,\n        controlXML, gap,\n        sensingXML, gap,\n        operatorsXML, gap,\n        variablesXML, gap,\n        myBlocksXML\n    ];`;
const arduinoToolbox = `    // Arduino Web Coding: retain programming categories that make sense without sprites/stage.\n    // Hardware-specific behavior comes from the built-in Arduino category.\n    const everything = [\n        xmlOpen,\n        controlXML, gap,\n        sensingXML, gap,\n        operatorsXML, gap,\n        variablesXML, gap,\n        myBlocksXML\n    ];`;
toolbox = replaceOnce(toolbox, oldToolbox, arduinoToolbox, 'Arduino toolbox categories');
toolbox = replaceOnce(
    toolbox,
    `    if (turbowarpXML) {\n        everything.push(gap, turbowarpXML);\n    }\n`,
    '',
    'hide TurboWarp-only block category'
);
writeFileSync(toolboxPath, toolbox);

const brandPath = path.join(GUI_ROOT, 'src/lib/brand.js');
let brand = readFileSync(brandPath, 'utf8');
brand = replaceOnce(brand, "APP_NAME: 'TurboWarp'", "APP_NAME: 'Arduino Web Coding'", 'application name');
writeFileSync(brandPath, brand);

const webpackPath = path.join(GUI_ROOT, 'webpack.config.js');
let webpack = readFileSync(webpackPath, 'utf8');
webpack = replaceOnce(
    webpack,
    'title: `${APP_NAME} - Run Scratch projects faster`,\n                isEditor: true,',
    'title: APP_NAME,\n                isEditor: true,',
    'editor page title'
);
writeFileSync(webpackPath, webpack);

const playgroundPath = path.join(GUI_ROOT, 'src/playground/index.ejs');
let playground = readFileSync(playgroundPath, 'utf8');
playground = replaceOnce(
    playground,
    '<meta name="description" content="<%= htmlWebpackPlugin.options.APP_NAME %> is a Scratch mod with a compiler to run projects faster, dark mode for your eyes, a bunch of addons to improve the editor, and more." />',
    '<meta name="description" content="<%= htmlWebpackPlugin.options.APP_NAME %> is a browser-based block and Python editor for programming Arduino hardware." />',
    'page description'
);
playground = replaceOnce(
    playground,
    '<p>Consider using <a href="https://desktop.turbowarp.org/">TurboWarp Desktop</a> if you are afraid of remote JavaScript.</p>',
    '<p>This Arduino editor requires JavaScript to run in your browser.</p>',
    'noscript branding'
);
playground = replaceOnce(
    playground,
    '<div class="splash-error-title" hidden>Something went wrong. <a href="https://scratch.mit.edu/users/GarboMuffin/#comments" target="_blank" rel="noreferrer">Please report</a> with the information below.</div>',
    '<div class="splash-error-title" hidden>Arduino Web Coding could not start. Check the details below.</div>',
    'splash error branding'
);
writeFileSync(playgroundPath, playground);

const toolbarDir = path.join(GUI_ROOT, 'src/components/arduino-toolbar');
mkdirSync(toolbarDir, {recursive: true});
copyFileSync(path.join(DEV_ROOT, 'overrides/arduino-toolbar.jsx'), path.join(toolbarDir, 'arduino-toolbar.jsx'));
copyFileSync(path.join(DEV_ROOT, 'overrides/arduino-toolbar.css'), path.join(toolbarDir, 'arduino-toolbar.css'));

const pythonDir = path.join(GUI_ROOT, 'src/components/python-editor');
mkdirSync(pythonDir, {recursive: true});
copyFileSync(path.join(DEV_ROOT, 'overrides/python-editor.jsx'), path.join(pythonDir, 'python-editor.jsx'));
copyFileSync(path.join(DEV_ROOT, 'overrides/python-editor.css'), path.join(pythonDir, 'python-editor.css'));

// Build a first-party Arduino category from the checked-in extension, then augment it
// with an Arduino-start event and useful hardware helpers that map to real bridge commands.
let extension = readFileSync(path.join(DEV_ROOT, 'arduino-extension.js'), 'utf8');
extension = replaceOnce(
    extension,
    "            this.emitState();\n            return true;\n        }\n\n        async disconnect () {",
    "            this.emitState();\n            window.dispatchEvent(new CustomEvent('arduino-web-test-connected'));\n            return true;\n        }\n\n        async disconnect () {",
    'Arduino connected event'
);
extension = replaceOnce(
    extension,
    "    class ArduinoDynamicExtension {\n        getInfo () {",
    "    class ArduinoDynamicExtension {\n        constructor () {\n            this.runtime = Scratch.vm && Scratch.vm.runtime;\n            this.startArduinoProgram = () => {\n                if (this.runtime) this.runtime.startHats('arduinoDynamic_whenArduinoStarts');\n            };\n            window.addEventListener('arduino-web-test-connected', this.startArduinoProgram);\n        }\n\n        getInfo () {",
    'Arduino extension constructor'
);
extension = replaceOnce(
    extension,
    "                    {opcode: 'connectionStatus', blockType: BlockType.REPORTER, text: 'Arduino connection status'},\n                    {opcode: 'connect', blockType: BlockType.COMMAND, text: 'connect Arduino using [METHOD]', arguments: {METHOD: {type: ArgumentType.STRING, menu: 'connectionMethod'}}},\n                    {opcode: 'disconnect', blockType: BlockType.COMMAND, text: 'disconnect Arduino'},\n                    '---',\n                    {opcode: 'digitalWrite', blockType: BlockType.COMMAND, text: 'set digital [PIN] to [VALUE]', arguments: {PIN: {type: ArgumentType.STRING, menu: 'ports'}, VALUE: {type: ArgumentType.STRING, menu: 'digitalValue'}}},",
    "                    {opcode: 'whenArduinoStarts', blockType: BlockType.HAT, text: 'when Arduino starts', isEdgeActivated: false},\n                    {opcode: 'connectionStatus', blockType: BlockType.REPORTER, text: 'Arduino connection status'},\n                    {opcode: 'connect', blockType: BlockType.COMMAND, text: 'connect Arduino using [METHOD]', arguments: {METHOD: {type: ArgumentType.STRING, menu: 'connectionMethod'}}},\n                    {opcode: 'disconnect', blockType: BlockType.COMMAND, text: 'disconnect Arduino'},\n                    '---',\n                    {opcode: 'waitMilliseconds', blockType: BlockType.COMMAND, text: 'wait [MS] milliseconds', arguments: {MS: {type: ArgumentType.NUMBER, defaultValue: 100}}},\n                    {opcode: 'pinMode', blockType: BlockType.COMMAND, text: 'set pin [PIN] mode [MODE]', arguments: {PIN: {type: ArgumentType.STRING, menu: 'ports'}, MODE: {type: ArgumentType.STRING, menu: 'pinMode'}}},\n                    {opcode: 'digitalWrite', blockType: BlockType.COMMAND, text: 'set digital [PIN] to [VALUE]', arguments: {PIN: {type: ArgumentType.STRING, menu: 'ports'}, VALUE: {type: ArgumentType.STRING, menu: 'digitalValue'}}},\n                    {opcode: 'builtInLed', blockType: BlockType.COMMAND, text: 'set built-in LED to [VALUE]', arguments: {VALUE: {type: ArgumentType.STRING, menu: 'digitalValue'}}},",
    'expand Arduino event and digital blocks'
);
extension = replaceOnce(
    extension,
    "                    {opcode: 'analogRead', blockType: BlockType.REPORTER, text: 'analog [PIN]', arguments: {PIN: {type: ArgumentType.STRING, menu: 'ports'}}},\n                    '---',",
    "                    {opcode: 'analogRead', blockType: BlockType.REPORTER, text: 'analog [PIN]', arguments: {PIN: {type: ArgumentType.STRING, menu: 'ports'}}},\n                    {opcode: 'buttonPressed', blockType: BlockType.BOOLEAN, text: 'button on [PIN] pressed?', arguments: {PIN: {type: ArgumentType.STRING, menu: 'ports'}}},\n                    {opcode: 'analogPercent', blockType: BlockType.REPORTER, text: 'analog [PIN] percent', arguments: {PIN: {type: ArgumentType.STRING, menu: 'ports'}}},\n                    {opcode: 'potentiometerPercent', blockType: BlockType.REPORTER, text: 'potentiometer [PIN] percent', arguments: {PIN: {type: ArgumentType.STRING, menu: 'ports'}}},\n                    {opcode: 'lightPercent', blockType: BlockType.REPORTER, text: 'light sensor [PIN] percent', arguments: {PIN: {type: ArgumentType.STRING, menu: 'ports'}}},\n                    {opcode: 'analogAbove', blockType: BlockType.BOOLEAN, text: 'analog [PIN] above [THRESHOLD]?', arguments: {PIN: {type: ArgumentType.STRING, menu: 'ports'}, THRESHOLD: {type: ArgumentType.NUMBER, defaultValue: 512}}},\n                    {opcode: 'ledBrightness', blockType: BlockType.COMMAND, text: 'LED [PIN] brightness [PERCENT] %', arguments: {PIN: {type: ArgumentType.STRING, menu: 'ports'}, PERCENT: {type: ArgumentType.NUMBER, defaultValue: 50}}},\n                    {opcode: 'rgbLed', blockType: BlockType.COMMAND, text: 'RGB pins R [R_PIN] G [G_PIN] B [B_PIN] color R [R] G [G] B [B]', arguments: {R_PIN: {type: ArgumentType.STRING, menu: 'ports'}, G_PIN: {type: ArgumentType.STRING, menu: 'ports'}, B_PIN: {type: ArgumentType.STRING, menu: 'ports'}, R: {type: ArgumentType.NUMBER, defaultValue: 255}, G: {type: ArgumentType.NUMBER, defaultValue: 0}, B: {type: ArgumentType.NUMBER, defaultValue: 0}}},\n                    '---',\n                    {opcode: 'mapValue', blockType: BlockType.REPORTER, text: 'map [VALUE] from [FROM_LOW] to [FROM_HIGH] into [TO_LOW] to [TO_HIGH]', arguments: {VALUE: {type: ArgumentType.NUMBER, defaultValue: 512}, FROM_LOW: {type: ArgumentType.NUMBER, defaultValue: 0}, FROM_HIGH: {type: ArgumentType.NUMBER, defaultValue: 1023}, TO_LOW: {type: ArgumentType.NUMBER, defaultValue: 0}, TO_HIGH: {type: ArgumentType.NUMBER, defaultValue: 100}}},\n                    {opcode: 'constrainValue', blockType: BlockType.REPORTER, text: 'constrain [VALUE] between [LOW] and [HIGH]', arguments: {VALUE: {type: ArgumentType.NUMBER, defaultValue: 50}, LOW: {type: ArgumentType.NUMBER, defaultValue: 0}, HIGH: {type: ArgumentType.NUMBER, defaultValue: 100}}},\n                    '---',",
    'expand Arduino sensing and utility blocks'
);
extension = replaceOnce(
    extension,
    "                    {opcode: 'motor', blockType: BlockType.COMMAND, text: 'motor IN1 [IN1] IN2 [IN2] PWM [PWM] speed [SPEED] %', arguments: {IN1: {type: ArgumentType.STRING, menu: 'ports'}, IN2: {type: ArgumentType.STRING, menu: 'ports'}, PWM: {type: ArgumentType.STRING, menu: 'ports'}, SPEED: {type: ArgumentType.NUMBER, defaultValue: 50}}},\n                    '---',",
    "                    {opcode: 'motor', blockType: BlockType.COMMAND, text: 'motor IN1 [IN1] IN2 [IN2] PWM [PWM] speed [SPEED] %', arguments: {IN1: {type: ArgumentType.STRING, menu: 'ports'}, IN2: {type: ArgumentType.STRING, menu: 'ports'}, PWM: {type: ArgumentType.STRING, menu: 'ports'}, SPEED: {type: ArgumentType.NUMBER, defaultValue: 50}}},\n                    {opcode: 'stopMotor', blockType: BlockType.COMMAND, text: 'stop motor IN1 [IN1] IN2 [IN2] PWM [PWM]', arguments: {IN1: {type: ArgumentType.STRING, menu: 'ports'}, IN2: {type: ArgumentType.STRING, menu: 'ports'}, PWM: {type: ArgumentType.STRING, menu: 'ports'}}},\n                    {opcode: 'servoCenter', blockType: BlockType.COMMAND, text: 'center servo [PIN]', arguments: {PIN: {type: ArgumentType.STRING, menu: 'ports'}}},\n                    {opcode: 'beep', blockType: BlockType.COMMAND, text: 'beep buzzer [PIN] at [FREQ] Hz for [MS] ms', arguments: {PIN: {type: ArgumentType.STRING, menu: 'ports'}, FREQ: {type: ArgumentType.NUMBER, defaultValue: 880}, MS: {type: ArgumentType.NUMBER, defaultValue: 100}}},\n                    '---',",
    'expand actuator blocks'
);
extension = replaceOnce(
    extension,
    "                    connectionMethod: {acceptReporters: false, items: [{text: 'USB cable', value: 'usb'}, {text: 'Bluetooth', value: 'bluetooth'}]},\n                    digitalValue: {acceptReporters: true, items: [{text: 'HIGH', value: '1'}, {text: 'LOW', value: '0'}]},",
    "                    connectionMethod: {acceptReporters: false, items: [{text: 'USB cable', value: 'usb'}, {text: 'Bluetooth', value: 'bluetooth'}]},\n                    pinMode: {acceptReporters: true, items: [{text: 'INPUT', value: 'INPUT'}, {text: 'INPUT PULLUP', value: 'INPUT_PULLUP'}, {text: 'OUTPUT', value: 'OUTPUT'}]},\n                    digitalValue: {acceptReporters: true, items: [{text: 'HIGH', value: '1'}, {text: 'LOW', value: '0'}]},",
    'pin mode menu'
);
extension = replaceOnce(
    extension,
    "        connectionStatus () { return backend.getState().status || 'Not connected'; }\n        connect (args) { return backend.connect(String(args.METHOD || 'usb')); }\n        disconnect () { return backend.disconnect(); }\n        digitalWrite (args) { return backend.request('DWRITE', [normalizePin(args.PIN), Cast.toBoolean(args.VALUE) ? 1 : 0]); }",
    "        whenArduinoStarts () { return true; }\n        connectionStatus () { return backend.getState().status || 'Not connected'; }\n        connect (args) { return backend.connect(String(args.METHOD || 'usb')); }\n        disconnect () { return backend.disconnect(); }\n        waitMilliseconds (args) { return sleep(Math.max(0, Cast.toNumber(args.MS))); }\n        pinMode (args) { return backend.request('PINMODE', [normalizePin(args.PIN), String(args.MODE || 'INPUT')]); }\n        digitalWrite (args) { return backend.request('DWRITE', [normalizePin(args.PIN), Cast.toBoolean(args.VALUE) ? 1 : 0]); }\n        builtInLed (args) { return backend.request('DWRITE', ['13', Cast.toBoolean(args.VALUE) ? 1 : 0]); }",
    'Arduino event and digital methods'
);
extension = replaceOnce(
    extension,
    "        async analogRead (args) { return Number(await backend.request('AREAD', [normalizePin(args.PIN)])); }\n        servoWrite (args) {",
    "        async analogRead (args) { return Number(await backend.request('AREAD', [normalizePin(args.PIN)])); }\n        async buttonPressed (args) { return Number(await backend.request('DREAD', [normalizePin(args.PIN)])) !== 0; }\n        async analogPercent (args) { return Math.round(Number(await backend.request('AREAD', [normalizePin(args.PIN)])) / 1023 * 1000) / 10; }\n        potentiometerPercent (args) { return this.analogPercent(args); }\n        lightPercent (args) { return this.analogPercent(args); }\n        async analogAbove (args) { return Number(await backend.request('AREAD', [normalizePin(args.PIN)])) > Cast.toNumber(args.THRESHOLD); }\n        ledBrightness (args) { return backend.request('PWM', [normalizePin(args.PIN), Math.round(Math.max(0, Math.min(100, Cast.toNumber(args.PERCENT))) * 2.55)]); }\n        async rgbLed (args) {\n            await backend.request('PWM', [normalizePin(args.R_PIN), Math.max(0, Math.min(255, Cast.toNumber(args.R)))]);\n            await backend.request('PWM', [normalizePin(args.G_PIN), Math.max(0, Math.min(255, Cast.toNumber(args.G)))]);\n            return backend.request('PWM', [normalizePin(args.B_PIN), Math.max(0, Math.min(255, Cast.toNumber(args.B)))]);\n        }\n        mapValue (args) {\n            const value = Cast.toNumber(args.VALUE);\n            const fromLow = Cast.toNumber(args.FROM_LOW);\n            const fromHigh = Cast.toNumber(args.FROM_HIGH);\n            const toLow = Cast.toNumber(args.TO_LOW);\n            const toHigh = Cast.toNumber(args.TO_HIGH);\n            if (fromHigh === fromLow) return toLow;\n            return toLow + ((value - fromLow) * (toHigh - toLow)) / (fromHigh - fromLow);\n        }\n        constrainValue (args) {\n            const low = Math.min(Cast.toNumber(args.LOW), Cast.toNumber(args.HIGH));\n            const high = Math.max(Cast.toNumber(args.LOW), Cast.toNumber(args.HIGH));\n            return Math.max(low, Math.min(high, Cast.toNumber(args.VALUE)));\n        }\n        servoWrite (args) {",
    'Arduino sensor and utility methods'
);
extension = replaceOnce(
    extension,
    "        motor (args) { return backend.request('MOTOR', [normalizePin(args.IN1), normalizePin(args.IN2), normalizePin(args.PWM), Math.max(-100, Math.min(100, Cast.toNumber(args.SPEED)))]); }\n        async ultrasonic (args) {",
    "        motor (args) { return backend.request('MOTOR', [normalizePin(args.IN1), normalizePin(args.IN2), normalizePin(args.PWM), Math.max(-100, Math.min(100, Cast.toNumber(args.SPEED)))]); }\n        stopMotor (args) { return backend.request('MOTOR', [normalizePin(args.IN1), normalizePin(args.IN2), normalizePin(args.PWM), 0]); }\n        servoCenter (args) { return backend.request('SERVO', [normalizePin(args.PIN), 90, 544, 2400]); }\n        beep (args) { return backend.request('TONE', [normalizePin(args.PIN), Cast.toNumber(args.FREQ), Cast.toNumber(args.MS)]); }\n        async ultrasonic (args) {",
    'Arduino actuator helper methods'
);

const extensionDir = path.join(GUI_ROOT, 'static/arduino');
mkdirSync(extensionDir, {recursive: true});
writeFileSync(path.join(extensionDir, 'arduino-extension.js'), extension);

console.log('Applied Arduino Web Coding patches to TurboWarp engine.');
