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
    "dependencies": {
    }
}
`

const APP_JS = `\
const device = require("makestack/device");

device.onReady((api) => {
    const pin = 15;
    api.print("Hello from {{ name }}!");
    while (1) {
        api.digitalWrite(pin, "HIGH");
        api.delay(1000);
    }
});
`

const GITIGNORE = `\
*.log
`

function genFile(filepath: string, template: string, ctx: any) {
    logger.action("create", filepath);
    nunjucks.configure({ autoescape: false });
    fs.writeFileSync(filepath, nunjucks.renderString(template, ctx));
}

function mkdir(filepath: string) {
    logger.action("mkdir", filepath);
    fs.mkdirSync(filepath);
}

function scaffold(appDir: string) {
    if (fs.existsSync(appDir)) {
        throw new Error(`The directory alredy exists: \`${appDir}'`);
    }

    logger.progress("Generating files");
    mkdir(appDir);
    const ctx = {
        name: path.basename(appDir),
    };
    genFile(path.join(appDir, "package.json"), PACKAGE_JSON, ctx);
    genFile(path.join(appDir, "app.js"), APP_JS, ctx);
    genFile(path.join(appDir, ".gitignore"), GITIGNORE, ctx);

    logger.progress("Installing dependencies...");
    exec(["yarn"], { cwd: appDir });

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
    public static opts = [];

    public async run(args: Args, _opts: Opts) {
        await scaffold(args.path);
    }
}
