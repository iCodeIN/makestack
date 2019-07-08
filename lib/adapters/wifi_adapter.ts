import * as express from "express";
import { logger } from "../logger";

export class WiFiAdapter {
    public start(onRecv: (payload: Buffer) => Buffer | null) {
        const server = express();
        server.use((req: any, res: express.Response, next: Function) => {
            req.rawBody = Buffer.alloc(0);

            req.on("data", function(chunk: Buffer) {
                req.rawBody = Buffer.concat([req.rawBody, chunk]);
            });

            req.on("end", function() {
                next();
            });
        });

        server.post("/protocol", (req, res) => {
            logger.debug("/protocol");
            const reply = onRecv((req as any).rawBody);
            res.status(200);
            res.type("application/octet-stream");
            res.send(reply);
        });

        // TODO: allow specifying the address and the port.
        server.listen(1234, "0.0.0.0");
        logger.success("listening on http://0.0.0.0:1234");
    }
}
