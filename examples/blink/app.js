const app = require("makestack");

app.onReady((device) => {
    const LED_PIN = 22;
    device.pinMode(LED_PIN, "OUTPUT");
    while (1) {
        device.print("Blinking!");
        device.digitalWrite(LED_PIN, "HIGH");
        device.delay(1000);
        device.digitalWrite(LED_PIN, "LOW");
        device.delay(1000);
    }
});
