import React, { useState } from 'react';

const CalmCharacter = () => {
    const [isPetted, setIsPetted] = useState(false);

    const handlePet = () => {
        setIsPetted(true);
        setTimeout(() => setIsPetted(false), 1000);
    };

    return (
        <div
            onClick={handlePet}
            className="group flex flex-col items-center justify-center p-4 cursor-pointer relative"
        >
            <div className={`
                text-6xl transition-transform duration-500 select-none
                ${isPetted ? 'scale-110 rotate-12' : 'scale-100 group-hover:scale-105'}
            `}>
                🐢
            </div>

            {/* Heart Popup */}
            <div className={`
                absolute top-0 right-0 text-3xl transition-all duration-700
                ${isPetted ? 'opacity-100 -translate-y-8 translate-x-4' : 'opacity-0 translate-y-0 translate-x-0'}
            `}>
                💚
            </div>

            <p className="mt-2 text-teal-800 font-bold text-sm uppercase tracking-wider">Tap the Turtle</p>
            <p className="text-[10px] text-teal-600/60">to calm it down</p>
        </div>
    );
};

export default CalmCharacter;
