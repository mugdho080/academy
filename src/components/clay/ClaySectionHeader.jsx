import React from 'react';

const ClaySectionHeader = ({ eyebrow, title, description, actions = null, className = '' }) => {
    return (
        <div className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${className}`}>
            <div>
                {eyebrow ? (
                    <p className="text-[11px] uppercase tracking-[0.18em] font-black text-[color:var(--clay-text-soft)]">
                        {eyebrow}
                    </p>
                ) : null}
                <h2 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-[color:var(--clay-text)]">
                    {title}
                </h2>
                {description ? (
                    <p className="mt-2 text-sm sm:text-base font-medium text-[color:var(--clay-text-soft)]">
                        {description}
                    </p>
                ) : null}
            </div>
            {actions}
        </div>
    );
};

export default ClaySectionHeader;

