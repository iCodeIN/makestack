# MakeStack
[![Build Status](https://travis-ci.com/seiyanuta/makestack.svg?branch=master)](https://travis-ci.com/seiyanuta/makestack)

> A minimalistic JavaScript IoT framework for rapid prototyping.

MakeStack is a connected devices software framework focused on developer experience. It offers out-of-the-box features that frees you from troublesome settings and allows you write less code.

# Warning
**MakeStack is in the very early stage. There's a lot of unimplemented language features, APIs, and issues. Help me improve this by filing bugs and submitting Pull requests!**

```js
/* Blinking LED. */
const app = require("makestack")
const SlackWebClient = require("@slack/web-api").WebClient

/* Server-side */
app.get("/test", (req, res) => {
    res.send("Hello form /test")
})

app.onEvent("blinking", async (value) => {
    const slack = new SlackWebClient("XXXXXXXXXXXXXXX")
    await slack.chat.postMessage({ channel: "dev_null", text: "Blinking!" })
})

/* Device-side */
app.onReady((device) => {
    const LED_PIN = 22
    device.pinMode(LED_PIN, "OUTPUT")
    while (1) {
        device.publish("blinking")
        device.digitalWrite(LED_PIN, "HIGH")
        device.delay(1000)
        device.digitalWrite(LED_PIN, "LOW")
        device.delay(1000)
    }
})
```

## Features
- **Single-file server-side/device-side programming in modern JavaScript** powered by the [JavaScript to C++ transpiler](transpiler).
- **Simplified development workflow:** just remember `flash`, `dev`, and `deploy` command.
- **No user registration required:** deploy everything to Firebase with just one command.
- **Intuitive JavaScript API.**
- **remote deivce firmware update.**
- **remote device log collection.**

## Examples
- [Example apps in the repository](https://github.com/seiyanuta/makestack/tree/master/examples).

## License
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) or [MIT License](https://opensource.org/licenses/MIT). Choose whichever you prefer.
