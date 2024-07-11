import * as vsc from 'vscode'
import * as lsp from 'vscode-languageclient/node'
import * as main from './main'
import * as tree from './tree'
import * as tree_toks from './tree_toks'

export let treeAstOrig: TreeAst

export function init(ctx: vsc.ExtensionContext): { dispose(): any }[] {
    return [
        vsc.window.registerTreeDataProvider('atmoVcAstOrig', treeAstOrig = new TreeAst(ctx, "astOrig")),
        vsc.window.onDidChangeActiveTextEditor(treeAstOrig.refresh.bind(treeAstOrig)),
        vsc.workspace.onDidChangeTextDocument(treeAstOrig.refresh.bind(treeAstOrig)),
    ]
}

type AstNode = {
    parent: AstNode
    Kind: AstNodeKind
    ChildNodes: AstNodes
    Toks: tree_toks.Toks
    Src: string
    Lit: number | string | null
}
enum AstNodeKind {
    Err = 0,
    CallForm = 1,
    CurlyBraces = 2,
    SquareBrackets = 3,
    Ident = 4,
    Lit = 5,
}
type AstNodes = AstNode[]

const tokKindIcons = new Map<AstNodeKind, string>([
    [AstNodeKind.Err, "event"],
    [AstNodeKind.CallForm, "method"],
    [AstNodeKind.CurlyBraces, "namespace"],
    [AstNodeKind.SquareBrackets, "array"],
    [AstNodeKind.Ident, "variable"],
    [AstNodeKind.Lit, "constant"],
])

class TreeAst extends tree.Tree<AstNode> {
    cmdOnClick(it: tree.Item<AstNode>): vsc.Command {
        return { command: this.cmdName, arguments: [it], title: "Reveal in text editor" }
    }

    override getTreeItem(item: AstNode): vsc.TreeItem | Thenable<vsc.TreeItem> {
        const range = rangeNode(item)
        const ret = new tree.Item(`L${range.start.line + 1}C${range.start.character + 1}-L${range.end.line + 1}C${range.end.character + 1} · ${AstNodeKind[item.Kind]}`,
            (item.ChildNodes && item.ChildNodes.length) ? true : false, item)
        ret.iconPath = new vsc.ThemeIcon(`symbol-${tokKindIcons.get(item.Kind)}`)
        ret.description = item.Src
        ret.tooltip = new vsc.MarkdownString("```atmo\n" + ret.description + "\n```\n")
        ret.command = this.cmdOnClick(ret)
        return ret
    }

    override async getChildren(item?: AstNode | undefined): Promise<AstNodes> {
        const ed = vsc.window.activeTextEditor

        if ((!main.lspClient) || (!ed) || (!ed.document) || (ed.document.languageId !== 'atmo'))
            return []

        if (item)
            return item.ChildNodes

        const ret: AstNodes | undefined = await main.lspClient.sendRequest('workspace/executeCommand',
            { command: 'getSrcFileAstOrig', arguments: [ed.document.uri.fsPath] } as lsp.ExecuteCommandParams)
        if (ret && Array.isArray(ret) && ret.length) {
            walkNodes(ret, (node) => {
                if (node.ChildNodes)
                    for (const sub_node of node.ChildNodes)
                        sub_node.parent = node
            })
            return ret
        }
        return []
    }

    override getParent?(item: AstNode): vsc.ProviderResult<AstNode> {
        return item.parent
    }

    override onItemClick(it: tree.Item<AstNode>): void {
        if (it && vsc.window.activeTextEditor) {
            const range = rangeNode(it.data)
            vsc.window.activeTextEditor.selections = [new vsc.Selection(range.start, range.end)]
            vsc.window.showTextDocument(vsc.window.activeTextEditor.document)
        }
    }

}

function rangeNode(node: AstNode): vsc.Range {
    return tree_toks.rangeToks(node.Toks)
}

function walkNodes(nodes: AstNodes, onNode: (_: AstNode) => void) {
    for (const node of nodes) {
        onNode(node)
        if (node.ChildNodes)
            walkNodes(node.ChildNodes, onNode)
    }
}
