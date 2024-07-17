import * as vsc from 'vscode'

import * as lsp from './lsp'
import * as tree from './tree'
import * as tree_toks from './tree_toks'
import * as tree_multi from './tree_multi'


let treeAst: TreeAst


export function init(ctx: vsc.ExtensionContext): { dispose(): any }[] {
    return [
        vsc.window.registerTreeDataProvider('atmoVcAst', treeAst = new TreeAst(ctx, "ast", tree.RefreshKind.OnDocEvents)),
    ]
}


export type AstNodes = AstNode[]
export type AstNode = {
    parent: AstNode
    Kind: AstNodeKind
    Nodes: AstNodes
    Toks: tree_toks.Toks
    Src: string
    Lit: number | string | null
}
export enum AstNodeKind {
    Err = 0,
    Comment = 1,
    Ident = 2,
    Lit = 3,
    Group = 4,
}

const nodeKindIcons = new Map<AstNodeKind, string>([
    [AstNodeKind.Err, "symbol-event"],
    [AstNodeKind.Group, "symbol-namespace"],
    [AstNodeKind.Ident, "symbol-variable"],
    [AstNodeKind.Lit, "symbol-constant"],
    [AstNodeKind.Comment, "comment"],
])


class TreeAst extends tree.Tree<AstNode> {
    cmdOnClick(it: tree.Item<AstNode>): vsc.Command {
        return { command: this.cmdName, arguments: [it], title: "Open source file" }
    }

    override getTreeItem(item: AstNode): vsc.TreeItem | Thenable<vsc.TreeItem> {
        const range: vsc.Range | undefined = item.Toks ? rangeNode(item) : undefined
        const ret = new tree.Item(`L${(range?.start.line ?? -1) + 1} C${(range?.start.character ?? -1) + 1} - L${(range?.end.line ?? -1) + 1} C${(range?.end.character ?? -1) + 1} · ${AstNodeKind[item.Kind]}`,
            (item.Nodes && item.Nodes.length) ? true : false, item)
        ret.iconPath = new vsc.ThemeIcon(nodeKindIcons.get(item.Kind)!)
        ret.description = "" + item.Src
        ret.tooltip = new vsc.MarkdownString("```atmo\n" + ret.description + "\n```\n", true)
        ret.command = this.cmdOnClick(ret)
        return ret
    }

    override async getChildren(item?: AstNode): Promise<AstNodes> {
        if (!this.doc)
            return []

        if (item)
            return item.Nodes ?? []

        const ret: AstNodes | undefined = await lsp.executeCommand('getSrcFileAst', this.doc.uri.fsPath)
        if (ret && Array.isArray(ret) && ret.length)
            walkNodes(ret, (node) => {
                if (node.Nodes && node.Nodes.length)
                    for (const sub_node of node.Nodes)
                        sub_node.parent = node
            })
        return ret ?? []
    }

    override getParent?(item: AstNode): vsc.ProviderResult<AstNode> {
        return item.parent
    }

    override onItemClick(it: tree.Item<AstNode>): void {
        if (it.data.Toks && vsc.window.activeTextEditor) {
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
        if (node.Nodes)
            walkNodes(node.Nodes, onNode)
    }
}
