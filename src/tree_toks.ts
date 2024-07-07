import * as vsc from 'vscode'
import * as lsp from 'vscode-languageclient/node'
import * as main from './main'

export let treeToks: TocTree


export function init(ctx: vsc.ExtensionContext): { dispose(): any }[] {
    return [
        vsc.window.registerTreeDataProvider('atmoVcTocs', treeToks = new TocTree()),
        vsc.window.onDidChangeActiveTextEditor(onDidChangeActiveTextEditor),
        vsc.workspace.onDidChangeTextDocument(onDidChangeTextDocument)
    ]
}

function onDidChangeActiveTextEditor(_: vsc.TextEditor | undefined) {
    treeToks.eventEmitter.fire(undefined)
}

function onDidChangeTextDocument(evt: vsc.TextDocumentChangeEvent) {
    treeToks.eventEmitter.fire(undefined)
}


type Tok = {
    Kind: TokKind
    Pos: {
        Line: number
        Char: number
    }
    ByteOffset: number
    Src: string
}
enum TokKind {
    TokKindBrace = 1,
    TokKindOp = 2,
    TokKindSep = 3,
    TokKindIdent = 4,
    TokKindComment = 5,
    TokKindLitChar = 6,
    TokKindLitStr = 7,
    TokKindLitInt = 8,
    TokKindLitFloat = 9,
}
class TocTree implements vsc.TreeDataProvider<Tok> {
    eventEmitter: vsc.EventEmitter<undefined> = new vsc.EventEmitter<undefined>()
    onDidChangeTreeData: vsc.Event<undefined> = this.eventEmitter.event

    getTreeItem(item: Tok): vsc.TreeItem | Thenable<vsc.TreeItem> {
        const ret = new vsc.TreeItem(`L${item.Pos.Line}C${item.Pos.Char} ${TokKind[item.Kind].substring("TokKind".length)}`)
        ret.description = item.Src
        return ret
    }

    async getChildren(item?: Tok | undefined): Promise<Tok[]> {
        const ed = vsc.window.activeTextEditor
        if (item || (!main.lspClient) || (!ed) || (!ed.document) || (ed.document.languageId !== 'atmo'))
            return []
        const ret = await main.lspClient.sendRequest('workspace/executeCommand',
            { command: 'getSrcFileToks', arguments: [ed.document.uri.fsPath] } as lsp.ExecuteCommandParams)
        return ((ret && Array.isArray(ret) && ret.length) ? (ret[0] as Tok[]) : [])
    }

    getParent?(_: Tok): vsc.ProviderResult<Tok> {
        return undefined
    }

    resolveTreeItem?(item: vsc.TreeItem, _: Tok, _cancel: vsc.CancellationToken): vsc.ProviderResult<vsc.TreeItem> {
        return item
    }

}
