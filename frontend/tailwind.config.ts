import type {Config} from 'tailwindcss';
const fontFamily = ['"Times New Roman"', 'Times', 'serif'];
export default {content:['./src/**/*.{ts,tsx}'],theme:{extend:{colors:{ink:'#172742',brand:'#1F4BB8',coral:'#C8372D',paper:'#FAF9F5'},fontFamily:{sans:fontFamily,serif:fontFamily,mono:fontFamily}}},plugins:[]} satisfies Config;
