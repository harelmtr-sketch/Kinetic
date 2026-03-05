/**
 * Calisthenics Skill Tree
 * Dark stone / RPG aesthetic — inspired by the reference card design.
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
  Atlas,
  BlurMask,
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  Paint,
  Path,
  Rect,
  Skia,
  Text as SkiaText,
  matchFont,
} from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withRepeat, withTiming, configureReanimatedLogger } from 'react-native-reanimated';

const STORAGE_KEY = 'calisthenics_tree_v1';
const NODE_R = 46;
const MIN_SC = 0.15;
const MAX_SC = 6;
const DEV_PERF_LOG = false;
const USE_GLOW = true;
const GLOW_QUALITY = 'low'; // 'low' | 'high'
const USE_REANIMATED_TRANSFORM = Platform.OS !== 'android';

configureReanimatedLogger({
  level: 1,
  strict: false,
});

// Colours — dark stone palette
const C = {
  bg:        '#0e0c0a',   // near-black warm
  bgCard:    '#181410',   // card background
  bgDeep:    '#100e0c',
  stone:     '#2a2420',   // panel border
  stoneLt:   '#3a3028',
  gold:      '#c8a84b',   // gold accent
  goldDim:   '#6b5a28',
  green:     '#4a9c6a',
  greenGlow: '#2d6b47',
  amber:     '#d4800a',
  red:       '#c04040',
  blue:      '#4070c0',
  textMain:  '#e8d9b8',   // warm parchment white
  textDim:   '#7a6a54',
  textFaint: '#3d3428',
};

const INIT = {
  nodes:[
    {id:'start',      name:'Start',          x:450,y:100, unlocked:true, isStart:true },
    {id:'dead_hang',  name:'Dead Hang',       x:250,y:280, unlocked:false,isStart:false},
    {id:'pushup',     name:'Push-Up',         x:650,y:280, unlocked:false,isStart:false},
    {id:'active_hang',name:'Active Hang',     x:250,y:460, unlocked:false,isStart:false},
    {id:'diamond_pu', name:'Diamond Push-Up', x:650,y:460, unlocked:false,isStart:false},
    {id:'scap_pulls', name:'Scapular Pulls',  x:120,y:640, unlocked:false,isStart:false},
    {id:'neg_pullup', name:'Neg. Pull-Up',    x:380,y:640, unlocked:false,isStart:false},
    {id:'pike_pu',    name:'Pike Push-Up',    x:650,y:640, unlocked:false,isStart:false},
    {id:'pullup',     name:'Pull-Up',         x:250,y:820, unlocked:false,isStart:false},
    {id:'hspu',       name:'HSPU',            x:650,y:820, unlocked:false,isStart:false},
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



function hashStringToFloat(str, salt=0){
  let h = 2166136261 ^ salt;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function hash01(seed, i){
  let x = (seed + i * 374761393) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}


function makeStarPath(r){
  const p = Skia.Path.Make();
  const points = 8;
  const inner = r * 0.52;
  for(let i=0;i<points*2;i++){
    const a = (-Math.PI/2) + (i*Math.PI/points);
    const rr = i%2===0 ? r : inner;
    const x = Math.cos(a)*rr;
    const y = Math.sin(a)*rr;
    if(i===0) p.moveTo(x,y);
    else p.lineTo(x,y);
  }
  p.close();
  return p;
}
function makeHexStonePath(r, seedKey){
  const p = Skia.Path.Make();
  for(let i=0;i<6;i++){
    const a = (-Math.PI/2) + (i*Math.PI/3);
    const j = 0.88 + hashStringToFloat(`${seedKey}_${i}`, 17) * 0.2;
    const x = Math.cos(a)*r*j;
    const y = Math.sin(a)*r*j;
    if(i===0) p.moveTo(x,y);
    else p.lineTo(x,y);
  }
  p.close();
  return p;
}
function makeDiamondPath(r){
  const b = r*0.3;
  const pts = [
    {x:0,y:-r},{x:b,y:-(r-b)},{x:r,y:0},{x:r-b,y:b},
    {x:0,y:r},{x:-b,y:r-b},{x:-r,y:0},{x:-(r-b),y:-b},
  ];
  const p = Skia.Path.Make();
  pts.forEach((pt,i)=>{ if(i===0) p.moveTo(pt.x,pt.y); else p.lineTo(pt.x,pt.y); });
  p.close();
  return p;
}
function makeRoundSquarePath(r, corner=10){
  const c = Math.min(corner, r*0.45);
  const pts = [
    {x:-r+c,y:-r},{x:r-c,y:-r},{x:r,y:-r+c},{x:r,y:r-c},
    {x:r-c,y:r},{x:-r+c,y:r},{x:-r,y:r-c},{x:-r,y:-r+c},
  ];
  const p = Skia.Path.Make();
  pts.forEach((pt,i)=>{ if(i===0) p.moveTo(pt.x,pt.y); else p.lineTo(pt.x,pt.y); });
  p.close();
  return p;
}

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
  segEmpty: {flex:1,height:14,borderRadius:3,backgroundColor:'#2a2218',borderWidth:1,borderColor:'#3a3020'},
  num:      {width:24,textAlign:'right',fontSize:15,fontWeight:'700',marginLeft:8},
});

// ── Skill Card ────────────────────────────────────────────────────────────────
function SkillCard({node,nodes,edges,onClose,onRecord}){
  const info = INIT.info[node.id] || {desc:'',str:5,bal:5,tec:5};
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

          {/* Difficulty section */}
          {!node.isStart && (
            <View style={cs.diffSection}>
              <Text style={cs.sectionLabel}>DIFFICULTY</Text>
              <DiffBar label="Strength"  value={info.str} color="#c04040" glowColor="#ff2020"/>
              <DiffBar label="Balance"   value={info.bal} color="#3a70d0" glowColor="#2060ff"/>
              <DiffBar label="Technique" value={info.tec} color="#b09020" glowColor="#ffd030"/>
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
  sectionLabel:{color:C.textDim,fontSize:10,fontWeight:'800',letterSpacing:3,textAlign:'center',marginBottom:14},

  symbolRow:   {alignItems:'center',paddingVertical:10},
  symbolCircle:{width:36,height:36,borderRadius:18,borderWidth:1.5,borderColor:C.stoneLt,backgroundColor:'#1a1612'},

  mediaBg:     {marginHorizontal:18,marginVertical:10,height:160,backgroundColor:'#1a1510',
                borderRadius:10,borderWidth:1,borderColor:C.stone,
                alignItems:'center',justifyContent:'center'},
  mediaLabel:  {color:C.textFaint,fontSize:11,fontWeight:'700',letterSpacing:2,marginBottom:4},
  mediaHint:   {color:C.textFaint,fontSize:10},

  prereqBox:   {marginHorizontal:18,marginBottom:8,padding:12,backgroundColor:'#1e0e0e',
                borderRadius:8,borderWidth:1,borderColor:'#6b2020'},
  prereqTitle: {color:'#c04040',fontSize:9,fontWeight:'800',letterSpacing:2.5,marginBottom:6},
  prereqItem:  {color:'#a06060',fontSize:13,marginBottom:3},

  attemptBtn:  {margin:18,marginTop:10,backgroundColor:'#1a1510',borderRadius:10,paddingVertical:18,
                alignItems:'center',borderWidth:1.5,borderColor:C.gold,
                shadowColor:C.gold,shadowOpacity:0.3,shadowRadius:12,shadowOffset:{width:0,height:0}},
  attemptBtnT: {color:C.gold,fontSize:17,fontWeight:'800',letterSpacing:5,
                textShadowColor:C.gold,textShadowRadius:10},

  lockedBtn:   {margin:18,marginTop:10,backgroundColor:'#160e0e',borderRadius:10,paddingVertical:18,
                alignItems:'center',borderWidth:1,borderColor:'#4a2020'},
  lockedBtnT:  {color:'#6a3030',fontSize:13,fontWeight:'700',letterSpacing:2},

  masteredBtn: {margin:18,marginTop:10,backgroundColor:'#0a1810',borderRadius:10,paddingVertical:18,
                alignItems:'center',borderWidth:1.5,borderColor:C.green,
                shadowColor:C.green,shadowOpacity:0.3,shadowRadius:12,shadowOffset:{width:0,height:0}},
  masteredBtnT:{color:C.green,fontSize:17,fontWeight:'800',letterSpacing:5},

  originBtn:   {margin:18,marginTop:10,backgroundColor:'#161208',borderRadius:10,paddingVertical:18,
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
          <TextInput value={val} onChangeText={setVal}
            placeholder="Skill name..." placeholderTextColor={C.textFaint}
            autoFocus returnKeyType="done" onSubmitEditing={ok}
            selectionColor={C.gold} style={[np.input,{color:C.textMain}]}/>
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
  input:  {backgroundColor:'#100e0c',borderRadius:10,padding:16,fontSize:17,borderWidth:1,borderColor:C.stone,marginBottom:16,color:C.textMain},
  row:    {flexDirection:'row',gap:10},
  cancel: {flex:1,backgroundColor:'#1a1410',borderRadius:10,paddingVertical:14,alignItems:'center',borderWidth:1,borderColor:C.stone},
  cancelT:{color:C.textDim,fontWeight:'600'},
  add:    {flex:1,backgroundColor:'#1a1510',borderRadius:10,paddingVertical:14,alignItems:'center',borderWidth:1,borderColor:C.gold},
  off:    {opacity:0.3},
  addT:   {color:C.gold,fontWeight:'800',letterSpacing:2},
});

function StoneBackgroundSkia({canvasSize, txV, tyV, scV, isInteracting}){
  const bgTransform = useDerivedValue(() => {
    'worklet';
    const tx = txV.value;
    const ty = tyV.value;
    return [
      { translateX: tx * 0.25 },
      { translateY: ty * 0.25 },
    ];
  }, [txV, tyV, scV]);

  const bgGeometry = useMemo(() => {
    const w = canvasSize.width;
    const h = canvasSize.height;
    if (!w || !h) return { veinPaths: [], dust: [] };

    const seed = 1337;
    const span = Math.max(w, h) * 0.35;
    const minX = -span;
    const minY = -span;
    const areaW = w + span * 2;
    const areaH = h + span * 2;

    const veinPaths = Array.from({ length: 10 }, (_, i) => {
      const p = Skia.Path.Make();
      const points = 5 + Math.floor(hash01(seed, i * 23 + 1) * 3);
      let x = minX + hash01(seed, i * 23 + 2) * areaW;
      let y = minY + hash01(seed, i * 23 + 3) * areaH;
      p.moveTo(x, y);
      for(let k=0;k<points;k++){
        const step = 60 + hash01(seed, i * 23 + 7 + k) * 120;
        const angle = hash01(seed, i * 23 + 11 + k) * Math.PI * 2;
        x += Math.cos(angle) * step;
        y += Math.sin(angle) * step;
        p.lineTo(x, y);
      }
      return p;
    });

    const dustCount = 120;
    const dust = Array.from({ length: dustCount }, (_, i) => ({
      id: `dust_${i}`,
      x: minX + hash01(seed, i * 13 + 91) * areaW,
      y: minY + hash01(seed, i * 13 + 92) * areaH,
      s: 2 + Math.floor(hash01(seed, i * 13 + 93) * 5),
      o: 0.04 + hash01(seed, i * 13 + 94) * 0.08,
    }));

    return { veinPaths, dust };
  }, [canvasSize.height, canvasSize.width]);

  const dustOpacity = isInteracting ? 0.75 : 1;
  const veinOpacity = isInteracting ? 0.6 : 1;
  const visibleDust = useMemo(() => {
    if(!isInteracting) return bgGeometry.dust;
    const keep = Math.max(180, Math.floor(bgGeometry.dust.length * 0.45));
    return bgGeometry.dust.slice(0, keep);
  }, [bgGeometry.dust, isInteracting]);

  return (
    <>
      <Rect x={0} y={0} width={canvasSize.width} height={canvasSize.height} color="#1b1712" />
      <Rect x={0} y={0} width={canvasSize.width} height={canvasSize.height * 0.58} color="rgba(255,232,190,0.04)" />
      <Circle cx={canvasSize.width * 0.5} cy={canvasSize.height * 0.5} r={Math.max(canvasSize.width, canvasSize.height) * 0.76} color="rgba(0,0,0,0.16)" />
      <Group transform={bgTransform}>
        {bgGeometry.veinPaths.map((p,idx)=>(
          <Path key={`v_${idx}`} path={p} style="stroke" strokeWidth={1.1} color={`rgba(140,128,112,${0.07 * veinOpacity})`} strokeCap="round" />
        ))}
        {visibleDust.map(d => (
          <Rect key={d.id} x={d.x} y={d.y} width={d.s} height={d.s} color={`rgba(210,198,176,${d.o * dustOpacity})`} />
        ))}
      </Group>
    </>
  );
}

function SkiaTreeCanvas({
  tree, visibleNodes, visibleEdges, nodeStatusMap, wrappedLabels,
  txV, tyV, scV,
  dragIdV, dragXV, dragYV, draggingV, LOD, edgeVisual,
  bld, connA, isInteractingV,
  selectedNodeId, selPulseV,
  canvasSize, nStyle,
  incidentByNode, xform,
}){
  const labelFont = useMemo(()=>matchFont({ fontSize: 10, fontStyle: 'bold' }),[]);
  const shapeCacheRef = useRef(new Map());
  const warnedMissingRef = useRef(false);

  useEffect(()=>{
    if((!txV||!tyV||!scV||!selPulseV||!dragIdV||!dragXV||!dragYV||!draggingV)&&!warnedMissingRef.current){
      if(__DEV__) console.warn('[SkiaTreeCanvas] Missing shared value(s); using safe fallbacks.');
      warnedMissingRef.current=true;
    }
  },[txV,tyV,scV,selPulseV,dragIdV,dragXV,dragYV,draggingV]);

  const sceneTransform = useDerivedValue(() => {
    'worklet';
    return [
      { translateX: txV.value },
      { translateY: tyV.value },
      { scale: scV.value },
    ];
  }, []);
  const sceneTransformFallback = useMemo(() => ([
    { translateX: xform?.tx ?? 0 },
    { translateY: xform?.ty ?? 0 },
    { scale: xform?.sc ?? 1 },
  ]), [xform?.sc, xform?.tx, xform?.ty]);

  const dragPos = useDerivedValue(() => {
    'worklet';
    return {
      id: dragIdV.value,
      x: dragXV.value,
      y: dragYV.value,
      on: draggingV.value === 1,
    };
  }, []);

  const interactionOn = dragPos.value.on || (isInteractingV?.value ?? 0) === 1;
  const nodeMap = useMemo(()=>new Map(tree.nodes.map(n=>[n.id,n])),[tree.nodes]);

  const dragEdgeOverlay = useMemo(()=>{
    if(!dragPos.value.on || !dragPos.value.id) return null;
    const list = incidentByNode?.get(dragPos.value.id);
    if(!list || !list.length) return null;
    const p = Skia.Path.Make();
    for(const e of list){
      const a = nodeMap.get(e.from);
      const b = nodeMap.get(e.to);
      if(!a || !b) continue;
      const ax = a.id===dragPos.value.id ? dragPos.value.x : a.x;
      const ay = a.id===dragPos.value.id ? dragPos.value.y : a.y;
      const bx = b.id===dragPos.value.id ? dragPos.value.x : b.x;
      const by = b.id===dragPos.value.id ? dragPos.value.y : b.y;
      p.moveTo(ax, ay);
      p.lineTo(bx, by);
    }
    return p;
  },[incidentByNode,nodeMap,dragPos.value.id,dragPos.value.on,dragPos.value.x,dragPos.value.y]);

  const t = useSharedValue(0);
  useEffect(()=>{
    let rafId;
    const loopMs = 2000;
    const startedAt = Date.now();
    const tick = ()=>{
      const elapsed = (Date.now() - startedAt) % loopMs;
      t.value = elapsed / loopMs;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return ()=>{
      if(rafId!=null) cancelAnimationFrame(rafId);
      t.value = 0;
    };
  },[t]);

  const safeSelPulse = useDerivedValue(() => {
    'worklet';
    return selPulseV.value;
  }, []);
  const selectedRingOpacity = useDerivedValue(() => {
    'worklet';
    return 0.15 + (safeSelPulse.value * 0.2);
  }, []);
  const selectedRingRadius = useDerivedValue(() => {
    'worklet';
    return NODE_R + 8 + (safeSelPulse.value * 3);
  }, []);
  const shimmer = useDerivedValue(() => {
    'worklet';
    return t.value * Math.PI * 2;
  }, []);

  const edgeSegments = useMemo(()=>visibleEdges.map(e=>({
    key:`${e.from}|${e.to}`,
    from:nodeMap.get(e.from),
    to:nodeMap.get(e.to),
    seed:hashStringToFloat(`${e.from}|${e.to}`, 9),
  })).filter(seg=>seg.from&&seg.to),[visibleEdges,nodeMap]);

  const edgeBuckets = useMemo(()=>{
    const mastered = Skia.Path.Make();
    const ready = Skia.Path.Make();
    const locked = Skia.Path.Make();
    const readySegments = [];
    let hasMastered=false, hasReady=false, hasLocked=false;
    for(const seg of edgeSegments){
      const fn = seg.from;
      const tn = seg.to;
      const fromPos=fn;
      const toPos=tn;
      let bucket=locked;
      if(!bld){
        const fromState=nodeStatusMap[fn.id] || 'locked';
        const toState=nodeStatusMap[tn.id] || 'locked';
        const fromLit=fromState==='start'||fromState==='mastered';
        const toLit=toState==='start'||toState==='mastered';
        const toReady=toState==='ready';
        const fromStart=fromState==='start';
        if(fromLit&&toLit){
          bucket=mastered;
          hasMastered=true;
        }else if((fromLit&&!toLit)||(toReady)||(fromStart&&toState==='locked')){
          bucket=ready;
          hasReady=true;
          readySegments.push({ key:seg.key, x1:fromPos.x,y1:fromPos.y,x2:toPos.x,y2:toPos.y, seed:seg.seed });
        }else{
          hasLocked=true;
        }
      }else{
        hasLocked=true;
      }
      const ax=fromPos.x, ay=fromPos.y, bx=toPos.x, by=toPos.y;
      const mx=(ax+bx)/2, my=(ay+by)/2;
      const bend=0.14;
      const cx1=ax+(mx-ax)*0.6;
      const cy1=ay+(my-ay)*0.6-(bx-ax)*bend;
      const cx2=bx-(bx-mx)*0.6;
      const cy2=by-(by-my)*0.6+(bx-ax)*bend;
      bucket.moveTo(ax,ay);
      bucket.cubicTo(cx1,cy1,cx2,cy2,bx,by);
    }
    return { mastered, ready, locked, readySegments, hasMastered, hasReady, hasLocked };
  },[bld,connA,edgeSegments,nodeStatusMap]);

  const farNodeR = NODE_R*0.34;
  const useFancy = (!interactionOn && LOD.isNear);
  const fastMode = !useFancy || LOD.isFar;
  const showLabels = LOD.isNear && visibleNodes.length<=90 && !fastMode;
  const showEdgeGlow = visibleEdges.length<=180;
  const disableNodeGlow = visibleNodes.length>120 || LOD.isMid || LOD.isFar || interactionOn;
  const dynamicNodeIds = useMemo(()=>{
    const set = new Set();
    if(dragPos.value.on && dragPos.value.id) set.add(dragPos.value.id);
    if(selectedNodeId) set.add(selectedNodeId);
    return set;
  },[dragPos.value.id,dragPos.value.on,selectedNodeId]);
  const staticNodes = useMemo(()=>visibleNodes.filter(n=>!dynamicNodeIds.has(n.id)),[dynamicNodeIds,visibleNodes]);
  const dynamicNodes = useMemo(()=>visibleNodes.filter(n=>dynamicNodeIds.has(n.id)),[dynamicNodeIds,visibleNodes]);

  const sweepPath = useMemo(()=>makeStarPath(8),[]);
  const getNodePath = (id,status,renderR)=>{
    const key = `${id}|${status}|${renderR.toFixed(2)}`;
    const cached = shapeCacheRef.current.get(key);
    if(cached) return cached;
    let p;
    if(status==='start') p = makeStarPath(renderR*1.05);
    else if(status==='mastered') p = makeHexStonePath(renderR, id);
    else if(status==='ready') p = makeDiamondPath(renderR*0.98);
    else p = makeRoundSquarePath(renderR*0.95, renderR*0.28);
    shapeCacheRef.current.set(key,p);
    return p;
  };

  // Atlas setup: render static node sprites once, then draw non-dragged nodes in one batched draw.
  const atlasCell = 144;
  const atlasNodeR = NODE_R;
  const atlasImage = useMemo(()=>{
    const width = atlasCell * 4;
    const height = atlasCell;
    const surface = Skia.Surface.MakeOffscreen(width, height);
    if(!surface) return null;
    const c = surface.getCanvas();
    c.clear(Skia.Color('transparent'));

    const defs = [
      { body:'#d6d0c7', stroke:'#7b7266', halo:'rgba(170,160,145,0.08)' },
      { body:'#f1e4cf', stroke:'#FFC107', halo:'rgba(255,193,7,0.12)' },
      { body:'#d9efe0', stroke:'#4CAF50', halo:'rgba(76,175,80,0.13)' },
      { body:'#d9efe0', stroke:'#4CAF50', halo:'rgba(76,175,80,0.16)' },
    ];
    defs.forEach((d,idx)=>{
      const cx = atlasCell * idx + atlasCell * 0.5;
      const cy = atlasCell * 0.5;
      const haloP = Skia.Paint(); haloP.setColor(Skia.Color(d.halo));
      c.drawCircle(cx, cy, atlasNodeR * 1.1, haloP);
      const strokeP = Skia.Paint(); strokeP.setColor(Skia.Color(d.stroke));
      c.drawCircle(cx, cy, atlasNodeR, strokeP);
      const bodyP = Skia.Paint(); bodyP.setColor(Skia.Color(d.body));
      c.drawCircle(cx, cy, atlasNodeR - 2.2, bodyP);
      const shineP = Skia.Paint(); shineP.setColor(Skia.Color('rgba(255,255,255,0.16)'));
      c.drawCircle(cx-8, cy-8, atlasNodeR*0.13, shineP);
    });
    return surface.makeImageSnapshot();
  },[]);

  const atlasSprites = useMemo(()=>staticNodes.map(n=>{
    const status=nodeStatusMap[n.id]||'locked';
    const spriteIdx = status==='start' ? 3 : status==='mastered' ? 2 : status==='ready' ? 1 : 0;
    return Skia.XYWHRect(spriteIdx*atlasCell,0,atlasCell,atlasCell);
  }),[atlasCell,nodeStatusMap,staticNodes]);
  const atlasTransforms = useMemo(()=>staticNodes.map(n=>{
    const renderR=LOD.isFar?farNodeR:NODE_R;
    const scale = renderR / atlasNodeR;
    const cx = atlasCell * 0.5;
    const cy = atlasCell * 0.5;
    return {scos:scale, ssin:0, tx:n.x - scale * cx, ty:n.y - scale * cy};
  }),[LOD.isFar,atlasCell,atlasNodeR,farNodeR,staticNodes]);

  const atlasWarnRef = useRef(false);
  const atlasEnabled = Platform.OS !== 'android';
  const canRenderAtlas = useMemo(()=>{
    if(!atlasEnabled || !atlasImage) return false;
    const imageOk = typeof atlasImage.width === 'function' && typeof atlasImage.height === 'function';
    const arraysOk = atlasSprites.length === atlasTransforms.length && atlasSprites.length === staticNodes.length;
    const spriteOk = atlasSprites.every(r=>!!r);
    const txOk = atlasTransforms.every(t=>t&&Number.isFinite(t.scos)&&Number.isFinite(t.ssin)&&Number.isFinite(t.tx)&&Number.isFinite(t.ty));
    const ok = imageOk && arraysOk && spriteOk && txOk;
    if(!ok && !atlasWarnRef.current){
      atlasWarnRef.current = true;
      console.log('[atlas-guard] fallback static circles');
    }
    return ok;
  },[atlasEnabled,atlasImage,atlasSprites,atlasTransforms,staticNodes.length]);

  const dynamicTransform = USE_REANIMATED_TRANSFORM ? sceneTransform : sceneTransformFallback;

  return(
    <View style={{width:canvasSize.width,height:canvasSize.height,position:'relative'}}>
      <Canvas style={{position:'absolute',left:0,top:0,width:canvasSize.width,height:canvasSize.height}}>
        <Group transform={sceneTransformFallback}>
          {edgeBuckets.hasMastered&&showEdgeGlow&&(
            <Path path={edgeBuckets.mastered} style="stroke" strokeWidth={interactionOn?(edgeVisual.masteredW+3.8):(edgeVisual.masteredW+3.2)} color={interactionOn?"rgba(86,210,110,0.2)":"rgba(76,175,80,0.2)"} strokeCap="round">
              {!interactionOn&&<BlurMask blur={7} style="solid" />}
            </Path>
          )}
          {edgeBuckets.hasReady&&showEdgeGlow&&(
            <Path path={edgeBuckets.ready} style="stroke" strokeWidth={interactionOn?(edgeVisual.readyW+3.2):(edgeVisual.readyW+2.8)} color={interactionOn?"rgba(255,184,76,0.18)":"rgba(255,173,64,0.16)"} strokeCap="round">
              {!interactionOn&&<BlurMask blur={6} style="solid" />}
            </Path>
          )}

          {edgeBuckets.hasMastered&&(
            <Path path={edgeBuckets.mastered} style="stroke" strokeWidth={edgeVisual.masteredW} color={`rgba(76,175,80,${edgeVisual.masteredO})`} strokeCap="round" />
          )}
          {edgeBuckets.hasReady&&(
            <Path path={edgeBuckets.ready} style="stroke" strokeWidth={edgeVisual.readyW} color={`rgba(255,152,0,${edgeVisual.readyO})`} strokeCap="round">
              {LOD.useDashedReady&&!bld&&!fastMode&&<DashPathEffect intervals={[12,10]} />}
            </Path>
          )}
          {edgeBuckets.hasLocked&&(
            <Path path={edgeBuckets.locked} style="stroke" strokeWidth={edgeVisual.lockedW} color={bld?`rgba(91,82,72,${edgeVisual.lockedO})`:`rgba(97,88,79,${edgeVisual.lockedO})`} strokeCap="round" />
          )}

          {canRenderAtlas&&staticNodes.length>0&&(
            <Atlas image={atlasImage} sprites={atlasSprites} transforms={atlasTransforms} />
          )}

          {!canRenderAtlas&&staticNodes.map(n=>{
            const {fill,stroke,sw,opacity}=nStyle(n);
            const renderR=LOD.isFar?farNodeR:NODE_R;
            const nodeStrokeWidth=LOD.isFar?Math.max(0.8,sw-0.5):sw;
            const status=nodeStatusMap[n.id]||'locked';
            const isReady=status==='ready';
            const isMastered=status==='start'||status==='mastered';
            return (
              <Group key={`fallback_${n.id}`}>
                {!disableNodeGlow&&isMastered&&<Circle cx={n.x} cy={n.y} r={NODE_R*1.1} color="rgba(76,175,80,0.2)" />}
                {!disableNodeGlow&&isReady&&<Circle cx={n.x} cy={n.y} r={NODE_R*1.05} color="rgba(255,152,0,0.2)" />}
                <Circle cx={n.x} cy={n.y} r={renderR} color={fill} opacity={opacity} />
                <Circle cx={n.x} cy={n.y} r={Math.max(1,renderR-2)} style="stroke" strokeWidth={nodeStrokeWidth} color={stroke} opacity={opacity} />
              </Group>
            );
          })}
        </Group>
      </Canvas>

      <Canvas pointerEvents="none" style={{position:'absolute',left:0,top:0,width:canvasSize.width,height:canvasSize.height}}>
        <Group transform={dynamicTransform}>
          {dragEdgeOverlay&&(
            <Path path={dragEdgeOverlay} style="stroke" strokeWidth={edgeVisual.readyW+0.6} color="rgba(255,193,7,0.55)" strokeCap="round" />
          )}

          {!interactionOn&&LOD.isNear&&edgeBuckets.readySegments.slice(0,20).map(seg=>{
            const segT=((t.value + seg.seed) % 1);
            const x=seg.x1 + (seg.x2-seg.x1)*segT;
            const y=seg.y1 + (seg.y2-seg.y1)*segT;
            return <Circle key={`spark_${seg.key}`} cx={x} cy={y} r={1.8} color="rgba(255,223,167,0.86)" />;
          })}

          {showLabels&&staticNodes.map(n=>{
            const lines=wrappedLabels[n.id]||[{text:n.name,dx:n.name.length*2.8}];
            const lh=13;
            const sy=n.y-(lines.length*lh)/2+lh*0.8;
            const status=nodeStatusMap[n.id]||'locked';
            const isReady=status==='ready';
            const isMastered=status==='start'||status==='mastered';
            return lines.map((ln,li)=>(
              <SkiaText
                key={`st_${n.id}_${li}`}
                x={n.x-ln.dx}
                y={sy+li*lh}
                text={ln.text}
                font={labelFont}
                color={(isMastered||isReady)?C.textMain:C.textDim}
              />
            ));
          })}

          {dynamicNodes.map(n=>{
          const {fill,stroke,sw,opacity}=nStyle(n);
          const rx=dragPos.value.on&&dragPos.value.id===n.id?dragPos.value.x:n.x;
          const ry=dragPos.value.on&&dragPos.value.id===n.id?dragPos.value.y:n.y;
          const lines=wrappedLabels[n.id]||[{text:n.name,dx:n.name.length*2.8}];
          const lh=13;
          const sy=ry-(lines.length*lh)/2+lh*0.8;
          const status=nodeStatusMap[n.id]||'locked';
          const isReady=status==='ready';
          const isMastered=status==='start'||status==='mastered';
          const renderR=LOD.isFar?farNodeR:NODE_R;
          const nodeStrokeWidth=LOD.isFar?Math.max(0.8,sw-0.5):sw;
          const nodePath = getNodePath(n.id, status, renderR);
          const seedPhase = hashStringToFloat(n.id, 101);
          const scalePulse = 0.96 + Math.sin((t.value + seedPhase) * Math.PI * 2) * 0.04;

          return(
            <Group key={`dyn_${n.id}`}>
              {!disableNodeGlow&&isMastered&&<Circle cx={rx} cy={ry} r={NODE_R*1.1} color="rgba(76,175,80,0.2)" />}
              {!disableNodeGlow&&isReady&&<Circle cx={rx} cy={ry} r={NODE_R*1.05} color="rgba(255,152,0,0.2)" />}
              {interactionOn&&isMastered&&<Circle cx={rx} cy={ry} r={NODE_R*1.02} color="rgba(76,175,80,0.1)" />}
              {interactionOn&&isReady&&<Circle cx={rx} cy={ry} r={NODE_R} color="rgba(255,152,0,0.09)" />}

              <Group transform={[{translateX:rx},{translateY:ry}]}> 
                <Path path={nodePath} style="fill" color={fill} opacity={opacity} />
                {!fastMode&&(
                  <Group transform={[{scale:0.92*scalePulse}]}> 
                    <Path path={nodePath} style="fill" color="#000000" opacity={0.14} />
                  </Group>
                )}
                <Path path={nodePath} style="stroke" strokeWidth={nodeStrokeWidth} color={stroke} opacity={opacity} />
                {!LOD.isFar&&!interactionOn&&<Circle cx={-7} cy={-8} r={NODE_R*0.11} color="rgba(255,255,255,0.28)" />}
              </Group>

              {selectedNodeId===n.id&&(
                <Circle cx={rx} cy={ry} r={selectedRingRadius} style="stroke" strokeWidth={1.6} color="rgba(255,215,120,1)" opacity={selectedRingOpacity} />
              )}

              {!interactionOn&&LOD.isNear&&isMastered&&(
                <Group transform={[{translateX:rx},{translateY:ry},{rotate:shimmer.value + (seedPhase*Math.PI*2)}]}> 
                  <Path path={sweepPath} style="stroke" strokeWidth={1.6} color="rgba(233,255,241,0.7)" strokeCap="round" />
                </Group>
              )}

              {showLabels&&lines.map((ln,li)=>(
                <SkiaText
                  key={`dyn_${n.id}_${li}`}
                  x={rx-ln.dx}
                  y={sy+li*lh}
                  text={ln.text}
                  font={labelFont}
                  color={(isMastered||isReady)?C.textMain:C.textDim}
                />
              ))}
            </Group>
          );
          })}
        </Group>
      </Canvas>
    </View>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
function TreeScreen(){
  const insets = useSafeAreaInsets();
  const [tree,_setTree]=useState(INIT);
  const tR=useRef(INIT);
  const setTree=t=>{tR.current=t;_setTree(t);};
  const hist=useRef([INIT]),hi=useRef(0);
  const [canUndo,setCU]=useState(false),[canRedo,setCR]=useState(false);

  useEffect(()=>{
    AsyncStorage.getItem(STORAGE_KEY).then(raw=>{
      if(!raw) return;
      try{
        const saved=JSON.parse(raw);
        if(saved?.nodes&&saved?.edges){
          const t={...INIT,...saved,info:{...INIT.info,...(saved.info||{})}};
          hist.current=[t];hi.current=0;
          setTree(t);setCU(false);setCR(false);
        }
      }catch(e){}
    });
  },[]);

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
    if(!USE_REANIMATED_TRANSFORM){
      setXform(prev=>(prev.tx===tx&&prev.ty===ty&&prev.sc===sc?prev:{tx,ty,sc}));
    }
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
    if(glowDebounceRef.current) clearTimeout(glowDebounceRef.current);
  },[]);

  const cL=useRef(0),cT=useRef(0),cRef=useRef(null);
  const measureC=()=>cRef.current?.measure((_,__,_w,_h,px,py)=>{cL.current=px;cT.current=py;});

  const nodeById=useMemo(()=>new Map(tree.nodes.map(n=>[n.id,n])),[tree.nodes]);
  const hitCellSize=NODE_R*3;
  const nodeGrid=useMemo(()=>{
    const g=new Map();
    for(const n of tree.nodes){
      const cx=Math.floor(n.x/hitCellSize);
      const cy=Math.floor(n.y/hitCellSize);
      const k=`${cx},${cy}`;
      if(!g.has(k)) g.set(k,[]);
      g.get(k).push(n.id);
    }
    return g;
  },[hitCellSize,tree.nodes]);

  const toSVG=(px,py)=>({
    x:(px-cL.current-txN.current)/scN.current,
    y:(py-cT.current-tyN.current)/scN.current,
  });
  const hitNode=(px,py)=>{
    const p=toSVG(px,py);
    const cx=Math.floor(p.x/hitCellSize);
    const cy=Math.floor(p.y/hitCellSize);
    let best=null;
    let bestD=Infinity;
    for(let ox=-1;ox<=1;ox++){
      for(let oy=-1;oy<=1;oy++){
        const ids=nodeGrid.get(`${cx+ox},${cy+oy}`);
        if(!ids) continue;
        for(const id of ids){
          const n=nodeById.get(id);
          if(!n) continue;
          const d=Math.hypot(n.x-p.x,n.y-p.y);
          if(d<=NODE_R+14&&d<bestD){best=n;bestD=d;}
        }
      }
    }
    return best;
  };

  const gSx=useRef(0),gSy=useRef(0),gLx=useRef(0),gLy=useRef(0),moved=useRef(false);
  const pOn=useRef(false),pD0=useRef(0),pSc0=useRef(1),pTx0=useRef(0),pTy0=useRef(0);
  const pMx0=useRef(0),pMy0=useRef(0);
  const dId=useRef(null),dNx=useRef(0),dNy=useRef(0),dPx=useRef(0),dPy=useRef(0);
  const dragLive=useRef({id:null,x:0,y:0});
  const dragIdV=useSharedValue('');
  const dragXV=useSharedValue(0);
  const dragYV=useSharedValue(0);
  const draggingV=useSharedValue(0);
  const glowDebounceRef=useRef(null);
  const isInteractingV=useSharedValue(0);
  const selPulseV=useSharedValue(0);

  const beginInteraction=()=>{
    if(glowDebounceRef.current){
      clearTimeout(glowDebounceRef.current);
      glowDebounceRef.current=null;
    }
    isInteractingV.value=1;
  };
  const endInteraction=()=>{
    if(glowDebounceRef.current) clearTimeout(glowDebounceRef.current);
    glowDebounceRef.current=setTimeout(()=>{
      isInteractingV.value=0;
      glowDebounceRef.current=null;
    },90);
  };

  useEffect(()=>{
    selPulseV.value = withRepeat(
      withTiming(1,{duration:2200,easing:Easing.inOut(Easing.quad)}),
      -1,
      true,
    );
    return ()=>{
      selPulseV.value = 0;
    };
  },[selPulseV]);

  const setDragVisual=(id,x,y,on=1)=>{
    dragIdV.value=id;
    dragXV.value=x;
    dragYV.value=y;
    draggingV.value=on;
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
      setDragVisual('',0,0,0);
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
          setDragVisual(hit.id,hit.x,hit.y,1);
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
        setDragVisual(dId.current,nx,ny,1);
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
        setDragVisual('',0,0,0);
        return;
      }
      dId.current=null;
      dragLive.current={id:null,x:0,y:0};
      setDragVisual('',0,0,0);
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
      setDragVisual('',0,0,0);
    },
  })).current;

  const addNode=name=>{
    const id=name.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'')+'_'+Date.now();
    commit({
      ...tR.current,
      nodes:[...tR.current.nodes,{id,name,x:pendingPos.current.x,y:pendingPos.current.y,unlocked:false,isStart:false}],
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
      const loaded=JSON.parse(raw);
      if(!loaded?.nodes||!loaded?.edges){Alert.alert('Invalid file','Not a valid skill tree JSON.');return;}
      const t={...INIT,...loaded,info:{...INIT.info,...(loaded.info||{})}};
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

  const incidentByNode=useMemo(()=>{
    const map=new Map();
    for(const e of tree.edges){
      if(!map.has(e.from)) map.set(e.from,[]);
      if(!map.has(e.to)) map.set(e.to,[]);
      map.get(e.from).push(e);
      map.get(e.to).push(e);
    }
    return map;
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
    if(bld&&connA===n.id) return{fill:'#2a1a00',stroke:C.amber,sw:2.5,opacity:1};
    const status=nodeStatusMap[n.id] || 'locked';
    if(status==='start'||status==='mastered') return{fill:'#d9efe0',stroke:'#4CAF50',sw:2.2,opacity:0.95};
    if(status==='ready') return{fill:'#f1e4cf',stroke:'#FFC107',sw:2.1,opacity:0.95};
    return{fill:'#cfcfcf',stroke:'#7b7266',sw:1.2,opacity:0.78};
  };

  const wrap=name=>{
    const words=name.split(' ');const lines=[];let cur='';
    for(const w of words){const next=cur?cur+' '+w:w;if(next.length>10&&cur){lines.push(cur);cur=w;}else cur=next;}
    if(cur)lines.push(cur);return lines;
  };

  const wrappedLabels=useMemo(()=>{
    const labels={};
    for(const n of tree.nodes){
      labels[n.id]=wrap(n.name).map(text=>({
        text,
        // PERF: precompute rough centered x-offset once, avoid per-frame string math.
        dx:text.length*2.8,
      }));
    }
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
    const arr = tree.nodes.filter(n=>
      n.x>=visibleBounds.left-margin&&n.x<=visibleBounds.right+margin&&
      n.y>=visibleBounds.top-margin&&n.y<=visibleBounds.bottom+margin
    );
    if(xform.sc<0.35&&arr.length>220){
      return arr.filter((_,i)=>i%2===0);
    }
    return arr;
  },[tree.nodes,visibleBounds,xform.sc]);

  const visibleNodeIds=useMemo(()=>new Set(visibleNodes.map(n=>n.id)),[visibleNodes]);

  const visibleEdges=useMemo(()=>tree.edges.filter(e=>
    visibleNodeIds.has(e.from)&&visibleNodeIds.has(e.to)
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
    if(LOD.isFar) return {masteredW:1.1,readyW:0.95,lockedW:0.85,masteredO:0.62,readyO:0.48,lockedO:0.25};
    if(LOD.isMid) return {masteredW:1.7,readyW:1.4,lockedW:1.1,masteredO:0.74,readyO:0.6,lockedO:0.3};
    return {masteredW:2.5,readyW:2.1,lockedW:1.4,masteredO:0.86,readyO:0.72,lockedO:0.38};
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
        <Text style={S.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>CALISTHENICS</Text>
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
            dragIdV={dragIdV}
            dragXV={dragXV}
            dragYV={dragYV}
            draggingV={draggingV}
            LOD={LOD}
            edgeVisual={edgeVisual}
            bld={bld}
            connA={connA}
            isInteractingV={isInteractingV}
            selectedNodeId={sel?.id ?? null}
            selPulseV={selPulseV}
            canvasSize={canvasSize}
            nStyle={nStyle}
            incidentByNode={incidentByNode}
            xform={xform}
          />
        )}
      </View>

      {/* Legend */}
      {!bld&&(
        <View style={S.legend}>
          {[
            ['#4CAF50','Mastered'],
            ['#FFC107','Ready'],
            ['#3a3028','Locked'],
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
          onClose={()=>setSel(null)} onRecord={record}/>
      )}
    </View>
  );
}



function ProfileScreen(){
  return (
    <ScrollView contentContainerStyle={tabs.content} style={tabs.page}>
      <Text style={tabs.pageTitle}>Profile</Text>
      <View style={tabs.card}>
        <Text style={tabs.cardTitle}>Athlete</Text>
        <Text style={tabs.cardBody}>Level 3 Explorer</Text>
      </View>
      <View style={tabs.card}>
        <Text style={tabs.cardTitle}>Stats</Text>
        <Text style={tabs.cardBody}>Completed Skills: 12</Text>
        <Text style={tabs.cardBody}>Current Streak: 5 days</Text>
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
          <Switch value={notifications} onValueChange={setNotifications} trackColor={{false:'#3a3028', true:'#8a6a20'}} thumbColor={notifications ? '#FFC107' : '#8b7a63'} />
        </View>
        <View style={tabs.settingRow}>
          <Text style={tabs.settingLabel}>Dark Theme</Text>
          <Switch value={darkMode} onValueChange={setDarkMode} trackColor={{false:'#3a3028', true:'#2d6b47'}} thumbColor={darkMode ? '#4CAF50' : '#8b7a63'} />
        </View>
      </View>
    </ScrollView>
  );
}

function AppShell(){
  const [tab, setTab] = useState('Tree');
  const insets = useSafeAreaInsets();

  const tabsConfig = [
    { key: 'Tree', icon: 'git-network-outline' },
    { key: 'Profile', icon: 'person-outline' },
    { key: 'Settings', icon: 'settings-outline' },
  ];

  return (
    <View style={tabs.safeRoot}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={tabs.root}>
        <View style={tabs.contentWrap}>
          {tab === 'Tree' && <TreeScreen />}
          {tab === 'Profile' && <ProfileScreen />}
          {tab === 'Settings' && <SettingsScreen />}
        </View>

        <View style={[tabs.navBar, { paddingBottom: insets.bottom }]}>
          {tabsConfig.map((item) => {
            const active = tab === item.key;
            return (
              <TouchableOpacity key={item.key} style={tabs.navItem} onPress={() => setTab(item.key)}>
                <Ionicons name={item.icon} size={20} color={active ? '#FFC107' : C.textDim} />
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
  useEffect(()=>{
    console.log('[versions]', {
      reanimated: require('react-native-reanimated/package.json').version,
      skia: require('@shopify/react-native-skia/package.json').version,
    });
    let loggedWorkletError=false;
    const prevHandler=global.ErrorUtils?.getGlobalHandler?.();
    if(global.ErrorUtils?.setGlobalHandler){
      global.ErrorUtils.setGlobalHandler((error,isFatal)=>{
        const msg=String(error?.message||error||'');
        if(!loggedWorkletError&&msg.includes('[Worklets]')){
          loggedWorkletError=true;
          console.log('[worklets-error]',msg);
        }
        if(prevHandler) prevHandler(error,isFatal);
      });
    }
  },[]);

  return (
    <SafeAreaProvider>
      <AppShell />
    </SafeAreaProvider>
  );
}

const tabs = StyleSheet.create({
  safeRoot: { flex: 1, backgroundColor: C.bg },
  root: { flex: 1, backgroundColor: C.bg },
  contentWrap: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: C.stone,
    backgroundColor: C.bg,
    paddingTop: 10,
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  navLabel: { color: C.textDim, fontSize: 12, fontWeight: '600' },
  navLabelActive: { color: '#FFC107' },
  page: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 14 },
  pageTitle: { color: C.gold, fontSize: 26, fontWeight: '800', marginBottom: 4, letterSpacing: 1 },
  card: {
    backgroundColor: C.bgDeep,
    borderWidth: 1,
    borderColor: C.stone,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  cardTitle: { color: C.textMain, fontSize: 18, fontWeight: '700' },
  cardBody: { color: C.textDim, fontSize: 15 },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  settingLabel: { color: C.textMain, fontSize: 15 },
});
const S=StyleSheet.create({
  root:    {flex:1,backgroundColor:C.bg},
  bar:     {flexDirection:'row',justifyContent:'space-between',alignItems:'center',
            paddingHorizontal:14,paddingTop:10,paddingBottom:10,gap:10,
            backgroundColor:C.bg,borderBottomWidth:1,borderColor:C.stone},
  barRight:{flexDirection:'row',alignItems:'center',gap:8,flexShrink:1},
  title:   {color:C.gold,fontSize:13,fontWeight:'800',letterSpacing:3,
            textShadowColor:C.gold,textShadowRadius:8,flexShrink:1,paddingRight:8},
  resetBtn:{paddingHorizontal:12,paddingVertical:8,borderRadius:6,
            backgroundColor:C.bgDeep,borderWidth:1,borderColor:'#6a2020'},
  resetT:  {color:'#a04040',fontSize:11,fontWeight:'800',letterSpacing:1.5},
  modeBtn: {paddingHorizontal:12,paddingVertical:8,borderRadius:6,
            backgroundColor:C.bgDeep,borderWidth:1,borderColor:C.stone},
  modeOn:  {backgroundColor:'#0a1a0e',borderColor:C.green},
  modeT:   {color:C.textDim,fontSize:11,fontWeight:'800',letterSpacing:1.5},
  modeTOn: {color:C.green},
  toolbar: {flexDirection:'row',justifyContent:'space-between',alignItems:'center',
            paddingHorizontal:10,paddingVertical:10,rowGap:8,
            backgroundColor:C.bgDeep,borderBottomWidth:1,borderColor:C.stone,flexWrap:'wrap'},
  tg:      {flexDirection:'row',gap:7,flexWrap:'wrap'},
  tBtn:    {paddingHorizontal:11,paddingVertical:8,borderRadius:6,
            backgroundColor:C.bg,borderWidth:1,borderColor:C.stone},
  tOn:     {backgroundColor:'#1a1208',borderColor:C.goldDim},
  tT:      {color:C.textDim,fontSize:12,fontWeight:'600'},
  tTOn:    {color:C.gold},
  uBtn:    {paddingHorizontal:11,paddingVertical:8,borderRadius:6,
            backgroundColor:C.bg,borderWidth:1,borderColor:C.stone},
  dim:     {opacity:0.2},
  uT:      {color:C.textDim,fontSize:12,fontWeight:'600'},
  ioRow:   {flexDirection:'row',gap:10,paddingHorizontal:14,paddingVertical:8,backgroundColor:C.bg},
  ioBtn:   {flex:1,backgroundColor:C.bgDeep,borderRadius:6,paddingVertical:10,
            alignItems:'center',borderWidth:1,borderColor:C.stone},
  ioT:     {color:C.textDim,fontSize:12,fontWeight:'800',letterSpacing:2},
  hintRow: {paddingHorizontal:16,paddingVertical:6,backgroundColor:C.bg},
  hintT:   {color:C.textFaint,fontSize:11,textAlign:'center',letterSpacing:0.5},
  canvas:  {flex:1,backgroundColor:'#131110',overflow:'hidden'},
  legend:  {flexDirection:'row',justifyContent:'center',gap:28,paddingVertical:12,
            backgroundColor:C.bg,borderTopWidth:1,borderColor:C.stone},
  lr:      {flexDirection:'row',alignItems:'center',gap:7},
  dot:     {width:8,height:8,borderRadius:4},
  lt:      {color:C.textDim,fontSize:11,letterSpacing:1},
});
