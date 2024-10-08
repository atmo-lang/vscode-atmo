import * as vsc from 'vscode'

import * as lsp from './lsp'
import * as tree from './tree'
import * as tree_multi from './tree_multi'


export type MoNodes = MoNode[]
export type MoNode = {
    parent?: MoNode
    PrimTypeTag: MoPrimTypeTag
    ClientInfo?: {
        SrcFilePath?: string
        SrcFileSpan?: lsp.SrcFileSpan
        SrcFileText?: string
    }
    Nodes: MoNodes
}
export enum MoPrimTypeTag {
    DictEntry = -1,
    Never,
    Any,
    Void,
    PrimTypeTag,
    Ident,
    Bool,
    NumInt,
    NumUint,
    NumFloat,
    Char,
    Str,
    Err,
    Dict,
    List,
    Tup,
    Call,
    Func,
    Or,
    And,
    Not,
}

const nodeKindIcons = new Map<MoPrimTypeTag, string>([
    [MoPrimTypeTag.Never, "symbol-event"],
    [MoPrimTypeTag.Any, "symbol-event"],
    [MoPrimTypeTag.DictEntry, "symbol-namespace"],
    [MoPrimTypeTag.PrimTypeTag, "symbol-parameter"],
    [MoPrimTypeTag.Ident, "symbol-variable"],
    [MoPrimTypeTag.NumInt, "symbol-operator"],
    [MoPrimTypeTag.Bool, "symbol-boolean"],
    [MoPrimTypeTag.Void, "symbol-boolean"],
    [MoPrimTypeTag.NumUint, "symbol-operator"],
    [MoPrimTypeTag.NumFloat, "symbol-operator"],
    [MoPrimTypeTag.Char, "symbol-string"],
    [MoPrimTypeTag.Str, "symbol-string"],
    [MoPrimTypeTag.Err, "symbol-event"],
    [MoPrimTypeTag.Dict, "symbol-namespace"],
    [MoPrimTypeTag.List, "symbol-array"],
    [MoPrimTypeTag.Tup, "symbol-array"],
    [MoPrimTypeTag.Call, "symbol-color"],
    [MoPrimTypeTag.Func, "symbol-method"],
    [MoPrimTypeTag.Or, "symbol-boolean"],
    [MoPrimTypeTag.And, "symbol-boolean"],
    [MoPrimTypeTag.Not, "symbol-boolean"],
])

export class Provider implements tree_multi.Provider {
    getItem(treeView: tree_multi.TreeMulti, item: MoNode): vsc.TreeItem {
        const ret = new tree.Item(`${MoPrimTypeTag[item.PrimTypeTag]}`, (item.Nodes && item.Nodes.length) ? true : false, item)
        ret.iconPath = new vsc.ThemeIcon(nodeKindIcons.get(item.PrimTypeTag)!)
        if ((ret.description = item.ClientInfo?.SrcFileText ?? "") && ret.description.length)
            ret.tooltip = new vsc.MarkdownString("```atmo\n" + ret.description + "\n```\n", true)
        ret.command = treeView.cmdOnClick(ret)
        return ret
    }

    getParentItem(item: MoNode): MoNode | undefined {
        return item.parent
    }

    async getSubItems(treeView: tree_multi.TreeMulti, item?: MoNode): Promise<MoNodes> {
        if (!treeView.doc)
            return []

        if (item)
            return item.Nodes

        const ret: MoNodes | undefined = await lsp.executeCommand('getSrcPackMoOrig', treeView.doc.uri.fsPath)
        if (ret && Array.isArray(ret) && ret.length)
            setParents(ret)
        return ret ?? []
    }

    onClick(_treeView: tree_multi.TreeMulti, item: MoNode): void {
        if (item.ClientInfo && item.ClientInfo.SrcFilePath && item.ClientInfo.SrcFilePath.length) {
            const range: vsc.Range | undefined = item.ClientInfo.SrcFileSpan ? lsp.toVscRange(item.ClientInfo.SrcFileSpan) : undefined
            vsc.workspace.openTextDocument(item.ClientInfo.SrcFilePath).then(
                (it) => { vsc.window.showTextDocument(it, { selection: range }) },
                vsc.window.showWarningMessage,
            )
        }
    }
}


function setParents(nodes: MoNodes) {
    walkNodes(nodes, (node) => {
        if (node.Nodes && node.Nodes.length)
            for (const sub_node of node.Nodes)
                sub_node.parent = node
    })
}


function walkNodes(nodes: MoNodes, onNode: (_: MoNode) => void) {
    for (const node of nodes) {
        onNode(node)
        if (node.Nodes)
            walkNodes(node.Nodes, onNode)
    }
}
