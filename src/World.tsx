import { Component, type ReactNode, useMemo, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Mission, PermitStatus, Action } from '../shared/types';
// Staging only: camera framing, highlights and Scout's stop. Object states always come from the server mission.
export type SceneFocus = { kind: 'overview' | 'scout' | 'evidence' | 'action' | 'gateway' | 'source'; ids?: string[]; links?: boolean };
export const kindLabel: Record<string, string> = { RESEARCH: 'Research', REQUEST_HUMAN: 'Ask a person', CORRECT: 'Prepare a corrected draft', APPROVE: 'Approve claims', BLOCK: 'Refuse', FINALIZE: 'Final document' };
export const permitWord: Record<PermitStatus, string> = { ACTIVE: 'Allowed to work', SUSPENDED: 'Paused', BLOCKED: 'Blocked', NEEDS_HUMAN: 'Needs a person' };
export const dependsOnEvidence = (mission: Mission, action: Action, evidenceId: string) => action.evidenceIds.includes(evidenceId) || mission.claims.some(c => action.claimIds.includes(c.id) && c.evidenceIds.includes(evidenceId));
const crystalX = (i: number, n: number) => (i - (n - 1) / 2) * .8;
const sourcePos = (i: number): [number, number] => [4.6 + i * 2.6, 2.4];
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
function focusPoint(mission: Mission | null, focus?: SceneFocus): { scout?: [number, number]; cam: [number, number, number]; target: [number, number, number] } {
  const plan = mission?.actions.filter(a => a.kind !== 'FINALIZE') ?? []; const ev = mission?.evidence ?? [];
  switch (focus?.kind) {
    case 'scout': return { cam: [-1.5, 3.6, 8.5], target: [-1.5, 1, 2] };
    case 'evidence': { const xs = (focus.ids ?? []).map(id => ev.findIndex(e => e.id === id)).filter(i => i >= 0).map(i => crystalX(i, ev.length)); const x = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; return { scout: [x, 3.6], cam: [x * .6, focus.links ? 6.5 : 4.2, focus.links ? 12 : 10], target: [x * .5, .6, focus.links ? 2.6 : 4.4] }; }
    case 'action': { const i = Math.max(0, plan.findIndex(a => focus.ids?.includes(a.id))); const x = archX(i, plan.length); return { scout: [x, 1.4], cam: [x * .5 + 1, 5, 9.5], target: [x * .5, 1, .4] }; }
    case 'gateway': return { scout: [0, -.6], cam: [0, 4.2, 5.5], target: [0, 2, -3.2] };
    case 'source': { const [x, z] = sourcePos(0); return { scout: [x - .6, z + 1.4], cam: [x + 1.3, 4.6, z + 8.5], target: [x + 1.3, 1, z] }; }
    default: return { cam: [9, 7, 11], target: [0, 1, 0] };
  }
}
function CameraRig({ mission, focus }: { mission: Mission | null; focus?: SceneFocus }) {
  const { camera, controls } = useThree() as unknown as { camera: THREE.Camera; controls: { target: THREE.Vector3; update: () => void } | null };
  const until = useRef(0); const key = JSON.stringify(focus ?? null);
  useEffect(() => { until.current = performance.now() + 2200; }, [key]);
  useFrame((_, delta) => {
    if (!focus || performance.now() > until.current) return;
    const { cam, target } = focusPoint(mission, focus); const k = Math.min(1, delta * 2.2);
    camera.position.lerp(new THREE.Vector3(...cam), k);
    if (controls) { controls.target.lerp(new THREE.Vector3(...target), k); controls.update(); }
  });
  return null;
}
function Scout({ mission, focus }: { mission: Mission | null; focus?: SceneFocus }) {
  const ref = useRef<THREE.Group>(null);
  const [tx, tz] = focusPoint(mission, focus).scout ?? scoutTarget(mission);
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
function ActionArches({ mission, focus }: { mission: Mission | null; focus?: SceneFocus }) {
  const geometry = useMemo(() => new THREE.TorusGeometry(.8, .07, 8, 6, Math.PI), []);
  const materials = useMemo(() => Object.fromEntries(Object.entries(permitColors).map(([key, color]) => [key, new THREE.MeshBasicMaterial({ color })])) as Record<PermitStatus, THREE.MeshBasicMaterial>, []);
  useEffect(() => () => { geometry.dispose(); Object.values(materials).forEach(material => material.dispose()); }, [geometry, materials]);
  const plan = mission?.actions.filter(a => a.kind !== 'FINALIZE') ?? [];
  return <group>{plan.map((action, index) => action.permit && <group key={action.id} position={[archX(index, plan.length), 0, .4]}>
    <mesh geometry={geometry} material={materials[action.permit.status]} scale={focus?.kind === 'action' && focus.ids?.includes(action.id) ? 1.25 : 1} />
    <Html position={[0, 1.25, 0]} center zIndexRange={[5, 0]}><div className={`scene-label ${focus?.ids?.includes(action.id) ? 'focused' : ''}`} style={{ color: permitColors[action.permit.status] }}>{kindLabel[action.kind] ?? action.kind}<small>{permitWord[action.permit.status]}</small></div></Html>
  </group>)}</group>;
}
const evidenceColor = (state: string) => state === 'VERIFIED' ? '#7ce0c4' : state === 'MASKED' ? '#dc7777' : '#d3ac69';
// One crystal per report excerpt: teal = provenance matched, red = masked in an experiment.
function EvidenceCrystals({ mission, selected, onSelect, focus }: { mission: Mission | null; selected: string; onSelect: (id: string) => void; focus?: SceneFocus }) {
  const items = mission?.evidence ?? [];
  return <group position={[0, 0, 4.6]}>{items.map((e, i) => { const x = crystalX(i, items.length); return <group key={e.id} position={[x, .45, 0]}>
    <mesh onClick={event => { event.stopPropagation(); onSelect(e.id === selected ? '' : e.id); }} onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }} scale={e.id === selected || (focus?.kind === 'evidence' && focus.ids?.includes(e.id)) ? 1.9 : 1}><octahedronGeometry args={[e.state === 'VERIFIED' ? .2 : .14]} /><meshBasicMaterial color={evidenceColor(e.state)} wireframe={e.state !== 'VERIFIED'} /></mesh>
    <Html position={[0, -.42, 0]} center zIndexRange={[4, 0]}><div className="scene-label" style={{ color: evidenceColor(e.state), padding: '1px 4px' }}>{e.id}</div></Html>
  </group>; })}</group>;
}
function GatewayLabel({ mission }: { mission: Mission | null }) {
  const final = mission?.actions.find(a => a.kind === 'FINALIZE')?.permit;
  if (!final) return null;
  const open = mission?.gateway.state === 'OPEN'; const color = open ? permitColors.ACTIVE : permitColors[final.status];
  return <Html position={[0, 4.3, -3.2]} center zIndexRange={[5, 0]}><div className="scene-label big" style={{ color }}>{open ? 'FINAL DOCUMENT AUTHORIZED' : 'FINAL DOCUMENT: NOT AUTHORIZED'}<small>{permitWord[final.status]}</small></div></Html>;
}
// Dependency links from focused excerpts to the actions whose permits rely on them.
function DependencyLinks({ mission, focus }: { mission: Mission | null; focus?: SceneFocus }) {
  const lines = useMemo(() => {
    if (!mission || !focus?.links || !focus.ids?.length) return [];
    const plan = mission.actions.filter(a => a.kind !== 'FINALIZE'); const result: THREE.Line[] = [];
    for (const id of focus.ids) { const i = mission.evidence.findIndex(e => e.id === id); if (i < 0) continue;
      plan.forEach((a, j) => { if (!dependsOnEvidence(mission, a, id)) return; const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(crystalX(i, mission.evidence.length), .45, 4.6), new THREE.Vector3(archX(j, plan.length), .9, .4)]); result.push(new THREE.Line(g, new THREE.LineBasicMaterial({ color: mission.mode === 'EXPERIMENT' ? '#ff5fd2' : '#e8fbff', transparent: true, opacity: .85 }))); }); }
    return result;
  }, [mission, focus]);
  useEffect(() => () => lines.forEach(l => { l.geometry.dispose(); (l.material as THREE.Material).dispose(); }), [lines]);
  return <group>{lines.map((l, i) => <primitive key={i} object={l} />)}</group>;
}
// Recorded web sources (never live calls). Colour = stance after server-side checks.
function SourceBeacons({ mission }: { mission: Mission | null }) {
  const run = [...(mission?.research ?? [])].reverse().find(r => r.status === 'COMPLETE' && r.assessments?.length);
  if (!run) return null;
  const color = (s: string) => s === 'SUPPORTS' ? '#7ce0c4' : s === 'CONTRADICTS' ? '#ad96e5' : '#d3ac69';
  return <group>{run.assessments!.map((x, i) => { const [px, pz] = sourcePos(i); let host = x.url; try { host = new URL(x.url).hostname.replace(/^www\./, ''); } catch { /* keep url */ }
    return <group key={x.url} position={[px, 0, pz]}><mesh position={[0, .7, 0]}><cylinderGeometry args={[.18, .18, 1.4, 6]} /><meshBasicMaterial color={color(x.stance)} wireframe /></mesh>
      <Html position={[0, 1.8, 0]} center zIndexRange={[5, 0]}><div className="scene-label" style={{ color: color(x.stance) }}>{host}<small>Recorded source · {x.stance === 'SUPPORTS' ? 'candidate support' : x.stance === 'INSUFFICIENT' ? 'not sufficient' : 'contradicts'}</small></div></Html></group>; })}</group>;
}
function EvidenceCard({ mission, id, onClose }: { mission: Mission; id: string; onClose: () => void }) {
  const e = mission.evidence.find(x => x.id === id); if (!e) return null;
  const claims = mission.claims.filter(c => c.evidenceIds.includes(id)); const actions = mission.actions.filter(a => a.kind !== 'FINALIZE' && (a.evidenceIds.includes(id) || claims.some(c => a.claimIds.includes(c.id))));
  return <div className="evidence-card"><button onClick={onClose} aria-label="Close">×</button><span className="eyebrow">{e.id} · {e.state === 'VERIFIED' ? 'EXCERPT MATCHED (provenance only)' : e.state}</span><blockquote>{e.text.slice(0, 400)}</blockquote>{claims.map(c => <p key={c.id}><b>{c.id} · {c.status}</b> {c.text.slice(0, 140)}</p>)}<small>Depending actions: {actions.map(a => `${a.id} ${a.permit?.status}`).join(' · ') || 'none'}</small></div>;
}
export default function World({ mission, focus, testWorld }: { mission: Mission | null; focus?: SceneFocus; testWorld?: boolean }) {
  const [selected, setSelected] = useState('');
  return <section className="world" aria-label="Interactive 3D world reflecting server permissions">
    <div className="world-top"><span className="eyebrow">LIVE ENVIRONMENT / LA TRAME</span><span className="world-state">◌ {mission ? mission.analysisStatus : 'Awaiting mission'}</span></div>
    <SceneBoundary><Canvas style={{ position: 'absolute', inset: 0 }} dpr={[1,1.5]} camera={{ position: [9,7,11], fov: 44 }} gl={{ antialias: true }}><color attach="background" args={[testWorld || mission?.mode === 'EXPERIMENT' ? '#1a0820' : '#080f17']} /><fog attach="fog" args={['#080f17',16,36]} /><ambientLight intensity={.7} /><directionalLight position={[4,8,5]} intensity={2} color="#a5e7f4" /><Grid args={[50,50]} cellSize={1} cellThickness={.5} cellColor="#17313b" sectionSize={5} sectionThickness={.8} sectionColor="#28505a" fadeDistance={30} infiniteGrid /><Architecture /><Gateway open={mission?.gateway.state === 'OPEN'} /><GatewayLabel mission={mission} /><ActionArches mission={mission} focus={focus} /><EvidenceCrystals mission={mission} selected={selected} onSelect={setSelected} focus={focus} /><DependencyLinks mission={mission} focus={focus} /><SourceBeacons mission={mission} /><Scout mission={mission} focus={focus} /><CameraRig mission={mission} focus={focus} /><OrbitControls makeDefault minDistance={5} maxDistance={23} maxPolarAngle={Math.PI/2-.08} target={[0,1,0]} /></Canvas></SceneBoundary>
    {(testWorld || mission?.mode === 'EXPERIMENT') && <div className="test-banner">TEST WORLD — original unchanged</div>}
    {mission && selected && <EvidenceCard mission={mission} id={selected} onClose={() => setSelected('')} />}<div className="world-bottom"><div><span className="eyebrow">SCOUT / {mission?.analysisStatus === 'RUNNING' ? 'ANALYZING' : 'STANDBY'}</span><p>{mission?.analysisStatus === 'READY' ? (() => { const stop = mission.actions.find(a => a.kind !== 'FINALIZE' && a.permit?.status !== 'ACTIVE'); return stop ? `Scout halts at “${kindLabel[stop.kind] ?? stop.kind}”: ${stop.permit?.reason}` : mission.gateway.state === 'OPEN' ? 'Gateway opened by the server for this exact note.' : 'All plan arches ACTIVE. The Gateway still re-checks the exact note.'; })() : 'No validated analysis. No active permits.'}</p><p className="legend"><span style={{ color: permitColors.ACTIVE }}>■ ACTIVE</span> <span style={{ color: permitColors.SUSPENDED }}>■ SUSPENDED</span> <span style={{ color: permitColors.BLOCKED }}>■ BLOCKED</span> <span style={{ color: permitColors.NEEDS_HUMAN }}>■ NEEDS HUMAN</span> · ◆ excerpt matched · ◇ masked</p></div><span className="controls">Drag to orbit · Scroll to zoom</span></div>
  </section>;
}
