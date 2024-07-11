import * as vsc from 'vscode'

export class Item<T> extends vsc.TreeItem {
    data: T

    constructor(label: string, collapsible: boolean, data: T) {
        super(label, (collapsible ? vsc.TreeItemCollapsibleState.Collapsed : vsc.TreeItemCollapsibleState.None))
        this.data = data
    }
}

export abstract class Tree<T> implements vsc.TreeDataProvider<T> {
    eventEmitter: vsc.EventEmitter<undefined> = new vsc.EventEmitter<undefined>()
    onDidChangeTreeData: vsc.Event<undefined> = this.eventEmitter.event
    cmdName: string
    doc: vsc.TextDocument | undefined

    constructor(ctx: vsc.ExtensionContext, moniker: string) {
        this.cmdName = "atmo.tree.onClick_" + moniker
        ctx.subscriptions.push(vsc.commands.registerCommand(this.cmdName, this.onItemClick.bind(this)))

        vsc.window.onDidChangeActiveTextEditor((evt) => {
            this.doc = undefined
            if (evt && (evt.document.languageId == "atmo"))
                this.doc = evt.document
            this.refresh()
        })

        vsc.workspace.onDidCloseTextDocument((it) => {
            if (this.doc && it && this.doc.fileName === it.fileName) {
                this.doc = undefined
                this.refresh()
            }
        })

        vsc.workspace.onDidChangeTextDocument((evt) => {
            if ((evt.document.languageId == "atmo") && evt.contentChanges && evt.contentChanges.length &&
                ((!this.doc) || (evt.document.fileName === this.doc.fileName))) {
                this.doc = evt.document
                this.refresh()
            }
        })

    }

    abstract getTreeItem(element: T): vsc.TreeItem | Thenable<vsc.TreeItem>;
    abstract getChildren(element?: T | undefined): vsc.ProviderResult<T[]>;
    abstract getParent?(element: T): vsc.ProviderResult<T>;
    resolveTreeItem?(item: vsc.TreeItem, _element: T, _cancel: vsc.CancellationToken): vsc.ProviderResult<vsc.TreeItem> {
        return item
    }

    abstract onItemClick(_: Item<T>): void;
    refresh(evt?: any) {
        if (evt)
            console.log(evt)
        this.eventEmitter.fire(undefined)
    }
}
