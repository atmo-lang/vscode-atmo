import * as vsc from 'vscode'

import * as lsp from './lsp'
import * as tree from './tree'
import * as tree_ast from './tree_ast'
import * as tree_toks from './tree_toks'


let treeMulti: TreeMulti


export function init(ctx: vsc.ExtensionContext): { dispose(): any }[] {
    return [
        vsc.window.registerTreeDataProvider('atmoViewInspectors', treeMulti = new TreeMulti(ctx)),
    ]
}


export interface Provider {
    getItem(treeView: TreeMulti, item: any): vsc.TreeItem
    getParentItem(item: any): any
    getSubItems(treeView: TreeMulti, item?: any): Promise<any[]>
    onClick(item: any): void
}


export class TreeMulti extends tree.Tree<any> {
    private providers: Provider[]
    currentProviderIdx: number = 0

    constructor(ctx: vsc.ExtensionContext) {
        super(ctx, "multi", tree.RefreshKind.OnDocEvents, tree.RefreshKind.OnFsEvents)
        this.providers = [
            new tree_toks.Provider(),
        ]
    }

    public get provider(): Provider {
        return this.providers[this.currentProviderIdx];
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
            this.provider.onClick(it.data)
    }

}
