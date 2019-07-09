import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import {
    Args,
    Command,
    Opts,
    validateAppDir,
    validateBoardType,
    validateDeviceFilePath,
} from "./command";
import { Board } from "../boards";
import { logger } from "../logger";
import { parsePayload, constructPayload } from "../protocol";
import { extractCredentials, buildApp } from "../firmware";
import { SerialAdapter, WiFiAdapter } from "../adapters";
import { bytesToReadableString } from "../helpers";

export class DevCommand extends Command {
    public static command = "dev";
    public static desc = "";
    public static args = [];
    public static opts = [
        {
            name: "--device <path>",
            desc: "The device file path.",
            default: "",
            validator: validateDeviceFilePath,
        },
        {
            name: "--baudrate <rate>",
            desc: "The serial port device file.",
            default: 115200,
        },
        {
            name: "--app-dir <path>",
            desc: "The app directory.",
            default: process.cwd(),
            validator: validateAppDir,
        },
        // TODO: get the board type from package.json
        {
            name: "--board <board>",
            desc: "The board type (only 'esp32' for now).",
            default: "esp32",
            validator: validateBoardType,
        },
        {
            name: "--adapter <adapter>",
            desc: "The adapter type ('serial' or 'wifi').",
            default: "serial",
        },
    ];

    private board!: Board;
    private firmwareVersion!: number;
    private firmwareImage!: Buffer;
    private verifiedPong: boolean = false;

    public async run(args: Args, opts: Opts) {
        this.board = opts.board;

        // First, build the firmware. We need the firmware file in order to send
        // the latest version info in a heartbeat.
        if (!(await this.build(opts.appDir))) {
            logger.error("fix build errors and run the command again");
            process.exit(1);
        }

        switch (opts.adapter) {
            case "serial":
                const serialAdapter = new SerialAdapter();
                await serialAdapter.open(opts.device, opts.baudrate, payload => {

                    const reply = this.processPayload(payload);
                    if (reply) {
                        serialAdapter.send(reply);
                    }
                });

                // Send heartbeats regularly.
                // TODO: Disable heartbeaing on firmware updating.
                serialAdapter.send(this.buildHeartbeatPayload());
                setInterval(() => {
                    serialAdapter.send(this.buildHeartbeatPayload());
                }, 2000);

                // Make sure that connected device is running the our firmware.
                setTimeout(() => {
                    if (!this.verifiedPong) {
                        logger.error(
                            "The device doesn't respond our health check.\nHint: Run `makestack flash --dev` to install the firmware."
                        );
                        process.exit(1);
                    }
                }, 5000);
                break;
            case "wifi":
                const wifiAdapter = new WiFiAdapter();
                wifiAdapter.start(payload => {
                    let reply = this.processPayload(payload);
                    if (!reply) {
                        reply = this.buildHeartbeatPayload();
                    }
                    return reply;
                });
                break;
            default:
                throw new Error(`Unknown adapter type: \`${opts.adapter}'`);
        }

        // Watch for the app source files.
        fs.watch(opts.appDir, async (_event: string, filename: string) => {
            const appFile = path.join(opts.appDir, "app.js");
            if (filename == "app.js" && fs.existsSync(appFile)) {
                logger.progress("Change detected, rebuilding...");
                await this.build(opts.appDir);
            }
        });

        logger.success(
            `We're ready! Watching for changes on ${opts.appDir}...`
        );
    }

    private async build(appDir: string) {
        if (!(await buildApp(this.board, appDir))) {
            return false;
        }

        this.firmwareVersion = extractCredentials(
            this.board.getFirmwarePath()
        ).version;
        this.firmwareImage = fs.readFileSync(this.board.getFirmwarePath());
        return true;
    }

    private buildHeartbeatPayload(): Buffer {
        return constructPayload({
            version: this.firmwareVersion,
            ping: {
                data: Buffer.from("HELO"),
            },
            corruptRateCheck: {
                length: 512,
            },
        });
    }

    private processPayload(rawPayload: Buffer):  Buffer | null {
        const payload = parsePayload(rawPayload);
        if (payload.deviceStatus) {
            const { ramFree } = payload.deviceStatus;
            console.log(`ram free: ${ramFree} bytes (${bytesToReadableString(ramFree)})`);
        }

        if (payload.log) {
            for (const line of payload.log.split("\n")) {
                console.log("device log:", line);
            }
        }

        if (payload.pong) {
            this.verifiedPong = true;
        }

        if (payload.firmwareRequest) {
            if (payload.firmwareRequest.version != this.firmwareVersion) {
                logger.warn(
                    `invalid version: ${payload.firmwareRequest.version}`
                );
                return null;
            }

            const offset = payload.firmwareRequest.offset;
            const DATA_LEN = 8192;
            const data = this.firmwareImage.slice(offset, offset + DATA_LEN);
            let firmwareDataPayload;
            if (data.length > 0) {
                const compressed = zlib.deflateSync(data);
                if (compressed.length < data.length) {
                    firmwareDataPayload = constructPayload({
                        firmwareData: {
                            offset,
                            type: "deflate",
                            data: compressed,
                        },
                    });
                } else {
                    firmwareDataPayload = constructPayload({
                        firmwareData: { offset, type: "raw", data },
                    });
                }
            } else {
                firmwareDataPayload = constructPayload({
                    firmwareData: { offset, type: "eof", data },
                });
            }

            console.log(
                `Uploading len=${data.length}, offset=${offset} (${Math.floor(
                    (offset / this.firmwareImage.length) * 100
                )}%)`
            );

            return firmwareDataPayload;
        }

        return null;
    }
}
