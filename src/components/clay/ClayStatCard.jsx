import React from 'react';

const ClayStatCard = ({ label, value, helper, icon = null, className = '' }) => {
    return (
        <div className={`clay-card p-4 sm:p-5 ${className}`}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] font-black text-[color:var(--clay-text-soft)]">
                        {label}
                    </p>
                    <p className="mt-2 text-2xl sm:text-3xl font-black text-[color:var(--clay-text)] break-words">
                        {value}
                    </p>
                    {helper ? (
                        <p className="mt-2 text-sm font-medium text-[color:var(--clay-text-soft)]">
                            {helper}
                        </p>
                    ) : null}
                </div>
                {icon ? (
                    <div className="clay-icon-pocket">
                        {icon}
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default ClayStatCard;

