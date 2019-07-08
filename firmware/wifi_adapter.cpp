#include <HTTPClient.h>
#include <Stream.h>
#include <esp_wifi.h>
#include <esp_ota_ops.h>
#include <makestack/types.h>
#include <makestack/cred.h>
#include <makestack/protocol.h>
#include <makestack/wifi_adapter.h>

#include <Stream.h>

class BinaryStream : public Stream {
private:
    int buffer_size;

    // Returns 1 on success or 0 on failure.
    int reserve(int new_length) {
        const int count = 64;

        if (buffer_size < new_length) {
            buffer_size = new_length + count;
            buffer = (uint8_t *) realloc(buffer, buffer_size);
            if (!buffer) {
                free(buffer);
                return 0;
            }
        }

        return 1;
    }

public:
    int length;
    int read_index;
    uint8_t *buffer;

    BinaryStream() : length(0), read_index(0) {
        buffer_size = 128;
        buffer = (uint8_t *) malloc(buffer_size);
    }

    ~BinaryStream() {
        free(buffer);
    }

    size_t write(const uint8_t *data, size_t size) {
        if(size && data) {
            if(reserve(length + size)) {
                memcpy((void *) (buffer + length), (const void *) data, size);
                length += size;
                return size;
            }
        }
        return 0;
    }

    size_t write(uint8_t data) {
        if (reserve(length + 1)) {
            buffer[length] = data;
            return data;
        }

        return 0;
    }

    int available() {
        return length > 0;
    }

    int read() {
        if(length > 0) {
            char c = buffer[read_index];
            read_index++;
            return c;
        }

        return -1;
    }

    int peek() {
        return ((length > 0) ? buffer[0] : -1);
    }

    void flush() {
    }
};

const char *TLS_CA_CERT =
"-----BEGIN CERTIFICATE-----\n"
"MIIEXDCCA0SgAwIBAgINAeOpMBz8cgY4P5pTHTANBgkqhkiG9w0BAQsFADBMMSAw\n"
"HgYDVQQLExdHbG9iYWxTaWduIFJvb3QgQ0EgLSBSMjETMBEGA1UEChMKR2xvYmFs\n"
"U2lnbjETMBEGA1UEAxMKR2xvYmFsU2lnbjAeFw0xNzA2MTUwMDAwNDJaFw0yMTEy\n"
"MTUwMDAwNDJaMFQxCzAJBgNVBAYTAlVTMR4wHAYDVQQKExVHb29nbGUgVHJ1c3Qg\n"
"U2VydmljZXMxJTAjBgNVBAMTHEdvb2dsZSBJbnRlcm5ldCBBdXRob3JpdHkgRzMw\n"
"ggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDKUkvqHv/OJGuo2nIYaNVW\n"
"XQ5IWi01CXZaz6TIHLGp/lOJ+600/4hbn7vn6AAB3DVzdQOts7G5pH0rJnnOFUAK\n"
"71G4nzKMfHCGUksW/mona+Y2emJQ2N+aicwJKetPKRSIgAuPOB6Aahh8Hb2XO3h9\n"
"RUk2T0HNouB2VzxoMXlkyW7XUR5mw6JkLHnA52XDVoRTWkNty5oCINLvGmnRsJ1z\n"
"ouAqYGVQMc/7sy+/EYhALrVJEA8KbtyX+r8snwU5C1hUrwaW6MWOARa8qBpNQcWT\n"
"kaIeoYvy/sGIJEmjR0vFEwHdp1cSaWIr6/4g72n7OqXwfinu7ZYW97EfoOSQJeAz\n"
"AgMBAAGjggEzMIIBLzAOBgNVHQ8BAf8EBAMCAYYwHQYDVR0lBBYwFAYIKwYBBQUH\n"
"AwEGCCsGAQUFBwMCMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0OBBYEFHfCuFCa\n"
"Z3Z2sS3ChtCDoH6mfrpLMB8GA1UdIwQYMBaAFJviB1dnHB7AagbeWbSaLd/cGYYu\n"
"MDUGCCsGAQUFBwEBBCkwJzAlBggrBgEFBQcwAYYZaHR0cDovL29jc3AucGtpLmdv\n"
"b2cvZ3NyMjAyBgNVHR8EKzApMCegJaAjhiFodHRwOi8vY3JsLnBraS5nb29nL2dz\n"
"cjIvZ3NyMi5jcmwwPwYDVR0gBDgwNjA0BgZngQwBAgIwKjAoBggrBgEFBQcCARYc\n"
"aHR0cHM6Ly9wa2kuZ29vZy9yZXBvc2l0b3J5LzANBgkqhkiG9w0BAQsFAAOCAQEA\n"
"HLeJluRT7bvs26gyAZ8so81trUISd7O45skDUmAge1cnxhG1P2cNmSxbWsoiCt2e\n"
"ux9LSD+PAj2LIYRFHW31/6xoic1k4tbWXkDCjir37xTTNqRAMPUyFRWSdvt+nlPq\n"
"wnb8Oa2I/maSJukcxDjNSfpDh/Bd1lZNgdd/8cLdsE3+wypufJ9uXO1iQpnh9zbu\n"
"FIwsIONGl1p3A8CgxkqI/UAih3JaGOqcpcdaCIzkBaR9uYQ1X4k2Vg5APRLouzVy\n"
"7a8IVk6wuy6pm+T7HT4LY8ibS5FEZlfAFLSW8NwsVz9SBK2Vqn1N0PIMn5xA6NZV\n"
"c7o835DLAFshEWfC7TIe3g==\n"
"-----END CERTIFICATE-----";

static bool connected = false;
void got_ip_event_handler() {
    connected = true;
}

void connect_wifi() {
    wifi_init_config_t init_config = WIFI_INIT_CONFIG_DEFAULT();
    wifi_config_t config;
    memset(&config, 0, sizeof(config));
    strcpy((char *)config.sta.ssid, __cred.wifi_ssid);
    strcpy((char *)config.sta.password, __cred.wifi_password);

    esp_wifi_init(&init_config);
    esp_wifi_set_storage(WIFI_STORAGE_RAM);
    esp_wifi_set_mode(WIFI_MODE_STA);
    esp_wifi_set_config(WIFI_IF_STA, &config);
    esp_wifi_start();
    esp_wifi_connect();

    int retries = 30;
    while (!connected && retries > 0) {
        INFO("Connecting to '%s'...", __cred.wifi_ssid);
        vTaskDelay(1000 / portTICK_PERIOD_MS);
        retries--;
    }

    if (!retries) {
        WARN("failed to connect, disabling the Wi-Fi adapter");
        vTaskDelete(NULL);
    }

    INFO("connected to Wi-Fi");
}

#define TX_PAYLOAD_MAX_LEN 2048
void send_and_receive_payload(String &url) {
    uint8_t *payload = (uint8_t *) malloc(TX_PAYLOAD_MAX_LEN);
    size_t payload_len;
    if ((payload_len = build_payload(payload, TX_PAYLOAD_MAX_LEN)) == 0) {
        WARN("failed to build a payload");
        free(payload);
        return;
    }

    int tls_enabled = true;
    if (url.startsWith("http://")) {
        tls_enabled = false;
    }

    HTTPClient http;
    INFO("sending a payload...");
    if (tls_enabled) {
        http.begin(url, TLS_CA_CERT);
    } else {
        http.begin(url);
    }

    http.addHeader("Connection", "close");

    DEBUG("POST %s", url.c_str());
    int code = http.POST(payload, payload_len);
    if (code <= 0) {
        WARN("failed to connect: %s", http.errorToString(code).c_str());
        http.end();
        free(payload);
        return;
    }

    if (code != HTTP_CODE_OK) {
        WARN("server returned an error: %d", code);
        http.end();
        free(payload);
        return;
    }

    BinaryStream *stream = new BinaryStream();
    http.writeToStream(stream);

    INFO("received a payload (%d bytes)", stream->length);
    process_payload((uint8_t *) stream->buffer, stream->length);

    delete stream;
    free(payload);
    http.end();
}

void wifi_adapter_task() {
    INFO("[Makestack] wifi_adapter: starting");
    connect_wifi();

    String url = __cred.server_url;
    url += "/protocol";
    while (1) {
        send_and_receive_payload(url);
        vTaskDelay(1000 / portTICK_PERIOD_MS);
    }
}
