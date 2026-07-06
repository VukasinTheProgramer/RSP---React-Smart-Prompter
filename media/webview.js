const vscode = acquireVsCodeApi();
vscode.postMessage({ type: 'ready' });

const suggestBtn = document.getElementById('suggest');
const addFilesBtn = document.getElementById('addFiles');
const enhanceBtn = document.getElementById('enhance');
const expandDirectBtn = document.getElementById('expandDirect');
const startOverBtn = document.getElementById('startOver');
const promptEl = document.getElementById('prompt');
const suggestionsEl = document.getElementById('suggestions');
const chosenEl = document.getElementById('chosen');
const pickedFilesEl = document.getElementById('pickedFiles');
const questionsEl = document.getElementById('questions');
const errorEl = document.getElementById('error');
const outputEl = document.getElementById('output');
const historyEl = document.getElementById('history');

let chosenLibraries = [];
let pickedFiles = [];

suggestBtn.addEventListener('click', () => {
	errorEl.textContent = '';
	vscode.postMessage({ type: 'suggest' });
});

addFilesBtn.addEventListener('click', () => {
	errorEl.textContent = '';
	vscode.postMessage({ type: 'pickFiles' });
});

function renderPickedFiles() {
	pickedFilesEl.innerHTML = '';
	pickedFiles.forEach((name, i) => {
		const chip = document.createElement('span');
		chip.className = 'file-chip';
		chip.textContent = name;
		const x = document.createElement('button');
		x.className = 'file-x';
		x.textContent = '×';
		x.title = 'Remove';
		x.addEventListener('click', () => {
			pickedFiles.splice(i, 1);
			vscode.postMessage({ type: 'removeFile', index: i });
			renderPickedFiles();
		});
		chip.appendChild(x);
		pickedFilesEl.appendChild(chip);
	});
}

function setThinking() {
	enhanceBtn.disabled = true;
	expandDirectBtn.disabled = true;
	enhanceBtn.textContent = 'Thinking...';
}

function runEnhance(skipQuestions) {
	const prompt = promptEl.value.trim();
	if (!prompt) {
		errorEl.textContent = 'Type a rough prompt first.';
		return;
	}
	questionsEl.innerHTML = '';
	outputEl.innerHTML = '';
	errorEl.textContent = '';
	setThinking();
	vscode.postMessage({ type: 'enhance', prompt, skipQuestions });
}

enhanceBtn.addEventListener('click', () => runEnhance(false));
expandDirectBtn.addEventListener('click', () => runEnhance(true));

startOverBtn.addEventListener('click', () => {
	promptEl.value = '';
	suggestionsEl.innerHTML = '';
	chosenEl.textContent = '';
	pickedFilesEl.innerHTML = '';
	questionsEl.innerHTML = '';
	outputEl.innerHTML = '';
	errorEl.textContent = '';
	chosenLibraries = [];
	pickedFiles = [];
	resetButtons();
	vscode.postMessage({ type: 'reset' });
});

function resetButtons() {
	enhanceBtn.disabled = false;
	expandDirectBtn.disabled = false;
	enhanceBtn.textContent = 'Enhance';
}

function renderHistory(history) {
	historyEl.innerHTML = '';
	if (!history || !history.length) return;
	const h = document.createElement('h4');
	h.textContent = 'Recent prompts';
	historyEl.appendChild(h);
	history.forEach((entry) => {
		const row = document.createElement('div');
		row.className = 'hist';
		const p = document.createElement('div');
		p.className = 'hp';
		p.textContent = entry.prompt;
		const copy = document.createElement('button');
		copy.textContent = 'Copy result';
		copy.addEventListener('click', () => navigator.clipboard.writeText(entry.output));
		const reuse = document.createElement('button');
		reuse.textContent = 'Reuse';
		reuse.addEventListener('click', () => {
			promptEl.value = entry.prompt;
			outputEl.innerHTML = '';
		});
		row.appendChild(p);
		row.appendChild(copy);
		row.appendChild(reuse);
		historyEl.appendChild(row);
	});
}

function renderChosen() {
	chosenEl.textContent = chosenLibraries.length
		? 'Chosen libraries: ' + chosenLibraries.join(', ')
		: '';
	vscode.postMessage({ type: 'chooseLibraries', libraries: chosenLibraries });
}

function addChosen(pkgs) {
	pkgs.forEach((p) => { if (!chosenLibraries.includes(p)) chosenLibraries.push(p); });
	renderChosen();
}

function renderSuggestions(suggestions) {
	suggestionsEl.innerHTML = '';
	if (!suggestions.length) {
		suggestionsEl.textContent = 'Your stack already covers the common categories — nothing to suggest.';
		return;
	}
	suggestions.forEach((s) => {
		let idx = 0; // which option in this category is currently shown
		const card = document.createElement('div');
		card.className = 'suggestion';

		function draw() {
			const opt = s.options[idx];
			card.innerHTML = '';

			const close = document.createElement('button');
			close.className = 'close';
			close.textContent = '×';
			close.title = 'Dismiss';
			close.addEventListener('click', () => card.remove());
			card.appendChild(close);

			const cat = document.createElement('div');
			cat.className = 'cat';
			cat.textContent = s.category;
			card.appendChild(cat);

			const pkg = document.createElement('span');
			pkg.className = 'pkg';
			pkg.textContent = opt.package;
			const tier = document.createElement('span');
			tier.className = 'tier tier-' + opt.tier;
			tier.textContent = opt.tier + ' compat';
			const pkgLine = document.createElement('div');
			pkgLine.appendChild(pkg);
			pkgLine.appendChild(tier);
			card.appendChild(pkgLine);

			const note = document.createElement('div');
			note.className = 'note';
			note.textContent = opt.note;
			card.appendChild(note);

			if (opt.pairsWith && opt.pairsWith.length) {
				const pairs = document.createElement('div');
				pairs.className = 'pairs';
				pairs.textContent = 'Works great with: ' + opt.pairsWith.join(', ');
				card.appendChild(pairs);
			}

			const accept = document.createElement('button');
			accept.textContent = 'Use this';
			accept.addEventListener('click', () => {
				addChosen([opt.package].concat(opt.pairsWith || []));
				card.remove();
			});

			const other = document.createElement('button');
			other.textContent = idx + 1 < s.options.length ? 'Suggest another' : 'No good option';
			other.addEventListener('click', () => {
				if (idx + 1 < s.options.length) { idx++; draw(); }
				else { card.remove(); } // out of options — skip category
			});

			const why = document.createElement('button');
			why.textContent = 'Why?';
			why.dataset.category = s.category;
			why.dataset.package = opt.package;
			const explain = document.createElement('div');
			explain.className = 'why';
			why.addEventListener('click', () => {
				why.disabled = true;
				why.textContent = 'Thinking...';
				explain.textContent = '';
				vscode.postMessage({ type: 'explainSuggestion', category: s.category, package: opt.package, note: opt.note });
			});

			card.appendChild(accept);
			card.appendChild(other);
			card.appendChild(why);
			card.appendChild(explain);
		}

		draw();
		suggestionsEl.appendChild(card);
	});
}

function renderQuestions(questions) {
	questionsEl.innerHTML = '';
	questions.forEach((q, i) => {
		const wrap = document.createElement('div');
		wrap.className = 'question';
		const label = document.createElement('label');
		label.textContent = q.question;
		const select = document.createElement('select');
		select.id = 'q' + i;
		q.options.forEach((opt) => {
			const option = document.createElement('option');
			option.value = opt;
			option.textContent = opt;
			select.appendChild(option);
		});
		wrap.appendChild(label);
		wrap.appendChild(select);
		questionsEl.appendChild(wrap);
	});
	const submit = document.createElement('button');
	submit.textContent = 'Submit answers';
	submit.addEventListener('click', () => {
		const answers = questions.map((_, i) => document.getElementById('q' + i).value);
		questionsEl.innerHTML = '';
		setThinking();
		vscode.postMessage({ type: 'answers', answers });
	});
	const skip = document.createElement('button');
	skip.textContent = 'Skip questions';
	skip.addEventListener('click', () => {
		questionsEl.innerHTML = '';
		setThinking();
		vscode.postMessage({ type: 'skip' });
	});
	questionsEl.appendChild(submit);
	questionsEl.appendChild(skip);
}

function renderOutput(text) {
	outputEl.innerHTML = '';
	const pre = document.createElement('div');
	pre.textContent = text;
	const copy = document.createElement('button');
	copy.textContent = 'Copy';
	copy.addEventListener('click', () => navigator.clipboard.writeText(text));
	outputEl.appendChild(pre);
	outputEl.appendChild(copy);
}

window.addEventListener('message', (event) => {
	if (event.data.type === 'restore') {
		if (event.data.lastPrompt) promptEl.value = event.data.lastPrompt;
		if (event.data.lastOutput) renderOutput(event.data.lastOutput);
		if (Array.isArray(event.data.chosenLibraries) && event.data.chosenLibraries.length) {
			chosenLibraries = event.data.chosenLibraries;
			renderChosen();
		}
		if (Array.isArray(event.data.pickedFiles) && event.data.pickedFiles.length) {
			pickedFiles = event.data.pickedFiles;
			renderPickedFiles();
		}
		renderHistory(event.data.history);
	}
	if (event.data.type === 'pickedFiles') {
		pickedFiles = event.data.files;
		renderPickedFiles();
	}
	if (event.data.type === 'context') {
		const c = event.data.context;
		const parts = c && c.react ? ['React ' + c.react] : ['No React detected'];
		if (c?.next) parts.push('Next ' + c.next + (c.nextRouter === 'app' ? ' (App Router)' : c.nextRouter === 'pages' ? ' (Pages Router)' : ''));
		const categories = ['router', 'state', 'styling', 'dataFetching', 'forms', 'uiKit', 'icons', 'testing', 'animation', 'tables', 'validation', 'auth', 'i18n', 'dates', 'charts', 'dragDrop', 'notifications', 'buildTool', 'backend'];
		categories.forEach((key) => { if (c?.[key]) parts.push(c[key]); });
		if (c?.selectedCode) parts.push('+ selected code');
		document.getElementById('detected').textContent = 'Detected: ' + parts.join(', ');
	}
	if (event.data.type === 'suggestions') {
		renderSuggestions(event.data.suggestions);
	}
	if (event.data.type === 'suggestionExplanation') {
		const btn = suggestionsEl.querySelector('button[data-category="' + event.data.category + '"][data-package="' + event.data.package + '"]');
		if (btn) {
			btn.disabled = false;
			btn.textContent = 'Why?';
			btn.nextElementSibling.textContent = event.data.text;
		}
	}
	if (event.data.type === 'questions') {
		resetButtons();
		renderQuestions(event.data.questions);
	}
	if (event.data.type === 'expanded') {
		resetButtons();
		renderOutput(event.data.text);
		renderHistory(event.data.history);
	}
	if (event.data.type === 'error') {
		resetButtons();
		suggestionsEl.querySelectorAll('button[data-category]').forEach((btn) => {
			if (btn.textContent === 'Thinking...') { btn.disabled = false; btn.textContent = 'Why?'; }
		});
		errorEl.textContent = 'Error: ' + event.data.message;
	}
});
