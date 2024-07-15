import * as vsc from 'vscode'
import * as vsc_lsp from 'vscode-languageclient/node'
import * as node_path from 'path'

import * as lsp from './lsp'
import * as repl from './repl'
import * as tree_pkgs from './tree_pkgs'
import * as tree_toks from './tree_toks'
import * as tree_ast from './tree_ast'


export let atmoPath = process.env["ATMO_PATH"] ?? "/home/_/c/at"
export let lspClient: vsc_lsp.LanguageClient | null = null
let regDisp: (...items: { dispose(): any }[]) => number
let lastEvalExpr: string = ""

export function activate(ctx: vsc.ExtensionContext) {
	if (!atmoPath.endsWith("/"))
		atmoPath += "/"

	regDisp = ctx.subscriptions.push.bind(ctx.subscriptions)

	// bring up LSP client unless disabled in user config
	lspClient = lsp.init(ctx)
	if (lspClient)
		regDisp(lspClient)

	// register "repl", aka vscode custom notebook type
	regDisp(new repl.Kernel())
	regDisp(vsc.workspace.registerNotebookSerializer('atmo-repl', new repl.NotebookSerializer()))

	// set up Eval code actions
	if (lspClient)
		regDisp(
			vsc.commands.registerCommand('atmo.cmd.eval.quick', cmdEvalQuick),
			vsc.commands.registerCommand('atmo.cmd.eval.repl', cmdReplFromExpr),
			vsc.languages.registerCodeActionsProvider({ scheme: 'file', language: 'atmo' }, {
				provideCodeActions: codeActions,
			}),

			// with vsc's language-client lib, folder renames and deletes dont  trigger
			// LSP workspace / didChangeWatchedFiles notifications, so do it manually......
			vsc.workspace.onDidRenameFiles((evt) => {
				const changes: vsc_lsp.FileEvent[] = []
				for (const it of evt.files)
					if (!node_path.extname(it.oldUri.fsPath)) // is dir
						changes.push({ uri: it.oldUri.toString(), type: vsc_lsp.FileChangeType.Deleted },
							{ uri: it.newUri.toString(), type: vsc_lsp.FileChangeType.Created })
				if (changes.length)
					lspClient?.sendNotification('workspace/didChangeWatchedFiles', {
						changes: changes,
					} as vsc_lsp.DidChangeWatchedFilesParams)
			}),
			vsc.workspace.onDidDeleteFiles((evt) => {
				const changes: vsc_lsp.FileEvent[] = []
				for (const it of evt.files)
					if (!node_path.extname(it.fsPath)) // is dir
						changes.push({ uri: it.toString(), type: vsc_lsp.FileChangeType.Deleted })
				if (changes.length)
					lspClient?.sendNotification('workspace/didChangeWatchedFiles', {
						changes: changes,
					} as vsc_lsp.DidChangeWatchedFilesParams)
			})
		)

	regDisp(...tree_pkgs.init(ctx))
	regDisp(...tree_toks.init(ctx))
	regDisp(...tree_ast.init(ctx))
}

export function deactivate() {
	if (lspClient)
		return lspClient.stop()

	return (void 0)
}


function codeActions(it: vsc.TextDocument, range: vsc.Range, _ctx: vsc.CodeActionContext, _: vsc.CancellationToken): vsc.Command[] {
	if (range.isEmpty)
		return []
	return [
		{ command: 'atmo.cmd.eval.quick', title: "Quick-Eval", arguments: [it, range] },
		{ command: 'atmo.cmd.eval.repl', title: "New REPL from expression...", arguments: [it, range] },
	]
}


function cmdEvalQuick(...args: any[]) {
	if (args && args.length) {
		args[0] = (args[0] as vsc.TextDocument).fileName
		lspClient!.sendRequest('workspace/executeCommand',
			{ command: 'eval-in-file', arguments: args } as vsc_lsp.ExecuteCommandParams
		).then(
			(result: any) =>
				vsc.window.showInformationMessage("" + result),
			vsc.window.showErrorMessage,
		).catch(
			vsc.window.showErrorMessage)

	} else {
		let expr_suggestion: string = lastEvalExpr
		if (vsc.window.activeTextEditor && vsc.window.activeTextEditor.document && vsc.window.activeTextEditor.selection && !vsc.window.activeTextEditor.selection.isEmpty)
			expr_suggestion = vsc.window.activeTextEditor.document.getText(vsc.window.activeTextEditor.selection)
		vsc.window.showInputBox({
			title: "Atmo Quick-Eval", value: expr_suggestion, placeHolder: "Enter an Atmo expression",
			prompt: ("Enter an Atmo expression to quick-eval" +
				((vsc.window.activeTextEditor && vsc.window.activeTextEditor.document && !vsc.window.activeTextEditor.document.isUntitled)
					? ` in the context of ${vsc.window.activeTextEditor!.document.fileName}`
					: "")),
		})
			.then(expr_to_eval => {
				if (expr_to_eval && expr_to_eval.length && (expr_to_eval = expr_to_eval.trim()).length)
					lspClient!.sendRequest('workspace/executeCommand', {
						command: 'eval-expr', arguments: [
							(vsc.window.activeTextEditor!.document.isUntitled ? '' : vsc.window.activeTextEditor!.document.fileName),
							lastEvalExpr = expr_to_eval,
						]
					}).then(
						(result: any) =>
							vsc.window.showInformationMessage("" + result),
						vsc.window.showErrorMessage,
					).catch(
						vsc.window.showErrorMessage)
			})
	}
}


async function cmdReplFromExpr(...args: any[]) {
	let src_file: vsc.TextDocument | null = null
	if (args && args.length)
		src_file = args[0] as vsc.TextDocument
	else if (vsc.window.activeTextEditor)
		src_file = vsc.window.activeTextEditor.document
	if (!src_file)
		return

	let range: vsc.Range | null = null
	if (args && args.length && (args.length > 1))
		range = args[1] as vsc.Range
	else if (vsc.window.activeTextEditor && vsc.window.activeTextEditor.selection && !vsc.window.activeTextEditor.selection.isEmpty)
		range = vsc.window.activeTextEditor.selection
	if (!range)
		return

	await vsc.window.showNotebookDocument(await vsc.workspace.openNotebookDocument('atmo-repl', {
		cells: [{
			languageId: 'atmo',
			kind: vsc.NotebookCellKind.Code,
			value: src_file.getText(range),
		}],
	}))
}
