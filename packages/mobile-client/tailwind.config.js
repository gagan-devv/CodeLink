/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'vscode-bg': '#1e1e1e',
        'vscode-sidebar': '#252526',
        'vscode-border': '#3e3e42',
        'vscode-text': '#cccccc',
        'vscode-text-muted': '#858585',
        'vscode-added': '#044B53',
        'vscode-removed': '#5A1E1E',
        'vscode-dirty': '#ff9800',
        'github-bg': '#0d1117',
        'github-canvas': '#161b22',
        'github-border': '#30363d',
      },
    },
  },
  plugins: [],
}
