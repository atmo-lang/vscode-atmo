import * as vsc from 'vscode'

export class TreeItem<T> extends vsc.TreeItem {
    data: T

    constructor(label: string, collapsible: boolean, data: T) {
        super(label, (collapsible ? vsc.TreeItemCollapsibleState.Expanded : vsc.TreeItemCollapsibleState.None))
        this.data = data
    }
}
