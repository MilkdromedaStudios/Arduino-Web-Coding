const listeners = new Set();
let workspace = null;
let ScratchBlocks = null;
let vm = null;
let detachWorkspaceListener = null;
let suppressWorkspaceEvents = false;
let pendingEmit = null;
let lastPython = '';

const escapeXml = value => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const quote = value => JSON.stringify(String(value));

const notify = (code, status = 'Synced') => {
    lastPython = code;
    listeners.forEach(listener => listener({code, status}));
};

const getTargetBlock = (block, inputName) => {
    if (!block || !block.getInputTargetBlock) return null;
    return block.getInputTargetBlock(inputName);
};

const fieldValue = (block, name) => {
    if (!block || !block.getFieldValue) return '';
    const value = block.getFieldValue(name);
    return value === null || typeof value === 'undefined' ? '' : value;
};

const expressionFromBlock = block => {
    if (!block) return '0';
    switch (block.type) {
    case 'math_number':
    case 'math_integer':
    case 'math_whole_number':
    case 'math_positive_number':
        return String(fieldValue(block, 'NUM') || 0);
    case 'text':
        return quote(fieldValue(block, 'TEXT'));
    case 'logic_boolean':
        return fieldValue(block, 'BOOL') === 'TRUE' ? 'True' : 'False';
    case 'operator_add':
        return `(${expressionFromBlock(getTargetBlock(block, 'NUM1'))} + ${expressionFromBlock(getTargetBlock(block, 'NUM2'))})`;
    case 'operator_subtract':
        return `(${expressionFromBlock(getTargetBlock(block, 'NUM1'))} - ${expressionFromBlock(getTargetBlock(block, 'NUM2'))})`;
    case 'operator_multiply':
        return `(${expressionFromBlock(getTargetBlock(block, 'NUM1'))} * ${expressionFromBlock(getTargetBlock(block, 'NUM2'))})`;
    case 'operator_divide':
        return `(${expressionFromBlock(getTargetBlock(block, 'NUM1'))} / ${expressionFromBlock(getTargetBlock(block, 'NUM2'))})`;
    case 'operator_mod':
        return `(${expressionFromBlock(getTargetBlock(block, 'NUM1'))} % ${expressionFromBlock(getTargetBlock(block, 'NUM2'))})`;
    case 'operator_lt':
        return `(${expressionFromBlock(getTargetBlock(block, 'OPERAND1'))} < ${expressionFromBlock(getTargetBlock(block, 'OPERAND2'))})`;
    case 'operator_gt':
        return `(${expressionFromBlock(getTargetBlock(block, 'OPERAND1'))} > ${expressionFromBlock(getTargetBlock(block, 'OPERAND2'))})`;
    case 'operator_equals':
        return `(${expressionFromBlock(getTargetBlock(block, 'OPERAND1'))} == ${expressionFromBlock(getTargetBlock(block, 'OPERAND2'))})`;
    case 'operator_and':
        return `(${expressionFromBlock(getTargetBlock(block, 'OPERAND1'))} and ${expressionFromBlock(getTargetBlock(block, 'OPERAND2'))})`;
    case 'operator_or':
        return `(${expressionFromBlock(getTargetBlock(block, 'OPERAND1'))} or ${expressionFromBlock(getTargetBlock(block, 'OPERAND2'))})`;
    case 'operator_not':
        return `(not ${expressionFromBlock(getTargetBlock(block, 'OPERAND'))})`;
    case 'operator_round':
        return `round(${expressionFromBlock(getTargetBlock(block, 'NUM'))})`;
    case 'arduinoDynamic_digitalRead':
        return `digital_read(${expressionFromBlock(getTargetBlock(block, 'PIN'))})`;
    case 'arduinoDynamic_analogRead':
        return `analog_read(${expressionFromBlock(getTargetBlock(block, 'PIN'))})`;
    case 'arduinoDynamic_buttonPressed':
        return `button_pressed(${expressionFromBlock(getTargetBlock(block, 'PIN'))})`;
    case 'arduinoDynamic_analogPercent':
        return `analog_percent(${expressionFromBlock(getTargetBlock(block, 'PIN'))})`;
    case 'arduinoDynamic_potentiometerPercent':
        return `potentiometer_percent(${expressionFromBlock(getTargetBlock(block, 'PIN'))})`;
    case 'arduinoDynamic_lightPercent':
        return `light_percent(${expressionFromBlock(getTargetBlock(block, 'PIN'))})`;
    case 'arduinoDynamic_analogAbove':
        return `analog_above(${expressionFromBlock(getTargetBlock(block, 'PIN'))}, ${expressionFromBlock(getTargetBlock(block, 'THRESHOLD'))})`;
    case 'arduinoDynamic_ultrasonic':
        return `ultrasonic_cm(${expressionFromBlock(getTargetBlock(block, 'TRIG'))}, ${expressionFromBlock(getTargetBlock(block, 'ECHO'))}, ${expressionFromBlock(getTargetBlock(block, 'MAX'))})`;
    case 'arduinoDynamic_touch':
        return `touch_pressed(${expressionFromBlock(getTargetBlock(block, 'PIN'))}, ${expressionFromBlock(getTargetBlock(block, 'THRESHOLD'))})`;
    case 'arduinoDynamic_amplifier':
        return `microphone_level(${expressionFromBlock(getTargetBlock(block, 'PIN'))}, ${expressionFromBlock(getTargetBlock(block, 'SAMPLES'))})`;
    case 'arduinoDynamic_mapValue':
        return `map_value(${expressionFromBlock(getTargetBlock(block, 'VALUE'))}, ${expressionFromBlock(getTargetBlock(block, 'FROMLOW'))}, ${expressionFromBlock(getTargetBlock(block, 'FROMHIGH'))}, ${expressionFromBlock(getTargetBlock(block, 'TOLOW'))}, ${expressionFromBlock(getTargetBlock(block, 'TOHIGH'))})`;
    case 'arduinoDynamic_constrainValue':
        return `constrain(${expressionFromBlock(getTargetBlock(block, 'VALUE'))}, ${expressionFromBlock(getTargetBlock(block, 'LOW'))}, ${expressionFromBlock(getTargetBlock(block, 'HIGH'))})`;
    default:
        return `unsupported(${quote(block.type)})`;
    }
};

const indentLines = (lines, indent) => lines.map(line => `${' '.repeat(indent)}${line}`);

const statementLines = (block, indent = 4) => {
    if (!block) return [];
    const value = name => expressionFromBlock(getTargetBlock(block, name));
    let lines;
    switch (block.type) {
    case 'arduinoDynamic_waitMilliseconds':
        lines = [`wait_ms(${value('MS')})`];
        break;
    case 'arduinoDynamic_pinMode':
        lines = [`pin_mode(${value('PIN')}, ${value('MODE')})`];
        break;
    case 'arduinoDynamic_digitalWrite':
        lines = [`digital_write(${value('PIN')}, ${value('VALUE')})`];
        break;
    case 'arduinoDynamic_builtInLed':
        lines = [`built_in_led(${value('VALUE')})`];
        break;
    case 'arduinoDynamic_analogWrite':
        lines = [`pwm_write(${value('PIN')}, ${value('VALUE')})`];
        break;
    case 'arduinoDynamic_ledBrightness':
        lines = [`led_brightness(${value('PIN')}, ${value('PERCENT')})`];
        break;
    case 'arduinoDynamic_rgbLed':
        lines = [`rgb_led(${value('R')}, ${value('G')}, ${value('B')}, ${value('RV')}, ${value('GV')}, ${value('BV')})`];
        break;
    case 'arduinoDynamic_servoWrite':
        lines = [`servo_write(${value('PIN')}, ${value('ANGLE')}, ${value('MIN')}, ${value('MAX')})`];
        break;
    case 'arduinoDynamic_centerServo':
        lines = [`servo_center(${value('PIN')})`];
        break;
    case 'arduinoDynamic_servoDetach':
        lines = [`servo_detach(${value('PIN')})`];
        break;
    case 'arduinoDynamic_tone':
        lines = [`tone(${value('PIN')}, ${value('FREQ')}, ${value('MS')})`];
        break;
    case 'arduinoDynamic_noTone':
        lines = [`stop_tone(${value('PIN')})`];
        break;
    case 'arduinoDynamic_beep':
        lines = [`beep(${value('PIN')}, ${value('FREQ')}, ${value('MS')})`];
        break;
    case 'arduinoDynamic_motor':
        lines = [`motor(${value('IN1')}, ${value('IN2')}, ${value('PWM')}, ${value('SPEED')})`];
        break;
    case 'arduinoDynamic_stopMotor':
        lines = [`stop_motor(${value('IN1')}, ${value('IN2')}, ${value('PWM')})`];
        break;
    case 'arduinoDynamic_i2cWrite':
        lines = [`i2c_write(${value('ADDRESS')}, ${value('REGISTER')}, ${value('DATA')})`];
        break;
    case 'arduinoDynamic_definePort':
        lines = [`define_port(${value('ALIAS')}, ${value('PHYSICAL')})`];
        break;
    case 'control_wait':
        lines = [`wait_seconds(${value('DURATION')})`];
        break;
    case 'control_repeat': {
        const body = stackLines(getTargetBlock(block, 'SUBSTACK'), indent + 4);
        lines = [`for _ in range(${value('TIMES')}):`, ...(body.length ? body : [`${' '.repeat(4)}pass`])];
        break;
    }
    case 'control_forever': {
        const body = stackLines(getTargetBlock(block, 'SUBSTACK'), indent + 4);
        lines = ['while True:', ...(body.length ? body : [`${' '.repeat(4)}pass`])];
        break;
    }
    case 'control_if': {
        const body = stackLines(getTargetBlock(block, 'SUBSTACK'), indent + 4);
        lines = [`if ${value('CONDITION')}:`, ...(body.length ? body : [`${' '.repeat(4)}pass`])];
        break;
    }
    case 'control_if_else': {
        const body = stackLines(getTargetBlock(block, 'SUBSTACK'), indent + 4);
        const other = stackLines(getTargetBlock(block, 'SUBSTACK2'), indent + 4);
        lines = [`if ${value('CONDITION')}:`, ...(body.length ? body : [`${' '.repeat(4)}pass`]), 'else:', ...(other.length ? other : [`${' '.repeat(4)}pass`])];
        break;
    }
    default:
        lines = [`# Unsupported block: ${block.type}`];
    }
    return indentLines(lines, indent);
};

const stackLines = (firstBlock, indent = 4) => {
    const lines = [];
    let block = firstBlock;
    const seen = new Set();
    while (block && !seen.has(block.id)) {
        seen.add(block.id);
        lines.push(...statementLines(block, indent));
        block = block.getNextBlock ? block.getNextBlock() : null;
    }
    return lines;
};

const pythonFromWorkspace = () => {
    if (!workspace) return '';
    const tops = workspace.getTopBlocks ? workspace.getTopBlocks(true) : [];
    const start = tops.find(block => block.type === 'arduinoDynamic_whenArduinoStarts');
    if (!start) {
        const meaningful = tops.filter(block => block.type && !block.type.startsWith('procedures_'));
        if (!meaningful.length) return '';
        const loose = meaningful.flatMap(block => stackLines(block, 0));
        return loose.join('\n');
    }
    const body = stackLines(start.getNextBlock ? start.getNextBlock() : null, 4);
    return ['def arduino_start():', ...(body.length ? body : ['    pass'])].join('\n');
};

const shadowXml = value => {
    const trimmed = String(value).trim();
    if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) {
        return `<shadow type="math_number"><field name="NUM">${escapeXml(trimmed)}</field></shadow>`;
    }
    let text = trimmed;
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
        try {
            text = text.startsWith('"') ? JSON.parse(text) : text.slice(1, -1);
        } catch (e) {
            text = text.slice(1, -1);
        }
    }
    return `<shadow type="text"><field name="TEXT">${escapeXml(text)}</field></shadow>`;
};

const splitArgs = source => {
    const result = [];
    let current = '';
    let depth = 0;
    let quoteChar = null;
    for (let i = 0; i < source.length; i++) {
        const char = source[i];
        if (quoteChar) {
            current += char;
            if (char === quoteChar && source[i - 1] !== '\\') quoteChar = null;
            continue;
        }
        if (char === '"' || char === "'") {
            quoteChar = char;
            current += char;
            continue;
        }
        if (char === '(') depth++;
        if (char === ')') depth--;
        if (char === ',' && depth === 0) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    if (current.trim() || source.trim() === '') result.push(current.trim());
    return result;
};

const reporterXml = expression => {
    const text = expression.trim().replace(/^\((.*)\)$/s, '$1').trim();
    const call = text.match(/^([A-Za-z_][A-Za-z0-9_]*)\((.*)\)$/s);
    if (call) {
        const args = splitArgs(call[2]);
        const reporterMap = {
            digital_read: ['arduinoDynamic_digitalRead', ['PIN']],
            analog_read: ['arduinoDynamic_analogRead', ['PIN']],
            button_pressed: ['arduinoDynamic_buttonPressed', ['PIN']],
            analog_percent: ['arduinoDynamic_analogPercent', ['PIN']],
            potentiometer_percent: ['arduinoDynamic_potentiometerPercent', ['PIN']],
            light_percent: ['arduinoDynamic_lightPercent', ['PIN']],
            analog_above: ['arduinoDynamic_analogAbove', ['PIN', 'THRESHOLD']],
            ultrasonic_cm: ['arduinoDynamic_ultrasonic', ['TRIG', 'ECHO', 'MAX']],
            touch_pressed: ['arduinoDynamic_touch', ['PIN', 'THRESHOLD']],
            microphone_level: ['arduinoDynamic_amplifier', ['PIN', 'SAMPLES']],
            map_value: ['arduinoDynamic_mapValue', ['VALUE', 'FROMLOW', 'FROMHIGH', 'TOLOW', 'TOHIGH']],
            constrain: ['arduinoDynamic_constrainValue', ['VALUE', 'LOW', 'HIGH']]
        };
        if (reporterMap[call[1]]) {
            const [type, names] = reporterMap[call[1]];
            const values = names.map((name, index) => `<value name="${name}">${reporterXml(args[index] || '0')}</value>`).join('');
            return `<block type="${type}">${values}</block>`;
        }
    }
    const binary = [
        [' or ', 'operator_or', 'OPERAND1', 'OPERAND2'],
        [' and ', 'operator_and', 'OPERAND1', 'OPERAND2'],
        [' == ', 'operator_equals', 'OPERAND1', 'OPERAND2'],
        [' > ', 'operator_gt', 'OPERAND1', 'OPERAND2'],
        [' < ', 'operator_lt', 'OPERAND1', 'OPERAND2'],
        [' + ', 'operator_add', 'NUM1', 'NUM2'],
        [' - ', 'operator_subtract', 'NUM1', 'NUM2'],
        [' * ', 'operator_multiply', 'NUM1', 'NUM2'],
        [' / ', 'operator_divide', 'NUM1', 'NUM2'],
        [' % ', 'operator_mod', 'NUM1', 'NUM2']
    ];
    for (const [token, type, leftName, rightName] of binary) {
        const index = text.indexOf(token);
        if (index > 0) {
            const left = text.slice(0, index);
            const right = text.slice(index + token.length);
            return `<block type="${type}"><value name="${leftName}">${reporterXml(left)}</value><value name="${rightName}">${reporterXml(right)}</value></block>`;
        }
    }
    if (text.startsWith('not ')) {
        return `<block type="operator_not"><value name="OPERAND">${reporterXml(text.slice(4))}</value></block>`;
    }
    return shadowXml(text);
};

const commandXml = (type, names, args) => {
    const values = names.map((name, index) => `<value name="${name}">${reporterXml(args[index] || '0')}</value>`).join('');
    return `<block type="${type}">${values}</block>`;
};

const parseSimpleStatement = line => {
    if (line === 'pass') return null;
    const call = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\((.*)\)$/s);
    if (!call) throw new Error(`Unsupported Python statement: ${line}`);
    const args = splitArgs(call[2]);
    const commands = {
        wait_ms: ['arduinoDynamic_waitMilliseconds', ['MS']],
        wait_seconds: ['control_wait', ['DURATION']],
        pin_mode: ['arduinoDynamic_pinMode', ['PIN', 'MODE']],
        digital_write: ['arduinoDynamic_digitalWrite', ['PIN', 'VALUE']],
        built_in_led: ['arduinoDynamic_builtInLed', ['VALUE']],
        pwm_write: ['arduinoDynamic_analogWrite', ['PIN', 'VALUE']],
        led_brightness: ['arduinoDynamic_ledBrightness', ['PIN', 'PERCENT']],
        rgb_led: ['arduinoDynamic_rgbLed', ['R', 'G', 'B', 'RV', 'GV', 'BV']],
        servo_write: ['arduinoDynamic_servoWrite', ['PIN', 'ANGLE', 'MIN', 'MAX']],
        servo_center: ['arduinoDynamic_centerServo', ['PIN']],
        servo_detach: ['arduinoDynamic_servoDetach', ['PIN']],
        tone: ['arduinoDynamic_tone', ['PIN', 'FREQ', 'MS']],
        stop_tone: ['arduinoDynamic_noTone', ['PIN']],
        beep: ['arduinoDynamic_beep', ['PIN', 'FREQ', 'MS']],
        motor: ['arduinoDynamic_motor', ['IN1', 'IN2', 'PWM', 'SPEED']],
        stop_motor: ['arduinoDynamic_stopMotor', ['IN1', 'IN2', 'PWM']],
        i2c_write: ['arduinoDynamic_i2cWrite', ['ADDRESS', 'REGISTER', 'DATA']],
        define_port: ['arduinoDynamic_definePort', ['ALIAS', 'PHYSICAL']]
    };
    if (!commands[call[1]]) throw new Error(`Unsupported Arduino Python function: ${call[1]}`);
    const [type, names] = commands[call[1]];
    return commandXml(type, names, args);
};

const lineIndent = line => {
    const match = line.match(/^ */);
    return match ? match[0].length : 0;
};

const parseSuite = (lines, start, indent) => {
    const nodes = [];
    let index = start;
    while (index < lines.length) {
        const raw = lines[index];
        if (!raw.trim() || raw.trim().startsWith('#')) {
            index++;
            continue;
        }
        const currentIndent = lineIndent(raw);
        if (currentIndent < indent) break;
        if (currentIndent > indent) throw new Error(`Unexpected indentation on line ${index + 1}`);
        const line = raw.trim();
        if (line === 'else:') break;
        if (line === 'while True:') {
            const child = parseSuite(lines, index + 1, indent + 4);
            nodes.push({kind: 'forever', children: child.nodes});
            index = child.index;
            continue;
        }
        const repeat = line.match(/^for\s+_\s+in\s+range\((.*)\):$/);
        if (repeat) {
            const child = parseSuite(lines, index + 1, indent + 4);
            nodes.push({kind: 'repeat', times: repeat[1], children: child.nodes});
            index = child.index;
            continue;
        }
        const ifMatch = line.match(/^if\s+(.+):$/);
        if (ifMatch) {
            const child = parseSuite(lines, index + 1, indent + 4);
            index = child.index;
            let otherwise = [];
            if (index < lines.length && lineIndent(lines[index]) === indent && lines[index].trim() === 'else:') {
                const other = parseSuite(lines, index + 1, indent + 4);
                otherwise = other.nodes;
                index = other.index;
            }
            nodes.push({kind: otherwise.length ? 'ifelse' : 'if', condition: ifMatch[1], children: child.nodes, otherwise});
            continue;
        }
        nodes.push({kind: 'simple', xml: parseSimpleStatement(line)});
        index++;
    }
    return {nodes, index};
};

const chainXml = nodes => {
    const usable = nodes.filter(node => !(node.kind === 'simple' && !node.xml));
    const buildAt = index => {
        if (index >= usable.length) return '';
        const node = usable[index];
        let xml = '';
        if (node.kind === 'simple') {
            xml = node.xml;
        } else if (node.kind === 'repeat') {
            xml = `<block type="control_repeat"><value name="TIMES">${reporterXml(node.times)}</value><statement name="SUBSTACK">${chainXml(node.children)}</statement></block>`;
        } else if (node.kind === 'forever') {
            xml = `<block type="control_forever"><statement name="SUBSTACK">${chainXml(node.children)}</statement></block>`;
        } else if (node.kind === 'if') {
            xml = `<block type="control_if"><value name="CONDITION">${reporterXml(node.condition)}</value><statement name="SUBSTACK">${chainXml(node.children)}</statement></block>`;
        } else if (node.kind === 'ifelse') {
            xml = `<block type="control_if_else"><value name="CONDITION">${reporterXml(node.condition)}</value><statement name="SUBSTACK">${chainXml(node.children)}</statement><statement name="SUBSTACK2">${chainXml(node.otherwise)}</statement></block>`;
        }
        if (!xml) return buildAt(index + 1);
        const next = buildAt(index + 1);
        if (!next) return xml;
        return xml.replace(/<\/block>$/, `<next>${next}</next></block>`);
    };
    return buildAt(0);
};

const xmlFromPython = code => {
    const rawLines = String(code).replace(/\t/g, '    ').split(/\r?\n/);
    const lines = rawLines.filter((line, index) => !(index === 0 && line.trim() === ''));
    let bodyStart = 0;
    let bodyIndent = 0;
    if (lines.length && lines[0].trim() === 'def arduino_start():') {
        bodyStart = 1;
        bodyIndent = 4;
    }
    const parsed = parseSuite(lines, bodyStart, bodyIndent);
    const body = chainXml(parsed.nodes);
    if (parsed.index < lines.length) {
        const remaining = lines.slice(parsed.index).find(line => line.trim() && !line.trim().startsWith('#'));
        if (remaining) throw new Error(`Unsupported Python near: ${remaining.trim()}`);
    }
    if (!body && !String(code).trim()) return '<xml xmlns="https://developers.google.com/blockly/xml"></xml>';
    return `<xml xmlns="https://developers.google.com/blockly/xml"><block type="arduinoDynamic_whenArduinoStarts" x="72" y="72">${body ? `<next>${body}</next>` : ''}</block></xml>`;
};

const scheduleEmit = () => {
    clearTimeout(pendingEmit);
    pendingEmit = setTimeout(() => {
        pendingEmit = null;
        if (!suppressWorkspaceEvents) notify(pythonFromWorkspace());
    }, 80);
};

export const attachArduinoPythonSync = (newWorkspace, newScratchBlocks, newVm) => {
    if (detachWorkspaceListener) detachWorkspaceListener();
    workspace = newWorkspace;
    ScratchBlocks = newScratchBlocks;
    vm = newVm;
    const listener = event => {
        if (suppressWorkspaceEvents) return;
        if (event && (event.isUiEvent || event.type === 'ui')) return;
        scheduleEmit();
    };
    workspace.addChangeListener(listener);
    detachWorkspaceListener = () => {
        if (workspace) workspace.removeChangeListener(listener);
        detachWorkspaceListener = null;
    };
    scheduleEmit();
    return () => {
        if (detachWorkspaceListener) detachWorkspaceListener();
        workspace = null;
        ScratchBlocks = null;
        vm = null;
    };
};

export const subscribeArduinoPython = listener => {
    listeners.add(listener);
    listener({code: lastPython || pythonFromWorkspace(), status: 'Synced'});
    return () => listeners.delete(listener);
};

export const getArduinoPython = () => lastPython || pythonFromWorkspace();

export const setArduinoPython = code => {
    if (!workspace || !ScratchBlocks) throw new Error('Blocks workspace is not ready yet.');
    const xmlText = xmlFromPython(code);
    const dom = ScratchBlocks.Xml.textToDom(xmlText);
    suppressWorkspaceEvents = true;
    try {
        ScratchBlocks.Xml.clearWorkspaceAndLoadFromXml(dom, workspace);
    } finally {
        suppressWorkspaceEvents = false;
    }
    if (vm && vm.refreshWorkspace) vm.refreshWorkspace();
    const normalized = pythonFromWorkspace();
    notify(normalized, 'Synced');
    return normalized;
};
