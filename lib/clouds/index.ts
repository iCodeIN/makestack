import * as firebase from "./firebase/firebase";

export interface DeployOptions {
    firebaseProject: string,
}

export interface Cloud {
    deploy: (appDir: string, firmwarePath: string) => Promise<void>;
}

export { firebase as Cloud };
