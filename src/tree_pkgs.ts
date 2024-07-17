import * as vsc from 'vscode'
import * as node_path from 'path'

import * as main from './main'
import * as lsp from './lsp'
import * as tree from './tree'
import * as tree_multi from './tree_multi'


export type SrcPkgs = SrcPkg[]
export type SrcPkg = {
    DirPath: string
    Files: SrcFiles
}

export type SrcFiles = SrcFile[]
export type SrcFile = {
    parent: SrcPkg
    FilePath: string
}


export class Provider implements tree_multi.Provider {
    getItem(treeView: tree_multi.TreeMulti, item: SrcPkg | SrcFile): vsc.TreeItem {
        const src_pkg = item as SrcPkg, src_file = item as SrcFile
        const full_path = (src_pkg.DirPath ?? src_file.FilePath)
        const label = src_file.FilePath ? node_path.basename(full_path)
            : (!full_path.startsWith(main.atmoPath) ? full_path : full_path.substring(main.atmoPath.length))
        const ret = new tree.Item(label, (src_pkg.DirPath ? true : false), item)
        ret.description = full_path
        ret.tooltip = full_path
        ret.iconPath = new vsc.ThemeIcon(src_pkg.DirPath ? 'package' : 'file')
        ret.command = treeView.cmdOnClick(ret)
        return ret
    }

    getParentItem(item: SrcPkg | SrcFile): SrcPkg | undefined {
        const src_file = item as SrcFile
        return src_file?.parent
    }

    async getSubItems(treeView: tree_multi.TreeMulti, item?: SrcPkg | SrcFile): Promise<SrcPkgs | SrcFiles> {
        const src_pkg = item as SrcPkg, src_file = item as SrcFile

        if (src_file && src_file.FilePath)
            return []

        if (src_pkg && src_pkg.Files)
            return src_pkg.Files ?? []

        const ret: SrcPkgs | undefined = await lsp.executeCommand('getSrcPkgs')
        if (ret && Array.isArray(ret) && ret.length) {
            for (const src_pkg of ret)
                for (const src_file of src_pkg.Files)
                    src_file.parent = src_pkg
            return ret
        }
        return []
    }

    onClick(item: SrcPkg | SrcFile): void {
        const src_pkg = item as SrcPkg, src_file = item as SrcFile

        if (src_file && src_file.FilePath)
            vsc.workspace.openTextDocument(src_file.FilePath).then(
                (it) => { vsc.window.showTextDocument(it, {}) },
                vsc.window.showWarningMessage,
            )
        else if (src_pkg && src_pkg.DirPath) {
            let uri = vsc.Uri.file(src_pkg.DirPath)
            const root_folder = vsc.workspace.getWorkspaceFolder(uri)
            if (!root_folder)
                vsc.window.showOpenDialog({
                    canSelectFiles: true, canSelectMany: true, defaultUri: uri,
                    filters: { 'Atmo': ['at'], 'Any': ['*'] },
                })
            else {
                const root_path = root_folder.uri.fsPath
                const rel_path = src_pkg.DirPath.substring(root_path.length + (root_path.endsWith(node_path.sep) ? 0 : 1))
                vsc.commands.executeCommand('workbench.action.quickOpen', rel_path + node_path.sep + '*.at ')
            }
        }
    }
}
