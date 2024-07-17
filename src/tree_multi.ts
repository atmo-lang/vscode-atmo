import * as vsc from 'vscode'

import * as lsp from './lsp'
import * as tree from './tree'
import * as tree_ast from './tree_ast'
import * as tree_toks from './tree_toks'


let treeMulti: TreeMulti


export function init(ctx: vsc.ExtensionContext): { dispose(): any }[] {
    return [
        vsc.window.registerTreeDataProvider('atmoViewInspectors', treeMulti = new TreeMulti(ctx)),
        vsc.commands.registerCommand('atmo.inspector.none', () => { treeMulti.provider = 0 }),
        vsc.commands.registerCommand('atmo.inspector.pkgs', () => { treeMulti.provider = 0 }),
        vsc.commands.registerCommand('atmo.inspector.toks', () => { treeMulti.provider = 1 }),
        vsc.commands.registerCommand('atmo.inspector.ast', () => { treeMulti.provider = 0 }),
        vsc.commands.registerCommand('atmo.inspector.est', () => { treeMulti.provider = 0 }),
    ]
}


export interface Provider {
    getItem(treeView: TreeMulti, item: any): vsc.TreeItem
    getParentItem(item: any): any
    getSubItems(treeView: TreeMulti, item?: any): Promise<any[]>
    onClick(item: any): void
}


class EmptyProvider implements Provider {
    getItem(treeView: TreeMulti, item: any): vsc.TreeItem {
        return new vsc.TreeItem("never")
    }
    getParentItem(item: any) {
        return undefined
    }
    getSubItems(treeView: TreeMulti, item?: any): Promise<any[]> {
        return Promise.resolve([])
    }
    onClick(item: any): void {
    }
}


export class TreeMulti extends tree.Tree<any> {
    private providers: Provider[]
    currentProviderIdx: number = 0

    constructor(ctx: vsc.ExtensionContext) {
        super(ctx, "multi", tree.RefreshKind.OnDocEvents, tree.RefreshKind.OnFsEvents)
        this.providers = [
            new EmptyProvider(),
            new tree_toks.Provider(),
        ]
    }

    public get provider(): Provider {
        return this.providers[this.currentProviderIdx]
    }
    set provider(value: number) {
        this.currentProviderIdx = value
        this.refresh(tree.RefreshKind.Other)
    }

    override refresh(kind: tree.RefreshKind, evt?: any): void {
        // if (kind !== tree.RefreshKind.Other)
        //     switch (true) {
        //         case (this.currentProviderIdx == 0) && (kind !== tree.RefreshKind.OnDocEvents):
        //             return
        //     }
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
            this.provider.onClick(it.data)
    }

}
