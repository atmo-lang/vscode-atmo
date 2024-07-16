import * as vsc from 'vscode'

import * as lsp from './lsp'
import * as tree from './tree'


let treeEst: TreeEst


export function init(ctx: vsc.ExtensionContext): { dispose(): any }[] {
    return [
        vsc.window.registerTreeDataProvider('atmoVcEst', treeEst = new TreeEst(ctx, "est", true, true)),
    ]
}


type EstNodes = EstNode[]
type EstNode = {
    parent: EstNode
    Kind: EstNodeKind
    ChildNodes: EstNodes
}
enum EstNodeKind {
    Ident = 1,
    Lit = 2,
    Call = 3,
}

const nodeKindIcons = new Map<EstNodeKind, string>([
    [EstNodeKind.Call, "symbol-namespace"],
    [EstNodeKind.Ident, "symbol-variable"],
    [EstNodeKind.Lit, "symbol-constant"],
])


class TreeEst extends tree.Tree<EstNode> {
    cmdOnClick(it: tree.Item<EstNode>): vsc.Command {
        return { command: this.cmdName, arguments: [it], title: "No-op for now" }
    }

    override getTreeItem(item: EstNode): vsc.TreeItem | Thenable<vsc.TreeItem> {
        const ret = new tree.Item(`${EstNodeKind[item.Kind]}`,
            (item.ChildNodes && item.ChildNodes.length) ? true : false, item)
        ret.iconPath = new vsc.ThemeIcon(nodeKindIcons.get(item.Kind)!)
        ret.description = "descr."
        ret.tooltip = "tooltip"
        ret.command = this.cmdOnClick(ret)
        return ret
    }

    override async getChildren(item?: EstNode | undefined): Promise<EstNodes> {
        if (!this.doc)
            return []

        if (item)
            return item.ChildNodes ?? []

        const ret: EstNodes | undefined = await lsp.executeCommand('getSrcPkgEst', this.doc.uri.fsPath)
        if (ret && Array.isArray(ret) && ret.length)
            walkNodes(ret, (node) => {
                if (node.ChildNodes && node.ChildNodes.length)
                    for (const sub_node of node.ChildNodes)
                        sub_node.parent = node
            })
        return ret ?? []
    }

    override getParent?(item: EstNode): vsc.ProviderResult<EstNode> {
        return item.parent
    }

    override onItemClick(it: tree.Item<EstNode>): void {
    }

}

function walkNodes(nodes: EstNodes, onNode: (_: EstNode) => void) {
    for (const node of nodes) {
        onNode(node)
        if (node.ChildNodes)
            walkNodes(node.ChildNodes, onNode)
    }
}
