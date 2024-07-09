import * as vsc from 'vscode'

export class TreeItem<T> extends vsc.TreeItem {
    data: T

    constructor(label: string, collapsible: boolean, data: T) {
        super(label, (collapsible ? vsc.TreeItemCollapsibleState.Collapsed : vsc.TreeItemCollapsibleState.None))
        this.data = data
    }
}

export abstract class Tree<T> implements vsc.TreeDataProvider<T> {
    eventEmitter: vsc.EventEmitter<undefined> = new vsc.EventEmitter<undefined>()
    onDidChangeTreeData: vsc.Event<undefined> = this.eventEmitter.event

    abstract getTreeItem(element: T): vsc.TreeItem | Thenable<vsc.TreeItem>;
    abstract getChildren(element?: T | undefined): vsc.ProviderResult<T[]>;
    abstract getParent?(element: T): vsc.ProviderResult<T>;
    resolveTreeItem?(item: vsc.TreeItem, _element: T, _cancel: vsc.CancellationToken): vsc.ProviderResult<vsc.TreeItem> {
        return item
    }

    refresh() {
        this.eventEmitter.fire(undefined)
    }
}
