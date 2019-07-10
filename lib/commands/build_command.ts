import {
    Args,
    Command,
    Opts,
    BUILD_OPTS,
} from "./command";
import { buildApp } from "../firmware";
import { logger } from "../logger";

export class BuildCommand extends Command {
    public static command = "build";
    public static desc = "";
    public static args = [];
    public static opts = [ ...BUILD_OPTS ];
    public static watchMode = true;

    public async run(_args: Args, opts: Opts) {
        await buildApp(opts.board, opts.appDir);
        logger.success("Done");
    }
}
