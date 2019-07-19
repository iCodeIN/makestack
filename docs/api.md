# API Reference

## The makestack package
`makestack` creates a makestack app:
```js
const app = require("makestack")
```

## Server-side APIs
### app.get()
Registers a HTTP GET request handler.
- **Definition:** `(path: string, (req: express.Request, res: express.Response) => void): void`
- **Example:**
    ```js
    app.get("/hello", (req, res) => {
        res.send("Hello!")
    })
    ```

### app.post()
Registers a HTTP POST request handler.
- **Definition:** `(path: string, (req: express.Request, res: express.Response) => void): void`
- **Example:**
    ```js
    app.post("/hello", (req, res) => {
        res.send("Hello!")
    })
    ```

### app.put()
Registers a HTTP PUT request handler.
- **Definition:** `(path: string, (req: express.Request, res: express.Response) => void): void`
- **Example:**
    ```js
    app.put("/hello", (req, res) => {
        res.send("Hello!")
    })
    ```

### app.delete()
Registers a HTTP DELETE request handler.
- **Definition:** `(path: string, (req: express.Request, res: express.Response) => void): void`
- **Example:**
    ```js
    app.delete("/hello", (req, res) => {
        res.send("Hello!")
    })
    ```

### app.onEvent()
Registers a device event handler. A device event can be emitted from the device using `publish` API.
- **Definition:** `(eventName: string, (value: boolean | number | string) => void): void`
- **Example:**
    ```js
    app.onEvent("my-sensor-data", async (value) => {
        await slack.chat.postMessage({ channel: "sensor", text: `sensor data; ${value}` })
    })
    ```

## Device-side APIs
Device APIs are available only in *device contexts*, such as the callback of `app.onReady`.

### app.onReady()
Registers a device-side handler when the device gets ready to start the app. Just like `setup()` function in the Arduino.
- **Definition:** `((device: DeviceAPI) => void): void`
- **Example:**
    ```js
    app.onReady((device) => {
        while (1) {
            device.print("Hello World!");
            deivce.delaySeconds(3);
        }
    })
    ```

### device.publish()
Sends a value to the server as a device event.
- **Definition:** `(eventName: string, value: boolean | number | string): void`
- **Example:**
    ```js
    device.publish("my-sensor-data", analogRead(10));
    ```
