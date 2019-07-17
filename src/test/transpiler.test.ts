import { Transpiler } from "../transpiler";

function transpile(code: string): string {
    const transpiler = new Transpiler();
    return ignoreWhitespace(transpiler.transpile(code));
}

// Removes whitespaces and newlines to make toStrictEqual ignore them.
function ignoreWhitespace(code: string): string {
    return code.replace(/[ \n]/g, "");
}

test("Hello World!", () => {
    expect(transpile(`\
        const app = require("makestack");
        app.get("/foo", (req, res) => { res.send("Hi") });

        app.onReady(() => {
            print("Hello World!");
        });
    `)).toStrictEqual(ignoreWhitespace(`
        VM_FUNC_DEF(__lambda_0, __closure_0) {
          VM_CALL(VM_ANON_LOC(5), VM_GET("print"), 1, VM_STR("Hello World!"));
          return VM_UNDEF;
        }
        VM_FUNC_DEF_END

        void app_setup(Context *__ctx) {
          VM_CALL(VM_APP_LOC("(top level)", 4), VM_GET("__onReady"), 1,
                  VM_FUNC(__lambda_0, __closure_0));
        }
    `));
});

test("binary operators", () => {
    expect(transpile(`\
        const app = require("makestack");
        app.onReady(() => {
            let ans = 0;
            ans = 1 + 2 - 3 * 4;
            ans += 5;
        });
    `)).toStrictEqual(ignoreWhitespace(`
        VM_FUNC_DEF(__lambda_0, __closure_0) {
          VM_SET("ans", VM_INT(0));
          VM_SET("ans", ((VM_INT(1)+VM_INT(2))-(VM_INT(3)*VM_INT(4))));
          (VM_GET("ans") += VM_INT(5));
          return VM_UNDEF;
        }
        VM_FUNC_DEF_END

        void app_setup(Context *__ctx) {
          VM_CALL(VM_APP_LOC("(top level)", 2), VM_GET("__onReady"), 1,
                  VM_FUNC(__lambda_0, __closure_0));
        }
    `));
});

test("while statement", () => {
    expect(transpile(`\
        const app = require("makestack");
        app.onReady((device) => {
            while (1) {
                device.print("infinite loop");
            }

            while (1)
                device.print("unreachable!");
        });
    `)).toStrictEqual(ignoreWhitespace(`
        VM_FUNC_DEF(__lambda_0, __closure_0) {
            while (VM_INT(1)) {
                VM_CALL(
                    VM_ANON_LOC(4),
                    VM_MGET(VM_GET("device"), VM_STR("print")),
                    1,
                    VM_STR("infinite loop")
                );
            };

            while (VM_INT(1))
                VM_CALL(
                    VM_ANON_LOC(8),
                    VM_MGET(VM_GET("device"), VM_STR("print")),
                    1,
                    VM_STR("unreachable!")
                );

          return VM_UNDEF;
        }
        VM_FUNC_DEF_END

        void app_setup(Context *__ctx) {
          VM_CALL(VM_APP_LOC("(top level)", 2), VM_GET("__onReady"), 1,
                  VM_FUNC(__lambda_0, __closure_0));
        }
    `));
});