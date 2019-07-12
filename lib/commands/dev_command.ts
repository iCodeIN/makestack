import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import * as express from "express";
import {
    Args,
    Command,
    Opts,
    APP_OPTS,
    BOARD_OPTS,
    BUILD_OPTS,
    ADAPTER_OPTS,
    validateDeviceFilePath,
} from "./command";
import { Board, BuildError } from "../boards";
import { logger } from "../logger";
import { parsePayload, constructPayload } from "../protocol";
import { extractCredentials, buildApp } from "../firmware";
import { SerialAdapter, HTTPAdapter } from "../adapters";
import { bytesToReadableString } from "../helpers";
import { DevServer } from "../dev_server";

export class DevCommand extends Command {
    public static command = "dev";
    public static desc = "";
    public static args = [];
    public static opts = [
        ...APP_OPTS,
        ...BOARD_OPTS,
        ...BUILD_OPTS,
        ...ADAPTER_OPTS,
        {
            name: "--device <path>",
            desc: "The device file path.",
        },
        {
            name: "--baudrate <rate>",
            desc: "The baudrate.",
            default: 115200,
        },
        {
            name: "--host <host>",
            desc: "The dev server hostname.",
            default: "0.0.0.0",
        },
        {
            name: "--port <port>",
            desc: "The dev server port.",
            default: 1234,
        },
    ];
    public static watchMode = true;

    private httpAdapter!: HTTPAdapter;
    private board!: Board;
    private firmwareVersion!: number;
    private devServer!: DevServer;
    private firmwareImage!: Buffer;
    private verifiedPong: boolean = false;

    public async run(_args: Args, opts: Opts) {
        this.board = opts.board;

        // First, build the firmware. We need the firmware file in order to send
        // the latest version info in a heartbeat.

        /*
        if (!(await this.build(opts.appDir))) {
            logger.error("fix build errors and run the command again");
            process.exit(1);
        }
        */

        const httpServerPort = opts.port + 1;
        const httpServer = express();
        new HTTPAdapter(httpServer, payload => {
            let reply = this.processPayload(payload);
            return reply ? reply : this.buildHeartbeatPayload();
        });
        httpServer.listen(httpServerPort, "127.0.0.1");

        logger.progress("Initializing the adapter...");
        await this.initializeAdapter(opts.adapter, opts);

        logger.progress(`Starting a app...`);
        this.devServer = new DevServer(opts.host, opts.port, httpServerPort, opts.appDir);
        logger.progress(`Listen on ${opts.host}:${opts.port}`);

        // Watch for the app source files.
        fs.watch(opts.appDir, async (_event: string, filename: string) => {
            const appFile = path.join(opts.appDir, "app.js");
            if (filename == "app.js" && fs.existsSync(appFile)) {
                logger.progress("Change detected, restarting and rebuilding the app...");
                this.devServer.restart();
                await this.build(opts.appDir);
            }
        });

        logger.success(
            `We're ready! Watching for changes on ${opts.appDir}...`
        );
    }

    private async build(appDir: string) {
        try {
            await buildApp(this.board, appDir);
        } catch (e) {
            if (e instanceof BuildError) {
                logger.error("failed to build");
                return false;
            } else {
                throw e;
            }
        }

        const firmwarePath = this.board.getFirmwarePath();
        this.firmwareVersion = extractCredentials(firmwarePath).version;
        this.firmwareImage = fs.readFileSync(firmwarePath);

        logger.success("Build succeeded");
        return true;
    }

    private async initializeAdapter(adapter: string, opts: any) {
        switch (adapter) {
            case "serial":
                // FIXME:
                const device = (validateDeviceFilePath as any)(opts.device || "");

                const serialAdapter = new SerialAdapter();
                await serialAdapter.open(device, opts.baudrate, payload => {

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
            case "http":
                /* Already running. */
                break;
            default:
                throw new Error(`Unknown adapter type: \`${adapter}'`);
        }
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
                const EVENT_REGEX = /^@(?<name>[^ ]+) (?<type>[bis]):(?<value>.*)$/;
                const m = line.match(EVENT_REGEX);
                if (m) {
                    const { name, type, value: valueStr } = m.groups!;
                    let value: any;
                    switch (type) {
                    case "b": value = (valueStr == "true"); break;
                    case "i": value = parseInt(valueStr); break;
                    case "s": value = valueStr; break;
                    default:
                        logger.warn(`unknown event type: \`${type}'`);
                        continue;
                    }

                    console.log(`event: name=${name}, value=${value}`);
                    this.devServer.sendRequest({ type: "event", name, value });
                } else {
                    console.log("device log:", line);
                }
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
