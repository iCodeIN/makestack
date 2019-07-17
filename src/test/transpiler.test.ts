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
        app.onReady(() => {
            print("Hello World!");
        });
    `)).toStrictEqual(ignoreWhitespace(`
        VM_FUNC_DEF(__lambda_0, __closure_0) {
          VM_CALL(VM_ANON_LOC(3), VM_GET("print"), 1, VM_STR("Hello World!"));
          return VM_UNDEF;
        }
        VM_FUNC_DEF_END

        void app_setup(Context *__ctx) {
          VM_CALL(VM_APP_LOC("(top level)", 2), VM_GET("__onReady"), 1,
                  VM_FUNC(__lambda_0, __closure_0));
        }
    `));
});
