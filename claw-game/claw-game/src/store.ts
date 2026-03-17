/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

interface GameState {
  socket: Socket | null;
  connected: boolean;
  players: Record<string, any>;
  queue: string[];
  activePlayer: string | null;
  turnEndTime: number;
  prizes: any[];
  clawState: any;
  myId: string | null;
  gameOver: { winner: any, players: any[] } | null;
  
  connect: () => void;
  join: (name: string) => void;
  joinQueue: () => void;
  updateClaw: (data: any) => void;
  updatePrizes: (data: any) => void;
  capturePrize: (prizeId: string) => void;
  endTurn: () => void;
}

export const prizeRefs: Record<string, any> = {};

export const useGameStore = create<GameState>((set, get) => ({
  socket: null,
  connected: false,
  players: {},
  queue: [],
  activePlayer: null,
  turnEndTime: 0,
  prizes: [],
  clawState: { x: 0, y: 8, z: 0, state: 'idle', prongsClosed: false, grabbedPrizeId: null },
  myId: null,
  gameOver: null,

  connect: () => {
    if (get().socket) return;
    const socketUrl = window.location.origin;
    const socket = io(socketUrl);

    socket.on('connect', () => {
      set({ connected: true, myId: socket.id });
    });

    socket.on('init_state', (state) => {
      set({ ...state });
    });

    socket.on('players_update', (players) => set({ players }));
    socket.on('queue_update', (queue) => set({ queue }));
    socket.on('turn_start', (data) => set((state) => ({ 
      ...data, 
      gameOver: data.activePlayer ? null : state.gameOver 
    })));
    socket.on('game_over', (data) => set({ gameOver: data }));
    
    socket.on('claw_sync', (clawState) => {
      if (get().activePlayer !== get().myId) {
        set({ clawState });
      }
    });

    socket.on('prizes_sync', (updates) => {
      const playerIds = Object.keys(get().players);
      const isPhysicsHost = get().activePlayer === get().myId || (!get().activePlayer && playerIds[0] === get().myId);
      if (!isPhysicsHost) {
        set((state) => {
          const newPrizes = [...state.prizes];
          updates.forEach((u: any) => {
            const p = newPrizes.find(p => p.id === u.id);
            if (p) {
              p.position = u.position;
              p.rotation = u.rotation;
            }
          });
          return { prizes: newPrizes };
        });
      }
    });

    socket.on('prize_removed', ({ prizeId, playerId, score }) => {
      set((state) => {
        const newPlayers = { ...state.players };
        if (newPlayers[playerId]) {
          newPlayers[playerId].currentScore = score;
          if (score > newPlayers[playerId].score) {
            newPlayers[playerId].score = score;
          }
        }
        return {
          prizes: state.prizes.filter(p => p.id !== prizeId),
          players: newPlayers
        };
      });
    });

    socket.on('prizes_reset', (prizes) => set({ prizes }));

    socket.on('force_drop', () => {
      if (get().activePlayer === get().myId) {
        window.dispatchEvent(new CustomEvent('force_drop'));
      }
    });

    set({ socket });
  },

  join: (name) => get().socket?.emit('join', name),
  joinQueue: () => get().socket?.emit('join_queue'),
  updateClaw: (data) => {
    set((state) => ({ clawState: { ...state.clawState, ...data } }));
    get().socket?.emit('claw_update', data);
  },
  updatePrizes: (data) => get().socket?.emit('prizes_update', data),
  capturePrize: (prizeId) => get().socket?.emit('prize_captured', prizeId),
  endTurn: () => get().socket?.emit('turn_end')
}));
