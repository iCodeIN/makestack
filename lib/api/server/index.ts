import { Request, Response } from "express";

export type HTTPCallback = (req: Request, res: Response) => void;

(global as any).__httpEndpoints = {
    get: [],
    post: [],
    delete: [],
    put: [],
}

export const http = {
    get(name: string, callback: HTTPCallback) {
        (global as any).__httpEndpoints["get"].push({ name, callback });
    },
    post(name: string, callback: HTTPCallback) {
        (global as any).__httpEndpoints["post"].push({ name, callback });
    },
    delete(name: string, callback: HTTPCallback) {
        (global as any).__httpEndpoints["delete"].push({ name, callback });
    },
    put(name: string, callback: HTTPCallback) {
        (global as any).__httpEndpoints["put"].push({ name, callback });
    },
};
