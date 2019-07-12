#include <makestack/vm.h>

void vm_print_stacktrace(std::vector<Frame>& frames) {
    for (int i = frames.size() - 1; i >= 0; i--) {
        const SourceLoc& callee = frames[i].callee;
        vm_port_print("    %d: %s (%s:%d)\n",
            i, callee.func, callee.file, callee.lineno);
    }
}

void vm_print_error(ErrorInfo &info) {
    vm_port_print("Unhandled error: %s\n", info.message.c_str());
    vm_port_print("Backtrace:\n");
    vm_print_stacktrace(info.frames);
}

static void check_nargs_or_panic(int nargs, int nth) {
    if (nth >= nargs) {
        VM_PANIC("too few args");
    }
}

int vm_get_int_arg_or_panic(Context *ctx, int nargs, Value *args, int nth) {
    check_nargs_or_panic(nargs, nth);
    return args[nth].toInt();
}

std::string vm_get_string_arg_or_panic(Context *ctx, int nargs, Value *args, int nth) {
    check_nargs_or_panic(nargs, nth);
    return args[nth].toString();
}

Value vm_get_arg_or_panic(Context *ctx, int nargs, Value *args, int nth) {
    check_nargs_or_panic(nargs, nth);
    return args[nth];
}

ErrorInfo::ErrorInfo(SourceLoc loc, std::string message) : message(message) {
    Context *ctx = vm_port_get_current_context();
    if (!ctx) {
        // FIXME: Called in the initialization phase.
        return;
    }

    frames = ctx->frames;
    frames.push_back(loc);
}

ErrorInfo::~ErrorInfo() {
    if (!checked) {
        vm_port_unhandled_error(*this);
    }
}

Value Value::call(Context *ctx, int nargs, Value *args) {
    if (inner->type != ValueType::Function) {
        return VM_CREATE_ERROR("not callable");
    }

    return inner->v_f(ctx, nargs, args);
}

Value Value::get(Value prop) {
    switch (inner->type) {
    case ValueType::Object: {
        if (prop.type() != ValueType::String) {
            return VM_CREATE_ERROR("prop must be string");
        }

        std::string propString = prop.toString();
        if (inner->v_obj.find(propString) == inner->v_obj.end()) {
            return Value::Undefined();
        }

        ValueInner *inner_value = inner->v_obj[propString];
        inner_value->ref_count++;
        return Value(inner_value);
    }
    default:
        return Value::Undefined();
    }
}

Value Value::set(Value prop, Value value) {
    switch (inner->type) {
    case ValueType::Object: {
        if (prop.type() != ValueType::String) {
            return VM_CREATE_ERROR("prop must be string");
        }

        value.inner->ref_count++;
        inner->v_obj[prop.toString()] = value.inner;
    }
    default:
        return Value::Undefined();
    }
}

Value Scope::get(const char *id) {
    Scope *scope = this;
    while (scope) {
        if (scope->vars.find(id) != scope->vars.end()) {
            return scope->vars[id].value;
        }

        scope = scope->prev;
    }

    VM_PANIC("undefined reference: %s", id);
}

void Scope::set(const char *id, Value value) {
    vars[id] = Var(value);
}

void Context::enter_scope(SourceLoc callee) {
    Scope *new_scope = new Scope(current);
    current = new_scope;
    frames.push_back(callee);
}

void Context::leave_scope() {
    VM_ASSERT(current != nullptr);
    Scope *prev = current->prev;
    current->ref_count--;
    if (current->ref_count == 0) {
        delete current;
    }
    current = prev;
    frames.pop_back();
}

Scope *Context::create_closure_scope() {
    current->ref_count++;
    return current;
}

Value Context::call(SourceLoc called_from, Value func, int nargs, Value *args) {
    enter_scope(called_from);
    Value ret = func.call(this, nargs, args);
    leave_scope();
    return ret;
}
