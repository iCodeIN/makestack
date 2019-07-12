const { server } = require("makestack");

server.http.get("/foo", (req, res) => {
    res.send("Hello from foo!\n\n");
});

device.onReady(() => {
    const LED_PIN = 22;
    print("Hello World!");
    pinMode(22, "OUTPUT");
    while (1) {
        digitalWrite(LED_PIN, "HIGH");
        delay(100);
        digitalWrite(LED_PIN, "LOW");
        delay(100);
    }
});
