import * as vsc from 'vscode'

import * as lsp from './lsp'
import * as tree from './tree'
import * as tree_toks from './tree_toks'
import * as tree_multi from './tree_multi'


export type AstNodes = AstNode[]
export type AstNode = {
    parent?: AstNode
    Kind: AstNodeKind
    Nodes: AstNodes
    Toks: tree_toks.Toks
    Src: string
    Lit: number | string | null
}
export enum AstNodeKind {
    Err,
    Comment,
    Ident,
    Lit,
    Group,
    BlockLine,
}

const nodeKindIcons = new Map<AstNodeKind, string>([
    [AstNodeKind.Err, "symbol-event"],
    [AstNodeKind.Group, "symbol-array"],
    [AstNodeKind.BlockLine, "symbol-namespace"],
    [AstNodeKind.Ident, "symbol-variable"],
    [AstNodeKind.Lit, "symbol-constant"],
    [AstNodeKind.Comment, "comment"],
])


export class Provider implements tree_multi.Provider {
    getItem(treeView: tree_multi.TreeMulti, item: AstNode): vsc.TreeItem {
        const range: vsc.Range | undefined = item.Toks ? rangeNode(item) : undefined
        const ret = new tree.Item(`L${(range?.start.line ?? -1) + 1} C${(range?.start.character ?? -1) + 1} - L${(range?.end.line ?? -1) + 1} C${(range?.end.character ?? -1) + 1} · ${AstNodeKind[item.Kind]}`,
            (item.Nodes && item.Nodes.length) ? true : false, item)
        ret.iconPath = new vsc.ThemeIcon(nodeKindIcons.get(item.Kind)!)
        ret.description = "" + item.Src
        ret.tooltip = new vsc.MarkdownString("```atmo\n" + ret.description + "\n```\n", true)
        ret.command = treeView.cmdOnClick(ret)
        return ret
    }

    getParentItem(item: AstNode): AstNode | undefined {
        return item.parent
    }

    async getSubItems(treeView: tree_multi.TreeMulti, item?: AstNode): Promise<AstNodes> {
        if (!treeView.doc)
            return []

        if (item)
            return item.Nodes ?? []

        const ret: AstNodes | undefined = await lsp.executeCommand('getSrcFileAst', treeView.doc.uri.fsPath)
        if (ret && Array.isArray(ret) && ret.length)
            walkNodes(ret, (node) => {
                if (node.Nodes && node.Nodes.length)
                    for (const sub_node of node.Nodes)
                        sub_node.parent = node
            })
        return ret ?? []
    }

    onClick(treeView: tree_multi.TreeMulti, item: AstNode): void {
        if (item.Toks && vsc.window.activeTextEditor) {
            const range = rangeNode(item)
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
