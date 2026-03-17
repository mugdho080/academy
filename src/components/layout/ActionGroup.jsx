import React from 'react';

const ActionGroup = ({ className = '', children }) => (
    <div className={`flex flex-wrap items-center gap-2 sm:gap-3 ${className}`}>
        {children}
    </div>
);

export default ActionGroup;
