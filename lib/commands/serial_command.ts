import {
    Args,
    Command,
    Opts,
    validateDeviceFilePath,
} from "./command";
import * as SerialPort from "serialport";
const SerialPortDelimiter = require("@serialport/parser-delimiter");

function printLines(device: string, baudRate: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const serial = new SerialPort(device, { baudRate });
        serial.on("error", reject);
        serial.on("open", () => {
            const delimiter = Buffer.from([0x0a]);
            const serialLines = serial!.pipe(
                new SerialPortDelimiter({ delimiter })
            );
            serialLines.on("data", (line: Buffer) => {
                console.log(line.toString("ascii").replace(/\r?\n$/, ""));
            });

            resolve();
        });
    });
}

export class SerialCommand extends Command {
    public static command = "serial";
    public static desc = "";
    public static args = [];
    public static opts = [
        {
            name: "--device <path>",
            desc: "The serial port device file.",
            default: "",
            validator: validateDeviceFilePath,
        },
        {
            name: "--baudrate <rate>",
            desc: "The serial port device file.",
            default: 115200,
        },
    ];

    public async run(args: Args, opts: Opts) {
        await printLines(opts.device, opts.baudrate);
    }
}
