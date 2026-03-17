import React from 'react';

const ResponsiveTable = ({ className = '', children }) => {
    return (
        <div className={`responsive-table-shell overflow-x-auto rounded-2xl border border-slate-100 bg-white ${className}`}>
            <div className="min-w-[680px]">{children}</div>
        </div>
    );
};

export default ResponsiveTable;
