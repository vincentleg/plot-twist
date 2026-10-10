import { Component, type ReactNode, useMemo, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Mission, PermitStatus } from '../shared/types';
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="scene-fallback">3D is unavailable on this device. Mission details remain available.</div> : this.props.children; }
}
function Architecture() {
  const edges = useMemo(() => { const box = new THREE.BoxGeometry(1, 1, 1); const result = new THREE.EdgesGeometry(box); box.dispose(); return result; }, []);
  const material = useMemo(() => new THREE.LineBasicMaterial({ color: '#3fd8e8', transparent: true, opacity: .8 }), []);
  useEffect(() => () => { edges.dispose(); material.dispose(); }, [edges, material]);
  return <group>{[[-6, 2, -4, 2, 4, 2], [-3.8, 1.3, -7, 1.7, 2.6, 2], [0, 2.8, -9, 2, 5.6, 2], [4.2, 2, -6, 2, 4, 2], [7, 1.5, -2, 2, 3, 2], [-7, .6, 1, 2, 1.2, 2], [5.5, .6, 3, 2, 1.2, 2]].map(([x,y,z,w,h,d], i) => <lineSegments key={i} geometry={edges} material={material} position={[x,y,z]} scale={[w,h,d]} />)}</group>;
}
const archX = (index: number, count: number) => (index - (count - 1) / 2) * 2.6;
// Scout walks the plan in order and halts in front of the first action the server has not made ACTIVE.
function scoutTarget(mission: Mission | null): [number, number] {
  const plan = mission?.actions.filter(a => a.kind !== 'FINALIZE') ?? [];
  if (!plan.length) return [-2.2, 3];
  if (mission?.gateway.state === 'OPEN') return [0, -1];
  const stop = plan.findIndex(a => a.permit?.status !== 'ACTIVE');
  return stop === -1 ? [0, 1.4] : [archX(stop, plan.length), 1.2];
}
function Scout({ mission }: { mission: Mission | null }) {
  const ref = useRef<THREE.Group>(null);
  const [tx, tz] = scoutTarget(mission);
  useFrame(({ clock }, delta) => { const g = ref.current; if (!g) return; g.position.x += (tx - g.position.x) * Math.min(1, delta * 1.6); g.position.z += (tz - g.position.z) * Math.min(1, delta * 1.6); g.position.y = 1.05 + Math.sin(clock.elapsedTime * 1.5) * .09; });
  return <group ref={ref} position={[-2.2, 1.05, 3]} rotation={[0,.35,0]}>
    <mesh><octahedronGeometry args={[.48, 0]} /><meshStandardMaterial color="#173a43" metalness={.65} roughness={.35} /></mesh>
    <mesh position={[0, .04, .35]}><boxGeometry args={[.34, .085, .09]} /><meshBasicMaterial color="#a1fff1" /></mesh>
    <mesh position={[0,-.62,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.31,.34,32]} /><meshBasicMaterial color="#56d7ce" side={THREE.DoubleSide} /></mesh>
  </group>;
}
function Gateway({ open }: { open: boolean }) {
  return <group position={[0,0,-3.2]}>
    <mesh position={[0,.12,0]}><cylinderGeometry args={[2.3,2.5,.24,6]} /><meshStandardMaterial color="#142731" /></mesh>
    <mesh position={[0,2.05,0]}><torusGeometry args={[1.75,.075,8,6]} /><meshStandardMaterial color={open ? '#81e9c0' : '#64a4b1'} emissive={open ? '#2f9f7c' : '#174454'} emissiveIntensity={open ? 1.2 : .45} metalness={.7} roughness={.3} /></mesh>
    {!open && <mesh position={[0,2.05,0]}><circleGeometry args={[1.68,6]} /><meshStandardMaterial color="#0e1d29" side={THREE.DoubleSide} metalness={.6} roughness={.4} /></mesh>}
    {!open && <mesh position={[0,2.05,.03]}><boxGeometry args={[.035,2.7,.04]} /><meshBasicMaterial color="#bf9660" /></mesh>}
    <mesh position={[0,2.05,.08]}><octahedronGeometry args={[.17]} /><meshBasicMaterial color={open ? '#81e9c0' : '#e6ba7d'} /></mesh>
  </group>;
}
const permitColors: Record<PermitStatus, string> = { ACTIVE: '#7ce0c4', SUSPENDED: '#d3ac69', BLOCKED: '#dc7777', NEEDS_HUMAN: '#ad96e5' };
const label = (status: PermitStatus) => status === 'NEEDS_HUMAN' ? 'NEEDS HUMAN' : status;
function ActionArches({ mission }: { mission: Mission | null }) {
  const geometry = useMemo(() => new THREE.TorusGeometry(.8, .07, 8, 6, Math.PI), []);
  const materials = useMemo(() => Object.fromEntries(Object.entries(permitColors).map(([key, color]) => [key, new THREE.MeshBasicMaterial({ color })])) as Record<PermitStatus, THREE.MeshBasicMaterial>, []);
  useEffect(() => () => { geometry.dispose(); Object.values(materials).forEach(material => material.dispose()); }, [geometry, materials]);
  const plan = mission?.actions.filter(a => a.kind !== 'FINALIZE') ?? [];
  return <group>{plan.map((action, index) => action.permit && <group key={action.id} position={[archX(index, plan.length), 0, .4]}>
    <mesh geometry={geometry} material={materials[action.permit.status]} />
    <Html position={[0, 1.25, 0]} center zIndexRange={[5, 0]}><div className="scene-label" style={{ color: permitColors[action.permit.status] }}>{action.id} · {action.kind}<small>{label(action.permit.status)}</small></div></Html>
  </group>)}</group>;
}
const evidenceColor = (state: string) => state === 'VERIFIED' ? '#7ce0c4' : state === 'MASKED' ? '#dc7777' : '#d3ac69';
// One crystal per report excerpt: teal = provenance matched, red = masked in an experiment.
function EvidenceCrystals({ mission, selected, onSelect }: { mission: Mission | null; selected: string; onSelect: (id: string) => void }) {
  const items = mission?.evidence ?? [];
  return <group position={[0, 0, 4.6]}>{items.map((e, i) => { const x = (i - (items.length - 1) / 2) * .8; return <group key={e.id} position={[x, .45, 0]}>
    <mesh onClick={event => { event.stopPropagation(); onSelect(e.id === selected ? '' : e.id); }} onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }} scale={e.id === selected ? 1.6 : 1}><octahedronGeometry args={[e.state === 'VERIFIED' ? .2 : .14]} /><meshBasicMaterial color={evidenceColor(e.state)} wireframe={e.state !== 'VERIFIED'} /></mesh>
    <Html position={[0, -.42, 0]} center zIndexRange={[4, 0]} distanceFactor={14}><div className="scene-label" style={{ color: evidenceColor(e.state), padding: '1px 4px' }}>{e.id}</div></Html>
  </group>; })}</group>;
}
function GatewayLabel({ mission }: { mission: Mission | null }) {
  const final = mission?.actions.find(a => a.kind === 'FINALIZE')?.permit;
  if (!final) return null;
  const color = mission?.gateway.state === 'OPEN' ? permitColors.ACTIVE : permitColors[final.status];
  return <Html position={[0, 4.3, -3.2]} center zIndexRange={[5, 0]}><div className="scene-label" style={{ color }}>GATEWAY · {mission?.gateway.state}<small>finalize permit: {label(final.status)}</small></div></Html>;
}
function EvidenceCard({ mission, id, onClose }: { mission: Mission; id: string; onClose: () => void }) {
  const e = mission.evidence.find(x => x.id === id); if (!e) return null;
  const claims = mission.claims.filter(c => c.evidenceIds.includes(id)); const actions = mission.actions.filter(a => a.kind !== 'FINALIZE' && (a.evidenceIds.includes(id) || claims.some(c => a.claimIds.includes(c.id))));
  return <div className="evidence-card"><button onClick={onClose} aria-label="Close">×</button><span className="eyebrow">{e.id} · {e.state === 'VERIFIED' ? 'EXCERPT MATCHED (provenance only)' : e.state}</span><blockquote>{e.text.slice(0, 400)}</blockquote>{claims.map(c => <p key={c.id}><b>{c.id} · {c.status}</b> {c.text.slice(0, 140)}</p>)}<small>Depending actions: {actions.map(a => `${a.id} ${a.permit?.status}`).join(' · ') || 'none'}</small></div>;
}
export default function World({ mission }: { mission: Mission | null }) {
  const [selected, setSelected] = useState('');
  return <section className="world" aria-label="Interactive 3D world reflecting server permissions">
    <div className="world-top"><span className="eyebrow">LIVE ENVIRONMENT / LA TRAME</span><span className="world-state">◌ {mission ? mission.analysisStatus : 'Awaiting mission'}</span></div>
    <SceneBoundary><Canvas style={{ position: 'absolute', inset: 0 }} dpr={[1,1.5]} camera={{ position: [9,7,11], fov: 44 }} gl={{ antialias: true }}><color attach="background" args={[mission?.mode === 'EXPERIMENT' ? '#14081a' : '#080f17']} /><fog attach="fog" args={['#080f17',16,36]} /><ambientLight intensity={.7} /><directionalLight position={[4,8,5]} intensity={2} color="#a5e7f4" /><Grid args={[50,50]} cellSize={1} cellThickness={.5} cellColor="#17313b" sectionSize={5} sectionThickness={.8} sectionColor="#28505a" fadeDistance={30} infiniteGrid /><Architecture /><Gateway open={mission?.gateway.state === 'OPEN'} /><GatewayLabel mission={mission} /><ActionArches mission={mission} /><EvidenceCrystals mission={mission} selected={selected} onSelect={setSelected} /><Scout mission={mission} /><OrbitControls makeDefault minDistance={5} maxDistance={23} maxPolarAngle={Math.PI/2-.08} target={[0,1,0]} /></Canvas></SceneBoundary>
    {mission && selected && <EvidenceCard mission={mission} id={selected} onClose={() => setSelected('')} />}<div className="world-bottom"><div><span className="eyebrow">SCOUT / {mission?.analysisStatus === 'RUNNING' ? 'ANALYZING' : 'STANDBY'}</span><p>{mission?.analysisStatus === 'READY' ? (() => { const stop = mission.actions.find(a => a.kind !== 'FINALIZE' && a.permit?.status !== 'ACTIVE'); return stop ? `Halted at ${stop.id}: ${stop.permit?.reason}` : mission.gateway.state === 'OPEN' ? 'Gateway opened by the server for this exact note.' : 'All plan arches ACTIVE. The Gateway still re-checks the exact note.'; })() : 'No validated analysis. No active permits.'}</p><p className="legend"><span style={{ color: permitColors.ACTIVE }}>■ ACTIVE</span> <span style={{ color: permitColors.SUSPENDED }}>■ SUSPENDED</span> <span style={{ color: permitColors.BLOCKED }}>■ BLOCKED</span> <span style={{ color: permitColors.NEEDS_HUMAN }}>■ NEEDS HUMAN</span> · ◆ excerpt matched · ◇ masked</p></div><span className="controls">Drag to orbit · Scroll to zoom</span></div>
  </section>;
}
