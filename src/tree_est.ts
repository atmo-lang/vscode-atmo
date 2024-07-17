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
    parent?: EstNode
    Kind: EstNodeKind
    ClientInfo?: {
        SrcFilePath: string
        SrcFileSpan?: lsp.SrcFileSpan
        SrcFileText?: string
    }
    Self?: any
    selfAsNodes: EstNodes
    label?: string
}
enum EstNodeKind {
    None = 0,
    Ident = 1,
    Lit = 2,
    Call = 3,
    Macro = 4,
}

const nodeKindIcons = new Map<EstNodeKind, string>([
    [EstNodeKind.None, "blank"],
    [EstNodeKind.Call, "symbol-method"],
    [EstNodeKind.Ident, "symbol-variable"],
    [EstNodeKind.Lit, "symbol-constant"],
    [EstNodeKind.Macro, "symbol-color"],
])


class TreeEst extends tree.Tree<EstNode> {
    cmdOnClick(it: tree.Item<EstNode>): vsc.Command {
        return { command: this.cmdName, arguments: [it], title: "Open source file" }
    }

    override getTreeItem(item: EstNode): vsc.TreeItem | Thenable<vsc.TreeItem> {
        const ret = new tree.Item(`${(item.Kind === EstNodeKind.None) ? item.label : EstNodeKind[item.Kind]}`,
            (item.Self || (item.selfAsNodes && item.selfAsNodes.length)) ? true : false, item)
        ret.iconPath = new vsc.ThemeIcon(nodeKindIcons.get(item.Kind)!)
        if (ret.description = item.ClientInfo?.SrcFileText ?? "") {
            ret.tooltip = new vsc.MarkdownString("```atmo\n" + ret.description + "\n```\n", true)
            if (item.Self)
                ret.tooltip.appendMarkdown("\n___\n").appendCodeblock(JSON.stringify(item.Self, null, 2), 'json')
        }
        ret.command = this.cmdOnClick(ret)
        return ret
    }

    override async getChildren(item?: EstNode | undefined): Promise<EstNodes> {
        if (!this.doc)
            return []

        if (item) {
            if (item.Self && !item.selfAsNodes) {
                item.selfAsNodes = objNodes(item.Self)
                setParents(item.selfAsNodes)
            }
            return item.selfAsNodes ?? []
        }

        const ret: EstNodes | undefined = await lsp.executeCommand('getSrcPkgEst', this.doc.uri.fsPath)
        if (ret && Array.isArray(ret) && ret.length)
            setParents(ret)
        return ret ?? []
    }

    override getParent?(item: EstNode): vsc.ProviderResult<EstNode> {
        return item.parent
    }

    override onItemClick(it: tree.Item<EstNode>): void {
        if (it.data && it.data.ClientInfo && it.data.ClientInfo.SrcFilePath && it.data.ClientInfo.SrcFilePath.length) {
            const range: vsc.Range | undefined = it.data.ClientInfo.SrcFileSpan ? lsp.toVscRange(it.data.ClientInfo.SrcFileSpan) : undefined
            vsc.workspace.openTextDocument(it.data.ClientInfo.SrcFilePath).then(
                (it) => { vsc.window.showTextDocument(it, { selection: range }) },
                vsc.window.showWarningMessage,
            )
        }
    }

}


function objNodes(it: any[] | { [_: string]: any }): EstNodes {
    const ret: EstNodes = [], is_arr = (Array.isArray(it))
    for (const idx in it) {
        const val = (it as any)[idx]
        const name = is_arr ? `[${idx}]` : idx
        if (!val)
            ret.push({ label: name + ": <null>", Kind: EstNodeKind.None, selfAsNodes: [] })
        else if (Array.isArray(val))
            ret.push({ label: name, Kind: EstNodeKind.None, selfAsNodes: objNodes(val) })
        else if (typeof val === 'object')
            ret.push({ label: name, Kind: EstNodeKind.None, selfAsNodes: objNodes(val) })
        else
            ret.push({ label: name + ": " + val, Kind: EstNodeKind.None, selfAsNodes: [] })
    }
    return ret
}


function setParents(nodes: EstNodes) {
    walkNodes(nodes, (node) => {
        if (node.selfAsNodes && node.selfAsNodes.length)
            for (const sub_node of node.selfAsNodes)
                sub_node.parent = node
    })
}


function walkNodes(nodes: EstNodes, onNode: (_: EstNode) => void) {
    for (const node of nodes) {
        onNode(node)
        if (node.selfAsNodes)
            walkNodes(node.selfAsNodes, onNode)
    }
}
