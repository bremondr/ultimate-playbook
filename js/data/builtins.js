/* ---------- built-in plays and drills ---------- */
import { angelDrill } from './angel.js';
import { r2 } from '../util.js';

export const BUILTIN = [
{
  id:'vert-stack', kind:'Play', name:'Vertical stack: under & deep',
  summary:'Front of the stack cuts under to the open side, back of the stack goes deep into the space the stack kept clear.',
  chips:[['Force','flick'],['Open side','lower half'],['Throws','2']],
  view:[28,100], disc:'H1',
  players:[
    {id:'H1',team:'O',at:[40,22]}, {id:'H2',team:'O',at:[35,14]},
    {id:'1',team:'O',at:[50,18.5]},{id:'2',team:'O',at:[55,18.5]},{id:'3',team:'O',at:[60,18.5]},{id:'4',team:'O',at:[65,18.5]},{id:'5',team:'O',at:[70,18.5]},
    {id:'m1',team:'D',follow:'H1',offset:[1.3,-1.4],lag:.12},{id:'m2',team:'D',follow:'H2',offset:[1.6,0.9],lag:.3},
    {id:'d1',team:'D',follow:'1',offset:[1.1,-1.5],lag:.35},{id:'d2',team:'D',follow:'2',offset:[1.1,-1.5],lag:.35},{id:'d3',team:'D',follow:'3',offset:[1.1,-1.5],lag:.35},{id:'d4',team:'D',follow:'4',offset:[1.1,-1.5],lag:.35},{id:'d5',team:'D',follow:'5',offset:[1.1,-1.5],lag:.4}
  ],
  steps:[
    {dur:2.8,title:'Under cut from the front',note:'Cutter 1 jabs deep for two steps, plants, and cuts back toward the disc into the open side. H1 leads the cutter with a flick to space.',
      moves:{'1':{path:[[54,16.5],[46,27.5]],start:.15,end:.85}}, throw:{from:'H1',to:'1',start:.62,end:.9,curve:.12}},
    {dur:3.4,title:'Deep cut from the back',note:'As soon as 1 turns upfield, 5 at the back of the stack attacks the deep open-side lane. H2 moves up as the reset; 1 puts it deep.',
      moves:{'5':{path:[[73,20.5],[89,28]],start:0,end:.9},'H2':{path:[[42,17]],start:.15,end:.8},'H1':{path:[[44,24]],start:0,end:.6}},
      throw:{from:'1',to:'5',start:.38,end:.95,curve:-.16}},
    {dur:1.8,title:'Score, then crash',note:'The rest of the stack holds the lane clear until the huck is up, then crashes toward the end zone for a second look.',
      moves:{'2':{path:[[66,22]]},'3':{path:[[71,21]]},'4':{path:[[76,20]]}}}
  ]
},
{
  id:'ho-stack', kind:'Play', name:'Horizontal stack: under, deep, continue',
  summary:'Three handlers across the field, four cutters flat. An under cut opens a deep lane for the next cutter.',
  chips:[['Force','backhand'],['Handlers','3'],['Throws','3']],
  view:[28,100], disc:'H1',
  players:[
    {id:'H1',team:'O',at:[38,18.5]},{id:'H2',team:'O',at:[36,8]},{id:'H3',team:'O',at:[36,29]},
    {id:'1',team:'O',at:[56,5]},{id:'2',team:'O',at:[56,14]},{id:'3',team:'O',at:[56,23]},{id:'4',team:'O',at:[56,32]},
    {id:'m1',team:'D',follow:'H1',offset:[1.3,1.3],lag:.12},{id:'m2',team:'D',follow:'H2',offset:[1.5,1],lag:.3},{id:'m3',team:'D',follow:'H3',offset:[1.5,-1],lag:.3},
    {id:'d1',team:'D',follow:'1',offset:[-1.5,0.5],lag:.35},{id:'d2',team:'D',follow:'2',offset:[-1.5,0.5],lag:.35},{id:'d3',team:'D',follow:'3',offset:[-1.5,0.5],lag:.4},{id:'d4',team:'D',follow:'4',offset:[-1.5,-0.5],lag:.4}
  ],
  steps:[
    {dur:2.8,title:'Under cut into the lane',note:'Cutter 2 sells deep, then cuts under into the space between handlers and cutters. H1 hits the cut early.',
      moves:{'2':{path:[[61,13.5],[47,15]],start:.1,end:.8}}, throw:{from:'H1',to:'2',start:.55,end:.88,curve:.1}},
    {dur:3.2,title:'Deep strike behind',note:'Cutter 3 attacks the space 2 just left. 1 and 4 widen to keep the lane open. 2 turns and puts it deep before the defense recovers.',
      moves:{'3':{path:[[58,22],[80,20]],start:.05,end:.85},'1':{path:[[61,3.5]],start:0,end:.7},'4':{path:[[61,33.5]],start:0,end:.7}},
      throw:{from:'2',to:'3',start:.4,end:.95,curve:.15}},
    {dur:2.6,title:'Continuation to the end zone',note:'4 keeps running the far lane. A short continuation throw finishes the point.',
      moves:{'4':{path:[[70,32],[87,28]],start:0,end:.78}}, throw:{from:'3',to:'4',start:.4,end:.88,curve:-.1}}
  ]
},
{
  id:'dump-swing', kind:'Play', name:'Dump & swing off the sideline',
  summary:'The disc is trapped on the sideline. A dump behind the mark and a swing to the middle reset the stall and flip the open side.',
  chips:[['Force','trap'],['Stall','resets on dump'],['Throws','3']],
  view:[26,92], disc:'H1',
  players:[
    {id:'H1',team:'O',at:[48,34.5]},{id:'H2',team:'O',at:[44,28]},{id:'H3',team:'O',at:[43,14]},
    {id:'1',team:'O',at:[60,18]},{id:'2',team:'O',at:[65,18]},{id:'3',team:'O',at:[70,18]},{id:'4',team:'O',at:[75,18]},
    {id:'m1',team:'D',follow:'H1',offset:[0.6,-1.6],lag:.12},{id:'m2',team:'D',follow:'H2',offset:[1.4,-1],lag:.3},{id:'m3',team:'D',follow:'H3',offset:[1.4,1],lag:.3},
    {id:'d1',team:'D',follow:'1',offset:[1,1.5],lag:.35},{id:'d2',team:'D',follow:'2',offset:[1,1.5],lag:.35},{id:'d3',team:'D',follow:'3',offset:[1,1.5],lag:.35},{id:'d4',team:'D',follow:'4',offset:[1,1.5],lag:.35}
  ],
  steps:[
    {dur:2.8,title:'Dump behind the mark',note:'H1 is trapped. H2 fakes upfield, then cuts back behind the disc for an easy dump. The stall count resets.',
      moves:{'H2':{path:[[49,26.5],[42,32]],start:.05,end:.75}}, throw:{from:'H1',to:'H2',start:.5,end:.82,curve:.08}},
    {dur:2.8,title:'Swing to the middle',note:'H3 comes across to take the swing while H1 cuts upfield after the dump (give-and-go). The disc is now central and the whole field is open.',
      moves:{'H3':{path:[[44,12],[39,20]],start:0,end:.7},'H1':{path:[[57,31]],start:0,end:.9}}, throw:{from:'H2',to:'H3',start:.38,end:.75,curve:-.08}},
    {dur:2.8,title:'Hit the cutter',note:'With the field reset, cutter 1 attacks from the front of the stack into the new open side.',
      moves:{'1':{path:[[62,20],[54,9]],start:.05,end:.8}}, throw:{from:'H3',to:'1',start:.5,end:.85,curve:.1}}
  ]
},
{
  id:'go-to', kind:'Drill', name:'Go-to drill',
  summary:'Two lines, one disc per rep. Cut, catch, return the disc, rotate. Good warm-up for timing between thrower and cutter.',
  chips:[['Players','6+'],['Cones','2'],['Discs','1 per rep']],
  view:[16,54], disc:'T1',
  players:[
    {id:'c-a',team:'cone',at:[32.5,26]},{id:'c-b',team:'cone',at:[32.5,9]},
    {id:'T1',team:'O',at:[30,26]},{id:'T2',team:'O',at:[27,26]},{id:'T3',team:'O',at:[24,26]},
    {id:'C1',team:'O',at:[30,9]},{id:'C2',team:'O',at:[27,9]},{id:'C3',team:'O',at:[24,9]}
  ],
  steps:[
    {dur:2.6,title:'Jab, then cut',note:'First cutter jabs upfield, plants, and breaks in toward open space. The thrower leads the cut.',
      moves:{'C1':{path:[[38,7.5],[41,17]],start:.1,end:.8}}, throw:{from:'T1',to:'C1',start:.5,end:.85,curve:.12}},
    {dur:3.2,title:'Return and rotate',note:'Cutter returns the disc to the next thrower, then jogs to the back of the thrower line. The thrower runs to the back of the cutter line; both lines step up.',
      moves:{'T2':{path:[[30,26]],start:0,end:.45},'T3':{path:[[27,26]],start:.05,end:.5},'C2':{path:[[30,9]],start:.1,end:.55},'C3':{path:[[27,9]],start:.15,end:.6},
             'T1':{path:[[27,17],[24,9]],start:0,end:1},'C1':{path:[[24,26]],start:.5,end:1}},
      throw:{from:'C1',to:'T2',start:.25,end:.6,curve:-.1}},
    {dur:2.6,title:'Next rep',note:'Same pattern for the next pair. Throw, follow to the cutter line, cut, return the disc, join the thrower line.',
      moves:{'C2':{path:[[38,7.5],[41,17]],start:.1,end:.8}}, throw:{from:'T2',to:'C2',start:.5,end:.85,curve:.12}}
  ]
},
{
  id:'box', kind:'Drill', name:'Box drill',
  summary:'Four cones in a 20 m square. The disc goes around the box: cut in from the next cone, catch, throw on, follow your throw.',
  chips:[['Players','5–12'],['Square','20 × 19 m'],['Throws','4 per lap']],
  view:[24,74], disc:'A1',
  players:[
    {id:'c-a',team:'cone',at:[38,28]},{id:'c-b',team:'cone',at:[58,28]},{id:'c-c',team:'cone',at:[58,9]},{id:'c-d',team:'cone',at:[38,9]},
    {id:'A1',team:'O',at:[36,30]},{id:'A2',team:'O',at:[33.5,32]},{id:'B',team:'O',at:[60,30]},{id:'C',team:'O',at:[60,7]},{id:'D',team:'O',at:[36,7]}
  ],
  steps:[
    {dur:2.6,title:'A to B',note:'B jabs out, then cuts in toward the box. A throws to the cut and follows the throw to B’s cone. Next in line steps up at A.',
      moves:{'B':{path:[[62,32],[55,25]],start:.05,end:.7},'A1':{path:[[60,30]],start:.55,end:1},'A2':{path:[[36,30]],start:.6,end:1}},
      throw:{from:'A1',to:'B',start:.45,end:.8,curve:.1}},
    {dur:2.6,title:'B to C',note:'Same move from the next corner. Cut in, catch, throw on, follow.',
      moves:{'C':{path:[[62,5],[55,12]],start:.05,end:.7},'B':{path:[[60,7]],start:.55,end:1}}, throw:{from:'B',to:'C',start:.45,end:.8,curve:.1}},
    {dur:2.6,title:'C to D',note:'Keep the cuts sharp: sell the jab outward so the in-cut creates separation.',
      moves:{'D':{path:[[34,5],[41,12]],start:.05,end:.7},'C':{path:[[36,7]],start:.55,end:1}}, throw:{from:'C',to:'D',start:.45,end:.8,curve:.1}},
    {dur:2.6,title:'D to A',note:'Lap complete. Switch direction every few minutes so everyone practises both flick and backhand.',
      moves:{'A2':{path:[[34,32],[41,25]],start:.05,end:.7},'D':{path:[[36,30]],start:.55,end:1}}, throw:{from:'D',to:'A2',start:.45,end:.8,curve:.1}}
  ]
}
];
// defenders are drawn with arms out, so give them a little more room than the bare offsets
BUILTIN.forEach(p => { p.field = 'full'; p.format = 7; p.players.forEach(q => { if (q.team === 'O') q.label = q.id; if (q.offset) q.offset = q.offset.map(v => r2(v*1.45)); }); });
BUILTIN.push(angelDrill('basic'), angelDrill('break'));
