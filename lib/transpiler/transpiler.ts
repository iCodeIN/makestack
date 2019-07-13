import * as assert from "assert";
import * as parser from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { TranspileError, UnimplementedError } from ".";

export class Transpiler {
    private lambda: string = "";
    private setup: string = "";
    private funcNameStack: string[] = ["(top level)"];

    public transpile(code: string): string {
        const ast = parser.parse(code);
        traverse(ast, this.traverser);
        return this.lambda + "\n\nvoid app_setup(Context *__ctx) {\n" + this.setup + "}\n";
    }

    private traverser = {
        enter: (path: NodePath) => {
            this.visitTopLevel(path.node);
        }
    };

    private getCurrentFuncName(): string {
        const name = this.funcNameStack[this.funcNameStack.length - 1];
        assert(name);
        return name;
    }

    private getNameFromVarDeclId(decl: t.Node): string {
        if (t.isIdentifier(decl)) {
            return decl.name;
        }

        throw new TranspileError(decl, `expected an identifier`);
    }

    private visitBlockStmt(stmt: t.BlockStatement): string {
        const stmts = stmt.body.map(stmt => this.visitStmt(stmt));
        return `{\n${stmts.join(";\n")};\n}`;
    }

    private visitFunctionBody(stmt: t.BlockStatement): string {
        const stmts = stmt.body.map(stmt => this.visitStmt(stmt));
        return `{\n${stmts.join(";\n")};\nreturn Value::Undefined();\n}`;
    }

    private visitExprStmt(stmt: t.ExpressionStatement): string {
        return this.visitExpr(stmt.expression);
    }

    private visitVarDecl(decl: t.VariableDeclarator): string {
        let init;
        if (decl.init) {
            init = this.visitExpr(decl.init);
        } else {
            init = "Value::Undefined()";
        }

        const id = this.getNameFromVarDeclId(decl.id);
        return `__ctx->current->set("${id}", ${init})`;
    }

    private visitVarDeclStmt(stmt: t.VariableDeclaration): string {
        return stmt.declarations
            .map((decl) => this.visitVarDecl(decl))
            .join(";");
    }

    private visitWhileStmt(stmt: t.WhileStatement): string {
        let body;
        if (t.isBlockStatement(stmt.body)) {
            body = this.visitBlockStmt(stmt.body);
        } else if (t.isExpressionStatement(stmt.body)) {
            body = this.visitExprStmt(stmt.body);
        } else {
            throw new UnimplementedError(stmt.body);
        }

        return "while (" + this.visitExpr(stmt.test) + ")" + body;
    }

    private visitStmt(stmt: t.Statement): string {
        if (t.isExpressionStatement(stmt)) {
            return this.visitExprStmt(stmt);
        } else if (t.isVariableDeclaration(stmt)) {
            return this.visitVarDeclStmt(stmt);
        } else if (t.isWhileStatement(stmt)) {
            return this.visitWhileStmt(stmt);
        } else {
            throw new UnimplementedError(stmt);
        }
    }

    private visitCallExpr(expr: t.CallExpression): string {
        const callee = this.visitExpr(expr.callee);
        const func = this.getCurrentFuncName();
        const line = (expr.loc) ? expr.loc.start.line : -1;
        const loc = `SourceLoc("app.js", "${func}", ${line})`;
        const args = expr.arguments.map(arg => this.visitExpr(arg));
        const nargs = args.length;
        return `({` +
                    `Value __tmp_args[] = { ${args.join(", ")} };` +
                    `Value __callee = ${callee};` +
                    `__ctx->call(${loc}, __callee, ${nargs}, __tmp_args);` +
                `})`;
    }

    private lambdaId: number = 0;
    private visitArrowFuncExpr(func: t.ArrowFunctionExpression): string {
        const uniqueId = this.lambdaId;
        const name = `__lambda_${uniqueId}`;
        const closure = `__closure_${uniqueId}`;
        this.lambdaId++;

        this.funcNameStack.push("(anonymous function)");
        let body;
        if (t.isBlockStatement(func.body)) {
            body = this.visitFunctionBody(func.body);
        } else {
            throw new UnimplementedError(func.body);
        }
        this.funcNameStack.pop();

        this.lambda += `Scope *${closure} = nullptr;\n`;
        this.lambda += `static Value ${name}(Context *__ctx, int __nargs, Value *__args)`
            + `\n{  Closure __closure(__ctx, ${closure}); ${body} }\n\n`;
        return `({ ${closure} = __ctx->create_closure_scope(); Value::Function(${name}); })`;
    }

    private visitNumberLit(expr: t.NumericLiteral): string {
        if (!Number.isInteger(expr.value)) {
            throw new TranspileError(expr, "non-integer number is not yet supported");
        }

        return `Value::Int(${expr.value})`;
    }

    private visitStringLit(expr: t.StringLiteral): string {
        // TODO: escape sequences
        return `Value::String("${expr.value}")`;
    }

    private visitIdentExpr(expr: t.Identifier): string {
        return `__ctx->current->get("${expr.name}")`;
    }

    private visitMemberExpr(expr: t.MemberExpression): string {
        const obj = this.visitExpr(expr.object);
        let prop;
        if (expr.computed) {
            prop = this.visitExpr(expr.property);
        } else {
            if (!t.isIdentifier(expr.property)) {
                throw new Error("expected identifier");
            }
            prop = `Value::String("${expr.property.name}")`;
        }

        return `({ Value __obj = ${obj}; __obj.get(${prop}); })`;
    }

    private visitExpr(expr: t.Node): string {
        if (t.isNumericLiteral(expr)) {
            return this.visitNumberLit(expr);
        } else if (t.isStringLiteral(expr)) {
            return this.visitStringLit(expr);
        } else if (t.isIdentifier(expr)) {
            return this.visitIdentExpr(expr);
        } else if (t.isMemberExpression(expr)) {
            return this.visitMemberExpr(expr);
        } else if (t.isCallExpression(expr)) {
            return this.visitCallExpr(expr);
        } else if (t.isArrowFunctionExpression(expr)) {
            return this.visitArrowFuncExpr(expr);
        } else {
            throw new UnimplementedError(expr);
        }
    }

    private visitTopLevel(node: t.Node) {
        // TODO: verify require("makestack")
        // TODO: const variables in the top-level

        const deviceContextCallbacks = [
            "onReady",
        ];

        // Device contexts.
        if (t.isCallExpression(node)
            && t.isMemberExpression(node.callee)
            && t.isIdentifier(node.callee.object)
            && t.isIdentifier(node.callee.property)
            && node.callee.object.name == "app"
            && deviceContextCallbacks.includes(node.callee.property.name)
        ) {
            node.callee = t.identifier("__" + node.callee.property.name);
            this.setup += this.visitCallExpr(node) + `;`;
        }
    }
}
