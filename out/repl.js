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
exports.NotebookSerializer = exports.Kernel = void 0;
const vsc = __importStar(require("vscode"));
// TODO: Atmo-LSP-specific code here
// below, the VSC plumbin' boilerplate
class Kernel {
    self;
    execOrder = 0;
    constructor() {
        this.self = vsc.notebooks.createNotebookController('nbctl-atmo-repl', 'atmo-repl', "Atmo REPL");
        this.self.supportsExecutionOrder = true;
        this.self.supportedLanguages = ['atmo'];
        this.self.executeHandler = this.exec.bind(this);
    }
    dispose() {
        this.self.dispose();
    }
    exec(cells, notebook, _ctl) {
        for (const cell of cells)
            if (cell.kind === vsc.NotebookCellKind.Code) {
                const exec = this.self.createNotebookCellExecution(cell);
                exec.executionOrder = ++this.execOrder;
                exec.start(Date.now());
                const src = cell.document.getText().trim();
                // TODO: actual REPL / eval call here
                exec.replaceOutput(new vsc.NotebookCellOutput([
                    vsc.NotebookCellOutputItem.text(src, 'text/x-atmo')
                ]));
                exec.end(true, Date.now());
            }
        notebook.save();
    }
}
exports.Kernel = Kernel;
class NotebookSerializer {
    async serializeNotebook(data, _) {
        const cells = [];
        for (const cell of data.cells)
            cells.push({ value: cell.value, kind: cell.kind });
        return new TextEncoder().encode(JSON.stringify(cells));
    }
    async deserializeNotebook(content, _) {
        const cells = JSON.parse(new TextDecoder().decode(content));
        return new vsc.NotebookData(cells.map(item => new vsc.NotebookCellData(item.kind, item.value, ((item.kind === vsc.NotebookCellKind.Code) ? 'atmo' : 'markdown'))));
    }
}
exports.NotebookSerializer = NotebookSerializer;
//# sourceMappingURL=repl.js.map