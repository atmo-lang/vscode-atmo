import * as vsc from 'vscode'
import * as vsc_lsp from 'vscode-languageclient/node'
import * as node_path from 'path'


export let client: vsc_lsp.LanguageClient

export type SrcFilePos = {
    // starts at 1
    Line: number
    // starts at 1
    Char: number
}
export type SrcFileSpan = {
    Start: SrcFilePos
    End: SrcFilePos
}


export function init(ctx: vsc.ExtensionContext) {
    const cfg = vsc.workspace.getConfiguration()
    const cmd_name_and_args = cfg.get<string[]>('atmo.lsp.cmd', ['atmo', "lsp"])
    if (cfg.get<boolean>('atmo.lsp.disabled', false) || (!cmd_name_and_args) || (!cmd_name_and_args.length))
        return null

    ctx.subscriptions.push(
        client = new vsc_lsp.LanguageClient(
            'lsp_atmo', "Atmo LSP",

            {
                transport: vsc_lsp.TransportKind.stdio,
                command: cmd_name_and_args[0],
                args: cmd_name_and_args.slice(1)
            } as vsc_lsp.ServerOptions,

            {
                documentSelector: [
                    { language: 'atmo', scheme: 'file' },
                    { language: 'atmo', scheme: 'vscode-notebook-cell' },
                ],
                revealOutputChannelOn: vsc_lsp.RevealOutputChannelOn.Error,
                synchronize: { fileEvents: vsc.workspace.createFileSystemWatcher('**/*.at') },
            } as vsc_lsp.LanguageClientOptions

        ),

        client.onDidChangeState((evt) => {
            if (evt.newState == vsc_lsp.State.Running)
                executeCommand('announceAtmoVscExt')
        }),
    )

    client.start()
}


export function maybeSendFsRefreshPoke(evt: vsc.FileRenameEvent | vsc.FileDeleteEvent) {
    let was_folder_event_maybe = false
    for (const file_event of evt.files) {
        const uri = file_event as vsc.Uri,
            old_uri = (file_event as any).oldUri as vsc.Uri,
            new_uri = (file_event as any).newUri as vsc.Uri
        if (uri && uri.fsPath && !node_path.extname(uri.fsPath))
            was_folder_event_maybe = true
        if (old_uri && new_uri && old_uri.fsPath && new_uri.fsPath && ((!node_path.extname(old_uri.fsPath)) || !node_path.extname(new_uri.fsPath)))
            was_folder_event_maybe = true
        if (was_folder_event_maybe)
            break
    }
    if (was_folder_event_maybe)
        executeCommand('pkgsFsRefresh')
}


export function executeCommand<T>(commandName: string, ...args: any[]) {
    return client.sendRequest<T>('workspace/executeCommand',
        { command: commandName, arguments: args } as vsc_lsp.ExecuteCommandParams)
}


export function toVscPos(pos: SrcFilePos): vsc.Position {
    return new vsc.Position(pos.Line - 1, pos.Char - 1)
}
export function toVscRange(span: SrcFileSpan): vsc.Range {
    return new vsc.Range(toVscPos(span.Start), toVscPos(span.End))
}
