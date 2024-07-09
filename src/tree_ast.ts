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

type Node = {
    parent: Node
    Kind: NodeKind
    Children: Nodes
    Toks: tree_toks.Toks
    Src: string
    LitAtom: number | string | null
}
enum NodeKind {
    NodeKindErr = 0,
    NodeKindCallForm = 1,
    NodeKindCurlyBraces = 2,
    NodeKindSquareBrackets = 3,
    NodeKindLitInt = 4,
    NodeKindLitFloat = 5,
    NodeKindLitRune = 6,
    NodeKindLitStr = 7,
    NodeKindIdent = 8,
}
type Nodes = Node[]

const tokKindIcons = new Map<NodeKind, string>([
    [NodeKind.NodeKindErr, "event"],
    [NodeKind.NodeKindCallForm, "method"],
    [NodeKind.NodeKindCurlyBraces, "namespace"],
    [NodeKind.NodeKindSquareBrackets, "array"],
    [NodeKind.NodeKindLitInt, "numeric"],
    [NodeKind.NodeKindLitFloat, "numeric"],
    [NodeKind.NodeKindLitRune, "string"],
    [NodeKind.NodeKindLitStr, "string"],
    [NodeKind.NodeKindIdent, "variable"],
])

class TreeAst extends tree.Tree<Node> {
    cmdOnClick(it: tree.Item<Node>): vsc.Command {
        return { command: this.cmdName, arguments: [it], title: "Reveal in text editor" }
    }

    override getTreeItem(item: Node): vsc.TreeItem | Thenable<vsc.TreeItem> {
        const range = rangeNode(item)
        const ret = new tree.Item(`L${range.start.line + 1}C${range.start.character + 1}-L${range.end.line + 1}C${range.end.character + 1} · ${NodeKind[item.Kind].substring("NodeKind".length)}`,
            (item.Children && item.Children.length) ? true : false, item)
        ret.iconPath = new vsc.ThemeIcon(`symbol-${tokKindIcons.get(item.Kind)}`)
        ret.description = item.Src
        ret.tooltip = new vsc.MarkdownString("```atmo\n" + ret.description + "\n```\n")
        ret.command = this.cmdOnClick(ret)
        return ret
    }

    override async getChildren(item?: Node | undefined): Promise<Nodes> {
        const ed = vsc.window.activeTextEditor

        if ((!main.lspClient) || (!ed) || (!ed.document) || (ed.document.languageId !== 'atmo'))
            return []

        if (item)
            return item.Children

        const ret: Nodes | undefined = await main.lspClient.sendRequest('workspace/executeCommand',
            { command: 'getSrcFileAstOrig', arguments: [ed.document.uri.fsPath] } as lsp.ExecuteCommandParams)
        if (ret && Array.isArray(ret) && ret.length) {
            walkNodes(ret, (node) => {
                if (node.Children)
                    for (const sub_node of node.Children)
                        sub_node.parent = node
            })
            return ret
        }
        return []
    }

    override getParent?(item: Node): vsc.ProviderResult<Node> {
        return item.parent
    }

    override onItemClick(it: tree.Item<Node>): void {
        if (it && vsc.window.activeTextEditor) {
            const range = rangeNode(it.data)
            vsc.window.activeTextEditor.selections = [new vsc.Selection(range.start, range.end)]
            vsc.window.showTextDocument(vsc.window.activeTextEditor.document)
        }
    }

}

function rangeNode(node: Node): vsc.Range {
    return tree_toks.rangeToks(node.Toks)
}

function walkNodes(nodes: Nodes, onNode: (_: Node) => void) {
    for (const node of nodes) {
        onNode(node)
        if (node.Children)
            walkNodes(node.Children, onNode)
    }
}
