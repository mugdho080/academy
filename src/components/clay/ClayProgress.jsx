import React from 'react';

const ClayProgress = ({
    label,
    value,
    total,
    percent,
    className = '',
    barClassName = ''
}) => {
    const normalizedPercent = Number.isFinite(percent)
        ? Math.max(0, Math.min(100, percent))
        : total > 0
            ? Math.max(0, Math.min(100, Math.round((value / total) * 100)))
            : 0;

    return (
        <div className={className}>
            {(label || Number.isFinite(value)) && (
                <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[color:var(--clay-text-soft)]">{label}</span>
                    <span className="text-sm font-black text-[color:var(--clay-text)]">
                        {Number.isFinite(value) && Number.isFinite(total) ? `${value} / ${total}` : `${normalizedPercent}%`}
                    </span>
                </div>
            )}
            <div className="clay-progress-track">
                <div
                    className={`clay-progress-bar ${barClassName}`}
                    style={{ width: `${normalizedPercent}%` }}
                />
            </div>
        </div>
    );
};

export default ClayProgress;

