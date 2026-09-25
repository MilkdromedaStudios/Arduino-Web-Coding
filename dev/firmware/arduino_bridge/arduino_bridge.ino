#include <Arduino.h>
#include <Servo.h>
#include <Wire.h>

// Arduino Web Test bridge firmware.
// Host -> board:  @<id>\t<COMMAND>\t<arg1>\t<arg2>...\n
// Board -> host:  @<id>\tOK\t<value>\n  or  @<id>\tERR\t<message>\n
//
// This protocol deliberately stays simple so custom boards/equipment can extend it
// without adding a JSON library. Edit handleCustomCommand() near the bottom to add
// project-specific hardware while keeping the browser editor unchanged.

static const uint32_t SERIAL_BAUD = 115200;
static const size_t LINE_BUFFER_SIZE = 768;
static const uint8_t MAX_ARGS = 10;
static const uint8_t MAX_SERVOS = 8;

char lineBuffer[LINE_BUFFER_SIZE];
size_t lineLength = 0;

struct ServoSlot {
  bool used;
  int pin;
  Servo servo;
};

ServoSlot servoSlots[MAX_SERVOS];

long parseNumber(const char *text) {
  if (!text) return 0;
  return strtol(text, nullptr, 0);
}

bool startsWithIgnoreCase(const char *text, const char *prefix) {
  while (*prefix) {
    if (!*text) return false;
    char a = *text++;
    char b = *prefix++;
    if (a >= 'a' && a <= 'z') a -= 32;
    if (b >= 'a' && b <= 'z') b -= 32;
    if (a != b) return false;
  }
  return true;
}

int parsePin(const char *text) {
  if (!text || !*text) return -1;

  if ((text[0] == 'A' || text[0] == 'a') && isDigit(text[1])) {
    int index = atoi(text + 1);
#if defined(A0)
    if (index == 0) return A0;
#endif
#if defined(A1)
    if (index == 1) return A1;
#endif
#if defined(A2)
    if (index == 2) return A2;
#endif
#if defined(A3)
    if (index == 3) return A3;
#endif
#if defined(A4)
    if (index == 4) return A4;
#endif
#if defined(A5)
    if (index == 5) return A5;
#endif
#if defined(A6)
    if (index == 6) return A6;
#endif
#if defined(A7)
    if (index == 7) return A7;
#endif
#if defined(A8)
    if (index == 8) return A8;
#endif
#if defined(A9)
    if (index == 9) return A9;
#endif
#if defined(A10)
    if (index == 10) return A10;
#endif
#if defined(A11)
    if (index == 11) return A11;
#endif
#if defined(A12)
    if (index == 12) return A12;
#endif
#if defined(A13)
    if (index == 13) return A13;
#endif
#if defined(A14)
    if (index == 14) return A14;
#endif
#if defined(A15)
    if (index == 15) return A15;
#endif
    return -1;
  }

  if ((text[0] == 'D' || text[0] == 'd') && isDigit(text[1])) return atoi(text + 1);
  return atoi(text);
}

void replyPrefix(const char *id, bool ok) {
  Serial.print('@');
  Serial.print(id);
  Serial.print('\t');
  Serial.print(ok ? F("OK") : F("ERR"));
  Serial.print('\t');
}

void replyOK(const char *id, const char *value = "") {
  replyPrefix(id, true);
  Serial.println(value);
}

void replyOKNumber(const char *id, long value) {
  replyPrefix(id, true);
  Serial.println(value);
}

void replyERR(const char *id, const __FlashStringHelper *message) {
  replyPrefix(id, false);
  Serial.println(message);
}

ServoSlot *findServo(int pin, bool createIfMissing) {
  ServoSlot *freeSlot = nullptr;
  for (uint8_t i = 0; i < MAX_SERVOS; i++) {
    if (servoSlots[i].used && servoSlots[i].pin == pin) return &servoSlots[i];
    if (!servoSlots[i].used && freeSlot == nullptr) freeSlot = &servoSlots[i];
  }
  if (!createIfMissing || !freeSlot) return nullptr;
  freeSlot->used = true;
  freeSlot->pin = pin;
  return freeSlot;
}

void detachServo(int pin) {
  ServoSlot *slot = findServo(pin, false);
  if (!slot) return;
  if (slot->servo.attached()) slot->servo.detach();
  slot->used = false;
  slot->pin = -1;
}

uint8_t splitTabs(char *line, char **parts, uint8_t maxParts) {
  uint8_t count = 0;
  char *cursor = line;
  while (cursor && count < maxParts) {
    parts[count++] = cursor;
    char *tab = strchr(cursor, '\t');
    if (!tab) break;
    *tab = '\0';
    cursor = tab + 1;
  }
  return count;
}

bool parseBool(const char *text) {
  if (!text) return false;
  return strcmp(text, "1") == 0 || startsWithIgnoreCase(text, "HIGH") || startsWithIgnoreCase(text, "TRUE") || startsWithIgnoreCase(text, "ON");
}

long clampLong(long value, long minimum, long maximum) {
  if (value < minimum) return minimum;
  if (value > maximum) return maximum;
  return value;
}

void handleI2CWrite(const char *id, char **args, uint8_t count) {
  if (count < 3) {
    replyERR(id, F("I2CW requires address, register, data"));
    return;
  }

  uint8_t address = (uint8_t)parseNumber(args[0]);
  uint8_t reg = (uint8_t)parseNumber(args[1]);
  Wire.beginTransmission(address);
  Wire.write(reg);

  char dataCopy[256];
  strncpy(dataCopy, args[2], sizeof(dataCopy) - 1);
  dataCopy[sizeof(dataCopy) - 1] = '\0';
  char *token = strtok(dataCopy, ",");
  while (token) {
    Wire.write((uint8_t)parseNumber(token));
    token = strtok(nullptr, ",");
  }

  uint8_t result = Wire.endTransmission();
  if (result == 0) replyOK(id, "0");
  else {
    replyPrefix(id, false);
    Serial.print(F("I2C error "));
    Serial.println(result);
  }
}

void handleI2CRead(const char *id, char **args, uint8_t count) {
  if (count < 3) {
    replyERR(id, F("I2CR requires address, register, length"));
    return;
  }

  uint8_t address = (uint8_t)parseNumber(args[0]);
  uint8_t reg = (uint8_t)parseNumber(args[1]);
  uint8_t length = (uint8_t)clampLong(parseNumber(args[2]), 1, 32);

  Wire.beginTransmission(address);
  Wire.write(reg);
  uint8_t result = Wire.endTransmission(false);
  if (result != 0) {
    replyPrefix(id, false);
    Serial.print(F("I2C error "));
    Serial.println(result);
    return;
  }

  uint8_t received = Wire.requestFrom((int)address, (int)length);
  replyPrefix(id, true);
  for (uint8_t i = 0; i < received && Wire.available(); i++) {
    if (i) Serial.print(',');
    Serial.print(Wire.read());
  }
  Serial.println();
}

// Project hook for arbitrary hardware. The browser sends:
// CUSTOM, deviceName, deviceType, port, operation, settingsJSON, data
// Return true if you handled the request and printed exactly one protocol response.
bool handleCustomCommand(
  const char *requestId,
  const char *deviceName,
  const char *deviceType,
  const char *port,
  const char *operation,
  const char *settingsJSON,
  const char *data
) {
  (void)requestId;
  (void)deviceName;
  (void)deviceType;
  (void)port;
  (void)operation;
  (void)settingsJSON;
  (void)data;

  // Example:
  // if (strcmp(deviceType, "relay") == 0) {
  //   int pin = parsePin(port);
  //   pinMode(pin, OUTPUT);
  //   digitalWrite(pin, parseBool(data) ? HIGH : LOW);
  //   replyOK(requestId, "done");
  //   return true;
  // }

  return false;
}

void handleCommand(char *line) {
  if (line[0] != '@') return;

  char *parts[MAX_ARGS + 3];
  uint8_t partCount = splitTabs(line, parts, MAX_ARGS + 3);
  if (partCount < 2) return;

  const char *id = parts[0] + 1;
  const char *command = parts[1];
  char **args = parts + 2;
  uint8_t argCount = partCount - 2;

  if (strcmp(command, "PING") == 0) {
    replyOK(id, "PONG");
    return;
  }

  if (strcmp(command, "PINMODE") == 0) {
    if (argCount < 2) { replyERR(id, F("PINMODE requires pin and mode")); return; }
    int pin = parsePin(args[0]);
    if (startsWithIgnoreCase(args[1], "OUTPUT")) pinMode(pin, OUTPUT);
    else if (startsWithIgnoreCase(args[1], "PULLUP") || startsWithIgnoreCase(args[1], "INPUT_PULLUP")) pinMode(pin, INPUT_PULLUP);
    else pinMode(pin, INPUT);
    replyOK(id, "done");
    return;
  }

  if (strcmp(command, "DWRITE") == 0) {
    if (argCount < 2) { replyERR(id, F("DWRITE requires pin and value")); return; }
    int pin = parsePin(args[0]);
    pinMode(pin, OUTPUT);
    digitalWrite(pin, parseBool(args[1]) ? HIGH : LOW);
    replyOK(id, "done");
    return;
  }

  if (strcmp(command, "DREAD") == 0) {
    if (argCount < 1) { replyERR(id, F("DREAD requires pin")); return; }
    int pin = parsePin(args[0]);
    pinMode(pin, INPUT);
    replyOKNumber(id, digitalRead(pin));
    return;
  }

  if (strcmp(command, "PWM") == 0) {
    if (argCount < 2) { replyERR(id, F("PWM requires pin and value")); return; }
    int pin = parsePin(args[0]);
    pinMode(pin, OUTPUT);
    analogWrite(pin, (int)clampLong(parseNumber(args[1]), 0, 255));
    replyOK(id, "done");
    return;
  }

  if (strcmp(command, "AREAD") == 0) {
    if (argCount < 1) { replyERR(id, F("AREAD requires pin")); return; }
    replyOKNumber(id, analogRead(parsePin(args[0])));
    return;
  }

  if (strcmp(command, "SERVO") == 0) {
    if (argCount < 2) { replyERR(id, F("SERVO requires pin and angle")); return; }
    int pin = parsePin(args[0]);
    int angle = (int)clampLong(parseNumber(args[1]), 0, 180);
    int minPulse = argCount > 2 ? (int)clampLong(parseNumber(args[2]), 400, 2000) : 544;
    int maxPulse = argCount > 3 ? (int)clampLong(parseNumber(args[3]), 1800, 3000) : 2400;
    ServoSlot *slot = findServo(pin, true);
    if (!slot) { replyERR(id, F("No free servo slots")); return; }
    if (!slot->servo.attached()) slot->servo.attach(pin, minPulse, maxPulse);
    slot->servo.write(angle);
    replyOK(id, "done");
    return;
  }

  if (strcmp(command, "SERVO_DETACH") == 0) {
    if (argCount < 1) { replyERR(id, F("SERVO_DETACH requires pin")); return; }
    detachServo(parsePin(args[0]));
    replyOK(id, "done");
    return;
  }

  if (strcmp(command, "TONE") == 0) {
    if (argCount < 2) { replyERR(id, F("TONE requires pin and frequency")); return; }
    int pin = parsePin(args[0]);
    unsigned int frequency = (unsigned int)clampLong(parseNumber(args[1]), 1, 30000);
    unsigned long duration = argCount > 2 ? (unsigned long)max(0L, parseNumber(args[2])) : 0;
    if (duration > 0) tone(pin, frequency, duration);
    else tone(pin, frequency);
    replyOK(id, "done");
    return;
  }

  if (strcmp(command, "NOTONE") == 0) {
    if (argCount < 1) { replyERR(id, F("NOTONE requires pin")); return; }
    noTone(parsePin(args[0]));
    replyOK(id, "done");
    return;
  }

  if (strcmp(command, "MOTOR") == 0) {
    if (argCount < 4) { replyERR(id, F("MOTOR requires IN1, IN2, PWM, speed")); return; }
    int in1 = parsePin(args[0]);
    int in2 = parsePin(args[1]);
    int pwm = parsePin(args[2]);
    long speed = clampLong(parseNumber(args[3]), -100, 100);
    pinMode(in1, OUTPUT);
    pinMode(in2, OUTPUT);
    pinMode(pwm, OUTPUT);
    if (speed > 0) {
      digitalWrite(in1, HIGH);
      digitalWrite(in2, LOW);
    } else if (speed < 0) {
      digitalWrite(in1, LOW);
      digitalWrite(in2, HIGH);
    } else {
      digitalWrite(in1, LOW);
      digitalWrite(in2, LOW);
    }
    analogWrite(pwm, map(abs(speed), 0, 100, 0, 255));
    replyOK(id, "done");
    return;
  }

  if (strcmp(command, "USONIC") == 0) {
    if (argCount < 2) { replyERR(id, F("USONIC requires trigger and echo pins")); return; }
    int triggerPin = parsePin(args[0]);
    int echoPin = parsePin(args[1]);
    long maxCM = argCount > 2 ? clampLong(parseNumber(args[2]), 2, 1000) : 400;
    unsigned long timeoutUS = (unsigned long)maxCM * 60UL;
    pinMode(triggerPin, OUTPUT);
    pinMode(echoPin, INPUT);
    digitalWrite(triggerPin, LOW);
    delayMicroseconds(2);
    digitalWrite(triggerPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(triggerPin, LOW);
    unsigned long duration = pulseIn(echoPin, HIGH, timeoutUS);
    if (duration == 0) replyOKNumber(id, -1);
    else replyOKNumber(id, (long)(duration / 58UL));
    return;
  }

  if (strcmp(command, "TOUCH") == 0) {
    if (argCount < 1) { replyERR(id, F("TOUCH requires pin")); return; }
    const char *pinText = args[0];
    int pin = parsePin(pinText);
    long threshold = argCount > 1 ? parseNumber(args[1]) : 500;
    bool analogStyle = pinText[0] == 'A' || pinText[0] == 'a';
    if (analogStyle) replyOKNumber(id, analogRead(pin) >= threshold ? 1 : 0);
    else {
      pinMode(pin, INPUT);
      replyOKNumber(id, digitalRead(pin) == HIGH ? 1 : 0);
    }
    return;
  }

  if (strcmp(command, "AMP") == 0) {
    if (argCount < 1) { replyERR(id, F("AMP requires analog pin")); return; }
    int pin = parsePin(args[0]);
    int samples = argCount > 1 ? (int)clampLong(parseNumber(args[1]), 1, 256) : 32;
    int low = 32767;
    int high = -32768;
    for (int i = 0; i < samples; i++) {
      int value = analogRead(pin);
      if (value < low) low = value;
      if (value > high) high = value;
    }
    replyOKNumber(id, high - low);
    return;
  }

  if (strcmp(command, "REC") == 0) {
    if (argCount < 2) { replyERR(id, F("REC requires pin and sample count")); return; }
    int pin = parsePin(args[0]);
    int samples = (int)clampLong(parseNumber(args[1]), 1, 128);
    unsigned int intervalUS = argCount > 2 ? (unsigned int)clampLong(parseNumber(args[2]), 50, 60000) : 500;
    replyPrefix(id, true);
    for (int i = 0; i < samples; i++) {
      if (i) Serial.print(',');
      Serial.print(analogRead(pin));
      if (i + 1 < samples) delayMicroseconds(intervalUS);
    }
    Serial.println();
    return;
  }

  if (strcmp(command, "I2CW") == 0) {
    handleI2CWrite(id, args, argCount);
    return;
  }

  if (strcmp(command, "I2CR") == 0) {
    handleI2CRead(id, args, argCount);
    return;
  }

  if (strcmp(command, "CUSTOM") == 0) {
    if (argCount < 6) { replyERR(id, F("CUSTOM requires name,type,port,operation,settings,data")); return; }
    if (!handleCustomCommand(id, args[0], args[1], args[2], args[3], args[4], args[5])) {
      replyERR(id, F("Custom device is not implemented in bridge firmware"));
    }
    return;
  }

  replyERR(id, F("Unknown command"));
}

void setup() {
  Serial.begin(SERIAL_BAUD);
  Wire.begin();
  for (uint8_t i = 0; i < MAX_SERVOS; i++) {
    servoSlots[i].used = false;
    servoSlots[i].pin = -1;
  }
}

void loop() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\r') continue;
    if (c == '\n') {
      lineBuffer[lineLength] = '\0';
      if (lineLength > 0) handleCommand(lineBuffer);
      lineLength = 0;
      continue;
    }

    if (lineLength + 1 < LINE_BUFFER_SIZE) {
      lineBuffer[lineLength++] = c;
    } else {
      lineLength = 0;
      Serial.println(F("@0\tERR\tInput line too long"));
    }
  }
}
