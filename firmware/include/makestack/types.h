#ifndef __MAKESTACK_TYPES_H__
#define __MAKESTACK_TYPES_H__

#define TRACE(fmt, ...) printf("TRACE: " fmt "\n", ## __VA_ARGS__)
#define TRACE_NONL(fmt, ...) printf(fmt, ## __VA_ARGS__)
#define DEBUG(fmt, ...) printf("DEBUG: " fmt "\n", ## __VA_ARGS__)
#define WARN(fmt, ...) printf("WARN: " fmt "\n", ## __VA_ARGS__)
#define INFO(fmt, ...) printf(fmt "\n", ## __VA_ARGS__)

// TODO: Eeduce #include
#include <driver/gpio.h>
#include <driver/uart.h>
#include <esp_event.h>
#include <esp_event_loop.h>
#include <esp_system.h>
#include <esp_spi_flash.h>
#include <esp_ota_ops.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <nvs_flash.h>
#include <sdkconfig.h>
#include <stdio.h>
#include <stdio.h>
#include <string.h>
#include <stdbool.h>

#endif
