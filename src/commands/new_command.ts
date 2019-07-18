import * as fs from "fs";
import * as path from "path";
import * as nunjucks from "nunjucks";
import { Args, Command, Opts } from "./command";
import { logger } from "../logger";
import { exec } from "../helpers";

const PACKAGE_JSON = `\
{
    "private": true,
    "makestack": {
        "name": "{{ name }}",
        "board": "esp32"
    },
    "scripts": {
        "build": "./node_modules/.bin/tsc --outFile app.js app.ts"
    }
}
`

const APP_JS = `\
const app = require("makestack")

app.onReady((device) => {
    const LED_PIN = 22
    device.pinMode(LED_PIN, "OUTPUT")
    while (1) {
        device.print("Blinking!")
        device.digitalWrite(LED_PIN, true)
        device.delay(1000)
        device.digitalWrite(LED_PIN, false)
        device.delay(1000)
    }
})
`


const APP_TS = `\
/*
import * as app from "makestack";
import { Device } from "makestack";

app.onReady((device: Device) => {
    const LED_PIN = 22;
    device.pinMode(LED_PIN, "OUTPUT");
    while (1) {
        device.print("Blinking!");
        device.digitalWrite(LED_PIN, true);
        device.delay(1000);
        device.digitalWrite(LED_PIN, false);
        device.delay(1000);
    }
});
*/
const foo: number = 3-1;
`

const TSCONFIG_JSON = `\
{
    "compilerOptions": {
        "declaration": true,
        "sourceMap": true,
        "module": "commonjs",
        "moduleResolution": "node",
        "pretty": true,
        "alwaysStrict": true,
        "strict": true,
        "target": "es2018"
    },
    "include": [
        "./src/**/*"
    ]
}
`

const GITIGNORE = `\
node_modules
*.log
app.js
`

const DEPENDENCIES: string[] = []
const DEV_DEPENDENCIES: string[] = []
const TYPESCRIPT_DEV_DEPENDENCIES: string[] = ["typescript"]

function genFile(filepath: string, template: string, ctx: any) {
    logger.action("create", filepath);
    nunjucks.configure({ autoescape: false });
    fs.writeFileSync(filepath, nunjucks.renderString(template, ctx));
}

function mkdir(filepath: string) {
    logger.action("mkdir", filepath);
    fs.mkdirSync(filepath);
}

interface ScaffoldOptions {
    typescript: boolean,
}

function scaffold(appDir: string, opts: ScaffoldOptions) {
    if (fs.existsSync(appDir)) {
        throw new Error(`The directory alredy exists: \`${appDir}'`);
    }

    logger.progress("Generating files");
    mkdir(appDir);
    const ctx = {
        name: path.basename(appDir),
        typescript: opts.typescript,
    };

    genFile(path.join(appDir, "package.json"), PACKAGE_JSON, ctx);
    genFile(path.join(appDir, ".gitignore"), GITIGNORE, ctx);
    if (opts.typescript) {
        genFile(path.join(appDir, "app.ts"), APP_TS, ctx);
    } else {
        genFile(path.join(appDir, "app.js"), APP_JS, ctx);
    }

    logger.progress("Installing dependencies...");
    let deps = [...DEPENDENCIES, ...DEV_DEPENDENCIES];
    if (opts.typescript) {
        deps = deps.concat(TYPESCRIPT_DEV_DEPENDENCIES);
    }
    exec(["yarn", "add", ...deps], { cwd: appDir });

    logger.success(`Successfully generated ${appDir}`);
}

export class NewCommand extends Command {
    public static command = "new";
    public static desc = "Create a new app.";
    public static args = [
        {
            name: "path",
            desc: "The app directory.",
        }
    ];
    public static opts = [
        {
            name: "--typescript",
            desc: "Create a TypeScript app.",
            default: false,
        }
    ];

    public async run(args: Args, opts: Opts) {
        await scaffold(args.path, opts as ScaffoldOptions);
    }
}
