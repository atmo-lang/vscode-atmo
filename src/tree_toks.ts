import * as vsc from 'vscode'
import * as lsp from 'vscode-languageclient/node'
import * as main from './main'
import * as tree from './tree'

export let treeToks: TreeToks

export function init(ctx: vsc.ExtensionContext): { dispose(): any }[] {
    return [
        vsc.window.registerTreeDataProvider('atmoVcToks', treeToks = new TreeToks(ctx, "toks")),
        vsc.window.onDidChangeActiveTextEditor(treeToks.refresh.bind(treeToks)),
        vsc.workspace.onDidChangeTextDocument(treeToks.refresh.bind(treeToks)),
    ]
}

export type Tok = {
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
export type Toks = Tok[]
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
    cmdOnClick(it: tree.Item<Tok | Toks>): vsc.Command {
        return { command: this.cmdName, arguments: [it], title: "Reveal in text editor" }
    }

    override getTreeItem(item: Tok | Toks): vsc.TreeItem | Thenable<vsc.TreeItem> {
        if (Array.isArray(item)) {  // item: Toks
            const ret = new tree.Item(`L${item[0].Pos.Line}-${item[item.length - 1].Pos.Line}`, true, item)
            ret.description = item.map((_) => _.Src).join(" ")
            ret.tooltip = new vsc.MarkdownString("```atmo\n" + ret.description + "\n```\n")
            ret.command = this.cmdOnClick(ret)
            return ret
        } else {                    // item: Tok
            const ret = new tree.Item(`L${item.Pos.Line}C${item.Pos.Char} · ${TokKind[item.Kind].substring("TokKind".length)}`, false, item)
            ret.iconPath = new vsc.ThemeIcon(`symbol-${tokKindIcons.get(item.Kind)}`)
            ret.description = item.Src
            ret.tooltip = new vsc.MarkdownString("```atmo\n" + ret.description + "\n```\n")
            ret.command = this.cmdOnClick(ret)
            return ret
        }
    }

    override async getChildren(item?: Tok | Toks | undefined): Promise<Toks | TopLevelToksChunks> {
        const ed = vsc.window.activeTextEditor

        if (item && Array.isArray(item))
            return item

        if (item || (!main.lspClient) || (!ed) || (!ed.document) || (ed.document.languageId !== 'atmo'))
            return []

        const ret: TopLevelToksChunks | undefined = await main.lspClient.sendRequest('workspace/executeCommand',
            { command: 'getSrcFileToks', arguments: [ed.document.uri.fsPath] } as lsp.ExecuteCommandParams)

        if (ret && Array.isArray(ret) && ret.length) {
            ret.forEach((toks: Toks) => {
                toks.forEach((tok) => { tok.parent = toks })
            })
            return ret
        }
        return []
    }

    override getParent?(item: Tok | Toks): vsc.ProviderResult<Tok | Toks> {
        return ((!Array.isArray(item)) ? item.parent : undefined)
    }

    override onItemClick(it: tree.Item<Tok | Toks>): void {
        if (it && vsc.window.activeTextEditor) {
            const range = Array.isArray(it.data) ? rangeToks(it.data) : rangeTok(it.data)
            vsc.window.activeTextEditor.selections = [new vsc.Selection(range.start, range.end)]
            vsc.window.showTextDocument(vsc.window.activeTextEditor.document)
        }
    }

}

function rangeTok(tok: Tok): vsc.Range {
    let end_line = tok.Pos.Line - 1, end_char = tok.Pos.Char
    for (let i = 1; i < tok.Src.length; i++)
        if (tok.Src[i] != '\n')
            end_char++
        else
            [end_line, end_char] = [end_line + 1, 1]

    return new vsc.Range(new vsc.Position(tok.Pos.Line - 1, tok.Pos.Char - 1), new vsc.Position(end_line, end_char))
}

export function rangeToks(toks: Toks): vsc.Range {
    return new vsc.Range(rangeTok(toks[0]).start, rangeTok(toks[toks.length - 1]).end)
}
