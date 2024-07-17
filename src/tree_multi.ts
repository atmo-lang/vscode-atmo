import * as vsc from 'vscode'

import * as tree from './tree'
import * as tree_pkgs from './tree_pkgs'
import * as tree_toks from './tree_toks'
import * as tree_ast from './tree_ast'
import * as tree_est from './tree_est'


let treeMulti: TreeMulti


enum ProviderImpl {
    None = 0,
    Pkgs = 1,
    Toks = 2,
    Ast = 3,
    Est = 4,

    notZeroForJSBugginess,
}
const implIcons = new Map<ProviderImpl, string>([
    [ProviderImpl.None, "info"],
    [ProviderImpl.notZeroForJSBugginess, "info"],
    [ProviderImpl.Pkgs, "package"],
    [ProviderImpl.Toks, "list-flat"],
    [ProviderImpl.Ast, "list-tree"],
    [ProviderImpl.Est, "symbol-misc"],
])


export function init(ctx: vsc.ExtensionContext): { dispose(): any }[] {
    return [
        vsc.window.registerTreeDataProvider('atmoViewInspectors', treeMulti = new TreeMulti(ctx)),
        vsc.commands.registerCommand('atmo.inspector.none', () => {
            treeMulti.provider = ProviderImpl.None
        }),
        vsc.commands.registerCommand('atmo.inspector.pkgs', () => {
            treeMulti.provider = ProviderImpl.Pkgs
        }),
        vsc.commands.registerCommand('atmo.inspector.toks', () => {
            treeMulti.provider = ProviderImpl.Toks
        }),
        vsc.commands.registerCommand('atmo.inspector.ast', () => {
            treeMulti.provider = ProviderImpl.Ast
        }),
        vsc.commands.registerCommand('atmo.inspector.est', () => {
            treeMulti.provider = ProviderImpl.Est
        }),
    ]
}


export interface Provider {
    getItem(treeView: TreeMulti, item: any): vsc.TreeItem
    getParentItem(item: any): any
    getSubItems(treeView: TreeMulti, item?: any): Promise<any[]>
    onClick(treeView: TreeMulti, item: any): void
}


class EmptyProvider implements Provider {
    getItem(treeView: TreeMulti, item: ProviderImpl): vsc.TreeItem {
        const ret = new tree.Item<ProviderImpl>(
            ((item === ProviderImpl.Pkgs) ? "·\tin-session packages"
                : (item === ProviderImpl.Toks) ? "·\tlexing"
                    : (item === ProviderImpl.Ast) ? "·\tparsing (AST)"
                        : (item === ProviderImpl.Est) ? "·\texpansion (EST)"
                            : "No inspector currently selected. Pick one:"),
            false, item)
        ret.iconPath = new vsc.ThemeIcon(implIcons.get(item)!)
        ret.command = treeView.cmdOnClick(ret)
        return ret
    }
    getParentItem(_: ProviderImpl): ProviderImpl | undefined {
        return undefined
    }
    async getSubItems(_: TreeMulti, item?: ProviderImpl): Promise<ProviderImpl[]> {
        return item ? []
            : [ProviderImpl.notZeroForJSBugginess, ProviderImpl.Pkgs, ProviderImpl.Toks, ProviderImpl.Ast, ProviderImpl.Est]
    }
    onClick(treeView: TreeMulti, item: ProviderImpl): void {
        if ((item > ProviderImpl.None) && (item < ProviderImpl.notZeroForJSBugginess))
            treeView.provider = item
    }
}


export class TreeMulti extends tree.Tree<any> {
    private providers: Provider[]
    private currentProvider: ProviderImpl = ProviderImpl.None

    constructor(ctx: vsc.ExtensionContext) {
        super(ctx, "multi", tree.RefreshKind.OnDocEvents, tree.RefreshKind.OnFsEvents)
        this.providers = [
            new EmptyProvider(),
            new tree_pkgs.Provider(),
            new tree_toks.Provider(),
            new tree_ast.Provider(),
            new tree_est.Provider(),
        ]
    }

    public get provider(): Provider {
        return this.providers[this.currentProvider]
    }
    set provider(value: ProviderImpl) {
        this.currentProvider = value
        this.refresh(tree.RefreshKind.Other)
    }

    override refresh(kind: tree.RefreshKind, evt?: any): void {
        if (kind !== tree.RefreshKind.Other)
            switch (true) {
                case ([ProviderImpl.None].includes(this.currentProvider)):
                    return
                case ([ProviderImpl.Ast, ProviderImpl.Toks].includes(this.currentProvider)) && (kind !== tree.RefreshKind.OnDocEvents):
                    return
                case ([ProviderImpl.Pkgs].includes(this.currentProvider) && (kind !== tree.RefreshKind.OnFsEvents)):
                    return
            }
        super.refresh(kind, evt)
    }

    cmdOnClick(it: tree.Item<any>): vsc.Command {
        return { command: this.cmdName, arguments: [it], title: "Open" }
    }

    override getTreeItem(item: any): vsc.TreeItem | Thenable<vsc.TreeItem> {
        return this.provider.getItem(this, item)
    }
    override async getChildren(item?: any): Promise<any[]> {
        return this.provider.getSubItems(this, item)
    }
    override getParent?(item: any): vsc.ProviderResult<any> {
        return this.provider.getParentItem(item)
    }
    override onItemClick(it: tree.Item<any>): void {
        if (it.data)
            this.provider.onClick(this, it.data)
    }

}
