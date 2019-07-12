const { device, server } = require("makestack");

server.http.get("/foo", (req, res) => {
    res.send("Hello from foo!\n\n");
});

server.onEvent("hello", (value) => {
    console.log("received hello:", value);
});

device.onReady(() => {
    const LED_PIN = 22;
    print("Hello World!");
    pinMode(22, "OUTPUT");
    while (1) {
        print("publishing...");
        publish("hello", 17184321);
        delay(1000);
    }
});
