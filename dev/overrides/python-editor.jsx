import React from 'react';

import {
    attachArduinoPythonSync,
    getArduinoPython,
    setArduinoPython,
    subscribeArduinoPython
} from './python-sync.js';
import styles from './python-editor.css';

const PythonDocs = () => (
    <aside className={styles.docs}>
        <div className={styles.docsScroll}>
            <h3>Arduino Python reference</h3>
            <p>
                Python and Blocks are two live views of the same program. Editing either side updates the other.
                Use the syntax below so it can always be converted back into blocks.
            </p>

            <h4>Program start</h4>
            <code>def arduino_start():</code>
            <p>Matches the <strong>when Arduino starts</strong> block. Statements inside use four-space indentation.</p>

            <h4>Digital and timing</h4>
            <code>pin_mode(13, "OUTPUT")</code>
            <code>digital_write(13, 1)</code>
            <code>built_in_led(1)</code>
            <code>wait_ms(250)</code>
            <code>wait_seconds(1)</code>
            <code>digital_read(2)</code>
            <code>button_pressed(2)</code>

            <h4>Analog and LEDs</h4>
            <code>analog_read("A0")</code>
            <code>analog_percent("A0")</code>
            <code>potentiometer_percent("A0")</code>
            <code>light_percent("A1")</code>
            <code>analog_above("A0", 512)</code>
            <code>pwm_write(9, 128)</code>
            <code>led_brightness(9, 50)</code>
            <code>rgb_led(9, 10, 11, 255, 0, 80)</code>

            <h4>Motion and sound</h4>
            <code>servo_write(9, 90, 544, 2400)</code>
            <code>servo_center(9)</code>
            <code>servo_detach(9)</code>
            <code>motor(7, 8, 9, 60)</code>
            <code>stop_motor(7, 8, 9)</code>
            <code>tone(6, 440, 250)</code>
            <code>stop_tone(6)</code>
            <code>beep(6, 880, 100)</code>

            <h4>Sensors and values</h4>
            <code>ultrasonic_cm(4, 5, 400)</code>
            <code>touch_pressed("A0", 500)</code>
            <code>microphone_level("A0", 32)</code>
            <code>map_value(value, 0, 1023, 0, 100)</code>
            <code>constrain(value, 0, 100)</code>

            <h4>Control</h4>
            <pre>{`if button_pressed(2):
    built_in_led(1)
else:
    built_in_led(0)

for _ in range(10):
    beep(6, 880, 100)

while True:
    wait_ms(100)`}</pre>

            <h4>Operators</h4>
            <p>Synced expressions support <code>+</code>, <code>-</code>, <code>*</code>, <code>/</code>, <code>%</code>, <code>&lt;</code>, <code>&gt;</code>, <code>==</code>, <code>and</code>, <code>or</code>, and <code>not</code>.</p>

            <h4>I²C and custom ports</h4>
            <code>i2c_write("0x3C", 0, "1,2,3")</code>
            <code>define_port("leftMotor", 9)</code>

            <div className={styles.docsNote}>
                If Python contains syntax that cannot be represented by the current block set, the editor shows a sync error and keeps the existing blocks unchanged instead of deleting them.
            </div>
        </div>
    </aside>
);

const PythonEditor = () => {
    const [code, setCode] = React.useState('');
    const [status, setStatus] = React.useState('Connecting to Blocks…');
    const [showDocs, setShowDocs] = React.useState(true);
    const applyTimer = React.useRef(null);
    const typing = React.useRef(false);

    React.useEffect(() => {
        let detached = null;
        let cancelled = false;
        const connect = () => {
            if (cancelled) return;
            const blocks = window.ScratchBlocks;
            const currentWorkspace = blocks && blocks.getMainWorkspace ? blocks.getMainWorkspace() : null;
            if (!blocks || !currentWorkspace) {
                window.setTimeout(connect, 100);
                return;
            }
            try {
                detached = attachArduinoPythonSync(currentWorkspace, blocks);
                const current = getArduinoPython();
                setCode(current);
                setStatus('Synced with Blocks');
            } catch (error) {
                setStatus(error.message || String(error));
                window.setTimeout(connect, 150);
            }
        };
        connect();

        const unsubscribe = subscribeArduinoPython(update => {
            if (!typing.current) setCode(update.code);
            setStatus(update.status || 'Synced with Blocks');
        });

        return () => {
            cancelled = true;
            clearTimeout(applyTimer.current);
            unsubscribe();
            if (detached) detached();
        };
    }, []);

    const updateCode = event => {
        const nextCode = event.target.value;
        typing.current = true;
        setCode(nextCode);
        setStatus('Syncing to Blocks…');
        clearTimeout(applyTimer.current);
        applyTimer.current = setTimeout(() => {
            try {
                const normalized = setArduinoPython(nextCode);
                typing.current = false;
                setCode(normalized);
                setStatus('Synced with Blocks');
            } catch (error) {
                typing.current = false;
                setStatus(`Sync error: ${error.message || String(error)}`);
            }
        }, 220);
    };

    const download = () => {
        const blob = new Blob([code], {type: 'text/x-python'});
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'main.py';
        anchor.click();
        URL.revokeObjectURL(url);
        setStatus('Downloaded main.py');
    };

    const copy = async () => {
        await navigator.clipboard.writeText(code);
        setStatus('Copied Python');
    };

    return (
        <section className={styles.wrapper}>
            <header className={styles.header}>
                <div>
                    <h2 className={styles.title}>Python</h2>
                    <p className={styles.subtitle}>Live synchronized with Blocks.</p>
                </div>
                <div className={styles.actions}>
                    <span className={styles.syncStatus}>{status}</span>
                    <button className={styles.button} onClick={() => setShowDocs(!showDocs)}>
                        {showDocs ? 'Hide docs' : 'Python docs'}
                    </button>
                    <button className={styles.button} onClick={copy}>Copy</button>
                    <button className={styles.primaryButton} onClick={download}>Download .py</button>
                </div>
            </header>
            <div className={styles.content}>
                <div className={styles.editorShell}>
                    <div className={styles.gutter} aria-hidden="true">
                        {(code || '').split('\n').map((line, index) => <div key={index}>{index + 1}</div>)}
                    </div>
                    <textarea
                        aria-label="Python code"
                        className={styles.editor}
                        placeholder="Write Arduino Python here…"
                        spellCheck={false}
                        value={code}
                        onChange={updateCode}
                    />
                </div>
                {showDocs ? <PythonDocs /> : null}
            </div>
        </section>
    );
};

export default PythonEditor;
