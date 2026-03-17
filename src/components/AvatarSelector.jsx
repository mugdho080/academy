import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Lock, Star } from 'lucide-react';

const avatars = [
    { id: 'koala', emoji: '🐨', name: 'Cool Koala', minPoints: 0 },
    { id: 'lion', emoji: '🦁', name: 'Brave Lion', minPoints: 100 },
    { id: 'fox', emoji: '🦊', name: 'Clever Fox', minPoints: 300 },
    { id: 'owl', emoji: '🦉', name: 'Wise Owl', minPoints: 500 },
    { id: 'unicorn', emoji: '🦄', name: 'Magic Unicorn', minPoints: 1000 },
    { id: 'dragon', emoji: '🐲', name: 'Fire Dragon', minPoints: 2000 },
];

const AvatarSelector = ({ isOpen, onClose, currentAvatar, onSelect, userPoints = 0 }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-6">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-[#3B1B54]/80 backdrop-blur-xl"
                    />

                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, rotateX: 20 }}
                        animate={{ scale: 1, opacity: 1, rotateX: 0 }}
                        exit={{ scale: 0.9, opacity: 0, rotateX: 20 }}
                        className="relative w-full max-w-2xl bg-white rounded-[2rem] sm:rounded-[3rem] shadow-[0_50px_100px_rgba(0,0,0,0.5)] border-4 sm:border-[8px] border-white/20 overflow-hidden max-h-[92vh] flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-4 sm:p-8 bg-gradient-to-r from-[#522570] to-[#3B1B54] text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-xl sm:text-3xl font-black italic tracking-tighter uppercase leading-none">Choose Your Hero</h3>
                                <p className="text-sm opacity-60 font-bold mt-2 uppercase tracking-widest">Unlock more as you learn!</p>
                            </div>
                            <button onClick={onClose} className="w-10 h-10 sm:w-12 sm:h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Avatar Grid */}
                        <div className="p-4 sm:p-8 grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-8 overflow-y-auto scrollbar-hide bg-gray-50 flex-1">
                            {avatars.map((avatar) => {
                                const isUnlocked = userPoints >= avatar.minPoints;
                                const isSelected = currentAvatar === avatar.id;

                                return (
                                    <motion.div
                                        key={avatar.id}
                                        whileHover={isUnlocked ? { scale: 1.05, y: -5 } : {}}
                                        whileTap={isUnlocked ? { scale: 0.95 } : {}}
                                        onClick={() => isUnlocked && onSelect(avatar.id)}
                                        className={`
                                            relative aspect-square rounded-[1.5rem] sm:rounded-[2.5rem] flex flex-col items-center justify-center p-3 sm:p-6 transition-all border-4
                                            ${isSelected
                                                ? 'bg-[#522570] border-[#3B1B54] shadow-2xl'
                                                : isUnlocked
                                                    ? 'bg-white border-transparent shadow-xl hover:shadow-2xl cursor-pointer'
                                                    : 'bg-gray-200 border-transparent grayscale opacity-60'}
                                        `}
                                    >
                                        <div className="text-5xl sm:text-7xl mb-2 sm:mb-4 transform group-hover:scale-110 transition-transform">
                                            {avatar.emoji}
                                        </div>

                                        <p className={`font-black text-xs uppercase tracking-widest ${isSelected ? 'text-white' : 'text-[#3B1B54]'}`}>
                                            {avatar.name}
                                        </p>

                                        {/* Status Indicators */}
                                        {isSelected && (
                                            <div className="absolute -top-3 -right-3 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
                                                <Check size={20} className="text-white" />
                                            </div>
                                        )}

                                        {!isUnlocked && (
                                            <div className="mt-2 flex flex-col items-center gap-1">
                                                <div className="flex items-center gap-1 text-[10px] font-black text-gray-500">
                                                    <Lock size={10} />
                                                    {avatar.minPoints} PTS
                                                </div>
                                                <div className="w-16 h-1 w-full bg-gray-300 rounded-full overflow-hidden">
                                                    <div className="h-full bg-yellow-400" style={{ width: `${(userPoints / avatar.minPoints) * 100}%` }} />
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Footer / Stats */}
                        <div className="p-4 sm:p-8 bg-white border-t-2 border-gray-100 flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center">
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-400 rounded-2xl flex items-center justify-center shadow-lg">
                                    <Star size={24} fill="#3B1B54" className="text-[#3B1B54]" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-[#3B1B54] uppercase tracking-widest opacity-40 leading-none">Your Total XP</p>
                                    <p className="text-xl sm:text-2xl font-black text-[#522570] italic tracking-tighter">{userPoints} XP</p>
                                </div>
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={onClose}
                                className="bg-[#3B1B54] text-white px-8 sm:px-10 py-3.5 sm:py-4 rounded-2xl font-black text-base sm:text-lg italic tracking-tighter uppercase shadow-xl w-full sm:w-auto"
                            >
                                Done!
                            </motion.button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default AvatarSelector;
