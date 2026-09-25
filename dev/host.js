(() => {
    'use strict';

    const SETTINGS_KEY = 'arduino-web-test:settings:v2';
    const DEFAULT_SETTINGS = {
        usbBaudRate: 115200,
        bootloaderBaudRate: 115200,
        avrPageSize: 128,
        bleService: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
        bleWriteCharacteristic: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
        bleNotifyCharacteristic: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
        blePacketSize: 20
    };

    const $ = id => document.getElementById(id);
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const loadSettings = () => {
        try {
            return {...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')};
        } catch (e) {
            return {...DEFAULT_SETTINGS};
        }
    };

    let settings = loadSettings();
    let transport = null;
    let transportType = null;
    let inputBuffer = '';
    let nextRequestId = 1;
    const pending = new Map();
    let state = {connected: false, status: 'Not connected', method: null};

    const saveSettings = () => {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    };

    const setState = patch => {
        state = {...state, ...patch};
        $('status').textContent = state.status || 'Not connected';
        const frame = $('editor').contentWindow;
        if (frame) frame.postMessage({source: 'arduino-web-host', type: 'state', state: {...state}}, '*');
    };

    const cleanArg = value => String(value ?? '').replace(/[\t\r\n]/g, ' ');

    const handleIncomingText = text => {
        inputBuffer += text;
        let newline;
        while ((newline = inputBuffer.indexOf('\n')) >= 0) {
            const line = inputBuffer.slice(0, newline).replace(/\r$/, '');
            inputBuffer = inputBuffer.slice(newline + 1);
            if (!line.startsWith('@')) continue;
            const parts = line.split('\t');
            const id = Number(parts[0].slice(1));
            const waiter = pending.get(id);
            if (!waiter) continue;
            pending.delete(id);
            clearTimeout(waiter.timer);
            if (parts[1] === 'OK') waiter.resolve(parts.slice(2).join('\t'));
            else waiter.reject(new Error(parts.slice(2).join('\t') || 'Arduino command failed.'));
        }
    };

    class SerialTransport {
        async connect () {
            if (!navigator.serial) throw new Error('Web Serial requires Chrome or Edge on desktop.');
            this.port = await navigator.serial.requestPort();
            await this.port.open({baudRate: Number(settings.usbBaudRate) || 115200});
            this.reading = true;
            this.readLoop();
        }

        async readLoop () {
            while (this.reading && this.port?.readable) {
                const reader = this.port.readable.getReader();
                this.reader = reader;
                try {
                    while (this.reading) {
                        const {value, done} = await reader.read();
                        if (done) break;
                        if (value) handleIncomingText(decoder.decode(value, {stream: true}));
                    }
                } catch (e) {
                    if (this.reading) setState({status: `USB read error: ${e.message}`});
                } finally {
                    try { reader.releaseLock(); } catch (e) { /* ignored */ }
                    if (this.reader === reader) this.reader = null;
                }
                break;
            }
        }

        async write (text) {
            if (!this.port?.writable) throw new Error('USB connection is not open.');
            const writer = this.port.writable.getWriter();
            try { await writer.write(encoder.encode(text)); } finally { writer.releaseLock(); }
        }

        async disconnect () {
            this.reading = false;
            try { await this.reader?.cancel(); } catch (e) { /* ignored */ }
            try { await this.port?.close(); } catch (e) { /* ignored */ }
            this.port = null;
        }
    }

    class BluetoothTransport {
        async connect () {
            if (!navigator.bluetooth) throw new Error('Web Bluetooth is not supported in this browser.');
            if (!settings.bleService || !settings.bleWriteCharacteristic) {
                throw new Error('Set the BLE service and write characteristic UUIDs first.');
            }
            this.device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: [settings.bleService]
            });
            this.server = await this.device.gatt.connect();
            const service = await this.server.getPrimaryService(settings.bleService);
            this.writeCharacteristic = await service.getCharacteristic(settings.bleWriteCharacteristic);
            const notifyId = settings.bleNotifyCharacteristic || settings.bleWriteCharacteristic;
            this.notifyCharacteristic = await service.getCharacteristic(notifyId);
            await this.notifyCharacteristic.startNotifications();
            this.notifyCharacteristic.addEventListener('characteristicvaluechanged', event => {
                const view = event.target.value;
                const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
                handleIncomingText(decoder.decode(bytes, {stream: true}));
            });
            this.device.addEventListener('gattserverdisconnected', () => {
                if (transport === this) {
                    transport = null;
                    transportType = null;
                    setState({connected: false, status: 'Bluetooth disconnected', method: null});
                }
            });
        }

        async writeBytes (bytes) {
            if (!this.writeCharacteristic) throw new Error('Bluetooth connection is not open.');
            const size = Math.max(20, Number(settings.blePacketSize) || 20);
            for (let offset = 0; offset < bytes.length; offset += size) {
                const packet = bytes.slice(offset, offset + size);
                if (this.writeCharacteristic.writeValueWithoutResponse) {
                    await this.writeCharacteristic.writeValueWithoutResponse(packet);
                } else {
                    await this.writeCharacteristic.writeValue(packet);
                }
            }
        }

        write (text) {
            return this.writeBytes(encoder.encode(text));
        }

        async disconnect () {
            if (this.device?.gatt?.connected) this.device.gatt.disconnect();
            this.device = null;
            this.server = null;
            this.writeCharacteristic = null;
            this.notifyCharacteristic = null;
        }
    }

    const disconnect = async () => {
        if (transport) await transport.disconnect();
        transport = null;
        transportType = null;
        for (const waiter of pending.values()) {
            clearTimeout(waiter.timer);
            waiter.reject(new Error('Arduino disconnected.'));
        }
        pending.clear();
        setState({connected: false, status: 'Not connected', method: null});
    };

    const connect = async method => {
        await disconnect();
        setState({connected: false, status: `Connecting by ${method}…`, method});
        transport = method === 'bluetooth' ? new BluetoothTransport() : new SerialTransport();
        try {
            await transport.connect();
            transportType = method;
            setState({connected: true, status: `${method === 'bluetooth' ? 'Bluetooth' : 'USB'} connected`, method});
            return true;
        } catch (error) {
            transport = null;
            transportType = null;
            setState({connected: false, status: error.message || String(error), method: null});
            throw error;
        }
    };

    const request = (command, args = [], timeout = 5000) => {
        if (!transport) return Promise.reject(new Error('Connect an Arduino first.'));
        const id = nextRequestId++;
        const line = `@${id}\t${cleanArg(command)}${args.length ? `\t${args.map(cleanArg).join('\t')}` : ''}\n`;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                pending.delete(id);
                reject(new Error(`Arduino command timed out: ${command}`));
            }, Number(timeout) || 5000);
            pending.set(id, {resolve, reject, timer});
            transport.write(line).catch(error => {
                clearTimeout(timer);
                pending.delete(id);
                reject(error);
            });
        });
    };

    const parseIntelHex = text => {
        const bytesByAddress = new Map();
        let upper = 0;
        let minAddress = Infinity;
        let maxAddress = 0;
        for (const rawLine of text.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line) continue;
            if (!/^:[0-9A-Fa-f]+$/.test(line)) throw new Error('Invalid Intel HEX file.');
            const bytes = [];
            for (let i = 1; i < line.length; i += 2) bytes.push(parseInt(line.slice(i, i + 2), 16));
            const length = bytes[0];
            const address = (bytes[1] << 8) | bytes[2];
            const type = bytes[3];
            const expectedLength = 5 + length;
            if (bytes.length !== expectedLength) throw new Error('Malformed Intel HEX record.');
            const checksum = bytes.reduce((sum, value) => (sum + value) & 0xff, 0);
            if (checksum !== 0) throw new Error('Intel HEX checksum failed.');
            if (type === 0x00) {
                const absolute = upper + address;
                for (let i = 0; i < length; i++) {
                    bytesByAddress.set(absolute + i, bytes[4 + i]);
                    minAddress = Math.min(minAddress, absolute + i);
                    maxAddress = Math.max(maxAddress, absolute + i);
                }
            } else if (type === 0x04) {
                upper = (((bytes[4] << 8) | bytes[5]) << 16) >>> 0;
            } else if (type === 0x01) {
                break;
            }
        }
        if (!bytesByAddress.size) throw new Error('HEX file contains no program data.');
        return {bytesByAddress, minAddress, maxAddress};
    };

    const readExact = async (reader, count, timeout = 1600) => {
        const result = [];
        const deadline = Date.now() + timeout;
        while (result.length < count) {
            if (Date.now() > deadline) throw new Error('Bootloader response timed out.');
            const chunk = await Promise.race([
                reader.read(),
                sleep(80).then(() => ({value: null, done: false}))
            ]);
            if (chunk.done) throw new Error('Bootloader connection closed.');
            if (chunk.value) result.push(...chunk.value);
        }
        return result.slice(0, count);
    };

    const uploadAVR = async file => {
        if (!navigator.serial) throw new Error('Web Serial requires Chrome or Edge on desktop.');
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
            } catch (e) { /* adapter may not support manual reset */ }

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

                const first = Math.floor(image.minAddress / pageSize);
                const last = Math.floor(image.maxAddress / pageSize);
                const pages = [];
                for (let page = first; page <= last; page++) {
                    let used = false;
                    for (let i = 0; i < pageSize; i++) {
                        if (image.bytesByAddress.has(page * pageSize + i)) { used = true; break; }
                    }
                    if (used) pages.push(page);
                }

                for (let index = 0; index < pages.length; index++) {
                    const page = pages[index];
                    const byteAddress = page * pageSize;
                    const wordAddress = Math.floor(byteAddress / 2);
                    await transact([0x55, wordAddress & 0xff, (wordAddress >> 8) & 0xff, 0x20]);
                    const data = new Array(pageSize).fill(0xff);
                    for (let i = 0; i < pageSize; i++) {
                        const value = image.bytesByAddress.get(byteAddress + i);
                        if (value !== undefined) data[i] = value;
                    }
                    await transact([0x64, (pageSize >> 8) & 0xff, pageSize & 0xff, 0x46, ...data, 0x20]);
                    setState({status: `Uploading ${file.name}: ${Math.round(((index + 1) / pages.length) * 100)}%`});
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

    const uploadBluetooth = async file => {
        if (!navigator.bluetooth) throw new Error('Web Bluetooth is not supported in this browser.');
        if (!settings.bleService || !settings.bleWriteCharacteristic) {
            throw new Error('Set BLE service and OTA write characteristic UUIDs first.');
        }
        const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [settings.bleService]
        });
        const server = await device.gatt.connect();
        try {
            const service = await server.getPrimaryService(settings.bleService);
            const characteristic = await service.getCharacteristic(settings.bleWriteCharacteristic);
            const bytes = new Uint8Array(await file.arrayBuffer());
            const packetSize = Math.max(20, Number(settings.blePacketSize) || 20);
            const write = async packet => {
                if (characteristic.writeValueWithoutResponse) await characteristic.writeValueWithoutResponse(packet);
                else await characteristic.writeValue(packet);
            };
            await write(encoder.encode(`AWT1\t${bytes.length}\t${file.name}\n`));
            for (let offset = 0; offset < bytes.length; offset += packetSize) {
                const packet = bytes.slice(offset, offset + packetSize);
                await write(packet);
                setState({status: `Uploading ${file.name}: ${Math.round(((offset + packet.length) / bytes.length) * 100)}%`});
            }
        } finally {
            if (device.gatt.connected) device.gatt.disconnect();
        }
    };

    const chooseFile = accept => new Promise(resolve => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.addEventListener('change', () => resolve(input.files?.[0] || null), {once: true});
        input.click();
    });

    const chooseAndUpload = async method => {
        const file = await chooseFile(method === 'bluetooth' ? '.bin,.hex' : '.hex');
        if (!file) return false;
        await disconnect();
        setState({connected: false, status: `Uploading ${file.name}…`, method});
        if (method === 'bluetooth') await uploadBluetooth(file);
        else await uploadAVR(file);
        setState({connected: false, status: `Upload complete: ${file.name}`, method: null});
        return true;
    };

    const runUIAction = async action => {
        try { await action(); } catch (error) { setState({status: error.message || String(error)}); }
    };

    const bindSettings = () => {
        const fields = {
            'usb-baud': 'usbBaudRate',
            'boot-baud': 'bootloaderBaudRate',
            'page-size': 'avrPageSize',
            'ble-service': 'bleService',
            'ble-write': 'bleWriteCharacteristic',
            'ble-notify': 'bleNotifyCharacteristic',
            'ble-packet': 'blePacketSize'
        };
        for (const [id, key] of Object.entries(fields)) {
            const input = $(id);
            input.value = settings[key];
            input.addEventListener('change', () => {
                settings[key] = input.type === 'number' ? Number(input.value) : input.value.trim();
                saveSettings();
            });
        }
    };

    $('connect').addEventListener('click', () => runUIAction(() => connect($('method').value)));
    $('disconnect').addEventListener('click', () => runUIAction(disconnect));
    $('upload').addEventListener('click', () => runUIAction(() => chooseAndUpload($('method').value)));
    $('settings').addEventListener('click', () => $('settings-panel').classList.toggle('open'));
    bindSettings();

    window.addEventListener('message', async event => {
        const data = event.data;
        if (!data || data.source !== 'arduino-web-extension' || !data.id) return;
        const reply = (ok, value, error) => {
            event.source?.postMessage({source: 'arduino-web-host', id: data.id, ok, value, error}, '*');
        };
        try {
            let value;
            switch (data.action) {
            case 'getState': value = {...state}; break;
            case 'connect': value = await connect(data.payload?.method || 'usb'); break;
            case 'disconnect': value = await disconnect(); break;
            case 'request': value = await request(data.payload?.command, data.payload?.args || [], data.payload?.timeout); break;
            case 'chooseAndUpload': value = await chooseAndUpload(data.payload?.method || 'usb'); break;
            default: throw new Error(`Unknown Arduino host action: ${data.action}`);
            }
            reply(true, value, null);
        } catch (error) {
            reply(false, null, error.message || String(error));
        }
    });

    const extensionURL = new URL('./arduino-extension.js', location.href).href;
    const editorURL = new URL('https://turbowarp.org/editor');
    editorURL.searchParams.set('extension', extensionURL);
    $('editor').src = editorURL.href;
    $('editor').addEventListener('load', () => setTimeout(() => setState({...state}), 600));
})();
