import * as fs from "fs";
import * as path from "path";
import { Board, BuildError } from "./boards";
import { transpile } from "./transpiler";
import { logger } from "./logger";

export interface Credential {
    version: number, /* FIXME: use bigint */
}

export function extractCredentials(path: string): Credential {
    const image = fs.readFileSync(path);
    const CRED_HEADER_START = "__MAKESTACK_CRED_START__";
    const start = image.indexOf(CRED_HEADER_START);
    if (start < -1) {
        throw new Error("failed to locate the credential");
    }

    const cred = image.slice(start + CRED_HEADER_START.length);
    const version = cred.readUInt32LE(0);
    return { version };
}

// Returns true on succcess.
export async function buildApp(board: Board, appDir: string): Promise<boolean> {
    const appFile = path.join(appDir, "app.js");
    const appJs = fs.readFileSync(appFile, "utf-8");
    try {
        logger.progress(`Transpiling ${appFile}`);
        const appCpp = transpile(appJs);
        logger.progress("Building the firmware...");
        await board.buildFirmware(appDir, appCpp);
    } catch(e) {
        if (e instanceof BuildError) {
            logger.error("failed to build");
            return false;
        } else {
            throw e;
        }
    }

    logger.success("Build succeeded");
    return true;
}
