import {
    Args,
    Command,
    Opts,
    DEVICE_FILE_OPTS,
    BUILD_OPTS,
} from "./command";
import { Board } from "../boards";
import { buildApp } from "../firmware";
import { logger } from "../logger";

export class FlashCommand extends Command {
    public static command = "flash";
    public static desc = "";
    public static args = [];
    public static opts = [
        ...BUILD_OPTS,
        ...DEVICE_FILE_OPTS,
    ];

    public async run(_args: Args, opts: Opts) {
        const board: Board = opts.board;
        await buildApp(board, opts.appDir);

        logger.progress("Flashing...");
        await board.flashFirmware(opts.device, board.getFirmwarePath());
        logger.success("Done!");
    }
}
