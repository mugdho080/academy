/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore, prizeRefs } from '../store';
import { Bugdroid } from './Bugdroid';

const GeometryMap: Record<string, any> = {
  box: <boxGeometry args={[0.8, 0.8, 0.8]} />,
  sphere: <sphereGeometry args={[0.5, 16, 16]} />,
  dodecahedron: <dodecahedronGeometry args={[0.6]} />
};

const StaticPrize = ({ prize }: { prize: any }) => {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (ref.current) {
      ref.current.position.lerp(new THREE.Vector3(...prize.position), 0.2);
      const targetRot = new THREE.Quaternion(...prize.rotation);
      ref.current.quaternion.slerp(targetRot, 0.2);
    }
  });
  return (
    <mesh ref={ref} position={prize.position} rotation={new THREE.Euler().setFromQuaternion(new THREE.Quaternion(...prize.rotation))} castShadow receiveShadow>
      {GeometryMap[prize.type]}
      <meshStandardMaterial color={prize.color} metalness={0.5} roughness={0.1} envMapIntensity={1} />
    </mesh>
  );
};

export const Prizes = ({ isLocal }: { isLocal: boolean }) => {
  const prizes = useGameStore(state => state.prizes);
  const clawState = useGameStore(state => state.clawState);
  const updatePrizes = useGameStore(state => state.updatePrizes);
  const capturePrize = useGameStore(state => state.capturePrize);
  const myId = useGameStore(state => state.myId);
  const activePlayer = useGameStore(state => state.activePlayer);
  const players = useGameStore(state => state.players);
  
  const playerIds = Object.keys(players);
  const isPhysicsHost = (activePlayer === myId && myId !== null) || (!activePlayer && playerIds[0] === myId);

  const dynamicRefs = useRef<Record<string, any>>({});
  const capturedPrizes = useRef<Set<string>>(new Set());

  useFrame((state) => {
    if (isPhysicsHost) {
      if (state.clock.elapsedTime % 0.1 < 0.02) {
        const updates: any[] = [];
        prizes.forEach(prize => {
          const ref = dynamicRefs.current[prize.id];
          if (ref && typeof ref.translation === 'function') {
            try {
              const p = ref.translation();
              
              if (p.y < -0.5 && !capturedPrizes.current.has(prize.id)) {
                capturedPrizes.current.add(prize.id);
                capturePrize(prize.id);
              } else {
                const r = ref.rotation();
                updates.push({ id: prize.id, position: [p.x, p.y, p.z], rotation: [r.x, r.y, r.z, r.w] });
              }
            } catch (e) {
              // Ignore errors from destroyed bodies
            }
          }
        });
        if (updates.length > 0) {
          updatePrizes(updates);
        }
      }
    } else {
      prizes.forEach(prize => {
        const ref = dynamicRefs.current[prize.id];
        if (ref && typeof ref.translation === 'function') {
          try {
            const current = ref.translation();
            const target = new THREE.Vector3(...prize.position);
            if (target.distanceTo(current) > 0.5) {
              ref.setTranslation(target, true);
              ref.setRotation(new THREE.Quaternion(...prize.rotation), true);
            } else if (target.distanceTo(current) > 0.05) {
              const newPos = new THREE.Vector3(current.x, current.y, current.z).lerp(target, 0.2);
              ref.setTranslation(newPos, true);
              const currentRot = new THREE.Quaternion(ref.rotation().x, ref.rotation().y, ref.rotation().z, ref.rotation().w);
              const targetRot = new THREE.Quaternion(...prize.rotation);
              const newRot = currentRot.slerp(targetRot, 0.2);
              ref.setRotation(newRot, true);
            }
          } catch (e) {
            // Ignore errors from destroyed bodies
          }
        }
      });
    }
  });

  return (
    <group>
      {prizes.map(p => {
        const euler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(...p.rotation));
        return (
          <RigidBody 
            key={p.id} 
            name={p.id}
            ref={(el) => { 
              if (el) {
                dynamicRefs.current[p.id] = el; 
                prizeRefs[p.id] = el; 
              } else {
                delete dynamicRefs.current[p.id];
                delete prizeRefs[p.id];
              }
            }}
            type={clawState.grabbedPrizeId === p.id ? "kinematicPosition" : (isPhysicsHost ? "dynamic" : "kinematicPosition")} 
            position={p.position} 
            rotation={[euler.x, euler.y, euler.z]} 
            colliders="hull" 
            mass={1} 
            friction={0.1}
            userData={{ id: p.id }}
          >
            {p.type === 'bugdroid' ? (
              <Bugdroid scale={0.35} position={[0, -0.8, 0]} />
            ) : (
              <mesh userData={{ id: p.id }} castShadow receiveShadow>
                {GeometryMap[p.type]}
                <meshStandardMaterial color={p.color} metalness={0.5} roughness={0.1} envMapIntensity={1} />
              </mesh>
            )}
          </RigidBody>
        );
      })}
    </group>
  );
};
