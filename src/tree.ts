import * as vsc from 'vscode'


export class Item<T> extends vsc.TreeItem {
    data: T

    constructor(label: string, collapsible: boolean, data: T) {
        super(label, (collapsible ? vsc.TreeItemCollapsibleState.Collapsed : vsc.TreeItemCollapsibleState.None))
        this.data = data
    }
}


export enum RefreshKind {
    Other,
    OnDocEvents,
    OnFsEvents,
}


export abstract class Tree<T> implements vsc.TreeDataProvider<T> {
    eventEmitter: vsc.EventEmitter<undefined> = new vsc.EventEmitter<undefined>()
    onDidChangeTreeData: vsc.Event<undefined> = this.eventEmitter.event
    cmdName: string
    doc: vsc.TextDocument | undefined

    constructor(ctx: vsc.ExtensionContext, moniker: string, ...refreshKinds: RefreshKind[]) {
        this.cmdName = "atmo.tree.onClick_" + moniker
        ctx.subscriptions.push(vsc.commands.registerCommand(this.cmdName, this.onItemClick.bind(this)))

        if (refreshKinds.includes(RefreshKind.OnDocEvents))
            ctx.subscriptions.push(
                vsc.window.onDidChangeActiveTextEditor((evt) => {
                    this.doc = undefined
                    if (evt && (evt.document.languageId == "atmo"))
                        this.doc = evt.document
                    this.refresh(RefreshKind.OnDocEvents, evt)
                }),

                vsc.workspace.onDidCloseTextDocument((it) => {
                    if (this.doc && it && this.doc.fileName === it.fileName) {
                        this.doc = undefined
                        this.refresh(RefreshKind.OnDocEvents, it)
                    }
                }),

                vsc.workspace.onDidChangeTextDocument((evt) => {
                    const ed = vsc.window.activeTextEditor
                    if ((evt.document.languageId == "atmo") && evt.contentChanges && evt.contentChanges.length &&
                        (this.doc ? (this.doc.fileName === evt.document.fileName) : (ed && (evt.document.fileName === ed.document.fileName)))) {
                        this.doc = evt.document
                        this.refresh(RefreshKind.OnDocEvents, evt)
                    }
                }),
            )

        if (refreshKinds.includes(RefreshKind.OnFsEvents))
            ctx.subscriptions.push(
                vsc.workspace.onDidChangeWorkspaceFolders((evt) => {
                    this.refresh(RefreshKind.OnFsEvents, evt)
                }),
                vsc.workspace.onDidDeleteFiles((evt) => {
                    if (evt.files.some(_ => _.fsPath.endsWith('.at')))
                        this.refresh(RefreshKind.OnFsEvents, evt)
                }),
                vsc.workspace.onDidRenameFiles((evt) => {
                    if (evt.files.some(_ => (_.oldUri.fsPath.endsWith('.at') || _.newUri.fsPath.endsWith('.at'))))
                        this.refresh(RefreshKind.OnFsEvents, evt)
                }),
                vsc.workspace.onDidCreateFiles((evt) => {
                    if (evt.files.some(_ => _.fsPath.endsWith('.at')))
                        this.refresh(RefreshKind.OnFsEvents, evt)
                }),
            )

        setTimeout(() => {
            const ed = vsc.window.activeTextEditor
            if (!refreshKinds.includes(RefreshKind.OnDocEvents))
                this.refresh(RefreshKind.Other)
            else if (ed && (ed.document.languageId == "atmo")) {
                this.doc = ed.document
                this.refresh(RefreshKind.Other)
            }
        }, 1234)
    }

    abstract getTreeItem(element: T): vsc.TreeItem | Thenable<vsc.TreeItem>;
    abstract getChildren(element?: T | undefined): vsc.ProviderResult<T[]>;
    abstract getParent?(element: T): vsc.ProviderResult<T>;
    resolveTreeItem?(item: vsc.TreeItem, _element: T, _cancel: vsc.CancellationToken): vsc.ProviderResult<vsc.TreeItem> {
        return item
    }

    abstract onItemClick(_: Item<T>): void;
    refresh(kind: RefreshKind, evt?: any) {
        if (evt && false)
            console.log(evt)
        this.eventEmitter.fire(undefined)
    }
}
