import * as vscode from 'vscode';
import * as path from 'path';
import { LibCategory, LIB_GROUPS, LIB_CATEGORIES } from './libGroups';
import { MAX_SELECTED_CODE_CHARS, MAX_IMPORTS, MAX_ADDITIONAL_FILE_CHARS, MAX_ADDITIONAL_FILES } from './constants';

export { LIB_CATEGORIES };

export interface ProjectContext extends Record<LibCategory, string | null> {
	isReactFile: boolean;
	activeFileName: string | null;
	react: string | null;
	next: string | null;
	// For Next projects: which router the app uses — App Router and Pages Router
	// have very different idioms, so the AI needs to know which.
	nextRouter: 'app' | 'pages' | null;
	selectedCode: string | null;
	// Import lines from the active file — what's actually in scope, not just installed.
	imports: string[];
	// Extra files the developer explicitly picked (e.g. for a multi-file refactor).
	additionalFiles?: { name: string; content: string }[];
}

// Regex over `import ... from '...'` — enough to know what's in scope without an
// AST parser. Captures the import clause (named/default/namespace) + the module.
// ponytail: misses `require()` and dynamic import(); add if a real project needs it.
function extractImports(source: string): string[] {
	const re = /import\s+(?:type\s+)?([\w*\s{},]+?)\s+from\s+['"]([^'"]+)['"]/g;
	const imports: string[] = [];
	let match = re.exec(source);
	while (match !== null && imports.length < MAX_IMPORTS) {
		const clause = match[1].replace(/\s+/g, ' ').trim();
		imports.push(`${clause} from ${match[2]}`);
		match = re.exec(source);
	}
	return imports;
}

// Reads user-picked files for cross-file context. Skips any that failed to
// read (deleted/moved since picked) rather than failing the whole request.
async function readAdditionalFiles(paths: string[]): Promise<{ name: string; content: string }[]> {
	const results: { name: string; content: string }[] = [];
	for (const filePath of paths.slice(0, MAX_ADDITIONAL_FILES)) {
		try {
			const raw = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
			const text = Buffer.from(raw).toString('utf8');
			const content = text.length > MAX_ADDITIONAL_FILE_CHARS ? text.slice(0, MAX_ADDITIONAL_FILE_CHARS) + '\n… (truncated)' : text;
			results.push({ name: filePath.split('/').pop() ?? filePath, content });
		} catch {
			// skip unreadable file
		}
	}
	return results;
}

function cleanVersion(v: string): string {
	return v.replace(/^[\^~]/, '');
}

function pickLib(deps: Record<string, string>, names: string[]): string | null {
	for (const name of names) {
		if (deps[name]) {
			return `${name}@${cleanVersion(deps[name])}`;
		}
	}
	return null;
}

// Radix ships one package per primitive (@radix-ui/react-dialog, etc.), so an
// exact-name lookup like pickLib misses it — match on the scope instead.
function pickByPrefix(deps: Record<string, string>, prefix: string): string | null {
	const key = Object.keys(deps).find((k) => k.startsWith(prefix));
	return key ? `${key}@${cleanVersion(deps[key])}` : null;
}

function hasReact(pkg: Record<string, unknown>): boolean {
	const deps = pkg as { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; peerDependencies?: Record<string, string> };
	return Boolean(deps.dependencies?.react || deps.devDependencies?.react || deps.peerDependencies?.react);
}

function closestTo(activeFilePath: string, files: vscode.Uri[]): vscode.Uri {
	const byDepth = [...files].sort((a, b) => b.fsPath.length - a.fsPath.length);
	return byDepth.find((f) => activeFilePath.startsWith(path.dirname(f.fsPath) + path.sep)) ?? files[0];
}

async function pickPackageJson(activeFilePath: string | null): Promise<vscode.Uri | null> {
	const files = await vscode.workspace.findFiles('**/package.json', '**/node_modules/**', 200);
	if (files.length === 0) {
		return null;
	}
	if (files.length === 1) {
		return files[0];
	}

	// Monorepo/fullstack case: search every package.json for one that actually
	// declares react. Break ties by picking whichever is closest to the file
	// the user has open.
	const reactCandidates: vscode.Uri[] = [];
	for (const file of files) {
		const raw = await vscode.workspace.fs.readFile(file);
		const pkg = JSON.parse(Buffer.from(raw).toString('utf8'));
		if (hasReact(pkg)) {
			reactCandidates.push(file);
		}
	}

	if (reactCandidates.length > 0) {
		return activeFilePath ? closestTo(activeFilePath, reactCandidates) : reactCandidates[0];
	}

	return activeFilePath ? closestTo(activeFilePath, files) : files[0];
}

type DetectedLibs = Omit<ProjectContext, 'isReactFile' | 'activeFileName' | 'selectedCode' | 'imports'>;

// ponytail: cached until a package.json changes anywhere in the workspace (see
// registerContextInvalidation). Re-picking the closest package.json per active
// file is skipped after the first computation — fine for the common case,
// revisit if monorepo users complain the wrong sub-project stays "sticky".
let cachedLibs: DetectedLibs | undefined;

function detectLibs(deps: Record<string, string>): Record<LibCategory, string | null> {
	const result = {} as Record<LibCategory, string | null>;
	for (const category of Object.keys(LIB_GROUPS) as LibCategory[]) {
		result[category] = pickLib(deps, LIB_GROUPS[category]);
	}
	// Radix ships one package per primitive — no single name to put in LIB_GROUPS.
	result.uiKit = result.uiKit ?? pickByPrefix(deps, '@radix-ui/');
	return result;
}

// App Router lives under app/ with page/layout files; Pages Router under pages/.
// Check for the marker files rather than the bare directory (findFiles matches files).
async function detectNextRouter(): Promise<'app' | 'pages' | null> {
	const app = await vscode.workspace.findFiles('**/app/{page,layout}.{tsx,ts,jsx,js}', '**/node_modules/**', 1);
	if (app.length > 0) {
		return 'app';
	}
	const pages = await vscode.workspace.findFiles('**/pages/{_app,index}.{tsx,ts,jsx,js}', '**/node_modules/**', 1);
	return pages.length > 0 ? 'pages' : null;
}

async function computeLibs(activeFilePath: string | null): Promise<DetectedLibs> {
	const file = await pickPackageJson(activeFilePath);
	if (!file) {
		return { react: null, next: null, nextRouter: null, ...detectLibs({}) };
	}

	const raw = await vscode.workspace.fs.readFile(file);
	const pkg = JSON.parse(Buffer.from(raw).toString('utf8'));
	const deps: Record<string, string> = { ...pkg.peerDependencies, ...pkg.devDependencies, ...pkg.dependencies };
	const next = deps.next ? cleanVersion(deps.next) : null;

	return {
		react: deps.react ? cleanVersion(deps.react) : null,
		next,
		nextRouter: next ? await detectNextRouter() : null,
		...detectLibs(deps),
	};
}

export function invalidateContextCache(): void {
	cachedLibs = undefined;
}

export function registerContextInvalidation(context: vscode.ExtensionContext): void {
	const watcher = vscode.workspace.createFileSystemWatcher('**/package.json');
	watcher.onDidChange(invalidateContextCache);
	watcher.onDidCreate(invalidateContextCache);
	watcher.onDidDelete(invalidateContextCache);
	context.subscriptions.push(watcher);
}

export async function detectContext(additionalFilePaths: string[] = []): Promise<ProjectContext | null> {
	const editor = vscode.window.activeTextEditor;
	const activeFilePath = editor?.document.fileName ?? null;
	const activeFileName = activeFilePath ? activeFilePath.split('/').pop() ?? null : null;
	const isReactFile = editor?.document.languageId === 'javascriptreact'
		|| editor?.document.languageId === 'typescriptreact';

	let selectedCode: string | null = null;
	if (editor && !editor.selection.isEmpty) {
		const text = editor.document.getText(editor.selection);
		selectedCode = text.length > MAX_SELECTED_CODE_CHARS ? text.slice(0, MAX_SELECTED_CODE_CHARS) + '\n… (truncated)' : text;
	}

	const imports = editor && isReactFile ? extractImports(editor.document.getText()) : [];
	const additionalFiles = await readAdditionalFiles(additionalFilePaths);

	if (cachedLibs === undefined) {
		cachedLibs = await computeLibs(activeFilePath);
	}

	return { isReactFile, activeFileName, selectedCode, imports, additionalFiles, ...cachedLibs };
}
