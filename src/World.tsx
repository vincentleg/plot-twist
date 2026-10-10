import { Component, type ReactNode, useMemo, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import type { Mission } from '../shared/types';
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="scene-fallback">3D is unavailable on this device. Mission details remain available.</div> : this.props.children; }
}
function Architecture() {
  const edges = useMemo(() => { const box = new THREE.BoxGeometry(1, 1, 1); const result = new THREE.EdgesGeometry(box); box.dispose(); return result; }, []);
  const material = useMemo(() => new THREE.LineBasicMaterial({ color: '#216771', transparent: true, opacity: .65 }), []);
  useEffect(() => () => { edges.dispose(); material.dispose(); }, [edges, material]);
  return <group>{[[-6, 2, -4, 2, 4, 2], [-3.8, 1.3, -7, 1.7, 2.6, 2], [0, 2.8, -9, 2, 5.6, 2], [4.2, 2, -6, 2, 4, 2], [7, 1.5, -2, 2, 3, 2], [-7, .6, 1, 2, 1.2, 2], [5.5, .6, 3, 2, 1.2, 2]].map(([x,y,z,w,h,d], i) => <lineSegments key={i} geometry={edges} material={material} position={[x,y,z]} scale={[w,h,d]} />)}</group>;
}
function Scout() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (ref.current) ref.current.position.y = 1.05 + Math.sin(clock.elapsedTime * 1.5) * .09; });
  return <group ref={ref} position={[-2.2, 1.05, 2]} rotation={[0,.35,0]}>
    <mesh><octahedronGeometry args={[.48, 0]} /><meshStandardMaterial color="#173a43" metalness={.65} roughness={.35} /></mesh>
    <mesh position={[0, .04, .35]}><boxGeometry args={[.34, .085, .09]} /><meshBasicMaterial color="#a1fff1" /></mesh>
    <mesh position={[0,-.62,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.31,.34,32]} /><meshBasicMaterial color="#56d7ce" side={THREE.DoubleSide} /></mesh>
  </group>;
}
function Gateway() {
  return <group position={[0,0,-1]}>
    <mesh position={[0,.12,0]}><cylinderGeometry args={[2.3,2.5,.24,6]} /><meshStandardMaterial color="#142731" /></mesh>
    <mesh position={[0,2.05,0]}><torusGeometry args={[1.75,.075,8,6]} /><meshStandardMaterial color="#64a4b1" emissive="#174454" emissiveIntensity={.45} metalness={.7} roughness={.3} /></mesh>
    <mesh position={[0,2.05,0]}><circleGeometry args={[1.68,6]} /><meshStandardMaterial color="#0e1d29" side={THREE.DoubleSide} metalness={.6} roughness={.4} /></mesh>
    <mesh position={[0,2.05,.03]}><boxGeometry args={[.035,2.7,.04]} /><meshBasicMaterial color="#bf9660" /></mesh>
    <mesh position={[0,2.05,.08]}><octahedronGeometry args={[.17]} /><meshBasicMaterial color="#e6ba7d" /></mesh>
  </group>;
}
export default function World({ mission }: { mission: Mission | null }) {
  return <section className="world" aria-label="Interactive 3D world, awaiting analysis">
    <div className="world-top"><span className="eyebrow">LIVE ENVIRONMENT / LA TRAME</span><span className="world-state">◌ {mission ? 'Awaiting analysis' : 'Awaiting mission'}</span></div>
    <SceneBoundary><Canvas style={{ position: 'absolute', inset: 0 }} dpr={[1,1.5]} camera={{ position: [9,7,11], fov: 44 }} gl={{ antialias: true }}><color attach="background" args={['#080f17']} /><fog attach="fog" args={['#080f17',16,36]} /><ambientLight intensity={.7} /><directionalLight position={[4,8,5]} intensity={2} color="#a5e7f4" /><Grid args={[50,50]} cellSize={1} cellThickness={.5} cellColor="#17313b" sectionSize={5} sectionThickness={.8} sectionColor="#28505a" fadeDistance={30} infiniteGrid /><Architecture /><Gateway /><Scout /><OrbitControls makeDefault minDistance={5} maxDistance={23} maxPolarAngle={Math.PI/2-.08} target={[0,1,0]} /></Canvas></SceneBoundary>
    <div className="world-bottom"><div><span className="eyebrow">SCOUT / STANDBY</span><p>No analysis. No active permits.</p></div><span className="controls">Drag to orbit · Scroll to zoom</span></div>
  </section>;
}
