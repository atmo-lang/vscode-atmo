"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vsc = __importStar(require("vscode"));
const lsp = __importStar(require("./lsp"));
const repl = __importStar(require("./repl"));
const node_path = __importStar(require("node:path"));
const node_fs = __importStar(require("node:fs"));
const node_exec = __importStar(require("child_process"));
let lspClient = null;
let statusBarItemBuildOnSave;
let regDisp;
let lastEvalExpr = "";
function activate(ctx) {
    regDisp = ctx.subscriptions.push.bind(ctx.subscriptions);
    // bring up LSP client unless disabled in user config
    lspClient = lsp.init(ctx);
    if (lspClient)
        regDisp(lspClient);
    // register "repl", aka vscode custom notebook type
    regDisp(new repl.Kernel());
    regDisp(vsc.workspace.registerNotebookSerializer('atmo-repl', new repl.NotebookSerializer()));
    // set up build-on-save
    regDisp(statusBarItemBuildOnSave =
        vsc.window.createStatusBarItem('atmo-build-on-save', vsc.StatusBarAlignment.Left));
    statusBarItemBuildOnSave.text = "$(coffee)";
    statusBarItemBuildOnSave.tooltip = "Atmo build-on-save running...";
    regDisp(vsc.workspace.onDidSaveTextDocument(tryBuildOnSave));
    // set up Eval code actions
    if (lspClient) {
        regDisp(vsc.commands.registerCommand('atmo.cmd.eval.quick', cmdEvalQuick));
        regDisp(vsc.commands.registerCommand('atmo.cmd.eval.repl', cmdReplFromExpr));
        vsc.languages.registerCodeActionsProvider({ scheme: 'file', language: 'atmo' }, {
            provideCodeActions: codeActions,
        });
    }
}
function deactivate() {
    if (lspClient)
        return lspClient.stop();
    return (void 0);
}
function codeActions(it, range, _ctx, _) {
    if (range.isEmpty)
        return [];
    return [
        { command: 'atmo.cmd.eval.quick', title: "Quick-Eval", arguments: [it, range] },
        { command: 'atmo.cmd.eval.repl', title: "New REPL from expression...", arguments: [it, range] },
    ];
}
function cmdEvalQuick(...args) {
    if (args && args.length) {
        args[0] = args[0].fileName;
        lspClient.sendRequest('workspace/executeCommand', { command: 'eval-in-file', arguments: args }).then((result) => vsc.window.showInformationMessage("" + result), vsc.window.showErrorMessage).catch(vsc.window.showErrorMessage);
    }
    else {
        let expr_suggestion = lastEvalExpr;
        if (vsc.window.activeTextEditor && vsc.window.activeTextEditor.document && vsc.window.activeTextEditor.selection && !vsc.window.activeTextEditor.selection.isEmpty)
            expr_suggestion = vsc.window.activeTextEditor.document.getText(vsc.window.activeTextEditor.selection);
        vsc.window.showInputBox({
            title: "Atmo Quick-Eval", value: expr_suggestion, placeHolder: "Enter an Atmo expression",
            prompt: ("Enter an Atmo expression to quick-eval" +
                ((vsc.window.activeTextEditor && vsc.window.activeTextEditor.document && !vsc.window.activeTextEditor.document.isUntitled)
                    ? ` in the context of ${vsc.window.activeTextEditor.document.fileName}`
                    : "")),
        })
            .then(expr_to_eval => {
            if (expr_to_eval && expr_to_eval.length && (expr_to_eval = expr_to_eval.trim()).length)
                lspClient.sendRequest('workspace/executeCommand', {
                    command: 'eval-expr', arguments: [
                        (vsc.window.activeTextEditor.document.isUntitled ? '' : vsc.window.activeTextEditor.document.fileName),
                        lastEvalExpr = expr_to_eval,
                    ]
                }).then((result) => vsc.window.showInformationMessage("" + result), vsc.window.showErrorMessage).catch(vsc.window.showErrorMessage);
        });
    }
}
async function cmdReplFromExpr(...args) {
    let src_file = null;
    if (args && args.length)
        src_file = args[0];
    else if (vsc.window.activeTextEditor)
        src_file = vsc.window.activeTextEditor.document;
    if (!src_file)
        return;
    let range = null;
    if (args && args.length && (args.length > 1))
        range = args[1];
    else if (vsc.window.activeTextEditor && vsc.window.activeTextEditor.selection && !vsc.window.activeTextEditor.selection.isEmpty)
        range = vsc.window.activeTextEditor.selection;
    if (!range)
        return;
    await vsc.window.showNotebookDocument(await vsc.workspace.openNotebookDocument('atmo-repl', {
        cells: [{
                languageId: 'atmo',
                kind: vsc.NotebookCellKind.Code,
                value: src_file.getText(range),
            }],
    }));
}
async function tryBuildOnSave(justSaved) {
    const cfg = vsc.workspace.getConfiguration();
    const build_on_save = cfg.get('atmo.buildOnSave', false);
    if (!build_on_save)
        return;
    let dir_path = node_path.dirname(justSaved.fileName);
    let pkg_file_path = node_path.join(dir_path, 'atmo.pkg');
    while ((dir_path !== '/') && !node_fs.existsSync(pkg_file_path)) {
        dir_path = node_path.dirname(dir_path);
        pkg_file_path = node_path.join(dir_path, 'atmo.pkg');
    }
    if (!node_fs.existsSync(pkg_file_path))
        return;
    console.log(new Date() + "\tbuild-on-save...");
    statusBarItemBuildOnSave.show();
    setTimeout(() => {
        try {
            node_exec.execFileSync('atmo', ['build'], { cwd: dir_path, });
        }
        catch (err) {
            const term = vsc.window.createTerminal({ cwd: dir_path, name: 'atmo build' });
            regDisp(term);
            term.show(true);
            term.sendText('atmo build', true);
        }
        finally {
            statusBarItemBuildOnSave.hide();
        }
    }, 321); // timeout of well over 100ms needed, or all this would delay (by the whole build duration!) LSP didChangeWatchedFiles notification. but with proper timeout, the latter "gets through in time". nodeJS event-loop subtleties...
}
//# sourceMappingURL=main.js.map