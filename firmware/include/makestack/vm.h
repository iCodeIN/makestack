#ifndef __VM_H__
#define __VM_H__

#include <string>
#include <vector>
#include <unordered_map>
#include <stdarg.h>

class Context;
class ErrorInfo;
Context *vm_port_get_current_context();
void vm_port_unhandled_error(ErrorInfo &info);
void vm_port_panic(const char *fmt, ...) __attribute__((noreturn));
void vm_port_print(const char *fmt, ...);
void vm_port_debug(const char *fmt, ...);

#include "port.h"

#define VM_GET_INT_ARG(nth) vm_get_int_arg_or_panic(ctx, nargs, args, nth)
#define VM_GET_STRING_ARG(nth) vm_get_string_arg_or_panic(ctx, nargs, args, nth)
#define VM_GET_ARG(nth) vm_get_arg_or_panic(ctx, nargs, args, nth)
#define VM_CURRENT_LOC SourceLoc(__FILE__, __func__, __LINE__)
#define VM_CREATE_ERROR(fmt, ...) Value::Error(VM_CURRENT_LOC, fmt, ## __VA_ARGS__)
#define VM_PANIC(fmt, ...) \
        vm_port_panic("[%s] PANIC: " fmt "\n", __func__, ## __VA_ARGS__)
#define VM_DEBUG(fmt, ...) \
        vm_port_debug("[%s] DEBUG: " fmt "\n", __func__, ## __VA_ARGS__)
#define VM_UNREACHABLE(fmt, ...) \
        vm_port_panic("[%s] PANIC: unreachable " fmt "\n", __func__, ## __VA_ARGS__)
#define VM_ASSERT(expr)  do {                                              \
        if (!(expr)) {                                                     \
            vm_port_panic("[%s] ASSERTION FAILURE: %s", __func__, #expr);  \
        }                                                                  \
    } while (0)

enum class ValueType {
    Invalid = 0, /* We never use it. */
    Undefined = 1,
    Null = 2,
    Error = 3,
    Bool = 4,
    Int = 5,
    String = 6,
    Function = 7,
    Object = 8,
};

class Scope;
class Value;
typedef Value (*NativeFunction)(Context *ctx, int nargs, Value *args);

class SourceLoc {
public:
    const char *file;
    const char *func;
    int lineno;
    SourceLoc(const char *file, const char *func, int lineno) :
        file(file), func(func), lineno(lineno) {}
};

class Frame {
public:
    SourceLoc callee;

    Frame(SourceLoc callee) : callee(callee) {}
};

class ErrorInfo {
public:
    std::string message;
    // A copy of the stacktrace when the error is thrown.
    std::vector<Frame> frames;
    bool checked = false;

    ErrorInfo(SourceLoc loc, std::string message);
    ~ErrorInfo();

    void check() {
        checked = true;
    }
};

class ValueInner {
public:
    ValueInner(ValueType type) : type(type), ref_count(1), v_e(SourceLoc("", "", -1), "") {}
    ~ValueInner() {
        if (type != ValueType::Error) {
            v_e.check();
        }
    }

    std::string toString() const {
        switch (type) {
        case ValueType::Bool:
            return v_b ? "true" : "false";
        case ValueType::Int: {
            char buf[32];
            snprintf(buf, sizeof(buf), "%d", v_i);
            return std::string(buf);
        }
        case ValueType::String:
            return v_s;
        default:
            VM_PANIC("TODO: NYI");
        }
    }

    int toInt() const {
        VM_ASSERT(type == ValueType::Int);
        return v_i;
    }

    bool toBool() const {
        switch (type) {
        case ValueType::Int:
            return v_i != 0;
        case ValueType::Bool:
            return v_b;
        case ValueType::String:
            return v_s.length() > 0;
        case ValueType::Function:
        case ValueType::Object:
            return true;
        case ValueType::Null:
        case ValueType::Error:
        case ValueType::Undefined:
            return false;
        default:
            VM_UNREACHABLE();
        }
    }

    ValueType type;
    // The reference counter.
    int ref_count;

    // TODO: Use union.
    NativeFunction v_f;
    std::string v_s;
    int v_i;
    bool v_b;
    ErrorInfo v_e;
    std::unordered_map<std::string, ValueInner *> v_obj;
};

class Value {
public:
    static Value Undefined() {
        Value value(ValueType::Undefined);
        return value;
    }

    static Value Null() {
        Value value(ValueType::Null);
        return value;
    }

    static Value Bool(bool b) {
        Value value(ValueType::Bool);
        value.inner->v_b = b;
        return value;
    }

    static Value Int(int i) {
        Value value(ValueType::Int);
        value.inner->v_i = i;
        return value;
    }

    static Value String(const char *s) {
        Value value(ValueType::String);
        value.inner->v_s = s;
        return value;
    }

    static Value Function(NativeFunction f) {
        Value value(ValueType::Function);
        value.inner->v_f = f;
        return value;
    }

    static Value Object() {
        Value value(ValueType::Object);
        return value;
    }

    static Value Error(SourceLoc loc, const char *fmt, ...) {
        Value value(ValueType::Error);
        char buf[256];
        va_list vargs;

        va_start(vargs, fmt);
        vsnprintf((char *) &buf, sizeof(buf), fmt, vargs);
        value.inner->v_e = ErrorInfo(loc, std::string(buf));
        va_end(vargs);
        return value;
    }

    ValueType type() const {
        return inner->type;
    }

    std::string toString() const {
        return inner->toString();
    }

    int toInt() const {
        return inner->toInt();
    }

    Value call(Context *ctx, int nargs, Value *args);
    Value get(Value prop);
    Value set(Value prop, Value value);

    operator bool() {
        return inner->toBool();
    }

    Value& operator=(const Value& from) {
        if (this == &from) {
            return *this;
        }

        inner = from.inner;
        inner->ref_count++;
        return *this;
    }

    Value(Value& from) {
        inner = from.inner;
        inner->ref_count++;
    }

    Value(Value&& from) {
        inner = from.inner;
    }

    ~Value() {
        inner->ref_count--;
        if (inner->ref_count == 0) {
            delete inner;
        }
    }

private:
    Value(ValueType type) {
        inner = new ValueInner(type);
    }

    Value(ValueInner *other) {
        inner = other;
    }

    ValueInner *inner;
};

class Var {
public:
    Value value;

    Var() : value(Value::Undefined()) {}
    Var(Value value) : value(value) {}

    Var(const Var& other) : value(Value::Undefined()) {
        value = other.value;
    }
};

class Scope {
private:
    std::unordered_map<std::string, Var> vars;

public:
    /* TODO: Make these fields private. */
    int ref_count;
    Scope *prev;

    Scope(Scope *prev) : ref_count(1), prev(prev) {}
    Value get(const char *id);
    void set(const char *id, Value value);
};

class Context {
public:
    Scope *current;
    std::vector<Frame> frames;

    Context(Scope *globals) : current(globals) {}

    Scope *current_scope() {
        return current;
    }

    void enter_scope(SourceLoc callee);
    void leave_scope();
    Scope *create_closure_scope();
    Value call(SourceLoc called_from, Value func, int nargs, Value *args);
};

// Saves the callee scope, enter the closure scope, and restore the callee
// one when this object is destructed, i.e., returned from the closure.
class Closure {
private:
    Context *ctx;
    Scope *callee;

public:
    Closure(Context *ctx, Scope *closure) : ctx(ctx), callee(ctx->current) {
        ctx->current = closure;
    }

    ~Closure() {
        ctx->current = callee;
    }
};

class VM {
public:
    Scope globals;

    VM() : globals(nullptr) {}

    Context *create_context() {
        return new Context(&globals);
    }
};

void vm_print_error(ErrorInfo &info);
void vm_print_stacktrace(std::vector<Frame>& frames);
void vm_check_nargs_or_panic(Context *ctx, int nargs, int nth);
int vm_get_int_arg_or_panic(Context *ctx, int nargs, Value *args, int nth);
std::string vm_get_string_arg_or_panic(Context *ctx, int nargs, Value *args, int nth);
Value vm_get_arg_or_panic(Context *ctx, int nargs, Value *args, int nth);

#endif
