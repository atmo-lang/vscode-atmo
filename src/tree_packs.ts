import * as vsc from 'vscode'
import * as node_path from 'path'

import * as main from './main'
import * as lsp from './lsp'
import * as tree from './tree'
import * as tree_multi from './tree_multi'


export type SrcPacks = SrcPack[]
export type SrcPack = {
    DirPath: string
    Files: SrcFiles
}

export type SrcFiles = SrcFile[]
export type SrcFile = {
    parent: SrcPack
    FilePath: string
}


export class Provider implements tree_multi.Provider {
    getItem(treeView: tree_multi.TreeMulti, item: SrcPack | SrcFile): vsc.TreeItem {
        const src_pack = item as SrcPack, src_file = item as SrcFile
        const full_path = (src_pack.DirPath ?? src_file.FilePath)
        const label = src_file.FilePath ? node_path.basename(full_path)
            : (!full_path.startsWith(main.atmoPath) ? full_path : full_path.substring(main.atmoPath.length))
        const ret = new tree.Item(label, (src_pack.DirPath ? true : false), item)
        ret.description = full_path
        ret.tooltip = full_path
        ret.iconPath = new vsc.ThemeIcon(src_pack.DirPath ? 'package' : 'file')
        ret.command = treeView.cmdOnClick(ret)
        return ret
    }

    getParentItem(item: SrcPack | SrcFile): SrcPack | undefined {
        const src_file = item as SrcFile
        return src_file?.parent
    }

    async getSubItems(treeView: tree_multi.TreeMulti, item?: SrcPack | SrcFile): Promise<SrcPacks | SrcFiles> {
        const src_pack = item as SrcPack, src_file = item as SrcFile

        if (src_file && src_file.FilePath)
            return []

        if (src_pack && src_pack.Files)
            return src_pack.Files ?? []

        const ret: SrcPacks | undefined = await lsp.executeCommand('getSrcPacks')
        if (ret && Array.isArray(ret) && ret.length) {
            for (const src_pack of ret)
                for (const src_file of src_pack.Files)
                    src_file.parent = src_pack
            return ret
        }
        return []
    }

    onClick(treeView: tree_multi.TreeMulti, item: SrcPack | SrcFile): void {
        const src_pack = item as SrcPack, src_file = item as SrcFile

        if (src_file && src_file.FilePath)
            vsc.workspace.openTextDocument(src_file.FilePath).then(
                (it) => { vsc.window.showTextDocument(it, {}) },
                vsc.window.showWarningMessage,
            )
        else if (src_pack && src_pack.DirPath) {
            let uri = vsc.Uri.file(src_pack.DirPath)
            const root_folder = vsc.workspace.getWorkspaceFolder(uri)
            if (!root_folder)
                vsc.window.showOpenDialog({
                    canSelectFiles: true, canSelectMany: true, defaultUri: uri,
                    filters: { 'Atmo': ['at'], 'Any': ['*'] },
                })
            else {
                const root_path = root_folder.uri.fsPath
                const rel_path = src_pack.DirPath.substring(root_path.length + (root_path.endsWith(node_path.sep) ? 0 : 1))
                vsc.commands.executeCommand('workbench.action.quickOpen', rel_path + node_path.sep + '*.at ')
            }
        }
    }
}
