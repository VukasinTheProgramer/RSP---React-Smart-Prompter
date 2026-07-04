import * as vscode from 'vscode';
import * as path from 'path';

export interface ProjectContext {
	isReactFile: boolean;
	activeFileName: string | null;
	react: string | null;
	next: string | null;
	router: string | null;
	state: string | null;
	styling: string | null;
	dataFetching: string | null;
	forms: string | null;
}

const LIB_GROUPS: Record<'router' | 'state' | 'styling' | 'dataFetching' | 'forms', string[]> = {
	router: ['react-router-dom'],
	state: ['@reduxjs/toolkit', 'redux', 'zustand', 'jotai', 'recoil'],
	styling: ['tailwindcss', 'styled-components', '@emotion/react', 'sass'],
	dataFetching: ['@tanstack/react-query', 'swr', 'axios'],
	forms: ['react-hook-form', 'formik'],
};

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

export async function detectContext(): Promise<ProjectContext | null> {
	const editor = vscode.window.activeTextEditor;
	const activeFilePath = editor?.document.fileName ?? null;
	const activeFileName = activeFilePath ? activeFilePath.split('/').pop() ?? null : null;
	const isReactFile = editor?.document.languageId === 'javascriptreact'
		|| editor?.document.languageId === 'typescriptreact';

	const file = await pickPackageJson(activeFilePath);
	if (!file) {
		return { isReactFile, activeFileName, react: null, next: null, router: null, state: null, styling: null, dataFetching: null, forms: null };
	}

	const raw = await vscode.workspace.fs.readFile(file);
	const pkg = JSON.parse(Buffer.from(raw).toString('utf8'));
	const deps: Record<string, string> = { ...pkg.peerDependencies, ...pkg.devDependencies, ...pkg.dependencies };

	return {
		isReactFile,
		activeFileName,
		react: deps.react ? cleanVersion(deps.react) : null,
		next: deps.next ? cleanVersion(deps.next) : null,
		router: pickLib(deps, LIB_GROUPS.router),
		state: pickLib(deps, LIB_GROUPS.state),
		styling: pickLib(deps, LIB_GROUPS.styling),
		dataFetching: pickLib(deps, LIB_GROUPS.dataFetching),
		forms: pickLib(deps, LIB_GROUPS.forms),
	};
}
