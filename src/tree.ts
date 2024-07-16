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

    constructor(ctx: vsc.ExtensionContext, moniker: string, refreshOnDocEvents: boolean, refreshOnFsEvents: boolean) {
        this.cmdName = "atmo.tree.onClick_" + moniker
        ctx.subscriptions.push(vsc.commands.registerCommand(this.cmdName, this.onItemClick.bind(this)))

        if (refreshOnDocEvents)
            ctx.subscriptions.push(
                vsc.window.onDidChangeActiveTextEditor((evt) => {
                    this.doc = undefined
                    if (evt && (evt.document.languageId == "atmo"))
                        this.doc = evt.document
                    this.refresh()
                }),

                vsc.workspace.onDidCloseTextDocument((it) => {
                    if (this.doc && it && this.doc.fileName === it.fileName) {
                        this.doc = undefined
                        this.refresh()
                    }
                }),

                vsc.workspace.onDidChangeTextDocument((evt) => {
                    const ed = vsc.window.activeTextEditor
                    if ((evt.document.languageId == "atmo") && evt.contentChanges && evt.contentChanges.length &&
                        (this.doc ? (this.doc.fileName === evt.document.fileName) : (ed && (evt.document.fileName === ed.document.fileName)))) {
                        this.doc = evt.document
                        this.refresh()
                    }
                }),
            )

        if (refreshOnFsEvents)
            ctx.subscriptions.push(
                vsc.workspace.onDidChangeWorkspaceFolders((evt) => { this.refresh(evt) }),
                vsc.workspace.onDidDeleteFiles((evt) => { this.refresh(evt) }),
                vsc.workspace.onDidRenameFiles((evt) => { this.refresh(evt) }),
                vsc.workspace.onDidCreateFiles((evt) => { this.refresh(evt) }),
            )

        setTimeout(() => {
            const ed = vsc.window.activeTextEditor
            if (!refreshOnDocEvents)
                this.refresh()
            else if (ed && (ed.document.languageId == "atmo")) {
                this.doc = ed.document
                this.refresh()
            }
        }, 321)
    }

    abstract getTreeItem(element: T): vsc.TreeItem | Thenable<vsc.TreeItem>;
    abstract getChildren(element?: T | undefined): vsc.ProviderResult<T[]>;
    abstract getParent?(element: T): vsc.ProviderResult<T>;
    resolveTreeItem?(item: vsc.TreeItem, _element: T, _cancel: vsc.CancellationToken): vsc.ProviderResult<vsc.TreeItem> {
        return item
    }

    abstract onItemClick(_: Item<T>): void;
    refresh(evt?: any) {
        // if (!this.doc)
        //     vsc.window.showInformationMessage(this.cmdName)
        if (evt && false)
            console.log(evt)
        setTimeout(() => { this.eventEmitter.fire(undefined) }, 321)
    }
}
