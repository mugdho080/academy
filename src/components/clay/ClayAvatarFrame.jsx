import React from 'react';
import { User } from 'lucide-react';

const ClayAvatarFrame = ({ src, alt = 'Avatar', fallbackIcon = <User size={42} />, sizeClass = 'h-28 w-28 sm:h-32 sm:w-32' }) => {
    return (
        <div className={`clay-avatar-frame ${sizeClass}`}>
            {src ? (
                <img src={src} alt={alt} className="h-full w-full rounded-[inherit] object-cover" />
            ) : (
                <div className="flex h-full w-full items-center justify-center text-[color:var(--clay-text-soft)]">
                    {fallbackIcon}
                </div>
            )}
        </div>
    );
};

export default ClayAvatarFrame;

