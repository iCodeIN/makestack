import * as fs from "fs";
import * as esp32 from "../boards/esp32";
import * as main from "../main";

test("build examples/blink", async () => {
    jest.setTimeout(60000 * 15);

    const firmwarePath = esp32.getFirmwarePath();
    if (fs.existsSync(firmwarePath)) {
        fs.unlinkSync(firmwarePath);
    }

    await main.run(["build", "--app-dir", "examples/blink", "--board", "esp32"]);

    expect(fs.existsSync(firmwarePath)).toBeTruthy();
})
