import { Play, Pause, FastForward, Info, X } from 'lucide-react';
import { useStore } from '../store';

export function UI() {
  const timeScale = useStore((state) => state.timeScale);
  const setTimeScale = useStore((state) => state.setTimeScale);
  const isPaused = useStore((state) => state.isPaused);
  const setIsPaused = useStore((state) => state.setIsPaused);
  const selectedStar = useStore((state) => state.selectedStar);
  const setSelectedStar = useStore((state) => state.setSelectedStar);
  const selectedStarAge = useStore((state) => state.selectedStarAge);
  const selectedStarMass = useStore((state) => state.selectedStarMass);
  const cameraMode = useStore((state) => state.cameraMode);
  const setCameraMode = useStore((state) => state.setCameraMode);

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-6 text-white font-sans">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-light tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
            The Cosmos Maker
          </h1>
          <p className="text-sm text-gray-400 mt-1 tracking-wider">Ultra-Realistic Galaxy Formation Simulator</p>
        </div>
      </header>

      <div className="flex justify-between items-end">
        {/* Time Controls */}
        <div className="pointer-events-auto bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-xl flex flex-col gap-4 w-64">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-gray-400">Chronos Control</span>
            <span className="text-xs font-mono text-blue-400">{timeScale.toFixed(1)}x</span>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsPaused(!isPaused)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              {isPaused ? <Play size={18} /> : <Pause size={18} />}
            </button>
            
            <input 
              type="range" 
              min="0.1" 
              max="10" 
              step="0.1" 
              value={timeScale}
              onChange={(e) => setTimeScale(parseFloat(e.target.value))}
              className="flex-1 accent-blue-500"
            />
            
            <button 
              onClick={() => setTimeScale(10)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              title="Fast Forward"
            >
              <FastForward size={18} />
            </button>
          </div>
        </div>

        {/* Star Info Panel */}
        {selectedStar && (
          <div className="pointer-events-auto bg-black/60 backdrop-blur-xl border border-white/20 p-6 rounded-2xl w-80 transform transition-all duration-500 translate-x-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Info size={20} className="text-blue-400" />
                <h2 className="text-lg font-medium tracking-wide">Stellar Data</h2>
              </div>
              <button 
                onClick={() => {
                  setSelectedStar(null);
                  setCameraMode('free');
                }}
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={16} className="text-gray-400 hover:text-white" />
              </button>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-gray-400">ID</span>
                <span className="font-mono">{selectedStar.id}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-gray-400">Class</span>
                <span className="font-mono font-bold" style={{ color: getSpectralColor(selectedStar.spectralClass) }}>
                  {selectedStar.spectralClass}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-gray-400">Mass</span>
                <span className="font-mono">{(selectedStarMass || selectedStar.mass).toFixed(2)} M☉</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-gray-400">Age</span>
                <span className="font-mono">
                  {selectedStarAge?.toFixed(0) || selectedStar.age.toFixed(0)} Myr
                </span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-gray-400">Phase</span>
                <span className="font-mono text-xs uppercase text-right">
                  {(() => {
                    const age = selectedStarAge || selectedStar.age;
                    const mass = selectedStarMass || selectedStar.mass;
                    const lifespan = 1000 / mass;
                    if (mass >= 20.0) {
                      return mass < 20.2 ? <span className="text-white font-bold animate-pulse">SUPERNOVA</span> : <span className="text-gray-600">Remnant</span>;
                    } else if (mass > 8 && age > lifespan) {
                      return age < lifespan + 2.0 ? <span className="text-white font-bold animate-pulse">SUPERNOVA</span> : <span className="text-gray-600">Remnant</span>;
                    } else if (age / lifespan > 0.9 && age <= lifespan) {
                      return <span className="text-red-400">Red Giant</span>;
                    } else if (age > lifespan && mass <= 8) {
                      return <span className="text-blue-200">White Dwarf</span>;
                    }
                    return <span className="text-yellow-100">Main Sequence</span>;
                  })()}
                </span>
              </div>
            </div>

            <button
              onClick={() => setCameraMode(cameraMode === 'free' ? 'follow' : 'free')}
              className="mt-4 w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium tracking-wide transition-colors"
            >
              {cameraMode === 'free' ? 'Follow Star' : 'Stop Following'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function getSpectralColor(cls: string) {
  switch (cls) {
    case 'O': return '#9bb0ff';
    case 'B': return '#aabfff';
    case 'A': return '#ffffff';
    case 'F': return '#fff4e8';
    case 'G': return '#ffddb4';
    case 'K': return '#ffbd6f';
    case 'M': return '#ff9d3f';
    default: return '#ffffff';
  }
}
