/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore, prizeRefs } from '../store';

export const Claw = ({ isLocal }: { isLocal: boolean }) => {
  const clawState = useGameStore(state => state.clawState);
  const updateClaw = useGameStore(state => state.updateClaw);
  const endTurn = useGameStore(state => state.endTurn);
  const myId = useGameStore(state => state.myId);
  const activePlayer = useGameStore(state => state.activePlayer);
  const players = useGameStore(state => state.players);
  
  const playerIds = Object.keys(players);
  const isPhysicsHost = (activePlayer === myId && myId !== null) || (!activePlayer && playerIds[0] === myId);
  
  const groupRef = useRef<THREE.Group>(null);
  const baseRef = useRef<any>(null);
  const prongsRef = [useRef<any>(null), useRef<any>(null), useRef<any>(null), useRef<any>(null)];
  const crossbarRef = useRef<THREE.Mesh>(null);
  const carriageRef = useRef<THREE.Group>(null);
  const stringRef = useRef<THREE.Mesh>(null);
  
  const localState = useRef({
    x: 0, y: 8, z: 0,
    state: 'idle', // idle, dropping, closing, raising, returning, opening
    prongsClosed: false,
    timer: 0,
    grabbedPrizeId: null as string | null
  });

  const keys = useRef({ w: false, a: false, s: false, d: false, space: false });
  const lastEmit = useRef(0);
  
  useEffect(() => {
    if (!isLocal) return;
    const down = (e: KeyboardEvent) => {
      if(e.key === 'w' || e.key === 'ArrowUp') keys.current.w = true;
      if(e.key === 's' || e.key === 'ArrowDown') keys.current.s = true;
      if(e.key === 'a' || e.key === 'ArrowLeft') keys.current.a = true;
      if(e.key === 'd' || e.key === 'ArrowRight') keys.current.d = true;
      if(e.key === ' ') {
         if (localState.current.state === 'idle') {
           localState.current.state = 'dropping';
           updateClaw({ state: 'dropping' });
         }
      }
    };
    const up = (e: KeyboardEvent) => {
      if(e.key === 'w' || e.key === 'ArrowUp') keys.current.w = false;
      if(e.key === 's' || e.key === 'ArrowDown') keys.current.s = false;
      if(e.key === 'a' || e.key === 'ArrowLeft') keys.current.a = false;
      if(e.key === 'd' || e.key === 'ArrowRight') keys.current.d = false;
      
      // Ensure final position is sent when keys are released
      if (!keys.current.w && !keys.current.s && !keys.current.a && !keys.current.d) {
        updateClaw({ x: localState.current.x, z: localState.current.z });
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    
    const forceDrop = () => {
      if (localState.current.state === 'idle') {
        localState.current.state = 'dropping';
        updateClaw({ state: 'dropping' });
      }
    };
    window.addEventListener('force_drop', forceDrop);
    
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('force_drop', forceDrop);
    };
  }, [isLocal, updateClaw]);

  useFrame((state, delta) => {
    if (isLocal) {
      const ls = localState.current;
      const speed = 5 * delta;
      
      if (ls.state === 'idle') {
        if (keys.current.w) ls.z -= speed;
        if (keys.current.s) ls.z += speed;
        if (keys.current.a) ls.x -= speed;
        if (keys.current.d) ls.x += speed;
        
        ls.x = THREE.MathUtils.clamp(ls.x, -4.5, 4.5);
        ls.z = THREE.MathUtils.clamp(ls.z, -4.5, 4.5);
        
        if (keys.current.w || keys.current.s || keys.current.a || keys.current.d) {
          if (state.clock.elapsedTime - lastEmit.current > 0.05) { // Throttle to ~20fps
            updateClaw({ x: ls.x, z: ls.z });
            lastEmit.current = state.clock.elapsedTime;
          }
        }
      }
      else if (ls.state === 'dropping') {
        ls.y -= 6 * delta;
        if (ls.y <= 2.5) {
          ls.y = 2.5;
          ls.state = 'closing';
          ls.timer = 0;
          updateClaw({ y: ls.y, state: 'closing' });
        }
      }
      else if (ls.state === 'closing') {
        ls.prongsClosed = true;
        ls.timer += delta;
        
        if (!ls.grabbedPrizeId) {
          let closestPrize = null;
          let minDistance = 1.5; // Snap radius
          
          useGameStore.getState().prizes.forEach(p => {
            const dx = p.position[0] - ls.x;
            const dy = p.position[1] - (ls.y - 1.2);
            const dz = p.position[2] - ls.z;
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            if (dist < minDistance) {
              minDistance = dist;
              closestPrize = p;
            }
          });
          
          if (closestPrize) {
            ls.grabbedPrizeId = closestPrize.id;
            updateClaw({ grabbedPrizeId: closestPrize.id });
          }
        }

        if (ls.timer > 1) {
          ls.state = 'raising';
          updateClaw({ state: 'raising', prongsClosed: true, grabbedPrizeId: ls.grabbedPrizeId });
        }
      }
      else if (ls.state === 'raising') {
        ls.y += 4 * delta;
        if (ls.y >= 8) {
          ls.y = 8;
          ls.state = 'returning';
          updateClaw({ y: ls.y, state: 'returning' });
        }
      }
      else if (ls.state === 'returning') {
        ls.x = THREE.MathUtils.lerp(ls.x, -3.5, 3 * delta);
        ls.z = THREE.MathUtils.lerp(ls.z, 3.5, 3 * delta);
        if (Math.abs(ls.x - -3.5) < 0.1 && Math.abs(ls.z - 3.5) < 0.1) {
          ls.state = 'opening';
          ls.timer = 0;
          updateClaw({ x: ls.x, z: ls.z, state: 'opening' });
        }
      }
      else if (ls.state === 'opening') {
        ls.prongsClosed = false;
        if (ls.grabbedPrizeId) {
          ls.grabbedPrizeId = null;
          updateClaw({ grabbedPrizeId: null });
        }
        ls.timer += delta;
        if (ls.timer > 3.0) {
          ls.state = 'idle';
          updateClaw({ state: 'idle', prongsClosed: false });
        }
      }

      const pos = new THREE.Vector3(ls.x, ls.y, ls.z);
      if (baseRef.current) {
        baseRef.current.setNextKinematicTranslation(pos);
      }

      if (ls.grabbedPrizeId) {
        const prizeRef = prizeRefs[ls.grabbedPrizeId];
        if (prizeRef) {
          try {
            prizeRef.setNextKinematicTranslation(new THREE.Vector3(ls.x, ls.y - 1.2, ls.z));
          } catch (e) {}
        }
      }
      
      const targetAngle = ls.prongsClosed ? -Math.PI/8 : Math.PI/3;
      prongsRef.forEach((ref, i) => {
         if (ref.current) {
            const angle = (i * Math.PI) / 2;
            // Changed offset to attach directly to the edge of the cylinder (radius 0.6)
            const offset = new THREE.Vector3(Math.cos(angle)*0.55, -0.2, Math.sin(angle)*0.55);
            ref.current.setNextKinematicTranslation(pos.clone().add(offset));
            
            const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -angle - Math.PI/2);
            quat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), targetAngle));
            
            const currentQuat = ref.current.rotation();
            const threeQuat = new THREE.Quaternion(currentQuat.x, currentQuat.y, currentQuat.z, currentQuat.w);
            threeQuat.slerp(quat, 10 * delta);
            ref.current.setNextKinematicRotation(threeQuat);
         }
      });
    } else if (isPhysicsHost) {
      if (baseRef.current) {
        const currentPos = baseRef.current.translation();
        const targetPos = new THREE.Vector3(clawState.x, clawState.y, clawState.z);
        const newPos = new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z).lerp(targetPos, 10 * delta);
        baseRef.current.setNextKinematicTranslation(newPos);
        
        const targetAngle = clawState.prongsClosed ? -Math.PI/8 : Math.PI/3;
        prongsRef.forEach((ref, i) => {
           if (ref.current) {
              const angle = (i * Math.PI) / 2;
              const offset = new THREE.Vector3(Math.cos(angle)*0.55, -0.2, Math.sin(angle)*0.55);
              ref.current.setNextKinematicTranslation(newPos.clone().add(offset));
              
              const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -angle - Math.PI/2);
              quat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), targetAngle));
              
              const currentQuat = ref.current.rotation();
              const threeQuat = new THREE.Quaternion(currentQuat.x, currentQuat.y, currentQuat.z, currentQuat.w);
              threeQuat.slerp(quat, 10 * delta);
              ref.current.setNextKinematicRotation(threeQuat);
           }
        });
      }
    } else {
      if (baseRef.current) {
        const currentPos = baseRef.current.translation();
        const targetPos = new THREE.Vector3(clawState.x, clawState.y, clawState.z);
        const newPos = new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z).lerp(targetPos, 10 * delta);
        baseRef.current.setNextKinematicTranslation(newPos);
        
        const targetAngle = clawState.prongsClosed ? -Math.PI/8 : Math.PI/3;
        prongsRef.forEach((ref, i) => {
           if (ref.current) {
              const angle = (i * Math.PI) / 2;
              const offset = new THREE.Vector3(Math.cos(angle)*0.55, -0.2, Math.sin(angle)*0.55);
              ref.current.setNextKinematicTranslation(newPos.clone().add(offset));
              
              const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -angle - Math.PI/2);
              quat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), targetAngle));
              
              const currentQuat = ref.current.rotation();
              const threeQuat = new THREE.Quaternion(currentQuat.x, currentQuat.y, currentQuat.z, currentQuat.w);
              threeQuat.slerp(quat, 10 * delta);
              ref.current.setNextKinematicRotation(threeQuat);
           }
        });
      }
    }

    const cx = isLocal ? localState.current.x : (baseRef.current ? baseRef.current.translation().x : clawState.x);
    const cy = isLocal ? localState.current.y : (baseRef.current ? baseRef.current.translation().y : clawState.y);
    const cz = isLocal ? localState.current.z : (baseRef.current ? baseRef.current.translation().z : clawState.z);

    if (crossbarRef.current) {
      crossbarRef.current.position.set(0, 10, cz);
    }
    if (carriageRef.current) {
      carriageRef.current.position.set(cx, 10, cz);
    }
    if (stringRef.current) {
      stringRef.current.position.set(cx, (10 + cy) / 2, cz);
      stringRef.current.scale.set(1, Math.max(0.01, 10 - cy), 1);
    }
  });

  const gantryJSX = (
    <group>
      {/* Rails on the ceiling */}
      <mesh position={[-4.8, 10, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2, 0.2, 10]} />
        <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[4.8, 10, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2, 0.2, 10]} />
        <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Crossbar connecting the two rails */}
      <mesh ref={crossbarRef} castShadow receiveShadow>
        <boxGeometry args={[9.8, 0.25, 0.25]} />
        <meshStandardMaterial color="#444" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* The carriage mechanism that moves with the claw */}
      <group ref={carriageRef}>
        {/* Motor/Carriage housing */}
        <mesh position={[0, -0.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.2, 0.6, 1.2]} />
          <meshStandardMaterial color="#222" metalness={0.6} roughness={0.4} />
        </mesh>
        {/* Spool */}
        <mesh position={[0, -0.2, 0.65]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.8, 16]} />
          <meshStandardMaterial color="#EA4335" metalness={0.3} roughness={0.7} />
        </mesh>
      </group>

      {/* Cable dropping down */}
      <mesh ref={stringRef} castShadow receiveShadow>
        <cylinderGeometry args={[0.02, 0.02, 1, 8]} />
        <meshStandardMaterial color="#111" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );

  return (
    <group>
      {gantryJSX}
      <RigidBody ref={baseRef} type="kinematicPosition" colliders="hull">
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.6, 0.6, 0.5, 16]} />
          <meshStandardMaterial color="#444" metalness={0.8} roughness={0.2} />
        </mesh>
      </RigidBody>
      {prongsRef.map((ref, i) => (
        <RigidBody key={i} ref={ref} type="kinematicPosition" colliders={false} friction={0.1}>
          <CuboidCollider args={[0.1, 0.8, 0.05]} position={[0, -0.8, 0]} friction={0.1} />
          <CuboidCollider args={[0.1, 0.05, 0.25]} position={[0, -1.55, 0.2]} friction={0.1} />
          <group>
            <mesh position={[0, -0.8, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.2, 1.6, 0.1]} />
              <meshStandardMaterial color="#EA4335" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[0, -1.55, 0.2]} castShadow receiveShadow>
              <boxGeometry args={[0.2, 0.1, 0.5]} />
              <meshStandardMaterial color="#EA4335" metalness={0.8} roughness={0.2} />
            </mesh>
          </group>
        </RigidBody>
      ))}
    </group>
  );
};
