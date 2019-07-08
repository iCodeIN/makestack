import * as esp32 from "./esp32";

export interface Board {
    flashFirmware: (devicePath: string, firmwarePath: string) => Promise<void>;
    buildFirmware: (appDir: string, appCpp: string) => Promise<void>;
    getFirmwarePath: () => string;
}

export class BuildError extends Error {}

export { esp32 as Board };
