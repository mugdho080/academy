/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { GameScene } from './components/GameScene';
import { UI } from './components/UI';
import { useGameStore } from './store';

export default function App() {
  const connect = useGameStore(state => state.connect);

  useEffect(() => {
    connect();
  }, [connect]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-black">
      <GameScene />
      <UI />
    </div>
  );
}
