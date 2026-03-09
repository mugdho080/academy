/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { RigidBody } from '@react-three/rapier';
import { useGameStore } from '../store';
import * as THREE from 'three';

export const ClawMachine = () => {
  const capturePrize = useGameStore(state => state.capturePrize);
  const myId = useGameStore(state => state.myId);
  const activePlayer = useGameStore(state => state.activePlayer);
  const players = useGameStore(state => state.players);
  
  const playerIds = Object.keys(players);
  const isPhysicsHost = (activePlayer === myId && myId !== null) || (!activePlayer && playerIds[0] === myId);

  return (
    <group>
      {/* Machine Base (Hollow) */}
      <RigidBody type="fixed" friction={1}>
        {/* Base Walls */}
        <mesh position={[-5.125, -10, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.25, 20, 10.5]} />
          <meshStandardMaterial color="#4285F4" metalness={0.2} roughness={0.8} />
        </mesh>
        <mesh position={[5.125, -10, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.25, 20, 10.5]} />
          <meshStandardMaterial color="#4285F4" metalness={0.2} roughness={0.8} />
        </mesh>
        <mesh position={[0, -10, -5.125]} receiveShadow castShadow>
          <boxGeometry args={[10.5, 20, 0.25]} />
          <meshStandardMaterial color="#4285F4" metalness={0.2} roughness={0.8} />
        </mesh>
        <mesh position={[0, -10, 5.125]} receiveShadow castShadow>
          <boxGeometry args={[10.5, 20, 0.25]} />
          <meshStandardMaterial color="#4285F4" metalness={0.2} roughness={0.8} />
        </mesh>
        {/* Base Bottom */}
        <mesh position={[0, -19.875, 0]} receiveShadow castShadow>
          <boxGeometry args={[10.5, 0.25, 10.5]} />
          <meshStandardMaterial color="#4285F4" metalness={0.2} roughness={0.8} />
        </mesh>

        {/* Playfield Floor (with hole for chute) */}
        <mesh position={[1.5, 0, 0]} receiveShadow castShadow>
          <boxGeometry args={[7, 0.5, 10]} />
          <meshStandardMaterial color="#e0e0e0" metalness={0.2} roughness={0.8} />
        </mesh>
        <mesh position={[-3.5, 0, -1.5]} receiveShadow castShadow>
          <boxGeometry args={[3, 0.5, 7]} />
          <meshStandardMaterial color="#e0e0e0" metalness={0.2} roughness={0.8} />
        </mesh>
      </RigidBody>
      
      {/* Roof */}
      <RigidBody type="fixed" friction={0.5}>
        <mesh position={[0, 10.25, 0]} receiveShadow castShadow>
          <boxGeometry args={[10.5, 0.5, 10.5]} />
          <meshStandardMaterial color="#4285F4" metalness={0.4} roughness={0.6} />
        </mesh>
      </RigidBody>

      {/* Pillars */}
      {[-5.125, 5.125].map(x => 
        [-5.125, 5.125].map(z => (
          <mesh key={`${x}-${z}`} position={[x, 5, z]} receiveShadow castShadow>
            <boxGeometry args={[0.25, 10, 0.25]} />
            <meshStandardMaterial color="#4285F4" metalness={0.5} roughness={0.5} />
          </mesh>
        ))
      )}

      {/* Glass Walls */}
      <RigidBody type="fixed" friction={0.5}>
        <mesh position={[-5.25, 5, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.1, 10, 10]} />
          <meshPhysicalMaterial transparent opacity={0.3} roughness={0} transmission={0.9} thickness={0.1} side={THREE.DoubleSide} color="#ffffff" clearcoat={1} />
        </mesh>
        <mesh position={[5.25, 5, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.1, 10, 10]} />
          <meshPhysicalMaterial transparent opacity={0.3} roughness={0} transmission={0.9} thickness={0.1} side={THREE.DoubleSide} color="#ffffff" clearcoat={1} />
        </mesh>
        <mesh position={[0, 5, -5.25]} receiveShadow castShadow>
          <boxGeometry args={[10, 10, 0.1]} />
          <meshPhysicalMaterial transparent opacity={0.3} roughness={0} transmission={0.9} thickness={0.1} side={THREE.DoubleSide} color="#ffffff" clearcoat={1} />
        </mesh>
        <mesh position={[0, 5, 5.25]} receiveShadow castShadow>
          <boxGeometry args={[10, 10, 0.1]} />
          <meshPhysicalMaterial transparent opacity={0.3} roughness={0} transmission={0.9} thickness={0.1} side={THREE.DoubleSide} color="#ffffff" clearcoat={1} />
        </mesh>
        
        {/* Invisible thick boundaries to prevent clipping */}
        <mesh position={[-6.2, 5, 0]} visible={false}>
          <boxGeometry args={[2, 12, 12]} />
        </mesh>
        <mesh position={[6.2, 5, 0]} visible={false}>
          <boxGeometry args={[2, 12, 12]} />
        </mesh>
        <mesh position={[0, 5, -6.2]} visible={false}>
          <boxGeometry args={[12, 12, 2]} />
        </mesh>
        <mesh position={[0, 5, 6.2]} visible={false}>
          <boxGeometry args={[12, 12, 2]} />
        </mesh>
        <mesh position={[0, 11, 0]} visible={false}>
          <boxGeometry args={[12, 2, 12]} />
        </mesh>
        
        {/* Chute Walls */}
        <mesh position={[-1.9, 1.75, 3.5]} receiveShadow castShadow>
          <boxGeometry args={[0.2, 3, 3]} />
          <meshStandardMaterial color="#9AA0A6" metalness={0.2} roughness={0.8} />
        </mesh>
        <mesh position={[-3.5, 1.75, 1.9]} receiveShadow castShadow>
          <boxGeometry args={[3, 3, 0.2]} />
          <meshStandardMaterial color="#9AA0A6" metalness={0.2} roughness={0.8} />
        </mesh>
      </RigidBody>
    </group>
  );
};
