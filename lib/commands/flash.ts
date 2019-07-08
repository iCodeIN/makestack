import {
    Args,
    Command,
    Opts,
    validateAppDir,
    validateBoardType,
} from "./command";
import { Board } from "../boards";
import { buildApp } from "../firmware";
import { logger } from "../logger";

export class FlashCommand extends Command {
    public static command = "flash";
    public static desc = "";
    public static args = [];
    public static opts = [
        // TODO: Guess the file path.
        {
            name: "--device <path>",
            desc: "The serial port device file.",
            required: true,
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
    ];

    public async run(args: Args, opts: Opts) {
        const board: Board = opts.board;
        if (!(await buildApp(board, opts.appDir))) {
            process.exit(1);
        }

        logger.progress("Flashing...");
        board.flashFirmware(opts.device, board.getFirmwarePath());
        logger.success("Done!");
    }
}
