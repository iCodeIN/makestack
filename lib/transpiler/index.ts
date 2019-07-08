const APP_CPP_TEMPLATE = `\
#include <stdio.h>

void app_setup() {
    printf("Hello from makestack_app_main!\\n");
}
`;

export function transpile(code: string) {
    // TODO:
    return APP_CPP_TEMPLATE;
}
