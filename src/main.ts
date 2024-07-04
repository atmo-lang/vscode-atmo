import * as vsc from 'vscode'
import * as lsp from './lsp'
import * as repl from './repl'
import * as node_path from 'node:path'
import * as node_fs from 'node:fs'
import * as node_exec from 'child_process'


let lspClient: lsp.Client | null = null
let statusBarItemBuildOnSave: vsc.StatusBarItem
let regDisp: (...items: { dispose(): any }[]) => number
let lastEvalExpr: string = ""

export function activate(ctx: vsc.ExtensionContext) {
	regDisp = ctx.subscriptions.push.bind(ctx.subscriptions)

	// bring up LSP client unless disabled in user config
	lspClient = lsp.init(ctx)
	if (lspClient)
		regDisp(lspClient)

	// register "repl", aka vscode custom notebook type
	regDisp(new repl.Kernel())
	regDisp(vsc.workspace.registerNotebookSerializer('atmo-repl', new repl.NotebookSerializer()))

	// set up build-on-save
	regDisp(statusBarItemBuildOnSave =
		vsc.window.createStatusBarItem('atmo-build-on-save', vsc.StatusBarAlignment.Left))
	statusBarItemBuildOnSave.text = "$(coffee)"
	statusBarItemBuildOnSave.tooltip = "Atmo build-on-save running..."
	regDisp(vsc.workspace.onDidSaveTextDocument(tryBuildOnSave))

	// set up Eval code actions
	if (lspClient) {
		regDisp(vsc.commands.registerCommand('atmo.cmd.eval.quick', cmdEvalQuick))
		regDisp(vsc.commands.registerCommand('atmo.cmd.eval.repl', cmdReplFromExpr))
		vsc.languages.registerCodeActionsProvider({ scheme: 'file', language: 'atmo' }, {
			provideCodeActions: codeActions,
		})
	}
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
			{ command: 'eval-in-file', arguments: args } as lsp.ExecuteCommandParams
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


async function tryBuildOnSave(justSaved: vsc.TextDocument) {
	const cfg = vsc.workspace.getConfiguration()
	const build_on_save = cfg.get<boolean>('atmo.buildOnSave', false)
	if (!build_on_save)
		return

	let dir_path = node_path.dirname(justSaved.fileName)
	let pkg_file_path = node_path.join(dir_path, 'atmo.pkg')
	while ((dir_path !== '/') && !node_fs.existsSync(pkg_file_path)) {
		dir_path = node_path.dirname(dir_path)
		pkg_file_path = node_path.join(dir_path, 'atmo.pkg')
	}
	if (!node_fs.existsSync(pkg_file_path))
		return

	console.log(new Date() + "\tbuild-on-save...")
	statusBarItemBuildOnSave.show()
	setTimeout(() => { // needed for the status-item to actually show, annoyingly
		try {
			node_exec.execFileSync('atmo', ['build'], { cwd: dir_path, })
		} catch (err) {
			const term = vsc.window.createTerminal({ cwd: dir_path, name: 'atmo build' })
			regDisp(term)
			term.show(true)
			term.sendText('atmo build', true)
		} finally {
			statusBarItemBuildOnSave.hide()
		}
	}, 321) // timeout of well over 100ms needed, or all this would delay (by the whole build duration!) LSP didChangeWatchedFiles notification. but with proper timeout, the latter "gets through in time". nodeJS event-loop subtleties...
}
