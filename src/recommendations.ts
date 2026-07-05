import { LibCategory } from './libGroups';
import { ProjectContext } from './context';

export type CompatTier = 'high' | 'medium' | 'low';

export interface LibraryRecommendation {
	package: string;
	tier: CompatTier;
	note: string;
	// Companion packages that work great alongside this one (usually installed together).
	pairsWith: string[];
}

// Curated per-category recommendations, ordered best-first. Grounded in the
// commonly-recommended React stack for 2026 (see project README / commit notes):
// shadcn/Radix + Tailwind, Zustand + TanStack Query, React Hook Form + Zod,
// Framer Motion, Recharts, dnd-kit, Vitest + Playwright + MSW.
// Not every LibCategory needs entries — only the ones worth actively suggesting.
export const RECOMMENDATIONS: Partial<Record<LibCategory, LibraryRecommendation[]>> = {
	state: [
		{ package: 'zustand', tier: 'high', note: 'Minimal client-state store; the modern default.', pairsWith: ['@tanstack/react-query'] },
		{ package: 'jotai', tier: 'high', note: 'Atomic state, great for fine-grained reactivity.', pairsWith: ['@tanstack/react-query'] },
		{ package: '@reduxjs/toolkit', tier: 'medium', note: 'Structured, opinionated; good for large teams.', pairsWith: ['react-redux'] },
		{ package: 'valtio', tier: 'medium', note: 'Proxy-based mutable state.', pairsWith: [] },
	],
	dataFetching: [
		{ package: '@tanstack/react-query', tier: 'high', note: 'Server-state caching, the default for data fetching.', pairsWith: ['axios'] },
		{ package: 'swr', tier: 'high', note: 'Lightweight fetching with caching, by Vercel.', pairsWith: [] },
		{ package: '@trpc/client', tier: 'high', note: 'End-to-end typesafe API; pairs with a tRPC backend.', pairsWith: ['@trpc/react-query', '@tanstack/react-query'] },
		{ package: '@apollo/client', tier: 'medium', note: 'Use when your API is GraphQL.', pairsWith: ['graphql'] },
	],
	forms: [
		{ package: 'react-hook-form', tier: 'high', note: 'Performant, uncontrolled forms; the default choice.', pairsWith: ['zod', '@hookform/resolvers'] },
		{ package: '@tanstack/react-form', tier: 'high', note: 'Typesafe forms; great inside the TanStack ecosystem.', pairsWith: ['zod'] },
		{ package: 'formik', tier: 'low', note: 'Older, heavier; prefer react-hook-form for new work.', pairsWith: ['yup'] },
	],
	validation: [
		{ package: 'zod', tier: 'high', note: 'TypeScript-first schema validation; the default.', pairsWith: ['@hookform/resolvers'] },
		{ package: 'valibot', tier: 'medium', note: 'Zod-like but smaller bundle.', pairsWith: [] },
		{ package: 'yup', tier: 'low', note: 'Common with Formik; zod is preferred for new code.', pairsWith: [] },
	],
	uiKit: [
		{ package: 'shadcn-ui', tier: 'high', note: 'Copy-in components on Radix + Tailwind; full ownership, no lock-in.', pairsWith: ['tailwindcss', 'lucide-react', 'class-variance-authority', 'tailwind-merge'] },
		{ package: '@mantine/core', tier: 'high', note: 'Batteries-included component + hooks library.', pairsWith: ['@tabler/icons-react'] },
		{ package: '@chakra-ui/react', tier: 'medium', note: 'Accessible components with a style-prop API.', pairsWith: [] },
		{ package: '@mui/material', tier: 'medium', note: 'Mature Material Design system.', pairsWith: ['@mui/icons-material', '@emotion/react'] },
	],
	styling: [
		{ package: 'tailwindcss', tier: 'high', note: 'Utility-first CSS; the modern default.', pairsWith: ['clsx', 'tailwind-merge', 'class-variance-authority'] },
		{ package: '@vanilla-extract/css', tier: 'medium', note: 'Typesafe, zero-runtime CSS-in-TS.', pairsWith: [] },
		{ package: 'styled-components', tier: 'low', note: 'Runtime CSS-in-JS; heavier than Tailwind/zero-runtime options.', pairsWith: [] },
	],
	icons: [
		{ package: 'lucide-react', tier: 'high', note: 'Clean, tree-shakable icon set; pairs with shadcn.', pairsWith: [] },
		{ package: '@tabler/icons-react', tier: 'high', note: 'Large, consistent icon set.', pairsWith: [] },
		{ package: 'react-icons', tier: 'medium', note: 'Many icon packs in one; larger install.', pairsWith: [] },
	],
	animation: [
		{ package: 'motion', tier: 'high', note: 'Framer Motion (now "motion"); the production default.', pairsWith: [] },
		{ package: '@react-spring/web', tier: 'medium', note: 'Physics-based springs.', pairsWith: [] },
		{ package: '@formkit/auto-animate', tier: 'medium', note: 'Drop-in automatic transitions.', pairsWith: [] },
	],
	charts: [
		{ package: 'recharts', tier: 'high', note: 'Composable charts for common cases; the default.', pairsWith: [] },
		{ package: 'echarts-for-react', tier: 'medium', note: 'Powerful; good for complex dashboards.', pairsWith: ['echarts'] },
		{ package: 'react-chartjs-2', tier: 'medium', note: 'Chart.js wrapper.', pairsWith: ['chart.js'] },
	],
	tables: [
		{ package: '@tanstack/react-table', tier: 'high', note: 'Headless table logic; bring your own markup.', pairsWith: ['@tanstack/react-virtual'] },
		{ package: 'ag-grid-react', tier: 'medium', note: 'Feature-rich data grid for heavy use.', pairsWith: [] },
	],
	dragDrop: [
		{ package: '@dnd-kit/core', tier: 'high', note: 'Modern, flexible, accessible drag-and-drop.', pairsWith: ['@dnd-kit/sortable'] },
		{ package: '@hello-pangea/dnd', tier: 'medium', note: 'Maintained fork of react-beautiful-dnd.', pairsWith: [] },
	],
	notifications: [
		{ package: 'sonner', tier: 'high', note: 'Modern toast component; pairs with shadcn.', pairsWith: [] },
		{ package: 'react-hot-toast', tier: 'high', note: 'Lightweight, simple toasts.', pairsWith: [] },
	],
	testing: [
		{ package: 'vitest', tier: 'high', note: 'Fast unit test runner; the default for Vite projects.', pairsWith: ['@testing-library/react', '@testing-library/jest-dom', 'jsdom'] },
		{ package: '@playwright/test', tier: 'high', note: 'The default for end-to-end testing.', pairsWith: [] },
		{ package: 'msw', tier: 'high', note: 'Mock network at the boundary; works in Vitest, Playwright, Storybook.', pairsWith: [] },
		{ package: 'jest', tier: 'medium', note: 'Established runner; Vitest is preferred for new Vite projects.', pairsWith: ['@testing-library/react'] },
	],
	auth: [
		{ package: '@clerk/nextjs', tier: 'high', note: 'Drop-in auth + user management for Next.js.', pairsWith: [] },
		{ package: 'next-auth', tier: 'high', note: 'Auth.js — flexible auth for Next.js.', pairsWith: [] },
		{ package: '@supabase/supabase-js', tier: 'medium', note: 'Auth + Postgres backend in one.', pairsWith: [] },
	],
	dates: [
		{ package: 'date-fns', tier: 'high', note: 'Modular, tree-shakable date utilities.', pairsWith: [] },
		{ package: 'dayjs', tier: 'high', note: 'Tiny Moment-compatible API.', pairsWith: [] },
		{ package: 'luxon', tier: 'medium', note: 'Rich timezone handling.', pairsWith: [] },
	],
	i18n: [
		{ package: 'react-i18next', tier: 'high', note: 'The most common i18n solution.', pairsWith: ['i18next'] },
		{ package: 'next-intl', tier: 'high', note: 'i18n built for the Next.js App Router.', pairsWith: [] },
	],
	router: [
		{ package: 'react-router-dom', tier: 'high', note: 'The standard SPA router.', pairsWith: [] },
		{ package: '@tanstack/react-router', tier: 'high', note: 'Typesafe router; great with the TanStack stack.', pairsWith: [] },
	],
};

export interface CategorySuggestion {
	category: LibCategory;
	// Ordered options: the panel shows the first, and "reject" cycles to the next.
	options: LibraryRecommendation[];
}

// Categories worth proactively suggesting, in the order they should appear.
const SUGGEST_ORDER: LibCategory[] = [
	'uiKit', 'styling', 'icons', 'state', 'dataFetching', 'forms', 'validation',
	'router', 'animation', 'charts', 'tables', 'dragDrop', 'notifications',
	'auth', 'dates', 'i18n', 'testing',
];

// Suggest a library only for categories the project doesn't already cover, so we
// never nudge a second state manager / styling approach onto an existing stack.
export function suggestLibraries(context: ProjectContext | null): CategorySuggestion[] {
	const suggestions: CategorySuggestion[] = [];
	for (const category of SUGGEST_ORDER) {
		if (context && context[category]) {continue;} // already have one — skip
		const options = RECOMMENDATIONS[category];
		if (options && options.length > 0) {
			suggestions.push({ category, options });
		}
	}
	return suggestions;
}
