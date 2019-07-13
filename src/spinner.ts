import * as readline from "readline";

const PATTERNS = ["-", "\\", "|", "/"];
export class Spinner {
    private count: number = 0;
    private timer?: NodeJS.Timer;
    private message?: string;
    public start() {
        this.timer = setInterval(() => {
            this.count++;
            this.render();
        }, 70);
    }

    public update(message: string) {
        const maxLen = (process.stdout.columns || 80) - 2;
        const truncated = message.slice(0, maxLen);
        this.message = truncated;
        this.render();
    }

    public reset() {
        if (this.timer) {
            this.count = 0;
            clearInterval(this.timer);
            readline.clearLine(process.stdout, 0);
            readline.cursorTo(process.stdout, 0);
        }
    }


    private render() {
        if (this.message) {
            const spin = PATTERNS[this.count % PATTERNS.length] + " ";
            readline.clearLine(process.stdout, 0);
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(spin + this.message);
        }
    }
}
