import React from 'react';

import styles from './python-editor.css';

const STORAGE_KEY = 'arduino-web-coding:python:v1';
const DEFAULT_CODE = `# Arduino Web Coding — Python\n# Use this tab for boards that support MicroPython or CircuitPython.\n\nfrom time import sleep\n\n# Example:\n# from machine import Pin\n# led = Pin(2, Pin.OUT)\n# while True:\n#     led.value(not led.value())\n#     sleep(0.5)\n`;

const loadCode = () => {
    try {
        return localStorage.getItem(STORAGE_KEY) || DEFAULT_CODE;
    } catch (e) {
        return DEFAULT_CODE;
    }
};

const saveCode = code => {
    try {
        localStorage.setItem(STORAGE_KEY, code);
    } catch (e) {
        // Local persistence is optional.
    }
};

const PythonEditor = () => {
    const [code, setCode] = React.useState(loadCode);
    const [status, setStatus] = React.useState('Saved locally');

    React.useEffect(() => {
        const timer = setTimeout(() => {
            saveCode(code);
            setStatus('Saved locally');
        }, 250);
        return () => clearTimeout(timer);
    }, [code]);

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
        setStatus('Copied');
    };

    const reset = () => {
        setCode(DEFAULT_CODE);
        setStatus('Starter code restored');
    };

    return (
        <section className={styles.wrapper}>
            <header className={styles.header}>
                <div>
                    <h2 className={styles.title}>Python</h2>
                    <p className={styles.subtitle}>Text coding for MicroPython and CircuitPython capable boards.</p>
                </div>
                <div className={styles.actions}>
                    <button className={styles.button} onClick={copy}>Copy</button>
                    <button className={styles.button} onClick={reset}>Reset</button>
                    <button className={styles.primaryButton} onClick={download}>Download .py</button>
                </div>
            </header>
            <div className={styles.editorShell}>
                <div className={styles.gutter} aria-hidden="true">
                    {code.split('\n').map((line, index) => <div key={index}>{index + 1}</div>)}
                </div>
                <textarea
                    aria-label="Python code"
                    className={styles.editor}
                    spellCheck={false}
                    value={code}
                    onChange={event => {
                        setCode(event.target.value);
                        setStatus('Saving…');
                    }}
                />
            </div>
            <footer className={styles.footer}>
                <span>{status}</span>
                <span>Python does not run on every Arduino board; use a MicroPython/CircuitPython compatible target.</span>
            </footer>
        </section>
    );
};

export default PythonEditor;
