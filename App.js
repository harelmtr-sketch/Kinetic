/**
 * Kinetic — premium dark fitness skill tree.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  StatusBar, PanResponder, TextInput, Alert,
  KeyboardAvoidingView, Platform, ScrollView, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Blur,
  Atlas,
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  Path,
  Skia,
  Text as SkiaText,
  matchFont,
} from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';

const STORAGE_KEY = 'calisthenics_tree_v1';
const NODE_R = 46;
const MIN_SC = 0.15;
const MAX_SC = 6;
const DEV_PERF_LOG = false;
const USE_GLOW = true;
const GLOW_QUALITY = 'low'; // 'low' | 'high'

const Colors = {
  black: '#000000',
  white: '#FFFFFF',
  background: {
    primary: '#000000',
    secondary: '#0F1115',
    card: '#1E2128',
    cardAlt: '#1A1D23',
    gradient: {
      dark1: '#0F1419',
      dark2: '#161B28',
      dark3: '#1A1F2E',
      dark4: '#1E2433',
    },
  },
  blue: { 300: '#93C5FD', 400: '#60A5FA', 500: '#3B82F6', 600: '#2563EB' },
  green: { 400: '#4ADE80', 500: '#22C55E' },
  yellow: { 300: '#FDE047', 400: '#FACC15', 500: '#EAB308' },
  slate: { 300: '#CBD5E1', 400: '#94A3B8', 500: '#64748B', 700: '#334155', 800: '#1E293B', 900: '#0F172A' },
  text: {
    primary: '#FFFFFF',
    secondary: '#E5E7EB',
    tertiary: '#9CA3AF',
    disabled: 'rgba(156, 163, 175, 0.5)',
  },
  border: {
    default: 'rgba(60, 65, 75, 0.3)',
    blue: 'rgba(59, 130, 246, 0.25)',
    blueActive: 'rgba(59, 130, 246, 0.40)',
    subtle: 'rgba(229, 231, 235, 0.1)',
  },
};

const BRANCH_COLORS = {
  neutral: { main: Colors.blue[400], glow: 'rgba(96,165,250,0.34)', edge: 'rgba(96,165,250,0.72)', ring: '#93C5FD' },
  push: { main: Colors.green[500], glow: 'rgba(34,197,94,0.35)', edge: 'rgba(74,222,128,0.78)', ring: '#86EFAC' },
  pull: { main: Colors.blue[500], glow: 'rgba(59,130,246,0.38)', edge: 'rgba(96,165,250,0.8)', ring: '#93C5FD' },
  core: { main: Colors.yellow[400], glow: 'rgba(250,204,21,0.36)', edge: 'rgba(250,204,21,0.82)', ring: '#FDE047' },
};

const C = {
  bg: Colors.background.primary,
  bgCard: Colors.background.card,
  bgDeep: Colors.background.cardAlt,
  stone: Colors.slate[800],
  stoneLt: Colors.slate[700],
  gold: Colors.blue[400],
  goldDim: Colors.blue[500],
  green: Colors.green[500],
  greenGlow: BRANCH_COLORS.push.glow,
  amber: Colors.yellow[400],
  red: '#EF4444',
  blue: Colors.blue[500],
  textMain: Colors.text.primary,
  textDim: Colors.text.secondary,
  textFaint: Colors.text.tertiary,
};

const BRANCH_MAP = {
  dead_hang: 'pull',
  active_hang: 'pull',
  scap_pulls: 'pull',
  neg_pullup: 'pull',
  pullup: 'pull',
  pushup: 'push',
  diamond_pu: 'push',
  pike_pu: 'push',
  hspu: 'push',
  start: 'neutral',
};

const resolveBranch = (node) => node.branch || BRANCH_MAP[node.id] || (node.isStart ? 'neutral' : 'core');
const toRGBA = (hex, alpha = 1) => {
  const m = hex.replace('#', '');
  const n = m.length === 3 ? m.split('').map((c)=>c + c).join('') : m;
  const int = parseInt(n, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
};

const INIT = {
  nodes:[
    {id:'start',      name:'Start',          x:450,y:100, unlocked:true, isStart:true, branch:'neutral' },
    {id:'dead_hang',  name:'Dead Hang',       x:250,y:280, unlocked:false,isStart:false, branch:'pull'},
    {id:'pushup',     name:'Push-Up',         x:650,y:280, unlocked:false,isStart:false, branch:'push'},
    {id:'active_hang',name:'Active Hang',     x:250,y:460, unlocked:false,isStart:false, branch:'pull'},
    {id:'diamond_pu', name:'Diamond Push-Up', x:650,y:460, unlocked:false,isStart:false, branch:'push'},
    {id:'scap_pulls', name:'Scapular Pulls',  x:120,y:640, unlocked:false,isStart:false, branch:'pull'},
    {id:'neg_pullup', name:'Neg. Pull-Up',    x:380,y:640, unlocked:false,isStart:false, branch:'pull'},
    {id:'pike_pu',    name:'Pike Push-Up',    x:650,y:640, unlocked:false,isStart:false, branch:'push'},
    {id:'pullup',     name:'Pull-Up',         x:250,y:820, unlocked:false,isStart:false, branch:'pull'},
    {id:'hspu',       name:'HSPU',            x:650,y:820, unlocked:false,isStart:false, branch:'push'},
  ],
  edges:[
    {from:'start',to:'dead_hang'},{from:'start',to:'pushup'},
    {from:'dead_hang',to:'active_hang'},
    {from:'active_hang',to:'scap_pulls'},{from:'active_hang',to:'neg_pullup'},
    {from:'scap_pulls',to:'pullup'},{from:'neg_pullup',to:'pullup'},
    {from:'pushup',to:'diamond_pu'},{from:'diamond_pu',to:'pike_pu'},{from:'pike_pu',to:'hspu'},
  ],
  info:{
    start:      {desc:'Your journey begins here. Every master was once a beginner.',str:0,bal:0,tec:0},
    dead_hang:  {desc:'Hang from bar, arms fully extended. Builds grip and shoulder health.',str:3,bal:2,tec:1},
    pushup:     {desc:'Standard push-up. The foundation of all pushing movements.',str:3,bal:2,tec:2},
    active_hang:{desc:'Hang with shoulders actively depressed and engaged. Crucial for safety.',str:4,bal:3,tec:3},
    diamond_pu: {desc:'Tricep push-up with hands forming a diamond shape.',str:5,bal:3,tec:4},
    scap_pulls: {desc:'Retract and depress scapula while hanging. Activates the lats.',str:4,bal:3,tec:5},
    neg_pullup: {desc:'Lower slowly from the top of a pull-up. Eccentric strength builder.',str:6,bal:4,tec:4},
    pike_pu:    {desc:'Shoulder push-up in pike position. Direct prerequisite for HSPU.',str:5,bal:5,tec:6},
    pullup:     {desc:'Full pull-up from dead hang to chin over bar. The upper body king.',str:7,bal:5,tec:5},
    hspu:       {desc:'Handstand Push-Up. The pinnacle of overhead pressing strength.',str:9,bal:9,tec:9},
  },
};


function canUnlock(id,nodes,edges){
  const p=edges.filter(e=>e.to===id).map(e=>e.from);
  if(!p.length) return false;
  return p.every(pid=>nodes.find(n=>n.id===pid)?.unlocked);
}
function segDist(px,py,ax,ay,bx,by){
  const dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy;
  if(!l) return Math.hypot(px-ax,py-ay);
  const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/l));
  return Math.hypot(px-ax-t*dx,py-ay-t*dy);
}

function normalizeTree(rawTree){
  return {
    ...INIT,
    ...rawTree,
    nodes: (rawTree?.nodes || INIT.nodes).map((n)=>(
      { ...n, branch: resolveBranch(n) }
    )),
    info: { ...INIT.info, ...(rawTree?.info || {}) },
  };
}

// ── Difficulty bar ────────────────────────────────────────────────────────────
function DiffBar({label, value, color, glowColor}){
  const segments = 10;
  return (
    <View style={db.row}>
      <Text style={db.label}>{label}</Text>
      <View style={db.bars}>
        {Array.from({length:segments},(_,i)=>{
          const filled = i < value;
          return (
            <View key={i} style={[
              db.seg,
              filled ? {backgroundColor:color, shadowColor:glowColor, shadowOpacity:0.9, shadowRadius:6, shadowOffset:{width:0,height:0}} : db.segEmpty
            ]}/>
          );
        })}
      </View>
      <Text style={[db.num,{color}]}>{value}</Text>
    </View>
  );
}
const db = StyleSheet.create({
  row:      {flexDirection:'row',alignItems:'center',marginBottom:10},
  label:    {color:C.textMain,fontSize:15,width:90,fontWeight:'500',letterSpacing:0.5},
  bars:     {flex:1,flexDirection:'row',gap:3},
  seg:      {flex:1,height:14,borderRadius:3},
  segEmpty: {flex:1,height:14,borderRadius:3,backgroundColor:'#111827',borderWidth:1,borderColor:'#1f2937'},
  num:      {width:24,textAlign:'right',fontSize:15,fontWeight:'700',marginLeft:8},
});

// ── Skill Card ────────────────────────────────────────────────────────────────
function SkillCard({node,nodes,edges,info,onClose,onRecord}){
  const skillInfo = info || {desc:'',str:5,bal:5,tec:5};
  const unlockable = !node.isStart && canUnlock(node.id,nodes,edges);
  const prereqs = edges.filter(e=>e.to===node.id).map(e=>nodes.find(n=>n.id===e.from)).filter(Boolean);
  const unmetPrereqs = prereqs.filter(p=>!p.unlocked);

  let statusText, statusColor;
  if(node.isStart)      {statusText='ORIGIN';          statusColor=C.gold;}
  else if(node.unlocked){statusText='MASTERED';        statusColor=C.green;}
  else if(unlockable)   {statusText='READY TO ATTEMPT';statusColor=C.amber;}
  else                  {statusText='LOCKED';          statusColor=C.red;}

  return(
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={cs.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose}/>

        {/* Card — 6:9 ratio feel, max width constrained */}
        <View style={cs.card}>

          {/* Top row: status badge + X */}
          <View style={cs.topRow}>
            <View style={[cs.statusBadge,{borderColor:statusColor+'60'}]}>
              <Text style={[cs.statusT,{color:statusColor,textShadowColor:statusColor,textShadowRadius:8}]}>
                {statusText}
              </Text>
            </View>
            <TouchableOpacity style={cs.xBtn} onPress={onClose} hitSlop={{top:16,bottom:16,left:16,right:16}}>
              <Text style={cs.xT}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Decorative top line */}
          <View style={cs.divRow}>
            <View style={cs.divLine}/>
            <View style={cs.divDot}/>
            <View style={cs.divLine}/>
          </View>

          {/* Title */}
          <Text style={cs.title}>{node.name.toUpperCase()}</Text>

          {/* Divider */}
          <View style={cs.divRow}>
            <View style={cs.divLine}/>
            <View style={cs.divDot}/>
            <View style={cs.divLine}/>
          </View>

          {!!skillInfo.desc && <Text style={cs.desc}>{skillInfo.desc}</Text>}

          {/* Difficulty section */}
          {!node.isStart && (
            <View style={cs.diffSection}>
              <Text style={cs.sectionLabel}>DIFFICULTY</Text>
              <DiffBar label="Strength"  value={skillInfo.str} color="#c04040" glowColor="#ff2020"/>
              <DiffBar label="Balance"   value={skillInfo.bal} color="#3a70d0" glowColor="#2060ff"/>
              <DiffBar label="Technique" value={skillInfo.tec} color="#b09020" glowColor="#ffd030"/>
            </View>
          )}

          {/* Symbol placeholder */}
          {!node.isStart && (
            <View style={cs.symbolRow}>
              <View style={cs.symbolCircle}/>
            </View>
          )}

          {/* Video/image placeholder */}
          <View style={cs.mediaBg}>
            <Text style={cs.mediaLabel}>VIDEO PLACEHOLDER</Text>
            <Text style={cs.mediaHint}>Replace with skill footage</Text>
          </View>

          {/* Prerequisites if not met */}
          {unmetPrereqs.length > 0 && (
            <View style={cs.prereqBox}>
              <Text style={cs.prereqTitle}>PREREQUISITES NEEDED</Text>
              {unmetPrereqs.map(p=>(
                <Text key={p.id} style={cs.prereqItem}>· {p.name}</Text>
              ))}
            </View>
          )}

          {/* Attempt / status button */}
          {node.isStart ? (
            <View style={cs.originBtn}>
              <Text style={cs.originBtnT}>THE BEGINNING</Text>
            </View>
          ) : node.unlocked ? (
            <View style={cs.masteredBtn}>
              <Text style={cs.masteredBtnT}>MASTERED</Text>
            </View>
          ) : unlockable ? (
            <TouchableOpacity style={cs.attemptBtn} onPress={()=>onRecord(node.id)} activeOpacity={0.8}>
              <Text style={cs.attemptBtnT}>ATTEMPT</Text>
            </TouchableOpacity>
          ) : (
            <View style={cs.lockedBtn}>
              <Text style={cs.lockedBtnT}>COMPLETE PREREQUISITES</Text>
            </View>
          )}

        </View>
      </View>
    </Modal>
  );
}

const cs = StyleSheet.create({
  overlay:     {flex:1,backgroundColor:'rgba(0,0,0,0.88)',alignItems:'center',justifyContent:'center',padding:20},
  card:        {backgroundColor:C.bgCard,borderRadius:16,width:'100%',maxWidth:380,borderWidth:1,borderColor:C.stone,
                shadowColor:'#000',shadowOffset:{width:0,height:24},shadowOpacity:0.9,shadowRadius:40,elevation:40,
                overflow:'hidden'},
  topRow:      {flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:18,paddingTop:16,paddingBottom:8},
  statusBadge: {borderWidth:1,borderRadius:4,paddingHorizontal:10,paddingVertical:4},
  statusT:     {fontSize:10,fontWeight:'800',letterSpacing:2.5},
  xBtn:        {width:30,height:30,alignItems:'center',justifyContent:'center'},
  xT:          {color:C.textDim,fontSize:16,fontWeight:'300'},

  divRow:      {flexDirection:'row',alignItems:'center',marginHorizontal:18,marginVertical:6},
  divLine:     {flex:1,height:1,backgroundColor:C.stone},
  divDot:      {width:5,height:5,borderRadius:3,backgroundColor:C.goldDim,marginHorizontal:8},

  title:       {textAlign:'center',fontSize:28,fontWeight:'800',color:C.textMain,
                letterSpacing:5,paddingHorizontal:18,paddingVertical:8,
                textShadowColor:C.gold+'40',textShadowRadius:12},

  diffSection: {paddingHorizontal:18,paddingTop:10,paddingBottom:4},
  desc:       {color:C.textDim,fontSize:13,lineHeight:18,paddingHorizontal:18,paddingTop:4,paddingBottom:8,textAlign:'center'},
  sectionLabel:{color:C.textDim,fontSize:10,fontWeight:'800',letterSpacing:3,textAlign:'center',marginBottom:14},

  symbolRow:   {alignItems:'center',paddingVertical:10},
  symbolCircle:{width:36,height:36,borderRadius:18,borderWidth:1.5,borderColor:C.stoneLt,backgroundColor:'#0f172a'},

  mediaBg:     {marginHorizontal:18,marginVertical:10,height:160,backgroundColor:'#0f172a',
                borderRadius:10,borderWidth:1,borderColor:C.stone,
                alignItems:'center',justifyContent:'center'},
  mediaLabel:  {color:C.textFaint,fontSize:11,fontWeight:'700',letterSpacing:2,marginBottom:4},
  mediaHint:   {color:C.textFaint,fontSize:10},

  prereqBox:   {marginHorizontal:18,marginBottom:8,padding:12,backgroundColor:'#131923',
                borderRadius:8,borderWidth:1,borderColor:'#7f1d1d'},
  prereqTitle: {color:'#f87171',fontSize:9,fontWeight:'800',letterSpacing:2.5,marginBottom:6},
  prereqItem:  {color:'#fca5a5',fontSize:13,marginBottom:3},

  attemptBtn:  {margin:18,marginTop:10,backgroundColor:'#111827',borderRadius:10,paddingVertical:18,
                alignItems:'center',borderWidth:1.5,borderColor:C.gold,
                shadowColor:C.gold,shadowOpacity:0.3,shadowRadius:12,shadowOffset:{width:0,height:0}},
  attemptBtnT: {color:C.gold,fontSize:17,fontWeight:'800',letterSpacing:5,
                textShadowColor:C.gold,textShadowRadius:10},

  lockedBtn:   {margin:18,marginTop:10,backgroundColor:'#131923',borderRadius:10,paddingVertical:18,
                alignItems:'center',borderWidth:1,borderColor:'rgba(239,68,68,0.35)'},
  lockedBtnT:  {color:'#fca5a5',fontSize:13,fontWeight:'700',letterSpacing:2},

  masteredBtn: {margin:18,marginTop:10,backgroundColor:'#131b22',borderRadius:10,paddingVertical:18,
                alignItems:'center',borderWidth:1.5,borderColor:C.green,
                shadowColor:C.green,shadowOpacity:0.28,shadowRadius:12,shadowOffset:{width:0,height:0}},
  masteredBtnT:{color:C.green,fontSize:17,fontWeight:'800',letterSpacing:5},

  originBtn:   {margin:18,marginTop:10,backgroundColor:'#111827',borderRadius:10,paddingVertical:18,
                alignItems:'center',borderWidth:1,borderColor:C.goldDim},
  originBtnT:  {color:C.goldDim,fontSize:14,fontWeight:'700',letterSpacing:4},
});

// ── Name Prompt ───────────────────────────────────────────────────────────────
function NamePrompt({visible,onConfirm,onCancel}){
  const [val,setVal]=useState('');
  const ok=()=>{if(val.trim()){onConfirm(val.trim());setVal('');}};
  const no=()=>{setVal('');onCancel();};
  return(
    <Modal transparent animationType="fade" visible={visible} onRequestClose={no}>
      <KeyboardAvoidingView style={np.kav} behavior={Platform.OS==='ios'?'padding':'height'}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={no}/>
        <View style={np.box}>
          <Text style={np.title}>NEW SKILL</Text>
          <TextInput
            value={val}
            onChangeText={setVal}
            placeholder="Skill name..."
            placeholderTextColor={C.textFaint}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={ok}
            selectionColor={C.gold}
            style={[np.input, { color: C.textMain }]}
          />
          <View style={np.row}>
            <TouchableOpacity style={np.cancel} onPress={no}>
              <Text style={np.cancelT}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[np.add,!val.trim()&&np.off]} onPress={ok} disabled={!val.trim()}>
              <Text style={np.addT}>ADD NODE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const np = StyleSheet.create({
  kav:    {flex:1,backgroundColor:'rgba(0,0,0,0.82)',justifyContent:'flex-start',paddingTop:110,paddingHorizontal:30},
  box:    {backgroundColor:C.bgCard,borderRadius:14,padding:24,borderWidth:1,borderColor:C.stone},
  title:  {color:C.textMain,fontSize:14,fontWeight:'800',letterSpacing:4,textAlign:'center',marginBottom:18},
  input:  {backgroundColor:'#0f172a',borderRadius:10,padding:16,fontSize:17,borderWidth:1,borderColor:C.stone,marginBottom:16,color:C.textMain},
  row:    {flexDirection:'row',gap:10},
  cancel: {flex:1,backgroundColor:'#111827',borderRadius:10,paddingVertical:14,alignItems:'center',borderWidth:1,borderColor:C.stone},
  cancelT:{color:C.textDim,fontWeight:'600'},
  add:    {flex:1,backgroundColor:'#111827',borderRadius:10,paddingVertical:14,alignItems:'center',borderWidth:1,borderColor:C.gold},
  off:    {opacity:0.3},
  addT:   {color:C.gold,fontWeight:'800',letterSpacing:2},
});

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (a >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function SkiaTreeCanvas({
  tree, visibleNodes, visibleEdges, nodeStatusMap, wrappedLabels,
  txV, tyV, scV,
  dragVisual, LOD, edgeVisual,
  bld, connA, isInteracting,
  canvasSize, nStyle,
}){
  const labelFont = useMemo(()=>matchFont({ fontSize: 10, fontStyle: 'bold' }),[]);
  const sceneTransform = useDerivedValue(()=>([
    { translateX: txV.value },
    { translateY: tyV.value },
    { scale: scV.value },
  ]),[]);

  const nodeMap = useMemo(()=>new Map(tree.nodes.map(n=>[n.id,n])),[tree.nodes]);

  const dustAtlas = useMemo(() => {
    const W = 3600;
    const H = 3600;
    const N = 900;

    const rand = mulberry32(1337);

    const spriteSize = 8;
    const surface = Skia.Surface.MakeOffscreen(spriteSize, spriteSize);
    const c = surface.getCanvas();
    c.clear(Skia.Color('rgba(0,0,0,0)'));

    const p = Skia.Paint();
    p.setColor(Skia.Color('rgba(255,255,255,0.12)'));
    c.drawRect(Skia.XYWHRect(0, 0, spriteSize, spriteSize), p);

    const image = surface.makeImageSnapshot();

    const spriteRect = Skia.XYWHRect(0, 0, spriteSize, spriteSize);
    const sprites = new Array(N);
    const transforms = new Array(N);

    for (let i = 0; i < N; i++) {
      const x = (rand() - 0.5) * W;
      const y = (rand() - 0.5) * H;
      const s = 0.45 + rand() * 0.9;

      sprites[i] = spriteRect;
      transforms[i] = Skia.RSXform(s, 0, x, y);
    }

    return { image, sprites, transforms };
  }, []);

  const edgeSegments = useMemo(()=>{
    return visibleEdges.map((e, idx)=>{
      const fn=nodeMap.get(e.from);
      const tn=nodeMap.get(e.to);
      if(!fn||!tn) return null;
      const fromPos=dragVisual?.id===fn.id?{x:dragVisual.x,y:dragVisual.y}:fn;
      const toPos=dragVisual?.id===tn.id?{x:dragVisual.x,y:dragVisual.y}:tn;
      const path = Skia.Path.Make();
      path.moveTo(fromPos.x,fromPos.y);
      path.lineTo(toPos.x,toPos.y);

      const fromState=nodeStatusMap[fn.id] || 'locked';
      const toState=nodeStatusMap[tn.id] || 'locked';
      const fromLit=fromState==='start'||fromState==='mastered';
      const toLit=toState==='start'||toState==='mastered';
      const toReady=toState==='ready';
      const status = bld ? 'locked' : (fromLit&&toLit ? 'mastered' : ((fromLit&&!toLit)||toReady ? 'ready' : 'locked'));
      const branch = resolveBranch(tn);
      const branchColor = BRANCH_COLORS[branch] || BRANCH_COLORS.neutral;
      return { id: `${e.from}_${e.to}_${idx}`, path, status, branchColor };
    }).filter(Boolean);
  },[bld,dragVisual,nodeMap,nodeStatusMap,visibleEdges]);

  const farNodeR = NODE_R*0.34;
  return(
    <Canvas style={{width:canvasSize.width,height:canvasSize.height}}>
      <Group transform={sceneTransform}>
        <Circle cx={450} cy={420} r={860} color="rgba(19,32,52,0.1)" />
        <Circle cx={450} cy={420} r={520} color="rgba(59,130,246,0.08)" />
        <Atlas
          image={dustAtlas.image}
          sprites={dustAtlas.sprites}
          transforms={dustAtlas.transforms}
        />
        {edgeSegments.map((edge)=>{
          const w = edge.status==='mastered' ? edgeVisual.masteredW : edge.status==='ready' ? edgeVisual.readyW : edgeVisual.lockedW;
          const o = edge.status==='mastered' ? edgeVisual.masteredO : edge.status==='ready' ? edgeVisual.readyO : edgeVisual.lockedO;
          const boostedO = Math.min(0.95, o + (edge.status==='locked' ? 0.06 : 0.12));
          const color = edge.status==='locked' ? `rgba(100,116,139,${boostedO})` : toRGBA(edge.branchColor.main, boostedO);
          return (
            <Group key={edge.id}>
              {LOD.isNear && !isInteracting && edge.status!=='locked' && (
                <Path path={edge.path} style="stroke" strokeWidth={w+3.6} color={edge.branchColor.glow} strokeCap="round" />
              )}
              <Path path={edge.path} style="stroke" strokeWidth={w} color={color} strokeCap="round">
                {LOD.useDashedReady && edge.status==='ready' && !bld && <DashPathEffect intervals={[12,10]} />}
              </Path>
            </Group>
          );
        })}

        {visibleNodes.map(n=>{
          const visual=nStyle(n);
          const rx=dragVisual?.id===n.id?dragVisual.x:n.x;
          const ry=dragVisual?.id===n.id?dragVisual.y:n.y;
          const lines=wrappedLabels[n.id]||[n.name];
          const lh=13;
          const sy=ry-(lines.length*lh)/2+lh*0.8;
          const status=nodeStatusMap[n.id]||'locked';
          const isLit=status==='start'||status==='mastered'||status==='ready';
          const isReady=status==='ready';
          const isMastered=status==='start'||status==='mastered';
          const renderR=LOD.isFar?farNodeR:NODE_R;
          const nodeStrokeWidth=LOD.isFar?Math.max(0.8,visual.sw-0.5):visual.sw;
          const baseAuraColor=status==='locked'?'rgba(100,116,139,0.14)':toRGBA(visual.stroke,0.2);
          return(
            <Group key={n.id}>
              {LOD.showOuterRing&&<Circle cx={rx} cy={ry} r={NODE_R+13} style="stroke" strokeWidth={1.15} color={visual.ring} />}
              {LOD.showOuterRing&&bld&&connA===n.id&&<Circle cx={rx} cy={ry} r={NODE_R+16} style="stroke" strokeWidth={1.8} color={BRANCH_COLORS.neutral.edge} />}

              {USE_GLOW&&<Circle cx={rx} cy={ry} r={LOD.isFar?NODE_R*0.76:NODE_R*1.02} color={baseAuraColor} />}
              {USE_GLOW&&isLit&&<Circle cx={rx} cy={ry} r={LOD.isFar?NODE_R*0.86:NODE_R*1.14} color={visual.glowOuter} />}

              {LOD.isNear&&!isInteracting&&USE_GLOW&&isLit&&(
                <Group>
                  <Circle cx={rx} cy={ry} r={NODE_R*1.12} color={visual.glowOuter}><Blur blur={GLOW_QUALITY==='high'?20:14} /></Circle>
                  <Circle cx={rx} cy={ry} r={NODE_R*0.98} color={visual.glowMid}><Blur blur={GLOW_QUALITY==='high'?14:9} /></Circle>
                  <Circle cx={rx} cy={ry} r={NODE_R*0.8} color={visual.glowInner}><Blur blur={6} /></Circle>
                </Group>
              )}

              <Circle cx={rx} cy={ry} r={renderR+2} color={visual.outerRim} />
              <Circle cx={rx} cy={ry} r={renderR} color={visual.fill} opacity={visual.opacity} />
              <Circle cx={rx} cy={ry} r={renderR-4} color={visual.innerFill} opacity={0.9} />
              <Circle cx={rx} cy={ry} r={renderR-6} style="stroke" strokeWidth={nodeStrokeWidth} color={visual.stroke} opacity={visual.opacity} />
              {LOD.showInnerRing&&<Circle cx={rx} cy={ry} r={NODE_R-12} style="stroke" strokeWidth={1} color={visual.ring} opacity={0.65} />}
              {!LOD.isFar&&<Circle cx={rx-10} cy={ry-10} r={NODE_R*0.14} color="rgba(255,255,255,0.25)" />}
              {!LOD.isFar&&<Circle cx={rx+8} cy={ry+10} r={NODE_R*0.16} color="rgba(0,0,0,0.24)" />}

              {LOD.showLabels&&!isInteracting&&lines.map((ln,li)=>(
                <SkiaText
                  key={`${n.id}_${li}`}
                  x={rx-(ln.length*2.8)}
                  y={sy+li*lh}
                  text={ln}
                  font={labelFont}
                  color={isLit?Colors.text.primary:Colors.slate[400]}
                />
              ))}
            </Group>
          );
        })}
      </Group>
    </Canvas>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
function TreeScreen({ onTreeChange }){
  const insets = useSafeAreaInsets();
  const [tree,_setTree]=useState(normalizeTree(INIT));
  const tR=useRef(normalizeTree(INIT));
  const setTree=t=>{tR.current=t;_setTree(t);};
  const hist=useRef([normalizeTree(INIT)]),hi=useRef(0);
  const [canUndo,setCU]=useState(false),[canRedo,setCR]=useState(false);

  useEffect(()=>{
    AsyncStorage.getItem(STORAGE_KEY).then(raw=>{
      if(!raw) return;
      try{
        const saved=JSON.parse(raw);
        if(saved?.nodes&&saved?.edges){
          const t=normalizeTree(saved);
          hist.current=[t];hi.current=0;
          setTree(t);setCU(false);setCR(false);
        }
      }catch(e){}
    });
  },[]);

  useEffect(()=>{
    onTreeChange?.(tree);
  },[onTreeChange, tree]);

  const commit=t=>{
    const h=hist.current.slice(0,hi.current+1);h.push(t);
    hist.current=h;hi.current=h.length-1;setTree(t);setCU(true);setCR(false);
    AsyncStorage.setItem(STORAGE_KEY,JSON.stringify(t)).catch(()=>{});
  };
  const undo=()=>{if(!hi.current)return;hi.current--;const t=hist.current[hi.current];setTree(t);setCU(hi.current>0);setCR(true);};
  const redo=()=>{if(hi.current>=hist.current.length-1)return;hi.current++;const t=hist.current[hi.current];setTree(t);setCU(true);setCR(hi.current<hist.current.length-1);};

  const [bld,_setBld]=useState(false);const bR=useRef(false);const setBld=v=>{bR.current=v;_setBld(v);};
  const [tool,_setTool]=useState('move');const tR2=useRef('move');const setTool=v=>{tR2.current=v;_setTool(v);};
  const [connA,_setConnA]=useState(null);const cAR=useRef(null);const setConnA=v=>{cAR.current=v;_setConnA(v);};
  const [sel,setSel]=useState(null);
  const [prompt,showPrompt]=useState(false);
  const pendingPos=useRef({x:450,y:400});

  const txN=useRef(0),tyN=useRef(0),scN=useRef(1);
  const txV=useSharedValue(0),tyV=useSharedValue(0),scV=useSharedValue(1);
  const [xform,setXform]=useState({tx:0,ty:0,sc:1});
  const gestureActive=useRef(false);
  const setLiveXform=(tx,ty,sc)=>{
    txN.current=tx;tyN.current=ty;scN.current=sc;
    txV.value=tx;tyV.value=ty;scV.value=sc;
  };
  const commitLiveXform=()=>{
    const next={tx:txN.current,ty:tyN.current,sc:scN.current};
    setXform(prev=>(prev.tx===next.tx&&prev.ty===next.ty&&prev.sc===next.sc?prev:next));
  };

  const [canvasSize,setCanvasSize]=useState({width:0,height:0});

  useEffect(()=>{
    // Keep live transform values in sync after non-gesture renders.
    setLiveXform(txN.current,tyN.current,scN.current);
  },[tree,bld,tool,connA,sel,prompt]);

  useEffect(()=>{
    setLiveXform(xform.tx,xform.ty,xform.sc);
  },[xform.sc,xform.tx,xform.ty]);

  useEffect(()=>()=>{
    if(dragVisualRaf.current!=null) cancelAnimationFrame(dragVisualRaf.current);
    if(glowDebounceRef.current) clearTimeout(glowDebounceRef.current);
  },[]);

  const cL=useRef(0),cT=useRef(0),cRef=useRef(null);
  const measureC=()=>cRef.current?.measure((_,__,_w,_h,px,py)=>{cL.current=px;cT.current=py;});

  const toSVG=(px,py)=>({
    x:(px-cL.current-txN.current)/scN.current,
    y:(py-cT.current-tyN.current)/scN.current,
  });
  const hitNode=(px,py)=>{
    const p=toSVG(px,py);
    return tR.current.nodes.find(n=>Math.hypot(n.x-p.x,n.y-p.y)<=NODE_R+14);
  };

  const gSx=useRef(0),gSy=useRef(0),gLx=useRef(0),gLy=useRef(0),moved=useRef(false);
  const pOn=useRef(false),pD0=useRef(0),pSc0=useRef(1),pTx0=useRef(0),pTy0=useRef(0);
  const pMx0=useRef(0),pMy0=useRef(0);
  const dId=useRef(null),dNx=useRef(0),dNy=useRef(0),dPx=useRef(0),dPy=useRef(0);
  const dragLive=useRef({id:null,x:0,y:0});
  const [dragVisual,setDragVisual]=useState(null);
  const dragVisualRef=useRef(null);
  const dragVisualRaf=useRef(null);
  const glowDebounceRef=useRef(null);
  const [isInteracting,setIsInteracting]=useState(false);

  const setDragVisualThrottled=next=>{
    dragVisualRef.current=next;
    if(dragVisualRaf.current!=null) return;
    dragVisualRaf.current=requestAnimationFrame(()=>{
      dragVisualRaf.current=null;
      setDragVisual(dragVisualRef.current);
    });
  };
  const clearDragVisual=()=>{
    dragVisualRef.current=null;
    if(dragVisualRaf.current!=null){
      cancelAnimationFrame(dragVisualRaf.current);
      dragVisualRaf.current=null;
    }
    setDragVisual(null);
  };
  const beginInteraction=()=>{
    if(glowDebounceRef.current){
      clearTimeout(glowDebounceRef.current);
      glowDebounceRef.current=null;
    }
    setIsInteracting(true);
  };
  const endInteraction=()=>{
    if(glowDebounceRef.current) clearTimeout(glowDebounceRef.current);
    glowDebounceRef.current=setTimeout(()=>{
      setIsInteracting(false);
      glowDebounceRef.current=null;
    },90);
  };

  const panR=useRef(PanResponder.create({
    onStartShouldSetPanResponder:()=>true,
    onStartShouldSetPanResponderCapture:()=>true,
    onMoveShouldSetPanResponder:(_,g)=>Math.hypot(g.dx,g.dy)>3,
    onMoveShouldSetPanResponderCapture:()=>true,
    onPanResponderGrant:evt=>{
      const ts=evt.nativeEvent.touches;
      moved.current=false;dId.current=null;pOn.current=false;
      dragLive.current={id:null,x:0,y:0};
      clearDragVisual();
      beginInteraction();
      if(ts.length>=2){
        gestureActive.current=true;
        pOn.current=true;
        pD0.current=Math.hypot(ts[0].pageX-ts[1].pageX,ts[0].pageY-ts[1].pageY);
        pSc0.current=scN.current;pTx0.current=txN.current;pTy0.current=tyN.current;
        pMx0.current=(ts[0].pageX+ts[1].pageX)/2-cL.current;
        pMy0.current=(ts[0].pageY+ts[1].pageY)/2-cT.current;
        return;
      }
      const t=ts[0];
      gSx.current=t.pageX;gSy.current=t.pageY;gLx.current=t.pageX;gLy.current=t.pageY;
      if(bR.current&&tR2.current==='move'){
        const hit=hitNode(t.pageX,t.pageY);
        if(hit){
          dId.current=hit.id;dNx.current=hit.x;dNy.current=hit.y;
          const p=toSVG(t.pageX,t.pageY);dPx.current=p.x;dPy.current=p.y;
          dragLive.current={id:hit.id,x:hit.x,y:hit.y};
          setDragVisualThrottled({id:hit.id,x:hit.x,y:hit.y});
        }
      }
    },
    onPanResponderMove:evt=>{
      const ts=evt.nativeEvent.touches;
      if(!pOn.current&&ts.length>=2){
        gestureActive.current=true;
        pOn.current=true;
        pD0.current=Math.hypot(ts[0].pageX-ts[1].pageX,ts[0].pageY-ts[1].pageY);
        pSc0.current=scN.current;pTx0.current=txN.current;pTy0.current=tyN.current;
        pMx0.current=(ts[0].pageX+ts[1].pageX)/2-cL.current;
        pMy0.current=(ts[0].pageY+ts[1].pageY)/2-cT.current;
        return;
      }
      if(pOn.current&&ts.length<2){pOn.current=false;return;}
      if(pOn.current&&ts.length>=2){
        const d=Math.hypot(ts[0].pageX-ts[1].pageX,ts[0].pageY-ts[1].pageY);
        const newSc=Math.min(Math.max(pSc0.current*(d/pD0.current),MIN_SC),MAX_SC);
        const curMx=(ts[0].pageX+ts[1].pageX)/2-cL.current;
        const curMy=(ts[0].pageY+ts[1].pageY)/2-cT.current;
        const svgMx=(pMx0.current-pTx0.current)/pSc0.current;
        const svgMy=(pMy0.current-pTy0.current)/pSc0.current;
        setLiveXform(curMx-svgMx*newSc,curMy-svgMy*newSc,newSc);
        moved.current=true;return;
      }
      if(ts.length!==1) return;
      const t=ts[0];
      if(Math.hypot(t.pageX-gSx.current,t.pageY-gSy.current)>6) moved.current=true;
      if(bR.current&&tR2.current==='move'&&dId.current){
        const p=toSVG(t.pageX,t.pageY);
        const nx=dNx.current+(p.x-dPx.current),ny=dNy.current+(p.y-dPy.current);
        dragLive.current={id:dId.current,x:nx,y:ny};
        setDragVisualThrottled({id:dId.current,x:nx,y:ny});
        gLx.current=t.pageX;gLy.current=t.pageY;return;
      }
      gestureActive.current=true;
      setLiveXform(txN.current+(t.pageX-gLx.current),tyN.current+(t.pageY-gLy.current),scN.current);
      gLx.current=t.pageX;gLy.current=t.pageY;
    },
    onPanResponderRelease:evt=>{
      pOn.current=false;
      if(gestureActive.current){
        gestureActive.current=false;
        commitLiveXform();
      }
      endInteraction();
      if(bR.current&&tR2.current==='move'&&dId.current&&moved.current){
        const live=dragLive.current;
        if(live.id){
          commit({...tR.current,nodes:tR.current.nodes.map(n=>n.id===live.id?{...n,x:live.x,y:live.y}:n)});
        }
        dId.current=null;
        dragLive.current={id:null,x:0,y:0};
        clearDragVisual();
        return;
      }
      dId.current=null;
      dragLive.current={id:null,x:0,y:0};
      clearDragVisual();
      if(moved.current) return;
      const{pageX,pageY}=evt.nativeEvent;
      const hit=hitNode(pageX,pageY);
      if(!bR.current){if(hit)setSel({...hit});return;}
      if(tR2.current==='move'&&!hit){
        const p=toSVG(pageX,pageY);pendingPos.current={x:p.x,y:p.y};showPrompt(true);return;
      }
      if(tR2.current==='connect'&&hit){
        const first=cAR.current;
        if(!first){setConnA(hit.id);return;}
        if(first===hit.id){setConnA(null);return;}
        const ex=tR.current.edges.some(e=>(e.from===first&&e.to===hit.id)||(e.from===hit.id&&e.to===first));
        if(!ex) commit({...tR.current,edges:[...tR.current.edges,{from:first,to:hit.id}]});
        setConnA(null);return;
      }
      if(tR2.current==='delete'){
        if(hit&&!hit.isStart){
          Alert.alert('Delete',`Delete "${hit.name}"?`,[
            {text:'Cancel',style:'cancel'},
            {text:'Delete',style:'destructive',onPress:()=>{
              const nextInfo={...(tR.current.info||{})};
              delete nextInfo[hit.id];
              commit({
                ...tR.current,
                nodes:tR.current.nodes.filter(n=>n.id!==hit.id),
                edges:tR.current.edges.filter(e=>e.from!==hit.id&&e.to!==hit.id),
                info:nextInfo,
              });
            }},
          ]);return;
        }
        if(!hit){
          const p=toSVG(pageX,pageY);
          const idx=tR.current.edges.findIndex(e=>{
            const fn=tR.current.nodes.find(n=>n.id===e.from);
            const tn=tR.current.nodes.find(n=>n.id===e.to);
            return fn&&tn&&segDist(p.x,p.y,fn.x,fn.y,tn.x,tn.y)<28;
          });
          if(idx!==-1) commit({...tR.current,edges:tR.current.edges.filter((_,i)=>i!==idx)});
        }
      }
    },
    onPanResponderTerminate:()=>{
      pOn.current=false;
      if(gestureActive.current){gestureActive.current=false;commitLiveXform();}
      endInteraction();
      dId.current=null;
      dragLive.current={id:null,x:0,y:0};
      clearDragVisual();
    },
  })).current;

  const addNode=name=>{
    const id=name.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'')+'_'+Date.now();
    commit({
      ...tR.current,
      nodes:[...tR.current.nodes,{id,name,x:pendingPos.current.x,y:pendingPos.current.y,unlocked:false,isStart:false,branch:'core'}],
      info:{...tR.current.info,[id]:{desc:'No description yet.',str:5,bal:5,tec:5}},
    });
    showPrompt(false);
  };
  const record=id=>{
    const t={...tR.current,nodes:tR.current.nodes.map(n=>n.id===id?{...n,unlocked:true}:n)};
    commit(t);setSel(prev=>prev?{...prev,unlocked:true}:null);
  };
  const exportTree=async()=>{
    try{
      const json=JSON.stringify(tR.current,null,2);
      const path=FileSystem.cacheDirectory+'calisthenics_tree.json';
      await FileSystem.writeAsStringAsync(path,json,{encoding:'utf8'});
      await Sharing.shareAsync(path,{mimeType:'application/json',dialogTitle:'Export Skill Tree'});
    }catch(e){Alert.alert('Export failed',String(e));}
  };
  const importTree=async()=>{
    try{
      const res=await DocumentPicker.getDocumentAsync({type:'application/json',copyToCacheDirectory:true});
      if(res.canceled) return;
      const raw=await FileSystem.readAsStringAsync(res.assets[0].uri,{encoding:'utf8'});
      const parsed=JSON.parse(raw);
      if(!parsed||typeof parsed!=='object'||!Array.isArray(parsed.nodes)||!Array.isArray(parsed.edges)){
        Alert.alert('Invalid file','Not a valid skill tree JSON.');
        return;
      }
      const t=normalizeTree(parsed);
      Alert.alert('Import Tree','Replace current tree with imported one?',[
        {text:'Cancel',style:'cancel'},
        {text:'Import',onPress:()=>{
          hist.current=[t];hi.current=0;
          setTree(t);setCU(false);setCR(false);
          AsyncStorage.setItem(STORAGE_KEY,JSON.stringify(t)).catch(()=>{});
        }},
      ]);
    }catch(e){Alert.alert('Import failed',String(e));}
  };

  const nodeMap=useMemo(()=>new Map(tree.nodes.map(n=>[n.id,n])),[tree.nodes]);
  const incomingByNode=useMemo(()=>{
    const incoming=new Map();
    for(const e of tree.edges){
      if(!incoming.has(e.to)) incoming.set(e.to,[]);
      incoming.get(e.to).push(e.from);
    }
    return incoming;
  },[tree.edges]);

  const nodeStatusMap=useMemo(()=>{
    const status={};
    for(const n of tree.nodes){
      if(n.isStart){
        status[n.id]='start';
        continue;
      }
      if(n.unlocked){
        status[n.id]='mastered';
        continue;
      }
      if(!bld){
        const prereqs=incomingByNode.get(n.id) || [];
        const ready=prereqs.length>0 && prereqs.every(pid=>nodeMap.get(pid)?.unlocked);
        status[n.id]=ready?'ready':'locked';
      }else{
        status[n.id]='locked';
      }
    }
    return status;
  },[tree.nodes,bld,incomingByNode,nodeMap]);

  // ── SVG node/edge styling ──────────────────────────────────────────────────
  const nStyle=n=>{
    const branch = resolveBranch(n);
    const bc = BRANCH_COLORS[branch] || BRANCH_COLORS.neutral;
    const status=nodeStatusMap[n.id] || 'locked';
    if(bld&&connA===n.id) return{
      fill:'#111827', innerFill:'#0B1220', outerRim:'#1E293B', stroke:Colors.blue[300], ring:toRGBA(Colors.blue[300],0.8),
      glowInner:toRGBA(Colors.blue[300],0.3), glowMid:toRGBA(Colors.blue[400],0.2), glowOuter:toRGBA(Colors.blue[500],0.16), sw:2.5, opacity:1,
    };
    if(status==='start') return {
      fill:'#16243A', innerFill:'#101A2A', outerRim:'#26364D', stroke:Colors.blue[300], ring:toRGBA(Colors.blue[300],0.7),
      glowInner:toRGBA(Colors.blue[300],0.36), glowMid:toRGBA(Colors.blue[400],0.24), glowOuter:toRGBA(Colors.blue[500],0.19), sw:2.4, opacity:1,
    };
    if(status==='mastered') return {
      fill:'#131A26', innerFill:'#0D131D', outerRim:'#263140', stroke:bc.main, ring:toRGBA(bc.ring,0.8),
      glowInner:toRGBA(bc.ring,0.32), glowMid:toRGBA(bc.main,0.24), glowOuter:toRGBA(bc.main,0.17), sw:2.3, opacity:0.98,
    };
    if(status==='ready') return {
      fill:'#171E2A', innerFill:'#101620', outerRim:'#2A3546', stroke:bc.main, ring:toRGBA(bc.ring,0.78),
      glowInner:toRGBA(bc.ring,0.28), glowMid:toRGBA(bc.main,0.2), glowOuter:toRGBA(bc.main,0.14), sw:2.1, opacity:0.95,
    };
    return {
      fill:'#0E141D', innerFill:'#090E15', outerRim:'#1F2937', stroke:'#334155', ring:'rgba(71,85,105,0.45)',
      glowInner:'rgba(71,85,105,0.12)', glowMid:'rgba(71,85,105,0.09)', glowOuter:'rgba(71,85,105,0.06)', sw:1.5, opacity:0.88,
    };
  };

  const wrap=name=>{
    const words=name.split(' ');const lines=[];let cur='';
    for(const w of words){const next=cur?cur+' '+w:w;if(next.length>10&&cur){lines.push(cur);cur=w;}else cur=next;}
    if(cur)lines.push(cur);return lines;
  };

  const wrappedLabels=useMemo(()=>{
    const labels={};
    for(const n of tree.nodes) labels[n.id]=wrap(n.name);
    return labels;
  },[tree.nodes]);

  const visibleBounds=useMemo(()=>{
    if(!canvasSize.width||!canvasSize.height) return null;
    return {
      left:(-xform.tx)/xform.sc,
      top:(-xform.ty)/xform.sc,
      right:(canvasSize.width-xform.tx)/xform.sc,
      bottom:(canvasSize.height-xform.ty)/xform.sc,
    };
  },[canvasSize.height,canvasSize.width,xform.sc,xform.tx,xform.ty]);

  const visibleNodes=useMemo(()=>{
    if(!visibleBounds) return tree.nodes;
    const margin=Math.min(Math.max((NODE_R*2)/xform.sc,NODE_R*2),NODE_R*12);
    return tree.nodes.filter(n=>
      n.x>=visibleBounds.left-margin&&n.x<=visibleBounds.right+margin&&
      n.y>=visibleBounds.top-margin&&n.y<=visibleBounds.bottom+margin
    );
  },[tree.nodes,visibleBounds,xform.sc]);

  const visibleNodeIds=useMemo(()=>new Set(visibleNodes.map(n=>n.id)),[visibleNodes]);

  const visibleEdges=useMemo(()=>tree.edges.filter(e=>
    visibleNodeIds.has(e.from)||visibleNodeIds.has(e.to)
  ),[tree.edges,visibleNodeIds]);

  const lodTier=useMemo(()=>{
    if(xform.sc<0.35) return 'far';
    if(xform.sc<0.75) return 'mid';
    return 'near';
  },[xform.sc]);

  const LOD=useMemo(()=>({
    isFar:lodTier==='far',
    isMid:lodTier==='mid',
    isNear:lodTier==='near',
    showLabels:lodTier==='near',
    showInnerRing:lodTier!=='far',
    showOuterRing:lodTier==='near',
    useDashedReady:lodTier==='near',
  }),[lodTier]);

  const edgeVisual=useMemo(()=>{
    if(LOD.isFar) return {masteredW:1.2,readyW:1.05,lockedW:0.9,masteredO:0.68,readyO:0.56,lockedO:0.28};
    if(LOD.isMid) return {masteredW:1.9,readyW:1.55,lockedW:1.2,masteredO:0.8,readyO:0.68,lockedO:0.34};
    return {masteredW:2.8,readyW:2.3,lockedW:1.5,masteredO:0.9,readyO:0.8,lockedO:0.44};
  },[LOD.isFar,LOD.isMid]);

  useEffect(()=>{
    if(!DEV_PERF_LOG) return;
    const id=setInterval(()=>{
      console.log('[perf]',{
        visibleNodes:visibleNodes.length,
        visibleEdges:visibleEdges.length,
        scale:xform.sc.toFixed(3),
        lodTier,
      });
    },1000);
    return ()=>clearInterval(id);
  },[visibleNodes.length,visibleEdges.length,xform.sc,lodTier]);

  const hints={
    move:   'Drag nodes to reposition · Tap empty space to add',
    connect:connA?'Now tap second node to connect':'Tap first node to begin branch',
    delete: 'Tap a node or line to delete it',
  };

  return(
    <View style={S.root}>
      {/* Top bar */}
      <View style={[S.bar,{paddingTop:insets.top+10}]}>
        <Text style={S.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>KINETIC SKILL TREE</Text>
        <View style={S.barRight}>
          {!bld&&(
            <TouchableOpacity style={S.resetBtn} onPress={()=>{
              Alert.alert('Reset Progress','Set all skills back to locked? Your tree structure stays intact.',[
                {text:'Cancel',style:'cancel'},
                {text:'Reset',style:'destructive',onPress:()=>{
                  const t={...tR.current,nodes:tR.current.nodes.map(n=>n.isStart?n:{...n,unlocked:false})};
                  commit(t);
                }},
              ]);
            }}>
              <Text style={S.resetT}>RESET</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[S.modeBtn,bld&&S.modeOn]}
            onPress={()=>{setBld(!bld);setConnA(null);dId.current=null;}}>
            <Text style={[S.modeT,bld&&S.modeTOn]}>{bld?'DONE':'EDIT TREE'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Edit toolbar */}
      {bld&&(
        <View style={S.toolbar}>
          <View style={S.tg}>
            {[['move','Move/Add'],['connect','Connect'],['delete','Delete']].map(([id,lbl])=>(
              <TouchableOpacity key={id} style={[S.tBtn,tool===id&&S.tOn]}
                onPress={()=>{setTool(id);setConnA(null);}}>
                <Text style={[S.tT,tool===id&&S.tTOn]}>{lbl}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={S.tg}>
            <TouchableOpacity style={[S.uBtn,!canUndo&&S.dim]} onPress={undo} disabled={!canUndo}>
              <Text style={S.uT}>Undo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[S.uBtn,!canRedo&&S.dim]} onPress={redo} disabled={!canRedo}>
              <Text style={S.uT}>Redo</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {bld&&(
        <View style={S.ioRow}>
          <TouchableOpacity style={S.ioBtn} onPress={exportTree}>
            <Text style={S.ioT}>⬆  EXPORT</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.ioBtn} onPress={importTree}>
            <Text style={S.ioT}>⬇  IMPORT</Text>
          </TouchableOpacity>
        </View>
      )}
      {bld&&<View style={S.hintRow}><Text style={S.hintT}>{hints[tool]}</Text></View>}

      {/* Canvas */}
      <View ref={cRef} style={S.canvas}
        onLayout={(evt)=>{
          const { width, height } = evt.nativeEvent.layout;
          setCanvasSize({width,height});
          setTimeout(measureC,50);
        }}
        {...panR.panHandlers}>
        {!!canvasSize.width&&!!canvasSize.height&&(
          <SkiaTreeCanvas
            tree={tree}
            visibleNodes={visibleNodes}
            visibleEdges={visibleEdges}
            nodeStatusMap={nodeStatusMap}
            wrappedLabels={wrappedLabels}
            txV={txV}
            tyV={tyV}
            scV={scV}
            dragVisual={dragVisual}
            LOD={LOD}
            edgeVisual={edgeVisual}
            bld={bld}
            connA={connA}
            isInteracting={isInteracting}
            canvasSize={canvasSize}
            nStyle={nStyle}
          />
        )}
      </View>

      {/* Legend */}
      {!bld&&(
        <View style={S.legend}>
          {[
            [BRANCH_COLORS.push.main,'Push'],
            [BRANCH_COLORS.pull.main,'Pull'],
            [BRANCH_COLORS.core.main,'Core'],
            ['#334155','Locked'],
          ].map(([c,l])=>(
            <View key={l} style={S.lr}>
              <View style={[S.dot,{backgroundColor:c}]}/>
              <Text style={S.lt}>{l}</Text>
            </View>
          ))}
        </View>
      )}

      <NamePrompt visible={prompt} onConfirm={addNode} onCancel={()=>showPrompt(false)}/>
      {sel&&!bld&&(
        <SkillCard node={sel} nodes={tree.nodes} edges={tree.edges}
          info={tree.info?.[sel.id]}
          onClose={()=>setSel(null)} onRecord={record}/>
      )}
    </View>
  );
}



function getTreeStats(tree){
  const nodes = tree?.nodes || [];
  const unlocked = nodes.filter((n)=>n.unlocked || n.isStart);
  const byBranch = ['push','pull','core'].reduce((acc, b)=>{
    const branchNodes = nodes.filter((n)=>resolveBranch(n)===b);
    const unlockedCount = branchNodes.filter((n)=>n.unlocked).length;
    acc[b] = { total: branchNodes.length, unlocked: unlockedCount, pct: branchNodes.length ? Math.round((unlockedCount / branchNodes.length) * 100) : 0 };
    return acc;
  }, {});
  const leadingBranch = ['push','pull','core'].sort((a,b)=>byBranch[b].pct - byBranch[a].pct)[0] || 'push';
  const completionPct = nodes.length ? Math.round((unlocked.length / nodes.length) * 100) : 0;
  return { total: nodes.length, unlocked: unlocked.length, completionPct, byBranch, leadingBranch };
}

function StatChip({ label, value, accent }){
  return (
    <View style={[tabs.statCard, { borderColor: toRGBA(accent, 0.38) }]}>
      <Text style={tabs.statValue}>{value}</Text>
      <Text style={tabs.statLabel}>{label}</Text>
    </View>
  );
}

function ProfileScreen({ tree }){
  const stats = useMemo(()=>getTreeStats(tree || INIT),[tree]);
  const leadingBranchColor = BRANCH_COLORS[stats.leadingBranch]?.main || Colors.blue[400];
  return (
    <ScrollView contentContainerStyle={tabs.content} style={tabs.page}>
      <View style={tabs.profileHeader}>
        <View style={tabs.avatarOrb}><Ionicons name="fitness" size={22} color={Colors.blue[300]} /></View>
        <View style={{ flex: 1 }}>
          <Text style={tabs.profileName}>Kinetic Athlete</Text>
          <Text style={tabs.profileSub}>Level {Math.max(1, Math.floor(stats.unlocked / 2))} · Build momentum daily</Text>
        </View>
        <TouchableOpacity style={tabs.headerAction}><Ionicons name="settings-outline" size={18} color={Colors.text.secondary} /></TouchableOpacity>
      </View>

      <View style={tabs.statGrid}>
        <StatChip label="Total Skills" value={stats.total} accent={Colors.blue[400]} />
        <StatChip label="Unlocked" value={stats.unlocked} accent={Colors.green[500]} />
        <StatChip label="Completion" value={`${stats.completionPct}%`} accent={Colors.yellow[400]} />
        <StatChip label="Leading Branch" value={stats.leadingBranch.toUpperCase()} accent={leadingBranchColor} />
      </View>

      <View style={tabs.card}>
        <Text style={tabs.cardTitle}>Tree Progress</Text>
        {['push','pull','core'].map((branch)=>{
          const b = stats.byBranch[branch];
          const color = BRANCH_COLORS[branch].main;
          return (
            <View key={branch} style={tabs.progressRow}>
              <Text style={[tabs.progressLabel, { color }]}>{branch.toUpperCase()}</Text>
              <View style={tabs.progressTrack}><View style={[tabs.progressFill, { width: `${b.pct}%`, backgroundColor: color }]} /></View>
              <Text style={tabs.progressMeta}>{b.unlocked}/{b.total}</Text>
            </View>
          );
        })}
      </View>

      <View style={tabs.card}>
        <Text style={tabs.cardTitle}>Highlights</Text>
        <Text style={tabs.cardBody}>• Leading branch: {stats.leadingBranch.toUpperCase()} ({stats.byBranch[stats.leadingBranch]?.pct || 0}% complete)</Text>
        <Text style={tabs.cardBody}>• Skills unlocked: {stats.unlocked} of {stats.total}</Text>
        <Text style={tabs.cardBody}>• Note: streaks and milestones are not tracked yet.</Text>
      </View>

      <View style={tabs.card}>
        <Text style={tabs.cardTitle}>Actions</Text>
        {['Edit Profile', 'Preferences', 'Export Progress', 'Tree Settings'].map((row)=>(
          <TouchableOpacity key={row} style={tabs.actionRow}>
            <Text style={tabs.settingLabel}>{row}</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.slate[400]} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

function SettingsScreen(){
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  return (
    <ScrollView contentContainerStyle={tabs.content} style={tabs.page}>
      <Text style={tabs.pageTitle}>Settings</Text>
      <View style={tabs.card}>
        <View style={tabs.settingRow}>
          <Text style={tabs.settingLabel}>Push Notifications</Text>
          <Switch value={notifications} onValueChange={setNotifications} trackColor={{false:'#334155', true:'#3B82F6'}} thumbColor={notifications ? '#93C5FD' : '#CBD5E1'} />
        </View>
        <View style={tabs.settingRow}>
          <Text style={tabs.settingLabel}>Dark Theme</Text>
          <Switch value={darkMode} onValueChange={setDarkMode} trackColor={{false:'#334155', true:'#16A34A'}} thumbColor={darkMode ? '#86EFAC' : '#CBD5E1'} />
        </View>
        <View style={tabs.settingRow}>
          <Text style={tabs.settingLabel}>Haptics</Text>
          <Ionicons name="phone-portrait-outline" size={17} color={Colors.slate[300]} />
        </View>
        <View style={tabs.settingRow}>
          <Text style={tabs.settingLabel}>Data Sync</Text>
          <Text style={tabs.cardBody}>Manual</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function AppShell(){
  const [tab, setTab] = useState('Tree');
  const [treeSnapshot, setTreeSnapshot] = useState(normalizeTree(INIT));
  const insets = useSafeAreaInsets();

  const tabsConfig = [
    { key: 'Tree', icon: 'git-network-outline' },
    { key: 'Profile', icon: 'person-outline' },
    { key: 'Settings', icon: 'settings-outline' },
    { key: 'Daily', icon: 'lock-closed-outline', locked: true },
  ];

  return (
    <View style={tabs.safeRoot}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={tabs.root}>
        <View style={tabs.contentWrap}>
          {tab === 'Tree' && <TreeScreen onTreeChange={setTreeSnapshot} />}
          {tab === 'Profile' && <ProfileScreen tree={treeSnapshot} />}
          {tab === 'Settings' && <SettingsScreen />}
        </View>

        <View style={[tabs.navBar, { paddingBottom: insets.bottom }]}> 
          {tabsConfig.map((item) => {
            const active = tab === item.key;
            if (item.locked) {
              return (
                <View key={item.key} style={[tabs.navItem, tabs.navItemLocked]}>
                  <View style={tabs.navPill}>
                    <Ionicons name={item.icon} size={24} color="#6B7280" />
                  </View>
                  <Text style={[tabs.navLabel, tabs.navLocked]}>{item.key}</Text>
                </View>
              );
            }
            return (
              <TouchableOpacity key={item.key} style={tabs.navItem} onPress={() => setTab(item.key)}>
                <View style={[tabs.navPill, active && tabs.navPillActive]}>
                  <Ionicons name={item.icon} size={24} color={active ? '#FFFFFF' : '#6B7280'} />
                </View>
                <Text style={[tabs.navLabel, active && tabs.navLabelActive]}>{item.key}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function App(){
  return (
    <SafeAreaProvider>
      <AppShell />
    </SafeAreaProvider>
  );
}

const tabs = StyleSheet.create({
  safeRoot: { flex: 1, backgroundColor: Colors.background.primary },
  root: { flex: 1, backgroundColor: Colors.background.primary },
  contentWrap: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.1)',
    backgroundColor: '#1A1D23',
    paddingTop: 8,
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  navItemLocked: { opacity: 0.55 },
  navPill: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  navPillActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    shadowColor: '#60A5FA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  navLabel: { color: '#6B7280', fontSize: 12, fontWeight: '600' },
  navLabelActive: { color: '#FFFFFF' },
  navLocked: { color: '#6B7280' },
  page: { flex: 1, backgroundColor: Colors.background.primary },
  content: { padding: 16, gap: 14 },
  pageTitle: { color: Colors.blue[300], fontSize: 26, fontWeight: '800', marginBottom: 4, letterSpacing: 1 },
  profileHeader: {
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.blue,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarOrb: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#101A2B',
    borderColor: Colors.border.blueActive,
    borderWidth: 1,
  },
  profileName: { color: Colors.text.primary, fontSize: 17, fontWeight: '800' },
  profileSub: { color: Colors.text.tertiary, marginTop: 2 },
  headerAction: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#131A25' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '48%',
    backgroundColor: Colors.background.cardAlt,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  statValue: { color: Colors.text.primary, fontSize: 19, fontWeight: '800' },
  statLabel: { color: Colors.text.tertiary, fontSize: 12, marginTop: 4 },
  card: {
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  cardTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' },
  cardBody: { color: Colors.text.tertiary, fontSize: 15 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  progressLabel: { width: 48, fontSize: 12, fontWeight: '700' },
  progressTrack: { flex: 1, height: 8, borderRadius: 999, backgroundColor: '#111827', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  progressMeta: { color: Colors.slate[400], width: 40, fontSize: 12, textAlign: 'right' },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingLabel: { color: Colors.text.secondary, fontSize: 15 },
});
const S=StyleSheet.create({
  root:    {flex:1,backgroundColor:Colors.background.primary},
  bar:     {flexDirection:'row',justifyContent:'space-between',alignItems:'center',
            paddingHorizontal:14,paddingTop:10,paddingBottom:10,gap:10,
            backgroundColor:'#060A10',borderBottomWidth:1,borderColor:Colors.border.default},
  barRight:{flexDirection:'row',alignItems:'center',gap:8,flexShrink:1},
  title:   {color:Colors.blue[300],fontSize:13,fontWeight:'800',letterSpacing:3,
            textShadowColor:toRGBA(Colors.blue[400],0.7),textShadowRadius:8,flexShrink:1,paddingRight:8},
  resetBtn:{paddingHorizontal:12,paddingVertical:8,borderRadius:8,
            backgroundColor:'#151922',borderWidth:1,borderColor:'rgba(239,68,68,0.6)',
            shadowColor:'#EF4444',shadowOpacity:0.22,shadowRadius:8,shadowOffset:{width:0,height:0}},
  resetT:  {color:'#f87171',fontSize:11,fontWeight:'800',letterSpacing:1.5},
  modeBtn: {paddingHorizontal:12,paddingVertical:8,borderRadius:6,
            backgroundColor:'#151a24',borderWidth:1,borderColor:Colors.border.default},
  modeOn:  {backgroundColor:'#12283d',borderColor:'rgba(59,130,246,0.45)'},
  modeT:   {color:Colors.text.tertiary,fontSize:11,fontWeight:'800',letterSpacing:1.5},
  modeTOn: {color:Colors.green[400]},
  toolbar: {flexDirection:'row',justifyContent:'space-between',alignItems:'center',
            paddingHorizontal:10,paddingVertical:10,rowGap:8,
            backgroundColor:Colors.background.secondary,borderBottomWidth:1,borderColor:Colors.border.default,flexWrap:'wrap'},
  tg:      {flexDirection:'row',gap:7,flexWrap:'wrap'},
  tBtn:    {paddingHorizontal:11,paddingVertical:8,borderRadius:6,
            backgroundColor:'#121722',borderWidth:1,borderColor:Colors.border.default},
  tOn:     {backgroundColor:'rgba(59,130,246,0.18)',borderColor:'rgba(59,130,246,0.4)'},
  tT:      {color:Colors.text.tertiary,fontSize:12,fontWeight:'600'},
  tTOn:    {color:Colors.blue[300]},
  uBtn:    {paddingHorizontal:11,paddingVertical:8,borderRadius:6,
            backgroundColor:Colors.background.primary,borderWidth:1,borderColor:Colors.border.default},
  dim:     {opacity:0.2},
  uT:      {color:Colors.text.tertiary,fontSize:12,fontWeight:'600'},
  ioRow:   {flexDirection:'row',gap:10,paddingHorizontal:14,paddingVertical:8,backgroundColor:Colors.background.primary},
  ioBtn:   {flex:1,backgroundColor:Colors.background.cardAlt,borderRadius:6,paddingVertical:10,
            alignItems:'center',borderWidth:1,borderColor:Colors.border.default},
  ioT:     {color:Colors.text.secondary,fontSize:12,fontWeight:'800',letterSpacing:2},
  hintRow: {paddingHorizontal:16,paddingVertical:6,backgroundColor:Colors.background.primary},
  hintT:   {color:Colors.text.tertiary,fontSize:11,textAlign:'center',letterSpacing:0.5},
  canvas:  {flex:1,backgroundColor:'#05080F',overflow:'hidden'},
  legend:  {flexDirection:'row',justifyContent:'center',gap:28,paddingVertical:12,
            backgroundColor:'#060A10',borderTopWidth:1,borderColor:Colors.border.default},
  lr:      {flexDirection:'row',alignItems:'center',gap:7},
  dot:     {width:8,height:8,borderRadius:4},
  lt:      {color:Colors.text.secondary,fontSize:11,letterSpacing:1},
});
