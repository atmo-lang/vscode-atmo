import * as vsc from 'vscode'
import * as vsc_lsp from 'vscode-languageclient/node'

import * as main from './main'
import * as lsp from './lsp'
import * as tree from './tree'


let treePkgs: TreePkgs


export function init(ctx: vsc.ExtensionContext): { dispose(): any }[] {
    return [
        vsc.window.registerTreeDataProvider('atmoVcPkgs', treePkgs = new TreePkgs(ctx, "pkgs", false, true)),
    ]
}


type SrcPkgs = SrcPkg[]
type SrcPkg = {
    DirPath: string
    Files: SrcFiles
}

type SrcFiles = SrcFile[]
type SrcFile = {
    parent: SrcPkg
    FilePath: string
}


class TreePkgs extends tree.Tree<SrcPkg | SrcFile> {
    cmdOnClick(it: tree.Item<SrcPkg | SrcFile>): vsc.Command {
        return { command: this.cmdName, arguments: [it], title: "Reveal in text editor" }
    }

    override getTreeItem(item: SrcPkg | SrcFile): vsc.TreeItem | Thenable<vsc.TreeItem> {
        const src_pkg = item as SrcPkg, src_file = item as SrcFile
        const full_path = (src_pkg.DirPath ?? src_file.FilePath)
        const label = (!full_path.startsWith(main.atmoPath) ? full_path : full_path.substring(main.atmoPath.length))
        const ret = new tree.Item(label, (src_pkg.DirPath ? true : false), item)
        ret.description = full_path
        ret.tooltip = full_path
        ret.iconPath = new vsc.ThemeIcon(src_pkg.DirPath ? 'package' : 'file')
        ret.command = this.cmdOnClick(ret)
        return ret
    }

    override async getChildren(item?: SrcPkg | SrcFile | undefined): Promise<SrcPkgs | SrcFiles> {
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

    override getParent?(item: SrcPkg | SrcFile): vsc.ProviderResult<SrcPkg | undefined> {
        const src_file = item as SrcFile
        return src_file?.parent
    }

    override onItemClick(it: tree.Item<SrcPkg | SrcFile>): void {
    }

}
