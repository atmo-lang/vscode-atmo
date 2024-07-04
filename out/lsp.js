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
exports.init = init;
const vsc = __importStar(require("vscode"));
const lsp = __importStar(require("vscode-languageclient/node"));
function init(ctx) {
    const cfg = vsc.workspace.getConfiguration();
    const cmd_name_and_args = cfg.get('atmo.lsp.cmd', ['atmo', "lsp"]);
    if (cfg.get('atmo.lsp.disabled', false) || (!cmd_name_and_args) || (!cmd_name_and_args.length))
        return null;
    const client = new lsp.LanguageClient('lsp_atmo', "Atmo LSP", {
        transport: lsp.TransportKind.stdio,
        command: cmd_name_and_args[0],
        args: cmd_name_and_args.slice(1)
    }, {
        documentSelector: [{ language: 'atmo', scheme: 'file' }],
        revealOutputChannelOn: lsp.RevealOutputChannelOn.Error,
        synchronize: { fileEvents: vsc.workspace.createFileSystemWatcher('**/*.at') },
    });
    client.onDidChangeState((evt) => {
        if (evt.newState == lsp.State.Running)
            client.sendRequest('workspace/executeCommand', { command: 'announce-atmo-vscode-ext', arguments: [] });
    });
    client.start();
    return client;
}
//# sourceMappingURL=lsp.js.map