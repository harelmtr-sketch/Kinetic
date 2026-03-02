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
import Svg, { Line, Circle, Text as SvgText, G, Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

const STORAGE_KEY = 'calisthenics_tree_v1';
const NODE_R = 46;
const MIN_SC = 0.15;
const MAX_SC = 6;

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
  const [xform,setXform]=useState({tx:0,ty:0,sc:1});
  const xformRaf=useRef(null),xformPending=useRef({tx:0,ty:0,sc:1});
  const applyXform=(tx,ty,sc)=>{
    txN.current=tx;tyN.current=ty;scN.current=sc;
    xformPending.current={tx,ty,sc};
    if(xformRaf.current) return;
    xformRaf.current=requestAnimationFrame(()=>{
      xformRaf.current=null;
      setXform(xformPending.current);
    });
  };

  useEffect(()=>()=>{if(xformRaf.current) cancelAnimationFrame(xformRaf.current);},[]);

  const [canvasSize,setCanvasSize]=useState({width:0,height:0});

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

  const panR=useRef(PanResponder.create({
    onStartShouldSetPanResponder:()=>true,
    onStartShouldSetPanResponderCapture:()=>false,
    onMoveShouldSetPanResponder:(_,g)=>Math.hypot(g.dx,g.dy)>3,
    onMoveShouldSetPanResponderCapture:()=>false,
    onPanResponderGrant:evt=>{
      const ts=evt.nativeEvent.touches;
      moved.current=false;dId.current=null;pOn.current=false;
      if(ts.length>=2){
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
        if(hit){dId.current=hit.id;dNx.current=hit.x;dNy.current=hit.y;const p=toSVG(t.pageX,t.pageY);dPx.current=p.x;dPy.current=p.y;}
      }
    },
    onPanResponderMove:evt=>{
      const ts=evt.nativeEvent.touches;
      if(pOn.current&&ts.length>=2){
        const d=Math.hypot(ts[0].pageX-ts[1].pageX,ts[0].pageY-ts[1].pageY);
        const newSc=Math.min(Math.max(pSc0.current*(d/pD0.current),MIN_SC),MAX_SC);
        const curMx=(ts[0].pageX+ts[1].pageX)/2-cL.current;
        const curMy=(ts[0].pageY+ts[1].pageY)/2-cT.current;
        const svgMx=(pMx0.current-pTx0.current)/pSc0.current;
        const svgMy=(pMy0.current-pTy0.current)/pSc0.current;
        applyXform(curMx-svgMx*newSc,curMy-svgMy*newSc,newSc);
        moved.current=true;return;
      }
      if(ts.length!==1) return;
      const t=ts[0];
      if(Math.hypot(t.pageX-gSx.current,t.pageY-gSy.current)>6) moved.current=true;
      if(bR.current&&tR2.current==='move'&&dId.current){
        const p=toSVG(t.pageX,t.pageY);
        const nx=dNx.current+(p.x-dPx.current),ny=dNy.current+(p.y-dPy.current);
        tR.current={...tR.current,nodes:tR.current.nodes.map(n=>n.id===dId.current?{...n,x:nx,y:ny}:n)};
        _setTree({...tR.current});gLx.current=t.pageX;gLy.current=t.pageY;return;
      }
      applyXform(txN.current+(t.pageX-gLx.current),tyN.current+(t.pageY-gLy.current),scN.current);
      gLx.current=t.pageX;gLy.current=t.pageY;
    },
    onPanResponderRelease:evt=>{
      pOn.current=false;
      if(bR.current&&tR2.current==='move'&&dId.current&&moved.current){commit(tR.current);dId.current=null;return;}
      dId.current=null;
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
    onPanResponderTerminate:()=>{pOn.current=false;dId.current=null;},
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

  // ── SVG node/edge styling ──────────────────────────────────────────────────
  const nStyle=n=>{
    if(bld&&connA===n.id) return{fill:'#2a1a00',stroke:C.amber,sw:2.5};
    if(n.isStart)          return{fill:'#0a1a0e',stroke:'#4CAF50',sw:2.5};
    if(n.unlocked)         return{fill:'#0a1a0e',stroke:'#4CAF50',sw:2.5};
    if(!bld&&canUnlock(n.id,tree.nodes,tree.edges)) return{fill:'#1a1800',stroke:'#FFC107',sw:2};
    return{fill:'#141210',stroke:'#3a3028',sw:1.5};
  };

  const eStyle=e=>{
    if(bld) return{s:'#3a3028',w:2,d:'none'};
    const fn=nodeMap.get(e.from),tn=nodeMap.get(e.to);
    if(fn?.unlocked&&tn?.unlocked) return{s:'#4CAF50',w:3,d:'none'};
    if(fn?.unlocked) return{s:'#FFC107',w:2,d:'16,16'};
    return{s:'#4a3e2e',w:1.5,d:'6,5'};
  };

  const wrap=name=>{
    const words=name.split(' ');const lines=[];let cur='';
    for(const w of words){const next=cur?cur+' '+w:w;if(next.length>10&&cur){lines.push(cur);cur=w;}else cur=next;}
    if(cur)lines.push(cur);return lines;
  };

  const matrix=`matrix(${xform.sc},0,0,${xform.sc},${xform.tx},${xform.ty})`;

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
    const margin=NODE_R*3;
    return tree.nodes.filter(n=>
      n.x>=visibleBounds.left-margin&&n.x<=visibleBounds.right+margin&&
      n.y>=visibleBounds.top-margin&&n.y<=visibleBounds.bottom+margin
    );
  },[tree.nodes,visibleBounds]);

  const visibleNodeIds=useMemo(()=>new Set(visibleNodes.map(n=>n.id)),[visibleNodes]);

  const visibleEdges=useMemo(()=>tree.edges.filter(e=>
    visibleNodeIds.has(e.from)||visibleNodeIds.has(e.to)
  ),[tree.edges,visibleNodeIds]);

  const showHalos=xform.sc>=0.35;
  const showLabels=xform.sc>=0.55;

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
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="haloGreen" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%"   stopColor="#4CAF50" stopOpacity="0.18"/>
              <Stop offset="55%"  stopColor="#4CAF50" stopOpacity="0.06"/>
              <Stop offset="100%" stopColor="#4CAF50" stopOpacity="0"/>
            </RadialGradient>
          </Defs>

          {/* ── Tree (transformed) ── */}
          <G transform={matrix}>

            {/* Green halos behind lit nodes */}
            {showHalos&&visibleNodes.map(n=>{
              const r=NODE_R*5;
              if(n.isStart||n.unlocked) return <Rect key={'h'+n.id} x={n.x-r} y={n.y-r} width={r*2} height={r*2} fill="url(#haloGreen)"/>;
              return null;
            })}

            {/* Edges */}
            {visibleEdges.map((e,i)=>{
              const fn=nodeMap.get(e.from);
              const tn=nodeMap.get(e.to);
              if(!fn||!tn) return null;
              const{s,w,d}=eStyle(e);
              return <Line key={i} x1={fn.x} y1={fn.y} x2={tn.x} y2={tn.y}
                stroke={s} strokeWidth={w} strokeDasharray={d} strokeLinecap="round"/>;
            })}

            {/* Nodes */}
            {visibleNodes.map(n=>{
              const{fill,stroke,sw}=nStyle(n);
              const lines=wrappedLabels[n.id]||[n.name];const lh=13;
              const sy=n.y-(lines.length*lh)/2+lh*0.8;
              const unlockable=!bld&&canUnlock(n.id,tree.nodes,tree.edges)&&!n.unlocked&&!n.isStart;
              const mastered=n.unlocked&&!bld;
              return(
                <G key={n.id}>
                  {(mastered||n.isStart)&&(
                    <Circle cx={n.x} cy={n.y} r={NODE_R+14} fill="none"
                      stroke='#4CAF50' strokeWidth={1} opacity={0.3}/>
                  )}
                  {unlockable&&(
                    <Circle cx={n.x} cy={n.y} r={NODE_R+14} fill="none"
                      stroke="#FFC107" strokeWidth={1.5} opacity={0.6}/>
                  )}
                  {bld&&connA===n.id&&(
                    <Circle cx={n.x} cy={n.y} r={NODE_R+14} fill="none"
                      stroke={C.amber} strokeWidth={2} opacity={0.7}/>
                  )}
                  <Circle cx={n.x} cy={n.y} r={NODE_R} fill={fill} stroke={stroke} strokeWidth={sw}/>
                  <Circle cx={n.x} cy={n.y} r={NODE_R-8} fill="none"
                    stroke={stroke} strokeWidth={0.5} opacity={0.4}/>
                  {showLabels&&lines.map((ln,li)=>(
                    <SvgText key={li} x={n.x} y={sy+li*lh}
                      fill={n.unlocked||n.isStart?C.textMain:C.textDim}
                      fontSize={10} fontWeight="bold" textAnchor="middle"
                      letterSpacing={0.5}>{ln}</SvgText>
                  ))}
                </G>
              );
            })}
          </G>
        </Svg>
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
