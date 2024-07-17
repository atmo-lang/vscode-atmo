import * as vsc from 'vscode'

import * as lsp from './lsp'
import * as tree from './tree'


let treeToks: TreeToks


export function init(ctx: vsc.ExtensionContext): { dispose(): any }[] {
    return [
        vsc.window.registerTreeDataProvider('atmoVcToks', treeToks = new TreeToks(ctx, "toks", tree.RefreshKind.OnDocEvents)),
    ]
}


export type Toks = Tok[]
export type Tok = {
    Kind: TokKind
    Pos: {
        Line: number
        Char: number
    }
    Src: string
    parent: Toks
}
export enum TokKind {
    Begin = 1,
    End = 2,
    Comment = 3,
    Brace = 4,
    IdentWord = 5,
    IdentOpish = 6,
    LitRune = 7,
    LitStr = 8,
    LitInt = 9,
    LitFloat = 10,
}

const tokKindIcons = new Map<TokKind, string>([
    [TokKind.Begin, "arrow-right"],
    [TokKind.End, "arrow-left"],
    [TokKind.Comment, "comment"],
    [TokKind.Brace, "symbol-array"],
    [TokKind.IdentWord, "symbol-key"],
    [TokKind.IdentOpish, "symbol-operator"],
    [TokKind.LitRune, "symbol-string"],
    [TokKind.LitStr, "symbol-string"],
    [TokKind.LitInt, "symbol-numeric"],
    [TokKind.LitFloat, "symbol-numeric"],
])


class TreeToks extends tree.Tree<Tok> {
    cmdOnClick(it: tree.Item<Tok>): vsc.Command {
        return { command: this.cmdName, arguments: [it], title: "Open source file" }
    }

    override getTreeItem(item: Tok): vsc.TreeItem | Thenable<vsc.TreeItem> {
        const range = rangeTok(item)
        const ret = new tree.Item(`L${range.start.line + 1} C${range.start.character + 1} - L${range.end.line + 1} C${range.end.character + 1} · ${TokKind[item.Kind]}`, false, item)
        ret.iconPath = new vsc.ThemeIcon((item.Src.charCodeAt(0) == 16) ? "arrow-right" : ((item.Src.charCodeAt(0) == 17) ? "arrow-left" : tokKindIcons.get(item.Kind)!))
        ret.description = (item.Src.charCodeAt(0) == 16) ? "<indent>" : ((item.Src.charCodeAt(0) == 17) ? "<outdent>" : item.Src)
        ret.tooltip = new vsc.MarkdownString("```atmo\n" + ret.description + "\n```\n", true)
        ret.command = this.cmdOnClick(ret)
        return ret
    }

    override async getChildren(item?: Tok | undefined): Promise<Toks> {
        if (item || !this.doc)
            return []

        return (await lsp.executeCommand('getSrcFileToks', this.doc.uri.fsPath)) ?? []
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
