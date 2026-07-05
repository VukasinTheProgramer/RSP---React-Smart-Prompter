export type LibCategory =
	| 'router' | 'state' | 'styling' | 'dataFetching' | 'forms' | 'uiKit' | 'icons'
	| 'testing' | 'animation' | 'tables' | 'validation' | 'auth' | 'i18n' | 'dates'
	| 'charts' | 'dragDrop' | 'notifications' | 'buildTool' | 'backend';

export const LIB_GROUPS: Record<LibCategory, string[]> = {
	router: ['react-router-dom', 'react-router', '@tanstack/react-router', 'wouter', '@reach/router', 'react-location'],
	state: ['@reduxjs/toolkit', 'redux', 'react-redux', 'zustand', 'jotai', 'recoil', 'mobx', 'mobx-react-lite', 'valtio', 'xstate', '@xstate/react', 'effector', 'effector-react', 'nanostores', '@nanostores/react', 'immer', 'use-immer'],
	styling: ['tailwindcss', 'styled-components', '@emotion/react', '@emotion/styled', 'sass', 'node-sass', 'less', '@vanilla-extract/css', '@stitches/react', 'classnames', 'clsx', 'tailwind-merge', 'class-variance-authority', 'postcss', 'linaria', 'goober'],
	dataFetching: ['@tanstack/react-query', 'swr', 'axios', '@apollo/client', 'urql', 'graphql-request', 'graphql', 'ky', 'got', 'superagent', 'relay-runtime', 'react-relay', 'ofetch', '@trpc/client', '@trpc/react-query'],
	forms: ['react-hook-form', 'formik', '@tanstack/react-form', 'react-final-form', 'final-form', '@hookform/resolvers', 'react-hook-form-mui', 'informed'],
	uiKit: ['@mui/material', '@chakra-ui/react', 'antd', '@headlessui/react', 'react-bootstrap', '@mantine/core', '@heroui/react', '@nextui-org/react', '@ariakit/react', '@base-ui-components/react', '@arco-design/web-react', 'semantic-ui-react', '@fluentui/react', '@blueprintjs/core', 'primereact', 'react-aria-components', 'shadcn-ui'],
	icons: ['lucide-react', 'react-icons', '@heroicons/react', '@tabler/icons-react', 'react-feather', '@fortawesome/react-fontawesome', '@phosphor-icons/react', '@mui/icons-material', '@ant-design/icons', 'react-bootstrap-icons', '@iconify/react', 'boxicons'],
	testing: ['vitest', 'jest', '@testing-library/react', '@testing-library/user-event', '@testing-library/jest-dom', 'cypress', 'playwright', '@playwright/test', 'msw', 'jsdom', 'happy-dom', '@storybook/react', 'enzyme'],
	animation: ['framer-motion', 'motion', '@react-spring/web', 'react-spring', 'gsap', '@formkit/auto-animate', 'react-transition-group', 'lottie-react', 'react-lottie', '@lottiefiles/react-lottie-player', 'animejs', 'react-motion', 'react-move'],
	tables: ['@tanstack/react-table', 'ag-grid-react', 'react-virtuoso', '@tanstack/react-virtual', 'react-window', 'react-virtualized', 'material-react-table', 'react-data-grid', 'react-table', 'mui-datatables'],
	validation: ['zod', 'yup', 'valibot', 'joi', 'superstruct', 'ajv', 'io-ts', 'class-validator'],
	auth: ['next-auth', '@auth/core', '@clerk/nextjs', '@clerk/clerk-react', '@supabase/supabase-js', 'firebase', '@auth0/auth0-react', '@auth0/nextjs-auth0', 'react-oidc-context', 'oidc-client-ts', 'aws-amplify', '@aws-amplify/auth', 'passport', 'lucia'],
	i18n: ['react-i18next', 'i18next', 'next-intl', '@lingui/react', 'react-intl', 'next-i18next', '@formatjs/intl', 'typesafe-i18n'],
	dates: ['date-fns', 'dayjs', 'luxon', 'moment', 'moment-timezone', '@internationalized/date', 'js-joda', 'spacetime'],
	charts: ['recharts', 'chart.js', 'react-chartjs-2', 'victory', '@visx/visx', '@nivo/core', 'd3', 'echarts', 'echarts-for-react', 'apexcharts', 'react-apexcharts', 'plotly.js', 'react-plotly.js', '@tremor/react', 'lightweight-charts'],
	dragDrop: ['@dnd-kit/core', '@dnd-kit/sortable', 'react-beautiful-dnd', '@hello-pangea/dnd', 'react-dnd', 'react-draggable', 'react-grid-layout', 'react-resizable', 'react-sortablejs'],
	notifications: ['sonner', 'react-hot-toast', 'notistack', 'react-toastify', 'react-notifications', '@radix-ui/react-toast'],
	buildTool: ['vite', 'webpack', 'parcel', 'esbuild', 'rollup', 'turbopack', '@rsbuild/core', 'rspack', 'swc', 'gulp'],
	backend: ['express', 'hono', 'fastify', '@nestjs/core', 'koa', '@hapi/hapi', 'remix', '@remix-run/node', 'apollo-server', '@apollo/server', '@trpc/server'],
};

export const LIB_CATEGORIES = Object.keys(LIB_GROUPS) as LibCategory[];
