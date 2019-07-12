// The entry point of the app (server side) invoked by the dev server.
import * as fs from "fs";
import * as path from "path";
import * as express from "express";
import * as proxy from "http-proxy-middleware";
const chalk = require("chalk");
chalk.enabled = true;
chalk.level = 2;

function main() {
    // These environment variables are should be passed by DevServer.
    const host = process.env.HOST!;
    const port = parseInt(process.env.PORT!);
    const devServerPort = parseInt(process.env.DEV_SERVER_PORT!);

    const appJsPath = path.resolve(process.cwd(), "app.js");
    let appJs = fs.readFileSync(appJsPath, "utf-8");

    // XXX: Replace requires in the app.
    appJs = appJs.replace(/require\("(makestack.*)"\)/g, (s, rest) => {
        const absPath = path.resolve(__dirname, "../../..", rest);
        return `require("${absPath}")`;
    });

    // FIXME: I know using eval is really disgusting!
    eval(appJs);

    const server = express();

    // Forward requests to the dev server.
    server.use(
        "/makestack",
        proxy({ target: `http://localhost:${devServerPort}`, changeOrigin: true })
    );

    const endpoints: any = (global as any).__httpEndpoints;
    for (const [method, callbacks] of Object.entries(endpoints)) {
        for (const { name, callback } of (callbacks as any[])) {
            ((server as any)[method] as any)(name, callback);
        }
    }

    server.listen(port, host);
}

main();
