import * as fs from "fs-extra";
import * as path from "path";
import { DeployOptions } from "..";
import { exec, createTmpDir, UserError } from "../../helpers";
import { logger } from "../../logger";

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
    "firestore.rules",
    "firestore.indexes.json",
]

export async function deploy(appDir: string, firmwarePath: string, opts: DeployOptions) {
    if (!opts.firebaseProject) {
        throw new UserError("--firebase-project is not set.");
    }

    if (!fs.existsSync(path.join(appDir, "firebase.json"))) {
        throw new UserError(`Missing firebase.json in ${appDir}. See: https://firebase.google.com/docs/cli/#the_firebasejson_file`);
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

    fs.copySync(buildFilePath("firebase.json"), appFilePath("firebase.json"));
    for (const filename of EXTRA_FIREBASE_FILES) {
        const src = buildFilePath(filename);
        const dst = appFilePath(filename)
        if (fs.existsSync(src)) {
            fs.copySync(dst, src);
        }
    }

    fs.mkdirpSync(buildFilePath("public"));
    if (fs.existsSync(appFilePath("public"))) {
        for (const basename of fs.readdirSync(appFilePath("public"))) {
            const dst = buildFilePath(path.join("public", basename));
            fs.copySync(dst, appFilePath(path.join("public", basename)));
        }
    }

    const packageJson = FUNCTIONS_PACKAGE_JSON;
    const appDependencies = fs.readJsonSync(appFilePath("package.json")).dependencies;
    const makestackDpendencies = fs.readJsonSync(
        path.resolve(__dirname, "../../../package.json")).dependencies;
    packageJson.dependencies = Object.assign({},
        makestackDpendencies, packageJson.dependencies, appDependencies);

    const indexJs = fs.readFileSync(path.join(__dirname, "start.js"), "utf-8");
    fs.mkdirpSync(buildFilePath("functions"));
    fs.writeJsonSync(buildFilePath("functions/package.json"), packageJson, { spaces: 2 });
    fs.writeFileSync(buildFilePath("functions/index.js"), indexJs);
    fs.copySync(buildFilePath("functions/app.js"), appFilePath("app.js"));
    fs.copySync(buildFilePath("functions/firmware.bin"), firmwarePath);
    fs.mkdirpSync(buildFilePath("functions/makestack"));
    fs.copySync(buildFilePath("functions/makestack/dist"), path.resolve(__dirname, "../../../dist"));
    fs.copySync(buildFilePath("functions/makestack/package.json"), path.resolve(__dirname, "../../../package.json"));
    fs.writeJsonSync(buildFilePath(".firebaserc"), {
        projects: {
            default: opts.firebaseProject
        },
    }, { spaces: 2 });

    exec(["yarn", "install"], { cwd: buildFilePath("functions") });
    return buildDir;
}

export function log(appDir: string, opts: DeployOptions) {
    exec(["firebase" , "functions:log", "--project", opts.firebaseProject]);
}
