import * as vsc from 'vscode'
import * as lsp from 'vscode-languageclient/node'
import * as main from './main'
import * as tree from './tree'

export let treeToks: TreeToks

export function init(ctx: vsc.ExtensionContext): { dispose(): any }[] {
    return [
        vsc.window.registerTreeDataProvider('atmoVcToks', treeToks = new TreeToks(ctx, "toks")),
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
    Brace = 1,
    Sep = 2,
    Op = 3,
    Ident = 4,
    Comment = 5,
    LitRune = 6,
    LitStr = 7,
    LitInt = 8,
    LitFloat = 9,
}
export type Toks = Tok[]

const tokKindIcons = new Map<TokKind, string>([
    [TokKind.Brace, "symbol-namespace"],
    [TokKind.Op, "symbol-operator"],
    [TokKind.Sep, "blank"],
    [TokKind.Ident, "symbol-key"],
    [TokKind.Comment, "comment"],
    [TokKind.LitRune, "symbol-string"],
    [TokKind.LitStr, "symbol-string"],
    [TokKind.LitInt, "symbol-numeric"],
    [TokKind.LitFloat, "symbol-numeric"],
])

class TreeToks extends tree.Tree<Tok> {
    cmdOnClick(it: tree.Item<Tok>): vsc.Command {
        return { command: this.cmdName, arguments: [it], title: "Reveal in text editor" }
    }

    override getTreeItem(item: Tok): vsc.TreeItem | Thenable<vsc.TreeItem> {
        const range = rangeTok(item)
        const ret = new tree.Item(`L${range.start.line + 1} C${range.start.character + 1} - L${range.end.line + 1} C${range.end.character + 1} · ${TokKind[item.Kind]}`, false, item)
        ret.iconPath = new vsc.ThemeIcon(`${tokKindIcons.get(item.Kind)}`)
        ret.description = item.Src
        ret.tooltip = new vsc.MarkdownString("```atmo\n" + ret.description + "\n```\n")
        ret.command = this.cmdOnClick(ret)
        return ret
    }

    override async getChildren(item?: Tok | undefined): Promise<Toks> {
        if (item || (!main.lspClient) || !this.doc)
            return []

        const ret: Toks | undefined = await main.lspClient.sendRequest('workspace/executeCommand',
            { command: 'getSrcFileToks', arguments: [this.doc.uri.fsPath] } as lsp.ExecuteCommandParams)

        return ret ?? []
    }

    override getParent?(item: Tok): vsc.ProviderResult<Tok> {
        return undefined
    }

    override onItemClick(it: tree.Item<Tok>): void {
        if (it && vsc.window.activeTextEditor) {
            const range = rangeTok(it.data)
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
