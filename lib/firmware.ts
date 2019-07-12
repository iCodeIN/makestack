import * as fs from "fs";
import * as path from "path";
import { Board } from "./boards";
import { Transpiler } from "./transpiler";
import { logger } from "./logger";
import { render } from "./helpers";

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

const APP_CXX_TEMPLATE = `\
#include <makestack/vm.h>
#include <makestack/logger.h>

{{ code }}
`

// Returns true on succcess.
export async function buildApp(board: Board, appDir: string) {
    const appFile = path.join(appDir, "app.js");
    const appJs = fs.readFileSync(appFile, "utf-8");
    const transpiler = new Transpiler();
    logger.progress(`Transpiling ${appFile}`);
    const code = transpiler.transpile(appJs);
    const appCxx = render(APP_CXX_TEMPLATE, { code });
    logger.progress("Building the firmware...");
    await board.buildFirmware(appDir, appCxx);
}
