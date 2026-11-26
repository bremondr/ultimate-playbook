/* ---------- formations offered in the editor (positions are built in model/formation.js) ----------
   Offensive setups from the tactics overview. Left and right are as the thrower looks downfield; a pair with
   `-l` and `-r` ids are mirror images of each other. */
export const FORMATIONS = [
  {id:'vert', name:'Vertical stack'},
  {id:'vert-dump', name:'Vertical stack with dump'},
  {id:'ho', name:'Horizontal stack'},
  {id:'side-l', name:'Side stack left'},
  {id:'side-r', name:'Side stack right'},
  {id:'spread', name:'Spread'},
  {id:'iso-l', name:'Iso left'},
  {id:'iso-r', name:'Iso right'},
  {id:'split-l', name:'Split stack 3-2 left'},
  {id:'split-r', name:'Split stack 3-2 right'},
  {id:'swing-l', name:'Dump and swing left'},
  {id:'swing-r', name:'Dump and swing right'},
  {id:'ez-iso-l', name:'End zone iso left'},
  {id:'ez-iso-r', name:'End zone iso right'},
  {id:'ez-vert', name:'End zone vertical stack'},
  {id:'zone-o', name:'Zone offense'}
];

/* ---------- defenses offered on top of a formation (placed by model/defense.js) ----------
   person: one defender follows each attacker, the one on the disc marks. zone: free defenders who hold their
   spot, plus a mark that moves with the disc where the zone has one. */
export const DEFENSES = [
  {id:'none', name:'No defense'},
  {id:'left', name:'Force left', kind:'person'},
  {id:'right', name:'Force right', kind:'person'},
  {id:'straight', name:'Straight up', kind:'person'},
  {id:'middle', name:'Force middle', kind:'person'},
  {id:'trap-l', name:'Trap left', kind:'person'},
  {id:'trap-r', name:'Trap right', kind:'person'},
  {id:'cup', name:'Cup zone', kind:'zone'},
  {id:'331', name:'3-3-1 zone', kind:'zone'},
  {id:'232', name:'2-3-2 zone', kind:'zone'},
  {id:'wall', name:'Wall (1-3-3)', kind:'zone'},
  {id:'clam-l', name:'Clam left', kind:'zone'},
  {id:'clam-r', name:'Clam right', kind:'zone'}
];
export const defenseOf = id => DEFENSES.find(d => d.id === id) || null;
