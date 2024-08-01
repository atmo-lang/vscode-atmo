import * as vsc from 'vscode'

import * as lsp from './lsp'
import * as tree from './tree'
import * as tree_multi from './tree_multi'


export type SemNodes = SemNode[]
export type SemNode = {
    parent?: SemNode
    ErrsOwn?: {
        Kind: number
        Code: string
        Message: string
    }[]
    ClientInfo?: {
        SrcFilePath?: string
        SrcFileSpan?: lsp.SrcFileSpan
        SrcFileText?: string
    }
    Val: SemValScalarOrIdent | SemValCall | SemValList | SemValDict | SemValFunc
    Facts: { Kind: SemFactKind, Data?: any }[]
}

type SemValScalarOrIdent = {
    Ty?: string
    Kind: "scalar"
    MoVal: string | number
}
type SemValCall = {
    Ty?: string
    Kind: "call"
    Callee: SemNode
    Args: SemNodes
}
type SemValList = {
    Ty?: string
    Kind: "list"
    Items: SemNodes
}
type SemValDict = {
    Ty?: string
    Kind: "dict"
    Keys: SemNodes
    Vals: SemNodes
}
type SemValFunc = {
    Ty?: string
    Kind: "func"
    Scope?: string[]
    Params: SemNodes
    Body?: SemNode // undefined for builtin prim funcs
}

enum SemFactKind {
    _,
    SemFactUnused,
    SemFactEffectful,
    SemFactPreComputed,
}

const nodeKindIcons = new Map<string, string>([
    ["scalar", "symbol-variable"],
    ["list", "symbol-array"],
    ["dict", "symbol-namespace"],
    ["call", "symbol-color"],
    ["func", "symbol-method"],
])


export class Provider implements tree_multi.Provider {
    getItem(treeView: tree_multi.TreeMulti, item: SemNode): vsc.TreeItem {
        const facts = (!item.Facts) ? "" : (" — " + item.Facts.map(fact => SemFactKind[fact.Kind].substring("SemFact".length) + (fact.Data ? (":" + fact.Data) : "")).join(", "))
        const ret = new tree.Item(`${item.Val.Kind}${facts}`, ((item.Val.Kind !== 'scalar') && ((item.Val.Kind !== 'func') || (item.Val.Body != undefined))), item)
        ret.iconPath = new vsc.ThemeIcon(nodeKindIcons.get(item.Val.Kind)!)
        if ((ret.description = item.ClientInfo?.SrcFileText ?? "") && ret.description.length)
            ret.tooltip = new vsc.MarkdownString((item.Val.Ty ?? "") + "\n____\n```atmo\n" + ret.description + "\n```\n", true)
        ret.command = treeView.cmdOnClick(ret)
        return ret
    }

    getParentItem(item: SemNode): SemNode | undefined {
        return item.parent
    }

    async getSubItems(treeView: tree_multi.TreeMulti, item?: SemNode): Promise<SemNodes> {
        if (!treeView.doc)
            return []

        if (item) {
            switch (item.Val.Kind) {
                case 'list': return item.Val.Items
                case 'call': return [item.Val.Callee].concat(item.Val.Args)
                case 'dict': return dictEntries(item.Val)
                case 'func': return item.Val.Body ? item.Val.Params.concat(item.Val.Body) : []
            }
            return []
        }

        const ret: SemNodes | undefined = await lsp.executeCommand('getSrcPackMoSem', treeView.doc.uri.fsPath)
        if (ret && Array.isArray(ret) && ret.length)
            setParents(ret)
        return ret ?? []
    }

    onClick(_treeView: tree_multi.TreeMulti, item: SemNode): void {
        if (item.ClientInfo && item.ClientInfo.SrcFilePath && item.ClientInfo.SrcFilePath.length) {
            const range: vsc.Range | undefined = item.ClientInfo.SrcFileSpan ? lsp.toVscRange(item.ClientInfo.SrcFileSpan) : undefined
            vsc.workspace.openTextDocument(item.ClientInfo.SrcFilePath).then(
                (it) => { vsc.window.showTextDocument(it, { selection: range }) },
                vsc.window.showWarningMessage,
            )
        }
    }
}


function dictEntries(dict: SemValDict): SemNodes {
    const ret: SemNodes = []
    for (let i = 0; i < dict.Keys.length; i++)
        ret.push(dict.Keys[i], dict.Vals[i])
    return ret
}


function setParents(nodes: SemNodes, parent?: SemNode) {
    for (const node of nodes)
        if (node) {
            node.parent = parent
            switch (node.Val.Kind) {
                case 'list':
                    setParents(node.Val.Items, node)
                    break
                case 'dict':
                    setParents(node.Val.Keys, node)
                    setParents(node.Val.Vals, node)
                    break
                case 'call':
                    node.Val.Callee.parent = node
                    setParents(node.Val.Args, node)
                    break
                case 'func':
                    setParents(node.Val.Params, node)
                    if (node.Val.Body) // undef for builtin funcs
                        node.Val.Body.parent = node
                    break
            }
        }
}
