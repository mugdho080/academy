/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { Server } from 'socket.io';
import http from 'http';
import { v4 as uuidv4 } from 'uuid';

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: '*' }
  });

  // Game State
  const players: Record<string, any> = {};
  let playerCount = 0;
  let activePlayer: string | null = null;
  let turnEndTime = 0;
  let prizes: any[] = [];
  
  const colorValues: Record<string, number> = {
    '#FBBC04': 50, // Yellow
    '#EA4335': 40, // Medium red
    '#34A853': 30, // Medium green
    '#E37400': 20, // Orange
    '#9AA0A6': 10  // Gray (lowest points)
  };
  
  const typeMultipliers: Record<string, number> = {
    'dodecahedron': 3,
    'sphere': 2,
    'box': 1
  };
  
  const colors = Object.keys(colorValues);
  const types = Object.keys(typeMultipliers);

  const DISALLOW_LIST = new Set([
    'ASS', 'CUM', 'FAG', 'FUK', 'FUQ', 'GAY', 'JEW', 'JIZ', 'KKK', 'SEX', 'TIT', 'VAG', 'WAP', 'WTF', 'WTG', 'DIK', 'COK', 'FUC', 'FUX', 'NIG', 'NGR', 'BCH', 'BIT', 'HOE', 'SLT', 'CUN', 'KYS'
  ]);
  
  function initPrizes() {
    prizes = [];
    for(let i=0; i<60; i++) {
      let x = (Math.random()-0.5)*7;
      let z = (Math.random()-0.5)*7;
      // Avoid chute area (x: -5 to -2, z: 2 to 5)
      if (x < -2 && z > 2) {
        x += 3;
      }
      
      const type = types[Math.floor(Math.random() * types.length)];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const value = colorValues[color] * typeMultipliers[type];

      prizes.push({
        id: `prize_${uuidv4()}`,
        type,
        color,
        value,
        position: [x, Math.random()*4 + 1, z],
        rotation: [0,0,0,1]
      });
    }
    
    // Add 3 bugdroids
    for(let i=0; i<3; i++) {
      let x = (Math.random()-0.5)*7;
      let z = (Math.random()-0.5)*7;
      if (x < -2 && z > 2) x += 3;
      
      prizes.push({
        id: `prize_bugdroid_${uuidv4()}`,
        type: 'bugdroid',
        color: '#34A853',
        value: 100,
        position: [x, Math.random()*2 + 5, z],
        rotation: [0,0,0,1]
      });
    }
  }
  initPrizes();

  let clawState = { x: 0, y: 8, z: 0, state: 'idle', prongsClosed: false, grabbedPrizeId: null };

  function startGame(playerId: string) {
    activePlayer = playerId;
    turnEndTime = Date.now() + 60000; // 1 minute
    clawState = { x: 0, y: 8, z: 0, state: 'idle', prongsClosed: false, grabbedPrizeId: null };
    if (players[playerId]) {
      players[playerId].currentScore = 0; // Reset current score for new game
      io.emit('players_update', players);
    }
    initPrizes(); // Reset prizes for the new game
    io.emit('prizes_reset', prizes);
    io.emit('turn_start', { activePlayer, turnEndTime, clawState, queue: [] });
  }

  function endGame() {
    if (activePlayer !== null) {
      const sortedPlayers = Object.values(players).sort((a, b) => b.score - a.score);
      io.emit('game_over', { winner: players[activePlayer], players: sortedPlayers });
    }
    activePlayer = null;
    io.emit('turn_start', { activePlayer: null, queue: [] });
  }

  setInterval(() => {
    if (activePlayer && Date.now() > turnEndTime) {
      endGame();
    }
  }, 1000);

  io.on('connection', (socket) => {
    socket.emit('init_state', {
      players, queue: [], activePlayer, turnEndTime, prizes, clawState
    });

    socket.on('join', (name: string) => {
      let finalName = name.toUpperCase().slice(0, 3);
      if (finalName.length !== 3 || !/^[A-Z]{3}$/.test(finalName) || DISALLOW_LIST.has(finalName)) {
        playerCount++;
        finalName = `P${playerCount}`.slice(0, 3); // Fallback
      }
      
      players[socket.id] = {
        id: socket.id,
        name: finalName,
        score: 0,
        currentScore: 0,
        color: colors[Math.floor(Math.random() * colors.length)]
      };
      io.emit('players_update', players);
    });

    socket.on('join_queue', () => {
      if (!players[socket.id]) return;
      if (!activePlayer) {
        startGame(socket.id);
      }
    });

    socket.on('claw_update', (data) => {
      if (socket.id === activePlayer) {
        clawState = { ...clawState, ...data };
        socket.broadcast.emit('claw_sync', clawState);
      }
    });

    socket.on('prizes_update', (data) => {
      const playerIds = Object.keys(players);
      if (socket.id === activePlayer || (!activePlayer && playerIds[0] === socket.id)) {
        data.forEach((update: any) => {
          const p = prizes.find(p => p.id === update.id);
          if (p) {
            p.position = update.position;
            p.rotation = update.rotation;
          }
        });
        socket.broadcast.emit('prizes_sync', data);
      }
    });

    socket.on('prize_captured', (prizeId) => {
      const playerIds = Object.keys(players);
      const isPhysicsHost = socket.id === activePlayer || 
                            (!activePlayer && playerIds[0] === socket.id);
      
      if (isPhysicsHost) {
        const index = prizes.findIndex(p => p.id === prizeId);
        if (index !== -1) {
          const prize = prizes[index];
          
          const targetPlayer = activePlayer;
          
          if (targetPlayer && players[targetPlayer]) {
            players[targetPlayer].currentScore = (players[targetPlayer].currentScore || 0) + prize.value;
            if (players[targetPlayer].currentScore > players[targetPlayer].score) {
              players[targetPlayer].score = players[targetPlayer].currentScore;
            }
            io.emit('prize_removed', { prizeId, playerId: targetPlayer, score: players[targetPlayer].currentScore });
          } else {
            io.emit('prize_removed', { prizeId, playerId: null, score: null });
          }
          
          prizes.splice(index, 1);
          
          if (prizes.length < 10) {
            initPrizes();
            io.emit('prizes_reset', prizes);
          }
        }
      }
    });

    socket.on('turn_end', () => {
      // No longer used for single player
    });

    socket.on('disconnect', () => {
      if (activePlayer === socket.id) {
        endGame();
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
