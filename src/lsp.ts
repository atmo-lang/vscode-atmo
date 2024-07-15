import * as vsc from 'vscode'
import * as lsp from 'vscode-languageclient/node'


export function init(ctx: vsc.ExtensionContext): (lsp.LanguageClient | null) {
    const cfg = vsc.workspace.getConfiguration()
    const cmd_name_and_args = cfg.get<string[]>('atmo.lsp.cmd', ['atmo', "lsp"])
    if (cfg.get<boolean>('atmo.lsp.disabled', false) || (!cmd_name_and_args) || (!cmd_name_and_args.length))
        return null

    const client = new lsp.LanguageClient(
        'lsp_atmo', "Atmo LSP",

        {
            transport: lsp.TransportKind.stdio,
            command: cmd_name_and_args[0],
            args: cmd_name_and_args.slice(1)
        } as lsp.ServerOptions,

        {
            documentSelector: [{ language: 'atmo', scheme: 'file' }],
            revealOutputChannelOn: lsp.RevealOutputChannelOn.Error,
            synchronize: { fileEvents: vsc.workspace.createFileSystemWatcher('**/*.at') },
        } as lsp.LanguageClientOptions

    )
    client.onDidChangeState((evt) => {
        if (evt.newState == lsp.State.Running)
            client.sendRequest('workspace/executeCommand',
                { command: 'announceAtmoVscExt', arguments: [] } as lsp.ExecuteCommandParams)
    })
    client.start()
    return client
}
