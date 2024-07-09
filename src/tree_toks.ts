import * as vsc from 'vscode'
import * as lsp from 'vscode-languageclient/node'
import * as main from './main'
import * as tree from './tree'

export let treeToks: TreeToks


export function init(ctx: vsc.ExtensionContext): { dispose(): any }[] {
    return [
        vsc.window.registerTreeDataProvider('atmoVcToks', treeToks = new TreeToks()),
        vsc.window.onDidChangeActiveTextEditor(onDidChangeActiveTextEditor),
        vsc.workspace.onDidChangeTextDocument(onDidChangeTextDocument)
    ]
}

function onDidChangeActiveTextEditor(_: vsc.TextEditor | undefined) { treeToks.refresh() }
function onDidChangeTextDocument(evt: vsc.TextDocumentChangeEvent) { treeToks.refresh() }


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
    TokKindErr = 0,
    TokKindBrace = 1,
    TokKindSep = 2,
    TokKindOp = 3,
    TokKindIdent = 4,
    TokKindComment = 5,
    TokKindLitRune = 6,
    TokKindLitStr = 7,
    TokKindLitInt = 8,
    TokKindLitFloat = 9,
}
type Toks = Tok[]
type TopLevelToksChunks = Toks[]

const tokKindIcons = new Map<TokKind, string>([
    [TokKind.TokKindErr, "event"],
    [TokKind.TokKindBrace, "namespace"],
    [TokKind.TokKindOp, "operator"],
    [TokKind.TokKindSep, "blank"],
    [TokKind.TokKindIdent, "key"],
    [TokKind.TokKindComment, "comment"],
    [TokKind.TokKindLitRune, "string"],
    [TokKind.TokKindLitStr, "string"],
    [TokKind.TokKindLitInt, "numeric"],
    [TokKind.TokKindLitFloat, "numeric"],
])

class TreeToks extends tree.Tree<Tok | Toks> {
    override getTreeItem(item: Tok | Toks): vsc.TreeItem | Thenable<vsc.TreeItem> {
        if (Array.isArray(item)) {  // item: Toks
            const ret = new tree.TreeItem(`L${item[0].Pos.Line}-${item[item.length - 1].Pos.Line}`, true, item)
            ret.description = item.map((_) => _.Src).join(" ")
            ret.tooltip = new vsc.MarkdownString("```atmo\n" + ret.description + "\n```\n")
            return ret
        } else {                    // item: Tok
            const icon = `symbol-${tokKindIcons.get(item.Kind)}`
            const ret = new tree.TreeItem(`L${item.Pos.Line}C${item.Pos.Char} ${TokKind[item.Kind].substring("TokKind".length)}`, false, item)
            ret.iconPath = new vsc.ThemeIcon(icon)
            ret.description = item.Src
            ret.tooltip = new vsc.MarkdownString("```atmo\n" + ret.description + "\n```\n")
            return ret
        }
    }

    override async getChildren(item?: Tok | Toks | undefined): Promise<Toks | TopLevelToksChunks> {
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

    override getParent?(item: Tok | Toks): vsc.ProviderResult<Tok | Toks> {
        return ((!Array.isArray(item)) ? item.parent : undefined)
    }

}
