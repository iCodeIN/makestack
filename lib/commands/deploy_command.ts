import {
    Args,
    Command,
    Opts,
    validateAppDir,
    validateBoardType,
    validateCloudType,
} from "./command";
import { buildApp } from "../firmware";
import { logger } from "../logger";
import { DeployOptions } from "../clouds";

export class DeployCommand extends Command {
    public static command = "deploy";
    public static desc = "";
    public static args = [];
    public static opts = [
        {
            name: "--app-dir <path>",
            desc: "The app directory.",
            default: process.cwd(),
            validator: validateAppDir,
        },
        {
            name: "--board <board>",
            desc: "The board type (only 'esp32' for now).",
            default: "esp32",
            validator: validateBoardType,
        },
        {
            name: "--cloud <cloud>",
            desc: "The cloud (only 'firebase' for now).",
            default: "firebase",
            validator: validateCloudType,
        },
        {
            name: "--firebase-project <name>",
            desc: "The Firebase project name.",
        },
    ];

    public async run(args: Args, opts: Opts) {
        logger.progress("Building the firmware...");
        await buildApp(opts.board, opts.appDir);
        await opts.cloud.deploy(
            opts.appDir,
            opts.board.getFirmwarePath(),
            opts as DeployOptions
        );
    }
}
