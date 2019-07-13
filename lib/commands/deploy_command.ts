import {
    Args,
    Command,
    Opts,
    CLOUD_OPTS,
    BOARD_OPTS,
    APP_OPTS,
} from "./command";
import { buildApp } from "../firmware";
import { logger } from "../logger";
import { DeployOptions } from "../clouds";

export class DeployCommand extends Command {
    public static command = "deploy";
    public static desc = "";
    public static args = [];
    public static opts = [
        ...APP_OPTS,
        ...BOARD_OPTS,
        ...CLOUD_OPTS
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
