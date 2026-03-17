import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const VARIANT_SCOPES = {
    learner: 'goodwill-ui-variant-learner',
    admin: 'goodwill-ui-variant-admin'
};

const UiVariantContext = createContext(null);

const readStoredVariant = (storageKey) => {
    if (typeof window === 'undefined') return 'classic';
    const stored = window.localStorage.getItem(storageKey);
    return stored === 'clay' ? 'clay' : 'classic';
};

export const UiVariantProvider = ({ children }) => {
    const [variants, setVariants] = useState({
        learner: 'classic',
        admin: 'classic'
    });

    useEffect(() => {
        setVariants({
            learner: readStoredVariant(VARIANT_SCOPES.learner),
            admin: readStoredVariant(VARIANT_SCOPES.admin)
        });
    }, []);

    const setVariant = (scope, nextVariant) => {
        if (!VARIANT_SCOPES[scope]) return;
        const normalized = nextVariant === 'clay' ? 'clay' : 'classic';

        setVariants((current) => ({
            ...current,
            [scope]: normalized
        }));

        if (typeof window !== 'undefined') {
            window.localStorage.setItem(VARIANT_SCOPES[scope], normalized);
        }
    };

    const value = useMemo(() => ({
        variants,
        setVariant
    }), [variants]);

    return (
        <UiVariantContext.Provider value={value}>
            {children}
        </UiVariantContext.Provider>
    );
};

export const useUiVariant = (scope) => {
    const context = useContext(UiVariantContext);

    if (!context) {
        throw new Error('useUiVariant must be used within UiVariantProvider');
    }

    return {
        variant: context.variants[scope] || 'classic',
        setVariant: (nextVariant) => context.setVariant(scope, nextVariant)
    };
};

