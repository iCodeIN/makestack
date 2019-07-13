import { Transpiler } from "..";

function transpile(code: string): string {
    const transpiler = new Transpiler();
    return ignoreWhitespace(transpiler.transpile(code));
}

// Removes whitespaces and newlines to make toStrictEqual ignore them.
function ignoreWhitespace(code: string): string {
    return code.replace(/[ \n]/g, "");
}

test("Hello World!", () => {
    /* TODO:
    expect(transpile(`
        const device = require("makestack/device");
        device.onReady(() => {
            const LED_PIN = 15;
            print("Hello World!");
            while (1) {
                digitalWrite(LED_PIN, "HIGH");
                delay(1000);
                digitalWrite(LED_PIN, "LOW");
                delay(1000);
            }
        });
    `)).toStrictEqual(ignoreWhitespace(`
        static Value app_lambda_0(Env& env, int nargs, Value *args) {
            Value LED_PIN = Value::Int(15);
            app_vm->print(env, 1, (Value[]){Value::String("Hello World!")});
            while (Value::Int(1)) {
                app_vm->digital_write(LED_PIN, Value::String("HIGH"));
                app_vm->delay(Value::Int(1000));
                app_vm->digital_write(LED_PIN, Value::String("LOW"));
                app_vm->delay(Value::Int(1000));
            };

            return Value::Undefined();
        }

        void app_setup() {
            app_vm->onready(Value::Function(app_lambda_0));
        }
    `));
    */
});
