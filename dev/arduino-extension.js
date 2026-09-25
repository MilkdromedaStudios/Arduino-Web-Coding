(function (Scratch) {
    'use strict';

    const {BlockType, ArgumentType, Cast} = Scratch;
    const UNSANDBOXED = Boolean(Scratch.extensions.unsandboxed);
    const SETTINGS_KEY = 'arduino-web-test:settings:v2';
    const PORTS_KEY = 'arduino-web-test:ports:v2';
    const DEVICES_KEY = 'arduino-web-test:devices:v2';

    const DEFAULT_SETTINGS = {
        usbBaudRate: 115200,
        bootloaderBaudRate: 115200,
        avrPageSize: 128,
        bleService: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
        bleWriteCharacteristic: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
        bleNotifyCharacteristic: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
        blePacketSize: 20
    };

    const safeJSON = (text, fallback) => {
        try { return JSON.parse(text); } catch (e) { return fallback; }
    };

    const loadJSON = (key, fallback) => {
        try {
            const value = localStorage.getItem(key);
            return value ? safeJSON(value, fallback) : fallback;
        } catch (e) {
            return fallback;
        }
    };

    const saveJSON = (key, value) => {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage is optional */ }
    };

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder();

    class SerialTransport {
        constructor (settings, onText) {
            this.settings = settings;
            this.onText = onText;
            this.port = null;
            this.reader = null;
            this.reading = false;
        }

        async connect () {
            if (!navigator.serial) throw new Error('Web Serial is not supported. Use Chrome or Edge on desktop.');
            this.port = await navigator.serial.requestPort();
            await this.port.open({baudRate: Number(this.settings.usbBaudRate) || 115200});
            this.reading = true;
            this.readLoop();
        }

        async readLoop () {
            while (this.reading && this.port && this.port.readable) {
                this.reader = this.port.readable.getReader();
                try {
                    while (this.reading) {
                        const {value, done} = await this.reader.read();
                        if (done) break;
                        if (value) this.onText(textDecoder.decode(value, {stream: true}));
                    }
                } catch (e) {
                    if (this.reading) console.warn('Arduino serial read stopped', e);
                } finally {
                    try { this.reader.releaseLock(); } catch (e) { /* ignored */ }
                    this.reader = null;
                }
                break;
            }
        }

        async write (text) {
            if (!this.port?.writable) throw new Error('USB connection is not open.');
            const writer = this.port.writable.getWriter();
            try { await writer.write(textEncoder.encode(text)); } finally { writer.releaseLock(); }
        }

        async disconnect () {
            this.reading = false;
            try { await this.reader?.cancel(); } catch (e) { /* ignored */ }
            try { await this.port?.close(); } catch (e) { /* ignored */ }
            this.port = null;
        }
    }

    class BluetoothTransport {
        constructor (settings, onText) {
            this.settings = settings;
            this.onText = onText;
            this.device = null;
            this.server = null;
            this.writeCharacteristic = null;
            this.notifyCharacteristic = null;
        }

        async connect () {
            if (!navigator.bluetooth) throw new Error('Web Bluetooth is not supported in this browser.');
            const service = this.settings.bleService;
            if (!service) throw new Error('Set a Bluetooth service UUID first.');
            this.device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: [service]
            });
            this.server = await this.device.gatt.connect();
            const gattService = await this.server.getPrimaryService(service);
            this.writeCharacteristic = await gattService.getCharacteristic(this.settings.bleWriteCharacteristic);
            const notifyUUID = this.settings.bleNotifyCharacteristic || this.settings.bleWriteCharacteristic;
            this.notifyCharacteristic = await gattService.getCharacteristic(notifyUUID);
            await this.notifyCharacteristic.startNotifications();
            this.notifyCharacteristic.addEventListener('characteristicvaluechanged', event => {
                const view = event.target.value;
                const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
                this.onText(textDecoder.decode(bytes, {stream: true}));
            });
        }

        async write (text) {
            if (!this.writeCharacteristic) throw new Error('Bluetooth connection is not open.');
            const bytes = textEncoder.encode(text);
            const packetSize = Math.max(20, Number(this.settings.blePacketSize) || 20);
            for (let offset = 0; offset < bytes.length; offset += packetSize) {
                const packet = bytes.slice(offset, offset + packetSize);
                if (this.writeCharacteristic.writeValueWithoutResponse) {
                    await this.writeCharacteristic.writeValueWithoutResponse(packet);
                } else {
                    await this.writeCharacteristic.writeValue(packet);
                }
            }
        }

        async disconnect () {
            if (this.device?.gatt?.connected) this.device.gatt.disconnect();
            this.device = null;
            this.server = null;
            this.writeCharacteristic = null;
            this.notifyCharacteristic = null;
        }
    }

    const parseIntelHex = text => {
        const pages = new Map();
        let upper = 0;
        let minAddress = Infinity;
        let maxAddress = 0;
        for (const rawLine of text.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line) continue;
            if (!line.startsWith(':')) throw new Error('Invalid Intel HEX file.');
            const bytes = [];
            for (let i = 1; i < line.length; i += 2) bytes.push(parseInt(line.slice(i, i + 2), 16));
            const length = bytes[0];
            const address = (bytes[1] << 8) | bytes[2];
            const type = bytes[3];
            if (type === 0x00) {
                const absolute = upper + address;
                for (let i = 0; i < length; i++) {
                    pages.set(absolute + i, bytes[4 + i]);
                    minAddress = Math.min(minAddress, absolute + i);
                    maxAddress = Math.max(maxAddress, absolute + i);
                }
            } else if (type === 0x04) {
                upper = (((bytes[4] << 8) | bytes[5]) << 16) >>> 0;
            } else if (type === 0x01) {
                break;
            }
        }
        if (!pages.size) throw new Error('HEX file contains no program data.');
        return {bytes: pages, minAddress, maxAddress};
    };

    const readExact = async (reader, count, timeout = 1500) => {
        const result = [];
        const deadline = Date.now() + timeout;
        while (result.length < count) {
            if (Date.now() > deadline) throw new Error('Bootloader response timed out.');
            const read = await Promise.race([
                reader.read(),
                sleep(100).then(() => ({value: null, done: false}))
            ]);
            if (read.done) throw new Error('Bootloader serial connection closed.');
            if (read.value) result.push(...read.value);
        }
        return result.slice(0, count);
    };

    const uploadAVRHex = async (file, settings, onProgress) => {
        if (!navigator.serial) throw new Error('Web Serial is not supported.');
        const image = parseIntelHex(await file.text());
        const pageSize = Math.max(32, Number(settings.avrPageSize) || 128);
        const port = await navigator.serial.requestPort();
        await port.open({baudRate: Number(settings.bootloaderBaudRate) || 115200});
        try {
            try {
                await port.setSignals({dataTerminalReady: false, requestToSend: false});
                await sleep(80);
                await port.setSignals({dataTerminalReady: true, requestToSend: false});
                await sleep(300);
            } catch (e) { /* some adapters do not expose reset signals */ }

            const reader = port.readable.getReader();
            const writer = port.writable.getWriter();
            const transact = async packet => {
                await writer.write(Uint8Array.from(packet));
                const reply = await readExact(reader, 2);
                if (reply[0] !== 0x14 || reply[1] !== 0x10) {
                    throw new Error(`Unexpected AVR bootloader reply: ${reply.map(v => v.toString(16)).join(' ')}`);
                }
            };

            try {
                let synced = false;
                for (let attempt = 0; attempt < 8 && !synced; attempt++) {
                    try {
                        await transact([0x30, 0x20]);
                        synced = true;
                    } catch (e) {
                        await sleep(120);
                    }
                }
                if (!synced) throw new Error('Could not synchronize with AVR bootloader.');

                const firstPage = Math.floor(image.minAddress / pageSize);
                const lastPage = Math.floor(image.maxAddress / pageSize);
                const pages = [];
                for (let page = firstPage; page <= lastPage; page++) {
                    let hasData = false;
                    for (let i = 0; i < pageSize; i++) {
                        if (image.bytes.has(page * pageSize + i)) { hasData = true; break; }
                    }
                    if (hasData) pages.push(page);
                }

                for (let index = 0; index < pages.length; index++) {
                    const page = pages[index];
                    const byteAddress = page * pageSize;
                    const wordAddress = Math.floor(byteAddress / 2);
                    await transact([0x55, wordAddress & 0xff, (wordAddress >> 8) & 0xff, 0x20]);
                    const data = new Array(pageSize).fill(0xff);
                    for (let i = 0; i < pageSize; i++) {
                        if (image.bytes.has(byteAddress + i)) data[i] = image.bytes.get(byteAddress + i);
                    }
                    await transact([0x64, (pageSize >> 8) & 0xff, pageSize & 0xff, 0x46, ...data, 0x20]);
                    onProgress?.((index + 1) / pages.length);
                }
                await transact([0x51, 0x20]);
            } finally {
                reader.releaseLock();
                writer.releaseLock();
            }
        } finally {
            await port.close();
        }
    };

    const uploadBLEImage = async (file, settings, onProgress) => {
        if (!navigator.bluetooth) throw new Error('Web Bluetooth is not supported.');
        const serviceUUID = settings.bleService;
        const characteristicUUID = settings.bleWriteCharacteristic;
        if (!serviceUUID || !characteristicUUID) throw new Error('Set BLE service and write characteristic UUIDs first.');
        const device = await navigator.bluetooth.requestDevice({acceptAllDevices: true, optionalServices: [serviceUUID]});
        const server = await device.gatt.connect();
        try {
            const service = await server.getPrimaryService(serviceUUID);
            const characteristic = await service.getCharacteristic(characteristicUUID);
            const bytes = new Uint8Array(await file.arrayBuffer());
            const packetSize = Math.max(20, Number(settings.blePacketSize) || 20);
            const header = textEncoder.encode(`AWT1\t${bytes.length}\t${file.name}\n`);
            if (characteristic.writeValueWithoutResponse) await characteristic.writeValueWithoutResponse(header);
            else await characteristic.writeValue(header);
            for (let offset = 0; offset < bytes.length; offset += packetSize) {
                const packet = bytes.slice(offset, offset + packetSize);
                if (characteristic.writeValueWithoutResponse) await characteristic.writeValueWithoutResponse(packet);
                else await characteristic.writeValue(packet);
                onProgress?.(Math.min(1, (offset + packet.length) / bytes.length));
            }
        } finally {
            if (device.gatt.connected) device.gatt.disconnect();
        }
    };

    class DirectBackend {
        constructor () {
            this.settings = {...DEFAULT_SETTINGS, ...loadJSON(SETTINGS_KEY, {})};
            this.transport = null;
            this.transportType = null;
            this.buffer = '';
            this.nextId = 1;
            this.pending = new Map();
            this.state = {connected: false, status: 'Not connected', method: null};
        }

        emitState () {
            window.dispatchEvent(new CustomEvent('arduino-web-test-state', {detail: this.getState()}));
        }

        getState () { return {...this.state}; }
        getSettings () { return {...this.settings}; }
        updateSettings (partial) {
            this.settings = {...this.settings, ...partial};
            saveJSON(SETTINGS_KEY, this.settings);
            return this.getSettings();
        }

        onText (text) {
            this.buffer += text;
            let newline;
            while ((newline = this.buffer.indexOf('\n')) >= 0) {
                const line = this.buffer.slice(0, newline).replace(/\r$/, '');
                this.buffer = this.buffer.slice(newline + 1);
                this.handleLine(line);
            }
        }

        handleLine (line) {
            if (!line.startsWith('@')) return;
            const parts = line.split('\t');
            const id = Number(parts[0].slice(1));
            const pending = this.pending.get(id);
            if (!pending) return;
            this.pending.delete(id);
            clearTimeout(pending.timer);
            const status = parts[1];
            const value = parts.slice(2).join('\t');
            if (status === 'OK') pending.resolve(value);
            else pending.reject(new Error(value || 'Arduino command failed.'));
        }

        async connect (method = 'usb') {
            await this.disconnect();
            this.state = {connected: false, status: `Connecting by ${method}…`, method};
            this.emitState();
            this.transport = method === 'bluetooth'
                ? new BluetoothTransport(this.settings, text => this.onText(text))
                : new SerialTransport(this.settings, text => this.onText(text));
            await this.transport.connect();
            this.transportType = method;
            this.state = {connected: true, status: `${method === 'bluetooth' ? 'Bluetooth' : 'USB'} connected`, method};
            this.emitState();
            return true;
        }

        async disconnect () {
            if (this.transport) await this.transport.disconnect();
            this.transport = null;
            this.transportType = null;
            for (const pending of this.pending.values()) pending.reject(new Error('Arduino disconnected.'));
            this.pending.clear();
            this.state = {connected: false, status: 'Not connected', method: null};
            this.emitState();
        }

        request (command, args = [], timeout = 5000) {
            if (!this.transport) return Promise.reject(new Error('Connect an Arduino first.'));
            const id = this.nextId++;
            const clean = value => String(value ?? '').replace(/[\t\r\n]/g, ' ');
            const line = `@${id}\t${clean(command)}${args.length ? `\t${args.map(clean).join('\t')}` : ''}\n`;
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    this.pending.delete(id);
                    reject(new Error(`Arduino command timed out: ${command}`));
                }, timeout);
                this.pending.set(id, {resolve, reject, timer});
                this.transport.write(line).catch(error => {
                    clearTimeout(timer);
                    this.pending.delete(id);
                    reject(error);
                });
            });
        }

        async chooseAndUpload (method = 'usb') {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = method === 'usb' ? '.hex' : '.bin,.hex';
            const file = await new Promise(resolve => {
                input.addEventListener('change', () => resolve(input.files?.[0] || null), {once: true});
                input.click();
            });
            if (!file) return false;
            await this.disconnect();
            this.state = {connected: false, status: `Uploading ${file.name}…`, method};
            this.emitState();
            const progress = ratio => {
                this.state = {...this.state, status: `Uploading ${file.name}: ${Math.round(ratio * 100)}%`};
                this.emitState();
            };
            if (method === 'bluetooth') await uploadBLEImage(file, this.settings, progress);
            else await uploadAVRHex(file, this.settings, progress);
            this.state = {connected: false, status: `Upload complete: ${file.name}`, method: null};
            this.emitState();
            return true;
        }
    }

    class TopFrameBackend {
        constructor () {
            this.nextId = 1;
            this.pending = new Map();
            this.state = {connected: false, status: 'Use the /dev connection bar to connect.', method: null};
            window.addEventListener('message', event => {
                const data = event.data;
                if (!data || data.source !== 'arduino-web-host') return;
                if (data.type === 'state') {
                    this.state = data.state || this.state;
                    return;
                }
                const pending = this.pending.get(data.id);
                if (!pending) return;
                this.pending.delete(data.id);
                clearTimeout(pending.timer);
                if (data.ok) pending.resolve(data.value);
                else pending.reject(new Error(data.error || 'Arduino host request failed.'));
            });
        }

        call (action, payload = {}) {
            const id = this.nextId++;
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    this.pending.delete(id);
                    reject(new Error('Arduino host did not respond.'));
                }, 8000);
                this.pending.set(id, {resolve, reject, timer});
                window.top.postMessage({source: 'arduino-web-extension', id, action, payload}, '*');
            });
        }

        getState () { return {...this.state}; }
        getSettings () { return {...DEFAULT_SETTINGS}; }
        updateSettings () { return this.getSettings(); }
        connect (method) { return this.call('connect', {method}); }
        disconnect () { return this.call('disconnect'); }
        request (command, args, timeout) { return this.call('request', {command, args, timeout}); }
        chooseAndUpload (method) { return this.call('chooseAndUpload', {method}); }
    }

    const backend = UNSANDBOXED ? new DirectBackend() : new TopFrameBackend();
    let ports = loadJSON(PORTS_KEY, {});
    let devices = loadJSON(DEVICES_KEY, {});

    const normalizePin = pin => {
        const raw = String(pin).trim();
        const resolved = Object.prototype.hasOwnProperty.call(ports, raw) ? ports[raw] : raw;
        if (/^D\d+$/i.test(resolved)) return resolved.slice(1);
        return resolved;
    };

    const addPort = (alias, physical) => {
        ports = {...ports, [String(alias)]: String(physical)};
        saveJSON(PORTS_KEY, ports);
        return true;
    };

    const addDevice = (name, type, port, options) => {
        devices = {...devices, [String(name)]: {type: String(type), port: String(port), options: safeJSON(String(options), {})}};
        saveJSON(DEVICES_KEY, devices);
        return true;
    };

    if (UNSANDBOXED) {
        window.__ARDUINO_WEB_TEST__ = {
            connect: method => backend.connect(method),
            disconnect: () => backend.disconnect(),
            request: (command, args, timeout) => backend.request(command, args, timeout),
            chooseAndUpload: method => backend.chooseAndUpload(method),
            getState: () => backend.getState(),
            getSettings: () => backend.getSettings(),
            updateSettings: partial => backend.updateSettings(partial),
            addPort
        };
        backend.emitState();
    }

    class ArduinoDynamicExtension {
        getInfo () {
            return {
                id: 'arduinoDynamic',
                name: 'Arduino',
                color1: '#00979d',
                color2: '#007c83',
                color3: '#005c61',
                blocks: [
                    {opcode: 'connectionStatus', blockType: BlockType.REPORTER, text: 'Arduino connection status'},
                    {opcode: 'connect', blockType: BlockType.COMMAND, text: 'connect Arduino using [METHOD]', arguments: {METHOD: {type: ArgumentType.STRING, menu: 'connectionMethod'}}},
                    {opcode: 'disconnect', blockType: BlockType.COMMAND, text: 'disconnect Arduino'},
                    '---',
                    {opcode: 'digitalWrite', blockType: BlockType.COMMAND, text: 'set digital [PIN] to [VALUE]', arguments: {PIN: {type: ArgumentType.STRING, menu: 'ports'}, VALUE: {type: ArgumentType.STRING, menu: 'digitalValue'}}},
                    {opcode: 'digitalRead', blockType: BlockType.REPORTER, text: 'digital [PIN]', arguments: {PIN: {type: ArgumentType.STRING, menu: 'ports'}}},
                    {opcode: 'analogWrite', blockType: BlockType.COMMAND, text: 'set PWM [PIN] to [VALUE]', arguments: {PIN: {type: ArgumentType.STRING, menu: 'ports'}, VALUE: {type: ArgumentType.NUMBER, defaultValue: 128}}},
                    {opcode: 'analogRead', blockType: BlockType.REPORTER, text: 'analog [PIN]', arguments: {PIN: {type: ArgumentType.STRING, menu: 'ports'}}},
                    '---',
                    {opcode: 'servoWrite', blockType: BlockType.COMMAND, text: 'servo [PIN] angle [ANGLE] min [MIN] max [MAX]', arguments: {PIN: {type: ArgumentType.STRING, menu: 'ports'}, ANGLE: {type: ArgumentType.NUMBER, defaultValue: 90}, MIN: {type: ArgumentType.NUMBER, defaultValue: 544}, MAX: {type: ArgumentType.NUMBER, defaultValue: 2400}}},
                    {opcode: 'servoDetach', blockType: BlockType.COMMAND, text: 'detach servo [PIN]', arguments: {PIN: {type: ArgumentType.STRING, menu: 'ports'}}},
                    {opcode: 'tone', blockType: BlockType.COMMAND, text: 'tone pin [PIN] frequency [FREQ] Hz for [MS] ms', arguments: {PIN: {type: ArgumentType.STRING, menu: 'ports'}, FREQ: {type: ArgumentType.NUMBER, defaultValue: 440}, MS: {type: ArgumentType.NUMBER, defaultValue: 250}}},
                    {opcode: 'noTone', blockType: BlockType.COMMAND, text: 'stop tone on [PIN]', arguments: {PIN: {type: ArgumentType.STRING, menu: 'ports'}}},
                    {opcode: 'motor', blockType: BlockType.COMMAND, text: 'motor IN1 [IN1] IN2 [IN2] PWM [PWM] speed [SPEED] %', arguments: {IN1: {type: ArgumentType.STRING, menu: 'ports'}, IN2: {type: ArgumentType.STRING, menu: 'ports'}, PWM: {type: ArgumentType.STRING, menu: 'ports'}, SPEED: {type: ArgumentType.NUMBER, defaultValue: 50}}},
                    '---',
                    {opcode: 'ultrasonic', blockType: BlockType.REPORTER, text: 'ultrasonic trigger [TRIG] echo [ECHO] max [MAX] cm', arguments: {TRIG: {type: ArgumentType.STRING, menu: 'ports'}, ECHO: {type: ArgumentType.STRING, menu: 'ports'}, MAX: {type: ArgumentType.NUMBER, defaultValue: 400}}},
                    {opcode: 'touch', blockType: BlockType.BOOLEAN, text: 'touch sensor [PIN] threshold [THRESHOLD]', arguments: {PIN: {type: ArgumentType.STRING, menu: 'ports'}, THRESHOLD: {type: ArgumentType.NUMBER, defaultValue: 500}}},
                    {opcode: 'amplifier', blockType: BlockType.REPORTER, text: 'amplifier / microphone [PIN] level from [SAMPLES] samples', arguments: {PIN: {type: ArgumentType.STRING, menu: 'ports'}, SAMPLES: {type: ArgumentType.NUMBER, defaultValue: 32}}},
                    {opcode: 'recordAnalog', blockType: BlockType.REPORTER, text: 'record analog [PIN] [SAMPLES] samples every [US] μs', arguments: {PIN: {type: ArgumentType.STRING, menu: 'ports'}, SAMPLES: {type: ArgumentType.NUMBER, defaultValue: 64}, US: {type: ArgumentType.NUMBER, defaultValue: 500}}},
                    '---',
                    {opcode: 'i2cWrite', blockType: BlockType.COMMAND, text: 'I²C write address [ADDRESS] register [REGISTER] bytes [DATA]', arguments: {ADDRESS: {type: ArgumentType.STRING, defaultValue: '0x3C'}, REGISTER: {type: ArgumentType.NUMBER, defaultValue: 0}, DATA: {type: ArgumentType.STRING, defaultValue: '1,2,3'}}},
                    {opcode: 'i2cRead', blockType: BlockType.REPORTER, text: 'I²C read address [ADDRESS] register [REGISTER] length [LENGTH]', arguments: {ADDRESS: {type: ArgumentType.STRING, defaultValue: '0x3C'}, REGISTER: {type: ArgumentType.NUMBER, defaultValue: 0}, LENGTH: {type: ArgumentType.NUMBER, defaultValue: 1}}},
                    '---',
                    {opcode: 'definePort', blockType: BlockType.COMMAND, text: 'define port [ALIAS] as [PHYSICAL]', arguments: {ALIAS: {type: ArgumentType.STRING, defaultValue: 'leftMotor'}, PHYSICAL: {type: ArgumentType.STRING, defaultValue: '9'}}},
                    {opcode: 'defineDevice', blockType: BlockType.COMMAND, text: 'define device [NAME] type [TYPE] port [PORT] settings [OPTIONS]', arguments: {NAME: {type: ArgumentType.STRING, defaultValue: 'myDevice'}, TYPE: {type: ArgumentType.STRING, defaultValue: 'custom'}, PORT: {type: ArgumentType.STRING, menu: 'ports'}, OPTIONS: {type: ArgumentType.STRING, defaultValue: '{}'}}},
                    {opcode: 'deviceRequest', blockType: BlockType.REPORTER, text: 'device [DEVICE] operation [OPERATION] data [DATA]', arguments: {DEVICE: {type: ArgumentType.STRING, menu: 'devices'}, OPERATION: {type: ArgumentType.STRING, defaultValue: 'read'}, DATA: {type: ArgumentType.STRING, defaultValue: '{}'}}},
                    {opcode: 'rawRequest', blockType: BlockType.REPORTER, text: 'raw Arduino command [COMMAND] args [ARGS]', arguments: {COMMAND: {type: ArgumentType.STRING, defaultValue: 'PING'}, ARGS: {type: ArgumentType.STRING, defaultValue: ''}}}
                ],
                menus: {
                    connectionMethod: {acceptReporters: false, items: [{text: 'USB cable', value: 'usb'}, {text: 'Bluetooth', value: 'bluetooth'}]},
                    digitalValue: {acceptReporters: true, items: [{text: 'HIGH', value: '1'}, {text: 'LOW', value: '0'}]},
                    ports: {acceptReporters: true, items: 'getPortMenu'},
                    devices: {acceptReporters: true, items: 'getDeviceMenu'}
                }
            };
        }

        getPortMenu () {
            const defaults = ['2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
            const aliases = Object.keys(ports).map(name => ({text: `${name} → ${ports[name]}`, value: name}));
            return [...aliases, ...defaults];
        }

        getDeviceMenu () {
            const names = Object.keys(devices);
            return names.length ? names : ['myDevice'];
        }

        connectionStatus () { return backend.getState().status || 'Not connected'; }
        connect (args) { return backend.connect(String(args.METHOD || 'usb')); }
        disconnect () { return backend.disconnect(); }
        digitalWrite (args) { return backend.request('DWRITE', [normalizePin(args.PIN), Cast.toBoolean(args.VALUE) ? 1 : 0]); }
        async digitalRead (args) { return Number(await backend.request('DREAD', [normalizePin(args.PIN)])); }
        analogWrite (args) { return backend.request('PWM', [normalizePin(args.PIN), Math.max(0, Math.min(255, Cast.toNumber(args.VALUE)))]); }
        async analogRead (args) { return Number(await backend.request('AREAD', [normalizePin(args.PIN)])); }
        servoWrite (args) { return backend.request('SERVO', [normalizePin(args.PIN), Cast.toNumber(args.ANGLE), Cast.toNumber(args.MIN), Cast.toNumber(args.MAX)]); }
        servoDetach (args) { return backend.request('SERVO_DETACH', [normalizePin(args.PIN)]); }
        tone (args) { return backend.request('TONE', [normalizePin(args.PIN), Cast.toNumber(args.FREQ), Cast.toNumber(args.MS)]); }
        noTone (args) { return backend.request('NOTONE', [normalizePin(args.PIN)]); }
        motor (args) { return backend.request('MOTOR', [normalizePin(args.IN1), normalizePin(args.IN2), normalizePin(args.PWM), Math.max(-100, Math.min(100, Cast.toNumber(args.SPEED)))]); }
        async ultrasonic (args) { return Number(await backend.request('USONIC', [normalizePin(args.TRIG), normalizePin(args.ECHO), Cast.toNumber(args.MAX)])); }
        async touch (args) { return Number(await backend.request('TOUCH', [normalizePin(args.PIN), Cast.toNumber(args.THRESHOLD)])) !== 0; }
        async amplifier (args) { return Number(await backend.request('AMP', [normalizePin(args.PIN), Math.max(1, Math.min(256, Cast.toNumber(args.SAMPLES)))])); }
        recordAnalog (args) { return backend.request('REC', [normalizePin(args.PIN), Math.max(1, Math.min(128, Cast.toNumber(args.SAMPLES))), Math.max(50, Cast.toNumber(args.US))], 15000); }
        i2cWrite (args) { return backend.request('I2CW', [String(args.ADDRESS), Cast.toNumber(args.REGISTER), String(args.DATA)]); }
        i2cRead (args) { return backend.request('I2CR', [String(args.ADDRESS), Cast.toNumber(args.REGISTER), Math.max(1, Math.min(32, Cast.toNumber(args.LENGTH)))]); }
        definePort (args) { return addPort(args.ALIAS, args.PHYSICAL); }
        defineDevice (args) { return addDevice(args.NAME, args.TYPE, args.PORT, args.OPTIONS); }
        deviceRequest (args) {
            const device = devices[String(args.DEVICE)] || {type: 'custom', port: String(args.DEVICE), options: {}};
            return backend.request('CUSTOM', [String(args.DEVICE), device.type, normalizePin(device.port), String(args.OPERATION), JSON.stringify(device.options), String(args.DATA)], 10000);
        }
        rawRequest (args) {
            const values = String(args.ARGS || '').split(',').map(value => value.trim()).filter(Boolean);
            return backend.request(String(args.COMMAND || 'PING').trim().toUpperCase(), values, 10000);
        }
    }

    Scratch.extensions.register(new ArduinoDynamicExtension());
})(Scratch);
