import { timeDraft } from '../model/timing.js';

/* Angel drill: two lines 13 m apart facing the attacked end zone. Drawn as a raw drill and timed automatically.
   variant 'basic': straight throw upline to the diagonal cut.
   variant 'break': the thrower pump-fakes upline; the cutter plants and cuts back toward the side they came from, and the
   thrower bends the disc there. The thrower then cuts downfield on their own side, level with the catcher, for the horizontal pass. */
export function angelDrill(variant = 'basic'){
  const A = 12, B = 25, X = 40, Q = 2.5;           // line A across at y 12, line B at y 25, fronts at x 40, 2.5 m queue gaps
  const slot = k => X - k*Q;
  const brk = variant === 'break';
  const players = [];
  ['A','B'].forEach(L => [1,2,3,4].forEach(i => players.push({id:L+i, team:'O', label:L+i, at:[slot(i-1), L === 'A' ? A : B]})));
  const mv = path => ({path});
  const S = (from, to) => ({from, to, type:'straight', curve:0});
  // first throw of each rep: straight upline, or fake upline + bent throw out past the thrower's line
  const first = (from, to, bow) => brk ? {from, to, type:'bent', curve:bow, fake:'up'} : S(from, to);
  const cutToB = brk ? [[X+4, B-5.5], [X+11, A+1]] : [[X+5, B-.5]];   // break: heads for line B, plants, cuts back to line A's side
  const cutToA = brk ? [[X+4, A+5.5], [X+11, B-1]] : [[X+5, A+.5]];
  const thrB = brk ? [X+11, B+2] : [X+6.5, A+.5];  // where B1 cuts to for the horizontal pass
  const thrA = brk ? [X+11, A-2] : [X+6.5, B-.5];
  const steps = brk ? [
    {title:'Fake upline, cut back', note:'A1 runs diagonally toward the space in front of line B. B1 pump-fakes the straight upline throw. A1 plants and cuts back toward line A’s side, and B1 bends the disc there. Line A steps up.',
      moves:{A1:mv(cutToB), A2:mv([[slot(0), A]]), A3:mv([[slot(1), A]]), A4:mv([[slot(2), A]])}, throw:first('B1','A1',.16)},
  ] : [
    {title:'Diagonal cut, straight throw', note:'A1 runs diagonally across to a spot about 5 m in front of line B. B1 throws straight ahead to meet the cut. Line A steps up.',
      moves:{A1:mv(cutToB), A2:mv([[slot(0), A]]), A3:mv([[slot(1), A]]), A4:mv([[slot(2), A]])}, throw:first('B1','A1',0)},
  ];
  steps.push(
    {title:'Thrower cuts, horizontal pass', note: brk ? 'Right after the throw, B1 cuts diagonally downfield on their own side until level with A1. A1 passes across the field to B1. Line B steps up.' : 'Right after the throw, B1 runs diagonally toward the other side. A1 passes across the field to B1. Line B steps up.',
      moves:{B1:mv([thrB]), B2:mv([[slot(0), B]]), B3:mv([[slot(1), B]]), B4:mv([[slot(2), B]])}, throw:S('A1','B1')},
    {title:'Return to the line', note:'B1 gives the disc back to the front of line A, then jogs to the back of line A. A1 jogs to the back of line B.',
      moves:{B1:mv([[X-2, A-4], [slot(3), A]]), A1:mv([[X-2, B+4], [slot(3), B]])}, throw:S('B1','A2')},
    brk ? {title:'Reverse: fake, cut back', note:'Same pattern the other way. B2 runs toward the space in front of line A. A2 fakes upline, B2 plants and cuts back toward line B’s side, and A2 bends it there.',
      moves:{B2:mv(cutToA), B3:mv([[slot(0), B]]), B4:mv([[slot(1), B]]), A1:mv([[slot(2), B]])}, throw:first('A2','B2',-.16)}
        : {title:'Reverse: diagonal cut', note:'Same pattern the other way. B2 cuts diagonally to about 5 m in front of line A, and A2 throws straight to them.',
      moves:{B2:mv(cutToA), B3:mv([[slot(0), B]]), B4:mv([[slot(1), B]]), A1:mv([[slot(2), B]])}, throw:first('A2','B2',0)},
    {title:'Reverse: horizontal pass', note: brk ? 'A2 cuts diagonally downfield on line A’s side, level with B2, and B2 passes across to them.' : 'A2 cuts diagonally toward line B’s side and B2 passes across to them.',
      moves:{A2:mv([thrA]), A3:mv([[slot(0), A]]), A4:mv([[slot(1), A]]), B1:mv([[slot(2), A]])}, throw:S('B2','A2')},
    {title:'Reverse: return', note:'A2 gives the disc back to the front of line B and joins the back of line B. B2 joins the back of line A. The next pair starts again from line B.',
      moves:{A2:mv([[X-2, B+4], [slot(3), B]]), B2:mv([[X-2, A-4], [slot(3), A]])}, throw:S('A2','B3')}
  );
  const play = timeDraft({id: brk ? 'angel-cutback' : 'angel', kind:'Drill', name: brk ? 'Angel drill: fake & cut back' : 'Angel drill', disc:'B1', field:'full', format:7,
    summary: brk
      ? 'Angel drill with a fake. The thrower shows the straight upline throw, the diagonal cutter plants and cuts back toward the side they started from, and the thrower bends the disc there. Then the horizontal pass and the return to the line.'
      : 'Two lines facing the end zone. A diagonal cut takes a straight throw in front of the other line, the thrower cuts across for a horizontal pass, then gives the disc back to the line. Repeats in the other direction with the next pair.',
    players, steps});
  delete play.autoDurs;
  play.chips = brk ? [['Players','8+'],['Lines','2, 13 m apart'],['Fake','upline'],['Throws','bent, straight, straight']] : [['Players','8+'],['Lines','2, 13 m apart'],['Throws','3 per rep']];
  return play;
}
