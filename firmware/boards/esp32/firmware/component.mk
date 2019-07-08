# ESP-IDF build config.
COMPONENT_SRCDIRS = .. ../../..
CXXFLAGS += -fdiagnostics-color=always

ifneq ($(MAKESTACK_APP),)
CXXFLAGS += -DMAKESTACK_APP
endif
