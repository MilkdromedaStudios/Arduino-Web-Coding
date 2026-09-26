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
    "import MenuBar from '../menu-bar/menu-bar.jsx';\nimport ArduinoToolbar from '../arduino-toolbar/arduino-toolbar.jsx';",
    'Arduino toolbar import'
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
    `<TabList className={tabClassNames.tabList}>\n                                    <Tab className={tabClassNames.tab}>\n                                        <img\n                                            draggable={false}\n                                            src={codeIcon()}\n                                        />\n                                        <FormattedMessage\n                                            defaultMessage="Code"\n                                            description="Button to get to the code panel"\n                                            id="gui.gui.codeTab"\n                                        />\n                                    </Tab>\n                                </TabList>`,
    'remove costume/backdrop/sound tabs'
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

const stageBlock = `                        <Box className={classNames(styles.stageAndTargetWrapper, styles[stageSize])}>\n                            <StageWrapper\n                                isFullScreen={isFullScreen}\n                                isRendererSupported={isRendererSupported()}\n                                isRtl={isRtl}\n                                stageSize={stageSize}\n                                vm={vm}\n                            />\n                            <Box className={styles.targetWrapper}>\n                                <TargetPane\n                                    stageSize={stageSize}\n                                    vm={vm}\n                                />\n                            </Box>\n                        </Box>`;

gui = replaceOnce(
    gui,
    stageBlock,
    `                        <ArduinoToolbar vm={vm} />`,
    'replace stage and sprite pane with Arduino controls'
);

writeFileSync(guiPath, gui);

const toolboxPath = path.join(GUI_ROOT, 'src/lib/make-toolbox-xml.js');
let toolbox = readFileSync(toolboxPath, 'utf8');
const oldToolbox = `    const everything = [\n        xmlOpen,\n        motionXML, gap,\n        looksXML, gap,\n        soundXML, gap,\n        eventsXML, gap,\n        controlXML, gap,\n        sensingXML, gap,\n        operatorsXML, gap,\n        variablesXML, gap,\n        myBlocksXML\n    ];`;
const arduinoToolbox = `    // Arduino web test: keep only general programming categories.\n    // Hardware behavior comes from the automatically loaded Arduino extension.\n    const everything = [\n        xmlOpen,\n        controlXML, gap,\n        operatorsXML, gap,\n        variablesXML, gap,\n        myBlocksXML\n    ];`;
toolbox = replaceOnce(toolbox, oldToolbox, arduinoToolbox, 'Arduino-only toolbox');
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
    '<meta name="description" content="<%= htmlWebpackPlugin.options.APP_NAME %> is a browser-based block editor for programming Arduino hardware." />',
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

const extensionDir = path.join(GUI_ROOT, 'static/arduino');
mkdirSync(extensionDir, {recursive: true});
copyFileSync(path.join(DEV_ROOT, 'arduino-extension.js'), path.join(extensionDir, 'arduino-extension.js'));

console.log('Applied Arduino Web Coding patches to TurboWarp engine.');
