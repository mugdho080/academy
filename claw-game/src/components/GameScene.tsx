/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { Canvas, useThree } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Environment, PerspectiveCamera } from '@react-three/drei';
import { ClawMachine } from './ClawMachine';
import { Claw } from './Claw';
import { Prizes } from './Prizes';
import { Bugdroid } from './Bugdroid';
import { useGameStore } from '../store';
import { useEffect } from 'react';

const CameraSetup = ({ isLocal }: { isLocal: boolean }) => {
  const { camera } = useThree();

  useEffect(() => {
    if (isLocal) {
      // Front view when playing
      camera.position.set(0, 8, 26);
    } else {
      // Diagonal view when spectating
      camera.position.set(18, 8, 18);
    }
    camera.lookAt(0, 4, 0);
  }, [isLocal, camera]);

  return null;
};

export const GameScene = () => {
  const activePlayer = useGameStore(state => state.activePlayer);
  const myId = useGameStore(state => state.myId);
  const isLocal = activePlayer === myId && myId !== null;

  return (
    <Canvas shadows>
      <PerspectiveCamera makeDefault position={[18, 8, 22]} fov={45} />
      <CameraSetup isLocal={isLocal} />
      <ambientLight intensity={2.5} />
      <pointLight position={[0, 9, 0]} intensity={4.0} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0001} />

      <Physics>
        <ClawMachine />
        <Claw isLocal={isLocal} />
        <Prizes isLocal={isLocal} />
      </Physics>

      <Bugdroid position={[0, 10.5, 0]} rotation={[0, Math.PI / 4, 0]} scale={0.6} />

      <Environment files="/google-office.jpg" background blur={0.02} environmentIntensity={1.5} backgroundRotation={[0, Math.PI * 0.725, 0]} environmentRotation={[0, Math.PI * 1.2, 0]} />
    </Canvas>
  );
};
