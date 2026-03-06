/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    light: '#E0F2F1',
                    DEFAULT: '#4DB6AC',
                    dark: '#00897B',
                },
                secondary: {
                    light: '#FFF9C4',
                    DEFAULT: '#FFF176',
                    dark: '#FBC02D',
                },
                sensory: {
                    blue: '#E3F2FD',
                    green: '#E8F5E9',
                    purple: '#F3E5F5',
                    orange: '#FFF3E0',
                }
            },
            animation: {
                'flow': 'flow 10s ease-in-out infinite',
                'pulse-soft': 'pulse-soft 4s ease-in-out infinite',
            },
            keyframes: {
                flow: {
                    '0%, 100%': { transform: 'translateY(0) scale(1)' },
                    '50%': { transform: 'translateY(-20px) scale(1.05)' },
                },
                'pulse-soft': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.7 },
                }
            }
        },
    },
    plugins: [],
}
