import { NewCommand } from "./new_command";
import { DevCommand } from "./dev_command";
import { FlashCommand } from "./flash_command";
import { SerialCommand } from "./serial_command";
import { BuildCommand } from "./build_command";

export const commands = [
    NewCommand,
    BuildCommand,
    DevCommand,
    FlashCommand,
    SerialCommand,
] as any[];
