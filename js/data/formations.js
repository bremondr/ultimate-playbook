/* ---------- formations offered in the editor (positions are built in model/formation.js) ----------
   Offensive setups from the tactics overview. Left and right are as the thrower looks downfield; a pair with
   `-l` and `-r` ids are mirror images of each other. `desc` starts a new drill's summary: {s} is the formation's
   side and {o} the other one. */
export const FORMATIONS = [
  {id:'vert', name:'Vertical stack', desc:'Cutters in one line down the middle, handlers behind the disc. Cuts go into the open lanes at the sides.'},
  {id:'vert-dump', name:'Vertical stack with dump', desc:'Cutters in one line down the middle, a dump handler close behind the thrower.'},
  {id:'ho', name:'Horizontal stack', desc:'Handlers across the back, cutters in a line across the field. Cuts go into the space in front and behind the line.'},
  {id:'side-l', name:'Side stack left', desc:'All cutters stacked along the {s} sideline, the {o} side of the field open.'},
  {id:'side-r', name:'Side stack right', desc:'All cutters stacked along the {s} sideline, the {o} side of the field open.'},
  {id:'spread', name:'Spread', desc:'Handlers across the back, cutters in pairs near each sideline, the middle open.'},
  {id:'iso-l', name:'Iso left', desc:'One cutter isolated on the {s}, the other cutters cleared to the {o}.'},
  {id:'iso-r', name:'Iso right', desc:'One cutter isolated on the {s}, the other cutters cleared to the {o}.'},
  {id:'split-l', name:'Split stack 3-2 left', desc:'Two short vertical stacks, the bigger one on the {s}, the middle open downfield.'},
  {id:'split-r', name:'Split stack 3-2 right', desc:'Two short vertical stacks, the bigger one on the {s}, the middle open downfield.'},
  {id:'swing-l', name:'Dump and swing left', desc:'The disc near the {s} sideline, a dump handler behind toward the middle and a swing handler across the field. Dump, then swing to move the disc and change the force.'},
  {id:'swing-r', name:'Dump and swing right', desc:'The disc near the {s} sideline, a dump handler behind toward the middle and a swing handler across the field. Dump, then swing to move the disc and change the force.'},
  {id:'ez-iso-l', name:'End zone iso left', desc:'Just outside the end zone: handlers across, cutters at the back of the end zone, one isolated cutter on the {s} near the goal line.'},
  {id:'ez-iso-r', name:'End zone iso right', desc:'Just outside the end zone: handlers across, cutters at the back of the end zone, one isolated cutter on the {s} near the goal line.'},
  {id:'ez-vert', name:'End zone vertical stack', desc:'Just outside the end zone: the stack starts at the goal line and runs into the end zone.'},
  {id:'zone-o', name:'Zone offense', desc:'Against a zone: handlers across the top, poppers in the gaps behind the cup, deep cutters behind them. Move the disc fast.'}
];
