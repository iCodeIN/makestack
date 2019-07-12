#include <makestack/types.h>
#include <makestack/cred.h>
#include <makestack/logger.h>
#include <makestack/vm.h>
#include <makestack/port.h>
#include <makestack/serial_adapter.h>
#include <makestack/wifi_adapter.h>

void app_task() {
    run_app();
    vTaskDelete(NULL);
 }

esp_err_t system_event_callback(void *ctx, system_event_t *event) {
    if (event->event_id == SYSTEM_EVENT_STA_GOT_IP) {
        got_ip_event_handler();
    }

    return ESP_OK;
}

void supervisor_main() {
    init_logger();
    printf("\n");

    INFO("[Makestack] Hello!");
    INFO("[Makestack] version=%llu", __cred.version);
    nvs_flash_init();
    tcpip_adapter_init();
    esp_event_loop_init(system_event_callback, NULL);

    if (!strcmp(__cred.adapter, "serial")) {
        xTaskCreate((TaskFunction_t) &serial_adapter_task, "serial_adapter_task", 8192 * 4, NULL, 10, NULL);
    }
    if (!strcmp(__cred.adapter, "wifi")) {
        xTaskCreate((TaskFunction_t) &wifi_adapter_task, "wifi_adapter_task", 8192 * 2, NULL, 10, NULL);
    }

    // FIXME: Wait for init_serial to finish initializing the serial port.
    vTaskDelay(1000 / portTICK_PERIOD_MS);

    xTaskCreate((TaskFunction_t) &app_task, "app_task", 8192, NULL, 10, NULL);
}
