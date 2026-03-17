import React from 'react';

const variants = {
    primary: 'bg-[linear-gradient(145deg,#7dc9ff,#9ed9fa)] text-[#1f4f72]',
    secondary: 'bg-[rgba(255,255,255,0.65)] text-[color:var(--clay-text)]',
    ghost: 'bg-transparent text-[color:var(--clay-text-soft)] shadow-none border border-[rgba(255,255,255,0.5)]'
};

const ClayButton = ({ children, variant = 'primary', className = '', ...props }) => {
    return (
        <button
            {...props}
            className={`clay-button ${variants[variant] || variants.primary} ${className}`}
        >
            {children}
        </button>
    );
};

export default ClayButton;
