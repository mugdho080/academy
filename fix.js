const fs = require('fs');
const path = 'c:/Users/user/Downloads/academy/src/pages/LevelDashboard.jsx';
let content = fs.readFileSync(path, 'utf8');

const targetStr = '<div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isCompleted ? \'bg-green-100 text-green-600 group-hover:bg-green-500 group-hover:text-white\' : \'bg-[#00695C]/10 text-[#00695C] group-hover:bg-[#00695C] group-hover:text-white\'}`}>\n                                            <ChevronRight size={16} strokeWidth={3} />\n                                        </div>';

const replacementStr = `{isCompleted ? (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    startLesson(idx);
                                                }}
                                                className="px-4 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 text-[10px] sm:text-xs font-black uppercase rounded-full shadow-md transition-all hover:scale-105 active:scale-95 z-10"
                                            >
                                                Retry
                                            </button>
                                        ) : (
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-[#00695C]/10 text-[#00695C] group-hover:bg-[#00695C] group-hover:text-white">
                                                <ChevronRight size={16} strokeWidth={3} />
                                            </div>
                                        )}`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Successfully replaced');
} else {
    // try removing carriage returns
    const targetNoCR = targetStr.replace(/\r/g, '');
    const contentNoCR = content.replace(/\r/g, '');
    if (contentNoCR.includes(targetNoCR)) {
        content = contentNoCR.replace(targetNoCR, replacementStr);
        fs.writeFileSync(path, content, 'utf8');
        console.log('Successfully replaced (LF mode)');
    } else {
        console.log('Target not found');
    }
}
