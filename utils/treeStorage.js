import AsyncStorage from '@react-native-async-storage/async-storage';

const TREE_KEY = 'calisthenics_skill_tree';

const DEFAULT_TREE = {
  nodes: [
    { id: "start", name: "Start", x: 300, y: 100, unlocked: true, isStart: true, description: "Your journey begins here.", visualPlaceholder: "[Hero image: athlete standing tall]" },
    { id: "dead_hang", name: "Dead Hang", x: 300, y: 250, unlocked: false, isStart: false, description: "Hang from a bar with arms fully extended. Builds grip and shoulder strength.", visualPlaceholder: "[Video clip: dead hang form guide]" },
    { id: "active_hang", name: "Active Hang", x: 300, y: 400, unlocked: false, isStart: false, description: "Hang with shoulders actively depressed and engaged.", visualPlaceholder: "[Video clip: active hang vs dead hang comparison]" },
    { id: "scapular_pulls", name: "Scapular Pulls", x: 150, y: 550, unlocked: false, isStart: false, description: "Retract and depress scapula while hanging. Foundation for pull movements.", visualPlaceholder: "[Diagram: scapula movement illustration]" },
    { id: "negative_pullup", name: "Negative Pull-Up", x: 450, y: 550, unlocked: false, isStart: false, description: "Slowly lower yourself from the top of a pull-up. Builds eccentric strength.", visualPlaceholder: "[Video clip: slow negative pull-up demo]" },
    { id: "pullup", name: "Pull-Up", x: 300, y: 700, unlocked: false, isStart: false, description: "Full pull-up from dead hang to chin over bar.", visualPlaceholder: "[Video clip: strict pull-up form]" },
    { id: "pushup", name: "Push-Up", x: 600, y: 250, unlocked: false, isStart: false, description: "Standard push-up. Foundation of all pushing movements.", visualPlaceholder: "[Video clip: push-up form guide]" },
    { id: "diamond_pushup", name: "Diamond Push-Up", x: 600, y: 400, unlocked: false, isStart: false, description: "Tricep-focused push-up with hands forming a diamond.", visualPlaceholder: "[Diagram: hand placement for diamond push-up]" },
    { id: "pike_pushup", name: "Pike Push-Up", x: 750, y: 550, unlocked: false, isStart: false, description: "Shoulder-focused push-up in pike position.", visualPlaceholder: "[Video clip: pike push-up demo]" },
    { id: "hspu", name: "HSPU", x: 750, y: 700, unlocked: false, isStart: false, description: "Handstand Push-Up. Advanced shoulder pressing skill.", visualPlaceholder: "[Video clip: wall HSPU progression]" },
  ],
  edges: [
    { from: "start", to: "dead_hang" },
    { from: "start", to: "pushup" },
    { from: "dead_hang", to: "active_hang" },
    { from: "active_hang", to: "scapular_pulls" },
    { from: "active_hang", to: "negative_pullup" },
    { from: "scapular_pulls", to: "pullup" },
    { from: "negative_pullup", to: "pullup" },
    { from: "pushup", to: "diamond_pushup" },
    { from: "diamond_pushup", to: "pike_pushup" },
    { from: "pike_pushup", to: "hspu" },
  ],
};

export async function loadTree() {
  try {
    const saved = await AsyncStorage.getItem(TREE_KEY);
    if (saved) return JSON.parse(saved);
    return JSON.parse(JSON.stringify(DEFAULT_TREE));
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_TREE));
  }
}

export async function saveTree(tree) {
  try {
    await AsyncStorage.setItem(TREE_KEY, JSON.stringify(tree));
  } catch (e) {
    console.error('Failed to save tree', e);
  }
}

export async function resetTree() {
  try {
    await AsyncStorage.removeItem(TREE_KEY);
    return JSON.parse(JSON.stringify(DEFAULT_TREE));
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_TREE));
  }
}

export function isUnlockable(nodeId, nodes, edges) {
  const parents = edges.filter(e => e.to === nodeId).map(e => e.from);
  if (parents.length === 0) return false;
  return parents.every(parentId => {
    const parent = nodes.find(n => n.id === parentId);
    return parent && parent.unlocked;
  });
}