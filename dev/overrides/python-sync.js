const listeners = new Set();
let workspace = null;
let ScratchBlocks = null;
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
const spaces = count => ' '.repeat(count);

const notify = (code, status = 'Synced') => {
    lastPython = code;
    listeners.forEach(listener => listener({code, status}));
};

const target = (block, name) => block && block.getInputTargetBlock ? block.getInputTargetBlock(name) : null;
const field = (block, name) => {
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
        return String(field(block, 'NUM') || 0);
    case 'text':
        return quote(field(block, 'TEXT'));
    case 'operator_add': return `(${expressionFromBlock(target(block, 'NUM1'))} + ${expressionFromBlock(target(block, 'NUM2'))})`;
    case 'operator_subtract': return `(${expressionFromBlock(target(block, 'NUM1'))} - ${expressionFromBlock(target(block, 'NUM2'))})`;
    case 'operator_multiply': return `(${expressionFromBlock(target(block, 'NUM1'))} * ${expressionFromBlock(target(block, 'NUM2'))})`;
    case 'operator_divide': return `(${expressionFromBlock(target(block, 'NUM1'))} / ${expressionFromBlock(target(block, 'NUM2'))})`;
    case 'operator_mod': return `(${expressionFromBlock(target(block, 'NUM1'))} % ${expressionFromBlock(target(block, 'NUM2'))})`;
    case 'operator_lt': return `(${expressionFromBlock(target(block, 'OPERAND1'))} < ${expressionFromBlock(target(block, 'OPERAND2'))})`;
    case 'operator_gt': return `(${expressionFromBlock(target(block, 'OPERAND1'))} > ${expressionFromBlock(target(block, 'OPERAND2'))})`;
    case 'operator_equals': return `(${expressionFromBlock(target(block, 'OPERAND1'))} == ${expressionFromBlock(target(block, 'OPERAND2'))})`;
    case 'operator_and': return `(${expressionFromBlock(target(block, 'OPERAND1'))} and ${expressionFromBlock(target(block, 'OPERAND2'))})`;
    case 'operator_or': return `(${expressionFromBlock(target(block, 'OPERAND1'))} or ${expressionFromBlock(target(block, 'OPERAND2'))})`;
    case 'operator_not': return `(not ${expressionFromBlock(target(block, 'OPERAND'))})`;
    case 'operator_round': return `round(${expressionFromBlock(target(block, 'NUM'))})`;
    case 'arduinoDynamic_digitalRead': return `digital_read(${expressionFromBlock(target(block, 'PIN'))})`;
    case 'arduinoDynamic_analogRead': return `analog_read(${expressionFromBlock(target(block, 'PIN'))})`;
    case 'arduinoDynamic_buttonPressed': return `button_pressed(${expressionFromBlock(target(block, 'PIN'))})`;
    case 'arduinoDynamic_analogPercent': return `analog_percent(${expressionFromBlock(target(block, 'PIN'))})`;
    case 'arduinoDynamic_potentiometerPercent': return `potentiometer_percent(${expressionFromBlock(target(block, 'PIN'))})`;
    case 'arduinoDynamic_lightPercent': return `light_percent(${expressionFromBlock(target(block, 'PIN'))})`;
    case 'arduinoDynamic_analogAbove': return `analog_above(${expressionFromBlock(target(block, 'PIN'))}, ${expressionFromBlock(target(block, 'THRESHOLD'))})`;
    case 'arduinoDynamic_ultrasonic': return `ultrasonic_cm(${expressionFromBlock(target(block, 'TRIG'))}, ${expressionFromBlock(target(block, 'ECHO'))}, ${expressionFromBlock(target(block, 'MAX'))})`;
    case 'arduinoDynamic_touch': return `touch_pressed(${expressionFromBlock(target(block, 'PIN'))}, ${expressionFromBlock(target(block, 'THRESHOLD'))})`;
    case 'arduinoDynamic_amplifier': return `microphone_level(${expressionFromBlock(target(block, 'PIN'))}, ${expressionFromBlock(target(block, 'SAMPLES'))})`;
    case 'arduinoDynamic_mapValue': return `map_value(${expressionFromBlock(target(block, 'VALUE'))}, ${expressionFromBlock(target(block, 'FROM_LOW'))}, ${expressionFromBlock(target(block, 'FROM_HIGH'))}, ${expressionFromBlock(target(block, 'TO_LOW'))}, ${expressionFromBlock(target(block, 'TO_HIGH'))})`;
    case 'arduinoDynamic_constrainValue': return `constrain(${expressionFromBlock(target(block, 'VALUE'))}, ${expressionFromBlock(target(block, 'LOW'))}, ${expressionFromBlock(target(block, 'HIGH'))})`;
    default: return `unsupported(${quote(block.type)})`;
    }
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

const statementLines = (block, indent = 4) => {
    if (!block) return [];
    const value = name => expressionFromBlock(target(block, name));
    const prefix = spaces(indent);
    switch (block.type) {
    case 'arduinoDynamic_waitMilliseconds': return [`${prefix}wait_ms(${value('MS')})`];
    case 'arduinoDynamic_pinMode': return [`${prefix}pin_mode(${value('PIN')}, ${value('MODE')})`];
    case 'arduinoDynamic_digitalWrite': return [`${prefix}digital_write(${value('PIN')}, ${value('VALUE')})`];
    case 'arduinoDynamic_builtInLed': return [`${prefix}built_in_led(${value('VALUE')})`];
    case 'arduinoDynamic_analogWrite': return [`${prefix}pwm_write(${value('PIN')}, ${value('VALUE')})`];
    case 'arduinoDynamic_ledBrightness': return [`${prefix}led_brightness(${value('PIN')}, ${value('PERCENT')})`];
    case 'arduinoDynamic_rgbLed': return [`${prefix}rgb_led(${value('R_PIN')}, ${value('G_PIN')}, ${value('B_PIN')}, ${value('R')}, ${value('G')}, ${value('B')})`];
    case 'arduinoDynamic_servoWrite': return [`${prefix}servo_write(${value('PIN')}, ${value('ANGLE')}, ${value('MIN')}, ${value('MAX')})`];
    case 'arduinoDynamic_servoCenter': return [`${prefix}servo_center(${value('PIN')})`];
    case 'arduinoDynamic_servoDetach': return [`${prefix}servo_detach(${value('PIN')})`];
    case 'arduinoDynamic_tone': return [`${prefix}tone(${value('PIN')}, ${value('FREQ')}, ${value('MS')})`];
    case 'arduinoDynamic_noTone': return [`${prefix}stop_tone(${value('PIN')})`];
    case 'arduinoDynamic_beep': return [`${prefix}beep(${value('PIN')}, ${value('FREQ')}, ${value('MS')})`];
    case 'arduinoDynamic_motor': return [`${prefix}motor(${value('IN1')}, ${value('IN2')}, ${value('PWM')}, ${value('SPEED')})`];
    case 'arduinoDynamic_stopMotor': return [`${prefix}stop_motor(${value('IN1')}, ${value('IN2')}, ${value('PWM')})`];
    case 'arduinoDynamic_i2cWrite': return [`${prefix}i2c_write(${value('ADDRESS')}, ${value('REGISTER')}, ${value('DATA')})`];
    case 'arduinoDynamic_definePort': return [`${prefix}define_port(${value('ALIAS')}, ${value('PHYSICAL')})`];
    case 'control_wait': return [`${prefix}wait_seconds(${value('DURATION')})`];
    case 'control_repeat': {
        const body = stackLines(target(block, 'SUBSTACK'), indent + 4);
        return [`${prefix}for _ in range(${value('TIMES')}):`, ...(body.length ? body : [`${spaces(indent + 4)}pass`])];
    }
    case 'control_forever': {
        const body = stackLines(target(block, 'SUBSTACK'), indent + 4);
        return [`${prefix}while True:`, ...(body.length ? body : [`${spaces(indent + 4)}pass`])];
    }
    case 'control_if': {
        const body = stackLines(target(block, 'SUBSTACK'), indent + 4);
        return [`${prefix}if ${value('CONDITION')}:`, ...(body.length ? body : [`${spaces(indent + 4)}pass`])];
    }
    case 'control_if_else': {
        const yes = stackLines(target(block, 'SUBSTACK'), indent + 4);
        const no = stackLines(target(block, 'SUBSTACK2'), indent + 4);
        return [
            `${prefix}if ${value('CONDITION')}:`,
            ...(yes.length ? yes : [`${spaces(indent + 4)}pass`]),
            `${prefix}else:`,
            ...(no.length ? no : [`${spaces(indent + 4)}pass`])
        ];
    }
    default: return [`${prefix}# Unsupported block: ${block.type}`];
    }
};

const pythonFromWorkspace = () => {
    if (!workspace) return '';
    const tops = workspace.getTopBlocks ? workspace.getTopBlocks(true) : [];
    const start = tops.find(block => block.type === 'arduinoDynamic_whenArduinoStarts');
    if (!start) {
        const loose = tops.filter(block => block.type && !block.type.startsWith('procedures_'));
        return loose.flatMap(block => stackLines(block, 0)).join('\n');
    }
    const body = stackLines(start.getNextBlock ? start.getNextBlock() : null, 4);
    return ['def arduino_start():', ...(body.length ? body : ['    pass'])].join('\n');
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
        } else current += char;
    }
    if (current.trim() || source.trim() === '') result.push(current.trim());
    return result;
};

const shadowXml = value => {
    let text = String(value).trim();
    if (text === 'HIGH') text = '1';
    if (text === 'LOW') text = '0';
    if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(text)) {
        return `<shadow type="math_number"><field name="NUM">${escapeXml(text)}</field></shadow>`;
    }
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
        try {
            text = text.startsWith('"') ? JSON.parse(text) : text.slice(1, -1);
        } catch (e) {
            text = text.slice(1, -1);
        }
    }
    return `<shadow type="text"><field name="TEXT">${escapeXml(text)}</field></shadow>`;
};

const stripOuterParens = expression => {
    let text = expression.trim();
    if (text.startsWith('(') && text.endsWith(')')) text = text.slice(1, -1).trim();
    return text;
};

const reporterXml = expression => {
    const text = stripOuterParens(expression);
    const call = text.match(/^([A-Za-z_][A-Za-z0-9_]*)\((.*)\)$/);
    if (call) {
        const args = splitArgs(call[2]);
        const reporters = {
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
            map_value: ['arduinoDynamic_mapValue', ['VALUE', 'FROM_LOW', 'FROM_HIGH', 'TO_LOW', 'TO_HIGH']],
            constrain: ['arduinoDynamic_constrainValue', ['VALUE', 'LOW', 'HIGH']]
        };
        if (reporters[call[1]]) {
            const [type, names] = reporters[call[1]];
            return `<block type="${type}">${names.map((name, index) => `<value name="${name}">${reporterXml(args[index] || '0')}</value>`).join('')}</block>`;
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
            return `<block type="${type}"><value name="${leftName}">${reporterXml(text.slice(0, index))}</value><value name="${rightName}">${reporterXml(text.slice(index + token.length))}</value></block>`;
        }
    }
    if (text.startsWith('not ')) {
        return `<block type="operator_not"><value name="OPERAND">${reporterXml(text.slice(4))}</value></block>`;
    }
    return shadowXml(text);
};

const commandXml = (type, names, args) => `<block type="${type}">${names.map((name, index) => `<value name="${name}">${reporterXml(args[index] || '0')}</value>`).join('')}</block>`;

const parseSimpleStatement = line => {
    if (line === 'pass') return null;
    const call = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\((.*)\)$/);
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
        rgb_led: ['arduinoDynamic_rgbLed', ['R_PIN', 'G_PIN', 'B_PIN', 'R', 'G', 'B']],
        servo_write: ['arduinoDynamic_servoWrite', ['PIN', 'ANGLE', 'MIN', 'MAX']],
        servo_center: ['arduinoDynamic_servoCenter', ['PIN']],
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

const lineIndent = line => (line.match(/^ */) || [''])[0].length;

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
    const build = index => {
        if (index >= usable.length) return '';
        const node = usable[index];
        let xml;
        if (node.kind === 'simple') xml = node.xml;
        else if (node.kind === 'repeat') xml = `<block type="control_repeat"><value name="TIMES">${reporterXml(node.times)}</value><statement name="SUBSTACK">${chainXml(node.children)}</statement></block>`;
        else if (node.kind === 'forever') xml = `<block type="control_forever"><statement name="SUBSTACK">${chainXml(node.children)}</statement></block>`;
        else if (node.kind === 'if') xml = `<block type="control_if"><value name="CONDITION">${reporterXml(node.condition)}</value><statement name="SUBSTACK">${chainXml(node.children)}</statement></block>`;
        else xml = `<block type="control_if_else"><value name="CONDITION">${reporterXml(node.condition)}</value><statement name="SUBSTACK">${chainXml(node.children)}</statement><statement name="SUBSTACK2">${chainXml(node.otherwise)}</statement></block>`;
        const next = build(index + 1);
        return next ? xml.replace(/<\/block>$/, `<next>${next}</next></block>`) : xml;
    };
    return build(0);
};

const xmlFromPython = code => {
    const lines = String(code).replace(/\t/g, '    ').split(/\r?\n/);
    let start = 0;
    let indent = 0;
    const firstMeaningful = lines.findIndex(line => line.trim() && !line.trim().startsWith('#'));
    if (firstMeaningful >= 0 && lines[firstMeaningful].trim() === 'def arduino_start():') {
        start = firstMeaningful + 1;
        indent = 4;
    } else if (firstMeaningful > 0) start = firstMeaningful;
    const parsed = parseSuite(lines, start, indent);
    const remaining = lines.slice(parsed.index).find(line => line.trim() && !line.trim().startsWith('#'));
    if (remaining) throw new Error(`Unsupported Python near: ${remaining.trim()}`);
    const body = chainXml(parsed.nodes);
    if (!String(code).trim()) return '<xml xmlns="https://developers.google.com/blockly/xml"></xml>';
    return `<xml xmlns="https://developers.google.com/blockly/xml"><block type="arduinoDynamic_whenArduinoStarts" x="72" y="72">${body ? `<next>${body}</next>` : ''}</block></xml>`;
};

const scheduleEmit = () => {
    clearTimeout(pendingEmit);
    pendingEmit = setTimeout(() => {
        pendingEmit = null;
        if (!suppressWorkspaceEvents) notify(pythonFromWorkspace());
    }, 70);
};

export const attachArduinoPythonSync = (newWorkspace, newScratchBlocks) => {
    if (!newWorkspace || !newScratchBlocks) throw new Error('Blocks workspace is not ready.');
    if (detachWorkspaceListener) detachWorkspaceListener();
    workspace = newWorkspace;
    ScratchBlocks = newScratchBlocks;
    const listener = event => {
        if (suppressWorkspaceEvents) return;
        if (event && (event.isUiEvent || event.type === 'ui')) return;
        scheduleEmit();
    };
    workspace.addChangeListener(listener);
    detachWorkspaceListener = () => {
        try { workspace.removeChangeListener(listener); } catch (e) { /* workspace may already be disposed */ }
        detachWorkspaceListener = null;
    };
    scheduleEmit();
    return detachWorkspaceListener;
};

export const subscribeArduinoPython = listener => {
    listeners.add(listener);
    listener({code: lastPython || pythonFromWorkspace(), status: 'Synced'});
    return () => listeners.delete(listener);
};

export const getArduinoPython = () => lastPython || pythonFromWorkspace();

export const setArduinoPython = code => {
    if (!workspace || !ScratchBlocks) throw new Error('Blocks workspace is not ready yet.');
    const dom = ScratchBlocks.Xml.textToDom(xmlFromPython(code));
    suppressWorkspaceEvents = true;
    try {
        ScratchBlocks.Xml.clearWorkspaceAndLoadFromXml(dom, workspace);
    } finally {
        suppressWorkspaceEvents = false;
    }
    const normalized = pythonFromWorkspace();
    notify(normalized, 'Synced');
    return normalized;
};
