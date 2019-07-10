import * as fs from "fs";
import * as path from "path";

export type Validator =
    | RegExp
    | number // Caporal flags
    | ((arg: string) => any);

export interface ArgDefinition {
    name: string;
    desc: string;
    validator?: Validator;
    default?: any;
}

export interface OptDefinition {
    name: string;
    desc: string;
    validator?: Validator;
    default?: any;
    required?: boolean;
}

export interface Args {
    [name: string]: any;
}
export interface Opts {
    [name: string]: any;
}

export abstract class Command {
    public static command: string;
    public static desc: string;
    public static args: ArgDefinition[];
    public static opts: OptDefinition[];
    public abstract async run(args: Args, opts: Opts): Promise<void>;
}

export const validateAppDir: Validator = (appDir: string): any => {
    if (!fs.existsSync(appDir)) {
        throw new Error("The app directory does not exist");
    }

    appDir = path.resolve(appDir);
    if (!fs.statSync(appDir).isDirectory()) {
        throw new Error(`${appDir} is not a directory`);
    }

    const appJs = path.join(appDir, "app.js");
    if (!fs.existsSync(appJs)) {
        throw new Error(`${appJs} does not exist`);
    }

    return appDir;
};

const availableBoardTypes = ["esp32"];
export const validateBoardType: Validator = (boardType: string): any => {
    if (!availableBoardTypes.includes(boardType)) {
        throw new Error("Invalid board type.");
    }

    return require(`../boards/${boardType}`);
};


const deviceFilePatterns = [
    /tty\.usbserial-.+/,
    /ttyUSB[0-9]/,
];
export const validateDeviceFilePath: Validator = (deviceFile: string): any => {
    if (deviceFile.length > 0) {
        return deviceFile;
    }

    const candidates = fs.readdirSync("/dev").filter((file) => {
        return deviceFilePatterns.some((pat) => pat.exec(file) !== null);
    });

    if (candidates.length === 0) {
        throw new Error("Failed to locate the device file.");
    }

    if (candidates.length > 1) {
        throw new Error("Found multiple device files. Please specify the one in the command-line option.");
    }

    return path.join("/dev", candidates[0]);
}
