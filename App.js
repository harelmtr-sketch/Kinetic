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
  Blur,
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  Paint,
  Path,
  Skia,
  Text as SkiaText,
  TileMode,
  matchFont,
} from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

const STORAGE_KEY = 'calisthenics_tree_v1';
const NODE_R = 46;
const MIN_SC = 0.15;
const MAX_SC = 6;
const DEV_PERF_LOG = false;
const USE_GLOW = true;
const GLOW_QUALITY = 'low'; // 'low' | 'high'

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
          <TextInput style={np.input} value={val} onChangeText={setVal}
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

function SkiaTreeCanvas({
  tree, visibleNodes, visibleEdges, nodeStatusMap, wrappedLabels,
  txV, tyV, scV,
  dragVisual, LOD, edgeVisual,
  bld, connA, isInteracting,
  selectedNodeId, selPulseV,
  canvasSize, nStyle,
}){
  const labelFont = useMemo(()=>matchFont({ fontSize: 10, fontStyle: 'bold' }),[]);
  const gradientCacheRef = useRef(new Map());
  const nodeSeedMap = useMemo(()=>{
    const m={};
    for(const n of tree.nodes){
      m[n.id]={
        phase: hashStringToFloat(n.id, 1),
        ring: hashStringToFloat(n.id, 2),
        sparkCount: 4 + Math.floor(hashStringToFloat(n.id, 3) * 5),
      };
    }
    return m;
  },[tree.nodes]);

  const warnedMissingXformRef = useRef(false);
  useEffect(()=>{
    if((!txV||!tyV||!scV)&&!warnedMissingXformRef.current){
      console.warn('[SkiaTreeCanvas] Missing transform shared values; falling back to identity transform.');
      warnedMissingXformRef.current=true;
    }
  },[txV,tyV,scV]);
  const sceneTransform = useDerivedValue(()=>([
    { translateX: txV?.value ?? 0 },
    { translateY: tyV?.value ?? 0 },
    { scale: scV?.value ?? 1 },
  ]),[txV,tyV,scV]);
  const selectedRingOpacity = useDerivedValue(()=>0.18 + (selPulseV.value * 0.2),[selPulseV]);
  const selectedRingRadius = useDerivedValue(()=>NODE_R + 8 + (selPulseV.value * 3),[selPulseV]);

  const t = useSharedValue(0);
  useEffect(()=>{
    // Reanimated-driven universal clock (0..1 loop) for Skia animations.
    // We removed Skia clock hooks because this app's Skia version doesn't export them.
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

  const shimmer = useDerivedValue(() => t.value * Math.PI * 2, [t]);
  const auraPulse = useDerivedValue(()=>0.88 + (selPulseV.value * 0.22),[selPulseV]);
  const fogAX = useDerivedValue(() => (canvasSize.width*0.22) + Math.sin((t.value * Math.PI * 2) * 0.35) * 34, [canvasSize.width,t]);
  const fogBX = useDerivedValue(() => (canvasSize.width*0.78) + Math.cos((t.value * Math.PI * 2) * 0.28) * 42, [canvasSize.width,t]);

  const nodeMap = useMemo(()=>new Map(tree.nodes.map(n=>[n.id,n])),[tree.nodes]);
  const shimmerArcPath = useMemo(()=>Skia.Path.MakeFromSVGString(`M 0 -${NODE_R+9} A ${NODE_R+9} ${NODE_R+9} 0 0 1 ${NODE_R*0.46} -${NODE_R*0.89}`) || Skia.Path.Make(),[]);

  const edgeBuckets = useMemo(()=>{
    const mastered = Skia.Path.Make();
    const ready = Skia.Path.Make();
    const locked = Skia.Path.Make();
    const readySegments = [];
    let hasMastered=false, hasReady=false, hasLocked=false;
    for(const e of visibleEdges){
      const fn=nodeMap.get(e.from);
      const tn=nodeMap.get(e.to);
      if(!fn||!tn) continue;
      const fromPos=dragVisual?.id===fn.id?{x:dragVisual.x,y:dragVisual.y}:fn;
      const toPos=dragVisual?.id===tn.id?{x:dragVisual.x,y:dragVisual.y}:tn;
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
          readySegments.push({
            key:`${e.from}|${e.to}`,
            x1:fromPos.x,y1:fromPos.y,x2:toPos.x,y2:toPos.y,
            seed:hashStringToFloat(`${e.from}|${e.to}`, 9),
          });
        }else{
          hasLocked=true;
        }
      }else{
        hasLocked=true;
      }
      bucket.moveTo(fromPos.x,fromPos.y);
      bucket.lineTo(toPos.x,toPos.y);
    }
    return { mastered, ready, locked, readySegments, hasMastered, hasReady, hasLocked };
  },[bld,dragVisual,nodeMap,nodeStatusMap,visibleEdges]);

  const dustSeeds = useMemo(()=>{
    // NOTE: dust seeds are plain numbers (not shared values).
    // A prior version mixed `.value` reads during map() and could crash when a seed field wasn't a shared value.
    return Array.from({length:48},(_,i)=>({
      id:`dust_${i}`,
      x:hashStringToFloat(`dustx_${i}`, 31),
      y:hashStringToFloat(`dusty_${i}`, 37),
      phase:hashStringToFloat(`dustp_${i}`, 41),
      speed:0.35 + hashStringToFloat(`dustv_${i}`, 43) * 0.9,
    }));
  },[]);

  const farNodeR = NODE_R*0.34;
  const getCachedNodeShader = (status, renderR, fill, core)=>{
    // PERF: cached by visual state only (ignores x/y) so panning/zooming reuses shader objects.
    const key = `${status}|${renderR}|${fill}|${core}`;
    const cached = gradientCacheRef.current.get(key);
    if(cached) return cached;
    const shader = Skia.Shader.MakeRadialGradient(
      {x:-4,y:-7},
      renderR*1.22,
      [Skia.Color(core), Skia.Color(fill), Skia.Color('#0d0b09')],
      [0, 0.45, 1],
      TileMode.Clamp,
    );
    gradientCacheRef.current.set(key, shader);
    return shader;
  };

  const shouldCheap = isInteracting || LOD.isFar;

  return(
    <Canvas style={{width:canvasSize.width,height:canvasSize.height}}>
      {/* Ambient vignette (screen-space, static dark edges) */}
      <Circle cx={canvasSize.width*0.5} cy={canvasSize.height*0.5} r={Math.max(canvasSize.width, canvasSize.height)*0.78} color="rgba(0,0,0,0.22)" />
      <Circle cx={canvasSize.width*0.5} cy={canvasSize.height*0.5} r={Math.max(canvasSize.width, canvasSize.height)*1.02} style="stroke" strokeWidth={Math.max(canvasSize.width, canvasSize.height)*0.45} color="rgba(0,0,0,0.34)" />

      {/* Fog bands (idle only, subtle drift in screen-space) */}
      {!shouldCheap&&(
        <>
          <Circle cx={fogAX} cy={canvasSize.height*0.2} r={canvasSize.width*0.42} color="rgba(210,190,150,0.03)">
            <Blur blur={22} />
          </Circle>
          <Circle cx={fogBX} cy={canvasSize.height*0.72} r={canvasSize.width*0.36} color="rgba(170,210,185,0.025)">
            <Blur blur={18} />
          </Circle>
        </>
      )}

      {/* Dust motes in screen-space (disabled on interacting/far) */}
      {!shouldCheap&&LOD.isNear&&dustSeeds.map((d)=>{
        const tt = ((t.value * d.speed) + d.phase) % 1;
        const x=(d.x*canvasSize.width + tt*canvasSize.width*0.18) % canvasSize.width;
        const y=(d.y*canvasSize.height + tt*canvasSize.height*0.06) % canvasSize.height;
        return <Circle key={d.id} cx={x} cy={y} r={0.8 + d.phase*1.4} color={`rgba(230,220,190,${0.05 + d.phase*0.11})`} />;
      })}

      <Group transform={sceneTransform}>
        {/* Edge glow under-strokes (idle only) */}
        {edgeBuckets.hasMastered&&!shouldCheap&&USE_GLOW&&(
          <Path path={edgeBuckets.mastered} style="stroke" strokeWidth={edgeVisual.masteredW+4.4} color="rgba(76,175,80,0.2)" strokeCap="round">
            <Blur blur={8} />
          </Path>
        )}
        {edgeBuckets.hasReady&&!shouldCheap&&USE_GLOW&&(
          <Path path={edgeBuckets.ready} style="stroke" strokeWidth={edgeVisual.readyW+3.8} color="rgba(255,173,64,0.2)" strokeCap="round">
            <Blur blur={7} />
          </Path>
        )}

        {/* Base edges */}
        {edgeBuckets.hasMastered&&(
          <Path path={edgeBuckets.mastered} style="stroke" strokeWidth={edgeVisual.masteredW} color={`rgba(76,175,80,${edgeVisual.masteredO})`} strokeCap="round" />
        )}
        {edgeBuckets.hasReady&&(
          <Path path={edgeBuckets.ready} style="stroke" strokeWidth={edgeVisual.readyW} color={`rgba(255,152,0,${edgeVisual.readyO})`} strokeCap="round">
            {LOD.useDashedReady&&!bld&&<DashPathEffect intervals={[12,10]} />}
          </Path>
        )}
        {edgeBuckets.hasLocked&&(
          <Path path={edgeBuckets.locked} style="stroke" strokeWidth={edgeVisual.lockedW} color={bld?`rgba(91,82,72,${edgeVisual.lockedO})`:`rgba(97,88,79,${edgeVisual.lockedO})`} strokeCap="round" />
        )}

        {/* Animated edge energy flow */}
        {!shouldCheap&&edgeBuckets.hasMastered&&(
          <Path path={edgeBuckets.mastered} style="stroke" strokeWidth={edgeVisual.masteredW+0.7} color="rgba(172,255,192,0.52)" strokeCap="round">
            <DashPathEffect intervals={[14,18]} />
          </Path>
        )}
        {!shouldCheap&&edgeBuckets.hasReady&&(
          <Path path={edgeBuckets.ready} style="stroke" strokeWidth={edgeVisual.readyW+0.8} color="rgba(255,220,150,0.5)" strokeCap="round">
            <DashPathEffect intervals={[10,16]} />
          </Path>
        )}

        {/* Ready-edge sparks */}
        {!shouldCheap&&LOD.isNear&&edgeBuckets.readySegments.slice(0,20).map(seg=>{
          const segT=((t.value + seg.seed) % 1);
          const x=seg.x1 + (seg.x2-seg.x1)*segT;
          const y=seg.y1 + (seg.y2-seg.y1)*segT;
          return <Circle key={`spark_${seg.key}`} cx={x} cy={y} r={1.8} color="rgba(255,223,167,0.86)" />;
        })}

        {visibleNodes.map(n=>{
          const {fill,stroke,sw,opacity}=nStyle(n);
          const rx=dragVisual?.id===n.id?dragVisual.x:n.x;
          const ry=dragVisual?.id===n.id?dragVisual.y:n.y;
          const lines=wrappedLabels[n.id]||[{text:n.name,dx:n.name.length*2.8}];
          const lh=13;
          const sy=ry-(lines.length*lh)/2+lh*0.8;
          const status=nodeStatusMap[n.id]||'locked';
          const isLit=status==='start'||status==='mastered'||status==='ready';
          const isReady=status==='ready';
          const isMastered=status==='start'||status==='mastered';
          const renderR=LOD.isFar?farNodeR:NODE_R;
          const nodeStrokeWidth=LOD.isFar?Math.max(0.8,sw-0.5):sw;
          const showCheapHalo=USE_GLOW&&isLit;
          const haloColor=isInteracting
            ?(isReady?'rgba(255,152,0,0.2)':'rgba(76,175,80,0.18)')
            :(isReady?'rgba(255,170,80,0.22)':'rgba(92,212,130,0.2)');
          const coreColor=isReady?'#fff0c4':'#eaffef';
          const bodyGrad = shouldCheap ? null : getCachedNodeShader(status, renderR, fill, coreColor);
          const seed = nodeSeedMap[n.id] || {phase:0,ring:0,sparkCount:4};
          const pulse = 0.85 + Math.sin((t.value + seed.phase)*Math.PI*2)*0.15;
          const auraR = NODE_R*(isReady?1.58:1.46)*pulse;

          return(
            <Group key={n.id}>
              {LOD.showOuterRing&&isMastered&&<Circle cx={rx} cy={ry} r={NODE_R+12} style="stroke" strokeWidth={1.2} color="rgba(76,175,80,0.34)" />}
              {LOD.showOuterRing&&isReady&&<Circle cx={rx} cy={ry} r={NODE_R+12} style="stroke" strokeWidth={1.1} color="rgba(255,193,7,0.44)" />}
              {LOD.showOuterRing&&bld&&connA===n.id&&<Circle cx={rx} cy={ry} r={NODE_R+12} style="stroke" strokeWidth={1.8} color="rgba(212,128,10,0.68)" />}

              {/* A+B. AAA outer aura bloom + pulsing aura */}
              {!shouldCheap&&LOD.isNear&&isLit&&(
                <>
                  <Circle cx={rx} cy={ry} r={auraR} color={isReady?'rgba(255,177,68,0.2)':'rgba(92,214,136,0.18)'}>
                    <Blur blur={GLOW_QUALITY==='high'?24:16} />
                  </Circle>
                  <Circle cx={rx} cy={ry} r={NODE_R*(isReady?1.2:1.12)*auraPulse} color={isReady?'rgba(255,153,36,0.24)':'rgba(76,175,80,0.22)'}>
                    <Blur blur={GLOW_QUALITY==='high'?15:10} />
                  </Circle>
                </>
              )}

              {/* Interaction/far cheap halo fallback */}
              {showCheapHalo&&<Circle cx={rx} cy={ry} r={isInteracting?NODE_R*1.02:(LOD.isFar?NODE_R*0.62:NODE_R*0.92)} color={haloColor} />}

              {/* C. Shimmer ring sweep for mastered/start */}
              {!shouldCheap&&isMastered&&LOD.showInnerRing&&(
                <>
                  <Circle cx={rx} cy={ry} r={NODE_R+9} style="stroke" strokeWidth={1.2} color="rgba(170,255,190,0.32)" />
                  <Group transform={[{translateX:rx},{translateY:ry},{rotate:shimmer.value + (seed.ring*Math.PI*2)}]}> 
                    <Path
                      path={shimmerArcPath}
                      style="stroke"
                      strokeWidth={2.2}
                      color="rgba(233,255,241,0.92)"
                      strokeCap="round"
                    />
                  </Group>
                </>
              )}

              {selectedNodeId===n.id&&(
                <Circle cx={rx} cy={ry} r={selectedRingRadius} style="stroke" strokeWidth={1.6} color="rgba(255,215,120,1)" opacity={selectedRingOpacity} />
              )}

              {/* E. Jewel-like core: cached gradient body + bright inner core */}
              {shouldCheap?(
                <Circle cx={rx} cy={ry} r={renderR} color={fill} opacity={opacity} />
              ):(
                <Group transform={[{translateX:rx},{translateY:ry}]}> 
                  <Circle cx={0} cy={0} r={renderR} opacity={opacity}>
                    <Paint shader={bodyGrad} />
                  </Circle>
                  <Circle cx={-3} cy={-5} r={renderR*0.35} color={isReady?'rgba(255,244,200,0.36)':'rgba(224,255,235,0.36)'} />
                </Group>
              )}
              <Circle cx={rx} cy={ry} r={renderR} style="stroke" strokeWidth={nodeStrokeWidth} color={stroke} opacity={opacity} />

              {/* D. Spark particles orbiting lit nodes (near + idle only, capped globally) */}
              {!shouldCheap&&LOD.isNear&&isLit&&visibleNodes.length<=18&&Array.from({length:Math.min(seed.sparkCount,7)},(_,i)=>{
                const sp=hashStringToFloat(`${n.id}_sp_${i}`, i+15);
                const ang=((t.value*0.5) + sp) * Math.PI*2;
                const rad=NODE_R*(1.12 + sp*0.52);
                return (
                  <Circle
                    key={`${n.id}_sp_${i}`}
                    cx={rx + Math.cos(ang)*rad}
                    cy={ry + Math.sin(ang)*rad}
                    r={0.8 + sp*1.6}
                    color={isReady?'rgba(255,220,170,0.74)':'rgba(183,255,210,0.72)'}
                  />
                );
              })}

              {LOD.showInnerRing&&<Circle cx={rx} cy={ry} r={NODE_R-8} style="stroke" strokeWidth={0.5} color={stroke} opacity={0.34} />}
              {!LOD.isFar&&<Circle cx={rx-8} cy={ry-8} r={NODE_R*0.12} color="rgba(255,255,255,0.3)" />}

              {LOD.showLabels&&!isInteracting&&lines.map((ln,li)=>(
                <SkiaText
                  key={`${n.id}_${li}`}
                  x={rx-ln.dx}
                  y={sy+li*lh}
                  text={ln.text}
                  font={labelFont}
                  color={isLit?C.textMain:C.textDim}
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
  const isInteractingRef=useRef(false);
  const selPulseV=useSharedValue(0);

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
    if(!isInteractingRef.current){
      isInteractingRef.current=true;
      setIsInteracting(true);
    }
  };
  const endInteraction=()=>{
    if(glowDebounceRef.current) clearTimeout(glowDebounceRef.current);
    glowDebounceRef.current=setTimeout(()=>{
      if(isInteractingRef.current){
        isInteractingRef.current=false;
        setIsInteracting(false);
      }
      glowDebounceRef.current=null;
    },180);
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
            dragVisual={dragVisual}
            LOD={LOD}
            edgeVisual={edgeVisual}
            bld={bld}
            connA={connA}
            isInteracting={isInteracting}
            selectedNodeId={sel?.id ?? null}
            selPulseV={selPulseV}
            canvasSize={canvasSize}
            nStyle={nStyle}
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
