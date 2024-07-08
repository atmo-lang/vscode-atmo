import * as vsc from 'vscode'
import * as lsp from 'vscode-languageclient/node'
import * as main from './main'
import * as util from './tree_util'

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
    Src: string
    parent: Toks
}
enum TokKind {
    TokKindInvalid = 0,
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
type Toks = Tok[]
type TopLevelToksChunks = Toks[]

class TocTree implements vsc.TreeDataProvider<Tok | Toks> {
    eventEmitter: vsc.EventEmitter<undefined> = new vsc.EventEmitter<undefined>()
    onDidChangeTreeData: vsc.Event<undefined> = this.eventEmitter.event

    getTreeItem(item: Tok | Toks): vsc.TreeItem | Thenable<vsc.TreeItem> {
        if (Array.isArray(item)) {  // item: Toks
            const ret = new util.TreeItem(`L${item[0].Pos.Line}-${item[item.length - 1].Pos.Line}`, true, item)
            ret.description = item.map((_) => _.Src).join(" ")
            ret.tooltip = new vsc.MarkdownString("```atmo\n" + ret.description + "\n```\n")
            return ret
        } else {                    // item: Tok
            const ret = new util.TreeItem(`L${item.Pos.Line}C${item.Pos.Char} ${TokKind[item.Kind].substring("TokKind".length)}`, false, item)
            ret.description = item.Src
            ret.tooltip = new vsc.MarkdownString("```atmo\n" + ret.description + "\n```\n")
            return ret
        }
    }

    async getChildren(item?: Tok | Toks | undefined): Promise<Toks | TopLevelToksChunks> {
        const ed = vsc.window.activeTextEditor

        if (item && Array.isArray(item))
            return item

        if (item || (!main.lspClient) || (!ed) || (!ed.document) || (ed.document.languageId !== 'atmo'))
            return []

        const ret = await main.lspClient.sendRequest('workspace/executeCommand',
            { command: 'getSrcFileToks', arguments: [ed.document.uri.fsPath] } as lsp.ExecuteCommandParams)

        if (ret && Array.isArray(ret) && ret.length) {
            ret.forEach((toks: Toks) => {
                toks.forEach((tok) => { tok.parent = toks })
            })
            return ret as TopLevelToksChunks
        }
        return []
    }

    getParent?(item: Tok | Toks): vsc.ProviderResult<Tok | Toks> {
        return ((!Array.isArray(item)) ? item.parent : undefined)
    }

    resolveTreeItem?(item: vsc.TreeItem, _: Tok | Toks, _cancel: vsc.CancellationToken): vsc.ProviderResult<vsc.TreeItem> {
        return item
    }

}
