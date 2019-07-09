import { DevCommand } from "./dev_command";
import { FlashCommand } from "./flash_command";
import { SerialCommand } from "./serial_command";

export const commands = [
    DevCommand,
    FlashCommand,
    SerialCommand,
] as any[];
