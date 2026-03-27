/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Scene } from './components/Scene';
import { UI } from './components/UI';

export default function App() {
  return (
    <div className="w-full h-screen bg-black overflow-hidden relative">
      <Scene />
      <UI />
    </div>
  );
}
