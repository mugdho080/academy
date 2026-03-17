import React from 'react';

const toneClasses = {
    neutral: 'bg-[rgba(255,255,255,0.6)] text-[color:var(--clay-text)]',
    info: 'bg-[rgba(33,167,241,0.18)] text-[color:var(--clay-text)]',
    success: 'bg-[rgba(126,217,87,0.24)] text-[color:var(--clay-text)]',
    warning: 'bg-[rgba(240,153,91,0.24)] text-[color:var(--clay-text)]',
    danger: 'bg-[rgba(223,44,26,0.18)] text-[color:var(--clay-danger)]'
};

const ClayBadge = ({ children, tone = 'neutral', className = '' }) => {
    return (
        <span className={`clay-pill ${toneClasses[tone] || toneClasses.neutral} ${className}`}>
            {children}
        </span>
    );
};

export default ClayBadge;
