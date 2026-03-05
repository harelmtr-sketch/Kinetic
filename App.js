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
  Atlas,
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  Image,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Skia,
  Text as SkiaText,
  matchFont,
  vec,
} from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';

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
  input:  {backgroundColor:'#100e0c',borderRadius:10,padding:16,fontSize:17,borderWidth:1,borderColor:C.stone,marginBottom:16,color:C.textMain},
  row:    {flexDirection:'row',gap:10},
  cancel: {flex:1,backgroundColor:'#1a1410',borderRadius:10,paddingVertical:14,alignItems:'center',borderWidth:1,borderColor:C.stone},
  cancelT:{color:C.textDim,fontWeight:'600'},
  add:    {flex:1,backgroundColor:'#1a1510',borderRadius:10,paddingVertical:14,alignItems:'center',borderWidth:1,borderColor:C.gold},
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

const NODE_ATLAS_CELL = 256;
const NODE_ATLAS_VARIANTS = ['locked','ready','mastered','start','selected','connectTarget'];
const ICON_CELL = 128;
const ICON_TARGET_SIZE = 70;
const FORCE_FALLBACK_NODES = false;
const NODE_ICON_MAP = {
  start: 'star',
  dead_hang: 'link',
  active_hang: 'anchor',
  scap_pulls: 'bolt',
  neg_pullup: 'chevronUp',
  pullup: 'crown',
  pushup: 'chevronRight',
  diamond_pu: 'diamond',
  pike_pu: 'triangle',
  hspu: 'crown',
};

const ICON_PATHS = {
  star: 'M 48 4 L 60 34 L 92 34 L 66 52 L 76 86 L 48 66 L 20 86 L 30 52 L 4 34 L 36 34 Z',
  link: 'M 24 38 C 24 26 34 16 46 16 C 58 16 68 26 68 38 C 68 50 58 60 46 60 L 40 60 L 40 52 L 46 52 C 54 52 60 46 60 38 C 60 30 54 24 46 24 C 38 24 32 30 32 38 Z M 50 44 L 56 44 C 68 44 78 54 78 66 C 78 78 68 88 56 88 C 44 88 34 78 34 66 C 34 54 44 44 56 44 L 56 52 C 48 52 42 58 42 66 C 42 74 48 80 56 80 C 64 80 70 74 70 66 C 70 58 64 52 56 52 L 50 52 Z',
  anchor: 'M 44 12 L 52 12 L 52 58 C 62 60 70 68 70 78 L 62 78 C 62 70 56 64 48 64 C 40 64 34 70 34 78 L 26 78 C 26 68 34 60 44 58 Z M 18 78 L 26 78 C 26 92 36 104 48 106 C 60 104 70 92 70 78 L 78 78 C 78 96 64 112 48 114 C 32 112 18 96 18 78 Z M 38 24 C 38 18 42 14 48 14 C 54 14 58 18 58 24 C 58 30 54 34 48 34 C 42 34 38 30 38 24 Z',
  bolt: 'M 54 8 L 30 54 L 48 54 L 40 108 L 68 50 L 50 50 Z',
  chevronUp: 'M 16 80 L 48 40 L 80 80 L 68 80 L 48 56 L 28 80 Z',
  chevronRight: 'M 24 24 L 68 48 L 24 72 Z',
  crown: 'M 16 88 L 20 40 L 36 58 L 48 30 L 60 58 L 76 40 L 80 88 Z M 24 96 L 72 96 L 72 104 L 24 104 Z',
  diamond: 'M 48 14 L 80 48 L 48 82 L 16 48 Z',
  triangle: 'M 48 16 L 84 84 L 12 84 Z',
};

function buildNodeAtlas() {
  const cols = 3;
  const rows = Math.ceil(NODE_ATLAS_VARIANTS.length / cols);
  const width = cols * NODE_ATLAS_CELL;
  const height = rows * NODE_ATLAS_CELL;

  // Layered atlas: keep token/halo/ring separate so additive passes do not tint token body.
  const tokenSurface = Skia.Surface.MakeOffscreen(width, height);
  const haloSurface = Skia.Surface.MakeOffscreen(width, height);
  const ringSurface = Skia.Surface.MakeOffscreen(width, height);
  const tokenCanvas = tokenSurface.getCanvas();
  const haloCanvas = haloSurface.getCanvas();
  const ringCanvas = ringSurface.getCanvas();
  tokenCanvas.clear(Skia.Color('rgba(0,0,0,0)'));
  haloCanvas.clear(Skia.Color('rgba(0,0,0,0)'));
  ringCanvas.clear(Skia.Color('rgba(0,0,0,0)'));

  const rectsByVariant = {};
  const iconPathCache = {};
  Object.entries(ICON_PATHS).forEach(([k, svg]) => {
    const path = Skia.Path.MakeFromSVGString(svg);
    if (path) iconPathCache[k] = path;
  });

  NODE_ATLAS_VARIANTS.forEach((variant, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const ox = col * NODE_ATLAS_CELL;
    const oy = row * NODE_ATLAS_CELL;
    rectsByVariant[variant] = Skia.XYWHRect(ox, oy, NODE_ATLAS_CELL, NODE_ATLAS_CELL);

    const cx = ox + NODE_ATLAS_CELL / 2;
    const cy = oy + NODE_ATLAS_CELL / 2;

    const colors = {
      locked: {
        body: 'rgba(99,90,80,0.96)',
        plate: 'rgba(122,111,99,0.8)',
        rim: 'rgba(177,162,142,0.85)',
        halo: ['rgba(140,126,108,0.14)','rgba(122,108,92,0.08)','rgba(90,80,68,0.03)'],
      },
      ready: {
        body: 'rgba(128,86,31,0.98)',
        plate: 'rgba(162,116,48,0.9)',
        rim: 'rgba(255,198,92,1)',
        halo: ['rgba(255,182,66,0.34)','rgba(255,157,52,0.2)','rgba(255,136,40,0.1)'],
      },
      mastered: {
        body: 'rgba(32,100,68,0.98)',
        plate: 'rgba(58,132,96,0.9)',
        rim: 'rgba(125,241,186,1)',
        halo: ['rgba(90,234,164,0.34)','rgba(76,210,148,0.2)','rgba(54,170,116,0.1)'],
      },
      start: {
        body: 'rgba(110,87,26,0.98)',
        plate: 'rgba(157,124,42,0.92)',
        rim: 'rgba(255,220,106,1)',
        halo: ['rgba(255,209,105,0.34)','rgba(255,184,90,0.2)','rgba(235,152,59,0.1)'],
      },
      selected: {
        body: 'rgba(135,98,28,0.99)',
        plate: 'rgba(182,139,52,0.94)',
        rim: 'rgba(255,236,138,1)',
        halo: ['rgba(255,220,120,0.42)','rgba(255,196,98,0.26)','rgba(255,168,70,0.13)'],
      },
      connectTarget: {
        body: 'rgba(126,72,21,0.99)',
        plate: 'rgba(170,104,35,0.9)',
        rim: 'rgba(255,182,86,1)',
        halo: ['rgba(255,180,88,0.38)','rgba(246,140,56,0.24)','rgba(222,116,38,0.12)'],
      },
    }[variant];

    [94, 78, 62].forEach((r, idx) => {
      const glow = Skia.Paint();
      glow.setColor(Skia.Color(colors.halo[idx]));
      haloCanvas.drawCircle(cx, cy, r, glow);
    });
    const body = Skia.Paint();
    body.setColor(Skia.Color(colors.body));
    tokenCanvas.drawCircle(cx, cy, 52, body);

    const rim = Skia.Paint();
    rim.setColor(Skia.Color(colors.rim));
    tokenCanvas.drawCircle(cx, cy, 58, rim);
    tokenCanvas.drawCircle(cx, cy, 54, body);

    const innerRim = Skia.Paint();
    innerRim.setColor(Skia.Color('rgba(255,255,255,0.2)'));
    tokenCanvas.drawCircle(cx, cy, 44, innerRim);

    const plate = Skia.Paint();
    plate.setColor(Skia.Color(colors.plate));
    tokenCanvas.drawCircle(cx, cy, 41, plate);

    const shade = Skia.Paint();
    shade.setColor(Skia.Color('rgba(5,5,5,0.2)'));
    tokenCanvas.drawCircle(cx + 7, cy + 8, 36, shade);
    tokenCanvas.drawCircle(cx, cy, 35, plate);

    const shine = Skia.Paint();
    shine.setColor(Skia.Color('rgba(255,255,255,0.18)'));
    tokenCanvas.drawCircle(cx - 13, cy - 15, 11, shine);

    const ring = Skia.Paint();
    const ringColor = variant === 'locked' ? 'rgba(177,162,142,0.42)' : variant === 'ready' ? 'rgba(255,198,92,0.62)' : variant === 'mastered' ? 'rgba(125,241,186,0.62)' : variant === 'start' ? 'rgba(255,220,106,0.62)' : variant === 'selected' ? 'rgba(255,236,138,0.72)' : 'rgba(255,182,86,0.66)';
    ring.setColor(Skia.Color(ringColor));
    ringCanvas.drawCircle(cx, cy, 66, ring);
    ringCanvas.drawCircle(cx, cy, 63, body);
  });

  const iconKeys = Object.keys(iconPathCache);
  const iconCols = 4;
  const iconRows = Math.ceil(iconKeys.length / iconCols);
  const iconSurface = Skia.Surface.MakeOffscreen(iconCols * ICON_CELL, iconRows * ICON_CELL);
  const iconCanvas = iconSurface.getCanvas();
  iconCanvas.clear(Skia.Color('rgba(0,0,0,0)'));
  const iconRectsByKey = {};

  iconKeys.forEach((key, i) => {
    const ox = (i % iconCols) * ICON_CELL;
    const oy = Math.floor(i / iconCols) * ICON_CELL;
    iconRectsByKey[key] = Skia.XYWHRect(ox, oy, ICON_CELL, ICON_CELL);

    const path = iconPathCache[key].copy();
    const b = path.getBounds();
    const bx = typeof b.x === 'function' ? b.x() : b.x;
    const by = typeof b.y === 'function' ? b.y() : b.y;
    const bw = typeof b.width === 'function' ? b.width() : b.width;
    const bh = typeof b.height === 'function' ? b.height() : b.height;
    const pw = Math.max(1, bw);
    const ph = Math.max(1, bh);
    const scale = Math.min(ICON_TARGET_SIZE / pw, ICON_TARGET_SIZE / ph);
    const toOrigin = Skia.Matrix();
    toOrigin.translate(-bx, -by);
    path.transform(toOrigin);

    const mScale = Skia.Matrix();
    mScale.scale(scale, scale);
    path.transform(mScale);

    const tx = ox + (ICON_CELL - pw * scale) / 2;
    const ty = oy + (ICON_CELL - ph * scale) / 2;
    const mPlace = Skia.Matrix();
    mPlace.translate(tx, ty);
    path.transform(mPlace);

    const shadow = path.copy();
    const sm = Skia.Matrix();
    sm.translate(2.4, 2.8);
    shadow.transform(sm);
    const iconUnder = Skia.Paint();
    iconUnder.setColor(Skia.Color('rgba(5,4,3,0.62)'));
    iconCanvas.drawPath(shadow, iconUnder);

    const icon = Skia.Paint();
    icon.setColor(Skia.Color('rgba(249,246,236,0.98)'));
    iconCanvas.drawPath(path, icon);
  });

  return {
    rectsByVariant,
    tokenAtlasImage: tokenSurface.makeImageSnapshot(),
    haloAtlasImage: haloSurface.makeImageSnapshot(),
    ringAtlasImage: ringSurface.makeImageSnapshot(),
    iconAtlasImage: iconSurface.makeImageSnapshot(),
    iconRectsByKey,
  };
}

function buildStoneTexture() {
  const size = 320;
  const surface = Skia.Surface.MakeOffscreen(size, size);
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('rgba(0,0,0,0)'));
  const rand = mulberry32(2841);

  for (let i = 0; i < 2400; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.4 + rand() * 2.1;
    const alpha = 0.02 + rand() * 0.055;
    const p = Skia.Paint();
    p.setColor(Skia.Color(`rgba(${54 + Math.floor(rand()*40)},${48 + Math.floor(rand()*36)},${42 + Math.floor(rand()*30)},${alpha.toFixed(3)})`));
    canvas.drawCircle(x, y, r, p);
  }

  for (let i = 0; i < 120; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const w = 22 + rand() * 80;
    const h = 1 + rand() * 2.4;
    const crack = Skia.Paint();
    crack.setColor(Skia.Color('rgba(24,22,20,0.08)'));
    canvas.drawRect(Skia.XYWHRect(x, y, w, h), crack);
  }

  return surface.makeImageSnapshot();
}

function SkiaTreeCanvas({
  tree, visibleNodes, visibleEdges, nodeStatusMap, wrappedLabels,
  txV, tyV, scV,
  dragVisual, incidentEdgesByNode, LOD, edgeVisual,
  bld, connA, isInteracting,
  canvasSize, selectedNodeId,
}){
  const labelFont = useMemo(()=>matchFont({ fontSize: 10, fontStyle: 'bold' }),[]);
  const sceneTransform = useDerivedValue(()=>([
    { translateX: txV.value },
    { translateY: tyV.value },
    { scale: scV.value },
  ]),[]);

  const nodeMap = useMemo(()=>new Map(tree.nodes.map(n=>[n.id,n])),[tree.nodes]);
  const nodeAtlas = useMemo(() => buildNodeAtlas(), []);
  const stoneTexture = useMemo(() => buildStoneTexture(), []);
  const iconPathCache = useMemo(() => {
    const out = {};
    for (const [k, svg] of Object.entries(ICON_PATHS)) {
      const p = Skia.Path.MakeFromSVGString(svg);
      if (p) out[k] = p;
    }
    return out;
  }, []);
  const nodePaints = useMemo(() => {
    const make = (body, plate, rim, ring, halo) => ({ body, plate, rim, ring, halo0: halo[0], halo1: halo[1], halo2: halo[2] });
    return {
      locked: make('rgba(70,62,54,0.95)', 'rgba(96,86,76,0.85)', 'rgba(150,138,122,0.75)', 'rgba(150,138,122,0.35)', ['rgba(120,110,98,0.10)','rgba(90,82,72,0.06)','rgba(60,54,48,0.03)']),
      ready: make('rgba(128,86,31,0.98)', 'rgba(162,116,48,0.90)', 'rgba(255,198,92,1)', 'rgba(255,198,92,0.55)', ['rgba(255,182,66,0.26)','rgba(255,157,52,0.15)','rgba(255,136,40,0.08)']),
      mastered: make('rgba(32,100,68,0.98)', 'rgba(58,132,96,0.90)', 'rgba(125,241,186,1)', 'rgba(125,241,186,0.55)', ['rgba(90,234,164,0.26)','rgba(76,210,148,0.15)','rgba(54,170,116,0.08)']),
      start: make('rgba(110,87,26,0.98)', 'rgba(157,124,42,0.92)', 'rgba(255,220,106,1)', 'rgba(255,220,106,0.55)', ['rgba(255,209,105,0.28)','rgba(255,184,90,0.16)','rgba(235,152,59,0.08)']),
      selected: make('rgba(135,98,28,0.99)', 'rgba(182,139,52,0.94)', 'rgba(255,236,138,1)', 'rgba(255,236,138,0.62)', ['rgba(255,220,120,0.34)','rgba(255,196,98,0.20)','rgba(255,168,70,0.10)']),
      connectTarget: make('rgba(126,72,21,0.99)', 'rgba(170,104,35,0.90)', 'rgba(255,182,86,1)', 'rgba(255,182,86,0.58)', ['rgba(255,180,88,0.32)','rgba(246,140,56,0.18)','rgba(222,116,38,0.10)']),
    };
  }, []);
  const atlasOk = !FORCE_FALLBACK_NODES && !!nodeAtlas?.tokenAtlasImage && !!nodeAtlas?.haloAtlasImage && !!nodeAtlas?.ringAtlasImage && !!nodeAtlas?.rectsByVariant;

  const dustAtlasSets = useMemo(() => {
    const W = 3600;
    const H = 3600;
    const spriteSize = 8;
    const surface = Skia.Surface.MakeOffscreen(spriteSize, spriteSize);
    const c = surface.getCanvas();
    c.clear(Skia.Color('rgba(0,0,0,0)'));
    const p = Skia.Paint();
    p.setColor(Skia.Color('rgba(255,255,255,0.12)'));
    c.drawRect(Skia.XYWHRect(0, 0, spriteSize, spriteSize), p);
    const image = surface.makeImageSnapshot();
    const spriteRect = Skia.XYWHRect(0, 0, spriteSize, spriteSize);

    const makeSet = (seed, count) => {
      const rand = mulberry32(seed);
      const sprites = new Array(count);
      const transforms = new Array(count);
      for (let i = 0; i < count; i++) {
        const x = (rand() - 0.5) * W;
        const y = (rand() - 0.5) * H;
        const s = 0.45 + rand() * 0.9;
        sprites[i] = spriteRect;
        transforms[i] = Skia.RSXform(s, 0, x, y);
      }
      return { image, sprites, transforms };
    };

    return {
      near: makeSet(1337, 900),
      mid: makeSet(1441, 500),
      far: makeSet(1559, 250),
    };
  }, []);
  const dustAtlas = LOD.isFar ? dustAtlasSets.far : LOD.isMid ? dustAtlasSets.mid : dustAtlasSets.near;

  const edgeBuckets = useMemo(()=>{
    const branchBase = Skia.Path.Make();
    const mastered = Skia.Path.Make();
    const masteredCore = Skia.Path.Make();
    const ready = Skia.Path.Make();
    const locked = Skia.Path.Make();
    let hasMastered=false, hasReady=false, hasLocked=false;
    for(const e of visibleEdges){
      const fn=nodeMap.get(e.from);
      const tn=nodeMap.get(e.to);
      if(!fn||!tn) continue;
      branchBase.moveTo(fn.x,fn.y);
      branchBase.lineTo(tn.x,tn.y);

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
          masteredCore.moveTo(fn.x,fn.y);
          masteredCore.lineTo(tn.x,tn.y);
          hasMastered=true;
        }else if((fromLit&&!toLit)||(toReady)||(fromStart&&toState==='locked')){
          bucket=ready;
          hasReady=true;
        }else{
          hasLocked=true;
        }
      }else{
        hasLocked=true;
      }
      bucket.moveTo(fn.x,fn.y);
      bucket.lineTo(tn.x,tn.y);
    }
    return { branchBase, mastered, masteredCore, ready, locked, hasMastered, hasReady, hasLocked };
  },[bld,nodeMap,nodeStatusMap,visibleEdges]);

  const dragEdgeOverlay = useMemo(() => {
    if (!dragVisual?.id) return null;
    const overlay = { branchBase: Skia.Path.Make(), mastered: Skia.Path.Make(), masteredCore: Skia.Path.Make(), ready: Skia.Path.Make(), locked: Skia.Path.Make(), hasMastered: false, hasReady: false, hasLocked: false };
    const incident = incidentEdgesByNode.get(dragVisual.id) || [];
    for (const e of incident) {
      const fn = nodeMap.get(e.from);
      const tn = nodeMap.get(e.to);
      if (!fn || !tn) continue;
      const fromPos = e.from === dragVisual.id ? dragVisual : fn;
      const toPos = e.to === dragVisual.id ? dragVisual : tn;
      overlay.branchBase.moveTo(fromPos.x, fromPos.y);
      overlay.branchBase.lineTo(toPos.x, toPos.y);
      let bucket = overlay.locked;
      if (!bld) {
        const fromState=nodeStatusMap[fn.id] || 'locked';
        const toState=nodeStatusMap[tn.id] || 'locked';
        const fromLit=fromState==='start'||fromState==='mastered';
        const toLit=toState==='start'||toState==='mastered';
        const toReady=toState==='ready';
        const fromStart=fromState==='start';
        if(fromLit&&toLit){
          bucket=overlay.mastered;
          overlay.masteredCore.moveTo(fromPos.x,fromPos.y);
          overlay.masteredCore.lineTo(toPos.x,toPos.y);
          overlay.hasMastered=true;
        }else if((fromLit&&!toLit)||(toReady)||(fromStart&&toState==='locked')){
          bucket=overlay.ready;
          overlay.hasReady=true;
        }else{
          overlay.hasLocked=true;
        }
      } else {
        overlay.hasLocked=true;
      }
      bucket.moveTo(fromPos.x,fromPos.y);
      bucket.lineTo(toPos.x,toPos.y);
    }
    return overlay;
  }, [bld, dragVisual, incidentEdgesByNode, nodeMap, nodeStatusMap]);

  const nodeScaleByLod = LOD.isFar ? 0.31 : LOD.isMid ? 0.36 : 0.42;
  const xformAt = (scale, cx, cy) => Skia.RSXform(scale, 0, cx, cy);

  const nodeSprites = useMemo(() => {
    const tokenSprites = [];
    const tokenTransforms = [];
    const haloSprites = [];
    const haloTransforms = [];
    const ringSprites = [];
    const ringTransforms = [];
    const iconSprites = [];
    const iconTransforms = [];

    for (const n of visibleNodes) {
      const status = nodeStatusMap[n.id] || 'locked';
      const rx = dragVisual?.id===n.id ? dragVisual.x : n.x;
      const ry = dragVisual?.id===n.id ? dragVisual.y : n.y;
      const variant = bld && connA===n.id
        ? 'connectTarget'
        : selectedNodeId===n.id
          ? 'selected'
          : status;

      const cellRect = nodeAtlas.rectsByVariant[variant] || nodeAtlas.rectsByVariant.locked;

      tokenSprites.push(cellRect);
      tokenTransforms.push(xformAt(nodeScaleByLod, rx, ry));

      const isLit = status === 'start' || status === 'mastered' || status === 'ready' || variant === 'selected' || variant === 'connectTarget';
      if (isLit && !LOD.isFar) {
        const haloScale = nodeScaleByLod * (LOD.isNear ? 1.16 : 1.06);
        haloSprites.push(cellRect);
        haloTransforms.push(xformAt(haloScale, rx, ry));
      }

      if (LOD.showOuterRing && (status === 'mastered' || status === 'start' || status === 'ready' || variant === 'connectTarget' || variant === 'selected')) {
        const ringScale = nodeScaleByLod * 1.24;
        ringSprites.push(cellRect);
        ringTransforms.push(xformAt(ringScale, rx, ry));
      }

      if (LOD.isNear && !isInteracting) {
        const iconKey = NODE_ICON_MAP[n.id] || 'star';
        const iconRect = nodeAtlas.iconRectsByKey[iconKey];
        if (iconRect) {
          const iconScale = 0.26;
          iconSprites.push(iconRect);
          iconTransforms.push(xformAt(iconScale, rx, ry));
        }
      }
    }

    return { tokenSprites, tokenTransforms, haloSprites, haloTransforms, ringSprites, ringTransforms, iconSprites, iconTransforms };
  }, [LOD.isFar, LOD.isNear, LOD.showOuterRing, bld, connA, dragVisual, isInteracting, nodeAtlas.iconRectsByKey, nodeAtlas.rectsByVariant, nodeScaleByLod, nodeStatusMap, selectedNodeId, visibleNodes]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId || isInteracting) return null;
    return visibleNodes.find((n) => n.id === selectedNodeId) || tree.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [isInteracting, selectedNodeId, tree.nodes, visibleNodes]);

  return(
    <Canvas style={{width:canvasSize.width,height:canvasSize.height}}>
      <Rect x={0} y={0} width={canvasSize.width} height={canvasSize.height}>
        <LinearGradient start={vec(0, 0)} end={vec(canvasSize.width, canvasSize.height)} colors={['#0f0d0b', '#191510', '#241f17']} />
      </Rect>
      <Image image={stoneTexture} x={0} y={0} width={canvasSize.width} height={canvasSize.height} opacity={0.52} fit="fill" />
      <Rect x={0} y={0} width={canvasSize.width} height={canvasSize.height}>
        <RadialGradient c={vec(canvasSize.width*0.5, canvasSize.height*0.45)} r={Math.max(canvasSize.width, canvasSize.height)*0.85} colors={['rgba(0,0,0,0)','rgba(0,0,0,0.22)','rgba(0,0,0,0.72)']} />
      </Rect>

      <Group transform={sceneTransform}>
        <Atlas
          image={dustAtlas.image}
          sprites={dustAtlas.sprites}
          transforms={dustAtlas.transforms}
        />

        <Path path={edgeBuckets.branchBase} style="stroke" strokeWidth={LOD.isFar?2.2:LOD.isMid?3.1:4.2} color="rgba(42,34,28,0.58)" strokeCap="round" />
        <Path path={edgeBuckets.branchBase} style="stroke" strokeWidth={LOD.isFar?0.9:1.2} color="rgba(20,17,14,0.45)" strokeCap="round" />
        {dragEdgeOverlay && (
          <>
            <Path path={dragEdgeOverlay.branchBase} style="stroke" strokeWidth={LOD.isFar?2.2:LOD.isMid?3.1:4.2} color="rgba(42,34,28,0.58)" strokeCap="round" />
            <Path path={dragEdgeOverlay.branchBase} style="stroke" strokeWidth={LOD.isFar?0.9:1.2} color="rgba(20,17,14,0.45)" strokeCap="round" />
          </>
        )}

        {edgeBuckets.hasMastered&&LOD.isNear&&!isInteracting&&USE_GLOW&&(
          <Path path={edgeBuckets.mastered} style="stroke" strokeWidth={edgeVisual.masteredW+2.8} color="rgba(94,240,173,0.23)" strokeCap="round" />
        )}
        {edgeBuckets.hasMastered&&(
          <Path path={edgeBuckets.mastered} style="stroke" strokeWidth={edgeVisual.masteredW+0.9} color={`rgba(78,224,158,${Math.min(0.95,edgeVisual.masteredO+0.08)})`} strokeCap="round" />
        )}
        {edgeBuckets.hasMastered&&(
          <Path path={edgeBuckets.masteredCore} style="stroke" strokeWidth={LOD.isFar?0.6:0.9} color="rgba(203,255,232,0.9)" strokeCap="round" />
        )}
        {edgeBuckets.hasReady&&(
          <Path path={edgeBuckets.ready} style="stroke" strokeWidth={edgeVisual.readyW+0.7} color={`rgba(255,183,77,${Math.min(0.9,edgeVisual.readyO+0.1)})`} strokeCap="round">
            {LOD.useDashedReady&&!bld&&<DashPathEffect intervals={[12,10]} />}
          </Path>
        )}
        {edgeBuckets.hasLocked&&(
          <Path path={edgeBuckets.locked} style="stroke" strokeWidth={edgeVisual.lockedW} color={bld?`rgba(110,95,80,${Math.min(0.6,edgeVisual.lockedO+0.15)})`:`rgba(94,84,75,${Math.min(0.55,edgeVisual.lockedO+0.12)})`} strokeCap="round" />
        )}
        {dragEdgeOverlay?.hasMastered&&(
          <Path path={dragEdgeOverlay.mastered} style="stroke" strokeWidth={edgeVisual.masteredW+0.9} color={`rgba(78,224,158,${Math.min(0.95,edgeVisual.masteredO+0.08)})`} strokeCap="round" />
        )}
        {dragEdgeOverlay?.hasMastered&&(
          <Path path={dragEdgeOverlay.masteredCore} style="stroke" strokeWidth={LOD.isFar?0.6:0.9} color="rgba(203,255,232,0.9)" strokeCap="round" />
        )}
        {dragEdgeOverlay?.hasReady&&(
          <Path path={dragEdgeOverlay.ready} style="stroke" strokeWidth={edgeVisual.readyW+0.7} color={`rgba(255,183,77,${Math.min(0.9,edgeVisual.readyO+0.1)})`} strokeCap="round" />
        )}
        {dragEdgeOverlay?.hasLocked&&(
          <Path path={dragEdgeOverlay.locked} style="stroke" strokeWidth={edgeVisual.lockedW} color={bld?`rgba(110,95,80,${Math.min(0.6,edgeVisual.lockedO+0.15)})`:`rgba(94,84,75,${Math.min(0.55,edgeVisual.lockedO+0.12)})`} strokeCap="round" />
        )}

        {atlasOk ? (
          <>
            {!LOD.isFar && nodeSprites.haloSprites.length > 0 && (
              <Group blendMode="screen">
                <Atlas image={nodeAtlas.haloAtlasImage} sprites={nodeSprites.haloSprites} transforms={nodeSprites.haloTransforms} />
              </Group>
            )}

            <Atlas image={nodeAtlas.tokenAtlasImage} sprites={nodeSprites.tokenSprites} transforms={nodeSprites.tokenTransforms} />

            {LOD.showOuterRing && nodeSprites.ringSprites.length > 0 && (
              <Group blendMode="screen">
                <Atlas image={nodeAtlas.ringAtlasImage} sprites={nodeSprites.ringSprites} transforms={nodeSprites.ringTransforms} />
              </Group>
            )}

            {LOD.isNear && !isInteracting && nodeSprites.iconSprites.length > 0 && (
              <Atlas image={nodeAtlas.iconAtlasImage} sprites={nodeSprites.iconSprites} transforms={nodeSprites.iconTransforms} />
            )}
          </>
        ) : (
          <>
            {visibleNodes.map((n) => {
              const status = nodeStatusMap[n.id] || 'locked';
              const rx = dragVisual?.id===n.id ? dragVisual.x : n.x;
              const ry = dragVisual?.id===n.id ? dragVisual.y : n.y;
              const variant = bld && connA===n.id ? 'connectTarget' : selectedNodeId===n.id ? 'selected' : status;
              const P = nodePaints[variant] || nodePaints.locked;
              const r = LOD.isFar ? 20 : LOD.isMid ? 26 : 32;
              const isLit = status==='start' || status==='mastered' || status==='ready' || variant==='selected' || variant==='connectTarget';
              const iconKey = NODE_ICON_MAP[n.id] || 'star';
              const iconPath = iconPathCache[iconKey];

              return (
                <Group key={n.id}>
                  {isLit && !LOD.isFar && (
                    <Group blendMode="screen">
                      <Circle cx={rx} cy={ry} r={r*2.05} color={P.halo2} />
                      <Circle cx={rx} cy={ry} r={r*1.65} color={P.halo1} />
                      <Circle cx={rx} cy={ry} r={r*1.25} color={P.halo0} />
                    </Group>
                  )}

                  {LOD.isNear && isLit && (
                    <Group blendMode="screen">
                      <Circle cx={rx} cy={ry} r={r*1.55} color={P.ring} />
                    </Group>
                  )}

                  <Circle cx={rx} cy={ry} r={r*1.12} color={P.rim} />
                  <Circle cx={rx} cy={ry} r={r*1.02} color={P.body} />
                  <Circle cx={rx} cy={ry} r={r*0.78} color="rgba(255,255,255,0.12)" />
                  <Circle cx={rx} cy={ry} r={r*0.72} color={P.plate} />
                  <Circle cx={rx + r*0.18} cy={ry + r*0.22} r={r*0.62} color="rgba(0,0,0,0.18)" />
                  <Circle cx={rx - r*0.35} cy={ry - r*0.38} r={r*0.18} color="rgba(255,255,255,0.16)" />

                  {LOD.isNear && !isInteracting && iconPath && (
                    <Group transform={[{ translateX: rx }, { translateY: ry }, { scale: r / 70 }, { translateX: -48 }, { translateY: -48 }]}> 
                      <Path path={iconPath} color="rgba(0,0,0,0.55)" transform={[{ translateX: 2.2 }, { translateY: 2.6 }]} />
                      <Path path={iconPath} color="rgba(249,246,236,0.98)" />
                    </Group>
                  )}
                </Group>
              );
            })}
          </>
        )}

        {selectedNode && LOD.isNear && (
          <Circle cx={selectedNode.x} cy={selectedNode.y} r={NODE_R*1.08} color="rgba(255,220,118,0.18)">
            <Blur blur={GLOW_QUALITY==='high'?16:10} />
          </Circle>
        )}

        {visibleNodes.map(n=>{
          const rx=dragVisual?.id===n.id?dragVisual.x:n.x;
          const ry=dragVisual?.id===n.id?dragVisual.y:n.y;
          const lines=wrappedLabels[n.id]||[n.name];
          const lh=13;
          const sy=ry-(lines.length*lh)/2+lh*0.8;
          const status=nodeStatusMap[n.id]||'locked';
          const isLit=status==='start'||status==='mastered'||status==='ready';
          return LOD.showLabels&&!isInteracting ? lines.map((ln,li)=>(
            <SkiaText
              key={`${n.id}_${li}`}
              x={rx-(ln.length*2.8)}
              y={sy+li*lh}
              text={ln}
              font={labelFont}
              color={isLit?C.textMain:C.textDim}
            />
          )) : null;
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

  const incidentEdgesByNode = useMemo(() => {
    const out = new Map();
    for (const e of visibleEdges) {
      if (!out.has(e.from)) out.set(e.from, []);
      if (!out.has(e.to)) out.set(e.to, []);
      out.get(e.from).push(e);
      if (e.to !== e.from) out.get(e.to).push(e);
    }
    return out;
  }, [visibleEdges]);

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
            incidentEdgesByNode={incidentEdgesByNode}
            LOD={LOD}
            edgeVisual={edgeVisual}
            bld={bld}
            connA={connA}
            isInteracting={isInteracting}
            canvasSize={canvasSize}
            selectedNodeId={sel?.id || null}
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
