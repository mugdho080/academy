import React from 'react';

const PageContainer = ({ className = '', children }) => {
    return (
        <div className={`page-shell py-4 md:py-6 lg:py-8 ${className}`}>
            {children}
        </div>
    );
};

export default PageContainer;
