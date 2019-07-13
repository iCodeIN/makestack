const app = require("makestack");

app.get("/foo", (req, res) => {
    res.send("Hello from foo!\n\n");
});

app.onEvent("hello", (value) => {
    console.log("received hello:", value);
});

app.onReady((device) => {
    const LED_PIN = 22;
    device.print("Hello World!");
    device.pinMode(22, "OUTPUT");
    device.digitalWrite(LED_PIN, "HIGH");
    while (1) {
        device.print("publishing...");
        device.publish("hello", 17184321);
        device.delay(1000);
    }
});
