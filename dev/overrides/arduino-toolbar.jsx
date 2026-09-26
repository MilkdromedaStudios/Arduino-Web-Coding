import PropTypes from 'prop-types';
import React from 'react';
import VM from 'scratch-vm';

import styles from './arduino-toolbar.css';

const getAPI = () => window.__ARDUINO_WEB_TEST__;

const ArduinoToolbar = ({vm}) => {
    const [method, setMethod] = React.useState('usb');
    const [state, setState] = React.useState({connected: false, status: 'Loading Arduino extension…'});
    const [showSettings, setShowSettings] = React.useState(false);
    const [alias, setAlias] = React.useState('');
    const [physical, setPhysical] = React.useState('');
    const [, forceRefresh] = React.useState(0);

    React.useEffect(() => {
        const update = event => setState(event.detail || {});
        window.addEventListener('arduino-web-test-state', update);
        const timer = setInterval(() => {
            const api = getAPI();
            if (api) {
                setState(api.getState());
                forceRefresh(value => value + 1);
                clearInterval(timer);
            }
        }, 150);
        return () => {
            clearInterval(timer);
            window.removeEventListener('arduino-web-test-state', update);
        };
    }, [vm]);

    const run = async action => {
        const api = getAPI();
        if (!api) {
            setState({connected: false, status: 'Arduino extension is still loading.'});
            return;
        }
        try {
            await action(api);
            setState(api.getState());
        } catch (error) {
            setState({...api.getState(), status: error.message || String(error)});
        }
    };

    const startBlocks = () => {
        vm.runtime.startHats('arduinoDynamic_whenArduinoStarts');
        setState(current => ({...current, status: 'Arduino block program started'}));
    };

    const stopBlocks = () => {
        vm.stopAll();
        setState(current => ({...current, status: 'Block program stopped'}));
    };

    const settings = getAPI() ? getAPI().getSettings() : {};

    return (
        <aside className={styles.toolbar}>
            <div className={styles.header}>
                <strong>Arduino</strong>
                <span className={state.connected ? styles.online : styles.offline} />
            </div>

            <label className={styles.label} htmlFor="arduino-transport">Connection</label>
            <select
                id="arduino-transport"
                className={styles.input}
                value={method}
                onChange={event => setMethod(event.target.value)}
            >
                <option value="usb">USB cable</option>
                <option value="bluetooth">Bluetooth</option>
            </select>

            <div className={styles.row}>
                <button
                    className={styles.primaryButton}
                    onClick={() => run(api => api.connect(method))}
                >
                    Connect
                </button>
                <button
                    className={styles.button}
                    onClick={() => run(api => api.disconnect())}
                >
                    Disconnect
                </button>
            </div>

            <div className={styles.row}>
                <button className={styles.primaryButton} onClick={startBlocks}>Run blocks</button>
                <button className={styles.button} onClick={stopBlocks}>Stop</button>
            </div>

            <button
                className={styles.uploadButton}
                onClick={() => run(api => api.chooseAndUpload(method))}
            >
                Upload firmware…
            </button>

            <div className={styles.status}>{state.status || 'Not connected'}</div>

            <button
                className={styles.settingsToggle}
                onClick={() => setShowSettings(!showSettings)}
            >
                {showSettings ? 'Hide settings' : 'Connection settings'}
            </button>

            {showSettings ? (
                <div className={styles.settings}>
                    <label className={styles.label}>USB baud rate</label>
                    <input
                        className={styles.input}
                        type="number"
                        defaultValue={settings.usbBaudRate || 115200}
                        onBlur={event => getAPI()?.updateSettings({usbBaudRate: Number(event.target.value)})}
                    />
                    <label className={styles.label}>AVR bootloader baud</label>
                    <input
                        className={styles.input}
                        type="number"
                        defaultValue={settings.bootloaderBaudRate || 115200}
                        onBlur={event => getAPI()?.updateSettings({bootloaderBaudRate: Number(event.target.value)})}
                    />
                    <label className={styles.label}>BLE service UUID</label>
                    <input
                        className={styles.input}
                        defaultValue={settings.bleService || ''}
                        onBlur={event => getAPI()?.updateSettings({bleService: event.target.value.trim()})}
                    />
                    <label className={styles.label}>BLE write / OTA characteristic</label>
                    <input
                        className={styles.input}
                        defaultValue={settings.bleWriteCharacteristic || ''}
                        onBlur={event => getAPI()?.updateSettings({bleWriteCharacteristic: event.target.value.trim()})}
                    />
                    <label className={styles.label}>BLE notify characteristic</label>
                    <input
                        className={styles.input}
                        defaultValue={settings.bleNotifyCharacteristic || ''}
                        onBlur={event => getAPI()?.updateSettings({bleNotifyCharacteristic: event.target.value.trim()})}
                    />
                    <label className={styles.label}>BLE packet size</label>
                    <input
                        className={styles.input}
                        type="number"
                        min="20"
                        max="512"
                        defaultValue={settings.blePacketSize || 20}
                        onBlur={event => getAPI()?.updateSettings({blePacketSize: Number(event.target.value)})}
                    />
                </div>
            ) : null}

            <div className={styles.divider} />
            <div className={styles.subheading}>Custom port alias</div>
            <input
                className={styles.input}
                placeholder="alias, e.g. leftMotor"
                value={alias}
                onChange={event => setAlias(event.target.value)}
            />
            <input
                className={styles.input}
                placeholder="physical pin/port, e.g. 9 or A0"
                value={physical}
                onChange={event => setPhysical(event.target.value)}
            />
            <button
                className={styles.button}
                onClick={() => {
                    const api = getAPI();
                    if (api && alias.trim() && physical.trim()) {
                        api.addPort(alias.trim(), physical.trim());
                        setAlias('');
                        setPhysical('');
                    }
                }}
            >
                Add port
            </button>

            <p className={styles.note}>
                The “when Arduino starts” hat runs automatically after a connection and can also be restarted with Run blocks.
            </p>
        </aside>
    );
};

ArduinoToolbar.propTypes = {
    vm: PropTypes.instanceOf(VM).isRequired
};

export default ArduinoToolbar;
