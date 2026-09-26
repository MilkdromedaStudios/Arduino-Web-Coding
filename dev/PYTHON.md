# Arduino Web Coding — Python

The `/dev` editor treats **Blocks and Python as two views of the same Arduino program**. Changes in Blocks regenerate Python, and supported Python edits rebuild the matching blocks.

The Python editor is intentionally empty for a new empty program. There is no starter template inserted automatically.

## Program start

Use:

```python
def arduino_start():
    digital_write(13, 1)
```

This corresponds to the `when Arduino starts` hat block. Use four spaces for nested code.

## Digital I/O and timing

```python
pin_mode(13, "OUTPUT")
digital_write(13, 1)
digital_write(13, 0)
built_in_led(1)
wait_ms(250)
wait_seconds(1)

digital_read(2)
button_pressed(2)
```

Pin modes: `"INPUT"`, `"INPUT_PULLUP"`, and `"OUTPUT"`.

## Analog input and PWM

```python
analog_read("A0")
analog_percent("A0")
potentiometer_percent("A0")
light_percent("A1")
analog_above("A0", 512)

pwm_write(9, 128)
led_brightness(9, 50)
rgb_led(9, 10, 11, 255, 0, 80)
```

## Servo, motor, and sound

```python
servo_write(9, 90, 544, 2400)
servo_center(9)
servo_detach(9)

motor(7, 8, 9, 60)
stop_motor(7, 8, 9)

tone(6, 440, 250)
stop_tone(6)
beep(6, 880, 100)
```

## Sensors

```python
ultrasonic_cm(4, 5, 400)
touch_pressed("A0", 500)
microphone_level("A0", 32)
```

## Value helpers

```python
map_value(value, 0, 1023, 0, 100)
constrain(value, 0, 100)
```

## Control flow

```python
if button_pressed(2):
    built_in_led(1)
else:
    built_in_led(0)

for _ in range(10):
    beep(6, 880, 100)

while True:
    wait_ms(100)
```

Supported synchronized expression operators include `+`, `-`, `*`, `/`, `%`, `<`, `>`, `==`, `and`, `or`, and `not`.

## I²C and custom ports

```python
i2c_write("0x3C", 0, "1,2,3")
define_port("leftMotor", 9)
```

## Sync behavior

- Block changes update Python automatically.
- Supported Python changes update Blocks automatically after a short typing debounce.
- Python that cannot currently be represented as blocks produces a **Sync error** and leaves the existing Blocks program unchanged.
- The synchronized Python syntax is deliberately constrained so round-tripping never silently deletes unsupported logic.
- The Python workspace and its documentation panel use a dark interface.

## Site routing

The Arduino editor remains under `/dev/`. It is **not** the default/root site; the repository's normal root application remains the default deployment.
