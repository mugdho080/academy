import React from 'react';

const ClayCard = ({ children, className = '', inset = false }) => {
    return (
        <div className={`${inset ? 'clay-inset' : 'clay-card'} ${className}`}>
            {children}
        </div>
    );
};

export default ClayCard;

