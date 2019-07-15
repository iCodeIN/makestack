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


#define VM_NULL Value::Null()
#define VM_UNDEF Value::Undefined()
#define VM_STR(value) Value::String(value)
#define VM_BOOL(value) Value::Bool(value)
#define VM_INT(value) Value::Int(value)
#define VM_FUNC(name, closure) ({ closure = __ctx->create_closure_scope(); Value::Function(name); })
#define VM_FUNC_DEF(name, closure)                                           \
        Scope *closure = nullptr;                                            \
        static Value name(Context *__ctx, int __nargs, Value *__args) {      \
            Closure __closure(__ctx, closure);
#define VM_FUNC_DEF_END }
#define VM_ANON_LOC(line) VM_APP_LOC("(anonymous function)", line)
#define VM_APP_LOC(func, line) SourceLoc("app.js", func, line)
#define VM_SET(id, value) __ctx->current->set(id, value)
#define VM_GET(id) __ctx->current->get(id)
#define VM_MGET(obj, prop) ({ Value __obj = obj; __obj.get(prop); })
#define VM_CALL(loc, callee, nargs, ...)                         \
        ({                                                       \
            Value __tmp_args[] = { __VA_ARGS__ };                \
            Value __callee = callee;                             \
            __ctx->call(loc, __callee, nargs, __tmp_args);       \
        })


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
    ValueType type;
    int ref_count = 1;
    union {
        NativeFunction v_f;
        std::string v_s;
        int v_i;
        bool v_b;
        ErrorInfo v_e;
        std::unordered_map<std::string, ValueInner *> v_obj;
    };

    ValueInner(ValueType type) : type(type) {
        if (type == ValueType::Object) {
            new (&v_obj) std::unordered_map<std::string, ValueInner *>();
        }
    }

    ValueInner(const char *str)
        : type(ValueType::String), v_s(str) {}
    ValueInner(int value)
        : type(ValueType::Int), v_i(value) {}
    ValueInner(bool value)
        : type(ValueType::Bool), v_b(value) {}
    ValueInner(NativeFunction value)
        : type(ValueType::Function), v_f(value) {}
    ValueInner(SourceLoc loc, const char *msg)
        : type(ValueType::Error), v_e(loc, msg) {}

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

    ~ValueInner() {
        switch (type) {
        case ValueType::Invalid:
            VM_PANIC("tried to destruct invalid value");
        case ValueType::Undefined:
        case ValueType::Null:
        case ValueType::Int:
        case ValueType::Bool:
        case ValueType::Function:
            return;
        case ValueType::String:
            v_s.~basic_string();
            break;
        case ValueType::Object:
            v_obj.~unordered_map();
            break;
        case ValueType::Error:
            v_e.~ErrorInfo();
            break;
        }
    }
};

class Value {
public:
    static Value Undefined() {
        return Value(new ValueInner(ValueType::Undefined));
    }

    static Value Null() {
        return Value(new ValueInner(ValueType::Null));
    }

    static Value Bool(bool b) {
        return Value(new ValueInner(b));
    }

    static Value Int(int i) {
        return Value(new ValueInner(i));
    }

    static Value String(const char *s) {
        return Value(new ValueInner(s));
    }

    static Value Function(NativeFunction f) {
        return Value(new ValueInner(f));
    }

    static Value Object() {
        return Value(new ValueInner(ValueType::Object));
    }

    static Value Error(SourceLoc loc, const char *fmt, ...) {
        va_list vargs;
        va_start(vargs, fmt);
        char buf[256];
        vsnprintf((char *) &buf, sizeof(buf), fmt, vargs);
        Value value(new ValueInner(loc, buf));
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
    Value(ValueInner *value) {
        inner = value;
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

// Saves the caller scope, enter the closure scope, and restore the caller
// one when this object is destructed, i.e., returned from the closure.
class Closure {
private:
    Context *ctx;
    Scope *caller;

public:
    Closure(Context *ctx, Scope *closure) : ctx(ctx), caller(ctx->current) {
        ctx->current = closure;
    }

    ~Closure() {
        ctx->current = caller;
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
