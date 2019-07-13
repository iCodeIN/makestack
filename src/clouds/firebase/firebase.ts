import * as fs from "fs-extra";
import * as path from "path";
import { DeployOptions } from "..";
import { exec, createTmpDir } from "../../helpers";
import { logger } from "../../logger";

function copyFile(dst: string, src: string) {
    logger.action("copy", dst);
    fs.copyFileSync(src, dst);
}

function copyDir(dst: string, src: string) {
    logger.action("copy", dst);
    fs.copySync(src, dst);
}

function copyFileIfExists(dst: string, src: string) {
    if (fs.existsSync(src)) {
        copyFile(dst, src);
    }
}

function mkdir(dir: string) {
    logger.action("mkdir", dir);
    fs.mkdirpSync(dir);
}

function genFile(filepath: string, body: string) {
    logger.action("create", filepath);
    fs.writeFileSync(filepath, body);
}

function genJsonFile(filepath: string, json: any) {
    genFile(filepath, JSON.stringify(json, null, 2));
}

const FUNCTIONS_PACKAGE_JSON = {
    private: true,
    name: "functions",
    engines: {
        node: "10",
    },
    dependencies: {
        "firebase-admin": "^8.0.0",
        "firebase-functions": "^3.0.0"
    }
}

const EXTRA_FIREBASE_FILES = [
    "firebase.json",
    "firestore.rules",
    "firestore.indexes.json",
]

export async function deploy(appDir: string, firmwarePath: string, opts: DeployOptions) {
    if (!opts.firebaseProject) {
        throw new Error("--firebase-project is not set.");
    }

    logger.progress("Packing the app...")
    const buildDir = await pack(appDir, firmwarePath, opts);

    // TODO: make sure that firebase-cli is installed.
    logger.progress("Deploying...")
    exec(["firebase", "deploy"], { cwd: buildDir });
}

async function pack(appDir: string, firmwarePath: string, opts: DeployOptions): Promise<string> {
    const buildDir = createTmpDir("makestack-firebase-pack");
    const appFilePath = (relpath: string) =>  path.join(appDir, relpath);
    const buildFilePath = (relpath: string) =>  path.join(buildDir, relpath);

    for (const filename of EXTRA_FIREBASE_FILES) {
        copyFileIfExists(buildFilePath(filename), appFilePath(filename));
    }

    mkdir(buildFilePath("public"));
    if (fs.existsSync(appFilePath("public"))) {
        for (const basename of fs.readdirSync(appFilePath("public"))) {
            const dst = buildFilePath(path.join("public", basename));
            copyFile(dst, appFilePath(path.join("public", basename)));
        }
    }

    const packageJson = FUNCTIONS_PACKAGE_JSON;
    const makestackDpendencies = fs.readJsonSync(
        path.resolve(__dirname, "../../../package.json")).dependencies;
    packageJson.dependencies = Object.assign({},
        makestackDpendencies, packageJson.dependencies);

    const indexJs = fs.readFileSync(path.join(__dirname, "start.js"), "utf-8");
    mkdir(buildFilePath("functions"));
    genJsonFile(buildFilePath("functions/package.json"), packageJson);
    genFile(buildFilePath("functions/index.js"), indexJs);
    copyFile(buildFilePath("functions/app.js"), appFilePath("app.js"));
    copyFile(buildFilePath("functions/firmware.bin"), firmwarePath);
    mkdir(buildFilePath("functions/makestack"));
    copyDir(buildFilePath("functions/makestack/dist"), path.resolve(__dirname, "../../../dist"));
    copyFile(buildFilePath("functions/makestack/package.json"), path.resolve(__dirname, "../../../package.json"));
    genJsonFile(buildFilePath(".firebaserc"), {
        projects: {
            default: opts.firebaseProject
        },
    });

    exec(["yarn", "install"], { cwd: buildFilePath("functions") });
    return buildDir;
}

export function log(appDir: string, opts: DeployOptions) {
    exec(["firebase" , "functions:log", "--project", opts.firebaseProject]);
}
